jest.mock('./ocrEngine', () => ({
  recognizeText: jest.fn(),
}));

import { recognizeText } from './ocrEngine';
import { extractTemperature } from './ocr';

const mockRecognize = recognizeText as jest.Mock;

describe('extractTemperature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extracts temperature from text "3.2°C"', async () => {
    mockRecognize.mockResolvedValueOnce('3.2°C');

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(3.2);
    expect(result!.rawText).toBe('3.2°C');
  });

  it('extracts negative temperature from text "-18.5"', async () => {
    mockRecognize.mockResolvedValueOnce('-18.5');

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(-18.5);
  });

  it('returns null when text has no numbers', async () => {
    mockRecognize.mockResolvedValueOnce('no numbers here');

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).toBeNull();
  });

  it('returns null on empty text', async () => {
    mockRecognize.mockResolvedValueOnce('');

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).toBeNull();
  });

  it('returns null on OCR error', async () => {
    mockRecognize.mockRejectedValueOnce(new Error('Camera error'));

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).toBeNull();
  });

  it('handles comma decimal separator "4,5°C"', async () => {
    mockRecognize.mockResolvedValueOnce('4,5°C');

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(4.5);
  });
});
