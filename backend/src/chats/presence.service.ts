import { Injectable } from '@nestjs/common';

// Трекинг онлайн-статуса (FR-6.1) через счётчик активных WebSocket-соединений
// на пользователя — у одного пользователя может быть открыто несколько вкладок.
@Injectable()
export class PresenceService {
  private readonly connectionCounts = new Map<string, number>();

  markOnline(userId: string): void {
    this.connectionCounts.set(
      userId,
      (this.connectionCounts.get(userId) ?? 0) + 1,
    );
  }

  markOffline(userId: string): void {
    const count = (this.connectionCounts.get(userId) ?? 0) - 1;
    if (count <= 0) {
      this.connectionCounts.delete(userId);
    } else {
      this.connectionCounts.set(userId, count);
    }
  }

  isOnline(userId: string): boolean {
    return this.connectionCounts.has(userId);
  }
}
