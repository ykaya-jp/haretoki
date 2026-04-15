"use client";

// Demo data provider — in-memory, client-only mock data that simulates the
// real app experience for unauthenticated visitors on /demo/*. No DB, no
// server actions; all interactions are local state.
//
// Types here intentionally mirror the shape of Prisma models at the field
// level that the UI consumes, but are standalone (no Prisma imports) to keep
// the demo bundle isolated from the real data layer.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface DemoVenue {
  id: string;
  name: string;
  location: string;
  accessInfo: string;
  capacityMin: number;
  capacityMax: number;
  ceremonyStyles: string[];
  photoUrls: string[];
  status: "researching" | "shortlisted" | "visited" | "decided";
  costMin: number;
  costMax: number;
  dressBringIn: "allowed" | "not_allowed" | "negotiable";
  /** user_rating average, 1–5 */
  rating: number | null;
  /** Summary review snippets */
  reviews: Array<{
    id: string;
    rating: number;
    title: string;
    body: string;
    source: "google" | "hanayume" | "mynavi";
  }>;
  /** AI personalized recommendation chips */
  personalizedChips: string[];
}

export interface DemoEstimate {
  venueId: string;
  total: number;
  predictedFinal: number;
  items: Array<{
    category: "catering" | "attire" | "flowers" | "photo" | "venue" | "other";
    itemName: string;
    amount: number;
    predictedUpgrade: number;
  }>;
}

export interface DemoVisit {
  venueId: string;
  visitedAt: string;
  checklist: Array<{ label: string; status: "good" | "concern" | "unchecked" }>;
  note: string;
}

export interface DemoCoachTurn {
  role: "user" | "assistant";
  content: string;
}

export interface DemoInsight {
  id: string;
  title: string;
  body: string;
}

// ── Mock dataset ──────────────────────────────────────────────────────────────
// IDs are stable strings (not UUIDs) so /demo/venues/[id] routes read cleanly.

const VENUES: DemoVenue[] = [
  {
    id: "aoyama-grace",
    name: "青山グレイスチャペル",
    location: "東京都港区南青山",
    accessInfo: "表参道駅 徒歩5分",
    capacityMin: 20,
    capacityMax: 80,
    ceremonyStyles: ["チャペル", "ガーデン"],
    photoUrls: ["/images/demo/venue-aoyama-1.jpg", "/images/demo/venue-aoyama-2.jpg"],
    status: "shortlisted",
    costMin: 3200000,
    costMax: 4200000,
    dressBringIn: "allowed",
    rating: 4.6,
    reviews: [
      {
        id: "r-a-1",
        rating: 5,
        title: "光が美しいチャペルでした",
        body: "午後の自然光がとても綺麗で、ゲストからの評判もよかったです。スタッフの対応も丁寧。",
        source: "google",
      },
      {
        id: "r-a-2",
        rating: 4,
        title: "料理が想像以上",
        body: "試食でも本番でも、特にお肉料理のクオリティが高く満足でした。",
        source: "hanayume",
      },
    ],
    personalizedChips: ["自然光の映えるチャペル", "駅近", "少人数〜中規模向き"],
  },
  {
    id: "kamakura-hana",
    name: "鎌倉 花暦",
    location: "神奈川県鎌倉市",
    accessInfo: "鎌倉駅 徒歩8分",
    capacityMin: 10,
    capacityMax: 50,
    ceremonyStyles: ["和装", "神前"],
    photoUrls: ["/images/demo/venue-kamakura-1.jpg"],
    status: "visited",
    costMin: 2600000,
    costMax: 3400000,
    dressBringIn: "negotiable",
    rating: 4.3,
    reviews: [
      {
        id: "r-k-1",
        rating: 4,
        title: "静かで落ち着いた雰囲気",
        body: "家族中心のアットホームな式にぴったり。古民家の造りが素敵でした。",
        source: "google",
      },
    ],
    personalizedChips: ["和装◎", "少人数向き", "落ち着いた雰囲気"],
  },
  {
    id: "yokohama-bay",
    name: "横浜ベイサイドテラス",
    location: "神奈川県横浜市",
    accessInfo: "みなとみらい駅 徒歩3分",
    capacityMin: 40,
    capacityMax: 150,
    ceremonyStyles: ["チャペル", "人前式"],
    photoUrls: ["/images/demo/venue-yokohama-1.jpg"],
    status: "researching",
    costMin: 3800000,
    costMax: 5200000,
    dressBringIn: "not_allowed",
    rating: 4.1,
    reviews: [
      {
        id: "r-y-1",
        rating: 4,
        title: "夜景が最高でした",
        body: "ベイブリッジの夜景をバックに披露宴ができて、ゲストが盛り上がりました。",
        source: "mynavi",
      },
    ],
    personalizedChips: ["夜景◎", "大人数対応", "アクセス良好"],
  },
];

