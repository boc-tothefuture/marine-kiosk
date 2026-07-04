// Tide Clock TV UI Application State
const state = {
  stationId: '8418150',
  stationName: 'PORTLAND, MAINE',
  dateStr: '',
  tideHeights: [], // Array of {hour, value}
  tideExtremes: [], // Array of exact high/low {time, value, type}
  currentPredictions: [], // Array of predicted currents {time, value}
  units: 'english',
  datum: 'MLLW',
  lastUpdated: null,
  waterTemp: null,
  marineForecast: [],
  connectionOnline: true,
  plotStartMs: null,
  
  // User Preferences (saved in localStorage)
  settings: {
    theme: 'ocean',       // ocean, cyber, mono, amber
    scale: 'dynamic',     // dynamic, fixed
    source: 'live'        // live, sim
  }
};

// DOM Elements
const elements = {
  clockContainer: document.getElementById('clock-container'),
  stationName: document.getElementById('station-name'),
  digitalTime: document.getElementById('digital-time'),
  digitalDate: document.getElementById('digital-date'),
  moonSymbol: document.getElementById('moon-symbol'),
  moonName: document.getElementById('moon-name'),
  currentTideVal: document.getElementById('current-tide-val'),
  currentTideUnit: document.getElementById('current-tide-unit'),
  tideStatusText: document.getElementById('tide-status-text'),
  pulseDot: document.getElementById('status-pulse-dot'),
  waterTempContainer: document.getElementById('water-temp-container'),
  waterTempVal: document.getElementById('water-temp-val'),
  barStatusVal: document.getElementById('bar-status-val'),
  barStatusSub: document.getElementById('bar-status-sub'),
  currentStatusVal: document.getElementById('current-status-val'),
  lastUpdatedText: document.getElementById('last-updated-text'),
  
  // SVG Canvas elements
  tideSvg: document.getElementById('tide-svg'),
  waveFillPath: document.getElementById('wave-fill-path'),
  waveStrokePath: document.getElementById('wave-stroke-path'),
  waveWalkablePath: document.getElementById('wave-walkable-path'),
  waveWarningPath: document.getElementById('wave-warning-path'),
  waveDangerPath: document.getElementById('wave-danger-path'),
  nowMarkerLine: document.getElementById('now-marker-line'),
  nowMarkerGlow: document.getElementById('now-marker-glow'),
  nowMarkerDot: document.getElementById('now-marker-dot'),
  tideOverlayLabels: document.getElementById('tide-overlay-labels'),
  forecastScrollWrapper: document.getElementById('forecast-scroll-wrapper'),
  forecastHeaderContainer: document.getElementById('forecast-header-container'),
  timelineLabels: document.getElementById('timeline-labels'),
  
  // Settings Modal
  settingsToggle: document.getElementById('settings-toggle'),
  settingsPanel: document.getElementById('settings-panel'),
  settingsSave: document.getElementById('settings-save'),
  settingsClose: document.getElementById('settings-close'),
  settingTheme: document.getElementById('setting-theme'),
  settingScale: document.getElementById('setting-scale'),
  settingSource: document.getElementById('setting-source')
};

// Initialize Application
function init() {
  loadSettings();
  applyThemeClass();
  setupEventListeners();
  
  // Start clock loop (updates every second)
  updateTime();
  setInterval(updateTime, 1000);
  
  // Initial data load
  loadData();
  
  // Periodically refresh data (every 10 minutes)
  setInterval(loadData, 10 * 60 * 1000);
  
  // Add window resize listener to reposition callouts if needed
  window.addEventListener('resize', renderWavePlot);
}

// Load settings from localStorage
function loadSettings() {
  const saved = localStorage.getItem('tide_clock_tv_settings');
  if (saved) {
    try {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Failed to parse saved settings:', e);
    }
  }
  
  // Sync select inputs with state
  elements.settingTheme.value = state.settings.theme;
  elements.settingScale.value = state.settings.scale;
  elements.settingSource.value = state.settings.source;
}

// Save settings to localStorage
function saveSettings() {
  state.settings.theme = elements.settingTheme.value;
  state.settings.scale = elements.settingScale.value;
  state.settings.source = elements.settingSource.value;
  
  localStorage.setItem('tide_clock_tv_settings', JSON.stringify(state.settings));
  
  applyThemeClass();
  loadData(); // Reload and redraw
}

