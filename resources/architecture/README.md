# 保険問い合わせデモの構成図

[構成図HTML](architecture.html) / [編集元JSON](architecture.architecture.json) / [README用PNG](architecture.png)

ローカルComposeのWeb、Kong AI Gateway data plane、5つの保険APIと、外部のKonnect、Gemini、TypeSafe / Jevを示します。5つのAPIは独立したコンテナですが、図では名前を列挙した1つのグループにまとめています。通常LLM、MCPの詳細GET、ネイティブJev評価、mTLSの管理設定同期を別の線で表します。Konnect CPは推論経路ではありません。

TerraformがKonnectのAI Gateway instanceと公開DP証明書を管理し、kongctlがモデル・認証・MCPの管理entityを適用します。保険APIは公開GHCRイメージ、Webは`app/`からの独自ビルドです。構築手順は[INSTRUCTIONS](../../INSTRUCTIONS.md)を参照してください。

## 要素と根拠

| 図の要素 | 設定・実装上の意味 | 根拠と観測範囲 |
|---|---|---|
| Web / Host | Next.js UI、LLM/MCPクライアント、当ターンの投影・台帳検証 | [Compose](../../compose.yaml)、[設計方針](../../docs/design-brief.md)。PII投影とJev eligibilityはホスト側の処理です。 |
| DP 2.2.0と内部グループ | `kong/kong-ai-gateway:2.2.0`。DP要素は管理設定の同期先を示し、個別pluginへの管理APIではありません。 | ComposeのDPと外部Konnect CP。Adminポート8001は公開しません。 |
| AI Proxy Advanced（通常LLM用） | AI Modelに対応するモデル処理。Gemini 2.5 Flashを通常LLMに使用 | [公式2.x entity mapping](https://developer.konghq.com/ai-gateway/ai-gateway-v2-concepts/)、[現在と履歴の構成記録](../../docs/ai-gateway-compose.md)。未使用のOpenAI候補は実接続として描いていません。 |
| AI Proxy Advanced（native Jev用） | 別のAI Modelに対応するTypeSafeネイティブ`decisions`処理 | [TypeSafe provider](https://developer.konghq.com/ai-gateway/ai-providers/typesafe/)、構成記録のネイティブJev checkpoint。2.2.0イメージのAdvanced→TypeSafe実装を確認した履歴があります。 |
| AI MCP Proxy | AI MCP Server `conversion-listener`に対応する内部機能 | 公式2.x entity mappingはAI MCP ProxyとAI MCP Serverの対応を示します。管理するのはAI MCP Server entityです。legacyのService/Route/plugin設定をこのデモへ直接持ち込む手順ではありません。 |
| key-auth | AI Auth Strategyの`type: key-auth`に対応する受信認証 | [kongctl宣言設定](../../config/konnect-ai-gateway/kongctl/ai-gateway.yaml)、構成記録。アプリの固定`apikey`ヘッダーと、外向きprovider認証を区別します。 |
| 5つの保険API | Customer / Product / Application / Claim / Policy、許可されたGET詳細操作 | Compose、[MCP設定](../../config/konnect-ai-gateway/README.md)。RESTコンテナだけではMCPになりません。 |

AI Model、AI Model Provider、AI MCP Server、AI Auth StrategyはKonnectの管理entityであり、plugin名ではありません。図のplugin箱は公式mapping上の対応機能と用途を示します。個別Routeに生成されたplugin instanceの対応付け、個別リクエストのhandler traceは直接観測していません。2つのAI Proxy Advanced箱も、観測したinstance数の主張ではありません。新規CPの作成や全10ケースのライブ品質は、この文書整備では検証していません。

## 作成レシート

- 図種: `architecture`、静的表示。日本語の説明と正確な製品名・識別子を使用します。
- JSON SHA-256: `e7b8dd103fd717078893605038418e4a5a07f3d3288a8f4283c475f5f2fa0f83`（5,315 bytes）
- HTML SHA-256: `caa37d2bf9abebe18ee630832640b63cb825109bfb8c72c70ead29893086938f`（810,898 bytes）
- Manager引取時の旧候補: render失敗。配置単純化の初稿は3診断、修正2往復で0診断。PNG目視でMCP線ラベルを明確化し、全5API名を表示する追加の目視修正1往復を実施しました。
- showcase `validate`: 9/9、0エラー・0警告。`deliver`: 成功。編集元とHTMLは上記hashに固定します。
- `visual-check`: 1440×900、1600×1000、1920×1080、2048×1320のlightテーマで画面内に収まり、両端サイズのlight/dark PNGを取得。最新[自動browser receipt](architecture.visual-check.json)と[contact sheet](architecture.visual-check.html)を保持します。receiptのartifact pathだけをrepo相対へ置換しています。
- 自動browser証拠はpass、目視確認はpass（両テーマの端点画像、README用PNG）。検査機能と人による目視は別の判定です。
- README用PNGは、固定HTMLのinline SVGとlightテーマのスタイルをローカルの既存Sharpでラスタライズしました。ブラウザーのツールバーや一時的な操作状態を含めません。HTMLの改変、提供スクリーンショットの画像編集は行っていません。
- 新規パターンなし。全体幅によるdesktop readabilityとfan-outのラベル衝突は既知の修正です。
- Viewerの固定UIと`html lang`はArchifyの英語fallbackです。図の説明は日本語です。

提供されたUI画面例は[README](../../README.md)と[Chat UIガイド](../../Chat%20UI.md)を参照してください。構成図・画面例は、wire traceや回答品質の証明ではありません。
