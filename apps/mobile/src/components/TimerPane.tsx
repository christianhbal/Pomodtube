import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PHASES, type PomodoroApi } from '../hooks/usePomodoro';
import { colors, radius } from '../theme';

function format(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

type Props = { pomodoro: PomodoroApi };

export function TimerPane({ pomodoro }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const {
    mode,
    setMode,
    phase,
    remaining,
    progress,
    running,
    completed,
    cycle,
    cycleSize,
    toggle,
    reset,
    skip,
    tryhard,
  } = pomodoro;

  const free = mode === 'tryhard';
  const accent = free ? colors.long : colors[phase];
  const shown = free ? tryhard.elapsed : remaining;
  const idle = free && !tryhard.running && tryhard.elapsed === 0;

  // El tiempo ocupa el panel completo: crece con el espacio disponible.
  const timeSize =
    size.width === 0
      ? 76
      : Math.max(56, Math.min(size.width * 0.26, size.height * 0.22, 160));

  const primaryLabel = free
    ? tryhard.running
      ? 'Pausar'
      : tryhard.elapsed > 0
        ? 'Reanudar'
        : 'Empezar'
    : running
      ? 'Pausar'
      : 'Empezar';

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.main}>
        <View style={styles.header}>
          <View style={styles.side}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={styles.phaseLabel} numberOfLines={1}>
              {free ? 'Try-hard' : PHASES[phase].label}
            </Text>
          </View>

          <View style={styles.segmented}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !free }}
              onPress={() => setMode('pomodoro')}
              style={[styles.segment, !free && styles.segmentActive]}
            >
              <Text
                style={[styles.segmentText, !free && styles.segmentTextActive]}
              >
                Pomodoro
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: free }}
              onPress={() => setMode('tryhard')}
              style={[styles.segment, free && styles.segmentActive]}
            >
              <Text
                style={[styles.segmentText, free && styles.segmentTextActive]}
              >
                Try-hard
              </Text>
            </Pressable>
          </View>

          <View style={[styles.side, styles.sideRight]}>
            <Text style={styles.sessionText} numberOfLines={1}>
              {free
                ? 'Sin límite'
                : `${completed} ${completed === 1 ? 'sesión' : 'sesiones'}`}
            </Text>
          </View>
        </View>

        <View style={styles.center}>
          <Text
            style={[styles.time, { color: accent, fontSize: timeSize }]}
            accessibilityRole="timer"
            accessibilityLabel={
              free ? `Han pasado ${format(shown)}` : `Quedan ${format(shown)}`
            }
            numberOfLines={1}
          >
            {format(shown)}
          </Text>

          {free ? (
            <Text style={styles.hint}>Corre hasta que lo detengas</Text>
          ) : (
            <>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.round(progress * 100)}%`,
                      backgroundColor: accent,
                    },
                  ]}
                />
              </View>

              <Text style={styles.cycleText}>
                Ciclo {cycle} de {cycleSize}
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={
            free ? (tryhard.running ? tryhard.pause : tryhard.start) : toggle
          }
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          {free ? (
            <>
              <Pressable
                onPress={tryhard.discard}
                disabled={idle}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondary,
                  idle && styles.secondaryDisabled,
                  pressed && styles.secondaryPressed,
                ]}
              >
                <Text style={styles.secondaryText}>Descartar</Text>
              </Pressable>

              <Pressable
                onPress={tryhard.stop}
                disabled={idle}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondary,
                  idle && styles.secondaryDisabled,
                  pressed && styles.secondaryPressed,
                ]}
              >
                <Text style={styles.secondaryText}>Detener y guardar</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={reset}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondary,
                  pressed && styles.secondaryPressed,
                ]}
              >
                <Text style={styles.secondaryText}>Reiniciar</Text>
              </Pressable>

              <Pressable
                onPress={skip}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondary,
                  pressed && styles.secondaryPressed,
                ]}
              >
                <Text style={styles.secondaryText}>Saltar</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  main: {
    flex: 1,
    gap: 18,
  },
  segmented: {
    flexDirection: 'row',
    padding: 2,
    gap: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  segmentTextActive: {
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseLabel: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sessionText: {
    flexShrink: 1,
    color: colors.muted,
    fontSize: 11,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  time: {
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
  },
  track: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  cycleText: {
    color: colors.muted,
    fontSize: 12,
  },
  actions: {
    gap: 10,
  },
  primary: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondary: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  secondaryDisabled: {
    opacity: 0.45,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
