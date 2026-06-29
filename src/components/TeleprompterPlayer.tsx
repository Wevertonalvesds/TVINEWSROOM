import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Play, Pause, RotateCcw, Type, ChevronUp, ChevronDown, 
  FlipHorizontal, Info, Eye, Settings, Keyboard, Bluetooth, BluetoothOff
} from 'lucide-react';
import { Block } from '../types';

interface TeleprompterPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  programTitle: string;
  blocos: Block[];
}

const DEFAULT_SHORTCUTS = {
  playPause: 'Space',
  speedUp: 'ArrowUp',
  speedDown: 'ArrowDown',
  scrollUp: 'PageUp',
  scrollDown: 'PageDown',
  reset: 'KeyR'
};

function getFriendlyKeyName(code: string): string {
  if (!code) return 'Nenhum';
  if (code === 'Space') return 'Espaço';
  if (code === 'ArrowUp') return 'Seta Cima';
  if (code === 'ArrowDown') return 'Seta Baixo';
  if (code === 'ArrowLeft') return 'Seta Esquerda';
  if (code === 'ArrowRight') return 'Seta Direita';
  if (code === 'PageUp') return 'Page Up';
  if (code === 'PageDown') return 'Page Down';
  if (code === 'Enter') return 'Enter';
  if (code === 'Escape') return 'Esc';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export default function TeleprompterPlayer({
  isOpen,
  onClose,
  programTitle,
  blocos,
}: TeleprompterPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(3); // 1 to 10
  const [fontSize, setFontSize] = useState(48); // pixels
  const [isMirrored, setIsMirrored] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [bindingAction, setBindingAction] = useState<string | null>(null);

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

  useEffect(() => {
    localStorage.setItem('tvi_teleprompter_textcase_v1', textCase);
  }, [textCase]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  // Flatten normal blocks with content
  const scriptsToRead = blocos
    .filter(b => b.tipo === 'normal')
    .map(b => {
      // Find stories with text
      const stories = b.laudas.filter(l => l.materia.trim() !== '' || l.laudaContent.trim() !== '');
      return {
        titulo: b.titulo,
        stories
      };
    })
    .filter(b => b.stories.length > 0);

  // Auto-scroll loop
  useEffect(() => {
    if (isPlaying) {
      const scrollStep = () => {
        if (scrollContainerRef.current) {
          const container = scrollContainerRef.current;
          // Speed conversion: 1 is slow, 10 is fast
          const stepSize = speed * 0.4; 
          container.scrollTop += stepSize;

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

  // Listen to keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Monitor signals for the monitor UI panel
      let matchedAction = 'Nenhuma';
      if (e.code === shortcuts.playPause) matchedAction = 'Play / Pause';
      else if (e.code === shortcuts.speedUp) matchedAction = 'Aumentar Velocidade';
      else if (e.code === shortcuts.speedDown) matchedAction = 'Diminuir Velocidade';
      else if (e.code === shortcuts.scrollUp) matchedAction = 'Rolar para Cima';
      else if (e.code === shortcuts.scrollDown) matchedAction = 'Rolar para Baixo';
      else if (e.code === shortcuts.reset) matchedAction = 'Reiniciar';
      else if (e.code === 'Escape') matchedAction = 'Fechar Prompter';
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
        setShortcuts((prev: any) => {
          const updated = { ...prev, [actionToBind]: e.code };
          localStorage.setItem('tvi_teleprompter_shortcuts_v2', JSON.stringify(updated));
          return updated;
        });
        setBindingAction(null);
        return;
      }

      // Action Handlers according to configured shortcuts
      if (e.code === shortcuts.playPause) {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.code === shortcuts.speedUp) {
        e.preventDefault();
        setSpeed(prev => Math.min(prev + 1, 10));
      } else if (e.code === shortcuts.speedDown) {
        e.preventDefault();
        setSpeed(prev => Math.max(prev - 1, 1));
      } else if (e.code === shortcuts.scrollUp) {
        e.preventDefault();
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop -= 120;
        }
      } else if (e.code === shortcuts.scrollDown) {
        e.preventDefault();
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += 120;
        }
      } else if (e.code === shortcuts.reset) {
        e.preventDefault();
        handleReset();
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
  }, [isOpen, onClose, shortcuts, bindingAction]);

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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#050510] text-[#f4f4f7] no-print select-none">
      
      {/* Top Banner Control Panel */}
      <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 bg-[#0a0a14] border-b border-zinc-800/80 gap-4">
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

          {/* Speed Indicator */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs">
            <span className="text-zinc-500">Velocidade:</span>
            <span className="font-mono text-amber-500 font-bold text-sm w-4 tracking-tight">{speed}</span>
            <div className="flex flex-col">
              <button 
                onClick={() => setSpeed(s => Math.min(s + 1, 10))}
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
          </div>

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

      {/* Primary Scroll Engine and Overlay */}
      <div className="relative flex-1 bg-[#020205] overflow-hidden flex justify-center">
        
        {/* Eye Alignment Guiders (Horizontal bar in center of screen) */}
        <div className="absolute top-[40%] left-0 right-0 h-20 border-y-2 border-amber-500/25 bg-amber-500/[0.03] pointer-events-none flex items-center justify-between px-8">
          <div className="w-4 h-4 border-l-4 border-t-4 border-amber-500 rounded-tl-sm" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-amber-500/70 select-none hidden md:inline">
            LINHA DE LEITURA DO APRESENTADOR
          </span>
          <div className="w-4 h-4 border-r-4 border-t-4 border-amber-500 rounded-tr-sm" />
        </div>

        {/* Scrollable teleprompter text container */}
        <div 
          ref={scrollContainerRef}
          className="w-full max-w-6xl mx-auto px-6 md:px-16 py-[40vh] overflow-y-auto h-full scrollbar-none tp-scroll-container text-left break-words overflow-x-hidden"
          style={{ 
            transform: isMirrored ? 'scaleX(-1)' : 'none',
            fontSize: `${fontSize}px`,
            fontFamily: "'Courier New', Courier, monospace",
            wordBreak: 'break-word',
            overflowWrap: 'break-word'
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
                <div className="text-zinc-600 text-base font-sans font-bold tracking-widest uppercase mb-6 select-none flex items-center gap-2 border-b border-zinc-900 pb-2">
                  <Eye className="w-4 h-4" /> {bloco.titulo}
                </div>

                {bloco.stories.map((story, sIdx) => (
                  <div key={story.id} className="mb-12">
                    {/* Story Title Slug styled nicely but clear */}
                    <div className="text-[#ffff00] text-xl font-sans font-bold tracking-wide uppercase select-none mb-3">
                      # [{story.tipo}] {story.materia || "RETRANCA SEM TITULO"} 
                      {story.apresentador ? <span className="text-zinc-500 text-sm font-normal ml-3">({story.apresentador})</span> : null}
                    </div>

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
              </div>
            ))
          )}
        </div>
      </div>

      {/* Settings Modal Overlay with Keyboard and Bluetooth Tabs */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-[#0c0c14] border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden text-left flex flex-col">
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
                {/* Connection Status Card */}
                <div className="bg-zinc-950/60 p-4 border border-zinc-900 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full relative ${
                        btStatus === 'connected' 
                          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' 
                          : btStatus === 'connecting'
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-zinc-600'
                      }`} />
                      <div>
                        <p className="text-xs font-bold text-zinc-200">
                          {btStatus === 'connected' 
                            ? `Conectado: ${btDeviceName}` 
                            : btStatus === 'connecting'
                              ? 'Procurando dispositivos...'
                              : 'Dispositivo Desconectado'
                          }
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {btStatus === 'connected' 
                            ? 'Bateria do controle: 94% | Pronto para uso' 
                            : 'Pareie um dispositivo Bluetooth para sincronizar'
                          }
                        </p>
                      </div>
                    </div>
                    {btStatus === 'connected' ? (
                      <button
                        onClick={() => {
                          setBtStatus('disconnected');
                          setBtDeviceName(null);
                          setBtDevice(null);
                        }}
                        className="px-2.5 py-1 bg-red-950 text-red-400 border border-red-900/40 hover:bg-red-900 hover:text-white text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer"
                      >
                        Desconectar
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          setBtStatus('connecting');
                          setBtError(null);
                          try {
                            if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
                              const device = await (navigator as any).bluetooth.requestDevice({
                                acceptAllDevices: true
                              });
                              setBtDeviceName(device.name || 'Dispositivo Bluetooth');
                              setBtStatus('connected');
                              setBtDevice(device);
                            } else {
                              throw new Error('Web Bluetooth não suportado pelo navegador.');
                            }
                          } catch (err: any) {
                            console.warn("Bluetooth connection failed, using emulator setup instead:", err);
                            setBtStatus('disconnected');
                            setBtError(
                              err.name === 'SecurityError'
                                ? 'Permissão Bluetooth restrita no iframe. Use o Simulador Profissional abaixo para testar!'
                                : 'Pareamento Bluetooth indisponível neste navegador. Use o Simulador abaixo!'
                            );
                          }
                        }}
                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[10px] font-bold uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Bluetooth className="w-3.5 h-3.5" />
                        Parear BT
                      </button>
                    )}
                  </div>

                  {btError && (
                    <div className="mt-3 p-2 bg-amber-950/20 border border-amber-900/30 rounded-lg text-amber-400 text-[10px] leading-relaxed">
                      {btError}
                    </div>
                  )}
                </div>

                {/* Simulated Bluetooth Selector */}
                <div className="border border-zinc-800/80 rounded-xl p-3 bg-[#0e0e1a]/40 space-y-3">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                    Simulador e Seletor de Controles
                  </h4>

                  <div className="flex gap-2">
                    <select
                      value={selectedSimDevice}
                      onChange={(e) => setSelectedSimDevice(e.target.value)}
                      disabled={btStatus === 'connected'}
                      className="flex-1 bg-zinc-950 border border-zinc-850 text-xs text-zinc-350 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                      {simulatedDevices.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.battery})
                        </option>
                      ))}
                    </select>

                    {btStatus !== 'connected' && (
                      <button
                        onClick={() => {
                          const dev = simulatedDevices.find(d => d.id === selectedSimDevice);
                          if (dev) {
                            setBtStatus('connected');
                            setBtDeviceName(dev.name);
                            setBtError(null);
                          }
                        }}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                      >
                        Conectar
                      </button>
                    )}
                  </div>

                  {/* Simulated physical 3D remote clicker control widget */}
                  {btStatus === 'connected' && (
                    <div className="pt-2 border-t border-zinc-900 space-y-2">
                      <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-bold text-center">
                        Controle Remoto Pareado Ativo (Clique para testar)
                      </p>
                      
                      <div className="flex justify-center py-1">
                        <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 shadow-xl flex flex-col items-center gap-2.5 w-36">
                          {/* Speed up button */}
                          <button
                            onClick={() => {
                              setSpeed(s => Math.min(s + 1, 10));
                              setLastReceivedSignal({
                                key: 'Simulated_SpeedUp',
                                action: 'Aumentar Velocidade',
                                time: new Date().toLocaleTimeString()
                              });
                            }}
                            className="w-8 h-8 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-sm active:scale-90 transition-all cursor-pointer"
                            title="Aumentar Velocidade"
                          >
                            ▲
                          </button>

                          {/* Play/Pause Button */}
                          <button
                            onClick={() => {
                              setIsPlaying(p => !p);
                              setLastReceivedSignal({
                                key: 'Simulated_PlayPause',
                                action: 'Play / Pause',
                                time: new Date().toLocaleTimeString()
                              });
                            }}
                            className="w-10 h-10 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-full flex items-center justify-center font-bold shadow-md shadow-amber-500/20 active:scale-90 transition-all cursor-pointer"
                            title="Play / Pause"
                          >
                            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                          </button>

                          {/* Speed down button */}
                          <button
                            onClick={() => {
                              setSpeed(s => Math.max(s - 1, 1));
                              setLastReceivedSignal({
                                key: 'Simulated_SpeedDown',
                                action: 'Diminuir Velocidade',
                                time: new Date().toLocaleTimeString()
                              });
                            }}
                            className="w-8 h-8 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-sm active:scale-90 transition-all cursor-pointer"
                            title="Diminuir Velocidade"
                          >
                            ▼
                          </button>

                          {/* Reset Button */}
                          <button
                            onClick={() => {
                              handleReset();
                              setLastReceivedSignal({
                                key: 'Simulated_Reset',
                                action: 'Reiniciar',
                                time: new Date().toLocaleTimeString()
                              });
                            }}
                            className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-[8px] font-bold uppercase text-zinc-400 border border-zinc-850 rounded-md active:scale-95 transition-all cursor-pointer"
                            title="Voltar ao início"
                          >
                            Reiniciar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
                      Pressione teclas no controle ou simule cliques para ver os sinais...
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
