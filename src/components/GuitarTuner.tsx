import { useEffect, useState, useRef, useCallback } from "react";

const YIN_THRESHOLD = 0.10;
const FFT_SIZE = 8192;

function yin(buffer: Float32Array, sampleRate: number): number {
  const N = buffer.length;
  const half = Math.floor(N / 2);

  const diff = new Float32Array(half);
  for (let tau = 1; tau < half; tau++) {
    for (let i = 0; i < half; i++) {
      const d = buffer[i] - buffer[i + tau];
      diff[tau] += d * d;
    }
  }

  const cmnd = new Float32Array(half);
  cmnd[0] = 1;
  let sum = 0;
  for (let tau = 1; tau < half; tau++) {
    sum += diff[tau];
    cmnd[tau] = sum > 0 ? diff[tau] * tau / sum : 0;
  }

  const minPeriod = Math.floor(sampleRate / 380);
  const maxPeriod = Math.floor(sampleRate / 70);

  let tau = minPeriod;
  while (tau < maxPeriod) {
    if (cmnd[tau] < YIN_THRESHOLD) {
      while (tau + 1 < maxPeriod && cmnd[tau + 1] < cmnd[tau]) tau++;
      break;
    }
    tau++;
  }

  if (tau === maxPeriod || cmnd[tau] >= YIN_THRESHOLD) return -1;

  const x0 = tau > 0 ? cmnd[tau - 1] : cmnd[tau];
  const x2 = tau + 1 < half ? cmnd[tau + 1] : cmnd[tau];
  let betterTau: number;
  
  if (x0 < x2) {
    betterTau = tau - 0.5 * (x2 - x0) / (x0 - 2 * cmnd[tau] + x2);
  } else {
    betterTau = tau;
  }

  return sampleRate / betterTau;
}

const STRINGS = [
  { note: "E2", freq: 82.41,  label: "6" },
  { note: "A2", freq: 110.00, label: "5" },
  { note: "D3", freq: 146.83, label: "4" },
  { note: "G3", freq: 196.00, label: "3" },
  { note: "B3", freq: 246.94, label: "2" },
  { note: "E4", freq: 329.63, label: "1" },
];

class RingBuffer {
  private buf: number[];
  private idx = 0;
  private filled = false;
  
  constructor(private size: number) { 
    this.buf = Array(size).fill(0); 
  }
  
  push(v: number) {
    this.buf[this.idx] = v;
    this.idx = (this.idx + 1) % this.size;
    if (this.idx === 0) this.filled = true;
  }
  
  median(): number {
    const data = this.filled ? [...this.buf] : this.buf.slice(0, this.idx);
    if (!data.length) return 0;
    const s = [...data].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }
  
  reset() { 
    this.buf = Array(this.size).fill(0); 
    this.idx = 0; 
    this.filled = false; 
  }
  
  get count() { 
    return this.filled ? this.size : this.idx; 
  }
}

