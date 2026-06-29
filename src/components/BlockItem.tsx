import React, { useState } from 'react';
import { 
  ArrowUp, ArrowDown, Trash2, Plus, FileText, ChevronDown, ChevronUp, Clock, Megaphone, Film, GripVertical,
  Link, Download, Edit2, ExternalLink, Play, Video, AlertCircle
} from 'lucide-react';
import { Block, Lauda, Colaborador, capitalizeName } from '../types';
import GoogleDriveModal from './GoogleDriveModal';
import VideoPlayerModal from './VideoPlayerModal';

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

interface BlockItemProps {
  key?: string;
  block: Block;
  index: number;
  totalBlocksCount: number;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateBlockTitle: (id: string, newTitle: string) => void;
  onAddLauda: (blockId: string) => void;
  onDeleteLauda: (blockId: string, laudaId: string) => void;
  onUpdateLauda: (blockId: string, laudaId: string, fields: Partial<Lauda>) => void;
  onOpenLaudaEditor: (blockId: string, lauda: Lauda) => void;
  onMoveLaudaUp: (blockId: string, laudaId: string) => void;
  onMoveLaudaDown: (blockId: string, laudaId: string) => void;
  onMoveLaudaAcrossBlocks: (laudaId: string, sourceBlockId: string, destBlockId: string, destIndex?: number) => void;
  blockDurationStr: string;
  colaboradores?: Colaborador[];
}

