import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "Haretoki の個人情報の取り扱い、Cookie、AI への入力の扱いについて記載します。",
};

/**
 * Minimum viable privacy policy covering:
 *  - 取得情報 (Supabase Auth email, display name, browser session)
 *  - 利用目的
 *  - Claude / PostHog / Sentry / Vercel Analytics など外部共有
 *  - 削除要求の窓口
 *  - Cookie / localStorage
 *
 * Written to be read by end-users, not lawyers. Will be replaced by a
 * reviewed version once legal process is in place.
 */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-warm)]"
      >
        ← Haretoki
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-[28px] font-extralight tracking-[0.01em]">
        プライバシーポリシー
      </h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        最終更新: 2026 年 4 月 15 日
      </p>

      <div className="prose prose-sm mt-8 max-w-none text-[14px] leading-[1.9] text-foreground dark:prose-invert">
        <p>
          Haretoki（以下「本サービス」）は、おふたりの結婚式場さがしをお手伝いするため、
          以下の通り個人情報を取り扱います。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          1. 取得する情報
        </h2>
        <ul className="ml-4 list-disc space-y-1">
          <li>アカウント情報（メールアドレス、お名前、パートナーの紐付け情報）</li>
          <li>本サービスで入力した式場情報、見学メモ、評価、見積もり、写真、音声、チャット内容</li>
          <li>Cookie / localStorage（ログイン状態、テーマ、UI 設定の保存）</li>
          <li>サービス改善のための匿名アクセスログ（PostHog、Vercel Analytics）</li>
          <li>エラー監視のためのクラッシュレポート（Sentry）</li>
        </ul>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          2. 利用目的
        </h2>
        <ul className="ml-4 list-disc space-y-1">
          <li>本サービスの提供、個別化、パートナーとの共有</li>
          <li>AI コーチ、見積もり分析、口コミ要約などの AI 機能の提供</li>
          <li>サービスの品質向上、不具合調査</li>
          <li>重要なお知らせのメール送信（今後対応予定）</li>
        </ul>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          3. 外部への提供
        </h2>
        <p>
          AI 機能の提供にあたり、ユーザーが入力した内容の一部が
          Anthropic 社（Claude）に送信されます。個人を特定する情報は事前に匿名化します。
          その他の外部サービス（Supabase、Vercel、Sentry、PostHog）には、
          サービス提供の最小限の範囲でのみ情報を渡します。
          これらのサービスは日本国外のサーバーで処理される場合があります。
        </p>
        <p>
          式場様や広告主には、おふたりの個人情報を一切提供しません。
          Haretoki は <strong>中立の立場</strong> で運営します。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          4. 削除のご請求
        </h2>
        <p>
          マイページ →「整える」→「アカウントを消す」から、本サービスに保存した
          おふたりのすべての情報を削除できます。削除後は復元できません。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          5. Cookie と localStorage
        </h2>
        <p>
          本サービスは、ログイン状態の維持、テーマ設定の記憶、AI 分析キャッシュの
          管理に Cookie と localStorage を使用します。広告目的の Cookie は使いません。
        </p>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-[18px] font-normal">
          6. お問い合わせ
        </h2>
        <p>
          プライバシーに関するお問い合わせは、マイページのフィードバックフォーム、
          または本サービスのリポジトリを通じてご連絡ください。
        </p>

        <p className="mt-12 text-[12px] text-muted-foreground">
          本ポリシーは改善のため予告なく変更されることがあります。
          重要な変更時にはログイン後の画面でお知らせします。
        </p>
      </div>
    </article>
  );
}
