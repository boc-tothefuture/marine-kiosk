// Tide Clock TV UI Application State
const state = {
  stationId: '8418150',
  stationName: 'PORTLAND, MAINE',
  dateStr: '',
  tideHeights: [], // Array of {hour, value}
  units: 'english',
  datum: 'MLLW',
  lastUpdated: null,
  waterTemp: null,
  connectionOnline: true,
  
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
  currentTideVal: document.getElementById('current-tide-val'),
  currentTideUnit: document.getElementById('current-tide-unit'),
  tideStatusText: document.getElementById('tide-status-text'),
  pulseDot: document.getElementById('status-pulse-dot'),
  waterTempContainer: document.getElementById('water-temp-container'),
  waterTempVal: document.getElementById('water-temp-val'),
  datumInfo: document.getElementById('datum-info'),
  lastUpdatedText: document.getElementById('last-updated-text'),
  
  // SVG Canvas elements
  tideSvg: document.getElementById('tide-svg'),
  waveFillPath: document.getElementById('wave-fill-path'),
  waveStrokePath: document.getElementById('wave-stroke-path'),
  nowMarkerLine: document.getElementById('now-marker-line'),
  nowMarkerGlow: document.getElementById('now-marker-glow'),
  nowMarkerDot: document.getElementById('now-marker-dot'),
  tideOverlayLabels: document.getElementById('tide-overlay-labels'),
  
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
  elements.nowMarkerDot.setAttribute('stroke', colorHex);
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
  
  // Update the line position and active readout based on fractional hour
  updateNowTracker(now);
}

// Cosine Interpolation for smooth curve calculations
function cosineInterpolate(y1, y2, mu) {
  const mu2 = (1 - Math.cos(mu * Math.PI)) / 2;
  return y1 * (1 - mu2) + y2 * mu2;
}

// Get tide height at any fractional hour of the day (0.0 to 24.0)
function getTideHeightAtHour(fractionalHour) {
  if (state.tideHeights.length === 0) return 0.0;
  
  const h1 = Math.floor(fractionalHour) % 24;
  const h2 = (h1 + 1) % 24;
  const mu = fractionalHour - Math.floor(fractionalHour);
  
  const pt1 = state.tideHeights.find(pt => pt.hour === h1);
  const pt2 = state.tideHeights.find(pt => pt.hour === h2);
  
  const v1 = pt1 ? pt1.value : 0.0;
  const v2 = pt2 ? pt2.value : 0.0;
  
  return cosineInterpolate(v1, v2, mu);
}

