import uvicorn
import os
import sys

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, current_dir)
    print("==================================================================")
    print("[LM Studio Orchestrator & Local Agent Studio]")
    print("Server running at: http://localhost:8000")
    print("Connecting to LM Studio Local Server at http://localhost:1234")
    print("==================================================================")
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=False)
