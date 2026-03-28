from pydantic import BaseModel, Field


class GuideChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class GuideChatRequest(BaseModel):
    message: str
    history: list[GuideChatMessage] = Field(default_factory=list)


class GuideChatResponse(BaseModel):
    reply: str
