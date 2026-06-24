# 📊 ClassFlow — Project Status

**Last updated:** 2026-06-23  
**Build:** ✅ Pass  
**Lint:** ✅ Pass (0 errors, 0 warnings)  
**Database:** SQLite (local), 26 models  
**Commits:** 8 on `main`

---

## ✅ Completed Features

### Authentication & Authorization
- NextAuth with JWT strategy
- 7 roles: SUPER_ADMIN, SCHOOL_ADMIN, STAFF, ACCOUNTANT, SUPERVISOR, TEACHER, PARENT
- 15 fine-grained permissions (Permission + UserPermission models)
- Session includes `permissions[]` from DB
- `hasPermission()`, `hasAnyPermission()`, `authorize()` helpers available
- Login with role-based redirect (STAFF → `/school`, etc.)
- Middleware protects `/school/*` and `/api/school/*`

### Multi-Tenant Isolation
- Every query filtered by `schoolId`
- Seed includes 2 schools (النور, الفتح)

### School Admin — Pages (7 total)

| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/school` | ✅ Stats + quick links |
| Academic Years & Terms | `/school/academic-years` | ✅ CRUD + activate |
| Levels, Stages, Streams | `/school/levels` | ✅ CRUD |
| Classrooms | `/school/classrooms` | ✅ CRUD + detail page |
| Subjects & Coefficients | `/school/subjects` | ✅ CRUD + per-level/stream |
| Teachers | `/school/teachers` | ✅ CRUD + detail + assignments |
| Payroll | `/school/payroll` | ✅ Per-assignment rates |

### Teacher Interface
- Attendance sheet (`/teacher/attendance`) — tap-based PRESENT/ABSENT/LATE/EXCUSED
- Lesson book (`/teacher/lessons`) — title, description, homework, status
- Grade book (`/teacher/grades`) — score entry (DRAFT → SUBMITTED)

### API Endpoints (School)

| Endpoint | Methods |
|----------|---------|
| `/api/school/academic-years` | GET, POST |
| `/api/school/terms` | GET, POST |
| `/api/school/stages` | GET, POST |
| `/api/school/levels` | GET, POST, PUT, DELETE |
| `/api/school/streams` | GET, POST, DELETE |
| `/api/school/classrooms` | GET, POST, PUT, DELETE |
| `/api/school/classrooms/[id]` | GET (detail) |
| `/api/school/subjects` | GET, POST, PUT, DELETE |
| `/api/school/subject-coefficients` | GET, POST, DELETE |
| `/api/school/teachers` | GET, POST, PUT, DELETE |
| `/api/school/teachers/[id]` | GET (detail) |
| `/api/school/teacher-assignments` | GET, POST, PUT, DELETE |
| `/api/school/payroll` | GET |

### UI Components
- Button, Card, Input, Select (Radix), Modal (Radix Dialog), Badge, LoadingSpinner, LoadingPage

### Database Schema (26 models)
School, User, Teacher, Parent, Student, StudentParent, Enrollment, EducationStage, Level, Stream, AcademicYear, Term, Classroom, Subject, SubjectCoefficient, TeacherAssignment, Attendance, Lesson, Grade, Fee, Payment, TeacherAttendance, Notification, Schedule, Permission, UserPermission

### Seed Data
- 2 schools, 3 stages, 13 levels, 3 streams, 8 subjects, 24 coefficients, 4 teacher assignments, 18 students
- 15 permission definitions, 34 UserPermission records
- SCHOOL_ADMIN users → all 15 permissions
- ACCOUNTANT user → MANAGE_FEES, RECORD_PAYMENTS, VIEW_FINANCE_REPORTS
- SUPERVISOR user → VIEW_REPORTS

---

## 🔶 Partially Completed Features

| Feature | What works | What's missing |
|---------|-----------|----------------|
| Grade workflow | DRAFT entry by teacher | SUBMITTED → APPROVED → LOCKED flow |
| Lesson workflow | DRAFT entry by teacher | SUBMITTED → REVIEWED → NEEDS_CORRECTION flow |
| Teacher assignments | Create, delete, rate/hours | Edit from teacher detail page |
| Payroll | Monthly hours × rate calculation | Payment tracking (paid/unpaid), PDF export |
| Classroom detail | Students, teachers, lessons | Attendance trends, grade summaries |
| Teacher detail | Assignments, lessons, rate editing | Attendance history, grade summaries |
| Students | Seed data exists | No management page yet |
| Fees/Payments | Schema exists | No finance interface |

---

## ❌ Missing Features (Not Started)

### Permission System (Migration Step 1 ✅, Step 2 ✅)
- ✅ **Step 1** — Permission + UserPermission models created, 15 permissions seeded, `hasPermission()`/`authorize()` helpers built, session loads permissions
- ✅ **Step 2** — `useCurrentUser` exposes `permissions`/`hasPermission()`/`isStaff`, `roles.ts` updated with STAFF, login redirects STAFF→`/school`, school layout allows STAFF role
- ⬜ **Step 3** — API route guards migrated from role checks to permission checks
- ⬜ **Step 4** — Staff management UI (`/school/staff`) + permission assignment interface

### School Admin
- [ ] **Students CRUD** — add, edit, enroll in classrooms, deactivate
- [ ] **Staff CRUD** — add/edit STAFF users with permissions
- [ ] **School Settings** — name, logo, address, phone, email
- [ ] **Attendance dashboard** — today's absences by classroom, trends
- [ ] **Grade validation** — approve teacher-submitted grades
- [ ] **PDF report cards** (bulletins) — with school logo, averages, ranks
- [ ] **Student transfers** — move student between classrooms mid-year

### Teacher Interface
- [ ] **Attendance** — view/edit past records
- [ ] **Lessons** — edit submitted lessons
- [ ] **Grades** — submit for approval, view class averages
- [ ] **Dashboard** — teacher's own classes, quick stats

### Supervisor Interface
- [ ] No supervisor-specific pages exist yet

### Accountant Interface
- [ ] No finance pages exist yet

### Parent Interface
- [ ] No parent app/pages exist

### Notifications
- [ ] WhatsApp integration
- [ ] Notification queue
- [ ] Absence → parent notification pipeline

### Platform
- [ ] SUPER_ADMIN panel (school management)
- [ ] Subscription management
- [ ] Stripe/payment integration

---

## 🧹 Technical Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| `.DS_Store` files tracked in git | Low | Should be in `.gitignore` from start |
| No unit or integration tests | **High** | Zero test coverage |
| Permission system not wired to API routes | **High** | Step 1 + 2 complete, Step 3 (API guards) not started |
| Error boundaries not implemented | Medium | Crash on any page kills the whole app |
| Loading states inconsistent | Low | Some pages use LoadingPage, others inline spinners |
| No API input validation beyond required fields | Medium | Prisma validates types but no custom validation |
| Radix Select had empty value bug | Fixed | Workaround: hidden empty `<RadixSelect.Item>` |
| Soft delete not implemented | Low | DELETE actually removes rows (except teachers → status) |
| No pagination on lists | Medium | Will break with 1000+ students/teachers |
| No rate limiting on API | Medium | No protection against abuse |
| No request logging | Low | No audit trail for admin actions |
| Seed doesn't run automatically | Low | Must run `npx prisma db seed` manually |

---

## 🔒 Security Concerns

| Concern | Risk | Mitigation |
|---------|------|------------|
| No password reset flow | Medium | User must contact admin |
| Passwords hashed with bcrypt | ✅ Good | 10 rounds |
| JWT secret in `.env` | ✅ Good | Not committed |
| API unprotected without session check | ✅ Good | Every route checks `getServerSession` |
| SQLite in production | 🔴 High | Must switch to PostgreSQL before launch |
| No CSRF protection on API | Medium | NextAuth provides some but not full |
| No input sanitization | Low | School admin is trusted role |
| No audit log | Medium | Sensitive changes (delete, activation) are not logged |

---

## 📋 Recommended Next Task

**Permission Migration Step 3 — Wire permission checks into API routes**

Migrate all API route guards from role-only checks to dual checks (role + permission)
while keeping old roles as fallback:

1. Rewrite school API routes to use `authorize()` with `requiredPermission` for mutations
2. Add permission constants to grade/lesson/attendance routes
3. Keep old `allowedRoles` as fallback for backward compatibility
4. Add `STAFF` to all layout `allowedRoles` arrays
5. Test all existing flows still work for SCHOOL_ADMIN, TEACHER, ACCOUNTANT, SUPERVISOR

**Effort estimate:** ~100 lines across 13 route files  
**Dependencies:** Step 1 + 2 complete (Permission model, helpers, session, layout access)
