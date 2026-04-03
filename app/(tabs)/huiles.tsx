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
import { useOilStore } from '../../src/stores/oilStore';
import { useAuthStore } from '../../src/stores/authStore';
import { extractTemperature } from '../../src/services/ocr';
import { isCompliant } from '../../src/constants/thresholds';
import { Droplet, FlaskConical, RefreshCw, Filter, FileText, ArrowLeft } from 'lucide-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type ScreenState = 'main' | 'camera' | 'result';

export default function HuilesScreen() {
  const router = useRouter();
  const { establishment } = useAuthStore();
  const { fryers, loadData, addControl, getLastControl } = useOilStore();
  const [screenState, setScreenState] = useState<ScreenState>('main');
  const [selectedFryerId, setSelectedFryerId] = useState('');
  const [ocrResult, setOcrResult] = useState<{ value: number; confidence: number } | null>(null);
  const [cameraMode, setCameraMode] = useState<'tpm' | 'waste'>('tpm');

  useEffect(() => {
    if (establishment?.id) {
      loadData(establishment.id);
    }
  }, [establishment?.id]);

  const handleTPMTest = (fryerId: string) => {
    setSelectedFryerId(fryerId);
    setCameraMode('tpm');
    setScreenState('camera');
  };

  const handleCapture = async (uri: string) => {
    if (cameraMode === 'tpm') {
      const result = await extractTemperature(uri);
      if (result) {
        setOcrResult({ value: result.value, confidence: result.confidence });
      } else {
        setOcrResult({ value: 0, confidence: 0 });
      }
      setScreenState('result');
    } else {
      await addControl({
        establishment_id: establishment?.id,
        equipment_id: selectedFryerId,
        control_type: 'waste_removal',
        waste_receipt_photo_path: uri,
      });
      setScreenState('main');
    }
  };

  const handleValidateTPM = async (value: number) => {
    await addControl({
      establishment_id: establishment?.id,
      equipment_id: selectedFryerId,
      control_type: 'tpm_test',
      tpm_value: value,
    });
    setScreenState('main');
    setOcrResult(null);
  };

  const handleQuickAction = async (fryerId: string, type: 'oil_change' | 'filtration') => {
    await addControl({
      establishment_id: establishment?.id,
      equipment_id: fryerId,
      control_type: type,
    });
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
          isCompliant={isCompliant(ocrResult.value, 'oil_tpm')}
          equipmentName="Test TPM"
          onValidate={handleValidateTPM}
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
        <Text style={styles.headerTitle}>Huiles</Text>
        <View style={styles.placeholder} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {fryers.length === 0 ? (
          <View style={styles.empty}>
            <Droplet size={48} color={Colors.textSecondary} />
            <Text variant="body" color={Colors.textSecondary}>Aucune friteuse configuree</Text>
            <Text variant="caption" color={Colors.textSecondary}>
              Ajoutez une friteuse depuis Reglages \u2192 Equipements
            </Text>
          </View>
        ) : (
          fryers.map((fryer) => {
            const lastTPM = getLastControl(fryer.id, 'tpm_test');
            const lastChange = getLastControl(fryer.id, 'oil_change');
            const lastFilter = getLastControl(fryer.id, 'filtration');

            return (
              <Card key={fryer.id} style={styles.fryerCard}>
                <View style={styles.fryerHeader}>
                  <Droplet size={20} color={Colors.accent} />
                  <Text variant="h2">{fryer.name}</Text>
                </View>

                {lastTPM && (
                  <View style={styles.infoRow}>
                    <Text variant="body">Dernier TPM</Text>
                    <View style={styles.infoValue}>
                      <Text variant="h3">{lastTPM.tpm_value}%</Text>
                      <Badge text={lastTPM.tpm_compliant ? 'Conforme' : 'Non conforme'} variant={lastTPM.tpm_compliant ? 'success' : 'danger'} />
                    </View>
                  </View>
                )}

                {lastChange && (
                  <View style={styles.infoRow}>
                    <Text variant="body">Dernier changement</Text>
                    <Text variant="caption" color={Colors.textSecondary}>
                      {format(new Date(lastChange.recorded_at), 'dd/MM/yyyy', { locale: fr })}
                    </Text>
                  </View>
                )}

                {lastFilter && (
                  <View style={styles.infoRow}>
                    <Text variant="body">Derniere filtration</Text>
                    <Text variant="caption" color={Colors.textSecondary}>
                      {format(new Date(lastFilter.recorded_at), 'dd/MM/yyyy', { locale: fr })}
                    </Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <Button title="Test qualite" onPress={() => handleTPMTest(fryer.id)} size="sm" icon={<FlaskConical size={14} color={Colors.white} />} />
                  <Button title="Huile changee" onPress={() => handleQuickAction(fryer.id, 'oil_change')} size="sm" variant="secondary" icon={<RefreshCw size={14} color={Colors.white} />} />
                  <Button title="Filtration" onPress={() => handleQuickAction(fryer.id, 'filtration')} size="sm" variant="ghost" icon={<Filter size={14} color={Colors.primary} />} />
                  <Button title="Bon enlevement" onPress={() => { setSelectedFryerId(fryer.id); setCameraMode('waste'); setScreenState('camera'); }} size="sm" variant="ghost" icon={<FileText size={14} color={Colors.primary} />} />
                </View>
              </Card>
            );
          })
        )}
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
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  fryerCard: { gap: 12 },
  fryerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  infoValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  resultContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center' },
});
