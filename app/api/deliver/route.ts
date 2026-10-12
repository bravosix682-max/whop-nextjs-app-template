// @ts-nocheck
import { claimDue } from "@/lib/delivery-db";
import { deliver, safeEqual } from "@/lib/deliver";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const secret = process.env.CRON_SECRET ?? "";
	const given = request.headers.get("x-cron-secret") ?? "";
	if (!secret || !safeEqual(given, secret)) {
		return new Response("Forbidden", { status: 403 });
	}

	const due = await claimDue();
	for (const row of due) {
		const d: any = row.deliver ?? {};
		try {
			await deliver(
				{
					id: row.id,
					experienceId: row.experience_id,
					title: row.title,
					body: row.body,
					attachments: Array.isArray(row.attachments) ? row.attachments : [],
					targeted: Array.isArray(row.target_products) && row.target_products.length > 0,
				},
				{
					push: !!d.push,
					email: !!d.email,
					chat: !!d.chat,
					forum: !!d.forum,
					channelIds: Array.isArray(d.channelIds) ? d.channelIds : [],
				},
			);
		} catch (e) {
			console.error("scheduled delivery failed", row.id, e);
		}
	}
	return Response.json({ delivered: due.length });
}