// Update real-time tide markers (Dashed line, dot position, and current reading values)
function updateNowTracker(now) {
  if (state.tideHeights.length === 0) return;
  
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentSec = now.getSeconds();
  
  // Fractional hour of the day (0.0 - 24.0)
  const fracHour = currentHour + currentMin / 60 + currentSec / 3600;
  
  // X Coordinate of current time: map 0-24 hours to SVG width 1000
  const xNow = (fracHour / 24) * 1000;
  
  // Interpolated current tide value
  const currentTideHeight = getTideHeightAtHour(fracHour);
  
  // Map this value to SVG Y Coordinate
  const yNow = getSvgYCoordinate(currentTideHeight);
  
  // Move vertical line, glow ring, & dot in SVG
  elements.nowMarkerLine.setAttribute('x1', xNow);
  elements.nowMarkerLine.setAttribute('x2', xNow);
  elements.nowMarkerGlow.setAttribute('cx', xNow);
  elements.nowMarkerGlow.setAttribute('cy', yNow);
  elements.nowMarkerDot.setAttribute('cx', xNow);
  elements.nowMarkerDot.setAttribute('cy', yNow);
  
  // Update Top-Right readouts
  const sign = currentTideHeight >= 0 ? '+' : '';
  elements.currentTideVal.textContent = `${sign}${currentTideHeight.toFixed(1)}`;
  
  // Determine if tide is rising or falling (slope check 5 minutes into the future)
  const checkFrac = (fracHour + 0.083) % 24; // +5 minutes
  const futureVal = getTideHeightAtHour(checkFrac);
  
  if (futureVal > currentTideHeight) {
    elements.tideStatusText.innerHTML = 'RISING TIDE <span class="tide-arrow">↑</span>';
  } else {
    elements.tideStatusText.innerHTML = 'FALLING TIDE <span class="tide-arrow">↓</span>';
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

// Generate simulated tide data (double sine wave approximation)
function generateSimulatedTide() {
  const now = new Date();
  const heights = [];
  
  for (let hour = 0; hour < 24; hour++) {
    // Normal Portland ME MLLW tides have 9-10ft ranges
    const semiDiurnal = Math.sin((2 * Math.PI * (hour - 3.0)) / 12.42);
    const diurnal = 0.8 * Math.sin((2 * Math.PI * (hour - 7.0)) / 24.84);
    const value = 4.8 + 4.1 * semiDiurnal + diurnal;
    
    heights.push({
      hour: hour,
      value: Math.round(value * 1000) / 1000
    });
  }
  
  state.stationName = 'PORTLAND, ME (SIMULATED)';
  state.units = 'english';
  state.datum = 'MLLW';
  state.dateStr = now.toISOString().split('T')[0];
  state.tideHeights = heights;
  state.waterTemp = 59.5;
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
    state.tideHeights = data.tide_heights;
    state.units = data.units || 'english';
    state.datum = data.datum || 'MLLW';
    state.waterTemp = data.water_temp;
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
  elements.datumInfo.textContent = `DATUM: ${state.datum}`;
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
  
  renderWavePlot();
  updateTime(); // Force time update
}

// Render vector SVG wave line, SVG area fill, and callout overlays
function renderWavePlot() {
  if (state.tideHeights.length === 0) return;
  
  // Step 1: Draw the smooth tide curve
  // We evaluate 240 coordinates across the 24-hour horizontal space (X: 0 to 1000)
  const steps = 240;
  let strokePathD = '';
  
  for (let i = 0; i <= steps; i++) {
    const fracHour = (i / steps) * 24;
    const x = (fracHour / 24) * 1000;
    const value = getTideHeightAtHour(fracHour);
    const y = getSvgYCoordinate(value);
    
    if (i === 0) {
      strokePathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      strokePathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  
  // Set stroke path path definition
  elements.waveStrokePath.setAttribute('d', strokePathD);
  
  // Set area fill path definition (closed at bottom-right 1000,400 and bottom-left 0,400)
  const fillPathD = strokePathD + ' L 1000 400 L 0 400 Z';
  elements.waveFillPath.setAttribute('d', fillPathD);
  
  // Step 2: Calculate Extrema Peaks & Troughs
  const highs = [];
  const lows = [];
  const len = state.tideHeights.length;
  
  for (let i = 0; i < len; i++) {
    const prev = state.tideHeights[(i - 1 + len) % len].value;
    const curr = state.tideHeights[i].value;
    const next = state.tideHeights[(i + 1) % len].value;
    const hour = state.tideHeights[i].hour;
    
    if (curr > prev && curr > next) {
      highs.push({ val: curr, hour: hour });
    }
    if (curr < prev && curr < next) {
      lows.push({ val: curr, hour: hour });
    }
  }
  
  // Step 3: Draw HTML overlay tags for peaks & troughs
  elements.tideOverlayLabels.innerHTML = '';
  const suffix = state.units === 'english' ? 'FT' : 'M';
  
  const formatHour = (h) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    let displayH = h % 12;
    displayH = displayH ? displayH : 12;
    return `${displayH}:00 ${ampm}`;
  };
  
  // Render High Tide tags (placed above the peak)
  highs.forEach(high => {
    const x = (high.hour / 24) * 1000;
    const y = getSvgYCoordinate(high.val);
    
    const label = document.createElement('div');
    label.className = 'tide-callout high';
    label.style.left = `${(x / 1000) * 100}%`;
    label.style.top = `${((y - 30) / 400) * 100}%`; // Offset 30px above the peak
    
    label.innerHTML = `
      <span class="tide-callout-text">H: +${high.val.toFixed(1)} ${suffix}</span>
      <span class="tide-callout-sub">${formatHour(high.hour)}</span>
    `;
    elements.tideOverlayLabels.appendChild(label);
  });
  
  // Render Low Tide tags (placed below the trough)
  lows.forEach(low => {
    const x = (low.hour / 24) * 1000;
    const y = getSvgYCoordinate(low.val);
    
    const label = document.createElement('div');
    label.className = 'tide-callout low';
    label.style.left = `${(x / 1000) * 100}%`;
    label.style.top = `${((y + 30) / 400) * 100}%`; // Offset 30px below the trough
    
    label.innerHTML = `
      <span class="tide-callout-text">L: ${low.val.toFixed(1)} ${suffix}</span>
      <span class="tide-callout-sub">${formatHour(low.hour)}</span>
    `;
    elements.tideOverlayLabels.appendChild(label);
  });
}

// Start application when page loads
window.addEventListener('DOMContentLoaded', init);
