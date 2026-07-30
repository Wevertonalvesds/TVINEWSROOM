import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { randomBytes } from "crypto";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import firebaseConfig from "./firebase-applet-config.json";

// Initialize Firebase for server-side integration APIs
const firebaseApp = initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
});
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || "(default)");
const auth = getAuth(firebaseApp);

function generateSecureToken(): string {
  return randomBytes(24).toString("hex");
}

let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("A chave GEMINI_API_KEY não foi configurada. Configure em Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Helper dynamically fetch public drive folder files
async function getPublicFolderFiles(folderId: string) {
  try {
    const res = await fetch(`https://drive.google.com/drive/folders/${folderId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    
    let ds5Data: any = null;
    const AF_initDataCallback = (config: any) => {
      if (config.key === 'ds:5') {
        ds5Data = config.data;
      }
    };
    
    const regex = /AF_initDataCallback\s*\(\s*({[\s\S]*?})\s*\)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      try {
        const objText = match[1];
        const fn = new Function('AF_initDataCallback', `AF_initDataCallback(${objText});`);
        fn(AF_initDataCallback);
      } catch (e) {}
    }
    
    const files: any[] = [];
    if (ds5Data && ds5Data[27] && ds5Data[27][7] && ds5Data[27][7][0] && ds5Data[27][7][0][0]) {
      const items = ds5Data[27][7][0][0];
      for (const item of items) {
        try {
          if (!item || !item[0] || !item[0][1]) continue;
          const id = item[0][1];
          let name = '';
          const mimeType = item[4] || 'video/mp4';
          let size = '';
          
          if (item[35] && item[35][0] && item[35][0][0] && item[35][0][0][0]) {
            name = item[35][0][0][0];
          } else if (item[24] && item[24][2] && item[24][2][0] && item[24][2][0][2] && item[24][2][0][2][1] && item[24][2][0][2][1][0] && item[24][2][0][2][1][0][0]) {
            name = item[24][2][0][2][1][0][0][0];
          }
          
          if (!name) continue;
          
          if (item[24] && item[24][2]) {
            for (const col of item[24][2]) {
              if (col && col[2] && col[2][1] && col[2][1][0] && col[2][1][0][0] && typeof col[2][1][0][0][0] === 'string') {
                const text = col[2][1][0][0][0];
                if (text.includes('MB') || text.includes('KB') || text.includes('GB')) {
                  size = text;
                }
              }
            }
          }
          
          files.push({
            id,
            name,
            mimeType,
            size,
            webViewLink: `https://drive.google.com/file/d/${id}/view?usp=drivesdk`
          });
        } catch (itemErr) {
          console.error("Error parsing item in back-end:", itemErr);
        }
      }
    }
    
    if (files.length === 0) {
      const idRegex = /"([a-zA-Z0-9_-]{33})"/g;
      const ids: string[] = [];
      let m;
      while ((m = idRegex.exec(html)) !== null) {
        const potentialId = m[1];
        if (potentialId !== folderId && !potentialId.includes('/') && !potentialId.includes(' ') && (potentialId.startsWith('1') || potentialId.startsWith('0') || potentialId.startsWith('A'))) {
          if (!ids.includes(potentialId)) {
            ids.push(potentialId);
          }
        }
      }
      
      const nameRegex = /"([^"]+\.(?:mp4|mov|avi|mkv|wav|mp3|docx|pdf))"/gi;
      const names: string[] = [];
      let nm;
      while ((nm = nameRegex.exec(html)) !== null) {
        if (!names.includes(nm[1])) {
          names.push(nm[1]);
        }
      }
      
      const count = Math.min(ids.length, names.length);
      for (let i = 0; i < count; i++) {
        files.push({
          id: ids[i],
          name: names[i],
          mimeType: names[i].toLowerCase().endsWith('.avi') ? 'video/avi' : 'video/mp4',
          size: '-',
          webViewLink: `https://drive.google.com/file/d/${ids[i]}/view?usp=drivesdk`
        });
      }
    }
    
    return files;
  } catch (err) {
    console.error("fetchPublicFolderError:", err);
    return [];
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URL-encoded body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Create uploads folder if it doesn't exist
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Serve uploads directory statically at /uploads
  app.use('/uploads', express.static(uploadDir));

  // Set up disk storage for local uploads
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const cleanOrigName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      cb(null, `${uniqueSuffix}-${cleanOrigName}`);
    }
  });

  const upload = multer({
    storage: storage,
    limits: { fileSize: 1500 * 1024 * 1024 } // 1.5GB default limit for videos
  });

  // Local Uploads API Endpoint - NO LOGIN REQUIRED
  app.post('/api/upload', upload.single('video'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' });
      }
      // Generate standard download and streaming URL relative path
      const url = `/uploads/${req.file.filename}`;
      res.json({
        success: true,
        url: url,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      });
    } catch (err: any) {
      console.error('API local upload error:', err);
      res.status(500).json({ success: false, error: err.message || 'Falha no upload do arquivo' });
    }
  });

  // Public Folder Scraped Listing API Endpoint
  app.get('/api/public-videos', async (req, res) => {
    const folderId = req.query.folderId || '1jCABUF0YtmD6OWCyIsv-KYtNzep8z7wn';
    try {
      const files = await getPublicFolderFiles(folderId as string);
      res.json({ success: true, files });
    } catch (err: any) {
      console.error('API public-videos error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Error fetching public videos' });
    }
  });

  // AI Assistant API Endpoint
  app.post('/api/ai', async (req, res) => {
    try {
      const { action, text, theme, context } = req.body;
      
      if (!action) {
        return res.status(400).json({ success: false, error: "Ação não especificada." });
      }

      const ai = getGeminiClient();

      let systemInstruction = "";
      let prompt = "";

      if (action === "generate-pauta") {
        if (!theme) {
          return res.status(400).json({ success: false, error: "Tema é obrigatório para gerar pauta." });
        }
        systemInstruction = "Você é um produtor de TV experiente e experiente roteirista. Crie pautas de telejornalismo estruturadas de forma profissional.";
        prompt = `Gere uma pauta completa de telejornalismo para o seguinte tema/assunto: "${theme}".
Sua resposta deve conter os seguintes tópicos bem organizados usando Markdown:
1. **Cabeçalho da Pauta**: Título chamativo, Editoria sugerida e Enfoque principal.
2. **Introdução / Gancho**: Por que esse assunto é importante agora?
3. **Fontes sugeridas para entrevista**: Quem entrevistar (cargos, especialistas ou personagens afetados) e por quê.
4. **Locais de Gravação / Imagens de Apoio (B-roll)**: Quais imagens devem ser gravadas para ilustrar a matéria.
5. **Estrutura sugerida da reportagem**: Um roteiro simplificado passo a passo (Introdução, Desenvolvimento, Clímax, Conclusão).
6. **Perguntas-chave**: 4 perguntas essenciais a serem feitas durante as entrevistas.`;
      } 
      else if (action === "summarize-reportagem") {
        if (!text) {
          return res.status(400).json({ success: false, error: "Texto é obrigatório para resumir." });
        }
        systemInstruction = "Você é um editor-chefe de telejornalismo. Crie resumos objetivos, focados nos fatos mais importantes, perfeitamente estruturados para leitura rápida e redação de notícias.";
        prompt = `Resuma a seguinte reportagem de forma concisa e clara para o ambiente de redação.
Crie um resumo estruturado em Markdown com:
- **Resumo Executivo (Lead)**: O fato principal em até 3 linhas (Quem, O quê, Onde, Quando, Por quê).
- **Pontos de Destaque (Bullet points)**: Os detalhes mais cruciais (estatísticas, decisões, aspas importantes).
- **Sugestão de Gancho**: Como o telejornal pode abordar essa reportagem de forma local ou analítica.

Texto a ser resumido:
${text}`;
      } 
      else if (action === "fix-grammar") {
        if (!text) {
          return res.status(400).json({ success: false, error: "Texto é obrigatório para correção." });
        }
        systemInstruction = "Você é um revisor de texto profissional especialista em jornalismo e escrita para teleprompter (linguagem oral, frases curtas, pontuação para respiração, numerais escritos por extenso quando apropriado).";
        prompt = `Corrija a ortografia, gramática e pontuação do seguinte texto, e padronize o estilo para linguagem jornalística de TV / Teleprompter (frases mais diretas, fluidas, sem jargões excessivos ou construções excessivamente formais que dificultem a fala).

Retorne APENAS o texto corrigido e revisado, sem comentários adicionais como "Aqui está o texto corrigido" ou explicações sobre o que mudou.

Texto original:
${text}`;
      } 
      else if (action === "generate-questions") {
        if (!theme) {
          return res.status(400).json({ success: false, error: "Tema/Contexto é obrigatório para gerar perguntas." });
        }
        systemInstruction = "Você é um repórter/entrevistador de TV experiente. Crie perguntas instigantes, relevantes e profundas para extrair as melhores respostas e aspas.";
        prompt = `Gere perguntas profissionais de entrevista com base no seguinte tema ou contexto: "${theme}".
${context ? `Informações adicionais do entrevistado ou evento: ${context}` : ""}

Crie um roteiro de entrevista estruturado em Markdown com:
- **Perguntas de Aquecimento (Icebreakers)**: 2 perguntas fáceis para iniciar a conversa.
- **Perguntas Principais (Core)**: 5 perguntas profundas sobre os fatos, impactos e soluções.
- **Pergunta Final**: 1 pergunta aberta para o entrevistado acrescentar algo ou fazer considerações finais.
- **Dicas de condução**: 2 dicas rápidas de como o repórter deve conduzir o entrevistado nesse tema.`;
      } 
      else {
        return res.status(400).json({ success: false, error: "Ação inválida." });
      }

      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.7,
          }
        });
      } catch (firstErr: any) {
        console.warn("Primeira tentativa com 'gemini-3.5-flash' falhou. Tentando modelo alternativo 'gemini-3.1-flash-lite' devido a alta demanda...", firstErr);
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.7,
            }
          });
        } catch (secondErr: any) {
          console.warn("Segunda tentativa com 'gemini-3.1-flash-lite' falhou. Tentando 'gemini-flash-latest'...", secondErr);
          // Terceira tentativa com 'gemini-flash-latest' como garantia
          response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.7,
            }
          });
        }
      }

      res.json({ success: true, result: response.text });
    } catch (err: any) {
      console.error("Erro na API do Gemini:", err);
      res.status(500).json({ success: false, error: err.message || "Erro interno do servidor ao processar IA." });
    }
  });

  // ==========================================
  // PLAYOUT INTEGRATION REST API ENDPOINTS
  // ==========================================

  // Authentication Middleware for Playout Client
  const requirePlayoutAuth = async (req: any, res: any, next: any) => {
    try {
      let token = "";
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      } else if (req.headers["x-playout-token"]) {
        token = req.headers["x-playout-token"] as string;
      } else if (req.query.token) {
        token = req.query.token as string;
      }

      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: "Token de autorização ausente. Envie via cabeçalho 'Authorization: Bearer <token>', cabeçalho 'X-Playout-Token' ou via parâmetro query '?token=<token>'." 
        });
      }
      
      // Check token in playout_tokens collection
      const tokenDocRef = doc(db, "playout_tokens", token);
      const tokenDoc = await getDoc(tokenDocRef);
      
      if (!tokenDoc.exists()) {
        return res.status(401).json({ success: false, error: "Token inválido, expirado ou inexistente." });
      }
      
      const tokenData = tokenDoc.data();
      const expiresAt = new Date(tokenData.expiresAt);
      if (expiresAt.getTime() < Date.now()) {
        return res.status(401).json({ success: false, error: "Token expirado. Por favor, faça login novamente." });
      }
      
      // Attach authenticated playout user metadata safely
      (req as any).playoutUser = {
        uid: tokenData.userId,
        email: tokenData.userEmail
      };
      next();
    } catch (err: any) {
      console.error("Erro no middleware de autenticação do playout:", err);
      res.status(500).json({ success: false, error: "Erro interno do servidor durante a validação de token." });
    }
  };

  // 1. LOGIN ENDPOINTS (Supports: /login, /api/playout/login, /api/playout/auth/login)
  const handleLogin = async (req: any, res: any) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: "E-mail e senha são obrigatórios para a autenticação externa." });
      }

      // Log in using standard Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Generate secure 48-char hex token
      const token = generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

      // Store token in Firestore for authorization checks
      await setDoc(doc(db, "playout_tokens", token), {
        token,
        userId: user.uid,
        userEmail: user.email,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

      res.json({
        success: true,
        message: "Autenticação efetuada com sucesso.",
        token,
        expiresAt: expiresAt.toISOString(),
        user: {
          uid: user.uid,
          email: user.email,
        }
      });
    } catch (err: any) {
      console.error("Erro no login da API de playout:", err);
      res.status(401).json({ 
        success: false, 
        error: "Falha de autenticação externa. Verifique as credenciais ou permissões do usuário." 
      });
    }
  };

  app.post("/login", handleLogin);
  app.post("/api/playout/login", handleLogin);
  app.post("/api/playout/auth/login", handleLogin);

  // 2. LIST MIRRORS ENDPOINTS (Supports: /espelhos, /api/playout/espelhos)
  const handleListEspelhos = async (req: any, res: any) => {
    try {
      const programsCol = collection(db, "programs");
      const querySnapshot = await getDocs(programsCol);
      
      const espelhos: any[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let bCount = 0;
        let lCount = 0;
        if (data.blocos && Array.isArray(data.blocos)) {
          bCount = data.blocos.length;
          data.blocos.forEach((b: any) => {
            if (b.laudas && Array.isArray(b.laudas)) {
              lCount += b.laudas.length;
            }
          });
        }

        espelhos.push({
          id: docSnap.id,
          nomePrograma: data.nomePrograma || "Sem nome",
          tempoPrograma: data.tempoPrograma || "00:00:00",
          dataPrograma: data.dataPrograma || "",
          updatedAt: data.updatedAt || "",
          blocosCount: bCount,
          laudasCount: lCount,
        });
      });

      // Sort by newest updatedAt/date
      espelhos.sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });

      res.json({ success: true, count: espelhos.length, espelhos });
    } catch (err: any) {
      console.error("Erro ao listar espelhos no playout:", err);
      res.status(500).json({ success: false, error: "Falha ao recuperar a lista de espelhos do sistema." });
    }
  };

  app.get("/espelhos", requirePlayoutAuth, handleListEspelhos);
  app.get("/api/playout/espelhos", requirePlayoutAuth, handleListEspelhos);

  // 3. GET A SPECIFIC MIRROR ENDPOINTS (Supports: /espelho/:id, /api/playout/espelho/:id, /api/playout/espelhos/:id)
  const handleGetEspelho = async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const docRef = doc(db, "programs", id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return res.status(404).json({ success: false, error: `Espelho com o ID '${id}' não foi encontrado.` });
      }

      const data = docSnap.data();
      res.json({
        success: true,
        espelho: {
          id: docSnap.id,
          nomePrograma: data.nomePrograma || "Sem nome",
          tempoPrograma: data.tempoPrograma || "00:00:00",
          dataPrograma: data.dataPrograma || "",
          updatedAt: data.updatedAt || "",
          blocos: data.blocos || [],
        }
      });
    } catch (err: any) {
      console.error("Erro ao obter espelho por ID:", err);
      res.status(500).json({ success: false, error: "Falha ao obter dados detalhados do espelho solicitado." });
    }
  };

  app.get("/espelho/:id", requirePlayoutAuth, handleGetEspelho);
  app.get("/api/playout/espelho/:id", requirePlayoutAuth, handleGetEspelho);
  app.get("/api/playout/espelhos/:id", requirePlayoutAuth, handleGetEspelho);

  // 4. GET ALL MEDIAS REFERENCE ENDPOINT (Supports: /api/playout/midias)
  app.get("/api/playout/midias", requirePlayoutAuth, async (req, res) => {
    try {
      // Step A: Gather all local files from the local uploads folder
      const localFiles: any[] = [];
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        for (const file of files) {
          const filePath = path.join(uploadDir, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            const ext = path.extname(file).toLowerCase();
            const mimeType = ext === '.mp4' ? 'video/mp4' : ext === '.mp3' ? 'audio/mp3' : ext === '.wav' ? 'audio/wav' : 'video/quicktime';
            localFiles.push({
              id: file,
              nome: file,
              origem: "local",
              url: `/uploads/${file}`,
              tamanhoBytes: stat.size,
              mimeType,
              downloadUrl: `/midia/${file}`
            });
          }
        }
      }

      // Step B: Gather Google Drive links from active programs as media references
      const driveFiles: any[] = [];
      const programsCol = collection(db, "programs");
      const querySnapshot = await getDocs(programsCol);
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const nomeProg = data.nomePrograma || "Geral";
        if (data.blocos && Array.isArray(data.blocos)) {
          data.blocos.forEach((bloco: any) => {
            if (bloco.laudas && Array.isArray(bloco.laudas)) {
              bloco.laudas.forEach((lauda: any) => {
                if (lauda.driveLink && lauda.driveLink.trim()) {
                  const alreadyAdded = driveFiles.some(f => f.url === lauda.driveLink);
                  if (!alreadyAdded) {
                    driveFiles.push({
                      id: lauda.id || Math.random().toString(36).substring(7),
                      nome: lauda.materia || "Sem Nome",
                      origem: "google_drive",
                      url: lauda.driveLink,
                      tamanho: "-",
                      mimeType: "video/mp4",
                      materia: lauda.materia,
                      programa: nomeProg,
                      tipoExibicao: lauda.tipo || "VT"
                    });
                  }
                }
              });
            }
          });
        }
      });

      res.json({
        success: true,
        count: localFiles.length + driveFiles.length,
        midias: {
          locais: localFiles,
          drive: driveFiles
        }
      });
    } catch (err: any) {
      console.error("Erro ao obter mídias no playout:", err);
      res.status(500).json({ success: false, error: "Falha ao compilar listagem de arquivos de mídia." });
    }
  });

  // 5. DOWNLOAD INDIVIDUAL MEDIA FILES (Supports: /midia/:id, /api/playout/midia/:id, /api/playout/arquivos/download/:filename)
  const handleDownloadMedia = (req: any, res: any) => {
    try {
      const id = req.params.id || req.params.filename;
      if (!id) {
        return res.status(400).json({ success: false, error: "Nome do arquivo ou ID da mídia não especificado." });
      }

      let targetPath = path.join(uploadDir, id);

      if (!fs.existsSync(targetPath)) {
        // Search for file in uploads directory if the parameter doesn't match a file exactly
        // (helps map requested short names to filenames with unique prefixes like 1728988172-name)
        const files = fs.readdirSync(uploadDir);
        const matchedFile = files.find(f => f.endsWith(id) || f.includes(id));
        if (matchedFile) {
          targetPath = path.join(uploadDir, matchedFile);
        } else {
          return res.status(404).json({ success: false, error: `Arquivo '${id}' não foi encontrado no servidor.` });
        }
      }

      const filename = path.basename(targetPath);
      res.download(targetPath, filename, (err) => {
        if (err) {
          console.error("Erro durante transferência de download:", err);
          if (!res.headersSent) {
            res.status(500).json({ success: false, error: "Falha ao descarregar o arquivo de mídia." });
          }
        }
      });
    } catch (err: any) {
      console.error("Erro ao efetuar download:", err);
      res.status(500).json({ success: false, error: "Erro interno no servidor ao servir download." });
    }
  };

  app.get("/midia/:id", requirePlayoutAuth, handleDownloadMedia);
  app.get("/api/playout/midia/:id", requirePlayoutAuth, handleDownloadMedia);
  app.get("/api/playout/arquivos/download/:filename", requirePlayoutAuth, handleDownloadMedia);

  // 6. UPDATE PLAYOUT STATUS ENDPOINTS (Supports: /status, /api/playout/status)
  const handleUpdateStatus = async (req: any, res: any) => {
    try {
      const { status, currentVideo, teleprompterLaudaId, speed, notes } = req.body;

      if (!status) {
        return res.status(400).json({ 
          success: false, 
          error: "O parâmetro 'status' é obrigatório (valores aceitos: online, offline, idle, playing)." 
        });
      }

      const statusPayload = {
        status,
        currentVideo: currentVideo || null,
        teleprompterLaudaId: teleprompterLaudaId || null,
        speed: speed !== undefined ? Number(speed) : null,
        notes: notes || "",
        updatedBy: (req as any).playoutUser.email,
        updatedAt: new Date().toISOString(),
      };

      // Save playout status as 'current_playout' inside 'playout_status' collection
      await setDoc(doc(db, "playout_status", "current_playout"), statusPayload);

      res.json({
        success: true,
        message: "Status e telemetria do Playout atualizados com sucesso.",
        playoutStatus: statusPayload
      });
    } catch (err: any) {
      console.error("Erro ao salvar status do Playout:", err);
      res.status(500).json({ success: false, error: "Não foi possível registrar o status do playout no banco de dados." });
    }
  };

  app.post("/status", requirePlayoutAuth, handleUpdateStatus);
  app.post("/api/playout/status", requirePlayoutAuth, handleUpdateStatus);

  // Vite development middleware or production handler
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
