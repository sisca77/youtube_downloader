import os
import asyncio
from typing import Dict
from pathlib import Path
import uuid

from youtube_service import YouTubeService
from services import VideoProcessingService
from audio_splitter import AudioSplitter


class YouTubeProcessingService:
    def __init__(self):
        # OpenAI API 키 설정
        os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
        
        self.tasks: Dict[str, Dict] = {}
        self.youtube_service = YouTubeService()
        self.video_service = VideoProcessingService()
        self.audio_splitter = AudioSplitter()
    
    async def process_youtube_url(self, youtube_url: str, task_id: str, summary_ratio: float = 0.5, download_video: bool = False):
        """YouTube URL 처리 메인 함수"""
        try:
            # 초기 상태 설정
            self.tasks[task_id] = {
                "youtube_url": youtube_url,
                "video_id": "",
                "file_path": "",
                "transcript": "",
                "outline": "",
                "detailed_explanation": "",
                "task_id": task_id,
                "progress": 0,
                "status": "processing",
                "error": "",
                "metadata": {},
                "summary_ratio": summary_ratio,
                "download_video": download_video,
                "has_subtitles": False
            }
            
            # 1단계: 메타데이터 추출
            await self._extract_metadata(task_id, youtube_url)
            
            # 2단계: 자막 추출 시도
            await self._try_extract_subtitles(task_id)
            
            # 3단계: 자막이 없으면 오디오/비디오 다운로드
            if not self.tasks[task_id]["has_subtitles"]:
                await self._download_media(task_id, youtube_url, download_video)
                await self._extract_transcript_from_audio(task_id)
            
            # 4단계: 요약 및 해설 생성
            await self._generate_summary(task_id)
            
            return self.tasks[task_id]
            
        except Exception as e:
            # 에러 처리
            if task_id in self.tasks:
                self.tasks[task_id]["status"] = "failed"
                self.tasks[task_id]["error"] = str(e)
            raise
    
    async def _extract_metadata(self, task_id: str, youtube_url: str):
        """YouTube 메타데이터 추출"""
        try:
            self.tasks[task_id]["progress"] = 10
            self.tasks[task_id]["status"] = "extracting_metadata"
            
            # 비디오 ID 추출
            video_id = self.youtube_service.extract_video_id(youtube_url)
            if not video_id:
                raise ValueError("유효하지 않은 YouTube URL입니다.")
            
            self.tasks[task_id]["video_id"] = video_id
            
            # 메타데이터 추출
            metadata = await self.youtube_service.get_youtube_metadata(youtube_url)
            self.tasks[task_id]["metadata"] = metadata
            self.tasks[task_id]["progress"] = 20
            
        except Exception as e:
            self.tasks[task_id]["error"] = str(e)
            self.tasks[task_id]["status"] = "failed"
            raise
    
    async def _try_extract_subtitles(self, task_id: str):
        """자막 추출 시도"""
        try:
            self.tasks[task_id]["progress"] = 30
            self.tasks[task_id]["status"] = "extracting_subtitles"
            
            video_id = self.tasks[task_id]["video_id"]
            transcript = await self.youtube_service.get_youtube_transcript(video_id)
            
            if transcript and transcript.strip():
                self.tasks[task_id]["transcript"] = transcript
                self.tasks[task_id]["has_subtitles"] = True
                self.tasks[task_id]["progress"] = 60
                print(f"자막 추출 성공: {len(transcript)} 글자")
            else:
                self.tasks[task_id]["has_subtitles"] = False
                self.tasks[task_id]["progress"] = 40
                print("자막을 찾을 수 없어 다운로드로 진행합니다.")
                
        except Exception as e:
            print(f"자막 추출 중 오류 발생: {e}")
            # 자막 추출 실패는 치명적이지 않음 - 다운로드로 계속 진행
            self.tasks[task_id]["has_subtitles"] = False
            self.tasks[task_id]["progress"] = 40
    
    async def _download_media(self, task_id: str, youtube_url: str, download_video: bool = False):
        """미디어 다운로드 (오디오 또는 비디오)"""
        try:
            self.tasks[task_id]["progress"] = 50
            if download_video:
                self.tasks[task_id]["status"] = "downloading_video"
            else:
                self.tasks[task_id]["status"] = "downloading_audio"
            
            file_path = await self.youtube_service.download_youtube_audio(youtube_url, task_id, download_video)
            
            if not file_path:
                media_type = "비디오" if download_video else "오디오"
                error_msg = f"YouTube {media_type} 다운로드에 실패했습니다. 이 동영상은 다운로드가 제한되었거나 개인 설정으로 인해 접근할 수 없을 수 있습니다."
                print(error_msg)
                raise Exception(error_msg)
            
            self.tasks[task_id]["file_path"] = file_path
            self.tasks[task_id]["progress"] = 60
            media_type = "비디오" if download_video else "오디오"
            print(f"{media_type} 다운로드 성공: {file_path}")
            
        except Exception as e:
            media_type = "비디오" if download_video else "오디오"
            error_msg = f"{media_type} 다운로드 실패: {str(e)}"
            print(error_msg)
            self.tasks[task_id]["error"] = error_msg
            self.tasks[task_id]["status"] = "failed"
            raise
    
    async def _extract_transcript_from_audio(self, task_id: str):
        """오디오에서 텍스트 추출 (큰 파일은 자동 분할)"""
        try:
            self.tasks[task_id]["progress"] = 70
            self.tasks[task_id]["status"] = "extracting_transcript"
            
            file_path = self.tasks[task_id]["file_path"]
            
            # 파일 크기 확인 및 분할 처리
            file_size_mb = os.path.getsize(file_path) / 1024 / 1024
            print(f"오디오 파일 크기: {file_size_mb:.2f}MB")
            
            if self.audio_splitter.needs_splitting(file_path):
                print("파일이 커서 분할 처리를 시작합니다.")
                transcript = await self.audio_splitter.process_large_audio_file(
                    file_path, 
                    self.video_service.openai_client,
                    language="ko"
                )
            else:
                print("파일 크기가 적당하여 바로 처리합니다.")
                with open(file_path, "rb") as audio_file:
                    transcript_response = await asyncio.to_thread(
                        self.video_service.openai_client.audio.transcriptions.create,
                        model="whisper-1",
                        file=audio_file,
                        language="ko"
                    )
                transcript = transcript_response.text
            
            self.tasks[task_id]["transcript"] = transcript
            self.tasks[task_id]["progress"] = 80
            print(f"음성 인식 완료: {len(transcript)} 글자")
            
        except Exception as e:
            error_msg = f"음성 인식 실패: {str(e)}"
            print(error_msg)
            self.tasks[task_id]["error"] = error_msg
            self.tasks[task_id]["status"] = "failed"
            raise
    
    async def _generate_summary(self, task_id: str):
        """요약 및 상세 해설 생성"""
        try:
            self.tasks[task_id]["progress"] = 90
            self.tasks[task_id]["status"] = "generating_summary"
            
            transcript = self.tasks[task_id]["transcript"]
            metadata = self.tasks[task_id]["metadata"]
            summary_ratio = self.tasks[task_id]["summary_ratio"]
            
            outline, detailed_explanation = await self.youtube_service.generate_summary_and_explanation(
                transcript, metadata, summary_ratio
            )
            
            self.tasks[task_id]["outline"] = outline
            self.tasks[task_id]["detailed_explanation"] = detailed_explanation
            self.tasks[task_id]["progress"] = 100
            self.tasks[task_id]["status"] = "completed"
            
        except Exception as e:
            self.tasks[task_id]["error"] = str(e)
            self.tasks[task_id]["status"] = "failed"
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

