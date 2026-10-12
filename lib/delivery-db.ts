// @ts-nocheck
export type Channels = {
	push: boolean;
	email: boolean;
	chat: boolean;
	forum: boolean;
	channelIds: string[];
};

export type DueRow = {
	id: string;
	experience_id: string;
	title: string;
	body: string;
	deliver: Channels;
	attachments: any;
	target_products: any;
};

export type Prefs = {
	push_enabled: boolean;
	notify_reactions: boolean;
	notify_comments: boolean;
	spam_protection: boolean;
	chat_experience_id: string | null;
};

export const DEFAULT_PREFS: Prefs = {
	push_enabled: true,
	notify_reactions: true,
	notify_comments: true,
	spam_protection: false,
	chat_experience_id: null,
};

export type ChannelRow = {
	id: string;
	experience_id: string;
	kind: "discord" | "telegram";
	name: string;
	secret: string;
	target: string | null;
};

export type CommentRow = {
	id: string;
	announcement_id: string;
	experience_id: string;
	user_id: string;
	user_name: string | null;
	user_handle: string | null;
	body: string;
	created_at: string;
};

export type BanRow = {
	experience_id: string;
	user_id: string;
	name: string | null;
	handle: string | null;
};

export type LogRow = {
	id: string;
	channel: string;
	ok: boolean;
	detail: string | null;
	created_at: string;
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

// ---------- preferences ----------

export async function getPrefs(experienceId: string): Promise<Prefs> {
	const rows = await request(
		`app_prefs?experience_id=eq.${enc(experienceId)}&select=*&limit=1`,
	);
	return { ...DEFAULT_PREFS, ...(rows?.[0] ?? {}) };
}

export async function savePrefs(experienceId: string, patch: Partial<Prefs>) {
	await request("app_prefs?on_conflict=experience_id", {
		method: "POST",
		headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
		body: JSON.stringify({
			experience_id: experienceId,
			...patch,
			updated_at: new Date().toISOString(),
		}),
	});
}

// ---------- Discord and Telegram channels (secrets stay on the server) ----------

export async function listChannels(experienceId: string): Promise<ChannelRow[]> {
	return (
		(await request(
			`delivery_channels?experience_id=eq.${enc(experienceId)}&select=*&order=created_at.asc&limit=60`,
		)) ?? []
	);
}

export async function addChannel(
	experienceId: string,
	kind: "discord" | "telegram",
	name: string,
	secret: string,
	target: string | null,
) {
	await request("delivery_channels", {
		method: "POST",
		headers: { Prefer: "return=minimal" },
		body: JSON.stringify({ experience_id: experienceId, kind, name, secret, target }),
	});
}

export async function removeChannel(experienceId: string, id: string) {
	await request(
		`delivery_channels?id=eq.${enc(id)}&experience_id=eq.${enc(experienceId)}`,
		{ method: "DELETE" },
	);
}

// ---------- scheduled delivery ----------

export async function scheduleDelivery(id: string, channels: Channels) {
	await request(`announcements?id=eq.${enc(id)}`, {
		method: "PATCH",
		body: JSON.stringify({ deliver: channels }),
	});
}

export async function patchPost(id: string, fields: Record<string, unknown>) {
	await request(`announcements?id=eq.${enc(id)}`, {
		method: "PATCH",
		body: JSON.stringify(fields),
	});
}

// Marks due posts as taken, so each one is delivered exactly once.
export async function claimDue(limit = 3): Promise<DueRow[]> {
	const now = new Date().toISOString();
	const due = await request(
		`announcements?delivered_at=is.null&deliver=not.is.null&publish_at=lte.${enc(now)}&select=id&order=publish_at.asc&limit=${limit}`,
	);
	if (!due || due.length === 0) return [];
	const ids = due.map((d: { id: string }) => d.id).join(",");
	const claimed = await request(`announcements?id=in.(${ids})&delivered_at=is.null`, {
		method: "PATCH",
		headers: { Prefer: "return=representation" },
		body: JSON.stringify({ delivered_at: now }),
	});
	return claimed ?? [];
}

// ---------- email opt-outs ----------

export async function getOptOuts(experienceId: string): Promise<Set<string>> {
	const rows = await request(
		`email_optouts?experience_id=eq.${enc(experienceId)}&select=email&limit=5000`,
	);
	return new Set((rows ?? []).map((r: { email: string }) => r.email.toLowerCase()));
}

export async function addOptOut(email: string, experienceId: string) {
	await request("email_optouts?on_conflict=email,experience_id", {
		method: "POST",
		headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
		body: JSON.stringify({ email: email.toLowerCase(), experience_id: experienceId }),
	});
}

// ---------- comments ----------

export async function listComments(experienceId: string): Promise<CommentRow[]> {
	return (
		(await request(
			`announcement_comments?experience_id=eq.${enc(experienceId)}&select=*&order=created_at.asc&limit=500`,
		)) ?? []
	);
}

export async function insertComment(row: {
	announcement_id: string;
	experience_id: string;
	user_id: string;
	user_name: string;
	user_handle: string;
	body: string;
}): Promise<CommentRow | null> {
	const rows = await request("announcement_comments", {
		method: "POST",
		headers: { Prefer: "return=representation" },
		body: JSON.stringify(row),
	});
	return rows?.[0] ?? null;
}

export async function getComment(experienceId: string, id: string): Promise<CommentRow | null> {
	const rows = await request(
		`announcement_comments?id=eq.${enc(id)}&experience_id=eq.${enc(experienceId)}&select=*&limit=1`,
	);
	return rows?.[0] ?? null;
}

export async function removeComment(experienceId: string, id: string) {
	await request(
		`announcement_comments?id=eq.${enc(id)}&experience_id=eq.${enc(experienceId)}`,
		{ method: "DELETE" },
	);
}

export async function countComments(
	experienceId: string,
	userId: string,
	sinceIso: string,
): Promise<number> {
	const rows = await request(
		`announcement_comments?experience_id=eq.${enc(experienceId)}&user_id=eq.${enc(userId)}&created_at=gte.${enc(sinceIso)}&select=id&limit=100`,
	);
	return rows?.length ?? 0;
}

export async function lastComment(experienceId: string, userId: string): Promise<string | null> {
	const rows = await request(
		`announcement_comments?experience_id=eq.${enc(experienceId)}&user_id=eq.${enc(userId)}&select=body&order=created_at.desc&limit=1`,
	);
	return rows?.[0]?.body ?? null;
}

// ---------- reactions (to tell added from removed) ----------

export async function reactionOn(id: string, userId: string, emoji: string): Promise<boolean> {
	const rows = await request(
		`announcement_reactions?announcement_id=eq.${enc(id)}&user_id=eq.${enc(userId)}&emoji=eq.${enc(emoji)}&select=emoji&limit=1`,
	);
	return !!rows && rows.length > 0;
}

// ---------- bans ----------

export async function listBans(experienceId: string): Promise<BanRow[]> {
	return (
		(await request(
			`banned_users?experience_id=eq.${enc(experienceId)}&select=*&limit=2000`,
		)) ?? []
	);
}

export async function isBannedRow(experienceId: string, userId: string): Promise<boolean> {
	const rows = await request(
		`banned_users?experience_id=eq.${enc(experienceId)}&user_id=eq.${enc(userId)}&select=user_id&limit=1`,
	);
	return !!rows && rows.length > 0;
}

export async function banUser(
	experienceId: string,
	u: { id: string; name: string; handle: string },
) {
	await request("banned_users?on_conflict=experience_id,user_id", {
		method: "POST",
		headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
		body: JSON.stringify({
			experience_id: experienceId,
			user_id: u.id,
			name: u.name,
			handle: u.handle,
		}),
	});
}

export async function unbanUser(experienceId: string, userId: string) {
	await request(
		`banned_users?experience_id=eq.${enc(experienceId)}&user_id=eq.${enc(userId)}`,
		{ method: "DELETE" },
	);
}

// ---------- delivery log ----------

export async function logDelivery(
	experienceId: string,
	announcementId: string | null,
	channel: string,
	ok: boolean,
	detail: string,
) {
	await request("delivery_log", {
		method: "POST",
		headers: { Prefer: "return=minimal" },
		body: JSON.stringify({
			experience_id: experienceId,
			announcement_id: announcementId,
			channel,
			ok,
			detail: detail.slice(0, 400),
		}),
	});
}

export async function listLog(experienceId: string, limit = 15): Promise<LogRow[]> {
	return (
		(await request(
			`delivery_log?experience_id=eq.${enc(experienceId)}&select=id,channel,ok,detail,created_at&order=created_at.desc&limit=${limit}`,
		)) ?? []
	);
}