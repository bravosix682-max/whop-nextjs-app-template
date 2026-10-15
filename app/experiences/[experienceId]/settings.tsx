// @ts-nocheck
"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { BrandIcon, kindFromLabel } from "./brand";
import { Icon } from "./icons";
import { useThemeMode } from "./shell";

function Card({ icon, brand, title, sub, badge, children }: any) {
	return (
		<section className="an-card an-set">
			<div className="an-set-head">
				{brand ? <BrandIcon kind={brand} size={22} tile /> : (
					<span className="an-set-icon"><Icon name={icon} size={18} /></span>
				)}
				<div className="an-grow">
					<div className="an-set-title">{title}</div>
					{sub ? <div className="an-muted">{sub}</div> : null}
				</div>
				{badge ? (
					<span className="an-badge"><Icon name="lock" size={11} /> {badge}</span>
				) : null}
			</div>
			{children}
		</section>
	);
}

function Toggle({ label, sub, checked, onChange, disabled }: any) {
	return (
		<label className="an-toggle-row">
			<span className="an-grow">
				<b>{label}</b>
				{sub ? <span className="an-muted">{sub}</span> : null}
			</span>
			<input type="checkbox" className="an-switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
		</label>
	);
}

export function AppearanceCard() {
	const { mode, setMode } = useThemeMode();
	const opts = [["system", "System", "monitor", "Match your device"], ["light", "Light", "sun", "Always light"], ["dark", "Dark", "moon", "Always dark"]];
	return (
		<Card icon="sun" title="Appearance" sub="Choose how the app looks. System follows your device.">
			<div className="an-theme-opts">
				{opts.map(([v, label, icon, sub]) => (
					<button key={v} type="button" className={`an-theme-opt${mode === v ? " on" : ""}`} onClick={() => setMode(v)}>
						<Icon name={icon} size={20} />
						<b>{label}</b>
						<span className="an-muted">{sub}</span>
					</button>
				))}
			</div>
			<p className="an-muted">Saved on this device.</p>
		</Card>
	);
}

export function NotificationsCard({ initial, save }: any) {
	const [v, setV] = useState(initial);
	const [msg, setMsg] = useState("");
	const [pending, start] = useTransition();
	const set = (k: string) => (val: boolean) => setV((s: any) => ({ ...s, [k]: val }));
	return (
		<Card icon="bell" title="Notification settings" sub="Choose which notifications go out and which you receive.">
			<Toggle label="Push to all members" sub="Every new announcement sends a push notification to your members." checked={v.push_enabled} onChange={set("push_enabled")} />
			<Toggle label="Reactions" sub="Get notified when someone reacts." checked={v.notify_reactions} onChange={set("notify_reactions")} />
			<Toggle label="Comments" sub="Get notified when someone comments on announcements." checked={v.notify_comments} onChange={set("notify_comments")} />
			<div className="an-row">
				<button type="button" className="an-btn" disabled={pending} onClick={() => start(async () => setMsg(await save(v)))}>
					{pending ? "Saving..." : "Save settings"}
				</button>
				{msg ? <span className="an-muted">{msg}</span> : null}
			</div>
		</Card>
	);
}

