import os
import asyncio
from typing import Dict
from pathlib import Path

from langgraph.graph import StateGraph
from typing_extensions import TypedDict
import time
import uuid


# 워크플로우 상태 정의
class VideoProcessState(TypedDict):
    file_path: str
    transcript: str
    outline: str
    task_id: str
    progress: int
    status: str
    error: str


class VideoProcessingService:
    def __init__(self):
        # OpenAI API 키 설정
        os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
        
        self.tasks: Dict[str, VideoProcessState] = {}
        
        # OpenAI 클라이언트 초기화
        from openai import OpenAI
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # LangGraph 워크플로우 구성
        self.graph = self._build_workflow()
    
    def _build_workflow(self):
        """워크플로우 그래프 구성"""
        graph_builder = StateGraph(VideoProcessState)
        
        # 노드 추가
        graph_builder.add_node("extract_transcript", self._extract_transcript)
        graph_builder.add_node("generate_outline", self._generate_outline)
        
        # 엣지 연결
        graph_builder.set_entry_point("extract_transcript")
        graph_builder.add_edge("extract_transcript", "generate_outline")
        graph_builder.set_finish_point("generate_outline")
        
        return graph_builder.compile()
    
    async def _extract_transcript(self, state: VideoProcessState) -> VideoProcessState:
        """영상에서 음성을 텍스트로 변환"""
        try:
            # 진행 상황 업데이트
            state["progress"] = 30
            state["status"] = "extracting_transcript"
            self.tasks[state["task_id"]] = state
            
            file_path = state["file_path"]
            
            # OpenAI Whisper API를 직접 사용
            with open(file_path, "rb") as audio_file:
                transcript_response = await asyncio.to_thread(
                    self.openai_client.audio.transcriptions.create,
                    model="whisper-1",
                    file=audio_file,
                    language="ko"  # 한국어 설정
                )
            
            transcript = transcript_response.text
            
            state["transcript"] = transcript
            state["progress"] = 60
            self.tasks[state["task_id"]] = state
            
            return state
            
        except Exception as e:
            state["error"] = str(e)
            state["status"] = "failed"
            self.tasks[state["task_id"]] = state
            raise
    
    async def _generate_outline(self, state: VideoProcessState) -> VideoProcessState:
        """텍스트를 바탕으로 한국어 아웃라인 생성"""
        try:
            state["progress"] = 70
            state["status"] = "generating_outline"
            self.tasks[state["task_id"]] = state
            
            transcript = state["transcript"]
            
            # OpenAI API를 직접 사용하여 아웃라인 생성
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that generates an outline for a transcript. Make sure to use Korean when you generate the outline."},
                    {"role": "user", "content": f"Generate a structured outline for the following transcript: {transcript}"}
                ],
                temperature=0
            )
            
            outline = response.choices[0].message.content
            
            state["outline"] = outline
            state["progress"] = 100
            state["status"] = "completed"
            self.tasks[state["task_id"]] = state
            
            return state
            
        except Exception as e:
            state["error"] = str(e)
            state["status"] = "failed"
            self.tasks[state["task_id"]] = state
            raise
    
    async def process_video(self, file_path: str, task_id: str):
        """비디오 처리 메인 함수"""
        try:
            # 초기 상태 설정
            initial_state = VideoProcessState(
                file_path=file_path,
                transcript="",
                outline="",
                task_id=task_id,
                progress=0,
                status="processing",
                error=""
            )
            
            self.tasks[task_id] = initial_state
            
            # 워크플로우 실행
            result = await asyncio.to_thread(
                self.graph.invoke,
                initial_state
            )
            
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
            # 파일 삭제
            file_path = self.tasks[task_id].get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
            
            # 작업 정보 삭제
            del self.tasks[task_id]
