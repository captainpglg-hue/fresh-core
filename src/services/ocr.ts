import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { OCRResult } from '../types/api';

/**
 * Regex patterns to extract temperature values from OCR text.
 * Handles LCD 7-segment displays, negative values, and common OCR artifacts.
 */
const TEMPERATURE_PATTERNS: RegExp[] = [
  // Standard: -12.5°C, 4.0°C, 63°C
  /(-?\d{1,3}[.,]\d{1,2})\s*[°ºo]?\s*[CcFf]?/g,
  // No decimal: -18°C, 4°C
  /(-?\d{1,3})\s*[°ºo]\s*[CcFf]?/g,
  // Just a number with degree sign
  /(-?\d{1,3}[.,]?\d{0,2})\s*[°ºo]/g,
  // Bare number (lowest confidence) - matches typical temperature ranges
  /(-?\d{1,3}[.,]\d{1,2})/g,
];

/**
 * Extracts a temperature reading from an image using on-device ML Kit OCR.
 * Returns the best candidate with confidence score, or null if nothing found.
 */
export async function extractTemperature(imageUri: string): Promise<OCRResult | null> {
  try {
    const result = await TextRecognition.recognize(imageUri);
    const rawText = result.text;

    if (!rawText || rawText.trim().length === 0) {
      return null;
    }

    const candidates = parseTemperatureCandidates(rawText);

    if (candidates.length === 0) {
      return null;
    }

    // Sort by confidence descending and return best match
    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];

    return {
      value: best.value,
      confidence: best.confidence,
      rawText,
    };
  } catch (error: unknown) {
    console.warn('[OCR] Text recognition failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

interface TemperatureCandidate {
  value: number;
  confidence: number;
}

function parseTemperatureCandidates(text: string): TemperatureCandidate[] {
  const candidates: TemperatureCandidate[] = [];
  const seenValues = new Set<number>();

  // Clean up common OCR artifacts
  const cleaned = text
    .replace(/[lI|]/g, '1')   // Common LCD misreads
    .replace(/[Oo]/g, '0')    // O mistaken for 0
    .replace(/[Ss]/g, '5')    // S mistaken for 5
    .replace(/,/g, '.');       // Normalize decimal separator

  for (let patternIndex = 0; patternIndex < TEMPERATURE_PATTERNS.length; patternIndex++) {
    const pattern = new RegExp(TEMPERATURE_PATTERNS[patternIndex].source, 'g');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(cleaned)) !== null) {
      const raw = match[1];
      if (!raw) continue;

      const value = parseFloat(raw.replace(',', '.'));
      if (isNaN(value)) continue;

      // Filter out unreasonable temperature values
      if (value < -50 || value > 300) continue;

      if (seenValues.has(value)) continue;
      seenValues.add(value);

      // Compute confidence based on pattern quality and value range
      let confidence = computeConfidence(value, patternIndex, text, match[0]);
      // Clamp to [0, 1]
      confidence = Math.max(0, Math.min(1, confidence));

      candidates.push({ value, confidence });
    }
  }

  return candidates;
}

function computeConfidence(
  value: number,
  patternIndex: number,
  originalText: string,
  matchedString: string,
): number {
  let confidence = 0.5;

  // Higher confidence for patterns with degree symbol
  if (patternIndex === 0) confidence += 0.3;
  else if (patternIndex === 1) confidence += 0.25;
  else if (patternIndex === 2) confidence += 0.2;
  // patternIndex === 3 (bare number) gets no bonus

  // Boost for presence of C/F unit
  if (/[°ºo]\s*[Cc]/.test(matchedString)) confidence += 0.1;

  // Boost for values in typical HACCP ranges
  if ((value >= -25 && value <= 10) || (value >= 60 && value <= 100)) {
    confidence += 0.1;
  }

  // Penalty if the original text is very noisy
  const alphaRatio = (originalText.match(/[a-zA-Z]/g)?.length ?? 0) / originalText.length;
  if (alphaRatio > 0.5) confidence -= 0.1;

  return confidence;
}
