import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFileUpload(mimetype: string, size: number): void {
  if (!ALLOWED_TYPES.includes(mimetype)) {
    throw new Error('Invalid file type. Allowed: JPEG, PNG, WebP, PDF');
  }
  if (size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum 10 MB.');
  }
}

export async function uploadToS3(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
  folder: string
): Promise<string> {
  const ext = path.extname(originalName);
  const key = `${folder}/${uuidv4()}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ServerSideEncryption: 'AES256',
    })
  );

  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function deleteFromS3(url: string): Promise<void> {
  const key = url.split('.amazonaws.com/')[1];
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
}
