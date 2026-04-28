# Narrative Graph Framework (NGF)

> 게임/스토리/퀘스트/대화 데이터를 스키마 기반으로 설계하고, 그래프 UI에서 빠르게
> 편집하고, CSV/JSON으로 export하며, AI Agent가 생성·검증·정리를 돕는 제작 프레임워크.

전체 청사진은 워크스페이스 루트의 사용자 문서(요청 본문)를 참조한다.
이 디렉터리는 **구현 진행 상황과 런별 설계 결정**을 보관한다.

## 패키지 레이아웃

| 경로                       | 역할                                                |
| -------------------------- | --------------------------------------------------- |
| `packages/ngf-core/`       | 데이터 모델 정의 (DialogueNode/Choice/Req/Outcome)  |
| `packages/ngf-csv/`        | CSV ↔ NarrativeGraph 정규화/역정규화                |
| `packages/ngf-validate/`   | 그래프/스키마/조건 validation                        |
| `packages/ngf-runtime/`    | 런타임 번들 생성 + TypeScript Game SDK              |
| `apps/ngf-cli/`            | `ngf` CLI (inspect / validate / round-trip / bundle)|

> 기존 `@acp/*` 패키지는 별개의 Agent Context Plane 도메인이며 NGF와 독립이다.

## 빠른 사용법

```bash
# 의존성 설치 (모노레포 루트)
pnpm install

# 샘플 CSV 인스펙트
npx tsx apps/ngf-cli/src/main.ts inspect assets/samples/NPC_Dialogue_Jijibo.csv

# validation
npx tsx apps/ngf-cli/src/main.ts validate assets/samples/NPC_Dialogue_Jijibo.csv --entry 5

# 라운드트립 (import → export → re-import 비교)
npx tsx apps/ngf-cli/src/main.ts round-trip assets/samples/NPC_Dialogue_Jijibo.csv

# 정규화 JSON
npx tsx apps/ngf-cli/src/main.ts normalize assets/samples/NPC_Dialogue_Jijibo.csv Jijibo -o /tmp/jijibo.normalized.json

# 런타임 번들
npx tsx apps/ngf-cli/src/main.ts bundle assets/samples/NPC_Dialogue_Jijibo.csv Jijibo --entry 5 -o /tmp/jijibo.runtime.json

# 테스트
pnpm -C packages/ngf-csv test
pnpm -C packages/ngf-validate test
pnpm -C packages/ngf-runtime test
```
