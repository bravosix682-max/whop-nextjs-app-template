// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { cached, claim, forget } from "@/lib/cache";
import {
	addChannel,
	banUser,
	countComments,
	getComment,
	getPrefs,
	insertComment,
	isBannedRow,
	lastComment,
	listBans,
	listChannels,
	patchPost,
	reactionOn,
	removeChannel,
	removeComment,
	savePrefs,
	scheduleDelivery,
	unbanUser,
} from "@/lib/delivery-db";
import { deliver, emailReady, testChannel, validDiscordUrl, validTelegram } from "@/lib/deliver";
import { extOf, kindOf, MIME_BY_EXT } from "@/lib/markup";
import { notifyExperience } from "@/lib/notify";
import { asPlan, EMOJIS, FEATURES, PLAN_PRICES } from "@/lib/plans";
import { publicUrl, removeFiles, signUpload, validPath } from "@/lib/storage";
import {
	acknowledge,
	castVote,
	createAnnouncement,
	deleteAnnouncement,
	getAnnouncement,
	getPlanInfo,
	listAnnouncements,
	recordViews,
	setOwnerPlan,
	setPinned,
	toggleReaction,
	updateAnnouncement,
} from "@/lib/supabase";
import { companyOf, listMembers, listProducts, userInfo } from "@/lib/whop-data";
import { whopsdk } from "@/lib/whop-sdk";

const UUID = /^[0-9a-f-]{36}$/i;

function clean(value: any, max: number) {
	return String(value ?? "").trim().slice(0, max);
}

