/**
 * 전투 시스템 (Battle System)
 * 턴제 전투 로직 관리
 */

/**
 * @typedef {'hero'|'gov'|'villain'} TeamKey
 */

/**
 * 전투에서 사용하는 팀 키 고정 목록
 * @type {ReadonlyArray<TeamKey>}
 */
const TEAM_KEYS = Object.freeze(['hero', 'gov', 'villain']);

class BattleSystem {
    constructor(app) {
        this.app = app;
        this.currentBattle = null;
        this.currentTurn = 0;
        this.currentTeamTurn = 0; // 0: 히어로, 1: 정부, 2: 빌런
        this.turnOrder = []; // [{ teamKey, char, agility }]
        this.turnIndex = 0; // turnOrder index
        this.battleLog = [];
        this.combatCharacters = {
            hero: [],
            gov: [],
            villain: []
        };
        this.usedUltimate = {}; // 전투 내 궁극기 사용 기록 (charId => true)

        // ===== UI 상태(로그) =====
        this.logAutoScroll = true;
        this.logUiInitialized = false;
        this.collapsedLogGroups = new Set();

        // ===== 로그 블럭 캐시(성능) =====
        // battleLog가 변경되지 않는 렌더(접기/펼치기 등)에서 파싱/그룹핑 비용을 줄입니다.
        this._logBlocksCache = null; // { totalLen, startIndex, maxLines, blocks }

        // ===== 전투 화면 DOM 캐시(성능) =====
        this._combatDomCache = null; // { heroContainer, govContainer, villainContainer }
        // ===== 2-step 방어자 응답 =====
        this.pendingDefenseResponse = null; // { pendingId, attackerRef, defenderRef, targetTeam, attackerTeam, expiresAt }
        this.defenseUiInitialized = false;

        // ===== 복붙(프로필) 모달 =====
        this.profilesCopyUiInitialized = false;

        // ===== HP 수동 수정(오류용) =====
        this.manualHpEditUiInitialized = false;
        this.manualHpEditMode = false;
        this.manualHpEditCancelHandler = null;

        // ===== 전투 이탈(캐릭터 제외) =====
        this.battleExitUiInitialized = false;
        this.battleExitMode = false;
        this.battleExitCancelHandler = null;

        // ===== 스킬 템플릿(조건+이펙트) =====
        // 캐릭터에 `skillTemplateId`를 넣으면 이 템플릿을 사용합니다.
        // (없으면 기존 스킬 로직/분기 그대로 사용)
        this.skillTemplates = {
            // 예시: 광역 공격 + 자기 방어 -1(1턴) + (선택) 힐 금지 디버프
            // 실제 적용은 캐릭터에 skillTemplateId: 'AOE_CRACKING_STRIKE' 를 설정하면 됩니다.
            AOE_CRACKING_STRIKE: {
                name: '균열 강타(광역)',
                allowedSkillTypes: ['공격형'],
                conditions: [
                    // 각 대상 기준으로 HP가 완전하지 않은 대상만 유효 대상으로 취급
                    // (즉, 피가 꽉 찬 대상은 조건에서 탈락 → 효과 적용 제외)
                    { type: 'TARGET_HP_NOT_FULL', scope: 'perTarget' }
                ],
                effects: [
                    // 공격 대상(선택한 대상들)에게 스킬 데미지(대상 수로 1/n 분배)
                    { type: 'DAMAGE_SKILL_ROLL', targets: 'SELECTED', split: 'evenFloor', applyDefense: true },

                    // 광범위 공격 패널티: 아군+자신에게 미미한 피해(고정)
                    { type: 'DAMAGE_FLAT', targets: 'ALLIES_INCLUDING_SELF', amount: 1, applyDefense: false },

                    // 능력 패널티: 자신 방어력 -1, 1턴
                    { type: 'APPLY_STATUS', targets: 'SELF', status: { kind: 'STAT_MOD', durationRounds: 1, statMods: { defense: -1 } } },
                ]
            },

            SUPPORT_TURN_SKIP: {
                name: '턴 스킵(지원형)',
                allowedSkillTypes: ['지원형'],
                conditions: [],
                effects: [
                    { type: 'SKIP_TURN', targets: 'SELECTED' }
                ]
            }
        };
    }

    getCombatDom() {
        const cached = this._combatDomCache;
        const ok = cached?.heroContainer?.isConnected && cached?.govContainer?.isConnected && cached?.villainContainer?.isConnected;
        if (ok) return cached;

        const dom = {
            heroContainer: document.getElementById('team1-characters-combat'),
            govContainer: document.getElementById('team2-characters-combat'),
            villainContainer: document.getElementById('team3-characters-combat')
        };
        this._combatDomCache = dom;
        return dom;
    }

    // ===== 복붙(프로필) 모달 =====
    getCopyGuideText() {
        return String(window.CONFIG?.BATTLE_COPY_GUIDE_TEXT || '');
    }

    formatMentionName(name) {
        const raw = String(name ?? '').trim();
        if (!raw) return '@?';
        const firstToken = raw.split(/\s+/)[0];
        const clean = firstToken.replace(/^@+/, '');
        return `@${clean || '?'}`;
    }

    formatProfileStat(statValue) {
        const clamped = this.clampStat1to5(statValue);
        const diamonds = '◆'.repeat(clamped);
        const score = 50 + (clamped - 1) * 5;
        return { diamonds, score };
    }

    getProfilesTextCombat() {
        const teams = [
            { key: 'hero', label: '히어로' },
            { key: 'gov', label: '정부' },
            { key: 'villain', label: '빌런' }
        ];

        const blocks = teams.map(({ key, label }) => {
            const list = Array.isArray(this.combatCharacters?.[key]) ? this.combatCharacters[key] : [];
            if (list.length === 0) return '';

            const people = list.map((c) => {
                const mention = this.formatMentionName(c?.name);
                const atk = this.formatProfileStat(this.getBaseStatValue(c, 'attack'));
                const agi = this.formatProfileStat(this.getBaseStatValue(c, 'agility'));
                const def = this.formatProfileStat(this.getBaseStatValue(c, 'defense'));
                const skill = this.formatProfileStat(this.getBaseStatValue(c, 'skill'));

                return [
                    mention,
                    `공격: ${atk.diamonds} (${atk.score})`,
                    `민첩: ${agi.diamonds} (${agi.score})`,
                    `방어: ${def.diamonds} (${def.score})`,
                    `스킬: ${skill.diamonds} (${skill.score})`,
                ].join('\n');
            });

            return [`[${label}]`, ...people].join('\n\n');
        }).filter(Boolean);

        return blocks.join('\n\n').trim();
    }

    getCopyPayloadCombat() {
        const guide = this.getCopyGuideText();
        const profiles = this.getProfilesTextCombat();
        // 요청: 안내문구는 아래에, 캐릭터 스탯(프로필)은 위로
        return [profiles, guide].filter((s) => String(s || '').trim()).join('\n\n');
    }

    setCombatProfilesModalText(text) {
        const textarea = document.getElementById('combat-profiles-text');
        if (textarea) textarea.value = String(text ?? '');
    }

    showCombatProfilesModal({ autoFill = true } = {}) {
        this.initProfilesCopyUi();
        const modal = document.getElementById('combat-profiles-modal');
        if (!modal) return;
        if (autoFill) this.setCombatProfilesModalText(this.getCopyPayloadCombat());
        modal.style.display = 'block';
    }

    hideCombatProfilesModal() {
        const modal = document.getElementById('combat-profiles-modal');
        if (modal) modal.style.display = 'none';
    }

