"use client";

// Segment-scoped error boundary — keeps BottomNav / chrome alive when
// just the saved-searches list fails. Same shared component as the
// rest of (app)/* per W16-7.
import AppError from "../../error";

export default AppError;
