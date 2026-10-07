# トラブルシューティングと引き継ぎ記録

期待した動作と異なる場合は、日付付きの記録を追記します。期待、観察、判明している原因、対応／次の手順、根拠を含めてください。秘密情報や顧客の生の応答は記載しないでください。

## 2026-10-05: ドキュメントのひな形

- 期待: アプリや実環境を変更せず、単独で読める開発引き継ぎ資料を作成する。
- 観察: README、手順書、設計概要、ADR、ローカル用Issue草案、テスト計画を用意した。ビルド／テスト／実行コマンド、CI、依存関係、リモートリポジトリ、投稿済みIssueは存在しない。
- 対応: Bootstrapを部分完了と記録する。実装とは別タスクとして、独立したドキュメントレビューを行う。モデル接続とComposeは未テスト。
- 引き継ぎ所見: 公開された開発ひな形について、追加の指示上の摩擦は見つからなかった。技術的な実行結果を主張するものではない。
- 根拠: ひな形に含まれる8つのドキュメント／設定ファイル。実行時テスト出力は存在しない。

## 2026-10-05: TypeSafeネイティブのスモークテスト契約レビュー

- 期待: 実環境での追加確認計画が、JevのTypeSafeネイティブ契約と通常のLLMアダプターを区別する。
- 観察: 計画にはネイティブスキーマのスモークテストが含まれていたが、ChatCompletionへの変換を明示的に禁止していなかった。レビューでは、実行時障害ではなく、中程度のリスクを伴う曖昧さと分類した。
- 対応: TypeSafeネイティブルート、JSON文字列の状態、回答スキーマをスモークテストし、Jevのリクエスト／応答をChatCompletion経由で変換しないことを必須とした。8つのひな形ファイルすべてに対する独立した最終ドキュメントレビューは合格し、ローカルのMarkdownリンクも解決した。これはドキュメントのみの検証であり、実装や実環境の準備状況を検証したものではない。
- 根拠: [テスト計画](test-plan.md)。実行時動作は未テスト。

## 2026-10-05: オフライン実装とローカル検査

- 期待: 既定UIと契約テストはオフラインのまま維持し、独立した実環境経路にはゲートを設ける。実データや認証情報は不要とする。
- 観察: リポジトリにfixture UI、明示的に設定するlive dispatch境界、投影済みMCPラッパー、リクエストIDの再送防止、プロセス内比較スナップショット保存領域、モックによる単体テスト23件が追加された。実環境、モデル、MCP、ネイティブJevの接続は未検証。
- 検査: `npm run lint` 成功、`npm run typecheck` 成功、`npm test` は1ファイル／23テストで成功、`npm run secret-scan` は35ファイル／検出0件、`NEXT_TELEMETRY_DISABLED=1 npm run build` 成功。ビルドにより `/`、`/api/live`、`/api/live/readiness`、`/api/offline` が生成された。
- 対応: 独立コードレビューとlocalhostのブラウザースモークテストに合格。[ブラウザー証拠](evidence/browser-smoke.md)を参照。live mode、外部業務API呼び出し、有料モデルリクエスト、Compose、認証情報へのアクセスは無効のまま維持する。
- 根拠: 上記ローカルコマンドは固定された依存関係とfixture／モック通信を使用。production buildではlive経路やエンドポイントをテストしていない。

## 2026-10-05: UIでルーブリックとJevの根拠を分離

- 期待: 問い合わせ、投影済み事実、ホスト側ルーブリック、Jevの結果を別々の根拠として表示し、LLMによる補足は判定と分離する。
- 観察: ローカルUIスモークで、ホスト側ルーブリックと判定カードが同じパネルにあり、優先順位付き評価基準が表示されていないことが分かった。
- 対応: バージョン管理されたルーブリックを、TypeSafeリクエスト生成器とUIの双方が使う共有データモジュールへ移した。live表示とfixture表示にルーブリック欄とJev欄を分けて追加し、補足は独立したラベル付き欄に置いた。またJev失敗後に誤解を招く補足メッセージが出ていたため、事実不足と表示する代わりに判定失敗を報告するよう修正した。最終表示の再確認と独立した重要コードレビューに合格。[ブラウザー証拠](evidence/browser-smoke.md)を参照。
- 根拠: ルーブリックは `insurance-intake-v1`。単体テストで、表示する選択肢と優先度尺度がネイティブリクエストデータと一致することを確認。

