import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const localStorageRoot = path.join(process.cwd(), ".project-work-files");

export const maxProjectFileSize = 15 * 1024 * 1024;
export const maxProjectFiles = 10;

type FileStorageProvider = {
  put(storageKey: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(storageKey: string): Promise<Uint8Array>;
  remove(storageKey: string): Promise<void>;
};

const allowedTypes: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".webp": ["image/webp"],
  ".doc": ["application/msword", "application/octet-stream"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ],
  ".txt": ["text/plain", "application/octet-stream"],
};

function localPath(storageKey: string) {
  const resolved = path.resolve(localStorageRoot, storageKey);
  if (!resolved.startsWith(`${path.resolve(localStorageRoot)}${path.sep}`))
    throw new Error("Invalid storage key.");
  return resolved;
}

function createLocalProvider(): FileStorageProvider {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Local file storage is disabled in production. Configure S3-compatible storage.",
    );
  }

  return {
    async put(storageKey, bytes) {
      const destination = localPath(storageKey);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, bytes, { flag: "wx" });
    },
    get(storageKey) {
      return readFile(localPath(storageKey));
    },
    async remove(storageKey) {
      await unlink(localPath(storageKey)).catch(() => undefined);
    },
  };
}

function createS3Provider(): FileStorageProvider {
  const bucket = process.env.FILE_STORAGE_BUCKET;
  const region = process.env.FILE_STORAGE_REGION;
  if (!bucket || !region)
    throw new Error("FILE_STORAGE_BUCKET and FILE_STORAGE_REGION are required for S3 storage.");

  const client = new S3Client({
    region,
    endpoint: process.env.FILE_STORAGE_ENDPOINT || undefined,
    forcePathStyle: process.env.FILE_STORAGE_FORCE_PATH_STYLE === "true",
    credentials:
      process.env.FILE_STORAGE_ACCESS_KEY_ID && process.env.FILE_STORAGE_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.FILE_STORAGE_ACCESS_KEY_ID,
            secretAccessKey: process.env.FILE_STORAGE_SECRET_ACCESS_KEY,
          }
        : undefined,
  });

  return {
    async put(storageKey, bytes, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: bytes,
          ContentType: contentType,
        }),
      );
    },
    async get(storageKey) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
      if (!result.Body) throw new Error("Stored file has no content.");
      return new Uint8Array(await result.Body.transformToByteArray());
    },
    async remove(storageKey) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
    },
  };
}

let storageProvider: FileStorageProvider | undefined;

function getStorageProvider() {
  if (!storageProvider) {
    storageProvider =
      process.env.FILE_STORAGE_PROVIDER === "s3" ? createS3Provider() : createLocalProvider();
  }
  return storageProvider;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function hasExpectedSignature(extension: string, bytes: Uint8Array) {
  switch (extension) {
    case ".pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case ".png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case ".jpg":
    case ".jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case ".webp":
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
      );
    case ".doc":
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case ".docx":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
    case ".txt":
      return !bytes.includes(0);
    default:
      return false;
  }
}

export function validateProjectFile(file: File, bytes: Uint8Array) {
  const extension = path.extname(file.name).toLowerCase();
  if (!allowedTypes[extension]) return "Use a PDF, image, Word document, or text document.";
  if (file.size <= 0) return "Empty files cannot be uploaded.";
  if (file.size > maxProjectFileSize) return "Each file must be 15 MB or smaller.";
  if (file.type && !allowedTypes[extension].includes(file.type))
    return "The file type does not match its extension.";
  if (!hasExpectedSignature(extension, bytes))
    return "The file contents do not match the selected file type.";
  return null;
}

export function createProjectStorageKey(projectId: number, fileName: string) {
  return `projects/${projectId}/${randomUUID()}${path.extname(fileName).toLowerCase()}`;
}

export function createVerificationStorageKey(userId: number, fileName: string) {
  return `verification/${userId}/${randomUUID()}${path.extname(fileName).toLowerCase()}`;
}

export async function storeProjectFile(
  storageKey: string,
  bytes: Uint8Array,
  contentType = "application/octet-stream",
) {
  await getStorageProvider().put(storageKey, bytes, contentType);
}

export async function readProjectFile(storageKey: string) {
  return getStorageProvider().get(storageKey);
}

export function isProjectFileNotFound(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; name?: string };
  return candidate.code === "ENOENT" || candidate.name === "NoSuchKey";
}

export async function removeProjectFile(storageKey: string) {
  await getStorageProvider().remove(storageKey);
}
