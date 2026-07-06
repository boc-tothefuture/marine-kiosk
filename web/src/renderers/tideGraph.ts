import type { Elements, State } from "../types";
import {
	createSvgElement,
	getSvgYCoordinate,
	getTargetDayRange,
	getTideHeightAtTime,
} from "../utils";
import {
	getAstronomicalDataForSelectedDay,
	renderLunarTransit,
	renderSunBackground,
} from "./astro";
import { renderCurrentsTimeline } from "./currents";

export function drawTidelogGrid(elements: Elements): void {
	if (!elements.tidelogGridLines) return;
	elements.tidelogGridLines.innerHTML = "";

	for (let h = 0; h <= 24; h += 2) {
		const x = (h / 24) * 1000;
		const isMajor = h === 12 || h === 0 || h === 24;

		const line = createSvgElement("line", {
			x1: x,
			y1: 0,
			x2: x,
			y2: 400,
			class: isMajor ? "tidelog-grid-line major" : "tidelog-grid-line",
		});

		const label =
			h === 0 || h === 24
				? "12 AM"
				: h === 12
					? "NOON"
					: h < 12
						? `${h} AM`
						: `${h - 12} PM`;
		const txt = createSvgElement(
			"text",
			{
				x: x,
				y: 385,
				class: isMajor ? "grid-time-label major" : "grid-time-label",
			},
			label,
		);

		elements.tidelogGridLines.appendChild(line);
		elements.tidelogGridLines.appendChild(txt);
	}
}

export function renderTideWave(
	state: State,
	elements: Elements,
	startMs: number,
	duration: number,
): void {
	let wavePathD = "";
	const steps = 144;

	for (let i = 0; i <= steps; i++) {
		const tMs = startMs + (i / steps) * duration;
		const x = (i / steps) * 1000;
		const y = getSvgYCoordinate(getTideHeightAtTime(state, tMs));
		wavePathD +=
			i === 0
				? `M ${x.toFixed(1)} ${y.toFixed(1)}`
				: ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
	}

	if (elements.waveStrokePath) {
		elements.waveStrokePath.setAttribute("d", wavePathD);
	}
	if (elements.waveFillPath) {
		elements.waveFillPath.setAttribute(
			"d",
			`${wavePathD} L 1000 340 L 0 340 Z`,
		);
	}
}

export function renderTideOverlayLabels(
	state: State,
	elements: Elements,
	startMs: number,
	endMs: number,
): void {
	const tideOverlayLabels = elements.tideOverlayLabels;
	if (!tideOverlayLabels) return;
	tideOverlayLabels.innerHTML = "";

	const dayExtremes = state.tideExtremes.filter(
		(pt) => pt.timeMs >= startMs && pt.timeMs <= endMs,
	);

	for (const pt of dayExtremes) {
		const xPct = ((pt.timeMs - startMs) / (24 * 3600 * 1000)) * 100;
		const yPct = (getSvgYCoordinate(pt.value) / 400) * 100;
		const isHigh = pt.type === "H";

		const div = document.createElement("div");
		div.className = `tide-callout ${isHigh ? "high" : "low"}`;
		div.style.left = `${xPct}%`;
		div.style.top = `calc(${yPct}% + ${isHigh ? -22 : 22}px)`;

		const timeStr = new Date(pt.timeMs).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});

		div.innerHTML = `
			<div class="tide-callout-text">${isHigh ? "+" : ""}${pt.value.toFixed(1)} FT</div>
			<div class="tide-callout-sub">${timeStr}</div>
		`;
		tideOverlayLabels.appendChild(div);
	}
}

export function renderTidelogGraph(state: State, elements: Elements): void {
	const [startMs, endMs] = getTargetDayRange(state);
	const duration = 24 * 3600 * 1000;
	const dayAstro = getAstronomicalDataForSelectedDay(state);

	renderSunBackground(elements, startMs, duration, dayAstro);
	renderLunarTransit(state, elements, startMs, duration, dayAstro);
	renderTideWave(state, elements, startMs, duration);
	renderTideOverlayLabels(state, elements, startMs, endMs);
	renderCurrentsTimeline(state, elements, startMs, endMs);
}
