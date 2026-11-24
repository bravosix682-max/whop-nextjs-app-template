"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

export type ThemeMode = "system" | "light" | "dark";

const FONT_URL =
	"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Anton&family=Bangers&family=Bebas+Neue&family=Caveat&family=Dancing+Script&family=JetBrains+Mono&family=Lobster&family=Lora&family=Merriweather&family=Montserrat&family=Orbitron&family=Oswald&family=Pacifico&family=Permanent+Marker&family=Playfair+Display&family=Poppins&family=Righteous&family=Silkscreen&display=swap";

const ThemeContext = createContext<{
	mode: ThemeMode;
	setMode: (m: ThemeMode) => void;
}>({
	mode: "system",
	setMode: () => {},
});

export function Shell({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<ThemeMode>("system");

	useEffect(() => {
		try {
			const saved = localStorage.getItem("an-theme");
			if (saved === "light" || saved === "dark" || saved === "system") {
				setModeState(saved);
			}
		} catch {}
	}, []);

	function setMode(m: ThemeMode) {
		setModeState(m);
		try {
			localStorage.setItem("an-theme", m);
		} catch {}
	}

	return (
		<ThemeContext.Provider value={{ mode, setMode }}>
			<link rel="preconnect" href="https://fonts.googleapis.com" />
			<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
			<link rel="stylesheet" href={FONT_URL} />
			<div className="an-root" data-theme={mode}>
				{children}
			</div>
		</ThemeContext.Provider>
	);
}

export function useThemeMode() {
	return useContext(ThemeContext);
}