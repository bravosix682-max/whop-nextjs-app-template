// @ts-nocheck
"use client";

import { useState, useTransition } from "react";
import { Icon } from "./icons";

function ago(iso: string) {
	const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
	if (m < 1) return "just now";
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

export function Comments({
	postId,
	enabled,
	initial,
	isAdmin,
	meId,
	restricted,
	onAdd,
	onDelete,
}: any) {
	const [items, setItems] = useState<any[]>(initial);
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const [msg, setMsg] = useState("");
	const [pending, start] = useTransition();

	if (!enabled && items.length === 0) return null;

	function send() {
		const body = text.trim();
		if (!body || pending) return;
		setMsg("");
		start(async () => {
			const r = await onAdd(postId, body);
			if (r?.ok && r.comment) {
				setItems((l) => [...l, r.comment]);
				setText("");
			} else {
				setMsg(r?.message ?? "Could not post your comment.");
			}
		});
	}

	function remove(id: string) {
		start(async () => {
			const err = await onDelete(id);
			if (err) setMsg(err);
			else setItems((l) => l.filter((c) => c.id !== id));
		});
	}

	return (
		<div className="an-comments">
			<button type="button" className="an-comments-toggle" onClick={() => setOpen(!open)}>
				<Icon name="comment" size={15} />
				Comments ({items.length})
				<Icon name="chevron" size={12} style={{ transform: open ? "rotate(180deg)" : "none" }} />
			</button>
			{open && (
				<div className="an-comments-body">
					{items.map((c) => (
						<div key={c.id} className="an-comment">
							<span className="an-avatar">{(c.user_name || "?").charAt(0).toUpperCase()}</span>
							<div className="an-comment-main">
								<div className="an-comment-head">
									<b>{c.user_name || "Member"}</b>
									{c.user_handle ? <span className="an-muted">@{c.user_handle}</span> : null}
									<span className="an-muted">{ago(c.created_at)}</span>
									{(isAdmin || c.user_id === meId) && (
										<button
											type="button"
											className="an-icon-btn"
											title="Delete comment"
											disabled={pending}
											onClick={() => remove(c.id)}
										>
											<Icon name="trash" size={14} />
										</button>
									)}
								</div>
								<p className="an-comment-text">{c.body}</p>
							</div>
						</div>
					))}
					{items.length === 0 && <p className="an-muted">No comments yet.</p>}
					{enabled && !restricted ? (
						<div className="an-comment-form">
							<textarea
								className="an-input"
								rows={2}
								maxLength={1000}
								placeholder="Write a comment..."
								value={text}
								onChange={(e) => setText(e.target.value)}
							/>
							<button type="button" className="an-btn" disabled={pending || !text.trim()} onClick={send}>
								{pending ? "Sending..." : "Comment"}
							</button>
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