// @ts-nocheck
"use client";

import { useState, useTransition } from "react";
import { Icon } from "./icons";

const PICK =
	"👍 ❤️ 😂 😮 😢 🙏 🔥 🎉 👏 💯 😍 🤩 🥳 😎 🤔 😅 😭 😡 🤯 🙌 💪 👀 ✅ ❌ ⭐ 🚀 💡 💰 🏆 🎯 🙂 😉 😊 🤣 😇 🥰 😘 😴 🤝 👎 ✨ ⚡ 🌟 ❗ ❓ 💎 📈 🎁 🍀".split(
		" ",
	);

export function Reactions({ id, counts, mine, onReact }: any) {
	const [state, setState] = useState({ counts, mine });
	const [open, setOpen] = useState(false);
	const [pending, start] = useTransition();

	function toggle(emoji: string) {
		setOpen(false);
		if (pending) return;
		const prev = state;
		const has = state.mine.includes(emoji);
		setState({
			counts: { ...state.counts, [emoji]: Math.max(0, (state.counts[emoji] ?? 0) + (has ? -1 : 1)) },
			mine: has ? state.mine.filter((e: string) => e !== emoji) : [...state.mine, emoji],
		});
		start(async () => {
			try {
				await onReact(id, emoji);
			} catch {
				setState(prev);
			}
		});
	}

	const used = Object.entries(state.counts)
		.filter(([, n]: any) => n > 0)
		.sort((a: any, b: any) => b[1] - a[1]);

	return (
		<div className="an-reactions">
			{used.map(([e, n]: any) => (
				<button
					key={e}
					type="button"
					className={`an-chip${state.mine.includes(e) ? " on" : ""}`}
					title={state.mine.includes(e) ? "Remove your reaction" : "React with this"}
					onClick={() => toggle(e)}
				>
					{e}
					<span>{n}</span>
				</button>
			))}
			<div className="an-pop-wrap">
				<button
					type="button"
					className="an-chip an-add-react"
					aria-label="Add reaction"
					title="Add reaction"
					onClick={() => setOpen(!open)}
				>
					<Icon name="smile" size={16} />
					<Icon name="plus" size={12} />
				</button>
				{open && (
					<>
						<div className="an-backdrop" onClick={() => setOpen(false)} />
						<div className="an-pop wide">
							<div className="an-sheet-grip" />
							<div className="an-emoji-grid">
								{PICK.map((e) => (
									<button key={e} type="button" onClick={() => toggle(e)}>
										{e}
									</button>
								))}
							</div>
						</div>
					</>
				)}
			</div>
			{used.length === 0 && <span className="an-muted">Be the first to react</span>}
		</div>
	);
}