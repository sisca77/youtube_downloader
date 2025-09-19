# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a YouTube video downloader and summarization service with a Next.js frontend and FastAPI backend. The application processes video files or YouTube URLs to extract audio, transcribe speech to text using OpenAI Whisper, and generate structured summaries using GPT models.

## Architecture

### Backend Structure (FastAPI)
- **main.py**: Main FastAPI application with CORS setup and API endpoints
- **services_chunked.py**: Video processing service that handles file upload, audio splitting, and transcript generation
- **youtube_service.py**: Core YouTube processing utilities (URL extraction, metadata, subtitles, downloads)
- **youtube_processing_service_simple.py**: YouTube processing workflow orchestrator
- **models.py**: Pydantic models for API requests/responses

### Frontend Structure (Next.js 15)
- **app/**: Next.js app router structure
- **components/**: React components for file upload, YouTube input, status display, and results
- **lib/api.ts**: Axios-based API client with separate endpoints for video and YouTube processing
- **types/**: TypeScript type definitions

### Key Processing Flows

1. **File Upload Flow**: Upload → Audio extraction → Whisper transcription → GPT summarization
2. **YouTube Flow**: URL input → Metadata extraction → Subtitle extraction (fallback to audio download) → Transcription → Summarization

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm run dev      # Development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Production server
```

### Backend (FastAPI)
```bash
cd backend
# Activate virtual environment first
python main.py   # Development server (http://localhost:8000)
# Or use uvicorn directly:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Environment Setup

### Required Environment Variables
- `OPENAI_API_KEY`: OpenAI API key for Whisper and GPT models
- `NEXT_PUBLIC_API_URL`: Frontend API base URL (defaults to http://localhost:8000)

### Dependencies
- **Backend**: FastAPI, yt-dlp, youtube-transcript-api, openai, aiofiles
- **Frontend**: Next.js 15, React 19, Axios, TailwindCSS, Lucide React icons
- **External**: ffmpeg (for audio processing)

## Common Issues and Solutions

### 404 Error on YouTube Status Endpoint
The error `Request failed with status code 404` on `/api/youtube/status/{taskId}` occurs when:
- Backend server is not running on port 8000
- CORS issues between frontend (port 3000) and backend (port 8000)
- Task ID doesn't exist in the backend task storage

**Solution**: Ensure backend is running and check network connectivity between services.

### Large File Processing
Files over 25MB are automatically split into chunks using ffmpeg before processing with Whisper API.

### YouTube Download Limitations
Some videos may fail to download due to:
- Age restrictions
- Geographic restrictions  
- Private videos
- Copyright protection

The service attempts multiple download formats and falls back gracefully.

## File Processing Flow

1. **Input Validation**: Check file extensions (.mp4, .mp3, .wav, .m4a, .webm)
2. **Size Check**: Files >25MB trigger chunked processing
3. **Audio Extraction**: Use ffmpeg for conversion if needed
4. **Transcription**: OpenAI Whisper API with language detection
5. **Summarization**: GPT-4o-mini with configurable summary ratios (30%, 50%, 70%)

## API Endpoints

### Video Processing
- `POST /api/upload` - Upload video file
- `GET /api/status/{task_id}` - Get processing status
- `GET /api/result/{task_id}` - Get final results
- `DELETE /api/task/{task_id}` - Cleanup task

### YouTube Processing  
- `POST /api/youtube` - Process YouTube URL
- `GET /api/youtube/status/{task_id}` - Get YouTube processing status
- `DELETE /api/youtube/task/{task_id}` - Cleanup YouTube task

## Testing
Always test both file upload and YouTube URL processing workflows. Verify error handling for invalid URLs, large files, and API failures.