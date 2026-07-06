import type { CurrentPoint, Elements, State } from "../types";
import { getCurrentSpeedAtTime } from "../utils";

interface CurrentsEvent {
	timeMs: number;
	type: "slack" | "flood" | "ebb";
	value: number;
}

export function calculateMaxCurrentsVelocity(
	predictions: CurrentPoint[],
): number {
	let maxAbsValue = 0;
	for (const pt of predictions) {
		const absVal = Math.abs(pt.value);
		if (absVal > maxAbsValue) maxAbsValue = absVal;
	}
	return Math.max(1, Math.ceil(maxAbsValue));
}

export function renderCurrentsPaths(
	state: State,
	elements: Elements,
	startMs: number,
	duration: number,
	getVelocityY: (kt: number) => number,
): void {
	const steps = 144;
	let mainStrokeD = "";
	let floodFillD = "M 0 40";
	let ebbFillD = "M 0 40";

	for (let i = 0; i <= steps; i++) {
		const tMs = startMs + (i / steps) * duration;
		const x = (i / steps) * 1000;
		const ktVal = getCurrentSpeedAtTime(state, tMs);
		const y = getVelocityY(ktVal);

		mainStrokeD +=
			i === 0
				? `M ${x.toFixed(1)} ${y.toFixed(1)}`
				: ` L ${x.toFixed(1)} ${y.toFixed(1)}`;

		if (ktVal >= 0) {
			floodFillD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
			ebbFillD += ` L ${x.toFixed(1)} 40`;
		} else {
			floodFillD += ` L ${x.toFixed(1)} 40`;
			ebbFillD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
		}
	}

	if (elements.currentsStrokePath)
		elements.currentsStrokePath.setAttribute("d", mainStrokeD);
	if (elements.currentsFloodPath)
		elements.currentsFloodPath.setAttribute("d", `${floodFillD} L 1000 40 Z`);
	if (elements.currentsEbbPath)
		elements.currentsEbbPath.setAttribute("d", `${ebbFillD} L 1000 40 Z`);
}

export function detectCurrentsEvents(
	predictions: CurrentPoint[],
	startMs: number,
	endMs: number,
): CurrentsEvent[] {
	const events: CurrentsEvent[] = [];

	// Detect Slack Water (zero-crossings)
	for (let i = 0; i < predictions.length - 1; i++) {
		const pt0 = predictions[i];
		const pt1 = predictions[i + 1];
		if (pt0.value * pt1.value < 0) {
			const mu = (0 - pt0.value) / (pt1.value - pt0.value);
			const slackMs = pt0.timeMs + mu * (pt1.timeMs - pt0.timeMs);
			if (slackMs >= startMs && slackMs <= endMs) {
				events.push({ timeMs: slackMs, type: "slack", value: 0 });
			}
		}
	}

	// Detect Local Peaks (Max Flood/Ebb)
	for (let i = 1; i < predictions.length - 1; i++) {
		const ptPrev = predictions[i - 1];
		const ptCurr = predictions[i];
		const ptNext = predictions[i + 1];

		if (ptCurr.timeMs >= startMs && ptCurr.timeMs <= endMs) {
			if (
				ptCurr.value > ptPrev.value &&
				ptCurr.value > ptNext.value &&
				ptCurr.value > 0.3
			) {
				events.push({
					timeMs: ptCurr.timeMs,
					type: "flood",
					value: ptCurr.value,
				});
			} else if (
				ptCurr.value < ptPrev.value &&
				ptCurr.value < ptNext.value &&
				ptCurr.value < -0.3
			) {
				events.push({
					timeMs: ptCurr.timeMs,
					type: "ebb",
					value: ptCurr.value,
				});
			}
		}
	}

	return events.sort((a, b) => a.timeMs - b.timeMs);
}

export function renderCurrentsEventLabels(
	elements: Elements,
	events: CurrentsEvent[],
	startMs: number,
	duration: number,
	getVelocityY: (kt: number) => number,
): void {
	if (!elements.currentsEventsWrapper) return;

	for (const event of events) {
		const xPct = ((event.timeMs - startMs) / duration) * 100;
		if (xPct < 2.5 || xPct > 97.5) continue;

		const div = document.createElement("div");
		div.className = `currents-event ${event.type}`;
		div.style.position = "absolute";
		div.style.left = `${xPct}%`;
		div.style.transform = "translateX(-50%)";

		const timeStr = new Date(event.timeMs)
			.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
			.replace(" ", "");
		const yCoord = getVelocityY(event.value);

		if (event.type === "flood") {
			div.style.top = `${yCoord - 25}px`;
			div.innerHTML = `<span class="currents-event-val" style="color: #06b6d4; font-weight:600; display:block; font-size:0.75rem; text-align: center;">↑ ${event.value.toFixed(1)} KT</span><span class="currents-event-time" style="display:block; font-size:0.65rem; opacity:0.6; text-align: center;">${timeStr}</span>`;
		} else if (event.type === "ebb") {
			div.style.top = `${yCoord + 2}px`;
			div.innerHTML = `<span class="currents-event-val" style="color: #ec4899; font-weight:600; display:block; font-size:0.75rem; text-align: center;">↓ ${Math.abs(event.value).toFixed(1)} KT</span><span class="currents-event-time" style="display:block; font-size:0.65rem; opacity:0.6; text-align: center;">${timeStr}</span>`;
		} else {
			div.style.top = "28px";
			div.innerHTML = `<span class="currents-event-arrow" style="display:block; font-size:0.75rem; color:#64748b; font-weight:bold; text-align: center;">◇</span><span class="currents-event-time" style="display:block; font-size:0.6rem; color:#64748b; text-align: center; margin-top: 2px;">${timeStr}</span>`;
		}

		elements.currentsEventsWrapper.appendChild(div);
	}
}

export function renderCurrentsTimeline(
	state: State,
	elements: Elements,
	startMs: number,
	endMs: number,
): void {
	if (elements.currentsEventsWrapper) {
		elements.currentsEventsWrapper.innerHTML = "";
	}
	if (state.currentPredictions.length === 0) return;

	const dayPredictions = state.currentPredictions.filter(
		(pt) =>
			pt.timeMs >= startMs - 2 * 3600 * 1000 &&
			pt.timeMs <= endMs + 2 * 3600 * 1000,
	);

	if (dayPredictions.length === 0) return;

	const duration = 24 * 3600 * 1000;
	const maxKt = calculateMaxCurrentsVelocity(dayPredictions);

	const getVelocityY = (kt: number) => {
		const pct = Math.max(-1, Math.min(1, kt / maxKt));
		return 40 - pct * 35;
	};

	renderCurrentsPaths(state, elements, startMs, duration, getVelocityY);

	const events = detectCurrentsEvents(dayPredictions, startMs, endMs);
	renderCurrentsEventLabels(elements, events, startMs, duration, getVelocityY);
}
