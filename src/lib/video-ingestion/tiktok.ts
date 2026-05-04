import { fetchTikTokApifyClockworks } from './providers/apify-clockworks.ts';

export async function fetchTikTokVideo(url: string): Promise<{ buffer: Buffer, mimeType: string }> {
  const provider = process.env.TIKTOK_PROVIDER || 'apify-clockworks';

  try {
    if (provider === 'apify-clockworks') {
      const timeoutMs = process.env.TIKTOK_PROVIDER_TIMEOUT_MS ? parseInt(process.env.TIKTOK_PROVIDER_TIMEOUT_MS, 10) : 60000;
      const data = await fetchTikTokApifyClockworks(url, timeoutMs);
      
      if (!data.videoBytes) {
        console.error('fetchTikTokApifyClockworks completed but no video bytes were returned. Data returned:', JSON.stringify({ ...data, metadata: 'omitted' }));
        throw new Error('TIKTOK_INGESTION_FAILED');
      }
      return { buffer: data.videoBytes, mimeType: data.mimeType || 'video/mp4' };
    }

    // Fallback logic
    const baseUrl = process.env.TIKTOK_PROVIDER_BASE_URL;
    if (!baseUrl) {
      throw new Error("TIKTOK_PROVIDER_NOT_CONFIGURED");
    }

    const apiKey = process.env.TIKTOK_PROVIDER_API_KEY;
    const response = await fetch(`${baseUrl}?url=${encodeURIComponent(url)}`, {
      headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
    });

    if (!response.ok) {
      throw new Error("TIKTOK_INGESTION_FAILED");
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: response.headers.get('content-type') || 'video/mp4'
    };

  } catch (e: any) {
    if (e.message === 'TIKTOK_PROVIDER_NOT_CONFIGURED' || e.message === 'TIKTOK_INGESTION_FAILED') {
      throw e; // Propagate the specific typed error message
    }
    console.error("TikTok Fetch Error:", e);
    throw new Error("TIKTOK_INGESTION_FAILED");
  }
}

