// @ts-nocheck
import { userInfo } from "./whop-data";

async function q(path: string) {
	const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
		cache: "no-store",
		headers: { apikey: process.env.SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
	});
	if (!res.ok) throw new Error(String(res.status));
	return (await res.json()) ?? [];
}

// People who viewed, reacted or commented. Works without any Whop permission.
export async function activityPeople(postIds: string[], exclude: string[]) {
	if (!postIds.length) return [];
	const ids = postIds.slice(0, 60).join(",");
	const [views, reacts, comms] = await Promise.all([
		q(`announcement_views?announcement_id=in.(${ids})&select=user_id&limit=2000`).catch(() => []),
		q(`announcement_reactions?announcement_id=in.(${ids})&select=user_id&limit=2000`).catch(() => []),
		q(`announcement_comments?announcement_id=in.(${ids})&select=user_id,user_name,user_handle&limit=2000`).catch(() => []),
	]);
	const known = new Map<string, { name: string; handle: string }>();
	const order: string[] = [];
	for (const r of [...views, ...reacts, ...comms]) {
		const id = String(r.user_id);
		if (exclude.includes(id)) continue;
		if (!known.has(id)) {
			known.set(id, { name: r.user_name ?? "", handle: r.user_handle ?? "" });
			order.push(id);
		} else if (r.user_name && !known.get(id).name) {
			known.set(id, { name: r.user_name, handle: r.user_handle ?? "" });
		}
	}
	const pick = order.slice(0, 120);
	await Promise.all(
		pick.map(async (id) => {
			const k = known.get(id);
			if (!k.name || !k.handle) {
				const u = await userInfo(id);
				k.name = k.name || u.name;
				k.handle = k.handle || u.handle;
			}
		}),
	);
	return pick.map((id) => ({ id, name: known.get(id).name, handle: known.get(id).handle }));
}