export default function BlockItem({
  block,
  index,
  totalBlocksCount,
  onMoveUp,
  onMoveDown,
  onDelete,
  onUpdateBlockTitle,
  onAddLauda,
  onDeleteLauda,
  onUpdateLauda,
  onOpenLaudaEditor,
  onMoveLaudaUp,
  onMoveLaudaDown,
  onMoveLaudaAcrossBlocks,
  blockDurationStr,
  colaboradores = []
}: BlockItemProps) {
  // State to track expanded previews for story scripts
  const [expandedLaudas, setExpandedLaudas] = useState<Record<string, boolean>>({});

  // State to track active dropdown search for each lauda presenter
  const [activeDropdownLaudaId, setActiveDropdownLaudaId] = useState<string | null>(null);

  // Inline Google Drive video editor states
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkValue, setEditingLinkValue] = useState<string>('');

  // Google Drive Modal State
  const [driveModalState, setDriveModalState] = useState<{
    isOpen: boolean;
    laudaId: string;
    laudaTitulo: string;
    currentLink: string;
  }>({
    isOpen: false,
    laudaId: '',
    laudaTitulo: '',
    currentLink: '',
  });

  // Built-in HTML5 Video Player Modal State
  const [playerModalState, setPlayerModalState] = useState<{
    isOpen: boolean;
    videoUrl: string;
    videoTitle: string;
    isLocalMissing: boolean;
    laudaId: string;
    blockId: string;
  }>({
    isOpen: false,
    videoUrl: '',
    videoTitle: '',
    isLocalMissing: false,
    laudaId: '',
    blockId: ''
  });

  // Helper converter to direct download link
  const getGoogleDriveDownloadUrl = (url: string): string => {
    if (!url) return '';
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
    return url;
  };

  // Native drag & drop trackable states
  const [draggedOverLaudaId, setDraggedOverLaudaId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | null>(null);
  const [isDragOverBlock, setIsDragOverBlock] = useState(false);

  const toggleLaudaPreview = (laudaId: string) => {
    setExpandedLaudas(prev => ({
      ...prev,
      [laudaId]: !prev[laudaId]
    }));
  };

  const isComercial = block.tipo === 'comercial';

  return (
    <div 
      className={`bg-[#18181b] border rounded-xl overflow-hidden shadow-xl mb-6 page-break-inside-avoid break-inside-avoid transition-all duration-200 ${
        isDragOverBlock 
          ? 'border-amber-550/70 shadow-[0_0_25px_rgba(245,158,11,0.18)] bg-amber-500/[0.01]' 
          : 'border-zinc-800/80'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        // Only set block dragover if we're not dragging over a row
        if (!draggedOverLaudaId) {
          setIsDragOverBlock(true);
        }
      }}
      onDragLeave={() => {
        setIsDragOverBlock(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOverBlock(false);
        try {
          const dataStr = e.dataTransfer.getData('text/plain');
          if (!dataStr) return;
          const { laudaId, sourceBlockId } = JSON.parse(dataStr);
          onMoveLaudaAcrossBlocks(laudaId, sourceBlockId, block.id);
        } catch (err) {
          console.error(err);
        }
      }}
    >
      
      {/* Block Header Toolbar */}
      <div className={`px-5 py-3.5 flex items-center justify-between border-b ${
        isComercial 
          ? 'bg-zinc-900 border-zinc-800 text-zinc-100' 
          : 'bg-[#1f1f23] border-zinc-800 text-zinc-100'
      }`}>
        <div className="flex items-center gap-3 w-full max-w-sm mr-4 no-print">
          {isComercial ? (
            <div className="p-1 px-2.5 bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300 uppercase rounded-md tracking-wider flex items-center gap-1 shrink-0">
              <Megaphone className="w-3.5 h-3.5 text-amber-500" />
              <span>Intervalo</span>
            </div>
          ) : (
            <div className="p-1 px-2.5 bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300 uppercase rounded-md tracking-wider flex items-center gap-1 shrink-0">
              <Film className="w-3.5 h-3.5 text-emerald-500" />
              <span>Coteúdo</span>
            </div>
          )}

          {/* Inline Title Editor */}
          <input
            type="text"
            value={block.titulo}
            onChange={(e) => onUpdateBlockTitle(block.id, e.target.value)}
            className="bg-transparent font-display font-semibold text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/50 px-2 py-1 rounded w-full border border-transparent hover:border-zinc-800 focus:bg-zinc-950/40"
            placeholder={isComercial ? "Ex: INTERVALO COMERCIAL" : `Ex: Bloco ${index + 1}`}
          />
        </div>

        {/* Printed block title */}
        <div className="hidden print-only text-black font-semibold text-md pb-1.5 w-full border-b border-black">
          {block.titulo} {isComercial && "(Intervalo Comercial)"}
        </div>

        {/* Block Header Control Actions */}
        <div className="flex items-center gap-1.5 no-print">
          {/* Re-order buttons */}
          <button
            onClick={() => onMoveUp(block.id)}
            disabled={index === 0}
            className="p-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-770 rounded-md text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-zinc-850 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Mover bloco para cima"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={() => onMoveDown(block.id)}
            disabled={index === totalBlocksCount - 1}
            className="p-1.5 bg-zinc-850 hover:bg-zinc-800 border border-zinc-770 rounded-md text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-zinc-850 disabled:cursor-not-allowed transition-all cursor-pointer"
            title="Mover bloco para baixo"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Delete block */}
          <button
            onClick={() => onDelete(block.id)}
            className="p-1.5 bg-red-950/60 hover:bg-red-900/60 border border-red-900/40 rounded-md text-red-400 hover:text-red-200 transition-all ml-1 cursor-pointer"
            title="Excluir Bloco"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scroll indicator for mobile */}
      <div className="lg:hidden text-center py-2 bg-zinc-900/60 border-b border-zinc-850/60 text-[10px] text-amber-500/90 uppercase font-bold tracking-widest flex items-center justify-center gap-1.5 no-print select-none">
        <span>← Arraste para o lado para ver o Link do Vídeo e Ações →</span>
      </div>

      {/* Stories/Laudas List Table */}
      <div className="p-0 overflow-x-auto scrollbar-thin">
        <table className="min-w-[920px] lg:min-w-0 w-full border-collapse text-left text-sm print-border">
          <thead>
            <tr className="bg-zinc-900/40 border-b border-zinc-800 text-zinc-400 font-medium text-xs uppercase tracking-wider print:bg-[#f0f0f0] print:text-black">
              <th className="py-3 px-4 border-r border-zinc-850 col-ordem print:border-black text-center w-12">Página</th>
              {!isComercial && (
                <th className="py-3 px-4 border-r border-zinc-850 col-tipo print:border-black w-28 text-center">Tipo</th>
              )}
              {!isComercial && (
                <th className="py-3 px-4 border-r border-zinc-850 col-retranca print:border-black">Retranca / Assunto</th>
              )}
              <th className="py-3 px-4 border-r border-zinc-850 col-duracao print:border-black w-28 text-center">Duração</th>
              {!isComercial && (
                <>
                  <th className="py-3 px-4 border-r border-zinc-850 col-apresentador print:border-black">Repórter/Apre</th>
                  <th className="py-3 px-4 border-r border-zinc-850 text-center no-print w-48">LINK VÍDEO</th>
                  <th className="py-3 px-4 text-center no-print w-32">Ações</th>
                </>
              )}
              {isComercial && (
                <th className="py-3 px-4 text-center no-print w-24">Ação</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850 select-text font-normal print:divide-black">
            {block.laudas.length === 0 ? (
              <tr>
                <td colSpan={isComercial ? 3 : 7} className="py-6 text-center text-zinc-605 text-xs italic">
                  Nenhuma lauda cadastrada neste bloco. Arraste uma lauda para cá!
                </td>
              </tr>
            ) : (
              block.laudas.map((lauda, lIdx) => {
                const hasContent = lauda.laudaContent && lauda.laudaContent.trim() !== '';
                const isExpanded = !!expandedLaudas[lauda.id];

                return (
                  <React.Fragment key={lauda.id}>
                    {/* Primary Row with dragging capability */}
                    <tr 
                      draggable
                      onDoubleClick={(e) => {
                        if (isComercial) return;
                        const target = e.target as HTMLElement;
                        if (
                          target.tagName === 'INPUT' || 
                          target.tagName === 'SELECT' || 
                          target.tagName === 'BUTTON' || 
                          target.closest('button')
                        ) {
                          return;
                        }
                        onOpenLaudaEditor(block.id, lauda);
                      }}
                      onDragStart={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          target.tagName === 'INPUT' || 
                          target.tagName === 'SELECT' || 
                          target.tagName === 'BUTTON' || 
                          target.closest('button')
                        ) {
                          e.preventDefault();
                          return;
                        }
                        e.dataTransfer.setData('text/plain', JSON.stringify({ laudaId: lauda.id, sourceBlockId: block.id }));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relativeY = e.clientY - rect.top;
                        const pos = (relativeY / rect.height) < 0.5 ? 'top' : 'bottom';
                        setDraggedOverLaudaId(lauda.id);
                        setDragOverPosition(pos);
                      }}
                      onDragLeave={() => {
                        setDraggedOverLaudaId(null);
                        setDragOverPosition(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDraggedOverLaudaId(null);
                        setDragOverPosition(null);
                        try {
                          const dataStr = e.dataTransfer.getData('text/plain');
                          if (!dataStr) return;
                          const { laudaId, sourceBlockId } = JSON.parse(dataStr);
                          
                          let finalIndex = lIdx;
                          if (dragOverPosition === 'bottom') {
                            finalIndex = lIdx + 1;
                          }
                          onMoveLaudaAcrossBlocks(laudaId, sourceBlockId, block.id, finalIndex);
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className={`hover:bg-zinc-900/35 transition-all duration-150 print:hover:bg-transparent ${
                        draggedOverLaudaId === lauda.id
                          ? (dragOverPosition === 'top'
                              ? 'border-t-2 border-amber-500 shadow-[inset_0_4px_12px_rgba(245,158,11,0.15)] bg-amber-500/5'
                              : 'border-b-2 border-amber-500 shadow-[inset_0_-4px_12px_rgba(245,158,11,0.15)] bg-amber-500/5')
                          : 'border-b border-zinc-850/40'
                      }`}
                    >
                      {/* Counter Index Column with visual Grip vertical handle */}
                      <td className="py-2.5 px-3 text-center border-r border-zinc-850 text-zinc-500 font-mono text-xs select-none print:text-black print:border-black align-middle cursor-grab active:cursor-grabbing hover:bg-zinc-800/10 hover:text-zinc-300">
                        <div className="flex items-center justify-between gap-1.5 px-0.5 no-print">
                          <GripVertical className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          <span className="w-full text-center font-bold">{lIdx + 1}</span>
                        </div>
                        <span className="hidden print:inline">{lIdx + 1}</span>
                      </td>

                      {/* Story format (Tipo: VT, VIVO, ESTUDIO) - Normal block only */}
                      {!isComercial && (
                        <td className="py-2.5 px-3 border-r border-zinc-850 text-center select-none print:border-black print:text-black">
                          <select
                            value={lauda.tipo}
                            onChange={(e) => onUpdateLauda(block.id, lauda.id, { tipo: e.target.value })}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-xs font-semibold px-2 py-1 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-transparent cursor-pointer print:border-none print:bg-transparent print:text-black print:appearance-none w-full text-center"
                          >
                            {['VT', 'VIVO', 'ESTÚDIO', 'NOTA', 'VINHETA', 'ENCERRAMENTO', 'LOCV', 'ILUSTRA', 'IMG', 'SNRA'].map(op => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* Story Slug (Retranca) - Normal block only */}
                      {!isComercial && (
                        <td className="py-2.5 px-3 border-r border-zinc-850 print:border-black print:text-black">
                          <input
                            type="text"
                            value={lauda.materia}
                            onChange={(e) => onUpdateLauda(block.id, lauda.id, { materia: e.target.value })}
                            className="w-full bg-transparent text-zinc-100 font-sans text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/40 px-2 py-1 rounded placeholder-zinc-700 print:text-black"
                            placeholder="RETRANCA"
                          />
                        </td>
                      )}

                      {/* Duration Time Field */}
                      <td className="py-2.5 px-3 border-r border-zinc-850 print:border-black print:text-black">
                        {(() => {
                          const [mStr, sStr] = (lauda.duracao || "00:00").split(':');
                          const minutesVal = isNaN(parseInt(mStr)) ? 0 : parseInt(mStr);
                          const secondsVal = isNaN(parseInt(sStr)) ? 0 : parseInt(sStr);
                          return (
                            <>
                              <div className="flex items-center justify-center gap-1 min-w-[95px] print:hidden">
                                <select
                                  value={minutesVal}
                                  onChange={(e) => {
                                    const newM = e.target.value.padStart(2, '0');
                                    const s = (sStr || "00").padStart(2, '0');
                                    onUpdateLauda(block.id, lauda.id, { duracao: `${newM}:${s}` });
                                  }}
                                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-xs px-1 py-0.5 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/45 text-center min-w-[42px]"
                                >
                                  {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                                    <option key={m} value={m}>{String(m).padStart(2, '0')}m</option>
                                  ))}
                                </select>
                                <span className="text-zinc-650 font-mono text-xs">:</span>
                                <select
                                  value={secondsVal}
                                  onChange={(e) => {
                                    const newS = e.target.value.padStart(2, '0');
                                    const m = (mStr || "00").padStart(2, '0');
                                    onUpdateLauda(block.id, lauda.id, { duracao: `${m}:${newS}` });
                                  }}
                                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-xs px-1 py-0.5 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500/45 text-center min-w-[42px]"
                                >
                                  {Array.from({ length: 60 }, (_, i) => i).map((s) => (
                                    <option key={s} value={s}>{String(s).padStart(2, '0')}s</option>
                                  ))}
                                </select>
                              </div>
                              <span className="hidden print:inline-block text-zinc-200 font-mono text-xs font-semibold text-center w-full">
                                {lauda.duracao || "00:00"}
                              </span>
                            </>
                          );
                        })()}
                      </td>

                      {/* Presenter / Reporter - Normal block only */}
                      {!isComercial && (() => {
                        const searchStr = (lauda.apresentador || '').toLowerCase();
                        const matchingColabs = colaboradores.filter(c => 
                          c.nome.toLowerCase().includes(searchStr)
                        );
                        return (
                          <td className="py-2.5 px-3 border-r border-zinc-850 print:border-black print:text-black relative">
                            <input
                              type="text"
                              value={lauda.apresentador}
                              onChange={(e) => onUpdateLauda(block.id, lauda.id, { apresentador: e.target.value })}
                              onFocus={() => setActiveDropdownLaudaId(lauda.id)}
                              onBlur={() => {
                                onUpdateLauda(block.id, lauda.id, { apresentador: capitalizeName(lauda.apresentador || '') });
                                setTimeout(() => {
                                  setActiveDropdownLaudaId(null);
                                }, 200);
                              }}
                              className="w-full bg-transparent text-zinc-100 font-sans text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40 px-2 py-1 rounded placeholder-zinc-700 print:text-black"
                              placeholder="Apre/Repór"
                            />
                            {activeDropdownLaudaId === lauda.id && matchingColabs.length > 0 && (
                              <div className="absolute left-1 right-1 top-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl max-h-44 overflow-y-auto z-50 py-1.5 scrollbar-none">
                                {matchingColabs.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onMouseDown={() => {
                                      onUpdateLauda(block.id, lauda.id, { apresentador: c.nome });
                                      setActiveDropdownLaudaId(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-amber-500 hover:text-zinc-950 flex items-center justify-between transition-colors font-sans uppercase group/item"
                                  >
                                    <span className="font-extrabold text-zinc-300 group-hover/item:text-zinc-950 truncate mr-2">{c.nome}</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 group-hover/item:bg-amber-600 group-hover/item:text-zinc-950 group-hover/item:border-amber-700 shrink-0 uppercase">
                                      {c.funcao}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })()}

                      {/* Video Attachment Column */}
                      {!isComercial && (
                        <td className="py-2.5 px-3 border-r border-zinc-850 no-print text-center select-none font-sans">
                          {lauda.driveLink ? (() => {
                            const link = lauda.driveLink;
                            const isLocal = link.startsWith('local://');
                            const fileName = isLocal ? link.replace('local://', '') : '';
                            const isCached = isLocal && typeof window !== 'undefined' && window.localVideoCache && window.localVideoCache[fileName];
                            
                            let buttonStyle = "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-550/20 text-amber-500";
                            let buttonText = "Assistir";
                            let icon = <Play className="w-3 h-3 fill-current mt-0.5" />;
                            
                            if (isLocal && !isCached) {
                              buttonStyle = "bg-red-500/5 hover:bg-red-500/15 border border-red-500/20 text-red-400";
                              buttonText = "Re-vincular";
                              icon = <AlertCircle className="w-3.5 h-3.5 animate-pulse text-red-400" />;
                            } else if (isLocal) {
                              buttonStyle = "bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400";
                              buttonText = "Local/Play";
                            }

                            return (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isLocal && !isCached) {
                                      // Trigger re-association modal
                                      setDriveModalState({
                                        isOpen: true,
                                        laudaId: lauda.id,
                                        laudaTitulo: lauda.materia,
                                        currentLink: lauda.driveLink || ''
                                      });
                                    } else {
                                      const videoUrl = isLocal 
                                        ? window.localVideoCache![fileName].url 
                                        : link;
                                      setPlayerModalState({
                                        isOpen: true,
                                        videoUrl,
                                        videoTitle: isLocal ? fileName : (lauda.materia + " (Matéria)"),
                                        isLocalMissing: false,
                                        laudaId: lauda.id,
                                        blockId: block.id
                                      });
                                    }
                                  }}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold select-none transition-all cursor-pointer shadow-sm ${buttonStyle}`}
                                  title={isLocal ? `Vídeo Local: ${fileName}` : `Link do Vídeo: ${link}`}
                                >
                                  {icon}
                                  <span>{buttonText}</span>
                                </button>

                                {!isLocal && (() => {
                                  const driveId = getGoogleDriveFileId(link);
                                  const downloadUrl = driveId 
                                    ? `https://drive.google.com/uc?export=download&id=${driveId}` 
                                    : link;
                                  return (
                                    <a
                                      href={downloadUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-amber-500 rounded transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                      title="Baixar Vídeo"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  );
                                })()}
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDriveModalState({
                                      isOpen: true,
                                      laudaId: lauda.id,
                                      laudaTitulo: lauda.materia,
                                      currentLink: lauda.driveLink || ''
                                    });
                                  }}
                                  className="p-1.5 bg-zinc-900 border border-zinc-805 text-zinc-500 hover:text-white rounded transition-colors cursor-pointer"
                                  title="Editar Mídia"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateLauda(block.id, lauda.id, { driveLink: '' });
                                  }}
                                  className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                                  title="Desvincular"
                                >
                                  <span className="text-xs">✕</span>
                                </button>
                              </div>
                            );
                          })() : (
                            <button
                              type="button"
                              onClick={() => {
                                setDriveModalState({
                                  isOpen: true,
                                  laudaId: lauda.id,
                                  laudaTitulo: lauda.materia,
                                  currentLink: ''
                                });
                              }}
                              className="mx-auto flex items-center justify-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-zinc-205 rounded text-xs select-none transition-all cursor-pointer font-bold"
                            >
                              <Link className="w-3.5 h-3.5 text-zinc-500" />
                              <span>Vincular Vídeo</span>
                            </button>
                          )}
                        </td>
                      )}

                      {/* Story Actions control panel */}
                      <td className="py-2.5 px-3 text-center no-print select-none">
                        <div className="flex items-center justify-center gap-1">
                          
                          {/* Re-order arrows */}
                          {!isComercial && (
                            <div className="flex flex-col">
                              <button
                                onClick={() => onMoveLaudaUp(block.id, lauda.id)}
                                disabled={lIdx === 0}
                                className="text-zinc-500 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors p-0.5"
                                title="Subir Lauda"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onMoveLaudaDown(block.id, lauda.id)}
                                disabled={lIdx === block.laudas.length - 1}
                                className="text-zinc-500 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors p-0.5"
                                title="Descer Lauda"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Toggle display preview inline */}
                          {!isComercial && hasContent && (
                            <button
                              onClick={() => toggleLaudaPreview(lauda.id)}
                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white border border-transparent transition-all cursor-pointer"
                              title={isExpanded ? "Ocultar Pré-visualização" : "Mostrar Pré-visualização da Lauda"}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Delete story button */}
                          <button
                            onClick={() => onDeleteLauda(block.id, lauda.id)}
                            className="p-1.5 bg-zinc-800/80 hover:bg-red-950 text-zinc-400 hover:text-red-400 border border-transparent hover:border-red-900/40 rounded transition-colors cursor-pointer"
                            title="Remover Lauda/Linha"
                          >
                            <span className="text-xs">✖</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable/Printable Teleprompter script preview */}
                    {(isExpanded || hasContent) && (
                      <tr className={`${!isExpanded ? 'hidden print:table-row' : 'table-row'} bg-zinc-950/40`}>
                        <td />
                        <td colSpan={isComercial ? 2 : 6} className="py-2 px-4 text-left border-r border-zinc-850 print:border-black">
                          {lauda.laudaContent && (
                            <div className="text-amber-500/85 font-mono text-xs uppercase leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap py-2 px-3 border-l-2 border-amber-500/40 bg-amber-500/[0.01] print:text-black print:border-l-2 print:border-black print:bg-transparent print:max-h-none print:py-1">
                              {lauda.laudaContent}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Block Footer Summary & Controls */}
      <div className="py-3 px-5 bg-zinc-900/30 border-t border-zinc-800 flex items-center justify-between no-print select-none">
        <div>
          {!isComercial && (
            <button
              onClick={() => onAddLauda(block.id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#27272a] hover:bg-zinc-800 text-zinc-200 border border-zinc-700/50 hover:text-white rounded-lg text-xs font-semibold cursor-pointer active:scale-95 duration-100 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-400" />
              <span>Adicionar Lauda</span>
            </button>
          )}
        </div>

        {/* Localized Block cumulative duration */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 justify-end">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span>Soma do bloco:</span>
          <span className="font-mono text-sm font-bold text-zinc-200">
            {blockDurationStr}
          </span>
        </div>
      </div>

      {/* Localized Block duration for print */}
      <div className="hidden print-only py-2 text-right text-xs pr-4 border-t border-black text-black select-none font-bold">
        Tempo do bloco: {blockDurationStr}
      </div>

      {driveModalState.isOpen && (
        <GoogleDriveModal
          isOpen={driveModalState.isOpen}
          onClose={() => setDriveModalState(prev => ({ ...prev, isOpen: false }))}
          blockId={block.id}
          laudaId={driveModalState.laudaId}
          laudaTitulo={driveModalState.laudaTitulo}
          currentLink={driveModalState.currentLink}
          onSave={(bId, lId, url) => {
            onUpdateLauda(bId, lId, { driveLink: url });
          }}
        />
      )}

      {playerModalState.isOpen && (
        <VideoPlayerModal
          isOpen={playerModalState.isOpen}
          onClose={() => setPlayerModalState(prev => ({ ...prev, isOpen: false }))}
          videoUrl={playerModalState.videoUrl}
          videoTitle={playerModalState.videoTitle}
          isLocalMissing={playerModalState.isLocalMissing}
          onReassociate={() => {
            setPlayerModalState(prev => ({ ...prev, isOpen: false }));
            setDriveModalState({
              isOpen: true,
              laudaId: playerModalState.laudaId,
              laudaTitulo: playerModalState.videoTitle,
              currentLink: `local://${playerModalState.videoTitle}`
            });
          }}
        />
      )}

    </div>
  );
}
