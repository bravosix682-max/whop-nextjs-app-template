"use client";

import Link from "next/link";
import { useState } from "react";
import { SubmitButton } from "./submit-button";

type Template = { label: string; title: string; body: string };

const TEMPLATES: { group: string; items: Template[] }[] = [
	{
		group: "General",
		items: [
			{
				label: "Welcome",
				title: "Welcome to the community!",
				body: "Glad to have you here. Start by reading the pinned posts, then say hi.",
			},
			{
				label: "Weekly roundup",
				title: "Weekly roundup",
				body: "Here's what happened this week:\n\n- \n- \n- \n\nWhat's coming next:\n\n- ",
			},
			{
				label: "Event reminder",
				title: "Reminder: event today",
				body: "Join us today at [time].\n\nLink: ",
			},
		],
	},
	{
		group: "Clipping and campaigns",
		items: [
			{
				label: "New campaign",
				title: "New campaign is live",
				body: "Campaign: [name]\nPay rate: [rate]\nDeadline: [date]\n\nRules:\n- \n- \n\nSubmit your clips here: ",
			},
			{
				label: "Payout update",
				title: "Payout update",
				body: "Payouts for [period] are being processed.\n\nExpected by: [date]\n\nIf something looks wrong, message us with your username.",
			},
			{
				label: "Deadline reminder",
				title: "Deadline reminder",
				body: "Submissions for [campaign] close on [date].\n\nMake sure your clips are submitted before then.",
			},
		],
	},
	{
		group: "Trading and signals",
		items: [
			{
				label: "New signal",
				title: "New signal",
				body: "Asset: \nDirection: \nEntry: \nStop: \nTargets: \n\nNotes: ",
			},
			{
				label: "Market update",
				title: "Market update",
				body: "Summary:\n\nKey levels:\n- \n- \n\nWhat we're watching:",
			},
			{
				label: "Trade closed",
				title: "Trade closed",
				body: "Asset: \nResult: \n\nNotes: ",
			},
		],
	},
	{
		group: "Coaching and courses",
		items: [
			{
				label: "New lesson",
				title: "New lesson is up",
				body: "Lesson: [name]\n\nWhat you'll learn:\n- \n- \n\nLink: ",
			},
			{
				label: "Live call starting",
				title: "Live call starting soon",
				body: "We go live at [time].\n\nJoin here: ",
			},
			{
				label: "Homework due",
				title: "Homework due",
				body: "Reminder: [assignment] is due on [date].\n\nSubmit it here: ",
			},
		],
	},
	{
		group: "Reselling",
		items: [
			{
				label: "Restock alert",
				title: "Restock alert",
				body: "Item: \nWhere: \nPrice: \nLink: ",
			},
			{
				label: "Deal drop",
				title: "Deal drop",
				body: "Deal: \nPrice: \nEnds: \nLink: ",
			},
			{
				label: "New sourcing list",
				title: "New sourcing list",
				body: "This week's list is ready.\n\nAccess it here: ",
			},
		],
	},
];

export function Composer({
	action,
	mode,
	id,
	initial,
	cancelHref,
}: {
	action: (formData: FormData) => void | Promise<void>;
	mode: "create" | "edit";
	id: string;
	initial?: { title: string; body: string; pinned: boolean };
	cancelHref?: string;
}) {
	const [title, setTitle] = useState(initial?.title ?? "");
	const [body, setBody] = useState(initial?.body ?? "");

	function applyTemplate(value: string) {
		for (const group of TEMPLATES) {
			for (const t of group.items) {
				if (`${group.group}|${t.label}` === value) {
					setTitle(t.title);
					setBody(t.body);
					return;
				}
			}
		}
	}

	const inputClass =
		"w-full rounded-lg border border-gray-a4 bg-gray-a2 p-2 text-3";

	return (
		<form
			action={action}
			className="flex flex-col gap-3 rounded-lg border border-gray-a4 bg-gray-a2 p-4"
		>
			<h2 className="text-6 font-bold">
				{mode === "edit" ? "Edit announcement" : "New announcement"}
			</h2>
			<input type="hidden" name="id" value={id} />

			{mode === "create" && (
				<select
					value=""
					onChange={(e) => applyTemplate(e.target.value)}
					className={inputClass}
				>
					<option value="">Start from a template...</option>
					{TEMPLATES.map((group) => (
						<optgroup key={group.group} label={group.group}>
							{group.items.map((t) => (
								<option key={t.label} value={`${group.group}|${t.label}`}>
									{t.label}
								</option>
							))}
						</optgroup>
					))}
				</select>
			)}

			<input
				name="title"
				required
				maxLength={120}
				placeholder="Title"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				className={inputClass}
			/>
			<textarea
				name="body"
				required
				maxLength={4000}
				rows={6}
				placeholder="Write your announcement..."
				value={body}
				onChange={(e) => setBody(e.target.value)}
				className={inputClass}
			/>
			<p className="text-2 text-gray-10">
				Tip: paste a link to make it clickable, paste an image link (.png, .jpg,
				.gif, .webp) to show the picture, and put **double stars** around words
				to make them bold.
			</p>
			<label className="flex items-center gap-2 text-3">
				<input
					type="checkbox"
					name="pinned"
					defaultChecked={initial?.pinned ?? false}
				/>{" "}
				Pin to top
			</label>
			{mode === "create" && (
				<label className="flex items-center gap-2 text-3">
					<input type="checkbox" name="notify" defaultChecked /> Send a push
					notification to members
				</label>
			)}
			<div className="flex items-center gap-4">
				<SubmitButton
					label={mode === "edit" ? "Save changes" : "Publish"}
					pendingLabel={mode === "edit" ? "Saving..." : "Posting..."}
					className="rounded-lg px-4 py-2 text-3 font-medium"
					style={{ background: "#2563eb", color: "#fff" }}
				/>
				{mode === "edit" && cancelHref && (
					<Link href={cancelHref} prefetch={false} className="text-3 underline">
						Cancel
					</Link>
				)}
			</div>
		</form>
	);
}