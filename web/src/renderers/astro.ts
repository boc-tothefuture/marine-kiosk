import type { AstronomicalDay, Elements, State } from "../types";
import {
	formatIsoTime,
	getSvgAspectCorrection,
	getSvgScaleY,
	setSvgElementX,
} from "../utils";

// The sunrise/sunset and moonrise/moonset labels are HTML overlays stacked
// near the top of .tidelog-svg-wrapper (see .astro-callout in style.css and
// the topPx values in renderAstroOverlayLabels below - sun at 8px, moon at
// 34px, each block ~28px tall). The dashed vertical lines should start below
// whichever label sits above them, not from the very top of the SVG, so they
// read as pointers/leaders under the text instead of running through it.
const SUN_LINE_START_PX = 40;
const MOON_LINE_START_PX = 68;

export function getAstronomicalDataForDayOffset(
	state: State,
	offset: number,
): AstronomicalDay | null {
	const base = new Date();
	base.setDate(base.getDate() + offset);
	const dateKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
	return state.astronomical_data ? state.astronomical_data[dateKey] : null;
}

export function updateAstronomicalDetails(
	state: State,
	elements: Elements,
	dayOffset: number,
): void {
	const dayAstro = getAstronomicalDataForDayOffset(state, dayOffset);
	if (!dayAstro) return;

	if (elements.moonIndicatorIcon)
		elements.moonIndicatorIcon.textContent = dayAstro.moon_phase_symbol;
}

export function hideSunElements(elements: Elements): void {
	const sunKeys: (keyof Elements)[] = [
		"sunPath",
		"sunStrokePath",
		"sunriseLine",
		"sunsetLine",
	];
	for (const key of sunKeys) {
		const el = elements[key] as HTMLElement | SVGElement | null;
		if (el) el.style.display = "none";
	}
}

export function hideSun2Elements(elements: Elements): void {
	const sunKeys: (keyof Elements)[] = ["sunriseLine2", "sunsetLine2"];
	for (const key of sunKeys) {
		const el = elements[key] as HTMLElement | SVGElement | null;
		if (el) el.style.display = "none";
	}
}

export function renderSunBackground(
	elements: Elements,
	startMs: number,
	duration: number,
	state: State,
): void {
	const day1Astro = getAstronomicalDataForDayOffset(state, 0);
	const day2Astro = getAstronomicalDataForDayOffset(state, 1);

	const svgEl = elements.sunPath?.ownerSVGElement as SVGSVGElement | null;
	const aspectCorrection = getSvgAspectCorrection(svgEl);
	const scaleY = getSvgScaleY(svgEl);
	const sunLineStartY = SUN_LINE_START_PX / scaleY;

	let pathTodayD = "";
	let pathTomorrowD = "";
	let xRise1 = 0;
	let xSet1 = 0;
	let xRise2 = 0;
	let xSet2 = 0;

	if (day1Astro?.sunrise && day1Astro?.sunset) {
		xRise1 =
			((new Date(day1Astro.sunrise).getTime() - startMs) / duration) * 2000;
		xSet1 =
			((new Date(day1Astro.sunset).getTime() - startMs) / duration) * 2000;
		const rx1 = (xSet1 - xRise1) / 2;
		const ry1 = rx1 * aspectCorrection;
		pathTodayD = `M ${xRise1.toFixed(1)} 340 A ${rx1.toFixed(1)} ${ry1.toFixed(1)} 0 0 1 ${xSet1.toFixed(1)} 340`;
	}

	if (day2Astro?.sunrise && day2Astro?.sunset) {
		xRise2 =
			((new Date(day2Astro.sunrise).getTime() - startMs) / duration) * 2000;
		xSet2 =
			((new Date(day2Astro.sunset).getTime() - startMs) / duration) * 2000;
		const rx2 = (xSet2 - xRise2) / 2;
		const ry2 = rx2 * aspectCorrection;
		pathTomorrowD = `M ${xRise2.toFixed(1)} 340 A ${rx2.toFixed(1)} ${ry2.toFixed(1)} 0 0 1 ${xSet2.toFixed(1)} 340`;
	}

	if (elements.sunPath) {
		const combinedFill = [
			pathTodayD ? `${pathTodayD} Z` : "",
			pathTomorrowD ? `${pathTomorrowD} Z` : "",
		]
			.filter(Boolean)
			.join(" ");
		if (combinedFill) {
			elements.sunPath.setAttribute("d", combinedFill);
			elements.sunPath.style.display = "block";
		} else {
			elements.sunPath.style.display = "none";
		}
	}

	if (elements.sunStrokePath) {
		const combinedStroke = [pathTodayD, pathTomorrowD]
			.filter(Boolean)
			.join(" ");
		if (combinedStroke) {
			elements.sunStrokePath.setAttribute("d", combinedStroke);
			elements.sunStrokePath.style.display = "block";
		} else {
			elements.sunStrokePath.style.display = "none";
		}
	}

	if (day1Astro) {
		setSvgElementX(elements.sunriseLine, xRise1, true, sunLineStartY);
		setSvgElementX(elements.sunsetLine, xSet1, true, sunLineStartY);
	} else {
		hideSunElements(elements);
	}

	if (day2Astro) {
		setSvgElementX(elements.sunriseLine2, xRise2, true, sunLineStartY);
		setSvgElementX(elements.sunsetLine2, xSet2, true, sunLineStartY);
	} else {
		hideSun2Elements(elements);
	}
}

