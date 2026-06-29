import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Calendar, MapPin, Phone, RefreshCw, Trash2, Edit2, X, ClipboardList, Clock, Info, CheckCircle2, AlertCircle, Printer } from 'lucide-react';
import { Agenda } from '../types';
import { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp, onSnapshot } from '../firebase';
import { User } from 'firebase/auth';
// @ts-ignore
import logoCor from '../../assets/.aistudio/logo cor.png';

interface AgendasTabProps {
  currentUser: User | null;
}

export default function AgendasTab({ currentUser }: AgendasTabProps) {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'ativos' | 'todos' | 'hoje'>('ativos');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<Agenda | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [printItem, setPrintItem] = useState<Agenda | null>(null);

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

  // Form states
  const [evento, setEvento] = useState('');
  const [dataHora, setDataHora] = useState('');
  const [local, setLocal] = useState('');
  const [contato, setContato] = useState('');
  const [descricao, setDescricao] = useState('');

  const LOCAL_AGE_KEY = 'rede_tvi_agendas_v1';

  // Load from local or cloud with real-time sync
  useEffect(() => {
    setIsLoading(true);
    let loadedAge: Agenda[] = [];

    // Always load local copy first so the UI responds instantly and acts as offline cache!
    try {
      const localData = localStorage.getItem(LOCAL_AGE_KEY);
      if (localData) {
        loadedAge = JSON.parse(localData);
        loadedAge.sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
        setAgendas(loadedAge);
      }
    } catch (e) {
      console.error('Error loading local agendas', e);
    }

    const isCloudUser = currentUser && currentUser.uid !== 'espelho-rede-tvi-master' && currentUser.uid !== 'offline-editor';
    if (!isCloudUser) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'agendas')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const cloudAge: Agenda[] = [];
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data();
        cloudAge.push({
          id: docSnap.id,
          evento: d.evento || '',
          dataHora: d.dataHora || '',
          local: d.local || '',
          contato: d.contato || '',
          descricao: d.descricao || '',
          createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt || '',
          updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.updatedAt || '',
        });
      });

      // Sort chronological
      cloudAge.sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());

      localStorage.setItem(LOCAL_AGE_KEY, JSON.stringify(cloudAge));
      setAgendas(cloudAge);
      setIsLoading(false);
    }, (error) => {
      console.error('Firestore real-time agendas update error:', error);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  const loadAgendas = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 300);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evento.trim() || !dataHora) return;

    setSyncStatus('saving');
    const now = new Date().toISOString();

    const agendaData: Partial<Agenda> & { userId?: string } = {
      evento: evento.trim(),
      dataHora,
      local: local.trim(),
      contato: contato.trim(),
      descricao: descricao.trim(),
      updatedAt: now,
    };

    let updatedList = [...agendas];

    const isCloudUser = currentUser && currentUser.uid !== 'espelho-rede-tvi-master' && currentUser.uid !== 'offline-editor';

    try {
      if (editingAgenda) {
        const updatedAge: Agenda = {
          ...editingAgenda,
          ...agendaData,
        } as Agenda;

        if (isCloudUser) {
          const docRef = doc(db, 'agendas', editingAgenda.id);
          await updateDoc(docRef, { ...agendaData, updatedAt: serverTimestamp() });
        }

        updatedList = agendas.map(a => a.id === editingAgenda.id ? updatedAge : a);
      } else {
        const tempId = Math.random().toString(36).substring(2, 9);
        const newAge: Agenda = {
          id: tempId,
          ...agendaData,
          createdAt: now,
        } as Agenda;

        if (isCloudUser) {
          const docRef = await addDoc(collection(db, 'agendas'), {
            ...agendaData,
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
          });
          newAge.id = docRef.id;
        }

        updatedList = [newAge, ...agendas];
      }

      // Sort chronological
      updatedList.sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());

      setAgendas(updatedList);
      
      // Always save a local backup copy in localStorage
      localStorage.setItem(LOCAL_AGE_KEY, JSON.stringify(updatedList));
      
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2050);
      closeEditor();
    } catch (err) {
      console.error('Error saving agenda event:', err);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este compromisso da agenda?')) return;

    const remaining = agendas.filter(a => a.id !== id);
    setAgendas(remaining);
    
    // Save updated backup copy in localStorage
    localStorage.setItem(LOCAL_AGE_KEY, JSON.stringify(remaining));

    const isCloudUser = currentUser && currentUser.uid !== 'espelho-rede-tvi-master' && currentUser.uid !== 'offline-editor';
    if (isCloudUser) {
      try {
        await deleteDoc(doc(db, 'agendas', id));
      } catch (err) {
        console.error('Firestore delete agenda error:', err);
      }
    }
  };

  const openNewEditor = () => {
    setEditingAgenda(null);
    setEvento('');
    // Default format "YYYY-MM-DDTHH:MM"
    const nowStr = new Date().toISOString().slice(0, 16);
    setDataHora(nowStr);
    setLocal('');
    setContato('');
    setDescricao('');
    setIsEditorOpen(true);
  };

  const openEditEditor = (a: Agenda) => {
    setEditingAgenda(a);
    setEvento(a.evento);
    setDataHora(a.dataHora);
    setLocal(a.local);
    setContato(a.contato);
    setDescricao(a.descricao);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingAgenda(null);
  };

  // Helper status calculation
  const getEventStatus = (dateTimeStr: string) => {
    const eventTime = new Date(dateTimeStr).getTime();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayEnd = new Date().setHours(23, 59, 59, 999);
    const timeNow = new Date().getTime();

    if (eventTime >= todayStart && eventTime <= todayEnd) {
      return { label: 'HOJE', color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' };
    } else if (eventTime > todayEnd) {
      return { label: 'FUTURO', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    } else {
      return { label: 'REALIZADO', color: 'bg-zinc-800 text-zinc-500 border border-zinc-700' };
    }
  };

  const filteredAgendas = agendas.filter(a => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch = a.evento.toLowerCase().includes(queryLower) || 
                          a.local.toLowerCase().includes(queryLower) ||
                          a.descricao.toLowerCase().includes(queryLower);
    
    const eventTime = new Date(a.dataHora).getTime();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const todayEnd = new Date().setHours(23, 59, 59, 999);

    if (timeFilter === 'hoje') {
      return matchesSearch && (eventTime >= todayStart && eventTime <= todayEnd);
    } else if (timeFilter === 'ativos') {
      return matchesSearch && (eventTime >= todayStart); // Today + Upcoming
    }
    return matchesSearch; // All
  });

  return (
    <div id="agendas-panel" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Agenda de Eventos
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Planejamento diário e monitoramento de compromissos jornalísticos e pautas.
          </p>
        </div>
        <button
          onClick={openNewEditor}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-440 active:scale-95 text-zinc-950 text-xs font-extrabold uppercase tracking-wide rounded-xl transition-all shadow-md select-none flex items-center justify-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Novo Evento
        </button>
      </div>

      {/* Row settings */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por evento, local, contato..."
            className="w-full bg-[#111113]/60 border border-zinc-800 text-xs px-10 py-2.5 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Time Filters */}
        <div className="flex bg-zinc-950 border border-zinc-850 p-1 rounded-xl scrollbar-none overflow-x-auto text-[11px] font-bold">
          {([
            { key: 'ativos', label: 'Futuros e Hoje' },
            { key: 'hoje', label: 'Hoje' },
            { key: 'todos', label: 'Ver Todos' }
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => setTimeFilter(item.key)}
              className={`px-4 py-1.5 rounded-lg uppercase tracking-wider transition-colors shrink-0 ${
                timeFilter === item.key
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          onClick={loadAgendas}
          className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-205 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs shrink-0"
          title="Recarregar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List Layout */}
      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 text-xs font-mono uppercase tracking-wider animate-pulse flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
          Carregando Agenda...
        </div>
      ) : filteredAgendas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#0f0f11]/20 p-12 text-center max-w-xl mx-auto my-4 space-y-4">
          <Calendar className="mx-auto w-10 h-10 text-zinc-600 stroke-[1.5]" />
          <div className="space-y-1">
            <h4 className="text-zinc-355 font-bold text-sm">Nenhum evento agendado</h4>
            <p className="text-zinc-555 text-xs max-w-xs mx-auto">
              {searchQuery
                ? 'Nenhum resultado corresponde à busca.'
                : 'Cadastre eventos jornalísticos, coletivas de imprensa ou transmissões para organizar a equipe neste painel.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={openNewEditor}
              className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-855 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-bold font-mono uppercase tracking-wider"
            >
              Agendar Compromisso
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredAgendas.map((age) => {
            const statusStyle = getEventStatus(age.dataHora);
            const dateObj = new Date(age.dataHora);
            const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return (
              <motion.div
                layout
                key={age.id}
                className="bg-[#121214] border border-zinc-850/50 hover:border-zinc-755 hover:bg-[#161619] rounded-xl p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all group relative"
              >
                {/* Left side: status badge, date & time, event title */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider ${statusStyle.color}`}>
                      {statusStyle.label}
                    </span>
                    <span className="text-zinc-700 font-mono text-xs">•</span>
                    <span className="text-zinc-400 text-[10px] font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      {formattedTime}h • {formattedDate}
                    </span>
                    {age.local && (
                      <>
                        <span className="text-zinc-700 font-mono text-xs">•</span>
                        <span className="text-zinc-400 text-[10px] font-mono flex items-center gap-1 uppercase tracking-wider">
                          <MapPin className="w-3 h-3 text-zinc-550 shrink-0" />
                          {age.local}
                        </span>
                      </>
                    )}
                    {age.contato && (
                      <>
                        <span className="text-zinc-700 font-mono text-xs">•</span>
                        <span className="text-zinc-400 text-[10px] font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-zinc-500" />
                          {age.contato}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-zinc-200 font-sans group-hover:text-amber-500/90 transition-colors">
                      {age.evento}
                    </h3>
                    {age.descricao && (
                      <p className="text-xs text-zinc-400 font-sans mt-0.5 line-clamp-1">
                        {age.descricao}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right side: Action row */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto pt-3.5 md:pt-0 border-t md:border-none border-zinc-850/40">
                  <button
                    onClick={() => setPrintItem(age)}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-amber-400 rounded-lg transition-colors border border-zinc-850 cursor-pointer"
                    title="Imprimir Compromisso"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openEditEditor(age)}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-amber-400 rounded-lg transition-colors border border-zinc-850"
                    title="Editar Compromisso"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(age.id)}
                    className="p-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-red-400 rounded-lg transition-colors border border-zinc-850"
                    title="Excluir Compromisso"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Editor Modal overlay */}
      <AnimatePresence>
        {isEditorOpen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-[#141416] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500" />

              <div className="p-5 border-b border-zinc-850 flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  {editingAgenda ? 'Editar Informações da Agenda' : 'Adicionar Novo Evento à Agenda'}
                </h3>
                <button
                  onClick={closeEditor}
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateOrUpdate} className="p-6 space-y-4">
                {/* Event Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Nome do Evento / Pauta Destino *</label>
                  <input
                    type="text"
                    required
                    value={evento}
                    onChange={(e) => setEvento(e.target.value)}
                    placeholder="Ex: Cerimônia de Abertura da Exposição de Artes"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* DateTime and Local */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Data e Horário *</label>
                    <input
                      type="datetime-local"
                      required
                      value={dataHora}
                      onChange={(e) => setDataHora(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Local / Endereço</label>
                    <input
                      type="text"
                      value={local}
                      onChange={(e) => setLocal(e.target.value)}
                      placeholder="Ex: Centro de Convenções, Estúdio A"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Assessores e Contatos */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Contato da Assessoria ou Organizadores</label>
                  <input
                    type="text"
                    value={contato}
                    onChange={(e) => setContato(e.target.value)}
                    placeholder="Ex: Assessora Joana (99) 99888-7766, joana@email.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Brief description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">Observações / Descrição da cobertura</label>
                  <textarea
                    rows={4}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Explique do que se trata ou coloque lembretes importantes para a entrega de equipes..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none font-sans"
                  />
                </div>

                <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-zinc-850">
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
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-440 active:scale-95 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md select-none flex items-center gap-1"
                  >
                    {syncStatus === 'saving' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>A salvar...</span>
                      </>
                    ) : (
                      <span>Gravar Compromisso</span>
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
              <h4 className="text-xs font-bold text-zinc-100 font-sans">Compromisso Salvo com Sucesso!</h4>
              <p className="text-[10px] text-zinc-450 font-sans">A agenda foi guardada e sincronizada com sucesso.</p>
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
              <h4 className="text-xs font-bold text-zinc-100 font-sans">Erro ao Salvar Agenda</h4>
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
              <span className="text-xs font-bold text-zinc-800 font-mono block" style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', display: 'block' }}>COMPROMISSO / AGENDA DIÁRIA</span>
              <span className="text-[10px] text-zinc-500 font-mono block" style={{ fontSize: '10px', color: '#777', fontFamily: 'monospace', display: 'block' }}>Impresso em: {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {/* Document Title */}
          <div className="mb-6" style={{ marginBottom: '1.5rem' }}>
            <h2 className="text-lg font-bold border-b border-black pb-2 text-black uppercase" style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid black', paddingBottom: '0.5rem', color: '#000', textTransform: 'uppercase' }}>{printItem.evento}</h2>
          </div>

          {/* Metadados Grid */}
          <div className="grid grid-cols-2 gap-4 border border-black p-4 rounded-lg mb-6 bg-zinc-50" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', border: '1px solid black', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', backgroundColor: '#f9f9f9' }}>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Data e Hora</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.dataHora ? new Date(printItem.dataHora).toLocaleString('pt-BR') : 'Não agendada'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Contato / Telefone</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.contato || 'Não cadastrado'}</span>
            </div>
            <div className="col-span-2" style={{ gridColumn: 'span 2' }}>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Local do Evento</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{printItem.local || 'Não informado'}</span>
            </div>
          </div>

          {/* Descrição / Detalhes */}
          <div className="mb-6" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 border-b border-zinc-200 pb-1" style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', borderBottom: '1px solid #ccc', paddingBottom: '0.25rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Descrição / Detalhes do Evento</h3>
            <p className="text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap" style={{ fontSize: '14px', color: '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{printItem.descricao || 'Nenhuma descrição adicionada.'}</p>
          </div>

          {/* Assinatura footer */}
          <div className="mt-20 pt-8 border-t border-dashed border-zinc-300 flex justify-between items-center text-[10px] text-zinc-400 font-mono" style={{ marginTop: '5rem', paddingTop: '2rem', borderTop: '1px dashed #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#777', fontFamily: 'monospace' }}>
            <span>REDE TVI JORNALISMO — SISTEMA DE COOPERATIVA DE NOTÍCIAS</span>
            <span>ASSINATURA DO ASSISTENTE: __________________________________</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
