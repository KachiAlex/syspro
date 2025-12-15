-- Quick Schema Verification Query
-- Run this in Neon SQL Editor to verify tables were created

-- 1. List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Count total tables
SELECT COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- 3. Check for key tables
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
    THEN '✅' ELSE '❌' END as users,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') 
    THEN '✅' ELSE '❌' END as organizations,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plan') 
    THEN '✅' ELSE '❌' END as plan,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription') 
    THEN '✅' ELSE '❌' END as subscription,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice') 
    THEN '✅' ELSE '❌' END as invoice,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment') 
    THEN '✅' ELSE '❌' END as payment;

-- 4. Get table row counts (for populated tables)
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

