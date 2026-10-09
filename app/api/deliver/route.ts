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
		try {
			await deliver(
				{
					id: row.id,
					experienceId: row.experience_id,
					title: row.title,
					body: row.body,
				},
				row.deliver,
			);
		} catch (e) {
			console.error("scheduled delivery failed", row.id, e);
		}
	}
	return Response.json({ delivered: due.length });
}