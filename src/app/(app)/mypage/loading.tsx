export default function MyPageLoading() {
  return (
    <div className="space-y-8">
      <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
        </div>
      ))}
    </div>
  );
}
