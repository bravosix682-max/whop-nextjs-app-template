// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import { FACE_OF, fontKey, htmlToMarkup } from "@/lib/editor-md";
import {
	ALLOWED_ACCEPT,
	BULLET_CHOICES,
	FONT_LABELS,
	FONT_STACK,
	formatSize,
	HL,
	kindOf,
	LIST_TYPE_CSS,
	NUM_STYLES,
	toEditorHtml,
	youtubeId,
} from "@/lib/markup";
import { Icon } from "./icons";

const EMOJI =
	"😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😎 🤩 🥳 😏 🤔 😮 😢 😭 😡 🤯 😴 🙏 👍 👎 👏 🙌 💪 🤝 👀 🔥 ✨ 🎉 🎊 🏆 🥇 🚀 💡 📣 📢 📌 📅 ⏰ 💰 💎 ❤️ 🧡 💛 💚 💙 💜 🖤 ✅ ❌ ⚠️ ❗ ❓ ➡️ ⭐ 🌟 🎁 🎯 📈 📉".split(" ");

function HiIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="m9 11-6 6v3h9l3-3" />
			<path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
		</svg>
	);
}

function Tool({ title, icon, on, onClick, children }: any) {
	return (
		<button type="button" className={`an-tool${on ? " on" : ""}`} title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
			{children ?? <Icon name={icon} size={16} />}
		</button>
	);
}

function Pop({ onClose, children, wide, cls }: any) {
	return (
		<>
			<div className="an-backdrop" onClick={onClose} />
			<div className={`an-pop${wide ? " wide" : ""}${cls ? ` ${cls}` : ""}`}>
				<div className="an-sheet-grip" />
				{children}
			</div>
		</>
	);
}

const noBlur = (e: any) => e.preventDefault();

