import React, { useState, useEffect, useRef } from 'react';
import { 
  X, AlertCircle, Video, Loader2, Info, Search, RefreshCw, Upload, FolderOpen, FileVideo, Check, LogOut, ArrowLeft, Plus
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { googleAuth } from '../firebase';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockId: string;
  laudaId: string;
  laudaTitulo: string;
  currentLink?: string;
  onSave: (blockId: string, laudaId: string, driveLink: string, durationStr?: string) => void;
}

// Declare global cache for browser local files in order to persist blobs during runtime session
declare global {
  interface Window {
    localVideoCache?: Record<string, { file: File; url: string }>;
  }
}

// Shared in-memory cache for the Google OAuth Access Token, loaded initially from localStorage
let globalGoogleAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('rede_tvi_google_token') : null;

export default function GoogleDriveModal({
  isOpen,
  onClose,
  blockId,
  laudaId,
  laudaTitulo,
  currentLink = '',
  onSave
}: GoogleDriveModalProps) {
  const [error, setError] = useState<string | null>(null);

  // Google Drive states
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return globalGoogleAccessToken || (typeof window !== 'undefined' ? localStorage.getItem('rede_tvi_google_token') : null);
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualUrl, setManualUrl] = useState('');

  // Sync token if connected/disconnected from outside
  useEffect(() => {
    const handleGoogleUpdate = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('rede_tvi_google_token') : null;
      globalGoogleAccessToken = token;
      setAccessToken(token);
    };

    window.addEventListener('rede_tvi_google_connected', handleGoogleUpdate);
    return () => {
      window.removeEventListener('rede_tvi_google_connected', handleGoogleUpdate);
    };
  }, []);

  // Subview toggles: 'list' (browsing folder files) or 'upload' (uploading a file)
  const [subView, setSubView] = useState<'list' | 'upload'>('list');

  // Upload progress states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileDuration, setSelectedFileDuration] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Measure selected video duration
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = url;
      video.onloadedmetadata = () => {
        const totalSeconds = Math.round(video.duration);
        if (!isNaN(totalSeconds) && totalSeconds > 0) {
          const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
          const s = (totalSeconds % 60).toString().padStart(2, '0');
          setSelectedFileDuration(`${m}:${s}`);
        }
        URL.revokeObjectURL(url);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setSelectedFileDuration('');
    }
  }, [selectedFile]);

  const folderId = '1jCABUF0YtmD6OWCyIsv-KYtNzep8z7wn';

  // Format Helper: Bytes to human-readable
  const formatBytes = (bytesStr: string | number): string => {
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (!bytes || isNaN(bytes)) return 'Tamanho desconhecido';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format Helper: ISO date string to localized date
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  // Fetch all video files inside the default Google Drive Folder
  const fetchDriveFiles = async (token = accessToken) => {
    if (!token) return;
    setIsLoadingFiles(true);
    setError(null);
    try {
      // Query to search inside our specific parent folder and exclude folders
      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent('files(id, name, mimeType, size, webViewLink, iconLink, createdTime)');
      
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name&pageSize=100`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleDisconnectGoogle();
          throw new Error('Sua autorização expirou. Por favor, conecte sua conta Google novamente.');
        }
        throw new Error(`Erro na API do Google Drive (HTTP ${response.status})`);
      }

      const data = await response.json();
      setDriveFiles(data.files || []);
    } catch (err: any) {
      console.error('Error fetching drive files:', err);
      setError(err.message || 'Falha ao sincronizar arquivos com a pasta do Google Drive.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Run on open or when connection changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedFile(null);
      setIsUploading(false);
      setUploadProgress(0);
      setSubView('list');
      setManualUrl(currentLink && !currentLink.startsWith('local://') ? currentLink : '');
      
      if (accessToken) {
        fetchDriveFiles(accessToken);
      }
    }
  }, [isOpen, accessToken, currentLink]);

  // Authenticate using Google provider via Firebase auth popup context
  const handleGoogleConnect = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');

      const result = await signInWithPopup(googleAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (!token) {
        throw new Error('Não foi possível receber o Token de Acesso da API Google.');
      }

      globalGoogleAccessToken = token;
      if (typeof window !== 'undefined') {
        localStorage.setItem('rede_tvi_google_token', token);
      }
      setAccessToken(token);
      fetchDriveFiles(token);
      
      // Notify other components
      window.dispatchEvent(new Event('rede_tvi_google_connected'));
    } catch (err: any) {
      console.error("Authentication Error:", err);
      if (err.code === 'auth/popup-blocked') {
        setError('O pop-up de login foi bloqueado. Por favor, libere os pop-ups nas configurações de seu navegador e tente de novo.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('A janela de login com o Google foi fechada antes de podermos vincular sua conta.');
      } else {
        setError(err.message || 'Erro ao realizar login e obter permissões no Google.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Perform disconnection safely
  const handleDisconnectGoogle = () => {
    globalGoogleAccessToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rede_tvi_google_token');
    }
    setAccessToken(null);
    setDriveFiles([]);
    setError(null);
    
    // Notify other components
    window.dispatchEvent(new Event('rede_tvi_google_connected'));
  };

  // Local drag & drop event handling
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Por favor, selecione arquivos em formato de Vídeo.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Por favor, selecione arquivos em formato de Vídeo.');
      }
    }
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // High stability direct video upload straight to Google Drive folder using Multipart Protocol
  const handleDirectUploadToDrive = async () => {
    if (!selectedFile || !accessToken) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const metadata = {
        name: selectedFile.name,
        parents: [folderId]
      };

      const formData = new FormData();
      formData.append(
        'metadata',
        new Blob([JSON.stringify(metadata)], { type: 'application/json' })
      );
      formData.append('file', selectedFile);

      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink'
      );
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      const uploadPromise = new Promise<{ id: string; name: string; webViewLink: string }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              resolve(res);
            } catch (e) {
              reject(new Error('Resposta do Drive inválida.'));
            }
          } else {
            try {
              const errRes = JSON.parse(xhr.responseText);
              reject(new Error(errRes.error?.message || `Falha do Google (Status: ${xhr.status})`));
            } catch {
              reject(new Error(`Ocorreu um erro no upload (Status: ${xhr.status})`));
            }
          }
        };
        xhr.onerror = () => {
          reject(new Error('Conexão instável ou falha na rede de streaming.'));
        };
      });

      xhr.send(formData);

      const res = await uploadPromise;
      
      setUploadProgress(100);
      
      const driveLink = res.webViewLink || `https://drive.google.com/file/d/${res.id}/view?usp=drivesdk`;
      
      // Cache locally so we don't have to download/stream if same browser session
      if (typeof window !== 'undefined') {
        if (!window.localVideoCache) {
          window.localVideoCache = {};
        }
        window.localVideoCache[selectedFile.name] = {
          file: selectedFile,
          url: URL.createObjectURL(selectedFile)
        };
      }

      // Auto-save & finish modal
      onSave(blockId, laudaId, driveLink, selectedFileDuration);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Falha no upload direto para a pasta do Google Drive.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Filter local listing results
  const filteredFiles = driveFiles.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs no-print">
      <div 
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 text-left"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-950 border-b border-zinc-850">
          <div className="flex items-center gap-2.5">
            <Video className="w-5 h-5 text-amber-500 animate-pulse" />
            <div>
              <h2 className="text-sm font-bold text-zinc-100 font-display uppercase tracking-wider">
                Gerenciar Matéria (Google Drive)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[280px] sm:max-w-md">
                Lauda: <span className="text-amber-500 font-mono font-medium">{laudaTitulo || "Sem Nome"}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info panel */}
        <div className="bg-zinc-950/60 px-6 py-2.5 border-b border-zinc-850 flex items-center gap-2 text-[11px] text-zinc-400">
          <FolderOpen className="w-4 h-4 text-amber-550 flex-shrink-0" />
          <span className="truncate">
            Pasta Padrão Ativa: <span className="text-zinc-300 font-mono font-semibold">"TV Folder" ({folderId})</span>
          </span>
        </div>

        {/* Body Content Area */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col min-h-0 bg-zinc-900">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl flex items-start gap-2.5 text-left mb-4 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-400 leading-normal">{error}</p>
            </div>
          )}

          {!accessToken ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 space-y-5 text-center">
              <div className="p-5 bg-zinc-950 border border-zinc-850 rounded-3xl text-amber-500 shadow-inner">
                <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6C3.79 18 2 16.21 2 14c0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
                </svg>
              </div>
              <div className="space-y-1.5 max-w-sm">
                <p className="text-zinc-200 font-bold text-sm">
                  Conta Google não integrada
                </p>
                <p className="text-zinc-450 leading-relaxed text-[11px]">
                  Para buscar matérias, ver os vídeos locais da nuvem ou subir arquivos diretamente no Drive da emissora, faça a integração segura de sua conta.
                </p>
              </div>

              <button
                onClick={handleGoogleConnect}
                disabled={isLoggingIn}
                className="text-xs font-bold flex items-center justify-center px-6 py-3 bg-white hover:bg-zinc-100 active:scale-95 text-zinc-900 rounded-xl transition-all border border-zinc-200 cursor-pointer shadow-md select-none disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-zinc-700" />
                    <span>Vinculando sua Conta...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M23.49,12.27c0-0.81-0.07-1.59-0.2-2.35H12v4.51h6.44c-0.28,1.47-1.11,2.71-2.36,3.55v2.95h3.82C22.13,18.89,23.49,15.86,23.49,12.27z"
                      />
                      <path
                        fill="#4285F4"
                        d="M12,24c3.24,0,5.96-1.08,7.95-2.91l-3.82-2.95c-1.06,0.71-2.42,1.13-4.13,1.13c-3.18,0-5.87-2.15-6.83-5.04H1.32v3.05C3.3,21.13,7.4,24,12,24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.17,14.23c-0.24-0.71-0.38-1.47-0.38-2.23s0.14-1.52,0.38-2.23V6.72H1.32C0.48,8.4,0,10.2,0,12s0.48,3.6,1.32,5.28L5.17,14.23z"
                      />
                      <path
                        fill="#34A853"
                        d="M12,4.75c1.76,0,3.35,0.61,4.6,1.8l3.42-3.42C17.95,1.19,15.23,0,12,0C7.4,0,3.3,2.87,1.32,6.72l3.85,3.05C6.13,6.9,8.82,4.75,12,4.75z"
                      />
                    </svg>
                    <span>Fazer Login com Google</span>
                  </>
                )}
              </button>

              {/* Direct Input Fallback section */}
              <div className="w-full max-w-md pt-5 border-t border-zinc-800/80 mt-5">
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                  Ou Vincule um Link de Vídeo Manualmente
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="Cole o link do vídeo (Drive, YouTube, MP4, etc.)"
                    className="flex-1 bg-zinc-950 border border-zinc-800 text-xs px-3.5 py-2.5 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (manualUrl.trim()) {
                        onSave(blockId, laudaId, manualUrl.trim());
                        onClose();
                      }
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-440 active:scale-95 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md select-none"
                  >
                    Vincular
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 space-y-4">
              {/* Account Header info */}
              <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-850 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-zinc-300 font-semibold">Conta Conectada</span>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-950 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  title="Desconectar do Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </div>

              {/* LIST SUBVIEW */}
              {subView === 'list' && (
                <div className="flex-1 flex flex-col min-h-0 space-y-3">
                  {/* Search and Action Toolbar */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar matéria na pasta..."
                        className="w-full bg-zinc-950 border border-zinc-800 text-xs px-9 py-2.5 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchDriveFiles()}
                      disabled={isLoadingFiles}
                      className="p-2.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white active:scale-95 duration-75 rounded-xl cursor-pointer disabled:opacity-50"
                      title="Atualizar pasta"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin text-amber-550' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSubView('upload'); setError(null); setSelectedFile(null); }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-440 active:scale-95 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer select-none"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                      Novo Vídeo
                    </button>
                  </div>

                  {/* List Content Panel */}
                  <div className="flex-1 overflow-y-auto bg-zinc-950/40 border border-zinc-850 rounded-xl max-h-[320px] p-2 space-y-1 scrollbar-thin">
                    {isLoadingFiles ? (
                      <div className="h-44 flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="w-8 h-8 text-amber-550 animate-spin" />
                        <span className="text-[11px] text-zinc-500 font-mono">Listando arquivos do Google Drive...</span>
                      </div>
                    ) : filteredFiles.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center p-4 text-center space-y-2 text-zinc-500">
                        <FolderOpen className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                        <div className="space-y-0.5 max-w-xs">
                          <p className="text-xs font-semibold text-zinc-400">Nenhuma matéria de vídeo encontrada</p>
                          <p className="text-[10px] text-zinc-600">
                            {searchQuery ? 'Tente buscar por outro termo ou remova o filtro.' : 'Esta pasta do Google Drive está vazia. Toque em "Novo Vídeo" para enviar um vídeo.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      filteredFiles.map((file) => {
                        const driveLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view?usp=drivesdk`;
                        const isSelectedInLauda = currentLink === driveLink;

                        return (
                          <div 
                            key={file.id}
                            onClick={() => {
                              onSave(blockId, laudaId, driveLink);
                              onClose();
                            }}
                            className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-all duration-100/100
                              ${isSelectedInLauda 
                                ? 'bg-amber-500/10 border-amber-500/30' 
                                : 'bg-zinc-900/40 hover:bg-zinc-800/40 border-transparent hover:border-zinc-800'
                              }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-4">
                              <div className={`p-2 rounded-lg shrink-0 ${isSelectedInLauda ? 'bg-amber-500/15 text-amber-450' : 'bg-zinc-950 text-zinc-450 group-hover:text-amber-500'}`}>
                                <FileVideo className="w-4 h-4 shrink-0 transition-colors" />
                              </div>
                              <div className="min-w-0 space-y-0.5 text-left">
                                <p className="text-xs font-semibold text-zinc-200 group-hover:text-amber-440 truncate">
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 shrink-0">
                                  <span>{formatBytes(file.size)}</span>
                                  <span className="text-zinc-700">•</span>
                                  <span>{formatDate(file.createdTime)}</span>
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`px-3 py-1.5 rounded-lg text-[10px] tracking-wide font-bold uppercase transition-all shrink-0 cursor-pointer
                                ${isSelectedInLauda
                                  ? 'bg-amber-500 text-zinc-950'
                                  : 'bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                              {isSelectedInLauda ? (
                                <span className="flex items-center gap-1">
                                  <Check className="w-3 h-3 stroke-[3px]" />
                                  Vinculado
                                </span>
                              ) : (
                                'Vincular'
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* UPLOAD SUBVIEW */}
              {subView === 'upload' && (
                <div className="flex-1 flex flex-col space-y-4 animate-in slide-in-from-right-3 duration-150">
                  {/* Back Navigation Bar */}
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setSubView('list')}
                      disabled={isUploading}
                      className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Voltar para a Lista de Vídeos
                    </button>
                  </div>

                  {isUploading ? (
                    <div className="py-12 border border-zinc-850 bg-zinc-950/20 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center">
                      <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                      <div className="space-y-1.5">
                        <p className="text-zinc-200 font-bold text-xs">Transmitindo para o Google Drive...</p>
                        <p className="text-zinc-500 text-[10px] font-mono">
                          Processando blocos de dados ({uploadProgress}%)
                        </p>
                      </div>
                      <div className="w-56 bg-zinc-850 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Hidden File Input tag */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />

                      {/* Drag Area Box */}
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={triggerFileSelect}
                        className={`border-2 border-dashed rounded-2xl p-10 hover:border-amber-500 transition-all cursor-pointer flex flex-col items-center justify-center gap-3
                          ${dragActive ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 bg-zinc-950/20'}`}
                      >
                        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400">
                          <Upload className="w-6 h-6 text-zinc-300 animate-pulse" />
                        </div>
                        {selectedFile ? (
                          <div className="space-y-1 text-center">
                            <p className="text-zinc-100 font-bold text-xs truncate max-w-sm">
                              {selectedFile.name}
                            </p>
                            <p className="text-zinc-500 font-mono text-[10px]">
                              {formatBytes(selectedFile.size)} • {selectedFile.type || 'Formato Desconhecido'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5 text-center">
                            <p className="text-zinc-300 font-semibold text-xs">
                              Arraste seu vídeo aqui ou <span className="text-amber-550 underline font-bold select-none cursor-pointer">procure no computador</span>
                            </p>
                            <p className="text-zinc-500 text-[10px]">
                              O vídeo selecionado será enviado e salvo diretamente na pasta padrão do Google Drive!
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Submit controls */}
                      {selectedFile && (
                        <div className="flex justify-end gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            Limpar Seleção
                          </button>
                          <button
                            type="button"
                            onClick={handleDirectUploadToDrive}
                            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-440 active:scale-95 text-zinc-950 rounded-xl text-xs font-bold font-sans transition-all shadow-md flex items-center gap-2 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 stroke-[2.5px]" />
                            Fazer Upload e Vincular
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Optional Manual URL Input for Connected Users */}
              <div className="pt-4 border-t border-zinc-805 mt-2 text-left">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                  Ou Vincule Manualmente (Qualquer Link de Vídeo fora do seu Drive)
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="Cole o link do vídeo (Drive, YouTube, MP4, etc.)"
                    className="flex-1 bg-zinc-950 border border-zinc-850 text-xs px-3.5 py-2 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (manualUrl.trim()) {
                        onSave(blockId, laudaId, manualUrl.trim());
                        onClose();
                      }
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-440 active:scale-95 text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-md select-none shrink-0"
                  >
                    Salvar Link
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
