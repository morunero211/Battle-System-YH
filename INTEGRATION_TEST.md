# 🧪 프론트엔드 ↔ 백엔드 통합 테스트

## ✅ 완료된 작업

### 1. 백엔드 API 통합
- ✅ `js/modules/battleSystem.js` - `executeAttack()` 함수를 백엔드 API 호출로 변경
- ✅ `js/modules/battleActions.js` - async/await 처리 추가
- ✅ 폴백 메커니즘: 백엔드 연결 실패 시 로컬 계산

### 2. 작동 방식

```
프론트엔드                백엔드
┌──────────┐           ┌──────────┐
│ 전투 UI  │           │ Express  │
│          │  fetch    │          │
│ Attack   ├──────────►│ d100     │
│ 버튼     │  JSON     │ 시뮬레이션│
│          │◄──────────┤          │
│ 로그표시 │  결과     │          │
└──────────┘           └──────────┘
```

**요청 (프론트엔드 → 백엔드)**:
```javascript
{
  attacker: {
    name: "영웅",
    attack: 8,
    skill: 7,
    agility: 5
  },
  defender: {
    name: "괴물",
    hp: 100,
    defense: 4,
    agility: 4
  }
}
```

**응답 (백엔드 → 프론트엔드)**:
```javascript
{
  success: true,
  result: "critical",
  damage: 52,
  defenderHp: 48,
  log: [
    "⚔️ 영웅 → 괴물 공격 시도!",
    "🎲 공격 판정: 45 / 115",
    "✅ 공격 성공!",
    "🎲 회피 판정: 65 / 40",
    "⚡ 회피 실패!",
    "💥 크리티컬 히트!",
    "💔 괴물 HP: 100 → 48"
  ]
}
```

---

## 🚀 테스트 방법

### 1단계: 서버 상태 확인

```bash
# 프론트엔드 (포트 8000)
ps aux | grep "python3.*8000"

# 백엔드 (포트 3000)
ps aux | grep "node.*server"

# 백엔드 API 확인
curl http://localhost:3000/api/health
```

**예상 결과**:
```json
{
  "status": "ok",
  "firebase": "⚠️ 미연동 (메모리 폴백)"
}
```

### 2단계: 브라우저에서 테스트

1. 브라우저 열기: http://localhost:8000
2. **F12** 눌러서 개발자 도구 열기
3. **Console** 탭 확인

### 3단계: 전투 시작

1. **로그인** (또는 게스트로 진행)
2. **캐릭터 생성** (메인 화면)
   - 이름: "영웅"
   - 공격력: 8
   - 기술: 7
   - 민첩: 5
3. **전투 화면** 이동
4. **공격 버튼** 클릭
5. **대상 선택**

### 4단계: 결과 확인

#### ✅ 성공 시
- 전투 로그에 상세한 d100 판정 표시
- 데미지 계산 과정 표시
- HP 감소 애니메이션

#### ⚠️ 백엔드 연결 실패 시
- 콘솔에 에러 메시지: `백엔드 연결 실패 - 로컬 계산 모드`
- 간단한 폴백 로직으로 전투 진행
- 로그: `"⚠️ 백엔드 연결 실패 - 로컬 계산 모드"`

---

## 🔍 디버깅

### Console 로그 확인

브라우저 Console에서 다음 메시지를 확인하세요:

**정상 작동**:
```
(없음 - 에러 없이 조용히 작동)
```

**백엔드 연결 실패**:
```
전투 시뮬레이션 에러: TypeError: Failed to fetch
```

**CORS 에러**:
```
Access to fetch at 'http://localhost:3000/api/battles/simulate' 
from origin 'http://localhost:8000' has been blocked by CORS policy
```

### Network 탭 확인

1. **F12** → **Network** 탭
2. **Fetch/XHR** 필터 선택
3. 공격 버튼 클릭
4. `simulate` 요청 확인

**정상 요청**:
- Status: `200 OK`
- Method: `POST`
- URL: `http://localhost:3000/api/battles/simulate`
- Response: JSON with `log`, `damage`, `defenderHp`

**실패 요청**:
- Status: `(failed)` 또는 `0`
- 백엔드 서버가 꺼져 있음

---

## 🛠️ 문제 해결

### 문제 1: "백엔드 연결 실패"

**원인**: 백엔드 서버가 실행되지 않음

**해결**:
```bash
cd /home/qps0211/Battle-System-YH/backend
npm start
```

### 문제 2: CORS 에러

**원인**: CORS 설정 오류

**해결**: `backend/src/server.js` 확인
```javascript
app.use(cors({
  origin: 'http://localhost:8000',  // 프론트엔드 주소
  credentials: true
}));
```

### 문제 3: "Cannot read property 'hp' of undefined"

**원인**: 방어자 객체가 없음

**해결**: 대상 캐릭터가 살아있는지 확인

### 문제 4: 로그가 중복으로 표시됨

**원인**: 이벤트 리스너 중복 등록

**해결**: 브라우저 새로고침 (Ctrl+F5)

---

## 📊 성능 확인

### 응답 속도 측정

브라우저 Console에서:

```javascript
const start = performance.now();

await fetch('http://localhost:3000/api/battles/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    attacker: { name: 'Test', attack: 5, skill: 5, agility: 5 },
    defender: { name: 'Target', hp: 100, defense: 3, agility: 4 }
  })
});

const end = performance.now();
console.log(`응답 시간: ${(end - start).toFixed(2)}ms`);
```

**정상 범위**: 10~50ms  
**느림**: 100ms 이상 (네트워크 문제)

---

## ✨ 새로운 기능

### 1. 서버사이드 d100 계산
- 프론트엔드에서 전투 로직을 조작할 수 없음
- 공정한 전투 결과 보장

### 2. 상세한 전투 로그
- 공격 판정, 회피 판정, 크리티컬 판정 모두 표시
- 확률 계산 과정 투명하게 공개

### 3. 폴백 메커니즘
- 백엔드 장애 시에도 게임 진행 가능
- 사용자 경험 중단 방지

---

## 🎯 다음 단계 (선택사항)

### 1. 전투 기록 자동 저장
전투가 끝나면 자동으로 Firestore에 저장

### 2. 전투 히스토리 조회
과거 전투 기록을 UI에 표시

### 3. 실시간 대전
WebSocket으로 다른 플레이어와 실시간 전투

### 4. 전투 애니메이션
데미지 숫자가 화면에 튀어나오는 효과

### 5. 사운드 이펙트
공격, 크리티컬, 회피 시 효과음

---

## 📝 체크리스트

테스트 전:
- [ ] 백엔드 서버 실행 중 (포트 3000)
- [ ] 프론트엔드 서버 실행 중 (포트 8000)
- [ ] 브라우저 개발자 도구 열림 (F12)
- [ ] Console 탭 확인

테스트 중:
- [ ] 캐릭터 생성 완료
- [ ] 전투 화면 진입
- [ ] 공격 버튼 클릭
- [ ] 대상 선택
- [ ] 전투 로그 확인

테스트 후:
- [ ] Network 탭에서 API 호출 확인
- [ ] 응답 JSON 확인
- [ ] HP 감소 확인
- [ ] 에러 없음

---

**현재 상태**: ✅ 프론트엔드 ↔ 백엔드 연동 완료!

이제 브라우저에서 http://localhost:8000을 열고 실제 전투를 해보세요! 🎮
