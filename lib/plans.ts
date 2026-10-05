export type Plan = "starter" | "pro" | "business";

export const PLAN_NAMES: Record<Plan, string> = {
	starter: "Starter",
	pro: "Pro",
	business: "Business",
};

export const PLAN_PRICES: Record<Plan, number> = {
	starter: 0,
	pro: 19,
	business: 49,
};

export const EMOJIS = ["🔥", "❤️", "👏", "🎉", "👍"];

export type Features = {
	liveMax: number;
	pinMax: number;
	schedule: boolean;
	poll: boolean;
	acknowledge: boolean;
	countdown: boolean;
	expire: boolean;
	abTest: boolean;
	pushSend: boolean;
	fullAnalytics: boolean;
	csvExport: boolean;
};

export const FEATURES: Record<Plan, Features> = {
	starter: {
		liveMax: 5,
		pinMax: 1,
		schedule: false,
		poll: false,
		acknowledge: false,
		countdown: false,
		expire: false,
		abTest: false,
		pushSend: false,
		fullAnalytics: false,
		csvExport: false,
	},
	pro: {
		liveMax: 100000,
		pinMax: 100000,
		schedule: true,
		poll: true,
		acknowledge: true,
		countdown: true,
		expire: true,
		abTest: false,
		pushSend: false,
		fullAnalytics: true,
		csvExport: false,
	},
	business: {
		liveMax: 100000,
		pinMax: 100000,
		schedule: true,
		poll: true,
		acknowledge: true,
		countdown: true,
		expire: true,
		abTest: true,
		pushSend: true,
		fullAnalytics: true,
		csvExport: true,
	},
};

export function asPlan(value: unknown): Plan {
	return value === "pro" || value === "business" ? value : "starter";
}