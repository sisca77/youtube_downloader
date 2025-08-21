import os
import asyncio
import uuid
import re
from typing import Dict, Optional, Tuple
from pathlib import Path
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter
from openai import OpenAI
from urllib.parse import urlparse, parse_qs


class YouTubeService:
    def __init__(self):
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.upload_dir = Path("uploads")
        self.upload_dir.mkdir(exist_ok=True)
        
    def extract_video_id(self, youtube_url: str) -> Optional[str]:
        """YouTube URL에서 비디오 ID 추출"""
        # 다양한 YouTube URL 형식 지원
        patterns = [
            r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([^&]+)',
            r'(?:https?://)?(?:www\.)?youtube\.com/embed/([^/?]+)',
            r'(?:https?://)?(?:www\.)?youtu\.be/([^/?]+)',
            r'(?:https?://)?(?:www\.)?youtube\.com/v/([^/?]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, youtube_url)
            if match:
                return match.group(1)
        
        return None
    
    async def get_youtube_transcript(self, video_id: str, language: str = 'ko') -> Optional[str]:
        """YouTube 자막 추출"""
        try:
            # 한국어 자막 먼저 시도
            transcript_list = await asyncio.to_thread(
                YouTubeTranscriptApi.list_transcripts, video_id
            )
            
            transcript = None
            
            # 1. 한국어 수동 자막 시도
            try:
                transcript = transcript_list.find_manually_created_transcript(['ko', 'ko-KR'])
            except:
                pass
            
            # 2. 한국어 자동 자막 시도
            if not transcript:
                try:
                    transcript = transcript_list.find_generated_transcript(['ko', 'ko-KR'])
                except:
                    pass
            
            # 3. 영어 수동 자막 시도
            if not transcript:
                try:
                    transcript = transcript_list.find_manually_created_transcript(['en', 'en-US'])
                except:
                    pass
            
            # 4. 영어 자동 자막 시도
            if not transcript:
                try:
                    transcript = transcript_list.find_generated_transcript(['en', 'en-US'])
                except:
                    pass
            
            # 5. 사용 가능한 첫 번째 자막 시도
            if not transcript:
                try:
                    available_transcripts = list(transcript_list)
                    if available_transcripts:
                        transcript = available_transcripts[0]
                except:
                    pass
            
            if not transcript:
                print(f"비디오 {video_id}에 사용 가능한 자막이 없습니다.")
                return None
            
            # 자막 텍스트 추출
            transcript_data = await asyncio.to_thread(transcript.fetch)
            
            # 텍스트만 추출 (시간 정보 제거)
            text_parts = []
            for entry in transcript_data:
                if 'text' in entry and entry['text'].strip():
                    text_parts.append(entry['text'].strip())
            
            transcript_text = ' '.join(text_parts)
            
            if not transcript_text.strip():
                print(f"비디오 {video_id}의 자막이 비어있습니다.")
                return None
            
            return transcript_text
            
        except Exception as e:
            print(f"자막 추출 실패: {e}")
            return None
    
    async def download_youtube_audio(self, youtube_url: str, task_id: str) -> Optional[str]:
        """YouTube 동영상에서 오디오만 다운로드"""
        try:
            output_path = self.upload_dir / f"{task_id}.%(ext)s"
            
            # 여러 형식과 설정을 시도
            format_options = [
                'bestaudio[ext=m4a]',
                'bestaudio[ext=mp3]', 
                'bestaudio/best',
                'best[height<=480]/best',
                'worst'
            ]
            
            for format_opt in format_options:
                try:
                    ydl_opts = {
                        'format': format_opt,
                        'outtmpl': str(output_path),
                        'noplaylist': True,
                        'quiet': True,
                        'no_warnings': True,
                        'extract_flat': False,
                        'writethumbnail': False,
                        'writeinfojson': False,
                        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'referer': 'https://www.youtube.com/',
                        'http_headers': {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        },
                        'extractor_retries': 3,
                        'fragment_retries': 3,
                        'retry_sleep': 1,
                    }
                    
                    # 오디오 전용 다운로드를 위한 후처리
                    if 'audio' in format_opt:
                        ydl_opts.update({
                            'postprocessors': [{
                                'key': 'FFmpegExtractAudio',
                                'preferredcodec': 'mp3',
                                'preferredquality': '192',
                            }],
                        })
                    
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        # 다운로드
                        await asyncio.to_thread(ydl.download, [youtube_url])
                        
                        # 다운로드된 파일 찾기
                        for file in self.upload_dir.glob(f"{task_id}.*"):
                            if file.suffix.lower() in ['.mp3', '.m4a', '.webm', '.mp4', '.wav']:
                                print(f"다운로드 성공: {file}")
                                return str(file)
                    
                    # 이 형식으로 성공했으면 반복문 종료
                    break
                    
                except Exception as format_error:
                    print(f"형식 {format_opt} 다운로드 실패: {format_error}")
                    continue
            
            # 모든 형식 실패
            print("모든 다운로드 형식이 실패했습니다.")
            return None
                
        except Exception as e:
            print(f"YouTube 다운로드 실패: {e}")
            return None
    
    async def get_youtube_metadata(self, youtube_url: str) -> Dict:
        """YouTube 비디오 메타데이터 추출"""
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': False,
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'http_headers': {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = await asyncio.to_thread(ydl.extract_info, youtube_url, download=False)
                
                return {
                    'title': info.get('title', '제목 없음'),
                    'description': info.get('description', ''),
                    'duration': info.get('duration', 0),
                    'uploader': info.get('uploader', '업로더 정보 없음'),
                    'view_count': info.get('view_count', 0),
                }
                
        except Exception as e:
            print(f"메타데이터 추출 실패: {e}")
            return {
                'title': '메타데이터 추출 실패',
                'description': '',
                'duration': 0,
                'uploader': '알 수 없음',
                'view_count': 0,
            }
    
    async def process_youtube_url(self, youtube_url: str, task_id: str, summary_ratio: float = 0.5) -> Tuple[Optional[str], Optional[str], Dict]:
        """
        YouTube URL 처리
        Returns: (transcript, file_path, metadata)
        """
        # 비디오 ID 추출
        video_id = self.extract_video_id(youtube_url)
        if not video_id:
            raise ValueError("유효하지 않은 YouTube URL입니다.")
        
        # 메타데이터 추출
        metadata = await self.get_youtube_metadata(youtube_url)
        
        # 1단계: 자막 추출 시도
        transcript = await self.get_youtube_transcript(video_id)
        
        if transcript:
            # 자막이 있으면 파일 다운로드 없이 바로 반환
            return transcript, None, metadata
        else:
            # 2단계: 자막이 없으면 오디오 다운로드
            file_path = await self.download_youtube_audio(youtube_url, task_id)
            if not file_path:
                raise Exception("YouTube 동영상 다운로드에 실패했습니다.")
            
            return None, file_path, metadata
    
    async def generate_summary_and_explanation(self, transcript: str, metadata: Dict, summary_ratio: float = 0.5) -> Tuple[str, str]:
        """자막을 바탕으로 요약 및 상세 해설 생성"""
        try:
            # 요약 길이 결정
            ratio_descriptions = {
                0.3: "매우 간략한",
                0.5: "적당한",
                0.7: "상세한"
            }
            
            summary_level = ratio_descriptions.get(summary_ratio, "적당한")
            
            # 요약 생성
            summary_prompt = f"""
다음은 YouTube 동영상의 자막입니다. 이를 바탕으로 {summary_level} 요약을 한국어로 작성해주세요.

동영상 제목: {metadata.get('title', '제목 없음')}
업로더: {metadata.get('uploader', '업로더 정보 없음')}

자막 내용:
{transcript}

요구사항:
1. 구조화된 아웃라인 형식으로 작성
2. 주요 포인트를 명확하게 정리
3. 논리적 흐름을 유지
4. 한국어로 작성
"""

            summary_response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "당신은 YouTube 동영상 내용을 분석하고 요약하는 전문가입니다. 구조화되고 이해하기 쉬운 요약을 제공하세요."},
                    {"role": "user", "content": summary_prompt}
                ],
                temperature=0.3
            )
            
            outline = summary_response.choices[0].message.content
            
            # 상세 해설 생성
            explanation_prompt = f"""
다음 YouTube 동영상의 자막을 바탕으로 상세한 해설을 한국어로 작성해주세요.

동영상 제목: {metadata.get('title', '제목 없음')}
업로더: {metadata.get('uploader', '업로더 정보 없음')}

자막 내용:
{transcript}

요구사항:
1. 동영상의 핵심 메시지와 주요 논점을 상세히 설명
2. 중요한 개념이나 용어에 대한 설명 추가
3. 실용적인 인사이트나 교훈 제시
4. 시청자가 얻을 수 있는 가치를 명확히 전달
5. 한국어로 자연스럽게 작성
"""

            explanation_response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "당신은 교육 콘텐츠 전문가입니다. 복잡한 내용을 이해하기 쉽게 설명하고, 실용적인 인사이트를 제공하세요."},
                    {"role": "user", "content": explanation_prompt}
                ],
                temperature=0.3
            )
            
            detailed_explanation = explanation_response.choices[0].message.content
            
            return outline, detailed_explanation
            
        except Exception as e:
            raise Exception(f"요약 생성 실패: {str(e)}")
