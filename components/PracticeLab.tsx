"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { alignPitchSequence, type AlignedPitchNote } from "../lib/pitchAlignment";

export type TrainingVoice = "chest" | "middle" | "head" | "falsetto" | "mix";
export type VoiceProbabilities = Record<"chest" | "middle" | "head" | "falsetto", number>;

export type QualityReason = {
  code: "quiet" | "clipping" | "noise" | "pitch" | "short" | "overlap" | "movement";
  label: string;
  detail: string;
};

export type AcousticMetrics = {
  f0Mean: number | null;
  pitchAccuracy: number;
  pitchStability: number;
  relativeVolumeDb: number | null;
  h1h2: number | null;
  spectralTilt: number | null;
  highHarmonicRatio: number | null;
  hnr: number | null;
  cpp: number | null;
  formants: [number | null, number | null, number | null];
  timbreContinuity: number;
  pitchJumps: number;
  volumeContinuity: number;
  vibratoRate: number | null;
  vibratoExtent: number | null;
  vibratoRegularity: number | null;
  jitter: number | null;
  shimmer: number | null;
  onset: string;
  voicedDuration: number;
  totalDuration: number;
  noteResults: AlignedPitchNote[];
};

export type MeasurementQuality = {
  confidence: number;
  reliable: boolean;
  reasons: QualityReason[];
  snr: number | null;
  clippingPercent: number;
  voicedRatio: number;
  featureCoverage: number;
  noteCoverage: number;
};

export type PracticeResult = {
  id: string;
  date: string;
  score: number;
  pitchAccuracy: number;
  connection: number;
  stability: number;
  durationSeconds: number;
  range: string;
  distribution: VoiceProbabilities;
  selectedVoice?: TrainingVoice;
  target?: string;
  tempo?: number;
  metrics?: AcousticMetrics;
  quality?: MeasurementQuality;
};

type PracticeLabProps = {
  selectedVoice: TrainingVoice;
  onSelectedVoiceChange: (voice: TrainingVoice) => void;
  onComplete: (result: PracticeResult) => void;
};

type PracticeStage = "reference" | "microphone" | "checking" | "playing" | "ding" | "recording" | "analyzing";
type ReferenceStatus = "idle" | "playing" | "done";

type WebKitAudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

type PitchDetection = {
  frequency: number;
  exactMidi: number | null;
  rms: number;
  peak: number;
  clippingRatio: number;
  correlation: number;
};

type FrameFeature = {
  time: number;
  targetIndex: number;
  targetMidi: number;
  frequency: number;
  exactMidi: number | null;
  centsError: number | null;
  rms: number;
  peak: number;
  clippingRatio: number;
  correlation: number;
  h1h2: number | null;
  spectralTilt: number | null;
  highHarmonicRatio: number | null;
  hnr: number | null;
  cpp: number | null;
  centroid: number | null;
  formants: [number | null, number | null, number | null];
  timbre: number[] | null;
};

const SCALE_INTERVALS = [0, 2, 4, 5, 7, 5, 4, 2, 0];
const SCALE_NAMES = ["도", "레", "미", "파", "솔", "파", "미", "레", "도"];
const NOTE_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const NATURAL_NOTES = [
  { ko: "도", pitchClass: 0 }, { ko: "레", pitchClass: 2 }, { ko: "미", pitchClass: 4 },
  { ko: "파", pitchClass: 5 }, { ko: "솔", pitchClass: 7 }, { ko: "라", pitchClass: 9 },
  { ko: "시", pitchClass: 11 }, { ko: "도", pitchClass: 12 },
];
const TEMPOS = [{ label: "느리게", bpm: 60 }, { label: "보통", bpm: 76 }, { label: "빠르게", bpm: 92 }];
const VOICES: { key: TrainingVoice; label: string }[] = [
  { key: "chest", label: "흉성" }, { key: "middle", label: "중성" }, { key: "head", label: "두성" },
  { key: "falsetto", label: "가성" }, { key: "mix", label: "믹스보이스" },
];
const VOICE_NAMES: Record<TrainingVoice, string> = { chest: "흉성", middle: "중성", head: "두성", falsetto: "가성", mix: "믹스보이스" };
const FOUR_VOICE_NAMES: Record<keyof VoiceProbabilities, string> = { chest: "흉성", middle: "중성", head: "두성", falsetto: "가성" };

export const REMEASUREMENT_GUIDANCE = [
  ["소리가 너무 작음", "평소 말하는 정도 이상의 편안한 음량으로 불러주세요."],
  ["입력 찢어짐", "너무 크게 불러 파형이 잘리면 휴대폰을 조금 더 멀리 놓아주세요."],
  ["주변 소음이 큼", "TV·음악·선풍기를 끄고 조용한 공간에서 다시 측정해요."],
  ["음정이 검출되지 않음", "말하거나 속삭이지 말고 한 가지 모음으로 또렷하게 불러주세요."],
  ["발성 시간이 짧음", "각 음을 정해진 박자 끝까지 유지하고 음계를 완주해 주세요."],
  ["다른 소리가 함께 녹음됨", "다른 사람의 목소리와 기준음이 끝난 뒤 ‘띵’ 소리부터 녹음해요."],
  ["휴대폰 위치가 크게 변함", "입에서 15~20cm 거리에 고정하고 연습 중 움직이지 마세요."],
] as const;

const MEASUREMENT_GROUPS = [
  { title: "음정", items: ["F0·현재 음정", "피치 정확도", "피치 안정도", "피치 점프", "비브라토", "Jitter 추정"] },
  { title: "배음·음질", items: ["상대 음량(RMS)", "H1·H2·배음", "H1-H2", "스펙트럼 기울기", "고배음 에너지", "HNR·CPP", "Shimmer 추정", "발성 시작"] },
  { title: "공명·연결", items: ["포먼트 F1·F2·F3", "음색 변화량", "음량 연속성", "발성 지속시간", "성구 연결"] },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const center = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2;
}

function averageNullable(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? mean(valid) : null;
}

