// @ts-nocheck
export type Align = "left" | "center" | "right";

export type Tok =
	| { k: "t"; v: string }
	| { k: "b" | "i" | "u" | "s"; c: Tok[] }
	| { k: "f"; f: string; c: Tok[] }
	| { k: "h"; color: string; c: Tok[] }
	| { k: "a"; c: Tok[]; url: string }
	| { k: "m"; v: string };

export type Block =
	| { t: "p"; align: Align; text: string }
	| { t: "h"; align: Align; level: 1 | 2 | 3; text: string }
	| { t: "ul"; align: Align; items: string[]; bullet?: string }
	| { t: "ol"; align: Align; items: string[]; style?: string }
	| { t: "yt"; id: string }
	| { t: "img"; url: string };

export type Attachment = { path: string; name: string; type: string; size: number };

export const FONT_STACK: Record<string, string> = {
	serif: "Georgia, 'Times New Roman', serif",
	playfair: "'Playfair Display', Georgia, serif",
	merriweather: "'Merriweather', Georgia, serif",
	lora: "'Lora', Georgia, serif",
	poppins: "'Poppins', 'Segoe UI', sans-serif",
	montserrat: "'Montserrat', 'Segoe UI', sans-serif",
	rounded: "'Trebuchet MS', 'Segoe UI', sans-serif",
	oswald: "'Oswald', 'Arial Narrow', sans-serif",
	bebas: "'Bebas Neue', Impact, sans-serif",
	anton: "'Anton', Impact, sans-serif",
	display: "Impact, 'Arial Black', sans-serif",
	righteous: "'Righteous', 'Trebuchet MS', sans-serif",
	bangers: "'Bangers', Impact, cursive",
	orbitron: "'Orbitron', 'Segoe UI', sans-serif",
	pixel: "'Silkscreen', monospace",
	mono: "ui-monospace, Menlo, Consolas, 'Courier New', monospace",
	jetbrains: "'JetBrains Mono', ui-monospace, monospace",
	pacifico: "'Pacifico', cursive",
	lobster: "'Lobster', cursive",
	dancing: "'Dancing Script', cursive",
	caveat: "'Caveat', cursive",
	marker: "'Permanent Marker', cursive",
	hand: "'Comic Sans MS', 'Segoe Print', cursive",
};

export const FONT_LABELS: [string, string][] = [
	["", "Default"],
	["serif", "Serif"],
	["playfair", "Playfair Display"],
	["merriweather", "Merriweather"],
	["lora", "Lora"],
	["poppins", "Poppins"],
	["montserrat", "Montserrat"],
	["rounded", "Rounded"],
	["oswald", "Oswald"],
	["bebas", "Bebas Neue"],
	["anton", "Anton"],
	["display", "Impact"],
	["righteous", "Righteous"],
	["bangers", "Bangers"],
	["orbitron", "Orbitron"],
	["pixel", "Pixel"],
	["mono", "Monospace"],
	["jetbrains", "JetBrains Mono"],
	["pacifico", "Pacifico"],
	["lobster", "Lobster"],
	["dancing", "Dancing Script"],
	["caveat", "Caveat"],
	["marker", "Permanent Marker"],
	["hand", "Handwritten"],
];

export const HL: Record<string, string> = {
	yellow: "#fde047",
	green: "#86efac",
	pink: "#f9a8d4",
	cyan: "#67e8f9",
	purple: "#c4b5fd",
	orange: "#fdba74",
};

// custom bullet characters people can pick (the plain dot is the default)
export const BULLET_CHOICES = ["○", "■", "✓", "→", "★", "◆", "➤"];
// numbered list styles: 1. a) A) i. I.
export const LIST_TYPE_CSS: Record<string, string> = { "1": "decimal", a: "lower-alpha", A: "upper-alpha", i: "lower-roman", I: "upper-roman" };
export const NUM_STYLES: [string, string][] = [["1", "1. 2. 3."], ["a", "a) b) c)"], ["A", "A) B) C)"], ["i", "i. ii. iii."], ["I", "I. II. III."]];

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
	/\[(?<ll>[^\]]+)\]\((?<lu>https?:\/\/[^\s)]+)\)|\*\*(?<b>.+?)\*\*|__(?<u>.+?)__|~~(?<s>.+?)~~|\*(?<i>[^*\s](?:[^*]*[^*\s])?)\*|(?<url>https?:\/\/[^\s<]+)|(?<m>@[A-Za-z0-9_.]{2,32})/g;

