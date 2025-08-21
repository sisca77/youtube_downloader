'use client';

import { useState } from 'react';
import { Youtube, Link } from 'lucide-react';

interface YouTubeInputProps {
  onSubmit: (url: string, downloadVideo: boolean) => void;
  isProcessing: boolean;
}

export default function YouTubeInput({ onSubmit, isProcessing }: YouTubeInputProps) {
  const [url, setUrl] = useState('');
  const [downloadVideo, setDownloadVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('YouTube URL을 입력해주세요.');
      return;
    }

    if (!validateYouTubeUrl(url)) {
      setError('올바른 YouTube URL을 입력해주세요.');
      return;
    }

    setError(null);
    onSubmit(url.trim(), downloadVideo);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    if (error) setError(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Youtube className="w-6 h-6 text-red-600" />
        <h3 className="text-lg font-semibold text-gray-900">YouTube 영상 분석</h3>
      </div>
      
      <p className="text-gray-600 mb-4">
        YouTube URL을 입력하면 자막을 추출하거나 음성을 텍스트로 변환하여 요약을 제공합니다.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700 mb-2">
            YouTube URL
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Link className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="youtube-url"
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://www.youtube.com/watch?v=..."
              className={`
                block w-full pl-10 pr-3 py-2 border rounded-md shadow-sm 
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                ${error 
                  ? 'border-red-300 text-red-900 placeholder-red-300' 
                  : 'border-gray-300 text-gray-900 placeholder-gray-500'
                }
                ${isProcessing ? 'bg-gray-50' : 'bg-white'}
              `}
              disabled={isProcessing}
            />
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* 다운로드 옵션 */}
        <div className="mb-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={downloadVideo}
              onChange={(e) => setDownloadVideo(e.target.checked)}
              className="rounded"
              disabled={isProcessing}
            />
            <span className="text-sm text-gray-700">
              🎬 비디오 포함 다운로드 (파일 크기가 커집니다)
            </span>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isProcessing || !url.trim()}
            className={`
              px-6 py-2 rounded-md font-medium transition-all
              ${isProcessing || !url.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
              }
            `}
          >
            {isProcessing ? '처리 중...' : 'YouTube 영상 분석'}
          </button>
        </div>
      </form>

      <div className="mt-4 p-3 bg-blue-50 rounded-md">
        <h4 className="text-sm font-medium text-blue-900 mb-1">지원되는 URL 형식</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• https://www.youtube.com/watch?v=VIDEO_ID</li>
          <li>• https://youtu.be/VIDEO_ID</li>
          <li>• https://www.youtube.com/embed/VIDEO_ID</li>
        </ul>
      </div>

      {downloadVideo && (
        <div className="mt-4 p-3 bg-yellow-50 rounded-md">
          <h4 className="text-sm font-medium text-yellow-900 mb-1">비디오 다운로드 주의사항</h4>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• 파일 크기가 크므로 다운로드 시간이 오래 걸릴 수 있습니다</li>
            <li>• 일부 동영상은 저작권으로 인해 다운로드가 제한될 수 있습니다</li>
            <li>• 고화질 비디오는 처리 시간이 더 오래 걸립니다</li>
          </ul>
        </div>
      )}
    </div>
  );
}

