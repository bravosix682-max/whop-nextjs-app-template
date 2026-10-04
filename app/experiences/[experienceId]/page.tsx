import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";
import {
	type Announcement,
	createAnnouncement,
	deleteAnnouncement,
	listAnnouncements,
	setPinned,
} from "@/lib/supabase";
import { SubmitButton } from "./submit-button";

export default async function ExperiencePage({
	params,
}: {
	params: Promise<{ experienceId: string }>;
}) {
	const { experienceId } = await params;

	// Start loading the posts right away, while the login check runs.
	const itemsPromise = listAnnouncements(experienceId)
		.then((rows) => ({ rows, failed: false }))
		.catch(() => ({ rows: [] as Announcement[], failed: true }));

	// Ensure the user is logged in on whop.
	const { userId } = await whopsdk.verifyUserToken(await headers());
	const access = await whopsdk.users.checkAccess(experienceId, { id: userId });
	const isAdmin = String((access as any).access_level) === "admin";

	const { rows: items, failed: loadError } = await itemsPromise;
	const newId = crypto.randomUUID();

	async function publish(formData: FormData) {
		"use server";
		if (!isAdmin) return;
		const title = String(formData.get("title") ?? "")
			.trim()
			.slice(0, 120);
		const body = String(formData.get("body") ?? "")
			.trim()
			.slice(0, 4000);
		if (!title || !body) return;
		const rawId = String(formData.get("id") ?? "");
		const id = /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : crypto.randomUUID();
		await createAnnouncement({
			id,
			experience_id: experienceId,
			title,
			body,
			pinned: formData.get("pinned") === "on",
			author_id: userId,
		});
		revalidatePath(`/experiences/${experienceId}`);
	}

	const inputClass =
		"w-full rounded-lg border border-gray-a4 bg-gray-a2 p-2 text-3";

	return (
		<div className="flex flex-col gap-6 p-8">
			<h1 className="text-9 font-bold">Announcements</h1>

			{isAdmin && (
				<form
					action={publish}
					className="flex flex-col gap-3 rounded-lg border border-gray-a4 bg-gray-a2 p-4"
				>
					<h2 className="text-6 font-bold">New announcement</h2>
					<input type="hidden" name="id" value={newId} />
					<input
						name="title"
						required
						maxLength={120}
						placeholder="Title"
						className={inputClass}
					/>
					<textarea
						name="body"
						required
						maxLength={4000}
						rows={5}
						placeholder="Write your announcement..."
						className={inputClass}
					/>
					<label className="flex items-center gap-2 text-3">
						<input type="checkbox" name="pinned" /> Pin to top
					</label>
					<SubmitButton
						label="Publish"
						pendingLabel="Posting..."
						className="rounded-lg px-4 py-2 text-3 font-medium"
						style={{ background: "#2563eb", color: "#fff" }}
					/>
				</form>
			)}

			{loadError && (
				<p className="text-3 text-gray-10">
					Couldn't load announcements. Please try again.
				</p>
			)}
			{!loadError && items.length === 0 && (
				<p className="text-3 text-gray-10">No announcements yet.</p>
			)}

			{items.map((a) => {
				async function togglePin() {
					"use server";
					if (!isAdmin) return;
					await setPinned(experienceId, a.id, !a.pinned);
					revalidatePath(`/experiences/${experienceId}`);
				}
				async function remove() {
					"use server";
					if (!isAdmin) return;
					await deleteAnnouncement(experienceId, a.id);
					revalidatePath(`/experiences/${experienceId}`);
				}
				return (
					<article
						key={a.id}
						className="flex flex-col gap-2 rounded-lg border border-gray-a4 bg-gray-a2 p-4"
					>
						<div className="flex items-center justify-between gap-4">
							<h2 className="text-6 font-bold">
								{a.pinned ? "📌 " : ""}
								{a.title}
							</h2>
							<span className="text-2 text-gray-10">
								{new Date(a.created_at).toLocaleDateString("en-GB", {
									day: "numeric",
									month: "short",
									year: "numeric",
								})}
							</span>
						</div>
						<p className="whitespace-pre-wrap text-3">{a.body}</p>
						{isAdmin && (
							<div className="flex gap-3">
								<form action={togglePin}>
									<SubmitButton
										label={a.pinned ? "Unpin" : "Pin"}
										pendingLabel="Working..."
										className="text-2 underline"
									/>
								</form>
								<form action={remove}>
									<SubmitButton
										label="Delete"
										pendingLabel="Deleting..."
										className="text-2 underline"
									/>
								</form>
							</div>
						)}
					</article>
				);
			})}
		</div>
	);
}