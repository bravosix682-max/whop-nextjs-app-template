"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

function Glyph({
	children,
	size = 16,
	style,
}: {
	children: ReactNode;
	size?: number;
	style?: CSSProperties;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ flex: "none", ...style }}
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

const ChevronDown = ({ open }: { open: boolean }) => (
	<Glyph
		size={14}
		style={{
			transform: open ? "rotate(180deg)" : "none",
			transition: "transform 0.2s ease",
		}}
	>
		<path d="m6 9 6 6 6-6" />
	</Glyph>
);
const ChevronLeft = () => (
	<Glyph>
		<path d="m15 18-6-6 6-6" />
	</Glyph>
);
const ChevronRight = () => (
	<Glyph>
		<path d="m9 18 6-6-6-6" />
	</Glyph>
);
const CalendarIcon = () => (
	<Glyph>
		<rect width="18" height="18" x="3" y="4" rx="2" />
		<path d="M16 2v4" />
		<path d="M8 2v4" />
		<path d="M3 10h18" />
	</Glyph>
);
const CloseIcon = () => (
	<Glyph size={14}>
		<path d="M18 6 6 18" />
		<path d="m6 6 12 12" />
	</Glyph>
);

function usePopover() {
	const [open, setOpen] = useState(false);
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);
	return { open, setOpen };
}

function Popover({
	open,
	onClose,
	align = "left",
	wide,
	children,
}: {
	open: boolean;
	onClose: () => void;
	align?: "left" | "right";
	wide?: boolean;
	children: ReactNode;
}) {
	if (!open) return null;
	return (
		<>
			<div className="an-backdrop" onClick={onClose} />
			<div
				className={`an-pop${align === "right" ? " right" : ""}${wide ? " wide" : ""}`}
				role="dialog"
			>
				<div className="an-sheet-grip" />
				{children}
			</div>
		</>
	);
}

export type SelectGroup = {
	label: string;
	items: { value: string; label: string }[];
};

