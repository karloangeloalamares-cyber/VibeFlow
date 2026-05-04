import { z } from 'zod';

export const AnalyzeRequestSchema = z.object({
  url: z.string().url().optional(),
  source: z.enum(['tiktok', 'upload']),
});

export const GeminiAnalysisSchema = z.object({
  summary: z.string().describe("Brief explanation of what makes this video work."),
  vibeScore: z.number().min(1).max(100),
  hookStyle: z.string().describe("The opening hook pattern."),
  cameraStyle: z.string().describe("POV, handheld, drone sweep, static tripod, close-up, product macro, etc."),
  visualStyle: z.string().describe("Overall look and art direction."),
  colorGrade: z.string().describe("Color palette/grade."),
  pacing: z.string().describe("Editing rhythm and tempo."),
  sceneBeats: z.array(z.string()),
  captionAngle: z.string().describe("The messaging/caption strategy."),
  ctaPattern: z.string().describe("The implied or explicit call-to-action style."),
  productionPrompt: z.string().describe("A new original Veo prompt that recreates the style and structure for a different but similar video. Must be vertical 9:16, mobile-first, platform-native, and original. DO NOT copy specific people or brands."),
  safetyNotes: z.array(z.string()).describe("Any elements that should not be copied directly.")
});

export type GeminiAnalysisResult = z.infer<typeof GeminiAnalysisSchema>;

export interface IngestionOptions {
  url?: string;
  source: 'tiktok' | 'upload';
  videoBuffer?: Buffer;
  videoMimeType?: string;
}

export interface NormalizedVideoData {
  source: string;
  originalUrl: string;
  title?: string;
  description?: string;
  author?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  directVideoUrl?: string;
  videoBytes?: Buffer;
  mimeType?: string;
  metadata: Record<string, unknown>;
}
