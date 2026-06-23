# ClassFlow

Multi-tenant SaaS for digitizing daily school registers (attendance, lessons, grades) in Mauritanian schools.

**Target:** Mauritania (Arabic + French)  
**Stack:** Next.js 14, TypeScript, Tailwind CSS, Prisma (SQLite → PostgreSQL), NextAuth  
**Roles:** SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, SUPERVISOR, TEACHER, PARENT

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

## Docs

- `PROJECT_STATUS.md` — Full status, gap analysis, technical debt
- `docs/PLAN.md` — Technical architecture + feature list
- `docs/PRODUCT.md` — Product plan, value proposition, roadmap
