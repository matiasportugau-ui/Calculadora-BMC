import { Storage } from "@google-cloud/storage";

/**
 * @param {{ bucket: string, objectPath: string, buffer: Buffer, contentType: string }} opts
 * @returns {Promise<string>} gs:// URI
 */
export async function uploadBufferToGcs({ bucket, objectPath, buffer, contentType }) {
  if (!bucket) throw new Error("OMNI_GCS_BUCKET not set");
  const storage = new Storage();
  const file = storage.bucket(bucket).file(objectPath);
  await file.save(buffer, {
    contentType: contentType || "application/octet-stream",
    resumable: buffer.length > 5 * 1024 * 1024,
  });
  return `gs://${bucket}/${objectPath}`;
}
