# エージェント向け作業規則

デモの実装変更前に[設計方針](docs/design-brief.md)と現在の作業項目を読みます。操作は[Chat UIガイド](Chat%20UI.md)、ケースは[TEST.md](TEST.md)、構築・起動は[INSTRUCTIONS.md](INSTRUCTIONS.md)を参照してください。

## 現行仕様と状態

- ユーザー向けUIは日本語のライブ実行用です。オフラインfixtureは内部テスト専用で、UIの実行モードとして提供しません。
- 10件の固定合成ケースを使い、新規ターンごとに新しい台帳とAPI取得を行います。旧比較checkbox、親snapshot、比較専用の取得省略はありません。現在の基準は`insurance-intake-v2`です。
- 現在のowner受入構成は、Kong AI Gateway 2.2経由のGemini 2.5 Flashと、AI Proxy Advanced経由のTypeSafeネイティブJevです。構成の受入は個別リクエストのwire trace、全10ケースの動作、Jevの回答品質の証明ではありません。
- 過去にv1基準のS1ライブ実行が1件あります。raw値と制限は[Compose実行記録](docs/ai-gateway-compose.md)を参照し、現行v2の証拠として使いません。

## 必ず守る安全境界

- 通常LLMとの会話と実際のMCPツール選択を維持します。固定GETだけの画面へ置き換えず、Jevをagent toolにしません。
- Customer、Product、Application、Claim、Policyの許可済みGET詳細だけを公開します。選択ケースの起点IDと、今回の成功したAPI応答から発見した参照IDを範囲検証し、ネットワークアクセス前に不正な参照、任意URL、一覧／書き込み／Simulation操作を拒否します。
- MCPの生応答はサーバー内で検証・投影してからLLM SDKへ返します。Customerのraw dataをLLM SDK、Jev、UI、log、error、trace、保存証跡へ漏らしません。自由入力の個人情報はAPI projectionでは除去できないため、実データや秘密を入力しません。
- Jev stateはLLMの文章や前ターンではなく、ホストが検証した現在ターンの台帳から作ります。必要事実不足、型不正、範囲違反、参照不一致、LLM失敗ではJevを呼びません。通常LLMが正常完了した後に不足事実を取得するホスト補完は、同じscopeとledgerを使い、取得者を明示します。
- Jevの結果と、後続の通常LLM補足を分けます。Jevの`reason`、confidence、Score、または成功fallbackを捏造しません。
- `null`を0に変換しません。請求額と支払記録額の差から不足払いと判断せず、「支払済」を銀行入金確認とみなしません。申告された相違を、確認済みの矛盾や記録誤りとしません。
- 過去の`insurance-intake-v1`応答をv2尺度で説明し直しません。確率、Score、confidence、native JSONを表示値から逆算・訂正しません。

## 承認が必要な操作

- 通常LLMはKong AI Gateway経由に限定し、providerへ直接送信しません。JevはTypeSafeネイティブ形式を維持し、ChatCompletionへの変換を行いません。
- `DEMO_MODE=live`、`LIVE_ACCESS_APPROVED=true`、`LIVE_UI_ENABLED=true`と必要設定が揃わない場合はfail-closedです。readinessは設定形式の状態だけを返し、疎通や品質を保証しません。
- このリポジトリの設定ファイル、`.env*`、`config/`、`certs/`は秘密を含む可能性があります。承認範囲外で読まず、値を出力・転載しません。認証情報、Konnect resource、MCP／model endpoint、shared environmentを作成・変更しません。
- ライブ送信、課金、公開hosting、resource変更／cleanup、外部repository変更は、その具体的な範囲と費用について別の明示的承認がある時だけ行います。runtime構成受入、readiness、Issue、過去の成功、READMEやTESTの記述は実行承認ではありません。
- ライブ実行時はactive providerのruntime permission controlsを使います。他providerのpermission形式を流用せず、第二provider adapterは必要な時だけ追加します。

## 変更と証拠

- architecture変更の前にADRと設計方針を更新します。予期しない挙動は起きた時点で[トラブルシューティング記録](docs/troubleshooting-log.md)へ記録します。
- オフライン契約は`tests/unit/`で合成fixtureだけを使います。変更した範囲に応じて、lint、typecheck、test、secret scan、production buildを実行し、結果を[検証計画](docs/test-plan.md)と作業ログへ残します。これらはlive Gateway、MCP、model、Jevを検証しません。
- 画像、JSON evidence、保存済みlive responseは原本を変更しません。画面画像の値からraw responseを推定せず、歴史的な成功・失敗を現行の結果に書き換えません。
- 返却時は変更点、実行した確認と対象版、証拠、未確認事項、逸脱、PR／ADR／logへの参照を示します。取得できない費用やusageは不明とし、秘密は含めません。
- Coordinatorは技術証拠を独立に確認し、demo ownerが受入を判断します。PR mergeだけで作業項目を自動closeしません。
