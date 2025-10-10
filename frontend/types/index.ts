export interface VideoUploadResponse {
  task_id: string;
  message: string;
}

export interface VideoUploadParams {
  file: File;
  summaryRatio: number; // 0.3, 0.5, 0.7
}

export interface ProcessingStatus {
  task_id: string;
  status: 'processing' | 'splitting_file' | 'extracting_transcript' | 'generating_outline' | 'extracting_metadata' | 'extracting_subtitles' | 'downloading_audio' | 'generating_summary' | 'completed' | 'failed';
  progress: number;
  message: string;
  transcript?: string;
  outline?: string;
  detailed_explanation?: string;
  error?: string;
  metadata?: YouTubeMetadata;
}

export interface VideoSummaryResult {
  task_id: string;
  file_name: string;
  transcript: string;
  outline: string;
  processing_time: number;
  metadata?: YouTubeMetadata;
}

export interface YouTubeMetadata {
  title: string;
  description: string;
  duration: number;
  uploader: string;
  view_count: number;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface AuthFormData {
  email: string;
  password: string;
  full_name?: string;
}

export interface VideoTask {
  id: string;
  user_id: string;
  task_id: string;
  file_name: string | null;
  youtube_url: string | null;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  transcript: string | null;
  outline: string | null;
  detailed_explanation: string | null;
  metadata: YouTubeMetadata | null;
  summary_ratio: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'free' | 'pro' | 'business';
  status: 'active' | 'cancelled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  id: string;
  user_id: string;
  month_year: string;
  videos_processed: number;
  plan_limit: number;
  created_at: string;
  updated_at: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  monthly_limit: number;
  features: string[];
  recommended?: boolean;
}

export interface PaymentRequest {
  plan_type: string;
  amount: number;
  order_name: string;
}
