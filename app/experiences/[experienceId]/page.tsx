import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { cached, forget } from "@/lib/cache";
import { notifyExperience } from "@/lib/notify";
import {
	asPlan,
	EMOJIS,
	FEATURES,
	PLAN_NAMES,
	PLAN_PRICES,
	type Plan,
} from "@/lib/plans";
import {
	acknowledge,
	type Announcement,
	castVote,
	createAnnouncement,
	deleteAnnouncement,
	GRACE_DAYS,
	getAnnouncement,
	getPlanInfo,
	getStats,
	listAnnouncements,
	type PlanInfo,
	recordViews,
	type Stats,
	setOwnerPlan,
	setPinned,
	toggleReaction,
	updateAnnouncement,
} from "@/lib/supabase";
import { whopsdk } from "@/lib/whop-sdk";
import "./announcements.css";
import { type CheckoutStart, UpgradeButton } from "./billing-ui";
import { CreateForm, type FormResult } from "./create-form";
import { CountUp, PostActions } from "./extras";
import { Icon, type IconName } from "./icons";
import {
	AckButton,
	Countdown,
	ExportButton,
	PlanButton,
	PollBlock,
	ReactionBar,
} from "./interactive";
import { Shell, ThemeToggle } from "./shell";
import { ViewTracker } from "./view-tracker";

const UUID = /^[0-9a-f-]{36}$/i;
const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;
const IMAGE_URL = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;

const PLAN_CARDS: { plan: Plan; blurb: string; items: string[] }[] = [
	{
		plan: "starter",
		blurb: "For new communities getting started",
		items: [
			"5 live announcements",
			"Rich formatting and emoji reactions",
			"Pin 1 announcement",
			"Priority labels",
			"Basic view count",
		],
	},
	{
		plan: "pro",
		blurb: "For creators who need members to actually read",
		items: [
			"Unlimited announcements",
			"Schedule posts for later",
			"Polls inside announcements",
			"Must-acknowledge posts with read receipts",
			"Event countdowns and auto-expiry",
			"Full engagement analytics",
		],
	},
	{
		plan: "business",
		blurb: "For brands running serious communities",
		items: [
			"Everything in Pro",
			"Push notifications to all members at once",
			"A/B test two headlines",
			"Export analytics to CSV",
		],
	},
];

function renderText(text: string, keyBase: string): ReactNode[] {
	return text
		.split(/\*\*(.+?)\*\*/g)
		.map((part, j) =>
			j % 2 === 1 ? <strong key={`${keyBase}-${j}`}>{part}</strong> : part,
		);
}

function renderBody(text: string): ReactNode[] {
	return text.split(URL_PATTERN).map((part, i) => {
		if (i % 2 === 0) return <span key={i}>{renderText(part, String(i))}</span>;
		const url = part.replace(/[.,!?;:)]+$/, "");
		const tail = part.slice(url.length);
		if (IMAGE_URL.test(url)) {
			return (
				<span key={i}>
					<a href={url} target="_blank" rel="noopener noreferrer">
						<img
							src={url}
							alt=""
							loading="lazy"
							style={{
								display: "block",
								maxWidth: "100%",
								borderRadius: 14,
								margin: "8px 0",
							}}
						/>
					</a>
					{tail}
				</span>
			);
		}
		return (
			<span key={i}>
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					style={{ textDecoration: "underline" }}
				>
					{url}
				</a>
				{tail}
			</span>
		);
	});
}

function clean(value: FormDataEntryValue | null, max: number) {
	return String(value ?? "")
		.trim()
		.slice(0, max);
}

