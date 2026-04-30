"use client";

// W16-7 (performance-audit B-11). Same UI as (app)/error.tsx but scoped
// to this segment so a coach Server Action failure unmounts only this
// route's content — the bottom nav (in (app)/layout) and any deeper
// sub-layouts stay mounted, so the user can navigate away cleanly.
import AppError from "../error";

export default AppError;
