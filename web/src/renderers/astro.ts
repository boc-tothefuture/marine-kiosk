import type { AstronomicalDay, Elements, State } from "../types";
import {
	formatIsoTime,
	setLabelPositionAndText,
	setSvgElementX,
} from "../utils";

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

	if (elements.sunRiseTime)
		elements.sunRiseTime.textContent = formatIsoTime(dayAstro.sunrise);
	if (elements.sunSetTime)
		elements.sunSetTime.textContent = formatIsoTime(dayAstro.sunset);

	if (dayAstro.sunrise && dayAstro.sunset && elements.daylightDuration) {
		const diffMs =
			new Date(dayAstro.sunset).getTime() -
			new Date(dayAstro.sunrise).getTime();
		elements.daylightDuration.textContent = `${Math.floor(diffMs / (3600 * 1000))}h ${Math.round((diffMs % (3600 * 1000)) / (60 * 1000))}m`;
	} else if (elements.daylightDuration) {
		elements.daylightDuration.textContent = "--";
	}

	if (elements.moonRiseTime)
		elements.moonRiseTime.textContent = formatIsoTime(dayAstro.moonrise);
	if (elements.moonSetTime)
		elements.moonSetTime.textContent = formatIsoTime(dayAstro.moonset);
	if (elements.moonPhaseName)
		elements.moonPhaseName.textContent = dayAstro.moon_phase_name.toUpperCase();
	if (elements.moonIndicatorIcon)
		elements.moonIndicatorIcon.textContent = dayAstro.moon_phase_symbol;
}

export function hideSunElements(elements: Elements): void {
	const sunKeys: (keyof Elements)[] = [
		"sunPath",
		"sunStrokePath",
		"sunriseLine",
		"sunsetLine",
		"sunriseTextLabel",
		"sunriseTimeLabel",
		"sunsetTextLabel",
		"sunsetTimeLabel",
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
		"sunriseTextLabel2",
		"sunriseTimeLabel2",
		"sunsetTextLabel2",
		"sunsetTimeLabel2",
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
		setLabelPositionAndText(
			elements.sunriseTimeLabel,
			xRise1,
			formatIsoTime(day1Astro.sunrise),
		);
		setLabelPositionAndText(
			elements.sunsetTimeLabel,
			xSet1,
			formatIsoTime(day1Astro.sunset),
		);
		setLabelPositionAndText(elements.sunriseTextLabel, xRise1);
		setLabelPositionAndText(elements.sunsetTextLabel, xSet1);
	} else {
		hideSunElements(elements);
	}

	if (day2Astro) {
		setSvgElementX(elements.sunriseLine2, xRise2, true);
		setSvgElementX(elements.sunsetLine2, xSet2, true);
		setLabelPositionAndText(
			elements.sunriseTimeLabel2,
			xRise2,
			formatIsoTime(day2Astro.sunrise),
		);
		setLabelPositionAndText(
			elements.sunsetTimeLabel2,
			xSet2,
			formatIsoTime(day2Astro.sunset),
		);
		setLabelPositionAndText(elements.sunriseTextLabel2, xRise2);
		setLabelPositionAndText(elements.sunsetTextLabel2, xSet2);
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
	dayAstro: AstronomicalDay,
	isDay2 = false,
): void {
	const lineRise = isDay2 ? elements.moonriseLine2 : elements.moonriseLine;
	const textRise = isDay2
		? elements.moonriseTextLabel2
		: elements.moonriseTextLabel;
	const timeRise = isDay2
		? elements.moonriseTimeLabel2
		: elements.moonriseTimeLabel;

	const lineSet = isDay2 ? elements.moonsetLine2 : elements.moonsetLine;
	const textSet = isDay2
		? elements.moonsetTextLabel2
		: elements.moonsetTextLabel;
	const timeSet = isDay2
		? elements.moonsetTimeLabel2
		: elements.moonsetTimeLabel;

	const updateMarker = (
		ms: number | null,
		lineEl: SVGLineElement | null,
		textEl: SVGTextElement | null,
		timeEl: SVGTextElement | null,
		timeStr: string | null,
	) => {
		if (ms && ms >= startMs && ms <= startMs + duration) {
			const x = ((ms - startMs) / duration) * 2000;
			setSvgElementX(lineEl, x, true);
			setLabelPositionAndText(timeEl, x, formatIsoTime(timeStr));
			setLabelPositionAndText(textEl, x);
		} else {
			for (const el of [lineEl, textEl, timeEl]) {
				if (el) el.style.display = "none";
			}
		}
	};

	updateMarker(moonriseMs, lineRise, textRise, timeRise, dayAstro.moonrise);
	updateMarker(moonsetMs, lineSet, textSet, timeSet, dayAstro.moonset);
}

export function hideLunarElements(elements: Elements): void {
	if (elements.lunarTransitPath)
		elements.lunarTransitPath.style.display = "none";
	if (elements.moonIndicatorGroup)
		elements.moonIndicatorGroup.style.display = "none";
	const moonKeys: (keyof Elements)[] = [
		"moonriseLine",
		"moonriseTextLabel",
		"moonriseTimeLabel",
		"moonsetLine",
		"moonsetTextLabel",
		"moonsetTimeLabel",
	];
	for (const key of moonKeys) {
		const el = elements[key] as HTMLElement | SVGElement | null;
		if (el) el.style.display = "none";
	}
}

export function hideLunar2Elements(elements: Elements): void {
	const moonKeys: (keyof Elements)[] = [
		"moonriseLine2",
		"moonriseTextLabel2",
		"moonriseTimeLabel2",
		"moonsetLine2",
		"moonsetTextLabel2",
		"moonsetTimeLabel2",
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
	let lunarData1 = { showMoon: false, mx: 0, my: 0 };
	let lunarData2 = { showMoon: false, mx: 0, my: 0 };

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
			day1Astro,
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
			day2Astro,
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
}
