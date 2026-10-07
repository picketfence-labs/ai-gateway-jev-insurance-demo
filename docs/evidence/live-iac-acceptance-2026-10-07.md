# 新規IaC環境の実接続・撤去検証

## 対象と実施範囲

2026-10-07 18:35〜19:58 JSTに、[構築手順](../../INSTRUCTIONS.md)のTerraform・kongctl・Composeを実行しました。検証した設定・アプリはcommit `8396048d8e88c8199594d7bd9a26896f1ce4e529`です。そのtracked 115ファイルを`git archive`で隔離し、HCL・YAML・Compose・helper・アプリを変更せず使用しました。既存のenv、証明書、stateはコピーしていません。

- Terraform 1.15.1、公式provider `kong/konnect` 3.25.0、公式kongctl v1.20.2のexact-tag buildを使用。既存CLIは置換していません。
- USリージョン・既存組織内に専用AI Gateway、公開DP証明書を作成。PATをTerraformの`KONNECT_TOKEN`とCLIの`KONGCTL_DEFAULT_KONNECT_PAT`へ環境変数で供給しました。
- 専用local state、新規証明書・秘密鍵、新規受信キー3本、Compose project `ai-gateway-jev-iac-20261007-0941`を使用。UIは`127.0.0.1:3001`、DP proxyは`127.0.0.1:18000`で隔離しました。
- 保険APIは固定済み公開GHCRイメージ5本をpullし、APIリポジトリのclone・buildは行っていません。UIだけをDocker buildし、DPは`kong/kong-ai-gateway:2.2.0`で新規起動しました。
- 近傍の`kong-azure-hybrid-idp-demo`はAzure/Entra/ADFSとself-managed Gatewayの別構成でした。設計・portの比較だけに使い、state、認証、リソースは流用していません。

この検証は新しい組織や全環境での再現性、回答品質全般の保証ではありません。[先行する静的検査](reproducible-setup-validation.md)と実通信を区別します。

## 作成と設定適用

| 項目 | 実績 |
| --- | --- |
| Terraform事前plan | create 2、update/delete/replace/other 0、prior state 0。既存AI Gateway ID不含 |
| Terraform apply | 成功。専用AI Gateway 1、公開DP証明書1 |
| Terraform適用後plan | no-op 2、変更0 |
| output bridge | 同梱helperで公開出力からenv生成。秘密を含めず0600 |
| kongctl事前plan | CREATE 17、update/delete/other 0。専用external Gateway ID一致、秘密書込み5件 |
| kongctl apply | 成功。Provider 2、Model 2、Auth Strategy 2、Consumer 3、credential 3、MCP Server 5 |
| kongctl適用後plan | 変更0、警告0。read-only照会でも17子リソースの名前・数が一致 |
| Compose | quiet設定検査、pull、DP userの証明書読取、UI build、7サービス起動が成功 |

作成したAI Gateway IDは`b538d3dc-e6c6-4f1c-98f2-36e3371b3798`、証明書IDは`2dbf8c4d-152e-4c9c-8647-1fd14dddfa0e`です。いずれも検証終了後に削除しました。

事前CLI planの警告7件はModel 2・MCP Server 5の同一plan内`!ref`解決待ち通知でした。公式v1.20.2のplanner実装と照合し、未定義参照・未対応設定・削除・秘密露出の警告ではないことを確認しました。

## 実通信3ターン

新規UIのroot GETとreadinessはHTTP 200、readinessはready、DPはhealthyでした。UI buildで使用したイメージIDは`sha256:eff83867cc133dafe60ff28af7ef8239acb6d4c6d850ddff4599c1c94417dddd`です。Docker buildは既存cacheを利用できる通常のbuildであり、既存稼働Webイメージの置換ではありません。

UIと同じ`POST /api/live`へ、[10ケース](../../TEST.md)のうち次の3件を各1回送信しました。失敗再試行・追加ケース・直接Jevへのbypassはありません。

| ケース | HTTP / 状態 | 当ターン詳細GET | MCP実行者 | 通常LLM要求カウンタ（取得 / 補足） |
| --- | --- | ---: | --- | ---: |
| S1 自動車の保険金請求・審査中 | 200 / completed | 4 | LLM 3、host補完1 | 5（4 / 1） |
| S2 火災保険の申込・審査中 | 200 / completed | 3 | LLM 3 | 5（4 / 1） |
| S3 火災の保険金請求・支払済 | 200 / completed | 4 | LLM 4 | 6（5 / 1） |

