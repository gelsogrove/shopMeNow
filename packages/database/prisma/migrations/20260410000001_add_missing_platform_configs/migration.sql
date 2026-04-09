-- Add missing PlatformConfig keys (safe for production - uses ON CONFLICT DO NOTHING)
-- This allows npm run publish to work autonomously without requiring seed

-- SUBSCRIPTION PLANS
INSERT INTO platform_config (id, type, key, value, "description", "isActive", "createdAt", "updatedAt") VALUES
('pc-free-monthly-1', 'PRICE', 'FREE_MONTHLY', '0', 'Free plan - $0/month for 14 days trial with $22 credit included', true, NOW(), NOW()),
('pc-basic-monthly-1', 'PRICE', 'BASIC_MONTHLY', '22', 'Basic plan - $22/month for growing businesses (was $34)', true, NOW(), NOW()),
('pc-premium-monthly-1', 'PRICE', 'PREMIUM_MONTHLY', '45', 'Premium plan - $45/month for established businesses (was $58)', true, NOW(), NOW()),
('pc-enterprise-monthly-1', 'PRICE', 'ENTERPRISE_MONTHLY', '140', 'Enterprise plan - $140/month for large scale operations (was $175)', true, NOW(), NOW()),
('pc-channel-cost-1', 'PRICE', 'MONTHLY_CHANNEL_COST', '45', 'Monthly WhatsApp channel cost (included in all paid plans)', true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- USAGE COSTS
INSERT INTO platform_config (id, type, key, value, "description", "isActive", "createdAt", "updatedAt") VALUES
('pc-message-1', 'PRICE', 'MESSAGE', '0.10', 'Cost per message (AI-powered responses, including support conversations)', true, NOW(), NOW()),
('pc-widget-message-1', 'PRICE', 'WIDGET_MESSAGE', '0.005', 'Cost per web widget message (site chat)', true, NOW(), NOW()),
('pc-push-campaign-1', 'PRICE', 'PUSH_CAMPAIGN', '1.00', 'Cost per push notification sent (all types)', true, NOW(), NOW()),
('pc-appointment-reminder-1', 'PRICE', 'APPOINTMENT_REMINDER_WHATSAPP', '0.50', 'Cost per WhatsApp appointment reminder (24h, 1h, or 30min before appointment)', true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- FEATURE FLAGS
INSERT INTO platform_config (id, type, key, value, "description", "isActive", "createdAt", "updatedAt") VALUES
('pc-can-login', 'FLAG', 'canLogin', 'true', 'Allow user login. When false: show maintenance mode', true, NOW(), NOW()),
('pc-can-register', 'FLAG', 'canRegister', 'true', 'Allow new user registration. When false: show WIP popup, disable register button', true, NOW(), NOW()),
('pc-wip', 'FLAG', 'workingInProgress', 'false', 'Show Work in Progress badge to communicate service status', true, NOW(), NOW()),
('pc-register-first', 'FLAG', 'registerFirst', 'false', 'When true, default auth view is registration instead of login', true, NOW(), NOW()),
('pc-landing-enabled', 'FLAG', 'landingPageEnabled', 'true', 'When true, /index redirects to landing page. When false, redirect users to /auth/login', true, NOW(), NOW()),
('pc-try-demo', 'FLAG', 'cantryDemo', 'true', 'Allow users to try live demo. When false: show WIP popup, disable demo button', true, NOW(), NOW()),
('pc-show-widget', 'FLAG', 'showWidgetChatbot', 'true', 'Show chatbot widget on login page. When true: display the widget embed code', true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- RATE LIMITS (Token Bucket)
INSERT INTO platform_config (id, type, key, value, "description", "isActive", "createdAt", "updatedAt") VALUES
('pc-rate-customer-min', 'LIMIT', 'WHATSAPP_RATE_LIMIT_CUSTOMER_PER_MIN', '15', 'Max inbound WhatsApp messages per CUSTOMER per minute (refill rate)', true, NOW(), NOW()),
('pc-rate-customer-burst', 'LIMIT', 'WHATSAPP_RATE_LIMIT_CUSTOMER_BURST', '10', 'Extra burst tokens for CUSTOMER inbound WhatsApp messages', true, NOW(), NOW()),
('pc-rate-workspace-min', 'LIMIT', 'WHATSAPP_RATE_LIMIT_WORKSPACE_PER_MIN', '300', 'Max inbound WhatsApp messages per WORKSPACE per minute (refill rate)', true, NOW(), NOW()),
('pc-rate-workspace-burst', 'LIMIT', 'WHATSAPP_RATE_LIMIT_WORKSPACE_BURST', '150', 'Extra burst tokens for WORKSPACE inbound WhatsApp messages', true, NOW(), NOW()),
('pc-rate-ip-min', 'LIMIT', 'WHATSAPP_RATE_LIMIT_IP_PER_MIN', '600', 'Max inbound WhatsApp requests per IP per minute (edge protection)', true, NOW(), NOW()),
('pc-rate-ip-burst', 'LIMIT', 'WHATSAPP_RATE_LIMIT_IP_BURST', '300', 'Extra burst tokens for inbound WhatsApp requests per IP', true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- PLAN LIMITS
INSERT INTO platform_config (id, type, key, value, "description", "isActive", "createdAt", "updatedAt") VALUES
('pc-free-clients', 'LIMIT', 'FREE_CLIENTS', '50', 'Maximum clients for Free plan', true, NOW(), NOW()),
('pc-basic-clients', 'LIMIT', 'BASIC_CLIENTS', '50', 'Maximum clients for Basic plan', true, NOW(), NOW()),
('pc-premium-clients', 'LIMIT', 'PREMIUM_CLIENTS', '100', 'Maximum clients for Premium plan', true, NOW(), NOW()),
('pc-enterprise-clients', 'LIMIT', 'ENTERPRISE_CLIENTS', '999999', 'Unlimited clients for Enterprise plan', true, NOW(), NOW()),
('pc-free-channels', 'LIMIT', 'FREE_CHANNELS', '1', 'Maximum WhatsApp channels for Free plan', true, NOW(), NOW()),
('pc-basic-channels', 'LIMIT', 'BASIC_CHANNELS', '1', 'Maximum WhatsApp channels for Basic plan', true, NOW(), NOW()),
('pc-premium-channels', 'LIMIT', 'PREMIUM_CHANNELS', '2', 'Maximum WhatsApp channels for Premium plan', true, NOW(), NOW()),
('pc-enterprise-channels', 'LIMIT', 'ENTERPRISE_CHANNELS', '999999', 'Unlimited WhatsApp channels for Enterprise plan', true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- TEAM MEMBER LIMITS
INSERT INTO platform_config (id, type, key, value, "description", "isActive", "createdAt", "updatedAt") VALUES
('pc-free-team', 'LIMIT', 'FREE_TEAM_MEMBERS', '0', 'Maximum team members for Free plan', true, NOW(), NOW()),
('pc-basic-team', 'LIMIT', 'BASIC_TEAM_MEMBERS', '0', 'Maximum team members for Basic plan', true, NOW(), NOW()),
('pc-premium-team', 'LIMIT', 'PREMIUM_TEAM_MEMBERS', '3', 'Maximum team members for Premium plan', true, NOW(), NOW()),
('pc-enterprise-team', 'LIMIT', 'ENTERPRISE_TEAM_MEMBERS', '999999', 'Unlimited team members for Enterprise plan', true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- PUSH CAMPAIGN SETTINGS
INSERT INTO platform_config (id, type, key, value, "description", "isActive", "createdAt", "updatedAt") VALUES
('pc-push-throttle', 'LIMIT', 'PUSH_THROTTLE_PER_SEC', '10', 'Default throttle for push campaigns (messages per second)', true, NOW(), NOW()),
('pc-push-batch', 'LIMIT', 'PUSH_BATCH_SIZE', '50', 'Default batch size for push campaigns', true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
