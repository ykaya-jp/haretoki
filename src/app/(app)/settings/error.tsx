"use client";

// Segment-scoped error boundary — keeps BottomNav / chrome alive when
// just the settings content fails. Important here since /settings hosts
// the data-export and account-delete actions; couples should not lose
// the BottomNav while triaging a settings glitch. Same shared component
// as the rest of (app)/* per W16-7.
import AppError from "../error";

export default AppError;
