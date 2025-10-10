# 영상 요약 서비스

OpenAI Whisper를 활용한 YouTube 영상 및 비디오 파일 요약 서비스입니다. 사용자 인증, 관리자 기능, 작업 히스토리 등의 기능을 포함합니다.

## 주요 기능

- **비디오 파일 업로드**: MP4, MP3, WAV, M4A, WebM 파일 지원
- **YouTube URL 처리**: 자막 추출 또는 오디오 다운로드 후 처리
- **AI 기반 요약**: OpenAI Whisper (음성→텍스트) + GPT-4 (요약 생성)
- **사용자 인증**: Supabase 기반 회원가입/로그인
- **작업 히스토리**: 사용자별 처리 이력 관리
- **관리자 기능**: 사용자 관리 및 작업 모니터링
- **반응형 UI**: TailwindCSS 기반 모던 인터페이스
- **실시간 처리**: 처리 진행 상황 실시간 표시
- **대용량 파일**: 자동 분할 처리 (25MB 이상)
- **요약 비율**: 30%, 50%, 70% 선택 가능

## 기술 스택

### Frontend
- **Next.js 15** (React 19)
- **TypeScript**
- **TailwindCSS 4**
- **Supabase Client**
- **Axios** (API 통신)
- **Lucide React** (아이콘)

### Backend
- **FastAPI** (Python)
- **OpenAI API** (Whisper, GPT-4)
- **yt-dlp** (YouTube 다운로드)
- **ffmpeg** (오디오 처리)
- **youtube-transcript-api** (자막 추출)

### Database
- **Supabase** (PostgreSQL + 인증)

## 설치 및 설정

### 1. 저장소 클론
```bash
git clone <repository-url>
cd youtube_downloader
```

### 2. Supabase 프로젝트 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 데이터베이스 스키마 적용:
   ```sql
   -- database/supabase_schema.sql 파일의 내용을 Supabase SQL 에디터에서 실행
   ```

### 3. 환경 변수 설정

#### Frontend (.env.local)
```bash
cd frontend
cp .env.local.example .env.local
```

`.env.local` 파일 편집:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### Backend (.env)
```bash
cd backend
# .env 파일 생성
```

`.env` 파일 내용:
```env
OPENAI_API_KEY=your_openai_api_key
```

### 4. 의존성 설치

#### Frontend
```bash
cd frontend
npm install
```

#### Backend
```bash
cd backend
# 가상환경 생성 (권장)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install fastapi uvicorn openai yt-dlp youtube-transcript-api aiofiles python-dotenv
```

### 5. ffmpeg 설치

#### Windows
1. [FFmpeg 다운로드](https://ffmpeg.org/download.html)
2. PATH에 추가하거나 `C:\ffmpeg\bin\` 경로에 설치

#### macOS
```bash
brew install ffmpeg
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg
```

## 실행

### 개발 환경

1. **Backend 서버 실행**:
```bash
cd backend
python main.py
# 또는
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. **Frontend 서버 실행**:
```bash
cd frontend
npm run dev
```

3. 브라우저에서 `http://localhost:3000` 접속

### 프로덕션 환경

#### Frontend 빌드
```bash
cd frontend
npm run build
npm start
```

#### Backend 프로덕션 실행
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 사용법

### 일반 사용자

1. **회원가입/로그인**
   - 우상단 "로그인" 버튼 클릭
   - 이메일로 회원가입 또는 로그인

2. **파일 업로드**
   - "파일 업로드" 탭에서 비디오/오디오 파일 선택
   - 요약 비율 설정 (30%, 50%, 70%)
   - "영상 분석 시작" 클릭

3. **YouTube 처리**
   - "YouTube URL" 탭에서 URL 입력
   - 요약 비율 설정
   - 비디오 다운로드 옵션 선택 (선택사항)

4. **히스토리 확인**
   - "히스토리" 탭에서 과거 작업 확인
   - 완료된 작업의 결과 다시 보기

### 관리자

1. **관리자 권한 설정**
   - Supabase 대시보드에서 사용자의 `role`을 `admin`으로 변경

2. **관리자 페이지 접속**
   - `/admin` 경로로 직접 접속
   - 또는 프로필 드롭다운에서 "관리자 페이지" 클릭

3. **기능**
   - 전체 사용자 관리
   - 사용자 권한 변경
   - 전체 작업 모니터링
   - 시스템 통계 확인

## API 엔드포인트

### 비디오 처리
- `POST /api/upload` - 파일 업로드
- `GET /api/status/{task_id}` - 처리 상태 조회
- `GET /api/result/{task_id}` - 결과 조회
- `DELETE /api/task/{task_id}` - 작업 정리

### YouTube 처리  
- `POST /api/youtube` - YouTube URL 처리
- `GET /api/youtube/status/{task_id}` - YouTube 처리 상태
- `DELETE /api/youtube/task/{task_id}` - YouTube 작업 정리

## 데이터베이스 스키마

### profiles 테이블
- 사용자 프로필 정보
- 권한 관리 (user/admin)

### video_tasks 테이블
- 사용자별 작업 이력
- 처리 상태 및 결과 저장
- JSON 메타데이터 지원

## 보안 기능

- **Row Level Security (RLS)**: 사용자별 데이터 접근 제어
- **JWT 인증**: Supabase 기반 안전한 인증
- **CORS 설정**: 안전한 API 접근
- **입력 검증**: 파일 형식 및 크기 제한

## 문제 해결

### 404 에러 (YouTube 상태 조회)
- 백엔드 서버가 포트 8000에서 실행 중인지 확인
- CORS 설정 확인
- 존재하지 않는 task_id 확인

### ffmpeg 관련 오류
- ffmpeg가 설치되어 있고 PATH에 등록되어 있는지 확인
- Windows의 경우 `C:\ffmpeg\bin\ffmpeg.exe` 경로 확인

### Supabase 연결 오류
- 환경 변수 설정 확인
- Supabase 프로젝트 URL 및 키 확인
- 네트워크 연결 상태 확인

## 라이선스

MIT License

## 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
