import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { embedUrl } from '../lib/youtube';
import { colors, radius } from '../theme';
import { YouTubePicker } from './YouTubePicker';

// react-native-webview no soporta web: acá usamos un <iframe> nativo del
// navegador. Metro resuelve este archivo automáticamente en la build web.

const STORAGE_KEY = 'youtube.videoId';

export function YouTubePane() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => setVideoId(saved || null))
      .catch(() => setVideoId(null))
      .finally(() => setHydrated(true));
  }, []);

  const apply = useCallback((id: string) => {
    setVideoId(id);
    setEditing(false);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  if (!hydrated) return <View style={styles.container} />;

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
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.secondaryPressed,
          ]}
        >
          <Text style={styles.headerButtonText}>Cambiar</Text>
        </Pressable>
      </View>

      {createElement('iframe', {
        key: videoId,
        src: embedUrl(videoId),
        title: 'YouTube',
        allow: 'autoplay; encrypted-media; picture-in-picture',
        allowFullScreen: true,
        style: {
          flex: 1,
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: colors.videoBg,
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  headerHint: { flex: 1, color: colors.muted, fontSize: 11 },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  headerButtonText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  secondaryPressed: { backgroundColor: colors.border },
});
