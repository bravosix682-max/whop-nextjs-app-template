"use client";

import { useState } from "react";

export function YouTube({ id }: { id: string }) {
	const [play, setPlay] = useState(false);
	return (
		<div className="an-yt">
			{play ? (
				<iframe
					src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
					title="YouTube video"
					allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
					allowFullScreen
				/>
			) : (
				<button type="button" onClick={() => setPlay(true)} aria-label="Play video">
					<img
						src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
						alt=""
						loading="lazy"
					/>
					<span className="an-yt-play">▶</span>
				</button>
			)}
		</div>
	);
}