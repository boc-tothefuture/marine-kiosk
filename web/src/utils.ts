import type { CurrentPoint, State, TidePoint } from "./types";

export function cosineInterpolate(y1: number, y2: number, mu: number): number {
	const mu2 = (1 - Math.cos(mu * Math.PI)) / 2;
	return y1 * (1 - mu2) + y2 * mu2;
}

export function interpolateValueAtTime(
	targetTimeMs: number,
	dataArray: (TidePoint | CurrentPoint)[],
): number {
	if (dataArray.length === 0) return 0.0;

	let lower: TidePoint | CurrentPoint | null = null;
	let upper: TidePoint | CurrentPoint | null = null;
	for (let i = 0; i < dataArray.length; i++) {
		const pt = dataArray[i];
		if (pt.timeMs <= targetTimeMs && (!lower || pt.timeMs > lower.timeMs))
			lower = pt;
		if (pt.timeMs >= targetTimeMs && (!upper || pt.timeMs < upper.timeMs))
			upper = pt;
	}

	if (!lower && !upper) return 0.0;
	if (!lower) return upper?.value;
	if (!upper) return lower.value;
	if (lower.timeMs === upper.timeMs) return lower.value;

	const mu = (targetTimeMs - lower.timeMs) / (upper.timeMs - lower.timeMs);
	return cosineInterpolate(lower.value, upper.value, mu);
}

export function getTideHeightAtTime(
	state: State,
	targetTimeMs: number,
): number {
	return interpolateValueAtTime(targetTimeMs, state.tideHeights);
}

export function getCurrentSpeedAtTime(
	state: State,
	targetTimeMs: number,
): number {
	return interpolateValueAtTime(targetTimeMs, state.currentPredictions);
}

export function getSvgYCoordinate(height: number): number {
	return 340 - ((height - -2.0) / (12.0 - -2.0)) * 260;
}

export function getTargetDayRange(state: State): [number, number] {
	const base = new Date();
	base.setDate(base.getDate() + state.selectedDayOffset);
	return [
		new Date(
			base.getFullYear(),
			base.getMonth(),
			base.getDate(),
			0,
			0,
			0,
			0,
		).getTime(),
		new Date(
			base.getFullYear(),
			base.getMonth(),
			base.getDate(),
			23,
			59,
			59,
			999,
		).getTime(),
	];
}

export function createSvgElement(
	tag: string,
	attributes: Record<string, string | number>,
	textContent: string | null = null,
): SVGElement {
	const el = document.createElementNS(
		"http://www.w3.org/2000/svg",
		tag,
	) as SVGElement;
	for (const [key, value] of Object.entries(attributes)) {
		el.setAttribute(key, String(value));
	}
	if (textContent !== null) el.textContent = textContent;
	return el;
}

export function formatIsoTime(isoString: string | undefined | null): string {
	if (!isoString) return "--:--";
	return new Date(isoString).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function setSvgElementX(
	element: SVGElement | null | undefined,
	xValue: number,
	isLine = false,
): void {
	if (!element) return;
	const fixedX = xValue.toFixed(1);
	if (isLine) {
		element.setAttribute("x1", fixedX);
		element.setAttribute("x2", fixedX);
	} else {
		element.setAttribute("x", fixedX);
	}
	element.style.display = "block";
}

export function setLabelPositionAndText(
	element: SVGElement | null | undefined,
	xValue: number,
	text: string | null = null,
): void {
	if (!element) return;
	element.setAttribute("x", xValue.toFixed(1));
	if (text !== null) element.textContent = text;
	element.style.display = "block";
}
