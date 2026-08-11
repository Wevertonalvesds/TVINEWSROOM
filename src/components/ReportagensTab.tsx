import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, User as UserIcon, RefreshCw, Trash2, Edit2, X, FileText, Film, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { Reportagem, Colaborador, RegisteredProgram, capitalizeName } from '../types';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, query, serverTimestamp, onSnapshot } from '../firebase';
import { User } from 'firebase/auth';
// @ts-ignore
import logoCor from '../../assets/.aistudio/logo cor.png';

interface ReportagensTabProps {
  currentUser: User | null;
  colaboradores?: Colaborador[];
  registeredPrograms?: RegisteredProgram[];
}

interface InternalReportagemTab {
  id: string; // 'list', 'new', or reportagem.id
  title: string;
  type: 'list' | 'create' | 'edit';
  formData: {
    id?: string;
    titulo: string;
    reporter: string;
    produtor: string;
    programa: string;
    cinegrafista: string;
    texto: string;
    creditos: string;
    imagens: string;
    entrevistados: string;
    driveLink: string;
    status: 'producao' | 'gravada' | 'finalizada' | 'arquivada';
  };
}

export default function ReportagensTab({ currentUser, colaboradores = [], registeredPrograms = [] }: ReportagensTabProps) {
  const [reportagens, setReportagens] = useState<Reportagem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'producao' | 'gravada' | 'finalizada' | 'arquivada'>('todos');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [printItem, setPrintItem] = useState<Reportagem | null>(null);

  // Dynamic Multi-Tab State
  const [tabs, setTabs] = useState<InternalReportagemTab[]>([
    {
      id: 'list',
      title: 'Lista de Reportagens',
      type: 'list',
      formData: {
        titulo: '',
        reporter: '',
        produtor: '',
        programa: '',
        cinegrafista: '',
        texto: '',
        creditos: '',
        imagens: '',
        entrevistados: '',
        driveLink: '',
        status: 'producao'
      }
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('list');

  // Input Suggestion Dropdown States (per category)
  const [activeReporterDropdown, setActiveReporterDropdown] = useState(false);
  const [activeProdutorDropdown, setActiveProdutorDropdown] = useState(false);
  const [activeProgramaDropdown, setActiveProgramaDropdown] = useState(false);
  const [activeCinegrafistaDropdown, setActiveCinegrafistaDropdown] = useState(false);

  const [isAiLoading, setIsAiLoading] = useState(false);

  // Print Handling
  useEffect(() => {
    if (printItem) {
      document.body.classList.add('printing-item');
      
      const handleAfterPrint = () => {
        setPrintItem(null);
        document.body.classList.remove('printing-item');
      };
      
      window.addEventListener('afterprint', handleAfterPrint);
      
      const printTimer = setTimeout(() => {
        window.print();
      }, 300);

      const fallbackTimer = setTimeout(() => {
        handleAfterPrint();
      }, 3000);
      
      return () => {
        window.removeEventListener('afterprint', handleAfterPrint);
        clearTimeout(printTimer);
        clearTimeout(fallbackTimer);
      };
    }
  }, [printItem]);

  const LOCAL_REP_KEY = 'rede_tvi_reportagens_v1';

  // Load from local or cloud with real-time sync
  useEffect(() => {
    setIsLoading(true);
    let loadedRep: Reportagem[] = [];

    // Always load local copy first so the UI responds instantly and acts as offline cache!
    try {
      const local = localStorage.getItem(LOCAL_REP_KEY);
      if (local) {
        loadedRep = JSON.parse(local);
        setReportagens(loadedRep);
      }
    } catch (e) {
      console.error('Error loading local reportagens', e);
    }

    const isCloudUser = currentUser && currentUser.uid !== 'espelho-rede-tvi-master' && currentUser.uid !== 'offline-editor';
    if (!isCloudUser) {
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, 'reportagens'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      // If cloud is completely empty but local has data, migrate local data to the cloud
      if (querySnapshot.empty && loadedRep.length > 0) {
        console.log('Sincronizador: Nuvem vazia para "reportagens", migrando cache local...');
        loadedRep.forEach(async (rep) => {
          try {
            await addDoc(collection(db, 'reportagens'), {
              titulo: rep.titulo,
              reporter: rep.reporter,
              produtor: rep.produtor,
              programa: rep.programa,
              cinegrafista: rep.cinegrafista || '',
              texto: rep.texto,
              creditos: rep.creditos || '',
              imagens: rep.imagens || '',
              entrevistados: rep.entrevistados || '',
              status: rep.status,
              driveLink: rep.driveLink || '',
              userId: currentUser.uid,
              createdAt: rep.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } catch (uploadErr) {
            console.error('Erro ao migrar reportagem local para a nuvem:', uploadErr);
          }
        });
        return;
      }

      const cloudRep: Reportagem[] = [];
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data();
        cloudRep.push({
          id: docSnap.id,
          titulo: d.titulo || '',
          reporter: d.reporter || '',
          produtor: d.produtor || '',
          programa: d.programa || '',
          cinegrafista: d.cinegrafista || '',
          texto: d.texto || '',
          creditos: d.creditos || '',
          imagens: d.imagens || '',
          entrevistados: d.entrevistados || '',
          status: d.status || 'producao',
          driveLink: d.driveLink || '',
          createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt || '',
          updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.updatedAt || '',
        });
      });

      localStorage.setItem(LOCAL_REP_KEY, JSON.stringify(cloudRep));
      setReportagens(cloudRep);
      setIsLoading(false);
    }, (error) => {
      console.warn('Firestore real-time reportagens update error:', error);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  const loadReportagens = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 300);
  };

  // Helper to update a field in the currently active tab's formData
  const updateActiveTabField = (field: keyof InternalReportagemTab['formData'], value: any) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const newFormData = { ...t.formData, [field]: value };
        const newTitle = field === 'titulo' ? (value || 'Nova Reportagem') : t.title;
        return {
          ...t,
          title: newTitle,
          formData: newFormData
        };
      }
      return t;
    }));
  };

  // Open a brand-new reportage editor tab
  const openNewEditor = () => {
    setTabs(prev => {
      const exists = prev.some(t => t.id === 'new');
      if (!exists) {
        return [
          ...prev,
          {
            id: 'new',
            title: 'Nova Reportagem',
            type: 'create',
            formData: {
              titulo: '',
              reporter: '',
              produtor: '',
              programa: '',
              cinegrafista: '',
              texto: '',
              creditos: '',
              imagens: '',
              entrevistados: '',
              driveLink: '',
              status: 'producao'
            }
          }
        ];
      }
      return prev;
    });
    setActiveTabId('new');
  };

  // Open an editing tab for an existing reportage
  const openEditEditor = (r: Reportagem) => {
    setTabs(prev => {
      const exists = prev.some(t => t.id === r.id);
      if (!exists) {
        return [
          ...prev,
          {
            id: r.id,
            title: r.titulo,
            type: 'edit',
            formData: {
              id: r.id,
              titulo: r.titulo,
              reporter: r.reporter,
              produtor: r.produtor,
              programa: r.programa || '',
              cinegrafista: r.cinegrafista || '',
              texto: r.texto,
              creditos: r.creditos || '',
              imagens: r.imagens || '',
              entrevistados: r.entrevistados || '',
              driveLink: r.driveLink || '',
              status: r.status
            }
          }
        ];
      }
      return prev;
    });
    setActiveTabId(r.id);
  };

  // Close a specific tab and navigate back to list if needed
  const closeTab = (tabId: string) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId('list');
      }
      return remaining;
    });
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.type === 'list') return;

    const { id, titulo, reporter, produtor, programa, cinegrafista, texto, creditos, imagens, entrevistados, status, driveLink } = activeTab.formData;
    if (!titulo.trim()) return;

    setSyncStatus('saving');
    const now = new Date().toISOString();

    const reportagemData: Partial<Reportagem> & { userId?: string } = {
      titulo: titulo.trim(),
      reporter: reporter.trim(),
      produtor: produtor.trim(),
      programa: programa.trim(),
      cinegrafista: cinegrafista.trim(),
      texto: texto.trim(),
      creditos: creditos.trim(),
      imagens: imagens.trim(),
      entrevistados: entrevistados.trim(),
      status,
      driveLink: driveLink.trim(),
      updatedAt: now,
    };

    let updatedList = [...reportagens];
    const isCloudUser = currentUser && currentUser.uid !== 'espelho-rede-tvi-master' && currentUser.uid !== 'offline-editor';

    try {
      if (activeTab.type === 'edit') {
        const updatedRep: Reportagem = {
          id: activeTab.id,
          ...reportagemData,
          createdAt: reportagens.find(r => r.id === activeTab.id)?.createdAt || now,
        } as Reportagem;

        if (isCloudUser) {
          const docRef = doc(db, 'reportagens', activeTab.id);
          await updateDoc(docRef, { ...reportagemData, updatedAt: serverTimestamp() });
        }

        updatedList = reportagens.map(r => r.id === activeTab.id ? updatedRep : r);
      } else {
        const tempId = Math.random().toString(36).substring(2, 9);
        const newRep: Reportagem = {
          id: tempId,
          ...reportagemData,
          createdAt: now,
        } as Reportagem;

        if (isCloudUser) {
          const docRef = await addDoc(collection(db, 'reportagens'), {
            ...reportagemData,
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
          });
          newRep.id = docRef.id;
        }

        updatedList = [newRep, ...reportagens];
      }

      setReportagens(updatedList);
      localStorage.setItem(LOCAL_REP_KEY, JSON.stringify(updatedList));
      
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2050);
      closeTab(activeTabId);
    } catch (err) {
      console.warn('Error saving reportagem:', err);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir esta reportagem?')) return;

    const remaining = reportagens.filter(r => r.id !== id);
    setReportagens(remaining);
    localStorage.setItem(LOCAL_REP_KEY, JSON.stringify(remaining));

    const isCloudUser = currentUser && currentUser.uid !== 'espelho-rede-tvi-master' && currentUser.uid !== 'offline-editor';
    if (isCloudUser) {
      try {
        await deleteDoc(doc(db, 'reportagens', id));
      } catch (err) {
        console.warn('Firestore delete reportagem error:', err);
      }
    }

    // Also close the editing tab if it was open
    closeTab(id);
  };

  // AI Helper: Grammar Fix
  const handleAiFixGrammar = async (currentText: string) => {
    if (!currentText.trim()) return;
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fix-grammar',
          text: currentText
        })
      });
      const data = await response.json();
      if (data.success && data.result) {
        updateActiveTabField('texto', data.result);
      } else {
        alert(data.error || 'Erro ao corrigir ortografia com IA.');
      }
    } catch (err) {
      console.warn('AI integration notice (handled):', err);
      alert('Erro de rede ao falar com a IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Helper: Summarize
  const handleAiSummarize = async (currentText: string) => {
    if (!currentText.trim()) return;
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'summarize-reportagem',
          text: currentText
        })
      });
      const data = await response.json();
      if (data.success && data.result) {
        updateActiveTabField('texto', `${currentText}\n\n---\n\n### Resumo da Reportagem por IA\n${data.result}`);
      } else {
        alert(data.error || 'Erro ao resumir reportagem com IA.');
      }
    } catch (err) {
      console.warn('AI integration notice (handled):', err);
      alert('Erro de rede ao falar com a IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredReportagens = reportagens.filter(r => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch = r.titulo.toLowerCase().includes(queryLower) || 
                          r.reporter.toLowerCase().includes(queryLower) ||
                          r.texto.toLowerCase().includes(queryLower) ||
                          (r.programa || '').toLowerCase().includes(queryLower) ||
                          (r.cinegrafista || '').toLowerCase().includes(queryLower);
    const matchesStatus = statusFilter === 'todos' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div id="reportagens-panel" className="space-y-6">
      
      {/* INTERNAL BROWSER-STYLE TAB BAR */}
      <div className="flex items-center border-b border-zinc-850 bg-zinc-950/40 p-1 rounded-t-2xl overflow-x-auto scrollbar-none gap-1 no-print">
        {tabs.map((tab) => {
          const isSelected = activeTabId === tab.id;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group relative flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-t-xl transition-all duration-150 cursor-pointer border-t border-x ${
                isSelected
                  ? 'bg-[#18181b] text-amber-500 border-zinc-800 border-b-2 border-b-amber-500'
                  : 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 border-transparent'
              }`}
            >
              <Film className="w-4 h-4 text-amber-500/80" />
              <span className="truncate max-w-[150px] uppercase font-sans tracking-wide">
                {tab.title}
              </span>
              
              {tab.id !== 'list' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                  title="Fechar aba"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {activeTabId === 'list' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <Film className="w-5 h-5 text-amber-500" />
                Produção de Reportagens
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Redação de matérias completas com textos de roteiro (lauda) e letreiros (créditos/GJs).
              </p>
            </div>
            <button
              onClick={openNewEditor}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-440 active:scale-95 text-zinc-950 text-xs font-extrabold uppercase tracking-wide rounded-xl transition-all shadow-md select-none flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Nova Reportagem
            </button>
          </div>

          {/* Controls row */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por retranca, repórter, texto..."
                className="w-full bg-[#111113]/60 border border-zinc-800 text-xs px-10 py-2.5 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Status Filters */}
            <div className="flex bg-zinc-950 border border-zinc-850 p-1 rounded-xl scrollbar-none overflow-x-auto text-[11px] font-bold">
              {([
                { key: 'todos', label: 'Todas' },
                { key: 'producao', label: 'Em Produção' },
                { key: 'gravada', label: 'Gravada' },
                { key: 'finalizada', label: 'Finalizada/Disponível' },
                { key: 'arquivada', label: 'Arquivada' }
              ] as const).map((filterObj) => (
                <button
                  key={filterObj.key}
                  onClick={() => setStatusFilter(filterObj.key)}
                  className={`px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${
                    statusFilter === filterObj.key
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
                >
                  {filterObj.label}
                </button>
              ))}
            </div>

            <button
              onClick={loadReportagens}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-205 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs shrink-0 cursor-pointer"
              title="Recarregar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* List View */}
          {isLoading ? (
            <div className="py-20 text-center text-zinc-500 text-xs font-mono uppercase tracking-wider animate-pulse flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              Carregando Reportagens...
            </div>
          ) : filteredReportagens.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#0f0f11]/20 p-12 text-center max-w-xl mx-auto my-4 space-y-4">
              <Film className="mx-auto w-10 h-10 text-zinc-600 stroke-[1.5]" />
              <div className="space-y-1">
                <h4 className="text-zinc-350 font-bold text-sm">Nenhuma reportagem cadastrada</h4>
                <p className="text-zinc-550 text-xs max-w-sm mx-auto leading-relaxed">
                  {searchQuery || statusFilter !== 'todos'
                    ? 'Nenhum resultado corresponde aos termos da busca.'
                    : 'Crie sua primeira reportagem jornalística estruturada com textos de roteiro (lauda) e letreiros (créditos/GJs).'}
                </p>
              </div>
              {!searchQuery && statusFilter === 'todos' && (
                <button
                  onClick={openNewEditor}
                  className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold font-mono uppercase tracking-wider cursor-pointer"
                >
                  Começar Produção
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredReportagens.map((rep) => (
                <motion.div
                  layout
                  key={rep.id}
                  className="bg-transparent border-b border-zinc-850/50 hover:bg-[#111113]/30 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all group relative text-left"
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-mono font-extrabold tracking-wider ${
                        rep.status === 'finalizada'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : rep.status === 'gravada'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : rep.status === 'arquivada'
                          ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {rep.status === 'producao' ? 'Em Produção' : rep.status}
                      </span>
                      
                      {rep.reporter && (
                        <>
                          <span className="text-zinc-700 font-mono text-xs">•</span>
                          <span className="text-amber-500/80 text-[10px] font-mono font-bold uppercase">
                            REP: {rep.reporter.toUpperCase()}
                          </span>
                        </>
                      )}
                      {rep.produtor && (
                        <>
                          <span className="text-zinc-700 font-mono text-xs">•</span>
                          <span className="text-zinc-400 text-[10px] font-mono font-medium uppercase">
                            PROD: {rep.produtor.toUpperCase()}
                          </span>
                        </>
                      )}
                      {rep.programa && (
                        <>
                          <span className="text-zinc-700 font-mono text-xs">•</span>
                          <span className="text-zinc-400 text-[10px] font-mono font-medium uppercase">
                            PROG: {rep.programa.toUpperCase()}
                          </span>
                        </>
                      )}
                      {rep.cinegrafista && (
                        <>
                          <span className="text-zinc-700 font-mono text-xs">•</span>
                          <span className="text-amber-550 text-[10px] font-mono font-bold uppercase">
                            CINE: {rep.cinegrafista.toUpperCase()}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-zinc-200 font-sans group-hover:text-amber-500/90 transition-colors">
                        {rep.titulo}
                      </h3>
                      {rep.texto && (
                        <p className="text-xs text-zinc-450 font-sans mt-0.5 line-clamp-1">
                          {rep.texto}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto pt-3.5 md:pt-0 border-t md:border-none border-zinc-850/40">
                    <button
                      onClick={() => setPrintItem(rep)}
                      className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-amber-400 rounded-lg transition-colors border border-zinc-850 cursor-pointer"
                      title="Imprimir Roteiro"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditEditor(rep)}
                      className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-amber-400 rounded-lg transition-colors border border-zinc-850 cursor-pointer"
                      title="Editar Roteiro"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(rep.id)}
                      className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-red-400 rounded-lg transition-colors border border-zinc-850 cursor-pointer"
                      title="Excluir Roteiro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        (() => {
          const activeTab = tabs.find(t => t.id === activeTabId);
          if (!activeTab) return null;
          
          const { id, titulo, reporter, produtor, programa, cinegrafista, texto, status } = activeTab.formData;
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#141416] border border-zinc-800 rounded-2xl w-full shadow-2xl p-6 text-left relative overflow-hidden animate-in fade-in duration-200"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500" />
              
              <div className="pb-5 mb-5 border-b border-zinc-850 flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-500" />
                  {activeTab.type === 'edit' ? 'Editar Reportagem de Emissora' : 'Nova Ficha de Reportagem Completa'}
                </h3>
                <button
                  onClick={() => closeTab(activeTabId)}
                  className="text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Título / Retranca da Matéria *</label>
                    <input
                      type="text"
                      required
                      value={titulo}
                      onChange={(e) => updateActiveTabField('titulo', e.target.value)}
                      placeholder="Ex: Retranca: ASFALTO BAIRRO INDUSTRIAL"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                    />
                  </div>

                  {/* Reporter suggestions */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Repórter (Apresentador)</label>
                    <input
                      type="text"
                      value={reporter}
                      onChange={(e) => updateActiveTabField('reporter', e.target.value)}
                      onFocus={() => setActiveReporterDropdown(true)}
                      onBlur={() => {
                        updateActiveTabField('reporter', capitalizeName(reporter));
                        setTimeout(() => setActiveReporterDropdown(false), 200);
                      }}
                      placeholder="Ex: Mariana Silva"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                    />
                    {activeReporterDropdown && (() => {
                      const searchStr = reporter.toLowerCase();
                      const uniqueColabsMap = new Map<string, typeof colaboradores[0]>();
                      colaboradores.forEach(c => {
                        const key = c.nome.trim().toLowerCase();
                        if (key && !uniqueColabsMap.has(key)) {
                          uniqueColabsMap.set(key, c);
                        }
                      });
                      const uniqueColabs = Array.from(uniqueColabsMap.values());
                      const matching = uniqueColabs.filter(c => 
                        c.nome.toLowerCase().includes(searchStr)
                      );
                      if (matching.length === 0) return null;
                      return (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-44 overflow-y-auto z-50 py-1.5 scrollbar-none">
                          {matching.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => {
                                updateActiveTabField('reporter', c.nome);
                                setActiveReporterDropdown(false);
                              }}
                              className="w-full px-3.5 py-2 text-left text-xs hover:bg-amber-500 hover:text-zinc-950 flex items-center justify-between transition-colors font-sans uppercase group/item cursor-pointer"
                            >
                              <span className="font-extrabold text-zinc-300 group-hover/item:text-zinc-950 truncate mr-2">{c.nome}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 group-hover/item:bg-amber-600 group-hover/item:text-zinc-950 group-hover/item:border-amber-700 shrink-0 uppercase">
                                {c.funcao}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Produtor suggestions */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Produtor / Equipe Técnica</label>
                    <input
                      type="text"
                      value={produtor}
                      onChange={(e) => updateActiveTabField('produtor', e.target.value)}
                      onFocus={() => setActiveProdutorDropdown(true)}
                      onBlur={() => {
                        updateActiveTabField('produtor', capitalizeName(produtor));
                        setTimeout(() => setActiveProdutorDropdown(false), 200);
                      }}
                      placeholder="Ex: Ricardo Costa (Cinegrafista)"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                    />
                    {activeProdutorDropdown && (() => {
                      const searchStr = produtor.toLowerCase();
                      const uniqueColabsMap = new Map<string, typeof colaboradores[0]>();
                      colaboradores.forEach(c => {
                        const key = c.nome.trim().toLowerCase();
                        if (key && !uniqueColabsMap.has(key)) {
                          uniqueColabsMap.set(key, c);
                        }
                      });
                      const uniqueColabs = Array.from(uniqueColabsMap.values());
                      const matching = uniqueColabs.filter(c => 
                        c.nome.toLowerCase().includes(searchStr)
                      );
                      if (matching.length === 0) return null;
                      return (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-44 overflow-y-auto z-50 py-1.5 scrollbar-none">
                          {matching.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => {
                                updateActiveTabField('produtor', c.nome);
                                setActiveProdutorDropdown(false);
                              }}
                              className="w-full px-3.5 py-2 text-left text-xs hover:bg-amber-500 hover:text-zinc-950 flex items-center justify-between transition-colors font-sans uppercase group/item cursor-pointer"
                            >
                              <span className="font-extrabold text-zinc-300 group-hover/item:text-zinc-950 truncate mr-2">{c.nome}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 group-hover/item:bg-amber-600 group-hover/item:text-zinc-950 group-hover/item:border-amber-700 shrink-0 uppercase">
                                {c.funcao}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Programa suggestions */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Programa</label>
                    <input
                      type="text"
                      value={programa}
                      onChange={(e) => updateActiveTabField('programa', e.target.value)}
                      onFocus={() => setActiveProgramaDropdown(true)}
                      onBlur={() => {
                        updateActiveTabField('programa', capitalizeName(programa));
                        setTimeout(() => setActiveProgramaDropdown(false), 200);
                      }}
                      placeholder="Ex: TVI Notícias"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                    />
                    {activeProgramaDropdown && (() => {
                      const searchStr = programa.toLowerCase();
                      const matching = registeredPrograms.filter(p => 
                        p.name.toLowerCase().includes(searchStr)
                      );
                      if (matching.length === 0) return null;
                      return (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-44 overflow-y-auto z-50 py-1.5 scrollbar-none">
                          {matching.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={() => {
                                updateActiveTabField('programa', p.name);
                                setActiveProgramaDropdown(false);
                              }}
                              className="w-full px-3.5 py-2 text-left text-xs hover:bg-amber-500 hover:text-zinc-950 flex items-center justify-between transition-colors font-sans uppercase group/item cursor-pointer"
                            >
                              <span className="font-extrabold text-zinc-300 group-hover/item:text-zinc-950 truncate">{p.name}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Cinegrafista suggestions */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Cinegrafista</label>
                    <input
                      type="text"
                      value={cinegrafista}
                      onChange={(e) => updateActiveTabField('cinegrafista', e.target.value)}
                      onFocus={() => setActiveCinegrafistaDropdown(true)}
                      onBlur={() => {
                        updateActiveTabField('cinegrafista', capitalizeName(cinegrafista));
                        setTimeout(() => setActiveCinegrafistaDropdown(false), 200);
                      }}
                      placeholder="Ex: Ricardo Costa"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                    />
                    {activeCinegrafistaDropdown && (() => {
                      const searchStr = cinegrafista.toLowerCase();
                      const uniqueColabsMap = new Map<string, typeof colaboradores[0]>();
                      colaboradores.forEach(c => {
                        const key = c.nome.trim().toLowerCase();
                        if (key && !uniqueColabsMap.has(key)) {
                          uniqueColabsMap.set(key, c);
                        }
                      });
                      const uniqueColabs = Array.from(uniqueColabsMap.values());
                      const matching = uniqueColabs.filter(c => 
                        c.nome.toLowerCase().includes(searchStr)
                      );
                      if (matching.length === 0) return null;
                      return (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-44 overflow-y-auto z-50 py-1.5 scrollbar-none">
                          {matching.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => {
                                updateActiveTabField('cinegrafista', c.nome);
                                setActiveCinegrafistaDropdown(false);
                              }}
                              className="w-full px-3.5 py-2 text-left text-xs hover:bg-amber-500 hover:text-zinc-950 flex items-center justify-between transition-colors font-sans uppercase group/item cursor-pointer"
                            >
                              <span className="font-extrabold text-zinc-300 group-hover/item:text-zinc-950 truncate mr-2">{c.nome}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 group-hover/item:bg-amber-600 group-hover/item:text-zinc-950 group-hover/item:border-amber-700 shrink-0 uppercase">
                                {c.funcao}
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Texto de Roteiro */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Corpo do Texto de Roteiro (Lauda/Passagem) *</label>
                  <textarea
                    rows={12}
                    required
                    value={texto}
                    onChange={(e) => updateActiveTabField('texto', e.target.value)}
                    placeholder="[AQUI VAI O TEXTO DO REPÓRTER PARA LOCUÇÃO OU PASSAGEM]&#10;Ex: Moradores do bairro industrial sofrem há mais de doze meses com bueiros entupidos e poeira intensa..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono resize-y leading-relaxed min-h-[220px]"
                  />
                  {texto.trim().length > 10 && (
                    <div className="flex flex-wrap gap-2 pt-1 font-sans">
                      <button
                        type="button"
                        disabled={isAiLoading}
                        onClick={() => handleAiFixGrammar(texto)}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:opacity-50 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 border border-amber-500/20 cursor-pointer"
                      >
                        {isAiLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>✨ Corrigir Ortografia e Estilo</span>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isAiLoading}
                        onClick={() => handleAiSummarize(texto)}
                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 disabled:opacity-50 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 border border-blue-500/20 cursor-pointer"
                      >
                        {isAiLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>📝 Resumir Reportagem</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Status da Reportagem */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Status da Reportagem</label>
                  <select
                    value={status}
                    onChange={(e) => updateActiveTabField('status', e.target.value as any)}
                    className="w-full bg-zinc-950 border border-[#27272a] rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                  >
                    <option value="producao">Em Produção (Lauda Aberta)</option>
                    <option value="gravada">Matéria Gravada (Bruto)</option>
                    <option value="finalizada">Matéria Editada & Finalizada (Exibição Livre)</option>
                    <option value="arquivada">Arquivada</option>
                  </select>
                </div>

                <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={() => closeTab(activeTabId)}
                    className="px-4 py-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={syncStatus === 'saving'}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-440 active:scale-95 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md select-none flex items-center gap-1.5 cursor-pointer font-sans"
                  >
                    {syncStatus === 'saving' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando Matéria...</span>
                      </>
                    ) : (
                      <span>Registrar Reportagem</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          );
        })()
      )}

      {/* Floating live controls helper */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-40 no-print">
        <button
          onClick={() => {
            const reportsText = reportagens
              .filter(r => r.status === 'finalizada' || r.status === 'producao')
              .map(r => `RETRANCA: ${r.titulo.toUpperCase()}\nREPÓRTER: ${r.reporter.toUpperCase()}\nPRODUTOR: ${r.produtor.toUpperCase()}\n\nTEXTO:\n${r.texto}\n\n====================\n`)
              .join('\n');
            
            if (!reportsText) {
              alert('Nenhuma reportagem disponível para gerar roteiro.');
              return;
            }

            const win = window.open('', '_blank');
            if (win) {
              win.document.write(`<pre style="font-family: monospace; padding: 20px; background: #000; color: #fff; font-size: 14px;">${reportsText}</pre>`);
              win.document.close();
            } else {
              alert('Por favor, autorize pop-ups para gerar o documento.');
            }
          }}
          className="flex items-center gap-2 px-4 py-3 bg-[#111113] hover:bg-zinc-800 border border-zinc-750 text-zinc-300 hover:text-white rounded-full shadow-2xl font-semibold text-xs uppercase tracking-wide transition-all active:scale-95 duration-100 cursor-pointer"
          title="Download de todas as reportagens de hoje para Teleprompter"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span>Gerar Roteiro Reportagens</span>
        </button>
      </div>

      {/* Floating Notifications */}
      <AnimatePresence>
        {syncStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 bg-zinc-900 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[9999] font-sans"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-bold text-zinc-100">Reportagem Salva com Sucesso!</h4>
              <p className="text-[10px] text-zinc-450">A matéria foi guardada e sincronizada com sucesso.</p>
            </div>
          </motion.div>
        )}
        {syncStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 bg-zinc-900 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-[9999] font-sans"
          >
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h4 className="text-xs font-bold text-zinc-100">Erro ao Salvar Matéria</h4>
              <p className="text-[10px] text-zinc-450">Houve um problema ao guardar as alterações.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Printable template */}
      {printItem && createPortal(
        <div className="print-demand-container p-8 text-black bg-white select-text font-sans">
          <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid black', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src={logoCor} alt="Logo Rede TVI" style={{ height: '45px', width: 'auto', objectFit: 'contain' }} />
              <div className="text-left">
                <h1 className="text-xl font-bold tracking-tight text-black m-0 leading-tight" style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>REDE TVI</h1>
                <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 m-0" style={{ margin: 0, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#666' }}>DEPARTAMENTO DE TELEJORNALISMO</p>
              </div>
            </div>
            <div className="text-right" style={{ textAlign: 'right' }}>
              <span className="text-xs font-bold text-zinc-800 font-mono block" style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', display: 'block' }}>ROTEIRO DE REPORTAGEM / MATÉRIA</span>
              <span className="text-[10px] text-zinc-500 font-mono block" style={{ fontSize: '10px', color: '#777', fontFamily: 'monospace', display: 'block' }}>Impresso em: {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <div className="mb-6" style={{ marginBottom: '1.5rem' }}>
            <h2 className="text-lg font-bold border-b border-black pb-2 text-black uppercase" style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid black', paddingBottom: '0.5rem', color: '#000', textTransform: 'uppercase' }}>{printItem.titulo}</h2>
          </div>

          <div className="grid grid-cols-5 gap-4 border border-black p-4 rounded-lg mb-6 bg-zinc-50" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '1rem', border: '1px solid black', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', backgroundColor: '#f9f9f9' }}>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Repórter</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.reporter ? printItem.reporter.toUpperCase() : 'Não definido'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Produtor</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.produtor ? printItem.produtor.toUpperCase() : 'Não definido'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Programa</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.programa ? printItem.programa.toUpperCase() : 'Não definido'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Cinegrafista</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.cinegrafista ? printItem.cinegrafista.toUpperCase() : 'Não definido'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Status da Matéria</span>
              <span className="text-sm font-semibold text-black uppercase" style={{ fontSize: '14px', fontWeight: '600', color: '#000', textTransform: 'uppercase' }}>{printItem.status}</span>
            </div>
          </div>

          <div className="mb-6" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-200 pb-1" style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #ccc', paddingBottom: '0.25rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Texto da Matéria / Roteiro (Locução / Off / Sonora)</h3>
            <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap font-mono bg-zinc-50 p-4 border border-zinc-200 rounded" style={{ fontSize: '13px', color: '#222', lineHeight: '1.6', whiteSpace: 'pre-wrap', backgroundColor: '#fafafa', padding: '1rem', border: '1px solid #e1e1e1', fontFamily: 'monospace' }}>{printItem.texto || 'Nenhum texto de roteiro cadastrado.'}</p>
          </div>

          <div className="mt-20 pt-8 border-t border-dashed border-zinc-300 flex justify-between items-center text-[10px] text-zinc-400 font-mono" style={{ marginTop: '5rem', paddingTop: '2rem', borderTop: '1px dashed #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#777', fontFamily: 'monospace' }}>
            <span>REDE TVI JORNALISMO — SISTEMA DE COOPERATIVA DE NOTÍCIAS</span>
            <span>ASSINATURA DO REPORTER/PRODUTOR: __________________________________</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
