import type { Metadata } from "next";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";

export const metadata: Metadata = {
  title: "はじめる",
  description:
    "おふたりの好みを、コーチが 4 つの質問で聞きます。3 分ほどで、合いそうな式場が見えてきます。",
  // No-index intentional — this is a private gateway behind auth, the
  // content is per-couple and should never appear in search results.
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingGate />;
}
