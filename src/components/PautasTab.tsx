import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ClipboardList, Plus, Search, Calendar, RefreshCw, Trash2, Edit2, X, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { Pauta, Colaborador, capitalizeName } from '../types';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, query, serverTimestamp, onSnapshot } from '../firebase';
import { User } from 'firebase/auth';
// @ts-ignore
import logoCor from '../../assets/.aistudio/logo cor.png';

interface PautasTabProps {
  currentUser: User | null;
  colaboradores?: Colaborador[];
}

interface InternalPautaTab {
  id: string; // 'list', 'new', or pauta.id
  title: string;
  type: 'list' | 'create' | 'edit';
  formData: {
    id?: string;
    titulo: string;
    data: string;
    programa: string;
    reporter: string;
    produtor: string;
    status: 'rascunho' | 'aprovada' | 'arquivada';
    descricao: string;
    fontes: string;
  };
}

export default function PautasTab({ currentUser, colaboradores = [] }: PautasTabProps) {
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'rascunho' | 'aprovada' | 'arquivada'>('todos');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [printItem, setPrintItem] = useState<Pauta | null>(null);

  // Dynamic Multi-Tab State
  const [tabs, setTabs] = useState<InternalPautaTab[]>([
    {
      id: 'list',
      title: 'Lista de Pautas',
      type: 'list',
      formData: {
        titulo: '',
        data: new Date().toISOString().split('T')[0],
        programa: '',
        reporter: '',
        produtor: '',
        status: 'rascunho',
        descricao: '',
        fontes: ''
      }
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('list');

  // Input Suggestion Dropdown States (per category)
  const [activeReporterDropdown, setActiveReporterDropdown] = useState(false);
  const [activeProdutorDropdown, setActiveProdutorDropdown] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Suggested program names
  const listOfPrograms = [
    'TVI NOTÍCIAS 1ª EDIÇÃO',
    'TVI NOTÍCIAS 2ª EDIÇÃO',
    'JORNAL DA TVI',
    'TVI ESPORTE',
    'TVI GEEK',
    'ESPECIAL REDE TVI'
  ];

  // Print Handler
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

  const LOCAL_PAUTAS_KEY = 'rede_tvi_pautas_v1';

  // Load from local storage or cloud
  useEffect(() => {
    setIsLoading(true);
    let loadedPautas: Pauta[] = [];

    try {
      const local = localStorage.getItem(LOCAL_PAUTAS_KEY);
      if (local) {
        loadedPautas = JSON.parse(local);
        setPautas(loadedPautas);
      }
    } catch (e) {
      console.error('Error loading local pautas', e);
    }

    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    if (!isCloudUser) {
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, 'pautas'));
    let hasCheckedSync = false;

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      // If cloud is empty but we have local cache, upload to sync!
      if (querySnapshot.empty && loadedPautas.length > 0 && !hasCheckedSync) {
        hasCheckedSync = true;
        console.log('Sincronizador: Nuvem vazia para "pautas", migrando cache local...');
        loadedPautas.forEach(async (p) => {
          try {
            await addDoc(collection(db, 'pautas'), {
              titulo: p.titulo,
              data: p.data,
              programa: p.programa || 'Geral',
              reporter: p.reporter || '',
              produtor: p.produtor || '',
              status: p.status,
              descricao: p.descricao || '',
              fontes: p.fontes || '',
              userId: currentUser.uid,
              createdAt: p.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          } catch (uploadErr) {
            console.error('Erro ao migrar pauta local para a nuvem:', uploadErr);
          }
        });
        return;
      }

      hasCheckedSync = true;

      const cloudPautas: Pauta[] = [];
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data();
        cloudPautas.push({
          id: docSnap.id,
          titulo: d.titulo || '',
          data: d.data || '',
          programa: d.programa || 'Geral',
          reporter: d.reporter || '',
          produtor: d.produtor || '',
          status: d.status || 'rascunho',
          descricao: d.descricao || '',
          fontes: d.fontes || '',
          createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt || '',
          updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.updatedAt || '',
        });
      });

      // Sort pautas by date descending
      cloudPautas.sort((a, b) => b.data.localeCompare(a.data));

      localStorage.setItem(LOCAL_PAUTAS_KEY, JSON.stringify(cloudPautas));
      setPautas(cloudPautas);
      setIsLoading(false);
    }, (error) => {
      console.warn('Firestore real-time pautas update error:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const loadPautas = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 300);
  };

  // Helper to update a field in the currently active tab's formData
  const updateActiveTabField = (field: keyof InternalPautaTab['formData'], value: any) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const newFormData = { ...t.formData, [field]: value };
        const newTitle = field === 'titulo' ? (value || 'Nova Pauta') : t.title;
        return {
          ...t,
          title: newTitle,
          formData: newFormData
        };
      }
      return t;
    }));
  };

  // Open a brand-new pauta editor tab
  const openNewEditor = () => {
    setTabs(prev => {
      const exists = prev.some(t => t.id === 'new');
      if (!exists) {
        return [
          ...prev,
          {
            id: 'new',
            title: 'Nova Pauta',
            type: 'create',
            formData: {
              titulo: '',
              data: new Date().toISOString().split('T')[0],
              programa: '',
              reporter: '',
              produtor: '',
              status: 'rascunho',
              descricao: '',
              fontes: ''
            }
          }
        ];
      }
      return prev;
    });
    setActiveTabId('new');
  };

  // Open an editing tab for an existing pauta
  const openEditEditor = (p: Pauta) => {
    setTabs(prev => {
      const exists = prev.some(t => t.id === p.id);
      if (!exists) {
        return [
          ...prev,
          {
            id: p.id,
            title: p.titulo,
            type: 'edit',
            formData: {
              id: p.id,
              titulo: p.titulo,
              data: p.data,
              programa: p.programa || '',
              reporter: p.reporter || '',
              produtor: p.produtor || '',
              status: p.status,
              descricao: p.descricao || '',
              fontes: p.fontes || ''
            }
          }
        ];
      }
      return prev;
    });
    setActiveTabId(p.id);
  };

  // Close a specific tab and navigate back to list
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

    const { id, titulo, data, programa, reporter, produtor, status, descricao, fontes } = activeTab.formData;
    if (!titulo.trim()) return;

    setSyncStatus('saving');
    const now = new Date().toISOString();

    const pautaData: Partial<Pauta> & { userId?: string } = {
      titulo: titulo.trim(),
      data,
      programa: (programa || 'Geral').trim(),
      reporter: reporter.trim(),
      produtor: produtor.trim(),
      status,
      descricao: descricao.trim(),
      fontes: fontes.trim(),
      updatedAt: now,
    };

    let updatedList = [...pautas];
    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';

    try {
      if (activeTab.type === 'edit') {
        const updatedPauta: Pauta = {
          id: activeTab.id,
          ...pautaData,
          createdAt: pautas.find(p => p.id === activeTab.id)?.createdAt || now,
        } as Pauta;

        if (isCloudUser) {
          const docRef = doc(db, 'pautas', activeTab.id);
          await updateDoc(docRef, { ...pautaData, updatedAt: serverTimestamp() });
        }

        updatedList = pautas.map(p => p.id === activeTab.id ? updatedPauta : p);
      } else {
        const tempId = Math.random().toString(36).substring(2, 9);
        const newPauta: Pauta = {
          id: tempId,
          ...pautaData,
          createdAt: now,
        } as Pauta;

        if (isCloudUser) {
          const docRef = await addDoc(collection(db, 'pautas'), {
            ...pautaData,
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
          });
          newPauta.id = docRef.id;
        }

        updatedList = [newPauta, ...pautas];
      }

      // Sort pautas by date descending
      updatedList.sort((a, b) => b.data.localeCompare(a.data));

      setPautas(updatedList);
      localStorage.setItem(LOCAL_PAUTAS_KEY, JSON.stringify(updatedList));

      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2050);
      closeTab(activeTabId);
    } catch (err) {
      console.warn('Error saving pauta:', err);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir esta pauta?')) return;

    const remaining = pautas.filter(p => p.id !== id);
    setPautas(remaining);
    localStorage.setItem(LOCAL_PAUTAS_KEY, JSON.stringify(remaining));

    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    if (isCloudUser) {
      try {
        await deleteDoc(doc(db, 'pautas', id));
      } catch (err) {
        console.warn('Firestore delete pauta error:', err);
      }
    }

    closeTab(id);
  };

  // AI Helper: Complete Pauta Generation
  const handleAiGeneratePauta = async (currentTitle: string, currentDesc: string) => {
    if (!currentTitle.trim()) return;
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-pauta',
          text: `Título da Pauta: ${currentTitle}\nDescrição atual: ${currentDesc}`
        })
      });
      const data = await response.json();
      if (data.success && data.result) {
        updateActiveTabField('descricao', data.result);
      } else {
        alert(data.error || 'Erro ao gerar pauta com IA.');
      }
    } catch (err) {
      console.warn('AI integration notice (handled):', err);
      alert('Erro de rede ao falar com a IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Helper: Interview Questions
  const handleAiGenerateQuestions = async (currentTitle: string) => {
    if (!currentTitle.trim()) return;
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-pauta-questions',
          text: currentTitle
        })
      });
      const data = await response.json();
      if (data.success && data.result) {
        const activeTab = tabs.find(t => t.id === activeTabId);
        const oldDesc = activeTab?.formData.descricao || '';
        updateActiveTabField('descricao', `${oldDesc}\n\n---\n\n### Sugestões de Perguntas para Entrevista (IA):\n${data.result}`);
      } else {
        alert(data.error || 'Erro ao sugerir perguntas com IA.');
      }
    } catch (err) {
      console.warn('AI integration notice (handled):', err);
      alert('Erro de rede ao falar com a IA.');
    } finally {
      setIsAiLoading(false);
    }
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
        updateActiveTabField('descricao', data.result);
      } else {
        alert(data.error || 'Erro ao corrigir ortografia.');
      }
    } catch (err) {
      console.warn('AI integration error (handled):', err);
      alert('Erro de rede ao falar com a IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredPautas = pautas.filter((p) => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch = p.titulo.toLowerCase().includes(queryLower) ||
                          p.descricao.toLowerCase().includes(queryLower) ||
                          p.reporter.toLowerCase().includes(queryLower) ||
                          p.programa.toLowerCase().includes(queryLower);
    const matchesCategory = categoryFilter === 'todos' || p.status === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div id="pautas-panel" className="space-y-6">
      
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
              <ClipboardList className="w-4 h-4 text-amber-500/80" />
              <span className="truncate max-w-[150px] uppercase font-sans tracking-wide">
                {tab.title}
              </span>
              
              {tab.id !== 'list' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
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
                <ClipboardList className="w-5 h-5 text-amber-500" />
                Sugestões de Pauta & Planejamento
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Sugira ideias de matérias, organize fontes, agende coberturas e defina os repórteres escalados.
              </p>
            </div>
            <button
              onClick={openNewEditor}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-440 active:scale-95 text-zinc-950 text-xs font-extrabold uppercase tracking-wide rounded-xl transition-all shadow-md select-none flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Nova Pauta
            </button>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar pauta, programa, repórter..."
                className="w-full bg-[#111113]/60 border border-zinc-800 text-xs px-10 py-2.5 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
              />
            </div>

            {/* Category Filters */}
            <div className="flex bg-zinc-950 border border-zinc-850 p-1 rounded-xl scrollbar-none overflow-x-auto text-[11px] font-bold">
              {([
                { key: 'todos', label: 'Todas' },
                { key: 'rascunho', label: 'Rascunho' },
                { key: 'aprovada', label: 'Aprovadas' },
                { key: 'arquivada', label: 'Arquivadas' }
              ] as const).map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors shrink-0 cursor-pointer ${
                    categoryFilter === cat.key
                      ? 'bg-amber-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <button
              onClick={loadPautas}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              title="Recarregar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* List/Grid of Pautas */}
          {isLoading ? (
            <div className="py-20 text-center text-zinc-500 text-xs font-mono uppercase tracking-wider animate-pulse flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              Carregando Pautas...
            </div>
          ) : filteredPautas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#0f0f11]/20 p-12 text-center max-w-xl mx-auto my-4 space-y-4">
              <ClipboardList className="mx-auto w-10 h-10 text-zinc-600 stroke-[1.5]" />
              <div className="space-y-1">
                <h4 className="text-zinc-300 font-bold text-sm">Nenhuma pauta encontrada</h4>
                <p className="text-zinc-500 text-xs max-w-sm mx-auto leading-relaxed">
                  {searchQuery || categoryFilter !== 'todos'
                    ? 'Nenhum resultado corresponde aos filtros selecionados.'
                    : 'Crie sua primeira pauta de reportagem para planejar os próximos programas.'}
                </p>
              </div>
              {!searchQuery && categoryFilter === 'todos' && (
                <button
                  onClick={openNewEditor}
                  className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold font-mono uppercase tracking-wider cursor-pointer"
                >
                  Começar Agora
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredPautas.map((pauta) => (
                <motion.div
                  layout
                  key={pauta.id}
                  className="bg-transparent border-b border-zinc-850/50 hover:bg-[#111113]/30 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all group relative text-left"
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-mono font-extrabold tracking-wider ${
                        pauta.status === 'aprovada'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : pauta.status === 'arquivada'
                          ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {pauta.status}
                      </span>
                      <span className="text-zinc-700 font-mono text-xs">•</span>
                      <span className="text-zinc-400 text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-850">
                        {pauta.programa}
                      </span>
                      <span className="text-zinc-700 font-mono text-xs">•</span>
                      <span className="text-zinc-400 text-[10px] font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        {pauta.data.split('-').reverse().join('/')}
                      </span>
                      {pauta.reporter && (
                        <>
                          <span className="text-zinc-700 font-mono text-xs">•</span>
                          <span className="text-amber-500/80 text-[10px] font-mono font-bold uppercase">
                            REP: {pauta.reporter.toUpperCase()}
                          </span>
                        </>
                      )}
                      {pauta.produtor && (
                        <>
                          <span className="text-zinc-700 font-mono text-xs">•</span>
                          <span className="text-zinc-400 text-[10px] font-mono font-medium uppercase">
                            PROD: {pauta.produtor.toUpperCase()}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-zinc-200 font-sans group-hover:text-amber-500/90 transition-colors">
                        {pauta.titulo}
                      </h3>
                      {pauta.descricao && (
                        <p className="text-xs text-zinc-450 font-sans mt-0.5 line-clamp-1">
                          {pauta.descricao}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto pt-3.5 md:pt-0 border-t md:border-none border-zinc-850/40">
                    <button
                      onClick={() => setPrintItem(pauta)}
                      className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-amber-400 rounded-lg transition-colors border border-zinc-850 cursor-pointer"
                      title="Imprimir Pauta"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditEditor(pauta)}
                      className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-amber-400 rounded-lg transition-colors border border-zinc-850 cursor-pointer"
                      title="Editar Pauta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(pauta.id)}
                      className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-red-400 rounded-lg transition-colors border border-zinc-850 cursor-pointer"
                      title="Excluir Pauta"
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

          const { id, titulo, data, programa, reporter, produtor, status, descricao, fontes } = activeTab.formData;

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#141416] border border-zinc-800 rounded-2xl w-full shadow-2xl p-6 text-left relative overflow-hidden animate-in fade-in duration-200"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500" />

              <div className="pb-5 mb-5 border-b border-zinc-850 flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-500" />
                  {activeTab.type === 'edit' ? 'Editar Pauta de Reportagem' : 'Cadastrar Pauta de Reportagem'}
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
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Título da Pauta *</label>
                  <input
                    type="text"
                    required
                    value={titulo}
                    onChange={(e) => updateActiveTabField('titulo', e.target.value)}
                    placeholder="Ex: Interdição total da BR-101 após queda de barreira"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                  />
                  {titulo.trim().length > 3 && (
                    <div className="flex flex-wrap gap-2 pt-1 font-sans">
                      <button
                        type="button"
                        disabled={isAiLoading}
                        onClick={() => handleAiGeneratePauta(titulo, descricao)}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:opacity-50 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 border border-amber-500/20 cursor-pointer"
                      >
                        {isAiLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>✨ Gerar Pauta Completa</span>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isAiLoading}
                        onClick={() => handleAiGenerateQuestions(titulo)}
                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 disabled:opacity-50 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 border border-blue-500/20 cursor-pointer"
                      >
                        {isAiLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>🎙️ Gerar Perguntas de Entrevista</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Data de Cobertura</label>
                    <input
                      type="date"
                      value={data}
                      onChange={(e) => updateActiveTabField('data', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                    />
                  </div>

                  {/* Program */}
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Programa Destino</label>
                    <input
                      type="text"
                      list="pautas-programas-list"
                      value={programa}
                      onChange={(e) => updateActiveTabField('programa', e.target.value)}
                      placeholder="Ex: JORNAL TVI, TVI GEEK, etc."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                    />
                    <datalist id="pautas-programas-list">
                      {listOfPrograms.map((p, idx) => (
                        <option key={idx} value={p} />
                      ))}
                    </datalist>
                  </div>

                  {/* Reporter suggestions */}
                  <div className="space-y-1.5 relative font-sans">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Repórter Encarregado</label>
                    <input
                      type="text"
                      value={reporter}
                      onChange={(e) => updateActiveTabField('reporter', e.target.value)}
                      onFocus={() => setActiveReporterDropdown(true)}
                      onBlur={() => {
                        updateActiveTabField('reporter', capitalizeName(reporter));
                        setTimeout(() => setActiveReporterDropdown(false), 200);
                      }}
                      placeholder="Ex: Pedro Henrique"
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
                  <div className="space-y-1.5 relative font-sans">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Produtor</label>
                    <input
                      type="text"
                      value={produtor}
                      onChange={(e) => updateActiveTabField('produtor', e.target.value)}
                      onFocus={() => setActiveProdutorDropdown(true)}
                      onBlur={() => {
                        updateActiveTabField('produtor', capitalizeName(produtor));
                        setTimeout(() => setActiveProdutorDropdown(false), 200);
                      }}
                      placeholder="Ex: Maria Souza"
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

                  {/* Status */}
                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Status da Pauta</label>
                    <select
                      value={status}
                      onChange={(e) => updateActiveTabField('status', e.target.value as any)}
                      className="w-full bg-zinc-950 border border-[#27272a] rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                    >
                      <option value="rascunho">Rascunho</option>
                      <option value="aprovada">Aprovada para Gravação</option>
                      <option value="arquivada">Arquivada</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Informações básicas e Enfoque</label>
                  <textarea
                    rows={8}
                    value={descricao}
                    onChange={(e) => updateActiveTabField('descricao', e.target.value)}
                    placeholder="Escreva detalhadamente o enfoque da matéria, o que filmar, o histórico da situação..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y font-sans min-h-[140px]"
                  />
                  {descricao.trim().length > 5 && (
                    <div className="flex flex-wrap gap-2 pt-1 font-sans">
                      <button
                        type="button"
                        disabled={isAiLoading}
                        onClick={() => handleAiFixGrammar(descricao)}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:opacity-50 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 border border-amber-500/20 cursor-pointer"
                      >
                        {isAiLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>✨ Corrigir Ortografia e Estilo</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Sources */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Fontes e Contatos</label>
                  <textarea
                    rows={4}
                    value={fontes}
                    onChange={(e) => updateActiveTabField('fontes', e.target.value)}
                    placeholder="Nome e telefone das pessoas a serem entrevistadas..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y font-sans min-h-[80px]"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-850">
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
                        <span>A salvar...</span>
                      </>
                    ) : (
                      <span>Gravar Pauta</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          );
        })()
      )}

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
              <h4 className="text-xs font-bold text-zinc-100">Pauta Salva com Sucesso!</h4>
              <p className="text-[10px] text-zinc-450">As informações foram guardadas e sincronizadas.</p>
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
              <h4 className="text-xs font-bold text-zinc-100">Erro ao Salvar</h4>
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
              <span className="text-xs font-bold text-zinc-800 font-mono block" style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', display: 'block' }}>PAUTA DE REPORTAGEM</span>
              <span className="text-[10px] text-zinc-500 font-mono block" style={{ fontSize: '10px', color: '#777', fontFamily: 'monospace', display: 'block' }}>Impresso em: {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <div className="mb-6" style={{ marginBottom: '1.5rem' }}>
            <h2 className="text-lg font-bold border-b border-black pb-2 text-black uppercase" style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid black', paddingBottom: '0.5rem', color: '#000', textTransform: 'uppercase' }}>{printItem.titulo}</h2>
          </div>

          <div className="grid grid-cols-3 gap-4 border border-black p-4 rounded-lg mb-6 bg-zinc-50" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', border: '1px solid black', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', backgroundColor: '#f9f9f9' }}>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Repórter Escalado</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.reporter ? printItem.reporter.toUpperCase() : 'Não definido'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Produtor</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.produtor ? printItem.produtor.toUpperCase() : 'Não definido'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Data de Cobertura</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.data ? new Date(printItem.data + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informada'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Programa Destinado</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.programa ? printItem.programa.toUpperCase() : 'Geral / Não definido'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Status da Pauta</span>
              <span className="text-sm font-semibold text-black uppercase" style={{ fontSize: '14px', fontWeight: '600', color: '#000', textTransform: 'uppercase' }}>{printItem.status}</span>
            </div>
          </div>

          <div className="mb-6" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-200 pb-1" style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #ccc', paddingBottom: '0.25rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Descrição / Enfoque</h3>
            <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap" style={{ fontSize: '14px', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{printItem.descricao || 'Nenhuma descrição adicionada.'}</p>
          </div>

          <div className="mb-6" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-200 pb-1" style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #ccc', paddingBottom: '0.25rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Fontes / Contatos sugeridos</h3>
            <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap" style={{ fontSize: '14px', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{printItem.fontes || 'Nenhuma fonte cadastrada.'}</p>
          </div>

          <div className="mt-20 pt-8 border-t border-dashed border-zinc-300 flex justify-between items-center text-[10px] text-zinc-400 font-mono" style={{ marginTop: '5rem', paddingTop: '2rem', borderTop: '1px dashed #ccc', display: 'flex', justifycontent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#777', fontFamily: 'monospace' }}>
            <span>REDE TVI JORNALISMO — SISTEMA DE COOPERATIVA DE NOTÍCIAS</span>
            <span>ASSINATURA DO EDITOR: __________________________________</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
