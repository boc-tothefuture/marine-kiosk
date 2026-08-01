export interface TidePoint {
	time: string;
	value: number;
	timeMs: number;
}

export interface TideExtreme extends TidePoint {
	type: "H" | "L";
}

export interface CurrentPoint {
	time: string;
	value: number;
	timeMs: number;
}

export interface MarinePeriod {
	name: string;
	text: string;
}

export interface AstronomicalDay {
	sunrise: string;
	sunset: string;
	moonrise: string;
	moonset: string;
	moon_phase_name: string;
	moon_phase_symbol: string;
}

export interface ParsedWind {
	dir: string;
	speed: string;
	gusts: number | null;
}

export interface State {
	stationId: string;
	stationName: string;
	currentsStationId: string;
	dateStr: string;
	tideHeights: TidePoint[];
	tideExtremes: TideExtreme[];
	currentPredictions: CurrentPoint[];
	units: string;
	datum: string;
	waterTemp: number | null;
	marineForecast: MarinePeriod[];
	connectionOnline: boolean;
	// Hours (0-24) into the 48h graph where the visible viewport currently
	// starts. 0 = viewport shows today (hours 0-24), 24 = viewport shows
	// tomorrow (hours 24-48). Values in between are mid-scroll, spanning
	// midnight - see viewportDayOffset() in app.ts for how that's resolved
	// to a single calendar day for header/astro purposes.
	viewOffsetHours: number;
	astronomical_data?: Record<string, AstronomicalDay>;
	lastUpdated?: string;
}

export interface Elements {
	stationName: HTMLElement | null;
	digitalTime: HTMLElement | null;
	digitalDate: HTMLElement | null;
	currentTideVal: HTMLElement | null;
	currentTideUnit: HTMLElement | null;
	currentTideSlope: HTMLElement | null;
	currentStatusVal: HTMLElement | null;
	weatherTimelineBar: HTMLElement | null;

	waterTempVal: HTMLElement | null;

	badgeToday: HTMLElement | null;
	badgeTomorrow: HTMLElement | null;

	metaStationId: HTMLElement | null;
	metaCurrentsStationId: HTMLElement | null;
	lastUpdatedText: HTMLElement | null;

	tidelogGridLines: SVGElement | null;
	waveStrokePath: SVGPathElement | null;
	waveFillPath: SVGPathElement | null;
	sunPath: SVGPathElement | null;
	sunStrokePath: SVGPathElement | null;
	lunarTransitPath: SVGPathElement | null;
	moonIndicatorGroup: SVGElement | null;
	moonIndicatorCircle: SVGEllipseElement | null;
	moonIndicatorIcon: SVGTextElement | null;
	nowMarkerLine: SVGLineElement | null;
	nowMarkerDot: HTMLElement | null;
	nowMarkerBadge: HTMLElement | null;

	sunriseLine: SVGLineElement | null;
	sunsetLine: SVGLineElement | null;
	sunriseLine2: SVGLineElement | null;
	sunsetLine2: SVGLineElement | null;

	moonriseLine: SVGLineElement | null;
	moonsetLine: SVGLineElement | null;
	moonriseLine2: SVGLineElement | null;
	moonsetLine2: SVGLineElement | null;

	tideOverlayLabels: HTMLElement | null;
	astroOverlayLabels: HTMLElement | null;
	gridOverlayLabels: HTMLElement | null;
	currentsEventsWrapper: HTMLElement | null;
	tidelogContent: HTMLElement | null;
	scrollableTimeline: HTMLElement | null;

	currentsFloodPath: SVGPathElement | null;
	currentsEbbPath: SVGPathElement | null;
	currentsStrokePath: SVGPathElement | null;
}
