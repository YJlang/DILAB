# DILAB (딜랩)

> 임상순 교수님 연구실의 가칭 MVP 프로젝트. 싱클리(Syncly)를 벤치마킹하여, **전문가 리뷰 DB + 벡터 DB + RAG**로 차별화된 신뢰성 있는 제품 평가 서비스를 만드는 것이 목표입니다.

## 한눈에 보기

- **상태**: 1단계(벤치마킹 리서치) 완료 → 2단계(MVP PRD) 준비 중
- **타임라인**: 협력사 대표의 정부 R&D 과제 일정에 맞춤
- **협업 방식**: Claude Code + 공유 skill 기반 AI 보조 워크플로
- **언어**: 한국어

## 핵심 문서

| 파일 | 용도 |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | 프로젝트 컨텍스트·정책 (Claude Code가 자동 로드) |
| [`PLAN.MD`](PLAN.MD) | 교수님과의 대화 원문 (수정 금지) |
| [`benchmark/syncly-benchmark.md`](benchmark/syncly-benchmark.md) | 싱클리 벤치마킹 보고서 (33소스, 약 14,000자) |
| [`benchmark/sources.md`](benchmark/sources.md) | 인용 레지스트리 (품질 게이트 통과) |
| [`docs/CLAUDE_CODE_SETUP.md`](docs/CLAUDE_CODE_SETUP.md) | 신규 팀원용 환경 설정 가이드 |
| [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) | skill·subagent 사용 가이드 |

## 빠른 시작 (신규 팀원)

```text
1) docs/CLAUDE_CODE_SETUP.md 를 따라 Claude Code + 필수 skill 설치
2) 저장소 클론 후 디렉토리 열기
3) Claude Code 실행 → CLAUDE.md 가 자동 로드되어 컨텍스트가 동기화됨
4) benchmark/syncly-benchmark.md 일독으로 1단계 결과 파악
5) docs/AGENT_WORKFLOW.md 의 시점별 skill 선택 표 참고하여 본인 작업 시작
```

## 절대 규칙 (자세한 내용은 `CLAUDE.md`)

- **싱클리 UX/UI 시각적 모방 금지** — MVP가 타사에 활용될 수 있어 시각 유사성 회피 필수.
- **출처 검증** — 모든 시간민감 주장에는 `AS_OF` 명시, 공식 1차 출처 우선.
- **개인 권한 파일 공유 금지** — `.claude/settings.local.json`은 `.gitignore` 처리됨.

## 현재 단계 산출물 요약

- 싱클리 12개 핵심 기능 카탈로그
- 데이터 수집 채널 분류 (이커머스·소셜·CS 도구 등 15+)
- AI/ML 스택: MongoDB Atlas Vector Search 확인, LLM은 외부 API 추정
- 가격: Pro 75만원~/월, Enterprise 견적, 무료 체험 약 1주 (영업 컨택 필수)
- DILAB vs Syncly 갭 분석 → MVP 포함/다음/제외 3분류

## 다음 단계 예정

1. `product-management-workflows` skill로 DILAB MVP PRD 작성
2. 갭 분석 기반 P0/P1/P2 기능 우선순위 확정
3. 오현 학생과 분담 영역 정리
