import {
  ITEM_NAMES, ITEM_VIEW_PRIORITY, LM, SIDE_CHAIN, STATUS_LABELS, STATUS_POINTS, THRESHOLDS, analyzeView, averageLandmarks,
  bySeverity, facing, framingIssues, movement, scoreAndGrade, selectItems, visibleSide,
} from "./posture.js";
import {
  AGE_OPTIONS, CHILD_AGE, CHILD_NOTICE, DISCLAIMER, DISCOMFORT_ITEMS, DISCOMFORT_OPTIONS, GOALS,
  LIMITATIONS, NO_DISCOMFORT, PLANS, PROFILES, VIEWS, VIEW_LABELS, sampleViews,
} from "./content.js";

const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const BOOKING_URL = "https://simtureinc.com/";

const MAX_IMAGE_DIMENSION = 1280;
const HOLD_MS = 2000;
const TURN_MS = 4500;
const BACK_WAIT_MS = 8000;
const MAX_HOLD_MOVEMENT = 0.02;
const SMOOTH_FRAMES = 8;
const PROMPT_REPEAT_MS = 6000;
const RING_LENGTH = 2 * Math.PI * 46;

const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24],
  [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

const $ = (selector) => document.querySelector(selector);
const state = { age: null, discomfort: null, goal: null, views: {}, voice: true, facing: "user" };
let scan = null;
let landmarkerPromise = null;
let runningMode = null;
let audio = null;
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealer = "IntersectionObserver" in window && new IntersectionObserver((entries) => {
  entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
    entry.target.classList.add("in");
    revealer.unobserve(entry.target);
  });
}, { threshold: 0.05 });

function observeReveals(root) {
  root.querySelectorAll(".reveal:not(.in)").forEach((element) => {
    if (revealer) revealer.observe(element);
    else element.classList.add("in");
  });
}

function show(name) {
  document.querySelectorAll("[data-screen]").forEach((screen) => {
    screen.hidden = screen.dataset.screen !== name;
  });
  document.body.dataset.active = name;
  window.scrollTo(0, 0);
}

function loadLandmarker() {
  landmarkerPromise ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import(`${VISION_URL}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${VISION_URL}/wasm`);
    const create = (delegate) => PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.6,
    });
    runningMode = "VIDEO";
    return create("GPU").catch(() => create("CPU"));
  })();
  landmarkerPromise.catch(() => { landmarkerPromise = null; });
  return landmarkerPromise;
}

async function landmarkerFor(mode) {
  const landmarker = await loadLandmarker();
  if (runningMode !== mode) {
    await landmarker.setOptions({ runningMode: mode });
    runningMode = mode;
  }
  return landmarker;
}

function say(text) {
  if (!state.voice || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = 0.9;
  speechSynthesis.speak(utterance);
}

// A soft bell, so people facing away from the screen know a view was captured.
function chime() {
  if (!state.voice || !audio) return;
  const now = audio.currentTime;
  [[528, 0.14], [1056, 0.05], [1584, 0.02]].forEach(([frequency, level]) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 2.7);
  });
}

