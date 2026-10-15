// @ts-nocheck
const enc = encodeURIComponent;

export const KINDS = ["whop", "discord", "telegram", "push", "email", "chat", "forum"];
export const KIND_LABEL = {
	whop: "Whop (in-app)", discord: "Discord", telegram: "Telegram", push: "Push",
	email: "Email", chat: "Whop chat", forum: "Whop forum",
};
export const KIND_COLOR = {
	whop: "#ff5a1f", discord: "#5865f2", telegram: "#26a5e4", push: "#f5a524",
	email: "#8b7cf6", chat: "#3ecf8e", forum: "#ec4899",
};

async function call(path: string) {
	const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
		cache: "no-store",
		headers: { apikey: process.env.SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
	});
	if (!res.ok) throw new Error(String(res.status));
	return (await res.json()) ?? [];
}

const blank = () => ({ views: 0, reactions: 0, comments: 0, acks: 0, clicks: 0, sent: 0, failed: 0, products: 0 });

function kindOfLabel(label: string) {
	const l = String(label).toLowerCase();
	if (l.startsWith("discord")) return "discord";
	if (l.startsWith("telegram")) return "telegram";
	if (l.startsWith("whop chat")) return "chat";
	if (l.startsWith("whop forum")) return "forum";
	if (l.startsWith("email")) return "email";
	return "push";
}

export async function loadAnalytics(experienceId: string, posts: any[], days: number, channelRows: any[]) {
	const since = new Date(Date.now() - days * 86400000).toISOString();
	const s = enc(since);
	const warnings: string[] = [];
	const ids = posts.map((p) => p.id).slice(0, 60);
	const inList = ids.length ? `announcement_id=in.(${ids.join(",")})` : "";

	const safe = async (label: string, path: string) => {
		if (!inList && label !== "deliveries") return [];
		try {
			return await call(path);
		} catch {
			warnings.push(label);
			return [];
		}
	};

	const [views, reactions, comments, acks, clicks, logs] = await Promise.all([
		safe("views", `announcement_views?${inList}&viewed_at=gte.${s}&select=announcement_id,viewed_at&limit=5000`),
		safe("reactions", `announcement_reactions?${inList}&created_at=gte.${s}&select=announcement_id,created_at&limit=5000`),
		safe("comments", `announcement_comments?${inList}&created_at=gte.${s}&select=announcement_id,created_at&limit=5000`),
		safe("confirmations", `announcement_acks?${inList}&acked_at=gte.${s}&select=announcement_id,acked_at&limit=5000`),
		safe("click tracking", `click_events?${inList}&created_at=gte.${s}&select=announcement_id,kind,created_at&limit=5000`),
		safe("deliveries", `delivery_log?experience_id=eq.${enc(experienceId)}&created_at=gte.${s}&select=announcement_id,channel,ok,detail,created_at&order=created_at.desc&limit=400`),
	]);

	const dayList: string[] = [];
	for (let i = days - 1; i >= 0; i--) dayList.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));

	const perDay: Record<string, any> = {};
	const perPost: Record<string, any> = {};
	const totals: Record<string, any> = {};
	for (const k of KINDS) totals[k] = blank();
	for (const d of dayList) perDay[d] = {};

	const bump = (iso: string, c: string, m: string, pid?: string) => {
		const k = KINDS.includes(c) ? c : "whop";
		const d = String(iso).slice(0, 10);
		perDay[d] = perDay[d] ?? {};
		perDay[d][k] = perDay[d][k] ?? blank();
		perDay[d][k][m] += 1;
		totals[k][m] += 1;
		if (pid) {
			perPost[pid] = perPost[pid] ?? {};
			perPost[pid][k] = perPost[pid][k] ?? blank();
			perPost[pid][k][m] += 1;
		}
	};

	for (const r of views) bump(r.viewed_at, "whop", "views", r.announcement_id);
	for (const r of reactions) bump(r.created_at, "whop", "reactions", r.announcement_id);
	for (const r of comments) bump(r.created_at, "whop", "comments", r.announcement_id);
	for (const r of acks) bump(r.acked_at, "whop", "acks", r.announcement_id);
	for (const r of clicks) bump(r.created_at, r.kind === "app" ? "whop" : r.kind, "clicks", r.announcement_id);
	for (const l of logs) bump(l.created_at, kindOfLabel(l.channel), l.ok ? "sent" : "failed", l.announcement_id ?? undefined);

	let emailRecipients = 0;
	for (const l of logs) {
		if (l.ok && /^email/i.test(l.channel)) {
			const m = String(l.detail ?? "").match(/(\d+) member/);
			if (m) emailRecipients += Number(m[1]);
		}
	}

	const kindById: Record<string, string> = {};
	for (const c of channelRows) kindById[c.id] = c.kind;
	const pending: Record<string, number> = {};
	for (const p of posts) {
		const d: any = p.deliver;
		if (!d || p.delivered_at) continue;
		const add = (k: string) => (pending[k] = (pending[k] ?? 0) + 1);
		if (d.push) add("push");
		if (d.email) add("email");
		if (d.chat) add("chat");
		if (d.forum) add("forum");
		for (const id of d.channelIds ?? []) if (kindById[id]) add(kindById[id]);
	}

	return { since, dayList, perDay, totals, perPost, logs, emailRecipients, pending, warnings };
}