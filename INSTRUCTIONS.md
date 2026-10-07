# 初回セットアップ

この手順は、あなたのKonnect環境にデモを構築するためのものです。**TerraformでAI Gateway instanceとデータプレーン証明書を作り、kongctlでモデル・認証・MCP設定を適用します。** 保険APIは公開GHCRイメージを取得し、UIだけをこのリポジトリからビルドします。Kubernetesや保険APIのソースリポジトリは不要です。

自分または組織が利用を許可した環境で実施してください。Konnectへのリソース作成、モデル・Jevへの送信には費用が発生する場合があります。合成データだけを使用し、秘密、Terraform state、kongctl planをGitやチャットへ貼り付けないでください。

## 必要なもの

- このprivateリポジトリへのGitHubアクセス権とGit認証（PATをclone URLへ埋め込まない）
- Konnect OrganizationでAI Gatewayを管理できるPersonal Access Token
- Gemini API keyとTypeSafe API key。これらは上流認証用で、アプリからGatewayへ送るキーとは異なります。
- Git、Docker Compose v2、OpenSSL、Python 3、Terraform 1.15.1
- **kongctl 1.20.2に固定**。このリポジトリで必要とする版・この手順の検査版は1.20.2です。新しい版へ変更する場合はschemaと手順を再確認してください。[公式リリース](https://github.com/Kong/kongctl/releases/tag/v1.20.2)からOS・CPUに合ったバイナリを取得し、[公式導入手順](https://developer.konghq.com/kongctl/)に沿ってPATHへ配置してください。既存の古いCLIとは別の配置先を使えます。
- 任意: Node.js 22.xとnpm（UIのローカル開発・検証用）

Terraformは公式安定版の **`kong/konnect` 3.25.0** に固定し、専用AI Gateway resourceを使います。一般Gateway Control Planeには置き換えません。CPの最低DP対応versionは`2.2`、自動上昇は無効に固定し、Composeの2.2.0と揃えます。保険APIイメージはlinux/amd64です。Apple SiliconではDockerのamd64エミュレーションが必要です。

## 1. リポジトリを取得する

```sh
WORKSPACE="$HOME/work/ai-gateway-jev-demo"
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"
git clone --branch main https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo.git
cd ai-gateway-jev-insurance-demo
```

以降はリポジトリルートで実行します。全体の起動入口は`compose.yaml`、アプリのコード・npm設定は`app/`にあります。

```sh
docker compose version
terraform version
kongctl version
openssl version
python3 --version
```

## 2. ローカル入力と証明書を用意する

端末上の秘密管理ツールから次の環境変数を供給します。秘密値をコマンド引数やシェル履歴へ直接記述しないでください。

| 環境変数 | 用途 |
| --- | --- |
| `KONNECT_TOKEN` | TerraformのKonnect認証 |
| `KONGCTL_DEFAULT_KONNECT_PAT` | kongctlのKonnect認証。同じPATを使う場合は下の代入で引き継ぎます。 |
| `GEMINI_API_KEY` | Gemini Providerの上流認証 |
| `TYPESAFE_API_KEY` | TypeSafe Providerの上流認証 |

```sh
set -eu
: "${KONNECT_TOKEN:?Konnect PATを秘密管理ツールから供給してください}"
: "${GEMINI_API_KEY:?Gemini API keyを供給してください}"
: "${TYPESAFE_API_KEY:?TypeSafe API keyを供給してください}"
export KONNECT_TOKEN GEMINI_API_KEY TYPESAFE_API_KEY
export KONGCTL_DEFAULT_KONNECT_PAT="${KONGCTL_DEFAULT_KONNECT_PAT:-$KONNECT_TOKEN}"
export TYPESAFE_AUTHORIZATION_HEADER="Bearer $TYPESAFE_API_KEY"
umask 077
mkdir -p certs
```

新しい作業ディレクトリで、公開証明書と秘密鍵を作成します。既存ファイルがある場合は上書きせず、現在使っている対を維持してください。

```sh
if [ ! -e certs/cluster.key ] && [ ! -e certs/cluster.crt ]; then
  openssl req -new -x509 -nodes -newkey rsa:2048     -keyout certs/cluster.key -out certs/cluster.crt     -days 365 -subj '/CN=insurance-demo-dp'
elif [ ! -f certs/cluster.key ] || [ ! -f certs/cluster.crt ]; then
  printf '%s\n' '証明書と秘密鍵の片方だけがあります。対を揃えてから再実行してください。' >&2
  exit 1
fi
chmod 600 certs/cluster.key
python3 config/konnect-ai-gateway/scripts/init-local-inbound-keys.py
```

このhelperは通常Model、Jev、MCP用の3つの受信キーをローカル生成します。再実行で既存キーを変更しません。公開証明書だけをTerraformへ渡し、秘密鍵・上流キー・受信キーはTerraform stateへ入れません。

## 3. TerraformでKonnectを構築する

```sh
cp -n config/konnect-ai-gateway/terraform/terraform.tfvars.example \
  config/konnect-ai-gateway/terraform/terraform.tfvars.local
chmod 600 config/konnect-ai-gateway/terraform/terraform.tfvars.local
```

このファイルをエディターで開き、AI Gatewayの一意なname・表示名を設定します。例はUS region（`https://us.api.konghq.com`）です。regionを変更するときは、次のkongctlコマンドの`--region us`をすべて同じregionへ変更してください。公開証明書pathはこのリポジトリの`certs/cluster.crt`を指します。

```sh
terraform -chdir=config/konnect-ai-gateway/terraform init
terraform -chdir=config/konnect-ai-gateway/terraform plan \
  -var-file=terraform.tfvars.local -out=setup.tfplan
terraform -chdir=config/konnect-ai-gateway/terraform apply setup.tfplan
terraform -chdir=config/konnect-ai-gateway/terraform output -json | \
  python3 config/konnect-ai-gateway/scripts/render-terraform-outputs.py
```

`plan`の対象が新しいAI Gateway instanceと公開DP証明書だけであることをローカルで確認してからapplyします。接続ID・CP/Telemetry接続先はoutputからローカルenv fileへ自動生成され、手で転記する必要はありません。stateとplanはGit管理外です。

## 4. kongctlでAI Gateway設定を適用する

まず、生成したIDと受信キーをこのshellへ読み込みます。上流の2キーも手順2で供給したままにします。

```sh
set -a
. config/konnect-ai-gateway/.local/runtime-secrets.env
. config/konnect-ai-gateway/.local/iac-outputs.env
set +a
kongctl plan --mode apply --region us \
  -f config/konnect-ai-gateway/kongctl/ai-gateway.yaml --write-secrets \
  --output-file config/konnect-ai-gateway/.local/kongctl-plan.json
chmod 600 config/konnect-ai-gateway/.local/kongctl-plan.json
```

planをローカルで確認します。新しいProvider・Model・認証・Consumer・MCP Serverが対象で、Terraformが管理するinstanceやDP証明書の作成・削除が含まれないことを確認してから適用します。

```sh
kongctl apply --region us --plan config/konnect-ai-gateway/.local/kongctl-plan.json
```

`--write-secrets`は設定に指定した上流キーと3つの受信キーを書き込みます。secretの環境変数はplanとapplyの両方で利用可能にしてください。plan、ログ、設定を第三者へ送らないでください。

宣言設定には、Gemini 2.5 Flashの通常Model、native TypeSafe `decisions`のJev Model、2つのkey-auth Strategy、3つのConsumer credential、5つの読み取り専用MCP Serverが含まれます。Terraformが管理するinstanceと証明書をkongctlで作り直しません。MCPはCustomer、Product、Application、Policy、Claimの詳細GETだけを公開します。設定の対応関係は[構築設定](config/konnect-ai-gateway/README.md)を参照してください。

## 5. 保険APIを取得し、UIをビルドする

安全なひな形をコピーして、自分だけが読める権限にします。

```sh
cp -n .env.example .env.local
chmod 600 .env.local
```

`.env.local`をエディターで開き、ライブUIに必要な3行を`DEMO_MODE=live`、`LIVE_ACCESS_APPROVED=true`、`LIVE_UI_ENABLED=true`へ変更します。これらのflagは通信の有効化設定であり、権限や費用上限を付与しません。通常/Jev/MCPのキー、URL、model、timeout、DP接続先は以下の追加env fileから供給します。後のenv fileが優先されます。

同じshellで使う短いComposeコマンドを定義します。新しいshellでは、この定義を再実行してください。

```sh
demo() {
  docker compose --env-file .env.local \
    --env-file config/konnect-ai-gateway/.local/runtime-secrets.env \
    --env-file config/konnect-ai-gateway/.local/iac-outputs.env "$@"
}
```

次の検査は展開した秘密を出力しません。`docker compose config`には必ず`--quiet`を付けます。

```sh
demo config --quiet
demo pull product-api customer-api application-api policy-api claim-api ai-gateway
demo run --rm --no-deps --entrypoint sh ai-gateway -c \
  'test -r /etc/kong/certs/cluster.crt && test -r /etc/kong/certs/cluster.key'
demo build web
```

証明書preflightは一時コンテナのshellで公開証明書と秘密鍵の読取可否だけを確認します。内容の出力、Kong本プロセスの起動、Konnectへの接続は行いません。失敗したら次の起動へ進まず、下の権限確認を行います。

`pull`は既成の保険API 5イメージとGatewayを取得します。`build web`は`app/`のUIをビルドします。保険APIの独自ビルドは行いません。公開イメージのversion・digest・合成データの対応は[イメージ固定情報](config/insurance-images.lock.json)を参照してください。

## 6. 起動とGET確認

```sh
demo up -d
demo ps
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:3000/
curl --silent --show-error http://127.0.0.1:3000/api/live/readiness
```

Web rootの期待HTTP statusは200、readinessの期待値は`ready: true`です。readinessはローカルの必要設定が揃ったことを示し、上流の応答品質やKonnect接続成功を証明しません。Gatewayの`healthy`もプロセスの稼働確認です。

ブラウザーで`http://127.0.0.1:3000`を開きます。操作は[Chat UI.md](Chat%20UI.md)、10ケースの入力例は[TEST.md](TEST.md)を参照してください。**送信すると実モデル・MCP・Jevを呼び出します。** 費用を確認し、合成ケースだけで試してください。GET確認は推論を実行しません。

## 停止・再開

```sh
demo stop
demo start
```

環境設定を変更した場合は`up -d`でコンテナを再作成します。`restart`だけでは新しい環境変数が反映されません。Composeの停止ではKonnectのリソースは削除されません。Terraform destroyやkongctl syncを日常の停止手順には使いません。

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| kongctlでTypeSafeやAI Auth Strategyのschema error | `kongctl version`が検査版1.20.2か。古いCLIで宣言設定を適用しない。 |
| Terraformの認証・権限エラー | `KONNECT_TOKEN`、region API、OrganizationのAI Gateway管理権限。PATを画面やログへ出さない。 |
| GHCR pullでplatform error | linux/amd64を実行できるDocker環境か。Apple Siliconのエミュレーション設定。 |
| 証明書bind mountエラー | 証明書と秘密鍵が対で存在し、生成した接続ファイルのpathがリポジトリルートの証明書・鍵を指しているか。 |
| readinessがfalse、送信が無効 | 生成した全env fileをComposeに渡したか。通常/Jev/MCPの3キー、route、timeout、live flagsが揃っているか。fixture fallbackはない。 |
| Gateway healthyでも通信できない | Terraformの接続先と登録公開証明書、kongctlの適用完了、DNS/TLS/外部通信をローカルで確認する。 |
| port bind失敗 | loopbackの3000/8000が空いているか。必要ならローカル設定のhost portを変更する。 |

### Linuxで証明書preflightが失敗する場合

Docker EngineではホストとコンテナのUID差により、0600のファイルをDP userが読めない場合があります。ファイルが実在することを確認したうえで、ACL対応filesystemと`setfacl`（Linuxの`acl`ツール）が使える環境だけ、イメージの実行UIDへread ACLを追加します。UIDは固定せずイメージから取得します。Docker Desktopでpreflightが成功する場合、この操作は不要です。

```sh
command -v setfacl
DP_UID=$(docker run --rm --network none --entrypoint id kong/kong-ai-gateway:2.2.0 -u)
setfacl -m "u:${DP_UID}:r" certs/cluster.crt certs/cluster.key
demo run --rm --no-deps --entrypoint sh ai-gateway -c \
  'test -r /etc/kong/certs/cluster.crt && test -r /etc/kong/certs/cluster.key'
```

ACLは指定UIDのread権限だけです。`chmod 644`によるworld-readable化や、DPをrootへ変更する対応はしません。ACL非対応filesystemやrootless/user-namespace環境では、ホスト側のUID mappingを確認してから限定的に調整してください。[setfaclの公式マニュアル](https://man7.org/linux/man-pages/man1/setfacl.1.html)を参照できます。

ログはローカルだけで確認してください。会話、provider情報、認証値を含み得るため、raw log、展開済みCompose、state、planを公開しないでください。

## UIのローカル検証（任意）

```sh
npm --prefix app ci --legacy-peer-deps --no-audit --no-fund
npm --prefix app run lint
npm --prefix app run typecheck
npm --prefix app test
npm --prefix app run build
```

## 参照と検証限界

- [構築設定と責務](config/konnect-ai-gateway/README.md)
- [構築検証の記録](docs/evidence/reproducible-setup-validation.md)
- [構成図・ソース対応表](resources/architecture/README.md)
- [Kong AI Gateway 2.x concepts](https://developer.konghq.com/ai-gateway/ai-gateway-v2-concepts/)
- [公式Konnect provider](https://registry.terraform.io/providers/Kong/konnect/3.25.0/docs)
- [kongctl v1.20.2](https://github.com/Kong/kongctl/releases/tag/v1.20.2)

この構築手順はローカルschema、静的検査、dummy入力、独立レビューで検証しています。新しいKonnect環境への実apply、DPの新規接続、モデル・Jev推論は実施していません。実環境の権限、API側の制限、接続後の応答は別途確認が必要です。
