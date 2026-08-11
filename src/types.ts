export interface GCEntry {
  id: string;
  titulo: string;
  subtitulo?: string;
}

export interface Lauda {
  id: string;
  materia: string;       // Retranca / story slug (only normal blocks)
  duracao: string;       // Duration (MM:SS)
  tipo: string;          // VT, VIVO, ESTÚDIO, NOTA, VINHETA, ENCERRAMENTO, etc.
  apresentador: string;  // Presenter / reporter
  laudaContent: string;  // Script content for Teleprompter
  driveLink?: string;    // Google Drive file/folder URL
  videoFileName?: string; // Original video file name associated with the lauda
  aprovado?: boolean;    // Approval status for the mirror/lauda
  gc?: string;           // Character Generator / Lower third / credits text
  gcs?: GCEntry[];       // Multiple GC entries with Title and Subtitle
}

export interface Block {
  id: string;
  tipo: 'normal' | 'comercial';
  titulo: string; // "Bloco 1", "Intervalo", etc.
  laudas: Lauda[];
}

export interface ProgramState {
  nomePrograma: string;
  editorChefe?: string;
  tempoPrograma: string; // e.g. "00:30:00"
  dataPrograma?: string; // Date of the program e.g. "YYYY-MM-DD"
  blocos: Block[];
  teleprompterActiveLaudaId?: string | null;
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
  emailAcesso?: string;
  temLogin?: boolean;
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

export const DEFAULT_MEMBERS = [
  { email: 'kaikycardososp@gmail.com', name: 'Kaiky Almeida' },
  { email: 'moonlighterstore@gmail.com', name: 'Ana Luiza Lima' },
  { email: 'franca.rodrigo1998@gmail.com', name: 'Rodrigo Rangel' },
  { email: 'samcompop@outlook.com.br', name: 'Samuel Xavier' },
  { email: 'kauapereira.jrn@gmail.com', name: 'Kauã Pereira' },
  { email: 'miguelramalhocastilho759@gmail.com', name: 'Miguel Ramalho' },
  { email: 'weverton.alvesdevetor@gmail.com', name: 'Weverton Souza' },
  { email: 'adrianrodrigues.tv@gmail.com', name: 'Adrian Rodrigues' },
  { email: 'luizphilipecintra210@gmail.com', name: 'Luiz Cintra' },
];

export function isUserAdmin(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  if (clean === 'weverton.alvesdevetor@gmail.com') return true;
  if (clean.startsWith('redetviespelho@') || clean.startsWith('rededetviespelho@')) return true;
  return false;
}




