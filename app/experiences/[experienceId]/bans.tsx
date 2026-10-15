// @ts-nocheck
"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "./icons";

export function BansPanel({ locked, load, ban, unban, upgradeHref }: any) {
	const [data, setData] = useState<any>(null);
	const [q, setQ] = useState("");
	const [msg, setMsg] = useState("");
	const [confirm, setConfirm] = useState("");
	const [stamp, setStamp] = useState("");
	const [pending, start] = useTransition();

	function refresh() {
		setData(null);
		setMsg("");
		start(async () => {
			setData(await load());
			setStamp(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
		});
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
				setMsg(`${m.name || m.handle} was ${m.banned ? "unbanned" : "banned"}.`);
				setData((d: any) => ({
					...d,
					members: d.members.map((x: any) => (x.id === m.id ? { ...x, banned: !m.banned } : x)),
				}));
			}
		});
	}

	const all = data?.members ?? [];
	const list = all.filter((m: any) => `${m.name} ${m.handle}`.toLowerCase().includes(q.trim().toLowerCase()));
	const bannedCount = all.filter((m: any) => m.banned).length;

	return (
		<section className="an-card an-set">
			<div className="an-set-head">
				<span className="an-set-icon">
					<Icon name="ban" size={18} />
				</span>
				<div className="an-grow">
					<div className="an-set-title">User ban list</div>
					<div className="an-muted">Banned users cannot comment, react or vote.</div>
				</div>
				{locked ? (
					<span className="an-badge">
						<Icon name="lock" size={11} /> Business
					</span>
				) : null}
			</div>

			{locked ? (
				<p className="an-muted">
					The ban list requires the Business plan.{" "}
					<Link href={upgradeHref} prefetch={false} className="an-link">
						See plans
					</Link>
				</p>
			) : (
				<>
					<div className="an-row">
						<input
							className="an-input"
							style={{ flex: 1 }}
							placeholder="Search members"
							value={q}
							onChange={(e) => setQ(e.target.value)}
						/>
						<button type="button" className="an-btn-ghost" disabled={pending} onClick={refresh}>
							<Icon name="refresh" size={14} /> Refresh
						</button>
					</div>
					{stamp && !pending ? <p className="an-muted">Updated at {stamp}</p> : null}

					{data === null ? (
						<p className="an-muted">Loading members...</p>
					) : data.error === "PLAN" || data.error === "DENIED" ? (
						<p className="an-muted">The ban list isn't available on this account.</p>
					) : all.length === 0 && data.error ? (
						<div className="an-notice bad">
							<b>We couldn't load your members.</b>
							<p className="an-muted">
								{data.error === "PERMISSION"
									? "Whop hasn't allowed this app to list your community's members yet. To fix it, open Developer, then Announcements, then Permissions, add member:basic:read and approve it in this community."
									: "Whop didn't answer. Press Refresh to try again."}{" "}
								Meanwhile, anyone who views, reacts or comments on an announcement will show up here
								automatically. Nobody has done that yet.
							</p>
							<button type="button" className="an-btn-ghost" onClick={refresh}>
								Try again
							</button>
						</div>
					) : (
						<>
							{data.note ? (
								<p className="an-notice">
									{data.note}
									{data.whopError === "PERMISSION"
										? " To see every member of your community, add the member:basic:read permission to the app and approve it."
										: ""}
								</p>
							) : null}
							<p className="an-muted">
								{bannedCount} banned · {list.length} shown of {all.length}
							</p>
							<div className="an-members an-members-scroll">
								{list.length === 0 ? (
									<p className="an-muted">
										{all.length === 0
											? "Nobody to show yet. Members appear here after they view, react or comment."
											: "No members match your search."}
									</p>
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
													<button type="button" className="an-btn-danger" disabled={pending} onClick={() => flip(m)}>
														Confirm ban
													</button>
													<button type="button" className="an-btn-ghost" onClick={() => setConfirm("")}>
														Cancel
													</button>
												</>
											) : (
												<button
													type="button"
													className={m.banned ? "an-btn-ghost" : "an-btn-danger"}
													disabled={pending}
													onClick={() => (m.banned ? flip(m) : setConfirm(m.id))}
												>
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
		</section>
	);
}