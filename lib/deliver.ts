import { createHmac, timingSafeEqual } from "node:crypto";
import { type Channels, getDiscordWebhook, getOptOuts } from "./delivery-db";
import { notifyExperience } from "./notify";
import { whopsdk } from "./whop-sdk";

export type DeliverItem = {
	id: string;
	experienceId: string;
	title: string;
	body: string;
};

type Result = { ok: boolean; detail: string };

const IMAGE_EXT = /\.(?:png|jpe?g|gif|webp)(?:\?[^\s<]*)?$/i;
const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;
const DISCORD_URL =
	/^https:\/\/(?:ptb\.|canary\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const MAX_PER_SEND = 300;

export function safeEqual(a: string, b: string) {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

export function emailReady() {
	return (
		!!process.env.RESEND_API_KEY &&
		!!process.env.EMAIL_FROM_ADDRESS &&
		!!process.env.APP_URL &&
		!!process.env.UNSUBSCRIBE_SECRET
	);
}

export function validDiscordUrl(url: string) {
	return DISCORD_URL.test(url);
}

// ---------- unsubscribe links ----------

export function unsubscribeToken(email: string, experienceId: string) {
	const secret = process.env.UNSUBSCRIBE_SECRET ?? "";
	const payload = Buffer.from(
		JSON.stringify({ e: email, x: experienceId }),
	).toString("base64url");
	const sig = createHmac("sha256", secret).update(payload).digest("base64url");
	return `${payload}.${sig}`;
}

export function readUnsubscribeToken(
	token: string,
): { email: string; experienceId: string } | null {
	const secret = process.env.UNSUBSCRIBE_SECRET ?? "";
	if (!secret) return null;
	const [payload, sig] = token.split(".");
	if (!payload || !sig) return null;
	const expected = createHmac("sha256", secret)
		.update(payload)
		.digest("base64url");
	if (!safeEqual(sig, expected)) return null;
	try {
		const data = JSON.parse(Buffer.from(payload, "base64url").toString());
		if (typeof data.e !== "string" || typeof data.x !== "string") return null;
		return { email: data.e, experienceId: data.x };
	} catch {
		return null;
	}
}

// ---------- helpers ----------

function firstImage(text: string): string | null {
	for (const m of text.matchAll(URL_PATTERN)) {
		const url = m[0].replace(/[.,!?;:)]+$/, "");
		if (IMAGE_EXT.test(url)) return url;
	}
	return null;
}

function plain(text: string) {
	return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

function esc(s: string) {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function bodyHtml(text: string) {
	return text
		.split(URL_PATTERN)
		.map((part, i) => {
			if (i % 2 === 0) {
				return esc(part).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
			}
			const url = part.replace(/[.,!?;:)]+$/, "");
			const tail = part.slice(url.length);
			const safe = esc(url);
			if (IMAGE_EXT.test(url)) {
				return `<a href="${safe}"><img src="${safe}" alt="" style="max-width:100%;border-radius:12px;display:block;margin:12px 0"></a>${esc(tail)}`;
			}
			return `<a href="${safe}" style="color:#ff5a1f">${safe}</a>${esc(tail)}`;
		})
		.join("")
		.replace(/\n/g, "<br>");
}

async function safe(label: string, job: () => Promise<string>) {
	try {
		return await job();
	} catch (e) {
		return `${label} failed. ${e instanceof Error ? e.message.slice(0, 120) : ""}`;
	}
}

// ---------- Discord ----------

export async function sendDiscord(
	webhook: string,
	title: string,
	body: string,
): Promise<Result> {
	if (!DISCORD_URL.test(webhook)) {
		return { ok: false, detail: "The saved Discord link is not valid." };
	}
	const image = firstImage(body);
	try {
		const res = await fetch(webhook, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				username: "Announcements",
				allowed_mentions: { parse: [] },
				embeds: [
					{
						title: title.slice(0, 256),
						description: body.slice(0, 4000),
						color: 0xff5a1f,
						...(image ? { image: { url: image } } : {}),
					},
				],
			}),
			signal: AbortSignal.timeout(6000),
		});
		if (res.ok) return { ok: true, detail: "" };
		const text = await res.text().catch(() => "");
		return {
			ok: false,
			detail: `Discord answered ${res.status}. ${text.slice(0, 120)}`,
		};
	} catch (e) {
		return {
			ok: false,
			detail: `Could not reach Discord (${e instanceof Error ? e.message : "error"}).`,
		};
	}
}

// ---------- Email ----------

