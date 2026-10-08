# NAIS3 참고·개조 조건

2026-10-08 확인. 대상은 `sunanakgo/NAIS3`와 로컬 PixAIS 원본 `C:\owo\00AI_works\00_common\00_shared\git\PixAIS`의 HEAD `35d41e7`입니다. README·package.json·LICENSE는 GPL-3.0입니다. 이번 작업에서 PixAIS 제품 코드는 수정하지 않았습니다.

근거: [NAIS3 LICENSE](https://github.com/sunanakgo/NAIS3/blob/main/LICENSE), [원문](https://raw.githubusercontent.com/sunanakgo/NAIS3/main/LICENSE)의 GPLv3 2·4·5·6절.

- 개인용 수정·실행으로 타인에게 배포하지 않으면 소스를 인터넷에 공개할 의무는 없습니다(2절).
- 코드를 가져와 수정한 버전을 배포하면 원저작권·라이선스·무보증 표시를 유지하고 GPL 전문을 제공합니다(4절).
- 변경 사실·날짜를 표시하고 파생 앱 전체를 GPLv3로 제공합니다(5절).
- 실행 파일을 배포하면 해당 버전의 수정 소스와 필요한 빌드·설치 스크립트를 제공해야 합니다(6절). 같은 릴리스에 소스·라이선스를 붙이는 방식이 명확합니다. API 키·개인 라이브러리·출력물은 소스에 넣지 않습니다.
- 원저작자는 프로젝트의 저작자 정보(sunanakgo)를 유지합니다. LICENSE 안의 FSF 표시는 GPL 라이선스 문서 자체의 저작권이므로 앱 저작자 표시와 혼동하지 않습니다. 개별 의존성·아이콘의 기존 고지도 유지합니다.
- 일반 작업 흐름을 참고해 독립 구현하는 것과 NAIS 코드를 가져오는 것은 구분합니다. 현재 스크립트의 공식 API 변경에는 NAIS 코드를 복사하지 않았습니다. 이후 앱에서 NAIS 코드를 재사용하면 위 조건을 적용합니다.

PixAI API 이용 조건과 NAIS 코드 라이선스는 별개입니다. 앱 이름·설정/DB·출력 경로를 PixAIS로 분리해 기존 NAIS와 병행 사용합니다.
