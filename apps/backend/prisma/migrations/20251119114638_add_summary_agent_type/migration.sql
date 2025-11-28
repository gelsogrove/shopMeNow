/*
  Add SUMMARY_AGENT type to AgentType enum for conversation summarization functionality.
*/

-- AlterEnum
ALTER TYPE "AgentType" ADD VALUE 'SUMMARY_AGENT';
