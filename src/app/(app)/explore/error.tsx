"use client";

// W16-7 (performance-audit B-11). Segment-scoped error boundary —
// see ../error.tsx for shared UI. Keeps bottom-nav and outer chrome
// alive when /explore fails (e.g. filter Server Action throws).
import AppError from "../error";

export default AppError;
