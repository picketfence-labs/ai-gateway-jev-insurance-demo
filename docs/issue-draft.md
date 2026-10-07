# 作業項目 #1: 保険問い合わせデモ

> このファイルはGitHub Issue #1のローカル参照記録です。この文書整備でGitHub上のIssueは更新していません。初期の3ケース／スナップショット案と現在の10ケース／毎ターン取得／v2基準を混同しないでください。

Issue: [#1 Implement the offline insurance inquiry demo](https://github.com/picketfence-labs/ai-gateway-jev-insurance-demo/issues/1)

設計の正本: [docs/design-brief.md](design-brief.md)
現在の操作条件: [TEST.md](../TEST.md)、[Chat UI.md](../Chat%20UI.md)

## 目的

通常LLMがMCPを通じて合成保険APIの許可された詳細を取得し、ホストが当ターンの投影事実を検証してTypeSafeのネイティブJev評価へ渡す会話デモを提供します。Jevの結果とLLM補足を分けて表示します。

## 現在の実装範囲

- 10件の固定合成ケースを持ち、各新規ターンで新しい台帳とAPI取得を使います。
- 通常LLMはKong AI Gateway 2.2を通り、MCPの許可済みGET詳細ツールを自動選択します。正常完了後に必須事実が欠けている場合だけ、ホストが同じスコープと台帳で補完できます。通常LLMの失敗時は補完しません。
- ホストが取得事実、型、ID範囲、参照関係を検証し、適格なターンだけTypeSafeネイティブ形式の3問をJevへ一度送ります。
- `insurance-intake-v2`の追加確認度を使います。Jevの回答、候補確率、連続Score、confidence、基準版は原値で扱い、LLM補足は別表示します。
- 日本語UIはライブ実行用です。fixtureは内部テスト専用で、UIからオフラインfixtureを選ぶ機能はありません。

## 承認済み構成と証拠の境界

現在の受入構成は、Kong AI Gateway経由のGemini 2.5 Flashと、AI Proxy Advanced経由のTypeSafeネイティブJevルートです。これは構成受入であり、個別のwire trace、10ケースすべてのライブ動作、ホスト補完、複数ターン、回答品質の証明ではありません。

履歴にはv1基準で完了したS1ライブターンが1件あります。記録された実Jev値はモデル`jev-1.13.0`、Score `1.24`、confidence `0`です。通常LLMは4件のMCPツールを選び、ホスト補完は発生していません。詳細と観測範囲は[Compose実行記録](ai-gateway-compose.md)にあります。この結果をv2基準に読み替えません。未実施のライブ評価、金額上限、実接続の未観測部分は成功やゼロ費用として補いません。

本書およびテスト計画は、新規ライブリクエスト、秘密の読出し、Konnect変更、公開、追加課金の承認ではありません。新しい送信には実行条件に応じた個別の明示的承認が必要です。

## 不変の安全条件

- 通常LLMの会話とMCPツール選択を維持します。固定GET画面へ置き換えず、JevをLLMツールにしません。
- Customer、Product、Application、Claim、Policyの許可済みGET詳細だけを使います。問い合わせ文、過去ターン、静的な期待IDから参照先を取得しません。
- Customer生応答をサーバーで投影してからLLM SDKへ返します。個人情報、秘密、raw応答をログ、Jev、UI、証拠へ出しません。自由入力に含まれた情報はAPI投影では除去できません。
- Jev入力は現在の台帳と今回の問い合わせから作り、Jev結果とLLM補足を分離します。型や参照の不備、LLM失敗ではJevを呼びません。失敗時に理由・confidence・Score・成功結果を捏造しません。
- `null`を0に変えず、請求額と支払記録額の差、申告の相違から誤り・不足払い・真の矛盾を断定しません。

## 初期合意と置換履歴

最初の作業項目は3つのコアケースと比較スナップショットを計画していました。これらは現行機能ではありません。比較チェックボックス、親スナップショット、比較専用の取得省略は[ADR 0002](decisions/0002-fresh-turns-and-contextual-intake-v2.md)で撤廃し、現在は10ケースを新しいターンとして毎回取得します。旧v1尺度の保存応答はそのまま残し、v2で再解釈しません。

## 検証と残り

オフライン契約テスト、モック、secret scan、lint、typecheck、production buildの最新記録は[検証計画](test-plan.md)と[作業ログ](troubleshooting-log.md)にあります。これらは実Jevの品質や未実施の外部接続を証明しません。

残るのは、ownerが範囲・費用・方法を個別に承認した場合のライブ確認、必要な独立レビューとデモ受入、およびリアルタイムストリーミング／メッセージ部品表示などの将来候補です。Issueのmerge、クローズ、全体受入をこの文書更新から推測しません。
