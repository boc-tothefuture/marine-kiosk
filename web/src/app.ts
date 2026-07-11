import { updateAstronomicalDetails } from "./renderers/astro";
import { drawTidelogGrid, renderTidelogGraph } from "./renderers/tideGraph";
import { renderForecast } from "./renderers/weather";
import type { Elements, State } from "./types";
import {
	get48HourRange,
	getCurrentSpeedAtTime,
	getSvgYCoordinate,
	getTargetDayRange,
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
	selectedDayOffset: 0,
};

const elements: Elements = {
	stationName: document.getElementById("station-name"),
	digitalTime: document.getElementById("digital-time"),
	digitalDate: document.getElementById("digital-date"),
	currentTideVal: document.getElementById("current-tide-val"),
	currentTideUnit: document.getElementById("current-tide-unit"),
	currentTideSlope: document.getElementById("current-tide-slope"),
	currentStatusVal: document.getElementById("current-status-val"),
	extremesList: document.getElementById("extremes-list"),
	forecastList: document.getElementById("forecast-list"),
	weatherTimelineBar: document.getElementById("weather-timeline-bar"),
	tidelogContent: document.getElementById("tidelog-content"),

	badgeToday: document.getElementById("badge-today"),
	badgeTomorrow: document.getElementById("badge-tomorrow"),

	sunRiseTime: document.getElementById("sun-rise-time"),
	sunSetTime: document.getElementById("sun-set-time"),
	daylightDuration: document.getElementById("daylight-duration"),
	moonRiseTime: document.getElementById("moon-rise-time"),
	moonSetTime: document.getElementById("moon-set-time"),
	moonPhaseName: document.getElementById("moon-phase-name"),

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
	moonIndicatorIcon: document.getElementById(
		"moon-indicator-icon",
	) as SVGTextElement | null,
	nowMarkerLine: document.getElementById(
		"now-marker-line",
	) as SVGLineElement | null,
	nowMarkerDot: document.getElementById("now-marker-dot"),

	sunriseLine: document.getElementById("sunrise-line") as SVGLineElement | null,
	sunsetLine: document.getElementById("sunset-line") as SVGLineElement | null,
	sunriseTextLabel: document.getElementById(
		"sunrise-text-label",
	) as SVGTextElement | null,
	sunriseTimeLabel: document.getElementById(
		"sunrise-time-label",
	) as SVGTextElement | null,
	sunsetTextLabel: document.getElementById(
		"sunset-text-label",
	) as SVGTextElement | null,
	sunsetTimeLabel: document.getElementById(
		"sunset-time-label",
	) as SVGTextElement | null,

	sunriseLine2: document.getElementById(
		"sunrise-line-2",
	) as SVGLineElement | null,
	sunsetLine2: document.getElementById(
		"sunset-line-2",
	) as SVGLineElement | null,
	sunriseTextLabel2: document.getElementById(
		"sunrise-text-label-2",
	) as SVGTextElement | null,
	sunriseTimeLabel2: document.getElementById(
		"sunrise-time-label-2",
	) as SVGTextElement | null,
	sunsetTextLabel2: document.getElementById(
		"sunset-text-label-2",
	) as SVGTextElement | null,
	sunsetTimeLabel2: document.getElementById(
		"sunset-time-label-2",
	) as SVGTextElement | null,

	moonriseLine: document.getElementById(
		"moonrise-line",
	) as SVGLineElement | null,
	moonsetLine: document.getElementById("moonset-line") as SVGLineElement | null,
	moonriseTextLabel: document.getElementById(
		"moonrise-text-label",
	) as SVGTextElement | null,
	moonriseTimeLabel: document.getElementById(
		"moonrise-time-label",
	) as SVGTextElement | null,
	moonsetTextLabel: document.getElementById(
		"moonset-text-label",
	) as SVGTextElement | null,
	moonsetTimeLabel: document.getElementById(
		"moonset-time-label",
	) as SVGTextElement | null,

	moonriseLine2: document.getElementById(
		"moonrise-line-2",
	) as SVGLineElement | null,
	moonsetLine2: document.getElementById(
		"moonset-line-2",
	) as SVGLineElement | null,
	moonriseTextLabel2: document.getElementById(
		"moonrise-text-label-2",
	) as SVGTextElement | null,
	moonriseTimeLabel2: document.getElementById(
		"moonrise-time-label-2",
	) as SVGTextElement | null,
	moonsetTextLabel2: document.getElementById(
		"moonset-text-label-2",
	) as SVGTextElement | null,
	moonsetTimeLabel2: document.getElementById(
		"moonset-time-label-2",
	) as SVGTextElement | null,

	tideOverlayLabels: document.getElementById("tide-overlay-labels"),
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
	startAutoTransitionTimer();
	loadData();
	setInterval(updateClock, 1000);
	setInterval(loadData, 10 * 60 * 1000);
});

