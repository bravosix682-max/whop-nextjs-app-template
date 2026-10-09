import { addOptOut } from "@/lib/delivery-db";
import { readUnsubscribeToken } from "@/lib/deliver";

export const dynamic = "force-dynamic";

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head><body style="font-family:Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#231915"><h2>You're unsubscribed</h2><p>You will no longer get announcement emails from this community.</p></body></html>`;

async function handle(request: Request, html: boolean) {
	const token = new URL(request.url).searchParams.get("t") ?? "";
	const data = readUnsubscribeToken(token);
	if (!data) return new Response("This link is not valid.", { status: 400 });
	await addOptOut(data.email, data.experienceId);
	if (!html) return new Response("OK", { status: 200 });
	return new Response(PAGE, {
		status: 200,
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

export async function GET(request: Request) {
	return handle(request, true);
}

export async function POST(request: Request) {
	return handle(request, false);
}