import { updateAstronomicalDetails } from "./renderers/astro";
import { drawTidelogGrid, renderTidelogGraph } from "./renderers/tideGraph";
import { renderForecast } from "./renderers/weather";
import type { Elements, State } from "./types";
import {
	get48HourRange,
	getCurrentSpeedAtTime,
	getSvgYCoordinate,
	getTideHeightAtTime,
} from "./utils";

// --- State & Elements ---

const state: State = {
	stationId: "8418150",
	stationName: "PORTLAND HARBOR",
	currentsStationId: "CAB1401",
	dateStr: "",
	tideHeights: [],
	tideExtremes: [],
	currentPredictions: [],
	units: "english",
	datum: "MLLW",
	waterTemp: null,
	marineForecast: [],
	connectionOnline: true,
	viewOffsetHours: 0,
};

const elements: Elements = {
	stationName: document.getElementById("station-name"),
	digitalTime: document.getElementById("digital-time"),
	digitalDate: document.getElementById("digital-date"),
	currentTideVal: document.getElementById("current-tide-val"),
	currentTideUnit: document.getElementById("current-tide-unit"),
	currentTideSlope: document.getElementById("current-tide-slope"),
	currentStatusVal: document.getElementById("current-status-val"),
	weatherTimelineBar: document.getElementById("weather-timeline-bar"),
	tidelogContent: document.getElementById("tidelog-content"),

	waterTempVal: document.getElementById("water-temp-val"),

	badgeToday: document.getElementById("badge-today"),
	badgeTomorrow: document.getElementById("badge-tomorrow"),

	metaStationId: document.getElementById("meta-station-id"),
	metaCurrentsStationId: document.getElementById("meta-currents-station-id"),
	lastUpdatedText: document.getElementById("last-updated-text"),

	tidelogGridLines: document.getElementById(
		"tidelog-grid-lines",
	) as SVGElement | null,
	waveStrokePath: document.getElementById(
		"wave-stroke-path",
	) as SVGPathElement | null,
	waveFillPath: document.getElementById(
		"wave-fill-path",
	) as SVGPathElement | null,
	sunPath: document.getElementById("sun-path") as SVGPathElement | null,
	sunStrokePath: document.getElementById(
		"sun-stroke-path",
	) as SVGPathElement | null,
	lunarTransitPath: document.getElementById(
		"lunar-transit-path",
	) as SVGPathElement | null,
	moonIndicatorGroup: document.getElementById(
		"moon-indicator-group",
	) as SVGElement | null,
	moonIndicatorCircle: document.getElementById(
		"moon-indicator-circle",
	) as SVGEllipseElement | null,
	moonIndicatorIcon: document.getElementById(
		"moon-indicator-icon",
	) as SVGTextElement | null,
	nowMarkerLine: document.getElementById(
		"now-marker-line",
	) as SVGLineElement | null,
	nowMarkerDot: document.getElementById("now-marker-dot"),
	nowMarkerBadge: document.getElementById("now-marker-badge"),

	sunriseLine: document.getElementById("sunrise-line") as SVGLineElement | null,
	sunsetLine: document.getElementById("sunset-line") as SVGLineElement | null,
	sunriseLine2: document.getElementById(
		"sunrise-line-2",
	) as SVGLineElement | null,
	sunsetLine2: document.getElementById(
		"sunset-line-2",
	) as SVGLineElement | null,

	moonriseLine: document.getElementById(
		"moonrise-line",
	) as SVGLineElement | null,
	moonsetLine: document.getElementById("moonset-line") as SVGLineElement | null,
	moonriseLine2: document.getElementById(
		"moonrise-line-2",
	) as SVGLineElement | null,
	moonsetLine2: document.getElementById(
		"moonset-line-2",
	) as SVGLineElement | null,

	tideOverlayLabels: document.getElementById("tide-overlay-labels"),
	astroOverlayLabels: document.getElementById("astro-overlay-labels"),
	gridOverlayLabels: document.getElementById("grid-overlay-labels"),
	currentsEventsWrapper: document.getElementById("currents-events-wrapper"),
	scrollableTimeline: document.getElementById("scrollable-timeline"),

	currentsFloodPath: document.getElementById(
		"currents-flood-path",
	) as SVGPathElement | null,
	currentsEbbPath: document.getElementById(
		"currents-ebb-path",
	) as SVGPathElement | null,
	currentsStrokePath: document.getElementById(
		"currents-stroke-path",
	) as SVGPathElement | null,
};

// --- Initialization ---

window.addEventListener("DOMContentLoaded", () => {
	const urlParams = new URLSearchParams(window.location.search);
	const isKiosk = urlParams.get("kiosk") === "true";

	if (isKiosk) {
		document.body.classList.add("kiosk-mode");
		requestAnimationFrame(kioskSweepTick);
	} else {
		setupNavigationHandlers();
	}

	loadData();
	setInterval(updateClock, 1000);
	setInterval(loadData, 10 * 60 * 1000);
});

// How long the crossfade takes when the header date flips to the next day.
const DAY_TRANSITION_MS = 2000;

