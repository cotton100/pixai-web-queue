# 공식 API 연결 검사

`../check-official-api.cmd`를 실행하고 새 콘솔에 API 키를 붙여 넣은 뒤 Enter를 누릅니다. 화면에는 별표만 표시하며 키를 파일·로그에 저장하지 않습니다.

공식 REST `GET https://api.pixai.art/v1/task/2064707131934430374` 한 번만 호출합니다. 이 ID는 이전에 웹 대기열에서 생성돼 중지 상태로 남아 있던 작업입니다. 새 생성·재생성·취소·다운로드·웹 대기열 변경은 하지 않습니다. 키는 PixAI API에 인증 헤더로만 보내며 리디렉션·쿠키·자동 재시도는 사용하지 않습니다.

결과는 Git 제외 `test-output/official-api-probe.json`에 상태·작업 ID·이미지 개수만 저장합니다. 키·프롬프트·이미지 URL·서버 오류 원문은 제외합니다.

- `task_read`: 해당 작업 조회 성공. 그 조회에 인증이 통했고 웹 작업이 공식 API에 보인다는 근거입니다. Tsubaki.3의 API 새 생성·LoRA·과금·이미지 저장까지 검증한 것은 아닙니다.
- `not_found`: 404. 키 유효성이나 웹 작업 조회 가능 여부를 확인하지 못했습니다. 작업 ID를 추측해 반복 조회하거나 생성하지 않습니다.
- `unauthorized` / `forbidden`: 인증·권한 오류. 키를 채팅에 보내지 않고 발급 계정·권한을 확인합니다.
- `network_error` / `rate_limited`: 자동 재시도 없이 중단합니다.

검사: `node --check tools/api-probe.cjs`, `node --test verify-api-probe.cjs` (5/5 통과).
공식 문서: https://platform.pixai.art/en/docs/api/task/getTask

2026-10-08 실조회: 사용자가 로컬 콘솔에 키를 입력한 뒤 HTTP 200·`task_read`·`completed`·미디어 1개·이미지 URL 1개를 확인했습니다. 기존 웹 작업 1건의 공식 API 조회만 검증했습니다. 새 생성·다운로드는 실행하지 않았습니다.

웹훅은 아직 만들지 않습니다. 로컬 실행에서는 활성 작업에 대해 여유 있는 간격(5~10초)으로 조회하면 됩니다. 공개 callback URL·서버 수신 구현은 상시 서버 작업이 필요해질 때 결정합니다. 현재 도구는 반복 조회도 하지 않습니다.
