// @ts-nocheck
"use client";

import { useRef, useState } from "react";
import { ALLOWED_ACCEPT, formatSize, kindOf, youtubeId } from "@/lib/markup";
import { Icon } from "./icons";

const EMOJI =
	"😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😎 🤩 🥳 😏 🤔 😮 😢 😭 😡 🤯 😴 🙏 👍 👎 👏 🙌 💪 🤝 👀 🔥 ✨ 🎉 🎊 🏆 🥇 🚀 💡 📣 📢 📌 📅 ⏰ 💰 💎 ❤️ 🧡 💛 💚 💙 💜 🖤 ✅ ❌ ⚠️ ❗ ❓ ➡️ ⭐ 🌟 🎁 🎯 📈 📉".split(
		" ",
	);

function Tool({ title, icon, onClick }: any) {
	return (
		<button type="button" className="an-tool" title={title} onClick={onClick}>
			<Icon name={icon} size={16} />
		</button>
	);
}

function Pop({ onClose, children, wide }: any) {
	return (
		<>
			<div className="an-backdrop" onClick={onClose} />
			<div className={`an-pop${wide ? " wide" : ""}`}>
				<div className="an-sheet-grip" />
				{children}
			</div>
		</>
	);
}

export function RichEditor({
	value,
	onChange,
	attach,
	attachMax,
	attachMb,
	mentions,
	prepareUpload,
	fetchMentionMembers,
}: any) {
	const ref = useRef<HTMLTextAreaElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const [menu, setMenu] = useState("");
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

	function range() {
		const ta = ref.current;
		return {
			s: ta ? ta.selectionStart : value.length,
			e: ta ? ta.selectionEnd : value.length,
		};
	}

	function put(next: string, a: number, b: number) {
		onChange(next);
		requestAnimationFrame(() => {
			const ta = ref.current;
			if (ta) {
				ta.focus();
				ta.setSelectionRange(a, b);
			}
		});
	}

	function wrap(before: string, after: string, ph = "text") {
		const { s, e } = range();
		const chosen = value.slice(s, e) || ph;
		put(
			value.slice(0, s) + before + chosen + after + value.slice(e),
			s + before.length,
			s + before.length + chosen.length,
		);
	}

	function lineSpan() {
		const { s, e } = range();
		const from = s === 0 ? 0 : value.lastIndexOf("\n", s - 1) + 1;
		let to = value.indexOf("\n", e);
		if (to === -1) to = value.length;
		return { from, to };
	}

	function lines(fn: (l: string, i: number) => string) {
		const { from, to } = lineSpan();
		const block = value.slice(from, to).split("\n").map(fn).join("\n");
		put(value.slice(0, from) + block + value.slice(to), from, from + block.length);
	}

	function heading(level: number) {
		lines((t) => {
			const bare = t.replace(/^#{1,3}\s+/, "");
			return level ? `${"#".repeat(level)} ${bare}` : bare;
		});
		close();
	}

	function list(kind: string) {
		lines((t, i) => {
			const bare = t.replace(/^(?:-\s+|\d+[.)]\s+)/, "");
			return kind === "ul" ? `- ${bare}` : `${i + 1}. ${bare}`;
		});
		close();
	}

	function align(a: string) {
		const { from, to } = lineSpan();
		const chunk = value.slice(from, to);
		const block = a === "left" ? chunk : `:::${a}\n${chunk}\n:::`;
		put(value.slice(0, from) + block + value.slice(to), from, from + block.length);
		close();
	}

	function insert(text: string) {
		const { s, e } = range();
		put(value.slice(0, s) + text + value.slice(e), s + text.length, s + text.length);
		close();
	}

	function addLink() {
		let url = linkUrl.trim();
		if (!url) return;
		if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
		const { s, e } = range();
		const label = linkLabel.trim() || value.slice(s, e) || url;
		insert(`[${label}](${url})`);
		setLinkLabel("");
		setLinkUrl("");
	}

	function addYoutube() {
		const url = ytUrl.trim();
		if (!youtubeId(url)) {
			setYtError("That is not a YouTube link.");
			return;
		}
		setYtError("");
		setYtUrl("");
		insert(`\n\n${url}\n\n`);
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
			if (count >= attachMax) {
				setNote(`Your plan allows ${attachMax} attachments per post.`);
				break;
			}
			if (!kindOf(file.name)) {
				setNote(`${file.name}: this file type is not supported.`);
				continue;
			}
			if (file.size > attachMb * 1048576) {
				setNote(`${file.name} is over ${attachMb} MB.`);
				continue;
			}
			count += 1;
			setBusy((b) => [...b, file.name]);
			try {
				const prep = await prepareUpload(file.name, file.size);
				if (!prep?.ok) {
					setNote(prep?.error ?? "Upload could not start.");
					count -= 1;
					continue;
				}
				const res = await fetch(prep.uploadUrl, {
					method: "PUT",
					headers: {
						"Content-Type": prep.contentType,
						"x-upsert": "false",
						...(prep.apikey ? { apikey: prep.apikey } : {}),
					},
					body: file,
				});
				if (!res.ok) {
					const t = await res.text().catch(() => "");
					setNote(`Upload failed (${res.status}). ${t.slice(0, 120)}`);
					count -= 1;
					continue;
				}
				setFiles((f) => [
					...f,
					{
						path: prep.path,
						name: file.name,
						type: prep.contentType,
						size: file.size,
						url: prep.url,
					},
				]);
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
	const shown = (people?.members ?? [])
		.filter((m: any) =>
			`${m.name} ${m.handle}`.toLowerCase().includes(q.trim().toLowerCase()),
		)
		.slice(0, 40);

	return (
		<div className="an-editor">
			<div className="an-tools">
				<div className="an-pop-wrap">
					<button type="button" className="an-tool" title="Text style" onClick={() => toggle("style")}>
						<Icon name="type" size={16} />
						<Icon name="chevron" size={12} />
					</button>
					{menu === "style" && (
						<Pop onClose={close}>
							<div className="an-list">
								{[
									[0, "Normal text"],
									[1, "Heading 1"],
									[2, "Heading 2"],
									[3, "Heading 3"],
								].map(([l, label]: any) => (
									<button key={l} type="button" className="an-list-item" onClick={() => heading(l)}>
										{label}
									</button>
								))}
							</div>
						</Pop>
					)}
				</div>
				<span className="an-tool-sep" />
				<Tool title="Bold" icon="bold" onClick={() => wrap("**", "**")} />
				<Tool title="Italic" icon="italic" onClick={() => wrap("*", "*")} />
				<Tool title="Underline" icon="underline" onClick={() => wrap("__", "__")} />
				<Tool title="Strikethrough" icon="strike" onClick={() => wrap("~~", "~~")} />
				<span className="an-tool-sep" />
				<div className="an-pop-wrap">
					<button type="button" className="an-tool" title="Lists" onClick={() => toggle("list")}>
						<Icon name="list" size={16} />
						<Icon name="chevron" size={12} />
					</button>
					{menu === "list" && (
						<Pop onClose={close}>
							<div className="an-list">
								<button type="button" className="an-list-item" onClick={() => list("ul")}>
									Bulleted list
								</button>
								<button type="button" className="an-list-item" onClick={() => list("ol")}>
									Numbered list
								</button>
							</div>
						</Pop>
					)}
				</div>
				<div className="an-pop-wrap">
					<button type="button" className="an-tool" title="Alignment" onClick={() => toggle("align")}>
						<Icon name="alignLeft" size={16} />
						<Icon name="chevron" size={12} />
					</button>
					{menu === "align" && (
						<Pop onClose={close}>
							<div className="an-list">
								{[
									["left", "Align left"],
									["center", "Center"],
									["right", "Align right"],
								].map(([a, label]) => (
									<button key={a} type="button" className="an-list-item" onClick={() => align(a)}>
										{label}
									</button>
								))}
							</div>
						</Pop>
					)}
				</div>
				<span className="an-tool-sep" />
				{attach && (
					<Tool
						title="Attach image, video, or file"
						icon="paperclip"
						onClick={() => fileRef.current?.click()}
					/>
				)}
				<div className="an-pop-wrap">
					<button type="button" className="an-tool" title="Insert" onClick={() => toggle("plus")}>
						<Icon name="plus" size={16} />
					</button>
					{plusOpen && (
						<Pop wide onClose={close}>
							{menu === "plus" && (
								<div className="an-list">
									<button type="button" className="an-list-item an-item-icon" onClick={() => setMenu("link")}>
										<Icon name="link" size={16} /> Link
									</button>
									<button type="button" className="an-list-item an-item-icon" onClick={() => setMenu("yt")}>
										<Icon name="play" size={16} /> YouTube preview
									</button>
									<button type="button" className="an-list-item an-item-icon" onClick={() => setMenu("emoji")}>
										<Icon name="smile" size={16} /> Emoji
									</button>
									<button
										type="button"
										className="an-list-item an-item-icon"
										disabled={!mentions}
										onClick={openMention}
									>
										<Icon name="atSign" size={16} /> Mention member
										{!mentions && (
											<span className="an-badge">
												<Icon name="lock" size={11} /> Business
											</span>
										)}
									</button>
								</div>
							)}
							{menu === "link" && (
								<div className="an-stack">
									<input
										className="an-input"
										placeholder="Text to show (optional)"
										value={linkLabel}
										onChange={(e) => setLinkLabel(e.target.value)}
									/>
									<input
										className="an-input"
										placeholder="https://..."
										value={linkUrl}
										onChange={(e) => setLinkUrl(e.target.value)}
									/>
									<div className="an-row">
										<button type="button" className="an-link-btn" onClick={() => setMenu("plus")}>
											Back
										</button>
										<button type="button" className="an-btn" onClick={addLink}>
											Insert link
										</button>
									</div>
								</div>
							)}
							{menu === "yt" && (
								<div className="an-stack">
									<input
										className="an-input"
										placeholder="Paste a YouTube link"
										value={ytUrl}
										onChange={(e) => setYtUrl(e.target.value)}
									/>
									{ytError ? <p className="an-error">{ytError}</p> : null}
									<p className="an-muted">Members see a video they can play inside the post.</p>
									<div className="an-row">
										<button type="button" className="an-link-btn" onClick={() => setMenu("plus")}>
											Back
										</button>
										<button type="button" className="an-btn" onClick={addYoutube}>
											Insert video
										</button>
									</div>
								</div>
							)}
							{menu === "emoji" && (
								<div className="an-stack">
									<div className="an-emoji-grid">
										{EMOJI.map((em) => (
											<button key={em} type="button" onClick={() => insert(em)}>
												{em}
											</button>
										))}
									</div>
									<button type="button" className="an-link-btn" onClick={() => setMenu("plus")}>
										Back
									</button>
								</div>
							)}
							{menu === "mention" && (
								<div className="an-stack">
									<input
										className="an-input"
										placeholder="Search members"
										value={q}
										onChange={(e) => setQ(e.target.value)}
									/>
									{people === null ? (
										<p className="an-muted">Loading members...</p>
									) : people.error === "PERMISSION" ? (
										<p className="an-error">
											Add the member:basic:read permission to this app and approve it in this
											community.
										</p>
									) : people.error ? (
										<p className="an-error">{people.error}</p>
									) : shown.length === 0 ? (
										<p className="an-muted">No members found.</p>
									) : (
										<div className="an-list an-scroll">
											{shown.map((m: any) => (
												<button
													key={m.id}
													type="button"
													className="an-list-item"
													onClick={() => insert(`@${m.handle || m.name} `)}
												>
													{m.name || m.handle}
													{m.handle ? <span className="an-muted"> @{m.handle}</span> : null}
												</button>
											))}
										</div>
									)}
									<button type="button" className="an-link-btn" onClick={() => setMenu("plus")}>
										Back
									</button>
								</div>
							)}
						</Pop>
					)}
				</div>
			</div>

			<textarea
				ref={ref}
				name="body"
				required
				maxLength={4000}
				placeholder="What do you want your members to know?"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="an-input an-area"
			/>

			{attach && (
				<>
					<input
						ref={fileRef}
						type="file"
						multiple
						hidden
						accept={ALLOWED_ACCEPT}
						onChange={(e) => onFiles(e.target.files)}
					/>
					<input
						type="hidden"
						name="attachments"
						value={JSON.stringify(files.map(({ url, ...a }) => a))}
					/>
					<input type="hidden" name="uploading" value={busy.length > 0 ? "1" : ""} />
					{(files.length > 0 || busy.length > 0) && (
						<div className="an-attach-list">
							{files.map((f) => (
								<div className="an-attach" key={f.path}>
									{kindOf(f.name) === "image" ? (
										<img src={f.url} alt="" />
									) : (
										<Icon name={kindOf(f.name) === "video" ? "film" : "file"} size={18} />
									)}
									<span className="an-attach-name">{f.name}</span>
									<span className="an-muted">{formatSize(f.size)}</span>
									<button
										type="button"
										className="an-icon-btn"
										title="Remove"
										onClick={() => setFiles((l) => l.filter((x) => x.path !== f.path))}
									>
										<Icon name="x" size={14} />
									</button>
								</div>
							))}
							{busy.map((n) => (
								<div className="an-attach" key={n}>
									<span className="an-muted">Uploading {n}...</span>
								</div>
							))}
						</div>
					)}
					{note ? <p className="an-error">{note}</p> : null}
					<p className="an-muted">
						{files.length}/{attachMax} attachments · images, video and files up to {attachMb} MB each
					</p>
				</>
			)}
		</div>
	);
}