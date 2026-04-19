// ============================================================================
// lib/fiche-police.ts — Génération fiche de police individuelle + email Resend
// ----------------------------------------------------------------------------
// Déclenché automatiquement à POST /api/artworks quand l'utilisateur a le rôle
// antiquaire/galeriste/brocanteur/depot_vente ET un profil merchants valide.
//
// Sortie :
//   1. Insert dans police_register_entries (numéro d'ordre séquentiel / user)
//   2. PDF A4 portrait généré avec pdfkit (photo principale intégrée)
//   3. Email envoyé via Resend API
//      To : email du marchand, Cc : captainpglg@gmail.com (copie admin légale)
// ============================================================================

import PDFDocument from "pdfkit";
import { getDb } from "@/lib/db";

const CC_ADMIN = "captainpglg@gmail.com";
const NAVY = "#0D1B2A";
const GOLD = "#B8960C";
const DARK = "#1a1a1a";
const MUTED = "#666666";

// ── Types ────────────────────────────────────────────────────────────────

export interface MerchantLite {
  id: string;
  raison_sociale: string;
  siret: string;
  activite: string;
  nom_gerant: string;
  email: string;
  telephone?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  numero_rom_prefix?: string;
}

export interface UserLite {
  id: string;
  email: string;
  full_name?: string;
  name?: string;
  phone?: string;
  role: string;
}

export interface ArtworkLite {
  id: string;
  title: string;
  description?: string;
  technique?: string;
  dimensions?: string;
  category?: string;
  creation_date?: string;
  price: number;
  photos?: string[] | string;
}

// ── Récupération du merchant pour un user ─────────────────────────────────

export async function getMerchantForUser(userId: string): Promise<MerchantLite | null> {
  const sb = getDb();
  const { data } = await sb
    .from("merchants")
    .select("*")
    .eq("user_id", userId)
    .eq("actif", true)
    .maybeSingle();
  return data as MerchantLite | null;
}

// ── Insertion de l'entrée dans police_register_entries ────────────────────

export async function createPoliceRegisterEntry(args: {
  user: UserLite;
  merchant: MerchantLite;
  artwork: ArtworkLite;
  body: any;
}): Promise<{ entry: any; entryNumber: number } | null> {
  const sb = getDb();
  const { user, merchant, artwork, body } = args;

  // Numéro d'ordre séquentiel par user
  const { data: last } = await sb
    .from("police_register_entries")
    .select("entry_number")
    .eq("user_id", user.id)
    .order("entry_number", { ascending: false })
    .limit(1);
  const entryNumber = (last?.[0]?.entry_number || 0) + 1;

  // Normalisation photos
  const photos = Array.isArray(artwork.photos)
    ? artwork.photos
    : (typeof artwork.photos === "string" ? safeParseJson(artwork.photos) : []);

  const payload: any = {
    entry_number: entryNumber,
    user_id: user.id,
    merchant_id: merchant.id,
    acquisition_date: new Date().toISOString(),
    description: artwork.description || artwork.title,
    category: artwork.category || "art",
    photos: photos,
    purchase_price: Number(artwork.price) || 0,
    estimated_value: Number(artwork.price) || 0,
    artwork_id: artwork.id,
    seller_type: body.seller_type || "physical",
    seller_last_name: body.seller_last_name || "",
    seller_first_name: body.seller_first_name || "",
    seller_address: body.seller_address || "",
    seller_id_type: body.seller_id_type || "CNI",
    seller_id_number: body.seller_id_number || "",
    seller_company_name: body.seller_company_name || "",
    seller_company_siret: body.seller_company_siret || "",
    payment_method: body.payment_method || "virement",
    object_nature: artwork.technique || "oeuvre",
    is_voided: false,
    published_to_marketplace: true,
    published_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from("police_register_entries")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("[fiche-police] insert failed:", error.message);
    return null;
  }
  return { entry: data, entryNumber };
}

function safeParseJson(s: string): any[] {
  try { return JSON.parse(s); } catch { return []; }
}

// ── Génération du PDF individuel avec photo embarquée ─────────────────────

