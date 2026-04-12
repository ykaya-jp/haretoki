"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { venueSchema } from "@/server/actions/venue-schema";
import type { VenueInput } from "@/server/actions/venue-schema";
import type { VenueStatus } from "@/generated/prisma/client";

// --- Server actions ---

export async function createVenue(input: VenueInput) {
  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.flatten() };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venue = await prisma.venue.create({
    data: {
      projectId,
      name: parsed.data.name,
      location: parsed.data.location ?? null,
      accessInfo: parsed.data.accessInfo ?? null,
      capacityMin: parsed.data.capacityMin ?? null,
      capacityMax: parsed.data.capacityMax ?? null,
      ceremonyStyles: parsed.data.ceremonyStyles ?? [],
      sourceUrls: parsed.data.sourceUrls ?? [],
    },
  });

  revalidatePath("/venues");
  revalidatePath("/dashboard");

  return { success: true as const, venue };
}

export async function getVenues() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venues = await prisma.venue.findMany({
    where: { projectId },
    include: {
      scores: true,
      estimates: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return venues;
}

export async function getVenue(id: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venue = await prisma.venue.findFirst({
    where: { id, projectId },
    include: {
      scores: true,
      estimates: { include: { items: true }, orderBy: { version: "desc" } },
      visits: {
        include: {
          ratings: true,
          notes: { include: { media: true } },
        },
      },
    },
  });

  return venue;
}

export async function updateVenueStatus(id: string, status: VenueStatus) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Verify venue belongs to project
  const venue = await prisma.venue.findFirst({
    where: { id, projectId },
  });
  if (!venue) throw new Error("式場が見つかりません");

  const updated = await prisma.venue.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/venues");
  revalidatePath(`/venues/${id}`);

  return updated;
}
