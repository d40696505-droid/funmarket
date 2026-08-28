// В браузере пустая строка — валидный относительный путь (запросы идут
// через rewrites() того же источника). На сервере (Server Components,
// generateMetadata) fetch() требует абсолютный URL, поэтому там нельзя
// полагаться на NEXT_PUBLIC_API_URL="" — обращаемся к бэкенду напрямую.
const API_URL =
  typeof window === "undefined"
    ? (process.env.INTERNAL_API_URL ?? "http://localhost:3000")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000");

export type UserRole = "buyer" | "seller" | "both";

export interface PublicUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  role: UserRole;
  brandName: string | null;
  bio: string | null;
  city: string | null;
  cityPendingModeration: boolean;
  sellerType: "private" | "professional" | null;
  skills: string[];
  interests: string[];
  interestsOther: string | null;
  rating: string;
  reviewsCount: number;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isAdmin: boolean;
  isSellerVerified: boolean;
  sellerVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  // На сервере (SSR/generateMetadata) запрос к бэкенду идёт напрямую,
  // минуя браузер — временный шлюз Basic Auth (main.ts) требует
  // авторизации на каждый запрос, а браузерных кэшированных credentials
  // здесь нет, поэтому передаём их из тех же переменных окружения явно.
  const basicAuthHeader =
    typeof window === "undefined" &&
    process.env.BASIC_AUTH_USER &&
    process.env.BASIC_AUTH_PASSWORD
      ? {
          Authorization: `Basic ${Buffer.from(
            `${process.env.BASIC_AUTH_USER}:${process.env.BASIC_AUTH_PASSWORD}`,
          ).toString("base64")}`,
        }
      : {};

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...basicAuthHeader,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: unknown });
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : ((body.message as string | undefined) ?? `Ошибка запроса: ${res.status}`);
    throw new ApiError(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export function register(data: {
  email: string;
  password: string;
  phone: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  interests?: string[];
  interestsOther?: string;
}) {
  return request<AuthTokens>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function login(data: { email: string; password: string }) {
  return request<AuthTokens>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMe() {
  return request<PublicUser>("/api/users/me");
}

export function forgotPassword(email: string) {
  return request<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string) {
  return request<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export function verifyEmail(token: string) {
  return request<{ message: string }>(
    `/api/auth/verify-email/${encodeURIComponent(token)}`,
  );
}

export function updateMe(
  data: Partial<
    Pick<
      PublicUser,
      | "firstName"
      | "lastName"
      | "phone"
      | "bio"
      | "city"
      | "brandName"
      | "avatarUrl"
      | "role"
      | "sellerType"
      | "skills"
    >
  >,
) {
  return request<PublicUser>("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteAccount() {
  return request<void>("/api/users/me", { method: "DELETE" });
}

// Публичный профиль продавца/покупателя, видимый другим — без email/телефона
// (см. backend/src/users/public-user.mapper.ts toProfileSummary).
export interface ProfileSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  brandName: string | null;
  bio: string | null;
  city: string | null;
  sellerType: "private" | "professional" | null;
  skills: string[];
  rating: string;
  reviewsCount: number;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getUserProfile(id: string) {
  return request<ProfileSummary>(`/api/users/${id}`);
}

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  publicUrl: string;
}

export function createAvatarUploadUrl(contentType: string) {
  return request<PresignedUpload>("/api/uploads/avatar", {
    method: "POST",
    body: JSON.stringify({ contentType }),
  });
}

export async function uploadAvatarFile(file: File): Promise<string> {
  const presigned = await createAvatarUploadUrl(file.type);

  const formData = new FormData();
  for (const [key, value] of Object.entries(presigned.fields)) {
    formData.append(key, value);
  }
  formData.append("file", file);

  const res = await fetch(presigned.url, { method: "POST", body: formData });
  if (!res.ok) {
    throw new ApiError(`Не удалось загрузить файл: ${res.status}`);
  }
  return presigned.publicUrl;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}

export function getCategories() {
  return request<Category[]>("/api/categories");
}

export interface CategoryCarousel {
  category: Category;
  services: Service[];
}

export function getHomeCarousels() {
  return request<CategoryCarousel[]>("/api/services/carousels");
}

export type ServicePriceType = "fixed" | "range" | "negotiable";
export type ServicePriceUnit = "hour" | "event" | "person";
export type ServiceLocationType = "address" | "mobile" | "online";
export type ServiceStatus = "draft" | "moderation" | "active" | "inactive";
export type ServiceBookingMode = "slots" | "request";

export interface ServiceImage {
  id: string;
  url: string;
  sortOrder: number;
}

export interface Service {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  categoryId: string;
  category?: Category;
  seller?: PublicUser;
  priceMin: string | null;
  priceMax: string | null;
  priceType: ServicePriceType;
  priceUnit: ServicePriceUnit;
  durationMinutes: number;
  locationType: ServiceLocationType;
  locationAddress: string | null;
  locationPoint: { type: "Point"; coordinates: [number, number] } | null;
  city: string | null;
  travelRadiusKm: string | null;
  tags: string[];
  bookingMode: ServiceBookingMode;
  capacity: number;
  status: ServiceStatus;
  moderationComment: string | null;
  viewsCount: number;
  bookingsCount: number;
  favoritesCount: number;
  images: ServiceImage[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceInput {
  title: string;
  description: string;
  categoryId: string;
  priceType: ServicePriceType;
  priceMin?: number;
  priceMax?: number;
  priceUnit: ServicePriceUnit;
  durationMinutes: number;
  locationType: ServiceLocationType;
  locationAddress?: string;
  city: string;
  travelRadiusKm?: number;
  tags?: string[];
  bookingMode?: ServiceBookingMode;
  capacity?: number;
}

export function createService(data: CreateServiceInput) {
  return request<Service>("/api/services", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateService(id: string, data: Partial<CreateServiceInput>) {
  return request<Service>(`/api/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function submitServiceForModeration(id: string) {
  return request<Service>(`/api/services/${id}/submit`, { method: "POST" });
}

export function deactivateService(id: string) {
  return request<Service>(`/api/services/${id}/deactivate`, { method: "PATCH" });
}

export function activateService(id: string) {
  return request<Service>(`/api/services/${id}/activate`, { method: "PATCH" });
}

export function deleteService(id: string) {
  return request<void>(`/api/services/${id}`, { method: "DELETE" });
}

export function getMyServices() {
  return request<Service[]>("/api/services/my");
}

export function getMyServiceById(id: string) {
  return request<Service>(`/api/services/my/${id}`);
}

export function getServiceById(id: string) {
  return request<Service>(`/api/services/${id}`);
}

export interface SearchServicesParams {
  q?: string;
  categoryId?: string;
  sellerId?: string;
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sortBy?: "newest" | "price" | "rating" | "distance";
  sortOrder?: "ASC" | "DESC";
  page?: number;
  limit?: number;
}

export interface SearchServicesResult {
  items: Service[];
  total: number;
  page: number;
  limit: number;
}

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function searchServices(params: SearchServicesParams = {}) {
  return request<SearchServicesResult>(`/api/services${toQueryString(params)}`);
}

export interface ServiceMapMarker {
  id: string;
  title: string;
  priceMin: number | null;
  priceType: ServicePriceType;
  categoryName: string;
  sellerRating: number;
  sellerReviewsCount: number;
  previewUrl: string | null;
  lat: number;
  lng: number;
}

export function getServiceMapMarkers(params: SearchServicesParams = {}) {
  return request<ServiceMapMarker[]>(`/api/services/map${toQueryString(params)}`);
}

export function createServiceImageUploadUrl(serviceId: string, contentType: string) {
  return request<PresignedUpload>("/api/uploads/service-image", {
    method: "POST",
    body: JSON.stringify({ serviceId, contentType }),
  });
}

export async function uploadServiceImageFile(
  serviceId: string,
  file: File,
): Promise<ServiceImage> {
  const presigned = await createServiceImageUploadUrl(serviceId, file.type);

  const formData = new FormData();
  for (const [key, value] of Object.entries(presigned.fields)) {
    formData.append(key, value);
  }
  formData.append("file", file);

  const uploadRes = await fetch(presigned.url, { method: "POST", body: formData });
  if (!uploadRes.ok) {
    throw new ApiError(`Не удалось загрузить файл: ${uploadRes.status}`);
  }

  return request<ServiceImage>(`/api/services/${serviceId}/images`, {
    method: "POST",
    body: JSON.stringify({ url: presigned.publicUrl }),
  });
}

export function removeServiceImage(serviceId: string, imageId: string) {
  return request<void>(`/api/services/${serviceId}/images/${imageId}`, {
    method: "DELETE",
  });
}

// ---- Расписание (Фаза 3) ----

export interface ScheduleEntry {
  id: string;
  sellerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface ScheduleEntryInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export type ScheduleExceptionType = "block" | "available";

export interface ScheduleExceptionItem {
  id: string;
  sellerId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
  type: ScheduleExceptionType;
  capacity: number | null;
}

export function getMySchedule() {
  return request<ScheduleEntry[]>("/api/schedule");
}

export function replaceSchedule(entries: ScheduleEntryInput[]) {
  return request<ScheduleEntry[]>("/api/schedule", {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}

export function getMyExceptions() {
  return request<ScheduleExceptionItem[]>("/api/schedule/exceptions");
}

export function addScheduleException(data: {
  date: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  type?: ScheduleExceptionType;
  capacity?: number;
}) {
  return request<ScheduleExceptionItem>("/api/schedule/exceptions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function removeScheduleException(id: string) {
  return request<void>(`/api/schedule/exceptions/${id}`, { method: "DELETE" });
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  capacity: number;
}

export function getAvailableSlots(sellerId: string, serviceId: string, date: string) {
  return request<AvailableSlot[]>(
    `/api/schedule/${sellerId}/slots${toQueryString({ serviceId, date })}`,
  );
}

// ---- Бронирования (Фаза 3) ----

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "awaiting_payment"
  | "rejected"
  | "cancelled"
  | "paid"
  | "completed"
  | "disputed";

export interface Booking {
  id: string;
  serviceId: string;
  service?: Service;
  buyerId: string;
  buyer?: PublicUser;
  sellerId: string;
  seller?: PublicUser;
  bookingDate: string;
  startTime: string;
  endTime: string;
  locationAddress: string | null;
  comment: string | null;
  status: BookingStatus;
  rejectionReason: string | null;
  totalAmount: string | null;
  paymentDeadline: string | null;
  escrowReleaseAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function createBooking(data: {
  serviceId: string;
  date: string;
  startTime: string;
  locationAddress?: string;
  comment?: string;
}) {
  return request<Booking>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getBooking(id: string) {
  return request<Booking>(`/api/bookings/${id}`);
}

export function confirmBooking(id: string, fixedAmount?: string) {
  return request<Booking>(`/api/bookings/${id}/confirm`, {
    method: "PATCH",
    body: JSON.stringify(fixedAmount ? { fixedAmount } : {}),
  });
}

export function rejectBooking(id: string, reason: string) {
  return request<Booking>(`/api/bookings/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function cancelBooking(id: string, reason?: string) {
  return request<Booking>(`/api/bookings/${id}/cancel`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export function getMyBookings(params: { as?: "buyer" | "seller"; status?: BookingStatus } = {}) {
  return request<Booking[]>(`/api/bookings${toQueryString(params)}`);
}

// ---- Уведомления (Фаза 3) ----

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export function getNotifications() {
  return request<AppNotification[]>("/api/notifications");
}

export function markNotificationRead(id: string) {
  return request<AppNotification>(`/api/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export function markAllNotificationsRead() {
  return request<void>("/api/notifications/read-all", { method: "PATCH" });
}

// ---- Чат (Фаза 5) ----

export interface ChatParticipant {
  id: string;
  firstName: string | null;
  lastName: string | null;
  brandName: string | null;
  avatarUrl: string | null;
}

export interface ChatSummary {
  id: string;
  bookingId: string | null;
  otherParticipant: ChatParticipant;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  unreadCount: number;
  isOnline: boolean;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string | null;
  isSystem: boolean;
  text: string;
  imageUrls: string[];
  isRead: boolean;
  createdAt: string;
}

export function getMyChats() {
  return request<ChatSummary[]>("/api/chats");
}

export function createChat(participantId: string) {
  return request<{ id: string }>("/api/chats", {
    method: "POST",
    body: JSON.stringify({ participantId }),
  });
}

// ---- Техподдержка ----

export interface SupportContact {
  id: string;
  name: string;
}

// 404, если аккаунт поддержки не настроен — вызывающий код сам решает,
// как на это реагировать (обычно — просто не показывать пункт «Поддержка»).
export function getSupportContact() {
  return request<SupportContact>("/api/support/contact");
}

export function getChatMessages(chatId: string) {
  return request<ChatMessage[]>(`/api/chats/${chatId}/messages`);
}

export function sendChatMessageRest(chatId: string, text: string, imageUrls?: string[]) {
  return request<ChatMessage>(`/api/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text, imageUrls }),
  });
}

export function reportMessage(messageId: string, reason: string) {
  return request<void>(`/api/chats/messages/${messageId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ---- Отзывы (Фаза 6) ----

export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  reviewer: ChatParticipant;
  targetId: string;
  rating: number;
  text: string;
  photoUrls: string[];
  sellerReply: string | null;
  createdAt: string;
}

export function createReviewPhotoUploadUrl(contentType: string) {
  return request<PresignedUpload>("/api/uploads/review-photo", {
    method: "POST",
    body: JSON.stringify({ contentType }),
  });
}

export async function uploadReviewPhotoFile(file: File): Promise<string> {
  const presigned = await createReviewPhotoUploadUrl(file.type);

  const formData = new FormData();
  for (const [key, value] of Object.entries(presigned.fields)) {
    formData.append(key, value);
  }
  formData.append("file", file);

  const res = await fetch(presigned.url, { method: "POST", body: formData });
  if (!res.ok) {
    throw new ApiError(`Не удалось загрузить файл: ${res.status}`);
  }
  return presigned.publicUrl;
}

export function createReview(data: {
  bookingId: string;
  rating: number;
  text: string;
  photoUrls?: string[];
}) {
  return request<Review>("/api/reviews", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function replyToReview(reviewId: string, reply: string) {
  return request<Review>(`/api/reviews/${reviewId}/reply`, {
    method: "PATCH",
    body: JSON.stringify({ reply }),
  });
}

export function getReviewsByTarget(targetId: string) {
  return request<Review[]>(`/api/reviews?target_id=${targetId}`);
}

// ---- Избранное ----

export function getFavoriteIds() {
  return request<string[]>("/api/favorites/ids");
}

export function getFavorites() {
  return request<Service[]>("/api/favorites");
}

export function addFavorite(serviceId: string) {
  return request<{ id: string }>(`/api/favorites/${serviceId}`, { method: "POST" });
}

export function removeFavorite(serviceId: string) {
  return request<void>(`/api/favorites/${serviceId}`, { method: "DELETE" });
}

// ---- Платежи и эскроу (Фаза 4) ----

export type TransactionStatus = "pending" | "paid" | "released" | "refunded" | "failed";

export interface Transaction {
  id: string;
  bookingId: string;
  booking?: Booking;
  provider: string;
  providerTransactionId: string;
  status: TransactionStatus;
  amount: string;
  commissionAmount: string;
  sellerPayoutAmount: string;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  releasedAt: string | null;
}

export function initiatePayment(bookingId: string) {
  return request<{ redirectUrl: string; transactionId: string }>(
    `/api/payments/bookings/${bookingId}/initiate`,
    { method: "POST" },
  );
}

export function getPaymentStatus(bookingId: string) {
  return request<Transaction | null>(`/api/payments/bookings/${bookingId}/status`);
}

export function getTransaction(transactionId: string) {
  return request<Transaction>(`/api/payments/transactions/${transactionId}`);
}

export function simulatePayment(transactionId: string) {
  return request<Transaction>(`/api/payments/checkout/${transactionId}/simulate`, {
    method: "POST",
  });
}

export function cancelCheckout(transactionId: string) {
  return request<Transaction>(`/api/payments/checkout/${transactionId}/cancel`, {
    method: "POST",
  });
}

export function refundCancelBooking(bookingId: string) {
  return request<Booking>(`/api/payments/bookings/${bookingId}/refund-cancel`, {
    method: "POST",
  });
}

export function disputeBooking(bookingId: string, reason: string) {
  return request<Booking>(`/api/payments/bookings/${bookingId}/dispute`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export interface SellerBalance {
  available: string;
  pending: string;
  currency: string;
}

export function getSellerBalance() {
  return request<SellerBalance>("/api/payments/balance");
}

export function getPayoutHistory() {
  return request<Transaction[]>("/api/payments/payouts");
}

// ---- Админ (Фаза 4: модерация услуг + верификация продавцов) ----

export function getModerationQueue() {
  return request<Service[]>("/api/services/admin/moderation-queue");
}

export function approveService(id: string) {
  return request<Service>(`/api/services/admin/${id}/approve`, { method: "PATCH" });
}

export function rejectServiceModeration(id: string, comment: string) {
  return request<Service>(`/api/services/admin/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ comment }),
  });
}

export function getSellersForVerification(verified?: boolean) {
  const query = verified === undefined ? "" : `?verified=${verified}`;
  return request<PublicUser[]>(`/api/payments/admin/sellers${query}`);
}

export function verifySeller(userId: string, verified: boolean) {
  return request<PublicUser>(`/api/payments/admin/sellers/${userId}/verify`, {
    method: "PATCH",
    body: JSON.stringify({ verified }),
  });
}

export function getCityReviewQueue() {
  return request<PublicUser[]>("/api/users/admin/city-review-queue");
}

export function approveCityReview(userId: string) {
  return request<PublicUser>(`/api/users/admin/${userId}/approve-city`, { method: "PATCH" });
}

export function rejectCityReview(userId: string) {
  return request<PublicUser>(`/api/users/admin/${userId}/reject-city`, { method: "PATCH" });
}

export function resolveDispute(bookingId: string, resolution: "release" | "refund") {
  return request<Booking>(`/api/payments/admin/bookings/${bookingId}/resolve-dispute`, {
    method: "POST",
    body: JSON.stringify({ resolution }),
  });
}

export function storeTokens(tokens: Pick<AuthTokens, "accessToken" | "refreshToken">) {
  localStorage.setItem("accessToken", tokens.accessToken);
  localStorage.setItem("refreshToken", tokens.refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}
