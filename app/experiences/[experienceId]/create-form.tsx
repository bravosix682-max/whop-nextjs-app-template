// @ts-nocheck
"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useEffect, useState } from "react";
import { FEATURES } from "@/lib/plans";
import { RichEditor } from "./editor";
import { Icon } from "./icons";
import { DateTimePicker, Select } from "./pickers";
import { QUICK, TEMPLATES } from "./templates";

export type FormResult = { ok: boolean; message: string } | null;

const TEMPLATE_GROUPS = TEMPLATES.map((g) => ({
	label: g.group,
	items: g.items.map((t) => ({ value: `${g.group}|${t.label}`, label: t.label })),
}));

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

function Chip({ name, label, checked, onChange, disabled, lock }: any) {
	return (
		<label
			className={`an-chip${checked ? " on" : ""}`}
			style={disabled ? { opacity: 0.55 } : undefined}
		>
			<input
				type="checkbox"
				name={name}
				hidden
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				disabled={disabled}
			/>
			{label}
			{lock ? <Icon name="lock" size={11} /> : null}
		</label>
	);
}

function ProductPicker({ disabled, fetchProducts, value, onChange }: any) {
	const [open, setOpen] = useState(false);
	const [data, setData] = useState<any>(null);
	const [loading, setLoading] = useState(false);

	async function toggle() {
		if (disabled) return;
		const next = !open;
		setOpen(next);
		if (next && (!data || data.error) && !loading) {
			setLoading(true);
			setData(await fetchProducts());
			setLoading(false);
		}
	}

	function flip(id: string) {
		onChange(value.includes(id) ? value.filter((x: string) => x !== id) : [...value, id]);
	}

	return (
		<div className="an-pop-wrap block">
			<button type="button" className="an-dt-btn" disabled={disabled} onClick={toggle}>
				<Icon name="package" size={16} />
				<span className={value.length ? "" : "an-ph"}>
					{value.length ? `${value.length} product${value.length === 1 ? "" : "s"} selected` : "All members"}
				</span>
			</button>
			{open && (
				<>
					<div className="an-backdrop" onClick={() => setOpen(false)} />
					<div className="an-pop right wide">
						<div className="an-sheet-grip" />
						{loading || !data ? (
							<p className="an-muted">Loading products...</p>
						) : data.error === "PERMISSION" ? (
							<p className="an-error">
								Add the access_pass:basic:read permission to this app (Developer, Announcements,
								Permissions) and approve it in this community.
							</p>
						) : data.error ? (
							<p className="an-error">{data.error}</p>
						) : data.products.length === 0 ? (
							<p className="an-muted">No products found in this community.</p>
						) : (
							<div className="an-list an-scroll">
								{data.products.map((p: any) => (
									<label key={p.id} className="an-list-item an-check">
										<input
											type="checkbox"
											checked={value.includes(p.id)}
											onChange={() => flip(p.id)}
										/>
										{p.title}
									</label>
								))}
							</div>
						)}
						<div className="an-pop-foot">
							<button type="button" className="an-link-btn" onClick={() => onChange([])}>
								Everyone
							</button>
							<button type="button" className="an-btn" onClick={() => setOpen(false)}>
								Done
							</button>
						</div>
					</div>
				</>
			)}
		</div>
	);
}

