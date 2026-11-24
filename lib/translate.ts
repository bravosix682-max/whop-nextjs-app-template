// @ts-nocheck
import { LANGS } from "./langs";

const ENT: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };
function decode(s: string) {
	return s
		.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENT[m] ?? m)
		.replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

export function langName(code: string) {
	return LANGS.find((l) => l.code === code)?.name ?? code;
}

// the free service accepts about 500 characters at a time
export function chunk(s: string, max = 440): string[] {
	if (s.length <= max) return [s];
	const parts = s.split(/(?<=[.!?。！？])\s+/);
	const out: string[] = [];
	let cur = "";
	for (const p of parts) {
		if ((cur ? `${cur} ${p}` : p).length > max) {
			if (cur) out.push(cur);
			cur = p;
			while (cur.length > max) {
				out.push(cur.slice(0, max));
				cur = cur.slice(max);
			}
		} else cur = cur ? `${cur} ${p}` : p;
	}
	if (cur) out.push(cur);
	return out;
}

async function mm(text: string, target: string, source: string) {
	const email = process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : "";
	const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${source}|${target}`)}${email}`;
	const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
	const j: any = await res.json().catch(() => null);
	const out = String(j?.responseData?.translatedText ?? "");
	if (j?.quotaFinished || /MYMEMORY WARNING/i.test(out)) throw new Error("QUOTA");
	if (!j || String(j.responseStatus) !== "200") throw new Error(`API ${j?.responseStatus ?? res.status}`);
	return decode(out);
}

async function seg(text: string, target: string) {
	try {
		return await mm(text, target, "Autodetect");
	} catch (e) {
		if (e instanceof Error && e.message === "QUOTA") throw e;
		return await mm(text, target, "en");
	}
}

const URL_RE = /https?:\/\/[^\s)]+/g;
const PREFIX = /^(#{1,3}\s+|-\s+|[•○■□✓✔→➤★✦◆▶❖]\s+|\d+[.)]\s+|[a-zA-Z]\)\s+)/;

async function line(raw: string, target: string) {
	const t = raw.trim();
	if (!t || /^:::/.test(t) || /^https?:\/\/\S+$/.test(t)) return raw;
	let prefix = "";
	let rest = t;
	const pm = rest.match(PREFIX);
	if (pm) {
		prefix = pm[1];
		rest = rest.slice(prefix.length);
	}
	const urls: string[] = [];
	rest = rest
		.replace(/\{\{[a-z0-9,-]+\|/g, "")
		.replace(/\}\}/g, "")
		.replace(/\*\*|__|~~/g, "")
		.replace(/\*([^*\n]+)\*/g, "$1")
		.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, l, u) => {
			urls.push(u);
			return `${l} xqz${urls.length - 1}xqz`;
		})
		.replace(URL_RE, (u) => {
			urls.push(u);
			return `xqz${urls.length - 1}xqz`;
		});
	if (!rest.replace(/xqz\d+xqz/g, "").trim()) return raw;
	const pieces: string[] = [];
	for (const c of chunk(rest)) pieces.push(await seg(c, target));
	const joined = pieces.join(" ").replace(/xqz\s*(\d+)\s*xqz/gi, (_m, n) => urls[Number(n)] ?? "");
	return `${prefix}${joined}`;
}

async function pool<T>(tasks: (() => Promise<T>)[], n = 5): Promise<T[]> {
	const res: T[] = new Array(tasks.length);
	let i = 0;
	const workers = Array.from({ length: Math.min(n, tasks.length) }, async () => {
		while (i < tasks.length) {
			const k = i++;
			res[k] = await tasks[k]();
		}
	});
	await Promise.all(workers);
	return res;
}

export async function translateAnnouncement(title: string, body: string, target: string) {
	const lines = String(body ?? "").replace(/\r/g, "").slice(0, 3500).split("\n").slice(0, 50);
	const tasks = [() => line(String(title ?? ""), target), ...lines.map((l) => () => line(l, target))];
	const res = await pool(tasks, 5);
	return { title: res[0], body: res.slice(1).join("\n") };
}