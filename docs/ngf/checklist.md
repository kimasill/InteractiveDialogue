# NGF 구현 체크리스트 (설계서 기반)

이 문서는 사용자 설계서(대화/퀘스트/스토리 제작 프레임워크 청사진)를 **구현 항목 체크리스트**로 쪼개고,
현재 코드베이스에서 **어디까지 구현되었는지** 표시한다.

## 표기 규칙

- ✅ 완료: 코드/테스트/CLI 등으로 동작 확인됨
- 🟨 부분: 일부만 구현(핵심 스켈레톤/프로토타입/문서화만)
- ⬜ 미착수: 아직 구현 없음

## 현재 “구현된 것”의 기준(근거)

- 패키지
  - `packages/ngf-core/` — 타입/ID/그래프 파생
  - `packages/ngf-csv/` — 27컬럼 스키마 + CSV import/export + 테스트
  - `packages/ngf-validate/` — validation 엔진 + 테스트
  - `apps/ngf-cli/` — inspect/validate/round-trip/export/bundle 스모크 확인
- 샘플/픽스처
  - `assets/samples/NPC_Dialogue_Jijibo.csv`
- 런 로그
  - `docs/ngf/run-log.md`의 “Run 1 — Foundation slice”

---

## Phase 0. 요구사항 고정 및 샘플 데이터 정규화

- ✅ **CSV column 목록 확정** (27 columns)
- ✅ **Node / Choice / Requirement / Outcome 모델 정의**
- ✅ **CSV row → 내부 graph model 변환 규칙 정의** (그룹핑 + order 폴딩)
- ✅ **내부 graph model → CSV row export 규칙 정의** (rowCount = max(req,outcome,1))
- 🟨 **nodeTitle 필드 추가 여부 확정**
  - `@ngf/core` 타입에는 `nodeTitle?` 존재
  - CSV 스키마(27컬럼)에는 컬럼이 없어서 실사용은 Run 2/스키마 v2에서 결정 필요
- ✅ **NodeAutoNextNodeIndex 의미 정리**
  - 현재 구현: `autoNextNodeId` 단일 필드로 처리, `-1`은 no-link sentinel
- 🟨 **Sample Normalized JSON**
  - CLI `bundle`이 `NarrativeGraph` JSON을 출력(“runtime bundle” 형태는 Phase 10에서 별도)

---

## Phase 1. Core Data Layer 구현 (DB/서비스)

> 설계서의 “Workspace/Schema/GraphNode/GraphEdge CRUD + DB 저장” 단계
>
> 구현 패키지: `packages/ngf-db` (node:sqlite) · `apps/ngf-server` (Hono REST)

- ✅ Workspace CRUD
- ✅ SchemaVersion CRUD (버전/마이그레이션 포함)
- ✅ GraphNode CRUD (DB) — upsert/delete/get/list
- ✅ GraphEdge CRUD (DB) — edges는 Choice.nextNodeId에서 파생; 별도 행 불필요
- ✅ node position 저장/복원 (DB) — `pos_x/pos_y` 컬럼 + `PUT /nodes/:id/position`
- ✅ basic patch operation (서버 적용/검증 포함) — `PatchOp` 14종 + `POST /patch`
- ✅ import snapshot 저장 — CSV import 시 자동 스냅샷, `GET/DELETE /snapshots`
- ✅ 필수 API 엔드포인트(REST) 구현
  - `GET/POST /workspaces`, `GET/PATCH/DELETE /workspaces/:id`
  - `GET/POST /workspaces/:id/schema-versions`, `DELETE ./:id`
  - `GET /workspaces/:id/nodes`, `GET/DELETE ./:nodeId`, `PUT ./:nodeId/position`
  - `POST /workspaces/:id/patch` — 배치 그래프 패치
  - `GET /workspaces/:id/graph` — 전체 그래프 로드
  - `POST /workspaces/:id/import-csv` — CSV → DB upsert + snapshot
  - `GET /workspaces/:id/export-csv` — DB → CSV
  - `GET /workspaces/:id/validate` — 검증 리포트
  - `GET/DELETE /workspaces/:id/snapshots`

