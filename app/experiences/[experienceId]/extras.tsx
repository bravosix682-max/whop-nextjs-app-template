"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "./icons";

export function PostActions({
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
	const ref = useRef<HTMLDivElement>(null);
	const [isPinned, setIsPinned] = useState(pinned);
	const [error, setError] = useState("");
	const [pending, start] = useTransition();

	useEffect(() => {
		setIsPinned(pinned);
	}, [pinned]);

	function article() {
		return ref.current?.closest("article") as HTMLElement | null;
	}

	return (
		<div className="an-actions" ref={ref}>
			{error ? <span className="an-error">{error}</span> : null}
			<Link href={editHref} prefetch={false} className="an-icon-btn" title="Edit">
				<Icon name="pencil" size={16} />
			</Link>
			<button
				type="button"
				className={`an-icon-btn${isPinned ? " on" : ""}`}
				disabled={pending}
				title={isPinned ? "Unpin" : "Pin"}
				onClick={() => {
					const next = !isPinned;
					setIsPinned(next);
					setError("");
					start(async () => {
						const err = await onPin(id, next);
						if (err) {
							setIsPinned(!next);
							setError(err);
						}
					});
				}}
			>
				<Icon name="pin" size={16} />
			</button>
			<button
				type="button"
				className="an-icon-btn"
				disabled={pending}
				title="Delete"
				onClick={() => {
					const el = article();
					el?.classList.add("an-leaving");
					const timer = setTimeout(() => {
						if (el?.classList.contains("an-leaving")) el.style.display = "none";
					}, 230);
					setError("");
					start(async () => {
						const err = await onDelete(id);
						if (err) {
							clearTimeout(timer);
							if (el) {
								el.classList.remove("an-leaving");
								el.style.display = "";
							}
							setError(err);
						}
					});
				}}
			>
				<Icon name="trash" size={16} />
			</button>
		</div>
	);
}

export function CountUp({ value }: { value: number }) {
	const [shown, setShown] = useState(0);

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setShown(value);
			return;
		}
		let frame = 0;
		const startAt = performance.now();
		const duration = 700;
		const tick = (now: number) => {
			const p = Math.min(1, (now - startAt) / duration);
			setShown(Math.round(value * (1 - (1 - p) ** 3)));
			if (p < 1) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [value]);

	return <>{shown.toLocaleString("en-US")}</>;
}