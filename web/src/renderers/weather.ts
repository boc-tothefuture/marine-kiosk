import type { Elements, MarinePeriod, ParsedWind, State } from "../types";

export const windAngles: Record<string, number | null> = {
	N: 180,
	NNE: 202.5,
	NE: 225,
	ENE: 247.5,
	E: 270,
	ESE: 292.5,
	SE: 315,
	SSE: 337.5,
	S: 0,
	SSW: 22.5,
	SW: 45,
	WSW: 67.5,
	W: 90,
	WNW: 112.5,
	NW: 135,
	NNW: 157.5,
	VAR: null,
};

export function parseWind(text: string): ParsedWind {
	let dir = "VAR";
	let speed = "--";
	let gusts: number | null = null;

	const dirMatch = text.match(/\b([N|S|E|W|NE|NW|SE|SW]+)\s+winds\b/i);
	if (dirMatch) {
		dir = dirMatch[1].toUpperCase();
	} else if (text.toLowerCase().includes("variable")) {
		dir = "VAR";
	}

	const speedRangeMatch = text.match(/(\d+)\s*to\s*(\d+)\s*kt\b/i);
	const speedAroundMatch = text.match(/around\s+(\d+)\s*kt\b/i);
	if (speedRangeMatch) {
		speed = `${speedRangeMatch[1]}-${speedRangeMatch[2]}`;
	} else if (speedAroundMatch) {
		speed = `${speedAroundMatch[1]}`;
	}

	const gustsMatch = text.match(/gusts\s+up\s+to\s+(\d+)\s*kt\b/i);
	if (gustsMatch) {
		gusts = Number.parseInt(gustsMatch[1], 10);
	}

	return { dir, speed, gusts };
}

export function parseSeas(text: string): string {
	const rangeMatch = text.match(/Seas\s+(\d+)\s*to\s*(\d+)\s*ft\b/i);
	if (rangeMatch) {
		return `${rangeMatch[1]}-${rangeMatch[2]} FT`;
	}
	const lessMatch = text.match(/Seas\s+(\d+)\s*foot\s+or\s+less\b/i);
	if (lessMatch) {
		return `≤${lessMatch[1]} FT`;
	}
	const aroundMatch = text.match(/Seas\s+around\s+(\d+)\s*ft\b/i);
	if (aroundMatch) {
		return `~${aroundMatch[1]} FT`;
	}
	return "--";
}

export function getWindArrowSvg(dir: string, speedObj: ParsedWind): string {
	const angle = windAngles[dir];
	const isWarning = speedObj.gusts && speedObj.gusts >= 20;
	const isCaution =
		!isWarning &&
		Number.parseInt(speedObj.speed.split("-")[1] || speedObj.speed, 10) >= 15;
	const color = isWarning ? "#f43f5e" : isCaution ? "#f59e0b" : "#9ca3af";

	if (angle === null || angle === undefined || dir === "VAR") {
		return `
			<svg width="14" height="14" viewBox="0 0 24 24" style="display: inline-block; vertical-align: middle;">
				<circle cx="12" cy="12" r="6" fill="none" stroke="${color}" stroke-width="3" />
				<circle cx="12" cy="12" r="2" fill="${color}" />
			</svg>
		`;
	}

	return `
		<svg class="weather-wind-arrow" width="14" height="14" viewBox="0 0 24 24" style="transform: rotate(${angle}deg); display: inline-block; vertical-align: middle;">
			<path d="M12 2L4 22L12 17L20 22L12 2Z" fill="${color}" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" />
		</svg>
	`;
}

export function getWaveSvg(seasText: string): string {
	let pathD = "M 0 10 Q 15 8, 30 10 T 60 10"; // Default calm
	let color = "#06b6d4";

	if (
		seasText.includes("2 to 3") ||
		seasText.includes("2 to 4") ||
		seasText.includes("3 to 5") ||
		seasText.includes("around 2") ||
		seasText.includes("around 3")
	) {
		pathD = "M 0 10 Q 10 5, 20 10 T 40 10 T 60 10";
		color = "#f59e0b";
	}

	if (
		seasText.includes("4 to") ||
		seasText.includes("5 to") ||
		seasText.includes("rough") ||
		seasText.includes("4 ft") ||
		seasText.includes("5 ft")
	) {
		pathD = "M 0 12 L 8 4 L 16 12 L 24 4 L 32 12 L 40 4 L 48 12 L 56 4 L 60 12";
		color = "#f43f5e";
	}

	return `
		<svg width="45" height="12" viewBox="0 0 60 16" style="overflow: visible; display: inline-block; vertical-align: middle;">
			<path d="${pathD}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	`;
}

