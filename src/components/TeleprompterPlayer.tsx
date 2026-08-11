import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Play, Pause, RotateCcw, Type, ChevronUp, ChevronDown, 
  FlipHorizontal, Info, Eye, Settings, Keyboard, Bluetooth, BluetoothOff,
  ArrowLeft, ArrowRight, Maximize, Minimize
} from 'lucide-react';
import { Block, GCEntry } from '../types';

interface TeleprompterPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  programTitle: string;
  blocos: Block[];
  onActiveLaudaChange?: (laudaId: string | null) => void;
}

const DEFAULT_SHORTCUTS = {
  playPause: 'Space',
  speedUp: 'ArrowUp',
  speedDown: 'ArrowDown',
  scrollUp: 'PageUp',
  scrollDown: 'PageDown',
  reset: 'KeyR',
  prevLauda: 'ArrowLeft',
  nextLauda: 'ArrowRight'
};

function getFriendlyKeyName(code: string): string {
  if (!code) return 'Nenhum';
  if (code === 'Space' || code === ' ') return 'Espaço';
  if (code === 'ArrowUp') return 'Seta Cima';
  if (code === 'ArrowDown') return 'Seta Baixo';
  if (code === 'ArrowLeft') return 'Seta Esquerda';
  if (code === 'ArrowRight') return 'Seta Direita';
  if (code === 'PageUp') return 'Page Up';
  if (code === 'PageDown') return 'Page Down';
  if (code === 'Enter') return 'Enter / OK';
  if (code === 'Escape') return 'Esc';
  if (code === 'VolumeUp') return 'Volume + (Botão Obturador)';
  if (code === 'VolumeDown') return 'Volume -';
  if (code === 'MediaPlayPause') return 'Media Play/Pause';
  if (code === 'MediaNextTrack') return 'Avançar Faixa';
  if (code === 'MediaPrevTrack') return 'Voltar Faixa';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export default function TeleprompterPlayer({
  isOpen,
  onClose,
  programTitle,
  blocos,
  onActiveLaudaChange,
}: TeleprompterPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(4); // 1 to 15
  const [fontSize, setFontSize] = useState(48); // pixels
  const [isMirrored, setIsMirrored] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [bindingAction, setBindingAction] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);

  // Sync fullscreen change with document status
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
    }
  };

  // Bluetooth control states
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'bluetooth'>('shortcuts');
  const [btStatus, setBtStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);
  const [btError, setBtError] = useState<string | null>(null);
  const [btDevice, setBtDevice] = useState<any>(null);
  const [lastReceivedSignal, setLastReceivedSignal] = useState<{key: string, action: string, time: string} | null>(null);
  const [selectedSimDevice, setSelectedSimDevice] = useState('tvi-clicker');

  const simulatedDevices = [
    { id: 'tvi-clicker', name: 'Controle Bluetooth TVI-Clicker v1', battery: '94%', type: 'Teleprompter Remote' },
    { id: 'presenter-pro', name: 'Presenter Pro BT (Slides)', battery: '85%', type: 'Multimedia Clicker' },
    { id: 'ring-shutter', name: 'Ring Shutter Controller', battery: '100%', type: 'Wearable Remote' }
  ];

  const [shortcuts, setShortcuts] = useState(() => {
    const saved = localStorage.getItem('tvi_teleprompter_shortcuts_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_SHORTCUTS;
      }
    }
    return DEFAULT_SHORTCUTS;
  });

  const [textCase, setTextCase] = useState<'uppercase' | 'lowercase' | 'original'>(() => {
    const saved = localStorage.getItem('tvi_teleprompter_textcase_v1');
    return (saved as 'uppercase' | 'lowercase' | 'original') || 'uppercase';
  });

  const [fontFamily, setFontFamily] = useState<'sans' | 'mono'>(() => {
    const saved = localStorage.getItem('tvi_teleprompter_fontfamily_v1');
    return (saved as 'sans' | 'mono') || 'mono';
  });

  useEffect(() => {
    localStorage.setItem('tvi_teleprompter_textcase_v1', textCase);
  }, [textCase]);

  useEffect(() => {
    localStorage.setItem('tvi_teleprompter_fontfamily_v1', fontFamily);
  }, [fontFamily]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);
  const scrollAccumulatorRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastCheckTimeRef = useRef<number>(0);

  // Flatten normal and commercial blocks with content
  const scriptsToRead = blocos
    .map(b => {
      const isComercial = b.tipo === 'comercial';
      if (isComercial) {
        // Find stories inside commercial blocks (e.g. ad clips)
        const stories = b.laudas.map(l => ({
          id: l.id,
          materia: l.materia || 'Comercial / Atração',
          tipo: l.tipo || 'COMERCIAL',
          apresentador: l.apresentador || '',
          laudaContent: l.laudaContent || '',
          gc: l.gc || '',
          gcs: l.gcs || []
        }));
        return {
          titulo: b.titulo,
          isComercial: true,
          stories
        };
      }

      // Find stories with text or GC
      const stories = b.laudas
        .filter(l => l.materia.trim() !== '' || l.laudaContent.trim() !== '' || (l.gc && l.gc.trim() !== '') || (l.gcs && l.gcs.length > 0))
        .map(l => ({
          id: l.id,
          materia: l.materia || '',
          tipo: l.tipo || '',
          apresentador: l.apresentador || '',
          laudaContent: l.laudaContent || '',
          gc: l.gc || '',
          gcs: l.gcs || []
        }));
      return {
        titulo: b.titulo,
        isComercial: false,
        stories
      };
    })
    .filter(b => b.isComercial || b.stories.length > 0);

  // Extract all story/lauda IDs in order of reading
  const allStoryIds = useMemo(() => {
    const ids: string[] = [];
    for (const b of scriptsToRead) {
      for (const s of b.stories) {
        ids.push(s.id);
      }
    }
    return ids;
  }, [scriptsToRead]);

  // Smooth scroll to a specific lauda section in the prompter
  const scrollToLauda = (laudaId: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-lauda-id="${laudaId}"]`) as HTMLElement;
    if (el) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetScrollTop = container.scrollTop + (elRect.top - containerRect.top) - (containerRect.height * 0.15);
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    }
  };

  const handlePrevLauda = () => {
    const currentId = lastSentLaudaIdRef.current;
    if (!currentId) {
      const firstId = allStoryIds[0];
      if (firstId) scrollToLauda(firstId);
      return;
    }
    const idx = allStoryIds.indexOf(currentId);
    if (idx > 0) {
      scrollToLauda(allStoryIds[idx - 1]);
    } else {
      handleReset();
    }
  };

  const handleNextLauda = () => {
    const currentId = lastSentLaudaIdRef.current;
    if (!currentId) {
      const firstId = allStoryIds[0];
      if (firstId) scrollToLauda(firstId);
      return;
    }
    const idx = allStoryIds.indexOf(currentId);
    if (idx !== -1 && idx < allStoryIds.length - 1) {
      scrollToLauda(allStoryIds[idx + 1]);
    }
  };

  // Auto-scroll loop with delta time normalization and exponential curve
  useEffect(() => {
    if (isPlaying) {
      if (scrollContainerRef.current) {
        scrollAccumulatorRef.current = scrollContainerRef.current.scrollTop;
      }
      lastFrameTimeRef.current = performance.now();

      const scrollStep = (timestamp: number) => {
        if (scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          const dt = Math.min(Math.max((timestamp - lastFrameTimeRef.current) / 16.6667, 0.2), 3.0);
          lastFrameTimeRef.current = timestamp;

          // Velocidade exponencial em pixels por frame a 60Hz:
          // vel 1 -> ~0.5 px/frame (~30 px/s - leitura cadenciada)
          // vel 5 -> ~4.3 px/frame (~260 px/s - velocidade normal)
          // vel 10 -> ~11.3 px/frame (~680 px/s - 2.8x mais rápido que antes)
          // vel 15 -> ~19.8 px/frame (~1200 px/s - ultra-rápido para telas grandes/4K)
          const stepSize = Math.pow(speed, 1.4) * 0.45 * dt;

          // Detecta se o usuário rolou manualmente (mouse/wheel/toque) e resincroniza o acumulador
          if (Math.abs(container.scrollTop - Math.round(scrollAccumulatorRef.current)) > 10) {
            scrollAccumulatorRef.current = container.scrollTop;
          }

          scrollAccumulatorRef.current += stepSize;
          container.scrollTop = Math.round(scrollAccumulatorRef.current);

          // If reached bottom, pause
          if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
            setIsPlaying(false);
          }
        }
        scrollIntervalRef.current = requestAnimationFrame(scrollStep);
      };

      scrollIntervalRef.current = requestAnimationFrame(scrollStep);
    } else {
      if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current);
      }
    }

    return () => {
      if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current);
      }
    };
  }, [isPlaying, speed]);

  // Ref to track the last reported active lauda ID to prevent redundant Firestore calls
  const lastSentLaudaIdRef = useRef<string | null>(null);

  // Monitor the scroll position to find which lauda is currently passing by the reading line (40% viewport Y)
  // Throttled to prevent DOM Layout Thrashing ("garra/engasgo") during scrolling
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isOpen) return;

    const checkActiveLauda = () => {
      const now = performance.now();
      // Executa checagem de bounding rect apenas a cada 350ms para nunca causar travamento / layout thrashing
      if (now - lastCheckTimeRef.current < 350) return;
      lastCheckTimeRef.current = now;

      const containerRect = container.getBoundingClientRect();
      // The reading line is at 40% of the container height
      const readingLineY = containerRect.top + containerRect.height * 0.4;
      const elements = container.querySelectorAll('.tp-lauda-section');
      
      let currentActiveId: string | null = null;
      for (const node of Array.from(elements)) {
        const el = node as HTMLElement;
        const rect = el.getBoundingClientRect();
        if (rect.top <= readingLineY && rect.bottom >= readingLineY) {
          currentActiveId = el.getAttribute('data-lauda-id');
          break;
        }
      }

      if (currentActiveId !== lastSentLaudaIdRef.current) {
        lastSentLaudaIdRef.current = currentActiveId;
        onActiveLaudaChange?.(currentActiveId);
      }
    };

    // Attach scroll event listener com { passive: true } para otimizar thread do navegador
    container.addEventListener('scroll', checkActiveLauda, { passive: true });
    
    // Check initially and on window resize
    const interval = setInterval(checkActiveLauda, 800); // Fail-safe fallback check every 800ms
    
    window.addEventListener('resize', checkActiveLauda);
    checkActiveLauda();

    return () => {
      container.removeEventListener('scroll', checkActiveLauda);
      window.removeEventListener('resize', checkActiveLauda);
      clearInterval(interval);
    };
  }, [isOpen, scriptsToRead, onActiveLaudaChange]);

  // Clean up active lauda on close/unmount
  useEffect(() => {
    if (!isOpen) {
      if (lastSentLaudaIdRef.current !== null) {
        lastSentLaudaIdRef.current = null;
        onActiveLaudaChange?.(null);
      }
    }
  }, [isOpen, onActiveLaudaChange]);

  // Listen to keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      const matchesShortcut = (shortcutValue: string) => {
        if (!shortcutValue) return false;
        return e.code === shortcutValue || e.key === shortcutValue;
      };

      // Monitor signals for the monitor UI panel
      let matchedAction = 'Nenhuma';
      if (matchesShortcut(shortcuts.playPause)) matchedAction = 'Play / Pause';
      else if (matchesShortcut(shortcuts.speedUp)) matchedAction = 'Aumentar Velocidade';
      else if (matchesShortcut(shortcuts.speedDown)) matchedAction = 'Diminuir Velocidade';
      else if (matchesShortcut(shortcuts.scrollUp)) matchedAction = 'Rolar para Cima';
      else if (matchesShortcut(shortcuts.scrollDown)) matchedAction = 'Rolar para Baixo';
      else if (matchesShortcut(shortcuts.reset)) matchedAction = 'Reiniciar';
      else if (matchesShortcut(shortcuts.prevLauda)) matchedAction = 'Lauda Anterior';
      else if (matchesShortcut(shortcuts.nextLauda)) matchedAction = 'Próxima Lauda';
      else if (e.code === 'Escape' || e.key === 'Escape') matchedAction = 'Fechar Prompter';
      else if (e.code === 'PageDown' || e.key === 'PageDown') matchedAction = 'Avançar (Físico)';
      else if (e.code === 'PageUp' || e.key === 'PageUp') matchedAction = 'Voltar (Físico)';
      else if (e.code === 'Enter' || e.key === 'Enter') matchedAction = 'Play/Pause (Físico)';

      setLastReceivedSignal({
        key: e.code || e.key || 'Botão Desconhecido',
        action: matchedAction,
        time: new Date().toLocaleTimeString()
      });

      if (bindingAction) {
        e.preventDefault();
        e.stopPropagation();
        const actionToBind = bindingAction;
        const keyToStore = e.code || e.key;
        setShortcuts((prev: any) => {
          const updated = { ...prev, [actionToBind]: keyToStore };
          localStorage.setItem('tvi_teleprompter_shortcuts_v2', JSON.stringify(updated));
          return updated;
        });
        setBindingAction(null);
        return;
      }

      // Action Handlers according to configured shortcuts
      if (matchesShortcut(shortcuts.playPause)) {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (matchesShortcut(shortcuts.speedUp)) {
        e.preventDefault();
        setSpeed(prev => Math.min(prev + 1, 15));
      } else if (matchesShortcut(shortcuts.speedDown)) {
        e.preventDefault();
        setSpeed(prev => Math.max(prev - 1, 1));
      } else if (matchesShortcut(shortcuts.scrollUp)) {
        e.preventDefault();
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop -= 120;
        }
      } else if (matchesShortcut(shortcuts.scrollDown)) {
        e.preventDefault();
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += 120;
        }
      } else if (matchesShortcut(shortcuts.reset)) {
        e.preventDefault();
        handleReset();
      } else if (matchesShortcut(shortcuts.prevLauda)) {
        e.preventDefault();
        handlePrevLauda();
      } else if (matchesShortcut(shortcuts.nextLauda)) {
        e.preventDefault();
        handleNextLauda();
      } else if (e.code === 'Escape') {
        onClose();
      } else {
        // Native Bluetooth Presenter Fallbacks
        if (e.code === 'PageDown' || e.key === 'PageDown') {
          e.preventDefault();
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop += 150;
          }
        } else if (e.code === 'PageUp' || e.key === 'PageUp') {
          e.preventDefault();
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop -= 150;
          }
        } else if (e.code === 'Enter' || e.key === 'Enter') {
          e.preventDefault();
          setIsPlaying(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, shortcuts, bindingAction, allStoryIds]);

  if (!isOpen) return null;

  const handleReset = () => {
    setIsPlaying(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const handleFontSizeChange = (amount: number) => {
    setFontSize(prev => Math.max(24, Math.min(prev + amount, 80)));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#050510] text-[#f4f4f7] no-print select-none teleprompter-dark">
      
      {/* Top Banner Control Panel */}
      {isControlsVisible && (
        <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 bg-[#0a0a14] border-b border-zinc-800/80 gap-4 transition-all duration-300">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center justify-center p-2 bg-red-600 rounded-lg animate-pulse shrink-0">
              <span className="text-[10px] font-bold text-white tracking-widest uppercase">PROMPTER LIVE</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-wide font-display text-zinc-100 truncate">
                {programTitle || "Programa sem Título"}
              </h2>
              <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                Atalhos de teclado ativos. Compatível com passadores e controles Bluetooth.
              </p>
            </div>
          </div>

          {/* Live Controller Dashboard */}
          <div className="flex flex-wrap items-center gap-4 justify-end w-full md:w-auto">
            {/* Bluetooth Quick Status Icon */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg text-xs" title="Status de conexão de controle Bluetooth">
              <Bluetooth className={`w-3.5 h-3.5 ${btStatus === 'connected' ? 'text-emerald-500 animate-pulse' : 'text-zinc-500'}`} />
              <span className={`text-[10px] font-semibold ${btStatus === 'connected' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {btStatus === 'connected' ? 'Controle Pareado' : 'Sem Bluetooth'}
              </span>
            </div>

            {/* Font Controls */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 p-1.5 rounded-lg text-xs">
              <Type className="w-4 h-4 text-zinc-500 ml-1.5" />
              <button 
                onClick={() => handleFontSizeChange(-4)}
                className="px-2 py-1 hover:bg-zinc-800 rounded text-zinc-300 font-bold cursor-pointer"
                title="Diminuir Letra"
              >
                A-
              </button>
              <span className="text-zinc-500 font-mono w-6 text-center">{fontSize}</span>
              <button 
                onClick={() => handleFontSizeChange(4)}
                className="px-2 py-1 hover:bg-zinc-800 rounded text-zinc-300 font-bold cursor-pointer"
                title="Aumentar Letra"
              >
                A+
              </button>
            </div>

            {/* Case Format Selector */}
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg text-xs" title="Formato da Caixa do Texto">
              <button
                type="button"
                onClick={() => setTextCase('uppercase')}
                className={`px-2 py-1 rounded text-[10px] font-bold font-mono tracking-wider transition-all cursor-pointer uppercase ${
                  textCase === 'uppercase'
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-400 hover:text-zinc-250 hover:bg-zinc-850'
                }`}
                title="Forçar tudo em LETRAS MAIÚSCULAS"
              >
                A/A
              </button>
              <button
                type="button"
                onClick={() => setTextCase('lowercase')}
                className={`px-2 py-1 rounded text-[10px] font-bold font-mono tracking-wider transition-all cursor-pointer lowercase ${
                  textCase === 'lowercase'
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-400 hover:text-zinc-250 hover:bg-zinc-850'
                }`}
                title="Forçar tudo em letras minúsculas"
              >
                a/a
              </button>
              <button
                type="button"
                onClick={() => setTextCase('original')}
                className={`px-2 py-1 rounded text-[10px] font-bold font-mono tracking-wider transition-all cursor-pointer ${
                  textCase === 'original'
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-400 hover:text-zinc-250 hover:bg-zinc-850'
                }`}
                title="Manter a escrita Original"
              >
                A/a
              </button>
            </div>

            {/* Font Family Selector */}
            <button
              type="button"
              onClick={() => setFontFamily(f => f === 'mono' ? 'sans' : 'mono')}
              className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-805 px-3 py-1.5 rounded-lg text-xs hover:bg-zinc-850 text-zinc-300 cursor-pointer transition-colors"
              title="Alternar estilo da fonte (Courier Mono vs Inter Sans)"
            >
              <span className="font-mono text-[10px] font-bold">ESTILO: {fontFamily === 'mono' ? 'COURIER' : 'INTER'}</span>
            </button>

            {/* Speed Indicator */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs">
              <span className="text-zinc-500">Velocidade:</span>
              <span className="font-mono text-amber-500 font-bold text-sm w-4 tracking-tight">{speed}</span>
              <div className="flex flex-col">
                <button 
                  onClick={() => setSpeed(s => Math.min(s + 1, 15))}
                  className="hover:text-white cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setSpeed(s => Math.max(s - 1, 1))}
                  className="hover:text-white cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Mirror Flip Control */}
            <button
              onClick={() => setIsMirrored(m => !m)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                isMirrored 
                  ? 'bg-amber-500 text-zinc-950 border-amber-400' 
                  : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
              }`}
              title="Espelhar Horizontalmente (Para espelhos físicos de estúdio)"
            >
              <FlipHorizontal className="w-4 h-4" />
              <span>Espelhar</span>
            </button>

            {/* Core Teleprompter Controls */}
            <div className="flex items-center gap-2 border-l border-zinc-850 pl-4">
              <button
                onClick={handleReset}
                className="p-2 hover:bg-zinc-850 rounded-lg text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Voltar ao início"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              
              <button
                onClick={handlePrevLauda}
                className="p-2 hover:bg-zinc-850 rounded-lg text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Lauda Anterior"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-2.5 rounded-full transition-all active:scale-95 cursor-pointer ${
                  isPlaying 
                    ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400' 
                    : 'bg-white text-zinc-950 hover:bg-zinc-200'
                }`}
                title={isPlaying ? "Pausar" : "Iniciar Leitura"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <button
                onClick={handleNextLauda}
                className="p-2 hover:bg-zinc-850 rounded-lg text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Próxima Lauda"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider font-mono"
              title={isFullscreen ? "Sair de Tela Cheia" : "Tela Cheia"}
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-4 h-4 text-amber-500" />
                  <span className="hidden sm:inline">SAIR TELA CHEIA</span>
                </>
              ) : (
                <>
                  <Maximize className="w-4 h-4 text-amber-500" />
                  <span className="hidden sm:inline">TELA CHEIA</span>
                </>
              )}
            </button>

            {/* Hide Panel Button */}
            <button
              onClick={() => setIsControlsVisible(false)}
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider font-mono"
              title="Ocultar Painel de Controles (Ideal para leitura)"
            >
              <ChevronUp className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">OCULTAR</span>
            </button>

            {/* Settings Button */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Atalhos e Pareamento Bluetooth"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>

            {/* Close trigger */}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Header when Controls are Hidden */}
      {!isControlsVisible && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          {/* Expanded Menu Toggle Button */}
          <button
            onClick={() => setIsControlsVisible(true)}
            className="px-4 py-2.5 bg-zinc-950/95 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-500 rounded-full text-[10px] font-bold tracking-widest uppercase font-mono shadow-xl transition-all duration-200 flex items-center gap-2 group cursor-pointer"
            title="Mostrar Painel de Configurações"
          >
            <ChevronDown className="w-4 h-4 text-amber-500 group-hover:translate-y-0.5 transition-transform" />
            <span>EXIBIR CONTROLES</span>
          </button>

          {/* Direct Close Button */}
          <button
            onClick={onClose}
            className="p-2 bg-red-950/90 hover:bg-red-900 border border-red-900/40 rounded-full text-red-400 hover:text-white shadow-xl transition-colors cursor-pointer"
            title="Fechar Teleprompter"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Primary Scroll Engine and Overlay */}
      <div className="relative flex-1 bg-[#020205] overflow-hidden flex justify-center">
        
        {/* Eye Alignment Guiders (Horizontal bar in center of screen) */}
        <div className="absolute top-[40%] left-0 right-0 h-20 border-y-2 border-amber-500/25 bg-amber-500/[0.03] pointer-events-none flex items-center justify-between px-8 z-10">
          <div className="w-4 h-4 border-l-4 border-t-4 border-amber-500 rounded-tl-sm" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500/70 select-none hidden md:inline">
            LINHA DE LEITURA DO APRESENTADOR
          </span>
          <div className="w-4 h-4 border-r-4 border-t-4 border-amber-500 rounded-tr-sm" />
        </div>

        {/* Professional Left and Right Side Indicators */}
        <div className="absolute top-[40%] left-2 pointer-events-none z-10 hidden md:flex items-center h-20">
          <div className="w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-l-[18px] border-l-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
        </div>
        <div className="absolute top-[40%] right-2 pointer-events-none z-10 hidden md:flex items-center h-20">
          <div className="w-0 h-0 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent border-r-[18px] border-r-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
        </div>

        {/* Scrollable teleprompter text container */}
        <div 
          ref={scrollContainerRef}
          className="w-full max-w-6xl mx-auto px-6 md:px-16 py-[40vh] overflow-y-auto h-full scrollbar-none tp-scroll-container text-left break-words overflow-x-hidden"
          style={{ 
            transform: isMirrored ? 'scaleX(-1)' : 'none',
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily === 'mono' ? "'Courier New', Courier, monospace" : "var(--font-sans), Inter, sans-serif",
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            willChange: 'scroll-position',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'auto'
          }}
        >
          {scriptsToRead.length === 0 ? (
            <div className="text-center text-zinc-600 font-sans py-12 flex flex-col items-center justify-center h-[30vh]">
              <Info className="w-10 h-10 mb-3 text-zinc-600" />
              <p className="text-lg font-semibold uppercase tracking-wider">Tempero de Scripts Vazio</p>
              <p className="text-sm text-zinc-500 mt-2 max-w-md">
                Adicione blocos normais e digite algum texto nas laudas (📄) para projetar as notícias no teleprompter.
              </p>
            </div>
          ) : (
            scriptsToRead.map((bloco, bIdx) => (
              <div key={bIdx} className="mb-16 border-b border-zinc-800/20 pb-12">
                {bloco.isComercial ? (
                  <div className="text-center py-10 px-6 border-2 border-dashed border-red-500/50 bg-red-950/15 rounded-2xl my-8 select-none">
                    <div className="text-red-500 text-3xl font-sans font-black tracking-widest uppercase mb-3 animate-pulse">
                      🚨 {bloco.titulo || "INTERVALO COMERCIAL"} 🚨
                    </div>
                    <p className="text-zinc-400 text-lg font-sans max-w-lg mx-auto">
                      Intervalo Comercial / Break Ativo. Retorno das notícias em breve.
                    </p>
                    {bloco.stories.length > 0 && (
                      <div className="mt-8 text-left max-w-md mx-auto bg-[#0a0a14] border border-zinc-850 p-4 rounded-xl space-y-2.5">
                        <span className="text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-wider">Itens do Intervalo:</span>
                        {bloco.stories.map((story, sIdx) => (
                          <div key={story.id} className="text-sm font-sans text-zinc-300 flex items-center justify-between border-b border-zinc-900 pb-1.5 last:border-0 last:pb-0 tp-lauda-section" data-lauda-id={story.id}>
                            <span className="font-semibold text-zinc-200">#{sIdx + 1} {story.materia}</span>
                            {story.laudaContent && <span className="text-zinc-500 text-xs italic ml-2">com roteiro</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="text-zinc-600 text-base font-sans font-bold tracking-widest uppercase mb-6 select-none flex items-center gap-2 border-b border-zinc-900 pb-2">
                      <Eye className="w-4 h-4" /> {bloco.titulo}
                    </div>

                    {bloco.stories.map((story, sIdx) => (
                      <div key={story.id} className="mb-12 tp-lauda-section" data-lauda-id={story.id}>
                        {/* Story Title Slug styled nicely but clear */}
                        <div className="text-[#ffff00] text-xl font-sans font-bold tracking-wide uppercase select-none mb-3">
                          # [{story.tipo}] {story.materia || "RETRANCA SEM TITULO"} 
                          {story.apresentador ? <span className="text-zinc-500 text-sm font-normal ml-3">({story.apresentador})</span> : null}
                        </div>

                        {/* GC / Character Generator lower-third indicator */}
                        {false && ((story.gcs && story.gcs.length > 0) || story.gc) && (
                          <div className="mb-5 flex flex-wrap gap-2.5 select-none">
                            {(story.gcs && story.gcs.length > 0 
                              ? story.gcs 
                              : (story.gc ? [{ id: 'legacy', titulo: story.gc, subtitulo: '' }] : [])
                            ).map((gcItem, gIdx) => {
                              if (!gcItem.titulo) return null;
                              return (
                                <div key={gcItem.id || gIdx} className="inline-flex flex-col px-3 py-1.5 bg-rose-950/20 border border-rose-900/30 text-rose-300 rounded-lg text-xs font-mono font-bold tracking-wider uppercase">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                                    <span className="text-[9px] text-rose-400/80">GC #{gIdx + 1}</span>
                                  </div>
                                  <span className="text-zinc-100 text-xs font-sans font-bold">{gcItem.titulo}</span>
                                  {gcItem.subtitulo && (
                                    <span className="text-rose-400 text-[10px] font-sans font-medium mt-0.5">{gcItem.subtitulo}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Story Body Script Text */}
                        <p 
                          className="text-zinc-100 leading-[1.8] font-bold tracking-wide whitespace-pre-wrap"
                          style={{
                            textTransform: textCase === 'uppercase' ? 'uppercase' : textCase === 'lowercase' ? 'lowercase' : 'none'
                          }}
                        >
                          {story.laudaContent || "--- LAUDA SEM TEXTO ---"}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Settings Modal Overlay with Keyboard and Bluetooth Tabs */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-[#0c0c14] border border-zinc-800 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl relative text-left flex flex-col scrollbar-thin">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-indigo-600" />
            
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-500" />
                <h3 className="text-zinc-100 font-display font-semibold text-sm uppercase tracking-wider">
                  Configurações do Teleprompter
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsSettingsOpen(false);
                  setBindingAction(null);
                }}
                className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-zinc-800/80 mb-5">
              <button
                onClick={() => setActiveTab('shortcuts')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === 'shortcuts'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Keyboard className="w-4 h-4" />
                Atalhos / Teclado
              </button>
              <button
                onClick={() => setActiveTab('bluetooth')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === 'bluetooth'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Bluetooth className="w-4 h-4" />
                Controle Bluetooth
              </button>
            </div>

            {activeTab === 'shortcuts' ? (
              <div className="space-y-4">
                <div className="bg-zinc-950/60 p-4 border border-zinc-900 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Dica de Conexão</span>
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    Para utilizar um <strong>passador Bluetooth</strong>, conecte-o ao seu dispositivo. Suas teclas serão mapeadas para as ações abaixo automaticamente! Você também pode redefinir os atalhos.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                    Mapeamento de Teclas
                  </h4>
                  
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {([
                      { key: 'playPause', label: 'Play / Pause' },
                      { key: 'speedUp', label: 'Aumentar Velocidade' },
                      { key: 'speedDown', label: 'Diminuir Velocidade' },
                      { key: 'scrollUp', label: 'Rolar para Cima (Subir)' },
                      { key: 'scrollDown', label: 'Rolar para Baixo (Descer)' },
                      { key: 'reset', label: 'Reiniciar (Voltar ao Início)' },
                      { key: 'prevLauda', label: 'Lauda Anterior' },
                      { key: 'nextLauda', label: 'Próxima Lauda' },
                    ] as const).map((item) => {
                      const isBinding = bindingAction === item.key;
                      return (
                        <div key={item.key} className="flex items-center justify-between p-2 bg-[#141420] border border-zinc-900 rounded-xl">
                          <span className="text-xs font-semibold text-zinc-300">{item.label}</span>
                          <button
                            onClick={() => setBindingAction(item.key)}
                            className={`px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded-lg border transition-all cursor-pointer ${
                              isBinding 
                                ? 'bg-amber-500 text-zinc-950 border-amber-400 animate-pulse' 
                                : 'bg-zinc-900 text-zinc-350 border-zinc-800 hover:bg-zinc-850'
                            }`}
                          >
                            {isBinding ? 'Pressione a tecla...' : getFriendlyKeyName(shortcuts[item.key])}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Bluetooth Device Instructions */}
                <div className="bg-[#101020]/70 border border-indigo-950/40 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Bluetooth className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Como Sincronizar seu Controle</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 leading-relaxed space-y-1.5">
                    <p>
                      1. Vá nas configurações do seu celular, tablet ou PC e <strong>pareie o controle via Bluetooth</strong>.
                    </p>
                    <p>
                      2. Controles como anéis de rolagem, cliques de foto e passadores funcionam enviando teclas ou atalhos de mídia.
                    </p>
                    <p>
                      3. Clique em <strong>"Vincular"</strong> na ação desejada abaixo e, em seguida, <strong>pressione o botão físico do controle</strong> para gravar!
                    </p>
                  </div>
                </div>

                {/* Bluetooth Button Mapping section */}
                <div className="border border-zinc-800/80 rounded-xl p-3 bg-[#0e0e1a]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                      Vincular Botões do Controle
                    </h4>
                    <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold">CONFIGURAR</span>
                  </div>
                  
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                    {([
                      { key: 'playPause', label: 'Play / Pause' },
                      { key: 'speedUp', label: 'Aumentar Velocidade' },
                      { key: 'speedDown', label: 'Diminuir Velocidade' },
                      { key: 'scrollUp', label: 'Rolar para Cima' },
                      { key: 'scrollDown', label: 'Rolar para Baixo' },
                      { key: 'reset', label: 'Reiniciar' },
                      { key: 'prevLauda', label: 'Lauda Anterior' },
                      { key: 'nextLauda', label: 'Próxima Lauda' },
                    ] as const).map((item) => {
                      const isBinding = bindingAction === item.key;
                      return (
                        <div key={item.key} className="flex items-center justify-between p-1.5 bg-[#141424] border border-zinc-900 rounded-lg">
                          <span className="text-[11px] font-medium text-zinc-300">{item.label}</span>
                          <button
                            type="button"
                            onClick={() => setBindingAction(item.key)}
                            className={`px-2.5 py-1 text-[9px] font-bold font-mono uppercase tracking-wider rounded border transition-all cursor-pointer ${
                              isBinding 
                                ? 'bg-amber-500 text-zinc-950 border-amber-400 animate-pulse font-extrabold' 
                                : 'bg-zinc-900 text-zinc-350 border-zinc-850 hover:bg-zinc-800'
                            }`}
                          >
                            {isBinding ? 'Aperte o botão...' : getFriendlyKeyName(shortcuts[item.key])}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Signal Monitor */}
                <div className="bg-[#08080f] border border-zinc-900 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                      Monitor de Sinais Recebidos (Live)
                    </span>
                    {lastReceivedSignal && (
                      <span className="text-[8px] text-zinc-500 font-mono">
                        {lastReceivedSignal.time}
                      </span>
                    )}
                  </div>

                  {lastReceivedSignal ? (
                    <div className="flex items-center justify-between bg-zinc-950 p-2 rounded-lg border border-zinc-900">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded text-[10px] font-mono font-bold">
                          {lastReceivedSignal.key}
                        </span>
                        <span className="text-zinc-600 text-xs">→</span>
                        <span className="text-emerald-400 font-semibold text-[11px] font-sans">
                          {lastReceivedSignal.action}
                        </span>
                      </div>
                      <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider animate-pulse flex items-center gap-1">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full" /> Ativo
                      </span>
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-[11px] italic text-center py-1.5">
                      Pressione teclas ou botões no seu controle pareado para ver os sinais...
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-zinc-900 flex justify-between gap-3">
              <button
                onClick={() => {
                  if (activeTab === 'shortcuts') {
                    setShortcuts(DEFAULT_SHORTCUTS);
                    localStorage.setItem('tvi_teleprompter_shortcuts_v2', JSON.stringify(DEFAULT_SHORTCUTS));
                    setBindingAction(null);
                  } else {
                    setBtStatus('disconnected');
                    setBtDeviceName(null);
                    setBtDevice(null);
                    setBtError(null);
                    setLastReceivedSignal(null);
                  }
                }}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors border border-zinc-850 cursor-pointer"
              >
                Resetar Tab
              </button>
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  setBindingAction(null);
                }}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all hover:scale-102 cursor-pointer"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