export async function generateSingleFichePDF(args: {
  merchant: MerchantLite;
  entry: any;
  artwork: ArtworkLite;
  user: UserLite;
}): Promise<Buffer> {
  const { merchant, entry, artwork, user } = args;
  const photoUrl = getFirstPhotoUrl(artwork.photos);
  const photoBuf = photoUrl ? await fetchImageBuffer(photoUrl) : null;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", c => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const W = doc.page.width;
      const M = 40;
      const CW = W - 2 * M;

      // Header
      doc.rect(0, 0, W, 80).fill(NAVY);
      doc.fontSize(22).font("Helvetica-Bold").fillColor(GOLD)
        .text("FICHE DE POLICE", M, 18, { width: CW, align: "center" });
      doc.fontSize(10).font("Helvetica").fillColor("#FFFFFF")
        .text("Art. 321-7 Code pénal — Registre des objets mobiliers", M, 44, { width: CW, align: "center" });
      doc.fontSize(9).fillColor(GOLD)
        .text(`N° d'ordre : ${entry.entry_number}  |  ROM : ${merchant.numero_rom_prefix || "—"}  |  SIRET : ${merchant.siret}`,
              M, 60, { width: CW, align: "center" });

      let y = 100;

      // Section: Professionnel déclarant
      y = section(doc, y, CW, M, "PROFESSIONNEL DÉCLARANT", [
        ["Raison sociale", merchant.raison_sociale],
        ["SIRET", merchant.siret],
        ["Activité", merchant.activite],
        ["Gérant", merchant.nom_gerant],
        ["Email", merchant.email],
        ["Téléphone", merchant.telephone || "—"],
        ["Adresse", [merchant.adresse, merchant.code_postal, merchant.ville].filter(Boolean).join(", ") || "—"],
        ["N° ROM", merchant.numero_rom_prefix || "—"],
      ]);

      // Section: Objet / Œuvre
      y = section(doc, y, CW, M, "OBJET / ŒUVRE", [
        ["Titre", artwork.title],
        ["Description", truncate(artwork.description || "—", 400)],
        ["Catégorie", artwork.category || "—"],
        ["Technique", artwork.technique || "—"],
        ["Dimensions", artwork.dimensions || "—"],
        ["Date de création", artwork.creation_date || "—"],
        ["Nature", entry.object_nature || "—"],
      ]);

      // Section: Photo principale (si disponible)
      if (photoBuf) {
        if (y + 200 > doc.page.height - 60) { doc.addPage(); y = 40; }
        doc.fontSize(11).font("Helvetica-Bold").fillColor(GOLD)
          .text("PHOTOGRAPHIE PRINCIPALE", M, y);
        y += 18;
        try {
          const imgWidth = Math.min(CW, 380);
          const imgX = M + (CW - imgWidth) / 2;
          doc.image(photoBuf, imgX, y, { fit: [imgWidth, 220], align: "center" });
          y += 230;
        } catch (e) {
          doc.fontSize(9).fillColor(MUTED).text("(image non affichable)", M, y);
          y += 20;
        }
      }

      // Section: Cédant / Vendeur
      if (y + 120 > doc.page.height - 60) { doc.addPage(); y = 40; }
      const sellerName = entry.seller_type === "physical"
        ? `${(entry.seller_last_name || "").toUpperCase()} ${entry.seller_first_name || ""}`.trim() || "—"
        : entry.seller_company_name || "—";
      y = section(doc, y, CW, M, "CÉDANT / VENDEUR", [
        ["Type", entry.seller_type === "physical" ? "Personne physique" : "Personne morale"],
        ["Nom / Raison sociale", sellerName],
        ["Adresse", entry.seller_address || "—"],
        ["Pièce d'identité", entry.seller_id_type || "—"],
        ["Numéro de pièce", entry.seller_id_number || "—"],
        ["SIRET (si pro)", entry.seller_company_siret || "—"],
      ]);

      // Section: Transaction
      const priceFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(entry.purchase_price) || 0);
      y = section(doc, y, CW, M, "TRANSACTION", [
        ["Prix d'achat", priceFmt],
        ["Mode de paiement", entry.payment_method || "—"],
        ["Date d'acquisition", new Date(entry.acquisition_date).toLocaleDateString("fr-FR")],
        ["Référence artwork", artwork.id],
      ]);

      // Footer
      const footerY = doc.page.height - 50;
      doc.moveTo(M, footerY).lineTo(W - M, footerY).lineWidth(0.5).stroke(GOLD);
      doc.fontSize(8).font("Helvetica").fillColor(MUTED)
        .text(
          `Document généré automatiquement par ART-CORE le ${new Date().toLocaleString("fr-FR")}  |  Entry ID : ${entry.id}`,
          M, footerY + 8, { width: CW, align: "center" }
        );
      doc.fontSize(7).fillColor(MUTED)
        .text(
          "Conservation obligatoire 6 ans à compter de la cession (Art. R321-8 Code pénal). Toute fausse déclaration expose aux sanctions prévues au Code pénal.",
          M, footerY + 22, { width: CW, align: "center" }
        );

      doc.end();
    } catch (err) { reject(err); }
  });
}

