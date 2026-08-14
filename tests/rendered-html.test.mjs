import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the VoicePath vocal training app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>보이스패스 \| 발성 연습<\/title>/i);
  assert.match(html, /data-testid="voicepath-app"/i);
  assert.match(html, /5음계로 성구 연결하기/);
  assert.match(html, /발성 배우기/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("starter preview is removed and product metadata is present", async () => {
  const [page, layout, packageJson, voicePathApp] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../components/VoicePathApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /VoicePathApp/);
  assert.match(layout, /보이스패스/);
  assert.match(layout, /lang="ko"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(voicePathApp, /PracticeLab/);
  const [practiceLab, inputSensitivity] = await Promise.all([
    readFile(new URL("../components/PracticeLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/inputSensitivity.ts", import.meta.url), "utf8"),
  ]);
  assert.match(practiceLab, /다음 세트 \+반음/);
  assert.match(practiceLab, /H1-H2/);
  assert.match(practiceLab, /스펙트럼 기울기/);
  assert.match(practiceLab, /HNR·CPP/);
  assert.match(practiceLab, /포먼트 F1·F2·F3/);
  assert.match(practiceLab, /재측정 유의사항/);
  assert.match(practiceLab, /소리가 너무 작음/);
  assert.match(practiceLab, /휴대폰 위치가 크게 변함/);
  assert.match(practiceLab, /녹음 중에는 배경음이 나오지 않으며 다음 세트도 자동으로 올라가지 않아요/);
  assert.match(practiceLab, /음별 피치 비교/);
  assert.match(practiceLab, /녹음 후 순서 정렬/);
  assert.match(practiceLab, /alignPitchSequence/);
  assert.match(practiceLab, /원본 보존형 F0 정규화/);
  assert.match(inputSensitivity, /작지만 깨끗하게 입력되고 있어요/);
  assert.match(practiceLab, /배음·음량·발성 평가는 원본 신호를 사용/);
  assert.match(practiceLab, /업그레이드 분석/);
  assert.match(practiceLab, /기존 분석/);
  assert.match(practiceLab, /평가기준 설명/);
  assert.match(practiceLab, /양호/);
  assert.match(practiceLab, /보완/);
  assert.match(practiceLab, /부족/);
  const voiceEvaluation = await readFile(new URL("../lib/voiceEvaluation.ts", import.meta.url), "utf8");
  assert.match(voiceEvaluation, /VOICE_EVALUATION_PROFILES/);
  assert.match(voiceEvaluation, /음정/);
  assert.match(voiceEvaluation, /배음 \/ 음질/);
  assert.match(voiceEvaluation, /공명 \/ 연결/);
  assert.doesNotMatch(voicePathApp, /setInterval|createOscillator|playTone\(/);
  assert.doesNotMatch(practiceLab, /setInterval|createOscillator|playTone\(/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