export function RichEditor({ value, onChange, attach, attachMax, attachMb, mentions, prepareUpload, fetchMentionMembers }: any) {
	const box = useRef<HTMLDivElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const last = useRef<string | null>(null);
	const saved = useRef<Range | null>(null);
	const [menu, setMenu] = useState("");
	const [st, setSt] = useState({ b: false, i: false, u: false, s: false, ul: false, ol: false, al: "left", blk: "p", font: "" });
	const [empty, setEmpty] = useState(true);
	const [files, setFiles] = useState<any[]>([]);
	const [busy, setBusy] = useState<string[]>([]);
	const [note, setNote] = useState("");
	const [linkLabel, setLinkLabel] = useState("");
	const [linkUrl, setLinkUrl] = useState("");
	const [ytUrl, setYtUrl] = useState("");
	const [ytError, setYtError] = useState("");
	const [people, setPeople] = useState<any>(null);
	const [q, setQ] = useState("");

	const close = () => setMenu("");
	const toggle = (id: string) => setMenu(menu === id ? "" : id);

	useEffect(() => {
		const el = box.current;
		if (el && value !== last.current) {
			el.innerHTML = toEditorHtml(value);
			last.current = value;
			setEmpty(!String(value).trim());
		}
	}, [value]);

	function refresh() {
		try {
			const qs = (c: string) => document.queryCommandState(c);
			let blk = String(document.queryCommandValue("formatBlock") || "p").toLowerCase().replace(/[<>]/g, "");
			if (!["h1", "h2", "h3"].includes(blk)) blk = "p";
			setSt({
				b: qs("bold"), i: qs("italic"), u: qs("underline"), s: qs("strikeThrough"),
				ul: qs("insertUnorderedList"), ol: qs("insertOrderedList"),
				al: qs("justifyCenter") ? "center" : qs("justifyRight") ? "right" : "left",
				blk, font: fontKey(String(document.queryCommandValue("fontName") || "").replace(/["']/g, "")),
			});
		} catch {}
	}

	useEffect(() => {
		const h = () => {
			const sel = window.getSelection();
			if (sel && sel.rangeCount && box.current?.contains(sel.anchorNode)) {
				saved.current = sel.getRangeAt(0).cloneRange();
				refresh();
			}
		};
		document.addEventListener("selectionchange", h);
		return () => document.removeEventListener("selectionchange", h);
	}, []);

	// a numbered list must not keep bullet styling, and a bullet list must not keep a number type
	function fixLists() {
		const el = box.current;
		if (!el) return;
		el.querySelectorAll("ol").forEach((o: any) => {
			o.removeAttribute("data-bullet");
			if (o.style.listStyleType && /^["']/.test(o.style.listStyleType)) o.style.listStyleType = "";
		});
		el.querySelectorAll("ul").forEach((u: any) => {
			u.removeAttribute("type");
			if (u.style.listStyleType && /alpha|roman|decimal/.test(u.style.listStyleType)) u.style.listStyleType = "";
		});
	}

	function emit() {
		const el = box.current;
		if (!el) return;
		fixLists();
		try {
			const md = htmlToMarkup(el);
			last.current = md;
			setEmpty(!md.trim());
			onChange(md);
		} catch {}
	}

	function restore() {
		const el = box.current;
		if (!el) return;
		el.focus();
		const r = saved.current;
		if (r) {
			const sel = window.getSelection();
			sel?.removeAllRanges();
			sel?.addRange(r);
		}
	}

	// when the caret sits inside a list, treat the whole list as selected so list changes apply to every item
	function expandToList() {
		const root = box.current;
		const sel = window.getSelection();
		if (!root || !sel || !sel.rangeCount || !sel.isCollapsed) return;
		let n: Node | null = sel.anchorNode;
		while (n && n !== root) {
			const tag = n.nodeType === 1 ? (n as HTMLElement).tagName : "";
			if (tag === "UL" || tag === "OL") {
				const r = document.createRange();
				r.selectNodeContents(n);
				sel.removeAllRanges();
				sel.addRange(r);
				return;
			}
			n = n.parentNode;
		}
	}

	function cmd(c: string, v?: string) {
		restore();
		if (c === "insertUnorderedList" || c === "insertOrderedList") expandToList();
		document.execCommand(c, false, v);
		emit();
		refresh();
		close();
	}

	function focusInit() {
		try {
			document.execCommand("styleWithCSS", false, "false");
			document.execCommand("defaultParagraphSeparator", false, "p");
		} catch {}
	}

	function highlight(color: string) {
		restore();
		const r = saved.current;
		if (color && (!r || r.collapsed)) {
			setNote("Select the words you want to highlight first, then pick a color.");
			close();
			return;
		}
		setNote("");
		try {
			document.execCommand("styleWithCSS", false, "true");
			document.execCommand("hiliteColor", false, color ? HL[color] : "transparent");
			document.execCommand("styleWithCSS", false, "false");
		} catch {}
		emit();
		close();
	}

	function listStyle(kind: "ul" | "ol", opt: string) {
		restore();
		expandToList();
		const root = box.current;
		if (!root) return;
		const TAG = kind.toUpperCase();
		const findLists = (): HTMLElement[] => {
			const sel = window.getSelection();
			const out: HTMLElement[] = [];
			let n: Node | null = sel ? sel.anchorNode : null;
			while (n && n !== root) {
				if (n.nodeType === 1 && (n as HTMLElement).tagName === TAG) return [n as HTMLElement];
				n = n.parentNode;
			}
			if (sel && sel.rangeCount) {
				const r = sel.getRangeAt(0);
				root.querySelectorAll(kind).forEach((l: any) => {
					if (r.intersectsNode(l)) out.push(l);
				});
			}
			return out;
		};
		let lists = findLists();
		if (lists.length === 0) {
			document.execCommand(kind === "ul" ? "insertUnorderedList" : "insertOrderedList");
			lists = findLists();
		}
		if (lists.length === 0) {
			close();
			return;
		}
		for (const list of lists) {
			if (kind === "ul") {
				if (opt === "-") {
					list.removeAttribute("data-bullet");
					list.style.listStyleType = "";
				} else {
					list.setAttribute("data-bullet", opt);
					list.style.listStyleType = `"${opt}  "`;
				}
			} else if (opt === "1") {
				list.removeAttribute("type");
				list.style.listStyleType = "";
			} else {
				list.setAttribute("type", opt);
				list.style.listStyleType = LIST_TYPE_CSS[opt];
			}
		}
		emit();
		refresh();
		close();
	}

	function insertHtml(html: string) {
		restore();
		document.execCommand("insertHTML", false, html);
		emit();
		close();
	}

	function addLink() {
		let url = linkUrl.trim();
		if (!url) return;
		if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
		restore();
		const sel = window.getSelection();
		if (sel && !sel.isCollapsed) document.execCommand("createLink", false, url);
		else {
			const safe = (linkLabel.trim() || url).replace(/</g, "&lt;");
			document.execCommand("insertHTML", false, `<a href="${url.replace(/"/g, "")}">${safe}</a>&nbsp;`);
		}
		emit();
		setLinkLabel("");
		setLinkUrl("");
		close();
	}

	function addYoutube() {
		const url = ytUrl.trim();
		if (!youtubeId(url)) {
			setYtError("That is not a YouTube link.");
			return;
		}
		setYtError("");
		setYtUrl("");
		insertHtml(`<p>${url}</p><p><br></p>`);
	}

	async function openMention() {
		if (!mentions) return;
		setMenu("mention");
		if (!people || people.error) {
			setPeople(null);
			setPeople(await fetchMentionMembers());
		}
	}

	async function onFiles(list: FileList | null) {
		if (!list) return;
		setNote("");
		let count = files.length + busy.length;
		for (const file of Array.from(list)) {
			if (count >= attachMax) { setNote(`Your plan allows ${attachMax} attachments per post.`); break; }
			if (!kindOf(file.name)) { setNote(`${file.name}: this file type is not supported.`); continue; }
			if (file.size > attachMb * 1048576) { setNote(`${file.name} is over ${attachMb} MB.`); continue; }
			count += 1;
			setBusy((b) => [...b, file.name]);
			try {
				const prep = await prepareUpload(file.name, file.size);
				if (!prep?.ok) { setNote(prep?.error ?? "Upload could not start."); count -= 1; continue; }
				const res = await fetch(prep.uploadUrl, {
					method: "PUT",
					headers: { "Content-Type": prep.contentType, "x-upsert": "false", ...(prep.apikey ? { apikey: prep.apikey } : {}) },
					body: file,
				});
				if (!res.ok) {
					const t = await res.text().catch(() => "");
					setNote(`Upload failed (${res.status}). ${t.slice(0, 120)}`);
					count -= 1;
					continue;
				}
				setFiles((f) => [...f, { path: prep.path, name: file.name, type: prep.contentType, size: file.size, url: prep.url }]);
			} catch (e) {
				setNote(`Upload failed. ${e instanceof Error ? e.message : ""}`);
				count -= 1;
			} finally {
				setBusy((b) => b.filter((n) => n !== file.name));
			}
		}
		if (fileRef.current) fileRef.current.value = "";
	}

	const plusOpen = ["plus", "link", "yt", "emoji", "mention"].includes(menu);
	const shown = (people?.members ?? []).filter((m: any) => `${m.name} ${m.handle}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40);
	const blockLabel = st.blk === "h1" ? "Heading 1" : st.blk === "h2" ? "Heading 2" : st.blk === "h3" ? "Heading 3" : "Normal text";
	const fontLabel = (FONT_LABELS.find(([k]) => k === st.font) ?? FONT_LABELS[0])[1];

	return (
		<div className="an-editor">
			<div className="an-tools">
				<div className="an-pop-wrap">
					<button type="button" className="an-tool" title="Text style" onMouseDown={noBlur} onClick={() => toggle("style")}>
						<span className="an-tool-label">{blockLabel}</span>
						<Icon name="chevron" size={12} />
					</button>
					{menu === "style" && (
						<Pop onClose={close}>
							<div className="an-list">
								{[["p", "Normal text"], ["h1", "Heading 1"], ["h2", "Heading 2"], ["h3", "Heading 3"]].map(([k, label]) => (
									<button key={k} type="button" className={`an-list-item${st.blk === k ? " on" : ""}`} onMouseDown={noBlur} onClick={() => cmd("formatBlock", `<${k}>`)}>
										{label}
									</button>
								))}
							</div>
						</Pop>
					)}
				</div>
				<div className="an-pop-wrap">
					<button type="button" className="an-tool" title="Font" onMouseDown={noBlur} onClick={() => toggle("font")}>
						<span className="an-tool-label">{fontLabel}</span>
						<Icon name="chevron" size={12} />
					</button>
					{menu === "font" && (
						<Pop onClose={close} wide cls="an-font-pop">
							<div className="an-list">
								{FONT_LABELS.map(([k, label]) => (
									<button
										key={k || "default"}
										type="button"
										className={`an-list-item an-font-item${st.font === k ? " on" : ""}`}
										style={{ fontFamily: FONT_STACK[k] || undefined }}
										onMouseDown={noBlur}
										onClick={() => cmd("fontName", FACE_OF[k])}
									>
										{label}
									</button>
								))}
							</div>
						</Pop>
					)}
				</div>
				<span className="an-tool-sep" />
				<Tool title="Bold (Ctrl+B)" icon="bold" on={st.b} onClick={() => cmd("bold")} />
				<Tool title="Italic (Ctrl+I)" icon="italic" on={st.i} onClick={() => cmd("italic")} />
				<Tool title="Underline (Ctrl+U)" icon="underline" on={st.u} onClick={() => cmd("underline")} />
				<Tool title="Strikethrough" icon="strike" on={st.s} onClick={() => cmd("strikeThrough")} />
				<div className="an-pop-wrap">
					<button type="button" className="an-tool" title="Highlight text" onMouseDown={noBlur} onClick={() => toggle("hl")}>
						<HiIcon />
						<Icon name="chevron" size={12} />
					</button>
					{menu === "hl" && (
						<Pop onClose={close}>
							<div className="an-hl-grid">
								{Object.entries(HL).map(([k, hex]) => (
									<button key={k} type="button" className="an-hl-sw" title={k} style={{ background: hex as string }} onMouseDown={noBlur} onClick={() => highlight(k)} />
								))}
							</div>
							<button type="button" className="an-list-item" onMouseDown={noBlur} onClick={() => highlight("")}>
								No highlight
							</button>
						</Pop>
					)}
				</div>
				<span className="an-tool-sep" />
				<div className="an-pop-wrap">
					<button type="button" className={`an-tool${st.ul || st.ol ? " on" : ""}`} title="Lists" onMouseDown={noBlur} onClick={() => toggle("list")}>
						<Icon name={st.ol ? "listOrdered" : "list"} size={16} />
						<Icon name="chevron" size={12} />
					</button>
					{menu === "list" && (
						<Pop onClose={close} wide>
							<div className="an-list">
								<button type="button" className={`an-list-item${st.ul ? " on" : ""}`} onMouseDown={noBlur} onClick={() => cmd("insertUnorderedList")}>Bulleted list</button>
								<div className="an-list-head">Bullet style</div>
								<div className="an-style-row">
									{["-", ...BULLET_CHOICES].map((ch) => (
										<button key={ch} type="button" className="an-style-chip" onMouseDown={noBlur} onClick={() => listStyle("ul", ch)}>
											{ch === "-" ? "•" : ch}
										</button>
									))}
								</div>
								<button type="button" className={`an-list-item${st.ol ? " on" : ""}`} onMouseDown={noBlur} onClick={() => cmd("insertOrderedList")}>Numbered list</button>
								<div className="an-list-head">Number style</div>
								<div className="an-style-row">
									{NUM_STYLES.map(([v, label]) => (
										<button key={v} type="button" className="an-style-chip wide" onMouseDown={noBlur} onClick={() => listStyle("ol", v)}>
											{label}
										</button>
									))}
								</div>
							</div>
						</Pop>
					)}
				</div>
				<div className="an-pop-wrap">
					<button type="button" className="an-tool" title="Alignment" onMouseDown={noBlur} onClick={() => toggle("align")}>
						<Icon name={st.al === "center" ? "alignCenter" : st.al === "right" ? "alignRight" : "alignLeft"} size={16} />
						<Icon name="chevron" size={12} />
					</button>
					{menu === "align" && (
						<Pop onClose={close}>
							<div className="an-list">
								{[["left", "justifyLeft", "Align left"], ["center", "justifyCenter", "Center"], ["right", "justifyRight", "Align right"]].map(([k, c, label]) => (
									<button key={k} type="button" className={`an-list-item${st.al === k ? " on" : ""}`} onMouseDown={noBlur} onClick={() => cmd(c)}>
										{label}
									</button>
								))}
							</div>
						</Pop>
					)}
				</div>
				<span className="an-tool-sep" />
				{attach && <Tool title="Attach image, video, or file" icon="paperclip" onClick={() => fileRef.current?.click()} />}
				<div className="an-pop-wrap">
					<button type="button" className="an-tool" title="Insert" onMouseDown={noBlur} onClick={() => toggle("plus")}>
						<Icon name="plus" size={16} />
					</button>
					{plusOpen && (
						<Pop wide onClose={close}>
							{menu === "plus" && (
								<div className="an-list">
									<button type="button" className="an-list-item an-item-icon" onClick={() => setMenu("link")}><Icon name="link" size={16} /> Link</button>
									<button type="button" className="an-list-item an-item-icon" onClick={() => setMenu("yt")}><Icon name="play" size={16} /> YouTube preview</button>
									<button type="button" className="an-list-item an-item-icon" onClick={() => setMenu("emoji")}><Icon name="smile" size={16} /> Emoji</button>
									<button type="button" className="an-list-item an-item-icon" disabled={!mentions} onClick={openMention}>
										<Icon name="atSign" size={16} /> Mention member
										{!mentions && <span className="an-badge"><Icon name="lock" size={11} /> Business</span>}
									</button>
								</div>
							)}
							{menu === "link" && (
								<div className="an-stack">
									<input className="an-input" placeholder="Text to show (optional)" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
									<input className="an-input" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
									<div className="an-row">
										<button type="button" className="an-link-btn" onClick={() => setMenu("plus")}>Back</button>
										<button type="button" className="an-btn" onClick={addLink}>Insert link</button>
									</div>
								</div>
							)}
							{menu === "yt" && (
								<div className="an-stack">
									<input className="an-input" placeholder="Paste a YouTube link" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} />
									{ytError ? <p className="an-error">{ytError}</p> : null}
									<p className="an-muted">Members see a video they can play inside the post.</p>
									<div className="an-row">
										<button type="button" className="an-link-btn" onClick={() => setMenu("plus")}>Back</button>
										<button type="button" className="an-btn" onClick={addYoutube}>Insert video</button>
									</div>
								</div>
							)}
							{menu === "emoji" && (
								<div className="an-stack">
									<div className="an-emoji-grid">
										{EMOJI.map((em) => (
											<button key={em} type="button" onClick={() => { restore(); document.execCommand("insertText", false, em); emit(); close(); }}>{em}</button>
										))}
									</div>
									<button type="button" className="an-link-btn" onClick={() => setMenu("plus")}>Back</button>
								</div>
							)}
							{menu === "mention" && (
								<div className="an-stack">
									<input className="an-input" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
									{people === null ? (
										<p className="an-muted">Loading members...</p>
									) : people.error ? (
										<p className="an-error">{people.error}</p>
									) : shown.length === 0 ? (
										<p className="an-muted">No members found.</p>
									) : (
										<div className="an-list an-scroll">
											{shown.map((m: any) => (
												<button key={m.id} type="button" className="an-list-item" onClick={() => { restore(); document.execCommand("insertText", false, `@${m.handle || m.name} `); emit(); close(); }}>
													{m.name || m.handle}
													{m.handle ? <span className="an-muted"> @{m.handle}</span> : null}
												</button>
											))}
										</div>
									)}
									<button type="button" className="an-link-btn" onClick={() => setMenu("plus")}>Back</button>
								</div>
							)}
						</Pop>
					)}
				</div>
			</div>

			<div
				ref={box}
				className="an-input an-wys"
				contentEditable
				suppressContentEditableWarning
				role="textbox"
				aria-multiline="true"
				data-ph="What do you want your members to know?"
				data-empty={empty ? "true" : "false"}
				onFocus={focusInit}
				onInput={() => { emit(); refresh(); }}
				onKeyUp={refresh}
				onMouseUp={refresh}
				onPaste={(e) => {
					e.preventDefault();
					const text = e.clipboardData.getData("text/plain");
					document.execCommand("insertText", false, text);
				}}
			/>
			<input type="hidden" name="body" value={value} />

			{attach && (
				<>
					<input ref={fileRef} type="file" multiple hidden accept={ALLOWED_ACCEPT} onChange={(e) => onFiles(e.target.files)} />
					<input type="hidden" name="attachments" value={JSON.stringify(files.map(({ url, ...a }) => a))} />
					<input type="hidden" name="uploading" value={busy.length > 0 ? "1" : ""} />
					{(files.length > 0 || busy.length > 0) && (
						<div className="an-attach-list">
							{files.map((f) => (
								<div className="an-attach" key={f.path}>
									{kindOf(f.name) === "image" ? <img src={f.url} alt="" /> : <Icon name={kindOf(f.name) === "video" ? "film" : "file"} size={18} />}
									<span className="an-attach-name">{f.name}</span>
									<span className="an-muted">{formatSize(f.size)}</span>
									<button type="button" className="an-icon-btn" title="Remove" onClick={() => setFiles((l) => l.filter((x) => x.path !== f.path))}>
										<Icon name="x" size={14} />
									</button>
								</div>
							))}
							{busy.map((n) => (
								<div className="an-attach" key={n}><span className="an-muted">Uploading {n}...</span></div>
							))}
						</div>
					)}
				</>
			)}
			{note ? <p className="an-error">{note}</p> : null}
			{attach && (
				<p className="an-muted">{files.length}/{attachMax} attachments · images, video and files up to {attachMb} MB each</p>
			)}
		</div>
	);
}