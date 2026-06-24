# ClassFlow — Master Specification Document

> **Single source of truth for the ClassFlow SaaS platform.**
> Last updated: 2026-06-23

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Roles & Permissions](#3-roles--permissions)
4. [Multi-Tenant Rules](#4-multi-tenant-rules)
5. [Data Models](#5-data-models)
6. [School Setup](#6-school-setup)
7. [Academic Years & Terms](#7-academic-years--terms)
8. [Levels, Stages & Streams](#8-levels-stages--streams)
9. [Subjects & Subject Coefficients](#9-subjects--subject-coefficients)
10. [Teacher Assignments](#10-teacher-assignments)
11. [Students & Enrollments](#11-students--enrollments)
12. [Attendance Workflow](#12-attendance-workflow)
13. [Lesson Book Workflow](#13-lesson-book-workflow)
14. [Grades Workflow](#14-grades-workflow)
15. [Report Cards](#15-report-cards)
16. [Finance](#16-finance)
17. [Notifications](#17-notifications)
18. [Subscription Model](#18-subscription-model)
19. [Route Map](#19-route-map)
20. [API Design](#20-api-design)
21. [Implementation Phases](#21-implementation-phases)
22. [Technical Debt & Security](#22-technical-debt--security)

---

## 1. Product Overview

### Problem
Schools in Mauritania and the Arab world rely on:
- Paper registers (attendance, lessons, grades, fees) — lost, torn, damaged
- Wasted time: teachers fill paper, admin reviews manually, accounting is done by hand
- **Shaken parent trust** — no instant communication, parents learn about absences days later
- No accurate, real-time reporting

### Solution — ClassFlow
A SaaS platform digitizing the **daily registers** of schools:
- **Digital Attendance Register** — teacher opens app → records absence → parent receives instant notification
- **Digital Lesson Book** — teacher records lesson title + homework → admin monitors
- **Digital Grade Book** — teacher enters scores → system calculates averages & ranks → printable reports
- **Digital Fee Register** — payment recording → arrears tracking → receipts → automatic reminders
- **Teacher Attendance** — app auto-records teacher check-in → no more paper sign-in sheets

### Target Market
| Customer | Problem | Why ClassFlow? |
|----------|---------|----------------|
| **School Director** | No clear view of the school | Accurate dashboard, real-time reports, complete oversight |
| **Teacher** | Hours wasted on paper filling and calculations | 5 minutes/day, no manual math |
| **Parent** | No visibility until it's too late | Instant notifications (absence, grades, fees) |
| **Accountant** | Calculation errors, torn ledgers | Accurate system, auto-receipts, automated reminders |

### Why Choose ClassFlow
1. **Simplicity** — no bloated ERP, just what the school needs daily
2. **Speed** — teacher works from phone in minutes
3. **Instant communication** — parent knows about absence immediately
4. **No manual calculations** — system calculates everything
5. **Multilingual** — Arabic + French (Mauritania-appropriate)
6. **Affordable** — monthly subscription vs buying a full system

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript 5 |
| **Auth** | NextAuth v4 with JWT strategy |
| **Database** | SQLite (dev) → PostgreSQL (prod target) |
| **ORM** | Prisma |
| **UI** | Tailwind CSS, Radix UI (Dialog, Select, Dropdown, Slot) |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **Notifications** | react-hot-toast (in-app) |
| **Utilities** | clsx, tailwind-merge, class-variance-authority |
| **Linting** | ESLint with eslint-config-next |
| **Password hashing** | bcryptjs (10 rounds) |

---

## 3. Roles & Permissions

### Permission System Overview

The system uses **two layers** of authorization:

1. **Base roles** — broad category that determines the user's home interface and default scope.
2. **Fine-grained permissions** — granular rights assigned to each user within a school.

The code must check **permissions**, not only role names. Roles determine the
default permission set and the UI layout, but SCHOOL_ADMIN can grant or revoke
individual permissions for STAFF users to create custom roles (Director of Studies,
Accountant, Assistant Director, etc.).

All permission checks must respect `schoolId` — no user can ever access data
from a different school.

### Base Roles

| Role | Scope | Description |
|------|-------|-------------|
| **SUPER_ADMIN** | Platform-wide | Manages schools, subscriptions, support. No schoolId. No daily school operations. |
| **SCHOOL_ADMIN** | Own school | Full permissions inside their school. Can manage staff, grant permissions, oversee everything. |
| **STAFF** | Own school | Non-teaching school employee. Permissions are granted granularly by SCHOOL_ADMIN. |
| **TEACHER** | Own classes/subjects | Classroom-bound: attendance, lessons, grades for assigned classes only. |
| **PARENT** | Own children | Read-only: attendance, grades, schedules for linked children only. |

### Fine-Grained Permissions

| Permission Code | Description | Typically Granted To |
|-----------------|-------------|---------------------|
| `MANAGE_USERS` | Create/edit/activate/deactivate user accounts (staff, teachers) | SCHOOL_ADMIN |
| `MANAGE_STUDENTS` | Register, edit, transfer, deactivate students | SCHOOL_ADMIN, Assistant Director |
| `MANAGE_TEACHERS` | Add, edit, assign, suspend teachers | SCHOOL_ADMIN, Assistant Director |
| `MANAGE_SUBJECTS` | Create/edit subjects | SCHOOL_ADMIN, Director of Studies |
| `MANAGE_COEFFICIENTS` | Set subject coefficients per level/stream | SCHOOL_ADMIN, Director of Studies |
| `MANAGE_ACADEMIC_YEARS` | Create/edit academic years and terms | SCHOOL_ADMIN |
| `MANAGE_CLASSROOMS` | Create/edit/merge classrooms | SCHOOL_ADMIN |
| `REVIEW_LESSONS` | Review, approve, or request correction of lesson entries | Director of Studies |
| `APPROVE_GRADES` | Approve teacher-submitted grades (DRAFT→SUBMITTED→APPROVED) | SCHOOL_ADMIN, Director of Studies |
| `LOCK_GRADES` | Lock finalized grades (no further changes) | SCHOOL_ADMIN |
| `MANAGE_FEES` | Create/edit fee structures | SCHOOL_ADMIN, Accountant |
| `RECORD_PAYMENTS` | Record payments, print receipts, issue reminders | Accountant |
| `VIEW_FINANCE_REPORTS` | View financial reports and arrears | SCHOOL_ADMIN, Accountant |
| `VIEW_REPORTS` | View dashboards and PDF reports | SCHOOL_ADMIN, Director of Studies, Assistant Director |
| `SEND_NOTIFICATIONS` | Send notifications to parents | SCHOOL_ADMIN |

### Default Permission Sets

#### SUPER_ADMIN
- Not governed by fine-grained permissions.
- Has platform-level access only: manage schools, subscriptions, platform reports.
- Cannot interact with daily school operations (attendance, grades, finance).

#### SCHOOL_ADMIN
- Automatically has **all permissions** within their own school.
- Can create STAFF users and grant any subset of permissions to create custom roles.

#### STAFF (custom role composition)

A SCHOOL_ADMIN creates custom staff roles by creating a STAFF user and granting
specific permissions. Examples:

**Director of Studies (مدير الدراسات):**
- `MANAGE_SUBJECTS`
- `MANAGE_COEFFICIENTS`
- `REVIEW_LESSONS`
- `APPROVE_GRADES`

**Accountant (محاسب):**
- `MANAGE_FEES`
- `RECORD_PAYMENTS`
- `VIEW_FINANCE_REPORTS`

**Assistant Director (مساعد المدير):**
- `MANAGE_STUDENTS`
- `MANAGE_TEACHERS`
- `VIEW_REPORTS`

**Supervisor (مراقب):**
- `VIEW_REPORTS`
- (Attendance viewing is implicit for all staff — controlled by scope, not permission)

#### TEACHER
- No fine-grained permissions needed (scope-based access).
- Can only access own assigned classes/subjects.
- Can create attendance records, lessons, and grades (DRAFT/SUBMITTED only).
- Cannot approve, lock, review, or manage users.

#### PARENT
- No fine-grained permissions (scope-based access).
- Read-only access to own children's data only.
- Cannot modify anything.

### How Permissions Work in Practice

1. **Authentication:** User logs in. Session contains `userId`, `role`, `schoolId`, and list of `permissions`.
2. **Route protection:** Middleware redirects based on base role (e.g., TEACHER → `/teacher/*`, STAFF → `/school/*`).
3. **API authorization:** Every API route checks:
   ```
   if (!userHasPermission(session, "MANAGE_COEFFICIENTS"))
     return 403
   ```
4. **Scope isolation:** Every query filters by `schoolId`. TEACHER queries additionally filter by `teacherId` → assigned classrooms/subjects. PARENT queries filter by linked `studentId`s.
5. **UI visibility:** Buttons and links are conditionally rendered based on permissions, not role.

---

## 4. Multi-Tenant Rules

### Isolation Model
- Every record is scoped to a `schoolId`
- No cross-school data access at any layer
- `School` table is the root tenant entity
- All 24 models in the schema carry a `schoolId` foreign key (directly or indirectly)

### Enforced By
1. **Prisma schema** — every model has `schoolId` with `@@index([schoolId])`
2. **API layer** — all routes extract `user.schoolId` from session and filter by it
3. **Middleware** — route protection via `next-auth/middleware`

### User→School Relationship
- `User.schoolId` is nullable (SUPER_ADMIN has no school)
- All other roles require a `schoolId`
- One user account per person (no multi-school access for same user)
- `User.email` is globally unique

### Seed Data
- 2 schools (النور, الفتح) for development/testing
- All seed data isolated per school

---

## 5. Data Models

**24 models** in `prisma/schema.prisma`:

### Platform & School
| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **School** | id, name, slug (unique), address, phone, email, logo, subscriptionStatus, billingStudentCount, isActive | Root tenant — relates to all other models |

### Academic Structure
| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **EducationStage** | id, schoolId, name, order | HasMany Level |
| **Level** | id, schoolId, stageId, name, order | Belongs to Stage; HasMany Classroom, Stream, SubjectCoefficient |
| **Stream** | id, schoolId, levelId, name, code | Belongs to Level; HasMany Classroom, SubjectCoefficient |
| **AcademicYear** | id, schoolId, name, startsAt, endsAt, isActive | HasMany Term, Enrollment, TeacherAssignment, Attendance, Lesson, Grade |
| **Term** | id, schoolId, academicYearId, name, startsAt, endsAt, order, isActive | Belongs to AcademicYear; HasMany Attendance, Lesson, Grade |

### Classroom & Subject
| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **Classroom** | id, schoolId, levelId, streamId?, name, capacity | Belongs to Level & Stream; HasMany Enrollment, TeacherAssignment, Lesson, Attendance, Grade |
| **Subject** | id, schoolId, nameAr, nameFr?, code?, isActive | HasMany TeacherAssignment, SubjectCoefficient, Grade, Lesson |
| **SubjectCoefficient** | id, schoolId, academicYearId, levelId, streamId?, subjectId, coefficient | Unique on [academicYearId, levelId, streamId, subjectId] |

### People
| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **User** | id, email (unique), passwordHash, name, phone, role, schoolId?, isActive | HasOne Teacher or Parent; HasMany Notification |
| **Teacher** | id, userId (unique), schoolId, phone, status | HasMany TeacherAssignment, Lesson, Grade, TeacherAttendance |
| **Parent** | id, userId (unique), schoolId, phone, preferredLanguage | HasMany StudentParent |
| **Student** | id, schoolId, firstName, lastName, gender?, birthDate?, studentNumber?, address?, phone?, isActive | HasMany Enrollment, StudentParent, Attendance, Grade, Payment |
| **StudentParent** | id, schoolId, studentId, parentId, relationship?, isPrimary, receiveNotifications | Unique on [studentId, parentId] |

### Enrollments & Assignments
| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **Enrollment** | id, schoolId, studentId, academicYearId, classroomId, status, enrolledAt | Unique on [studentId, academicYearId] |
| **TeacherAssignment** | id, schoolId, teacherId, subjectId, classroomId, academicYearId, hourlyRate?, weeklyHours?, isActive | Unique on [teacherId, subjectId, classroomId, academicYearId] |

### Daily Registers
| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **Attendance** | id, schoolId, academicYearId, termId?, date, status, studentId, classroomId, subjectId?, teacherId | Unique on [studentId, date, subjectId] |
| **Lesson** | id, schoolId, academicYearId, termId?, title, description, duration?, homework, notes, status, date, classroomId, subjectId, teacherId | — |
| **Grade** | id, schoolId, academicYearId, termId, assessmentType, label, score, maxScore (default 20), status, date, studentId, subjectId, classroomId, teacherId | — |

### Finance
| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **Fee** | id, schoolId, name, amount, frequency, levelId?, classroomId?, isActive | HasMany Payment |
| **Payment** | id, schoolId, amount, date, method, receiptNumber?, notes?, studentId, feeId?, receivedByUserId? | — |

### Attendance & Notifications & Schedule
| Model | Key Fields | Relations |
|-------|-----------|-----------|
| **TeacherAttendance** | id, schoolId, date, checkIn?, checkOut?, status, teacherId, userId | Unique on [teacherId, date] |
| **Notification** | id, schoolId, title, message, type, channel (default "IN_APP"), status (default "PENDING"), userId, read | — |
| **Schedule** | id, schoolId, dayOfWeek, startTime, endTime, classroomId, subjectId, teacherId? | — |

### Proposed Future Models (from PLAN.md)
- **Director** — extends Teacher or separate entity
- **StudentTransfer** — student movement between classrooms
- **GradeValidation** — admin grade approval records
- **ExamSchedule** — exam timetable

---

## 6. School Setup

### Process Flow
1. SUPER_ADMIN creates a School record (name, slug, contact info)
2. Subscription status starts as `TRIAL` by default
3. School admin receives credentials (User record with SCHOOL_ADMIN role)
4. School admin sets up:
   - Education stages (e.g., Primary, Middle, Secondary)
   - Levels within stages (e.g., Grade 1-6, Grade 7-9)
   - Streams for baccalaureate levels (e.g., Science, Arts, Math)
   - Academic years & terms
   - Subjects
   - Subject coefficients per level/stream
   - Classrooms
   - Teacher records + assignments
   - Student records + enrollments
5. Platform is ready for daily operations

### School Settings
- Name, slug, address, phone, email, logo
- All configurable via `/school/settings` (not yet implemented)

### Staff Management
- SCHOOL_ADMIN can create accounts for:
  - DIRECTOR (مدير الدراسات)
  - SUPERVISOR (مراقب)
  - ACCOUNTANT (محاسب)
- Staff accounts are Users with specific roles, linked to school
- No staff management page exists yet

---

## 7. Academic Years & Terms

### Academic Year
- Represents a full school year (e.g., "2025-2026")
- Has `startsAt` and `endsAt` dates
- Only one academic year can be `isActive: true` at a time
- All daily records (attendance, lessons, grades) reference the active year/term

### Term
- Belongs to an AcademicYear
- Ordered by `order` field (1, 2, 3 for trimesters)
- Has its own `startsAt`, `endsAt`, and `isActive`
- Only one term can be active at a time within a year

### Current Status
- ✅ CRUD for Academic Years (`/school/academic-years`)
- ✅ CRUD for Terms (inline within academic year page)
- ✅ Activation toggle for years and terms
- ✅ API: `/api/school/academic-years` (GET, POST)
- ✅ API: `/api/school/terms` (GET, POST, PUT for activation)

---

## 8. Levels, Stages & Streams

### EducationStage
- Top level of academic structure (e.g., "ابتدائي", "إعدادي", "ثانوي")
- Ordered by `order` field
- HasMany Level

### Level
- Belongs to an EducationStage (e.g., "السنة الأولى ابتدائي")
- Ordered by `order` field
- HasMany Classroom, Stream, SubjectCoefficient

### Stream
- Belongs to a Level (baccalaureate specialization)
- Examples: "شعبة العلوم", "شعبة الآداب", "شعبة الرياضيات"
- Has an optional `code`
- Only relevant for secondary levels

### Current Status
- ✅ Stages, levels, and streams CRUD (`/school/levels`)
- ✅ Visual tree: Stage → Level → Stream → Classrooms
- ✅ API: `/api/school/stages` (GET, POST)
- ✅ API: `/api/school/levels` (GET, POST, PUT, DELETE)
- ✅ API: `/api/school/streams` (GET, POST, DELETE)
- ✅ Seed: 3 stages, 13 levels, 3 streams

---

## 9. Subjects & Subject Coefficients

### Subject
- Subjects taught at the school (e.g., "الرياضيات", "اللغة العربية")
- Has `nameAr` (Arabic) and optional `nameFr` (French)
- Optional `code` for identification
- Can be deactivated via `isActive`

### SubjectCoefficient
- Links a Subject to a specific Level (and optional Stream) within an AcademicYear
- Coefficient value (Float, default 1.0) determines grade weight
- Unique constraint: `[academicYearId, levelId, streamId, subjectId]`
- Enables different coefficients per level/stream (e.g., Math coefficient 5 in Science, 3 in Arts)
- **Subject coefficients must never be hardcoded in the codebase.** Every coefficient value must live in the `SubjectCoefficient` table and be managed through the UI by authorized staff. No default coefficient arrays, no config files with coefficient values, no environment variables for coefficients. This is a hard product rule.

### Current Status
- ✅ Subject CRUD (`/school/subjects`)
- ✅ Coefficient CRUD per level/stream, per academic year
- ✅ API: `/api/school/subjects` (GET, POST, PUT, DELETE)
- ✅ API: `/api/school/subject-coefficients` (GET, POST, DELETE)
- ✅ Seed: 8 subjects, 24 coefficients
- ✅ Access controlled by `MANAGE_COEFFICIENTS` permission (not a fixed role)

---

## 10. Teacher Assignments

### Model
- Links Teacher + Subject + Classroom + AcademicYear
- Each assignment has:
  - `hourlyRate` — teacher's pay rate per hour for this subject
  - `weeklyHours` — contracted weekly hours for this subject
  - `isActive` — soft delete flag
- Unique constraint: `[teacherId, subjectId, classroomId, academicYearId]`

### Business Rules
- A teacher can be assigned to multiple classrooms and subjects
- A classroom can have multiple teachers (one per subject)
- Payroll is calculated per-assignment: monthly hours × hourlyRate
- Assignment drives which data a teacher can see (attendance, lessons, grades for assigned classroom+subject)

### Current Status
- ✅ Assignment CRUD via `/api/school/teacher-assignments`
- ✅ Displayed on teacher detail page & classroom detail page
- ✅ Rate editing on teacher detail page
- ✅ Payroll page calculates per-assignment totals
- ⚠️ Missing: edit from teacher detail page (only delete and inline-rate edit work)
- ⚠️ Missing: payment tracking (paid/unpaid)

---

## 11. Students & Enrollments

### Student Model
- `firstName`, `lastName`, `gender`, `birthDate`, `studentNumber`, `address`, `phone`
- `isActive` for soft deactivation
- Linked to school via `schoolId`

### Enrollment
- Links Student + AcademicYear + Classroom
- `status`: defaults to "ACTIVE"
- Unique constraint: `[studentId, academicYearId]` — one classroom per year
- `enrolledAt` timestamp

### Business Rules
- A student must have exactly one active enrollment per academic year
- To change classrooms mid-year, the current enrollment must be updated or a StudentTransfer record created
- Student-parent relationships are tracked via `StudentParent` (many-to-many)

### Current Status
- ❌ No Students CRUD page exists
- ❌ No Enrollment management page exists
- ✅ Schema exists with Student, Enrollment, StudentParent models
- ✅ Seed: 18 students with enrollments across classrooms

### Implementation Plan (from PROJECT_STATUS.md)
1. Create `/api/school/students` (GET, POST, PUT, DELETE)
2. Create `/api/school/enrollments` (POST, DELETE)
3. Create `/school/students` page (list, add modal, enrollment)
4. Create `/school/students/[id]` detail page

---

## 12. Attendance Workflow

### Student Attendance
- Records a student's attendance for a specific date, classroom, and optional subject
- Statuses: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`
- Unique constraint: `[studentId, date, subjectId]`
- Recorded by TEACHER (their assigned classes only)
- Viewed by SCHOOL_ADMIN, SUPERVISOR, DIRECTOR, PARENT (own children)

### Teacher Attendance (TeacherAttendance)
- Records teacher check-in/check-out
- Statuses: `PRESENT` (default), with optional `checkIn`/`checkOut` timestamps
- Unique constraint: `[teacherId, date]`
- Intended to auto-record on login

### Current Status
- ✅ Teacher attendance page (`/teacher/attendance`) — tap-based PRESENT/ABSENT/LATE/EXCUSED
- ✅ API: `/api/attendance` (GET, POST) — TEACHER + SCHOOL_ADMIN + SUPERVISOR
- ✅ Attendance linked to student, classroom, subject, teacher
- ⚠️ Missing: view/edit past records
- ⚠️ Missing: attendance dashboard for admin (today's absences by classroom, trends)
- ⚠️ Missing: attendance → parent notification pipeline

### Workflow
```
Teacher→[Mark Attendance] → System saves record → [Optional] Notification sent to parent via WhatsApp
```

---

## 13. Lesson Book Workflow

### Lesson Model
- Records a daily lesson entry by teacher
- Fields: `title`, `description`, `duration` (minutes), `homework`, `notes`
- Status: `DRAFT` → workflow proposed: `SUBMITTED` → `REVIEWED` → `NEEDS_CORRECTION`
- Linked to: school, academicYear, term (optional), classroom, subject, teacher

### Workflow (Proposed)
1. **DRAFT** — Teacher creates entry (editable)
2. **SUBMITTED** — Teacher finalizes (DIRECTOR/SUPERVISOR can review)
3. **REVIEWED** — Approved by DIRECTOR/SUPERVISOR
4. **NEEDS_CORRECTION** — Sent back to teacher for revision

### Current Status
- ✅ Teacher lesson page (`/teacher/lessons`) — title, description, homework, status display
- ✅ API: `/api/lessons` (GET, POST) — TEACHER + SCHOOL_ADMIN + SUPERVISOR
- ✅ Status `DRAFT` works
- ⚠️ Missing: SUBMITTED → REVIEWED → NEEDS_CORRECTION workflow
- ⚠️ Missing: edit submitted lessons
- ⚠️ Missing: DIRECTOR/SUPERVISOR review interface

---

## 14. Grades Workflow

> **The grade calculation system is specified in detail in [`GRADE_ENGINE_SPEC.md`](./GRADE_ENGINE_SPEC.md).**
> This section summarizes the workflow and permissions. For the full formula, assessment groups,
> calculation profiles, database implications, and API design — read that document.

### Grade Model
- Records a student's score for a specific assessment
- Fields: `assessmentType` (constrained to profile-valid types: `TEST`, `EXAM_1`, `EXAM_2`, `EXAM_3`, `EXAM`), `label`, `score`, `maxScore` (default 20)
- Status: `DRAFT` → `SUBMITTED` → `APPROVED` → `LOCKED`
- Linked to: school, academicYear, term, student, subject, classroom, teacher

### Calculation Profiles
Two profiles are supported (assigned per stage or per level):

| Profile | Applicable To | Formula Summary |
|---------|--------------|-----------------|
| **PRIMARY** | Primary education | (TestsAvg × 2 + Exam × 1) / 3, then × coefficient |
| **MIDDLE_SECONDARY** | Middle & secondary | (TestsAvg × 3 + Exam1 × 1 + Exam2 × 2 + Exam3 × 3) / 9, then × coefficient |

### Formula (MIDDLE_SECONDARY)
```
SubjectAverage = (TestsAverage × 3 + Exam1 × 1 + Exam2 × 2 + Exam3 × 3) / 9
WeightedSubjectScore = SubjectAverage × SubjectCoefficient
GeneralAverage = SUM(WeightedSubjectScores) / SUM(SubjectCoefficients)
```

All grades out of 20. Coefficients stored in `SubjectCoefficient` table — never hardcoded.

### Workflow
1. **DRAFT** — Teacher enters scores (editable, not visible to parent). Requires TEACHER role.
2. **SUBMITTED** — Teacher finalizes (locked from editing). Requires TEACHER role.
3. **APPROVED** — User with `APPROVE_GRADES` permission validates.
4. **LOCKED** — User with `LOCK_GRADES` permission locks permanently.

### Current Status
- ✅ Teacher grade page (`/teacher/grades`) — score entry, DRAFT → SUBMITTED
- ✅ API: `/api/grades` (GET, POST) — TEACHER + users with grade permissions
- ⚠️ Missing: SUBMITTED → APPROVED workflow
- ⚠️ Missing: GradeValidation/GradeCalculation system
- ⚠️ Missing: auto-calculation of averages and ranks (see `GRADE_ENGINE_SPEC.md`)
- ⚠️ Missing: view class averages for teacher

---

## 15. Report Cards

### Requirements
- PDF report cards (bulletins) with:
  - School logo and info
  - Student info
  - Subject-by-subject scores with coefficients
  - Averages per term and overall
  - Class rank
  - Teacher comments
- Printable/downloadable by users with `VIEW_REPORTS` permission.

### Current Status
- ❌ Not started — no PDF generation

### Dependencies
- Grades workflow must be complete (APPROVED/LOCKED)
- Grade calculation engine must be built (see `GRADE_ENGINE_SPEC.md`)
- PDF generation library needed (e.g., `jspdf`, `pdfmake`, or `@react-pdf/renderer`)

---

## 16. Finance

### Fee Model
- `name` (e.g., "الرسوم الدراسية الشهرية")
- `amount` — fee value
- `frequency` — "MONTHLY", "YEARLY", "ONE_TIME", "TERM"
- `levelId`? — optional, applies to specific level(s)
- `classroomId`? — optional, applies to specific classroom(s)
- `isActive` — soft disable

### Payment Model
- `amount` — amount paid
- `date` — payment date
- `method` — "CASH", "CHEQUE", "TRANSFER", "CARD"
- `receiptNumber`? — auto-generated or manual
- `notes`? — optional description
- `studentId` — links to student
- `feeId`? — optional link to a specific fee
- `receivedByUserId`? — who recorded the payment

### Finance Workflow
1. SCHOOL_ADMIN or ACCOUNTANT creates Fee structures
2. Fees are automatically assigned to enrolled students
3. ACCOUNTANT records payments against fees
4. System tracks arrears per student
5. Payment reminders can be sent
6. Receipts can be printed
7. Financial reports generated

### Current Status
- ✅ Schema exists (Fee, Payment models)
- ❌ No finance pages exist
- ❌ No API routes for finance
- ❌ No payment → fee matching logic
- ❌ No receipt printing
- ❌ No arrears tracking

---

## 17. Notifications

### Notification Model
- `title`, `message` — notification content
- `type` — "ABSENCE", "GRADE", "PAYMENT", "GENERAL"
- `channel` — "IN_APP" (default), "WHATSAPP", "EMAIL", "SMS"
- `status` — "PENDING", "SENT", "FAILED"
- `userId` — target user
- `read` — boolean flag
- `sentAt`, `errorMessage` — delivery tracking

### Notification Scenarios
1. **Absence recorded** → Parent notified immediately (WhatsApp)
2. **Grades submitted** → Parent notified when grades are approved
3. **Payment reminder** → Parent notified of arrears
4. **Teacher late** → Admin notified

### Current Status
- ✅ Schema exists (Notification model)
- ❌ No WhatsApp integration
- ❌ No notification queue
- ❌ No absence → parent notification pipeline
- ❌ No parent app/pages exist

---

## 18. Subscription Model

### Current State
- `School.subscriptionStatus`: defaults to "TRIAL"
- `School.billingStudentCount`: tracks billable student count
- No payment integration yet

### Proposed Pricing (from PRODUCT.md)
```
Small school (<100 students):   XXX OMR/month
Medium school (100-500):        XXX OMR/month
Large school (500+):            XXX OMR/month
All basic services included. Premium services: additional fee.
```

### Basic Services (included)
1. Attendance register + WhatsApp notifications
2. Lesson book
3. Grade book + automatic calculation
4. Fee register (payments, receipts, arrears)
5. Teacher attendance
6. Student management
7. Teacher management
8. Reports (PDF)
9. Notifications

### Premium Services (future)
1. Timetable builder (drag & drop)
2. Digital library (lesson sharing)
3. Direct communication (teacher-parent chat)
4. Parent mobile app

### Future Implementation
- Stripe integration for payment collection
- Plan tiers: TRIAL → ACTIVE → EXPIRED → SUSPENDED
- Automatic billing student count sync
- School suspension on non-payment

---

## 19. Route Map

### Access Model

Route access is controlled by **base role**, **permissions**, or **both**:

| Base Role | Default Landing | Access Pattern |
|-----------|----------------|----------------|
| SUPER_ADMIN | `/admin` | Role-gated — no school context |
| SCHOOL_ADMIN | `/school` | Role-gated — has all permissions implicitly |
| STAFF | `/school` | Permission-gated — UI visibility depends on granted permissions |
| TEACHER | `/teacher` | Role + scope-gated — own classes/subjects only |
| PARENT | `/parent` | Role + scope-gated — own children only |

### Current Routes

```
/                                         Login
├── /admin                                Platform admin (SUPER_ADMIN) — ❌ not built
│
├── /school                               School management (SCHOOL_ADMIN + STAFF)
│   ├── /school                           Dashboard (✅ stats + quick links)
│   ├── /school/academic-years            Academic years & terms (✅ CRUD)
│   ├── /school/levels                    Stages, levels, streams (✅ CRUD)
│   ├── /school/classrooms                Classrooms (✅ CRUD + detail)
│   ├── /school/subjects                  Subjects & coefficients (✅ CRUD)
│   ├── /school/teachers                  Teachers (✅ CRUD + detail)
│   ├── /school/payroll                   Payroll (✅)
│   ├── /school/students                  Students (❌ not built)
│   ├── /school/settings                  School settings (❌ not built)
│   └── /school/staff                     Staff & permissions management (❌ not built)
│
├── /teacher                              Teacher interface (TEACHER)
│   ├── /teacher/attendance               Attendance sheet (✅ tap-based)
│   ├── /teacher/lessons                  Lesson book (✅ DRAFT entry)
│   └── /teacher/grades                   Grade book (✅ DRAFT→SUBMITTED)
│
├── /finance                              Finance (STAFF with MANAGE_FEES / RECORD_PAYMENTS / VIEW_FINANCE_REPORTS)
│   ├── /finance/fees                     Fee management — ❌ not built
│   ├── /finance/payments                 Payment recording — ❌ not built
│   ├── /finance/receipts                 Receipts — ❌ not built
│   └── /finance/reports                  Financial reports — ❌ not built
│
├── /supervision                          Supervision (STAFF with REVIEW_LESSONS / VIEW_REPORTS)
│   ├── /supervision/attendance           Attendance monitoring — ❌ not built
│   ├── /supervision/teachers             Teacher attendance — ❌ not built
│   └── /supervision/reports              Reports — ❌ not built
│
└── /parent                               Parent portal (PARENT) — ❌ not built
    ├── /parent/attendance                Children's attendance
    ├── /parent/grades                    Children's grades
    └── /parent/notifications             Notifications
```

---

## 20. API Design

### Existing API Routes

| Method | Endpoint | Status |
|--------|----------|--------|
| GET, POST | `/api/school/academic-years` | ✅ |
| GET, POST | `/api/school/terms` | ✅ |
| GET, POST | `/api/school/stages` | ✅ |
| GET, POST, PUT, DELETE | `/api/school/levels` | ✅ |
| GET, POST, DELETE | `/api/school/streams` | ✅ |
| GET, POST, PUT, DELETE | `/api/school/classrooms` | ✅ |
| GET | `/api/school/classrooms/[id]` | ✅ |
| GET, POST, PUT, DELETE | `/api/school/subjects` | ✅ |
| GET, POST, DELETE | `/api/school/subject-coefficients` | ✅ |
| GET, POST, PUT, DELETE | `/api/school/teachers` | ✅ |
| GET | `/api/school/teachers/[id]` | ✅ |
| GET, POST, PUT, DELETE | `/api/school/teacher-assignments` | ✅ |
| GET | `/api/school/payroll` | ✅ |
| GET, POST | `/api/attendance` | ✅ |
| GET, POST | `/api/lessons` | ✅ |
| GET, POST | `/api/grades` | ✅ |
| GET | `/api/teacher/classes` | ✅ |

### Planned API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET, POST | `/api/school/students` | Student CRUD |
| PUT, DELETE | `/api/school/students/[id]` | Student update/delete |
| POST, DELETE | `/api/school/enrollments` | Enrollment management |
| GET, PUT | `/api/school/calculation-profiles` | Assign calculation profile to stage/level |
| POST | `/api/grades/calculate` | Trigger grade calculation engine |
| GET | `/api/grades/calculations` | Retrieve calculated subject grades |
| GET | `/api/grades/general-averages` | Retrieve general averages + ranks |
| GET | `/api/grades/report-card/:studentId` | Full report card for one student |
| GET, POST, PUT, DELETE | `/api/school/staff` | Staff CRUD (STAFF users) |
| GET, PUT | `/api/school/staff/[id]/permissions` | Grant/revoke permissions for a STAFF user |
| GET, POST | `/api/finance/fees` | Fee management |
| GET, POST | `/api/finance/payments` | Payment recording |
| GET | `/api/finance/reports` | Financial reports |
| GET, POST | `/api/notifications` | Notifications |

### API Patterns
- All routes check `getServerSession` from NextAuth.
- **Role guard** — routes check the base role for entry (e.g., `SCHOOL_ADMIN`/`STAFF` for `/api/school/*`).
- **Permission guard** — for sensitive operations, the code checks `session.user.permissions` (e.g., `MANAGE_COEFFICIENTS`, `APPROVE_GRADES`). The API returns 403 if missing.
- **Scope isolation** — TEACHER queries filter by `teacherId` → assigned classrooms/subjects. PARENT queries filter by linked children. All queries filter by `user.schoolId`.
- **Error handling:** try/catch with Prisma error messages for FK constraint failures.
- No pagination yet (will break with large datasets).
- No input validation beyond required field checks (Prisma type validation only).

---

## 21. Implementation Phases

### Phase 1 — Infrastructure + School Management (In Progress)
- ✅ Base project + Auth + DB
- ✅ Seed fix
- ✅ Teacher interface API integration
- ⬜ **Teacher CRUD** — DONE (needs review)
- ⬜ **Student CRUD** — NOT STARTED
- ⬜ **Classroom management** — DONE
- ⬜ **Staff management** — NOT STARTED

### Phase 2 — Code Quality & Refactoring
- Code restructuring
- Standard UI components
- Separate logic from UI (hooks, services)
- Error boundaries + loading states
- Pagination for lists
- API input validation

### Phase 3 — Finance
- Full fee management system
- Payment recording
- Receipts
- Arrears tracking
- Financial reports

### Phase 4 — Notifications + Parent Portal
- WhatsApp integration
- Notification queue
- Parent portal pages
- Absence → parent notification pipeline

### Phase 5 — Deployment
- Switch from SQLite to PostgreSQL
- Deploy to production
- Stripe subscription integration

---

## 22. Technical Debt & Security

### Technical Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| `.DS_Store` tracked in git | Low | Add to `.gitignore` |
| Zero test coverage | **High** | No unit or integration tests |
| No error boundaries | Medium | Crash on any page kills the app |
| Loading states inconsistent | Low | Mix of LoadingPage and inline spinners |
| No API input validation | Medium | Prisma types validate but no custom validation |
| Radix Select empty value bug | Fixed | Hidden empty `<RadixSelect.Item>` workaround |
| Soft delete not implemented | Low | DELETE removes rows (except teachers → status) |
| No pagination on lists | Medium | Will break with 1000+ records |
| No rate limiting | Medium | No protection against abuse |
| No request/audit logging | Low | No audit trail for admin actions |
| Seed doesn't run automatically | Low | Manual `npx prisma db seed` required |
| **Permission system not implemented** | **High** | All routes still use role-name checks, not fine-grained permissions. No `Staff` model, no permission DB table, no middleware for permission checks. |

### Security

| Issue | Risk | Status |
|-------|------|--------|
| No password reset flow | Medium | User must contact admin |
| Passwords hashed with bcrypt (10 rounds) | ✅ Good | — |
| JWT secret in `.env` not committed | ✅ Good | — |
| API protected via `getServerSession` | ✅ Good | All routes check session |
| SQLite in production | 🔴 **High** | Must switch to PostgreSQL |
| No CSRF protection | Medium | NextAuth provides partial |
| No input sanitization | Low | School admin is trusted role |
| No audit log | Medium | Sensitive actions not logged |

### Current Build Status
- ✅ `npm run lint` — 0 errors, 0 warnings
- ✅ `npm run build` — pass (34 static pages)
- Git: 8 commits on `main`

---

## Appendix A: Seed Data Overview

| Entity | Count |
|--------|-------|
| Schools | 2 (النور, الفتح) |
| Education Stages | 3 |
| Levels | 13 |
| Streams | 3 |
| Subjects | 8 |
| Subject Coefficients | 24 |
| Teacher Assignments | 4 |
| Students | 18 |

## Appendix B: Glossary

| Term (Arabic) | English | Description |
|--------------|---------|-------------|
| المرحلة | EducationStage | Broad educational phase (primary, middle, secondary) |
| المستوى | Level | Grade/year within a stage (e.g., Grade 1) |
| الشعبة | Stream | Baccalaureate specialization (e.g., Science, Arts) |
| القسم | Classroom | Physical section of a level/stream |
| المادة | Subject | Academic subject (e.g., Math, Arabic) |
| المعامل | Coefficient | Weight multiplier for a subject's grade |
| الفصل | Term | School term/trimester |
| السنة الدراسية | AcademicYear | Full school year |
| الأستاذ | Teacher | Teaching staff |
| ولي الأمر | Parent | Guardian of student |
| المراقب | Supervisor | STAFF user with `VIEW_REPORTS` and attendance monitoring scope |
| مدير الدراسات | Director of Studies | STAFF user with `MANAGE_SUBJECTS`, `MANAGE_COEFFICIENTS`, `REVIEW_LESSONS`, `APPROVE_GRADES` |
| المحاسب | Accountant | STAFF user with `MANAGE_FEES`, `RECORD_PAYMENTS`, `VIEW_FINANCE_REPORTS` |
| كشف النقاط | Report Card | Grade report/bulletin |
| القسط | Fee | Tuition or other fee |
| وصل | Receipt | Payment receipt |
