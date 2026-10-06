# Troubleshooting and handoff log

Append a dated entry when behavior differs from expectations. Include expectation, observation, known cause, action/next step, and evidence. Never include secrets or raw customer responses.

## 2026-10-05: Documentation scaffold

- Expected: a self-contained development handoff with no application or live changes.
- Observed: README, instructions, design brief, ADR, local Issue draft, and test plan were prepared. Build/test/run commands, CI, dependencies, remote repository, and posted Issue are absent.
- Action: mark Bootstrap partial. Perform independent document review before a separate implementation task. Model connectivity and Compose remain untested.
- Handoff feedback: no additional instruction friction identified in the public development scaffold. No technical runtime result is claimed.
- Evidence: the eight documentation/configuration files in this scaffold; no runtime test output exists.

## 2026-10-05: TypeSafe-native smoke contract review

- Expected: the live-follow-up plan distinguishes Jev's TypeSafe-native contract from the normal LLM adapter.
- Observed: the plan requested a native schema smoke but did not explicitly forbid ChatCompletion translation. Review classified this as a medium-risk ambiguity, not an observed runtime failure.
- Action: require a smoke of the TypeSafe-native route, JSON-string state, and answer schema, and prohibit translating Jev requests or responses through ChatCompletion. Independent final documentation review passed across all eight scaffold files; local Markdown links resolve. This validates documentation only, not implementation or live readiness.
- Evidence: [test plan](test-plan.md). No runtime behavior was tested.

## 2026-10-05: Offline implementation and local checks

- Expected: the default UI and contract suite stay offline while the separate live path remains gated. No real data or credential is needed.
- Observed: the repository now has a fixture UI, an explicitly configured live dispatch boundary, projected MCP wrappers, request-ID replay protection, a process-local comparison snapshot store, and 23 mocked unit tests. Live, model, MCP, and native Jev connectivity remain unverified.
- Checks: `npm run lint` passed; `npm run typecheck` passed; `npm test` passed with 1 file and 23 tests; `npm run secret-scan` reported 35 files and 0 findings; `NEXT_TELEMETRY_DISABLED=1 npm run build` passed and generated `/`, `/api/live`, `/api/live/readiness`, and `/api/offline`.
- Action: independent code review and localhost browser smoke passed; see [browser evidence](evidence/browser-smoke.md). Keep live mode, external business API calls, paid model requests, Compose, and credential access disabled.
- Evidence: local commands above use pinned dependencies and fixture/mocked transports. The production build has not tested any live route or endpoint.

## 2026-10-05: Separate rubric and Jev evidence in the UI

- Expected: show the submitted inquiry, projected facts, host rubric, and Jev result as separate evidence, with the LLM supplement apart from the decision.
- Observed: a local UI smoke found that the host rubric and decision card shared a panel, and the ordered priority criteria were not visible.
- Action: moved the versioned rubric to a shared data module used by both the TypeSafe request builder and UI. Added separate rubric and Jev sections in live and fixture views; kept the supplement in its own labeled section. The UI smoke also exposed a misleading supplement message after Jev failure; the page now reports that the decision failed instead of saying facts are incomplete. The final render recheck and independent critical-code review passed; see [browser evidence](evidence/browser-smoke.md).
- Evidence: the rubric is `insurance-intake-v1`; unit coverage checks that its displayed choices and priority scale match the native request data.

## 2026-10-05: Offline handoff verification

- Independent review: critical code and contract checks passed; the reviewer independently reran 22 unit tests and typecheck.
- Browser check: three scenarios, their comparison fixtures, all three error fixtures, evidence separation, and locked default live readiness passed. See [browser evidence](evidence/browser-smoke.md).
- Final publication check: secret scan reported 35 text files and 0 findings; Git whitespace checks passed.
- Remaining limits: live LLM/MCP/Gateway/native Jev connectivity, provider/model pin, recommendation quality, and Gateway-level retry controls remain unverified. Process-local replay/snapshot limits are documented. No live environment was enabled.
- Handoff feedback: native schema and upstream-error privacy boundaries needed explicit contract tests. No additional workflow changes are required for this offline handoff.

## 2026-10-05: Preserve request reservations until process restart

- Expected: replaying a live request ID cannot reserve a second Jev attempt while the process remains running, even after elapsed time or a failed request.
- Observed: the single-flight entry originally expired after 15 minutes, while each new agent call creates a fresh per-turn attempt registry.
- Action: keep request IDs, fingerprints, and result promises for the full process lifetime; changed payloads conflict, failures stay consumed, and the 4,096-entry cap fails closed. Snapshot expiration remains independent.
- Checks: lint, typecheck, tests, secret scan, and production build passed after the change. The focused unit test advances the fake clock by 16 minutes and verifies replay and consumed failures. No live request was made.

## 2026-10-05: Conversation acceptance gap

- Expected: preserve the conversational Chat UI and bounded same-target recent user turns.
- Observed: the implemented form replaces a single result card; the live agent receives only the current inquiry. No multi-turn history, message-part rendering, or conversation streaming is implemented.
- Action: record the delivered single-inquiry/agent/decision subset and leave conversational acceptance incomplete. No additional UI implementation is claimed by this handoff.
- Evidence: `src/app/page.tsx` and `src/lib/gateway-agent.ts`; offline test and browser evidence apply only to the implemented subset.

## 2026-10-05: Bounded chat history implementation delta