function drawSkeleton(context, landmarks, width, height, scale = 1) {
  const visible = (index) => landmarks[index].visibility >= 0.3;
  context.beginPath();
  for (const [a, b] of CONNECTIONS) {
    if (!visible(a) || !visible(b)) continue;
    context.moveTo(landmarks[a].x * width, landmarks[a].y * height);
    context.lineTo(landmarks[b].x * width, landmarks[b].y * height);
  }
  // The dark pass keeps the line readable over pale clothing.
  context.lineWidth = 5.5 * scale;
  context.strokeStyle = "rgba(47, 41, 35, 0.62)";
  context.stroke();
  context.lineWidth = 2.6 * scale;
  context.strokeStyle = "rgba(243, 236, 226, 0.95)";
  context.stroke();
  context.fillStyle = "#D9A77E";
  context.lineWidth = 1.6 * scale;
  context.strokeStyle = "rgba(47, 41, 35, 0.7)";
  for (const index of new Set(CONNECTIONS.flat())) {
    if (!visible(index)) continue;
    context.beginPath();
    context.arc(landmarks[index].x * width, landmarks[index].y * height, 4.5 * scale, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
}

function drawGuides(context, landmarks, width, height, view, scale) {
  const at = (index) => [landmarks[index].x * width, landmarks[index].y * height];
  const line = (a, b) => {
    context.beginPath();
    context.moveTo(...a);
    context.lineTo(...b);
    context.stroke();
  };
  context.lineWidth = 2 * scale;
  context.setLineDash([10 * scale, 8 * scale]);
  context.strokeStyle = "rgba(217, 167, 126, 0.95)";
  if (view === "side") {
    const side = visibleSide(landmarks);
    const chain = SIDE_CHAIN.map((name) => at(LM[`${side}_${name}`]));
    line([chain[4][0], 0], [chain[4][0], height]);
    context.setLineDash([]);
    context.lineWidth = 4 * scale;
    chain.slice(1).forEach((joint, index) => line(chain[index], joint));
    context.fillStyle = "rgba(217, 167, 126, 0.95)";
    context.beginPath();
    context.arc(...chain[0], 7 * scale, 0, Math.PI * 2);
    context.fill();
  } else {
    const extend = (a, b) => {
      const dx = (b[0] - a[0]) * 0.25;
      const dy = (b[1] - a[1]) * 0.25;
      line([a[0] - dx, a[1] - dy], [b[0] + dx, b[1] + dy]);
    };
    extend(at(LM.LEFT_SHOULDER), at(LM.RIGHT_SHOULDER));
    extend(at(LM.LEFT_HIP), at(LM.RIGHT_HIP));
    const hipCenter = (at(LM.LEFT_HIP)[0] + at(LM.RIGHT_HIP)[0]) / 2;
    line([hipCenter, 0], [hipCenter, height]);
  }
  context.setLineDash([]);
}

function annotate(source, landmarks, width, height, view) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (source) {
    context.drawImage(source, 0, 0, width, height);
  } else {
    context.fillStyle = "#2F2923";
    context.fillRect(0, 0, width, height);
  }
  const scale = Math.max(width, height) / 900;
  drawGuides(context, landmarks, width, height, view, scale);
  drawSkeleton(context, landmarks, width, height, scale);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function scaledSize(width, height) {
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function record(view, landmarks, source, width, height) {
  state.views[view] = {
    landmarks,
    analyses: analyzeView(landmarks, width, height, view),
    image: annotate(source, landmarks, width, height, view),
    aspect: width / height,
  };
}

function frameProblem(landmarks, view, elapsed, width, height) {
  if (!landmarks) return "請站到鏡頭前，讓身體進入畫面";
  const detected = facing(landmarks, width, height);
  if (view === "side" && detected !== "side") return "請轉成側身，讓身體側面朝向鏡頭";
  if (view === "front" && detected !== "front") return "請面向鏡頭站好";
  if (view === "back" && detected !== "back" && (detected !== "front" || elapsed < BACK_WAIT_MS)) return "請背對鏡頭站好";
  if (framingIssues(landmarks, view).length) {
    return view === "side" ? "請退後一點，讓頭頂到雙腳都入鏡" : "請調整距離，讓雙肩與骨盆都入鏡";
  }
  return null;
}

function setHold(progress) {
  $("#hold-ring").style.strokeDashoffset = RING_LENGTH * (1 - progress);
}

function renderSteps() {
  $("#scan-steps").innerHTML = VIEWS.map((view, index) => {
    const stateName = index < scan.index ? "done" : index === scan.index ? "active" : "";
    return `<li class="${stateName}">${view.title}</li>`;
  }).join("");
}

function prompt(text, { speak = true } = {}) {
  const now = performance.now();
  const changed = text !== scan.message;
  if (changed) {
    scan.message = text;
    $("#scan-message").textContent = text;
  }
  if (speak && (changed ? now - scan.spokenAt > 2500 : now - scan.spokenAt > PROMPT_REPEAT_MS)) {
    scan.spokenAt = now;
    say(text);
  }
}

function beginView(index) {
  const view = VIEWS[index];
  scan.index = index;
  scan.viewStart = performance.now();
  scan.readyAt = scan.viewStart + (index === 0 ? 1500 : TURN_MS);
  scan.held = [];
  scan.recent = [];
  scan.missed = 0;
  setHold(0);
  renderSteps();
  $("#scan-tip").textContent = view.tip;
  scan.spokenAt = 0;
  prompt(view.prompt);
}

function capture(frames) {
  const video = $("#scan-video");
  const view = VIEWS[scan.index].id;
  const { width, height } = scaledSize(video.videoWidth, video.videoHeight);
  record(view, averageLandmarks(frames), video, width, height);
  chime();
  const stage = document.querySelector(".stage");
  stage.classList.remove("captured");
  void stage.offsetWidth;
  stage.classList.add("captured");
  if (scan.index + 1 < VIEWS.length) {
    beginView(scan.index + 1);
  } else {
    say("掃描完成，正在產生報告");
    stopCamera();
    finish();
  }
}

// Single frames jitter across the facing cutoffs, so every check uses a short average.
function smoothedLandmarks(landmarks) {
  if (landmarks) {
    scan.recent = [...scan.recent, landmarks].slice(-SMOOTH_FRAMES);
    scan.missed = 0;
  } else if (++scan.missed > SMOOTH_FRAMES) {
    scan.recent = [];
  }
  return scan.recent.length ? averageLandmarks(scan.recent) : null;
}

function updateScan(landmarks) {
  const now = performance.now();
  const video = $("#scan-video");
  const smoothed = smoothedLandmarks(landmarks);
  if (now < scan.readyAt) return;
  const view = VIEWS[scan.index].id;
  const problem = frameProblem(smoothed, view, now - scan.viewStart, video.videoWidth, video.videoHeight);
  if (problem) {
    scan.held = [];
    setHold(0);
    prompt(problem);
    return;
  }
  if (scan.held.length && movement(scan.held[0].smoothed, smoothed) > MAX_HOLD_MOVEMENT) {
    scan.held = [];
    setHold(0);
    prompt("再穩一點，維持不動");
    return;
  }
  if (!landmarks) return;
  if (!scan.held.length) prompt("很好，放鬆呼吸，維持一下");
  scan.held.push({ at: now, landmarks, smoothed });
  const progress = (now - scan.held[0].at) / HOLD_MS;
  setHold(Math.min(progress, 1));
  if (progress >= 1) capture(scan.held.map((frame) => frame.landmarks));
}

function tick() {
  if (!scan) return;
  const video = $("#scan-video");
  if (video.readyState >= 2 && video.currentTime !== scan.lastTime) {
    scan.lastTime = video.currentTime;
    const canvas = $("#scan-overlay");
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const landmarks = scan.landmarker.detectForVideo(video, performance.now()).landmarks[0];
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (landmarks) drawSkeleton(context, landmarks, canvas.width, canvas.height, Math.max(canvas.width, canvas.height) / 900);
    updateScan(landmarks);
  }
  if (scan) scan.frame = requestAnimationFrame(tick);
}

async function openCamera() {
  const video = $("#scan-video");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: state.facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
  });
  video.srcObject?.getTracks().forEach((track) => track.stop());
  video.srcObject = stream;
  await video.play();
  const mirrored = state.facing === "user";
  document.querySelector(".stage").classList.toggle("mirrored", mirrored);
}

function stopCamera() {
  if (scan) cancelAnimationFrame(scan.frame);
  scan = null;
  const video = $("#scan-video");
  video.srcObject?.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}

function cameraErrorMessage(error) {
  if (!navigator.mediaDevices?.getUserMedia) return "這個瀏覽器無法使用相機，請改為上傳照片。";
  if (error?.name === "NotAllowedError") return "相機權限被拒絕。請在瀏覽器設定中允許相機，或改為上傳照片。";
  if (error?.name === "NotFoundError") return "找不到相機，請改為上傳照片。";
  return "相機無法啟動，請改為上傳照片。";
}

async function startCamera() {
  const errorBox = $("#setup-error");
  errorBox.hidden = true;
  audio ??= new AudioContext();
  audio.resume();
  try {
    state.views = {};
    const landmarker = await landmarkerFor("VIDEO");
    await openCamera();
    show("scan");
    scan = { landmarker, index: 0, held: [], message: "", spokenAt: 0, lastTime: -1, frame: 0 };
    beginView(0);
    tick();
  } catch (error) {
    stopCamera();
    errorBox.textContent = cameraErrorMessage(error);
    errorBox.hidden = false;
  }
}

function renderUploads() {
  $("#uploads").innerHTML = VIEWS.map((view) => `
    <label class="upload" data-view="${view.id}">
      <input type="file" accept="image/*">
      <img alt="" hidden>
      <strong>${view.title}照片</strong>
      <span class="upload-hint">${view.tip}</span>
    </label>`).join("");
  document.querySelectorAll(".upload input").forEach((input) => {
    input.addEventListener("change", () => input.files[0] && analyzeUpload(input.closest(".upload"), input.files[0]));
  });
}

async function analyzeUpload(card, file) {
  const view = card.dataset.view;
  const hint = card.querySelector(".upload-hint");
  const preview = card.querySelector("img");
  delete state.views[view];
  preview.hidden = true;
  card.classList.remove("failed", "done");
  hint.textContent = "分析中…";
  $("#upload-done").disabled = true;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const landmarker = await landmarkerFor("IMAGE");
    const landmarks = landmarker.detect(canvas).landmarks[0];
    const problem = frameProblem(landmarks, view, BACK_WAIT_MS, width, height);
    if (problem) {
      card.classList.add("failed");
      hint.textContent = `這張無法使用：${landmarks ? problem : "偵測不到足夠的人體關鍵點"}。請換一張。`;
      return;
    }
    record(view, landmarks, canvas, width, height);
    preview.src = state.views[view].image;
    preview.hidden = false;
    card.classList.add("done");
    hint.textContent = "分析完成";
    $("#upload-done").disabled = VIEWS.some(({ id }) => !state.views[id]);
  } catch {
    card.classList.add("failed");
    hint.textContent = "無法讀取這張圖片，請換一張。";
  }
}

