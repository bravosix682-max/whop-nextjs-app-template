"use client";

import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
	label,
	pendingLabel,
	className,
	style,
}: {
	label: string;
	pendingLabel: string;
	className?: string;
	style?: CSSProperties;
}) {
	const { pending } = useFormStatus();
	return (
		<button
			type="submit"
			disabled={pending}
			className={className}
			style={{
				...style,
				opacity: pending ? 0.6 : 1,
				cursor: pending ? "wait" : "pointer",
			}}
		>
			{pending ? pendingLabel : label}
		</button>
	);
}