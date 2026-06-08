const FIELD_CYCLES = 24;
const FIELD_REFERENCE_FREQ = 400;
const DEFAULT_SOURCE_FREQ = 100;
const DEFAULT_C = 340;
const FIELD_SIZE = FIELD_CYCLES * (DEFAULT_C / FIELD_REFERENCE_FREQ);
const MAX_SOURCES = 40;
const MAX_PROBES = 4;
const GRID_INSTANT = 150;
const GRID_STATIC = 96;
const HISTORY = 360;
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

const ids = [
  "languageSelect", "sourceModeBtn", "probeModeBtn", "displayMode", "colorScale", "fixedMin", "fixedMax",
  "colormap", "contours", "timeScale", "timeScaleValue", "attenuation", "soundSpeed", "temperature",
  "presetSelect", "beamControls", "beamAngle", "beamAngleValue", "beamControlMode", "movingControls",
  "movingSpeed", "movingSpeedValue", "gridSnap", "snapStep", "randomizeBtn", "resetPhasesBtn",
  "selectedInfo", "srcAmp", "srcFreq", "srcWave", "phaseUnit", "srcPhase", "srcDelay", "srcControl",
  "muteBtn", "soloBtn", "deleteBtn", "sourceList", "probeTable", "playPauseBtn", "stepBtn", "resetBtn",
  "statusLine", "legendMin", "legendMax"
];
const ui = Object.fromEntries(ids.map((id) => [id, el(id)]));

const labels = {
  en: {
    title: "Wave Propagation Simulator", language: "Language", sourceMode: "Source mode", probeMode: "Probe mode",
    display: "Display", colorScale: "Color scale", fixedMin: "Fixed min", fixedMax: "Fixed max", colormap: "Color map",
    contours: "Contours / nodal lines", timeScale: "Time scale", attenuation: "Attenuation", soundSpeed: "Sound speed [m/s]",
    temperature: "Temperature [C]", preset: "Preset", beamAngle: "Steering angle [deg]", controlMode: "Control",
    movingSpeed: "Moving speed [m/s]", gridSnap: "Grid snap", snapStep: "Snap step [m]", randomize: "Randomize phases",
    resetPhases: "Reset phases", selectedSource: "Selected source", amplitude: "Amplitude", frequency: "Frequency [Hz]",
    wavelength: "Wavelength [m]", phaseUnit: "Phase unit", phase: "Phase", delay: "Delay [s]", sourceControl: "Control",
    sources: "Sources", probes: "Observation", pause: "Pause", play: "Play", step: "Step", reset: "Reset",
    mute: "Mute", solo: "Solo", delete: "Delete", listen: "Play", stop: "Stop", playing: "Playing",
    noSource: "No source selected."
  },
  ja: {
    title: "音波伝搬シミュレータ", language: "言語", sourceMode: "点音源配置", probeMode: "音圧観測",
    display: "表示", colorScale: "色スケール", fixedMin: "固定最小値", fixedMax: "固定最大値", colormap: "Color map",
    contours: "等高線 / 節線", timeScale: "時間速度", attenuation: "減衰", soundSpeed: "音速 [m/s]",
    temperature: "室温 [℃]", preset: "プリセット", beamAngle: "ステアリング角 [deg]", controlMode: "制御方式",
    movingSpeed: "移動速度 [m/s]", gridSnap: "グリッド吸着", snapStep: "吸着間隔 [m]", randomize: "位相をランダム化",
    resetPhases: "位相をリセット", selectedSource: "選択中の音源", amplitude: "振幅", frequency: "周波数 [Hz]",
    wavelength: "波長 [m]", phaseUnit: "位相単位", phase: "位相", delay: "遅延 [s]", sourceControl: "制御",
    sources: "音源", probes: "観測", pause: "一時停止", play: "再生", step: "ステップ", reset: "リセット",
    mute: "ミュート", solo: "ソロ", delete: "削除", listen: "再生", stop: "停止", playing: "再生中",
    noSource: "音源が選択されていません。"
  }
};

const optionLabels = {
  displayMode: { en: { instant: "Instant pressure", rms: "RMS pressure", spl: "SPL" }, ja: { instant: "瞬時音圧", rms: "RMS音圧", spl: "SPL" } },
  colorScale: { en: { fixed: "Fixed", auto: "Auto" }, ja: { fixed: "固定", auto: "自動" } },
  colormap: { en: { thermal: "Thermal", diverging: "Diverging", viridis: "Viridis" }, ja: { thermal: "Thermal", diverging: "Diverging", viridis: "Viridis" } },
  attenuation: { en: { none: "None", inverse: "1 / r", sqrt: "1 / sqrt(r)" }, ja: { none: "減衰なし", inverse: "1 / r 減衰", sqrt: "1 / sqrt(r) 減衰" } },
  srcControl: { en: { phase: "Phase", delay: "Delay" }, ja: { phase: "位相指定", delay: "遅延指定" } },
  beamControlMode: { en: { phase: "Phase shift", delay: "Time delay" }, ja: { phase: "位相シフト", delay: "時間遅延" } }
};

const presetLabels = {
  en: { "": "Manual", single: "Single center source", twoPhase: "Two sources in phase", twoOpposite: "Two sources opposite phase", quadrupole: "Quadrupole", verticalLine: "Vertical line array", horizontalLine: "Horizontal line array", beam: "Beam steering", grating: "Grating lobes", circular: "Circular array", random: "Random phase array", moving: "Moving source" },
  ja: { "": "手動配置", single: "中央1音源", twoPhase: "2音源 同相", twoOpposite: "2音源 逆相", quadrupole: "四重極", verticalLine: "垂直ラインアレイ", horizontalLine: "水平ラインアレイ", beam: "ビームステアリング", grating: "グレーティングローブ", circular: "円形アレイ", random: "ランダム位相アレイ", moving: "移動音源" }
};

