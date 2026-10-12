// @ts-nocheck
import { createHmac, timingSafeEqual } from "node:crypto";
import { getOptOuts, getPrefs, listChannels, logDelivery } from "./delivery-db";
import {
	firstImageUrl,
	kindOf,
	toDiscord,
	toHtml,
	toMarkdown,
	toPlain,
	toTelegram,
} from "./markup";
import { notifyExperience } from "./notify";
import { publicUrl } from "./storage";
import { companyOf, listMembers } from "./whop-data";

const DISCORD_URL =
	/^https:\/\/(?:ptb\.|canary\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const TG_TOKEN = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/;
const TG_TARGET = /^(@[A-Za-z0-9_]{5,}|-?\d{5,})$/;
const MAX_PER_SEND = 300;

export function safeEqual(a: string, b: string) {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

export function emailReady() {
	return (
		!!process.env.RESEND_API_KEY &&
		!!process.env.EMAIL_FROM_ADDRESS &&
		!!process.env.APP_URL &&
		!!process.env.UNSUBSCRIBE_SECRET
	);
}

export function validDiscordUrl(url: string) {
	return DISCORD_URL.test(url);
}

export function validTelegram(token: string, target: string) {
	return TG_TOKEN.test(token) && TG_TARGET.test(target);
}

// ---------- unsubscribe links ----------

export function unsubscribeToken(email: string, experienceId: string) {
	const secret = process.env.UNSUBSCRIBE_SECRET ?? "";
	const payload = Buffer.from(JSON.stringify({ e: email, x: experienceId })).toString("base64url");
	const sig = createHmac("sha256", secret).update(payload).digest("base64url");
	return `${payload}.${sig}`;
}

export function readUnsubscribeToken(
	token: string,
): { email: string; experienceId: string } | null {
	const secret = process.env.UNSUBSCRIBE_SECRET ?? "";
	if (!secret) return null;
	const [payload, sig] = token.split(".");
	if (!payload || !sig) return null;
	const expected = createHmac("sha256", secret).update(payload).digest("base64url");
	if (!safeEqual(sig, expected)) return null;
	try {
		const data = JSON.parse(Buffer.from(payload, "base64url").toString());
		if (typeof data.e !== "string" || typeof data.x !== "string") return null;
		return { email: data.e, experienceId: data.x };
	} catch {
		return null;
	}
}

// ---------- helpers ----------

const esc = (s: string) =>
	String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

function atts(item: any) {
	return Array.isArray(item.attachments) ? item.attachments : [];
}

function firstImage(item: any): string | null {
	const img = atts(item).find((a: any) => kindOf(a.name) === "image");
	return img ? publicUrl(img.path) : firstImageUrl(item.body);
}

function fileList(item: any) {
	return atts(item).filter((a: any) => kindOf(a.name) !== "image");
}

// ---------- Discord ----------

async function sendDiscord(webhook: string, item: any) {
	if (!DISCORD_URL.test(webhook)) {
		return { ok: false, detail: "The saved Discord link is not valid." };
	}
	const extra = fileList(item)
		.map((a: any) => `📎 [${a.name}](${publicUrl(a.path)})`)
		.join("\n");
	const description = [toDiscord(item.body), extra].filter(Boolean).join("\n\n").slice(0, 4000);
	const image = firstImage(item);
	const res = await fetch(webhook, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			username: "Announcements",
			allowed_mentions: { parse: [] },
			embeds: [
				{
					title: String(item.title).slice(0, 256),
					description,
					color: 0xff5a1f,
					...(image ? { image: { url: image } } : {}),
				},
			],
		}),
		signal: AbortSignal.timeout(7000),
	});
	if (res.ok) return { ok: true, detail: "" };
	const t = await res.text().catch(() => "");
	return { ok: false, detail: `Discord answered ${res.status}. ${t.slice(0, 120)}` };
}

// ---------- Telegram ----------

async function tg(token: string, method: string, payload: any) {
	const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(7000),
	});
	const j: any = await res.json().catch(() => null);
	return {
		ok: res.ok && j?.ok !== false,
		detail: String(j?.description ?? `status ${res.status}`),
	};
}