export function Select({
	placeholder,
	groups,
	onSelect,
}: {
	placeholder: string;
	groups: SelectGroup[];
	onSelect: (value: string) => void;
}) {
	const { open, setOpen } = usePopover();
	return (
		<div className="an-pop-wrap">
			<button
				type="button"
				className="an-chip"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
			>
				{placeholder}
				<ChevronDown open={open} />
			</button>
			<Popover open={open} onClose={() => setOpen(false)}>
				<div className="an-list">
					{groups.map((g) => (
						<div key={g.label}>
							<div className="an-list-head">{g.label}</div>
							{g.items.map((it) => (
								<button
									key={it.value}
									type="button"
									className="an-list-item"
									onClick={() => {
										onSelect(it.value);
										setOpen(false);
									}}
								>
									{it.label}
								</button>
							))}
						</div>
					))}
				</div>
			</Popover>
		</div>
	);
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function startOfDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfMonth(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), 1);
}
function nextHour() {
	const d = new Date();
	d.setMinutes(0, 0, 0);
	d.setHours(d.getHours() + 1);
	return d;
}
function pad(n: number) {
	return String(n).padStart(2, "0");
}
function show(d: Date) {
	return new Intl.DateTimeFormat("en-GB", {
		weekday: "short",
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(d);
}

export function DateTimePicker({
	value,
	onChange,
	disabled,
	placeholder,
}: {
	value: string;
	onChange: (iso: string) => void;
	disabled?: boolean;
	placeholder: string;
}) {
	const { open, setOpen } = usePopover();
	const selected = value ? new Date(value) : null;
	const [view, setView] = useState<Date>(() => startOfMonth(new Date()));
	const hoursRef = useRef<HTMLDivElement>(null);
	const minsRef = useRef<HTMLDivElement>(null);

	const base = selected ?? nextHour();
	const y = view.getFullYear();
	const m = view.getMonth();
	const offset = (new Date(y, m, 1).getDay() + 6) % 7;
	const total = new Date(y, m + 1, 0).getDate();
	const cells: (number | null)[] = [
		...Array.from({ length: offset }, () => null),
		...Array.from({ length: total }, (_, i) => i + 1),
	];
	const today = startOfDay(new Date()).getTime();
	const past = !!selected && selected.getTime() < Date.now();

	function commit(d: Date) {
		onChange(d.toISOString());
	}

	function toggle() {
		if (disabled) return;
		if (!open) setView(startOfMonth(selected ?? new Date()));
		setOpen(!open);
	}

	useEffect(() => {
		if (!open) return;
		for (const ref of [hoursRef, minsRef]) {
			const box = ref.current;
			const on = box?.querySelector<HTMLElement>("[data-on='1']");
			if (box && on) {
				box.scrollTop = on.offsetTop - box.clientHeight / 2 + on.clientHeight / 2;
			}
		}
	}, [open, value]);

	return (
		<div className="an-pop-wrap block">
			<button
				type="button"
				className="an-dt-btn"
				disabled={disabled}
				aria-expanded={open}
				onClick={toggle}
			>
				<CalendarIcon />
				<span className={selected ? "" : "an-ph"}>
					{selected ? show(selected) : placeholder}
				</span>
			</button>
			{selected && !disabled ? (
				<button
					type="button"
					className="an-clear"
					title="Clear"
					onClick={() => onChange("")}
				>
					<CloseIcon />
				</button>
			) : null}
			<Popover open={open} onClose={() => setOpen(false)} align="right" wide>
				<div className="an-quick">
					<button type="button" className="an-chip" onClick={() => commit(nextHour())}>
						In 1 hour
					</button>
					<button
						type="button"
						className="an-chip"
						onClick={() => {
							const d = new Date();
							d.setDate(d.getDate() + 1);
							d.setHours(9, 0, 0, 0);
							commit(d);
							setView(startOfMonth(d));
						}}
					>
						Tomorrow 9:00
					</button>
					<button
						type="button"
						className="an-chip"
						onClick={() => {
							const d = new Date();
							d.setDate(d.getDate() + 7);
							d.setMinutes(0, 0, 0);
							commit(d);
							setView(startOfMonth(d));
						}}
					>
						In 1 week
					</button>
				</div>

				<div className="an-cal-head">
					<button
						type="button"
						className="an-icon-btn"
						onClick={() => setView(new Date(y, m - 1, 1))}
					>
						<ChevronLeft />
					</button>
					<span>
						{MONTHS[m]} {y}
					</span>
					<button
						type="button"
						className="an-icon-btn"
						onClick={() => setView(new Date(y, m + 1, 1))}
					>
						<ChevronRight />
					</button>
				</div>

				<div className="an-cal-grid">
					{WEEKDAYS.map((w) => (
						<span key={w} className="an-dow">
							{w}
						</span>
					))}
					{cells.map((n, i) => {
						if (n === null) return <span key={`b${i}`} />;
						const day = new Date(y, m, n).getTime();
						const isSel =
							!!selected && startOfDay(selected).getTime() === day;
						return (
							<button
								key={n}
								type="button"
								disabled={day < today}
								className={`an-day${isSel ? " on" : ""}${day === today ? " today" : ""}`}
								onClick={() =>
									commit(new Date(y, m, n, base.getHours(), base.getMinutes()))
								}
							>
								{n}
							</button>
						);
					})}
				</div>

				<div className="an-cols">
					<div className="an-col" ref={hoursRef}>
						{HOURS.map((h) => (
							<button
								key={h}
								type="button"
								data-on={selected && base.getHours() === h ? "1" : undefined}
								className={selected && base.getHours() === h ? "on" : ""}
								onClick={() => {
									const d = new Date(base);
									d.setHours(h);
									commit(d);
								}}
							>
								{pad(h)}
							</button>
						))}
					</div>
					<div className="an-col" ref={minsRef}>
						{MINUTES.map((mm) => (
							<button
								key={mm}
								type="button"
								data-on={selected && base.getMinutes() === mm ? "1" : undefined}
								className={selected && base.getMinutes() === mm ? "on" : ""}
								onClick={() => {
									const d = new Date(base);
									d.setMinutes(mm, 0, 0);
									commit(d);
								}}
							>
								{pad(mm)}
							</button>
						))}
					</div>
				</div>

				<div className="an-pop-foot">
					<span className="an-hint">{past ? "That time has already passed" : ""}</span>
					<button type="button" className="an-btn" onClick={() => setOpen(false)}>
						Done
					</button>
				</div>
			</Popover>
		</div>
	);
}