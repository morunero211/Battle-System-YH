/**
 * Firebase 설정 파일
 * 
 * 설정 방법:
 * 1. Firebase Console (console.firebase.google.com)에서 프로젝트 생성
 * 2. 프로젝트 설정 → 웹 앱 추가
 * 3. 아래 firebaseConfig 객체를 복사한 설정으로 교체
 */

// ✅ Firebase 설정 완료!
const firebaseConfig = {
    apiKey: "AIzaSyALGEYOXymzHtRra8MkKDnwl44uFAl1ggI",
    authDomain: "battle-yangho.firebaseapp.com",
    projectId: "battle-yangho",
    storageBucket: "battle-yangho.firebasestorage.app",
    messagingSenderId: "209546495984",
    appId: "1:209546495984:web:d33984e8db5b791950ff35",
    measurementId: "G-RWLV7KKPE2"
};

// Firebase 초기화
try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        
        // Firestore 초기화
        window.firebaseDb = firebase.firestore();
        
        // Auth 초기화
        window.firebaseAuth = firebase.auth();
        
        console.log('✅ Firebase initialized successfully');
        console.log('📊 Firestore:', window.firebaseDb ? 'Connected' : 'Not connected');
        console.log('🔐 Auth:', window.firebaseAuth ? 'Ready' : 'Not ready');
    } else {
        console.error('❌ Firebase SDK가 로드되지 않았습니다. index.html에서 Firebase SDK를 먼저 로드하세요.');
    }
} catch (error) {
    console.error('❌ Firebase 초기화 실패:', error);
    console.log('💡 firebaseConfig 설정을 확인하세요.');
}

// 인증 상태 변경 리스너
if (window.firebaseAuth) {
    window.firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
            console.log('👤 사용자 로그인:', user.email || user.uid);
            
            // 앱이 로드되었으면 사용자 정보 설정
            if (window.app && window.app.dataManager) {
                // 수동 저장/불러오기 모드: 자동 로드/동기화 금지
                window.app.dataManager.setUser(user.uid, { applyLocalCache: false, migrate: false, render: false });
            }
        } else {
            console.log('👤 사용자 로그아웃');
            
            // 앱이 로드되었으면 익명 모드로 설정
            if (window.app && window.app.dataManager) {
                window.app.dataManager.setUser(null, { applyLocalCache: false, migrate: false, render: false });
            }
        }
    });
}

/**
 * 이메일/비밀번호 로그인
 */
async function loginWithEmail(email, password) {
    try {
        const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
        console.log('✅ 로그인 성공:', userCredential.user.email);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('❌ 로그인 실패:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 이메일/비밀번호 회원가입
 */
async function signupWithEmail(email, password) {
    try {
        const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
        console.log('✅ 회원가입 성공:', userCredential.user.email);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('❌ 회원가입 실패:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Google 로그인
 */
async function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const userCredential = await window.firebaseAuth.signInWithPopup(provider);
        console.log('✅ Google 로그인 성공:', userCredential.user.email);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('❌ Google 로그인 실패:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 로그아웃
 */
async function logout() {
    try {
        await window.firebaseAuth.signOut();
        console.log('✅ 로그아웃 성공');
        return { success: true };
    } catch (error) {
        console.error('❌ 로그아웃 실패:', error.message);
        return { success: false, error: error.message };
    }
}

// 전역 함수로 노출
window.loginWithEmail = loginWithEmail;
window.signupWithEmail = signupWithEmail;
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
