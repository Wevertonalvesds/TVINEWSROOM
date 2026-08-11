import React, { useState } from 'react';
import { Tv, Plus, Trash2, Search, ShieldAlert, CheckCircle2, Film, Radio } from 'lucide-react';
import { RegisteredProgram } from '../types';

interface ProgramasTabProps {
  currentUser: any;
  registeredPrograms: RegisteredProgram[];
  onAddRegisteredProgram: (name: string) => Promise<void>;
  onDeleteRegisteredProgram: (id: string) => Promise<void>;
  isTabMode?: boolean;
}

export default function ProgramasTab({
  currentUser,
  registeredPrograms = [],
  onAddRegisteredProgram,
  onDeleteRegisteredProgram,
  isTabMode = false,
}: ProgramasTabProps) {
  const [newProgramName, setNewProgramName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAddProgram = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newProgramName.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      await onAddRegisteredProgram(trimmed);
      setNewProgramName('');
      setSuccessMsg(`Programa "${trimmed.toUpperCase()}" cadastrado com sucesso!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (error) {
      console.error('Erro ao cadastrar programa:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPrograms = registeredPrograms.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className={`${isTabMode ? 'py-2 space-y-6' : 'w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8'} animate-in fade-in duration-300`}>
      {/* Page Header */}
      {!isTabMode && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-850 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <Tv className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold font-display uppercase tracking-wider text-zinc-100">
                    Cadastro de Programas & Telejornais
                  </h1>
                  <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-mono font-bold uppercase rounded-md">
                    Administrador
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 font-sans">
                  Gerencie os nomes oficiais dos telejornais e programas disponíveis nos espelhos da Rede TVI.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/80 border border-zinc-800 px-3.5 py-2 rounded-xl">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Acesso Exclusivo à Administração</span>
          </div>
        </div>
      )}

      {/* Success alert */}
      {successMsg && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add new program card & search grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Registration form col */}
        <div className="lg:col-span-1">
          <form
            onSubmit={handleAddProgram}
            className="p-0 bg-transparent space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
              <Plus className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-zinc-200 font-display uppercase tracking-wider">
                Novo Telejornal
              </h2>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Nome do Programa
              </label>
              <input
                type="text"
                value={newProgramName}
                onChange={(e) => setNewProgramName(e.target.value)}
                placeholder="Ex: TVI NOTÍCIAS, TVI ESPORTES..."
                disabled={isSubmitting}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all uppercase"
              />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Este programa aparecerá imediatamente como sugestão e autocompletar na aba de Espelhos para toda a equipe.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newProgramName.trim()}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none text-zinc-950 font-extrabold text-xs uppercase tracking-wider px-4 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{isSubmitting ? 'Cadastrando...' : 'Cadastrar Programa'}</span>
            </button>
          </form>
        </div>

        {/* Registered programs list col */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar programa cadastrado..."
                className="w-full bg-[#111113] border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
            <div className="text-xs font-mono font-bold text-zinc-400 bg-[#111113] border border-zinc-800 px-3.5 py-2 rounded-xl shrink-0">
              Total: {registeredPrograms.length} {registeredPrograms.length === 1 ? 'Programa' : 'Programas'}
            </div>
          </div>

          {/* List of programs */}
          <div className="border-t border-b border-zinc-850 bg-transparent overflow-hidden">
            {filteredPrograms.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 mx-auto flex items-center justify-center text-zinc-500">
                  <Tv className="w-6 h-6 stroke-[1.5]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-300">
                    {searchQuery ? 'Nenhum programa encontrado' : 'Nenhum programa cadastrado'}
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? 'Tente buscar por outros termos ou cadastre um novo programa ao lado.'
                      : 'Cadastre o primeiro telejornal no formulário ao lado para liberar na grade de espelhos.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-zinc-850/60">
                {filteredPrograms.map((program) => (
                  <div
                    key={program.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-900/40 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 text-amber-500 flex items-center justify-center shrink-0">
                        <Radio className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold font-sans uppercase tracking-wide text-zinc-200 block truncate">
                          {program.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ID: {program.id}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 bg-zinc-850 text-zinc-400 text-[10px] font-mono rounded border border-zinc-800">
                        Grade Oficial
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteRegisteredProgram(program.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="Excluir programa do cadastro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