// Apply the theme class to the container
function applyThemeClass() {
  elements.clockContainer.className = ''; // Reset
  elements.clockContainer.classList.add(`theme-${state.settings.theme}`);
  
  // Highlight active theme color in settings save button
  elements.settingsSave.style.backgroundColor = 'var(--accent-color)';
  
  // Update stroke gradient stops and glow colors dynamically
  const glowStroke = document.getElementById('wave-stroke-path');
  const fillGradStop1 = document.querySelector('#wave-fill-grad stop:first-child');
  const fillGradStop2 = document.querySelector('#wave-fill-grad stop:last-child');
  
  let colorHex = '#06b6d4'; // default ocean cyan
  if (state.settings.theme === 'cyber') colorHex = '#ec4899';
  if (state.settings.theme === 'mono') colorHex = '#f1f5f9';
  if (state.settings.theme === 'amber') colorHex = '#ffb300';
  
  glowStroke.setAttribute('stroke', colorHex);
  elements.nowMarkerDot.style.borderColor = colorHex;
  elements.nowMarkerGlow.setAttribute('fill', colorHex);
  
  fillGradStop1.setAttribute('stop-color', colorHex);
  fillGradStop2.setAttribute('stop-color', colorHex);
}

// Setup Event Listeners
function setupEventListeners() {
  elements.settingsToggle.addEventListener('click', () => {
    elements.settingsPanel.classList.remove('hidden');
  });
  
  elements.settingsClose.addEventListener('click', () => {
    elements.settingsPanel.classList.add('hidden');
    loadSettings();
  });
  
  elements.settingsSave.addEventListener('click', () => {
    saveSettings();
    elements.settingsPanel.classList.add('hidden');
  });
  
  // Add 'S' key listener to open settings panel (clean TV interaction)
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 's') {
      if (elements.settingsPanel.classList.contains('hidden')) {
        elements.settingsPanel.classList.remove('hidden');
      } else {
        elements.settingsPanel.classList.add('hidden');
      }
    }
  });
}

// Update clock and date displays
function updateTime() {
  const now = new Date();
  
  // Time formatting (Outfit weight 200)
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // convert 0 to 12
  elements.digitalTime.innerHTML = `${hours}:${minutes}<span>${ampm}</span>`;
  
  // Date formatting (Outfit weight 300)
  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  elements.digitalDate.textContent = now.toLocaleDateString('en-US', options);
  
  // Update moon phase
  updateMoonPhase(now);
  
  // Update the line position and active readout based on fractional hour
  updateNowTracker(now);
}

// Calculate moon phase (0 to 1) where 0 is New Moon, 0.5 is Full Moon
function getMoonPhase(date) {
  const epoch = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  const synodicMonth = 29.530588853;
  
  const diffMs = date.getTime() - epoch;
  const diffDays = diffMs / msPerDay;
  const phase = (diffDays / synodicMonth) % 1;
  return phase < 0 ? phase + 1 : phase;
}

// Map phase percentage to symbol and descriptive text
function getMoonPhaseDetails(date) {
  const phase = getMoonPhase(date);
  let name = "";
  let symbol = "";
  
  if (phase < 0.03 || phase >= 0.97) {
    name = "New Moon";
    symbol = "🌑";
  } else if (phase >= 0.03 && phase < 0.22) {
    name = "Waxing Crescent";
    symbol = "🌒";
  } else if (phase >= 0.22 && phase < 0.28) {
    name = "First Quarter";
    symbol = "🌓";
  } else if (phase >= 0.28 && phase < 0.47) {
    name = "Waxing Gibbous";
    symbol = "🌔";
  } else if (phase >= 0.47 && phase < 0.53) {
    name = "Full Moon";
    symbol = "🌕";
  } else if (phase >= 0.53 && phase < 0.72) {
    name = "Waning Gibbous";
    symbol = "🌖";
  } else if (phase >= 0.72 && phase < 0.78) {
    name = "Last Quarter";
    symbol = "🌗";
  } else {
    name = "Waning Crescent";
    symbol = "🌘";
  }
  
  return { phase, name, symbol };
}