function finish() {
  show("processing");
  const delay = calm() ? 300 : 2800;
  setTimeout(() => renderReport(false), delay);
}

function radarSvg(items) {
  const center = 170;
  const radius = 108;
  const position = (index, ratio) => {
    const angle = (Math.PI * 2 * index) / items.length - Math.PI / 2;
    return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio];
  };
  const polygon = (ratio) => items.map((_, index) => position(index, ratio).map((value) => value.toFixed(1)).join(",")).join(" ");
  const rings = [0.4, 0.7, 1].map((ratio) => `<polygon class="ring" points="${polygon(ratio)}"/>`).join("");
  const axes = items.map((_, index) => {
    const [x, y] = position(index, 1);
    return `<line class="ring" x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }).join("");
  const shape = items.map((item, index) => position(index, STATUS_POINTS[item.status] / 100).map((value) => value.toFixed(1)).join(",")).join(" ");
  const labels = items.map((item, index) => {
    const [x, y] = position(index, 1.2);
    const anchor = x < center - 8 ? "end" : x > center + 8 ? "start" : "middle";
    return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}">${item.check_item}</text>`;
  }).join("");
  return `<svg class="radar" viewBox="-50 0 440 340" role="img" aria-label="八項指標雷達圖">${rings}${axes}<polygon class="shape" points="${shape}"/>${labels}</svg>`;
}

