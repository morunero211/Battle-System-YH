/**
 * 데이터 관리자 (Data Manager)
 * 저장/불러오기, JSON 파일 처리
 */

class DataManager {
    constructor(app) {
        this.app = app;
        this.localStorageKey = 'battleProgramData';
        this.lastActiveKeyStorage = 'battleProgramData__lastKey';
        this.schemaVersion = 2;
        this.collection = 'battleApp';
        this.documentId = 'default';
        this.userId = null;
        this.skillTemplatesBaseKey = 'battleSkillTemplates';
        this.skillTemplatesKey = this.getSkillTemplatesKeyForUser(null);
    }

    setLastActiveKey(key) {
        try {
            if (!key) return;
            localStorage.setItem(this.lastActiveKeyStorage, String(key));
        } catch {
            // ignore
        }
    }

    getLastActiveKey() {
        try {
            const v = localStorage.getItem(this.lastActiveKeyStorage);
            return v ? String(v) : null;
        } catch {
            return null;
        }
    }

    findMostRecentLocalKey(prefix = 'battleProgramData') {
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                if (k === this.getBackupKey(prefix) || k === this.lastActiveKeyStorage) continue;
                if (k === prefix || k.startsWith(`${prefix}_`)) keys.push(k);
            }

            let bestKey = null;
            let bestTime = null;
            for (const k of keys) {
                const parsed = this.getLocalDataForKey(k);
                if (!parsed || !Array.isArray(parsed.teams)) continue;
                if (!this.hasAnyCharacters(parsed.teams)) continue;
                const t = this.parseTime(parsed.savedAt);
                if (t === null) continue;
                if (bestTime === null || t > bestTime) {
                    bestTime = t;
                    bestKey = k;
                }
            }
            return bestKey;
        } catch {
            return null;
        }
    }

    getSkillTemplatesKeyForUser(userId) {
        return userId ? `${this.skillTemplatesBaseKey}_${userId}` : this.skillTemplatesBaseKey;
    }

    /**
     * 스킬 템플릿 라이브러리 저장 (localStorage)
     */
    saveSkillTemplates(templates) {
        try {
            localStorage.setItem(this.skillTemplatesKey, JSON.stringify(templates || {}));
            if (this.app && this.app.battleSystem) {
                // 내장 템플릿을 유지하면서 사용자 템플릿을 덮어씀
                this.app.battleSystem.skillTemplates = {
                    ...(this.app.battleSystem.skillTemplates || {}),
                    ...(templates || {})
                };
            }
        } catch (e) {
            console.error('스킬 템플릿 저장 실패:', e);
        }
    }

    /**
     * 스킬 템플릿 라이브러리 불러오기 (localStorage)
     */
    loadSkillTemplates() {
        try {
            const raw = localStorage.getItem(this.skillTemplatesKey);
            const templates = raw ? JSON.parse(raw) : {};
            if (this.app && this.app.battleSystem) {
                this.app.battleSystem.skillTemplates = {
                    ...(this.app.battleSystem.skillTemplates || {}),
                    ...(templates || {})
                };
            }
            return templates;
        } catch (e) {
            console.error('스킬 템플릿 불러오기 실패:', e);
            return {};
        }
    }

    /**
     * 스킬 템플릿 라이브러리 동기화 (앱/battleSystem)
     */
    syncSkillTemplates() {
        const templates = this.loadSkillTemplates();
        if (this.app && this.app.battleSystem) {
            this.app.battleSystem.skillTemplates = {
                ...(this.app.battleSystem.skillTemplates || {}),
                ...(templates || {})
            };
        }
        return templates;
    }

    hasAnyCharacters(teams) {
        return Array.isArray(teams) && teams.some((t) => Array.isArray(t?.characters) && t.characters.length > 0);
    }

    countCharacters(teams) {
        if (!Array.isArray(teams)) return 0;
        return teams.reduce((sum, t) => sum + (Array.isArray(t?.characters) ? t.characters.length : 0), 0);
    }

    parseTime(value) {
        const t = Date.parse(String(value || ''));
        return Number.isFinite(t) ? t : null;
    }

    getBackupKey(key) {
        return `${key}__backup`;
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
        const prevSkillTemplatesKey = this.skillTemplatesKey;
        this.userId = userId || null;
        this.localStorageKey = userId ? `battleProgramData_${userId}` : 'battleProgramData';
        this.setLastActiveKey(this.localStorageKey);
        this.skillTemplatesKey = this.getSkillTemplatesKeyForUser(this.userId);
        // 경로: users/{uid}/battle/default
        this.collection = userId ? 'users' : 'battleApp';
        this.documentId = 'default';
        if (this.app) {
            this.app.currentUserId = this.userId;
        }

        // 템플릿 키가 바뀌면, 기본 키(공용) → 사용자 키로 1회 이관(선택)
        try {
            const switchingTemplatesKey = prevSkillTemplatesKey && this.skillTemplatesKey && prevSkillTemplatesKey !== this.skillTemplatesKey;
            if (migrate && switchingTemplatesKey && this.userId) {
                const prevTemplates = this.getLocalDataForKey(prevSkillTemplatesKey);
                const nextTemplates = this.getLocalDataForKey(this.skillTemplatesKey);
                const prevHas = !!(prevTemplates && typeof prevTemplates === 'object' && Object.keys(prevTemplates).length > 0);
                const nextHas = !!(nextTemplates && typeof nextTemplates === 'object' && Object.keys(nextTemplates).length > 0);

                if (prevHas && !nextHas) {
                    localStorage.setItem(this.skillTemplatesKey, JSON.stringify({
                        ...prevTemplates,
                        migratedFrom: prevSkillTemplatesKey,
                        migratedAt: new Date().toISOString()
                    }));
                }
            }

            // 사용자 전환 시 템플릿도 즉시 동기화
            this.syncSkillTemplates();
        } catch (e) {
            console.error('사용자 전환 시 템플릿 키 적용 실패:', e);
        }

        if (!applyLocalCache) return;

        // 로그인 직후(또는 로그아웃 직후) 키가 바뀌면, 해당 키의 로컬 캐시를 즉시 적용
        // - 문제: 앱 init 시점에는 userId가 아직 없어서 기본 키로 로드됨 → 로그인 후에도 user 키 캐시를 못 읽어 Default로 보일 수 있음
        try {
            const nextKey = this.localStorageKey;
            const switchingKey = prevKey && nextKey && prevKey !== nextKey;

            // (마이그레이션)
            // - user 키가 비어있거나(캐릭터 0명) 아직 없고,
            // - 이전(익명) 키에 캐릭터가 있으면
            // => 익명 데이터를 user 키로 복사(배포/로그인 타이밍 이슈로 "사라짐" 방지)
            if (migrate && switchingKey && this.userId) {
                const prevData = this.getLocalDataForKey(prevKey);
                const nextData = this.getLocalDataForKey(nextKey);
                const prevHas = this.hasAnyCharacters(prevData?.teams);
                const nextHas = this.hasAnyCharacters(nextData?.teams);

                if (prevHas && !nextHas) {
                    localStorage.setItem(nextKey, JSON.stringify({
                        ...prevData,
                        migratedFrom: prevKey,
                        migratedAt: new Date().toISOString(),
                        migratedByUser: this.userId
                    }));
                    this.app?.showToast?.('로컬 캐릭터 데이터를 복구/이관했습니다.', 'success');
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
            // 수동 저장 모드에서는 버튼으로 강제 저장할 때만 저장
            // (기본 동작: 자동 저장/동기화가 사용자 데이터를 되살리거나 덮어쓰는 문제 방지)
            const manual = !!this.app?.manualPersistenceMode;
            const force = arguments?.[0]?.force === true; // 기존 호출부 호환(인자 없이 호출되는 경우가 많음)
            if (manual && !force) {
                this.app._unsavedChanges = true;
                return false;
            }

            this.setLastActiveKey(this.localStorageKey);
            // 백업(이전 스냅샷 보관): 새 버전 배포/파싱 이슈로 데이터가 "사라지는" 경우 대비
            const prevRaw = localStorage.getItem(this.localStorageKey);
            if (prevRaw) {
                localStorage.setItem(this.getBackupKey(this.localStorageKey), prevRaw);
            }

            const data = {
                schemaVersion: this.schemaVersion,
                savedAt: new Date().toISOString(),
                teams: this.app.teams,
                selectedCharacters: this.app.selectedCharacters,
                battleHistory: this.app.battleHistory
            };
            localStorage.setItem(this.localStorageKey, JSON.stringify(data));
            console.log('LocalStorage에 저장됨');
            return true;
        } catch (error) {
            console.error('LocalStorage 저장 실패:', error);
            return false;
        }
    }

    /**
     * LocalStorage에서 불러오기 (기본 캐시)
     */
    loadFromLocalStorage(options = {}) {
        try {
            const manual = !!this.app?.manualPersistenceMode;
            const force = options?.force === true;
            if (manual && !force) {
                console.warn('수동 저장/불러오기 모드: 자동 로드를 건너뜁니다.');
                return false;
            }

            const raw = localStorage.getItem(this.localStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw);

                const incomingTeams = parsed.teams;
                const incomingHas = this.hasAnyCharacters(incomingTeams);
                const currentHas = this.hasAnyCharacters(this.app.teams);

                // 빈 데이터로 덮어쓰기 방지
                if (Array.isArray(incomingTeams) && (incomingHas || !currentHas)) {
                    this.app.teams = incomingTeams;
                } else if (!incomingHas && currentHas) {
                    // 현재 키가 빈 상태라면, 백업 키로 자동 복구 시도
                    const backupRaw = localStorage.getItem(this.getBackupKey(this.localStorageKey));
                    if (backupRaw) {
                        try {
                            const backup = JSON.parse(backupRaw);
                            if (this.hasAnyCharacters(backup?.teams)) {
                                this.app.teams = backup.teams;
                                if (backup.selectedCharacters) this.app.selectedCharacters = backup.selectedCharacters;
                                if (Array.isArray(backup.battleHistory)) this.app.battleHistory = backup.battleHistory;
                                this.saveToLocalStorage();
                                this.app?.showToast?.('로컬 캐릭터 데이터를 백업에서 복구했습니다.', 'warning');
                            }
                        } catch {
                            // ignore
                        }
                    }
                }
                this.app.selectedCharacters = parsed.selectedCharacters || this.app.selectedCharacters;
                this.app.battleHistory = parsed.battleHistory || this.app.battleHistory;
                // 스키마/누락 필드 보정
                if (typeof this.app.normalizePersistedData === 'function') {
                    this.app.normalizePersistedData({ save: true });
                }
                console.log('LocalStorage에서 로드됨');
                this.setLastActiveKey(this.localStorageKey);
                return true;
            }

            // 현재 키에 데이터가 없으면, 마지막 사용 키 또는 가장 최신 키에서 복구
            const lastKey = this.getLastActiveKey();
            const tryKeys = [];
            if (lastKey && lastKey !== this.localStorageKey) tryKeys.push(lastKey);
            const newestKey = this.findMostRecentLocalKey('battleProgramData');
            if (newestKey && newestKey !== this.localStorageKey && newestKey !== lastKey) tryKeys.push(newestKey);

            for (const k of tryKeys) {
                const fallback = this.getLocalDataForKey(k);
                if (!fallback || !Array.isArray(fallback.teams)) continue;
                if (!this.hasAnyCharacters(fallback.teams)) continue;

                this.app.teams = fallback.teams;
                if (fallback.selectedCharacters) this.app.selectedCharacters = fallback.selectedCharacters;
                if (Array.isArray(fallback.battleHistory)) this.app.battleHistory = fallback.battleHistory;
                if (typeof this.app.normalizePersistedData === 'function') {
                    this.app.normalizePersistedData({ save: false });
                }

                // 현재 키로도 저장해서 다음 새로고침부터는 안정적으로 로드되게
                this.saveToLocalStorage();
                this.app?.showToast?.('캐릭터 데이터를 복구했습니다.', 'success');
                return true;
            }
            return false;
        } catch (error) {
            console.error('LocalStorage 로드 실패:', error);
            return false;
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
    async loadFromFirestore(options = {}) {
        const manual = !!this.app?.manualPersistenceMode;
        const force = options?.force === true;
        if (manual && !force) {
            console.warn('수동 저장/불러오기 모드: 자동 원격 로드를 건너뜁니다.');
            return false;
        }

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

            // 원격이 비어있을 때 로컬을 덮어쓰지 않도록 안전장치
            const local = this.getLocalDataForKey(this.localStorageKey);
            const localTeams = local?.teams;
            const localHas = this.hasAnyCharacters(localTeams);
            const remoteTeams = data.teams;
            const remoteHas = this.hasAnyCharacters(remoteTeams);

            const localPresent = !!(local && Array.isArray(local.teams));

            const localTime = this.parseTime(local?.savedAt);
            const remoteTime = this.parseTime(data?.updatedAt || data?.savedAt);
            const remoteNewer = (localTime !== null && remoteTime !== null) ? (remoteTime >= localTime) : null;

            // 원격 데이터 적용 규칙
            // - 로컬에 저장 기록이 없으면(remote가 있으면) 원격을 적용
            // - 로컬에 저장 기록이 있으면(비어있더라도), 원격이 더 최신일 때만 적용
            //   => 사용자가 로컬에서 "삭제"했는데 원격이 예전 데이터로 되살리는 문제 방지
            const shouldApplyRemoteTeams = Array.isArray(remoteTeams)
                && (
                    (remoteHas && (!localPresent || remoteNewer === true))
                    || (!remoteHas && !localHas && !localPresent)
                );

            if (shouldApplyRemoteTeams) {
                this.app.teams = remoteTeams;
            } else {
                if (!remoteHas && localHas) {
                    console.warn('Firestore teams가 비어있어 로컬 데이터를 유지합니다.');
                }
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
    async saveToFirestore(options = {}) {
        const manual = !!this.app?.manualPersistenceMode;
        const force = options?.force === true;
        if (manual && !force) {
            return;
        }

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
                this.app?.showToast?.('캐릭터 데이터를 불러왔습니다!', 'success');
            } catch (error) {
                this.app?.showAlert?.({ title: '불러오기 실패', message: 'JSON 파일을 읽는데 실패했습니다.' });
                console.error(error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
}
