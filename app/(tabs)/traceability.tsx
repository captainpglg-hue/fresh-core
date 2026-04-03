import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Modal, Alert } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Header } from '../../src/components/ui/Header';
import { Colors } from '../../src/constants/colors';
import { useTraceabilityStore } from '../../src/stores/traceabilityStore';
import { useAuthStore } from '../../src/stores/authStore';
import { Tag, Plus, AlertTriangle, Trash2, PackageOpen } from 'lucide-react-native';
import { differenceInDays, format } from 'date-fns';

export default function TraceabilityScreen() {
  const { establishment } = useAuthStore();
  const { productsInStock, loadProducts, addProduct, openProduct, destroyProduct, getAlerts } = useTraceabilityStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDestroyModal, setShowDestroyModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [destroyReason, setDestroyReason] = useState('');

  // Add form
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [dlc, setDlc] = useState('');
  const [lot, setLot] = useState('');

  useEffect(() => {
    if (establishment?.id) {
      loadProducts(establishment.id);
    }
  }, [establishment?.id]);

  const { expiringSoon, expired } = getAlerts();

  const getDlcBadge = (product: typeof productsInStock[0]) => {
    const dlcDate = product.dlc_secondary || product.dlc_primary;
    if (!dlcDate) return null;
    const days = differenceInDays(new Date(dlcDate), new Date());
    if (days < 0) return <Badge text="EXPIRE" variant="danger" />;
    if (days <= 1) return <Badge text={`J-${days}`} variant="danger" />;
    if (days <= 3) return <Badge text={`J-${days}`} variant="warning" />;
    return <Badge text={`J-${days}`} variant="success" />;
  };

  const handleAdd = async () => {
    if (!name || !establishment?.id) return;
    await addProduct({
      establishment_id: establishment.id,
      product_name: name,
      category: category || null,
      dlc_primary: dlc || null,
      lot_number: lot || null,
    });
    setShowAddModal(false);
    setName(''); setCategory(''); setDlc(''); setLot('');
  };

  const handleDestroy = async () => {
    if (!selectedProductId) return;
    await destroyProduct(selectedProductId, destroyReason);
    setShowDestroyModal(false);
    setDestroyReason('');
  };

  // Sort by DLC ascending
  const sortedProducts = [...productsInStock].sort((a, b) => {
    const dlcA = a.dlc_secondary || a.dlc_primary || '9999';
    const dlcB = b.dlc_secondary || b.dlc_primary || '9999';
    return dlcA.localeCompare(dlcB);
  });

  return (
    <View style={styles.container}>
      <Header title="Tracabilite DLC" showSync />
      <ScrollView contentContainerStyle={styles.scroll}>
        {expired.length > 0 && (
          <Card style={styles.alertCard}>
            <View style={styles.alertRow}>
              <AlertTriangle size={20} color={Colors.danger} />
              <Text variant="h3" color={Colors.danger}>{expired.length} produit(s) expire(s)</Text>
            </View>
          </Card>
        )}

        {expiringSoon.length > 0 && (
          <Card style={styles.warningCard}>
            <View style={styles.alertRow}>
              <AlertTriangle size={20} color={Colors.warning} />
              <Text variant="h3" color={Colors.warning}>{expiringSoon.length} produit(s) proche(s) expiration</Text>
            </View>
          </Card>
        )}

        <Text variant="h2">{productsInStock.length} produit(s) en stock</Text>

        {sortedProducts.map((product) => (
          <Card key={product.id} style={styles.productCard}>
            <View style={styles.productRow}>
              <View style={styles.productInfo}>
                <Text variant="h3">{product.product_name}</Text>
                <Text variant="caption" color={Colors.textSecondary}>
                  {product.category || 'Non categorise'} {product.lot_number ? `— Lot: ${product.lot_number}` : ''}
                </Text>
                <Text variant="caption" color={Colors.textSecondary}>
                  DLC: {product.dlc_secondary || product.dlc_primary || 'Non renseignee'}
                  {product.status === 'opened' ? ' (entame)' : ''}
                </Text>
              </View>
              <View style={styles.productActions}>
                {getDlcBadge(product)}
                <View style={styles.actionButtons}>
                  {product.status === 'in_stock' && (
                    <Pressable style={styles.actionBtn} onPress={() => openProduct(product.id)}>
                      <PackageOpen size={16} color={Colors.primary} />
                    </Pressable>
                  )}
                  <Pressable style={styles.actionBtn} onPress={() => { setSelectedProductId(product.id); setShowDestroyModal(true); }}>
                    <Trash2 size={16} color={Colors.danger} />
                  </Pressable>
                </View>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Plus size={28} color={Colors.white} />
      </Pressable>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="h2">Ajouter un produit</Text>
            <Input label="Nom du produit" value={name} onChangeText={setName} placeholder="Ex: Filet de poulet" />
            <Input label="Categorie" value={category} onChangeText={setCategory} placeholder="Ex: viande, laitier..." />
            <Input label="DLC (AAAA-MM-JJ)" value={dlc} onChangeText={setDlc} placeholder="Ex: 2026-04-10" />
            <Input label="N° de lot" value={lot} onChangeText={setLot} placeholder="Optionnel" />
            <View style={styles.modalButtons}>
              <Button title="Ajouter" onPress={handleAdd} />
              <Button title="Annuler" onPress={() => setShowAddModal(false)} variant="ghost" />
            </View>
          </View>
        </View>
      </Modal>

      {/* Destroy Modal */}
      <Modal visible={showDestroyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text variant="h2" color={Colors.danger}>Detruire le produit</Text>
            <Input label="Motif de destruction" value={destroyReason} onChangeText={setDestroyReason} placeholder="Ex: DLC depassee" />
            <View style={styles.modalButtons}>
              <Button title="Confirmer la destruction" onPress={handleDestroy} variant="danger" />
              <Button title="Annuler" onPress={() => setShowDestroyModal(false)} variant="ghost" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 12, paddingBottom: 100 },
  alertCard: { borderLeftWidth: 4, borderLeftColor: Colors.danger },
  warningCard: { borderLeftWidth: 4, borderLeftColor: Colors.warning },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productCard: { marginBottom: 4 },
  productRow: { flexDirection: 'row', justifyContent: 'space-between' },
  productInfo: { flex: 1, gap: 2 },
  productActions: { alignItems: 'flex-end', gap: 8 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  modalButtons: { gap: 8 },
});
