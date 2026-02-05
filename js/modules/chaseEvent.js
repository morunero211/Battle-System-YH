/**
 * 도주 이벤트(술래잡기) - 전투와 별개 미니게임
 * - 8칸 보드에서 민첩(d100) 판정으로 전진/후퇴
 * - 도망자: 전진(+) = 탈출에 가까워짐, 대실패(-) = 한 칸 뒤로
 * - 술래: 전진(+) = 따라잡기에 가까워짐, 대실패(-) = 한 칸 뒤로
 * - 종료 조건:
 *   - 술래가 도망자 위치에 도달/추월하면 따라잡힘
 *   - 도망자가 마지막 칸(끝)에 도달하면 도주 성공
 * - 패널티: 따라잡힘/도주성공 시 즉시 2회 공격(옵션)
 */

class ChaseEvent {
    constructor(app) {
        this.app = app;
        this.state = null;
        this.uiInitialized = false;
        this.uiPair = null; // { runnerRef, chaserRef }
    }

    init() {
        if (this.uiInitialized) return;

        const openBtn = document.getElementById('action-chase');
        openBtn?.addEventListener('click', () => this.open());

        document.getElementById('chase-close')?.addEventListener('click', () => this.close());
        const modal = document.getElementById('chase-event-modal');
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        document.getElementById('chase-start')?.addEventListener('click', () => this.startFromUi());
        document.getElementById('chase-roll')?.addEventListener('click', () => this.rollStep());
        document.getElementById('chase-mini-attack')?.addEventListener('click', () => this.runMiniCombat());
        document.getElementById('chase-reset')?.addEventListener('click', () => this.reset());

        this.uiInitialized = true;
    }

