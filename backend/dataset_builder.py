import json
from typing import List, Dict, Any

class DatasetBuilder:
    def __init__(self):
        self.entries: List[Dict[str, str]] = [] # [{instruction, input, output}]

    def add_entry(self, instruction: str, output: str, context_input: str = ""):
        self.entries.append({
            "instruction": instruction.strip(),
            "input": context_input.strip(),
            "output": output.strip()
        })

    def export_alpaca(self) -> str:
        """Alpaca 포맷 JSON 문자열 반환"""
        return json.dumps(self.entries, indent=2, ensure_ascii=False)

    def export_sharegpt(self) -> str:
        """ShareGPT 포맷 JSON 문자열 반환"""
        sharegpt_data = []
        for e in self.entries:
            user_msg = e["instruction"]
            if e["input"]:
                user_msg += f"\n\n[Context]: {e['input']}"
            sharegpt_data.append({
                "conversations": [
                    {"from": "human", "value": user_msg},
                    {"from": "gpt", "value": e["output"]}
                ]
            })
        return json.dumps(sharegpt_data, indent=2, ensure_ascii=False)

    def export_jsonl(self) -> str:
        """OpenAI JSONL 포맷 문자열 반환"""
        lines = []
        for e in self.entries:
            messages = []
            if e["input"]:
                messages.append({"role": "system", "content": f"Reference: {e['input']}"})
            messages.append({"role": "user", "content": e["instruction"]})
            messages.append({"role": "assistant", "content": e["output"]})
            lines.append(json.dumps({"messages": messages}, ensure_ascii=False))
        return "\n".join(lines)

    def generate_unsloth_script(
        self,
        base_model: str = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit",
        output_dir: str = "lora_model",
        max_seq_length: int = 2048,
        lora_r: int = 16,
        epochs: int = 3,
        learning_rate: float = 2e-4
    ) -> str:
        """Unsloth 기반 초고속 LoRA 파인튜닝 파이썬 스크립트 자동 생성"""
        return f'''# ==========================================================
# 🚀 Unsloth 로컬 LLM 고속 LoRA 파인튜닝 스크립트
# 생성기: LM Studio Orchestrator Studio
# ==========================================================
import torch
from unsloth import FastLanguageModel
from datasets import load_dataset
from trl import SFTTrainer
from transformers import TrainingArguments

# 1. 모델 및 토크나이저 로드 (4-bit 양자화)
max_seq_length = {max_seq_length}
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "{base_model}",
    max_seq_length = max_seq_length,
    dtype = None,
    load_in_4bit = True,
)

# 2. LoRA 어댑터 설정
model = FastLanguageModel.get_peft_model(
    model,
    r = {lora_r},
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha = {lora_r * 2},
    lora_dropout = 0,
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)

# 3. 데이터셋 로드 및 프롬프트 포맷팅
alpaca_prompt = """Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{{}}

### Input:
{{}}

### Response:
{{}}"""

def formatting_prompts_func(examples):
    instructions = examples["instruction"]
    inputs       = examples["input"]
    outputs      = examples["output"]
    texts = []
    for instruction, input_text, output in zip(instructions, inputs, outputs):
        text = alpaca_prompt.format(instruction, input_text, output) + tokenizer.eos_token
        texts.append(text)
    return {{"text": texts}}

dataset = load_dataset("json", data_files="dataset.json", split="train")
dataset = dataset.map(formatting_prompts_func, batched = True)

# 4. 트레이너 설정 및 학습 시작
trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    dataset_num_proc = 2,
    packing = False,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        num_train_epochs = {epochs},
        learning_rate = {learning_rate},
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
    ),
)

print("🔥 학습을 시작합니다...")
trainer_stats = trainer.train()

# 5. LoRA 어댑터 및 GGUF(LM Studio 호환) 내보내기
print("💾 LoRA 가중치를 저장합니다...")
model.save_pretrained("{output_dir}")
tokenizer.save_pretrained("{output_dir}")

# LM Studio용 GGUF 내보내기 (선택 사항)
# model.save_pretrained_gguf("model_q4_k_m", tokenizer, quantization_method = "q4_k_m")
print("🎉 파인튜닝 완료! LM Studio에 어댑터를 로드하세요.")
'''

dataset_builder = DatasetBuilder()