const BRACE_HEAD = /^\{\{([a-z0-9,-]+)\|/;
// finds {{keys|text}} groups, including groups nested inside each other
function findBrace(text: string, from: number) {
	let idx = text.indexOf("{{", from);
	while (idx !== -1) {
		const hm = text.slice(idx, idx + 80).match(BRACE_HEAD);
		if (hm) {
			let depth = 1;
			let j = idx + hm[0].length;
			while (j < text.length) {
				if (text.startsWith("{{", j)) { depth++; j += 2; }
				else if (text.startsWith("}}", j)) {
					depth--;
					if (depth === 0) return { start: idx, end: j + 2, keys: hm[1], inner: text.slice(idx + hm[0].length, j) };
					j += 2;
				} else j++;
			}
		}
		idx = text.indexOf("{{", idx + 2);
	}
	return null;
}

export function tokenize(text: string): Tok[] {
	const out: Tok[] = [];
	let i = 0;
	const re = new RegExp(INLINE.source, "g");
	while (i < text.length) {
		const bm = findBrace(text, i);
		re.lastIndex = i;
		const m = re.exec(text);
		if (bm && (!m || bm.start <= m.index)) {
			if (bm.start > i) out.push({ k: "t", v: text.slice(i, bm.start) });
			let node: Tok[] = tokenize(bm.inner);
			for (const key of bm.keys.split(",").filter(Boolean).reverse()) {
				if (key.startsWith("hl-") && HL[key.slice(3)]) node = [{ k: "h", color: key.slice(3), c: node }];
				else if (FONT_STACK[key]) node = [{ k: "f", f: key, c: node }];
			}
			out.push(...node);
			i = bm.end;
			continue;
		}
		if (!m) { out.push({ k: "t", v: text.slice(i) }); break; }
		const g: any = m.groups ?? {};
		if (m.index > i) out.push({ k: "t", v: text.slice(i, m.index) });
		if (g.lu) out.push({ k: "a", c: tokenize(g.ll), url: g.lu });
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
		i = m.index + m[0].length;
	}
	return out;
}

// ---------- blocks ----------
const BULLET_RE = /^([•○■□✓✔→➤★✦◆▶❖])\s+(.*)$/;
const ROMAN = "(?:xx|xix|xviii|xvii|xvi|xv|xiv|xiii|xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)";
function matchOl(line: string): { style: string; text: string } | null {
	let m = line.match(/^\d+[.)]\s+(.*)$/);
	if (m) return { style: "1", text: m[1] };
	m = line.match(/^[a-z]\)\s+(.*)$/);
	if (m) return { style: "a", text: m[1] };
	m = line.match(/^[A-Z]\)\s+(.*)$/);
	if (m) return { style: "A", text: m[1] };
	m = line.match(new RegExp(`^${ROMAN}\\.\\s+(.*)$`));
	if (m) return { style: "i", text: m[1] };
	m = line.match(new RegExp(`^${ROMAN.toUpperCase()}\\.\\s+(.*)$`));
	if (m) return { style: "I", text: m[1] };
	return null;
}

