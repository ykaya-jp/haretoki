import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "ヘルプセンター",
  description:
    "Haretoki の使い方ガイドとよくある質問。アカウント・評価・見積もり・AI コーチ・通知・退会・複数端末同期について。",
};

/**
 * /help — read-only knowledge base.
 *
 * Sister surface to /support: /support is the contact-form first
 * "I have a problem to report" entry point; /help is the
 * "let me read up on how this works" entry point. Both link to
 * each other from the bottom — couples bouncing between them
 * never hit a dead end.
 *
 * Source of truth: docs/help/README.md tracks the FAQ vocabulary
 * and docs/help/troubleshooting.md holds the long-form
 * troubleshooting steps. The 10 FAQ rows below MUST be kept in
 * sync with docs/help/README.md so a future maintainer doesn't
 * read two diverging versions.
 */

interface HelpEntry {
  q: string;
  a: React.ReactNode;
}

const FAQ: HelpEntry[] = [
  {
    q: "アカウント登録に必要なものはありますか？",
    a: (
      <>
        <p>
          メールアドレスがあれば、 Google アカウントとメールリンクの
          どちらでもサインアップできます。クレジットカードや本人確認書類は
          必要ありません (現状は無料サービスです)。
        </p>
        <p>
          パスワードを忘れた場合は、 ログイン画面の「パスワードをお忘れですか？」
          からリセットメールを受け取ってください。
        </p>
      </>
    ),
  },
  {
    q: "パートナーを招待するにはどうすればいいですか？",
    a: (
      <>
        <p>
          マイページ →「パートナーを招く」から招待リンクを生成できます。
          リンクを LINE やメールで相手に送り、 タップしてサインアップしてもらえれば
          自動的に同じプロジェクトに参加します。
        </p>
        <p>
          メールが届かない場合は、 リンクを直接コピーして送る方法が確実です。
        </p>
      </>
    ),
  },
  {
    q: "評価 (rating) は二人で別々に入れられますか？",
    a: (
      <>
        <p>
          はい。 おふたりそれぞれが、 自分の視点で 6 次元 (雰囲気・料理・
          コスパ・スタッフ・アクセス・設備) の評価を入れられます。
          相手が入れた評価はあとで「比べる」 surface で並べて見ることが
          できます。
        </p>
        <p>
          自分の評価は自分のもの — オーナーが partner の評価を編集することは
          できません。逆も同じです。
        </p>
      </>
    ),
  },
  {
    q: "見積もりの PDF はどう取り込めばいいですか？",
    a: (
      <>
        <p>
          式場詳細ページの「見積」タブから PDF をアップロードできます。
          AI が自動で項目と金額を読み取り、 内訳に変換します。
          読み取り結果は次の画面で必ず手動確認・編集できます。
        </p>
        <p>
          スキャン画像のみの PDF や、 解像度が低いものは認識精度が下がる
          ことがあります。 そのときは内訳を直接入力してください。
        </p>
      </>
    ),
  },
  {
    q: "AI コーチの返事が事実と違う気がします",
    a: (
      <>
        <p>
          AI の応答は参考情報です。 事実と違うこと、 的外れな返事をすることが
          あります。 重要な判断は、 必ずご自身で式場・専門家にご確認ください。
        </p>
        <p>
          困った返事があったときは、 サポート窓口から「件名: コーチが◯◯と
          答えた」 のようにご共有いただけると、 プロンプトの改善に活かします。
        </p>
      </>
    ),
  },
  {
    q: "リマインダーや通知が届かないときは？",
    a: (
      <>
        <p>
          マイページ →「通知」で、 リマインダーの種類ごと (前日 19 時 / 当日朝 /
          帰り道) に on/off を設定できます。 端末 OS の通知許可がオフに
          なっていると、 アプリ側が ON でも届きません。
        </p>
        <p>
          メールが急に届かなくなった場合は、 配信エラーの自動検知で停止
          している可能性があります。 マイページから「メールを再開する」
          ボタンが出ていればタップしてください。
        </p>
      </>
    ),
  },
  {
    q: "退会したい / 記録をダウンロードしたい",
    a: (
      <>
        <p>
          マイページ →{" "}
          <Link href="/settings" className="text-[var(--gold-warm)] underline">
            設定
          </Link>
          {" "}画面の下部に「記録をダウンロード」と「アカウントを消す」のボタンがあります。
        </p>
        <p>
          ダウンロードは JSON ファイル (式場・見学・評価・候補・決めた場所・
          AI コーチとの会話のすべて) としてお手元に保存できます。 退会はメールアドレス確認の
          うえ実行され、 おふたりの記録は完全に削除されます。 復元はできません。
        </p>
      </>
    ),
  },
  {
    q: "情報のセキュリティはどうなっていますか？",
    a: (
      <>
        <p>
          おふたりが追加した式場・見学メモ・評価・写真は、 おふたりのプロジェクト内でのみ
          見えます。 他のカップル、 運営者の閲覧用画面、 検索エンジンに表示されることはありません。
        </p>
        <p>
          技術的な詳細は{" "}
          <Link href="/privacy" className="text-[var(--gold-warm)] underline">
            プライバシーポリシー
          </Link>
          {" "}§3「パートナー以外には見えません」 に記載しています。
        </p>
      </>
    ),
  },
  {
    q: "別の端末で同時に編集すると、 内容はどうなりますか？",
    a: (
      <>
        <p>
          基本は「あとから保存した方が勝ち (Last Write Wins)」 の方式です。
          Realtime 同期で 1〜2 秒以内に相手側の画面にも反映されるので、 操作の重なりは
          そのとき気付けます。
        </p>
        <p>
          オフライン時の編集は端末側で一時保存され、 オンラインに戻ったときに
          自動でサーバーに送信されます。「保存待機中」 の表示が出ているあいだは、 まだ送信が
          完了していないサインです。
        </p>
      </>
    ),
  },
  {
    q: "ここに載っていないことを聞きたい",
    a: (
      <>
        <p>
          いつでも{" "}
          <Link href="/support" className="text-[var(--gold-warm)] underline">
            サポート窓口
          </Link>
          {" "}からお問い合わせください。 通常 3 営業日以内にお返事します。
        </p>
        <p>
          詳しいトラブルシューティング手順は{" "}
          <a
            href="https://github.com/ykaya-jp/haretoki/blob/main/docs/help/troubleshooting.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--gold-warm)] underline"
          >
            docs/help/troubleshooting.md
          </a>
          {" "}にも公開しています。
        </p>
      </>
    ),
  },
];

