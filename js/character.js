/**
 * Character.js - 캐릭터 클래스 정의
 * 각 캐릭터의 스탯과 상태를 관리하는 클래스입니다.
 */

class Character {
    /**
     * 캐릭터 생성자
     * @param {string} name - 캐릭터 이름
     * @param {number} hp - 체력 (최대값도 동일)
     * @param {number} attack - 공격력 (1~100)
     * @param {number} defense - 방어력 (0~100)
     * @param {number} agility - 민첩 (0~100, %)
     * @param {number} criticalRate - 크리티컬확률 (0~100, %)
     */
    constructor(name, hp, attack, defense, agility, criticalRate) {
        this.name = name;
        this.maxHp = hp;
        this.currentHp = hp;
        this.attack = attack;
        this.defense = defense;
        // 민첩(기존 회피율) - 저장된 데이터 호환을 위해 null/undefined 시 0으로 처리
        this.agility = agility ?? 0;
        this.criticalRate = criticalRate;
        
        // 전투 상태
        this.isDefending = false;     // 방어 중인지 여부
        this.isUsingUltimate = false; // 궁극기 사용 중인지 여부
        this.isAlive = true;          // 살아있는지 여부
    }

    /**
     * 캐릭터 정보를 JSON 형식으로 반환 (저장/로드용)
     * @returns {object} 캐릭터 정보
     */
    toJSON() {
        return {
            name: this.name,
            hp: this.maxHp,
            attack: this.attack,
            defense: this.defense,
            agility: this.agility,
            criticalRate: this.criticalRate
        };
    }

    /**
     * 캐릭터 정보를 문자열로 반환 (표시용)
     * @returns {string} 캐릭터 정보 문자열
     */
    getDisplayInfo() {
        return `${this.name} | HP: ${this.currentHp}/${this.maxHp} | 공격: ${this.attack} | 방어: ${this.defense} | 민첩: ${this.agility} | 크리: ${this.criticalRate}%`;
    }

    /**
     * 캐릭터 정보를 간단히 반환
     * @returns {string} 축약된 캐릭터 정보
     */
    getShortInfo() {
        return `${this.name} (HP: ${this.currentHp}/${this.maxHp})`;
    }

    /**
     * 피해를 입힌다
     * HP: 전원 100, 50 깎이면 전투 불능, 50 이상일 때 0까지 사망
     * @param {number} damage - 받을 피해량
     * @returns {number} 실제 받은 피해량
     */
    takeDamage(damage) {
        // 방어 중이면 피해 감소 (50%)
        let actualDamage = this.isDefending ? damage * 0.5 : damage;
        
        // 최소 피해 0
        actualDamage = Math.max(0, actualDamage);
        
        this.currentHp -= actualDamage;
        
        // HP가 50 이상이면 50까지 내려가야 함 (전투 불능 경계)
        if (this.currentHp < 0) {
            this.currentHp = 0;
        }
        
        // 전투 불능 판정: HP가 50 이하
        if (this.currentHp <= 50) {
            this.isAlive = false;
        }
        
        return actualDamage;
    }

    /**
     * 체력을 회복한다
     * @param {number} amount - 회복량
     */
    heal(amount) {
        const oldHp = this.currentHp;
        this.currentHp = Math.min(this.currentHp + amount, this.maxHp);
        return this.currentHp - oldHp; // 실제 회복된 양 반환
    }

    /**
     * 현재 체력 비율 반환 (0~1)
     * @returns {number} 체력 비율
     */
    getHpPercent() {
        return this.currentHp / this.maxHp;
    }

    /**
     * 방어 상태 설정
     */
    setDefending() {
        this.isDefending = true;
    }

    /**
     * 방어 상태 해제
     */
    clearDefending() {
        this.isDefending = false;
    }

    /**
     * 턴 종료 (상태 리셋)
     */
    endTurn() {
        // 방어 상태는 1턴만 유지되므로 턴 종료 시 해제
        this.isDefending = false;
        this.isUsingUltimate = false;
    }

    /**
     * 캐릭터가 살아있는지 확인
     * @returns {boolean} 살아있으면 true
     */
    isAliveCheck() {
        return this.isAlive && this.currentHp > 0;
    }
}

/**
 * 캐릭터 데이터로부터 Character 객체 생성
 * @param {object} data - 캐릭터 데이터
 * @returns {Character} 생성된 Character 객체
 */
function createCharacterFromData(data) {
    return new Character(
        data.name,
        data.hp,
        data.attack,
        data.defense,
        // 구버전 데이터 호환 (evadeRate -> agility)
        data.agility ?? data.evadeRate,
        data.criticalRate
    );
}

/**
 * 여러 캐릭터 데이터로부터 Character 객체 배열 생성
 * @param {array} dataArray - 캐릭터 데이터 배열
 * @returns {array} Character 객체 배열
 */
function createCharactersFromData(dataArray) {
    return dataArray.map(data => createCharacterFromData(data));
}
