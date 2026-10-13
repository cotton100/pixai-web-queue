# PixAI userscript 작업 지침

이 폴더는 PixAI 웹 대기열 유저스크립트 저장소다. 데스크톱 앱은 별도 저장소이므로 이 작업에서 수정하지 않는다. 상위 작업공간 지침도 함께 따른다.

## 브랜치

- `main`: 배포용 안정판. 기존 설치·자동 업데이트 URL과 GitHub 기본 브랜치를 유지한다.
- `develop`: 기능 개발·수정·검증용. 일반 코드 작업은 이 브랜치에서 시작한다. 현재 브랜치를 확인하고, 미커밋 작업이 있으면 먼저 소유자와 상태를 확인한다.
- `develop` 변경은 검사와 필요한 리뷰 후 사용자가 승인한 배포 범위만 PR로 `main`에 반영한다. 브랜치 분리나 검사 통과만으로 배포 승인을 추정하지 않는다.
- 사용자가 요청하지 않은 commit/push/merge와 기본 브랜치 변경은 하지 않는다. 개발 작업 중 `main`을 자동 갱신하지 않는다.

## 구현·검증

- README.md, RELEASE.md, package.json과 변경 대상 파일을 먼저 읽는다.
- 모듈을 바꾸면 `node tools/build-userscript.cjs`로 단일 스크립트에 반영한다.
- `npm test`가 빌드 동기화·구문·전체 회귀 검사를 실행한다. Node.js 24를 사용하며 별도 npm 패키지 설치는 필요 없다.
- 실제 PixAI/Tampermonkey·Firefox·이미지 저장·유료 생성 확인은 모의 검사와 구분한다. API 키·사용자 자료를 읽거나 생성 비용을 쓰는 테스트는 별도 사용자 승인이 필요하다.
- 로컬 전용 디자인·설명 자료, preserved/, test-output/, 키·개인 출력물은 게시하지 않는다. 변경 파일을 명시해 스테이징하고 일괄 `git add .`를 사용하지 않는다.
- 배포할 때만 버전을 올리고 스크립트 헤더·패널·백업/확인용 버전·package.json을 맞춘다. `@name`, `@namespace`, main을 가리키는 `@updateURL`/`@downloadURL`은 유지한다.

브랜치별 검사는 GitHub Actions가 실행한다. 별도 GitHub 보호 규칙이 없으면 직접 main에 push하는 동작을 기술적으로 차단하지는 않는다.
