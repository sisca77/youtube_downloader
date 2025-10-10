'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { XCircle, ArrowLeft, Home, RefreshCw } from 'lucide-react';

export default function PaymentFailPage() {
  const searchParams = useSearchParams();
  const [errorInfo, setErrorInfo] = useState<any>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const message = searchParams.get('message');
    const orderId = searchParams.get('orderId');

    if (code || message) {
      setErrorInfo({
        code: code || 'UNKNOWN',
        message: message || '알 수 없는 오류가 발생했습니다.',
        orderId: orderId
      });
    }
  }, [searchParams]);

  const getErrorMessage = (code: string) => {
    switch (code) {
      case 'PAY_PROCESS_CANCELED':
        return '사용자가 결제를 취소했습니다.';
      case 'PAY_PROCESS_ABORTED':
        return '결제 과정에서 오류가 발생했습니다.';
      case 'REJECT_CARD_COMPANY':
        return '카드사에서 결제를 거부했습니다.';
      case 'INVALID_CARD_COMPANY':
        return '유효하지 않은 카드입니다.';
      case 'NOT_ENOUGH_BALANCE':
        return '잔액이 부족합니다.';
      case 'EXCEED_MAX_DAILY_PAYMENT_COUNT':
        return '일일 결제 한도를 초과했습니다.';
      case 'EXCEED_MAX_ONE_DAY_PAYMENT_AMOUNT':
        return '일일 결제 금액 한도를 초과했습니다.';
      case 'EXCEED_MAX_ONE_TIME_PAYMENT_AMOUNT':
        return '일회 결제 금액 한도를 초과했습니다.';
      case 'NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT':
        return '할부가 지원되지 않는 카드이거나 가맹점입니다.';
      case 'NOT_SUPPORTED_MONTHLY_INSTALLMENT_PLAN':
        return '지원되지 않는 할부 개월수입니다.';
      case 'INVALID_CARD_INSTALLMENT_PLAN':
        return '유효하지 않은 할부 정보입니다.';
      case 'NOT_AVAILABLE_BANK':
        return '은행 서비스를 이용할 수 없습니다.';
      case 'INVALID_PASSWORD':
        return '비밀번호가 올바르지 않습니다.';
      case 'EXCEED_MAX_AUTH_COUNT':
        return '인증 시도 횟수를 초과했습니다.';
      case 'EXCEED_MAX_ONE_DAY_WITHDRAW_AMOUNT':
        return '일일 출금 한도를 초과했습니다.';
      case 'SUSPEND_WITHDRAW_SERVICE':
        return '출금 서비스가 일시 중단되었습니다.';
      case 'INVALID_ACCOUNT_INFO':
        return '계좌 정보가 올바르지 않습니다.';
      default:
        return '결제 처리 중 오류가 발생했습니다.';
    }
  };

  const handleRetry = () => {
    window.location.href = '/pricing';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            결제가 실패했습니다
          </h1>
          <p className="text-gray-600">
            결제 처리 중 문제가 발생했습니다.
          </p>
        </div>

        {errorInfo && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-red-900 mb-2">오류 정보</h3>
            <div className="space-y-2 text-sm">
              <div className="text-red-700">
                <strong>원인:</strong> {getErrorMessage(errorInfo.code)}
              </div>
              {errorInfo.message && (
                <div className="text-red-600">
                  <strong>상세:</strong> {errorInfo.message}
                </div>
              )}
              {errorInfo.orderId && (
                <div className="text-red-600">
                  <strong>주문번호:</strong> {errorInfo.orderId}
                </div>
              )}
              <div className="text-red-600">
                <strong>오류코드:</strong> {errorInfo.code}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            다시 시도하기
          </button>
          
          <a
            href="/"
            className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
          >
            <Home className="w-4 h-4 mr-2" />
            메인으로 돌아가기
          </a>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-500 space-y-2">
            <p>결제 문제가 지속되시면:</p>
            <div className="space-y-1">
              <p>• 카드 한도 및 잔액을 확인해주세요</p>
              <p>• 다른 결제 수단을 이용해보세요</p>
              <p>• 카드사에 문의해보세요</p>
            </div>
            <p className="mt-4">
              지속적인 문제 발생시{' '}
              <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
                고객센터
              </a>
              로 연락해주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}