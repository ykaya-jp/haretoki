"use client";

// Segment-scoped error boundary — keeps BottomNav / chrome alive when
// the help center fails to render. Couples reaching /help are already
// in a "I want to figure something out" mindset; a hard chrome wipe
// would compound the friction. Same shared component as the rest of
// (app)/* per W16-7.
import AppError from "../error";

export default AppError;
