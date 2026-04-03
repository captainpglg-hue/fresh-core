import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Header } from '../../src/components/ui/Header';
import { CameraOverlay } from '../../src/components/camera/CameraOverlay';
import { Colors } from '../../src/constants/colors';
import { usePestStore } from '../../src/stores/pestStore';
import { useAuthStore } from '../../src/stores/authStore';
import { Bug, CheckCircle, Circle, AlertTriangle, Plus, Calendar, Trash2 } from 'lucide-react-native';
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PEST_TYPES = ['Rongeur', 'Insecte rampant', 'Insecte volant', 'Oiseau', 'Autre'];

export default function PestsScreen() {
  const { establishment } = useAuthStore();
  const { checkpoints, controls, serviceProvider, loadData, validateCheckpoint, reportAnomaly, addIntervention, addCheckpoint, removeCheckpoint, getNextVisitDate, setServiceProvider } = usePestStore();
  const [showAnomalyModal, setShowAnomalyModal] = useState(false);
  const [showInterventionModal, setShowInterventionModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Anomaly form
  const [pestType, setPestType] = useState('');
  const [anomalyLocation, setAnomalyLocation] = useState('');
  const [anomalyPhotoUri, setAnomalyPhotoUri] = useState('');

  // Intervention form
  const [interventionProvider, setInterventionProvider] = useState('');
  const [interventionDate, setInterventionDate] = useState('');
  const [nextVisit, setNextVisit] = useState('');

  // Config
  const [newCheckpointName, setNewCheckpointName] = useState('');

  useEffect(() => {
    if (establishment?.id) {
      loadData(establishment.id);
    }
  }, [establishment?.id]);

  const nextVisitDate = getNextVisitDate();
  const daysUntilVisit = nextVisitDate ? differenceInDays(new Date(nextVisitDate), new Date()) : null;
  const allChecked = checkpoints.every((c) => c.checked);

  const handleReportAnomaly = async () => {
    if (!establishment?.id) return;
    await reportAnomaly({
      establishment_id: establishment.id,
      pest_type: pestType,
      location_description: anomalyLocation,
      photo_path: anomalyPhotoUri || null,
    });
    setShowAnomalyModal(false);
    setPestType(''); setAnomalyLocation(''); setAnomalyPhotoUri('');
  };

  const handleAddIntervention = async () => {
    if (!establishment?.id) return;
    await addIntervention({
      establishment_id: establishment.id,
      service_provider: interventionProvider,
      intervention_date: interventionDate,
      next_visit_date: nextVisit || null,
    });
    setShowInterventionModal(false);
    setInterventionProvider(''); setInterventionDate(''); setNextVisit('');
  };

  if (showCamera) {
    return (
      <CameraOverlay
        onCapture={(uri) => { setAnomalyPhotoUri(uri); setShowCamera(false); }}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Nuisibles" showSync />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Next visit reminder */}
        {daysUntilVisit != null && daysUntilVisit <= 7 && (
          <Card style={styles.reminderCard}>
            <View style={styles.reminderRow}>
              <Calendar size={20} color={Colors.warning} />
              <Text variant="body" color={Colors.warning}>
                Prochaine visite dans {daysUntilVisit} jour(s) — {nextVisitDate}
              </Text>
            </View>
          </Card>
        )}

        {/* Daily check */}
        <Text variant="h2">Controle quotidien</Text>
        <Text variant="caption" color={Colors.textSecondary}>
          {checkpoints.filter((c) => c.checked).length}/{checkpoints.length} points verifies
        </Text>

        {checkpoints.map((cp) => (
          <Pressable
            key={cp.id}
            onPress={() => !cp.checked && establishment?.id && validateCheckpoint(cp.id, establishment.id)}
          >
            <Card style={[styles.checkCard, cp.checked ? styles.checkDone : undefined]}>
              <View style={styles.checkRow}>
                {cp.checked ? <CheckCircle size={20} color={Colors.success} /> : <Circle size={20} color={Colors.textSecondary} />}
                <Text variant="body" color={cp.checked ? Colors.textSecondary : Colors.textPrimary}>{cp.name}</Text>
              </View>
            </Card>
          </Pressable>
        ))}

        {allChecked && (
          <Badge text="Controle du jour termine" variant="success" />
        )}

        <Button title="Signaler une anomalie" onPress={() => setShowAnomalyModal(true)} variant="danger" icon={<AlertTriangle size={16} color={Colors.white} />} />

        {/* Interventions */}
        <Text variant="h2" style={styles.sectionTitle}>Interventions</Text>
        {controls
          .filter((c) => c.control_type === 'intervention_report')
          .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
          .slice(0, 5)
          .map((ctrl) => (
            <Card key={ctrl.id}>
              <Text variant="body">{ctrl.service_provider}</Text>
              <Text variant="caption" color={Colors.textSecondary}>
                {ctrl.intervention_date ? format(new Date(ctrl.intervention_date), 'dd/MM/yyyy', { locale: fr }) : ''}
              </Text>
              {ctrl.next_visit_date && (
                <Text variant="caption" color={Colors.primary}>Prochaine visite: {ctrl.next_visit_date}</Text>
              )}
            </Card>
          ))}

        <Button title="Nouvelle intervention" onPress={() => setShowInterventionModal(true)} variant="secondary" />

        {/* Configuration */}
        <Text variant="h2" style={styles.sectionTitle}>Configuration</Text>
        <Button title="Gerer les points de controle" onPress={() => setShowConfigModal(true)} variant="ghost" />
      </ScrollView>

      {/* Anomaly Modal */}
      <Modal visible={showAnomalyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="h2" color={Colors.danger}>Signaler une anomalie</Text>
            <Text variant="body">Type de nuisible</Text>
            <View style={styles.typeGrid}>
              {PEST_TYPES.map((type) => (
                <Pressable key={type} style={[styles.typeChip, pestType === type && styles.typeChipSelected]} onPress={() => setPestType(type)}>
                  <Text variant="caption" color={pestType === type ? Colors.white : Colors.textPrimary}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <Input label="Localisation" value={anomalyLocation} onChangeText={setAnomalyLocation} placeholder="Ou avez-vous observe le nuisible ?" />
            <Button title={anomalyPhotoUri ? 'Photo prise' : 'Prendre une photo'} onPress={() => setShowCamera(true)} variant="ghost" />
            <View style={styles.modalButtons}>
              <Button title="Signaler" onPress={handleReportAnomaly} variant="danger" disabled={!pestType} />
              <Button title="Annuler" onPress={() => setShowAnomalyModal(false)} variant="ghost" />
            </View>
          </View>
        </View>
      </Modal>

      {/* Intervention Modal */}
      <Modal visible={showInterventionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="h2">Nouvelle intervention</Text>
            <Input label="Prestataire" value={interventionProvider} onChangeText={setInterventionProvider} placeholder="Nom du prestataire" />
            <Input label="Date (AAAA-MM-JJ)" value={interventionDate} onChangeText={setInterventionDate} placeholder="Ex: 2026-04-03" />
            <Input label="Prochaine visite (AAAA-MM-JJ)" value={nextVisit} onChangeText={setNextVisit} placeholder="Optionnel" />
            <View style={styles.modalButtons}>
              <Button title="Enregistrer" onPress={handleAddIntervention} />
              <Button title="Annuler" onPress={() => setShowInterventionModal(false)} variant="ghost" />
            </View>
          </View>
        </View>
      </Modal>

      {/* Config Modal */}
      <Modal visible={showConfigModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="h2">Points de controle</Text>
            {checkpoints.map((cp) => (
              <View key={cp.id} style={styles.configRow}>
                <Text variant="body">{cp.name}</Text>
                <Pressable onPress={() => removeCheckpoint(cp.id)}>
                  <Trash2 size={18} color={Colors.danger} />
                </Pressable>
              </View>
            ))}
            <Input label="Nouveau point" value={newCheckpointName} onChangeText={setNewCheckpointName} placeholder="Nom du point de controle" />
            <View style={styles.modalButtons}>
              <Button title="Ajouter" onPress={() => { if (newCheckpointName) { addCheckpoint(newCheckpointName); setNewCheckpointName(''); } }} variant="secondary" />
              <Button title="Fermer" onPress={() => setShowConfigModal(false)} variant="ghost" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  reminderCard: { borderLeftWidth: 4, borderLeftColor: Colors.warning },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkCard: { marginBottom: 4 },
  checkDone: { opacity: 0.7 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { marginTop: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, maxHeight: '80%' },
  modalButtons: { gap: 8, marginTop: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.background, borderWidth: 1, borderColor: '#DEE2E6' },
  typeChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  configRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#DEE2E6' },
});
