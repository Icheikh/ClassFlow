# Notifications Roadmap

## Current State

The project currently has a basic notification foundation, but not yet a unified notification center.

Implemented so far:

- Fee invoices can be generated monthly from the invoices page.
- Fee reminders can be queued as notifications with channel `WHATSAPP`.
- Payment receipts can generate notifications with channel `WHATSAPP`.
- Notifications are stored in the database.
- Finance flow was verified locally and committed in:
  - `fc97fd6` `Add monthly fee billing and reminder flows`

Important limitation of the current implementation:

- Notifications are only being queued internally.
- There is no approval workflow yet.
- There is no central UI for reviewing, approving, rejecting, scheduling, or tracking campaigns.
- There is no actual WhatsApp provider integration yet.
- Fee reminders are still feature-specific, not part of a unified school-wide notification system.

## Product Direction Agreed

The agreed direction is to build a **unified notification center** for the whole school.

This center must support:

- Fees
- Attendance and absence
- Results
- Events
- General announcements
- Payment receipts
- Emergency messages

The school director must have full control.

The director or studies manager must be able to:

- Create a notification manually
- Choose the notification type
- Choose the audience
- Exclude specific recipients
- Customize the message
- Review a preview before sending
- Save draft
- Approve sending
- Cancel sending
- Track delivery results

## Core Rule

Notifications to parents through WhatsApp must **not** be sent automatically.

Correct workflow:

1. The system prepares a notification request.
2. The request appears inside the platform for internal review.
3. The director or studies manager approves it.
4. Only after approval can the message be sent to parents.
5. Every action must be traceable in the audit trail.

## Recommended Architecture

Build one shared notification engine instead of separate notification logic in each feature.

### 1. Notification Templates

Reusable templates for:

- Fee reminder
- Payment receipt
- Student absence
- Results published
- Event invitation
- General notice
- Emergency notice

Each template should contain:

- Internal name
- Type
- Default title
- Default message body
- Supported channels
- Whether approval is required

### 2. Notification Campaigns

Each send operation should be represented as a campaign.

A campaign should contain:

- Type
- Channel
- Status
- Title
- Message body
- Created by
- Approved by
- Scheduled date
- Sent date
- Audience selection mode
- Filters metadata
- Exclusion metadata

### 3. Notification Recipients

Each campaign should create recipient rows for tracking.

Each recipient row should contain:

- Parent user
- Student
- WhatsApp number
- Delivery status
- Sent at
- Failure reason

### 4. Approval Workflow

Recommended statuses:

- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `REJECTED`
- `SCHEDULED`
- `SENDING`
- `SENT`
- `PARTIAL`
- `FAILED`
- `CANCELLED`

## Permissions Model

### School Director

- Full control over all notifications
- Can create, edit, approve, reject, cancel, send, resend

### Studies Manager

- Can prepare and review notifications
- Can approve/send if the director grants permission

### Accountant

- Can prepare finance-related campaigns only
- Should not send unless explicitly granted permission

### Teacher

- No parent notification sending by default

## Audience Targeting Requirements

The notification center must support targeting:

- All parents
- Parents of one classroom
- Parents of one level
- Parents of one stream
- Parents of selected students
- Parents of students with unpaid fees
- Parents of absent students
- Parents of students whose results are ready

It must also support exclusions:

- Specific parents
- Specific students
- Already-paid students
- Already-notified recipients

## UI to Build

Recommended main route:

- `/school/notifications`

Recommended sections:

- Campaigns
- Approvals
- Templates
- Delivery Log
- Settings

## Implementation Order

### Phase 1. Data Model

Add or refactor schema to support:

- notification templates
- notification campaigns
- notification recipients
- approval and delivery statuses
- audience and exclusion metadata

### Phase 2. Internal Workflow

Build backend APIs for:

- create campaign
- save draft
- submit for approval
- approve
- reject
- cancel
- list campaigns
- list recipients

### Phase 3. Notification Center UI

Build the management page:

- create notification
- select type
- select audience
- apply exclusions
- preview generated recipients
- review and approve
- inspect delivery history

### Phase 4. Connect Existing Finance Flow

Replace direct fee reminder behavior with:

- create finance notification campaign
- submit for approval
- send only after approval

Replace payment receipt behavior with:

- create receipt campaign or recipient batch
- approval policy depending on school rules

### Phase 5. Connect Other School Modules

After finance:

- attendance / absence
- results
- school events
- general announcements

### Phase 6. WhatsApp Provider Integration

Only after the internal workflow is stable:

- connect actual WhatsApp provider
- send from approved campaigns only
- store provider message ids and failures

## Immediate Next Step

The next correct implementation step is:

**Build the unified notification data model and approval workflow first.**

That means:

1. Review current `Notification` model usage
2. Design campaign-based schema
3. Add migration
4. Add base APIs
5. Add first UI for approvals

## Files/Areas Likely to Change Next

- `prisma/schema.prisma`
- `src/app/api/...` notification routes
- `src/lib/...` notification services
- `src/app/school/...` notification center pages
- permissions layer if new approval permissions are added

## Existing Related Work

Already present and relevant:

- Finance invoice generation
- Fee reminder queueing
- Payment receipt queueing
- Permission-based finance actions

Existing warning unrelated to this roadmap:

- There is still a React hook warning in:
  - `src/app/school/students/[id]/page.tsx`

## Resume Instruction

When resuming after a lost session, continue from:

**Unified Notification Center - Phase 1: schema and workflow design**

