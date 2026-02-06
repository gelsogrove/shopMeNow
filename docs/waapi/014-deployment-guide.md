# 014 - Deployment Guide

## Prerequisites
- Node.js 18+
- Redis (for Queue)
- Postgres

## Environment Variables
- `WHATSAPP_API_TOKEN` (Fallback/Global)
- `ULTRAMSG_API_URL` (Default)

## Webhook Configuration
- Endpoint: `https://api.echatbot.ai/api/whatsapp/webhook`
- Verification Token: Set in Workspace Settings.

## Monitoring
- Check Heroku Logs for `[WaAPI]` tag.
- Monitor Queue Depth.
