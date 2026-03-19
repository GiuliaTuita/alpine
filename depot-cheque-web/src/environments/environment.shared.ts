import {
  UPLOAD_ACCEPTED_MIME_TYPES,
  UPLOAD_MAX_FILE_SIZE_MB,
} from '../../backend/upload-cheque-function/src/shared/upload-rules';
import { AppEnvironment } from '../app/core/config/app-environment';

type SharedEnvironment = Omit<AppEnvironment, 'production'>;

export const sharedEnvironment: SharedEnvironment = {
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
    maxFileSizeMb: UPLOAD_MAX_FILE_SIZE_MB,
    acceptedMimeTypes: [...UPLOAD_ACCEPTED_MIME_TYPES],
  },
};
