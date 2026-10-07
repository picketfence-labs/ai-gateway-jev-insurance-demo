# 検証計画

現行の受入対象は、10ケース、各ターンの新規事実取得、`insurance-intake-v2`基準、オフライン契約検証です。利用者向けの操作とケースごとの入力・期待方向は[Chat UIガイド](../Chat%20UI.md)と[TEST.md](../TEST.md)、設計は[ADR 0002](decisions/0002-fresh-turns-and-contextual-intake-v2.md)を参照してください。

現在のowner受入構成はGemini 2.5 Flashを通常LLMに、AI Proxy Advanced経由のTypeSafe native routeをJevに使います。これだけでは全10ケース、現在のv2判定品質、各リクエストのwire traceが検証済みとは言えません。過去にv1基準のS1ライブターンが1件、TypeSafe native Jevの単独smokeが1回成功しています。各実行の対象版と限界は[Compose記録](ai-gateway-compose.md)に残っています。画面画像は実験証拠やraw JSONの代わりになりません。

この計画や`ready`判定はライブ送信の承認ではありません。新しい送信はMCP API、通常LLM、Jev、場合によってLLM補足への通信と費用が発生し得ます。実在する顧客情報、健康情報、口座情報、秘密を使いません。

## オフライン受入条件

| 要件 | ケース | 必須の証拠 |
|---|---|---|
| Agentが実際にツールを選ぶ | 呼出し有無と依存順が変わる | agentのtool invocationを記録する。ホストは通常LLMの完了前に先取りせず、正常完了後の不足事実だけ補完し、取得者を表示する |
| ネットワーク前の範囲検証 | 不明な起点、無関係な顧客、未発見ID、一覧／書込み／Simulation | 禁止された通信が0件で、処理が明示的に停止する |
| 必須台帳の完成 | 未呼出し、部分集合、404、型不一致、必須項目欠落、参照競合 | Jev呼出し0回。LLM文から不足事実を埋めない |
| 生の顧客情報の境界 | Customerのcanary項目、error、log、stream | SDK可視結果、Jev payload、log、UI、保存証拠にcanaryがない |
| フィールドの意味 | 支払額`null`、欠落と`null`、文字列status、商品と契約特約 | 0への置換、enum状態の捏造、特約の推測がない |
| Jev応答契約 | 回答key不足、Choice不正、Score非有限／範囲外、確率やconfidence不正 | 契約エラーにし、raw応答を転送したり成功値を合成したりしない |
| 確率map | 空、候補欠落、未知候補、不完全なScore map | 全候補keyを要求し、値を保持する。合計誤差が`1e-6`を超えた時は警告し、正規化しない |
| 1回試行と再送 | 同時再送、timeout後、時間経過後、同IDへの異なるpayload | プロセス内でagent／Jevを再実行しない。同一入力は保持中の結果を返し、異なる入力は拒否。失敗試行を再利用しない |
| 毎ターン取得 | 10ケース、複数の新規ターン、同文異事実、同じ事実での複合／曖昧問い合わせ | 新しい台帳とGETを使う。比較入力を拒否し、前ターンの事実を再利用しない。期待方向と実Jevの品質を区別する |
| Phase C補足 | Jev成功と判断失敗 | MCP toolを無効にする。補足でJevカードを上書きしない。判断失敗なら補足を省略する |
| UI状態と経路 | live-only画面、readiness locked／ready、pending／error／completed | 未承認時はlocked。設定値を返さず、fixtureへfallbackしない。通信再送のrequest IDとfixtureの表示境界を確認する |
| 会話履歴の上限 | 同一ケースの前ターン1件と今回の入力、ケース変更、長文 | 通常LLMへ渡すのは最大2 user turns。履歴は未検証の文脈で事実を補わず、Jevは現在の問い合わせと台帳だけを受け取る |
| Chat／証拠状態 | 会話追加、過去ターン選択、ケース変更 | 内部の時系列と元ターン番号を保ち、画面は新しい順に表示する。選択ターンの証拠だけを表示し、ケース変更時に状態を消す。fixtureの応答／tool計画を未実行と表示する |
| 証拠の分離 | 利用者申告、投影事実、基準版、Jev結果、LLM補足 | 4つの証拠欄を分け、actual `criteriaVersion`を保持し、v1をv2で再解釈しない。補足はJev結果の外に表示する |
| 日本語表示 | 既知／未知Choice、Score凡例、confidence、確率、status、source、10ケース | 日本語表示だけを変え、契約値や事実は変えない。未知値はraw値を示す。折りたたみJSONは元の英語key/valueを保持する |
| 上限 | tool／step／文字／byte／出力上限と部分台帳 | 黙って切り詰めず、状態を明示して停止する |

主な自動テストは`tests/unit/contracts.test.ts`と`tests/unit/ui-render.test.ts`です。合成fixtureとmock transportだけを使い、上流リクエストは行いません。通過しても実Jevの選択、Score、confidence、回答品質、live接続を保証しません。リアルタイムstreamingとmessage-part表示は未実装です。

## ローカル検証

Node.js 22を使います。環境構築とUI起動は[INSTRUCTIONS.md](../INSTRUCTIONS.md)、テスト結果の履歴は[トラブルシューティング記録](troubleshooting-log.md)を参照してください。

```sh
npm run lint
```

```sh
npm run typecheck
```

```sh
npm test
```

```sh
npm run secret-scan
```

```sh
NEXT_TELEMETRY_DISABLED=1 npm run build
```

CIはライブ承認を無効にして同じオフライン確認を実行します。buildやfixture testだけではlive provider、Gateway、MCP、TypeSafe native Jev、認証、budget、timeoutの実動作を検証しません。

