// @ts-nocheck
import { readTrack, recordClick } from "@/lib/tracking";

export const dynamic = "force-dynamic";

const BOT = /bot|crawl|spider|preview|slack|facebook|whatsapp|curl|headless|python|node-fetch/i;

export async function GET(request: Request) {
	const d = readTrack(new URL(request.url).searchParams.get("t") ?? "");
	if (!d) return new Response("This link is not valid.", { status: 400 });
	if (!BOT.test(request.headers.get("user-agent") ?? "")) {
		try {
			await recordClick(d);
		} catch {}
	}
	return new Response(null, { status: 302, headers: { Location: d.u } });
}