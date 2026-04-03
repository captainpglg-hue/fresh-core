export type RootStackParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
  'temperature/[equipmentId]': { equipmentId: string };
  'temperature/corrective': { equipmentId: string; temperature: number; threshold: number; thresholdType: string };
  'delivery/new': undefined;
  'delivery/[deliveryId]': { deliveryId: string };
  'report/ddpp': undefined;
  'onboarding': undefined;
};