    async copyTextToClipboard(text) {
        const payload = String(text ?? '');
        if (!payload.trim()) return false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(payload);
                return true;
            }
        } catch (e) {
            // fallback 아래에서 처리
        }
        try {
            const textarea = document.createElement('textarea');
            textarea.value = payload;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            return ok;
        } catch {
            return false;
        }
    }

    initProfilesCopyUi() {
        if (this.profilesCopyUiInitialized) return;

        const openBtn = document.getElementById('combat-profiles-open');
        const modal = document.getElementById('combat-profiles-modal');
        const closeBtn = document.getElementById('combat-profiles-close');
        const okBtn = document.getElementById('combat-profiles-ok');
        const copyBtn = document.getElementById('combat-profiles-copy');
        const textarea = document.getElementById('combat-profiles-text');

        if (!modal || !closeBtn || !okBtn || !copyBtn || !textarea) return;

        openBtn?.addEventListener('click', () => this.showCombatProfilesModal({ autoFill: true }));

        const hide = () => this.hideCombatProfilesModal();
        closeBtn.addEventListener('click', hide);
        okBtn.addEventListener('click', hide);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hide();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const open = modal.style.display !== 'none';
            if (!open) return;
            hide();
        });

        copyBtn.addEventListener('click', async () => {
            const text = textarea.value || '';
            const ok = await this.copyTextToClipboard(text);
            if (ok) this.app?.showToast?.('클립보드에 복사되었습니다.', 'success');
            else this.app?.showToast?.('복사에 실패했습니다.', 'error');
        });

        this.profilesCopyUiInitialized = true;
    }

    // ===== HP 수동 수정(오류용) =====
    setPrimaryActionButtonsEnabled(enabled) {
        const ids = ['action-attack', 'action-ultimate', 'action-chase', 'admin-skip-turn'];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = !enabled;
        });
    }

    initManualHpEditUi() {
        if (this.manualHpEditUiInitialized) return;
        const btn = document.getElementById('combat-hp-edit-open');
        if (!btn) return;

        btn.addEventListener('click', () => {
            this.beginManualHpEditFlow();
        });

        this.manualHpEditUiInitialized = true;
    }

    initBattleExitUi() {
        if (this.battleExitUiInitialized) return;
        const btn = document.getElementById('combat-exit-open');
        if (!btn) return;

        btn.addEventListener('click', () => {
            this.beginBattleExitFlow();
        });

        this.battleExitUiInitialized = true;
    }

    beginManualHpEditFlow() {
        if (this.manualHpEditMode) return;

        if (this.battleExitMode) {
            this.app?.showToast?.('현재 전투 이탈 대상 선택 중입니다.', 'warning');
            return;
        }

        // 공격/스킬 대상 선택 모드와 충돌 방지
        if (this.app?.battleActions?.targetSelectionMode) {
            this.app?.showToast?.('현재 대상 선택 중입니다. 먼저 취소/완료 후 HP 수정을 실행하세요.', 'warning');
            return;
        }

        // 방어자 응답 대기 중에는 혼선을 방지
        if (this.pendingDefenseResponse) {
            this.app?.showToast?.('방어자 응답 대기 중에는 HP 수정을 할 수 없습니다.', 'warning');
            return;
        }

        this.manualHpEditMode = true;
        this.setPrimaryActionButtonsEnabled(false);
        this.addLog('HP 수정(오류용): 캐릭터를 선택하세요. (ESC 취소)');

        const onKeydown = (e) => {
            if (e.key !== 'Escape') return;
            if (!this.manualHpEditMode) return;
            this.cancelManualHpEditFlow('취소');
        };
        document.addEventListener('keydown', onKeydown);
        this.manualHpEditCancelHandler = onKeydown;

        this.enableManualHpEditSelection();
    }

    cleanupManualHpEditFlow() {
        if (this.manualHpEditCancelHandler) {
            document.removeEventListener('keydown', this.manualHpEditCancelHandler);
            this.manualHpEditCancelHandler = null;
        }
        this.manualHpEditMode = false;
        this.setPrimaryActionButtonsEnabled(true);
    }

    cancelManualHpEditFlow(reason = '') {
        this.cleanupManualHpEditFlow();
        if (reason) this.addLog(`HP 수정(오류용): ${reason}`);
        // inline 스타일/리스너 정리를 위해 렌더로 원상복구
        this.renderBattle();
    }

    enableManualHpEditSelection() {
        const teamNames = ['hero', 'gov', 'villain'];
        teamNames.forEach((team, idx) => {
            const container = document.getElementById(`team${idx + 1}-characters-combat`);
            if (!container) return;
            const cards = container.querySelectorAll('[data-char-id]');
            cards.forEach((card) => {
                card.style.cursor = 'pointer';
                card.style.opacity = '1';
                card.style.pointerEvents = 'auto';

                const charId = card.dataset.charId;
                const teamKey = card.dataset.team || team;

                card.addEventListener('click', () => {
                    this.openManualHpEditPrompt(teamKey, charId);
                }, { once: true });
            });
        });
    }

    beginBattleExitFlow() {
        if (this.battleExitMode) return;

        if (this.manualHpEditMode) {
            this.app?.showToast?.('현재 HP 수정 대상 선택 중입니다.', 'warning');
            return;
        }

        // 공격/스킬 대상 선택 모드와 충돌 방지
        if (this.app?.battleActions?.targetSelectionMode) {
            this.app?.showToast?.('현재 대상 선택 중입니다. 먼저 취소/완료 후 전투 이탈을 실행하세요.', 'warning');
            return;
        }

        // 방어자 응답 대기 중에는 혼선을 방지
        if (this.pendingDefenseResponse) {
            this.app?.showToast?.('방어자 응답 대기 중에는 전투 이탈을 할 수 없습니다.', 'warning');
            return;
        }

        this.battleExitMode = true;
        this.setPrimaryActionButtonsEnabled(false);
        this.addLog('전투 이탈/복귀: 캐릭터를 선택하세요. (ESC 취소)');

        const onKeydown = (e) => {
            if (e.key !== 'Escape') return;
            if (!this.battleExitMode) return;
            this.cancelBattleExitFlow('취소');
        };
        document.addEventListener('keydown', onKeydown);
        this.battleExitCancelHandler = onKeydown;

        this.enableBattleExitSelection();
    }

    cleanupBattleExitFlow() {
        if (this.battleExitCancelHandler) {
            document.removeEventListener('keydown', this.battleExitCancelHandler);
            this.battleExitCancelHandler = null;
        }
        this.battleExitMode = false;
        this.setPrimaryActionButtonsEnabled(true);
    }

    cancelBattleExitFlow(reason = '') {
        this.cleanupBattleExitFlow();
        if (reason) this.addLog(`전투 이탈: ${reason}`);
        this.renderBattle();
    }

    enableBattleExitSelection() {
        const teamNames = ['hero', 'gov', 'villain'];
        teamNames.forEach((team, idx) => {
            const container = document.getElementById(`team${idx + 1}-characters-combat`);
            if (!container) return;
            const cards = container.querySelectorAll('[data-char-id]');
            cards.forEach((card) => {
                card.style.cursor = 'pointer';
                card.style.opacity = '1';
                card.style.pointerEvents = 'auto';

                const charId = card.dataset.charId;
                const teamKey = card.dataset.team || team;
                card.addEventListener('click', () => {
                    this.confirmBattleExit(teamKey, charId);
                }, { once: true });
            });
        });
    }

    pruneTurnOrderAfterRosterChange() {
        if (!Array.isArray(this.turnOrder) || this.turnOrder.length === 0) return;

        const beforeCurrent = this.turnOrder[this.turnIndex] || null;
        this.turnOrder = this.turnOrder.filter((e) => e?.char && this.isCombatCapable(e.char));
        if (this.turnOrder.length === 0) {
            this.turnIndex = 0;
            return;
        }

        if (beforeCurrent?.char?.id) {
            const idx = this.turnOrder.findIndex((e) => String(e?.char?.id) === String(beforeCurrent.char.id));
            this.turnIndex = idx >= 0 ? idx : Math.min(this.turnIndex, this.turnOrder.length - 1);
        } else {
            this.turnIndex = Math.min(this.turnIndex, this.turnOrder.length - 1);
        }

        const entry = this.getCurrentTurnEntry();
        if (entry) {
            const tIdx = ['hero', 'gov', 'villain'].indexOf(entry.teamKey);
            this.currentTeamTurn = tIdx >= 0 ? tIdx : 0;
        }
    }

    rebuildTurnOrderPreserveCurrentActor() {
        const before = this.getCurrentTurnEntry();
        const beforeId = before?.char?.id ? String(before.char.id) : null;
        const beforeTeam = before?.teamKey ? String(before.teamKey) : null;

        this.rebuildTurnOrder({ log: false });

        if (!beforeId || !beforeTeam || !Array.isArray(this.turnOrder) || this.turnOrder.length === 0) {
            return;
        }

        const idx = this.turnOrder.findIndex((e) => String(e?.teamKey) === beforeTeam && String(e?.char?.id) === beforeId);
        if (idx >= 0) {
            this.turnIndex = idx;
            const entry = this.getCurrentTurnEntry();
            if (entry) {
                const tIdx = ['hero', 'gov', 'villain'].indexOf(entry.teamKey);
                this.currentTeamTurn = tIdx >= 0 ? tIdx : 0;
            }
        }
    }

    async confirmBattleExit(teamKey, charId) {
        if (!this.battleExitMode) return;

        // 선택 모드 종료
        this.cleanupBattleExitFlow();

        const list = Array.isArray(this.combatCharacters?.[teamKey]) ? this.combatCharacters[teamKey] : [];
        const char = list.find((c) => String(c?.id) === String(charId));
        if (!char) {
            this.addLog('전투 이탈: 대상을 찾지 못했습니다.');
            this.renderBattle();
            return;
        }

        const beforeBase = this.getBaseHp(char);
        const beforeShield = this.getShieldHp(char);
        const maxHp = this.getMaxHp(char);

        // 이미 이탈 상태면: 이탈 해제(복귀)
        if (char.battleExcluded) {
            const ok = await this.app?.showConfirm?.({
                title: '전투 이탈 해제',
                message: [
                    `${char.name}을(를) 전투에 다시 참여시키겠습니까?`,
                    '',
                    `현재 HP: ${beforeBase}/${maxHp} (쉴드 ${beforeShield})`,
                    '',
                    '효과:',
                    '- 턴/타겟/승패 판정에 다시 포함',
                    '- 전투 종료 후 HP 저장(커밋)에 다시 포함',
                    '- 전투 기록은 그대로 유지'
                ].join('\n'),
                okText: '복귀',
                cancelText: '취소'
            });

            if (!ok) {
                this.addLog('전투 이탈 해제: 취소');
                this.renderBattle();
                return;
            }

            char.battleExcluded = false;
            char.battleRejoinedAtTurn = this.currentTurn;

            this.addLog(`↩️ 전투 이탈 해제: ${char.name} 복귀 (턴 ${this.currentTurn})`);

            // 턴 순서에 다시 포함(현재 액터는 최대한 유지)
            this.rebuildTurnOrderPreserveCurrentActor();
            this.renderBattle();
            this.checkBattleEnd();
            return;
        }

        const ok = await this.app?.showConfirm?.({
            title: '전투 이탈 처리',
            message: [
                `${char.name}을(를) 전투에서 제외할까요?`,
                '',
                `현재 HP: ${beforeBase}/${maxHp} (쉴드 ${beforeShield})`,
                '',
                '효과:',
                '- 턴/타겟/승패 판정에서 제외',
                '- 전투 종료 후 HP 저장(커밋)에서도 제외',
                '- 전투 기록/로그는 그대로 남음'
            ].join('\n'),
            okText: '제외',
            cancelText: '취소'
        });

        if (!ok) {
            this.addLog('전투 이탈: 취소');
            this.renderBattle();
            return;
        }

        char.battleExcluded = true;
        char.battleExcludedAtTurn = this.currentTurn;

        // 방어자 응답 대기 중에 이탈시키면 상태가 꼬일 수 있으니 안전하게 정리
        this.pendingDefenseResponse = null;
        if (typeof this.hideDefenseResponsePanel === 'function') {
            try { this.hideDefenseResponsePanel(); } catch { /* ignore */ }
        }

        this.addLog(`🚪 전투 이탈: ${char.name} 제외 처리 (턴 ${this.currentTurn}, HP ${beforeBase}/${maxHp} +${beforeShield})`);

        this.pruneTurnOrderAfterRosterChange();
        this.renderBattle();
        this.checkBattleEnd();
    }

    async openManualHpEditPrompt(teamKey, charId) {
        if (!this.manualHpEditMode) return;

        // 선택 모드 종료(중복 클릭/다른 UI 충돌 방지)
        this.cleanupManualHpEditFlow();

        const list = Array.isArray(this.combatCharacters?.[teamKey]) ? this.combatCharacters[teamKey] : [];
        const char = list.find((c) => String(c?.id) === String(charId));

        if (!char) {
            this.addLog('HP 수정(오류용): 대상을 찾지 못했습니다.');
            this.renderBattle();
            return;
        }

        const maxHp = this.getMaxHp(char);
        const startBase = Math.round(Number(char?.battleStartBaseHp) || 0);
        const minHp = startBase > 50 ? 50 : 0;
        const beforeBase = this.getBaseHp(char);
        const beforeShield = this.getShieldHp(char);

        const msg = [
            `${char.name}`,
            `현재 HP: ${beforeBase}/${maxHp} (쉴드 ${beforeShield})`,
            `입력 범위: ${minHp} ~ ${maxHp}`,
            (startBase > 50 ? '규칙: 시작 HP > 50 캐릭터는 HP가 50 미만으로 내려가지 않습니다.' : '')
        ].filter(Boolean).join('\n');

        const nextBase = await this.app?.showNumberPrompt?.({
            title: 'HP 수동 수정(오류용)',
            message: msg,
            initialValue: beforeBase,
            min: minHp,
            max: maxHp,
            okText: '적용',
            cancelText: '취소'
        });

        if (nextBase === null) {
            this.addLog('HP 수정(오류용): 취소');
            this.renderBattle();
            return;
        }

        // 오류 정정용: 사망/전투불능 상태 해제(선택)
        if (char.battleDead && nextBase > 0) {
            const ok = await this.app?.showConfirm?.({
                title: '사망 상태 해제',
                message: `${char.name}은(는) 현재 사망 상태입니다. HP를 ${nextBase}로 변경하면서 사망을 해제할까요?`,
                okText: '해제',
                cancelText: '유지'
            });
            if (ok) {
                char.battleDead = false;
                if (String(char.status) === 'dead') char.status = 'active';
            }
        }

        if (char.battleIncapacitated && nextBase > 50) {
            const ok = await this.app?.showConfirm?.({
                title: '전투 불능 해제',
                message: `${char.name}은(는) 현재 전투 불능 상태입니다. HP를 ${nextBase}로 변경하면서 전투 불능을 해제할까요?`,
                okText: '해제',
                cancelText: '유지'
            });
            if (ok) {
                char.battleIncapacitated = false;
            }
        }

        let nextShield = beforeShield;
        const wantsShield = await this.app?.showConfirm?.({
            title: '쉴드 HP 수정',
            message: `쉴드(방어 스킬)를 같이 수정할까요?\n\n현재 쉴드: ${beforeShield}`,
            okText: '수정',
            cancelText: '유지'
        });
        if (wantsShield) {
            const shield = await this.app?.showNumberPrompt?.({
                title: '쉴드 HP 수동 수정(오류용)',
                message: `${char.name}\n현재 쉴드: ${beforeShield}\n입력 범위: 0 ~ 999`,
                initialValue: beforeShield,
                min: 0,
                max: 999,
                okText: '적용',
                cancelText: '취소'
            });
            if (shield !== null) {
                nextShield = shield;
            }
        }

        char.hp = nextBase;
        char.shieldHp = nextShield;

        this.ensureHpSplit(char);
        this.evaluateHpStateTransition(char, { cause: '수동 수정' });

        const afterBase = this.getBaseHp(char);
        const afterShield = this.getShieldHp(char);
        this.addLog(`HP 수동 수정(오류용): ${char.name} HP ${beforeBase} → ${afterBase} (쉴드 ${beforeShield} → ${afterShield})`);
        this.renderBattle();
    }

    cloneCharacterForBattle(source) {
        if (!source) return null;
        try {
            // 전투 중에는 원본 teams를 건드리면(자동 저장/동기화로) HP/스킬 사용 상태가 저장되어버리므로,
            // 전투 전용 복제본을 사용합니다.
            const cloned = (typeof structuredClone === 'function')
                ? structuredClone(source)
                : JSON.parse(JSON.stringify(source));
            // 안전: 최소 식별/표시 필드는 원본을 우선
            cloned.id = source.id;
            cloned.name = source.name;
            return cloned;
        } catch {
            return { ...source };
        }
    }

    // ===== 전투 종료 시 커밋(원본 teams 반영) =====
    getRosterCharacterById(charId) {
        const id = String(charId);
        const teams = Array.isArray(this.app?.teams) ? this.app.teams : [];
        for (const team of teams) {
            const list = Array.isArray(team?.characters) ? team.characters : [];
            const found = list.find((c) => c && String(c.id) === id);
            if (found) return found;
        }
        return null;
    }

    commitCombatStateToRoster({ persistDeathStatus = true } = {}) {
        const updates = [];

        TEAM_KEYS.forEach((teamKey) => {
            const list = Array.isArray(this.combatCharacters?.[teamKey]) ? this.combatCharacters[teamKey] : [];
            list.forEach((combatChar) => {
                if (!combatChar?.id) return;

                // 전투 이탈자는 전투 종료 시 HP 계산/저장(로스터 커밋)에서 제외
                if (combatChar.battleExcluded) return;

                const rosterChar = this.getRosterCharacterById(combatChar.id);
                if (!rosterChar) return;

                // 최종 HP/쉴드 반영
                rosterChar.hp = this.getBaseHp(combatChar);
                rosterChar.shieldHp = this.getShieldHp(combatChar);

                // 스킬 사용 여부(횟수/잠금) 반영
                if (combatChar.skillUsesMax !== undefined) rosterChar.skillUsesMax = combatChar.skillUsesMax;
                if (combatChar.skillUsesUsed !== undefined) rosterChar.skillUsesUsed = combatChar.skillUsesUsed;
                if (combatChar.skillUsesLocked !== undefined) rosterChar.skillUsesLocked = combatChar.skillUsesLocked;

                // 사망은 roster에도 반영(선택 불가/표시 목적). 전투 불능(battleIncapacitated)은 저장하지 않음.
                if (persistDeathStatus && String(combatChar.status || '') === 'dead') {
                    rosterChar.status = 'dead';
                }

                updates.push(String(combatChar.id));
            });
        });

        return { updatedIds: updates };
    }

    // ===== 상태이상/스킬 템플릿 공용 =====
    getOrInitStatusEffects(char) {
        if (!char) return [];
        if (!Array.isArray(char.statusEffects)) char.statusEffects = [];
        return char.statusEffects;
    }

    getActiveStatusEffects(char) {
        const list = this.getOrInitStatusEffects(char);
        return list.filter((e) => e && (typeof e.durationRounds !== 'number' || e.durationRounds > 0));
    }

    hasStatusFlag(char, flagKey) {
        return this.getActiveStatusEffects(char).some((e) => !!e?.flags?.[flagKey]);
    }

    getStatModSum(char, statKey) {
        return this.getActiveStatusEffects(char).reduce((sum, e) => {
            const v = Number(e?.statMods?.[statKey] || 0);
            return sum + (Number.isFinite(v) ? v : 0);
        }, 0);
    }

    getBaseStatValue(char, statKey) {
        if (!char) return undefined;
        const key = String(statKey || '').toLowerCase();
        if (key === 'attack' || key === 'atk') return char.attack ?? char.atk;
        if (key === 'defense' || key === 'def') return char.defense ?? char.def;
        if (key === 'agility' || key === 'agi') return char.agility ?? char.agi;
        if (key === 'skill' || key === 'skillstat') return char.skill ?? char.skillStat;
        return char?.[statKey];
    }

    getEffectiveStat(char, statKey) {
        const base = this.clampStat1to5(this.getBaseStatValue(char, statKey));
        const delta = this.getStatModSum(char, statKey);
        return this.clampStat1to5(base + delta);
    }

    statKeyToConsumeOn(statKey) {
        const key = String(statKey || '').toLowerCase();
        if (key === 'attack' || key === 'atk') return 'ON_ATTACK';
        if (key === 'defense' || key === 'def') return 'ON_DEFEND';
        if (key === 'agility' || key === 'agi') return 'ON_AGI_CHECK';
        if (key === 'skill' || key === 'skillstat') return 'ON_SKILL';
        return null;
    }

    /**
     * 단일/소모형 스탯 버프/디버프 부여
     * - durationRounds는 길게 주고(기본 999), 실제로는 consumeOn 트리거에서 1회 소모
     */
    applyConsumableStatMod(target, statKey, delta, ctx, { durationRounds = 999 } = {}) {
        if (!target) return;
        const key = String(statKey);
        const consumeOn = this.statKeyToConsumeOn(key);
        this.applyStatusToTarget(
            target,
            {
                kind: 'STAT_MOD',
                durationRounds,
                statMods: { [key]: Math.floor(Number(delta) || 0) },
                flags: { consumeOn }
            },
            ctx
        );
    }

    /**
     * 특정 트리거(공격/피격/민첩판정/스킬사용) 후 해당 스탯 변화(버프/디버프/패널티)를 1회 소모
     */
    consumeStatMods(target, consumeOn, { statKey = null } = {}) {
        if (!target) return 0;
        const list = this.getOrInitStatusEffects(target);
        const key = statKey ? String(statKey) : null;
        let consumed = 0;

        list.forEach((e) => {
            if (!e || e.kind !== 'STAT_MOD') return;
            if (!e.flags || e.flags.consumeOn !== consumeOn) return;

            const mods = e.statMods || {};
            if (key) {
                if (Object.prototype.hasOwnProperty.call(mods, key) && Number(mods[key]) !== 0) {
                    mods[key] = 0;
                    consumed += 1;
                }
            } else {
                Object.keys(mods).forEach((k) => {
                    if (Number(mods[k]) !== 0) {
                        mods[k] = 0;
                        consumed += 1;
                    }
                });
            }

            e.statMods = mods;

            const remaining = Object.values(e.statMods || {}).some((v) => Number(v) !== 0);
            if (!remaining && typeof e.durationRounds === 'number') {
                e.durationRounds = 0;
            }
        });

        target.statusEffects = list.filter((e) => e && (typeof e.durationRounds !== 'number' || e.durationRounds > 0));
        return consumed;
    }

    /**
     * 디스펠: 대상의 (+) 스탯 버프(attack/defense/agility/skill)를 제거
     */
    dispelPositiveStatBuffs(target) {
        if (!target) return 0;
        const list = this.getOrInitStatusEffects(target);
        let removed = 0;

        list.forEach((e) => {
            if (!e || e.kind !== 'STAT_MOD') return;
            const mods = e.statMods || {};
            Object.keys(mods).forEach((k) => {
                const v = Number(mods[k] || 0);
                if (v > 0) {
                    mods[k] = 0;
                    removed += 1;
                }
            });
            e.statMods = mods;

            const remaining = Object.values(e.statMods || {}).some((v) => Number(v) !== 0);
            if (!remaining && typeof e.durationRounds === 'number') {
                e.durationRounds = 0;
            }
        });

        target.statusEffects = list.filter((e) => e && (typeof e.durationRounds !== 'number' || e.durationRounds > 0));
        return removed;
    }

    canHealTarget(target) {
        return !this.hasStatusFlag(target, 'noHeal');
    }

    tickStatusEffectsOnRoundAdvance() {
        const participants = this.getAliveParticipants().map((p) => p.char);
        const all = new Set(participants);
        // 사망자도 디버프 유지할 필요 없지만, 안전하게 전원 기준으로 처리
        ['hero', 'gov', 'villain'].forEach((teamKey) => {
            (this.combatCharacters?.[teamKey] || []).forEach((c) => all.add(c));
        });

        all.forEach((char) => {
            const list = this.getOrInitStatusEffects(char);
            list.forEach((e) => {
                if (!e) return;
                if (typeof e.durationRounds === 'number') e.durationRounds -= 1;
            });
            char.statusEffects = list.filter((e) => e && (typeof e.durationRounds !== 'number' || e.durationRounds > 0));
        });
    }

    findTeamKeyByCharId(charId) {
        const id = String(charId);
        if ((this.combatCharacters.hero || []).some((c) => String(c.id) === id)) return 'hero';
        if ((this.combatCharacters.gov || []).some((c) => String(c.id) === id)) return 'gov';
        if ((this.combatCharacters.villain || []).some((c) => String(c.id) === id)) return 'villain';
        return null;
    }

    getAlliance(teamKey) {
        if (teamKey === 'villain') return { allies: ['villain'], enemies: ['hero', 'gov'] };
        return { allies: ['hero', 'gov'], enemies: ['villain'] };
    }

    getSkillTemplate(attacker) {
        const id = attacker?.skillTemplateId;
        if (!id) return null;
        return this.skillTemplates?.[id] || null;
    }

    getEffectEnabled(attacker, effect, effectIndex) {
        // 패널티/옵션 토글은 통일 정책으로 제거: 이펙트는 항상 적용
        // (과거 데이터에 enabled/optionKey/skillTemplateOptions가 남아있어도 무시)
        return !!effect;
    }

    /**
     * 스탯 캔슬: 대상의 스탯 변화(STAT_MOD)를 선택적으로 제거
     * - which: 'BUFF'(+만), 'DEBUFF'(-만), 'BOTH'(모두)
     */
    cancelStatMods(target, which = 'BOTH', onlyStats = null, magnitudeExact = null) {
        if (!target) return 0;
        const mode = String(which || 'BOTH').toUpperCase();
        const allowedStats = new Set(['attack', 'defense', 'agility', 'skill']);
        const filter = Array.isArray(onlyStats)
            ? new Set(onlyStats.map((s) => String(s)).filter((s) => allowedStats.has(s)))
            : null;
        const mag = Number.isFinite(Number(magnitudeExact)) ? Math.max(1, Math.min(5, Math.floor(Number(magnitudeExact)))) : null;
        const list = this.getOrInitStatusEffects(target);
        let removed = 0;

        list.forEach((e) => {
            if (!e || e.kind !== 'STAT_MOD') return;
            const mods = e.statMods || {};
            Object.keys(mods).forEach((k) => {
                if (filter && !filter.has(String(k))) return;
                const v = Number(mods[k] || 0);
                if (mag && Math.abs(v) !== mag) return;
                const match = (mode === 'BUFF') ? (v > 0) : ((mode === 'DEBUFF') ? (v < 0) : (v !== 0));
                if (match) {
                    mods[k] = 0;
                    removed += 1;
                }
            });
            e.statMods = mods;

            const remaining = Object.values(e.statMods || {}).some((v) => Number(v) !== 0);
            if (!remaining && typeof e.durationRounds === 'number') {
                e.durationRounds = 0;
            }
        });

        target.statusEffects = list.filter((e) => e && (typeof e.durationRounds !== 'number' || e.durationRounds > 0));
        return removed;
    }

    isPerTargetCondition(cond) {
        if (!cond) return false;
        const scope = String(cond.scope || '').toLowerCase();
        return cond.perTarget === true || scope === 'pertarget' || scope === 'each' || scope === 'eachtarget' || scope === 'target';
    }

    evalCondition(cond, ctx) {
        if (!cond || !cond.type) return { ok: true };

        if (cond.type === 'TARGET_HP_NOT_FULL') {
            if (this.isPerTargetCondition(cond)) {
                const t = ctx?.target;
                if (!t) return { ok: false, reason: '조건 불충족: 유효한 대상이 없습니다.' };
                const pass = this.getBaseHp(t) < this.getMaxHp(t);
                return pass ? { ok: true } : { ok: false, reason: '조건 불충족: 대상 HP가 완전한 상태입니다.' };
            }

            const targets = Array.isArray(ctx?.targets) ? ctx.targets : [];
            const mode = cond.mode === 'all' ? 'all' : 'any';
            const pass = mode === 'all'
                ? targets.length > 0 && targets.every((t) => this.getBaseHp(t) < this.getMaxHp(t))
                : targets.some((t) => this.getBaseHp(t) < this.getMaxHp(t));
            return pass ? { ok: true } : { ok: false, reason: '조건 불충족: 대상 HP가 완전한 상태가 아니어야 합니다.' };
        }

        return { ok: false, reason: `알 수 없는 조건: ${cond.type}` };
    }

    evalSkillConditions(template, ctx) {
        const conditions = Array.isArray(template?.conditions) ? template.conditions : [];
        if (conditions.length === 0) return { ok: true };

        for (const cond of conditions) {
            if (!cond || !cond.type) continue;
            // perTarget 조건은 executeSkillTemplate에서 대상 필터링으로 처리
            if (this.isPerTargetCondition(cond)) continue;

            const r = this.evalCondition(cond, ctx);
            if (!r.ok) return r;
        }

        return { ok: true };
    }

    resolveEffectTargets(targetSpec, ctx) {
        const { attacker, teamKey } = ctx || {};
        if (targetSpec === 'SELF') return attacker ? [attacker] : [];
        if (targetSpec === 'SELECTED') return Array.isArray(ctx?.targets) ? ctx.targets : [];
        if (targetSpec === 'ALLIES_INCLUDING_SELF') {
            if (!teamKey || !attacker) return [];
            const alliance = this.getAlliance(teamKey);
            const allies = alliance.allies;
            const list = allies.flatMap((t) => (this.combatCharacters?.[t] || [])).filter((c) => this.isCombatCapable(c));
            const uniq = new Map();
            list.forEach((c) => uniq.set(String(c.id), c));
            uniq.set(String(attacker.id), attacker);
            return Array.from(uniq.values());
        }
        return [];
    }

    applyStatusToTarget(target, status, ctx) {
        if (!target || !status) return;
        const effect = {
            id: `se_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            kind: status.kind,
            durationRounds: typeof status.durationRounds === 'number' ? status.durationRounds : 1,
            flags: status.flags || {},
            statMods: status.statMods || {},
            sourceId: ctx?.attacker?.id || null,
            createdTurn: this.currentTurn
        };
        const list = this.getOrInitStatusEffects(target);
        list.push(effect);
        if (Number.isFinite(Number(effect.flags?.skipTurns)) && Number(effect.flags.skipTurns) > 0) {
            this.addLog(`  ⏭️ ${target.name} 턴 스킵 ${Math.round(Number(effect.flags.skipTurns))}회`);
        }
        if (effect.flags?.noHeal) {
            this.addLog(`  🚫 ${target.name} 치유 불가(${effect.durationRounds}턴)`);
        }
        if (effect.kind === 'STAT_MOD') {
            const consumeOn = effect.flags?.consumeOn;
            const mods = Object.entries(effect.statMods || {})
                .map(([k, v]) => `${k}${Number(v) >= 0 ? '+' : ''}${v}`)
                .join(', ');
            if (consumeOn) {
                this.addLog(`  🧷 ${target.name} 스탯 변화(1회 소모): ${mods || '-'}`);
            } else {
                this.addLog(`  🧷 ${target.name} 스탯 변화(${effect.durationRounds}턴): ${mods || '-'}`);
            }
        }
    }

    executeSkillTemplate({ attacker, teamKey, targets }) {
        const template = this.getSkillTemplate(attacker);
        if (!template) return { handled: false };

        const ctx = { attacker, teamKey, targets: Array.isArray(targets) ? targets.slice() : [] };
        this.addLog(`\n⭐ ${attacker?.name || '사용자'} 스킬(템플릿) 사용: ${template.name || attacker.skillTemplateId}`);

        // ===== perTarget 조건: 선택 대상 자체를 필터링(조건 불만족 대상은 효과 적용 제외) =====
        const conditions = Array.isArray(template?.conditions) ? template.conditions : [];
        const perTargetConds = conditions.filter((c) => this.isPerTargetCondition(c));
        if (perTargetConds.length > 0) {
            const before = ctx.targets.length;
            ctx.targets = ctx.targets.filter((t) => {
                if (!t) return false;
                return perTargetConds.every((c) => this.evalCondition(c, { ...ctx, target: t }).ok);
            });
            const after = ctx.targets.length;
            if (before > 0 && after !== before) {
                this.addLog(`  🔎 조건으로 대상 필터링: ${before}명 → ${after}명`);
            }
            if (after === 0) {
                const msg = '조건 불충족: 조건을 만족하는 대상이 없습니다.';
                this.addLog(`  ❌ ${msg}`);
                this.app?.showToast?.(msg, 'warning');
                return { handled: true, ok: false };
            }
        }

        const cond = this.evalSkillConditions(template, ctx);
        if (!cond.ok) {
            this.addLog(`  ❌ ${cond.reason}`);
            this.app?.showToast?.(cond.reason, 'warning');
            return { handled: true, ok: false };
        }

        const effects = Array.isArray(template.effects) ? template.effects : [];
        for (let i = 0; i < effects.length; i++) {
            const ef = effects[i];
            if (!ef || !ef.type) continue;
            if (!this.getEffectEnabled(attacker, ef, i)) continue;

            if (ef.type === 'DAMAGE_SKILL_ROLL') {
                const list = this.resolveEffectTargets(ef.targets, ctx).filter((c) => this.isCombatCapable(c));
                const n = list.length;
                if (n === 0) continue;

                const skillStat = this.getEffectiveStat(attacker, 'skill');
                const rolled = this.rollAttackSkillRawDamage(skillStat);
                const perTargetRaw = ef.split === 'evenFloor' ? Math.floor((Number(rolled.raw) || 0) / n) : Number(rolled.raw) || 0;

                this.addLog(`  🎲 스킬 데미지: ${rolled.min} + (1~${rolled.extraMax})[${rolled.bonus}] = ${rolled.raw} (최대 ${rolled.max})`);
                if (ef.split === 'evenFloor') this.addLog(`  👥 다수 분배: floor(${rolled.raw} / ${n}) = ${perTargetRaw} (각 대상 원데미지)`);

                list.forEach((defender) => {
                    if (perTargetRaw <= 0) return;
                    const defStat = ef.applyDefense ? this.getEffectiveStat(defender, 'defense') : 1;
                    const defensePercent = ef.applyDefense ? this.getDefenseReductionPercent(defStat) : 0;
                    const damage = ef.applyDefense ? this.applyDefenseReduction(perTargetRaw, defensePercent) : perTargetRaw;

                    this.addLog(`  🎯 대상: ${defender.name}`);
                    if (ef.applyDefense) this.addLog(`    🛡️ 방어력: ${defensePercent}% (원데미지 ${perTargetRaw} → 실제 ${damage})`);

                    const beforeShield = this.getShieldHp(defender);
                    const applied = this.applyDamageWithShield(defender, damage);
                    if (beforeShield > 0 || applied.shieldAbsorbed > 0) {
                        this.addLog(`    🧱 쉴드: ${beforeShield} → ${this.getShieldHp(defender)} (흡수 ${applied.shieldAbsorbed})`);
                    }
                    if (defender.hp <= 0) this.addLog(`    💀 ${defender.name}이(가) 쓰러졌습니다!`);
                });
                continue;
            }

            if (ef.type === 'DAMAGE_FLAT') {
                const list = this.resolveEffectTargets(ef.targets, ctx).filter((c) => this.isCombatCapable(c));
                const raw = Math.max(0, Math.floor(Number(ef.amount) || 0));
                if (raw <= 0 || list.length === 0) continue;

                this.addLog(`  🌊 부수 피해: ${raw} (대상 ${list.length}명)`);
                list.forEach((t) => {
                    const defStat = ef.applyDefense ? this.getEffectiveStat(t, 'defense') : 1;
                    const defensePercent = ef.applyDefense ? this.getDefenseReductionPercent(defStat) : 0;
                    const damage = ef.applyDefense ? this.applyDefenseReduction(raw, defensePercent) : raw;

                    if (ef.applyDefense) {
                        this.addLog(`    🛡️ ${t.name} 방어 적용: ${defensePercent}% (원데미지 ${raw} → 실제 ${damage})`);
                    }
                    this.applyDamageWithShield(t, damage);
                });
                continue;
            }

            if (ef.type === 'APPLY_STATUS') {
                const list = this.resolveEffectTargets(ef.targets, ctx).filter(Boolean);
                list.forEach((t) => this.applyStatusToTarget(t, ef.status, ctx));
                continue;
            }

            if (ef.type === 'SKIP_TURN') {
                const list = this.resolveEffectTargets(ef.targets, ctx).filter(Boolean);
                if (list.length === 0) continue;

                const skillStat = this.getEffectiveStat(attacker, 'skill');
                const count = skillStat >= 5 ? 2 : (skillStat >= 4 ? 1 : 0);
                if (count <= 0) {
                    this.addLog('  ❌ 턴 스킵: 스킬 스탯 4~5만 사용할 수 있습니다.');
                    continue;
                }

                list.forEach((t) => this.applyStatusToTarget(t, { kind: 'SKIP_TURN', durationRounds: 999, flags: { skipTurns: count } }, ctx));
                continue;
            }

            this.addLog(`  ⚠️ 알 수 없는 이펙트: ${ef.type}`);
        }

        if (attacker && attacker.id) this.usedUltimate[attacker.id] = true;

        this.applyUnifiedSkillPenalty(attacker);
        return { handled: true, ok: true };
    }

    /**
     * 전투 초기화
     */
    initializeBattle() {
        this.currentTurn = 1;
        this.currentTeamTurn = 0;
        this.turnOrder = [];
        this.turnIndex = 0;
        this.battleLog = [];
        this.usedUltimate = {};
        this.pendingDefenseResponse = null;

        // 이전 전투/모달에서 남을 수 있는 UI 모드/비활성 상태를 초기화
        if (this.manualHpEditCancelHandler) {
            try { document.removeEventListener('keydown', this.manualHpEditCancelHandler); } catch { /* ignore */ }
            this.manualHpEditCancelHandler = null;
        }
        if (this.battleExitCancelHandler) {
            try { document.removeEventListener('keydown', this.battleExitCancelHandler); } catch { /* ignore */ }
            this.battleExitCancelHandler = null;
        }
        this.manualHpEditMode = false;
        this.battleExitMode = false;
        this.setPrimaryActionButtonsEnabled(true);
        if (typeof this.hideDefenseResponsePanel === 'function') {
            try { this.hideDefenseResponsePanel(); } catch { /* ignore */ }
        }
        if (typeof this.setActionButtonsEnabled === 'function') {
            try { this.setActionButtonsEnabled(true); } catch { /* ignore */ }
        }

        // 전투 시작 시 상태이상 초기화(전투 내 효과는 전투 종료 시 사라짐)
        TEAM_KEYS.forEach((k) => {
            (this.combatCharacters?.[k] || []).forEach((c) => {
                if (c) c.statusEffects = [];
            });
        });
        
        // 선택된 캐릭터들로 전투 캐릭터 설정
        // - 원본 teams 객체를 그대로 쓰면 전투 중 HP/스킬 사용 상태가 자동 저장/동기화로 영구 저장될 수 있음
        // - 전투 전용 클론을 만들어 전투 종료 전까지는 저장되지 않도록 분리
        this.combatCharacters = {
            hero: this.app.teams[0].characters
                .filter(c => this.app.selectedCharacters.hero.includes(c.id))
                .map(c => this.cloneCharacterForBattle(c))
                .filter(Boolean),
            gov: this.app.teams[1].characters
                .filter(c => this.app.selectedCharacters.gov.includes(c.id))
                .map(c => this.cloneCharacterForBattle(c))
                .filter(Boolean),
            villain: this.app.teams[2].characters
                .filter(c => this.app.selectedCharacters.villain.includes(c.id))
                .map(c => this.cloneCharacterForBattle(c))
                .filter(Boolean)
        };

        // 전투 시작 HP 기준(>50이면 50에서 전투 불능, <=50이면 0에서 사망)
        TEAM_KEYS.forEach((k) => {
            (this.combatCharacters?.[k] || []).forEach((c) => {
                if (!c) return;
                // 전투 시작 시 기존 방어막(쉴드)은 항상 리셋
                c.shieldHp = 0;
                // 전투 시작 시점의 HP를 기준으로 룰이 결정됨(매 전투마다 재설정)
                c.battleStartBaseHp = Math.round(Number(this.getBaseHp(c)) || 0);
                c.battleIncapacitated = false;
                c.battleDead = false;
                c.battleExcluded = false;
                c.battleExcludedAtTurn = null;
                c.battleRejoinedAtTurn = null;
                this.ensureHpSplit?.(c);
            });
        });

        this.addLog(`⚔️ 전투 시작! (${this.app.battleMode === 'team' ? '팀전' : '개인전'} 모드)`);
        this.addLog(`히어로: ${this.combatCharacters.hero.length}명 | 정부: ${this.combatCharacters.gov.length}명 | 빌런: ${this.combatCharacters.villain.length}명`);
        this.addLog('---');

        this.rebuildTurnOrder({ log: true });
    }

    getAliveParticipants() {
        return TEAM_KEYS.flatMap((teamKey) => {
            const list = Array.isArray(this.combatCharacters?.[teamKey]) ? this.combatCharacters[teamKey] : [];
            return list
                .filter((c) => this.isCombatCapable(c))
                .map((char) => ({ teamKey, char }));
        });
    }

    shuffleInPlace(list) {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    rebuildTurnOrder({ log = false } = {}) {
        const alive = this.getAliveParticipants();
        const byAgi = new Map();

        alive.forEach(({ teamKey, char }) => {
            const agility = this.clampStat1to5(char?.agility);
            const bucket = byAgi.get(agility) || [];
            bucket.push({ teamKey, char, agility });
            byAgi.set(agility, bucket);
        });

        const agilityValues = Array.from(byAgi.keys()).sort((a, b) => b - a);
        const order = [];
        agilityValues.forEach((agi) => {
            const bucket = byAgi.get(agi) || [];
            // 동률(같은 민첩)일 경우: 동률 그룹 안에서 균등 랜덤(모든 순열 동일 확률)
            this.shuffleInPlace(bucket);
            order.push(...bucket);
        });

        this.turnOrder = order;
        this.turnIndex = 0;

        // 현재팀(기존 UI 호환)도 현재 액터의 팀으로 동기화
        const entry = this.getCurrentTurnEntry();
        if (entry) {
            const idx = ['hero', 'gov', 'villain'].indexOf(entry.teamKey);
            this.currentTeamTurn = idx >= 0 ? idx : 0;
        }

        if (log) {
            const text = this.turnOrder
                .map((e, i) => `${i + 1}.${this.teamLabelKo(e.teamKey) || e.teamKey} ${e.char?.name || '-'}(민첩 ${e.agility})`)
                .join(' → ');
            this.addLog(`🎯 턴 순서(민첩): ${text}`);
        }
    }

    getCurrentTurnEntry() {
        if (!Array.isArray(this.turnOrder) || this.turnOrder.length === 0) return null;
        // 죽은 캐릭터가 끼어있으면 스킵
        for (let step = 0; step < this.turnOrder.length; step++) {
            const idx = (this.turnIndex + step) % this.turnOrder.length;
            const entry = this.turnOrder[idx];
            if (entry?.char && this.isCombatCapable(entry.char)) {
                this.turnIndex = idx;
                return entry;
            }
        }
        return null;
    }

    isCurrentActor(teamKey, charId) {
        const entry = this.getCurrentTurnEntry();
        if (!entry) return false;
        return entry.teamKey === teamKey && String(entry.char?.id) === String(charId);
    }

    initDefenseResponseUi() {
        if (this.defenseUiInitialized) return;

        const modal = document.getElementById('defense-response-modal');
        const dodgeBtn = document.getElementById('defense-response-dodge');
        const counterBtn = document.getElementById('defense-response-counter');
        const defenseSkillBtn = document.getElementById('defense-response-defense-skill');
        const passBtn = document.getElementById('defense-response-pass');
        const closeBtn = document.getElementById('defense-response-close');

        if (!modal || !dodgeBtn || !counterBtn || !passBtn || !closeBtn) return;

        dodgeBtn.addEventListener('click', () => this.submitDefenseResponse('DODGE'));
        counterBtn.addEventListener('click', () => this.submitDefenseResponse('COUNTER'));
        if (defenseSkillBtn) defenseSkillBtn.addEventListener('click', () => this.submitDefenseResponse('DEFENSE_SKILL'));
        passBtn.addEventListener('click', () => this.submitDefenseResponse('PASS'));
        closeBtn.addEventListener('click', () => {
            // 강제 선택 UX: 닫기로 PASS 처리하지 않음
            this.app?.showToast?.('반응을 선택해주세요. (회피 / 반격 / PASS)', 'info');
        });

        // 백드롭 클릭은 무시(자동 PASS 방지)
        modal.addEventListener('click', (e) => {
            if (e.target !== modal) return;
            this.app?.showToast?.('반응을 선택해주세요. (회피 / 반격 / PASS)', 'info');
        });

        // ESC는 닫지 않음(자동 PASS 방지)
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const open = modal.style.display !== 'none';
            if (!open) return;
            if (!this.pendingDefenseResponse) return;
            this.app?.showToast?.('반응을 선택해주세요. (회피 / 반격 / PASS)', 'info');
        });

        this.defenseUiInitialized = true;
    }

    initSkipTurnUi() {
        if (this.skipTurnUiInitialized) return;

        const modal = document.getElementById('skip-turn-modal');
        const closeBtn = document.getElementById('skip-turn-close');
        const okBtn = document.getElementById('skip-turn-ok');
        if (!modal) return;

        const hide = () => this.hideSkipTurnModal();
        if (closeBtn) closeBtn.addEventListener('click', hide);
        if (okBtn) okBtn.addEventListener('click', hide);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) hide();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const open = modal.style.display !== 'none';
            if (!open) return;
            hide();
        });

        this.skipTurnUiInitialized = true;
    }

    showSkipTurnModal(names = []) {
        this.initSkipTurnUi();
        const modal = document.getElementById('skip-turn-modal');
        const text = document.getElementById('skip-turn-text');
        if (!modal) return;

        const list = Array.isArray(names) ? names.filter(Boolean) : [];
        const label = list.length ? list.join(', ') : '대상';
        if (text) {
            text.textContent = `스킬로 턴 스킵되었습니다: ${label}`;
        }

        modal.style.display = 'flex';

        if (this.skipTurnModalTimer) {
            clearTimeout(this.skipTurnModalTimer);
            this.skipTurnModalTimer = null;
        }

        // 짧게 보여주고 자동으로 닫음(사용자는 클릭/ESC로도 닫을 수 있음)
        this.skipTurnModalTimer = setTimeout(() => {
            this.hideSkipTurnModal();
        }, 1200);
    }

    hideSkipTurnModal() {
        const modal = document.getElementById('skip-turn-modal');
        if (modal) modal.style.display = 'none';
        if (this.skipTurnModalTimer) {
            clearTimeout(this.skipTurnModalTimer);
            this.skipTurnModalTimer = null;
        }
    }

    canUseDefenseSkillAsReaction(defenderChar) {
        if (!defenderChar) return false;
        const types = Array.isArray(defenderChar.skillTypes) ? defenderChar.skillTypes : [];
        if (!types.includes('방어형')) return false;
        const actions = this.app?.battleActions;
        if (!actions?.getSkillUseState) return true;
        const st = actions.getSkillUseState(defenderChar);
        return !!st?.canUse;
    }

    gradeLabelKo(grade) {
        switch (grade) {
            case 'CRITICAL':
                return '대성공';
            case 'EXTREME':
                return '극단적 성공';
            case 'HARD':
                return '어려운 성공';
            case 'SUCCESS':
                return '성공';
            case 'FAIL':
            default:
                return '실패';
        }
    }

    teamLabelKo(teamKey) {
        if (teamKey === 'hero') return '히어로';
        if (teamKey === 'gov') return '정부';
        if (teamKey === 'villain') return '빌런';
        return null;
    }

    setActionButtonsEnabled(enabled) {
        const attackBtn = document.getElementById('action-attack');
        const ultimateBtn = document.getElementById('action-ultimate');
        const forfeitBtn = document.getElementById('forfeit-button');
        const adminSkipBtn = document.getElementById('admin-skip-turn');

        [attackBtn, ultimateBtn, forfeitBtn, adminSkipBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? '1' : '0.5';
            btn.style.pointerEvents = enabled ? 'auto' : 'none';
        });
    }

    showDefenseResponsePanel(attackerName, defenderName) {
        this.initDefenseResponseUi();

        const modal = document.getElementById('defense-response-modal');
        const title = document.getElementById('defense-response-title');
        const who = document.querySelector('#defense-response-text .defense-response-banner__who');
        const gradeEl = document.getElementById('defense-response-grade');

        if (who) {
            const atkTeamLabel = this.teamLabelKo(this.pendingDefenseResponse?.attackerTeam);
            who.textContent = atkTeamLabel ? `${atkTeamLabel} '${attackerName}'` : (attackerName || '공격자');
        }

        if (gradeEl) {
            const grade = this.pendingDefenseResponse?.attackGrade;
            gradeEl.textContent = this.gradeLabelKo(grade);
        }
        const allowed = Array.isArray(this.pendingDefenseResponse?.allowedResponses)
            ? this.pendingDefenseResponse.allowedResponses
            : ['DODGE', 'COUNTER', 'DEFENSE_SKILL', 'PASS'];

        if (title) {
            title.textContent = allowed.includes('DODGE') || allowed.includes('COUNTER')
                ? `${defenderName}의 반격 / 회피 / PASS`
                : `${defenderName}의 반응 (방어 스킬 / PASS)`;
        }
        if (modal) {
            modal.style.display = 'flex';
        }

        const dodgeBtn = document.getElementById('defense-response-dodge');
        const counterBtn = document.getElementById('defense-response-counter');
        const passBtn = document.getElementById('defense-response-pass');
        if (dodgeBtn) dodgeBtn.style.display = allowed.includes('DODGE') ? 'inline-flex' : 'none';
        if (counterBtn) counterBtn.style.display = allowed.includes('COUNTER') ? 'inline-flex' : 'none';
        if (passBtn) passBtn.style.display = allowed.includes('PASS') ? 'inline-flex' : 'none';

        // 방어 스킬 버튼은 "방어형" + "스킬 횟수 남음"일 때만 노출
        const defenseSkillBtn = document.getElementById('defense-response-defense-skill');
        if (defenseSkillBtn) {
            const defenderRef = this.pendingDefenseResponse?.defenderRef;
            const canUse = this.canUseDefenseSkillAsReaction(defenderRef);
            defenseSkillBtn.style.display = (allowed.includes('DEFENSE_SKILL') && canUse) ? 'inline-flex' : 'none';
        }

        const hint = document.getElementById('defense-response-hint');
        if (hint) {
            const expiresAt = this.pendingDefenseResponse?.expiresAt;
            const remainingMs = typeof expiresAt === 'number' ? Math.max(0, expiresAt - Date.now()) : null;
            const remainingMin = typeof remainingMs === 'number' ? Math.max(1, Math.ceil(remainingMs / 60000)) : null;
            hint.textContent = remainingMin
                ? `ESC 또는 바깥 클릭은 PASS로 처리됩니다 · 남은 시간 약 ${remainingMin}분`
                : 'ESC 또는 바깥 클릭은 PASS로 처리됩니다.';
        }

        // 기본 포커스(키보드/모바일 접근성)
        if (counterBtn) {
            setTimeout(() => {
                try { counterBtn.focus(); } catch (_) {}
            }, 0);
        }

        // 다른 선택 UI 숨김
        const targetPanel = document.getElementById('target-selection');
        if (targetPanel) targetPanel.classList.add('hidden');

        this.setActionButtonsEnabled(false);
    }

    hideDefenseResponsePanel() {
        const modal = document.getElementById('defense-response-modal');
        if (modal) modal.style.display = 'none';
        this.setActionButtonsEnabled(true);
    }

    async submitDefenseResponse(responseKind) {
        try {
            const pending = this.pendingDefenseResponse;
            const apiUrl = window.CONFIG?.API_BASE_URL;
            if (!pending) return;

            const mode = pending?.mode || 'SERVER_BASIC';

            // 로컬 반응(공격형 스킬 대응 등)
            if (mode === 'LOCAL_SKILL_REACTION') {
                // 방어 스킬(쉴드) 반응: 방어자가 스킬 사용(횟수 차감) 후 로컬로 쉴드 적용
                if (responseKind === 'DEFENSE_SKILL') {
                    const defender = pending.defenderRef;
                    const actions = this.app?.battleActions;
                    if (!this.canUseDefenseSkillAsReaction(defender)) {
                        this.addLog('ℹ️ 방어 스킬을 사용할 수 없습니다(방어형이 아니거나 횟수 소진).');
                        return;
                    }

                    if (actions?.consumeSkillUse) {
                        const consumed = actions.consumeSkillUse(defender);
                        if (!consumed?.consumed) {
                            this.addLog('ℹ️ 방어 스킬 사용 불가: 사용 횟수 소진/잠금 상태');
                            return;
                        }
                    }
                }

                // UI 닫고 상태 초기화 후, 콜백에서 실제 처리
                this.pendingDefenseResponse = null;
                this.hideDefenseResponsePanel();

                if (typeof pending.onResolve === 'function') {
                    pending.onResolve(responseKind);
                }

                // 방어 스킬을 썼다면: 스킬 스탯 1회 소모 + 공통 패널티
                if (responseKind === 'DEFENSE_SKILL' && pending.defenderRef) {
                    this.consumeStatMods(pending.defenderRef, 'ON_SKILL');
                    this.applyUnifiedSkillPenalty(pending.defenderRef);
                }

                this.renderBattle();
                this.checkBattleEnd();
                this.nextTurn();
                this.renderBattle();
                return;
            }

            if (!apiUrl) return;

            // 방어 스킬(쉴드) 반응: 방어자가 스킬 사용(횟수 차감/패널티) 후 서버에 DEFENSE_SKILL로 전달
            if (responseKind === 'DEFENSE_SKILL') {
                const defender = pending.defenderRef;
                const actions = this.app?.battleActions;
                if (!this.canUseDefenseSkillAsReaction(defender)) {
                    this.addLog('ℹ️ 방어 스킬을 사용할 수 없습니다(방어형이 아니거나 횟수 소진).');
                    return;
                }

                if (actions?.consumeSkillUse) {
                    const consumed = actions.consumeSkillUse(defender);
                    if (!consumed?.consumed) {
                        this.addLog('ℹ️ 방어 스킬 사용 불가: 사용 횟수 소진/잠금 상태');
                        return;
                    }
                }

                // 스킬 사용으로 간주: 스킬 스탯 1회 소모 + 공통 패널티
                this.consumeStatMods(defender, 'ON_SKILL');
                this.applyUnifiedSkillPenalty(defender);
            }

            const response = await fetch(`${apiUrl}/battles/simulate-react`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pendingId: pending.pendingId,
                    response: responseKind,
                    pendingState: pending.pendingState
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err?.message || err?.error || '방어자 응답 처리 실패');
            }

            const result = await response.json();

            const hasStructured = !!(result && (result.response || result.defenseJudgment || result.counterJudgment || result.counterAgiJudgment || Number.isFinite(Number(result.shieldAmount))));

            const attackerRef = pending.attackerRef;
            const defenderRef = pending.defenderRef;
            const attackerName = attackerRef?.name || '공격자';
            const defenderName = defenderRef?.name || '방어자';

            const beforeAttackerTotal = attackerRef ? this.getTotalHp(attackerRef) : 0;
            const beforeDefenderTotal = defenderRef ? this.getTotalHp(defenderRef) : 0;

            const shieldAmount = Number.isFinite(Number(result?.shieldAmount)) ? Math.max(0, Math.round(Number(result.shieldAmount))) : 0;
            const effectiveBeforeDefender = Number.isFinite(Number(result?.effectiveDefenderHpBeforeDamage))
                ? Math.max(0, Math.round(Number(result.effectiveDefenderHpBeforeDamage)))
                : ((responseKind === 'DEFENSE_SKILL' && shieldAmount > 0) ? (beforeDefenderTotal + shieldAmount) : beforeDefenderTotal);

            // 반격 성공 시 공격자 HP 갱신(서버는 delta만 제공)
            let appliedToAttacker = null;
            if (typeof result.attackerDamage === 'number' && attackerRef) {
                appliedToAttacker = this.applyDamageWithShield(attackerRef, Math.max(0, Math.round(result.attackerDamage)));
                this.evaluateHpStateTransition(attackerRef, { cause: '반격 피해' });
            }

            if (typeof result.defenderHp === 'number' && defenderRef) {
                this.setHpFromTotal(defenderRef, result.defenderHp);
                this.evaluateHpStateTransition(defenderRef, { cause: '피해' });
            }

            const afterAttackerTotal = attackerRef ? this.getTotalHp(attackerRef) : 0;
            const afterDefenderTotal = defenderRef ? this.getTotalHp(defenderRef) : 0;

            if (hasStructured) {
                const lines = [];

                if (responseKind === 'PASS') {
                    lines.push(`${defenderName} | PASS 시도!`);
                } else if (responseKind === 'DODGE') {
                    lines.push(`${defenderName} | 회피 시도!`);

                    const dj = result?.defenseJudgment;
                    const dodged = !!result?.dodged;
                    lines.push(`${defenderName} | 회피 ${dodged ? '성공' : '실패'}`);
                    if (dj && Number.isFinite(Number(dj.roll)) && Number.isFinite(Number(dj.threshold))) {
                        lines.push(this.formatRollLine({ roll: dj.roll, threshold: dj.threshold, statLabel: '민첩', grade: dj.grade }));
                    }
                } else if (responseKind === 'COUNTER') {
                    lines.push(`${defenderName} | 반격 시도!`);

                    const countered = !!result?.countered;
                    lines.push(`${defenderName} | 반격 ${countered ? '성공' : '실패'}`);

                    const atkJ = result?.counterJudgment || result?.defenseJudgment;
                    const agiJ = result?.counterAgiJudgment;

                    if (atkJ && Number.isFinite(Number(atkJ.roll)) && Number.isFinite(Number(atkJ.threshold))) {
                        lines.push(this.formatRollLine({ roll: atkJ.roll, threshold: atkJ.threshold, statLabel: '공격', grade: atkJ.grade }));
                    }
                    if (agiJ && Number.isFinite(Number(agiJ.roll)) && Number.isFinite(Number(agiJ.threshold))) {
                        lines.push(this.formatRollLine({ roll: agiJ.roll, threshold: agiJ.threshold, statLabel: '민첩', grade: agiJ.grade }));
                    }
                } else if (responseKind === 'DEFENSE_SKILL') {
                    lines.push(`${defenderName} | 방어 스킬(쉴드) 사용!`);
                }

                if (responseKind === 'DEFENSE_SKILL' && shieldAmount > 0) {
                    lines.push(`🧱 쉴드 +${shieldAmount} | 총 HP ${beforeDefenderTotal} → ${effectiveBeforeDefender}`);
                }

                // 이후 결과(데미지 결과)
                if (result?.countered) {
                    const cd = Number.isFinite(Number(result?.counterDamage)) ? Math.max(0, Math.round(Number(result.counterDamage)))
                        : (Number.isFinite(Number(result?.attackerDamage)) ? Math.max(0, Math.round(Number(result.attackerDamage))) : null);
                    if (cd !== null) lines.push(`💥 반격 데미지: ${cd}`);
                    if (attackerRef) {
                        const absorbed = appliedToAttacker ? appliedToAttacker.shieldAbsorbed : 0;
                        lines.push(`💚 ${attackerName} HP: ${beforeAttackerTotal} → ${afterAttackerTotal}${absorbed ? ` (쉴드 흡수 ${absorbed})` : ''}`);
                    }
                    if (defenderRef && beforeDefenderTotal !== afterDefenderTotal) {
                        lines.push(`💚 ${defenderName} HP: ${effectiveBeforeDefender} → ${afterDefenderTotal}`);
                    }
                } else if (result?.dodged) {
                    lines.push('💥 데미지: 0');
                    if (defenderRef) lines.push(`💚 ${defenderName} HP: ${effectiveBeforeDefender} → ${afterDefenderTotal}`);
                } else if (result?.success === false) {
                    lines.push('❌ 공격 실패');
                } else {
                    const raw = Number.isFinite(Number(result?.rawDamage)) ? Math.max(0, Math.round(Number(result.rawDamage))) : null;
                    const dmg = Number.isFinite(Number(result?.damage)) ? Math.max(0, Math.round(Number(result.damage))) : null;
                    const pct = Number.isFinite(Number(result?.defensePercent)) ? Math.round(Number(result.defensePercent)) : null;

                    if (pct !== null && raw !== null && dmg !== null) {
                        if (responseKind === 'COUNTER' && result?.counterFailedPenalty) {
                            lines.push(`⚠️ 반격 실패 페널티: 방어력 무시 (원데미지 ${raw} → 실제 ${dmg})`);
                        } else {
                            lines.push(`🛡️ 방어력: ${pct}% (원데미지 ${raw} → 실제 ${dmg})`);
                        }
                    }
                    if (dmg !== null) lines.push(`💥 데미지: ${dmg}`);
                    if (defenderRef) lines.push(`💚 ${defenderName} HP: ${effectiveBeforeDefender} → ${afterDefenderTotal}`);
                }

                // 공격 시작 블럭과 같은 그룹에 자연스럽게 이어붙이기 위해(1블럭 느낌), 반응 블럭은 타임스탬프를 생략
                this.addLogBlock(lines, { timestampOnFirst: false });
            } else if (Array.isArray(result.log)) {
                // 세부 판정 데이터가 없으면 서버 로그를 그대로 출력
                result.log.forEach((logEntry) => this.addLog(logEntry));
            }

            // 피격/방어 처리 후 방어 관련 스탯 변화 1회 소모
            if ((responseKind === 'PASS' || responseKind === 'DEFENSE_SKILL') && pending.defenderRef) {
                this.consumeStatMods(pending.defenderRef, 'ON_DEFEND');
            }

            // 민첩(회피/반격) 판정을 사용한 뒤에는 민첩 관련 버프/디버프/패널티를 1회 소모
            if ((responseKind === 'DODGE' || responseKind === 'COUNTER') && pending.defenderRef) {
                this.consumeStatMods(pending.defenderRef, 'ON_AGI_CHECK');
            }

            this.pendingDefenseResponse = null;
            this.hideDefenseResponsePanel();

            // 같은 턴의 하위 단계가 끝났으니 이제 턴을 진행
            this.renderBattle();
            this.checkBattleEnd();
            this.nextTurn();
        } catch (error) {
            console.error('방어자 응답 처리 에러:', error);
            this.addLog(`❌ 방어자 응답 처리 중 오류: ${error.message}`);
            // 안전하게 패널 닫고 상태 초기화
            this.pendingDefenseResponse = null;
            this.hideDefenseResponsePanel();
            this.renderBattle();
        }
    }

    applyDefenseSkillReactionSingle(defender) {
        if (!defender) return null;
        const skillStat = this.getEffectiveStat(defender, 'skill');
        const rolled = this.rollShieldSkillAmountByStat(skillStat);
        const beforeShield = this.getShieldHp(defender);
        const beforeTotal = this.getTotalHp(defender);
        const added = this.addShieldHp(defender, rolled.raw);
        const afterTotal = this.getTotalHp(defender);

        this.addLog(`  🛡️ 방어 스킬(반응) 발동: ${rolled.min} + (1~${rolled.extraMax})[${rolled.bonus}] = ${rolled.raw} (최대 ${rolled.max})`);
        this.addLog(`  🧱 쉴드: ${beforeShield} → ${this.getShieldHp(defender)} (총 HP ${beforeTotal} → ${afterTotal})`);

        return { added, rolled };
    }

    /**
     * 전투 렌더링
     */
    renderBattle() {
        const { heroContainer, govContainer, villainContainer } = this.getCombatDom();

        // 현재 액터는 1회만 계산(카드 수만큼 turnOrder 스캔 방지)
        const current = this.getCurrentTurnEntry();
        const currentTeamKey = current?.teamKey ? String(current.teamKey) : null;
        const currentCharId = current?.char?.id != null ? String(current.char.id) : null;

        if (heroContainer) {
            heroContainer.innerHTML = this.combatCharacters.hero
                .map((char) => this.createCharacterDisplay(char, 'hero', { currentTeamKey, currentCharId }))
                .join('');
        }

        if (govContainer) {
            govContainer.innerHTML = this.combatCharacters.gov
                .map((char) => this.createCharacterDisplay(char, 'gov', { currentTeamKey, currentCharId }))
                .join('');
        }

        if (villainContainer) {
            villainContainer.innerHTML = this.combatCharacters.villain
                .map((char) => this.createCharacterDisplay(char, 'villain', { currentTeamKey, currentCharId }))
                .join('');
        }

        this.renderLog();
        this.updateTurnInfo();
        this.updateSkillSlots();
    }

    /**
     * 캐릭터 표시 생성
     */
    createCharacterDisplay(char, team, { currentTeamKey = null, currentCharId = null } = {}) {
        // HP/쉴드 정규화는 1회만 수행
        this.ensureHpSplit(char);
        const maxHp = this.getMaxHp(char);
        const baseHp = Math.max(0, Math.min(maxHp, Math.round(Number(char?.hp) || 0)));
        const shieldHp = Math.max(0, Math.round(Number(char?.shieldHp) || 0));
        const hpPercent = Math.max(0, Math.min(100, Math.round((baseHp / maxHp) * 100)));
        const hpColor = (() => {
            if (hpPercent <= 10) return '#ef4444';
            if (hpPercent <= 25) return '#fb923c';
            if (hpPercent <= 50) return '#facc15';
            return '#22c55e';
        })();
        const tags = (char.skillTypes || []).map(type => {
            if (type === '공격형') return '<span class="tag tag-attack">공격형</span>';
            if (type === '방어형') return '<span class="tag tag-defense">방어형</span>';
            if (type === '지원형') return '<span class="tag tag-support">지원형</span>';
            if (type === '치료형') return '<span class="tag tag-heal">치료형</span>';
            return `<span class="tag">${type}</span>`;
        }).join('');

        const stateTags = [
            char?.battleDead ? '<span class="tag" style="background:#7f1d1d; color:#fff;">사망</span>' : '',
            char?.battleIncapacitated ? '<span class="tag" style="background:#4a5568; color:#fff;">전투불능</span>' : '',
            char?.battleExcluded ? '<span class="tag" style="background:#1f2937; color:#fff;">이탈</span>' : ''
        ].filter(Boolean).join('');

        const shieldBadge = shieldHp > 0 ? `<span class="shield-badge" title="방어 스킬(쉴드)">🧱 ${shieldHp}</span>` : '';
        const shieldText = shieldHp > 0 ? `<span class="hp-shield-text">+${shieldHp}</span>` : '';

        const isCurrent = (currentTeamKey && currentCharId)
            ? (String(team) === currentTeamKey && String(char?.id) === currentCharId)
            : this.isCurrentActor(team, char.id);

        // 스탯은 statusEffects 순회를 최소화(4회 -> 1회)
        const eff = this.getEffectiveStatsForDisplay(char);

        return `
            <div class="combat-char-card${isCurrent ? ' is-current' : ''}${char?.battleExcluded ? ' is-excluded' : ''}" data-char-id="${char.id}" data-team="${team}">
                <div class="char-top">
                    <div class="char-name">${char.name}${shieldBadge ? ` ${shieldBadge}` : ''}</div>
                    <div class="char-tags">${(tags || '<span class="tag tag-empty">-</span>')}${stateTags ? ` ${stateTags}` : ''}</div>
                </div>
                <div class="hp-row">
                    <div class="hp-label">HP ${baseHp}/${maxHp}${shieldText ? ` ${shieldText}` : ''}</div>
                    <div class="hp-bar${shieldHp > 0 ? ' has-shield' : ''}">
                        <span class="hp-base" style="width: ${hpPercent}%; background: ${hpColor};"></span>
                        ${shieldHp > 0 ? '<span class="hp-shield-overlay"></span>' : ''}
                    </div>
                </div>
                <div class="stat-row">
                    <span>⚔️ ${eff.attack}</span>
                    <span>🛡️ ${eff.defense}</span>
                    <span>💨 ${eff.agility}</span>
                    <span>⭐ ${eff.skill}</span>
                </div>
            </div>
        `;
    }

    getEffectiveStatsForDisplay(char) {
        // getEffectiveStat 4회 호출을 1회 순회로 대체(결과는 동일)
        const baseAttack = this.clampStat1to5(this.getBaseStatValue(char, 'attack'));
        const baseDefense = this.clampStat1to5(this.getBaseStatValue(char, 'defense'));
        const baseAgility = this.clampStat1to5(this.getBaseStatValue(char, 'agility'));
        const baseSkill = this.clampStat1to5(this.getBaseStatValue(char, 'skill'));

        let dAttack = 0;
        let dDefense = 0;
        let dAgility = 0;
        let dSkill = 0;

        const effects = this.getActiveStatusEffects(char);
        for (const e of effects) {
            const mods = e?.statMods;
            if (!mods) continue;
            const a = Number(mods.attack || 0);
            const d = Number(mods.defense || 0);
            const g = Number(mods.agility || 0);
            const s = Number(mods.skill || 0);
            if (Number.isFinite(a)) dAttack += a;
            if (Number.isFinite(d)) dDefense += d;
            if (Number.isFinite(g)) dAgility += g;
            if (Number.isFinite(s)) dSkill += s;
        }

        return {
            attack: this.clampStat1to5(baseAttack + dAttack),
            defense: this.clampStat1to5(baseDefense + dDefense),
            agility: this.clampStat1to5(baseAgility + dAgility),
            skill: this.clampStat1to5(baseSkill + dSkill)
        };
    }

    // ===== 스킬(프론트) 공용 헬퍼 =====
    clampStat1to5(value) {
        return Math.max(1, Math.min(5, Math.round(Number(value) || 1)));
    }

    getMaxHp(char) {
        const raw = Number(char?.maxHp);
        const maxHp = Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : 100;
        // 보호 로직: 레거시/동기화 문제로 maxHp가 97 같은 값으로 "현재 HP"에 끌려가 저장되는 경우가 있음.
        // 기본 최대 100 규칙을 우선해 90~99는 100으로 복구.
        if (maxHp >= 90 && maxHp < 100) return 100;
        return maxHp;
    }

    ensureHpSplit(char) {
        if (!char) return;
        const maxHp = this.getMaxHp(char);

        const baseRaw = Number(char?.hp);
        const shieldRaw = Number(char?.shieldHp);

        // 레거시(총 HP를 hp 하나로 표현): hp가 maxHp를 초과하면 초과분을 shieldHp로 분리
        if (!Number.isFinite(shieldRaw)) {
            const total = Number.isFinite(baseRaw) ? Math.max(0, Math.round(baseRaw)) : 0;
            const base = Math.min(maxHp, total);
            const shield = Math.max(0, total - maxHp);
            char.hp = base;
            char.shieldHp = shield;
            return;
        }

        // 신규(분리 저장): base HP는 0..maxHp, shield는 0..
        const base = Number.isFinite(baseRaw) ? Math.max(0, Math.min(maxHp, Math.round(baseRaw))) : 0;
        const shield = Math.max(0, Math.round(shieldRaw) || 0);
        char.hp = base;
        char.shieldHp = shield;
    }

    getTotalHp(char) {
        if (!char) return 0;
        this.ensureHpSplit(char);
        const base = Math.max(0, Math.round(Number(char?.hp) || 0));
        const shield = Math.max(0, Math.round(Number(char?.shieldHp) || 0));
        return base + shield;
    }

    isCombatCapable(char) {
        if (!char) return false;
        if (char.battleExcluded) return false;
        if (char.battleDead) return false;
        if (char.battleIncapacitated) return false;
        return this.getTotalHp(char) > 0;
    }

    ensureBattleStartHpIfMissing(char) {
        if (!char) return;
        if (!Number.isFinite(Number(char.battleStartBaseHp))) {
            // 중요 규칙: "시작 HP > 50" 여부는 전투 시작 시점에서만 결정되어야 함.
            // 전투 도중(특히 치유 후) 누락된 값을 현재 HP로 추정하면, 잘못해서 >50 규칙이 발동할 수 있음.
            // 따라서 누락 케이스의 안전한 기본값은 50 이하로 캡해서 설정한다.
            const inferred = Math.round(Number(this.getBaseHp(char)) || 0);
            char.battleStartBaseHp = Math.min(50, inferred);
        }
    }

    evaluateHpStateTransition(char, { cause = '' } = {}) {
        if (!char) return;
        this.ensureHpSplit(char);
        this.ensureBattleStartHpIfMissing(char);

        const startBase = Math.round(Number(char.battleStartBaseHp) || 0);
        const baseHp = this.getBaseHp(char);
        const totalHp = this.getTotalHp(char);

        // 사망 상태는 고정(단, HP는 안전하게 0 유지)
        if (char.battleDead) {
            char.hp = 0;
            char.shieldHp = 0;
            return;
        }

        // 시작 HP가 50 초과면, 전투 중 baseHP가 50 이하가 되는 순간 전투 불능
        if (startBase > 50) {
            // 전투 중에는 baseHP가 50 미만으로 내려가지 않도록 고정
            const maxHp = this.getMaxHp(char);
            if (baseHp < 50) {
                char.hp = Math.min(maxHp, 50);
            }

            // 전투 불능은 최초 1회만 로그/전환
            if (!char.battleIncapacitated && this.getBaseHp(char) <= 50) {
                char.battleIncapacitated = true;
                this.addLog(`  🟡 ${char.name} 전투 불능! (시작 HP ${startBase} > 50, 현재 HP ${this.getBaseHp(char)} ≤ 50)${cause ? ` · ${cause}` : ''}`);
            }
            return;
        }

        // 시작 HP가 50 이하이면, 전투 중 totalHP가 0 이하가 되는 순간 사망
        if (totalHp <= 0) {
            char.battleDead = true;
            char.hp = 0;
            char.shieldHp = 0;
            // 로스터에도 표시될 수 있도록 상태를 dead로 둠(기존 시스템과 호환)
            char.status = 'dead';
            this.addLog(`  💀 ${char.name} 사망! (시작 HP ${startBase} ≤ 50, 현재 HP 0)${cause ? ` · ${cause}` : ''}`);
        }
    }

    getShieldHp(char) {
        if (!char) return 0;
        this.ensureHpSplit(char);
        return Math.max(0, Math.round(Number(char?.shieldHp) || 0));
    }

    getBaseHp(char) {
        if (!char) return 0;
        this.ensureHpSplit(char);
        const maxHp = this.getMaxHp(char);
        return Math.max(0, Math.min(maxHp, Math.round(Number(char?.hp) || 0)));
    }

    setHpFromTotal(target, totalHp) {
        if (!target) return;
        this.ensureHpSplit(target);
        const maxHp = this.getMaxHp(target);
        const total = Math.max(0, Math.round(Number(totalHp) || 0));
        target.hp = Math.min(maxHp, total);
        target.shieldHp = Math.max(0, total - maxHp);
    }

    applyDamageWithShield(defender, damage) {
        const dmg = Math.max(0, Math.floor(Number(damage) || 0));
        if (dmg === 0) return { shieldAbsorbed: 0, hpDamage: 0, totalDamage: 0 };

        this.ensureHpSplit(defender);
        this.ensureBattleStartHpIfMissing(defender);

        const maxHp = this.getMaxHp(defender);
        const beforeShield = this.getShieldHp(defender);
        const beforeBase = this.getBaseHp(defender);

        const startBase = Math.round(Number(defender?.battleStartBaseHp) || 0);
        const baseFloor = startBase > 50 ? 50 : 0;

        const shieldAbsorbed = Math.min(beforeShield, dmg);
        const remaining = dmg - shieldAbsorbed;

        // 시작 baseHP가 50 초과인 캐릭터는 전투 중 baseHP가 50 미만으로 내려가지 않음
        const allowedBaseDamage = Math.max(0, beforeBase - baseFloor);
        const hpDamage = Math.min(allowedBaseDamage, remaining);

        // 50 고정으로 인해 추가 피해가 무시되는 경우(사용자 혼동 방지용 로그, 1턴 1회)
        if (baseFloor > 0 && remaining > 0 && hpDamage === 0 && beforeBase <= baseFloor) {
            const turnKey = Number.isFinite(Number(this.turnIndex)) ? Number(this.turnIndex) : 0;
            if (defender._floorDamageIgnoredTurnKey !== turnKey) {
                defender._floorDamageIgnoredTurnKey = turnKey;
                this.addLog(`  ℹ️ ${defender.name}은(는) 전투 불능 상태로 HP가 ${baseFloor} 미만으로 내려가지 않습니다.`);
            }
        }

        const afterBase = Math.max(baseFloor, beforeBase - hpDamage);
        const afterShield = Math.max(0, beforeShield - shieldAbsorbed);
        defender.hp = Math.min(maxHp, afterBase);
        defender.shieldHp = Math.max(0, afterShield);

        this.evaluateHpStateTransition(defender, { cause: '피해' });

        return { shieldAbsorbed, hpDamage, totalDamage: shieldAbsorbed + hpDamage };
    }

    applyHealToBaseHp(target, amount) {
        const heal = Math.max(0, Math.floor(Number(amount) || 0));
        if (heal === 0) return 0;

        this.ensureHpSplit(target);

        if (!this.canHealTarget(target)) {
            this.addLog(`  🚫 ${target?.name || '대상'}은(는) 치유 불가 상태입니다.`);
            return 0;
        }

        const maxHp = this.getMaxHp(target);
        const shield = this.getShieldHp(target);
        const base = this.getBaseHp(target);

        const afterBase = Math.min(maxHp, base + heal);
        target.hp = afterBase;
        target.shieldHp = shield;
        // 힐로는 전투 불능/사망 상태가 되돌아가지 않음(상태는 고정)
        return afterBase - base;
    }

    addShieldHp(target, amount) {
        const add = Math.max(0, Math.floor(Number(amount) || 0));
        if (add === 0) return 0;
        this.ensureHpSplit(target);
        target.shieldHp = this.getShieldHp(target) + add;
        return add;
    }

    pickUnifiedSkillPenaltyStatKey() {
        const keys = ['attack', 'defense', 'agility'];
        const idx = Math.max(0, Math.min(keys.length - 1, Math.floor(Math.random() * keys.length)));
        return keys[idx];
    }

    applyUnifiedSkillPenalty(attacker) {
        if (!attacker) return;
        const preferred = attacker?.skillPenaltyStatKey;
        const allowed = new Set(['attack', 'defense', 'agility']);
        const key = (preferred && allowed.has(String(preferred))) ? String(preferred) : this.pickUnifiedSkillPenaltyStatKey();
        const label = key === 'attack' ? '공격력' : (key === 'defense' ? '방어력' : '민첩');
        // 패널티는 "해당 스탯을 실제로 사용/트리거 후 1회 소모" 방식
        this.applyConsumableStatMod(attacker, key, -1, { attacker }, { durationRounds: 999 });
        this.addLog(`  ⚠️ 스킬 패널티: ${label} -1 (해당 스탯 1회 사용 후 소멸)`);
    }

    rollHealSkillAmountByStat(skillStat) {
        const stat = this.clampStat1to5(skillStat);
        const table = {
            1: { min: 4, extraMax: 3 },
            2: { min: 9, extraMax: 3 },
            3: { min: 11, extraMax: 4 },
            4: { min: 14, extraMax: 4 },
            5: { min: 16, extraMax: 5 }
        };
        const profile = table[stat] || table[1];
        const bonus = this.rollInt(1, profile.extraMax);
        const raw = Math.floor(profile.min + bonus);
        return { stat, min: profile.min, extraMax: profile.extraMax, bonus, raw, max: profile.min + profile.extraMax };
    }

    rollShieldSkillAmountByStat(skillStat) {
        const stat = this.clampStat1to5(skillStat);
        const table = {
            1: { min: 8, extraMax: 3 },
            2: { min: 11, extraMax: 3 },
            3: { min: 13, extraMax: 4 },
            4: { min: 16, extraMax: 4 },
            5: { min: 18, extraMax: 5 }
        };
        const profile = table[stat] || table[1];
        const bonus = this.rollInt(1, profile.extraMax);
        const raw = Math.floor(profile.min + bonus);
        return { stat, min: profile.min, extraMax: profile.extraMax, bonus, raw, max: profile.min + profile.extraMax };
    }

    getSupportDebuffAmountBySkillStat(skillStat) {
        const stat = this.clampStat1to5(skillStat);
        const table = { 1: 6, 2: 7, 3: 8, 4: 9, 5: 10 };
        return table[stat] ?? table[1];
    }

    supportAmountToStatDelta(amount) {
        const v = Math.max(0, Math.floor(Number(amount) || 0));
        // 사용자가 정한 기준: 10 정도면 스탯 +2
        return Math.max(0, Math.floor(v / 5));
    }

    consumeSkipTurnIfAny(char) {
        if (!char) return false;
        const effects = this.getActiveStatusEffects(char);
        const entry = effects.find((e) => Number.isFinite(Number(e?.flags?.skipTurns)) && Number(e.flags.skipTurns) > 0);
        if (!entry) return false;

        const next = Math.max(0, Math.floor(Number(entry.flags.skipTurns) - 1));
        entry.flags.skipTurns = next;
        if (next <= 0 && typeof entry.durationRounds === 'number') {
            entry.durationRounds = 0;
        }
        return true;
    }

    /**
     * 스킵(지원형) 상태면 해당 캐릭터의 이번 행동을 "확정 실패"로 처리하고
     * 즉시 턴을 넘깁니다. (UI 흐름 상 nextTurn만으로는 스킵이 체감되지 않는 케이스를 방지)
     * @returns {boolean} 스킵을 처리해 턴을 넘겼으면 true
     */
    enforceSkipAsForcedFailIfNeeded() {
        const entry = this.getCurrentTurnEntry();
        const actor = entry?.char;
        if (!actor) return false;

        const skipped = this.consumeSkipTurnIfAny(actor);
        if (!skipped) return false;

        const nm = actor?.name || '대상';
        this.addLog(`⛔ ${nm} 행동 확정 실패: 턴 스킵 상태`);
        this.addLog(`⏭️ ${nm}의 턴이 스킵되었습니다.`);
        this.showSkipTurnModal([nm]);

        // 스킵 처리 후 다음 턴으로 진행
        this.nextTurn();
        return true;
    }

    executeSupportSkillMulti(attacker, targets, attackerTeamKey, supportMode = 'AUTO', supportOptions = {}) {
        const list = Array.isArray(targets) ? targets.filter(Boolean) : [];
        const n = list.length;
        if (n === 0) {
            this.addLog('❌ 지원형 스킬: 대상이 없습니다.');
            return;
        }

        this.addLog(`\n🤝 ${attacker.name} 지원형 스킬 사용! (대상 ${n}명)`);

        const skillStat = this.getEffectiveStat(attacker, 'skill');
        const amount = this.getSupportDebuffAmountBySkillStat(skillStat);
        const delta = this.supportAmountToStatDelta(amount);
        this.addLog(`  📎 총 디버프량: ±${amount} (스탯 환산 ±${delta})`);

        const alliance = this.getAlliance(attackerTeamKey);
        const allies = new Set(alliance.allies);

        const mode = String(supportMode || 'AUTO').toUpperCase();

        // TURN_SKIP: 대상의 턴을 1~2회 스킵(스킬 스탯 4~5만 가능)
        if (mode === 'TURN_SKIP') {
            const ctx = { attacker, teamKey: attackerTeamKey, targets: list };
            const count = skillStat >= 5 ? 2 : (skillStat >= 4 ? 1 : 0);
            if (count <= 0) {
                this.addLog('  ❌ 턴 스킵: 스킬 스탯 4~5만 사용할 수 있습니다.');
            } else {
                list.forEach((t) => {
                    this.applyStatusToTarget(t, { kind: 'SKIP_TURN', durationRounds: 999, flags: { skipTurns: count } }, ctx);
                    this.addLog(`  🎯 대상: ${t.name} (턴 스킵 ${count}회)`);
                });
            }

            if (attacker && attacker.id) {
                this.usedUltimate[attacker.id] = true;
            }

            // 지원형도 스킬 사용이므로 스킬스탯 소모(1회) + 공통 패널티
            this.consumeStatMods(attacker, 'ON_SKILL');
            this.applyUnifiedSkillPenalty(attacker);
            return;
        }

        // DISPEL: 적의 (+) 버프 제거(강한 제거형)
        if (mode === 'DISPEL') {
            list.forEach((t) => {
                const removed = this.dispelPositiveStatBuffs(t);
                this.addLog(`  🎯 대상: ${t.name} (버프 제거: +버프 ${removed}개 해제)`);
            });

            if (attacker && attacker.id) {
                this.usedUltimate[attacker.id] = true;
            }

            // 지원형도 스킬 사용이므로 스킬스탯 소모(1회) + 공통 패널티
            this.consumeStatMods(attacker, 'ON_SKILL');
            this.applyUnifiedSkillPenalty(attacker);
            return;
        }

        // CANCEL: 대상의 스탯 변화(버프/디버프) 무효화
        if (mode === 'CANCEL') {
            const cancelEnabled = supportOptions?.cancelFeatureEnabled !== false;
            const kind = String(supportOptions?.cancelKind || 'BOTH').toUpperCase();
            const stats = Array.isArray(supportOptions?.cancelStats) ? supportOptions.cancelStats : null;
            const magnitude = supportOptions?.cancelMagnitude;
            if (!cancelEnabled) {
                this.addLog('  ⚠️ 스탯 캔슬: 현재 비활성화되어 적용되지 않습니다.');
            }
            list.forEach((t) => {
                const removed = cancelEnabled ? this.cancelStatMods(t, kind, stats, magnitude) : 0;
                const label = (kind === 'BUFF') ? '버프 캔슬' : ((kind === 'DEBUFF') ? '디버프 캔슬' : '스탯 캔슬');
                this.addLog(`  🎯 대상: ${t.name} (${label}: 스탯 변화 ${removed}개 무효화)`);
            });

            if (attacker && attacker.id) {
                this.usedUltimate[attacker.id] = true;
            }

            // 지원형도 스킬 사용이므로 스킬스탯 소모(1회) + 공통 패널티
            this.consumeStatMods(attacker, 'ON_SKILL');
            this.applyUnifiedSkillPenalty(attacker);
            return;
        }

        list.forEach((t) => {
            const tTeam = this.findTeamKeyByCharId(t.id);
            const isAlly = tTeam && allies.has(tTeam);
            const sign = (mode === 'BUFF') ? 1 : ((mode === 'DEBUFF') ? -1 : (isAlly ? 1 : -1));
            const signed = sign * delta;

            if (signed === 0) {
                this.addLog(`  🎯 대상: ${t.name} (변화 없음)`);
                return;
            }

            // 스탯별로 "사용/트리거 시 1회 소모"되도록 분리 적용
            const ctx = { attacker, teamKey: attackerTeamKey, targets: list };

            const allowedStats = ['attack', 'agility', 'defense', 'skill'];
            const requested = Array.isArray(supportOptions?.basicStats) ? supportOptions.basicStats.map(String) : [];
            const useRandomAda = requested.includes('RANDOM_ADA');
            const randomPool = ['attack', 'agility', 'defense'];

            const picked = useRandomAda
                ? [randomPool[this.rollInt(0, randomPool.length - 1)]]
                : (requested.length
                    ? allowedStats.filter((k) => requested.includes(k))
                    : allowedStats);

            picked.forEach((statKey) => {
                this.applyConsumableStatMod(t, statKey, signed, ctx, { durationRounds: 999 });
            });

            const label = (useRandomAda ? ['랜덤(공/방/민)'] : picked)
                .map((k) => (k === 'attack' ? '공격' : (k === 'agility' ? '민첩' : (k === 'defense' ? '방어' : '스킬'))))
                .join('/');

            this.addLog(`  🎯 대상: ${t.name} (${isAlly ? '버프' : '디버프'}: ${label} ${signed >= 0 ? '+' : ''}${signed}, 해당 스탯 1회 사용 후 소멸)`);
        });

        if (attacker && attacker.id) {
            this.usedUltimate[attacker.id] = true;
        }

        // 지원형도 스킬 사용이므로 스킬스탯 소모(1회) + 공통 패널티
        this.consumeStatMods(attacker, 'ON_SKILL');
        this.applyUnifiedSkillPenalty(attacker);
    }

    /**
     * 턴 정보 업데이트
     */
    updateTurnInfo() {
        const turnCountEl = document.getElementById('turn-count');
        const turnTextEl = document.getElementById('current-turn-text');
        const orderHintEl = document.getElementById('turn-order-hint');
        
        if (turnCountEl) turnCountEl.textContent = this.currentTurn;

        const entry = this.getCurrentTurnEntry();
        const teamIcons = { hero: '🦸', gov: '🏛️', villain: '😈' };
        const teamLabel = entry ? (this.teamLabelKo(entry.teamKey) || entry.teamKey) : '-';
        const icon = entry ? (teamIcons[entry.teamKey] || '👤') : '👤';
        const name = entry?.char?.name || '-';
        const agi = entry ? entry.agility : '-';
        const pos = entry ? (this.turnIndex + 1) : '-';
        const total = Array.isArray(this.turnOrder) ? this.turnOrder.length : 0;

        if (turnTextEl) {
            turnTextEl.textContent = `현재 차례: ${icon} ${teamLabel} ${name} (민첩 ${agi}) · ${pos}/${total}`;
        }

        if (orderHintEl) {
            if (!this.turnOrder || this.turnOrder.length === 0) {
                orderHintEl.textContent = '';
            } else {
                const items = this.turnOrder.map((e, i) => {
                    const cur = (i === this.turnIndex);
                    const tIcon = teamIcons[e.teamKey] || '👤';
                    const label = this.escapeHtml(this.teamLabelKo(e.teamKey) || e.teamKey);
                    const nm = this.escapeHtml(e.char?.name || '-');
                    return `<span class="turn-order-item${cur ? ' is-current' : ''}"><span class="turn-order-idx">${i + 1}</span> ${tIcon} ${label} ${nm} <span class="turn-order-agi">💨${e.agility}</span></span>`;
                }).join('');
                orderHintEl.innerHTML = `<span class="turn-order-title">턴 순서(민첩):</span> ${items}`;
            }
        }
    }

    /**
     * 우측 패널 슬롯 자동 채움
     * 참여한 모든 캐릭터 기준으로 스킬 상세 표시
     */
    updateSkillSlots() {
        const panel = document.getElementById('skill-status');
        if (!panel) return;
        const teamOrder = ['hero', 'gov', 'villain'];
        const teamIcons = { hero: '🦸', gov: '🏛️', villain: '😈' };
        const teamLabels = { hero: '히어로', gov: '정부', villain: '빌런' };

        const participants = teamOrder.flatMap((teamKey) => {
            const list = Array.isArray(this.combatCharacters?.[teamKey]) ? this.combatCharacters[teamKey] : [];
            return list.map((char) => ({ teamKey, char }));
        });

        if (participants.length === 0) {
            panel.innerHTML = `
                <div class="skill-block">
                    <div class="skill-block-body placeholder">(참여 캐릭터 없음)</div>
                </div>
            `;
            return;
        }

        const getUseState = (char) => {
            const actions = this.app?.battleActions;
            if (actions?.getSkillUseState) return actions.getSkillUseState(char);
            const max = Math.max(0, Math.min(99, Math.floor(Number(char?.skillUsesMax ?? 1) || 0)));
            const used = Math.max(0, Math.floor(Number(char?.skillUsesUsed) || 0));
            const locked = !!char?.skillUsesLocked;
            const exhausted = max === 0 ? true : (used >= max);
            const canUse = !(locked || exhausted);
            const remaining = max === 0 ? 0 : Math.max(0, max - used);
            return { max, used, remaining, locked, exhausted, canUse };
        };

        panel.innerHTML = participants
            .map(({ teamKey, char }) => {
                const name = this.escapeHtml(char?.name || '(이름 없음)');
                const icon = teamIcons[teamKey] || '👤';
                const team = teamLabels[teamKey] || teamKey;

                const types = Array.isArray(char?.skillTypes) ? char.skillTypes : [];
                const typesText = types.length > 0 ? this.escapeHtml(types.join(', ')) : '-';

                const desc = this.escapeHtml(char?.skillDescription || '-');
                const skillStat = Number.isFinite(Number(char?.skill)) ? String(Math.round(Number(char.skill))) : '-';

                const mode = char?.skillTarget?.mode === 'multi' ? '다수' : '단일';
                const includeSelf = !!char?.skillTarget?.includeSelf;
                const targetText = (mode === '다수')
                    ? (includeSelf ? '다수(자기 포함)' : '다수(자기 제외)')
                    : '단일';

                const maxHp = Number.isFinite(Number(char?.maxHp)) ? Math.max(1, Math.round(Number(char.maxHp))) : 100;
                const baseHp = this.getBaseHp(char);
                const shieldHp = this.getShieldHp(char);
                const hpText = shieldHp > 0
                    ? `HP ${baseHp}/${maxHp} · 🛡️+${shieldHp}`
                    : `HP ${baseHp}/${maxHp}`;

                const useState = getUseState(char);
                const lockedNow = !!(useState.locked || useState.exhausted);
                const useText = (useState.max === 0)
                    ? '사용 불가'
                    : `${useState.remaining}/${useState.max} (사용 ${useState.used})`;

                const usedUltimate = !!this.usedUltimate?.[char?.id];
                const ultimateText = usedUltimate ? '사용함' : '미사용';

                return `
                    <div class="skill-block">
                        <div class="skill-block-title">${icon} ${name} <span style="color:#718096; font-weight:700;">· ${this.escapeHtml(team)}</span></div>
                        <div class="skill-block-body">
                            <div class="skill-detail-line">
                                <span class="skill-detail-label">스킬</span>
                                <span class="skill-detail-value">⭐ ${this.escapeHtml(skillStat)} · ${typesText}</span>
                            </div>
                            <div class="skill-detail-line">
                                <span class="skill-detail-label">대상</span>
                                <span class="skill-detail-value">${this.escapeHtml(targetText)}</span>
                            </div>
                            <div class="skill-detail-line">
                                <span class="skill-detail-label">횟수</span>
                                <span class="skill-detail-value skill-uses ${lockedNow ? 'is-locked' : ''}">${this.escapeHtml(useText)}${lockedNow ? ' 🔒' : ''}</span>
                            </div>
                            <div class="skill-detail-line">
                                <span class="skill-detail-label">궁극기</span>
                                <span class="skill-detail-value">${this.escapeHtml(ultimateText)}</span>
                            </div>
                            <div class="skill-detail-line">
                                <span class="skill-detail-label">HP</span>
                                <span class="skill-detail-value">${this.escapeHtml(hpText)}</span>
                            </div>
                            <div style="color:#4a5568; font-weight:700; line-height:1.5;">${desc}</div>
                        </div>
                    </div>
                `;
            })
            .join('');
    }

    /**
     * 로그 추가
     */
    addLog(message) {
        const timestamp = new Date().toLocaleTimeString('ko-KR');
        this.battleLog.push(`[${timestamp}] ${message}`);
        this._logBlocksCache = null;
    }

    addLogRaw(message) {
        this.battleLog.push(String(message ?? ''));
        this._logBlocksCache = null;
    }

    addLogBlock(lines = [], { timestampOnFirst = true } = {}) {
        const list = Array.isArray(lines) ? lines.map((v) => String(v ?? '')).filter((s) => s.trim().length > 0) : [];
        if (list.length === 0) return;
        if (timestampOnFirst) this.addLog(list[0]);
        else this.addLogRaw(list[0]);
        for (let i = 1; i < list.length; i++) {
            this.addLogRaw(list[i]);
        }
    }

    getLogBlocks({ maxLines = 200 } = {}) {
        const totalLen = Array.isArray(this.battleLog) ? this.battleLog.length : 0;
        const startIndex = Math.max(0, totalLen - maxLines);

        const cache = this._logBlocksCache;
        if (
            cache &&
            cache.totalLen === totalLen &&
            cache.startIndex === startIndex &&
            cache.maxLines === maxLines &&
            Array.isArray(cache.blocks)
        ) {
            return { startIndex, blocks: cache.blocks };
        }

        const entries = this.battleLog.slice(startIndex);
        const parsedEntries = entries.map((raw) => this.parseLogLine(raw));
        const blocks = this.groupLogEntries(parsedEntries, startIndex);

        this._logBlocksCache = { totalLen, startIndex, maxLines, blocks };
        return { startIndex, blocks };
    }

    formatGradeOrFail(grade) {
        if (!grade) return '실패';
        const g = String(grade);
        return g === 'FAIL' ? '실패' : this.gradeLabelKo(g);
    }

    formatSuccessWord(grade) {
        const g = String(grade || 'FAIL');
        return g === 'FAIL' ? '실패' : '성공';
    }

    formatRollLine({ roll, threshold, statLabel, grade }) {
        const r = Number.isFinite(Number(roll)) ? Math.round(Number(roll)) : 0;
        const t = Number.isFinite(Number(threshold)) ? Math.round(Number(threshold)) : 0;
        const label = String(statLabel || '판정');
        const ok = this.formatSuccessWord(grade);
        const lvl = this.formatGradeOrFail(grade);
        return `🎲 1d100 ${r} / ${t} | ${label} ${ok} | ${lvl}`;
    }

    // ===== 밸런스(프론트 폴백용, 정수) =====
    rollInt(min, max) {
        const lo = Math.ceil(Number(min));
        const hi = Math.floor(Number(max));
        if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return 0;
        return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    }

    // 방어 스탯(1~5) -> 방어력%(완만 버전)
    getDefenseReductionPercent(defStat) {
        const stat = Math.max(1, Math.min(5, Math.round(Number(defStat) || 1)));
        const table = [0, 0, 5, 11, 15, 20];
        return table[stat] ?? 0;
    }

    applyDefenseReduction(rawDamage, defensePercent) {
        const base = Math.max(0, Math.floor(Number(rawDamage) || 0));
        if (base === 0) return 0;
        const pct = Math.max(0, Math.min(80, Math.round(Number(defensePercent) || 0)));
        const reduced = Math.floor((base * (100 - pct)) / 100);
        return Math.max(1, reduced);
    }

    rollAttackSkillRawDamage(skillStat) {
        const stat = Math.max(1, Math.min(5, Math.round(Number(skillStat) || 1)));
        const table = {
            1: { min: 10, extraMax: 3 },
            2: { min: 13, extraMax: 3 },
            3: { min: 15, extraMax: 4 },
            4: { min: 18, extraMax: 4 },
            5: { min: 20, extraMax: 5 }
        };
        const profile = table[stat] || table[1];
        const bonus = this.rollInt(1, profile.extraMax);
        const raw = Math.floor(profile.min + bonus);
        return {
            stat,
            min: profile.min,
            extraMax: profile.extraMax,
            bonus,
            raw,
            max: profile.min + profile.extraMax
        };
    }

    /**
     * 로그 렌더링
     */
    renderLog() {
        const logEl = document.getElementById('combat-log');
        if (logEl) {
            this.initLogUi();

            const { blocks } = this.getLogBlocks({ maxLines: 200 });

            logEl.innerHTML = blocks
                .map((block) => {
                    if (block.type === 'separator') {
                        return `<div class="log-separator">${this.escapeHtml(block.text)}</div>`;
                    }

                    const collapsed = this.collapsedLogGroups.has(block.id);
                    const ariaExpanded = collapsed ? 'false' : 'true';
                    const headerTitle = this.escapeHtml(block.title);
                    const headerMeta = block.meta
                        ? `<span class="log-group__meta">${this.escapeHtml(block.meta)}</span>`
                        : '';
                    const preview = block.preview
                        ? `<div class="log-group__preview">${this.escapeHtml(block.preview)}</div>`
                        : '';

                    const bodyHtml = block.lines
                        .map((line) => {
                            const timeHtml = line.time ? `<span class="log-time">${this.escapeHtml(line.time)}</span>` : '';
                            return `
                                <div class="log-entry log-entry--${line.kind}">
                                    ${timeHtml}
                                    <span class="log-message">${this.escapeHtml(line.text)}</span>
                                </div>
                            `;
                        })
                        .join('');

                    return `
                        <div class="log-group log-group--${block.status}${collapsed ? ' is-collapsed' : ''}" data-log-group-id="${this.escapeHtml(block.id)}">
                            <button type="button" class="log-group__header" aria-expanded="${ariaExpanded}">
                                <div class="log-group__title-row">
                                    <span class="log-group__chevron">▾</span>
                                    <span class="log-group__title">${headerTitle}</span>
                                    ${headerMeta}
                                </div>
                                ${preview}
                            </button>
                            <div class="log-group__body">
                                ${bodyHtml}
                            </div>
                        </div>
                    `;
                })
                .join('');

            if (this.logAutoScroll) {
                logEl.scrollTop = logEl.scrollHeight; // 자동 스크롤
            }
        }
    }

    initLogUi() {
        if (this.logUiInitialized) return;

        const toolbar = document.getElementById('combat-log-toolbar');
        const autoScroll = document.getElementById('combat-log-autoscroll');

        if (!toolbar || !autoScroll) {
            return;
        }

        // 자동 스크롤 토글
        autoScroll.addEventListener('change', () => {
            this.logAutoScroll = !!autoScroll.checked;
            this.renderLog();
        });

        // 전체 접기/펼치기 버튼 추가
        const tools = toolbar.querySelector('.log-tools');
        if (tools) {
            const collapseAllBtn = document.createElement('button');
            collapseAllBtn.type = 'button';
            collapseAllBtn.className = 'log-tool-btn';
            collapseAllBtn.textContent = '전체 접기';

            const expandAllBtn = document.createElement('button');
            expandAllBtn.type = 'button';
            expandAllBtn.className = 'log-tool-btn';
            expandAllBtn.textContent = '전체 펼치기';

            collapseAllBtn.addEventListener('click', () => {
                // 현재 화면의 그룹을 전부 접기
                const groups = this.getCurrentLogGroupIds();
                groups.forEach((id) => this.collapsedLogGroups.add(id));
                this.renderLog();
            });

            expandAllBtn.addEventListener('click', () => {
                const groups = this.getCurrentLogGroupIds();
                groups.forEach((id) => this.collapsedLogGroups.delete(id));
                this.renderLog();
            });

            tools.appendChild(collapseAllBtn);
            tools.appendChild(expandAllBtn);
        }

        // 그룹 헤더 클릭 토글(이벤트 위임)
        const logEl = document.getElementById('combat-log');
        if (logEl) {
            logEl.addEventListener('click', (e) => {
                const header = e.target?.closest?.('.log-group__header');
                if (!header) return;
                const groupEl = header.closest('.log-group');
                const id = groupEl?.getAttribute?.('data-log-group-id');
                if (!id) return;

                if (this.collapsedLogGroups.has(id)) {
                    this.collapsedLogGroups.delete(id);
                } else {
                    this.collapsedLogGroups.add(id);
                }
                this.renderLog();
            });
        }

        this.logUiInitialized = true;
    }

    getCurrentLogGroupIds() {
        const { blocks } = this.getLogBlocks({ maxLines: 200 });
        return blocks.filter((b) => b.type === 'group').map((b) => b.id);
    }

    isActionStartLogLine(text) {
        const t = String(text || '').trim();
        // 행동 시작을 나타내는 대표 라인들
        return t.startsWith('⚔️') || t.startsWith('⭐') || t.includes('전투 시작') || t.includes('턴 종료');
    }

    summarizeGroup(lines) {
        const first = lines[0];
        const rawFirst = first ? String(first.text || '').replace(/^\n+/, '').trim() : '';

        // 블럭 헤더를 더 고정 포맷으로: "{공격자} | {성공수준}" 라인이 있으면 제목으로 우선 사용
        // (예: "철수 | 성공", "철수 | 대성공" 등)
        const headerCandidate = (Array.isArray(lines) ? lines : [])
            .map((l) => String(l?.text || '').replace(/^\n+/, '').trim())
            .find((t) => {
                if (!t.includes(' | ')) return false;
                if (t.startsWith('🎲')) return false;
                if (t.includes('회피') || t.includes('반격') || t.includes('PASS')) return false;
                return /\|\s*(대성공|극단적 성공|어려운 성공|하드|성공|실패)\s*$/.test(t);
            });

        const title = headerCandidate || (rawFirst || '행동');

        let status = 'neutral';
        let damage = null;
        let hasAwait = false;

        for (const line of lines) {
            const msg = String(line.text || '');
            if (msg.includes('❌') || msg.includes('공격 실패') || msg.includes('회피 실패') || msg.includes('반격 실패') || msg.includes('| 실패')) {
                status = 'fail';
            }
            if (msg.includes('✅ 공격 성공') && msg.includes('반응을 선택')) hasAwait = true;

            const dmgMatch = msg.match(/💥\s*데미지:\s*([0-9]+)/);
            if (dmgMatch) {
                damage = Number(dmgMatch[1]);
            }
        }

        if (hasAwait && status !== 'fail') status = 'pending';
        if (damage !== null && status !== 'fail') status = 'resolved';

        const metaParts = [];
        // 제목이 "공격자 | 성공수준"인 경우, 원래 첫 줄(행동 라인)을 메타로 붙여 맥락 유지
        if (headerCandidate && rawFirst && rawFirst !== headerCandidate) {
            metaParts.push(rawFirst.replace(/^\n+/, '').trim());
        }
        if (damage !== null) metaParts.push(`데미지 ${damage}`);
        metaParts.push(`${lines.length}줄`);

        // collapsed 상태에서 보여줄 1줄 미리보기
        let preview = null;
        const preferred = lines
            .map((l) => String(l.text || '').trim())
            .filter(Boolean)
            .filter((m) => !this.isActionStartLogLine(m));
        const important = preferred.find((m) => m.includes('💥') || m.includes('❌') || m.includes('💚') || m.includes('🛡️'));
        preview = important || preferred[0] || null;

        return {
            title,
            status,
            meta: metaParts.join(' · '),
            preview
        };
    }

    groupLogEntries(parsedEntries, startIndex) {
        const blocks = [];
        let current = null;

        const flush = () => {
            if (!current) return;
            const summary = this.summarizeGroup(current.lines);
            blocks.push({
                type: 'group',
                id: current.id,
                title: summary.title,
                status: summary.status,
                meta: summary.meta,
                preview: summary.preview,
                lines: current.lines
            });
            current = null;
        };

        for (let i = 0; i < parsedEntries.length; i++) {
            const line = parsedEntries[i];
            const text = String(line.text || '').replace(/^\n+/, '').trim();

            if (line.kind === 'separator') {
                flush();
                blocks.push({ type: 'separator', text: '—' });
                continue;
            }

            const starts = this.isActionStartLogLine(text);
            if (!current || starts) {
                flush();
                const id = `g_${startIndex + i}`;
                current = { id, lines: [] };
            }

            current.lines.push({ ...line, text });
        }

        flush();
        return blocks;
    }

    /**
     * 로그 한 줄 파싱: [시간] 메시지 형태를 분리 + 타입 분류
     */
    parseLogLine(raw) {
        const trimmed = String(raw ?? '').replace(/^\n+/, '').trimEnd();
        const match = trimmed.match(/^\[(.*?)\]\s*(.*)$/);
        const time = match ? match[1] : '';
        const text = match ? match[2] : trimmed;
        const message = text.trim();

        if (message === '---' || message === '—' || message === '―') {
            return { time: '', text: '—', kind: 'separator' };
        }

        // 이모지/키워드 기반 간단 분류
        const kind = this.classifyLogMessage(message);
        return { time, text, kind };
    }

    classifyLogMessage(message) {
        if (message.includes('❌') || message.includes('실패') || message.toLowerCase().includes('오류')) return 'error';
        if (message.includes('✅')) return 'success';
        if (message.includes('💥')) return 'damage';
        if (message.includes('💚') || message.includes('HP')) return 'hp';
        if (message.includes('🎲') || message.includes('🎯')) return 'roll';
        if (message.includes('🛡️')) return 'defense';
        if (message.includes('⚔️') || message.includes('⭐')) return 'action';
        return 'info';
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 공격 실행 (백엔드 우선, 실패 시 로컬 폴백)
     */
    async executeAttack(attacker, defender, targetTeam, attackerTeam) {
        try {
            const apiUrl = window.CONFIG?.API_BASE_URL;

            // 이미 방어자 응답 대기 중이면 추가 공격 금지
            if (this.pendingDefenseResponse) {
                this.addLog('ℹ️ 방어자 응답을 먼저 선택해주세요.');
                return { awaitingResponse: true };
            }

            if (apiUrl) {
                try {
                    // 공격 시도 자체가 공격/스킬 스탯을 "사용"하는 행위이므로(명중/실패 무관) 1회 소모
                    this.consumeStatMods(attacker, 'ON_ATTACK');
                    this.consumeStatMods(attacker, 'ON_SKILL');

                    // 2-step begin: 공격 판정만 수행
                    const response = await fetch(`${apiUrl}/battles/simulate-begin`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            attacker: {
                                name: attacker.name,
                                attack: this.getEffectiveStat(attacker, 'attack'),
                                defense: this.getEffectiveStat(attacker, 'defense'),
                                agility: this.getEffectiveStat(attacker, 'agility'),
                                skill: this.getEffectiveStat(attacker, 'skill')
                            },
                            defender: {
                                name: defender.name,
                                hp: this.getTotalHp(defender),
                                maxHp: defender.maxHp,
                                attack: this.getEffectiveStat(defender, 'attack'),
                                defense: this.getEffectiveStat(defender, 'defense'),
                                agility: this.getEffectiveStat(defender, 'agility'),
                                skill: this.getEffectiveStat(defender, 'skill')
                            }
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();

                        const attackJudgment = result?.attackJudgment;
                        if (attackJudgment && Number.isFinite(Number(attackJudgment.roll)) && Number.isFinite(Number(attackJudgment.threshold))) {
                            const grade = attackJudgment.grade;
                            const block = [
                                `\n⚔️ ${attacker.name} → ${defender.name} 일반 공격`,
                                `${attacker.name} | ${this.formatGradeOrFail(grade)}`,
                                this.formatRollLine({ roll: attackJudgment.roll, threshold: attackJudgment.threshold, statLabel: '공격', grade })
                            ];
                            if (Number(attackJudgment.roll) === 1) {
                                block.push('🌟 대성공! (주사위 1)');
                            }
                            if (String(grade) === 'FAIL') {
                                block.push('결과 | 공격 실패');
                            } else {
                                block.push(`${defender.name} | 반응 선택 대기 (회피 / 반격 / PASS)`);
                            }
                            this.addLogBlock(block);
                        } else if (Array.isArray(result.log)) {
                            // 구버전/외부 API 대응: 서버가 문자열 로그만 주는 경우 기존 방식 유지
                            result.log.forEach((logEntry) => this.addLog(logEntry));
                        }

                        // 공격 실패 등으로 즉시 종료되는 케이스
                        if (result.phase === 'RESOLVED') {
                            if (typeof result.defenderHp === 'number') {
                                this.setHpFromTotal(defender, result.defenderHp);
                            }
                            return { awaitingResponse: false };
                        }

                        // 공격 성공: 방어자 응답 대기
                        if (result.phase === 'AWAITING_DEFENDER_RESPONSE' && result.pendingId) {
                            const expiresInMs = Number.isFinite(Number(result.expiresInMs))
                                ? Math.max(1, Math.round(Number(result.expiresInMs)))
                                : 30 * 60 * 1000;

                            const attackGrade = result?.attackJudgment?.grade;

                            this.pendingDefenseResponse = {
                                pendingId: result.pendingId,
                                attackerRef: attacker,
                                defenderRef: defender,
                                targetTeam,
                                attackerTeam,
                                expiresAt: Date.now() + expiresInMs,
                                attackGrade,
                                attackJudgment: result?.attackJudgment || null,
                                pendingState: result.pendingState
                            };

                            this.showDefenseResponsePanel(attacker.name, defender.name);
                            return { awaitingResponse: true };
                        }

                        if (typeof result.defenderHp === 'number') {
                            this.setHpFromTotal(defender, result.defenderHp);
                        }
                        return { awaitingResponse: false };
                    }
                } catch (error) {
                    // 네트워크/CORS/라우팅 문제 등: 로컬 폴백으로 진행
                    console.warn('전투 API 호출 실패 → 로컬 폴백 사용:', error);
                }
            }

            // ===== 폴백(로컬 계산) =====
            this.addLogBlock([
                `\n⚔️ ${attacker.name} → ${defender.name} 일반 공격`,
                `${attacker.name} | 판정 시도(로컬)`
            ]);

            const attackRoll = Math.floor(Math.random() * 100) + 1;
            const attackPower = (attacker.attack ?? attacker.atk ?? 1) * 10 + (attacker.skill ?? attacker.skillStat ?? 1) * 5;
            this.addLogRaw(`🎲 1d100 ${attackRoll} / ${attackPower} | 공격 ${attackRoll > attackPower ? '실패' : '성공'} | ${attackRoll > attackPower ? '실패' : '성공'}`);

            // 공격 판정(공격/스킬 스탯)을 사용했으므로 1회 소모
            this.consumeStatMods(attacker, 'ON_ATTACK');
            this.consumeStatMods(attacker, 'ON_SKILL');

            const isGreatSuccess = attackRoll === 1;
            if (isGreatSuccess) {
                this.addLogRaw('🌟 대성공! (주사위 1)');
            }

            if (attackRoll > attackPower) {
                this.addLogRaw('결과 | 공격 실패');
                return { awaitingResponse: false };
            }

            const atkStat = Math.max(1, Math.min(5, Math.round(Number(attacker.attack ?? attacker.atk ?? 1))));
            const defStat = Math.max(1, Math.min(5, Math.round(Number(defender.defense ?? defender.def ?? 1))));

            // 기본공격 rawDamage(요청 반영):
            // - atk 1~2 = 3~13
            // - atk 3~4 = 4~13
            // - atk 5   = 5~13
            const minRaw = atkStat >= 5 ? 5 : (atkStat >= 3 ? 4 : 3);
            const rawDamage = this.rollInt(minRaw, 13);
            const defensePercent = this.getDefenseReductionPercent(defStat);
            const finalDamage = this.applyDefenseReduction(rawDamage, defensePercent);

            const beforeTotal = this.getTotalHp(defender);
            const beforeShield = this.getShieldHp(defender);
            const applied = this.applyDamageWithShield(defender, finalDamage);
            const afterTotal = this.getTotalHp(defender);

            // 피격(방어 스탯)을 사용했으므로 1회 소모
            this.consumeStatMods(defender, 'ON_DEFEND');

            this.addLogRaw(`🧮 스탯: 공격 ATK ${atkStat} / 방어 DEF ${defStat}`);
            this.addLogRaw(`🛡️ 방어력: ${defensePercent}% (원데미지 ${rawDamage} → 실제 ${finalDamage})`);
            this.addLogRaw(`💥 데미지: ${finalDamage}`);
            if (beforeShield > 0 || applied.shieldAbsorbed > 0) {
                this.addLogRaw(`🧱 쉴드: ${beforeShield} → ${this.getShieldHp(defender)} (흡수 ${applied.shieldAbsorbed})`);
            }
            this.addLogRaw(`💚 ${defender.name} HP: ${Math.min(this.getMaxHp(defender), beforeTotal)}/${this.getMaxHp(defender)} → ${Math.min(this.getMaxHp(defender), afterTotal)}/${this.getMaxHp(defender)}`);
            return { awaitingResponse: false };
        } catch (error) {
            console.error('전투 계산 에러:', error);
            this.addLog(`❌ 전투 계산 중 오류: ${error.message}`);
            return { awaitingResponse: false, error };
        }
    }

    /**
     * 방어 실행
     */
    executeDefend(defender) {
        this.addLog(`🛡️ ${defender.name}이(가) 방어 태세를 취했습니다!`);
    }

    /**
     * 궁극기 실행
     */
    executeUltimate(attacker, defender, targetTeam) {
        this.addLog(`\n⭐ ${attacker.name} → ${defender.name} 궁극기 시전!`);

        const isAttackSkill = Array.isArray(attacker.skillTypes)
            ? attacker.skillTypes.includes('공격형')
            : true;

        if (!isAttackSkill) {
            this.addLog('  ℹ️ 공격형 스킬이 아니라 데미지를 주지 않습니다.');
            return;
        }

        // 공격형 스킬을 맞을 때: 방어형에게 DEFENSE_SKILL(쉴드) 반응 찬스 제공
        if (!this.pendingDefenseResponse && this.canUseDefenseSkillAsReaction(defender)) {
            this.pendingDefenseResponse = {
                mode: 'LOCAL_SKILL_REACTION',
                attackerRef: attacker,
                defenderRef: defender,
                targetTeam,
                allowedResponses: ['DEFENSE_SKILL', 'PASS'],
                onResolve: (choice) => {
                    if (choice === 'DEFENSE_SKILL') {
                        this.applyDefenseSkillReactionSingle(defender);
                    }

                    // 이후 궁극기 피해를 그대로 처리(명중은 확정)
                    this.addLog('  💫 궁극기는 100% 명중합니다!');

                    const skillStat2 = this.getEffectiveStat(attacker, 'skill');
                    const rolled2 = this.rollAttackSkillRawDamage(skillStat2);

                    const defStat2 = this.getEffectiveStat(defender, 'defense');
                    const defensePercent2 = this.getDefenseReductionPercent(defStat2);
                    const damage2 = this.applyDefenseReduction(rolled2.raw, defensePercent2);

                    this.addLog(`  🎲 스킬 데미지: ${rolled2.min} + (1~${rolled2.extraMax})[${rolled2.bonus}] = ${rolled2.raw} (최대 ${rolled2.max})`);
                    this.addLog(`  🛡️ 방어력: ${defensePercent2}% (원데미지 ${rolled2.raw} → 실제 ${damage2})`);
                    this.addLog(`  💥 데미지: ${damage2}`);

                    const beforeTotal2 = this.getTotalHp(defender);
                    const beforeShield2 = this.getShieldHp(defender);
                    const applied2 = this.applyDamageWithShield(defender, damage2);
                    const afterTotal2 = this.getTotalHp(defender);

                    this.consumeStatMods(defender, 'ON_DEFEND');
                    if (beforeShield2 > 0 || applied2.shieldAbsorbed > 0) {
                        this.addLog(`  🧱 쉴드: ${beforeShield2} → ${this.getShieldHp(defender)} (흡수 ${applied2.shieldAbsorbed})`);
                    }
                    this.addLog(`  💔 ${defender.name} HP: ${Math.min(this.getMaxHp(defender), beforeTotal2)}/${this.getMaxHp(defender)} → ${Math.min(this.getMaxHp(defender), afterTotal2)}/${this.getMaxHp(defender)}`);

                    if (attacker && attacker.id) {
                        this.usedUltimate[attacker.id] = true;
                    }

                    this.consumeStatMods(attacker, 'ON_SKILL');
                    this.applyUnifiedSkillPenalty(attacker);

                    if (defender.hp <= 0) {
                        this.addLog(`  💀 ${defender.name}이(가) 쓰러졌습니다!`);
                    }
                }
            };

            this.showDefenseResponsePanel(attacker.name, defender.name);
            return { awaitingResponse: true };
        }

        this.addLog('  💫 궁극기는 100% 명중합니다!');

        // 공격형 스킬 데미지(이미지 테이블): 최소 + 추가(1~N)
        const skillStat = this.getEffectiveStat(attacker, 'skill');
        const rolled = this.rollAttackSkillRawDamage(skillStat);

        const defStat = this.getEffectiveStat(defender, 'defense');
        const defensePercent = this.getDefenseReductionPercent(defStat);
        const damage = this.applyDefenseReduction(rolled.raw, defensePercent);

        this.addLog(`  🎲 스킬 데미지: ${rolled.min} + (1~${rolled.extraMax})[${rolled.bonus}] = ${rolled.raw} (최대 ${rolled.max})`);
        this.addLog(`  🛡️ 방어력: ${defensePercent}% (원데미지 ${rolled.raw} → 실제 ${damage})`);
        this.addLog(`  💥 데미지: ${damage}`);
        
        // 3. 데미지 적용(쉴드 우선 소모)
        const beforeTotal = this.getTotalHp(defender);
        const beforeShield = this.getShieldHp(defender);
        const applied = this.applyDamageWithShield(defender, damage);
        const afterTotal = this.getTotalHp(defender);

        // 피격(방어 스탯) 사용 후 1회 소모
        this.consumeStatMods(defender, 'ON_DEFEND');
        if (beforeShield > 0 || applied.shieldAbsorbed > 0) {
            this.addLog(`  🧱 쉴드: ${beforeShield} → ${this.getShieldHp(defender)} (흡수 ${applied.shieldAbsorbed})`);
        }
        this.addLog(`  💔 ${defender.name} HP: ${Math.min(this.getMaxHp(defender), beforeTotal)}/${this.getMaxHp(defender)} → ${Math.min(this.getMaxHp(defender), afterTotal)}/${this.getMaxHp(defender)}`);
        
        if (attacker && attacker.id) {
            this.usedUltimate[attacker.id] = true;
        }

        // 궁극기는 스킬 스탯을 사용하므로 1회 소모
        this.consumeStatMods(attacker, 'ON_SKILL');

        this.applyUnifiedSkillPenalty(attacker);
        
        if (defender.hp <= 0) {
            this.addLog(`  💀 ${defender.name}이(가) 쓰러졌습니다!`);
        }
    }

    /**
     * 궁극기(공격형) 다수 대상 실행
     * - 단일 데미지 E를 굴린 뒤, 대상 수 n으로 1/n 분배(내림)하여 각 대상에게 적용
     */
    executeUltimateMulti(attacker, defenders) {
        const targets = Array.isArray(defenders) ? defenders.filter(Boolean) : [];
        const n = targets.length;
        if (n === 0) {
            this.addLog('❌ 궁극기(다수): 대상이 없습니다.');
            return;
        }

        this.addLog(`\n⭐ ${attacker.name} 궁극기(다수) 시전! (대상 ${n}명)`);

        const isAttackSkill = Array.isArray(attacker.skillTypes)
            ? attacker.skillTypes.includes('공격형')
            : true;

        if (!isAttackSkill) {
            this.addLog('  ℹ️ 공격형 스킬이 아니라 데미지를 주지 않습니다.');
            return;
        }

        this.addLog('  💫 궁극기는 100% 명중합니다!');

        const skillStat = this.getEffectiveStat(attacker, 'skill');
        const rolled = this.rollAttackSkillRawDamage(skillStat);

        const perTargetRaw = Math.floor((Number(rolled.raw) || 0) / n);
        this.addLog(`  🎲 스킬 데미지: ${rolled.min} + (1~${rolled.extraMax})[${rolled.bonus}] = ${rolled.raw} (최대 ${rolled.max})`);
        this.addLog(`  👥 다수 분배: floor(${rolled.raw} / ${n}) = ${perTargetRaw} (각 대상 원데미지)`);

        targets.forEach((defender) => {
            const defStat = this.getEffectiveStat(defender, 'defense');
            const defensePercent = this.getDefenseReductionPercent(defStat);
            const damage = this.applyDefenseReduction(perTargetRaw, defensePercent);

            if (perTargetRaw <= 0) {
                this.addLog(`  ⚠️ ${defender.name}: 분배 원데미지가 0이라 피해가 없습니다.`);
                return;
            }

            this.addLog(`  🎯 대상: ${defender.name}`);
            this.addLog(`    🛡️ 방어력: ${defensePercent}% (원데미지 ${perTargetRaw} → 실제 ${damage})`);

            const beforeTotal = this.getTotalHp(defender);
            const beforeShield = this.getShieldHp(defender);
            const applied = this.applyDamageWithShield(defender, damage);
            const afterTotal = this.getTotalHp(defender);

            // 피격(방어 스탯) 사용 후 1회 소모
            this.consumeStatMods(defender, 'ON_DEFEND');

            this.addLog(`    💥 데미지: ${damage}`);
            if (beforeShield > 0 || applied.shieldAbsorbed > 0) {
                this.addLog(`    🧱 쉴드: ${beforeShield} → ${this.getShieldHp(defender)} (흡수 ${applied.shieldAbsorbed})`);
            }
            this.addLog(`    💔 ${defender.name} HP: ${Math.min(this.getMaxHp(defender), beforeTotal)}/${this.getMaxHp(defender)} → ${Math.min(this.getMaxHp(defender), afterTotal)}/${this.getMaxHp(defender)}`);

            if (defender.hp <= 0) {
                this.addLog(`    💀 ${defender.name}이(가) 쓰러졌습니다!`);
            }
        });

        if (attacker && attacker.id) {
            this.usedUltimate[attacker.id] = true;
        }

        // 궁극기(다수)도 스킬 스탯을 사용하므로 1회 소모
        this.consumeStatMods(attacker, 'ON_SKILL');

        this.applyUnifiedSkillPenalty(attacker);
    }

    /**
     * 방어형 스킬(쉴드) 적용
     * - 단일 기준 쉴드량 S를 만든 뒤, 대상 수 n으로 1/n 분배(내림)하여 각 대상에게 쉴드 부여
     * - 쉴드는 HP 위에 얹히는 추가 HP(= maxHp를 초과하는 부분)로 취급하며, 피해를 먼저 흡수함
     */
    executeDefenseSkillMulti(attacker, targets) {
        const list = Array.isArray(targets) ? targets.filter(Boolean) : [];
        const n = list.length;
        if (n === 0) {
            this.addLog('❌ 방어형 스킬: 대상이 없습니다.');
            return;
        }

        this.addLog(`\n🛡️ ${attacker.name} 방어형 스킬(쉴드) 사용! (대상 ${n}명)`);

        const skillStat = this.getEffectiveStat(attacker, 'skill');
        const rolled = this.rollShieldSkillAmountByStat(skillStat);
        const shieldBase = rolled.raw;
        const perTarget = Math.floor(shieldBase / n);

        this.addLog(`  🎲 쉴드량: ${rolled.min} + (1~${rolled.extraMax})[${rolled.bonus}] = ${rolled.raw} (최대 ${rolled.max})`);
        this.addLog(`  👥 다수 분배: floor(${shieldBase} / ${n}) = ${perTarget} (각 대상)`);

        list.forEach((t) => {
            const beforeShield = this.getShieldHp(t);
            const added = this.addShieldHp(t, perTarget);
            this.addLog(`  🎯 대상: ${t.name} (쉴드 +${added}, ${beforeShield} → ${this.getShieldHp(t)})`);
        });

        if (attacker && attacker.id) {
            this.usedUltimate[attacker.id] = true;
        }

        // 방어형 스킬도 스킬 스탯을 사용하므로 1회 소모
        this.consumeStatMods(attacker, 'ON_SKILL');

        this.applyUnifiedSkillPenalty(attacker);
    }

    /**
     * 치료형 스킬 적용
     * - 단일 기준 회복량 H를 만든 뒤, 대상 수 n으로 1/n 분배(내림)하여 각 대상의 "기본 HP"만 회복
     * - 기본 HP는 maxHp를 넘지 않음(쉴드에는 영향을 주지 않음)
     */
    executeHealSkillMulti(attacker, targets) {
        const list = Array.isArray(targets) ? targets.filter(Boolean) : [];
        const n = list.length;
        if (n === 0) {
            this.addLog('❌ 치료형 스킬: 대상이 없습니다.');
            return;
        }

        this.addLog(`\n💚 ${attacker.name} 치료형 스킬 사용! (대상 ${n}명)`);

        const skillStat = this.getEffectiveStat(attacker, 'skill');
        const rolled = this.rollHealSkillAmountByStat(skillStat);
        const healBase = rolled.raw;
        const perTarget = Math.floor(healBase / n);

        this.addLog(`  🎲 회복량: ${rolled.min} + (1~${rolled.extraMax})[${rolled.bonus}] = ${rolled.raw} (최대 ${rolled.max})`);
        this.addLog(`  👥 다수 분배: floor(${healBase} / ${n}) = ${perTarget} (각 대상)`);

        list.forEach((t) => {
            const beforeBase = this.getBaseHp(t);
            const healed = this.applyHealToBaseHp(t, perTarget);
            const afterBase = this.getBaseHp(t);
            this.addLog(`  🎯 대상: ${t.name} (회복 +${healed}, HP ${beforeBase} → ${afterBase})`);
        });

        if (attacker && attacker.id) {
            this.usedUltimate[attacker.id] = true;
        }

        // 치료형 스킬도 스킬 스탯을 사용하므로 1회 소모
        this.consumeStatMods(attacker, 'ON_SKILL');

        this.applyUnifiedSkillPenalty(attacker);
    }

    /**
     * 턴 진행
     */
    nextTurn() {
        // 현재 턴 순서가 없으면(예: 모두 사망) 바로 종료 체크
        if (!this.turnOrder || this.turnOrder.length === 0) {
            this.checkBattleEnd();
            this.renderBattle();
            this.updateSkillSlots();
            return;
        }

        this.turnIndex += 1;

        // 한 라운드(턴 오더 1회 순회) 종료 시: 턴만 증가 (전투 시작 시 정한 순서는 유지)
        if (this.turnIndex >= this.turnOrder.length) {
            this.turnIndex = 0;
            this.currentTurn++;
            this.tickStatusEffectsOnRoundAdvance();
            this.addLog(`\n========== 턴 ${this.currentTurn} ==========`);
        }

        // 현재팀(기존 UI 호환)도 현재 액터의 팀으로 동기화
        let entry = this.getCurrentTurnEntry();
        if (entry) {
            const idx = ['hero', 'gov', 'villain'].indexOf(entry.teamKey);
            this.currentTeamTurn = idx >= 0 ? idx : 0;
        }

        // 턴 스킵 효과(지원형) 처리: 재귀 없이 반복 + 안전 가드
        const skippedNames = [];
        let skipGuard = 0;
        while (entry && this.consumeSkipTurnIfAny(entry.char)) {
            const nm = entry.char?.name || '대상';
            skippedNames.push(nm);
            this.addLog(`⏭️ ${nm}의 턴이 스킵되었습니다.`);

            this.turnIndex += 1;
            if (this.turnIndex >= this.turnOrder.length) {
                this.turnIndex = 0;
                this.currentTurn++;
                this.tickStatusEffectsOnRoundAdvance();
                this.addLog(`\n========== 턴 ${this.currentTurn} ==========`);
            }

            entry = this.getCurrentTurnEntry();
            if (entry) {
                const idx = ['hero', 'gov', 'villain'].indexOf(entry.teamKey);
                this.currentTeamTurn = idx >= 0 ? idx : 0;
            }

            skipGuard += 1;
            if (skipGuard >= Math.max(10, this.turnOrder.length * 2)) {
                this.addLog('⚠️ 연속 턴 스킵이 감지되어 안전 상한으로 중단했습니다.');
                break;
            }
        }

        if (skippedNames.length > 0) {
            this.showSkipTurnModal(skippedNames);
        }

        this.checkBattleEnd();
        this.renderBattle();
        this.updateSkillSlots();
    }

    /**
     * 전투 종료 확인
     */
    checkBattleEnd() {
        const heroAlive = this.combatCharacters.hero.some(c => this.isCombatCapable(c));
        const govAlive = this.combatCharacters.gov.some(c => this.isCombatCapable(c));
        const villainAlive = this.combatCharacters.villain.some(c => this.isCombatCapable(c));

        // 규칙: 히어로+정부 연합 vs 빌런
        const allyAlive = heroAlive || govAlive;
        if ((allyAlive && !villainAlive) || (!allyAlive && villainAlive)) {
            this.endBattle();
            return true;
        }

        return false;
    }

    /**
     * 전투 종료
     */
    endBattle() {
        const heroAlive = this.combatCharacters.hero.some(c => this.isCombatCapable(c));
        const govAlive = this.combatCharacters.gov.some(c => this.isCombatCapable(c));
        const villainAlive = this.combatCharacters.villain.some(c => this.isCombatCapable(c));

        let winner = '미정';
        const allyAlive = heroAlive || govAlive;
        if (allyAlive && !villainAlive) winner = '히어로/정부';
        else if (!allyAlive && villainAlive) winner = '빌런';

        this.addLog(`\n🏆 전투 종료! 승자: ${winner}`);

        // 전투 기록 업데이트(참가자 HP/쉴드/스킬 사용 여부 기록)
        const lastRecord = Array.isArray(this.app?.battleHistory) && this.app.battleHistory.length > 0
            ? this.app.battleHistory[this.app.battleHistory.length - 1]
            : null;

        if (lastRecord) {
            lastRecord.winner = winner;
            lastRecord.turnCount = this.currentTurn;
            lastRecord.endReason = 'BATTLE_END';

            // 스킬 사용 여부
            lastRecord.usedUltimate = { ...(this.usedUltimate || {}) };

            // 전투 참가자 HP(기본/쉴드) 스냅샷
            const finalHp = {};
            const finalShieldHp = {};
            const excluded = {};
            TEAM_KEYS.forEach((teamKey) => {
                const list = Array.isArray(this.combatCharacters?.[teamKey]) ? this.combatCharacters[teamKey] : [];
                list.forEach((c) => {
                    if (!c || !c.id) return;
                    finalHp[c.id] = this.getBaseHp(c);
                    finalShieldHp[c.id] = this.getShieldHp(c);
                    if (c.battleExcluded) excluded[c.id] = true;
                });
            });
            lastRecord.finalHp = finalHp;
            lastRecord.finalShieldHp = finalShieldHp;
            lastRecord.excluded = excluded;
        }

        // 참가자만 Firestore에 별도 저장
        try {
            const used = this.usedUltimate || {};
            const participants = TEAM_KEYS.flatMap((teamKey) => {
                const list = Array.isArray(this.combatCharacters?.[teamKey]) ? this.combatCharacters[teamKey] : [];
                return list
                    .filter((c) => c && c.id)
                    .map((c) => ({
                        id: String(c.id),
                        name: c.name || null,
                        teamKey,
                        hp: this.getBaseHp(c),
                        shieldHp: this.getShieldHp(c),
                        totalHp: this.getTotalHp(c),
                        usedUltimate: !!used[String(c.id)],
                        excluded: !!c.battleExcluded,
                        excludedAtTurn: Number.isFinite(Number(c.battleExcludedAtTurn)) ? Number(c.battleExcludedAtTurn) : null
                    }));
            });

            const battleId = lastRecord?.id || null;
            this.app?.dataManager?.saveBattleParticipantsSnapshotToFirestore?.({
                battleId,
                endReason: 'BATTLE_END',
                winner,
                participants
            }).catch?.((e) => console.error('참가자 스냅샷 저장 실패:', e));
        } catch (e) {
            console.error('참가자 스냅샷 저장 중 오류:', e);
        }

        // 전투 종료 시점에만: 최종 HP/스킬 사용 여부를 원본 teams에 반영 후 저장(원격 동기화 포함)
        try {
            this.commitCombatStateToRoster?.();
            this.app?.saveToLocalStorage?.();

            // 수동 저장 모드라도(전투 종료는 예외) 로그인 상태면 DB(Firestore) 저장을 한 번 시도
            if (this.app?.manualPersistenceMode) {
                const dm = this.app?.dataManager;
                if (dm?.userId && typeof dm.saveToFirestore === 'function' && !this.app?.skipRemoteSave) {
                    dm.saveToFirestore({ force: true }).catch((e) => console.error('전투 종료 원격 저장 실패:', e));
                }
            }
        } catch (e) {
            console.error('전투 종료 저장 실패:', e);
        }

        // UI(전투 로그/턴 순서 등)도 종료 시점에 정리
        this.pendingDefenseResponse = null;
        this.turnOrder = [];
        this.turnIndex = 0;

        this.showBattleEnd(winner);
    }

    /**
     * 전투 종료 화면 표시
     */
    showBattleEnd(winner) {
        const endScreen = document.getElementById('combat-end');
        if (endScreen) {
            document.getElementById('end-title').textContent = `🏆 ${winner} 팀 승리!`;
            document.getElementById('end-message').textContent = `${this.currentTurn}턴 만에 전투가 종료되었습니다.`;
            endScreen.classList.remove('hidden');
        }
    }

}
