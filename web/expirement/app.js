// Experimental 24-Hour Tidelog Dashboard
const state = {
  stationId: '8418150',
  stationName: 'PORTLAND HARBOR',
  dateStr: '',
  tideHeights: [],
  tideExtremes: [],
  currentPredictions: [],
  units: 'english',
  datum: 'MLLW',
  waterTemp: null,
  marineForecast: [],
  connectionOnline: true,

  // Day Navigation Offset (0 = Today, 1 = Tomorrow)
  selectedDayOffset: 0
};

const elements = {
  stationName: document.getElementById('station-name'),
  digitalTime: document.getElementById('digital-time'),
  digitalDate: document.getElementById('digital-date'),
  currentTideVal: document.getElementById('current-tide-val'),
  currentTideUnit: document.getElementById('current-tide-unit'),
  currentTideSlope: document.getElementById('current-tide-slope'),
  currentStatusVal: document.getElementById('current-status-val'),
  extremesList: document.getElementById('extremes-list'),
  forecastList: document.getElementById('forecast-list'),

  btnToday: document.getElementById('btn-today'),
  btnTomorrow: document.getElementById('btn-tomorrow'),

  sunRiseTime: document.getElementById('sun-rise-time'),
  sunSetTime: document.getElementById('sun-set-time'),
  daylightDuration: document.getElementById('daylight-duration'),
  moonRiseTime: document.getElementById('moon-rise-time'),
  moonSetTime: document.getElementById('moon-set-time'),
  moonPhaseName: document.getElementById('moon-phase-name'),

  metaStationId: document.getElementById('meta-station-id'),
  lastUpdatedText: document.getElementById('last-updated-text'),

  // SVG Canvas elements
  tidelogGridLines: document.getElementById('tidelog-grid-lines'),
  waveStrokePath: document.getElementById('wave-stroke-path'),
  waveFillPath: document.getElementById('wave-fill-path'),
  sunPath: document.getElementById('sun-path'),
  sunStrokePath: document.getElementById('sun-stroke-path'),
  lunarTransitPath: document.getElementById('lunar-transit-path'),
  moonIndicatorGroup: document.getElementById('moon-indicator-group'),
  moonIndicatorIcon: document.getElementById('moon-indicator-icon'),
  nowMarkerLine: document.getElementById('now-marker-line'),
  nowMarkerDot: document.getElementById('now-marker-dot'),
  sunriseLine: document.getElementById('sunrise-line'),
  sunsetLine: document.getElementById('sunset-line'),
  sunriseTextLabel: document.getElementById('sunrise-text-label'),
  sunriseTimeLabel: document.getElementById('sunrise-time-label'),
  sunsetTextLabel: document.getElementById('sunset-text-label'),
  sunsetTimeLabel: document.getElementById('sunset-time-label'),


  moonriseLine: document.getElementById('moonrise-line'),
  moonsetLine: document.getElementById('moonset-line'),
  moonriseTextLabel: document.getElementById('moonrise-text-label'),
  moonriseTimeLabel: document.getElementById('moonrise-time-label'),
  moonsetTextLabel: document.getElementById('moonset-text-label'),
  moonsetTimeLabel: document.getElementById('moonset-time-label'),


  tideOverlayLabels: document.getElementById('tide-overlay-labels'),
  currentsEventsWrapper: document.getElementById('currents-events-wrapper'),

  currentsFloodPath: document.getElementById('currents-flood-path'),
  currentsEbbPath: document.getElementById('currents-ebb-path'),
  currentsStrokePath: document.getElementById('currents-stroke-path')
};

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
  setupDayNavigation();
  loadData();

  // Update clock and NOW marker line position
  setInterval(updateClock, 1000);
  // Refetch data every 10 minutes
  setInterval(loadData, 10 * 60 * 1000);
});

// Setup Day Navigation Toggles
function setupDayNavigation() {
  elements.btnToday.addEventListener('click', () => {
    if (state.selectedDayOffset !== 0) {
      state.selectedDayOffset = 0;
      elements.btnToday.classList.add('active');
      elements.btnTomorrow.classList.remove('active');
      updateUI();
    }
  });

  elements.btnTomorrow.addEventListener('click', () => {
    if (state.selectedDayOffset !== 1) {
      state.selectedDayOffset = 1;
      elements.btnTomorrow.classList.add('active');
      elements.btnToday.classList.remove('active');
      updateUI();
    }
  });
}

// Calculate the active target calendar day range (start and end timestamps)
function getTargetDayRange() {
  const base = new Date();
  base.setDate(base.getDate() + state.selectedDayOffset);

  const startOfDay = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);

  return [startOfDay.getTime(), endOfDay.getTime()];
}