export function parseBlocks(src: string): Block[] {
	const lines = String(src ?? "").replace(/\r/g, "").split("\n");
	const out: Block[] = [];
	let align: Align = "left";
	let para: string[] = [];
	let list: { kind: "ul" | "ol"; key: string; items: string[]; bullet?: string; style?: string } | null = null;
	const flushPara = () => {
		if (para.length) {
			out.push({ t: "p", align, text: para.join("\n") });
			para = [];
		}
	};
	const flushList = () => {
		if (list) {
			out.push(
				list.kind === "ul"
					? { t: "ul", align, items: list.items, bullet: list.bullet }
					: { t: "ol", align, items: list.items, style: list.style },
			);
			list = null;
		}
	};
	for (const raw of lines) {
		const line = raw.trimEnd();
		const fence = line.match(/^:::(left|center|right)?\s*$/);
		if (fence) {
			flushPara(); flushList();
			align = (fence[1] as Align) ?? "left";
			continue;
		}
		if (line.trim() === "") { flushPara(); flushList(); continue; }
		const solo = line.trim();
		const yt = youtubeId(solo);
		if (yt) { flushPara(); flushList(); out.push({ t: "yt", id: yt }); continue; }
		if (/^https?:\/\/\S+$/.test(solo) && isImageUrl(solo)) { flushPara(); flushList(); out.push({ t: "img", url: solo }); continue; }
		const h = line.match(/^(#{1,3})\s+(.*)$/);
		if (h) { flushPara(); flushList(); out.push({ t: "h", align, level: h[1].length as 1 | 2 | 3, text: h[2] }); continue; }
		const ulc = line.match(BULLET_RE);
		const ul = line.match(/^-\s+(.*)$/);
		const olm = matchOl(line);
		if (ulc || ul || olm) {
			flushPara();
			const kind: "ul" | "ol" = ulc || ul ? "ul" : "ol";
			const key = ulc ? `ul:${ulc[1]}` : ul ? "ul:-" : `ol:${olm.style}`;
			if (list && list.key !== key) flushList();
			if (!list) list = { kind, key, items: [], bullet: ulc ? ulc[1] : undefined, style: olm && kind === "ol" ? olm.style : undefined };
			list.items.push(ulc ? ulc[2] : ul ? ul[1] : olm.text);
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
	h: (c: string, s: string) => string;
	a: (label: string, url: string) => string; m: (s: string) => string;
};
type BFmt = {
	p: (s: string, a: Align) => string; h: (s: string, l: number, a: Align) => string;
	ul: (items: string[], a: Align, bullet?: string) => string;
	ol: (items: string[], a: Align, style?: string) => string;
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
		else if (x.k === "h") out += f.h(x.color, walk(x.c, f));
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
		else if (x.t === "ul") parts.push(b.ul(x.items.map((i) => walk(tokenize(i), f)), x.align, x.bullet));
		else if (x.t === "ol") parts.push(b.ol(x.items.map((i) => walk(tokenize(i), f)), x.align, x.style));
		else if (x.t === "yt") parts.push(b.yt(x.id));
		else parts.push(b.img(x.url));
	}
	return parts.filter(Boolean).join(b.join);
}

const same = (s: string) => s;
const keep = (_k: string, s: string) => s;
const keepH = (_c: string, s: string) => s;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function roman(n: number) {
	const t: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
	let out = "";
	for (const [v, s] of t) while (n >= v) { out += s; n -= v; }
	return out || "I";
}
export function olLabel(style: string | undefined, n: number) {
	if (style === "a" || style === "A") return `${String.fromCharCode((style === "a" ? 97 : 65) + ((n - 1) % 26))})`;
	if (style === "i") return `${roman(n).toLowerCase()}.`;
	if (style === "I") return `${roman(n)}.`;
	return `${n}.`;
}
const bulletsOf = (items: string[], _a: Align, bullet?: string) => items.map((i) => `${bullet || "•"} ${i}`).join("\n");
const numbersOf = (items: string[], _a: Align, style?: string) => items.map((i, n) => `${olLabel(style, n + 1)} ${i}`).join("\n");

const PLAIN_F: Fmt = { t: same, b: same, i: same, u: same, s: same, f: keep, h: keepH, a: (l) => l, m: same };
const PLAIN_B: BFmt = { p: same, h: same, ul: (i) => i.join(" "), ol: (i) => i.join(" "), yt: () => "", img: () => "", join: " " };

const HTML_F: Fmt = {
	t: esc, b: (s) => `<strong>${s}</strong>`, i: (s) => `<em>${s}</em>`, u: (s) => `<u>${s}</u>`, s: (s) => `<s>${s}</s>`,
	f: (k, s) => `<span style="font-family:${FONT_STACK[k]}">${s}</span>`,
	h: (c, s) => `<span style="background:${HL[c]};color:#111;padding:0 3px;border-radius:3px">${s}</span>`,
	a: (l, u) => `<a href="${esc(u)}" style="color:#ff5a1f">${l}</a>`, m: (s) => `<strong>${esc(s)}</strong>`,
};
const listStyleAttr = (bullet?: string) => (bullet ? `;list-style-type:'${bullet}  '` : "");
const HTML_B: BFmt = {
	p: (s, a) => `<p style="margin:0 0 12px;white-space:pre-wrap;text-align:${a}">${s}</p>`,
	h: (s, l, a) => `<h${l} style="margin:16px 0 8px;text-align:${a}">${s}</h${l}>`,
	ul: (items, a, bullet) => `<ul style="margin:0 0 12px;padding-left:22px;text-align:${a}${listStyleAttr(bullet)}">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`,
	ol: (items, a, style) => `<ol${style && style !== "1" ? ` type="${style}"` : ""} style="margin:0 0 12px;padding-left:22px;text-align:${a}${style && style !== "1" ? `;list-style-type:${LIST_TYPE_CSS[style]}` : ""}">${items.map((i) => `<li>${i}</li>`).join("")}</ol>`,
	yt: (id) => `<p style="margin:0 0 12px"><a href="https://youtu.be/${id}" style="color:#ff5a1f">Watch on YouTube</a></p>`,
	img: (u) => `<img src="${esc(u)}" alt="" style="max-width:100%;border-radius:12px;display:block;margin:12px 0">`,
	join: "",
};

const TG_F: Fmt = {
	t: esc, b: (s) => `<b>${s}</b>`, i: (s) => `<i>${s}</i>`, u: (s) => `<u>${s}</u>`, s: (s) => `<s>${s}</s>`,
	f: keep, h: keepH, a: (l, u) => `<a href="${esc(u)}">${l}</a>`, m: esc,
};
const TG_B: BFmt = { p: same, h: (s) => `<b>${s}</b>`, ul: bulletsOf, ol: numbersOf, yt: (id) => `https://youtu.be/${id}`, img: () => "", join: "\n\n" };

const MD_F: Fmt = {
	t: same, b: (s) => `**${s}**`, i: (s) => `*${s}*`, u: (s) => `__${s}__`, s: (s) => `~~${s}~~`,
	f: keep, h: keepH, a: (l, u) => `[${l}](${u})`, m: same,
};
const DISCORD_B: BFmt = { p: same, h: (s) => `**${s}**`, ul: bulletsOf, ol: numbersOf, yt: (id) => `https://youtu.be/${id}`, img: () => "", join: "\n\n" };
const WHOP_F: Fmt = { ...MD_F, u: same };
const WHOP_B: BFmt = {
	p: same, h: (s, l) => `${"#".repeat(l)} ${s}`,
	ul: (items, _a, bullet) => items.map((x) => `${bullet || "-"} ${x}`).join("\n"),
	ol: numbersOf,
	yt: (id) => `https://youtu.be/${id}`, img: (u) => `![](${u})`, join: "\n\n",
};

const ED_F: Fmt = {
	t: esc, b: (s) => `<b>${s}</b>`, i: (s) => `<i>${s}</i>`, u: (s) => `<u>${s}</u>`, s: (s) => `<s>${s}</s>`,
	f: (k, s) => `<span data-font="${k}" style="font-family:${FONT_STACK[k]}">${s}</span>`,
	h: (c, s) => `<span data-hl="${c}" style="background-color:${HL[c]};color:#111">${s}</span>`,
	a: (l, u) => `<a href="${esc(u)}">${l}</a>`, m: esc,
};
const ED_B: BFmt = {
	p: (s, a) => `<p style="text-align:${a}">${s.replace(/\n/g, "<br>")}</p>`,
	h: (s, l, a) => `<h${l} style="text-align:${a}">${s}</h${l}>`,
	ul: (items, a, bullet) => `<ul${bullet ? ` data-bullet="${bullet}"` : ""} style="text-align:${a}${listStyleAttr(bullet)}">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`,
	ol: (items, a, style) => `<ol${style && style !== "1" ? ` type="${style}"` : ""} style="text-align:${a}${style && style !== "1" ? `;list-style-type:${LIST_TYPE_CSS[style]}` : ""}">${items.map((i) => `<li>${i}</li>`).join("")}</ol>`,
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