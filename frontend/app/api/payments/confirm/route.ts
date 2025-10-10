import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await request.json();

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: '필수 결제 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // TossPayments API로 결제 승인 요청
    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    });

    const tossResult = await tossResponse.json();

    if (!tossResponse.ok) {
      console.error('TossPayments API Error:', tossResult);
      return NextResponse.json(
        { error: tossResult.message || '결제 승인 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    // 주문 ID에서 사용자 ID 추출
    const userIdMatch = orderId.match(/_([a-f0-9]+)$/);
    if (!userIdMatch) {
      return NextResponse.json(
        { error: '잘못된 주문 번호입니다.' },
        { status: 400 }
      );
    }

    const userId = userIdMatch[1];

    // 플랜 타입 결정 (금액 기준)
    let planType: 'pro' | 'business';
    let planName: string;
    let monthlyLimit: number;

    if (amount === 9900) {
      planType = 'pro';
      planName = '프로 플랜';
      monthlyLimit = 50;
    } else if (amount === 29900) {
      planType = 'business';
      planName = '비즈니스 플랜';
      monthlyLimit = 999;
    } else {
      return NextResponse.json(
        { error: '지원되지 않는 플랜입니다.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // 트랜잭션 시작
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        plan_type: planType,
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: nextMonth.toISOString(),
        auto_renew: true,
        toss_payment_key: paymentKey,
        toss_order_id: orderId,
        updated_at: now.toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error('Subscription update error:', subscriptionError);
      return NextResponse.json(
        { error: '구독 정보 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 결제 내역 저장
    const { error: paymentHistoryError } = await supabase
      .from('payment_history')
      .insert({
        user_id: userId,
        subscription_id: subscription.id,
        toss_payment_key: paymentKey,
        toss_order_id: orderId,
        amount: amount,
        method: tossResult.method || '카드',
        status: 'approved',
        approved_at: tossResult.approvedAt || now.toISOString()
      });

    if (paymentHistoryError) {
      console.error('Payment history error:', paymentHistoryError);
      // 결제 내역 저장 실패는 치명적이지 않으므로 로그만 남기고 계속 진행
    }

    // 현재 월 사용량 레코드 업데이트
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM 형식
    const { error: usageError } = await supabase
      .from('usage_records')
      .upsert({
        user_id: userId,
        month_year: currentMonth,
        videos_processed: 0,
        plan_limit: monthlyLimit,
        updated_at: now.toISOString()
      }, {
        onConflict: 'user_id,month_year'
      });

    if (usageError) {
      console.error('Usage record error:', usageError);
      // 사용량 레코드 실패도 치명적이지 않으므로 로그만 남기고 계속 진행
    }

    // 성공 응답
    return NextResponse.json({
      message: '결제가 성공적으로 완료되었습니다.',
      orderId: orderId,
      amount: amount,
      method: tossResult.method || '카드',
      planName: planName,
      approvedAt: tossResult.approvedAt,
      paymentKey: paymentKey
    });

  } catch (error) {
    console.error('Payment confirmation error:', error);
    return NextResponse.json(
      { error: '결제 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}