## Requirements

### Functional
- 파일 업로드로 요약 제공(자막/아웃라인/해설)
- YouTube URL 입력으로 요약 제공
- 요약 비율(0.3/0.5/0.7) 선택
- YouTube 다운로드 옵션(오디오만/비디오+오디오) 선택
- 처리 상태 폴링, 실패 시 오류 메시지 노출
- 결과(스크립트/요약/해설) 텍스트 다운로드
- 완료된 작업의 원본 미디어 다운로드
- 작업 정리(파일 삭제 및 상태 제거)

### Non-Functional
- 안정성: 실패 시 친절한 메시지 + 재시도 지침
- 성능: 20분 미만 영상 기준 < 5분 목표(네트워크/모델 가변)
- 확장성: YouTube 장애 시 대체 로직(다운로드/자막/Whisper)
- 보안: API Key 비공개, 최소 권한, 민감정보 로깅 금지
- 호환: 최신 Chrome/Edge, Windows 10+ 개발환경 기준

### Tech Stack / Versions
- Backend: FastAPI, Uvicorn, Pydantic, aiofiles
- OpenAI SDK(Whisper/GPT), httpx
- yt-dlp(latest), youtube-transcript-api, pydub
- ffmpeg 필요

### API Contracts (요약)
- POST `/api/youtube` → req: `{ youtube_url, summary_ratio: 0.3|0.5|0.7, download_video: bool }` / res: `{ task_id, message }`
- GET `/api/youtube/status/{task_id}` → `ProcessingStatus`
- GET `/api/download/{task_id}` → file stream

### 위험/대응
- Whisper 413: AudioSplitter로 분할 → 청크별 인식 → 병합
- yt-dlp 403/차단: UA/Referer/포맷 전환/재시도
- 초장시간 영상: 처리시간/비용 증가 → 안내 및 진행률 고도화


