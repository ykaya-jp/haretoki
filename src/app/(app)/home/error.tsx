"use client";

// Segment-scoped error boundary — keeps BottomNav / chrome alive when
// just the home content fails. Same shared component as the rest of
// (app)/* per W16-7.
import AppError from "../error";

export default AppError;
