// @ts-nocheck
import Link from "next/link";
import { KIND_COLOR, KIND_LABEL, KINDS, loadAnalytics } from "@/lib/analytics";
import { listChannels } from "@/lib/delivery-db";
import { FEATURES } from "@/lib/plans";
import { BrandIcon } from "./brand";
import { Icon } from "./icons";
import { ExportButton } from "./interactive";

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "-");
const nf = (n: number) => Number(n).toLocaleString("en-US");

function Line({ labels, a, b, la, lb }: any) {
	const W = 640, H = 190, P = 30;
	const max = Math.max(1, ...a, ...b);
	const x = (i: number) => P + (labels.length <= 1 ? 0 : (i * (W - 2 * P)) / (labels.length - 1));
	const y = (v: number) => H - P - (v / max) * (H - 2 * P);
	const pts = (arr: number[]) => arr.map((v, i) => `${x(i)},${y(v)}`).join(" ");
	return (
		<svg viewBox={`0 0 ${W} ${H}`} className="an-chart" role="img">
			{[0, 0.5, 1].map((t) => <line key={t} x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} className="an-grid" />)}
			<polygon points={`${x(0)},${H - P} ${pts(a)} ${x(a.length - 1)},${H - P}`} fill="#ff5a1f" opacity="0.12" />
			<polyline points={pts(a)} fill="none" stroke="#ff5a1f" strokeWidth="2.5" strokeLinejoin="round" />
			<polyline points={pts(b)} fill="none" stroke="#26a5e4" strokeWidth="2.5" strokeLinejoin="round" />
			{a.map((v: number, i: number) => <circle key={`a${i}`} cx={x(i)} cy={y(v)} r="4" fill="#ff5a1f" className="an-pt"><title>{`${labels[i]}: ${v} ${la}`}</title></circle>)}
			{b.map((v: number, i: number) => <circle key={`b${i}`} cx={x(i)} cy={y(v)} r="4" fill="#26a5e4" className="an-pt"><title>{`${labels[i]}: ${v} ${lb}`}</title></circle>)}
			<text x={P - 6} y={y(max) + 4} textAnchor="end" className="an-axis">{max}</text>
			<text x={P} y={H - 8} className="an-axis">{labels[0]}</text>
			<text x={W - P} y={H - 8} textAnchor="end" className="an-axis">{labels[labels.length - 1]}</text>
		</svg>
	);
}

function Donut({ ok, bad }: any) {
	const t = ok + bad, r = 46, c = 2 * Math.PI * r;
	const okLen = t ? (ok / t) * c : 0, badLen = t ? (bad / t) * c : 0;
	return (
		<svg viewBox="0 0 120 120" className="an-donut" role="img">
			<g transform="rotate(-90 60 60)">
				<circle cx="60" cy="60" r={r} fill="none" stroke="var(--soft)" strokeWidth="14" />
				{okLen > 0 && <circle cx="60" cy="60" r={r} fill="none" stroke="#3ecf8e" strokeWidth="14" strokeDasharray={`${okLen} ${c - okLen}`}><title>{`${ok} delivered`}</title></circle>}
				{badLen > 0 && <circle cx="60" cy="60" r={r} fill="none" stroke="#ff4d5e" strokeWidth="14" strokeDasharray={`${badLen} ${c - badLen}`} strokeDashoffset={-okLen}><title>{`${bad} failed`}</title></circle>}
			</g>
			<text x="60" y="58" textAnchor="middle" className="an-donut-n">{pct(ok, t)}</text>
			<text x="60" y="74" textAnchor="middle" className="an-axis">success</text>
		</svg>
	);
}

function Kpi({ icon, label, value, hint }: any) {
	return (
		<div className="an-card an-stat">
			<span className="ico"><Icon name={icon} size={18} /></span>
			<b>{value}</b>
			<span>{label}</span>
			<span className="an-muted an-hint2">{hint}</span>
		</div>
	);
}

