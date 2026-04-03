import { useState, useCallback } from 'react';
import { extractTemperature } from '../services/ocr';

interface OCRResult {
  value: number;
  confidence: number;
  rawText: string;
}

interface UseCameraReturn {
  isProcessing: boolean;
  lastPhotoUri: string | null;
  ocrResult: OCRResult | null;
  processOCR: (imageUri: string) => Promise<void>;
  resetCamera: () => void;
}

export function useCamera(): UseCameraReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  const processOCR = useCallback(async (imageUri: string): Promise<void> => {
    setIsProcessing(true);
    setLastPhotoUri(imageUri);
    setOcrResult(null);

    try {
      const result = await extractTemperature(imageUri);
      setOcrResult(result);
    } catch {
      setOcrResult(null);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const resetCamera = useCallback(() => {
    setIsProcessing(false);
    setLastPhotoUri(null);
    setOcrResult(null);
  }, []);

  return {
    isProcessing,
    lastPhotoUri,
    ocrResult,
    processOCR,
    resetCamera,
  };
}
