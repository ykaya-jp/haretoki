"use client";

// Segment-scoped error boundary — keeps BottomNav / chrome alive when
// the duel comparison fails to render (e.g. a venue was deleted while
// the duel was on-screen). Same shared component as the rest of
// (app)/* per W16-7.
import AppError from "../../error";

export default AppError;
