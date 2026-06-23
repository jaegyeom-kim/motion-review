# Lottie Commenter

Lottie 애니메이션 **버전 관리 + 브랜치식 피드백** 웹앱. LottieFiles DAM · Figma 브랜치 · Frame.io 버전 스택 · Abstract 워크플로를 조사해 핵심 패턴만 추려 만든 클라이언트 전용(서버리스) 도구.

핵심 목적은 **버전 관리** — 버전을 쌓고, 수정이 필요한 부분을 **핀(태그)** 으로 남기고, 브랜치로 별도 피드백 라인을 분리한다.

## 빠른 시작

```bash
npm install
npm run dev      # http://localhost:5173
```

첫 실행 시 데모 애니메이션(로딩 스피너 v1/v2 + 샘플 피드백)이 자동 생성된다. 상단 **데모 초기화** 버튼으로 언제든 리셋.

```bash
npm run build       # 프로덕션 빌드 (dist/)
npm run typecheck   # 타입 검사만
```

## 무엇을 할 수 있나

- **버전 스택** — `.json` / `.lottie`(dotLottie) 업로드 → 버전이 쌓임(덮어쓰기 X). 버전마다 커밋 메시지·작성자·시간·메타(프레임/fps/레이어).
- **브랜치** — 임의 버전에서 분기해 독립 피드백 라인 생성. main은 그대로 유지. 버전 그래프에 레인으로 표시.
- **트리플 앵커 핀** — 캔버스 클릭으로 핀 배치. 핀은 `(프레임 + x,y 좌표 + 대상 레이어)` 3중 앵커. 드래그로 위치 이동.
- **상태머신 + 태그** — 핀마다 상태(열림/진행중/해결됨/보류)와 태그(수정/타이밍/색상/셰이프/이징/질문/아이디어). 답글 스레드.
- **타임라인** — 프레임 스크럽, 재생/일시정지, 프레임 단위 이동, 속도(0.25~2×), 반복. 타임라인 위에 코멘트 마커 → 클릭하면 해당 프레임으로 점프.
- **비교 모드** — 두 버전을 **동기 재생**(같은 프레임). 나란히 보기 + 겹치기(어니언스킨, 불투명도 슬라이더). "이전 라운드 수정이 반영됐나?" 확인용.
- **승인 게이트** — 버전별 승인. 미해결 피드백이 남아 있으면 승인 시 경고.
- **내보내기/가져오기** — 프로젝트 전체를 `.json` 번들로 백업·핸드오프(id 자동 리매핑).

## 키보드

| 키 | 동작 |
|----|------|
| `Space` | 재생/일시정지 |
| `←` / `→` | 1프레임 이동 |
| `Shift + ←/→` | 10프레임 이동 |

## 스택

- **React 18 + TypeScript + Vite**
- **zustand** — 상태(파생 배열 셀렉터는 `useShallow`로 안정화)
- **idb** — IndexedDB 래퍼. 모든 데이터(애셋·브랜치·버전·애니메이션 JSON·핀)는 브라우저에 저장. 서버 없음, 오프라인 동작.
- **lottie-web** — SVG 렌더. 재생은 단일 rAF 플레이헤드 클럭이 N개 캔버스를 구동 → 비교 모드 동기화가 공짜.
- **fflate** — `.lottie` 압축 해제.

## 구조

```
src/
  types.ts              도메인 모델 (Asset/Branch/Version/Comment)
  lib/
    db.ts               IndexedDB 스토어 + 인덱스 + cascade delete
    lottie.ts           파일 파싱(.json/.lottie), 메타 추출, 썸네일 렌더
    bundle.ts           프로젝트 내보내기/가져오기 (id 리매핑)
    demoLottie.ts       유효한 bodymovin JSON 생성 (데모 시드용)
    labels.ts           태그/상태 색·라벨, 타임코드/바이트 포맷
  store/useStore.ts     zustand 스토어 + 액션 + 셀렉터
  hooks/
    usePlayback.ts      rAF 플레이헤드 클럭
    useFitBox.ts        애니 비율에 맞춘 contain 박스(핀 좌표 정렬용)
  components/           LottieStage · PlayerControls · VersionGraph ·
                        CommentPanel · CompareView · UploadDialog 등
  pages/
    Dashboard.tsx       애셋 그리드
    Workspace.tsx       단일 영속 플레이어 워크스페이스
```

## 데이터 모델 한눈에

```
Asset ──< Branch ──< Version ──< Comment(핀)
                                   └─ frame + x,y + layerName + status + tag + replies
```

- **Version**: 불변 스냅샷. 전체 Lottie JSON을 blob 스토어에 보관.
- **Branch**: 특정 버전을 복제해 시작하는 작업 라인. 자체 버전 substack + 자체 핀.
- **Comment**: 특정 버전에 귀속. 비교 모드에서 두 버전의 핀을 함께 확인.

## 알려진 한계 (다음 단계)

- 핀의 버전 간 자동 재앵커(레이어 id 기반 outdated 감지)는 미구현 — 현재 핀은 버전에 귀속.
- 실제 머지(브랜치→main 구조 병합)는 미구현 — 분기 + 비교까지.
- 멀티유저 협업·공유 링크는 서버가 필요(현재 단일 사용자 로컬).
- JSON 구조 diff(레이어/키프레임 단위) 미구현.