function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function midiToNote(midi: number) {
  const rounded = Math.round(midi);
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

function createAudioContext() {
  const Constructor = window.AudioContext ?? (window as WebKitAudioWindow).webkitAudioContext;
  if (!Constructor) throw new Error("이 브라우저에서는 오디오 기능을 사용할 수 없습니다.");
  try { return new Constructor({ latencyHint: "interactive" }); } catch { return new Constructor(); }
}

function writeWavText(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function createWavUrl(midis: number[], beat: number, ding = false) {
  const sampleRate = 44_100;
  const noteDuration = ding ? 0.24 : Math.min(beat * 0.8, beat - 0.035);
  const totalSamples = Math.ceil(((ding ? 0.3 : midis.length * beat) + 0.05) * sampleRate);
  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeWavText(view, 0, "RIFF"); view.setUint32(4, 36 + dataSize, true); writeWavText(view, 8, "WAVE");
  writeWavText(view, 12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeWavText(view, 36, "data"); view.setUint32(40, dataSize, true);
  for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
    const time = sampleIndex / sampleRate;
    const noteIndex = ding ? 0 : Math.floor(time / beat);
    const noteTime = ding ? time : time - noteIndex * beat;
    let sample = 0;
    if (noteIndex < midis.length && noteTime < noteDuration) {
      const frequency = ding ? 880 : midiToFrequency(midis[noteIndex]);
      const attack = Math.min(1, noteTime / 0.018);
      const release = Math.max(0, Math.min(1, (noteDuration - noteTime) / (ding ? 0.18 : 0.09)));
      const fundamental = Math.sin(2 * Math.PI * frequency * noteTime);
      const overtone = ding ? Math.sin(2 * Math.PI * frequency * 1.5 * noteTime) * 0.3 : Math.sin(2 * Math.PI * frequency * 2 * noteTime) * 0.14;
      sample = (fundamental + overtone) * attack * release * (ding ? 0.34 : 0.42);
    }
    view.setInt16(44 + sampleIndex * 2, Math.round(clamp(sample, -1, 1) * 32_767), true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function playUrl(url: string) {
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = 1;
    audio.setAttribute("playsinline", "true");
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("소리를 재생하지 못했습니다.")); };
    audio.play().catch((error) => { URL.revokeObjectURL(url); reject(error); });
  });
}

function detectPitch(buffer: Float32Array, sampleRate: number, threshold: number): PitchDetection {
  let sum = 0;
  let average = 0;
  let peak = 0;
  let clipped = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const absolute = Math.abs(buffer[index]);
    sum += buffer[index] ** 2;
    average += buffer[index];
    peak = Math.max(peak, absolute);
    if (absolute >= 0.985) clipped += 1;
  }
  const rms = Math.sqrt(sum / buffer.length);
  const base = { frequency: 0, exactMidi: null, rms, peak, clippingRatio: clipped / buffer.length, correlation: 0 };
  if (rms < threshold) return base;
  average /= buffer.length;
  const minLag = Math.floor(sampleRate / 1000);
  const maxLag = Math.min(Math.floor(sampleRate / 65), buffer.length - 2);
  const difference = new Float32Array(maxLag + 1);
  const normalizedDifference = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag += 1) {
    let value = 0;
    for (let index = 0; index < buffer.length - lag; index += 2) {
      const delta = (buffer[index] - average) - (buffer[index + lag] - average);
      value += delta * delta;
    }
    difference[lag] = value;
  }
  let runningSum = 0;
  normalizedDifference[0] = 1;
  for (let lag = 1; lag <= maxLag; lag += 1) {
    runningSum += difference[lag];
    normalizedDifference[lag] = runningSum > 0 ? difference[lag] * lag / runningSum : 1;
  }
  let bestLag = -1;
  for (let lag = minLag; lag < maxLag; lag += 1) {
    if (normalizedDifference[lag] < 0.18 && normalizedDifference[lag] <= normalizedDifference[lag + 1]) {
      bestLag = lag;
      break;
    }
  }
  if (bestLag < 0) {
    let bestValue = 1;
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      if (normalizedDifference[lag] < bestValue) { bestValue = normalizedDifference[lag]; bestLag = lag; }
    }
  }
  const correlation = bestLag > 0 ? clamp(1 - normalizedDifference[bestLag], 0, 1) : 0;
  if (bestLag < 0 || correlation < 0.42) return { ...base, correlation };
  const before = normalizedDifference[Math.max(minLag, bestLag - 1)];
  const center = normalizedDifference[bestLag];
  const after = normalizedDifference[Math.min(maxLag, bestLag + 1)];
  const denominator = before - 2 * center + after;
  const adjustment = Math.abs(denominator) > 1e-8 ? clamp(0.5 * (before - after) / denominator, -0.5, 0.5) : 0;
  const frequency = sampleRate / (bestLag + adjustment);
  return { ...base, frequency, exactMidi: 69 + 12 * Math.log2(frequency / 440), correlation };
}

function peakDb(spectrum: Float32Array, frequency: number, resolution: number) {
  const center = Math.round(frequency / resolution);
  const radius = Math.max(1, Math.round(35 / resolution));
  let value = -160;
  for (let index = Math.max(1, center - radius); index <= Math.min(spectrum.length - 1, center + radius); index += 1) value = Math.max(value, spectrum[index]);
  return value > -150 ? value : null;
}

function bandPower(spectrum: Float32Array, resolution: number, low: number, high: number) {
  let power = 0;
  for (let index = Math.max(1, Math.floor(low / resolution)); index <= Math.min(spectrum.length - 1, Math.ceil(high / resolution)); index += 1) {
    if (Number.isFinite(spectrum[index])) power += 10 ** (spectrum[index] / 10);
  }
  return power;
}

function estimateFormant(spectrum: Float32Array, resolution: number, low: number, high: number) {
  const start = Math.max(2, Math.floor(low / resolution));
  const end = Math.min(spectrum.length - 3, Math.ceil(high / resolution));
  const radius = Math.max(1, Math.round(90 / resolution));
  let bestIndex = -1;
  let best = -Infinity;
  for (let index = start; index <= end; index += 1) {
    let smoothed = 0;
    let count = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const value = spectrum[index + offset];
      if (Number.isFinite(value)) { smoothed += value; count += 1; }
    }
    if (count && smoothed / count > best) { best = smoothed / count; bestIndex = index; }
  }
  return bestIndex > 0 ? Math.round(bestIndex * resolution) : null;
}

function estimateCpp(spectrum: Float32Array, sampleRate: number, fftSize: number, frequency: number) {
  const resolution = sampleRate / fftSize;
  const maxBin = Math.min(spectrum.length - 1, Math.floor(5000 / resolution));
  const targetQ = Math.round(sampleRate / frequency);
  const cepstrumAt = (q: number) => {
    let total = 0;
    let count = 0;
    for (let bin = 1; bin <= maxBin; bin += 2) {
      if (!Number.isFinite(spectrum[bin])) continue;
      total += spectrum[bin] * Math.cos((2 * Math.PI * bin * q) / fftSize);
      count += 1;
    }
    return count ? total / count : 0;
  };
  let peak = -Infinity;
  for (let q = Math.max(2, targetQ - 3); q <= targetQ + 3; q += 1) peak = Math.max(peak, cepstrumAt(q));
  const baseline: number[] = [];
  for (let q = Math.floor(sampleRate / 1000); q <= Math.min(Math.floor(sampleRate / 65), fftSize / 2); q += Math.max(8, Math.floor(targetQ / 3))) baseline.push(cepstrumAt(q));
  return clamp(peak - median(baseline), 0, 35);
}

