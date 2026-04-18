"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook caméra macro avec contraintes qualité.
 *
 * Vérifie :
 *  - résolution min 2 MP
 *  - détection de flou (variance du Laplacien)
 *  - exposition raisonnable (pas de sur/sous-exposition extrême)
 *
 * Retourne stream, capture(), qualité estimée, et un guide visuel overlay.
 */

export interface CameraQuality {
  resolution: number; // megapixels
  sharpness: number; // 0-100 (100 = net)
  exposure: number; // 0-100 (50 = bon)
  score: number; // global 0-100
  isAcceptable: boolean;
  feedback: string;
}

export interface CaptureResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  quality: CameraQuality;
}

const MIN_RESOLUTION_MP = 2;
const MIN_SHARPNESS = 40;
const MIN_SCORE = 60;

export function useCameraMacro() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<CameraQuality>({
    resolution: 0,
    sharpness: 0,
    exposure: 50,
    score: 0,
    isAcceptable: false,
    feedback: "Préparation de la caméra…",
  });

  // ── Start stream ──────────────────────────────────────────
  const start = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          // @ts-ignore — focusMode dans certains Android
          focusMode: "continuous",
          // @ts-ignore
          advanced: [{ focusDistance: 0.1 }],
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsReady(true);
      startQualityLoop();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Impossible d'accéder à la caméra : ${msg}`);
    }
  }, []);

  // ── Stop stream ───────────────────────────────────────────
  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsReady(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  // ── Boucle qualité (sharpness via Laplacien) ──────────────
  const startQualityLoop = useCallback(() => {
    const loop = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const sampleSize = 128;
      c.width = sampleSize;
      c.height = sampleSize;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      // Centre de la frame, 128x128 px
      ctx.drawImage(
        v,
        (v.videoWidth - sampleSize) / 2,
        (v.videoHeight - sampleSize) / 2,
        sampleSize,
        sampleSize,
        0,
        0,
        sampleSize,
        sampleSize
      );
      const img = ctx.getImageData(0, 0, sampleSize, sampleSize);
      const pixels = img.data;

      // Grayscale + variance du Laplacien (proxy netteté)
      let sum = 0;
      let sumSq = 0;
      let count = 0;
      const grayBuf = new Float32Array(sampleSize * sampleSize);
      for (let i = 0; i < pixels.length; i += 4) {
        const g =
          0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        grayBuf[i / 4] = g;
        sum += g;
      }
      const avgBrightness = sum / grayBuf.length;

      for (let y = 1; y < sampleSize - 1; y++) {
        for (let x = 1; x < sampleSize - 1; x++) {
          const idx = y * sampleSize + x;
          const lap =
            -4 * grayBuf[idx] +
            grayBuf[idx - 1] +
            grayBuf[idx + 1] +
            grayBuf[idx - sampleSize] +
            grayBuf[idx + sampleSize];
          sumSq += lap * lap;
          count++;
        }
      }
      const variance = sumSq / count;

      // Normalisation empirique : variance 0-2000 → score 0-100
      const sharpness = Math.min(100, Math.round((variance / 2000) * 100));

      // Exposition : 0 = noir, 255 = cramé, 128 optimal
      const exposureDelta = Math.abs(avgBrightness - 128);
      const exposure = Math.max(0, Math.round(100 - (exposureDelta / 128) * 100));

      const resolution =
        (v.videoWidth * v.videoHeight) / 1_000_000; // megapixels

      const score = Math.round(
        sharpness * 0.6 + exposure * 0.2 + Math.min(100, resolution * 20) * 0.2
      );

      let feedback = "";
      if (resolution < MIN_RESOLUTION_MP)
        feedback = "Résolution trop basse. Rapproche-toi du sujet.";
      else if (sharpness < MIN_SHARPNESS)
        feedback = "Image floue. Stabilise l'appareil ou attends la mise au point.";
      else if (exposure < 50)
        feedback = "Exposition incorrecte. Évite contre-jour ou ombre.";
      else feedback = "Qualité OK, tu peux capturer.";

      setQuality({
        resolution: Math.round(resolution * 10) / 10,
        sharpness,
        exposure,
        score,
        isAcceptable:
          resolution >= MIN_RESOLUTION_MP &&
          sharpness >= MIN_SHARPNESS &&
          score >= MIN_SCORE,
        feedback,
      });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  // ── Capture full-res ──────────────────────────────────────
  const capture = useCallback(async (): Promise<CaptureResult | null> => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return null;

    const full = document.createElement("canvas");
    full.width = v.videoWidth;
    full.height = v.videoHeight;
    const ctx = full.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0);

    return new Promise((resolve) => {
      full.toBlob(
        (blob) => {
          if (!blob) return resolve(null);
          const dataUrl = full.toDataURL("image/jpeg", 0.92);
          resolve({
            blob,
            dataUrl,
            width: v.videoWidth,
            height: v.videoHeight,
            quality: { ...quality },
          });
        },
        "image/jpeg",
        0.92
      );
    });
  }, [quality]);

  return {
    videoRef,
    canvasRef,
    isReady,
    error,
    quality,
    start,
    stop,
    capture,
  };
}
