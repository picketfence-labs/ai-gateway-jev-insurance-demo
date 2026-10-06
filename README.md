# Kong AI Gateway と Jev の保険問い合わせデモ

この非公開リポジトリには、合成保険レコードを使う会話型デモがあります。通常のLLMがKong AI Gateway経由で読み取り専用MCPツールを選び、ホストが取得事実を検証してJevへ渡します。Jevの応答とLLM補足は別々に表示します。

画面は日本語で、10の固定seedケースを選びます。画面にオフライン実行の選択肢はありません。ライブ接続は既定でロックされ、承認済み環境・承認・必要設定が揃った場合だけ送信できます。リアルタイムストリーミングとメッセージ部分ごとの表示は未実装です。

このデモは保険引受、支払可否、本人確認、サービス提供の約束を行いません。実Jevの応答品質や上流接続をオフラインテストで証明するものでもありません。

## 変更前に読む

1. [日本語テストシナリオ](TEST.md)では、10ケースそれぞれの選択名、入力全文、確認事項、想定の方向を確認できます。手動ライブテストの承認ではありません。
2. [設計概要](docs/design-brief.md)でスコープ、seed、信頼境界を確認します。
3. [決定記録 0001](docs/decisions/0001-agent-and-host-decision-boundary.md)でLLMとホストの責務、[決定記録 0002](docs/decisions/0002-fresh-turns-and-contextual-intake-v2.md)で新規ターンとv2基準を確認します。
4. [テスト計画](docs/test-plan.md)でオフライン検証と、別途承認が必要なライブ準備を確認します。
5. [作業項目 #1](docs/issue-draft.md)と[トラブルシューティング記録](docs/troubleshooting-log.md)で実装条件と検証記録を確認します。

## Composeの静的設定

`compose.yaml`はKong AI Gateway 2.2のdata plane、このUI、5つの内部保険APIコンテナを記述します。設定はライブアクセスを有効にせず、KonnectのAI Modelやprovider entityも作成しません。証明書、モデル経路、認証、Jevネイティブendpoint、MCP経路は環境ownerが用意する入力です。

次のコマンドはdaemonを起動せず、Compose設定を検証します。イメージのbuild、起動、API・Gateway・MCP・モデル・Jevとの接続は確認しません。

```sh
docker compose --env-file .env.example config --quiet
```

GitHub ActionsはNode.js 22でlint、typecheck、unit test、secret scan、production buildを実行します。これらのオフライン検証は上流接続やモデル品質を証明しません。

## UIを起動する

Node.js 22とnpmを使います。リポジトリのrootで依存関係を入れ、ローカルUIを起動します。

```sh
npm ci --legacy-peer-deps --no-audit --no-fund
```

```sh
NEXT_TELEMETRY_DISABLED=1 npm run dev
```

`http://127.0.0.1:3000`を開きます。完全な承認済みライブ設定がなければ送信できず、fixtureへフォールバックしません。秘密や実在する顧客情報を入力しないでください。ライブ設定を変更したり、モデル/APIへ送信したりする前に、対象環境、実行範囲、費用について別途承認を得てください。

## オフライン検証

リポジトリrootで次のコマンドを実行します。

```sh
npm run lint
```

```sh
npm run typecheck
```

```sh
npm test
```

```sh
npm run secret-scan
```

```sh
NEXT_TELEMETRY_DISABLED=1 npm run build
```

unit testは合成fixtureとmock transportを使います。実Jevの選択、連続Scoreの値、confidence、応答品質を保証しません。各ケースの実モデル評価は、[TEST.md](TEST.md)の確認手順と別途承認に従って記録してください。

## 動作とデータの境界

- Customer、Product、Application、Claim、Policyは承認されたGET-detail操作だけを使います。検索、一覧、Simulation、書き込み操作は行いません。
- 通常のLLMがMCPツールを選択します。ホストは現在のターンの投影済み台帳、ID範囲、参照関係を検証してからJevを呼び出します。
- CustomerのAPI生応答はホストが受信しますが、氏名、連絡先、住所、口座、国民識別番号、健康詳細は許可リスト投影で除外し、LLM SDK、Jev、UI、ログへ渡しません。自由入力文は別の境界です。実在する顧客情報を入力しないでください。Jevへ送るJSON文字列にはIDを含めません。
- 画面で新しい問い合わせを送ると新しいターンです。選択した固定ケースの事実を毎回APIから取得します。同じ事実を使う比較チェックボックスやスナップショット再利用はありません。
- 保持中の同一リクエストIDと同じ入力を再送した場合は、処理中または完了結果を返し、新しく実行しません。同じIDに異なる入力を付けると拒否します。これはプロセス内の重複送信対策で、再起動後や複数instance間の永続的な冪等性ではありません。
- LLMには同一ケースの直前の会話1ターンを未検証の文脈として渡す場合があります。その文脈は事実取得の代用にならず、Jevは現在の問い合わせと現在ターンの台帳だけを受け取ります。ケース変更で会話を消去します。
- オフラインfixtureは内部テスト専用です。LLM出力、API応答、実際のJev判断として扱いません。
- 会話履歴は画面で最新ターンから表示します。ターンは内部で送信順に保持し、各ターンの証拠はそのターンの問い合わせと並べて表示します。
- Jevの追加確認度は0〜2の連続実数です。信頼度は正しさや客観的緊急度を保証しません。申告上の差は確認済みの矛盾ではありません。

## rootにあるTypeScriptファイル

rootのTypeScriptファイルはアプリの業務ロジックではなく、フレームワークとテストランナーの設定・型参照です。Next.jsとVitestがrootから設定を読み込むため、この配置が適切です。

- `next.config.ts`はNext.js設定です。現在は`X-Powered-By` headerを無効にします。
- `vitest.config.ts`はVitest設定です。`@` aliasを`src/`へ解決し、`tests/**/*.test.ts`を実行対象にします。
- `next-env.d.ts`はNext.jsが生成する型参照です。業務ソースではなく、手作業で編集しません。
- `tsconfig.tsbuildinfo`はTypeScript増分buildの生成キャッシュで、`.gitignore`対象です。`.ts`ソースではありません。

アプリケーションコードは`src/`、unit testは`tests/unit/`に置きます。上記設定を`src/`へ移動すると、Next.jsやVitestの標準的な検出場所から外れます。

## 参考リポジトリ

- [Kong MCP Chat UI](https://github.com/picketfence-labs/konnect-code-mode-mcp)
- [合成保険API](https://github.com/picketfence-labs/kong-api-bundle-insurance)
