-- CreateEnum
CREATE TYPE "Faction" AS ENUM ('HERO', 'GOVERNMENT', 'VILLAIN');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('ATTACK', 'DEFENSE', 'HEAL', 'SUPPORT');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "BattlePhase" AS ENUM ('TURN_ACTION', 'AWAITING_REACTION', 'AWAITING_DEFENSE_SKILL', 'FINISHED');

-- CreateEnum
CREATE TYPE "EndReason" AS ENUM ('HP_ZERO', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "BattleLogType" AS ENUM ('ACTION', 'RESPONSE', 'END', 'RESULT');

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faction" "Faction" NOT NULL,
    "atk" INTEGER NOT NULL,
    "def" INTEGER NOT NULL,
    "agi" INTEGER NOT NULL,
    "skillStat" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "currentHp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL,
    "targetScope" TEXT NOT NULL,
    "effects" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterSkill" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "maxUses" INTEGER,
    "remainingUses" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterItem" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "damageTable" JSONB NOT NULL,
    "blockTable" JSONB NOT NULL,
    "healTable" JSONB NOT NULL,
    "supportTable" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "status" "BattleStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "phase" "BattlePhase" NOT NULL DEFAULT 'TURN_ACTION',
    "turnNo" INTEGER NOT NULL DEFAULT 1,
    "ruleSetId" TEXT NOT NULL,
    "turnOwnerParticipantId" TEXT,
    "endReason" "EndReason",
    "endedAt" TIMESTAMP(3),
    "resultSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleParticipant" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "teamIndex" INTEGER NOT NULL,
    "startHp" INTEGER NOT NULL,
    "hp" INTEGER NOT NULL,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "initiativeOrder" INTEGER NOT NULL,

    CONSTRAINT "BattleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleLog" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "turnNo" INTEGER NOT NULL,
    "type" "BattleLogType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Character_faction_idx" ON "Character"("faction");

-- CreateIndex
CREATE INDEX "CharacterSkill_characterId_idx" ON "CharacterSkill"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSkill_characterId_skillId_key" ON "CharacterSkill"("characterId", "skillId");

-- CreateIndex
CREATE INDEX "CharacterItem_characterId_idx" ON "CharacterItem"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterItem_characterId_itemId_key" ON "CharacterItem"("characterId", "itemId");

-- CreateIndex
CREATE INDEX "RuleSet_isActive_idx" ON "RuleSet"("isActive");

-- CreateIndex
CREATE INDEX "Battle_status_idx" ON "Battle"("status");

-- CreateIndex
CREATE INDEX "BattleParticipant_battleId_teamIndex_idx" ON "BattleParticipant"("battleId", "teamIndex");

-- CreateIndex
CREATE INDEX "BattleParticipant_battleId_initiativeOrder_idx" ON "BattleParticipant"("battleId", "initiativeOrder");

-- CreateIndex
CREATE INDEX "BattleLog_battleId_turnNo_idx" ON "BattleLog"("battleId", "turnNo");

-- AddForeignKey
ALTER TABLE "CharacterSkill" ADD CONSTRAINT "CharacterSkill_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterSkill" ADD CONSTRAINT "CharacterSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterItem" ADD CONSTRAINT "CharacterItem_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterItem" ADD CONSTRAINT "CharacterItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleLog" ADD CONSTRAINT "BattleLog_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
