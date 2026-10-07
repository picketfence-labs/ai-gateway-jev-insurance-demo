# 再現可能なセットアップの検証

この記録は2026-10-07 18:19 JSTまでの静的・隔離ローカル検査です。当時の未実施事項を成功へ書き換えていません。その後の実apply・実通信・destroyは[別の実接続記録](live-iac-acceptance-2026-10-07.md)に追記しています。

## 対象と境界

`app/`への配置変更、公開GHCRの保険API、TerraformによるKonnect instance・公開DP証明書、kongctlによるAI Gateway設定が対象です。アプリの会話・投影・台帳・Jevの実行契約は変更しません。

ローカルのschema・dummy入力・静的検査と、実環境への適用・推論は別です。この整備では新規Konnectリソースの実apply、既存CPの変更、モデル・Jev・MCPへのPOSTを行っていません。既存7コンテナのID、イメージID、起動時刻を変更していません。

## アプリ・コンテナ

- unit test: 79件成功（3ファイル）
- lint、TypeScript型検査、Next.js production build: 成功
- Konnect診断helper self-test: 7件成功
- Composeの静的検査、独立UI Docker build: 成功
- rootの旧`.next`、`node_modules`、`tsconfig.tsbuildinfo`は未追跡・ignore済みかつ稼働Webのhost mountが0であることを確認して削除。ソース・設定と新しい生成物は`app/`にあります。

UI Docker buildはNode 22で実施しました。ローカル検証時のNodeは23で、npmのengine警告がありました。既存lockに由来する脆弱性警告8件はこの配置・構築変更で更新していません。

## 公開保険API

[イメージ固定情報](../../config/insurance-images.lock.json)に、v0.1.3の5イメージのdigest、匿名manifest検査、source tag、seed blobを記録しています。匿名pull後、既存デモとは別の一時コンテナ・networkで、現行projectionとTurnLedgerによる10ケースの互換性を確認しました。

- 10ケース成功、許可された詳細GET 36件
- モデル・MCPへのPOSTとAPI書き込み: 0
- Customer raw情報の出力: なし
- 一時APIコンテナ・network・独立UI buildの一時イメージ: 撤去済み

保険APIのseed互換性は、通常LLM・Jevの選択や回答品質の証拠ではありません。イメージはlinux/amd64であり、Apple Siliconではエミュレーションが必要です。

## IaC・秘密・独立レビュー

- 公式安定版`kong/konnect` 3.25.0（source tag commit `4cecc82d73e5471a1cfae001c3dd9f7a0e323432`）の専用instance・public DP certificate schemaを確認し、Terraform fmt/validateが成功しました。証明書resourceにはupdate操作がなく、新version keyによる追加・DP切替・旧entry削除を手順にしています。
- 公式kongctl v1.20.2 tag（commit `d35f2d940be7cf3939912f52757d011d83646876`）を別の一時ディレクトリでbuildしました。既存CLIは変更していません。ローカルbuildのversion表示はldflags未指定により`dev`ですが、sourceのexact tagはv1.20.2です。
- 実際のCLI loaderでdummy環境変数から宣言設定を読み、external gateway 1、Provider 2、Model 2、Auth Strategy 2、Consumer・credential各3、MCP Server 5を確認しました。cloud APIは呼んでいません。
- stable schemaの`min_runtime_version`は`major.minor`形式です。`2.2`と`runtime_auto_upgrade=false`を明示し、最低対応versionの自動変動を止めてCompose 2.2.0へ揃えました。これは既存DPイメージの置換や更新ではありません。証明書の同一map keyの属性変更はreplacementとなるため、段階的なversion key rotationを維持します。
- 保存kongctl planはregionを保持しないため、planとapplyの両方に`--region us`を指定します。TypeSafe入力は`Bearer `を付けたAuthorization headerを環境変数から供給します。
- 実helperのdummy試験で、inbound keyの生成・保持、`.local` 0700、env file 0600、Terraform outputの選択的renderを確認しました。INSTRUCTIONSの3つのenv sourceを記載順に重ね、実アプリの`validateLiveConfig`が成功し、Composeのquiet検査も成功しました。外部通信は0です。
- secret scanは78ファイル・検出0件。tfvars、state、plan、`.local`、certsのignoreとscan除外を確認しました。上流・受信キーと秘密鍵をTerraformへ渡しません。
- UI Docker imageはproduction configと`app/src`だけをCOPYします。履歴evidence、unit tests、certs、`.env.local`がimage内にないことをnetworkなしの一時shellで確認しました。
- DPの0600 dummy keyはDocker Desktop上でimageの非root userから読取可能でした。一般LinuxのACL調整は文書と構文の確認だけで、Linux実機では実施していません。DPのroot化やworld-readable化は行っていません。
- Markdownの相対リンク・画像（17ファイル）、diffの空白検査、rootのTS/npm/Next/build設定・旧artifact不在を確認しました。

独立Bレビューは最終候補をPASSと判定しました。app配置・CI・Docker・GHCR、Terraformの公式stable schema/source・import・certificate lifecycle、kongctl loader・region・secret参照、helperと新規readerのコマンド順を確認し、重大・阻害指摘はありません。実Terraform plan/apply、Konnect cloud変更、DPの新規接続、モデル・Jev・MCPのPOSTは未実施です。

## 調査結論の訂正

初期調査は安定版3.22.0だけを検査し、専用AI Gateway resourceが現在の安定版にもないと範囲を広げてしまいました。独立レビューが[公式changelog](https://github.com/Kong/terraform-provider-konnect/blob/main/CHANGELOG.md)で3.23.0の専用resource追加と3.25.0のAI Gateway 2.2対応を確認しました。最終構築設定は安定版3.25.0へ切り替え、schema・lifecycle・import・静的検査を再確認しました。ローカルにある旧版の結果を現在の対応範囲へ一般化せず、対象版のreleaseとschemaを確認することが必要です。

## 初回CIのchecksum検査と修正

初回commit `471f6ff46d0566548a53d5ddb70a97a9eac06ced`では、ローカルDarwinの検査は成功しましたが、GitHubのLinux `iac-checks`が失敗しました。readonly initでproviderの取得は成功した一方、展開済みLinux packageの`h1` checksumがlockに記録されておらず、続くvalidateで一致検査に失敗しました。ローカル成功をLinux CI成功として扱いません。

公式Registryの`terraform providers lock`で、既存Darwin ARMに加えてLinux AMD64・ARM64のchecksumを取得しました。version、HCL、API構成は変更せず、lockに2つの`h1`を追加しています。tracked HCLとlockだけを一時コピーし、公式Terraform 1.15.1のLinux imageで`init -backend=false -input=false -lockfile=readonly`と`validate`が警告なく成功しました。state、秘密、証明書はコピーしていません。CIのreadonly検査は維持しています。最新commitのremote結果は[PR #7のchecks](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/pull/7/checks)で確認できます。
