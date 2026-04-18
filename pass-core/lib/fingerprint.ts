import crypto from "crypto";

/**
 * Générateur d'empreinte visuelle pour certification d'œuvres.
 *
 * Utilise aHash (average) + dHash (difference) sur image 16x16 grayscale
 * si `sharp` est disponible. Sinon fallback SHA-256 + MD5.
 *
 * Empreintes identiques = même image (pixel-parfait)
 * Empreintes proches (Hamming < 10%) = même œuvre, angle/exposition différent
 * Empreintes éloignées = œuvres différentes
 */

export interface FingerprintResult {
  aHash: string;              // Average hash (256 bits hex) ou sha256 si pas de sharp
  dHash: string;              // Difference hash (240 bits hex) ou md5 si pas de sharp
  combined: string;           // Hash combiné 0x... pour la blockchain
  similarity_hash: string;    // 16 premiers chars pour lookup rapide
  image_stats: {
    width: number;
    height: number;
    avg_brightness: number;
    contrast: number;
  };
  has_perceptual: boolean;    // true si sharp était dispo, false en fallback
}

export async function generateFingerprint(
  imageBuffer: Buffer
): Promise<FingerprintResult> {
  try {
    // ── Mode perceptuel (sharp disponible) ─────────────────
    const sharpMod = await import("sharp");
    const sharp = sharpMod.default;

    const metadata = await sharp(imageBuffer).metadata();

    // aHash : 16x16 = 256 bits
    const aPixels = await sharp(imageBuffer)
      .resize(16, 16, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();

    const avgBrightness =
      aPixels.reduce((s, v) => s + v, 0) / aPixels.length;

    let aBits = "";
    for (let i = 0; i < aPixels.length; i++) {
      aBits += aPixels[i] >= avgBrightness ? "1" : "0";
    }
    const aHash = bitsToHex(aBits);

    // dHash : 17x16 puis comparaison pixel gauche > droite = 240 bits
    const dPixels = await sharp(imageBuffer)
      .resize(17, 16, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();

    let dBits = "";
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 16; col++) {
        const idx = row * 17 + col;
        dBits += dPixels[idx] > dPixels[idx + 1] ? "1" : "0";
      }
    }
    const dHash = bitsToHex(dBits);

    // Contraste
    let minVal = 255,
      maxVal = 0;
    for (let i = 0; i < aPixels.length; i++) {
      if (aPixels[i] < minVal) minVal = aPixels[i];
      if (aPixels[i] > maxVal) maxVal = aPixels[i];
    }
    const contrast = maxVal - minVal;

    const combined = crypto
      .createHash("sha256")
      .update(`${aHash}:${dHash}:core-fingerprint-v1`)
      .digest("hex");

    return {
      aHash,
      dHash,
      combined: `0x${combined}`,
      similarity_hash: aHash.slice(0, 16),
      image_stats: {
        width: metadata.width || 0,
        height: metadata.height || 0,
        avg_brightness: Math.round(avgBrightness),
        contrast,
      },
      has_perceptual: true,
    };
  } catch (err) {
    // ── Fallback : sharp indisponible ──────────────────────
    // On produit des hashes cryptographiques qui permettent
    // SEULEMENT de détecter l'égalité stricte (même fichier).
    // La similarité perceptuelle n'est pas possible sans sharp.
    console.warn(
      "[fingerprint] sharp indisponible, fallback SHA-256 +  MD5 :",
      err instanceof Error ? err.message : String(err)
    );

    const sha256 = crypto.createHash("sha256").update(imageBuffer).digest("hex");
    const md5 = crypto.createHash("md5").update(imageBuffer).digest("hex");
    const combined = crypto
      .createHash("sha256")
      .update(`${sha256}:${md5}:core-fingerprint-v1-fallback`)
      .digest("hex");

    return {
      aHash: sha256,
      dHash: md5,
      combined: `0x${combined}`,
      similarity_hash: sha256.slice(0, 16),
      image_stats: {
        width: 0,
        height: 0,
        avg_brightness: 0,
        contrast: 0,
      },
      has_perceptual: false,
    };
  }
}

/**
 * Distance de Hamming normalisée entre deux hashes hex de même longueur.
 * Retourne un score de similarité 0-100 (100 = identique).
 *
 * Seuil recommandé :
 *   ≥ 90 : même image, exactement
 *   ≥ 62.5 : très probable même œuvre, conditions différentes
 *   < 50 : œuvres différentes
 */
export function compareFingerprintsHamming(h1: string, h2: string): number {
  if (!h1 || !h2 || h1.length !== h2.length) return 0;

  let distance = 0;
  for (let i = 0; i < h1.length; i++) {
    const n1 = parseInt(h1[i], 16);
    const n2 = parseInt(h2[i], 16);
    let xor = n1 ^ n2;
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  const totalBits = h1.length * 4;
  const similarity = ((totalBits - distance) / totalBits) * 100;
  return Math.round(similarity * 100) / 100;
}

function bitsToHex(bits: string): string {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    const nibble = bits.slice(i, i + 4).padEnd(4, "0");
    hex += parseInt(nibble, 2).toString(16);
  }
  return hex;
}
