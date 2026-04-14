"use client";

import { useEffect } from "react";

// Sets data-demo="1" on <body> while the user is inside the /demo route tree.
// Client components elsewhere can detect demo mode via
// `document.body.dataset.demo === "1"` to short-circuit server-action calls.
// Cleans up on unmount so navigation back to real app leaves no residue.
export function DemoBodyMarker() {
  useEffect(() => {
    const prev = document.body.dataset.demo;
    document.body.dataset.demo = "1";
    return () => {
      if (prev === undefined) {
        delete document.body.dataset.demo;
      } else {
        document.body.dataset.demo = prev;
      }
    };
  }, []);
  return null;
}