function startAutoTransitionTimer(): void {
	const transitionDurationMs = 15000; // Transition every 15 seconds

	setInterval(() => {
		const currentOffset = state.selectedDayOffset;
		const nextOffset = currentOffset === 0 ? 1 : 0;
		const timeline = elements.scrollableTimeline;

		// Update viewed offset
		state.selectedDayOffset = nextOffset;

		// Slide the timeline container horizontally
		if (timeline) {
			if (nextOffset === 0) {
				timeline.style.transform = "translateX(0%)";
			} else {
				timeline.style.transform = "translateX(-50%)";
			}
		}

		// Update badges active class
		if (elements.badgeToday && elements.badgeTomorrow) {
			if (nextOffset === 0) {
				elements.badgeToday.classList.add("active");
				elements.badgeTomorrow.classList.remove("active");
			} else {
				elements.badgeTomorrow.classList.add("active");
				elements.badgeToday.classList.remove("active");
			}
		}

		// Update astro details and header clock/date
		updateAstronomicalDetails(state, elements);
		updateDateHeader();
	}, transitionDurationMs);
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
	state.waterTemp = data.water_temp;
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

	drawTidelogGrid(elements);
	renderExtremes();
	renderForecast(state, elements);
	updateAstronomicalDetails(state, elements);
	renderTidelogGraph(state, elements);
	updateClock();
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
	displayDate.setDate(displayDate.getDate() + state.selectedDayOffset);
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

function renderExtremes(): void {
	const extremesList = elements.extremesList;
	if (!extremesList) return;
	extremesList.innerHTML = "";
	const [startMs, endMs] = getTargetDayRange(state);

	const dayExtremes = state.tideExtremes.filter(
		(pt) => pt.timeMs >= startMs && pt.timeMs <= endMs,
	);

	if (dayExtremes.length === 0) {
		extremesList.innerHTML =
			'<div class="data-item placeholder">No extremes today</div>';
		return;
	}

	for (const pt of dayExtremes) {
		const timeStr = new Date(pt.timeMs).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
		const isHigh = pt.type === "H";

		const row = document.createElement("div");
		row.className = "data-item";
		row.innerHTML = `
			<span class="data-item-label">${isHigh ? "High" : "Low"} (${timeStr})</span>
			<span class="data-item-val" style="color: ${isHigh ? "var(--accent-color)" : "var(--text-color)"}">
				${isHigh ? "+" : ""}${pt.value.toFixed(1)} ${state.units === "english" ? "FT" : "M"}
			</span>
		`;
		extremesList.appendChild(row);
	}
}

function updateNowTracker(now: Date): void {
	const nowMs = now.getTime();
	const [startMs, endMs] = get48HourRange();
	const duration = 48 * 3600 * 1000;

	if (nowMs >= startMs && nowMs <= endMs) {
		if (elements.nowMarkerLine) {
			elements.nowMarkerLine.style.display = "block";
			const xPct = ((nowMs - startMs) / duration) * 100;
			elements.nowMarkerLine.setAttribute("x1", String(xPct * 20));
			elements.nowMarkerLine.setAttribute("x2", String(xPct * 20));
		}
		if (elements.nowMarkerDot) {
			elements.nowMarkerDot.style.display = "block";
			const xPct = ((nowMs - startMs) / duration) * 100;
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
		if (elements.nowMarkerDot) elements.nowMarkerDot.style.display = "none";
		if (elements.currentTideVal) elements.currentTideVal.textContent = "--";
		if (elements.currentTideSlope) elements.currentTideSlope.textContent = "";
		if (elements.currentStatusVal) {
			elements.currentStatusVal.textContent = "--";
			elements.currentStatusVal.style.color = "";
		}
	}
}
