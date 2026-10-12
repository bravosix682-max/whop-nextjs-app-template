// @ts-nocheck
import { cached, forget } from "./cache";
import { whopsdk } from "./whop-sdk";

const API = "https://api.whop.com/api/v1";
const enc = encodeURIComponent;

export type Member = {
	id: string;
	name: string;
	handle: string;
	email: string | null;
	access: string;
};
export type Product = { id: string; title: string };

async function apiGet(path: string) {
	try {
		const res = await fetch(`${API}${path}`, {
			headers: { Authorization: `Bearer ${process.env.WHOP_API_KEY ?? ""}` },
			signal: AbortSignal.timeout(6000),
			cache: "no-store",
		});
		if (!res.ok) return { ok: false, status: res.status, json: null };
		return { ok: true, status: res.status, json: await res.json() };
	} catch {
		return { ok: false, status: 0, json: null };
	}
}

export async function companyOf(
	experienceId: string,
): Promise<{ id: string; title: string }> {
	return cached(`company:${experienceId}`, 600_000, async () => {
		const exp: any = await whopsdk.experiences.retrieve(experienceId);
		return {
			id: String(exp?.company?.id ?? exp?.company_id ?? ""),
			title: String(exp?.company?.title ?? "your community"),
		};
	});
}

export async function listMembers(
	companyId: string,
	pages = 3,
): Promise<{ members: Member[]; error?: string }> {
	const key = `members:${companyId}`;
	const result = await cached(key, 60_000, async () => {
		const seen = new Set<string>();
		const out: Member[] = [];
		let after = "";
		for (let p = 0; p < pages; p++) {
			const r = await apiGet(
				`/members?company_id=${enc(companyId)}&first=100${after ? `&after=${enc(after)}` : ""}`,
			);
			if (!r.ok) {
				return {
					members: out,
					error:
						r.status === 401 || r.status === 403
							? "PERMISSION"
							: `Whop answered ${r.status}.`,
				};
			}
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

export async function listProducts(
	companyId: string,
): Promise<{ products: Product[]; error?: string }> {
	const key = `prods:${companyId}`;
	const result = await cached(key, 120_000, async () => {
		const out: Product[] = [];
		let after = "";
		for (let p = 0; p < 3; p++) {
			const r = await apiGet(
				`/products?company_id=${enc(companyId)}&first=50${after ? `&after=${enc(after)}` : ""}`,
			);
			if (!r.ok) {
				return {
					products: out,
					error:
						r.status === 401 || r.status === 403
							? "PERMISSION"
							: `Whop answered ${r.status}.`,
				};
			}
			for (const x of r.json?.data ?? []) {
				if (x?.id) out.push({ id: String(x.id), title: String(x.title ?? x.id) });
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

export async function hasProductAccess(userId: string, productId: string): Promise<boolean> {
	return cached(`pa:${userId}:${productId}`, 60_000, async () => {
		try {
			const r: any = await whopsdk.users.checkAccess(productId, { id: userId });
			if (typeof r?.has_access === "boolean") return r.has_access;
			return !!r?.access_level && r.access_level !== "no_access";
		} catch {
			return false;
		}
	});
}

export async function userInfo(userId: string): Promise<{ name: string; handle: string }> {
	return cached(`user:${userId}`, 600_000, async () => {
		try {
			const u: any = await whopsdk.users.retrieve(userId);
			return {
				name: String(u?.name ?? u?.username ?? "Member"),
				handle: String(u?.username ?? ""),
			};
		} catch {
			return { name: "Member", handle: "" };
		}
	});
}