const ESTIMATES: Record<string, DemoEstimate> = {
  "aoyama-grace": {
    venueId: "aoyama-grace",
    total: 3_480_000,
    predictedFinal: 4_260_000,
    items: [
      { category: "venue", itemName: "挙式・会場使用料", amount: 450_000, predictedUpgrade: 0 },
      { category: "catering", itemName: "料理・飲み物(60名)", amount: 1_380_000, predictedUpgrade: 180_000 },
      { category: "attire", itemName: "衣装(新婦・新郎)", amount: 520_000, predictedUpgrade: 320_000 },
      { category: "flowers", itemName: "装花", amount: 280_000, predictedUpgrade: 150_000 },
      { category: "photo", itemName: "写真・映像", amount: 380_000, predictedUpgrade: 80_000 },
      { category: "other", itemName: "その他(引出物ほか)", amount: 470_000, predictedUpgrade: 50_000 },
    ],
  },
};

const VISITS: DemoVisit[] = [
  {
    venueId: "kamakura-hana",
    visitedAt: "2026-03-22",
    checklist: [
      { label: "チャペルの雰囲気", status: "good" },
      { label: "披露宴会場の広さ", status: "good" },
      { label: "料理の試食", status: "good" },
      { label: "スタッフの対応", status: "good" },
      { label: "駐車場の台数", status: "concern" },
      { label: "控室の広さ", status: "unchecked" },
    ],
    note: "静かで落ち着いた雰囲気。和装が映える。両親も気に入っていた。",
  },
];

const COACH_TRANSCRIPT: DemoCoachTurn[] = [
  {
    role: "user",
    content: "60名くらいで、自然光の入る落ち着いた雰囲気の式場を探しています。",
  },
  {
    role: "assistant",
    content:
      "ご希望の条件から、青山グレイスチャペル(港区)が第一候補になりそうです。午後の自然光が入るチャペルで、60名に最適な規模。衣装持ち込みが可能なので費用面でも調整しやすいです。",
  },
  {
    role: "user",
    content: "見積もりで気をつけることは？",
  },
  {
    role: "assistant",
    content:
      "最初の見積もりから平均+84〜110万円上がる傾向があります。特に「衣装」「装花」「写真」はグレードアップで膨らみやすいです。ふたりで「最低ライン」を決めておくと、商談時に迷いにくくなります。",
  },
  {
    role: "user",
    content: "見学のときにチェックすべきポイントは？",
  },
  {
    role: "assistant",
    content:
      "① チャペル・披露宴会場の光の入り方(時間帯で確認)、② ゲスト動線(控室→チャペル→披露宴)、③ 料理の試食、④ スタッフの対応、⑤ 当日持込物のルール、の5つは必ず押さえましょう。Haretokiの見学リストが当日そのまま使えます。",
  },
];

const INSIGHTS: DemoInsight[] = [
  {
    id: "insight-1",
    title: "青山グレイスチャペルは、おふたりの条件にマッチ度が高いです",
    body: "「自然光」「少人数〜中規模」「衣装持ち込み可」という希望が揃っており、予算レンジも近いです。一度見学を検討してみてください。",
  },
  {
    id: "insight-2",
    title: "見積もりで注意すべき項目: 衣装・装花",
    body: "同等の会場の口コミから、衣装は+32万円、装花は+15万円ほど上がる傾向があります。試着時に上限を決めておくと安心です。",
  },
];

// ── Context ───────────────────────────────────────────────────────────────────

interface DemoDataContextValue {
  venues: DemoVenue[];
  favorites: Set<string>;
  toggleFavorite: (venueId: string) => void;
  estimates: Record<string, DemoEstimate>;
  visits: DemoVisit[];
  coachTranscript: DemoCoachTurn[];
  insights: DemoInsight[];
  getVenue: (id: string) => DemoVenue | undefined;
}

const DemoDataContext = createContext<DemoDataContextValue | null>(null);

// Initial favorites: 2 of the 3 venues are pre-liked.
const INITIAL_FAVORITES = new Set<string>(["aoyama-grace", "kamakura-hana"]);

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(INITIAL_FAVORITES),
  );

  const toggleFavorite = useCallback((venueId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(venueId)) next.delete(venueId);
      else next.add(venueId);
      return next;
    });
  }, []);

  const getVenue = useCallback((id: string) => VENUES.find((v) => v.id === id), []);

  const value = useMemo<DemoDataContextValue>(
    () => ({
      venues: VENUES,
      favorites,
      toggleFavorite,
      estimates: ESTIMATES,
      visits: VISITS,
      coachTranscript: COACH_TRANSCRIPT,
      insights: INSIGHTS,
      getVenue,
    }),
    [favorites, toggleFavorite, getVenue],
  );

  return <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>;
}

export function useDemoData(): DemoDataContextValue {
  const ctx = useContext(DemoDataContext);
  if (!ctx) {
    throw new Error("useDemoData must be used within <DemoDataProvider>");
  }
  return ctx;
}
