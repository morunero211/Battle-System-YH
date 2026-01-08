/**
 * 로그인 UI 컨트롤러
 * 헤더의 로그인 버튼과 모달 연동
 */

class AuthController {
    constructor() {
        this.authModal = document.getElementById('auth-modal');
        this.authEmail = document.getElementById('auth-email');
        this.authPassword = document.getElementById('auth-password');
        this.authError = document.getElementById('auth-error');
        this.authClose = document.getElementById('auth-close');
        this.authLogin = document.getElementById('auth-login');
        this.authSignup = document.getElementById('auth-signup');
        this.authGoogle = document.getElementById('auth-google');
        
        this.initEventListeners();
        this.checkAuthState();
    }

    /**
     * 이벤트 리스너 초기화
     */
    initEventListeners() {
        // 로그인 버튼 (헤더에 추가 필요)
        const loginBtn = document.getElementById('header-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.openModal());
        }

        // 모달 닫기
        this.authClose?.addEventListener('click', () => this.closeModal());
        
        // 모달 외부 클릭 시 닫기
        this.authModal?.addEventListener('click', (e) => {
            if (e.target === this.authModal) {
                this.closeModal();
            }
        });

        // 로그인
        this.authLogin?.addEventListener('click', () => this.handleLogin());
        
        // 회원가입
        this.authSignup?.addEventListener('click', () => this.handleSignup());
        
        // Google 로그인
        this.authGoogle?.addEventListener('click', () => this.handleGoogleLogin());

        // Enter 키로 로그인
        this.authPassword?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLogin();
            }
        });
    }

    /**
     * 모달 열기
     */
    openModal() {
        if (this.authModal) {
            this.authModal.style.display = 'block';
            this.authEmail?.focus();
        }
    }

    /**
     * 모달 닫기
     */
    closeModal() {
        if (this.authModal) {
            this.authModal.style.display = 'none';
        }
        this.clearForm();
    }

    /**
     * 폼 초기화
     */
    clearForm() {
        if (this.authEmail) this.authEmail.value = '';
        if (this.authPassword) this.authPassword.value = '';
        if (this.authError) this.authError.textContent = '';
    }

    /**
     * 에러 표시
     */
    showError(message) {
        if (this.authError) {
            this.authError.textContent = message;
        }
    }

    /**
     * 이메일/비밀번호 로그인
     */
    async handleLogin() {
        const email = this.authEmail?.value.trim();
        const password = this.authPassword?.value;

        if (!email || !password) {
            this.showError('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        if (typeof window.loginWithEmail !== 'function') {
            this.showError('Firebase가 초기화되지 않았습니다.');
            return;
        }

        const result = await window.loginWithEmail(email, password);
        
        if (result.success) {
            this.closeModal();
            this.showToast('로그인 성공!', 'success');
        } else {
            const errorMsg = this.getErrorMessage(result.error);
            this.showError(errorMsg);
        }
    }

    /**
     * 회원가입
     */
    async handleSignup() {
        const email = this.authEmail?.value.trim();
        const password = this.authPassword?.value;

        if (!email || !password) {
            this.showError('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        if (password.length < 6) {
            this.showError('비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        if (typeof window.signupWithEmail !== 'function') {
            this.showError('Firebase가 초기화되지 않았습니다.');
            return;
        }

        const result = await window.signupWithEmail(email, password);
        
        if (result.success) {
            this.closeModal();
            this.showToast('회원가입 성공!', 'success');
        } else {
            const errorMsg = this.getErrorMessage(result.error);
            this.showError(errorMsg);
        }
    }

    /**
     * Google 로그인
     */
    async handleGoogleLogin() {
        if (typeof window.loginWithGoogle !== 'function') {
            this.showError('Firebase가 초기화되지 않았습니다.');
            return;
        }

        const result = await window.loginWithGoogle();
        
        if (result.success) {
            this.closeModal();
            this.showToast('로그인 성공!', 'success');
        } else {
            const errorMsg = this.getErrorMessage(result.error);
            this.showError(errorMsg);
        }
    }

    /**
     * 인증 상태 확인
     */
    checkAuthState() {
        if (!window.firebaseAuth) return;

        window.firebaseAuth.onAuthStateChanged((user) => {
            const loginBtn = document.getElementById('header-login-btn');
            const logoutBtn = document.getElementById('header-logout-btn');
            const userInfo = document.getElementById('header-user-info');

            if (user) {
                // 로그인 상태
                if (loginBtn) loginBtn.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'block';
                if (userInfo) {
                    userInfo.style.display = 'block';
                    userInfo.textContent = user.email || 'User';
                }
            } else {
                // 로그아웃 상태
                if (loginBtn) loginBtn.style.display = 'block';
                if (logoutBtn) logoutBtn.style.display = 'none';
                if (userInfo) userInfo.style.display = 'none';
            }
        });
    }

    /**
     * 에러 메시지 한글화
     */
    getErrorMessage(error) {
        if (typeof error !== 'string') return '로그인에 실패했습니다.';

        if (error.includes('user-not-found')) return '등록되지 않은 이메일입니다.';
        if (error.includes('wrong-password')) return '비밀번호가 올바르지 않습니다.';
        if (error.includes('email-already-in-use')) return '이미 사용 중인 이메일입니다.';
        if (error.includes('weak-password')) return '비밀번호는 6자 이상이어야 합니다.';
        if (error.includes('invalid-email')) return '올바른 이메일 형식이 아닙니다.';
        if (error.includes('network-request-failed')) return '네트워크 연결을 확인해주세요.';
        if (error.includes('popup-closed-by-user')) return '로그인이 취소되었습니다.';
        
        return '로그인에 실패했습니다. 다시 시도해주세요.';
    }

    /**
     * 토스트 메시지 표시
     */
    showToast(message, type = 'info') {
        if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast(message, type);
        } else {
            alert(message);
        }
    }
}

// 페이지 로드 후 AuthController 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.authController = new AuthController();
});