export async function AnalyticsView({ experienceId, posts, plan, stats, searchParams }: any) {
	const sp: any = await searchParams;
	const range = [7, 14, 30].includes(Number(sp?.range)) ? Number(sp.range) : 30;
	const ch = KINDS.includes(sp?.ch) ? sp.ch : "all";
	const postId = typeof sp?.post === "string" ? sp.post : "";
	const f = FEATURES[plan];
	const href = (o: any = {}) => {
		const q = { range, ch, post: postId, ...o };
		return `/experiences/${experienceId}?view=analytics&range=${q.range}&ch=${q.ch}${q.post ? `&post=${q.post}` : ""}`;
	};

	let data: any = null;
	try {
		data = await loadAnalytics(experienceId, posts, range, await listChannels(experienceId));
	} catch {
		return (
			<>
				<div className="an-head"><h1>Analytics</h1></div>
				<div className="an-card"><p className="an-error">Analytics could not load. Make sure you ran the latest SQL in Supabase, then reload.</p></div>
			</>
		);
	}

	const kinds = ch === "all" ? KINDS : [ch];
	const T = data.totals;
	const sum = (m: string, ks = kinds) => ks.reduce((n: number, k: string) => n + (T[k]?.[m] ?? 0), 0);
	const inApp = kinds.includes("whop");
	const sent = sum("sent"), failed = sum("failed"), clicks = sum("clicks");
	const views = inApp ? T.whop.views : 0, reactions = inApp ? T.whop.reactions : 0, comments = inApp ? T.whop.comments : 0, acks = inApp ? T.whop.acks : 0;
	const published = posts.filter((p: any) => new Date(p.publish_at) >= new Date(data.since) && new Date(p.publish_at) <= new Date()).length;
	const engaged = reactions + comments + clicks + acks;
	const ackPosts = posts.filter((p: any) => p.require_ack);
	const ackViews = ackPosts.reduce((n: number, p: any) => n + (stats[p.id]?.view_count ?? 0), 0);
	const ackDone = ackPosts.reduce((n: number, p: any) => n + (stats[p.id]?.ack_count ?? 0), 0);

	const labels = data.dayList.map((d: string) => d.slice(5));
	const dayVal = (d: string, fn: (c: any, k: string) => number) => kinds.reduce((n: number, k: string) => n + fn(data.perDay[d]?.[k] ?? {}, k), 0);
	const seriesViews = data.dayList.map((d: string) => dayVal(d, (c) => c.views ?? 0));
	const seriesEng = data.dayList.map((d: string) => dayVal(d, (c) => (c.reactions ?? 0) + (c.comments ?? 0) + (c.acks ?? 0) + (c.clicks ?? 0)));

	const scoreOf = (id: string) => {
		const pp = data.perPost[id] ?? {};
		let s = 0;
		for (const k of KINDS) { const c = pp[k] ?? {}; s += (c.views ?? 0) + (c.reactions ?? 0) + (c.comments ?? 0) + (c.clicks ?? 0) + (c.acks ?? 0); }
		return s;
	};
	const top = [...posts].sort((a: any, b: any) => scoreOf(b.id) - scoreOf(a.id)).slice(0, 8);
	const topMax = Math.max(1, ...top.map((p: any) => scoreOf(p.id)));
	const noData = published === 0 && sent + failed === 0 && views === 0;

	const sel = posts.find((p: any) => p.id === postId);
	const selData = sel ? data.perPost[sel.id] ?? {} : {};
	const selErrors = sel ? data.logs.filter((l: any) => l.announcement_id === sel.id && !l.ok) : [];

	const csv = [
		["title", "published", "views", "reactions", "comments", "confirmed", "clicks", "deliveries_sent", "deliveries_failed"].join(","),
		...posts.map((p: any) => {
			const pp = data.perPost[p.id] ?? {};
			const s = (m: string) => KINDS.reduce((n, k) => n + (pp[k]?.[m] ?? 0), 0);
			return [`"${String(p.title).replace(/"/g, '""')}"`, p.publish_at, s("views"), s("reactions"), s("comments"), s("acks"), s("clicks"), s("sent"), s("failed")].join(",");
		}),
	].join("\n");

	const charts = (
		<>
			<div className="an-card">
				<div className="an-row"><h2 className="an-title">Views and engagement over time</h2>
					<div className="an-legend"><span><i style={{ background: "#ff5a1f" }} />Views (in Whop)</span><span><i style={{ background: "#26a5e4" }} />Engagement</span></div>
				</div>
				<Line labels={labels} a={seriesViews} b={seriesEng} la="views" lb="engagement actions" />
				<p className="an-muted">Engagement = reactions, comments, confirmations and link clicks. Hover a dot for the exact number.</p>
			</div>

			<div className="an-two">
				<div className="an-card">
					<h2 className="an-title">Delivery success</h2>
					<div className="an-donut-wrap">
						<Donut ok={sent} bad={failed} />
						<div className="an-legend col"><span><i style={{ background: "#3ecf8e" }} />{nf(sent)} delivered</span><span><i style={{ background: "#ff4d5e" }} />{nf(failed)} failed</span><span><i style={{ background: "#8a7d76" }} />{nf(kinds.reduce((n: number, k: string) => n + (data.pending[k] ?? 0), 0))} pending</span></div>
					</div>
				</div>
				<div className="an-card">
					<h2 className="an-title">Engagement funnel</h2>
					{[["Delivered", sent, "#3ecf8e"], ["Viewed in Whop", views, "#ff5a1f"], ["Engaged", engaged, "#26a5e4"]].map(([l, v, c]: any) => {
						const m = Math.max(1, sent, views, engaged);
						return (
							<div key={l} className="an-bar-row">
								<div className="an-bar-top"><span>{l}</span><span className="an-muted">{nf(v)}</span></div>
								<div className="an-bar"><i style={{ width: `${(v / m) * 100}%`, background: c }} /></div>
							</div>
						);
					})}
					<p className="an-muted">Views and reactions are measured inside Whop. Other platforms report deliveries and clicks.</p>
				</div>
			</div>

			<div className="an-card">
				<h2 className="an-title">Platform comparison</h2>
				<div className="an-ptable">
					<div className="an-prow head"><span>Platform</span><span>Delivered</span><span>Failed</span><span>Pending</span><span>Success</span><span>Clicks</span><span>Recipients</span></div>
					{KINDS.map((k) => {
						const c = T[k];
						const isWhop = k === "whop";
						return (
							<Link key={k} href={href({ ch: ch === k ? "all" : k })} prefetch={false} className={`an-prow${ch === k ? " on" : ""}`}>
								<span className="an-pl"><BrandIcon kind={k} size={16} />{KIND_LABEL[k]}</span>
								<span>{isWhop ? `${nf(c.views)} views` : nf(c.sent)}</span>
								<span>{isWhop ? `${nf(c.reactions)} reactions` : nf(c.failed)}</span>
								<span>{isWhop ? `${nf(c.comments)} comments` : nf(data.pending[k] ?? 0)}</span>
								<span>{isWhop ? "-" : pct(c.sent, c.sent + c.failed)}</span>
								<span>{nf(c.clicks)}</span>
								<span>{k === "email" && data.emailRecipients ? nf(data.emailRecipients) : "-"}</span>
							</Link>
						);
					})}
				</div>
				<p className="an-muted">Click a platform to filter the whole page. Whop (in-app) shows views, reactions and comments in the same columns.</p>
			</div>

			<div className="an-card">
				<h2 className="an-title">Top announcements</h2>
				{top.length === 0 ? <p className="an-muted">No announcements yet.</p> : top.map((p: any) => (
					<Link key={p.id} href={href({ post: p.id })} prefetch={false} className={`an-top${p.id === postId ? " on" : ""}`}>
						<div className="an-bar-top"><span>{p.title}</span><span className="an-muted">{nf(scoreOf(p.id))} interactions</span></div>
						<div className="an-bar"><i style={{ width: `${(scoreOf(p.id) / topMax) * 100}%` }} /></div>
					</Link>
				))}
				<p className="an-muted">Click an announcement to see its breakdown by platform.</p>
			</div>

			{sel && (
				<div className="an-card">
					<div className="an-row"><h2 className="an-title">{sel.title}</h2><Link href={href({ post: "" })} prefetch={false} className="an-link-btn">Close</Link></div>
					<p className="an-muted">Published {new Date(sel.publish_at).toUTCString().slice(0, 22)} UTC</p>
					<div className="an-ptable">
						<div className="an-prow head d"><span>Platform</span><span>Status</span><span>Clicks</span><span>Views / reactions / comments</span></div>
						{KINDS.map((k) => {
							const c = selData[k] ?? {};
							const pend = sel.deliver && !sel.delivered_at ? (k === "push" ? sel.deliver.push : k === "email" ? sel.deliver.email : k === "chat" ? sel.deliver.chat : k === "forum" ? sel.deliver.forum : false) : false;
							const st = k === "whop" ? "Posted" : c.failed ? "Failed" : c.sent ? "Delivered" : pend ? "Pending" : "Not sent";
							return (
								<div key={k} className="an-prow d">
									<span className="an-pl"><BrandIcon kind={k} size={16} />{KIND_LABEL[k]}</span>
									<span><span className={`an-pill ${st === "Failed" ? "bad" : st === "Delivered" || st === "Posted" ? "ok" : ""}`}>{st}</span></span>
									<span>{nf(c.clicks ?? 0)}</span>
									<span>{k === "whop" ? `${nf(c.views ?? 0)} / ${nf(c.reactions ?? 0)} / ${nf(c.comments ?? 0)}` : "-"}</span>
								</div>
							);
						})}
					</div>
					{selErrors.length > 0 && (
						<div>
							<div className="an-list-head">Failed deliveries</div>
							{selErrors.map((l: any, i: number) => <p key={i} className="an-error"><b>{l.channel}:</b> {l.detail}</p>)}
						</div>
					)}
				</div>
			)}
		</>
	);

	return (
		<>
			<div className="an-row">
				<div className="an-head"><h1>Analytics</h1><p className="an-muted">Performance across Whop, Discord, Telegram, push and more</p></div>
				{f.csvExport ? <ExportButton csv={csv} filename="announcements.csv" /> : <span className="an-badge"><Icon name="lock" size={11} /> Export CSV · Business</span>}
			</div>

			<div className="an-filters">
				<div className="an-seg">{[7, 14, 30].map((r) => <Link key={r} href={href({ range: r })} prefetch={false} className={`an-seglink${range === r ? " on" : ""}`}>{r} days</Link>)}</div>
				<div className="an-seg">
					<Link href={href({ ch: "all" })} prefetch={false} className={`an-seglink${ch === "all" ? " on" : ""}`}>All</Link>
					{KINDS.map((k) => <Link key={k} href={href({ ch: k })} prefetch={false} className={`an-seglink${ch === k ? " on" : ""}`}><BrandIcon kind={k} size={14} />{KIND_LABEL[k].replace(" (in-app)", "")}</Link>)}
				</div>
			</div>

			<div className="an-kpis">
				<Kpi icon="megaphone" label="Announcements sent" value={nf(published)} hint="Published in this period" />
				<Kpi icon="send" label="Deliveries" value={nf(sent + failed)} hint={`${pct(sent, sent + failed)} delivered, ${nf(failed)} failed`} />
				<Kpi icon="eye" label="Views" value={inApp ? nf(views) : "-"} hint="Opened inside Whop" />
				<Kpi icon="users" label="Reactions" value={inApp ? nf(reactions) : "-"} hint="Emoji reactions inside Whop" />
				<Kpi icon="comment" label="Comments" value={inApp ? nf(comments) : "-"} hint="Replies inside Whop" />
				<Kpi icon="link" label="Clicks" value={nf(clicks)} hint="Links and product buttons" />
				<Kpi icon="check" label="Read-confirm rate" value={pct(ackDone, ackViews)} hint="Members who tapped I've read this" />
				<Kpi icon="chart" label="Engagement rate" value={inApp && views ? pct(engaged, views) : "-"} hint="Interactions per view" />
			</div>

						{data.warnings?.length > 0 && <div className="an-card"><p className="an-muted">Some numbers could not be loaded ({data.warnings.join(", ")}). Everything else on this page is accurate.{data.warnings.includes("click tracking") ? " Click counts need the one-time click_events setup in Supabase." : ""}</p></div>} <div className="an-card"><p className="an-muted">No activity in this period yet. Post an announcement and the charts will fill in.</p></div>}

			{f.fullAnalytics ? charts : (
				<div className="an-lockwrap">
					<div className="blur">{charts}</div>
					<div className="an-lockover">
						<Icon name="lock" size={22} />
						<span>Charts and platform breakdowns are on Pro</span>
						<Link href={`/experiences/${experienceId}?view=plans`} prefetch={false} className="an-btn">See plans</Link>
					</div>
				</div>
			)}
		</>
	);
}