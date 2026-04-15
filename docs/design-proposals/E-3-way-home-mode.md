# E-3 帰り道モード — 見学直後 3 分キャプチャ

**モック**: [mockups/e-3-way-home-mode.html](../mockups/e-3-way-home-mode.html)
**優先度**: H
**関連**: W-4 (熱を逃さない), Visit model, PWA push (R4)

---

## What

Visit が `completed` になった直後、ブラウザ / PWA から **「帰り道モード」** を提案する小さなバナー or push 通知が届く。タップすると **3 分で埋まる** 超軽量入力画面へ。

- 画面はフルスクリーン 1 ペイン、親指だけで完了できる
- 3 つの設問: 気持ち / 一番よかったこと / 引っかかったこと
- + 写真 1 枚（任意）+ 音声メモ（任意、Web Speech API）
- 完了すると VisitRating / VisitNote に自動反映
- スキップ/延期可能（「帰宅後まとめて」が retry CTA）

### 設問設計

**Q1. 今の気持ちを絵文字で（3 択 + 絵文字ピッカー）**
☀️ 晴れやか / 🌤 明るめ / ☁️ もやもや / （その他）

**Q2. 一番よかったことは？（tag 3 選 + 自由記述）**
料理 / 空間 / スタッフ / 光 / 演出提案 / その他

**Q3. 引っかかったことは？（同じ tag 構造、skip 可）**

**Q4. 写真 1 枚追加（今撮るボタン or カメラロール）**

**Q5. 音声メモ 15 秒（Web Speech → 自動文字起こし）**

---

## Why

### ユーザー不
- **熱の消失**: 見学終了 15 分後が一番記憶が鮮明。帰宅してから入力だと情報が半減
- **電車内の手軽さ不足**: 現在の `/venues/[id]/evaluate` は PC or デスク前提の UI
- **2 件目の式場と混ざる**: 複数式場見学した日、帰宅時にはどの印象がどっちか曖昧
- **夫の即時参加**: 帰り道に 2 人でスマホを見ながら話せる設計 → 後で妻 1 人でまとめるより自然

### プロダクト効果
- **データ質**: visit ratings の覚え書き memo に "生の声" が増える → AI 要約の材料が質的向上
- **twice-a-month VDR**: 見学平均 3-5 件 × 2 ヶ月 = 帰り道モード 10-15 回の発火点
- **PWA 通知の最初の正当化**: 通知許可の説得力が強い（"見学終わったら教えます" は OK と言いやすい）

---

## How

### トリガー

1. **In-app**: `/venues/[id]/visits` で visit.status を `scheduled → completed` に更新した瞬間、トーストに「帰り道モードで印象を残しますか？」ボタン
2. **PWA push**（R4 連携）: visit.scheduledAt から 2 時間後に「見学おつかれさまでした。帰り道モードで 3 分、印象を残しますか？」
3. **deep link**: 通知タップ or QR（見学時に妻に渡す簡易シート）で `/visits/[visitId]/way-home` へ直接遷移

### 画面構成

```
/visits/[visitId]/way-home
```

- Server Component で visit + venue を取得
- `<WayHomeFlow visit={...} />` client component に渡す
- ステップ式（Step 1/5, 2/5, ...）、プログレスバーは極薄 gold line
- 各ステップの高さ固定、下部に primary + skip（"あとでまとめる"）

### データ保存

既存 `Visit` / `VisitRating` / `VisitNote` を活用。新規モデル不要:

```ts
// 構造
Visit
  ├─ ratings: VisitRating[]    // Q1 = dimension="way_home_mood" score 1-5
  ├─ notes: VisitNote[]        // Q2, Q3 = content + tags
  └─ photos  (visit.photoUrls) // Q4

+ speech transcript → notes[tag="voice"] として保存
```

新しい enum value:
```prisma
enum ScoreDimension {
  atmosphere
  cuisine
  hospitality
  cost
  access
  reviews
  way_home_mood   // 新規
}
```

### Server Action

