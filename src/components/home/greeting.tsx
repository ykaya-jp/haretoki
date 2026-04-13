interface GreetingProps {
  userName: string;
  weddingDate?: Date;
}

export function Greeting({ userName, weddingDate }: GreetingProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "おはようございます" : hour < 18 ? "こんにちは" : "こんばんは";

  const now = new Date();
  const daysUntilWedding = weddingDate
    ? Math.ceil((weddingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div>
      <h1 className="text-fluid-xl">
        {greeting}、{userName}さん
      </h1>
      {daysUntilWedding !== null && daysUntilWedding > 0 && (
        <p className="text-sm text-muted-foreground">
          おふたりの晴れの日まで あと<span className="tabular-nums">{daysUntilWedding}</span>日
        </p>
      )}
    </div>
  );
}
