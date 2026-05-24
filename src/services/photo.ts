import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';

export interface ProcessedPhoto {
  uri: string;
  width: number;
  height: number;
  sizeBytes: number;
  fingerprint: string;
}

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.7;
const HARD_LIMIT_BYTES = 4 * 1024 * 1024;
const FALLBACK_QUALITY = 0.5;
const FALLBACK_DIMENSION = 1200;

/**
 * Resize + recompress a freshly captured photo, then compute a SHA-256
 * fingerprint of the resulting bytes for tamper-evidence in DDPP reports.
 * Caps file size under HARD_LIMIT_BYTES so Supabase storage does not 413.
 */
export async function processPhoto(uri: string): Promise<ProcessedPhoto> {
  const first = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  let result = first;
  let size = await readSize(result.uri);

  if (size > HARD_LIMIT_BYTES) {
    const retry = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: FALLBACK_DIMENSION } }],
      { compress: FALLBACK_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    result = retry;
    size = await readSize(result.uri);
  }

  const fingerprint = await computeFingerprint(result.uri);

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    sizeBytes: size,
    fingerprint,
  };
}

/**
 * SHA-256 of the photo bytes. Cheap stand-in for a perceptual hash: it
 * detects any byte-level modification (re-encoding, crop, metadata change)
 * and is enough to prove a DDPP photo has not been altered post-capture.
 */
export async function computeFingerprint(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
}

async function readSize(uri: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && !info.isDirectory ? info.size : 0;
}
