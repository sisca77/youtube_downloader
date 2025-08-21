from pydantic import BaseModel, Field
from typing import Optional, Dict


class VideoUploadResponse(BaseModel):
    task_id: str
    message: str


class YouTubeProcessRequest(BaseModel):
    youtube_url: str
    summary_ratio: float = Field(default=0.5, ge=0.3, le=0.7)


class ProcessingStatus(BaseModel):
    task_id: str
    status: str  # "processing", "extracting_transcript", "splitting_file", "generating_outline", "completed", "failed"
    progress: int  # 0-100
    message: str
    transcript: Optional[str] = None
    outline: Optional[str] = None
    detailed_explanation: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[Dict] = None  # YouTube 메타데이터


class VideoSummaryResult(BaseModel):
    task_id: str
    file_name: str
    transcript: str
    outline: str
    processing_time: float
    metadata: Optional[Dict] = None