function spectralFeatures(spectrum: Float32Array, sampleRate: number, fftSize: number, frequency: number) {
  const resolution = sampleRate / fftSize;
  const harmonicValues: number[] = [];
  for (let harmonic = 1; harmonic <= 8 && frequency * harmonic < Math.min(5000, sampleRate / 2); harmonic += 1) {
    const value = peakDb(spectrum, frequency * harmonic, resolution);
    if (value !== null) harmonicValues.push(value);
  }
  const h1h2 = harmonicValues.length >= 2 ? harmonicValues[0] - harmonicValues[1] : null;
  let spectralTilt: number | null = null;
  if (harmonicValues.length >= 4) {
    const xs = harmonicValues.map((_, index) => Math.log2(index + 1));
    const xMean = mean(xs);
    const yMean = mean(harmonicValues);
    const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
    spectralTilt = denominator ? xs.reduce((sum, x, index) => sum + (x - xMean) * (harmonicValues[index] - yMean), 0) / denominator : null;
  }
  const totalPower = bandPower(spectrum, resolution, 80, 5000);
  const highPower = bandPower(spectrum, resolution, 1500, 5000);
  const highHarmonicRatio = totalPower > 0 ? (highPower / totalPower) * 100 : null;
  let weighted = 0;
  let spectralTotal = 0;
  for (let index = Math.max(1, Math.floor(80 / resolution)); index <= Math.min(spectrum.length - 1, Math.ceil(5000 / resolution)); index += 1) {
    const power = Number.isFinite(spectrum[index]) ? 10 ** (spectrum[index] / 10) : 0;
    weighted += index * resolution * power; spectralTotal += power;
  }
  const centroid = spectralTotal > 0 ? weighted / spectralTotal : null;
  let harmonicPower = 0;
  for (let harmonic = 1; frequency * harmonic <= 5000; harmonic += 1) harmonicPower += bandPower(spectrum, resolution, frequency * harmonic - resolution * 1.5, frequency * harmonic + resolution * 1.5);
  const noisePower = Math.max(totalPower - harmonicPower, totalPower * 1e-6);
  const hnr = totalPower > 0 ? clamp(10 * Math.log10(Math.max(harmonicPower, 1e-12) / noisePower), -5, 45) : null;
  const cpp = estimateCpp(spectrum, sampleRate, fftSize, frequency);
  const formants: [number | null, number | null, number | null] = [
    estimateFormant(spectrum, resolution, 250, 1000),
    estimateFormant(spectrum, resolution, 900, 2500),
    estimateFormant(spectrum, resolution, 1800, 3500),
  ];
  const timbre = h1h2 !== null && spectralTilt !== null && highHarmonicRatio !== null && centroid !== null
    ? [h1h2 / 20, spectralTilt / 20, highHarmonicRatio / 30, centroid / 3000, (formants[0] ?? 600) / 1000, (formants[1] ?? 1600) / 2500]
    : null;
  return { h1h2, spectralTilt, highHarmonicRatio, hnr, cpp, centroid, formants, timbre };
}

function timbreDistance(a: number[], b: number[]) {
  return Math.sqrt(mean(a.map((value, index) => (value - b[index]) ** 2)));
}

function normalizeScores(scores: VoiceProbabilities): VoiceProbabilities {
  const exponentials = Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Math.exp(value * 2.2)])) as VoiceProbabilities;
  const total = Object.values(exponentials).reduce((sum, value) => sum + value, 0);
  const entries = Object.entries(exponentials).map(([key, value]) => [key, Math.round((value / total) * 100)]);
  const result = Object.fromEntries(entries) as VoiceProbabilities;
  const difference = 100 - Object.values(result).reduce((sum, value) => sum + value, 0);
  const top = (Object.entries(result) as [keyof VoiceProbabilities, number][]).sort((a, b) => b[1] - a[1])[0][0];
  result[top] += difference;
  return result;
}

function classifyVoice(metrics: AcousticMetrics, startMidi: number) {
  const pitchMidi = metrics.f0Mean ? 69 + 12 * Math.log2(metrics.f0Mean / 440) : startMidi;
  const upper = clamp((pitchMidi - startMidi) / 8, 0, 1);
  const closure = metrics.h1h2 === null ? 0.5 : clamp((8 - metrics.h1h2) / 18, 0, 1);
  const clarity = mean([
    metrics.hnr === null ? 0.5 : clamp((metrics.hnr - 4) / 20, 0, 1),
    metrics.cpp === null ? 0.5 : clamp(metrics.cpp / 14, 0, 1),
  ]);
  const harmonicDensity = mean([
    metrics.highHarmonicRatio === null ? 0.5 : clamp(metrics.highHarmonicRatio / 20, 0, 1),
    metrics.spectralTilt === null ? 0.5 : clamp((metrics.spectralTilt + 24) / 18, 0, 1),
  ]);
  const breathiness = mean([1 - closure, 1 - clarity, 1 - harmonicDensity]);
  const middlePitch = 1 - clamp(Math.abs(upper - 0.52) / 0.52, 0, 1);
  return normalizeScores({
    chest: 0.42 * closure + 0.34 * harmonicDensity + 0.24 * (1 - upper),
    middle: 0.42 * middlePitch + 0.3 * clarity + 0.28 * (1 - Math.abs(closure - 0.52)),
    head: 0.36 * upper + 0.36 * clarity + 0.28 * (1 - Math.abs(closure - 0.5)),
    falsetto: 0.42 * upper + 0.46 * breathiness + 0.12 * (1 - harmonicDensity),
  });
}

