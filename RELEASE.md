# 배포 안내

설치·업데이트 URL은 main의 pixai-web-queue.user.js입니다. 수정한 코드와 버전을 GitHub에 반영해야 Tampermonkey가 업데이트를 확인합니다. 실행 중인 PixAI 페이지의 코드는 새로고침 뒤 교체됩니다.

1. 작업 시작 전에 이 저장소에서 git status --short --branch를 확인합니다.
2. 스크립트를 수정하고 @version과 패널 제목의 버전을 함께 올립니다. package.json의 version도 맞춥니다.
3. node --check pixai-web-queue.user.js와 node --test verify.cjs verify-ui.cjs verify-trigger.cjs verify-backup.cjs verify-backup-storage.cjs verify-drag.cjs를 실행합니다(npm이 있으면 npm test).
4. 승인된 배포 범위의 변경 파일을 확인하고 commit/push합니다. preserved/, test-output/, 인증값과 사용자 출력물은 올리지 않습니다.
5. raw 설치 URL에 게시된 버전과 코드가 로컬과 일치하는지 확인합니다.
6. Tampermonkey가 업데이트를 확인하면 사용자의 PixAI 탭을 새로고침합니다.

@name과 @namespace는 기존 설치 항목을 식별하므로 유지합니다. 같은 이름의 두 스크립트를 동시에 켜두지 않습니다. 실제 사이트/과금/폴더 검증을 하지 않았다면 모의 테스트 통과와 구분해 기록합니다.
