export type InputSignalState = "waiting" | "too-quiet" | "usable-soft" | "good" | "too-loud";

export type InputAssessment = {
  state: InputSignalState;
  label: string;
  snrDb: number | null;
  levelPercent: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function rmsToDbfs(rms: number) {
  return rms > 0 ? 20 * Math.log10(rms) : Number.NEGATIVE_INFINITY;
}

export function adaptivePitchThreshold(noiseFloor: number) {
  return Math.max(0.0022, noiseFloor * 1.65);
}

export function normalizeForPitch(buffer: Float32Array, rms: number) {
  let average = 0;
  for (let index = 0; index < buffer.length; index += 1) average += buffer[index];
  average /= Math.max(buffer.length, 1);
  const gain = clamp(0.075 / Math.max(rms, 1e-6), 1, 8);
  const normalized = new Float32Array(buffer.length);
  for (let index = 0; index < buffer.length; index += 1) normalized[index] = (buffer[index] - average) * gain;
  return normalized;
}

export function assessInputSignal(rms: number, peak: number, noiseFloor: number): InputAssessment {
  const snrDb = rms > 0 && noiseFloor > 0 ? 20 * Math.log10(rms / noiseFloor) : null;
  const dbfs = rmsToDbfs(rms);
  const levelPercent = Number.isFinite(dbfs) ? Math.round(clamp((dbfs + 60) / 42 * 100, 0, 100)) : 0;
  if (peak >= 0.96) return { state: "too-loud", label: "입력이 너무 커요. 휴대폰을 조금 멀리 놓아주세요.", snrDb, levelPercent: 100 };
  if (rms < 0.0022 || snrDb === null || snrDb < 7) return { state: "too-quiet", label: "입력이 너무 작거나 주변 소음에 묻혀 있어요.", snrDb, levelPercent };
  if (rms < 0.009) return { state: "usable-soft", label: "작지만 깨끗하게 입력되고 있어요.", snrDb, levelPercent };
  return { state: "good", label: "측정하기 좋은 크기예요.", snrDb, levelPercent };
}

export function requiresQuietRemeasure(meanRms: number, snrDb: number | null) {
  if (meanRms < 0.0026) return true;
  return meanRms < 0.008 && (snrDb === null || snrDb < 8);
}
