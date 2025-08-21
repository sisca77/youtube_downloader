import os
import asyncio
from typing import Dict
from pathlib import Path
import uuid

from langgraph.graph import StateGraph
from typing_extensions import TypedDict
from youtube_service import YouTubeService
from services import VideoProcessingService


# YouTube 처리 상태 정의
class YouTubeProcessState(TypedDict):
    youtube_url: str
    video_id: str
    file_path: str
    transcript: str
    outline: str
    detailed_explanation: str
    task_id: str
    progress: int
    status: str
    error: str
    metadata: Dict
    summary_ratio: float
    has_subtitles: bool


class YouTubeProcessingService:
    def __init__(self):
        # OpenAI API 키 설정
        os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
        
        self.tasks: Dict[str, YouTubeProcessState] = {}
        self.youtube_service = YouTubeService()
        self.video_service = VideoProcessingService()
        
        # LangGraph 워크플로우 구성
        self.graph = self._build_workflow()
    
    def _build_workflow(self):
        """워크플로우 그래프 구성"""
        graph_builder = StateGraph(YouTubeProcessState)
        
        # 노드 추가
        graph_builder.add_node("extract_metadata", self._extract_metadata)
        graph_builder.add_node("try_extract_subtitles", self._try_extract_subtitles)
        graph_builder.add_node("download_audio", self._download_audio)
        graph_builder.add_node("extract_transcript_from_audio", self._extract_transcript_from_audio)
        graph_builder.add_node("generate_summary", self._generate_summary)
        
        # 엣지 연결
        graph_builder.set_entry_point("extract_metadata")
        graph_builder.add_edge("extract_metadata", "try_extract_subtitles")
        
        # 조건부 엣지: 자막이 있으면 바로 요약, 없으면 오디오 다운로드
        graph_builder.add_conditional_edges(
            "try_extract_subtitles",
            self._should_download_audio,
            {
                "has_subtitles": "generate_summary",
                "no_subtitles": "download_audio"
            }
        )
        
        graph_builder.add_edge("download_audio", "extract_transcript_from_audio")
        graph_builder.add_edge("extract_transcript_from_audio", "generate_summary")
        graph_builder.set_finish_point("generate_summary")
        
        return graph_builder.compile()
    
    def _extract_metadata(self, state: YouTubeProcessState) -> YouTubeProcessState:
        """YouTube 메타데이터 추출"""
        try:
            state["progress"] = 10
            state["status"] = "extracting_metadata"
            self.tasks[state["task_id"]] = state
            
            # 비디오 ID 추출
            video_id = self.youtube_service.extract_video_id(state["youtube_url"])
            if not video_id:
                raise ValueError("유효하지 않은 YouTube URL입니다.")
            
            state["video_id"] = video_id
            
            # 메타데이터 추출 (동기적으로 처리)
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                metadata = loop.run_until_complete(self.youtube_service.get_youtube_metadata(state["youtube_url"]))
                state["metadata"] = metadata
            finally:
                loop.close()
            
            state["progress"] = 20
            self.tasks[state["task_id"]] = state
            
            return state
            
        except Exception as e:
            state["error"] = str(e)
            state["status"] = "failed"
            self.tasks[state["task_id"]] = state
            raise
    
    def _try_extract_subtitles(self, state: YouTubeProcessState) -> YouTubeProcessState:
        """자막 추출 시도"""
        try:
            state["progress"] = 30
            state["status"] = "extracting_subtitles"
            self.tasks[state["task_id"]] = state
            
            # 자막 추출 (동기적으로 처리)
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                transcript = loop.run_until_complete(self.youtube_service.get_youtube_transcript(state["video_id"]))
            finally:
                loop.close()
            
            if transcript:
                state["transcript"] = transcript
                state["has_subtitles"] = True
                state["progress"] = 60
            else:
                state["has_subtitles"] = False
                state["progress"] = 40
            
            self.tasks[state["task_id"]] = state
            return state
            
        except Exception as e:
            state["error"] = str(e)
            state["status"] = "failed"
            self.tasks[state["task_id"]] = state
            raise
    
    def _should_download_audio(self, state: YouTubeProcessState) -> str:
        """자막 존재 여부에 따른 다음 단계 결정"""
        return "has_subtitles" if state["has_subtitles"] else "no_subtitles"
    
    def _download_audio(self, state: YouTubeProcessState) -> YouTubeProcessState:
        """오디오 다운로드"""
        try:
            state["progress"] = 50
            state["status"] = "downloading_audio"
            self.tasks[state["task_id"]] = state
            
            # 오디오 다운로드 (동기적으로 처리)
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                file_path = loop.run_until_complete(self.youtube_service.download_youtube_audio(
                    state["youtube_url"], 
                    state["task_id"]
                ))
            finally:
                loop.close()
            
            if not file_path:
                raise Exception("YouTube 동영상 다운로드에 실패했습니다.")
            
            state["file_path"] = file_path
            state["progress"] = 60
            self.tasks[state["task_id"]] = state
            
            return state
            
        except Exception as e:
            state["error"] = str(e)
            state["status"] = "failed"
            self.tasks[state["task_id"]] = state
            raise
    
    def _extract_transcript_from_audio(self, state: YouTubeProcessState) -> YouTubeProcessState:
        """오디오에서 텍스트 추출"""
        try:
            state["progress"] = 70
            state["status"] = "extracting_transcript"
            self.tasks[state["task_id"]] = state
            
            # 기존 VideoProcessingService의 Whisper 기능 활용 (동기적으로 처리)
            with open(state["file_path"], "rb") as audio_file:
                transcript_response = self.video_service.openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="ko"
                )
            
            state["transcript"] = transcript_response.text
            state["progress"] = 80
            self.tasks[state["task_id"]] = state
            
            return state
            
        except Exception as e:
            state["error"] = str(e)
            state["status"] = "failed"
            self.tasks[state["task_id"]] = state
            raise
    
    def _generate_summary(self, state: YouTubeProcessState) -> YouTubeProcessState:
        """요약 및 상세 해설 생성"""
        try:
            state["progress"] = 90
            state["status"] = "generating_summary"
            self.tasks[state["task_id"]] = state
            
            # 요약 및 해설 생성 (동기적으로 처리)
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                outline, detailed_explanation = loop.run_until_complete(
                    self.youtube_service.generate_summary_and_explanation(
                        state["transcript"],
                        state["metadata"],
                        state["summary_ratio"]
                    )
                )
            finally:
                loop.close()
            
            state["outline"] = outline
            state["detailed_explanation"] = detailed_explanation
            state["progress"] = 100
            state["status"] = "completed"
            self.tasks[state["task_id"]] = state
            
            return state
            
        except Exception as e:
            state["error"] = str(e)
            state["status"] = "failed"
            self.tasks[state["task_id"]] = state
            raise
    
    async def process_youtube_url(self, youtube_url: str, task_id: str, summary_ratio: float = 0.5):
        """YouTube URL 처리 메인 함수"""
        try:
            # 초기 상태 설정
            initial_state = YouTubeProcessState(
                youtube_url=youtube_url,
                video_id="",
                file_path="",
                transcript="",
                outline="",
                detailed_explanation="",
                task_id=task_id,
                progress=0,
                status="processing",
                error="",
                metadata={},
                summary_ratio=summary_ratio,
                has_subtitles=False
            )
            
            self.tasks[task_id] = initial_state
            
            # 워크플로우 실행 (동기적으로 처리)
            result = self.graph.invoke(initial_state)
            
            return result
            
        except Exception as e:
            # 에러 처리
            if task_id in self.tasks:
                self.tasks[task_id]["status"] = "failed"
                self.tasks[task_id]["error"] = str(e)
            raise
    
    def get_task_status(self, task_id: str) -> Dict:
        """작업 상태 조회"""
        return self.tasks.get(task_id, {})
    
    def cleanup_task(self, task_id: str):
        """완료된 작업 정리"""
        if task_id in self.tasks:
            # 파일 삭제 (다운로드된 경우)
            file_path = self.tasks[task_id].get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
            
            # 작업 정보 삭제
            del self.tasks[task_id]
