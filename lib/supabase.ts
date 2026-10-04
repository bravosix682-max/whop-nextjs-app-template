export type Announcement = {
	id: string;
	experience_id: string;
	title: string;
	body: string;
	pinned: boolean;
	author_id: string | null;
	created_at: string;
};

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

export async function listAnnouncements(
	experienceId: string,
): Promise<Announcement[]> {
	const query = `announcements?experience_id=eq.${encodeURIComponent(experienceId)}&select=*&order=pinned.desc,created_at.desc&limit=50`;
	return (await request(query)) ?? [];
}

export async function createAnnouncement(row: {
	experience_id: string;
	title: string;
	body: string;
	pinned: boolean;
	author_id: string | null;
}) {
	await request("announcements", {
		method: "POST",
		headers: { Prefer: "return=minimal" },
		body: JSON.stringify(row),
	});
}

export async function setPinned(
	experienceId: string,
	id: string,
	pinned: boolean,
) {
	await request(
		`announcements?id=eq.${encodeURIComponent(id)}&experience_id=eq.${encodeURIComponent(experienceId)}`,
		{ method: "PATCH", body: JSON.stringify({ pinned }) },
	);
}

export async function deleteAnnouncement(experienceId: string, id: string) {
	await request(
		`announcements?id=eq.${encodeURIComponent(id)}&experience_id=eq.${encodeURIComponent(experienceId)}`,
		{ method: "DELETE" },
	);
}