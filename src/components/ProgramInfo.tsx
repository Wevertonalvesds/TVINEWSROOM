import React, { useState } from 'react';
import { 
  Plus, Calendar, Printer, Save, Upload, Presentation, AlertOctagon, RefreshCw, FolderX, Trash2, X, Sliders
} from 'lucide-react';
import { RegisteredProgram } from '../types';

interface ProgramInfoProps {
  nomePrograma: string;
  setNomePrograma: (v: string) => void;
  editorChefe: string;
  setEditorChefe: (v: string) => void;
  tempoPrograma: string;
  setTempoPrograma: (v: string) => void;
  dataPrograma: string;
  setDataPrograma: (v: string) => void;
  tempoTotal: string;
  tempoUsado: string;
  tempoRestante: string;
  isExtrapolado: boolean;
  onAddBloco: () => void;
  onAddComercial: () => void;
  onImprimir: () => void;
  onSalvar: () => void;
  onCarregar: () => void;
  onClearProgram: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  registeredPrograms: RegisteredProgram[];
  onAddRegisteredProgram: (name: string) => Promise<void>;
  onDeleteRegisteredProgram: (id: string) => Promise<void>;
}

export default function ProgramInfo({
  nomePrograma,
  setNomePrograma,
  editorChefe,
  setEditorChefe,
  tempoPrograma,
  setTempoPrograma,
  dataPrograma,
  setDataPrograma,
  tempoTotal,
  tempoUsado,
  tempoRestante,
  isExtrapolado,
  onAddBloco,
  onAddComercial,
  onImprimir,
  onSalvar,
  onCarregar,
  onClearProgram,
  fileInputRef,
  registeredPrograms,
  onAddRegisteredProgram,
  onDeleteRegisteredProgram,
}: ProgramInfoProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [newProgFormName, setNewProgFormName] = useState('');

  const handleAdd = async () => {
    const trimmed = newProgFormName.trim();
    if (!trimmed) return;
    await onAddRegisteredProgram(trimmed);
    setNewProgFormName('');
  };
  return (
    <div className="bg-[#18181b] p-5 border border-zinc-800/80 rounded-xl mb-6 shadow-xl relative overflow-hidden no-print">
      
      {/* Decorative Corner Glow */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-bl-full pointer-events-none" />

      {/* Grid Inputs and Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        
        {/* Core Inputs */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-3 text-left col-span-1 sm:col-span-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                  Nome do Programa
                </label>
                <button
                  type="button"
                  onClick={() => setIsManagerOpen(true)}
                  className="text-[10px] text-amber-500 hover:text-amber-400 font-bold uppercase tracking-wider cursor-pointer font-sans"
                >
                  Cadastrar
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  list="registered-programs-datalist"
                  value={nomePrograma}
                  onChange={(e) => setNomePrograma(e.target.value)}
                  placeholder="Ex: TVI NOTÍCIAS"
                  className="w-full bg-[#111113] border border-zinc-800 text-zinc-100 font-sans text-sm font-medium px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition-all placeholder-zinc-700"
                />
                <datalist id="registered-programs-datalist">
                  {registeredPrograms.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest text-[#9ca3af]">
                Editor Chefe
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={editorChefe}
                  onChange={(e) => setEditorChefe(e.target.value)}
                  placeholder="Nome do Editor"
                  className="w-full bg-[#111113] border border-zinc-800 text-zinc-100 font-sans text-sm font-medium px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition-all placeholder-zinc-700"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-left self-start">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest text-[#9ca3af]">
              Data de Exibição
            </label>
            <div className="relative">
              <input
                type="date"
                value={dataPrograma || ''}
                onChange={(e) => setDataPrograma(e.target.value)}
                className="w-full bg-[#111113] border border-zinc-800 text-zinc-100 font-sans text-sm font-medium px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent transition-all scheme-dark"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left self-start">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest text-[#9ca3af]">
              Tempo Previsto
            </label>
            <div className="relative">
              {(() => {
                const parts = (tempoPrograma || "00:00:00").split(':');
                const hStr = parts.length === 3 ? parts[0] : "00";
                const mStr = parts.length === 3 ? parts[1] : (parts.length === 2 ? parts[0] : "00");
                const sStr = parts.length === 3 ? parts[2] : (parts.length === 2 ? parts[1] : "00");

                const hoursVal = isNaN(parseInt(hStr)) ? 0 : parseInt(hStr);
                const minutesVal = isNaN(parseInt(mStr)) ? 0 : parseInt(mStr);
                const secondsVal = isNaN(parseInt(sStr)) ? 0 : parseInt(sStr);

                return (
                  <div className="flex items-center gap-1.5 w-full bg-[#111113] border border-zinc-800 text-zinc-100 font-mono text-sm px-2 py-2 rounded-lg">
                    <div className="flex items-center gap-0.5">
                      <select
                        value={hoursVal}
                        onChange={(e) => {
                          const newH = e.target.value.padStart(2, '0');
                          const m = mStr.padStart(2, '0');
                          const s = sStr.padStart(2, '0');
                          setTempoPrograma(`${newH}:${m}:${s}`);
                        }}
                        className="bg-zinc-950 border border-zinc-800 text-zinc-300 font-bold px-1 py-0.5 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                      >
                        {Array.from({ length: 13 }, (_, i) => i).map((h) => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-zinc-650 font-bold text-xs">:</span>
                    <div className="flex items-center gap-0.5">
                      <select
                        value={minutesVal}
                        onChange={(e) => {
                          const h = hStr.padStart(2, '0');
                          const newM = e.target.value.padStart(2, '0');
                          const s = sStr.padStart(2, '0');
                          setTempoPrograma(`${h}:${newM}:${s}`);
                        }}
                        className="bg-zinc-950 border border-zinc-800 text-zinc-300 font-bold px-1 py-0.5 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                      >
                        {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')}m</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-zinc-650 font-bold text-xs">:</span>
                    <div className="flex items-center gap-0.5">
                      <select
                        value={secondsVal}
                        onChange={(e) => {
                          const h = hStr.padStart(2, '0');
                          const m = mStr.padStart(2, '0');
                          const newS = e.target.value.padStart(2, '0');
                          setTempoPrograma(`${h}:${m}:${newS}`);
                        }}
                        className="bg-zinc-950 border border-zinc-800 text-zinc-300 font-bold px-1 py-0.5 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                      >
                        {Array.from({ length: 60 }, (_, i) => i).map((s) => (
                          <option key={s} value={s}>{String(s).padStart(2, '0')}s</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Global Timers Display */}
        <div className="lg:col-span-5 bg-[#111113]/80 p-3.5 border border-zinc-850 rounded-xl grid grid-cols-3 gap-2 text-center md:text-right select-none">
          <div className="flex flex-col justify-center border-r border-zinc-850 pr-2">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Tempo Total</span>
            <span className="text-sm md:text-xl font-mono font-bold text-zinc-300 mt-1">
              {tempoTotal}
            </span>
          </div>

          <div className="flex flex-col justify-center border-r border-zinc-850 px-2">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Tempo Usado</span>
            <span className="text-sm md:text-xl font-mono font-bold text-[#7dd3fc] mt-1">
              {tempoUsado}
            </span>
          </div>

          <div className="flex flex-col justify-center pl-2">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Restante</span>
            <div className="flex items-center justify-center md:justify-end gap-1 mt-1">
              <span className={`text-sm md:text-xl font-mono font-bold transition-colors ${
                isExtrapolado 
                  ? 'text-red-500 animate-pulse font-extrabold' 
                  : 'text-emerald-500'
              }`}>
                {tempoRestante}
              </span>
              {isExtrapolado && <AlertOctagon className="w-4 h-4 text-red-500 hidden sm:inline" />}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Commands & Buttons Toolbar */}
      <div className="mt-5 pt-4 border-t border-zinc-800/60 flex flex-wrap gap-2.5 items-center justify-between">
        
        {/* Creation commands */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onAddBloco}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-sans font-semibold text-xs uppercase tracking-wider rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all hover:shadow-lg hover:shadow-amber-500/10 active:scale-95 duration-100 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-zinc-950 stroke-[2.5]" />
            <span>Adicionar Bloco</span>
          </button>

          <button
            onClick={onAddComercial}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#27272a] text-zinc-200 border border-zinc-700/60 font-sans font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-zinc-800 transition-all hover:text-white active:scale-95 duration-100 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-zinc-400 stroke-[2.5]" />
            <span>Adicionar Comercial</span>
          </button>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onImprimir}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#27272a]/80 text-zinc-300 border border-zinc-750 font-sans font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-zinc-805 transition-all text-zinc-300 hover:text-white active:scale-95 duration-100 cursor-pointer"
            title="Imprimir Espelho de Programação"
          >
            <Printer className="w-4 h-4 stroke-[2]" />
            <span>Imprimir</span>
          </button>

          <button
            onClick={onSalvar}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#27272a]/80 text-zinc-300 border border-zinc-750 font-sans font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-zinc-805 transition-all text-zinc-300 hover:text-white active:scale-95 duration-100 cursor-pointer"
            title="Salvar espelho atual no computador como arquivo JSON"
          >
            <Save className="w-4 h-4 stroke-[2]" />
            <span>Salvar</span>
          </button>

          <button
            onClick={onCarregar}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#27272a]/80 text-zinc-300 border border-zinc-750 font-sans font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-zinc-805 transition-all text-zinc-300 hover:text-white active:scale-95 duration-100 cursor-pointer"
            title="Carregar arquivo JSON de espelho de estúdio"
          >
            <Upload className="w-4 h-4 stroke-[2]" />
            <span>Carregar PGM</span>
          </button>

          <button
            onClick={onClearProgram}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#27272a]/80 text-[#ef4444] border border-zinc-750 font-sans font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-red-950/40 hover:text-red-300 hover:border-red-900/40 transition-all active:scale-95 duration-100 cursor-pointer"
            title="Sair do espelho do programa atual para editar um espelho em branco"
          >
            <FolderX className="w-4 h-4 stroke-[2]" />
            <span>Sair / Novo Espelho</span>
          </button>

          {/* Hidden File Picker Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (fileEvent) => {
                  try {
                    const parsed = JSON.parse(fileEvent.target?.result as string);
                    // Emit load
                    (window as any).__loadStateCallback?.(parsed);
                  } catch (err) {
                    alert('Erro ao carregar o arquivo JSON. Certifique-se de que o formato é válido.');
                  }
                };
                reader.readAsText(e.target.files[0]);
                // Clear input
                e.target.value = '';
              }
            }}
            accept="application/json"
            className="hidden"
          />
        </div>

      </div>

      {/* Modern Overlay Modal */}
      {isManagerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#141416] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500" />
            <div className="p-4 border-b border-zinc-850 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500" strokeWidth={2.5} />
                Cadastrar Programas (Rede TVI)
              </h3>
              <button
                onClick={() => setIsManagerOpen(false)}
                className="text-zinc-505 hover:text-zinc-300 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Novo Programa</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProgFormName}
                    onChange={(e) => setNewProgFormName(e.target.value)}
                    placeholder="Ex: Rede TVI Notícias, TVI Fun"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAdd();
                      }
                    }}
                  />
                  <button
                    onClick={handleAdd}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Programas Registrados ({registeredPrograms.length})</label>
                <div className="max-h-52 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                  {registeredPrograms.length === 0 ? (
                    <div className="text-zinc-650 text-xs py-4 text-center italic">Nenhum programa cadastrado.</div>
                  ) : (
                    registeredPrograms.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-zinc-950 rounded-lg border border-zinc-90 w-full">
                        <span className="text-xs font-medium text-zinc-350">{p.name}</span>
                        <button
                          onClick={() => onDeleteRegisteredProgram(p.id)}
                          className="text-zinc-500 hover:text-red-550 p-1 transition-all cursor-pointer"
                          title="Excluir cadastro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="p-3 bg-zinc-900/60 border-t border-zinc-850/60 flex justify-end">
              <button
                onClick={() => setIsManagerOpen(false)}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs uppercase tracking-wide rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