function countUp(element, target) {
  if (calm()) return;
  const start = performance.now();
  const timer = setInterval(() => {
    const progress = Math.min((performance.now() - start) / 2200, 1);
    element.textContent = Math.round(target * (1 - (1 - progress) ** 3));
    if (progress === 1) clearInterval(timer);
  }, 33);
}

function gauge(item) {
  const [warningAt, dangerAt] = THRESHOLDS[item.item];
  const max = dangerAt * 1.6;
  const percent = (value) => `${Math.min((value / max) * 100, 100).toFixed(1)}%`;
  return `
    <div class="gauge" style="--warn:${percent(warningAt)};--danger:${percent(dangerAt)}">
      <span class="marker" style="left:${percent(item.angle)}"></span>
    </div>`;
}

function metricCard(item, related) {
  const profile = PROFILES[item.item];
  const proxy = item.confidence === "high" ? "" : `<span class="tag">代理量測</span>`;
  const relatedTag = related ? `<span class="tag accent">與你的不適部位相關</span>` : "";
  return `
    <details class="metric" data-status="${item.status}">
      <summary>
        <div class="metric-head">
          <h3>${item.check_item}</h3>
          <span class="status">${STATUS_LABELS[item.status]}</span>
        </div>
        <div class="metric-value"><strong>${item.angle.toFixed(1)}${item.unit}</strong><span>參考範圍 ${profile.range}．${VIEW_LABELS[item.view]}</span></div>
        ${gauge(item)}
        <div class="tags">${relatedTag}${proxy}</div>
      </summary>
      <div class="metric-body">
        <p>${item.detail}。${item.status === "維持" ? profile.definition : profile.coach}</p>
        <p><b>代表什麼</b>${profile.meaning}</p>
        <p><b>改善方向</b>${profile.directions.join("、")}</p>
        <p><b>建議人工評估</b>${profile.review}</p>
        <p class="method">量測方式：${item.method}</p>
      </div>
    </details>`;
}

