# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SaaS YouTube video downloader and summarization service with a Next.js frontend and FastAPI backend. The application processes video files or YouTube URLs to extract audio, transcribe speech to text using OpenAI Whisper, and generate structured summaries using GPT models. The service includes user authentication, subscription management with TossPayments integration, usage tracking, and an admin dashboard.

## Architecture

### Backend Structure (FastAPI)
- **main.py**: Main FastAPI application with CORS setup and API endpoints
- **services_chunked.py**: Video processing service that handles file upload, audio splitting, and transcript generation
- **youtube_service.py**: Core YouTube processing utilities (URL extraction, metadata, subtitles, downloads)
- **youtube_processing_service_simple.py**: YouTube processing workflow orchestrator
- **models.py**: Pydantic models for API requests/responses

### Frontend Structure (Next.js 15)
- **app/**: Next.js app router structure with pages for pricing, profile, admin, and payment flows
- **components/**: React components for file upload, YouTube input, status display, results, authentication, and usage tracking
- **contexts/AuthContext.tsx**: Authentication context with Supabase integration
- **hooks/useUsageTracking.ts**: Custom hook for subscription usage tracking
- **lib/api.ts**: Axios-based API client with separate endpoints for video and YouTube processing
- **lib/toss-payments.ts**: TossPayments integration service with pricing plans
- **lib/supabase.ts**: Supabase client configuration
- **types/**: TypeScript type definitions for users, subscriptions, and payments

### Key Processing Flows

1. **File Upload Flow**: Authentication check → Usage limit check → Upload → Audio extraction → Whisper transcription → GPT summarization → Usage increment
2. **YouTube Flow**: Authentication check → Usage limit check → URL input → Metadata extraction → Subtitle extraction (fallback to audio download) → Transcription → Summarization → Usage increment
3. **Payment Flow**: Plan selection → TossPayments integration → Payment confirmation → Subscription activation → Usage limit update
4. **Admin Flow**: Revenue tracking → User management → Subscription monitoring → Usage analytics

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

#### Frontend
- `NEXT_PUBLIC_API_URL`: Backend API base URL (defaults to http://localhost:8000)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (for API routes)
- `NEXT_PUBLIC_TOSS_CLIENT_KEY`: TossPayments client key
- `TOSS_SECRET_KEY`: TossPayments secret key (for payment confirmation)
- `TOSS_WEBHOOK_SECRET`: TossPayments webhook secret (for webhook verification)

#### Backend
- `OPENAI_API_KEY`: OpenAI API key for Whisper and GPT models

### Dependencies
- **Backend**: FastAPI, yt-dlp, youtube-transcript-api, openai, aiofiles
- **Frontend**: Next.js 15, React 19, Axios, TailwindCSS, Lucide React icons, @supabase/supabase-js, @tosspayments/payment-sdk
- **Database**: PostgreSQL with Supabase (RLS enabled)
- **Payment**: TossPayments for Korean payment processing
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

### Video Processing (Backend)
- `POST /api/upload` - Upload video file
- `GET /api/status/{task_id}` - Get processing status
- `GET /api/result/{task_id}` - Get final results
- `DELETE /api/task/{task_id}` - Cleanup task

### YouTube Processing (Backend)
- `POST /api/youtube` - Process YouTube URL
- `GET /api/youtube/status/{task_id}` - Get YouTube processing status
- `DELETE /api/youtube/task/{task_id}` - Cleanup YouTube task

### Payment Processing (Frontend API Routes)
- `POST /api/payments/confirm` - Confirm TossPayments payment
- `POST /api/webhooks/toss` - Handle TossPayments webhooks

### Database Schema
#### Tables
- **profiles**: User accounts with role-based access
- **subscriptions**: User subscription plans and status
- **usage_records**: Monthly usage tracking per user
- **payment_history**: Payment transaction records
- **video_tasks**: Video processing task history

#### Subscription Plans
- **Free**: ₩0/month, 5 videos/month
- **Pro**: ₩9,900/month, 50 videos/month (recommended)
- **Business**: ₩29,900/month, unlimited videos/month

## Testing
Always test both file upload and YouTube URL processing workflows. Verify error handling for invalid URLs, large files, and API failures.

### SaaS Features to Test
- User registration and authentication flow
- Subscription plan selection and payment processing
- Usage limit enforcement and tracking
- Admin dashboard revenue and user management
- Payment webhook handling and subscription updates
- Profile page subscription management and cancellation

## Deployment Notes

### Database Setup
1. Set up Supabase project and obtain connection details
2. Run `database/supabase_schema.sql` to create user profiles and video tasks tables
3. Run `database/supabase_subscription_schema.sql` to create subscription and payment tables
4. Configure RLS policies for data security

### TossPayments Setup
1. Register for TossPayments merchant account
2. Obtain client key and secret key from TossPayments dashboard
3. Configure webhook endpoint: `https://yourdomain.com/api/webhooks/toss`
4. Set webhook secret for signature verification

### Environment Configuration
Create `.env.local` file in frontend directory with all required environment variables listed above.

## Admin Access
- First user to register becomes admin by default (can be changed in database)
- Admin dashboard available at `/admin` with revenue tracking and user management
- Admins can view all users, subscriptions, and payment history