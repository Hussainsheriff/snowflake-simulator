import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Snowflake, 
  Wind, 
  Clock, 
  Volume2, 
  VolumeX, 
  Layers, 
  Sliders, 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  Sparkles,
  ExternalLink,
  RotateCcw,
  Menu,
  Terminal,
  HelpCircle,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Custom Type Definitions for Simulation Particles
interface Particle {
  id: string;
  type: 'snowflake' | 'balloon';
  leftPos: number; // Percentage offset horizontally (0 - 100)
  size: number;     // Diameter in px
  duration: number; // Flight duration in seconds
  delay: number;    // Staggered launch delay in seconds
  drift: number;    // Lateral horizontal sway/wind drift scale
  rotation: number; // Launch rotational angle
  colorHex?: string; // Hex color code for balloons
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  category: 'system' | 'snowflakes' | 'balloons' | 'config';
}

// Client-Side Web Audio SFX Synthesizer
class SoundSynth {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playSnowflakeSfx() {
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;

      // 1. Synthesize a cold, high-frequency white noise breeze
      const bufferSize = ctx.sampleRate * 5; // 5-second buffer duration
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      // Bandpass filter to make the noise sound like gusting cold wind
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(750, now);
      bpf.Q.setValueAtTime(2.5, now);

      // Low Frequency Oscillator (LFO) to modulate the wind frequency
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.35, now); // 0.35 Hz gusting intervals

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(320, now); // Modulates filter by ±320Hz

      lfo.connect(lfoGain);
      lfoGain.connect(bpf.frequency);

      // Gain Envelope for a smooth 5-second fade in/out
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.08, now + 0.4);
      gainNode.gain.exponentialRampToValueAtTime(0.06, now + 3.2);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 4.95);

      noiseSource.connect(bpf);
      bpf.connect(gainNode);
      gainNode.connect(ctx.destination);

      noiseSource.start(now);
      lfo.start(now);

      noiseSource.stop(now + 5);
      lfo.stop(now + 5);
    } catch (error) {
      console.warn('Audio Context creation was blocked or is unsupported in this environment.', error);
    }
  }

  playBalloonSfx() {
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;

      // Synthesize 5 pleasant, ascending musical "bubbly" standard pop sounds spread across the 5s timeline
      for (let i = 0; i < 6; i++) {
        const triggerTime = now + (i * 0.8) + (Math.random() * 0.15);
        
        const osc = ctx.createOscillator();
        const pitchGain = ctx.createGain();
        const volGain = ctx.createGain();

        // Elegant physical note frequencies
        const baseFreq = 261.63 + (i * 65.41); // Ascending musical intervals (C, E, G, B, etc.)
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, triggerTime);
        // Upward pitch bend (like a balloon rising swiftly)
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, triggerTime + 0.45);

        volGain.gain.setValueAtTime(0, triggerTime);
        volGain.gain.linearRampToValueAtTime(0.12, triggerTime + 0.05);
        volGain.gain.exponentialRampToValueAtTime(0.0001, triggerTime + 0.5);

        osc.connect(volGain);
        volGain.connect(ctx.destination);

        osc.start(triggerTime);
        osc.stop(triggerTime + 0.55);
      }
    } catch (error) {
      console.warn('Audio Context block prevented balloon SFX play.', error);
    }
  }
}

// Color Palettes for Customizable Balloons
const BALLOON_PALETTES = {
  festive: [
    'radial-gradient(circle at 35% 35%, #ec4899 20%, #be185d 100%)', // Vibrant pink
    'radial-gradient(circle at 35% 35%, #3b82f6 20%, #1d4ed8 100%)', // Vibrant blue
    'radial-gradient(circle at 35% 35%, #10b981 20%, #047857 100%)', // Emerald green
    'radial-gradient(circle at 35% 35%, #f59e0b 20%, #b45309 100%)', // Warm gold
    'radial-gradient(circle at 35% 35%, #ef4444 20%, #b91c1c 100%)', // Ruby red
    'radial-gradient(circle at 35% 35%, #8b5cf6 20%, #6d28d9 100%)', // Violet
  ],
  corporate: [
    'radial-gradient(circle at 35% 35%, #0f172a 20%, #1e293b 100%)', // Slate Navy
    'radial-gradient(circle at 35% 35%, #0d9488 20%, #115e59 100%)', // Deep Teal
    'radial-gradient(circle at 35% 35%, #475569 20%, #334155 100%)', // Charcoal Gray
    'radial-gradient(circle at 35% 35%, #ca8a04 20%, #854d0e 100%)', // Sand Ochre
    'radial-gradient(circle at 35% 35%, #0284c7 20%, #0369a1 100%)', // Ocean Blue
  ],
  cyber: [
    'radial-gradient(circle at 35% 35%, #06b6d4 20%, #0891b2 100%)', // Bright Cyan
    'radial-gradient(circle at 35% 35%, #f43f5e 20%, #e11d48 100%)', // Hot Coral Pink
    'radial-gradient(circle at 35% 35%, #10b981 20%, #059669 100%)', // Cyber Green
    'radial-gradient(circle at 35% 35%, #a855f7 20%, #7e22ce 100%)', // Magenta Violet
  ]
};

