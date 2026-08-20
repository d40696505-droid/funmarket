import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity';
import { GeoPoint } from '../geocoding/geo-point';
import { User } from '../users/user.entity';
import { ServiceImage } from './service-image.entity';

export enum ServicePriceType {
  FIXED = 'fixed',
  RANGE = 'range',
  NEGOTIABLE = 'negotiable',
}

export enum ServicePriceUnit {
  HOUR = 'hour',
  EVENT = 'event',
  PERSON = 'person',
}

export enum ServiceLocationType {
  ADDRESS = 'address',
  MOBILE = 'mobile',
  ONLINE = 'online',
}

export enum ServiceStatus {
  DRAFT = 'draft',
  MODERATION = 'moderation',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum ServiceBookingMode {
  // Покупатель выбирает конкретный слот из расписания продавца.
  SLOTS = 'slots',
  // Продавец не ведёт расписание — покупатель присылает пожелание по дате
  // и договаривается в чате (для частных мастеров без формального графика).
  REQUEST = 'request',
}

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ length: 100 })
  title: string;

  @Column({ length: 3000 })
  description: string;

  @Index()
  @Column()
  categoryId: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  // Nullable: обязательны только когда priceType != 'negotiable' (правка №10).
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  priceMin: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  priceMax: string | null;

  @Column({ type: 'enum', enum: ServicePriceType })
  priceType: ServicePriceType;

  @Column({ type: 'enum', enum: ServicePriceUnit })
  priceUnit: ServicePriceUnit;

  @Column()
  durationMinutes: number;

  @Column({ type: 'enum', enum: ServiceLocationType })
  locationType: ServiceLocationType;

  @Column({ type: 'varchar', nullable: true })
  locationAddress: string | null;

  // Город — управляемый список (см. cities.ts), нужен для точного
  // фильтра в каталоге; nullable, т.к. у услуг, созданных до этого поля,
  // его нет.
  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  // При чтении через find()/QueryBuilder.getMany() приходит как WKB-строка —
  // для координат используйте ST_X/ST_Y в отдельном raw-запросе (см. findMapMarkers).
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  locationPoint: GeoPoint | null;

  // Обязательно, если locationType = 'mobile'.
  @Column({ type: 'numeric', precision: 5, scale: 1, nullable: true })
  travelRadiusKm: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  tags: string[];

  @Column({
    type: 'enum',
    enum: ServiceBookingMode,
    default: ServiceBookingMode.SLOTS,
  })
  bookingMode: ServiceBookingMode;

  // Сколько покупателей помещается в один слот расписания. 1 = обычная
  // бронь (первый бронирует — слот занят, поведение по умолчанию); >1 —
  // групповые мероприятия, где несколько разных покупателей могут
  // забронировать один и тот же слот.
  @Column({ type: 'int', default: 1 })
  capacity: number;

  @Index()
  @Column({ type: 'enum', enum: ServiceStatus, default: ServiceStatus.DRAFT })
  status: ServiceStatus;

  @Column({ type: 'varchar', nullable: true })
  moderationComment: string | null;

  @Column({ default: 0 })
  viewsCount: number;

  // Заполняется в Фазе 3, когда появится модуль бронирования.
  @Column({ default: 0 })
  bookingsCount: number;

  @OneToMany(() => ServiceImage, (image) => image.service, { cascade: true })
  images: ServiceImage[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
