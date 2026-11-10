import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DayStat } from '../lib/sessionHistory';
import { colors, radius } from '../theme';

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

type Props = {
  days: DayStat[];
  totalMinutes: number;
};

export function WeeklyStats({ days, totalMinutes }: Props) {
  const [plotHeight, setPlotHeight] = useState(0);

  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes));
  const maxHours = Math.max(1, Math.ceil(maxMinutes / 60));
  const hours = Array.from({ length: maxHours + 1 }, (_, index) => maxHours - index);

  // Etiquetas cada 1 h, salvo que no quepan: ahí se saltan horas.
  const step = Math.max(
    1,
    Math.ceil((14 * maxHours) / Math.max(plotHeight, 1)),
  );
  const labelHours = hours.filter(
    (hour) => hour === 0 || hour === maxHours || hour % step === 0,
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Esta semana</Text>
        <Text style={styles.total}>{formatMinutes(totalMinutes)}</Text>
      </View>

      <View style={styles.chart}>
        <View style={styles.axis}>
          {labelHours.map((hour) => (
            <Text
              key={hour}
              style={[styles.axisLabel, { bottom: `${(hour / maxHours) * 100}%` }]}
            >
              {hour}h
            </Text>
          ))}
        </View>

        <View
          style={styles.plot}
          onLayout={(event) => setPlotHeight(event.nativeEvent.layout.height)}
        >
          {hours.map((hour) => (
            <View
              key={hour}
              style={[styles.gridline, { bottom: `${(hour / maxHours) * 100}%` }]}
            />
          ))}

          <View style={styles.bars}>
            {days.map((day) => {
              const percent = Math.max(
                day.minutes === 0 ? 1.5 : 4,
                (day.minutes / (maxHours * 60)) * 100,
              );

              return (
                <View key={day.key} style={styles.column}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${percent}%`,
                        backgroundColor: day.isToday ? colors.focus : colors.long,
                        opacity: day.minutes === 0 ? 0.25 : 1,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.labels}>
        <View style={styles.axisSpacer} />

        {days.map((day) => (
          <View key={day.key} style={styles.labelColumn}>
            <Text style={[styles.label, day.isToday && styles.labelToday]}>
              {day.label}
            </Text>
            <Text style={[styles.minutes, day.isToday && styles.minutesToday]}>
              {day.minutes > 0 ? `${day.minutes}m` : '—'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  total: {
    color: colors.focus,
    fontSize: 13,
    fontWeight: '700',
  },
  chart: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingTop: 10,
  },
  axis: {
    width: 22,
    position: 'relative',
  },
  axisLabel: {
    position: 'absolute',
    right: 0,
    color: colors.muted,
    fontSize: 9,
    lineHeight: 10,
    fontVariant: ['tabular-nums'],
  },
  plot: {
    flex: 1,
    position: 'relative',
  },
  gridline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '62%',
    minHeight: 3,
    borderRadius: 4,
  },
  labels: {
    flexDirection: 'row',
    gap: 6,
  },
  axisSpacer: {
    width: 22,
  },
  labelColumn: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 12,
  },
  labelToday: {
    color: colors.focus,
    fontWeight: '700',
  },
  minutes: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 11,
    fontVariant: ['tabular-nums'],
  },
  minutesToday: {
    color: colors.focus,
    fontWeight: '700',
  },
});