- Expected: append conversation turns, keep evidence isolated to a selected turn, and provide the normal live agent only a small same-case text history without treating it as verified facts.
- Observed: the UI now appends each inquiry and labeled normal-agent/fixture response, displays allowlisted tool status only, and renders four evidence sections for the selected turn. A live request can include at most one previous same-case live user/assistant turn plus the current inquiry; length and schema validation occur before Gateway use. Case or mode changes clear conversation and evidence state. Jev still receives only the current inquiry with facts derived solely from the current-turn ledger. Offline narratives and tool plans are fixture-labeled and not executed.
- Checks: lint, typecheck, 27 mocked unit tests, secret scan (37 files, 0 findings), production build, and `git diff --check` pass. Independent delta review passed (the separate reviewer reran 27 tests and typecheck). Chat-specific localhost browser checks passed for two-turn append, earlier-turn evidence selection, case reset, and in-flight switching controls; see [browser evidence](evidence/browser-smoke.md). No live request was made. Realtime streaming and message-part rendering remain unimplemented.
- Evidence: `src/lib/conversation.ts`, `src/lib/chat-state.ts`, `src/app/page.tsx`, and `tests/unit/contracts.test.ts`.

## 2026-10-05: Japanese UI localization delta

- Expected: localize user-facing UI and offline fixture text while preserving API values, TypeSafe-native Jev questions/results, live gates, ledger/history, and replay behavior.
- Observed: set document language/metadata to Japanese; translated UI labels, errors, scenarios, fixture conversation, and safe state/source summaries. Added display-only Japanese mappings for choices, score labels, confidence/probability, rubric, statuses, and sources. Raw API facts and Jev values remain unchanged behind collapsed JSON evidence. The normal live LLM and supplement prompts request Japanese replies; native Jev questions/instructions and rubric wire values are unchanged. Unknown choice/status/legend values display an unsupported-value message with the raw value. No live request was made.
- Checks: lint, typecheck, 28 mocked unit tests, secret scan (38 text files, zero findings), production build, and Git whitespace checks passed. The separate reviewer independently reran tests/typecheck and approved the delta; Manager localhost checks passed for all three cases/comparisons, failure states, history selection/reset and raw evidence preservation. See [browser evidence](evidence/browser-smoke.md).
- Evidence: `src/lib/ja-display.ts`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/lib/offline-demo.ts`, and `tests/unit/contracts.test.ts`.
- Instruction/process feedback for the Japanese delta: none beyond preserving display-only boundaries; no architecture change was needed.


## 2026-10-06: 10ケース・毎ターン取得・v2追加確認度のモック検証

- 変更: 既存seedの投影から10ケースを追加し、日本語の [TEST.md](../TEST.md) に選択名・長い入力全文・確認目的・取得事実・想定方向・非保証を記載。READMEも日本語化した。設定用TypeScriptはrootに維持し、増分ビルドキャッシュはGit対象外とした。
- 設計: 比較チェックボックスと親スナップショットを撤廃し、各新規ターンで台帳とAPI取得を新規作成する。同一保持リクエストIDの再送防止・試行計数は維持。画面だけ最新順で、内部履歴は送信順と元ターン番号を保持する。[ADR 0002](decisions/0002-fresh-turns-and-contextual-intake-v2.md) を参照。
- 基準: `insurance-intake-v2` は受付先・次の確認事項にfactsと問い合わせの双方を使い、Scoreを緊急度でなく追加確認度として説明する。同項目の相違申告は照合必要性であり、真の矛盾を確定しない。requestedとpaidの差、nullと0、支払済と銀行入金を区別する。
- 観察と修正: 保存したv1ネイティブ応答を扱う表示テストで、版未記録をv1と断定し得る経路、v1/v2凡例語彙の共通変換、未知凡例に対する旧期待値を確認した。明示v1/v2/未知版の表示を分け、版違いの凡例は原値付き未対応、未知版は原凡例を保持して尺度を解釈しない。過去のv1証拠ファイルは変更していない。
- モック証拠: lint（警告・エラー0）、typecheck、3ファイル／77 unit tests（契約45、live失敗境界25、SSR表示7）、secret scan（61ファイル／検出0）、production build、`git diff --check` が成功。10ケースのGET→台帳→v2ネイティブ入力、同文異事実、複合／曖昧文脈をモックで確認した。これは実Jevの判定品質証明ではない。
- 包装: Dockerのweb buildも成功し、Next.js 16.3.8のcompile・型検査・静的ページ生成が完了。候補imageは `sha256:47922edb386865256af20bdccc5d7a2de637e3b44b6a509567bfe21b3e0bc7f4`。webだけを2026-10-06 23:05:09 JSTのbash date時点で再作成した。既存data planeと5 APIはcontainer ID・image・開始時刻がすべて更新前と一致した。GET /はHTTP 200・正確な10選択名・比較checkboxなし、GET /api/live/readinessはHTTP 200、ready true／explicitly configured。これらは起動・画面・設定状態の確認で、実モデル評価の証拠ではない。
- 独立検証: 別担当が初回76 unit tests成功を再現。S9の任意契約参照について発見前拒否・発見後取得・Jev申込投影から契約状態除外を追加し、統合検証は77 tests成功。最終source/docsオフライン差分は独立レビューPASS。追加後の77 tests、lint、typecheck、scan、diff-checkを別担当が再現した。runtime更新の操作承認はこのレビューではなく別の既承認範囲に基づく。
- 実行境界: 今回の実モデルPOSTは0回。API seed、Konnect、data plane、5 APIの変更は行わない。既存英語の歴史的文書は一部残し、主要README・新規TEST・新規ADRは日本語とした。ownerの実モデル受入・PR merge・Issue closeはこの検証の完了とは別。
- 手順上の改善: ケース切替と会話クリアは過去のUI結果を消すため、比較手順で操作前に事実・基準版・原値を保存する。また申込の3種類／請求の4種類は必須取得集合で、許可された発見参照の追加GET数の上限としない。
