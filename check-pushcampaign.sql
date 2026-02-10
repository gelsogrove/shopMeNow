-- Check columns in PushCampaign table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'PushCampaign'
ORDER BY ordinal_position;
