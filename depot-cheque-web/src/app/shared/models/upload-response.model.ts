export interface UploadResponse {
  fileId: string;
  bucket: string;
  storagePath: string;
  gsUri: string;
  contentType: string;
  uploadedAt: string;
}
