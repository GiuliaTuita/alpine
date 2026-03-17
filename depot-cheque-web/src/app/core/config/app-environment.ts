export interface AppEnvironment {
  production: boolean;
  appName: string;
  brand: {
    clientName: string;
    logoPath: string;
  };
  backend: {
    authCheckUrl: string;
    uploadUrl: string;
  };
  upload: {
    maxFileSizeMb: number;
    acceptedMimeTypes: string[];
  };
}
