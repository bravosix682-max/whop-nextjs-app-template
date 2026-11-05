"use client";

export default function ErrorPage() {
	return (
		<div
			style={{
				minHeight: "100vh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 16,
				background: "#0b0b12",
				color: "#fff",
				fontFamily: "system-ui, sans-serif",
				padding: 24,
				textAlign: "center",
			}}
		>
			<h2 style={{ margin: 0 }}>Something went wrong</h2>
			<p style={{ margin: 0, opacity: 0.7, maxWidth: 420 }}>
				If you just posted an announcement, it was saved. Press reload to continue.
			</p>
			<button
				type="button"
				onClick={() => window.location.reload()}
				style={{
					background: "linear-gradient(135deg,#ff5a1f,#e21f3a)",
					color: "#fff",
					border: 0,
					borderRadius: 999,
					padding: "12px 28px",
					fontWeight: 700,
					cursor: "pointer",
				}}
			>
				Reload
			</button>
		</div>
	);
}