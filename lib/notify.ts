export type NotifyResult = { ok: boolean; detail: string };

export async function notifyExperience(opts: {
	experienceId: string;
	title: string;
	content: string;
}): Promise<NotifyResult> {
	const apiKey = process.env.WHOP_API_KEY;
	if (!apiKey) return { ok: false, detail: "WHOP_API_KEY is missing on the server." };
	try {
		const res = await fetch("https://api.whop.com/api/v1/notifications", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				experience_id: opts.experienceId,
				title: opts.title,
				content: opts.content,
			}),
			signal: AbortSignal.timeout(8000),
		});
		const text = await res.text();
		if (res.ok) return { ok: true, detail: "" };
		return { ok: false, detail: `Whop answered ${res.status}: ${text.slice(0, 200)}` };
	} catch (e) {
		return {
			ok: false,
			detail: `Could not reach Whop (${e instanceof Error ? e.message : "unknown error"}).`,
		};
	}
}