function renderReport(sample) {
  const views = Object.fromEntries(VIEWS.map(({ id }) => [id, state.views[id].analyses]));
  const items = selectItems(views);
  const { score, grade } = scoreAndGrade(items);
  const flagged = items.filter((item) => item.status !== "維持").sort(bySeverity);
  const relatedItems = DISCOMFORT_ITEMS[state.discomfort] ?? [];
  const goal = GOALS.find(({ label }) => label === state.goal);
  const plan = goal && PLANS[goal.plan];
  const hasPain = state.discomfort && state.discomfort !== NO_DISCOMFORT;
  const today = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric" });
  const summary = flagged.length
    ? `八項指標中有 ${flagged.length} 項值得留意，最優先的是${flagged.slice(0, 2).map((item) => item.check_item).join("與")}。`
    : "八項指標都在參考範圍內，維持目前的活動習慣即可。";

  $("#report").innerHTML = `
    ${sample ? `<p class="sample-banner">這是範例報告，使用虛擬人體數據，不代表任何真人。</p>` : ""}
    <header class="report-head">
      <div>
        <p class="eyebrow">SIMTURE AI 體態報告</p>
        <h1>${grade}</h1>
        <p class="lead">${summary}</p>
        <p class="date">${today}</p>
      </div>
      <div class="score" style="--score:${score}">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"></circle><circle cx="60" cy="60" r="52" pathLength="100"></circle></svg>
        <div><strong>${score}</strong><span>／100</span></div>
      </div>
    </header>

    ${state.age === CHILD_AGE ? `<p class="notice">${CHILD_NOTICE}</p>` : ""}
    ${hasPain ? `<p class="notice">你回報了${state.discomfort}的不適。若有疼痛、麻木或暈眩，請優先由醫療或運動專業人員評估。</p>` : ""}

    <section class="report-block reveal">
      <h2>三視角分析</h2>
      <div class="captures">
        ${VIEWS.map(({ id, title }) => `
          <figure><img src="${state.views[id].image}" alt="${title}關鍵點分析圖"><figcaption>${title}</figcaption></figure>`).join("")}
      </div>
    </section>

    <section class="report-block overview reveal">
      <div>
        <h2>整體輪廓</h2>
        ${radarSvg(items)}
        <p class="method">分數換算：正常 100｜需留意 70｜建議評估 40</p>
      </div>
      <div>
        <h2>優先關注</h2>
        ${flagged.length ? `<ol class="priorities">${flagged.slice(0, 3).map((item) => `
          <li><strong>${item.check_item}</strong><span>${PROFILES[item.item].directions.join("、")}</span></li>`).join("")}</ol>`
          : `<p>目前沒有超出參考範圍的項目。</p>`}
      </div>
    </section>

    <section class="report-block reveal">
      <h2>八項指標</h2>
      <div class="metrics">
        ${[...items].sort(bySeverity).map((item) => metricCard(item, relatedItems.includes(item.item))).join("")}
      </div>
    </section>

    ${plan ? `
    <section class="report-block plan reveal">
      <div class="plan-copy">
        <p class="eyebrow">依你的目標推薦</p>
        <h2>${plan.name}</h2>
        <p>${plan.duration}．${plan.suitable}</p>
        <ul>${plan.contents.map((content) => `<li>${content}</li>`).join("")}</ul>
        <a class="btn primary" href="${BOOKING_URL}" target="_blank" rel="noopener">預約教練現場評估</a>
      </div>
      <img src="assets/plumb.webp" alt="" loading="lazy">
    </section>` : ""}

    <section class="report-block fine-print">
      <h2>檢測限制</h2>
      <ul>${LIMITATIONS.map((text) => `<li>${text}</li>`).join("")}</ul>
      <p>${DISCLAIMER}</p>
    </section>

    <div class="actions report-actions">
      <button class="btn primary" id="print-report">存成 PDF</button>
      <button class="btn ghost" id="restart">重新開始</button>
    </div>`;

  show("report");
  observeReveals($("#report"));
  countUp($(".score strong"), score);
  $("#print-report").addEventListener("click", () => window.print());
  $("#restart").addEventListener("click", restart);
}

