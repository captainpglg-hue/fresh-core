"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, Image as ImageIcon, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = [
  { label: "Peinture", value: "painting" },
  { label: "Sculpture", value: "sculpture" },
  { label: "Photographie", value: "photography" },
  { label: "Numérique", value: "digital" },
  { label: "Dessin", value: "drawing" },
  { label: "Technique mixte", value: "mixed_media" },
  { label: "Céramique", value: "ceramics" },
];

const PRO_ROLES = ["antiquaire", "galeriste", "brocanteur", "depot_vente"];

/**
 * Compresse une image côté client (max 2048x2048, JPEG 0.85) avant upload.
 * Même logique que ConfirmStep pass-core pour rester sous la limite serverless.
 */
async function compressImage(file: File, maxDim = 2048, quality = 0.85): Promise<Blob> {
  if (file.size < 1_500_000) return file;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
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
        (out) => (out ? resolve(out) : reject(new Error("Compression echouee"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    img.src = url;
  });
}

export default function DeposerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    technique: "",
    dimensions: "",
    creation_date: "",
    category: "painting",
    price: "",
  });

  // Champs vendeur (uniquement pour les pros qui déposent l'œuvre d'un vendeur tiers)
  const [seller, setSeller] = useState({
    seller_type: "physical", // "physical" | "company"
    seller_last_name: "",
    seller_first_name: "",
    seller_address: "",
    seller_id_type: "CNI",
    seller_id_number: "",
    seller_company_name: "",
    seller_company_siret: "",
    payment_method: "virement",
  });

  // Récupère le rôle de l'utilisateur pour afficher les champs pro si besoin
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.role) setUserRole(d.user.role);
      })
      .catch(() => {});
  }, []);

  const isPro = PRO_ROLES.includes(userRole);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const compressed = await compressImage(file);
          const fd = new FormData();
          fd.append("photo", compressed, file.name);
          const res = await fetch("/api/upload-photo", { method: "POST", body: fd });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || `Upload ${file.name} échoué`);
          uploaded.push(json.url);
        } catch (err: any) {
          toast({ title: `Upload ${file.name}`, description: err.message, variant: "destructive" });
        }
      }
      if (uploaded.length) {
        setPhotos((p) => [...p, ...uploaded]);
        toast({ title: `${uploaded.length} photo(s) ajoutée(s)` });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.price) {
      toast({ title: "Titre et prix requis", variant: "destructive" });
      return;
    }
    if (photos.length === 0) {
      toast({ title: "Au moins une photo requise", variant: "destructive" });
      return;
    }
    if (isPro) {
      // Vérif champs vendeur pour la fiche de police
      if (seller.seller_type === "physical" && !seller.seller_last_name) {
        toast({ title: "Nom du vendeur requis (obligation fiche de police)", variant: "destructive" });
        return;
      }
      if (seller.seller_type === "company" && !seller.seller_company_name) {
        toast({ title: "Raison sociale du vendeur requise", variant: "destructive" });
        return;
      }
    }

    setLoading(true);
    try {
      const body: any = {
        ...form,
        price: parseFloat(form.price),
        photos,
      };
      if (isPro) Object.assign(body, seller);

      const res = await fetch("/api/artworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      let desc = "Elle est maintenant visible sur le marketplace.";
      if (data.fiche_police?.triggered) {
        desc += ` Fiche de police N°${data.fiche_police.entry_number} générée` +
          (data.fiche_police.email_sent ? " et envoyée par email." : " (email non envoyé).");
      } else if (data.fiche_police?.reason === "missing_merchant_profile") {
        desc += " ATTENTION : profil pro incomplet, fiche de police non générée.";
      }
      toast({ title: "Œuvre déposée !", description: desc });
      router.push(`/art-core/oeuvre/${data.id}`);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-playfair text-3xl font-semibold text-white mb-2">Déposer une œuvre</h1>
      <p className="text-white/40 text-sm mb-8">
        {isPro
          ? "Formulaire professionnel avec génération automatique de la fiche de police."
          : "En 3 clics : photo, titre, prix."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photos */}
        <div>
          <Label>Photos *</Label>
          <div className="mt-2 flex flex-wrap gap-3">
            {photos.map((p, i) => (
              <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden bg-[#111111]">
                <img src={p} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X className="size-3 text-white" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center text-white/30 hover:border-gold/40 hover:text-gold/60 transition-colors disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 className="size-6 mb-1 animate-spin" />
              ) : (
                <ImageIcon className="size-6 mb-1" />
              )}
              <span className="text-[10px]">{uploading ? "Upload..." : "Ajouter"}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
          </div>
          <p className="text-[11px] text-white/25 mt-1">
            Formats : JPG, PNG, WEBP. Max 10 Mo par photo. Compression automatique.
          </p>
        </div>

        {/* Title & Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Titre de l'œuvre"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="price">Prix (€) *</Label>
            <Input
              id="price"
              type="number"
              min="1"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="5000"
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <Label>Catégorie</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setForm({ ...form, category: c.value })}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  form.category === c.value
                    ? "bg-gold text-black font-semibold"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="technique">Technique</Label>
            <Input
              id="technique"
              value={form.technique}
              onChange={(e) => setForm({ ...form, technique: e.target.value })}
              placeholder="Huile sur toile"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="dimensions">Dimensions</Label>
            <Input
              id="dimensions"
              value={form.dimensions}
              onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
              placeholder="80x120 cm"
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            placeholder="Décrivez votre œuvre..."
            className="w-full mt-1.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 p-3 resize-none focus:outline-none focus:border-gold/40"
          />
        </div>

        {/* Section vendeur (pros uniquement) */}
        {isPro && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 space-y-4">
            <div>
              <h2 className="text-gold font-semibold text-sm mb-1">
                Informations vendeur (fiche de police)
              </h2>
              <p className="text-white/50 text-xs">
                Obligation légale Art. 321-7 Code pénal. Ces informations seront intégrées à la
                fiche PDF envoyée par email.
              </p>
            </div>

            <div>
              <Label>Type de vendeur</Label>
              <div className="flex gap-2 mt-1.5">
                {[
                  { v: "physical", l: "Particulier" },
                  { v: "company", l: "Entreprise" },
                ].map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() => setSeller({ ...seller, seller_type: t.v })}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                      seller.seller_type === t.v
                        ? "bg-gold text-black font-semibold"
                        : "bg-white/5 text-white/50"
                    }`}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
            </div>

            {seller.seller_type === "physical" ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="seller_last_name">Nom *</Label>
                    <Input
                      id="seller_last_name"
                      value={seller.seller_last_name}
                      onChange={(e) =>
                        setSeller({ ...seller, seller_last_name: e.target.value })
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seller_first_name">Prénom</Label>
                    <Input
                      id="seller_first_name"
                      value={seller.seller_first_name}
                      onChange={(e) =>
                        setSeller({ ...seller, seller_first_name: e.target.value })
                      }
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="seller_address">Adresse</Label>
                  <Input
                    id="seller_address"
                    value={seller.seller_address}
                    onChange={(e) => setSeller({ ...seller, seller_address: e.target.value })}
                    placeholder="Rue, code postal, ville"
                    className="mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Pièce d'identité</Label>
                    <div className="flex gap-2 mt-1.5">
                      {["CNI", "Passeport", "Permis"].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSeller({ ...seller, seller_id_type: t })}
                          className={`px-2.5 py-1.5 rounded-lg text-xs ${
                            seller.seller_id_type === t
                              ? "bg-gold text-black font-semibold"
                              : "bg-white/5 text-white/50"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="seller_id_number">N° de pièce</Label>
                    <Input
                      id="seller_id_number"
                      value={seller.seller_id_number}
                      onChange={(e) =>
                        setSeller({ ...seller, seller_id_number: e.target.value })
                      }
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="seller_company_name">Raison sociale *</Label>
                  <Input
                    id="seller_company_name"
                    value={seller.seller_company_name}
                    onChange={(e) =>
                      setSeller({ ...seller, seller_company_name: e.target.value })
                    }
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="seller_company_siret">SIRET</Label>
                  <Input
                    id="seller_company_siret"
                    value={seller.seller_company_siret}
                    onChange={(e) =>
                      setSeller({ ...seller, seller_company_siret: e.target.value })
                    }
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Mode de paiement</Label>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {[
                  { v: "virement", l: "Virement" },
                  { v: "cheque", l: "Chèque" },
                  { v: "especes", l: "Espèces" },
                  { v: "carte", l: "Carte" },
                ].map((p) => (
                  <button
                    key={p.v}
                    type="button"
                    onClick={() => setSeller({ ...seller, payment_method: p.v })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs ${
                      seller.payment_method === p.v
                        ? "bg-gold text-black font-semibold"
                        : "bg-white/5 text-white/50"
                    }`}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full gap-2" disabled={loading || uploading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Déposer l&apos;œuvre
        </Button>
      </form>
    </div>
  );
}
