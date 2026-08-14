export type EvaluationVoice = "chest" | "middle" | "head" | "falsetto" | "mix";
export type EvaluationState = "good" | "watch" | "low" | "unavailable";
export type EvaluationMetricKey =
  | "pitchAccuracy" | "pitchStability" | "noteCoverage" | "pitchJumps"
  | "h1h2" | "hnr" | "cpp" | "highHarmonic"
  | "formantContinuity" | "timbreContinuity" | "volumeContinuity" | "connection";

export type EvaluationInput = Record<EvaluationMetricKey, number | null>;

export type EvaluationMetric = {
  key: EvaluationMetricKey;
  label: string;
  unit: string;
  value: number | null;
  range: [number, number];
  state: EvaluationState;
  score: number | null;
  tip: string;
};

export type EvaluationSection = {
  key: "pitch" | "quality" | "connection";
  title: string;
  subtitle: string;
  metrics: EvaluationMetric[];
};

type MetricMeta = { label: string; unit: string; tip: string };

export const EVALUATION_METRIC_META: Record<EvaluationMetricKey, MetricMeta> = {
  pitchAccuracy: { label: "피치 정확도", unit: "%", tip: "각 음의 가운데 구간을 작게 유지하며 목표음을 다시 들어보세요." },
  pitchStability: { label: "피치 안정도", unit: "%", tip: "호흡 압력을 일정하게 두고 한 음을 흔들림 없이 유지해보세요." },
  noteCoverage: { label: "음계 완주도", unit: "%", tip: "띵 소리 뒤 9개 음을 빠뜨리지 말고 끝까지 이어주세요." },
  pitchJumps: { label: "피치 점프", unit: "회", tip: "전환할 때 턱과 목의 힘을 줄이고 음 사이를 천천히 연결해보세요." },
  h1h2: { label: "H1-H2", unit: "dB", tip: "숨이 과하게 새지 않도록 작은 음량에서 소리의 중심을 모아보세요." },
  hnr: { label: "HNR", unit: "dB", tip: "한 모음을 일정하게 유지하고 주변 소음이 없는 곳에서 연습하세요." },
  cpp: { label: "CPP", unit: "dB", tip: "숨을 밀기보다 성대 접촉이 끊기지 않는 편안한 소리를 찾아보세요." },
  highHarmonic: { label: "고배음 에너지", unit: "%", tip: "모음을 또렷하게 유지하고 목을 누르지 않은 밝은 소리를 시도해보세요." },
  formantContinuity: { label: "포먼트 연속성", unit: "%", tip: "음이 올라가도 입 모양을 갑자기 바꾸지 말고 모음을 일정하게 유지하세요." },
  timbreContinuity: { label: "음색 연속성", unit: "%", tip: "중간 음역에서 볼륨을 줄이며 음색 변화를 완만하게 만들어보세요." },
  volumeContinuity: { label: "음량 연속성", unit: "%", tip: "높은 음에서 밀어붙이지 말고 모든 음을 비슷한 크기로 불러보세요." },
  connection: { label: "성구 연결", unit: "%", tip: "립트릴이나 ‘우’ 사이렌으로 전환 구간을 작고 부드럽게 반복하세요." },
};

