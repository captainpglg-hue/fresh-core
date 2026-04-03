import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Header } from '../../src/components/ui/Header';
import { Colors } from '../../src/constants/colors';
import { useCleaningStore } from '../../src/stores/cleaningStore';
import { useAuthStore } from '../../src/stores/authStore';
import { CheckCircle, Circle, Clock } from 'lucide-react-native';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Quotidien',
  per_service: 'Chaque service',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
};

export default function NettoyageScreen() {
  const { establishment } = useAuthStore();
  const { tasks, todayRecords, initDefaultTasks, validateTask, getOverdueTasks } = useCleaningStore();
  const [showModal, setShowModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [product, setProduct] = useState('');
  const [dosage, setDosage] = useState('');

  useEffect(() => {
    if (establishment?.id) {
      initDefaultTasks(establishment.id);
    }
  }, [establishment?.id]);

  const completedTaskIds = new Set(todayRecords.map((r) => r.task_id));
  const completedCount = completedTaskIds.size;
  const overdueTasks = getOverdueTasks();

  const handleValidate = async () => {
    if (!selectedTaskId || !establishment?.id) return;
    await validateTask(selectedTaskId, establishment.id, {
      cleaning_product: product || undefined,
      dosage: dosage || undefined,
    });
    setShowModal(false);
    setProduct('');
    setDosage('');
  };

  const openValidation = (taskId: string) => {
    setSelectedTaskId(taskId);
    setShowModal(true);
  };

  return (
    <View style={styles.container}>
      <Header title="Nettoyage" showSync />

      <View style={styles.progress}>
        <Text variant="h3">{completedCount}/{tasks.length} taches completees</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {overdueTasks.length > 0 && (
          <View style={styles.section}>
            <Text variant="h3" color={Colors.danger}>En retard</Text>
            {overdueTasks.map((task) => (
              <Pressable key={task.id} onPress={() => openValidation(task.id)}>
                <Card style={styles.taskCard}>
                  <View style={styles.taskRow}>
                    <Clock size={20} color={Colors.danger} />
                    <View style={styles.taskInfo}>
                      <Text variant="body">{task.zone_name}</Text>
                      <Text variant="caption" color={Colors.danger}>{FREQUENCY_LABELS[task.frequency]}</Text>
                    </View>
                    <Badge text="En retard" variant="danger" />
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text variant="h3">Toutes les taches</Text>
          {tasks.map((task) => {
            const isDone = completedTaskIds.has(task.id);
            return (
              <Pressable key={task.id} onPress={() => !isDone && openValidation(task.id)} disabled={isDone}>
                <Card style={[styles.taskCard, isDone ? styles.taskDone : undefined]}>
                  <View style={styles.taskRow}>
                    {isDone ? (
                      <CheckCircle size={20} color={Colors.success} />
                    ) : (
                      <Circle size={20} color={Colors.textSecondary} />
                    )}
                    <View style={styles.taskInfo}>
                      <Text variant="body" color={isDone ? Colors.textSecondary : Colors.textPrimary}>{task.zone_name}</Text>
                      <Text variant="caption" color={Colors.textSecondary}>{FREQUENCY_LABELS[task.frequency]}</Text>
                    </View>
                    {isDone && <Badge text="Fait" variant="success" />}
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="h2">Valider le nettoyage</Text>
            <Input label="Produit d'entretien" value={product} onChangeText={setProduct} placeholder="Ex: Javel 2.6%" />
            <Input label="Dosage utilise" value={dosage} onChangeText={setDosage} placeholder="Ex: 50ml/5L eau" />
            <View style={styles.modalButtons}>
              <Button title="Valider" onPress={handleValidate} />
              <Button title="Annuler" onPress={() => setShowModal(false)} variant="ghost" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  progress: { padding: 16, gap: 8 },
  progressBar: { height: 8, backgroundColor: '#DEE2E6', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 4 },
  scroll: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24, gap: 8 },
  taskCard: { marginBottom: 8 },
  taskDone: { opacity: 0.7 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskInfo: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  modalButtons: { gap: 8 },
});
