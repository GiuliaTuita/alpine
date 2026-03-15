export interface AppEnvironment {
  production: boolean;
  appName: string;
  backend: {
    authCheckUrl: string;
    uploadUrl: string;
  };
  upload: {
    maxFileSizeMb: number;
    acceptedMimeTypes: string[];
  };
}