export function updateLunarMarkersDOM(
	elements: Elements,
	moonriseMs: number | null,
	moonsetMs: number | null,
	startMs: number,
	duration: number,
	moonLineStartY: number,
	isDay2 = false,
): void {
	const lineRise = isDay2 ? elements.moonriseLine2 : elements.moonriseLine;
	const lineSet = isDay2 ? elements.moonsetLine2 : elements.moonsetLine;

	const updateMarker = (ms: number | null, lineEl: SVGLineElement | null) => {
		if (ms && ms >= startMs && ms <= startMs + duration) {
			const x = ((ms - startMs) / duration) * 2000;
			setSvgElementX(lineEl, x, true, moonLineStartY);
		} else {
			if (lineEl) lineEl.style.display = "none";
		}
	};

	updateMarker(moonriseMs, lineRise);
	updateMarker(moonsetMs, lineSet);
}

export function hideLunarElements(elements: Elements): void {
	if (elements.lunarTransitPath)
		elements.lunarTransitPath.style.display = "none";
	if (elements.moonIndicatorGroup)
		elements.moonIndicatorGroup.style.display = "none";
	const moonKeys: (keyof Elements)[] = ["moonriseLine", "moonsetLine"];
	for (const key of moonKeys) {
		const el = elements[key] as HTMLElement | SVGElement | null;
		if (el) el.style.display = "none";
	}
}

export function hideLunar2Elements(elements: Elements): void {
	const moonKeys: (keyof Elements)[] = ["moonriseLine2", "moonsetLine2"];
	for (const key of moonKeys) {
		const el = elements[key] as HTMLElement | SVGElement | null;
		if (el) el.style.display = "none";
	}
}

interface LunarEvent {
	ts: number;
	type: "rise" | "set";
}

interface LunarTransit {
	riseMs: number;
	setMs: number;
}

// Gather every real moonrise/moonset the scraper has computed (it fetches
// yesterday through the day after tomorrow - see scraper.py's `range(-1, 3)`)
// so transits can be built from real data instead of guessing a partner event
// with a flat +/-12.4h offset. Estimating per-day independently is what
// previously produced two overlapping "ghost" arcs for a single real moon
// transit that straddled a day boundary.
function collectLunarEvents(state: State): LunarEvent[] {
	const events: LunarEvent[] = [];
	for (let offset = -1; offset <= 2; offset++) {
		const astro = getAstronomicalDataForDayOffset(state, offset);
		if (!astro) continue;
		if (astro.moonrise)
			events.push({ ts: new Date(astro.moonrise).getTime(), type: "rise" });
		if (astro.moonset)
			events.push({ ts: new Date(astro.moonset).getTime(), type: "set" });
	}
	events.sort((a, b) => a.ts - b.ts);
	return events;
}

// Pair each real moonrise with the next real moonset that follows it,
// regardless of which calendar day either came from - this is what makes a
// rise-after-set day (the common case, since the moon rises ~50min later
// each day) resolve to a single real transit instead of an estimated one.
function buildLunarTransits(events: LunarEvent[]): LunarTransit[] {
	const transits: LunarTransit[] = [];
	for (let i = 0; i < events.length; i++) {
		if (events[i].type !== "rise") continue;
		for (let j = i + 1; j < events.length; j++) {
			if (events[j].type === "set") {
				transits.push({ riseMs: events[i].ts, setMs: events[j].ts });
				break;
			}
		}
	}
	return transits;
}

