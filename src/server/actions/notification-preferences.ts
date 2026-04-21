"use server";

import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";

export type FrequencyMode = "auto" | "quiet" | "off";

export interface NotificationPreferenceData {
  frequency: FrequencyMode;
  emailEnabled: boolean;
  pushEnabled: boolean;
}

/** Returns the current user's notification preference, creating defaults if absent. */
export async function getMyNotificationPreference(): Promise<NotificationPreferenceData> {
  const user = await requireUser();

  const pref = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
    select: { frequency: true, emailEnabled: true, pushEnabled: true },
  });

  if (!pref) {
    return { frequency: "auto", emailEnabled: true, pushEnabled: false };
  }

  return {
    frequency: pref.frequency as FrequencyMode,
    emailEnabled: pref.emailEnabled,
    pushEnabled: pref.pushEnabled,
  };
}

/** Upserts the frequency mode for the current user. */
export async function updateNotificationFrequency(
  frequency: FrequencyMode,
): Promise<void> {
  const user = await requireUser();

  // Prisma accepts the enum string value directly when generated types are not available.
  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      frequency: frequency as any,
      emailEnabled: true,
      pushEnabled: false,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { frequency: frequency as any },
  });
}