export function ChannelsCard({ kind, channels, max, add, remove, test }: any) {
	const isDiscord = kind === "discord";
	const [name, setName] = useState("");
	const [secret, setSecret] = useState("");
	const [target, setTarget] = useState("");
	const [msg, setMsg] = useState("");
	const [pending, start] = useTransition();
	const run = (job: () => Promise<string>, after?: () => void) =>
		start(async () => {
			setMsg(await job());
			after?.();
		});

	return (
		<Card brand={kind} title={isDiscord ? "Discord" : "Telegram"} sub={isDiscord ? "Post announcements to your Discord channels" : "Post announcements to your Telegram channels or groups"}>
			<div className="an-chan-head">
				<span className="an-muted">Connected channels</span>
				<span className={`an-pill ${isDiscord ? "dc" : "tg"}`}>{channels.length}/{max}</span>
			</div>
			<div className="an-chan-list">
				{channels.length === 0 ? (
					<p className="an-muted">No channels connected yet.</p>
				) : (
					channels.map((c: any) => (
						<div className={`an-chan ${isDiscord ? "dc" : "tg"}`} key={c.id}>
							<BrandIcon kind={kind} size={20} tile />
							<div className="an-grow">
								<b>{c.name}</b>
								<div className="an-muted">
									<span className="an-dot ok inline" /> Connected · {isDiscord ? `webhook ends in ${c.hint}` : `${c.target} · bot ends in ${c.hint}`}
								</div>
							</div>
							<button type="button" className="an-btn-ghost" disabled={pending} onClick={() => run(() => test(c.id))}>Test</button>
							<button type="button" className="an-btn-danger" disabled={pending} onClick={() => run(() => remove(c.id))}>Remove</button>
						</div>
					))
				)}
			</div>

			<div className="an-newchan">
				<b>Add a channel</b>
				<input className="an-input" placeholder={isDiscord ? "Channel name, for example Announcements" : "Name, for example My channel"} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
				<input className="an-input" placeholder={isDiscord ? "https://discord.com/api/webhooks/..." : "Bot token, for example 123456:ABC..."} value={secret} onChange={(e) => setSecret(e.target.value)} />
				{!isDiscord && <input className="an-input" placeholder="Channel or group ID, for example @mychannel or -1001234567890" value={target} onChange={(e) => setTarget(e.target.value)} />}
				<details className="an-how">
					<summary>{isDiscord ? "How to get your webhook URL" : "How to connect Telegram"}</summary>
					{isDiscord ? (
						<ol className="an-steps">
							<li>Open your Discord server and the channel you want to post in.</li>
							<li>Open Channel settings, then Integrations, then Webhooks.</li>
							<li>Click New Webhook, then Copy Webhook URL.</li>
							<li>Paste it above and click Add channel.</li>
						</ol>
					) : (
						<ol className="an-steps">
							<li>In Telegram, message @BotFather, send /newbot and follow the steps.</li>
							<li>Copy the bot token and paste it above.</li>
							<li>Add your bot to your channel or group and make it an admin.</li>
							<li>Public channel: use @channelname. Group: use its numeric ID, which starts with -100.</li>
						</ol>
					)}
				</details>
				<button
					type="button"
					className={`an-btn-primary an-brandbtn ${isDiscord ? "dc" : "tg"}`}
					disabled={pending || !name.trim() || !secret.trim()}
					onClick={() => run(() => add(kind, name, secret, target), () => { setName(""); setSecret(""); setTarget(""); })}
				>
					{pending ? "Working..." : "Add channel"}
				</button>
			</div>
			{msg ? <p className="an-muted">{msg}</p> : null}
		</Card>
	);
}

export function CrossPostCard({ locked, chatId, save, upgradeHref }: any) {
	const [v, setV] = useState(chatId);
	const [msg, setMsg] = useState("");
	const [pending, start] = useTransition();
	return (
		<Card icon="globe" title="Whop chat and public forum" sub="Post announcements to your Whop chat and the Whop public forum." badge={locked ? "Pro" : undefined}>
			{locked ? (
				<p className="an-muted">Cross-posting requires the Pro plan. <Link href={upgradeHref} prefetch={false} className="an-link">See plans</Link></p>
			) : (
				<>
					<div className="an-stack">
						<input className="an-input" placeholder="Chat code, for example exp_XXXXXXXX" value={v} onChange={(e) => setV(e.target.value)} />
						<p className="an-muted">Open your chat in Whop. The address contains a code starting with exp_. Paste it here. The public forum needs no setup, only the forum permission on this app.</p>
					</div>
					<div className="an-row">
						<button type="button" className="an-btn" disabled={pending} onClick={() => start(async () => setMsg(await save(v)))}>{pending ? "Saving..." : "Save"}</button>
						{msg ? <span className="an-muted">{msg}</span> : null}
					</div>
				</>
			)}
		</Card>
	);
}

