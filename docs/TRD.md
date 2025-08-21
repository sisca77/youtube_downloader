## TRD: Technical Requirements & Design

### 아키텍처 개요
- Frontend: Next.js(App Router), TypeScript
- Backend: FastAPI, Pydantic, BackgroundTasks
- Services:
  - `youtube_service.py`: URL 파싱, 자막 추출(youtube-transcript-api), 다운로드(yt-dlp), 메타데이터 수집
  - `youtube_processing_service_simple.py`: 파이프라인 제어(자막 시도 → 다운로드 → Whisper → 요약/해설)
  - `services.py`: OpenAI(Whisper/GPT) 사용
  - `audio_splitter.py`: 25MB 초과 오디오 자동 분할/병합
- 외부 의존성: OpenAI API, yt-dlp(+ffmpeg), youtube-transcript-api

### 데이터 모델(Pydantic)
- `YouTubeProcessRequest`: `youtube_url`, `summary_ratio(0.3|0.5|0.7)`, `download_video: bool`
- `ProcessingStatus`: `task_id`, `status`, `progress`, `message`, `transcript?`, `outline?`, `detailed_explanation?`, `error?`, `metadata?`
- `VideoUploadResponse`: `task_id`, `message`
- `VideoSummaryResult`: `task_id`, `file_name`, `transcript`, `outline`, `processing_time`, `metadata?`

### REST API
- POST `/api/upload`: multipart file + `summary_ratio` → `{ task_id }`
- GET `/api/status/{task_id}`: 처리 상태 반환
- GET `/api/result/{task_id}`: 최종 결과(필요 시 유지)
- DELETE `/api/task/{task_id}`: 파일/상태 정리
- POST `/api/youtube`: `{ youtube_url, summary_ratio, download_video }` → `{ task_id }`
- GET `/api/youtube/status/{task_id}`
- DELETE `/api/youtube/task/{task_id}`
- GET `/api/download/{task_id}`: 원본 미디어 다운로드

### 처리 파이프라인(YouTube)
1) `extract_metadata`
2) `try_extract_subtitles`
   - 자막 있음 → `generate_summary`
   - 자막 없음 → `download(media)` → `Whisper STT`
3) `generate_summary` (GPT)

### 에러 처리
- 자막 추출 실패: 로그 + 다운로드 대체
- yt-dlp 403/포맷 실패: 헤더/포맷/재시도 순회, 명확한 메시지
- Whisper 413: 오디오 분할 처리
- 모든 단계: `tasks[task_id]`에 `status/error/progress` 업데이트

### 보안/환경
- CORS 도메인 제한(프론트 개발 도메인)
- `.env`에 `OPENAI_API_KEY`
- 임시 파일은 cleanup API로 삭제

### 성능/확장성
- I/O 및 대용량 처리에 `asyncio.to_thread` 활용
- 요약 온도 0~0.3, 큰 파일 분할
- BackgroundTasks로 비차단 처리


