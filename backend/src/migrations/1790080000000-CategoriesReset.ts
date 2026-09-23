import { MigrationInterface, QueryRunner } from 'typeorm';

// Старый список категорий ("Аниматоры и шоу-программы", "Ведущие и тамада",
// "Музыканты и DJ" и т.п.) остался от изначального скоупа "маркетплейс
// развлекательных услуг для мероприятий" — не соответствует тому, чем сайт
// стал по факту (активности/навыки на открытом воздухе: рыбалка, охота,
// походы и т.п., см. HomeClient.tsx, INTERESTS на регистрации). Переименовываем
// существующие строки на месте (не delete+insert), чтобы не сломать внешний
// ключ у уже существующих услуг.
const RENAMES: Array<{ slug: string; name: string; newSlug?: string }> = [
  { slug: 'animators', name: 'Рыбалка', newSlug: 'fishing' },
  { slug: 'hosts', name: 'Охота', newSlug: 'hunting' },
  { slug: 'musicians-dj', name: 'Походы и треккинг', newSlug: 'hiking' },
  { slug: 'photographers', name: 'Вело', newSlug: 'cycling' },
  { slug: 'quests', name: 'Мото', newSlug: 'moto' },
  { slug: 'sports', name: 'Водный спорт', newSlug: 'water-sports' },
  { slug: 'workshops', name: 'Мастер-классы и ремёсла' },
  // 'other' ("Другое") не трогаем — название уже верное.
];

const NEW_CATEGORIES: Array<{ name: string; slug: string }> = [
  { name: 'Фото и видео', slug: 'photo-video' },
  { name: 'Экскурсии', slug: 'excursions' },
];

const OLD_RENAMES = RENAMES.map((r) => ({
  slug: r.newSlug ?? r.slug,
  name: {
    fishing: 'Аниматоры и шоу-программы',
    hunting: 'Ведущие и тамада',
    hiking: 'Музыканты и DJ',
    cycling: 'Фотографы и видеографы',
    moto: 'Квесты и игры',
    'water-sports': 'Спортивные развлечения',
    workshops: 'Мастер-классы',
  }[r.newSlug ?? r.slug] as string,
  oldSlug: r.slug,
}));

export class CategoriesReset1790080000000 implements MigrationInterface {
  name = 'CategoriesReset1790080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const r of RENAMES) {
      await queryRunner.query(
        `UPDATE "categories" SET "name" = $1, "slug" = $2 WHERE "slug" = $3`,
        [r.name, r.newSlug ?? r.slug, r.slug],
      );
    }
    for (const c of NEW_CATEGORIES) {
      await queryRunner.query(
        `INSERT INTO "categories" ("name", "slug") VALUES ($1, $2)
         ON CONFLICT ("slug") DO NOTHING`,
        [c.name, c.slug],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const c of NEW_CATEGORIES) {
      await queryRunner.query(`DELETE FROM "categories" WHERE "slug" = $1`, [
        c.slug,
      ]);
    }
    for (const r of OLD_RENAMES) {
      await queryRunner.query(
        `UPDATE "categories" SET "name" = $1, "slug" = $2 WHERE "slug" = $3`,
        [r.name, r.oldSlug, r.slug],
      );
    }
  }
}
