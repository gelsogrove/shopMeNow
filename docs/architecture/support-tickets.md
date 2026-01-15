# Support Tickets

## Overview

Support tickets provide a secure, auditable channel for customer help requests.
Tickets are created by workspace owners and handled by platform admins.

## Core Entities

- SupportTicket: high-level ticket metadata (status, subject, issue type)
- SupportMessage: threaded messages for a ticket (customer or admin)
- SupportAttachment: files linked to a message (private storage)

## Access Rules

- Owner access is limited to tickets created by the authenticated user.
- Platform admins can access all tickets.
- Owner delete is allowed only for their own ticket.
- Admin delete is allowed for any ticket.
- Admins can create tickets on behalf of a user (support-initiated message).

## API Endpoints

Owner routes:

- POST `/api/support/tickets` create a ticket
- GET `/api/support/tickets` list own tickets
- GET `/api/support/tickets/:ticketId` get ticket details
- POST `/api/support/tickets/:ticketId/messages` add a message
- PUT `/api/support/tickets/:ticketId/status` update status (admin only)
- DELETE `/api/support/tickets/:ticketId` delete own ticket

Admin routes:

- POST `/api/admin/support/tickets` create a support-initiated ticket
- GET `/api/admin/support/tickets` list all tickets
- GET `/api/admin/support/tickets/:ticketId` get ticket details
- POST `/api/admin/support/tickets/:ticketId/messages` add admin reply
- PUT `/api/admin/support/tickets/:ticketId/status` update status
- DELETE `/api/admin/support/tickets/:ticketId` delete any ticket

## Attachments

- Max 5 files per message, 10MB each.
- Allowed types: images, PDF, DOC/DOCX, TXT.
- Stored in `support-tickets/<ticketId>` with `isPublic=false`.
- Deleting a ticket deletes all attachments first, then removes DB records.

## Cleanup

- A scheduler job removes attachments from CLOSED tickets older than a retention period.
- `SUPPORT_ATTACHMENTS_RETENTION_DAYS` controls retention (default 90).

## Issue Types

- Standard types: account, billing, WhatsApp, widget, sales agent, other.
- Support-initiated tickets use `SUPPORT` (displayed as “Support Message”).
*** End Patch},"workdir":"/Users/gelso/workspace/shopME"}Commentary to=functions.apply_patch code snippet_json ￣奇米assistant to=functions.apply_patch elseblock {json}Commentary to=functions.apply_patch code snippet_json  天天大奖彩票站 is freeform so we must ensure patch correct. Let's redo. 
