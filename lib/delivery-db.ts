export type Channels = { push: boolean; discord: boolean; email: boolean };

export type DueRow = {
	id: string;
	experience_id: string;
	title: string;
	body: string;
	deliver: Channels;
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

export async function getDiscordWebhook(
	experienceId: string,
): Promise<string | null> {
	const rows = (await request(
		`delivery_settings?experience_id=eq.${enc(experienceId)}&select=discord_webhook&limit=1`,
	)) as { discord_webhook: string | null }[] | null;
	return rows?.[0]?.discord_webhook ?? null;
}

export async function setDiscordWebhook(
	experienceId: string,
	url: string | null,
) {
	await request("delivery_settings?on_conflict=experience_id", {
		method: "POST",
		headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
		body: JSON.stringify({
			experience_id: experienceId,
			discord_webhook: url,
			updated_at: new Date().toISOString(),
		}),
	});
}

export async function scheduleDelivery(id: string, channels: Channels) {
	await request(`announcements?id=eq.${enc(id)}`, {
		method: "PATCH",
		body: JSON.stringify({ deliver: channels }),
	});
}

// Marks due posts as taken, so each one is delivered exactly once.
export async function claimDue(limit = 3): Promise<DueRow[]> {
	const now = new Date().toISOString();
	const due = (await request(
		`announcements?delivered_at=is.null&deliver=not.is.null&publish_at=lte.${enc(now)}&select=id&order=publish_at.asc&limit=${limit}`,
	)) as { id: string }[] | null;
	if (!due || due.length === 0) return [];
	const ids = due.map((d) => d.id).join(",");
	const claimed = (await request(
		`announcements?id=in.(${ids})&delivered_at=is.null`,
		{
			method: "PATCH",
			headers: { Prefer: "return=representation" },
			body: JSON.stringify({ delivered_at: now }),
		},
	)) as DueRow[] | null;
	return claimed ?? [];
}

export async function getOptOuts(experienceId: string): Promise<Set<string>> {
	const rows = (await request(
		`email_optouts?experience_id=eq.${enc(experienceId)}&select=email&limit=5000`,
	)) as { email: string }[] | null;
	return new Set((rows ?? []).map((r) => r.email.toLowerCase()));
}

export async function addOptOut(email: string, experienceId: string) {
	await request("email_optouts?on_conflict=email,experience_id", {
		method: "POST",
		headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
		body: JSON.stringify({
			email: email.toLowerCase(),
			experience_id: experienceId,
		}),
	});
}