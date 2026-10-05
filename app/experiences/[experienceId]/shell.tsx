"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { Icon } from "./icons";

type Theme = "dark" | "light";

const FONT_URL =
	"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
	theme: "dark",
	toggle: () => {},
});

export function Shell({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<Theme>("dark");

	useEffect(() => {
		try {
			const saved = localStorage.getItem("an-theme");
			if (saved === "light" || saved === "dark") setTheme(saved);
		} catch {}
	}, []);

	function toggle() {
		setTheme((t) => {
			const next: Theme = t === "dark" ? "light" : "dark";
			try {
				localStorage.setItem("an-theme", next);
			} catch {}
			return next;
		});
	}

	return (
		<ThemeContext.Provider value={{ theme, toggle }}>
			<link rel="preconnect" href="https://fonts.googleapis.com" />
			<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
			<link rel="stylesheet" href={FONT_URL} />
			<div className="an-root" data-theme={theme}>
				{children}
			</div>
		</ThemeContext.Provider>
	);
}

export function ThemeToggle() {
	const { theme, toggle } = useContext(ThemeContext);
	return (
		<button type="button" className="an-theme" onClick={toggle}>
			<Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
			{theme === "dark" ? "Light mode" : "Dark mode"}
		</button>
	);
}