function analyzeSession(frames: FrameFeature[], noiseFloor: number, startMidi: number, selectedVoice: TrainingVoice, plannedDuration: number): PracticeResult {
  const valid = frames.filter((frame) => frame.exactMidi !== null && frame.frequency > 0);
  const targetMidis = SCALE_INTERVALS.map((interval) => startMidi + interval);
  const alignment = alignPitchSequence(
    valid.map((frame) => ({ time: frame.time, midi: frame.exactMidi!, confidence: frame.correlation })),
    targetMidis,
  );
  const alignedGroups = alignment.notes.map((note) => valid.filter((frame) => frame.time >= note.startTime && frame.time <= note.endTime));
  const totalDuration = frames.length > 1 ? Math.max(plannedDuration, frames.at(-1)!.time - frames[0].time) : plannedDuration;
  const frameDuration = frames.length > 1 ? totalDuration / frames.length : 0;
  const voicedDuration = valid.length * frameDuration;
  const pitchAccuracy = alignment.pitchAccuracy;
  const pitchStability = alignment.pitchStability;
  const pitchErrors = alignment.notes.flatMap((note, index) => alignedGroups[index]
    .map((frame) => (frame.exactMidi! - note.targetMidi) * 100)
    .filter((error) => Math.abs(error - note.errorCents) < 600));
  const validRms = valid.map((frame) => frame.rms);
  const meanRms = mean(validRms);
  const relativeVolumeDb = meanRms > 0 && noiseFloor > 0 ? 20 * Math.log10(meanRms / noiseFloor) : null;
  const h1h2 = averageNullable(valid.map((frame) => frame.h1h2));
  const spectralTilt = averageNullable(valid.map((frame) => frame.spectralTilt));
  const highHarmonicRatio = averageNullable(valid.map((frame) => frame.highHarmonicRatio));
  const hnr = averageNullable(valid.map((frame) => frame.hnr));
  const cpp = averageNullable(valid.map((frame) => frame.cpp));
  const formants: [number | null, number | null, number | null] = [0, 1, 2].map((index) => {
    const values = valid.map((frame) => frame.formants[index]).filter((value): value is number => value !== null);
    return values.length ? Math.round(median(values)) : null;
  }) as [number | null, number | null, number | null];
  const adjacent = alignedGroups.flatMap((group) => group.slice(1).map((frame, index) => [group[index], frame] as const))
    .filter(([a, b]) => b.time - a.time < 0.24);
  const timbreChanges = adjacent.filter(([a, b]) => a.timbre && b.timbre).map(([a, b]) => timbreDistance(a.timbre!, b.timbre!));
  const timbreContinuity = Math.round(clamp(100 - mean(timbreChanges) * 125, 0, 100));
  const pitchJumps = adjacent.filter(([a, b]) => Math.abs((b.exactMidi! - a.exactMidi!) * 100) > 115).length;
  const perNoteRms = alignedGroups.map((group) => group.map((frame) => frame.rms)).filter((values) => values.length >= 2).map(mean);
  const perNoteDb = perNoteRms.map((value) => 20 * Math.log10(Math.max(value, 1e-6)));
  const volumeContinuity = Math.round(clamp(100 - standardDeviation(perNoteDb) * 9, 0, 100));
  const connection = Math.round(clamp(mean([pitchStability, timbreContinuity, volumeContinuity, 100 - pitchJumps * 12]), 0, 100));
  const jitterPairs = adjacent;
  const jitter = jitterPairs.length ? mean(jitterPairs.map(([a, b]) => Math.abs(b.frequency - a.frequency) / Math.max((a.frequency + b.frequency) / 2, 1))) * 100 : null;
  const shimmer = jitterPairs.length ? mean(jitterPairs.map(([a, b]) => Math.abs(b.rms - a.rms) / Math.max((a.rms + b.rms) / 2, 1e-6))) * 100 : null;
  const vibratoIntervals: number[] = [];
  let crossings = 0;
  alignment.notes.forEach((note, index) => {
    const noteFrames = alignedGroups[index];
    if (noteFrames.length < 5) return;
    const noteErrors = noteFrames.map((frame) => (frame.exactMidi! - note.targetMidi) * 100);
    const center = median(noteErrors);
    let previousSign = Math.sign(noteErrors[0] - center);
    let previousCrossing: number | null = null;
    noteFrames.slice(1).forEach((frame, frameIndex) => {
      const sign = Math.sign(noteErrors[frameIndex + 1] - center);
      if (sign && previousSign && sign !== previousSign) {
        crossings += 1;
        if (previousCrossing !== null) vibratoIntervals.push(frame.time - previousCrossing);
        previousCrossing = frame.time;
      }
      if (sign) previousSign = sign;
    });
  });
  const vibratoRate = crossings >= 4 && voicedDuration > 0 ? clamp((crossings / 2) / voicedDuration, 0, 12) : null;
  const vibratoExtent = pitchErrors.length >= 10 ? standardDeviation(pitchErrors) * 2.8 : null;
  const vibratoRegularity = vibratoIntervals.length >= 3 ? Math.round(clamp(100 - (standardDeviation(vibratoIntervals) / Math.max(mean(vibratoIntervals), 0.01)) * 100, 0, 100)) : null;
  const firstValid = valid[0];
  const firstFrames = valid.slice(0, 5);
  const onset = !firstValid ? "측정되지 않음" : firstFrames.some((frame) => frame.clippingRatio > 0.002)
    ? "강한 시작 경향" : (averageNullable(firstFrames.map((frame) => frame.hnr)) ?? 10) < 7 || (averageNullable(firstFrames.map((frame) => frame.h1h2)) ?? 0) > 10
      ? "숨이 섞인 부드러운 시작" : "균형 잡힌 시작";
  const f0Mean = valid.length ? mean(valid.map((frame) => frame.frequency)) : null;
  const metrics: AcousticMetrics = {
    f0Mean, pitchAccuracy, pitchStability, relativeVolumeDb, h1h2, spectralTilt, highHarmonicRatio, hnr, cpp, formants,
    timbreContinuity, pitchJumps, volumeContinuity, vibratoRate, vibratoExtent, vibratoRegularity, jitter, shimmer, onset,
    voicedDuration, totalDuration, noteResults: alignment.notes,
  };
  const voicedRatio = frames.length ? valid.length / frames.length : 0;
  const clippingPercent = mean(frames.map((frame) => frame.clippingRatio)) * 100;
  const snr = relativeVolumeDb;
  const featureValues = [h1h2, spectralTilt, highHarmonicRatio, hnr, cpp, ...formants];
  const featureCoverage = Math.round((featureValues.filter((value) => value !== null).length / featureValues.length) * 100);
  const meanCorrelation = mean(valid.map((frame) => frame.correlation));
  const ambiguousRatio = frames.length ? frames.filter((frame) => frame.rms > Math.max(noiseFloor * 2.2, 0.006) && frame.correlation < 0.42).length / frames.length : 1;
  const coveredNotes = alignment.notes.filter((note) => note.sampleCount >= 3).length;
  const reasons: QualityReason[] = [];
  if (meanRms < Math.max(0.009, noiseFloor * 2.1)) reasons.push({ code: "quiet", label: "입력 음량 부족", detail: "목소리가 분석 가능한 크기보다 작았어요." });
  if (clippingPercent > 0.12) reasons.push({ code: "clipping", label: "입력 찢어짐", detail: "너무 큰 입력으로 파형 일부가 잘렸어요." });
  if (noiseFloor > 0.027 || (snr !== null && snr < 8)) reasons.push({ code: "noise", label: "주변 소음", detail: "목소리와 주변 소리를 충분히 분리하지 못했어요." });
  if (voicedRatio < 0.48 || meanCorrelation < 0.5) reasons.push({ code: "pitch", label: "음정 검출 부족", detail: "안정적인 기본주파수 F0가 충분히 검출되지 않았어요." });
  if (voicedDuration < plannedDuration * 0.48 || coveredNotes < 7 || alignment.noteCoverage < 78) reasons.push({ code: "short", label: "발성 길이 부족", detail: "목표 음계의 각 음과 비교할 만큼 길게 부른 구간이 부족했어요." });
  if (ambiguousRatio > 0.42) reasons.push({ code: "overlap", label: "다른 소리 혼입 의심", detail: "목소리 외의 소리 또는 겹친 소리가 많이 감지됐어요." });
  if (perNoteDb.length >= 5 && Math.max(...perNoteDb) - Math.min(...perNoteDb) > 14) reasons.push({ code: "movement", label: "위치 또는 음량 변화", detail: "연습 중 휴대폰 거리나 음량이 크게 달라졌어요." });
  const ratioScore = clamp((voicedRatio - 0.3) / 0.6, 0, 1) * 100;
  const correlationScore = clamp((meanCorrelation - 0.4) / 0.5, 0, 1) * 100;
  const snrScore = snr === null ? 0 : clamp((snr - 5) / 20, 0, 1) * 100;
  const clippingScore = clamp(100 - clippingPercent * 180, 0, 100);
  const durationScore = clamp(voicedDuration / Math.max(plannedDuration * 0.7, 1), 0, 1) * 100;
  let confidence = Math.round(ratioScore * 0.2 + correlationScore * 0.18 + snrScore * 0.15 + clippingScore * 0.1 + durationScore * 0.12 + featureCoverage * 0.15 + volumeContinuity * 0.1);
  if (reasons.some((reason) => ["quiet", "pitch", "short"].includes(reason.code))) confidence = Math.min(confidence, 62);
  if (reasons.length >= 2) confidence = Math.min(confidence, 66);
  const quality: MeasurementQuality = { confidence, reliable: confidence >= 72 && reasons.length === 0, reasons, snr, clippingPercent, voicedRatio: Math.round(voicedRatio * 100), featureCoverage, noteCoverage: alignment.noteCoverage };
  const distribution = classifyVoice(metrics, startMidi);
  const selectedSimilarity = selectedVoice === "mix" ? connection : distribution[selectedVoice];
  const score = Math.round(mean([pitchAccuracy, pitchStability, connection, selectedSimilarity, confidence]));
  const minMidi = valid.length ? Math.min(...valid.map((frame) => frame.exactMidi!)) : startMidi;
  const maxMidi = valid.length ? Math.max(...valid.map((frame) => frame.exactMidi!)) : startMidi;
  return {
    id: String(Date.now()),
    date: new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date()),
    score, pitchAccuracy, connection, stability: pitchStability, durationSeconds: Math.max(1, Math.round(totalDuration)),
    range: valid.length ? `${midiToNote(minMidi)}–${midiToNote(maxMidi)}` : "측정되지 않음",
    distribution, selectedVoice, target: `${midiToNote(startMidi)} · 5음계`, metrics, quality,
  };
}

