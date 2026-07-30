import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase';

// Cache the Google Access Token in memory
let cachedGoogleToken: string | null = null;

export const setCachedGoogleToken = (token: string | null) => {
  cachedGoogleToken = token;
  if (token) {
    localStorage.setItem('rede_tvi_google_token', token);
  } else {
    localStorage.removeItem('rede_tvi_google_token');
  }
};

export const getCachedGoogleToken = (): string | null => {
  if (!cachedGoogleToken) {
    cachedGoogleToken = localStorage.getItem('rede_tvi_google_token');
  }
  return cachedGoogleToken;
};

// Authenticate with Google Drive scopes
export const connectGoogleDrive = async (): Promise<string> => {
  try {
    const provider = new GoogleAuthProvider();
    
    // Add exact Drive scopes needed to view, select, and upload files
    provider.addScope('https://www.googleapis.com/auth/drive');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google.');
    }

    setCachedGoogleToken(accessToken);
    return accessToken;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

// Revoke current session connection
export const disconnectGoogleDrive = () => {
  setCachedGoogleToken(null);
};

// List files / videos from current Google Drive
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  size?: string;
  createdTime?: string;
}

export const listDriveFiles = async (token: string, search: string = '', folderId?: string): Promise<DriveFile[]> => {
  try {
    // Search for video files or folders
    let query = "trashed = false";
    
    if (folderId && folderId.trim()) {
      // If specifying a folder, we list any files or subfolders inside this parent folder
      query += ` and '${folderId.trim()}' in parents`;
    } else {
      // General fall-back query for videos/folders in drive
      query += ` and (mimeType contains 'video/' or name contains '.mp4' or name contains '.mov' or name contains '.avi' or mimeType = 'application/vnd.google-apps.folder')`;
    }

    if (search.trim()) {
      // Escape single quotes for search parameter
      const escapedSearch = search.replace(/'/g, "\\'");
      query += ` and name contains '${escapedSearch}'`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,webViewLink,webContentLink,size,createdTime)&pageSize=40&orderBy=createdTime%20desc`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token has likely expired, clear cache
        disconnectGoogleDrive();
        throw new Error('Sessão do Google Drive expirada. reconecte para continuar.');
      }
      throw new Error('Erro ao listar arquivos do Google Drive.');
    }

    const data = await response.json();
    return data.files || [];
  } catch (error: any) {
    console.error('List files error:', error);
    throw error;
  }
};

// Upload a local video/file to Drive
export const uploadFileToDrive = async (
  token: string,
  file: File,
  folderId?: string,
  onProgress?: (progress: number) => void
): Promise<{ id: string; webViewLink: string }> => {
  try {
    const boundary = '314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata: any = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
    };

    if (folderId && folderId.trim()) {
      metadata.parents = [folderId.trim()];
    }

    const reader = new FileReader();
    const fileDataPromise = new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

    const fileBuffer = await fileDataPromise;

    // Build the multipart request body
    const metadataHeader = 
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n`;

    const fileHeader = 
      `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;

    const headerBlob = new Blob([delimiter + metadataHeader + fileHeader]);
    const footerBlob = new Blob(['\r\n' + closeDelimiter]);
    const bodyBlob = new Blob([headerBlob, fileBuffer, footerBlob]);

    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink';

    onProgress?.(10); // Start progress visualization
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: bodyBlob
    });

    if (!response.ok) {
      if (response.status === 401) {
        disconnectGoogleDrive();
        throw new Error('Sessão expirada. Reconecte o Google Drive.');
      }
      const errorText = await response.text();
      console.error('Google Drive Upload Raw Error:', errorText);
      throw new Error('Falha no upload do vídeo para o Google Drive.');
    }

    onProgress?.(70);

    const result = await response.json();

    // Set permission so "anyone with the link can view/download" the video, essential for coworkers
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
          allowFileDiscovery: false
        })
      });
    } catch (permissionError) {
      console.warn('Could not update permission to anyone with link:', permissionError);
    }

    onProgress?.(100);
    
    return {
      id: result.id,
      webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view?usp=drivesdk`
    };
  } catch (error: any) {
    console.error('Upload operation error:', error);
    throw error;
  }
};

// Create a new folder inside Google Drive
export const createDriveFolder = async (token: string, name: string, parentId?: string): Promise<string> => {
  try {
    const metadata: any = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId && parentId.trim()) {
      metadata.parents = [parentId.trim()];
    }
    
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        disconnectGoogleDrive();
        throw new Error('Sessão expirada. Reconecte o Google Drive.');
      }
      throw new Error('Erro ao criar pasta no Google Drive.');
    }
    
    const data = await response.json();
    return data.id;
  } catch (error: any) {
    console.error('Create folder error:', error);
    throw error;
  }
};

// Delete a file/folder inside Google Drive
export const deleteDriveFile = async (token: string, fileId: string): Promise<void> => {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        disconnectGoogleDrive();
        throw new Error('Sessão expirada. Reconecte o Google Drive.');
      }
      throw new Error('Erro ao deletar arquivo/pasta do Google Drive.');
    }
  } catch (error: any) {
    console.error('Delete file error:', error);
    throw error;
  }
};

// Formats file sizes nicely
export const formatBytes = (bytesStr?: string | number): string => {
  if (!bytesStr) return '-';
  const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
  if (isNaN(bytes) || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
