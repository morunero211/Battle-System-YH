/**
 * 양호후환 전투 시스템 - 메인 애플리케이션
 */

class BattleApp {
    constructor() {
        // 전역 상태
        this.teams = [
            { name: '히어로', characters: [] },
            { name: '정부', characters: [] },
            { name: '빌런', characters: [] }
        ];
        this.selectedCharacters = {
            hero: [],
            gov: [],
            villain: []
        };
        this.battleMode = 'team';
        this.currentEditTeam = null;
        this.currentEditCharId = null; // 수정 중인 캐릭터 ID
        this.battleHistory = []; // 전투 기록
        this.skipRemoteSave = false; // Firestore 기록 생략 여부
        
        // 파일 자동 저장 관련
        this.autoSaveFileHandle = null; // 자동 저장 파일 핸들
        this.autoSaveInterval = null; // 자동 저장 타이머
        this.autoSaveEnabled = false; // 자동 저장 활성화 여부
        this.lastSaveTime = null; // 마지막 저장 시간
        this.nextSaveTime = null; // 다음 저장 시간
        this.remoteSyncInterval = null; // Firestore 주기적 동기화 타이머
        this.currentUserId = null; // 로그인 사용자 ID
        this.currentUsername = null; // 현재 사용자 닉네임
        
        // DOM 요소
        this.initElements();
        this.init();
    }

