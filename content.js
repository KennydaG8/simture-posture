// Report copy ported from posture_config.py; update both when wording changes.

export const VIEW_LABELS = { front: "正面", side: "側面", back: "背面" };

export const VIEWS = [
  {
    id: "front",
    title: "正面",
    prompt: "請面向鏡頭站好，雙手自然垂放",
    tip: "從頭頂到大腿中段入鏡，雙肩與骨盆都要看得到。",
  },
  {
    id: "side",
    title: "側面",
    prompt: "請向右轉九十度，側身站好",
    tip: "從頭頂到雙腳完整入鏡，眼睛平視前方，不要刻意挺胸。",
  },
  {
    id: "back",
    title: "背面",
    prompt: "請再向右轉九十度，背對鏡頭",
    tip: "頭髮不要遮住肩頸，雙手自然垂放。",
  },
];

export const AGE_OPTIONS = ["18 歲以下", "18～29 歲", "30～44 歲", "45～59 歲", "60 歲以上"];
export const CHILD_AGE = "18 歲以下";

export const DISCOMFORT_OPTIONS = ["無明顯不適", "肩頸", "上背／胸椎", "下背／骨盆", "膝蓋／腳踝", "其他"];
export const NO_DISCOMFORT = "無明顯不適";

export const DISCOMFORT_ITEMS = {
  肩頸: [1, 4, 5],
  "上背／胸椎": [1, 2],
  "下背／骨盆": [6, 7, 8],
  "膝蓋／腳踝": [8],
};

export const GOALS = [
  { label: "建立運動基礎、初次接觸體態訓練", plan: "A" },
  { label: "改善腰痠背痛、骨盆歪斜或姿勢異常", plan: "B" },
  { label: "同時改善體態、身材與減脂", plan: "C" },
];

export const PLANS = {
  A: {
    name: "體態改善體驗方案",
    duration: "4 週，每週 2 堂，共 8 堂",
    contents: ["AI 體態檢測 2 次", "活動度及柔軟度訓練", "核心訓練", "居家動作指導"],
    suitable: "第一次接觸運動，希望建立基礎活動能力者",
  },
  B: {
    name: "體態重建方案",
    duration: "8 週，每週 2 堂，共 16 堂",
    contents: ["AI 體態檢測 4 次", "活動度及柔軟度訓練", "動作矯正", "肌力建立"],
    suitable: "腰痠背痛、骨盆歪斜或姿勢異常族群",
  },
  C: {
    name: "體態＋減脂方案",
    duration: "12 週",
    contents: ["活動度及柔軟度訓練", "動作矯正", "肌力建立", "體態改善", "重量訓練", "飲食追蹤", "AI 體態檢測 4 次"],
    suitable: "希望同時改善身材、體態與運動能力者",
  },
};

export const PROFILES = {
  1: {
    definition: "肩峰相對耳垂向前位移的程度。",
    coach: "肩膀有向前位移的趨勢，常與久坐或使用手機有關，可能增加肩頸負擔。",
    range: "0～3°",
    meaning: "肩膀相對軀幹向前，可能增加肩頸與肩關節前側負擔。",
    directions: ["胸肌活動度", "肩胛穩定控制", "上背伸展與拉力訓練"],
    review: "超過 5°、肩部疼痛、手臂麻木或抬手受限時。",
  },
  2: {
    definition: "上背部彎曲程度。",
    coach: "上背有後凸趨勢，可能影響呼吸效率與肩關節活動度。",
    range: "0～12°",
    meaning: "上背彎曲增加，可能伴隨圓肩、頭部前引及呼吸活動下降。",
    directions: ["胸椎伸展與旋轉活動", "上背肌力", "久坐姿勢調整"],
    review: "超過 15°、呼吸不適、明顯疼痛或僵硬持續時。",
  },
  3: {
    definition: "脊柱中線偏移程度。",
    coach: "身體左右受力可能不平均，建議搭配動態測試確認來源。",
    range: "0～2°",
    meaning: "肩膀中心與骨盆中心偏移，代表左右受力可能不平均。",
    directions: ["左右動作控制", "核心穩定", "單側負重習慣調整"],
    review: "超過 5°、外觀不對稱明顯、疼痛或疑似結構性側彎時。",
  },
  4: {
    definition: "左右肩峰高度差異。",
    coach: "左右肩高度有差異，可能與日常姿勢及受力習慣有關。",
    range: "0～1°",
    meaning: "左右肩峰高度不一致，可能反映提肩、單側慣用或軀幹偏移。",
    directions: ["肩胛控制", "頸肩張力平衡", "左右拉推動作控制"],
    review: "超過 2°、肩胛翹起、疼痛或上肢活動不對稱時。",
  },
  5: {
    definition: "耳垂相對肩峰向前位移程度。",
    coach: "頭部有向前位移的情況，可能增加頸椎與肩頸肌群壓力。",
    range: "0～15°",
    meaning: "頭部向前位移會增加頸椎與肩頸肌群的力矩負擔。",
    directions: ["深層頸屈肌控制", "胸椎活動度", "螢幕與手機使用姿勢"],
    review: "超過 20°、頭痛、暈眩、疼痛或麻木時。",
  },
  6: {
    definition: "骨盆與腰椎形成的前凸程度。",
    coach: "腰部有前凸傾向，可能增加下背部負擔。",
    range: "0～5°",
    meaning: "腰部前凸增加，可能伴隨骨盆前傾與下背壓力上升。",
    directions: ["核心控制", "臀肌力量", "髖屈肌活動度"],
    review: "超過 8°、持續下背痛、腿麻或動作受限時。",
  },
  7: {
    definition: "骨盆前後側形成的傾斜程度。",
    coach: "骨盆有向前傾斜趨勢，常見於久坐族群，可能增加腰部壓力。",
    range: "0～3°",
    meaning: "骨盆向前旋轉，可能使腰椎前凸與髖屈肌張力增加。",
    directions: ["骨盆中立控制", "臀肌與核心訓練", "髖屈肌活動度"],
    review: "超過 5°、下背或髖部疼痛，或動態測試異常時。",
  },
  8: {
    definition: "左右骨盆高度差。",
    coach: "左右骨盆受力可能不平均，建議搭配動態測試確認是否影響動作品質。",
    range: "0～1°",
    meaning: "左右骨盆高度不同，可能影響軀幹、膝部與步態受力。",
    directions: ["臀中肌控制", "單腳穩定", "左右負重平衡"],
    review: "超過 2°、疑似長短腳、步態異常、膝痛或腰痛時。",
  },
};

