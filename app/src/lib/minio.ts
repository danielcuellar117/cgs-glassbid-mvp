import * as Minio from "minio";

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || "minio",
  port: parseInt(process.env.MINIO_PORT || "9000", 10),
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin_secret",
});

export const BUCKETS = {
  RAW_UPLOADS: "raw-uploads",
  PAGE_CACHE: "page-cache",
  OUTPUTS: "outputs",
} as const;

/**
 * Generate a presigned GET URL for downloading an object.
 * Expires in 15 minutes by default.
 */
export async function presignedGetUrl(
  bucket: string,
  key: string,
  expirySeconds = 900,
): Promise<string> {
  return minioClient.presignedGetObject(bucket, key, expirySeconds);
}
