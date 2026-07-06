import type { AstronomicalDay, Elements, State } from "../types";
import {
	formatIsoTime,
	setLabelPositionAndText,
	setSvgElementX,
} from "../utils";

export function getAstronomicalDataForSelectedDay(
	state: State,
): AstronomicalDay | null {
	const base = new Date();
	base.setDate(base.getDate() + state.selectedDayOffset);
	const dateKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
	return state.astronomical_data ? state.astronomical_data[dateKey] : null;
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

export function updateSunDOM(
	elements: Elements,
	sunFillD: string,
	sunArcOnlyD: string,
	xRise: number,
	xSet: number,
	dayAstro: AstronomicalDay,
): void {
	if (elements.sunPath) {
		elements.sunPath.setAttribute("d", sunFillD);
		elements.sunPath.style.display = "block";
	}

	if (elements.sunStrokePath) {
		elements.sunStrokePath.setAttribute("d", sunArcOnlyD);
		elements.sunStrokePath.style.display = "block";
	}

	setSvgElementX(elements.sunriseLine, xRise, true);
	setSvgElementX(elements.sunsetLine, xSet, true);
	setLabelPositionAndText(
		elements.sunriseTimeLabel,
		xRise,
		formatIsoTime(dayAstro.sunrise),
	);
	setLabelPositionAndText(
		elements.sunsetTimeLabel,
		xSet,
		formatIsoTime(dayAstro.sunset),
	);
	setLabelPositionAndText(elements.sunriseTextLabel, xRise);
	setLabelPositionAndText(elements.sunsetTextLabel, xSet);
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

export function renderSunBackground(
	elements: Elements,
	startMs: number,
	duration: number,
	dayAstro: AstronomicalDay | null,
): void {
	if (!dayAstro?.sunrise || !dayAstro.sunset) {
		hideSunElements(elements);
		return;
	}

	const xRise =
		((new Date(dayAstro.sunrise).getTime() - startMs) / duration) * 1000;
	const xSet =
		((new Date(dayAstro.sunset).getTime() - startMs) / duration) * 1000;
	const r = (xSet - xRise) / 2;

	const sunArcOnlyD = `M ${xRise.toFixed(1)} 340 A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xSet.toFixed(1)} 340`;
	updateSunDOM(
		elements,
		`${sunArcOnlyD} Z`,
		sunArcOnlyD,
		xRise,
		xSet,
		dayAstro,
	);
}

export function updateMoonIndicator(
	state: State,
	elements: Elements,
	lunarData: { showMoon: boolean; mx: number; my: number },
	dayAstro: AstronomicalDay,
): void {
	if (elements.moonIndicatorGroup) {
		if (state.selectedDayOffset === 0 && lunarData.showMoon) {
			elements.moonIndicatorGroup.style.display = "block";
			elements.moonIndicatorGroup.setAttribute(
				"transform",
				`translate(${lunarData.mx.toFixed(1)}, ${lunarData.my.toFixed(1)})`,
			);
			if (elements.moonIndicatorIcon) {
				elements.moonIndicatorIcon.textContent = dayAstro.moon_phase_symbol;
			}
		} else {
			elements.moonIndicatorGroup.style.display = "none";
		}
	}
}

export function updateLunarMarkersDOM(
	elements: Elements,
	moonriseMs: number | null,
	moonsetMs: number | null,
	startMs: number,
	duration: number,
	dayAstro: AstronomicalDay,
): void {
	const updateMarker = (
		ms: number | null,
		lineEl: SVGLineElement | null,
		textEl: SVGTextElement | null,
		timeEl: SVGTextElement | null,
		timeStr: string | null,
	) => {
		if (ms && ms >= startMs && ms <= startMs + duration) {
			const x = ((ms - startMs) / duration) * 1000;
			setSvgElementX(lineEl, x, true);
			setLabelPositionAndText(timeEl, x, formatIsoTime(timeStr));
			setLabelPositionAndText(textEl, x);
		} else {
			for (const el of [lineEl, textEl, timeEl]) {
				if (el) el.style.display = "none";
			}
		}
	};

	updateMarker(
		moonriseMs,
		elements.moonriseLine,
		elements.moonriseTextLabel,
		elements.moonriseTimeLabel,
		dayAstro.moonrise,
	);
	updateMarker(
		moonsetMs,
		elements.moonsetLine,
		elements.moonsetTextLabel,
		elements.moonsetTimeLabel,
		dayAstro.moonset,
	);
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
			const xMR = ((moonriseMs - startMs) / duration) * 1000;
			const xMS = ((moonsetMs - startMs) / duration) * 1000;
			pathD = calcArc(xMR, xMS);
			checkMoonStatus(xMR, xMS, moonriseMs, moonsetMs);
		} else {
			const yest_mr = moonsetMs - halfLunarDayMs;
			const xMR_yest = ((yest_mr - startMs) / duration) * 1000;
			const xMS = ((moonsetMs - startMs) / duration) * 1000;
			const xMR = ((moonriseMs - startMs) / duration) * 1000;
			const tom_ms = moonriseMs + halfLunarDayMs;
			const xMS_tom = ((tom_ms - startMs) / duration) * 1000;

			pathD = `${calcArc(xMR_yest, xMS)} ${calcArc(xMR, xMS_tom)}`;
			checkMoonStatus(xMR_yest, xMS, yest_mr, moonsetMs);
			checkMoonStatus(xMR, xMS_tom, moonriseMs, tom_ms);
		}
	} else if (moonsetMs) {
		const yest_mr = moonsetMs - halfLunarDayMs;
		const xMR_yest = ((yest_mr - startMs) / duration) * 1000;
		const xMS = ((moonsetMs - startMs) / duration) * 1000;
		pathD = calcArc(xMR_yest, xMS);
		checkMoonStatus(xMR_yest, xMS, yest_mr, moonsetMs);
	} else if (moonriseMs) {
		const xMR = ((moonriseMs - startMs) / duration) * 1000;
		const tom_ms = moonriseMs + halfLunarDayMs;
		const xMS_tom = ((tom_ms - startMs) / duration) * 1000;
		pathD = calcArc(xMR, xMS_tom);
		checkMoonStatus(xMR, xMS_tom, moonriseMs, tom_ms);
	} else {
		const yest_mr = startMs - duration / 4;
		const tom_ms = startMs + duration + duration / 4;
		const xMR_yest = ((yest_mr - startMs) / duration) * 1000;
		const xMS_tom = ((tom_ms - startMs) / duration) * 1000;
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
	dayAstro: AstronomicalDay | null,
): void {
	if (!dayAstro) {
		hideLunarElements(elements);
		return;
	}

	const moonriseMs = dayAstro.moonrise
		? new Date(dayAstro.moonrise).getTime()
		: null;
	const moonsetMs = dayAstro.moonset
		? new Date(dayAstro.moonset).getTime()
		: null;
	const lunarData = calculateLunarPathAndPosition(
		moonriseMs,
		moonsetMs,
		startMs,
		duration,
		Date.now(),
	);

	if (elements.lunarTransitPath) {
		elements.lunarTransitPath.setAttribute("d", lunarData.pathD);
		elements.lunarTransitPath.style.display = "block";
	}

	updateMoonIndicator(state, elements, lunarData, dayAstro);
	updateLunarMarkersDOM(
		elements,
		moonriseMs,
		moonsetMs,
		startMs,
		duration,
		dayAstro,
	);
}
