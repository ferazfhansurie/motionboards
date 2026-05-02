-- Lead Forms — Facebook Lead Ads → WhatsApp auto-reply.
--
-- Two tables:
--   lead_form_subscriptions  — one row per (company × form). Holds the
--      Facebook form id, the auto-reply template, the per-company
--      verify token + page access token (so the leadgen webhook can
--      verify Meta's hub.challenge and fetch lead details from Graph).
--   lead_form_entries         — one row per submitted lead. Append-only
--      audit trail used to populate the Recent Leads table in the
--      adletic-inbox UI and to surface delivery failures.
--
-- All ids use uuid (gen_random_uuid via pgcrypto) to match the rest of
-- the schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS lead_form_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          text NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  phone_index         integer NOT NULL DEFAULT 0,
  fb_form_id          text NOT NULL,
  fb_page_id          text NOT NULL,
  fb_page_name        text,
  fb_page_access_token text,            -- long-lived page token; required to fetch lead details
  label               text NOT NULL,
  auto_reply_template text NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, fb_form_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_form_subs_company  ON lead_form_subscriptions (company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_lead_form_subs_form     ON lead_form_subscriptions (fb_form_id);
CREATE INDEX IF NOT EXISTS idx_lead_form_subs_page     ON lead_form_subscriptions (fb_page_id);

-- Per-company webhook config — verify token + the leadgen URL secret.
-- Separate from subscriptions so rotating the token doesn't churn
-- subscription rows.
CREATE TABLE IF NOT EXISTS lead_form_webhooks (
  company_id     text PRIMARY KEY REFERENCES companies(company_id) ON DELETE CASCADE,
  verify_token   text NOT NULL,
  app_secret     text,                 -- optional, for X-Hub-Signature verification
  created_at     timestamptz NOT NULL DEFAULT now(),
  rotated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_form_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         text NOT NULL,
  subscription_id    uuid REFERENCES lead_form_subscriptions(id) ON DELETE SET NULL,
  fb_lead_id         text NOT NULL,
  fb_form_id         text NOT NULL,
  fb_page_id         text,
  full_name          text,
  email              text,
  phone              text,
  raw_field_data     jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_status    text NOT NULL DEFAULT 'queued', -- queued | sent | failed | skipped
  delivery_error     text,
  delivered_message  text,                            -- the rendered text we actually sent
  created_at         timestamptz NOT NULL DEFAULT now(),
  delivered_at       timestamptz,
  UNIQUE (company_id, fb_lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_form_entries_company_recent ON lead_form_entries (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_form_entries_sub             ON lead_form_entries (subscription_id, created_at DESC);
