import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Service } from './service.entity';

@Entity('service_images')
export class ServiceImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  serviceId: string;

  @ManyToOne(() => Service, (service) => service.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Column()
  url: string;

  @Column({ default: 0 })
  sortOrder: number;
}
