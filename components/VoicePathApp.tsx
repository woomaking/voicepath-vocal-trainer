"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AnalysisExperience,
  PracticeLab,
  type PracticeResult,
  type TrainingVoice,
} from "./PracticeLab";

type Tab = "home" | "learn" | "practice" | "analysis" | "history";

type VoiceDefinition = {
  key: TrainingVoice;
  name: string;
  kind: string;
  body: string;
  steps: string[];
  check: string;
  caution: string;
};

const voiceDefinitions: VoiceDefinition[] = [
  {
    key: "chest",
    name: "흉성",
    kind: "기본 성구",
    body: "말할 때와 가까운 단단하고 무게감 있는 발성입니다. 편안한 저·중음에서 주로 사용합니다.",
    steps: [
      "편안한 말소리 높이에서 가볍게 ‘어’라고 말해보세요.",
      "목을 누르지 말고 같은 느낌으로 도–레–미를 이어보세요.",
      "음량을 키우지 않은 채 5음계를 천천히 불러보세요.",
    ],
    check: "저·중음이 편안하고 말소리와 비슷한 선명함이 유지돼요.",
    caution: "고음까지 무게를 억지로 유지하지 마세요. 목이 조이거나 아프면 바로 쉬어주세요.",
  },
  {
    key: "middle",
    name: "중성",
    kind: "기본 성구",
    body: "흉성과 두성 사이의 중간 음역에서 나타나는 발성입니다. 성구 전환을 안정시키는 중요한 구간입니다.",
    steps: [
      "편안한 음에서 밝고 가벼운 ‘네’ 또는 ‘멈’ 소리를 내보세요.",
      "음정이 올라갈수록 소리의 무게와 음량을 조금씩 줄여보세요.",
      "5음계를 부르며 소리가 뒤집히지 않게 부드럽게 연결하세요.",
    ],
    check: "흉성보다 가벼워지지만 소리의 중심은 유지되고 전환이 갑자기 끊기지 않아요.",
    caution: "턱을 들거나 목을 조여 중간 음역을 버티지 마세요. 편안한 범위에서만 반복하세요.",
  },
  {
    key: "head",
    name: "두성",
    kind: "기본 성구",
    body: "고음에서 성대의 무게를 줄이고 효율적으로 진동시키는 발성입니다. 가성보다 접촉이 안정적인 경향이 있습니다.",
    steps: [
      "립트릴이나 작은 ‘우’ 소리로 낮은 음부터 높은 음까지 천천히 사이렌을 해보세요.",
      "고음에서 밀어붙이지 말고 작고 가벼운 음량을 유지하세요.",
      "편안해지면 ‘우’로 5음계를 부르며 맑은 소리 중심을 찾아보세요.",
    ],
    check: "고음에서 목의 힘은 줄고 숨만 새지 않는 가볍고 또렷한 소리가 유지돼요.",
    caution: "머리 쪽 진동 감각만으로 두성을 판단하지 마세요. 쉰 소리나 통증이 생기면 연습을 멈추세요.",
  },
  {
    key: "falsetto",
    name: "가성",
    kind: "기본 성구",
    body: "성대 접촉이 상대적으로 약해 공기가 섞이기 쉬운 가볍고 부드러운 발성입니다.",
    steps: [
      "작은 한숨처럼 부드러운 ‘후’ 소리로 시작하세요.",
      "편안한 고음 하나를 작게 유지하며 숨의 양을 관찰하세요.",
      "같은 가벼움으로 3음계를 천천히 연결하세요.",
    ],
    check: "가볍고 부드러운 고음이 힘을 주지 않아도 나오며 공기가 자연스럽게 섞여요.",
    caution: "공기를 과도하게 밀어내거나 목을 벌려 소리를 크게 만들지 마세요.",
  },
  {
    key: "mix",
    name: "믹스보이스",
    kind: "성구 연결",
    body: "흉성과 두성을 끊김 없이 연결하기 위한 발성 조절 방식입니다. 고정된 성구보다 연결 상태로 평가합니다.",
    steps: [
      "편안한 흉성에서 ‘네’로 5음계를 시작하세요.",
      "음정이 올라갈수록 볼륨과 흉성의 무게를 조금씩 줄이세요.",
      "중성을 지나 두성으로 이어질 때 음색이 급격히 바뀌지 않는지 들어보세요.",
    ],
    check: "음역이 올라가도 소리가 갑자기 뒤집히지 않고 볼륨과 음색 변화가 완만해요.",
    caution: "강하고 높은 소리가 난다는 이유만으로 믹스보이스라고 단정하지 마세요.",
  },
];

