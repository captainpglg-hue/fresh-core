jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: {
    recognize: jest.fn(),
  },
}));

import TextRecognition from '@react-native-ml-kit/text-recognition';
import { extractTemperature } from './ocr';

const mockRecognize = TextRecognition.recognize as jest.Mock;

describe('extractTemperature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extracts temperature from text "3.2°C"', async () => {
    mockRecognize.mockResolvedValueOnce({ text: '3.2°C' });

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(3.2);
    expect(result!.rawText).toBe('3.2°C');
  });

  it('extracts negative temperature from text "-18.5"', async () => {
    mockRecognize.mockResolvedValueOnce({ text: '-18.5' });

    const result = await extractTemperature('file:///photo.jpg');
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

  it('handles comma decimal separator "4,5°C"', async () => {
    mockRecognize.mockResolvedValueOnce({ text: '4,5°C' });

    const result = await extractTemperature('file:///photo.jpg');
    expect(result).not.toBeNull();
    expect(result!.value).toBe(4.5);
  });
});