function formatMetric(value: number | null, unit: string, digits = 1) {
  return value === null || !Number.isFinite(value) ? "측정 데이터 부족" : `${value.toFixed(digits)}${unit}`;
}

export function PracticeLab({ selectedVoice, onSelectedVoiceChange, onComplete }: PracticeLabProps) {
  const [stage, setStage] = useState<PracticeStage>("reference");
  const [draftOctave, setDraftOctave] = useState(4);
  const [draftPitchClass, setDraftPitchClass] = useState(0);
  const [draftTempo, setDraftTempo] = useState(76);
  const [startMidi, setStartMidi] = useState(60);
  const [tempo, setTempo] = useState(76);
  const [referenceStatus, setReferenceStatus] = useState<ReferenceStatus>("idle");
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [detectedNote, setDetectedNote] = useState("—");
  const [pitchDifference, setPitchDifference] = useState<number | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [progress, setProgress] = useState(0);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const framesRef = useRef<FrameFeature[]>([]);
  const noiseFloorRef = useRef(0.004);
  const startedAtRef = useRef(0);
  const recordingDurationRef = useRef(1);
  const processingRef = useRef(false);

  const beat = 60 / tempo;
  const targetMidis = useMemo(() => SCALE_INTERVALS.map((interval) => startMidi + interval), [startMidi]);
  const targetLabel = `${midiToNote(startMidi)} · 5음계 · ${TEMPOS.find((item) => item.bpm === tempo)?.label ?? `${tempo} BPM`}`;

  useEffect(() => () => stopMicrophone(), []);

  function stopMicrophone() {
    processingRef.current = false;
    if (animationRef.current !== null) window.clearTimeout(animationRef.current);
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
    animationRef.current = null; finishTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; analyserRef.current = null;
    if (contextRef.current && contextRef.current.state !== "closed") contextRef.current.close().catch(() => undefined);
    contextRef.current = null;
  }

  async function openMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("이 브라우저에서는 마이크 분석을 사용할 수 없습니다.");
    const context = createAudioContext();
    if (context.state !== "running") await context.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    const analyser = context.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.12;
    context.createMediaStreamSource(stream).connect(analyser);
    const [track] = stream.getAudioTracks();
    if (!track || track.readyState !== "live") throw new Error("휴대폰 마이크가 연결되지 않았습니다.");
    contextRef.current = context; streamRef.current = stream; analyserRef.current = analyser;
  }

  async function measureNoiseFloor() {
    const analyser = analyserRef.current;
    if (!analyser) return 0.004;
    const values: number[] = [];
    const waveform = new Float32Array(analyser.fftSize);
    for (let sample = 0; sample < 6; sample += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
      analyser.getFloatTimeDomainData(waveform);
      values.push(Math.sqrt(mean(Array.from(waveform, (value) => value ** 2))));
    }
    return Math.max(0.0015, median(values));
  }

  async function playReference() {
    setError(""); setReferenceStatus("playing");
    try {
      await playUrl(createWavUrl(targetMidis, 60 / tempo));
      setReferenceStatus("done");
    } catch {
      setReferenceStatus("idle");
      setError("기준 음계를 재생하지 못했습니다. 아이폰의 미디어 음량과 출력 기기를 확인해주세요.");
    }
  }

  function applySettings() {
    const midi = 12 * (draftOctave + 1) + draftPitchClass;
    setStartMidi(clamp(midi, 48, 84));
    setTempo(draftTempo);
    setReferenceStatus("idle");
  }

  function changeSet(direction: -1 | 1) {
    setStartMidi((current) => clamp(current + direction, 48, 84));
    setReferenceStatus("idle");
  }

  function processRecording() {
    const analyser = analyserRef.current;
    if (!analyser || !processingRef.current) return;
    const now = performance.now();
    const elapsed = (now - startedAtRef.current) / 1000;
    const index = clamp(Math.floor(elapsed / beat), 0, SCALE_INTERVALS.length - 1);
    const waveform = new Float32Array(analyser.fftSize);
    const spectrum = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(waveform);
    analyser.getFloatFrequencyData(spectrum);
    const threshold = Math.max(0.0045, noiseFloorRef.current * 2.1);
    const pitch = detectPitch(waveform, analyser.context.sampleRate, threshold);
    const targetMidi = targetMidis[index];
    const spectral = pitch.frequency > 0 ? spectralFeatures(spectrum, analyser.context.sampleRate, analyser.fftSize, pitch.frequency) : null;
    const centsError = pitch.exactMidi === null ? null : (pitch.exactMidi - targetMidi) * 100;
    framesRef.current.push({ time: elapsed, targetIndex: index, targetMidi, ...pitch, centsError,
      h1h2: spectral?.h1h2 ?? null, spectralTilt: spectral?.spectralTilt ?? null,
      highHarmonicRatio: spectral?.highHarmonicRatio ?? null, hnr: spectral?.hnr ?? null, cpp: spectral?.cpp ?? null,
      centroid: spectral?.centroid ?? null, formants: spectral?.formants ?? [null, null, null], timbre: spectral?.timbre ?? null });
    setActiveIndex(index);
    setProgress(clamp((elapsed / recordingDurationRef.current) * 100, 0, 100));
    setInputLevel(clamp(Math.round(pitch.rms * 2000), 0, 100));
    if (pitch.exactMidi !== null) {
      setDetectedNote(midiToNote(pitch.exactMidi));
      setPitchDifference(Math.round(centsError ?? 0));
    } else {
      setDetectedNote("—"); setPitchDifference(null);
    }
    animationRef.current = window.setTimeout(processRecording, 95) as unknown as number;
  }

  async function startGuidedPractice() {
    setError(""); stopMicrophone();
    try {
      setStage("checking");
      await openMicrophone();
      noiseFloorRef.current = await measureNoiseFloor();
      setStage("playing");
      await playUrl(createWavUrl(targetMidis, beat));
      setStage("ding");
      await playUrl(createWavUrl([81], 0.3, true));
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      framesRef.current = [];
      startedAtRef.current = performance.now();
      const scaleDuration = beat * SCALE_INTERVALS.length;
      const recordingDuration = scaleDuration + Math.max(1.2, beat * 1.75);
      recordingDurationRef.current = recordingDuration;
      processingRef.current = true;
      setActiveIndex(0); setProgress(0); setStage("recording");
      processRecording();
      finishTimerRef.current = window.setTimeout(() => finishRecording(recordingDuration, scaleDuration), recordingDuration * 1000);
    } catch (caught) {
      stopMicrophone(); setStage("microphone");
      if (caught instanceof DOMException && (caught.name === "NotAllowedError" || caught.name === "SecurityError")) setError("마이크 권한이 꺼져 있습니다. 아이폰 설정 → Safari → 마이크에서 허용한 뒤 다시 눌러주세요.");
      else setError(caught instanceof Error ? caught.message : "마이크 연습을 시작하지 못했습니다.");
    }
  }

  function finishRecording(recordingDuration: number, plannedDuration: number) {
    if (!processingRef.current) return;
    processingRef.current = false;
    if (animationRef.current !== null) window.clearTimeout(animationRef.current);
    animationRef.current = null;
    setStage("analyzing");
    const result = analyzeSession(framesRef.current, noiseFloorRef.current, startMidi, selectedVoice, plannedDuration);
    stopMicrophone();
    window.setTimeout(() => onComplete({ ...result, tempo, durationSeconds: Math.round(recordingDuration) }), 420);
  }

  function abortRecording() {
    stopMicrophone(); setStage("microphone"); setProgress(0); setDetectedNote("—"); setPitchDifference(null); setInputLevel(0);
  }

  if (["checking", "playing", "ding", "recording", "analyzing"].includes(stage)) {
    const messages = {
      checking: ["환경 확인 중", "주변 소음 기준을 측정하고 있어요."],
      playing: ["목표 5음계 듣기", "설정한 음계를 먼저 듣고 기억하세요."],
      ding: ["띵! 녹음 시작", `${VOICE_NAMES[selectedVoice]}로 같은 음계를 불러주세요.`],
      recording: ["목소리 녹음 중", "배경음 없이 휴대폰 마이크가 목소리만 측정해요."],
      analyzing: ["음별 피치 정렬 중", "녹음한 소리를 9개 목표 음과 순서대로 비교하고 있어요."],
    } as const;
    const sessionMessage = messages[stage as keyof typeof messages];
    return (
      <section className="guided-session" aria-live="polite">
        <article className="surface-card session-panel">
          <span className="session-icon" aria-hidden="true">{stage === "recording" ? "●" : stage === "analyzing" ? "▥" : "♪"}</span>
          <p className="eyebrow">{stage === "recording" ? `${activeIndex + 1} / 9음` : "GUIDED PRACTICE"}</p>
          <h2>{sessionMessage[0]}</h2><p>{sessionMessage[1]}</p>
          {stage === "recording" && <>
            <div className="recording-target"><span>목표</span><strong>{midiToNote(targetMidis[activeIndex])}</strong><span>감지 {detectedNote}</span></div>
            <div className="session-scale" aria-label="도 레 미 파 솔 파 미 레 도">{SCALE_NAMES.map((name, index) => <span key={`${name}-${index}`} className={index === activeIndex ? "active" : ""}>{name}</span>)}</div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="live-readout"><span>입력 {inputLevel}%</span><strong>{pitchDifference === null ? "음정을 기다리는 중" : `${pitchDifference >= 0 ? "+" : ""}${pitchDifference} cent`}</strong></div>
            <button type="button" className="secondary-button" onClick={abortRecording}>녹음 중단</button>
          </>}
        </article>
      </section>
    );
  }

  return (
    <section aria-label="발성 연습">
      <div className="practice-mode-tabs" role="group" aria-label="연습 기능 선택">
        <button type="button" aria-pressed={stage === "reference"} onClick={() => setStage("reference")}>기준음계 듣기</button>
        <button type="button" aria-pressed={stage === "microphone"} onClick={() => setStage("microphone")}>마이크 연습</button>
      </div>

      {stage === "reference" && <>
        <div className="section-heading first-heading"><div><p className="eyebrow">기준음계 듣기</p><h2>연습할 5음계를 설정해요</h2></div></div>
        <div className="section-heading compact-heading"><h2>속도</h2><span>{TEMPOS.find((item) => item.bpm === draftTempo)?.label} · {draftTempo} BPM</span></div>
        <div className="choice-grid three">{TEMPOS.map((item) => <button type="button" key={item.bpm} aria-pressed={draftTempo === item.bpm} onClick={() => setDraftTempo(item.bpm)}>{item.label}</button>)}</div>
        <div className="section-heading compact-heading"><h2>옥타브</h2><span>3~5옥타브</span></div>
        <div className="choice-grid three">{[3, 4, 5].map((octave) => <button type="button" key={octave} aria-pressed={draftOctave === octave} onClick={() => setDraftOctave(octave)}>{octave}옥타브</button>)}</div>
        <div className="section-heading compact-heading"><h2>시작음</h2><span>선택한 음부터 5음계</span></div>
        <div className="note-choice-grid">{NATURAL_NOTES.map((note, index) => <button type="button" key={`${note.ko}-${index}`} aria-pressed={draftPitchClass === note.pitchClass} onClick={() => setDraftPitchClass(note.pitchClass)}><strong>{note.ko}</strong><small>{NOTE_NAMES[note.pitchClass % 12]}{note.pitchClass === 12 ? "↑" : ""}</small></button>)}</div>
        <button type="button" className="primary-button apply-scale" onClick={applySettings}>선택한 음계 적용</button>
        <article className="surface-card applied-scale-card">
          <div className="card-topline"><div><small>현재 적용된 설정</small><strong>{targetLabel}</strong></div><span className="type-label">5음계</span></div>
          <div className="scale-path static-scale">{SCALE_NAMES.map((name, index) => <span key={`${name}-${index}`}>{name}</span>)}</div>
          <p className="scale-note-line">{targetMidis.map(midiToNote).join("–")}</p>
          <div className="half-step-controls"><button type="button" onClick={() => changeSet(-1)} disabled={startMidi <= 48}>이전 세트 −반음</button><button type="button" onClick={() => changeSet(1)} disabled={startMidi >= 84}>다음 세트 +반음</button></div>
        </article>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button type="button" className="primary-button reference-bottom-button" disabled={referenceStatus === "playing"} aria-busy={referenceStatus === "playing"} onClick={playReference}>{referenceStatus === "playing" ? "기준음계 재생 중…" : referenceStatus === "done" ? "기준음계 다시 듣기" : "기준음계 듣기"}</button>
      </>}

      {stage === "microphone" && <>
        <div className="section-heading first-heading"><div><p className="eyebrow">마이크 연습</p><h2>목표와 측정 조건을 확인해요</h2></div></div>
        <article className="surface-card target-summary"><span className="eyebrow">목표 음정</span><h2>{targetLabel}</h2><p>{targetMidis.map(midiToNote).join("–")}</p></article>
        <div className="section-heading compact-heading"><h2>연습할 발성</h2><span>하나를 선택하세요</span></div>
        <div className="voice-choice-grid">{VOICES.map((voice) => <button type="button" key={voice.key} aria-pressed={selectedVoice === voice.key} onClick={() => onSelectedVoiceChange(voice.key)}>{voice.label}</button>)}</div>
        <div className="section-heading compact-heading"><h2>측정할 항목</h2><span>모든 항목을 함께 분석</span></div>
        <article className="surface-card measurement-groups">{MEASUREMENT_GROUPS.map((group) => <div key={group.title}><strong>{group.title}</strong><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}</article>
        <div className="section-heading compact-heading"><h2>정확한 측정 조건</h2><span>시작 전 확인</span></div>
        <article className="surface-card condition-card"><ul>
          <li>TV·음악·선풍기를 끄고 조용한 공간에서 연습해요.</li>
          <li>휴대폰을 입에서 15~20cm 떨어뜨려 고정해요.</li>
          <li>음계 전체를 같은 모음으로 불러요.</li>
          <li>기준음계가 끝나고 ‘띵’ 소리가 나면 시작해요.</li>
          <li>에어팟보다 휴대폰 내장 마이크를 사용해요.</li>
        </ul></article>
        <p className="silent-recording-note">녹음 중에는 배경음이 나오지 않으며 다음 세트도 자동으로 올라가지 않아요. 녹음 후 각 음의 유지 구간을 목표 음과 순서대로 다시 맞춰 평가해요.</p>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button type="button" className="primary-button practice-start-button" onClick={startGuidedPractice}>연습하기</button>
      </>}
    </section>
  );
}

