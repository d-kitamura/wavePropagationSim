const FIELD_CYCLES = 24;
const FIELD_REFERENCE_FREQ = 400;
const DEFAULT_SOURCE_FREQ = 100;
const DEFAULT_C = 340;
const FIELD_SIZE = FIELD_CYCLES * (DEFAULT_C / FIELD_REFERENCE_FREQ);
const MAX_SOURCES = 20;
const GRID = 160;
const HISTORY = 320;
const MAX_PROBES = 4;
const EPS = 0.08;
const TWO_PI = Math.PI * 2;

const el = (id) => document.getElementById(id);
const fieldCanvas = el("fieldCanvas");
const overlayCanvas = el("overlayCanvas");
const xAxisCanvas = el("xAxisCanvas");
const yAxisCanvas = el("yAxisCanvas");
const scopeCanvas = el("scopeCanvas");
const spectrumCanvas = el("spectrumCanvas");
const fctx = fieldCanvas.getContext("2d", { willReadFrequently: true });
const octx = overlayCanvas.getContext("2d");
const xctx = xAxisCanvas.getContext("2d");
const yctx = yAxisCanvas.getContext("2d");
const sctx = scopeCanvas.getContext("2d");
const spctx = spectrumCanvas.getContext("2d");

const ui = {
  language: el("languageSelect"),
  sourceMode: el("sourceModeBtn"),
  probeMode: el("probeModeBtn"),
  displayMode: el("displayMode"),
  colorScale: el("colorScale"),
  fixedMin: el("fixedMin"),
  fixedMax: el("fixedMax"),
  colormap: el("colormap"),
  contours: el("contours"),
  timeScale: el("timeScale"),
  timeScaleValue: el("timeScaleValue"),
  attenuation: el("attenuation"),
  soundSpeed: el("soundSpeed"),
  temperature: el("temperature"),
  preset: el("presetSelect"),
  beamControls: el("beamControls"),
  beamAngle: el("beamAngle"),
  beamAngleValue: el("beamAngleValue"),
  beamControlMode: el("beamControlMode"),
  gridSnap: el("gridSnap"),
  snapStep: el("snapStep"),
  randomize: el("randomizeBtn"),
  resetPhases: el("resetPhasesBtn"),
  selectedInfo: el("selectedInfo"),
  srcAmp: el("srcAmp"),
  srcFreq: el("srcFreq"),
  srcWave: el("srcWave"),
  srcPhase: el("srcPhase"),
  srcDelay: el("srcDelay"),
  srcControl: el("srcControl"),
  mute: el("muteBtn"),
  solo: el("soloBtn"),
  delete: el("deleteBtn"),
  sourceList: el("sourceList"),
  probeTable: el("probeTable"),
  playPause: el("playPauseBtn"),
  step: el("stepBtn"),
  reset: el("resetBtn"),
  status: el("statusLine"),
  legendMin: el("legendMin"),
  legendMax: el("legendMax"),
};

const labels = {
  en: {
    title: "Wave Propagation Simulator",
    language: "Language",
    sourceMode: "Source mode",
    probeMode: "Probe mode",
    display: "Display",
    colorScale: "Color scale",
    fixedMin: "Fixed min",
    fixedMax: "Fixed max",
    colormap: "Colormap",
    contours: "Contours / nodal lines",
    timeScale: "Time scale",
    attenuation: "Attenuation",
    soundSpeed: "Sound speed [m/s]",
    temperature: "Temperature [C]",
    preset: "Preset",
    beamAngle: "Steering angle [deg]",
    controlMode: "Control",
    gridSnap: "Grid snap",
    snapStep: "Snap step [m]",
    randomize: "Randomize phases",
    resetPhases: "Reset phases",
    selectedSource: "Selected source",
    amplitude: "Amplitude",
    frequency: "Frequency [Hz]",
    wavelength: "Wavelength [m]",
    phase: "Phase [rad]",
    delay: "Delay [s]",
    sourceControl: "Control",
    sources: "Sources",
    probes: "Observation",
    noSource: "No source selected.",
  },
  ja: {
    title: "音波伝搬シミュレータ",
    language: "言語",
    sourceMode: "点音源配置",
    probeMode: "音圧観測",
    display: "表示",
    colorScale: "色スケール",
    fixedMin: "固定最小値",
    fixedMax: "固定最大値",
    colormap: "カラーマップ",
    contours: "等高線 / 節線",
    timeScale: "時間速度",
    attenuation: "減衰",
    soundSpeed: "音速 [m/s]",
    temperature: "室温 [℃]",
    preset: "プリセット",
    beamAngle: "ステアリング角 [deg]",
    controlMode: "制御方式",
    gridSnap: "グリッド吸着",
    snapStep: "吸着間隔 [m]",
    randomize: "位相をランダム化",
    resetPhases: "位相をリセット",
    selectedSource: "選択中の音源",
    amplitude: "振幅",
    frequency: "周波数 [Hz]",
    wavelength: "波長 [m]",
    phase: "位相 [rad]",
    delay: "遅延 [s]",
    sourceControl: "制御",
    sources: "音源",
    probes: "観測",
    noSource: "音源が選択されていません。",
  },
};

