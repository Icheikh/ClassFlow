# 📊 ClassFlow — Project Status

**Last updated:** 2026-06-24 (Session 5)  
**Build:** ⏳ Pending (`tsc --noEmit`)  
**Database:** SQLite (local), 26 models  
**Commits:** 11 on `main`

---

## ✅ Completed Features

### Authentication & Authorization
- NextAuth with JWT strategy
- 7 roles: SUPER_ADMIN, SCHOOL_ADMIN, STAFF, ACCOUNTANT, SUPERVISOR, TEACHER, PARENT
- 15 fine-grained permissions (Permission + UserPermission models)
- Session includes `permissions[]` from DB
- `hasPermission()`, `hasAnyPermission()`, `authorize()` helpers available
- Login with role-based redirect
- Middleware protects all school/teacher/finance/admin/parent routes

### Multi-Tenant Isolation
- Every query filtered by `schoolId`
- **NEW: All 14 PUT/DELETE endpoints now verify record ownership with schoolId check**
- Seed includes 2 schools (النور, الفتح)

### School Admin — Pages

| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/school` | ✅ Stats + quick links (fixed broken links) |
| Academic Years & Terms | `/school/academic-years` | ✅ CRUD + activate |
| Levels, Stages, Streams | `/school/levels` | ✅ CRUD |
| Classrooms | `/school/classrooms` | ✅ CRUD + detail page |
| Subjects & Coefficients | `/school/subjects` | ✅ CRUD + per-level/stream |
| Teachers | `/school/teachers` | ✅ CRUD + detail + assignments |
| Students | `/school/students` | ✅ CRUD + search + filters + bulk import |
| Student Detail | `/school/students/[id]` | ✅ Full profile + enrollments + parents |
| Payroll | `/school/payroll` | ✅ Per-assignment, month picker, attendance-filtered |
| Staff & Permissions | `/school/staff` | ✅ CRUD + permission grid + presets |
| **Settings (NEW)** | `/school/settings` | ✅ Basic school info edit (name, phone, email, address) |

### Teacher Interface

| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/teacher` | ✅ Today's classes, check-in/out, quick stats |
| Attendance | `/teacher/attendance` | ✅ Date picker + mark all present + tap to cycle + notifies |
| Lessons | `/teacher/lessons` | ✅ Edit + Delete, title/description/homework/duration |
| Grades | `/teacher/grades` | ✅ Delete assessments, scores grouped, per-student |
| Teacher Roster | `/teacher/roster` | ✅ Supervisor: daily grid, bulk mark, filters |

### Student Management
- Full CRUD API: list (search/pagination/classroom filter/status filter), create, update, detail
- Student creation includes parent/guardian (auto-creates PARENT User + Parent + StudentParent in transaction)
- Bulk import from Excel (tab-separated paste)
- Student detail: personal info, active enrollment with classroom link, parent info, quick stats, enrollment history

### Teacher Attendance & Payroll
- Teacher check-in/out (self, optional — not used for payroll)
- **Supervisor attendance grid**: `/teacher/roster` — all teachers, bulk/individual mark PRESENT/ABSENT/LATE/EXCUSED, date picker
- **Payroll engine**: sums lesson durations × hourlyRate, filtered to PRESENT-confirmed days only
- Month picker on payroll page, shows difference between total vs counted lessons

### Error Boundaries
- `/school/error.tsx` and `/teacher/error.tsx` — prevent white screen crashes

### RTL Fixes
- All back-button icons use `ArrowLeft` instead of `ArrowRight` (5 pages)

### Bug Fixes (Session 4)
- Fixed 3 critical `onChange` bugs (Event vs value) in AttendanceSheet/LessonBook/GradeBook
- Fixed empty password overwriting teacher accounts on edit
- Fixed `hasPermission()` blocking SUPER_ADMIN
- Fixed payroll calculation when `hourlyRate = 0`
- Fixed missing `parentEmail` in student detail edit form
- Fixed dead nav links (coefficients, assignments → redirect to existing pages)

### API Endpoints

