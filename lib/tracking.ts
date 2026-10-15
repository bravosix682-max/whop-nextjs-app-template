// @ts-nocheck
import { createHmac, timingSafeEqual } from "node:crypto";

const base = () => (process.env.APP_URL || process.env.URL || "").replace(/\/+$/, "");
const secret = () => process.env.CRON_SECRET || process.env.UNSUBSCRIBE_SECRET || "";
const sign = (payload: string) =>
	createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 22);

export function trackUrl(postId: string, kind: string, url: string, what = "link") {
	const b = base();
	if (!b || !secret() || !postId || !/^https?:\/\//i.test(url)) return url;
	const payload = Buffer.from(JSON.stringify({ a: postId, k: kind, u: url, w: what })).toString("base64url");
	return `${b}/api/go?t=${payload}.${sign(payload)}`;
}

export function readTrack(token: string) {
	const [payload, sig] = String(token).split(".");
	if (!payload || !sig || !secret()) return null;
	const x = Buffer.from(sig);
	const y = Buffer.from(sign(payload));
	if (x.length !== y.length || !timingSafeEqual(x, y)) return null;
	try {
		const d = JSON.parse(Buffer.from(payload, "base64url").toString());
		if (!/^[0-9a-f-]{36}$/i.test(String(d.a)) || !/^https?:\/\//i.test(String(d.u))) return null;
		return d;
	} catch {
		return null;
	}
}

export async function recordClick(d: any) {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SECRET_KEY;
	if (!url || !key) return;
	await fetch(`${url}/rest/v1/click_events`, {
		method: "POST",
		headers: { apikey: key, "Content-Type": "application/json", Prefer: "return=minimal" },
		body: JSON.stringify({
			announcement_id: d.a,
			kind: String(d.k).slice(0, 20),
			what: d.w === "product" ? "product" : "link",
		}),
	});
}