const presetLabels = {
  en: {
    "": "Manual",
    single: "Single center source",
    twoPhase: "Two sources in phase",
    twoOpposite: "Two sources opposite phase",
    dipole: "Dipole",
    quadrupole: "Quadrupole",
    verticalLine: "Vertical line array",
    horizontalLine: "Horizontal line array",
    beam: "Beam steering",
    grating: "Grating lobes",
    circular: "Circular array",
    focus: "Circular focusing",
    random: "Random phase array",
    moving: "Moving source",
  },
  ja: {
    "": "手動配置",
    single: "中央1音源",
    twoPhase: "2音源 同相",
    twoOpposite: "2音源 逆相",
    dipole: "ダイポール",
    quadrupole: "四重極",
    verticalLine: "垂直ラインアレイ",
    horizontalLine: "水平ラインアレイ",
    beam: "ビームステアリング",
    grating: "グレーティングローブ",
    circular: "円形アレイ",
    focus: "円形フォーカシング",
    random: "ランダム位相アレイ",
    moving: "移動音源",
  },
};

let state = {
  sources: [],
  probes: [],
  selectedSource: null,
  selectedProbe: null,
  mode: "source",
  time: 0,
  playing: true,
  lastFrame: performance.now(),
  nextId: 1,
  nextProbeId: 1,
  dragging: null,
  dragMoved: false,
  pointers: new Map(),
  pinching: false,
  pinchStartDistance: 0,
  pinchStartZoom: 1,
  soundSpeed: DEFAULT_C,
  timeScale: 0.01,
  viewZoom: 1,
};

function sourceColor(i) {
  const colors = ["#22c55e", "#38bdf8", "#f97316", "#e879f9", "#fde047", "#fb7185", "#a3e635", "#60a5fa"];
  return colors[i % colors.length];
}

function soundSpeedToTemp(c) {
  return ((c - 331.3) / 0.606).toFixed(1);
}

function tempToSoundSpeed(t) {
  return 331.3 + 0.606 * t;
}

function visibleSize() {
  return FIELD_SIZE / state.viewZoom;
}

function setZoom(zoom) {
  state.viewZoom = Math.max(1, Math.min(12, zoom));
}

function resetTime() {
  state.time = 0;
  for (const p of state.probes) p.history = [];
}

function worldToCanvas(x, y) {
  const size = visibleSize();
  return {
    x: ((x + size / 2) / size) * overlayCanvas.width,
    y: ((size / 2 - y) / size) * overlayCanvas.height,
  };
}

function canvasToWorld(px, py) {
  const rect = overlayCanvas.getBoundingClientRect();
  const x = ((px - rect.left) / rect.width) * overlayCanvas.width;
  const y = ((py - rect.top) / rect.height) * overlayCanvas.height;
  const size = visibleSize();
  let wx = (x / overlayCanvas.width) * size - size / 2;
  let wy = size / 2 - (y / overlayCanvas.height) * size;
  if (ui.gridSnap.checked) {
    const step = Math.max(0.01, Number(ui.snapStep.value) || (state.soundSpeed / DEFAULT_SOURCE_FREQ) / 4);
    wx = Math.round(wx / step) * step;
    wy = Math.round(wy / step) * step;
  }
  return {
    x: Math.max(-FIELD_SIZE / 2, Math.min(FIELD_SIZE / 2, wx)),
    y: Math.max(-FIELD_SIZE / 2, Math.min(FIELD_SIZE / 2, wy)),
  };
}

function activeSources() {
  const solos = state.sources.filter((s) => s.solo);
  const base = solos.length ? solos : state.sources;
  return base.filter((s) => !s.mute);
}

function attenuation(r) {
  const rr = r + EPS;
  if (ui.attenuation.value === "inverse") return 1 / rr;
  if (ui.attenuation.value === "sqrt") return 1 / Math.sqrt(rr);
  return 1;
}

function sourceSignal(src, x, y, t) {
  const dx = x - src.x;
  const dy = y - src.y;
  const r = Math.hypot(dx, dy);
  const travel = r / state.soundSpeed;
  const phasePart = src.control === "delay" ? -TWO_PI * src.frequency * src.delay : src.phase;
  return src.amplitude * attenuation(r) * Math.sin(TWO_PI * src.frequency * (t - travel) + phasePart);
}

function pressureAt(x, y, t) {
  let sum = 0;
  for (const src of activeSources()) sum += sourceSignal(src, x, y, t);
  return sum;
}

function rmsAt(x, y) {
  const srcs = activeSources();
  if (!srcs.length) return 0;
  const f0 = Math.max(1, Math.min(...srcs.map((s) => s.frequency)));
  const period = 1 / f0;
  let sum = 0;
  const n = 20;
  for (let i = 0; i < n; i++) {
    const p = pressureAt(x, y, state.time + (i / n) * period);
    sum += p * p;
  }
  return Math.sqrt(sum / n);
}

