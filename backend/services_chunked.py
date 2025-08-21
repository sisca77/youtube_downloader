import os
import asyncio
import io
import subprocess
import tempfile
import shutil
from typing import Dict, List, Optional
from pathlib import Path
import time
import uuid
import math


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
            
        # ffmpeg 경로 설정 (Windows의 경우)
        self.ffmpeg_path = self._find_ffmpeg()
    
    def _find_ffmpeg(self):
        """ffmpeg 실행 파일 찾기"""
        # 일반적인 경로들
        possible_paths = [
            "ffmpeg",  # PATH에 있는 경우
            "C:\\ffmpeg\\bin\\ffmpeg.exe",
            "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
            "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
        ]
        
        for path in possible_paths:
            try:
                subprocess.run([path, "-version"], capture_output=True, check=True)
                print(f"Found ffmpeg at: {path}")
                return path
            except:
                continue
        
        print("Warning: ffmpeg not found. Large file processing may not work.")
        return "ffmpeg"
    
    async def process_video(self, file_path: str, task_id: str, summary_ratio: float = 0.5):
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
                "error": "",
                "message": "처리 시작...",
                "summary_ratio": summary_ratio
            }
            
            # 파일 크기 확인
            file_size = os.path.getsize(file_path)
            max_size = 25 * 1024 * 1024  # 25MB
            
            if file_size <= max_size:
                # 작은 파일은 직접 처리
                await self._extract_transcript_simple(task_id)
            else:
                # 큰 파일은 분할 처리
                await self._extract_transcript_chunked(task_id)
            
            # 아웃라인 생성
            await self._generate_outline(task_id)
            
            return self.tasks[task_id]
            
        except Exception as e:
            # 에러 처리
            if task_id in self.tasks:
                self.tasks[task_id]["status"] = "failed"
                self.tasks[task_id]["error"] = str(e)
            raise
    
    async def _extract_transcript_simple(self, task_id: str):
        """작은 파일의 음성을 텍스트로 변환"""
        try:
            self.tasks[task_id]["progress"] = 30
            self.tasks[task_id]["status"] = "extracting_transcript"
            self.tasks[task_id]["message"] = "음성을 텍스트로 변환 중..."
            
            file_path = self.tasks[task_id]["file_path"]
            
            if not self.openai_client:
                raise Exception("OpenAI client not initialized")
            
            # 파일을 바이너리로 읽기
            with open(file_path, "rb") as audio_file:
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
            
            self.tasks[task_id]["transcript"] = transcript
            self.tasks[task_id]["progress"] = 60
            
        except Exception as e:
            self.tasks[task_id]["error"] = str(e)
            self.tasks[task_id]["status"] = "failed"
            raise
    
    async def _extract_transcript_chunked(self, task_id: str):
        """큰 파일을 분할하여 처리"""
        try:
            self.tasks[task_id]["progress"] = 10
            self.tasks[task_id]["status"] = "splitting_file"
            self.tasks[task_id]["message"] = "파일 분할 중..."
            
            file_path = self.tasks[task_id]["file_path"]
            file_size = os.path.getsize(file_path)
            
            # 임시 디렉토리 생성
            temp_dir = tempfile.mkdtemp()
            
            try:
                # 파일을 청크로 분할
                chunks = await self._split_audio_file(file_path, temp_dir)
                
                if not chunks:
                    raise Exception("파일 분할에 실패했습니다.")
                
                # 각 청크 처리
                transcripts = []
                total_chunks = len(chunks)
                
                for i, chunk_path in enumerate(chunks):
                    progress = 20 + (40 * i // total_chunks)
                    self.tasks[task_id]["progress"] = progress
                    self.tasks[task_id]["message"] = f"청크 {i+1}/{total_chunks} 처리 중..."
                    
                    # 청크 트랜스크립트 추출
                    chunk_transcript = await self._process_chunk(chunk_path)
                    transcripts.append(chunk_transcript)
                
                # 모든 트랜스크립트 합치기
                full_transcript = " ".join(transcripts)
                
                self.tasks[task_id]["transcript"] = full_transcript
                self.tasks[task_id]["progress"] = 60
                self.tasks[task_id]["message"] = "텍스트 변환 완료"
                
            finally:
                # 임시 디렉토리 정리
                shutil.rmtree(temp_dir, ignore_errors=True)
                
        except Exception as e:
            self.tasks[task_id]["error"] = str(e)
            self.tasks[task_id]["status"] = "failed"
            raise
    
    async def _split_audio_file(self, input_path: str, output_dir: str) -> List[str]:
        """오디오 파일을 청크로 분할"""
        try:
            # 파일 정보 가져오기
            duration = await self._get_audio_duration(input_path)
            
            # 청크 크기 계산 (10분 단위로 분할)
            chunk_duration = 600  # 10분 (초)
            num_chunks = math.ceil(duration / chunk_duration)
            
            chunks = []
            
            for i in range(num_chunks):
                start_time = i * chunk_duration
                output_path = os.path.join(output_dir, f"chunk_{i:03d}.mp3")
                
                # ffmpeg 명령어로 청크 추출
                cmd = [
                    self.ffmpeg_path,
                    "-i", input_path,
                    "-ss", str(start_time),
                    "-t", str(chunk_duration),
                    "-acodec", "mp3",
                    "-ab", "128k",
                    "-y",  # 덮어쓰기
                    output_path
                ]
                
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await process.communicate()
                
                if process.returncode != 0:
                    print(f"ffmpeg error: {stderr.decode()}")
                    # ffmpeg가 없는 경우 원본 파일 반환
                    return [input_path]
                
                chunks.append(output_path)
            
            return chunks
            
        except Exception as e:
            print(f"Error splitting file: {str(e)}")
            # 분할 실패 시 원본 파일 반환
            return [input_path]
    
    async def _get_audio_duration(self, file_path: str) -> float:
        """오디오 파일의 길이를 초 단위로 반환"""
        try:
            cmd = [
                self.ffmpeg_path,
                "-i", file_path,
                "-f", "null",
                "-"
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            stderr_text = stderr.decode()
            
            # Duration 정보 추출
            import re
            duration_match = re.search(r'Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})', stderr_text)
            
            if duration_match:
                hours = int(duration_match.group(1))
                minutes = int(duration_match.group(2))
                seconds = float(duration_match.group(3))
                total_seconds = hours * 3600 + minutes * 60 + seconds
                return total_seconds
            
            # 기본값: 10분
            return 600
            
        except Exception as e:
            print(f"Error getting duration: {str(e)}")
            return 600
    
    async def _process_chunk(self, chunk_path: str) -> str:
        """개별 청크 처리"""
        try:
            if not self.openai_client:
                raise Exception("OpenAI client not initialized")
            
            # 파일 크기 확인
            file_size = os.path.getsize(chunk_path)
            if file_size > 25 * 1024 * 1024:
                raise Exception(f"청크 크기가 너무 큽니다: {file_size / 1024 / 1024:.2f}MB")
            
            with open(chunk_path, "rb") as audio_file:
                file_content = audio_file.read()
            
            file_obj = io.BytesIO(file_content)
            file_obj.name = Path(chunk_path).name
            
            transcript_response = await asyncio.to_thread(
                self.openai_client.audio.transcriptions.create,
                model="whisper-1",
                file=file_obj
            )
            
            return transcript_response.text if hasattr(transcript_response, 'text') else str(transcript_response)
            
        except Exception as e:
            print(f"Error processing chunk {chunk_path}: {str(e)}")
            raise
    
    async def _generate_outline(self, task_id: str):
        """텍스트를 바탕으로 한국어 아웃라인 생성"""
        try:
            self.tasks[task_id]["progress"] = 70
            self.tasks[task_id]["status"] = "generating_outline"
            self.tasks[task_id]["message"] = "아웃라인 생성 중..."
            
            transcript = self.tasks[task_id]["transcript"]
            summary_ratio = self.tasks[task_id].get("summary_ratio", 0.5)
            
            if not self.openai_client:
                raise Exception("OpenAI client not initialized")
            
            # 긴 텍스트의 경우 요약 먼저 수행
            if len(transcript) > 10000:
                transcript = await self._summarize_long_text(transcript, summary_ratio)
            
            # 요약 비율에 따른 프롬프트 조정
            detail_level = self._get_detail_level(summary_ratio)
            
            # OpenAI API를 직접 사용하여 아웃라인 생성
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": f"You are a helpful assistant that generates an outline for a transcript. Make sure to use Korean when you generate the outline. Generate a {detail_level} outline."},
                    {"role": "user", "content": f"Generate a structured outline for the following transcript: {transcript}"}
                ],
                temperature=0,
                max_tokens=int(4000 * summary_ratio)  # 요약 비율에 따라 토큰 수 조정
            )
            
            outline = response.choices[0].message.content
            
            self.tasks[task_id]["outline"] = outline
            self.tasks[task_id]["progress"] = 85
            self.tasks[task_id]["message"] = "상세 해설 생성 중..."
            
            # 상세 해설 생성
            detailed_explanation = await self._generate_detailed_explanation(
                transcript, outline, summary_ratio
            )
            
            self.tasks[task_id]["detailed_explanation"] = detailed_explanation
            self.tasks[task_id]["progress"] = 100
            self.tasks[task_id]["status"] = "completed"
            self.tasks[task_id]["message"] = "처리 완료!"
            
        except Exception as e:
            self.tasks[task_id]["error"] = str(e)
            self.tasks[task_id]["status"] = "failed"
            raise
    
    def _get_detail_level(self, summary_ratio: float) -> str:
        """요약 비율에 따른 상세 레벨 반환"""
        if summary_ratio <= 0.3:
            return "very concise and brief (핵심만 간략히)"
        elif summary_ratio <= 0.5:
            return "balanced and well-structured (균형잡힌)"
        else:
            return "detailed and comprehensive (상세하고 포괄적인)"
    
    async def _generate_detailed_explanation(self, transcript: str, outline: str, summary_ratio: float) -> str:
        """아웃라인을 바탕으로 상세한 해설 생성"""
        try:
            if not self.openai_client:
                raise Exception("OpenAI client not initialized")
            
            detail_level = self._get_detail_level(summary_ratio)
            
            # 프롬프트 구성
            system_prompt = f"""You are an expert content analyzer and educator. 
Your task is to create a {detail_level} educational document that expands on the given outline.
The document should:
1. Explain each main point in detail
2. Provide context and background information
3. Include examples or analogies where helpful
4. Make complex concepts easier to understand
5. Use clear, educational language
6. Write in Korean

Format the output as a well-structured educational document."""

            user_prompt = f"""Based on this transcript and outline, create a detailed educational explanation:

TRANSCRIPT:
{transcript[:3000]}...  # 토큰 제한을 위해 일부만 사용

OUTLINE:
{outline}

Create a comprehensive educational document that helps readers fully understand the content."""
            
            # OpenAI API 호출
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,  # 약간의 창의성 허용
                max_tokens=int(5000 * summary_ratio)  # 요약 비율에 따라 조정
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Error generating detailed explanation: {str(e)}")
            # 오류 발생 시 기본 아웃라인 반환
            return outline
    
    async def _summarize_long_text(self, text: str, summary_ratio: float = 0.5) -> str:
        """긴 텍스트를 요약"""
        try:
            # 텍스트를 청크로 나누기 (각 3000자)
            chunk_size = 3000
            chunks = [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
            
            summaries = []
            max_tokens = int(500 * summary_ratio)  # 요약 비율에 따라 토큰 수 조정
            
            for chunk in chunks:
                response = await asyncio.to_thread(
                    self.openai_client.chat.completions.create,
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": f"Summarize the following text in Korean. Keep approximately {int(summary_ratio * 100)}% of the content detail."},
                        {"role": "user", "content": chunk}
                    ],
                    temperature=0,
                    max_tokens=max_tokens
                )
                
                summaries.append(response.choices[0].message.content)
            
            return " ".join(summaries)
            
        except Exception as e:
            print(f"Error summarizing text: {str(e)}")
            # 요약 실패 시 원본 텍스트의 일부 반환
            return text[:int(10000 * summary_ratio)]
    
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
