import { AppEnvironment } from '../app/core/config/app-environment';

export const environment: AppEnvironment = {
  production: true,
  appName: 'DepotCheque',
  brand: {
    clientName: 'SC Recyclage Automobile',
    logoPath: 'logo/logo.png',
  },
  backend: {
    authCheckUrl: 'https://europe-west9-my-sc70.cloudfunctions.net/uploadCheque?action=auth-check',
    uploadUrl: 'https://europe-west9-my-sc70.cloudfunctions.net/uploadCheque?action=upload',
  },
  upload: {
    maxFileSizeMb: 10,
    acceptedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ],
  },
};
