import { GoogleGenAI, Type, Schema } from '@google/genai';
import { IngestionOptions, GeminiAnalysisResult, GeminiAnalysisSchema } from './types';
import { fetchTikTokVideo } from './tiktok';

const SYSTEM_PROMPT = `You are a Viral Growth Strategist and short-form video creative director.

Analyze the attached short-form video and extract its reusable creative structure.
Do not copy exact people, logos, brand names, copyrighted characters, text overlays, watermark details, music, or unique protected elements.
Focus on transferable production patterns.

Return strict JSON only with:
{
  "summary": "Brief explanation of what makes this video work.",
  "vibeScore": 100,
  "hookStyle": "The opening hook pattern.",
  "cameraStyle": "POV, handheld, drone sweep, static tripod, close-up, product macro, etc.",
  "visualStyle": "Overall look and art direction.",
  "colorGrade": "Color palette/grade.",
  "pacing": "Editing rhythm and tempo.",
  "sceneBeats": ["Beat 1", "Beat 2", "Beat 3"],
  "captionAngle": "The messaging/caption strategy.",
  "ctaPattern": "The implied or explicit call-to-action style.",
  "productionPrompt": "A new original Veo prompt that recreates the style and structure for a different but similar video. Must be vertical 9:16, mobile-first, platform-native, and original.",
  "safetyNotes": ["Any elements that should not be copied directly."]
}

ProductionPrompt requirements:
- Must be written as a ready-to-use Veo prompt.
- Must specify vertical 9:16.
- Must describe camera movement, subject/action, environment, lighting, pacing, color grade, and mood.
- Must avoid saying "copy this TikTok."
- Must avoid exact names, likenesses, brand marks, copyrighted characters, platform watermarks, and exact captions from the source.
- Must be original and reusable.`;

export async function analyzeVideo(options: IngestionOptions): Promise<GeminiAnalysisResult> {
  let buffer: Buffer;
  let mimeType: string;

  if (options.source === 'upload') {
    if (!options.videoBuffer || !options.videoMimeType) {
      throw new Error("Missing video file for upload source.");
    }
    buffer = options.videoBuffer;
    mimeType = options.videoMimeType;
  } else if (options.source === 'tiktok') {
    if (!options.url) {
      throw new Error("Missing URL for TikTok source.");
    }
    const resolved = await fetchTikTokVideo(options.url);
    buffer = resolved.buffer;
    mimeType = resolved.mimeType;
  } else {
    throw new Error("Invalid source.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Please configure it in your secrets.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = process.env.GEMINI_ANALYSIS_MODEL || 'gemini-2.5-flash';

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      vibeScore: { type: Type.INTEGER },
      hookStyle: { type: Type.STRING },
      cameraStyle: { type: Type.STRING },
      visualStyle: { type: Type.STRING },
      colorGrade: { type: Type.STRING },
      pacing: { type: Type.STRING },
      sceneBeats: { type: Type.ARRAY, items: { type: Type.STRING } },
      captionAngle: { type: Type.STRING },
      ctaPattern: { type: Type.STRING },
      productionPrompt: { type: Type.STRING },
      safetyNotes: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: [
      "summary", "vibeScore", "hookStyle", "cameraStyle", "visualStyle", 
      "colorGrade", "pacing", "sceneBeats", "captionAngle", "ctaPattern", 
      "productionPrompt", "safetyNotes"
    ]
  };

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: buffer.toString('base64'), mimeType: mimeType.includes('video') ? mimeType : 'video/mp4' } },
          { text: "Analyze this video strictly following your constraints." }
        ]
      }
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: responseSchema as Schema
    }
  });

  const outputText = response.text || '';
  let parsed: any;
  try {
    parsed = JSON.parse(outputText);
  } catch (e) {
    throw new Error("Failed to parse Gemini output into JSON.");
  }

  // Validate with Zod
  return GeminiAnalysisSchema.parse(parsed);
}
