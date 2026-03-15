import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const { authCheckUrl, uploadUrl } = environment.backend;

  if (req.headers.has('Authorization')) {
    return next(req);
  }

  const isBackendRequest =
    (authCheckUrl && req.url.startsWith(authCheckUrl)) ||
    (uploadUrl && req.url.startsWith(uploadUrl));

  if (!isBackendRequest) {
    return next(req);
  }

  const authorizationHeader = authService.getAuthorizationHeader();

  if (!authorizationHeader) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: authorizationHeader,
      },
    }),
  );
};
