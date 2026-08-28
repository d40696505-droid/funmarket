import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { randomUUID } from 'node:crypto';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 МБ — как для фото услуг (FR-2.1)
const PRESIGNED_URL_TTL_SECONDS = 60;

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  publicUrl: string;
}

@Injectable()
export class UploadsService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('S3_BUCKET', 'hobbyhub');
    this.publicUrl = this.configService
      .get<string>('S3_PUBLIC_URL', '')
      .replace(/\/$/, '');

    this.s3 = new S3Client({
      endpoint: this.configService.get<string>('S3_ENDPOINT'),
      region: this.configService.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle:
        this.configService.get<string>('S3_FORCE_PATH_STYLE', 'true') ===
        'true',
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>(
          'S3_SECRET_ACCESS_KEY',
          '',
        ),
      },
    });
  }

  createAvatarUploadUrl(
    userId: string,
    contentType: string,
  ): Promise<PresignedUpload> {
    return this.createPresignedImageUpload(`avatars/${userId}`, contentType);
  }

  createServiceImageUploadUrl(
    serviceId: string,
    contentType: string,
  ): Promise<PresignedUpload> {
    return this.createPresignedImageUpload(
      `services/${serviceId}`,
      contentType,
    );
  }

  createReviewPhotoUploadUrl(
    userId: string,
    contentType: string,
  ): Promise<PresignedUpload> {
    return this.createPresignedImageUpload(`reviews/${userId}`, contentType);
  }

  private async createPresignedImageUpload(
    keyPrefix: string,
    contentType: string,
  ): Promise<PresignedUpload> {
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new BadRequestException('Допустимы только изображения JPEG/PNG');
    }

    const extension = contentType === 'image/png' ? 'png' : 'jpg';
    const key = `${keyPrefix}/${randomUUID()}.${extension}`;

    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, MAX_FILE_SIZE_BYTES],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: PRESIGNED_URL_TTL_SECONDS,
    });

    return { url, fields, publicUrl: `${this.publicUrl}/${key}` };
  }
}
