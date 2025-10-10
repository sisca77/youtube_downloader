'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { VideoTask } from '@/types';
import { supabase } from '@/lib/supabase';
import { FileVideo, Youtube, Calendar, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

export default function TaskHistory() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<VideoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserTasks();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchUserTasks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('video_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.warn('Could not fetch tasks from database:', error);
        // 데이터베이스가 없으면 로컬 스토리지에서 가져오기
        loadTasksFromLocalStorage();
      } else {
        setTasks(data || []);
      }
    } catch (err: any) {
      console.warn('Database error:', err);
      // 데이터베이스 오류시 로컬 스토리지에서 가져오기
      loadTasksFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadTasksFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem(`tasks_${user?.id}`);
      if (stored) {
        const tasks = JSON.parse(stored);
        setTasks(tasks);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.warn('Error loading from localStorage:', error);
      setTasks([]);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
      case 'processing':
        return '처리 중';
      default:
        return '대기';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-center text-gray-500">로그인 후 작업 히스토리를 확인할 수 있습니다.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          히스토리를 불러오는 중 오류가 발생했습니다: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">작업 히스토리</h3>
      </div>
      
      <div className="p-6">
        {tasks.length === 0 ? (
          <p className="text-center text-gray-500 py-8">아직 처리한 작업이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="mt-1">
                      {task.youtube_url ? (
                        <Youtube className="w-5 h-5 text-red-500" />
                      ) : (
                        <FileVideo className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {task.file_name || task.metadata?.title || 'YouTube 영상'}
                      </h4>
                      {task.youtube_url && (
                        <p className="text-sm text-gray-500 mt-1">
                          {task.metadata?.uploader && `${task.metadata.uploader} • `}
                          요약 비율: {Math.round(task.summary_ratio * 100)}%
                        </p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(task.created_at)}
                        </span>
                        {task.status === 'processing' && (
                          <span>진행률: {task.progress}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(task.status)}
                    <span className="text-sm font-medium text-gray-700">
                      {getStatusText(task.status)}
                    </span>
                  </div>
                </div>
                
                {task.status === 'completed' && task.outline && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {task.outline.substring(0, 100)}...
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}