// Update DOM elements for Moon Phase
function updateMoonPhase(date) {
  const details = getMoonPhaseDetails(date);
  if (elements.moonSymbol && elements.moonName) {
    elements.moonSymbol.textContent = details.symbol;
    elements.moonName.textContent = details.name;
    elements.moonSymbol.title = `${Math.round(details.phase * 100)}% Phase`;
  }
}

// Cosine Interpolation for smooth curve calculations
function cosineInterpolate(y1, y2, mu) {
  const mu2 = (1 - Math.cos(mu * Math.PI)) / 2;
  return y1 * (1 - mu2) + y2 * mu2;
}

// Calculate interpolated tide value at any absolute time (milliseconds epoch)
function getTideHeightAtTime(targetTimeMs) {
  if (state.tideHeights.length === 0) return 0.0;
  
  // Find bracketing prediction points
  let lower = null;
  let upper = null;
  
  for (let i = 0; i < state.tideHeights.length; i++) {
    const pt = state.tideHeights[i];
    const t = pt.timeMs;
    
    if (t <= targetTimeMs) {
      if (!lower || t > lower.timeMs) {
        lower = pt;
      }
    }
    if (t >= targetTimeMs) {
      if (!upper || t < upper.timeMs) {
        upper = pt;
      }
    }
  }
  
  if (!lower && !upper) return 0.0;
  if (!lower) return upper.value;
  if (!upper) return lower.value;
  
  const tLower = lower.timeMs;
  const tUpper = upper.timeMs;
  
  if (tLower === tUpper) return lower.value;
  
  const mu = (targetTimeMs - tLower) / (tUpper - tLower);
  return cosineInterpolate(lower.value, upper.value, mu);
}

// Calculate interpolated predicted current value (knots, positive=flood, negative=ebb) at any absolute time
function getCurrentSpeedAtTime(targetTimeMs) {
  if (!state.currentPredictions || state.currentPredictions.length === 0) return 0.0;
  
  // Find bracketing prediction points
  let lower = null;
  let upper = null;
  
  for (let i = 0; i < state.currentPredictions.length; i++) {
    const pt = state.currentPredictions[i];
    const t = pt.timeMs;
    
    if (t <= targetTimeMs) {
      if (!lower || t > lower.timeMs) {
        lower = pt;
      }
    }
    if (t >= targetTimeMs) {
      if (!upper || t < upper.timeMs) {
        upper = pt;
      }
    }
  }
  
  if (!lower && !upper) return 0.0;
  if (!lower) return upper.value;
  if (!upper) return lower.value;
  
  const tLower = lower.timeMs;
  const tUpper = upper.timeMs;
  
  if (tLower === tUpper) return lower.value;
  
  const mu = (targetTimeMs - tLower) / (tUpper - tLower);
  return cosineInterpolate(lower.value, upper.value, mu);
}

