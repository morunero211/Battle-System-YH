const express = require('express');
const { PrismaClient } = require('@prisma/client');
const battleEngine = require('../services/battleEngine');
const {
  zBattleCreate,
  zBattleAction,
  zBattleResponse,
    zBattleEnd,
    zBattleSimulate
} = require('../schemas/validationSchemas');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

function clampStat(stat) {
    const n = Number(stat);
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(5, Math.round(n)));
}

function gradeLabel(grade) {
    switch (grade) {
        case 'EXTREME':
            return '익스트림';
        case 'HARD':
            return '하드';
        case 'SUCCESS':
            return '성공';
        case 'FAIL':
        default:
            return '실패';
    }
}

// ============================================
// 전투 API
// ============================================

/**
 * POST /battles/simulate
 * 프론트 단발 전투 시뮬레이션 (현재는 1회 공격만)
 * 응답: { log: string[], defenderHp: number }
 */
router.post('/simulate', async (req, res) => {
    try {
        const validated = zBattleSimulate.parse(req.body);

        const attacker = validated.attacker || {};
        const defender = validated.defender || {};
        const response = validated.response || 'PASS';

        const attackerName = attacker.name || '공격자';
        const defenderName = defender.name || '방어자';

        const attackerChar = {
            atk: clampStat(attacker.atk ?? attacker.attack),
            def: clampStat(attacker.def ?? attacker.defense ?? 1),
            agi: clampStat(attacker.agi ?? attacker.agility ?? 1),
            skillStat: clampStat(attacker.skillStat ?? attacker.skill ?? 1),
            name: attackerName
        };

        const defenderMaxHp = Number.isFinite(Number(defender.maxHp)) ? Math.max(1, Math.round(Number(defender.maxHp))) : 100;
        const defenderHp = Number.isFinite(Number(defender.hp)) ? Math.max(0, Math.round(Number(defender.hp))) : defenderMaxHp;
        const defenderChar = {
            atk: clampStat(defender.atk ?? 1),
            def: clampStat(defender.def ?? defender.defense ?? 1),
            agi: clampStat(defender.agi ?? defender.agility ?? 1),
            skillStat: clampStat(defender.skillStat ?? 1),
            maxHp: defenderMaxHp,
            name: defenderName
        };

        const ruleSet = await battleEngine.getActiveRuleSetOrDefault();
        const battle = { ruleSet };

        const result = battleEngine.executeBasicAttack({
            battle,
            attacker: { id: 'sim_attacker' },
            defender: { id: 'sim_defender' },
            attackerChar,
            defenderChar,
            response
        });

        const log = [];
        log.push(`\n⚔️ ${attackerName} → ${defenderName} 공격!`);
        log.push(`  🎯 공격 판정: ${result.attackJudgment.roll} / ${result.attackJudgment.threshold} (${gradeLabel(result.attackJudgment.grade)})`);

        if (result.defenseJudgment) {
            const label = response === 'DODGE' ? '회피' : '반격';
            log.push(`  🛡️ ${label} 판정: ${result.defenseJudgment.roll} / ${result.defenseJudgment.threshold} (${gradeLabel(result.defenseJudgment.grade)})`);
        }

        if (result.countered) {
            log.push(`  ↩️ 반격 성공! ${attackerName}이(가) ${result.counterDamage} 데미지!`);
            return res.json({
                log,
                defenderHp
            });
        }

        if (result.dodged) {
            log.push(`  💨 회피 성공! 데미지 없음`);
            return res.json({
                log,
                defenderHp
            });
        }

        if (!result.success) {
            log.push(`  ❌ 공격 실패!`);
            return res.json({
                log,
                defenderHp
            });
        }

        const nextHp = Math.max(0, defenderHp - result.damage);
        if (result.blocked) {
            log.push(`  🧱 방어: ${result.block} (원데미지 ${result.rawDamage} → 실제 ${result.damage})`);
        }
        log.push(`  💥 데미지: ${result.damage}`);
        log.push(`  💚 ${defenderName} HP: ${defenderHp} → ${nextHp}`);

        return res.json({
            log,
            defenderHp: nextHp
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        console.error('전투 시뮬레이션 오류:', error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * POST /battles
 * 전투 생성
 */
router.post('/', async (req, res) => {
    try {
        // 입력 검증
        const validated = zBattleCreate.parse(req.body);
        const { characterIds, teams, ruleSetId } = validated;

        // characterIds와 teams 길이 확인
        if (characterIds.length !== teams.length) {
            return res.status(400).json({
                error: 'characterIds와 teams의 길이가 일치해야 합니다'
            });
        }

        // RuleSet 존재 여부 확인
        const ruleSet = await prisma.ruleSet.findUnique({
            where: { id: ruleSetId }
        });

        if (!ruleSet) {
            return res.status(404).json({ error: 'RuleSet을 찾을 수 없습니다' });
        }

        // 캐릭터 정보 조회
        const characters = await prisma.character.findMany({
            where: { id: { in: characterIds } }
        });

        if (characters.length !== characterIds.length) {
            return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });
        }

        // 전투 생성
        const battle = await prisma.battle.create({
            data: {
                status: 'IN_PROGRESS',
                phase: 'TURN_ACTION',
                turnNo: 1,
                ruleSetId,
                participants: {
                    create: characterIds.map((charId, idx) => {
                        const character = characters.find(c => c.id === charId);
                        return {
                            characterId: charId,
                            teamIndex: teams[idx],
                            startHp: character.maxHp,
                            hp: character.maxHp,
                            isAlive: true,
                            initiativeOrder: 999 // 임시값, 계산 후 업데이트
                        };
                    })
                }
            },
            include: {
                participants: {
                    include: { character: true }
                },
                ruleSet: true
            }
        });

        // 이니셔티브 순서 계산
        const initiativeOrder = battleEngine.calculateInitiativeOrder(
            battle.participants
        );

        // 참가자의 initiativeOrder 업데이트
        await Promise.all(
            initiativeOrder.map(({ participantId, order }) =>
                prisma.battleParticipant.update({
                    where: { id: participantId },
                    data: { initiativeOrder: order }
                })
            )
        );

        // 첫 턴 주인 설정 (가장 먼저 행동)
        const firstTurnOwner = initiativeOrder[0].participantId;
        await prisma.battle.update({
            where: { id: battle.id },
            data: { turnOwnerParticipantId: firstTurnOwner }
        });

        const updatedBattle = await prisma.battle.findUnique({
            where: { id: battle.id },
            include: {
                participants: {
                    include: { character: true }
                },
                ruleSet: true
            }
        });

        res.status(201).json({
            message: '전투가 생성되었습니다',
            battle: updatedBattle
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        console.error('전투 생성 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /battles/:id
 * 전투 상세 조회
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const battle = await prisma.battle.findUnique({
            where: { id },
            include: {
                participants: {
                    include: {
                        character: {
                            include: {
                                characterSkills: {
                                    include: { skill: true }
                                },
                                characterItems: {
                                    include: { item: true }
                                }
                            }
                        }
                    },
                    orderBy: { initiativeOrder: 'asc' }
                },
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 20
                },
                ruleSet: true
            }
        });

        if (!battle) {
            return res.status(404).json({ error: '전투를 찾을 수 없습니다' });
        }

        res.json(battle);
    } catch (error) {
        console.error('전투 조회 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /battles/:id/actions
 * 전투 액션 실행 (공격/스킬/아이템)
 */
router.post('/:id/actions', async (req, res) => {
    try {
        const { id: battleId } = req.params;

        // 입력 검증
        const validated = zBattleAction.parse(req.body);
        const { action, participantId } = validated;

        // 전투 조회
        const battle = await prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: {
                    include: { character: true }
                },
                ruleSet: true
            }
        });

        if (!battle) {
            return res.status(404).json({ error: '전투를 찾을 수 없습니다' });
        }

        // 전투 진행 중 확인
        if (battle.status !== 'IN_PROGRESS') {
            return res.status(400).json({ error: '진행 중인 전투가 아닙니다' });
        }

        // 턴 주인 확인
        if (battle.turnOwnerParticipantId !== participantId) {
            return res.status(403).json({ error: '이 참가자의 턴이 아닙니다' });
        }

        const actor = battle.participants.find(p => p.id === participantId);

        if (!actor) {
            return res.status(404).json({ error: '참가자를 찾을 수 없습니다' });
        }

        let logPayload = {
            actor: participantId,
            action,
            turnNo: battle.turnNo
        };

        // 액션별 처리
        if (action === 'BASIC_ATTACK') {
            const { targetParticipantId } = validated;

            const target = battle.participants.find(p => p.id === targetParticipantId);
            if (!target) {
                return res.status(404).json({ error: '대상을 찾을 수 없습니다' });
            }

            // 상태 변경: TURN_ACTION → AWAITING_REACTION
            await prisma.battle.update({
                where: { id: battleId },
                data: { phase: 'AWAITING_REACTION' }
            });

            logPayload.target = targetParticipantId;

            res.json({
                message: '기본 공격을 선택했습니다. 방어자의 응답을 기다리는 중...',
                battle: { id: battleId, phase: 'AWAITING_REACTION' },
                action: logPayload
            });
        } else if (action === 'USE_SKILL') {
            const { skillId, targetParticipantIds } = validated;

            // 캐릭터가 이 스킬을 가지고 있는지 확인
            const charSkill = await prisma.characterSkill.findUnique({
                where: {
                    characterId_skillId: {
                        characterId: actor.characterId,
                        skillId
                    }
                },
                include: { skill: true }
            });

            if (!charSkill) {
                return res.status(404).json({ error: '캐릭터가 이 스킬을 가지지 않았습니다' });
            }

            if (charSkill.remainingUses <= 0) {
                return res.status(400).json({ error: '스킬 사용 횟수가 부족합니다' });
            }

            // 스킬 사용 횟수 감소
            await prisma.characterSkill.update({
                where: { id: charSkill.id },
                data: { remainingUses: charSkill.remainingUses - 1 }
            });

            // 스킬 결과 계산
            const targets = battle.participants.filter(p =>
                targetParticipantIds.includes(p.id)
            );

            const skillResults = battleEngine.executeSkill({
                skill: charSkill.skill,
                caster: actor,
                targets,
                battle
            });

            // 공격 스킬이면 방어 응답 대기
            if (charSkill.skill.category === 'ATTACK') {
                await prisma.battle.update({
                    where: { id: battleId },
                    data: { phase: 'AWAITING_DEFENSE_SKILL' }
                });
            } else {
                // 다른 스킬은 턴 넘김
                // TODO: 다음 턴 주인으로 변경
            }

            logPayload.skill = skillId;
            logPayload.targets = targetParticipantIds;
            logPayload.results = skillResults;

            res.json({
                message: `${charSkill.skill.name}을(를) 사용했습니다`,
                action: logPayload
            });
        } else if (action === 'USE_ITEM') {
            const { itemId, targetParticipantId } = validated;

            const target = battle.participants.find(p => p.id === targetParticipantId);
            if (!target) {
                return res.status(404).json({ error: '대상을 찾을 수 없습니다' });
            }

            // 캐릭터가 이 아이템을 가지고 있는지 확인
            const charItem = await prisma.characterItem.findUnique({
                where: {
                    characterId_itemId: {
                        characterId: actor.characterId,
                        itemId
                    }
                },
                include: { item: true }
            });

            if (!charItem || charItem.quantity <= 0) {
                return res.status(400).json({ error: '아이템이 부족합니다' });
            }

            // 아이템 사용 횟수 감소
            await prisma.characterItem.update({
                where: { id: charItem.id },
                data: { quantity: charItem.quantity - 1 }
            });

            const itemResult = battleEngine.executeItem({
                item: charItem.item,
                target
            });

            logPayload.item = itemId;
            logPayload.target = targetParticipantId;
            logPayload.result = itemResult;

            res.json({
                message: `${charItem.item.name}을(를) 사용했습니다`,
                action: logPayload
            });
        }

        // 액션 로그 저장
        await prisma.battleLog.create({
            data: {
                battleId,
                turnNo: battle.turnNo,
                type: 'ACTION',
                payload: logPayload
            }
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        console.error('액션 실행 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /battles/:id/responses
 * 전투 응답 (회피/반격/방어스킬/패스)
 */
router.post('/:id/responses', async (req, res) => {
    try {
        const { id: battleId } = req.params;

        // 입력 검증
        const validated = zBattleResponse.parse(req.body);
        const { response, participantId } = validated;

        // 전투 조회
        const battle = await prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: {
                    include: { character: true }
                },
                logs: {
                    where: { turnNo: battleId },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                ruleSet: true
            }
        });

        if (!battle) {
            return res.status(404).json({ error: '전투를 찾을 수 없습니다' });
        }

        // 응답 페이즈 확인
        if (!['AWAITING_REACTION', 'AWAITING_DEFENSE_SKILL'].includes(battle.phase)) {
            return res.status(400).json({ error: '응답할 수 없는 상태입니다' });
        }

        const defender = battle.participants.find(p => p.id === participantId);

        if (!defender) {
            return res.status(404).json({ error: '참가자를 찾을 수 없습니다' });
        }

        let logPayload = {
            defender: participantId,
            response,
            turnNo: battle.turnNo
        };

        // 응답별 처리
        if (response === 'DODGE') {
            // 회피 응답
            logPayload.dodgeJudgment = 'PROCESSING';

            // 상태 변경: AWAITING_REACTION → TURN_ACTION (턴 넘김)
            // TODO: 다음 턴 주인으로 변경
        } else if (response === 'COUNTER') {
            // 반격 응답
            logPayload.counterJudgment = 'PROCESSING';

            // 상태 변경: AWAITING_REACTION → TURN_ACTION (턴 넘김)
            // TODO: 다음 턴 주인으로 변경
        } else if (response === 'DEFENSE_SKILL') {
            const { skillId } = validated;

            // 캐릭터가 이 방어 스킬을 가지고 있는지 확인
            const charSkill = await prisma.characterSkill.findUnique({
                where: {
                    characterId_skillId: {
                        characterId: defender.characterId,
                        skillId
                    }
                },
                include: { skill: true }
            });

            if (!charSkill || charSkill.skill.category !== 'DEFENSE') {
                return res.status(404).json({ error: '방어 스킬을 찾을 수 없습니다' });
            }

            if (charSkill.remainingUses <= 0) {
                return res.status(400).json({ error: '스킬 사용 횟수가 부족합니다' });
            }

            // 스킬 사용 횟수 감소
            await prisma.characterSkill.update({
                where: { id: charSkill.id },
                data: { remainingUses: charSkill.remainingUses - 1 }
            });

            logPayload.skill = skillId;
            logPayload.skillName = charSkill.skill.name;

            // 상태 변경: AWAITING_DEFENSE_SKILL → TURN_ACTION (턴 넘김)
            // TODO: 다음 턴 주인으로 변경
        } else if (response === 'PASS') {
            // 패스 응답
            logPayload.passed = true;

            // 상태 변경: AWAITING_REACTION → TURN_ACTION (턴 넘김)
            // TODO: 다음 턴 주인으로 변경
        }

        // 응답 로그 저장
        await prisma.battleLog.create({
            data: {
                battleId,
                turnNo: battle.turnNo,
                type: 'RESPONSE',
                payload: logPayload
            }
        });

        res.json({
            message: '응답이 기록되었습니다',
            response: logPayload
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        console.error('응답 실행 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /battles/:id/end
 * 타임아웃으로 전투 종료
 */
router.post('/:id/end', async (req, res) => {
    try {
        const { id: battleId } = req.params;

        // 입력 검증
        const validated = zBattleEnd.parse(req.body);

        // 전투 조회
        const battle = await prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: true,
                ruleSet: true
            }
        });

        if (!battle) {
            return res.status(404).json({ error: '전투를 찾을 수 없습니다' });
        }

        if (battle.status !== 'IN_PROGRESS') {
            return res.status(400).json({ error: '진행 중인 전투가 아닙니다' });
        }

        // 타임아웃 승리 판정
        const result = battleEngine.judgeTimeoutVictory(battle);

        // 전투 종료
        const updatedBattle = await prisma.battle.update({
            where: { id: battleId },
            data: {
                status: 'FINISHED',
                phase: 'FINISHED',
                endReason: 'TIMEOUT',
                endedAt: new Date(),
                resultSummary: result
            },
            include: {
                participants: true
            }
        });

        // 결과 로그 저장
        await prisma.battleLog.create({
            data: {
                battleId,
                turnNo: battle.turnNo,
                type: 'END',
                payload: {
                    reason: 'TIMEOUT',
                    result
                }
            }
        });

        res.json({
            message: '전투가 타임아웃으로 종료되었습니다',
            battle: updatedBattle,
            result
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ errors: error.errors });
        }
        console.error('전투 종료 오류:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