// One-way traversal time for the kiosk auto-scroll sweep across the full
// 48h graph. Round trip (today -> tomorrow -> today) takes 2x this.
const KIOSK_SWEEP_LEG_MS = 90000;

// Fades an element out, swaps its content at the midpoint (while invisible),
// then fades it back in, so text/list changes don't pop instantly while the
// graph is still mid-slide.
function crossfadeUpdate(
	el: HTMLElement | null,
	updateFn: () => void,
	totalDurationMs: number,
): void {
	if (!el) {
		updateFn();
		return;
	}
	const half = totalDurationMs / 2;
	el.style.opacity = "0";
	setTimeout(() => {
		updateFn();
		el.style.opacity = "1";
	}, half);
}

// The calendar day (0 = today, 1 = tomorrow) that the center of the current
// viewport falls on. The viewport is a 24h-wide window starting at
// viewOffsetHours into the 48h graph, so its center sits 12h later - once
// that crosses hour 24 of the graph, the window is showing more of tomorrow
// than today and everything day-scoped (header date, astro icon) should
// follow it there.
function viewportDayOffset(hours: number): number {
	return hours + 12 >= 24 ? 1 : 0;
}

// Applies a viewport position (0-24h into the 48h graph) to the timeline
// transform, and flips over any day-scoped UI (header date, astro icon)
// exactly when the viewport's center crosses the midnight boundary, rather
// than on every call.
let lastAppliedDayOffset = 0;
function applyViewOffset(hours: number): void {
	state.viewOffsetHours = hours;

	const timeline = elements.scrollableTimeline;
	if (timeline) {
		timeline.style.transform = `translateX(-${(hours / 24) * 50}%)`;
	}

	const dayOffset = viewportDayOffset(hours);
	if (dayOffset !== lastAppliedDayOffset) {
		lastAppliedDayOffset = dayOffset;
		crossfadeUpdate(elements.digitalDate, updateDateHeader, DAY_TRANSITION_MS);
		updateAstronomicalDetails(state, elements, dayOffset);
	}
}

function setupNavigationHandlers(): void {
	if (elements.badgeToday) {
		elements.badgeToday.addEventListener("click", () => {
			applyViewOffset(0);
			setActiveBadge(0);
		});
	}
	if (elements.badgeTomorrow) {
		elements.badgeTomorrow.addEventListener("click", () => {
			applyViewOffset(24);
			setActiveBadge(24);
		});
	}
}

function setActiveBadge(hours: number): void {
	if (!elements.badgeToday || !elements.badgeTomorrow) return;
	if (hours === 0) {
		elements.badgeToday.classList.add("active");
		elements.badgeTomorrow.classList.remove("active");
	} else {
		elements.badgeTomorrow.classList.add("active");
		elements.badgeToday.classList.remove("active");
	}
}

function easeInOutSine(x: number): number {
	return -(Math.cos(Math.PI * x) - 1) / 2;
}

// Drives the kiosk-mode auto-scroll: a slow, continuous ping-pong sweep
// across the full 48h graph (today -> tomorrow -> today -> ...) so the
// viewport is always smoothly in motion instead of holding on a day and
// hard-cutting to the next.
function kioskSweepTick(nowMs: number): void {
	const cycle = nowMs % (KIOSK_SWEEP_LEG_MS * 2);
	const goingForward = cycle < KIOSK_SWEEP_LEG_MS;
	const leg = goingForward ? cycle : cycle - KIOSK_SWEEP_LEG_MS;
	const progress = easeInOutSine(leg / KIOSK_SWEEP_LEG_MS);

	applyViewOffset(goingForward ? progress * 24 : 24 - progress * 24);
	requestAnimationFrame(kioskSweepTick);
}

// --- Data Fetching & Processing ---

async function loadData(): Promise<void> {
	try {
		const data = await fetchTideData();
		processTideData(data);
		updateUI();
	} catch (error) {
		console.error("Failed to load live tide data for Tidelog:", error);
	}
}

// biome-ignore lint/suspicious/noExplicitAny: Raw API response
async function fetchTideData(): Promise<any> {
	const response = await fetch("/tide_data.json", { cache: "no-store" });
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	return await response.json();
}

// biome-ignore lint/suspicious/noExplicitAny: Raw API response
function processTideData(data: any): void {
	// biome-ignore lint/suspicious/noExplicitAny: pt is mapped from raw json
	const parseTime = (pt: any) => ({
		...pt,
		timeMs: new Date(pt.time).getTime(),
	});

	state.stationId = data.station_id;
	state.stationName = data.station_name.toUpperCase();
	state.currentsStationId = data.currents_station_id || "CAB1401";
	state.dateStr = data.date;
	state.tideHeights = (data.tide_heights || []).map(parseTime);
	state.tideExtremes = (data.tide_extremes || []).map(parseTime);
	state.currentPredictions = (data.current_predictions || []).map(parseTime);

	state.units = data.units || "english";
	state.datum = data.datum || "MLLW";
	state.waterTemp = data.water_temp ?? null;
	state.marineForecast = data.marine_forecast || [];
	state.astronomical_data = data.astronomical_data || {};
	state.lastUpdated = data.last_updated;
}

// --- UI Orchestration ---

