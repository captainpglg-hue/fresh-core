export type RootStackParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
  'temperature/[equipmentId]': { equipmentId: string };
  'temperature/releve': { equipmentId: string };
  'temperature/correctif': { equipmentId: string; temperature: number; threshold: number; thresholdType: string };
  'reception/nouvelle': undefined;
  'reception/[id]': { id: string };
  'produit/ajouter': undefined;
  'rapport/ddpp': undefined;
  'camera/capture': { mode: 'temperature' | 'document' };
  'onboarding': undefined;
};
