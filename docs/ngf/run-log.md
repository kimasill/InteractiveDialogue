# NGF — Run Log

런 단위로 구현 범위와 다음 런 핸드오프를 기록한다.

진행 체크는 `docs/ngf/checklist.md`를 기준으로 한다.

---

## Run 1 — Foundation slice (CSV ↔ Graph 라운드트립)

**구현 범위**

- `@ngf/core` — DialogueNode / Choice / Requirement / Outcome / GraphEdge / PlayerState 타입.
  - 식별자 컨벤션: `nodeId = ${npcId}:${nodeIndex}`, `choiceId = ${nodeId}:c${choiceIndex}`.
  - `deriveEdges()`로 캔버스/런타임용 edge 리스트를 노드/선택지에서 파생.
- `@ngf/csv` — 27 컬럼 NPC dialogue 스키마.
  - RFC 4180 미니 파서/직렬화기 (zero-dep).
  - `importCsv` — 행을 `(NPCId, NodeIndex)` → `(ChoiceIndex)` 단위로 그룹핑하고
    `RequirementOrder`/`OutcomeOrder`를 dedupe해서 폴딩.
  - `exportCsv` — 선택지당 `rowCount = max(req, outcome, 1)`로 펼침.
  - `NodeAutoNextNodeIndex = -1`을 "no link" sentinel로 일관 처리.
- `@ngf/validate`
  - broken edge (choice / auto-continue), 누락 필드, 중복 ChoiceIndex,
    self-loop auto-continue, dead-end (info), unreachable node (entry 명시 시),
    `WorldFlagAtLeast`/`requiredWorldFlag` 미설정 휴리스틱.
  - 각 issue는 `fixes` 배열로 UI 액션 후보 동반 (`create_node`, `change_target`,
    `remove_choice`, `create_setter_outcome`).
- `apps/ngf-cli` — `inspect`, `validate`, `round-trip`, `export`, `bundle`.
- `assets/samples/NPC_Dialogue_Jijibo.csv` — 합성 픽스처 (원본 첨부 부재).
- 테스트: `tests/round-trip.test.ts`, `tests/parse.test.ts`, `tests/validate.test.ts`.

**의도된 한계**

- 영속화 없음 — 모든 작업은 메모리/파일. DB 스키마(`graph_nodes`, `graph_edges`,
  `entity_records` 등)는 Run 3에서.
- 동적 SchemaVersion 관리 없음 — 단일 임베디드 NPC 대화 스키마만.
- `nodeTitle`은 모델에 잡혀 있지만 CSV에는 컬럼이 없음. UI 도입 시 schema v2로 추가.

**검증 신호**

`packages/ngf-csv` 와 `packages/ngf-validate`의 vitest가 둘 다 통과하면 라운드트립이
유지된다. CLI `round-trip`은 import → export → re-import의 그래프 동치성을 종료
코드로 확인한다.

---

## Run 2 — Web UI MVP (Graph Canvas + Inspector + CSV Drop)

**예정 슬라이스 (수정 영역이 겹치지 않게 분리)**

- 트랙 A: Vite + React + React Flow 스캐폴드
  - `apps/ngf-web/` (새 디렉터리)
  - `@ngf/csv`/`@ngf/core`를 브라우저에서 사용할 수 있도록 path alias 구성.
  - 파일 드롭 → `importCsv` → React Flow 노드로 매핑.
- 트랙 B: Node Card 컴포넌트 (Compact/Normal/Expanded 4단계)
  - `packages/ngf-ui/` 패키지 신설 (디자인 시스템 분리).
  - 노드 폭/높이 토큰, 색상 토큰, validation 컬러.
- 트랙 C: Choice port 기반 edge 모델
  - 선택지 행마다 source handle을 두고 React Flow의 sourceHandle로 매핑.
  - drag-from-port → 빈 공간 drop → 새 노드 자동 생성 + nextNodeId 연결.
