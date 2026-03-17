import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { UploadService } from '../../core/upload/upload.service';
import { UploadResponse } from '../../shared/models/upload-response.model';

@Component({
  selector: 'app-upload-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatProgressBarModule,
    MatToolbarModule,
  ],
  template: `
    <mat-toolbar class="topbar">
      <div class="topbar__brand">
        <div class="topbar__logo">
          @if (showBrandLogo()) {
            <img [src]="brandLogoUrl" [alt]="'Logo ' + clientName" (error)="hideBrandLogo()" />
          } @else {
            <span class="material-symbols-outlined">credit_card</span>
          }
        </div>
        <div>
          <p class="topbar__client">{{ clientName }}</p>
          <p class="topbar__app">{{ appName }}</p>
        </div>
      </div>

      <div class="topbar__user">
        <span class="user-name">{{ displayName() }}</span>
        <button mat-stroked-button class="logout-button" type="button" (click)="logout()">
          <span class="material-symbols-outlined button-icon">logout</span>
          <span class="logout-button__label">Se deconnecter</span>
        </button>
      </div>
    </mat-toolbar>

    <main class="upload-page">
      <mat-card class="upload-card" appearance="outlined">
        <div class="header">
          <div class="header__copy">
            <p class="eyebrow">Depot mobile</p>
            <h1>Envoi du cheque</h1>
            <p class="header-subtitle">
              Prenez une photo nette du cheque seul, sur un fond distinct, sans autres feuilles ni
              ecritures. Cadrez-le bien et gardez l'image droite.
            </p>
          </div>
          <div class="header__brand">
            <div class="header__logo">
              @if (showBrandLogo()) {
                <img [src]="brandLogoUrl" [alt]="'Logo ' + clientName" (error)="hideBrandLogo()" />
              } @else {
                <span class="material-symbols-outlined">credit_card</span>
              }
            </div>
            <p class="header__client">{{ clientName }}</p>
          </div>
        </div>

        @if (!backendConfigured()) {
          <section class="status-box warning">
            L'URL de la Google Cloud Function n'est pas configuree dans l'environnement Angular.
          </section>
        }

        @if (errorMessage()) {
          <section class="status-box error">
            {{ errorMessage() }}
          </section>
        }

        @if (cameraError()) {
          <section class="status-box warning">
            {{ cameraError() }}
          </section>
        }

        @if (uploadSuccess()) {
          <section class="status-box success">
            <strong>Upload effectue avec succes.</strong>
          </section>
        }

        <div class="actions">
          <input
            #fileInput
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            (change)="onFileSelected($event)"
          />

          <button mat-stroked-button type="button" (click)="openPicker(fileInput)">
            <span class="material-symbols-outlined button-icon">image</span>
            Choisir une photo
          </button>

          <button
            mat-stroked-button
            type="button"
            [disabled]="isStartingCamera()"
            (click)="openCamera()"
          >
            <span class="material-symbols-outlined button-icon">photo_camera</span>
            @if (isStartingCamera()) {
              Ouverture de la camera...
            } @else {
              Prendre une photo
            }
          </button>

          @if (selectedFileName()) {
            <button mat-button type="button" (click)="clearSelection(fileInput)">
              <span class="material-symbols-outlined button-icon">delete</span>
              Supprimer
            </button>
          }
        </div>

        @if (isCameraOpen()) {
          <section class="camera-panel">
            <div class="camera-preview">
              <video #cameraVideo autoplay playsinline muted></video>
            </div>

            <div class="camera-actions">
              <button mat-flat-button color="primary" type="button" (click)="capturePhoto()">
                <span class="material-symbols-outlined button-icon">photo_camera</span>
                Capturer
              </button>

              <button mat-button type="button" (click)="closeCamera()">
                <span class="material-symbols-outlined button-icon">close</span>
                Fermer la camera
              </button>
            </div>
          </section>
        }

        @if (selectedFileName()) {
          <div class="file-meta">
            <span class="material-symbols-outlined">image</span>
            <div>
              <strong>{{ selectedFileName() }}</strong>
              <p>{{ selectedFileSizeLabel() }}</p>
            </div>
          </div>
        }

        @if (previewUrl()) {
          <div class="preview">
            <img [src]="previewUrl()" alt="Apercu du cheque selectionne" />
          </div>
        } @else {
          <div class="empty-state">
            <span class="material-symbols-outlined">gallery_thumbnail</span>
            <p>Aucune image selectionnee pour le moment.</p>
          </div>
        }

        <mat-divider></mat-divider>

        @if (isUploading()) {
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        }

        <div class="footer">
          <p class="helper-text">
            Formats acceptes: JPEG, PNG, WEBP, HEIC, HEIF. Taille max: {{ maxFileSizeMb }} Mo.
          </p>
          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="!canSubmit()"
            (click)="submit()"
          >
            <span class="material-symbols-outlined button-icon">send</span>
            Envoyer
          </button>
        </div>
      </mat-card>
    </main>
  `,
  styleUrl: './upload-page.component.scss',
})
export class UploadPageComponent implements OnDestroy {
  @ViewChild('cameraVideo') private cameraVideo?: ElementRef<HTMLVideoElement>;

