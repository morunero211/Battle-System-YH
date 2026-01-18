/**
 * 모달 관리자 (Modal Manager)
 * 캐릭터 생성/수정 모달 관련 기능 진입점
 *
 * 현재는 `BattleApp`가 실제 구현(단일 진실원천)이며,
 * 이 클래스는 레거시 호출부/다른 모듈을 위해 얇은 래퍼로 유지합니다.
 */

class ModalManager {
    constructor(app) {
        this.app = app;
    }

    /**
     * 캐릭터 추가 모달 열기
     */
    openAddCharacterModal(teamIndex) {
        return this.app.openAddCharacterModal(teamIndex);
    }

    /**
     * 캐릭터 수정 모달 열기
     */
    openEditCharacterModal(teamIndex, charId) {
        return this.app.openEditCharacterModal(teamIndex, charId);
    }

    /**
     * 모달 닫기
     */
    closeModal() {
        return this.app.closeModal();
    }

    /**
     * 커스텀 폼 초기화
     */
    clearCustomForm() {
        return this.app.clearCustomForm();
    }

    /**
     * 커스텀 캐릭터 저장
     */
    saveCustomCharacter() {
        return this.app.saveCustomCharacter();
    }

    /**
     * 캐릭터 삭제
     */
    deleteCharacter() {
        return this.app.deleteCharacter();
    }
}
