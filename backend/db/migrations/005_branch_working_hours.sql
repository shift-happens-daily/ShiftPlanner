-- Persist branch working hours on databases created before this field was
-- introduced in db/schema.sql.

ALTER TABLE branches
    ADD COLUMN IF NOT EXISTS working_hours_by_weekday JSONB;

UPDATE branches
SET working_hours_by_weekday = '{"0":{"start_slot":0,"end_slot":48},"1":{"start_slot":0,"end_slot":48},"2":{"start_slot":0,"end_slot":48},"3":{"start_slot":0,"end_slot":48},"4":{"start_slot":0,"end_slot":48},"5":{"start_slot":0,"end_slot":48},"6":{"start_slot":0,"end_slot":48}}'::jsonb
WHERE working_hours_by_weekday IS NULL;

ALTER TABLE branches
    ALTER COLUMN working_hours_by_weekday SET DEFAULT '{"0":{"start_slot":0,"end_slot":48},"1":{"start_slot":0,"end_slot":48},"2":{"start_slot":0,"end_slot":48},"3":{"start_slot":0,"end_slot":48},"4":{"start_slot":0,"end_slot":48},"5":{"start_slot":0,"end_slot":48},"6":{"start_slot":0,"end_slot":48}}'::jsonb,
    ALTER COLUMN working_hours_by_weekday SET NOT NULL;