## 2026-10-05: オフライン引き継ぎの検証

- 独立レビュー: 重要なコードと契約の確認に合格。レビュアーが単体テスト22件とtypecheckを独立して再実行した。
- ブラウザー確認: 3つのシナリオ、比較fixture、3種類すべてのエラーfixture、根拠の分離、既定で固定されたlive readinessを確認。[ブラウザー証拠](evidence/browser-smoke.md)を参照。
- 最終公開前確認: secret scanはテキストファイル35件／検出0件、Gitの空白検査に合格。
- 残る制約: live LLM／MCP／Gateway／ネイティブJev接続、provider／modelの固定、推奨品質、Gatewayレベルのretry制御は未検証。プロセス内再送防止／スナップショットの制約は文書化済み。実環境は有効化していない。
- 引き継ぎ所見: ネイティブスキーマと上流エラーのプライバシー境界について、明示的な契約テストが必要だった。このオフライン引き継ぎに追加のワークフロー変更は不要。

## 2026-10-05: プロセス再起動までリクエスト予約を保持

- 期待: プロセス稼働中は、liveリクエストIDの再送により、時間経過後や失敗後に2回目のJev試行を予約できない。
- 観察: もとのsingle-flightエントリーは15分後に期限切れとなり、エージェント呼び出しごとに新しいターン単位の試行台帳が作成されていた。
- 対応: リクエストID、fingerprint、結果promiseをプロセスの全稼働期間保持するよう変更した。異なるpayloadは競合扱い、失敗した予約も消費済みとし、4,096件の上限に達した場合は安全側に倒して拒否する。スナップショットの期限切れ処理は独立のまま。
- 検査: 変更後にlint、typecheck、テスト、secret scan、production buildが成功。対象単体テストでは疑似時計を16分進め、再送と消費済み失敗を検証した。liveリクエストは行っていない。

## 2026-10-05: 会話形式の受け入れギャップ

- 期待: 会話形式のChat UIと、同じ対象の直近ユーザー発話を上限付きで保持する。
- 観察: 実装済みフォームは単一の結果カードを置き換え、live agentには現在の問い合わせのみを渡していた。複数ターン履歴、メッセージパートの表示、会話ストリーミングは未実装。
- 対応: 提供済みの単一問い合わせ／agent／判定の範囲を記録し、会話機能の受け入れは未完了のままとする。この引き継ぎで追加UI実装を主張しない。
- 根拠: `src/app/page.tsx` と `src/lib/gateway-agent.ts`。オフラインテストとブラウザー証拠は実装済み範囲のみを対象とする。

## 2026-10-05: 上限付きチャット履歴の実装差分

- 期待: 会話ターンを追加し、選択したターンごとに根拠を分離する。通常のlive agentには同じケースの小さな直近テキスト履歴だけを渡し、検証済み事実とは扱わない。
- 観察: UIが問い合わせと、ラベル付きの通常agent／fixture応答を追記し、許可リストにあるツール状態のみを表示するようになった。選択ターンの根拠を4つの欄に分けて表示する。liveリクエストは同じケースの直前のliveユーザー／assistantターンを最大1件と現在の問い合わせを含められる。Gateway利用前に長さとスキーマを検証する。ケースまたはモード変更時は会話と根拠の状態を消去する。Jevには現在の問い合わせと、現在ターンの台帳だけから導出した事実のみを渡す。オフラインの会話文とツール計画はfixtureと明記し、実行しない。
- 検査: lint、typecheck、モック単体テスト27件、secret scan（37ファイル／検出0件）、production build、`git diff --check` に合格。独立差分レビューにも合格（レビュアーが27テストとtypecheckを再実行）。チャット固有のlocalhostブラウザー確認では、2ターン追記、過去ターンの根拠選択、ケースリセット、処理中のケース切替制御に合格。[ブラウザー証拠](evidence/browser-smoke.md)を参照。liveリクエストは行っていない。リアルタイムストリーミングとメッセージパート表示は未実装。
- 根拠: `src/lib/conversation.ts`、`src/lib/chat-state.ts`、`src/app/page.tsx`、`tests/unit/contracts.test.ts`。

