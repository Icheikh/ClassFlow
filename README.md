# ClassFlow

Multi-tenant SaaS for digitizing daily school registers (attendance, lessons, grades) in Mauritanian schools.

**Target:** Mauritania (Arabic + French)  
**Stack:** Next.js 14, TypeScript, Tailwind CSS, Prisma (SQLite → PostgreSQL), NextAuth  
**Roles:** SUPER_ADMIN, SCHOOL_ADMIN, STAFF, TEACHER, PARENT  
**Permissions:** 15 fine-grained permissions (MANAGE_STUDENTS, MANAGE_COEFFICIENTS, APPROVE_GRADES, REVIEW_LESSONS, etc.)

---

## Quick Start

```bash
npm install
cp .env.example .env
npx prisma db push
npx prisma db seed
npm run dev
```

**Login:** `admin@alnoor.edu` / `password123`

---

## Project Structure

```
src/
├── app/
│   ├── api/school/       ← REST API (13 route files)
│   ├── school/           ← Admin pages (7 pages + 2 detail)
│   ├── teacher/          ← Teacher interface (3 pages)
│   ├── auth/             ← Login page
│   └── dashboard/        ← Legacy (redirected)
├── components/ui/        ← Reusable UI (7 components)
├── features/             ← Feature modules (attendance, lessons, grades)
├── hooks/                ← Shared hooks (useClasses, useStudents, useCurrentUser)
└── lib/
    ├── api/              ← API client + types
    ├── auth.ts           ← NextAuth config
    └── prisma.ts         ← Prisma client
```

---

## Admin Pages (`/school`)

| Page | Description |
|------|-------------|
| Dashboard | Stats: students, teachers, classrooms, today's absences |
| Academic Years | Manage school years + terms |
| Levels & Streams | Stages (primary/middle/high), levels, baccalaureate streams |
| Classrooms | Rooms with level/stream, detail page (students, teachers, lessons) |
| Subjects & Coefficients | Subjects + per-level/stream coefficients |
| Teachers | CRUD + assignments with hourly rates, detail page |
| Payroll | Per-assignment monthly hours × rate calculation |

---

## Database

24 models, multi-tenant via `schoolId`. Key entities:

- **Academic:** EducationStage → Level → Stream, AcademicYear → Term
- **People:** User → Teacher/Parent, Student with Enrollment
- **Assignments:** TeacherAssignment (teacher + subject + classroom + rate + hours)
- **Registers:** Attendance, Lesson, Grade
- **Finance:** Fee, Payment

---

## Permissions System

The system uses two layers of authorization:

**Base roles** determine the user's home interface and scope:
- `SUPER_ADMIN` — platform-wide, no school context. Cannot do daily school operations.
- `SCHOOL_ADMIN` — full access within their school (all permissions implicitly).
- `STAFF` — non-teaching school employee. Permissions are granted granularly.
- `TEACHER` — own classes/subjects only. Scope-based, no permissions needed.
- `PARENT` — own children only. Scope-based, no permissions needed.

**Fine-grained permissions** grant specific capabilities to STAFF users:
- `MANAGE_USERS`, `MANAGE_STUDENTS`, `MANAGE_TEACHERS`, `MANAGE_SUBJECTS`
- `MANAGE_COEFFICIENTS`, `MANAGE_ACADEMIC_YEARS`, `MANAGE_CLASSROOMS`
- `REVIEW_LESSONS`, `APPROVE_GRADES`, `LOCK_GRADES`
- `MANAGE_FEES`, `RECORD_PAYMENTS`, `VIEW_FINANCE_REPORTS`
- `VIEW_REPORTS`, `SEND_NOTIFICATIONS`

**Key rule:** Subject coefficients must never be hardcoded. All values live in the `SubjectCoefficient` table and are managed through the UI by users with `MANAGE_COEFFICIENTS`.

### Helper Functions (`src/lib/permissions.ts`)
- `hasPermission(user, "MANAGE_COEFFICIENTS")` — check if user has a permission
- `hasAnyPermission(user, [...])` — check if user has any of the listed permissions
- `hasAllPermissions(user, [...])` — check if user has all listed permissions
- `getUserPermissions(userId)` — fetch permissions from DB
- `authorize(session, { requiredRole?, requiredPermission?, schoolIdRequired? })` — API route guard

### Permission Categories

| Category | Permissions |
|----------|-------------|
| USERS | MANAGE_USERS |
| STUDENTS | MANAGE_STUDENTS |
| TEACHERS | MANAGE_TEACHERS, MANAGE_SUBJECTS, MANAGE_COEFFICIENTS |
| ACADEMIC | MANAGE_ACADEMIC_YEARS, MANAGE_CLASSROOMS |
| GRADES | REVIEW_LESSONS, APPROVE_GRADES, LOCK_GRADES |
| FINANCE | MANAGE_FEES, RECORD_PAYMENTS, VIEW_FINANCE_REPORTS |
| REPORTS | VIEW_REPORTS |
| NOTIFICATIONS | SEND_NOTIFICATIONS |

## Docs

- `PROJECT_STATUS.md` — Full status, gap analysis, technical debt
- `docs/PLAN.md` — Technical architecture + feature list
- `docs/PRODUCT.md` — Product plan, value proposition, roadmap
- `docs/CLASSFLOW_MASTER_SPEC.md` — Full system specification (roles, permissions, data model, workflows)
- `docs/PERMISSION_MIGRATION_PLAN.md` — Step-by-step plan for migrating from role-only to role+permission auth
- `docs/GRADE_ENGINE_SPEC.md` — Weighted assessment group grading engine specification
