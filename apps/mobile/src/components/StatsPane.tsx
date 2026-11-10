import { StyleSheet, View } from 'react-native';
import { useWeeklyStats } from '../hooks/useWeeklyStats';
import { colors } from '../theme';
import { WeeklyStats } from './WeeklyStats';

export function StatsPane() {
  const { days, totalMinutes } = useWeeklyStats();

  return (
    <View style={styles.container}>
      <WeeklyStats days={days} totalMinutes={totalMinutes} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 10,
  },
});
