/**
 * 전투 시스템 (Battle System)
 * 턴제 전투 로직 관리
 */

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

        // ===== 2-step 방어자 응답 =====
        this.pendingDefenseResponse = null; // { pendingId, attackerRef, defenderRef, targetTeam, attackerTeam, expiresAt }
        this.defenseUiInitialized = false;
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
        
        // 선택된 캐릭터들로 전투 캐릭터 설정
        this.combatCharacters = {
            hero: this.app.teams[0].characters.filter(c => 
                this.app.selectedCharacters.hero.includes(c.id)
            ),
            gov: this.app.teams[1].characters.filter(c => 
                this.app.selectedCharacters.gov.includes(c.id)
            ),
            villain: this.app.teams[2].characters.filter(c => 
                this.app.selectedCharacters.villain.includes(c.id)
            )
        };

        this.addLog(`⚔️ 전투 시작! (${this.app.battleMode === 'team' ? '팀전' : '개인전'} 모드)`);
        this.addLog(`히어로: ${this.combatCharacters.hero.length}명 | 정부: ${this.combatCharacters.gov.length}명 | 빌런: ${this.combatCharacters.villain.length}명`);
        this.addLog('---');

        this.rebuildTurnOrder({ log: true });
    }

    getAliveParticipants() {
        const teamOrder = ['hero', 'gov', 'villain'];
        return teamOrder.flatMap((teamKey) => {
            const list = Array.isArray(this.combatCharacters?.[teamKey]) ? this.combatCharacters[teamKey] : [];
            return list
                .filter((c) => this.getTotalHp(c) > 0)
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
            if (entry?.char && this.getTotalHp(entry.char) > 0) {
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
        const passBtn = document.getElementById('defense-response-pass');
        const closeBtn = document.getElementById('defense-response-close');

        if (!modal || !dodgeBtn || !counterBtn || !passBtn || !closeBtn) return;

        dodgeBtn.addEventListener('click', () => this.submitDefenseResponse('DODGE'));
        counterBtn.addEventListener('click', () => this.submitDefenseResponse('COUNTER'));
        passBtn.addEventListener('click', () => this.submitDefenseResponse('PASS'));
        closeBtn.addEventListener('click', () => this.submitDefenseResponse('PASS'));

        // 백드롭 클릭은 PASS로 처리
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.submitDefenseResponse('PASS');
        });

        // ESC는 PASS로 처리(대기 상태일 때만)
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const open = modal.style.display !== 'none';
            if (!open) return;
            if (!this.pendingDefenseResponse) return;
            this.submitDefenseResponse('PASS');
        });

        this.defenseUiInitialized = true;
    }

    gradeLabelKo(grade) {
        switch (grade) {
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

        [attackBtn, ultimateBtn, forfeitBtn].forEach((btn) => {
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
        if (title) {
            title.textContent = `${defenderName}의 반격 / 회피 / PASS`;
        }
        if (modal) {
            modal.style.display = 'flex';
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
        const counterBtn = document.getElementById('defense-response-counter');
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
            if (!pending || !apiUrl) return;

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
            if (Array.isArray(result.log)) {
                result.log.forEach((logEntry) => this.addLog(logEntry));
            }

            // 반격 성공 시 공격자 HP 갱신(서버는 delta만 제공)
            if (typeof result.attackerDamage === 'number' && pending.attackerRef) {
                const before = Math.max(0, Math.round(Number(pending.attackerRef.hp) || 0));
                pending.attackerRef.hp = Math.max(0, before - Math.max(0, Math.round(result.attackerDamage)));
                this.addLog(`  💔 ${pending.attackerRef.name} HP: ${before} → ${pending.attackerRef.hp}`);
            }

            if (typeof result.defenderHp === 'number' && pending.defenderRef) {
                pending.defenderRef.hp = result.defenderHp;
            }

            this.pendingDefenseResponse = null;
            this.hideDefenseResponsePanel();

            // 같은 턴의 하위 단계가 끝났으니 이제 턴을 진행
            this.renderBattle();
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

    /**
     * 전투 렌더링
     */
    renderBattle() {
        // 히어로 팀
        const heroContainer = document.getElementById('team1-characters-combat');
        if (heroContainer) {
            heroContainer.innerHTML = this.combatCharacters.hero
                .map(char => this.createCharacterDisplay(char, 'hero'))
                .join('');
        }

        // 정부 팀
        const govContainer = document.getElementById('team2-characters-combat');
        if (govContainer) {
            govContainer.innerHTML = this.combatCharacters.gov
                .map(char => this.createCharacterDisplay(char, 'gov'))
                .join('');
        }

        // 빌런 팀
        const villainContainer = document.getElementById('team3-characters-combat');
        if (villainContainer) {
            villainContainer.innerHTML = this.combatCharacters.villain
                .map(char => this.createCharacterDisplay(char, 'villain'))
                .join('');
        }

        this.renderLog();
        this.updateTurnInfo();
        this.updateSkillSlots();
    }

    /**
     * 캐릭터 표시 생성
     */
    createCharacterDisplay(char, team) {
        const maxHp = char.maxHp || 100;
        const totalHp = Math.max(0, Math.round(Number(char.hp) || 0));
        const baseHp = Math.min(maxHp, totalHp);
        const shieldHp = Math.max(0, totalHp - maxHp);
        const hpPercent = Math.max(0, Math.min(100, Math.round((baseHp / maxHp) * 100)));
        const tags = (char.skillTypes || []).map(type => {
            if (type === '공격형') return '<span class="tag tag-attack">공격형</span>';
            if (type === '방어형') return '<span class="tag tag-defense">방어형</span>';
            if (type === '지원형') return '<span class="tag tag-support">지원형</span>';
            if (type === '치료형') return '<span class="tag tag-heal">치료형</span>';
            return `<span class="tag">${type}</span>`;
        }).join('');

        const shieldText = shieldHp > 0 ? ` <span style="color:#2b6cb0; font-weight:800;">(🛡️ +${shieldHp})</span>` : '';

        const isCurrent = this.isCurrentActor(team, char.id);

        return `
            <div class="combat-char-card${isCurrent ? ' is-current' : ''}" data-char-id="${char.id}" data-team="${team}">
                <div class="char-top">
                    <div class="char-name">${char.name}</div>
                    <div class="char-tags">${tags || '<span class="tag tag-empty">-</span>'}</div>
                </div>
                <div class="hp-row">
                    <div class="hp-label">HP ${baseHp}/${maxHp}${shieldText}</div>
                    <div class="hp-bar"><span style="width: ${hpPercent}%;"></span></div>
                </div>
                <div class="stat-row">
                    <span>⚔️ ${char.attack}</span>
                    <span>🛡️ ${char.defense}</span>
                    <span>💨 ${char.agility}</span>
                    <span>⭐ ${char.skill}</span>
                </div>
            </div>
        `;
    }

    // ===== 스킬(프론트) 공용 헬퍼 =====
    clampStat1to5(value) {
        return Math.max(1, Math.min(5, Math.round(Number(value) || 1)));
    }

    getMaxHp(char) {
        return Number.isFinite(Number(char?.maxHp)) ? Math.max(1, Math.round(Number(char.maxHp))) : 100;
    }

    getTotalHp(char) {
        return Math.max(0, Math.round(Number(char?.hp) || 0));
    }

    getShieldHp(char) {
        const maxHp = this.getMaxHp(char);
        const totalHp = this.getTotalHp(char);
        return Math.max(0, totalHp - maxHp);
    }

    getBaseHp(char) {
        const maxHp = this.getMaxHp(char);
        const totalHp = this.getTotalHp(char);
        return Math.min(maxHp, totalHp);
    }

    applyDamageWithShield(defender, damage) {
        const dmg = Math.max(0, Math.floor(Number(damage) || 0));
        if (dmg === 0) return { shieldAbsorbed: 0, hpDamage: 0, totalDamage: 0 };

        const maxHp = this.getMaxHp(defender);
        const beforeTotal = this.getTotalHp(defender);
        const beforeShield = Math.max(0, beforeTotal - maxHp);
        const beforeBase = Math.min(maxHp, beforeTotal);

        const shieldAbsorbed = Math.min(beforeShield, dmg);
        const remaining = dmg - shieldAbsorbed;
        const hpDamage = Math.min(beforeBase, remaining);

        const afterBase = Math.max(0, beforeBase - hpDamage);
        const afterShield = Math.max(0, beforeShield - shieldAbsorbed);
        defender.hp = afterBase + afterShield;

        return { shieldAbsorbed, hpDamage, totalDamage: shieldAbsorbed + hpDamage };
    }

    applyHealToBaseHp(target, amount) {
        const heal = Math.max(0, Math.floor(Number(amount) || 0));
        if (heal === 0) return 0;

        const maxHp = this.getMaxHp(target);
        const beforeTotal = this.getTotalHp(target);
        const shield = Math.max(0, beforeTotal - maxHp);
        const base = Math.min(maxHp, beforeTotal);

        const afterBase = Math.min(maxHp, base + heal);
        target.hp = afterBase + shield;
        return afterBase - base;
    }

    addShieldHp(target, amount) {
        const add = Math.max(0, Math.floor(Number(amount) || 0));
        if (add === 0) return 0;
        const before = this.getTotalHp(target);
        target.hp = before + add;
        return add;
    }

    getHealAmountBySkillStat(skillStat) {
        const stat = this.clampStat1to5(skillStat);
        const table = { 1: 5, 2: 7, 3: 9, 4: 12, 5: 15 };
        return table[stat] ?? table[1];
    }

    getShieldAmountBySkillStat(skillStat) {
        // NOTE: 방어형(쉴드) 수치는 밸런스 조정 포인트. 필요 시 이 테이블만 변경.
        const stat = this.clampStat1to5(skillStat);
        const table = { 1: 6, 2: 8, 3: 10, 4: 13, 5: 16 };
        return table[stat] ?? table[1];
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
                const totalHp = Math.max(0, Math.round(Number(char?.hp) || 0));
                const baseHp = Math.min(maxHp, totalHp);
                const shieldHp = Math.max(0, totalHp - maxHp);
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

            const maxLines = 200;
            const startIndex = Math.max(0, this.battleLog.length - maxLines);
            const entries = this.battleLog.slice(startIndex);

            const parsedEntries = entries.map((raw) => this.parseLogLine(raw));
            const blocks = this.groupLogEntries(parsedEntries, startIndex);

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
        const maxLines = 200;
        const startIndex = Math.max(0, this.battleLog.length - maxLines);
        const entries = this.battleLog.slice(startIndex);
        const parsedEntries = entries.map((raw) => this.parseLogLine(raw));
        const blocks = this.groupLogEntries(parsedEntries, startIndex);
        return blocks.filter((b) => b.type === 'group').map((b) => b.id);
    }

    isActionStartLogLine(text) {
        const t = String(text || '').trim();
        // 행동 시작을 나타내는 대표 라인들
        return t.startsWith('⚔️') || t.startsWith('⭐') || t.includes('전투 시작') || t.includes('턴 종료');
    }

    summarizeGroup(lines) {
        const first = lines[0];
        const title = first ? String(first.text || '').replace(/^\n+/, '').trim() : '행동';

        let status = 'neutral';
        let damage = null;
        let hasAwait = false;

        for (const line of lines) {
            const msg = String(line.text || '');
            if (msg.includes('❌')) status = 'fail';
            if (msg.includes('✅ 공격 성공') && msg.includes('반응을 선택')) hasAwait = true;

            const dmgMatch = msg.match(/💥\s*데미지:\s*([0-9]+)/);
            if (dmgMatch) {
                damage = Number(dmgMatch[1]);
            }
        }

        if (hasAwait && status !== 'fail') status = 'pending';
        if (damage !== null && status !== 'fail') status = 'resolved';

        const metaParts = [];
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
        if (message.includes('❌') || message.toLowerCase().includes('오류')) return 'error';
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
                    // 2-step begin: 공격 판정만 수행
                    const response = await fetch(`${apiUrl}/battles/simulate-begin`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            attacker: {
                                name: attacker.name,
                                attack: attacker.attack ?? attacker.atk,
                                defense: attacker.defense ?? attacker.def,
                                agility: attacker.agility ?? attacker.agi,
                                skill: attacker.skill ?? attacker.skillStat
                            },
                            defender: {
                                name: defender.name,
                                hp: defender.hp,
                                maxHp: defender.maxHp,
                                attack: defender.attack ?? defender.atk,
                                defense: defender.defense ?? defender.def,
                                agility: defender.agility ?? defender.agi
                            }
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        if (Array.isArray(result.log)) {
                            result.log.forEach((logEntry) => this.addLog(logEntry));
                        }

                        // 공격 실패 등으로 즉시 종료되는 케이스
                        if (result.phase === 'RESOLVED') {
                            if (typeof result.defenderHp === 'number') {
                                defender.hp = result.defenderHp;
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
                                pendingState: result.pendingState
                            };

                            this.showDefenseResponsePanel(attacker.name, defender.name);
                            return { awaitingResponse: true };
                        }

                        if (typeof result.defenderHp === 'number') {
                            defender.hp = result.defenderHp;
                        }
                        return { awaitingResponse: false };
                    }
                } catch (error) {
                    // 네트워크/CORS/라우팅 문제 등: 로컬 폴백으로 진행
                    console.warn('전투 API 호출 실패 → 로컬 폴백 사용:', error);
                }
            }

            // ===== 폴백(로컬 계산) =====
            this.addLog(`\n⚔️ ${attacker.name} → ${defender.name} 공격!`);

            const attackRoll = Math.floor(Math.random() * 100) + 1;
            const attackPower = (attacker.attack ?? attacker.atk ?? 1) * 10 + (attacker.skill ?? attacker.skillStat ?? 1) * 5;
            this.addLog(`  🎲 공격 판정: ${attackRoll} (필요: ${attackPower})`);

            if (attackRoll > attackPower) {
                this.addLog(`  ❌ 공격 실패!`);
                return { awaitingResponse: false };
            }

            const atkStat = Math.max(1, Math.min(5, Math.round(Number(attacker.attack ?? attacker.atk ?? 1))));
            const defStat = Math.max(1, Math.min(5, Math.round(Number(defender.defense ?? defender.def ?? 1))));

            // 기본공격 rawDamage: 3~10 (회의안: 필요 시 3~13으로 변경)
            const rawDamage = this.rollInt(3, 10);
            const defensePercent = this.getDefenseReductionPercent(defStat);
            const finalDamage = this.applyDefenseReduction(rawDamage, defensePercent);

            const beforeTotal = this.getTotalHp(defender);
            const beforeShield = this.getShieldHp(defender);
            const applied = this.applyDamageWithShield(defender, finalDamage);
            const afterTotal = this.getTotalHp(defender);

            this.addLog(`  🛡️ 방어력: ${defensePercent}% (원데미지 ${rawDamage} → 실제 ${finalDamage})`);
            this.addLog(`  💥 데미지: ${finalDamage}`);
            if (beforeShield > 0 || applied.shieldAbsorbed > 0) {
                this.addLog(`  🧱 쉴드: ${beforeShield} → ${this.getShieldHp(defender)} (흡수 ${applied.shieldAbsorbed})`);
            }
            this.addLog(`  💚 ${defender.name} HP: ${Math.min(this.getMaxHp(defender), beforeTotal)}/${this.getMaxHp(defender)} → ${Math.min(this.getMaxHp(defender), afterTotal)}/${this.getMaxHp(defender)}`);
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

        this.addLog('  💫 궁극기는 100% 명중합니다!');

        // 공격형 스킬 데미지(이미지 테이블): 최소 + 추가(1~N)
        const skillStat = attacker.skill ?? attacker.skillStat ?? 1;
        const rolled = this.rollAttackSkillRawDamage(skillStat);

        const defStat = Math.max(1, Math.min(5, Math.round(Number(defender.defense ?? defender.def ?? 1))));
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
        if (beforeShield > 0 || applied.shieldAbsorbed > 0) {
            this.addLog(`  🧱 쉴드: ${beforeShield} → ${this.getShieldHp(defender)} (흡수 ${applied.shieldAbsorbed})`);
        }
        this.addLog(`  💔 ${defender.name} HP: ${Math.min(this.getMaxHp(defender), beforeTotal)}/${this.getMaxHp(defender)} → ${Math.min(this.getMaxHp(defender), afterTotal)}/${this.getMaxHp(defender)}`);
        
        if (attacker && attacker.id) {
            this.usedUltimate[attacker.id] = true;
        }
        
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

        const skillStat = attacker.skill ?? attacker.skillStat ?? 1;
        const rolled = this.rollAttackSkillRawDamage(skillStat);

        const perTargetRaw = Math.floor((Number(rolled.raw) || 0) / n);
        this.addLog(`  🎲 스킬 데미지: ${rolled.min} + (1~${rolled.extraMax})[${rolled.bonus}] = ${rolled.raw} (최대 ${rolled.max})`);
        this.addLog(`  👥 다수 분배: floor(${rolled.raw} / ${n}) = ${perTargetRaw} (각 대상 원데미지)`);

        targets.forEach((defender) => {
            const defStat = Math.max(1, Math.min(5, Math.round(Number(defender.defense ?? defender.def ?? 1))));
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

        const skillStat = attacker.skill ?? attacker.skillStat ?? 1;
        const shieldBase = this.getShieldAmountBySkillStat(skillStat);
        const perTarget = Math.floor(shieldBase / n);

        this.addLog(`  🧱 쉴드량(단일): ${shieldBase}`);
        this.addLog(`  👥 다수 분배: floor(${shieldBase} / ${n}) = ${perTarget} (각 대상)`);

        list.forEach((t) => {
            const beforeShield = this.getShieldHp(t);
            const added = this.addShieldHp(t, perTarget);
            this.addLog(`  🎯 대상: ${t.name} (쉴드 +${added}, ${beforeShield} → ${this.getShieldHp(t)})`);
        });

        if (attacker && attacker.id) {
            this.usedUltimate[attacker.id] = true;
        }
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

        const skillStat = attacker.skill ?? attacker.skillStat ?? 1;
        const healBase = this.getHealAmountBySkillStat(skillStat);
        const perTarget = Math.floor(healBase / n);

        this.addLog(`  💊 회복량(단일): ${healBase}`);
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
            this.addLog(`\n========== 턴 ${this.currentTurn} ==========`);
        }

        // 현재팀(기존 UI 호환)도 현재 액터의 팀으로 동기화
        const entry = this.getCurrentTurnEntry();
        if (entry) {
            const idx = ['hero', 'gov', 'villain'].indexOf(entry.teamKey);
            this.currentTeamTurn = idx >= 0 ? idx : 0;
        }

        this.checkBattleEnd();
        this.renderBattle();
        this.updateSkillSlots();
    }

    /**
     * 전투 종료 확인
     */
    checkBattleEnd() {
        const heroAlive = this.combatCharacters.hero.some(c => this.getTotalHp(c) > 0);
        const govAlive = this.combatCharacters.gov.some(c => this.getTotalHp(c) > 0);
        const villainAlive = this.combatCharacters.villain.some(c => this.getTotalHp(c) > 0);

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
        const heroAlive = this.combatCharacters.hero.some(c => c.hp > 0);
        const govAlive = this.combatCharacters.gov.some(c => c.hp > 0);
        const villainAlive = this.combatCharacters.villain.some(c => c.hp > 0);

        let winner = '미정';
        const allyAlive = heroAlive || govAlive;
        if (allyAlive && !villainAlive) winner = '히어로/정부';
        else if (!allyAlive && villainAlive) winner = '빌런';

        this.addLog(`\n🏆 전투 종료! 승자: ${winner}`);

        // 전투 종료 시: 관련 기록은 저장/유지하지 않음
        // (App에서 startBattle() 시 push된 최신 전투 기록이 있으면 제거)
        if (Array.isArray(this.app?.battleHistory) && this.app.battleHistory.length > 0) {
            const last = this.app.battleHistory[this.app.battleHistory.length - 1];
            if (last && typeof last.id === 'string' && last.id.startsWith('battle_')) {
                this.app.battleHistory.pop();
                this.app.saveToLocalStorage?.();
            }
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
