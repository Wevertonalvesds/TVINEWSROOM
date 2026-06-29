import React, { useState, useEffect } from 'react';
import { 
  Cloud, CloudUpload, CloudDownload, Database, Trash2, History, Calendar, RefreshCw, X, CheckCircle, Check
} from 'lucide-react';
import { db, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp, query, orderBy, where, type User } from '../firebase';
import { ProgramState } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, currentUser: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  const jsonString = JSON.stringify(errInfo);
  console.error('Firestore Error Detailed: ', jsonString);
  throw new Error(jsonString);
}

interface CloudProgram {
  id: string;
  nomePrograma: string;
  tempoPrograma: string;
  updatedAt: any;
  blocosCount: number;
  laudasCount: number;
  state: ProgramState;
}

interface CloudSyncPanelProps {
  currentProgramState: ProgramState;
  onLoadProgram: (state: ProgramState, cloudDocId: string | null) => void;
  currentUser: User | null;
  activeCloudDocId: string | null;
  onActiveCloudDocIdChange: (id: string | null) => void;
}

export default function CloudSyncPanel({
  currentProgramState,
  onLoadProgram,
  currentUser,
  activeCloudDocId,
  onActiveCloudDocIdChange
}: CloudSyncPanelProps) {
  const [programs, setPrograms] = useState<CloudProgram[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load programs directory from cloud, allowing all editors to collaborate on the same programs
  const fetchCloudPrograms = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const q = query(
        collection(db, 'programs')
      );
      
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (innerErr) {
        handleFirestoreError(innerErr, OperationType.LIST, 'programs', currentUser);
        return;
      }

      const list: CloudProgram[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        // Count total blocks and stories safely
        let bCount = 0;
        let lCount = 0;
        if (data.blocos && Array.isArray(data.blocos)) {
          bCount = data.blocos.length;
          data.blocos.forEach((b: any) => {
            if (b.laudas && Array.isArray(b.laudas)) {
              lCount += b.laudas.length;
            }
          });
        }

        // Parse updatedAt safely
        let rawDate = data.updatedAt;
        let dateObj = new Date();
        if (rawDate && rawDate.seconds) {
          dateObj = new Date(rawDate.seconds * 1000);
        } else if (rawDate) {
          dateObj = new Date(rawDate);
        }

        list.push({
          id: docSnap.id,
          nomePrograma: data.nomePrograma || 'SEM TÍTULO',
          tempoPrograma: data.tempoPrograma || '00:00:00',
          updatedAt: dateObj,
          blocosCount: bCount,
          laudasCount: lCount,
          state: {
            nomePrograma: data.nomePrograma || 'SEM TÍTULO',
            tempoPrograma: data.tempoPrograma || '00:00:00',
            dataPrograma: data.dataPrograma || '',
            blocos: data.blocos || []
          }
        });
      });

      // Sort by newest updatedAt first
      list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      setPrograms(list);
    } catch (err: any) {
      console.error('Error fetching cloud programs:', err);
      let details = err.message || err.toString();
      try {
        const parsed = JSON.parse(details);
        if (parsed.error) details = parsed.error;
      } catch (e) {}
      setErrorMessage(`Erro ao buscar na nuvem: ${details}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCloudPrograms();
  }, [currentUser]);

  // Save current program state to cloud
  const handleSaveToCloud = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setSyncStatus('saving');
    setErrorMessage(null);
    if (!currentProgramState.nomePrograma || !currentProgramState.nomePrograma.trim()) {
      setIsSaving(false);
      setSyncStatus('error');
      setErrorMessage('Defina um nome para o programa antes de salvar na nuvem!');
      return;
    }

    try {
      // Check if a cloud routine with the exact same name already exists under the user's workspace
      const existing = programs.find(
        p => p.nomePrograma.trim().toLowerCase() === currentProgramState.nomePrograma.trim().toLowerCase()
      );

      const payload = {
        userId: currentUser.uid,
        userEmail: currentUser.email || 'offline-editor@redetvi.com',
        nomePrograma: currentProgramState.nomePrograma,
        tempoPrograma: currentProgramState.tempoPrograma,
        dataPrograma: currentProgramState.dataPrograma || '',
        blocos: currentProgramState.blocos,
        updatedAt: new Date()
      };

      try {
        let savedId = activeCloudDocId;
        if (existing) {
          // Overwrite existing doc
          const docRef = doc(db, 'programs', existing.id);
          await updateDoc(docRef, payload);
          savedId = existing.id;
        } else {
          // Create new doc
          const docRef = await addDoc(collection(db, 'programs'), payload);
          savedId = docRef.id;
        }
        if (savedId) {
          onActiveCloudDocIdChange(savedId);
        }
      } catch (innerErr) {
        handleFirestoreError(innerErr, OperationType.WRITE, 'programs', currentUser);
      }

      setSyncStatus('success');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await fetchCloudPrograms();
    } catch (err: any) {
      console.error('Error saving to Cloud:', err);
      setSyncStatus('error');
      let details = err.message || err.toString();
      try {
        const parsed = JSON.parse(details);
        if (parsed.error) details = parsed.error;
      } catch (e) {}
      setErrorMessage(`Erro ao salvar na nuvem: ${details}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a saved program template
  const handleDeleteFromCloud = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Deseja realmente deletar este programa da nuvem?')) {
      return;
    }

    try {
      try {
        await deleteDoc(doc(db, 'programs', id));
      } catch (innerErr) {
        handleFirestoreError(innerErr, OperationType.DELETE, `programs/${id}`, currentUser);
      }
      setPrograms(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      console.error('Error deleting cloud document:', err);
      let details = err.message || err.toString();
      try {
        const parsed = JSON.parse(details);
        if (parsed.error) details = parsed.error;
      } catch (e) {}
      alert(`Erro ao excluir documento: ${details}`);
    }
  };

  const formatFirebaseDate = (timestamp: any) => {
    if (!timestamp) return 'Disponível';
    let date: Date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-[#18181b] p-5 border border-zinc-800/80 rounded-xl mb-6 shadow-xl relative overflow-hidden no-print">
      
      {/* Dynamic Background Glow */}
      <div className="absolute -top-10 -left-10 w-44 h-44 bg-amber-550/5 rounded-full filter blur-xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4 mb-4">
        
        {/* Caption */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <Cloud className="w-5 h-5 animate-pulse" />
          </div>
          <div className="text-left">
            <h2 className="text-zinc-100 font-display font-semibold text-lg tracking-tight">
              ROTEIROS SALVOS
            </h2>
            <p className="text-zinc-400 text-xs">
              Sua pasta pessoal e segura de roteiros de telejornalismo.
            </p>
          </div>
        </div>

        {/* Action button triggers */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {currentUser ? (
            <>
              <button
                type="button"
                onClick={fetchCloudPrograms}
                disabled={isLoading}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
                title="Atualizar lista da nuvem"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleSaveToCloud}
                disabled={isSaving}
                className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
                  saveSuccess 
                    ? 'bg-emerald-600 hover:bg-emerald-550 text-white shadow-emerald-600/10'
                    : 'bg-gradient-to-r from-amber-550 to-amber-600 hover:from-amber-450 hover:to-amber-500 text-zinc-950 shadow-amber-550/15'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white stroke-[2.5]" />
                    <span className="text-white">Salvo na Nuvem!</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-4 h-4" />
                    <span>Salvar Espelho</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="text-[11px] text-zinc-500 font-mono italic select-none">
              Modo Convidado (Offline)
            </div>
          )}
        </div>

      </div>

      {errorMessage && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-left mb-4 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Cloud directory grid */}
      <div>
        <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest text-left mb-3">
          Roteiros Salvos
        </h3>

        {!currentUser ? (
          <div className="py-6 border border-dashed border-zinc-850 rounded-xl text-center text-zinc-550 text-xs flex flex-col items-center justify-center gap-1.5 px-4 select-none">
            <span className="font-semibold text-zinc-400">Você está operando no Modo Local Offline</span>
            <span className="text-zinc-550 max-w-md text-center text-[11px] leading-relaxed">
              O sistema continua 100% functional! Seus roteiros estão sendo salvos de forma segura no navegador. Clique no botão de logout no cabeçalho se quiser cadastrar um editor ou fazer login para sincronizar roteiros na nuvem do estúdio.
            </span>
          </div>
        ) : isLoading && programs.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs">Sincronizando com a Rede TVI...</span>
          </div>
        ) : programs.length === 0 ? (
          <div className="py-8 border border-dashed border-zinc-850 rounded-xl text-center text-zinc-650 text-xs italic">
            Nenhum programa salvo na nuvem ainda. Clique em "Salvar Espelho" para começar!
          </div>
        ) : (
        <div className="flex flex-col gap-2.5">
          {programs.map((prog) => {
            const isCurrent = activeCloudDocId === prog.id;
            return (
              <div 
                key={prog.id}
                onClick={() => {
                  if (isCurrent) return;
                  onLoadProgram(prog.state, prog.id);
                }}
                className={`p-3.5 bg-[#121214] border rounded-xl text-left transition-all group relative flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                  isCurrent 
                    ? 'border-amber-555/30 ring-1 ring-amber-555/10 bg-amber-555/[0.01] cursor-default' 
                    : 'border-zinc-850 hover:border-zinc-700 cursor-pointer hover:bg-zinc-900/60'
                }`}
              >
                {/* Left side info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-sm text-zinc-200 group-hover:text-amber-500/90 transition-colors">
                      {prog.nomePrograma}
                    </span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-500/10 text-amber-500 border border-amber-500/25 shrink-0 uppercase tracking-wider">
                        Ativo
                      </span>
                    )}
                  </div>
                  
                  {/* Metadata line */}
                  <div className="flex flex-wrap gap-2.5 items-center text-zinc-550 text-[10px] font-mono">
                    <span className="text-zinc-400 font-bold uppercase">{prog.tempoPrograma}</span>
                    <span className="text-zinc-700 font-mono text-xs">•</span>
                    <span>{prog.blocosCount} {prog.blocosCount === 1 ? 'Bloco' : 'Blocos'}</span>
                    <span className="text-zinc-700 font-mono text-xs">•</span>
                    <span>{prog.laudasCount} {prog.laudasCount === 1 ? 'Lauda' : 'Laudas'}</span>
                    <span className="text-zinc-700 font-mono text-xs">•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-550" />
                      Atua: {formatFirebaseDate(prog.updatedAt)}
                    </span>
                  </div>
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto pt-2.5 md:pt-0 border-t md:border-none border-zinc-900/40">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteFromCloud(prog.id, e)}
                    className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-colors cursor-pointer border border-zinc-850 bg-zinc-900"
                    title="Excluir da Nuvem"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

    </div>
  );
}