async function sendTelegram(ch: any, item: any) {
	const title = esc(item.title);
	const files = fileList(item)
		.map((a: any) => `📎 <a href="${esc(publicUrl(a.path))}">${esc(a.name)}</a>`)
		.join("\n");
	const body = [toTelegram(item.body), files].filter(Boolean).join("\n\n");
	const image = firstImage(item);
	const chat_id = ch.target;
	let r;
	if (image) {
		r = await tg(ch.secret, "sendPhoto", {
			chat_id,
			photo: image,
			caption: `<b>${title}</b>`,
			parse_mode: "HTML",
		});
		if (r.ok && body) {
			r = await tg(ch.secret, "sendMessage", {
				chat_id,
				text: body.slice(0, 4000),
				parse_mode: "HTML",
			});
		}
	} else {
		r = await tg(ch.secret, "sendMessage", {
			chat_id,
			text: `<b>${title}</b>\n\n${body}`.slice(0, 4000),
			parse_mode: "HTML",
		});
	}
	if (!r.ok && /parse|entities/i.test(r.detail)) {
		r = await tg(ch.secret, "sendMessage", {
			chat_id,
			text: `${item.title}\n\n${toPlain(item.body)}`.slice(0, 4000),
		});
	}
	return r;
}

// ---------- Whop chat and public forum ----------

async function whopPost(path: string, body: any) {
	const res = await fetch(`https://api.whop.com/api/v1${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.WHOP_API_KEY ?? ""}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(7000),
	});
	if (res.ok) return { ok: true, detail: "" };
	const t = await res.text().catch(() => "");
	if (res.status === 401 || res.status === 403) {
		return {
			ok: false,
			detail: `Whop did not allow it (${res.status}). Check the app permission and that this community approved it. ${t.slice(0, 100)}`,
		};
	}
	return { ok: false, detail: `Whop answered ${res.status}. ${t.slice(0, 140)}` };
}

async function sendChat(item: any, chatExperienceId: string | null) {
	if (!chatExperienceId) {
		return { ok: false, detail: "Whop chat is not set up in Settings yet." };
	}
	const files = fileList(item)
		.map((a: any) => `${a.name}: ${publicUrl(a.path)}`)
		.join("\n");
	const content = [`**${item.title}**`, toMarkdown(item.body), files]
		.filter(Boolean)
		.join("\n\n")
		.slice(0, 3900);
	return whopPost("/messages", { channel_id: chatExperienceId, content });
}

async function sendForum(item: any) {
	const company = await companyOf(item.experienceId);
	if (!company.id) return { ok: false, detail: "Could not find this community on Whop." };
	const images = atts(item)
		.filter((a: any) => kindOf(a.name) === "image")
		.map((a: any) => `![](${publicUrl(a.path)})`);
	const files = fileList(item).map((a: any) => `[${a.name}](${publicUrl(a.path)})`);
	const content = [toMarkdown(item.body), ...images, ...files].filter(Boolean).join("\n\n");
	return whopPost("/forum_posts", {
		experience_id: "public",
		company_id: company.id,
		title: String(item.title).slice(0, 200),
		content,
	});
}

// ---------- Email ----------

async function sendEmail(item: any, deadline: number) {
	if (!emailReady()) return { ok: false, detail: "Email is not set up on this app yet." };
	const company = await companyOf(item.experienceId);
	if (!company.id) return { ok: false, detail: "Could not find this community on Whop." };

	const listed = await listMembers(company.id, 6);
	if (listed.error === "PERMISSION") {
		return {
			ok: false,
			detail:
				"Whop did not allow reading member emails. Add member:basic:read and member:email:read to this app and approve them in this community.",
		};
	}
	if (listed.error && listed.members.length === 0) {
		return { ok: false, detail: listed.error };
	}

	const optouts = await getOptOuts(item.experienceId);
	let emails = Array.from(
		new Set(
			listed.members
				.filter((m) => m.email && m.access !== "no_access")
				.map((m) => m.email.trim().toLowerCase()),
		),
	).filter((e) => !optouts.has(e));
	if (emails.length === 0) {
		return {
			ok: false,
			detail: "No member emails were available. Check the member:email:read permission.",
		};
	}
	let limited = false;
	if (emails.length > MAX_PER_SEND) {
		emails = emails.slice(0, MAX_PER_SEND);
		limited = true;
	}

	const base = (process.env.APP_URL ?? "").replace(/\/+$/, "");
	const fromName =
		company.title.replace(/[<>"\r\n]/g, "").slice(0, 60) || "Announcements";
	const from = `${fromName} <${process.env.EMAIL_FROM_ADDRESS}>`;

	const pics = atts(item)
		.filter((a: any) => kindOf(a.name) === "image")
		.map(
			(a: any) =>
				`<img src="${esc(publicUrl(a.path))}" alt="" style="max-width:100%;border-radius:12px;display:block;margin:12px 0">`,
		)
		.join("");
	const links = fileList(item)
		.map(
			(a: any) =>
				`<p style="margin:0 0 8px">📎 <a href="${esc(publicUrl(a.path))}" style="color:#ff5a1f">${esc(a.name)}</a></p>`,
		)
		.join("");
	const html = `${toHtml(item.body)}${pics}${links}`;

	let sent = 0;
	for (let i = 0; i < emails.length; i += 100) {
		if (Date.now() > deadline) break;
		const chunk = emails.slice(i, i + 100);
		const messages = chunk.map((email) => {
			const unsub = `${base}/api/unsubscribe?t=${unsubscribeToken(email, item.experienceId)}`;
			return {
				from,
				to: [email],
				subject: String(item.title).slice(0, 200),
				html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#231915"><h2 style="margin:0 0 16px">${esc(item.title)}</h2><div style="line-height:1.6">${html}</div><hr style="border:none;border-top:1px solid #eadfd8;margin:24px 0"><p style="font-size:12px;color:#7d6e66">You receive this because you are a member of ${esc(company.title)}. <a href="${esc(unsub)}">Unsubscribe</a></p></div>`,
				text: `${item.title}\n\n${toPlain(item.body)}\n\nUnsubscribe: ${unsub}`,
				headers: {
					"List-Unsubscribe": `<${unsub}>`,
					"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
				},
			};
		});
		const res = await fetch("https://api.resend.com/emails/batch", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(messages),
			signal: AbortSignal.timeout(7000),
		});
		if (!res.ok) {
			const t = await res.text().catch(() => "");
			return {
				ok: sent > 0,
				detail: `Resend answered ${res.status}. ${t.slice(0, 140)} (${sent} sent before the error.)`,
			};
		}
		sent += chunk.length;
	}
	return {
		ok: sent > 0,
		detail: `${sent} member${sent === 1 ? "" : "s"}.${limited ? ` Limited to the first ${MAX_PER_SEND}.` : ""}${sent < emails.length && !limited ? " Stopped early to stay within the time limit." : ""}`,
	};
}

