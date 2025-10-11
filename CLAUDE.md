# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SaaS YouTube video downloader and summarization service. Next.js 15 frontend with FastAPI backend. Processes video files or YouTube URLs to extract audio, transcribe using OpenAI Whisper, and generate summaries with GPT-4o-mini. Includes Supabase auth, TossPayments subscription management (Korean payment gateway), usage tracking, and admin dashboard.

## Architecture Overview

**Two-tier processing pipeline:**
1. **Frontend (Next.js 15)**: User auth, payment flow, usage tracking, status polling
2. **Backend (FastAPI)**: Background task processing, OpenAI integration, file management

**Critical architecture decisions:**
- Backend uses in-memory task storage (non-persistent across restarts)
- Frontend polls status endpoints every 2 seconds during processing
- Files >25MB automatically split into chunks for Whisper API (25MB limit)
- YouTube processing: subtitle extraction prioritized over audio download
- Payment webhooks handle async subscription updates from TossPayments

### Backend Core Services
- **services_chunked.py**: File upload processing with automatic audio splitting (AudioSplitter)
- **youtube_processing_service_simple.py**: YouTube workflow orchestrator (subtitle → download → Whisper → summary)
- **youtube_service.py**: yt-dlp integration, subtitle extraction, metadata handling
- **main.py**: FastAPI app with CORS, BackgroundTasks for async processing

### Frontend Core Structure
- **lib/api.ts**: Axios client with separate video/YouTube endpoints
- **lib/toss-payments.ts**: Payment SDK integration with plan definitions (₩0/₩9,900/₩29,900)
- **contexts/AuthContext.tsx**: Supabase auth with user profile state
- **hooks/useUsageTracking.ts**: Monthly usage limit enforcement (5/50/unlimited videos)

### Processing Flows

**File Upload**: Auth check → Usage check → Upload → Extract audio → Whisper STT → GPT summary (30%/50%/70% ratios) → Increment usage

**YouTube**: Auth check → Usage check → Extract metadata → Try subtitles (fallback: download audio) → Whisper STT (if no subtitles) → GPT summary → Increment usage

**Payment**: Select plan → TossPayments SDK → Payment approval → Webhook confirmation → Update subscription & usage limits in Supabase

## Development Commands

### Backend (FastAPI) - Start First
```bash
cd backend
venv\Scripts\activate  # Windows (macOS/Linux: source venv/bin/activate)
python main.py         # Runs on http://localhost:8000
# Alternative: uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev      # http://localhost:3000 (CORS configured for 3000/3001)
npm run build    # Production build
npm start        # Production server
```

**Important:** Backend must run on port 8000 (hardcoded in CORS). Frontend defaults to port 3000.

## Environment Setup

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000          # Backend URL
NEXT_PUBLIC_SUPABASE_URL=                          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=                     # Supabase public key
SUPABASE_SERVICE_ROLE_KEY=                         # Server-side only (API routes)
NEXT_PUBLIC_TOSS_CLIENT_KEY=                       # TossPayments public key
TOSS_SECRET_KEY=                                   # Server-side (payment confirmation)
TOSS_WEBHOOK_SECRET=                               # Webhook signature verification
```

### Backend (`backend/.env`)
```env
OPENAI_API_KEY=                                    # Required for Whisper & GPT
```

### External Dependencies
- **ffmpeg**: Required for audio extraction/splitting. Must be in PATH or `C:\ffmpeg\bin\` (Windows)
- **Python venv**: Backend uses virtual environment in `backend/venv/`
- **Node.js**: Frontend requires Node.js for Next.js

## Common Issues & Debugging

### 404 on `/api/youtube/status/{taskId}`
**Causes:**
- Backend not running on port 8000
- Task ID doesn't exist (tasks stored in-memory, lost on restart)
- CORS misconfiguration

**Fix:** Verify backend is running (`curl http://localhost:8000/` should return API message)

### Large File Processing
Files >25MB auto-split via `audio_splitter.py` (Whisper has 25MB limit). Chunks processed separately, transcripts merged.

### YouTube Download Failures
Expected failures: age-restricted, geo-blocked, private, or copyrighted videos. Service tries multiple formats/headers before failing gracefully with error message.

### ffmpeg Not Found
Backend requires ffmpeg for audio extraction. Windows: Add to PATH or place in `C:\ffmpeg\bin\`. Verify with `ffmpeg -version`.

## Key Technical Details

**Supported formats:** .mp4, .mp3, .wav, .m4a, .webm

**Summary ratios:** 0.3 (30%), 0.5 (50%), 0.7 (70%) - passed to GPT prompt for length control

**Task lifecycle:** Created → Processing (multiple states) → Completed/Failed → Cleaned up (DELETE endpoint)

**In-memory storage:** Backend tasks dictionary is not persistent. Server restart loses all task state.

## API Endpoints

### Backend (FastAPI - port 8000)
**Video Processing:**
- `POST /api/upload` - Upload file, returns `task_id`
- `GET /api/status/{task_id}` - Poll for status (frontend polls every 2s)
- `GET /api/result/{task_id}` - Get completed results
- `DELETE /api/task/{task_id}` - Cleanup files and task state

**YouTube Processing:**
- `POST /api/youtube` - Process URL with `{youtube_url, summary_ratio, download_video}`
- `GET /api/youtube/status/{task_id}` - Poll YouTube processing status
- `DELETE /api/youtube/task/{task_id}` - Cleanup YouTube task

### Frontend API Routes (Next.js - port 3000)
- `POST /api/payments/confirm` - Confirm TossPayments after redirect
- `POST /api/webhooks/toss` - TossPayments webhook for async updates

## Database Schema (Supabase)

**Core tables:**
- `profiles` - User accounts, role ('user'/'admin'), links to auth.users
- `subscriptions` - Plan type ('free'/'pro'/'business'), status, billing period
- `usage_records` - Monthly usage (videos_processed vs plan_limit), unique per user+month
- `payment_history` - TossPayments transaction records
- `video_tasks` - Processing history (NOT used for active task state - that's in-memory)

**Subscription plans:** Free (₩0, 5/month) | Pro (₩9,900, 50/month) | Business (₩29,900, unlimited)

**RLS policies:** Users see own data. Admins see all. Enforced via Supabase RLS with JWT auth.

## Deployment Setup

### Database (Supabase)
1. Create Supabase project
2. Run SQL in order:
   - `database/supabase_schema.sql` - profiles, video_tasks, RLS
   - `database/supabase_subscription_schema.sql` - subscriptions, usage_records, payment_history, triggers
3. First registered user auto-assigned 'admin' role (can modify in Supabase dashboard)

### TossPayments Configuration
1. Register merchant account at TossPayments
2. Get client key (public) and secret key (server-side)
3. Configure webhook URL: `https://yourdomain.com/api/webhooks/toss`
4. Set webhook secret for signature verification

### Admin Features
- Admin dashboard at `/admin` - shows revenue, user list, subscription stats
- Change user role to 'admin' in Supabase profiles table to grant access
- Admins bypass RLS policies (can view all data)

## Development Guidelines (from docs/CURSOR_RULES.md)

**Code changes:**
- Small commits with single purpose
- API/schema changes require coordinated updates: backend models → endpoints → frontend types
- Update requirements.txt or package.json when adding dependencies

**Quality checks:**
- Test local server startup before committing
- Verify main paths work (file upload, YouTube URL)
- Test edge cases: >25MB files, YouTube videos without subtitles, geo-restricted videos

**Anti-patterns:**
- No wide-ranging reformatting (makes reviews hard)
- No hardcoded strings (use constants/enums)
- No empty except blocks