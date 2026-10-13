# 배포 안내

설치·업데이트 URL은 main의 pixai-web-queue.user.js입니다. 수정한 코드와 버전을 GitHub에 반영해야 Tampermonkey가 업데이트를 확인합니다. 실행 중인 PixAI 페이지의 코드는 새로고침 뒤 교체됩니다.

## 안정판과 개발판

| 브랜치 | 용도 |
|---|---|
| `main` | 배포용 안정판·기존 설치/자동 업데이트·GitHub 기본 브랜치 |
| `develop` | 기능 개발·수정·검증 |

일반 개발은 `develop`에서 진행합니다. 두 브랜치에 push하거나 이 브랜치들을 대상으로 PR을 열면 **Checks / Build and tests**가 빌드 동기화·구문·전체 회귀 검사를 실행합니다. Node.js 24를 사용하며 외부 npm 패키지를 설치하지 않습니다. CI에는 실제 API 키·유료 생성·개인 자료가 필요하지 않습니다.

개발이 끝나면 검사 결과와 필요한 리뷰를 확인하고 **사용자가 승인한 배포 범위**를 `develop → main` PR로 반영합니다. 실험 변경이 함께 있다면 승인된 변경만 별도 브랜치로 골라 PR을 만듭니다. main 병합 후 공개 설치 URL과 버전을 확인합니다. 검사 통과가 자동 배포를 뜻하지 않으며 자동 병합·게시 작업은 없습니다. develop의 스크립트도 업데이트 주소는 main을 가리키므로 별도 개발판 자동 업데이트 채널로 배포하지 않습니다.

브랜치 보호 규칙은 별도 GitHub 설정입니다. 이 분리와 자동 검사만으로 직접 main push를 차단하지는 않습니다.

## 배포 순서

1. 작업 시작 전에 이 저장소에서 git status --short --branch를 확인합니다.
2. 스크립트를 수정하고 @version과 패널 제목의 버전을 함께 올립니다. package.json의 version도 맞춥니다.
3. 모듈을 고쳤다면 `node tools/build-userscript.cjs`로 단일 스크립트에 반영합니다. `node tools/build-userscript.cjs --check`, `node --check pixai-web-queue.user.js`와 package.json test의 전체 검사 목록을 실행합니다(npm이 있으면 npm test).
4. 승인된 배포 범위의 변경 파일을 확인하고 commit/push합니다. preserved/, test-output/, 인증값과 사용자 출력물은 올리지 않습니다.
5. raw 설치 URL에 게시된 버전과 코드가 로컬과 일치하는지 확인합니다.
6. Tampermonkey가 업데이트를 확인하면 사용자의 PixAI 탭을 새로고침합니다.

@name과 @namespace는 기존 설치 항목을 식별하므로 유지합니다. 같은 이름의 두 스크립트를 동시에 켜두지 않습니다. 실제 사이트/과금/폴더 검증을 하지 않았다면 모의 테스트 통과와 구분해 기록합니다.

0.10.1은 조합 예약의 접기 그룹·선택 요약·접기 상태 기억을 추가합니다. 빌드·구문·전체433/433 검사와 독립 코드 리뷰(gpt-6-astra)를 확인했습니다. Chrome 합성 자료의 일반 패널·640×800 패널에서 제목줄 요약·키보드 토글·새로고침 복원·가로 넘침 없음을 확인했습니다. 실제 PixAI의 Tampermonkey 환경·Firefox·유료 API는 이번 변경에서 미검증입니다. 사용자 키·개인 자료·유료 API는 사용하지 않았습니다. 빌드된 스크립트의 GPL 전문과 저장소 LICENSE·출처 고지를 함께 유지하세요. 내부 요청서·검사 로그·로컬 전용 디자인/설명 자료는 공개하지 않습니다.
