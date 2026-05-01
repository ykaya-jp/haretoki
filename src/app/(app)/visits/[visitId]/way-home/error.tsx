"use client";

// Segment-scoped error boundary — keeps BottomNav / chrome alive when
// the way-home reflection screen fails. Couples reach this on the
// train home from a visit; a hard error wipe would lose the reflection
// they were about to capture. Same shared component as the rest of
// (app)/* per W16-7.
import AppError from "../../../error";

export default AppError;
