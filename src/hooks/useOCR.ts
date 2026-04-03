import { useState, useCallback } from 'react';
import { extractTemperature } from '../services/ocr';
import type { OCRResult } from '../types/api';

interface UseOCRState {
  isProcessing: boolean;
  result: OCRResult | null;
  error: string | null;
}

export const useOCR = () => {
  const [state, setState] = useState<UseOCRState>({
    isProcessing: false,
    result: null,
    error: null,
  });

  const processImage = useCallback(async (uri: string) => {
    setState({ isProcessing: true, result: null, error: null });

    try {
      const ocrResult = await extractTemperature(uri);
      setState({ isProcessing: false, result: ocrResult, error: null });
      return ocrResult;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erreur OCR inconnue';
      setState({ isProcessing: false, result: null, error: message });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ isProcessing: false, result: null, error: null });
  }, []);

  return {
    isProcessing: state.isProcessing,
    result: state.result,
    error: state.error,
    processImage,
    reset,
  };
};
