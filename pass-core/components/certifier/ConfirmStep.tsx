"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

/**
 * Étape 3/3 — Formulaire métadonnées + certification.
 *
 * POST /api/certify avec macro photo + fingerprint déjà validé.
 * Affiche l'écran de succès avec hash blockchain + lien Art-Core.
 *
 * IMPORTANT : compresse la macro photo côté client avant envoi
 * pour rester sous la limite Vercel serverless (4.5 MB sur Hobby).
 * Cible : ~1.5 MB max, max 2048x2048, JPEG qualité 0.85.
 */

/**
 * Compresse un blob image vers max 2048x2048 et JPEG 0.85.
 * Utilise canvas + toBlob pour éviter toute dépendance serveur.
 */
async function compressImage(
  blob: Blob,
  maxDim = 2048,
  quality = 0.85
): Promise<Blob> {
  // Si déjà léger, on renvoie tel quel
  if (blob.size < 1_500_000) return blob;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D indisponible"));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (out) => {
          if (!out) return reject(new Error("Compression échouée"));
          resolve(out);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible pour compression"));
    };
    img.src = url;
  });
}

interface Props {
  macroBlob: Blob;
  fingerprintHash: string;
  onSuccess?: (artworkId: string) => void;
}

const CATEGORIES = [
  { value: "painting", label: "Peinture" },
  { value: "sculpture", label: "Sculpture" },
  { value: "photography", label: "Photographie" },
  { value: "digital", label: "Numérique" },
  { value: "drawing", label: "Dessin" },
  { value: "mixed", label: "Technique mixte" },
  { value: "ceramic", label: "Céramique" },
];

export default function ConfirmStep({
  macroBlob,
  fingerprintHash,
  onSuccess,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [technique, setTechnique] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [category, setCategory] = useState("painting");
  const [price, setPrice] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    id: string;
    blockchain_hash: string;
    explorer_url?: string;
  } | null>(null);

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Le titre est requis");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Compression client-side pour rester sous la limite Vercel 4.5 MB
      let photoBlob: Blob = macroBlob;
      try {
        photoBlob = await compressImage(macroBlob);
        console.log(
          `[certify] photo compressed: ${(macroBlob.size / 1024).toFixed(0)}KB -> ${(photoBlob.size / 1024).toFixed(0)}KB`
        );
      } catch (compErr) {
        console.warn("[certify] compression failed, sending original:", compErr);
      }

      const fd = new FormData();
      fd.append("title", title);
      fd.append("description", description);
      fd.append("technique", technique);
      fd.append("dimensions", dimensions);
      fd.append("category", category);
      fd.append("price", price || "0");
      fd.append("macro_photo", photoBlob, "macro.jpg");
      if (email) fd.append("email", email);

      const res = await fetch("/api/certify", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Certification échouée");

      setSuccess({
        id: json.id,
        blockchain_hash: json.blockchain_hash,
        explorer_url: json.explorer_url,
      });
      onSuccess?.(json.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-white p-4">
        <div className="max-w-lg mx-auto pt-12 text-center">
          <CheckCircle2 className="size-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Œuvre certifiée</h2>
          <p className="opacity-70 mb-6">
            Ton œuvre est enregistrée et protégée.
          </p>

          <div className="bg-white/5 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs opacity-60 mb-1">Hash blockchain</p>
            <p className="font-mono text-xs break-all mb-3">
              {success.blockchain_hash}
            </p>
            {success.explorer_url && (
              <a
                href={success.explorer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold text-sm hover:underline"
              >
                Voir sur la blockchain ↗
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={`https://art-core.app/art-core/oeuvre/${success.id}`}
              className="px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20"
            >
              Voir la fiche
            </a>
            <a
              href="/pass-core/certifier"
              className="px-4 py-3 rounded-lg bg-gold text-black font-medium hover:bg-gold/90"
            >
              Certifier une autre
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white p-4">
      <div className="max-w-lg mx-auto">
        <h2 className="text-xl font-semibold mb-1">Infos de l&apos;œuvre</h2>
        <p className="text-sm opacity-60 mb-6">Empreinte : {fingerprintHash.slice(0, 16)}…</p>

        <div className="space-y-4">
          <Field
            label="Titre *"
            value={title}
            onChange={setTitle}
            placeholder="Nom de l'œuvre"
            required
          />
          <Field
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="Histoire, inspiration…"
            textarea
          />
          <Field
            label="Technique"
            value={technique}
            onChange={setTechnique}
            placeholder="Huile sur toile, bronze, etc."
          />
          <Field
            label="Dimensions"
            value={dimensions}
            onChange={setDimensions}
            placeholder="80×120 cm"
          />

          <div>
            <label className="block text-sm opacity-70 mb-1.5">Catégorie</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition ${
                    category === c.value
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-white/10 text-white/60 hover:border-white/20"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <Field
            label="Prix (€)"
            value={price}
            onChange={setPrice}
            placeholder="1500"
            type="number"
          />
          <Field
            label="Email de réception du certificat (optionnel)"
            value={email}
            onChange={setEmail}
            placeholder="toi@exemple.com"
            type="email"
          />

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
            className="w-full py-3 rounded-lg bg-gold text-black font-semibold hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Certification en cours…" : "Certifier sur la blockchain"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm opacity-70 mb-1.5">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-gold/50 outline-none resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-gold/50 outline-none"
        />
      )}
    </div>
  );
}
