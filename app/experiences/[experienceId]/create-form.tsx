// @ts-nocheck
"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useEffect, useState } from "react";
import { FEATURES } from "@/lib/plans";
import { BrandIcon } from "./brand";
import { RichEditor } from "./editor";
import { Icon } from "./icons";
import { DateTimePicker, Select } from "./pickers";
import { QUICK, TEMPLATES } from "./templates";

export type FormResult = { ok: boolean; message: string } | null;

const TEMPLATE_GROUPS = TEMPLATES.map((g) => ({
	label: g.group,
	items: g.items.map((t) => ({ value: `${g.group}|${t.label}`, label: t.label })),
}));

function Panel({ title, lock, children }: { title: string; lock?: string; children: ReactNode }) {
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

function SendTo({ channels, emailReady, chatReady, f, sel, setSel, settingsHref }: any) {
	const [open, setOpen] = useState(false);
	const discord = channels.filter((c: any) => c.kind === "discord");
	const telegram = channels.filter((c: any) => c.kind === "telegram");
	const groups: any[] = [
		{
			label: "Discord",
			rows: discord.length
				? discord.map((c: any) => ({ key: `ch_${c.id}`, kind: "discord", label: c.name }))
				: [{ key: "x-discord", kind: "discord", label: "Discord", note: "Connect in Settings", off: true }],
		},
		{
			label: "Telegram",
			rows: telegram.length
				? telegram.map((c: any) => ({ key: `ch_${c.id}`, kind: "telegram", label: c.name }))
				: [{ key: "x-telegram", kind: "telegram", label: "Telegram", note: "Connect in Settings", off: true }],
		},
		{
			label: "Whop",
			rows: [
				{ key: "chat", kind: "chat", label: "Whop chat", note: !f.whopChat ? "Pro" : !chatReady ? "Set up in Settings" : "", off: !f.whopChat || !chatReady },
				{ key: "forum", kind: "forum", label: "Whop public forum", note: !f.whopForum ? "Pro" : "", off: !f.whopForum },
			],
		},
	];
	if (emailReady) {
		groups.push({ label: "Email", rows: [{ key: "email", kind: "email", label: "Email to members", note: !f.email ? "Business" : "", off: !f.email }] });
	}
	const all = groups.flatMap((g) => g.rows);
	const picked = all.filter((r) => sel[r.key] && !r.off);

	return (
		<div className="an-pop-wrap block">
			<button type="button" className="an-dt-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
				<Icon name="send" size={16} />
				<span>
					Push{picked.length ? ` + ${picked.map((r) => r.label).slice(0, 2).join(", ")}${picked.length > 2 ? ` +${picked.length - 2}` : ""}` : " only"}
				</span>
			</button>
			{picked.map((r) => (
				<input key={r.key} type="hidden" name={r.key} value="on" />
			))}
			{open && (
				<>
					<div className="an-backdrop" onClick={() => setOpen(false)} />
					<div className="an-pop right wide">
						<div className="an-sheet-grip" />
						<div className="an-send-row on static">
							<BrandIcon kind="push" />
							<span className="an-grow">Push to all members</span>
							<span className="an-badge">Always on</span>
						</div>
						{groups.map((g) => (
							<div key={g.label}>
								<div className="an-list-head">{g.label}</div>
								{g.rows.map((r: any) => (
									<button
										key={r.key}
										type="button"
										disabled={r.off}
										className={`an-send-row${sel[r.key] && !r.off ? " on" : ""}`}
										onClick={() => setSel((s: any) => ({ ...s, [r.key]: !s[r.key] }))}
									>
										<BrandIcon kind={r.kind} />
										<span className="an-grow">{r.label}</span>
										{r.note ? <span className="an-badge">{r.note}</span> : null}
										{sel[r.key] && !r.off ? <Icon name="check" size={16} /> : null}
									</button>
								))}
							</div>
						))}
						<div className="an-pop-foot">
							<Link href={settingsHref} prefetch={false} className="an-link-btn">
								Manage channels in Settings
							</Link>
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

function ProductPicker({ disabled, fetchProducts, value, onChange }: any) {
	const [open, setOpen] = useState(false);
	const [data, setData] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [q, setQ] = useState("");

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
	const has = (id: string) => value.some((p: any) => p.id === id);
	const flip = (p: any) =>
		onChange(has(p.id) ? value.filter((x: any) => x.id !== p.id) : [...value, { id: p.id, title: p.title, url: p.url }].slice(0, 10));
	const list = (data?.products ?? []).filter((p: any) => p.title.toLowerCase().includes(q.trim().toLowerCase()));

	return (
		<div className="an-stack">
			<div className="an-pop-wrap block">
				<button type="button" className="an-dt-btn" disabled={disabled} onClick={toggle}>
					<Icon name="package" size={16} />
					<span className={value.length ? "" : "an-ph"}>{value.length ? `${value.length} product${value.length === 1 ? "" : "s"} attached` : "Attach a product"}</span>
				</button>
				{open && (
					<>
						<div className="an-backdrop" onClick={() => setOpen(false)} />
						<div className="an-pop right wide">
							<div className="an-sheet-grip" />
							<input className="an-input" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
							{loading || !data ? (
								<p className="an-muted">Loading products...</p>
							) : data.error === "PERMISSION" ? (
								<p className="an-error">Add the access_pass:basic:read permission to this app and approve it in this community.</p>
							) : data.error ? (
								<p className="an-error">{data.error}</p>
							) : list.length === 0 ? (
								<p className="an-muted">No products found.</p>
							) : (
								<div className="an-list an-scroll">
									{list.map((p: any) => (
										<button key={p.id} type="button" className={`an-send-row${has(p.id) ? " on" : ""}`} onClick={() => flip(p)}>
											<span className="an-product-icon sm"><Icon name="package" size={16} /></span>
											<span className="an-grow">{p.title}</span>
											{has(p.id) ? <Icon name="check" size={16} /> : null}
										</button>
									))}
								</div>
							)}
							<div className="an-pop-foot">
								<span className="an-muted">Members get a View product button</span>
								<button type="button" className="an-btn" onClick={() => setOpen(false)}>Done</button>
							</div>
						</div>
					</>
				)}
			</div>
			{value.map((p: any) => (
				<div className="an-product" key={p.id}>
					<span className="an-product-icon"><Icon name="package" size={18} /></span>
					<div className="an-grow">
						<b>{p.title}</b>
						<a className="an-link" href={p.url} target="_blank" rel="noopener noreferrer">Preview link</a>
					</div>
					<button type="button" className="an-icon-btn" title="Remove" onClick={() => onChange(value.filter((x: any) => x.id !== p.id))}>
						<Icon name="x" size={14} />
					</button>
				</div>
			))}
		</div>
	);
}

function FormFields(props: any) {
	const { formAction, pending, plan, mode, id, initial, cancelHref, liveCount, channels, emailReady, chatReady, settingsHref, prepareUpload, fetchProducts, fetchMentionMembers } = props;
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
	const [targets, setTargets] = useState<any[]>([]);
	const [sel, setSel] = useState<Record<string, boolean>>({});

	useEffect(() => {
		setRid(crypto.randomUUID());
	}, []);

	const apply = (t: { title: string; body: string }) => {
		setTitle(t.title);
		setBody(t.body);
	};
	function applyNiche(value: string) {
		for (const group of TEMPLATES)
			for (const t of group.items)
				if (`${group.group}|${t.label}` === value) {
					apply(t);
					return;
				}
	}

	return (
		<form
			action={formAction}
			className={mode === "create" ? "an-create" : "an-create single"}
			onKeyDown={(e) => {
				if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
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

				<input name="title" required maxLength={120} placeholder="Headline" value={title} onChange={(e) => setTitle(e.target.value)} className="an-input an-input-lg" />

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
							<button key={p} type="button" className={priority === p ? "on" : ""} onClick={() => setPriority(p)}>
								{p.charAt(0).toUpperCase() + p.slice(1)}
							</button>
						))}
					</div>
					<label className="an-toggle">
						<input type="checkbox" className="an-switch" name="pinned" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
						Pin to top
					</label>
				</div>

				{mode === "create" &&
					(f.poll ? (
						pollOpen ? (
							<Panel title="Poll">
								<input name="poll_q" className="an-input" placeholder="Question" maxLength={140} />
								{[1, 2, 3, 4].map((n) => (
									<input key={n} name={`poll_o${n}`} className="an-input" placeholder={`Option ${n}${n > 2 ? " (optional)" : ""}`} maxLength={80} />
								))}
								<button type="button" className="an-link-btn" onClick={() => setPollOpen(false)}>Remove poll</button>
							</Panel>
						) : (
							<Panel title="Poll">
								<button type="button" className="an-link-btn" onClick={() => setPollOpen(true)}>+ Add a poll</button>
							</Panel>
						)
					) : (
						<Panel title="Poll" lock="Pro">
							<span className="an-muted">+ Add a poll</span>
						</Panel>
					))}

				{mode === "create" && (
					<Panel title="A/B headline test" lock={f.abTest ? undefined : "Business"}>
						<input name="alt_title" className="an-input" placeholder="Alternate headline: half your members see this one" maxLength={120} disabled={!f.abTest} />
					</Panel>
				)}

				<button type="submit" disabled={pending} className="an-btn-primary">
					{pending ? (mode === "edit" ? "Saving..." : "Posting...") : mode === "edit" ? "Save changes" : schedule ? "Schedule announcement" : "Post announcement"}
				</button>
				{mode === "create" && plan === "starter" && (
					<p className="an-muted an-center">{liveCount}/{f.liveMax} free announcements used</p>
				)}
				{mode === "edit" && cancelHref ? (
					<Link href={cancelHref} prefetch={false} className="an-muted">Back to announcements</Link>
				) : null}
			</div>

			{mode === "create" && (
				<div className="an-form-right">
					<Panel title={'Require "I\'ve read this"'} lock={f.acknowledge ? undefined : "Pro"}>
						<label className="an-toggle">
							<input type="checkbox" className="an-switch" name="require_ack" checked={ack} onChange={(e) => setAck(e.target.checked)} disabled={!f.acknowledge} />
							<span className="an-muted">Track who confirmed</span>
						</label>
					</Panel>

					<Panel title="Read-only mode">
						<label className="an-toggle">
							<input type="checkbox" className="an-switch" name="read_only" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
							<span className="an-muted">Disable comments</span>
						</label>
					</Panel>

					<Panel title="Schedule for later" lock={f.schedule ? undefined : "Pro"}>
						<DateTimePicker value={schedule} onChange={setSchedule} disabled={!f.schedule} placeholder="Pick date and time" />
						{f.schedule && <input type="hidden" name="publish_at" value={schedule} />}
					</Panel>

					<Panel title="Event countdown" lock={f.countdown ? undefined : "Pro"}>
						<DateTimePicker value={eventAt} onChange={setEventAt} disabled={!f.countdown} placeholder="Pick date and time" />
						{f.countdown && <input type="hidden" name="event_at" value={eventAt} />}
					</Panel>

					<Panel title="Auto-remove after" lock={f.expire ? undefined : "Pro"}>
						<DateTimePicker value={expires} onChange={setExpires} disabled={!f.expire} placeholder="Pick date and time" />
						{f.expire && <input type="hidden" name="expires_at" value={expires} />}
					</Panel>

					<Panel title="Target specific products" lock={f.targetProducts ? undefined : "Pro"}>
						<p className="an-muted">Attach a product card with a direct link, so members can buy right from the post.</p>
						<ProductPicker disabled={!f.targetProducts} fetchProducts={fetchProducts} value={targets} onChange={setTargets} />
						<input type="hidden" name="targets" value={JSON.stringify(f.targetProducts ? targets : [])} />
					</Panel>

					<Panel title="Also send to">
						<SendTo channels={channels} emailReady={emailReady} chatReady={chatReady} f={f} sel={sel} setSel={setSel} settingsHref={settingsHref} />
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
			{state ? <p className={`an-notice ${state.ok ? "ok" : "bad"}`}>{state.message}</p> : null}
			<FormFields key={k} {...props} formAction={formAction} pending={pending} />
		</>
	);
}