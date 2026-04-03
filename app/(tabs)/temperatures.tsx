import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus,
  Thermometer,
  Snowflake,
  Flame,
  MapPin,
  X,
} from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Header } from '../../src/components/ui/Header';
import { IconButton } from '../../src/components/ui/IconButton';
import { ProgressCircle } from '../../src/components/ui/ProgressCircle';
import { Colors } from '../../src/constants/colors';
import { useTemperatureStore } from '../../src/stores/temperatureStore';
import { useAuthStore } from '../../src/stores/authStore';
import { THRESHOLDS } from '../../src/constants/thresholds';
import type { Equipment, TemperatureReading } from '../../src/types/database';

type EquipmentType = Equipment['type'];

const EQUIPMENT_TYPES: { value: EquipmentType; label: string }[] = [
  { value: 'cold_positive', label: 'Chambre froide positive' },
  { value: 'cold_negative', label: 'Chambre froide negative' },
  { value: 'cold_positive_veg', label: 'Frigo legumes' },
  { value: 'cold_room', label: 'Chambre froide' },
  { value: 'display_case', label: 'Vitrine refrigeree' },
  { value: 'hot_holding', label: 'Maintien chaud' },
  { value: 'cooking', label: 'Cuisson' },
  { value: 'fryer', label: 'Friteuse' },
  { value: 'other', label: 'Autre' },
];

function getEquipmentIcon(type: EquipmentType): React.ReactNode {
  switch (type) {
    case 'cold_positive':
    case 'cold_positive_veg':
    case 'cold_negative':
    case 'cold_room':
    case 'display_case':
      return <Snowflake size={20} color={Colors.primary} />;
    case 'hot_holding':
    case 'cooking':
    case 'fryer':
      return <Flame size={20} color={Colors.accent} />;
    default:
      return <Thermometer size={20} color={Colors.primary} />;
  }
}

