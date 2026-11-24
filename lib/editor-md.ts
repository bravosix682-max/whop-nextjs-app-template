// @ts-nocheck
import { HL } from "./markup";

export const FACE_OF: Record<string, string> = {
	"": "Space Grotesk", serif: "Georgia", playfair: "Playfair Display", merriweather: "Merriweather", lora: "Lora",
	poppins: "Poppins", montserrat: "Montserrat", rounded: "Trebuchet MS", oswald: "Oswald", bebas: "Bebas Neue",
	anton: "Anton", display: "Impact", righteous: "Righteous", bangers: "Bangers", orbitron: "Orbitron",
	pixel: "Silkscreen", mono: "Courier New", jetbrains: "JetBrains Mono", pacifico: "Pacifico", lobster: "Lobster",
	dancing: "Dancing Script", caveat: "Caveat", marker: "Permanent Marker", hand: "Comic Sans MS",
};

const FACES: [string, string][] = [
	["playfair", "playfair"], ["merriweather", "merriweather"], ["lora", "lora"], ["poppins", "poppins"],
	["montserrat", "montserrat"], ["trebuchet", "rounded"], ["oswald", "oswald"], ["bebas", "bebas"], ["anton", "anton"],
	["impact", "display"], ["arial black", "display"], ["righteous", "righteous"], ["bangers", "bangers"],
	["orbitron", "orbitron"], ["silkscreen", "pixel"], ["jetbrains", "jetbrains"], ["courier", "mono"],
	["menlo", "mono"], ["consolas", "mono"], ["monospace", "mono"], ["pacifico", "pacifico"], ["lobster", "lobster"],
	["dancing", "dancing"], ["caveat", "caveat"], ["permanent marker", "marker"], ["comic", "hand"],
	["segoe print", "hand"], ["georgia", "serif"], ["times", "serif"],
];

export function fontKey(face: string) {
	const f = String(face || "").toLowerCase();
	for (const [n, k] of FACES) if (f.includes(n)) return k;
	return "";
}

function hlFromColor(c: string) {
	const s = String(c || "").trim().toLowerCase();
	if (!s || s === "transparent") return "";
	const m = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)/);
	if (!m) return "";
	if (m[4] !== undefined && parseFloat(m[4]) === 0) return "";
	const rgb = [+m[1], +m[2], +m[3]];
	let best = "";
	let bd = 1e9;
	for (const [k, hex] of Object.entries(HL)) {
		const hv = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
		const d = (hv[0] - rgb[0]) ** 2 + (hv[1] - rgb[1]) ** 2 + (hv[2] - rgb[2]) ** 2;
		if (d < bd) { bd = d; best = k; }
	}
	return bd < 8000 ? best : "";
}

function wrapMark(m: string, inner: string) {
	return inner
		.split("\n")
		.map((seg) => {
			const lead = seg.match(/^\s*/)[0];
			const trail = seg.match(/\s*$/)[0];
			const core = seg.trim();
			return core ? `${lead}${m}${core}${m}${trail}` : seg;
		})
		.join("\n");
}

function inl(node: Node): string {
	if (node.nodeType === 3) return node.nodeValue ?? "";
	if (node.nodeType !== 1) return "";
	const el = node as HTMLElement;
	const tag = el.tagName;
	if (tag === "BR") return "\n";
	let inner = Array.from(el.childNodes).map(inl).join("");
	const st = el.style;
	if (tag === "A") {
		const href = el.getAttribute("href") || "";
		return /^https?:\/\//i.test(href) && inner.trim() ? `[${inner.replace(/[\[\]]/g, "")}](${href})` : inner;
	}
	const fk = el.getAttribute("data-font") || (tag === "FONT" ? fontKey(el.getAttribute("face")) : fontKey(st.fontFamily));
	const dh = el.getAttribute("data-hl");
	const hk = dh && HL[dh] ? dh : hlFromColor(st.backgroundColor);
	const keys = [fk, hk ? `hl-${hk}` : ""].filter(Boolean).join(",");
	if (keys && inner.trim()) inner = `{{${keys}|${inner}}}`;
	const deco = `${st.textDecoration || ""} ${st.textDecorationLine || ""}`;
	if (tag === "B" || tag === "STRONG" || st.fontWeight === "bold" || Number(st.fontWeight) >= 600) inner = wrapMark("**", inner);
	if (tag === "I" || tag === "EM" || st.fontStyle === "italic") inner = wrapMark("*", inner);
	if (tag === "U" || /underline/.test(deco)) inner = wrapMark("__", inner);
	if (tag === "S" || tag === "STRIKE" || tag === "DEL" || /line-through/.test(deco)) inner = wrapMark("~~", inner);
	return inner;
}

const BLOCK = new Set(["P", "DIV", "H1", "H2", "H3", "UL", "OL", "BLOCKQUOTE", "LI"]);
const alignOf = (el: HTMLElement) => {
	const a = el.style?.textAlign || el.getAttribute("align") || "";
	return a === "center" || a === "right" ? a : "";
};
const fence = (a: string, s: string) => (a ? `:::${a}\n${s}\n:::` : s);

function romanOf(n: number) {
	const t: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
	let out = "";
	for (const [v, s] of t) while (n >= v) { out += s; n -= v; }
	return out || "I";
}
function marker(type: string, n: number) {
	if (type === "a") return `${String.fromCharCode(97 + ((n - 1) % 26))}) `;
	if (type === "A") return `${String.fromCharCode(65 + ((n - 1) % 26))}) `;
	if (type === "i") return `${romanOf(n).toLowerCase()}. `;
	if (type === "I") return `${romanOf(n)}. `;
	return `${n}. `;
}
function bulletOf(el: HTMLElement) {
	const d = el.getAttribute("data-bullet");
	if (d && d.length <= 2) return d;
	const v = String(el.style.listStyleType || "").replace(/["'\s]/g, "");
	return v && v.length <= 2 && !/^(disc|circle|square|none)$/.test(v) ? v : "";
}

export function htmlToMarkup(root: HTMLElement): string {
	const parts: string[] = [];
	let run = "";
	const flush = () => {
		if (run.trim()) parts.push(run.trim());
		run = "";
	};
	const child = (n: Node) => {
		if (n.nodeType === 1 && BLOCK.has((n as HTMLElement).tagName)) {
			flush();
			block(n as HTMLElement);
		} else run += inl(n);
	};
	const block = (el: HTMLElement) => {
		const tag = el.tagName;
		const a = alignOf(el);
		if (tag === "UL" || tag === "OL") {
			const bullet = tag === "UL" ? bulletOf(el) : "";
			const type = tag === "OL" ? el.getAttribute("type") || "1" : "1";
			const items = Array.from(el.children)
				.filter((c) => c.tagName === "LI")
				.map((li, i) => `${tag === "UL" ? (bullet ? `${bullet} ` : "- ") : marker(type, i + 1)}${inl(li).replace(/\n+/g, " ").trim()}`);
			if (items.length) parts.push(fence(a, items.join("\n")));
		} else if (tag === "H1" || tag === "H2" || tag === "H3") {
			const t = inl(el).replace(/\n+/g, " ").trim();
			if (t) parts.push(fence(a, `${"#".repeat(Number(tag[1]))} ${t}`));
		} else if (Array.from(el.children).some((c) => BLOCK.has(c.tagName))) {
			for (const c of Array.from(el.childNodes)) child(c);
			flush();
		} else {
			const t = inl(el).trim();
			if (t) parts.push(fence(a, t));
		}
	};
	for (const n of Array.from(root.childNodes)) child(n);
	flush();
	return parts.join("\n\n");
}