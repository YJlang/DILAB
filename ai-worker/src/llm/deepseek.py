"""DeepSeek LLM 클라이언트 (OpenAI 호환 API).

DILAB B5 — DILAB Ask 답변 합성, B3 분류·감성 zero-shot, B4 여정 매핑.
"""
from functools import lru_cache

from openai import OpenAI

from ..config import settings


@lru_cache(maxsize=1)
def get_client() -> OpenAI:
    """프로세스당 1회만 생성."""
    return OpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )


def chat(
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 1024,
) -> str:
    """채팅 보완 호출. messages 는 OpenAI 형식 [{"role":"system|user|assistant","content":"..."}]."""
    client = get_client()
    response = client.chat.completions.create(
        model=model or settings.llm_model,
        messages=messages,  # type: ignore[arg-type]
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""
