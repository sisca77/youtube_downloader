'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { youtubeApi } from '@/lib/api';

interface DownloadButtonsProps {
  transcript?: string;
  outline?: string;
  detailedExplanation?: string;
  fileName?: string;
  taskId?: string;
  isYouTubeTask?: boolean;
}

export default function DownloadButtons({ 
  transcript, 
  outline, 
  detailedExplanation, 
  fileName = 'video_summary',
  taskId,
  isYouTubeTask = false
}: DownloadButtonsProps) {
  
  const downloadText = (content: string, filename: string, extension: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileDownload = async () => {
    if (!taskId) return;
    
    try {
      await youtubeApi.downloadFile(taskId);
    } catch (error) {
      console.error('File download failed:', error);
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Download className="w-5 h-5 text-blue-600 mr-2" />
        다운로드
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 기존 텍스트 다운로드 버튼들 */}
        {transcript && (
          <button
            onClick={() => downloadText(transcript, fileName, 'txt')}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>전체 스크립트</span>
          </button>
        )}

        {outline && (
          <button
            onClick={() => downloadText(outline, `${fileName}_outline`, 'txt')}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>요약</span>
          </button>
        )}

        {detailedExplanation && (
          <button
            onClick={() => downloadText(detailedExplanation, `${fileName}_explanation`, 'txt')}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>상세 해설</span>
          </button>
        )}

        {/* 새로운 원본 파일 다운로드 버튼 */}
        {isYouTubeTask && taskId && (
          <button
            onClick={handleFileDownload}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>원본 파일</span>
          </button>
        )}
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-600">
          💡 팁: 텍스트 파일은 메모장이나 워드로 열 수 있습니다. 
          {isYouTubeTask && " 원본 파일은 미디어 플레이어로 재생할 수 있습니다."}
        </p>
      </div>
    </div>
  );
}

