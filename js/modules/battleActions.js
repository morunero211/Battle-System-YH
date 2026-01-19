/**
 * 전투 액션 핸들러 (Battle Actions)
 * 전투 중 플레이어 액션 (공격, 방어, 궁극기) 관리
 */

class BattleActions {
    constructor(app) {
        this.app = app;
        this.selectedTarget = null;
        this.targetSelectionMode = false;
        this.skillTargetUiInitialized = false;
        this.skillTargetContext = null; // { attacker, teamKey, skillType, mode, includeSelf, eligibleTeams, selected: Set<string> }
        this.initBattleActionListeners();
    }

    async uiAlert(title, message) {
        if (this.app?.showAlert) {
            await this.app.showAlert({ title: title || '알림', message: message || '' });
            return;
        }
        // 브라우저 기본 alert는 반복 경고를 유발할 수 있어 사용하지 않음
        this.app?.showToast?.(message || '', 'warning');
    }

    async uiConfirm(title, message, okText = '확인', cancelText = '취소') {
        if (this.app?.showConfirm) {
            return await this.app.showConfirm({ title: title || '확인', message: message || '', okText, cancelText });
        }
        // 브라우저 기본 confirm은 반복 경고를 유발할 수 있어 사용하지 않음
        this.app?.showToast?.('확인 모달이 준비되지 않았습니다.', 'warning');
        return false;
    }

    getSkillUseState(attacker) {
        const max = Math.max(0, Math.min(99, Math.floor(Number(attacker?.skillUsesMax ?? 1) || 0)));
        const used = Math.max(0, Math.floor(Number(attacker?.skillUsesUsed) || 0));
        const locked = !!attacker?.skillUsesLocked;
        const exhausted = max === 0 ? true : (used >= max);
        const canUse = !(locked || exhausted);
        const remaining = max === 0 ? 0 : Math.max(0, max - used);
        return { max, used, remaining, locked, exhausted, canUse };
    }

    consumeSkillUse(attacker) {
        if (!attacker) return { consumed: false, exhaustedNow: false, state: this.getSkillUseState(attacker) };
        const state = this.getSkillUseState(attacker);
        if (!state.canUse) return { consumed: false, exhaustedNow: state.exhausted, state };

        attacker.skillUsesMax = state.max;
        attacker.skillUsesUsed = state.used + 1;
        const after = this.getSkillUseState(attacker);

        const exhaustedNow = after.max === 0 ? true : (after.used >= after.max);
        if (exhaustedNow) attacker.skillUsesLocked = true;

        // 전투 중 사용도 즉시 저장(다음 전투/새로고침에도 반영)
        if (this.app?.saveToLocalStorage) {
            this.app.saveToLocalStorage();
        }

        return { consumed: true, exhaustedNow, state: after };
    }

