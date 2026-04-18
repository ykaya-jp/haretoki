export default function AppLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" aria-label="読み込み中">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
    </div>
  );
}
