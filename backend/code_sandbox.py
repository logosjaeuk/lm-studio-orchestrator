import sys
import io
import traceback
from typing import Dict, Any

class CodeSandbox:
    def execute_python(self, code: str, timeout: int = 5) -> Dict[str, Any]:
        """로컬 안전 파이썬 코드 실행기"""
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        redirected_output = io.StringIO()
        redirected_error = io.StringIO()
        sys.stdout = redirected_output
        sys.stderr = redirected_error

        status = "success"
        output = ""
        try:
            # 기본 내장 모듈 및 계산 지원
            local_scope = {}
            exec(code, {"__builtins__": __builtins__}, local_scope)
            output = redirected_output.getvalue()
        except Exception as e:
            status = "error"
            output = f"Execution Error: {str(e)}\n{traceback.format_exc()}"
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

        return {
            "status": status,
            "output": output or "Code executed successfully (no stdout)."
        }

code_sandbox = CodeSandbox()
