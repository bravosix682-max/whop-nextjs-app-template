export async function notifyExperience(opts: {
	experienceId: string;
	title: string;
	content: string;
}): Promise<boolean> {
	const apiKey = process.env.WHOP_API_KEY;
	if (!apiKey) return false;
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
		return res.ok;
	} catch {
		return false;
	}
}