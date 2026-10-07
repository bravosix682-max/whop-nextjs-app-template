import { asPlan } from "./plans";
import { activatePaid, claimPayment, findByMembership } from "./supabase";

function toDate(v: unknown): Date | null {
	if (v === null || v === undefined || v === "") return null;
	if (typeof v === "number") {
		const d = new Date(v < 1e12 ? v * 1000 : v);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	const d = new Date(String(v));
	return Number.isNaN(d.getTime()) ? null : d;
}

// Called for every successful payment Whop reports for your company.
export async function applyPayment(data: any): Promise<void> {
	const paymentId = String(data?.id ?? "");
	if (!paymentId) return;

	const meta = (data?.metadata ?? {}) as Record<string, unknown>;
	const membershipId = data?.membership?.id
		? String(data.membership.id)
		: data?.membership_id
			? String(data.membership_id)
			: null;

	let experienceId = "";
	let plan = asPlan(meta.plan);

	if (meta.app === "announcements") {
		experienceId = String(meta.experience_id ?? "");
	} else if (membershipId) {
		// A renewal: find the community by the subscription it belongs to.
		const known = await findByMembership(membershipId);
		if (known) {
			experienceId = known.experience_id;
			plan = asPlan(known.plan);
		}
	}
	if (!experienceId || plan === "starter") return;

	// Each payment counts only once, even if Whop sends it again.
	const fresh = await claimPayment(paymentId, experienceId, plan);
	if (!fresh) return;

	await activatePaid({
		experienceId,
		plan,
		paidAt: toDate(data?.paid_at) ?? new Date(),
		paymentId,
		paidBy: data?.user?.id ? String(data.user.id) : null,
		membershipId,
	});
}