/**
 * Parameters for uploading a reconciliation audit report artifact to S3.
 */
export interface AuditReportUploadParams {
  readonly runId: string;
  readonly runNumber: string;
  readonly filename: string;
  readonly contentType: 'text/csv' | 'application/json' | 'text/plain';
  readonly content: string | Uint8Array;
}

/**
 * Result returned after successful S3 artifact upload.
 */
export interface AuditReportUploadResult {
  readonly bucket: string;
  readonly key: string;
  readonly etag?: string;
}

/**
 * Result contract containing generated S3 presigned download URL.
 */
export interface AuditReportPresignedUrlResult {
  readonly downloadUrl: string;
  readonly expiresInSeconds: number;
}

/**
 * Interface for S3 Report Storage operations.
 */
export interface IS3ReportStorage {
  uploadAuditReport(params: AuditReportUploadParams): Promise<AuditReportUploadResult>;
  generatePresignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<AuditReportPresignedUrlResult>;
}