function addSource(x, y, opts = {}) {
  if (state.sources.length >= MAX_SOURCES) return null;
  const id = state.nextId++;
  const src = {
    id,
    x,
    y,
    amplitude: opts.amplitude ?? 1,
    frequency: opts.frequency ?? DEFAULT_SOURCE_FREQ,
    phase: opts.phase ?? 0,
    delay: opts.delay ?? 0,
    control: opts.control ?? "phase",
    mute: false,
    solo: false,
    moving: opts.moving ?? false,
    movingDirection: opts.movingDirection ?? 1,
    movingSpeed: opts.movingSpeed ?? 2.4,
    color: sourceColor(id - 1),
  };
  state.sources.push(src);
  state.selectedSource = id;
  resetTime();
  syncSelected();
  renderSourceList();
  return src;
}

function addProbe(x, y) {
  if (state.probes.length >= MAX_PROBES) return null;
  const probe = {
    id: state.nextProbeId++,
    x,
    y,
    color: sourceColor(state.nextProbeId + 2),
    history: [],
  };
  state.probes.push(probe);
  state.selectedProbe = probe.id;
  return probe;
}

function deleteSelected() {
  if (state.selectedSource == null) return;
  state.sources = state.sources.filter((s) => s.id !== state.selectedSource);
  state.selectedSource = state.sources[0]?.id ?? null;
  resetTime();
  syncSelected();
  renderSourceList();
}

function findSource(x, y) {
  let found = null;
  let best = 16;
  for (const src of state.sources) {
    const p = worldToCanvas(src.x, src.y);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < best) {
      best = d;
      found = src;
    }
  }
  return found;
}

function findProbe(x, y) {
  let found = null;
  let best = 14;
  for (const probe of state.probes) {
    const p = worldToCanvas(probe.x, probe.y);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < best) {
      best = d;
      found = probe;
    }
  }
  return found;
}

function resizeCanvases() {
  const size = Math.floor(Math.min(fieldCanvas.clientWidth, fieldCanvas.clientHeight) * devicePixelRatio);
  for (const c of [fieldCanvas, overlayCanvas]) {
    if (c.width !== size) {
      c.width = size;
      c.height = size;
    }
  }
  const axisW = Math.max(1, Math.floor(xAxisCanvas.clientWidth * devicePixelRatio));
  const axisH = Math.max(1, Math.floor(xAxisCanvas.clientHeight * devicePixelRatio));
  if (xAxisCanvas.width !== axisW || xAxisCanvas.height !== axisH) {
    xAxisCanvas.width = axisW;
    xAxisCanvas.height = axisH;
  }
  const yAxisW = Math.max(1, Math.floor(yAxisCanvas.clientWidth * devicePixelRatio));
  const yAxisH = Math.max(1, Math.floor(yAxisCanvas.clientHeight * devicePixelRatio));
  if (yAxisCanvas.width !== yAxisW || yAxisCanvas.height !== yAxisH) {
    yAxisCanvas.width = yAxisW;
    yAxisCanvas.height = yAxisH;
  }
}

function niceTickStep(size) {
  const target = size / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const norm = target / pow;
  const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return mult * pow;
}

function drawAxes() {
  const size = visibleSize();
  const step = niceTickStep(size);
  xctx.clearRect(0, 0, xAxisCanvas.width, xAxisCanvas.height);
  yctx.clearRect(0, 0, yAxisCanvas.width, yAxisCanvas.height);
  xctx.strokeStyle = yctx.strokeStyle = "#596574";
  xctx.fillStyle = yctx.fillStyle = "#aeb8c5";
  xctx.font = yctx.font = `${11 * devicePixelRatio}px sans-serif`;
  xctx.textAlign = "center";
  xctx.textBaseline = "top";
  yctx.textAlign = "right";
  yctx.textBaseline = "middle";

  xctx.beginPath();
  xctx.moveTo(0, 0.5 * devicePixelRatio);
  xctx.lineTo(xAxisCanvas.width, 0.5 * devicePixelRatio);
  xctx.stroke();
  yctx.beginPath();
  yctx.moveTo(yAxisCanvas.width - 0.5 * devicePixelRatio, 0);
  yctx.lineTo(yAxisCanvas.width - 0.5 * devicePixelRatio, yAxisCanvas.height);
  yctx.stroke();

  for (let v = -Math.ceil(size / 2 / step) * step; v <= size / 2 + step * 0.5; v += step) {
    const px = worldToCanvas(v, 0).x / overlayCanvas.width * xAxisCanvas.width;
    xctx.beginPath();
    xctx.moveTo(px, 0);
    xctx.lineTo(px, 6 * devicePixelRatio);
    xctx.stroke();
    xctx.textAlign = px < 28 * devicePixelRatio ? "left" : px > xAxisCanvas.width - 28 * devicePixelRatio ? "right" : "center";
    xctx.fillText(`${Math.abs(v) < 1e-9 ? 0 : v.toFixed(step < 1 ? 1 : 0)} m`, px, 9 * devicePixelRatio);

    const py = worldToCanvas(0, v).y / overlayCanvas.height * yAxisCanvas.height;
    yctx.beginPath();
    yctx.moveTo(yAxisCanvas.width - 6 * devicePixelRatio, py);
    yctx.lineTo(yAxisCanvas.width, py);
    yctx.stroke();
    yctx.fillText(`${Math.abs(v) < 1e-9 ? 0 : v.toFixed(step < 1 ? 1 : 0)} m`, yAxisCanvas.width - 9 * devicePixelRatio, py);
  }
}

