// @ts-nocheck
const BUCKET = "announcement-files";

function base() {
	const u = process.env.SUPABASE_URL;
	if (!u) throw new Error("Supabase is not configured");
	return u.replace(/\/+$/, "");
}

function key() {
	const k = process.env.SUPABASE_SECRET_KEY;
	if (!k) throw new Error("Supabase is not configured");
	return k;
}

function encPath(p: string) {
	return p.split("/").map(encodeURIComponent).join("/");
}

export function publicUrl(path: string) {
	return `${base()}/storage/v1/object/public/${BUCKET}/${encPath(path)}`;
}

export function validPath(experienceId: string, path: string) {
	return (
		typeof path === "string" &&
		path.startsWith(`${experienceId}/`) &&
		!path.includes("..") &&
		/^[\w./-]+$/.test(path) &&
		path.length < 300
	);
}

export async function signUpload(
	path: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
	try {
		const res = await fetch(
			`${base()}/storage/v1/object/upload/sign/${BUCKET}/${encPath(path)}`,
			{
				method: "POST",
				headers: { apikey: key(), "Content-Type": "application/json" },
				body: "{}",
				signal: AbortSignal.timeout(8000),
				cache: "no-store",
			},
		);
		const text = await res.text();
		if (!res.ok) {
			return { ok: false, error: `Storage answered ${res.status}. ${text.slice(0, 160)}` };
		}
		const j = JSON.parse(text);
		let url = String(j?.url ?? "");
		if (url && !/^https?:/.test(url)) {
			url = `${base()}/storage/v1${url.startsWith("/") ? "" : "/"}${url}`;
		}
		if (!url && j?.token) {
			url = `${base()}/storage/v1/object/upload/sign/${BUCKET}/${encPath(path)}?token=${j.token}`;
		}
		return url ? { ok: true, url } : { ok: false, error: "Storage returned no upload link." };
	} catch (e) {
		return {
			ok: false,
			error: `Could not reach storage (${e instanceof Error ? e.message : "error"}).`,
		};
	}
}

export async function removeFiles(paths: string[]) {
	if (paths.length === 0) return;
	try {
		await fetch(`${base()}/storage/v1/object/${BUCKET}`, {
			method: "DELETE",
			headers: { apikey: key(), "Content-Type": "application/json" },
			body: JSON.stringify({ prefixes: paths }),
			signal: AbortSignal.timeout(8000),
			cache: "no-store",
		});
	} catch {}
}