---

## Phase 2. Graph Canvas MVP (Web UI)

- ✅ Graph Canvas (React Flow 등) — `apps/ngf-web`
- ✅ Node Card (Compact/Normal에 가까운 단일 카드) — `DialogueNodeCard`
- ✅ Choice row 표시
- ✅ Choice별 edge port 표시 (sourceHandle)
- ✅ ChoiceNextNodeIndex 기반 edge 표시
- ✅ node drag/drop + zoom/pan + minimap
- ✅ selected node highlight (React Flow 기본 + 선택 상태 스타일)
- ✅ auto layout MVP
  - `computeLayout()` 기반 초기 배치 + 툴바 `Auto Layout` 재배치 버튼 구현
  - 고급 레이아웃/그룹/브랜치 lane은 Phase 7 범위로 유지
- ✅ CSV Drop / Import UX
  - 드롭존 + 드래그 상태 표시 + 툴바 `Import CSV` 버튼 구현
  - CSV 파일 판별/읽기/issue summary는 공통 유틸로 처리
  - 서버/DB 연동 import는 별도

---

## Phase 3. Inspector 및 Inline Editing

- ✅ Node Inspector (읽기/편집)
  - title/speaker/dialogue/guard flag/auto-next local graph editing
- ✅ Choice Inspector (읽기/편집)
  - choice text/next target/required flag/blocking flag local graph editing
- ✅ Requirement editor (편집)
  - type/order/tag/threshold editing + add/remove
- ✅ Outcome editor (편집)
  - type/order/world flag/int/float/tag payload/string payload editing + add/remove
- ✅ Simple Mode / Raw Mode UI 토글(편집/필드 매핑 포함)
  - Simple form + selected node Raw JSON apply
- ✅ inline title editing
- ✅ inline dialogue editing
- ✅ inline choice text editing
  - 서버/DB 저장은 후속 API 연결 슬라이스에서 처리

---

## Phase 4. CSV Export 및 Table View

- ✅ CSV export 엔진(라이브러리)
  - `@ngf/csv exportCsv/exportRows`
- ✅ Export Profile(스키마 기반 컬럼/타입 매핑)
  - `NPC Dialogue v1` 27컬럼 profile을 하단 패널에 표시
- ✅ CSV preview UI
  - 현재 scope 기준 CSV preview + 전체/스코프 CSV 다운로드
- ✅ Bottom Panel Table View
  - `exportRows()` 기반 editable row projection
- ✅ 스코프(선택 NPC/branch) 기반 table 필터
  - 전체 / NPC별 / 선택 노드 reachable branch
- ✅ bulk edit / copy-paste
  - TSV copy/paste, 셀 단위 paste, `Apply Table`로 graph 재정규화

---

## Phase 5. Validation Engine

### 라이브러리(엔진)

- ✅ missing node validation (broken choice edge)
- ✅ broken edge validation (choice / auto-continue)
- 🟨 enum validation
  - runtime graph의 requirement/outcome enum 값 검증 추가
  - schema-driven 일반화는 Phase 8 범위로 유지
- ✅ required field validation (speakerName/dialogueText/choiceText 빈 값 warning)
- ✅ unreachable node detection (entry 명시 시)
- ✅ dead-end detection (info)
- ✅ flag usage validation(휴리스틱)
  - `WorldFlagAtLeast`/`requiredWorldFlag`가 쓰였는데 `SetWorldFlag` outcome이 없으면 warning
- 🟨 item requirement validation(획득 경로 분석)
  - `HasItemTag` 요구값이 어떤 `TakeItem` outcome에서도 생성되지 않으면 warning
  - 경로 민감 분석은 후속 고급 validation 범위
- 🟨 persona threshold validation(경로 분석/충돌)
  - 알려진 양수 `AdjustPersona` 합산으로 threshold 도달 가능성 휴리스틱 warning
  - 경로/분기 충돌 분석은 후속 고급 validation 범위

### UI 연동(“바로 고치기”)