export const VOICE_EVALUATION_PROFILES: Record<EvaluationVoice, { label: string; targets: Record<EvaluationMetricKey, [number, number]> }> = {
  chest: { label: "흉성", targets: {
    pitchAccuracy: [80, 100], pitchStability: [76, 100], noteCoverage: [85, 100], pitchJumps: [0, 2],
    h1h2: [-8, 5], hnr: [14, 28], cpp: [11, 20], highHarmonic: [14, 30],
    formantContinuity: [65, 100], timbreContinuity: [72, 100], volumeContinuity: [72, 100], connection: [65, 100],
  } },
  middle: { label: "중성", targets: {
    pitchAccuracy: [80, 100], pitchStability: [76, 100], noteCoverage: [85, 100], pitchJumps: [0, 2],
    h1h2: [-3, 9], hnr: [12, 25], cpp: [9, 18], highHarmonic: [10, 24],
    formantContinuity: [72, 100], timbreContinuity: [76, 100], volumeContinuity: [72, 100], connection: [75, 100],
  } },
  head: { label: "두성", targets: {
    pitchAccuracy: [80, 100], pitchStability: [75, 100], noteCoverage: [85, 100], pitchJumps: [0, 2],
    h1h2: [-2, 10], hnr: [12, 24], cpp: [9, 18], highHarmonic: [8, 20],
    formantContinuity: [72, 100], timbreContinuity: [75, 100], volumeContinuity: [70, 100], connection: [76, 100],
  } },
  falsetto: { label: "가성", targets: {
    pitchAccuracy: [78, 100], pitchStability: [70, 100], noteCoverage: [82, 100], pitchJumps: [0, 3],
    h1h2: [8, 22], hnr: [6, 16], cpp: [5, 13], highHarmonic: [3, 14],
    formantContinuity: [62, 100], timbreContinuity: [68, 100], volumeContinuity: [65, 100], connection: [58, 100],
  } },
  mix: { label: "믹스보이스", targets: {
    pitchAccuracy: [82, 100], pitchStability: [78, 100], noteCoverage: [88, 100], pitchJumps: [0, 1],
    h1h2: [-4, 8], hnr: [13, 26], cpp: [10, 19], highHarmonic: [10, 24],
    formantContinuity: [78, 100], timbreContinuity: [82, 100], volumeContinuity: [78, 100], connection: [84, 100],
  } },
};

const SECTION_KEYS: Array<{ key: EvaluationSection["key"]; title: string; subtitle: string; metrics: EvaluationMetricKey[] }> = [
  { key: "pitch", title: "음정", subtitle: "목표음과 유지 구간 비교", metrics: ["pitchAccuracy", "pitchStability", "noteCoverage", "pitchJumps"] },
  { key: "quality", title: "배음 / 음질", subtitle: "원본 신호의 배음과 주기성", metrics: ["h1h2", "hnr", "cpp", "highHarmonic"] },
  { key: "connection", title: "공명 / 연결", subtitle: "음색·음량·성구 전환", metrics: ["formantContinuity", "timbreContinuity", "volumeContinuity", "connection"] },
];

function distanceFromRange(value: number, range: [number, number]) {
  if (value < range[0]) return range[0] - value;
  if (value > range[1]) return value - range[1];
  return 0;
}

export function evaluationTolerance(range: [number, number]) {
  return Math.max((range[1] - range[0]) * 0.28, 2);
}

export function evaluateValue(value: number | null, range: [number, number]): { state: EvaluationState; score: number | null } {
  if (value === null || !Number.isFinite(value)) return { state: "unavailable", score: null };
  const distance = distanceFromRange(value, range);
  if (distance === 0) return { state: "good", score: 100 };
  const tolerance = evaluationTolerance(range);
  if (distance <= tolerance) return { state: "watch", score: Math.round(100 - distance / tolerance * 35) };
  const score = Math.max(0, Math.round(65 - (distance - tolerance) / (tolerance * 2) * 65));
  return { state: "low", score };
}

export function formatEvaluationTarget(range: [number, number], unit: string) {
  if (range[1] === 100 && unit === "%") return `${range[0]}% 이상`;
  return `${range[0]}–${range[1]}${unit}`;
}

export function buildVoiceEvaluation(voice: EvaluationVoice, input: EvaluationInput) {
  const profile = VOICE_EVALUATION_PROFILES[voice];
  const sections = SECTION_KEYS.map((section): EvaluationSection => ({
    key: section.key,
    title: section.title,
    subtitle: section.subtitle,
    metrics: section.metrics.map((key) => {
      const value = input[key];
      const result = evaluateValue(value, profile.targets[key]);
      return { key, ...EVALUATION_METRIC_META[key], value, range: profile.targets[key], state: result.state, score: result.score };
    }),
  }));
  const scores = sections.flatMap((section) => section.metrics).map((metric) => metric.score).filter((score): score is number => score !== null);
  const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  return { voice, label: profile.label, score, sections };
}
