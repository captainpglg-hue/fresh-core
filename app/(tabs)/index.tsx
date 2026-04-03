import { useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Header } from '../../src/components/ui/Header';
import { Colors } from '../../src/constants/colors';
import { useDashboard } from '../../src/hooks/useDashboard';
import { useAuthStore } from '../../src/stores/authStore';
import { useTemperatureStore } from '../../src/stores/temperatureStore';
import { useCleaningStore } from '../../src/stores/cleaningStore';
import { useTraceabilityStore } from '../../src/stores/traceabilityStore';
import { useCookingStore } from '../../src/stores/cookingStore';
import { useOilStore } from '../../src/stores/oilStore';
import { usePestStore } from '../../src/stores/pestStore';
import { Thermometer, Truck, SprayCan, Flame, Tag, Droplet, Bug, ChevronRight } from 'lucide-react-native';

const MODULE_ROUTES = [
  'temperatures',
  'deliveries',
  'cleaning',
  'cooking',
  'traceability',
  'oil',
  'pests',
] as const;

const MODULE_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  thermometer: Thermometer,
  truck: Truck,
  'spray-can': SprayCan,
  flame: Flame,
  tag: Tag,
  droplet: Droplet,
  bug: Bug,
};

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

  return (
    <View style={styles.container}>
      <Header title="Fresh-Core" showSync />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="h1">{dashboard.greeting}</Text>
        <Text variant="caption" color={Colors.textSecondary}>{dashboard.date}</Text>

        {/* Progress circle (simplified) */}
        <View style={styles.progressContainer}>
          <View style={styles.progressCircle}>
            <Text variant="h1" color={Colors.primary}>{dashboard.progressPercent}%</Text>
            <Text variant="caption" color={Colors.textSecondary}>complete</Text>
          </View>
        </View>

        {/* Urgent alerts */}
        {dashboard.modules.some((m) => m.hasAlert) && (
          <Card style={styles.alertCard}>
            <Text variant="h3" color={Colors.danger}>Alertes</Text>
            {dashboard.modules
              .filter((m) => m.hasAlert && m.alertMessage)
              .map((m) => (
                <View key={m.name} style={styles.alertRow}>
                  <Badge text={m.name} variant="danger" />
                  <Text variant="caption" color={Colors.danger}>{m.alertMessage}</Text>
                </View>
              ))}
          </Card>
        )}

        {/* Module cards */}
        {dashboard.modules.map((module, index) => {
          const IconComponent = MODULE_ICONS[module.icon] || Thermometer;
          const route = MODULE_ROUTES[index];
          const isComplete = module.total > 0 && module.completed >= module.total;
          const hasIssue = module.hasAlert;

          return (
            <Pressable key={module.name} onPress={() => router.push(`/(tabs)/${route}`)}>
              <Card style={styles.moduleCard}>
                <View style={styles.moduleRow}>
                  <View style={[styles.iconBox, { backgroundColor: hasIssue ? '#FECDD3' : isComplete ? Colors.paleGreen : Colors.background }]}>
                    <IconComponent size={24} color={hasIssue ? Colors.danger : isComplete ? Colors.success : Colors.primary} />
                  </View>
                  <View style={styles.moduleInfo}>
                    <Text variant="h3">{module.name}</Text>
                    <Text variant="caption" color={Colors.textSecondary}>
                      {module.total > 0 ? `${module.completed}/${module.total} gestes completes` : 'Aucune donnee'}
                    </Text>
                  </View>
                  <View style={styles.moduleStatus}>
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
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  progressContainer: { alignItems: 'center', paddingVertical: 16 },
  progressCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 6, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white },
  alertCard: { borderLeftWidth: 4, borderLeftColor: Colors.danger, gap: 8 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moduleCard: { marginBottom: 4 },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  moduleInfo: { flex: 1 },
  moduleStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
