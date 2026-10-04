import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { notifyExperience } from "@/lib/notify";
import {
	type Announcement,
	createAnnouncement,
	deleteAnnouncement,
	listAnnouncements,
	recordViews,
	setPinned,
	updateAnnouncement,
	viewCounts,
} from "@/lib/supabase";
import { whopsdk } from "@/lib/whop-sdk";
import { Composer } from "./composer";
import { SubmitButton } from "./submit-button";
import { ViewTracker } from "./view-tracker";

const UUID = /^[0-9a-f-]{36}$/i;
const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;
const IMAGE_URL = /\.(png|jpe?g|gif|webp)(\?[^\s]*)?$/i;

function renderText(text: string, keyBase: string): ReactNode[] {
	return text
		.split(/\*\*(.+?)\*\*/g)
		.map((part, j) =>
			j % 2 === 1 ? <strong key={`${keyBase}-${j}`}>{part}</strong> : part,
		);
}

function renderBody(text: string): ReactNode[] {
	return text.split(URL_PATTERN).map((part, i) => {
		if (i % 2 === 0) return <span key={i}>{renderText(part, String(i))}</span>;
		const url = part.replace(/[.,!?;:)]+$/, "");
		const tail = part.slice(url.length);
		if (IMAGE_URL.test(url)) {
			return (
				<span key={i}>
					<a href={url} target="_blank" rel="noopener noreferrer">
						<img
							src={url}
							alt=""
							loading="lazy"
							className="my-2 max-w-full rounded-lg"
							style={{ display: "block" }}
						/>
					</a>
					{tail}
				</span>
			);
		}
		return (
			<span key={i}>
				<a
					href={url}
					target="_blank"
					rel="noopener noreferrer"
					className="underline"
				>
					{url}
				</a>
				{tail}
			</span>
		);
	});
}

function clean(value: FormDataEntryValue | null, max: number) {
	return String(value ?? "")
		.trim()
		.slice(0, max);
}

function noticeText(n?: string) {
	if (n === "sent") return "Posted. Members were notified.";
	if (n === "saved") return "Saved.";
	if (n === "notfailed")
		return "Posted, but the push notification could not be sent. Check that the notification permission is turned on for this app in the Whop developer dashboard.";
	return null;
}

export default async function ExperiencePage({
	params,
	searchParams,
}: {
	params: Promise<{ experienceId: string }>;
	searchParams: Promise<{ edit?: string; notice?: string }>;
}) {
	const { experienceId } = await params;
	const { edit, notice } = await searchParams;
	const basePath = `/experiences/${experienceId}`;

	const started = Date.now();
	const timing = { login: 0, access: 0, posts: 0 };

	// Start loading the posts right away, while the login check runs.
	const itemsPromise = listAnnouncements(experienceId)
		.then((rows) => ({ rows, failed: false }))
		.catch(() => ({ rows: [] as Announcement[], failed: true }))
		.then((result) => {
			timing.posts = Date.now() - started;
			return result;
		});

	// Ensure the user is logged in on whop.
	const { userId } = await whopsdk.verifyUserToken(await headers());
	timing.login = Date.now() - started;
	const access = await whopsdk.users.checkAccess(experienceId, { id: userId });
	timing.access = Date.now() - started;
	const isAdmin = String((access as any).access_level) === "admin";

	const emptyCounts: Record<string, number> = {};
	const [{ rows: items, failed: loadError }, counts] = await Promise.all([
		itemsPromise,
		isAdmin
			? viewCounts(experienceId).catch(() => emptyCounts)
			: Promise.resolve(emptyCounts),
	]);
	const total = Date.now() - started;

	const ids = items.map((a) => a.id);
	const newId = crypto.randomUUID();
	const editing =
		isAdmin && edit ? items.find((a) => a.id === edit) : undefined;

	async function markSeen() {
		"use server";
		if (isAdmin) return;
		await recordViews(userId, ids);
	}

	async function publish(formData: FormData) {
		"use server";
		if (!isAdmin) return;
		const title = clean(formData.get("title"), 120);
		const body = clean(formData.get("body"), 4000);
		if (!title || !body) return;
		const rawId = String(formData.get("id") ?? "");
		const id = UUID.test(rawId) ? rawId : crypto.randomUUID();
		await createAnnouncement({
			id,
			experience_id: experienceId,
			title,
			body,
			pinned: formData.get("pinned") === "on",
			author_id: userId,
		});
		let outcome = "saved";
		if (formData.get("notify") === "on") {
			const ok = await notifyExperience({
				experienceId,
				title,
				content: body.replace(/\s+/g, " ").slice(0, 140),
			});
			outcome = ok ? "sent" : "notfailed";
		}
		revalidatePath(basePath);
		redirect(`${basePath}?notice=${outcome}`);
	}

	async function update(formData: FormData) {
		"use server";
		if (!isAdmin) return;
		const id = String(formData.get("id") ?? "");
		if (!UUID.test(id)) return;
		const title = clean(formData.get("title"), 120);
		const body = clean(formData.get("body"), 4000);
		if (!title || !body) return;
		await updateAnnouncement(experienceId, id, {
			title,
			body,
			pinned: formData.get("pinned") === "on",
		});
		revalidatePath(basePath);
		redirect(`${basePath}?notice=saved`);
	}

	const message = noticeText(notice);

	return (
		<div className="flex flex-col gap-6 p-8">
			<h1 className="text-9 font-bold">Announcements</h1>

			{message && (
				<p className="rounded-lg border border-gray-a4 bg-gray-a2 p-3 text-3">
					{message}
				</p>
			)}

			{isAdmin && editing && (
				<Composer
					key={editing.id}
					mode="edit"
					action={update}
					id={editing.id}
					cancelHref={basePath}
					initial={{
						title: editing.title,
						body: editing.body,
						pinned: editing.pinned,
					}}
				/>
			)}
			{isAdmin && !editing && (
				<Composer key={newId} mode="create" action={publish} id={newId} />
			)}

			{!isAdmin && ids.length > 0 && (
				<ViewTracker key={ids.join(",")} action={markSeen} />
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
					revalidatePath(basePath);
				}
				async function remove() {
					"use server";
					if (!isAdmin) return;
					await deleteAnnouncement(experienceId, a.id);
					revalidatePath(basePath);
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
						<p className="whitespace-pre-wrap text-3">{renderBody(a.body)}</p>
						{isAdmin && (
							<div className="flex items-center gap-3">
								<Link
									href={`${basePath}?edit=${a.id}`}
									prefetch={false}
									className="text-2 underline"
								>
									Edit
								</Link>
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
								<span className="text-2 text-gray-10">
									👁 {counts[a.id] ?? 0} seen
								</span>
							</div>
						)}
					</article>
				);
			})}

			{isAdmin && (
				<p className="text-2 text-gray-10">
					Load time in ms (running total): login {timing.login}, access check{" "}
					{timing.access}, posts {timing.posts}, page ready {total}
				</p>
			)}
		</div>
	);
}