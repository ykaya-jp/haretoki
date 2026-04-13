"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2 } from "lucide-react";
import { addVenueFromUrl, confirmVenueFromUrl, createVenue } from "@/server/actions/venues";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ExtractedVenueData {
  name: string;
  location: string | null;
  accessInfo: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];
  estimatedPrice: number | null;
  features: string[];
  photoUrls: string[];
  confidence: "high" | "medium" | "low";
}

export function AddVenueSheet() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("url");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedVenueData | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const router = useRouter();

  const handleUrlSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const result = await addVenueFromUrl(url);
      if (result.error) {
        toast.error(result.error);
        setTab("manual");
      } else if (result.extracted) {
        setExtracted(result.extracted);
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!extracted) return;
    setLoading(true);
    try {
      const result = await confirmVenueFromUrl(extracted, url);
      if (result.success) {
        toast.success("式場を追加しました");
        setOpen(false);
        resetForm();
        router.refresh();
      }
    } catch {
      toast.error("登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualName.trim()) return;
    setLoading(true);
    try {
      const result = await createVenue({
        name: manualName,
        location: manualLocation || undefined,
      });
      if (result.success) {
        toast.success("式場を追加しました");
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error("登録に失敗しました");
      }
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUrl("");
    setExtracted(null);
    setManualName("");
    setManualLocation("");
    setTab("url");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" className="gap-1" />}>
        <Plus className="h-4 w-4" />
        追加
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>式場を追加</SheetTitle>
        </SheetHeader>
        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">URLから追加</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">手動で追加</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 pt-4">
            {!extracted ? (
              <>
                <div className="space-y-2">
                  <Label>式場のURLを貼り付け</Label>
                  <div className="flex gap-2">
                    <Input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      type="url"
                    />
                    <Button onClick={handleUrlSubmit} disabled={loading || !url.trim()}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "読取"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ゼクシィ、ハナユメ、Wedding Park等のURL対応
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium">読み取り結果を確認</p>
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="font-serif font-medium">{extracted.name}</p>
                  {extracted.location && (
                    <p className="text-sm text-muted-foreground">{extracted.location}</p>
                  )}
                  {extracted.accessInfo && (
                    <p className="text-sm text-muted-foreground">{extracted.accessInfo}</p>
                  )}
                  {(extracted.capacityMin || extracted.capacityMax) && (
                    <p className="text-sm text-muted-foreground">
                      着席{extracted.capacityMin}〜{extracted.capacityMax}名
                    </p>
                  )}
                  {extracted.ceremonyStyles.length > 0 && (
                    <div className="flex gap-1">
                      {extracted.ceremonyStyles.map((s) => (
                        <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    読み取り精度: {extracted.confidence === "high" ? "高" : extracted.confidence === "medium" ? "中" : "低"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">※ 情報は後から編集できます</p>
                <div className="flex gap-2">
                  <Button onClick={handleConfirm} disabled={loading} className="flex-1">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "登録する"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setExtracted(null); setTab("manual"); }}
                    className="flex-1"
                  >
                    修正して登録
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="venue-name">式場名 *</Label>
              <Input
                id="venue-name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="アニヴェルセル表参道"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-location">エリア</Label>
              <Input
                id="venue-location"
                value={manualLocation}
                onChange={(e) => setManualLocation(e.target.value)}
                placeholder="表参道"
              />
            </div>
            <Button onClick={handleManualSubmit} disabled={loading || !manualName.trim()} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "追加する"}
            </Button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