// Load predictions and forecast data
async function loadData() {
  try {
    const response = await fetch('/tide_data.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    state.stationId = data.station_id;
    state.stationName = data.station_name.toUpperCase();
    state.dateStr = data.date;
    state.tideHeights = data.tide_heights.map(pt => ({
      ...pt,
      timeMs: new Date(pt.time).getTime()
    }));
    state.tideExtremes = (data.tide_extremes || []).map(pt => ({
      ...pt,
      timeMs: new Date(pt.time).getTime()
    }));
    state.currentPredictions = (data.current_predictions || []).map(pt => ({
      ...pt,
      timeMs: new Date(pt.time).getTime()
    }));
    state.units = data.units || 'english';
    state.datum = data.datum || 'MLLW';
    state.waterTemp = data.water_temp;
    state.marineForecast = data.marine_forecast || [];
    state.astronomical_data = data.astronomical_data || {};
    state.lastUpdated = data.last_updated;

    updateUI();
  } catch (error) {
    console.error('Failed to load live tide data for Tidelog:', error);
  }
}

// Update clock and position sweeps
function updateClock() {
  const now = new Date();

  // Format Header Clock
  let hrs = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12;
  hrs = hrs ? hrs : 12;
  elements.digitalTime.innerHTML = `${hrs}:${mins}<span>${ampm}</span>`;

  // Calculate relative selected date to display in the header
  const displayDate = new Date();
  displayDate.setDate(displayDate.getDate() + state.selectedDayOffset);
  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  elements.digitalDate.textContent = displayDate.toLocaleDateString('en-US', options).toUpperCase();

  // Update live now vertical tracker lines
  updateNowTracker(now);
}

// Draw the fixed 24-hour horizontal grid axis
function drawTidelogGrid() {
  elements.tidelogGridLines.innerHTML = '';

  // Draw vertical grid hour markers (every 2 hours)
  for (let h = 0; h <= 24; h += 2) {
    const x = (h / 24) * 1000;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', x);
    line.setAttribute('y2', 400);
    line.setAttribute('class', h === 12 || h === 0 || h === 24 ? 'tidelog-grid-line major' : 'tidelog-grid-line');
    elements.tidelogGridLines.appendChild(line);

    // Label hours (e.g. 12 AM, 4 AM, 8 AM, NOON, 4 PM, 8 PM, 12 AM)
    let label = '';
    if (h === 0 || h === 24) label = '12 AM';
    else if (h === 12) label = 'NOON';
    else if (h < 12) label = `${h} AM`;
    else label = `${h - 12} PM`;

    // Draw label
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', x);
    txt.setAttribute('y', 385);
    txt.setAttribute('class', h === 12 || h === 0 || h === 24 ? 'grid-time-label major' : 'grid-time-label');
    txt.textContent = label;
    elements.tidelogGridLines.appendChild(txt);
  }
}

// Update UI
function updateUI() {
  elements.stationName.textContent = state.stationName;
  elements.metaStationId.textContent = state.stationId;
  elements.currentTideUnit.textContent = state.units === 'english' ? 'FT' : 'M';

  if (state.lastUpdated) {
    const updatedDate = new Date(state.lastUpdated);
    elements.lastUpdatedText.textContent = `UPDATED: ${updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  drawTidelogGrid();
  renderExtremes();
  renderForecast();

  // Calculate and display Sun & Moon details
  updateAstronomicalDetails();

  // Render main tide graph and timeline
  renderTidelogGraph();

  updateClock();
}

// Render Left Sidebar Extremes
function renderExtremes() {
  if (!elements.extremesList) return;
  elements.extremesList.innerHTML = '';
  const [startMs, endMs] = getTargetDayRange();

  const dayExtremes = state.tideExtremes.filter(pt => pt.timeMs >= startMs && pt.timeMs <= endMs);

  if (dayExtremes.length === 0) {
    elements.extremesList.innerHTML = '<div class="data-item placeholder">No extremes today</div>';
    return;
  }

  dayExtremes.forEach(pt => {
    const row = document.createElement('div');
    row.className = 'data-item';

    const timeStr = new Date(pt.timeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const label = pt.type === 'H' ? `High (${timeStr})` : `Low (${timeStr})`;
    const sign = pt.type === 'H' ? '+' : '';

    row.innerHTML = `
      <span class="data-item-label">${label}</span>
      <span class="data-item-val" style="color: ${pt.type === 'H' ? 'var(--accent-color)' : 'var(--text-color)'}">${sign}${pt.value.toFixed(1)} ${state.units === 'english' ? 'FT' : 'M'}</span>
    `;
    elements.extremesList.appendChild(row);
  });
}

// Render Left Sidebar Marine Forecast
function renderForecast() {
  if (!elements.forecastList) return;
  elements.forecastList.innerHTML = '';
  if (state.marineForecast.length === 0) {
    elements.forecastList.innerHTML = '<div class="data-item placeholder">No forecast available</div>';
    return;
  }

  state.marineForecast.slice(0, 3).forEach(period => {
    const div = document.createElement('div');
    div.style.marginBottom = '10px';
    div.innerHTML = `<strong style="color: var(--accent-color); font-size: 0.8rem; letter-spacing: 0.5px; text-transform: uppercase;">${period.name}</strong><br/>${period.text}`;
    elements.forecastList.appendChild(div);
  });
}

// Helper to format ISO time string into local hh:mm AM/PM
function formatIsoTime(isoString) {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Sun & Moon Astronomical calculations
function updateAstronomicalDetails() {
  if (!state.astronomical_data) return;

  const base = new Date();
  base.setDate(base.getDate() + state.selectedDayOffset);
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  const dayAstro = state.astronomical_data[dateKey];
  if (!dayAstro) return;

  if (elements.sunRiseTime) elements.sunRiseTime.textContent = formatIsoTime(dayAstro.sunrise);
  if (elements.sunSetTime) elements.sunSetTime.textContent = formatIsoTime(dayAstro.sunset);

  if (dayAstro.sunrise && dayAstro.sunset && elements.daylightDuration) {
    const rise = new Date(dayAstro.sunrise);
    const set = new Date(dayAstro.sunset);
    const diffMs = set - rise;
    const hrs = Math.floor(diffMs / (3600 * 1000));
    const mins = Math.round((diffMs % (3600 * 1000)) / (60 * 1000));
    elements.daylightDuration.textContent = `${hrs}h ${mins}m`;
  } else if (elements.daylightDuration) {
    elements.daylightDuration.textContent = '--';
  }

  if (elements.moonRiseTime) elements.moonRiseTime.textContent = formatIsoTime(dayAstro.moonrise);
  if (elements.moonSetTime) elements.moonSetTime.textContent = formatIsoTime(dayAstro.moonset);

  if (elements.moonPhaseName) elements.moonPhaseName.textContent = dayAstro.moon_phase_name.toUpperCase();
  if (elements.moonIndicatorIcon) elements.moonIndicatorIcon.textContent = dayAstro.moon_phase_symbol;
}

// Dynamic tide heights interpolations
function cosineInterpolate(y1, y2, mu) {
  const mu2 = (1 - Math.cos(mu * Math.PI)) / 2;
  return y1 * (1 - mu2) + y2 * mu2;
}

function getTideHeightAtTime(targetTimeMs) {
  if (state.tideHeights.length === 0) return 0.0;

  let lower = null, upper = null;
  for (let i = 0; i < state.tideHeights.length; i++) {
    const pt = state.tideHeights[i];
    if (pt.timeMs <= targetTimeMs && (!lower || pt.timeMs > lower.timeMs)) lower = pt;
    if (pt.timeMs >= targetTimeMs && (!upper || pt.timeMs < upper.timeMs)) upper = pt;
  }

  if (!lower && !upper) return 0.0;
  if (!lower) return upper.value;
  if (!upper) return lower.value;

  if (lower.timeMs === upper.timeMs) return lower.value;

  const mu = (targetTimeMs - lower.timeMs) / (upper.timeMs - lower.timeMs);
  return cosineInterpolate(lower.value, upper.value, mu);
}

function getCurrentSpeedAtTime(targetTimeMs) {
  if (state.currentPredictions.length === 0) return 0.0;

  let lower = null, upper = null;
  for (let i = 0; i < state.currentPredictions.length; i++) {
    const pt = state.currentPredictions[i];
    if (pt.timeMs <= targetTimeMs && (!lower || pt.timeMs > lower.timeMs)) lower = pt;
    if (pt.timeMs >= targetTimeMs && (!upper || pt.timeMs < upper.timeMs)) upper = pt;
  }

  if (!lower && !upper) return 0.0;
  if (!lower) return upper.value;
  if (!upper) return lower.value;

  if (lower.timeMs === upper.timeMs) return lower.value;

  const mu = (targetTimeMs - lower.timeMs) / (upper.timeMs - lower.timeMs);
  return cosineInterpolate(lower.value, upper.value, mu);
}

// Convert tide height value (-2.0ft to +12.0ft) to SVG canvas Y pixel coordinate (0 to 400)
function getSvgYCoordinate(height) {
  const minHeight = -2.0;
  const maxHeight = 12.0;
  const pct = (height - minHeight) / (maxHeight - minHeight);
  // SVG Y goes from top to bottom (400 is bottom, 50 is top peak margin)
  return 340 - pct * 260;
}


// --- Main Orchestrator ---
function renderTidelogGraph() {
  const [startMs, endMs] = getTargetDayRange();
  const duration = 24 * 3600 * 1000; // 24 hours in milliseconds
  const dayAstro = getAstronomicalDataForSelectedDay();

  renderSunBackground(startMs, duration, dayAstro);
  renderLunarTransit(startMs, duration, dayAstro);
  renderTideWave(startMs, duration);

  // Existing external functions
  renderTideOverlayLabels(startMs, endMs);
  renderCurrentsTimeline(startMs, endMs);
}

// --- Data Fetching ---
function getAstronomicalDataForSelectedDay() {
  const base = new Date();
  base.setDate(base.getDate() + state.selectedDayOffset);

  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  return state.astronomical_data ? state.astronomical_data[dateKey] : null;
}


// --- Sun Background Rendering ---
function renderSunBackground(startMs, duration, dayAstro) {
  if (!dayAstro || !dayAstro.sunrise || !dayAstro.sunset) {
    hideSunElements();
    return;
  }

  const sunriseMs = new Date(dayAstro.sunrise).getTime();
  const sunsetMs = new Date(dayAstro.sunset).getTime();

  const xRise = ((sunriseMs - startMs) / duration) * 1000;
  const xSet = ((sunsetMs - startMs) / duration) * 1000;
  const r = (xSet - xRise) / 2;

  // 1. Arc only (no closing Z) for the dotted stroke
  const sunArcOnlyD = `M ${xRise.toFixed(1)} 340 A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xSet.toFixed(1)} 340`;

  // 2. Full closed path for the gradient fill
  const sunFillD = `${sunArcOnlyD} Z`;

  updateSunDOM(sunFillD, sunArcOnlyD, xRise, xSet, dayAstro);
}

function updateSunDOM(sunFillD, sunArcOnlyD, xRise, xSet, dayAstro) {
  // Apply the closed path to the gradient background
  elements.sunPath.setAttribute('d', sunFillD);
  elements.sunPath.style.display = 'block';

  // Apply the open arc path to the dotted stroke outline
  if (elements.sunStrokePath) {
    elements.sunStrokePath.setAttribute('d', sunArcOnlyD);
    elements.sunStrokePath.style.display = 'block';
  }

  setSvgElementX(elements.sunriseLine, xRise, true);
  setSvgElementX(elements.sunsetLine, xSet, true);

  setLabelPositionAndText(elements.sunriseTimeLabel, xRise, formatIsoTime(dayAstro.sunrise));
  setLabelPositionAndText(elements.sunsetTimeLabel, xSet, formatIsoTime(dayAstro.sunset));

  setLabelPositionAndText(elements.sunriseTextLabel, xRise);
  setLabelPositionAndText(elements.sunsetTextLabel, xSet);
}


function hideSunElements() {
  const sunElements = [
    'sunPath', 'sunStrokePath', 'sunriseLine', 'sunsetLine',
    'sunriseTextLabel', 'sunriseTimeLabel', 'sunsetTextLabel', 'sunsetTimeLabel'
  ];

  sunElements.forEach(el => {
    if (elements[el]) elements[el].style.display = 'none';
  });
}


// --- Lunar Transit Rendering ---
function renderLunarTransit(startMs, duration, dayAstro) {
  if (!dayAstro) {
    hideLunarElements();
    return;
  }

  const moonriseMs = dayAstro.moonrise ? new Date(dayAstro.moonrise).getTime() : null;
  const moonsetMs = dayAstro.moonset ? new Date(dayAstro.moonset).getTime() : null;
  const nowMs = new Date().getTime();

  const lunarData = calculateLunarPathAndPosition(moonriseMs, moonsetMs, startMs, duration, nowMs);

  elements.lunarTransitPath.setAttribute('d', lunarData.pathD);
  elements.lunarTransitPath.style.display = 'block';

  updateMoonIndicator(lunarData, dayAstro);
  updateLunarMarkersDOM(moonriseMs, moonsetMs, startMs, duration, dayAstro);
}

function updateLunarMarkersDOM(moonriseMs, moonsetMs, startMs, duration, dayAstro) {
  // Moonrise marker
  if (moonriseMs && moonriseMs >= startMs && moonriseMs <= startMs + duration) {
    const xRise = ((moonriseMs - startMs) / duration) * 1000;
    setSvgElementX(elements.moonriseLine, xRise, true);
    setLabelPositionAndText(elements.moonriseTimeLabel, xRise, formatIsoTime(dayAstro.moonrise));
    setLabelPositionAndText(elements.moonriseTextLabel, xRise);
  } else {
    if (elements.moonriseLine) elements.moonriseLine.style.display = 'none';
    if (elements.moonriseTimeLabel) elements.moonriseTimeLabel.style.display = 'none';
    if (elements.moonriseTextLabel) elements.moonriseTextLabel.style.display = 'none';
  }

  // Moonset marker
  if (moonsetMs && moonsetMs >= startMs && moonsetMs <= startMs + duration) {
    const xSet = ((moonsetMs - startMs) / duration) * 1000;
    setSvgElementX(elements.moonsetLine, xSet, true);
    setLabelPositionAndText(elements.moonsetTimeLabel, xSet, formatIsoTime(dayAstro.moonset));
    setLabelPositionAndText(elements.moonsetTextLabel, xSet);
  } else {
    if (elements.moonsetLine) elements.moonsetLine.style.display = 'none';
    if (elements.moonsetTimeLabel) elements.moonsetTimeLabel.style.display = 'none';
    if (elements.moonsetTextLabel) elements.moonsetTextLabel.style.display = 'none';
  }
}

function hideLunarElements() {
  elements.lunarTransitPath.style.display = 'none';
  elements.moonIndicatorGroup.style.display = 'none';

  const lunarMarkers = [
    'moonriseLine', 'moonriseTextLabel', 'moonriseTimeLabel',
    'moonsetLine', 'moonsetTextLabel', 'moonsetTimeLabel'
  ];

  lunarMarkers.forEach(el => {
    if (elements[el]) elements[el].style.display = 'none';
  });
}


function calculateLunarPathAndPosition(moonriseMs, moonsetMs, startMs, duration, nowMs) {
  let pathD = '';
  let showMoon = false;
  let mx = 0;
  let my = 0;

  // The approximate duration a moon is in the sky (half a lunar cycle = ~12.4 hours)
  const halfLunarDayMs = 12.4 * 3600 * 1000;
  const baselineY = 340; // Anchors it to the exact same baseline as the sun

  if (moonriseMs && moonsetMs) {
    if (moonriseMs < moonsetMs) {
      // Moon rises and sets within today's 24-hour window
      const xMR = ((moonriseMs - startMs) / duration) * 1000;
      const xMS = ((moonsetMs - startMs) / duration) * 1000;
      const r = (xMS - xMR) / 2;

      pathD = `M ${xMR.toFixed(1)} ${baselineY} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xMS.toFixed(1)} ${baselineY}`;

      if (nowMs >= moonriseMs && nowMs <= moonsetMs) {
        showMoon = true;
        const angle = Math.PI - ((nowMs - moonriseMs) / (moonsetMs - moonriseMs)) * Math.PI;
        mx = xMR + r + r * Math.cos(angle);
        my = baselineY - r * Math.sin(angle);
      }
    } else {
      // Moon sets in morning (rose yesterday), Rises in evening (sets tomorrow)

      // 1. Calculate the Morning Set (Tracking from Yesterday's rise)
      const yesterday_moonrise = moonsetMs - halfLunarDayMs;
      const xMR_yest = ((yesterday_moonrise - startMs) / duration) * 1000; // Will be a negative X coordinate
      const xMS = ((moonsetMs - startMs) / duration) * 1000;
      const rSet = (xMS - xMR_yest) / 2;

      // 2. Calculate the Evening Rise (Tracking to Tomorrow's set)
      const xMR = ((moonriseMs - startMs) / duration) * 1000;
      const tomorrow_moonset = moonriseMs + halfLunarDayMs;
      const xMS_tom = ((tomorrow_moonset - startMs) / duration) * 1000; // Will be > 1000 X coordinate
      const rRise = (xMS_tom - xMR) / 2;

      pathD = `M ${xMR_yest.toFixed(1)} ${baselineY} A ${rSet.toFixed(1)} ${rSet.toFixed(1)} 0 0 1 ${xMS.toFixed(1)} ${baselineY} ` +
        `M ${xMR.toFixed(1)} ${baselineY} A ${rRise.toFixed(1)} ${rRise.toFixed(1)} 0 0 1 ${xMS_tom.toFixed(1)} ${baselineY}`;

      if (nowMs <= moonsetMs) {
        showMoon = true;
        const angle = Math.PI - ((nowMs - yesterday_moonrise) / (moonsetMs - yesterday_moonrise)) * Math.PI;
        mx = xMR_yest + rSet + rSet * Math.cos(angle);
        my = baselineY - rSet * Math.sin(angle);
      } else if (nowMs >= moonriseMs) {
        showMoon = true;
        const angle = Math.PI - ((nowMs - moonriseMs) / (tomorrow_moonset - moonriseMs)) * Math.PI;
        mx = xMR + rRise + rRise * Math.cos(angle);
        my = baselineY - rRise * Math.sin(angle);
      }
    }
  } else if (moonsetMs) {
    // Only sets today (rose yesterday)
    const yesterday_moonrise = moonsetMs - halfLunarDayMs;
    const xMR_yest = ((yesterday_moonrise - startMs) / duration) * 1000;
    const xMS = ((moonsetMs - startMs) / duration) * 1000;
    const r = (xMS - xMR_yest) / 2;

    pathD = `M ${xMR_yest.toFixed(1)} ${baselineY} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xMS.toFixed(1)} ${baselineY}`;

    if (nowMs <= moonsetMs) {
      showMoon = true;
      const angle = Math.PI - ((nowMs - yesterday_moonrise) / (moonsetMs - yesterday_moonrise)) * Math.PI;
      mx = xMR_yest + r + r * Math.cos(angle);
      my = baselineY - r * Math.sin(angle);
    }
  } else if (moonriseMs) {
    // Only rises today (sets tomorrow)
    const xMR = ((moonriseMs - startMs) / duration) * 1000;
    const tomorrow_moonset = moonriseMs + halfLunarDayMs;
    const xMS_tom = ((tomorrow_moonset - startMs) / duration) * 1000;
    const r = (xMS_tom - xMR) / 2;

    pathD = `M ${xMR.toFixed(1)} ${baselineY} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xMS_tom.toFixed(1)} ${baselineY}`;

    if (nowMs >= moonriseMs) {
      showMoon = true;
      const angle = Math.PI - ((nowMs - moonriseMs) / (tomorrow_moonset - moonriseMs)) * Math.PI;
      mx = xMR + r + r * Math.cos(angle);
      my = baselineY - r * Math.sin(angle);
    }
  } else {
    // Moon is up the entire day
    const yesterday_moonrise = startMs - (duration / 4);
    const tomorrow_moonset = startMs + duration + (duration / 4);
    const xMR_yest = ((yesterday_moonrise - startMs) / duration) * 1000;
    const xMS_tom = ((tomorrow_moonset - startMs) / duration) * 1000;
    const r = (xMS_tom - xMR_yest) / 2;

    pathD = `M ${xMR_yest.toFixed(1)} ${baselineY} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${xMS_tom.toFixed(1)} ${baselineY}`;
    showMoon = true;
    const angle = Math.PI - ((nowMs - yesterday_moonrise) / (tomorrow_moonset - yesterday_moonrise)) * Math.PI;
    mx = xMR_yest + r + r * Math.cos(angle);
    my = baselineY - r * Math.sin(angle);
  }

  return { pathD, showMoon, mx, my };
}


function updateMoonIndicator(lunarData, dayAstro) {
  if (state.selectedDayOffset === 0 && lunarData.showMoon) {
    elements.moonIndicatorGroup.style.display = 'block';
    elements.moonIndicatorGroup.setAttribute('transform', `translate(${lunarData.mx.toFixed(1)}, ${lunarData.my.toFixed(1)})`);
    elements.moonIndicatorIcon.textContent = dayAstro.moon_phase_symbol;
  } else {
    elements.moonIndicatorGroup.style.display = 'none';
  }
}

function hideLunarElements() {
  elements.lunarTransitPath.style.display = 'none';
  elements.moonIndicatorGroup.style.display = 'none';
}

// --- Tide Wave Rendering ---
function renderTideWave(startMs, duration) {
  let wavePathD = '';
  const steps = 144; // sample every 10 minutes

  for (let i = 0; i <= steps; i++) {
    const tMs = startMs + (i / steps) * duration;
    const x = (i / steps) * 1000;
    const hVal = getTideHeightAtTime(tMs);
    const y = getSvgYCoordinate(hVal);

    wavePathD += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }

  elements.waveStrokePath.setAttribute('d', wavePathD);
  elements.waveFillPath.setAttribute('d', wavePathD + ' L 1000 340 L 0 340 Z');
}

// --- General Helpers ---
function setSvgElementX(element, xValue, isLine = false) {
  if (!element) return;
  const fixedX = xValue.toFixed(1);
  if (isLine) {
    element.setAttribute('x1', fixedX);
    element.setAttribute('x2', fixedX);
  } else {
    element.setAttribute('x', fixedX);
  }
  element.style.display = 'block';
}

function setLabelPositionAndText(element, xValue, text = null) {
  if (!element) return;
  element.setAttribute('x', xValue.toFixed(1));
  if (text !== null) element.textContent = text;
  element.style.display = 'block';
}


// Render callouts for peaks/troughs
function renderTideOverlayLabels(startMs, endMs) {
  elements.tideOverlayLabels.innerHTML = '';

  const dayExtremes = state.tideExtremes.filter(pt => pt.timeMs >= startMs && pt.timeMs <= endMs);

  dayExtremes.forEach(pt => {
    const xPct = ((pt.timeMs - startMs) / (24 * 3600 * 1000)) * 100;
    const yVal = getSvgYCoordinate(pt.value);
    const yPct = (yVal / 400) * 100;

    const div = document.createElement('div');
    div.className = `tide-callout ${pt.type === 'H' ? 'high' : 'low'}`;
    div.style.left = `${xPct}%`;

    // Position labels slightly offset from coordinate to prevent overlapping the dot
    const offset = pt.type === 'H' ? -22 : 22;
    div.style.top = `calc(${yPct}% + ${offset}px)`;

    const timeStr = new Date(pt.timeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sign = pt.type === 'H' ? '+' : '';

    div.innerHTML = `
      <div class="tide-callout-text">${sign}${pt.value.toFixed(1)} FT</div>
      <div class="tide-callout-sub">${timeStr}</div>
    `;
    elements.tideOverlayLabels.appendChild(div);
  });
}

// Position real-time trackers
function updateNowTracker(now) {
  const nowMs = now.getTime();
  const [startMs, endMs] = getTargetDayRange();
  const duration = 24 * 3600 * 1000;

  // Only show NOW tracker elements on the TODAY screen
  if (state.selectedDayOffset === 0 && nowMs >= startMs && nowMs <= endMs) {
    elements.nowMarkerLine.style.display = 'block';
    elements.nowMarkerDot.style.display = 'block';

    const xPct = ((nowMs - startMs) / duration) * 100;

    // Position SVG tracker line
    elements.nowMarkerLine.setAttribute('x1', xPct * 10);
    elements.nowMarkerLine.setAttribute('x2', xPct * 10);

    // Position HTML tracker dot
    const currentHeight = getTideHeightAtTime(nowMs);
    const yVal = getSvgYCoordinate(currentHeight);
    const yPct = (yVal / 400) * 100;

    elements.nowMarkerDot.style.left = `${xPct}%`;
    elements.nowMarkerDot.style.top = `${yPct}%`;

    // Update Header active readout
    const sign = currentHeight >= 0 ? '+' : '';
    elements.currentTideVal.textContent = `${sign}${currentHeight.toFixed(1)}`;

    const isRising = getTideHeightAtTime(nowMs + 5 * 60 * 1000) > currentHeight;
    elements.currentTideSlope.textContent = isRising ? '↑' : '↓';
    elements.currentTideSlope.style.color = isRising ? 'var(--accent-color)' : 'var(--text-muted)';

    // Update current speed
    const currentSpeed = getCurrentSpeedAtTime(nowMs);
    const absSpeed = Math.abs(currentSpeed).toFixed(1);
    if (Math.abs(currentSpeed) < 0.15) {
      elements.currentStatusVal.textContent = 'SLACK';
    } else {
      elements.currentStatusVal.textContent = `${absSpeed} KT ${currentSpeed > 0 ? 'FLOOD' : 'EBB'}`;
    }
  } else {
    // Hide tracker elements for Tomorrow
    elements.nowMarkerLine.style.display = 'none';
    elements.nowMarkerDot.style.display = 'none';

    // Header displays placeholder/average when viewing future days
    elements.currentTideVal.textContent = '--';
    elements.currentTideSlope.textContent = '';
    elements.currentStatusVal.textContent = '--';
  }
}

// Extract predicted currents peaks/troughs & zero crossings (slack) for the target day
function renderCurrentsTimeline(startMs, endMs) {
  elements.currentsEventsWrapper.innerHTML = '';

  if (state.currentPredictions.length === 0) return;

  const dayPredictions = state.currentPredictions.filter(pt => pt.timeMs >= startMs - 2 * 3600 * 1000 && pt.timeMs <= endMs + 2 * 3600 * 1000);
  if (dayPredictions.length === 0) return;

  const duration = 24 * 3600 * 1000;
  const steps = 144; // sample every 10 minutes across 24 hours

  let mainStrokeD = '';
  let floodFillD = 'M 0 40';
  let ebbFillD = 'M 0 40';

  // 1. Find the highest actual current speed in the currently loaded predictions
  let maxAbsValue = 0;
  dayPredictions.forEach(pt => {
    const absVal = Math.abs(pt.value);
    if (absVal > maxAbsValue) maxAbsValue = absVal;
  });

  // 2. Round UP to the nearest integer to set a safe visual ceiling (with a floor of 1.0 to prevent division by zero)
  const maxKt = Math.max(1, Math.ceil(maxAbsValue));


  // Helper to map current velocity (assuming max range roughly -3.0 to +3.0 KT) to SVG Y coordinates (0 to 80)
  // Center baseline (0 KT) sits exactly at Y = 40
  function getVelocityY(kt) {
    let pct = kt / maxKt;
    if (pct > 1) pct = 1;
    if (pct < -1) pct = -1;
    return 40 - (pct * 35); // Leaves 5px margin top/bottom
  }

  // 1. Plot the Continuous Velocity Curve Paths
  for (let i = 0; i <= steps; i++) {
    const tMs = startMs + (i / steps) * duration;
    const x = (i / steps) * 1000;
    const ktVal = getCurrentSpeedAtTime(tMs);
    const y = getVelocityY(ktVal);

    if (i === 0) {
      mainStrokeD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      mainStrokeD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    // Split fill logic for flood (above baseline) and ebb (below baseline)
    if (ktVal >= 0) {
      floodFillD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      ebbFillD += ` L ${x.toFixed(1)} 40`;
    } else {
      floodFillD += ` L ${x.toFixed(1)} 40`;
      ebbFillD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }

  // Cap off the fills back to baseline
  floodFillD += ' L 1000 40 Z';
  ebbFillD += ' L 1000 40 Z';

  // Inject into SVG elements
  if (elements.currentsStrokePath) elements.currentsStrokePath.setAttribute('d', mainStrokeD);
  if (elements.currentsFloodPath) elements.currentsFloodPath.setAttribute('d', floodFillD);
  if (elements.currentsEbbPath) elements.currentsEbbPath.setAttribute('d', ebbFillD);

  // 2. Detect Critical Events for HTML Text Overlays (Peaks, Troughs, Slacks)
  const events = [];

  // Detect zero-crossings (Slack Water)
  for (let i = 0; i < dayPredictions.length - 1; i++) {
    const pt0 = dayPredictions[i];
    const pt1 = dayPredictions[i + 1];
    if (pt0.value * pt1.value < 0) {
      const mu = (0 - pt0.value) / (pt1.value - pt0.value);
      const slackMs = pt0.timeMs + mu * (pt1.timeMs - pt0.timeMs);
      if (slackMs >= startMs && slackMs <= endMs) {
        events.push({ timeMs: slackMs, type: 'slack', value: 0 });
      }
    }
  }

  // Detect local peaks (Max Flood/Ebb)
  for (let i = 1; i < dayPredictions.length - 1; i++) {
    const ptPrev = dayPredictions[i - 1];
    const ptCurr = dayPredictions[i];
    const ptNext = dayPredictions[i + 1];

    if (ptCurr.timeMs >= startMs && ptCurr.timeMs <= endMs) {
      if (ptCurr.value > ptPrev.value && ptCurr.value > ptNext.value && ptCurr.value > 0.3) {
        events.push({ timeMs: ptCurr.timeMs, type: 'flood', value: ptCurr.value });
      } else if (ptCurr.value < ptPrev.value && ptCurr.value < ptNext.value && ptCurr.value < -0.3) {
        events.push({ timeMs: ptCurr.timeMs, type: 'ebb', value: ptCurr.value });
      }
    }
  }

  events.sort((a, b) => a.timeMs - b.timeMs);

  // 3. Render HTML text tags over the curve
  events.forEach(event => {
    const xPct = ((event.timeMs - startMs) / duration) * 100;
    if (xPct < 2.5 || xPct > 97.5) return;

    const div = document.createElement('div');
    div.className = `currents-event ${event.type}`;
    div.style.position = 'absolute';
    div.style.left = `${xPct}%`;
    div.style.transform = 'translateX(-50%)';

    const timeStr = new Date(event.timeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(' ', '');
    const yCoord = getVelocityY(event.value);

    // Position text cleanly depending on whether it's above, below, or on the baseline
    if (event.type === 'flood') {
      div.style.top = `${yCoord - 25}px`; // Float above peak
      div.innerHTML = `
        <span class="currents-event-val" style="color: #06b6d4; font-weight:600; display:block; font-size:0.75rem; text-align: center;">↑ ${event.value.toFixed(1)} KT</span>
        <span class="currents-event-time" style="display:block; font-size:0.65rem; opacity:0.6; text-align: center;">${timeStr}</span>
      `;
    } else if (event.type === 'ebb') {
      div.style.top = `${yCoord + 2}px`; // Drop below trough
      div.innerHTML = `
        <span class="currents-event-val" style="color: #ec4899; font-weight:600; display:block; font-size:0.75rem; text-align: center;">↓ ${Math.abs(event.value).toFixed(1)} KT</span>
        <span class="currents-event-time" style="display:block; font-size:0.65rem; opacity:0.6; text-align: center;">${timeStr}</span>
      `;
    } else {
      div.style.top = '28px'; // Center roughly over baseline
      div.innerHTML = `
        <span class="currents-event-arrow" style="display:block; font-size:0.75rem; color:#64748b; font-weight:bold; text-align: center;">◇</span>
        <span class="currents-event-time" style="display:block; font-size:0.6rem; color:#64748b; text-align: center; margin-top: 2px;">${timeStr}</span>
      `;
    }

    elements.currentsEventsWrapper.appendChild(div);
  });
}
