import { randomUUID } from 'node:crypto';
import { HttpFunction, http } from '@google-cloud/functions-framework';
import { Storage } from '@google-cloud/storage';
import Busboy from 'busboy';
import cors from 'cors';

const storage = new Storage();
const maxFileSizeBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsMiddleware = cors({
  origin: allowedOrigins.length === 0 ? true : allowedOrigins,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
});

interface UploadedImage {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function runCors(req: Parameters<typeof corsMiddleware>[0], res: Parameters<typeof corsMiddleware>[1]) {
  return new Promise<void>((resolve, reject) => {
    corsMiddleware(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new HttpError(500, `La variable d'environnement ${name} est manquante.`);
  }

  return value;
}

function readAction(value: unknown): 'auth-check' | 'upload' {
  return value === 'auth-check' ? 'auth-check' : 'upload';
}

function readBasicCredentials(authorizationHeader?: string) {
  if (!authorizationHeader?.startsWith('Basic ')) {
    throw new HttpError(401, 'Identifiants manquants.');
  }

  const encodedValue = authorizationHeader.slice('Basic '.length);
  const decodedValue = Buffer.from(encodedValue, 'base64').toString('utf8');
  const separatorIndex = decodedValue.indexOf(':');

  if (separatorIndex <= 0) {
    throw new HttpError(401, "Format d'authentification invalide.");
  }

  return {
    username: decodedValue.slice(0, separatorIndex),
    password: decodedValue.slice(separatorIndex + 1),
  };
}

function verifySharedCredentials(authorizationHeader?: string): string {
  const expectedUsername = getRequiredEnv('SHARED_USERNAME');
  const expectedPassword = getRequiredEnv('SHARED_PASSWORD');
  const { username, password } = readBasicCredentials(authorizationHeader);

  if (username !== expectedUsername || password !== expectedPassword) {
    console.warn('[uploadCheque] Invalid shared credentials.', {
      providedUsername: username,
    });
    throw new HttpError(401, 'Identifiant ou mot de passe incorrect.');
  }

  return username;
}

function extensionForMimeType(mimeType: string): string {
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
      throw new HttpError(400, 'Type de fichier non supporte.');
  }
}

function readUploadedImage(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
  return new Promise<UploadedImage>((resolve, reject) => {
    const busboy = Busboy({
      headers,
      limits: {
        files: 1,
        fileSize: maxFileSizeBytes,
      },
    });

    let upload: UploadedImage | null = null;
    let aborted = false;

    busboy.on('file', (fieldname, file, info) => {
      if (fieldname !== 'image') {
        file.resume();
        return;
      }

      if (!allowedMimeTypes.has(info.mimeType)) {
        aborted = true;
        reject(new HttpError(400, "Le type MIME du fichier n'est pas autorise."));
        file.resume();
        return;
      }

      const chunks: Buffer[] = [];

      file.on('data', (chunk: Buffer) => chunks.push(chunk));
      file.on('limit', () => {
        aborted = true;
        reject(new HttpError(413, 'Le fichier depasse la taille maximale autorisee.'));
      });
      file.on('end', () => {
        if (aborted) {
          return;
        }

        upload = {
          buffer: Buffer.concat(chunks),
          filename: info.filename,
          mimeType: info.mimeType,
        };
      });
    });

    busboy.on('finish', () => {
      if (aborted) {
        return;
      }

      if (!upload) {
        reject(new HttpError(400, "Aucun fichier image n'a ete transmis."));
        return;
      }

      resolve(upload);
    });

    busboy.on('error', (error) => reject(error));
    busboy.end(rawBody);
  });
}

function sanitizePathSegment(value: string): string {
  const normalizedValue = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalizedValue || 'shared-user';
}

const uploadCheque: HttpFunction = async (req, res) => {
  try {
    console.info('[uploadCheque] Incoming request.', {
      method: req.method,
      action: req.query.action ?? 'upload',
      origin: req.headers.origin ?? null,
      hasAuthorizationHeader: Boolean(req.headers.authorization),
    });

    await runCors(req, res);

    if (req.method === 'OPTIONS') {
      console.info('[uploadCheque] CORS preflight handled.');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      throw new HttpError(405, 'Methode non autorisee.');
    }

    const action = readAction(req.query.action);
    const username = verifySharedCredentials(req.headers.authorization);

    console.info('[uploadCheque] Credentials accepted.', {
      action,
      username,
    });

    if (action === 'auth-check') {
      console.info('[uploadCheque] Auth check succeeded.', {
        username,
      });
      res.status(200).json({
        authenticated: true,
        username,
      });
      return;
    }

    const bucketName = getRequiredEnv('GCS_BUCKET_NAME');
    const image = await readUploadedImage(req.rawBody ?? Buffer.from([]), req.headers);
    const extension = extensionForMimeType(image.mimeType);
    const uploadedAt = new Date().toISOString();
    const fileId = `${Date.now()}-${randomUUID()}.${extension}`;
    const storagePath = `cheques/${sanitizePathSegment(username)}/${fileId}`;
    const file = storage.bucket(bucketName).file(storagePath);

    console.info('[uploadCheque] Upload accepted.', {
      username,
      filename: image.filename,
      mimeType: image.mimeType,
      size: image.buffer.length,
      storagePath,
    });

    await file.save(image.buffer, {
      resumable: false,
      contentType: image.mimeType,
      metadata: {
        metadata: {
          originalFilename: image.filename,
          uploadedAt,
          uploadedBy: username,
        },
      },
    });

    console.info('[uploadCheque] File saved to bucket.', {
      bucketName,
      storagePath,
      username,
    });

    res.status(201).json({
      fileId,
      bucket: bucketName,
      storagePath,
      gsUri: `gs://${bucketName}/${storagePath}`,
      contentType: image.mimeType,
      uploadedAt,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      console.error('[uploadCheque] Request failed with handled error.', {
        statusCode: error.statusCode,
        message: error.message,
      });
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error('[uploadCheque] Request failed with unexpected error.', error);
    res.status(500).json({ error: 'Une erreur interne est survenue.' });
  }
};

http('uploadCheque', uploadCheque);

export { uploadCheque };