```ts
// src/server/actions/way-home.ts
"use server";

export async function submitWayHome(
  visitId: string,
  payload: {
    mood: 1 | 2 | 3 | 4 | 5;
    goodTags: string[];
    goodNote?: string;
    concernTags?: string[];
    concernNote?: string;
    photoUrl?: string;
    voiceTranscript?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const { projectId } = await requireVisitAccess(user.id, visitId);

  await prisma.$transaction([
    prisma.visitRating.create({
      data: { visitId, userId: user.id, dimension: "way_home_mood", score: payload.mood },
    }),
    prisma.visitNote.create({
      data: {
        visitId,
        userId: user.id,
        content: payload.goodNote ?? "",
        tags: ["way_home_good", ...payload.goodTags],
      },
    }),
    ...(payload.concernTags?.length ? [prisma.visitNote.create({
      data: {
        visitId,
        userId: user.id,
        content: payload.concernNote ?? "",
        tags: ["way_home_concern", ...payload.concernTags],
      },
    })] : []),
    ...(payload.voiceTranscript ? [prisma.visitNote.create({
      data: {
        visitId,
        userId: user.id,
        content: payload.voiceTranscript,
        tags: ["voice", "way_home"],
      },
    })] : []),
  ]);

  // Optional: photo upload 既に photoUrl がアップロード済の前提

  await revalidateTag(`venue:${visit.venueId}`);
  return { ok: true };
}
```

### UI — 5 ステップ

```tsx
// src/components/visits/way-home-flow.tsx
type Step = "mood" | "good" | "concern" | "photo" | "voice" | "done";

export function WayHomeFlow({ visit, venue }: Props) {
  const [step, setStep] = useState<Step>("mood");
  const [mood, setMood] = useState<number>(0);
  // ...

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Progress hairline */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 pt-4 pb-3">
        <p className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          {venue.name} · 帰り道モード · {stepIndex(step)}/5
        </p>
        <div
          className="mt-2 h-[2px] w-full bg-muted rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-[var(--gold-warm)] transition-all duration-500 ease-out"
            style={{ width: `${(stepIndex(step) / 5) * 100}%` }}
          />
        </div>
      </div>

      <main className="flex-1 px-6 py-8">
        {step === "mood" && <MoodStep value={mood} onChange={setMood} />}
        {step === "good" && <GoodStep />}
        {/* ... */}
      </main>

      <footer className="sticky bottom-0 bg-background/80 backdrop-blur-md px-6 py-4 pb-[env(safe-area-inset-bottom)]">
        <Button size="lg" className="w-full h-12 rounded-[14px]" onClick={next}>
          次へ
        </Button>
        <button className="mt-2 w-full text-[12.5px] text-muted-foreground" onClick={skip}>
          あとでまとめる
        </button>
      </footer>
    </div>
  );
}
```

### Voice メモ（Web Speech API）

```ts
// src/lib/hooks/use-speech-transcript.ts
export function useSpeechTranscript() {
  const [transcript, setTranscript] = useState("");
  const [state, setState] = useState<"idle" | "listening" | "error">("idle");
  // navigator.mediaDevices + SpeechRecognition polyfill for mobile Safari
  // chromium: window.webkitSpeechRecognition lang='ja-JP'
  // fallback: audio record → upload → OpenAI Whisper on server
  // ...
  return { transcript, state, start, stop };
}
```

Safari iOS は `SpeechRecognition` 未対応なので fallback として:
- `<input type="file" accept="audio/*" capture />` で録音した audio を Supabase にアップロード
- Server で `@anthropic-ai/sdk` + Claude Vision 相当が音声非対応のため、OpenAI Whisper API を薄く呼ぶ or Supabase Edge Function 側で対応

### PWA 通知（R4 で実装予定、今回は in-app トーストのみ）

```ts
// scheduleVisit 完了時:
// 1. visit.status = 'scheduled', scheduledAt = TIMESTAMP
// 2. Vercel Cron (毎時) が "過ぎた visit" を検出
// 3. project.members の push subscription に通知
// 4. タップで /visits/[id]/way-home へ
```

---

## 実装見積もり

| Phase | 内容 | 工数 |
|---|---|---|
| DB | ScoreDimension.way_home_mood 追加 + migration | 10 分 |
| Server Action | submitWayHome + Zod + revalidate | 45 分 |
| UI | WayHomeFlow 5 ステップ + Step components | 3 時間 |
| Voice | useSpeechTranscript + Safari fallback | 90 分 |
| トリガー | visits UI から "帰り道モードへ" CTA | 30 分 |
| Deep link | /visits/[id]/way-home page + layout | 30 分 |
| **合計** | | **約 6.5 時間** |

---

## KPI

- Visit completion 直後 1 時間以内の way-home 完了率: 50%+
- VisitNote の tags に `way_home_*` が含まれる割合: 30%+
- 見学 3 件平均でレビュー情報量が 2 倍（文字数・写真数・音声文字数）