// ---------- put it together ----------

async function run(item: any, label: string, job: () => Promise<any>) {
	let ok = false;
	let detail = "";
	try {
		const r = await job();
		ok = !!r.ok;
		detail = r.detail ?? "";
	} catch (e) {
		detail = e instanceof Error ? e.message.slice(0, 140) : "error";
	}
	const text = ok
		? detail
			? `${label} sent. ${detail}`
			: `${label} sent.`
		: `${label} failed. ${detail}`;
	try {
		await logDelivery(item.experienceId, item.id ?? null, label, ok, detail || (ok ? "sent" : "failed"));
	} catch {}
	return text;
}

export async function deliver(item: any, channels: any): Promise<string[]> {
	const deadline = Date.now() + 8000;
	const prefs = await getPrefs(item.experienceId);
	const out: string[] = [];
	const jobs: Promise<string>[] = [];

	if (channels.push) {
		if (item.targeted) out.push("Push skipped: this post is targeted to specific products.");
		else if (!prefs.push_enabled) out.push("Push is turned off in Settings.");
		else {
			jobs.push(
				run(item, "Push", () =>
					notifyExperience({
						experienceId: item.experienceId,
						title: item.title,
						content: toPlain(item.body) || item.title,
					}),
				),
			);
		}
	}

	const ids: string[] = Array.isArray(channels.channelIds) ? channels.channelIds : [];
	if (ids.length > 0) {
		const rows = await listChannels(item.experienceId);
		for (const id of ids) {
			const ch = rows.find((r) => r.id === id);
			if (!ch) continue;
			const label = `${ch.kind === "discord" ? "Discord" : "Telegram"} (${ch.name})`;
			jobs.push(
				run(item, label, () =>
					ch.kind === "discord" ? sendDiscord(ch.secret, item) : sendTelegram(ch, item),
				),
			);
		}
	}

	if (channels.chat) {
		if (item.targeted) out.push("Whop chat skipped: this post is targeted.");
		else jobs.push(run(item, "Whop chat", () => sendChat(item, prefs.chat_experience_id)));
	}
	if (channels.forum) {
		if (item.targeted) out.push("Whop forum skipped: this post is targeted.");
		else jobs.push(run(item, "Whop forum", () => sendForum(item)));
	}

	out.push(...(await Promise.all(jobs)));

	if (channels.email) {
		if (item.targeted) out.push("Email skipped: this post is targeted.");
		else out.push(await run(item, "Email", () => sendEmail(item, deadline)));
	}
	return out;
}

export async function testChannel(ch: any): Promise<string> {
	const item = {
		experienceId: ch.experience_id,
		title: "Test announcement",
		body: "Your channel is connected. Real announcements will appear here.",
		attachments: [],
	};
	const label = ch.kind === "discord" ? "Discord" : "Telegram";
	try {
		const r = ch.kind === "discord" ? await sendDiscord(ch.secret, item) : await sendTelegram(ch, item);
		return r.ok ? `Test message sent to ${label}.` : `${label} failed. ${r.detail}`;
	} catch (e) {
		return `${label} failed. ${e instanceof Error ? e.message.slice(0, 120) : ""}`;
	}
}