import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import { AlertTriangle, Printer, Trash2, X, ExternalLink, FolderX, Plus, ClipboardList, Film, Calendar, Sliders, Presentation, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Block, Lauda, ProgramState, RegisteredProgram, Colaborador } from './types';
import Header from './components/Header';
import ProgramInfo from './components/ProgramInfo';
import BlockItem from './components/BlockItem';
import LaudaModal from './components/LaudaModal';
import TeleprompterPlayer from './components/TeleprompterPlayer';
import CloudSyncPanel from './components/CloudSyncPanel';
import ChangePasswordModal from './components/ChangePasswordModal';
import ColaboradoresTab from './components/ColaboradoresTab';
import { auth, googleAuth, onAuthStateChanged, signOut, type User, db, updateDoc, doc, getDoc, getDocs, addDoc, deleteDoc, query, where, collection, onSnapshot } from './firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { mergeProgramState } from './utils/merge';

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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
import AuthScreen from './components/AuthScreen';
import PautasTab from './components/PautasTab';
import ReportagensTab from './components/ReportagensTab';
import AgendasTab from './components/AgendasTab';
// @ts-ignore
import logoCor from '../assets/.aistudio/logo cor.png';

// Local storage key for persistent saving
const LOCAL_STORAGE_KEY = 'rede_tvi_espelho_state_v1';

// Format seconds into HH:MM:SS string
export function formatarSegundosEmHHMMSS(segundos: number): string {
  const isNegative = segundos < 0;
  const absSecs = Math.abs(segundos);
  const h = Math.floor(absSecs / 3600);
  const m = Math.floor((absSecs % 3600) / 60);
  const s = absSecs % 60;
  
  const hStr = h.toString().padStart(2, '0');
  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');
  
  return `${isNegative ? '-' : ''}${hStr}:${mStr}:${sStr}`;
}

