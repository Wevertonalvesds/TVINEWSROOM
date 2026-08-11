import React, { useEffect, useState } from 'react';
import { db, collection, addDoc, deleteDoc, doc, query, onSnapshot, setDoc, updateDoc } from '../firebase';
import { type User } from '../firebase';
import { Colaborador, ColaboradorFuncao, capitalizeName, isUserAdmin } from '../types';
import { 
  Users, 
  Plus, 
  Trash2, 
  Search, 
  UserPlus, 
  Briefcase, 
  RefreshCw,
  X,
  Check,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  Pencil
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

  const SYSTEM_MEMBERS_MAPPING = [
    { nome: 'Kaiky Almeida', email: 'kaikycardososp@gmail.com', funcao: 'Editor' as const, aliases: [] },
    { nome: 'Ana Luiza Lima', email: 'moonlighterstore@gmail.com', funcao: 'Produção' as const, aliases: [] },
    { nome: 'Rodrigo Rangel', email: 'franca.rodrigo1998@gmail.com', funcao: 'Repórter' as const, aliases: [] },
    { nome: 'Samuel Xavier', email: 'samcompop@outlook.com.br', funcao: 'Apresentador' as const, aliases: [] },
    { nome: 'Kauã Pereira', email: 'kauapereira.jrn@gmail.com', funcao: 'Cinegrafista' as const, aliases: [] },
    { nome: 'Miguel Ramalho', email: 'miguelramalhocastilho759@gmail.com', funcao: 'Operador' as const, aliases: [] },
    { nome: 'Weverton Souza', email: 'weverton.alvesdevetor@gmail.com', funcao: 'Apresentador' as const, aliases: [] },
    { nome: 'Luiz Cintra', email: 'luizphilipecintra210@gmail.com', funcao: 'Demais funções' as const, aliases: ['Philipe Cintra'] }
  ];

  const isAdmin = isUserAdmin(currentUser?.email) || !currentUser || currentUser.uid === 'offline-editor';
  const [isSyncingLogins, setIsSyncingLogins] = useState(false);

  const findMatchingColab = (systemName: string, aliases: string[] = []) => {
    const normalizedSystem = systemName.trim().toLowerCase();
    const normalizedAliases = (aliases || []).map(a => a.trim().toLowerCase());
    return colaboradores.find(c => {
      const name = (c.nome || '').trim().toLowerCase();
      return name === normalizedSystem || 
             normalizedAliases.includes(name) ||
             name.includes(normalizedSystem) || 
             normalizedSystem.includes(name);
    });
  };

  const pendingSyncCount = SYSTEM_MEMBERS_MAPPING.filter(sys => {
    const match = findMatchingColab(sys.nome, sys.aliases);
    return !match || !match.temLogin || match.emailAcesso !== sys.email;
  }).length;

  const handleSyncLogins = async () => {
    setIsSyncingLogins(true);
    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    let successCount = 0;
    
    try {
      for (const sys of SYSTEM_MEMBERS_MAPPING) {
        const match = findMatchingColab(sys.nome, sys.aliases);
        const emailLower = sys.email.toLowerCase().trim();
        
        const targetUserId = `member-${emailLower.replace(/[^a-zA-Z0-9]/g, '-')}`;
        
        if (match) {
          if (!match.temLogin || match.emailAcesso !== emailLower || !match.userId) {
            if (isCloudUser) {
              await updateDoc(doc(db, 'colaboradores', match.id), {
                emailAcesso: emailLower,
                temLogin: true,
                userId: targetUserId
              });
            }
            successCount++;
          }
        } else {
          const newId = `colab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          if (isCloudUser) {
            await setDoc(doc(db, 'colaboradores', newId), {
              nome: sys.nome,
              funcao: sys.funcao,
              emailAcesso: emailLower,
              temLogin: true,
              userId: targetUserId,
              createdAt: new Date().toISOString()
            });
          } else {
            const colabData: Colaborador = {
              id: newId,
              nome: sys.nome,
              funcao: sys.funcao,
              emailAcesso: emailLower,
              temLogin: true,
              userId: targetUserId,
              createdAt: new Date().toISOString()
            };
            const updated = [...colaboradores, colabData];
            localStorage.setItem(LOCAL_COLAB_KEY, JSON.stringify(updated));
            setColaboradores(updated);
          }
          successCount++;
        }
      }
      alert(`Sucesso! Sincronizados ${successCount} colaboradores com seus e-mails operacionais cadastrados.`);
    } catch (err) {
      console.error('Error syncing logins:', err);
      alert('Erro ao sincronizar logins de membros. Por favor, tente novamente.');
    } finally {
      setIsSyncingLogins(false);
    }
  };

  // Form states
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState<ColaboradorFuncao>('Apresentador');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Login credential states for the form
  const [criarLogin, setCriarLogin] = useState(false);
  const [loginUsuario, setLoginUsuario] = useState('');
  const [loginSenha, setLoginSenha] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Login credential states for the manage modal
  const [selectedColabForLogin, setSelectedColabForLogin] = useState<Colaborador | null>(null);
  const [modalLoginUsuario, setModalLoginUsuario] = useState('');
  const [modalLoginSenha, setModalLoginSenha] = useState('');
  const [modalShowPassword, setModalShowPassword] = useState(false);
  const [modalSyncStatus, setModalSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Edit collaborator states
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editFuncao, setEditFuncao] = useState<ColaboradorFuncao>('Apresentador');
  const [editSyncStatus, setEditSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Real-time credentials from Firestore
  const [credentials, setCredentials] = useState<Record<string, { email: string; password: string }>>({});

  const LOCAL_COLAB_KEY = 'rede_tvi_colaboradores_v1';

  // Helper to normalize login email/user exactly like AuthScreen does
  const getNormalizedLoginId = (emailOrUser: string) => {
    let target = emailOrUser.trim();
    if (!target.includes('@')) {
      target = `${target.toLowerCase()}@redetvi.com`;
    }
    return target.toLowerCase().trim();
  };

  // Sync credentials in real-time
  useEffect(() => {
    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    if (!isCloudUser) return;

    const q = query(collection(db, 'credenciais'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const creds: Record<string, { email: string; password: string }> = {};
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const id = docSnap.id.toLowerCase().trim();
        creds[id] = {
          email: d.email || '',
          password: d.password || ''
        };
      });
      setCredentials(creds);
    }, (error) => {
      console.error('Error listening to credentials collection:', error);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Load colaboradores (real-time + fallback)
  useEffect(() => {
    setIsLoading(true);
    let loadedColabs: Colaborador[] = [];

    // Local Storage fallback first
    try {
      const localData = localStorage.getItem(LOCAL_COLAB_KEY);
      if (localData) {
        const parsed = JSON.parse(localData);
        const seenNames = new Set<string>();
        parsed.forEach((c: Colaborador) => {
          const key = (c.nome || '').trim().toLowerCase();
          if (key && !seenNames.has(key)) {
            seenNames.add(key);
            loadedColabs.push(c);
          }
        });
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
      const seenNames = new Set<string>();

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const rawName = (d.nome || '').trim();
        const key = rawName.toLowerCase();
        if (rawName && !seenNames.has(key)) {
          seenNames.add(key);
          cloudColabs.push({
            id: docSnap.id,
            nome: rawName,
            funcao: (d.funcao as ColaboradorFuncao) || 'Demais funções',
            userId: d.userId || '',
            createdAt: d.createdAt || '',
            emailAcesso: d.emailAcesso || undefined,
            temLogin: d.temLogin || false
          });
        }
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

    const nomeLimpo = capitalizeName(nome);

    // Prevent duplicate collaborator
    const alreadyExists = colaboradores.some(
      c => c.nome.trim().toLowerCase() === nomeLimpo.trim().toLowerCase()
    );
    if (alreadyExists) {
      alert('Já existe um colaborador cadastrado com esse nome!');
      setSyncStatus('idle');
      return;
    }

    // Validate login details if active
    if (criarLogin) {
      if (!loginUsuario.trim() || !loginSenha.trim()) {
        alert('Por favor, preencha o Usuário/E-mail e a Senha para o login!');
        return;
      }
      if (loginSenha.length < 6) {
        alert('A senha deve conter no mínimo 6 caracteres.');
        return;
      }
      const loginId = getNormalizedLoginId(loginUsuario);
      if (credentials[loginId]) {
        alert('Esse Nome de Usuário ou E-mail já está em uso para login!');
        return;
      }
    }

    setSyncStatus('saving');

    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    const newId = Math.random().toString(36).substr(2, 9);
    
    const colabEmail = criarLogin ? getNormalizedLoginId(loginUsuario) : undefined;
    const colabUserId = colabEmail 
      ? `member-${colabEmail.replace(/[^a-zA-Z0-9]/g, '-')}` 
      : '';

    const colabData: Colaborador & { emailAcesso?: string; temLogin?: boolean } = {
      id: newId,
      nome: nomeLimpo,
      funcao,
      userId: colabUserId,
      createdAt: new Date().toISOString(),
      emailAcesso: colabEmail,
      temLogin: criarLogin ? true : false
    };

    if (isCloudUser) {
      try {
        await addDoc(collection(db, 'colaboradores'), {
          nome: colabData.nome,
          funcao: colabData.funcao,
          userId: colabData.userId,
          createdAt: colabData.createdAt,
          emailAcesso: colabData.emailAcesso || null,
          temLogin: colabData.temLogin || false
        });

        if (criarLogin) {
          const loginId = getNormalizedLoginId(loginUsuario);
          await setDoc(doc(db, 'credenciais', loginId), {
            email: loginUsuario.includes('@') ? loginUsuario.trim() : `${loginUsuario.trim().toLowerCase()}@redetvi.com`,
            password: loginSenha,
            updatedAt: new Date().toISOString()
          });
        }

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
    setCriarLogin(false);
    setLoginUsuario('');
    setLoginSenha('');
  };

  const handleDeleteColaborador = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este colaborador do cadastro?')) {
      return;
    }

    const colab = colaboradores.find(c => c.id === id);
    const loginId = colab ? (colab as any).emailAcesso : null;

    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';

    if (isCloudUser) {
      try {
        if (loginId) {
          try {
            await deleteDoc(doc(db, 'credenciais', loginId));
          } catch (e) {
            console.warn("Could not delete credentials, maybe it didn't exist:", e);
          }
        }
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

  const handleSaveEditColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingColaborador || !editNome.trim()) return;

    const cleanName = capitalizeName(editNome);
    
    // Prevent duplicate name if name changed and matches another collaborator
    if (cleanName.trim().toLowerCase() !== editingColaborador.nome.trim().toLowerCase()) {
      const alreadyExists = colaboradores.some(
        c => c.nome.trim().toLowerCase() === cleanName.trim().toLowerCase() && c.id !== editingColaborador.id
      );
      if (alreadyExists) {
        alert('Já existe outro colaborador cadastrado com esse nome!');
        return;
      }
    }

    setEditSyncStatus('saving');
    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';

    if (isCloudUser) {
      try {
        await updateDoc(doc(db, 'colaboradores', editingColaborador.id), {
          nome: cleanName,
          funcao: editFuncao
        });
        setEditSyncStatus('success');
        setTimeout(() => {
          setEditSyncStatus('idle');
          setEditingColaborador(null);
        }, 1000);
      } catch (err) {
        console.error('Error updating collaborator:', err);
        setEditSyncStatus('error');
        setTimeout(() => setEditSyncStatus('idle'), 2000);
      }
    } else {
      const updated = colaboradores.map(c => 
        c.id === editingColaborador.id 
          ? { ...c, nome: cleanName, funcao: editFuncao } 
          : c
      );
      updated.sort((a, b) => a.nome.localeCompare(b.nome));
      localStorage.setItem(LOCAL_COLAB_KEY, JSON.stringify(updated));
      setColaboradores(updated);
      setEditSyncStatus('success');
      setTimeout(() => {
        setEditSyncStatus('idle');
        setEditingColaborador(null);
      }, 1000);
    }
  };

  const handleSaveLoginModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColabForLogin) return;
    if (!modalLoginUsuario.trim() || !modalLoginSenha.trim()) {
      alert('Por favor, preencha o login e a senha.');
      return;
    }
    if (modalLoginSenha.length < 6) {
      alert('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setModalSyncStatus('saving');
    const loginId = getNormalizedLoginId(modalLoginUsuario);
    const hasExistingLogin = !!(selectedColabForLogin as any).emailAcesso;

    // Check if duplicate for a different user
    if (!hasExistingLogin || (selectedColabForLogin as any).emailAcesso !== loginId) {
      if (credentials[loginId]) {
        alert('Este usuário ou e-mail já está sendo usado por outra credencial!');
        setModalSyncStatus('idle');
        return;
      }
    }

    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    if (isCloudUser) {
      try {
        // If they had a different username before, delete the old document
        if (hasExistingLogin && (selectedColabForLogin as any).emailAcesso !== loginId) {
          await deleteDoc(doc(db, 'credenciais', (selectedColabForLogin as any).emailAcesso));
        }

        // Set the credential
        await setDoc(doc(db, 'credenciais', loginId), {
          email: modalLoginUsuario.includes('@') ? modalLoginUsuario.trim() : `${modalLoginUsuario.trim().toLowerCase()}@redetvi.com`,
          password: modalLoginSenha,
          updatedAt: new Date().toISOString()
        });

        // Update collaborator
        const targetUserId = `member-${loginId.replace(/[^a-zA-Z0-9]/g, '-')}`;
        await updateDoc(doc(db, 'colaboradores', selectedColabForLogin.id), {
          emailAcesso: loginId,
          temLogin: true,
          userId: targetUserId
        });

        setModalSyncStatus('success');
        setTimeout(() => {
          setModalSyncStatus('idle');
          setSelectedColabForLogin(null);
        }, 1500);
      } catch (err) {
        console.error('Error saving credential via modal:', err);
        setModalSyncStatus('error');
        setTimeout(() => setModalSyncStatus('idle'), 2000);
      }
    } else {
      // Offline fallback
      const targetUserId = `member-${loginId.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const updated = colaboradores.map(c => {
        if (c.id === selectedColabForLogin.id) {
          return {
            ...c,
            emailAcesso: loginId,
            temLogin: true,
            userId: targetUserId
          };
        }
        return c;
      });
      localStorage.setItem(LOCAL_COLAB_KEY, JSON.stringify(updated));
      setColaboradores(updated);
      setModalSyncStatus('success');
      setTimeout(() => {
        setModalSyncStatus('idle');
        setSelectedColabForLogin(null);
      }, 1500);
    }
  };

  const handleRemoveLogin = async () => {
    if (!selectedColabForLogin) return;
    const loginId = (selectedColabForLogin as any).emailAcesso;
    if (!loginId) return;

    if (!window.confirm(`Tem certeza que deseja remover as credenciais de login de ${selectedColabForLogin.nome}? Ele não poderá mais acessar o sistema.`)) {
      return;
    }

    setModalSyncStatus('saving');
    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    if (isCloudUser) {
      try {
        await deleteDoc(doc(db, 'credenciais', loginId));
        await updateDoc(doc(db, 'colaboradores', selectedColabForLogin.id), {
          emailAcesso: null,
          temLogin: false
        });
        setModalSyncStatus('success');
        setTimeout(() => {
          setModalSyncStatus('idle');
          setSelectedColabForLogin(null);
        }, 1500);
      } catch (err) {
        console.error('Error deleting credential:', err);
        setModalSyncStatus('error');
        setTimeout(() => setModalSyncStatus('idle'), 2000);
      }
    } else {
      // Offline fallback
      const updated = colaboradores.map(c => {
        if (c.id === selectedColabForLogin.id) {
          const copy = { ...c };
          delete copy.emailAcesso;
          copy.temLogin = false;
          return copy;
        }
        return c;
      });
      localStorage.setItem(LOCAL_COLAB_KEY, JSON.stringify(updated));
      setColaboradores(updated);
      setModalSyncStatus('success');
      setTimeout(() => {
        setModalSyncStatus('idle');
        setSelectedColabForLogin(null);
      }, 1500);
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

      {isAdmin && pendingSyncCount > 0 && (
        <div className="bg-[#111113]/60 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn no-print">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 uppercase tracking-wider font-mono">
              <Sparkles className="w-3.5 h-3.5 animate-pulse shrink-0" />
              Sincronização de Logins Cadastrados
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed max-w-xl font-sans">
              Identificamos <strong>{pendingSyncCount} membro(s) cadastrado(s)</strong> no sistema que ainda não possuem seus e-mails de login associados no cadastro de colaboradores. Clique ao lado para vinculá-los automaticamente.
            </p>
          </div>
          <button
            onClick={handleSyncLogins}
            disabled={isSyncingLogins}
            className="shrink-0 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md hover:shadow-amber-500/10"
          >
            {isSyncingLogins ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sincronizando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Vincular Logins</span>
              </>
            )}
          </button>
        </div>
      )}

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

            {/* Create login toggle */}
            <div className="space-y-3 pt-2 border-t border-zinc-900/60">
              <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={criarLogin}
                  onChange={(e) => setCriarLogin(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-800 bg-[#141416] text-amber-500 focus:ring-amber-500/20 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors">
                  🔑 Criar credencial de acesso
                </span>
              </label>

              {criarLogin && (
                <div className="space-y-3 p-3 bg-zinc-950/60 border border-zinc-850 rounded-xl animate-fadeIn">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      Usuário ou E-mail
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: philipe.cintra ou email@gmail.com"
                      value={loginUsuario}
                      onChange={(e) => setLoginUsuario(e.target.value)}
                      className="w-full bg-[#111113] border border-zinc-850 rounded-lg text-xs px-3 py-2 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-sans"
                    />
                    <p className="text-[8px] text-zinc-500 leading-tight">
                      Se digitar apenas o nome, o login será &apos;nome@redetvi.com&apos;, mas o usuário poderá digitar apenas o nome para entrar.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                      Senha Operacional
                    </label>
                    <div className="relative">
                      <input
                        type={showFormPassword ? "text" : "password"}
                        required
                        placeholder="Mínimo 6 caracteres"
                        value={loginSenha}
                        onChange={(e) => setLoginSenha(e.target.value)}
                        className="w-full bg-[#111113] border border-zinc-850 rounded-lg text-xs px-3 py-2 pr-9 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 cursor-pointer"
                      >
                        {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
            <div className="flex flex-col">
              {filteredColaboradores.map((colab) => (
                <div
                  key={colab.id}
                  className="group flex items-center justify-between bg-transparent border-b border-zinc-850/50 hover:bg-[#111113]/30 py-3.5 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 shrink-0 text-zinc-400 font-display font-bold text-sm tracking-tighter uppercase">
                      {colab.nome.substring(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-zinc-200 block truncate uppercase tracking-wide leading-tight">
                        {colab.nome}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className={`inline-block text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${getRoleColorClass(colab.funcao)}`}>
                          {colab.funcao}
                        </span>
                        {(colab as any).temLogin && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" title={(colab as any).emailAcesso}>
                            <Key className="w-2.5 h-2.5 shrink-0" />
                            Login Ativo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingColaborador(colab);
                        setEditNome(colab.nome);
                        setEditFuncao(colab.funcao);
                        setEditSyncStatus('idle');
                      }}
                      className="p-2 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                      title="Editar Nome ou Função"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setSelectedColabForLogin(colab);
                        const userEmail = (colab as any).emailAcesso || colab.nome.toLowerCase().replace(/\s+/g, '.');
                        setModalLoginUsuario(userEmail);
                        const existingPass = (colab as any).emailAcesso ? (credentials[getNormalizedLoginId((colab as any).emailAcesso)]?.password || '') : '';
                        setModalLoginSenha(existingPass || 'tvi2026');
                        setModalShowPassword(false);
                      }}
                      className="p-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all cursor-pointer"
                      title={(colab as any).temLogin ? "Gerenciar Login / Alterar Senha" : "Criar Login de Acesso"}
                    >
                      <Key className={`w-3.5 h-3.5 ${(colab as any).temLogin ? 'text-indigo-400' : ''}`} />
                    </button>

                    <button
                      onClick={() => handleDeleteColaborador(colab.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
                      title="Excluir Colaborador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manage Login Modal */}
      {selectedColabForLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs select-none no-print">
          <div className="w-full max-w-md bg-[#0f0f11] border border-zinc-800 rounded-2xl shadow-2xl p-6 relative space-y-4 animate-in fade-in duration-200">
            {/* Close Button */}
            <button
              onClick={() => setSelectedColabForLogin(null)}
              className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-zinc-350 hover:bg-zinc-900 rounded-lg transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title / Header */}
            <div className="flex items-center gap-3 border-b border-zinc-900 pb-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-150">
                  {(selectedColabForLogin as any).temLogin ? 'Gerenciar Credenciais' : 'Criar Login de Acesso'}
                </h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Membro: {selectedColabForLogin.nome}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveLoginModal} className="space-y-4">
              {/* Login Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Nome de Usuário ou E-mail
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: nome.sobrenome ou email@gmail.com"
                  value={modalLoginUsuario}
                  onChange={(e) => setModalLoginUsuario(e.target.value)}
                  disabled={!!(selectedColabForLogin as any).temLogin}
                  className="w-full bg-[#141416]/90 disabled:bg-[#141416]/50 disabled:text-zinc-650 disabled:border-zinc-900 border border-zinc-800 rounded-xl text-xs px-4 py-3 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {!(selectedColabForLogin as any).temLogin && (
                  <p className="text-[8px] text-zinc-500 leading-tight">
                    Se digitar apenas um nome (sem @), o login gerado será &apos;{modalLoginUsuario || 'nome'}@redetvi.com&apos;. O usuário poderá logar digitando apenas o nome.
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <input
                    type={modalShowPassword ? "text" : "password"}
                    required
                    placeholder="Mínimo de 6 caracteres"
                    value={modalLoginSenha}
                    onChange={(e) => setModalLoginSenha(e.target.value)}
                    className="w-full bg-[#141416]/90 border border-zinc-800 rounded-xl text-xs px-4 py-3 pr-11 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setModalShowPassword(!modalShowPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350 cursor-pointer"
                  >
                    {modalShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-zinc-900/60">
                <button
                  type="submit"
                  disabled={modalSyncStatus === 'saving'}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {modalSyncStatus === 'saving' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : modalSyncStatus === 'success' ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Salvo!</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{(selectedColabForLogin as any).temLogin ? 'Atualizar Senha' : 'Criar Credencial'}</span>
                    </>
                  )}
                </button>

                {(selectedColabForLogin as any).temLogin && (
                  <button
                    type="button"
                    disabled={modalSyncStatus === 'saving'}
                    onClick={handleRemoveLogin}
                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-extrabold text-xs uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Remover Login
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Collaborator Modal */}
      {editingColaborador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs select-none no-print">
          <div className="w-full max-w-md bg-[#0f0f11] border border-zinc-800 rounded-2xl shadow-2xl p-6 relative space-y-4 animate-in fade-in duration-200">
            {/* Close Button */}
            <button
              onClick={() => setEditingColaborador(null)}
              className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-zinc-350 hover:bg-zinc-900 rounded-lg transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Title / Header */}
            <div className="flex items-center gap-3 border-b border-zinc-900 pb-3">
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
                <Pencil className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-150">
                  Editar Cadastro de Colaborador
                </h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Atualize os dados operacionais do profissional.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEditColaborador} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome do colaborador"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full bg-[#141416]/90 border border-zinc-800 rounded-xl text-xs px-4 py-3 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans uppercase"
                />
              </div>

              {/* Function */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Função Principal
                </label>
                <select
                  value={editFuncao}
                  onChange={(e) => setEditFuncao(e.target.value as ColaboradorFuncao)}
                  className="w-full bg-[#141416]/90 border border-zinc-800 rounded-xl text-xs px-4 py-3 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer font-sans"
                >
                  {FUNCOES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t border-zinc-900/60">
                <button
                  type="button"
                  onClick={() => setEditingColaborador(null)}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  disabled={editSyncStatus === 'saving'}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {editSyncStatus === 'saving' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : editSyncStatus === 'success' ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Salvo!</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Salvar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
