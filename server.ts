import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";

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
