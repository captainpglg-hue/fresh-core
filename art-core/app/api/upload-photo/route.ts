import { NextRequest, NextResponse } from "next/server";
import { uploadPhoto } from "@/lib/supabase-storage";
import { getUserByToken } from "@/lib/db";

/**
 * POST /api/upload-photo
 *
 * Uploade une photo vers Supabase Storage (bucket "artworks") et renvoie
 * l'URL publique. Utilisé par le formulaire de dépôt d'oeuvre (art-core)
 * et potentiellement par d'autres flows (profil, avatar, etc.).
 *
 * Body : multipart/form-data avec le champ "photo" (File)
 * Optional : "folder" (string, default: "artworks/<userId>")
 *
 * Auth : cookie core_session requis.
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("core_session")?.value;
    if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const user = await getUserByToken(token);
    if (!user) return NextResponse.json({ error: "Session invalide" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("photo") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Fichier 'photo' manquant" }, { status: 400 });
    }

    // Garde-fou : taille max 10MB (au-delà => probablement abuse)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier > 10MB. Compressez avant upload." }, { status: 413 });
    }

    // Garde-fou : mime image uniquement
    const contentType = file.type || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Type de fichier non supporté (attendu: image/*)" }, { status: 400 });
    }

    const folderOverride = formData.get("folder") as string | null;
    const folder = folderOverride || `artworks/${user.id}`;
    // Nom unique : timestamp + random + extension
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadPhoto(buffer, folder, name);

    return NextResponse.json({ url: publicUrl, size: file.size, name });
  } catch (error: any) {
    console.error("[upload-photo] error:", error?.message);
    return NextResponse.json({ error: error?.message || "Upload error" }, { status: 500 });
  }
}
