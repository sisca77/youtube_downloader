'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Home } from 'lucide-react';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    if (paymentKey && orderId && amount) {
      // 결제 승인 처리
      confirmPayment(paymentKey, orderId, amount);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const confirmPayment = async (paymentKey: string, orderId: string, amount: string) => {
    try {
      const response = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentKey,
          orderId,
          amount: parseInt(amount),
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setPaymentInfo(result);
      } else {
        throw new Error(result.message || '결제 승인 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Payment confirmation error:', error);
      alert('결제 승인 중 오류가 발생했습니다. 고객센터로 문의해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">결제를 승인하는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            결제가 완료되었습니다!
          </h1>
          <p className="text-gray-600">
            구독이 성공적으로 활성화되었습니다.
          </p>
        </div>

        {paymentInfo && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-gray-900 mb-2">결제 정보</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>주문번호:</span>
                <span className="font-mono">{paymentInfo.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span>결제금액:</span>
                <span className="font-semibold">
                  {new Intl.NumberFormat('ko-KR', {
                    style: 'currency',
                    currency: 'KRW'
                  }).format(paymentInfo.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>결제방법:</span>
                <span>{paymentInfo.method || '카드'}</span>
              </div>
              <div className="flex justify-between">
                <span>구독플랜:</span>
                <span>{paymentInfo.planName}</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <a
            href="/"
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <Home className="w-4 h-4 mr-2" />
            메인으로 돌아가기
          </a>
          
          <a
            href="/profile"
            className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
          >
            구독 관리
            <ArrowRight className="w-4 h-4 ml-2" />
          </a>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <p>
            구독 관련 문의사항이 있으시면{' '}
            <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
              고객센터
            </a>
            로 연락해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}