// Update real-time tide markers (Dashed line, dot position, and current reading values)
function updateNowTracker(now) {
  if (state.tideHeights.length === 0 || !state.plotStartMs) return;
  
  const nowMs = now.getTime();
  const durationMs = 36 * 3600 * 1000;
  
  // Calculate dynamic X coordinate based on elapsed time since chart was last plotted
  const xNow = ((nowMs - state.plotStartMs) / durationMs) * 1000;
  
  // Interpolated current tide value
  const currentTideHeight = getTideHeightAtTime(nowMs);
  
  // Map this value to SVG Y Coordinate
  const yNow = getSvgYCoordinate(currentTideHeight);
  
  // Move vertical line & glow ring in SVG, position HTML indicator dot
  elements.nowMarkerLine.setAttribute('x1', xNow);
  elements.nowMarkerLine.setAttribute('x2', xNow);
  elements.nowMarkerGlow.setAttribute('cx', xNow);
  elements.nowMarkerGlow.setAttribute('cy', yNow);
  elements.nowMarkerDot.style.left = `${(xNow / 1000) * 100}%`;
  elements.nowMarkerDot.style.top = `${(yNow / 400) * 100}%`;
  
  // Update Top-Right readouts
  const sign = currentTideHeight >= 0 ? '+' : '';
  elements.currentTideVal.textContent = `${sign}${currentTideHeight.toFixed(1)}`;
  
  // Determine if tide is rising or falling (slope check 5 minutes into the future)
  const checkTimeMs = nowMs + 5 * 60 * 1000; // +5 minutes
  const futureVal = getTideHeightAtTime(checkTimeMs);
  
  if (futureVal > currentTideHeight) {
    elements.tideStatusText.innerHTML = 'RISING TIDE <span class="tide-arrow">↑</span>';
  } else {
    elements.tideStatusText.innerHTML = 'FALLING TIDE <span class="tide-arrow">↓</span>';
  }

  // Update current speed readout (knots, flood/ebb/slack)
  const currentSpeed = getCurrentSpeedAtTime(nowMs);
  if (currentSpeed === null || currentSpeed === undefined || !state.currentPredictions || state.currentPredictions.length === 0) {
    elements.currentStatusVal.textContent = '--';
  } else {
    const absSpeed = Math.abs(currentSpeed).toFixed(1);
    if (Math.abs(currentSpeed) < 0.15) {
      elements.currentStatusVal.textContent = 'SLACK';
    } else if (currentSpeed > 0) {
      elements.currentStatusVal.textContent = `${absSpeed} KT FLOOD`;
    } else {
      elements.currentStatusVal.textContent = `${absSpeed} KT EBB`;
    }
  }

  // Update GDI-LDI bar walkability status
  updateBarStatus(now, currentTideHeight, nowMs);
}

// Calculate GDI-LDI walkability window (< 4.0 ft limit) and update UI badge
function updateBarStatus(now, currentTideHeight, nowMs) {
  if (state.tideHeights.length === 0) return;
  
  const limit = 4.0;
  const isOpen = currentTideHeight < limit;
  
  if (isOpen) {
    // Hide sub-label in open state
    elements.barStatusSub.style.display = 'none';
    
    // Find when it rises back above 4.0 ft (search up to 12.5 hours forward)
    let closeDiffMs = null;
    for (let t = 3 * 60 * 1000; t < 12.5 * 3600 * 1000; t += 3 * 60 * 1000) { // check every 3 minutes
      const checkTimeMs = nowMs + t;
      if (getTideHeightAtTime(checkTimeMs) >= limit) {
        closeDiffMs = t;
        break;
      }
    }
    
    const isRising = getTideHeightAtTime(nowMs + 5 * 60 * 1000) > currentTideHeight;
    
    if (isRising && closeDiffMs !== null) {
      // If rising, replace 'OPEN' with remaining time
      const totalMinRemaining = Math.round(closeDiffMs / (60 * 1000));
      const hrs = Math.floor(totalMinRemaining / 60);
      const mins = totalMinRemaining % 60;
      const timeText = hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
      elements.barStatusVal.textContent = timeText;
      
      // Apply warning colors to the badge itself
      let statusClass = 'status-safe';
      if (currentTideHeight >= 3.0) {
        statusClass = 'status-danger';
      } else if (currentTideHeight >= 2.0) {
        statusClass = 'status-warning';
      }
      elements.barStatusVal.className = `bar-open ${statusClass}`;
    } else {
      // If falling/going down, just say OPEN
      elements.barStatusVal.textContent = 'OPEN';
      elements.barStatusVal.className = 'bar-open status-safe';
    }
  } else {
    elements.barStatusVal.className = 'bar-closed';
    elements.barStatusVal.textContent = 'CLOSED';
    elements.barStatusSub.style.display = 'block';
    
    // Find when it drops below 4.0 ft (search up to 12.5 hours forward)
    let openDiffMs = null;
    for (let t = 3 * 60 * 1000; t < 12.5 * 3600 * 1000; t += 3 * 60 * 1000) {
      const checkTimeMs = nowMs + t;
      if (getTideHeightAtTime(checkTimeMs) < limit) {
        openDiffMs = t;
        break;
      }
    }
    
    if (openDiffMs !== null) {
      const openTime = new Date(nowMs + openDiffMs);
      const timeStr = openTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      elements.barStatusSub.textContent = `Opens at ${timeStr}`;
    } else {
      elements.barStatusSub.textContent = 'Closed today';
    }
    
    elements.barStatusSub.className = 'status-closed';
  }
}

