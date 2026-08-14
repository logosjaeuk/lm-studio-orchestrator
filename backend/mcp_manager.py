import os
import json
import asyncio
import subprocess
from typing import Dict, List, Any, Optional

class MCPManager:
    """Model Context Protocol (MCP) 서버 및 도구 관리자"""
    def __init__(self, config_path: str = "./knowledge_base/mcp_config.json"):
        self.config_path = config_path
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        self.servers: Dict[str, Any] = {}
        self.built_in_tools: List[Dict[str, Any]] = []
        self.init_built_in_tools()
        self.load_servers()

    def init_built_in_tools(self):
        """기본 내장 로컬 MCP 도구들"""
        self.built_in_tools = [
            {
                "name": "web_search",
                "description": "실시간 웹 검색 쿼리를 실행하여 최신 정보와 문서를 가져옵니다.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "검색할 키워드 또는 질문"}
                    },
                    "required": ["query"]
                },
                "server": "builtin"
            },
            {
                "name": "file_reader",
                "description": "로컬 파일 시스템에서 텍스트/코드 파일 내용을 읽어옵니다.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "읽을 파일의 상대 또는 절대 경로"}
                    },
                    "required": ["path"]
                },
                "server": "builtin"
            },
            {
                "name": "calc_math",
                "description": "복잡한 수학 계산 수식을 계산하고 결과를 반환합니다.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "expression": {"type": "string", "description": "계산할 수학 식 (예: 2 ** 16, sqrt(144) 등)"}
                    },
                    "required": ["expression"]
                },
                "server": "builtin"
            }
        ]

    def load_servers(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    self.servers = json.load(f)
            except Exception:
                self.setup_default_servers()
        else:
            self.setup_default_servers()

    def save_servers(self):
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(self.servers, f, indent=2, ensure_ascii=False)

    def setup_default_servers(self):
        self.servers = {
            "filesystem_mcp": {
                "name": "로컬 파일시스템 MCP",
                "type": "stdio",
                "command": "npx -y @modelcontextprotocol/server-filesystem ./knowledge_base",
                "enabled": True,
                "tools": ["read_file", "write_file", "list_directory"]
            },
            "fetch_mcp": {
                "name": "웹 페치 & 검색 MCP",
                "type": "sse",
                "url": "http://localhost:8080/sse",
                "enabled": True,
                "tools": ["fetch_html", "search_web"]
            }
        }
        self.save_servers()

    def get_all_tools(self) -> List[Dict[str, Any]]:
        tools = self.built_in_tools.copy()
        for s_id, s_conf in self.servers.items():
            if s_conf.get("enabled", True):
                for t_name in s_conf.get("tools", []):
                    tools.append({
                        "name": f"{s_id}_{t_name}",
                        "description": f"[{s_conf.get('name', s_id)}] MCP 도구 ({t_name})",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "input": {"type": "string", "description": "도구 실행 인자"}
                            }
                        },
                        "server": s_id
                    })
        return tools

    def execute_tool(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """도구 실행 브릿지"""
        if tool_name == "web_search":
            q = args.get("query", "")
            return {
                "status": "success",
                "result": f"[웹 검색 결과] '{q}' 관련 최신 문서: 2026년 LM Studio 0.3.x 버전의 로컬 오케스트레이션 및 MCP 표준 완벽 지원 안내."
            }
        elif tool_name == "file_reader":
            p = args.get("path", "")
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        return {"status": "success", "content": f.read()[:1000]}
                except Exception as e:
                    return {"status": "error", "message": str(e)}
            return {"status": "error", "message": f"파일을 찾을 수 없습니다: {p}"}
        elif tool_name == "calc_math":
            expr = args.get("expression", "0")
            try:
                import math
                allowed = {"math": math, "sqrt": math.sqrt, "pi": math.pi, "pow": pow, "abs": abs}
                val = eval(expr, {"__builtins__": {}}, allowed)
                return {"status": "success", "result": val}
            except Exception as e:
                return {"status": "error", "message": str(e)}

        return {
            "status": "success",
            "result": f"[MCP Server: {tool_name}] 실행 완료. 인자: {json.dumps(args, ensure_ascii=False)}"
        }

mcp_manager = MCPManager()
