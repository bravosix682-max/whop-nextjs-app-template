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

async function call(path: string, init: RequestInit = {}) {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SECRET_KEY;
	const res = await fetch(`${url}/rest/v1/${path}`, {
		...init,
		cache: "no-store",
		headers: { apikey: key, "Content-Type": "application/json", ...(init.headers ?? {}) },
	});
	if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
	return (await res.json()) ?? [];
}

const blank = () => ({ views: 0, reactions: 0, comments: 0, acks: 0, clicks: 0, sent: 0, failed: 0, products: 0 });

export async function loadAnalytics(experienceId: string, posts: any[], days: number, channelRows: any[]) {
	const since = new Date(Date.now() - days * 86400000).toISOString();
	const [daily, byPost, logs] = await Promise.all([
		call("rpc/an_events", { method: "POST", body: JSON.stringify({ exp: experienceId, since, by_post: false }) }),
		call("rpc/an_events", { method: "POST", body: JSON.stringify({ exp: experienceId, since, by_post: true }) }),
		call(
			`delivery_log?experience_id=eq.${enc(experienceId)}&created_at=gte.${enc(since)}&select=announcement_id,channel,ok,detail,created_at&order=created_at.desc&limit=400`,
		),
	]);

	const norm = (c: string) => (c === "app" ? "whop" : KINDS.includes(c) ? c : "whop");
	const dayList: string[] = [];
	for (let i = days - 1; i >= 0; i--) dayList.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));

	const perDay: Record<string, any> = {};
	for (const d of dayList) perDay[d] = {};
	const totals: Record<string, any> = {};
	for (const k of KINDS) totals[k] = blank();
	for (const r of daily) {
		const c = norm(r.ch);
		const d = String(r.day);
		perDay[d] = perDay[d] ?? {};
		perDay[d][c] = perDay[d][c] ?? blank();
		if (r.metric in perDay[d][c]) perDay[d][c][r.metric] += Number(r.n);
		if (r.metric in totals[c]) totals[c][r.metric] += Number(r.n);
	}

	const perPost: Record<string, any> = {};
	for (const r of byPost) {
		const id = String(r.post_id);
		perPost[id] = perPost[id] ?? {};
		const c = norm(r.ch);
		perPost[id][c] = perPost[id][c] ?? blank();
		if (r.metric in perPost[id][c]) perPost[id][c][r.metric] += Number(r.n);
	}

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

	return { since, dayList, perDay, totals, perPost, logs, emailRecipients, pending };
}