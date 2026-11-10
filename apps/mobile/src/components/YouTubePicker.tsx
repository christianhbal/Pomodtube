import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { parseVideoId } from '../lib/youtube';
import {
  hasYouTubeSearch,
  searchYouTube,
  type YouTubeSearchResult,
} from '../lib/youtubeSearch';
import { colors, radius } from '../theme';

type Props = {
  onSelect: (videoId: string) => void;
};

export function YouTubePicker({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchEnabled = hasYouTubeSearch;

  const run = async () => {
    const value = query.trim();
    if (!value || loading) return;

    // Si ya es una URL o un ID, no gastamos cuota: lo cargamos directo.
    const direct = parseVideoId(value);
    if (direct) {
      onSelect(direct);
      return;
    }

    if (!searchEnabled) {
      setError('El buscador todavía no está configurado. Pegá una URL de YouTube.');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const next = await searchYouTube(value);
      setResults(next);
      if (next.length === 0) setError('No encontré videos con ese nombre.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setResults([]);
      setError(
        message === 'quota'
          ? 'Se agotó la cuota diaria de YouTube. Probá más tarde o pegá una URL.'
          : 'No pude buscar ahora. Revisá la conexión o pegá una URL.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {searchEnabled ? 'Buscar en YouTube' : 'Pegá un video de YouTube'}
      </Text>
      <Text style={styles.hint}>
        {searchEnabled
          ? 'Escribí el nombre del video o pegá una URL. Se reproduce arriba, en loop.'
          : 'Se reproduce arriba, en loop, mientras corre el Pomodoro.'}
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            if (error) setError(null);
          }}
          onSubmitEditing={run}
          placeholder={
            searchEnabled ? 'Nombre del video o link' : 'https://youtube.com/watch?v=...'
          }
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        <Pressable
          onPress={run}
          accessibilityRole="button"
          disabled={loading}
          style={({ pressed }) => [
            styles.searchButton,
            (pressed || loading) && styles.searchButtonPressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} size="small" />
          ) : (
            <Text style={styles.searchButtonText}>
              {searchEnabled ? 'Buscar' : 'Cargar'}
            </Text>
          )}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {results.length > 0 ? (
        <ScrollView
          style={styles.results}
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
        >
          {results.map((item) => (
            <Pressable
              key={item.videoId}
              onPress={() => onSelect(item.videoId)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.result,
                pressed && styles.resultPressed,
              ]}
            >
              {item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
              ) : (
                <View style={styles.thumb} />
              )}
              <View style={styles.resultText}>
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.resultChannel} numberOfLines={1}>
                  {item.channel}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : searched && !loading && !error ? (
        <Text style={styles.empty}>Sin resultados.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  searchButton: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.focus,
  },
  searchButtonPressed: {
    opacity: 0.85,
  },
  searchButtonText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
  },
  results: {
    flex: 1,
    marginTop: 2,
  },
  resultsContent: {
    gap: 8,
    paddingBottom: 8,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 8,
  },
  resultPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  thumb: {
    width: 72,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  resultChannel: {
    color: colors.muted,
    fontSize: 11,
  },
  empty: {
    color: colors.muted,
    fontSize: 12,
  },
});
