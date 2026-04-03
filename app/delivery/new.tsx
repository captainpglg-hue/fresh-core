import { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, Pressable, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { CameraOverlay } from '../../src/components/camera/CameraOverlay';
import { Colors } from '../../src/constants/colors';
import { useDeliveryStore } from '../../src/stores/deliveryStore';
import { useSupplierStore } from '../../src/stores/supplierStore';
import { useAuthStore } from '../../src/stores/authStore';
import { Check, X, Camera } from 'lucide-react-native';
import type { DeliveryItem } from '../../src/types/database';

const CATEGORIES = ['viande', 'volaille', 'poisson', 'legume', 'laitier', 'surgele', 'sec', 'autre'];

type Step = 'supplier' | 'note' | 'products' | 'validation';

export default function NewDeliveryScreen() {
  const router = useRouter();
  const { establishment } = useAuthStore();
  const { suppliers, addSupplier } = useSupplierStore();
  const { startDelivery, addItem, currentItems, validateDelivery, refuseDelivery } = useDeliveryStore();

  const [step, setStep] = useState<Step>('supplier');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [notePhotoUri, setNotePhotoUri] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'note' | 'product' | 'refusal'>('note');

  // Product form
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productTemp, setProductTemp] = useState('');
  const [productDlc, setProductDlc] = useState('');
  const [productLot, setProductLot] = useState('');
  const [packagingOk, setPackagingOk] = useState(true);

  // Refusal
  const [refusalReason, setRefusalReason] = useState('');

  if (showCamera) {
    return (
      <CameraOverlay
        onCapture={(uri) => {
          if (cameraTarget === 'note') setNotePhotoUri(uri);
          setShowCamera(false);
        }}
        onClose={() => setShowCamera(false)}
      />
    );
  }

  const handleSelectSupplier = (id: string) => {
    setSelectedSupplierId(id);
    if (establishment?.id) {
      startDelivery(id, establishment.id);
    }
    setStep('note');
  };

  const handleAddNewSupplier = async () => {
    if (!newSupplierName || !establishment?.id) return;
    const id = await addSupplier({ name: newSupplierName, establishment_id: establishment.id });
    handleSelectSupplier(id);
  };

  const handleAddProduct = () => {
    const item: Partial<DeliveryItem> = {
      product_name: productName,
      category: productCategory,
      temperature: productTemp ? parseFloat(productTemp) : undefined,
      temperature_compliant: productTemp ? parseFloat(productTemp) <= 4 : undefined,
      dlc: productDlc || undefined,
      lot_number: productLot || undefined,
      packaging_ok: packagingOk,
      visual_ok: true,
    };
    addItem(item);
    // Reset form
    setProductName('');
    setProductCategory('');
    setProductTemp('');
    setProductDlc('');
    setProductLot('');
    setPackagingOk(true);
  };

  const handleValidate = async () => {
    await validateDelivery();
    router.back();
  };

  const handleRefuse = async () => {
    await refuseDelivery(refusalReason);
    router.back();
  };

  // Step 1: Supplier
  if (step === 'supplier') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text variant="h2">Etape 1 — Fournisseur</Text>

          {suppliers.length > 0 && (
            <>
              <Text variant="h3" style={styles.sectionTitle}>Fournisseurs existants</Text>
              {suppliers.map((s) => (
                <Pressable key={s.id} style={styles.supplierItem} onPress={() => handleSelectSupplier(s.id)}>
                  <Text variant="body">{s.name}</Text>
                  {s.sanitary_approval && (
                    <Text variant="caption" color={Colors.textSecondary}>Agrement: {s.sanitary_approval}</Text>
                  )}
                </Pressable>
              ))}
            </>
          )}

          <Text variant="h3" style={styles.sectionTitle}>Nouveau fournisseur</Text>
          <Input label="Nom" value={newSupplierName} onChangeText={setNewSupplierName} placeholder="Nom du fournisseur" />
          <Button title="Ajouter et continuer" onPress={handleAddNewSupplier} variant="secondary" />
          <Button title="Annuler" onPress={() => router.back()} variant="ghost" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 2: Delivery note photo
  if (step === 'note') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text variant="h2">Etape 2 — Bon de livraison</Text>

          {notePhotoUri ? (
            <Badge text="Photo prise" variant="success" />
          ) : (
            <Button
              title="Photographier le BL"
              onPress={() => { setCameraTarget('note'); setShowCamera(true); }}
              icon={<Camera size={18} color={Colors.white} />}
            />
          )}

          <View style={styles.navButtons}>
            <Button title="Continuer" onPress={() => setStep('products')} />
            <Button title="Continuer sans photo" onPress={() => setStep('products')} variant="ghost" />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 3: Products
  if (step === 'products') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text variant="h2">Etape 3 — Controle produits</Text>

          {currentItems.length > 0 && (
            <View style={styles.itemsList}>
              {currentItems.map((item, i) => (
                <Card key={i} style={styles.itemCard}>
                  <Text variant="h3">{item.product_name}</Text>
                  <Text variant="caption" color={Colors.textSecondary}>{item.category}</Text>
                  {item.temperature != null && (
                    <Badge
                      text={`${item.temperature}°C`}
                      variant={item.temperature_compliant ? 'success' : 'danger'}
                    />
                  )}
                </Card>
              ))}
            </View>
          )}

          <Card>
            <Text variant="h3" style={styles.cardTitle}>Nouveau produit</Text>
            <Input label="Nom du produit" value={productName} onChangeText={setProductName} placeholder="Ex: Filet de poulet" />

            <Text variant="body" style={styles.catLabel}>Categorie</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.catChip, productCategory === cat && styles.catChipSelected]}
                  onPress={() => setProductCategory(cat)}
                >
                  <Text variant="caption" color={productCategory === cat ? Colors.white : Colors.textPrimary}>{cat}</Text>
                </Pressable>
              ))}
            </View>

            <Input label="Temperature (°C)" value={productTemp} onChangeText={setProductTemp} placeholder="Ex: 3.5" keyboardType="decimal-pad" />
            <Input label="DLC (AAAA-MM-JJ)" value={productDlc} onChangeText={setProductDlc} placeholder="Ex: 2026-04-10" />
            <Input label="N° de lot" value={productLot} onChangeText={setProductLot} placeholder="Optionnel" />

            <View style={styles.packagingRow}>
              <Text variant="body">Emballage</Text>
              <View style={styles.packagingButtons}>
                <Pressable style={[styles.packBtn, packagingOk && styles.packBtnOk]} onPress={() => setPackagingOk(true)}>
                  <Check size={16} color={packagingOk ? Colors.white : Colors.success} />
                  <Text variant="caption" color={packagingOk ? Colors.white : Colors.success}>OK</Text>
                </Pressable>
                <Pressable style={[styles.packBtn, !packagingOk && styles.packBtnBad]} onPress={() => setPackagingOk(false)}>
                  <X size={16} color={!packagingOk ? Colors.white : Colors.danger} />
                  <Text variant="caption" color={!packagingOk ? Colors.white : Colors.danger}>Defaut</Text>
                </Pressable>
              </View>
            </View>

            <Button title="Ajouter ce produit" onPress={handleAddProduct} disabled={!productName} variant="secondary" />
          </Card>

          <Button title="Terminer et valider" onPress={() => setStep('validation')} disabled={currentItems.length === 0} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 4: Validation
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="h2">Etape 4 — Validation</Text>

        {currentItems.map((item, i) => (
          <Card key={i} style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text variant="body">{item.product_name}</Text>
              <View style={styles.summaryIcons}>
                {item.temperature_compliant !== undefined && (
                  <Badge text={`${item.temperature}°C`} variant={item.temperature_compliant ? 'success' : 'danger'} />
                )}
                {item.packaging_ok !== undefined && (
                  <Badge text={item.packaging_ok ? 'Emb. OK' : 'Emb. KO'} variant={item.packaging_ok ? 'success' : 'danger'} />
                )}
              </View>
            </View>
          </Card>
        ))}

        <Button title="Accepter la livraison" onPress={handleValidate} />

        <Input label="Motif de refus" value={refusalReason} onChangeText={setRefusalReason} placeholder="Raison du refus..." />
        <Button title="Refuser la livraison" onPress={handleRefuse} variant="danger" disabled={!refusalReason} />

        <Button title="Retour aux produits" onPress={() => setStep('products')} variant="ghost" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, gap: 16 },
  sectionTitle: { marginTop: 16 },
  supplierItem: { padding: 16, backgroundColor: Colors.white, borderRadius: 8, borderWidth: 1, borderColor: '#DEE2E6' },
  navButtons: { gap: 8, marginTop: 16 },
  itemsList: { gap: 8 },
  itemCard: { marginBottom: 4 },
  cardTitle: { marginBottom: 12 },
  catLabel: { fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.background, borderWidth: 1, borderColor: '#DEE2E6' },
  catChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  packagingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 },
  packagingButtons: { flexDirection: 'row', gap: 8 },
  packBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#DEE2E6' },
  packBtnOk: { backgroundColor: Colors.success, borderColor: Colors.success },
  packBtnBad: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  summaryCard: { marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryIcons: { flexDirection: 'row', gap: 4 },
});