- 트랙 D: Inspector 패널
  - selection store (zustand 권장).
  - Simple/Raw 모드 토글.

**핸드오프 노트**

- Run 1에서 export된 그래프는 deterministic — Run 2에서 UI 회귀 테스트의 fixture로
  같은 `NPC_Dialogue_Jijibo.csv`를 재사용하면 안전하다.
- 새 디렉터리 추가 시 `pnpm-workspace.yaml`은 이미 `apps/*`를 포함하도록 갱신됨.
- `parallel-implement` 서브에이전트로 트랙 A/B/D를 동시에 돌릴 수 있음.
  트랙 C는 A 위에서 진행해야 하므로 순차.

---

## Run 3 — Core Data Layer (DB + REST API)

**구현 범위**

- `packages/ngf-db` — `node:sqlite` 기반 영속화 레이어 (네이티브 빌드 없음).
  - DDL: `workspaces`, `schema_versions`, `graph_nodes`, `import_snapshots`.
  - `GraphEdge`는 `Choice.nextNodeId`에서 파생 — 별도 DB 행 불필요.
  - Repos: `workspace-repo`, `schema-version-repo`, `graph-repo`, `snapshot-repo`.
  - `patch.ts` — `PatchOp` 14종 (set_position / set_node_title / set_dialogue_text /
    set_speaker_name / set_required_world_flag / set_auto_next / create_node / delete_node /
    add_choice / remove_choice / set_choice_text / set_choice_next).
  - `applyPatch()` — in-memory 적용 후 dirty nodeId 목록 반환 → caller가 DB 반영.
  - `patchGraph()` — listNodes → applyPatch → txn(upsert/delete dirty) 일괄 처리.
  - `node:sqlite` API 특성상 `stmt.all()` 결과를 `as unknown as Row[]`로 이중 캐스트.
- `apps/ngf-server` — Hono REST API (tsx ESM 직접 실행, 빌드 스텝 없음).
  - `GET/POST /workspaces`, PATCH/DELETE
  - `GET/POST/DELETE /workspaces/:wsId/schema-versions/:id`
  - `GET/DELETE /workspaces/:wsId/nodes/:nodeId`
  - `PUT /workspaces/:wsId/nodes/:nodeId/position`
  - `POST /workspaces/:wsId/patch` — PatchOp 배열, 422 on error
  - `GET /workspaces/:wsId/graph`
  - `POST /workspaces/:wsId/import-csv` (CSV body → upsertNodes + snapshot)
  - `GET /workspaces/:wsId/export-csv` (text/csv)
  - `GET /workspaces/:wsId/validate`
  - `GET/DELETE /workspaces/:wsId/snapshots/:id`

**의도된 한계**

- Auth 없음 — 단일 사용자 로컬 서버 전제.
- `patchGraph` 검증 시 `@ngf/validate` 호출 없음 — patch 적용 후 별도 validate 엔드포인트로 확인.
- `node:sqlite` 는 Node.js 22+ 실험 기능; `ExperimentalWarning`이 stderr에 출력됨.

**검증 신호**

- `pnpm --filter @ngf/db typecheck`, `pnpm --filter @ngf/server typecheck` 통과.
- 스모크: `POST /workspaces` → `POST /import-csv` (25행 → 14노드) → `GET /validate` (0 errors).

---

## Run 4 — Web UI MVP (Graph Canvas + Inspector + CSV Drop)

- 트랙 A: Vite + React + React Flow 스캐폴드 (`apps/ngf-web/`)
- 트랙 B: Node Card 컴포넌트 (Compact/Normal/Expanded)
- 트랙 C: Choice port 기반 edge 모델 (drag-from-port → 새 노드)
- 트랙 D: Inspector 패널 (zustand selection store, Simple/Raw 모드)

---

## Run 5 — Web UI MVP polish (Auto Layout + CSV Import UX)

