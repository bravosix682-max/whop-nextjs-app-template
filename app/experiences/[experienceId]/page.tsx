// @ts-nocheck
import { headers } from "next/headers";
import Link from "next/link";
import { cached } from "@/lib/cache";
import {
	DEFAULT_PREFS,
	getPrefs,
	isBannedRow,
	listChannels,
	listComments,
	listLog,
} from "@/lib/delivery-db";
import { emailReady } from "@/lib/deliver";
import { FEATURES, PLAN_NAMES, PLAN_PRICES } from "@/lib/plans";
import { GRACE_DAYS, getPlanInfo, getStats, listAnnouncements } from "@/lib/supabase";
import { hasProductAccess } from "@/lib/whop-data";
import { whopsdk } from "@/lib/whop-sdk";
import "./announcements.css";
import * as act from "./actions";
import * as act2 from "./actions2";
import { BansPanel } from "./bans";
import { Reactions } from "./reactions";
import { UpgradeButton } from "./billing-ui";
import { Comments } from "./comments";
import { CreateForm } from "./create-form";
import { CountUp, PostActions } from "./extras";
import { Icon } from "./icons";
import {
	AckButton,
	Countdown,
	ExportButton,
	PlanButton,
	PollBlock,
	ReactionBar,
} from "./interactive";
import { AnalyticsView } from "./analytics-view";
import { AttachmentList, ProductCards, RichText } from "./render";
import {
	AppearanceCard,
	BansCard,
	ChannelsCard,
	CrossPostCard,
	LogCard,
	NotificationsCard,
	SpamCard,
} from "./settings";
import { Shell } from "./shell";
import { ViewTracker } from "./view-tracker";

const PLAN_CARDS = (withEmail: boolean) => [
	{
		plan: "starter",
		blurb: "For new communities getting started",
		items: [
			"5 live announcements",
			"Rich text editor, emoji and YouTube previews",
			"2 attachments per post (10 MB)",
			"Comments with read-only mode",
			"Push to all members",
			"1 Discord and 1 Telegram channel",
			"Pin 1 announcement",
			"Basic view count",
		],
	},
	{
		plan: "pro",
		blurb: "For creators who need members to actually read",
		items: [
			"Everything in Starter",
			"Unlimited announcements",
			"Schedule and auto-remove",
			"Polls and event countdowns",
			"Must-acknowledge posts with read receipts",
			"Target specific products",
			"Post to Whop chat and public forum",
			"Spam protection",
			"3 channels each, 6 attachments (25 MB)",
			"Full engagement analytics",
		],
	},
	{
		plan: "business",
		blurb: "For brands running serious communities",
		items: [
			"Everything in Pro",
			withEmail ? "Email to members" : "Email to members (when enabled)",
			"User ban list",
			"@ mention members",
			"A/B test two headlines",
			"Export analytics to CSV",
			"10 channels each, 10 attachments (50 MB)",
		],
	},
];

