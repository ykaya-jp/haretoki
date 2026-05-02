import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { requireUser } from "@/server/auth";
import { ContactForm } from "@/components/support/contact-form";

export const metadata: Metadata = {
  title: "サポート窓口",
  description:
    "Haretoki のよくある質問とお問い合わせフォーム。アカウント・パートナー招待・AI コーチ・写真・退会など。",
};

/**
 * /support — canonical contact channel referenced from /terms and
 * /privacy. The FAQ list is kept short (5 entries) so the form stays
 * above the fold on mobile; long-tail questions go through the form.
 */

interface FaqEntry {
  q: string;
  a: React.ReactNode;
}

const FAQ: FaqEntry[] = [
  {
    q: "パートナーから招待が届きません。どうすればいいですか？",
    a: (
      <>
        <p>
          まずは迷惑メールフォルダをご確認ください。それでも見つからない場合は、
          オーナーの方の「マイページ」→「パートナーを招く」から
          招待リンクをコピーして、手動でお相手にお送りいただけます。
        </p>
        <p>
          招待メールは Resend という外部サービスを使ってお送りしているので、
          一部の企業ドメインでは届かないことがあります。リンクの直接共有が
          確実です。
        </p>
      </>
    ),
  },
  {
    q: "AI コーチからの返事が変です。どうしたらいいですか？",
    a: (
      <>
        <p>
          AI の応答は参考情報です。事実と違っていたり、的外れな返事をすることがあります。
          重要な判断は、必ずご自身で式場・専門家にご確認ください。
        </p>
        <p>
          特に AI が困った返事をしたときは、以下のフォームから「件名: コーチが◯◯と答えた」
          のようにご共有いただけると、プロンプトの改善に役立てます。
        </p>
      </>
    ),
  },
  {
    q: "見学した式場の情報やメモを、誰かに見られることはありますか？",
    a: (
      <>
        <p>
          おふたりが追加した式場・見学メモ・評価・写真は、
          おふたりのプロジェクト内でのみ見えます。
          他のカップル、運営者の閲覧用画面、検索エンジンに表示されることはありません。
        </p>
        <p>
          技術的な仕組みについては{" "}
          <Link href="/privacy" className="text-[var(--gold-warm)] underline">
            プライバシーポリシー §3
          </Link>
          {" "}をご覧ください。
        </p>
      </>
    ),
  },
  {
    q: "登録した記録をダウンロードしたり、退会したりできますか？",
    a: (
      <>
        <p>
          いつでもできます。{" "}
          <Link href="/settings" className="text-[var(--gold-warm)] underline">
            設定
          </Link>
          {" "}画面の下部に「記録をダウンロード」と「アカウントを消す」のボタンがあります。
        </p>
        <p>
          ダウンロードは JSON ファイルでお手元に保存できます。
          退会はメールアドレスの確認をはさんで実行され、おふたりのプロジェクトに紐づく
          すべての記録が完全に削除されます。退会後の復元はできません。
        </p>
      </>
    ),
  },
  {
    q: "費用はかかりますか？",
    a: (
      <>
        <p>
          現在は無料でお使いいただけます。将来、有料プランをご用意する場合は、
          ログイン後の画面で必ず事前にお知らせします。
          無料機能のままお使いいただきたい方には、無料プランを維持できる仕組みも検討中です。
        </p>
      </>
    ),
  },
];

export default async function SupportPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-12 px-4 pb-32 pt-6">
      {/* Hero — keeps the support page in line with the editorial tone of
          the rest of the app. LifeBuoy gold accent matches the mypage
          row icon so couples recognise the surface. */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--gold-warm)]">
          <LifeBuoy className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
          Support
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-[28px] font-light leading-[1.25] tracking-[-0.01em]">
          困ったときの窓口
        </h1>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          式場さがしの途中でつまずいたら、こちらからお声がけください。
          よくある質問でほとんどのことは解決できます。
        </p>
      </header>

      {/* FAQ — native <details> so it works without JS. The state is in
          the DOM, no hydration cost, no flicker. */}
      <section aria-labelledby="faq-heading" className="space-y-4">
        <h2
          id="faq-heading"
          className="font-[family-name:var(--font-display)] text-[18px] font-light"
        >
          よくある質問
        </h2>
        <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] divide-y divide-border/50">
          {FAQ.map((entry, i) => (
            <details
              key={i}
              className="group [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[14px] leading-relaxed transition-colors hover:bg-muted/40 active:scale-[0.995]">
                <span className="flex-1">{entry.q}</span>
                <span
                  aria-hidden="true"
                  className="text-[18px] font-light text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="space-y-3 px-5 pb-5 text-[13.5px] leading-[1.85] text-foreground/85">
                {entry.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Contact form — receives the user's email as a default Reply-To
          so couples don't have to retype it. The form itself is the
          canonical channel referenced from /terms and /privacy. */}
      <section aria-labelledby="contact-heading" className="space-y-4">
        <h2
          id="contact-heading"
          className="font-[family-name:var(--font-display)] text-[18px] font-light"
        >
          お問い合わせ
        </h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          上の質問にない内容は、こちらからお気軽にどうぞ。
          通常 3 営業日以内にお返事します。
        </p>
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
          <ContactForm defaultReplyTo={user.email ?? ""} />
        </div>
      </section>

      <p className="text-[12px] text-muted-foreground">
        まずは{" "}
        <Link href="/help" className="text-[var(--gold-warm)] underline">
          ヘルプセンター
        </Link>
        {" "}でお探しの内容が見つかるかもしれません。
        個人情報の取り扱いについては{" "}
        <Link href="/privacy" className="text-[var(--gold-warm)] underline">
          プライバシーポリシー
        </Link>
        {" "}を、利用条件は{" "}
        <Link href="/terms" className="text-[var(--gold-warm)] underline">
          利用規約
        </Link>
        {" "}をご確認ください。
      </p>
    </div>
  );
}
