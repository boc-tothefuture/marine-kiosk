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
	selectedDayOffset: number;
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
	extremesList: HTMLElement | null;
	forecastList: HTMLElement | null;
	weatherTimelineBar: HTMLElement | null;

	badgeToday: HTMLElement | null;
	badgeTomorrow: HTMLElement | null;

	sunRiseTime: HTMLElement | null;
	sunSetTime: HTMLElement | null;
	daylightDuration: HTMLElement | null;
	moonRiseTime: HTMLElement | null;
	moonSetTime: HTMLElement | null;
	moonPhaseName: HTMLElement | null;

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
	moonIndicatorIcon: SVGTextElement | null;
	nowMarkerLine: SVGLineElement | null;
	nowMarkerDot: HTMLElement | null;

	sunriseLine: SVGLineElement | null;
	sunsetLine: SVGLineElement | null;
	sunriseTextLabel: SVGTextElement | null;
	sunriseTimeLabel: SVGTextElement | null;
	sunsetTextLabel: SVGTextElement | null;
	sunsetTimeLabel: SVGTextElement | null;

	sunriseLine2: SVGLineElement | null;
	sunsetLine2: SVGLineElement | null;
	sunriseTextLabel2: SVGTextElement | null;
	sunriseTimeLabel2: SVGTextElement | null;
	sunsetTextLabel2: SVGTextElement | null;
	sunsetTimeLabel2: SVGTextElement | null;

	moonriseLine: SVGLineElement | null;
	moonsetLine: SVGLineElement | null;
	moonriseTextLabel: SVGTextElement | null;
	moonriseTimeLabel: SVGTextElement | null;
	moonsetTextLabel: SVGTextElement | null;
	moonsetTimeLabel: SVGTextElement | null;

	moonriseLine2: SVGLineElement | null;
	moonsetLine2: SVGLineElement | null;
	moonriseTextLabel2: SVGTextElement | null;
	moonriseTimeLabel2: SVGTextElement | null;
	moonsetTextLabel2: SVGTextElement | null;
	moonsetTimeLabel2: SVGTextElement | null;

	tideOverlayLabels: HTMLElement | null;
	currentsEventsWrapper: HTMLElement | null;
	tidelogContent: HTMLElement | null;
	scrollableTimeline: HTMLElement | null;

	currentsFloodPath: SVGPathElement | null;
	currentsEbbPath: SVGPathElement | null;
	currentsStrokePath: SVGPathElement | null;
}
