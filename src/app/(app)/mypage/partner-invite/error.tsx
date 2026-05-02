"use client";

// Segment-scoped error boundary — same pattern as
// mypage/saved-searches/error.tsx (round W16-7). Failure here keeps
// the (app) layout chrome (BottomNav + header) alive while the
// partner-invite panel itself shows the standard error UI.
import AppError from "../../error";

export default AppError;
