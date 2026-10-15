// @ts-nocheck
"use client";

import { useRef, useState, useTransition } from "react";
import { Icon } from "./icons";

const EMOJI =
	"😀 😂 🤣 😊 😍 🥰 😎 🤩 🥳 😮 😢 😭 😡 🙏 👍 👎 👏 🙌 💪 🔥 ✨ 🎉 🏆 💯 ❤️ 🧡 💛 💚 💙 💜 🤝 👀 ✅ ❌ ⭐ 🚀 💡 💰 🎯 🙂 😉 🤔 😅 😴 🤯 ⚡ 🌟 ❗ ❓".split(
		" ",
	);

function ago(iso: string) {
	const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
	if (m < 1) return "just now";
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h`;
	return `${Math.floor(h / 24)}d`;
}

export function Comments({ postId, enabled, initial, isAdmin, meId, restricted, onAdd, onDelete }: any) {
	const [items, setItems] = useState<any[]>(initial);
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const [msg, setMsg] = useState("");
	const [emoji, setEmoji] = useState(false);
	const [pending, start] = useTransition();
	const ref = useRef<HTMLTextAreaElement>(null);

	if (!enabled && items.length === 0) return null;

	function addEmoji(e: string) {
		const ta = ref.current;
		const s = ta ? ta.selectionStart : text.length;
		const en = ta ? ta.selectionEnd : s;
		setText((t) => (t.slice(0, s) + e + t.slice(en)).slice(0, 1000));
		setEmoji(false);
		requestAnimationFrame(() => {
			if (ta) {
				ta.focus();
				ta.setSelectionRange(s + e.length, s + e.length);
			}
		});
	}

	function send() {
		const body = text.trim();
		if (!body || pending) return;
		setMsg("");
		start(async () => {
			const r = await onAdd(postId, body);
			if (r?.ok && r.comment) {
				setItems((l) => [...l, r.comment]);
				setText("");
			} else setMsg(r?.message ?? "Could not post your comment.");
		});
	}

	function remove(id: string) {
		start(async () => {
			const err = await onDelete(id);
			if (err) setMsg(err);
			else setItems((l) => l.filter((c) => c.id !== id));
		});
	}

	const label = items.length === 0 ? (enabled ? "Add a comment" : "Comments") : `${items.length} comment${items.length === 1 ? "" : "s"}`;

	return (
		<div className="an-cm">
			<button type="button" className="an-cm-toggle" onClick={() => setOpen(!open)}>
				<Icon name="comment" size={16} />
				<span>{label}</span>
				<Icon name="chevron" size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
			</button>

			{open && (
				<div className="an-cm-body">
					{items.length > 0 && (
						<div className="an-cm-list">
							{items.map((c) => (
								<div key={c.id} className="an-cm-item">
									<span className="an-avatar">{(c.user_name || "?").charAt(0).toUpperCase()}</span>
									<div className="an-cm-bubble">
										<div className="an-cm-head">
											<b>{c.user_name || "Member"}</b>
											<span className="an-muted">
												{c.user_handle ? `@${c.user_handle} · ` : ""}
												{ago(c.created_at)}
											</span>
											{(isAdmin || c.user_id === meId) && (
												<button type="button" className="an-icon-btn" title="Delete comment" disabled={pending} onClick={() => remove(c.id)}>
													<Icon name="trash" size={14} />
												</button>
											)}
										</div>
										<p className="an-comment-text">{c.body}</p>
									</div>
								</div>
							))}
						</div>
					)}

					{enabled && !restricted ? (
						<div className="an-cm-compose">
							<textarea
								ref={ref}
								rows={2}
								maxLength={1000}
								placeholder="Write a comment..."
								value={text}
								onChange={(e) => setText(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
										e.preventDefault();
										send();
									}
								}}
							/>
							<div className="an-cm-actions">
								<div className="an-pop-wrap">
									<button type="button" className="an-icon-btn" title="Add emoji" onClick={() => setEmoji(!emoji)}>
										<Icon name="smile" size={18} />
									</button>
									{emoji && (
										<>
											<div className="an-backdrop" onClick={() => setEmoji(false)} />
											<div className="an-pop up wide">
												<div className="an-sheet-grip" />
												<div className="an-emoji-grid">
													{EMOJI.map((e) => (
														<button key={e} type="button" onClick={() => addEmoji(e)}>
															{e}
														</button>
													))}
												</div>
											</div>
										</>
									)}
								</div>
								<span className="an-muted an-grow">{text.length}/1000</span>
								<button type="button" className="an-cm-send" disabled={pending || !text.trim()} onClick={send} aria-label="Send comment">
									<Icon name="send" size={16} />
									<span>{pending ? "Sending" : "Comment"}</span>
								</button>
							</div>
						</div>
					) : !enabled ? (
						<p className="an-muted">Comments are turned off for this post.</p>
					) : (
						<p className="an-muted">You can't comment in this community.</p>
					)}
					{msg ? <p className="an-error">{msg}</p> : null}
				</div>
			)}
		</div>
	);
}