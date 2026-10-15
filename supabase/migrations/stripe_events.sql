-- Stripe webhook events already processed, so a redelivered event is a no-op
-- (used by app/api/payment/stripe/webhook/route.ts).
--
-- Run this once in the Supabase SQL editor. Until it runs the webhook still works,
-- it just skips the replay check (activate_premium_bid is already safe to repeat).

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY,          -- evt_...
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_events FROM anon, authenticated;
