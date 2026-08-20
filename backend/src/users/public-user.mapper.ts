import { User } from './user.entity';

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    role: user.role,
    brandName: user.brandName,
    bio: user.bio,
    city: user.city,
    sellerType: user.sellerType,
    skills: user.skills,
    // Приватные данные о самом пользователе — видны только ему (toPublicUser
    // используется для /me, register, login), но не другим (toProfileSummary
    // их не включает).
    interests: user.interests,
    interestsOther: user.interestsOther,
    rating: user.rating,
    isEmailVerified: user.isEmailVerified,
    isPhoneVerified: user.isPhoneVerified,
    isAdmin: user.isAdmin,
    isSellerVerified: user.isSellerVerified,
    sellerVerifiedAt: user.sellerVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;

// Профиль, видимый другим пользователям: без email и телефона.
export function toProfileSummary(user: User) {
  const publicUser = toPublicUser(user);
  return {
    id: publicUser.id,
    firstName: publicUser.firstName,
    lastName: publicUser.lastName,
    avatarUrl: publicUser.avatarUrl,
    role: publicUser.role,
    brandName: publicUser.brandName,
    bio: publicUser.bio,
    city: publicUser.city,
    sellerType: publicUser.sellerType,
    skills: publicUser.skills,
    rating: publicUser.rating,
    isEmailVerified: publicUser.isEmailVerified,
    isPhoneVerified: publicUser.isPhoneVerified,
    createdAt: publicUser.createdAt,
    updatedAt: publicUser.updatedAt,
  };
}

export type ProfileSummary = ReturnType<typeof toProfileSummary>;
