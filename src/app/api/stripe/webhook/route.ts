import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { markPaid } from '@/lib/repo';

export const dynamic = 'force-dynamic';

// Marks teams / runner fees paid when Stripe Checkout completes, even if the
// buyer closes the tab before coming back to the site.
// Stripe → Developers → Webhooks → endpoint https://YOUR-DOMAIN/api/stripe/webhook,
// event checkout.session.completed. Signing secret → STRIPE_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return new NextResponse('Stripe not configured', { status: 400 });
  let event;
  try {
    event = s.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature') || '', secret);
  } catch (e: any) {
    return new NextResponse(`Webhook error: ${e.message}`, { status: 400 });
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    const kind = session.metadata?.kind, id = session.metadata?.id;
    if (session.payment_status === 'paid' && id && (kind === 'team' || kind === 'runner')) {
      await markPaid(kind, id, 'stripe', session.id);
    }
  }
  return NextResponse.json({ received: true });
}
