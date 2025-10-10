// TossPayments SDK를 동적으로 로드하여 SSR 이슈 방지
let tossPaymentsPromise: Promise<any> | null = null;

const loadTossPaymentsSDK = () => {
  if (!tossPaymentsPromise) {
    tossPaymentsPromise = import('@tosspayments/payment-sdk').then(module => {
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;
      return module.loadTossPayments(clientKey);
    });
  }
  return tossPaymentsPromise;
};

export const tossPayments = loadTossPaymentsSDK();

export const PRICING_PLANS = {
  free: {
    id: 'free',
    name: '무료 플랜',
    price: 0,
    monthly_limit: 5,
    features: [
      '월 5개 영상 처리',
      '기본 요약 기능',
      '커뮤니티 지원'
    ]
  },
  pro: {
    id: 'pro',
    name: '프로 플랜',
    price: 9900, // 9,900원
    monthly_limit: 50,
    features: [
      '월 50개 영상 처리',
      '고급 요약 옵션',
      '우선 처리',
      '이메일 지원',
      '다운로드 기능'
    ],
    recommended: true
  },
  business: {
    id: 'business',
    name: '비즈니스 플랜',
    price: 29900, // 29,900원
    monthly_limit: 999,
    features: [
      '무제한 영상 처리',
      'API 접근 권한',
      '팀 공유 기능',
      '전용 고객 지원',
      '고급 분석 도구',
      '우선 기술 지원'
    ]
  }
} as const;

export type PlanType = keyof typeof PRICING_PLANS;

export const createPayment = async (
  planType: PlanType,
  orderId: string,
  customerEmail: string,
  customerName: string
) => {
  const plan = PRICING_PLANS[planType];
  
  if (plan.price === 0) {
    throw new Error('무료 플랜은 결제가 필요하지 않습니다.');
  }

  const payment = await loadTossPaymentsSDK();
  
  return payment.requestPayment('카드', {
    amount: plan.price,
    orderId: orderId,
    orderName: `${plan.name} 구독`,
    customerName: customerName,
    customerEmail: customerEmail,
    successUrl: `${window.location.origin}/payment/success`,
    failUrl: `${window.location.origin}/payment/fail`,
  });
};

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(price);
};

export const getCurrentUsageLimit = (planType: PlanType): number => {
  return PRICING_PLANS[planType].monthly_limit;
};