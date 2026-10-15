// @ts-nocheck
export type Align = "left" | "center" | "right";

export type Tok =
	| { k: "t"; v: string }
	| { k: "b" | "i" | "u" | "s"; c: Tok[] }
	| { k: "f"; f: string; c: Tok[] }
	| { k: "a"; c: Tok[]; url: string }
	| { k: "m"; v: string };

export type Block =
	| { t: "p"; align: Align; text: string }
	| { t: "h"; align: Align; level: 1 | 2 | 3; text: string }
	| { t: "ul" | "ol"; align: Align; items: string[] }
	| { t: "yt"; id: string }
	| { t: "img"; url: string };

export type Attachment = { path: string; name: string; type: string; size: number };

export const FONT_STACK: Record<string, string> = {
	serif: "Georgia, 'Times New Roman', serif",
	mono: "ui-monospace, Menlo, Consolas, 'Courier New', monospace",
	rounded: "'Trebuchet MS', 'Segoe UI', sans-serif",
	display: "Impact, 'Arial Black', sans-serif",
	hand: "'Comic Sans MS', 'Segoe Print', cursive",
};

export const FONT_LABELS: [string, string][] = [
	["", "Default"],
	["serif", "Serif"],
	["mono", "Monospace"],
	["rounded", "Rounded"],
	["display", "Display"],
	["hand", "Handwritten"],
];

const IMAGE_EXT = /\.(?:png|jpe?g|gif|webp)(?:\?[^\s<]*)?$/i;
export const isImageUrl = (u: string) => IMAGE_EXT.test(u);

export function youtubeId(u: string): string | null {
	const m = u.match(
		/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#][^\s]*)?$/,
	);
	return m ? m[1] : null;
}

// ---------- attachments ----------
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];
const VIDEO_EXTS = ["mp4", "webm", "mov"];
const FILE_EXTS = ["pdf", "txt", "csv", "zip", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];
export const ALLOWED_ACCEPT = [...IMAGE_EXTS, ...VIDEO_EXTS, ...FILE_EXTS].map((e) => `.${e}`).join(",");

export const MIME_BY_EXT: Record<string, string> = {
	png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
	mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", pdf: "application/pdf",
	txt: "text/plain", csv: "text/csv", zip: "application/zip", doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function extOf(name: string) {
	const m = name.toLowerCase().match(/\.([a-z0-9]{1,5})$/);
	return m ? m[1] : "";
}

export function kindOf(name: string): "image" | "video" | "file" | null {
	const e = extOf(name);
	if (IMAGE_EXTS.includes(e)) return "image";
	if (VIDEO_EXTS.includes(e)) return "video";
	if (FILE_EXTS.includes(e)) return "file";
	return null;
}

export function formatSize(n: number) {
	if (n < 1024) return `${n} B`;
	if (n < 1048576) return `${Math.round(n / 1024)} KB`;
	return `${(n / 1048576).toFixed(1)} MB`;
}

// ---------- inline text ----------
const INLINE =
	/\{\{(?<ff>serif|mono|rounded|display|hand)\|(?<fin>[\s\S]+?)\}\}|\[(?<ll>[^\]]+)\]\((?<lu>https?:\/\/[^\s)]+)\)|\*\*(?<b>.+?)\*\*|__(?<u>.+?)__|~~(?<s>.+?)~~|\*(?<i>[^*\s](?:[^*]*[^*\s])?)\*|(?<url>https?:\/\/[^\s<]+)|(?<m>@[A-Za-z0-9_.]{2,32})/g;

export function tokenize(text: string): Tok[] {
	const out: Tok[] = [];
	let last = 0;
	const re = new RegExp(INLINE.source, "g");
	let m: RegExpExecArray | null;
	while ((m = re.exec(text))) {
		const g: any = m.groups ?? {};
		if (m.index > last) out.push({ k: "t", v: text.slice(last, m.index) });
		if (g.ff) out.push({ k: "f", f: g.ff, c: tokenize(g.fin) });
		else if (g.lu) out.push({ k: "a", c: tokenize(g.ll), url: g.lu });
		else if (g.b) out.push({ k: "b", c: tokenize(g.b) });
		else if (g.u) out.push({ k: "u", c: tokenize(g.u) });
		else if (g.s) out.push({ k: "s", c: tokenize(g.s) });
		else if (g.i) out.push({ k: "i", c: tokenize(g.i) });
		else if (g.url) {
			const url = g.url.replace(/[.,!?;:)]+$/, "");
			out.push({ k: "a", c: [{ k: "t", v: url }], url });
			const tail = g.url.slice(url.length);
			if (tail) out.push({ k: "t", v: tail });
		} else if (g.m) {
			const prev = m.index > 0 ? text[m.index - 1] : "";
			if (prev && !/[\s(]/.test(prev)) out.push({ k: "t", v: m[0] });
			else out.push({ k: "m", v: m[0] });
		}
		last = m.index + m[0].length;
	}
	if (last < text.length) out.push({ k: "t", v: text.slice(last) });
	return out;
}