    /**
     * DOM 요소 초기화
     */
    initElements() {
        this.elements = {
            // 헤더
            header: document.querySelector('header'),
            
            // 팀 리스트
            team1List: document.getElementById('team1-characters'),
            team2List: document.getElementById('team2-characters'),
            team3List: document.getElementById('team3-characters'),
            
            // 검색
            team1Search: document.getElementById('team1-search'),
            team2Search: document.getElementById('team2-search'),
            team3Search: document.getElementById('team3-search'),
            
            // 선택된 캐릭터
            selectedCount: document.getElementById('selected-count'),
            heroSelected: document.getElementById('hero-selected'),
            govSelected: document.getElementById('gov-selected'),
            villainSelected: document.getElementById('villain-selected'),
            
            // 시간 & 컨트롤
            currentTime: document.getElementById('current-time'),
            currentDate: document.getElementById('current-date'),
            combatCurrentTime: document.getElementById('combat-current-time'),
            combatCurrentDate: document.getElementById('combat-current-date'),
                        currentTimeList: document.getElementById('current-time-list'),
                        currentDateList: document.getElementById('current-date-list'),
                        currentTimeHistory: document.getElementById('current-time-history'),
                        currentDateHistory: document.getElementById('current-date-history'),
            modeTeam: document.getElementById('mode-team'),
            mode1v1: document.getElementById('mode-1v1'),
                        modeTeamH: document.getElementById('mode-team-h'),
                        mode1v1H: document.getElementById('mode-1v1-h'),
                        saveCharactersH: document.getElementById('save-characters-h'),
                        loadCharactersH: document.getElementById('load-characters-h'),
            
            // 버튼
            addTeam1: document.getElementById('add-team1'),
            addTeam2: document.getElementById('add-team2'),
            addTeam3: document.getElementById('add-team3'),
            saveCharacters: document.getElementById('save-characters'),
            loadCharacters: document.getElementById('load-characters'),
            fileInput: document.getElementById('file-input'),
                copyCharacters: document.getElementById('copy-characters'),
                copyCharactersH: document.getElementById('copy-characters-h'),
            viewCharacterList: document.getElementById('view-character-list'),
            viewBattleHistory: document.getElementById('view-battle-history'),
            backToSelection: document.getElementById('back-to-selection'),
            backToSelection2: document.getElementById('back-to-selection2'),
            backHome: document.getElementById('back-home'),
            navSelection: document.getElementById('nav-selection'),
            navList: document.getElementById('nav-list'),
            navHistory: document.getElementById('nav-history'),
            navCombat: document.getElementById('nav-combat'),
            themeToggle: document.getElementById('theme-toggle'),
            
            // 모달
            modal: document.getElementById('custom-character-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalClose: document.getElementById('modal-close'),
            modalDelete: document.getElementById('modal-delete'),
            charName: document.getElementById('char-name'),
            charHp: document.getElementById('char-hp'),
            skillDescription: document.getElementById('skill-description'),
            saveCustomChar: document.getElementById('save-custom-char'),
            cancelCustomChar: document.getElementById('cancel-custom-char'),
            
            // 화면
            characterSelection: document.getElementById('character-selection'),
            characterListScreen: document.getElementById('character-list-screen'),
            battleHistoryScreen: document.getElementById('battle-history-screen'),
            
            // 캐릭터 목록 페이지
            characterListContent: document.getElementById('character-list-content'),
            listSearch: document.getElementById('list-search'),
            skillTypeFilter: document.getElementById('skill-type-filter'),
            teamFilter: document.getElementById('team-filter'),
            
            // 전투 기록 페이지
            battleHistoryContent: document.getElementById('battle-history-content'),
            
            // 복사 미리보기 모달
            copyPreviewModal: document.getElementById('copy-preview-modal'),
            copyPreviewContent: document.getElementById('copy-preview-content'),
            copyPreviewClose: document.getElementById('copy-preview-close'),
            copyPreviewRecopy: document.getElementById('copy-preview-recopy'),
            copyPreviewDownload: document.getElementById('copy-preview-download'),
            copyPreviewOk: document.getElementById('copy-preview-ok'),
            
            // 텍스트 붙여넣기 모달
            pasteJsonModal: document.getElementById('paste-json-modal'),
            pasteJsonContent: document.getElementById('paste-json-content'),
            pasteModalClose: document.getElementById('paste-modal-close'),
            pasteJsonClear: document.getElementById('paste-json-clear'),
            pasteJsonApply: document.getElementById('paste-json-apply'),
            pasteJsonCancel: document.getElementById('paste-json-cancel'),
            pasteJsonStatus: document.getElementById('paste-json-status'),
            pasteJson: document.getElementById('paste-json'),
            pasteJsonH: document.getElementById('paste-json-h'),
            
            // 파일 자동 저장
            toggleAutosave: document.getElementById('toggle-autosave'),
            autosaveState: document.getElementById('autosave-state'),
            autosaveLastTime: document.getElementById('autosave-last-time'),
            autosaveNextTime: document.getElementById('autosave-next-time')
        };
    }

    /**
     * 초기화
     */
    init() {
        // 매니저 인스턴스 생성
        this.dataManager = new DataManager(this);
        this.modalManager = new ModalManager(this);
        this.characterManager = new CharacterManager(this);
        this.pageManager = new PageManager(this);
        this.battleSystem = new BattleSystem(this);
    this.battleActions = new BattleActions(this);

        this.loadSampleCharacters();
        this.dataManager.loadFromLocalStorage(); // 저장된 데이터 자동 불러오기
        this.renderAllTeams();
        // Firestore 원격 데이터가 있으면 가져와서 최신 상태로 덮어씀
        this.dataManager.loadFromFirestore();
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        this.startRemoteSyncPolling();
        this.initEventListeners();
        this.initStatSelectors();

        // 개발 모드 로직 제거됨
    }

    /**
     * 샘플 캐릭터 로드
     */
    loadSampleCharacters() {
        // 저장된 데이터가 없을 때만 샘플 로드
        if (this.teams[0].characters.length === 0) {
            this.teams[0].characters = [
                { 
                    name: '김철수', hp: 100, attack: 4, defense: 3, agility: 3, skill: 4, 
                    skillTypes: ['공격형'], skillDescription: '강력한 일격', 
                    status: 'active', id: 'h1' 
                },
                { 
                    name: '이영희', hp: 85, attack: 5, defense: 2, agility: 4, skill: 5, 
                    skillTypes: ['공격형', '지원형'], skillDescription: '빠른 공격과 지원', 
                    status: 'active', id: 'h2' 
                }
            ];

            this.teams[1].characters = [
                { 
                    name: '최강욱', hp: 100, attack: 4, defense: 4, agility: 2, skill: 3, 
                    skillTypes: ['방어형'], skillDescription: '철벽 방어', 
                    status: 'active', id: 'g1' 
                }
            ];

            this.teams[2].characters = [
                { 
                    name: '유재석', hp: 88, attack: 4, defense: 2, agility: 5, skill: 4, 
                    skillTypes: ['공격형'], skillDescription: '빠른 속도로 적을 제압', 
                    status: 'active', id: 'v1' 
                }
            ];
        }
    }

    /**
     * 스탯 선택기 초기화
     */
    initStatSelectors() {
        const statTypes = ['attack', 'defense', 'agility', 'skill'];
        
        statTypes.forEach(statType => {
            const radios = document.querySelectorAll(`input[name="${statType}"]`);
            radios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    const valueSpan = document.getElementById(`${statType}-value`);
                    if (valueSpan) {
                        valueSpan.textContent = e.target.value;
                    }
                });
            });
        });
    }

    /**
     * 이벤트 리스너 초기화
     */
    initEventListeners() {
        // 검색
        this.elements.team1Search?.addEventListener('input', (e) => this.handleSearch(0, e.target.value));
        this.elements.team2Search?.addEventListener('input', (e) => this.handleSearch(1, e.target.value));
        this.elements.team3Search?.addEventListener('input', (e) => this.handleSearch(2, e.target.value));

        // 헤더 클릭 시 홈으로
        this.elements.header?.addEventListener('click', () => {
            this.showPage('character-selection');
        });
        this.elements.header.style.cursor = 'pointer';

        // 캐릭터 추가
        this.elements.addTeam1?.addEventListener('click', () => this.openAddCharacterModal(0));
        this.elements.addTeam2?.addEventListener('click', () => this.openAddCharacterModal(1));
        this.elements.addTeam3?.addEventListener('click', () => this.openAddCharacterModal(2));

        // 모달
        this.elements.modalClose?.addEventListener('click', () => this.closeModal());
        this.elements.cancelCustomChar?.addEventListener('click', () => this.closeModal());
        this.elements.saveCustomChar?.addEventListener('click', () => this.saveCustomCharacter());
        this.elements.modalDelete?.addEventListener('click', () => this.deleteCharacter());
        
        this.elements.modal?.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) {
                this.closeModal();
            }
        });

        // 모드
        this.elements.modeTeam?.addEventListener('click', () => this.setMode('team'));
        this.elements.mode1v1?.addEventListener('click', () => this.startBattle());

    // 모드 (캐릭터 목록/기록)
    this.elements.modeTeamH?.addEventListener('click', () => this.setMode('team'));
    this.elements.mode1v1H?.addEventListener('click', () => this.startBattle());

        // 저장/불러오기
        this.elements.saveCharacters?.addEventListener('click', () => this.downloadJSON());
        this.elements.loadCharacters?.addEventListener('click', () => this.elements.fileInput.click());
            this.elements.copyCharacters?.addEventListener('click', () => this.copyJSONToClipboard());
            this.elements.saveCharactersH?.addEventListener('click', () => this.downloadJSON());
            this.elements.copyCharactersH?.addEventListener('click', () => this.copyJSONToClipboard());
            this.elements.loadCharactersH?.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput?.addEventListener('change', (e) => this.loadJSON(e));

        // 페이지 전환
        this.elements.viewCharacterList?.addEventListener('click', () => this.showCharacterListPage());
        this.elements.viewBattleHistory?.addEventListener('click', () => this.showBattleHistoryPage());
        this.elements.backToSelection?.addEventListener('click', () => this.showPage('character-selection'));
        this.elements.backToSelection2?.addEventListener('click', () => this.showPage('character-selection'));
        this.elements.backHome?.addEventListener('click', () => this.showPage('character-selection'));

        // 헤더 네비게이션
        this.elements.navSelection?.addEventListener('click', () => this.showPage('character-selection'));
        this.elements.navList?.addEventListener('click', () => this.showCharacterListPage());
        this.elements.navHistory?.addEventListener('click', () => this.showBattleHistoryPage());
        this.elements.navCombat?.addEventListener('click', () => this.showBattleCreationPage());

        // 새 전투 생성 버튼 (⚔️ 팀전) - 캐릭터 선택 페이지 유지
        document.getElementById('new-battle-btn')?.addEventListener('click', () => {
            // 이미 캐릭터 선택 화면이므로 아무것도 하지 않음
            console.log('팀전 모드');
        });

        // 전투 시작 버튼 (▶ 전투 시작) - 선택된 캐릭터로 바로 전투 시작
        document.getElementById('start-battle-btn')?.addEventListener('click', () => {
            this.startBattleWithSelectedCharacters();
        });

        // 테마 토글
        this.elements.themeToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleTheme();
        });

        // 캐릭터 목록 필터
        this.elements.listSearch?.addEventListener('input', () => this.filterCharacterList());
        this.elements.skillTypeFilter?.addEventListener('change', () => this.filterCharacterList());
        this.elements.teamFilter?.addEventListener('change', () => this.filterCharacterList());
        
        // 복사 미리보기 모달
        this.elements.copyPreviewClose?.addEventListener('click', () => this.closeCopyPreviewModal());
        this.elements.copyPreviewOk?.addEventListener('click', () => this.closeCopyPreviewModal());
        this.elements.copyPreviewRecopy?.addEventListener('click', () => this.recopyFromPreview());
        this.elements.copyPreviewDownload?.addEventListener('click', () => this.downloadFromPreview());
        this.elements.copyPreviewModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.copyPreviewModal) this.closeCopyPreviewModal();
        });
        
        // 텍스트 붙여넣기 모달
        this.elements.pasteJson?.addEventListener('click', () => this.openPasteJsonModal());
        this.elements.pasteJsonH?.addEventListener('click', () => this.openPasteJsonModal());
        this.elements.pasteModalClose?.addEventListener('click', () => this.closePasteJsonModal());
        this.elements.pasteJsonCancel?.addEventListener('click', () => this.closePasteJsonModal());
        this.elements.pasteJsonClear?.addEventListener('click', () => this.clearPasteJsonContent());
        this.elements.pasteJsonApply?.addEventListener('click', () => this.applyPasteJson());
        this.elements.pasteJsonModal?.addEventListener('click', (e) => {
            if (e.target === this.elements.pasteJsonModal) this.closePasteJsonModal();
        });
        
        // 파일 자동 저장
        // 파일 자동 저장 UI 제거됨

        // 개발 모드 UI 제거됨

        // 드래그 앤 드롭으로 JSON 불러오기
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        document.addEventListener('drop', (e) => {
            if (!e.dataTransfer) return;
            e.preventDefault();
            const file = Array.from(e.dataTransfer.files || []).find(f => f.name.toLowerCase().endsWith('.json'));
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = JSON.parse(evt.target.result);
                    this.applyImportedData(data);
                    alert('드래그한 JSON을 불러왔습니다!');
                } catch (err) {
                    alert('JSON 파싱에 실패했습니다: ' + err.message);
                }
            };
            reader.readAsText(file);
        });

        // 클립보드 붙여넣기로 JSON 불러오기 (입력 필드 포커스가 아닐 때만)
        document.addEventListener('paste', (e) => {
            const active = document.activeElement;
            const isTyping = active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.isContentEditable
            );
            if (isTyping) return;

            const text = e.clipboardData?.getData('text');
            if (!text) return;
            const looksJson = text.trim().startsWith('{') && text.trim().endsWith('}');
            if (!looksJson) return;
            if (!confirm('클립보드의 JSON 데이터를 불러올까요? 현재 데이터가 대체됩니다.')) return;
            try {
                const data = JSON.parse(text);
                this.applyImportedData(data);
                alert('클립보드 JSON을 불러왔습니다!');
            } catch (err) {
                alert('JSON 파싱에 실패했습니다: ' + err.message);
            }
        });
    }

    /**
     * 토스트 표시 (현재 테마에 맞춘 알림)
     */
    showToast(message, type = 'info', title) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-body">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toast-fade-out 200ms ease-out forwards';
            setTimeout(() => toast.remove(), 220);
        }, 3200);
    }

    /**
     * 공용 컨펌 모달 (Promise)
     */
    showConfirm({ title = '확인', message = '계속 진행할까요?', okText = '확인', cancelText = '취소' } = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const t = document.getElementById('confirm-title');
            const m = document.getElementById('confirm-message');
            const ok = document.getElementById('confirm-ok');
            const cancel = document.getElementById('confirm-cancel');
            const closeBtn = document.getElementById('confirm-close');
            if (!modal || !t || !m || !ok || !cancel) {
                resolve(confirm(message));
                return;
            }
            t.textContent = title;
            m.textContent = message;
            ok.textContent = okText;
            cancel.textContent = cancelText;
            modal.style.display = 'block';

            const cleanup = () => {
                modal.style.display = 'none';
                ok.removeEventListener('click', onOk);
                cancel.removeEventListener('click', onCancel);
                closeBtn?.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onBackdrop);
            };
            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };
            const onBackdrop = (e) => { if (e.target === modal) onCancel(); };
            ok.addEventListener('click', onOk);
            cancel.addEventListener('click', onCancel);
            closeBtn?.addEventListener('click', onCancel);
            modal.addEventListener('click', onBackdrop);
        });
    }

    /**
     * 공용 알림 모달 (OK만, 가운데) - Validation 용
     */
    showAlert({ title = '알림', message = '', okText = '확인' } = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const t = document.getElementById('confirm-title');
            const m = document.getElementById('confirm-message');
            const ok = document.getElementById('confirm-ok');
            const cancel = document.getElementById('confirm-cancel');
            const closeBtn = document.getElementById('confirm-close');
            if (!modal || !t || !m || !ok || !cancel) {
                alert(message);
                resolve(true);
                return;
            }
            // 알림 모드: 취소 버튼 숨김
            cancel.style.display = 'none';
            t.textContent = title;
            m.textContent = message;
            ok.textContent = okText;
            modal.style.display = 'block';

            const cleanup = () => {
                modal.style.display = 'none';
                ok.removeEventListener('click', onOk);
                closeBtn?.removeEventListener('click', onOk);
                modal.removeEventListener('click', onBackdrop);
                cancel.style.display = '';
            };
            const onOk = () => { cleanup(); resolve(true); };
            const onBackdrop = (e) => { if (e.target === modal) onOk(); };
            ok.addEventListener('click', onOk);
            closeBtn?.addEventListener('click', onOk);
            modal.addEventListener('click', onBackdrop);
        });
    }

    /**
     * 페이지 표시
     */
    showPage(pageId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('screen-active');
        });
        document.getElementById(pageId)?.classList.add('screen-active');
    }

    /**
     * 모든 팀 렌더링
     */
    renderAllTeams() {
        this.renderTeam(0, this.elements.team1List);
        this.renderTeam(1, this.elements.team2List);
        this.renderTeam(2, this.elements.team3List);
        this.updateSelectedDisplay();
        this.saveToLocalStorage(); // 자동 저장
    }

    /**
     * 특정 팀 렌더링
     */
    renderTeam(teamIndex, container) {
        if (!container) return;
        
        const team = this.teams[teamIndex];
        container.innerHTML = '';

        team.characters.forEach((char) => {
            const item = document.createElement('div');
            item.className = 'character-item';
            
            // 상태에 따라 스타일 추가
            if (char.status === 'dead') {
                item.style.opacity = '0.6';
                item.style.background = '#fed7d7';
            } else if (char.status === 'missing') {
                item.style.opacity = '0.7';
                item.style.background = '#feebc8';
            }
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.isCharacterSelected(teamIndex, char.id);
            checkbox.disabled = char.status !== 'active'; // 비활성 캐릭터는 선택 불가
            checkbox.addEventListener('change', (e) => {
                this.toggleCharacterSelection(teamIndex, char.id, e.target.checked);
            });

            const info = document.createElement('div');
            info.className = 'character-info';
            info.addEventListener('click', (infoEvent) => {
                if (infoEvent.target.tagName !== 'BUTTON') {
                    this.openEditCharacterModal(teamIndex, char.id);
                }
            });

            const name = document.createElement('span');
            name.className = 'character-name';
            name.textContent = char.name;
            if (char.status === 'dead') name.textContent += ' 💀';
            if (char.status === 'missing') name.textContent += ' ❓';

            const hp = document.createElement('span');
            hp.className = 'character-hp';
            hp.textContent = `HP: ${char.hp}`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.requestRemoveCharacter(teamIndex, char.id);
            });

            info.appendChild(name);
            info.appendChild(hp);

            item.appendChild(checkbox);
            item.appendChild(info);
            item.appendChild(removeBtn);

            if (checkbox.checked) {
                item.classList.add('selected');
            }

            // 📍 블록 전체 클릭하면 체크박스 토글
            item.addEventListener('click', (e) => {
                if (e.target !== removeBtn && e.target.tagName !== 'BUTTON' && char.status === 'active') {
                    checkbox.checked = !checkbox.checked;
                    this.toggleCharacterSelection(teamIndex, char.id, checkbox.checked);
                }
            });

            container.appendChild(item);
        });
    }

    /**
     * 캐릭터 선택 토글
     */
    toggleCharacterSelection(teamIndex, charId, isSelected) {
        const teamKey = ['hero', 'gov', 'villain'][teamIndex];
        
        if (isSelected) {
            const char = this.teams[teamIndex].characters.find(c => c.id === charId);
            if (char && char.status === 'active' && !this.selectedCharacters[teamKey].includes(charId)) {
                this.selectedCharacters[teamKey].push(charId);
            }
        } else {
            this.selectedCharacters[teamKey] = this.selectedCharacters[teamKey].filter(id => id !== charId);
        }

        this.renderTeam(teamIndex, [this.elements.team1List, this.elements.team2List, this.elements.team3List][teamIndex]);
        this.updateSelectedDisplay();
    }

    /**
     * 캐릭터가 선택되었는지 확인
     */
    isCharacterSelected(teamIndex, charId) {
        const teamKey = ['hero', 'gov', 'villain'][teamIndex];
        return this.selectedCharacters[teamKey].includes(charId);
    }

    /**
     * 선택된 캐릭터 표시 업데이트
     */
    updateSelectedDisplay() {
        const total = Object.values(this.selectedCharacters).reduce((sum, arr) => sum + arr.length, 0);
        if (this.elements.selectedCount) {
            this.elements.selectedCount.textContent = total;
        }

        this.updateTeamSelectedDisplay(0, this.elements.heroSelected, 'hero');
        this.updateTeamSelectedDisplay(1, this.elements.govSelected, 'gov');
        this.updateTeamSelectedDisplay(2, this.elements.villainSelected, 'villain');
    }

    /**
     * 팀별 선택된 캐릭터 표시
     */
    updateTeamSelectedDisplay(teamIndex, container, teamKey) {
        if (!container) return;
        
        const label = container.querySelector('.team-label');
        container.innerHTML = '';
        if (label) container.appendChild(label);

        this.selectedCharacters[teamKey].forEach(charId => {
            const char = this.teams[teamIndex].characters.find(c => c.id === charId);
            if (char) {
                const charDiv = document.createElement('div');
                charDiv.className = 'selected-character';
                charDiv.textContent = `${char.name} (HP: ${char.hp})`;
                container.appendChild(charDiv);
            }
        });
    }

    /**
     * 캐릭터 제거
     */
    removeCharacter(teamIndex, charId) {
        // 실제 삭제만 수행 (확인은 호출 측에서 처리)
        this.teams[teamIndex].characters = this.teams[teamIndex].characters.filter(c => c.id !== charId);
        const teamKey = ['hero', 'gov', 'villain'][teamIndex];
        this.selectedCharacters[teamKey] = this.selectedCharacters[teamKey].filter(id => id !== charId);
        this.saveToLocalStorage();
        const activeScreen = document.querySelector('.screen.screen-active')?.id;
        if (activeScreen === 'character-list-screen') {
            this.renderCharacterList();
        } else {
            this.renderAllTeams();
        }
    }

    async requestRemoveCharacter(teamIndex, charId) {
        const char = this.teams[teamIndex].characters.find(c => c.id === charId);
        const ok = await this.showConfirm({
            title: '캐릭터 삭제',
            message: `정말로 '${char?.name || '캐릭터'}'를 삭제하시겠습니까?`,
            okText: '삭제',
            cancelText: '취소'
        });
        if (ok) {
            this.removeCharacter(teamIndex, charId);
            this.showToast('캐릭터가 삭제되었습니다.', 'success');
        }
    }

    /**
     * 검색 처리
     */
    handleSearch(teamIndex, query) {
        const containers = [this.elements.team1List, this.elements.team2List, this.elements.team3List];
        const container = containers[teamIndex];
        if (!container) return;
        
        const items = container.querySelectorAll('.character-item');

        items.forEach(item => {
            const name = item.querySelector('.character-name')?.textContent.toLowerCase() || '';
            if (name.includes(query.toLowerCase())) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    /**
     * 캐릭터 추가 모달 열기
     */
    openAddCharacterModal(teamIndex) {
        this.currentEditTeam = teamIndex;
        this.currentEditCharId = null;
        this.clearCustomForm();
        if (this.elements.modalTitle) this.elements.modalTitle.textContent = '캐릭터 생성';
        if (this.elements.modalDelete) this.elements.modalDelete.classList.add('hidden');
        if (this.elements.modal) this.elements.modal.style.display = 'block';
        this.enforceSingleSkillType();
    }

    /**
     * 캐릭터 수정 모달 열기
     */
    openEditCharacterModal(teamIndex, charId) {
        console.log('openEditCharacterModal 호출됨:', teamIndex, charId);
        this.currentEditTeam = teamIndex;
        this.currentEditCharId = charId;
        
        const char = this.teams[teamIndex].characters.find(c => c.id === charId);
        if (!char) {
            console.error('캐릭터를 찾을 수 없음:', teamIndex, charId);
            return;
        }

        // 폼에 데이터 채우기
        if (this.elements.charName) this.elements.charName.value = char.name;
        if (this.elements.charHp) this.elements.charHp.value = char.hp;
        if (this.elements.skillDescription) this.elements.skillDescription.value = char.skillDescription || '';

        // 스탯 설정
        ['attack', 'defense', 'agility', 'skill'].forEach(stat => {
            const radio = document.querySelector(`input[name="${stat}"][value="${char[stat] || 3}"]`);
            if (radio) radio.checked = true;
            const valueSpan = document.getElementById(`${stat}-value`);
            if (valueSpan) valueSpan.textContent = char[stat] || 3;
        });

        // 스킬 타입 설정
        const skillTypeCheckboxes = document.querySelectorAll('input[name="skillType"]');
        skillTypeCheckboxes.forEach(checkbox => {
            checkbox.checked = char.skillTypes && char.skillTypes.includes(checkbox.value);
        });

        // 상태 설정
        const statusRadio = document.querySelector(`input[name="status"][value="${char.status || 'active'}"]`);
        if (statusRadio) statusRadio.checked = true;

        if (this.elements.modalTitle) this.elements.modalTitle.textContent = '캐릭터 수정';
        if (this.elements.modalDelete) this.elements.modalDelete.classList.remove('hidden');
        
        console.log('모달 열기 시도, 모달 요소:', this.elements.modal);
        if (this.elements.modal) {
            this.elements.modal.style.display = 'block';
            console.log('모달 display:', this.elements.modal.style.display);
        }
        this.enforceSingleSkillType();
    }

    /**
     * 모달 닫기
     */
    closeModal() {
        if (this.elements.modal) this.elements.modal.style.display = 'none';
        this.currentEditTeam = null;
        this.currentEditCharId = null;
    }

    /**
     * 커스텀 폼 초기화
     */
    clearCustomForm() {
        if (this.elements.charName) this.elements.charName.value = '';
        if (this.elements.charHp) this.elements.charHp.value = 100;
        if (this.elements.skillDescription) this.elements.skillDescription.value = '';
        
        ['attack', 'defense', 'agility', 'skill'].forEach(stat => {
            const radio = document.querySelector(`input[name="${stat}"][value="3"]`);
            if (radio) radio.checked = true;
            const valueSpan = document.getElementById(`${stat}-value`);
            if (valueSpan) valueSpan.textContent = '3';
        });

        document.querySelectorAll('input[name="skillType"]').forEach(cb => cb.checked = false);
        
        const activeRadio = document.querySelector('input[name="status"][value="active"]');
        if (activeRadio) activeRadio.checked = true;
    }

    /**
     * 스킬 타입 한 개만 선택되도록 강제 + 즉시 팝업 안내
     */
    enforceSingleSkillType() {
        const boxes = Array.from(document.querySelectorAll('input[name="skillType"]'));
        if (boxes.length === 0) return;
        const handler = async (e) => {
            const checked = boxes.filter(cb => cb.checked);
            if (checked.length > 1) {
                // 방금 체크한 항목을 되돌림
                e.target.checked = false;
                await this.showAlert({ title: '제한', message: '스킬 타입은 한 개만 선택할 수 있습니다.' });
            }
        };
        boxes.forEach(cb => {
            cb.removeEventListener('change', handler);
            cb.addEventListener('change', handler);
        });
    }

    /**
     * 커스텀 캐릭터 저장
     */
    saveCustomCharacter() {
        const name = this.elements.charName?.value.trim();
        if (!name) {
            this.showToast('캐릭터 이름을 입력해주세요!', 'danger');
            return;
        }

        const hp = parseInt(this.elements.charHp?.value || 100);
        if (hp < 10 || hp > 100) {
            alert('HP는 10~100 사이로 입력해주세요!');
            return;
        }

        const attack = parseInt(document.querySelector('input[name="attack"]:checked')?.value || 3);
        const defense = parseInt(document.querySelector('input[name="defense"]:checked')?.value || 3);
        const agility = parseInt(document.querySelector('input[name="agility"]:checked')?.value || 3);
        const skill = parseInt(document.querySelector('input[name="skill"]:checked')?.value || 3);

        const skillTypes = Array.from(document.querySelectorAll('input[name="skillType"]:checked'))
            .map(cb => cb.value);

        if (skillTypes.length > 1) {
            this.showAlert({ title: '제한', message: '스킬 타입은 한 개만 선택할 수 있습니다.' });
            return;
        }

        const skillDescription = this.elements.skillDescription?.value.trim() || '';
        const status = document.querySelector('input[name="status"]:checked')?.value || 'active';

        if (this.currentEditCharId) {
            // 수정
            const char = this.teams[this.currentEditTeam].characters.find(c => c.id === this.currentEditCharId);
            if (char) {
                char.name = name;
                char.hp = hp;
                char.attack = attack;
                char.defense = defense;
                char.agility = agility;
                char.skill = skill;
                char.skillTypes = skillTypes;
                char.skillDescription = skillDescription;
                char.status = status;
            }
        } else {
            // 추가
            const newChar = {
                name, hp, attack, defense, agility, skill,
                skillTypes, skillDescription, status,
                id: `custom_${Date.now()}`
            };
            this.teams[this.currentEditTeam].characters.push(newChar);
        }

        // 먼저 자동 저장
        this.saveToLocalStorage();

        // 현재 활성 페이지에 맞춰 즉시 새로고침
        const activeScreen = document.querySelector('.screen.screen-active')?.id;
        if (activeScreen === 'character-list-screen') {
            this.renderCharacterList();
        } else {
            this.renderAllTeams();
        }

        this.closeModal();
        this.showToast(this.currentEditCharId ? '캐릭터가 수정되었습니다!' : '캐릭터가 생성되었습니다!', 'success');
    }

    /**
     * 캐릭터 삭제
     */
    deleteCharacter() {
        if (!this.currentEditCharId) return;
        this.showConfirm({
            title: '캐릭터 삭제',
            message: '정말로 이 캐릭터를 삭제하시겠습니까?',
            okText: '삭제',
            cancelText: '취소'
        }).then((ok) => {
            if (ok) {
                this.removeCharacter(this.currentEditTeam, this.currentEditCharId);
                this.closeModal();
                this.showToast('캐릭터가 삭제되었습니다.', 'success');
            }
        });
    }

    /**
     * 모드 설정
     */
    setMode(mode) {
        this.battleMode = mode;
        
        if (mode === 'team') {
            this.elements.modeTeam?.classList.add('active');
            this.elements.mode1v1?.classList.remove('active');
            if (this.elements.mode1v1) this.elements.mode1v1.textContent = '▶ 전투 시작';
        }
    }

    /**
     * 선택된 캐릭터로 전투 시작
     */
    startBattleWithSelectedCharacters() {
        const total = Object.values(this.selectedCharacters).reduce((sum, arr) => sum + arr.length, 0);
        
        if (total < 2) {
            alert('⚠️ 최소 2명 이상의 캐릭터를 선택해주세요!\n\n💡 Main 화면의 캐릭터 목록을 클릭하여 전투에 참여할 캐릭터를 선택하세요.');
            return;
        }

        // 선택된 캐릭터로 전투 시작
        this.startBattle();
    }

    /**
     * 전투 시작
     */
    startBattle() {
        const total = Object.values(this.selectedCharacters).reduce((sum, arr) => sum + arr.length, 0);
        
        if (total < 2) {
            alert('최소 2명 이상의 캐릭터를 선택해주세요!');
            return;
        }

        const selectedInfo = {
            hero: this.selectedCharacters.hero.map(id => 
                this.teams[0].characters.find(c => c.id === id)
            ).filter(c => c && c.status === 'active'),
            gov: this.selectedCharacters.gov.map(id => 
                this.teams[1].characters.find(c => c.id === id)
            ).filter(c => c && c.status === 'active'),
            villain: this.selectedCharacters.villain.map(id => 
                this.teams[2].characters.find(c => c.id === id)
            ).filter(c => c && c.status === 'active')
        };

        // 전투 기록 저장
        const now = new Date();
        const dateFormat = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        const initialHp = {};
        const initialStats = {};
        ['hero','gov','villain'].forEach(k => {
            (selectedInfo[k] || []).forEach(c => { 
                if (c && c.id) {
                    initialHp[c.id] = c.hp;
                    initialStats[c.id] = {
                        attack: c.attack,
                        defense: c.defense,
                        agility: c.agility,
                        skill: c.skill,
                        status: c.status
                    };
                }
            });
        });

        const battleRecord = {
            id: `battle_${Date.now()}`,
            date: dateFormat,
            mode: this.battleMode,
            teams: selectedInfo,
            winner: '미정',
            initialHp,
            initialStats
        };
        
        this.battleHistory.push(battleRecord);
        this.saveToLocalStorage();

        // 전투 시스템 초기화 및 시작
        this.battleSystem.combatCharacters = {
            hero: selectedInfo.hero,
            gov: selectedInfo.gov,
            villain: selectedInfo.villain
        };

        this.battleSystem.initializeBattle();
        this.battleSystem.renderBattle();

        // 전투 화면으로 이동
        this.pageManager.showPage('combat-screen');

        // 전투 종료 화면 숨기기
        const endScreen = document.getElementById('combat-end');
        if (endScreen) endScreen.classList.add('hidden');
    }

    /**
     * JSON 파일로 다운로드
     */
    downloadJSON() {
        const data = {
            teams: this.teams,
            selectedCharacters: this.selectedCharacters,
            battleHistory: this.battleHistory,
            exportDate: new Date().toISOString()
        };

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `battle_data_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('데이터가 JSON 파일로 다운로드되었습니다!');
    }

    /**
     * 전체 데이터 클립보드 복사
     */
    async copyJSONToClipboard() {
        try {
            const data = {
                teams: this.teams,
                selectedCharacters: this.selectedCharacters,
                battleHistory: this.battleHistory,
                exportDate: new Date().toISOString()
            };
            const json = JSON.stringify(data, null, 2);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(json);
            } else {
                const ta = document.createElement('textarea');
                ta.value = json;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            this.showCopyPreview(json, '전체 데이터', 'full');
        } catch (err) {
            alert('클립보드 복사에 실패했습니다: ' + err.message);
        }
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
                this.applyImportedData(data);
                alert('데이터를 성공적으로 불러왔습니다!');
            } catch (error) {
                alert('JSON 파일을 읽는 중 오류가 발생했습니다: ' + error.message);
            }
        };
        
        reader.readAsText(file);
        event.target.value = '';
    }

    /**
     * 가져온 JSON 데이터 적용 공통 로직
     */
    applyImportedData(data) {
        if (!data || typeof data !== 'object') return;

        // 전투 변화 패치 적용 (부분 적용, 안전 덮어쓰기)
        if (data.type === 'battle-delta' && Array.isArray(data.changes)) {
            const changes = data.changes;
            const idToChar = new Map();
            this.teams.forEach(team => team.characters.forEach(c => { if (c && c.id) idToChar.set(c.id, c); }));

            const skipped = [];
            let applied = 0;
            let statsApplied = 0;
            
            changes.forEach(ch => {
                const target = idToChar.get(ch.id);
                if (!target) { skipped.push({ id: ch.id, reason: '캐릭터 없음' }); return; }

                const curHp = target.hp;
                const expect = typeof ch.hpBefore === 'number' ? ch.hpBefore : undefined;
                const nextHp = typeof ch.hpAfter === 'number' ? ch.hpAfter : undefined;

                // 안전 덮어쓰기: 기대값과 다르면 건너뜀
                if (expect !== undefined && curHp !== expect) {
                    skipped.push({ id: ch.id, reason: `현재 HP(${curHp})가 기대값(${expect})과 다름` });
                    return;
                }

                // HP 적용
                if (nextHp !== undefined) {
                    target.hp = nextHp;
                    applied++;
                }
                
                // 스탯 변화 적용
                if (ch.statChanges && typeof ch.statChanges === 'object') {
                    Object.keys(ch.statChanges).forEach(key => {
                        const change = ch.statChanges[key];
                        if (change && change.after !== undefined) {
                            target[key] = change.after;
                            statsApplied++;
                        }
                    });
                }
            });

            this.renderAllTeams();
            this.saveToLocalStorage();

            const msg = [
                `HP 적용: ${applied}개`,
                statsApplied > 0 ? `스탯 적용: ${statsApplied}개` : '',
                skipped.length ? `건너뜀: ${skipped.length}개` : ''
            ];
            alert(msg.filter(Boolean).join(' | '));
            return;
        }

        if (data.teams && Array.isArray(data.teams)) {
            this.teams = data.teams;
        }

        if (data.selectedCharacters && typeof data.selectedCharacters === 'object') {
            this.selectedCharacters = data.selectedCharacters;
        }

        if (data.battleHistory && Array.isArray(data.battleHistory)) {
            this.battleHistory = data.battleHistory;
        }

        this.renderAllTeams();
        this.saveToLocalStorage();
    }

    /**
     * 로컬 스토리지에 저장
     */
    saveToLocalStorage() {
        try {
            const data = {
                teams: this.teams,
                selectedCharacters: this.selectedCharacters,
                battleHistory: this.battleHistory
            };
            localStorage.setItem('battleProgramData', JSON.stringify(data));
        } catch (error) {
            console.error('로컬 스토리지 저장 실패:', error);
        }

        // Firestore 동기화 (비동기, 실패해도 앱 동작에는 영향 없음)
        if (this.dataManager && typeof this.dataManager.saveToFirestore === 'function' && !this.skipRemoteSave) {
            this.dataManager.saveToFirestore().catch((err) => {
                console.error('원격 저장 실패:', err);
            });
        }
    }

    /**
     * Firestore에서 주기적으로 최신 데이터를 받아오는 간단한 폴링
     */
    startRemoteSyncPolling() {
        if (this.remoteSyncInterval) return; // 중복 방지
        this.remoteSyncInterval = setInterval(() => {
            if (this.dataManager && typeof this.dataManager.loadFromFirestore === 'function') {
                if (!this.dataManager.userId) return; // 로그인 전에는 건너뜀
                this.dataManager.loadFromFirestore();
            }
        }, 30000); // 30초 간격
    }
    // 개발 모드 관련 로직 제거됨

    /**
// ---- 인증/앱 진입 가드 ----
function setupAuthUI() {
    const modal = document.getElementById('auth-modal');
    const openBtn = document.getElementById('login-btn'); // 헤더의 로그인 버튼
    const closeBtn = document.getElementById('auth-close');
    const loginBtn = document.getElementById('auth-login');
    const signupBtn = document.getElementById('auth-signup');
    const googleBtn = document.getElementById('auth-google');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const errorBox = document.getElementById('auth-error');
    const banner = document.getElementById('auth-banner');

    const showError = (msg) => {
        if (errorBox) errorBox.textContent = msg || '';
    };

    const openModal = () => {
        if (modal) modal.style.display = 'flex';
        showError('');
    };

    const closeModal = () => {
        if (modal) modal.style.display = 'none';
        showError('');
    };

    openBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);

    const getAuth = () => {
        if (window.firebase && firebase.auth) return firebase.auth();
        console.error('Firebase Auth 가 로드되지 않았습니다.');
        showError('Firebase가 초기화되지 않았습니다.');
        return null;
    };

    loginBtn?.addEventListener('click', async () => {
        const auth = getAuth();
        if (!auth) return;
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;
        if (!email || !password) {
            showError('이메일과 비밀번호를 입력하세요.');
            return;
        }
        try {
            await auth.signInWithEmailAndPassword(email, password);
            closeModal();
        } catch (err) {
            showError(err.message || '로그인 실패');
        }
    });

    signupBtn?.addEventListener('click', async () => {
        const auth = getAuth();
        if (!auth) return;
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;
        if (!email || !password) {
            showError('이메일과 비밀번호를 입력하세요.');
            return;
        }
        try {
            await auth.createUserWithEmailAndPassword(email, password);
            closeModal();
        } catch (err) {
            showError(err.message || '회원가입 실패');
        }
    });

    googleBtn?.addEventListener('click', async () => {
        const auth = getAuth();
        if (!auth) return;
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await auth.signInWithPopup(provider);
            closeModal();
        } catch (err) {
            showError(err.message || 'Google 로그인 실패');
        }
    });

    // 모달 배경 클릭 시 닫기
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // 배너 노출/숨김 제어를 위해 반환
    return {
        showBanner: () => { if (banner) banner.style.display = 'flex'; },
        hideBanner: () => { if (banner) banner.style.display = 'none'; },
        openModal,
        closeModal,
        showError
    };
}

function initAuthGuard(providedUi) {
    const ui = providedUi || setupAuthUI();

    if (!window.firebase || !firebase.auth) {
        console.error('Firebase Auth가 로드되지 않았습니다.');
        ui?.openModal?.();
        ui?.showError?.('Firebase 설정이 필요합니다. index.html의 firebaseConfig를 채워주세요.');
        return;
    }

    firebase.auth().onAuthStateChanged((user) => {
        const loginBtn = document.getElementById('login-btn');
        
        if (user) {
            ui?.hideBanner?.();
            ui?.closeModal?.();
            
            // 로그인 버튼을 로그아웃 버튼으로 변경
            if (loginBtn) {
                loginBtn.textContent = '🚪';
                loginBtn.title = '로그아웃';
                loginBtn.onclick = async () => {
                    if (confirm('로그아웃 하시겠습니까?')) {
                        await firebase.auth().signOut();
                        alert('로그아웃되었습니다.');
                    }
                };
            }

            // 앱 인스턴스가 없으면 생성하고 사용자 설정
            if (!window.app) {
                window.app = new BattleApp();
            }

            if (window.app.dataManager?.setUser) {
                window.app.dataManager.setUser(user.uid);
                // 로그인한 사용자 키로 다시 로드/렌더
                window.app.dataManager.loadFromLocalStorage();
                if (typeof window.app.renderAllTeams === 'function') {
                    window.app.renderAllTeams();
                }
                window.app.dataManager.loadFromFirestore();
            }
        } else {
            // 로그인 전: 로그인 버튼으로 설정
            if (loginBtn) {
                loginBtn.textContent = '👤';
                loginBtn.title = '로그인';
                loginBtn.onclick = () => ui?.openModal?.();
            }
            
            // 로그인 전: 모달을 표시하고 배너는 숨김
            ui?.hideBanner?.();
            // 로그인하지 않아도 앱 사용 가능하도록 모달 자동 열기 제거
            // ui?.openModal?.();
            
            // 앱이 이미 생성되어 있으면 메모리 상태 초기화를 위해 새로고침
            if (window.app) {
                window.location.reload();
            }
        }
    });
}

// 초기화: 인증 가드부터 설정
document.addEventListener('DOMContentLoaded', () => {
    const ui = setupAuthUI();
    // 초기 진입 시 바로 로그인 모달을 띄워 배경 흐림 처리
    ui?.openModal?.();
    initAuthGuard(ui);
});
            const data = localStorage.getItem('battleProgramData');
            if (data) {
                const parsed = JSON.parse(data);
                
                if (parsed.teams && Array.isArray(parsed.teams) && parsed.teams[0].characters.length > 0) {
                    this.teams = parsed.teams;
                }
                
                if (parsed.selectedCharacters) {
                    this.selectedCharacters = parsed.selectedCharacters;
                }
                
                if (parsed.battleHistory && Array.isArray(parsed.battleHistory)) {
                    this.battleHistory = parsed.battleHistory;
                }
            }
        } catch (error) {
            console.error('로컬 스토리지 불러오기 실패:', error);
        }
    }

    /**
     * 파일 자동 저장 토글
     */
    async toggleAutoSave() {
        if (this.autoSaveEnabled) {
            // 중지
            if (this.autoSaveInterval) {
                clearInterval(this.autoSaveInterval);
                this.autoSaveInterval = null;
            }
            this.autoSaveEnabled = false;
            this.autoSaveFileHandle = null;
            this.lastSaveTime = null;
            this.nextSaveTime = null;
            this.updateAutoSaveDisplay();
            alert('파일 자동 저장이 중지되었습니다.');
        } else {
            // 활성화
            await this.setupAutoSaveToFile();
        }
    }

    /**
     * 자동 저장 타이머 시작/재설정
     */
    startAutoSaveTimer() {
        console.log('[DEBUG] startAutoSaveTimer 호출');
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }

        this.autoSaveInterval = setInterval(async () => {
            console.log('[DEBUG] 30초 주기 자동 저장 실행');
            await this.saveToFile();
        }, 30000); // 30초

        console.log('[DEBUG] autoSaveInterval 설정 완료:', this.autoSaveInterval);
    }

    /**
     * 파일 자동 저장 설정
     */
    async setupAutoSaveToFile() {
        try {
            console.log('[DEBUG] setupAutoSaveToFile 시작');
            
            // File System Access API 지원 확인
            if (!('showOpenFilePicker' in window)) {
                alert('이 브라우저는 파일 자동 저장을 지원하지 않습니다.\nChrome, Edge 등 최신 브라우저를 사용해주세요.');
                return;
            }

            console.log('[DEBUG] 파일 선택 다이얼로그 열기...');
            // 사용자에게 자동 저장 대상 파일 선택 (열기 방식)
            const fileHandles = await window.showOpenFilePicker({
                multiple: false,
                types: [{
                    description: 'JSON 파일',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            const handle = fileHandles?.[0];
            if (!handle) {
                console.log('[INFO] 파일을 선택하지 않았습니다.');
                return;
            }

            console.log('[DEBUG] 파일 선택됨:', handle.name);
            this.autoSaveFileHandle = handle;
            this.autoSaveEnabled = true;

            // 명시적으로 쓰기 권한 요청 (거부되면 중단)
            if (this.autoSaveFileHandle.requestPermission) {
                const permission = await this.autoSaveFileHandle.requestPermission({ mode: 'readwrite' });
                console.log('[DEBUG] 파일 권한 상태:', permission);
                if (permission !== 'granted') {
                    alert('파일 쓰기 권한이 거부되었습니다. 다시 시도해주세요.');
                    this.autoSaveEnabled = false;
                    this.autoSaveFileHandle = null;
                    this.updateAutoSaveDisplay();
                    return;
                }
            }

            // 즉시 한 번 저장
            console.log('[DEBUG] 즉시 저장 시작...');
            await this.saveToFile();
            console.log('[DEBUG] 즉시 저장 완료');

            // 30초마다 자동 저장 (원하시면 시간 조정 가능)
            this.startAutoSaveTimer();

            console.log('[DEBUG] setupAutoSaveToFile 끝 - updateAutoSaveDisplay 호출');
            this.updateAutoSaveDisplay();
            alert('파일 자동 저장이 활성화되었습니다!\n30초마다 자동으로 저장됩니다.');
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('❌ 파일 자동 저장 설정 실패:', error);
                alert('파일 자동 저장 설정에 실패했습니다.');
            } else {
                console.log('[INFO] 사용자가 파일 선택을 취소했습니다.');
            }
        }
    }

    /**
     * 파일로 저장
     */
    async saveToFile() {
        console.log('[DEBUG] saveToFile 시작');
        console.log('[DEBUG] autoSaveFileHandle:', this.autoSaveFileHandle);
        
        if (!this.autoSaveFileHandle) {
            console.error('[ERROR] autoSaveFileHandle이 없습니다!');
            return;
        }

        try {
            console.log('[DEBUG] 데이터 준비 중...');
            const data = {
                teams: this.teams,
                selectedCharacters: this.selectedCharacters,
                battleHistory: this.battleHistory,
                savedAt: new Date().toISOString()
            };

            console.log('[DEBUG] 파일 쓰기 시작...');
            const writable = await this.autoSaveFileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
            console.log('[DEBUG] 파일 쓰기 완료');

            this.lastSaveTime = new Date();
            this.nextSaveTime = new Date(this.lastSaveTime.getTime() + 30000); // 30초 후
            console.log('[DEBUG] lastSaveTime 설정:', this.lastSaveTime);
            console.log('[DEBUG] nextSaveTime 설정:', this.nextSaveTime);
            
            console.log('[DEBUG] updateAutoSaveDisplay 호출 전');
            this.updateAutoSaveDisplay();
            console.log('[DEBUG] updateAutoSaveDisplay 호출 후');
            
            console.log('✅ 파일 자동 저장 완료:', this.lastSaveTime.toLocaleTimeString());
        } catch (error) {
            console.error('❌ 파일 저장 실패:', error);
            // 저장 실패 시 자동 저장 비활성화
            this.autoSaveEnabled = false;
            if (this.autoSaveInterval) {
                clearInterval(this.autoSaveInterval);
                this.autoSaveInterval = null;
            }
            this.updateAutoSaveDisplay();
        }
    }

    /**
     * 자동 저장 디스플레이 업데이트
     */
    updateAutoSaveDisplay() {
        console.log('[DEBUG] updateAutoSaveDisplay 호출됨');
        console.log('[DEBUG] autoSaveEnabled:', this.autoSaveEnabled);
        console.log('[DEBUG] lastSaveTime:', this.lastSaveTime);
        console.log('[DEBUG] elements.autosaveState:', this.elements.autosaveState);
        console.log('[DEBUG] elements.autosaveLastTime:', this.elements.autosaveLastTime);
        
        if (!this.elements.autosaveState) {
            console.error('[ERROR] autosaveState 엘리먼트를 찾을 수 없습니다!');
            return;
        }

        if (this.autoSaveEnabled) {
            this.elements.autosaveState.textContent = '🟢 활성화';
            this.elements.autosaveState.className = 'autosave-state active';
            
            if (this.elements.toggleAutosave) {
                this.elements.toggleAutosave.textContent = '중지';
                this.elements.toggleAutosave.classList.add('active');
            }
            
            if (this.lastSaveTime && this.elements.autosaveLastTime) {
                const timeString = this.lastSaveTime.toLocaleTimeString();
                console.log('[DEBUG] 시간 표시:', timeString);
                this.elements.autosaveLastTime.textContent = 
                    `마지막 저장: ${timeString}`;
            } else {
                console.log('[DEBUG] lastSaveTime 또는 autosaveLastTime이 없음');
                if (this.elements.autosaveLastTime) {
                    this.elements.autosaveLastTime.textContent = '마지막 저장: 아직 없음';
                }
            }
        } else {
            this.elements.autosaveState.textContent = '⚪ 대기 중';
            this.elements.autosaveState.className = 'autosave-state inactive';
            
            if (this.elements.toggleAutosave) {
                this.elements.toggleAutosave.textContent = '활성화';
                this.elements.toggleAutosave.classList.remove('active');
            }
            
            if (this.elements.autosaveLastTime) {
                this.elements.autosaveLastTime.textContent = '-';
            }
            if (this.elements.autosaveNextTime) {
                this.elements.autosaveNextTime.textContent = '-';
            }
        }
    }

    /**
     * 자동 저장 카운트다운 업데이트
     */
    updateAutoSaveCountdown() {
        if (!this.autoSaveEnabled || !this.nextSaveTime || !this.elements.autosaveNextTime) {
            return;
        }

        const now = new Date();
        const remaining = Math.max(0, Math.floor((this.nextSaveTime - now) / 1000));
        
        if (remaining > 0) {
            this.elements.autosaveNextTime.textContent = `다음 저장: ${remaining}초 후`;
        } else {
            this.elements.autosaveNextTime.textContent = '저장 중...';
        }
    }

    /**
     * 파일 자동 저장 중지 (구버전 호환)
     */
    stopAutoSave() {
        this.toggleAutoSave();
    }

    /**
     * 시계 업데이트
     */
    updateClock() {
        const now = new Date();
        
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = `${hours}:${minutes}:${seconds}`;
        }
        if (this.elements.combatCurrentTime) {
            this.elements.combatCurrentTime.textContent = `${hours}:${minutes}:${seconds}`;
                }
                if (this.elements.currentTimeList) {
                    this.elements.currentTimeList.textContent = `${hours}:${minutes}:${seconds}`;
                }
                if (this.elements.currentTimeHistory) {
                    this.elements.currentTimeHistory.textContent = `${hours}:${minutes}:${seconds}`;
        }
        
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        
        if (this.elements.currentDate) {
            this.elements.currentDate.textContent = `${year}년 ${month}월 ${date}일`;
        }
        if (this.elements.combatCurrentDate) {
            this.elements.combatCurrentDate.textContent = `${year}년 ${month}월 ${date}일`;
                }
                if (this.elements.currentDateList) {
                    this.elements.currentDateList.textContent = `${year}년 ${month}월 ${date}일`;
                }
                if (this.elements.currentDateHistory) {
                    this.elements.currentDateHistory.textContent = `${year}년 ${month}월 ${date}일`;
        }
        
        // 자동 저장 카운트다운 업데이트
        this.updateAutoSaveCountdown();
    }

    /**
     * 테마 토글
     */
    toggleTheme() {
        const next = document.body.classList.toggle('dark-theme');
        if (this.elements.themeToggle) {
            this.elements.themeToggle.textContent = next ? '☀️' : '🌙';
        }
    }

    /**
     * 캐릭터 목록 페이지 표시
     */
    showCharacterListPage() {
        this.showPage('character-list-screen');
        this.renderCharacterList();
    }

    /**
     * 캐릭터 목록 렌더링
     */
    renderCharacterList() {
        console.log('renderCharacterList 호출됨');
        if (!this.elements.characterListContent) {
            console.error('characterListContent 요소를 찾을 수 없습니다!');
            return;
        }
        
        this.elements.characterListContent.innerHTML = '';

        // 헤더
        const header = document.createElement('div');
        header.className = 'char-table-row header';
        header.innerHTML = `
            <div class="char-table-cell">소속</div>
            <div class="char-table-cell">이름</div>
            <div class="char-table-cell">HP</div>
            <div class="char-table-cell">공격</div>
            <div class="char-table-cell">방어</div>
            <div class="char-table-cell">민첩</div>
            <div class="char-table-cell">스킬</div>
            <div class="char-table-cell">스킬타입</div>
            <div class="char-table-cell status-cell">상태</div>
        `;
        this.elements.characterListContent.appendChild(header);

        // 팀 라벨 맵
        const teamLabels = {
            0: '👤 히어로',
            1: '👤 정부',
            2: '👤 빌런'
        };

        // 모든 캐릭터
        let totalCharacters = 0;
        this.teams.forEach((team, teamIndex) => {
            team.characters.forEach(char => {
                totalCharacters++;
                const row = document.createElement('div');
                row.className = 'char-table-row';
                row.dataset.teamIndex = teamIndex;
                row.dataset.charId = char.id;
                row.style.display = 'grid';  // 기본적으로 표시
                console.log('행 생성:', teamIndex, char.id, char.name);
                
                const skillTags = char.skillTypes ? char.skillTypes.map(type => 
                    `<span class="skill-tag">${type}</span>`
                ).join('') : '';

                const statusClass = char.status || 'active';
                const statusText = {
                    'active': '✅ 활동중',
                    'dead': '💀 사망',
                    'missing': '❓ 실종'
                }[statusClass];

                row.innerHTML = `
                    <div class="char-table-cell">${teamLabels[teamIndex]}</div>
                    <div class="char-table-cell">${char.name}</div>
                    <div class="char-table-cell">${char.hp}</div>
                    <div class="char-table-cell">${char.attack || 3}</div>
                    <div class="char-table-cell">${char.defense || 3}</div>
                    <div class="char-table-cell">${char.agility || 3}</div>
                    <div class="char-table-cell">${char.skill || 3}</div>
                    <div class="char-table-cell char-skill-tags">${skillTags || '-'}</div>
                    <div class="char-table-cell status-cell"><span class="char-status ${statusClass}">${statusText}</span></div>
                `;
                
                // 선택된 캐릭터면 배경색 표시
                const teamKey = ['hero', 'gov', 'villain'][teamIndex];
                if (this.selectedCharacters[teamKey].includes(char.id)) {
                    row.style.background = 'rgba(66, 153, 225, 0.15)';
                    row.style.borderLeft = '4px solid #4299e1';
                }
                
                // 클릭 이벤트 바인드 - 캐릭터를 전투에 참여시킬지 여부 선택
                const clickHandler = () => {
                    console.log('Row clicked! teamIndex:', teamIndex, 'charId:', char.id);
                    
                    // 활동 중인 캐릭터만 선택 가능
                    if (char.status !== 'active') {
                        alert('⚠️ 활동 중인 캐릭터만 선택할 수 있습니다!');
                        return;
                    }
                    
                    // 캐릭터 선택/해제
                    const teamKey = ['hero', 'gov', 'villain'][teamIndex];
                    const isCurrentlySelected = this.selectedCharacters[teamKey].includes(char.id);
                    
                    if (isCurrentlySelected) {
                        // 선택 해제
                        this.toggleCharacterSelection(teamIndex, char.id, false);
                        row.style.background = '';
                    } else {
                        // 선택
                        this.toggleCharacterSelection(teamIndex, char.id, true);
                        row.style.background = 'rgba(66, 153, 225, 0.1)';
                    }
                    
                    this.updateSelectedCount();
                    this.renderCharacterList();
                };
                row.addEventListener('click', clickHandler);
                
                this.elements.characterListContent.appendChild(row);
            });
        });
        
        console.log('총 캐릭터 수:', totalCharacters);
        this.filterCharacterList();
    }

    /**
     * 캐릭터 목록 필터링
     */
    filterCharacterList() {
        console.log('filterCharacterList 호출됨');
        if (!this.elements.characterListContent) return;
        
        const searchQuery = this.elements.listSearch?.value.toLowerCase() || '';
        const skillTypeFilter = this.elements.skillTypeFilter?.value || '';
        const teamFilter = this.elements.teamFilter?.value || '';

        const rows = this.elements.characterListContent.querySelectorAll('.char-table-row:not(.header)');
        console.log('필터링할 행의 개수:', rows.length);
        
        rows.forEach(row => {
            const teamIndex = parseInt(row.dataset.teamIndex);
            const charId = row.dataset.charId;
            
            if (isNaN(teamIndex) || !charId) {
                console.log('데이터 부재:', teamIndex, charId);
                return;
            }
            
            const char = this.teams[teamIndex].characters.find(c => c.id === charId);
            if (!char) {
                console.log('캐릭터를 찾을 수 없음:', teamIndex, charId);
                return;
            }

            let show = true;

            // 검색어 필터
            if (searchQuery && !char.name.toLowerCase().includes(searchQuery)) {
                show = false;
            }

            // 스킬 타입 필터
            if (skillTypeFilter && (!char.skillTypes || !char.skillTypes.includes(skillTypeFilter))) {
                show = false;
            }

            // 팀 필터
            if (teamFilter && parseInt(teamIndex) !== parseInt(teamFilter)) {
                show = false;
            }

            console.log('행 표시:', char.name, '표시여부:', show);
            row.style.display = show ? 'grid' : 'none';
        });
    }

    /**
     * 전투 생성 페이지 표시
     */
    showBattleCreationPage() {
        this.showPage('battle-screen');
        // 선택된 캐릭터 데이터 전달
        battleManager.renderCreateBattleForm('battle-room-container', this.selectedCharacters);
    }

    /**
     * 전투 기록 페이지 표시
     */
    showBattleHistoryPage() {
        this.showPage('battle-history-screen');
        this.renderBattleHistory();
    }

    /**
     * 전투 기록 렌더링
     */
    renderBattleHistory() {
        if (!this.elements.battleHistoryContent) return;
        
        this.elements.battleHistoryContent.innerHTML = '';

        if (this.battleHistory.length === 0) {
            this.elements.battleHistoryContent.innerHTML = '<p style="text-align:center;color:#718096;padding:40px;">전투 기록이 없습니다.</p>';
            return;
        }

        this.battleHistory.slice().reverse().forEach(battle => {
            const record = document.createElement('div');
            record.className = 'battle-record';

            const date = new Date(battle.date);
            const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

            record.innerHTML = `
                <div class="battle-record-header">
                    <div class="battle-record-title">전투 #${battle.id.split('_')[1]}</div>
                    <div class="battle-record-date">${dateStr}</div>
                </div>
                <div class="battle-record-body">
                    <div class="battle-team-section ${battle.winner === '히어로' ? 'battle-winner' : ''}">
                        <div class="battle-team-title">👤 히어로 팀</div>
                        <div class="battle-team-chars">${this.getBattleTeamText(battle.teams.hero)}</div>
                    </div>
                    <div class="battle-team-section ${battle.winner === '정부' ? 'battle-winner' : ''}">
                        <div class="battle-team-title">👤 정부 팀</div>
                        <div class="battle-team-chars">${this.getBattleTeamText(battle.teams.gov)}</div>
                    </div>
                    <div class="battle-team-section ${battle.winner === '빌런' ? 'battle-winner' : ''}">
                        <div class="battle-team-title">👤 빌런 팀</div>
                        <div class="battle-team-chars">${this.getBattleTeamText(battle.teams.villain)}</div>
                    </div>
                    <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn btn-secondary" data-export-delta="${battle.id}">변화 내보내기</button>
                        <button class="btn btn-secondary" data-copy-delta="${battle.id}">변화 복사</button>
                    </div>
                </div>
            `;

            this.elements.battleHistoryContent.appendChild(record);
        });

        // 내보내기 버튼 이벤트 바인딩
        this.elements.battleHistoryContent.querySelectorAll('[data-export-delta]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-export-delta');
                this.exportBattleDelta(id);
            });
        });
        this.elements.battleHistoryContent.querySelectorAll('[data-copy-delta]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-copy-delta');
                this.copyBattleDelta(id);
            });
        });
    }

    /**
     * 전투 팀 텍스트 생성
     */
    getBattleTeamText(teamChars) {
        if (!teamChars || teamChars.length === 0) {
            return '참가자 없음';
        }
        return teamChars.map(c => c.name).join(', ');
    }

    /**
     * 전투 변화만 내보내기 (선택한 전투)
     */
    exportBattleDelta(battleId) {
        const payload = this.buildBattleDelta(battleId);
        if (!payload) return;

        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `battle_delta_${payload.battleId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('전투 변화(JSON 패치)를 다운로드했습니다.');
    }

    /**
     * 전투 변화만 클립보드 복사 (선택한 전투)
     */
    async copyBattleDelta(battleId) {
        const payload = this.buildBattleDelta(battleId);
        if (!payload) return;

        try {
            const json = JSON.stringify(payload, null, 2);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(json);
            } else {
                const ta = document.createElement('textarea');
                ta.value = json;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            this.showCopyPreview(json, '전투 변화', 'delta', battleId);
        } catch (err) {
            alert('클립보드 복사에 실패했습니다: ' + err.message);
        }
    }

    /**
     * 전투 델타 페이로드 생성
     */
    buildBattleDelta(battleId) {
        const rec = this.battleHistory.find(r => r.id === battleId);
        if (!rec) {
            alert('전투 기록을 찾을 수 없습니다.');
            return null;
        }

        const participantIds = [];
        ['hero','gov','villain'].forEach(k => (rec.teams[k]||[]).forEach(c => c?.id && participantIds.push(c.id)));
        const beforeHp = rec.initialHp || {};
        const afterHp = rec.finalHp || {};
        const beforeStats = rec.initialStats || {};
        const afterStats = rec.finalStats || {};

        // after가 비어있으면 현재 팀 데이터에서 보정
        if (Object.keys(afterHp).length === 0 || Object.keys(afterStats).length === 0) {
            this.teams.forEach(team => team.characters.forEach(c => {
                if (c && c.id && participantIds.includes(c.id)) {
                    if (Object.keys(afterHp).length === 0) afterHp[c.id] = c.hp;
                    if (Object.keys(afterStats).length === 0) {
                        afterStats[c.id] = {
                            attack: c.attack,
                            defense: c.defense,
                            agility: c.agility,
                            skill: c.skill,
                            status: c.status
                        };
                    }
                }
            }));
        }

        const usedUltimate = rec.usedUltimate || {};

        const changes = participantIds.map(id => {
            const hpB = typeof beforeHp[id] === 'number' ? beforeHp[id] : null;
            const hpA = typeof afterHp[id] === 'number' ? afterHp[id] : null;
            const statB = beforeStats[id] || null;
            const statA = afterStats[id] || null;

            const change = {
                id,
                hpBefore: hpB,
                hpAfter: hpA,
                hpDelta: (hpB !== null && hpA !== null) ? (hpA - hpB) : null,
                usedUltimate: !!usedUltimate[id]
            };

            // 스탯 변화 추가
            if (statB && statA) {
                const statChanges = {};
                ['attack','defense','agility','skill','status'].forEach(key => {
                    if (statB[key] !== statA[key]) {
                        statChanges[key] = { before: statB[key], after: statA[key] };
                    }
                });
                if (Object.keys(statChanges).length > 0) {
                    change.statChanges = statChanges;
                }
            }

            return change;
        }).filter(ch => ch.hpBefore !== null || ch.usedUltimate || ch.statChanges);

        return {
            type: 'battle-delta',
            schema: 2,
            battleId: rec.id,
            date: rec.date,
            winner: rec.winner,
            changes
        };
    }

    /**
     * 복사 미리보기 모달 표시
     */
    showCopyPreview(jsonContent, title, type, battleId) {
        if (!this.elements.copyPreviewModal) return;
        
        this.elements.copyPreviewContent.value = jsonContent;
        this.elements.copyPreviewModal.style.display = 'block';
        
        // 메타 데이터 저장
        this.elements.copyPreviewModal.dataset.type = type;
        this.elements.copyPreviewModal.dataset.battleId = battleId || '';
        this.elements.copyPreviewModal.dataset.json = jsonContent;
        
        const summary = type === 'full' 
            ? `전체 데이터 (${this.teams.reduce((sum, t) => sum + t.characters.length, 0)}명 캐릭터, ${this.battleHistory.length}건 전투 기록)`
            : `전투 #${battleId?.split('_')[1] || '?'} 변화 데이터`;
        
        alert(`✅ 클립보드에 복사되었습니다!\n\n${summary}\n${Math.ceil(jsonContent.length / 1024)}KB`);
    }

    /**
     * 복사 미리보기 모달 닫기
     */
    closeCopyPreviewModal() {
        if (this.elements.copyPreviewModal) {
            this.elements.copyPreviewModal.style.display = 'none';
        }
    }

    /**
     * 미리보기에서 다시 복사
     */
    async recopyFromPreview() {
        const json = this.elements.copyPreviewModal?.dataset.json;
        if (!json) return;
        
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(json);
            } else {
                const ta = document.createElement('textarea');
                ta.value = json;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            alert('클립보드에 다시 복사했습니다!');
        } catch (err) {
            alert('복사 실패: ' + err.message);
        }
    }

    /**
     * 미리보기에서 파일로 다운로드
     */
    downloadFromPreview() {
        const json = this.elements.copyPreviewModal?.dataset.json;
        const type = this.elements.copyPreviewModal?.dataset.type;
        const battleId = this.elements.copyPreviewModal?.dataset.battleId;
        if (!json) return;
        
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        if (type === 'delta' && battleId) {
            a.download = `battle_delta_${battleId}.json`;
        } else {
            a.download = `battle_data_${Date.now()}.json`;
        }
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('파일로 저장했습니다!');
    }

    /**
     * 텍스트 붙여넣기 모달 열기
     */
    openPasteJsonModal() {
        if (this.elements.pasteJsonModal) {
            this.elements.pasteJsonModal.style.display = 'flex';
            this.elements.pasteJsonContent.value = '';
            this.elements.pasteJsonStatus.textContent = '';
            this.elements.pasteJsonContent.focus();
        }
    }

    /**
     * 텍스트 붙여넣기 모달 닫기
     */
    closePasteJsonModal() {
        if (this.elements.pasteJsonModal) {
            this.elements.pasteJsonModal.style.display = 'none';
            this.elements.pasteJsonContent.value = '';
            this.elements.pasteJsonStatus.textContent = '';
        }
    }

    /**
     * 붙여넣기 입력창 내용 지우기
     */
    clearPasteJsonContent() {
        if (this.elements.pasteJsonContent) {
            this.elements.pasteJsonContent.value = '';
            this.elements.pasteJsonStatus.textContent = '';
        }
    }

    /**
     * 붙여넣은 JSON 적용
     */
    applyPasteJson() {
        const text = this.elements.pasteJsonContent?.value.trim();
        if (!text) {
            this.elements.pasteJsonStatus.textContent = '⚠️ JSON 데이터를 입력하세요';
            this.elements.pasteJsonStatus.style.color = '#e53e3e';
            return;
        }

        try {
            const data = JSON.parse(text);
            this.applyImportedData(data);
            this.closePasteJsonModal();
            alert('JSON 데이터를 적용했습니다!');
        } catch (err) {
            this.elements.pasteJsonStatus.textContent = '❌ JSON 파싱 실패: ' + err.message;
            this.elements.pasteJsonStatus.style.color = '#e53e3e';
        }
    }
}

// 앱 초기화 (Firebase Auth 연동)
document.addEventListener('DOMContentLoaded', () => {
    setupAuthUI();
    // Firebase Auth 상태 변경 시 앱 초기화는 firebase-config.js에서 처리됨
});

/**
 * Firebase Auth UI 설정
 */
function setupAuthUI() {
    const modal = document.getElementById('auth-modal');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const loginBtn = document.getElementById('auth-login');
    const signupBtn = document.getElementById('auth-signup');
    const googleBtn = document.getElementById('auth-google');
    const errorBox = document.getElementById('auth-error');
    const userInfoBtn = document.getElementById('user-info');
    
    const showError = (msg) => {
        if (errorBox) errorBox.textContent = msg || '';
    };
    
    const closeModal = () => {
        if (modal) modal.style.display = 'none';
        showError('');
    };
    
    const openModal = () => {
        if (modal) modal.style.display = 'flex';
        showError('');
    };
    
    // Enter 키로 로그인
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            loginBtn?.click();
        }
    };
    emailInput?.addEventListener('keypress', handleEnter);
    passwordInput?.addEventListener('keypress', handleEnter);
    
    // 로그인
    loginBtn?.addEventListener('click', async () => {
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;
        
        if (!email || !password) {
            showError('⚠️ 이메일과 비밀번호를 입력하세요.');
            return;
        }
        
        try {
            loginBtn.disabled = true;
            loginBtn.textContent = '로그인 중...';
            
            await firebase.auth().signInWithEmailAndPassword(email, password);
            closeModal();
            
            loginBtn.disabled = false;
            loginBtn.textContent = '로그인 🔑';
        } catch (error) {
            loginBtn.disabled = false;
            loginBtn.textContent = '로그인 🔑';
            
            if (error.code === 'auth/user-not-found') {
                showError('❌ 존재하지 않는 계정입니다.');
            } else if (error.code === 'auth/wrong-password') {
                showError('❌ 비밀번호가 틀렸습니다.');
            } else if (error.code === 'auth/invalid-email') {
                showError('❌ 올바른 이메일 형식이 아닙니다.');
            } else {
                showError('❌ ' + error.message);
            }
        }
    });
    
    // 회원가입
    signupBtn?.addEventListener('click', async () => {
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;
        
        if (!email || !password) {
            showError('⚠️ 이메일과 비밀번호를 입력하세요.');
            return;
        }
        
        if (password.length < 6) {
            showError('⚠️ 비밀번호는 6자 이상이어야 합니다.');
            return;
        }
        
        try {
            signupBtn.disabled = true;
            signupBtn.textContent = '가입 중...';
            
            await firebase.auth().createUserWithEmailAndPassword(email, password);
            closeModal();
            alert('🎉 회원가입 성공! 환영합니다!');
            
            signupBtn.disabled = false;
            signupBtn.textContent = '회원가입 ✨';
        } catch (error) {
            signupBtn.disabled = false;
            signupBtn.textContent = '회원가입 ✨';
            
            if (error.code === 'auth/email-already-in-use') {
                showError('❌ 이미 사용 중인 이메일입니다.');
            } else if (error.code === 'auth/invalid-email') {
                showError('❌ 올바른 이메일 형식이 아닙니다.');
            } else if (error.code === 'auth/weak-password') {
                showError('❌ 비밀번호가 너무 약합니다.');
            } else {
                showError('❌ ' + error.message);
            }
        }
    });
    
    // Google 로그인
    googleBtn?.addEventListener('click', async () => {
        try {
            googleBtn.disabled = true;
            googleBtn.textContent = 'Google 로그인 중...';
            
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebase.auth().signInWithPopup(provider);
            closeModal();
            
            googleBtn.disabled = false;
            googleBtn.innerHTML = '<span style="display:inline-block; margin-right:8px;">G</span> Google로 로그인';
        } catch (error) {
            googleBtn.disabled = false;
            googleBtn.innerHTML = '<span style="display:inline-block; margin-right:8px;">G</span> Google로 로그인';
            
            if (error.code !== 'auth/popup-closed-by-user') {
                showError('❌ ' + error.message);
            }
        }
    });
    
    // Firebase Auth 상태 변경 리스너
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // 로그인됨
            closeModal();
            
            // 헤더 업데이트
            if (userInfoBtn) {
                const displayName = user.email?.split('@')[0] || 'User';
                userInfoBtn.textContent = `👤 ${displayName}`;
                userInfoBtn.onclick = async () => {
                    if (confirm('로그아웃 하시겠습니까?')) {
                        await firebase.auth().signOut();
                        alert('로그아웃되었습니다.');
                    }
                };
            }
            
            // 앱 초기화
            if (!window.app) {
                window.app = new BattleApp();
            }
            
            if (window.app.dataManager) {
                window.app.dataManager.setUser(user.uid);
                window.app.dataManager.loadFromLocalStorage();
                window.app.dataManager.loadFromFirestore();
                
                if (window.app.renderAllTeams) {
                    window.app.renderAllTeams();
                }
            }
            
            console.log('✅ 로그인 성공:', user.email);
        } else {
            // 로그아웃됨
            openModal();
            
            // 헤더 업데이트
            if (userInfoBtn) {
                userInfoBtn.textContent = '👤 로그인';
                userInfoBtn.onclick = openModal;
            }
            
            console.log('👋 로그아웃 상태');
        }
    });
}

// Firebase Auth 가드 비활성화 (위에서 직접 구현)
/*
const authUI = setupAuthUI();
initAuthGuard(authUI);
*/
