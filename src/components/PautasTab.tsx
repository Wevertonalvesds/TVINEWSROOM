import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Calendar, Landmark, ClipboardList, RefreshCw, Trash2, Edit2, CheckCircle2, ChevronRight, X, AlertCircle, Printer } from 'lucide-react';
import { Pauta, Colaborador, capitalizeName } from '../types';
import { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp, onSnapshot } from '../firebase';
import { User } from 'firebase/auth';
// @ts-ignore
import logoCor from '../../assets/.aistudio/logo cor.png';

interface PautasTabProps {
  currentUser: User | null;
  colaboradores?: Colaborador[];
}

export default function PautasTab({ currentUser, colaboradores = [] }: PautasTabProps) {
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'rascunho' | 'aprovada' | 'arquivada'>('todos');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPauta, setEditingPauta] = useState<Pauta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [printItem, setPrintItem] = useState<Pauta | null>(null);

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

  // Form State
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [programa, setPrograma] = useState('');
  const [descricao, setDescricao] = useState('');
  const [fontes, setFontes] = useState('');
  const [reporter, setReporter] = useState('');
  const [activeReporterDropdown, setActiveReporterDropdown] = useState(false);
  const [produtor, setProdutor] = useState('');
  const [activeProdutorDropdown, setActiveProdutorDropdown] = useState(false);
  const [status, setStatus] = useState<'rascunho' | 'aprovada' | 'arquivada'>('rascunho');

  const LOCAL_P_KEY = 'rede_tvi_pautas_v1';
  const [listOfPrograms, setListOfPrograms] = useState<string[]>([]);

  // Load programs directory from cloud or preset defaults
  useEffect(() => {
    const fetchRegisteredPrograms = async () => {
      let progs: string[] = [
        'TVI NOTÍCIAS', 'TVI GEEK', 'MIX TVI', 'RAMALHO TALK SHOW',
        'MELODIA TVI', 'TVI SPORTS', 'TVI ELEIÇÕES', 'TVI FUN', 'LINK TVI'
      ];
      if (currentUser) {
        try {
          const q = query(
            collection(db, 'registered_programs')
          );
          const snap = await getDocs(q);
          const cloudProgs: string[] = [];
          const seenNames = new Set<string>();
          snap.forEach(d => {
            const name = d.data().name;
            if (name) {
              const trimmedUpper = name.trim().toUpperCase();
              if (!seenNames.has(trimmedUpper)) {
                seenNames.add(trimmedUpper);
                cloudProgs.push(name);
              }
            }
          });
          if (cloudProgs.length > 0) {
            progs = cloudProgs;
          }
        } catch (e) {
          console.error('Error fetching registered programs in PautasTab', e);
        }
      }
      
      // Secondary absolute deduplication in memory
      const uniqueProgs: string[] = [];
      const absoluteSeen = new Set<string>();
      progs.forEach(p => {
        const key = p.trim().toUpperCase();
        if (key && !absoluteSeen.has(key)) {
          absoluteSeen.add(key);
          uniqueProgs.push(p.trim());
        }
      });

      uniqueProgs.sort((a, b) => a.localeCompare(b));
      setListOfPrograms(uniqueProgs);
    };

    fetchRegisteredPrograms();
  }, [currentUser]);

  // Load from local or cloud with real-time sync
  useEffect(() => {
    setIsLoading(true);
    let loadedPautas: Pauta[] = [];

    // Always load local copy first so the UI responds instantly and acts as offline cache!
    try {
      const local = localStorage.getItem(LOCAL_P_KEY);
      if (local) {
        loadedPautas = JSON.parse(local);
        setPautas(loadedPautas);
      }
    } catch (e) {
      console.error('Error loading local pautas', e);
    }

    const isCloudUser = currentUser && currentUser.uid !== 'espelho-rede-tvi-master' && currentUser.uid !== 'offline-editor';
    if (!isCloudUser) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'pautas')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const cloudPautas: Pauta[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        cloudPautas.push({
          id: docSnap.id,
          titulo: data.titulo || '',
          data: data.data || '',
          programa: data.programa || '',
          descricao: data.descricao || '',
          fontes: data.fontes || '',
          status: data.status || 'rascunho',
          reporter: data.reporter || '',
          produtor: data.produtor || '',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || '',
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || '',
        });
      });

      localStorage.setItem(LOCAL_P_KEY, JSON.stringify(cloudPautas));
      setPautas(cloudPautas);
      setIsLoading(false);
    }, (error) => {
      console.error('Firestore real-time pautas update error:', error);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  const loadPautas = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 300);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    setSyncStatus('saving');
    const now = new Date().toISOString();

    const pautaData: Partial<Pauta> & { userId?: string } = {
      titulo: titulo.trim(),
      data: data || new Date().toISOString().split('T')[0],
      programa: programa.trim() || 'Telejornal',
      descricao: descricao.trim(),
      fontes: fontes.trim(),
      status,
      reporter: reporter.trim(),
      produtor: produtor.trim(),
      updatedAt: now,
    };

    let updatedList = [...pautas];

    const isCloudUser = currentUser && currentUser.uid !== 'espelho-rede-tvi-master' && currentUser.uid !== 'offline-editor';

    try {
      if (editingPauta) {
        const updatedPauta: Pauta = {
          ...editingPauta,
          ...pautaData,
        } as Pauta;

        // Cloud write
        if (isCloudUser) {
          const docRef = doc(db, 'pautas', editingPauta.id);
          await updateDoc(docRef, { ...pautaData, updatedAt: serverTimestamp() });
        }

        // Local state update
        updatedList = pautas.map(p => p.id === editingPauta.id ? updatedPauta : p);
      } else {
        const tempId = Math.random().toString(36).substring(2, 9);
        const newPauta: Pauta = {
          id: tempId,
          ...pautaData,
          createdAt: now,
        } as Pauta;

        // Cloud write
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

      setPautas(updatedList);
      
      // Always save a local backup copy in localStorage
      localStorage.setItem(LOCAL_P_KEY, JSON.stringify(updatedList));
      
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2050);
      closeEditor();
    } catch (err) {
      console.error('Error saving pauta:', err);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta pauta?')) return;

    const remaining = pautas.filter(p => p.id !== id);
    setPautas(remaining);
    
    // Save updated backup copy in localStorage
    localStorage.setItem(LOCAL_P_KEY, JSON.stringify(remaining));

    const isCloudUser = currentUser && currentUser.uid !== 'espelho-rede-tvi-master' && currentUser.uid !== 'offline-editor';
    if (isCloudUser) {
      try {
        await deleteDoc(doc(db, 'pautas', id));
      } catch (err) {
        console.error('Firestore delete pauta error:', err);
      }
    }
  };

  const openNewEditor = () => {
    setEditingPauta(null);
    setTitulo('');
    setData(new Date().toISOString().split('T')[0]);
    setPrograma('');
    setDescricao('');
    setFontes('');
    setReporter('');
    setProdutor('');
    setStatus('rascunho');
    setIsEditorOpen(true);
  };

  const openEditEditor = (p: Pauta) => {
    setEditingPauta(p);
    setTitulo(p.titulo);
    setData(p.data);
    setPrograma(p.programa);
    setDescricao(p.descricao);
    setFontes(p.fontes);
    setReporter(p.reporter || '');
    setProdutor(p.produtor || '');
    setStatus(p.status);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingPauta(null);
  };

  // Filter List
  const filteredPautas = pautas.filter(p => {
    const matchesSearch = p.titulo.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.programa.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.reporter?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.produtor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.descricao.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'todos' || p.status === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div id="pautas-panel" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-500" />
            Pautas de Reportagem
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Planejamento e pautação das matérias e coberturas jornalísticas.
          </p>
        </div>
        <button
          onClick={openNewEditor}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 text-xs font-extrabold uppercase tracking-wide rounded-xl transition-all shadow-md select-none flex items-center justify-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Nova Pauta
        </button>
      </div>

      {/* Row controls */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar pauta, programa, repórter..."
            className="w-full bg-[#111113]/60 border border-zinc-800 text-xs px-10 py-2.5 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Category Filters */}
        <div className="flex bg-zinc-950 border border-zinc-850 p-1 rounded-xl scrollbar-none overflow-x-auto text-[11px] font-bold">
          {(['todos', 'rascunho', 'aprovada', 'arquivada'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors shrink-0 ${
                categoryFilter === cat
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              {cat === 'todos' ? 'Todas' : cat}
            </button>
          ))}
        </div>

        <button
          onClick={loadPautas}
          className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs"
          title="Recarregar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Grid View */}
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
            <p className="text-zinc-500 text-xs max-w-xs mx-auto">
              {searchQuery || categoryFilter !== 'todos'
                ? 'Nenhum resultado corresponde aos filtros selecionados.'
                : 'Crie sua primeira pauta de reportagem para planejar os próximos programas.'}
            </p>
          </div>
          {!searchQuery && categoryFilter === 'todos' && (
            <button
              onClick={openNewEditor}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold font-mono uppercase tracking-wider"
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
              className="bg-[#121214] border border-zinc-850/50 hover:border-zinc-750 hover:bg-[#161619] rounded-xl p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all group relative"
            >
              {/* Left side: title, metadata and status badge */}
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
                      <span className="text-amber-500/80 text-[10px] font-mono font-bold uppercase">
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
                    <p className="text-xs text-zinc-400 font-sans mt-0.5 line-clamp-1">
                      {pauta.descricao}
                    </p>
                  )}
                </div>
              </div>

              {/* Right side: Action row */}
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
                  className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-amber-400 rounded-lg transition-colors border border-zinc-850"
                  title="Editar Pauta"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(pauta.id)}
                  className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-red-400 rounded-lg transition-colors border border-zinc-850"
                  title="Excluir Pauta"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Editor Modal Overlay */}
      <AnimatePresence>
        {isEditorOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#141416] border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl relative overflow-hidden my-8"
            >
              {/* Highlight header */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500" />

              <div className="p-5 border-b border-zinc-850 flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-500" />
                  {editingPauta ? 'Editar Pauta de Reportagem' : 'Cadastrar Pauta de Reportagem'}
                </h3>
                <button
                  onClick={closeEditor}
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="p-6 space-y-4">
                {/* Main title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Título da Pauta *</label>
                  <input
                    type="text"
                    required
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex: Interdição total da BR-101 após queda de barreira"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Sub grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Data de Cobertura</label>
                    <input
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Program */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Programa Destino</label>
                    <input
                      type="text"
                      list="pautas-programas-list"
                      value={programa}
                      onChange={(e) => setPrograma(e.target.value)}
                      placeholder="Ex: JORNAL TVI, TVI GEEK, etc."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <datalist id="pautas-programas-list">
                      {listOfPrograms.map((p, idx) => (
                        <option key={idx} value={p} />
                      ))}
                    </datalist>
                  </div>

                  {/* Reporter */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Repórter Encarregado</label>
                    <input
                      type="text"
                      value={reporter}
                      onChange={(e) => setReporter(e.target.value)}
                      onFocus={() => setActiveReporterDropdown(true)}
                      onBlur={() => {
                        setReporter(prev => capitalizeName(prev));
                        setTimeout(() => setActiveReporterDropdown(false), 200);
                      }}
                      placeholder="Ex: Pedro Henrique"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {activeReporterDropdown && (() => {
                      const searchStr = reporter.toLowerCase();
                      const matching = colaboradores.filter(c => 
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
                                setReporter(c.nome);
                                setActiveReporterDropdown(false);
                              }}
                              className="w-full px-3.5 py-2 text-left text-xs hover:bg-amber-500 hover:text-zinc-950 flex items-center justify-between transition-colors font-sans uppercase group/item"
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

                  {/* Produtor */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Produtor</label>
                    <input
                      type="text"
                      value={produtor}
                      onChange={(e) => setProdutor(e.target.value)}
                      onFocus={() => setActiveProdutorDropdown(true)}
                      onBlur={() => {
                        setProdutor(prev => capitalizeName(prev));
                        setTimeout(() => setActiveProdutorDropdown(false), 200);
                      }}
                      placeholder="Ex: Maria Souza"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    {activeProdutorDropdown && (() => {
                      const searchStr = produtor.toLowerCase();
                      const matching = colaboradores.filter(c => 
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
                                setProdutor(c.nome);
                                setActiveProdutorDropdown(false);
                              }}
                              className="w-full px-3.5 py-2 text-left text-xs hover:bg-amber-500 hover:text-zinc-950 flex items-center justify-between transition-colors font-sans uppercase group/item"
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
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Status da Pauta</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-[#27272a] rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Escreva detalhadamente o enfoque da matéria, o que filmar, o histórico da situação..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y font-sans min-h-[140px]"
                  />
                </div>

                {/* Sources */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Fontes e Contatos</label>
                  <textarea
                    rows={4}
                    value={fontes}
                    onChange={(e) => setFontes(e.target.value)}
                    placeholder="Nome e telefone das pessoas a serem entrevistadas..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y font-sans min-h-[80px]"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-850">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="px-4 py-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={syncStatus === 'saving'}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-440 active:scale-95 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md select-none flex items-center gap-1.5"
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
          </div>
        )}
      </AnimatePresence>

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
              <h4 className="text-xs font-bold text-zinc-100 font-sans">Pauta Salva com Sucesso!</h4>
              <p className="text-[10px] text-zinc-450 font-sans">As informações foram guardadas e sincronizadas.</p>
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
              <h4 className="text-xs font-bold text-zinc-100 font-sans">Erro ao Salvar</h4>
              <p className="text-[10px] text-zinc-450 font-sans">Houve um problema ao guardar as alterações.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Printable template */}
      {printItem && createPortal(
        <div className="print-demand-container p-8 text-black bg-white select-text font-sans">
          {/* Header with TVI Logo */}
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

          {/* Document Title */}
          <div className="mb-6" style={{ marginBottom: '1.5rem' }}>
            <h2 className="text-lg font-bold border-b border-black pb-2 text-black uppercase" style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid black', paddingBottom: '0.5rem', color: '#000', textTransform: 'uppercase' }}>{printItem.titulo}</h2>
          </div>

          {/* Metadados Grid */}
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

          {/* Descrição / Enfoque */}
          <div className="mb-6" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-200 pb-1" style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #ccc', paddingBottom: '0.25rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Descrição / Enfoque</h3>
            <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap" style={{ fontSize: '14px', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{printItem.descricao || 'Nenhuma descrição adicionada.'}</p>
          </div>

          {/* Fontes / Contatos */}
          <div className="mb-6" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-200 pb-1" style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #ccc', paddingBottom: '0.25rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Fontes / Contatos sugeridos</h3>
            <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap" style={{ fontSize: '14px', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{printItem.fontes || 'Nenhuma fonte cadastrada.'}</p>
          </div>

          {/* Assinatura footer */}
          <div className="mt-20 pt-8 border-t border-dashed border-zinc-300 flex justify-between items-center text-[10px] text-zinc-400 font-mono" style={{ marginTop: '5rem', paddingTop: '2rem', borderTop: '1px dashed #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#777', fontFamily: 'monospace' }}>
            <span>REDE TVI JORNALISMO — SISTEMA DE COOPERATIVA DE NOTÍCIAS</span>
            <span>ASSINATURA DO EDITOR: __________________________________</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