## 2026-10-05: 日本語UIのローカライズ差分

- 期待: API値、TypeSafeネイティブのJev質問／結果、liveゲート、台帳／履歴、再送動作を変えずに、ユーザー向けUIとオフラインfixture文言を日本語化する。
- 観察: ドキュメント言語とmetadataを日本語に設定し、UIラベル、エラー、シナリオ、fixture会話、安全な状態／情報源の要約を翻訳した。選択肢、Scoreラベル、confidence／probability、ルーブリック、状態、情報源について表示専用の日本語マッピングを追加。生のAPI事実とJev値は折りたたみ式JSON証拠内で変更せず保持する。通常のlive LLMと補足プロンプトは日本語応答を要求する。ネイティブJevの質問／指示とルーブリックのwire値は変更していない。未知の選択肢／状態／凡例値は、生値を添えて未対応値として表示する。liveリクエストは行っていない。
- 検査: lint、typecheck、モック単体テスト28件、secret scan（テキストファイル38件／検出0件）、production build、Gitの空白検査に合格。別担当レビュアーがテスト／typecheckを独立再実行して差分を承認。Managerのlocalhost確認では、3ケース／比較、失敗状態、履歴選択／リセット、生の根拠保持に合格。[ブラウザー証拠](evidence/browser-smoke.md)を参照。
- 根拠: `src/lib/ja-display.ts`、`src/app/page.tsx`、`src/app/layout.tsx`、`src/lib/offline-demo.ts`、`tests/unit/contracts.test.ts`。
- 日本語化差分の指示／プロセス面の所見: 表示専用の境界を維持すること以外はなし。アーキテクチャ変更は不要。


## 2026-10-06: 10ケース・毎ターン取得・v2追加確認度のモック検証

- 変更: 既存seedの投影から10ケースを追加し、日本語の [TEST.md](../TEST.md) に選択名・長い入力全文・確認目的・取得事実・想定方向・非保証を記載。READMEも日本語化した。設定用TypeScriptはrootに維持し、増分ビルドキャッシュはGit対象外とした。
- 設計: 比較チェックボックスと親スナップショットを撤廃し、各新規ターンで台帳とAPI取得を新規作成する。同一保持リクエストIDの再送防止・試行計数は維持。画面だけ最新順で、内部履歴は送信順と元ターン番号を保持する。[ADR 0002](decisions/0002-fresh-turns-and-contextual-intake-v2.md) を参照。
- 基準: `insurance-intake-v2` は受付先・次の確認事項にfactsと問い合わせの双方を使い、Scoreを緊急度でなく追加確認度として説明する。同項目の相違申告は照合必要性であり、真の矛盾を確定しない。requestedとpaidの差、nullと0、支払済と銀行入金を区別する。
- 観察と修正: 保存したv1ネイティブ応答を扱う表示テストで、版未記録をv1と断定し得る経路、v1/v2凡例語彙の共通変換、未知凡例に対する旧期待値を確認した。明示v1/v2/未知版の表示を分け、版違いの凡例は原値付き未対応、未知版は原凡例を保持して尺度を解釈しない。過去のv1証拠ファイルは変更していない。
- モック証拠: lint（警告・エラー0）、typecheck、3ファイル／77 unit tests（契約45、live失敗境界25、SSR表示7）、secret scan（61ファイル／検出0）、production build、`git diff --check` が成功。10ケースのGET→台帳→v2ネイティブ入力、同文異事実、複合／曖昧文脈をモックで確認した。これは実Jevの判定品質証明ではない。
- 包装: Dockerのweb buildも成功し、Next.js 16.3.8のcompile・型検査・静的ページ生成が完了。候補imageは `sha256:47922edb386865256af20bdccc5d7a2de637e3b44b6a509567bfe21b3e0bc7f4`。webだけを2026-10-06 23:05:09 JSTのbash date時点で再作成した。既存data planeと5 APIはcontainer ID・image・開始時刻がすべて更新前と一致した。GET /はHTTP 200・正確な10選択名・比較checkboxなし、GET /api/live/readinessはHTTP 200、ready true／explicitly configured。これらは起動・画面・設定状態の確認で、実モデル評価の証拠ではない。
- 独立検証: 別担当が初回76 unit tests成功を再現。S9の任意契約参照について発見前拒否・発見後取得・Jev申込投影から契約状態除外を追加し、統合検証は77 tests成功。最終source/docsオフライン差分は独立レビューPASS。追加後の77 tests、lint、typecheck、scan、diff-checkを別担当が再現した。runtime更新の操作承認はこのレビューではなく別の既承認範囲に基づく。
- 実行境界: 今回の実モデルPOSTは0回。API seed、Konnect、data plane、5 APIの変更は行わない。既存英語の歴史的文書は一部残し、主要README・新規TEST・新規ADRは日本語とした。ownerの実モデル受入・PR merge・Issue closeはこの検証の完了とは別。
- 手順上の改善: ケース切替と会話クリアは過去のUI結果を消すため、比較手順で操作前に事実・基準版・原値を保存する。また申込の3種類／請求の4種類は必須取得集合で、許可された発見参照の追加GET数の上限としない。

