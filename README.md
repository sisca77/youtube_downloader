# 영상 요약 서비스

OpenAI Whisper와 GPT-4를 활용하여 영상 파일의 내용을 자동으로 요약하는 웹 애플리케이션입니다.

## 주요 기능

- 🎥 영상/음성 파일 업로드 (MP4, MP3, WAV, M4A, WebM 지원)
- 🎙️ OpenAI Whisper를 통한 음성-텍스트 변환
- 📝 GPT-4를 활용한 한국어 아웃라인 자동 생성
- 💡 AI가 작성한 상세 해설 문서 자동 생성
- 📊 실시간 처리 진행 상황 표시
- 📑 탭 형식의 결과 표시 (원본, 요약, AI 해설)
- 🔄 대용량 파일 자동 분할 처리 (25MB 이상)
- 📏 요약 비율 선택 가능 (30%, 50%, 70%)
- ⬇️ 스크립트 원본, 요약, AI 해설 다운로드 기능

## 기술 스택

### Backend
- FastAPI
- OpenAI API (Whisper, GPT-4)
- LangChain & LangGraph
- Python 3.8+

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Dropzone

## 설치 및 실행

### 필수 요구사항
- Python 3.8 이상
- Node.js 18 이상
- OpenAI API 키
- FFmpeg (대용량 파일 처리 시 필요)

### 0. FFmpeg 설치 (선택사항, 대용량 파일 처리 시 필요)

#### Windows
1. https://ffmpeg.org/download.html 에서 Windows 빌드 다운로드
2. 압축 해제 후 C:\ffmpeg 에 설치
3. 시스템 환경 변수 PATH에 C:\ffmpeg\bin 추가

#### macOS
```bash
brew install ffmpeg
```

#### Linux
```bash
sudo apt update
sudo apt install ffmpeg
```

### 1. 저장소 클론
```bash
git clone <repository-url>
cd video-summary-app
```

### 2. Backend 설정

1. 백엔드 디렉토리로 이동:
```bash
cd backend
```

2. 가상환경 생성 및 활성화:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python -m venv venv
source venv/bin/activate
```

3. 의존성 설치:
```bash
pip install -r requirements.txt
```

4. 환경 변수 설정:
`.env` 파일을 생성하고 다음 내용을 추가:
```
OPENAI_API_KEY=your_openai_api_key_here
```

5. 서버 실행:
```bash
python main.py
```

백엔드 서버가 http://localhost:8000 에서 실행됩니다.

### 3. Frontend 설정

1. 새 터미널을 열고 프론트엔드 디렉토리로 이동:
```bash
cd frontend
```

2. 의존성 설치:
```bash
npm install
```

3. 환경 변수 설정:
`.env.local` 파일을 생성하고 다음 내용을 추가:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. 개발 서버 실행:
```bash
npm run dev
```

프론트엔드가 http://localhost:3000 에서 실행됩니다.

## 사용 방법

1. 웹 브라우저에서 http://localhost:3000 접속
2. 영상 또는 음성 파일을 드래그 앤 드롭하거나 클릭하여 선택
3. 요약 비율 선택 (30%, 50%, 70%)
   - 30%: 핵심만 간략히
   - 50%: 균형잡힌 요약
   - 70%: 상세한 요약
4. "영상 분석 시작" 버튼 클릭
5. 처리 진행 상황을 실시간으로 확인
6. 완료되면 탭을 통해 다음 결과 확인:
   - 원본 스크립트: 전체 음성 텍스트
   - 요약 아웃라인: 구조화된 요약
   - AI 해설: 이해하기 쉬운 상세 설명 문서
7. 필요시 스크립트 원본, 요약, AI 해설 다운로드

## API 엔드포인트

- `POST /api/upload` - 영상 파일 업로드
- `GET /api/status/{task_id}` - 처리 상태 조회
- `GET /api/result/{task_id}` - 처리 결과 조회
- `DELETE /api/task/{task_id}` - 작업 정리

## 프로젝트 구조

```
video-summary-app/
├── backend/
│   ├── main.py          # FastAPI 애플리케이션
│   ├── models.py        # Pydantic 모델
│   ├── services.py      # 비즈니스 로직
│   ├── requirements.txt # Python 의존성
│   └── uploads/         # 업로드된 파일 저장 (자동 생성)
│
└── frontend/
    ├── app/             # Next.js App Router
    ├── components/      # React 컴포넌트
    ├── lib/            # API 클라이언트
    ├── types/          # TypeScript 타입 정의
    └── package.json    # Node.js 의존성
```

## 주의사항

- OpenAI API 사용량에 따라 비용이 발생할 수 있습니다
- 대용량 파일 처리 시 시간이 오래 걸릴 수 있습니다
- 업로드된 파일은 처리 후 자동으로 삭제됩니다

## 대용량 파일 처리

25MB 이상의 파일은 자동으로 10분 단위로 분할되어 처리됩니다:
- FFmpeg가 설치되어 있어야 합니다
- 처리 시간이 길어질 수 있습니다
- 진행 상황이 실시간으로 표시됩니다

FFmpeg가 없는 경우:
- 25MB 이하 파일만 처리 가능
- 대용량 파일은 수동으로 분할 필요

## 문제 해결

### CORS 오류
백엔드의 `main.py`에서 CORS 설정을 확인하세요. 프론트엔드 URL이 허용 목록에 포함되어 있어야 합니다.

### OpenAI API 오류
- API 키가 올바른지 확인하세요
- API 사용 한도를 확인하세요
- 네트워크 연결을 확인하세요

### 파일 업로드 실패
- 지원하는 파일 형식인지 확인하세요
- 파일 크기가 너무 크지 않은지 확인하세요

## 라이선스

MIT License