const state = {
  sources: [], probes: [], selectedSource: null, selectedProbe: null, mode: "source",
  time: 0, playing: true, lastFrame: performance.now(), nextId: 1, nextProbeId: 1,
  dragging: null, dragMoved: false, pointers: new Map(), pinching: false, pinchStartDistance: 0, pinchStartZoom: 1,
  soundSpeed: DEFAULT_C, timeScale: 0.01, viewZoom: FIELD_SIZE / 40,
  fieldCache: null, fieldCacheKey: "",
  audioCtx: null, audioNode: null, audioGain: null, audioProbeId: null, audioTime: 0
};

const colors = (i) => ["#22c55e", "#38bdf8", "#f97316", "#e879f9", "#fde047", "#fb7185", "#a3e635", "#60a5fa"][i % 8];
const visibleSize = () => FIELD_SIZE / state.viewZoom;
const setZoom = (z) => state.viewZoom = Math.max(FIELD_SIZE / 40, Math.min(12, z));
const tempToSoundSpeed = (t) => 331.3 + 0.606 * t;
const soundSpeedToTemp = (c) => ((c - 331.3) / 0.606).toFixed(1);
const isEditing = (n) => document.activeElement === n;
const phaseToInput = (r) => ui.phaseUnit.value === "deg" ? r * 180 / Math.PI : r;
const inputToPhase = (v) => ui.phaseUnit.value === "deg" ? v * Math.PI / 180 : v;

function invalidateField() { state.fieldCache = null; }
function resetTime() { state.time = 0; for (const p of state.probes) p.history = []; invalidateField(); }

function resizeCanvases() {
  const size = Math.floor(Math.min(fieldCanvas.clientWidth, fieldCanvas.clientHeight) * devicePixelRatio) || 720;
  for (const c of [fieldCanvas, overlayCanvas]) if (c.width !== size) { c.width = size; c.height = size; }
  const xw = Math.floor((xAxisCanvas.clientWidth || 720) * devicePixelRatio), xh = Math.floor((xAxisCanvas.clientHeight || 34) * devicePixelRatio);
  if (xAxisCanvas.width !== xw || xAxisCanvas.height !== xh) { xAxisCanvas.width = xw; xAxisCanvas.height = xh; }
  const yw = Math.floor((yAxisCanvas.clientWidth || 56) * devicePixelRatio), yh = Math.floor((yAxisCanvas.clientHeight || 720) * devicePixelRatio);
  if (yAxisCanvas.width !== yw || yAxisCanvas.height !== yh) { yAxisCanvas.width = yw; yAxisCanvas.height = yh; }
}

function worldToCanvas(x, y) {
  const s = visibleSize();
  return { x: ((x + s / 2) / s) * overlayCanvas.width, y: ((s / 2 - y) / s) * overlayCanvas.height };
}

function canvasToWorld(px, py) {
  const r = overlayCanvas.getBoundingClientRect(), s = visibleSize();
  let x = (px - r.left) / r.width * s - s / 2;
  let y = s / 2 - (py - r.top) / r.height * s;
  if (ui.gridSnap.checked) {
    const st = Math.max(0.01, Number(ui.snapStep.value) || 0.85);
    x = Math.round(x / st) * st;
    y = Math.round(y / st) * st;
  }
  return { x, y };
}

function activeSources() {
  const solo = state.sources.filter((s) => s.solo);
  return (solo.length ? solo : state.sources).filter((s) => !s.mute);
}

function atten(r) {
  const rr = r + EPS;
  if (ui.attenuation.value === "inverse") return 1 / rr;
  if (ui.attenuation.value === "sqrt") return 1 / Math.sqrt(rr);
  return 1;
}

function sourceSignal(src, x, y, t) {
  const r = Math.hypot(x - src.x, y - src.y);
  const travel = r / state.soundSpeed;
  const ph = src.control === "delay" ? -TWO_PI * src.frequency * src.delay : src.phase;
  return src.amplitude * atten(r) * Math.sin(TWO_PI * src.frequency * (t - travel) + ph);
}

function pressureAt(x, y, t) {
  let sum = 0;
  for (const s of activeSources()) sum += sourceSignal(s, x, y, t);
  return sum;
}

function rmsFastAt(x, y) {
  const groups = new Map();
  for (const s of activeSources()) {
    const r = Math.hypot(x - s.x, y - s.y);
    const a = s.amplitude * atten(r);
    const freq = Math.round(s.frequency * 1000) / 1000;
    const base = s.control === "delay" ? -TWO_PI * s.frequency * s.delay : s.phase;
    const theta = base - TWO_PI * s.frequency * r / state.soundSpeed;
    const g = groups.get(freq) || { re: 0, im: 0 };
    g.re += a * Math.cos(theta);
    g.im += a * Math.sin(theta);
    groups.set(freq, g);
  }
  let sum = 0;
  for (const g of groups.values()) sum += (g.re * g.re + g.im * g.im) * 0.5;
  return Math.sqrt(sum);
}