// Calculate the SVG Y coordinate given a tide value
function getSvgYCoordinate(value) {
  if (state.tideHeights.length === 0) return 200;
  
  let minHeight = Infinity;
  let maxHeight = -Infinity;
  
  state.tideHeights.forEach(pt => {
    if (pt.value < minHeight) minHeight = pt.value;
    if (pt.value > maxHeight) maxHeight = pt.value;
  });
  
  if (maxHeight === minHeight) {
    minHeight -= 1.0;
    maxHeight += 1.0;
  }
  
  let scaleMin = minHeight;
  let scaleMax = maxHeight;
  
  if (state.settings.scale === 'fixed') {
    scaleMin = -2.0;
    scaleMax = 12.0;
  }
  
  // Map value to Y coordinate (50px to 330px inside a 400px viewBox height)
  // Higher tide values map to lower Y values
  const rangeY = 280; // 330 - 50
  const minY = 50;
  const maxY = 330;
  
  const pct = Math.max(0, Math.min(1, (value - scaleMin) / (scaleMax - scaleMin)));
  return maxY - (pct * rangeY);
}

// Generate simulated tide data (double sine wave approximation spanning 72 hours)
function generateSimulatedTide() {
  const now = new Date();
  const heights = [];
  
  // Start from 24 hours ago, generate 72 hours of hourly data
  const baseTimeMs = now.getTime() - 24 * 3600 * 1000;
  
  for (let h = 0; h < 72; h++) {
    const checkTime = new Date(baseTimeMs + h * 3600 * 1000);
    const relHour = h;
    
    const semiDiurnal = Math.sin((2 * Math.PI * (relHour - 3.0)) / 12.42);
    const diurnal = 0.8 * Math.sin((2 * Math.PI * (relHour - 7.0)) / 24.84);
    const value = 4.8 + 4.1 * semiDiurnal + diurnal;
    
    heights.push({
      time: checkTime.toISOString(),
      timeMs: checkTime.getTime(),
      value: Math.round(value * 1000) / 1000
    });
  }
  
  state.stationName = 'PORTLAND, ME (SIMULATED)';
  state.units = 'english';
  state.datum = 'MLLW';
  state.dateStr = now.toISOString().split('T')[0];
  state.tideHeights = heights;
  
  // Generate simulated extremes
  const extremes = [];
  for (let i = 1; i < heights.length - 1; i++) {
    const prev = heights[i - 1].value;
    const curr = heights[i].value;
    const next = heights[i + 1].value;
    if (curr > prev && curr > next) {
      extremes.push({ time: heights[i].time, timeMs: heights[i].timeMs, value: curr, type: 'H' });
    }
    if (curr < prev && curr < next) {
      extremes.push({ time: heights[i].time, timeMs: heights[i].timeMs, value: curr, type: 'L' });
    }
  }
  state.tideExtremes = extremes;
  
  // Generate simulated currents predictions (phase-shifted from tide heights by 3.1 hours)
  const currents = [];
  for (let h = 0; h < 72; h++) {
    const checkTime = new Date(baseTimeMs + h * 3600 * 1000);
    const relHour = h;
    const semiDiurnal = Math.sin((2 * Math.PI * (relHour - 3.0 - 3.1)) / 12.42);
    const value = 1.5 * semiDiurnal;
    currents.push({
      time: checkTime.toISOString(),
      timeMs: checkTime.getTime(),
      value: Math.round(value * 100) / 100
    });
  }
  state.currentPredictions = currents;
  
  state.waterTemp = 59.5;
  state.marineForecast = [
    { name: "THIS AFTERNOON", text: "SW winds around 10 kt. Seas around 2 ft." },
    { name: "TONIGHT", text: "W winds 5 to 10 kt. Seas around 2 ft." },
    { name: "SATURDAY", text: "W winds around 5 kt, becoming NW in the afternoon. Seas around 2 ft." },
    { name: "SATURDAY NIGHT", text: "NW winds 5 to 10 kt. Seas around 2 ft." }
  ];
  state.lastUpdated = now.toISOString();
  state.connectionOnline = false;
}

