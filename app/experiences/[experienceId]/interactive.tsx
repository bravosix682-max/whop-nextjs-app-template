"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { EMOJIS } from "@/lib/plans";
import { Icon } from "./icons";

export function ReactionBar({
	id,
	counts,
	mine,
	onReact,
}: {
	id: string;
	counts: Record<string, number>;
	mine: string[];
	onReact: (id: string, emoji: string) => Promise<void>;
}) {
	const [state, setState] = useState({ counts, mine });
	const [pending, start] = useTransition();

	function toggle(emoji: string) {
		if (pending) return;
		const prev = state;
		const has = state.mine.includes(emoji);
		setState({
			counts: {
				...state.counts,
				[emoji]: Math.max(0, (state.counts[emoji] ?? 0) + (has ? -1 : 1)),
			},
			mine: has ? state.mine.filter((e) => e !== emoji) : [...state.mine, emoji],
		});
		start(async () => {
			try {
				await onReact(id, emoji);
			} catch {
				setState(prev);
			}
		});
	}

	return (
		<div className="an-reactions">
			{EMOJIS.map((e) => {
				const n = state.counts[e] ?? 0;
				const on = state.mine.includes(e);
				return (
					<button
						key={e}
						type="button"
						className={`an-chip${on ? " on" : ""}`}
						onClick={() => toggle(e)}
					>
						{e}
						{n > 0 ? <span>{n}</span> : null}
					</button>
				);
			})}
		</div>
	);
}

export function PollBlock({
	id,
	poll,
	counts,
	myVote,
	showResults,
	onVote,
}: {
	id: string;
	poll: { question: string; options: string[] };
	counts: Record<string, number>;
	myVote: number | null;
	showResults: boolean;
	onVote: (id: string, index: number) => Promise<void>;
}) {
	const [state, setState] = useState({ counts, myVote });
	const [pending, start] = useTransition();
	const total = Object.values(state.counts).reduce((a, b) => a + b, 0);
	const reveal = showResults || state.myVote !== null;

	function vote(i: number) {
		if (pending || state.myVote === i) return;
		const prev = state;
		const next = { ...state.counts };
		if (state.myVote !== null) {
			const key = String(state.myVote);
			next[key] = Math.max(0, (next[key] ?? 0) - 1);
		}
		next[String(i)] = (next[String(i)] ?? 0) + 1;
		setState({ counts: next, myVote: i });
		start(async () => {
			try {
				await onVote(id, i);
			} catch {
				setState(prev);
			}
		});
	}

	return (
		<div className="an-poll">
			<div className="an-poll-q">{poll.question}</div>
			{poll.options.map((opt, i) => {
				const n = state.counts[String(i)] ?? 0;
				const pct = total > 0 ? Math.round((n / total) * 100) : 0;
				return (
					<button
						key={i}
						type="button"
						className={`an-poll-opt${state.myVote === i ? " on" : ""}`}
						onClick={() => vote(i)}
					>
						{reveal ? (
							<span className="an-poll-bar" style={{ width: `${pct}%` }} />
						) : null}
						<span className="an-poll-label">{opt}</span>
						{reveal ? <span className="an-poll-pct">{pct}%</span> : null}
					</button>
				);
			})}
			<div className="an-muted">
				{total} {total === 1 ? "vote" : "votes"}
			</div>
		</div>
	);
}

export function AckButton({
	id,
	done,
	onAck,
}: {
	id: string;
	done: boolean;
	onAck: (id: string) => Promise<void>;
}) {
	const [ok, setOk] = useState(done);
	const [pending, start] = useTransition();
	if (ok) return <span className="an-ack-done">✓ You confirmed</span>;
	return (
		<button
			type="button"
			className="an-btn"
			disabled={pending}
			onClick={() => {
				setOk(true);
				start(async () => {
					try {
						await onAck(id);
					} catch {
						setOk(false);
					}
				});
			}}
		>
			I've read this
		</button>
	);
}

export function Countdown({ target }: { target: string }) {
	const [now, setNow] = useState<number | null>(null);

	useEffect(() => {
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	if (now === null) return null;
	const diff = new Date(target).getTime() - now;
	if (diff <= 0) {
		return (
			<div className="an-countdown">
				<Icon name="timer" size={16} />
				<span className="an-count-pill">Started</span>
			</div>
		);
	}
	const s = Math.floor(diff / 1000);
	const parts: [number, string][] = [
		[Math.floor(s / 86400), "d"],
		[Math.floor((s % 86400) / 3600), "h"],
		[Math.floor((s % 3600) / 60), "m"],
		[s % 60, "s"],
	];
	return (
		<div className="an-countdown">
			<Icon name="timer" size={16} />
			{parts.map(([n, label]) => (
				<span key={label} className="an-count-pill">
					{String(n).padStart(2, "0")}
					<i>{label}</i>
				</span>
			))}
		</div>
	);
}

export function AdminActions({
	id,
	pinned,
	editHref,
	onPin,
	onDelete,
}: {
	id: string;
	pinned: boolean;
	editHref: string;
	onPin: (id: string, pinned: boolean) => Promise<string>;
	onDelete: (id: string) => Promise<string>;
}) {
	const [pending, start] = useTransition();
	const [error, setError] = useState("");

	return (
		<div className="an-actions" style={{ opacity: pending ? 0.5 : 1 }}>
			{error ? <span className="an-error">{error}</span> : null}
			<Link href={editHref} prefetch={false} className="an-icon-btn" title="Edit">
				<Icon name="pencil" size={16} />
			</Link>
			<button
				type="button"
				className={`an-icon-btn${pinned ? " on" : ""}`}
				disabled={pending}
				title={pinned ? "Unpin" : "Pin"}
				onClick={() =>
					start(async () => {
						setError(await onPin(id, !pinned));
					})
				}
			>
				<Icon name="pin" size={16} />
			</button>
			<button
				type="button"
				className="an-icon-btn"
				disabled={pending}
				title="Delete"
				onClick={() =>
					start(async () => {
						setError(await onDelete(id));
					})
				}
			>
				<Icon name="trash" size={16} />
			</button>
		</div>
	);
}

export function ExportButton({ csv, filename }: { csv: string; filename: string }) {
	return (
		<button
			type="button"
			className="an-btn-ghost"
			onClick={() => {
				const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(url);
			}}
		>
			<Icon name="download" size={16} /> Export CSV
		</button>
	);
}

export function PlanButton({
	plan,
	current,
	label,
	primary,
	locked,
	onChoose,
}: {
	plan: string;
	current: boolean;
	label: string;
	primary?: boolean;
	locked?: string;
	onChoose: (plan: string) => Promise<void>;
}) {
	const [pending, start] = useTransition();
	const disabled = current || pending || !!locked;
	return (
		<button
			type="button"
			className={primary && !current && !locked ? "an-btn-primary" : "an-btn-ghost"}
			disabled={disabled}
			onClick={() =>
				start(async () => {
					await onChoose(plan);
				})
			}
		>
			{current ? "Current plan" : locked ? locked : pending ? "Switching..." : label}
		</button>
	);
}