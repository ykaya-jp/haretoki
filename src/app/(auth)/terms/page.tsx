import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約",
  description: "Haretoki の利用条件、免責事項、AI 応答の扱いについて記載します。",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-warm)]"
      >
        ← Haretoki
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-[28px] font-light tracking-[0.01em]">
        利用規約
      </h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        最終更新: 2026 年 4 月 15 日
      </p>

      <div className="prose prose-sm mt-8 max-w-none text-[14px] leading-[1.9] text-foreground dark:prose-invert">
        <p>
          Haretoki（以下「本サービス」）をご利用いただくにあたり、以下の条件に同意いただいたものとみなします。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          1. 本サービスの位置づけ
        </h2>
        <p>
          本サービスは、おふたりの結婚式場さがしを <strong>中立の立場で支援する</strong>
          ツールです。特定の式場の予約・斡旋・広告掲載は行いません。
          本サービスが表示する情報は判断材料であり、最終的な契約・決定は
          おふたりの責任において行ってください。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          2. AI 応答の扱い
        </h2>
        <p>
          本サービスは、AI コーチ、AI 分析、AI 要約などの機能を提供します。
          AI の応答は参考情報であり、<strong>正確性や最新性を保証するものではありません</strong>。
          重要な判断にあたっては、ご自身で式場・専門家に確認してください。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          3. 禁止事項
        </h2>
        <ul className="ml-4 list-disc space-y-1">
          <li>他のユーザー、式場、運営者への誹謗中傷、名誉毀損</li>
          <li>本サービスのセキュリティを侵害する行為、不正アクセス、スクレイピング</li>
          <li>著作権、肖像権、その他の権利を侵害する投稿</li>
          <li>法令、公序良俗に反する行為</li>
        </ul>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          4. 免責事項
        </h2>
        <p>
          本サービスの利用により生じた損害について、運営者は故意または重大な過失がある場合を除き、
          一切の責任を負いません。外部サイト（式場公式、口コミサイト等）の内容については、
          当該サイトの責任となります。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          5. 規約の変更
        </h2>
        <p>
          本規約は、サービスの改善や法令改正に応じて変更されることがあります。
          変更後にサービスを継続利用された場合、変更内容に同意したものとみなします。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          6. 準拠法
        </h2>
        <p>本規約は日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>

        <p className="mt-12 text-[12px] text-muted-foreground">
          ご質問・ご指摘は、マイページのフィードバックフォームからお寄せください。
        </p>
      </div>
    </article>
  );
}
