import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { z } from 'zod';
import { analyzeVideo } from './src/lib/video-ingestion/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/analyze', upload.single('video'), async (req, res) => {
    try {
      // Input can be JSON { url, source } or multipart
      let url = req.body.url;
      let source = req.body.source;
      let videoBuffer = req.file?.buffer;
      let videoMimeType = req.file?.mimetype;

      if (!source && videoBuffer) {
        source = 'upload';
      }

      if (source !== 'tiktok' && source !== 'upload') {
        return res.status(400).json({ success: false, error: { code: 'INVALID_SOURCE', message: 'Source must be tiktok or upload' }});
      }

      const result = await analyzeVideo({ url, source, videoBuffer, videoMimeType });

      return res.json({
        success: true,
        analysis: result
      });
    } catch (e: any) {
      if (e.message !== 'TIKTOK_PROVIDER_NOT_CONFIGURED' && e.message !== 'TIKTOK_INGESTION_FAILED') {
        console.error("Analyze error:", e);
      }

      if (e.message === 'TIKTOK_PROVIDER_NOT_CONFIGURED') {
        return res.status(400).json({
          success: false,
          error: { code: 'TIKTOK_PROVIDER_NOT_CONFIGURED', message: 'TikTok URL analysis is not configured yet. Please upload the video file instead.' }
        });
      }

      if (e.message === 'TIKTOK_INGESTION_FAILED') {
        return res.status(400).json({
          success: false,
          error: { code: 'TIKTOK_INGESTION_FAILED', message: 'We could not fetch this TikTok video automatically. Please upload the video file instead.' }
        });
      }

      if (e.message?.includes('API_KEY_INVALID') || e.message?.includes('API key not valid')) {
        return res.status(400).json({
          success: false,
          error: { code: 'API_KEY_INVALID', message: 'The Gemini API key is missing or invalid. Please check your Secret in the AI Studio settings.' }
        });
      }

      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: e.message || 'Failed to analyze video' }
      });
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
