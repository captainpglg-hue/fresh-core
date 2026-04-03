import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Colors } from '../../constants/colors';
import type { TemperatureReading } from '../../types/database';

interface Props {
  readings: TemperatureReading[];
  thresholdMin?: number;
  thresholdMax?: number;
}

export function TemperatureChart({ readings, thresholdMin, thresholdMax }: Props) {
  if (readings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="body" color={Colors.textSecondary}>
          Aucun releve pour cette periode
        </Text>
      </View>
    );
  }

  // Find range for bar sizing
  const values = readings.map((r) => r.temperature_value);
  const allValues = [...values];
  if (thresholdMin !== undefined) allValues.push(thresholdMin);
  if (thresholdMax !== undefined) allValues.push(thresholdMax);
  const minVal = Math.min(...allValues) - 2;
  const maxVal = Math.max(...allValues) + 2;
  const range = maxVal - minVal || 1;

  const formatTime = (isoStr: string): string => {
    const date = new Date(isoStr);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDate = (isoStr: string): string => {
    const date = new Date(isoStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  return (
    <View style={styles.container}>
      {/* Threshold legend */}
      {(thresholdMin !== undefined || thresholdMax !== undefined) && (
        <View style={styles.legend}>
          {thresholdMax !== undefined && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.danger }]} />
              <Text variant="caption" color={Colors.textSecondary}>
                Seuil max : {thresholdMax}°C
              </Text>
            </View>
          )}
          {thresholdMin !== undefined && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
              <Text variant="caption" color={Colors.textSecondary}>
                Seuil min : {thresholdMin}°C
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Readings list with bars */}
      {readings.map((reading) => {
        const barWidth = Math.max(
          ((reading.temperature_value - minVal) / range) * 100,
          5,
        );

        const barColor = reading.is_compliant ? Colors.success : Colors.danger;

        return (
          <View key={reading.id} style={styles.readingRow}>
            <View style={styles.readingTimeCol}>
              <Text variant="caption" color={Colors.textSecondary}>
                {formatDate(reading.recorded_at)}
              </Text>
              <Text variant="caption" style={styles.timeText}>
                {formatTime(reading.recorded_at)}
              </Text>
            </View>

            <View style={styles.barContainer}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${Math.min(barWidth, 100)}%`,
                    backgroundColor: barColor,
                  },
                ]}
              />
              {/* Threshold marker */}
              {thresholdMax !== undefined && (
                <View
                  style={[
                    styles.thresholdLine,
                    {
                      left: `${((thresholdMax - minVal) / range) * 100}%`,
                    },
                  ]}
                />
              )}
              {thresholdMin !== undefined && (
                <View
                  style={[
                    styles.thresholdLine,
                    styles.thresholdLineMin,
                    {
                      left: `${((thresholdMin - minVal) / range) * 100}%`,
                    },
                  ]}
                />
              )}
            </View>

            <View style={styles.readingValueCol}>
              <Text
                variant="h3"
                color={reading.is_compliant ? Colors.success : Colors.danger}
              >
                {reading.temperature_value.toFixed(1)}°C
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  readingTimeCol: {
    width: 52,
    marginRight: 8,
  },
  timeText: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  barContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 8,
  },
  bar: {
    height: '100%',
    borderRadius: 4,
    opacity: 0.8,
  },
  thresholdLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.danger,
  },
  thresholdLineMin: {
    backgroundColor: Colors.warning,
  },
  readingValueCol: {
    width: 64,
    alignItems: 'flex-end',
  },
});
