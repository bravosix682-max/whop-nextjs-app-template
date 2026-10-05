"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useEffect, useState } from "react";
import { FEATURES, type Plan } from "@/lib/plans";
import { Icon } from "./icons";
import { QUICK, TEMPLATES } from "./templates";

export type FormResult = { ok: boolean; message: string } | null;

type Initial = {
	title: string;
	body: string;
	pinned: boolean;
	priority: string;
};

function iso(v: string) {
	if (!v) return "";
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function Panel({
	title,
	lock,
	children,
}: {
	title: string;
	lock?: string;
	children: ReactNode;
}) {
	return (
		<div className={`an-panel${lock ? " locked" : ""}`}>
			<div className="an-panel-head">
				<span>{title}</span>
				{lock ? (
					<span className="an-badge">
						<Icon name="lock" size={11} /> {lock}
					</span>
				) : null}
			</div>
			{children}
		</div>
	);
}

function FormFields({
	formAction,
	pending,
	plan,
	mode,
	id,
	initial,
	cancelHref,
	liveCount,
}: {
	formAction: (formData: FormData) => void;
	pending: boolean;
	plan: Plan;
	mode: "create" | "edit";
	id: string;
	initial?: Initial;
	cancelHref?: string;
	liveCount: number;
}) {
	const f = FEATURES[plan];
	const [rid, setRid] = useState("");
	const [title, setTitle] = useState(initial?.title ?? "");
	const [body, setBody] = useState(initial?.body ?? "");
	const [priority, setPriority] = useState(initial?.priority ?? "normal");
	const [pinned, setPinned] = useState(initial?.pinned ?? false);
	const [pollOpen, setPollOpen] = useState(false);
	const [schedule, setSchedule] = useState("");
	const [eventAt, setEventAt] = useState("");
	const [expires, setExpires] = useState("");
	const [ack, setAck] = useState(false);
	const [push, setPush] = useState(false);

	useEffect(() => {
		setRid(crypto.randomUUID());
	}, []);

	function apply(t: { title: string; body: string }) {
		setTitle(t.title);
		setBody(t.body);
	}

	function applyNiche(value: string) {
		for (const group of TEMPLATES) {
			for (const t of group.items) {
				if (`${group.group}|${t.label}` === value) {
					apply(t);
					return;
				}
			}
		}
	}

	return (
		<form
			action={formAction}
			className={mode === "create" ? "an-create" : "an-create single"}
		>
			<div className="an-card">
				{mode === "create" && (
					<div className="an-chip-row">
						{QUICK.map((t) => (
							<button
								key={t.label}
								type="button"
								className="an-chip"
								onClick={() => apply(t)}
							>
								{t.label}
							</button>
						))}
						<select
							className="an-select"
							value=""
							onChange={(e) => applyNiche(e.target.value)}
						>
							<option value="">More templates...</option>
							{TEMPLATES.map((group) => (
								<optgroup key={group.group} label={group.group}>
									{group.items.map((t) => (
										<option key={t.label} value={`${group.group}|${t.label}`}>
											{t.label}
										</option>
									))}
								</optgroup>
							))}
						</select>
					</div>
				)}

				<input type="hidden" name="id" value={mode === "edit" ? id : rid} />
				<input type="hidden" name="priority" value={priority} />

				<input
					name="title"
					required
					maxLength={120}
					placeholder="Headline"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className="an-input an-input-lg"
				/>
				<textarea
					name="body"
					required
					maxLength={4000}
					placeholder="What do you want your members to know?"
					value={body}
					onChange={(e) => setBody(e.target.value)}
					className="an-input"
				/>
				<p className="an-muted">
					Tip: paste a link to make it clickable, paste an image link (.png, .jpg,
					.gif, .webp) to show the picture, and put **double stars** around words
					to make them bold.
				</p>

				<div className="an-row">
					<div className="an-seg">
						{["normal", "important", "urgent"].map((p) => (
							<button
								key={p}
								type="button"
								className={priority === p ? "on" : ""}
								onClick={() => setPriority(p)}
							>
								{p.charAt(0).toUpperCase() + p.slice(1)}
							</button>
						))}
					</div>
					<label className="an-toggle">
						<input
							type="checkbox"
							className="an-switch"
							name="pinned"
							checked={pinned}
							onChange={(e) => setPinned(e.target.checked)}
						/>
						Pin to top
					</label>
				</div>

				{mode === "create" &&
					(f.poll ? (
						pollOpen ? (
							<Panel title="Poll">
								<input
									name="poll_q"
									className="an-input"
									placeholder="Question"
									maxLength={140}
								/>
								{[1, 2, 3, 4].map((n) => (
									<input
										key={n}
										name={`poll_o${n}`}
										className="an-input"
										placeholder={`Option ${n}${n > 2 ? " (optional)" : ""}`}
										maxLength={80}
									/>
								))}
								<button
									type="button"
									className="an-link-btn"
									onClick={() => setPollOpen(false)}
								>
									Remove poll
								</button>
							</Panel>
						) : (
							<Panel title="Poll">
								<button
									type="button"
									className="an-link-btn"
									onClick={() => setPollOpen(true)}
								>
									+ Add a poll
								</button>
							</Panel>
						)
					) : (
						<Panel title="Poll" lock="Pro">
							<span className="an-muted">+ Add a poll</span>
						</Panel>
					))}

				{mode === "create" && (
					<Panel title="A/B headline test" lock={f.abTest ? undefined : "Business"}>
						<input
							name="alt_title"
							className="an-input"
							placeholder="Alternate headline: half your members see this one"
							maxLength={120}
							disabled={!f.abTest}
						/>
					</Panel>
				)}

				<button type="submit" disabled={pending} className="an-btn-primary">
					{pending
						? mode === "edit"
							? "Saving..."
							: "Posting..."
						: mode === "edit"
							? "Save changes"
							: schedule
								? "Schedule announcement"
								: "Post announcement"}
				</button>
				{mode === "create" && plan === "starter" && (
					<p className="an-muted an-center">
						{liveCount}/{f.liveMax} free announcements used
					</p>
				)}
				{mode === "edit" && cancelHref ? (
					<Link href={cancelHref} prefetch={false} className="an-muted">
						Back to announcements
					</Link>
				) : null}
			</div>

			{mode === "create" && (
				<div className="an-form-right">
					<Panel
						title={'Require "I\'ve read this"'}
						lock={f.acknowledge ? undefined : "Pro"}
					>
						<label className="an-toggle">
							<input
								type="checkbox"
								className="an-switch"
								name="require_ack"
								checked={ack}
								onChange={(e) => setAck(e.target.checked)}
								disabled={!f.acknowledge}
							/>
							<span className="an-muted">Track who confirmed</span>
						</label>
					</Panel>

					<Panel title="Schedule for later" lock={f.schedule ? undefined : "Pro"}>
						<input
							type="datetime-local"
							className="an-input"
							value={schedule}
							onChange={(e) => setSchedule(e.target.value)}
							disabled={!f.schedule}
						/>
						{f.schedule && (
							<input type="hidden" name="publish_at" value={iso(schedule)} />
						)}
					</Panel>

					<Panel title="Event countdown" lock={f.countdown ? undefined : "Pro"}>
						<input
							type="datetime-local"
							className="an-input"
							value={eventAt}
							onChange={(e) => setEventAt(e.target.value)}
							disabled={!f.countdown}
						/>
						{f.countdown && (
							<input type="hidden" name="event_at" value={iso(eventAt)} />
						)}
					</Panel>

					<Panel title="Auto-remove after" lock={f.expire ? undefined : "Pro"}>
						<input
							type="datetime-local"
							className="an-input"
							value={expires}
							onChange={(e) => setExpires(e.target.value)}
							disabled={!f.expire}
						/>
						{f.expire && (
							<input type="hidden" name="expires_at" value={iso(expires)} />
						)}
					</Panel>

					<Panel title="Also send to" lock={f.pushSend ? undefined : "Business"}>
						<div className="an-chip-row">
							<label className={`an-chip${push ? " on" : ""}`}>
								<input
									type="checkbox"
									name="push"
									hidden
									checked={push}
									onChange={(e) => setPush(e.target.checked)}
									disabled={!f.pushSend}
								/>
								Push
							</label>
						</div>
					</Panel>
				</div>
			)}
		</form>
	);
}

export function CreateForm({
	action,
	plan,
	mode,
	id,
	initial,
	cancelHref,
	liveCount,
}: {
	action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
	plan: Plan;
	mode: "create" | "edit";
	id: string;
	initial?: Initial;
	cancelHref?: string;
	liveCount: number;
}) {
	const [state, formAction, pending] = useActionState(
		action,
		null as FormResult,
	);
	const [k, setK] = useState(0);

	useEffect(() => {
		if (state?.ok && mode === "create") setK((n) => n + 1);
	}, [state, mode]);

	return (
		<>
			{state ? (
				<p className={`an-notice ${state.ok ? "ok" : "bad"}`}>{state.message}</p>
			) : null}
			<FormFields
				key={k}
				formAction={formAction}
				pending={pending}
				plan={plan}
				mode={mode}
				id={id}
				initial={initial}
				cancelHref={cancelHref}
				liveCount={liveCount}
			/>
		</>
	);
}