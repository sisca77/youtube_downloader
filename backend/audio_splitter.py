import os
import asyncio
from typing import List, Optional
from pathlib import Path
from pydub import AudioSegment
from pydub.utils import make_chunks


class AudioSplitter:
    def __init__(self, max_file_size_mb: float = 24.0):
        """
        오디오 파일 분할기
        
        Args:
            max_file_size_mb: 최대 파일 크기 (MB). OpenAI Whisper 제한은 25MB이므로 안전하게 24MB로 설정
        """
        self.max_file_size_bytes = int(max_file_size_mb * 1024 * 1024)
    
    def get_file_size(self, file_path: str) -> int:
        """파일 크기를 바이트 단위로 반환"""
        return os.path.getsize(file_path)
    
    def needs_splitting(self, file_path: str) -> bool:
        """파일이 분할이 필요한지 확인"""
        return self.get_file_size(file_path) > self.max_file_size_bytes
    
    async def split_audio_file(self, input_file_path: str, output_dir: Optional[str] = None) -> List[str]:
        """
        오디오 파일을 작은 청크로 분할
        
        Args:
            input_file_path: 입력 오디오 파일 경로
            output_dir: 출력 디렉토리 (None이면 입력 파일과 같은 디렉토리)
            
        Returns:
            분할된 파일들의 경로 리스트
        """
        try:
            input_path = Path(input_file_path)
            
            if output_dir is None:
                output_dir = input_path.parent
            else:
                output_dir = Path(output_dir)
                output_dir.mkdir(exist_ok=True)
            
            print(f"오디오 파일 분할 시작: {input_file_path}")
            print(f"파일 크기: {self.get_file_size(input_file_path) / 1024 / 1024:.2f}MB")
            
            # 오디오 파일 로드
            audio = await asyncio.to_thread(AudioSegment.from_file, input_file_path)
            
            # 파일 크기 기반으로 청크 길이 계산
            total_duration_ms = len(audio)
            file_size_bytes = self.get_file_size(input_file_path)
            
            # 비례 계산으로 청크 길이 결정
            chunk_duration_ms = int((total_duration_ms * self.max_file_size_bytes) / file_size_bytes * 0.9)  # 90% 안전 마진
            
            # 최소 30초, 최대 20분으로 제한
            chunk_duration_ms = max(30000, min(chunk_duration_ms, 1200000))
            
            print(f"청크 길이: {chunk_duration_ms / 1000:.1f}초")
            
            # 청크로 분할
            chunks = make_chunks(audio, chunk_duration_ms)
            
            chunk_files = []
            base_name = input_path.stem
            
            for i, chunk in enumerate(chunks):
                chunk_filename = f"{base_name}_chunk_{i:03d}.mp3"
                chunk_path = output_dir / chunk_filename
                
                # 청크를 파일로 저장
                await asyncio.to_thread(chunk.export, str(chunk_path), format="mp3")
                
                chunk_size_mb = self.get_file_size(str(chunk_path)) / 1024 / 1024
                print(f"청크 {i+1}/{len(chunks)} 생성: {chunk_filename} ({chunk_size_mb:.2f}MB)")
                
                chunk_files.append(str(chunk_path))
            
            print(f"오디오 분할 완료: {len(chunk_files)}개 청크 생성")
            return chunk_files
            
        except Exception as e:
            print(f"오디오 분할 실패: {e}")
            raise
    
    async def transcribe_chunks(self, chunk_files: List[str], openai_client, language: str = "ko") -> str:
        """
        분할된 오디오 청크들을 순차적으로 음성 인식하여 텍스트로 변환
        
        Args:
            chunk_files: 분할된 오디오 파일 경로 리스트
            openai_client: OpenAI 클라이언트
            language: 언어 코드
            
        Returns:
            모든 청크의 텍스트를 합친 전체 텍스트
        """
        try:
            all_transcripts = []
            
            for i, chunk_file in enumerate(chunk_files):
                print(f"음성 인식 진행 중: {i+1}/{len(chunk_files)} - {Path(chunk_file).name}")
                
                with open(chunk_file, "rb") as audio_file:
                    transcript_response = await asyncio.to_thread(
                        openai_client.audio.transcriptions.create,
                        model="whisper-1",
                        file=audio_file,
                        language=language
                    )
                
                chunk_text = transcript_response.text.strip()
                if chunk_text:
                    all_transcripts.append(chunk_text)
                    print(f"청크 {i+1} 완료: {len(chunk_text)} 글자")
            
            # 모든 텍스트 합치기
            full_transcript = " ".join(all_transcripts)
            print(f"전체 음성 인식 완료: {len(full_transcript)} 글자")
            
            return full_transcript
            
        except Exception as e:
            print(f"청크 음성 인식 실패: {e}")
            raise
    
    def cleanup_chunks(self, chunk_files: List[str]):
        """분할된 청크 파일들 삭제"""
        for chunk_file in chunk_files:
            try:
                if os.path.exists(chunk_file):
                    os.remove(chunk_file)
                    print(f"청크 파일 삭제: {Path(chunk_file).name}")
            except Exception as e:
                print(f"청크 파일 삭제 실패 {chunk_file}: {e}")
    
    async def process_large_audio_file(self, file_path: str, openai_client, language: str = "ko") -> str:
        """
        큰 오디오 파일을 처리하는 메인 함수
        
        Args:
            file_path: 오디오 파일 경로
            openai_client: OpenAI 클라이언트
            language: 언어 코드
            
        Returns:
            전체 텍스트
        """
        if not self.needs_splitting(file_path):
            # 파일이 작으면 바로 처리
            print("파일 크기가 제한 내에 있어 바로 처리합니다.")
            with open(file_path, "rb") as audio_file:
                transcript_response = await asyncio.to_thread(
                    openai_client.audio.transcriptions.create,
                    model="whisper-1",
                    file=audio_file,
                    language=language
                )
            return transcript_response.text
        
        # 파일이 크면 분할 처리
        print("파일이 커서 분할 처리합니다.")
        chunk_files = await self.split_audio_file(file_path)
        
        try:
            transcript = await self.transcribe_chunks(chunk_files, openai_client, language)
            return transcript
        finally:
            # 청크 파일들 정리
            self.cleanup_chunks(chunk_files)