export default async function HelpPage() {
  // Auth gate — same posture as /support: the help center is part of
  // the in-app surface, not a marketing page. Couples reaching here
  // are signed in.
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-12 px-4 pb-32 pt-6">
      {/* Hero — book metaphor instead of /support's lifebuoy. The
          two surfaces ARE different intents and the iconography
          should follow. */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--gold-warm)]">
          <BookOpen
            className="h-3.5 w-3.5"
            strokeWidth={1.6}
            aria-hidden="true"
          />
          Help
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-[28px] font-light leading-[1.25] tracking-[-0.01em]">
          ヘルプセンター
        </h1>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          式場さがしの過程で気になることを、 この一画面にまとめました。
          解決しないときは、 一番下の「お問い合わせ」 から相談できます。
        </p>
      </header>

      {/* FAQ — native <details> so it works without JS hydration cost.
          10 entries; couples scan headlines + open the relevant ones. */}
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

      {/* Contact bridge — quiet panel to /support, mirrors the
          /support page's link to /help so neither surface is a
          dead end. */}
      <section className="rounded-2xl border bg-card/40 p-5 shadow-[var(--shadow-card)]">
        <p className="text-eyebrow text-[var(--gold-warm)]">困ったときは</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-[18px] font-light">
          ここに載っていないことは、 サポート窓口へ
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          フォームに状況をお書きいただければ、 通常 3 営業日以内にお返事します。
        </p>
        <Link
          href="/support"
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-[var(--gold-warm)] hover:text-foreground"
        >
          サポート窓口へ進む
          <ArrowRight
            className="h-4 w-4"
            strokeWidth={1.6}
            aria-hidden="true"
          />
        </Link>
      </section>

      <p className="text-[12px] text-muted-foreground">
        利用条件は{" "}
        <Link href="/terms" className="text-[var(--gold-warm)] underline">
          利用規約
        </Link>
        {" "}を、 個人情報の取り扱いは{" "}
        <Link href="/privacy" className="text-[var(--gold-warm)] underline">
          プライバシーポリシー
        </Link>
        {" "}をご確認ください。
      </p>
    </div>
  );
}
