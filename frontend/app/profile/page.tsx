'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { supabase } from '@/lib/supabase';
import { PRICING_PLANS, formatPrice } from '@/lib/toss-payments';
import { 
  User, 
  Mail, 
  Calendar, 
  Settings, 
  CreditCard, 
  BarChart3,
  Crown,
  Zap,
  Building2,
  ArrowRight,
  Home
} from 'lucide-react';

interface Subscription {
  id: string;
  plan_type: 'free' | 'pro' | 'business';
  status: 'active' | 'cancelled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
}

interface PaymentHistory {
  id: string;
  amount: number;
  method: string;
  status: string;
  approved_at: string;
  toss_order_id: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { usageInfo, loading: usageLoading } = useUsageTracking();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      // 구독 정보 가져오기
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error fetching subscription:', subError);
      } else if (subData) {
        setSubscription(subData);
      }

      // 결제 내역 가져오기
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_history')
        .select('*')
        .eq('user_id', user!.id)
        .order('approved_at', { ascending: false })
        .limit(10);

      if (paymentError) {
        console.error('Error fetching payment history:', paymentError);
      } else if (paymentData) {
        setPaymentHistory(paymentData);
      }
    } catch (error) {
      console.error('Error in fetchUserData:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!subscription || subscription.plan_type === 'free') return;

    if (!confirm('구독을 취소하시겠습니까? 현재 결제 주기가 끝날 때까지 서비스를 이용할 수 있습니다.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ 
          auto_renew: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (error) {
        console.error('Error cancelling subscription:', error);
        alert('구독 취소 중 오류가 발생했습니다.');
      } else {
        setSubscription(prev => prev ? { ...prev, auto_renew: false } : null);
        alert('구독이 취소되었습니다.');
      }
    } catch (error) {
      console.error('Error in cancelSubscription:', error);
      alert('구독 취소 중 오류가 발생했습니다.');
    }
  };

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'free':
        return <Zap className="w-5 h-5 text-blue-600" />;
      case 'pro':
        return <Crown className="w-5 h-5 text-purple-600" />;
      case 'business':
        return <Building2 className="w-5 h-5 text-green-600" />;
      default:
        return <BarChart3 className="w-5 h-5 text-gray-600" />;
    }
  };

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'free':
        return 'bg-blue-50 border-blue-200';
      case 'pro':
        return 'bg-purple-50 border-purple-200';
      case 'business':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">로그인이 필요합니다.</p>
          <a
            href="/"
            className="text-blue-600 hover:text-blue-700 hover:underline"
          >
            메인으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">프로필 설정</h1>
            <a
              href="/"
              className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
            >
              <Home className="w-4 h-4 mr-1" />
              메인으로
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* 사용자 정보 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" />
              계정 정보
            </h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <Mail className="w-4 h-4 text-gray-400 mr-3" />
                <span className="text-gray-600">이메일:</span>
                <span className="ml-2 font-medium">{user.email}</span>
              </div>
              <div className="flex items-center">
                <User className="w-4 h-4 text-gray-400 mr-3" />
                <span className="text-gray-600">이름:</span>
                <span className="ml-2 font-medium">{user.full_name || '미설정'}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                <span className="text-gray-600">가입일:</span>
                <span className="ml-2 font-medium">
                  {new Date(user.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </div>
          </div>

          {/* 현재 구독 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              현재 구독
            </h2>
            
            {loading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            ) : subscription ? (
              <div className={`rounded-lg border-2 p-4 ${getPlanColor(subscription.plan_type)}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    {getPlanIcon(subscription.plan_type)}
                    <span className="font-semibold text-gray-900">
                      {PRICING_PLANS[subscription.plan_type].name}
                    </span>
                    <span className="text-sm text-gray-600">
                      ({subscription.status === 'active' ? '활성' : subscription.status})
                    </span>
                  </div>
                  {subscription.plan_type !== 'free' && (
                    <span className="font-bold text-lg">
                      {formatPrice(PRICING_PLANS[subscription.plan_type].price)}/월
                    </span>
                  )}
                </div>

                {subscription.plan_type !== 'free' && (
                  <div className="space-y-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">결제 주기:</span> 
                      <span className="ml-1">
                        {new Date(subscription.current_period_start).toLocaleDateString('ko-KR')} ~ 
                        {new Date(subscription.current_period_end).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">자동 갱신:</span> 
                      <span className={`ml-1 ${subscription.auto_renew ? 'text-green-600' : 'text-red-600'}`}>
                        {subscription.auto_renew ? '활성' : '비활성'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex space-x-3">
                  <a
                    href="/pricing"
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    플랜 변경
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </a>
                  {subscription.plan_type !== 'free' && subscription.auto_renew && (
                    <button
                      onClick={cancelSubscription}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
                    >
                      구독 취소
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-gray-600">
                구독 정보를 불러올 수 없습니다.
              </div>
            )}
          </div>

          {/* 사용량 통계 */}
          {usageInfo && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                이번 달 사용량
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">처리한 영상 수</span>
                  <span className="font-semibold text-lg">
                    {usageInfo.currentUsage}
                    {usageInfo.hasLimit && ` / ${usageInfo.planLimit}`}
                  </span>
                </div>

                {usageInfo.hasLimit && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        usageInfo.currentUsage / usageInfo.planLimit >= 0.9
                          ? 'bg-red-500'
                          : usageInfo.currentUsage / usageInfo.planLimit >= 0.7
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (usageInfo.currentUsage / usageInfo.planLimit) * 100)}%`
                      }}
                    />
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  {usageInfo.hasLimit ? (
                    <>
                      {usageInfo.remainingUsage}회 남음 · 
                      {new Date(usageInfo.resetDate).toLocaleDateString('ko-KR', { 
                        month: 'long', 
                        day: 'numeric' 
                      })} 리셋
                    </>
                  ) : (
                    '무제한 플랜을 이용 중입니다'
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 결제 내역 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              결제 내역
            </h2>
            
            {paymentHistory.length > 0 ? (
              <div className="space-y-3">
                {paymentHistory.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {formatPrice(payment.amount)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {payment.method} · {payment.toss_order_id}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(payment.approved_at).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      payment.status === 'approved' 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {payment.status === 'approved' ? '완료' : payment.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">결제 내역이 없습니다.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}