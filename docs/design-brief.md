# 保険問い合わせデモの設計方針

現行仕様は10件の合成ケース、各ターンの新規API取得、`insurance-intake-v2`の追加確認度です。[ADR 0002](decisions/0002-fresh-turns-and-contextual-intake-v2.md)、[TEST.md](../TEST.md)、[Chat UIガイド](../Chat%20UI.md)を現行の仕様・操作の補足正本とします。

## 現在の状態と証拠の境界

- ユーザー向けの日本語UIはライブ実行用です。画面にfixtureの選択肢はありません。オフラインfixtureは内部テスト専用です。接続準備の検証が`ready`でも、上流の疎通やモデルの回答品質を確認した意味にはなりません。
- 現在のowner受入構成は、Kong AI Gateway 2.2を通るGemini 2.5 Flashと、AI Proxy Advancedを通るTypeSafeネイティブJevルートです。構成の受入と、個別リクエストのwire trace、ホスト補完、全ケースの動作・品質は別の確認です。
- 履歴には、2026-10-06にS1の一件が当時のv1基準でライブ完了した記録があります。Jev応答のモデルは`jev-1.13.0`で、当時の受付・Score・confidenceはv1のまま保存されています。通信観測、使用イメージ、制限は[Compose実行記録](ai-gateway-compose.md)を参照してください。この記録をv2基準に読み替えません。
- 現行v2の全10ケース、ライブでのホスト補完、S2/S3、再送・複数ターン、通常LLMの完全なwire traceは未確認です。画面画像はUI例であり、原値JSONや通信証跡の代わりになりません。表示された割合からraw確率を逆算しません。
- この設計書の更新では新しいモデル・MCP・Jevリクエストを実行しません。新規ライブ送信は外部通信と費用を発生させ得ます。文書、設定、readinessだけでは個別リクエストの実行承認になりません。

## 実装済みの振る舞いと残る限界

UIは問い合わせと通常LLMの応答／補足をターンごとに追加し、安全なツール操作の状態を示します。各ターンの証拠を個別に選べ、長文入力と技術JSONは初期表示で折りたたまれます。通常LLMは同一ケースの直前の完了ターン1件と今回の問い合わせ、合計2ユーザーターンまでを受け取ることがあります。この会話履歴は長さを検証した未確認の文脈で、事実取得には使いません。Jevへは今回の問い合わせと現在ターンの投影済み台帳だけを渡します。ケース変更時は会話と証拠状態を消去します。

ユーザー向け状態、取得元、シナリオ名、基準、既知のネイティブ判断値は日本語で表示しますが、元のデータと証拠は変更しません。未対応値はraw値とともに示します。リアルタイムストリーミングとメッセージ部品ごとの描画は未実装で、オフライン検証の合格としても主張しません。

## 目的

Kong AI Gateway 2.2を通る通常LLMが保険MCPツールを選び、ホストが事実を検証し、Jevが型付きの受付提案を返す会話UIを提供します。利用者の申告、取得事実、判断基準、実際の結果を分けて表示します。Jevは現在ターンの事実と問い合わせの両方を使います。

## 対象範囲と対象外

Customer、Product、Application、Claim、Policyの5種類と、既存seedに基づく10件の合成レコードを使います。比較専用モードは撤廃しました。同じ問い合わせを再評価する場合も新しいターンとして事実を再取得します。通常LLMとの会話と、通常LLMがMCPツールを選択する動作を維持します。Jevを呼べるかどうかと実行時点はホストが管理します。

対象外は、Simulation、一覧／検索／書き込みツール、実在する個人情報、保険引受、支払適格性、実際の担当部署への割当、公開ホスティング、Context Mesh、Code Mode、RAG、汎用評価基盤です。将来ケースや永続化を加える場合も、LLMの取得判断とホストのJev判断の境界を混ぜません。

## 既存の構成と実行経路

