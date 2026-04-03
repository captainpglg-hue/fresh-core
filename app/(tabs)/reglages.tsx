import { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Colors } from '../../src/constants/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { useSyncStore } from '../../src/stores/syncStore';
import { syncManager } from '../../src/services/sync';
import { ArrowLeft, User, Building2, Wifi, WifiOff, FileText, Bell, Info, LogOut, ChevronRight } from 'lucide-react-native';

export default function ReglagesScreen() {
  const router = useRouter();
  const { user, establishment, signOut } = useAuthStore();
  const { isOnline, pendingCount, lastSyncAt, isSyncing } = useSyncStore();

  const [notifTemp, setNotifTemp] = useState(true);
  const [notifDlc, setNotifDlc] = useState(true);
  const [notifCleaning, setNotifCleaning] = useState(true);
  const [notifPest, setNotifPest] = useState(true);

  const handleSignOut = () => {
    Alert.alert('Deconnexion', 'Etes-vous sur de vouloir vous deconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Deconnexion', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleForceSync = async () => {
    await syncManager.startSync();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Reglages</Text>
        <View style={styles.placeholder} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="h3" style={styles.sectionTitle}>Mon profil</Text>
        <Card>
          <View style={styles.row}>
            <User size={20} color={Colors.primary} />
            <View style={styles.rowInfo}>
              <Text variant="body">{user?.full_name || 'Non connecte'}</Text>
              <Text variant="caption" color={Colors.textSecondary}>{user?.email || ''}</Text>
            </View>
          </View>
        </Card>

        <Text variant="h3" style={styles.sectionTitle}>Mon etablissement</Text>
        <Card>
          <View style={styles.row}>
            <Building2 size={20} color={Colors.primary} />
            <View style={styles.rowInfo}>
              <Text variant="body">{establishment?.name || 'Non configure'}</Text>
              <Text variant="caption" color={Colors.textSecondary}>
                {establishment?.establishment_type || ''} {establishment?.city ? `\u2014 ${establishment.city}` : ''}
              </Text>
              {establishment?.siret && (
                <Text variant="caption" color={Colors.textSecondary}>SIRET: {establishment.siret}</Text>
              )}
            </View>
          </View>
        </Card>

        <Text variant="h3" style={styles.sectionTitle}>Synchronisation</Text>
        <Card>
          <View style={styles.row}>
            {isOnline ? <Wifi size={20} color={Colors.success} /> : <WifiOff size={20} color={Colors.warning} />}
            <View style={styles.rowInfo}>
              <Text variant="body">{isOnline ? 'En ligne' : 'Hors-ligne'}</Text>
              <Text variant="caption" color={Colors.textSecondary}>
                {pendingCount > 0 ? `${pendingCount} element(s) en attente` : 'Tout est synchronise'}
              </Text>
              {lastSyncAt && (
                <Text variant="caption" color={Colors.textSecondary}>
                  Derniere sync: {new Date(lastSyncAt).toLocaleString('fr-FR')}
                </Text>
              )}
            </View>
          </View>
          <Button
            title={isSyncing ? 'Synchronisation...' : 'Forcer la synchronisation'}
            onPress={handleForceSync}
            variant="ghost"
            loading={isSyncing}
            size="sm"
          />
        </Card>

        <Text variant="h3" style={styles.sectionTitle}>Rapport DDPP</Text>
        <Pressable onPress={() => router.push('/report/ddpp')}>
          <Card>
            <View style={styles.row}>
              <FileText size={20} color={Colors.primary} />
              <View style={styles.rowInfo}>
                <Text variant="body">Generer un rapport</Text>
                <Text variant="caption" color={Colors.textSecondary}>Export PDF pour la DDPP</Text>
              </View>
              <ChevronRight size={16} color={Colors.textSecondary} />
            </View>
          </Card>
        </Pressable>

        <Text variant="h3" style={styles.sectionTitle}>Notifications</Text>
        <Card style={styles.notifCard}>
          <View style={styles.notifRow}>
            <Text variant="body">Alertes temperature</Text>
            <Switch value={notifTemp} onValueChange={setNotifTemp} trackColor={{ true: Colors.primary }} />
          </View>
          <View style={styles.notifRow}>
            <Text variant="body">Alertes DLC</Text>
            <Switch value={notifDlc} onValueChange={setNotifDlc} trackColor={{ true: Colors.primary }} />
          </View>
          <View style={styles.notifRow}>
            <Text variant="body">Rappels nettoyage</Text>
            <Switch value={notifCleaning} onValueChange={setNotifCleaning} trackColor={{ true: Colors.primary }} />
          </View>
          <View style={styles.notifRow}>
            <Text variant="body">Rappels nuisibles</Text>
            <Switch value={notifPest} onValueChange={setNotifPest} trackColor={{ true: Colors.primary }} />
          </View>
        </Card>

        <Text variant="h3" style={styles.sectionTitle}>A propos</Text>
        <Card>
          <View style={styles.row}>
            <Info size={20} color={Colors.primary} />
            <View style={styles.rowInfo}>
              <Text variant="body">Fresh-Core</Text>
              <Text variant="caption" color={Colors.textSecondary}>Version 1.0.0</Text>
              <Text variant="caption" color={Colors.textSecondary}>par pass-core.io</Text>
            </View>
          </View>
        </Card>

        <Button title="Deconnexion" onPress={handleSignOut} variant="danger" icon={<LogOut size={16} color={Colors.white} />} />
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
  scroll: { padding: 16, paddingBottom: 40, gap: 4 },
  sectionTitle: { marginTop: 20, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowInfo: { flex: 1, gap: 2 },
  notifCard: { gap: 4 },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
});
