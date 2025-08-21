import os
import uuid
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from pathlib import Path
import aiofiles
from models import VideoUploadResponse, ProcessingStatus, VideoSummaryResult, YouTubeProcessRequest
from services_chunked import VideoProcessingService
from youtube_processing_service_simple import YouTubeProcessingService
import time

# 환경 변수 로드
load_dotenv()

# FastAPI 앱 초기화
app = FastAPI(title="Video Summary API", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Next.js 개발 서버
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 업로드 디렉토리 설정
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# 비디오 처리 서비스 초기화
video_service = VideoProcessingService()
youtube_service = YouTubeProcessingService()

# 지원하는 비디오 형식
ALLOWED_EXTENSIONS = {".mp4", ".mp3", ".wav", ".m4a", ".webm"}


@app.get("/")
async def root():
    return {"message": "Video Summary API is running"}


@app.post("/api/upload", response_model=VideoUploadResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    summary_ratio: float = Form(0.5)
):
    """비디오 파일 업로드 및 처리 시작"""
    
    # 파일 확장자 검증
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File format not supported. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # 요약 비율 검증
    if summary_ratio not in [0.3, 0.5, 0.7]:
        summary_ratio = 0.5
    
    # 고유 ID 생성
    task_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{task_id}{file_extension}"
    
    try:
        # 파일 저장
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # 백그라운드에서 비디오 처리 시작
        background_tasks.add_task(
            video_service.process_video,
            str(file_path),
            task_id,
            summary_ratio
        )
        
        return VideoUploadResponse(
            task_id=task_id,
            message="Video upload successful. Processing started."
        )
        
    except Exception as e:
        # 에러 발생 시 파일 삭제
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/status/{task_id}", response_model=ProcessingStatus)
async def get_processing_status(task_id: str):
    """처리 상태 조회"""
    
    task_status = video_service.get_task_status(task_id)
    
    if not task_status:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return ProcessingStatus(
        task_id=task_id,
        status=task_status.get("status", "unknown"),
        progress=task_status.get("progress", 0),
        message=task_status.get("message", _get_status_message(task_status.get("status"))),
        transcript=task_status.get("transcript") if task_status.get("status") == "completed" else None,
        outline=task_status.get("outline") if task_status.get("status") == "completed" else None,
        detailed_explanation=task_status.get("detailed_explanation") if task_status.get("status") == "completed" else None,
        error=task_status.get("error") if task_status.get("status") == "failed" else None
    )


@app.get("/api/result/{task_id}", response_model=VideoSummaryResult)
async def get_result(task_id: str):
    """처리 결과 조회"""
    
    task_status = video_service.get_task_status(task_id)
    
    if not task_status:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task_status.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Task is not completed. Current status: {task_status.get('status')}"
        )
    
    return VideoSummaryResult(
        task_id=task_id,
        file_name=Path(task_status["file_path"]).name,
        transcript=task_status["transcript"],
        outline=task_status["outline"],
        processing_time=0.0  # TODO: 실제 처리 시간 계산
    )


@app.delete("/api/task/{task_id}")
async def cleanup_task(task_id: str):
    """작업 정리 (파일 삭제 포함)"""
    
    task_status = video_service.get_task_status(task_id)
    
    if not task_status:
        # 이미 삭제된 작업인 경우 성공으로 처리
        return {"message": "Task already cleaned up or does not exist"}
    
    video_service.cleanup_task(task_id)
    
    return {"message": "Task cleaned up successfully"}


@app.post("/api/youtube", response_model=VideoUploadResponse)
async def process_youtube_url(
    background_tasks: BackgroundTasks,
    request: YouTubeProcessRequest
):
    """YouTube URL 처리 시작"""
    
    # 요약 비율 검증
    if request.summary_ratio not in [0.3, 0.5, 0.7]:
        request.summary_ratio = 0.5
    
    # 고유 ID 생성
    task_id = str(uuid.uuid4())
    
    try:
        # 백그라운드에서 YouTube 처리 시작
        background_tasks.add_task(
            youtube_service.process_youtube_url,
            request.youtube_url,
            task_id,
            request.summary_ratio,
            request.download_video
        )
        
        return VideoUploadResponse(
            task_id=task_id,
            message="YouTube URL 처리를 시작합니다."
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/youtube/status/{task_id}", response_model=ProcessingStatus)
async def get_youtube_processing_status(task_id: str):
    """YouTube 처리 상태 조회"""
    
    task_status = youtube_service.get_task_status(task_id)
    
    if not task_status:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return ProcessingStatus(
        task_id=task_id,
        status=task_status.get("status", "unknown"),
        progress=task_status.get("progress", 0),
        message=task_status.get("message", _get_youtube_status_message(task_status.get("status"))),
        transcript=task_status.get("transcript") if task_status.get("status") == "completed" else None,
        outline=task_status.get("outline") if task_status.get("status") == "completed" else None,
        detailed_explanation=task_status.get("detailed_explanation") if task_status.get("status") == "completed" else None,
        error=task_status.get("error") if task_status.get("status") == "failed" else None,
        metadata=task_status.get("metadata")
    )


@app.delete("/api/youtube/task/{task_id}")
async def cleanup_youtube_task(task_id: str):
    """YouTube 작업 정리"""
    
    task_status = youtube_service.get_task_status(task_id)
    
    if not task_status:
        return {"message": "Task already cleaned up or does not exist"}
    
    youtube_service.cleanup_task(task_id)
    
    return {"message": "Task cleaned up successfully"}


def _get_status_message(status: str) -> str:
    """상태에 따른 메시지 반환"""
    messages = {
        "processing": "비디오 처리 중...",
        "splitting_file": "파일 분할 중...",
        "extracting_transcript": "음성을 텍스트로 변환 중...",
        "generating_outline": "아웃라인 생성 중...",
        "completed": "처리 완료!",
        "failed": "처리 실패",
        "unknown": "알 수 없는 상태"
    }
    return messages.get(status, "알 수 없는 상태")


def _get_youtube_status_message(status: str) -> str:
    """YouTube 처리 상태에 따른 메시지 반환"""
    messages = {
        "processing": "YouTube 영상 처리 중...",
        "extracting_metadata": "영상 정보 추출 중...",
        "extracting_subtitles": "자막 추출 시도 중...",
        "downloading_audio": "오디오 다운로드 중...",
        "extracting_transcript": "음성을 텍스트로 변환 중...",
        "generating_summary": "요약 및 해설 생성 중...",
        "completed": "처리 완료!",
        "failed": "처리 실패",
        "unknown": "알 수 없는 상태"
    }
    return messages.get(status, "알 수 없는 상태")


@app.on_event("startup")
async def startup_event():
    """서버 시작 시 실행"""
    print("Video Summary API started")
    print(f"Upload directory: {UPLOAD_DIR.absolute()}")
    
    # OpenAI API 키 확인
    if not os.getenv("OPENAI_API_KEY"):
        print("WARNING: OPENAI_API_KEY not found in environment variables")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
