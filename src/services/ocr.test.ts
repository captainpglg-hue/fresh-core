jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: {
    recognize: jest.fn(),
  },
}));

import TextRecognition from '@react-native-ml-kit/text-recognition';
import { extractTemperature, extractTemperatureFromText } from './ocr';

const mockRecognize = TextRecognition.recognize as jest.Mock;

describe('extractTemperature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Parsing pur : on teste extractTemperatureFromText directement.
  // extractTemperature passe par recognizeText → await import() du module
  // natif ML Kit, indisponible sous jest (Node CJS). La logique de parsing
  // est identique ; seul le wrapper I/O diffère (couvert par les cas null/erreur).
  it('extracts temperature from text "3.2°C"', () => {
    const result = extractTemperatureFromText('3.2°C');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(3.2);
    expect(result!.rawText).toBe('3.2°C');
  });

  it('extracts negative temperature from text "-18.5"', () => {
    const result = extractTemperatureFromText('-18.5');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(-18.5);
  });

  it('returns null when text has no numbers', async () => {
    mockRecognize.mockResolvedValueOnce({ text: 'no numbers here' });

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).toBeNull();
  });

  it('returns null on empty text', async () => {
    mockRecognize.mockResolvedValueOnce({ text: '' });

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).toBeNull();
  });

  it('returns null on OCR error', async () => {
    mockRecognize.mockRejectedValueOnce(new Error('Camera error'));

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).toBeNull();
  });

  it('handles comma decimal separator "4,5°C"', () => {
    const result = extractTemperatureFromText('4,5°C');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(4.5);
  });
});
