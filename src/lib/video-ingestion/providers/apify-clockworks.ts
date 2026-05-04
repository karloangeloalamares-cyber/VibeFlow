import { ApifyClient } from 'apify-client';
import { NormalizedVideoData } from '../types.ts';

export async function fetchTikTokApifyClockworks(url: string, timeoutMs: number = 60000): Promise<NormalizedVideoData> {
  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    throw new Error('TIKTOK_PROVIDER_NOT_CONFIGURED');
  }

  const actorId = process.env.TIKTOK_APIFY_ACTOR_ID || 'clockworks/tiktok-scraper';
  const client = new ApifyClient({ token: apifyToken });

  // Validate TikTok URL roughly
  if (!url.includes('tiktok.com')) {
    throw new Error('Invalid TikTok URL provided.');
  }

  try {
    const runPromise = client.actor(actorId).call({
      postURLs: [url],
      shouldDownloadVideos: true,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false
    });

    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
    );

    const run = await Promise.race([runPromise, timeoutPromise]);

    if (!run || !run.defaultDatasetId) {
      throw new Error('No dataset ID returned from Apify actor.');
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new Error('Apify actor returned empty dataset.');
    }

    const item = items[0] as any;

    if (!item) {
      throw new Error('Apify actor returned invalid item.');
    }

    // Attempt to extract video URL flexibly (excluding web html links)
    let directVideoUrl = item.videoMeta?.downloadAddr || item.mediaUrls?.[0] || item.videoUrl || item.video?.url || item.video?.downloadAddr || item.video?.playAddr || item.videoMeta?.playAddr || item.downloadUrl;

    if (!directVideoUrl) {
      throw new Error('Could not find a direct video URL in Apify output.');
    }

    // Try to fetch the video bytes if direct link is available
    let videoBytes: Buffer | undefined;
    let mimeType: string = 'video/mp4';

    try {
      console.log('Attempting to fetch video from:', directVideoUrl);
      const videoRes = await fetch(directVideoUrl);
      if (videoRes.ok) {
        const arrayBuffer = await videoRes.arrayBuffer();
        videoBytes = Buffer.from(arrayBuffer);
        mimeType = videoRes.headers.get('content-type') || mimeType;
        console.log('Successfully fetched video bytes, size:', videoBytes.length);
      } else {
        console.error('Failed to fetch from directVideoUrl. Status:', videoRes.status, videoRes.statusText);
      }
    } catch (fetchError) {
      console.error('Failed to download video bytes from direct URL:', fetchError);
    }

    return {
      source: 'tiktok',
      originalUrl: url,
      title: item.title || item.desc || item.description,
      author: item.authorMeta?.name || item.author,
      durationSeconds: item.videoMeta?.duration || item.duration,
      directVideoUrl,
      videoBytes,
      mimeType,
      metadata: item
    };
  } catch (err: any) {
    if (err.message === 'TIKTOK_PROVIDER_NOT_CONFIGURED') {
      throw err;
    }
    console.error('Apify Clockworks Provider Error Details:', err);
    throw new Error('TIKTOK_INGESTION_FAILED');
  }
}