    open() {
        this.init();
        const modal = document.getElementById('chase-event-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        this.refreshUiOptions();
        this.render();
    }

    close() {
        const modal = document.getElementById('chase-event-modal');
        if (modal) modal.style.display = 'none';
    }

    getAliveParticipants() {
        const bs = this.app?.battleSystem;
        if (!bs?.combatCharacters) return [];

        const teamLabels = { hero: '히어로', gov: '정부', villain: '빌런' };
        const keys = ['hero', 'gov', 'villain'];
        const list = [];
        keys.forEach((teamKey) => {
            (bs.combatCharacters?.[teamKey] || []).forEach((char) => {
                if (!char) return;
                if (typeof bs.getTotalHp === 'function' && bs.getTotalHp(char) <= 0) return;
                list.push({ teamKey, teamLabel: teamLabels[teamKey] || teamKey, char });
            });
        });
        return list;
    }

    getDefaultPair(list) {
        const alive = Array.isArray(list) ? list : this.getAliveParticipants();

        const firstHero = alive.find((p) => p.teamKey === 'hero');
        const firstGov = alive.find((p) => p.teamKey === 'gov');
        const firstVillain = alive.find((p) => p.teamKey === 'villain');

        const runnerPick = firstHero || firstGov || alive.find((p) => p.teamKey !== 'villain') || alive[0] || null;
        let chaserPick = firstVillain || alive.find((p) => p.teamKey === 'villain') || null;

        // fallback: 술래가 없거나 동일인이라면 다른 아무나
        if (!chaserPick || (runnerPick && chaserPick && String(runnerPick.char.id) === String(chaserPick.char.id))) {
            chaserPick = alive.find((p) => String(p?.char?.id) !== String(runnerPick?.char?.id)) || null;
        }

        if (!runnerPick || !chaserPick) return null;
        return {
            runnerRef: { teamKey: runnerPick.teamKey, charId: String(runnerPick.char.id) },
            chaserRef: { teamKey: chaserPick.teamKey, charId: String(chaserPick.char.id) }
        };
    }

    refreshUiOptions() {
        const runnerLabel = document.getElementById('chase-runner-label');
        const chaserLabel = document.getElementById('chase-chaser-label');
        if (!runnerLabel || !chaserLabel) return;

        const list = this.getAliveParticipants();
        const pair = this.getDefaultPair(list);
        this.uiPair = pair;

        if (!pair) {
            runnerLabel.textContent = '전투 참여자가 없습니다.';
            chaserLabel.textContent = '전투 참여자가 없습니다.';
            return;
        }

        const runnerChar = this.findChar(pair.runnerRef.teamKey, pair.runnerRef.charId);
        const chaserChar = this.findChar(pair.chaserRef.teamKey, pair.chaserRef.charId);

        runnerLabel.textContent = `${this.teamLabel(pair.runnerRef.teamKey)} - ${runnerChar?.name || ''}`.trim();
        chaserLabel.textContent = `${this.teamLabel(pair.chaserRef.teamKey)} - ${chaserChar?.name || ''}`.trim();
    }

    parseSelectValue(value) {
        const s = String(value || '');
        const [teamKey, charId] = s.split(':');
        if (!teamKey || !charId) return null;
        return { teamKey, charId };
    }

    findChar(teamKey, charId) {
        const bs = this.app?.battleSystem;
        const list = bs?.combatCharacters?.[teamKey] || [];
        return list.find((c) => String(c?.id) === String(charId)) || null;
    }

    startFromUi() {
        const gapInput = document.getElementById('chase-gap');
        const autoMiniCb = document.getElementById('chase-auto-mini');
        const boardInput = document.getElementById('chase-board');

        const runnerRef = this.uiPair?.runnerRef;
        const chaserRef = this.uiPair?.chaserRef;
        if (!runnerRef || !chaserRef) {
            this.app?.showToast?.('전투 참여자 정보를 찾지 못했습니다. 전투를 먼저 시작해주세요.', 'warning');
            return;
        }

        const boardSize = Math.max(5, Math.min(12, Math.floor(Number(boardInput?.value) || 8)));
        const initialGap = Math.max(1, Math.min(boardSize - 2, Math.floor(Number(gapInput?.value) || 2)));
        const autoMini = !!autoMiniCb?.checked;

        this.start({ runner: runnerRef, chaser: chaserRef, boardSize, initialGap, autoMini });
    }

    start({ runner, chaser, boardSize = 8, initialGap = 2, autoMini = false } = {}) {
        const runnerChar = this.findChar(runner.teamKey, runner.charId);
        const chaserChar = this.findChar(chaser.teamKey, chaser.charId);
        if (!runnerChar || !chaserChar) {
            this.app?.showToast?.('전투 참여자 정보를 찾지 못했습니다. 전투를 먼저 시작해주세요.', 'warning');
            return;
        }

        const bs = this.app.battleSystem;
        const runnerAgi = typeof bs.getEffectiveStat === 'function' ? bs.getEffectiveStat(runnerChar, 'agility') : Number(runnerChar.agility || 3);
        const chaserAgi = typeof bs.getEffectiveStat === 'function' ? bs.getEffectiveStat(chaserChar, 'agility') : Number(chaserChar.agility || 3);

        let turn = 'runner';
        if (chaserAgi > runnerAgi) turn = 'chaser';
        if (chaserAgi === runnerAgi) {
            // 동률이면 d100 굴려 낮은 숫자가 선공
            const r1 = this.rollD100();
            const r2 = this.rollD100();
            turn = r2 < r1 ? 'chaser' : 'runner';
        }

        this.state = {
            boardSize,
            initialGap,
            autoMini,
            runner: { ...runner, char: runnerChar },
            chaser: { ...chaser, char: chaserChar },
            pos: { chaser: 0, runner: Math.min(boardSize - 1, initialGap) },
            turn,
            steps: 0,
            log: [],
            finished: false,
            outcome: 'ONGOING',
            winnerKey: null,
            loserKey: null,
            miniCombatUsed: false
        };

        this.pushLog('🏃 도주 이벤트(술래잡기) 시작');
        this.pushLog(`- 보드: ${boardSize}칸 / 시작 거리: ${initialGap}칸`);
        this.pushLog(`- 도망자: ${runnerChar.name} (${this.teamLabel(runner.teamKey)}) / 술래: ${chaserChar.name} (${this.teamLabel(chaser.teamKey)})`);
        this.pushLog(`- 선공: ${turn === 'runner' ? runnerChar.name : chaserChar.name}`);

        this.render();
    }

    reset() {
        this.state = null;
        this.render();
    }

    teamLabel(teamKey) {
        if (teamKey === 'hero') return '히어로';
        if (teamKey === 'gov') return '정부';
        if (teamKey === 'villain') return '빌런';
        return teamKey;
    }

    rollD100() {
        return Math.floor(Math.random() * 100) + 1;
    }

    agilityTargetFromStat(stat1to5) {
        const s = Math.max(1, Math.min(5, Math.round(Number(stat1to5) || 3)));
        // 스탯→목표치: 1=50, 2=55, 3=60, 4=65, 5=70
        return 45 + (s * 5);
    }

    classifyAgility(roll, target) {
        // d100 4단 성공 등급 + 실패/대실패
        // - 대성공(CRITICAL): 1
        // - 극단적 성공(EXTREME): 기준치의 20% 이하
        // - 어려운 성공(HARD): 기준치의 50% 이하
        // - 보통 성공(SUCCESS): 기준치 이하
        // - 대실패(FUMBLE): 100 또는 (target < 50 이면서 96~100)
        // - 실패(FAIL): 그 외 실패
        if (roll === 1) return 'CRITICAL';

        const fumble = (roll === 100) || (target < 50 && roll >= 96);
        if (fumble) return 'FUMBLE';

        if (roll > target) return 'FAIL';
        if (roll <= target * 0.2) return 'EXTREME';
        if (roll <= target * 0.5) return 'HARD';
        return 'SUCCESS';
    }

    outcomeLabel(outcome) {
        switch (outcome) {
            case 'CRITICAL':
                return '대성공';
            case 'EXTREME':
                return '극단적 성공';
            case 'HARD':
                return '어려운 성공';
            case 'SUCCESS':
                return '보통 성공';
            case 'FUMBLE':
                return '대실패';
            case 'FAIL':
            default:
                return '실패';
        }
    }

    moveDelta(outcome) {
        if (outcome === 'CRITICAL') return 2;
        if (outcome === 'EXTREME') return 1;
        if (outcome === 'HARD') return 1;
        if (outcome === 'SUCCESS') return 1;
        if (outcome === 'FUMBLE') return -1;
        return 0;
    }

    async rollStep() {
        const s = this.state;
        if (!s) {
            this.app?.showToast?.('도주 이벤트를 먼저 시작해주세요.', 'info');
            return;
        }

        const bs = this.app?.battleSystem;
        const actorKey = s.turn;
        const actor = actorKey === 'runner' ? s.runner : s.chaser;
        const actorChar = actor?.char;
        if (!actorChar) return;

        const agi = typeof bs.getEffectiveStat === 'function' ? bs.getEffectiveStat(actorChar, 'agility') : Number(actorChar.agility || 3);
        const target = this.agilityTargetFromStat(agi);
        const roll = this.rollD100();
        const outcome = this.classifyAgility(roll, target);
        const delta = this.moveDelta(outcome);

        const before = s.pos[actorKey];
        const after = Math.max(0, Math.min(s.boardSize - 1, before + delta));
        s.pos[actorKey] = after;
        s.steps += 1;

        this.pushLog(`🎲 ${actorChar.name} 민첩 판정: ${roll} / ${target} → ${this.outcomeLabel(outcome)} (${delta > 0 ? `+${delta}` : String(delta)}칸)`);

        // 결과 체크
        const res = this.checkOutcome();
        if (res.status !== 'ONGOING') {
            await this.finish(res);
            this.render();
            return;
        }

        // 턴 교대
        s.turn = actorKey === 'runner' ? 'chaser' : 'runner';
        this.render();
    }

    checkOutcome() {
        const s = this.state;
        if (!s) return { status: 'NONE' };
        if (s.pos.chaser >= s.pos.runner) {
            return { status: 'CAUGHT' };
        }
        if (s.pos.runner >= s.boardSize - 1) {
            return { status: 'ESCAPED' };
        }
        return { status: 'ONGOING' };
    }

    async finish(result) {
        const s = this.state;
        if (!s) return;

        const runner = s.runner;
        const chaser = s.chaser;

        s.finished = true;
        s.outcome = result.status;

        if (result.status === 'CAUGHT') {
            this.pushLog(`🪝 따라잡힘! ${chaser.char.name} → ${runner.char.name}`);
            s.winnerKey = 'chaser';
            s.loserKey = 'runner';
            this.showFxBanner('잡았다!', 'CAUGHT');
        }

        if (result.status === 'ESCAPED') {
            this.pushLog(`🏁 도주 성공! ${runner.char.name}이(가) 거리를 벌렸습니다.`);
            s.winnerKey = 'runner';
            s.loserKey = 'chaser';
            this.showFxBanner('도망갔다!', 'ESCAPED');
        }

        this.pushLog('✅ 도주 이벤트 종료');

        if (s.autoMini) {
            await this.runMiniCombat();
        } else {
            this.pushLog('⚔️ 원하면 [미니 공격 2회] 버튼을 눌러 후속 공격을 진행하세요.');
        }
    }

    showFxBanner(text, kind) {
        const el = document.getElementById('chase-fx-banner');
        if (!el) return;

        el.classList.remove('is-escaped', 'is-caught');
        if (kind === 'ESCAPED') el.classList.add('is-escaped');
        if (kind === 'CAUGHT') el.classList.add('is-caught');

        el.textContent = String(text || '');
        el.style.display = 'block';

        if (this._fxTimer) {
            clearTimeout(this._fxTimer);
        }
        this._fxTimer = setTimeout(() => {
            el.style.display = 'none';
        }, 2000);
    }

    getAttackStat(char) {
        const bs = this.app?.battleSystem;
        if (typeof bs?.getEffectiveStat === 'function') {
            return Number(bs.getEffectiveStat(char, 'attack')) || 1;
        }
        return Number(char?.attack ?? char?.atk ?? 1) || 1;
    }

    async runMiniCombat() {
        const s = this.state;
        if (!s) return;
        if (!s.finished || !s.winnerKey || !s.loserKey) {
            this.app?.showToast?.('도주 이벤트가 종료된 뒤에만 미니 공격을 진행할 수 있어요.', 'info');
            return;
        }
        if (s.miniCombatUsed) {
            this.app?.showToast?.('미니 공격은 이미 진행되었습니다.', 'info');
            return;
        }

        const bs = this.app?.battleSystem;
        const winner = s.winnerKey === 'runner' ? s.runner : s.chaser;
        const loser = s.loserKey === 'runner' ? s.runner : s.chaser;
        if (!winner?.char || !loser?.char) return;

        s.miniCombatUsed = true;

        this.pushLog(`⚔️ 미니 공격 2회 시작 (반격/회피 없음): ${winner.char.name} → ${loser.char.name}`);

        for (let i = 0; i < 2; i++) {
            const atkStat = Math.max(1, Math.min(5, Math.round(this.getAttackStat(winner.char) || 1)));
            const target = this.agilityTargetFromStat(atkStat); // 1~5 → 50~70
            const roll = this.rollD100();

            const outcome = this.classifyAgility(roll, target);
            const isHit = outcome !== 'FAIL' && outcome !== 'FUMBLE';
            const isGreat = outcome === 'CRITICAL';

            if (!isHit) {
                this.pushLog(`🎯 미니 공격 ${i + 1}/2: 판정 ${roll}/${target} → 빗나감`);
                continue;
            }

            const damage = isGreat ? 3 : (1 + Math.floor(Math.random() * 3)); // 1~3
            const before = typeof bs?.getTotalHp === 'function'
                ? bs.getTotalHp(loser.char)
                : Math.max(0, Math.round(Number(loser.char.hp) || 0));

            if (typeof bs?.applyDamageWithShield === 'function') {
                bs.applyDamageWithShield(loser.char, damage);
            } else {
                loser.char.hp = Math.max(0, Math.round(Number(loser.char.hp) || 0) - damage);
            }

            const after = typeof bs?.getTotalHp === 'function'
                ? bs.getTotalHp(loser.char)
                : Math.max(0, Math.round(Number(loser.char.hp) || 0));

            this.pushLog(`💥 미니 공격 ${i + 1}/2: 판정 ${roll}/${target} → 적중 (${this.outcomeLabel(outcome)}) 피해 ${damage} (HP ${before} → ${after})`);
        }

        // 전투 UI 동기화
        try {
            bs?.checkBattleEnd?.();
            bs?.renderBattle?.();
            bs?.updateSkillSlots?.();
        } catch (e) {
            console.warn('미니 공격 후 UI 갱신 실패:', e);
        }

        this.render();
    }

    pushLog(line) {
        const s = this.state;
        if (!s) return;
        s.log.push(String(line));

        const logEl = document.getElementById('chase-log');
        if (logEl) {
            // textarea 기준
            logEl.value = s.log.join('\n');
            logEl.scrollTop = logEl.scrollHeight;
        }

        // 전투 로그에도 같이 남김(원하면 나중에 옵션화)
        this.app?.battleSystem?.addLog?.(String(line));
    }

    buildBoardText() {
        const s = this.state;
        if (!s) return '';

        const cells = Array.from({ length: s.boardSize }, () => []);
        cells[s.pos.chaser].push('V');
        const runnerLabel = s.runner?.teamKey === 'gov' ? 'G' : 'H';
        cells[s.pos.runner].push(runnerLabel);

        return cells
            .map((arr) => (arr.length === 0 ? '-' : arr.join('')))
            .join(' ');
    }

    renderBoard() {
        const s = this.state;
        const board = document.getElementById('chase-board-view');
        if (!board) return;

        const size = s?.boardSize || 8;
        const chaserPos = s?.pos?.chaser ?? -1;
        const runnerPos = s?.pos?.runner ?? -1;
        const runnerLabel = s?.runner?.teamKey === 'gov' ? 'G' : 'H';

        board.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;

        board.innerHTML = '';
        for (let i = 0; i < size; i++) {
            const cell = document.createElement('div');
            cell.className = 'chase-cell';

            const idx = document.createElement('div');
            idx.className = 'chase-cell-index';
            idx.textContent = String(i + 1);

            const tokens = document.createElement('div');
            tokens.className = 'chase-tokens';

            if (i === runnerPos) {
                const t = document.createElement('span');
                t.className = 'chase-token runner';
                t.textContent = runnerLabel;
                tokens.appendChild(t);
            }
            if (i === chaserPos) {
                const t = document.createElement('span');
                t.className = 'chase-token chaser';
                t.textContent = 'V';
                tokens.appendChild(t);
            }

            // 아무도 없으면 빈칸(레이아웃 유지)
            if (tokens.childNodes.length === 0) {
                const t = document.createElement('span');
                t.className = 'chase-token';
                t.style.opacity = '0.35';
                t.textContent = '-';
                tokens.appendChild(t);
            }

            cell.appendChild(idx);
            cell.appendChild(tokens);

            if (i === chaserPos && i === runnerPos) cell.classList.add('is-caught');
            if (i === size - 1) cell.classList.add('is-goal');

            board.appendChild(cell);
        }
    }

    render() {
        this.init();

        const s = this.state;
        const status = document.getElementById('chase-status');
        const rollBtn = document.getElementById('chase-roll');
        const miniBtn = document.getElementById('chase-mini-attack');
        const logEl = document.getElementById('chase-log');

        if (!s) {
            if (status) status.textContent = '도망자/술래를 선택하고 시작하세요.';
            if (rollBtn) rollBtn.disabled = true;
            if (miniBtn) miniBtn.disabled = true;
            if (logEl) logEl.value = '';
            this.renderBoard();
            return;
        }

        const actor = s.turn === 'runner' ? s.runner.char : s.chaser.char;
        if (s.finished) {
            if (status) status.textContent = `종료됨: ${s.outcome === 'ESCAPED' ? '도주 성공' : '따라잡힘'}`;
            if (rollBtn) rollBtn.disabled = true;
        } else {
            if (status) status.textContent = `현재 차례: ${actor.name} (${s.turn === 'runner' ? '도망자' : '술래'})`;
            if (rollBtn) rollBtn.disabled = false;
        }

        if (miniBtn) {
            miniBtn.disabled = !(s.finished && !s.miniCombatUsed && s.winnerKey && s.loserKey);
        }

        if (logEl) {
            logEl.value = s.log.join('\n');
            logEl.scrollTop = logEl.scrollHeight;
        }

        this.renderBoard();
    }
}

window.ChaseEvent = ChaseEvent;
