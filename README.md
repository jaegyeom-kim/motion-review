# Motion Review

멀티 포맷 **리뷰 · 버전 관리 · 협업** 웹앱. Lottie뿐 아니라 이미지·비디오·PDF·오디오를 한 워크스페이스에서 버전으로 쌓고, 프레임/좌표에 **핀(코멘트)** 을 남기고, 브랜치로 피드백 라인을 분리한다. Frame.io 버전 스택 · LottieFiles DAM · Figma 브랜치 워크플로를 조사해 핵심 패턴만 추렸다.

로컬(IndexedDB)에서 서버 없이도 돌고, Supabase를 붙이면 **링크 공유 실시간 협업**으로 확장된다. GitHub Pages에 정적 배포된다.

> 라이브: https://jaegyeom-kim.github.io/motion-review/

## 빠른 시작

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 프로덕션 빌드 (dist/)
npm run typecheck  # 타입 검사만
```

환경변수가 없으면 **완전 로컬 모드**(IndexedDB)로 동작하고, 첫 실행 시 데모 프로젝트(Lottie 스피너 + 샘플 이미지 + 피드백)가 자동 생성된다. 상단 **데모 초기화**로 리셋.

## 동작 모드

`.env.local`(개발) / `.env.production`(빌드)의 환경변수로 결정된다. `.env.example` 참고.

| 모드 | 환경변수 | 설명 |
|------|----------|------|
| **로컬** | (없음) | IndexedDB. 서버 불필요, 오프라인 동작. |
| **링크 공유 (익명)** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | URL 아는 사람 모두 같은 워크스페이스. 실시간 동기화. |
| **하이브리드** | + `VITE_AUTH_OPTIONAL=true` | 익명 입장 유지 + **로그인한 사람만** 알림 수신. |
| **로그인 필수** | + `VITE_REQUIRE_AUTH=true` | 전체 게이트. 멤버만 접근. RLS 잠금(`schema-auth.sql`). |

인증/알림 켜는 전체 절차는 [`SETUP-auth.md`](SETUP-auth.md) 참고.

## 무엇을 할 수 있나

### 애셋 · 프로젝트
- **멀티 포맷** — Lottie(`.json`/`.lottie`) · 이미지 · 비디오 · PDF · 오디오. 업로드 시 종류 자동 감지 + 메타 추출(해상도/fps/길이/레이어/페이지) + 썸네일.
- **프로젝트** — 애셋을 프로젝트로 묶고 색·설명 관리. 좌측 레일에서 형식/리뷰 상태로 필터.
- **드래그 업로드** — 프로젝트 폴더에 파일을 끌어다 놓으면 진행률 표시하며 일괄 업로드.
- **카드 미리보기** — 카드 호버 시 Frame.io식 스크럽 미리보기(영상·Lottie).
- **리뷰 상태** — 애셋별 상태(초안/리뷰중/수정필요/승인). 프로젝트 카드·그리드에서 인라인 변경.
- **선택 다운로드** — 애셋 다중 선택 → ZIP 내보내기(진행 모달). 1개 선택 시 원본 파일 그대로.

### 리뷰 · 버전
- **버전 스택** — 같은 애셋에 새 파일을 올리면 버전이 쌓임(덮어쓰기 X). 커밋 메시지·작성자·시간 기록.
- **브랜치** (Lottie) — 임의 버전에서 분기해 독립 피드백 라인 생성. 버전 그래프에 레인 표시.
- **핀 코멘트** — 캔버스 클릭으로 핀 배치. 시간 기반(Lottie/영상/오디오)은 `프레임`, 공간 기반(이미지/PDF)은 `x,y`에 앵커. 드래그로 이동. 핀 클릭 → 해당 코멘트 + 시점으로 점프. 호버 시 내용 미리보기.
- **상태 + 태그 + 수정** — 코멘트마다 상태(열림/진행중/해결됨/보류)·태그(수정/타이밍/색상/셰이프/이징/질문/아이디어). **내용·태그 인라인 수정** 가능. 답글 스레드.
- **타임라인** — 스크럽, 재생/정지, 프레임 이동, 속도(0.25~2×), 반복. 코멘트 마커 클릭 → 프레임 점프.
- **비교 모드** — 두 버전 동기 재생. 나란히 / 겹치기(와이프·불투명도). 영상은 듀얼 재생.
- **승인 게이트** — 버전별 승인. 미해결 피드백 시 경고.

### 협업 · 알림 (클라우드)
- **실시간 동기화** — 프로젝트/애셋/버전/코멘트 변경이 Supabase Realtime으로 즉시 반영.
- **멤버 관리** (`/admin`, 관리자) — 이메일 초대, 역할(멤버/관리자), 프로젝트별 배정.
- **댓글 알림** — 새 댓글/답글 시 배정 멤버에게 **인앱 종 + 실시간 토스트 + 이메일**(Resend). 작성자 본인 제외.
- **로그인** — 이메일 6자리 코드(매직링크 대신 — 정적 호스팅 + HashRouter 호환).

## 키보드

| 키 | 동작 |
|----|------|
| `Space` | 재생/일시정지 |
| `←` / `→` | 1프레임 이동 |
| `Shift + ←/→` | 10프레임 이동 |

## 스택

- **React 18 + TypeScript + Vite** · **HashRouter** (정적 서브패스 배포용)
- **zustand** — 상태(파생 배열은 `useShallow`로 안정화)
- **@lottiefiles/dotlottie-web (ThorVG, WASM)** — Lottie 라이브 렌더. 단일 rAF 플레이헤드 클럭이 모든 캔버스를 구동 → 비교 모드 동기화가 공짜. (`lottie-web`은 썸네일 렌더에만 사용)
- **idb** — IndexedDB 래퍼(로컬 모드 저장소)
- **@supabase/supabase-js** — 클라우드 모드: jsonb 도큐먼트 테이블 + 공개/비공개 Storage + Realtime + Auth
- **fflate** — `.lottie` 해제 · ZIP 내보내기 · 이미지 인라인

백엔드는 `lib/backend.ts`가 환경변수로 로컬(IndexedDB) / 클라우드(Supabase)를 투명하게 선택한다.

## 구조

```
src/
  types.ts              도메인 모델 (Project/Asset/Branch/Version/Comment, Profile/멤버/알림)
  lib/
    db.ts               IndexedDB 스토어 + 인덱스 + cascade (로컬)
    cloud.ts            Supabase 데이터 레이어 (클라우드, db.ts와 동일 API)
    backend.ts          로컬/클라우드 선택 + 통합 API 재노출
    supabase.ts         클라이언트 + cloudEnabled / requireAuth / authEnabled 플래그
    auth.ts             이메일 OTP 로그인, 세션, 프로필
    media.ts            업로드 파서(종류 감지·메타·썸네일·fps 측정), 비디오 업로드 가드
    lottie.ts           Lottie 파싱(.json/.lottie), 썸네일, 이미지 인라인
    preview.ts          카드 호버 스크럽 미리보기 로더
    bundle.ts           프로젝트/선택 애셋 ZIP·번들 내보내기/가져오기
    labels.ts           태그/상태 색·라벨, 타임코드/바이트 포맷
  store/useStore.ts     zustand 스토어 + 액션 + 인증/알림 + 셀렉터
  hooks/                usePlayback(rAF 클럭) · useFitBox(contain 박스)
  components/           LottieStage · MediaPinStage · VideoCanvas · PdfStage ·
                        AudioStage · CompareView · MediaCompare · CommentPanel ·
                        CommentCard · NotificationBell · NotificationToaster ·
                        AccountMenu · AuthControls · AssetThumb · UploadDialog 등
  pages/
    ProjectsHome.tsx    프로젝트 그리드
    ProjectView.tsx     애셋 그리드 + 레일 + 다중선택 + 드래그 업로드
    Workspace.tsx       단일 영속 플레이어 워크스페이스(종류별 스테이지 디스패치)
    Admin.tsx           멤버 관리(초대/역할/프로젝트 배정)
    Login.tsx           이메일 코드 로그인
