import type { OCRResult } from '../store/landSlice';

export function isUsableLandRecord(value: unknown): value is OCRResult {
  const record = value as OCRResult | null;
  return Boolean(
    record &&
      [
        'survey_number',
        'owner_name',
        'village',
        'taluka',
        'district',
        'state',
      ].every(
        key =>
          typeof record[key as keyof OCRResult] === 'string' &&
          String(record[key as keyof OCRResult]).trim().length > 0,
      ),
  );
}