function updateUI(): void {
	if (elements.stationName)
		elements.stationName.textContent = state.stationName;
	if (elements.metaStationId)
		elements.metaStationId.textContent = state.stationId;
	if (elements.metaCurrentsStationId)
		elements.metaCurrentsStationId.textContent = state.currentsStationId;
	if (elements.currentTideUnit)
		elements.currentTideUnit.textContent =
			state.units === "english" ? "FT" : "M";

	if (state.lastUpdated && elements.lastUpdatedText) {
		const updatedDate = new Date(state.lastUpdated);
		elements.lastUpdatedText.textContent = `UPDATED: ${updatedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	}

	updateWaterTemp();
	drawTidelogGrid(elements);
	renderForecast(state, elements);
	updateAstronomicalDetails(
		state,
		elements,
		viewportDayOffset(state.viewOffsetHours),
	);
	renderTidelogGraph(state, elements);
	updateClock();
}

function updateWaterTemp(): void {
	if (!elements.waterTempVal) return;
	const tempUnit = state.units === "english" ? "°F" : "°C";
	elements.waterTempVal.textContent =
		state.waterTemp !== null
			? `WATER ${state.waterTemp}${tempUnit}`
			: "WATER --";
}

function updateClock(): void {
	const now = new Date();
	updateClockHeader(now);
	updateDateHeader();
	updateNowTracker(now);
}

function updateClockHeader(now: Date): void {
	if (!elements.digitalTime) return;
	let hrs = now.getHours();
	const mins = String(now.getMinutes()).padStart(2, "0");
	const ampm = hrs >= 12 ? "PM" : "AM";
	hrs = hrs % 12 || 12;
	elements.digitalTime.innerHTML = `${hrs}:${mins}<span>${ampm}</span>`;
}

function updateDateHeader(): void {
	if (!elements.digitalDate) return;
	const displayDate = new Date();
	displayDate.setDate(
		displayDate.getDate() + viewportDayOffset(state.viewOffsetHours),
	);
	const options: Intl.DateTimeFormatOptions = {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	};
	elements.digitalDate.textContent = displayDate
		.toLocaleDateString("en-US", options)
		.toUpperCase();
}

function updateNowTracker(now: Date): void {
	const nowMs = now.getTime();
	const [startMs, endMs] = get48HourRange();
	const duration = 48 * 3600 * 1000;

	if (nowMs >= startMs && nowMs <= endMs) {
		const xPct = ((nowMs - startMs) / duration) * 100;
		if (elements.nowMarkerLine) {
			elements.nowMarkerLine.style.display = "block";
			elements.nowMarkerLine.setAttribute("x1", String(xPct * 20));
			elements.nowMarkerLine.setAttribute("x2", String(xPct * 20));
		}
		if (elements.nowMarkerBadge) {
			elements.nowMarkerBadge.style.display = "block";
			elements.nowMarkerBadge.style.left = `${xPct}%`;
		}
		if (elements.nowMarkerDot) {
			elements.nowMarkerDot.style.display = "block";
			const currentHeight = getTideHeightAtTime(state, nowMs);
			const yPct = (getSvgYCoordinate(currentHeight) / 400) * 100;
			elements.nowMarkerDot.style.left = `${xPct}%`;
			elements.nowMarkerDot.style.top = `${yPct}%`;
		}

		const currentHeight = getTideHeightAtTime(state, nowMs);
		if (elements.currentTideVal) {
			elements.currentTideVal.textContent = `${currentHeight >= 0 ? "+" : ""}${currentHeight.toFixed(1)}`;
		}

		if (elements.currentTideSlope) {
			const isRising =
				getTideHeightAtTime(state, nowMs + 5 * 60 * 1000) > currentHeight;
			elements.currentTideSlope.textContent = isRising ? "↑" : "↓";
			elements.currentTideSlope.style.color = isRising
				? "var(--accent-color)"
				: "var(--text-muted)";
		}

		const currentSpeed = getCurrentSpeedAtTime(state, nowMs);
		if (elements.currentStatusVal) {
			if (Math.abs(currentSpeed) < 0.15) {
				elements.currentStatusVal.textContent = "SLACK";
				elements.currentStatusVal.style.color = "#64748b";
			} else {
				elements.currentStatusVal.textContent = `${Math.abs(currentSpeed).toFixed(1)} KT ${currentSpeed > 0 ? "FLOOD" : "EBB"}`;
				elements.currentStatusVal.style.color =
					currentSpeed > 0 ? "#06b6d4" : "#ec4899";
			}
		}
	} else {
		if (elements.nowMarkerLine) elements.nowMarkerLine.style.display = "none";
		if (elements.nowMarkerBadge) elements.nowMarkerBadge.style.display = "none";
		if (elements.nowMarkerDot) elements.nowMarkerDot.style.display = "none";
		if (elements.currentTideVal) elements.currentTideVal.textContent = "--";
		if (elements.currentTideSlope) elements.currentTideSlope.textContent = "";
		if (elements.currentStatusVal) {
			elements.currentStatusVal.textContent = "--";
			elements.currentStatusVal.style.color = "";
		}
	}
}
