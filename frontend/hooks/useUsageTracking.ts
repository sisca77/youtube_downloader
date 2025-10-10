import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PRICING_PLANS } from '@/lib/toss-payments';

export interface UsageInfo {
  currentUsage: number;
  planLimit: number;
  planType: 'free' | 'pro' | 'business';
  hasLimit: boolean;
  remainingUsage: number;
  resetDate: string;
}

export const useUsageTracking = () => {
  const { user } = useAuth();
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsageInfo = async () => {
    if (!user) {
      setUsageInfo(null);
      setLoading(false);
      return;
    }

    try {
      // 현재 구독 정보 가져오기
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('plan_type, status, current_period_end')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError && subError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching subscription:', subError);
        setLoading(false);
        return;
      }

      const planType = subscription?.plan_type || 'free';
      const planLimit = PRICING_PLANS[planType].monthly_limit;

      // 현재 월 사용량 가져오기
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const { data: usage, error: usageError } = await supabase
        .from('usage_records')
        .select('videos_processed')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth)
        .single();

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('Error fetching usage:', usageError);
      }

      const currentUsage = usage?.videos_processed || 0;
      
      // 다음 리셋 날짜 계산
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const resetDate = nextMonth.toISOString().split('T')[0];

      setUsageInfo({
        currentUsage,
        planLimit,
        planType,
        hasLimit: planLimit < 999,
        remainingUsage: Math.max(0, planLimit - currentUsage),
        resetDate
      });
    } catch (error) {
      console.error('Error in fetchUsageInfo:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUsageLimit = (): boolean => {
    if (!usageInfo) return false;
    return usageInfo.remainingUsage > 0;
  };

  const incrementUsage = async (): Promise<boolean> => {
    if (!user || !usageInfo) return false;

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // 사용량 업데이트
      const { data, error } = await supabase
        .from('usage_records')
        .upsert({
          user_id: user.id,
          month_year: currentMonth,
          videos_processed: usageInfo.currentUsage + 1,
          plan_limit: usageInfo.planLimit,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,month_year'
        })
        .select()
        .single();

      if (error) {
        console.error('Error incrementing usage:', error);
        return false;
      }

      // 로컬 상태 업데이트
      setUsageInfo(prev => prev ? {
        ...prev,
        currentUsage: prev.currentUsage + 1,
        remainingUsage: Math.max(0, prev.planLimit - (prev.currentUsage + 1))
      } : null);

      return true;
    } catch (error) {
      console.error('Error in incrementUsage:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchUsageInfo();
  }, [user]);

  return {
    usageInfo,
    loading,
    checkUsageLimit,
    incrementUsage,
    refetchUsage: fetchUsageInfo
  };
};