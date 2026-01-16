/**
 * 데이터 관리자 (Data Manager)
 * 저장/불러오기, JSON 파일 처리
 */

class DataManager {
    constructor(app) {
        this.app = app;
        this.localStorageKey = 'battleProgramData';
        this.schemaVersion = 2;
        this.collection = 'battleApp';
        this.documentId = 'default';
        this.userId = null;
    }

    getLocalDataForKey(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    hasLocalCacheForKey(key) {
        const parsed = this.getLocalDataForKey(key);
        return !!(parsed && Array.isArray(parsed.teams));
    }

    /**
     * 현재 로그인한 사용자 설정 (로컬 키/경로 분리)
     */
    setUser(userId, { applyLocalCache = true, migrate = true, render = true } = {}) {
        const prevKey = this.localStorageKey;
        this.userId = userId || null;
        this.localStorageKey = userId ? `battleProgramData_${userId}` : 'battleProgramData';
        // 경로: users/{uid}/battle/default
        this.collection = userId ? 'users' : 'battleApp';
        this.documentId = 'default';
        if (this.app) {
            this.app.currentUserId = this.userId;
        }

        if (!applyLocalCache) return;

        // 로그인 직후(또는 로그아웃 직후) 키가 바뀌면, 해당 키의 로컬 캐시를 즉시 적용
        // - 문제: 앱 init 시점에는 userId가 아직 없어서 기본 키로 로드됨 → 로그인 후에도 user 키 캐시를 못 읽어 Default로 보일 수 있음
        try {
            const nextKey = this.localStorageKey;
            const switchingKey = prevKey && nextKey && prevKey !== nextKey;

            // (마이그레이션) user 키에 데이터가 없고, 이전(익명) 키에만 데이터가 있으면 복사
            if (migrate && switchingKey && this.userId && !this.hasLocalCacheForKey(nextKey) && this.hasLocalCacheForKey(prevKey)) {
                const prevData = this.getLocalDataForKey(prevKey);
                if (prevData) {
                    localStorage.setItem(nextKey, JSON.stringify({
                        ...prevData,
                        migratedFrom: prevKey,
                        migratedAt: new Date().toISOString(),
                        migratedByUser: this.userId
                    }));
                }
            }

            // 새 키(현재 사용자)에 해당하는 로컬 데이터를 다시 로드
            this.loadFromLocalStorage();
            if (render && typeof this.app?.renderAllTeams === 'function') {
                this.app.renderAllTeams();
            }
        } catch (e) {
            console.error('사용자 전환 시 로컬 캐시 적용 실패:', e);
        }
    }

    /**
     * LocalStorage에 저장 (앱 내 동기화용)
     */
    saveToLocalStorage() {
        try {
            const data = {
                schemaVersion: this.schemaVersion,
                savedAt: new Date().toISOString(),
                teams: this.app.teams,
                selectedCharacters: this.app.selectedCharacters,
                battleHistory: this.app.battleHistory
            };
            localStorage.setItem(this.localStorageKey, JSON.stringify(data));
            console.log('LocalStorage에 저장됨');
        } catch (error) {
            console.error('LocalStorage 저장 실패:', error);
        }
    }

    /**
     * LocalStorage에서 불러오기 (기본 캐시)
     */
    loadFromLocalStorage() {
        try {
            const raw = localStorage.getItem(this.localStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.app.teams = parsed.teams || this.app.teams;
                this.app.selectedCharacters = parsed.selectedCharacters || this.app.selectedCharacters;
                this.app.battleHistory = parsed.battleHistory || this.app.battleHistory;
                // 스키마/누락 필드 보정
                if (typeof this.app.normalizePersistedData === 'function') {
                    this.app.normalizePersistedData({ save: true });
                }
                console.log('LocalStorage에서 로드됨');
            }
        } catch (error) {
            console.error('LocalStorage 로드 실패:', error);
        }
    }

    /**
     * 디버그용: 현재 사용자 키로 저장된 로컬 데이터가 있는지 빠르게 확인
     */
    hasLocalCache() {
        try {
            const raw = localStorage.getItem(this.localStorageKey);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return !!(parsed && Array.isArray(parsed.teams));
        } catch {
            return false;
        }
    }

    /**
     * Firestore 핸들 반환 (없으면 null)
     */
    getFirestore() {
        if (window.firebaseDb && typeof window.firebaseDb.collection === 'function') {
            return window.firebaseDb;
        }
        if (window.firebase && typeof window.firebase.firestore === 'function') {
            return window.firebase.firestore();
        }
        return null;
    }

    /**
     * 사용자별 문서 참조 반환
     */
    getDocRef(db) {
        if (!db) return null;
        if (this.userId) {
            return db
                .collection('users')
                .doc(this.userId)
                .collection('battle')
                .doc(this.documentId);
        }
        return db.collection(this.collection).doc(this.documentId);
    }

    /**
     * Firestore에서 최신 상태 불러오기 (있으면 적용 후 렌더)
     */
    async loadFromFirestore() {
        const db = this.getFirestore();
        if (!db) {
            console.warn('Firestore가 초기화되지 않아 원격 로드를 건너뜁니다.');
            return false;
        }

        if (!this.userId) {
            console.warn('로그인 정보가 없어 Firestore 로드를 건너뜁니다.');
            return false;
        }

        try {
            const docRef = this.getDocRef(db);
            if (!docRef) return false;
            const snapshot = await docRef.get();

            if (!snapshot.exists) {
                console.log('Firestore에 아직 데이터가 없습니다.');
                return false;
            }

            const data = snapshot.data() || {};

            if (Array.isArray(data.teams)) {
                this.app.teams = data.teams;
            }
            if (data.selectedCharacters && typeof data.selectedCharacters === 'object') {
                this.app.selectedCharacters = data.selectedCharacters;
            }
            if (Array.isArray(data.battleHistory)) {
                this.app.battleHistory = data.battleHistory;
            }

            // 스키마/누락 필드 보정
            if (typeof this.app.normalizePersistedData === 'function') {
                this.app.normalizePersistedData({ save: false });
            }

            // 로컬 캐시도 최신으로 동기화
            this.saveToLocalStorage();

            if (typeof this.app.renderAllTeams === 'function') {
                this.app.renderAllTeams();
            }
            console.log('Firestore에서 데이터 로드 완료');
            return true;
        } catch (error) {
            console.error('Firestore 로드 실패:', error);
            return false;
        }
    }

    /**
     * Firestore에 저장 (병합)
     */
    async saveToFirestore() {
        const db = this.getFirestore();
        if (!db) {
            return;
        }

        if (!this.userId) {
            console.warn('로그인 정보가 없어 Firestore 저장을 건너뜁니다.');
            return;
        }

        const payload = {
            teams: this.app.teams,
            selectedCharacters: this.app.selectedCharacters,
            battleHistory: this.app.battleHistory,
            updatedAt: new Date().toISOString()
        };

        try {
            const docRef = this.getDocRef(db);
            if (!docRef) return;
            await docRef.set(payload, { merge: true });
            console.log('Firestore에 저장됨');
        } catch (error) {
            console.error('Firestore 저장 실패:', error);
        }
    }

    /**
     * JSON 파일 다운로드
     */
    downloadJSON() {
        const data = {
            teams: this.app.teams,
            selectedCharacters: this.app.selectedCharacters,
            battleHistory: this.app.battleHistory
        };

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `battle-system-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * JSON 파일 불러오기
     */
    loadJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.teams) {
                    this.app.teams = data.teams;
                }
                if (data.selectedCharacters) {
                    this.app.selectedCharacters = data.selectedCharacters;
                }
                if (data.battleHistory) {
                    this.app.battleHistory = data.battleHistory;
                }
                this.saveToLocalStorage();
                this.app.renderAllTeams();
                alert('캐릭터 데이터가 불러와졌습니다!');
            } catch (error) {
                alert('JSON 파일을 읽는데 실패했습니다.');
                console.error(error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
}