| Endpoint | Methods | Permission Guard |
|----------|---------|------------------|
| `/api/school/academic-years` | GET, POST, PUT | Mutations: MANAGE_ACADEMIC_YEARS + schoolId |
| `/api/school/terms` | GET, POST, PUT, DELETE | All: MANAGE_ACADEMIC_YEARS + schoolId |
| `/api/school/stages` | GET, POST, PUT | Mutations: MANAGE_ACADEMIC_YEARS + schoolId |
| `/api/school/levels` | GET, POST, PUT, DELETE | Mutations: MANAGE_CLASSROOMS + schoolId |
| `/api/school/streams` | GET, POST, DELETE | Mutations: MANAGE_CLASSROOMS + schoolId |
| `/api/school/classrooms` | GET, POST, PUT, DELETE | Mutations: MANAGE_CLASSROOMS + schoolId |
| `/api/school/classrooms/[id]` | GET (detail) | Open (schoolId only) |
| `/api/school/subjects` | GET, POST, PUT, DELETE | Mutations: MANAGE_SUBJECTS + schoolId |
| `/api/school/subject-coefficients` | GET, POST, DELETE | Mutations: MANAGE_COEFFICIENTS + schoolId |
| `/api/school/teachers` | GET, POST, PUT, DELETE | Mutations: MANAGE_TEACHERS + schoolId |
| `/api/school/teachers/[id]` | GET (detail) | Open (schoolId only) |
| `/api/school/teacher-assignments` | GET, POST, PUT, DELETE | Mutations: MANAGE_TEACHERS + schoolId |
| `/api/school/students` | GET, POST | Mutations: MANAGE_STUDENTS |
| `/api/school/students/[id]` | GET, PUT | Mutations: MANAGE_STUDENTS |
| `/api/school/enrollments` | GET, POST, DELETE | Mutations: MANAGE_STUDENTS |
| `/api/school/payroll` | GET | VIEW_REPORTS |
| `/api/school/settings` | PUT | SCHOOL_ADMIN |
| `/api/lessons` | PUT, DELETE | TEACHER/legacy + schoolId |
| `/api/grades` | DELETE | TEACHER/legacy + schoolId |
| `/api/school/staff` | GET, POST, PUT | SCHOOL_ADMIN role only |
| `/api/school/staff/[id]/permissions` | GET, PUT | SCHOOL_ADMIN role only |
| `/api/attendance` | GET, POST | POST: TEACHER/legacy/REVIEW_LESSONS/MANAGE_STUDENTS |
| `/api/lessons` | GET, POST | POST: TEACHER/legacy/REVIEW_LESSONS (duration added) |
| `/api/grades` | GET, POST | POST: TEACHER/legacy/APPROVE_GRADES (termId auto-resolved) |
| `/api/teacher/classes` | GET | TEACHER/legacy/VIEW_REPORTS/REVIEW_LESSONS/MANAGE_TEACHERS |
| `/api/teacher-attendance` | GET, POST | All: schoolId, POST: mark/bulk-mark/checkin/checkout |
| `/api/dashboard/stats` | GET | Legacy/VIEW_REPORTS |
| `/api/students` | GET | Authenticated, school-scoped (by classroomId) |

### Database Schema (26 models)
School, User, Teacher, Parent, Student, StudentParent, Enrollment, EducationStage, Level, Stream, AcademicYear, Term, Classroom, Subject, SubjectCoefficient, TeacherAssignment, Attendance, Lesson, Grade, Fee, Payment, TeacherAttendance, Notification, Schedule, Permission, UserPermission

### Seed Data
- 2 schools (النور: 20 classrooms, 200 students; الفتح: 1 classroom, 3 students)
- 2 stages (إعدادي + ثانوي), 7 levels (1AS→4AS, 5→7), 8 subjects
- Teacher assignments with hourly rates (Arabic 250, Math 300, French 250 MRU/hr)
- 15 permission definitions, full accounts for all roles

---

## 🔶 Partially Completed Features

| Feature | What works | What's missing |
|---------|-----------|----------------|
| Grade workflow | DRAFT entry by teacher | SUBMITTED → APPROVED → LOCKED flow |
| Lesson workflow | DRAFT entry by teacher with duration | SUBMITTED → REVIEWED → NEEDS_CORRECTION flow |
| Payroll | Monthly hours × rate, attendance-filtered | Payment tracking (paid/unpaid), PDF export |
| Classroom detail | Students, teachers, lessons | Attendance trends, grade summaries |
| Teacher detail | Assignments, lessons, rate editing | Attendance history, grade summaries |
| Fees/Payments | Schema exists | No finance interface |

---

## ❌ Missing Features (Not Started)

### Finance
- [ ] **Fee management** — CRUD for fee types
- [ ] **Payment recording** — record payments per student
- [ ] **Receipts** — printing
- [ ] **Arrears tracking**
- [ ] **Financial reports**

### School Admin
- [x] **School Settings** — ✅ Done (basic: name, phone, email, address)
- [ ] **Attendance dashboard** — today's absences by classroom, trends
- [ ] **Grade validation** — approve teacher-submitted grades
- [ ] **PDF report cards** (bulletins) — with school logo, averages, ranks
- [ ] **Student transfers** — move student between classrooms mid-year

### Supervisor Interface
- [ ] Lesson review/approval workflow

### Parent Interface
- [ ] No parent app/pages exist (`/parent`)

### Accountant Interface
- [ ] No finance pages exist (`/finance`)

### Notifications
- [ ] WhatsApp integration
- [ ] Notification queue
- [ ] Absence → parent notification pipeline (DB layer done)

### Platform
- [ ] SUPER_ADMIN panel (`/admin`)
- [ ] Subscription management
- [ ] Stripe/payment integration

---

## 🧹 Technical Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| No unit or integration tests | **High** | Zero test coverage |
| Error boundaries not implemented | Medium | Crash on any page kills the whole app |
| No pagination on lists | Medium | Will break with 1000+ items |
| No rate limiting on API | Medium | No protection against abuse |
| No audit log | Medium | Sensitive changes not logged |
| Soft delete not implemented | Low | DELETE removes rows (except teachers/students → toggle) |
| Permission system has SUPERVISOR/ACCOUNTANT fallback | Low | Phase E cleanup |

---

## 📋 Recommended Next Task

**Phase 3 — Enrich Seed Data:**
1. Add Terms for school 2 (الفتح)
2. Add demo lessons, grades, attendance records
3. Add extra teachers + 7th grade assignments
4. Add sample fees and payments
5. Link all students to parents

Accounts: `admin@alnoor.edu` / `teacher@alnoor.edu` / `supervisor@alnoor.edu` — all password `password123`