function getTypeLabel(type: EquipmentType): string {
  return EQUIPMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

function getThresholdDisplay(type: EquipmentType): string {
  const threshold = THRESHOLDS[type];
  if (!threshold) return '';
  if (threshold.min !== undefined && threshold.max !== undefined) {
    return `Min ${threshold.min}°C / Max ${threshold.max}°C`;
  }
  if (threshold.max !== undefined) return `Max ${threshold.max}°C`;
  if (threshold.min !== undefined) return `Min ${threshold.min}°C`;
  return '';
}

interface EquipmentWithReading {
  equipment: Equipment;
  lastReading: TemperatureReading | null;
}

export default function TemperaturesScreen() {
  const router = useRouter();
  const { establishment } = useAuthStore();
  const {
    equipment,
    readings,
    loadEquipment,
    addEquipment,
    getReadingsForDate,
  } = useTemperatureStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const displayDate = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr });

  useEffect(() => {
    if (establishment?.id) {
      loadEquipment(establishment.id);
      getReadingsForDate(todayStr);
    }
  }, [establishment?.id, todayStr, loadEquipment, getReadingsForDate]);

  const equipmentWithReadings: EquipmentWithReading[] = equipment.map((eq) => {
    const eqReadings = readings.filter(
      (r) => r.equipment_id === eq.id && r.recorded_at.startsWith(todayStr),
    );
    const lastReading =
      eqReadings.length > 0
        ? eqReadings.sort(
            (a, b) =>
              new Date(b.recorded_at).getTime() -
              new Date(a.recorded_at).getTime(),
          )[0]
        : null;
    return { equipment: eq, lastReading };
  });

  const completedCount = equipmentWithReadings.filter(
    (e) => e.lastReading,
  ).length;
  const totalCount = equipment.length;
  const completionPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAddEquipment = useCallback(async () => {
    if (!newName.trim() || !establishment?.id) return;

    setSaving(true);
    try {
      const selectedType = EQUIPMENT_TYPES[selectedTypeIndex].value;
      const threshold = THRESHOLDS[selectedType];

      await addEquipment({
        establishment_id: establishment.id,
        name: newName.trim(),
        type: selectedType,
        location: newLocation.trim() || null,
        threshold_min: threshold?.min ?? null,
        threshold_max: threshold?.max ?? null,
        is_active: true,
      });

      setNewName('');
      setNewLocation('');
      setSelectedTypeIndex(0);
      setShowAddModal(false);
    } finally {
      setSaving(false);
    }
  }, [
    newName,
    newLocation,
    selectedTypeIndex,
    establishment?.id,
    addEquipment,
  ]);

  const handleEquipmentPress = useCallback(
    (eq: Equipment) => {
      router.push({
        pathname: '/temperature/releve',
        params: {
          equipmentId: eq.id,
          name: eq.name,
          type: eq.type,
        },
      });
    },
    [router],
  );

  const renderEquipmentCard = useCallback(
    ({ item }: { item: EquipmentWithReading }) => {
      const { equipment: eq, lastReading } = item;
      const typeLabel = getTypeLabel(eq.type);

      return (
        <Pressable
          onPress={() => handleEquipmentPress(eq)}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Card style={styles.equipmentCard}>
            <View style={styles.equipmentRow}>
              <View style={styles.equipmentIconContainer}>
                {getEquipmentIcon(eq.type)}
              </View>

              <View style={styles.equipmentInfo}>
                <Text variant="h3">{eq.name}</Text>
                <Text variant="caption" color={Colors.textSecondary}>
                  {typeLabel}
                  {eq.location ? ` — ${eq.location}` : ''}
                </Text>
              </View>

              <View style={styles.equipmentRight}>
                {lastReading ? (
                  <>
                    <Text
                      variant="h2"
                      color={
                        lastReading.is_compliant
                          ? Colors.success
                          : Colors.danger
                      }
                    >
                      {lastReading.temperature_value}°C
                    </Text>
                    <Text variant="caption" color={Colors.textSecondary}>
                      {format(new Date(lastReading.recorded_at), 'HH:mm')}
                    </Text>
                    <Badge
                      text={
                        lastReading.is_compliant ? 'Conforme' : 'Non conforme'
                      }
                      variant={lastReading.is_compliant ? 'success' : 'danger'}
                    />
                  </>
                ) : (
                  <Badge text="A relever" variant="warning" />
                )}
              </View>
            </View>
          </Card>
        </Pressable>
      );
    },
    [handleEquipmentPress],
  );

  const selectedThresholdDisplay = getThresholdDisplay(
    EQUIPMENT_TYPES[selectedTypeIndex].value,
  );

  return (
    <View style={styles.container}>
      <Header title="Temperatures du jour" subtitle={displayDate} />

      {/* Stats Card */}
      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statsTextCol}>
            <Text variant="h2" color={Colors.primary}>
              {completedCount}/{totalCount} releves effectues
            </Text>
            <Text variant="caption" color={Colors.textSecondary}>
              {totalCount > 0
                ? completedCount === totalCount
                  ? 'Tous les releves sont a jour'
                  : `${totalCount - completedCount} equipement(s) en attente`
                : 'Ajoutez votre premier equipement'}
            </Text>
          </View>
          <ProgressCircle
            percent={completionPercent}
            size={72}
            color={
              completionPercent === 100
                ? Colors.success
                : completionPercent >= 50
                  ? Colors.primary
                  : Colors.warning
            }
          />
        </View>
      </Card>

      <FlatList
        data={equipmentWithReadings}
        keyExtractor={(item) => item.equipment.id}
        renderItem={renderEquipmentCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Thermometer size={48} color={Colors.textSecondary} />
            <Text
              variant="body"
              color={Colors.textSecondary}
              style={styles.emptyText}
            >
              Ajoutez votre premier equipement
            </Text>
            <Text
              variant="caption"
              color={Colors.textSecondary}
              style={styles.emptySubtext}
            >
              Appuyez sur + pour commencer a enregistrer vos temperatures
            </Text>
            <View style={styles.emptyButtonSpacer} />
            <Button
              title="Ajouter un equipement"
              onPress={() => setShowAddModal(true)}
              variant="primary"
              size="md"
            />
          </View>
        }
      />

      {/* Floating Add Button */}
      <Pressable
        onPress={() => setShowAddModal(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Plus size={28} color={Colors.white} />
      </Pressable>

      {/* Add Equipment Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="h2">Ajouter un equipement</Text>
              <IconButton
                icon={<X size={24} color={Colors.textSecondary} />}
                onPress={() => setShowAddModal(false)}
              />
            </View>

            <ScrollView style={styles.modalBody}>
              <Input
                label="Nom de l'equipement"
                value={newName}
                onChangeText={setNewName}
                placeholder="Ex: Frigo cuisine"
                icon={<Thermometer size={18} color={Colors.textSecondary} />}
              />

              <Text variant="h3" style={styles.fieldLabel}>
                Type d&apos;equipement
              </Text>
              <View style={styles.typeGrid}>
                {EQUIPMENT_TYPES.map((eqType, index) => (
                  <Pressable
                    key={eqType.value}
                    onPress={() => setSelectedTypeIndex(index)}
                    style={[
                      styles.typeChip,
                      selectedTypeIndex === index && styles.typeChipActive,
                    ]}
                  >
                    <Text
                      variant="caption"
                      color={
                        selectedTypeIndex === index
                          ? Colors.white
                          : Colors.textPrimary
                      }
                    >
                      {eqType.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Threshold display based on selected type */}
              <View style={styles.thresholdInfo}>
                <Text variant="caption" color={Colors.textSecondary}>
                  Seuil :{' '}
                  {selectedThresholdDisplay || 'Non defini pour ce type'}
                </Text>
              </View>

              <Input
                label="Emplacement (optionnel)"
                value={newLocation}
                onChangeText={setNewLocation}
                placeholder="Ex: Cuisine principale"
                icon={<MapPin size={18} color={Colors.textSecondary} />}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Annuler"
                variant="ghost"
                onPress={() => setShowAddModal(false)}
              />
              <Button
                title="Ajouter cet equipement"
                variant="primary"
                onPress={handleAddEquipment}
                loading={saving}
                disabled={!newName.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  statsCard: {
    margin: 16,
    marginBottom: 0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsTextCol: {
    flex: 1,
    marginRight: 16,
    gap: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  equipmentCard: {
    marginBottom: 10,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.paleGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  equipmentInfo: {
    flex: 1,
    gap: 2,
  },
  equipmentRight: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 8,
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    marginTop: 12,
    fontWeight: '600',
  },
  emptySubtext: {
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyButtonSpacer: {
    height: 16,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  fieldLabel: {
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  thresholdInfo: {
    backgroundColor: Colors.paleGreen,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  pressed: {
    opacity: 0.85,
  },
});
