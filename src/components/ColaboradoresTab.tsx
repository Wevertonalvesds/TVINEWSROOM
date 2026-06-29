import React, { useEffect, useState } from 'react';
import { db, collection, addDoc, deleteDoc, doc, query, onSnapshot } from '../firebase';
import { type User } from '../firebase';
import { Colaborador, ColaboradorFuncao, capitalizeName } from '../types';
import { 
  Users, 
  Plus, 
  Trash2, 
  Search, 
  UserPlus, 
  Briefcase, 
  RefreshCw,
  X,
  Check
} from 'lucide-react';

interface ColaboradoresTabProps {
  currentUser: User | null;
}

const FUNCOES: ColaboradorFuncao[] = [
  'Apresentador',
  'Repórter',
  'Produção',
  'Editor',
  'Cinegrafista',
  'Operador',
  'Demais funções'
];

export default function ColaboradoresTab({ currentUser }: ColaboradoresTabProps) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFuncaoFilter, setSelectedFuncaoFilter] = useState<string>('todos');

  // Form states
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState<ColaboradorFuncao>('Apresentador');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const LOCAL_COLAB_KEY = 'rede_tvi_colaboradores_v1';

  // Load colaboradores (real-time + fallback)
  useEffect(() => {
    setIsLoading(true);
    let loadedColabs: Colaborador[] = [];

    // Local Storage fallback first
    try {
      const localData = localStorage.getItem(LOCAL_COLAB_KEY);
      if (localData) {
        loadedColabs = JSON.parse(localData);
        loadedColabs.sort((a, b) => a.nome.localeCompare(b.nome));
        setColaboradores(loadedColabs);
      }
    } catch (e) {
      console.error('Error loading local colaboradores', e);
    }

    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    if (!isCloudUser) {
      setIsLoading(false);
      return;
    }

    const q = query(collection(db, 'colaboradores'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cloudColabs: Colaborador[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        cloudColabs.push({
          id: docSnap.id,
          nome: d.nome || '',
          funcao: (d.funcao as ColaboradorFuncao) || 'Demais funções',
          userId: d.userId || '',
          createdAt: d.createdAt || ''
        });
      });

      // Sort alphabetically by name
      cloudColabs.sort((a, b) => a.nome.localeCompare(b.nome));

      localStorage.setItem(LOCAL_COLAB_KEY, JSON.stringify(cloudColabs));
      setColaboradores(cloudColabs);
      setIsLoading(false);
    }, (error) => {
      console.error('Firestore real-time update error (colaboradores):', error);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  const handleAddColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setSyncStatus('saving');
    const nomeLimpo = capitalizeName(nome);

    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    const newId = Math.random().toString(36).substr(2, 9);
    const colabData: Colaborador = {
      id: newId,
      nome: nomeLimpo,
      funcao,
      userId: currentUser?.uid || 'offline-editor',
      createdAt: new Date().toISOString()
    };

    if (isCloudUser) {
      try {
        await addDoc(collection(db, 'colaboradores'), {
          nome: colabData.nome,
          funcao: colabData.funcao,
          userId: colabData.userId,
          createdAt: colabData.createdAt
        });
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (err) {
        console.error('Error adding colaborador to cloud:', err);
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 2000);
      }
    } else {
      const updated = [...colaboradores, colabData];
      updated.sort((a, b) => a.nome.localeCompare(b.nome));
      localStorage.setItem(LOCAL_COLAB_KEY, JSON.stringify(updated));
      setColaboradores(updated);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }

    setNome('');
    setFuncao('Apresentador');
  };

  const handleDeleteColaborador = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este colaborador do cadastro?')) {
      return;
    }

    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';

    if (isCloudUser) {
      try {
        await deleteDoc(doc(db, 'colaboradores', id));
      } catch (err) {
        console.error('Error deleting colaborador from cloud:', err);
      }
    } else {
      const updated = colaboradores.filter(c => c.id !== id);
      localStorage.setItem(LOCAL_COLAB_KEY, JSON.stringify(updated));
      setColaboradores(updated);
    }
  };

  // Filter list
  const filteredColaboradores = colaboradores.filter(colab => {
    const matchesSearch = colab.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          colab.funcao.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFuncao = selectedFuncaoFilter === 'todos' || colab.funcao === selectedFuncaoFilter;
    return matchesSearch && matchesFuncao;
  });

  const getRoleColorClass = (role: ColaboradorFuncao) => {
    switch (role) {
      case 'Apresentador':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'Repórter':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'Produção':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'Editor':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'Cinegrafista':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'Operador':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-900 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-display font-bold text-zinc-100 tracking-tight">
              Cadastro de Colaboradores
            </h1>
          </div>
          <p className="text-xs text-zinc-400 max-w-2xl font-sans leading-relaxed">
            Cadastre as pessoas e profissionais do estúdio para que fiquem disponíveis instantaneamente para seleção nos campos de Apresentador, Repórter, Produtor e demais áreas, mantendo o controle centralizado e sincronizado entre todos os usuários conectados em tempo real.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left column: Add form */}
        <div className="lg:col-span-1 bg-[#0f0f11]/40 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-300 font-display font-semibold text-sm">
            <UserPlus className="w-4 h-4 text-amber-500" />
            <span>Novo Colaborador</span>
          </div>

          <form onSubmit={handleAddColaborador} className="space-y-4">
            {/* Name Input */}
            <div className="space-y-1.5">
              <label htmlFor="colab-name" className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Nome do Colaborador
              </label>
              <input
                id="colab-name"
                type="text"
                required
                placeholder="Ex: WILLIAM BONNER"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full bg-[#141416]/90 border border-zinc-800 rounded-xl text-xs px-4 py-3 text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-sans uppercase"
              />
            </div>

            {/* Role/Function Dropdown */}
            <div className="space-y-1.5">
              <label htmlFor="colab-role" className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Função Principal
              </label>
              <select
                id="colab-role"
                value={funcao}
                onChange={(e) => setFuncao(e.target.value as ColaboradorFuncao)}
                className="w-full bg-[#141416]/90 border border-zinc-800 rounded-xl text-xs px-4 py-3 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer font-sans"
              >
                {FUNCOES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Add Button */}
            <button
              type="submit"
              disabled={syncStatus === 'saving' || !nome.trim()}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-650 text-zinc-950 font-extrabold text-xs uppercase tracking-wider py-3 px-4 rounded-xl shadow-lg hover:shadow-amber-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {syncStatus === 'saving' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : syncStatus === 'success' ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Cadastrado com sucesso!</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Cadastrar</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right column: Search, filters and list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome ou função..."
                className="w-full bg-[#111113]/60 border border-zinc-800 text-xs px-10 py-2.5 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex bg-zinc-950 border border-zinc-850 p-1 rounded-xl scrollbar-none overflow-x-auto text-[10px] font-bold">
              <button
                onClick={() => setSelectedFuncaoFilter('todos')}
                className={`px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors shrink-0 ${
                  selectedFuncaoFilter === 'todos'
                    ? 'bg-amber-500 text-zinc-950 font-black'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                Todos
              </button>
              {FUNCOES.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFuncaoFilter(f)}
                  className={`px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors shrink-0 ${
                    selectedFuncaoFilter === f
                      ? 'bg-amber-500 text-zinc-950 font-black'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* List area */}
          {isLoading ? (
            <div className="py-20 text-center text-zinc-500 text-xs font-mono uppercase tracking-wider animate-pulse flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              Carregando colaboradores...
            </div>
          ) : filteredColaboradores.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#0f0f11]/20 p-12 text-center max-w-xl mx-auto my-4 space-y-4">
              <Users className="mx-auto w-10 h-10 text-zinc-650 stroke-[1.5]" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-300">Nenhum colaborador encontrado</p>
                <p className="text-xs text-zinc-500">
                  {searchQuery || selectedFuncaoFilter !== 'todos'
                    ? 'Nenhum resultado corresponde aos filtros aplicados.'
                    : 'Cadastre o primeiro colaborador na barra lateral para começar.'}
                </p>
              </div>
              {(searchQuery || selectedFuncaoFilter !== 'todos') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedFuncaoFilter('todos');
                  }}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredColaboradores.map((colab) => (
                <div
                  key={colab.id}
                  className="group flex items-center justify-between bg-[#111113]/40 border border-zinc-800 hover:border-zinc-700/80 rounded-xl p-4 transition-all shadow-xs hover:shadow-md hover:shadow-black/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 shrink-0 text-zinc-400 font-display font-bold text-sm tracking-tighter uppercase">
                      {colab.nome.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-200 block truncate uppercase tracking-wide leading-tight">
                        {colab.nome}
                      </span>
                      <span className={`inline-block text-[9px] font-bold uppercase px-2 py-0.5 mt-1.5 rounded-full ${getRoleColorClass(colab.funcao)}`}>
                        {colab.funcao}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteColaborador(colab.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
                    title="Excluir Colaborador"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
