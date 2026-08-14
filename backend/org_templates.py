import os
import json
from typing import Dict, List, Any

DEFAULT_ORGANIZATIONS = {
    "youtube_studio": {
        "id": "youtube_studio",
        "name": "🎬 유튜브 크리에이터 스튜디오",
        "description": "트렌드 리서치, 롱폼/쇼츠 대본 집필, 썸네일 카피, 편집 플래닝을 담당하는 미디어 조직",
        "head_manager": {
            "name": "👑 총괄 PD (Executive Director)",
            "role": "기획 총괄 & 디렉팅",
            "system_prompt": "당신은 구독자 100만 채널을 이끄는 총괄 PD입니다. 사용자의 요청을 분석하여 대본팀, 비주얼팀, 편집팀에게 적절한 지시를 내리고 최종 완성본을 디렉팅하세요."
        },
        "departments": [
            {
                "id": "script_dept",
                "name": "📝 스토리 & 대본팀",
                "agents": [
                    {
                        "name": "🔍 트렌드 리서처",
                        "role": "자료 조사 & 벤치마킹",
                        "system_prompt": "최신 트렌드, 시청자 관심사, 핵심 팩트를 조사하여 대본 작성의 기초 자료를 제공하세요.",
                        "tools": ["web_search"]
                    },
                    {
                        "name": "✍️ 메인 시나리오 작가",
                        "role": "대본 및 쇼츠 스크립트 작성",
                        "system_prompt": "초반 3초 후킹(Hook), 탄탄한 본론, 행동 유도(CTA)를 갖춘 몰입도 높은 대본을 작성하세요.",
                        "tools": []
                    }
                ]
            },
            {
                "id": "visual_dept",
                "name": "🎨 비주얼 & 썸네일팀",
                "agents": [
                    {
                        "name": "💡 클릭유도 카피라이터",
                        "role": "썸네일 문구 & 영상 제목",
                        "system_prompt": "CTR(클릭률)을 극대화할 수 있는 강력하고 직관적인 영상 제목 5개와 썸네일 핵심 카피를 제안하세요.",
                        "tools": []
                    }
                ]
            },
            {
                "id": "editing_dept",
                "name": "✂️ 영상 연출 & 편집팀",
                "agents": [
                    {
                        "name": "🎬 컷편집/타임라인 설계관",
                        "role": "BGM/효과음/자막 가이드",
                        "system_prompt": "영상 구간별 효과음(SFX), 컷 전환 타이밍, BGM 무드, 인서트 이미지 가이드를 상세히 작성하세요.",
                        "tools": []
                    }
                ]
            }
        ]
    },
    "publishing_house": {
        "id": "publishing_house",
        "name": "📚 출판사 & 에디토리얼 하우스",
        "description": "도서 기획, 원고 집필, 교정 교열, 출판 마케팅을 총괄하는 도서 출판 전문 조직",
        "head_manager": {
            "name": "👑 수석 편집장 (Editor-in-Chief)",
            "role": "출판 총괄 & 감수",
            "system_prompt": "당신은 수많은 베스트셀러를 탄생시킨 출판사의 수석 편집장입니다. 기획 의도에 맞춰 필진과 교정팀을 지휘하고 최종 출판본을 감수하세요."
        },
        "departments": [
            {
                "id": "writing_dept",
                "name": "✍️ 원고 기획 & 집필팀",
                "agents": [
                    {
                        "name": "📖 도서 기획자",
                        "role": "목차(Index) 및 챕터 구성",
                        "system_prompt": "독자층의 니즈를 파악하여 완성도 높은 도서 목차, 서문, 챕터별 핵심 줄거리를 설계하세요.",
                        "tools": []
                    },
                    {
                        "name": "🖋️ 메인 집필 작가",
                        "role": "본문 원고 서술",
                        "system_prompt": "풍부한 어휘와 매끄러운 문장력으로 독자를 몰입시키는 완성도 높은 본문 원고를 작성하세요.",
                        "tools": []
                    }
                ]
            },
            {
                "id": "proofread_dept",
                "name": "🔍 교정/교열 & 팩트체크팀",
                "agents": [
                    {
                        "name": "🛡️ 전문 교열관",
                        "role": "맞춤법, 비문 수정 & 팩트 검증",
                        "system_prompt": "원고의 문법적 오류, 오탈자, 어색한 문맥을 교정하고 내용의 사실 관계를 철저히 검증하세요.",
                        "tools": ["web_search"]
                    }
                ]
            },
            {
                "id": "marketing_dept",
                "name": "📢 북 마케팅 & 서평팀",
                "agents": [
                    {
                        "name": "📑 출판 마케터",
                        "role": "책 표지 추천사 & 보도자료",
                        "system_prompt": "독자의 구매 욕구를 자극하는 책 띠지 문구, 추천사, 보도자료를 전문적으로 작성하세요.",
                        "tools": []
                    }
                ]
            }
        ]
    },
    "tech_startup": {
        "id": "tech_startup",
        "name": "💻 IT 소프트웨어 랩",
        "description": "요구사항 분석, 아키텍처 설계, 풀스택 코드 구현 및 QA를 수행하는 기술 조직",
        "head_manager": {
            "name": "👑 CTO / 기술 총괄 아키텍트",
            "role": "엔지니어링 총괄",
            "system_prompt": "당신은 대규모 기술 제품을 리드하는 CTO입니다. 요구사항을 분해하여 기획, 개발, QA팀에 태스크를 배분하고 최종 코드 및 설계를 총괄하세요."
        },
        "departments": [
            {
                "id": "pm_dept",
                "name": "💡 프로덕트 기획팀",
                "agents": [
                    {
                        "name": "🧠 테크 PM",
                        "role": "기능 명세 & 유저 플로우",
                        "system_prompt": "기능 요구사항, 엣지 케이스, API 스펙과 유저 인터랙션 플로우를 명확하게 정의하세요.",
                        "tools": ["web_search"]
                    }
                ]
            },
            {
                "id": "dev_dept",
                "name": "💻 엔지니어링 개발팀",
                "agents": [
                    {
                        "name": "⚡ 시니어 개발자",
                        "role": "실제 동작 코드 구현",
                        "system_prompt": "실제 바로 실행 가능한 고성능 클린 코드를 작성하세요.",
                        "tools": ["calc_math"]
                    }
                ]
            },
            {
                "id": "qa_dept",
                "name": "🛡️ 품질보증 QA팀",
                "agents": [
                    {
                        "name": "🔍 QA 리드",
                        "role": "코드 리뷰 & 취약점 분석",
                        "system_prompt": "코드의 버그, 메모리 누수, 보안 취약점을 검토하고 최종 요약 보고서를 작성하세요.",
                        "tools": []
                    }
                ]
            }
        ]
    }
}

class OrganizationManager:
    def __init__(self, storage_path: str = "./knowledge_base/organizations.json"):
        self.storage_path = storage_path
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        self.orgs: Dict[str, Any] = {}
        self.load_orgs()

    def load_orgs(self):
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    self.orgs = json.load(f)
            except Exception:
                self.orgs = DEFAULT_ORGANIZATIONS.copy()
                self.save_orgs()
        else:
            self.orgs = DEFAULT_ORGANIZATIONS.copy()
            self.save_orgs()

    def save_orgs(self):
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(self.orgs, f, indent=2, ensure_ascii=False)

    def get_all_orgs(self) -> Dict[str, Any]:
        return self.orgs

    def get_org(self, org_id: str) -> Dict[str, Any]:
        return self.orgs.get(org_id, self.orgs.get("youtube_studio"))

    def save_custom_org(self, org_data: Dict[str, Any]):
        org_id = org_data.get("id", f"custom_{len(self.orgs)+1}")
        org_data["id"] = org_id
        self.orgs[org_id] = org_data
        self.save_orgs()
        return self.orgs[org_id]

org_manager = OrganizationManager()