export function SpamCard({ locked, enabled, save, upgradeHref }: any) {
	const [on, setOn] = useState(enabled);
	const [msg, setMsg] = useState("");
	const [pending, start] = useTransition();
	return (
		<Card icon="shield" title="Spam protection" sub="Keeps comments clean." badge={locked ? "Pro" : undefined}>
			{locked ? (
				<p className="an-muted">Spam control requires the Pro plan. <Link href={upgradeHref} prefetch={false} className="an-link">See plans</Link></p>
			) : (
				<>
					<Toggle
						label="Protect comments"
						sub="Blocks links and repeated comments, and limits members to 3 comments a minute and 30 a day."
						checked={on}
						disabled={pending}
						onChange={(val: boolean) => {
							setOn(val);
							start(async () => {
								const r = await save({ spam_protection: val });
								setMsg(r);
								if (r !== "Saved.") setOn(!val);
							});
						}}
					/>
					{msg ? <p className="an-muted">{msg}</p> : null}
				</>
			)}
		</Card>
	);
}

export function BansCard({ locked, load, ban, unban, upgradeHref }: any) {
	const [data, setData] = useState<any>(null);
	const [q, setQ] = useState("");
	const [msg, setMsg] = useState("");
	const [confirm, setConfirm] = useState("");
	const [pending, start] = useTransition();

	function refresh() {
		setData(null);
		setMsg("");
		start(async () => setData(await load()));
	}
	useEffect(() => {
		if (!locked) refresh();
	}, []);

	function flip(m: any) {
		start(async () => {
			const err = m.banned ? await unban(m.id) : await ban({ id: m.id, name: m.name, handle: m.handle });
			setConfirm("");
			if (err) setMsg(err);
			else {
				setMsg(m.banned ? `${m.name || m.handle} was unbanned.` : `${m.name || m.handle} was banned.`);
				setData((d: any) => ({ ...d, members: d.members.map((x: any) => (x.id === m.id ? { ...x, banned: !m.banned } : x)) }));
			}
		});
	}
	const list = (data?.members ?? []).filter((m: any) => `${m.name} ${m.handle}`.toLowerCase().includes(q.trim().toLowerCase()));
	const bannedCount = (data?.members ?? []).filter((m: any) => m.banned).length;

	return (
		<Card icon="ban" title="User ban list" sub="Banned users cannot comment, react or vote." badge={locked ? "Business" : undefined}>
			{locked ? (
				<p className="an-muted">The ban list requires the Business plan. <Link href={upgradeHref} prefetch={false} className="an-link">See plans</Link></p>
			) : (
				<>
					<div className="an-row">
						<input className="an-input" style={{ flex: 1 }} placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
						<button type="button" className="an-btn-ghost" disabled={pending} onClick={refresh}><Icon name="refresh" size={14} /> Refresh</button>
					</div>
					{data === null ? (
						<p className="an-muted">Loading members...</p>
					) : data.error === "PERMISSION" ? (
						<p className="an-error">Add the member:basic:read permission to this app (Developer, Announcements, Permissions) and approve it in this community.</p>
					) : (
						<>
							{data.error ? <p className="an-error">Could not load every member. {data.error}</p> : null}
							<p className="an-muted">{bannedCount} banned · {list.length} shown</p>
							<div className="an-members an-members-scroll">
								{list.length === 0 ? (
									<p className="an-muted">No members found.</p>
								) : (
									list.map((m: any) => (
										<div className="an-member" key={m.id}>
											<span className="an-avatar">{(m.name || m.handle || "?").charAt(0).toUpperCase()}</span>
											<div className="an-grow">
												<b>{m.name || m.handle}</b>
												{m.handle ? <div className="an-muted">@{m.handle}</div> : null}
											</div>
											{m.banned ? <span className="an-pill bad">Banned</span> : null}
											{confirm === m.id ? (
												<>
													<button type="button" className="an-btn-danger" disabled={pending} onClick={() => flip(m)}>Confirm ban</button>
													<button type="button" className="an-btn-ghost" onClick={() => setConfirm("")}>Cancel</button>
												</>
											) : (
												<button type="button" className={m.banned ? "an-btn-ghost" : "an-btn-danger"} disabled={pending} onClick={() => (m.banned ? flip(m) : setConfirm(m.id))}>
													{m.banned ? "Unban" : "Ban"}
												</button>
											)}
										</div>
									))
								)}
							</div>
						</>
					)}
					{msg ? <p className="an-muted">{msg}</p> : null}
				</>
			)}
		</Card>
	);
}

