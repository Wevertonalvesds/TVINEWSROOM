import React, { useEffect, useState, useRef } from 'react';
import { FileText, AlertCircle, Clock, RefreshCw, Tv, Save, Check, X, History, Plus, Trash2 } from 'lucide-react';
import LaudaVersionHistoryModal from './LaudaVersionHistoryModal';
import { GCEntry } from '../types';

interface LaudaTabEditorProps {
  tabId: string;
  blockId: string;
  laudaId: string;
  initialContent: string;
  initialGc: string;
  initialGcs?: GCEntry[];
  materiaTitle: string;
  onSave: (content: string, gc: string, gcs?: GCEntry[]) => void;
  onClose: () => void;
  onUpdateTempState: (content: string, gc: string, gcs?: GCEntry[]) => void;
  currentUserEmail?: string;
}

export const LaudaTabEditor: React.FC<LaudaTabEditorProps> = ({
  tabId,
  blockId,
  laudaId,
  initialContent,
  initialGc,
  initialGcs,
  materiaTitle,
  onSave,
  onClose,
  onUpdateTempState,
  currentUserEmail,
}) => {
  const [content, setContent] = useState(initialContent);
  const [gcs, setGcs] = useState<GCEntry[]>(() => {
    if (initialGcs && initialGcs.length > 0) {
      return initialGcs;
    }
    if (initialGc && initialGc.trim() !== '') {
      return [{ id: '1', titulo: initialGc, subtitulo: '' }];
    }
    return [{ id: '1', titulo: '', subtitulo: '' }];
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    setContent(initialContent);
    if (initialGcs && initialGcs.length > 0) {
      setGcs(initialGcs);
    } else if (initialGc && initialGc.trim() !== '') {
      setGcs([{ id: '1', titulo: initialGc, subtitulo: '' }]);
    } else {
      setGcs([{ id: '1', titulo: '', subtitulo: '' }]);
    }
  }, [tabId]);

  const getPrimaryGcText = (gcsList: GCEntry[]) => {
    return gcsList[0]?.titulo || '';
  };

  // Track the absolute latest editor values in a ref
  const stateRef = useRef({ content, gcs });
  useEffect(() => {
    stateRef.current = { content, gcs };
  }, [content, gcs]);

  // Sync temp state with parent whenever content or GCs change, using a debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      onUpdateTempState(stateRef.current.content, getPrimaryGcText(stateRef.current.gcs), stateRef.current.gcs);
    }, 500); // 500ms delay is ideal to bundle rapid keystrokes

    return () => {
      clearTimeout(handler);
    };
  }, [content, gcs, onUpdateTempState]);

  // Flush latest changes immediately to the parent upon unmount (e.g. switching tabs or changing section)
  useEffect(() => {
    return () => {
      onUpdateTempState(stateRef.current.content, getPrimaryGcText(stateRef.current.gcs), stateRef.current.gcs);
    };
  }, [onUpdateTempState]);

  // Words count & Estimated Reading Duration
  const wordCount = content.trim() === "" ? 0 : content.trim().split(/\s+/).length;
  const characterCount = content.length;
  
  const estimatedSeconds = Math.round(wordCount / 2.3);
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;
  const readingTimeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const handleSave = () => {
    onSave(content, getPrimaryGcText(gcs), gcs);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleClose = () => {
    // Flush the latest state immediately to the parent before closing
    onUpdateTempState(stateRef.current.content, getPrimaryGcText(stateRef.current.gcs), stateRef.current.gcs);
    onClose();
  };

  const handleAiFixGrammar = async () => {
    if (!content.trim()) return;
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fix-grammar',
          text: content
        })
      });
      const data = await response.json();
      if (data.success && data.result) {
        setContent(data.result);
      } else {
        alert(data.error || 'Erro ao corrigir ortografia com IA.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao falar com a IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="w-full bg-transparent border-t border-zinc-850/80 animate-in fade-in duration-200 mt-6 no-print">
      {/* Tab Editor Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-4 border-b border-zinc-850 bg-transparent gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <FileText className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-display font-bold text-zinc-100 uppercase tracking-wide">
              Editor de Lauda (Aba Ativa)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Retranca: <span className="text-amber-500 font-mono font-bold uppercase">{materiaTitle || "Sem Retranca"}</span>
            </p>
          </div>
        </div>
        
        {/* Action button header */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 select-none cursor-pointer ${
              saveSuccess 
                ? 'bg-emerald-600 text-white' 
                : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/5 active:scale-95'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Salvo</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Salvar Lauda</span>
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider border border-zinc-750 transition-all active:scale-95 cursor-pointer"
            title="Ver histórico de alterações e revertê-las"
          >
            <History className="w-3.5 h-3.5 text-amber-500" />
            <span>Histórico</span>
          </button>

          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider border border-zinc-750 transition-all active:scale-95 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fechar</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Left Column: GC / Créditos Input Fields (Multi-Tarjas) */}
          <div className="space-y-4 flex flex-col justify-start">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 shrink-0">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                <Tv className="w-4 h-4 text-amber-500" />
                Gerador de Caracteres (GC)
              </label>
              <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                {gcs.length} {gcs.length === 1 ? 'Tarja' : 'Tarjas'}
              </span>
            </div>

            {/* List of GCs */}
            <div className="space-y-3.5 max-h-[290px] overflow-y-auto pr-1">
              {gcs.map((gcItem, index) => (
                <div 
                  key={gcItem.id || index} 
                  className="p-3.5 bg-[#070709] border border-zinc-850 rounded-xl relative group transition-all hover:border-zinc-800"
                >
                  {/* Header of GC card */}
                  <div className="flex items-center justify-between mb-2.5 border-b border-zinc-850/60 pb-1.5">
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px]">
                        {index + 1}
                      </span>
                      Tarja #{index + 1}
                    </span>
                    
                    {gcs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setGcs(prev => prev.filter((_, idx) => idx !== index));
                        }}
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-950/40 p-1 rounded transition-all cursor-pointer"
                        title="Remover esta tarja"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {/* Título / Principal */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Título (Texto Principal)</span>
                        <span className="text-zinc-600 text-[9px]">Ex: Nome do Entrevistado</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: DR. JOSÉ SILVA"
                        value={gcItem.titulo}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGcs(prev => {
                            const newGcs = [...prev];
                            newGcs[index] = { ...newGcs[index], titulo: val };
                            return newGcs;
                          });
                        }}
                        className="w-full bg-[#0d0d10] border border-zinc-800 text-zinc-100 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500/40 text-xs placeholder-zinc-700 transition-colors uppercase font-semibold"
                      />
                    </div>

                    {/* Subtítulo / Secundário */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Subtítulo (Segunda Linha)</span>
                        <span className="text-zinc-600 text-[9px]">Ex: Cargo / Função / Local</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: MÉDICO INFECTOLOGISTA"
                        value={gcItem.subtitulo || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGcs(prev => {
                            const newGcs = [...prev];
                            newGcs[index] = { ...newGcs[index], subtitulo: val };
                            return newGcs;
                          });
                        }}
                        className="w-full bg-[#0d0d10] border border-zinc-800 text-zinc-100 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500/40 text-xs placeholder-zinc-700 transition-colors uppercase font-medium"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New GC button */}
            <button
              type="button"
              onClick={() => {
                setGcs(prev => [...prev, { id: Date.now().toString(), titulo: '', subtitulo: '' }]);
              }}
              className="w-full py-2.5 bg-zinc-950 hover:bg-[#111114] text-zinc-300 border border-zinc-850 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4 text-amber-500" />
              Adicionar mais uma Tarja (GC)
            </button>

            {/* Visualização das Tarjas (GC) preview */}
            {gcs.some(g => g.titulo) && (
              <div className="p-3 bg-zinc-950/60 border border-zinc-850 rounded-xl space-y-2 shrink-0">
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Visualização do GC (No Ar)
                </span>
                
                <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-0.5">
                  {gcs.filter(g => g.titulo).map((g, idx) => (
                    <div key={g.id || idx} className="bg-black border border-zinc-800 p-2.5 rounded-lg flex items-center gap-2.5 relative overflow-hidden">
                      <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500" />
                      <div className="pl-1 min-w-0">
                        <span className="text-[7.5px] font-mono text-amber-500/60 uppercase font-bold tracking-wider block">TARJA {idx + 1}</span>
                        <span className="text-zinc-100 font-sans text-xs font-bold tracking-wide uppercase block truncate">
                          {g.titulo}
                        </span>
                        {g.subtitulo && (
                          <span className="text-amber-400 font-sans text-[9px] uppercase font-medium block truncate">
                            {g.subtitulo}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Text Area Setup */}
          <div className="space-y-3 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label htmlFor="script-textarea" className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Texto do Teleprompter (TP)
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={isAiLoading}
                  onClick={handleAiFixGrammar}
                  className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border border-amber-500/25"
                  title="Corrigir ortografia e padronizar o estilo para TP"
                >
                  {isAiLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>✨ Corrigir com IA</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setContent(prev => prev.toUpperCase())}
                  className="text-[10px] font-extrabold uppercase tracking-wider bg-zinc-800 hover:bg-[#27272a] hover:text-amber-500 text-zinc-250 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border border-zinc-750"
                  title="Transformar todo o texto em letras maiúsculas"
                >
                  <span>Letras Maiúsculas</span>
                </button>
              </div>
            </div>
            <textarea
              id="script-textarea"
              className="w-full h-80 bg-[#0a0a0c] text-amber-400 font-mono text-base md:text-lg leading-relaxed p-4 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-550/40 resize-none placeholder-zinc-700 shadow-inner flex-grow"
              placeholder="Digite aqui o texto para o Teleprompter. Use letras maiúsculas para facilitar a leitura..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 py-3 px-5 bg-transparent border-t border-b border-zinc-850 text-zinc-400 text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Caracteres</span>
            <span className="text-base font-mono font-semibold text-zinc-200 mt-0.5">{characterCount}</span>
          </div>
          <div className="flex flex-col border-x border-zinc-850 px-4">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Palavras</span>
            <span className="text-base font-mono font-semibold text-zinc-200 mt-0.5">{wordCount}</span>
          </div>
          <div className="flex flex-col items-start justify-center">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Leitura Est.
            </span>
            <span className="text-base font-mono font-bold text-amber-400 mt-0.5">{readingTimeStr}</span>
          </div>
        </div>
      </div>

      {/* Footer message notice */}
      <div className="py-4 bg-transparent border-t border-zinc-850 flex items-center gap-2 text-zinc-500 text-[11px] leading-tight select-none">
        <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0" />
        <span>O texto salvo nesta aba é atualizado em tempo real no teleprompter e no roteiro. Ao fechar a aba, as alterações são salvas automaticamente.</span>
      </div>

      <LaudaVersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        laudaId={laudaId}
        laudaTitle={materiaTitle}
        currentUserEmail={currentUserEmail}
        onRevert={(revertedContent, revertedGc) => {
          setContent(revertedContent);
          if (revertedGc && revertedGc.trim() !== '') {
            setGcs([{ id: '1', titulo: revertedGc, subtitulo: '' }]);
          } else {
            setGcs([{ id: '1', titulo: '', subtitulo: '' }]);
          }
        }}
      />
    </div>
  );
};

export default LaudaTabEditor;