async function listMemberEmails(
	companyId: string,
	deadline: number,
): Promise<{ emails: string[]; error?: string }> {
	const key = process.env.WHOP_API_KEY ?? "";
	const emails = new Set<string>();
	let after = "";
	for (let page = 0; page < 6; page++) {
		if (Date.now() > deadline - 3000) break;
		const url = `https://api.whop.com/api/v1/members?company_id=${encodeURIComponent(companyId)}&first=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${key}` },
			signal: AbortSignal.timeout(5000),
			cache: "no-store",
		});
		if (res.status === 401 || res.status === 403) {
			return {
				emails: [],
				error:
					"Whop did not allow reading member emails. Add the member:basic:read and member:email:read permissions to this app, then approve them in this community.",
			};
		}
		if (!res.ok) return { emails: [], error: `Whop answered ${res.status}.` };
		const json: any = await res.json();
		for (const m of json?.data ?? []) {
			const email =
				typeof m?.user?.email === "string" ? m.user.email.trim().toLowerCase() : "";
			if (!email || m?.access_level === "no_access") continue;
			emails.add(email);
		}
		if (!json?.page_info?.has_next_page) break;
		after = String(json.page_info.end_cursor ?? "");
		if (!after) break;
	}
	return { emails: [...emails] };
}

async function sendEmail(item: DeliverItem, deadline: number): Promise<Result> {
	if (!emailReady()) {
		return { ok: false, detail: "Email is not set up on this app yet." };
	}
	const exp: any = await whopsdk.experiences.retrieve(item.experienceId);
	const companyId = String(exp?.company?.id ?? "");
	const community = String(exp?.company?.title ?? "your community");
	if (!companyId) {
		return { ok: false, detail: "Could not find this community on Whop." };
	}

	const listed = await listMemberEmails(companyId, deadline);
	if (listed.error) return { ok: false, detail: listed.error };

	const optouts = await getOptOuts(item.experienceId);
	let emails = listed.emails.filter((e) => !optouts.has(e));
	if (emails.length === 0) {
		return {
			ok: false,
			detail:
				"No member emails were available. Check that the member:email:read permission is approved for this community.",
		};
	}
	let limited = false;
	if (emails.length > MAX_PER_SEND) {
		emails = emails.slice(0, MAX_PER_SEND);
		limited = true;
	}

	const base = (process.env.APP_URL ?? "").replace(/\/+$/, "");
	const fromName =
		community.replace(/[<>"\r\n]/g, "").slice(0, 60) || "Announcements";
	const from = `${fromName} <${process.env.EMAIL_FROM_ADDRESS}>`;
	const html = bodyHtml(item.body);
	let sent = 0;

	for (let i = 0; i < emails.length; i += 100) {
		if (Date.now() > deadline) break;
		const chunk = emails.slice(i, i + 100);
		const messages = chunk.map((email) => {
			const unsub = `${base}/api/unsubscribe?t=${unsubscribeToken(email, item.experienceId)}`;
			return {
				from,
				to: [email],
				subject: item.title.slice(0, 200),
				html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#231915"><h2 style="margin:0 0 16px">${esc(item.title)}</h2><div style="line-height:1.6">${html}</div><hr style="border:none;border-top:1px solid #eadfd8;margin:24px 0"><p style="font-size:12px;color:#7d6e66">You receive this because you are a member of ${esc(community)}. <a href="${esc(unsub)}">Unsubscribe</a></p></div>`,
				text: `${item.title}\n\n${plain(item.body)}\n\nUnsubscribe: ${unsub}`,
				headers: {
					"List-Unsubscribe": `<${unsub}>`,
					"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
				},
			};
		});
		const res = await fetch("https://api.resend.com/emails/batch", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(messages),
			signal: AbortSignal.timeout(7000),
		});
		if (!res.ok) {
			const t = await res.text().catch(() => "");
			return {
				ok: sent > 0,
				detail: `Resend answered ${res.status}. ${t.slice(0, 140)} (${sent} sent before the error.)`,
			};
		}
		sent += chunk.length;
	}

	return {
		ok: sent > 0,
		detail: `Email sent to ${sent} member${sent === 1 ? "" : "s"}.${limited ? ` Limited to the first ${MAX_PER_SEND} members.` : ""}${sent < emails.length && !limited ? " Stopped early to stay within the time limit." : ""}`,
	};
}

// ---------- everything together ----------

export async function deliver(
	item: DeliverItem,
	channels: Channels,
): Promise<string[]> {
	const deadline = Date.now() + 8000;
	const jobs: Promise<string>[] = [];

	if (channels.push) {
		jobs.push(
			safe("Push", async () => {
				const r = await notifyExperience({
					experienceId: item.experienceId,
					title: item.title,
					content: plain(item.body).replace(/\s+/g, " ").slice(0, 140),
				});
				return r.ok ? "Push sent." : `Push failed. ${r.detail}`;
			}),
		);
	}
	if (channels.discord) {
		jobs.push(
			safe("Discord", async () => {
				const hook = await getDiscordWebhook(item.experienceId);
				if (!hook) return "Discord is not connected.";
				const r = await sendDiscord(hook, item.title, item.body);
				return r.ok ? "Discord sent." : `Discord failed. ${r.detail}`;
			}),
		);
	}

	const out = await Promise.all(jobs);

	if (channels.email) {
		out.push(
			await safe("Email", async () => {
				const r = await sendEmail(item, deadline);
				return r.ok ? r.detail : `Email failed. ${r.detail}`;
			}),
		);
	}
	return out;
}