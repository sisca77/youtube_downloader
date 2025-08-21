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
