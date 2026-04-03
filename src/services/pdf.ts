import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getAllLocal } from './database';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Establishment, TemperatureReading, Delivery, CleaningRecord, ProductInStock, OilControl, PestControl } from '../types/database';

export async function generateDDPPReport(
  establishment: Establishment,
  periodStart: string,
  periodEnd: string
): Promise<string> {
  // Load all data for the period
  const temperatures = await getAllLocal<TemperatureReading>(
    'temperature_readings',
    'establishment_id = ? AND date(recorded_at) BETWEEN ? AND ?',
    [establishment.id, periodStart, periodEnd]
  );

  const deliveries = await getAllLocal<Delivery>(
    'deliveries',
    'establishment_id = ? AND delivery_date BETWEEN ? AND ?',
    [establishment.id, periodStart, periodEnd]
  );

  const cleaningRecords = await getAllLocal<CleaningRecord>(
    'cleaning_records',
    'establishment_id = ? AND date(validated_at) BETWEEN ? AND ?',
    [establishment.id, periodStart, periodEnd]
  );

  const products = await getAllLocal<ProductInStock>(
    'products_in_stock',
    "establishment_id = ? AND status = 'destroyed' AND date(destroyed_at) BETWEEN ? AND ?",
    [establishment.id, periodStart, periodEnd]
  );

  const oilControls = await getAllLocal<OilControl>(
    'oil_controls',
    'establishment_id = ? AND date(recorded_at) BETWEEN ? AND ?',
    [establishment.id, periodStart, periodEnd]
  );

  const pestControls = await getAllLocal<PestControl>(
    'pest_controls',
    'establishment_id = ? AND date(recorded_at) BETWEEN ? AND ?',
    [establishment.id, periodStart, periodEnd]
  );

  const compliantTemp = temperatures.filter((t) => t.is_compliant).length;
  const totalTemp = temperatures.length;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1B4332; }
        h1 { color: #1B4332; border-bottom: 3px solid #1B4332; padding-bottom: 8px; }
        h2 { color: #2D6A4F; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { border: 1px solid #DEE2E6; padding: 8px 12px; text-align: left; }
        th { background: #1B4332; color: white; }
        tr:nth-child(even) { background: #F5F7F0; }
        .compliant { color: #2D6A4F; font-weight: bold; }
        .non-compliant { color: #E63946; font-weight: bold; }
        .header { display: flex; justify-content: space-between; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #DEE2E6; font-size: 12px; color: #6C757D; }
        .stat { font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 12px; color: #6C757D; }
      </style>
    </head>
    <body>
      <h1>Rapport HACCP — DDPP</h1>
      <p><strong>${establishment.name}</strong></p>
      <p>${establishment.address || ''} ${establishment.city || ''} ${establishment.postal_code || ''}</p>
      ${establishment.siret ? `<p>SIRET: ${establishment.siret}</p>` : ''}
      <p>Periode: du ${format(new Date(periodStart), 'dd/MM/yyyy', { locale: fr })} au ${format(new Date(periodEnd), 'dd/MM/yyyy', { locale: fr })}</p>

      <h2>1. Temperatures</h2>
      <p>${totalTemp} releves — ${compliantTemp} conformes (${totalTemp > 0 ? Math.round((compliantTemp / totalTemp) * 100) : 0}%)</p>
      <table>
        <tr><th>Date</th><th>Equipement</th><th>Valeur</th><th>Conformite</th></tr>
        ${temperatures.slice(0, 50).map((t) => `
          <tr>
            <td>${format(new Date(t.recorded_at), 'dd/MM/yyyy HH:mm')}</td>
            <td>${t.equipment_id}</td>
            <td>${t.temperature_value}°C</td>
            <td class="${t.is_compliant ? 'compliant' : 'non-compliant'}">${t.is_compliant ? 'Conforme' : 'Non conforme'}</td>
          </tr>
        `).join('')}
      </table>

      <h2>2. Receptions</h2>
      <p>${deliveries.length} reception(s) sur la periode</p>
      <table>
        <tr><th>Date</th><th>Statut</th></tr>
        ${deliveries.map((d) => `
          <tr>
            <td>${d.delivery_date}</td>
            <td>${d.status}</td>
          </tr>
        `).join('')}
      </table>

      <h2>3. Nettoyage</h2>
      <p>${cleaningRecords.length} operations de nettoyage enregistrees</p>

      <h2>4. Cuisson</h2>
      <p>${temperatures.filter((t) => t.reading_type === 'cooking_core').length} controles de cuisson</p>

      <h2>5. Tracabilite DLC</h2>
      <p>${products.length} produit(s) detruit(s) sur la periode</p>

      <h2>6. Huiles</h2>
      <p>${oilControls.length} controle(s) d'huile</p>
      ${oilControls.filter((o) => o.control_type === 'tpm_test').length > 0 ? `
        <table>
          <tr><th>Date</th><th>TPM (%)</th><th>Conformite</th></tr>
          ${oilControls.filter((o) => o.control_type === 'tpm_test').map((o) => `
            <tr>
              <td>${format(new Date(o.recorded_at), 'dd/MM/yyyy')}</td>
              <td>${o.tpm_value}%</td>
              <td class="${o.tpm_compliant ? 'compliant' : 'non-compliant'}">${o.tpm_compliant ? 'Conforme' : 'Non conforme'}</td>
            </tr>
          `).join('')}
        </table>
      ` : ''}

      <h2>7. Nuisibles</h2>
      <p>${pestControls.length} controle(s) — ${pestControls.filter((p) => p.is_anomaly).length} anomalie(s)</p>

      <div class="footer">
        <p>Document genere par Fresh-Core — ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
        <p>Ce rapport est genere automatiquement a partir des enregistrements HACCP numeriques.</p>
      </div>
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

export async function shareReport(uri: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }
}