function addSource(x, y, o = {}) {
  if (state.sources.length >= MAX_SOURCES) return null;
  const id = state.nextId++;
  const src = {
    id, x, y,
    amplitude: o.amplitude ?? 1,
    frequency: o.frequency ?? DEFAULT_SOURCE_FREQ,
    phase: o.phase ?? 0,
    delay: o.delay ?? 0,
    control: o.control ?? "phase",
    mute: false, solo: false,
    moving: o.moving ?? false,
    movingDirection: o.movingDirection ?? 1,
    movingSpeed: o.movingSpeed ?? Number(ui.movingSpeed.value),
    color: colors(id - 1)
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
  const p = { id: state.nextProbeId++, x, y, color: colors(state.nextProbeId + 2), history: [] };
  state.probes.push(p);
  state.selectedProbe = p.id;
  return p;
}

function findSource(cx, cy) {
  let hit = null, best = 16 * devicePixelRatio;
  for (const s of state.sources) {
    const p = worldToCanvas(s.x, s.y), d = Math.hypot(cx - p.x, cy - p.y);
    if (d < best) { best = d; hit = s; }
  }
  return hit;
}

function findProbe(cx, cy) {
  let hit = null, best = 14 * devicePixelRatio;
  for (const probe of state.probes) {
    const p = worldToCanvas(probe.x, probe.y), d = Math.hypot(cx - p.x, cy - p.y);
    if (d < best) { best = d; hit = probe; }
  }
  return hit;
}

function stops(t, a) {
  for (let i = 0; i < a.length - 1; i++) {
    const p = a[i], q = a[i + 1];
    if (t >= p[0] && t <= q[0]) {
      const u = (t - p[0]) / (q[0] - p[0]);
      return [p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u, p[3] + (q[3] - p[3]) * u].map(Math.round);
    }
  }
  const l = a.at(-1);
  return [l[1], l[2], l[3]];
}

function mapColor(v, min, max) {
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (v - min) / (max - min)));
  if (ui.colormap.value === "thermal") return stops(t, [[0, 8, 13, 30], [.35, 38, 91, 168], [.62, 247, 183, 51], [1, 255, 245, 204]]);
  if (ui.colormap.value === "viridis") return stops(t, [[0, 68, 1, 84], [.35, 49, 104, 142], [.7, 53, 183, 121], [1, 253, 231, 37]]);
  return stops(t, [[0, 48, 85, 212], [.5, 244, 247, 251], [1, 198, 41, 53]]);
}

function fieldKey(mode, n) {
  return [mode, n, visibleSize().toFixed(3), state.soundSpeed, ui.attenuation.value,
    state.sources.map((s) => `${s.x.toFixed(2)},${s.y.toFixed(2)},${s.amplitude},${s.frequency},${s.phase},${s.delay},${s.control},${s.mute},${s.solo}`).join(";")
  ].join("|");
}

function computeValues(mode, n) {
  const size = visibleSize(), vals = new Float32Array(n * n);
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < n; j++) {
    const y = size / 2 - j / (n - 1) * size;
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1) * size - size / 2;
      let v = mode === "instant" ? pressureAt(x, y, state.time) : rmsFastAt(x, y);
      if (mode === "spl") v = 20 * Math.log10(Math.max(v, 1e-5) / 2e-5);
      const k = j * n + i;
      vals[k] = v;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  return { vals, min, max, n };
}

function drawField() {
  resizeCanvases();
  const mode = ui.displayMode.value, n = mode === "instant" ? GRID_INSTANT : GRID_STATIC;
  let data;
  if (mode === "instant") data = computeValues(mode, n);
  else {
    const key = fieldKey(mode, n);
    if (!state.fieldCache || state.fieldCacheKey !== key) {
      state.fieldCache = computeValues(mode, n);
      state.fieldCacheKey = key;
    }
    data = state.fieldCache;
  }

  let { vals, min, max } = data;
  if (ui.colorScale.value === "fixed") { min = Number(ui.fixedMin.value); max = Number(ui.fixedMax.value); }
  else if (mode === "instant") {
    const m = Math.max(Math.abs(min), Math.abs(max), 1e-6);
    min = -m; max = m;
  }

  const img = fctx.createImageData(n, n);
  for (let k = 0; k < vals.length; k++) {
    const [r, g, b] = mapColor(vals[k], min, max);
    img.data[k * 4] = r; img.data[k * 4 + 1] = g; img.data[k * 4 + 2] = b; img.data[k * 4 + 3] = 255;
  }
  const off = document.createElement("canvas");
  off.width = n; off.height = n;
  off.getContext("2d").putImageData(img, 0, 0);
  fctx.imageSmoothingEnabled = true;
  fctx.drawImage(off, 0, 0, fieldCanvas.width, fieldCanvas.height);
  ui.legendMin.textContent = mode === "spl" ? `${min.toFixed(0)} dB` : min.toFixed(2);
  ui.legendMax.textContent = mode === "spl" ? `${max.toFixed(0)} dB` : max.toFixed(2);
}

