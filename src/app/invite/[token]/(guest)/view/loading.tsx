export default function GuestViewLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-3 w-32 animate-pulse rounded-full bg-muted" />
        <div className="mx-auto h-8 w-[260px] animate-pulse rounded-full bg-muted" />
        <div className="mx-auto h-3 w-48 animate-pulse rounded-full bg-muted" />
      </div>
      <ul className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li
            key={i}
            className="overflow-hidden rounded-2xl border border-border/60 bg-card"
          >
            <div className="aspect-[4/3] animate-pulse bg-muted" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-44 animate-pulse rounded bg-muted" />
              <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
