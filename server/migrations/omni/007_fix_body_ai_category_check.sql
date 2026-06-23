-- 007_fix_body_ai_category_check.sql
-- Migration-drift repair: production has a CHECK constraint body_ai_category_valid
-- on omni_messages whose allowed set does NOT include 'cotizacion', but the AI
-- classify worker (CATEGORY_MAP in aiWorker.js) writes body_ai_category='cotizacion'.
-- Result: every classify job on a quote message died with:
--   new row for relation "omni_messages" violates check constraint "body_ai_category_valid"
-- (NB: this CHECK is not defined in the repo's 001_core.sql — it is prod-only drift.
--  This migration converges the constraint to match the code's category vocabulary.)

ALTER TABLE omni_messages DROP CONSTRAINT IF EXISTS body_ai_category_valid;
ALTER TABLE omni_messages ADD CONSTRAINT body_ai_category_valid
  CHECK (
    body_ai_category IS NULL OR body_ai_category IN (
      'product','order','issue','inquiry','complaint','feedback','spam','other','cotizacion'
    )
  );
