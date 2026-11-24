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

export function Comments({ postId, enabled, initial, isAdmin, meId, meName, restricted, onAdd, onDelete }: any) {
	const [items, setItems] = useState<any[]>(initial);
	const [all, setAll] = useState(false);
	const [text, setText] = useState("");
	const [msg, setMsg] = useState("");
	const [emoji, setEmoji] = useState(false);
	const [pending, start] = useTransition();
	const ref = useRef<HTMLInputElement>(null);

	if (!enabled && items.length === 0) return null;

	function addEmoji(e: string) {
		const el = ref.current;
		const s = el ? (el.selectionStart ?? text.length) : text.length;
		const en = el ? (el.selectionEnd ?? s) : s;
		setText((t) => (t.slice(0, s) + e + t.slice(en)).slice(0, 1000));
		setEmoji(false);
		requestAnimationFrame(() => {
			if (el) {
				el.focus();
				el.setSelectionRange(s + e.length, s + e.length);
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
				setAll(true);
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

	const shown = all ? items : items.slice(-3);

	return (
		<div className="an-cm2">
			{items.length > 3 && !all && (
				<button type="button" className="an-cm2-more" onClick={() => setAll(true)}>
					View all {items.length} comments
				</button>
			)}
			{shown.length > 0 && (
				<div className="an-cm2-list">
					{shown.map((c) => (
						<div key={c.id} className="an-cm2-item">
							<span className="an-avatar">{(c.user_name || "?").charAt(0).toUpperCase()}</span>
							<div className="an-cm2-bubble">
								<div className="an-cm2-head">
									<b>{c.user_name || "Member"}</b>
									<span className="an-muted">
										{c.user_handle ? `@${c.user_handle} · ` : ""}
										{ago(c.created_at)}
									</span>
									{(isAdmin || c.user_id === meId) && (
										<button type="button" className="an-cm2-del" title="Delete comment" disabled={pending} onClick={() => remove(c.id)}>
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
				<div className="an-cm2-compose">
					<span className="an-avatar">{(meName || "?").charAt(0).toUpperCase()}</span>
					<div className="an-cm2-pill">
						<input
							ref={ref}
							value={text}
							maxLength={1000}
							placeholder="Write a comment..."
							onChange={(e) => setText(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									send();
								}
							}}
						/>
						<div className="an-pop-wrap">
							<button type="button" className="an-cm2-icon" title="Add emoji" onClick={() => setEmoji(!emoji)}>
								<Icon name="smile" size={19} />
							</button>
							{emoji && (
								<>
									<div className="an-backdrop" onClick={() => setEmoji(false)} />
									<div className="an-pop up wide right">
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
						<button type="button" className="an-cm2-send" disabled={pending || !text.trim()} onClick={send} aria-label="Send comment">
							<Icon name="send" size={16} />
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
	);
}