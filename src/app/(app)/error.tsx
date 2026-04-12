"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-soft)]">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div>
            <h2 className="font-serif text-lg font-bold">うまくいきませんでした</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ご不便をおかけして申し訳ありません。もう一度お試しください
            </p>
          </div>
          <Button onClick={reset}>もう一度試す</Button>
        </CardContent>
      </Card>
    </div>
  );
}
