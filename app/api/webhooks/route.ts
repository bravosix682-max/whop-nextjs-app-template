import type { NextRequest } from "next/server";
import { applyPayment } from "@/lib/payments";
import { whopsdk } from "@/lib/whop-sdk";

export async function POST(request: NextRequest): Promise<Response> {
	const bodyText = await request.text();
	const headers = Object.fromEntries(request.headers);

	// Make sure the message really comes from Whop.
	let event: any;
	try {
		event = whopsdk.webhooks.unwrap(bodyText, { headers });
	} catch {
		return new Response("Invalid signature", { status: 401 });
	}

	if (event?.type === "payment.succeeded") {
		try {
			await applyPayment(event.data);
		} catch (e) {
			console.error("payment webhook failed", e);
			// A non-2xx answer makes Whop try again later.
			return new Response("Error", { status: 500 });
		}
	}

	return new Response("OK", { status: 200 });
}