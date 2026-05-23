import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../../src/components/ui/Header';
import { LotScanner } from '../../src/components/lot/LotScanner';
import { Colors } from '../../src/constants/colors';

export default function LotScannerScreen() {
  const router = useRouter();

  const handleScanned = useCallback(
    (code: string) => {
      router.replace(`/lot/${code}`);
    },
    [router]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Scanner un lot" subtitle="Cadre le QR du lot" showBack onBack={() => router.back()} />
      <View style={styles.body}>
        <LotScanner onScanned={handleScanned} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  body: { flex: 1 },
});
