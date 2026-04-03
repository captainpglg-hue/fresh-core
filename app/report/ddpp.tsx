import { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Colors } from '../../src/constants/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { generateDDPPReport, shareReport } from '../../src/services/pdf';
import { FileText, Share2 } from 'lucide-react-native';

export default function DDPPReportScreen() {
  const router = useRouter();
  const { establishment } = useAuthStore();
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportUri, setReportUri] = useState('');
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!establishment || !periodStart || !periodEnd) {
      setError('Veuillez renseigner les dates');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const uri = await generateDDPPReport(establishment, periodStart, periodEnd);
      setReportUri(uri);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la generation');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (reportUri) {
      await shareReport(reportUri);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <FileText size={32} color={Colors.primary} />
          <Text variant="h1">Rapport DDPP</Text>
        </View>
        <Text variant="body" color={Colors.textSecondary}>
          Generez un rapport complet pour la Direction Departementale de la Protection des Populations.
        </Text>

        <Input label="Date debut (AAAA-MM-JJ)" value={periodStart} onChangeText={setPeriodStart} placeholder="Ex: 2026-03-01" />
        <Input label="Date fin (AAAA-MM-JJ)" value={periodEnd} onChangeText={setPeriodEnd} placeholder="Ex: 2026-03-31" />

        {error ? <Text variant="caption" color={Colors.danger}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text variant="body">Generation en cours...</Text>
          </View>
        ) : reportUri ? (
          <Card style={styles.resultCard}>
            <Text variant="h3" color={Colors.success}>Rapport genere avec succes</Text>
            <Text variant="caption" color={Colors.textSecondary}>Le fichier PDF est pret</Text>
            <View style={styles.resultButtons}>
              <Button title="Partager" onPress={handleShare} icon={<Share2 size={16} color={Colors.white} />} />
              <Button title="Generer un nouveau" onPress={() => setReportUri('')} variant="ghost" />
            </View>
          </Card>
        ) : (
          <Button title="Generer le rapport" onPress={handleGenerate} size="lg" />
        )}

        <Button title="Retour" onPress={() => router.back()} variant="ghost" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loadingContainer: { alignItems: 'center', gap: 12, padding: 24 },
  resultCard: { gap: 8 },
  resultButtons: { gap: 8, marginTop: 8 },
});
