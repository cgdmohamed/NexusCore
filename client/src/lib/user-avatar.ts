// The picture shown for a signed-in person: the account's own image, else the one on their employee profile.
export function userAvatarSrc(user: { profileImageUrl?: string | null; employee?: { profileImage?: string | null } | null } | null | undefined): string | undefined {
  return user?.profileImageUrl || user?.employee?.profileImage || undefined;
}

export function userInitials(user: { firstName?: string | null; lastName?: string | null; username?: string | null; email?: string | null } | null | undefined): string {
  if (user?.firstName && user?.lastName) return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const base = user?.username || user?.email || "U";
  return base.slice(0, 2).toUpperCase();
}
