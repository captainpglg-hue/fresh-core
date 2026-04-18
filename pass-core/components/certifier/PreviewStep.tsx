"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

/**
 * Étape 2/3 — Preview de la photo macro + détection de doublons.
 *
 * Envoie la photo à /api/fingerprint, affiche le résultat :
 *  - unique : vert, bouton Confirmer
 *  - similar : orange, liste des matches, demande confirmation
 *  - duplicate : rouge, bloque la certification
 *  - unknown : gris, continue sans détection (sharp absent)
 */

interface Props {
  macroBlob: Blob;
  macroDataUrl: string;
  width: number;
  height: number;
  onConfirm: (fingerprint: FingerprintResponse) => void;
  onRetake: () => void;
}

interface DuplicateMatch {
  artwork_id: string;
  title: string;
  similarity: number;
  blockchain_hash: string | null;
  certification_date: string | null;
  verdict: "duplicate" | "similar";
}

interface FingerprintResponse {
  fingerprint: {
    a_hash: string;
    d_hash: string;
    blockchain_hash: string;
    similarity_id: string;
  };
  image_stats: {
    width: number;
    height: number;
    avg_brightness: number;
    contrast: number;
  };
  has_perceptual: boolean;
  verdict: "unique" | "similar" | "duplicate" | "unknown";
  duplicate_warning: DuplicateMatch | null;
  similar_matches: DuplicateMatch[];
}

export default function PreviewStep({
  macroBlob,
  macroDataUrl,
  width,
  height,
  onConfirm,
  onRetake,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [fp, setFp] = useState<FingerprintResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const formData = new FormData();
        formData.append("macro_photo", macroBlob, "macro.jpg");
        formData.append("check_duplicates", "true");

        const res = await fetch("/api/fingerprint", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erreur fingerprint");
        setFp(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [macroBlob]);

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white p-4">
      <div className="max-w-lg mx-auto">
        <h2 className="text-xl font-semibold mb-4">Analyse de la photo</h2>

        {/* Photo preview */}
        <div className="relative mb-6 rounded-xl overflow-hidden bg-black/50">
          <img
            src={macroDataUrl}
            alt="Macro capturée"
            className="w-full h-auto"
          />
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-1 rounded text-xs">
            {width}×{height}
          </div>
        </div>

        {/* État analyse */}
        {loading && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5">
            <Loader2 className="size-5 animate-spin text-gold" />
            <span>Génération de l&apos;empreinte visuelle…</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <XCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Erreur</p>
              <p className="text-sm opacity-80">{error}</p>
              <button
                onClick={onRetake}
                className="mt-3 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-sm"
              >
                Recommencer
              </button>
            </div>
          </div>
        )}

        {fp && <VerdictBlock fp={fp} onConfirm={onConfirm} onRetake={onRetake} />}
      </div>
    </div>
  );
}

function VerdictBlock({
  fp,
  onConfirm,
  onRetake,
}: {
  fp: FingerprintResponse;
  onConfirm: (fp: FingerprintResponse) => void;
  onRetake: () => void;
}) {
  if (fp.verdict === "duplicate" && fp.duplicate_warning) {
    const m = fp.duplicate_warning;
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="size-5 text-red-400" />
          <h3 className="font-semibold text-red-400">
            Œuvre déjà certifiée ({m.similarity}% de correspondance)
          </h3>
        </div>
        <p className="text-sm opacity-90 mb-1">
          Cette photo correspond à <strong>{m.title}</strong>
        </p>
        <p className="text-xs opacity-60 mb-4">
          Certifiée le{" "}
          {m.certification_date
            ? new Date(m.certification_date).toLocaleDateString("fr-FR")
            : "—"}
        </p>
        <p className="text-sm mb-4">
          Impossible de certifier une œuvre déjà enregistrée. Si tu es le
          propriétaire d&apos;origine, contacte le support.
        </p>
        <button
          onClick={onRetake}
          className="w-full px-4 py-2 rounded bg-white/10 hover:bg-white/20"
        >
          Reprendre une photo
        </button>
      </div>
    );
  }

  if (fp.verdict === "similar" && fp.similar_matches.length > 0) {
    return (
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="size-5 text-amber-400" />
          <h3 className="font-semibold text-amber-400">
            Œuvre similaire détectée
          </h3>
        </div>
        <p className="text-sm mb-3">
          Cette photo ressemble à {fp.similar_matches.length} œuvre(s) déjà
          certifiée(s) :
        </p>
        <ul className="space-y-2 mb-4 text-sm">
          {fp.similar_matches.slice(0, 3).map((m) => (
            <li
              key={m.artwork_id}
              className="flex justify-between p-2 rounded bg-white/5"
            >
              <span>{m.title}</span>
              <span className="text-amber-400 font-mono">{m.similarity}%</span>
            </li>
          ))}
        </ul>
        <p className="text-xs opacity-70 mb-4">
          Si c&apos;est bien la tienne, tu peux continuer. Sinon, reprends la photo
          avec un angle ou détail différent.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onRetake}
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
          >
            Reprendre
          </button>
          <button
            onClick={() => onConfirm(fp)}
            className="px-4 py-2 rounded bg-gold text-black font-medium hover:bg-gold/90"
          >
            C&apos;est la mienne
          </button>
        </div>
      </div>
    );
  }

  // unique ou unknown
  return (
    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="size-5 text-emerald-400" />
        <h3 className="font-semibold text-emerald-400">
          {fp.verdict === "unique"
            ? "Œuvre unique"
            : "Empreinte générée"}
        </h3>
      </div>
      <p className="text-sm mb-2">
        {fp.verdict === "unique"
          ? "Aucun doublon détecté. Tu peux procéder à la certification."
          : "Empreinte cryptographique enregistrée. Procède à la certification."}
      </p>
      <p className="text-xs font-mono opacity-50 mb-4 break-all">
        {fp.fingerprint.blockchain_hash.slice(0, 24)}…
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onRetake}
          className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
        >
          Reprendre
        </button>
        <button
          onClick={() => onConfirm(fp)}
          className="px-4 py-2 rounded bg-gold text-black font-medium hover:bg-gold/90"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