type AnalysisExperienceProps = { result: PracticeResult | null; onRetry: () => void };

export function AnalysisExperience({ result, onRetry }: AnalysisExperienceProps) {
  const [retryResultId, setRetryResultId] = useState<string | null>(null);
  if (!result || !result.metrics || !result.quality) return <div className="surface-card empty-state large"><span>▥</span><h2>아직 분석 결과가 없어요</h2><p>마이크 연습을 완료하면 전체 음향 지표와 발성 유사도를 확인할 수 있어요.</p><button className="primary-button" type="button" onClick={onRetry}>첫 연습 시작</button></div>;
  const { metrics, quality } = result;
  const showRetry = retryResultId === result.id;
  if (showRetry) return <section aria-label="재측정 안내">
    <article className="surface-card retry-hero"><p className="eyebrow">재측정 안내</p><h2>이번 녹음을 다시 측정하는 이유</h2><p>부정확한 값으로 발성을 분류하지 않기 위해 결과를 보류했어요.</p></article>
    <div className="section-heading"><h2>감지된 사유</h2></div>
    <article className="surface-card reason-card"><ul>{quality.reasons.map((reason) => <li key={reason.code}><strong>{reason.label}</strong><span>{reason.detail}</span></li>)}</ul></article>
    <div className="section-heading"><h2>재측정 유의사항</h2><span>분석하지 않는 조건</span></div>
    <article className="surface-card guidance-card"><ul>{REMEASUREMENT_GUIDANCE.map(([title, body]) => <li key={title}><strong>{title}</strong><span>{body}</span></li>)}</ul></article>
    <button className="primary-button" type="button" onClick={onRetry}>같은 설정으로 재측정</button>
  </section>;

  if (!quality.reliable) return <section aria-label="분석 결과">
    <article className="surface-card result-hero unreliable-result"><div><p className="eyebrow">판정 보류</p><h2>분석을 확정하지 못했어요</h2><span>{result.target} · {result.range}</span></div><div className="score-ring warning-ring"><strong>{quality.confidence}</strong><small>%</small></div></article>
    <div className="section-heading"><h2>측정 상태</h2><span>품질 검사 결과</span></div>
    <article className="surface-card quality-list">
      <div><span>측정 신뢰도</span><strong>{quality.confidence}%</strong></div><div><span>유효 음성</span><strong>{quality.voicedRatio}%</strong></div>
      <div><span>음계 검출률</span><strong>{quality.noteCoverage ?? 0}%</strong></div><div><span>특징 검출률</span><strong>{quality.featureCoverage}%</strong></div><div><span>신호 대 소음</span><strong>{formatMetric(quality.snr, "dB")}</strong></div>
    </article>
    <div className="section-heading"><h2>분석 근거</h2><span>재측정 요구</span></div>
    <article className="surface-card analysis-basis retry-required"><strong>현재 값으로 발성을 분류하면 결과가 왜곡될 수 있어요.</strong><ul>{quality.reasons.map((reason) => <li key={reason.code}>{reason.label}: {reason.detail}</li>)}</ul><button type="button" className="primary-button" onClick={() => setRetryResultId(result.id)}>재측정 사유와 유의사항 확인</button></article>
  </section>;

  const topVoice = (Object.entries(result.distribution) as [keyof VoiceProbabilities, number][]).sort((a, b) => b[1] - a[1])[0];
  const metricRows = [
    ["F0·평균 음정", metrics.f0Mean ? `${midiToNote(69 + 12 * Math.log2(metrics.f0Mean / 440))} · ${metrics.f0Mean.toFixed(1)}Hz` : "측정 데이터 부족"],
    ["피치 정확도", `${metrics.pitchAccuracy}%`], ["피치 안정도", `${metrics.pitchStability}%`],
    ["상대 음량·SNR", formatMetric(metrics.relativeVolumeDb, "dB")], ["H1-H2", formatMetric(metrics.h1h2, "dB")],
    ["스펙트럼 기울기", formatMetric(metrics.spectralTilt, "dB/oct")], ["고배음 에너지", formatMetric(metrics.highHarmonicRatio, "%")],
    ["HNR", formatMetric(metrics.hnr, "dB")], ["CPP 추정", formatMetric(metrics.cpp, "dB")],
    ["포먼트 F1·F2·F3", metrics.formants.every((value) => value !== null) ? metrics.formants.map((value) => `${Math.round(value!)}Hz`).join(" · ") : "일부 측정 데이터 부족"],
    ["음색 연속성", `${metrics.timbreContinuity}%`], ["피치 점프", `${metrics.pitchJumps}회`], ["음량 연속성", `${metrics.volumeContinuity}%`],
    ["비브라토", metrics.vibratoRate === null ? "측정 구간 부족" : `${metrics.vibratoRate.toFixed(1)}Hz · 폭 ${formatMetric(metrics.vibratoExtent, "cent", 0)} · 규칙성 ${metrics.vibratoRegularity ?? 0}%`],
    ["Jitter·Shimmer 추정", `${formatMetric(metrics.jitter, "%")} · ${formatMetric(metrics.shimmer, "%")}`], ["발성 시작", metrics.onset],
    ["유효 발성 시간", `${metrics.voicedDuration.toFixed(1)}초 / ${metrics.totalDuration.toFixed(1)}초`],
    ["음계 순서 검출", `${quality.noteCoverage ?? 0}%`],
  ];
  return <section aria-label="분석 결과">
    <article className="surface-card result-hero"><div><p className="eyebrow">분석 완료 · 신뢰도 {quality.confidence}%</p><h2>{VOICE_NAMES[result.selectedVoice ?? "head"]} 연습 결과 {result.score}점</h2><span>{result.target} · {result.range}</span></div><div className="score-ring"><strong>{result.score}</strong><small>점</small></div></article>
    <div className="section-heading"><h2>발성 유사도</h2><span>가장 가까운 소리: {FOUR_VOICE_NAMES[topVoice[0]]}</span></div>
    <article className="surface-card distribution-meters">{(Object.entries(result.distribution) as [keyof VoiceProbabilities, number][]).map(([key, value]) => <div className="result-meter" key={key}><div><span>{FOUR_VOICE_NAMES[key]}</span><strong>{value}%</strong></div><div className="progress-track"><span style={{ width: `${value}%` }} /></div></div>)}</article>
    {metrics.noteResults?.length > 0 && <>
      <div className="section-heading"><h2>음별 피치 비교</h2><span>녹음 후 순서 정렬</span></div>
      <article className="surface-card note-pitch-list">
        <p className="note-alignment-copy">시작이 조금 늦거나 음을 길게 연결해도 실제 음 변화에 맞춰 도–레–미–파–솔–파–미–레–도를 다시 정렬했어요.</p>
        {metrics.noteResults.map((note, index) => <div className="note-pitch-row" key={`${note.targetIndex}-${note.startTime}`}>
          <div className="note-pitch-title"><span><b>{SCALE_NAMES[index]}</b><small>목표 {midiToNote(note.targetMidi)}</small></span><strong>측정 {midiToNote(note.measuredMidi)}</strong><em className={Math.abs(note.errorCents) <= 25 ? "in-tune" : "needs-work"}>{note.errorCents >= 0 ? "+" : ""}{note.errorCents} cent</em></div>
          <div className="note-pitch-scores"><span>정확도 <b>{note.accuracy}%</b></span><span>안정도 <b>{note.stability}%</b></span></div>
          <div className="dual-score-bars"><span style={{ width: `${note.accuracy}%` }} /><span style={{ width: `${note.stability}%` }} /></div>
        </div>)}
      </article>
    </>}
    <div className="section-heading"><h2>전체 측정값</h2><span>마이크 음향 분석</span></div>
    <article className="surface-card acoustic-table"><dl>{metricRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>
    <div className="section-heading"><h2>분석 근거</h2></div>
    <article className="surface-card analysis-basis"><strong>{topVoice[1]}%의 {FOUR_VOICE_NAMES[topVoice[0]]} 소리 패턴이 가장 가깝게 나타났어요.</strong><p>피치는 녹음 후 각 음의 유지 구간을 목표 음계 순서에 맞춰 비교했고, 전환 구간은 정확도와 안정도 계산에서 줄여 반영했습니다. 발성 유사도에는 H1-H2, 배음 감소, HNR·CPP, 상대 음량과 전환 연속성을 함께 사용했습니다. 마이크 분석은 성대 진동기전을 직접 확인하는 의학적 검사가 아닙니다.</p></article>
    <button className="primary-button" type="button" onClick={onRetry}>같은 설정으로 다시 연습</button>
  </section>;
}
