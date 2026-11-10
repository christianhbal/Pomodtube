const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const URL_RE =
  /(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/;

/**
 * Acepta una URL completa de YouTube, una URL corta (youtu.be) o el ID de 11
 * caracteres. Devuelve null si no puede reconocerlo.
 */
export function parseVideoId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (ID_RE.test(value)) return value;

  const match = value.match(URL_RE);
  return match ? match[1] : null;
}

/**
 * URL del reproductor oficial embebido.
 * - `playsinline` evita que iOS abra el player a pantalla completa.
 * - `autoplay` + `mute` es la única combinación que el navegador permite.
 * - `loop` + `playlist` repite el mismo video indefinidamente.
 */
export function embedUrl(id: string): string {
  return (
    `https://www.youtube.com/embed/${id}` +
    `?playsinline=1&rel=0&autoplay=1&mute=1&loop=1&playlist=${id}`
  );
}
