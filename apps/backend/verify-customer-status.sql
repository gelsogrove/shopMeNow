-- Verifica customer "test" nel database

-- 1. Trova il customer
SELECT 
  id,
  name,
  email,
  phone,
  isActive,
  createdAt
FROM customers
WHERE workspaceId = 'WORKSPACE_ID_BellItalia'
  AND (name LIKE '%test%' OR phone LIKE '%PHONE_NUMBER%')
ORDER BY createdAt DESC
LIMIT 5;

-- 2. Se isActive = true, il customer è REGISTRATO (dovrebbe vedere prezzi)
-- 3. Se isActive = false, il customer è NON REGISTRATO (NON dovrebbe vedere prezzi)

-- Per forzare NON registrato (test):
-- UPDATE customers 
-- SET isActive = false 
-- WHERE id = 'CUSTOMER_ID';
