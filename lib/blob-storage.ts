import OSS from "ali-oss";

let client: OSS | null = null;

function getClient() {
  if (client) return client;

  const region = process.env.OSS_REGION;
  const endpoint = process.env.OSS_ENDPOINT;
  const bucket = process.env.OSS_BUCKET;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;

  if (!region || !endpoint || !bucket || !accessKeyId || !accessKeySecret) {
    return null;
  }

  client = new OSS({
    region,
    endpoint: endpoint.startsWith("http") ? endpoint : `https://${endpoint}`,
    bucket,
    accessKeyId,
    accessKeySecret,
    secure: true
  });

  return client;
}

export function hasBlobStorage() {
  return Boolean(getClient());
}

function safeFilename(name: string) {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 120);
}

function buildObjectKey(prefix: string, filename: string) {
  return `${prefix}/${Date.now()}-${safeFilename(filename)}`;
}

async function putBuffer(objectKey: string, data: Buffer, headers?: Record<string, string>) {
  const oss = getClient();
  if (!oss) return null;
  return oss.put(objectKey, data, { headers });
}

export async function archiveUploadedFile(prefix: string, file: File) {
  const data = Buffer.from(await file.arrayBuffer());
  return putBuffer(buildObjectKey(prefix, file.name), data, {
    "Content-Type": file.type || "application/octet-stream"
  });
}

export async function archiveGeneratedFile(prefix: string, filename: string, data: Buffer) {
  return putBuffer(buildObjectKey(prefix, filename), data, {
    "Content-Type": "application/zip"
  });
}
