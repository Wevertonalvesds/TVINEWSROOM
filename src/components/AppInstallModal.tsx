import React, { useState, useEffect } from 'react';
import { X, Smartphone, Download, Check, Share, ArrowUp, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Register global beforeinstallprompt event type for TypeScript
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function AppInstallModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop'>('desktop');

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detect if app is already running as PWA (standalone)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Prompt not deferred (either not supported, already installed, or not ready yet)
      if (platform === 'android') {
        alert('Para instalar no Chrome para Android, clique nos três pontos (menu) no canto superior direito e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".');
      }
      return;
    }
    // Show the install prompt
    await deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm no-print">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-md overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-850 bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-amber-500" />
              <h3 className="font-sans text-sm font-black tracking-wider uppercase text-zinc-200">
                Instalar TVI Prompter
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3">
                <img src="/icon-192.png" alt="Logo TVI" className="w-12 h-12 object-contain" onError={(e) => {
                  // Fallback if icon not available yet in local build
                  e.currentTarget.style.display = 'none';
                }} />
                <Smartphone className="w-8 h-8 text-amber-500 absolute" style={{ opacity: 0.3 }} />
              </div>
              <h4 className="text-sm font-bold text-zinc-100">Aplicativo Oficial REDE TVI</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                Instale o sistema de teleprompter e espelho diretamente no seu celular ou tablet para usar em gravações e estúdios.
              </p>
            </div>

            {isInstalled ? (
              <div className="flex flex-col items-center justify-center p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-2">
                  <Check className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Aplicativo Instalado</span>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Você já está executando a versão de aplicativo standalone!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Platform Specific Installer UI */}
                {platform === 'ios' && (
                  <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-3.5">
                    <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-amber-500" />
                      Instalação no iPhone / iPad (Safari)
                    </span>
                    <ol className="text-xs text-zinc-300 space-y-2.5 pl-1">
                      <li className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-bold shrink-0 mt-0.5">1</span>
                        <span>Abra este site utilizando o navegador <strong>Safari</strong> do seu dispositivo Apple.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-bold shrink-0 mt-0.5">2</span>
                        <span className="flex flex-wrap items-center gap-1">
                          Toque no botão de <strong>Compartilhar</strong> 
                          <Share className="w-3.5 h-3.5 text-blue-400 inline mx-0.5" /> 
                          na barra inferior do Safari.
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-bold shrink-0 mt-0.5">3</span>
                        <span className="flex flex-wrap items-center gap-1">
                          Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>
                          <span className="inline-flex items-center justify-center w-4 h-4 bg-zinc-800 rounded text-[11px] font-bold text-zinc-200">+</span>.
                        </span>
                      </li>
                    </ol>
                  </div>
                )}

                {platform === 'android' && (
                  <div className="space-y-3">
                    {deferredPrompt ? (
                      <button
                        onClick={handleInstallClick}
                        className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-98 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        Instalar Aplicativo (PWA)
                      </button>
                    ) : (
                      <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-3.5 text-left">
                        <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-amber-500" />
                          Instalação no Android (Chrome)
                        </span>
                        <ol className="text-xs text-zinc-300 space-y-2.5 pl-1">
                          <li className="flex items-start gap-2.5">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-bold shrink-0 mt-0.5">1</span>
                            <span>Abra este sistema no navegador <strong>Google Chrome</strong> do seu Android.</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-bold shrink-0 mt-0.5">2</span>
                            <span>Toque nos <strong>três pontinhos (menu)</strong> no canto superior direito do Chrome.</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-bold shrink-0 mt-0.5">3</span>
                            <span>Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</span>
                          </li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                {platform === 'desktop' && (
                  <div className="space-y-3">
                    {deferredPrompt ? (
                      <button
                        onClick={handleInstallClick}
                        className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-98 text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        Instalar no Computador
                      </button>
                    ) : (
                      <div className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-xl text-center">
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Para instalar como aplicativo no computador (Chrome/Edge): clique no ícone de <strong>instalação</strong> <span className="text-amber-500">⊕</span> na barra de endereços (lado direito da URL) ou acesse as configurações do navegador e selecione <strong>"Salvar e Compartilhar" &rarr; "Instalar página como app"</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Android APK explanation for installation packages */}
                <div className="p-3.5 bg-zinc-950/20 border border-zinc-850 rounded-xl space-y-2 text-left">
                  <span className="text-[10px] font-mono font-bold uppercase text-zinc-400 tracking-wider block">
                    🤖 Quer um arquivo de pacote APK?
                  </span>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Por ser um sistema com banco de dados em nuvem sincronizado em tempo real, o aplicativo utiliza tecnologia <strong>PWA (Progressive Web App)</strong>. Esta é a melhor alternativa ao APK tradicional, pois:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[10px] text-zinc-500">
                    <li>Ocupa 0MB de espaço no armazenamento do seu dispositivo.</li>
                    <li>Sempre se mantém atualizado automaticamente sem necessidade de baixar novas versões.</li>
                    <li>Roda em tela cheia idêntico a um aplicativo nativo.</li>
                  </ul>
                  <p className="text-[10px] text-zinc-450 pt-1 border-t border-zinc-850/50">
                    Se você ainda assim preferir um arquivo <span className="font-mono text-amber-500/80">.apk</span> bruto para distribuir, você pode inserir o link do sistema (<span className="text-zinc-300 font-mono select-all break-all">https://ais-pre-bn5x5qgmpjsdmauiihyjfd-172898817274.us-east5.run.app</span>) em conversores automáticos gratuitos recomendados como o <strong>WebIntoApp.com</strong> ou o <strong>PWA2APK</strong> para baixar seu pacote gerado na hora!
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
