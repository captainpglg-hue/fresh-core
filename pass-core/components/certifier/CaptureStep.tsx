"use client";

import { useEffect } from "react";
import { useCameraMacro } from "./useCameraMacro";

/**
 * Étape 1/3 — Capture photo macro avec guide visuel et contraintes qualité.
 *
 * Affiche :
 *  - preview caméra plein écran (viewfinder)
 *  - overlay cadre de cadrage
 *  - barre de qualité (résolution + netteté + exposition)
 *  - feedback textuel en temps réel
 *  - bouton Capturer désactivé tant que qualité insuffisante
 */

interface Props {
  onCapture: (blob: Blob, dataUrl: string, width: number, height: number) => void;
  onCancel?: () => void;
}

export default function CaptureStep({ onCapture, onCancel }: Props) {
  const { videoRef, canvasRef, isReady, error, quality, start, capture } =
    useCameraMacro();

  useEffect(() => {
    start();
  }, [start]);

  async function handleCapture() {
    const result = await capture();
    if (!result) return;
    onCapture(result.blob, result.dataUrl, result.width, result.height);
  }

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      {/* ── Viewfinder ──────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay guide macro */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-black/30" />
          {/* Fenêtre centrale claire */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] aspect-square border-2 rounded-lg"
            style={{
              borderColor: quality.isAcceptable ? "#d4af37" : "#ef4444",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
            }}
          >
            {/* Coins */}
            {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos) => (
              <div
                key={pos}
                className={`absolute w-4 h-4 border-white ${pos} ${
                  pos.includes("top") ? "border-t-2" : "border-b-2"
                } ${pos.includes("left") ? "border-l-2" : "border-r-2"}`}
              />
            ))}
            {/* Cible centrale */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-px bg-white/50" />
              <div className="absolute w-px h-8 bg-white/50" />
            </div>
          </div>

          {/* Texte guide */}
          <div className="absolute top-4 left-0 right-0 text-center px-4">
            <p className="text-sm opacity-90">
              Cadre un détail unique de l&apos;œuvre (signature, texture, défaut, pigment)
            </p>
          </div>
        </div>

        {/* Erreur caméra */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/80">
            <div className="max-w-sm text-center">
              <p className="text-red-400 mb-2">{error}</p>
              <button
                onClick={start}
                className="mt-4 px-4 py-2 bg-white text-black rounded-lg"
              >
                Réessayer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Barre qualité ───────────────────────────────────── */}
      <div className="bg-black px-4 py-3 border-t border-white/10">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="opacity-60">
            {quality.resolution} MP · netteté {quality.sharpness}% · expo {quality.exposure}%
          </span>
          <span
            className={
              quality.isAcceptable ? "text-emerald-400" : "text-amber-400"
            }
          >
            {quality.isAcceptable ? "✓ Prêt" : "⚠ Ajuster"}
          </span>
        </div>

        {/* Score */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${quality.score}%`,
              background: quality.isAcceptable
                ? "linear-gradient(to right, #d4af37, #f0d66b)"
                : "linear-gradient(to right, #dc2626, #f59e0b)",
            }}
          />
        </div>

        <p className="text-xs mt-2 opacity-80">{quality.feedback}</p>
      </div>

      {/* ── Boutons ─────────────────────────────────────────── */}
      <div className="bg-black px-6 py-4 flex items-center justify-between">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm opacity-70 hover:opacity-100"
          >
            Annuler
          </button>
        )}
        <button
          onClick={handleCapture}
          disabled={!isReady || !quality.isAcceptable}
          className="mx-auto w-16 h-16 rounded-full border-4 border-white disabled:border-white/30 disabled:opacity-40 transition-all active:scale-95"
          aria-label="Capturer"
        >
          <span
            className="block w-full h-full rounded-full"
            style={{
              background: quality.isAcceptable ? "#d4af37" : "rgba(255,255,255,0.2)",
            }}
          />
        </button>
        <div className="w-[72px]" />
      </div>
    </div>
  );
}
