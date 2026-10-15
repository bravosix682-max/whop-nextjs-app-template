// @ts-nocheck
"use server";

import { headers } from "next/headers";
import { cached, claim } from "@/lib/cache";
import { getPrefs, isBannedRow, listBans, reactionOn } from "@/lib/delivery-db";
import { notifyExperience } from "@/lib/notify";
import { activityPeople } from "@/lib/people";
import { FEATURES } from "@/lib/plans";
import { getAnnouncement, getPlanInfo, listAnnouncements, toggleReaction } from "@/lib/supabase";
import { companyOf, listMembers, userInfo } from "@/lib/whop-data";
import { whopsdk } from "@/lib/whop-sdk";

const UUID = /^[0-9a-f-]{36}$/i;

function validEmoji(e: any) {
	return (
		typeof e === "string" &&
		e.length > 0 &&
		e.length <= 24 &&
		/^\p{Extended_Pictographic}/u.test(e) &&
		!/[<>\s]/.test(e)
	);
}

async function ctx(experienceId: string) {
	const { userId } = await whopsdk.verifyUserToken(await headers());
	const access: any = await cached(`access:${userId}:${experienceId}`, 60_000, () =>
		whopsdk.users.checkAccess(experienceId, { id: userId }),
	);
	const isAdmin = String(access?.access_level) === "admin";
	const canView = isAdmin || access?.has_access !== false;
	const info: any = await cached(`plan:${experienceId}`, 3_000, () => getPlanInfo(experienceId));
	return { userId, isAdmin, canView, f: FEATURES[info.plan] };
}

async function guardMember(experienceId: string, c: any) {
	if (c.isAdmin) return;
	if (!c.canView) throw new Error("No access");
	const banned = await cached(`ban:${experienceId}:${c.userId}`, 15_000, () =>
		isBannedRow(experienceId, c.userId),
	);
	if (banned) throw new Error("You are restricted in this community.");
}

export async function react(experienceId: string, id: string, emoji: string) {
	if (!UUID.test(id) || !validEmoji(emoji)) throw new Error("Invalid reaction");
	const c = await ctx(experienceId);
	await guardMember(experienceId, c);
	await toggleReaction(id, c.userId, emoji);
	if (c.isAdmin) return;
	try {
		const prefs = await getPrefs(experienceId);
		if (!prefs.notify_reactions) return;
		if (!(await reactionOn(id, c.userId, emoji))) return;
		if (!claim(`rn:${id}:${c.userId}`, 60_000)) return;
		const post: any = await getAnnouncement(experienceId, id);
		if (!post?.author_id) return;
		const who = await userInfo(c.userId);
		await notifyExperience({
			experienceId,
			title: "New reaction",
			content: `${who.name} reacted ${emoji} to "${post.title}"`,
			userIds: [post.author_id],
		});
	} catch {}
}

async function pool(experienceId: string, me: string) {
	let whop: any[] = [];
	let whopError = "";
	try {
		const company = await companyOf(experienceId);
		if (company.id) {
			const res = await listMembers(company.id, 3);
			whop = res.members;
			whopError = res.error ?? "";
		} else whopError = "LOAD";
	} catch {
		whopError = "LOAD";
	}
	let members = whop
		.filter((m) => m.access !== "admin" && m.id !== me)
		.map((m) => ({ id: m.id, name: m.name, handle: m.handle }));
	let source = "whop";
	if (members.length === 0) {
		source = "activity";
		const posts = await listAnnouncements(experienceId).catch(() => []);
		const authors = Array.from(new Set(posts.map((p: any) => p.author_id).filter(Boolean)));
		members = await activityPeople(posts.map((p: any) => p.id), [me, ...authors]).catch(() => []);
	}
	return { members, source, whopError };
}

export async function fetchMembers(experienceId: string) {
	const c = await ctx(experienceId);
	if (!c.isAdmin) return { members: [], source: "none", note: "", error: "DENIED" };
	if (!c.f.banList) return { members: [], source: "none", note: "", error: "PLAN" };
	const bans = await listBans(experienceId).catch(() => []);
	const banned = new Set(bans.map((b: any) => b.user_id));
	const p = await pool(experienceId, c.userId);
	const members = p.members.map((m: any) => ({ ...m, banned: banned.has(m.id) }));
	for (const b of bans) {
		if (!members.find((m: any) => m.id === b.user_id)) {
			members.push({ id: b.user_id, name: b.name ?? "", handle: b.handle ?? "", banned: true });
		}
	}
	const note =
		p.source === "activity"
			? "Showing members who viewed, reacted or commented on your announcements."
			: "";
	const error = members.length === 0 && p.whopError ? (p.whopError === "PERMISSION" ? "PERMISSION" : "LOAD") : "";
	return { members, source: p.source, note, whopError: p.whopError, error };
}

export async function fetchMentionMembers(experienceId: string) {
	const c = await ctx(experienceId);
	if (!c.isAdmin || !c.f.mentions) return { members: [], error: "Mentions are on the Business plan." };
	const p = await pool(experienceId, c.userId);
	const members = p.members.filter((m: any) => m.handle);
	return {
		members,
		error: members.length ? "" : "No members to mention yet. Members appear here after they view, react or comment.",
	};
}