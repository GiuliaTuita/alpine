import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthCheckResponse } from '../../shared/models/auth-check-response.model';

interface SharedSession {
  username: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = signal<SharedSession | null>(this.readStoredSession());

  readonly configured = computed(
    () => Boolean(environment.backend.authCheckUrl) && Boolean(environment.backend.uploadUrl),
  );
  readonly username = computed(() => this.sessionState()?.username ?? '');
  readonly isAuthenticated = computed(() => !!this.sessionState());

  async login(username: string, password: string): Promise<void> {
    if (!this.configured()) {
      console.error('[AuthService] Backend URLs are not configured.');
      throw new Error("Les URLs backend ne sont pas configurees.");
    }

    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (!normalizedUsername || !normalizedPassword) {
      console.warn('[AuthService] Login blocked because credentials are missing.');
      throw new Error("L'identifiant et le mot de passe sont obligatoires.");
    }

    console.info('[AuthService] Starting login request.', {
      username: normalizedUsername,
      authCheckUrl: environment.backend.authCheckUrl,
    });

    const headers = new HttpHeaders({
      Authorization: this.buildBasicAuthHeader(normalizedUsername, normalizedPassword),
    });

    try {
      const response = await firstValueFrom(
        this.http.post<AuthCheckResponse>(
          environment.backend.authCheckUrl,
          {},
          { headers },
        ),
      );

      console.info('[AuthService] Login request succeeded.', {
        username: response.username,
      });
    } catch (error) {
      console.error('[AuthService] Login request failed.', {
        username: normalizedUsername,
        error,
      });
      throw error;
    }

    this.writeStoredSession({
      username: normalizedUsername,
      password: normalizedPassword,
    });
  }

  logout(): void {
    console.info('[AuthService] Clearing local session.', {
      username: this.sessionState()?.username ?? null,
    });
    this.sessionState.set(null);
    sessionStorage.removeItem('shared-auth-session');
  }

  getAuthorizationHeader(): string | null {
    const session = this.sessionState();

    if (!session) {
      return null;
    }

    return this.buildBasicAuthHeader(session.username, session.password);
  }

  private buildBasicAuthHeader(username: string, password: string): string {
    return `Basic ${btoa(`${username}:${password}`)}`;
  }

  private readStoredSession(): SharedSession | null {
    const rawSession = sessionStorage.getItem('shared-auth-session');

    if (!rawSession) {
      console.info('[AuthService] No stored session found.');
      return null;
    }

    try {
      const session = JSON.parse(rawSession) as Partial<SharedSession>;

      if (typeof session.username === 'string' && typeof session.password === 'string') {
        return {
          username: session.username,
          password: session.password,
        };
      }
    } catch {
      console.warn('[AuthService] Stored session is invalid and will be removed.');
      sessionStorage.removeItem('shared-auth-session');
    }

    console.warn('[AuthService] Stored session format is incomplete.');
    return null;
  }

  private writeStoredSession(session: SharedSession): void {
    console.info('[AuthService] Persisting local session.', {
      username: session.username,
    });
    this.sessionState.set(session);
    sessionStorage.setItem('shared-auth-session', JSON.stringify(session));
  }
}
