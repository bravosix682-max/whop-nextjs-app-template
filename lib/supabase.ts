import { asPlan, type Plan } from "./plans";

export type Priority = "normal" | "important" | "urgent";

export type Poll = { question: string; options: string[] };

export type Announcement = {
	id: string;
	experience_id: string;
	title: string;
	body: string;
	pinned: boolean;
	author_id: string | null;
	created_at: string;
	priority: Priority;
	require_ack: boolean;
	publish_at: string;
	event_at: string | null;
	expires_at: string | null;
	alt_title: string | null;
	poll: Poll | null;
};

export type NewAnnouncement = {
	id: string;
	experience_id: string;
	title: string;
	body: string;
	pinned: boolean;
	author_id: string | null;
	priority: Priority;
	require_ack: boolean;
	publish_at?: string;
	event_at: string | null;
	expires_at: string | null;
	alt_title: string | null;
	poll: Poll | null;
};

export type Stats = {
	aid: string;
	view_count: number;
	views_a: number;
	views_b: number;
	ack_count: number;
	my_ack: boolean;
	reaction_counts: Record<string, number>;
	my_reactions: string[];
	vote_counts: Record<string, number>;
	my_vote: number | null;
};

const enc = encodeURIComponent;

function config() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SECRET_KEY;
	if (!url || !key) throw new Error("Supabase is not configured");
	return { url, key };
}

async function request(path: string, init: RequestInit = {}) {
	const { url, key } = config();
	const res = await fetch(`${url}/rest/v1/${path}`, {
		...init,
		cache: "no-store",
		headers: {
			apikey: key,
			"Content-Type": "application/json",
			...(init.headers as Record<string, string> | undefined),
		},
	});
	if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
	const text = await res.text();
	return text ? JSON.parse(text) : null;
}

export async function getPlan(experienceId: string): Promise<Plan> {
	const rows = (await request(
		`app_settings?experience_id=eq.${enc(experienceId)}&select=plan&limit=1`,
	)) as { plan: string }[] | null;
	return asPlan(rows?.[0]?.plan);
}

export async function setPlan(experienceId: string, plan: Plan) {
	await request("app_settings?on_conflict=experience_id", {
		method: "POST",
		headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
		body: JSON.stringify({
			experience_id: experienceId,
			plan,
			updated_at: new Date().toISOString(),
		}),
	});
}

export async function listAnnouncements(
	experienceId: string,
): Promise<Announcement[]> {
	const query = `announcements?experience_id=eq.${enc(experienceId)}&select=*&order=pinned.desc,publish_at.desc&limit=100`;
	return (await request(query)) ?? [];
}

export async function getAnnouncement(
	experienceId: string,
	id: string,
): Promise<Announcement | null> {
	const rows = (await request(
		`announcements?id=eq.${enc(id)}&experience_id=eq.${enc(experienceId)}&select=*&limit=1`,
	)) as Announcement[] | null;
	return rows?.[0] ?? null;
}

export async function getStats(
	experienceId: string,
	userId: string,
): Promise<Record<string, Stats>> {
	const rows = (await request("rpc/announcement_feed_stats", {
		method: "POST",
		body: JSON.stringify({ exp: experienceId, uid: userId }),
	})) as Stats[] | null;
	const out: Record<string, Stats> = {};
	for (const r of rows ?? []) {
		out[r.aid] = {
			...r,
			view_count: Number(r.view_count),
			views_a: Number(r.views_a),
			views_b: Number(r.views_b),
			ack_count: Number(r.ack_count),
		};
	}
	return out;
}

export async function createAnnouncement(row: NewAnnouncement) {
	// If the same id arrives twice (double click), the second one is ignored.
	await request("announcements?on_conflict=id", {
		method: "POST",
		headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
		body: JSON.stringify(row),
	});
}

export async function updateAnnouncement(
	experienceId: string,
	id: string,
	fields: { title: string; body: string; pinned: boolean; priority: Priority },
) {
	await request(
		`announcements?id=eq.${enc(id)}&experience_id=eq.${enc(experienceId)}`,
		{ method: "PATCH", body: JSON.stringify(fields) },
	);
}

export async function setPinned(
	experienceId: string,
	id: string,
	pinned: boolean,
) {
	await request(
		`announcements?id=eq.${enc(id)}&experience_id=eq.${enc(experienceId)}`,
		{ method: "PATCH", body: JSON.stringify({ pinned }) },
	);
}

export async function deleteAnnouncement(experienceId: string, id: string) {
	await request(
		`announcements?id=eq.${enc(id)}&experience_id=eq.${enc(experienceId)}`,
		{ method: "DELETE" },
	);
}

export async function recordViews(
	userId: string,
	rows: { id: string; variant: string }[],
) {
	if (rows.length === 0) return;
	await request("announcement_views?on_conflict=announcement_id,user_id", {
		method: "POST",
		headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
		body: JSON.stringify(
			rows.map((r) => ({
				announcement_id: r.id,
				user_id: userId,
				variant: r.variant,
			})),
		),
	});
}

export async function toggleReaction(
	id: string,
	userId: string,
	emoji: string,
) {
	const filter = `announcement_id=eq.${enc(id)}&user_id=eq.${enc(userId)}&emoji=eq.${enc(emoji)}`;
	const existing = (await request(
		`announcement_reactions?${filter}&select=emoji&limit=1`,
	)) as unknown[] | null;
	if (existing && existing.length > 0) {
		await request(`announcement_reactions?${filter}`, { method: "DELETE" });
	} else {
		await request("announcement_reactions?on_conflict=announcement_id,user_id,emoji", {
			method: "POST",
			headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
			body: JSON.stringify({ announcement_id: id, user_id: userId, emoji }),
		});
	}
}

export async function acknowledge(id: string, userId: string) {
	await request("announcement_acks?on_conflict=announcement_id,user_id", {
		method: "POST",
		headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
		body: JSON.stringify({ announcement_id: id, user_id: userId }),
	});
}

export async function castVote(id: string, userId: string, index: number) {
	await request("announcement_votes?on_conflict=announcement_id,user_id", {
		method: "POST",
		headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
		body: JSON.stringify({
			announcement_id: id,
			user_id: userId,
			option_index: index,
		}),
	});
}