function section(doc: any, y: number, CW: number, M: number, title: string, rows: [string, string][]): number {
  // Saut de page si nécessaire
  if (y + (rows.length * 16) + 30 > doc.page.height - 60) { doc.addPage(); y = 40; }
  doc.fontSize(11).font("Helvetica-Bold").fillColor(GOLD).text(title, M, y);
  y += 16;
  doc.rect(M, y, CW, 1).fill(GOLD);
  y += 6;
  rows.forEach(([label, value]) => {
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#000000").text(label + " :", M, y, { width: 130, continued: false });
    doc.fontSize(9).font("Helvetica").fillColor("#333333").text(String(value), M + 140, y, { width: CW - 140 });
    y += 14;
  });
  return y + 10;
}

function truncate(s: string, n: number): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function getFirstPhotoUrl(photos: any): string | null {
  let arr: any[] = [];
  if (Array.isArray(photos)) arr = photos;
  else if (typeof photos === "string") { try { arr = JSON.parse(photos); } catch { arr = []; } }
  if (!arr.length) return null;
  const first = arr[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object") return first.url || first.src || null;
  return null;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    console.warn("[fiche-police] image fetch failed:", (e as any).message);
    return null;
  }
}

// ── Envoi email via Resend avec PJ PDF ────────────────────────────────────

