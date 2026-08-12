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
  assert.match(voicePathApp, /마이크 연습 중에는 배경음이 나오지 않으며 음정도 자동으로 바뀌지 않습니다/);
  assert.match(voicePathApp, /다음 세트 \+반음/);
  assert.doesNotMatch(voicePathApp, /setInterval|createOscillator|playTone\(/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