function isoOrNull(value: any) {
	const s = String(value ?? "").trim();
	if (!s) return null;
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isLiveAt(a: any, t: number) {
	return (
		new Date(a.publish_at).getTime() <= t &&
		(!a.expires_at || new Date(a.expires_at).getTime() > t)
	);
}

async function ctx(experienceId: string) {
	const { userId } = await whopsdk.verifyUserToken(await headers());
	const access: any = await cached(`access:${userId}:${experienceId}`, 60_000, () =>
		whopsdk.users.checkAccess(experienceId, { id: userId }),
	);
	const isAdmin = String(access?.access_level) === "admin";
	const canView = isAdmin || access?.has_access !== false;
	const info: any = await cached(`plan:${experienceId}`, 3_000, () => getPlanInfo(experienceId));
	const owners = (process.env.OWNER_USER_IDS ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return {
		userId,
		isAdmin,
		canView,
		info,
		plan: info.plan,
		f: FEATURES[info.plan as "starter" | "pro" | "business"],
		base: `/experiences/${experienceId}`,
		canSwitchFree: isAdmin && owners.includes(userId),
	};
}

async function guardMember(experienceId: string, c: any) {
	if (c.isAdmin) return;
	if (!c.canView) throw new Error("No access");
	const banned = await cached(`ban:${experienceId}:${c.userId}`, 15_000, () =>
		isBannedRow(experienceId, c.userId),
	);
	if (banned) throw new Error("You are restricted in this community.");
}

// ---------- reactions, acknowledgements, votes, views ----------

export async function react(experienceId: string, id: string, emoji: string) {
	if (!UUID.test(id) || !EMOJIS.includes(emoji)) return;
	const c = await ctx(experienceId);
	await guardMember(experienceId, c);
	await toggleReaction(id, c.userId, emoji);
	if (c.isAdmin) return;
	try {
		const prefs = await getPrefs(experienceId);
		if (!prefs.notify_reactions) return;
		if (!(await reactionOn(id, c.userId, emoji))) return;
		if (!claim(`rn:${id}:${c.userId}`, 60_000)) return;
		const post: any = await getAnnouncement(experienceId, id);
		if (!post?.author_id) return;
		const who = await userInfo(c.userId);
		await notifyExperience({
			experienceId,
			title: "New reaction",
			content: `${who.name} reacted ${emoji} to "${post.title}"`,
			userIds: [post.author_id],
		});
	} catch {}
}

export async function ack(experienceId: string, id: string) {
	if (!UUID.test(id)) return;
	const c = await ctx(experienceId);
	await guardMember(experienceId, c);
	await acknowledge(id, c.userId);
}

export async function vote(experienceId: string, id: string, index: number) {
	if (!UUID.test(id) || !Number.isInteger(index)) return;
	const c = await ctx(experienceId);
	await guardMember(experienceId, c);
	const a: any = await getAnnouncement(experienceId, id);
	if (!a?.poll || index < 0 || index >= a.poll.options.length) return;
	await castVote(id, c.userId, index);
}

export async function markSeen(experienceId: string, rows: any[]) {
	const c = await ctx(experienceId);
	if (c.isAdmin || !c.canView) return;
	const ok = (rows ?? []).filter((r) => r && UUID.test(String(r.id))).slice(0, 100);
	await recordViews(c.userId, ok);
}

// ---------- pin, delete ----------

export async function pin(experienceId: string, id: string, pinned: boolean): Promise<string> {
	const c = await ctx(experienceId);
	if (!c.isAdmin || !UUID.test(id)) return "Not allowed.";
	if (pinned) {
		const list = await listAnnouncements(experienceId);
		const others = list.filter((a) => a.pinned && a.id !== id).length;
		if (others >= c.f.pinMax) {
			return `Your plan allows ${c.f.pinMax} pinned announcement${c.f.pinMax === 1 ? "" : "s"}.`;
		}
	}
	await setPinned(experienceId, id, pinned);
	revalidatePath(c.base);
	return "";
}

export async function remove(experienceId: string, id: string): Promise<string> {
	const c = await ctx(experienceId);
	if (!c.isAdmin || !UUID.test(id)) return "Not allowed.";
	const post: any = await getAnnouncement(experienceId, id);
	await deleteAnnouncement(experienceId, id);
	try {
		const paths = (Array.isArray(post?.attachments) ? post.attachments : [])
			.map((a: any) => a.path)
			.filter((p: string) => validPath(experienceId, p));
		await removeFiles(paths);
	} catch {}
	revalidatePath(c.base);
	return "";
}

// ---------- publish and edit ----------

export async function publish(experienceId: string, _prev: any, formData: FormData) {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return { ok: false, message: "Only admins can post." };
	if (String(formData.get("uploading") ?? "") === "1") {
		return { ok: false, message: "Wait for the uploads to finish, then post." };
	}
	const f = c.f;
	const title = clean(formData.get("title"), 120);
	const body = clean(formData.get("body"), 4000);
	if (!title || !body) return { ok: false, message: "Add a headline and a message." };
	const rawId = String(formData.get("id") ?? "");
	const id = UUID.test(rawId) ? rawId : crypto.randomUUID();
	const p = String(formData.get("priority") ?? "");
	const priority = p === "important" || p === "urgent" ? p : "normal";
	const wantPin = formData.get("pinned") === "on";

	const existing = await listAnnouncements(experienceId);
	const t = Date.now();
	if (existing.filter((a) => isLiveAt(a, t)).length >= f.liveMax) {
		return {
			ok: false,
			message: `Your plan allows ${f.liveMax} live announcements. Delete one or upgrade.`,
		};
	}
	if (wantPin && existing.filter((a) => a.pinned).length >= f.pinMax) {
		return {
			ok: false,
			message: `Your plan allows ${f.pinMax} pinned announcement${f.pinMax === 1 ? "" : "s"}. Unpin one or upgrade.`,
		};
	}

	const publishAt = f.schedule ? isoOrNull(formData.get("publish_at")) : null;
	const eventAt = f.countdown ? isoOrNull(formData.get("event_at")) : null;
	const expiresAt = f.expire ? isoOrNull(formData.get("expires_at")) : null;
	const requireAck = f.acknowledge && formData.get("require_ack") === "on";
	const altTitle = f.abTest ? clean(formData.get("alt_title"), 120) || null : null;
	const commentsEnabled = formData.get("read_only") !== "on";

	let poll: any = null;
	if (f.poll) {
		const question = clean(formData.get("poll_q"), 140);
		const options = [1, 2, 3, 4]
			.map((n) => clean(formData.get(`poll_o${n}`), 80))
			.filter(Boolean);
		if (question && options.length >= 2) poll = { question, options };
	}

	let attachments: any[] = [];
	try {
		const raw = JSON.parse(String(formData.get("attachments") || "[]"));
		if (Array.isArray(raw)) {
			attachments = raw
				.slice(0, f.attachMax)
				.filter((a) => a && validPath(experienceId, String(a.path)) && kindOf(String(a.name)))
				.map((a) => ({
					path: String(a.path),
					name: String(a.name).slice(0, 120),
					type: String(a.type ?? "").slice(0, 80),
					size: Number(a.size) || 0,
				}));
		}
	} catch {}

	let targets: string[] = [];
	if (f.targetProducts) {
		try {
			const raw = JSON.parse(String(formData.get("targets") || "[]"));
			if (Array.isArray(raw)) {
				targets = raw.map(String).filter((x) => /^prod_[A-Za-z0-9]+$/.test(x)).slice(0, 25);
			}
		} catch {}
	}

	const channelIds: string[] = [];
	for (const [k, v] of formData.entries()) {
		if (k.startsWith("ch_") && v === "on" && UUID.test(k.slice(3))) channelIds.push(k.slice(3));
	}
	const channels = {
		push: true,
		email: f.email && emailReady() && formData.get("email") === "on",
		chat: f.whopChat && formData.get("chat") === "on",
		forum: f.whopForum && formData.get("forum") === "on",
		channelIds,
	};

	const scheduledLater = !!publishAt && new Date(publishAt).getTime() > Date.now();

	await createAnnouncement({
		id,
		experience_id: experienceId,
		title,
		body,
		pinned: wantPin,
		author_id: c.userId,
		priority,
		require_ack: requireAck,
		publish_at: publishAt ?? undefined,
		event_at: eventAt,
		expires_at: expiresAt,
		alt_title: altTitle,
		poll,
	});
	await patchPost(id, {
		comments_enabled: commentsEnabled,
		target_products: targets.length ? targets : null,
		attachments: attachments.length ? attachments : null,
	});

	let message = scheduledLater ? "Scheduled." : "Posted.";
	if (scheduledLater) {
		await scheduleDelivery(id, channels);
		message += " Push and your chosen channels will go out at the scheduled time.";
	} else {
		const results = await deliver(
			{ id, experienceId, title, body, attachments, targeted: targets.length > 0 },
			channels,
		);
		if (results.length) message += ` ${results.join(" ")}`;
	}
	revalidatePath(c.base);
	return { ok: true, message };
}

export async function update(experienceId: string, _prev: any, formData: FormData) {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return { ok: false, message: "Only admins can edit." };
	const id = String(formData.get("id") ?? "");
	if (!UUID.test(id)) return { ok: false, message: "Something went wrong." };
	const title = clean(formData.get("title"), 120);
	const body = clean(formData.get("body"), 4000);
	if (!title || !body) return { ok: false, message: "Add a headline and a message." };
	const p = String(formData.get("priority") ?? "");
	const priority = p === "important" || p === "urgent" ? p : "normal";
	const wantPin = formData.get("pinned") === "on";
	if (wantPin) {
		const list = await listAnnouncements(experienceId);
		const others = list.filter((a) => a.pinned && a.id !== id).length;
		if (others >= c.f.pinMax) {
			return {
				ok: false,
				message: `Your plan allows ${c.f.pinMax} pinned announcement${c.f.pinMax === 1 ? "" : "s"}.`,
			};
		}
	}
	await updateAnnouncement(experienceId, id, { title, body, pinned: wantPin, priority });
	revalidatePath(c.base);
	return { ok: true, message: "Saved." };
}

// ---------- comments ----------

export async function addComment(experienceId: string, postId: string, text: string) {
	if (!UUID.test(postId)) return { ok: false, message: "Something went wrong." };
	const c = await ctx(experienceId);
	try {
		await guardMember(experienceId, c);
	} catch {
		return { ok: false, message: "You can't comment in this community." };
	}
	const body = clean(text, 1000);
	if (!body) return { ok: false, message: "Write something first." };
	const post: any = await getAnnouncement(experienceId, postId);
	if (!post) return { ok: false, message: "This announcement no longer exists." };
	if (post.comments_enabled === false) {
		return { ok: false, message: "Comments are turned off for this post." };
	}
	const prefs = await getPrefs(experienceId);
	if (!c.isAdmin && prefs.spam_protection && c.f.spam) {
		if (/https?:\/\/|www\./i.test(body)) {
			return { ok: false, message: "Links are not allowed in comments." };
		}
		const last = await lastComment(experienceId, c.userId);
		if (last && last.trim().toLowerCase() === body.toLowerCase()) {
			return { ok: false, message: "You already posted that." };
		}
		const perMin = await countComments(
			experienceId,
			c.userId,
			new Date(Date.now() - 60_000).toISOString(),
		);
		if (perMin >= 3) return { ok: false, message: "You're commenting too fast. Wait a minute." };
		const perDay = await countComments(
			experienceId,
			c.userId,
			new Date(Date.now() - 86_400_000).toISOString(),
		);
		if (perDay >= 30) return { ok: false, message: "Daily comment limit reached." };
	}
	const who = await userInfo(c.userId);
	const row = await insertComment({
		announcement_id: postId,
		experience_id: experienceId,
		user_id: c.userId,
		user_name: who.name,
		user_handle: who.handle,
		body,
	});
	if (!row) return { ok: false, message: "Could not save your comment." };
	try {
		if (!c.isAdmin && prefs.notify_comments && post.author_id && claim(`cn:${postId}:${c.userId}`, 30_000)) {
			await notifyExperience({
				experienceId,
				title: "New comment",
				content: `${who.name}: ${body}`,
				userIds: [post.author_id],
			});
		}
	} catch {}
	return { ok: true, comment: row };
}

export async function deleteComment(experienceId: string, id: string): Promise<string> {
	if (!UUID.test(id)) return "Not allowed.";
	const c = await ctx(experienceId);
	const row = await getComment(experienceId, id);
	if (!row) return "";
	if (!c.isAdmin && row.user_id !== c.userId) return "Not allowed.";
	await removeComment(experienceId, id);
	return "";
}

// ---------- settings ----------

export async function savePreferences(experienceId: string, patch: any): Promise<string> {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return "Only admins can change settings.";
	const out: any = {};
	for (const k of ["push_enabled", "notify_reactions", "notify_comments", "spam_protection"]) {
		if (typeof patch?.[k] === "boolean") out[k] = patch[k];
	}
	if (out.spam_protection === true && !c.f.spam) return "Spam protection is on the Pro plan.";
	if (Object.keys(out).length === 0) return "Nothing to save.";
	await savePrefs(experienceId, out);
	revalidatePath(c.base);
	return "Saved.";
}

export async function saveChatTarget(experienceId: string, value: string): Promise<string> {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return "Only admins can change settings.";
	if (!c.f.whopChat) return "Whop chat is on the Pro plan.";
	const v = String(value ?? "").trim();
	if (v && !/^exp_[A-Za-z0-9]+$/.test(v)) {
		return "That should look like exp_XXXXXXXX, the code in your chat's address.";
	}
	await savePrefs(experienceId, { chat_experience_id: v || null });
	revalidatePath(c.base);
	return v ? "Whop chat saved." : "Whop chat cleared.";
}

export async function addChannelAction(
	experienceId: string,
	kind: string,
	name: string,
	secret: string,
	target: string,
): Promise<string> {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return "Only admins can do this.";
	if (kind !== "discord" && kind !== "telegram") return "Unknown channel type.";
	const rows = await listChannels(experienceId);
	if (rows.filter((r) => r.kind === kind).length >= c.f.channelsMax) {
		return `Your plan allows ${c.f.channelsMax} ${kind} channel${c.f.channelsMax === 1 ? "" : "s"}. Upgrade for more.`;
	}
	const label = clean(name, 40);
	if (!label) return "Give the channel a name.";
	const sec = clean(secret, 300);
	if (kind === "discord") {
		if (!validDiscordUrl(sec)) return "That does not look like a Discord webhook link.";
		await addChannel(experienceId, "discord", label, sec, null);
	} else {
		const tgt = clean(target, 80);
		if (!validTelegram(sec, tgt)) return "Check the bot token and the channel or group ID.";
		await addChannel(experienceId, "telegram", label, sec, tgt);
	}
	revalidatePath(c.base);
	return "Channel added.";
}

export async function removeChannelAction(experienceId: string, id: string): Promise<string> {
	const c = await ctx(experienceId);
	if (!c.isAdmin || !UUID.test(id)) return "Not allowed.";
	await removeChannel(experienceId, id);
	revalidatePath(c.base);
	return "Channel removed.";
}

export async function testChannelAction(experienceId: string, id: string): Promise<string> {
	const c = await ctx(experienceId);
	if (!c.isAdmin || !UUID.test(id)) return "Not allowed.";
	const rows = await listChannels(experienceId);
	const ch = rows.find((r) => r.id === id);
	if (!ch) return "Channel not found.";
	return await testChannel(ch);
}

// ---------- ban list ----------

export async function fetchMembers(experienceId: string) {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return { error: "Only admins can do this.", members: [] };
	if (!c.f.banList) return { error: "The ban list is on the Business plan.", members: [] };
	try {
		const company = await companyOf(experienceId);
		const res = await listMembers(company.id, 3);
		const bans = await listBans(experienceId);
		const banned = new Set(bans.map((b) => b.user_id));
		const list = res.members
			.filter((m) => m.access !== "admin" && m.id !== c.userId)
			.map((m) => ({ id: m.id, name: m.name, handle: m.handle, banned: banned.has(m.id) }));
		for (const b of bans) {
			if (!list.find((m) => m.id === b.user_id)) {
				list.push({ id: b.user_id, name: b.name ?? "", handle: b.handle ?? "", banned: true });
			}
		}
		return { error: res.error ?? "", members: list };
	} catch {
		return { error: "Could not load members.", members: [] };
	}
}

export async function banAction(experienceId: string, member: any): Promise<string> {
	const c = await ctx(experienceId);
	if (!c.isAdmin || !c.f.banList) return "Not allowed.";
	const id = clean(member?.id, 80);
	if (!id || id === c.userId) return "Not allowed.";
	await banUser(experienceId, { id, name: clean(member?.name, 80), handle: clean(member?.handle, 80) });
	forget(`ban:${experienceId}:${id}`);
	return "";
}

export async function unbanAction(experienceId: string, userId: string): Promise<string> {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return "Not allowed.";
	await unbanUser(experienceId, clean(userId, 80));
	forget(`ban:${experienceId}:${userId}`);
	return "";
}

// ---------- editor helpers ----------

export async function prepareUpload(experienceId: string, name: string, size: number) {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return { ok: false, error: "Only admins can attach files." };
	const nm = String(name ?? "");
	if (!kindOf(nm)) return { ok: false, error: "This file type is not supported." };
	if (!(size > 0) || size > c.f.attachMb * 1048576) {
		return { ok: false, error: `Files can be up to ${c.f.attachMb} MB on your plan.` };
	}
	const ext = extOf(nm);
	const safe =
		nm
			.toLowerCase()
			.replace(/\.[^.]*$/, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40) || "file";
	const path = `${experienceId}/${crypto.randomUUID()}-${safe}.${ext}`;
	const signed = await signUpload(path);
	if (!signed.ok) return { ok: false, error: signed.error };
	return {
		ok: true,
		path,
		uploadUrl: signed.url,
		contentType: MIME_BY_EXT[ext] ?? "application/octet-stream",
		url: publicUrl(path),
		apikey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
	};
}

export async function fetchProducts(experienceId: string) {
	const c = await ctx(experienceId);
	if (!c.isAdmin || !c.f.targetProducts) {
		return { products: [], error: "Targeting is on the Pro plan." };
	}
	try {
		const company = await companyOf(experienceId);
		return await listProducts(company.id);
	} catch {
		return { products: [], error: "Could not load products." };
	}
}

export async function fetchMentionMembers(experienceId: string) {
	const c = await ctx(experienceId);
	if (!c.isAdmin || !c.f.mentions) {
		return { members: [], error: "Mentions are on the Business plan." };
	}
	try {
		const company = await companyOf(experienceId);
		const res = await listMembers(company.id, 3);
		return {
			members: res.members.map((m) => ({ id: m.id, name: m.name, handle: m.handle })),
			error: res.error ?? "",
		};
	} catch {
		return { members: [], error: "Could not load members." };
	}
}

// ---------- plans and payments ----------

export async function choosePlan(experienceId: string, next: string) {
	const c = await ctx(experienceId);
	if (!c.canSwitchFree) return;
	await setOwnerPlan(experienceId, asPlan(next));
	forget(`plan:${experienceId}`);
	revalidatePath(c.base);
}

export async function startCheckout(experienceId: string, target: string) {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return { ok: false, error: "Only admins can upgrade." };
	const p = asPlan(target);
	if (p === "starter") return { ok: false, error: "Choose Pro or Business." };

	const current = await getPlanInfo(experienceId);
	if (current.paidActive) {
		return {
			ok: false,
			error:
				current.stored === p
					? "You are already on this plan."
					: "Cancel your current plan in Whop first, then choose the new one.",
		};
	}

	const companyId = process.env.WHOP_PAYOUT_COMPANY_ID;
	const productId = process.env.WHOP_PRODUCT_ID;
	if (!companyId || !productId) return { ok: false, error: "Billing is not set up yet." };

	const testPrice = c.canSwitchFree
		? Number(process.env[p === "pro" ? "PRICE_PRO" : "PRICE_BUSINESS"])
		: Number.NaN;
	const price = Number.isFinite(testPrice) && testPrice > 0 ? testPrice : PLAN_PRICES[p];
	if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Invalid price setting." };

	try {
		const cfg: any = await whopsdk.checkoutConfigurations.create({
			plan: {
				company_id: companyId,
				product_id: productId,
				currency: "usd",
				plan_type: "renewal",
				initial_price: 0,
				renewal_price: price,
				billing_period: 30,
			},
			metadata: {
				app: "announcements",
				experience_id: experienceId,
				plan: p,
				user_id: c.userId,
			},
		} as any);
		const planId = cfg?.plan?.id ?? cfg?.plan_id;
		if (!cfg?.id || !planId) return { ok: false, error: "Whop did not return a checkout." };
		return { ok: true, id: String(cfg.id), planId: String(planId) };
	} catch (e) {
		const detail = e instanceof Error ? e.message.slice(0, 160) : "";
		return { ok: false, error: `Could not start checkout. ${detail}` };
	}
}

export async function checkPlan(experienceId: string): Promise<string> {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return "";
	forget(`plan:${experienceId}`);
	const i = await getPlanInfo(experienceId);
	return i.plan;
}