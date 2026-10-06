import "./announcements.css";

export default function Loading() {
	return (
		<div className="an-root" data-theme="dark">
			<div className="an-shell">
				<aside className="an-side">
					<div className="an-brand">
						<span
							className="an-sk"
							style={{ width: 40, height: 40, borderRadius: 999 }}
						/>
						<div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
							<span className="an-sk h16 w80" />
							<span className="an-sk h16 w50" />
						</div>
					</div>
					<nav className="an-nav">
						{[1, 2, 3, 4].map((n) => (
							<span key={n} className="an-sk h40" />
						))}
					</nav>
				</aside>
				<main className="an-main">
					<span className="an-sk h40 w50" />
					{[1, 2, 3].map((n) => (
						<div key={n} className="an-card">
							<span className="an-sk h16 w30" />
							<span className="an-sk h24 w70" />
							<span className="an-sk h16" />
							<span className="an-sk h16 w80" />
						</div>
					))}
				</main>
			</div>
		</div>
	);
}