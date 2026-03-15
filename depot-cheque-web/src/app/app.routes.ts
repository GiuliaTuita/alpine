import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'depot',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/upload/upload-page.component').then((m) => m.UploadPageComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'depot',
  },
  {
    path: '**',
    redirectTo: 'depot',
  },
];
