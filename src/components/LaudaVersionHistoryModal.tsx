import React, { useEffect, useState } from 'react';
import { X, History, User, Calendar, RotateCcw, ArrowLeft, RefreshCw, Eye, Tv } from 'lucide-react';
import { db, collection, getDocs, query, where, orderBy } from '../firebase';

interface LaudaVersion {
  id: string;
  laudaId: string;
  materia: string;
  laudaContent: string;
  gc: string;
  updatedBy: string;
  updatedAt: string;
}

interface LaudaVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  laudaId: string;
  laudaTitle: string;
  onRevert: (content: string, gc: string) => void;
  currentUserEmail?: string;
}

export default function LaudaVersionHistoryModal({
  isOpen,
  onClose,
  laudaId,
  laudaTitle,
  onRevert,
  currentUserEmail,
}: LaudaVersionHistoryModalProps) {
  const [versions, setVersions] = useState<LaudaVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<LaudaVersion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load versions
  useEffect(() => {
    if (!isOpen || !laudaId) return;

    const fetchVersions = async () => {
      setIsLoading(true);
      setError(null);
      setSelectedVersion(null);

      try {
        let loadedVersions: LaudaVersion[] = [];

        // 1. Try to fetch from cloud if user is online
        const isOffline = currentUserEmail === 'editor.offline@redetvi.com' || !currentUserEmail;
        if (!isOffline) {
          try {
            const q = query(
              collection(db, 'lauda_versions'),
              where('laudaId', '==', laudaId),
              orderBy('updatedAt', 'desc')
            );
            const snap = await getDocs(q);
            loadedVersions = snap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as LaudaVersion[];
          } catch (err) {
            console.warn('Erro ao carregar do Firestore, tentando local:', err);
          }
        }

        // 2. Fallback to localStorage (or merge if local has newer/different edits)
        const localKey = `lauda_versions_${laudaId}`;
        const localVersionsStr = localStorage.getItem(localKey);
        const localVersions: LaudaVersion[] = localVersionsStr ? JSON.parse(localVersionsStr) : [];

        // Combine and de-duplicate by comparing content/gc and date if needed, or simply prefer cloud if loaded
        if (loadedVersions.length === 0) {
          loadedVersions = localVersions;
        } else {
          // Merge local and cloud, ensure unique or sorted
          const all = [...loadedVersions];
          localVersions.forEach(local => {
            if (!all.some(v => v.laudaContent === local.laudaContent && v.gc === local.gc)) {
              all.push(local);
            }
          });
          // Sort descending by date
          all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          loadedVersions = all;
        }

        setVersions(loadedVersions);
        if (loadedVersions.length > 0) {
          setSelectedVersion(loadedVersions[0]);
        }
      } catch (err: any) {
        console.error(err);
        setError('Erro ao carregar o histórico de versões.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersions();
  }, [isOpen, laudaId, currentUserEmail]);

  if (!isOpen) return null;

  const handleRevertClick = (version: LaudaVersion) => {
    onRevert(version.laudaContent, version.gc);
    onClose();
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs no-print">
      <div 
        className="w-full max-w-4xl bg-[#18181b] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col h-[650px]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#1f1f23] shrink-0">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-lg font-display font-semibold text-zinc-100 uppercase tracking-wide">
                Histórico de Versões (Lauda)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Retranca: <span className="text-amber-500 font-mono font-medium">{laudaTitle || "Sem Retranca"}</span>
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

        {/* Content Section */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 bg-[#121214]">
          {/* Left Side: Version List */}
          <div className="w-full md:w-5/12 border-r border-zinc-800 overflow-y-auto p-4 space-y-3 flex flex-col">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">
              Versões Salvas ({versions.length})
            </span>

            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Carregando histórico...</span>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-lg text-red-400 text-xs text-center">
                {error}
              </div>
            ) : versions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 text-center px-4 space-y-2">
                <History className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                <p className="text-xs font-medium">Nenhuma versão anterior gravada para esta lauda.</p>
                <p className="text-[10px] text-zinc-650 max-w-xs">As versões são criadas automaticamente sempre que você realiza e salva alterações significativas no conteúdo.</p>
              </div>
            ) : (
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {versions.map((ver, idx) => {
                  const isSelected = selectedVersion?.id === ver.id || (idx === 0 && !selectedVersion);
                  return (
                    <button
                      key={ver.id || idx}
                      onClick={() => setSelectedVersion(ver)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/40 text-zinc-100 shadow-md shadow-amber-500/5'
                          : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800/40 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-mono font-bold ${isSelected ? 'text-amber-500' : 'text-zinc-500'}`}>
                          {idx === 0 ? 'Versão Atual' : `Versão #${versions.length - idx}`}
                        </span>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1 shrink-0">
                          <Calendar className="w-3 h-3 text-zinc-600" />
                          {formatDate(ver.updatedAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-sans truncate">
                        <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate">{ver.updatedBy}</span>
                      </div>

                      {ver.laudaContent && (
                        <p className="text-[11px] text-zinc-500 line-clamp-2 font-mono bg-zinc-950/30 p-1.5 rounded-md border border-zinc-900 leading-normal">
                          {ver.laudaContent.replace(/[\r\n]+/g, ' ')}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Side: Version Preview */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d0f] p-5">
            {selectedVersion ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-850 pb-3 mb-4 shrink-0">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md uppercase">
                      Visualizando Detalhes
                    </span>
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-zinc-500" />
                      Por: <span className="text-zinc-200 font-medium">{selectedVersion.updatedBy}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleRevertClick(selectedVersion)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 duration-75 text-zinc-950 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-500/5 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Reverter para esta versão</span>
                  </button>
                </div>

                {/* GC / Tarja preview */}
                <div className="mb-4 bg-zinc-900/60 p-3 rounded-lg border border-zinc-850 shrink-0">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                    <Tv className="w-3.5 h-3.5 text-amber-500" />
                    Gerador de Caracteres (GC)
                  </span>
                  <div className="text-sm font-sans font-medium text-zinc-100 bg-zinc-950 px-3 py-2 rounded border border-zinc-900">
                    {selectedVersion.gc || <span className="text-zinc-600 italic">Nenhum GC cadastrado</span>}
                  </div>
                </div>

                {/* Script preview */}
                <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden p-4">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2 shrink-0">
                    Texto do Teleprompter
                  </span>
                  <div className="flex-1 overflow-y-auto text-amber-400 font-mono text-base leading-relaxed whitespace-pre-wrap select-text selection:bg-amber-500/20">
                    {selectedVersion.laudaContent || <span className="text-zinc-600 italic">Esta versão possui o texto em branco</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 text-center p-6">
                <Eye className="w-12 h-12 text-zinc-700 mb-2 stroke-[1.2]" />
                <p className="text-sm font-medium">Selecione uma versão para visualizar</p>
                <p className="text-xs text-zinc-600 mt-1 max-w-xs">Escolha qualquer item da lista à esquerda para conferir o texto completo e os créditos associados.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#1f1f23] border-t border-zinc-800 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider border border-zinc-750 transition-all cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
}
