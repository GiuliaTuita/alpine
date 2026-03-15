import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <main class="login-page">
      <mat-card class="login-card" appearance="outlined">
        <div class="hero">
          <span class="hero-icon material-symbols-outlined">credit_card</span>
          <div>
            <p class="eyebrow">{{ appName }}</p>
            <h1>Depot de cheque simplifie</h1>
            <p class="subtitle">
              Saisissez l'identifiant partage et le mot de passe commun pour acceder a l'envoi.
            </p>
          </div>
        </div>

        <div class="feature-list">
          <div class="feature-item">
            <span class="material-symbols-outlined">lock</span>
            <span>Acces reserve aux personnes autorisees via identifiant partage</span>
          </div>
        </div>

        @if (!authService.configured()) {
          <section class="warning-box">
            <strong>Configuration requise</strong>
            <p>
              Completez les URLs backend dans <code>src/environments</code> avant de vous connecter.
            </p>
          </section>
        }

        @if (errorMessage()) {
          <section class="error-box">
            {{ errorMessage() }}
          </section>
        }

        <form class="login-form" [formGroup]="form" (ngSubmit)="login()">
          <mat-form-field appearance="outline">
            <mat-label>Identifiant</mat-label>
            <input matInput type="text" formControlName="username" autocomplete="username" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Mot de passe</mat-label>
            <input
              matInput
              type="password"
              formControlName="password"
              autocomplete="current-password"
            />
          </mat-form-field>

          <button
            mat-flat-button
            class="login-button"
            type="submit"
            [disabled]="form.invalid || isSubmitting() || !authService.configured()"
          >
            @if (isSubmitting()) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <span class="material-symbols-outlined button-icon">login</span>
            }
            <span>Se connecter</span>
          </button>
        </form>
      </mat-card>
    </main>
  `,
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  protected readonly appName = environment.appName;
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly form = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        console.info('[LoginPage] User already authenticated, redirecting to upload page.');
        void this.router.navigateByUrl('/depot');
      }
    });
  }

  protected async login(): Promise<void> {
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    try {
      const { username, password } = this.form.getRawValue();
      console.info('[LoginPage] Login form submitted.', {
        username: username.trim(),
      });
      await this.authService.login(username, password);
    } catch (error) {
      console.error('[LoginPage] Login flow failed.', { error });
      this.errorMessage.set(this.toMessage(error));
    } finally {
      console.info('[LoginPage] Login request finished.');
      this.isSubmitting.set(false);
    }
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'La connexion a echoue. Veuillez reessayer.';
  }
}