function restart() {
  Object.assign(state, { age: null, discomfort: null, goal: null, views: {} });
  $("#intake-form").reset();
  $("#intake-next").disabled = true;
  $("#report").innerHTML = "";
  renderUploads();
  show("intro");
}

const loadImage = (src) => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});
const figureImage = (view) => loadImage(`assets/figure-${view}.webp`);

async function showSample() {
  const { size, landmarks } = sampleViews();
  const figures = await Promise.all(VIEWS.map(({ id }) => figureImage(id)));
  state.views = {};
  VIEWS.forEach(({ id }, index) => record(id, landmarks[id], figures[index], size.width, size.height));
  Object.assign(state, { age: AGE_OPTIONS[2], discomfort: DISCOMFORT_OPTIONS[1], goal: GOALS[1].label });
  renderReport(true);
}

function sampleItems() {
  const { size, landmarks } = sampleViews();
  return selectItems(Object.fromEntries(
    VIEWS.map(({ id }) => [id, analyzeView(landmarks[id], size.width, size.height, id)]),
  ));
}

function renderStory() {
  $("#indicators").innerHTML = Object.entries(ITEM_NAMES).map(([item, name]) => `
    <li><strong>${name}</strong><span>${VIEW_LABELS[ITEM_VIEW_PRIORITY[item][0]]}</span><p>${PROFILES[item].definition}</p></li>`).join("");
  const items = sampleItems();
  const { score, grade } = scoreAndGrade(items);
  $("#report-preview").innerHTML = `
    <div class="preview-figures" id="preview-figures"></div>
    <div class="preview-head">
      <div><span>範例</span><strong>${grade}</strong></div>
      <b>${score}<small>／100</small></b>
    </div>
    ${[...items].sort(bySeverity).slice(0, 3).map((item) => `
      <div class="metric preview-row" data-status="${item.status}">
        <div class="metric-head"><h3>${item.check_item}</h3><span class="status">${STATUS_LABELS[item.status]}</span></div>
        <div class="metric-value"><strong>${item.angle.toFixed(1)}${item.unit}</strong><span>參考範圍 ${PROFILES[item.item].range}</span></div>
        ${gauge(item)}
      </div>`).join("")}`;
  renderPreviewFigures();
}

