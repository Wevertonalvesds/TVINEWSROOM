import React from 'react';
import { LogOut, Key } from 'lucide-react';

export default function Header({ 
  userEmail, 
  onLogout,
  onChangePassword,
  autoSaveStatus,
  googleToken,
  onGoogleConnect,
  onGoogleDisconnect
}: { 
  userEmail?: string; 
  onLogout?: () => void;
  onChangePassword?: () => void;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  googleToken?: string | null;
  onGoogleConnect?: () => void;
  onGoogleDisconnect?: () => void;
}) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[#18181b]/50 bg-[#0c0c0e]/30 relative no-print">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-sans font-black tracking-widest text-[#9ca3af] uppercase">
          TVI NEWSROOM
        </h1>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Google Drive Status Chiclet */}
        {userEmail && (
          <div className="flex items-center gap-2.5 bg-[#18181b]/85 border border-zinc-800/80 px-3.5 py-1.5 rounded-xl shadow-lg font-mono text-[10px] text-zinc-350 select-none shrink-0">
            {googleToken ? (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-emerald-400 font-extrabold uppercase text-[9px] tracking-wider">Drive Ativo</span>
                <span className="text-zinc-700">|</span>
                <button
                  type="button"
                  onClick={onGoogleDisconnect}
                  className="text-zinc-500 hover:text-red-400 font-bold uppercase transition-colors cursor-pointer"
                  title="Desconectar do Google Drive"
                >
                  Sair do Google
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onGoogleConnect}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-amber-500 font-bold transition-all active:scale-95 duration-100 cursor-pointer"
                title="Conectar sua conta Google para sincronizar e baixar vídeos"
              >
                <svg className="w-3.5 h-3.5 text-amber-500 fill-current animate-pulse shrink-0" viewBox="0 0 24 24">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                </svg>
                <span className="text-[9px] uppercase tracking-wider text-amber-500">Conectar Google</span>
              </button>
            )}
          </div>
        )}

        {/* Logged User Badging */}
        {userEmail && (
          <div className="flex items-center gap-2.5 bg-[#18181b]/85 border border-zinc-800/80 px-3.5 py-1.5 rounded-xl shadow-lg font-mono text-[10px] text-zinc-350 select-none">
            
            {/* Cloud Auto-save indicator */}
            {autoSaveStatus && autoSaveStatus !== 'idle' && (
              <div className="flex items-center gap-1.5 mr-1 pr-2 border-r border-zinc-800">
                {autoSaveStatus === 'saving' && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span className="text-amber-500 font-semibold uppercase text-[9px] tracking-wider">Salvando...</span>
                  </>
                )}
                {autoSaveStatus === 'saved' && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-emerald-400 font-semibold uppercase text-[9px] tracking-wider">Salvo!</span>
                  </>
                )}
                {autoSaveStatus === 'error' && (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-bounce" />
                    <span className="text-red-400 font-semibold uppercase text-[9px] tracking-wider">Erro!</span>
                  </>
                )}
              </div>
            )}

            {(!autoSaveStatus || autoSaveStatus === 'idle') && (
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            )}
            <span className="max-w-[150px] truncate">{userEmail}</span>
            <span className="text-zinc-700">|</span>
            {onChangePassword && (
              <>
                <button
                  type="button"
                  onClick={onChangePassword}
                  className="text-zinc-500 hover:text-amber-500 transition-colors cursor-pointer flex items-center gap-1 uppercase font-bold"
                  title="Alterar Senha de Acesso"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Alterar Senha</span>
                </button>
                <span className="text-zinc-700">|</span>
              </>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer flex items-center gap-1 uppercase font-bold"
              title="Sair da Conta"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

