export type PartnerLevel = 1 | 2 | 3;

interface PartnerMember {
  acceptedAt: Date | null;
}

export function getPartnerLevel(member: PartnerMember | null): PartnerLevel {
  if (!member) return 1;
  if (!member.acceptedAt) return 1;
  return 3; // Level 2 and 3 are technically the same
}
