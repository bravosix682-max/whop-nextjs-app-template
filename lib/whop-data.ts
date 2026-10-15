// @ts-nocheck
import { cached, forget } from "./cache";
import { whopsdk } from "./whop-sdk";

const API = "https://api.whop.com/api/v1";
const enc = encodeURIComponent;

export type Member = { id: string; name: string; handle: string; email: string | null; access: string };
export type Product = { id: string; title: string; route: string };

async function apiGet(path: string) {
	try {
		const res = await fetch(`${API}${path}`, {
			headers: { Authorization: `Bearer ${process.env.WHOP_API_KEY ?? ""}` },
			signal: AbortSignal.timeout(6000),
			cache: "no-store",
		});
		if (!res.ok) {
			const t = await res.text().catch(() => "");
			return { ok: false, status: res.status, body: t.slice(0, 160), json: null };
		}
		return { ok: true, status: 200, body: "", json: await res.json() };
	} catch (e) {
		return { ok: false, status: 0, body: String(e?.message ?? "network error"), json: null };
	}
}

function fail(r: any) {
	return r.status === 401 || r.status === 403
		? "PERMISSION"
		: `Whop answered ${r.status}. ${r.body}`.trim();
}

export async function companyOf(experienceId: string): Promise<{ id: string; title: string; route: string }> {
	return cached(`company:${experienceId}`, 600_000, async () => {
		const exp: any = await whopsdk.experiences.retrieve(experienceId);
		return {
			id: String(exp?.company?.id ?? exp?.company_id ?? ""),
			title: String(exp?.company?.title ?? "your community"),
			route: String(exp?.company?.route ?? ""),
		};
	});
}

export function productUrl(companyRoute: string, productRoute: string) {
	if (productRoute && companyRoute) return `https://whop.com/${companyRoute}/${productRoute}/`;
	if (productRoute) return `https://whop.com/${productRoute}/`;
	return companyRoute ? `https://whop.com/${companyRoute}/` : "https://whop.com/";
}

export async function listMembers(companyId: string, _pages = 6): Promise<{ members: Member[]; error?: string }> {
	const key = `members:${companyId}`;
	const result = await cached(key, 60_000, async () => {
		const seen = new Set<string>();
		const out: Member[] = [];
		let after = "";
		for (let p = 0; p < 6; p++) {
			const page = (withFirst: boolean) =>
				apiGet(
					`/members?company_id=${enc(companyId)}${withFirst ? "&first=50" : ""}${after ? `&after=${enc(after)}` : ""}`,
				);
			let r: any = await page(true);
			if (!r.ok && r.status === 400 && !after) r = await page(false);
			if (!r.ok) return { members: out, error: fail(r) };
			for (const m of r.json?.data ?? []) {
				const u = m?.user;
				if (!u?.id || seen.has(String(u.id))) continue;
				seen.add(String(u.id));
				out.push({
					id: String(u.id),
					name: String(u.name ?? u.username ?? ""),
					handle: String(u.username ?? ""),
					email: typeof u.email === "string" ? u.email : null,
					access: String(m?.access_level ?? ""),
				});
			}
			if (!r.json?.page_info?.has_next_page) break;
			after = String(r.json.page_info.end_cursor ?? "");
			if (!after) break;
		}
		return { members: out };
	});
	if (result.error) forget(key);
	return result;
}

export async function listProducts(companyId: string): Promise<{ products: Product[]; error?: string }> {
	const key = `prods:${companyId}`;
	const result = await cached(key, 120_000, async () => {
		const out: Product[] = [];
		let after = "";
		for (let p = 0; p < 3; p++) {
			const r: any = await apiGet(
				`/products?company_id=${enc(companyId)}&first=50${after ? `&after=${enc(after)}` : ""}`,
			);
			if (!r.ok) return { products: out, error: fail(r) };
			for (const x of r.json?.data ?? []) {
				if (x?.id) out.push({ id: String(x.id), title: String(x.title ?? x.id), route: String(x.route ?? "") });
			}
			if (!r.json?.page_info?.has_next_page) break;
			after = String(r.json.page_info.end_cursor ?? "");
			if (!after) break;
		}
		return { products: out };
	});
	if (result.error) forget(key);
	return result;
}

// Products are now attached as cards, not used to hide posts, so everyone may see every post.
export async function hasProductAccess(_userId: string, _productId: string): Promise<boolean> {
	return true;
}

export async function userInfo(userId: string): Promise<{ name: string; handle: string }> {
	return cached(`user:${userId}`, 600_000, async () => {
		try {
			const u: any = await whopsdk.users.retrieve(userId);
			return { name: String(u?.name ?? u?.username ?? "Member"), handle: String(u?.username ?? "") };
		} catch {
			return { name: "Member", handle: "" };
		}
	});
}