  protected readonly appName = environment.appName;
  protected readonly clientName = environment.brand.clientName;
  protected readonly brandLogoUrl = environment.brand.logoPath;
  protected readonly maxFileSizeMb = environment.upload.maxFileSizeMb;
  protected readonly authService = inject(AuthService);
  private readonly uploadService = inject(UploadService);
  private readonly router = inject(Router);

  protected readonly backendConfigured = signal(Boolean(environment.backend.uploadUrl));
  protected readonly cameraSupported = signal(this.isCameraApiSupported());
  protected readonly isCameraOpen = signal(false);
  protected readonly isStartingCamera = signal(false);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly uploadSuccess = signal<UploadResponse | null>(null);
  protected readonly isUploading = signal(false);
  protected readonly showBrandLogo = signal(Boolean(this.brandLogoUrl));
  protected readonly displayName = computed(() => this.authService.username() || 'Utilisateur');
  protected readonly selectedFileName = computed(() => this.selectedFile()?.name ?? '');
  protected readonly selectedFileSizeLabel = computed(() => {
    const file = this.selectedFile();

    if (!file) {
      return '';
    }

    return `${(file.size / 1024 / 1024).toFixed(2)} Mo`;
  });
  protected readonly canSubmit = computed(
    () => !!this.selectedFile() && !this.isUploading() && this.backendConfigured(),
  );
  private mediaStream: MediaStream | null = null;

  ngOnDestroy(): void {
    this.stopCameraStream();
    this.revokePreviewUrl();
  }

  protected openPicker(fileInput: HTMLInputElement): void {
    console.info('[UploadPage] Opening file picker.');
    this.cameraError.set(null);
    fileInput.click();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.errorMessage.set(null);
    this.uploadSuccess.set(null);

    if (!file) {
      console.info('[UploadPage] No file selected.');
      return;
    }

    this.applySelectedFile(file);
  }

  protected clearSelection(fileInput: HTMLInputElement): void {
    console.info('[UploadPage] Clearing current file selection.');
    fileInput.value = '';
    this.selectedFile.set(null);
    this.errorMessage.set(null);
    this.uploadSuccess.set(null);
    this.revokePreviewUrl();
  }

  protected async openCamera(): Promise<void> {
    this.errorMessage.set(null);
    this.uploadSuccess.set(null);
    this.cameraError.set(null);

    if (!this.cameraSupported()) {
      console.warn('[UploadPage] Camera API is not supported in this browser.');
      this.cameraError.set("La camera n'est pas supportee par ce navigateur.");
      return;
    }

    if (this.isStartingCamera()) {
      return;
    }

    this.isStartingCamera.set(true);
    this.stopCameraStream();

    try {
      console.info('[UploadPage] Requesting camera access.');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      this.mediaStream = stream;
      this.isCameraOpen.set(true);

      await this.waitForCameraView();

      const videoElement = this.cameraVideo?.nativeElement;

      if (!videoElement) {
        throw new Error("Le flux video n'a pas pu etre initialise.");
      }

      videoElement.srcObject = stream;
      await videoElement.play();

      console.info('[UploadPage] Camera stream started.');
    } catch (error) {
      console.error('[UploadPage] Unable to start camera.', { error });
      this.cameraError.set(this.toCameraMessage(error));
      this.isCameraOpen.set(false);
      this.stopCameraStream();
    } finally {
      this.isStartingCamera.set(false);
    }
  }

