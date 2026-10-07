"use client";

import { useIframeSdk, WhopIframeSdkProvider } from "@whop/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type CheckoutStart = {
	ok: boolean;
	error?: string;
	id?: string;
	planId?: string;
};

type Props = {
	plan: string;
	label: string;
	primary?: boolean;
	startCheckout: (plan: string) => Promise<CheckoutStart>;
	checkPlan: () => Promise<string>;
};

function explain(err: unknown) {
	if (typeof err === "string" && err) return err;
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: unknown }).message);
	}
	return "The payment was cancelled or did not go through.";
}

function Inner({ plan, label, primary, startCheckout, checkPlan }: Props) {
	const iframeSdk = useIframeSdk();
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");

	async function go() {
		if (busy) return;
		setBusy(true);
		setMessage("");
		try {
			const start = await startCheckout(plan);
			if (!start.ok || !start.id || !start.planId) {
				setMessage(start.error ?? "Could not start checkout.");
				return;
			}
			const res: any = await iframeSdk.inAppPurchase({
				planId: start.planId,
				id: start.id,
			});
			if (res?.status !== "ok") {
				setMessage(explain(res?.error));
				return;
			}
			setMessage("Payment received. Activating your plan...");
			for (let i = 0; i < 14; i++) {
				if ((await checkPlan()) === plan) {
					setMessage("");
					router.refresh();
					return;
				}
				await new Promise((r) => setTimeout(r, 2500));
			}
			setMessage(
				"Payment received. Your plan will switch on within a minute. Reload the page if it does not.",
			);
		} catch (e) {
			setMessage(explain(e));
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<button
				type="button"
				className={primary ? "an-btn-primary" : "an-btn-ghost"}
				disabled={busy}
				onClick={go}
			>
				{busy ? "Working..." : label}
			</button>
			{message ? <p className="an-muted an-center">{message}</p> : null}
		</>
	);
}

export function UpgradeButton(props: Props) {
	return (
		<WhopIframeSdkProvider>
			<Inner {...props} />
		</WhopIframeSdkProvider>
	);
}