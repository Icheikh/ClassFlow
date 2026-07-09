# ClassFlow Weekly Execution Plan

## Execution Rules

1. Large goals are split into small implementation steps.
2. After each step:
   - run targeted tests
   - analyze the result
   - fix issues if needed
   - continue automatically only when stable
3. Prioritize product stability before feature expansion.
4. Do not start advanced enterprise features before the core workflows are reliable.

## Priority Order

1. Stability, authentication, and app shell
2. Information architecture and terminology
3. Finance model and invoice workflow
4. Notifications workflow and clarity
5. Teacher operations
6. Results workflow
7. Student and parent experience
8. Design system consolidation

## Week 1: Stability, Auth, App Shell

### Goal
Remove the impression that the system is broken, inconsistent, or silently failing.

### Steps
1. Audit auth flow:
   - login form
   - next-auth session retrieval
   - role redirects
   - middleware protection
2. Fix login error handling and redirect reliability.
3. Fix unauthorized and forbidden flows:
   - redirect loops
   - raw forbidden states
   - missing role destinations
4. Stabilize shell consistency:
   - school layout
   - teacher layout
   - page-level navigation continuity
5. Run build and targeted route validation.

### Done Criteria
- Login never silently reloads without feedback.
- Every supported role lands on a valid route.
- Unauthorized users see predictable behavior.
- Main shells feel like one product.

## Week 2: Information Architecture and Terminology

### Goal
Make the product understandable from a school operations perspective.

### Steps
1. Review sidebar and route grouping.
2. Rename confusing labels.
3. Separate operational pages from advanced configuration.
4. Align page titles with sidebar labels.
5. Validate navigation continuity with sample user journeys.

## Week 3: Finance Model Clarification

### Goal
Make the finance domain understandable before redesigning screens.

### Steps
1. Clarify the distinction between fee, invoice, payment, and arrears.
2. Define invoice lifecycle states.
3. Define monthly generation rules.
4. Define reminder approval flow.
5. Validate with seed scenarios.

## Week 4: Fees and Invoices UX

### Goal
Split finance into understandable workflows.

### Steps
1. Separate fee management from invoice operations.
2. Separate invoice generation from invoice review.
3. Separate reminders from collections.
4. Add stronger summaries and action queues.
5. Validate partial payments and overdue flows.

## Week 5: Notifications Architecture

### Goal
Make campaign approval and delivery states reliable and understandable.

### Steps
1. Define campaign lifecycle.
2. Define sender and approver roles.
3. Define audience and exclusion summaries.
4. Validate recipient state transitions.
5. Validate missing-phone scenarios.

## Week 6: Notifications UX

### Goal
Make notification creation and review understandable to non-technical school staff.

### Steps
1. Redesign campaign summary.
2. Simplify recipient lists and stats.
3. Make approval status explicit.
4. Improve phone and RTL rendering.
5. Validate with fee and result campaign scenarios.

## Week 7: Teacher Operations Model

### Goal
Separate teacher attendance, teaching hours, and payroll logic.

### Steps
1. Review teacher attendance rules.
2. Review teaching-hours capture rules.
3. Review payroll calculation dependencies.
4. Connect teacher assignment clarity to compensation.
5. Validate weekly payroll scenarios.

## Week 8: Teacher UX

### Goal
Make teacher operations usable for school administration.

### Steps
1. Improve teacher profile continuity.
2. Improve attendance entry flow.
3. Improve teaching-hours entry flow.
4. Improve payroll review flow.
5. Validate end-to-end with demo staff.

## Week 9: Results Workflow Clarification

### Goal
Keep the grade engine powerful while making it easier to trust and operate.

### Steps
1. Lock terminology for tests, exams, subject average, and overall average.
2. Expose calculation summaries clearly.
3. Review readiness and publish states.
4. Validate classroom scenarios across terms.
5. Validate approval and publishing flow.

## Week 10: Results UX

### Goal
Turn result publication into a guided workflow.

### Steps
1. Improve classroom and term selection flow.
2. Improve readiness review.
3. Improve publish and lock clarity.
4. Improve generated result summaries.
5. Validate with seeded demo classrooms.

## Week 11: Student and Parent Core Experience

### Goal
Make the student the center of the school record and parent communication.

### Steps
1. Improve student detail continuity.
2. Improve parent linking clarity.
3. Improve finance, result, and notification visibility per student.
4. Validate communication readiness per student.
5. Review parent-facing entry points.

## Week 12: Design System Consolidation

### Goal
Reduce inconsistency across the entire product.

### Steps
1. Standardize buttons, inputs, and selects.
2. Standardize page headers and filter bars.
3. Standardize tables and status badges.
4. Standardize empty, loading, and error states.
5. Validate RTL and responsive behavior.