全件`source=live_api`、MCP receiptはすべてcompleted、Jev decisionは非null、LLM補足もcompleted、基準は`insurance-intake-v2`でした。S1では通常LLMが正常終了した後、不足した事実だけをhostが補完しています。

新規DP内の通常経路は`/v1/insurance-normal/chat/completions`（Gemini 2.5 Flash）、MCPは`/mcp/{entity}`から5保険API、native Jevは`/jev/v1/systemone`（宣言設定のtarget `jev-latest`）です。実アプリの`completed`は、当ターン台帳の関係検証とnative parserの通過を必要とします。parserは`desk`のChoice、`priority`のScore 0〜2とlegend、`next_check`のChoice、非空model、整数のinput/output usageを必須検証します。この契約と実completed結果から3項目の正常受領を確認できます。

一方、実レスポンス各項目の値・モデル名・token数はこの試験receiptへ採録していません。通常LLM要求カウンタ計16、MCP invocation計11を採録しました。native Jevの3要求という数は、3件のcompletedと実装のat-most-once・単一POST契約から導くアプリレベルの推論であり、独立したwire計測ではありません。これらはGateway内部wire request全数、provider請求回数、課金額の証拠ではありません。実請求・token総数は不明です。

日本語UIのrendered-text確認・画面採録は停止前に未取得です。root GET成功を日本語描画の検証として扱っていません。全10ケースの回答品質、実plugin handler trace、証明書rotation、一般LinuxのACL調整も今回未検証です。

## Destroyと既存環境の保護

1. 同じ専用Compose projectに`down --volumes --remove-orphans`を実行し、新規7コンテナとnetworkを撤去しました。project内コンテナ・networkは0です。
2. 同じTerraform stateのdestroy previewは作成したCP・証明書だけのdelete 2、other 0、既存ID不含でした。独立レビュー後、`terraform destroy -input=false -auto-approve -var-file=terraform.tfvars.local`が成功しました。stateファイル削除による代用は行っていません。
3. Terraform state resourceは0。新規AI Gateway、証明書item・collectionのGETは404、Provider・Model・Auth Strategy・Consumer・MCP Server・証明書の子collection照会もnot-foundでした。CP配下の作成分にアクセス可能な残留はありません。
4. 既存AI Gatewayの選択した構成field fingerprintは開始前と一致しました。Managerの独立比較で、既存7コンテナすべてのfull ID・image ID・StartedAtが開始前と完全一致しています。Coordinatorも新規CP404・既存CP200・専用project空を独立確認しました。

rawレスポンス、PII、展開済みCompose、秘密値、plan、stateはこの記録へ含めていません。private実行物は0700ディレクトリ・0600ファイルに隔離しました。独立Bレビューは実行前の作成範囲、CLI plan、Compose境界、destroy範囲と終了証拠を確認しています。

cloud削除の確認後、検証用の上流入力・受信キー・秘密鍵・証明書・plan・ログ・state backupを撤去しました。resource 0のstateと秘密を含まないreceiptは保持しています。専用UIイメージも削除し、共有イメージやbuild cacheのpruneは行っていません。

## 実行上の問題と限界

- Workerのprocess環境に上流キーがなく、Manager環境には存在しました。必要2キーだけを非表示・0600のprivate fileで渡し、JevキーをTypeSafe Authorization headerへ内部mappingしました。現行手順のenv入力自体の欠落ではありません。
- 既存baseline照会でUUID誤記と一般Gateway用APIの誤使用がありました。誤ったGET 2件は証拠から除外し、正しいUUIDと専用`/v1/ai-gateways/{id}`で200を取り直し、事前planの既存ID不含も再検証しました。書込みはありません。
- CLIのtext出力では`--execution-report-file`が未生成となり、後続`chmod`だけがexit 1になりました。CLI本体はexit 0で、再applyせずread-only plan変更0・実リソース数一致で成功を確認しました。任意reportの有無をapply成否と混同しません。
- pull開始前のexec runnerがcwdエラーでprocessを開始できませんでした。存在する絶対pathのcwdへ修正後、pull/build/upが成功しました。
- 既存baseline・静的PASSの反復確認と逐次receipt化でpreflightが長引きました。既承認の隔離境界・必須安全確認に集中し、実行とcleanupを優先してから証拠を統合する必要があります。

コード・IaCの修正は不要でした。独立レビューで、同一ホストの別cloneでも既定Compose projectが再利用される危険を確認し、構築手順へ明示的project選択・初回既存コンテナ確認・別portの案内を追加しました。本追記は実施済み範囲と残る限界を文書へ反映するもので、追加モデルPOSTは行っていません。