- `computeLayout()` 결과를 graph position으로 적용하는 툴바 `Auto Layout` 액션 추가.
- CSV 파일 import 경로를 `utils/csvImport.ts`로 공통화.
- 캔버스 드롭존에 drag ready/reject 상태, CSV 파일 검증, import error 표시 추가.
- 툴바에 import source/row count/import issue summary 표시.
- 스모크: `pnpm --filter @ngf/web typecheck`, `pnpm --filter @ngf/web build`.

---

## Run 6 — Phase 3 Inspector and Inline Editing

- Inspector를 Simple/Raw 모드로 확장.
- Simple 모드에서 node title/speaker/dialogue/guard/auto-next 편집 추가.
- Choice text/next target/required flag/blocking flag 편집 추가.
- Requirement/Outcome add/remove 및 기본 필드 편집 추가.
- Raw 모드에서 선택 노드 JSON 편집 후 apply 지원.
- 그래프 변경마다 validation report를 즉시 갱신하고, inline edit 중 canvas fitView가 튀지 않도록 조정.
- 스모크: `pnpm --filter @ngf/web typecheck`, `pnpm --filter @ngf/web build`.

---

## Run 7 — Phase 4 CSV Export and Table View

- 툴바에 전체 그래프 `Export CSV` 다운로드 추가.
- 하단 패널 추가: Table/CSV Preview 탭, `NPC Dialogue v1` 27컬럼 profile 표시.
- `exportRows()` 기반 editable table projection 구현.
- 전체 / NPC별 / 선택 노드 reachable branch scope 필터 추가.
- TSV copy/paste 및 셀 기준 다중 붙여넣기 지원.
- `Apply Table`에서 `importRows()`로 graph를 재정규화하고 scope 단위로 병합.
- 스모크: `pnpm --filter @ngf/web typecheck`, `pnpm --filter @ngf/web build`.

---

## Run 8 — Phase 5 Validation Engine UI

- validation engine에 runtime enum 검증 추가(requirement/outcome type).
- `HasItemTag` 요구값 대비 `TakeItem` outcome coverage 휴리스틱 추가.
- `PersonaAtLeast` 요구값 대비 양수 `AdjustPersona` 합산 휴리스틱 추가.
- 하단 패널에 `Issues` 탭 추가: error/warning/info summary, issue list, 노드 선택.
- validation fixes 적용 지원: missing node 생성, choice target 변경, choice 제거, setter outcome 생성.
- 스모크: `pnpm --filter @ngf/validate test`, `pnpm --filter @ngf/validate typecheck`, `pnpm --filter @ngf/web typecheck`, `pnpm --filter @ngf/web build`.

---

## Run 9 — Phase 6 Playtest Simulator

- 순수 playtest utility 추가: entry resolve, requirement 평가, choice availability, outcome 적용.
- store에 local playtest session 추가: player state, current node, route trace, message.
- 하단 `Playtest` 탭 추가: Persona/WorldFlag/ItemTag 편집, start/reset, choice 실행, auto-continue.
- HasItemTag/WorldFlagAtLeast/PersonaAtLeast 및 choice required/blocking flag를 UI에 pass/fail로 표시.
- SetWorldFlag/TakeItem/AdjustPersona outcome을 player state에 적용.
- route trace 클릭으로 노드 선택, 현재/trace 노드를 캔버스에서 하이라이트.
- 스모크: `pnpm --filter @ngf/web typecheck`, `pnpm --filter @ngf/web build`.

---

## Run 10 — Phase 7 Advanced Graph UX

- graph UX state 추가: branch groups, focus mode, condition filter, edge bundling, portal nodes.
- 선택 노드 collapse/lock 액션 및 drag-stop position 저장 추가.
- NPC별 branch lane layout 적용 추가.
- missing/hidden target을 portal node card로 표시.
- focus mode에서 선택/playtest current 기준 ancestor+descendant path 강조.
- condition filter에서 playtest state 기준 unavailable choice edge 숨김 및 choice row dim 처리.
- bundled edge view(step edge + wider interaction width) 토글 추가.
- 스모크: `pnpm --filter @ngf/web typecheck`, `pnpm --filter @ngf/web build`.

