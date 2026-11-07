// Browser port of pose_analyzer.py and the report scoring rules.
// Keep angles, thresholds and wording aligned with the Python source.

export const LM = {
  LEFT_EAR: 7, RIGHT_EAR: 8, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_HIP: 23, RIGHT_HIP: 24, LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

export const ITEM_NAMES = {
  1: "圓肩", 2: "胸椎後凸", 3: "脊椎側彎", 4: "肩膀高度差",
  5: "頭部姿勢", 6: "腰椎前凸", 7: "骨盆前傾", 8: "骨盆傾斜",
};

export const THRESHOLDS = {
  1: [3, 5], 2: [12, 15], 3: [2, 5], 4: [1, 2],
  5: [15, 20], 6: [5, 8], 7: [3, 5], 8: [1, 2],
};

export const ITEM_VIEW_PRIORITY = {
  1: ["side", "front", "back"], 2: ["side"], 3: ["back", "front"], 4: ["front", "back"],
  5: ["side"], 6: ["side"], 7: ["side"], 8: ["back", "front"],
};

export const STATUS_LABELS = { 維持: "正常", 警惕: "需留意", 危險: "建議評估" };
export const STATUS_POINTS = { 維持: 100, 警惕: 70, 危險: 40 };
const SEVERITY = { 維持: 0, 警惕: 1, 危險: 2 };
export const SIDE_CHAIN = ["EAR", "SHOULDER", "HIP", "KNEE", "ANKLE"];
const FACING_MIN_RATIO = 0.45;
const SIDE_MAX_RATIO = 0.35;

const degrees = (radians) => (radians * 180) / Math.PI;
const point = (landmarks, index, width, height) => [landmarks[index].x * width, landmarks[index].y * height];
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round2 = (value) => Math.round(value * 100) / 100;

// Python's round() is half-to-even; a 92.5 average must stay 92 to match the PDF.
export function pythonRound(value) {
  const floor = Math.floor(value);
  if (Math.abs(value - floor - 0.5) > 1e-9) return Math.round(value);
  return floor % 2 === 0 ? floor : floor + 1;
}

export function angle3Points(a, b, c) {
  const radians = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(a[1] - b[1], a[0] - b[0]);
  const angle = Math.abs(degrees(radians));
  return angle > 180 ? 360 - angle : angle;
}

const angleFromHorizontal = (a, b) => degrees(Math.atan2(b[1] - a[1], b[0] - a[0]));
const angleFromVertical = (a, b) => degrees(Math.atan2(b[0] - a[0], -(b[1] - a[1])));

// JS % keeps the dividend's sign, so wrap explicitly to match Python's modulo.
export function signedLineAngle(angle) {
  return ((((angle + 90) % 180) + 180) % 180) - 90;
}

function status(item, value) {
  const [warningAt, dangerAt] = THRESHOLDS[item];
  if (value > dangerAt) return "危險";
  if (value > warningAt) return "警惕";
  return "維持";
}

function result(item, angle, detail, method, confidence) {
  return {
    item,
    check_item: ITEM_NAMES[item],
    angle: round2(angle),
    status: status(item, angle),
    detail,
    method,
    confidence,
    unit: "°",
  };
}

// The Python view detector does not transfer to the browser model: nearly frontal
// people measure 0.6-0.7 against its 0.72 cutoff, and face visibility stays near 1
// from behind. Left/right shoulder order separates all three views instead.
export function facing(landmarks, width, height) {
  const leftShoulder = point(landmarks, LM.LEFT_SHOULDER, width, height);
  const rightShoulder = point(landmarks, LM.RIGHT_SHOULDER, width, height);
  const torsoHeight = distance(
    midpoint(leftShoulder, rightShoulder),
    midpoint(point(landmarks, LM.LEFT_HIP, width, height), point(landmarks, LM.RIGHT_HIP, width, height)),
  );
  const ratio = (leftShoulder[0] - rightShoulder[0]) / Math.max(torsoHeight, 1);
  if (ratio > FACING_MIN_RATIO) return "front";
  if (ratio < -FACING_MIN_RATIO) return "back";
  return Math.abs(ratio) < SIDE_MAX_RATIO ? "side" : "turning";
}

function coronalAnalyses(landmarks, width, height) {
  const leftShoulder = point(landmarks, LM.LEFT_SHOULDER, width, height);
  const rightShoulder = point(landmarks, LM.RIGHT_SHOULDER, width, height);
  const leftHip = point(landmarks, LM.LEFT_HIP, width, height);
  const rightHip = point(landmarks, LM.RIGHT_HIP, width, height);

  const shoulderAngle = Math.abs(signedLineAngle(angleFromHorizontal(rightShoulder, leftShoulder)));
  const hipAngle = Math.abs(signedLineAngle(angleFromHorizontal(rightHip, leftHip)));
  const trunkSigned = angleFromVertical(midpoint(leftHip, rightHip), midpoint(leftShoulder, rightShoulder));
  const scoliosisProxy = Math.abs(trunkSigned) + 0.5 * Math.abs(shoulderAngle - hipAngle);

  return [
    result(3, scoliosisProxy, trunkSigned > 0 ? "軀幹向右偏" : "軀幹向左偏",
      "肩膀中心、骨盆中心與水平差的脊椎側彎篩檢代理", "screening"),
    result(4, shoulderAngle, rightShoulder[1] < leftShoulder[1] ? "右肩較高" : "左肩較高",
      "左右肩連線相對水平線角度", "high"),
    result(8, hipAngle, rightHip[1] < leftHip[1] ? "右側骨盆較高" : "左側骨盆較高",
      "左右髖關鍵點連線相對水平線角度", "high"),
  ];
}

// Ear visibility saturates near 1 in the browser model, so compare the whole chain;
// a tie goes to the side nearer the camera (smaller z).
export function visibleSide(landmarks) {
  const total = (side, key) => SIDE_CHAIN.reduce((sum, name) => sum + landmarks[LM[`${side}_${name}`]][key], 0);
  const difference = total("LEFT", "visibility") - total("RIGHT", "visibility");
  if (Math.abs(difference) > 0.01) return difference > 0 ? "LEFT" : "RIGHT";
  return total("LEFT", "z") <= total("RIGHT", "z") ? "LEFT" : "RIGHT";
}

function sideAnalyses(landmarks, width, height) {
  const side = visibleSide(landmarks);
  const at = (name) => point(landmarks, LM[`${side}_${name}`], width, height);
  const [ear, shoulder, hip, knee, ankle] = SIDE_CHAIN.map(at);

  const neckAngle = Math.abs(angleFromVertical(shoulder, ear));
  const shoulderForward = Math.abs(angleFromVertical(hip, shoulder));
  const thoracicProxy = Math.abs(180 - angle3Points(ear, shoulder, hip));
  const lumbarProxy = Math.abs(180 - angle3Points(shoulder, hip, knee));
  const pelvicTiltProxy = Math.abs(shoulderForward - Math.abs(angleFromVertical(ankle, hip)));

  return [
    result(1, shoulderForward, "肩膀相對骨盆向前位移", "肩膀至骨盆線相對垂直線角度", "screening"),
    result(2, thoracicProxy, "上背屈曲代理角度", "耳、肩、髖三點夾角的胸椎後凸篩檢代理", "low"),
    result(5, neckAngle, "耳朵相對肩膀的前移角度", "耳肩線相對垂直線角度", "high"),
    result(6, lumbarProxy, "腰髖伸展代理角度", "肩、髖、膝三點夾角的腰椎前凸篩檢代理", "low"),
    result(7, pelvicTiltProxy, "軀幹與下肢垂直偏移差",
      "MediaPipe 無 ASIS/PSIS，使用軀幹與下肢線差作骨盆前傾代理", "low"),
  ];
}

export function analyzeView(landmarks, width, height, view) {
  return view === "side" ? sideAnalyses(landmarks, width, height) : coronalAnalyses(landmarks, width, height);
}

// Mirrors the report: each item comes from the first view that measured it.
export function selectItems(viewResults) {
  const items = [];
  for (const item of Object.keys(ITEM_VIEW_PRIORITY).map(Number)) {
    for (const view of ITEM_VIEW_PRIORITY[item]) {
      const found = viewResults[view]?.find((entry) => entry.item === item);
      if (found) {
        items.push({ ...found, view });
        break;
      }
    }
  }
  return items;
}

export function scoreAndGrade(items) {
  const total = items.reduce((sum, item) => sum + STATUS_POINTS[item.status], 0);
  const score = pythonRound(total / Math.max(items.length, 1));
  return { score, grade: score >= 85 ? "穩定" : score >= 65 ? "可提升" : "優先關注" };
}

export const bySeverity = (a, b) => SEVERITY[b.status] - SEVERITY[a.status] || a.item - b.item;

export function requiredLandmarks(landmarks, view) {
  if (view !== "side") {
    return [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP];
  }
  const side = visibleSide(landmarks);
  return SIDE_CHAIN.map((name) => LM[`${side}_${name}`]);
}

// Same 0.5 visibility and in-frame gate as simture/photos.py.
export function framingIssues(landmarks, view) {
  return requiredLandmarks(landmarks, view).filter((index) => {
    const { x, y, visibility } = landmarks[index];
    return visibility < 0.5 || x < 0 || x > 1 || y < 0 || y > 1;
  });
}

export function averageLandmarks(frames) {
  return frames[0].map((_, index) => {
    const mean = (key) => frames.reduce((sum, frame) => sum + frame[index][key], 0) / frames.length;
    return { x: mean("x"), y: mean("y"), z: mean("z"), visibility: mean("visibility") };
  });
}

export function movement(a, b) {
  const joints = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP];
  return joints.reduce((sum, index) => sum + Math.hypot(a[index].x - b[index].x, a[index].y - b[index].y), 0) / joints.length;
}
