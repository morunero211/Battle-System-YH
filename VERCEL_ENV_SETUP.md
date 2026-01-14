# Vercel 환경 변수 설정 가이드

## 🔐 Firebase Admin SDK 설정

Vercel 대시보드에서 환경 변수를 설정해야 합니다.

### 1. Firebase Admin SDK Private Key 준비

backend/.env.local 파일에 있는 Firebase 설정을 확인하세요:

```bash
cd backend
cat .env.local
```

### 2. Vercel 대시보드에서 환경 변수 추가

https://vercel.com/morunero211/battle-system-yh/settings/environment-variables

다음 환경 변수들을 추가하세요:

#### 필수 환경 변수:

1. **FIREBASE_PROJECT_ID**
   - Value: `{Firebase 프로젝트 ID}`
   - 예: `battle-system-yh`

2. **FIREBASE_CLIENT_EMAIL**
   - Value: `{Service Account 이메일}`
   - 예: `firebase-adminsdk-xxxxx@battle-system-yh.iam.gserviceaccount.com`

3. **FIREBASE_PRIVATE_KEY**
   - Value: `{Private Key 전체 내용}`
   - ⚠️ 중요: JSON에서 `"private_key"` 값을 복사 (줄바꿈 `\n` 포함)
   - 예: `-----BEGIN PRIVATE KEY-----\nMIIEvQIB...`

4. **NODE_ENV**
   - Value: `production`

5. **CORS_ORIGIN**
   - Value: `https://battle-system-yh.vercel.app`

### 3. 환경 변수 적용 범위

- Environment: **Production**, **Preview**, **Development** 모두 체크

### 4. 배포 완료 후 테스트

```bash
# Health check 테스트
curl https://battle-system-yh.vercel.app/api/health
```

정상 응답:
```json
{
  "status": "ok",
  "message": "양호후환 전투 시스템 API 서버 (Vercel Serverless)",
  "firebase": "✅ 연동됨",
  "timestamp": "2026-01-15T..."
}
```

## 🚨 주의사항

1. **FIREBASE_PRIVATE_KEY는 절대 GitHub에 커밋하지 마세요**
2. Vercel 환경 변수는 대시보드에서만 설정하세요
3. 환경 변수 추가 후 프로젝트를 다시 배포해야 적용됩니다

## 📝 다음 단계

환경 변수 설정 완료 후:
1. Vercel에서 자동으로 재배포됩니다 (약 2-3분 소요)
2. 배포 완료 알림을 기다립니다
3. https://battle-system-yh.vercel.app/api/health 접속하여 확인합니다

## 🔧 문제 해결

### Firebase 연동 안됨 (⚠️ 미연동)
- FIREBASE_PRIVATE_KEY에 `\n`이 제대로 포함되었는지 확인
- JSON 형식이 아닌 문자열로 입력했는지 확인
- Vercel 대시보드에서 환경 변수 재저장 후 재배포

### 404 에러
- Vercel 빌드 로그 확인
- `api/index.js` 파일이 제대로 배포되었는지 확인

### CORS 에러
- CORS_ORIGIN 환경 변수 확인
- 프론트엔드 도메인이 정확히 입력되었는지 확인