export async function sendFicheEmail(args: {
  merchant: MerchantLite;
  entry: any;
  artwork: ArtworkLite;
  user: UserLite;
  pdfBuffer: Buffer;
}): Promise<boolean> {
  const { merchant, entry, artwork, user, pdfBuffer } = args;

  // Config email : SMTP (Gmail) en priorite, sinon Resend en fallback
  const hasSmtp =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    !String(process.env.SMTP_PASS).includes("COLLE_TON_MOT_DE_PASSE") &&
    !String(process.env.SMTP_PASS).includes("TO_FILL");
  const RESEND = process.env.RESEND_API_KEY;
  const hasResend = !!RESEND && !RESEND.includes("REMPLACE") && !RESEND.includes("TO_FILL");

  if (!hasSmtp && !hasResend) {
    console.warn("[fiche-police] aucune config email (SMTP_HOST/USER/PASS ou RESEND_API_KEY) — email skipped");
    return false;
  }

  const priceFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(entry.purchase_price) || 0);
  const photoUrl = getFirstPhotoUrl(artwork.photos);
  const photoImg = photoUrl
    ? `<div style="text-align:center;margin:20px 0"><img src="${photoUrl}" alt="${escapeHtml(artwork.title)}" style="max-width:100%;max-height:240px;border-radius:8px;border:1px solid #333"/></div>`
    : "";

  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#0F0F0F;color:#fff;padding:32px;border-radius:16px">
    <h1 style="color:#D4AF37;text-align:center;margin:0 0 8px 0">Fiche de police</h1>
    <p style="text-align:center;color:#999;margin:0 0 24px 0">Entrée N° ${entry.entry_number} — ${merchant.raison_sociale}</p>
    ${photoImg}
    <div style="background:#1a1a1a;border:1px solid #D4AF37;border-radius:12px;padding:20px;margin-bottom:20px">
      <h2 style="color:#D4AF37;font-size:14px;margin:0 0 12px 0;text-transform:uppercase;letter-spacing:1.5px">Identité marchand</h2>
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <tr><td style="color:#888;padding:3px 12px 3px 0;width:130px">Raison sociale</td><td style="color:#fff;font-weight:bold">${escapeHtml(merchant.raison_sociale)}</td></tr>
        <tr><td style="color:#888;padding:3px 12px 3px 0">SIRET</td><td style="color:#fff;font-family:monospace">${escapeHtml(merchant.siret)}</td></tr>
        <tr><td style="color:#888;padding:3px 12px 3px 0">Activité</td><td style="color:#fff">${escapeHtml(merchant.activite)}</td></tr>
        <tr><td style="color:#888;padding:3px 12px 3px 0">N° ROM</td><td style="color:#D4AF37;font-weight:bold">${escapeHtml(merchant.numero_rom_prefix || "—")}</td></tr>
      </table>
    </div>
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:20px;margin-bottom:20px">
      <h2 style="color:#fff;font-size:14px;margin:0 0 12px 0">Objet déclaré</h2>
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <tr><td style="color:#888;padding:3px 12px 3px 0;width:130px">Titre</td><td style="color:#fff">${escapeHtml(artwork.title)}</td></tr>
        <tr><td style="color:#888;padding:3px 12px 3px 0">Catégorie</td><td style="color:#ccc">${escapeHtml(artwork.category || "—")}</td></tr>
        <tr><td style="color:#888;padding:3px 12px 3px 0">Technique</td><td style="color:#ccc">${escapeHtml(artwork.technique || "—")}</td></tr>
        <tr><td style="color:#888;padding:3px 12px 3px 0">Dimensions</td><td style="color:#ccc">${escapeHtml(artwork.dimensions || "—")}</td></tr>
        <tr><td style="color:#888;padding:3px 12px 3px 0">Prix d'achat</td><td style="color:#D4AF37;font-weight:bold">${priceFmt}</td></tr>
      </table>
    </div>
    <p style="text-align:center;color:#888;font-size:12px;margin:16px 0">
      La fiche de police PDF est jointe à cet email (conservation légale 6 ans).<br/>
      Une copie a été envoyée à l'administrateur de la plateforme (${CC_ADMIN}).
    </p>
    <p style="text-align:center;color:#666;font-size:11px;margin-top:24px">
      Document généré automatiquement par ART-CORE<br/>
      ${new Date().toLocaleString("fr-FR")}
    </p>
  </div>`;

  // Envoi via nodemailer (Gmail SMTP) ou Resend SMTP en fallback
  const to = merchant.email || user.email;
  if (!to) {
    console.warn("[fiche-police] destinataire manquant (ni merchant.email ni user.email)");
    return false;
  }
  const subject = `Fiche de police N° ${entry.entry_number} — ${artwork.title}`;
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || "noreply@art-core.app";
  const attachmentName = `fiche-police-${entry.entry_number}-${safeSlug(artwork.title)}.pdf`;

  try {
    const nodemailer = (await import("nodemailer")).default;
    let transporter;
    if (hasSmtp) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER!,
          pass: process.env.SMTP_PASS!,
        },
      });
    } else {
      // Resend SMTP fallback
      transporter = nodemailer.createTransport({
        host: "smtp.resend.com",
        port: 465,
        secure: true,
        auth: { user: "resend", pass: RESEND! },
      });
    }

    await transporter.sendMail({
      from,
      to,
      cc: CC_ADMIN,
      subject,
      html,
      attachments: [
        {
          filename: attachmentName,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
    console.log(`[fiche-police] email envoye a ${to} (cc ${CC_ADMIN}) via ${hasSmtp ? "SMTP" : "Resend"}`);
    return true;
  } catch (e: any) {
    console.warn("[fiche-police] envoi email echec:", e.message);
    return false;
  }
}

function escapeHtml(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function safeSlug(s: string): string {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "entry";
}
