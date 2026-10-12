import type { CSSProperties } from "react";

const PATHS = {
	megaphone: (
		<>
			<path d="m3 11 18-5v12L3 14v-3z" />
			<path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
		</>
	),
	edit: (
		<>
			<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
			<path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z" />
		</>
	),
	pencil: <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
	chart: (
		<>
			<path d="M3 3v16a2 2 0 0 0 2 2h16" />
			<path d="M18 17V9" />
			<path d="M13 17V5" />
			<path d="M8 17v-3" />
		</>
	),
	crown: <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />,
	sun: (
		<>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2" />
			<path d="M12 20v2" />
			<path d="m4.93 4.93 1.41 1.41" />
			<path d="m17.66 17.66 1.41 1.41" />
			<path d="M2 12h2" />
			<path d="M20 12h2" />
			<path d="m6.34 17.66-1.41 1.41" />
			<path d="m19.07 4.93-1.41 1.41" />
		</>
	),
	moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
	monitor: (
		<>
			<rect width="20" height="14" x="2" y="3" rx="2" />
			<path d="M8 21h8" />
			<path d="M12 17v4" />
		</>
	),
	pin: (
		<>
			<path d="M12 17v5" />
			<path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
		</>
	),
	trash: (
		<>
			<path d="M3 6h18" />
			<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
			<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
			<path d="M10 11v6" />
			<path d="M14 11v6" />
		</>
	),
	eye: (
		<>
			<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
			<circle cx="12" cy="12" r="3" />
		</>
	),
	lock: (
		<>
			<rect width="18" height="11" x="3" y="11" rx="2" />
			<path d="M7 11V7a5 5 0 0 1 10 0v4" />
		</>
	),
	timer: (
		<>
			<path d="M10 2h4" />
			<path d="m12 14 3-3" />
			<circle cx="12" cy="14" r="8" />
		</>
	),
	users: (
		<>
			<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</>
	),
	download: (
		<>
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<path d="m7 10 5 5 5-5" />
			<path d="M12 15V3" />
		</>
	),
	type: (
		<>
			<path d="M4 7V4h16v3" />
			<path d="M9 20h6" />
			<path d="M12 4v16" />
		</>
	),
	bold: (
		<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
	),
	italic: (
		<>
			<path d="M19 4h-9" />
			<path d="M14 20H5" />
			<path d="M15 4 9 20" />
		</>
	),
	underline: (
		<>
			<path d="M6 4v6a6 6 0 0 0 12 0V4" />
			<path d="M4 20h16" />
		</>
	),
	strike: (
		<>
			<path d="M16 4H9a3 3 0 0 0-2.83 4" />
			<path d="M14 12a4 4 0 0 1 0 8H6" />
			<path d="M4 12h16" />
		</>
	),
	list: (
		<>
			<path d="M8 6h13" />
			<path d="M8 12h13" />
			<path d="M8 18h13" />
			<path d="M3 6h.01" />
			<path d="M3 12h.01" />
			<path d="M3 18h.01" />
		</>
	),
	listOrdered: (
		<>
			<path d="M10 6h11" />
			<path d="M10 12h11" />
			<path d="M10 18h11" />
			<path d="M4 6h1v4" />
			<path d="M4 10h2" />
			<path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
		</>
	),
	alignLeft: (
		<>
			<path d="M21 6H3" />
			<path d="M15 12H3" />
			<path d="M17 18H3" />
		</>
	),
	alignCenter: (
		<>
			<path d="M21 6H3" />
			<path d="M17 12H7" />
			<path d="M19 18H5" />
		</>
	),
	alignRight: (
		<>
			<path d="M21 6H3" />
			<path d="M21 12H9" />
			<path d="M21 18H7" />
		</>
	),
	paperclip: (
		<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
	),
	plus: (
		<>
			<path d="M5 12h14" />
			<path d="M12 5v14" />
		</>
	),
	smile: (
		<>
			<circle cx="12" cy="12" r="10" />
			<path d="M8 14s1.5 2 4 2 4-2 4-2" />
			<path d="M9 9h.01" />
			<path d="M15 9h.01" />
		</>
	),
	link: (
		<>
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
		</>
	),
	play: (
		<>
			<rect width="20" height="14" x="2" y="5" rx="4" />
			<path d="m10 9 5 3-5 3z" />
		</>
	),
	atSign: (
		<>
			<circle cx="12" cy="12" r="4" />
			<path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
		</>
	),
	message: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />,
	comment: (
		<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
	),
	globe: (
		<>
			<circle cx="12" cy="12" r="10" />
			<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
			<path d="M2 12h20" />
		</>
	),
	send: (
		<>
			<path d="m22 2-7 20-4-9-9-4Z" />
			<path d="M22 2 11 13" />
		</>
	),
	bell: (
		<>
			<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
			<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
		</>
	),
	calendar: (
		<>
			<rect width="18" height="18" x="3" y="4" rx="2" />
			<path d="M16 2v4" />
			<path d="M8 2v4" />
			<path d="M3 10h18" />
		</>
	),
	file: (
		<>
			<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
			<path d="M14 2v4a2 2 0 0 0 2 2h4" />
		</>
	),
	image: (
		<>
			<rect width="18" height="18" x="3" y="3" rx="2" />
			<circle cx="9" cy="9" r="2" />
			<path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
		</>
	),
	film: (
		<>
			<rect width="18" height="18" x="3" y="3" rx="2" />
			<path d="M7 3v18" />
			<path d="M3 12h18" />
			<path d="M17 3v18" />
		</>
	),
	x: (
		<>
			<path d="M18 6 6 18" />
			<path d="m6 6 12 12" />
		</>
	),
	check: <path d="M20 6 9 17l-5-5" />,
	ban: (
		<>
			<circle cx="12" cy="12" r="10" />
			<path d="m4.9 4.9 14.2 14.2" />
		</>
	),
	shield: (
		<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
	),
	settings: (
		<>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
		</>
	),
	refresh: (
		<>
			<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
			<path d="M21 3v5h-5" />
			<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
			<path d="M8 16H3v5" />
		</>
	),
	chevron: <path d="m6 9 6 6 6-6" />,
	package: (
		<>
			<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
			<path d="M12 22V12" />
			<path d="m3.3 7 7.7 4.7a2 2 0 0 0 2 0L20.7 7" />
		</>
	),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
	name,
	size = 16,
	style,
}: {
	name: IconName;
	size?: number;
	style?: CSSProperties;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			style={{ flex: "none", ...style }}
			aria-hidden="true"
		>
			{PATHS[name]}
		</svg>
	);
}