import { NextRequest, NextResponse } from "next/server";
import { generateFingerprint, compareFingerprintsHamming } from "@/lib/fingerprint";
import { queryOne, queryAll, query, getUserByToken } from "@/lib/db";

/**
 * POST /api/fingerprint
 *
 * Génère une empreinte visuelle d'une photo macro et vérifie si elle
 * correspond à une œuvre déjà certifiée (détection de doublons).
 *
 * Seuils :
 *   ≥ 90 % similarité : DUPLICATE (même photo, à refuser)
 *   ≥ 62.5 %           : SIMILAR (alerter, l'utilisateur doit confirmer)
 *   < 62.5 %           : UNIQUE (OK)
 */

interface StoredArtwork {
  id: string;
  title: string;
  artist_id: string;
  blockchain_hash: string | null;
  macro_fingerprint: string | null;
  certification_date: string | null;
}

interface DuplicateMatch {
  artwork_id: string;
  title: string;
  similarity: number;
  blockchain_hash: string | null;
  certification_date: string | null;
  verdict: "duplicate" | "similar";
}

const THRESHOLD_DUPLICATE = 90;
const THRESHOLD_SIMILAR = 62.5;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("macro_photo") as File;
    const compareHash = formData.get("compare_hash") as string | null;
    const checkDuplicates = formData.get("check_duplicates") !== "false";

    if (!file) {
      return NextResponse.json({ error: "Photo macro requise" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Garde-fou : fichier trop petit → pas une photo macro
    if (buffer.byteLength < 50_000) {
      return NextResponse.json(
        {
          error: "Photo trop petite (< 50 KB). Utilise une photo macro haute résolution.",
        },
        { status: 400 }
      );
    }

    const fingerprint = await generateFingerprint(buffer);

    // ── Recherche par hash exact (si fourni) ────────────────
    let exactMatch = null;
    if (compareHash) {
      const artwork = await queryOne<StoredArtwork>(
        "SELECT id, title, artist_id, blockchain_hash, macro_fingerprint, certification_date FROM artworks WHERE blockchain_hash = ?",
        [compareHash]
      );
      if (artwork) {
        exactMatch = {
          found: true,
          artwork_id: artwork.id,
          artwork_title: artwork.title,
        };
      }
    }

    // ── Détection de doublons (similarité perceptuelle) ────
    const matches: DuplicateMatch[] = [];

    if (checkDuplicates && fingerprint.has_perceptual) {
      // On ne charge que les œuvres ayant un fingerprint stocké et non nul.
      // Format attendu en DB : JSON {"aHash":"...","dHash":"..."} ou ancien hash brut.
      const candidates = await queryAll<StoredArtwork>(
        `SELECT id, title, artist_id, blockchain_hash, macro_fingerprint, certification_date
         FROM artworks
         WHERE macro_fingerprint IS NOT NULL AND macro_fingerprint != ''
         ORDER BY certification_date DESC
         LIMIT 500`
      );

      for (const candidate of candidates) {
        const storedHash = extractAHashFromStored(candidate.macro_fingerprint);
        if (!storedHash) continue;

        const similarity = compareFingerprintsHamming(fingerprint.aHash, storedHash);

        if (similarity >= THRESHOLD_SIMILAR) {
          matches.push({
            artwork_id: candidate.id,
            title: candidate.title,
            similarity,
            blockchain_hash: candidate.blockchain_hash,
            certification_date: candidate.certification_date,
            verdict: similarity >= THRESHOLD_DUPLICATE ? "duplicate" : "similar",
          });
        }
      }

      matches.sort((a, b) => b.similarity - a.similarity);
    }

    // ── Log de tentative (si l'utilisateur est connecté) ───
    const token = req.cookies.get("core_session")?.value;
    if (token) {
      try {
        const user = await getUserByToken(token);
        if (user) {
          const attemptId = `cert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const status =
            matches.length > 0 && matches[0].verdict === "duplicate"
              ? "duplicate"
              : "pending";
          await query(
            `INSERT INTO certification_attempts (id, owner_id, status, p_hash, image_sha256) VALUES (?, ?, ?, ?, ?)`,
            [attemptId, user.id, status, fingerprint.aHash, fingerprint.combined]
          );
        }
      } catch (logErr) {
        // Table absente ou erreur DB : on continue, pas bloquant
        console.warn("[fingerprint] log tentative impossible:", logErr);
      }
    }

    const topMatch = matches[0] || null;
    const verdict = topMatch
      ? topMatch.verdict
      : fingerprint.has_perceptual
      ? "unique"
      : "unknown"; // unknown = fallback md5, pas de détection possible

    return NextResponse.json({
      fingerprint: {
        a_hash: fingerprint.aHash,
        d_hash: fingerprint.dHash,
        blockchain_hash: fingerprint.combined,
        similarity_id: fingerprint.similarity_hash,
      },
      image_stats: fingerprint.image_stats,
      has_perceptual: fingerprint.has_perceptual,
      verdict,
      exact_match: exactMatch,
      duplicate_warning:
        topMatch && topMatch.verdict === "duplicate" ? topMatch : null,
      similar_matches: matches.slice(0, 5),
      thresholds: {
        duplicate: THRESHOLD_DUPLICATE,
        similar: THRESHOLD_SIMILAR,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[fingerprint] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Le champ macro_fingerprint en DB peut contenir :
 *   - l'ancien format : hash brut "abc123..."
 *   - le nouveau format : JSON {"aHash":"...","dHash":"...","combined":"0x..."}
 *   - ou une chaîne enrichie "<aHash>|pos:<position>"
 *
 * On extrait toujours le aHash pour comparaison.
 */
function extractAHashFromStored(stored: string | null): string | null {
  if (!stored) return null;

  // Format 1 : JSON
  if (stored.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.aHash || parsed.a_hash || parsed.hash || null;
    } catch {
      return null;
    }
  }

  // Format 2 : hash|pos:...
  if (stored.includes("|")) {
    return stored.split("|")[0];
  }

  // Format 3 : hash brut
  return stored;
}
