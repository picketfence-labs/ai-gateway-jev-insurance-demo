# ローカルCompose構成と検証記録

> **現在の構成は [INSTRUCTIONS.md](../INSTRUCTIONS.md) を正本として確認してください。** この文書の2026-10-06 日付付き確認は当時の実行・調査記録であり、現在のCompose起動・Konnect登録・推論成功を意味しません。比較ON／親スナップショット・3ケース・v1は過去の実装／検証記録です。

`compose.yaml` はKonnect管理のKong AI Gateway 2.2.0データプレーン、Next.jsアプリ、保険API 5サービスのローカル構成です。ComposeはKonnect EntityやControl Planeを作成しません。Webのliveフラグは `${VAR:-safe-default}` で、既定値は `offline` / `false` / `false` のままです。live値は承認後、明示したGit管理外env fileからのみ渡してください。`.env.example` の `.invalid` hostとroute名は接続先ではなく候補です。実証明書、provider credential、Inbound API keyをGitへ追加しないでください。

## 2026-10-07時点の構成と再現境界

- ComposeサービスはWeb、Kong AI Gateway `2.2.0`、Customer/Product/Application/Claim/Policyの5保険APIです。ホスト公開portはWeb `127.0.0.1:3000` とGateway `127.0.0.1:8000` のみで、Admin `8001` は公開しません。
- 通常LLMはAI Proxy Advancedを介したGemini 2.5 Flash、Jevは分離したnative TypeSafe `decisions` 経路、MCPクライアントはKonnect AI MCP Server経路からAPI詳細を取得する設計です。RESTコンテナのみではAI MCP Serverを作成できません。
- AI Model、AI Model Provider、AI MCP Server、AI Auth Strategy、AI ConsumerはKonnect側の管理Entityです。[公式Entity mapping](https://developer.konghq.com/ai-gateway/ai-gateway-v2-concepts/)では、AI Gateway 2.xが対応するGateway内部primitiveをプロビジョニングします。これは利用者がlegacy pluginを手動設定することや、特定generated instanceのtraceを観測したことを意味しません。[構成図とsource mapping](../resources/architecture/README.md)に対応関係と証拠境界を記載しています。
- 既存デモは外部Konnect US環境を参照する構成ですが、新規Control Planeの作成・登録・有効性をこの作業で検証していません。Gatewayの `kong health` はプロセス確認でありKonnect接続の証明ではありません。新規利用者は自身のOwner指定regionを確認し、`.env.example`のplaceholderでは外部接続できないこと、Owner承認なしに起動・モデルPOSTを行わないことに注意してください。
- 現在の10ケース・毎ターン取得・追加確認度の仕様は[ADR 0002](decisions/0002-fresh-turns-and-contextual-intake-v2.md)と[TEST.md](../TEST.md)を参照してください。ユーザー向け再現手順、clone ref、CLIの使用境界は[初回セットアップ手順](../INSTRUCTIONS.md)にあります。

以下の日付付き確認は、2026-10-06までの各時点で記録した履歴です。イメージdigest、readiness値、Entity作成、接続結果を今日の実行結果として再利用しないでください。

## 過去の確認 — 2026-10-06 23:05 JSTのWeb更新

当時のweb image: `sha256:47922edb386865256af20bdccc5d7a2de637e3b44b6a509567bfe21b3e0bc7f4`。
2026-10-06 **23:05:09 JST** のbash date確認時点で、承認済みの既存ローカル設定を再利用し、webのみを `--no-deps --no-build --force-recreate` で再作成した。
既存data planeと5 APIはcontainer ID・image・開始時刻が更新前と一致した。
秘密設定の本文や展開値は出力していない。GET /はHTTP 200、10個の日本語ケース選択名、比較checkboxなしを確認。
GET /api/live/readinessはHTTP 200、`ready: true` / `status: explicitly configured`。
これは起動・画面・設定状態の証拠であり、API・MCP・通常LLM・Jevの新規実行や接続品質の証明ではない。今回の実モデルPOSTは0回。

lint、typecheck、77 unit tests、secret scan（61ファイル／検出0）、production build、Docker web build、diff checkが成功し、source/docsオフライン差分の独立レビューもPASS。
[TEST.md](../TEST.md) の操作手順と [ADR 0002](decisions/0002-fresh-turns-and-contextual-intake-v2.md) が現在のケース・取得・追加確認度の境界を示す。
以下の古いimage、比較ON/OFF、3ケース、v1結果の記述は過去の検証記録として保持する。v1証拠は変更していない。

## 過去の確認 — 2026-10-06 21:16 JSTのquota撤廃

当時web imageは `sha256:cde72cf3a275cbc05be59ce026aa1128a6dd578034a1afc2a8ec058e8c69b006`。webのみの再作成は2026-10-06 **21:16:30 JST** のbash date時点で完了しました。DP/5APIは保持し、loopback `127.0.0.1:3000`、root HTTP200、readiness `ready: true` を確認しました。旧budget変数3名はtracked Compose/example、Git管理外local env/overlay、running web環境にありません（nameのみ投影、値非出力）。offline lint/typecheck/65tests/secret-scan60files0/Nextbuild/Dockerwebbuild/diffcheckがpass。独立reviewは反復turn、counter、registry境界をpassとしました。この修正のagent推論/API POSTは0。以前image/S1実証拠は履歴です。

process全体のGateway/Jev/MCP budgetとturnごとのrequest/tool quota拒否を撤廃しました。旧環境変数3つは不要でComposeから注入しません。SDK acquisitionの6step停止、timeout（レビューlocal値normal20s/Jev10s/MCP5s）、retry0、turnあたりJev1回、scope/projection/ledger検証、保持ID replay保護は維持します。counterは観測でbilling合計ではありません。registryは4,096件で古いcompleted responseをevictし、in-flightはevictしません。重複保護は保持IDのみ（evict済みID／restartは対象外）。

2026-10-06 20:52:16〜21:00:21 JSTのread-only logは固定 `host_budget_exhausted`、process Jev予約1、failed-turn Jev予約0、application/customer receiptを含みました。case/request相関がなく、利用者が報告したclaim turnとは断言できません。以前はprocess normal7/Jev1/MCP8で後続turnを止め得ました。診断／検査にmodel/API POSTは使用していません。以下の通信制限と証拠は過去のsingle-turn作業で現行runtime契約ではありません。この修正のagent有料呼出し0。

当時の比較OFFは新規取得、ONはserver保持の同case投影事実（10分寿命、32snapshot）を再利用し、詳細GET0でnormalLLM/Jev/supplementを再実行しました。snapshot読取とMCP discoveryは業務GETではありません。期限切れ／不足snapshotはfresh GETへfallbackせずfail closedし、会話textをledger補完に使いません。現行ではこの比較機能は撤廃済みです。

## 過去の確認 — UI改善（offline検証のみ）

当時UI imageは `sha256:db8e60ad2594dc22204e32bb6acec6c426b26e034837b70a78960f60d73fd517`。2026-10-06 **20:52:16 JST** のbash date時点でwebだけ再作成、DP/5APIを保持。loopback3000、root200、readiness200/readytrueを確認。[live-only初期画面](evidence/ui-refinement-live-only.png)をチャット未送信で開きました。build/UI/readiness証拠で新推論ではなく、この改善の**agent有料呼出し0**です。元S1 image/live証拠とは別です。offline lint/typecheck/64tests/secret-scan60files0/Nextbuild/Dockerwebbuild/diffcheckがpass、独立reviewは6component SSRと2producer回帰テストを確認しました。

UIはlive requestのみでreadiness falseなら送信lock、fixture fallback／mode pickerはありません。case名は日本語、既知machine keyは主cardから除き、折りたたみcriteria/native JSONに保持。未知値fallbackは維持します。turnごとにinline証拠開示があり、長文reply/probability/criteria/技術JSONはlocal disclosureで参照できます。別turnを開くとnative HTML detailsで前の証拠を閉じます。

source確認で成功 `supplementStatus: completed` が `reason` としても返りUIで汎用失敗にmapされることを見つけました。producerは成功reason nullと別supplement statusを返すよう修正。失敗supplementでも実Jev cardを保持し、補足失敗を明示、ineligible/decision-errorと区別します。再現可能source-level誤表示の説明で、所有者session応答の復元ではありません。表示JSONは厳密parseしたnative decisionでrawHTTP/API/Customer dataではなく、confidence0を含むnative値は不変です。

offline検査はproducer mock transportと実React SSRを含みます。[3turn画面](evidence/ui-refinement-three-turns.png)、[inline証拠](evidence/ui-refinement-inline-evidence.png)、[native JSON展開](evidence/ui-refinement-native-json.png)は保存S1 native応答とmock会話を使いました。bannerは保存応答renderであり3live実行／新推論でないと明示します。browserは最初のturnを開きJSON展開、2番目選択、閉じる操作を確認。別label付きmock pageでsupplement失敗/ineligible/decision-errorも検査し、[補足失敗](evidence/ui-refinement-supplement-failure.png)、[対象外](evidence/ui-refinement-ineligible.png)、[判定error](evidence/ui-refinement-decision-error.png)を保存しました。UI改善中agent model/API送信なし、新依存／UI framework追加なし。

## 過去の確認 — 2026-10-06に受け入れたlive S1保険turn

2026-10-06のfresh S1 browser送信1回は、normalLLM/MCP、当turn事実検証、nativeJev3質問、日本語補足まで完了しました。送信前／完了後bash dateは**12:23:17／12:24:11 JST**でlatency計測ではありません。実web imageは `sha256:6c29a58e6bb23a25545345d70903c1d573fdabb75da208113442ac88098ea5ae`。auto tool choice、host補完、failed-receipt guard、actor UIを含みます。以下表示のみ2修正はlive後です。最終sourceはweb起動／推論なしでbuildし `sha256:6f0819924e9a6a632ef444081347e9c4887f8260f7ecd7978c8b943c2a0e5fec`。build検証のみで追加live-tested imageではありません。

- LLMは必須MCP4toolを全て選択。receiptは **LLM4 / host0**、当turn業務GETはclaim/customer/policy/product各1です。host不足補完はoffline S1/S2/S3 mockで検査し**live未実行**。S2/S3 live、live比較、複数turn liveは未実施。
- [投影事実](evidence/live-s1-a-projected-facts.json)はscope内合成IDとallowlist field。Customer投影はID/record-foundのみ。[不変native card](evidence/live-s1-a-native-card.json)はmodel `jev-1.13.0`、usage745input/160output、desk `claim_progress`（confidence1）、旧priority **1.24**（confidence **0**）、nextcheck `claim_progress`（0.85）。confidence0を保持し、別LLM補足は意見でJev訂正ではありません。
- [通信投影](evidence/live-s1-a-checkpoint.json)は12:23:17〜12:28:57 JST。DPlogはnormal200×5、Jev200×1、未分類MCP protocol成功14、APIlogは必須entity各GET/200×1。観測応答で**厳密host予約／wire合計／billing countではなく**、protocol/discoveryは業務4GETと別。正確なnormal host予約snapshot未保持。当時capはnormal7/Jev1/MCP8。
- 元live screenshotは[card](evidence/live-s1-a-card.png)、[詳細](evidence/live-s1-a-card-details.png)、[取得者と補足](evidence/live-s1-a-provenance.png)。各**同じ1turn**のsingle viewportでtile合成／3実行ではありません。raw response body/header/secret/raw Customerは未保存。

後の表示修正はliveAPI証拠を当turn応答とlabelし、既知同key-prefix priority凡例を翻訳。未知凡例はraw fallback、nativeJSON/score/confidence/probabilities/modelは不変。[保存応答表示](evidence/live-s1-a-saved-response-display.png)は現 `summarizeDecision` / `displaySource` と保存cardによる**local static replay**で、live Next page／新live結果／追加推論ではありません。bannerで区別しています。

own webは**12:28:57 JST**に停止、DP/5API保持、tracked live既定offでした。19:02再開時、停止以来保持DPlogのnormal/Jev route言及0ですがbilling/full-wire保証ではありません。一時replay-only loopback serverも検証後停止。S1後新有料呼出しなし、実費は不明で0ではありません。公式Model→Advanced mappingとnativeJev実通信は確認、個別generated plugin対応／handler実行は先のsmoke説明どおり未観測です。

最終offline lint/typecheck/**56unit tests**/secret-scan58files0（最終証拠追加後）/Nextbuild/diffcheckがpass。独立reviewは取得契約と最終mapping差分を受入。中断により受入結果保存が遅れましたが再開時runtime観測、元live証拠、offline表示変更を分離し、新推論で検証しませんでした。以下は歴史で現行受入状態ではありません。

## 2026-10-06時点のOwner input記録（履歴）

- Konnect CP/telemetry host/SNI、DP cert/key path。Compose mountはread-onlyで、供給fileがなければ意図的に失敗します。
- 静的通常ModelはGemini/GPT・OpenAI target、alias `insurance-normal`、round-robin候補。当時作成はGeminiのみでOpenAI keyなしのためOpenAI未設定。最新記録はGemini2.5とS1 tool経路を観測しGPT未検証。inbound認証は固定 `apikey`。`.env.example` の `AI_GATEWAY_BASE_URL` / `AI_GATEWAY_MODEL` は一致route/alias候補でlive値ではありません。
- 別native TypeSafe Modelは `decisions`、`formats: [{ type: typesafe }]`、native `/v1/systemone`。`jev-latest` は版未固定候補で、ChatCompletionsや通常Modelへ通しません。env候補は所有者作成entityと一致が必要でprovider/inbound認証は所有者入力です。
- 同DP経由5AI MCP Server `conversion-listener`、各詳細GET1。`MCP_*_URL` は `mcp-*.json` route候補でlive serverではありません。REST起動だけではMCPにならず、管理entityを作成し、2.xがAI MCP Proxy機能へmapします。legacy plugin手動設定／個別generated instance観測を主張しません。
- normal/Jev/MCP受信は別AI Consumer credentialを固定 `apikey` headerだけで送信。provider秘密は別（Gemini `x-goog-api-key`、TypeSafe Bearer）。strategyはquery/body無効、credential非表示。local fetch adapterはSDK Authorizationを除き、完全一致Gateway origin/routeだけへkey送信、redirect拒否。別keyは1strategy共有でroute別認可分離ではありません。
- 所有者承認timeout。normal SDK `maxRetries: 0`、Jev host1試行だけではDP retry無効を保証しません。後の両Model読取はbalancer retry0/failover空ですが設定証拠でruntime retry挙動／上流1試行証明ではありません。MCP invocation countも上流1試行を証明しません。

静的scaffoldだけでDP登録／Konnect疎通／Model readiness／上流成功を証明せず、別途作成リソースは承認記録を参照します。`kong health` はprocess healthのみです。

## 現行ソースの取得境界

通常LLMは `toolChoice: auto` で任意のMCP toolを使います。正常なLLM応答後に必要事実が未取得なら、同じscope・projection・turn-local ledger・timeoutの範囲でhostが補完します。IDはこのターンで取得した事実内のrootとrelationshipからのみ導出し、成功済みGETは再利用します。前ターンのsnapshotや会話文から事実を補うことはありません。LLM通信失敗、scope/reference違反、事実取得不足はJev実行前に停止します。hostのREST bypassは許可されません。

各ターンの取得と追加確認度の現行仕様は[design brief](design-brief.md)、[ADR 0001](decisions/0001-agent-and-host-decision-boundary.md)、[ADR 0002](decisions/0002-fresh-turns-and-contextual-intake-v2.md)が正本です。旧 `parent_snapshot` 比較機能は撤廃済みで、後続の日付付き確認にあるsnapshot記述は過去仕様です。

## Entity候補と読み取りCLIの境界

[`config/konnect-ai-gateway/`](../config/konnect-ai-gateway/README.md) 内のJSONはowner review用request-body候補です。`kongctl`/decK/Terraformの宣言bundleでもApply-ready設定でもありません。新しい利用者のOrganization、Gateway ID、credentials、stateを含めず、この作業ではKonnect APIへのEntity作成・更新を行っていません。

ローカル `kongctl` 1.13.0の `get ai-gateway` はbetaで、models、model-providers、mcp-serversの読取コマンドを持ちます。AI Auth Strategy用の直接get commandは確認しておらず、`identity-providers`は別Entityです。`kongctl explain ai_gateway_model_provider --output yaml` には `typesafe` enumが確認できません。TypeSafe候補は当該CLIスキーマで検証できるとは扱わず、架空のCLI resource名も使いません。承認後の実設定はKonnect UIか現行公式APIスキーマで所有者が実施します。各コマンド形状は[INSTRUCTIONS.md](../INSTRUCTIONS.md)、候補の用途は[Entity README](../config/konnect-ai-gateway/README.md)を参照してください。

`model-normal.json` にあるGemini 3.5 FlashとOpenAIは未使用の静的候補です。文書化された通常経路のknown baselineはGemini 2.5 Flashで、OpenAIは実接続先ではありません。TypeSafe候補はnative `decisions` / string-state requestで、Chat Completions用ではありません。

### 過去に提案された実行段階（後続checkpointで更新済み）

当初の提案は別live承認と既知単価USD capを要件としました。2026-10-06に所有者は専用US AI Gateway準備と限定S1を明示承認し、想定Jev料金を了承。金額cap／費用保証は創作しません。07:34時点はJev create400で停止し、後の進捗を以下の時点記録に保存しています。

0. **静的のみ:** live0。JSON parse、offline test/config検査だけ。
1. **DP登録／起動:** 所有者は専用登録／起動1試行を承認。最大120秒観測しhealthyでなければ停止。local healthはprocessのみで再接続／Konnect登録成功の保証ではありません。
2. **合成S1 claim1turn:** 所有者は限定1turnと想定Jev費用を承認。単価／総費用不明、request制限は金額capでありません。当時提案最大normal host7（取得6＋補足最大1）、Jevhost1、app MCP8（S1最大4unique業務GET想定）。5 MCP `client.tools()` discovery/protocol handshakeは別記録でMCP invocation counter外。候補timeout normal20/Jev10/MCP5秒、requester観測最大5分は強制global deadlineではありません。token output cap／金額強制なし、countで費用保証しません。同turn再試行しません。S2/S3はS1成功条件付きで当時範囲外。

この時点で所有者承認はHTTP400停止を解除しませんでした。後の限定診断／設定修正を次節以降に記録します。

## 過去のライブ確認 — 2026-10-06 07:34 JST時点

07:34 JST（承認された試行開始から約37分）の確認では、専用US hybrid AI Gatewayが存在し、DPの公開証明書が登録されていました。DPコンテナは未起動で、モデル、MCP、Jev、保険APIへのリクエストは送信していません。有料providerリクエストは**0**です。provider料金とagent単位の費用は不明です。所有者は想定されるJev料金を了承しましたが、金額上限や費用保証を主張しません。

Gateway読取結果は `min_runtime_version: 2.2`、`runtime_auto_upgrade: true` でした。自動更新がself-managedイメージへ影響するかは未検証で、コンテナ／runtime版も未観測でした。当時作成したリソースと固有IDは次のとおりです。新規構築では流用しません。

| リソース | 名前 | ID | 当時の結果 |
| --- | --- | --- | --- |
| AI Gateway (hybrid) | `insurance-demo-live-20261006` | `3754a93c-fba3-4b95-adbb-b429816b431c` | 作成HTTP201、設定／telemetry endpointあり |
| DP証明書 | `insurance-demo-dp-20261006` | `dda4db4e-356e-4827-8b6f-a2087717bca9` | 公開証明書登録HTTP201、秘密鍵はlocalのみ |
| Gemini provider | `insurance-demo-gemini-live` | `3458cfe7-6cf6-43ab-a2db-7c4c3c1bf06a` | 作成HTTP201 |
| TypeSafe provider | `insurance-demo-typesafe-live` | `b1beed46-1768-4339-873d-1c539abdef62` | 作成HTTP201 |
| AI Auth Strategy | `insurance-demo-live-key-auth` | `ac215e4b-b800-4e38-a5af-9e474d14a67b` | 固定 `apikey` header、query/body無効、credential非表示 |
| AI Consumer | `insurance-demo-local-app` | `6e2c6d16-0fc9-494b-abf4-2cb65f225e8b` | 作成HTTP201 |
| Consumer key credential | 通常slot（local名） | `fd0f3840-8bc1-4924-8238-af7033abe318` | 1回作成、値は記録しない |
| Consumer key credential | Jev slot（local名） | `7abb48e5-4260-41ac-8c69-041c2ed367df` | 1回作成、値は記録しない |
| Consumer key credential | MCP slot（local名） | `a09bd2af-8c5f-442c-a801-6b1e3cfde5f6` | 1回作成、値は記録しない |
| 通常AI Model | `insurance-normal` | `c23d9df9-413d-4adc-92ca-72d42eb8e80d` | 作成HTTP201; Geminiのみactive、retry0/failover空/payload logging off |

この試行の通常モデルはGemini targetのみを使用します。OpenAI keyがなかったためOpenAI provider/targetは作成していません。native TypeSafe Jev Model作成は**HTTP 400**でした。その後のread-only一覧は `insurance-normal` のみで、Jev Modelは未作成でした。安全なcallerがエラーbodyを破棄したため、正確なfieldと原因は復元できません。必須／拒否fieldは不明で、`config.balancer.algorithm` の必須性とenumも未確認でした。algorithm欠落を400の原因とは特定していません。根拠と所有者の指示なしにJev Modelの `config.balancer.retries: 0` や `failover_criteria: []` を削除しません。

2026-10-06の所有者承認後、08:34 JSTに秘密を含まない再構成body（SHA-256 `3289cbdf27568d9db9e15c6cee7081e9f9d304ca42332097dd959bd9e000e791`）で診断用Model作成POSTを1回試しました。既存TypeSafe providerを参照し、上流 `JEV_API_KEY` はbodyに含めません。callerはHTTP statusのない `URLError` を返し、内部reasonを保持しなかったためKonnectへbytesが届いたかは不明です。その後のread-only GETはHTTP 200で通常モデルのみでした。`insurance-jev-decisions` はまだ存在せず、POST再試行はしていません。無条件再試行を避け、原因解決までMCP作成、DP起動、S1/S2/S3通信を停止しました。

診断結果は合意した受入条件を満たしませんでした。著者が `URLError.reason` を破棄し、先の400応答分類の消失を繰り返したためです。`56bf308` でManagerは `scripts/konnect-diagnostic.py` を初期代替として作成しました。許可済みfield/code、固定categoryまたはtransport type／数値codeだけを保持し、raw exception文字列、header、bodyを出力せずresponse streamを閉じます。`python3 scripts/konnect-diagnostic.py --self-test` はoffline mock検査です。`--get-models` はread-onlyで、事前供給された `KONNECT_TOKEN` が必要です。TLS証明書／hostname検証は有効、redirectは拒否、CLI POST modeはありません。別POSTには所有者の再承認とread-only重複回避が必要です。初期4テストはmockでした。別途Managerが2026-10-06に新clientで実GETを1回行い、検証済みTLSでHTTP 200、通常モデルのみを確認しました。これはJev登録の証明ではありません。GET 200だけで失敗POSTがHTTP前だった、原因がTLSだったとは判断できません。provider通信／費用の証拠はなく、DPのLLM/Jev/MCP/保険呼出しやDP起動はありませんでした。初期classifier `56bf308` はtop-level `code`、`message`、dictionary `fields` pathのみを認識します。native error envelope適合は未確認で、nested `errors`、array `details`、未知pathは `http_error` のみになり得ます。保証するのはbounded sanitizationで、400原因診断ではありません。閉じたcode allowlistは[Konnect API Errors](https://developer.konghq.com/api/errors/)の汎用lowercase codeを含みますが、AI Gateway Model作成のerror envelopeは証明しません。次POSTを提案する前にnative shapeをread-only確認し、必要なら根拠のあるfield pathだけを拡張します。未分類応答からpayload修正を推測しません。

### 再承認後の診断1回

2026-10-06 08:58:30〜08:58:32 JSTにManagerはレビュー済みhelperを変更せず、新POSTをちょうど1回行いました。request hashは `3289cbdf27568d9db9e15c6cee7081e9f9d304ca42332097dd959bd9e000e791` のままです。保持した結果は `HTTPError`、status `400`、category `http_error`、delivery `http_response_received`、許可済み `fields` は空、認識された `code` なしでした。HTTP応答受信は確認できましたが、具体的拒否理由と副作用なしは未確認です。最後のGETはPOST前で通常モデルのみ、試行後GETはありません。再試行も後続作業も行っていません。helperはbodyを一時local変数でだけ読み、responseを閉じて終了し、raw body/messageは復元できません。合意した診断原因を得られなかった3回目の失敗です。Managerは既知parser制約があるまま実行し、Coordinatorも限定precheckを受け入れました。安全出力検査は診断受入として不十分でした。

著者による限定比較と独立レビューは、追加Konnect HTTPなしで公開[TypeSafe Model例](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)との次の差を確認しました。

| 送信要素 | 公開例との比較 |
| --- | --- |
| `type`, `capabilities`, `formats`, target Model／configと `/jev` route | native shape一致：model、decisions、TypeSafe、jev-latest |
| provider参照 | 例名を既存provider名へ置換。[AI Model資料](https://developer.konghq.com/ai-gateway/entities/ai-model/)はname参照を指定 |
| `enabled`, 空の `policies`, `access.auth_strategies`, loggingとbalancer | 最小例への追加。省略されていることは拒否の証明でない |
| provider認証 | 上流Bearer keyはprovider所属、inbound key-authは別のmodel access制御。bodyにkeyなし |

[Load balancing資料](https://developer.konghq.com/ai-gateway/load-balancing/)はretry／failover制御を説明しますが、algorithm欠落がこの400の原因とは証明しません。推測でaccess、payload logging抑止、`retries: 0` / `failover_criteria: []` を削除すると認証・privacy・呼出しbudget境界を弱め得るため、その変更は提案しません。

次の方法は盲目的なPOSTではなく診断受入の修正です。Coordinatorの固定分類のみという要求は原因回復を過度に制限したため、最小のredacted説明を保持する要件へ改めました。helperは既知error containerだけを辿り、最大4件の `message` / `title` / `detail` / string `error` を各512文字までと安全なshape情報を保持します。raw JSONは最大64 KiBで一時memoryのみです。環境変数と、Git管理外・非symlink・`0600` のlocal handoff/overlay 2ファイルの既知secretをURL/JSON/base64形も含め完全一致でmaskします。sensitive keyの値を辿らず、Bearerやlabel付きcredential文字列もmaskします。未知structure/codeは任意値ではなくshapeだけを保持します。6 offlineテストはnested/string説明、secret canary、未知code、size制限、transport分類、TLS/redirect境界を検査しました。この修正版でAPIは呼んでいません。

native envelopeの証明や、認識した説明中に未知・unlabelled secretがない保証ではありません。Git/commentに追加する前にredacted証拠をlocalでレビューします。利用可能ならnative schema/error形式をread-onlyで解決し、次の診断は新たな所有者判断後にだけ選びます。登録、MCP作成、DP起動、全model/Jev/保険通信は停止のままで、retry/auth/privacy設定も不変です。

Context7は公開製品のqueryだけで調べました。`Jev` 単独は第三者clientを返し、`TypeSafe AI Jev` は公式library `/websites/typesafe_ai` と `/typesafe-ai/typesafe-sdk-python` を特定しました。公式資料queryは[API](https://docs.typesafe.ai/api)のnative `/v1/systemone`、上流Bearer認証、state/questions/answers、`jev-latest` を返しました。版を固定していない現行資料であり、Jev sourceなしでも契約理解を補助しますがKonnect登録error envelopeは定義しません。Worker Aが公開契約を確認、ManagerがContext7、Worker Bが構造比較と停止境界を独立レビューしました。

### local loader不具合とpreflight修正

2026-10-06 09:19:37〜09:19:38 JSTに `86428f1` と変更なしのレビュー済みpayloadで、新たに承認されたPOST関数を1回呼びました。Managerのad-hoc wrapperは `request_models` の結果を受け取った後、出力前に `known_secret_values` を再呼出しし、`Path.open` が `opener` 非対応のため `TypeError` になりました。関数結果が未出力なのでPOST HTTP status/deliveryは確認できません。追加POSTはありません。secretを含まないstack traceが出てno-traceback規則に違反しました。raw response body/header/credentialは出力していません。

不具合はwrapperだけでなくscript内にもありました。`classify` 内では同じloader errorを `message_redaction: unavailable` として抑止し、statusは保持できても説明を失います。wrapperは返却証拠全体を失いました。以前のsecret注入テストはloaderを迂回し、他canaryテストも全説明が抑止されるとpassできました。著者、独立review、Coordinator spot-checkは実行前に非対応Python APIを検出できませんでした。

限定修正は組込み `open` と `O_NOFOLLOW` を使い、HTTP前に `request_models` 内で既知redaction値を一度だけ読みます。loader失敗は固定 `redaction_preflight_failed`、delivery `not_attempted` を返し、post-call loaderやsanity wrapperはありません。実ファイル統合テストは一時 `0600` overlay/handoffと同じPOST入口をmock HTTP 400で使い、説明が有用かつcanaryなしと検証します。unsafe permissionはopener呼出し0を確認します。canary fixtureは既知値を供給し、説明抑止を成功とせず説明の存在をassertします。7 offlineテストがpassしました。

所有者承認のread-only部分確認は修正関数で09:22:38〜09:22:39 JSTに実施し、HTTP 200、通常モデルのみでJevなしでした。local loaderと検証済みTLS GET経路を検証するもので、POST error取得やlive Jev動作ではありません。その後追加HTTP、MCP作成、DP起動、host推論はありません。新POSTは保留で、次判断はこの実行不具合を考慮し、変更なし再試行が元400を説明すると仮定しません。

受信key 3値はGit管理外 `.env.live.local`（`0600`）のみ、新DP秘密鍵はGit管理外 `certs/ai-gateway-client.key`（`0600`）、公開証明書は `certs/ai-gateway-client.crt`（`0644`）です。この表とrepoにsecret値はありません。local adapterは別々の `AI_GATEWAY_API_KEY`、`AI_GATEWAY_JEV_API_KEY`、`MCP_API_KEY` を固定 `apikey` headerで使います。これらは受信Consumer credentialでGemini/TypeSafe provider credentialではありません。3キーは1strategyを共有し、route別認可分離を提供しません。外向きGemini認証は `x-goog-api-key`、TypeSafe認証は `Authorization: Bearer <key>` です。

cleanupは未実施です。別途承認された場合だけ新Gateway配下を逆依存順で削除します：Models/MCP（当時failed Jev/MCPは存在せず）、3credential、Consumer、strategy/providers、登録証明書、最後に専用Gateway。続いて新Git管理外overlay/証明書だけを削除します。既存OBO CP/Gatewayは範囲外で変更／削除しません。

## 再利用と2.2固有の境界（当時の確認）

参照patternはlocalの `picketfence-labs/kong-azure-obo-demo@7d11ca10c90d4fea61d1679412f01738784204d3` で確認しました。対象は `docker-compose.yml`、`.env.example`、`services/chat-ui/Dockerfile` と `.dockerignore`、`services/demo-api/Dockerfile` と `.dockerignore` です。Compose bridgeとread-only cert/key mountを再利用し、UI/DPのloopback限定公開を追加しました。参照repoはGateway 3.16のplugin modelであり、AI Gateway 2.2 entity設定として使いません。

AI Gateway 2.2はKonnect管理CPとself-managed DPを使います。要求imageは `kong/kong-ai-gateway:2.2.0`、`KONG_*` 名は公式設定資料（最低2.0）に従います。当時はimageの既定起動と `kong health` を実行／独立検証していなかったため、DP定義は起動scaffoldで、稼働／登録証拠ではありませんでした。healthcheckはlocal process healthのみを意図します。

API sourceのOpenAPI operation IDは、MCP所有者にとってアプリが許可する詳細GET候補です。AI MCP Server/entity/routeは次のCompose内部originをtargetにし、必要操作だけを公開し、実DP route URLをlocal envへ設定します。

| 候補 `MCP_*_URL` | 内部REST詳細target | MCP route／生成input | 詳細GET operation ID |
| --- | --- | --- | --- |
| `http://ai-gateway:8000/mcp/product` | `http://product-api:8000/products/{product_id}` | `/mcp/product` / `path_product_id` | `get_product_products__product_id__get` |
| `http://ai-gateway:8000/mcp/customer` | `http://customer-api:8000/customers/{customer_id}` | `/mcp/customer` / `path_customer_id` | `get_customer_customers__customer_id__get` |
| `http://ai-gateway:8000/mcp/application` | `http://application-api:8000/applications/{application_id}` | `/mcp/application` / `path_application_id` | `get_application_applications__application_id__get` |
| `http://ai-gateway:8000/mcp/policy` | `http://policy-api:8000/policies/{policy_id}` | `/mcp/policy` / `path_policy_id` | `get_policy_policies__policy_id__get` |
| `http://ai-gateway:8000/mcp/claim` | `http://claim-api:8000/claims/{claim_id}` | `/mcp/claim` / `path_claim_id` | `get_claim_claims__claim_id__get` |

operation IDは `picketfence-labs/kong-api-bundle-insurance@ab96eea303e27fe02d98344a31bc7633753da77e` の各 `services/<name>/openapi.yaml` 由来です。完全一致する詳細GETだけが許可契約で、一覧／書込／simulationは範囲外です。Kong conversion-listenerはpath引数に `path_` を付けます。hostは認可境界で期待ID名だけを正規化し、元SDK argsは変更せずforwardします。余分／重複／他種／空／非string IDは業務request前に拒否します。RESTコンテナだけではMCPになりません。これらは後のlive確認前は候補でしたが、後に5entity/routeを作成しました。後続確認は限定request証拠と未受入範囲を記録します。

仕様の参照： [AI Gateway architecture](https://developer.konghq.com/ai-gateway/architecture/),
[configuration reference](https://developer.konghq.com/ai-gateway/configuration/),
[AI Model entities](https://developer.konghq.com/ai-gateway/entities/ai-model/),
[TypeSafe provider](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/),
および[AI Model load balancing](https://developer.konghq.com/ai-gateway/load-balancing/).

## 保険API source

API imageは兄弟checkout `../kong-api-bundle-insurance` のrevision `ab96eea303e27fe02d98344a31bc7633753da77e` からbuildします。既存 `services/Dockerfile` の5つの `SERVICE` とseed配置をレビューし、このrepoのwrapperは選択API codeと一致seedを各imageへ格納します。Dockerfile専用ignoreはallowlistで、無関係source、`.git`、local env、agent指示をcontextへ送りません。元のstatic review時点ではimage build未実行でした。後のruntime確認を参照してください。

## 安全な静的確認

Docker Compose v2で、コンテナ起動／registryアクセスなしに補間を検証します。

```sh
docker compose --env-file .env.example config --quiet
```

DP certと兄弟API sourceは将来runtime試行の所有者／local前提でした。この静的確認はbuild、起動、疎通、live受入ではなくlive通信開始の承認でもありません。既存secret-scanはCompose/Dockerfile/ignore/env template形式の全coverageを証明しないため、独立した手動path/placeholder/secret reviewが必要です。

既存 `.github/workflows/ci.yml` はoffline merge検証で、push/PR時にNode22、live gate無効、telemetry offでinstall、lint、typecheck、mock test、secret-scan、production buildを実行します。Compose `config --quiet` はA/B/Managerのlocal検査のみでCI jobではありません。当初static確認でCompose build/起動はなく、後のlive確認を参照します。全サービスは同じbridgeを共有し、host非公開APIへweb/DPがCompose DNSで到達できるため、network-level分離はありません。

## 過去のライブ確認 — 2026-10-06 10:02 JST以降

この記録は先の「Jev modelなし／MCP未作成／runtimeなし」を更新します。先の記述は当時の状態です。Jev最初のcreateはHTTP 400で、redacted field `config.balancer`、discriminator `algorithm` 欠落を示しました。限定修正は `algorithm: round-robin` を追加し、`retries: 0` / `failover_criteria: []` を保持しました。修正create 1回は09:34:07〜08 JSTにHTTP 201、Jev Model ID `fffee564-6af2-4a69-a172-fe6403923ea3`、payload SHA-256 `4cc9f6efa9a95c7301e7a4a8e9e954ee1d19f3c5a10f21e12057df744bada459` でした。read-only metadataはenabled、retry0、failover空、payload logging offを確認しました。受理された設定の証明でend-to-end Jev実行ではありません。

5 MCP Serverは2つの限定payload修正後それぞれHTTP 201でした。Consumer ACLを `acl_attribute_type: consumer` と明示し既存 `insurance-demo-local-app` を許可、2.2 schemaが拒否する任意tool annotationを省略しました。認証は無効化せず、各listenerは固定key-auth strategyを継続しました。IDは次のとおりです。

| MCP entity | ID |
| --- | --- |
| product | `16874677-6056-4016-bd6b-534277690dfc` |
| customer | `2809d067-10a0-40d7-8e2f-e99c0489aaed` |
| application | `0dc09a19-273f-471b-8624-625ee11ca850` |
| policy | `a23fc5b0-2fed-4049-ac70-6bcec1f5e012` |
| claim | `e477ffc1-1ef4-477e-97f2-cdd92f2d6042` |

6 Docker image buildが成功しました。Composeはnon-web 6serviceを `up -d --no-build` で起動し、後にwebを起動しました。DPの `kong health` は成功（process healthのみ）。native Konnect node読取はDP node ID `739088a9-1831-4f51-8df2-5b2c8a353542`、hostname `3e181700a0b2`、version `2.2.0` を報告し、status/hash投影fieldは未確認です。認証なしcustomer MCPはHTTP 401で、route/auth処理の証拠ですがtool成功ではありません。Git管理外local overlayは `0600`、tracked live gateはoffのままでした。

日本語UIがreadyになり、承認された最初のS1を10:02:04 JSTに送信しました。2回目の通常Gateway requestがHTTP 400となり、UIはHTTP 502で失敗しました。後の限定S1と最終停止を以下に記録します。自動再試行やS2/S3は行っていません。

sanitized request証拠は通常POST 1回HTTP 200、認証listenerへ5 MCP `tools/list`、claim `tools/call` 1回、唯一の業務 `GET /claims/CLM-000015` HTTP 200を記録しました。Product/Customer/Application/Policyの業務GETとJev routeは未観測です。次の通常POSTはHTTP 400、アプリrouteは汎用502でした。provider error body未保持のため原因は不明です。log eventは最終usage/receipt summaryの代用ではなく、後続完了・decision・費用額も証明しません。

### 限定した互換性所見（原因未確認）

claim endpointはrecord自体を返します（`main.py` は `store.get` 結果で外側 `data` envelopeなし）。MCP adapterは `structuredContent` またはJSON text blockを受け、投影は完全一致 `claim_id` とallowlistを検証します。claim HTTP 200後の2回目model requestはこの経路と整合しますが、具体MCP result envelopeは未保持です。MCP shapeが後の400を起こしたとは特定できません。

最初のS1通常targetは `gemini-3.5-flash` でした。GoogleはGemini3 function-call thought signatureを次requestに必須、Gemini2.5は存在しても任意と説明します。`@ai-sdk/openai@4.0.60` parserは返却OpenAI tool callをname/argsへmapし、serializerはassistant/tool fieldsとtextを再構成しますが、Google固有thought-signature metadataを往復保持しません。具体互換gapで、tool後400のもっともらしい説明ですが**確認済み原因ではありません**（400 body未保持）。Kong Gemini資料はOpenAI互換 `/chat/completions` の `generate` を支持しますが、このmodelの複数step signature/tool往復を証明しません。

互換性評価時の `gemini-2.5-flash` はread-only metadata上のfallback候補だけでした。後の所有者承認によるmodel更新とS1結果は次の最終確認にあります。

参照： [Gemini 3.5 Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash),
[Gemini thought signatures](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures),
[Gemini 2.5 Flash model](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash),
および[Kong Gemini provider](https://developer.konghq.com/ai-gateway/ai-providers/gemini/).

## 限定S1の最終確認 — 2026-10-06 10:31:57 JST停止

通常AI Modelはnative APIで一度更新（HTTP 200）し、`gemini-2.5-flash` のみにしました。readback HTTP 200は全許可fieldがレビューpayloadに一致し、更新前との差は意図したtarget名だけでした。payload SHA-256 `3da25c8c6248901682c39b1a591d22e9428679d7a671f3e0249f9504e75cb812`、retry0/failover空/payload logging offを保持しました。受理設定で、生成成功やtool往復の証明ではありません。

先のS1 3turnは各2normal POST、1MCP `tools/call`、0Jevでした。最後の送信前 `date` は10:31:14、web停止 `date` は10:31:57 JSTです。43秒は観測区間でrequest所要時間ではありません。UIはHTTP 502、cardなし。logは通常POST 3回HTTP 200、MCP call3回、Jev route0回でした。業務GETはclaim `CLM-000015`、customer `CUS-000011`、policy `POL-000042` 各HTTP 200で、Product/Applicationは未観測です。S1はJevまで完了していません。登録Model、DP health、node登録は別々の設定／process証拠でJev推論を証明しません。

限定S1 4試行の観測log合計はnormal POST9、業務MCP call/GET6、Jev route0です。MCP `tools/list` discoveryは別で業務countに含めません。完全なwire/provider usage台帳ではなく、最終host予約／phase、timeout/abort詳細は未保持、provider billing/usage未検証です。無課金とは主張せず実費は不明です。[最終S1失敗画面](evidence/live-s1-required-tools-failure.png)は最後の1turn後のfull-page screenshot 1枚です。繰り返しtileはcaptureのtiling/stitchingの可能性があり、追加turnの証拠ではありません。

変更前の歴史的挙動はS1必須factが不足するとtool choice `required`、台帳完成と参照整合後 `none` でした。現行は上記 `auto` と明示された正常完了後host補完に置き換わっています。当時Bは差分をPASSとレビュー。offline検査は39テスト、typecheck、lint、diffcheck、secret-scan53files/0findings、最終Docker buildがpassしました。最後のS1は失敗したため、この確認で追加試行は承認されません。

09:29開始〜10:31:57停止の回復区間は約63分で、先の15〜25分予測を超えました。主な遅延はnative schema修正、OpenAI互換Gemini tool/signature互換性、その後の必須ledger不足です。アプリ汎用catchは安全なfailure phase／最終cardを保持せず502を返し、診断制約でした。通常の不足fact対象外はHTTP 200なので、502はJev前acquisition/validation例外を示しますが、正確なthrow位置／原因は未保持です。

## 失敗phaseの確認 — 2026-10-06 11:04:40 JST停止

所有者は安全なhost-failure計測、local faultテスト、追加S1ちょうど1turnを承認しました。prompt/model/CP schema/retry/budgetは変更していません。計測は固定phase、限定type/category cause chain、host予約snapshot、ID/factなしentity/status receiptを出します。別承認HTTP error loggerはserverで短い既知secret-redacted説明を保持しますが、未知PII検出を保証せず共有前local reviewが必要です。固定host-eventテストはconsole全体のPII検出を主張しません。

local検査は46tests（39contracts＋7execution-path fault）、lint warningなし、typecheck、secret-scan54files/0、diffcheck、最終Docker web buildがpass。Bは新7fault testsを独立実行し重要source/test差分PASSでした。再build imageは `sha256:3666eaf8c82646a5cdbc8d568c9c3a6ea788025eab560181a04c4fc34d73c113` です。

新web process開始 `date` は11:02:53、送信前11:03:08、停止11:04:40です。provider/request所要時間ではありません。1S1はHTTP 502、Jev cardなし。固定eventは `normal_sdk`、次に `acquisition`、`unknown_error_type` / `unknown_error` で具体例外type/cause未保持です。両eventの同一予約snapshotはnormal Gateway2、acquisition generations2、supplement0、MCP invocations1、own-run Jev reservation0、process Jev budget reservation0です。重複phase snapshotを合計しません。取得kindはclaim、receiptは `claim: completed` のみです。HTTP応答後SDK acquisition中例外を特定し、SDK正常完了ではありません。

DP logは別にnormal HTTP 200×2、業務MCP×1、claim GET200を観測。他業務GET/Jevなし。5 `tools/list` は別です。non-2xx HTTP説明eventはありません。以前4turnのnormal9/業務MCP6/Jev0は別の歴史countで、どちらもprovider billing台帳／無課金証明ではありません。実費は不明です。

追加S1/S2/S3通信を停止し、own web停止、DPと5APIを保持、cleanup/deleteなしでした。[日本語の安全な失敗画面](evidence/live-s1-phase-failure.png)は1turnのviewport captureでfull-page tile合成ではありません。当時live Jevデモは未完成でした。新記録はphase/予約provenanceを回復しますが、unknown固定分類で具体原因は特定できず、無条件再試行は未承認です。

### 停止後のAPIなし診断修正

S1停止後、固定classifierを公開JavaScript builtinsとinstalled `ai@7.0.92`、`@ai-sdk/provider@4.0.10`、`@ai-sdk/provider-utils@5.0.36` の35 static `AI_*` 名へ拡張しました。`error.name` とconstructor fallbackは固定公開catalogだけと一致し、host-failure eventは未知値/message/stack/error payloadを出しません。canary/constructor fallbackテストを追加。この変更は11:03S1 imageに**含まれず**、失った具体例外を復元できません。classifier coverage不足は診断不具合で、特定されたlive原因ではありません。

実 `generateText` とOpenAI adapterのAPIなし再現は、wire `tool_choice: required` に対しtextのみ/tool_callsなしの合成mock HTTP 200を1回受け、公開 `AI_ToolChoiceViolationError` を発生させました。現分類は `model_tool_choice_violation` です。再現可能候補で、元S1のnormalized response/type未保持なので実原因の証明ではありません。Bがnetworkなしで独立実行したunit testです。最終localは48/48（41contracts＋7fault）、typecheck passでした。

別MCP converter仮説はTypeErrorを**再現しませんでした**。`@ai-sdk/mcp@2.0.44` の `src/tool/mcp-client.ts:209–238` はcontent arrayなしoutputを `{type: "json", value: result}` に変換します。no-I/O transportの実SDK toolは合成wrapper `{source, data}` を正常変換し、Bもsource確認しました。実S1のshapeや原因を証明しません。

`@ai-sdk/openai@4.0.60` はrequiredをwire `tool_choice: "required"` にmapします（`src/chat/openai-chat-prepare-tools.ts:55–66`）。local checkoutはGateway2.2 imageを参照しconverter sourceではないため、Gemini `function_calling_config` / `ANY` 変換は未検証です。Google ANY資料やclient serializerで証明できず、sourceなしは非対応の証拠ではありません。停止後追加有料/API/turn試行はありません。

停止後lint/typecheck/48tests/secret-scan54files0/diffcheck/offlineDocker buildがpass。imageは `sha256:fb50049c62418c3f9ddb5dd57d5d00d9caf5f8b4e2b775eeff9dd435e8aff90c` で追加turnには起動していません。11:03S1は旧 `3666eaf8...` imageなので、後のcatalogから当時errorを遡及特定しません。

## native Jev / AI Proxy Advanced確認 — 2026-10-06

公式[AI Gateway 2.x entity mapping](https://developer.konghq.com/ai-gateway/ai-gateway-v2-concepts/)はCPが内部primitiveを設定し、AI ModelをAI Proxy Advancedへ対応付けると説明します。native2.x設定でありGateway3.x plugin APIの再利用を仮定していません。[TypeSafe provider契約](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)は最低2.2、`decisions`、`typesafe` format、native requestのAI Model entity名を要求します。例pathは `/jev/v1/systemone` でbodyはChatCompletion変換せず通過します。

実 `kong/kong-ai-gateway:2.2.0` imageのread-only確認でAdvanced handler compiled module/provider dispatchを確認しました。逆アセンブルは `kong.llm.plugin.base` をimportし、`filters/setup.ljbc` が `model.provider` を読み `llm.new_driver(provider)`、`driver.prepare_dns` を呼びます。`/usr/local/share/lua/5.1/` の `kong/llm/plugin/shared-filters/configure-request.lua:52–78` は `kong.llm.drivers.<provider>` を選び `configure_request`、`normalize-request.lua:332–370,458–483` は必要時 `to_format` を呼びます。`kong/llm/drivers/typesafe.lua:45–75` はTypeSafe adapter/upstream targetを扱います。file hashは下のsanitized evidence内です。実装対応の証拠で個別request traceではありません。

専用DPのAdmin8001にlistenerはなく、内部read-only `/plugins` probeはconnection-refusedでした。再試行／公開はしません。Model/routeのgenerated plugin instance対応とhandler実行は**直接未観測**です。公式mapping、登録native TypeSafe model/provider、接続DP2.2.0、Advanced→TypeSafe実装は意図した機能利用を支持しますが、下のsmokeを個別handler traceとは呼びません。

dummy transportの独立review後、所有者承認のsingle smokeは [`scripts/jev-gateway-smoke.py`](../scripts/jev-gateway-smoke.py) を使い、専用DP loopback `/jev/v1/systemone` へ1POST、alias `insurance-jev-decisions`、合成choice質問1件、timeout10秒、redirect/proxy/retryなし、既存inbound Jev `apikey` で実施しました。上流provider credentialはclientから送りません。preflightはnetwork前に0600local secretを読み、errorは検証済みbounded redaction、成功出力は小さいallowlist投影です。

bash `date` 確認は**11:48:49〜11:48:50 JST**（provider latency計測ではない）。応答は**HTTP 200**、実model **`jev-1.13.0`**、choice **`green`**、confidence1、probability green1/other0、usage **340 input / 32 output tokens** でした。confidenceは正解保証ではありません。同時間帯DP access logもJev route POST/200を1回示します。payload hashと許可resultは [`evidence/native-jev-single-smoke.json`](evidence/native-jev-single-smoke.json) に保存し、raw body/header/credential/保険factは保存していません。

AI Gateway2.2を通した実native TypeSafe/Jev応答と公式Advanced mappingを確認しました。保険3質問ledger、normalLLM/MCP、日本語result card、個別plugin traceは**完了しません**。このprobeのnormal/MCP/client→provider bypassは0です。Gateway経由Jev1回成功ですが内部upstream送信数は直接未観測です。先のJev0観測の失敗S1とは別probeです。実費は不明で0ではありません。その後推論なし、当時web停止、保持DP/API不変、提案fact取得architecture変更は未承認でした。

進行上の所見：以前Admin probeの不透明な失敗をconnection-refused/listenerなしまで限定し、source bytecode／公式mappingとlive実行証拠を区別しました。Bはsingle real POST前に一時dummy secret/transportでhelperを独立reviewしました。probe後offlineはlint/typecheck/48unit tests/secret-scan55files0/Nextbuild/diffcheck/helper Python compileがpass。検査からweb/provider requestは開始していません。