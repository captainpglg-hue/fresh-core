import TextRecognition from '@react-native-ml-kit/text-recognition';

interface TemperatureResult {
  value: number;
  confidence: number;
  rawText: string;
}

/**
 * Calls ML Kit text recognition on an image and returns the raw text.
 */
export async function recognizeText(imageUri: string): Promise<string> {
  const result = await TextRecognition.recognize(imageUri);
  return result.text;
}

/**
 * Extracts a temperature value from raw OCR text.
 * Handles LCD 7-segment misreads, various formats, and scores confidence.
 */
export function extractTemperatureFromText(
  text: string
): TemperatureResult | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Clean common 7-segment LCD misreads
  const cleaned = text
    .replace(/[lI|]/g, '1')
    .replace(/[Oo]/g, '0')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8');

  const patterns: RegExp[] = [
    // Full format: -12.5°C, +4.0°C, 63°C
    /[-+]?\d{1,3}[.,]\d{0,1}\s*[°ºo]\s*[CcFf]/g,
    // With degree but no unit letter: -12.5°, 4.0°
    /[-+]?\d{1,3}[.,]\d{0,1}\s*[°ºo]/g,
    // With unit but flexible: -12.5C, 4.0c
    /[-+]?\d{1,3}[.,]\d{0,1}\s*[CcFf]/g,
    // Bare decimal number in temperature range
    /[-+]?\d{1,3}[.,]\d{0,1}/g,
  ];

  interface Candidate {
    value: number;
    confidence: number;
    rawText: string;
  }

  const candidates: Candidate[] = [];
  const seenValues = new Set<number>();

  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(cleaned)) !== null) {
      const raw = match[0];
      // Extract just the numeric part
      const numericMatch = raw.match(/[-+]?\d{1,3}[.,]?\d{0,1}/);
      if (!numericMatch) continue;

      const value = parseFloat(numericMatch[0].replace(',', '.'));
      if (isNaN(value)) continue;

      // Filter unreasonable temperatures
      if (value < -50 || value > 300) continue;

      if (seenValues.has(value)) continue;
      seenValues.add(value);

      // Confidence scoring
      let confidence = 0.3; // base

      // +0.3 if degree symbol found
      if (/[°ºo]/.test(raw) && !/^[0-9]/.test(raw.replace(/[-+]?\d{1,3}[.,]?\d{0,1}\s*/, ''))) {
        // More careful check for degree symbol (not just letter o in a word)
      }
      if (/[°º]/.test(raw)) {
        confidence += 0.3;
      }

      // +0.2 if C/F unit found
      if (/[°ºo]\s*[CcFf]/.test(raw) || /\d\s*[Cc]$/.test(raw)) {
        confidence += 0.2;
      }

      // +0.2 if value in typical HACCP range (-25 to 100)
      if (value >= -25 && value <= 100) {
        confidence += 0.2;
      }

      confidence = Math.max(0, Math.min(1, confidence));

      candidates.push({ value, confidence, rawText: text });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Return highest confidence match
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates[0];
}

/**
 * Extracts a date from OCR text.
 * Supports DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY formats.
 */
export function extractDateFromText(text: string): Date | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const datePattern = /(\d{2})[/\-.](\d{2})[/\-.](\d{4})/g;
  let match: RegExpExecArray | null;

  while ((match = datePattern.exec(text)) !== null) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    // Basic validation
    if (day < 1 || day > 31) continue;
    if (month < 1 || month > 12) continue;
    if (year < 2000 || year > 2100) continue;

    const date = new Date(year, month - 1, day);

    // Verify the date is valid (handles edge cases like Feb 30)
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
  }

  return null;
}

/**
 * Extracts a lot number from OCR text.
 * Matches patterns like L12345, LOT 12345, LOT: ABC123.
 */
export function extractLotNumber(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // LOT followed by optional separator and alphanumeric content
  const lotPatterns: RegExp[] = [
    /LOT\s*[:\-]?\s*([A-Za-z0-9\-/]+)/gi,
    /\bL(\d{4,})\b/g,
  ];

  for (const pattern of lotPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(text);
    if (match) {
      const lotValue = match[1]?.trim();
      if (lotValue && lotValue.length >= 3) {
        return lotValue;
      }
    }
  }

  return null;
}

/**
 * Full pipeline: extracts temperature from an image URI.
 * Calls ML Kit OCR then parses the result.
 * NEVER crashes — returns null on any error.
 */
export async function extractTemperature(
  imageUri: string
): Promise<TemperatureResult | null> {
  try {
    const rawText = await recognizeText(imageUri);
    return extractTemperatureFromText(rawText);
  } catch (error: unknown) {
    console.warn(
      '[OCR] extractTemperature failed:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
