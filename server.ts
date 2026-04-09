import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fs from 'fs/promises';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), 'data');
const SCRIPTS_DIR = path.join(process.cwd(), 'data', 'scripts');
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  try {
    await fs.access(SCRIPTS_DIR);
  } catch {
    await fs.mkdir(SCRIPTS_DIR, { recursive: true });
  }
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

// Configure axios defaults
axios.defaults.timeout = 60000; // 60 seconds

// Axios retry helper
async function axiosWithRetry(config: any, retries = 2): Promise<any> {
  try {
    return await axios(config);
  } catch (error: any) {
    const isTransient = !error.response || (error.response.status >= 500);
    if (isTransient && retries > 0) {
      console.warn(`Axios request failed, retrying... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return axiosWithRetry(config, retries - 1);
    }
    throw error;
  }
}

async function startServer() {
  await ensureDataDir();
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
    maxHttpBufferSize: 1e8 // 100 MB
  });
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(cookieParser());

  app.get('/uploads/:filename', async (req, res, next) => {
    const { filename } = req.params;
    const isThumb = req.query.thumb === 'true';
    const filePath = path.join(UPLOADS_DIR, filename);

    try {
      await fs.access(filePath);
    } catch {
      return next();
    }

    if (isThumb) {
      const thumbPath = path.join(UPLOADS_DIR, `thumb_${filename}`);
      try {
        await fs.access(thumbPath);
        return res.sendFile(thumbPath);
      } catch {
        try {
          await sharp(filePath)
            .resize({ width: 800, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbPath);
          return res.sendFile(thumbPath);
        } catch (err) {
          console.error('Thumbnail generation failed:', err);
          return res.sendFile(filePath);
        }
      }
    } else {
      return res.sendFile(filePath);
    }
  });

  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Upload API
  app.post('/api/upload', async (req, res) => {
    try {
      const { image } = req.body;
      if (!image || !image.startsWith('data:image/')) {
        return res.status(400).json({ error: 'Invalid image data' });
      }
      const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: 'Invalid base64 format' });
      }
      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `${uuidv4()}.${ext}`;
      await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);
      res.json({ url: `/uploads/${filename}` });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload image' });
    }
  });

  // Storage API
  app.get('/api/storage/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId || !/^[a-zA-Z0-9-]+$/.test(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      const filePath = path.join(DATA_DIR, `${userId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      res.json(JSON.parse(data));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        res.json([]);
      } else {
        res.status(500).json({ error: 'Failed to read data' });
      }
    }
  });

  app.post('/api/storage/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId || !/^[a-zA-Z0-9-]+$/.test(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      const filePath = path.join(DATA_DIR, `${userId}.json`);
      await fs.writeFile(filePath, JSON.stringify(req.body, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save data' });
    }
  });

  // Shared Scripts API
  app.get('/api/scripts/:scriptId', async (req, res) => {
    try {
      const { scriptId } = req.params;
      if (!scriptId || !/^[a-zA-Z0-9-]+$/.test(scriptId)) {
        return res.status(400).json({ error: 'Invalid script ID' });
      }
      const filePath = path.join(SCRIPTS_DIR, `${scriptId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      res.json(JSON.parse(data));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Script not found' });
      } else {
        res.status(500).json({ error: 'Failed to read script' });
      }
    }
  });

  app.post('/api/scripts/:scriptId', async (req, res) => {
    try {
      const { scriptId } = req.params;
      if (!scriptId || !/^[a-zA-Z0-9-]+$/.test(scriptId)) {
        return res.status(400).json({ error: 'Invalid script ID' });
      }
      const filePath = path.join(SCRIPTS_DIR, `${scriptId}.json`);
      await fs.writeFile(filePath, JSON.stringify(req.body, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save script' });
    }
  });

  // Socket.IO logic
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId) => {
      Array.from(socket.rooms).forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on('workspace-update', async (scripts) => {
      socket.to('global-workspace').emit('workspace-updated', scripts);
      
      try {
        const filePath = path.join(DATA_DIR, `global-workspace.json`);
        await fs.writeFile(filePath, JSON.stringify(scripts, null, 2));
      } catch (e) {
        console.error('Failed to save workspace from socket', e);
      }
    });

    socket.on('script-update', async (data) => {
      const { scriptId, script } = data;
      socket.to(`script:${scriptId}`).emit('script-updated', script);
      
      try {
        if (scriptId && /^[a-zA-Z0-9-]+$/.test(scriptId)) {
          const filePath = path.join(SCRIPTS_DIR, `${scriptId}.json`);
          await fs.writeFile(filePath, JSON.stringify(script, null, 2));
        }
      } catch (e) {
        console.error('Failed to save script from socket', e);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // Feishu OAuth URL
  app.post('/api/auth/feishu/url', (req, res) => {
    const { appId, appSecret } = req.body;
    
    // Use provided credentials or fallback to env
    const finalAppId = appId || process.env.FEISHU_APP_ID;
    const finalAppSecret = appSecret || process.env.FEISHU_APP_SECRET;

    if (!finalAppId || !finalAppSecret) {
      return res.status(400).json({ error: 'Feishu App ID and Secret are required. Please configure them in Settings.' });
    }

    // Store config in a temporary cookie for the callback to use
    res.cookie('feishu_temp_config', JSON.stringify({ appId: finalAppId, appSecret: finalAppSecret }), {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
      maxAge: 300 * 1000, // 5 minutes
    });

    const redirectUri = `${req.protocol}://${req.get('host')}/auth/feishu/callback`;
    const authUrl = `https://passport.feishu.cn/open-apis/authen/v1/index?app_id=${finalAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=feishu`;
    
    res.json({ url: authUrl });
  });

  // Feishu OAuth Callback
  app.get(['/auth/feishu/callback', '/auth/feishu/callback/'], async (req, res) => {
    const { code } = req.query;
    const tempConfig = req.cookies.feishu_temp_config;

    if (!code) {
      return res.status(400).send('Missing code');
    }

    if (!tempConfig) {
      return res.status(400).send('Missing configuration context. Please try again.');
    }

    try {
      const { appId, appSecret } = JSON.parse(tempConfig);

      // 1. Get app_access_token
      const appTokenRes = await axiosWithRetry({
        method: 'post',
        url: 'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
        data: {
          app_id: appId,
          app_secret: appSecret,
        }
      });
      const appAccessToken = appTokenRes.data.app_access_token;

      // 2. Exchange code for user_access_token
      const userTokenRes = await axiosWithRetry({
        method: 'post',
        url: 'https://open.feishu.cn/open-apis/authen/v3/access_token',
        data: {
          grant_type: 'authorization_code',
          code,
        },
        headers: {
          Authorization: `Bearer ${appAccessToken}`,
        },
      });

      const userAccessToken = userTokenRes.data.data.access_token;

      // Store token in cookie (secure for iframe)
      res.cookie('feishu_access_token', userAccessToken, {
        secure: true,
        sameSite: 'none',
        httpOnly: true,
        maxAge: 3600 * 1000, // 1 hour
      });

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'FEISHU_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Feishu OAuth error:', error.response?.data || error.message);
      res.status(500).send('Authentication failed');
    }
  });

  // Feishu Import API
  app.post('/api/feishu/import', async (req, res) => {
    const { spreadsheetToken, sheetId, range } = req.body;
    const accessToken = req.cookies.feishu_access_token;

    if (!accessToken) {
      return res.status(401).json({ error: 'Not authenticated with Feishu' });
    }

    try {
      const url = `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/${sheetId}/values/${range || 'A1:Z100'}`;
      const response = await axiosWithRetry({
        method: 'get',
        url: url,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.data.code !== 0) {
        throw new Error(response.data.msg || 'Feishu API error');
      }

      res.json(response.data.data);
    } catch (error: any) {
      console.error('Feishu Import error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch spreadsheet data' });
    }
  });

  // Gemini Proxy - Fetch Models
  app.post('/api/gemini/models', async (req, res) => {
    const { apiKey, baseUrl, proxyEnabled, proxyUrl } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API Key is required' });

    try {
      const finalBaseUrl = baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      const agent = proxyEnabled && proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
      const response = await axiosWithRetry({
        method: 'get',
        url: `${finalBaseUrl}/models?key=${apiKey}`,
        httpsAgent: agent,
        proxy: false
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Gemini Models Proxy error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to fetch models' });
    }
  });

  // Gemini Proxy - Generate Content
  app.all('/api/gemini/proxy/:proxyUrl/*', async (req, res) => {
    const proxyUrl = decodeURIComponent(req.params.proxyUrl);
    const targetPath = req.params[0];
    const targetUrl = 'https://generativelanguage.googleapis.com/' + targetPath;
    
    try {
      const agent = proxyUrl && proxyUrl !== 'none' ? new HttpsProxyAgent(proxyUrl) : undefined;
      
      const headers = { ...req.headers };
      delete headers.host;
      delete headers.origin;
      delete headers.referer;
      
      const response = await axios({
        method: req.method,
        url: targetUrl,
        headers: headers,
        data: req.body,
        responseType: 'stream',
        httpsAgent: agent,
        proxy: false
      });
      response.data.pipe(res);
    } catch (error: any) {
      if (error.response) {
        res.status(error.response.status);
        error.response.data.pipe(res);
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // OpenAI Proxy - Fetch Models
  app.post('/api/openai/models', async (req, res) => {
    const { apiKey, baseUrl } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API Key is required' });

    try {
      const finalBaseUrl = baseUrl || 'https://api.openai.com/v1';
      const response = await axiosWithRetry({
        method: 'get',
        url: `${finalBaseUrl}/models`,
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('OpenAI Models Proxy error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to fetch models' });
    }
  });

  // OpenAI Proxy - Generate Images
  app.post('/api/openai/images/generations', async (req, res) => {
    const { apiKey, baseUrl, body } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API Key is required' });

    try {
      const finalBaseUrl = baseUrl || 'https://api.openai.com/v1';
      const response = await axiosWithRetry({
        method: 'post',
        url: `${finalBaseUrl}/images/generations`,
        data: body,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('OpenAI Images Proxy error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to generate image' });
    }
  });

  // Nano Banana Proxy - Fetch Models
  app.get('/api/nanobanana/models', async (req, res) => {
    try {
      const response = await axiosWithRetry({
        method: 'get',
        url: 'https://www.nananobanana.com/api/v1/models'
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Nano Banana Models Proxy error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to fetch models' });
    }
  });

  // Nano Banana Proxy - Generate Images
  app.post('/api/nanobanana/generate', async (req, res) => {
    const { apiKey, body } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API Key is required' });

    try {
      const response = await axiosWithRetry({
        method: 'post',
        url: 'https://www.nananobanana.com/api/v1/generate',
        data: body,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Nano Banana Generate Proxy error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to generate image' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
