# ADR 0001: エージェントの取得とホスト判断を分ける

> 比較スナップショットに関する当初の決定は[ADR 0002](0002-fresh-turns-and-contextual-intake-v2.md)で置き換えました。LLMのツール取得、ホストのJev判断、ツール無効のLLM補足を分ける境界は維持します。

日付: 2026-10-05。状態: 採用。実装時の記録として保存し、後の変更は後続ADRへ記録します。

## 背景

会話型LLMの動作と、実際のMCPツール呼出しを残しながら、Jevの提案を表示する必要があります。通常LLMが評価を省略したり、生の顧客情報を転送したりしてはいけません。

## 検討した案

| 案 | 利点 | コスト |
|---|---|---|
| 通常LLMを使わず、固定GETだけを実行 | 呼出しが少なく、比較が単純 | 会話とagentによるツール選択が失われる |
| agentに任意のJev toolを加える | 1つのloopで実装できる | agentが評価を省いたり入力契約を変えたりできる |
| agentが事実を取得し、ホストがJevを呼び、ツール無効のLLMが補足 | 求められた体験と明示的な実行境界を保つ | wrapper、台帳、phase制御が必要 |

## 決定と理由

3つ目の案を採用します。通常LLMは許可されたMCP toolを`toolChoice: auto`で選びます。サーバーwrapperは、SDKへ結果を返す前にID範囲を検証し、許可項目だけを投影します。通常LLMが正常に完了した後、ホストは同じ範囲のMCP wrapperを使い、選択ケースで不足する必須事実だけを取得できます。ホストは台帳が揃っていることを検証し、適格なターンで一度Jevを呼びます。別のツール無効generationがJevの結果をLLM補足として説明します。

この限定補完はUIに明示し、LLMが選択したツール呼出しと区別します。補完に使えるIDは選択した起点と当ターンに取得した投影済み事実から発見した参照だけです。静的な期待IDを取得元にはせず、前ターンの事実、任意ID、隠れたREST呼出し、成功GETの重複取得を使いません。通常LLMのtransport／SDK失敗時は補完せず停止します。Jevを認可手段として扱いません。

当初の比較設計では、同じ事実の比較用snapshot wrapperに明示的なsource labelを付ける判断でした。これは現行仕様ではありません。比較checkbox、親snapshot、snapshot由来の応答は[ADR 0002](0002-fresh-turns-and-contextual-intake-v2.md)で撤廃し、新規ターンごとに事実を取得します。

## 影響

LLMが参照を辿るID投影と、IDを含まないJev向け事実投影を分けます。tool／step制限、再試行防止、漏えいテストが必要です。通常LLMはKong AI Gateway 2.2経由で、直接providerへ接続しません。現行のowner受入構成はGemini 2.5 Flashと、AI Proxy Advanced経由のTypeSafe native Jevです。設定の受入だけではwire trace、すべてのケースの応答、回答品質を証明しません。

当初の実装ではfixture transportとlive SDK adapterを分離し、live dispatchをserver mode、approval／UI-enable flags、endpoint、timeout、credentialの設定でgateしました。リクエストIDはUUIDv4で、process-local registryは保持中の同一入力を再実行せず、異なる入力を拒否します。registryは最大4,096件を保持し、満杯時は最古の完了記録だけを退避します。処理中の記録は退避しません。退避後、再起動後、複数instance間の保護はありません。

Jev質問は名前付きのnative mapとJSON文字列`state`を使います。応答parserは全候補確率keyとnative usage項目を要求します。offline testはmock transportを使い、live wire契約を検証しません。現在の実行上限と証拠は[設計方針](../design-brief.md)と[検証計画](../test-plan.md)を参照してください。

## 当初の期待と観測

2026-10-05時点の期待は、利用者の申告、投影事実、実際のJevカード、ツール無効のLLM補足を分けた簡潔なChat UIでした。当時の観測はoffline UIとmock contract testの存在で、独立reviewとbrowser smokeは進行中でした。外部model、MCP server、Gateway、Jev endpointの接続はその記録時点では未確認です。後のS1ライブ実行、native Jev smoke、v2変更は[Compose記録](../ai-gateway-compose.md)と[トラブルシューティング記録](../troubleshooting-log.md)に別の証拠として残しています。

関連資料: [設計方針](../design-brief.md)、[検証計画](../test-plan.md)、[ADR 0002](0002-fresh-turns-and-contextual-intake-v2.md)
