// @ts-nocheck
"use client";

import { useMemo, useState, useTransition } from "react";
import { LANGS } from "@/lib/langs";
import { Icon } from "./icons";

function Lines({ text }: { text: string }) {
	return (
		<div className="an-tr-body">
			{String(text)
				.split("\n")
				.map((l, i) => {
					const h = l.match(/^(#{1,3})\s+(.*)$/);
					if (h) return <div key={i} className={`an-h an-h${h[1].length}`}>{h[2]}</div>;
					if (!l.trim() || /^:::/.test(l)) return l.trim() ? null : <div key={i} style={{ height: 8 }} />;
					return <div key={i} className="an-tr-line">{l.replace(/^-\s+/, "• ")}</div>;
				})}
		</div>
	);
}

export function TranslateBox({ postId, onTranslate }: any) {
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState("");
	const [res, setRes] = useState<any>(null);
	const [err, setErr] = useState("");
	const [lang, setLang] = useState("");
	const [pending, start] = useTransition();
	const list = useMemo(() => {
		const s = q.trim().toLowerCase();
		return LANGS.filter((l) => !s || `${l.name} ${l.native}`.toLowerCase().includes(s));
	}, [q]);

	function pick(l: any) {
		setOpen(false);
		setQ("");
		setLang(l.name);
		setErr("");
		start(async () => {
			const r = await onTranslate(postId, l.code);
			if (r?.ok) setRes({ title: r.title, body: r.body });
			else {
				setRes(null);
				setErr(r?.error ?? "Translation failed.");
			}
		});
	}

	return (
		<div className="an-tr">
			<div className="an-pop-wrap">
				<button type="button" className="an-tr-btn" onClick={() => setOpen(!open)} disabled={pending}>
					<Icon name="globe" size={15} />
					{pending ? `Translating to ${lang}...` : "Translate"}
					<Icon name="chevron" size={12} />
				</button>
				{open && (
					<>
						<div className="an-backdrop" onClick={() => setOpen(false)} />
						<div className="an-pop wide">
							<div className="an-sheet-grip" />
							<div className="an-tr-title">Translate post</div>
							<input autoFocus className="an-input" placeholder="Search a language" value={q} onChange={(e) => setQ(e.target.value)} />
							<div className="an-list an-scroll an-tr-list">
								{list.length === 0 ? (
									<p className="an-muted" style={{ padding: 10 }}>No language found.</p>
								) : (
									list.map((l) => (
										<button key={l.code} type="button" className="an-list-item" onClick={() => pick(l)}>
											{l.name}
											{l.native !== l.name ? <span className="an-muted"> {l.native}</span> : null}
										</button>
									))
								)}
							</div>
						</div>
					</>
				)}
			</div>
			{err ? <p className="an-error">{err}</p> : null}
			{res && (
				<div className="an-tr-box">
					<div className="an-tr-head">
						<span className="an-muted">Translated to {lang}. Machine translation, may not be perfect.</span>
						<button type="button" className="an-link-btn" onClick={() => setRes(null)}>Show original only</button>
					</div>
					{res.title ? <div className="an-tr-t">{res.title}</div> : null}
					<Lines text={res.body} />
				</div>
			)}
		</div>
	);
}