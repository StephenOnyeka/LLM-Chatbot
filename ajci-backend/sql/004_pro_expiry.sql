-- Track when the current Pro billing period ends (renewal/expiry date).
-- Populated from the Stripe subscription's current_period_end on upgrade,
-- and cleared to null when the user downgrades / cancels.
alter table users add column if not exists pro_expires_at timestamptz;