const noteName = (n: string) => n.replace(/[0-9]/g, "");
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function GuitarTuner() {
  const [isListening, setIsListening] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [cents, setCents] = useState(0);
  const [volume, setVolume] = useState(0);
  const [denied, setDenied] = useState(false);
  
  const [targetIdx, setTargetIdx] = useState(0);
  const [completedStrings, setCompletedStrings] = useState<boolean[]>(Array(6).fill(false));
  const [isSuccessHold, setIsSuccessHold] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const anlRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const ringRef = useRef(new RingBuffer(7));
  const smoothRef = useRef(0);
  const holdRef = useRef(0);
  
  const targetIdxRef = useRef(0);
  const advancingRef = useRef(false);
  const tunedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleManualStringSelect = (index: number) => {
    setTargetIdx(index);
    targetIdxRef.current = index;
    setIsSuccessHold(false);
    advancingRef.current = false;
    if (tunedTimerRef.current) {
      clearTimeout(tunedTimerRef.current);
      tunedTimerRef.current = null;
    }
  };

  const resetTuning = () => {
    setCompletedStrings(Array(6).fill(false));
    setTargetIdx(0);
    targetIdxRef.current = 0;
    setIsSuccessHold(false);
    advancingRef.current = false;
  };

  const loop = useCallback(() => {
    if (!anlRef.current || !ctxRef.current) return;

    const buf = new Float32Array(FFT_SIZE);
    anlRef.current.getFloatTimeDomainData(buf);

    let rms = 0;
    for (const v of buf) rms += v * v;
    rms = Math.sqrt(rms / buf.length);
    setVolume(rms);

    const MIN_RMS = 0.003;

    if (rms > MIN_RMS && !advancingRef.current) {
      holdRef.current = 0;
      const freq = yin(buf, ctxRef.current.sampleRate);

      if (freq > 0) {
        ringRef.current.push(freq);
        const med = ringRef.current.median();

        const diff = Math.abs(med - smoothRef.current);
        const alpha = smoothRef.current === 0 ? 1 : diff > 25 ? 0.8 : 0.15;
        smoothRef.current = smoothRef.current === 0 ? med : alpha * med + (1 - alpha) * smoothRef.current;

        const targetFreq = STRINGS[targetIdxRef.current].freq;
        const c = 1200 * Math.log2(smoothRef.current / targetFreq);

        setPitch(smoothRef.current);
        setCents(c);

        if (Math.abs(c) < 4) {
          if (!tunedTimerRef.current) {
            tunedTimerRef.current = setTimeout(() => {
              setIsSuccessHold(true);
              advancingRef.current = true;
              
              setCompletedStrings(prev => {
                const next = [...prev];
                next[targetIdxRef.current] = true;
                return next;
              });

              setTimeout(() => {
                const nextIdx = targetIdxRef.current + 1;
                if (nextIdx < 6) {
                  setTargetIdx(nextIdx);
                  targetIdxRef.current = nextIdx;
                }
                setIsSuccessHold(false);
                advancingRef.current = false;
                smoothRef.current = 0;
                ringRef.current.reset();
                setPitch(0);
                setCents(0);
              }, 1200);

            }, 600);
          }
        } else {
          if (tunedTimerRef.current) { 
            clearTimeout(tunedTimerRef.current); 
            tunedTimerRef.current = null; 
          }
        }
      }
    } else if (rms <= MIN_RMS && !advancingRef.current) {
      holdRef.current++;
      if (holdRef.current > 30) {
        smoothRef.current = 0;
        ringRef.current.reset();
        setPitch(0); 
        setCents(0); 
        if (tunedTimerRef.current) { 
          clearTimeout(tunedTimerRef.current); 
          tunedTimerRef.current = null; 
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: "interactive" });
      await ctx.resume();
      const anl = ctx.createAnalyser();
      anl.fftSize = FFT_SIZE;
      anl.smoothingTimeConstant = 0;
      ctx.createMediaStreamSource(stream).connect(anl);
      ctxRef.current = ctx; 
      anlRef.current = anl;
      smoothRef.current = 0; 
      holdRef.current = 0; 
      ringRef.current.reset();
      setIsListening(true); 
      setDenied(false);
      loop();
    } catch { 
      setDenied(true); 
    }
  };

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    ctxRef.current?.state !== "closed" && ctxRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (tunedTimerRef.current) clearTimeout(tunedTimerRef.current);
    setIsListening(false); 
    setPitch(0); 
    setCents(0); 
    setVolume(0); 
    setIsSuccessHold(false);
    advancingRef.current = false;
    smoothRef.current = 0; 
    ringRef.current.reset();
  }, []);

  useEffect(() => () => stop(), [stop]);

  const currentTarget = STRINGS[targetIdx];
  const displayCents = clamp(cents, -50, 50);
  const needle = (displayCents / 50) * 45;
  
  const isPerfect = isSuccessHold;
  const isLow = cents < -4 && pitch > 0 && !isSuccessHold;
  const isHigh = cents > 4 && pitch > 0 && !isSuccessHold;
  const hasSignal = volume > 0.003;

  const needleRad = (needle * Math.PI) / 180;
  const nx = 150 + 105 * Math.sin(needleRad);
  const ny = 150 - 105 * Math.cos(needleRad);

  const accentColor = isPerfect ? "#00e676" : (isLow || isHigh) ? "#ff6b35" : "#555";

  const VOL_BARS = 14;
  const volNorm = clamp(Math.log1p(volume / 0.003) / Math.log1p(50), 0, 1);
  const activeBars = Math.round(volNorm * VOL_BARS);

  const statusText =
    isPerfect ? "PERFECT" :
    isLow ? "TOO LOW" :
    isHigh ? "TOO HIGH" :
    pitch > 0 ? "ADJUST" :
    hasSignal ? "LISTENING" : "PLAY STRING " + currentTarget.label;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 select-none overflow-hidden"
      style={{ background: "#0a0a0c", fontFamily: "'DM Mono','Fira Mono','Courier New',monospace" }}
    >
      <div className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff08 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />

      <div className="z-10 text-center mb-6">
        <p className="text-[9px] tracking-[0.6em] mb-1" style={{ color: "#2a2a30" }}>GUIDED MODE</p>
        <h1 className="text-2xl font-bold tracking-[0.15em]" style={{ color: "#00e676" }}>GUITAR TUNER</h1>
        <p className="text-[9px] tracking-[0.5em] mt-1" style={{ color: "#222228" }}>STANDARD · E A D G B E</p>
      </div>

      {!isListening ? (
        <div className="z-10 flex flex-col items-center gap-5">
          {denied && (
            <div className="text-[10px] tracking-widest px-5 py-2 rounded border text-center"
              style={{ color: "#ff5252", borderColor: "#3a1010", background: "#1a0808" }}>
              MICROPHONE DENIED
            </div>
          )}
          <button onClick={start} className="relative w-36 h-36 rounded-full flex flex-col items-center justify-center active:scale-95"
            style={{
              background: "radial-gradient(circle at 35% 35%, #00e676, #009e55)",
              boxShadow: "0 0 60px rgba(0,230,118,0.4), 0 0 120px rgba(0,230,118,0.1)",
            }}>
            <svg width="36" height="36" fill="black" viewBox="0 0 24 24" className="mb-1">
              <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
              <path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11h-2z"/>
            </svg>
            <span className="text-black text-[9px] font-bold tracking-[0.3em]">TAP TO START</span>
          </button>
        </div>
      ) : (
        <div className="z-10 flex flex-col items-center gap-4 w-full max-w-xs">

          <div className="grid grid-cols-6 gap-[6px] w-full">
            {STRINGS.map((s, idx) => {
              const isTarget = targetIdx === idx;
              const isDone = completedStrings[idx];
              const isCurrentSuccess = isTarget && isSuccessHold;
              
              const btnBg = isCurrentSuccess || isDone ? "#00e676" : isTarget ? "rgba(0,230,118,0.08)" : "#111115";
              const btnBorder = isCurrentSuccess || isDone ? "#00e676" : isTarget ? "#00e676" : "#1e1e24";
              const btnColor = isCurrentSuccess || isDone ? "#000" : isTarget ? "#00e676" : "#33333a";
              const btnShadow = isCurrentSuccess ? "0 0 20px rgba(0,230,118,0.5)" : isTarget ? "0 0 10px rgba(0,230,118,0.2)" : "none";

              return (
                <button 
                  key={s.note} 
                  onClick={() => handleManualStringSelect(idx)}
                  className="flex flex-col items-center gap-1 cursor-pointer"
                  style={{ transform: isTarget ? "scale(1.12)" : "scale(1)", transition: "transform 0.1s" }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border"
                    style={{
                      background: btnBg,
                      borderColor: btnBorder,
                      color: btnColor,
                      boxShadow: btnShadow,
                      transition: "all 0.12s",
                    }}>
                    {noteName(s.note)}
                  </div>
                  <span className="text-[8px]" style={{ color: isTarget || isDone ? "#00e676" : "#222" }}>{s.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative" style={{ width: 300, height: 300 }}>
            <svg width="300" height="300" viewBox="0 0 300 300" className="absolute inset-0">
              <circle cx="150" cy="150" r="148" fill="#0e0e12" stroke="#1a1a20" strokeWidth="1.5" />

              <circle cx="150" cy="150" r="130"
                fill="url(#dialGrad)"
                stroke={isPerfect ? "#00e676" : "#1a1a20"}
                strokeWidth={isPerfect ? "2" : "1"}
                style={{ transition: "stroke 0.4s" }}
              />

              <defs>
                <radialGradient id="dialGrad" cx="38%" cy="35%">
                  <stop offset="0%"   stopColor="#1c1c22" />
                  <stop offset="100%" stopColor="#0c0c10" />
                </radialGradient>
              </defs>

              {(() => {
                const arcR = 122;
                const cx = 150, cy = 150;
                const segments = 40;
                const startAngle = -135;
                const totalAngle = 270;
                return Array.from({ length: segments }).map((_, i) => {
                  const t1 = startAngle + (i / segments) * totalAngle;
                  const t2 = startAngle + ((i + 1) / segments) * totalAngle;
                  const r1 = (t1 * Math.PI) / 180;
                  const r2 = (t2 * Math.PI) / 180;
                  const mid = (i / segments - 0.5) * 2;
                  const abs = Math.abs(mid);
                  
                  const g = Math.round(230 * (1 - abs * 0.85));
                  const r = Math.round(255 * abs * 0.85);
                  const col = `rgb(${r},${g},50)`;
                  
                  const x1 = cx + arcR * Math.cos(r1), y1 = cy + arcR * Math.sin(r1);
                  const x2 = cx + arcR * Math.cos(r2), y2 = cy + arcR * Math.sin(r2);
                  const xi = cx + (arcR - 6) * Math.cos(r1), yi = cy + (arcR - 6) * Math.sin(r1);
                  const xj = cx + (arcR - 6) * Math.cos(r2), yj = cy + (arcR - 6) * Math.sin(r2);
                  
                  return (
                    <path key={i}
                      d={`M ${x1} ${y1} A ${arcR} ${arcR} 0 0 1 ${x2} ${y2} L ${xj} ${yj} A ${arcR - 6} ${arcR - 6} 0 0 0 ${xi} ${yi} Z`}
                      fill={col} opacity="0.18"
                    />
                  );
                });
              })()}

              {Array.from({ length: 61 }).map((_, i) => {
                const angle = -135 + (i / 60) * 270;
                const rad   = (angle * Math.PI) / 180;
                const isC   = i === 30;
                const isM   = i % 6 === 0;
                const r1    = 128, r2 = isC ? 108 : isM ? 118 : 123;
                return (
                  <line key={i}
                    x1={150 + r1 * Math.cos(rad)} y1={150 + r1 * Math.sin(rad)}
                    x2={150 + r2 * Math.cos(rad)} y2={150 + r2 * Math.sin(rad)}
                    stroke={isC ? "#00e676" : isM ? "#2e2e38" : "#1a1a22"}
                    strokeWidth={isC ? 2.5 : isM ? 1.5 : 0.8}
                  />
                );
              })}

              {[-50, -25, 0, 25, 50].map((v) => {
                const a = -135 + ((v + 50) / 100) * 270;
                const r = (a * Math.PI) / 180;
                const d = 108;
                return (
                  <text key={v}
                    x={150 + d * Math.cos(r)} y={150 + d * Math.sin(r)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="7" fill={v === 0 ? "#00e676" : "#2a2a32"} fontFamily="monospace">
                    {v === 0 ? "0" : `${v > 0 ? "+" : ""}${v}`}
                  </text>
                );
              })}

              <line x1="151" y1="151" x2={nx + 1} y2={ny + 1}
                stroke="rgba(0,0,0,0.5)" strokeWidth="4" strokeLinecap="round" />
              
              <line x1="150" y1="150" x2={nx} y2={ny}
                stroke={accentColor}
                strokeWidth="2.5" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 5px ${accentColor})`, transition: "stroke 0.25s, filter 0.25s" }}
              />
              
              <circle cx="150" cy="150" r="6" fill={accentColor}
                style={{ filter: isPerfect ? "drop-shadow(0 0 10px #00e676)" : "none", transition: "fill 0.25s" }} />
              <circle cx="150" cy="150" r="3" fill="#0a0a0c" />

              {isPerfect && (
                <circle cx="150" cy="150" r="130" fill="none" stroke="#00e676" strokeWidth="1.5" opacity="0.5">
                  <animate attributeName="r" values="130;145;130" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ paddingTop: 10 }}>
              
              <div className="text-[8px] tracking-[0.4em] font-bold mb-2 h-3"
                style={{ color: accentColor, transition: "color 0.25s" }}>
                {statusText}
              </div>

              <div className="text-7xl font-bold leading-none"
                style={{
                  color: isPerfect ? "#00e676" : pitch > 0 ? "#f0f0f8" : "#1a1a22",
                  textShadow: isPerfect ? "0 0 40px rgba(0,230,118,0.6)" : "none",
                  transition: "color 0.2s, text-shadow 0.2s",
                  letterSpacing: "-0.02em",
                }}>
                {noteName(currentTarget.note)}
              </div>

              <div className="text-[10px] mt-2 font-mono" style={{ color: "#2a2a38" }}>
                {pitch > 0 ? `${pitch.toFixed(2)} Hz` : ""}
              </div>

              <div className="text-sm mt-1 font-mono font-bold"
                style={{ color: accentColor, transition: "color 0.2s", minHeight: "20px" }}>
                {pitch > 0 ? `${cents > 0 ? "+" : ""}${Math.round(displayCents)}¢` : ""}
              </div>
            </div>
          </div>

          <div className="w-full flex items-center gap-2 px-1">
            <span className="text-[7px] font-mono w-4 text-right" style={{ color: "#222" }}>-50</span>
            <div className="flex-1 h-[4px] rounded-full relative overflow-hidden" style={{ background: "#111115" }}>
              <div className="absolute top-0 left-1/2 w-px h-full" style={{ background: "#222" }} />
              {pitch > 0 && (
                <div className="absolute top-0 h-full rounded-full"
                  style={{
                    background: accentColor,
                    left:  displayCents >= 0 ? "50%" : `${50 + (displayCents / 50) * 50}%`,
                    width: `${Math.abs(displayCents / 50) * 50}%`,
                    boxShadow: `0 0 8px ${accentColor}`,
                    transition: "left 0.06s linear, width 0.06s linear, background 0.25s",
                  }}
                />
              )}
            </div>
            <span className="text-[7px] font-mono w-4" style={{ color: "#222" }}>+50</span>
          </div>

          <div className="flex items-center gap-2 w-full justify-between mt-2">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" fill={hasSignal ? "#00e676" : "#2a2a30"} viewBox="0 0 24 24"
                style={{ transition: "fill 0.15s" }}>
                <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11h-2z"/>
              </svg>
              <div className="flex gap-[2px]">
                {Array.from({ length: VOL_BARS }).map((_, i) => (
                  <div key={i} className="rounded-sm"
                    style={{
                      width: 7, height: 16,
                      background: i < activeBars
                        ? (i < 8 ? "#00e676" : i < 11 ? "#ffeb3b" : "#ff5252")
                        : "#131318",
                      boxShadow: i < activeBars && i < 8 ? "0 0 4px rgba(0,230,118,0.3)" : "none",
                      transition: "background 0.04s",
                    }}
                  />
                ))}
              </div>
            </div>
            
            <button onClick={resetTuning}
              className="px-4 py-1.5 rounded-full text-[9px] tracking-widest font-bold bg-[#1a1a20] text-[#555] active:scale-95"
              style={{ transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.color="#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.color="#555"; }}>
              RESET
            </button>
          </div>

          <button onClick={stop}
            className="mt-2 w-full py-3 rounded-xl text-[10px] tracking-widest font-bold border active:scale-95"
            style={{ borderColor: "#1a1a20", color: "#2a2a38", background: "transparent", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#ff5252"; e.currentTarget.style.color="#ff5252"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#1a1a20"; e.currentTarget.style.color="#2a2a38"; }}>
            STOP TUNER
          </button>
        </div>
      )}
    </div>
  );
}