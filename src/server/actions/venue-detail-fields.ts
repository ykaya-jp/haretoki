/**
 * Contract between `getVenueHeader` in venues.ts and the Phase B sections
 * rendered on `/venues/{id}`. If this list drifts from the action's Prisma
 * `select` or from the Venue schema's deep-extraction columns, the venue
 * detail page silently loses fields (the original v3 bug). The contract
 * test `venues-deep-detail.test.ts` pins all three in sync.
 *
 * Must live in a non-`"use server"` file: Next's App Router forbids any
 * export other than `async` functions from a "use server" module. Plain
 * arrays / consts have to sit in a sibling, hence this file.
 */
export const VENUE_DEEP_DETAIL_SELECT_KEYS = [
  "externalRatingValue",
  "externalReviewCount",
  "postalCode",
  "streetAddress",
  "latitude",
  "longitude",
  "phoneNumber",
  "hasParking",
  "parkingCapacity",
  "hasShuttle",
  "hasAccommodation",
  "acceptsSecondParty",
  "barrierFree",
  "ceremonyFeeExact",
  "productionFeeMin",
  "productionFeeMax",
  "serviceFeeRate",
  "operatingHours",
  "closedDays",
  "cuisineTypes",
  "chefCredentials",
] as const;
