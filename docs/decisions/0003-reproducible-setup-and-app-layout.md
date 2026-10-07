# ADR 0003: アプリ配置と再現可能なセットアップの責務

## 決定

Next.jsのソース、テスト、npm・TypeScript・ビルド設定は`app/`にまとめます。リポジトリルートはCompose、環境設定のひな形、IaC、Docker定義、資料の入口に限定します。GitHub Actionsの定義はGitHubが検出する`.github/workflows/`に置きます。

保険APIは公開GHCRイメージを使用し、利用者に別リポジトリのcloneやAPIのビルドを要求しません。UI自身はこのリポジトリの`app/`からビルドします。保険APIのイメージ取得とUIビルドは別の操作です。

KonnectのAI Gateway instanceと公開DP証明書は、公式Terraform provider `kong/konnect` 3.25.0で管理します。AI Model Provider、Model、Auth Strategy、Consumer credential、MCP Serverはkongctl 1.20.2の宣言設定で管理します。kongctlではTerraformのinstanceをexternal参照し、管理範囲を重ねません。適用可能な設定と必要なローカル入力をリポジトリで管理し、主手順ではUI操作や既存環境の設定の譲渡に依存しません。安定版providerの専用AI Gateway resourceを使い、一般Gateway Control Planeへ置き換えたり、非標準REST providerを追加したりしません。

秘密、Terraform state/plan、秘密鍵、実環境のローカル入力はGitへ追加しません。公開証明書だけをTerraformへ渡し、秘密鍵と上流・受信キーはstateへ入れません。kongctlのsecret付きplanはローカルで0600を維持します。

## 理由

初見の利用者が、デモのアプリと構築設定を区別し、必要なコマンドを順番に実行できる構成にするためです。フレームワークの標準配置はアプリディレクトリ内で維持でき、リポジトリルートへビルド設定を残す理由にはなりません。

## 検証と不変条件

公開イメージのタグだけを推測せず、manifest、digest、source revisionとseedの互換性を確認します。10ケース、許可GET、投影、当ターン台帳、通常LLM・Jev・補足の実行契約は変更しません。

Terraform providerとkongctlの現行スキーマで設定を検証し、実行手順を独立レビューします。対象リソースを表現できない重大な不足があれば、その根拠を示して判断へ戻し、UI手順を代替として成立扱いしません。静的検証と実環境への適用・疎通は別の証拠です。

既存の稼働デモとKonnect設定を置き換えず、モデル推論を追加実行しません。過去のJSON・PNG証拠は原本のまま保持します。
