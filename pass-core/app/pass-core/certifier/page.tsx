"use client";

import { useState } from "react";
import CaptureStep from "@/components/certifier/CaptureStep";
import PreviewStep from "@/components/certifier/PreviewStep";
import ConfirmStep from "@/components/certifier/ConfirmStep";
import { Camera, Fingerprint, Sparkles } from "lucide-react";

/**
 * Page certifier v2 — orchestration 3 étapes.
 * Remplace l'ancien monolithe 921 lignes.
 */

type Step = "intro" | "capture" | "preview" | "confirm";

export default function CertifierPage() {
  const [step, setStep] = useState<Step>("intro");

  const [macroBlob, setMacroBlob] = useState<Blob | null>(null);
  const [macroDataUrl, setMacroDataUrl] = useState<string>("");
  const [macroWidth, setMacroWidth] = useState(0);
  const [macroHeight, setMacroHeight] = useState(0);

  const [fingerprintHash, setFingerprintHash] = useState<string>("");

  function handleCapture(blob: Blob, dataUrl: string, w: number, h: number) {
    setMacroBlob(blob);
    setMacroDataUrl(dataUrl);
    setMacroWidth(w);
    setMacroHeight(h);
    setStep("preview");
  }

  function handleConfirmPreview(fp: {
    fingerprint: { blockchain_hash: string };
  }) {
    setFingerprintHash(fp.fingerprint.blockchain_hash);
    setStep("confirm");
  }

  function handleRetake() {
    setMacroBlob(null);
    setMacroDataUrl("");
    setStep("capture");
  }

  // ── Intro ────────────────────────────────────────────────
  if (step === "intro") {
    return (
      <div className="min-h-screen bg-[#0C0C0C] text-white">
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-display font-light mb-3">
              Certifie ton œuvre
            </h1>
            <p className="opacity-60">
              Empreinte visuelle unique · enregistrement blockchain · certificat
              transmis par email
            </p>
          </div>

          <div className="space-y-4 mb-10">
            <StepCard
              icon={<Camera className="size-5" />}
              title="1. Photo macro"
              desc="Capture un détail unique avec un guide visuel en temps réel"
            />
            <StepCard
              icon={<Fingerprint className="size-5" />}
              title="2. Empreinte visuelle"
              desc="On vérifie automatiquement qu'aucune œuvre similaire n'est déjà certifiée"
            />
            <StepCard
              icon={<Sparkles className="size-5" />}
              title="3. Certification"
              desc="Hash blockchain, fiche publique, certificat PDF"
            />
          </div>

          <button
            onClick={() => setStep("capture")}
            className="w-full py-4 rounded-xl bg-gold text-black font-semibold hover:bg-gold/90 transition"
          >
            Commencer
          </button>

          <p className="text-xs opacity-50 text-center mt-6">
            Temps estimé : 3 min · Caméra arrière requise
          </p>
        </div>
      </div>
    );
  }

  // ── Capture ──────────────────────────────────────────────
  if (step === "capture") {
    return (
      <CaptureStep
        onCapture={handleCapture}
        onCancel={() => setStep("intro")}
      />
    );
  }

  // ── Preview ──────────────────────────────────────────────
  if (step === "preview" && macroBlob) {
    return (
      <PreviewStep
        macroBlob={macroBlob}
        macroDataUrl={macroDataUrl}
        width={macroWidth}
        height={macroHeight}
        onConfirm={handleConfirmPreview}
        onRetake={handleRetake}
      />
    );
  }

  // ── Confirm ──────────────────────────────────────────────
  if (step === "confirm" && macroBlob) {
    return (
      <ConfirmStep macroBlob={macroBlob} fingerprintHash={fingerprintHash} />
    );
  }

  return null;
}

function StepCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="size-10 rounded-lg bg-gold/10 text-gold flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-medium mb-1">{title}</p>
        <p className="text-sm opacity-60">{desc}</p>
      </div>
    </div>
  );
}
