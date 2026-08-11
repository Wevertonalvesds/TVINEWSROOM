import React, { useState } from 'react';
import { 
  Plus, Calendar, Printer, Save, Upload, Presentation, AlertOctagon, RefreshCw, FolderX, Trash2, X, Sliders, CloudUpload, Check, Download
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
  onExportVideoSequence?: () => void;
  onClearProgram?: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  registeredPrograms: RegisteredProgram[];
  onAddRegisteredProgram: (name: string) => Promise<void>;
  onDeleteRegisteredProgram: (id: string) => Promise<void>;
  showMode?: 'form' | 'toolbar' | 'full';
  onOpenRoteiroTab?: () => void;
  onOpenProgramasTab?: () => void;
  onSaveToCloud?: () => void;
  isSavingToCloud?: boolean;
  saveToCloudSuccess?: boolean;
  activeCloudDocId?: string | null;
  onUnlinkCloudDoc?: () => void;
  originalNomePrograma?: string | null;
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
  onExportVideoSequence,
  onClearProgram,
  fileInputRef,
  registeredPrograms,
  onAddRegisteredProgram,
  onDeleteRegisteredProgram,
  showMode = 'full',
  onOpenRoteiroTab,
  onOpenProgramasTab,
  onSaveToCloud,
  isSavingToCloud = false,
  saveToCloudSuccess = false,
  activeCloudDocId = null,
  onUnlinkCloudDoc,
  originalNomePrograma = null,
}: ProgramInfoProps) {
  const isNameChanged = activeCloudDocId && originalNomePrograma && nomePrograma.trim().toLowerCase() !== originalNomePrograma.trim().toLowerCase();
  return (
    <div className="bg-transparent py-4 md:py-6 border-b border-zinc-800/80 mb-8 relative overflow-hidden no-print">
      
      {/* Decorative Corner Glow */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-bl-full pointer-events-none" />

      {/* Grid Inputs and Summary */}
      {(showMode === 'full' || showMode === 'form') && (
        <div className="grid grid-cols-1 gap-4">
          
          {/* Core Inputs */}
          <div className="grid grid-cols-12 gap-3.5 items-end">
            
            {/* Nome do Programa */}
            <div className="space-y-1.5 text-left col-span-12 sm:col-span-6 md:col-span-3">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                Nome do Programa
              </label>
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
              {isNameChanged && (
                <div className="mt-1.5 text-[10px] text-amber-500 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 flex flex-col gap-1.5">
                  <span className="leading-normal">
                    ⚠️ <strong>Aviso:</strong> Você alterou o nome. Se salvar agora, substituirá o roteiro original <strong>"{originalNomePrograma}"</strong>.
                  </span>
                  {onUnlinkCloudDoc && (
                    <button
                      type="button"
                      onClick={onUnlinkCloudDoc}
                      className="self-start text-[10px] font-extrabold uppercase tracking-wider text-amber-400 hover:text-amber-300 transition-colors cursor-pointer underline decoration-dotted"
                    >
                      Desvincular e Criar Novo Roteiro
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Editor Chefe */}
            <div className="space-y-1.5 text-left col-span-12 sm:col-span-6 md:col-span-2">
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

            {/* Data de Exibição */}
            <div className="space-y-1.5 text-left col-span-12 sm:col-span-4 md:col-span-2">
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

            {/* Tempo Previsto */}
            <div className="space-y-1.5 text-left col-span-12 sm:col-span-4 md:col-span-3">
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
                    <div className="flex items-center gap-1.5 w-full bg-[#111113] border border-zinc-800 text-zinc-100 font-mono text-sm px-2 py-2 rounded-lg justify-between">
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

            {/* NEW: Save program to cloud button */}
            <div className="col-span-12 sm:col-span-4 md:col-span-2 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={onSaveToCloud}
                disabled={!nomePrograma.trim() || isSavingToCloud}
                className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs uppercase tracking-wider font-extrabold select-none transition-all duration-100 cursor-pointer whitespace-nowrap ${
                  !nomePrograma.trim()
                    ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                    : saveToCloudSuccess
                      ? 'bg-emerald-600 hover:bg-emerald-550 text-white shadow-emerald-600/10'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 hover:from-amber-400 hover:to-amber-500 shadow-md active:scale-95'
                }`}
              >
                {isSavingToCloud ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Salvando...</span>
                  </>
                ) : saveToCloudSuccess ? (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Salvo!</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    <span>{activeCloudDocId ? 'Salvar Espelho' : 'Salvar Novo Espelho'}</span>
                  </>
                )}
              </button>

              {onOpenRoteiroTab && (
                <button
                  type="button"
                  onClick={onOpenRoteiroTab}
                  disabled={!nomePrograma.trim()}
                  className={`w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-[#27272a] hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700/60 rounded-lg text-xs uppercase tracking-wider font-extrabold select-none transition-all duration-100 cursor-pointer whitespace-nowrap active:scale-95`}
                  title="Abrir o roteiro como aba para começar a editar blocos"
                >
                  <Plus className="w-4 h-4 stroke-[2.5] text-amber-500" />
                  <span>Editar Roteiro</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ROTEIRO DETAILS HEADER (FOR TOOLBAR MODE) */}
      {showMode === 'toolbar' && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-lg shadow-amber-500/5">
              <Plus className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-left">
              <span className="text-[9px] uppercase font-bold text-zinc-550 tracking-widest font-mono">Espelho de Programação</span>
              <h3 className="text-zinc-100 font-display font-semibold text-lg tracking-tight uppercase mt-0.5">
                {nomePrograma || 'SEM TÍTULO'}
              </h3>
            </div>
          </div>

          {/* Global Timers Display */}
          <div className="bg-[#111113]/80 p-3 border border-zinc-850 rounded-xl flex items-center gap-4 select-none self-start md:self-auto min-w-[320px] justify-between">
            <div className="flex flex-col text-left pr-2 border-r border-zinc-850/60 flex-1">
              <span className="text-[9px] font-semibold text-zinc-550 uppercase tracking-widest">Tempo Total</span>
              <span className="text-sm font-mono font-bold text-zinc-300 mt-0.5">
                {tempoTotal}
              </span>
            </div>

            <div className="flex flex-col text-left px-2 border-r border-zinc-850/60 flex-1">
              <span className="text-[9px] font-semibold text-zinc-550 uppercase tracking-widest">Tempo Usado</span>
              <span className="text-sm font-mono font-bold text-[#7dd3fc] mt-0.5">
                {tempoUsado}
              </span>
            </div>

            <div className="flex flex-col text-left pl-2 flex-1">
              <span className="text-[9px] font-semibold text-zinc-550 uppercase tracking-widest">Restante</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-sm font-mono font-bold transition-colors ${
                  isExtrapolado 
                    ? 'text-red-500 animate-pulse font-extrabold' 
                    : 'text-emerald-500'
                }`}>
                  {tempoRestante}
                </span>
                {isExtrapolado && <AlertOctagon className="w-3.5 h-3.5 text-red-500" />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Commands & Buttons Toolbar */}
      {(showMode === 'full' || showMode === 'toolbar') && (
        <div className="flex flex-wrap gap-2.5 items-center justify-between">
          
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

          {onExportVideoSequence && (
            <button
              type="button"
              onClick={onExportVideoSequence}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 font-sans font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-amber-500/20 hover:text-amber-400 transition-all active:scale-95 duration-100 cursor-pointer"
              title="Exportar a sequência de vídeos vinculados em um arquivo JSON para o Playout"
            >
              <Download className="w-4 h-4 stroke-[2]" />
              <span>Exportar Sequência JSON</span>
            </button>
          )}

          {onClearProgram && (
            <button
              onClick={onClearProgram}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 font-sans font-semibold text-xs uppercase tracking-wider rounded-lg hover:bg-red-500/20 hover:text-red-300 transition-all active:scale-95 duration-100 cursor-pointer"
              title="Limpar todos os campos do cabeçalho e redefinir o espelho"
            >
              <Trash2 className="w-4 h-4 stroke-[2]" />
              <span>Limpar Formulário</span>
            </button>
          )}

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
    )}
    </div>
  );
}