- ✅ issue에 fixes 제안 포함
  - `@ngf/validate`는 `fixes[]`를 제공(예: create_node/change_target/remove_choice/create_setter_outcome)
- ✅ Validation Panel UI + 버튼 실행(실제 패치 적용)
  - 하단 `Issues` 탭에서 issue 목록/요약/노드 선택/fix 적용 지원

---

## Phase 6. Playtest Simulator

- ✅ 타입 레벨 PlayerState 정의(`@ngf/core`)
- ✅ Player State editor UI
  - 하단 `Playtest` 탭에서 local session 상태 편집/초기화
- ✅ WorldFlag/ItemTag/Persona 편집 UI
  - flag value, item tag, persona 직접 조정
- ✅ dialogue start resolver
  - 선택 노드 우선, 불가능하면 현재 player state에서 활성 entry 자동 선택
- ✅ available choice resolver (requirements 평가)
  - choice flag gate/blocking flag + HasItemTag/WorldFlagAtLeast/PersonaAtLeast 평가
- ✅ outcome applier (playerState 변화)
  - SetWorldFlag/TakeItem/AdjustPersona 적용
- ✅ route trace + canvas highlight 연동
  - 현재 노드/trace 노드를 React Flow 캔버스에 하이라이트

---

## Phase 7. Advanced Graph UX

- ✅ Branch Group
  - NPC/group label badge 표시 토글
- ✅ Collapse Subgraph
  - 선택 노드 기준 descendant 숨김/복원
- ✅ Portal Node
  - 누락/숨김 target을 portal card로 시각화
- ✅ Focus Mode / Path Highlight
  - 선택 노드 또는 playtest current node 기준 ancestor/descendant path 강조, 나머지 dim
- ✅ Branch Lane
  - NPC별 lane layout 적용 버튼
- ✅ locked position
  - 선택 노드 lock/unlock, lock된 노드는 drag position 저장 차단
- ✅ edge bundling
  - bundled edge view 토글(step edge + 넓은 hit area)
- ✅ condition filter view
  - 현재 playtest player state 기준 unavailable choice edge 숨김 + choice row dim

---

## Phase 8. Dynamic Schema Builder

- ✅ Entity type editor
  - 하단 `Schema` 탭에서 entity 추가/수정/삭제
- ✅ Field editor
  - field 추가/수정/삭제 + type/widget/enum binding 설정
- ✅ enum editor
  - enum 추가/수정/삭제 + value 편집
- ✅ validation rule editor
  - required/min/max/pattern/enum rule 추가/수정/삭제
- ✅ UI widget mapping
  - field type별 기본 widget + 수동 widget override
- ✅ schema versioning
  - local draft/baseline commit으로 version 증가
- ✅ migration preview
  - baseline 대비 entity/field/enum add/remove/update preview
- 🟨 schema-driven form rendering(Inspector 자동 생성)
  - Inspector에서 선택 노드의 schema-driven field summary 표시
  - 완전 자동 편집 form 생성은 후속 schema/runtime 연동 범위

---

## Phase 9. AI Copilot MVP

- 🟨 API key input(브라우저/서버 vault)
  - 브라우저 세션 입력 UI 구현
  - 서버 vault/실제 provider 호출은 후속 연동 범위
- ✅ selected context provider
  - 선택 노드, choices, validation issue, schema version context 표시
- ✅ AI chat panel
  - local draft copilot 응답 패널 구현
- ✅ node/branch quick actions
  - node title, terminal choice, missing target repair, empty draft fill action
- ✅ schema suggestion
  - schema required rule / nodeRef / enum 개선 제안 표시
- ✅ validation explanation
  - validation issue별 설명 제공
- ✅ patch proposal 생성(GraphPatch)
  - `CopilotPatchOp` proposal 생성 + patch simulation
- ✅ patch diff viewer
  - proposal op diff list 표시
- ✅ user approval flow
  - Reject / Apply 승인 플로우
- ✅ validation 통과 조건으로 apply gate
  - patch 적용 전 validation을 재실행하고 error 증가 시 차단

---

