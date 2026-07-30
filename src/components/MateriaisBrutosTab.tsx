import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, FolderPlus, UploadCloud, Image, Video, Music, FileText, 
  ChevronRight, ArrowLeft, Trash2, ExternalLink, Download, Loader2, 
  Search, Sparkles, Plus, Play, X, RefreshCw, AlertCircle, FileUp, FolderDown
} from 'lucide-react';
import JSZip from 'jszip';
import { getCachedGoogleToken, connectGoogleDrive, disconnectGoogleDrive, formatBytes } from '../googleDriveService';

interface MateriaisBrutosTabProps {
  currentUser: any;
}

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
  size?: string;
  createdTime?: string;
}

const BRUTOS_ROOT_FOLDER_ID = '1wV_Tw9jHTW-x-KeSWS-GWpXVQIIfu81Y';

export default function MateriaisBrutosTab({ currentUser }: MateriaisBrutosTabProps) {
  const [token, setToken] = useState<string | null>(() => getCachedGoogleToken());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Directory navigation state
  const [currentFolder, setCurrentFolder] = useState({
    id: BRUTOS_ROOT_FOLDER_ID,
    name: 'Materiais Brutos'
  });
  const [folderHistory, setFolderHistory] = useState<Array<{ id: string; name: string }>>([
    { id: BRUTOS_ROOT_FOLDER_ID, name: 'Materiais Brutos' }
  ]);

  // Content states
  const [items, setItems] = useState<DriveItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Creation states
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Upload states
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Zip folder download states
  const [zippingFolderId, setZippingFolderId] = useState<string | null>(null);
  const [zipProgressStatus, setZipProgressStatus] = useState<string | null>(null);

  const downloadFolderAsZip = async (folderId: string, folderName: string) => {
    if (!token) return;
    setZippingFolderId(folderId);
    setZipProgressStatus('Localizando arquivos da pasta...');
    setError(null);

    try {
      // 1. Fetch files in the folder
      const query = encodeURIComponent(`'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`);
      const fields = encodeURIComponent('files(id, name, mimeType, size)');
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=100`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erro ao listar arquivos da pasta.');
      }

      const data = await response.json();
      const filesToDownload = data.files || [];

      if (filesToDownload.length === 0) {
        alert('Esta pasta não contém arquivos para baixar.');
        setZippingFolderId(null);
        setZipProgressStatus(null);
        return;
      }

      // 2. Initialize JSZip
      const zip = new JSZip();
      
      // 3. Download each file content as blob & add to ZIP
      for (let i = 0; i < filesToDownload.length; i++) {
        const file = filesToDownload[i];
        setZipProgressStatus(`Baixando (${i + 1}/${filesToDownload.length}): ${file.name}`);

        const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!fileRes.ok) {
          console.warn(`Falha ao baixar conteúdo de: ${file.name}. Ignorando.`);
          continue;
        }

        const blob = await fileRes.blob();
        zip.file(file.name, blob);
      }

      // 4. Generate the zip file
      setZipProgressStatus('Compactando arquivos em arquivo .ZIP...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // 5. Trigger client download
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${folderName.toUpperCase()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setZipProgressStatus(null);
    } catch (err: any) {
      console.error('ZIP compilation failed:', err);
      setError(`Falha ao compactar/baixar pasta: ${err.message || 'Erro inesperado'}`);
    } finally {
      setZippingFolderId(null);
      setZipProgressStatus(null);
    }
  };

  // Sync token from service on mount/updates
  useEffect(() => {
    const activeToken = getCachedGoogleToken();
    setToken(activeToken);
  }, []);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeToken = await connectGoogleDrive();
      setToken(activeToken);
    } catch (err: any) {
      console.error(err);
      setError('Falha ao conectar com o Google Drive. Verifique se as permissões foram concedidas.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setToken(null);
    setItems([]);
  };

  // Fetch files and folders inside the current active folder
  const fetchFolderContents = async (folderId: string = currentFolder.id) => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent('files(id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink, createdTime)');
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=folder%2Cname&pageSize=100`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleDisconnect();
          throw new Error('Sua autorização expirou. Reconecte o Google Drive para continuar.');
        }
        throw new Error(`Erro na API do Google Drive (HTTP ${response.status})`);
      }

      const data = await response.json();
      setItems(data.files || []);
    } catch (err: any) {
      console.error('Error fetching folder contents:', err);
      setError(err.message || 'Falha ao sincronizar conteúdos com o Google Drive.');
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch contents when folder or token changes
  useEffect(() => {
    if (token) {
      fetchFolderContents(currentFolder.id);
    }
  }, [token, currentFolder.id]);

  // Navigate deeper into a subfolder
  const navigateToFolder = (id: string, name: string) => {
    const updatedHistory = [...folderHistory, { id, name }];
    setFolderHistory(updatedHistory);
    setCurrentFolder({ id, name });
  };

  // Go back up using history
  const navigateBack = () => {
    if (folderHistory.length <= 1) return;
    const updatedHistory = [...folderHistory];
    updatedHistory.pop(); // Remove current
    const prevFolder = updatedHistory[updatedHistory.length - 1];
    setFolderHistory(updatedHistory);
    setCurrentFolder(prevFolder);
  };

  // Go directly to a historic breadcrumb index
  const navigateToBreadcrumb = (index: number) => {
    const updatedHistory = folderHistory.slice(0, index + 1);
    const targetFolder = updatedHistory[updatedHistory.length - 1];
    setFolderHistory(updatedHistory);
    setCurrentFolder(targetFolder);
  };

  // Create a new folder named after Retranca/Materia
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newFolderName.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const metadata = {
        name: newFolderName.trim(),
        mimeType: 'application/vnd.google-apps.folder',
        parents: [currentFolder.id]
      };

      const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        throw new Error('Não foi possível criar a pasta no Google Drive.');
      }

      setNewFolderName('');
      setIsCreatingFolder(false);
      // Refresh current directory
      await fetchFolderContents(currentFolder.id);
    } catch (err: any) {
      console.error('Create folder error:', err);
      setError(err.message || 'Falha ao criar pasta de matéria.');
    } finally {
      setIsLoading(false);
    }
  };

  // File Uploader
  const handleFileUpload = async (files: FileList | null) => {
    if (!token || !files || files.length === 0) return;

    setUploadStatus('Preparando uploads...');
    setError(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadId = `${file.name}-${Date.now()}`;
      setUploadProgress(prev => ({ ...prev, [uploadId]: 5 }));

      try {
        const boundary = '314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadata = {
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          parents: [currentFolder.id]
        };

        const reader = new FileReader();
        const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });

        const metadataHeader = 
          `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
          `${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\n`;

        const fileHeader = `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;

        const headerBlob = new Blob([delimiter + metadataHeader + fileHeader]);
        const footerBlob = new Blob(['\r\n' + closeDelimiter]);
        const bodyBlob = new Blob([headerBlob, fileBuffer, footerBlob]);

        setUploadProgress(prev => ({ ...prev, [uploadId]: 30 }));
        setUploadStatus(`Enviando: ${file.name}...`);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: bodyBlob
        });

        if (!response.ok) {
          throw new Error(`Erro de rede no arquivo: ${file.name}`);
        }

        const result = await response.json();

        // Grant anyone with link permissions
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              role: 'reader',
              type: 'anyone',
              allowFileDiscovery: false
            })
          });
        } catch (pe) {
          console.warn('Permission update ignored:', pe);
        }

        setUploadProgress(prev => ({ ...prev, [uploadId]: 100 }));
      } catch (err: any) {
        console.error('Upload item failed:', err);
        setError(`Erro ao enviar "${file.name}": ${err.message || 'Falha no upload'}`);
      }
    }

    // Finished
    setTimeout(() => {
      setUploadProgress({});
      setUploadStatus(null);
    }, 1500);

    // Refresh contents
    fetchFolderContents(currentFolder.id);
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  // Delete item handler
  const handleDeleteItem = async (itemId: string, itemName: string, isFolder: boolean) => {
    const typeLabel = isFolder ? 'esta pasta e todos os seus conteúdos' : `o arquivo "${itemName}"`;
    if (!window.confirm(`Tem certeza que deseja deletar permanentemente ${typeLabel}? Esta operação não pode ser desfeita.`)) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Falha ao deletar o item no Google Drive.');
      }

      await fetchFolderContents(currentFolder.id);
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message || 'Erro ao remover item.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper categorization functions
  const isFolder = (item: DriveItem) => item.mimeType === 'application/vnd.google-apps.folder';
  const isImage = (item: DriveItem) => item.mimeType.startsWith('image/');
  const isVideo = (item: DriveItem) => item.mimeType.startsWith('video/') || item.name.endsWith('.mp4') || item.name.endsWith('.mov') || item.name.endsWith('.mkv');
  const isAudio = (item: DriveItem) => item.mimeType.startsWith('audio/') || item.name.endsWith('.mp3') || item.name.endsWith('.wav') || item.name.endsWith('.m4a');

  // Filter lists based on search
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const folders = filteredItems.filter(isFolder);
  const files = filteredItems.filter(item => !isFolder(item));

  return (
    <div className="space-y-6 text-left">
      {/* Tab Header with Ambient decoration */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-850 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Folder className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-display font-extrabold text-zinc-100 tracking-tight">
              Materiais Brutos
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl font-sans">
            Gerenciador integrado de arquivos de apoio. Organize imagens, vídeos e áudios brutos enviados pela equipe em pastas com a retranca de cada matéria.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {token ? (
            <button
              onClick={handleDisconnect}
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-red-400 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Desconectar Drive
            </button>
          ) : (
            <button
              onClick={handleConnect}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
            >
              <Sparkles className="w-4 h-4" />
              Conectar Google Drive
            </button>
          )}

          <button
            onClick={() => fetchFolderContents(currentFolder.id)}
            disabled={!token || isLoading}
            className="p-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            title="Recarregar pasta atual"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {!token ? (
        // Unauthenticated state view
        <div className="p-12 text-center border border-zinc-850/80 rounded-3xl bg-zinc-950/40 max-w-xl mx-auto space-y-5 my-8">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-zinc-100 font-display font-extrabold text-base">Vincule sua conta para ver os Brutos</h3>
            <p className="text-zinc-500 text-xs font-sans leading-relaxed">
              O gerenciador de materiais brutos requer autenticação direta com o Google Drive para ler os diretórios criados no repositório de produção.
            </p>
          </div>
          <button
            onClick={handleConnect}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-2 mx-auto shadow-lg shadow-amber-500/10"
          >
            <Sparkles className="w-4 h-4" />
            Vincular Google Drive
          </button>
          <div className="pt-2">
            <span className="text-[10px] text-zinc-650 font-mono block">PASTA RAIZ DOS MATERIAIS</span>
            <a 
              href="https://drive.google.com/drive/folders/1wV_Tw9jHTW-x-KeSWS-GWpXVQIIfu81Y?usp=drive_link" 
              target="_blank" 
              rel="noreferrer"
              className="text-[10px] text-amber-500/70 hover:text-amber-500 underline flex items-center gap-1 justify-center mt-1"
            >
              Abrir pasta no navegador <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      ) : (
        // Authenticated explorer view
        <div className="space-y-5">
          
          {/* Error notice if any */}
          {error && (
            <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-2xl flex items-start gap-3 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Ocorreu um erro:</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Breadcrumb Navigation Trail */}
          <div className="bg-zinc-900/30 border border-zinc-850/80 px-4 py-3 rounded-2xl flex flex-wrap items-center gap-1.5 text-xs no-print select-none">
            {folderHistory.map((folder, index) => (
              <React.Fragment key={folder.id}>
                {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className={`font-semibold hover:text-amber-400 transition-colors cursor-pointer ${
                    index === folderHistory.length - 1 ? 'text-amber-500 font-extrabold' : 'text-zinc-400'
                  }`}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            ))}

            {/* Back Arrow button */}
            {folderHistory.length > 1 && (
              <button
                onClick={navigateBack}
                className="ml-auto text-zinc-500 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold uppercase"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </button>
            )}
          </div>

          {/* Operations Toolbar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            {/* Search Input */}
            <div className="md:col-span-6 relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Filtrar arquivos ou pastas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/60 border border-zinc-850 text-zinc-200 pl-10 pr-4 py-2.5 rounded-xl text-xs placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-amber-500/40 transition-all font-sans"
              />
            </div>

            {/* Create Folder & File Upload buttons */}
            <div className="md:col-span-6 flex flex-wrap items-center gap-3 md:justify-end">
              {currentFolder.id !== BRUTOS_ROOT_FOLDER_ID && (
                <button
                  onClick={() => downloadFolderAsZip(currentFolder.id, currentFolder.name)}
                  disabled={!!zippingFolderId}
                  className="px-3.5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-lg shadow-green-600/10 disabled:opacity-50"
                  title="Compactar e baixar todos os arquivos desta pasta"
                >
                  {zippingFolderId === currentFolder.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderDown className="w-4 h-4" />
                  )}
                  Baixar Pasta Completa (.ZIP)
                </button>
              )}

              <button
                onClick={() => setIsCreatingFolder(true)}
                className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
              >
                <FolderPlus className="w-4 h-4 text-amber-500" />
                Nova Pasta de Matéria
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
              >
                <FileUp className="w-4 h-4" />
                Upload de Materiais
              </button>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>
          </div>

          {/* Create Folder Inline Modal / Overlay */}
          {isCreatingFolder && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <form 
                onSubmit={handleCreateFolder}
                className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <span className="text-sm font-bold text-zinc-200">Criar Nova Pasta (Retranca)</span>
                  <button 
                    type="button"
                    onClick={() => setIsCreatingFolder(false)}
                    className="text-zinc-500 hover:text-zinc-200 text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Nome da Pasta / Retranca</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: RECONSTRUCAO_PONTE"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500/40 text-xs placeholder-zinc-700 transition-colors uppercase font-semibold"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(false)}
                    className="px-3.5 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Criar Pasta
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Upload Status bar */}
          {uploadStatus && (
            <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="font-bold flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  {uploadStatus}
                </span>
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                {Object.entries(uploadProgress).map(([name, progress]) => (
                  <div key={name} className="flex items-center gap-3 text-[10px]">
                    <span className="text-zinc-450 truncate w-40">{name.split('-')[0]}</span>
                    <div className="flex-1 h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="font-mono text-amber-500">{progress}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zip/Download Progress status bar */}
          {zipProgressStatus && (
            <div className="p-4 bg-zinc-900 border border-zinc-850 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-350">
                <span className="font-bold flex items-center gap-2 text-green-400">
                  <Loader2 className="w-3.5 h-3.5 text-green-500 animate-spin animate-duration-1000" />
                  {zipProgressStatus}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 animate-pulse" style={{ width: '100%' }} />
              </div>
            </div>
          )}

          {/* Interactive Drag and Drop Upload Area */}
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`p-8 border-2 border-dashed rounded-3xl text-center transition-all ${
              dragActive 
                ? 'border-amber-500 bg-amber-500/5 shadow-inner' 
                : 'border-zinc-850 bg-zinc-950/20 hover:border-zinc-800'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
              <UploadCloud className={`w-8 h-8 ${dragActive ? 'text-amber-500 animate-bounce' : 'text-zinc-650'}`} />
              <div className="text-xs">
                <span className="text-zinc-300 font-bold">Arraste seus brutos aqui</span>
                <span className="text-zinc-500 font-sans"> ou clique em "Upload de Materiais" para enviar</span>
              </div>
              <span className="text-[10px] text-zinc-600 font-mono uppercase">VÍDEOS, FOTOS E ÁUDIOS DE APOIO</span>
            </div>
          </div>

          {/* Directory Content List */}
          {isLoading && items.length === 0 ? (
            <div className="p-16 text-center">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
              <p className="text-zinc-500 text-xs mt-3 font-sans">Sincronizando diretório com o Google Drive...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-16 text-center border border-zinc-850/65 rounded-3xl bg-zinc-950/10 space-y-2">
              <Folder className="w-10 h-10 text-zinc-750 mx-auto" />
              <h4 className="text-zinc-400 font-bold text-xs">Esta pasta está vazia</h4>
              <p className="text-zinc-600 text-[11px] font-sans">
                Nenhum arquivo ou subpasta foi encontrado aqui. Crie uma pasta ou faça upload de arquivos para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* SECTION: Folders (Sub-directiories) */}
              {folders.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Subpastas de Matérias</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="p-3.5 bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 rounded-xl flex items-center justify-between gap-3 group transition-all"
                      >
                        <button
                          onClick={() => navigateToFolder(folder.id, folder.name)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <Folder className="w-5 h-5 text-amber-500 shrink-0 fill-amber-500/10" />
                          <span className="text-xs font-bold text-zinc-200 group-hover:text-amber-400 truncate uppercase tracking-wide">
                            {folder.name}
                          </span>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => downloadFolderAsZip(folder.id, folder.name)}
                            disabled={!!zippingFolderId}
                            className="p-1.5 text-zinc-650 hover:text-green-400 hover:bg-green-950/20 rounded transition-all cursor-pointer md:opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            title="Baixar pasta inteira como .ZIP"
                          >
                            {zippingFolderId === folder.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-green-500" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => handleDeleteItem(folder.id, folder.name, true)}
                            disabled={!!zippingFolderId}
                            className="p-1.5 text-zinc-650 hover:text-red-400 hover:bg-red-950/20 rounded transition-all cursor-pointer md:opacity-0 group-hover:opacity-100"
                            title="Deletar pasta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION: Files */}
              {files.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Arquivos Brutos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {files.map((file) => {
                      const sizeLabel = file.size ? formatBytes(file.size) : '-';
                      const isImg = isImage(file);
                      const isVid = isVideo(file);
                      const isAud = isAudio(file);

                      return (
                        <div 
                          key={file.id} 
                          className="bg-zinc-900/20 border border-zinc-850 hover:border-zinc-800 rounded-2xl overflow-hidden flex flex-col group transition-all hover:shadow-xl"
                        >
                          {/* File Preview thumbnail area */}
                          <div className="aspect-video bg-zinc-950/60 relative flex items-center justify-center border-b border-zinc-900 overflow-hidden">
                            {isImg && file.thumbnailLink ? (
                              <img 
                                src={file.thumbnailLink.replace('=s220', '=s600')} 
                                alt={file.name} 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" 
                              />
                            ) : isVid && file.thumbnailLink ? (
                              <div className="w-full h-full relative">
                                <img 
                                  src={file.thumbnailLink.replace('=s220', '=s600')} 
                                  alt={file.name} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover brightness-50 group-hover:scale-105 transition-all duration-300" 
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-9 h-9 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
                                    <Play className="w-4 h-4 text-white fill-white shrink-0 ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center text-zinc-600">
                                {isImg && <Image className="w-8 h-8 text-indigo-500/60" />}
                                {isVid && <Video className="w-8 h-8 text-rose-500/60" />}
                                {isAud && <Music className="w-8 h-8 text-amber-500/60" />}
                                {!isImg && !isVid && !isAud && <FileText className="w-8 h-8 text-zinc-500" />}
                              </div>
                            )}

                            {/* Overlay tag for file type */}
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-black/70 border border-zinc-850 text-zinc-300">
                              {isImg && 'Imagem'}
                              {isVid && 'Vídeo'}
                              {isAud && 'Áudio'}
                              {!isImg && !isVid && !isAud && 'Arquivo'}
                            </div>
                          </div>

                          {/* Info Area */}
                          <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                            <div className="space-y-0.5">
                              <span className="text-[11px] font-semibold text-zinc-200 line-clamp-2 uppercase leading-snug break-all" title={file.name}>
                                {file.name}
                              </span>
                              <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-mono">
                                <span>{sizeLabel}</span>
                                <span>•</span>
                                <span>{file.createdTime ? new Date(file.createdTime).toLocaleDateString('pt-BR') : ''}</span>
                              </div>
                            </div>

                            {/* Actions bar */}
                            <div className="flex items-center gap-1.5 border-t border-zinc-900 pt-2.5 mt-2">
                              {/* Open link */}
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors border border-zinc-850"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Abrir
                              </a>

                              {/* Download link */}
                              {file.webContentLink && (
                                <a
                                  href={file.webContentLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 text-zinc-400 hover:text-white rounded-lg cursor-pointer transition-colors"
                                  title="Fazer Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}

                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteItem(file.id, file.name, false)}
                                className="p-1.5 bg-zinc-900 hover:bg-red-950/30 border border-zinc-850 hover:border-red-900/30 text-zinc-650 hover:text-red-400 rounded-lg cursor-pointer transition-all"
                                title="Deletar arquivo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}
