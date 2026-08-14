# 🧠 LM Studio Orchestrator & Local Agent Studio

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![LM Studio](https://img.shields.io/badge/LM_Studio-Compatible-6366F1?style=flat-square)](https://lmstudio.ai)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python)](https://www.python.org)

LM Studio(OpenAI-compatible local server `http://localhost:1234/v1`)와 실시간 연동되어, 로컬 LLM을 기반으로 **노드형 비주얼 에이전트 캔버스**, **멀티 에이전트 릴레이/토론 오케스트레이션**, **로컬 문서 RAG 지식베이스**, **파인튜닝 데이터셋 & Unsloth LoRA 스크립트 빌더**를 지원하는 모던 풀스택 웹 애플리케이션입니다.

---

## 🌟 핵심 기능

### 1. 🕸️ 노드 기반 비주얼 에이전트 캔버스 (Visual Agent Canvas)
- 마우스 드래그 & 드롭으로 에이전트 노드를 자유롭게 배치하고 베지에 곡선으로 파이프라인 흐름을 시각적으로 설계합니다.
- `➕ 에이전트 추가` 및 `▶ 워크플로우 실행`으로 다단계 협업 파이프라인을 원클릭으로 가동합니다.

### 2. 👥 멀티 에이전트 실시간 오케스트레이터 (SSE 스트리밍)
- **🔗 순차 릴레이 모드**: `🧠 수석 기획자` (설계) ➔ `💻 시니어 개발자` (코드 구현) ➔ `🔍 QA 리드` (품질 검토 & 요약) 순으로 릴레이 협업하여 고품질 결과물을 생성합니다.
- **⚔️ 토론 아레나 모드**: 찬성/아이디어 기획자 vs 비판/보안 검증자가 턴을 주고받으며 토론한 후, `총괄 심판(Judge)`이 최적의 종합 결론을 도출합니다.

### 3. 📚 로컬 문서 RAG 지식베이스 매니저 (Local Document RAG)
- TXT, Markdown, Python/JS 코드, JSON 문서를 업로드하면 **지능형 청킹(Smart Chunking)** 및 **코사인 유사도 벡터 인덱싱**을 수행합니다.
- 질의 시 `📚 RAG 문서 참조`를 체크하면 지식베이스에서 가장 관련성 높은 문서 청크를 자동으로 추출하여 프롬프트에 주입(Augment)합니다.

### 4. 🧪 파인튜닝 데이터셋 & Unsloth LoRA 스크립트 빌더
- 수집된 에이전트 결과물을 **Alpaca**, **ShareGPT**, **OpenAI JSONL** 포맷으로 원클릭 내보내기할 수 있습니다.
- **`⚡ Unsloth 학습 스크립트 생성`** 버튼을 누르면 로컬 GPU에서 바로 실행할 수 있는 초고속 LoRA 파인튜닝 Python 스크립트를 자동 생성합니다.

---

## 🚀 빠른 시작 (Quick Start)

### 1. 사전 요구사항
- Python 3.10 이상
- [LM Studio](https://lmstudio.ai/) 설치 및 실행

### 2. 설치 및 실행
```bash
# 1. 레포지토리 클론
git clone https://github.com/logosjaeuk/lm-studio-orchestrator.git
cd lm-studio-orchestrator

# 2. 의존성 설치
pip install -r backend/requirements.txt

# 3. 서버 실행
python run.py
```

브라우저에서 **`http://localhost:8000`** 접속!

---

## 🔌 LM Studio 연결 방법
1. **LM Studio** 앱 실행 ➔ 좌측 **Local Server (`<->`)** 탭 이동
2. 로드할 모델 선택 후 **`Start Server` (포트 `1234`)** 클릭
3. 웹앱([http://localhost:8000](http://localhost:8000)) 접속 시 좌측 상단이 **초록색 [LM Studio 온라인]**으로 자동 연결됩니다!