export const LIMITATIONS = [
  "肩胛骨內外旋、翼狀肩胛與貼胸程度無法只靠一般照片可靠判定，需教練觀察動作或觸診。",
  "骨盆後傾與骨盆前傾需 ASIS、PSIS 等解剖標記；目前照片結果僅為關鍵點代理量測。",
  "股骨與脛骨旋轉、膝內外翻、足弓及踝關節排列容易受鏡頭、站姿與鞋襪影響，不列入照片診斷。",
  "疼痛、麻木、暈眩、明顯左右無力或近期受傷者，應停止自我測試並由醫療或運動專業人員評估。",
];

export const DISCLAIMER = "本結果是人體關鍵點姿勢篩檢，不是 X 光或醫療診斷；脊椎曲度與骨盆前傾項目為代理量測。";
export const CHILD_NOTICE = "目前的角度門檻沒有孩童專用基準，結果僅供參考，不能取代醫療診斷、復健評估或兒童發展評估。";

const SAMPLE_SIZE = { width: 720, height: 1280 };

function buildLandmarks(joints, faceVisibility, farVisibility = 0.95) {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.2 }));
  for (const [index, [x, y, z = 0, visibility = 0.95]] of Object.entries(joints)) {
    landmarks[index] = { x, y, z, visibility };
  }
  [0, 2, 5].forEach((index) => (landmarks[index].visibility = faceVisibility));
  [8, 12, 14, 16, 24, 26, 28].forEach((index) => (landmarks[index].visibility = Math.min(landmarks[index].visibility, farVisibility)));
  return landmarks;
}

// Synthetic figure for the labelled sample report; no real person's data.
export function sampleViews() {
  const front = buildLandmarks({
    0: [0.5, 0.115], 2: [0.525, 0.1], 5: [0.475, 0.1], 7: [0.56, 0.115], 8: [0.44, 0.115],
    11: [0.68, 0.2605], 12: [0.32, 0.2552], 13: [0.74, 0.4], 14: [0.26, 0.4], 15: [0.75, 0.53], 16: [0.25, 0.53],
    23: [0.6, 0.5], 24: [0.4, 0.5], 25: [0.59, 0.7], 26: [0.41, 0.7], 27: [0.58, 0.91], 28: [0.42, 0.91],
  }, 0.98);
  const back = buildLandmarks({
    0: [0.5, 0.115], 2: [0.475, 0.1], 5: [0.525, 0.1], 7: [0.44, 0.115], 8: [0.56, 0.115],
    11: [0.32, 0.2605], 12: [0.68, 0.2552], 13: [0.26, 0.4], 14: [0.74, 0.4], 15: [0.25, 0.53], 16: [0.75, 0.53],
    23: [0.4, 0.5], 24: [0.6, 0.5], 25: [0.41, 0.7], 26: [0.59, 0.7], 27: [0.42, 0.91], 28: [0.58, 0.91],
  }, 0.1);
  const side = buildLandmarks({
    0: [0.35, 0.125], 2: [0.36, 0.11], 5: [0.36, 0.11], 7: [0.39, 0.13, -0.12], 8: [0.4, 0.13, 0.12, 0.3],
    11: [0.47, 0.25], 12: [0.48, 0.25, 0, 0.4], 13: [0.47, 0.4], 14: [0.48, 0.4, 0, 0.4], 15: [0.46, 0.52], 16: [0.47, 0.52, 0, 0.4],
    23: [0.5, 0.52], 24: [0.51, 0.52, 0, 0.4], 25: [0.505, 0.74], 26: [0.515, 0.74, 0, 0.4], 27: [0.5, 0.94], 28: [0.51, 0.94, 0, 0.4],
  }, 0.9);
  return { size: SAMPLE_SIZE, landmarks: { front, side, back } };
}
