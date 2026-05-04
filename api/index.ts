import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import multer from 'multer';
import { analyzeVideo } from '../src/lib/video-ingestion/index';

const app = express();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.use(express.json());

// API Routes
app.post('/api/analyze', upload.single('video'), async (req, res) => {
  try {
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

export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
