"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Tab = "home" | "learn" | "practice" | "analysis" | "history";
type VoiceKey = "chest" | "middle" | "head" | "falsetto" | "mix";

type VoiceDefinition = {
  key: VoiceKey;
  name: string;
  kind: string;
  body: string;
  steps: string[];
  check: string;
  caution: string;
};

type VoiceProbabilities = Record<"chest" | "middle" | "head" | "falsetto", number>;

type PracticeResult = {
  id: string;
  date: string;
  score: number;
  pitchAccuracy: number;
  connection: number;
  stability: number;
  durationSeconds: number;
  range: string;
  distribution: VoiceProbabilities;
};

type WebKitAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? (window as WebKitAudioWindow).webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("이 브라우저에서는 연습음을 재생할 수 없습니다.");
  }

  try {
    return new AudioContextConstructor({ latencyHint: "interactive" });
  } catch {
    return new AudioContextConstructor();
  }
}

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

const scaleIntervals = [0, 2, 4, 5, 7, 5, 4, 2, 0];
const scaleNames = ["도", "레", "미", "파", "솔", "파", "미", "레", "도"];
const noteNames = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const koreanVoiceNames = { chest: "흉성", middle: "중성", head: "두성", falsetto: "가성" };

const emptyProbabilities: VoiceProbabilities = { chest: 25, middle: 25, head: 25, falsetto: 25 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function midiToNote(midi: number) {
  const rounded = Math.round(midi);
  return `${noteNames[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

function frequencyToPitch(frequency: number) {
  const exactMidi = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(exactMidi);
  return { midi, note: midiToNote(midi), cents: Math.round((exactMidi - midi) * 100) };
}

function detectPitch(buffer: Float32Array, sampleRate: number) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i += 1) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.012) return { frequency: 0, rms };

  const minLag = Math.floor(sampleRate / 1000);
  const maxLag = Math.min(Math.floor(sampleRate / 65), buffer.length - 2);
  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let energyA = 0;
    let energyB = 0;
    const length = buffer.length - lag;
    for (let i = 0; i < length; i += 2) {
      const a = buffer[i];
      const b = buffer[i + lag];
      correlation += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const normalized = correlation / Math.sqrt(energyA * energyB || 1);
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < 0.55) return { frequency: 0, rms };
  return { frequency: sampleRate / bestLag, rms };
}

function classifyVoice(midi: number, rms: number, centroid: number, startMidi: number): VoiceProbabilities {
  const relative = midi - startMidi;
  const chest = clamp(1.15 - relative / 9, 0.08, 1.1) + clamp((rms - 0.03) * 5, 0, 0.28);
  const middle = Math.exp(-((relative - 6) ** 2) / 20) + 0.15;
  const highPitch = clamp((relative - 6) / 8, 0, 1);
  const head = 0.2 + highPitch * 0.95 + clamp((rms - 0.025) * 2, 0, 0.12);
  const breathy = clamp((0.045 - rms) * 12, 0, 0.5) + clamp((centroid - 1500) / 3000, 0, 0.35);
  const falsetto = 0.08 + highPitch * 0.42 + breathy;
  const scores = { chest, middle, head, falsetto };
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  return {
    chest: Math.round((scores.chest / total) * 100),
    middle: Math.round((scores.middle / total) * 100),
    head: Math.round((scores.head / total) * 100),
    falsetto: 0,
  } as VoiceProbabilities;
}

function normalizedProbabilities(probabilities: VoiceProbabilities) {
  const used = probabilities.chest + probabilities.middle + probabilities.head;
  return { ...probabilities, falsetto: Math.max(0, 100 - used) };
}

function getTopVoice(probabilities: VoiceProbabilities) {
  return (Object.entries(probabilities) as [keyof VoiceProbabilities, number][]).sort((a, b) => b[1] - a[1])[0][0];
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}분 ${String(seconds % 60).padStart(2, "0")}초`;
}

export function VoicePathApp() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedVoice, setSelectedVoice] = useState<VoiceKey>("chest");
  const [startMidi, setStartMidi] = useState(60);
  const [tempo, setTempo] = useState(76);
  const [vowel, setVowel] = useState("우");
  const [activeIndex, setActiveIndex] = useState(0);
  const [setShift, setSetShift] = useState(0);
  const [isPracticing, setIsPracticing] = useState(false);
  const [detectedNote, setDetectedNote] = useState("—");
  const [detectedMidi, setDetectedMidi] = useState<number | null>(null);
  const [cents, setCents] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const [probabilities, setProbabilities] = useState<VoiceProbabilities>(emptyProbabilities);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<PracticeResult[]>([]);
  const [lastResult, setLastResult] = useState<PracticeResult | null>(null);

  const playbackContextRef = useRef<AudioContext | null>(null);
  const microphoneContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const targetMidiRef = useRef(startMidi);
  const practicingRef = useRef(false);
  const lastUiUpdateRef = useRef(0);
  const lastVoiceRef = useRef<keyof VoiceProbabilities | null>(null);
  const sessionRef = useRef({
    startedAt: 0,
    frames: 0,
    centsTotal: 0,
    centsSquared: 0,
    flips: 0,
    minMidi: 200,
    maxMidi: 0,
    counts: { chest: 0, middle: 0, head: 0, falsetto: 0 } as VoiceProbabilities,
  });

  const selectedDefinition = useMemo(
    () => voiceDefinitions.find((item) => item.key === selectedVoice) ?? voiceDefinitions[0],
    [selectedVoice],
  );

  const targetMidi = startMidi + setShift + scaleIntervals[activeIndex];
  const targetNote = midiToNote(targetMidi);
  const topVoice = getTopVoice(probabilities);
  const pitchDifference = detectedMidi === null ? null : Math.round((detectedMidi - targetMidi) * 100 + cents);

  useEffect(() => {
    targetMidiRef.current = targetMidi;
  }, [targetMidi]);

  useEffect(() => {
    const historyTimer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("voicepath-history");
        if (saved) {
          const parsed = JSON.parse(saved) as PracticeResult[];
          setHistory(parsed);
          setLastResult(parsed[0] ?? null);
        }
      } catch {
        localStorage.removeItem("voicepath-history");
      }
    }, 0);

    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("./sw.js").then((registration) => registration.update()).catch(() => undefined);
    }

    const resumePlayback = () => {
      if (document.visibilityState !== "visible") return;
      const context = playbackContextRef.current;
      if (!context || context.state === "closed") return;
      context.resume().catch(() => {
        context.close().catch(() => undefined);
        if (playbackContextRef.current === context) playbackContextRef.current = null;
      });
    };
    document.addEventListener("visibilitychange", resumePlayback);

    return () => {
      window.clearTimeout(historyTimer);
      document.removeEventListener("visibilitychange", resumePlayback);
      stopAudio();
    };
  }, []);

  function stopAudio() {
    practicingRef.current = false;
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    intervalRef.current = null;
    animationRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    [playbackContextRef, microphoneContextRef].forEach((contextRef) => {
      if (contextRef.current && contextRef.current.state !== "closed") {
        contextRef.current.close().catch(() => undefined);
      }
      contextRef.current = null;
    });
  }

  function calculateCentroid(analyser: AnalyserNode) {
    const spectrum = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(spectrum);
    let weighted = 0;
    let total = 0;
    const resolution = analyser.context.sampleRate / analyser.fftSize;
    for (let i = 1; i < spectrum.length; i += 2) {
      const power = 10 ** (spectrum[i] / 10);
      weighted += i * resolution * power;
      total += power;
    }
    return total > 0 ? weighted / total : 0;
  }

  function processMicrophone() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const waveform = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(waveform);
    const { frequency, rms } = detectPitch(waveform, analyser.context.sampleRate);
    const now = performance.now();

    if (now - lastUiUpdateRef.current > 110) {
      lastUiUpdateRef.current = now;
      setInputLevel(clamp(Math.round(rms * 900), 0, 100));

      if (frequency > 0) {
        const pitch = frequencyToPitch(frequency);
        const centroid = calculateCentroid(analyser);
        const nextProbabilities = normalizedProbabilities(classifyVoice(pitch.midi, rms, centroid, startMidi));
        const voice = getTopVoice(nextProbabilities);
        setDetectedNote(pitch.note);
        setDetectedMidi(pitch.midi);
        setCents(pitch.cents);
        setProbabilities(nextProbabilities);

        if (practicingRef.current) {
          const session = sessionRef.current;
          const difference = Math.abs((pitch.midi - targetMidiRef.current) * 100 + pitch.cents);
          session.frames += 1;
          session.centsTotal += difference;
          session.centsSquared += difference * difference;
          session.minMidi = Math.min(session.minMidi, pitch.midi);
          session.maxMidi = Math.max(session.maxMidi, pitch.midi);
          session.counts[voice] += 1;
          if (lastVoiceRef.current && lastVoiceRef.current !== voice) session.flips += 1;
          lastVoiceRef.current = voice;
        }
      } else {
        setDetectedNote("—");
        setDetectedMidi(null);
      }
    }
    animationRef.current = requestAnimationFrame(processMicrophone);
  }

  async function openMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("이 브라우저에서는 마이크 분석을 사용할 수 없습니다.");
    const context = createAudioContext();
    let stream: MediaStream | null = null;

    try {
      if (context.state !== "running") await context.resume();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (context.state !== "running") await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.35;
      context.createMediaStreamSource(stream).connect(analyser);
      microphoneContextRef.current = context;
      analyserRef.current = analyser;
      streamRef.current = stream;
      processMicrophone();
    } catch (caught) {
      stream?.getTracks().forEach((track) => track.stop());
      context.close().catch(() => undefined);
      throw caught;
    }
  }

  async function getPlaybackContext() {
    let context = playbackContextRef.current;
    if (!context || context.state === "closed") {
      context = createAudioContext();
      playbackContextRef.current = context;
    }

    try {
      if (context.state !== "running") await context.resume();
    } catch {
      context.close().catch(() => undefined);
      if (playbackContextRef.current === context) playbackContextRef.current = null;
      throw new Error("연습음을 시작하지 못했습니다. 화면을 한 번 누른 뒤 다시 시도해주세요.");
    }

    if (context.state !== "running") {
      throw new Error("연습음이 일시 정지되어 있습니다. 기준 음계 듣기를 다시 눌러주세요.");
    }

    const silentBuffer = context.createBuffer(1, 1, context.sampleRate);
    const silentSource = context.createBufferSource();
    silentSource.buffer = silentBuffer;
    silentSource.connect(context.destination);
    silentSource.start();
    return context;
  }

  async function playTone(midi: number, duration = 0.34) {
    const context = await getPlaybackContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + 0.015;
    oscillator.type = "triangle";
    oscillator.frequency.value = midiToFrequency(midi);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  async function playReferenceScale() {
    setError("");
    try {
      const context = await getPlaybackContext();
      const beat = 60 / tempo;
      scaleIntervals.forEach((interval, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const begins = context.currentTime + 0.02 + index * beat;
        oscillator.type = "triangle";
        oscillator.frequency.value = midiToFrequency(startMidi + setShift + interval);
        gain.gain.setValueAtTime(0.0001, begins);
        gain.gain.exponentialRampToValueAtTime(0.18, begins + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, begins + beat * 0.72);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(begins);
        oscillator.stop(begins + beat * 0.76);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "기준 음계를 재생하지 못했습니다.");
    }
  }

  async function startPractice() {
    setError("");
    try {
      stopAudio();
      await getPlaybackContext();
      await openMicrophone();
      sessionRef.current = {
        startedAt: Date.now(),
        frames: 0,
        centsTotal: 0,
        centsSquared: 0,
        flips: 0,
        minMidi: 200,
        maxMidi: 0,
        counts: { chest: 0, middle: 0, head: 0, falsetto: 0 },
      };
      lastVoiceRef.current = null;
      practicingRef.current = true;
      setIsPracticing(true);
      setActiveIndex(0);
      setSetShift(0);
      targetMidiRef.current = startMidi;
      await playTone(startMidi);

      let index = 0;
      let shift = 0;
      const beatMilliseconds = Math.round((60 / tempo) * 1000);
      intervalRef.current = window.setInterval(() => {
        index += 1;
        if (index >= scaleIntervals.length) {
          index = 0;
          shift += 1;
        }
        if (shift >= 6) {
          finishPractice();
          return;
        }
        const nextMidi = startMidi + shift + scaleIntervals[index];
        setActiveIndex(index);
        setSetShift(shift);
        targetMidiRef.current = nextMidi;
        void playTone(nextMidi, 0.25).catch((caught) => {
          setError(caught instanceof Error ? caught.message : "연습음을 재생하지 못했습니다.");
        });
      }, beatMilliseconds);
    } catch (caught) {
      stopAudio();
      setIsPracticing(false);
      setError(caught instanceof Error ? caught.message : "마이크를 시작하지 못했습니다.");
    }
  }

  function finishPractice() {
    const session = sessionRef.current;
    stopAudio();
    setIsPracticing(false);
    const frames = Math.max(session.frames, 1);
    const averageError = session.centsTotal / frames;
    const variance = Math.max(0, session.centsSquared / frames - averageError ** 2);
    const pitchAccuracy = Math.round(clamp(100 - averageError * 0.85, 0, 100));
    const stability = Math.round(clamp(100 - Math.sqrt(variance) * 0.75, 0, 100));
    const connection = Math.round(clamp(100 - (session.flips / frames) * 260, 0, 100));
    const totalVoices = Math.max(1, Object.values(session.counts).reduce((sum, value) => sum + value, 0));
    const distribution = Object.fromEntries(
      Object.entries(session.counts).map(([key, value]) => [key, Math.round((value / totalVoices) * 100)]),
    ) as VoiceProbabilities;
    const result: PracticeResult = {
      id: String(Date.now()),
      date: new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date()),
      score: Math.round((pitchAccuracy + stability + connection) / 3),
      pitchAccuracy,
      stability,
      connection,
      durationSeconds: Math.max(1, Math.round((Date.now() - session.startedAt) / 1000)),
      range: session.maxMidi > 0 ? `${midiToNote(session.minMidi)}–${midiToNote(session.maxMidi)}` : "측정되지 않음",
      distribution,
    };
    const nextHistory = [result, ...history].slice(0, 20);
    setHistory(nextHistory);
    setLastResult(result);
    setActiveTab("analysis");
    localStorage.setItem("voicepath-history", JSON.stringify(nextHistory));
  }

  function goTo(tab: Tab) {
    setActiveTab(tab);
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
                  <span className="quick-icon">♪</span><strong>음계 연습</strong><small>반음씩 올라가며 피치 확인</small>
                </button>
                <button className="quick-card" type="button" onClick={() => goTo("learn")}>
                  <span className="quick-icon">▤</span><strong>발성 배우기</strong><small>그림으로 내는 방법 익히기</small>
                </button>
              </div>

              <div className="section-heading"><h2>최근 분석</h2></div>
              <article className="surface-card recent-card">
                {lastResult ? (
                  <>
                    <div className="card-topline"><div><strong>5음계 상승 연습</strong><small>{lastResult.date} · {lastResult.range}</small></div><span className="score-number">{lastResult.score}</span></div>
                    <div className="progress-track"><span style={{ width: `${lastResult.score}%` }} /></div>
                    <p>{lastResult.connection >= 75 ? "성구 전환이 비교적 부드럽게 이어졌어요." : "중성 구간에서 볼륨을 줄이며 연결해보세요."}</p>
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
            <section aria-label="실시간 연습">
              <div className="section-heading"><div><p className="eyebrow">실시간 연습</p><h2>5음계 상승 연습</h2></div><span className="set-badge">{setShift + 1} / 6세트</span></div>

              <article className="surface-card settings-card">
                <label>시작음
                  <select value={startMidi} disabled={isPracticing} onChange={(event) => setStartMidi(Number(event.target.value))}>
                    <option value={57}>A3</option><option value={59}>B3</option><option value={60}>C4</option><option value={62}>D4</option><option value={64}>E4</option>
                  </select>
                </label>
                <label>연습 모음
                  <select value={vowel} disabled={isPracticing} onChange={(event) => setVowel(event.target.value)}>
                    <option>우</option><option>이</option><option>아</option><option>네</option><option>멈</option>
                  </select>
                </label>
                <label className="tempo-control">속도 <strong>{tempo} BPM</strong>
                  <input type="range" min="56" max="100" step="2" value={tempo} disabled={isPracticing} onChange={(event) => setTempo(Number(event.target.value))} />
                </label>
                <button className="secondary-button" type="button" disabled={isPracticing} onClick={playReferenceScale}>기준 음계 듣기</button>
              </article>

              <article className="surface-card scale-card">
                <div className="card-topline"><strong>{midiToNote(startMidi + setShift)} 시작 · ‘{vowel}’</strong><span>반음씩 상승</span></div>
                <div className="scale-path" aria-label="도 레 미 파 솔 파 미 레 도">
                  {scaleNames.map((name, index) => <span key={`${name}-${index}`} className={activeIndex === index ? "active" : ""}>{name}</span>)}
                </div>
              </article>

              <article className="pitch-card">
                <span>목표 음정</span><h2>{targetNote}</h2>
                <div className="pitch-track"><span className="pitch-marker" style={{ "--pitch-position": `${clamp(50 + (pitchDifference ?? 0) / 2, 4, 96)}%` } as CSSProperties} /></div>
                <div className="pitch-labels"><span>낮음</span><strong>{pitchDifference === null ? "소리를 기다리는 중" : Math.abs(pitchDifference) <= 15 ? `${pitchDifference >= 0 ? "+" : ""}${pitchDifference} cent · 정확해요` : pitchDifference < 0 ? `${pitchDifference} cent · 조금 높여보세요` : `+${pitchDifference} cent · 조금 낮춰보세요`}</strong><span>높음</span></div>
                <div className="detected-row"><span>현재 음정</span><strong>{detectedNote}</strong><span>입력 {inputLevel}%</span></div>
              </article>

              <article className="surface-card voice-estimate">
                <div className="card-topline"><div><strong>현재 발성 추정</strong><small>마이크 음향 특징 기반</small></div><span className="type-label">{koreanVoiceNames[topVoice]}</span></div>
                {(Object.entries(probabilities) as [keyof VoiceProbabilities, number][]).sort((a, b) => b[1] - a[1]).map(([key, value]) => (
                  <div className="meter" key={key}><div><span>{koreanVoiceNames[key]}</span><strong>{value}%</strong></div><div className="meter-track"><span style={{ width: `${value}%` }} /></div></div>
                ))}
                <p className="estimate-note">발성 분류는 실험적 추정치이며 성대 상태를 의학적으로 판정하지 않습니다.</p>
              </article>

              {error && <p className="error-message" role="alert">{error}</p>}
              <div className="practice-actions">
                {isPracticing ? <button className="stop-button" type="button" onClick={finishPractice}>연습 종료·분석</button> : <button className="primary-button" type="button" onClick={startPractice}>마이크 연습 시작</button>}
              </div>
            </section>
          )}

          {activeTab === "analysis" && (
            <section aria-label="연습 분석">
              {lastResult ? (
                <>
                  <article className="surface-card result-hero">
                    <div><p className="eyebrow">최근 연습 결과</p><h2>{lastResult.score >= 80 ? "성구 연결이 좋아지고 있어요" : "천천히 연결을 다듬어봐요"}</h2><span>{formatDuration(lastResult.durationSeconds)} · {lastResult.range}</span></div>
                    <div className="score-ring"><strong>{lastResult.score}</strong><small>점</small></div>
                  </article>

                  <div className="section-heading"><h2>연습 지표</h2></div>
                  <article className="surface-card metric-list">
                    {[
                      ["피치 정확도", lastResult.pitchAccuracy],
                      ["성구 연결", lastResult.connection],
                      ["음정 안정성", lastResult.stability],
                    ].map(([label, value]) => (
                      <div className="result-meter" key={String(label)}><div><span>{label}</span><strong>{value}%</strong></div><div className="progress-track"><span style={{ width: `${value}%` }} /></div></div>
                    ))}
                  </article>

                  <div className="section-heading"><h2>발성 추정 비율</h2></div>
                  <article className="surface-card distribution-card">
                    {(Object.entries(lastResult.distribution) as [keyof VoiceProbabilities, number][]).map(([key, value]) => (
                      <div key={key}><span>{koreanVoiceNames[key]}</span><strong>{value}%</strong></div>
                    ))}
                  </article>

                  <article className="coaching-card"><span>다음 연습 포인트</span><strong>{lastResult.connection >= 75 ? "현재 음량을 유지하며 시작음을 반음 높여보세요." : "중성 구간에서 볼륨을 조금 줄이고 ‘우’로 연결해보세요."}</strong></article>
                  <button className="primary-button" type="button" onClick={() => goTo("practice")}>다시 연습하기</button>
                </>
              ) : (
                <div className="surface-card empty-state large"><span>▥</span><h2>아직 분석 결과가 없어요</h2><p>마이크 연습을 완료하면 피치 정확도와 발성 변화를 확인할 수 있어요.</p><button className="primary-button" type="button" onClick={() => goTo("practice")}>첫 연습 시작</button></div>
              )}
            </section>
          )}

          {activeTab === "history" && (
            <section aria-label="연습 기록">
              <div className="section-heading"><div><p className="eyebrow">나의 변화</p><h2>최근 발성 연습 기록</h2></div></div>
              <article className="surface-card history-card">
                {history.length ? history.map((result) => (
                  <button type="button" className="history-row" key={result.id} onClick={() => { setLastResult(result); goTo("analysis"); }}>
                    <span className="history-icon">↗</span><span><strong>5음계 상승 연습</strong><small>{result.date} · {result.range}</small></span><b>{result.score}</b>
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
