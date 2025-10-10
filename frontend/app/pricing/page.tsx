'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PRICING_PLANS, createPayment, formatPrice, PlanType } from '@/lib/toss-payments';
import { Check, Crown, Zap, Building2 } from 'lucide-react';

export default function PricingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<PlanType | null>(null);

  const handleSubscribe = async (planType: PlanType) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (planType === 'free') {
      alert('현재 무료 플랜을 사용 중입니다.');
      return;
    }

    setLoading(planType);

    try {
      const orderId = `order_${Date.now()}_${user.id.slice(0, 8)}`;
      
      await createPayment(
        planType,
        orderId,
        user.email,
        user.full_name || '고객'
      );
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message || '결제 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(null);
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free':
        return <Zap className="w-8 h-8 text-blue-600" />;
      case 'pro':
        return <Crown className="w-8 h-8 text-purple-600" />;
      case 'business':
        return <Building2 className="w-8 h-8 text-green-600" />;
      default:
        return <Zap className="w-8 h-8 text-gray-600" />;
    }
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'free':
        return 'border-blue-200 bg-blue-50';
      case 'pro':
        return 'border-purple-200 bg-purple-50 ring-2 ring-purple-500';
      case 'business':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getButtonStyle = (planId: string) => {
    switch (planId) {
      case 'free':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'pro':
        return 'bg-purple-600 hover:bg-purple-700 text-white';
      case 'business':
        return 'bg-green-600 hover:bg-green-700 text-white';
      default:
        return 'bg-gray-600 hover:bg-gray-700 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">요금제</h1>
            <a
              href="/"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              메인으로
            </a>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            당신에게 맞는 플랜을 선택하세요
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            AI 영상 요약 서비스를 더욱 효율적으로 사용할 수 있는 다양한 플랜을 제공합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {Object.entries(PRICING_PLANS).map(([planId, plan]) => (
            <div
              key={planId}
              className={`relative rounded-lg border-2 p-8 ${getPlanColor(planId)} ${
                plan.recommended ? 'transform scale-105' : ''
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    추천
                  </div>
                </div>
              )}

              <div className="text-center">
                <div className="flex justify-center mb-4">
                  {getPlanIcon(planId)}
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price === 0 ? '무료' : formatPrice(plan.price)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-gray-600 ml-2">/월</span>
                  )}
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(planId as PlanType)}
                  disabled={loading === planId || planId === 'free'}
                  className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                    planId === 'free' 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : getButtonStyle(planId)
                  } ${loading === planId ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading === planId 
                    ? '처리 중...' 
                    : planId === 'free' 
                      ? '현재 플랜' 
                      : `${plan.name} 시작하기`
                  }
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
            자주 묻는 질문
          </h3>
          
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">
                언제든지 플랜을 변경할 수 있나요?
              </h4>
              <p className="text-gray-600">
                네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 
                변경사항은 다음 결제 주기부터 적용됩니다.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">
                사용하지 않은 영상 처리 횟수는 다음 달로 이월되나요?
              </h4>
              <p className="text-gray-600">
                아니요, 사용하지 않은 처리 횟수는 매월 초기화됩니다. 
                각 월의 시작일에 새로운 사용 한도가 부여됩니다.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">
                결제는 어떤 방법으로 할 수 있나요?
              </h4>
              <p className="text-gray-600">
                토스페이먼츠를 통해 신용카드, 체크카드, 계좌이체, 휴대폰 결제 등 
                다양한 결제 수단을 지원합니다.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">
                구독을 취소하면 어떻게 되나요?
              </h4>
              <p className="text-gray-600">
                구독을 취소하면 현재 결제 주기가 끝날 때까지 서비스를 계속 이용할 수 있으며, 
                이후 자동으로 무료 플랜으로 변경됩니다.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}