- UI実装の参考元は[Kong MCP Chat UI](https://github.com/picketfence-labs/konnect-code-mode-mcp/tree/138387290258bab07d86e7544a6ddb33e9f4a6fb/chat-ui)です。Next.js、React、TypeScript、AI SDKのストリーミング、MCPクライアントを使う参考実装ですが、このリポジトリへそのままコピーしたコードではありません。
- APIの参考元は[合成保険API](https://github.com/picketfence-labs/kong-api-bundle-insurance/tree/ab96eea303e27fe02d98344a31bc7633753da77e)です。独立したPython/FastAPIのseedサービスを使います。元のcommitは固定していますが、イメージdigestとの対応は別途確認が必要です。
- Composeは5つの内部APIコンテナ、AI Gateway 2.2.0 data plane、UI/backendを記述します。実行と観測の履歴は[Compose記録](ai-gateway-compose.md)にまとめています。この設計書は起動手順ではありません。ローカル構築は[INSTRUCTIONS.md](../INSTRUCTIONS.md)を参照してください。既存のKubernetes一式をコピーしません。
- 現行の受入構成は、Konnect管理のAI Gateway control planeとself-managed data plane、5つのGET詳細MCP経路、通常LLM用のGemini 2.5 Flash、AI Proxy Advanced経由のTypeSafeネイティブJevです。現在の構成受入、過去の実行証拠、個別handlerやwireの未観測範囲を区別します。対象環境や実リクエストの再確認はこの設計書の承認範囲に含みません。
- JevはAI Gatewayを通るTypeSafeネイティブ形式のRouteを使います。ChatCompletionへ変換せず、TypeSafeの質問・応答契約を保ちます。
- 通常LLMはKong AI Gateway 2.2を経由し、直接providerへ接続しません。現在の受入provider/modelはGemini 2.5 Flashです。過去のS1証拠で確認された当時の応答やJev値はその時点の証拠として保存し、現行v2の再実行や全ケース品質へ一般化しません。
- リポジトリはNext.js、React、TypeScript、AI SDK、MCPクライアント、provider adapter、Vitestの依存を固定しています。build、typecheck、lint、test、secret scan、offline CIがあります。これらの合格だけでは外部接続や認証headerの動作を検証しません。
- UIのローカル公開先はloopbackの`3000`です。`docker compose config --quiet`は静的設定の確認であり、イメージ起動やモデル評価の証拠とは別です。実際のCompose、Gateway、API、MCP、Jevの記録は[Compose実行記録](ai-gateway-compose.md)を参照します。

## A: エージェントがツールを取得

UIは10ケースの固定請求／申込ルートIDを選び、編集可能な合成問い合わせを受け付けます。問い合わせ文は顧客検索や本人照合に使いません。参照先は当ターンのAPI応答で発見して取得し、実施した参照整合を日本語で表示します。通常LLMは任意のGETツールを`toolChoice: auto`で選び、呼出し有無と順序を決めます。通常LLMが正常完了した後に限り、ホストは選択した合成ケースの必須事実のうち、まだ不足しているものを取得できます。この補完はホスト／アプリが開始したMCP操作として表示し、LLMが選んだツール呼出しと区別します。通常LLMのtransport／SDK失敗時はターンを停止し、ホスト補完を行いません。

ツールwrapperが許可するIDは、選択した起点IDと成功したAPI応答から発見したIDだけです。任意URL、無関係なID、未発見の参照、一覧／書き込みツール、Jevツールはネットワークアクセス前に拒否します。依存関係のない有効な呼出しは並行して実行できます。

成功したツール結果は投影して、ターンごとの台帳へ記録します。申込の必須集合はapplication/customer/product、請求はclaim/customer/policy/productです。LLMの発言や前の会話はこの集合を満たしません。ホスト補完で使えるのは、選択ケースの起点IDと、今回取得した投影事実から発見した参照IDだけです。静的な期待IDは範囲検証に使えますが、取得元にはしません。前ターンの事実、任意の利用者ID、隠れたREST呼出しは使いません。成功済み事実は重複GETせず再利用します。起点／参照の不足や不一致、範囲違反、上限超過はJevの前で停止し、未評価を明示します。UIの操作記録では、開始者を「LLM」または「評価準備（アプリ）」として日本語で示し、送信前にホスト補完の可能性を説明します。

比較チェックボックス、親スナップショット、比較ストア、スナップショット由来の応答は撤廃しました。各新規ターンは新しい台帳でAPIを取得します。会話履歴、前ターンの事実、静的な期待参照IDを取得源にしません。同じリクエストIDが保持されている間の通信再送は新規ターンと区別し、再実行しません。

## SDKや画面へ返す前の投影

元のMCP実行をwrapperで包み、サーバー上で生応答をparseし、返却IDと型を検証してから投影し、agent SDKへ返します。生の`client.tools()`結果をSDKへ渡し、後からUIで項目を隠す方式は使いません。Customerの生データをログ、error、trace、browser stateへ出しません。

| API | 通常LLMに見せる項目 | Jevへの投影 |
|---|---|---|
| Customer | customer_id、アプリが導出したrecord_found、実際に確認した関係 | Customer記録やIDは含めない |
| Application | application_id/customer_id/product_id/status/resulting_policy_id | status、アプリが導出したresulting-policy参照有無 |
| Claim | claim_id/customer_id/policy_id/claim_type/status/claim_amount_requested/claim_amount_paid | 同じ項目からIDを除く |
| Policy | policy_id/customer_id/product_id/status | status |
| Product | product_id/product_name/category/coverage_summary/status | 同じ項目からproduct_idを除く |

IDは文字列、金額は整数です。`claim_amount_paid`と`resulting_policy_id`は`null`の場合があります。`null`を0へ変換せず保持します。APIのstatusは宣言済みenumではなく文字列です。承認済みシナリオの契約を検証し、未知の文字列から状態を捏造しません。

参照IDはagentの次の呼出しとUI上の取得根拠に使い、Jevの推論には渡しません。必須台帳が揃った後に参照関係を最終検証します。途中の部分チェックは最終検証ではありません。参照関係の整合は利用者の本人確認や認可ではありません。

氏名、連絡先、住所、口座情報、国民識別番号、年齢、性別、職業、所得、顧客期間、健康情報を除外します。個人属性や金額で優先度を決めません。Productの`coverage_summary`は契約全体、免責、支払判断を示すものではありません。商品特約の選択肢は加入済み特約の証拠ではないため、どちらも初期のモデル入力から除外します。

編集可能な問い合わせ文には別の情報境界があります。API応答の投影では、利用者が自由入力へ書いた個人情報を除去できません。実データや秘密を入力しないよう表示し、入力を2,000文字までに制限します。ライブテストではownerが承認した合成文だけを使います。

## B: ホストがJevを一度呼び出す

選択ケースの送信はそれぞれ独立した評価ターンです。適格条件は、入力と範囲が有効であること、LLMが選んだ成功ツール取得と正常完了後の限定的なホスト補完で必須台帳が揃うこと、型と`null`が有効であること、参照が一致すること、事実がすべて当ターンの投影済み応答から得られていることです。事実を永続化したり前ターンから再利用したりしません。LLMのtransport／SDK失敗、不完全な取得、参照または範囲の問題があれば、Jevの前で停止します。

送信前にrun／attemptを予約します。適格なターンは3問を1リクエストで送り、Jev試行は最大1回です。事実不足、404、型エラー、必須フィールド不足、範囲逸脱、参照不一致ではJevを呼びません。ホスト補完は同じラッパー、台帳、投影、呼出しtimeoutを使い、選択ケースでまだ不足している事実に限ります。失敗した通常LLM呼出しの代わりにはなりません。

ホスト台帳の事実、現在の問い合わせ、版管理したデモ基準をJSON文字列の`state`として送ります。LLMの要約をAPI事実に混ぜません。timeoutやHTTP失敗でも試行を消費します。再試行には明示的な新規runが必要です。

質問契約は`insurance-intake-v2`です。ネイティブキー、型、選択候補を維持します。
- `desk`（Choice）: `claim_progress`、`application_status`、`payment_status`、`policy_information`、`general_intake`。いずれも架空の案内先です。
- `priority`（Score）: UIでは「追加確認度」と表示します。0は質問された投影項目を限定的に説明でき、同じ項目への相違申告がない状態です。1は内訳や時期など、投影されない詳細の確認が必要な状態です。2は利用者が同じ投影項目・値の相違を明示し、人が未解決の申告差を照合する必要がある状態です。Scoreは0〜2の連続値で、整数段階と一致するとは限りません。早期連絡希望による緊急度、真の矛盾、誤記の確定を意味しません。
- `next_check`（Choice）: `claim_progress`、`claim_additional_information`、`application_progress`、`application_correction`、`payment_receipt`、`payment_amount`、`policy_information`、`clarify_intent`。これは尋ねることの推奨であり、事実や内部理由ではありません。

必須instructionsを持つ名前付きquestion mapを使います。型は小文字の`choice`と`score`です。Choiceのcriteriaはobject、Scoreのcriteriaは配列です。Scoreは整数ラベルでなく0〜2の連続値です。応答の各回答に`type`、確率mapに全候補key、Score凡例に`0`、`1`、`2`、confidence、model、整数のinput／output usageを要求します。shape、許可key、有限値、範囲を検証します。確率合計が1から`1e-6`を超えてずれた場合は診断warningを付けます。値はrawのまま保持し、正規化やconfidence再計算をしません。自由記述のJev reasonは前提にしません。

## C: LLM補足

Jevが有効な結果を返した後に限り、投影事実、問い合わせ、実際の回答を使って通常LLMの補足を1回生成できます。MCPツールは無効にし、「LLM補足」と表示します。ホストはJevカードを直接描画し、LLMに書き換えさせません。補足の生成が失敗してもJevカードは保持し、代替Scoreを作りません。

## 10ケースと文脈比較

ケースの正確なUI選択名、長文入力、参照先、主想定の方向、機械的な合格条件は[TEST.md](../TEST.md)を参照します。ケースIDに応じた固定正解分岐は設けません。案内先と次の確認事項は現在の投影事実と今回の問い合わせの両方を使います。

既存の自動車請求審査中・火災申込審査中・火災請求支払済に、医療入院請求の審査中・支払済・否認、医療申込の審査中・否認・承認済（契約参照あり）・取消済を追加する。seedは既存APIリポジトリの固定commitに基づき、投影項目やseedを変更しない。

同文異事実、同じ事実での複合・曖昧問い合わせを新規ターンで確認する。ケースの想定はレビュー仮説であり、実Jevの結果や品質保証ではない。請求額と支払額の差だけで不足払いとせず、未記録nullを0円とせず、支払済と銀行入金確認を区別する。否認理由、支払適格性、契約有効性、Jev内部根拠を捏造しない。

結果とUIに実際の基準版を保持し、v1保存記録をv2尺度で説明し直さない。新規ターンはAPI・LLM・Jevの実行費用が発生し得る。スナップショット再利用によるゼロGET比較はない。

## UIに示す証拠

1. 合成かつ未検証の申告であることを示した、問い合わせ文と利用者の自己申告。
2. 投影済みAPI事実、商品情報、参照ID、取得元、部分／最終参照チェック、当ターンの成功業務GET数。旧スナップショットID、hash、時刻は表示しません。
3. 架空の案内先、追加確認度、次の確認事項、基準版。
4. 実際に返されたJev回答、Score、凡例、確率、confidence、model、run ID、latency、投影済み要求／応答の安全な展開。

通常LLM／MCPの応答、安全なツール名・状態・取得者・件数、LLM補足は分けて表示します。表示する証拠は選択したターンだけです。「元の要求」は投影済みJev要求を指し、生の顧客情報やheaderではありません。取得中、入力／検証エラー、評価中、判断エラー、完了を区別し、前ターンの成功を現在の結果として表示しません。fixtureを表示する内部テストでは「OFFLINE FIXTURE / Jev not called」と示し、予定ツールが未実行であることを表示します。リアルタイムストリーミングとメッセージ部品表示は未実装です。操作と数値の詳細は[Chat UIガイド](../Chat%20UI.md)を参照してください。

## 実装上の上限とライブ実行境界

- Phase AはSDKの6 stepで停止し、その後にツール無効の補足を最大1回行います。これはアプリ全体のrequest／tool quotaではありません。UUIDv4 request IDは最大4,096件をプロセス内で保持します。同じ保持ID・同じ入力の再送はagent／Jevを再実行せず、異なる入力は拒否します。満杯時は最古の完了記録だけを退避し、処理中の記録は退避しません。すべて処理中なら新規IDを拒否します。退避後、プロセス再起動後、複数instance間の保護はありません。
- このowner向けデモにアプリのrequest／tool quotaは設定していません。SDK取得loopは最大6 stepで止まり、呼出しtimeout、retry 0、1ターン最大1回のJev評価を維持します。試行カウンタはwire通信数や請求数ではありません。金額上限やtoken上限をコードで強制しません。
- 必須取得の種類は申込3種類、請求4種類です。同一ターンの成功GETは重複取得を避けるためcacheし、失敗は再試行しません。この3／4はGET数の上限や完全一致条件ではありません。承認申込の結果契約参照など、当ターンで発見した許可参照をLLMが追加取得した場合は、実際の取得記録を確認します。
- 入力上限は2,000文字、投影済みtool resultは8 KiB、当ターンの投影済み事実のシリアライズは16 KiBです。上限超過時は黙って切り詰めず停止します。
- LLMの候補上限はinput 16k tokens、Phase Aの各generationでoutput 800、Phase Cで500です。provider parameterやtokenizerが実際にこれを強制するかは未検証です。文字数やbyte数はtoken数ではありません。
- 同一ケースの会話履歴は最大2 user turns、直前1件と現在の問い合わせです。通常agentに渡す未検証の文脈であり、Jevは現在の問い合わせと現在ターンの台帳だけを受け取ります。画面は最新ターン順ですが、内部履歴は時系列と元のターン番号を維持します。ケース変更時は会話と証拠選択をリセットします。
- 旧6-turn案の通常LLM42回、Jev6回は計画時の見積もりで、現行のコードquotaでも自動実行の承認でもありません。新規ターンでは毎回事実を取得します。tool callとprotocol通信は別の計数です。
- 初回ライブ案の通常LLM43 generation、Jev7 attemptも上限案であり、承認や金額保証ではありません。

新しいライブ作業に入る前に、対象環境、route、送信先、resource変更／cleanup、runtime／image／model pin、credential提供方法、価格、個別の金額上限、timeout、送信回数をownerと確認し、その実行について明示的な承認を得てください。現行routeの受入や過去のS1結果は新規ライブ送信の承認ではありません。秘密や実環境識別子はこの文書へ保存しません。情報漏えい、範囲不一致、契約違反、失敗反復があれば停止します。

## 実装と受入

[検証計画](test-plan.md)に従います。オフライン契約テスト、ローカルUI、CI、検証コマンドがあります。独立レビューと引き継ぎの履歴は[トラブルシューティング記録](troubleshooting-log.md)にあります。オフライン検証はライブ接続を承認も証明もしません。

private repository、[Issue #1](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/issues/1)、固定依存、10ケース／v2を含むコード、テスト、CI、Compose scaffoldがあります。過去のS1ライブ実行はv1基準の一件に限られ、現行v2の全10ケースや全経路の検証ではありません。PRはfeature branchで独立reviewを受け、mergeは人が判断します。Issueの完了は技術証拠とownerのデモ受入を分けて判断し、PR mergeだけでcloseしません。

## 公開資料

- [TypeSafe provider](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)
- [Gemini provider](https://developer.konghq.com/ai-gateway/ai-providers/gemini/)
- [AI MCP Server](https://developer.konghq.com/ai-gateway/entities/ai-mcp-server/)
- [TypeSafe API](https://docs.typesafe.ai/api)
- [Insurance seed data](https://github.com/picketfence-labs/kong-api-bundle-insurance/tree/ab96eea303e27fe02d98344a31bc7633753da77e/data/seed)