// ---------- blocks ----------
export function parseBlocks(src: string): Block[] {
	const lines = String(src ?? "").replace(/\r/g, "").split("\n");
	const out: Block[] = [];
	let align: Align = "left";
	let para: string[] = [];
	let list: { kind: "ul" | "ol"; items: string[] } | null = null;
	const flushPara = () => {
		if (para.length) {
			out.push({ t: "p", align, text: para.join("\n") });
			para = [];
		}
	};
	const flushList = () => {
		if (list) {
			out.push({ t: list.kind, align, items: list.items });
			list = null;
		}
	};
	for (const raw of lines) {
		const line = raw.trimEnd();
		const fence = line.match(/^:::(left|center|right)?\s*$/);
		if (fence) {
			flushPara();
			flushList();
			align = (fence[1] as Align) ?? "left";
			continue;
		}
		if (line.trim() === "") {
			flushPara();
			flushList();
			continue;
		}
		const solo = line.trim();
		const yt = youtubeId(solo);
		if (yt) {
			flushPara();
			flushList();
			out.push({ t: "yt", id: yt });
			continue;
		}
		if (/^https?:\/\/\S+$/.test(solo) && isImageUrl(solo)) {
			flushPara();
			flushList();
			out.push({ t: "img", url: solo });
			continue;
		}
		const h = line.match(/^(#{1,3})\s+(.*)$/);
		if (h) {
			flushPara();
			flushList();
			out.push({ t: "h", align, level: h[1].length as 1 | 2 | 3, text: h[2] });
			continue;
		}
		const ul = line.match(/^-\s+(.*)$/);
		const ol = line.match(/^\d+[.)]\s+(.*)$/);
		if (ul || ol) {
			flushPara();
			const kind: "ul" | "ol" = ul ? "ul" : "ol";
			if (list && list.kind !== kind) flushList();
			if (!list) list = { kind, items: [] };
			list.items.push((ul ?? ol)[1]);
			continue;
		}
		flushList();
		para.push(line);
	}
	flushPara();
	flushList();
	return out;
}

export function firstImageUrl(text: string): string | null {
	for (const b of parseBlocks(text)) if (b.t === "img") return b.url;
	return null;
}

// ---------- converters ----------
type Fmt = {
	t: (s: string) => string; b: (s: string) => string; i: (s: string) => string;
	u: (s: string) => string; s: (s: string) => string; f: (k: string, s: string) => string;
	a: (label: string, url: string) => string; m: (s: string) => string;
};
type BFmt = {
	p: (s: string, a: Align) => string; h: (s: string, l: number, a: Align) => string;
	ul: (items: string[], a: Align) => string; ol: (items: string[], a: Align) => string;
	yt: (id: string) => string; img: (url: string) => string; join: string;
};

function walk(toks: Tok[], f: Fmt): string {
	let out = "";
	for (const x of toks) {
		if (x.k === "t") out += f.t(x.v);
		else if (x.k === "b") out += f.b(walk(x.c, f));
		else if (x.k === "i") out += f.i(walk(x.c, f));
		else if (x.k === "u") out += f.u(walk(x.c, f));
		else if (x.k === "s") out += f.s(walk(x.c, f));
		else if (x.k === "f") out += f.f(x.f, walk(x.c, f));
		else if (x.k === "a") out += f.a(walk(x.c, f), x.url);
		else out += f.m(x.v);
	}
	return out;
}

function render(text: string, f0: Fmt, b: BFmt, mapUrl?: (u: string) => string): string {
	const f: Fmt = mapUrl ? { ...f0, a: (l, u) => f0.a(l, mapUrl(u)) } : f0;
	const parts: string[] = [];
	for (const x of parseBlocks(text)) {
		if (x.t === "p") parts.push(b.p(walk(tokenize(x.text), f), x.align));
		else if (x.t === "h") parts.push(b.h(walk(tokenize(x.text), f), x.level, x.align));
		else if (x.t === "ul") parts.push(b.ul(x.items.map((i) => walk(tokenize(i), f)), x.align));
		else if (x.t === "ol") parts.push(b.ol(x.items.map((i) => walk(tokenize(i), f)), x.align));
		else if (x.t === "yt") parts.push(b.yt(x.id));
		else parts.push(b.img(x.url));
	}
	return parts.filter(Boolean).join(b.join);
}

const same = (s: string) => s;
const keep = (_k: string, s: string) => s;
const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bullets = (items: string[]) => items.map((i) => `• ${i}`).join("\n");
const numbers = (items: string[]) => items.map((i, n) => `${n + 1}. ${i}`).join("\n");

const PLAIN_F: Fmt = { t: same, b: same, i: same, u: same, s: same, f: keep, a: (l) => l, m: same };
const PLAIN_B: BFmt = { p: same, h: same, ul: (i) => i.join(" "), ol: (i) => i.join(" "), yt: () => "", img: () => "", join: " " };

const HTML_F: Fmt = {
	t: esc, b: (s) => `<strong>${s}</strong>`, i: (s) => `<em>${s}</em>`, u: (s) => `<u>${s}</u>`, s: (s) => `<s>${s}</s>`,
	f: (k, s) => `<span style="font-family:${FONT_STACK[k]}">${s}</span>`,
	a: (l, u) => `<a href="${esc(u)}" style="color:#ff5a1f">${l}</a>`, m: (s) => `<strong>${esc(s)}</strong>`,
};
const HTML_B: BFmt = {
	p: (s, a) => `<p style="margin:0 0 12px;white-space:pre-wrap;text-align:${a}">${s}</p>`,
	h: (s, l, a) => `<h${l} style="margin:16px 0 8px;text-align:${a}">${s}</h${l}>`,
	ul: (items, a) => `<ul style="margin:0 0 12px;padding-left:22px;text-align:${a}">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`,
	ol: (items, a) => `<ol style="margin:0 0 12px;padding-left:22px;text-align:${a}">${items.map((i) => `<li>${i}</li>`).join("")}</ol>`,
	yt: (id) => `<p style="margin:0 0 12px"><a href="https://youtu.be/${id}" style="color:#ff5a1f">Watch on YouTube</a></p>`,
	img: (u) => `<img src="${esc(u)}" alt="" style="max-width:100%;border-radius:12px;display:block;margin:12px 0">`,
	join: "",
};

const TG_F: Fmt = {
	t: esc, b: (s) => `<b>${s}</b>`, i: (s) => `<i>${s}</i>`, u: (s) => `<u>${s}</u>`, s: (s) => `<s>${s}</s>`,
	f: keep, a: (l, u) => `<a href="${esc(u)}">${l}</a>`, m: esc,
};
const TG_B: BFmt = { p: same, h: (s) => `<b>${s}</b>`, ul: bullets, ol: numbers, yt: (id) => `https://youtu.be/${id}`, img: () => "", join: "\n\n" };

const MD_F: Fmt = {
	t: same, b: (s) => `**${s}**`, i: (s) => `*${s}*`, u: (s) => `__${s}__`, s: (s) => `~~${s}~~`,
	f: keep, a: (l, u) => `[${l}](${u})`, m: same,
};
const DISCORD_B: BFmt = { p: same, h: (s) => `**${s}**`, ul: bullets, ol: numbers, yt: (id) => `https://youtu.be/${id}`, img: () => "", join: "\n\n" };
const WHOP_F: Fmt = { ...MD_F, u: same };
const WHOP_B: BFmt = {
	p: same, h: (s, l) => `${"#".repeat(l)} ${s}`, ul: (i) => i.map((x) => `- ${x}`).join("\n"), ol: numbers,
	yt: (id) => `https://youtu.be/${id}`, img: (u) => `![](${u})`, join: "\n\n",
};

const ED_F: Fmt = {
	t: esc, b: (s) => `<b>${s}</b>`, i: (s) => `<i>${s}</i>`, u: (s) => `<u>${s}</u>`, s: (s) => `<s>${s}</s>`,
	f: (k, s) => `<span data-font="${k}" style="font-family:${FONT_STACK[k]}">${s}</span>`,
	a: (l, u) => `<a href="${esc(u)}">${l}</a>`, m: esc,
};
const ED_B: BFmt = {
	p: (s, a) => `<p style="text-align:${a}">${s.replace(/\n/g, "<br>")}</p>`,
	h: (s, l, a) => `<h${l} style="text-align:${a}">${s}</h${l}>`,
	ul: (items, a) => `<ul style="text-align:${a}">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`,
	ol: (items, a) => `<ol style="text-align:${a}">${items.map((i) => `<li>${i}</li>`).join("")}</ol>`,
	yt: (id) => `<p>https://youtu.be/${id}</p>`,
	img: (u) => `<p>${esc(u)}</p>`,
	join: "",
};

type MapUrl = (u: string) => string;
export const toPlain = (t: string) => render(t, PLAIN_F, PLAIN_B).replace(/\s+/g, " ").trim();
export const toHtml = (t: string, m?: MapUrl) => render(t, HTML_F, HTML_B, m);
export const toTelegram = (t: string, m?: MapUrl) => render(t, TG_F, TG_B, m);
export const toDiscord = (t: string, m?: MapUrl) => render(t, MD_F, DISCORD_B, m);
export const toMarkdown = (t: string, m?: MapUrl) => render(t, WHOP_F, WHOP_B, m);
export const toEditorHtml = (t: string) => render(t, ED_F, ED_B);