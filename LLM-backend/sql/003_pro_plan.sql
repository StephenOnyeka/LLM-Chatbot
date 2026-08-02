-- Add pro subscription flag to users
alter table users add column if not exists is_pro boolean not null default false;

-- Add attachments (array of {url, name, mimeType}) to messages
alter table messages add column if not exists attachments jsonb;

-- Track Stripe customer / subscription ids for webhook fulfillment
alter table users add column if not exists stripe_customer_id text;
alter table users add column if not exists stripe_subscription_id text;
