export type PitchSample = {
  time: number;
  midi: number;
  confidence?: number;
};

export type AlignedPitchNote = {
  targetIndex: number;
  targetMidi: number;
  measuredMidi: number;
  errorCents: number;
  accuracy: number;
  stability: number;
  spreadCents: number;
  startTime: number;
  endTime: number;
  sampleCount: number;
};

export type PitchAlignment = {
  notes: AlignedPitchNote[];
  pitchAccuracy: number;
  pitchStability: number;
  noteCoverage: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const center = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2;
}

function correctIsolatedOctaveGlitches(samples: PitchSample[]) {
  return samples.map((sample, index) => {
    const local = samples
      .slice(Math.max(0, index - 2), Math.min(samples.length, index + 3))
      .filter((_, localIndex) => Math.max(0, index - 2) + localIndex !== index)
      .map((item) => item.midi);
    if (local.length < 2) return sample;
    const center = median(local);
    const difference = sample.midi - center;
    if (Math.abs(difference) < 10.5 || Math.abs(difference) > 13.5) return sample;
    return { ...sample, midi: sample.midi - Math.sign(difference) * 12 };
  });
}

function pitchAccuracyScore(errorCents: number) {
  const error = Math.abs(errorCents);
  if (error <= 25) return 100 - error * 0.4;
  if (error <= 50) return 90 - (error - 25) * 1.2;
  if (error <= 100) return 60 - (error - 50) * 1.2;
  return 0;
}

function pitchStabilityScore(spreadCents: number) {
  return clamp(100 - Math.max(0, spreadCents - 8) * 1.4, 0, 100);
}

type SegmentMeasurement = {
  measuredMidi: number;
  errorCents: number;
  spreadCents: number;
  cost: number;
};

function measureSegment(samples: PitchSample[], start: number, end: number, targetMidi: number, expectedLength: number): SegmentMeasurement {
  const segment = samples.slice(start, end);
  const trim = segment.length >= 7 ? Math.floor(segment.length * 0.18) : 0;
  const center = trim > 0 && segment.length - trim * 2 >= 3 ? segment.slice(trim, segment.length - trim) : segment;
  const measuredMidi = median(center.map((sample) => sample.midi));
  const errorCents = (measuredMidi - targetMidi) * 100;
  const spreadCents = median(center.map((sample) => Math.abs((sample.midi - measuredMidi) * 100))) * 1.4826;
  // Boundaries should follow stable sung plateaus first. Target distance is deliberately
  // secondary so a consistently sharp or flat note cannot move the boundary to hide error.
  const pitchCost = Math.min(Math.abs(errorCents), 450) / 100 * 0.35;
  const stabilityCost = Math.min(spreadCents, 200) / 35 * 0.9;
  const durationCost = Math.abs(Math.log(Math.max(segment.length, 1) / Math.max(expectedLength, 1))) * 0.7;
  const confidenceCost = mean(center.map((sample) => 1 - clamp(sample.confidence ?? 0.7, 0, 1))) * 0.12;
  return { measuredMidi, errorCents, spreadCents, cost: pitchCost + stabilityCost + durationCost + confidenceCost };
}

export function alignPitchSequence(rawSamples: PitchSample[], targetMidis: number[]): PitchAlignment {
  const samples = correctIsolatedOctaveGlitches(
    rawSamples
      .filter((sample) => Number.isFinite(sample.time) && Number.isFinite(sample.midi))
      .sort((a, b) => a.time - b.time),
  );
  if (!targetMidis.length || samples.length < targetMidis.length * 2) {
    return { notes: [], pitchAccuracy: 0, pitchStability: 0, noteCoverage: 0 };
  }

  const noteCount = targetMidis.length;
  const sampleCount = samples.length;
  const expectedLength = sampleCount / noteCount;
  const minimumLength = Math.max(2, Math.floor(expectedLength * 0.32));
  const costs = Array.from({ length: noteCount }, () => Array(sampleCount + 1).fill(Number.POSITIVE_INFINITY));
  const previous = Array.from({ length: noteCount }, () => Array(sampleCount + 1).fill(-1));
  const cache = new Map<string, SegmentMeasurement>();

  const segment = (noteIndex: number, start: number, end: number) => {
    const key = `${noteIndex}:${start}:${end}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const measured = measureSegment(samples, start, end, targetMidis[noteIndex], expectedLength);
    cache.set(key, measured);
    return measured;
  };

  for (let end = minimumLength; end <= sampleCount - minimumLength * (noteCount - 1); end += 1) {
    costs[0][end] = segment(0, 0, end).cost;
    previous[0][end] = 0;
  }

  for (let noteIndex = 1; noteIndex < noteCount; noteIndex += 1) {
    const earliestEnd = minimumLength * (noteIndex + 1);
    const latestEnd = sampleCount - minimumLength * (noteCount - noteIndex - 1);
    for (let end = earliestEnd; end <= latestEnd; end += 1) {
      const earliestStart = minimumLength * noteIndex;
      const latestStart = end - minimumLength;
      for (let start = earliestStart; start <= latestStart; start += 1) {
        const prior = costs[noteIndex - 1][start];
        if (!Number.isFinite(prior)) continue;
        const next = prior + segment(noteIndex, start, end).cost;
        if (next < costs[noteIndex][end]) {
          costs[noteIndex][end] = next;
          previous[noteIndex][end] = start;
        }
      }
    }
  }

  if (!Number.isFinite(costs[noteCount - 1][sampleCount])) {
    return { notes: [], pitchAccuracy: 0, pitchStability: 0, noteCoverage: 0 };
  }

  const boundaries = Array(noteCount + 1).fill(0);
  boundaries[noteCount] = sampleCount;
  for (let noteIndex = noteCount - 1; noteIndex >= 1; noteIndex -= 1) {
    boundaries[noteIndex] = previous[noteIndex][boundaries[noteIndex + 1]];
  }

  const notes = targetMidis.map((targetMidi, targetIndex) => {
    const start = boundaries[targetIndex];
    const end = boundaries[targetIndex + 1];
    const measured = segment(targetIndex, start, end);
    return {
      targetIndex,
      targetMidi,
      measuredMidi: measured.measuredMidi,
      errorCents: Math.round(measured.errorCents),
      accuracy: Math.round(clamp(pitchAccuracyScore(measured.errorCents), 0, 100)),
      stability: Math.round(pitchStabilityScore(measured.spreadCents)),
      spreadCents: Math.round(measured.spreadCents),
      startTime: samples[start].time,
      endTime: samples[end - 1].time,
      sampleCount: end - start,
    };
  });

  const covered = notes.filter((note) => note.sampleCount >= minimumLength).length;
  return {
    notes,
    pitchAccuracy: Math.round(mean(notes.map((note) => note.accuracy))),
    pitchStability: Math.round(mean(notes.map((note) => note.stability))),
    noteCoverage: Math.round(covered / noteCount * 100),
  };
}
