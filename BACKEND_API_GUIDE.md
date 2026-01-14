# 백엔드 API 가이드

## 개요

양호후환 전투 시스템의 백엔드 API는 Node.js + Express로 구성되며, Firebase Firestore와 통합되어 있습니다.

- **포트**: 3000
- **환경**: Development (localhost:8000 CORS 허용)
- **저장소**: Firestore (또는 메모리 폴백)

---

## 서버 시작

```bash
cd backend
npm install
npm start
```

서버가 http://localhost:3000 에서 시작됩니다.

---

## API 엔드포인트

### 1️⃣ Health Check

**`GET /api/health`**

서버 상태 및 Firebase 연동 상태 확인

**Response:**
```json
{
  "status": "ok",
  "message": "양호후환 전투 시스템 API 서버",
  "firebase": "✅ 연동됨 또는 ⚠️ 미연동 (메모리 폴백)",
  "timestamp": "2026-01-13T07:45:30.227Z"
}
```

**Example:**
```bash
curl http://localhost:3000/api/health
```

---

### 2️⃣ 전투 시뮬레이션

**`POST /api/battles/simulate`**

d100 주사위 기반 공격/회피/크리티컬 판정 수행

**Request Body:**
```json
{
  "attacker": {
    "name": "공격자_이름",
    "attack": 8,
    "skill": 7,
    "agility": 5
  },
  "defender": {
    "name": "방어자_이름",
    "hp": 100,
    "defense": 4,
    "agility": 4
  }
}
```

**Parameters:**
- `attack`: 공격력 (1-10)
- `skill`: 기술력 (1-10, 크리티컬 확률)
- `agility`: 민첩성 (1-10, 회피율)
- `defense`: 방어력 (1-10, 피해 감소)

**Response:**
```json
{
  "success": true,
  "result": "hit",  // "hit", "miss", "dodge", "critical"
  "damage": 35,
  "log": ["전투 상세 로그..."],
  "defenderHp": 65
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/battles/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "attacker": {
      "name": "Hero",
      "attack": 8,
      "skill": 7,
      "agility": 5
    },
    "defender": {
      "name": "Monster",
      "hp": 100,
      "defense": 4,
      "agility": 4
    }
  }'
```

---

### 3️⃣ 전투 기록 저장

**`POST /api/battles/record`**

전투 결과를 Firestore (또는 메모리)에 저장

**Request Body:**
```json
{
  "userId": "user123",
  "teams": {
    "team1": ["Hero1", "Hero2"],
    "team2": ["Monster1"]
  },
  "winner": "team1",
  "log": ["전투 상세 로그 배열"],
  "duration": 15000
}
```

**Response:**
```json
{
  "message": "전투 기록 저장 성공",
  "battleId": "battle_1768290397910_abc123",
  "battle": { ... },
  "storage": "firestore or memory",
  "warning": "Firestore 미연동 시 경고"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/battles/record \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "teams": {"team1": ["Hero"], "team2": ["Monster"]},
    "winner": "team1",
    "log": ["Battle started", "Hero attacked", "Monster defeated"],
    "duration": 15000
  }'
```

---

### 4️⃣ 전투 기록 조회

**`GET /api/battles/history`**

사용자의 전투 기록 조회 (최신순 정렬)

**Query Parameters:**
- `userId`: 사용자 ID (**필수**)
- `limit`: 조회 개수 (기본값: 10)

**Response:**
```json
{
  "battles": [
    {
      "id": "battle_1768290397910_abc123",
      "teams": { ... },
      "winner": "team1",
      "log": [...],
      "duration": 15000,
      "timestamp": "2026-01-13T07:46:37.910Z"
    }
  ],
  "total": 1,
  "storage": "firestore or memory"
}
```

**Example:**
```bash
curl "http://localhost:3000/api/battles/history?userId=user123&limit=10"
```

---

## Firebase 연동 (Firestore)

### 1. Firebase 서비스 계정 키 다운로드

1. https://console.firebase.google.com 접속
2. **battle-yangho** 프로젝트 선택
3. ⚙️ **프로젝트 설정** → **서비스 계정**
4. **Node.js** 탭 선택
5. **새 개인 키 생성** 클릭
6. 다운로드된 JSON 파일을 `backend/serviceAccountKey.json`으로 저장

### 2. 환경 변수 설정 (.env.local)

```dotenv
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

### 3. 서버 재시작

```bash
npm start
```

헬스 체크에서 `firebase: "✅ 연동됨"` 표시 확인

---

## 데이터 구조 (Firestore)

```
users/
  ├── {userId}/
  │   ├── battles/
  │   │   ├── {battleId}
  │   │   │   ├── teams: object
  │   │   │   ├── winner: string
  │   │   │   ├── log: array
  │   │   │   ├── duration: number
  │   │   │   ├── timestamp: string
  │   │   │   └── ...
```

---

## 프론트엔드 통합 예시

### JavaScript Fetch 예제

```javascript
// 1. 전투 시뮬레이션
const response = await fetch('http://localhost:3000/api/battles/simulate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    attacker: attacker,
    defender: defender
  })
});
const result = await response.json();
console.log(result.log); // 전투 로그

// 2. 전투 기록 저장
const saveResponse = await fetch('http://localhost:3000/api/battles/record', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: currentUser.uid,
    teams: teams,
    winner: winner,
    log: battleLog,
    duration: battleDuration
  })
});
const saveResult = await saveResponse.json();
console.log('Battle ID:', saveResult.battleId);

// 3. 전투 기록 조회
const historyResponse = await fetch(
  `http://localhost:3000/api/battles/history?userId=${currentUser.uid}&limit=10`
);
const battleHistory = await historyResponse.json();
console.log(battleHistory.battles);
```

---

## 에러 처리

모든 엔드포인트는 다음과 같은 에러 응답을 반환할 수 있습니다:

```json
{
  "error": "에러 메시지"
}
```

**예시:**
```json
{
  "error": "사용자 ID가 필요합니다."
}
```

---

## 아키텍처

```
프론트엔드 (HTML/CSS/JS)
       ↓
    API 호출
       ↓
백엔드 API (Express)
       ├── 전투 로직 처리
       └── Firestore 저장/조회
       ↓
Firebase (Auth + Firestore)
```

**특징:**
- 🔒 Firestore는 Authentication으로 보호됨
- 💾 Firebase 무료 티어 사용
- 🚀 빠른 응답 시간
- 📊 서버사이드 복잡 로직 처리

---

## 개발 팁

### 로그 확인

```bash
tail -f backend/server.log
```

### 메모리 폴백 (Firestore 없을 때)

- 전투 기록이 메모리에만 저장됨
- 서버 재시작 시 초기화됨
- 개발/테스트 시 유용

### 포트 변경

```bash
PORT=4000 npm start
```

---

## 문제 해결

### Firebase 연동 안 될 때

```
⚠️ Firebase 서비스 계정 키를 찾을 수 없습니다.
```

**해결책:**
1. serviceAccountKey.json이 backend 폴더에 있는지 확인
2. 파일 경로를 .env.local에서 확인
3. JSON 파일 형식이 올바른지 확인 (따옴표 등)

### 포트 3000 충돌

```bash
# 3000 포트 사용 중인 프로세스 확인
lsof -i :3000

# 프로세스 종료
kill -9 <PID>
```

---

## 라이선스

이 API는 양호후환 전투 시스템의 일부입니다.
