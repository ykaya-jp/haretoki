"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAndSetOnboardingCookie } from "@/server/actions/onboarding-check";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { Loader2 } from "lucide-react";

export function OnboardingGate() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    checkAndSetOnboardingCookie().then(({ completed }) => {
      if (completed) {
        router.push("/home");
        router.refresh();
      } else {
        setNeedsOnboarding(true);
        setChecking(false);
      }
    }).catch(() => {
      setNeedsOnboarding(true);
      setChecking(false);
    });
  }, [router]);

  if (checking && !needsOnboarding) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <OnboardingFlow />;
}
