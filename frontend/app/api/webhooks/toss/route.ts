import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const WEBHOOK_SECRET = process.env.TOSS_WEBHOOK_SECRET || 'your-webhook-secret';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('X-Toss-Signature');

    // 웹훅 서명 검증
    if (!verifyWebhookSignature(body, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const data = JSON.parse(body);
    const eventType = data.eventType;

    console.log('TossPayments webhook received:', eventType, data);

    switch (eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        await handlePaymentStatusChanged(data);
        break;
      
      case 'SUBSCRIPTION_STATUS_CHANGED':
        await handleSubscriptionStatusChanged(data);
        break;
      
      case 'SUBSCRIPTION_PAYMENT_FAILED':
        await handleSubscriptionPaymentFailed(data);
        break;
      
      default:
        console.log('Unhandled event type:', eventType);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('base64');
  
  return signature === expectedSignature;
}

async function handlePaymentStatusChanged(data: any) {
  const { paymentKey, orderId, status } = data;
  
  try {
    // 결제 상태 업데이트
    const { error } = await supabase
      .from('payment_history')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('toss_payment_key', paymentKey);

    if (error) {
      console.error('Error updating payment status:', error);
    }

    // 결제가 실패한 경우 구독 상태도 업데이트
    if (status === 'FAILED' || status === 'CANCELED') {
      await handlePaymentFailure(orderId);
    }
  } catch (error) {
    console.error('Error in handlePaymentStatusChanged:', error);
  }
}

async function handleSubscriptionStatusChanged(data: any) {
  const { customerId, subscriptionId, status } = data;
  
  try {
    // customerId 또는 subscriptionId를 통해 사용자 찾기
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('toss_order_id', subscriptionId)
      .single();

    if (error || !subscription) {
      console.error('Subscription not found:', subscriptionId);
      return;
    }

    let newStatus: 'active' | 'cancelled' | 'expired';
    switch (status) {
      case 'ACTIVE':
        newStatus = 'active';
        break;
      case 'CANCELED':
      case 'CANCELLED':
        newStatus = 'cancelled';
        break;
      case 'EXPIRED':
        newStatus = 'expired';
        break;
      default:
        newStatus = 'expired';
    }

    // 구독 상태 업데이트
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('Error updating subscription status:', updateError);
    }

    // 구독이 취소되거나 만료된 경우 무료 플랜으로 다운그레이드
    if (newStatus === 'cancelled' || newStatus === 'expired') {
      await downgradeTo FreePlan(subscription.user_id);
    }
  } catch (error) {
    console.error('Error in handleSubscriptionStatusChanged:', error);
  }
}

async function handleSubscriptionPaymentFailed(data: any) {
  const { customerId, subscriptionId, failureReason } = data;
  
  try {
    console.log('Subscription payment failed:', {
      customerId,
      subscriptionId,
      failureReason
    });

    // 결제 실패 로그 저장
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('toss_order_id', subscriptionId)
      .single();

    if (subscription) {
      // 결제 실패 내역 저장
      await supabase
        .from('payment_history')
        .insert({
          user_id: subscription.user_id,
          toss_order_id: subscriptionId,
          amount: 0,
          method: 'subscription_renewal',
          status: 'failed',
          created_at: new Date().toISOString()
        });

      // 3회 연속 실패시 구독 취소 로직 등을 추가할 수 있음
      await checkConsecutiveFailures(subscription.user_id);
    }
  } catch (error) {
    console.error('Error in handleSubscriptionPaymentFailed:', error);
  }
}

async function handlePaymentFailure(orderId: string) {
  try {
    // 주문 ID에서 사용자 ID 추출
    const userIdMatch = orderId.match(/_([a-f0-9]+)$/);
    if (!userIdMatch) return;

    const userId = userIdMatch[1];

    // 구독을 무료 플랜으로 다운그레이드
    await downgradeToFreePlan(userId);
  } catch (error) {
    console.error('Error in handlePaymentFailure:', error);
  }
}

async function downgradeToFreePlan(userId: string) {
  try {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // 구독을 무료 플랜으로 업데이트
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({
        plan_type: 'free',
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: nextMonth.toISOString(),
        auto_renew: true,
        toss_payment_key: null,
        toss_order_id: null,
        updated_at: now.toISOString()
      })
      .eq('user_id', userId);

    if (subscriptionError) {
      console.error('Error downgrading subscription:', subscriptionError);
      return;
    }

    // 사용량 레코드 업데이트 (무료 플랜 한도로)
    const currentMonth = now.toISOString().slice(0, 7);
    const { error: usageError } = await supabase
      .from('usage_records')
      .upsert({
        user_id: userId,
        month_year: currentMonth,
        videos_processed: 0, // 현재 사용량 유지하거나 리셋할지 결정
        plan_limit: 5, // 무료 플랜 한도
        updated_at: now.toISOString()
      }, {
        onConflict: 'user_id,month_year'
      });

    if (usageError) {
      console.error('Error updating usage record:', usageError);
    }

    console.log(`User ${userId} downgraded to free plan`);
  } catch (error) {
    console.error('Error in downgradeToFreePlan:', error);
  }
}

async function checkConsecutiveFailures(userId: string) {
  try {
    // 최근 3개의 결제 실패 확인
    const { data: failures, error } = await supabase
      .from('payment_history')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.error('Error checking consecutive failures:', error);
      return;
    }

    // 3회 연속 실패시 구독 자동 취소
    if (failures && failures.length >= 3) {
      const { error: cancelError } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          auto_renew: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (cancelError) {
        console.error('Error auto-cancelling subscription:', cancelError);
      } else {
        console.log(`Auto-cancelled subscription for user ${userId} due to consecutive failures`);
        await downgradeToFreePlan(userId);
      }
    }
  } catch (error) {
    console.error('Error in checkConsecutiveFailures:', error);
  }
}