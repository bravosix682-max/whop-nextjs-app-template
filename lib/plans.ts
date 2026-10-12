export type Plan = "starter" | "pro" | "business";

export const PLAN_NAMES: Record<Plan, string> = {
	starter: "Starter",
	pro: "Pro",
	business: "Business",
};

export const PLAN_PRICES: Record<Plan, number> = {
	starter: 0,
	pro: 6,
	business: 14,
};

export const EMOJIS = ["🔥", "❤️", "👏", "🎉", "👍"];

export type Features = {
	liveMax: number;
	pinMax: number;
	channelsMax: number;
	attachMax: number;
	attachMb: number;
	schedule: boolean;
	poll: boolean;
	acknowledge: boolean;
	countdown: boolean;
	expire: boolean;
	targetProducts: boolean;
	whopChat: boolean;
	whopForum: boolean;
	spam: boolean;
	abTest: boolean;
	email: boolean;
	banList: boolean;
	mentions: boolean;
	fullAnalytics: boolean;
	csvExport: boolean;
};

const BIG = 100000;

export const FEATURES: Record<Plan, Features> = {
	starter: {
		liveMax: 5,
		pinMax: 1,
		channelsMax: 1,
		attachMax: 2,
		attachMb: 10,
		schedule: false,
		poll: false,
		acknowledge: false,
		countdown: false,
		expire: false,
		targetProducts: false,
		whopChat: false,
		whopForum: false,
		spam: false,
		abTest: false,
		email: false,
		banList: false,
		mentions: false,
		fullAnalytics: false,
		csvExport: false,
	},
	pro: {
		liveMax: BIG,
		pinMax: BIG,
		channelsMax: 3,
		attachMax: 6,
		attachMb: 25,
		schedule: true,
		poll: true,
		acknowledge: true,
		countdown: true,
		expire: true,
		targetProducts: true,
		whopChat: true,
		whopForum: true,
		spam: true,
		abTest: false,
		email: false,
		banList: false,
		mentions: false,
		fullAnalytics: true,
		csvExport: false,
	},
	business: {
		liveMax: BIG,
		pinMax: BIG,
		channelsMax: 10,
		attachMax: 10,
		attachMb: 50,
		schedule: true,
		poll: true,
		acknowledge: true,
		countdown: true,
		expire: true,
		targetProducts: true,
		whopChat: true,
		whopForum: true,
		spam: true,
		abTest: true,
		email: true,
		banList: true,
		mentions: true,
		fullAnalytics: true,
		csvExport: true,
	},
};

export function asPlan(value: unknown): Plan {
	return value === "pro" || value === "business" ? value : "starter";
}