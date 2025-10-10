import React from 'react';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { BarChart3, Crown, Zap, Building2 } from 'lucide-react';

const UsageIndicator: React.FC = () => {
  const { usageInfo, loading } = useUsageTracking();

  if (loading || !usageInfo) {
    return null;
  }

  const getPlanIcon = () => {
    switch (usageInfo.planType) {
      case 'free':
        return <Zap className="w-4 h-4 text-blue-600" />;
      case 'pro':
        return <Crown className="w-4 h-4 text-purple-600" />;
      case 'business':
        return <Building2 className="w-4 h-4 text-green-600" />;
      default:
        return <BarChart3 className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPlanName = () => {
    switch (usageInfo.planType) {
      case 'free':
        return '무료';
      case 'pro':
        return '프로';
      case 'business':
        return '비즈니스';
      default:
        return '알 수 없음';
    }
  };

  const getProgressColor = () => {
    const ratio = usageInfo.currentUsage / usageInfo.planLimit;
    if (ratio >= 0.9) return 'bg-red-500';
    if (ratio >= 0.7) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = () => {
    const ratio = usageInfo.currentUsage / usageInfo.planLimit;
    if (ratio >= 0.9) return 'text-red-600';
    if (ratio >= 0.7) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getPlanIcon()}
          <span className="text-sm font-medium text-gray-700">
            {getPlanName()} 플랜
          </span>
        </div>
        <a
          href="/pricing"
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
        >
          플랜 변경
        </a>
      </div>

      {usageInfo.hasLimit ? (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">이번 달 사용량</span>
            <span className={`font-medium ${getTextColor()}`}>
              {usageInfo.currentUsage} / {usageInfo.planLimit}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
              style={{
                width: `${Math.min(100, (usageInfo.currentUsage / usageInfo.planLimit) * 100)}%`
              }}
            />
          </div>

          <div className="text-xs text-gray-500">
            {usageInfo.remainingUsage > 0 ? (
              <>
                {usageInfo.remainingUsage}회 남음 · 
                {new Date(usageInfo.resetDate).toLocaleDateString('ko-KR', { 
                  month: 'long', 
                  day: 'numeric' 
                })} 리셋
              </>
            ) : (
              <span className="text-red-600 font-medium">
                한도 초과 · {new Date(usageInfo.resetDate).toLocaleDateString('ko-KR', { 
                  month: 'long', 
                  day: 'numeric' 
                })} 리셋
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <span>이번 달 사용량</span>
            <span className="font-medium text-green-600">
              {usageInfo.currentUsage}회 (무제한)
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            무제한 플랜을 이용 중입니다
          </div>
        </div>
      )}
    </div>
  );
};

export default UsageIndicator;