// Load data from JSON or simulation
async function loadData() {
  if (state.settings.source === 'sim') {
    generateSimulatedTide();
    updateUI();
    return;
  }
  
  try {
    const response = await fetch('tide_data.json', { cache: 'no-store' });
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
    state.lastUpdated = data.last_updated;
    state.connectionOnline = true;
    
    console.log('Tide data loaded successfully for:', state.stationName);
  } catch (error) {
    console.warn('Failed to load live tide data. Falling back to simulation.', error);
    generateSimulatedTide();
    state.connectionOnline = false;
  }
  
  updateUI();
}

// Refresh UI Elements
function updateUI() {
  elements.stationName.textContent = state.stationName;
  elements.currentTideUnit.textContent = state.units === 'english' ? 'FT' : 'M';
  
  if (state.connectionOnline && state.settings.source === 'live') {
    elements.pulseDot.className = 'pulse-dot';
    elements.pulseDot.title = 'NOAA Connected';
  } else {
    elements.pulseDot.className = 'pulse-dot offline';
    elements.pulseDot.title = state.settings.source === 'sim' ? 'Simulated Offline Demo' : 'Connection Offline (Simulated)';
  }
  
  if (state.waterTemp !== undefined && state.waterTemp !== null) {
    const tempUnit = state.units === 'english' ? '°F' : '°C';
    elements.waterTempVal.textContent = `${state.waterTemp.toFixed(1)}${tempUnit}`;
    elements.waterTempContainer.style.display = 'flex';
  } else {
    elements.waterTempContainer.style.display = 'none';
  }

  if (state.lastUpdated) {
    const updatedDate = new Date(state.lastUpdated);
    const timeStr = updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    elements.lastUpdatedText.textContent = `UPDATED: ${timeStr}`;
  } else {
    elements.lastUpdatedText.textContent = 'UPDATED: --';
  }
  
  // Update NWS Marine Forecast Header Ticker
  elements.forecastScrollWrapper.innerHTML = '';
  if (state.marineForecast && state.marineForecast.length > 0) {
    elements.forecastHeaderContainer.style.display = 'flex';
    
    // Slice up to 4 periods to keep it focused on the immediate forecast
    const periodsToRender = state.marineForecast.slice(0, 4);
    
    periodsToRender.forEach(period => {
      const card = document.createElement('div');
      card.className = 'forecast-ticker-card';
      
      const pName = document.createElement('span');
      pName.className = 'forecast-ticker-period';
      pName.textContent = period.name;
      
      const pText = document.createElement('span');
      pText.className = 'forecast-ticker-text';
      pText.textContent = period.text;
      
      card.appendChild(pName);
      card.appendChild(pText);
      elements.forecastScrollWrapper.appendChild(card);
    });
    
    startForecastTickerAnimation(periodsToRender.length);
  } else {
    elements.forecastHeaderContainer.style.display = 'none';
  }

  renderWavePlot();
  updateTime(); // Force time update
}

