// Формат, который ожидает TypeORM при записи в geometry/geography колонки
// (внутри оборачивается в ST_GeomFromGeoJSON) — см. InsertQueryBuilder/UpdateQueryBuilder.
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export function toGeoPoint(lat: number, lng: number): GeoPoint {
  return { type: 'Point', coordinates: [lng, lat] };
}