## 2026-10-07: v2 Score表示とJev回答の自信を分離

- 変更: v2の追加確認度カードで、確率最多の指針、Jevが返した平均スコア、Jev回答の自信を別表示にした。最多確率が同率なら全段階を示し、候補確率が欠落・無効・全0の場合や凡例が未対応の場合は意味を推定しない。Scoreの確率からChoice表示を置き換えない。
- 意味: Score値は0〜2の段階番号を候補確率で重み付けした平均位置で、最多支持の段階とは別。native confidenceはTypeSafeが確率分布から要約して返す値で、モデルの自己申告・独立再判定・正答率ではない。実装でScoreやconfidenceを再計算せず、閾値も追加しない。画面詳細に公式式と[Confidence](https://docs.typesafe.ai/confidence)／[Score](https://docs.typesafe.ai/primitives/score)を記載した。
- v1境界: 保存済みv1応答は旧尺度と既存の安全な凡例mapを保つ。既知の版でもScore数値へ段階ラベルを直結せず、未知版は原凡例を基準版未確認として表示する。保存証拠・契約・seed・設定・APIは変更していない。
- 合成表示確認: unit testのsynthetic native mock `.235 / .70 / .065` は平均スコア `.83 / 2`、最多段階 `1`（70%）、native confidence 55%を別表示する。これは合成テスト値であり、実S3応答・新規Jev評価ではない。同率、ゼロ支持、欠損凡例／確率、未知版、v1、raw不変、native Choice保持もmockで確認した。
- 自己検証: lint、typecheck、全79 unit tests、secret scan（61 files／0 findings）、`git diff --check` が成功。unit testsはmock失敗境界由来の `live_host_failure` 診断をstderrへ1件出すが、終了コード0。live callとDocker/Compose操作は0回。Manager統合build・runtime確認・独立reviewは別工程。
- 対象: `src/lib/ja-display.ts`、`src/app/chat-turn-view.tsx`、`tests/unit/contracts.test.ts`、`tests/unit/ui-render.test.ts`、`README.md`、`TEST.md`。
- 手順上の改善: none。既存表示だけではChoice確率の最多候補、Score平均値、native confidenceを混同し得たため、説明と合成contractを追加した。実Jev品質・確率較正・正答率は未確認。
- 統合検証: 最終の表示文言修正後にlint、typecheck、79 unit tests（46 contract／25 failure／8 render）、secret scan（61 files／0 findings）、diff-check、Next.js production buildを再実行し、すべて成功した。別担当の独立レビューもPASS。全0確率を「未確認」とする軽微な文言指摘は修正し、missing／全0の表示テストを追加してfocused再レビューで解消を確認した。
- runtime確認: 修正後のsourceからwebイメージをbuildし、既存の承認済み設定でwebだけを再作成した。コンテナ内の表示sourceとレビュー対象sourceのSHA-256が一致。画面GETは200、readinessはreadyだったが、上流接続の検証とは扱わない。data planeと5 APIのcontainer ID・image・StartedAtは前後で不変。今回の通常LLM／Jev POSTとKonnect変更は0回で、実S3の再評価・ブラウザーでの新規ターン送信は行っていない。
