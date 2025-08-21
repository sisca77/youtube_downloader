import os
import asyncio
import io
from typing import Dict, Optional
from pathlib import Path
import time
import uuid


class VideoProcessingService:
    def __init__(self):
        self.tasks: Dict[str, dict] = {}
        
        # OpenAI 클라이언트 초기화
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            self.openai_client = OpenAI(api_key=api_key)
        else:
            print("Warning: OPENAI_API_KEY not found in environment variables")
            self.openai_client = None
    
    async def process_video(self, file_path: str, task_id: str):
        """비디오 처리 메인 함수"""
        try:
            # 초기 상태 설정
            self.tasks[task_id] = {
                "file_path": file_path,
                "transcript": "",
                "outline": "",
                "task_id": task_id,
                "progress": 0,
                "status": "processing",
                "error": ""
            }
            
            # 1. 트랜스크립트 추출
            await self._extract_transcript(task_id)
            
            # 2. 아웃라인 생성
            await self._generate_outline(task_id)
            
            return self.tasks[task_id]
            
        except Exception as e:
            # 에러 처리
            if task_id in self.tasks:
                self.tasks[task_id]["status"] = "failed"
                self.tasks[task_id]["error"] = str(e)
            raise
    
    async def _extract_transcript(self, task_id: str):
        """영상에서 음성을 텍스트로 변환"""
        try:
            # 진행 상황 업데이트
            self.tasks[task_id]["progress"] = 30
            self.tasks[task_id]["status"] = "extracting_transcript"
            
            file_path = self.tasks[task_id]["file_path"]
            
            if not self.openai_client:
                raise Exception("OpenAI client not initialized")
            
            # OpenAI Whisper API를 직접 사용
            try:
                # 파일 크기 확인 (25MB 제한)
                file_size = os.path.getsize(file_path)
                max_size = 25 * 1024 * 1024  # 25MB
                if file_size > max_size:
                    size_mb = file_size / (1024 * 1024)
                    raise Exception(f"파일 크기가 25MB를 초과합니다. (현재: {size_mb:.2f}MB)")
                
                print(f"Processing file: {file_path}, Size: {file_size} bytes")
                
                # 파일을 바이너리로 읽기
                with open(file_path, "rb") as audio_file:
                    # 파일 내용을 메모리에 로드
                    file_content = audio_file.read()
                    
                # 새로운 파일 객체 생성
                file_obj = io.BytesIO(file_content)
                file_obj.name = Path(file_path).name
                
                # API 호출
                transcript_response = await asyncio.to_thread(
                    self.openai_client.audio.transcriptions.create,
                    model="whisper-1",
                    file=file_obj
                )
                
                # 응답 처리
                transcript = transcript_response.text if hasattr(transcript_response, 'text') else str(transcript_response)
                
            except Exception as e:
                print(f"Whisper API Error: {str(e)}")
                print(f"File path: {file_path}")
                print(f"File exists: {os.path.exists(file_path)}")
                raise
            
            self.tasks[task_id]["transcript"] = transcript
            self.tasks[task_id]["progress"] = 60
            
        except Exception as e:
            self.tasks[task_id]["error"] = str(e)
            self.tasks[task_id]["status"] = "failed"
            raise
    
    async def _generate_outline(self, task_id: str):
        """텍스트를 바탕으로 한국어 아웃라인 생성"""
        try:
            self.tasks[task_id]["progress"] = 70
            self.tasks[task_id]["status"] = "generating_outline"
            
            transcript = self.tasks[task_id]["transcript"]
            
            if not self.openai_client:
                raise Exception("OpenAI client not initialized")
            
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
            
            self.tasks[task_id]["outline"] = outline
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
            # 파일 삭제
            file_path = self.tasks[task_id].get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
            
            # 작업 정보 삭제
            del self.tasks[task_id]
