"use client";

// Segment-scoped error boundary — keeps BottomNav / chrome alive when
// the support page (FAQ + contact form) fails to render. Especially
// important here: couples reaching /support are already in a "something
// went wrong" mindset and a hard error wipe would compound the friction.
// Same shared component as the rest of (app)/* per W16-7.
import AppError from "../error";

export default AppError;