async function renderPreviewFigures() {
  const { size, landmarks } = sampleViews();
  const figures = await Promise.all(VIEWS.map(({ id }) => figureImage(id)));
  $("#preview-figures").innerHTML = VIEWS.map(({ id, title }, index) => `
    <figure><img src="${annotate(figures[index], landmarks[id], size.width, size.height, id)}" alt="範例人台${title}分析圖"><figcaption>${title}</figcaption></figure>`).join("");
}

function renderChoices(selector, name, labels) {
  $(selector).innerHTML = labels.map((label) => `
    <label class="chip"><input type="radio" name="${name}" value="${label}"><span>${label}</span></label>`).join("");
}

function updateIntake() {
  const form = new FormData($("#intake-form"));
  state.age = form.get("age");
  state.discomfort = form.get("discomfort");
  state.goal = form.get("goal");
  $("#intake-next").disabled = !(state.age && state.discomfort && state.goal && $("#consent").checked);
}

async function enterSetup() {
  show("setup");
  const status = $("#model-status");
  const buttons = [$("#use-camera"), $("#use-upload")];
  status.textContent = "正在載入 AI 模型…";
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await loadLandmarker();
    status.textContent = "AI 模型已就緒";
    buttons.forEach((button) => { button.disabled = false; });
  } catch {
    status.textContent = "AI 模型載入失敗，請確認網路連線後重新整理頁面。";
  }
}

document.querySelectorAll("[data-start]").forEach((button) => {
  button.addEventListener("click", () => {
    loadLandmarker().catch(() => {});
    show("intake");
  });
});
document.querySelectorAll("[data-sample]").forEach((button) => button.addEventListener("click", showSample));
$("#intake-form").addEventListener("change", updateIntake);
$("#intake-form").addEventListener("submit", (event) => {
  event.preventDefault();
  enterSetup();
});
$("#use-camera").addEventListener("click", startCamera);
$("#use-upload").addEventListener("click", () => {
  state.views = {};
  renderUploads();
  $("#upload-done").disabled = true;
  show("upload");
});
$("#upload-done").addEventListener("click", finish);
$("#scan-exit").addEventListener("click", () => {
  stopCamera();
  speechSynthesis?.cancel();
  show("setup");
});
$("#voice-toggle").addEventListener("click", (event) => {
  state.voice = !state.voice;
  event.target.textContent = `聲音：${state.voice ? "開" : "關"}`;
  event.target.setAttribute("aria-pressed", String(state.voice));
  if (!state.voice) speechSynthesis?.cancel();
});
$("#camera-toggle").addEventListener("click", async () => {
  state.facing = state.facing === "user" ? "environment" : "user";
  try {
    await openCamera();
  } catch {
    state.facing = state.facing === "user" ? "environment" : "user";
    await openCamera();
  }
});
document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => show(button.dataset.go));
});
window.addEventListener("beforeprint", () => {
  document.querySelectorAll("details.metric").forEach((details) => { details.open = true; });
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("in"));
});
window.addEventListener("pagehide", stopCamera);

renderChoices("#age-options", "age", AGE_OPTIONS);
renderChoices("#discomfort-options", "discomfort", DISCOMFORT_OPTIONS);
renderChoices("#goal-options", "goal", GOALS.map(({ label }) => label));
renderUploads();
renderStory();
observeReveals(document);
$("#hold-ring").style.strokeDasharray = RING_LENGTH;
setHold(0);
show("intro");