## 個別承認が必要なライブ確認

以下は接続準備の確認項目です。環境構築、設定変更、secret読出し、ライブ送信を許可するものではありません。承認済みの非production環境がなければ、環境を作らず作業を止めて別途相談してください。`ready`は必須設定の形式検査に通った状態であり、endpoint、認証、model、wire契約の成功ではありません。

現在の受入構成はKong AI Gateway 2.2経由のGemini 2.5 Flashと、AI Proxy Advanced経由のTypeSafe native Jevです。live UIの一件のv1 S1履歴はこの文書にある現行v2の全契約を証明しません。通常LLMのtool-call round-trip、MCP host completion、10ケースの評価は、実行前に対象と範囲を別途承認し、成功／失敗を記録します。直接provider呼出しやJev要求／応答のChatCompletion変換をしません。

必要な外部構成の確認項目:

- Customer、Product、Application、Claim、Policyの5種類のGET詳細MCP経路と、`get_customer_customers__customer_id__get`、`get_product_products__product_id__get`、`get_application_applications__application_id__get`、`get_claim_claims__claim_id__get`、`get_policy_policies__policy_id__get`の許可名。
- 通常LLM向けのGateway endpoint、Gemini 2.5 Flashの受入済みmodel設定、OpenAI互換のtool-call形式とtimeout。受入済み設定だけで実際の全round-tripを保証しない。
- AI Proxy Advancedを通るTypeSafe native `decisions` route、`typesafe` format、ネイティブrequest／response schema。単独native Jev smokeの既存成功は[Compose記録](ai-gateway-compose.md)にあり、3問を含む保険シナリオ全体の受入とは別です。
- 認証はowner承認のsecret-deliveryで注入します。値をrepository、Issue、会話へ保存せず、秘密を含む`.env*`、`config/`、`certs/`を読まないでください。5つのMCP clientは別の`MCP_API_KEY`を固定`apikey` headerで送ります。missing設定はfail-closedです。認証を迂回しません。

live validatorが要求する環境変数の**名前**は次のとおりです。値はこの文書へ記録しません。

- gate: `DEMO_MODE=live`、`LIVE_ACCESS_APPROVED=true`、`LIVE_UI_ENABLED=true`
- 通常LLM/Gateway: `AI_GATEWAY_BASE_URL`、`AI_GATEWAY_API_KEY`、`AI_GATEWAY_MODEL`、`AI_GATEWAY_TIMEOUT_MS`
- MCP: `MCP_CUSTOMER_URL`、`MCP_PRODUCT_URL`、`MCP_APPLICATION_URL`、`MCP_CLAIM_URL`、`MCP_POLICY_URL`、`MCP_API_KEY`、`MCP_TIMEOUT_MS`
- Jev: `AI_GATEWAY_JEV_URL`、`AI_GATEWAY_JEV_API_KEY`、`AI_GATEWAY_JEV_MODEL`、`AI_GATEWAY_JEV_TIMEOUT_MS`

このデモはアプリ層の全体request／tool quota、金額上限、token上限を設けません。SDK取得loopは最大6 step、呼出しtimeout、retry 0、1ターン最大1回のJev評価を維持します。試行counterはwire通信や請求総数ではありません。4,096件のprocess-local request registryは重複送信と保持中IDだけを扱い、退避、再起動、複数instanceを越えた冪等性を保証しません。

旧6ターン案の通常LLM42 generation／Jev6 attempt、初回ライブ案43 generation／Jev7 attemptは計画時の見積もりであり、現在のquota、要件、費用上限、承認ではありません。新規ターンは毎回事実を取得します。MCP初期化や`tools/list`などprotocol通信と、業務GET・tool callを同じ数として扱いません。請求金額は未評価なら不明で、0とみなしません。

将来の個別ライブ確認では、実行前に少なくとも対象のenvironment／region／org、実行時のresource変更とcleanup、runtime／image／model pin、送信先、credential delivery、timeout、各依存先の最大call数、価格と金額上限、失敗時の停止点を確認し、具体的な送信範囲に対する明示的承認を得ます。現在の受入route、保存証拠、設定readiness、本計画だけから追加実行の許可を推測しません。

## 期待方向と合格判定を分ける

10ケースの主想定は[TEST.md](../TEST.md)にあるレビュー仮説です。機械的な合格は、選択レコード、当ターンの参照、投影、基準版、native応答の保持と表示で判定します。Scoreの整数一致やケース間の変化は要求しません。実結果は元の値で記録し、方向性を人がレビューします。

追加確認度0は問われた記録の限定的説明、1は投影されない詳細、2は同じ投影項目・値への申告上の相違を人が照合する必要性です。2は真の矛盾や緊急度の確定ではありません。請求額と支払記録額の差だけで不足払いとせず、`null`を0にせず、支払済を銀行入金確認とみなしません。モック検証で実Jevが基準を守るとは保証しません。

保存済みv1応答の尺度と凡例は変更せず、actual `criteriaVersion`を結果に保持します。Jevの内部理由や代替成功値を作りません。最新の画面指標の式と読み方は[Chat UIガイド](../Chat%20UI.md)にあります。

## 完了証拠

source revision、実行したコマンド、test件数、secret scan結果、該当するUI証拠、未検証事項を添えます。新規ライブ通信がない場合は「未実施」と記し、費用を0と推定しません。担当範囲の独立reviewとownerのdemo受入を分けます。過去の証拠と現在の実装版が違う場合、過去のPASSを無条件で転用しません。
