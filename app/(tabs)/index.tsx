import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Thermometer,
  Truck,
  SprayCan,
  Flame,
  Tag,
  Droplet,
  Bug,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Header } from '../../src/components/ui/Header';
import { ProgressCircle } from '../../src/components/ui/ProgressCircle';
import { Colors } from '../../src/constants/colors';
import { useDashboard } from '../../src/hooks/useDashboard';
import { useAuthStore } from '../../src/stores/authStore';
import { useTemperatureStore } from '../../src/stores/temperatureStore';
import { useCleaningStore } from '../../src/stores/cleaningStore';
import { useTraceabilityStore } from '../../src/stores/traceabilityStore';
import { useCookingStore } from '../../src/stores/cookingStore';
import { useOilStore } from '../../src/stores/oilStore';
import { usePestStore } from '../../src/stores/pestStore';

// ── Icon mapping ───────────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  thermometer: Thermometer,
  truck: Truck,
  'spray-can': SprayCan,
  flame: Flame,
  tag: Tag,
  droplet: Droplet,
  bug: Bug,
};

const MODULE_ROUTES = [
  '/(tabs)/temperatures',
  '/(tabs)/receptions',
  '/(tabs)/nettoyage',
  '/(tabs)/cuisson',
  '/(tabs)/tracabilite',
  '/(tabs)/huiles',
  '/(tabs)/nuisibles',
] as const;

const MODULE_COLORS = [
  '#2D6A4F',
  '#E76F51',
  '#264653',
  '#E9C46A',
  '#F4A261',
  '#40916C',
  '#6C757D',
];

// ── Dashboard Screen ───────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { establishment } = useAuthStore();
  const dashboard = useDashboard();

  useEffect(() => {
    if (!establishment?.id) return;
    useTemperatureStore.getState().loadEquipment(establishment.id);
    useCleaningStore.getState().initDefaultTasks(establishment.id);
    useTraceabilityStore.getState().loadProducts(establishment.id);
    useCookingStore.getState().loadRecords(establishment.id);
    useOilStore.getState().loadData(establishment.id);
    usePestStore.getState().loadData(establishment.id);
  }, [establishment?.id]);

  const urgentAlerts = dashboard.modules.filter((m) => m.hasAlert && m.alertMessage);
  const hasUrgentAlerts = urgentAlerts.length > 0;

  return (
    <View style={styles.container}>
      <Header title="Fresh-Core" showSync />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Greeting */}
        <Text variant="h1" style={styles.greeting}>
          {dashboard.greeting} !
        </Text>
        <Text variant="body" color={Colors.textSecondary} style={styles.date}>
          {dashboard.date}
        </Text>

        {/* Urgent Alerts */}
        {hasUrgentAlerts && (
          <Card variant="alert" style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <AlertTriangle size={20} color={Colors.danger} />
              <Text variant="h3" color={Colors.danger} style={styles.alertTitle}>
                Alertes urgentes
              </Text>
            </View>
            {urgentAlerts.map((m) => (
              <View key={m.name} style={styles.alertRow}>
                <Badge text={m.name} variant="danger" />
                <Text variant="caption" color={Colors.danger}>
                  {m.alertMessage}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Central Progress */}
        <Card style={styles.progressCard}>
          <ProgressCircle
            percent={dashboard.progressPercent}
            size={140}
            color={Colors.primary}
            label={`${dashboard.completedTasks} gestes sur ${dashboard.totalTasks}`}
          />
        </Card>

        {/* Module Cards */}
        {dashboard.modules.map((module, index) => {
          const IconComponent = MODULE_ICONS[module.icon] ?? Thermometer;
          const route = MODULE_ROUTES[index];
          const isComplete = module.total > 0 && module.completed >= module.total;
          const hasIssue = module.hasAlert;
          const progress = module.total > 0 ? module.completed / module.total : 0;
          const moduleColor = MODULE_COLORS[index] ?? Colors.primary;

          const iconBgColor = hasIssue
            ? '#FECDD3'
            : isComplete
              ? Colors.paleGreen
              : Colors.background;
          const iconColor = hasIssue
            ? Colors.danger
            : isComplete
              ? Colors.success
              : moduleColor;

          return (
            <Card
              key={module.name}
              style={styles.moduleCard}
              onPress={() => router.push(route)}
            >
              <View style={styles.moduleRow}>
                {/* Icon circle */}
                <View style={[styles.iconCircle, { backgroundColor: iconBgColor }]}>
                  <IconComponent size={24} color={iconColor} />
                </View>

                {/* Module info */}
                <View style={styles.moduleInfo}>
                  <Text variant="h3">{module.name}</Text>
                  <Text variant="caption" color={Colors.textSecondary}>
                    {module.total > 0
                      ? `${module.completed}/${module.total} completes`
                      : 'Aucune donnee'}
                  </Text>
                </View>

                {/* Status badge + chevron */}
                <View style={styles.moduleRight}>
                  {hasIssue ? (
                    <Badge text="Alerte" variant="danger" />
                  ) : isComplete ? (
                    <Badge text="OK" variant="success" />
                  ) : module.total > 0 ? (
                    <Badge text="En cours" variant="warning" />
                  ) : null}
                  <ChevronRight size={16} color={Colors.textSecondary} />
                </View>
              </View>

              {/* Progress bar */}
              {module.total > 0 && (
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(progress * 100, 100)}%`,
                          backgroundColor: hasIssue
                            ? Colors.danger
                            : isComplete
                              ? Colors.success
                              : moduleColor,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  greeting: {
    marginTop: 4,
  },
  date: {
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  // Alert section
  alertCard: {
    gap: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertTitle: {
    flex: 1,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  // Progress card
  progressCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  // Module cards
  moduleCard: {
    marginBottom: 4,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleInfo: {
    flex: 1,
    gap: 2,
  },
  moduleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Progress bar
  progressBarContainer: {
    marginTop: 10,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
});
