import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UploadResponse } from '../../shared/models/upload-response.model';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);
  private readonly maxFileSizeBytes = environment.upload.maxFileSizeMb * 1024 * 1024;

  validateFile(file: File): string | null {
    if (!environment.upload.acceptedMimeTypes.includes(file.type)) {
      console.warn('[UploadService] File rejected because mime type is not allowed.', {
        name: file.name,
        type: file.type,
      });
      return 'Format non supporte. Utilisez une image JPEG, PNG, WEBP, HEIC ou HEIF.';
    }

    if (file.size > this.maxFileSizeBytes) {
      console.warn('[UploadService] File rejected because it is too large.', {
        name: file.name,
        size: file.size,
        maxFileSizeBytes: this.maxFileSizeBytes,
      });
      return `Le fichier depasse la limite de ${environment.upload.maxFileSizeMb} Mo.`;
    }

    return null;
  }

  uploadCheque(file: File): Observable<UploadResponse> {
    const validationError = this.validateFile(file);

    if (validationError) {
      console.error('[UploadService] Upload blocked by validation error.', {
        name: file.name,
        validationError,
      });
      return throwError(() => new Error(validationError));
    }

    if (!environment.backend.uploadUrl) {
      console.error('[UploadService] Upload URL is not configured.');
      return throwError(() => new Error("L'URL du backend n'est pas configuree."));
    }

    console.info('[UploadService] Starting upload request.', {
      name: file.name,
      type: file.type,
      size: file.size,
      uploadUrl: environment.backend.uploadUrl,
    });

    const formData = new FormData();
    formData.append('image', file, file.name);

    return this.http.post<UploadResponse>(environment.backend.uploadUrl, formData).pipe(
      tap((response) => {
        console.info('[UploadService] Upload request succeeded.', {
          fileId: response.fileId,
          storagePath: response.storagePath,
        });
      }),
      catchError((error) => {
        console.error('[UploadService] Upload request failed.', {
          name: file.name,
          error,
        });
        return throwError(() => error);
      }),
    );
  }
}
