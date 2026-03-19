import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import {
  extensionForUpload,
  formatTimestampForFilename,
  getRegistrationNumberValidationMessage,
  getUploadFileValidationMessage,
  normalizeRegistrationNumber,
  normalizeUploadMimeType,
} from '../../../../backend/upload-cheque-function/src/shared/upload-rules';
import { environment } from '../../../environments/environment';
import { UploadResponse } from '../../shared/models/upload-response.model';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);

  validateFile(file: File): string | null {
    const validationError = getUploadFileValidationMessage(file);

    if (!validationError) {
      return null;
    }

    console.warn('[UploadService] File rejected by validation rules.', {
      name: file.name,
      type: file.type,
      size: file.size,
      validationError,
    });
    return validationError;
  }

  uploadCheque(file: File, registrationNumber: string): Observable<UploadResponse> {
    const validationError = this.validateFile(file);
    const registrationNumberError = getRegistrationNumberValidationMessage(registrationNumber);

    if (validationError) {
      console.error('[UploadService] Upload blocked by validation error.', {
        name: file.name,
        validationError,
      });
      return throwError(() => new Error(validationError));
    }

    if (registrationNumberError) {
      console.error('[UploadService] Upload blocked by registration number validation.', {
        name: file.name,
        registrationNumber,
        registrationNumberError,
      });
      return throwError(() => new Error(registrationNumberError));
    }

    if (!environment.backend.uploadUrl) {
      console.error('[UploadService] Upload URL is not configured.');
      return throwError(() => new Error("L'URL du backend n'est pas configuree."));
    }

    const normalizedRegistrationNumber = normalizeRegistrationNumber(registrationNumber);
    const uploadFile = this.createUploadFile(file, normalizedRegistrationNumber);

    console.info('[UploadService] Starting upload request.', {
      name: uploadFile.name,
      type: uploadFile.type,
      size: uploadFile.size,
      registrationNumber: normalizedRegistrationNumber,
      uploadUrl: environment.backend.uploadUrl,
    });

    const formData = new FormData();
    formData.append('image', uploadFile, uploadFile.name);
    formData.append('registrationNumber', normalizedRegistrationNumber);

    return this.http.post<UploadResponse>(environment.backend.uploadUrl, formData).pipe(
      tap((response) => {
        console.info('[UploadService] Upload request succeeded.', {
          fileId: response.fileId,
          storagePath: response.storagePath,
        });
      }),
      catchError((error) => {
        console.error('[UploadService] Upload request failed.', {
          name: uploadFile.name,
          registrationNumber: normalizedRegistrationNumber,
          error,
        });
        return throwError(() => error);
      }),
    );
  }

  private createUploadFile(file: File, registrationNumber: string): File {
    const normalizedMimeType = normalizeUploadMimeType(file);
    const extension = extensionForUpload(file, normalizedMimeType);

    const timestamp = formatTimestampForFilename(new Date());
    return new File([file], `${registrationNumber}_${timestamp}.${extension}`, {
      type: normalizedMimeType || file.type,
      lastModified: Date.now(),
    });
  }
}
