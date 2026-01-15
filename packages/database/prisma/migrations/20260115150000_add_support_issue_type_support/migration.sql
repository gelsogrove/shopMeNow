-- Add Support issue type for admin-initiated messages
ALTER TYPE "SupportIssueType" ADD VALUE IF NOT EXISTS 'SUPPORT';
