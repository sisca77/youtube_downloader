'use client';

import { useState, useEffect, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import YouTubeInput from '@/components/YouTubeInput';
import ProcessingStatus from '@/components/ProcessingStatus';
import SummaryRatioSelector from '@/components/SummaryRatioSelector';
import DownloadButtons from '@/components/DownloadButtons';
import ResultTabs from '@/components/ResultTabs';
import UserProfile from '@/components/UserProfile';
import AuthModal from '@/components/Auth/AuthModal';
import TaskHistory from '@/components/TaskHistory';
import UsageIndicator from '@/components/UsageIndicator';
import { videoApi, youtubeApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { supabase } from '@/lib/supabase';
import { ProcessingStatus as ProcessingStatusType } from '@/types';
import { FileVideo, Github, Upload, Youtube, History } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const { usageInfo, checkUsageLimit, incrementUsage } = useUsageTracking();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatusType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryRatio, setSummaryRatio] = useState(0.5);
  const [activeTab, setActiveTab] = useState<'file' | 'youtube' | 'history'>('file');
  const [isYouTubeProcessing, setIsYouTubeProcessing] = useState(false);
  const [isYouTubeTask, setIsYouTubeTask] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // 상태 폴링
  useEffect(() => {
    if (!taskId || processingStatus?.status === 'completed' || processingStatus?.status === 'failed') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const status = isYouTubeTask 
          ? await youtubeApi.getYouTubeStatus(taskId)
          : await videoApi.getStatus(taskId);
        setProcessingStatus(status);

        // 데이터베이스 업데이트
        await updateTaskInDatabase(taskId, {
          status: status.status,
          progress: status.progress,
          transcript: status.transcript,
          outline: status.outline,
          detailed_explanation: status.detailed_explanation,
          metadata: status.metadata,
        });

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    }, 1000); // 1초마다 상태 확인

    return () => clearInterval(interval);
  }, [taskId, processingStatus?.status, isYouTubeTask]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setError(null);
  }, []);

  const saveTaskToDatabase = async (taskData: any, isYouTube: boolean = false) => {
    if (!user) return;

    const taskRecord = {
      id: taskData.task_id,
      user_id: user.id,
      task_id: taskData.task_id,
      file_name: isYouTube ? null : selectedFile?.name || null,
      youtube_url: isYouTube ? taskData.youtube_url : null,
      status: 'processing' as const,
      progress: 0,
      transcript: null,
      outline: null,
      detailed_explanation: null,
      metadata: taskData.metadata || null,
      summary_ratio: summaryRatio,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('video_tasks')
        .insert(taskRecord);

      if (error) {
        console.warn('Could not save task to database:', error);
        // 데이터베이스 저장 실패시 로컬 스토리지에 저장
        saveTaskToLocalStorage(taskRecord);
      }
    } catch (error) {
      console.warn('Database save error:', error);
      // 데이터베이스 오류시 로컬 스토리지에 저장
      saveTaskToLocalStorage(taskRecord);
    }
  };

  const saveTaskToLocalStorage = (taskRecord: any) => {
    try {
      const stored = localStorage.getItem(`tasks_${user?.id}`) || '[]';
      const tasks = JSON.parse(stored);
      tasks.unshift(taskRecord);
      // 최대 20개까지만 저장
      const limitedTasks = tasks.slice(0, 20);
      localStorage.setItem(`tasks_${user?.id}`, JSON.stringify(limitedTasks));
    } catch (error) {
      console.warn('Error saving to localStorage:', error);
    }
  };

  const updateTaskInDatabase = async (taskId: string, updates: any) => {
    if (!user) return;

    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('video_tasks')
        .update(updateData)
        .eq('task_id', taskId)
        .eq('user_id', user.id);

      if (error) {
        console.warn('Could not update task in database:', error);
        // 데이터베이스 업데이트 실패시 로컬 스토리지 업데이트
        updateTaskInLocalStorage(taskId, updateData);
      }
    } catch (error) {
      console.warn('Database update error:', error);
      // 데이터베이스 오류시 로컬 스토리지 업데이트
      updateTaskInLocalStorage(taskId, updateData);
    }
  };

  const updateTaskInLocalStorage = (taskId: string, updates: any) => {
    try {
      const stored = localStorage.getItem(`tasks_${user?.id}`) || '[]';
      const tasks = JSON.parse(stored);
      const updatedTasks = tasks.map((task: any) => 
        task.task_id === taskId ? { ...task, ...updates } : task
      );
      localStorage.setItem(`tasks_${user?.id}`, JSON.stringify(updatedTasks));
    } catch (error) {
      console.warn('Error updating localStorage:', error);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    // 사용량 한도 확인
    if (!checkUsageLimit()) {
      setError('이번 달 사용 한도를 초과했습니다. 플랜을 업그레이드하거나 다음 달을 기다려주세요.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await videoApi.uploadVideo(selectedFile, summaryRatio);
      setTaskId(response.task_id);
      
      // 사용량 증가
      await incrementUsage();
      
      // 데이터베이스에 작업 저장
      await saveTaskToDatabase(response, false);
      
      // 초기 상태 설정
      setProcessingStatus({
        task_id: response.task_id,
        status: 'processing',
        progress: 0,
        message: '업로드 완료. 처리를 시작합니다...',
      });
    } catch (err) {
      setError('파일 업로드에 실패했습니다. 다시 시도해주세요.');
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, summaryRatio, user, checkUsageLimit, incrementUsage]);

  const handleYouTubeSubmit = useCallback(async (youtubeUrl: string, downloadVideo: boolean) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    // 사용량 한도 확인
    if (!checkUsageLimit()) {
      setError('이번 달 사용 한도를 초과했습니다. 플랜을 업그레이드하거나 다음 달을 기다려주세요.');
      return;
    }

    setIsYouTubeProcessing(true);
    setError(null);

    try {
      const response = await youtubeApi.processYouTubeUrl(youtubeUrl, summaryRatio, downloadVideo);
      setTaskId(response.task_id);
      setIsYouTubeTask(true);
      
      // 사용량 증가
      await incrementUsage();
      
      // 데이터베이스에 작업 저장
      await saveTaskToDatabase({ ...response, youtube_url: youtubeUrl }, true);
      
      // 초기 상태 설정
      setProcessingStatus({
        task_id: response.task_id,
        status: 'processing',
        progress: 0,
        message: 'YouTube 영상 처리를 시작합니다...',
      });
    } catch (err) {
      setError('YouTube URL 처리에 실패했습니다. 다시 시도해주세요.');
      console.error('YouTube processing failed:', err);
    } finally {
      setIsYouTubeProcessing(false);
    }
  }, [summaryRatio, user, checkUsageLimit, incrementUsage]);

  const handleReset = useCallback(async () => {
    if (taskId) {
      try {
        if (isYouTubeTask) {
          await youtubeApi.cleanupYouTubeTask(taskId);
        } else {
          await videoApi.cleanupTask(taskId);
        }
      } catch (err: any) {
        // 404 오류는 무시 (이미 삭제된 경우)
        if (err.response?.status !== 404) {
          console.error('Cleanup failed:', err);
        }
      }
    }

    setSelectedFile(null);
    setTaskId(null);
    setProcessingStatus(null);
    setError(null);
    setIsYouTubeTask(false);
    setActiveTab('file');
  }, [taskId, isYouTubeTask]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileVideo className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">영상 요약 서비스</h1>
            </div>
            <div className="flex items-center space-x-4">
              <UserProfile onAuthModalOpen={() => setAuthModalOpen(true)} />
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Github className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-8">
          {/* Introduction */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              OpenAI Whisper를 활용한 영상 요약
            </h2>
            <p className="text-gray-600">
              영상 파일을 업로드하거나 YouTube URL을 입력하면 AI가 자동으로 음성을 텍스트로 변환하고, 
              내용을 분석하여 구조화된 요약을 제공합니다.
            </p>
          </div>

          {/* Input Method Tabs */}
          {!processingStatus ? (
            <>
              {/* Tab Navigation */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('file')}
                    className={`
                      flex-1 flex items-center justify-center space-x-2 px-6 py-4 text-sm font-medium rounded-t-lg transition-colors
                      ${activeTab === 'file'
                        ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Upload className="w-4 h-4" />
                    <span>파일 업로드</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('youtube')}
                    className={`
                      flex-1 flex items-center justify-center space-x-2 px-6 py-4 text-sm font-medium rounded-t-lg transition-colors
                      ${activeTab === 'youtube'
                        ? 'text-red-600 bg-red-50 border-b-2 border-red-600'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Youtube className="w-4 h-4" />
                    <span>YouTube URL</span>
                  </button>
                  {user && (
                    <button
                      onClick={() => setActiveTab('history')}
                      className={`
                        flex-1 flex items-center justify-center space-x-2 px-6 py-4 text-sm font-medium rounded-t-lg transition-colors
                        ${activeTab === 'history'
                          ? 'text-green-600 bg-green-50 border-b-2 border-green-600'
                          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <History className="w-4 h-4" />
                      <span>히스토리</span>
                    </button>
                  )}
                </div>

                <div className="p-6">
                  {activeTab === 'file' ? (
                    <FileUpload onFileSelect={handleFileSelect} isUploading={isUploading} />
                  ) : activeTab === 'youtube' ? (
                    <YouTubeInput onSubmit={handleYouTubeSubmit} isProcessing={isYouTubeProcessing} />
                  ) : (
                    <TaskHistory />
                  )}
                </div>
              </div>

              {/* Usage Indicator */}
              {user && <UsageIndicator />}
              
              {/* Selected File Info and Upload */}
              {activeTab === 'file' && selectedFile && !error && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">선택된 파일:</span> {selectedFile.name}
                      <span className="ml-2 text-xs">
                        ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                      </span>
                    </p>
                  </div>

                  {/* Summary Ratio Selector */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <SummaryRatioSelector
                      value={summaryRatio}
                      onChange={setSummaryRatio}
                      disabled={isUploading}
                    />
                  </div>

                  {/* Upload Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={handleUpload}
                      disabled={isUploading}
                      className={`
                        px-8 py-3 rounded-lg font-medium transition-all
                        ${isUploading 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                        }
                      `}
                    >
                      {isUploading ? '업로드 중...' : '영상 분석 시작'}
                    </button>
                  </div>
                </>
              )}

              {/* Summary Ratio Selector for YouTube */}
              {activeTab === 'youtube' && !isYouTubeProcessing && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <SummaryRatioSelector
                    value={summaryRatio}
                    onChange={setSummaryRatio}
                    disabled={isYouTubeProcessing}
                  />
                </div>
              )}
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{error}</p>
                  {error.includes('사용 한도') && (
                    <div className="mt-2">
                      <a
                        href="/pricing"
                        className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        플랜 업그레이드하기 →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <ProcessingStatus status={processingStatus} />
              
              {processingStatus.status === 'completed' && (
                <>
                  {/* YouTube 메타데이터 표시 */}
                  {isYouTubeTask && processingStatus.metadata && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Youtube className="w-5 h-5 text-red-600 mr-2" />
                        영상 정보
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium text-gray-700">제목:</span>
                          <span className="ml-2 text-gray-900">{processingStatus.metadata.title}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">채널:</span>
                          <span className="ml-2 text-gray-900">{processingStatus.metadata.uploader}</span>
                        </div>
                        {processingStatus.metadata.duration && (
                          <div>
                            <span className="font-medium text-gray-700">길이:</span>
                            <span className="ml-2 text-gray-900">
                              {Math.floor(processingStatus.metadata.duration / 60)}분 {processingStatus.metadata.duration % 60}초
                            </span>
                          </div>
                        )}
                        {processingStatus.metadata.view_count && (
                          <div>
                            <span className="font-medium text-gray-700">조회수:</span>
                            <span className="ml-2 text-gray-900">
                              {processingStatus.metadata.view_count.toLocaleString()}회
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <ResultTabs
                    transcript={processingStatus.transcript}
                    outline={processingStatus.outline}
                    detailedExplanation={processingStatus.detailed_explanation}
                  />
                  
                  <DownloadButtons
                    transcript={processingStatus.transcript}
                    outline={processingStatus.outline}
                    detailedExplanation={processingStatus.detailed_explanation}
                    fileName={
                      isYouTubeTask 
                        ? processingStatus.metadata?.title?.replace(/[^a-zA-Z0-9가-힣\s]/g, '').substring(0, 50) || 'youtube_video'
                        : selectedFile?.name.replace(/\.[^/.]+$/, '') || 'video'
                    }
                  />
                  
                  <div className="flex justify-center gap-4 mt-4">
                    <button
                      onClick={handleReset}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      메인으로 돌아가기
                    </button>
                    {user && (
                      <button
                        onClick={() => {
                          handleReset();
                          setActiveTab('history');
                        }}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        히스토리 보기
                      </button>
                    )}
                  </div>
                </>
              )}
              
              {processingStatus.status === 'failed' && (
                <div className="flex justify-center gap-4">
                  <button
                    onClick={handleReset}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    메인으로 돌아가기
                  </button>
                  {user && (
                    <button
                      onClick={() => {
                        handleReset();
                        setActiveTab('history');
                      }}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      히스토리 보기
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-gray-500">
            Powered by OpenAI Whisper & GPT-4
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}