// @ts-nocheck
import type { ReactNode } from "react";
import { type Attachment, FONT_STACK, formatSize, kindOf, parseBlocks, type Tok, tokenize } from "@/lib/markup";
import { publicUrl } from "@/lib/storage";
import { trackUrl } from "@/lib/tracking";
import { Icon } from "./icons";
import { YouTube } from "./youtube";

function inline(toks: Tok[], key: string, postId?: string): ReactNode[] {
	return toks.map((t, i) => {
		const k = `${key}-${i}`;
		if (t.k === "t") return t.v;
		if (t.k === "b") return <strong key={k}>{inline(t.c, k, postId)}</strong>;
		if (t.k === "i") return <em key={k}>{inline(t.c, k, postId)}</em>;
		if (t.k === "u") return <u key={k}>{inline(t.c, k, postId)}</u>;
		if (t.k === "s") return <s key={k}>{inline(t.c, k, postId)}</s>;
		if (t.k === "f") {
			return (
				<span key={k} style={{ fontFamily: FONT_STACK[t.f] }}>
					{inline(t.c, k, postId)}
				</span>
			);
		}
		if (t.k === "a") {
			return (
				<a key={k} className="an-link" href={postId ? trackUrl(postId, "app", t.url) : t.url} target="_blank" rel="noopener noreferrer">
					{inline(t.c, k, postId)}
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

export function RichText({ text, postId }: { text: string; postId?: string }) {
	return (
		<div className="an-rich">
			{parseBlocks(text).map((b, i) => {
				if (b.t === "p") {
					return (
						<p key={i} className="an-p" style={{ textAlign: b.align }}>
							{inline(tokenize(b.text), `p${i}`, postId)}
						</p>
					);
				}
				if (b.t === "h") {
					return (
						<div key={i} className={`an-h an-h${b.level}`} style={{ textAlign: b.align }}>
							{inline(tokenize(b.text), `h${i}`, postId)}
						</div>
					);
				}
				if (b.t === "ul" || b.t === "ol") {
					const items = b.items.map((it, n) => <li key={n}>{inline(tokenize(it), `l${i}-${n}`, postId)}</li>);
					return b.t === "ul" ? (
						<ul key={i} className="an-ul" style={{ textAlign: b.align }}>{items}</ul>
					) : (
						<ol key={i} className="an-ul" style={{ textAlign: b.align }}>{items}</ol>
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

export function ProductCards({ items, postId }: { items: any; postId?: string }) {
	const list = (Array.isArray(items) ? items : []).filter((p) => p && typeof p === "object" && p.url);
	if (list.length === 0) return null;
	return (
		<div className="an-products">
			{list.map((p) => (
				<div className="an-product" key={p.id}>
					<span className="an-product-icon">
						<Icon name="package" size={20} />
					</span>
					<div className="an-grow">
						<b>{p.title || "Product"}</b>
						<div className="an-muted">Tap to view or buy</div>
					</div>
					<a className="an-btn" href={postId ? trackUrl(postId, "app", p.url, "product") : p.url} target="_blank" rel="noopener noreferrer">
						View product
					</a>
				</div>
			))}
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
				<a key={a.path} className="an-file" href={publicUrl(a.path)} target="_blank" rel="noopener noreferrer">
					<Icon name="file" size={18} />
					<span className="an-file-name">{a.name}</span>
					<span className="an-muted">{formatSize(a.size)}</span>
					<Icon name="download" size={16} />
				</a>
			))}
		</div>
	);
}