  protected closeCamera(): void {
    console.info('[UploadPage] Closing camera stream.');
    this.cameraError.set(null);
    this.stopCameraStream();
  }

  protected async capturePhoto(): Promise<void> {
    const videoElement = this.cameraVideo?.nativeElement;

    if (!videoElement || !this.mediaStream) {
      console.warn('[UploadPage] Capture ignored because camera is not ready.');
      this.cameraError.set("La camera n'est pas prete.");
      return;
    }

    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      console.warn('[UploadPage] Capture ignored because video dimensions are missing.');
      this.cameraError.set("L'image de la camera n'est pas encore disponible.");
      return;
    }

    try {
      console.info('[UploadPage] Capturing photo from camera stream.');
      const file = await this.createFileFromVideo(videoElement);
      this.applySelectedFile(file);
      this.closeCamera();
    } catch (error) {
      console.error('[UploadPage] Capture failed.', { error });
      this.cameraError.set(this.toCameraMessage(error));
    }
  }

  protected async submit(): Promise<void> {
    const file = this.selectedFile();

    if (!file || this.isUploading()) {
      console.warn('[UploadPage] Submit ignored.', {
        hasFile: !!file,
        isUploading: this.isUploading(),
      });
      return;
    }

    this.errorMessage.set(null);
    this.uploadSuccess.set(null);
    this.isUploading.set(true);

    console.info('[UploadPage] Starting submit flow.', {
      name: file.name,
      size: file.size,
    });

    try {
      const response = await firstValueFrom(this.uploadService.uploadCheque(file));
      console.info('[UploadPage] Submit flow succeeded.', {
        fileId: response.fileId,
        storagePath: response.storagePath,
      });
      this.uploadSuccess.set(response);
    } catch (error) {
      console.error('[UploadPage] Submit flow failed.', { error });
      this.errorMessage.set(this.toMessage(error));
    } finally {
      console.info('[UploadPage] Submit flow finished.');
      this.isUploading.set(false);
    }
  }

  protected async logout(): Promise<void> {
    console.info('[UploadPage] Logout requested.');
    this.authService.logout();
    await this.router.navigateByUrl('/login');
  }

  protected hideBrandLogo(): void {
    this.showBrandLogo.set(false);
  }

  private revokePreviewUrl(): void {
    const url = this.previewUrl();

    if (url) {
      URL.revokeObjectURL(url);
      this.previewUrl.set(null);
    }
  }

  private applySelectedFile(file: File): void {
    console.info('[UploadPage] File ready for preview/upload.', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (this.mediaStream) {
      this.stopCameraStream();
    }

    const validationError = this.uploadService.validateFile(file);

    if (validationError) {
      console.warn('[UploadPage] Selected file failed validation.', {
        name: file.name,
        validationError,
      });
      this.selectedFile.set(null);
      this.revokePreviewUrl();
      this.errorMessage.set(validationError);
      return;
    }

    this.selectedFile.set(file);
    this.cameraError.set(null);
    this.revokePreviewUrl();
    this.previewUrl.set(URL.createObjectURL(file));
  }

  private async createFileFromVideo(videoElement: HTMLVideoElement): Promise<File> {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error("Le canvas de capture n'a pas pu etre initialise.");
    }

    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) {
          resolve(value);
          return;
        }

        reject(new Error("La capture photo a echoue."));
      }, 'image/jpeg', 0.92);
    });

    return new File([blob], `cheque-${Date.now()}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  }

  private stopCameraStream(): void {
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;

    const videoElement = this.cameraVideo?.nativeElement;

    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
    }

    this.isCameraOpen.set(false);
  }

  private async waitForCameraView(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  private isCameraApiSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  private toCameraMessage(error: unknown): string {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          return "L'acces a la camera a ete refuse. Autorisez la camera dans le navigateur.";
        case 'NotFoundError':
          return "Aucune camera n'a ete detectee sur cet appareil.";
        case 'NotReadableError':
          return "La camera est deja utilisee par une autre application.";
        default:
          return error.message || "Impossible d'ouvrir la camera.";
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "Impossible d'ouvrir la camera.";
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "L'envoi a echoue. Veuillez reessayer.";
  }
}