// Render vector SVG wave line, SVG area fill, and callout overlays
function renderWavePlot() {
  if (state.tideHeights.length === 0) return;
  
  const now = new Date();
  const nowMs = now.getTime();
  const startMs = nowMs - 12 * 3600 * 1000; // -12h
  const endMs = nowMs + 24 * 3600 * 1000;  // +24h
  const durationMs = 36 * 3600 * 1000;
  
  // Save the chart start time to state so the real-time clock tracker can align to it
  state.plotStartMs = startMs;
  
  // Step 1: Draw the smooth tide curve over the 36-hour window
  const steps = 240;
  let strokePathD = '';
  let walkablePathD = '';
  let warningPathD = '';
  let dangerPathD = '';
  
  let prevX = null;
  let prevY = null;
  let prevType = 'none';
  
  for (let i = 0; i <= steps; i++) {
    const tMs = startMs + (i / steps) * durationMs;
    const x = (i / steps) * 1000;
    const value = getTideHeightAtTime(tMs);
    const y = getSvgYCoordinate(value);
    
    if (i === 0) {
      strokePathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      strokePathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    
    // Determine path type (< 4.0 ft with warning colors when rising)
    let currentType = 'none';
    if (value < 4.0) {
      // Check slope of tide (5 minutes ahead) to see if rising
      const isRising = getTideHeightAtTime(tMs + 5 * 60 * 1000) > value;
      if (isRising) {
        if (value >= 3.0) {
          currentType = 'danger';
        } else if (value >= 2.0) {
          currentType = 'warning';
        } else {
          currentType = 'walkable';
        }
      } else {
        currentType = 'walkable';
      }
    }
    
    // Construct paths with seamless bridging transitions
    if (currentType !== 'none') {
      if (currentType === 'walkable') {
        if (prevType !== 'walkable' && prevX !== null) {
          walkablePathD += ` M ${prevX.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
        } else if (prevType !== 'walkable') {
          walkablePathD += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
        } else {
          walkablePathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      } else if (currentType === 'warning') {
        if (prevType !== 'warning' && prevX !== null) {
          warningPathD += ` M ${prevX.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
        } else if (prevType !== 'warning') {
          warningPathD += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
        } else {
          warningPathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      } else if (currentType === 'danger') {
        if (prevType !== 'danger' && prevX !== null) {
          dangerPathD += ` M ${prevX.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
        } else if (prevType !== 'danger') {
          dangerPathD += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
        } else {
          dangerPathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      }
    }
    
    prevX = x;
    prevY = y;
    prevType = currentType;
  }
  
  // Set stroke paths
  elements.waveStrokePath.setAttribute('d', strokePathD);
  elements.waveWalkablePath.setAttribute('d', walkablePathD);
  elements.waveWarningPath.setAttribute('d', warningPathD);
  elements.waveDangerPath.setAttribute('d', dangerPathD);
  
  // Set area fill path definition (closed at bottom-right 1000,400 and bottom-left 0,400)
  const fillPathD = strokePathD + ' L 1000 400 L 0 400 Z';
  elements.waveFillPath.setAttribute('d', fillPathD);
  
  // Step 2: Filter Extrema Peaks & Troughs inside the displayed 36-hour window
  const highs = [];
  const lows = [];
  
  const displayedExtremes = (state.tideExtremes || []).filter(pt => {
    return pt.timeMs >= startMs && pt.timeMs <= endMs;
  });
  
  displayedExtremes.forEach(pt => {
    if (pt.type === 'H' || pt.type === 'High') {
      highs.push({ val: pt.value, timeMs: pt.timeMs });
    } else if (pt.type === 'L' || pt.type === 'Low') {
      lows.push({ val: pt.value, timeMs: pt.timeMs });
    }
  });
  
  // Step 3: Draw HTML overlay tags for peaks & troughs
  elements.tideOverlayLabels.innerHTML = '';
  const suffix = state.units === 'english' ? 'FT' : 'M';
  
  // Step 3a: Draw Day Boundary Visuals (Midnight lines and next-day shading)
  const tempDate = new Date(startMs);
  tempDate.setHours(0, 0, 0, 0); // Start at midnight of the day startMs falls in
  
  while (tempDate.getTime() <= endMs) {
    const midnightMs = tempDate.getTime();
    if (midnightMs >= startMs) {
      const xPct = ((midnightMs - startMs) / durationMs) * 100;
      
      // Calculate non-overlapping width for the shading block
      const nextMidnightMs = midnightMs + 24 * 3600 * 1000;
      const endOfShadingMs = Math.min(nextMidnightMs, endMs);
      const widthPct = ((endOfShadingMs - midnightMs) / durationMs) * 100;
      
      // 1. Shading overlay for the next day
      const shading = document.createElement('div');
      shading.className = 'day-shading-tomorrow';
      shading.style.left = `${xPct}%`;
      shading.style.width = `${widthPct}%`;
      elements.tideOverlayLabels.appendChild(shading);
      
      // 2. Vertical line at midnight
      const line = document.createElement('div');
      line.className = 'day-boundary-line';
      line.style.left = `${xPct}%`;
      elements.tideOverlayLabels.appendChild(line);
    }
    // Advance by 1 day
    tempDate.setDate(tempDate.getDate() + 1);
  }
  
  const formatTime = (timeMs) => {
    const dateObj = new Date(timeMs);
    let hrs = dateObj.getHours();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12;
    const mins = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins} ${ampm}`;
  };
  
  // Render High Tide tags
  highs.forEach(high => {
    const x = ((high.timeMs - startMs) / durationMs) * 1000;
    const y = getSvgYCoordinate(high.val);
    
    const label = document.createElement('div');
    label.className = 'tide-callout high';
    label.style.left = `${(x / 1000) * 100}%`;
    label.style.top = `${((y - 30) / 400) * 100}%`;
    
    label.innerHTML = `
      <span class="tide-callout-text">H: +${high.val.toFixed(1)} ${suffix}</span>
      <span class="tide-callout-sub">${formatTime(high.timeMs)}</span>
    `;
    elements.tideOverlayLabels.appendChild(label);
  });
  
  // Render Low Tide tags
  lows.forEach(low => {
    const x = ((low.timeMs - startMs) / durationMs) * 1000;
    const y = getSvgYCoordinate(low.val);
    
    const label = document.createElement('div');
    label.className = 'tide-callout low';
    label.style.left = `${(x / 1000) * 100}%`;
    label.style.top = `${((y + 30) / 400) * 100}%`;
    
    label.innerHTML = `
      <span class="tide-callout-text">L: ${low.val.toFixed(1)} ${suffix}</span>
      <span class="tide-callout-sub">${formatTime(low.timeMs)}</span>
    `;
    elements.tideOverlayLabels.appendChild(label);
  });
  
  // Step 4: Dynamically generate absolute timeline clock ticks every 4 hours relative to startMs
  elements.timelineLabels.innerHTML = '';
  const startHourTime = new Date(startMs);
  const hour = startHourTime.getHours();
  const alignedHour = Math.floor(hour / 4) * 4;
  startHourTime.setHours(alignedHour, 0, 0, 0);
  const alignedStartMs = startHourTime.getTime();
  
  for (let tMs = alignedStartMs; tMs <= endMs; tMs += 4 * 3600 * 1000) {
    if (tMs < startMs) continue;
    
    const xPct = ((tMs - startMs) / durationMs) * 100;
    const dateObj = new Date(tMs);
    
    let hrs = dateObj.getHours();
    const ampm = hrs >= 12 ? 'p' : 'a';
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12;
    
    const isNow = Math.abs(tMs - nowMs) < 1.5 * 3600 * 1000;
    const isMidnight = dateObj.getHours() === 0;
    
    const tickDiv = document.createElement('div');
    tickDiv.className = 'time-tick';
    
    if (isNow && !elements.timelineLabels.querySelector('.tick-now')) {
      tickDiv.textContent = 'NOW';
      tickDiv.classList.add('tick-now');
      tickDiv.style.left = '33.33%';
    } else if (isMidnight) {
      tickDiv.classList.add('day-change');
      
      const timeSpan = document.createElement('div');
      timeSpan.textContent = '12a';
      tickDiv.appendChild(timeSpan);
      
      const daySpan = document.createElement('div');
      daySpan.className = 'tick-day-label';
      const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
      daySpan.textContent = dateObj.toLocaleDateString('en-US', dateOptions).toUpperCase();
      tickDiv.appendChild(daySpan);
      
      tickDiv.style.left = `${xPct}%`;
    } else {
      tickDiv.textContent = `${hrs}${ampm}`;
      tickDiv.style.left = `${xPct}%`;
    }
    
    tickDiv.style.position = 'absolute';
    tickDiv.style.transform = 'translateX(-50%)';
    elements.timelineLabels.appendChild(tickDiv);
  }
}

// Start sliding marquee timer for forecast ticker (clears and sets vertical offset)
let tickerIndex = 0;
function startForecastTickerAnimation(totalItems) {
  if (window.forecastTickerInterval) {
    clearInterval(window.forecastTickerInterval);
  }
  
  tickerIndex = 0;
  elements.forecastScrollWrapper.style.transform = 'translateY(0)';
  
  if (totalItems <= 1) return;
  
  window.forecastTickerInterval = setInterval(() => {
    tickerIndex = (tickerIndex + 1) % totalItems;
    elements.forecastScrollWrapper.style.transform = `translateY(-${tickerIndex * 60}px)`;
  }, 6000);
}

// Start application when page loads
window.addEventListener('DOMContentLoaded', init);
