# 初回セットアップ・再現手順

この手順は、リポジトリを初めて取得する人向けです。構成図・対応関係・未観測範囲は [architecture資料](resources/architecture/README.md) を参照してください。

`kongctl` はログインと読み取り専用照会に使います。AI GatewayやEntityの作成はKonnect UIまたは現行公式APIで行うため、`kongctl` だけで一括構築する手順ではありません。

自分の組織で許可された環境・操作・費用の範囲で実施し、秘密情報は端末と指定された秘密管理先だけに保管してください。モデル推論やJev判定は外部providerへリクエストし、費用が発生する可能性があります。この手順では実行しません。

> **文書とコードのrefを揃える:** この文書のPRはPR 5 `feat/live-chat-ui-refinement` の上にstackされ、実装と文書の作業refは `docs/japanese-onboarding` です。PR 5が先にmergeされても、文書PRがmergeされるまではこの文書と同じrefを使ってください。両PRが `main` にmergeされた後は `main`（または同じ更新を含むrelease ref）へ切り替えます。merge前のデフォルト `main` には、10ケースUIやこの手順が揃っていない場合があります。

## このデモの現在の境界

- ルートの `compose.yaml` は、Kong AI Gateway 2.2.0 データプレーン、Next.js Web UI、保険API 5サービス（Customer、Product、Application、Claim、Policy）を構成します。Web UIとGatewayのホスト公開ポートはloopbackに限定されます。
- 通常LLMはGateway経由のGemini 2.5 Flash、Jev判定は別経路のnative TypeSafe `decisions`、MCPクライアントはKonnect AI MCP Server経由で保険APIの詳細を取得する設計です。Web UIはlive-onlyで、fixture fallbackやモード切替UIはありません。
- Konnect Control PlaneとそのAI Gateway Entityは外部管理です。既存デモは外部Konnect US環境を使う構成ですが、ComposeはEntityやControl Planeを作成しません。新規利用者は所有者が指定するregionとControl Planeを確認し、過去の所有者固有ID・証明書・キーを流用しないでください。今回の文書作成では新しいControl Planeを作成・登録・接続検証していません。
- `.env.example` は安全な初期値です。Composeの既定値は `DEMO_MODE=offline`、`LIVE_ACCESS_APPROVED=false`、`LIVE_UI_ENABLED=false` です。**offline既定は完全オフライン構成を意味しません。** Gatewayサービス自体は外部Konnect接続を前提とし、`.invalid` 接続先と証明書プレースホルダーでは接続できません。
- この手順は `POST` によるモデル推論・Jev判定を実行しません。

## 必要なツール