function hintFor(row: any) {
	const d = String(row.detail ?? "");
	if (row.ok) return "";
	if (/40[13]|did not allow|permission/i.test(d)) return "Whop blocked this. Add the permission to the app and approve it in your community.";
	if (/404|unknown webhook|invalid webhook/i.test(d)) return "The destination no longer exists. Remove the channel in Settings and add it again.";
	if (/not connected|not set up/i.test(d)) return "Finish setting this channel up in Settings, then post again.";
	if (/429|too fast|rate/i.test(d)) return "The platform is rate limiting. Wait a minute and try again.";
	return "Check the channel in Settings and send a Test message.";
}

export function LogCard({ rows, posts }: any) {
	const [open, setOpen] = useState<any>(null);
	const byId: Record<string, any> = {};
	for (const p of posts ?? []) byId[p.id] = p;
	const days: Record<string, any[]> = {};
	for (const r of rows) {
		const d = new Date(r.created_at).toISOString().slice(0, 10);
		(days[d] = days[d] ?? []).push(r);
	}
	const today = new Date().toISOString().slice(0, 10);
	const post = open ? byId[open.announcement_id] : null;
	const rec = open ? String(open.detail ?? "").match(/(\d+) member/) : null;

	return (
		<Card icon="send" title="Recent deliveries" sub="Tap any delivery to see exactly what happened.">
			{rows.length === 0 ? (
				<p className="an-muted">Nothing sent yet.</p>
			) : (
				Object.keys(days).map((d) => (
					<div key={d}>
						<div className="an-list-head">{d === today ? "Today" : new Date(d).toDateString()}</div>
						<div className="an-timeline">
							{days[d].map((r: any) => {
								const kind = kindFromLabel(r.channel);
								const p = byId[r.announcement_id];
								return (
									<button key={r.id} type="button" className="an-tl-row" onClick={() => setOpen(r)}>
										<BrandIcon kind={kind} size={18} tile />
										<div className="an-grow">
											<b>{p?.title ?? "Announcement"}</b>
											<div className="an-muted">{r.channel}</div>
										</div>
										<span className={`an-pill ${r.ok ? "ok" : "bad"}`}>{r.ok ? "Delivered" : "Failed"}</span>
										<span className="an-muted" suppressHydrationWarning>{new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
									</button>
								);
							})}
						</div>
					</div>
				))
			)}
			{open && (
				<>
					<div className="an-backdrop dim" onClick={() => setOpen(null)} />
					<div className="an-modal" role="dialog">
						<div className="an-row">
							<div className="an-set-head">
								<BrandIcon kind={kindFromLabel(open.channel)} size={22} tile />
								<div>
									<div className="an-set-title">{open.channel}</div>
									<span className={`an-pill ${open.ok ? "ok" : "bad"}`}>{open.ok ? "Delivered" : "Failed"}</span>
								</div>
							</div>
							<button type="button" className="an-icon-btn" onClick={() => setOpen(null)}><Icon name="x" size={16} /></button>
						</div>
						<div className="an-kv"><span className="an-muted">Announcement</span><b>{post?.title ?? "Deleted announcement"}</b></div>
						{post?.body ? <div className="an-kv"><span className="an-muted">Content</span><span className="an-modal-body">{String(post.body).slice(0, 500)}</span></div> : null}
						<div className="an-kv"><span className="an-muted">Delivery time</span><span suppressHydrationWarning>{new Date(open.created_at).toLocaleString()}</span></div>
						<div className="an-kv"><span className="an-muted">Recipients</span><span>{rec ? `${rec[1]} members` : "All members of the destination"}</span></div>
						<div className="an-kv"><span className="an-muted">{open.ok ? "Response" : "Error details"}</span><span className="an-modal-body">{open.detail && open.detail !== "sent" ? open.detail : open.ok ? "Accepted by the platform." : "No details returned."}</span></div>
						{!open.ok ? <p className="an-notice bad">{hintFor(open)}</p> : null}
					</div>
				</>
			)}
		</Card>
	);
}