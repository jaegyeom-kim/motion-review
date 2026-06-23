# 로그인 + 멤버관리 + 댓글 알림 — 켜는 법

코드는 전부 들어가 있고 **꺼져 있다**(`VITE_REQUIRE_AUTH`가 없으면 지금처럼 익명 링크공유로 동작).
아래 단계를 끝내고 마지막에 플래그를 켜면 한 번에 전환된다.

대시보드/CLI 작업(=내가 못 하는 것)만 모았다. 순서대로.

---

## 1. Resend (이메일 발송) — 무료

매직링크 대신 **6자리 코드 로그인** + **댓글 알림 메일** 둘 다 Resend로 보낸다.

1. https://resend.com 가입.
2. **API Keys → Create** → 키 복사 (`re_...`). 한 번만 보이니 저장.
3. 발신 주소:
   - 테스트: 도메인 인증 없이 `onboarding@resend.dev` 사용 가능 (단 **가입한 본인 메일로만** 발송됨 → 팀 테스트엔 부족).
   - 실사용: **Domains → Add Domain** 으로 도메인(예: `vinylc.com`) 인증 후 `noreply@vinylc.com` 같은 주소 사용.

---

## 2. Supabase Auth 설정

대시보드: https://supabase.com/dashboard/project/rpshogtrepdyimzqumfo

1. **Authentication → Providers → Email**: `Enable` 켜기. (매직링크/OTP 공용. 우리는 OTP 코드 사용.)
2. **Authentication → Providers → Email → "Confirm email"**: 켜둬도 OTP 코드엔 영향 없음.
3. **Authentication → Email Templates**: 기본값으로 OK (OTP 코드는 `{{ .Token }}` 포함된 기본 템플릿이 들어감).
4. **커스텀 SMTP = Resend** (중요 — 기본 메일은 시간당 2~3통이라 코드가 안 옴):
   - **Project Settings → Authentication → SMTP Settings → Enable Custom SMTP**
   - Host: `smtp.resend.com` / Port: `465` / User: `resend` / Password: **Resend API 키**
   - Sender: 1번에서 정한 발신 주소.

> 닫힌 가입(초대된 계정만 로그인): 앱이 로그인 시 `shouldCreateUser:false`로 요청하므로 **초대 안 한 이메일은 자동 거부**된다. 별도 설정 불필요.

---

## 3. Edge Function 2개 배포

Supabase CLI 필요: `npm i -g supabase`, `supabase login`, `supabase link --project-ref rpshogtrepdyimzqumfo`

레포 루트에서:

```bash
# 댓글/답글 알림 (DB Webhook이 호출 → JWT 검증 끔)
supabase functions deploy notify-comment --no-verify-jwt

# 어드민 초대 (앱에서 호출 → 함수 안에서 관리자 검증)
supabase functions deploy admin-invite
```

함수 시크릿 설정(서버에만 저장, 클라 노출 X):

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  RESEND_FROM="Motion Review <noreply@vinylc.com>" \
  APP_URL="https://jaegyeom-kim.github.io/motion-review"
```

> `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 함수에 **자동 주입**하므로 직접 안 넣어도 된다.

> CLI 없이 하려면: 대시보드 **Edge Functions → Create** 에서 `supabase/functions/<name>/index.ts` 내용 붙여넣기 + **Secrets** 탭에서 위 값 입력.

---

## 4. 댓글 알림용 DB Webhook 생성

대시보드 **Database → Webhooks → Create a new hook**:

- Name: `notify-comment`
- Table: `public.comments`
- Events: **Insert** + **Update** 둘 다 체크 (Update = 답글 달림)
- Type: **Supabase Edge Functions** → `notify-comment` 선택
- (메서드 POST, 기본 헤더 그대로)

저장.

---

## 5. 스키마 컷오버 (RLS 잠그기)

> ⚠️ 이 단계부터 **익명 접속이 막힌다.** 로그인 안 하면 못 들어옴. 1~4 끝낸 뒤 실행.

대시보드 **SQL Editor**에 `supabase/schema-auth.sql` **전체 붙여넣고 Run.**
(profiles / project_members / notifications 생성 + 모든 테이블 authenticated 전용 + media 버킷 비공개 + Realtime 추가.)

---

## 6. 첫 관리자 만들기

1. **Authentication → Users → Add user** → 이메일 `gyeomotion@vinylc.com` 입력해 계정 생성.
   (또는 그 이메일로 앱에서 한 번 로그인 → profiles 행 자동 생성.)
2. **SQL Editor**에서 관리자로 승격:

```sql
update public.profiles
  set role = 'admin',
      data = jsonb_set(data, '{role}', '"admin"')
where email = 'gyeomotion@vinylc.com';
```

이제 그 계정으로 로그인하면 우상단 계정 메뉴에 **멤버 관리**가 보인다.

---

## 7. 플래그 켜고 배포

`.env.production` 에 한 줄 추가:

```
VITE_REQUIRE_AUTH=true
```

`git push` → GitHub Actions 자동 빌드 → 이제 사이트가 **로그인 필수**로 전환.

---

## 운영 흐름

- **멤버 추가**: 로그인 → 계정 메뉴 → 멤버 관리 → 이메일 초대. 초대된 사람은 로그인 화면에서 이메일 코드로 접속.
- **알림 대상**: 어드민이 멤버를 **프로젝트에 배정**하면, 그 프로젝트 댓글/답글 시 (작성자 제외) 배정 멤버에게 인앱 종 + 이메일.
- **역할**: 멤버 관리에서 멤버 ↔ 관리자 토글.

## 비용
- Supabase Free: Auth MAU 5만, Edge Function 50만 호출/월, Realtime 200동접 — 충분.
- Resend Free: 3,000통/월, 일 100통. 소규모 팀이면 넉넉.
- 전부 **0원**.

## 되돌리기
`.env.production`에서 `VITE_REQUIRE_AUTH` 줄 지우고 push → 다시 익명 모드.
(데이터 테이블 RLS는 `supabase/schema.sql` 다시 Run하면 익명 허용으로 복구.)