function isLiveAt(a: any, t: number) {
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
	return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function variantFor(userId: string, id: string) {
	let h = 0;
	const s = userId + id;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h % 2 === 0 ? "a" : "b";
}

function csvCell(v: any) {
	const s = String(v);
	const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
	return `"${safe.replace(/"/g, '""')}"`;
}

const FALLBACK_INFO = { plan: "starter", stored: "starter", paidUntil: null, paidActive: false };

export default async function ExperiencePage({ params, searchParams }: any) {
	const { experienceId } = await params;
	const { view: viewParam, edit } = await searchParams;
	const basePath = `/experiences/${experienceId}`;

	const listP = listAnnouncements(experienceId)
		.then((rows) => ({ rows, failed: false }))
		.catch(() => ({ rows: [], failed: true }));
	const infoP = cached(`plan:${experienceId}`, 3_000, () => getPlanInfo(experienceId)).catch(
		() => FALLBACK_INFO,
	);

	// Ensure the user is logged in on whop.
	const { userId } = await whopsdk.verifyUserToken(await headers());
	const access: any = await cached(`access:${userId}:${experienceId}`, 60_000, () =>
		whopsdk.users.checkAccess(experienceId, { id: userId }),
	);
	const isAdmin = String(access?.access_level) === "admin";

	const statsP = getStats(experienceId, userId).catch(() => ({}));
	const commentsP = listComments(experienceId).catch(() => []);
	const prefsP = getPrefs(experienceId).catch(() => DEFAULT_PREFS);
	const banP = isAdmin
		? Promise.resolve(false)
		: cached(`ban:${experienceId}:${userId}`, 15_000, () =>
				isBannedRow(experienceId, userId),
			).catch(() => false);

	const [{ rows: all, failed: loadError }, planInfo, stats, comments, prefs, restricted] =
		await Promise.all([listP, infoP, statsP, commentsP, prefsP, banP]);

	const plan = planInfo.plan;
	const f = FEATURES[plan];
	const creator = isAdmin;
	const emailOn = emailReady();
	const allowed = creator ? ["create", "analytics", "plans", "settings"] : ["settings"];
	const view = allowed.includes(viewParam ?? "") ? viewParam : "feed";

	const owners = (process.env.OWNER_USER_IDS ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const canSwitchFree = isAdmin && owners.includes(userId);

	const needChannels = creator && (view === "create" || view === "settings");
	const channelRows = needChannels ? await listChannels(experienceId).catch(() => []) : [];
	const channels = channelRows.map((r: any) => ({
		id: r.id,
		kind: r.kind,
		name: r.name,
		target: r.target,
		hint: String(r.secret).slice(-4),
	}));
	const logRows =
		creator && view === "settings" ? await listLog(experienceId, 40).catch(() => []) : [];

	const now = Date.now();
	let visible = creator ? all : all.filter((a: any) => isLiveAt(a, now));
	if (!creator) {
		const ok = await Promise.all(
			visible.map(async (a: any) => {
				const t = Array.isArray(a.target_products) ? a.target_products : [];
				if (t.length === 0) return true;
				const checks = await Promise.all(t.map((p: string) => hasProductAccess(userId, p)));
				return checks.some(Boolean);
			}),
		);
		visible = visible.filter((_: any, i: number) => ok[i]);
	}
	const liveCount = all.filter((a: any) => isLiveAt(a, now)).length;
	const editing = creator && edit ? all.find((a: any) => a.id === edit) : undefined;

	const trackRows = !isAdmin
		? visible.map((a: any) => ({
				id: a.id,
				variant: a.alt_title ? variantFor(userId, a.id) : "a",
			}))
		: [];

	const B = (fn: any) => fn.bind(null, experienceId);

	const nav = (v: string, label: string, icon: string, href: string) => (
		<Link key={v} href={href} prefetch={false} className={view === v ? "on" : ""}>
			<Icon name={icon} size={18} />
			{label}
		</Link>
	);

	const renderPost = (a: any) => {
		const s: any = stats[a.id];
		const scheduled = new Date(a.publish_at).getTime() > now;
		const expired = !!a.expires_at && new Date(a.expires_at).getTime() <= now;
		const targeted = Array.isArray(a.target_products) && a.target_products.length > 0;
		const shownTitle =
			!isAdmin && a.alt_title && variantFor(userId, a.id) === "b" ? a.alt_title : a.title;
		return (
			<article key={a.id} className="an-card">
				<div className="an-card-top">
					<div className="an-tags">
						{a.pinned && (
							<span className="an-tag pin">
								<Icon name="pin" size={13} /> Pinned
							</span>
						)}
						{a.priority !== "normal" && <span className={`an-tag ${a.priority}`}>{a.priority}</span>}
						{creator && targeted && <span className="an-tag target">Targeted</span>}
						{scheduled && <span className="an-tag">Scheduled</span>}
						{expired && <span className="an-tag">Expired</span>}
						<span className="an-muted">{when(a.publish_at)}</span>
					</div>
					{creator && (
						<PostActions
							id={a.id}
							pinned={a.pinned}
							editHref={`${basePath}?view=create&edit=${a.id}`}
							onPin={B(act.pin)}
							onDelete={B(act.remove)}
						/>
					)}
				</div>
				<h2 className="an-title">{shownTitle}</h2>
				<RichText text={a.body} postId={a.id} />
				<AttachmentList items={a.attachments ?? []} />
				<ProductCards items={a.target_products} postId={a.id} />
				{a.event_at && <Countdown target={a.event_at} />}
				{a.poll && (
					<PollBlock
						id={a.id}
						poll={a.poll}
						counts={s?.vote_counts ?? {}}
						myVote={s?.my_vote ?? null}
						showResults={creator}
						onVote={B(act.vote)}
					/>
				)}
				{a.require_ack &&
					(creator ? (
						<span className="an-muted">Members must confirm they read this</span>
					) : (
						<AckButton id={a.id} done={s?.my_ack ?? false} onAck={B(act.ack)} />
					))}
				<div className="an-card-foot">
					<Reactions
						id={a.id}
						counts={s?.reaction_counts ?? {}}
						mine={s?.my_reactions ?? []}
						onReact={B(act2.react)}
					/>
					<div className="an-meta">
						<span>
							<Icon name="eye" size={14} />
							{(s?.view_count ?? 0).toLocaleString("en-US")}
						</span>
						{a.require_ack && <span>{s?.ack_count ?? 0} confirmed</span>}
					</div>
				</div>
				<Comments
					postId={a.id}
					enabled={a.comments_enabled !== false}
					initial={comments.filter((cm: any) => cm.announcement_id === a.id)}
					isAdmin={isAdmin}
					meId={userId}
					restricted={restricted}
					onAdd={B(act.addComment)}
					onDelete={B(act.deleteComment)}
				/>
			</article>
		);
	};

	const feed = (
		<>
			{restricted && (
				<p className="an-notice bad">
					You have been restricted in this community. You can read announcements but can't react, vote or
					comment.
				</p>
			)}
			{loadError && <p className="an-muted">Couldn't load announcements. Please try again.</p>}
			{!loadError && visible.length === 0 && <p className="an-muted">No announcements yet.</p>}
			{visible.map(renderPost)}
		</>
	);

	let content: any;

	if (creator && view === "create") {
		content = (
			<>
				<div className="an-head">
					<h1>{editing ? "Edit announcement" : "Create announcement"}</h1>
					<p className="an-muted">Templates and delivery options</p>
				</div>
				<CreateForm
					key={editing ? editing.id : "new"}
					action={editing ? B(act.update) : B(act.publish)}
					plan={plan}
					mode={editing ? "edit" : "create"}
					id={editing ? editing.id : ""}
					liveCount={liveCount}
					channels={channels}
					emailReady={emailOn}
					chatReady={!!prefs.chat_experience_id}
					settingsHref={`${basePath}?view=settings`}
					prepareUpload={B(act.prepareUpload)}
					fetchProducts={B(act.fetchProducts)}
					fetchMentionMembers={B(act2.fetchMentionMembers)}
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
		content = <AnalyticsView experienceId={experienceId} posts={all} plan={plan} stats={stats} searchParams={searchParams} />;
	} else if (creator && view === "analytics-old") {
		const rows = all.map((a: any) => ({ a, s: stats[a.id] as any }));
		const totalViews = rows.reduce((n: number, r: any) => n + (r.s?.view_count ?? 0), 0);
		const totalReactions = rows.reduce(
			(n: number, r: any) =>
				n + Object.values(r.s?.reaction_counts ?? {}).reduce((x: number, y: any) => x + y, 0),
			0,
		);
		const ackRows = rows.filter((r: any) => r.a.require_ack);
		const ackViews = ackRows.reduce((n: number, r: any) => n + (r.s?.view_count ?? 0), 0);
		const ackDone = ackRows.reduce((n: number, r: any) => n + (r.s?.ack_count ?? 0), 0);
		const rate = ackViews > 0 ? `${Math.round((ackDone / ackViews) * 100)}%` : "-";
		const maxViews = Math.max(1, ...rows.map((r: any) => r.s?.view_count ?? 0));
		const csv = [
			["title", "published", "views", "reactions", "confirmed", "views_a", "views_b"]
				.map(csvCell)
				.join(","),
			...rows.map((r: any) =>
				[
					r.a.title,
					r.a.publish_at,
					r.s?.view_count ?? 0,
					Object.values(r.s?.reaction_counts ?? {}).reduce((x: number, y: any) => x + y, 0),
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
				{rows.map((r: any) => (
					<div key={r.a.id} className="an-bar-row">
						<div className="an-bar-top">
							<span>{r.a.title}</span>
							<span className="an-muted">
								{r.s?.view_count ?? 0}
								{r.a.alt_title ? ` (A ${r.s?.views_a ?? 0} · B ${r.s?.views_b ?? 0})` : ""}
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
							<Link href={`${basePath}?view=plans`} prefetch={false} className="an-btn">
								See plans
							</Link>
						</div>
					</div>
				)}
			</>
		);
	} else if (creator && view === "plans") {
		const billingReady = !!process.env.WHOP_PAYOUT_COMPANY_ID && !!process.env.WHOP_PRODUCT_ID;
		const paidEnd =
			planInfo.paidActive && planInfo.paidUntil
				? new Date(new Date(planInfo.paidUntil).getTime() - GRACE_DAYS * 86400000)
				: null;

		content = (
			<>
				<div className="an-head">
					<h1>Plans</h1>
					<p className="an-muted">Start free. Upgrade when your community grows.</p>
				</div>
				<div className="an-plans">
					{PLAN_CARDS(emailOn).map((c: any) => (
						<div key={c.plan} className={`an-card an-plan${c.plan === "pro" ? " pop" : ""}`}>
							{c.plan === "pro" && <span className="an-pop-badge">Most popular</span>}
							<h2 className="an-title">{PLAN_NAMES[c.plan]}</h2>
							<p className="an-muted">{c.blurb}</p>
							<div className="an-price">
								${PLAN_PRICES[c.plan]} <small>/month</small>
							</div>
							<ul>
								{c.items.map((text: string) => (
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
									startCheckout={B(act.startCheckout)}
									checkPlan={B(act.checkPlan)}
								/>
							)}
						</div>
					))}
				</div>

				{paidEnd ? (
					<p className="an-muted">
						Your {PLAN_NAMES[plan]} plan is active, paid through {fmtDate(paidEnd)}. To cancel or change
						plans, manage your subscription in your Whop account. You keep your plan until the paid period
						ends.
					</p>
				) : (
					<p className="an-muted">
						Payments are handled securely by Whop checkout. Your plan switches on as soon as the payment goes
						through.
					</p>
				)}

				{canSwitchFree && (
					<div className="an-card">
						<h2 className="an-title">Owner tools</h2>
						<p className="an-muted">
							Free plan switch for testing. Customers never see this. Your Whop user ID: {userId}
						</p>
						<div className="an-row">
							{["starter", "pro", "business"].map((p) => (
								<PlanButton
									key={p}
									plan={p}
									current={planInfo.stored === p && !planInfo.paidActive}
									label={`Set ${PLAN_NAMES[p]}`}
									onChoose={B(act.choosePlan)}
								/>
							))}
						</div>
					</div>
				)}
			</>
		);
	} else if (view === "settings") {
		const plansHref = `${basePath}?view=plans`;
		content = (
			<>
				<div className="an-head">
					<h1>Settings</h1>
					<p className="an-muted">
						{creator ? "Appearance, notifications and integrations" : "Appearance"}
					</p>
				</div>
				<AppearanceCard />
				{creator && (
					<>
						<NotificationsCard
							initial={{
								push_enabled: prefs.push_enabled,
								notify_reactions: prefs.notify_reactions,
								notify_comments: prefs.notify_comments,
							}}
							save={B(act.savePreferences)}
						/>
						<ChannelsCard
							kind="discord"
							channels={channels.filter((c: any) => c.kind === "discord")}
							max={f.channelsMax}
							add={B(act.addChannelAction)}
							remove={B(act.removeChannelAction)}
							test={B(act.testChannelAction)}
						/>
						<ChannelsCard
							kind="telegram"
							channels={channels.filter((c: any) => c.kind === "telegram")}
							max={f.channelsMax}
							add={B(act.addChannelAction)}
							remove={B(act.removeChannelAction)}
							test={B(act.testChannelAction)}
						/>
						<CrossPostCard
							locked={!f.whopChat}
							chatId={prefs.chat_experience_id ?? ""}
							save={B(act.saveChatTarget)}
							upgradeHref={plansHref}
						/>
						<SpamCard
							locked={!f.spam}
							enabled={prefs.spam_protection}
							save={B(act.savePreferences)}
							upgradeHref={plansHref}
						/>
						<BansPanel
							locked={!f.banList}
							load={B(act2.fetchMembers)}
							ban={B(act.banAction)}
							unban={B(act.unbanAction)}
							upgradeHref={plansHref}
						/>
						<LogCard rows={logRows} posts={all.map((p: any) => ({ id: p.id, title: p.title, body: p.body }))} />
					</>
				)}
			</>
		);
	} else {
		content = (
			<>
				<div className="an-head">
					<h1>Announcements</h1>
					<p className="an-muted">
						{creator ? "What your members see, plus scheduled posts" : "Latest from the team"}
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
					key={trackRows.map((r: any) => r.id).join(",")}
					action={act.markSeen.bind(null, experienceId, trackRows)}
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
						{creator && nav("create", "Create", "edit", `${basePath}?view=create`)}
						{creator && nav("analytics", "Analytics", "chart", `${basePath}?view=analytics`)}
						{creator && nav("plans", "Plans", "crown", `${basePath}?view=plans`)}
						{nav("settings", "Settings", "settings", `${basePath}?view=settings`)}
					</nav>
					{creator && plan !== "business" && (
						<Link href={`${basePath}?view=plans`} prefetch={false} className="an-upgrade">
							Upgrade to {plan === "starter" ? "Pro" : "Business"}
							<small>
								{plan === "starter"
									? "Scheduling, targeting, spam protection"
									: "Email, ban list, A/B tests, CSV export"}
							</small>
						</Link>
					)}
					<div className="an-spacer" />
				</aside>
				<main className="an-main">{content}</main>
			</div>
		</Shell>
	);
}