function niceStep(size) {
  const target = size / 8, p = 10 ** Math.floor(Math.log10(target)), n = target / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function drawAxes() {
  const size = visibleSize(), step = niceStep(size);
  xctx.clearRect(0, 0, xAxisCanvas.width, xAxisCanvas.height);
  yctx.clearRect(0, 0, yAxisCanvas.width, yAxisCanvas.height);
  xctx.strokeStyle = yctx.strokeStyle = "#596574";
  xctx.fillStyle = yctx.fillStyle = "#aeb8c5";
  xctx.font = yctx.font = `${11 * devicePixelRatio}px sans-serif`;
  xctx.textBaseline = "top";
  yctx.textAlign = "right";
  yctx.textBaseline = "middle";
  for (let v = -Math.ceil(size / 2 / step) * step; v <= size / 2 + step * 0.5; v += step) {
    const px = worldToCanvas(v, 0).x / overlayCanvas.width * xAxisCanvas.width;
    const py = worldToCanvas(0, v).y / overlayCanvas.height * yAxisCanvas.height;
    const label = `${Math.abs(v) < 1e-9 ? 0 : v.toFixed(step < 1 ? 1 : 0)} m`;
    xctx.beginPath(); xctx.moveTo(px, 0); xctx.lineTo(px, 6 * devicePixelRatio); xctx.stroke();
    xctx.textAlign = px < 28 * devicePixelRatio ? "left" : px > xAxisCanvas.width - 28 * devicePixelRatio ? "right" : "center";
    xctx.fillText(label, px, 9 * devicePixelRatio);
    yctx.beginPath(); yctx.moveTo(yAxisCanvas.width - 6 * devicePixelRatio, py); yctx.lineTo(yAxisCanvas.width, py); yctx.stroke();
    yctx.fillText(label, yAxisCanvas.width - 9 * devicePixelRatio, py);
  }
}

function drawOverlay() {
  const w = overlayCanvas.width, h = overlayCanvas.height, size = visibleSize();
  octx.clearRect(0, 0, w, h);
  octx.strokeStyle = "rgba(255,255,255,.18)";
  octx.lineWidth = 1;
  octx.beginPath();
  const gs = DEFAULT_C / FIELD_REFERENCE_FREQ;
  for (let v = -Math.ceil(size / 2 / gs) * gs; v <= size / 2 + gs * 0.5; v += gs) {
    const px = worldToCanvas(v, 0).x, py = worldToCanvas(0, v).y;
    octx.moveTo(px, 0); octx.lineTo(px, h); octx.moveTo(0, py); octx.lineTo(w, py);
  }
  octx.stroke();
  octx.strokeStyle = "rgba(255,255,255,.45)";
  octx.beginPath(); octx.moveTo(w / 2, 0); octx.lineTo(w / 2, h); octx.moveTo(0, h / 2); octx.lineTo(w, h / 2); octx.stroke();

  state.sources.forEach((s, i) => {
    const p = worldToCanvas(s.x, s.y);
    octx.beginPath();
    octx.fillStyle = s.mute ? "#64748b" : s.color;
    octx.strokeStyle = state.selectedSource === s.id ? "#fff" : "rgba(0,0,0,.65)";
    octx.lineWidth = state.selectedSource === s.id ? 5 : 2;
    octx.arc(p.x, p.y, state.selectedSource === s.id ? 10 : 7, 0, TWO_PI);
    octx.fill(); octx.stroke();
    octx.fillStyle = "#071018";
    octx.font = `${12 * devicePixelRatio}px sans-serif`;
    octx.textAlign = "center"; octx.textBaseline = "middle";
    octx.fillText(String(i + 1), p.x, p.y);
  });

  state.probes.forEach((probe, i) => {
    const p = worldToCanvas(probe.x, probe.y);
    octx.strokeStyle = probe.color;
    octx.lineWidth = state.audioProbeId === probe.id ? 5 : 3;
    octx.beginPath();
    octx.moveTo(p.x - 9, p.y); octx.lineTo(p.x + 9, p.y);
    octx.moveTo(p.x, p.y - 9); octx.lineTo(p.x, p.y + 9);
    octx.stroke();
    octx.fillStyle = probe.color;
    octx.fillText(`P${i + 1}`, p.x + 18, p.y - 12);
  });
}

function scopeWindow() {
  const latest = state.probes.reduce((m, p) => p.history.length ? Math.max(m, p.history[p.history.length - 1].t) : m, state.time);
  const earliest = state.probes.reduce((m, p) => p.history.length ? Math.min(m, p.history[0].t) : m, latest - 0.05);
  const span = Math.max(0.01, latest - earliest);
  return { start: latest - span, end: latest, span };
}

function drawScope() {
  const w = scopeCanvas.width, h = scopeCanvas.height;
  const left = 42, right = 8, top = 10, bottom = 28;
  const pw = w - left - right, ph = h - top - bottom;
  const win = scopeWindow();

  sctx.clearRect(0, 0, w, h);
  sctx.strokeStyle = "#263241";
  sctx.fillStyle = "#9ca9b8";
  sctx.font = "12px sans-serif";

  let peak = 1e-6;
  for (const p of state.probes) for (const s of p.history) peak = Math.max(peak, Math.abs(s.v));
  const yMax = peak, yMin = -peak;

  sctx.beginPath();
  sctx.rect(left, top, pw, ph);
  sctx.stroke();

  for (let i = 0; i <= 4; i++) {
    const x = left + (i / 4) * pw;
    const t = win.start + (i / 4) * win.span;
    sctx.strokeStyle = "rgba(255,255,255,.08)";
    sctx.beginPath(); sctx.moveTo(x, top); sctx.lineTo(x, top + ph); sctx.stroke();
    sctx.fillStyle = "#9ca9b8";
    sctx.textAlign = "center";
    sctx.fillText(t.toFixed(3), x, h - 10);
  }
  for (let i = 0; i <= 4; i++) {
    const y = top + (i / 4) * ph;
    const v = yMax - (i / 4) * (yMax - yMin);
    sctx.strokeStyle = "rgba(255,255,255,.08)";
    sctx.beginPath(); sctx.moveTo(left, y); sctx.lineTo(left + pw, y); sctx.stroke();
    sctx.fillStyle = "#9ca9b8";
    sctx.textAlign = "right";
    sctx.fillText(v.toFixed(2), left - 5, y + 4);
  }

  for (const p of state.probes) {
    sctx.strokeStyle = p.color;
    sctx.lineWidth = 2;
    sctx.beginPath();
    let drawn = false;
    for (const sample of p.history) {
      if (sample.t < win.start || sample.t > win.end) continue;
      const x = left + ((sample.t - win.start) / win.span) * pw;
      const y = top + ((yMax - sample.v) / (yMax - yMin || 1)) * ph;
      if (!drawn) { sctx.moveTo(x, y); drawn = true; } else sctx.lineTo(x, y);
    }
    sctx.stroke();
  }

  sctx.fillStyle = "#9ca9b8";
  sctx.textAlign = "right";
  sctx.fillText("Time [s]", w - 8, h - 10);
  sctx.save();
  sctx.translate(12, top + ph / 2 + 22);
  sctx.rotate(-Math.PI / 2);
  sctx.textAlign = "center";
  sctx.fillText("Pressure", 0, 0);
  sctx.restore();
}

function drawSpectrum() {
  const panelH = 138, count = Math.max(1, state.probes.length);
  const dw = Math.floor((spectrumCanvas.clientWidth || 520) * devicePixelRatio);
  const dh = panelH * count * devicePixelRatio;
  if (spectrumCanvas.width !== dw || spectrumCanvas.height !== dh) { spectrumCanvas.width = dw; spectrumCanvas.height = dh; }

  spctx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
  spctx.font = `${12 * devicePixelRatio}px sans-serif`;
  if (!state.probes.length) {
    spctx.fillStyle = "#9ca9b8";
    spctx.fillText("Spectrum", 10, 18);
    return;
  }

  state.probes.forEach((p, pi) => {
    const w = spectrumCanvas.width;
    const topPx = pi * panelH * devicePixelRatio;
    const ph = panelH * devicePixelRatio;
    const left = 42 * devicePixelRatio, right = 10 * devicePixelRatio, top = topPx + 12 * devicePixelRatio, bottom = 32 * devicePixelRatio;
    const pw = w - left - right, gh = ph - 44 * devicePixelRatio;
    const base = top + gh;
    const data = p.history.slice(-128);
    const duration = data.length > 1 ? data[data.length - 1].t - data[0].t : 0;
    const fs = duration > 0 ? (data.length - 1) / duration : 1;
    const mags = [];

    if (data.length >= 16 && duration > 0) {
      const values = data.map((s) => s.v);
      const n = values.length;
      for (let k = 1; k < n / 2; k++) {
        let re = 0, im = 0;
        for (let i = 0; i < n; i++) {
          const a = TWO_PI * k * i / n;
          re += values[i] * Math.cos(a);
          im -= values[i] * Math.sin(a);
        }
        mags.push({ f: (k * fs / n) / 1000, m: Math.hypot(re, im) });
      }
    }
    const maxFreq = Math.max(0.25, ...mags.map((m) => m.f));
    const maxAmp = Math.max(1e-6, ...mags.map((m) => m.m));

    spctx.strokeStyle = "#263241";
    spctx.strokeRect(0.5, topPx + 0.5, w - 1, ph - 1);
    spctx.beginPath(); spctx.moveTo(left, base); spctx.lineTo(left + pw, base); spctx.moveTo(left, top); spctx.lineTo(left, base); spctx.stroke();

    for (let i = 0; i <= 4; i++) {
      const x = left + (i / 4) * pw;
      const f = (i / 4) * maxFreq;
      spctx.strokeStyle = "rgba(255,255,255,.08)";
      spctx.beginPath(); spctx.moveTo(x, top); spctx.lineTo(x, base); spctx.stroke();
      spctx.fillStyle = "#9ca9b8";
      spctx.textAlign = "center";
      spctx.fillText(f.toFixed(2), x, topPx + ph - 12 * devicePixelRatio);
    }
    for (let i = 0; i <= 3; i++) {
      const y = base - (i / 3) * gh;
      const a = (i / 3) * maxAmp;
      spctx.strokeStyle = "rgba(255,255,255,.08)";
      spctx.beginPath(); spctx.moveTo(left, y); spctx.lineTo(left + pw, y); spctx.stroke();
      spctx.fillStyle = "#9ca9b8";
      spctx.textAlign = "right";
      spctx.fillText(a.toFixed(1), left - 5 * devicePixelRatio, y + 4 * devicePixelRatio);
    }

    spctx.fillStyle = "#9ca9b8";
    spctx.textAlign = "left";
    spctx.fillText(`P${pi + 1}`, 8 * devicePixelRatio, topPx + 18 * devicePixelRatio);
    spctx.textAlign = "right";
    spctx.fillText("Frequency [kHz]", w - 8 * devicePixelRatio, topPx + ph - 12 * devicePixelRatio);
    spctx.save();
    spctx.translate(12 * devicePixelRatio, top + gh / 2);
    spctx.rotate(-Math.PI / 2);
    spctx.textAlign = "center";
    spctx.fillText("Amp.", 0, 0);
    spctx.restore();

    spctx.fillStyle = p.color;
    for (const bin of mags) {
      const x = left + (bin.f / maxFreq) * pw;
      const bh = (bin.m / maxAmp) * gh;
      spctx.fillRect(x, base - bh, Math.max(1, pw / Math.max(1, mags.length) - 1), bh);
    }
  });
}

function updateProbeHistories(force = false) {
  if (!state.playing && !force) return;
  for (const p of state.probes) {
    p.history.push({ t: state.time, v: pressureAt(p.x, p.y, state.time) });
    if (p.history.length > HISTORY) p.history.shift();
  }
}

function drawProbeTable() {
  const dict = labels[ui.languageSelect.value];
  ui.probeTable.innerHTML = `<table><thead><tr><th>Probe</th><th>Audio</th><th>x</th><th>y</th></tr></thead><tbody>${
    state.probes.map((p, i) => {
      const active = state.audioProbeId === p.id;
      return `<tr><td>P${i + 1}</td><td class="probeButtons">
        <button class="${active ? "active audioActive" : ""}" data-audio="play" data-id="${p.id}">${active ? dict.playing : dict.listen}</button>
        <button data-audio="stop" data-id="${p.id}">${dict.stop}</button>
      </td><td>${p.x.toFixed(2)}</td><td>${p.y.toFixed(2)}</td></tr>`;
    }).join("")
  }</tbody></table>`;
}

function syncSelected() {
  const s = state.sources.find((x) => x.id === state.selectedSource), dict = labels[ui.languageSelect.value];
  for (const n of [ui.srcAmp, ui.srcFreq, ui.srcWave, ui.phaseUnit, ui.srcPhase, ui.srcDelay, ui.srcControl, ui.muteBtn, ui.soloBtn, ui.deleteBtn]) n.disabled = !s;
  if (!s) { ui.selectedInfo.textContent = dict.noSource; return; }
  ui.selectedInfo.textContent = `S${state.sources.indexOf(s) + 1}: x=${s.x.toFixed(2)} m, y=${s.y.toFixed(2)} m`;
  if (!isEditing(ui.srcAmp)) ui.srcAmp.value = s.amplitude;
  if (!isEditing(ui.srcFreq)) ui.srcFreq.value = Number(s.frequency.toFixed(3));
  if (!isEditing(ui.srcWave)) ui.srcWave.value = (state.soundSpeed / s.frequency).toFixed(3);
  if (!isEditing(ui.srcPhase)) ui.srcPhase.value = Number(phaseToInput(s.phase).toFixed(ui.phaseUnit.value === "deg" ? 2 : 3));
  if (!isEditing(ui.srcDelay)) ui.srcDelay.value = s.delay;
  if (!isEditing(ui.srcControl)) ui.srcControl.value = s.control;
  ui.muteBtn.classList.toggle("active", s.mute);
  ui.soloBtn.classList.toggle("active", s.solo);
}

function updateSelectedFromInputs(changed) {
  const s = state.sources.find((x) => x.id === state.selectedSource);
  if (!s) return;
  s.amplitude = Number(ui.srcAmp.value) || 0;
  if (changed === "wave") {
    s.frequency = state.soundSpeed / Math.max(0.01, Number(ui.srcWave.value) || state.soundSpeed / DEFAULT_SOURCE_FREQ);
    if (!isEditing(ui.srcFreq)) ui.srcFreq.value = Number(s.frequency.toFixed(3));
  } else {
    s.frequency = Math.max(1, Number(ui.srcFreq.value) || DEFAULT_SOURCE_FREQ);
    if (!isEditing(ui.srcWave)) ui.srcWave.value = (state.soundSpeed / s.frequency).toFixed(3);
  }
  s.phase = inputToPhase(Number(ui.srcPhase.value) || 0);
  s.delay = Number(ui.srcDelay.value) || 0;
  s.control = ui.srcControl.value;
  invalidateField();
  renderSourceList();
}

function renderSourceList() {
  const dict = labels[ui.languageSelect.value];
  ui.sourceList.innerHTML = state.sources.map((s, i) => `<div class="sourceRow ${state.selectedSource === s.id ? "selected" : ""}" data-id="${s.id}">
    <span class="dot" style="background:${s.color}"></span>
    <span>S${i + 1} ${s.moving ? "&harr; " : ""}${s.frequency.toFixed(0)} Hz | ${s.amplitude.toFixed(2)}</span>
    <button data-action="mute">${dict.mute}</button><button data-action="solo">${dict.solo}</button>
  </div>`).join("");
}

function applyLanguage() {
  const lang = ui.languageSelect.value, dict = labels[lang];
  document.querySelectorAll("[data-i18n]").forEach((n) => n.textContent = dict[n.dataset.i18n] ?? n.textContent);
  for (const [id, maps] of Object.entries(optionLabels)) {
    const sel = ui[id]; if (!sel) continue;
    const val = sel.value;
    for (const o of sel.options) o.textContent = maps[lang][o.value] ?? o.textContent;
    sel.value = val;
  }
  const pv = ui.presetSelect.value;
  for (const o of ui.presetSelect.options) o.textContent = presetLabels[lang][o.value] ?? o.textContent;
  ui.presetSelect.value = pv;
  ui.playPauseBtn.textContent = state.playing ? dict.pause : dict.play;
  renderSourceList(); syncSelected();
}

function setDisplayMode(mode) {
  ui.displayMode.value = mode;
  ui.colorScale.value = "fixed";
  if (mode === "spl") { ui.fixedMin.value = 40; ui.fixedMax.value = 100; }
  else if (mode === "rms") { ui.fixedMin.value = 0; ui.fixedMax.value = 1; }
  else { ui.fixedMin.value = -1; ui.fixedMax.value = 1; }
  resetTime();
}

function clearSources() { state.sources = []; state.selectedSource = null; state.nextId = 1; }
function lineSources(vertical, n, length) {
  const spacing = length / (n - 1), start = -length / 2;
  for (let i = 0; i < n; i++) { const p = start + i * spacing; addSource(vertical ? 0 : p, vertical ? p : 0); }
}

function loadPreset(name) {
  if (!name) return;
  clearSources();
  const lambda = state.soundSpeed / DEFAULT_SOURCE_FREQ, add = (x, y, o) => addSource(x, y, o);
  if (name === "single") add(0, 0);
  if (name === "twoPhase") { add(-lambda, 0); add(lambda, 0); }
  if (name === "twoOpposite") { add(-lambda / 2, 0); add(lambda / 2, 0, { phase: Math.PI }); }
  if (name === "quadrupole") { add(-lambda / 2, -lambda / 2); add(lambda / 2, lambda / 2); add(lambda / 2, -lambda / 2, { phase: Math.PI }); add(-lambda / 2, lambda / 2, { phase: Math.PI }); }
  const oldLen = (10 - 1) * (lambda / 4);
  if (name === "verticalLine") lineSources(true, 20, oldLen);
  if (name === "horizontalLine") lineSources(false, 20, oldLen);
  if (name === "beam" || name === "grating") lineSources(true, 20, name === "beam" ? oldLen : 19 * lambda / 2);
  if (["circular", "random"].includes(name)) {
    const radius = 1.25 * lambda;
    for (let i = 0; i < 16; i++) {
      const a = TWO_PI * i / 16, ph = name === "random" ? Math.random() * TWO_PI : 0;
      add(Math.cos(a) * radius, Math.sin(a) * radius, { phase: ph });
    }
  }
  if (name === "moving") add(-FIELD_SIZE / 2 + lambda / 2, 0, { moving: true, movingDirection: 1, movingSpeed: Number(ui.movingSpeed.value) });
  if (name === "beam") applyBeamSteering();
  ui.beamControls.classList.toggle("hidden", name !== "beam");
  ui.movingControls.classList.toggle("hidden", name !== "moving");
  resetTime(); syncSelected(); renderSourceList();
}

function applyBeamSteering() {
  const angle = Number(ui.beamAngle.value) * Math.PI / 180, mode = ui.beamControlMode.value;
  ui.beamAngleValue.textContent = `${ui.beamAngle.value} deg`;
  for (const s of state.sources) {
    const d = s.y * Math.sin(angle) / state.soundSpeed;
    s.control = mode; s.delay = d; s.phase = -TWO_PI * s.frequency * d;
  }
  invalidateField(); syncSelected(); renderSourceList();
}

function animateMoving(dt) {
  let changed = false;
  for (const s of state.sources) {
    if (!s.moving) continue;
    s.movingSpeed = Number(ui.movingSpeed.value);
    s.x += dt * s.movingSpeed * s.movingDirection;
    const lim = FIELD_SIZE / 2;
    if (s.x > lim) { s.x = lim; s.movingDirection = -1; }
    if (s.x < -lim) { s.x = -lim; s.movingDirection = 1; }
    changed = true;
  }
  if (changed) invalidateField();
}

function updateStatus() {
  ui.statusLine.textContent = `${state.sources.length} sources | t = ${state.time.toFixed(3)} s | view ${visibleSize().toFixed(2)} m x ${visibleSize().toFixed(2)} m | field ${FIELD_SIZE.toFixed(2)} m`;
}

function frame(now) {
  const dt = Math.min(0.04, (now - state.lastFrame) / 1000);
  state.lastFrame = now;
  if (state.playing) { state.time += dt * state.timeScale; animateMoving(dt); }
  updateProbeHistories();
  drawField(); drawOverlay(); drawAxes(); drawScope(); drawSpectrum(); drawProbeTable(); updateStatus();
  requestAnimationFrame(frame);
}

function stopAudio() {
  if (state.audioNode) { state.audioNode.disconnect(); state.audioNode.onaudioprocess = null; state.audioNode = null; }
  if (state.audioGain) { state.audioGain.disconnect(); state.audioGain = null; }
  state.audioProbeId = null;
}

async function playProbe(id) {
  stopAudio();
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  state.audioCtx = state.audioCtx || new AudioCtor();
  await state.audioCtx.resume();

  const node = state.audioCtx.createScriptProcessor(1024, 0, 1);
  const gain = state.audioCtx.createGain();
  gain.gain.value = 0.22;
  state.audioProbeId = id;
  state.audioTime = state.time;
  node.onaudioprocess = (e) => {
    const out = e.outputBuffer.getChannelData(0), sr = e.outputBuffer.sampleRate;
    const p = state.probes.find((x) => x.id === state.audioProbeId);
    for (let i = 0; i < out.length; i++) {
      if (!p) { out[i] = 0; continue; }
      state.audioTime += 1 / sr;
      out[i] = Math.max(-0.95, Math.min(0.95, pressureAt(p.x, p.y, state.audioTime) * 0.15));
    }
  };
  node.connect(gain);
  gain.connect(state.audioCtx.destination);
  state.audioNode = node;
  state.audioGain = gain;
  drawProbeTable();
}

overlayCanvas.addEventListener("pointerdown", (ev) => {
  overlayCanvas.setPointerCapture(ev.pointerId);
  if (ev.pointerType === "touch") {
    state.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (state.pointers.size >= 2) {
      const p = [...state.pointers.values()];
      state.pinching = true; state.dragging = null;
      state.pinchStartDistance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      state.pinchStartZoom = state.viewZoom;
      return;
    }
  }
  const r = overlayCanvas.getBoundingClientRect();
  const cx = (ev.clientX - r.left) / r.width * overlayCanvas.width, cy = (ev.clientY - r.top) / r.height * overlayCanvas.height;
  const src = findSource(cx, cy), probe = findProbe(cx, cy);
  state.dragMoved = false;
  if (state.mode === "source" && src) { state.selectedSource = src.id; state.dragging = { type: "source", id: src.id }; syncSelected(); renderSourceList(); }
  else if (state.mode === "probe" && probe) { state.selectedProbe = probe.id; state.dragging = { type: "probe", id: probe.id }; }
  else state.dragging = null;
});

overlayCanvas.addEventListener("pointermove", (ev) => {
  if (state.pointers.has(ev.pointerId)) state.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (state.pinching && state.pointers.size >= 2) {
    const p = [...state.pointers.values()], d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    setZoom(state.pinchStartZoom * d / state.pinchStartDistance);
    invalidateField(); state.dragMoved = true; return;
  }
  if (!state.dragging) return;
  const pos = canvasToWorld(ev.clientX, ev.clientY);
  state.dragMoved = true;
  if (state.dragging.type === "source") {
    const s = state.sources.find((x) => x.id === state.dragging.id);
    if (s) { s.x = pos.x; s.y = pos.y; invalidateField(); syncSelected(); }
  } else {
    const p = state.probes.find((x) => x.id === state.dragging.id);
    if (p) { p.x = pos.x; p.y = pos.y; p.history = []; }
  }
});

overlayCanvas.addEventListener("pointerup", (ev) => {
  const was = state.pinching;
  state.pointers.delete(ev.pointerId);
  if (state.pointers.size < 2) state.pinching = false;
  const pos = canvasToWorld(ev.clientX, ev.clientY);
  if (!was && !state.dragging && !state.dragMoved) {
    if (state.mode === "source") addSource(pos.x, pos.y);
    else addProbe(pos.x, pos.y);
  }
  state.dragging = null; state.dragMoved = false;
});

overlayCanvas.addEventListener("pointercancel", (ev) => {
  state.pointers.delete(ev.pointerId); state.pinching = state.pointers.size >= 2; state.dragging = null; state.dragMoved = false;
});
overlayCanvas.addEventListener("wheel", (ev) => { ev.preventDefault(); setZoom(state.viewZoom * Math.exp(-ev.deltaY * 0.0015)); invalidateField(); }, { passive: false });
overlayCanvas.addEventListener("dblclick", (ev) => {
  const r = overlayCanvas.getBoundingClientRect();
  const cx = (ev.clientX - r.left) / r.width * overlayCanvas.width, cy = (ev.clientY - r.top) / r.height * overlayCanvas.height;
  const probe = findProbe(cx, cy);
  if (state.mode === "probe" && probe) {
    if (state.audioProbeId === probe.id) stopAudio();
    state.probes = state.probes.filter((p) => p.id !== probe.id);
    state.selectedProbe = state.probes[0]?.id ?? null;
    return;
  }
  const src = findSource(cx, cy);
  if (src) {
    state.sources = state.sources.filter((s) => s.id !== src.id);
    state.selectedSource = state.sources[0]?.id ?? null;
    resetTime(); syncSelected(); renderSourceList();
  }
});

ui.sourceModeBtn.onclick = () => { state.mode = "source"; ui.sourceModeBtn.classList.add("active"); ui.probeModeBtn.classList.remove("active"); };
ui.probeModeBtn.onclick = () => { state.mode = "probe"; ui.probeModeBtn.classList.add("active"); ui.sourceModeBtn.classList.remove("active"); };
ui.displayMode.onchange = () => setDisplayMode(ui.displayMode.value);
for (const input of [ui.colorScale, ui.fixedMin, ui.fixedMax, ui.colormap, ui.contours, ui.attenuation]) input.addEventListener("change", invalidateField);
ui.timeScale.oninput = () => { state.timeScale = Number(ui.timeScale.value); ui.timeScaleValue.textContent = `${state.timeScale.toFixed(3)}x`; };
ui.soundSpeed.onchange = () => { state.soundSpeed = Math.max(1, Number(ui.soundSpeed.value) || DEFAULT_C); ui.temperature.value = soundSpeedToTemp(state.soundSpeed); syncSelected(); resetTime(); };
ui.temperature.onchange = () => { state.soundSpeed = tempToSoundSpeed(Number(ui.temperature.value) || 0); ui.soundSpeed.value = state.soundSpeed.toFixed(1); syncSelected(); resetTime(); };
ui.presetSelect.onchange = () => loadPreset(ui.presetSelect.value);
ui.beamAngle.oninput = applyBeamSteering;
ui.beamControlMode.onchange = applyBeamSteering;
ui.movingSpeed.oninput = () => {
  ui.movingSpeedValue.textContent = `${Number(ui.movingSpeed.value).toFixed(1)} m/s`;
  for (const s of state.sources) if (s.moving) s.movingSpeed = Number(ui.movingSpeed.value);
};
ui.randomizeBtn.onclick = () => { for (const s of state.sources) s.phase = Math.random() * TWO_PI; invalidateField(); syncSelected(); renderSourceList(); };
ui.resetPhasesBtn.onclick = () => { for (const s of state.sources) s.phase = 0; invalidateField(); syncSelected(); renderSourceList(); };
for (const [n, c] of [[ui.srcAmp, "amp"], [ui.srcFreq, "freq"], [ui.srcWave, "wave"], [ui.srcPhase, "phase"], [ui.srcDelay, "delay"]]) n.addEventListener("input", () => updateSelectedFromInputs(c));
ui.srcControl.onchange = () => updateSelectedFromInputs("control");
ui.phaseUnit.onchange = () => syncSelected();
ui.muteBtn.onclick = () => { const s = state.sources.find((x) => x.id === state.selectedSource); if (s) s.mute = !s.mute; invalidateField(); syncSelected(); renderSourceList(); };
ui.soloBtn.onclick = () => { const s = state.sources.find((x) => x.id === state.selectedSource); if (s) s.solo = !s.solo; invalidateField(); syncSelected(); renderSourceList(); };
ui.deleteBtn.onclick = () => { if (state.selectedSource == null) return; state.sources = state.sources.filter((s) => s.id !== state.selectedSource); state.selectedSource = state.sources[0]?.id ?? null; resetTime(); syncSelected(); renderSourceList(); };
ui.sourceList.onclick = (ev) => {
  const row = ev.target.closest(".sourceRow"); if (!row) return;
  const s = state.sources.find((x) => x.id === Number(row.dataset.id)); if (!s) return;
  state.selectedSource = s.id;
  if (ev.target.dataset.action === "mute") s.mute = !s.mute;
  if (ev.target.dataset.action === "solo") s.solo = !s.solo;
  invalidateField(); syncSelected(); renderSourceList();
};
ui.probeTable.onclick = (ev) => {
  const id = Number(ev.target.dataset.id); if (!id) return;
  if (ev.target.dataset.audio === "play") playProbe(id);
  if (ev.target.dataset.audio === "stop" && state.audioProbeId === id) { stopAudio(); drawProbeTable(); }
};
ui.playPauseBtn.onclick = () => { state.playing = !state.playing; ui.playPauseBtn.textContent = state.playing ? labels[ui.languageSelect.value].pause : labels[ui.languageSelect.value].play; };
ui.stepBtn.onclick = () => { if (!state.playing) { state.time += 1 / 60 * state.timeScale; updateProbeHistories(true); } };
ui.resetBtn.onclick = resetTime;
ui.languageSelect.onchange = applyLanguage;

applyLanguage();
ui.temperature.value = soundSpeedToTemp(DEFAULT_C);
setDisplayMode("instant");
ui.presetSelect.value = "single";
loadPreset("single");
requestAnimationFrame(frame);
