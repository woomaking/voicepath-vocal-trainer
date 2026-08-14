import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptivePitchThreshold,
  assessInputSignal,
  normalizeForPitch,
  requiresQuietRemeasure,
} from "../lib/inputSensitivity";

test("accepts a small but clean input instead of requiring remeasurement", () => {
  const assessment = assessInputSignal(0.004, 0.08, 0.001);
  assert.equal(assessment.state, "usable-soft");
  assert.ok((assessment.snrDb ?? 0) >= 11);
  assert.equal(requiresQuietRemeasure(0.004, assessment.snrDb), false);
});

test("rejects a similarly small input when it is buried in noise", () => {
  const assessment = assessInputSignal(0.004, 0.08, 0.002);
  assert.equal(assessment.state, "too-quiet");
  assert.equal(requiresQuietRemeasure(0.004, assessment.snrDb), true);
});

test("normalizes only a copied waveform used for pitch detection", () => {
  const original = Float32Array.from({ length: 128 }, (_, index) => index % 2 ? -0.0025 : 0.0025);
  const before = Array.from(original);
  const normalized = normalizeForPitch(original, 0.0025);
  assert.deepEqual(Array.from(original), before);
  assert.ok(Math.max(...normalized.map(Math.abs)) > 0.015);
});

test("keeps an absolute detector floor and reports clipping separately", () => {
  assert.equal(adaptivePitchThreshold(0.0005), 0.0022);
  assert.ok(adaptivePitchThreshold(0.003) > 0.004);
  assert.equal(assessInputSignal(0.03, 0.97, 0.0015).state, "too-loud");
});