supabase/
  schema.sql            익명 링크공유 스키마(RLS 익명 개방)
  schema-auth.sql       로그인 필수 컷오버(RLS authenticated 잠금)
  schema-auth-hybrid.sql  하이브리드(익명 유지 + 인증 테이블 추가)
  functions/
    notify-comment/     댓글/답글 알림 팬아웃(인앱 + Resend 이메일)
    admin-invite/       관리자 멤버 초대(계정 생성 + 프로필)
```

## 데이터 모델 한눈에

```
Project ──< Asset ──< Branch ──< Version ──< Comment(핀)
              │                                └─ frame | x,y + layerName + tag + status + replies
              └─ kind (lottie|image|video|pdf|audio) · status · thumbnail
```

- **Version**: 불변 스냅샷. Lottie는 파싱 JSON, 그 외는 원본 파일(Blob)을 blob 스토어/Storage에 보관.
- **Branch**: 특정 버전을 복제해 시작하는 작업 라인(Lottie). 자체 버전 substack + 핀.
- **Comment**: 특정 버전에 귀속. 시간 기반은 `frame`, 공간 기반은 `x,y` 앵커.

## 배포

`main`에 push하면 GitHub Actions가 빌드 → GitHub Pages 배포(`.github/workflows/deploy.yml`). Vite `base: './'` + HashRouter로 서브패스에서 동작.

## 알려진 한계 / 다음 단계

- **비디오 업로드**는 클라우드(무료 티어 서버)에서 임시 비활성 — 로컬에선 가능. 추후 지원 예정.
- 핀의 버전 간 자동 재앵커(레이어 id 기반 outdated 감지) 미구현.
- 실제 머지(브랜치→main 구조 병합) 미구현 — 분기 + 비교까지.
- 로그인 필수 모드의 프로젝트별 **하드 데이터 격리**(RLS 프로젝트 스코프)는 미구현 — 현재 로그인 멤버는 워크스페이스 공유. 멤버 배정은 알림 타겟팅·조직화에 사용.
- JSON 구조 diff(레이어/키프레임 단위) 미구현.
```
