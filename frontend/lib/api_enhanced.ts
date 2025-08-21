import axios from 'axios';
import { VideoUploadResponse, ProcessingStatus, VideoSummaryResult } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const videoApi = {
  // 비디오 업로드
  uploadVideo: async (file: File, summaryRatio: number = 0.5): Promise<VideoUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('summary_ratio', summaryRatio.toString());

    const response = await api.post<VideoUploadResponse>('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 처리 상태 조회
  getStatus: async (taskId: string): Promise<ProcessingStatus> => {
    const response = await api.get<ProcessingStatus>(`/api/status/${taskId}`);
    return response.data;
  },

  // 결과 조회
  getResult: async (taskId: string): Promise<VideoSummaryResult> => {
    const response = await api.get<VideoSummaryResult>(`/api/result/${taskId}`);
    return response.data;
  },

  // 작업 정리
  cleanupTask: async (taskId: string): Promise<void> => {
    await api.delete(`/api/task/${taskId}`);
  },
};

export const youtubeApi = {
  // YouTube URL 처리 (download_video 옵션 추가)
  processYouTubeUrl: async (youtubeUrl: string, summaryRatio: number = 0.5, downloadVideo: boolean = false): Promise<VideoUploadResponse> => {
    const response = await api.post<VideoUploadResponse>('/api/youtube', {
      youtube_url: youtubeUrl,
      summary_ratio: summaryRatio,
      download_video: downloadVideo,
    });
    return response.data;
  },

  // YouTube 처리 상태 조회
  getYouTubeStatus: async (taskId: string): Promise<ProcessingStatus> => {
    const response = await api.get<ProcessingStatus>(`/api/youtube/status/${taskId}`);
    return response.data;
  },

  // YouTube 작업 정리
  cleanupYouTubeTask: async (taskId: string): Promise<void> => {
    await api.delete(`/api/youtube/task/${taskId}`);
  },

  // 파일 다운로드
  downloadFile: async (taskId: string): Promise<void> => {
    const response = await api.get(`/api/download/${taskId}`, {
      responseType: 'blob',
    });
    
    // 파일 다운로드 처리
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // 파일명 추출 (Content-Disposition 헤더에서)
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

