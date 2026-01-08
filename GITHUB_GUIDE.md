# 🐙 GitHub 설정 가이드

## GitHub와 Firebase의 역할 구분

### 🔥 Firebase
- **데이터 저장소**: 캐릭터, 전투 기록, 사용자 정보
- **실시간 데이터베이스**: Firestore
- **호스팅**: 웹사이트 배포
- **인증**: 로그인 시스템

### 🐙 GitHub
- **코드 저장소**: HTML, CSS, JavaScript 파일
- **버전 관리**: 변경 이력 추적
- **협업**: 팀 작업 가능
- **백업**: 클라우드 코드 보관

**둘 다 필요합니다! 역할이 다릅니다!**

---

## 📦 GitHub 시작하기 (5분)

### 1단계: GitHub 계정 만들기
1. https://github.com 접속
2. "Sign up" 클릭
3. 이메일, 비밀번호 입력
4. 인증 완료

### 2단계: Git 설치 (Windows)
1. https://git-scm.com/download/win 접속
2. 다운로드 및 설치 (기본 옵션으로 설치)
3. PowerShell 재시작

### 3단계: Git 설정
```powershell
# 사용자 정보 설정
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## 🎯 프로젝트를 GitHub에 올리기 (5분)

### 1단계: GitHub에서 저장소 만들기
1. GitHub 로그인
2. 우측 상단 "+" → "New repository"
3. 저장소 이름: `battle-program`
4. Public 선택 (포트폴리오용)
5. **"Add a README file" 체크 해제** (이미 프로젝트가 있으므로)
6. "Create repository" 클릭

### 2단계: 프로젝트 폴더에서 Git 초기화
```powershell
# 프로젝트 폴더로 이동
cd C:\Users\qps02\OneDrive\Desktop\Battle-Program

# Git 저장소 초기화
git init

# 모든 파일 추가
git add .

# 첫 커밋
git commit -m "Initial commit: Battle Program"
```

### 3단계: GitHub에 업로드
```powershell
# GitHub 저장소 연결 (YOUR_USERNAME을 실제 GitHub 아이디로 교체)
git remote add origin https://github.com/YOUR_USERNAME/battle-program.git

# 기본 브랜치 이름 설정
git branch -M main

# GitHub에 업로드
git push -u origin main
```

---

## 🔄 일상적인 작업 흐름

### 코드 수정 후 GitHub에 저장
```powershell
# 변경사항 확인
git status

# 모든 변경사항 추가
git add .

# 커밋 (변경 내용 설명)
git commit -m "캐릭터 추가 기능 구현"

# GitHub에 업로드
git push
```

### GitHub에서 다른 컴퓨터로 다운로드
```powershell
# 프로젝트 복제
git clone https://github.com/YOUR_USERNAME/battle-program.git
```

---

## 🤖 GitHub Actions로 자동 배포

### 자동 배포 설정 (고급)
GitHub에 Push하면 자동으로 Firebase에 배포!

#### 1. `.github/workflows/deploy.yml` 파일 생성
```yaml
name: Deploy to Firebase

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Firebase Tools
        run: npm install -g firebase-tools
      
      - name: Deploy to Firebase
        run: firebase deploy --token "${{ secrets.FIREBASE_TOKEN }}"
```

#### 2. Firebase 토큰 생성
```powershell
firebase login:ci
```
출력된 토큰 복사

#### 3. GitHub Secrets 설정
1. GitHub 저장소 → Settings
2. Secrets and variables → Actions
3. "New repository secret"
4. Name: `FIREBASE_TOKEN`
5. Value: 복사한 토큰 붙여넣기
6. "Add secret"

**완료!** 이제 GitHub에 Push하면 자동으로 배포됩니다!

---

## 📝 .gitignore 파일 설정

### GitHub에 올리지 말아야 할 파일
```
# .gitignore 파일 내용
node_modules/
.firebase/
.firebaserc
firebase-debug.log
.DS_Store
*.log
```

**주의:** `firebase-config.js`는 올려도 됩니다!
- Firebase의 apiKey는 공개 키입니다
- 보안은 Firestore 규칙으로 관리

---

## 🎨 README 파일 작성

### GitHub 저장소 첫 화면에 보이는 설명
`README.md` 파일 예시:

```markdown
# ⚔️ 양호후환 전투 시스템

턴제 전투 시스템을 구현한 웹 애플리케이션입니다.

## 🎮 기능
- 캐릭터 생성 및 관리
- 팀 vs 팀 전투
- 전투 기록 저장
- 실시간 데이터 동기화

## 🛠️ 기술 스택
- **Frontend**: HTML, CSS, JavaScript
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting

## 🚀 배포
- URL: https://your-project.web.app

## 📝 라이선스
MIT License
```

---

## 🌟 GitHub 활용 팁

### 1. 브랜치 사용하기
```powershell
# 새 기능 개발용 브랜치 생성
git checkout -b feature/new-character-system

# 작업 후 main에 병합
git checkout main
git merge feature/new-character-system
```

### 2. 커밋 메시지 규칙
```
✅ 좋은 예:
- "캐릭터 생성 모달 UI 개선"
- "전투 로그 버그 수정"
- "Firebase 연동 완료"

❌ 나쁜 예:
- "수정"
- "aaa"
- "test"
```

### 3. 주기적으로 Push
```powershell
# 하루 작업 끝날 때마다
git add .
git commit -m "오늘 작업 내용"
git push
```

---

## 🆚 비교표: 데이터 vs 코드

| 항목 | 저장 위치 | 도구 |
|------|----------|------|
| **HTML 파일** | GitHub | Git |
| **CSS 파일** | GitHub | Git |
| **JavaScript 파일** | GitHub | Git |
| **이미지 파일** | GitHub | Git |
| **캐릭터 데이터** | Firebase Firestore | Firestore |
| **전투 기록** | Firebase Firestore | Firestore |
| **사용자 정보** | Firebase Auth | Firebase |
| **웹사이트 배포** | Firebase Hosting | Firebase CLI |

---

## 🎯 권장 워크플로우

### 개발 흐름
```
1. 코드 수정
   ↓
2. 로컬 테스트 (index.html 열기)
   ↓
3. GitHub 커밋 & Push
   ↓
4. Firebase 배포
   ↓
5. 실제 사이트 확인
```

### 명령어 한 눈에 보기
```powershell
# 코드 수정 후
git add .
git commit -m "변경 내용 설명"
git push

# Firebase 배포
firebase deploy

# 완료!
```

---

## 🔒 보안 주의사항

### ✅ GitHub에 올려도 되는 것
- HTML, CSS, JavaScript 파일
- `firebase-config.js` (apiKey는 공개 키)
- README, 가이드 문서

### ⚠️ 주의할 것
- `.env` 파일 (환경변수)
- 개인 토큰
- 백업 파일

### 🛡️ 보안 규칙
Firestore 보안은 코드가 아닌 **Firestore 규칙**으로 관리:
```javascript
// firestore.rules
match /users/{userId}/battle/{document=**} {
  allow read, write: if request.auth.uid == userId;
}
```

---

## 📚 학습 자료

### Git 기초
- https://git-scm.com/book/ko/v2
- https://learngitbranching.js.org/?locale=ko

### GitHub 가이드
- https://docs.github.com/ko

---

## 🎊 다음 단계

1. **GitHub 계정 만들기** → https://github.com
2. **Git 설치** → https://git-scm.com
3. **프로젝트 업로드** → 위의 3단계 따라하기
4. **Firebase 자동 배포 설정** (선택)

**코드는 GitHub, 데이터는 Firebase!** 🚀
