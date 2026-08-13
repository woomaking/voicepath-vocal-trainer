import assert from "node:assert/strict";
import test from "node:test";
import { alignPitchSequence, type PitchSample } from "../lib/pitchAlignment";

const TARGETS = [60, 62, 64, 65, 67, 65, 64, 62, 60];

function makeScale(offset = 0, startDelay = 0.85) {
  const counts = [9, 7, 11, 8, 12, 8, 10, 7, 9];
  const samples: PitchSample[] = [];
  let time = startDelay;
  TARGETS.forEach((target, noteIndex) => {
    for (let index = 0; index < counts[noteIndex]; index += 1) {
      const naturalMovement = Math.sin(index * 1.7) * 0.025;
      samples.push({ time, midi: target + offset + naturalMovement, confidence: 0.91 });
      time += 0.095;
    }
  });
  return samples;
}

test("aligns a delayed, variable-length recording to all nine scale notes", () => {
  const result = alignPitchSequence(makeScale(), TARGETS);
  assert.equal(result.notes.length, 9);
  assert.equal(result.noteCoverage, 100);
  assert.ok(result.pitchAccuracy >= 97, `accuracy was ${result.pitchAccuracy}`);
  assert.ok(result.pitchStability >= 95, `stability was ${result.pitchStability}`);
  assert.deepEqual(result.notes.map((note) => note.targetMidi), TARGETS);
});

test("scores each sustained note after alignment instead of using wall-clock timing", () => {
  const result = alignPitchSequence(makeScale(0.5, 1.35), TARGETS);
  assert.equal(result.notes.length, 9);
  assert.ok(result.notes.every((note) => Math.abs(note.errorCents - 50) <= 2));
  assert.ok(result.pitchAccuracy >= 58 && result.pitchAccuracy <= 62, `accuracy was ${result.pitchAccuracy}`);
  assert.ok(result.pitchStability >= 95, `stability was ${result.pitchStability}`);
});

test("corrects isolated octave-tracker glitches without folding a sustained octave", () => {
  const samples = makeScale();
  samples[22] = { ...samples[22], midi: samples[22].midi - 12 };
  const result = alignPitchSequence(samples, TARGETS);
  assert.ok(result.pitchAccuracy >= 97, `accuracy was ${result.pitchAccuracy}`);
  assert.ok(result.pitchStability >= 94, `stability was ${result.pitchStability}`);
});
