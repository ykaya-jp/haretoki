export default function OnboardingLoading() {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      {/* Progress bar */}
      <div className="h-1 w-full animate-pulse rounded-full bg-muted" />
      {/* Chat bubbles */}
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="h-24 w-64 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="flex justify-end">
          <div className="h-12 w-40 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
