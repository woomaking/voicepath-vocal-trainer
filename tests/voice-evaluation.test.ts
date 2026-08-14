import assert from "node:assert/strict";
import test from "node:test";
import { buildVoiceEvaluation, evaluateValue, VOICE_EVALUATION_PROFILES, type EvaluationInput } from "../lib/voiceEvaluation";

const sample: EvaluationInput = {
  pitchAccuracy: 86, pitchStability: 72, noteCoverage: 91, pitchJumps: 4,
  h1h2: 12.4, hnr: 15.2, cpp: 8.7, highHarmonic: 9.8,
  formantContinuity: 68, timbreContinuity: 74, volumeContinuity: 61, connection: 73,
};

test("uses different acoustic targets for chest and falsetto", () => {
  const chest = evaluateValue(12, VOICE_EVALUATION_PROFILES.chest.targets.h1h2);
  const falsetto = evaluateValue(12, VOICE_EVALUATION_PROFILES.falsetto.targets.h1h2);
  assert.equal(chest.state, "low");
  assert.equal(falsetto.state, "good");
});

test("assigns green, amber, and red from target range plus tolerance", () => {
  const range: [number, number] = [80, 100];
  assert.equal(evaluateValue(86, range).state, "good");
  assert.equal(evaluateValue(77, range).state, "watch");
  assert.equal(evaluateValue(70, range).state, "low");
  assert.equal(evaluateValue(null, range).state, "unavailable");
});

test("builds the three requested evaluation sections", () => {
  const result = buildVoiceEvaluation("head", sample);
  assert.equal(result.sections.length, 3);
  assert.deepEqual(result.sections.map((section) => section.title), ["음정", "배음 / 음질", "공명 / 연결"]);
  assert.ok(result.sections.every((section) => section.metrics.length === 4));
});

test("mix voice requires stronger register connection than head voice", () => {
  assert.ok(VOICE_EVALUATION_PROFILES.mix.targets.connection[0] > VOICE_EVALUATION_PROFILES.head.targets.connection[0]);
});
