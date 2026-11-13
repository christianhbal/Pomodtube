import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AccountBar } from './src/components/AccountBar';
import { AuthPanel } from './src/components/AuthPanel';
import { AuthProvider, useAuth } from './src/components/AuthProvider';
import { GoalsPanel } from './src/components/GoalsPanel';
import { StatsPane } from './src/components/StatsPane';
import { TimerPane } from './src/components/TimerPane';
import { YouTubePane } from './src/components/YouTubePane';
import { usePomodoro } from './src/hooks/usePomodoro';
import { colors } from './src/theme';

const KEEP_AWAKE_TAG = 'pomodoro-running';

function Main() {
  const auth = useAuth();
  const pomodoro = usePomodoro({
    onSessionCompleted:
      auth.status === 'authenticated' ? auth.syncSession : undefined,
  });
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const timerRunning = pomodoro.running || pomodoro.tryhard.running;

  // La pantalla no se apaga mientras corre una sesión.
  useEffect(() => {
    if (!timerRunning) return;

    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [timerRunning]);

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <View
        style={[
          styles.split,
          { flexDirection: landscape ? 'row' : 'column' },
        ]}
      >
        {/* Izquierda: login, o video + estadísticas si hay sesión. */}
        <View style={landscape ? styles.leftColumn : styles.topSection}>
          {auth.status === 'loading' ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.focus} />
            </View>
          ) : auth.status === 'anonymous' ? (
            <AuthPanel />
          ) : (
            <>
              <AccountBar email={auth.user?.email} onLogout={auth.logout} />

              <View
                style={
                  landscape
                    ? styles.videoPaneLandscape
                    : styles.videoPanePortrait
                }
              >
                <YouTubePane />
              </View>

              <View style={styles.dividerHorizontal} />

              <View
                style={
                  landscape
                    ? styles.statsPaneLandscape
                    : styles.statsPanePortrait
                }
              >
                <StatsPane />
              </View>
            </>
          )}
        </View>

        <View
          style={landscape ? styles.dividerVertical : styles.dividerHorizontal}
        />

        {/* Derecha: objetivos arriba y el foco debajo, con o sin login. */}
        <View
          style={
            landscape ? styles.timerPaneLandscape : styles.timerPanePortrait
          }
        >
          {auth.status === 'authenticated' ? (
            <View style={landscape ? styles.goalsLandscape : styles.goalsPortrait}>
              <GoalsPanel />
            </View>
          ) : null}

          {auth.status === 'authenticated' ? (
            <View style={styles.dividerHorizontal} />
          ) : null}

          <View style={styles.timerArea}>
            <TimerPane pomodoro={pomodoro} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        <AuthProvider>
          <Main />
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  split: {
    flex: 1,
  },
  leftColumn: {
    flex: 0.45,
    flexDirection: 'column',
    backgroundColor: colors.bg,
  },
  topSection: {
    flex: 0.4,
    flexDirection: 'column',
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  videoPaneLandscape: {
    flex: 0.62,
  },
  videoPanePortrait: {
    flex: 1,
  },
  statsPaneLandscape: {
    flex: 0.38,
    minHeight: 132,
    maxHeight: 320,
    backgroundColor: colors.bg,
  },
  statsPanePortrait: {
    flex: 0.4,
    minHeight: 150,
    maxHeight: 220,
    backgroundColor: colors.bg,
  },
  timerPaneLandscape: {
    flex: 0.55,
    flexDirection: 'column',
    backgroundColor: colors.bg,
  },
  timerPanePortrait: {
    flex: 0.6,
    flexDirection: 'column',
    backgroundColor: colors.bg,
  },
  goalsLandscape: {
    flex: 0.34,
    minHeight: 248,
    maxHeight: 300,
  },
  goalsPortrait: {
    flex: 0.32,
    minHeight: 200,
    maxHeight: 220,
  },
  timerArea: {
    flex: 1,
  },
  dividerVertical: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerHorizontal: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
