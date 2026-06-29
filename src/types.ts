export interface Lauda {
  id: string;
  materia: string;       // Retranca / story slug (only normal blocks)
  duracao: string;       // Duration (MM:SS)
  tipo: string;          // VT, VIVO, ESTÚDIO, NOTA, VINHETA, ENCERRAMENTO, etc.
  apresentador: string;  // Presenter / reporter
  laudaContent: string;  // Script content for Teleprompter
  driveLink?: string;    // Google Drive file/folder URL
}

export interface Block {
  id: string;
  tipo: 'normal' | 'comercial';
  titulo: string; // "Bloco 1", "Intervalo", etc.
  laudas: Lauda[];
}

export interface ProgramState {
  nomePrograma: string;
  tempoPrograma: string; // e.g. "00:30:00"
  dataPrograma?: string; // Date of the program e.g. "YYYY-MM-DD"
  blocos: Block[];
}

export interface Pauta {
  id: string;
  titulo: string;
  data: string;
  programa: string;
  descricao: string;
  fontes: string;
  status: 'rascunho' | 'aprovada' | 'arquivada';
  reporter?: string;
  produtor?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Reportagem {
  id: string;
  titulo: string;
  reporter: string;
  produtor: string;
  texto: string;
  creditos: string;
  imagens: string;
  entrevistados: string;
  status: 'producao' | 'gravada' | 'finalizada' | 'arquivada';
  driveLink?: string;
  programa?: string;
  cinegrafista?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Agenda {
  id: string;
  evento: string;
  dataHora: string;
  local: string;
  contato: string;
  descricao: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisteredProgram {
  id: string;
  name: string;
  createdAt?: string;
}

export type ColaboradorFuncao = 'Apresentador' | 'Repórter' | 'Produção' | 'Editor' | 'Cinegrafista' | 'Operador' | 'Demais funções';

export interface Colaborador {
  id: string;
  nome: string;
  funcao: ColaboradorFuncao;
  userId?: string;
  createdAt?: string;
}

export function capitalizeName(name: string): string {
  if (!name) return '';
  const words = name.trim().toLowerCase().split(/\s+/);
  return words
    .map((word, idx) => {
      if (word.length === 0) return '';
      const prepositions = ['de', 'do', 'da', 'dos', 'das', 'e', 'em'];
      if (idx > 0 && prepositions.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}


