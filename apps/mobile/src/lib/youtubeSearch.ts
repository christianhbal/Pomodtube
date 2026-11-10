const API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim();

/** Si no hay key configurada, el buscador se oculta y queda el modo link. */
export const hasYouTubeSearch = Boolean(API_KEY);

export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
};

type ApiItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
};

export type YouTubeSearchError = 'missing_key' | 'quota' | 'request_failed';

/**
 * Búsqueda oficial con YouTube Data API v3.
 *
 * La key va en `EXPO_PUBLIC_YOUTUBE_API_KEY` (apps/mobile/.env). Es una key
 * limitada por cuota, no un secreto de backend; conviene restringirla a la
 * YouTube Data API y, cuando compiles el APK, al paquete de la app.
 */
export async function searchYouTube(
  query: string,
): Promise<YouTubeSearchResult[]> {
  if (!API_KEY) throw new Error('missing_key' satisfies YouTubeSearchError);

  const params = [
    'part=snippet',
    'type=video',
    'videoEmbeddable=true',
    'relevanceLanguage=es',
    'maxResults=12',
    `q=${encodeURIComponent(query)}`,
    `key=${encodeURIComponent(API_KEY)}`,
  ].join('&');

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
  );

  if (!response.ok) {
    const error: YouTubeSearchError =
      response.status === 403 ? 'quota' : 'request_failed';
    throw new Error(error);
  }

  const data = (await response.json()) as { items?: ApiItem[] };

  return (data.items ?? [])
    .map((item): YouTubeSearchResult | null => {
      const videoId = item.id?.videoId;
      // Defensa extra: el src del reproductor solo acepta IDs válidos.
      if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;

      return {
        videoId,
        title: item.snippet?.title ?? 'Sin título',
        channel: item.snippet?.channelTitle ?? '',
        thumbnail:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          '',
      };
    })
    .filter((item): item is YouTubeSearchResult => item !== null);
}
