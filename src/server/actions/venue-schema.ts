import { z } from "zod";

export const venueSchema = z
  .object({
    name: z.string().min(1, "式場名は必須です"),
    location: z.string().optional(),
    accessInfo: z.string().optional(),
    capacityMin: z.coerce.number().int().positive().optional(),
    capacityMax: z.coerce.number().int().positive().optional(),
    ceremonyStyles: z.array(z.string()).optional(),
    sourceUrls: z.array(z.string().url()).optional(),
    photoUrls: z.array(z.string().url()).optional(),
  })
  .refine(
    (data) => {
      if (data.capacityMin && data.capacityMax) {
        return data.capacityMin <= data.capacityMax;
      }
      return true;
    },
    { message: "最小人数は最大人数以下にしてください" },
  );

export type VenueInput = z.infer<typeof venueSchema>;

/** Pure validation — no side effects */
export function validateVenueInput(input: unknown) {
  return venueSchema.safeParse(input);
}