## Phase 10. Runtime Bundle 및 Game SDK

- ✅ bundle “모양”의 프리뷰
  - `@ngf/runtime buildRuntimeBundle()`로 엔진 친화 runtime bundle 생성
- ✅ normalized JSON export(프로파일 기반)
  - `exportNormalizedJson()` + CLI `normalize`
- ✅ runtime bundle generator(엔트리/압축/ID 테이블 등)
  - `tables.nodeIds`, `tables.choiceIds`, numeric node/choice references, `entries`
- ✅ dialogue resolver
  - `resolveRuntimeEntry()`, `getRuntimeNode()`, `advanceRuntimeChoice()`, `advanceRuntimeAuto()`
- ✅ requirement evaluator
  - `evaluateRuntimeRequirement()`, `evaluateRuntimeChoice()`
- ✅ outcome applier
  - `applyRuntimeOutcomes()`
- ✅ TypeScript SDK
  - `@ngf/runtime` package
- 🟨 Unity/C# 또는 Unreal 어댑터 설계/샘플
  - `docs/ngf/runtime-sdk.md`에 Unity C# adapter sketch 추가
- ✅ Playtest 결과와 runtime 결과 동치성 테스트
  - runtime test에서 outcome/state semantics를 playtest expectation과 맞춤

---

## Phase 11. Collaboration / Versioning

- ✅ snapshot
  - 하단 `Review` 탭에서 local graph snapshot 생성
- ✅ diff
  - active branch 최신 snapshot 대비 added/changed/removed diff 표시
- ✅ rollback
  - snapshot restore로 graph/report 복원
- ✅ branch/version
  - local branch 생성/전환 + branch별 graph 보존
- ✅ audit log
  - import/replace/snapshot/rollback/branch/comment/Copilot apply 이벤트 기록
- 🟨 permissions
  - local role(owner/editor/reviewer/viewer)과 Review 탭 write gate 구현
  - 서버 권한/멀티유저 enforce는 후속 범위
- ✅ comment/review
  - node/workspace review comment + resolve flow
- ✅ AI patch vs 사용자 patch 구분/승인 워크플로
  - Copilot proposal apply는 `ai` actor audit로 기록
  - user snapshot/rollback/comment와 actor 분리

---

## Phase 12. Graph Readability & Interaction

- ✅ node card readability pass
  - header/title/body/choice metadata hierarchy 재정리
  - requirement/outcome/target chip 표시
  - issue severity badge 및 border 표시
- ✅ edge readability pass
  - choice edge 색상 분리, bezier 기본 routing, arrow marker, hover label
  - active edge source/target node 동시 highlight
- ✅ visual color system
  - NPC/choice 색상 palette, issue severity, playtest, edge active state 분리
- ✅ edge retarget interaction
  - 기존 choice edge endpoint를 drag해서 다른 node에 reconnect
  - 새 handle 연결 시 `Choice.nextNodeId` 갱신
  - edge delete 시 choice target terminal 처리
- ✅ auto edge interaction
  - auto-continue edge reconnect/delete로 `autoNextNodeId` 갱신/해제
- ✅ audit integration
  - retarget choice / auto-next 이벤트 audit log 기록

---

## MVP 범위 체크

### MVP 1: CSV 기반 Graph Editor

- ✅ CSV import(라이브러리)
- ✅ 내부 graph model 변환(정규화)
- ✅ Graph Canvas
- ✅ Compact / Normal Node Card
- ✅ Choice edge port (UI)
- ✅ Node drag/drop (UI)
- ✅ Inspector (UI)
- ✅ CSV export(라이브러리)

### MVP 2: 제작 생산성 강화

- ✅ Inline editing
- ✅ Table View
- ✅ Validation Engine + UI
- ✅ Playtest View
- ✅ Focus Mode
- 🟨 Auto Layout
- ✅ Branch Collapse

### MVP 3: Dynamic Schema

- 🟨 Schema Builder MVP

### MVP 4: AI Copilot

- 🟨 AI Copilot MVP

### MVP 5: Runtime SDK

- 🟨 Runtime SDK MVP

