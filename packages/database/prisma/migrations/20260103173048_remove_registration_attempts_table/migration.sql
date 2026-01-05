-- Feature 174: Remove registration_attempts table (permissive registration flow)
-- Users can now receive welcome messages without limits
-- Registration required only when attempting protected functions

DROP TABLE IF EXISTS "registration_attempts";
