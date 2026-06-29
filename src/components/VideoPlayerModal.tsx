import React, { useRef, useEffect } from 'react';
import { X, Play, AlertCircle, Video, Download, ExternalLink } from 'lucide-react';

function getGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  const idParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam && idParam[1]) {
    return idParam[1];
  }
  return null;
}

interface VideoPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoTitle: string;
  isLocalMissing?: boolean;
  onReassociate?: () => void;
}

export default function VideoPlayerModal({
  isOpen,
  onClose,
  videoUrl,
  videoTitle,
  isLocalMissing = false,
  onReassociate
}: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const driveId = getGoogleDriveFileId(videoUrl);
  const isDriveVideo = !!driveId;

  // Play / pause effect or reset
  useEffect(() => {
    if (isOpen && videoRef.current && !isDriveVideo) {
      videoRef.current.load();
      videoRef.current.play().catch(err => {
        console.log("Autoplay blocked or failed:", err);
      });
    }
  }, [isOpen, videoUrl, isDriveVideo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md no-print">
      <div 
        className="w-full max-w-3xl bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <Video className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-zinc-100 font-display">
                Player de Vídeo Integrado
              </h3>
              <p className="text-xs text-zinc-400 font-mono truncate mt-0.5 max-w-[200px] sm:max-w-md" title={videoTitle}>
                {videoTitle || "Sem Título"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isDriveVideo && driveId && (
              <>
                {/* Download Button */}
                <a
                  href={`https://drive.google.com/uc?export=download&id=${driveId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-all active:scale-95 duration-100 shadow-md shadow-amber-500/10 cursor-pointer"
                  title="Baixar Vídeo (Google Drive)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Vídeo</span>
                </a>
                
                {/* Open in Drive Button */}
                <a
                  href={`https://drive.google.com/file/d/${driveId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                  title="Abrir no Google Drive"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir no Drive</span>
                </a>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div className="relative aspect-video bg-black flex items-center justify-center">
          {isLocalMissing ? (
            <div className="p-8 text-center max-w-md space-y-4">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mx-auto text-amber-500">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-zinc-200">Vídeo Local Pendente</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Este vídeo está vinculado localmente sob o nome <span className="font-mono text-zinc-300">"{videoTitle}"</span>. 
                  Como você recarregou a página ou trocou de aba, o navegador precisa que você re-selecione o arquivo no seu computador para reproduzi-lo de forma segura.
                </p>
              </div>
              {onReassociate && (
                <button
                  onClick={onReassociate}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-md inline-flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Re-vincular Arquivo Agora
                </button>
              )}
            </div>
          ) : isDriveVideo ? (
            <iframe
              src={`https://drive.google.com/file/d/${driveId}/preview`}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full h-full object-contain"
              playsInline
            >
              Seu navegador não suporta a tag de vídeo HTML5.
            </video>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-900 border-t border-zinc-800 text-[11px] text-zinc-500">
          <span className="font-mono text-zinc-400">
            {isLocalMissing 
              ? "Aguardando re-associação do arquivo" 
              : isDriveVideo 
                ? "Modo: Google Drive Streaming Integrado" 
                : "Modo: Reprodução Local do Navegador (Sem Delay / Sem Internet)"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Fechar Player
          </button>
        </div>
      </div>
    </div>
  );
}
