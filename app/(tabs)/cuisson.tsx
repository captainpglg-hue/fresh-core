import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { CameraOverlay } from '../../src/components/camera/CameraOverlay';
import { OCRResultCard } from '../../src/components/camera/OCRResultCard';
import { useCookingStore } from '../../src/stores/cookingStore';
import { useAuthStore } from '../../src/stores/authStore';
import { extractTemperature } from '../../src/services/ocr';
import { isCompliant, THRESHOLDS } from '../../src/constants/thresholds';
import { Flame, Timer, ThermometerSun, ArrowLeft } from 'lucide-react-native';

const COOKING_TYPES = [
  { type: 'cooking_minced', label: 'Viande hachee', threshold: '>= 70\u00B0C' },
  { type: 'cooking_poultry', label: 'Volaille', threshold: '>= 74\u00B0C' },
  { type: 'cooking_pork_fish', label: 'Porc / Poisson', threshold: '>= 63\u00B0C' },
  { type: 'cooking_stuffed', label: 'Plat farci', threshold: '>= 70\u00B0C' },
];

type ScreenState = 'main' | 'camera' | 'result';

export default function CuissonScreen() {
  const router = useRouter();
  const { establishment } = useAuthStore();
  const { activeTimers, addCookingRecord, startCoolingTimer, loadRecords } = useCookingStore();
  const [screenState, setScreenState] = useState<ScreenState>('main');
  const [selectedType, setSelectedType] = useState('');
  const [ocrResult, setOcrResult] = useState<{ value: number; confidence: number } | null>(null);

  useEffect(() => {
    if (establishment?.id) {
      loadRecords(establishment.id);
    }
  }, [establishment?.id]);

  const handleCapture = async (uri: string) => {
    const result = await extractTemperature(uri);
    if (result) {
      setOcrResult({ value: result.value, confidence: result.confidence });
    } else {
      setOcrResult({ value: 0, confidence: 0 });
    }
    setScreenState('result');
  };

  const handleValidate = async (value: number) => {
    if (!establishment?.id) return;
    const threshold = THRESHOLDS[selectedType];
    await addCookingRecord({
      establishment_id: establishment.id,
      equipment_id: 'cooking',
      temperature_value: value,
      threshold_min: threshold?.min ?? null,
      threshold_max: threshold?.max ?? null,
      is_compliant: isCompliant(value, selectedType),
      reading_type: 'cooking_core',
    });
    setScreenState('main');
    setOcrResult(null);
  };

  if (screenState === 'camera') {
    return <CameraOverlay onCapture={handleCapture} onClose={() => setScreenState('main')} />;
  }

  if (screenState === 'result' && ocrResult) {
    return (
      <View style={styles.resultContainer}>
        <OCRResultCard
          value={ocrResult.value}
          confidence={ocrResult.confidence}
          isCompliant={isCompliant(ocrResult.value, selectedType)}
          equipmentName={COOKING_TYPES.find((t) => t.type === selectedType)?.label || 'Cuisson'}
          onValidate={handleValidate}
          onRetake={() => setScreenState('camera')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Cuisson</Text>
        <View style={styles.placeholder} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="h2">Temperature de cuisson</Text>
        <Text variant="caption" color={Colors.textSecondary}>Selectionnez le type de produit puis controle</Text>

        {COOKING_TYPES.map((ct) => (
          <Pressable
            key={ct.type}
            onPress={() => { setSelectedType(ct.type); setScreenState('camera'); }}
          >
            <Card style={styles.typeCard}>
              <View style={styles.typeRow}>
                <Flame size={20} color={Colors.accent} />
                <View style={styles.typeInfo}>
                  <Text variant="body">{ct.label}</Text>
                  <Text variant="caption" color={Colors.textSecondary}>{ct.threshold}</Text>
                </View>
                <ThermometerSun size={20} color={Colors.textSecondary} />
              </View>
            </Card>
          </Pressable>
        ))}

        <Text variant="h2" style={styles.sectionTitle}>Refroidissement rapide</Text>
        <Text variant="caption" color={Colors.textSecondary}>De +63\u00B0C a +10\u00B0C en moins de 2h</Text>

        {activeTimers.map((timer) => (
          <Card key={timer.id} style={styles.timerCard}>
            <View style={styles.timerHeader}>
              <Timer size={20} color={Colors.primary} />
              <Text variant="h3">Refroidissement en cours</Text>
              <Badge
                text={timer.status === 'active' ? 'En cours' : timer.status === 'completed' ? 'Termine' : 'Echec'}
                variant={timer.status === 'active' ? 'warning' : timer.status === 'completed' ? 'success' : 'danger'}
              />
            </View>
            {[0, 1, 2].map((i) => {
              const cp = timer.checkpoints[i];
              const label = i === 0 ? 'T0' : i === 1 ? 'T+1h' : 'T+2h';
              return (
                <View key={i} style={styles.checkpoint}>
                  <Text variant="body">{label}</Text>
                  {cp ? (
                    <Badge text={`${cp.temperature}\u00B0C`} variant={cp.temperature <= 10 ? 'success' : 'warning'} />
                  ) : (
                    <Button
                      title="Mesurer"
                      onPress={() => { setSelectedType('cooling'); setScreenState('camera'); }}
                      variant="ghost"
                      size="sm"
                    />
                  )}
                </View>
              );
            })}
          </Card>
        ))}

        <Button
          title="Demarrer un refroidissement"
          onPress={() => startCoolingTimer('cooling')}
          variant="secondary"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DEE2E6',
    backgroundColor: Colors.white,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  placeholder: { width: 44 },
  scroll: { padding: 16, gap: 12 },
  typeCard: { marginBottom: 4 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeInfo: { flex: 1 },
  sectionTitle: { marginTop: 24 },
  timerCard: { gap: 12 },
  timerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkpoint: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#DEE2E6' },
  resultContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center' },
});
