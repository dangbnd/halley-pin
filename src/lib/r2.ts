import "server-only";

import { S3Client, DeleteObjectsCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

function required(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getR2Client() {
  const accountId = required("R2_ACCOUNT_ID");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: "auto", // required by AWS SDK but not used by R2
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function getR2Bucket() {
  return required("R2_BUCKET");
}

export async function deleteR2Keys(keys: string[]) {
  if (!keys.length) return;
  const s3 = getR2Client();
  const Bucket = getR2Bucket();

  // DeleteObjects supports up to 1000 keys per request
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 1000) chunks.push(keys.slice(i, i + 1000));

  for (const chunk of chunks) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      })
    );
  }
}

export async function deleteR2Key(key: string) {
  const s3 = getR2Client();
  const Bucket = getR2Bucket();
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

export async function getR2ObjectBuffer(key: string): Promise<Buffer> {
  const s3 = getR2Client();
  const Bucket = getR2Bucket();
  const out = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  const body = out.Body;
  if (!body) throw new Error("R2 object has empty body");

  // Body is a stream in Node
  const chunks: Buffer[] = [];
  const stream = body as any;
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function putR2Object(
  key: string,
  body: Buffer,
  opts: { contentType: string; cacheControl?: string }
) {
  const s3 = getR2Client();
  const Bucket = getR2Bucket();
  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: body,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl,
    })
  );
}
