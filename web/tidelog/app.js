// --- State & Elements ---

const state = {
  stationId: "8418150",
  stationName: "PORTLAND HARBOR",
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

const elements = {
  stationName: document.getElementById("station-name"),
  digitalTime: document.getElementById("digital-time"),
  digitalDate: document.getElementById("digital-date"),
  currentTideVal: document.getElementById("current-tide-val"),
  currentTideUnit: document.getElementById("current-tide-unit"),
  currentTideSlope: document.getElementById("current-tide-slope"),
  currentStatusVal: document.getElementById("current-status-val"),
  extremesList: document.getElementById("extremes-list"),
  forecastList: document.getElementById("forecast-list"),

  btnToday: document.getElementById("btn-today"),
  btnTomorrow: document.getElementById("btn-tomorrow"),

  sunRiseTime: document.getElementById("sun-rise-time"),
  sunSetTime: document.getElementById("sun-set-time"),
  daylightDuration: document.getElementById("daylight-duration"),
  moonRiseTime: document.getElementById("moon-rise-time"),
  moonSetTime: document.getElementById("moon-set-time"),
  moonPhaseName: document.getElementById("moon-phase-name"),

  metaStationId: document.getElementById("meta-station-id"),
  lastUpdatedText: document.getElementById("last-updated-text"),

  tidelogGridLines: document.getElementById("tidelog-grid-lines"),
  waveStrokePath: document.getElementById("wave-stroke-path"),
  waveFillPath: document.getElementById("wave-fill-path"),
  sunPath: document.getElementById("sun-path"),
  sunStrokePath: document.getElementById("sun-stroke-path"),
  lunarTransitPath: document.getElementById("lunar-transit-path"),
  moonIndicatorGroup: document.getElementById("moon-indicator-group"),
  moonIndicatorIcon: document.getElementById("moon-indicator-icon"),
  nowMarkerLine: document.getElementById("now-marker-line"),
  nowMarkerDot: document.getElementById("now-marker-dot"),

  sunriseLine: document.getElementById("sunrise-line"),
  sunsetLine: document.getElementById("sunset-line"),
  sunriseTextLabel: document.getElementById("sunrise-text-label"),
  sunriseTimeLabel: document.getElementById("sunrise-time-label"),
  sunsetTextLabel: document.getElementById("sunset-text-label"),
  sunsetTimeLabel: document.getElementById("sunset-time-label"),

  moonriseLine: document.getElementById("moonrise-line"),
  moonsetLine: document.getElementById("moonset-line"),
  moonriseTextLabel: document.getElementById("moonrise-text-label"),
  moonriseTimeLabel: document.getElementById("moonrise-time-label"),
  moonsetTextLabel: document.getElementById("moonset-text-label"),
  moonsetTimeLabel: document.getElementById("moonset-time-label"),

  tideOverlayLabels: document.getElementById("tide-overlay-labels"),
  currentsEventsWrapper: document.getElementById("currents-events-wrapper"),

  currentsFloodPath: document.getElementById("currents-flood-path"),
  currentsEbbPath: document.getElementById("currents-ebb-path"),
  currentsStrokePath: document.getElementById("currents-stroke-path"),
};

// --- Initialization ---

window.addEventListener("DOMContentLoaded", () => {
  setupDayNavigation();
  loadData();
  setInterval(updateClock, 1000);
  setInterval(loadData, 10 * 60 * 1000);
});

function setupDayNavigation() {
  elements.btnToday.addEventListener("click", () =>
    handleDayToggle(0, elements.btnToday, elements.btnTomorrow),
  );
  elements.btnTomorrow.addEventListener("click", () =>
    handleDayToggle(1, elements.btnTomorrow, elements.btnToday),
  );
}

function handleDayToggle(offset, activeBtn, inactiveBtn) {
  if (state.selectedDayOffset !== offset) {
    state.selectedDayOffset = offset;
    activeBtn.classList.add("active");
    inactiveBtn.classList.remove("active");
    updateUI();
  }
}

// --- Data Fetching & Processing ---

async function loadData() {
  try {
    const data = await fetchTideData();
    processTideData(data);
    updateUI();
  } catch (error) {
    console.error("Failed to load live tide data for Tidelog:", error);
  }
}

async function fetchTideData() {
  const response = await fetch("/tide_data.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

function processTideData(data) {
  const parseTime = (pt) => ({ ...pt, timeMs: new Date(pt.time).getTime() });

  state.stationId = data.station_id;
  state.stationName = data.station_name.toUpperCase();
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

function updateUI() {
  elements.stationName.textContent = state.stationName;
  elements.metaStationId.textContent = state.stationId;
  elements.currentTideUnit.textContent = state.units === "english" ? "FT" : "M";

  if (state.lastUpdated) {
    const updatedDate = new Date(state.lastUpdated);
    elements.lastUpdatedText.textContent = `UPDATED: ${updatedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  drawTidelogGrid();
  renderExtremes();
  renderForecast();
  updateAstronomicalDetails();
  renderTidelogGraph();
  updateClock();
}

function updateClock() {
  const now = new Date();
  updateClockHeader(now);
  updateDateHeader();
  updateNowTracker(now);
}

function updateClockHeader(now) {
  let hrs = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, "0");
  const ampm = hrs >= 12 ? "PM" : "AM";
  hrs = hrs % 12 || 12;
  elements.digitalTime.innerHTML = `${hrs}:${mins}<span>${ampm}</span>`;
}

function updateDateHeader() {
  const displayDate = new Date();
  displayDate.setDate(displayDate.getDate() + state.selectedDayOffset);
  const options = {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  elements.digitalDate.textContent = displayDate
    .toLocaleDateString("en-US", options)
    .toUpperCase();
}

function renderTidelogGraph() {
  const [startMs, endMs] = getTargetDayRange();
  const duration = 24 * 3600 * 1000;
  const dayAstro = getAstronomicalDataForSelectedDay();

  renderSunBackground(startMs, duration, dayAstro);
  renderLunarTransit(startMs, duration, dayAstro);
  renderTideWave(startMs, duration);
  renderTideOverlayLabels(startMs, endMs);
  renderCurrentsTimeline(startMs, endMs);
}

// --- Grid & Sidebars ---

function drawTidelogGrid() {
  elements.tidelogGridLines.innerHTML = "";

  for (let h = 0; h <= 24; h += 2) {
    const x = (h / 24) * 1000;
    const isMajor = h === 12 || h === 0 || h === 24;

    const line = createSvgElement("line", {
      x1: x,
      y1: 0,
      x2: x,
      y2: 400,
      class: isMajor ? "tidelog-grid-line major" : "tidelog-grid-line",
    });

    const label =
      h === 0 || h === 24
        ? "12 AM"
        : h === 12
          ? "NOON"
          : h < 12
            ? `${h} AM`
            : `${h - 12} PM`;
    const txt = createSvgElement(
      "text",
      {
        x: x,
        y: 385,
        class: isMajor ? "grid-time-label major" : "grid-time-label",
      },
      label,
    );

    elements.tidelogGridLines.appendChild(line);
    elements.tidelogGridLines.appendChild(txt);
  }
}

function renderExtremes() {
  if (!elements.extremesList) return;
  elements.extremesList.innerHTML = "";
  const [startMs, endMs] = getTargetDayRange();

  const dayExtremes = state.tideExtremes.filter(
    (pt) => pt.timeMs >= startMs && pt.timeMs <= endMs,
  );

  if (dayExtremes.length === 0) {
    elements.extremesList.innerHTML =
      '<div class="data-item placeholder">No extremes today</div>';
    return;
  }

  dayExtremes.forEach((pt) => {
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
    elements.extremesList.appendChild(row);
  });
}

function renderForecast() {
  if (!elements.forecastList) return;
  elements.forecastList.innerHTML = "";

  if (state.marineForecast.length === 0) {
    elements.forecastList.innerHTML =
      '<div class="data-item placeholder">No forecast available</div>';
    return;
  }

  state.marineForecast.slice(0, 3).forEach((period) => {
    const div = document.createElement("div");
    div.style.marginBottom = "10px";
    div.innerHTML = `<strong style="color: var(--accent-color); font-size: 0.8rem; letter-spacing: 0.5px; text-transform: uppercase;">${period.name}</strong><br/>${period.text}`;
    elements.forecastList.appendChild(div);
  });
}

// --- Live Trackers ---

function updateNowTracker(now) {
  const nowMs = now.getTime();
  const [startMs, endMs] = getTargetDayRange();
  const duration = 24 * 3600 * 1000;

  if (state.selectedDayOffset === 0 && nowMs >= startMs && nowMs <= endMs) {
    elements.nowMarkerLine.style.display = "block";
    elements.nowMarkerDot.style.display = "block";

    const xPct = ((nowMs - startMs) / duration) * 100;
    elements.nowMarkerLine.setAttribute("x1", xPct * 10);
    elements.nowMarkerLine.setAttribute("x2", xPct * 10);

    const currentHeight = getTideHeightAtTime(nowMs);
    const yPct = (getSvgYCoordinate(currentHeight) / 400) * 100;

    elements.nowMarkerDot.style.left = `${xPct}%`;
    elements.nowMarkerDot.style.top = `${yPct}%`;

    elements.currentTideVal.textContent = `${currentHeight >= 0 ? "+" : ""}${currentHeight.toFixed(1)}`;

    const isRising = getTideHeightAtTime(nowMs + 5 * 60 * 1000) > currentHeight;
    elements.currentTideSlope.textContent = isRising ? "↑" : "↓";
    elements.currentTideSlope.style.color = isRising
      ? "var(--accent-color)"
      : "var(--text-muted)";

    const currentSpeed = getCurrentSpeedAtTime(nowMs);
    if (Math.abs(currentSpeed) < 0.15) {
      elements.currentStatusVal.textContent = "SLACK";
      // Match Slack legend color
      elements.currentStatusVal.style.color = "#64748b";
    } else {
      elements.currentStatusVal.textContent = `${Math.abs(currentSpeed).toFixed(1)} KT ${currentSpeed > 0 ? "FLOOD" : "EBB"}`;
      // Cyan for Flood, Pink for Ebb to match the legend
      elements.currentStatusVal.style.color = currentSpeed > 0 ? "#06b6d4" : "#ec4899";
    }
  } else {
    elements.nowMarkerLine.style.display = "none";
    elements.nowMarkerDot.style.display = "none";
    elements.currentTideVal.textContent = "--";
    elements.currentTideSlope.textContent = "";

    // Reset text and color when out of range
    elements.currentStatusVal.textContent = "--";
    elements.currentStatusVal.style.color = "";
  }
}


function renderTideOverlayLabels(startMs, endMs) {
  elements.tideOverlayLabels.innerHTML = "";

  const dayExtremes = state.tideExtremes.filter(
    (pt) => pt.timeMs >= startMs && pt.timeMs <= endMs,
  );

  dayExtremes.forEach((pt) => {
    const xPct = ((pt.timeMs - startMs) / (24 * 3600 * 1000)) * 100;
    const yPct = (getSvgYCoordinate(pt.value) / 400) * 100;
    const isHigh = pt.type === "H";

    const div = document.createElement("div");
    div.className = `tide-callout ${isHigh ? "high" : "low"}`;
    div.style.left = `${xPct}%`;
    div.style.top = `calc(${yPct}% + ${isHigh ? -22 : 22}px)`;

    const timeStr = new Date(pt.timeMs).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    div.innerHTML = `
			<div class="tide-callout-text">${isHigh ? "+" : ""}${pt.value.toFixed(1)} FT</div>
			<div class="tide-callout-sub">${timeStr}</div>
		`;
    elements.tideOverlayLabels.appendChild(div);
  });
}

// --- Currents Rendering ---

function renderCurrentsTimeline(startMs, endMs) {
  elements.currentsEventsWrapper.innerHTML = "";
  if (state.currentPredictions.length === 0) return;

  const dayPredictions = state.currentPredictions.filter(
    (pt) =>
      pt.timeMs >= startMs - 2 * 3600 * 1000 &&
      pt.timeMs <= endMs + 2 * 3600 * 1000,
  );

  if (dayPredictions.length === 0) return;

  const duration = 24 * 3600 * 1000;
  const maxKt = calculateMaxCurrentsVelocity(dayPredictions);

  const getVelocityY = (kt) => {
    const pct = Math.max(-1, Math.min(1, kt / maxKt));
    return 40 - pct * 35;
  };

  renderCurrentsPaths(startMs, duration, getVelocityY);

  const events = detectCurrentsEvents(dayPredictions, startMs, endMs);
  renderCurrentsEventLabels(events, startMs, duration, getVelocityY);
}

function calculateMaxCurrentsVelocity(predictions) {
  let maxAbsValue = 0;
  predictions.forEach((pt) => {
    const absVal = Math.abs(pt.value);
    if (absVal > maxAbsValue) maxAbsValue = absVal;
  });
  return Math.max(1, Math.ceil(maxAbsValue));
}

function renderCurrentsPaths(startMs, duration, getVelocityY) {
  const steps = 144;
  let mainStrokeD = "";
  let floodFillD = "M 0 40";
  let ebbFillD = "M 0 40";

  for (let i = 0; i <= steps; i++) {
    const tMs = startMs + (i / steps) * duration;
    const x = (i / steps) * 1000;
    const ktVal = getCurrentSpeedAtTime(tMs);
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
    elements.currentsFloodPath.setAttribute("d", floodFillD + " L 1000 40 Z");
  if (elements.currentsEbbPath)
    elements.currentsEbbPath.setAttribute("d", ebbFillD + " L 1000 40 Z");
}

function detectCurrentsEvents(predictions, startMs, endMs) {
  const events = [];

  // Detect Slack Water (zero-crossings)
  for (let i = 0; i < predictions.length - 1; i++) {
    const pt0 = predictions[i],
      pt1 = predictions[i + 1];
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
    const ptPrev = predictions[i - 1],
      ptCurr = predictions[i],
      ptNext = predictions[i + 1];

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

function renderCurrentsEventLabels(events, startMs, duration, getVelocityY) {
  events.forEach((event) => {
    const xPct = ((event.timeMs - startMs) / duration) * 100;
    if (xPct < 2.5 || xPct > 97.5) return;

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
  });
}

// --- Astronomical & Sun/Moon Rendering ---

function updateAstronomicalDetails() {
  const dayAstro = getAstronomicalDataForSelectedDay();
  if (!dayAstro) return;

  if (elements.sunRiseTime)
    elements.sunRiseTime.textContent = formatIsoTime(dayAstro.sunrise);
  if (elements.sunSetTime)
    elements.sunSetTime.textContent = formatIsoTime(dayAstro.sunset);

  if (dayAstro.sunrise && dayAstro.sunset && elements.daylightDuration) {
    const diffMs = new Date(dayAstro.sunset) - new Date(dayAstro.sunrise);
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

function getAstronomicalDataForSelectedDay() {
  const base = new Date();
  base.setDate(base.getDate() + state.selectedDayOffset);
  const dateKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
  return state.astronomical_data ? state.astronomical_data[dateKey] : null;
}

function renderSunBackground(startMs, duration, dayAstro) {
  if (!dayAstro || !dayAstro.sunrise || !dayAstro.sunset)
    return hideSunElements();

  const xRise =
    ((new Date(dayAstro.sunrise).getTime() - startMs) / duration) * 1000;
  const xSet =
    ((new Date(dayAstro.sunset).getTime() - startMs) / duration) * 1000;
  const r = (xSet - xRise) / 2;

  const sunArcOnlyD = `M ${xRise.toFixed(1)} 340 A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xSet.toFixed(1)} 340`;
  updateSunDOM(`${sunArcOnlyD} Z`, sunArcOnlyD, xRise, xSet, dayAstro);
}

function updateSunDOM(sunFillD, sunArcOnlyD, xRise, xSet, dayAstro) {
  elements.sunPath.setAttribute("d", sunFillD);
  elements.sunPath.style.display = "block";

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

function hideSunElements() {
  [
    "sunPath",
    "sunStrokePath",
    "sunriseLine",
    "sunsetLine",
    "sunriseTextLabel",
    "sunriseTimeLabel",
    "sunsetTextLabel",
    "sunsetTimeLabel",
  ].forEach((el) => {
    if (elements[el]) elements[el].style.display = "none";
  });
}

function renderLunarTransit(startMs, duration, dayAstro) {
  if (!dayAstro) return hideLunarElements();

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
    new Date().getTime(),
  );

  elements.lunarTransitPath.setAttribute("d", lunarData.pathD);
  elements.lunarTransitPath.style.display = "block";

  updateMoonIndicator(lunarData, dayAstro);
  updateLunarMarkersDOM(moonriseMs, moonsetMs, startMs, duration, dayAstro);
}

function updateLunarMarkersDOM(
  moonriseMs,
  moonsetMs,
  startMs,
  duration,
  dayAstro,
) {
  const updateMarker = (ms, lineEl, textEl, timeEl, timeStr) => {
    if (ms && ms >= startMs && ms <= startMs + duration) {
      const x = ((ms - startMs) / duration) * 1000;
      setSvgElementX(lineEl, x, true);
      setLabelPositionAndText(timeEl, x, formatIsoTime(timeStr));
      setLabelPositionAndText(textEl, x);
    } else {
      [lineEl, textEl, timeEl].forEach((el) => {
        if (el) el.style.display = "none";
      });
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

function hideLunarElements() {
  elements.lunarTransitPath.style.display = "none";
  elements.moonIndicatorGroup.style.display = "none";
  [
    "moonriseLine",
    "moonriseTextLabel",
    "moonriseTimeLabel",
    "moonsetLine",
    "moonsetTextLabel",
    "moonsetTimeLabel",
  ].forEach((el) => {
    if (elements[el]) elements[el].style.display = "none";
  });
}

function calculateLunarPathAndPosition(
  moonriseMs,
  moonsetMs,
  startMs,
  duration,
  nowMs,
) {
  let pathD = "",
    showMoon = false,
    mx = 0,
    my = 0;
  const halfLunarDayMs = 12.4 * 3600 * 1000;
  const baselineY = 340;

  const calcArc = (xStart, xEnd) =>
    `M ${xStart.toFixed(1)} ${baselineY} A ${((xEnd - xStart) / 2).toFixed(1)} ${((xEnd - xStart) / 2).toFixed(1)} 0 0 1 ${xEnd.toFixed(1)} ${baselineY}`;

  const checkMoonStatus = (startPos, endPos, startPosMs, endPosMs) => {
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

      pathD = calcArc(xMR_yest, xMS) + " " + calcArc(xMR, xMS_tom);
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

function updateMoonIndicator(lunarData, dayAstro) {
  if (state.selectedDayOffset === 0 && lunarData.showMoon) {
    elements.moonIndicatorGroup.style.display = "block";
    elements.moonIndicatorGroup.setAttribute(
      "transform",
      `translate(${lunarData.mx.toFixed(1)}, ${lunarData.my.toFixed(1)})`,
    );
    elements.moonIndicatorIcon.textContent = dayAstro.moon_phase_symbol;
  } else {
    elements.moonIndicatorGroup.style.display = "none";
  }
}

// --- Tide Wave ---

function renderTideWave(startMs, duration) {
  let wavePathD = "";
  const steps = 144;

  for (let i = 0; i <= steps; i++) {
    const tMs = startMs + (i / steps) * duration;
    const x = (i / steps) * 1000;
    const y = getSvgYCoordinate(getTideHeightAtTime(tMs));
    wavePathD +=
      i === 0
        ? `M ${x.toFixed(1)} ${y.toFixed(1)}`
        : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  elements.waveStrokePath.setAttribute("d", wavePathD);
  elements.waveFillPath.setAttribute("d", wavePathD + " L 1000 340 L 0 340 Z");
}

// --- Math & Interpolation Helpers ---

function cosineInterpolate(y1, y2, mu) {
  const mu2 = (1 - Math.cos(mu * Math.PI)) / 2;
  return y1 * (1 - mu2) + y2 * mu2;
}

function interpolateValueAtTime(targetTimeMs, dataArray) {
  if (dataArray.length === 0) return 0.0;

  let lower = null,
    upper = null;
  for (let i = 0; i < dataArray.length; i++) {
    const pt = dataArray[i];
    if (pt.timeMs <= targetTimeMs && (!lower || pt.timeMs > lower.timeMs))
      lower = pt;
    if (pt.timeMs >= targetTimeMs && (!upper || pt.timeMs < upper.timeMs))
      upper = pt;
  }

  if (!lower && !upper) return 0.0;
  if (!lower) return upper.value;
  if (!upper) return lower.value;
  if (lower.timeMs === upper.timeMs) return lower.value;

  const mu = (targetTimeMs - lower.timeMs) / (upper.timeMs - lower.timeMs);
  return cosineInterpolate(lower.value, upper.value, mu);
}

function getTideHeightAtTime(targetTimeMs) {
  return interpolateValueAtTime(targetTimeMs, state.tideHeights);
}

function getCurrentSpeedAtTime(targetTimeMs) {
  return interpolateValueAtTime(targetTimeMs, state.currentPredictions);
}

function getSvgYCoordinate(height) {
  return 340 - ((height - -2.0) / (12.0 - -2.0)) * 260;
}

function getTargetDayRange() {
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

// --- DOM / SVG Helpers ---

function createSvgElement(tag, attributes, textContent = null) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes)) {
    el.setAttribute(key, value);
  }
  if (textContent) el.textContent = textContent;
  return el;
}

function formatIsoTime(isoString) {
  if (!isoString) return "--:--";
  return new Date(isoString).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setSvgElementX(element, xValue, isLine = false) {
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

function setLabelPositionAndText(element, xValue, text = null) {
  if (!element) return;
  element.setAttribute("x", xValue.toFixed(1));
  if (text !== null) element.textContent = text;
  element.style.display = "block";
}
