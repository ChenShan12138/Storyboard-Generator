import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieParser());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
    const { apiKey, baseUrl } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'API Key is required' });

    try {
      const finalBaseUrl = baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      const response = await axiosWithRetry({
        method: 'get',
        url: `${finalBaseUrl}/models?key=${apiKey}`,
      });
      res.json(response.data);
    } catch (error: any) {
      console.error('Gemini Models Proxy error:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to fetch models' });
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