---

## Run 11 — Phase 8 Dynamic Schema Builder

- schema draft model 추가: entity, field, enum, validation rule, widget mapping, version/baseline.
- `Schema` 하단 탭 추가: entity/field/enum/rule 편집과 migration preview 제공.
- schema commit 액션 추가: local draft를 baseline으로 확정하고 version 증가.
- Inspector에 선택 노드 기준 schema-driven field summary 표시.
- 스모크: `pnpm --filter @ngf/web typecheck`, `pnpm --filter @ngf/web build`.

---

## Run 12 — Phase 9 AI Copilot MVP

- 하단 `Copilot` 탭 추가: browser session API key/model 입력, selected context, chat, review 영역.
- local draft copilot 응답 추가: validation explanation, schema suggestion, selected context summary.
- quick action 기반 patch proposal 생성:
  - selected node title 생성
  - selected node terminal choice 추가
  - missing target placeholder node 생성
  - empty required field draft fill
- `CopilotPatchOp` simulation + diff viewer + Reject/Apply 승인 플로우 추가.
- apply gate 추가: patch 적용 전 validation 재실행, error 증가 시 차단.
- 스모크: `pnpm --filter @ngf/web typecheck`, `pnpm --filter @ngf/web build`.

---

## Run 13 — Phase 10 Runtime Bundle and Game SDK

- `@ngf/runtime` 패키지 추가.
- normalized graph JSON export 추가: editor-only `position/uiState` 제거.
- runtime bundle generator 추가:
  - `format/version/profile`
  - `tables.nodeIds`, `tables.choiceIds`
  - numeric node/choice references
  - entry node index table
- TypeScript runtime SDK 추가:
  - entry resolver
  - node/choice lookup
  - requirement/choice evaluator
  - outcome applier
  - choice/auto advance helpers
- CLI `normalize` 명령 추가, CLI `bundle`을 runtime bundle 출력으로 변경.
- Unity C# adapter sketch 문서화: `docs/ngf/runtime-sdk.md`.
- 스모크: `pnpm --filter @ngf/runtime typecheck`, `pnpm --filter @ngf/runtime test`, `pnpm --filter @ngf/cli typecheck`.

---

## Run 14 — Phase 11 Collaboration and Versioning

- local collaboration model 추가:
  - snapshots
  - branches
  - review comments
  - audit log
  - local role permissions
- 하단 `Review` 탭 추가:
  - snapshot 생성/restore
  - branch 생성/전환
  - active diff 확인
  - node/workspace comment 작성 및 resolve
  - audit event 확인
- graph import/replace와 Copilot patch apply를 active branch/audit log에 연결.
- Copilot proposal apply는 `ai` actor로 기록해서 사용자 변경과 구분.
- local role(owner/editor/reviewer/viewer)에 따라 snapshot/comment/rollback/branch write action gate 적용.
- 스모크: `pnpm --filter @ngf/web typecheck`, `pnpm --filter @ngf/web build`.

---

## Run 15 — Phase 12 Graph Readability and Interaction

- node card readability 개선:
  - title/body/choice hierarchy 재정리
  - requirement/outcome/target chip 추가
  - issue severity badge/border 추가
  - choice handle hit area 확대
- edge readability 개선:
  - choice edge별 색상 분리
  - bezier 기본 routing + arrow marker
  - hover 시 edge label, source node, target node, source choice row 동시 highlight
- graph editing interaction 개선:
  - `onConnect`를 실제 `Choice.nextNodeId` / `autoNextNodeId` 변경에 연결
  - `onReconnect`로 기존 edge endpoint drag retarget 지원
  - edge delete로 choice target terminal 처리 또는 auto-next 해제
- retarget choice / auto-next 이벤트를 collaboration audit log에 기록.
- 스모크: `pnpm --filter @ngf/web typecheck`, `pnpm --filter @ngf/web build`, dev server 200.