// Convert HH:MM:SS, MM:SS, or SS formats back to number of seconds
export function parseHHMMSSToSeconds(hhmmss: string): number {
  if (!hhmmss) return 0;
  const cleaned = hhmmss.trim();
  const parts = cleaned.split(':').map(p => {
    const parsed = parseInt(p, 10);
    return isNaN(parsed) ? 0 : parsed;
  });

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

// Generates a unique short ID for client-side keys
const generateId = () => Math.random().toString(36).substring(2, 9);

// Clean empty slate for the program creation
const initialProgramState: ProgramState = {
  nomePrograma: '',
  tempoPrograma: '00:00:00',
  dataPrograma: '',
  blocos: []
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const cachedUser = sessionStorage.getItem('rede_tvi_session_user');
    return cachedUser ? JSON.parse(cachedUser) : null;
  });
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const u = { uid: user.uid, email: user.email };
        setCurrentUser(u as any);
        sessionStorage.setItem('rede_tvi_session_user', JSON.stringify(u));
      } else {
        const cachedUserStr = sessionStorage.getItem('rede_tvi_session_user');
        if (cachedUserStr) {
          const cachedUser = JSON.parse(cachedUserStr);
          if (
            cachedUser.uid === 'espelho-rede-tvi-master' || 
            cachedUser.uid === 'offline-editor' || 
            cachedUser.isBypass ||
            cachedUser.uid.startsWith('member-')
          ) {
            setCurrentUser(cachedUser);
          } else {
            setCurrentUser(null);
            sessionStorage.removeItem('rede_tvi_session_user');
          }
        } else {
          setCurrentUser(null);
        }
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = () => {
    sessionStorage.removeItem('rede_tvi_session_user');
    signOut(auth).then(() => {
      setCurrentUser(null);
    }).catch(() => {
      setCurrentUser(null);
    });
  };

  const [state, setState] = useState<ProgramState>(initialProgramState);
  const baseStateRef = useRef<ProgramState | null>(null);
  
  const [activeCloudDocId, setActiveCloudDocId] = useState<string | null>(() => {
    return sessionStorage.getItem('rede_tvi_active_cloud_doc_id');
  });

  const [registeredPrograms, setRegisteredPrograms] = useState<RegisteredProgram[]>([]);

  // Load registered programs inside cloud space or defaults on mount/user login
  useEffect(() => {
    const fetchRegistered = async () => {
      let progs: RegisteredProgram[] = [
        { id: '1', name: 'TVI NOTÍCIAS' },
        { id: '2', name: 'TVI GEEK' },
        { id: '3', name: 'MIX TVI' },
        { id: '4', name: 'RAMALHO TALK SHOW' },
        { id: '5', name: 'MELODIA TVI' },
        { id: '6', name: 'TVI SPORTS' },
        { id: '7', name: 'TVI ELEIÇÕES' },
        { id: '8', name: 'TVI FUN' },
        { id: '9', name: 'LINK TVI' },
      ];

      const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
      if (!isCloudUser) {
        setRegisteredPrograms(progs);
        return;
      }

      try {
        const q = query(
          collection(db, 'registered_programs')
        );
        const snap = await getDocs(q);
        const cloudProgs: RegisteredProgram[] = [];
        const seenNames = new Set<string>();
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const name = d ? (d as any).name || '' : '';
          const upperName = name.trim().toUpperCase();
          if (upperName && !seenNames.has(upperName)) {
            seenNames.add(upperName);
            cloudProgs.push({
              id: docSnap.id,
              name: name,
            });
          }
        });

        if (cloudProgs.length === 0) {
          // Initialize empty cloud space with the 9 mandatory TVI programs
          const defaultNames = [
            'TVI NOTÍCIAS', 'TVI GEEK', 'MIX TVI', 'RAMALHO TALK SHOW',
            'MELODIA TVI', 'TVI SPORTS', 'TVI ELEIÇÕES', 'TVI FUN', 'LINK TVI'
          ];
          const results: RegisteredProgram[] = [];
          for (const name of defaultNames) {
            const docRef = await addDoc(collection(db, 'registered_programs'), {
              name,
              userId: currentUser.uid,
              createdAt: new Date().toISOString()
            });
            results.push({
              id: docRef.id,
              name
            });
          }
          setRegisteredPrograms(results);
        } else {
          cloudProgs.sort((a, b) => a.name.localeCompare(b.name));
          setRegisteredPrograms(cloudProgs);
        }
      } catch (err) {
        console.error('Error loading registered programs from firestore:', err);
      }
    };

    fetchRegistered();
  }, [currentUser]);

  const handleAddRegisteredProgram = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (registeredPrograms.some(p => p.name.toUpperCase() === trimmed.toUpperCase())) {
      alert('Este programa já está cadastrado!');
      return;
    }

    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';

    try {
      if (isCloudUser) {
        const docRef = await addDoc(collection(db, 'registered_programs'), {
          name: trimmed,
          userId: currentUser.uid,
          createdAt: new Date().toISOString()
        });
        const nProg: RegisteredProgram = {
          id: docRef.id,
          name: trimmed
        };
        setRegisteredPrograms(prev => [...prev, nProg].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const nProg: RegisteredProgram = {
          id: Math.random().toString(),
          name: trimmed
        };
        setRegisteredPrograms(prev => [...prev, nProg].sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) {
      console.error('Error registering program:', err);
    }
  };

  const handleDeleteRegisteredProgram = async (id: string) => {
    if (!window.confirm('Excluir este programa dos cadastrados?')) return;
    
    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';

    try {
      if (isCloudUser) {
        await deleteDoc(doc(db, 'registered_programs', id));
      }
      setRegisteredPrograms(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting registered program:', err);
    }
  };

  // Keep latest cloud version synced in real-time
  useEffect(() => {
    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    if (!isCloudUser || !activeCloudDocId) {
      baseStateRef.current = null;
      return;
    }

    const docRef = doc(db, 'programs', activeCloudDocId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        // Se o cliente local tiver alterações pendentes no nível do Firestore, evitamos sobrescrever.
        if (docSnap.metadata.hasPendingWrites) {
          return;
        }

        const d = docSnap.data();
        const cloudNome = d.nomePrograma || '';
        const cloudTempo = d.tempoPrograma || '00:00:00';
        const cloudData = d.dataPrograma || '';
        const cloudBlocos = d.blocos || [];

        const cloudState: ProgramState = {
          nomePrograma: cloudNome,
          tempoPrograma: cloudTempo,
          dataPrograma: cloudData,
          blocos: cloudBlocos
        };

        setState(prevState => {
          const isSame = 
            prevState.nomePrograma === cloudNome &&
            prevState.tempoPrograma === cloudTempo &&
            prevState.dataPrograma === cloudData &&
            JSON.stringify(prevState.blocos) === JSON.stringify(cloudBlocos);

          if (isSame) {
            baseStateRef.current = cloudState;
            return prevState;
          }

          if (baseStateRef.current === null) {
            // Carga inicial do programa: define tanto o estado atual quanto o base
            baseStateRef.current = cloudState;
            return cloudState;
          }

          // Mescla alterações locais com as da nuvem usando o baseState como ancestral comum
          const merged = mergeProgramState(prevState, cloudState, baseStateRef.current);
          
          // Atualiza a referência de base para o estado recebido da nuvem
          baseStateRef.current = cloudState;
          return merged;
        });
      }
    }, (error) => {
      console.error('Error listening to real-time program updates:', error);
      try {
        handleFirestoreError(error, OperationType.GET, `programs/${activeCloudDocId}`);
      } catch (e) {}
    });

    return () => {
      unsubscribe();
    };
  }, [activeCloudDocId, currentUser]);

  useEffect(() => {
    if (activeCloudDocId) {
      sessionStorage.setItem('rede_tvi_active_cloud_doc_id', activeCloudDocId);
    } else {
      sessionStorage.removeItem('rede_tvi_active_cloud_doc_id');
    }
  }, [activeCloudDocId]);

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);

  // Real-time synchronization of colaboradores list for dropdown menus
  useEffect(() => {
    let loadedColabs: Colaborador[] = [];
    const LOCAL_COLAB_KEY = 'rede_tvi_colaboradores_v1';
    
    try {
      const local = localStorage.getItem(LOCAL_COLAB_KEY);
      if (local) {
        loadedColabs = JSON.parse(local);
        setColaboradores(loadedColabs);
      }
    } catch (e) {
      console.error('Error loading local colaboradores in App', e);
    }

    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    if (!isCloudUser) return;

    const q = query(collection(db, 'colaboradores'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cloudColabs: Colaborador[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        cloudColabs.push({
          id: docSnap.id,
          nome: d.nome || '',
          funcao: d.funcao || 'Demais funções',
          userId: d.userId || '',
          createdAt: d.createdAt || ''
        });
      });
      cloudColabs.sort((a, b) => a.nome.localeCompare(b.nome));
      localStorage.setItem(LOCAL_COLAB_KEY, JSON.stringify(cloudColabs));
      setColaboradores(cloudColabs);
    }, (error) => {
      console.error('Firestore real-time update error (colaboradores in App):', error);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [isPrintingEspelho, setIsPrintingEspelho] = useState(false);

  useEffect(() => {
    if (isPrintingEspelho) {
      document.body.classList.add('printing-item');
      
      const handleAfterPrint = () => {
        setIsPrintingEspelho(false);
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
  }, [isPrintingEspelho]);

  // Track active navigation tab
  const [activeTab, setActiveTab] = useState<'pautas' | 'reportagens' | 'espelhos' | 'agendas' | 'teleprompter' | 'colaboradores'>(() => {
    return (localStorage.getItem('rede_tvi_active_tab') as any) || 'espelhos';
  });

  useEffect(() => {
    localStorage.setItem('rede_tvi_active_tab', activeTab);
  }, [activeTab]);

  // Google OAuth Drive integration state and handlers
  const [googleToken, setGoogleToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('rede_tvi_google_token') : null;
  });

  const handleGoogleConnect = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');

      const result = await signInWithPopup(googleAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (!token) {
        throw new Error('Não foi possível obter o Token de Acesso da API Google.');
      }

      localStorage.setItem('rede_tvi_google_token', token);
      setGoogleToken(token);
      
      // Emit event to update any active Google Drive modals in the viewport
      window.dispatchEvent(new Event('rede_tvi_google_connected'));
    } catch (err: any) {
      console.error("Google Authentication Error:", err);
      if (err.code !== 'auth/popup-closed-by-user') {
        alert("Erro ao conectar ao Google: " + (err.message || err.code));
      }
    }
  };

  const handleGoogleDisconnect = () => {
    localStorage.removeItem('rede_tvi_google_token');
    setGoogleToken(null);
    window.dispatchEvent(new Event('rede_tvi_google_connected'));
  };

  // Sync state if connected from inside GoogleDriveModal
  useEffect(() => {
    const handleGoogleUpdate = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('rede_tvi_google_token') : null;
      setGoogleToken(token);
    };

    window.addEventListener('rede_tvi_google_connected', handleGoogleUpdate);
    return () => {
      window.removeEventListener('rede_tvi_google_connected', handleGoogleUpdate);
    };
  }, []);

  // Modal editor tracking
  const [laudaEditorState, setLaudaEditorState] = useState<{
    isOpen: boolean;
    blockId: string;
    lauda: Lauda | null;
  }>({
    isOpen: false,
    blockId: '',
    lauda: null,
  });

  // Teleprompter projection active state
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);

  // Change password modal state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Custom UI modal for Block deletion confirmation instead of window.confirm
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);

  // Custom UI modal for print guidance inside iframe environment
  const [isPrintAdviceOpen, setIsPrintAdviceOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expose load capability on window to interconnect clean JSON load callbacks from ProgramInfo
  useEffect(() => {
    (window as any).__loadStateCallback = (loadedData: any) => {
      try {
        const nomePrograma = loadedData.nomePrograma || '';
        const tempoPrograma = loadedData.tempoPrograma || '00:30:00';
        const rawBlocos = Array.isArray(loadedData.blocos) ? loadedData.blocos : [];
        
        const blocos: Block[] = rawBlocos.map((b: any, bIdx: number) => {
          const tipo = b.tipo === 'comercial' ? 'comercial' : 'normal';
          const rawLaudas = Array.isArray(b.laudas) ? b.laudas : [];
          
          const laudas: Lauda[] = rawLaudas.map((l: any) => ({
            id: l.id || generateId(),
            materia: l.materia || '',
            duracao: l.duracao || '',
            tipo: l.tipo || 'VT',
            apresentador: l.apresentador || '',
            laudaContent: l.laudaContent || '',
            driveLink: l.driveLink || ''
          }));

          return {
            id: b.id || generateId(),
            tipo,
            titulo: b.titulo || (tipo === 'comercial' ? 'Intervalo' : `Bloco ${bIdx + 1}`),
            laudas
          };
        });

        const nextState: ProgramState = { nomePrograma, tempoPrograma, blocos };
        setState(nextState);
      } catch (error) {
        alert('Formato de arquivo inválido. Certifique-se de que o conteúdo é um JSON válido de Espelho.');
      }
    };

    return () => {
      delete (window as any).__loadStateCallback;
    };
  }, []);

  // Save changes to LocalStorage whenever state changes (always keep a local copy as a fail-safe backup!)
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Automatic cloud saving & synchronizing for the active espelho/roteiro (programs collection)
  useEffect(() => {
    const isCloudUser = currentUser && currentUser.uid !== 'offline-editor';
    if (!isCloudUser) return;
    if (!activeCloudDocId) return; // Only auto-save if we have an active, manually saved or loaded cloud document!
    if (!state.nomePrograma || !state.nomePrograma.trim()) return;

    const handler = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving');
        const payload = {
          userId: currentUser.uid,
          userEmail: currentUser.email || 'editor@redetvi.com',
          nomePrograma: state.nomePrograma,
          tempoPrograma: state.tempoPrograma,
          dataPrograma: state.dataPrograma || '',
          blocos: state.blocos,
          updatedByAutoSave: true,
          updatedAt: new Date()
        };

        const docRef = doc(db, 'programs', activeCloudDocId);
        await updateDoc(docRef, payload);
        baseStateRef.current = {
          nomePrograma: state.nomePrograma,
          tempoPrograma: state.tempoPrograma,
          dataPrograma: state.dataPrograma || '',
          blocos: state.blocos
        };
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2500);
      } catch (err) {
        console.error('Error during auto-saving espelho:', err);
        setAutoSaveStatus('error');
      }
    }, 1500); // Debounce duration

    return () => clearTimeout(handler);
  }, [state, activeCloudDocId, currentUser]);

  // Calculations for used time, remaining time, and blocks' specific times
  const parsedTempoPrograma = parseHHMMSSToSeconds(state.tempoPrograma);
  
  // Calculate total seconds accumulated across all blocks
  let totalSecsUsado = 0;
  
  const getBlockDurationSeconds = (block: Block): number => {
    let blockSeconds = 0;
    block.laudas.forEach(lauda => {
      const dur = lauda.duracao.trim();
      if (dur.match(/^\d{1,2}:\d{2}$/)) { // MM:SS
        const [mm, ss] = dur.split(':').map(n => parseInt(n, 10));
        blockSeconds += mm * 60 + ss;
      } else if (dur.match(/^\d+$/)) { // Plain seconds
        blockSeconds += parseInt(dur, 10);
      } else if (dur.match(/^\d{1,2}:\d{2}:\d{2}$/)) { // HH:MM:SS
        const [hh, mm, ss] = dur.split(':').map(n => parseInt(n, 10));
        blockSeconds += hh * 3600 + mm * 60 + ss;
      }
    });
    return blockSeconds;
  };

  state.blocos.forEach(b => {
    totalSecsUsado += getBlockDurationSeconds(b);
  });

  const remainingSeconds = parsedTempoPrograma - totalSecsUsado;
  const isExtrapolated = remainingSeconds < 0;

  // Set visual states
  const tempoTotalLabel = state.tempoPrograma || '00:00:00';
  const tempoUsadoLabel = formatarSegundosEmHHMMSS(totalSecsUsado);
  const tempoRestanteLabel = formatarSegundosEmHHMMSS(remainingSeconds);

  // BLOCK ADDITION
  const handleAddBloco = () => {
    const newBlockIndex = state.blocos.filter(b => b.tipo === 'normal').length + 1;
    const newBlock: Block = {
      id: generateId(),
      tipo: 'normal',
      titulo: `Bloco ${state.blocos.length + 1}`,
      laudas: [
        {
          id: generateId(),
          materia: 'RETRANCA VAZIA',
          duracao: '00:00',
          tipo: 'VT',
          apresentador: '',
          laudaContent: '',
          driveLink: ''
        }
      ]
    };
    setState(prev => ({
      ...prev,
      blocos: [...prev.blocos, newBlock]
    }));
  };

  // COMMERCIAL ADDITION
  const handleAddComercial = () => {
    const newBlock: Block = {
      id: generateId(),
      tipo: 'comercial',
      titulo: 'Intervalo Comercial',
      laudas: [
        {
          id: generateId(),
          materia: '',
          duracao: '00:00',
          tipo: '',
          apresentador: '',
          laudaContent: '',
          driveLink: ''
        }
      ]
    };
    setState(prev => ({
      ...prev,
      blocos: [...prev.blocos, newBlock]
    }));
  };

  // BLOCK ACTIONS
  const handleMoveBlockUp = (blockId: string) => {
    const idx = state.blocos.findIndex(b => b.id === blockId);
    if (idx <= 0) return;
    const updated = [...state.blocos];
    const target = updated[idx];
    updated[idx] = updated[idx - 1];
    updated[idx - 1] = target;
    setState(prev => ({ ...prev, blocos: updated }));
  };

  const handleMoveBlockDown = (blockId: string) => {
    const idx = state.blocos.findIndex(b => b.id === blockId);
    if (idx === -1 || idx === state.blocos.length - 1) return;
    const updated = [...state.blocos];
    const target = updated[idx];
    updated[idx] = updated[idx + 1];
    updated[idx + 1] = target;
    setState(prev => ({ ...prev, blocos: updated }));
  };

  const handleDeleteBlock = (blockId: string) => {
    setDeleteBlockId(blockId);
  };

  const handleUpdateBlockTitle = (blockId: string, newTitle: string) => {
    setState(prev => ({
      ...prev,
      blocos: prev.blocos.map(b => b.id === blockId ? { ...b, titulo: newTitle } : b)
    }));
  };

  // LAUDA ACTIONS
  const handleAddLauda = (blockId: string) => {
    const newLauda: Lauda = {
      id: generateId(),
      materia: 'NOVA RETRANCA',
      duracao: '00:00',
      tipo: 'VT',
      apresentador: '',
      laudaContent: '',
      driveLink: ''
    };
    setState(prev => ({
      ...prev,
      blocos: prev.blocos.map(b => {
        if (b.id === blockId) {
          return { ...b, laudas: [...b.laudas, newLauda] };
        }
        return b;
      })
    }));
  };

  const handleDeleteLauda = (blockId: string, laudaId: string) => {
    setState(prev => ({
      ...prev,
      blocos: prev.blocos.map(b => {
        if (b.id === blockId) {
          return { ...b, laudas: b.laudas.filter(l => l.id !== laudaId) };
        }
        return b;
      })
    }));
  };

  const handleUpdateLauda = (blockId: string, laudaId: string, fields: Partial<Lauda>) => {
    setState(prev => ({
      ...prev,
      blocos: prev.blocos.map(b => {
        if (b.id === blockId) {
          const updatedLaudas = b.laudas.map(l => {
            if (l.id === laudaId) {
              return { ...l, ...fields };
            }
            return l;
          });
          return { ...b, laudas: updatedLaudas };
        }
        return b;
      })
    }));
  };

  const handleMoveLaudaUp = (blockId: string, laudaId: string) => {
    setState(prev => {
      const targetBlock = prev.blocos.find(b => b.id === blockId);
      if (!targetBlock) return prev;
      const idx = targetBlock.laudas.findIndex(l => l.id === laudaId);
      if (idx <= 0) return prev;

      const updatedLaudas = [...targetBlock.laudas];
      const target = updatedLaudas[idx];
      updatedLaudas[idx] = updatedLaudas[idx - 1];
      updatedLaudas[idx - 1] = target;

      return {
        ...prev,
        blocos: prev.blocos.map(b => b.id === blockId ? { ...b, laudas: updatedLaudas } : b)
      };
    });
  };

  const handleMoveLaudaDown = (blockId: string, laudaId: string) => {
    setState(prev => {
      const targetBlock = prev.blocos.find(b => b.id === blockId);
      if (!targetBlock) return prev;
      const idx = targetBlock.laudas.findIndex(l => l.id === laudaId);
      if (idx === -1 || idx === targetBlock.laudas.length - 1) return prev;

      const updatedLaudas = [...targetBlock.laudas];
      const target = updatedLaudas[idx];
      updatedLaudas[idx] = updatedLaudas[idx + 1];
      updatedLaudas[idx + 1] = target;

      return {
        ...prev,
        blocos: prev.blocos.map(b => b.id === blockId ? { ...b, laudas: updatedLaudas } : b)
      };
    });
  };

  const handleMoveLaudaAcrossBlocks = (
    laudaId: string,
    sourceBlockId: string,
    destBlockId: string,
    destIndex?: number
  ) => {
    setState(prev => {
      const sourceBlock = prev.blocos.find(b => b.id === sourceBlockId);
      if (!sourceBlock) return prev;
      const laudaToMove = sourceBlock.laudas.find(l => l.id === laudaId);
      if (!laudaToMove) return prev;

      // Filter out from the source block
      const updatedBlocos = prev.blocos.map(b => {
        if (b.id === sourceBlockId) {
          return {
            ...b,
            laudas: b.laudas.filter(l => l.id !== laudaId)
          };
        }
        return b;
      });

      // Insert into the target block
      return {
        ...prev,
        blocos: updatedBlocos.map(b => {
          if (b.id === destBlockId) {
            const destLaudas = [...b.laudas];
            let insertIdx = typeof destIndex === 'number' ? destIndex : destLaudas.length;

            if (sourceBlockId === destBlockId) {
              const originalIndex = sourceBlock.laudas.findIndex(l => l.id === laudaId);
              if (originalIndex !== -1 && originalIndex < insertIdx) {
                insertIdx = Math.max(0, insertIdx - 1);
              }
            }

            destLaudas.splice(insertIdx, 0, laudaToMove);
            return {
              ...b,
              laudas: destLaudas
            };
          }
          return b;
        })
      };
    });
  };

  // EXPORT JSON FILE TO COMPUTER
  const handleSalvar = () => {
    const cleanBlocksData = state.blocos.map(b => {
      const laudas = b.laudas.map(l => ({
        materia: l.materia,
        duracao: l.duracao,
        tipo: l.tipo,
        apresentador: l.apresentador,
        laudaContent: l.laudaContent,
        driveLink: l.driveLink || ''
      }));
      return {
        tipo: b.tipo,
        titulo: b.titulo,
        laudas
      };
    });

    const fileStructure = {
      nomePrograma: state.nomePrograma,
      tempoPrograma: state.tempoPrograma,
      blocos: cleanBlocksData
    };

    let filename = state.nomePrograma.trim();
    if (filename === '') {
      filename = 'espelho_producao';
    } else {
      filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    const dataBlob = new Blob([JSON.stringify(fileStructure, null, 2)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(dataBlob);

    const aTag = document.createElement('a');
    aTag.href = blobUrl;
    aTag.download = `${filename}_espelho.json`;
    aTag.click();
    URL.revokeObjectURL(blobUrl);
  };

  // TRIGGER LOAD FILE
  const handleCarregar = () => {
    fileInputRef.current?.click();
  };

  // TRIGGER CLEAR / EXIT PROGRAM
  const handleClearProgram = () => {
    if (state.nomePrograma || state.blocos.length > 0) {
      if (!window.confirm("Deseja mesmo fechar o espelho atual? Quaisquer alterações não salvas serão perdidas.")) {
        return;
      }
    }
    setState(initialProgramState);
    setActiveCloudDocId(null);
  };

  // TRIGGER PRINT RUNDOWN
  const handleImprimir = () => {
    setIsPrintingEspelho(true);
    // Set advice modal open so that users can be guided in case of iframe constraints
    setIsPrintAdviceOpen(true);
  };

  // JSpdf CUSTOM EXPORT (TELEPROMPTER SCRIPT)
  const handleGerarTeleprompterPdf = () => {
    const doc = new jsPDF();
    let currentY = 20;
    const paddingLeft = 15;
    const pageRealWidth = doc.internal.pageSize.getWidth();
    const limitHeight = doc.internal.pageSize.getHeight() - 20;

    const printHeaderLine = (text: string, size = 10, variant = "normal") => {
      doc.setFontSize(size);
      doc.setFont("helvetica", variant);
      
      const lines = doc.splitTextToSize(text, pageRealWidth - (paddingLeft * 2));
      lines.forEach((line: string) => {
        if (currentY > limitHeight) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(line, paddingLeft, currentY);
        currentY += (size * 0.45) + 4;
      });
    };

    // Header Title for Documents
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ROTEIRO COMPLETO PARA TELEPROMPTER", paddingLeft, currentY);
    currentY += 12;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`PROGRAMA: ${state.nomePrograma || "TVI PROGRAMA"}`, paddingLeft, currentY);
    doc.text(`DURACAO ESTIMADA: ${tempoUsadoLabel}`, paddingLeft + 110, currentY);
    currentY += 4;
    doc.setDrawColor(180);
    doc.line(paddingLeft, currentY, pageRealWidth - paddingLeft, currentY);
    currentY += 12;

    let hasStoryPrinted = false;

    state.blocos.forEach(b => {
      if (b.tipo !== 'normal') return; // Skip commercial chunks

      b.laudas.forEach(lauda => {
        const retranca = lauda.materia.trim();
        const contentText = lauda.laudaContent.trim();

        if (retranca !== '' || contentText !== '') {
          hasStoryPrinted = true;
          
          if (currentY > limitHeight - 20) {
            doc.addPage();
            currentY = 20;
          }

          // Format Headline
          doc.setDrawColor(220, 160, 40);
          doc.setLineWidth(0.5);
          doc.line(paddingLeft, currentY, pageRealWidth - paddingLeft, currentY);
          currentY += 6;

          // Title
          printHeaderLine(`[${lauda.tipo}] # ${retranca}`, 13, "bold");
          
          if (lauda.apresentador) {
            printHeaderLine(`APRESENTACÃO: ${lauda.apresentador.toUpperCase()}`, 10, "bold");
          }
          currentY += 2;

          // Main body script content text
          if (contentText !== '') {
            printHeaderLine(contentText, 11, "normal");
          } else {
            printHeaderLine("[Nenhum roteiro escrito para esta lauda]", 10, "italic");
          }
          currentY += 10;
        }
      });
    });

    if (!hasStoryPrinted) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "italic");
      doc.text("O espelho não possui nenhuma lauda de roteiro preenchida.", paddingLeft, currentY);
    }

    let filename = state.nomePrograma.trim();
    if (filename === '') {
      filename = 'roteiro_teleprompter';
    } else {
      filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    doc.save(`${filename}_lauda_teleprompter.pdf`);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-zinc-400 text-xs font-mono tracking-wider uppercase">Iniciando Rede TVI...</span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthScreen 
        onAuthSuccess={(userObj) => {
          sessionStorage.setItem('rede_tvi_session_user', JSON.stringify(userObj));
          setCurrentUser(userObj as any);
        }} 
        onBypass={() => {
          const offlineUser = {
            uid: 'offline-editor',
            email: 'editor.offline@redetvi.com'
          };
          sessionStorage.setItem('rede_tvi_session_user', JSON.stringify(offlineUser));
          setCurrentUser(offlineUser as any);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0d] flex flex-col">
      <div className="flex-1 flex min-w-0">
        
        {/* LEFT SIDEBAR (Desktop) */}
        <aside className="hidden lg:flex w-72 bg-[#0c0c0e] border-r border-[#18181b]/50 flex-col justify-between shrink-0 no-print select-none p-5">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-center p-1 h-44 items-center">
                <img src={logoCor} alt="Rede TVI" className="max-h-full object-contain pointer-events-none" />
              </div>
              {/* Elegant visual separating line */}
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent w-full" />
            </div>

            {/* Sidebar Navigation */}
            <nav className="space-y-1.5">
              {([
                { key: 'pautas', label: 'Pautas', icon: ClipboardList, desc: 'Criar e agendar pautas' },
                { key: 'reportagens', label: 'Reportagens', icon: Film, desc: 'Texto, imagens e fontes' },
                { key: 'espelhos', label: 'Espelhos (Roteiro)', icon: Sliders, desc: 'Grade dos telejornais' },
                { key: 'agendas', label: 'Agendas', icon: Calendar, desc: 'Escalas e compromissos' },
                { key: 'teleprompter', label: 'Teleprompter', icon: Presentation, desc: 'Controles e leitura' },
                { key: 'colaboradores', label: 'Colaboradores', icon: Users, desc: 'Cadastro de profissionais' },
              ] as const).map((tab) => {
                const isActive = activeTab === tab.key;
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`w-full flex items-start gap-3.5 px-4 py-3 rounded-xl tracking-wide transition-all cursor-pointer text-left ${
                      isActive
                        ? 'bg-amber-500 text-zinc-950 font-extrabold shadow-lg shadow-amber-500/10 scale-102'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141416]'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                    <div className="min-w-0">
                      <span className="text-xs font-bold uppercase tracking-wider block leading-none">{tab.label}</span>
                      <span className={`text-[9px] block mt-1 font-sans truncate ${isActive ? 'text-zinc-900 w-auto' : 'text-zinc-500'}`}>
                        {tab.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Brand visual bottom signature */}
          <div className="space-y-3 pt-4 border-t border-zinc-850/60 text-center">
            <div className="text-[10px] text-zinc-650 font-mono tracking-widest uppercase">
              REDE TVI • BROADCASTING
            </div>
          </div>
        </aside>

        {/* RIGHT SIDE AREA (Header and dynamic tabs content) */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header 
            userEmail={currentUser.email || undefined} 
            onLogout={handleSignOut} 
            onChangePassword={() => setIsChangePasswordOpen(true)}
            autoSaveStatus={autoSaveStatus}
            googleToken={googleToken}
            onGoogleConnect={handleGoogleConnect}
            onGoogleDisconnect={handleGoogleDisconnect}
          />

          {/* Mobile Navigation Bar */}
          <div className="lg:hidden border-b border-zinc-850 bg-[#0d0d0f] p-2 flex gap-1.5 justify-around text-[10px] font-bold font-mono tracking-wider uppercase overflow-x-auto scrollbar-none no-print select-none">
            {([
              { key: 'pautas', label: 'Pautas' },
              { key: 'reportagens', label: 'Reportagens' },
              { key: 'espelhos', label: 'Espelhos' },
              { key: 'agendas', label: 'Agendas' },
              { key: 'teleprompter', label: 'Prompter' },
              { key: 'colaboradores', label: 'Equipe' }
            ] as const).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-2 rounded-lg transition-all cursor-pointer shrink-0 ${
                    isActive ? 'bg-amber-500 text-zinc-950 font-extrabold shadow-md' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Dynamic Panel Content loaded inside responsive wrappers */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6 pb-20">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {activeTab === 'pautas' && <PautasTab currentUser={currentUser} colaboradores={colaboradores} />}
                {activeTab === 'reportagens' && <ReportagensTab currentUser={currentUser} colaboradores={colaboradores} registeredPrograms={registeredPrograms} />}
                {activeTab === 'agendas' && <AgendasTab currentUser={currentUser} />}
                {activeTab === 'colaboradores' && <ColaboradoresTab currentUser={currentUser} />}

                {activeTab === 'teleprompter' && (
                  <div className="rounded-2xl border border-zinc-800 bg-[#0f0f11]/40 p-10 text-center space-y-6 max-w-xl mx-auto my-8">
                    <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                      <Presentation className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-zinc-200 font-sans font-bold text-lg">Teleprompter Virtual</h3>
                      <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">
                        Abra o teleprompter para projetar o roteiro (laudas e matérias) do telejornal atual de forma profissional para leitura em estúdio.
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => setIsTeleprompterOpen(true)}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-95 duration-100 cursor-pointer flex items-center gap-1.5 mx-auto shadow-lg shadow-indigo-600/15"
                      >
                        <Presentation className="w-4 h-4" />
                        <span>Abrir Teleprompter Virtual</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'espelhos' && (
                  <>
                    {/* Google Drive Connection Alert Banner */}
                    {!googleToken && (
                      <div className="mb-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 no-print">
                        <div className="p-4 rounded-2xl border border-amber-500/10 bg-amber-500/5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center gap-3 text-left">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-amber-500 font-display uppercase tracking-wider">Vincule sua Conta Google</h4>
                              <p className="text-zinc-400 text-xs mt-0.5 max-w-2xl leading-relaxed">
                                Para que todos os membros da equipe vejam, baixem e utilizem as mídias e vídeos anexados nas laudas do telejornal em tempo real, conecte sua conta Google de forma segura.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleGoogleConnect}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-95 duration-100 cursor-pointer flex items-center gap-1.5 shadow-md shrink-0 select-none"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M23.49,12.27c0-0.81-0.07-1.59-0.2-2.35H12v4.51h6.44c-0.28,1.47-1.11,2.71-2.36,3.55v2.95h3.82C22.13,18.89,23.49,15.86,23.49,12.27z" />
                            </svg>
                            Conectar Agora
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Global info dashboard */}
                    <ProgramInfo
                      nomePrograma={state.nomePrograma}
                      setNomePrograma={(v) => setState(prev => ({ ...prev, nomePrograma: v }))}
                      tempoPrograma={state.tempoPrograma}
                      setTempoPrograma={(v) => setState(prev => ({ ...prev, tempoPrograma: v }))}
                      dataPrograma={state.dataPrograma || ''}
                      setDataPrograma={(v) => setState(prev => ({ ...prev, dataPrograma: v }))}
                      tempoTotal={tempoTotalLabel}
                      tempoUsado={tempoUsadoLabel}
                      tempoRestante={tempoRestanteLabel}
                      isExtrapolado={isExtrapolated}
                      onAddBloco={handleAddBloco}
                      onAddComercial={handleAddComercial}
                      onImprimir={handleImprimir}
                      onSalvar={handleSalvar}
                      onCarregar={handleCarregar}
                      onClearProgram={handleClearProgram}
                      fileInputRef={fileInputRef}
                      registeredPrograms={registeredPrograms}
                      onAddRegisteredProgram={handleAddRegisteredProgram}
                      onDeleteRegisteredProgram={handleDeleteRegisteredProgram}
                    />

                    <CloudSyncPanel
                      currentProgramState={state}
                      onLoadProgram={async (savedState, cloudId) => {
                        if (cloudId) {
                          baseStateRef.current = null;
                          try {
                            const freshDoc = await getDoc(doc(db, 'programs', cloudId));
                            if (freshDoc.exists()) {
                              const d = freshDoc.data();
                              const loaded: ProgramState = {
                                nomePrograma: d.nomePrograma || '',
                                tempoPrograma: d.tempoPrograma || '00:00:00',
                                dataPrograma: d.dataPrograma || '',
                                blocos: d.blocos || []
                              };
                              setState(loaded);
                              baseStateRef.current = loaded;
                            } else {
                              setState(savedState);
                              baseStateRef.current = savedState;
                            }
                          } catch (err) {
                            console.error("Error loading fresh program from cloud:", err);
                            setState(savedState);
                            baseStateRef.current = savedState;
                          }
                          setActiveCloudDocId(cloudId);
                        } else {
                          baseStateRef.current = null;
                          setState(savedState);
                          setActiveCloudDocId(null);
                        }
                      }}
                      currentUser={currentUser}
                      activeCloudDocId={activeCloudDocId}
                      onActiveCloudDocIdChange={setActiveCloudDocId}
                    />

                    {/* Dynamic List Blocks */}
                    <div className="space-y-6">
                      {state.blocos.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#0f0f11]/40 p-10 text-center space-y-6 max-w-xl mx-auto my-8">
                          <div className="mx-auto w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 border border-zinc-805">
                            <FolderX className="w-6 h-6 stroke-[1.8]" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-zinc-200 font-sans font-bold text-lg">Nenhum Espelho Aberto</h3>
                            <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">
                              Crie blocos ou intervalos para começar a escrever seu roteiro, ou escolha um espelho salvo na nuvem logo abaixo no painel.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-3">
                            <button
                              onClick={handleAddBloco}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-95 duration-100 cursor-pointer flex items-center gap-1.5"
                            >
                              <Plus className="w-4 h-4 stroke-[2.5]" />
                              <span>Inserir Novo Bloco</span>
                            </button>
                            <button
                              onClick={handleAddComercial}
                              className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-95 duration-100 cursor-pointer flex items-center gap-1.5 border border-zinc-750"
                            >
                              <Plus className="w-4 h-4 stroke-[2.5]" />
                              <span>Inserir Intervalo</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        state.blocos.map((block, idx) => {
                          const blockSeconds = getBlockDurationSeconds(block);
                          const blockDurationStr = formatarSegundosEmHHMMSS(blockSeconds);

                          return (
                            <BlockItem
                              key={block.id}
                              block={block}
                              index={idx}
                              totalBlocksCount={state.blocos.length}
                              onMoveUp={handleMoveBlockUp}
                              onMoveDown={handleMoveBlockDown}
                              onDelete={handleDeleteBlock}
                              onUpdateBlockTitle={handleUpdateBlockTitle}
                              onAddLauda={handleAddLauda}
                              onDeleteLauda={handleDeleteLauda}
                              onUpdateLauda={handleUpdateLauda}
                              onOpenLaudaEditor={(bId, lauda) => setLaudaEditorState({
                                isOpen: true,
                                blockId: bId,
                                lauda,
                              })}
                              onMoveLaudaUp={handleMoveLaudaUp}
                              onMoveLaudaDown={handleMoveLaudaDown}
                              onMoveLaudaAcrossBlocks={handleMoveLaudaAcrossBlocks}
                              blockDurationStr={blockDurationStr}
                              colaboradores={colaboradores}
                            />
                          );
                        })
                      )}
                    </div>

                    {/* Floating live controls helper */}
                    <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-40 no-print">
                      <button
                        onClick={handleGerarTeleprompterPdf}
                        className="flex items-center gap-2 px-4 py-3 bg-[#111113] hover:bg-zinc-800 border border-zinc-750 text-zinc-300 hover:text-white rounded-full shadow-2xl font-semibold text-xs uppercase tracking-wide transition-all active:scale-95 duration-100 cursor-pointer"
                        title="Download PDF de todas as laudas rascunhadas para Teleprompter"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span>Gerar Roteiro PDF</span>
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Modal Script Text Editor */}
      <LaudaModal
        isOpen={laudaEditorState.isOpen}
        onClose={() => setLaudaEditorState({ isOpen: false, blockId: '', lauda: null })}
        materiaTitle={laudaEditorState.lauda?.materia || ''}
        initialContent={laudaEditorState.lauda?.laudaContent || ''}
        onSave={(updatedContent) => {
          if (laudaEditorState.blockId && laudaEditorState.lauda) {
            handleUpdateLauda(laudaEditorState.blockId, laudaEditorState.lauda.id, {
              laudaContent: updatedContent
            });
          }
        }}
      />

      {/* Live fullscreen virtual teleprompter projection layer */}
      <TeleprompterPlayer
        isOpen={isTeleprompterOpen}
        onClose={() => {
          setIsTeleprompterOpen(false);
          if (activeTab === 'teleprompter') {
            setActiveTab('espelhos');
          }
        }}
        programTitle={state.nomePrograma}
        blocos={state.blocos}
      />

      {/* Change Password Modal Overlay */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        currentUser={currentUser}
      />

      {/* Custom Confirmation Modal for Block Deletion */}
      {deleteBlockId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden">
            {/* Top red glow decoration */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-red-500" />
            
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                <AlertTriangle className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-zinc-100 font-display font-semibold text-base">
                  Excluir Bloco Inteiro?
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Tem certeza de que deseja excluir o bloco <strong className="text-zinc-100 font-semibold">"{state.blocos.find(b => b.id === deleteBlockId)?.titulo}"</strong> e todas as laudas associadas? Esta ação é irreversível.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteBlockId(null)}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setState(prev => ({
                    ...prev,
                    blocos: prev.blocos.filter(b => b.id !== deleteBlockId)
                  }));
                  setDeleteBlockId(null);
                }}
                className="px-4 py-2 bg-red-650 hover:bg-red-600 text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Print Advice Modal for Iframe Environment Support */}
      {isPrintAdviceOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-6 max-w-lg w-full shadow-2xl relative overflow-hidden">
            {/* Top gold/amber glow decoration */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500" />
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-3 items-center">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Printer className="w-4 h-4 stroke-[2]" />
                </div>
                <h3 className="text-zinc-100 font-display font-semibold text-lg">
                  Instruções para Impressão
                </h3>
              </div>
              <button
                onClick={() => setIsPrintAdviceOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-zinc-300 text-sm leading-relaxed">
              <p>
                Como sua aplicação está rodando em um painel de desenvolvimento, o navegador pode restringir o diálogo de impressão diretamente de dentro do quadro.
              </p>
              
              <div className="bg-[#111113] p-4 border border-zinc-850 rounded-lg space-y-3">
                <div className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 text-amber-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                  <span>Clique no botão <strong className="text-zinc-100">"Abrir em Nova Aba"</strong> (o ícone <ExternalLink className="w-3.5 h-3.5 inline text-amber-400" /> no cabeçalho do editor do AI Studio para expandir a visualização).</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 text-amber-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                  <span>Na nova aba que se abriu, clique no botão <strong className="text-zinc-100">"Imprimir"</strong> normalmente.</span>
                </div>
                <div className="flex gap-2.5 items-start">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 text-amber-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                  <span>O assistente de impressão do seu sistema operacional abrirá perfeitamente!</span>
                </div>
              </div>

              <p className="text-xs text-zinc-500 italic mt-2">
                Dica adicional: Nas opções de impressão do navegador, marque "Imprimir cores de fundo" para manter o contraste do design e garantir um espelho idêntico.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPrintAdviceOpen(false)}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPrintAdviceOpen(false);
                  // Trigger simple print fallback just in case
                  try {
                    window.print();
                  } catch(e) {}
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-550 text-zinc-950 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Tentar imprimir aqui</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Humble Production Footer */}
      <footer className="w-full py-6 select-none bg-zinc-950/20 text-center border-t border-zinc-900 text-zinc-600 font-mono text-[10px] uppercase tracking-widest no-print">
        <div>REDE TVI • TODOS OS DIREITOS RESERVADOS COBRINDO A REDE DO JORNALISMO</div>
        <div className="mt-1 text-zinc-700">MODERN LIVE BROADCAST CONSOLE SYSTEM</div>
      </footer>

      {/* Printable Espelho Rundown Template Portal */}
      {isPrintingEspelho && createPortal(
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
              <span className="text-xs font-bold text-zinc-800 font-mono block" style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', display: 'block' }}>ESPELHO DE TELEJORNAL / GRADE</span>
              <span className="text-[10px] text-zinc-500 font-mono block" style={{ fontSize: '10px', color: '#777', fontFamily: 'monospace', display: 'block' }}>Impresso em: {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {/* Document Title */}
          <div className="mb-6" style={{ marginBottom: '1.5rem' }}>
            <h2 className="text-lg font-bold border-b border-black pb-2 text-black uppercase" style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid black', paddingBottom: '0.5rem', color: '#000', textTransform: 'uppercase' }}>
              {state.nomePrograma || 'TELEJORNAL TVI'}
            </h2>
          </div>

          {/* Metadados Grid */}
          <div className="grid grid-cols-3 gap-4 border border-black p-4 rounded-lg mb-6 bg-zinc-50" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', border: '1px solid black', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', backgroundColor: '#f9f9f9' }}>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Data de Exibição</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>
                {state.dataPrograma ? new Date(state.dataPrograma + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informada'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Tempo Previsto</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{state.tempoPrograma || '00:00:00'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-500 block uppercase" style={{ fontSize: '10px', fontWeight: 'bold', color: '#666', display: 'block', textTransform: 'uppercase' }}>Tempo Utilizado</span>
              <span className="text-sm font-semibold text-black" style={{ fontSize: '14px', fontWeight: '600', color: '#000' }}>{tempoUsadoLabel}</span>
            </div>
          </div>

          {/* Rundown list */}
          <div className="space-y-6">
            {state.blocos.map((bloco, bIdx) => (
              <div key={bloco.id} className="mb-6" style={{ marginBottom: '1.5rem' }}>
                <h3 className="text-sm font-bold bg-zinc-100 px-3 py-1.5 border border-zinc-300 rounded mb-3 text-zinc-800 uppercase flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', backgroundColor: '#f4f4f5', padding: '0.375rem 0.75rem', border: '1px solid #d4d4d8', borderRadius: '0.25rem', marginBottom: '0.75rem' }}>
                  <span>{bloco.titulo || `BLOCO ${bIdx + 1}`} ({bloco.tipo === 'comercial' ? 'COMERCIAL' : 'CONTEÚDO'})</span>
                  <span>DUR: {bloco.duracao || '00:00'}</span>
                </h3>
                
                <table className="w-full border-collapse border border-zinc-300 text-left text-xs mb-4" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d4d4d8', fontSize: '11px', marginBottom: '1rem' }}>
                  <thead>
                    <tr className="bg-zinc-50" style={{ backgroundColor: '#f9f9f9' }}>
                      <th className="border border-zinc-300 p-2 font-bold text-zinc-700" style={{ border: '1px solid #d4d4d8', padding: '0.5rem', fontWeight: 'bold', color: '#374151', width: '50px', textAlign: 'center' }}>ORDEM</th>
                      <th className="border border-zinc-300 p-2 font-bold text-zinc-700" style={{ border: '1px solid #d4d4d8', padding: '0.5rem', fontWeight: 'bold', color: '#374151' }}>RETRANCA / MATÉRIA</th>
                      <th className="border border-zinc-300 p-2 font-bold text-zinc-700" style={{ border: '1px solid #d4d4d8', padding: '0.5rem', fontWeight: 'bold', color: '#374151', width: '80px' }}>TIPO</th>
                      <th className="border border-zinc-300 p-2 font-bold text-zinc-700" style={{ border: '1px solid #d4d4d8', padding: '0.5rem', fontWeight: 'bold', color: '#374151', width: '110px' }}>APRESENTADOR</th>
                      <th className="border border-zinc-300 p-2 font-bold text-zinc-700" style={{ border: '1px solid #d4d4d8', padding: '0.5rem', fontWeight: 'bold', color: '#374151', width: '70px', textAlign: 'center' }}>DUR.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bloco.laudas.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="border border-zinc-300 p-3 text-zinc-500 italic text-center" style={{ border: '1px solid #d4d4d8', padding: '0.75rem', color: '#6b7280', fontStyle: 'italic', textAlign: 'center' }}>
                          Nenhuma lauda cadastrada neste bloco.
                        </td>
                      </tr>
                    ) : (
                      bloco.laudas.map((lauda, lIdx) => (
                        <tr key={lauda.id}>
                          <td className="border border-zinc-300 p-2 font-mono text-center text-zinc-600" style={{ border: '1px solid #d4d4d8', padding: '0.5rem', fontFamily: 'monospace', textAlign: 'center' }}>
                            {String(lIdx + 1).padStart(2, '0')}
                          </td>
                          <td className="border border-zinc-300 p-2 font-semibold text-black" style={{ border: '1px solid #d4d4d8', padding: '0.5rem', fontWeight: 'bold', color: '#000' }}>
                            {lauda.materia || 'RETRANCA SEM TÍTULO'}
                          </td>
                          <td className="border border-zinc-300 p-2 text-zinc-600 uppercase" style={{ border: '1px solid #d4d4d8', padding: '0.5rem', color: '#4b5563', textTransform: 'uppercase' }}>
                            {lauda.tipo || 'OFF'}
                          </td>
                          <td className="border border-zinc-300 p-2 text-zinc-800" style={{ border: '1px solid #d4d4d8', padding: '0.5rem', color: '#1f2937' }}>
                            {lauda.apresentador || 'Geral'}
                          </td>
                          <td className="border border-zinc-300 p-2 font-mono text-center text-zinc-700" style={{ border: '1px solid #d4d4d8', padding: '0.5rem', fontFamily: 'monospace', color: '#374151', textAlign: 'center' }}>
                            {lauda.tempo || '00:00'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Assinatura footer */}
          <div className="mt-20 pt-8 border-t border-dashed border-zinc-300 flex justify-between items-center text-[10px] text-zinc-400 font-mono" style={{ marginTop: '5rem', paddingTop: '2rem', borderTop: '1px dashed #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#777', fontFamily: 'monospace' }}>
            <span>REDE TVI JORNALISMO — SISTEMA DE COOPERATIVA DE NOTÍCIAS</span>
            <span>ASSINATURA DO DIRETOR: __________________________________</span>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