function mapColor(v, min, max) {
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (v - min) / (max - min)));
  if (ui.colormap.value === "thermal") {
    return interpStops(t, [[0, 8, 13, 30], [0.35, 38, 91, 168], [0.62, 247, 183, 51], [1, 255, 245, 204]]);
  }
  if (ui.colormap.value === "viridis") {
    return interpStops(t, [[0, 68, 1, 84], [0.35, 49, 104, 142], [0.7, 53, 183, 121], [1, 253, 231, 37]]);
  }
  return interpStops(t, [[0, 48, 85, 212], [0.5, 244, 247, 251], [1, 198, 41, 53]]);
}

function interpStops(t, stops) {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const u = (t - a[0]) / (b[0] - a[0]);
      return [
        Math.round(a[1] + (b[1] - a[1]) * u),
        Math.round(a[2] + (b[2] - a[2]) * u),
        Math.round(a[3] + (b[3] - a[3]) * u),
      ];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

function drawField() {
  resizeCanvases();
  const img = fctx.createImageData(GRID, GRID);
  const values = new Float32Array(GRID * GRID);
  let min = Infinity;
  let max = -Infinity;
  const mode = ui.displayMode.value;
  const size = visibleSize();
  for (let j = 0; j < GRID; j++) {
    const y = size / 2 - (j / (GRID - 1)) * size;
    for (let i = 0; i < GRID; i++) {
      const x = (i / (GRID - 1)) * size - size / 2;
      let v = mode === "rms" ? rmsAt(x, y) : pressureAt(x, y, state.time);
      if (mode === "spl") v = 20 * Math.log10(Math.max(rmsAt(x, y), 1e-5) / 2e-5);
      const k = j * GRID + i;
      values[k] = v;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (ui.colorScale.value === "fixed") {
    min = Number(ui.fixedMin.value);
    max = Number(ui.fixedMax.value);
  } else if (mode === "instant") {
    const m = Math.max(Math.abs(min), Math.abs(max), 1e-6);
    min = -m;
    max = m;
  } else if (!Number.isFinite(min) || max <= min) {
    min = 0;
    max = 1;
  }
  for (let k = 0; k < values.length; k++) {
    const [r, g, b] = mapColor(values[k], min, max);
    img.data[k * 4] = r;
    img.data[k * 4 + 1] = g;
    img.data[k * 4 + 2] = b;
    img.data[k * 4 + 3] = 255;
  }
  const off = document.createElement("canvas");
  off.width = GRID;
  off.height = GRID;
  off.getContext("2d").putImageData(img, 0, 0);
  fctx.imageSmoothingEnabled = true;
  fctx.drawImage(off, 0, 0, fieldCanvas.width, fieldCanvas.height);
  if (ui.contours.checked) drawContours(values, min, max, mode);
  ui.legendMin.textContent = formatLegend(min, mode);
  ui.legendMax.textContent = formatLegend(max, mode);
}

function formatLegend(v, mode) {
  if (mode === "spl") return `${v.toFixed(0)} dB`;
  return Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}

function drawContours(values, min, max, mode) {
  fctx.save();
  fctx.scale(fieldCanvas.width / GRID, fieldCanvas.height / GRID);
  fctx.lineWidth = 0.45;
  fctx.globalAlpha = 0.75;
  const levels = mode === "instant" ? [0] : [min + (max - min) * 0.18, min + (max - min) * 0.34, min + (max - min) * 0.5];
  for (const level of levels) {
    fctx.strokeStyle = mode === "instant" ? "rgba(255,255,255,.9)" : "rgba(10,14,20,.55)";
    fctx.beginPath();
    for (let y = 0; y < GRID - 1; y++) {
      for (let x = 0; x < GRID - 1; x++) {
        const a = values[y * GRID + x] - level;
        const b = values[y * GRID + x + 1] - level;
        const c = values[(y + 1) * GRID + x] - level;
        if (a === 0 || a * b < 0 || a * c < 0) {
          fctx.moveTo(x, y);
          fctx.lineTo(x + 1, y);
        }
      }
    }
    fctx.stroke();
  }
  fctx.restore();
}

function drawOverlay() {
  const w = overlayCanvas.width;
  const h = overlayCanvas.height;
  const size = visibleSize();
  octx.clearRect(0, 0, w, h);
  octx.strokeStyle = "rgba(255,255,255,.18)";
  octx.lineWidth = 1;
  octx.beginPath();
  const gridStep = DEFAULT_C / FIELD_REFERENCE_FREQ;
  for (let v = -Math.ceil(size / 2 / gridStep) * gridStep; v <= size / 2 + gridStep * 0.5; v += gridStep) {
    const px = worldToCanvas(v, 0).x;
    const py = worldToCanvas(0, v).y;
    octx.moveTo(px, 0); octx.lineTo(px, h);
    octx.moveTo(0, py); octx.lineTo(w, py);
  }
  octx.stroke();
  octx.strokeStyle = "rgba(255,255,255,.45)";
  octx.beginPath();
  octx.moveTo(w / 2, 0); octx.lineTo(w / 2, h);
  octx.moveTo(0, h / 2); octx.lineTo(w, h / 2);
  octx.stroke();

  state.sources.forEach((src, index) => {
    const p = worldToCanvas(src.x, src.y);
    octx.beginPath();
    octx.fillStyle = src.mute ? "#64748b" : src.color;
    octx.strokeStyle = state.selectedSource === src.id ? "#ffffff" : "rgba(0,0,0,.65)";
    octx.lineWidth = state.selectedSource === src.id ? 5 : 2;
    octx.arc(p.x, p.y, state.selectedSource === src.id ? 10 : 7, 0, TWO_PI);
    octx.fill();
    octx.stroke();
    octx.fillStyle = "#071018";
    octx.font = `${12 * devicePixelRatio}px sans-serif`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillText(String(index + 1), p.x, p.y);
  });

  state.probes.forEach((probe, index) => {
    const p = worldToCanvas(probe.x, probe.y);
    octx.strokeStyle = probe.color;
    octx.lineWidth = 3;
    octx.beginPath();
    octx.moveTo(p.x - 9, p.y); octx.lineTo(p.x + 9, p.y);
    octx.moveTo(p.x, p.y - 9); octx.lineTo(p.x, p.y + 9);
    octx.stroke();
    octx.fillStyle = probe.color;
    octx.fillText(`P${index + 1}`, p.x + 18, p.y - 12);
  });
}

function drawScope() {
  const w = scopeCanvas.width;
  const h = scopeCanvas.height;
  sctx.clearRect(0, 0, w, h);
  sctx.strokeStyle = "#263241";
  sctx.lineWidth = 1;
  sctx.beginPath();
  sctx.moveTo(0, h / 2); sctx.lineTo(w, h / 2);
  for (let i = 0; i < 8; i++) {
    const x = (i / 8) * w;
    sctx.moveTo(x, 0); sctx.lineTo(x, h);
  }
  sctx.stroke();
  let peak = 1e-6;
  for (const p of state.probes) for (const v of p.history) peak = Math.max(peak, Math.abs(v));
  state.probes.forEach((probe) => {
    sctx.strokeStyle = probe.color;
    sctx.lineWidth = 2;
    sctx.beginPath();
    probe.history.forEach((v, i) => {
      const x = (i / (HISTORY - 1)) * w;
      const y = h / 2 - (v / peak) * h * 0.43;
      if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
    });
    sctx.stroke();
  });
  sctx.fillStyle = "#9ca9b8";
  sctx.font = "12px sans-serif";
  sctx.fillText("Oscilloscope", 10, 18);
}

function drawSpectrum() {
  const panelH = 108;
  const count = Math.max(1, state.probes.length);
  const cssW = spectrumCanvas.clientWidth || 520;
  const desiredW = Math.floor(cssW * devicePixelRatio);
  const desiredH = panelH * count * devicePixelRatio;
  if (spectrumCanvas.width !== desiredW || spectrumCanvas.height !== desiredH) {
    spectrumCanvas.width = desiredW;
    spectrumCanvas.height = desiredH;
  }
  const w = spectrumCanvas.width;
  const h = spectrumCanvas.height;
  spctx.clearRect(0, 0, w, h);
  if (!state.probes.length) {
    spctx.fillStyle = "#9ca9b8";
    spctx.font = `${12 * devicePixelRatio}px sans-serif`;
    spctx.fillText("Spectrum", 10, 18);
    return;
  }
  state.probes.forEach((probe, pi) => {
    const top = pi * panelH * devicePixelRatio;
    const ph = panelH * devicePixelRatio;
    spctx.strokeStyle = "#263241";
    spctx.strokeRect(0.5, top + 0.5, w - 1, ph - 1);
    spctx.beginPath();
    spctx.moveTo(0, top + ph - 20 * devicePixelRatio);
    spctx.lineTo(w, top + ph - 20 * devicePixelRatio);
    spctx.stroke();
    spctx.fillStyle = "#9ca9b8";
    spctx.font = `${12 * devicePixelRatio}px sans-serif`;
    spctx.fillText(`P${pi + 1} spectrum`, 10 * devicePixelRatio, top + 18 * devicePixelRatio);
    if (probe.history.length < 16) return;
    const n = Math.min(128, probe.history.length);
    const data = probe.history.slice(-n);
    const mags = [];
    for (let k = 1; k < n / 2; k++) {
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) {
        const a = TWO_PI * k * i / n;
        re += data[i] * Math.cos(a);
        im -= data[i] * Math.sin(a);
      }
      mags.push(Math.hypot(re, im));
    }
    const max = Math.max(...mags, 1e-6);
    spctx.fillStyle = probe.color;
    mags.forEach((m, i) => {
      const x = (i / mags.length) * w;
      const bh = (m / max) * (ph - 36 * devicePixelRatio);
      spctx.fillRect(x, top + ph - 20 * devicePixelRatio - bh, Math.max(1, w / mags.length - 1), bh);
    });
  });
}

function updateProbeHistories() {
  for (const probe of state.probes) {
    probe.history.push(pressureAt(probe.x, probe.y, state.time));
    if (probe.history.length > HISTORY) probe.history.shift();
  }
}

function drawProbeTable() {
  const probe = state.probes.find((p) => p.id === state.selectedProbe) ?? state.probes[0];
  if (!probe) {
    ui.probeTable.innerHTML = "";
    return;
  }
  const rows = state.sources.map((src, i) => {
    const r = Math.hypot(probe.x - src.x, probe.y - src.y);
    const delay = r / state.soundSpeed;
    const phaseLag = (TWO_PI * src.frequency * delay) % TWO_PI;
    const amp = src.amplitude * attenuation(r);
    return `<tr><td>S${i + 1}</td><td>${r.toFixed(3)}</td><td>${delay.toFixed(5)}</td><td>${phaseLag.toFixed(2)}</td><td>${amp.toFixed(3)}</td></tr>`;
  }).join("");
  ui.probeTable.innerHTML = `<table><thead><tr><th>Src</th><th>m</th><th>s</th><th>rad</th><th>amp</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function syncSelected() {
  const src = state.sources.find((s) => s.id === state.selectedSource);
  const disabled = !src;
  for (const input of [ui.srcAmp, ui.srcFreq, ui.srcWave, ui.srcPhase, ui.srcDelay, ui.srcControl, ui.mute, ui.solo, ui.delete]) {
    input.disabled = disabled;
  }
  if (!src) {
    ui.selectedInfo.textContent = labels[ui.language.value].noSource;
    return;
  }
  ui.selectedInfo.textContent = `S${state.sources.indexOf(src) + 1}: x=${src.x.toFixed(2)} m, y=${src.y.toFixed(2)} m`;
  ui.srcAmp.value = src.amplitude;
  ui.srcFreq.value = src.frequency;
  ui.srcWave.value = (state.soundSpeed / src.frequency).toFixed(3);
  ui.srcPhase.value = src.phase.toFixed(3);
  ui.srcDelay.value = src.delay;
  ui.srcControl.value = src.control;
  ui.mute.classList.toggle("active", src.mute);
  ui.solo.classList.toggle("active", src.solo);
}

function updateSelectedFromInputs(changed) {
  const src = state.sources.find((s) => s.id === state.selectedSource);
  if (!src) return;
  src.amplitude = Number(ui.srcAmp.value) || 0;
  if (changed === "wave") {
    src.frequency = state.soundSpeed / Math.max(0.01, Number(ui.srcWave.value) || state.soundSpeed / DEFAULT_SOURCE_FREQ);
    ui.srcFreq.value = src.frequency.toFixed(2);
  } else {
    src.frequency = Math.max(1, Number(ui.srcFreq.value) || DEFAULT_SOURCE_FREQ);
    ui.srcWave.value = (state.soundSpeed / src.frequency).toFixed(3);
  }
  src.phase = Number(ui.srcPhase.value) || 0;
  src.delay = Number(ui.srcDelay.value) || 0;
  src.control = ui.srcControl.value;
  renderSourceList();
  syncSelected();
}

function renderSourceList() {
  ui.sourceList.innerHTML = state.sources.map((src, i) => {
    const flags = `${src.mute ? "M" : ""}${src.solo ? "S" : ""}`;
    return `<div class="sourceRow ${state.selectedSource === src.id ? "selected" : ""}" data-id="${src.id}">
      <span class="dot" style="background:${src.color}"></span>
      <span>S${i + 1} ${flags} | ${src.frequency.toFixed(0)} Hz | ${src.amplitude.toFixed(2)}</span>
      <button type="button" data-action="mute">${src.mute ? "Unmute" : "Mute"}</button>
      <button type="button" data-action="solo">${src.solo ? "Unsolo" : "Solo"}</button>
    </div>`;
  }).join("");
}

function applyLanguage() {
  const dict = labels[ui.language.value];
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = dict[node.dataset.i18n] ?? node.textContent;
  });
  const selected = ui.preset.value;
  const presets = presetLabels[ui.language.value];
  for (const option of ui.preset.options) {
    option.textContent = presets[option.value] ?? option.textContent;
  }
  ui.preset.value = selected;
  syncSelected();
}

function clearSources() {
  state.sources = [];
  state.selectedSource = null;
  state.nextId = 1;
}

function lineSources(vertical, n, spacing, opts = {}) {
  const start = -spacing * (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const pos = start + i * spacing;
    addSource(vertical ? 0 : pos, vertical ? pos : 0, opts);
  }
}

function loadPreset(name) {
  if (!name) return;
  clearSources();
  const lambda = state.soundSpeed / DEFAULT_SOURCE_FREQ;
  const add = (x, y, opts) => addSource(x, y, opts);
  if (name === "single") add(0, 0);
  if (name === "twoPhase") { add(-lambda, 0); add(lambda, 0); }
  if (name === "twoOpposite" || name === "dipole") { add(-lambda / 2, 0); add(lambda / 2, 0, { phase: Math.PI }); }
  if (name === "quadrupole") {
    add(-lambda / 2, -lambda / 2); add(lambda / 2, lambda / 2);
    add(lambda / 2, -lambda / 2, { phase: Math.PI }); add(-lambda / 2, lambda / 2, { phase: Math.PI });
  }
  if (name === "verticalLine") lineSources(true, 10, lambda / 4);
  if (name === "horizontalLine") lineSources(false, 10, lambda / 4);
  if (name === "beam" || name === "grating") lineSources(true, 10, name === "beam" ? lambda / 4 : lambda);
  if (name === "circular" || name === "focus" || name === "random") {
    const radius = 1.25 * lambda;
    for (let i = 0; i < 16; i++) {
      const a = TWO_PI * i / 16;
      const phase = name === "focus" ? TWO_PI * DEFAULT_SOURCE_FREQ * radius / state.soundSpeed : name === "random" ? Math.random() * TWO_PI : 0;
      add(Math.cos(a) * radius, Math.sin(a) * radius, { phase });
    }
  }
  if (name === "moving") add(-FIELD_SIZE / 2 + lambda / 2, 0, { moving: true, movingDirection: 1, movingSpeed: lambda * 0.8 });
  if (name === "beam") applyBeamSteering();
  resetTime();
  syncSelected();
  renderSourceList();
  ui.beamControls.classList.toggle("hidden", name !== "beam");
}

function applyBeamSteering() {
  const angle = Number(ui.beamAngle.value) * Math.PI / 180;
  ui.beamAngleValue.textContent = `${ui.beamAngle.value} deg`;
  const mode = ui.beamControlMode.value;
  const srcs = [...state.sources].sort((a, b) => a.y - b.y);
  for (const src of srcs) {
    const delay = src.y * Math.sin(angle) / state.soundSpeed;
    src.control = mode;
    src.delay = delay;
    src.phase = -TWO_PI * src.frequency * delay;
  }
  syncSelected();
  renderSourceList();
}

function animateMovingSources(dt) {
  for (const src of state.sources) {
    if (!src.moving) continue;
    src.x += dt * src.movingSpeed * src.movingDirection;
    const limit = FIELD_SIZE / 2;
    if (src.x > limit) {
      src.x = limit;
      src.movingDirection = -1;
    } else if (src.x < -limit) {
      src.x = -limit;
      src.movingDirection = 1;
    }
  }
}

function updateStatus() {
  ui.status.textContent = `${state.sources.length} sources | t = ${state.time.toFixed(3)} s | view ${visibleSize().toFixed(2)} m x ${visibleSize().toFixed(2)} m | field ${FIELD_SIZE.toFixed(2)} m`;
}

function frame(now) {
  const rawDt = Math.min(0.04, (now - state.lastFrame) / 1000);
  state.lastFrame = now;
  if (state.playing) {
    state.time += rawDt * state.timeScale;
    animateMovingSources(rawDt);
  }
  updateProbeHistories();
  drawField();
  drawOverlay();
  drawAxes();
  drawScope();
  drawSpectrum();
  drawProbeTable();
  updateStatus();
  requestAnimationFrame(frame);
}

overlayCanvas.addEventListener("pointerdown", (ev) => {
  overlayCanvas.setPointerCapture(ev.pointerId);
  if (ev.pointerType === "touch") {
    state.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (state.pointers.size >= 2) {
      const pts = [...state.pointers.values()];
      state.pinching = true;
      state.dragging = null;
      state.pinchStartDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      state.pinchStartZoom = state.viewZoom;
      return;
    }
  }
  const rect = overlayCanvas.getBoundingClientRect();
  const cx = ((ev.clientX - rect.left) / rect.width) * overlayCanvas.width;
  const cy = ((ev.clientY - rect.top) / rect.height) * overlayCanvas.height;
  const src = findSource(cx, cy);
  const probe = findProbe(cx, cy);
  state.dragMoved = false;
  if (state.mode === "source" && src) {
    state.selectedSource = src.id;
    state.dragging = { type: "source", id: src.id };
    syncSelected();
    renderSourceList();
  } else if (state.mode === "probe" && probe) {
    state.selectedProbe = probe.id;
    state.dragging = { type: "probe", id: probe.id };
  } else {
    state.dragging = null;
  }
});

overlayCanvas.addEventListener("pointermove", (ev) => {
  if (state.pointers.has(ev.pointerId)) {
    state.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  }
  if (state.pinching && state.pointers.size >= 2) {
    const pts = [...state.pointers.values()];
    const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (state.pinchStartDistance > 0) setZoom(state.pinchStartZoom * distance / state.pinchStartDistance);
    state.dragMoved = true;
    return;
  }
  if (!state.dragging) return;
  const pos = canvasToWorld(ev.clientX, ev.clientY);
  state.dragMoved = true;
  if (state.dragging.type === "source") {
    const src = state.sources.find((s) => s.id === state.dragging.id);
    if (src) { src.x = pos.x; src.y = pos.y; syncSelected(); }
  } else {
    const probe = state.probes.find((p) => p.id === state.dragging.id);
    if (probe) { probe.x = pos.x; probe.y = pos.y; probe.history = []; }
  }
});

overlayCanvas.addEventListener("pointerup", (ev) => {
  const wasPinching = state.pinching;
  state.pointers.delete(ev.pointerId);
  if (state.pointers.size < 2) state.pinching = false;
  const pos = canvasToWorld(ev.clientX, ev.clientY);
  if (!wasPinching && !state.dragging && !state.dragMoved) {
    if (state.mode === "source") addSource(pos.x, pos.y);
    else addProbe(pos.x, pos.y);
  }
  state.dragging = null;
  state.dragMoved = false;
});

overlayCanvas.addEventListener("pointercancel", (ev) => {
  state.pointers.delete(ev.pointerId);
  state.pinching = state.pointers.size >= 2;
  state.dragging = null;
  state.dragMoved = false;
});

overlayCanvas.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  const factor = Math.exp(-ev.deltaY * 0.0015);
  setZoom(state.viewZoom * factor);
}, { passive: false });

overlayCanvas.addEventListener("dblclick", (ev) => {
  const rect = overlayCanvas.getBoundingClientRect();
  const cx = ((ev.clientX - rect.left) / rect.width) * overlayCanvas.width;
  const cy = ((ev.clientY - rect.top) / rect.height) * overlayCanvas.height;
  const probe = findProbe(cx, cy);
  if (state.mode === "probe" && probe) {
    state.probes = state.probes.filter((p) => p.id !== probe.id);
    state.selectedProbe = state.probes[0]?.id ?? null;
    return;
  }
  const src = findSource(cx, cy);
  if (src) {
    state.sources = state.sources.filter((s) => s.id !== src.id);
    state.selectedSource = state.sources[0]?.id ?? null;
    resetTime();
    syncSelected();
    renderSourceList();
  }
});

ui.sourceMode.addEventListener("click", () => {
  state.mode = "source";
  ui.sourceMode.classList.add("active");
  ui.probeMode.classList.remove("active");
});
ui.probeMode.addEventListener("click", () => {
  state.mode = "probe";
  ui.probeMode.classList.add("active");
  ui.sourceMode.classList.remove("active");
});

ui.timeScale.addEventListener("input", () => {
  state.timeScale = Number(ui.timeScale.value);
  ui.timeScaleValue.textContent = `${state.timeScale.toFixed(3)}x`;
});

ui.soundSpeed.addEventListener("change", () => {
  state.soundSpeed = Math.max(1, Number(ui.soundSpeed.value) || DEFAULT_C);
  ui.temperature.value = soundSpeedToTemp(state.soundSpeed);
  syncSelected();
  resetTime();
});

ui.temperature.addEventListener("change", () => {
  state.soundSpeed = tempToSoundSpeed(Number(ui.temperature.value) || 0);
  ui.soundSpeed.value = state.soundSpeed.toFixed(1);
  syncSelected();
  resetTime();
});

for (const input of [ui.displayMode, ui.colorScale, ui.fixedMin, ui.fixedMax, ui.colormap, ui.contours, ui.attenuation]) {
  input.addEventListener("change", resetTime);
}

ui.preset.addEventListener("change", () => loadPreset(ui.preset.value));
ui.beamAngle.addEventListener("input", applyBeamSteering);
ui.beamControlMode.addEventListener("change", applyBeamSteering);

ui.randomize.addEventListener("click", () => {
  for (const src of state.sources) src.phase = Math.random() * TWO_PI;
  syncSelected();
  renderSourceList();
});
ui.resetPhases.addEventListener("click", () => {
  for (const src of state.sources) src.phase = 0;
  syncSelected();
  renderSourceList();
});

ui.srcAmp.addEventListener("input", () => updateSelectedFromInputs("amp"));
ui.srcFreq.addEventListener("input", () => updateSelectedFromInputs("freq"));
ui.srcWave.addEventListener("input", () => updateSelectedFromInputs("wave"));
ui.srcPhase.addEventListener("input", () => updateSelectedFromInputs("phase"));
ui.srcDelay.addEventListener("input", () => updateSelectedFromInputs("delay"));
ui.srcControl.addEventListener("change", () => updateSelectedFromInputs("control"));

ui.mute.addEventListener("click", () => {
  const src = state.sources.find((s) => s.id === state.selectedSource);
  if (src) src.mute = !src.mute;
  syncSelected();
  renderSourceList();
});
ui.solo.addEventListener("click", () => {
  const src = state.sources.find((s) => s.id === state.selectedSource);
  if (src) src.solo = !src.solo;
  syncSelected();
  renderSourceList();
});
ui.delete.addEventListener("click", deleteSelected);

ui.sourceList.addEventListener("click", (ev) => {
  const row = ev.target.closest(".sourceRow");
  if (!row) return;
  const id = Number(row.dataset.id);
  const src = state.sources.find((s) => s.id === id);
  if (!src) return;
  state.selectedSource = id;
  const action = ev.target.dataset.action;
  if (action === "mute") src.mute = !src.mute;
  if (action === "solo") src.solo = !src.solo;
  syncSelected();
  renderSourceList();
});

ui.playPause.addEventListener("click", () => {
  state.playing = !state.playing;
  ui.playPause.textContent = state.playing ? "Pause" : "Play";
});
ui.step.addEventListener("click", () => {
  if (!state.playing) state.time += 1 / 60 * state.timeScale;
});
ui.reset.addEventListener("click", resetTime);
ui.language.addEventListener("change", applyLanguage);

applyLanguage();
ui.temperature.value = soundSpeedToTemp(DEFAULT_C);
ui.preset.value = "single";
loadPreset("single");
requestAnimationFrame(frame);
