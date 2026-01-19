/**
 * Firebase Admin SDK 초기화
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Firebase 서비스 계정 키 경로
// - FIREBASE_SERVICE_ACCOUNT_PATH가 상대 경로인 경우 backend/ 루트 기준으로 해석
// - 기본값은 backend/serviceAccountKey.json (문서/안내와 일치)
const backendRoot = path.resolve(__dirname, '../..');
const envServiceAccountPath = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();

function resolveServiceAccountPath(p) {
    if (!p) return null;
    if (path.isAbsolute(p)) return p;
    return path.resolve(backendRoot, p);
}

const candidatePaths = [];
if (envServiceAccountPath) {
    candidatePaths.push(resolveServiceAccountPath(envServiceAccountPath));
}
candidatePaths.push(path.join(backendRoot, 'serviceAccountKey.json'));
// 레거시/과거 경로 호환(backend/src/serviceAccountKey.json)
candidatePaths.push(path.join(__dirname, '../serviceAccountKey.json'));

const serviceAccountPath = candidatePaths.find(p => p && fs.existsSync(p)) || candidatePaths[0] || candidatePaths[1];

let db = null;
let auth = null;
let firebaseInitialized = false;

// serviceAccountKey.json이 존재하는지 확인
if (fs.existsSync(serviceAccountPath)) {
    try {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        db = admin.firestore();
        auth = admin.auth();
        firebaseInitialized = true;
        console.log('✅ Firebase Admin SDK 초기화 성공');
    } catch (error) {
        console.error('❌ Firebase 초기화 실패:', error.message);
        console.log('📝 서비스 계정 키 형식이 올바르지 않습니다.');
    }
} else {
    console.warn('⚠️ Firebase 서비스 계정 키를 찾을 수 없습니다.');
    console.log(`🧭 확인한 경로: ${candidatePaths.filter(Boolean).join(' , ')}`);
    console.log('📝 Firestore 기능이 비활성화됩니다.');
    console.log('다음 단계로 Firebase 연동을 활성화할 수 있습니다:');
    console.log('1. https://console.firebase.google.com 접속');
    console.log('2. "battle-yangho" 프로젝트 선택');
    console.log('3. ⚙️ 프로젝트 설정 → 서비스 계정');
    console.log('4. "새 개인 키 생성" 클릭');
    console.log('5. 다운로드한 JSON을 backend/serviceAccountKey.json으로 저장');
}

module.exports = {
    admin,
    db,
    auth,
    firebaseInitialized
};