export function getSeverityClass(
	speedObj: ParsedWind,
	seasText: string,
): string {
	let maxSpeed = 0;
	if (speedObj.speed.includes("-")) {
		maxSpeed = Number.parseInt(speedObj.speed.split("-")[1], 10);
	} else if (speedObj.speed !== "--") {
		maxSpeed = Number.parseInt(speedObj.speed, 10);
	}

	const maxGusts = speedObj.gusts || 0;

	let maxSeas = 0;
	const seasRangeMatch = seasText.match(/(\d+)\s*to\s*(\d+)/);
	if (seasRangeMatch) {
		maxSeas = Number.parseInt(seasRangeMatch[2], 10);
	} else {
		const singleDigitMatch = seasText.match(/(\d+)/);
		if (singleDigitMatch) {
			maxSeas = Number.parseInt(singleDigitMatch[1], 10);
		}
	}

	if (maxSpeed >= 15 || maxGusts >= 20 || maxSeas >= 4) {
		return "warning";
	}
	if (maxSpeed >= 10 || maxSeas >= 2) {
		return "caution";
	}
	return "normal";
}

export function getForecastPeriodsForSelectedDay(state: State): {
	dayPeriod?: MarinePeriod;
	nightPeriod?: MarinePeriod;
} {
	const targetDate = new Date();
	targetDate.setDate(targetDate.getDate() + state.selectedDayOffset);

	const dayOfWeekStr = targetDate
		.toLocaleDateString("en-US", { weekday: "short" })
		.toUpperCase(); // e.g. "MON", "TUE"

	let dayPeriod: MarinePeriod | undefined;
	let nightPeriod: MarinePeriod | undefined;

	if (state.selectedDayOffset === 0) {
		dayPeriod = state.marineForecast.find(
			(p) => p.name === "TODAY" || p.name === "THIS DAY",
		);
		nightPeriod = state.marineForecast.find((p) => p.name === "TONIGHT");

		// If today's daytime forecast has passed (it's evening), fall back
		if (!dayPeriod && state.marineForecast.length > 0) {
			dayPeriod = state.marineForecast[0]; // first available
		}
		if (!nightPeriod && state.marineForecast.length > 1) {
			nightPeriod = state.marineForecast[1];
		}
	} else {
		dayPeriod = state.marineForecast.find(
			(p) => p.name === dayOfWeekStr || p.name === `${dayOfWeekStr}DAY`,
		);
		nightPeriod = state.marineForecast.find(
			(p) =>
				p.name === `${dayOfWeekStr} NIGHT` ||
				p.name === `${dayOfWeekStr}Y NIGHT`,
		);
	}

	return { dayPeriod, nightPeriod };
}

export function renderForecast(state: State, elements: Elements): void {
	const weatherTimelineBar = elements.weatherTimelineBar;
	if (!weatherTimelineBar) return;
	weatherTimelineBar.innerHTML = "";

	if (state.marineForecast.length === 0) {
		weatherTimelineBar.innerHTML =
			'<div class="weather-timeline-block" style="flex: 1;"><div class="placeholder">No forecast available</div></div>';
		return;
	}

	const { dayPeriod, nightPeriod } = getForecastPeriodsForSelectedDay(state);

	const activeDayPeriod = dayPeriod || {
		name: "Day",
		text: "Forecast not available.",
	};
	const activeNightPeriod = nightPeriod || {
		name: "Night",
		text: "Forecast not available.",
	};

	// Parse parameters
	const dayWind = parseWind(activeDayPeriod.text);
	const daySeas = parseSeas(activeDayPeriod.text);
	const daySeverity = getSeverityClass(dayWind, daySeas);

	const nightWind = parseWind(activeNightPeriod.text);
	const nightSeas = parseSeas(activeNightPeriod.text);
	const nightSeverity = getSeverityClass(nightWind, nightSeas);

	// Create 3 blocks representing 24 hours:
	// 00:00 - 06:00 (Night, 25% width), 06:00 - 18:00 (Day, 50% width), 18:00 - 24:00 (Night, 25% width)
	const blocks = [
		{
			title: "Early AM (Night)",
			width: "25%",
			wind: nightWind,
			seas: nightSeas,
			severity: nightSeverity,
			text: activeNightPeriod.text,
		},
		{
			title: "Daytime",
			width: "50%",
			wind: dayWind,
			seas: daySeas,
			severity: daySeverity,
			text: activeDayPeriod.text,
		},
		{
			title: "Late PM (Night)",
			width: "25%",
			wind: nightWind,
			seas: nightSeas,
			severity: nightSeverity,
			text: activeNightPeriod.text,
		},
	];

	for (const block of blocks) {
		const div = document.createElement("div");
		div.className = `weather-timeline-block ${block.severity}`;
		div.style.width = block.width;

		const gustsHtml = block.wind.gusts
			? `<span class="weather-wind-gusts">G ${block.wind.gusts}</span>`
			: "";

		div.innerHTML = `
			<div class="weather-block-title">${block.title}</div>
			<div class="weather-block-data">
				<div class="weather-block-wind">
					${getWindArrowSvg(block.wind.dir, block.wind)}
					<span class="weather-wind-dir">${block.wind.dir}</span>
					<span class="weather-wind-speed">${block.wind.speed} KT</span>
					${gustsHtml}
				</div>
				<div class="weather-block-seas">
					${getWaveSvg(block.seas)}
					<span class="weather-seas-val">${block.seas}</span>
				</div>
			</div>
		`;

		weatherTimelineBar.appendChild(div);
	}
}
