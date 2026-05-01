"use client";

// Segment-scoped error boundary — keeps BottomNav / chrome alive when
// the visit-prep checklist fails. Couples often reach this surface on
// the morning of a visit, so a full chrome wipe is especially bad here.
// Same shared component as the rest of (app)/* per W16-7.
import AppError from "../../../error";

export default AppError;
