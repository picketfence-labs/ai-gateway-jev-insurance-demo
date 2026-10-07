# Konnect AI Gateway Entity候補

このディレクトリのJSONはレビュー用の静的なrequest-body候補です。適用済み設定、デプロイbundle、`kongctl apply -f` に渡せる宣言ファイルではありません。Organization ID、Gateway ID、Consumer credential、PAT、秘密値、実環境のendpointは含めません。スクリプトによるApplyも提供しません。

実設定を作る前に、Control Plane所有者から対象Organization・Gateway・region、AI Gateway 2.2の現行スキーマ、provider/modelの利用可否、認証・route・target方針を確認してください。新規Control Planeの作成やEntityのApplyはこのリポジトリの検証範囲外です。過去の所有者のID・認証情報・Terraform/decK stateを流用してはいけません。

## ファイルと候補の区別

- `provider-gemini.json`、`provider-openai.json`、`provider-typesafe.json`: outbound providerの候補。認証値は無効なプレースホルダーで、実在するcredentialではありません。
- `model-normal.json`: 無効化された通常LLM用AI Modelの静的候補です。Gemini 3.5 FlashとOpenAIのtarget候補を含みますが、OpenAI targetはこのデモの実接続先ではありません。文書化された通常経路はGemini 2.5 Flashです。候補ファイルやaliasが現在のControl Planeに存在するとは限りません。
- `model-jev-typesafe.json`: 無効化されたTypeSafe `decisions` 用の別AI Model候補です。native `formats.type: typesafe` と `/jev/v1/systemone` を前提とし、Chat Completions用モデルへ変換してはいけません。
- `auth-strategy-mcp.json`: `apikey` request headerのみを使うAI Auth Strategy候補です。query/bodyでの認証は無効にし、credential hidingを有効にする内容です。実運用には所有者が作成したAI Consumerと、別経路で発行したcredentialが必要です。
- `mcp-*.json`: 5つの保険API向け `conversion-listener` AI MCP Server候補です。REST APIコンテナを起動するだけではMCP endpointは作られません。GatewayでEntityとrouteが作成されて初めて利用できます。

EntityとGateway内部のpluginは別概念です。AI Gateway 2.xでは管理EntityからGatewayの処理設定がプロビジョニングされます。公式の高位mappingはAI Model→AI Proxy Advanced、AI MCP Server→AI MCP Proxyです。key-authのAI Auth StrategyはGateway処理で `key-auth` に対応します。対応表は[構成図資料](../../resources/architecture/README.md)を参照してください。これはpluginを利用者が手で追加する手順でも、個別のgenerated plugin instanceやhandler traceを観測した記録でもありません。

## kongctlの使い分け

ローカルで確認した `kongctl` 1.13.0のAI Gateway `get` はbetaで、`models`、`model-providers`、`mcp-servers` をサポートします。対象Gateway名またはIDと、所有者が承認したread-only scopeを使ってください。コマンド形状や安全な確認順は[初回セットアップ手順](../../INSTRUCTIONS.md)を参照してください。ここではKonnect APIの照会・変更は実行していません。

ローカル `kongctl explain ai_gateway_model_provider --output yaml` のスキーマでは `typesafe` provider enumを確認できませんでした。したがって、このCLIスキーマでTypeSafe候補を検証・宣言適用できるとは扱いません。`identity-providers` はCLI上の別リソースで、AI Auth Strategyと同義ではありません。AI Auth StrategyやTypeSafe設定を作る場合は、所有者の承認のもとでKonnect UIまたは、適用時点で確認した公式APIスキーマを使ってください。サンプルJSONをそのまま `kongctl apply` に渡したり、未対応部分に架空のCLI resource nameを当てたりしないでください。

既存の `scripts/konnect-mcp-apply.py` は特定の既存環境を前提にした履歴helperです。別の利用者・Gateway・region向けの初期セットアップに使ってはいけません。

## 公式参照

- [AI Gateway 2.x conceptsとEntity mapping](https://developer.konghq.com/ai-gateway/ai-gateway-v2-concepts/)
- [AI Model Provider entities](https://developer.konghq.com/ai-gateway/entities/ai-model-provider/)
- [AI Model entities](https://developer.konghq.com/ai-gateway/entities/ai-model/)
- [TypeSafe AI provider](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)
- [AI MCP Server entities](https://developer.konghq.com/ai-gateway/entities/ai-mcp-server/)
- [AI Auth Strategy entities](https://developer.konghq.com/ai-gateway/entities/ai-auth-strategy/)
