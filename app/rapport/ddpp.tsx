import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm } from 'react-hook-form';
import { FileText, Share2 } from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Header } from '../../src/components/ui/Header';
import { FormDatePicker } from '../../src/components/forms/FormDatePicker';
import { Colors } from '../../src/constants/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { generateDDPPReport, shareReport } from '../../src/services/pdf';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReportFormValues {
  periodStart: Date | undefined;
  periodEnd: Date | undefined;
}

export default function DDPPReportScreen() {
  const router = useRouter();
  const { establishment } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [reportUri, setReportUri] = useState<string | null>(null);
  const [reportFileName, setReportFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, watch } = useForm<ReportFormValues>({
    defaultValues: {
      periodStart: undefined,
      periodEnd: undefined,
    },
  });

  const periodStart = watch('periodStart');
  const periodEnd = watch('periodEnd');

  const handleGenerate = async (data: ReportFormValues) => {
    if (!establishment) {
      setError('Aucun etablissement selectionne');
      return;
    }
    if (!data.periodStart || !data.periodEnd) {
      setError('Veuillez renseigner les deux dates');
      return;
    }

    setLoading(true);
    setError(null);
    setReportUri(null);

    try {
      const startStr = data.periodStart.toISOString().split('T')[0];
      const endStr = data.periodEnd.toISOString().split('T')[0];
      const uri = await generateDDPPReport(establishment, startStr, endStr);
      setReportUri(uri);

      const formattedStart = format(data.periodStart, 'dd-MM-yyyy', { locale: fr });
      const formattedEnd = format(data.periodEnd, 'dd-MM-yyyy', { locale: fr });
      setReportFileName(`Rapport_DDPP_${formattedStart}_${formattedEnd}.pdf`);
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
      <Header title="Rapport DDPP" showBack onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconRow}>
          <FileText size={36} color={Colors.primary} />
          <View style={styles.iconRowText}>
            <Text variant="h2">Rapport DDPP</Text>
            <Text variant="caption" color={Colors.textSecondary}>
              Direction Departementale de la Protection des Populations
            </Text>
          </View>
        </View>

        <Text variant="body" color={Colors.textSecondary} style={styles.description}>
          Generez un rapport complet de vos enregistrements HACCP sur une periode donnee, pret a etre
          presente lors d'un controle sanitaire.
        </Text>

        <Card style={styles.formCard}>
          <FormDatePicker
            control={control}
            name="periodStart"
            label="Debut de periode"
            rules={{ required: 'Date de debut requise' }}
            maximumDate={new Date()}
          />

          <FormDatePicker
            control={control}
            name="periodEnd"
            label="Fin de periode"
            rules={{ required: 'Date de fin requise' }}
            minimumDate={periodStart ? new Date(periodStart) : undefined}
            maximumDate={new Date()}
          />
        </Card>

        {error && (
          <Text variant="caption" color={Colors.danger} style={styles.errorText}>
            {error}
          </Text>
        )}

        {!reportUri && (
          <Button
            title="Generer le rapport"
            onPress={handleSubmit(handleGenerate)}
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={loading || !periodStart || !periodEnd}
          />
        )}

        {reportUri && reportFileName && (
          <Card variant="success" style={styles.resultCard}>
            <Text variant="h3" color={Colors.success}>
              Rapport genere avec succes
            </Text>
            <Text variant="body" color={Colors.textSecondary} style={styles.fileName}>
              {reportFileName}
            </Text>

            <View style={styles.resultButtons}>
              <Button
                title="Partager"
                onPress={handleShare}
                variant="primary"
                size="lg"
                fullWidth
                icon={<Share2 size={18} color={Colors.white} />}
              />
              <View style={styles.btnSpacing} />
              <Button
                title="Generer un nouveau rapport"
                onPress={() => {
                  setReportUri(null);
                  setReportFileName(null);
                }}
                variant="ghost"
                size="md"
              />
            </View>
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconRowText: {
    flex: 1,
    gap: 2,
  },
  description: {
    marginBottom: 20,
    lineHeight: 22,
  },
  formCard: {
    marginBottom: 20,
  },
  errorText: {
    marginBottom: 12,
    fontWeight: '600',
  },
  resultCard: {
    gap: 8,
  },
  fileName: {
    fontStyle: 'italic',
  },
  resultButtons: {
    marginTop: 12,
  },
  btnSpacing: {
    height: 8,
  },
  bottomSpacer: {
    height: 24,
  },
});
