// @ts-nocheck
import type { ReactNode } from "react";
import {
	type Attachment,
	formatSize,
	kindOf,
	parseBlocks,
	type Tok,
	tokenize,
} from "@/lib/markup";
import { publicUrl } from "@/lib/storage";
import { Icon } from "./icons";
import { YouTube } from "./youtube";

function inline(toks: Tok[], key: string): ReactNode[] {
	return toks.map((t, i) => {
		const k = `${key}-${i}`;
		if (t.k === "t") return t.v;
		if (t.k === "b") return <strong key={k}>{inline(t.c, k)}</strong>;
		if (t.k === "i") return <em key={k}>{inline(t.c, k)}</em>;
		if (t.k === "u") return <u key={k}>{inline(t.c, k)}</u>;
		if (t.k === "s") return <s key={k}>{inline(t.c, k)}</s>;
		if (t.k === "a") {
			return (
				<a key={k} className="an-link" href={t.url} target="_blank" rel="noopener noreferrer">
					{inline(t.c, k)}
				</a>
			);
		}
		return (
			<span key={k} className="an-mention">
				{t.v}
			</span>
		);
	});
}

export function RichText({ text }: { text: string }) {
	const blocks = parseBlocks(text);
	return (
		<div className="an-rich">
			{blocks.map((b, i) => {
				if (b.t === "p") {
					return (
						<p key={i} className="an-p" style={{ textAlign: b.align }}>
							{inline(tokenize(b.text), `p${i}`)}
						</p>
					);
				}
				if (b.t === "h") {
					return (
						<div key={i} className={`an-h an-h${b.level}`} style={{ textAlign: b.align }}>
							{inline(tokenize(b.text), `h${i}`)}
						</div>
					);
				}
				if (b.t === "ul" || b.t === "ol") {
					const items = b.items.map((it, n) => (
						<li key={n}>{inline(tokenize(it), `l${i}-${n}`)}</li>
					));
					return b.t === "ul" ? (
						<ul key={i} className="an-ul" style={{ textAlign: b.align }}>
							{items}
						</ul>
					) : (
						<ol key={i} className="an-ul" style={{ textAlign: b.align }}>
							{items}
						</ol>
					);
				}
				if (b.t === "yt") return <YouTube key={i} id={b.id} />;
				return (
					<a key={i} href={b.url} target="_blank" rel="noopener noreferrer">
						<img src={b.url} alt="" loading="lazy" className="an-img" />
					</a>
				);
			})}
		</div>
	);
}

export function AttachmentList({ items }: { items: Attachment[] }) {
	if (!Array.isArray(items) || items.length === 0) return null;
	const images = items.filter((a) => kindOf(a.name) === "image");
	const videos = items.filter((a) => kindOf(a.name) === "video");
	const files = items.filter((a) => kindOf(a.name) === "file");
	return (
		<div className="an-atts">
			{images.length > 0 && (
				<div className="an-gallery">
					{images.map((a) => (
						<a key={a.path} href={publicUrl(a.path)} target="_blank" rel="noopener noreferrer">
							<img src={publicUrl(a.path)} alt="" loading="lazy" />
						</a>
					))}
				</div>
			)}
			{videos.map((a) => (
				<video key={a.path} className="an-video" controls preload="metadata" src={publicUrl(a.path)} />
			))}
			{files.map((a) => (
				<a
					key={a.path}
					className="an-file"
					href={publicUrl(a.path)}
					target="_blank"
					rel="noopener noreferrer"
				>
					<Icon name="file" size={18} />
					<span className="an-file-name">{a.name}</span>
					<span className="an-muted">{formatSize(a.size)}</span>
					<Icon name="download" size={16} />
				</a>
			))}
		</div>
	);
}