function dateKeyFor(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function renderLunarTransit(
	state: State,
	elements: Elements,
	startMs: number,
	duration: number,
): void {
	const day1Astro = getAstronomicalDataForDayOffset(state, 0);
	const day2Astro = getAstronomicalDataForDayOffset(state, 1);

	const svgEl = elements.lunarTransitPath
		?.ownerSVGElement as SVGSVGElement | null;
	const aspectCorrection = getSvgAspectCorrection(svgEl);
	const scaleY = getSvgScaleY(svgEl);
	const moonLineStartY = MOON_LINE_START_PX / scaleY;

	if (day1Astro) {
		updateLunarMarkersDOM(
			elements,
			day1Astro.moonrise ? new Date(day1Astro.moonrise).getTime() : null,
			day1Astro.moonset ? new Date(day1Astro.moonset).getTime() : null,
			startMs,
			duration,
			moonLineStartY,
			false,
		);
	} else {
		hideLunarElements(elements);
	}

	if (day2Astro) {
		updateLunarMarkersDOM(
			elements,
			day2Astro.moonrise ? new Date(day2Astro.moonrise).getTime() : null,
			day2Astro.moonset ? new Date(day2Astro.moonset).getTime() : null,
			startMs,
			duration,
			moonLineStartY,
			true,
		);
	} else {
		hideLunar2Elements(elements);
	}

	const baselineY = 340;
	const nowMs = Date.now();

	const transits = buildLunarTransits(collectLunarEvents(state));
	let combinedPath = "";
	let showMoon = false;
	let mx = 0;
	let my = 0;

	for (const t of transits) {
		// Skip transits that don't overlap the visible 48h window at all.
		if (t.setMs < startMs || t.riseMs > startMs + duration) continue;

		const xStart = ((t.riseMs - startMs) / duration) * 2000;
		const xEnd = ((t.setMs - startMs) / duration) * 2000;
		const rx = (xEnd - xStart) / 2;
		const ry = rx * aspectCorrection;
		combinedPath += `${combinedPath ? " " : ""}M ${xStart.toFixed(1)} ${baselineY} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 1 ${xEnd.toFixed(1)} ${baselineY}`;

		if (nowMs >= t.riseMs && nowMs <= t.setMs) {
			showMoon = true;
			const angle =
				Math.PI - ((nowMs - t.riseMs) / (t.setMs - t.riseMs)) * Math.PI;
			mx = xStart + rx + rx * Math.cos(angle);
			my = baselineY - ry * Math.sin(angle);
		}
	}

	if (elements.lunarTransitPath) {
		if (combinedPath) {
			elements.lunarTransitPath.setAttribute("d", combinedPath);
			elements.lunarTransitPath.style.display = "block";
		} else {
			elements.lunarTransitPath.style.display = "none";
		}
	}

	if (elements.moonIndicatorGroup) {
		if (showMoon) {
			const nowAstro =
				state.astronomical_data?.[dateKeyFor(new Date(nowMs))] ??
				day1Astro ??
				day2Astro;
			elements.moonIndicatorGroup.style.display = "block";
			elements.moonIndicatorGroup.setAttribute(
				"transform",
				`translate(${mx.toFixed(1)}, ${my.toFixed(1)})`,
			);
			if (elements.moonIndicatorIcon && nowAstro) {
				elements.moonIndicatorIcon.textContent = nowAstro.moon_phase_symbol;
			}
		} else {
			elements.moonIndicatorGroup.style.display = "none";
		}
	}

	renderAstroOverlayLabels(elements, startMs, duration, state);
}

export function renderAstroOverlayLabels(
	elements: Elements,
	startMs: number,
	duration: number,
	state: State,
): void {
	const overlay = elements.astroOverlayLabels;
	if (!overlay) return;
	overlay.innerHTML = "";

	const addCallout = (
		timeIso: string | null,
		title: string,
		type: "sun" | "moon",
		topPx: number,
	) => {
		if (!timeIso) return;
		const ms = new Date(timeIso).getTime();
		if (ms < startMs || ms > startMs + duration) return;
		const timeStr = formatIsoTime(timeIso);
		if (!timeStr) return;
		const xPct = ((ms - startMs) / duration) * 100;

		const div = document.createElement("div");
		div.className = `astro-callout ${type}`;
		div.style.left = `${xPct}%`;
		div.style.top = `${topPx}px`;
		div.innerHTML = `
			<div class="astro-title">${title}</div>
			<div class="astro-time">${timeStr}</div>
		`;
		overlay.appendChild(div);
	};

	const day1Astro = getAstronomicalDataForDayOffset(state, 0);
	const day2Astro = getAstronomicalDataForDayOffset(state, 1);

	if (day1Astro) {
		addCallout(day1Astro.sunrise, "Sunrise", "sun", 8);
		addCallout(day1Astro.sunset, "Sunset", "sun", 8);
		addCallout(day1Astro.moonrise, "Moonrise", "moon", 34);
		addCallout(day1Astro.moonset, "Moonset", "moon", 34);
	}
	if (day2Astro) {
		addCallout(day2Astro.sunrise, "Sunrise", "sun", 8);
		addCallout(day2Astro.sunset, "Sunset", "sun", 8);
		addCallout(day2Astro.moonrise, "Moonrise", "moon", 34);
		addCallout(day2Astro.moonset, "Moonset", "moon", 34);
	}
}
