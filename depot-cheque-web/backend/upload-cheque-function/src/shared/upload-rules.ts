export const UPLOAD_MAX_FILE_SIZE_MB = 10;
export const UPLOAD_MAX_FILE_SIZE_BYTES = UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;

export const UPLOAD_ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export const REGISTRATION_NUMBER_REQUIRED_MESSAGE =
  "Le numero d'immatriculation est obligatoire.";
export const REGISTRATION_NUMBER_FORMAT_MESSAGE =
  "Le numero d'immatriculation doit respecter le format AB123CD ou 1234AB56.";
export const UPLOAD_UNSUPPORTED_FILE_MESSAGE =
  'Format non supporte. Utilisez une image JPEG, PNG, WEBP, HEIC ou HEIF.';

const acceptedMimeTypeSet = new Set(UPLOAD_ACCEPTED_MIME_TYPES);
const mimeTypeAliases = new Map<string, string>([
  ['image/jpg', 'image/jpeg'],
  ['image/pjpeg', 'image/jpeg'],
]);
const mimeTypeByExtension = new Map<string, string>([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['heic', 'image/heic'],
  ['heif', 'image/heif'],
]);
const registrationNumberPattern = /^(?:[A-Z]{2}\d{3}[A-Z]{2}|\d{4}[A-Z]{2}\d{2})$/;

export function normalizeRegistrationNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

export function getRegistrationNumberValidationMessage(value: string): string | null {
  const normalizedValue = normalizeRegistrationNumber(value);

  if (!normalizedValue) {
    return REGISTRATION_NUMBER_REQUIRED_MESSAGE;
  }

  if (!registrationNumberPattern.test(normalizedValue)) {
    return REGISTRATION_NUMBER_FORMAT_MESSAGE;
  }

  return null;
}

export function normalizeUploadMimeType(file: Pick<File, 'name' | 'type'>): string {
  const rawMimeType = file.type.trim().toLowerCase();

  if (acceptedMimeTypeSet.has(rawMimeType)) {
    return rawMimeType;
  }

  const aliasedMimeType = mimeTypeAliases.get(rawMimeType);

  if (aliasedMimeType) {
    return aliasedMimeType;
  }

  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  const inferredMimeType = mimeTypeByExtension.get(extension);

  if ((rawMimeType === '' || rawMimeType === 'application/octet-stream') && inferredMimeType) {
    return inferredMimeType;
  }

  return rawMimeType;
}

export function isAllowedUploadMimeType(mimeType: string): boolean {
  return acceptedMimeTypeSet.has(mimeType);
}

export function getUploadSizeExceededMessage(
  maxFileSizeMb: number = UPLOAD_MAX_FILE_SIZE_MB,
): string {
  return `Le fichier depasse la limite de ${maxFileSizeMb} Mo.`;
}

export function getUploadFileValidationMessage(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  const normalizedMimeType = normalizeUploadMimeType(file);

  if (!normalizedMimeType || !isAllowedUploadMimeType(normalizedMimeType)) {
    return UPLOAD_UNSUPPORTED_FILE_MESSAGE;
  }

  if (file.size > UPLOAD_MAX_FILE_SIZE_BYTES) {
    return getUploadSizeExceededMessage();
  }

  return null;
}

export function extensionForMimeType(mimeType: string): string | null {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return null;
  }
}

export function extensionForUpload(file: Pick<File, 'name'>, normalizedMimeType: string): string {
  const originalExtension = file.name.split('.').at(-1)?.toLowerCase() ?? '';

  if (originalExtension && mimeTypeByExtension.has(originalExtension)) {
    return originalExtension;
  }

  return extensionForMimeType(normalizedMimeType) ?? 'jpg';
}

/**
 * Formato data-ora leggibile per il nome file: YYYY-MM-DD_HH-mm-ss (UTC)
 * Es: 2026-03-19_00-15-30
 */
export function formatTimestampForFilename(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}-${m}-${d}_${h}-${min}-${s}`;
}