function isoOrNull(value: FormDataEntryValue | null) {
	const s = String(value ?? "").trim();
	if (!s) return null;
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isLiveAt(a: Announcement, t: number) {
	return (
		new Date(a.publish_at).getTime() <= t &&
		(!a.expires_at || new Date(a.expires_at).getTime() > t)
	);
}

function when(iso: string) {
	const diff = new Date(iso).getTime() - Date.now();
	const m = Math.floor(Math.abs(diff) / 60000);
	if (m < 1) return "just now";
	const label =
		m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
	return diff > 0 ? `in ${label}` : `${label} ago`;
}

function fmtDate(d: Date) {
	return d.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function variantFor(userId: string, id: string) {
	let h = 0;
	const s = userId + id;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h % 2 === 0 ? "a" : "b";
}

function csvCell(v: string | number) {
	const s = String(v);
	const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
	return `"${safe.replace(/"/g, '""')}"`;
}

const FALLBACK_INFO: PlanInfo = {
	plan: "starter",
	stored: "starter",
	paidUntil: null,
	paidActive: false,
};

export default async function ExperiencePage({
	params,
	searchParams,
}: {
	params: Promise<{ experienceId: string }>;
	searchParams: Promise<{ view?: string; edit?: string }>;
}) {
	const { experienceId } = await params;
	const { view: viewParam, edit } = await searchParams;
	const basePath = `/experiences/${experienceId}`;

	const listP = listAnnouncements(experienceId)
		.then((rows) => ({ rows, failed: false }))
		.catch(() => ({ rows: [] as Announcement[], failed: true }));
	const infoP = cached(`plan:${experienceId}`, 20_000, () =>
		getPlanInfo(experienceId),
	).catch(() => FALLBACK_INFO);

	// Ensure the user is logged in on whop.
	const { userId } = await whopsdk.verifyUserToken(await headers());
	const access = await cached(`access:${userId}:${experienceId}`, 60_000, () =>
		whopsdk.users.checkAccess(experienceId, { id: userId }),
	);
	const isAdmin = String((access as any).access_level) === "admin";

	const statsP = getStats(experienceId, userId).catch(
		() => ({}) as Record<string, Stats>,
	);
	const [{ rows: all, failed: loadError }, planInfo, stats] = await Promise.all([
		listP,
		infoP,
		statsP,
	]);

	const plan = planInfo.plan;
	const f = FEATURES[plan];
	const creator = isAdmin;
	const view = creator
		? ["create", "analytics", "plans"].includes(viewParam ?? "")
			? (viewParam as string)
			: "feed"
		: "feed";

	// Only the owner can switch plans for free (for testing).
	const owners = (process.env.OWNER_USER_IDS ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const canSwitchFree = isAdmin && owners.includes(userId);

	const now = Date.now();
	const visible = creator ? all : all.filter((a) => isLiveAt(a, now));
	const liveCount = all.filter((a) => isLiveAt(a, now)).length;
	const editing = creator && edit ? all.find((a) => a.id === edit) : undefined;

	const trackRows = !isAdmin
		? visible.map((a) => ({
				id: a.id,
				variant: a.alt_title ? variantFor(userId, a.id) : "a",
			}))
		: [];

	// ---------- server actions ----------

	async function markSeen() {
		"use server";
		await recordViews(userId, trackRows);
	}

	async function react(id: string, emoji: string) {
		"use server";
		if (!UUID.test(id) || !EMOJIS.includes(emoji)) return;
		await toggleReaction(id, userId, emoji);
	}

	async function ack(id: string) {
		"use server";
		if (!UUID.test(id)) return;
		await acknowledge(id, userId);
	}

	async function vote(id: string, index: number) {
		"use server";
		if (!UUID.test(id) || !Number.isInteger(index)) return;
		const a = await getAnnouncement(experienceId, id);
		if (!a?.poll || index < 0 || index >= a.poll.options.length) return;
		await castVote(id, userId, index);
	}

	async function pin(id: string, pinned: boolean): Promise<string> {
		"use server";
		if (!isAdmin || !UUID.test(id)) return "Not allowed.";
		if (pinned) {
			const list = await listAnnouncements(experienceId);
			const others = list.filter((a) => a.pinned && a.id !== id).length;
			if (others >= f.pinMax) {
				return `Your plan allows ${f.pinMax} pinned announcement${f.pinMax === 1 ? "" : "s"}.`;
			}
		}
		await setPinned(experienceId, id, pinned);
		revalidatePath(basePath);
		return "";
	}

	async function remove(id: string): Promise<string> {
		"use server";
		if (!isAdmin || !UUID.test(id)) return "Not allowed.";
		await deleteAnnouncement(experienceId, id);
		revalidatePath(basePath);
		return "";
	}

	async function publish(
		_prev: FormResult,
		formData: FormData,
	): Promise<FormResult> {
		"use server";
		if (!isAdmin) return { ok: false, message: "Only admins can post." };
		const title = clean(formData.get("title"), 120);
		const body = clean(formData.get("body"), 4000);
		if (!title || !body) {
			return { ok: false, message: "Add a headline and a message." };
		}
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
		const altTitle = f.abTest
			? clean(formData.get("alt_title"), 120) || null
			: null;

		let poll: { question: string; options: string[] } | null = null;
		if (f.poll) {
			const question = clean(formData.get("poll_q"), 140);
			const options = [1, 2, 3, 4]
				.map((n) => clean(formData.get(`poll_o${n}`), 80))
				.filter(Boolean);
			if (question && options.length >= 2) poll = { question, options };
		}

		const scheduledLater =
			!!publishAt && new Date(publishAt).getTime() > Date.now();

		await createAnnouncement({
			id,
			experience_id: experienceId,
			title,
			body,
			pinned: wantPin,
			author_id: userId,
			priority,
			require_ack: requireAck,
			publish_at: publishAt ?? undefined,
			event_at: eventAt,
			expires_at: expiresAt,
			alt_title: altTitle,
			poll,
		});
		revalidatePath(basePath);

		let message = scheduledLater ? "Scheduled." : "Posted.";
		if (f.pushSend && formData.get("push") === "on") {
			if (scheduledLater) {
				message += " Push is not sent for scheduled posts yet.";
			} else {
				const r = await notifyExperience({
					experienceId,
					title,
					content: body.replace(/\s+/g, " ").slice(0, 140),
				});
				message += r.ok
					? " Members were notified."
					: ` The push notification failed. ${r.detail}`;
			}
		}
		return { ok: true, message };
	}

	async function update(
		_prev: FormResult,
		formData: FormData,
	): Promise<FormResult> {
		"use server";
		if (!isAdmin) return { ok: false, message: "Only admins can edit." };
		const id = String(formData.get("id") ?? "");
		if (!UUID.test(id)) return { ok: false, message: "Something went wrong." };
		const title = clean(formData.get("title"), 120);
		const body = clean(formData.get("body"), 4000);
		if (!title || !body) {
			return { ok: false, message: "Add a headline and a message." };
		}
		const p = String(formData.get("priority") ?? "");
		const priority = p === "important" || p === "urgent" ? p : "normal";
		const wantPin = formData.get("pinned") === "on";
		if (wantPin) {
			const list = await listAnnouncements(experienceId);
			const others = list.filter((a) => a.pinned && a.id !== id).length;
			if (others >= f.pinMax) {
				return {
					ok: false,
					message: `Your plan allows ${f.pinMax} pinned announcement${f.pinMax === 1 ? "" : "s"}.`,
				};
			}
		}
		await updateAnnouncement(experienceId, id, {
			title,
			body,
			pinned: wantPin,
			priority,
		});
		revalidatePath(basePath);
		return { ok: true, message: "Saved." };
	}

	// Owner-only free plan switch, for testing.
	async function choosePlan(next: string) {
		"use server";
		if (!canSwitchFree) return;
		await setOwnerPlan(experienceId, asPlan(next));
		forget(`plan:${experienceId}`);
		revalidatePath(basePath);
	}

	// Step 1 of paying: ask Whop to prepare the checkout.
	async function startCheckout(target: string): Promise<CheckoutStart> {
		"use server";
		if (!isAdmin) return { ok: false, error: "Only admins can upgrade." };
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
		if (!companyId || !productId) {
			return { ok: false, error: "Billing is not set up yet." };
		}

				// A test price only ever applies to the owner, never to customers.
		const testPrice = canSwitchFree
			? Number(process.env[p === "pro" ? "PRICE_PRO" : "PRICE_BUSINESS"])
			: Number.NaN;
		const price =
			Number.isFinite(testPrice) && testPrice > 0 ? testPrice : PLAN_PRICES[p];
		if (!Number.isFinite(price) || price <= 0) {
			return { ok: false, error: "Invalid price setting." };
		}

		try {
			const cfg: any = await whopsdk.checkoutConfigurations.create({
				plan: {
					company_id: companyId,
					product_id: productId,
					currency: "usd",
					plan_type: "renewal",
					initial_price: price,
					renewal_price: price,
					billing_period: 30,
				},
				metadata: {
					app: "announcements",
					experience_id: experienceId,
					plan: p,
					user_id: userId,
				},
			} as any);
			const planId = cfg?.plan?.id ?? cfg?.plan_id;
			if (!cfg?.id || !planId) {
				return { ok: false, error: "Whop did not return a checkout." };
			}
			return { ok: true, id: String(cfg.id), planId: String(planId) };
		} catch (e) {
			const detail = e instanceof Error ? e.message.slice(0, 160) : "";
			return { ok: false, error: `Could not start checkout. ${detail}` };
		}
	}

	// Step 3 of paying: the page asks if the webhook has switched the plan yet.
	async function checkPlan(): Promise<string> {
		"use server";
		if (!isAdmin) return "";
		forget(`plan:${experienceId}`);
		const i = await getPlanInfo(experienceId);
		return i.plan;
	}

	// ---------- pieces of the page ----------

	const nav = (v: string, label: string, icon: IconName, href: string) => (
		<Link
			key={v}
			href={href}
			prefetch={false}
			className={view === v ? "on" : ""}
		>
			<Icon name={icon} size={18} />
			{label}
		</Link>
	);

	const renderPost = (a: Announcement) => {
		const s = stats[a.id];
		const scheduled = new Date(a.publish_at).getTime() > now;
		const expired = !!a.expires_at && new Date(a.expires_at).getTime() <= now;
		const shownTitle =
			!isAdmin && a.alt_title && variantFor(userId, a.id) === "b"
				? a.alt_title
				: a.title;
		return (
			<article key={a.id} className="an-card">
				<div className="an-card-top">
					<div className="an-tags">
						{a.pinned && (
							<span className="an-tag pin">
								<Icon name="pin" size={13} /> Pinned
							</span>
						)}
						{a.priority !== "normal" && (
							<span className={`an-tag ${a.priority}`}>{a.priority}</span>
						)}
						{scheduled && <span className="an-tag">Scheduled</span>}
						{expired && <span className="an-tag">Expired</span>}
						<span className="an-muted">{when(a.publish_at)}</span>
					</div>
					{creator && (
						<PostActions
							id={a.id}
							pinned={a.pinned}
							editHref={`${basePath}?view=create&edit=${a.id}`}
							onPin={pin}
							onDelete={remove}
						/>
					)}
				</div>
				<h2 className="an-title">{shownTitle}</h2>
				<p className="an-body">{renderBody(a.body)}</p>
				{a.event_at && <Countdown target={a.event_at} />}
				{a.poll && (
					<PollBlock
						id={a.id}
						poll={a.poll}
						counts={s?.vote_counts ?? {}}
						myVote={s?.my_vote ?? null}
						showResults={creator}
						onVote={vote}
					/>
				)}
				{a.require_ack &&
					(creator ? (
						<span className="an-muted">Members must confirm they read this</span>
					) : (
						<AckButton id={a.id} done={s?.my_ack ?? false} onAck={ack} />
					))}
				<div className="an-card-foot">
					<ReactionBar
						id={a.id}
						counts={s?.reaction_counts ?? {}}
						mine={s?.my_reactions ?? []}
						onReact={react}
					/>
					<div className="an-meta">
						<span>
							<Icon name="eye" size={14} />
							{(s?.view_count ?? 0).toLocaleString("en-US")}
						</span>
						{a.require_ack && <span>{s?.ack_count ?? 0} confirmed</span>}
					</div>
				</div>
			</article>
		);
	};

	const feed = (
		<>
			{loadError && (
				<p className="an-muted">Couldn't load announcements. Please try again.</p>
			)}
			{!loadError && visible.length === 0 && (
				<p className="an-muted">No announcements yet.</p>
			)}
			{visible.map(renderPost)}
		</>
	);

	let content: ReactNode;

	if (creator && view === "create") {
		content = (
			<>
				<div className="an-head">
					<h1>{editing ? "Edit announcement" : "Create announcement"}</h1>
					<p className="an-muted">Templates and delivery options</p>
				</div>
				<CreateForm
					key={editing ? editing.id : "new"}
					action={editing ? update : publish}
					plan={plan}
					mode={editing ? "edit" : "create"}
					id={editing ? editing.id : ""}
					liveCount={liveCount}
					initial={
						editing
							? {
									title: editing.title,
									body: editing.body,
									pinned: editing.pinned,
									priority: editing.priority,
								}
							: undefined
					}
					cancelHref={basePath}
				/>
			</>
		);
	} else if (creator && view === "analytics") {
		const rows = all.map((a) => ({ a, s: stats[a.id] }));
		const totalViews = rows.reduce((n, r) => n + (r.s?.view_count ?? 0), 0);
		const totalReactions = rows.reduce(
			(n, r) =>
				n +
				Object.values(r.s?.reaction_counts ?? {}).reduce((x, y) => x + y, 0),
			0,
		);
		const ackRows = rows.filter((r) => r.a.require_ack);
		const ackViews = ackRows.reduce((n, r) => n + (r.s?.view_count ?? 0), 0);
		const ackDone = ackRows.reduce((n, r) => n + (r.s?.ack_count ?? 0), 0);
		const rate = ackViews > 0 ? `${Math.round((ackDone / ackViews) * 100)}%` : "-";
		const maxViews = Math.max(1, ...rows.map((r) => r.s?.view_count ?? 0));
		const csv = [
			["title", "published", "views", "reactions", "confirmed", "views_a", "views_b"]
				.map(csvCell)
				.join(","),
			...rows.map((r) =>
				[
					r.a.title,
					r.a.publish_at,
					r.s?.view_count ?? 0,
					Object.values(r.s?.reaction_counts ?? {}).reduce((x, y) => x + y, 0),
					r.s?.ack_count ?? 0,
					r.s?.views_a ?? 0,
					r.s?.views_b ?? 0,
				]
					.map(csvCell)
					.join(","),
			),
		].join("\n");

		const list = (
			<div className="an-card">
				<h2 className="an-title">Views per announcement</h2>
				{rows.length === 0 && <p className="an-muted">Nothing to show yet.</p>}
				{rows.map((r) => (
					<div key={r.a.id} className="an-bar-row">
						<div className="an-bar-top">
							<span>{r.a.title}</span>
							<span className="an-muted">
								{r.s?.view_count ?? 0}
								{r.a.alt_title
									? ` (A ${r.s?.views_a ?? 0} · B ${r.s?.views_b ?? 0})`
									: ""}
							</span>
						</div>
						<div className="an-bar">
							<i style={{ width: `${((r.s?.view_count ?? 0) / maxViews) * 100}%` }} />
						</div>
					</div>
				))}
			</div>
		);

		content = (
			<>
				<div className="an-row">
					<div className="an-head">
						<h1>Analytics</h1>
						<p className="an-muted">See what your members actually read</p>
					</div>
					{f.csvExport ? (
						<ExportButton csv={csv} filename="announcements.csv" />
					) : (
						<span className="an-badge">
							<Icon name="lock" size={11} /> Export CSV · Business
						</span>
					)}
				</div>
				<div className="an-stats">
					<div className="an-card an-stat">
						<span className="ico">
							<Icon name="eye" size={18} />
						</span>
						<b>
							<CountUp value={totalViews} />
						</b>
						<span className="an-muted">Total views</span>
					</div>
					<div className="an-card an-stat">
						<span className="ico">
							<Icon name="users" size={18} />
						</span>
						<b>
							<CountUp value={totalReactions} />
						</b>
						<span className="an-muted">Reactions</span>
					</div>
					<div className="an-card an-stat">
						<span className="ico">
							<Icon name="chart" size={18} />
						</span>
						<b>{rate}</b>
						<span className="an-muted">Read-confirm rate</span>
					</div>
				</div>
				{f.fullAnalytics ? (
					list
				) : (
					<div className="an-lockwrap">
						<div className="blur">{list}</div>
						<div className="an-lockover">
							<Icon name="lock" size={22} />
							<span>Detailed analytics are on Pro</span>
							<Link
								href={`${basePath}?view=plans`}
								prefetch={false}
								className="an-btn"
							>
								See plans
							</Link>
						</div>
					</div>
				)}
			</>
		);
	} else if (creator && view === "plans") {
			const billingReady =
			   !!process.env.WHOP_PAYOUT_COMPANY_ID && !!process.env.WHOP_PRODUCT_ID;
		const paidEnd =
			planInfo.paidActive && planInfo.paidUntil
				? new Date(
						new Date(planInfo.paidUntil).getTime() - GRACE_DAYS * 86400000,
					)
				: null;

		content = (
			<>
				<div className="an-head">
					<h1>Plans</h1>
					<p className="an-muted">Start free. Upgrade when your community grows.</p>
				</div>
				<div className="an-plans">
					{PLAN_CARDS.map((c) => (
						<div
							key={c.plan}
							className={`an-card an-plan${c.plan === "pro" ? " pop" : ""}`}
						>
							{c.plan === "pro" && <span className="an-pop-badge">Most popular</span>}
							<h2 className="an-title">{PLAN_NAMES[c.plan]}</h2>
							<p className="an-muted">{c.blurb}</p>
							<div className="an-price">
								${PLAN_PRICES[c.plan]} <small>/month</small>
							</div>
							<ul>
								{c.items.map((text) => (
									<li key={text}>{text}</li>
								))}
							</ul>
							{plan === c.plan ? (
								<button type="button" className="an-btn-ghost" disabled>
									Current plan
								</button>
							) : c.plan === "starter" ? (
								<button type="button" className="an-btn-ghost" disabled>
									{planInfo.paidActive ? "Applies when your plan ends" : "Free plan"}
								</button>
							) : planInfo.paidActive ? (
								<button type="button" className="an-btn-ghost" disabled>
									Cancel your current plan first
								</button>
							) : !billingReady ? (
								<button type="button" className="an-btn-ghost" disabled>
									Billing is being set up
								</button>
							) : (
								<UpgradeButton
									plan={c.plan}
									label={`Upgrade to ${PLAN_NAMES[c.plan]}`}
									primary={c.plan === "pro"}
									startCheckout={startCheckout}
									checkPlan={checkPlan}
								/>
							)}
						</div>
					))}
				</div>

				{paidEnd ? (
					<p className="an-muted">
						Your {PLAN_NAMES[plan]} plan is active, paid through {fmtDate(paidEnd)}.
						To cancel or change plans, manage your subscription in your Whop
						account. You keep your plan until the paid period ends.
					</p>
				) : (
					<p className="an-muted">
						Payments are handled securely by Whop checkout. Your plan switches on
						as soon as the payment goes through.
					</p>
				)}

				{canSwitchFree && (
					<div className="an-card">
						<h2 className="an-title">Owner tools</h2>
						<p className="an-muted">
							Free plan switch for testing. Customers never see this. Your Whop
							user ID: {userId}
						</p>
						<div className="an-row">
							{(["starter", "pro", "business"] as Plan[]).map((p) => (
								<PlanButton
									key={p}
									plan={p}
									current={planInfo.stored === p && !planInfo.paidActive}
									label={`Set ${PLAN_NAMES[p]}`}
									onChoose={choosePlan}
								/>
							))}
						</div>
					</div>
				)}
			</>
		);
	} else {
		content = (
			<>
				<div className="an-head">
					<h1>Announcements</h1>
					<p className="an-muted">
						{creator
							? "What your members see, plus scheduled posts"
							: "Latest from the team"}
					</p>
				</div>
				{feed}
			</>
		);
	}

	return (
		<Shell>
			{!isAdmin && trackRows.length > 0 && (
				<ViewTracker
					key={trackRows.map((r) => r.id).join(",")}
					action={markSeen}
				/>
			)}
			<div className="an-shell">
				<aside className="an-side">
					<div className="an-brand">
						<span className="an-logo">
							<Icon name="megaphone" size={20} />
						</span>
						<div>
							<div className="an-brand-name">Announcements</div>
							{creator && <div className="an-muted">{PLAN_NAMES[plan]} plan</div>}
						</div>
					</div>
					<nav className="an-nav">
						{nav("feed", "Announcements", "megaphone", basePath)}
						{creator &&
							nav("create", "Create", "edit", `${basePath}?view=create`)}
						{creator &&
							nav("analytics", "Analytics", "chart", `${basePath}?view=analytics`)}
						{creator && nav("plans", "Plans", "crown", `${basePath}?view=plans`)}
					</nav>
					{creator && plan !== "business" && (
						<Link
							href={`${basePath}?view=plans`}
							prefetch={false}
							className="an-upgrade"
						>
							Upgrade to {plan === "starter" ? "Pro" : "Business"}
							<small>
								{plan === "starter"
									? "Scheduling, polls, read receipts"
									: "A/B tests, push, CSV export"}
							</small>
						</Link>
					)}
					<div className="an-spacer" />
					<ThemeToggle />
				</aside>
				<main className="an-main">{content}</main>
			</div>
		</Shell>
	);
}