"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createVenue } from "@/server/actions/venues";
import type { VenueInput } from "@/server/actions/venue-schema";
import { toast } from "sonner";

export function VenueForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const input: VenueInput = {
      name: formData.get("name") as string,
      location: (formData.get("location") as string) || undefined,
      accessInfo: (formData.get("accessInfo") as string) || undefined,
      capacityMin: formData.get("capacityMin")
        ? Number(formData.get("capacityMin"))
        : undefined,
      capacityMax: formData.get("capacityMax")
        ? Number(formData.get("capacityMax"))
        : undefined,
    };

    try {
      const result = await createVenue(input);

      if (!result.success) {
        const messages = [
          ...Object.values(result.error.fieldErrors).flat(),
          ...result.error.formErrors,
        ];
        setError(messages.join(", ") || "入力内容を確認してください");
        return;
      }

      toast.success("式場を置きました");
      router.push(`/venues/${result.venue.id}`);
    } catch {
      setError("式場をうまく置けませんでした");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          式場名 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="例: ホテル椿山荘東京"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">エリア・住所</Label>
        <Input
          id="location"
          name="location"
          placeholder="例: 東京都文京区関口2-10-8"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accessInfo">アクセス</Label>
        <Input
          id="accessInfo"
          name="accessInfo"
          placeholder="例: 江戸川橋駅 徒歩10分"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="capacityMin">最小人数</Label>
          <Input
            id="capacityMin"
            name="capacityMin"
            type="number"
            inputMode="numeric"
            min="1"
            placeholder="30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacityMax">最大人数</Label>
          <Input
            id="capacityMax"
            name="capacityMax"
            type="number"
            inputMode="numeric"
            min="1"
            placeholder="150"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "迎えています…" : "この式場を迎える"}
      </Button>
    </form>
  );
}
