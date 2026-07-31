import type { AstronomicalDay, Elements, State } from "../types";
import { formatIsoTime, setSvgElementX } from "../utils";

export function getAstronomicalDataForDayOffset(
	state: State,
	offset: number,
): AstronomicalDay | null {
	const base = new Date();
	base.setDate(base.getDate() + offset);
	const dateKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
	return state.astronomical_data ? state.astronomical_data[dateKey] : null;
}

export function getAstronomicalDataForSelectedDay(
	state: State,
): AstronomicalDay | null {
	return getAstronomicalDataForDayOffset(state, state.selectedDayOffset);
}

export function updateAstronomicalDetails(
	state: State,
	elements: Elements,
): void {
	const dayAstro = getAstronomicalDataForSelectedDay(state);
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
	const sunKeys: (keyof Elements)[] = [
		"sunriseLine2",
		"sunsetLine2",
	];
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
		const r1 = (xSet1 - xRise1) / 2;
		pathTodayD = `M ${xRise1.toFixed(1)} 340 A ${r1.toFixed(1)} ${r1.toFixed(1)} 0 0 1 ${xSet1.toFixed(1)} 340`;
	}

	if (day2Astro?.sunrise && day2Astro?.sunset) {
		xRise2 =
			((new Date(day2Astro.sunrise).getTime() - startMs) / duration) * 2000;
		xSet2 =
			((new Date(day2Astro.sunset).getTime() - startMs) / duration) * 2000;
		const r2 = (xSet2 - xRise2) / 2;
		pathTomorrowD = `M ${xRise2.toFixed(1)} 340 A ${r2.toFixed(1)} ${r2.toFixed(1)} 0 0 1 ${xSet2.toFixed(1)} 340`;
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
		setSvgElementX(elements.sunriseLine, xRise1, true);
		setSvgElementX(elements.sunsetLine, xSet1, true);
	} else {
		hideSunElements(elements);
	}

	if (day2Astro) {
		setSvgElementX(elements.sunriseLine2, xRise2, true);
		setSvgElementX(elements.sunsetLine2, xSet2, true);
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
	isDay2 = false,
): void {
	const lineRise = isDay2 ? elements.moonriseLine2 : elements.moonriseLine;
	const lineSet = isDay2 ? elements.moonsetLine2 : elements.moonsetLine;

	const updateMarker = (
		ms: number | null,
		lineEl: SVGLineElement | null,
	) => {
		if (ms && ms >= startMs && ms <= startMs + duration) {
			const x = ((ms - startMs) / duration) * 2000;
			setSvgElementX(lineEl, x, true);
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
	const moonKeys: (keyof Elements)[] = [
		"moonriseLine",
		"moonsetLine",
	];
	for (const key of moonKeys) {
		const el = elements[key] as HTMLElement | SVGElement | null;
		if (el) el.style.display = "none";
	}
}

export function hideLunar2Elements(elements: Elements): void {
	const moonKeys: (keyof Elements)[] = [
		"moonriseLine2",
		"moonsetLine2",
	];
	for (const key of moonKeys) {
		const el = elements[key] as HTMLElement | SVGElement | null;
		if (el) el.style.display = "none";
	}
}

export function calculateLunarPathAndPosition(
	moonriseMs: number | null,
	moonsetMs: number | null,
	startMs: number,
	duration: number,
	nowMs: number,
): { pathD: string; showMoon: boolean; mx: number; my: number } {
	let pathD = "";
	let showMoon = false;
	let mx = 0;
	let my = 0;
	const halfLunarDayMs = 12.4 * 3600 * 1000;
	const baselineY = 340;

	const calcArc = (xStart: number, xEnd: number) =>
		`M ${xStart.toFixed(1)} ${baselineY} A ${((xEnd - xStart) / 2).toFixed(1)} ${((xEnd - xStart) / 2).toFixed(1)} 0 0 1 ${xEnd.toFixed(1)} ${baselineY}`;

	const checkMoonStatus = (
		startPos: number,
		endPos: number,
		startPosMs: number,
		endPosMs: number,
	) => {
		if (nowMs >= startPosMs && nowMs <= endPosMs) {
			showMoon = true;
			const r = (endPos - startPos) / 2;
			const angle =
				Math.PI - ((nowMs - startPosMs) / (endPosMs - startPosMs)) * Math.PI;
			mx = startPos + r + r * Math.cos(angle);
			my = baselineY - r * Math.sin(angle);
		}
	};

	if (moonriseMs && moonsetMs) {
		if (moonriseMs < moonsetMs) {
			const xMR = ((moonriseMs - startMs) / duration) * 2000;
			const xMS = ((moonsetMs - startMs) / duration) * 2000;
			pathD = calcArc(xMR, xMS);
			checkMoonStatus(xMR, xMS, moonriseMs, moonsetMs);
		} else {
			const yest_mr = moonsetMs - halfLunarDayMs;
			const xMR_yest = ((yest_mr - startMs) / duration) * 2000;
			const xMS = ((moonsetMs - startMs) / duration) * 2000;
			const xMR = ((moonriseMs - startMs) / duration) * 2000;
			const tom_ms = moonriseMs + halfLunarDayMs;
			const xMS_tom = ((tom_ms - startMs) / duration) * 2000;

			pathD = `${calcArc(xMR_yest, xMS)} ${calcArc(xMR, xMS_tom)}`;
			checkMoonStatus(xMR_yest, xMS, yest_mr, moonsetMs);
			checkMoonStatus(xMR, xMS_tom, moonriseMs, tom_ms);
		}
	} else if (moonsetMs) {
		const yest_mr = moonsetMs - halfLunarDayMs;
		const xMR_yest = ((yest_mr - startMs) / duration) * 2000;
		const xMS = ((moonsetMs - startMs) / duration) * 2000;
		pathD = calcArc(xMR_yest, xMS);
		checkMoonStatus(xMR_yest, xMS, yest_mr, moonsetMs);
	} else if (moonriseMs) {
		const xMR = ((moonriseMs - startMs) / duration) * 2000;
		const tom_ms = moonriseMs + halfLunarDayMs;
		const xMS_tom = ((tom_ms - startMs) / duration) * 2000;
		pathD = calcArc(xMR, xMS_tom);
		checkMoonStatus(xMR, xMS_tom, moonriseMs, tom_ms);
	} else {
		const yest_mr = startMs - duration / 4;
		const tom_ms = startMs + duration + duration / 4;
		const xMR_yest = ((yest_mr - startMs) / duration) * 2000;
		const xMS_tom = ((tom_ms - startMs) / duration) * 2000;
		pathD = calcArc(xMR_yest, xMS_tom);
		checkMoonStatus(xMR_yest, xMS_tom, yest_mr, tom_ms);
	}

	return { pathD, showMoon, mx, my };
}

export function renderLunarTransit(
	state: State,
	elements: Elements,
	startMs: number,
	duration: number,
): void {
	const day1Astro = getAstronomicalDataForDayOffset(state, 0);
	const day2Astro = getAstronomicalDataForDayOffset(state, 1);

	let path1D = "";
	let path2D = "";
	let lunarData1: { pathD: string; showMoon: boolean; mx: number; my: number } = {
		pathD: "",
		showMoon: false,
		mx: 0,
		my: 0,
	};
	let lunarData2: { pathD: string; showMoon: boolean; mx: number; my: number } = {
		pathD: "",
		showMoon: false,
		mx: 0,
		my: 0,
	};

	const nowMs = Date.now();

	if (day1Astro) {
		const moonriseMs1 = day1Astro.moonrise
			? new Date(day1Astro.moonrise).getTime()
			: null;
		const moonsetMs1 = day1Astro.moonset
			? new Date(day1Astro.moonset).getTime()
			: null;
		lunarData1 = calculateLunarPathAndPosition(
			moonriseMs1,
			moonsetMs1,
			startMs,
			duration,
			nowMs,
		);
		path1D = lunarData1.pathD;
		updateLunarMarkersDOM(
			elements,
			moonriseMs1,
			moonsetMs1,
			startMs,
			duration,
			false,
		);
	} else {
		hideLunarElements(elements);
	}

	if (day2Astro) {
		const moonriseMs2 = day2Astro.moonrise
			? new Date(day2Astro.moonrise).getTime()
			: null;
		const moonsetMs2 = day2Astro.moonset
			? new Date(day2Astro.moonset).getTime()
			: null;
		lunarData2 = calculateLunarPathAndPosition(
			moonriseMs2,
			moonsetMs2,
			startMs,
			duration,
			nowMs,
		);
		path2D = lunarData2.pathD;
		updateLunarMarkersDOM(
			elements,
			moonriseMs2,
			moonsetMs2,
			startMs,
			duration,
			true,
		);
	} else {
		hideLunar2Elements(elements);
	}

	if (elements.lunarTransitPath) {
		const combinedPath = [path1D, path2D].filter(Boolean).join(" ");
		if (combinedPath) {
			elements.lunarTransitPath.setAttribute("d", combinedPath);
			elements.lunarTransitPath.style.display = "block";
		} else {
			elements.lunarTransitPath.style.display = "none";
		}
	}

	if (elements.moonIndicatorGroup) {
		if (lunarData1.showMoon && day1Astro) {
			elements.moonIndicatorGroup.style.display = "block";
			elements.moonIndicatorGroup.setAttribute(
				"transform",
				`translate(${lunarData1.mx.toFixed(1)}, ${lunarData1.my.toFixed(1)})`,
			);
			if (elements.moonIndicatorIcon) {
				elements.moonIndicatorIcon.textContent = day1Astro.moon_phase_symbol;
			}
		} else if (lunarData2.showMoon && day2Astro) {
			elements.moonIndicatorGroup.style.display = "block";
			elements.moonIndicatorGroup.setAttribute(
				"transform",
				`translate(${lunarData2.mx.toFixed(1)}, ${lunarData2.my.toFixed(1)})`,
			);
			if (elements.moonIndicatorIcon) {
				elements.moonIndicatorIcon.textContent = day2Astro.moon_phase_symbol;
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