const navItems: { key: Tab; label: string; icon: string }[] = [
  { key: "home", label: "홈", icon: "⌂" },
  { key: "learn", label: "발성", icon: "▤" },
  { key: "practice", label: "연습", icon: "●" },
  { key: "analysis", label: "분석", icon: "▥" },
  { key: "history", label: "기록", icon: "◷" },
];

function resultSummary(result: PracticeResult) {
  if (result.quality && !result.quality.reliable) return "측정 품질이 부족해 재측정이 필요해요.";
  return result.connection >= 75
    ? "성구 전환이 비교적 부드럽게 이어졌어요."
    : "중성 구간에서 볼륨을 줄이며 연결해보세요.";
}

export function VoicePathApp() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedVoice, setSelectedVoice] = useState<TrainingVoice>("chest");
  const [history, setHistory] = useState<PracticeResult[]>([]);
  const [lastResult, setLastResult] = useState<PracticeResult | null>(null);

  const selectedDefinition = useMemo(
    () => voiceDefinitions.find((item) => item.key === selectedVoice) ?? voiceDefinitions[0],
    [selectedVoice],
  );

  useEffect(() => {
    const historyTimer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("voicepath-history");
        if (!saved) return;
        const parsed = JSON.parse(saved) as PracticeResult[];
        setHistory(parsed);
        setLastResult(parsed[0] ?? null);
      } catch {
        localStorage.removeItem("voicepath-history");
      }
    }, 0);

    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("./sw.js").then((registration) => registration.update()).catch(() => undefined);
    }

    return () => window.clearTimeout(historyTimer);
  }, []);

  function goTo(tab: Tab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveResult(result: PracticeResult) {
    const nextHistory = [result, ...history].slice(0, 20);
    setHistory(nextHistory);
    setLastResult(result);
    setActiveTab("analysis");
    localStorage.setItem("voicepath-history", JSON.stringify(nextHistory));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="voice-site">
      <div className="voice-app" data-testid="voicepath-app">
        <header className="app-header">
          <div>
            <p className="eyebrow">VOICEPATH</p>
            <h1>{activeTab === "home" ? "오늘도 편안하게 연결해봐요" : navItems.find((item) => item.key === activeTab)?.label}</h1>
          </div>
          <div className="brand-mark" aria-label="보이스패스"><span>V</span></div>
        </header>

        <main className="app-main">
          {activeTab === "home" && (
            <section aria-label="홈">
              <article className="hero-card">
                <div className="card-topline"><span>오늘의 연습</span><strong>1 / 3</strong></div>
                <h2>5음계로 성구 연결하기</h2>
                <p>도–레–미–파–솔–파–미–레–도 · 약 5분</p>
                <div className="progress-track" aria-label="오늘 연습 진행률 33퍼센트"><span style={{ width: "33%" }} /></div>
                <button className="primary-button" type="button" onClick={() => goTo("practice")}>연습 시작</button>
              </article>

              <div className="section-heading"><h2>빠른 시작</h2></div>
              <div className="quick-grid">
                <button className="quick-card" type="button" onClick={() => goTo("practice")}>
                  <span className="quick-icon">♪</span><strong>음계 연습</strong><small>원하는 시작음으로 피치 확인</small>
                </button>
                <button className="quick-card" type="button" onClick={() => goTo("learn")}>
                  <span className="quick-icon">▤</span><strong>발성 배우기</strong><small>그림으로 내는 방법 익히기</small>
                </button>
              </div>

              <div className="section-heading"><h2>최근 분석</h2></div>
              <article className="surface-card recent-card">
                {lastResult ? (
                  <>
                    <div className="card-topline"><div><strong>5음계 발성 연습</strong><small>{lastResult.date} · {lastResult.range}</small></div><span className="score-number">{lastResult.quality?.reliable === false ? "보류" : lastResult.score}</span></div>
                    <div className="progress-track"><span style={{ width: `${lastResult.quality?.reliable === false ? lastResult.quality.confidence : lastResult.score}%` }} /></div>
                    <p>{resultSummary(lastResult)}</p>
                  </>
                ) : (
                  <div className="empty-state"><span>🎙️</span><strong>첫 연습을 시작해보세요</strong><p>연습 후 피치와 발성 추정 결과가 여기에 표시됩니다.</p></div>
                )}
              </article>

              <p className="safety-note">이 앱은 교육용 보조 도구입니다. 통증이나 지속적인 쉰 목소리가 있으면 연습을 중단하고 전문가와 상담하세요.</p>
            </section>
          )}

          {activeTab === "learn" && (
            <section aria-label="발성사전">
              <div className="section-heading dictionary-heading"><div><p className="eyebrow">발성사전</p><h2>소리를 이해하고 연습해요</h2></div></div>
              <div className="voice-tabs" role="group" aria-label="발성 종류">
                {voiceDefinitions.map((voice) => (
                  <button key={voice.key} type="button" aria-pressed={selectedVoice === voice.key} onClick={() => setSelectedVoice(voice.key)}>{voice.name}</button>
                ))}
              </div>

              <article className="surface-card dictionary-card">
                <span className="type-label">{selectedDefinition.kind}</span>
                <h2>{selectedDefinition.name}</h2>
                <p>{selectedDefinition.body}</p>

                <figure className="anatomy-figure">
                  <div className="anatomy-stage" data-zone={selectedDefinition.key}>
                    {/* Shared by the static GitHub Pages build, so a native relative image is intentional. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="./vocal-anatomy.jpg" alt="코, 입, 인두, 후두, 기도와 상부 가슴을 단순화한 옆면 해부 그림" />
                    <span className="resonance-zone zone-head">머리·얼굴 주변<br />진동 감각</span>
                    <span className="resonance-zone zone-middle">입·인두 주변<br />공명 감각</span>
                    <span className="resonance-zone zone-chest">가슴 주변<br />진동 감각</span>
                  </div>
                  <figcaption>색 영역은 느껴질 수 있는 감각을 안내하며 실제 소리의 생성 위치를 뜻하지 않습니다.</figcaption>
                </figure>

                <h3 className="method-title"><span>✓</span>{selectedDefinition.name} 내는 방법</h3>
                <ol className="step-list">
                  {selectedDefinition.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
                <div className="check-panel"><strong>잘 되고 있는 신호</strong><p>{selectedDefinition.check}</p></div>
                <div className="caution-panel"><strong>주의</strong><p>{selectedDefinition.caution}</p></div>
                <button className="primary-button" type="button" onClick={() => goTo("practice")}>{selectedDefinition.name} 연습 시작</button>
              </article>
            </section>
          )}

          {activeTab === "practice" && (
            <PracticeLab
              selectedVoice={selectedVoice}
              onSelectedVoiceChange={setSelectedVoice}
              onComplete={saveResult}
            />
          )}

          {activeTab === "analysis" && (
            <AnalysisExperience result={lastResult} onRetry={() => goTo("practice")} />
          )}

          {activeTab === "history" && (
            <section aria-label="연습 기록">
              <div className="section-heading"><div><p className="eyebrow">나의 변화</p><h2>최근 발성 연습 기록</h2></div></div>
              <article className="surface-card history-card">
                {history.length ? history.map((result) => (
                  <button type="button" className="history-row" key={result.id} onClick={() => { setLastResult(result); goTo("analysis"); }}>
                    <span className="history-icon">↗</span><span><strong>5음계 발성 연습</strong><small>{result.date} · {result.range}</small></span><b>{result.quality?.reliable === false ? "보류" : result.score}</b>
                  </button>
                )) : <div className="empty-state"><span>◷</span><strong>기록이 아직 없어요</strong><p>완료한 연습은 이 기기에 저장됩니다.</p></div>}
              </article>
              <p className="local-note">연습 기록은 현재 기기의 브라우저에만 저장됩니다.</p>
            </section>
          )}
        </main>

        <nav className="bottom-nav" aria-label="주요 화면">
          {navItems.map((item) => (
            <button key={item.key} type="button" aria-current={activeTab === item.key ? "page" : undefined} onClick={() => goTo(item.key)}>
              <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