    initSkillTargetUi() {
        if (this.skillTargetUiInitialized) return;

        const modal = document.getElementById('skill-target-modal');
        const closeBtn = document.getElementById('skill-target-close');
        const cancelBtn = document.getElementById('skill-target-cancel');
        const confirmBtn = document.getElementById('skill-target-confirm');
        if (!modal || !closeBtn || !cancelBtn || !confirmBtn) return;

        const onCancel = () => this.hideSkillTargetModal();
        closeBtn.addEventListener('click', onCancel);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) onCancel();
        });

        confirmBtn.addEventListener('click', () => this.confirmSkillTargets());

        this.skillTargetUiInitialized = true;
    }

    hideSkillTargetModal() {
        const modal = document.getElementById('skill-target-modal');
        if (modal) modal.style.display = 'none';
        this.skillTargetContext = null;
    }

    getAlliance(teamKey) {
        // 규칙: 히어로+정부는 연합, 빌런은 단독
        if (teamKey === 'villain') return { allies: ['villain'], enemies: ['hero', 'gov'] };
        return { allies: ['hero', 'gov'], enemies: ['villain'] };
    }

    getPrimarySkillType(attacker) {
        const type = Array.isArray(attacker?.skillTypes) ? attacker.skillTypes[0] : null;
        return type || '공격형';
    }

    openSkillTargetModal({ attacker, teamKey, skillType, mode, includeSelf, eligibleTeams, supportMode, supportTemplate, cancelKind, supportBasicStats }) {
        this.initSkillTargetUi();

        const modal = document.getElementById('skill-target-modal');
        const title = document.getElementById('skill-target-title');
        const subtitle = document.getElementById('skill-target-subtitle');
        const list = document.getElementById('skill-target-list');
        const note = document.getElementById('skill-target-note');

        if (!modal || !title || !subtitle || !list) return;

        const isMulti = mode === 'multi';

        const supportModeEl = document.getElementById('skill-target-support-mode');
        const basicModeEl = document.getElementById('skill-target-support-basic-mode');
        const cancelKindEl = document.getElementById('skill-target-support-cancel-kind');

        const currentSupportTemplate = (skillType === '지원형')
            ? String(supportTemplate || this.skillTargetContext?.supportTemplate || 'BASIC').toUpperCase()
            : null;
        const effectiveTemplate = (currentSupportTemplate === 'TURN_SKIP' || currentSupportTemplate === 'CANCEL') ? currentSupportTemplate : 'BASIC';

        const currentCancelKind = (skillType === '지원형')
            ? String(cancelKind || this.skillTargetContext?.cancelKind || 'BUFF').toUpperCase()
            : 'BUFF';
        const effectiveCancelKind = (currentCancelKind === 'DEBUFF') ? 'DEBUFF' : 'BUFF';

        const currentSupportMode = (skillType === '지원형')
            ? (supportMode || this.skillTargetContext?.supportMode || 'BUFF')
            : null;
        const effectiveSupportMode = (String(currentSupportMode) === 'DEBUFF') ? 'DEBUFF' : 'BUFF';

        let effectiveEligibleTeams = eligibleTeams;
        if (skillType === '지원형') {
            const alliance = this.getAlliance(teamKey);
            if (effectiveTemplate === 'TURN_SKIP' || effectiveTemplate === 'CANCEL') {
                effectiveEligibleTeams = alliance.enemies;
            } else {
                effectiveEligibleTeams = (effectiveSupportMode === 'BUFF') ? alliance.allies : alliance.enemies;
            }
        }

        const sideLabel = (skillType === '공격형')
            ? '적군'
            : (skillType === '지원형'
                ? ((effectiveTemplate === 'TURN_SKIP' || effectiveTemplate === 'CANCEL')
                    ? '적군'
                    : (effectiveSupportMode === 'BUFF' ? '아군' : '적군'))
                : '아군');
        title.textContent = isMulti
            ? `🎯 ${skillType} 대상 선택 (다수 · ${sideLabel})`
            : `🎯 ${skillType} 대상 선택 (단일 · ${sideLabel})`;

        let targetHint = '아군 목록에서 대상을 선택하세요.';
        if (skillType === '공격형') {
            targetHint = '적 목록에서 대상을 선택하세요.';
        } else if (skillType === '지원형') {
            if (effectiveTemplate === 'TURN_SKIP') {
                targetHint = '적 목록에서 “턴 스킵”할 대상을 선택하세요.';
            } else if (effectiveTemplate === 'CANCEL') {
                targetHint = (effectiveCancelKind === 'DEBUFF')
                    ? '적 목록에서 “디버프 캔슬(약화 무효화)”할 대상을 선택하세요.'
                    : '적 목록에서 “버프 캔슬(강화 무효화)”할 대상을 선택하세요.';
            } else {
                targetHint = (effectiveSupportMode === 'BUFF')
                    ? '아군 목록에서 대상을 선택하세요.'
                    : '적 목록에서 대상을 선택하세요.';
            }
        }
        subtitle.textContent = `${attacker?.name || '사용자'} · ${targetHint}`;

        if (note) {
            if (isMulti) {
                if (skillType === '공격형') {
                    note.textContent = '다수 공격형은 선택한 대상 수 n으로 1/n 분배(내림) 후 각 대상 방어%를 적용합니다.';
                } else if (skillType === '방어형') {
                    note.textContent = '다수 방어형(쉴드)은 선택한 대상 수 n으로 1/n 분배(내림)합니다. 쉴드는 피해를 먼저 흡수하며 소모될 때까지 유지됩니다.';
                } else if (skillType === '치료형') {
                    note.textContent = '다수 치료형은 선택한 대상 수 n으로 1/n 분배(내림)합니다. 회복은 maxHP를 넘지 않습니다.';
                } else {
                    note.textContent = '다수 스킬은 선택한 대상 수 n으로 1/n 분배(내림) 규칙을 사용합니다.';
                }
            } else {
                if (skillType === '방어형') note.textContent = '방어형은 쉴드를 부여합니다(쉴드는 피해를 먼저 흡수).';
                else if (skillType === '치료형') note.textContent = '치료형은 HP를 회복합니다(maxHP 초과 불가).';
                else if (skillType === '지원형') {
                    if (effectiveTemplate === 'TURN_SKIP') {
                        note.textContent = '지원형(턴 스킵)은 스킬 스탯에 따라 대상의 턴을 1~2회 스킵시킵니다.';
                    } else if (effectiveTemplate === 'CANCEL') {
                        note.textContent = (effectiveCancelKind === 'DEBUFF')
                            ? '지원형(디버프 캔슬)은 대상의 (-) 스탯 변화를 무효화합니다.'
                            : '지원형(버프 캔슬)은 대상의 (+) 스탯 변화를 무효화합니다.';
                    } else {
                        note.textContent = '지원형(기본)은 설정된 스탯에 1회용 버프 또는 디버프를 적용합니다.';
                    }
                }
                else note.textContent = '';
            }
        }

        this.skillTargetContext = {
            attacker,
            teamKey,
            skillType,
            mode,
            includeSelf,
            eligibleTeams: effectiveEligibleTeams,
            supportTemplate: effectiveTemplate,
            supportMode: effectiveSupportMode || undefined,
            cancelKind: effectiveCancelKind,
            supportBasicStats: Array.isArray(supportBasicStats) ? supportBasicStats : (this.skillTargetContext?.supportBasicStats || undefined),
            selected: new Set()
        };

        // 전투 중 지원형은 캐릭터에 저장된 기본값을 그대로 사용하므로 선택 UI는 숨김
        if (supportModeEl) supportModeEl.style.display = 'none';
        if (basicModeEl) basicModeEl.style.display = 'none';
        if (cancelKindEl) cancelKindEl.style.display = 'none';

        // UI 렌더
        list.innerHTML = '';
        const teamLabels = { hero: '🦸 히어로', gov: '🏛️ 정부', villain: '😈 빌런' };

        effectiveEligibleTeams.forEach((t) => {
            const group = document.createElement('div');
            group.className = 'skill-target-group';

            const groupTitle = document.createElement('div');
            groupTitle.className = 'skill-target-group-title';
            groupTitle.textContent = teamLabels[t] || t;

            const buttons = document.createElement('div');
            buttons.className = 'skill-target-buttons';

            const chars = (this.app.battleSystem?.combatCharacters?.[t] || []).filter(c => {
                const bs = this.app?.battleSystem;
                return typeof bs?.isCombatCapable === 'function' ? bs.isCombatCapable(c) : ((Number(c.hp) || 0) > 0);
            });
            const filtered = chars.filter(c => {
                if (skillType !== '공격형' && mode === 'multi' && !includeSelf) {
                    return c.id !== attacker?.id;
                }
                return true;
            });

            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.style.color = '#718096';
                empty.style.fontSize = '13px';
                empty.textContent = '선택 가능한 대상이 없습니다.';
                buttons.appendChild(empty);
            } else {
                filtered.forEach((c) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'skill-target-btn';
                    btn.dataset.teamKey = t;
                    btn.dataset.charId = c.id;

                    const name = document.createElement('div');
                    name.className = 'skill-target-btn-name';
                    name.textContent = c.name;

                    const hp = document.createElement('div');
                    hp.className = 'skill-target-btn-hp';
                    const maxHp = Number.isFinite(Number(c.maxHp)) ? Math.max(1, Math.round(Number(c.maxHp))) : 100;
                    const totalHp = Math.max(0, Math.round(Number(c.hp) || 0));
                    const baseHp = Math.min(maxHp, totalHp);
                    const shieldHp = Math.max(0, totalHp - maxHp);
                    hp.textContent = shieldHp > 0
                        ? `HP ${baseHp}/${maxHp} · 🛡️+${shieldHp}`
                        : `HP ${baseHp}/${maxHp}`;

                    btn.appendChild(name);
                    btn.appendChild(hp);

                    btn.addEventListener('click', () => {
                        const ctx = this.skillTargetContext;
                        if (!ctx) return;
                        const key = `${t}:${c.id}`;

                        if (ctx.mode !== 'multi') {
                            // 단일: 하나만 선택
                            ctx.selected.clear();
                            // UI에서도 다른 선택 해제
                            list.querySelectorAll('.skill-target-btn.is-selected').forEach(el => el.classList.remove('is-selected'));
                            ctx.selected.add(key);
                            btn.classList.add('is-selected');
                            return;
                        }

                        // 다수: 토글
                        if (ctx.selected.has(key)) {
                            ctx.selected.delete(key);
                            btn.classList.remove('is-selected');
                        } else {
                            ctx.selected.add(key);
                            btn.classList.add('is-selected');
                        }
                    });

                    buttons.appendChild(btn);
                });
            }

            group.appendChild(groupTitle);
            group.appendChild(buttons);
            list.appendChild(group);
        });

        modal.style.display = 'flex';
    }

    confirmSkillTargets() {
        const ctx = this.skillTargetContext;
        if (!ctx) return;

        if (ctx.selected.size === 0) {
            this.app?.showToast?.('대상을 1명 이상 선택해주세요.', 'warning');
            return;
        }

        // 선택 목록 파싱
        const targets = Array.from(ctx.selected).map((k) => {
            const [teamKey, charId] = k.split(':');
            const char = (this.app.battleSystem?.combatCharacters?.[teamKey] || []).find(c => c.id === charId);
            return { teamKey, charId, char };
        }).filter(t => t.char);

        const names = targets.map(t => t.char.name).join(', ');
        this.app.battleSystem.addLog(`🎯 스킬 대상 선택: ${names}`);

        // 템플릿 스킬(조건+이펙트) 우선 처리
        const tmpl = this.app?.battleSystem?.getSkillTemplate?.(ctx.attacker);
        if (tmpl) {
            const consumed = this.consumeSkillUse(ctx.attacker);
            if (!consumed.consumed) {
                this.hideSkillTargetModal();
                this.app?.showToast?.('경고. 본 캐릭터의 스킬 횟수를 모두 사용하였습니다.', 'danger');
                this.app.battleSystem.addLog('🔒 스킬 사용 불가: 사용 횟수 소진/잠금 상태');
                return;
            }
            if (consumed.exhaustedNow) {
                this.app?.showToast?.('스킬 사용 횟수를 모두 소진했습니다. (자동 잠금)', 'info');
                this.app.battleSystem.addLog('🔒 스킬 사용 횟수 소진: 자동 잠금 처리');
            }

            const res = this.app.battleSystem.executeSkillTemplate({ attacker: ctx.attacker, teamKey: ctx.teamKey, targets: targets.map(t => t.char) });
            this.hideSkillTargetModal();
            if (res?.ok) {
                this.app.battleSystem.renderBattle();
                if (this.app.battleSystem.checkBattleEnd()) {
                    this.app.battleSystem.renderBattle();
                    return;
                }
                this.app.battleSystem.nextTurn();
                this.app.battleSystem.renderBattle();
            }
            return;
        }

        // 공격형: 단일/다수 모두 실제 적용
        if (ctx.skillType === '공격형') {
            const consumed = this.consumeSkillUse(ctx.attacker);
            if (!consumed.consumed) {
                this.hideSkillTargetModal();
                this.app?.showToast?.('경고. 본 캐릭터의 스킬 횟수를 모두 사용하였습니다.', 'danger');
                this.app.battleSystem.addLog('🔒 스킬 사용 불가: 사용 횟수 소진/잠금 상태');
                return;
            }
            if (consumed.exhaustedNow) {
                // 마지막 1회를 "성공적으로" 사용한 경우: 차단용 경고 대신 안내만
                this.app?.showToast?.('스킬 사용 횟수를 모두 소진했습니다. (자동 잠금)', 'info');
                this.app.battleSystem.addLog('🔒 스킬 사용 횟수 소진: 자동 잠금 처리');
            }

            this.hideSkillTargetModal();

            if (ctx.mode !== 'multi') {
                const first = targets[0];
                const res = this.app.battleSystem.executeUltimate(ctx.attacker, first.char, first.teamKey);
                if (res && res.awaitingResponse) {
                    this.app.battleSystem.renderBattle();
                    return;
                }
            } else {
                const res = this.app.battleSystem.executeUltimateMulti(ctx.attacker, targets.map(t => t.char));
                if (res && res.awaitingResponse) {
                    this.app.battleSystem.renderBattle();
                    return;
                }
            }

            this.app.battleSystem.renderBattle();

            // NOTE: checkBattleEnd는 내부에서 endBattle()까지 처리하며 현재 반환값이 없습니다.
            this.app.battleSystem.checkBattleEnd();
            this.app.battleSystem.nextTurn();
            this.app.battleSystem.renderBattle();
            return;
        }

        // 방어형(쉴드): 단일/다수 모두 실제 적용
        if (ctx.skillType === '방어형') {
            const consumed = this.consumeSkillUse(ctx.attacker);
            if (!consumed.consumed) {
                this.hideSkillTargetModal();
                this.app?.showToast?.('경고. 본 캐릭터의 스킬 횟수를 모두 사용하였습니다.', 'danger');
                this.app.battleSystem.addLog('🔒 스킬 사용 불가: 사용 횟수 소진/잠금 상태');
                return;
            }
            if (consumed.exhaustedNow) {
                this.app?.showToast?.('스킬 사용 횟수를 모두 소진했습니다. (자동 잠금)', 'info');
                this.app.battleSystem.addLog('🔒 스킬 사용 횟수 소진: 자동 잠금 처리');
            }

            this.hideSkillTargetModal();
            this.app.battleSystem.executeDefenseSkillMulti(ctx.attacker, targets.map(t => t.char));
            this.app.battleSystem.renderBattle();
            this.app.battleSystem.checkBattleEnd();
            this.app.battleSystem.nextTurn();
            this.app.battleSystem.renderBattle();
            return;
        }

        // 치료형: 단일/다수 모두 실제 적용
        if (ctx.skillType === '치료형') {
            const consumed = this.consumeSkillUse(ctx.attacker);
            if (!consumed.consumed) {
                this.hideSkillTargetModal();
                this.app?.showToast?.('경고. 본 캐릭터의 스킬 횟수를 모두 사용하였습니다.', 'danger');
                this.app.battleSystem.addLog('🔒 스킬 사용 불가: 사용 횟수 소진/잠금 상태');
                return;
            }
            if (consumed.exhaustedNow) {
                this.app?.showToast?.('스킬 사용 횟수를 모두 소진했습니다. (자동 잠금)', 'info');
                this.app.battleSystem.addLog('🔒 스킬 사용 횟수 소진: 자동 잠금 처리');
            }

            this.hideSkillTargetModal();
            this.app.battleSystem.executeHealSkillMulti(ctx.attacker, targets.map(t => t.char));
            this.app.battleSystem.renderBattle();
            this.app.battleSystem.checkBattleEnd();
            this.app.battleSystem.nextTurn();
            this.app.battleSystem.renderBattle();
            return;
        }

        // 지원형: 기본은 버프/디버프(1턴), 템플릿이 있으면 템플릿 우선 처리됨
        if (ctx.skillType === '지원형') {
            const consumed = this.consumeSkillUse(ctx.attacker);
            if (!consumed.consumed) {
                this.hideSkillTargetModal();
                this.app?.showToast?.('경고. 본 캐릭터의 스킬 횟수를 모두 사용하였습니다.', 'danger');
                this.app.battleSystem.addLog('🔒 스킬 사용 불가: 사용 횟수 소진/잠금 상태');
                return;
            }
            if (consumed.exhaustedNow) {
                this.app?.showToast?.('스킬 사용 횟수를 모두 소진했습니다. (자동 잠금)', 'info');
                this.app.battleSystem.addLog('🔒 스킬 사용 횟수 소진: 자동 잠금 처리');
            }

            this.hideSkillTargetModal();
            const tpl = String(ctx.supportTemplate || 'BASIC').toUpperCase();
            const resolvedMode = (tpl === 'TURN_SKIP')
                ? 'TURN_SKIP'
                : (tpl === 'CANCEL')
                    ? 'CANCEL'
                    : (ctx.supportMode || 'AUTO');

            const allowedStats = ['attack', 'agility', 'defense', 'skill'];
            const stats = Array.isArray(ctx.supportBasicStats) && ctx.supportBasicStats.length
                ? allowedStats.filter((k) => ctx.supportBasicStats.map(String).includes(k))
                : allowedStats;

            const supportOptions = (resolvedMode === 'CANCEL')
                ? {
                    cancelFeatureEnabled: true,
                    cancelKind: (String(ctx.cancelKind || 'BUFF').toUpperCase() === 'DEBUFF') ? 'DEBUFF' : 'BUFF',
                    basicStats: stats
                }
                : { basicStats: stats };

            this.app.battleSystem.executeSupportSkillMulti(
                ctx.attacker,
                targets.map(t => t.char),
                ctx.teamKey,
                resolvedMode,
                supportOptions
            );
            this.app.battleSystem.renderBattle();
            this.app.battleSystem.checkBattleEnd();
            this.app.battleSystem.nextTurn();
            this.app.battleSystem.renderBattle();
            return;
        }

        // 그 외(방어/치료/지원)는 UI만 확정 후 로그만 남김
        this.hideSkillTargetModal();
        this.app?.showToast?.('아직 구현되지 않은 스킬 타입입니다. (사용 횟수는 차감되지 않습니다)', 'info');
        this.app.battleSystem.renderBattle();
        this.app.battleSystem.nextTurn();
        this.app.battleSystem.renderBattle();
    }

    /**
     * 전투 액션 이벤트 리스너 초기화
     */
    initBattleActionListeners() {
        // 공격 버튼
        document.getElementById('action-attack')?.addEventListener('click', () => {
            this.selectTargetForAttack();
        });

        // 스킬(궁극기) 버튼
        document.getElementById('action-ultimate')?.addEventListener('click', () => {
            this.selectTargetForUltimate();
        });

        // 시간 종료 버튼(타임아웃 판정)
        document.getElementById('forfeit-button')?.addEventListener('click', async () => {
            if (this.app?.battleSystem?.pendingDefenseResponse) {
                await this.uiAlert('제한', '방어자 응답 선택 중에는 시간 종료할 수 없습니다.');
                return;
            }

            const ok = await this.uiConfirm(
                '시간 종료',
                '시간 종료하시겠습니까? (현재 HP 상태로 승패를 판정합니다)',
                '종료',
                '취소'
            );

            if (ok) this.handleTimeoutEnd();
        });

        // 전투 결과 모달 닫기
        document.getElementById('battle-result-close')?.addEventListener('click', () => this.hideBattleResultModal());
        document.getElementById('battle-result-ok')?.addEventListener('click', () => this.hideBattleResultModal());

    }

    computeAverageHp(teamKeys) {
        const chars = teamKeys.flatMap((k) => this.app.battleSystem.combatCharacters[k] || []);
        const count = chars.length;
        const sumHp = chars.reduce((acc, c) => acc + Math.max(0, Math.round(Number(c.hp) || 0)), 0);
        const avgHp = count > 0 ? (sumHp / count) : 0;
        return { avgHp, sumHp, count };
    }

    computeTimeoutOutcome() {
        // 팀 규칙: 히어로+정부 = 같은 팀, 빌런 = 상대 팀
        const ally = this.computeAverageHp(['hero', 'gov']);
        const villain = this.computeAverageHp(['villain']);

        let winner = '무승부';
        if (ally.avgHp > villain.avgHp) winner = '히어로/정부 연합';
        else if (ally.avgHp < villain.avgHp) winner = '빌런';

        return {
            winner,
            ally,
            villain
        };
    }

    handleTimeoutEnd() {
        const outcome = this.computeTimeoutOutcome();

        this.app.battleSystem.addLog('⏱️ 시간 종료! 현재 HP 상태로 승패를 판정합니다.');
        this.app.battleSystem.renderBattle();

        // 전투 기록 업데이트(현재 HP 상태 그대로 저장)
        const lastRecord = this.app.battleHistory?.[this.app.battleHistory.length - 1];
        if (lastRecord) {
            lastRecord.winner = outcome.winner;
            lastRecord.turnCount = this.app.battleSystem.currentTurn;
            lastRecord.endReason = 'TIMEOUT';
            lastRecord.scores = {
                allyAvgHp: outcome.ally.avgHp,
                allySumHp: outcome.ally.sumHp,
                allyCount: outcome.ally.count,
                villainAvgHp: outcome.villain.avgHp,
                villainSumHp: outcome.villain.sumHp,
                villainCount: outcome.villain.count
            };
        }

        this.app.saveToLocalStorage();

        // 전투는 종료 처리(추가 액션 방지)
        this.app.battleSystem.setActionButtonsEnabled(false);
        this.showBattleResultModal(outcome);
    }

    showBattleResultModal(outcome) {
        const modal = document.getElementById('battle-result-modal');
        const winnerEl = document.getElementById('battle-result-winner');
        const scoresEl = document.getElementById('battle-result-scores');

        if (winnerEl) {
            winnerEl.textContent = `🏆 승리: ${outcome.winner}`;
        }

        if (scoresEl) {
            const allyAvg = Math.round(outcome.ally.avgHp * 10) / 10;
            const villainAvg = Math.round(outcome.villain.avgHp * 10) / 10;

            scoresEl.innerHTML = `
                <div style="font-weight:800; margin-bottom:8px;">판정 기준</div>
                <div>히어로/정부 팀 평균 HP vs 빌런 팀 평균 HP</div>
                <div style="height:10px;"></div>
                <div style="font-weight:800; margin-bottom:6px;">점수</div>
                <div>히어로/정부: 평균 ${allyAvg} (총합 ${outcome.ally.sumHp} / ${outcome.ally.count}명)</div>
                <div>빌런: 평균 ${villainAvg} (총합 ${outcome.villain.sumHp} / ${outcome.villain.count}명)</div>
            `;
        }

        if (modal) modal.style.display = 'flex';
    }

    hideBattleResultModal() {
        const modal = document.getElementById('battle-result-modal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * 궁극기 대상 선택
     */
    selectTargetForUltimate() {
        if (this.app?.battleSystem?.pendingDefenseResponse) {
            this.uiAlert('제한', '방어자 응답 선택 중에는 스킬을 사용할 수 없습니다.');
            return;
        }

        const entry = this.app?.battleSystem?.getCurrentTurnEntry?.();
        const teamKey = entry?.teamKey;
        const attacker = entry?.char;
        if (!attacker) {
            this.uiAlert('불가', '스킬을 사용할 수 있는 캐릭터가 없습니다!');
            return;
        }

        const state = this.getSkillUseState(attacker);
        if (!state.canUse) {
            this.app?.showToast?.('경고. 본 캐릭터의 스킬 횟수를 모두 사용하였습니다.', 'danger');
            this.app.battleSystem.addLog('🔒 스킬 사용 불가: 사용 횟수 소진/잠금 상태');
            return;
        }

        const skillType = this.getPrimarySkillType(attacker);
        const mode = attacker.skillTarget?.mode || 'single';
        const includeSelf = !!attacker.skillTarget?.includeSelf;

        const alliance = this.getAlliance(teamKey);

        if (skillType === '지원형') {
            // 지원형: 캐릭터 기본 설정(템플릿/기본 모드)을 기본 선택값으로 적용
            const tpl = String(attacker?.supportConfig?.template || 'BASIC').toUpperCase();
            const supportTemplate = (tpl === 'TURN_SKIP' || tpl === 'CANCEL') ? tpl : 'BASIC';
            const bm = String(attacker?.supportConfig?.basicMode || 'BUFF').toUpperCase();
            const supportMode = (bm === 'DEBUFF') ? 'DEBUFF' : 'BUFF';
            const ck = String(attacker?.supportConfig?.cancelKind || 'BUFF').toUpperCase();
            const cancelKind = (ck === 'DEBUFF') ? 'DEBUFF' : 'BUFF';

            const statsRaw = Array.isArray(attacker?.supportConfig?.basicStats) ? attacker.supportConfig.basicStats : null;
            const allowed = ['attack', 'agility', 'defense', 'skill'];
            const supportBasicStats = (statsRaw && statsRaw.length)
                ? allowed.filter((k) => statsRaw.map(String).includes(k))
                : allowed;

            this.openSkillTargetModal({
                attacker,
                teamKey,
                skillType,
                mode,
                includeSelf,
                eligibleTeams: alliance.allies,
                supportTemplate,
                supportMode,
                cancelKind,
                supportBasicStats
            });
            return;
        }

        const eligibleTeams = (skillType === '공격형') ? alliance.enemies : alliance.allies;
        this.openSkillTargetModal({ attacker, teamKey, skillType, mode, includeSelf, eligibleTeams });
    }

    /**
     * 공격 대상 선택
     */
    selectTargetForAttack() {
        const entry = this.app?.battleSystem?.getCurrentTurnEntry?.();
        const teamKey = entry?.teamKey;
        if (!teamKey) return;

        const alliance = this.getAlliance(teamKey);
        const enemyTeams = alliance.enemies;
        
        this.targetSelectionMode = true;
        this.currentAction = 'attack';
        
        // 적 팀 UI 활성화
        this.enableTargetSelection(enemyTeams);
    }

    /**
     * 대상 선택 UI 활성화
     */
    enableTargetSelection(enemyTeams) {
        const teamNames = ['hero', 'gov', 'villain'];
        
        // 모든 캐릭터에 클릭 이벤트 추가
        teamNames.forEach((team, idx) => {
            const container = document.getElementById(`team${idx + 1}-characters-combat`);
            if (!container) return;
            
            const characters = container.querySelectorAll('[data-char-id]');
            characters.forEach(char => {
                char.style.cursor = 'pointer';
                char.style.opacity = enemyTeams.includes(team) ? '1' : '0.3';
                char.style.pointerEvents = enemyTeams.includes(team) ? 'auto' : 'none';
                
                const charId = char.dataset.charId;
                
                char.addEventListener('click', () => {
                    this.performAction(team, charId);
                }, { once: true });
            });
        });
        
        // 안내 메시지
        const log = document.getElementById('combat-log');
        if (log) {
            const msg = document.createElement('div');
            msg.className = 'battle-log-entry info';
            const action = this.currentAction === 'ultimate' ? '스킬' : '공격';
            msg.textContent = `🎯 ${action}할 대상을 선택하세요.`;
            log.insertBefore(msg, log.firstChild);
        }
    }

    /**
     * 액션 수행
     */
    async performAction(targetTeam, targetCharId) {
        this.targetSelectionMode = false;

        const entry = this.app?.battleSystem?.getCurrentTurnEntry?.();
        const currentTeamName = entry?.teamKey;
        const attacker = entry?.char;
        
        if (!attacker) {
            this.uiAlert('불가', '공격할 수 있는 캐릭터가 없습니다!');
            return;
        }
        
        // 대상 찾기
        const targetChars = this.app.battleSystem.combatCharacters[targetTeam];
        const target = targetChars.find(c => c.id === targetCharId);
        
        const bs = this.app?.battleSystem;
        const okTarget = target && (typeof bs?.isCombatCapable === 'function' ? bs.isCombatCapable(target) : (target.hp > 0));
        if (!okTarget) {
            this.uiAlert('대상 오류', '유효한 대상이 아닙니다!');
            return;
        }
        
        // 액션 실행
        if (this.currentAction === 'ultimate') {
            const res = this.app.battleSystem.executeUltimate(attacker, target, targetTeam);
            // 공격형 스킬에 대한 방어형 반응(선택) 단계가 열렸으면 턴 진행을 멈춤
            if (res && res.awaitingResponse) {
                this.app.battleSystem.renderBattle();
                return;
            }
        } else {
            const result = await this.app.battleSystem.executeAttack(attacker, target, targetTeam, currentTeamName);

            // 2-step 방어자 응답 대기 중이면 같은 턴 안에서 일시정지
            if (result && result.awaitingResponse) {
                this.app.battleSystem.renderBattle();
                return;
            }
        }
        
        // UI 업데이트
        this.app.battleSystem.renderBattle();
        
        // 전투 종료 확인
        if (this.app.battleSystem.checkBattleEnd()) {
            this.app.battleSystem.renderBattle();
            return;
        }

        // 다음 턴
        this.app.battleSystem.nextTurn();
        this.app.battleSystem.renderBattle();
    }

    /**
     * 항복 액션
     */
    handleForfeit() {
        const entry = this.app?.battleSystem?.getCurrentTurnEntry?.();
        const teamKey = entry?.teamKey;
        if (!teamKey) return;

        const teamLabel = teamKey === 'hero' ? '히어로' : (teamKey === 'gov' ? '정부' : '빌런');

        // 항복 팀의 모든 캐릭터 HP를 0으로 설정
        (this.app.battleSystem.combatCharacters?.[teamKey] || []).forEach(char => {
            char.hp = 0;
        });

        this.app.battleSystem.addLog(`💀 ${teamLabel} 팀이 항복했습니다!`);
        this.app.battleSystem.renderBattle();

        // 전투 종료(승자 판정/기록 정리 포함)
        this.app.battleSystem.checkBattleEnd();
    }

    /**
     * 전투 종료
     */
    endBattle() {
        const teamNames = ['hero', 'gov', 'villain'];
        const teamDisplayNames = ['히어로', '정부', '빌런'];
        
        // 승자 팀 결정
        let winnerTeam = null;
        let teamsAlive = 0;
        
        teamNames.forEach((team, idx) => {
            const hasAlive = this.app.battleSystem.combatCharacters[team].some(c => c.hp > 0);
            if (hasAlive) {
                teamsAlive++;
                winnerTeam = idx;
            }
        });
        
        if (teamsAlive === 1) {
            const winner = teamDisplayNames[winnerTeam];
            
            // 전투 기록 업데이트
            const lastRecord = this.app.battleHistory[this.app.battleHistory.length - 1];
            if (lastRecord) {
                lastRecord.winner = winner;
                lastRecord.turnCount = this.app.battleSystem.currentTurn;
            }
            
            this.app.saveToLocalStorage();
            
            // 전투 종료 화면 표시
            this.showBattleEndScreen(winner);
        }
    }

    /**
     * 전투 종료 화면 표시
     */
    showBattleEndScreen(winner) {
        const endScreen = document.getElementById('combat-end');
        if (!endScreen) return;
        
        endScreen.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #fff;">
                <h2 style="font-size: 42px; margin-bottom: 16px;">⚔️ 전투 종료!</h2>
                <p style="font-size: 28px; margin-bottom: 28px; color: #4ade80;">
                    🏆 ${winner} 팀이 승리했습니다!
                </p>
                <p style="font-size: 16px; margin-bottom: 12px; opacity: 0.85;">
                    총 ${this.app.battleSystem.currentTurn} 턴이 소요되었습니다.
                </p>
            </div>
        `;
        
        endScreen.classList.remove('hidden');
        
    }

    /**
     * 전투 리셋
     */
    resetBattle() {
        // 선택 캐릭터 초기화
        this.app.selectedCharacters = {
            hero: [],
            gov: [],
            villain: []
        };
        
        // 전투 시스템 초기화
        this.app.battleSystem.currentTurn = 1;
        this.app.battleSystem.currentTeamTurn = 0;
        this.app.battleSystem.battleLog = [];
        
        // UI 업데이트
        this.app.renderAllTeams();
        this.app.updateSelectedDisplay();
    }
}