function FormFields(props: any) {
	const {
		formAction,
		pending,
		plan,
		mode,
		id,
		initial,
		cancelHref,
		liveCount,
		channels,
		emailReady,
		chatReady,
		settingsHref,
		prepareUpload,
		fetchProducts,
		fetchMentionMembers,
	} = props;
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
	const [readOnly, setReadOnly] = useState(false);
	const [targets, setTargets] = useState<string[]>([]);
	const [sel, setSel] = useState<Record<string, boolean>>({});

	useEffect(() => {
		setRid(crypto.randomUUID());
	}, []);

	const setOne = (k: string) => (v: boolean) => setSel((s) => ({ ...s, [k]: v }));

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
			onKeyDown={(e) => {
				if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
					e.preventDefault();
				}
			}}
		>
			<div className="an-card">
				{mode === "create" && (
					<div className="an-chip-row">
						{QUICK.map((t) => (
							<button key={t.label} type="button" className="an-chip" onClick={() => apply(t)}>
								{t.label}
							</button>
						))}
						<Select placeholder="More templates" groups={TEMPLATE_GROUPS} onSelect={applyNiche} />
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

				<RichEditor
					value={body}
					onChange={setBody}
					attach={mode === "create"}
					attachMax={f.attachMax}
					attachMb={f.attachMb}
					mentions={f.mentions}
					prepareUpload={prepareUpload}
					fetchMentionMembers={fetchMentionMembers}
				/>

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
								<input name="poll_q" className="an-input" placeholder="Question" maxLength={140} />
								{[1, 2, 3, 4].map((n) => (
									<input
										key={n}
										name={`poll_o${n}`}
										className="an-input"
										placeholder={`Option ${n}${n > 2 ? " (optional)" : ""}`}
										maxLength={80}
									/>
								))}
								<button type="button" className="an-link-btn" onClick={() => setPollOpen(false)}>
									Remove poll
								</button>
							</Panel>
						) : (
							<Panel title="Poll">
								<button type="button" className="an-link-btn" onClick={() => setPollOpen(true)}>
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
					<Panel title={'Require "I\'ve read this"'} lock={f.acknowledge ? undefined : "Pro"}>
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

					<Panel title="Read-only mode">
						<label className="an-toggle">
							<input
								type="checkbox"
								className="an-switch"
								name="read_only"
								checked={readOnly}
								onChange={(e) => setReadOnly(e.target.checked)}
							/>
							<span className="an-muted">Disable comments</span>
						</label>
					</Panel>

					<Panel title="Schedule for later" lock={f.schedule ? undefined : "Pro"}>
						<DateTimePicker
							value={schedule}
							onChange={setSchedule}
							disabled={!f.schedule}
							placeholder="Pick date and time"
						/>
						{f.schedule && <input type="hidden" name="publish_at" value={schedule} />}
					</Panel>

					<Panel title="Event countdown" lock={f.countdown ? undefined : "Pro"}>
						<DateTimePicker
							value={eventAt}
							onChange={setEventAt}
							disabled={!f.countdown}
							placeholder="Pick date and time"
						/>
						{f.countdown && <input type="hidden" name="event_at" value={eventAt} />}
					</Panel>

					<Panel title="Auto-remove after" lock={f.expire ? undefined : "Pro"}>
						<DateTimePicker
							value={expires}
							onChange={setExpires}
							disabled={!f.expire}
							placeholder="Pick date and time"
						/>
						{f.expire && <input type="hidden" name="expires_at" value={expires} />}
					</Panel>

					<Panel title="Target specific products" lock={f.targetProducts ? undefined : "Pro"}>
						<ProductPicker
							disabled={!f.targetProducts}
							fetchProducts={fetchProducts}
							value={targets}
							onChange={setTargets}
						/>
						<input type="hidden" name="targets" value={JSON.stringify(f.targetProducts ? targets : [])} />
					</Panel>

					<Panel title="Also send to">
						<p className="an-muted an-note">
							<Icon name="bell" size={13} /> Push goes to all members automatically.
						</p>
						<div className="an-chip-row">
							{channels.map((c: any) => (
								<Chip
									key={c.id}
									name={`ch_${c.id}`}
									label={`${c.kind === "discord" ? "Discord" : "Telegram"}: ${c.name}`}
									checked={!!sel[`ch_${c.id}`]}
									onChange={setOne(`ch_${c.id}`)}
								/>
							))}
							{emailReady && (
								<Chip
									name="email"
									label="Email"
									checked={!!sel.email}
									onChange={setOne("email")}
									disabled={!f.email}
									lock={!f.email}
								/>
							)}
							<Chip
								name="chat"
								label={chatReady || !f.whopChat ? "Whop chat" : "Whop chat (set up in Settings)"}
								checked={!!sel.chat}
								onChange={setOne("chat")}
								disabled={!f.whopChat || !chatReady}
								lock={!f.whopChat}
							/>
							<Chip
								name="forum"
								label="Whop forum"
								checked={!!sel.forum}
								onChange={setOne("forum")}
								disabled={!f.whopForum}
								lock={!f.whopForum}
							/>
						</div>
						{(!f.whopChat || !f.whopForum) && (
							<p className="an-muted">Whop chat and forum are on the Pro plan.</p>
						)}
						{channels.length === 0 && (
							<p className="an-muted">No Discord or Telegram channels yet.</p>
						)}
						<Link href={settingsHref} prefetch={false} className="an-link-btn">
							Manage channels in Settings
						</Link>
					</Panel>
				</div>
			)}
		</form>
	);
}

export function CreateForm(props: any) {
	const { action, mode } = props;
	const [state, formAction, pending] = useActionState(action, null as FormResult);
	const [k, setK] = useState(0);

	useEffect(() => {
		if (state?.ok && mode === "create") setK((n) => n + 1);
	}, [state, mode]);

	return (
		<>
			{state ? (
				<p className={`an-notice ${state.ok ? "ok" : "bad"}`}>{state.message}</p>
			) : null}
			<FormFields key={k} {...props} formAction={formAction} pending={pending} />
		</>
	);
}