# Konnect AI Gateway の構築

Terraform と `kongctl` で、AI Gateway の別々の資源を管理します。Terraform は AI Gateway instance と公開データプレーン証明書を管理します。`kongctl` は Provider、Model、認証Strategy、3つのConsumer、5つのMCP Serverを管理します。ここで使うのはAI Gateway instanceです。一般的なGateway control planeではありません。

このリポジトリの宣言設定はkongctl **1.20.2**を必要版・検査版として固定しています。導入は[公式v1.20.2リリース](https://github.com/Kong/kongctl/releases/tag/v1.20.2)と[初回セットアップ](../../INSTRUCTIONS.md)を参照してください。

## ファイルと所有範囲

| パス | 用途 |
| --- | --- |
| `terraform/` | AI Gateway instance と版管理された公開データプレーン証明書のTerraform設定 |
| `kongctl/ai-gateway.yaml` | apply可能な宣言設定。Terraform所有instanceはexternalとして参照 |
| `scripts/init-local-inbound-keys.py` | 3つのローカルConsumer keyを値を表示せず生成 |
| `scripts/render-terraform-outputs.py` | Terraformのinstance IDとデータプレーン接続先をprivateなローカルenv fileへ出力 |
| `provider-*.json`、`model-*.json`、`auth-strategy-mcp.json`、`mcp-*.json` | 過去のレビュー候補。apply workflowでは使わない |

`kongctl`のexternal stubはTerraform所有instanceを作成、更新、削除しません。Terraform所有のデータプレーン証明書collectionも宣言しないため、`kongctl`の同期対象外です。

## Terraform providerとregion

Terraform moduleはKong公式安定版`kong/konnect` providerの`3.25.0`を固定します。専用AI Gateway instanceとデータプレーン証明書の型付きresource・importを使います。AI Gateway instanceはCRUDできますが、証明書resourceにはupdate操作がないため、証明書の変更は新しいversion keyで作成してから古い証明書を削除するrotation手順を使います。versionを固定し、更新は個別に確認してください。一般的なGateway control plane resourceで代用しないでください。

AI Gatewayの`min_runtime_version`は`2.2`、`runtime_auto_upgrade`は`false`に固定します。最低DP対応versionをComposeの2.2.0と合わせ、fleetの更新に伴う自動上昇を無効にします。versionのAPI形式は`major.minor`なので、ここには`2.2.0`ではなく`2.2`を指定します。DPイメージ自体を自動更新する設定ではありません。

trackedの`terraform.tfvars.example`はUS regionを選びます。`konnect_server_url`と`kongctl --region`を一致させてください。例では`https://us.api.konghq.com`と`--region us`を使います。別のregionを選ぶ場合は両方を同時に変更してください。

Terraform providerはPATを`KONNECT_TOKEN`環境変数から読み込みます。`kongctl`は`KONGCTL_DEFAULT_KONNECT_PAT`環境変数またはdevice login profileを使います。両方ともsecret managerか現在のshell環境から供給してください。PATをprovider block、CLI引数、YAML、repository内のfileへ保存しないでください。

## ローカル入力を用意する

入力fileを作成し、対応する公開データプレーン証明書を`certs/cluster.crt`へ置きます。秘密鍵は`certs/cluster.key`に置きます。Terraformは秘密鍵を読み込みません。

```sh
umask 077
cp -n config/konnect-ai-gateway/terraform/terraform.tfvars.example config/konnect-ai-gateway/terraform/terraform.tfvars.local
```

```sh
chmod 600 config/konnect-ai-gateway/terraform/terraform.tfvars.local
```

次のhelperは3つのinbound Consumer keyを`config/konnect-ai-gateway/.local/runtime-secrets.env`に作成または保持します。keyの値は表示せず、既存fileを上書きしません。Provider keyはsecret managerまたはshell環境の`GEMINI_API_KEY`、`TYPESAFE_AUTHORIZATION_HEADER`から供給します。後者は`Bearer `を含むAuthorization header全体です。

```sh
python3 config/konnect-ai-gateway/scripts/init-local-inbound-keys.py
```

Terraformに必要なPATは選んだsecret managerから`KONNECT_TOKEN`環境変数として供給します。`kongctl`には`KONGCTL_DEFAULT_KONNECT_PAT`を同じ方法で設定するか、事前に`kongctl login`でdevice loginしてください。`--pat`へtokenを渡さないでください。

## Terraform所有resourceをapplyする

Terraform stateには公開証明書の文字列とresource IDが入ります。stateとplanをprivateに保ち、repositoryへcommitしないでください。秘密鍵、Provider key、Consumer keyはTerraform stateに入りません。

```sh
terraform -chdir=config/konnect-ai-gateway/terraform init
```

planを確認してからapplyします。applyはKonnectへ接続し、resourceを作成または更新します。このrepositoryの設定確認では実行しません。

```sh
terraform -chdir=config/konnect-ai-gateway/terraform plan -var-file=terraform.tfvars.local -out=setup.tfplan
```

```sh
terraform -chdir=config/konnect-ai-gateway/terraform apply setup.tfplan
```

公開Terraform outputと固定ローカルapp endpointをrenderします。helperはstate fileを直接読まず、秘密を出力しません。

```sh
terraform -chdir=config/konnect-ai-gateway/terraform output -json | python3 config/konnect-ai-gateway/scripts/render-terraform-outputs.py
```

`config/konnect-ai-gateway/.local/iac-outputs.env`に`AI_GATEWAY_ID`、configurationとtelemetryのhost、ローカル証明書path、Gemini 2.5 Flash route、native Jev `/v1/systemone` route、5つのMCP path、Model alias、timeoutを出力します。live UI承認flagは出力しません。

`kongctl`で使う時は生成された2つのenv fileをloadします。Provider key環境変数とKongctl PATも同じshellまたはsecret managerから供給してください。

```sh
set -a
. config/konnect-ai-gateway/.local/runtime-secrets.env
. config/konnect-ai-gateway/.local/iac-outputs.env
set +a
```

## `kongctl`設定をplanしてapplyする

宣言fileはTerraform outputのAI Gateway IDをexternal referenceとして使います。通常ModelはGemini 2.5 Flash、`openai` formatです。Jev Modelはnative TypeSafe `decisions`で、`typesafe` formatと`/jev/v1/systemone` endpointを維持します。5つのMCP Serverは各1つのread-only detail `GET` toolを公開し、Server ACLとdefault tool ACLの両方でMCP Consumerだけを許可します。

manifestはProviderとConsumer keyをdeferred `!secret` environment sourceから読みます。planとapplyの両方で同じsecret環境変数が使えるようにしてください。plan artifactはignored `.local/`へ保存し、permissionを制限します。artifactにはsecret値でなくdeferred source参照が入りますが、resource設定を含むため共有しないでください。

```sh
mkdir -p -m 700 config/konnect-ai-gateway/.local
```

```sh
umask 077
kongctl plan --mode apply --region us -f config/konnect-ai-gateway/kongctl/ai-gateway.yaml --write-secrets --output-file config/konnect-ai-gateway/.local/kongctl-plan.json
```

planを確認し、AI Gateway instanceまたはデータプレーン証明書の作成・削除が含まれていたら停止します。確認済みplanだけをapplyしてください。

```sh
kongctl apply --region us --plan config/konnect-ai-gateway/.local/kongctl-plan.json
```

`--write-secrets`はこのmanifestが宣言する2つのProvider keyと3つのConsumer keyだけに使います。無関係なmanifestへは付けないでください。

## データプレーン証明書をrotationする

rotationでは、local tfvarsの`data_plane_certificates`へ新しいversion keyを追加してapplyします。新しい証明書と対応する秘密鍵をdata planeへ設定します。data planeが新しい証明書を使用してから、古いmap entryを削除し、再度applyしてください。rendererは初回用の`./certs/cluster.crt`と`./certs/cluster.key`を生成します。rotationで別のpathを使う場合は、render後に`.local/iac-outputs.env`の`KONNECT_DP_CERT_PATH`と`KONNECT_DP_KEY_PATH`を新しい対へ変更し、Composeを再作成してください。renderを再実行すると初回pathに戻るため、切替pathを再確認します。

同じmap keyのcert・title・gateway_id・descriptionを変更すると、providerはreplacementを計画します。`create_before_destroy`は作成を先に行いますが、DPの切替完了までは保証しません。そのため新しいversion keyを追加する段階的なrotationを使い、既存entryを直接置き換えないでください。証明書APIにupdate操作はなく、登録済み証明書を削除すると、その証明書を使うdata planeが切断されます。

## Composeでdata planeとappを起動する

live requestを有効にする場合は、利用者が選んだ範囲で`.env.local`の3つのlive-mode flagを編集します。Composeのdefaultはofflineかつ無効です。起動時に3つのlocal env fileを渡してください。初回は[主手順](../../INSTRUCTIONS.md)でイメージ取得と証明書preflightを先に実行します。`--build`の対象はWeb UIだけで、保険APIは公開GHCRイメージを使います。

```sh
docker compose --env-file .env.local --env-file config/konnect-ai-gateway/.local/runtime-secrets.env --env-file config/konnect-ai-gateway/.local/iac-outputs.env up --build
```

後ろのenv fileは公開Konnect endpointとapp routeを渡します。中央のfileにはローカルinbound Consumer keyだけを保存します。`.env.local`はlive-mode flagを管理します。いずれも表示、commit、共有しないでください。

## 既存instanceをimportする

選んだorganizationとregionに対象のAI Gatewayがすでにある場合、apply前にimportします。目的が重なるinstanceを作ったり、他の利用者のstateを流用したりしないでください。`terraform.tfvars.local`で正確な一致名を設定してからinstance IDをimportします。以下の`AI_GATEWAY_ID`と`CERTIFICATE_ID`は説明用プレースホルダーです。選択した組織・regionに実在するIDへ置き換えてから実行してください。

```sh
terraform -chdir=config/konnect-ai-gateway/terraform import -var-file=terraform.tfvars.local konnect_ai_gateway.insurance AI_GATEWAY_ID
```

既存のデータプレーン証明書はinstance IDとcertificate IDを指定して個別にimportします。

```sh
terraform -chdir=config/konnect-ai-gateway/terraform import -var-file=terraform.tfvars.local 'konnect_ai_gateway_data_plane_certificate.dp["initial"]' '{"gateway_id":"AI_GATEWAY_ID","id":"CERTIFICATE_ID"}'
```

import後にplanを確認してください。replacementまたはdeletionが提案された場合は停止し、apply前にlocal inputとimport stateを整合させます。

## 公式参照

- [Kong Konnect provider: AI Gateway](https://registry.terraform.io/providers/Kong/konnect/3.25.0/docs/resources/ai_gateway)
- [Kong Konnect provider: AI Gateway data plane certificate](https://registry.terraform.io/providers/Kong/konnect/3.25.0/docs/resources/ai_gateway_data_plane_certificate)
- [Kongctl supported resources](https://developer.konghq.com/kongctl/supported-resources/)
- [TypeSafe AI provider](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)
- [AI MCP Server entity](https://developer.konghq.com/ai-gateway/entities/ai-mcp-server/)
- [AI Gateway data plane certificates](https://developer.konghq.com/ai-gateway/entities/ai-data-plane-certificate/)