const synth = new SoundSynth();

export default function App() {
  const [activeEffect, setActiveEffect] = useState<'none' | 'snowflakes' | 'balloons'>('none');
  const [timeLeft, setTimeLeft] = useState<number>(0); // remaining time in milliseconds (0 - 5000)
  const [particles, setParticles] = useState<Particle[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  
  // Customization presets
  const [quantity, setQuantity] = useState<number>(30); // 15, 30, 60
  const [flightSpeed, setFlightSpeed] = useState<'slow' | 'normal' | 'brisk'>('normal');
  const [windSway, setWindSway] = useState<'calm' | 'ambient' | 'sweeping'>('ambient');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [canvasLayout, setCanvasLayout] = useState<'contained' | 'viewport'>('contained');
  const [balloonTheme, setBalloonTheme] = useState<'festive' | 'corporate' | 'cyber'>('festive');
  const [logEntries, setLogEntries] = useState<LogEntry[]>([
    {
      id: "initial-log",
      timestamp: new Date().toLocaleTimeString(),
      message: "Atmos-Simulator virtual environment loaded successfully.",
      category: 'system'
    }
  ]);

  // Handle local clock updates
  useEffect(() => {
    setActiveClock();
    const clockTimer = setInterval(() => {
      setActiveClock();
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const setActiveClock = () => {
    const d = new Date();
    setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
  };

  // Safe terminal logging auxiliary function
  const addLog = (message: string, category: 'system' | 'snowflakes' | 'balloons' | 'config' = 'system') => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      message,
      category
    };
    setLogEntries(prev => [newEntry, ...prev].slice(0, 35)); // Cap history logs for performance
  };

  // Master timer control loop
  useEffect(() => {
    if (timeLeft <= 0) {
      if (activeEffect !== 'none') {
        addLog(`Simulation cycle [${activeEffect.toUpperCase()}] reached 5.0s expiration limit. Stopped source emission.`, 'system');
        setActiveEffect('none');
      }
      return;
    }

    const intervalStep = 20; // 50 updates per second for fluid high accuracy updates
    const timer = setTimeout(() => {
      setTimeLeft(prev => Math.max(0, prev - intervalStep));
    }, intervalStep);

    return () => clearTimeout(timer);
  }, [timeLeft, activeEffect]);

  // Speed mapping conversions (seconds)
  const durationModifier = useMemo(() => {
    switch (flightSpeed) {
      case 'slow': return 1.6;
      case 'brisk': return 0.65;
      case 'normal':
      default:
        return 1.0;
    }
  }, [flightSpeed]);

  // Sway pixel calculations
  const swapingPixels = useMemo(() => {
    switch (windSway) {
      case 'calm': return 0;
      case 'sweeping': return 120;
      case 'ambient':
      default:
        return 50;
    }
  }, [windSway]);

  // Trigger elements dispatcher
  const handleTrigger = (type: 'snowflakes' | 'balloons') => {
    // 1. Synthesize Audio feedback if active
    if (audioEnabled) {
      if (type === 'snowflakes') {
        synth.playSnowflakeSfx();
      } else {
        synth.playBalloonSfx();
      }
    }

    addLog(`Dispensing atmospheric sequence [${type.toUpperCase()}] at ${quantity} density count.`, type);

    // 2. Clear current simulation list
    setParticles([]);
    setActiveEffect(type);
    setTimeLeft(5000); // Trigger exactly 5 seconds countdown

    // 3. Generates high-fidelity particle data array
    const generated: Particle[] = [];
    const colors = BALLOON_PALETTES[balloonTheme];

    for (let i = 0; i < quantity; i++) {
      // Custom calculation targeting a professional, non-clumping staggered release over 4.5 seconds
      const delay = (i / quantity) * 4.2 + (Math.random() * 0.4); 
      
      // Duration calculations for 100% trajectory run
      const durationBase = type === 'snowflakes' 
        ? 2.8 + Math.random() * 1.5 
        : 3.2 + Math.random() * 1.8;
      const finalDuration = durationBase * durationModifier;

      const size = type === 'snowflakes'
        ? 36 + Math.floor(Math.random() * 20)  // Snowflake size range doubled (Medium twice: ~36-56px)
        : 32 + Math.floor(Math.random() * 16); // Balloon size range (Medium: ~32-48px)

      generated.push({
        id: `particle-${type}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        type: type === 'snowflakes' ? 'snowflake' : 'balloon',
        leftPos: 3 + (i * (94 / quantity)) + (Math.random() * 5 - 2.5), // Beautiful linear grid spacing with random wiggle
        size,
        duration: finalDuration,
        delay,
        drift: swapingPixels / 10 + (Math.random() * swapingPixels / 15), // Convert to viewport width sway offset
        rotation: Math.random() * 32 - 16, // Beautiful initial natural tilt
        colorHex: colors[i % colors.length]
      });
    }

    setParticles(generated);
  };

  // Complete simulation clear
  const resetSimulation = () => {
    addLog("System trigger override. Clearing all active particles and resetting clock parameters.", 'system');
    setParticles([]);
    setActiveEffect('none');
    setTimeLeft(0);
  };

  const progressPercent = (timeLeft / 5000) * 100;

  return (
    <div id="simulation-root" className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between transition-all relative overflow-x-hidden">
      
      {/* Immersive Viewport Layer (Portal/Absolute Render outside dashboard when in viewport layout) */}
      {canvasLayout === 'viewport' && activeEffect !== 'none' && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {activeEffect === 'snowflakes' && (
            <div className="absolute inset-0">
              {particles.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ y: -50, x: `${p.leftPos}%`, opacity: 0, rotate: p.rotation }}
                  animate={{
                    y: '105vh',
                    x: [
                      `${p.leftPos}%`,
                      `${p.leftPos + p.drift}%`,
                      `${p.leftPos - p.drift * 0.5}%`,
                      `${p.leftPos + p.drift * 1.2}%`
                    ],
                    opacity: [0, 0.9, 0.9, 0.8, 0],
                    rotate: p.rotation + p.drift * 3,
                  }}
                  transition={{
                    duration: p.duration,
                    delay: p.delay,
                    ease: 'linear',
                  }}
                  className="absolute text-sky-400 flex items-center justify-center p-1"
                  style={{ width: p.size, height: p.size }}
                >
                  <Snowflake 
                    size={p.size} 
                    className="text-sky-300 drop-shadow-[0_2px_8px_rgba(125,211,252,0.4)]" 
                  />
                </motion.div>
              ))}
            </div>
          )}

          {activeEffect === 'balloons' && (
            <div className="absolute inset-0">
              {particles.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ y: '105vh', x: `${p.leftPos}%`, opacity: 0, rotate: p.rotation }}
                  animate={{
                    y: -120,
                    x: [
                      `${p.leftPos}%`,
                      `${p.leftPos - p.drift}%`,
                      `${p.leftPos + p.drift * 0.6}%`,
                      `${p.leftPos - p.drift * 0.8}%`
                    ],
                    opacity: [0, 1, 1, 0.9, 0],
                    rotate: [p.rotation, p.rotation + 12, p.rotation - 12, p.rotation]
                  }}
                  transition={{
                    duration: p.duration,
                    delay: p.delay,
                    ease: 'easeOut',
                  }}
                  className="absolute flex flex-col items-center justify-start origin-bottom"
                  style={{ width: p.size * 1.2, height: p.size * 3.2 }}
                >
                  <div 
                    className="relative rounded-full shadow-md border border-white/20"
                    style={{
                      width: p.size,
                      height: p.size * 1.18,
                      background: p.colorHex,
                    }}
                  >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-transparent to-white/35 opacity-70 pointer-events-none" />
                    <div className="absolute top-[16%] left-[22%] w-[22%] h-[14%] rounded-full bg-white/50 blur-[0.5px] rotate-[-25deg]" />
                    <div 
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-1.5 opacity-90" 
                      style={{ 
                        backgroundColor: 'inherit',
                        clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)'
                      }} 
                    />
                  </div>
                  <svg width="6" height="42" className="mt-[2px] opacity-75">
                    <path d="M 3 0 Q 1 12, 3 24 T 3 42" fill="transparent" stroke="#cbd5e1" strokeWidth="1.2" />
                  </svg>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Corporate Styled Global Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-40 shadow-[0_1px_2px_rgba(0,0,0,0.03)] selection:bg-indigo-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-md flex items-center justify-center text-white font-mono font-bold text-lg tracking-wider">
              Ω
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wider font-display uppercase text-slate-900">
                Atmosphere Preset Workbench
              </h1>
              <p className="text-xs text-slate-500 font-mono">
                Model A8-SIMULATION // Version 2026.1.18
              </p>
            </div>
          </div>

          {/* System Telemetry Badges */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-slate-600">
              <Clock size={13} className="text-slate-400 stroke-[1.8]" />
              <span>STATION TIME:</span>
              <span className="font-bold text-slate-900">{currentTime || '00:00:00'}</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-slate-600">
              <span className={`w-2 h-2 rounded-full ${activeEffect !== 'none' ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span>STATUS:</span>
              <span className="font-bold text-slate-800">
                {activeEffect !== 'none' ? `${activeEffect.toUpperCase()} ACTIVE` : 'IDLE / READY'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workbench Layout Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Controls & Settings Parameter Panel (5 cols) */}
        <section className="lg:col-span-5 space-y-6 flex flex-col">
          
          {/* Main Action Controllers Card */}
          <div className="bg-white border border-slate-200/85 rounded-xl shadow-sm p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-rose-500" />
            
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase block mb-1">
              PROMPT DIRECTIVE EMITTERS
            </span>
            <h2 className="text-xl font-semibold text-slate-900 font-display tracking-tight mb-4">
              Trigger Animation Sequences
            </h2>

            {/* TWO PRIMARY STYLISH ACTION BUTTONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              
              {/* Button A: SNOWFLAKES */}
              <button
                id="btn-trigger-snowflakes"
                onClick={() => handleTrigger('snowflakes')}
                className={`group px-4 py-4 rounded-lg flex flex-col items-center justify-center gap-3 border transition-all duration-300 relative overflow-hidden ${
                  activeEffect === 'snowflakes'
                    ? 'bg-sky-50/95 border-sky-300 text-sky-800 ring-4 ring-sky-100'
                    : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 text-slate-700 hover:text-sky-700'
                }`}
              >
                <div className={`p-2.5 rounded-md transition-colors ${
                  activeEffect === 'snowflakes'
                    ? 'bg-sky-200 text-sky-700'
                    : 'bg-slate-100 group-hover:bg-sky-100 group-hover:text-sky-600 text-slate-500'
                }`}>
                  <Snowflake className={`w-6 h-6 stroke-[1.8] ${activeEffect === 'snowflakes' ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                </div>
                <div className="text-center">
                  <span className="font-semibold text-sm tracking-tight block">Snowflakes</span>
                  <span className="text-[10px] opacity-75 font-mono">Top to Bottom (5s)</span>
                </div>

                {/* Micro Ambient Indicator */}
                {activeEffect === 'snowflakes' && (
                  <span className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                  </span>
                )}
              </button>

              {/* Button B: BALLOONS */}
              <button
                id="btn-trigger-balloons"
                onClick={() => handleTrigger('balloons')}
                className={`group px-4 py-4 rounded-lg flex flex-col items-center justify-center gap-3 border transition-all duration-300 relative overflow-hidden ${
                  activeEffect === 'balloons'
                    ? 'bg-rose-50/95 border-rose-300 text-rose-800 ring-4 ring-rose-100'
                    : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 text-slate-700 hover:text-rose-700'
                }`}
              >
                <div className={`p-2.5 rounded-md transition-colors ${
                  activeEffect === 'balloons'
                    ? 'bg-rose-200 text-rose-700'
                    : 'bg-slate-100 group-hover:bg-rose-100 group-hover:text-rose-600 text-slate-500'
                }`}>
                  {/* Styled custom svg balloon icon */}
                  <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-[1.8] fill-none" stroke="currentColor">
                    <path d="M12 2a6 6 0 0 1 6 6c0 4-4 8-6 8s-6-4-6-8a6 6 0 0 1 6-6z" />
                    <path d="M12 16v6" className="stroke-slate-400" />
                    <path d="M12 16l-2-1.5M12 16l2-1.5" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="font-semibold text-sm tracking-tight block">Balloons</span>
                  <span className="text-[10px] opacity-75 font-mono">Bottom to Top (5s)</span>
                </div>

                {/* Micro Ambient Indicator */}
                {activeEffect === 'balloons' && (
                  <span className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </button>

            </div>

            {/* SYSTEM RESET TRIGGER BUTTON */}
            <div className="flex gap-2">
              <button
                id="btn-reset-simulation"
                onClick={resetSimulation}
                className="flex-1 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-xs font-medium font-mono tracking-tight transition-colors"
                disabled={activeEffect === 'none'}
                style={{ opacity: activeEffect === 'none' ? 0.45 : 1 }}
              >
                <RotateCcw size={14} />
                STOP SIMULATION OVERRIDE
              </button>
            </div>
          </div>

          {/* Configuration Workspace Settings Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sliders size={16} className="text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900 font-display">
                Atmospheric Control Settings
              </h3>
            </div>

            {/* Parameter A: Elements Quantity density */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500 font-medium uppercase">Emitter Density</span>
                <span className="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded">{quantity} items</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 60].map((val) => (
                  <button
                    key={val}
                    onClick={() => {
                      setQuantity(val);
                      addLog(`Updated particle emitter density parameter to ${val} items.`, 'config');
                    }}
                    className={`py-1.5 rounded-md text-xs font-semibold font-mono border transition-all ${
                      quantity === val
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {val === 15 ? 'Mild' : val === 30 ? 'Medium' : 'Max'}
                  </button>
                ))}
              </div>
            </div>

            {/* Parameter B: Speed/Velocity config */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500 font-medium uppercase">Flight Airflow Velocity</span>
                <span className="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded capitalize">{flightSpeed} Velocity</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['slow', 'normal', 'brisk'] as const).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => {
                      setFlightSpeed(spd);
                      addLog(`Airflow velocity adjusted to state: [${spd.toUpperCase()}].`, 'config');
                    }}
                    className={`py-1.5 rounded-md text-xs font-semibold font-mono border transition-all capitalize ${
                      flightSpeed === spd
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {spd}
                  </button>
                ))}
              </div>
            </div>

            {/* Parameter C: Drift sway magnitude */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500 font-medium uppercase">Lateral Wind Sway</span>
                <span className="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded capitalize">{windSway}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['calm', 'ambient', 'sweeping'] as const).map((way) => (
                  <button
                    key={way}
                    onClick={() => {
                      setWindSway(way);
                      addLog(`Wind turbulence sway set to direction module: [${way.toUpperCase()}].`, 'config');
                    }}
                    className={`py-1.5 rounded-md text-xs font-semibold font-mono border transition-all capitalize ${
                      windSway === way
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {way}
                  </button>
                ))}
              </div>
            </div>

            {/* Parameter D: Balloon Palette Selectors */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-500 font-medium uppercase">Balloon Palette Theme</span>
                <span className="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded capitalize">{balloonTheme}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['festive', 'corporate', 'cyber'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => {
                      setBalloonTheme(theme);
                      addLog(`Balloon style theme updated to [${theme.toUpperCase()} Preset Palette].`, 'config');
                    }}
                    className={`py-1.5 rounded-md text-xs font-semibold font-mono border transition-all capitalize ${
                      balloonTheme === theme
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Synthesis & Canvas Mode Toggles */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Sound Synthesis Toggle */}
              <button
                id="btn-toggle-sound"
                onClick={() => {
                  setAudioEnabled(!audioEnabled);
                  addLog(audioEnabled ? 'Browser synthesizers muted.' : 'Synthesizers ready for audio play.', 'system');
                }}
                className={`py-2 px-3 border rounded-lg flex items-center justify-between text-xs font-mono transition-all ${
                  audioEnabled 
                    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300' 
                    : 'border-slate-200 text-slate-500 bg-transparent hover:bg-slate-50'
                }`}
              >
                <span className="text-left font-semibold">Sound FX Synthesizer</span>
                {audioEnabled ? <Volume2 size={16} className="text-emerald-600 animate-pulse" /> : <VolumeX size={16} />}
              </button>

              {/* Contained vs Full Screen Toggle */}
              <button
                id="btn-toggle-layout"
                onClick={() => {
                  const toLayout = canvasLayout === 'contained' ? 'viewport' : 'contained';
                  setCanvasLayout(toLayout);
                  addLog(`Simulation projection mapped to: [${toLayout.toUpperCase()} FRAME].`, 'system');
                }}
                className={`py-2 px-3 border rounded-lg flex items-center justify-between text-xs font-mono transition-all ${
                  canvasLayout === 'viewport' 
                    ? 'border-indigo-200 bg-indigo-50/50 text-indigo-800 hover:bg-indigo-50 hover:border-indigo-300' 
                    : 'border-slate-200 text-slate-500 bg-transparent hover:bg-slate-50'
                }`}
              >
                <div className="text-left font-semibold">
                  {canvasLayout === 'contained' ? 'In-Box Sandbox' : 'Full Screen View'}
                </div>
                {canvasLayout === 'contained' ? <Layers size={16} /> : <ExternalLink size={16} className="text-indigo-600 animate-pulse" />}
              </button>
            </div>

            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono pt-1">
              <HelpCircle size={10} />
              <span>Canvas Mode specifies if animation plays inside the panel or globally.</span>
            </div>

          </div>

        </section>

        {/* RIGHT COLUMN: Active Simulation Viewport Monitor Card (7 cols) */}
        <section className="lg:col-span-7 space-y-6 flex flex-col h-full justify-between">
          
          {/* Main Visual Monitor Frame Container */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col relative h-[530px]">
            
            {/* Display Viewport Header */}
            <div className="bg-slate-900 text-slate-300 px-4 py-3 border-b border-slate-800 flex items-center justify-between font-mono text-xs z-20">
              <div className="flex items-center gap-2 font-semibold">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                <span className="text-slate-100 uppercase">ATMOSPHERIC VIEWPORT MONITOR</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10.5px] text-slate-400">
                  MODE: {canvasLayout === 'contained' ? 'CONTAINED SANDBOX' : 'FULLSCREEN PROJECTED'}
                </span>
                <span className="bg-slate-800 px-2 py-0.5 rounded text-indigo-400 font-bold border border-slate-700/80">
                  {timeLeft > 0 ? (timeLeft / 1000).toFixed(2) : '0.00'}s
                </span>
              </div>
            </div>

            {/* VIEWPORT CONTROLLER MAIN CONTAINER */}
            <div className="flex-1 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden flex items-center justify-center">
              
              {/* Contained simulation canvas */}
              {canvasLayout === 'contained' && activeEffect !== 'none' && (
                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                  
                  {/* Snowflakes Renderer */}
                  {activeEffect === 'snowflakes' && particles.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ y: -50, x: `${p.leftPos}%`, opacity: 0, rotate: p.rotation }}
                      animate={{
                        y: '105%',
                        x: [
                          `${p.leftPos}%`,
                          `${p.leftPos + p.drift}%`,
                          `${p.leftPos - p.drift * 0.5}%`,
                          `${p.leftPos + p.drift * 1.2}%`
                        ],
                        opacity: [0, 0.9, 0.9, 0.8, 0],
                        rotate: p.rotation + p.drift * 3,
                      }}
                      transition={{
                        duration: p.duration,
                        delay: p.delay,
                        ease: 'linear',
                        repeat: 0,
                      }}
                      className="absolute text-sky-200 flex items-center justify-center p-1"
                      style={{
                        width: p.size,
                        height: p.size,
                      }}
                    >
                      <Snowflake 
                        size={p.size} 
                        className="text-sky-300/90 drop-shadow-[0_2px_6px_rgba(186,230,253,0.3)] filter" 
                      />
                    </motion.div>
                  ))}

                  {/* Balloons Renderer */}
                  {activeEffect === 'balloons' && particles.map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ y: '105%', x: `${p.leftPos}%`, opacity: 0, rotate: p.rotation }}
                      animate={{
                        y: -110,
                        x: [
                          `${p.leftPos}%`,
                          `${p.leftPos - p.drift}%`,
                          `${p.leftPos + p.drift * 0.5}%`,
                          `${p.leftPos - p.drift * 0.7}%`
                        ],
                        opacity: [0, 1, 1, 0.9, 0],
                        rotate: [p.rotation, p.rotation + 10, p.rotation - 10, p.rotation]
                      }}
                      transition={{
                        duration: p.duration,
                        delay: p.delay,
                        ease: 'easeOut',
                        repeat: 0,
                      }}
                      className="absolute flex flex-col items-center justify-start origin-bottom"
                      style={{
                        width: p.size * 1.2,
                        height: p.size * 3.0,
                      }}
                    >
                      {/* 3D Balloon Body */}
                      <div 
                        className="relative rounded-full shadow-lg border border-white/20"
                        style={{
                          width: p.size,
                          height: p.size * 1.16,
                          background: p.colorHex,
                        }}
                      >
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-transparent to-white/30 opacity-70 pointer-events-none" />
                        <div className="absolute top-[16%] left-[22%] w-[24%] h-[15%] rounded-full bg-white/50 blur-[0.5px] rotate-[-25deg]" />
                        <div 
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-1 opacity-90" 
                          style={{ 
                            backgroundColor: 'inherit',
                            clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)'
                          }} 
                        />
                      </div>
                      {/* String */}
                      <svg width="6" height="36" className="mt-[2px] opacity-70">
                        <path d="M 3 0 Q 1 10, 3 20 T 3 36" fill="transparent" stroke="#94a3b8" strokeWidth="1" />
                      </svg>
                    </motion.div>
                  ))}

                </div>
              )}

              {/* Dynamic Overlay elements during idle state */}
              {activeEffect === 'none' && (
                <div id="idle-welcome-overlay" className="text-center max-w-sm px-6 text-slate-400 z-10 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-inner">
                    <Activity size={24} className="stroke-[1.5] text-slate-400 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-slate-200 text-sm font-semibold tracking-wide uppercase font-display">
                      Atmosphere Projector Ready
                    </h4>
                    <p className="text-xs text-slate-500 mt-2 font-mono leading-relaxed">
                      Select [Snowflakes] or [Balloons] on the left to initiate a high-fidelity 5-second particles physics simulation trajectory flow.
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center mt-2">
                    <span className="text-[10px] uppercase tracking-wider font-mono bg-slate-800 text-slate-400 py-1 px-2.5 rounded border border-slate-700">
                      Standard Size
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-mono bg-slate-800 text-slate-400 py-1 px-2.5 rounded border border-slate-700">
                      Auto-Scale Medium
                    </span>
                  </div>
                </div>
              )}

              {/* Active Ambient Overlay showing Projection status */}
              {activeEffect !== 'none' && (
                <div className="absolute bottom-4 left-4 z-20 bg-slate-950/80 backdrop-blur border border-slate-800 rounded p-2.5 text-[10px] font-mono text-slate-400 flex flex-col gap-1 shadow-md">
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
                    <span className="font-bold">PROJECTION IN PROGRESS</span>
                  </div>
                  <span>ACTIVE INSTANCES: {quantity} Particles</span>
                  <span>THEME MODULE: {activeEffect.toUpperCase()} ({balloonTheme})</span>
                  {canvasLayout === 'viewport' && (
                    <span className="text-rose-400 text-[9px] font-semibold animate-pulse">
                      * Look up! Overlay is rendering on the screen background!
                    </span>
                  )}
                </div>
              )}

              {/* High precision countdown linear countdown gauge */}
              {activeEffect !== 'none' && (
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-800 z-30">
                  <motion.div 
                    className={`h-full ${activeEffect === 'snowflakes' ? 'bg-sky-400' : 'bg-rose-400'}`}
                    style={{ width: `${progressPercent}%` }}
                    initial={{ width: '100%' }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ ease: 'linear' }}
                  />
                </div>
              )}

            </div>

            {/* Dynamic Interactive Gauge Status and Countdown Panel under viewport */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              
              {/* Progress visual timer wheel */}
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-200"
                      strokeWidth="2.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <motion.path
                      className={activeEffect === 'snowflakes' ? 'text-sky-500' : activeEffect === 'balloons' ? 'text-rose-500' : 'text-slate-300'}
                      strokeWidth="2.5"
                      strokeDasharray={`${progressPercent}, 100`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute text-[10px] font-mono font-bold text-slate-800">
                    {timeLeft > 0 ? (timeLeft / 1000).toFixed(1) : '0.0'}s
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider leading-none mb-1">
                    TIME REMAINING
                  </span>
                  <span className="text-xs font-bold text-slate-800 font-mono tracking-tight leading-none">
                    {timeLeft > 0 ? `00:0${(timeLeft / 1000).toFixed(2)} milliseconds` : 'System Standby'}
                  </span>
                </div>
              </div>

              {/* Progress details message box */}
              <div className="col-span-1 md:col-span-2 bg-white border border-slate-200 rounded-lg p-2.5 flex items-start gap-2.5">
                <div className="mt-0.5">
                  {timeLeft > 0 ? (
                    <span className="flex h-2 w-2 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeEffect === 'snowflakes' ? 'bg-sky-400' : 'bg-rose-400'}`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${activeEffect === 'snowflakes' ? 'bg-sky-500' : 'bg-rose-500'}`} />
                    </span>
                  ) : (
                    <CheckCircle size={14} className="text-emerald-500 stroke-[2]" />
                  )}
                </div>
                <div className="text-[11px] font-mono leading-tight text-slate-600">
                  {timeLeft > 0 ? (
                    <span>
                      Active emitting process. Dispensing <strong>{quantity}</strong> particles of type <span className="uppercase text-slate-900 font-bold">[{activeEffect}]</span> across the projection frame. Next update cycles synchronized.
                    </span>
                  ) : (
                    <span>
                      Ready to accept request signals. Synthesizer oscillators initialized. Click <span className="text-indigo-600 font-bold">Snowflakes</span> or <span className="text-indigo-600 font-bold">Balloons</span> to begin rendering.
                    </span>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Workbench Developer Shell Event Console Logs (Displays real system actions) */}
          <div className="bg-slate-950 text-slate-300 rounded-xl border border-slate-800/90 shadow-lg overflow-hidden flex flex-col font-mono text-xs relative h-[180px]">
            <div className="bg-slate-900 px-4 py-2 flex items-center justify-between border-b border-slate-800 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-200">
                <Terminal size={12} className="text-teal-400" />
                <span>ENVIRONMENT DESPATCH TELEMETRY TRACE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span>ONLINE TRACE ACTIVE</span>
              </div>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-2 text-[11px] font-mono leading-normal select-text scrollbar-thin scrollbar-thumb-slate-800">
              {logEntries.map((log) => (
                <div key={log.id} className="flex items-start gap-4 hover:bg-slate-900/50 py-0.5 rounded transition-colors px-1">
                  <span className="text-slate-500 select-none font-bold">[{log.timestamp}]</span>
                  
                  {/* Styled indicator tags */}
                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold select-none inline-block leading-none ${
                    log.category === 'snowflakes' 
                      ? 'bg-sky-950 text-sky-400 border border-sky-800/60' 
                      : log.category === 'balloons' 
                        ? 'bg-rose-950 text-rose-400 border border-rose-800/60' 
                        : log.category === 'config'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                          : 'bg-slate-800 text-slate-400 border border-slate-700/60'
                  }`}>
                    {log.category}
                  </span>
                  
                  <span className="text-slate-200 flex-1">{log.message}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/40 px-4 py-1.5 border-t border-slate-900 text-[9px] text-slate-500 text-right">
              Console traces generated continuously // Buffer rate is 100% stable
            </div>
          </div>

        </section>

      </main>

      {/* Corporate Styled Global Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 shadow-[-1px_-1px_2px_rgba(0,0,0,0.01)] mt-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-1">
            <span>Atmosphere Workbench Systems © 2026. Designed with extreme architectural precision.</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10.5px]">
            <span>ENGINE: GE-REACT-19</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>ENCODING: UTF-8</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>SECURE SANDBOX: ON</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
