// Наполнение демо-контентом: продавцы + карточки услуг с фото и расписанием.
//
//   SEED_DEMO_PASSWORD=... npm run seed:demo
//
// Идемпотентен: существующих продавцов и услуги (по названию у продавца)
// не дублирует. Фото берёт из frontend/public/seed-images и кладёт в MinIO
// тем же ключом, что и обычная загрузка (services/<id>/<uuid>.jpg).
// Удалить всё демо: npm run seed:demo -- --remove
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Category } from '../categories/category.entity';
import { AppDataSource } from '../config/data-source';
import { toGeoPoint, type GeoPoint } from '../geocoding/geo-point';
import { Schedule } from '../schedule/schedule.entity';
import { ServiceImage } from '../services/service-image.entity';
import {
  Service,
  ServiceBookingMode,
  ServiceLocationType,
  ServicePriceType,
  ServicePriceUnit,
  ServiceStatus,
} from '../services/service.entity';
import { SellerType, User, UserRole } from '../users/user.entity';
import { DEMO_CARDS, DEMO_SELLERS } from './demo-data';

config();

const DEMO_EMAIL_DOMAIN = 'demo.hobbyhub.ru';
const IMAGES_DIR = join(__dirname, '../../../frontend/public/seed-images');

async function geocode(address: string): Promise<GeoPoint | null> {
  const apiKey = process.env.YANDEX_GEOCODER_API_KEY;
  if (!apiKey || apiKey === 'REPLACE_ME') return null;
  const url = new URL('https://geocode-maps.yandex.ru/1.x/');
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('geocode', address);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      response?: {
        GeoObjectCollection?: {
          featureMember?: Array<{ GeoObject?: { Point?: { pos?: string } } }>;
        };
      };
    };
    const pos =
      data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point
        ?.pos;
    if (!pos) return null;
    const [lng, lat] = pos.split(' ').map(Number);
    return toGeoPoint(lat, lng);
  } catch {
    return null;
  }
}

async function remove(): Promise<void> {
  const users = AppDataSource.getRepository(User);
  const demo = await users
    .createQueryBuilder('u')
    .where('u.email LIKE :p', { p: `%@${DEMO_EMAIL_DOMAIN}` })
    .getMany();
  for (const user of demo) {
    // Брони ссылаются на услугу/продавца с RESTRICT — сначала чистим их.
    await AppDataSource.query(`DELETE FROM "bookings" WHERE "sellerId" = $1`, [
      user.id,
    ]);
    await AppDataSource.query(
      `DELETE FROM "chats" WHERE "participant1Id" = $1 OR "participant2Id" = $1`,
      [user.id],
    );
    await users.delete({ id: user.id });
  }
  console.log(`Удалено демо-продавцов: ${demo.length}`);
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  if (process.argv.includes('--remove')) {
    await remove();
    await AppDataSource.destroy();
    return;
  }

  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Задайте SEED_DEMO_PASSWORD (не короче 8 символов)');
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const files = readdirSync(IMAGES_DIR)
    .filter((f) => f.endsWith('.jpg'))
    .sort();
  if (files.length < 40) {
    throw new Error(`В ${IMAGES_DIR} ожидалось 40 фото, найдено ${files.length}`);
  }

  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
  });
  const bucket = process.env.S3_BUCKET ?? 'hobbyhub';
  const publicUrl = (process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '');

  const users = AppDataSource.getRepository(User);
  const services = AppDataSource.getRepository(Service);
  const categories = await AppDataSource.getRepository(Category).find();
  const schedules = AppDataSource.getRepository(Schedule);

  const sellerIds = new Map<string, string>();
  for (const seller of DEMO_SELLERS) {
    const email = `${seller.key}@${DEMO_EMAIL_DOMAIN}`;
    let user = await users.findOne({ where: { email } });
    if (!user) {
      user = await users.save(
        users.create({
          email,
          passwordHash,
          firstName: seller.firstName,
          lastName: seller.lastName,
          brandName: seller.brandName ?? null,
          bio: seller.bio,
          skills: seller.skills,
          city: 'Москва',
          role: UserRole.SELLER,
          sellerType: SellerType.PROFESSIONAL,
          isEmailVerified: true,
          isDemo: true,
        }),
      );
      const rows = seller.windows.flatMap((w) =>
        w.days.map((dayOfWeek) =>
          schedules.create({
            sellerId: user!.id,
            dayOfWeek,
            startTime: w.start,
            endTime: w.end,
            isActive: true,
          }),
        ),
      );
      await schedules.save(rows);
      console.log(`+ продавец ${email}`);
    }
    sellerIds.set(seller.key, user.id);
  }

  for (const card of DEMO_CARDS) {
    const sellerId = sellerIds.get(card.seller)!;
    if (await services.findOne({ where: { sellerId, title: card.title } })) {
      console.log(`= №${card.n} уже есть`);
      continue;
    }
    const category = categories.find((c) => c.slug === card.category);
    if (!category) throw new Error(`Нет категории ${card.category}`);

    const point = await geocode(card.address);
    if (!point) console.warn(`  ! №${card.n}: адрес не геокодирован`);

    const service = await services.save(
      services.create({
        sellerId,
        title: card.title,
        description: card.description,
        categoryId: category.id,
        priceType: ServicePriceType.FIXED,
        priceMin: String(card.price),
        priceUnit: card.unit as ServicePriceUnit,
        durationMinutes: card.duration,
        locationType: ServiceLocationType.ADDRESS,
        locationAddress: card.address,
        city: card.city,
        locationPoint: point,
        tags: card.tags,
        bookingMode: ServiceBookingMode.SLOTS,
        capacity: card.capacity,
        status: ServiceStatus.ACTIVE,
      }),
    );

    const images: ServiceImage[] = [];
    for (const [i, num] of card.photos.entries()) {
      const key = `services/${service.id}/${randomUUID()}.jpg`;
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: readFileSync(join(IMAGES_DIR, files[num - 1])),
          ContentType: 'image/jpeg',
        }),
      );
      images.push(
        AppDataSource.getRepository(ServiceImage).create({
          serviceId: service.id,
          url: `${publicUrl}/${key}`,
          sortOrder: i,
        }),
      );
    }
    await AppDataSource.getRepository(ServiceImage).save(images);
    console.log(`+ №${card.n} ${card.title}`);
  }

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
