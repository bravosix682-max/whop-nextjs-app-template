"use client";

import { useEffect } from "react";

export function ViewTracker({ action }: { action: () => Promise<void> }) {
	useEffect(() => {
		action().catch(() => {});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	return null;
}