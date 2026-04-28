# InteractiveDialogue (NGF 기반)

`kimasill/InteractiveDialogue`는 Narrative Graph Framework(NGF)를 기반으로 한 **대화 그래프 편집/검증/실행** 모노레포입니다.

- GitHub: `https://github.com/kimasill/InteractiveDialogue`

## 패키지

| 경로 | 설명 |
|------|------|
| `packages/ngf-core` | 도메인 타입, ID 규칙, `deriveEdges` |
| `packages/ngf-csv` | 27열 NPC 대화 CSV import/export |
| `packages/ngf-validate` | 그래프 검증(끊긴 엣지, 도달성 등) |
| `packages/ngf-db` | SQLite 영속 계층 |
| `packages/ngf-runtime` | 런타임 번들 / SDK |
| `apps/ngf-cli` | `ngf` CLI |
| `apps/ngf-web` | Vite + React + React Flow 워크벤치 |
| `apps/ngf-server` | Hono + `node:sqlite` REST API |

## 요구 사항

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+

## 빠른 시작

```bash
pnpm install
pnpm test
pnpm typecheck
```

### CLI

```bash
npx tsx apps/ngf-cli/src/main.ts inspect assets/samples/NPC_Dialogue_Jijibo.csv
npx tsx apps/ngf-cli/src/main.ts validate assets/samples/NPC_Dialogue_Jijibo.csv --entry 5
```

### 웹 UI

```bash
pnpm -C apps/ngf-web dev
```

### API 서버

```bash
pnpm -C apps/ngf-server dev
```

## 샘플 데이터

`assets/samples/NPC_Dialogue_Jijibo.csv` — 합성 예시(라운드트립·검증 테스트에 사용).

## 문서

`docs/ngf/` — 런 로그·설계 메모.

## 라이선스

MIT — `LICENSE` 파일 참고.

## GitHub에 푸시하는 방법

이 레포는 `https://github.com/kimasill/InteractiveDialogue`로 퍼블리시하는 것을 전제로 합니다.

```bash
cd narrative-graph-framework
git remote add origin https://github.com/kimasill/InteractiveDialogue.git
git branch -M main
git push -u origin main
```

SSH를 쓰는 경우:

```bash
git remote add origin git@github.com:kimasill/InteractiveDialogue.git
git push -u origin main
```
