import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { embedUrl } from '../lib/youtube';
import { colors, radius } from '../theme';
import { YouTubePicker } from './YouTubePicker';

const STORAGE_KEY = 'youtube.videoId';

/**
 * El WebView solo puede navegar a YouTube/Google. Cualquier otro destino se
 * bloquea: aunque el usuario pegue una URL rara, `parseVideoId` ya la reduce a
 * un ID de 11 caracteres y el src siempre se construye acá.
 */
const ALLOWED_URL =
  /^https:\/\/([a-z0-9-]+\.)*(youtube\.com|youtube-nocookie\.com|google\.com|googlevideo\.com|ytimg\.com|gstatic\.com)(\/|$)/i;

function isAllowedUrl(url: string): boolean {
  return url === 'about:blank' || ALLOWED_URL.test(url);
}

export function YouTubePane() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => setVideoId(saved || null))
      .catch(() => setVideoId(null))
      .finally(() => setHydrated(true));
  }, []);

  const apply = useCallback((id: string) => {
    setLoadError(false);
    setVideoId(id);
    setEditing(false);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  if (!hydrated) {
    return <View style={styles.container} />;
  }

  if (editing || !videoId) {
    return (
      <View style={styles.container}>
        <YouTubePicker onSelect={apply} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerHint} numberOfLines={1}>
          YouTube · tocá 🔊 para el sonido
        </Text>
        <Pressable
          onPress={() => setEditing(true)}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.secondaryPressed,
          ]}
        >
          <Text style={styles.headerButtonText}>Cambiar</Text>
        </Pressable>
      </View>

      {loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>No se pudo cargar el video</Text>
          <Text style={styles.errorBody}>
            Puede tener la reproducción embebida deshabilitada o ser privado.
          </Text>
          <View style={styles.formActions}>
            <Pressable
              onPress={() => {
                setLoadError(false);
                setReloadToken((token) => token + 1);
              }}
              accessibilityRole="button"
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Reintentar</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`)
              }
              accessibilityRole="button"
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Abrir en YouTube</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <WebView
          key={`${videoId}-${reloadToken}`}
          source={{ uri: embedUrl(videoId) }}
          style={styles.web}
          containerStyle={styles.webContainer}
          originWhitelist={['https://*', 'about:blank']}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          setSupportMultipleWindows={false}
          allowFileAccess={false}
          mixedContentMode="never"
          onShouldStartLoadWithRequest={(request) => isAllowedUrl(request.url)}
          onError={() => setLoadError(true)}
          onHttpError={() => setLoadError(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  headerHint: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  headerButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  web: {
    flex: 1,
    backgroundColor: colors.videoBg,
  },
  webContainer: {
    flex: 1,
    backgroundColor: colors.videoBg,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondary: {
    flex: 1,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryPressed: {
    backgroundColor: colors.border,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: colors.bg,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  errorBody: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
});