- Git
- Docker DesktopまたはDocker Engineと、Docker Compose plugin v2 (`docker compose`)
- OpenSSL（DP用証明書の新規作成時）
- Node.js 22.x とnpm（Webのローカルlint・型検査・テスト用）
- 任意: `kongctl`。この手順のAI Gateway読取コマンド形状は、ローカルで確認した1.13.0を基準にしています。導入は[Kong公式のインストール手順](https://developer.konghq.com/kongctl/)に従ってください（公式ドキュメントの推奨版とこの検証版は異なる場合があります）。別バージョンでは実行前にローカルの `--help` と `explain` で対応範囲を確認してください。

Kubernetesは必要ありません。ComposeのAPIビルドは、別リポジトリ `kong-api-bundle-insurance` のソースを参照します。

## 1. 2つのリポジトリを、対応するrefで取得する

デモrepoはprivateです。作業前にGitHubの `picketfence-labs/ai-gateway-jev-insurance-demo` と `picketfence-labs/kong-api-bundle-insurance` へのアクセス権を用意してください。Gitの認証を設定し、Personal Access TokenをURLやコマンド引数に埋め込まないでください。空のworkspaceを使い、既に同名ディレクトリがないことを確認します。

```sh
WORKSPACE="$HOME/work/ai-gateway-jev-demo"
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"
```

このPRがmergeされる前は、デモrepoを `docs/japanese-onboarding` で取得します。両PRが `main` にmergeされた後は、同じ更新を含む `main` またはrelease refを選びます。文書と実装のrefを混ぜないでください。

```sh
git clone --branch docs/japanese-onboarding https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo.git
git clone https://github.com/picketfence-labs/kong-api-bundle-insurance.git
```

Composeが想定する保険APIソースを固定します。APIリポジトリを作業中の場合は、先にその変更を保存してからcheckoutしてください。

```sh
git -C "$WORKSPACE/kong-api-bundle-insurance" checkout ab96eea303e27fe02d98344a31bc7633753da77e
```

デモrepoへ移動します。

```sh
cd "$WORKSPACE/ai-gateway-jev-insurance-demo"
```

Composeは兄弟repo `../kong-api-bundle-insurance` をAPIのbuild contextとして読みます。UIのDockerfileは `docker/Dockerfile.ui`、APIのDockerfileはAPI contextから見て `../ai-gateway-jev-insurance-demo/docker/Dockerfile.api` です。Dockerfile専用ignoreファイルも `docker/` にあります。

## 2. ローカルツールを確認する

リポジトリルートで実行します。NodeのバージョンはDockerfileのビルド基準に合わせて22.xを使用してください。

```bash
docker --version
```

```bash
docker compose version
```

出力がCompose v2であることを確認してください。

```bash
openssl version
```

```bash
node --version
```

```bash
npm --version
```

Konnectを照会する場合は、あなたのアカウントに割り当てられた読み取り権限を使います。`kongctl version` と `--help` はローカルCLIの確認であり、Konnect APIを呼び出しません。

```bash
kongctl version
```

```bash
kongctl get ai-gateway --help
```

```bash
kongctl get ai-gateway models --help
```

```bash
kongctl get ai-gateway model-providers --help
```

```bash
kongctl get ai-gateway mcp-servers --help
```

```bash
kongctl explain ai_gateway_model_provider --output yaml
```

```bash
kongctl apply --help
```

`kongctl 1.13.0` の読取コマンド名は `models`、`model-providers`、`mcp-servers` です。ここではローカルhelp/schemaを確認します。実際の認証・Entity照会は、手順3でGateway IDとregionを取得し、手順4でEntityを作成した後に実施してください。読み取り専用queryの具体的な順番は手順4の末尾にあります。

`identity-providers` はCLIの別リソースであり、AI Auth Strategyの代用ではありません。`kongctl 1.13.0` にはAI Auth Strategyを直接照会する `get` コマンドが見当たりません。AI Auth StrategyやTypeSafe Providerの設定にはKonnect UIまたは、適用時点の公式APIスキーマに沿った手順を使ってください。ローカルの `explain ai_gateway_model_provider` スキーマでは `typesafe` が確認できないため、このCLIでTypeSafeの宣言設定が検証できるとは扱いません。

`config/konnect-ai-gateway/*.json` はレビュー用のAPI request-body候補であり、`kongctl apply -f` 用の宣言リポジトリではありません。これらのJSONを `kongctl apply` に渡さないでください。`scripts/konnect-mcp-apply.py` は既存所有者のGateway ID・接続先に固定された履歴用スクリプトで、新しい利用者のセットアップには使えません。

## 3. KonnectにAI Gateway instanceとdata plane接続を用意する

このデモはKonnectのAI Gateway 2.2 instanceを使います。これはKong Gatewayの一般的なControl PlaneやWorkspaceとは別のAI Gateway管理instanceです。Kubernetesは不要です。Composeはdata planeを起動しますが、Konnectのinstance、証明書、モデル、MCP Serverを作成しません。instance作成には対象Organizationの管理権限が必要です。今回の作業では新しいinstanceやdata plane接続を作成・検証していません。

1. Konnectへログインし、サイドバーで **AI Gateway** を開いて **New AI Gateway** を選びます。
2. あなたのOrganization、許可されたregion、他と重複しないnameを指定して作成します。既存のGateway IDやowner固有のregionを流用しません。
3. 新しいAI GatewayのIDとregionを記録します。Konnect UIのdata plane接続手順から、Control Plane endpoint、Control Plane SNI、Telemetry endpoint、Telemetry SNIを取得します。Composeの値はregionごとに異なります。`us.api.konghq.com` などKonnect APIのURLをdata plane endpointとして転用したり、endpoint/SNIを推測したりしないでください。
4. repo rootにdata plane用のクライアント証明書と秘密鍵を作成します。秘密鍵はこの端末とdata planeだけに置き、Gitへ追加しません。

```sh
umask 077
mkdir -p certs
if [ -e certs/cluster.key ] || [ -e certs/cluster.crt ]; then
  printf '%s\n' 'certs/cluster.key または certs/cluster.crt が既にあります。上書きせず、所有者に確認してください。' >&2
  exit 1
fi
openssl req -new -x509 -nodes -newkey rsa:2048 \
  -keyout certs/cluster.key \
  -out certs/cluster.crt \
  -days 365 \
  -subj "/CN=insurance-demo-dp"
chmod 600 certs/cluster.key
```

5. KonnectのAI Gateway instanceで **Data Plane Certificates** を開き、`certs/cluster.crt` の公開証明書だけを登録します。`cluster.key` はアップロードしません。新規作成時に表示されたControl PlaneとTelemetryの接続値を `.env.local` に対応付けます。

| `.env.local` property | Konnectから取得する値 |
| --- | --- |
| `KONNECT_CP_HOST` | Control Plane endpointのhostとport（通常は `host:443` 形式） |
| `KONNECT_CP_SERVER_NAME` | Control Plane接続に使うSNI |
| `KONNECT_TELEMETRY_HOST` | Telemetry endpointのhostとport（通常は `host:443` 形式） |
| `KONNECT_TELEMETRY_SERVER_NAME` | Telemetry接続に使うSNI |
| `KONNECT_DP_CERT_PATH` | repo rootから証明書へのローカルpath。既定は `./certs/cluster.crt` |
| `KONNECT_DP_KEY_PATH` | repo rootから秘密鍵へのローカルpath。既定は `./certs/cluster.key` |

この構成では、Konnectには公開証明書を登録し、秘密鍵をdata plane側に保持します。DP接続値と証明書の不一致は接続失敗になります。`certs/` の値をログ、issue、チャットへ貼らないでください。証明書とendpointの役割は[AI Data Plane Certificates](https://developer.konghq.com/ai-gateway/entities/ai-data-plane-certificate/)と[Data Plane reference](https://developer.konghq.com/gateway/data-plane-reference/)を参照してください。

## 4. KonnectにProvider、Model、認証、MCP Serverを作成する

Konnect UIで、今作ったAI Gateway instanceを開きます。初回のEntity作成は **AI Gateway > 対象instance > 各Entity** で行ってください。`kongctl` は認証と読み取り専用照会の補助に限り、ここでのEntity作成はKonnect UIまたは現行公式APIを使います。リポジトリ内のJSONはレビュー用request-body候補で、`kongctl apply -f` 向けの宣言bundleではありません。JSONをまとめてapplyしたり、既存owner用scriptを実行したりしないでください。

必要なProvider API keyと受信者用API keyはあなたの組織で発行し、秘密管理ツールへ保存してください。Gemini/TypeSafeのoutbound keyと、アプリからGatewayへ送るinbound AI Consumer credentialは異なる認証情報です。

次の順で設定してください。先に認証StrategyとConsumersを作り、ModelとMCP Serverを作成するときに参照します。

### AI Auth StrategyとAI Consumer credentials

AI Auth StrategyはアプリからGatewayへ入る認証、AI Model ProviderはGatewayからGemini/TypeSafeへ出る認証を扱います。次の2つの `key-auth` Strategyを作成します。

| 用途 | 設定 |
| --- | --- |
| 通常ModelとJev Model | header name `apikey`、header認証のみ、query/body認証off、credential hiding on |
| 5つのAI MCP Server | header name `apikey`、header認証のみ、query/body認証off、credential hiding on |

1. **Auth Strategies > New auth strategy** でそれぞれStrategyを作り、名前を記録します。通常ModelとJev Modelには通常/Jev用Strategyを割り当て、5つのAI MCP ServerにはMCP用Strategyを割り当てます。
2. **Consumers > New consumer** で、通常Model、Jev Model、MCPクライアントを区別するAI Consumerを `api-key` typeで作ります。
3. 各AI ConsumerでAPI key credentialを生成し、一度だけ表示されるkeyを安全なpassword managerへ保存します。3種類のcredentialを混ぜず、`.env.local` の `AI_GATEWAY_API_KEY`、`AI_GATEWAY_JEV_API_KEY`、`MCP_API_KEY` に個別に対応付けます。3種類のinbound keyは `apikey` headerに送ります。Consumerごとの認証・credential作成手順は[AI Consumer entity](https://developer.konghq.com/ai-gateway/entities/ai-consumer/)を参照してください。

### Gemini 2.5 Flashの通常Model

1. **Providers > New Provider** でGemini Providerを作ります。Provider typeは `gemini`、認証方式はbasic header、header nameは `x-goog-api-key`、valueはあなたが取得したGemini API keyです。秘密値はKonnect UIのsecret fieldへ入力し、文書、Git、`.env.local` には保存しません。
2. **Models > New model** で有効なModelを作ります。`type` は `model`、nameとmodel aliasは `insurance-normal`、capabilityは `generate`、formatは `openai`、Base pathは `/v1/insurance-normal` とします。request bodyの `model` fieldでtargetを選ぶ設定を使い、その値を `insurance-normal` にします。
3. TargetとしてGemini Providerを選び、target modelを `gemini-2.5-flash`、target typeを `gemini` にします。通常経路にOpenAI targetを追加しません。
4. ModelのInbound accessに通常/Jev用 `key-auth` AI Auth Strategyを割り当て、payload loggingをoffにします。Balancerを `round-robin`、retriesを `0` にし、複数Providerへのfailoverを設定しません。`AI_GATEWAY_BASE_URL`、`AI_GATEWAY_MODEL` とroute/aliasを一致させます。

AI Model Providerのoutbound認証とAI Modelのroute/capabilityは[Kong Gemini provider](https://developer.konghq.com/ai-gateway/ai-providers/gemini/)と[AI Model entity](https://developer.konghq.com/ai-gateway/entities/ai-model/)を参照してください。

### Native TypeSafe decisions Model

1. **Providers > New Provider** でTypeSafe Providerを作ります。typeは `typesafe`、Authorization headerは `Bearer <あなたのTypeSafe API key>` です。Google Gemini provider keyやinbound Consumer keyをここへ入れないでください。
2. **Models > New model** で有効なModelを作ります。`type` は `model`、nameは `insurance-jev-decisions`、capabilityは `decisions`、formatは `typesafe`、Base pathは `/jev` にします。Target modelは `jev-latest`、ProviderはあなたのTypeSafe Provider、target typeは `typesafe` にします。
3. ModelのInbound accessに通常/Jev用 `key-auth` AI Auth Strategyを割り当て、payload loggingをoffにします。Balancerを `round-robin`、retriesを `0` にし、failoverを設定しません。AI GatewayはBase pathの後ろにnative `/v1/systemone` を付けるため、`.env.local` のJev URLは `http://ai-gateway:8000/jev/v1/systemone` です。Chat Completionsへ変換しません。

TypeSafeの `decisions` capabilityと `formats: [{type: typesafe}]` はAI Gateway 2.2以降の機能です。ローカルCLI 1.13.0のprovider schemaでは `typesafe` を確認できなかったため、Konnect UIまたは適用時点の公式API schemaを使います。具体的なrouteとpayloadは[TypeSafe AI provider](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)を参照してください。

### 5つのAI MCP Server

REST APIコンテナを起動するだけではMCP endpointはできません。各API用に `conversion-listener` AI MCP Serverを1つずつ作成し、MCP用Strategyを割り当てます。`config.url` はCompose network内のAPI service名、`route.paths` とTool pathは以下のprefixで統一します。route prefixはGatewayが除去してからUpstreamへ転送します。

| Entity | Tool name | `config.url` | `route.paths` | Read-only Tool path |
| --- | --- | --- | --- | --- |
| Customer | `get_customer_customers__customer_id__get` | `http://customer-api:8000` | `/mcp/customer` | `/mcp/customer/customers/{customer_id}` |
| Product | `get_product_products__product_id__get` | `http://product-api:8000` | `/mcp/product` | `/mcp/product/products/{product_id}` |
| Application | `get_application_applications__application_id__get` | `http://application-api:8000` | `/mcp/application` | `/mcp/application/applications/{application_id}` |
| Claim | `get_claim_claims__claim_id__get` | `http://claim-api:8000` | `/mcp/claim` | `/mcp/claim/claims/{claim_id}` |
| Policy | `get_policy_policies__policy_id__get` | `http://policy-api:8000` | `/mcp/policy` | `/mcp/policy/policies/{policy_id}` |

各Serverで `type: conversion-listener`、enabled、MCP用AI Auth Strategyを設定します。payload loggingはoffにします。各Serverで1つのGET Toolを設定し、path parameterをrequired stringとして定義します。Tool名はrepo内の対応JSONと同じにして、アプリからのTool selectionが一致するようにします。`access.acl_attribute_type: consumer` を設定し、`access.acls.allow` と `access.default_tool_acls.allow` の両方にあなたのMCP用AI ConsumerのnameまたはIDを指定します。`access.default_tool_acls.deny` は空配列にします。これによりMCP ConsumerだけをServerとそのToolで許可します。Toolごとの個別ACLは追加しません。ACLとStrategyを混同しないでください。Strategyがidentityを解決し、ACLが認可します。Tool annotationはAI Gateway 2.2 schemaで受け付けられない場合があるため追加しません。MCP mapping例は[Map a RESTful API to MCP tools](https://developer.konghq.com/ai-gateway/map-api-to-mcp-tools/)を参照してください。

`config/konnect-ai-gateway/mcp-*.json` はTool名・route・API pathを確認する候補です。request bodyは対象のAPI bundleと2.2 schemaに合わせてUIで確認し、`enabled`、AI Auth Strategy参照、ACL discriminator、Consumer allowlistを実際の利用者に合わせて設定します。AI MCP ServerがAI Gateway 2.xで管理されるEntityである点については[AI MCP Server entity](https://developer.konghq.com/ai-gateway/entities/ai-mcp-server/)を参照してください。

作成したEntityを読み取り専用で確認する場合は、手順3で取得したあなた自身のregionとGateway IDを使います。Personal Access Tokenをコマンド引数へ渡さず、browser device loginを使います。

```bash
export KONNECT_REGION='YOUR_REGION'
export AI_GATEWAY_ID='YOUR_AI_GATEWAY_ID'
```

```bash
kongctl login --profile insurance-demo --no-telemetry
```

表示された手順でブラウザー認証を完了し、profileへ保存された認証情報を使います。次の `get` は読み取り専用ですが、結果にはリソース情報が含まれ得るため、出力はローカルで慎重に扱ってください。

```bash
kongctl get ai-gateway models --profile insurance-demo --region "$KONNECT_REGION" --gateway-id "$AI_GATEWAY_ID" --no-telemetry --output json
```

```bash
kongctl get ai-gateway model-providers --profile insurance-demo --region "$KONNECT_REGION" --gateway-id "$AI_GATEWAY_ID" --no-telemetry --output json
```

```bash
kongctl get ai-gateway mcp-servers --profile insurance-demo --region "$KONNECT_REGION" --gateway-id "$AI_GATEWAY_ID" --no-telemetry --output json
```

`identity-providers` は別のKonnect resourceで、AI Auth Strategyの代用ではありません。`kongctl 1.13.0` ではAI Auth Strategyを直接照会する `get` コマンドが見当たらず、TypeSafe schemaもローカルschemaで確認できません。Konnect UIまたは適用時点の公式API schemaを参照してください。`scripts/konnect-mcp-apply.py` は既存ownerのGateway IDとregionに固定した履歴helperです。新規環境で実行してはいけません。

## 5. 安全なローカル設定を作る

`.env.example` は安全なテンプレートです。既存の `.env.local` を上書きしないよう、リポジトリルートで新しいファイルがない場合だけ作成します。

```bash
cp -n .env.example .env.local
```

秘密を含み得るため、ファイルの権限を自分だけに限定します。

```bash
chmod 600 .env.local
```

`.env.local` はGit管理外です。テキストエディターで開き、Konnectから取得したあなたの接続値と、あなたが作成したEntity/credentialに対応する値だけを入力してください。秘密値を端末へ表示したり、Gitへ追加したり、第三者へ貼り付けたりしないでください。既存のローカル設定がある場合はコピーし直さず、既存値を保ったまま必要な項目だけ更新してください。

以下のrouteとaliasは、手順4で同じ値を使ってEntityを作成した場合の設定です。別名を選んだ場合は、Konnect Model route、request body alias、MCP endpointと`.env.local`を一致させます。

| `.env.local` property | 設定値 |
| --- | --- |
| `KONNECT_CP_HOST` / `KONNECT_CP_SERVER_NAME` | AI Gatewayのdata plane接続手順から取得したControl Plane endpointとSNI |
| `KONNECT_TELEMETRY_HOST` / `KONNECT_TELEMETRY_SERVER_NAME` | 同じ接続手順から取得したTelemetry endpointとSNI |
| `KONNECT_DP_CERT_PATH` / `KONNECT_DP_KEY_PATH` | 登録済み公開証明書と対になるローカル証明書/鍵path。秘密鍵はローカルのみ |
| `AI_GATEWAY_BASE_URL` | `http://ai-gateway:8000/v1/insurance-normal` |
| `AI_GATEWAY_API_KEY` | 通常Model用AI Consumer credential。`apikey` headerに使う |
| `AI_GATEWAY_MODEL` | `insurance-normal` |
| `AI_GATEWAY_TIMEOUT_MS` | `20000`。必須の正の整数、単位はms |
| `AI_GATEWAY_JEV_URL` | `http://ai-gateway:8000/jev/v1/systemone` |
| `AI_GATEWAY_JEV_API_KEY` | Jev Model用AI Consumer credential。`apikey` headerに使う |
| `AI_GATEWAY_JEV_MODEL` | `insurance-jev-decisions` |
| `AI_GATEWAY_JEV_TIMEOUT_MS` | `10000`。必須の正の整数、単位はms |
| `MCP_CUSTOMER_URL` | `http://ai-gateway:8000/mcp/customer` |
| `MCP_PRODUCT_URL` | `http://ai-gateway:8000/mcp/product` |
| `MCP_APPLICATION_URL` | `http://ai-gateway:8000/mcp/application` |
| `MCP_CLAIM_URL` | `http://ai-gateway:8000/mcp/claim` |
| `MCP_POLICY_URL` | `http://ai-gateway:8000/mcp/policy` |
| `MCP_API_KEY` | MCP用AI Consumer credential。5つのAI MCP Serverへ送る `apikey` headerに使う |
| `MCP_TIMEOUT_MS` | `5000`。必須の正の整数、単位はms |
| `DEMO_MODE` | live UIを使う場合は `live`。通常の初期値は `offline` |
| `LIVE_ACCESS_APPROVED` | live UIを使う場合は `true`。通常の初期値は `false` |
| `LIVE_UI_ENABLED` | live UIを使う場合は `true`。通常の初期値は `false` |

通常/Jev/MCPのcredentialを区別し、providerのoutbound keyと混ぜたり、同じキーを使い回したりしないでください。Gemini/TypeSafe provider secretはKonnect上で保護し、`.env.local`へ置きません。`.env.example` の `.invalid` host、`REPLACE_WITH...`、route名、aliasは接続可能な値ではありません。`model-normal.json` はGemini 3.5 FlashとOpenAIを含む無効化された静的候補であり、OpenAIはこのデモの通常経路ではありません。通常経路はGemini 2.5 Flashです。

`AI_GATEWAY_TIMEOUT_MS`、`AI_GATEWAY_JEV_TIMEOUT_MS`、`MCP_TIMEOUT_MS` は現在のアプリ実装で必須です。`.env.example` をコピーした後、空欄を上表の正の整数で埋めてください。これらは個々のprovider/MCP呼出しのtimeout値で、全体処理のdeadlineや費用上限を示す値ではありません。

live UIを使う場合は、組織で許可された範囲で `.env.local` の3つのflagを `DEMO_MODE=live`、`LIVE_ACCESS_APPROVED=true`、`LIVE_UI_ENABLED=true` にします。これらのflagは権限や費用承認を与えるものではありません。`.env.example` とComposeの既定値はoffline/falseのままです。起動時は必ず `--env-file .env.local` を指定してください。明示的にenv fileを指定しないとlive設定は有効になりません。

## 6. Compose設定を静的に確認してイメージをbuildする

以下の静的検査は `.env.example` だけを使い、展開後の設定値を出力しません。`docker compose config` の引数に `--quiet` を付けずに実行しないでください。展開結果に接続先や秘密値が含まれる場合があります。

```bash
docker compose --env-file .env.example config --quiet
```

この検査はYAML・変数参照などのCompose構文確認であり、Konnect接続・Entity存在・証明書有効性を証明しません。

```bash
docker compose --env-file .env.example build
```

このbuildはWebと5つの保険APIイメージを構築しますが、コンテナは起動せず、推論リクエストも送信しません。`.env.local` の秘密値はビルド引数やDockerfileへ追加しないでください。

Webのローカル静的チェックを実行する場合:

```bash
npm ci --legacy-peer-deps --no-audit --no-fund
```

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

## 7. 接続状態を確認して起動し、GETとUIを確認する

起動前に、Konnect UIで対象AI Gateway instanceのData Plane一覧を開き、あなたのDPが接続済みで、runtime versionが2.2.0であることを確認します。通常/Jev Modelと5つのAI MCP Serverが有効で、Model route/alias、MCP route、Strategy、Consumer ACLが `.env.local` と同じ値かも確認してください。`.env.local` の接続値と証明書パスは、Konnectから取得した設定と照合します。プレースホルダーのまま起動しても、正常なデモにはなりません。起動時のGateway `kong health` はプロセス稼働確認のみで、Konnect登録や外部疎通の証明ではありません。

```bash
docker compose --env-file .env.local up -d
```

```bash
docker compose --env-file .env.local ps
```

WebのrootへGETし、HTTP statusだけを表示します。

```bash
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:3000/
```

live readiness endpointもGETできます。応答はローカル設定のreadiness情報であり、Konnectの接続品質やモデル応答の証明ではありません。`docker compose ps` がhealthyでもモデル/Tool呼出しを証明しません。この手順ではPOSTを送らないため、実応答成功を確認したとは扱いません。結果をそのまま公開しないでください。

```bash
curl --silent --show-error http://127.0.0.1:3000/api/live/readiness
```

ブラウザーで `http://127.0.0.1:3000` を開きます。画面の送信ボタンはモデル呼出しを開始し、費用が発生する可能性があります。この手順ではチャットを送信しません。会話試験を行う場合は、組織で許可された範囲と費用を確認してから実施してください。

## 8. 停止・再開

Composeサービスを停止しても、設定やローカルファイルは削除しません。

```bash
docker compose --env-file .env.local stop
```

```bash
docker compose --env-file .env.local start
```

```bash
docker compose --env-file .env.local restart
```

設定変更をコンテナへ反映する場合は、停止・再作成が起きるため、利用中の環境への影響を確認してから実行してください。環境変数変更後も `restart` だけではコンテナに新しい値が反映されない場合があります。

## トラブルシューティング

- **ComposeがAPI Dockerfileまたは `requirements.txt` を見つけない:** 2つのリポジトリが兄弟ディレクトリであること、API repoが指定commitにあることを確認します。
- **`cluster.crt` / `cluster.key` のbind mountエラー:** 所有者から証明書が提供され、`.env.local` のパスが実在するローカルファイルを指すまで起動しません。証明書をGitへ追加しないでください。
- **`.invalid` endpointで接続できない:** 意図的なテンプレート値です。正しいhost/SNIはControl Plane所有者から受け取ってください。
- **Webのreadinessがfalse / UI送信が無効:** offline/falseが既定です。所有者の明示許可、liveフラグ、実Gateway route、認証値が揃っているかをローカルで確認します。fixture fallbackはありません。
- **Gatewayが `healthy` でもKonnectが利用できない:** healthcheckは `kong health` のみです。ローカルで `docker compose --env-file .env.local ps` を確認し、Control Plane/TLSを所有者と確認してください。
- **port bindに失敗する:** 既定はWeb `127.0.0.1:3000`、Gateway `127.0.0.1:8000` です。利用ポートが重複する場合は、所有者と相談して `.env.local` のhost portを変更します。
- **診断ログを見る必要がある:** `docker compose --env-file .env.local logs --tail=100 web ai-gateway` をローカルで確認します。ログには会話内容、providerメタデータ、識別子が含まれる可能性があります。raw logや設定展開結果をissue・チャットへ貼り付けないでください。

## 参照と検証限界

- [Compose topology](compose.yaml)
- [Konnect Entity候補とCLIスキーマ差](config/konnect-ai-gateway/README.md)
- [構成図](resources/architecture/architecture.png)と[ソース対応表](resources/architecture/README.md)
- [Kong AI Gateway 2.x concepts](https://developer.konghq.com/ai-gateway/ai-gateway-v2-concepts/)
- [Kong AI MCP Server entities](https://developer.konghq.com/ai-gateway/entities/ai-mcp-server/)
- [Kong AI Auth Strategy entities](https://developer.konghq.com/ai-gateway/entities/ai-auth-strategy/)

この文書作成ではKonnect Entityのcreate/update、AI Gateway instanceの新規作成、data planeの接続、モデル推論、MCP Tool実行を行っていません。構成候補と実際のgenerated Plugin instanceを混同しないでください。個別routeのPlugin instanceやhandler traceは未観測です。
