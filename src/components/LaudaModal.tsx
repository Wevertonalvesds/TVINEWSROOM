import React, { useEffect, useState } from 'react';
import { X, FileText, AlertCircle, Clock, RefreshCw, Tv, History } from 'lucide-react';
import LaudaVersionHistoryModal from './LaudaVersionHistoryModal';

interface LaudaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string, gc: string) => void;
  initialContent: string;
  initialGc: string;
  materiaTitle: string;
  laudaId: string;
  currentUserEmail?: string;
}

export default function LaudaModal({
  isOpen,
  onClose,
  onSave,
  initialContent,
  initialGc,
  materiaTitle,
  laudaId,
  currentUserEmail,
}: LaudaModalProps) {
  const [content, setContent] = useState(initialContent);
  const [gc, setGc] = useState(initialGc || '');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    setContent(initialContent);
    setGc(initialGc || '');
  }, [initialContent, initialGc, isOpen]);

  if (!isOpen) return null;

  // Words count & Estimated Reading Duration
  // Standard anchor reading speed is about 130-150 words per minute (~2.2 to 2.5 words per second)
  const wordCount = content.trim() === "" ? 0 : content.trim().split(/\s+/).length;
  const characterCount = content.length;
  
  const estimatedSeconds = Math.round(wordCount / 2.3);
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;
  const readingTimeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const handleSave = () => {
    onSave(content, gc);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs no-print">
      <div 
        className="w-full max-w-2xl bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-250"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#1f1f23]">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-lg font-display font-semibold text-zinc-100">
                Editar Lauda de Apresentação
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Retranca: <span className="text-amber-500 font-mono font-medium">{materiaTitle || "Sem Retranca"}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* GC / Créditos Input Field */}
          <div className="mb-5 space-y-2">
            <label htmlFor="gc-input" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tv className="w-4 h-4 text-amber-500" />
              GC / Gerador de Caracteres (Créditos da Matéria)
            </label>
            <input
              id="gc-input"
              type="text"
              className="w-full bg-zinc-950 text-zinc-100 font-sans text-sm p-3 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-zinc-700 shadow-inner transition-colors focus:bg-zinc-950"
              placeholder="Ex: JOÃO DA SILVA / PRODUTOR LOCAL"
              value={gc}
              onChange={(e) => setGc(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between mb-2">
            <label htmlFor="script-textarea" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Texto do Teleprompter (TP)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isAiLoading}
                onClick={handleAiFixGrammar}
                className="text-[10px] md:text-xs font-bold uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:opacity-50 px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 border border-amber-500/20"
                title="Corrigir ortografia e padronizar o estilo para TP"
              >
                {isAiLoading ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <span>✨ CORRIGIR COM IA</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setContent(prev => prev.toUpperCase())}
                className="text-[10px] md:text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 hover:text-amber-500 text-zinc-200 px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 border border-zinc-700/50"
                title="Transformar todo o texto em letras maiúsculas (Caixa Alta)"
              >
                <span>DEIXAR EM MAIÚSCULAS</span>
              </button>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(true)}
                className="text-[10px] md:text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 hover:text-amber-500 text-zinc-200 px-3 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 border border-zinc-700/50"
                title="Ver histórico de alterações"
              >
                <History className="w-3 h-3 text-amber-500" />
                <span>Histórico</span>
              </button>
            </div>
          </div>
          <textarea
            id="script-textarea"
            className="w-full h-80 bg-zinc-950 text-amber-300 font-mono text-lg leading-relaxed p-4 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none placeholder-zinc-700 shadow-inner"
            placeholder="Digite aqui o texto que será exibido no Teleprompter. Use letras maiúsculas para facilitar a leitura do apresentador..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4 mt-4 py-3 px-4 bg-zinc-900/60 rounded-lg border border-zinc-800/80 text-zinc-400 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Caracteres</span>
              <span className="text-base font-mono font-medium text-zinc-200 mt-0.5">{characterCount}</span>
            </div>
            <div className="flex flex-col border-x border-zinc-800 px-4">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Palavras</span>
              <span className="text-base font-mono font-medium text-zinc-200 mt-0.5">{wordCount}</span>
            </div>
            <div className="flex flex-col items-start justify-center">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" /> Tempo de Leitura Est.
              </span>
              <span className="text-base font-mono font-bold text-amber-400 mt-0.5">{readingTimeStr}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1f1f23] border-t border-zinc-800">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs text-left max-w-xs">
            <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>O texto é atualizado instantaneamente no teleprompter integrado.</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-white bg-transparent hover:bg-zinc-800 border border-zinc-700/60 rounded-lg transition-colors text-sm font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-95 duration-75 rounded-lg transition-all text-sm font-semibold shadow-md shadow-amber-500/10 cursor-pointer"
            >
              Salvar Lauda
            </button>
          </div>
        </div>
      </div>

      <LaudaVersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        laudaId={laudaId}
        laudaTitle={materiaTitle}
        currentUserEmail={currentUserEmail}
        onRevert={(revertedContent, revertedGc) => {
          setContent(revertedContent);
          setGc(revertedGc);
        }}
      />
    </div>
  );
}
