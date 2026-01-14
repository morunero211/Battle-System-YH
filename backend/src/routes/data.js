const express = require('express');
const { PrismaClient } = require('@prisma/client');
const {
  zCharacterCreate,
  zCharacterSkillAdd,
  zCharacterItemAdd,
  zSkillCreate,
  zItemCreate,
  zRuleSetCreate
} = require('../schemas/validationSchemas');
const { z } = require('zod');

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// 캐릭터 API
// ============================================

/**
 * POST /characters
 * 캐릭터 생성
 */
router.post('/', async (req, res) => {
  try {
    const validated = zCharacterCreate.parse(req.body);

    const character = await prisma.character.create({
      data: {
        name: validated.name,
        faction: validated.faction,
        atk: validated.atk,
        def: validated.def,
        agi: validated.agi,
        skillStat: validated.skillStat,
        maxHp: validated.maxHp,
        currentHp: validated.maxHp
      }
    });

    res.status(201).json({
      message: '캐릭터가 생성되었습니다',
      character
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('캐릭터 생성 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /characters
 * 캐릭터 목록 조회
 */
router.get('/', async (req, res) => {
  try {
    const characters = await prisma.character.findMany({
      include: {
        characterSkills: {
          include: { skill: true }
        },
        characterItems: {
          include: { item: true }
        }
      }
    });

    res.json(characters);
  } catch (error) {
    console.error('캐릭터 목록 조회 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 스킬 API (특정 경로 우선)
// ============================================

/**
 * POST /skills
 * 스킬 생성
 */
router.post('/skills', async (req, res) => {
  try {
    const validated = zSkillCreate.parse(req.body);

    const skill = await prisma.skill.create({
      data: {
        name: validated.name,
        category: validated.category,
        targetScope: validated.targetScope,
        effects: validated.effects
      }
    });

    res.status(201).json({
      message: '스킬이 생성되었습니다',
      skill
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('스킬 생성 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /skills
 * 스킬 목록 조회
 */
router.get('/skills', async (req, res) => {
  try {
    const skills = await prisma.skill.findMany();
    res.json(skills);
  } catch (error) {
    console.error('스킬 목록 조회 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 아이템 API (특정 경로 우선)
// ============================================

/**
 * POST /items
 * 아이템 생성
 */
router.post('/items', async (req, res) => {
  try {
    const validated = zItemCreate.parse(req.body);

    const item = await prisma.item.create({
      data: {
        name: validated.name,
        description: validated.description || null,
        type: validated.type
      }
    });

    res.status(201).json({
      message: '아이템이 생성되었습니다',
      item
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('아이템 생성 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /items
 * 아이템 목록 조회
 */
router.get('/items', async (req, res) => {
  try {
    const items = await prisma.item.findMany();
    res.json(items);
  } catch (error) {
    console.error('아이템 목록 조회 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RuleSet API (특정 경로 우선)
// ============================================

/**
 * POST /rulesets
 * RuleSet 생성 (운영자용)
 */
router.post('/rulesets', async (req, res) => {
  try {
    const validated = zRuleSetCreate.parse(req.body);

    const ruleSet = await prisma.ruleSet.create({
      data: {
        name: validated.name,
        damageTable: validated.damageTable,
        blockTable: validated.blockTable,
        healTable: validated.healTable,
        supportTable: validated.supportTable,
        isActive: validated.isActive || false
      }
    });

    res.status(201).json({
      message: 'RuleSet이 생성되었습니다',
      ruleSet
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('RuleSet 생성 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /rulesets
 * RuleSet 목록 조회
 */
router.get('/rulesets', async (req, res) => {
  try {
    const ruleSets = await prisma.ruleSet.findMany();
    res.json(ruleSets);
  } catch (error) {
    console.error('RuleSet 목록 조회 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /rulesets/:id
 * RuleSet 상세 조회
 */
router.get('/rulesets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const ruleSet = await prisma.ruleSet.findUnique({
      where: { id }
    });

    if (!ruleSet) {
      return res.status(404).json({ error: 'RuleSet을 찾을 수 없습니다' });
    }

    res.json(ruleSet);
  } catch (error) {
    console.error('RuleSet 조회 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /rulesets/:id/activate
 * RuleSet 활성화
 */
router.patch('/rulesets/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;

    // 모든 RuleSet deactivate
    await prisma.ruleSet.updateMany({
      data: { isActive: false }
    });

    // 해당 RuleSet activate
    const ruleSet = await prisma.ruleSet.update({
      where: { id },
      data: { isActive: true }
    });

    res.json({
      message: 'RuleSet이 활성화되었습니다',
      ruleSet
    });
  } catch (error) {
    console.error('RuleSet 활성화 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 캐릭터 상세 API (파라미터 경로는 마지막)
// ============================================

/**
 * GET /characters/:id
 * 캐릭터 상세 조회
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const character = await prisma.character.findUnique({
      where: { id },
      include: {
        characterSkills: {
          include: { skill: true }
        },
        characterItems: {
          include: { item: true }
        }
      }
    });

    if (!character) {
      return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });
    }

    res.json(character);
  } catch (error) {
    console.error('캐릭터 조회 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /characters/:id/skills
 * 캐릭터에 스킬 추가
 */
router.post('/:id/skills', async (req, res) => {
  try {
    const { id: characterId } = req.params;
    const validated = zCharacterSkillAdd.parse(req.body);

    // 캐릭터 존재 확인
    const character = await prisma.character.findUnique({
      where: { id: characterId }
    });

    if (!character) {
      return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });
    }

    // 스킬 존재 확인
    const skill = await prisma.skill.findUnique({
      where: { id: validated.skillId }
    });

    if (!skill) {
      return res.status(404).json({ error: '스킬을 찾을 수 없습니다' });
    }

    const charSkill = await prisma.characterSkill.create({
      data: {
        characterId,
        skillId: validated.skillId,
        maxUses: validated.maxUses || null,
        remainingUses: validated.maxUses || 999 // 무제한이면 999
      },
      include: { skill: true }
    });

    res.status(201).json({
      message: '스킬이 추가되었습니다',
      characterSkill: charSkill
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('스킬 추가 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /characters/:id/items
 * 캐릭터에 아이템 추가
 */
router.post('/:id/items', async (req, res) => {
  try {
    const { id: characterId } = req.params;
    const validated = zCharacterItemAdd.parse(req.body);

    // 캐릭터 존재 확인
    const character = await prisma.character.findUnique({
      where: { id: characterId }
    });

    if (!character) {
      return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' });
    }

    // 아이템 존재 확인
    const item = await prisma.item.findUnique({
      where: { id: validated.itemId }
    });

    if (!item) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다' });
    }

    // 이미 보유 중인 아이템이면 quantity 증가
    const existingCharItem = await prisma.characterItem.findUnique({
      where: {
        characterId_itemId: {
          characterId,
          itemId: validated.itemId
        }
      }
    });

    let charItem;
    if (existingCharItem) {
      charItem = await prisma.characterItem.update({
        where: { id: existingCharItem.id },
        data: { quantity: existingCharItem.quantity + validated.quantity },
        include: { item: true }
      });
    } else {
      charItem = await prisma.characterItem.create({
        data: {
          characterId,
          itemId: validated.itemId,
          quantity: validated.quantity
        },
        include: { item: true }
      });
    }

    res.status(201).json({
      message: '아이템이 추가되었습니다',
      characterItem: charItem
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('아이템 추가 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
