export type Template = { label: string; title: string; body: string };

export const QUICK: Template[] = [
	{
		label: "Product drop",
		title: "New drop is live",
		body: "What's new:\n- \n- \n\nGet it here: ",
	},
	{
		label: "Live event",
		title: "Live event this week",
		body: "When: [date and time]\nWhere: [link]\n\nWhat we'll cover:\n- \n- ",
	},
	{
		label: "Policy update",
		title: "Updated policy",
		body: "What changed:\n\nWhen it starts: [date]\n\nPlease confirm you've read this.",
	},
	{
		label: "Win / milestone",
		title: "We hit a milestone!",
		body: "Thank you all. We just reached [milestone].\n\nHere's what's next:\n- ",
	},
];

export const TEMPLATES: { group: string; items: Template[] }[] = [
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
		],
	},
];