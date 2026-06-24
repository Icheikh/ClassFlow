# Permission Migration Plan

> Transitioning from role-only authorization to roles + fine-grained permissions.
> Last updated: 2026-06-23

---

## Table of Contents

1. [Current Role-Based Checks in the Codebase](#1-current-role-based-checks-in-the-codebase)
2. [Conflicts with the New Model](#2-conflicts-with-the-new-model)
3. [Proposed Database Changes](#3-proposed-database-changes)
4. [Proposed Helper Functions](#4-proposed-helper-functions)
5. [Migration Strategy](#5-migration-strategy)
6. [What Stays Role-Based](#6-what-stays-role-based)
7. [What Becomes Permission-Based](#7-what-becomes-permission-based)
8. [Step-by-Step Implementation Plan](#8-step-by-step-implementation-plan)
9. [Risks](#9-risks)
10. [Acceptance Criteria](#10-acceptance-criteria)

---

## 1. Current Role-Based Checks in the Codebase

### 1.1 Role Definitions — `src/lib/roles.ts`

```
SUPER_ADMIN  SCHOOL_ADMIN  ACCOUNTANT  SUPERVISOR  TEACHER  PARENT
```

Three exports:
- `roleLabels` — Arabic display names (used in layouts, dashboard)
- `roleTranslations` — French display names
- `roleRoutes` — post-login redirect destinations

**No STAFF role exists.** ACCOUNTANT and SUPERVISOR exist as top-level roles.

### 1.2 JWT & Session — `src/lib/auth.ts`

The `jwt` callback attaches a single `role` string to the token. The `session` callback
passes it through to `session.user.role`. No permissions array is loaded or attached.

### 1.3 Middleware — `src/middleware.ts`

NextAuth's built-in middleware protects URL prefixes by requiring a valid session.
There is **no role filtering at the middleware level** — any authenticated user can
hit any protected path (they will be caught at the layout level instead).

### 1.4 Layout-Level Guards

| File | Allowed Roles | Effect |
|------|---------------|--------|
| `src/app/school/layout.tsx` | `SCHOOL_ADMIN`, `SUPERVISOR` | Blocks TEACHER, PARENT, ACCOUNTANT, STAFF (if existed) |
| `src/app/teacher/layout.tsx` | `TEACHER`, `SCHOOL_ADMIN`, `SUPERVISOR` | Allows non-teachers to view; shows "Dashboard" link for non-TEACHER |

### 1.5 API Route Guards — Three Patterns

**Pattern A — `allowedRoles` array (4 routes):**

| Route | Allowed Roles | Note |
|-------|---------------|------|
| `/api/attendance` | TEACHER, SCHOOL_ADMIN, SUPERVISOR | TEACHER branch uses `teacherId` from session; non-TEACHER branch resolves from assignment |
| `/api/lessons` | TEACHER, SCHOOL_ADMIN, SUPERVISOR | Same TEACHER/non-TEACHER fork |
| `/api/grades` | TEACHER, SCHOOL_ADMIN, SUPERVISOR | Same TEACHER/non-TEACHER fork |
| `/api/teacher/classes` | TEACHER, SCHOOL_ADMIN, SUPERVISOR | TEACHER → filtered by teacherId; non-TEACHER → all school |
| `/api/school/terms` | SCHOOL_ADMIN, SUPERVISOR | Named `adminRoles` instead of `allowedRoles` |

**Pattern B — schoolId check only (9 routes):**

| Route | Guard | Operations |
|-------|-------|------------|
| `/api/school/teachers` | `!user?.schoolId` | GET, POST, PUT, DELETE |
| `/api/school/subjects` | `!user?.schoolId` | GET, POST, PUT, DELETE |
| `/api/school/subject-coefficients` | `!user?.schoolId` | GET, POST, DELETE |
| `/api/school/levels` | `!user?.schoolId` | GET, POST, PUT, DELETE |
| `/api/school/stages` | `!user?.schoolId` | GET, POST |
| `/api/school/streams` | `!user?.schoolId` | GET, POST, DELETE |
| `/api/school/academic-years` | `!user?.schoolId` | GET, POST |
| `/api/school/classrooms` | `!user?.schoolId` | GET, POST, PUT, DELETE |
| `/api/school/payroll` | `!user?.schoolId` | GET |
| `/api/school/teacher-assignments` | `!user?.schoolId` | GET, POST, PUT, DELETE |

**Pattern C — mixed / minimal (1 route):**

| Route | Guard | Notes |
|-------|-------|-------|
| `/api/dashboard/stats` | `!user?.schoolId` | Returns school stats — no role filter at all |

### 1.6 Hook — `src/hooks/useCurrentUser.ts`

Exports six boolean flags derived from `user.role`:
- `isTeacher` (TEACHER), `isAdmin` (SCHOOL_ADMIN), `isSuperAdmin` (SUPER_ADMIN)
- `isSupervisor` (SUPERVISOR), `isAccountant` (ACCOUNTANT), `isParent` (PARENT)

No permissions array, no `hasPermission()` method. Currently used only in UI components
(not yet referenced in page files, but available for future use).

### 1.7 Login Redirect — `src/app/auth/login/page.tsx`

Hardcoded `roleRoutes` map for post-login redirect:
```
SCHOOL_ADMIN → /school    TEACHER → /teacher    ACCOUNTANT → /finance
SUPERVISOR   → /supervision   SUPER_ADMIN → /admin    PARENT → /parent
```

**No STAFF entry** — a STAFF user would fall through to the `|| "/teacher"` default.

---

## 2. Conflicts with the New Model

| Conflict | Where | Impact |
|----------|-------|--------|
| **STAFF base role does not exist** | `roles.ts`, `auth.ts`, `middleware`, all layouts | Cannot create non-teaching staff accounts (accountant, director of studies, etc.) |
| **ACCOUNTANT and SUPERVISOR are base roles, not STAFF+permissions** | `roles.ts`, `useCurrentUser.ts`, login page | The new model removes these as base roles. Existing DB rows with `role: "ACCOUNTANT"` or `role: "SUPERVISOR"` are orphaned. |
| **School layout blocks STAFF** | `school/layout.tsx` line 13 | `allowedRoles = ["SCHOOL_ADMIN", "SUPERVISOR"]` — new model's STAFF users cannot access `/school/*` at all |
| **Write endpoints have no permission check** | 9 school API routes (Pattern B) | Any authenticated user with a `schoolId` can create/edit/delete teachers, subjects, coefficients, classrooms. New model requires `MANAGE_TEACHERS`, `MANAGE_SUBJECTS`, etc. |
| **Attendance/Lessons/Grades allow SUPERVISOR by role name** | 4 API routes (Pattern A) | Under new model, `"SUPERVISOR"` is no longer a valid role. Must check `REVIEW_LESSONS` or `APPROVE_GRADES` instead. |
| **No permissions in session/token** | `auth.ts` | `session.user` has `.role` but no `.permissions`. Every page and API would need to re-query the DB to check permissions. |
| **`useCurrentUser.ts` is role-boolean only** | Hook file | UI cannot conditionally render based on permissions (e.g., hide "Manage Coefficients" button for a Director of Studies who lacks `MANAGE_USERS`). |
| **Login redirect has no STAFF route** | `auth/login/page.tsx` | STAFF users would be incorrectly redirected to `/teacher`. |
| **`roleRoutes` in `roles.ts` has no STAFF** | `roles.ts` line 19-25 | Same redirect problem. |
| **Teacher routes allow SUPERVISOR by name** | `teacher/layout.tsx` line 18 | `allowedRoles = ["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR"]` — `"SUPERVISOR"` is not a valid role in the new model. Should check for `REVIEW_LESSONS` or similar. |
| **No audit trail for permission changes** | Entire codebase | When SCHOOL_ADMIN grants/revokes permissions, there is no log. Sensitive operation. |
| **`role: "TEACHER"` hardcoded in teacher creation** | `api/school/teachers/route.ts` line 40 | Teacher accounts are created with `role: "TEACHER"` — this is fine and should stay role-based. |
| **DIRECTOR role referenced in master spec but absent from code** | `PLAN.md`, `CLASSFLOW_MASTER_SPEC.md` | No `DIRECTOR` role in any route, layout, or API. Must be created as STAFF with permissions. |

---

## 3. Proposed Database Changes

### 3.1 New Permission Model

```prisma
enum BaseRole {
  SUPER_ADMIN
  SCHOOL_ADMIN
  STAFF
  TEACHER
  PARENT
}

model User {
  // Replace String role with BaseRole enum
  role          BaseRole  @default(TEACHER)
  // Add permissions relation
  permissions   UserPermission[]
}

model UserPermission {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  permission    String   // "MANAGE_STUDENTS", "MANAGE_COEFFICIENTS", etc.
  grantedBy     String   // userId who granted this permission
  createdAt     DateTime @default(now())

  @@unique([userId, permission])
  @@index([userId])
}
```

### 3.2 Migration Script Steps

1. Add `BaseRole` enum to schema.
2. Rename `User.role` from `String` to `BaseRole` enum.
3. Map existing data:
   - `"SUPER_ADMIN"` → `SUPER_ADMIN`
   - `"SCHOOL_ADMIN"` → `SCHOOL_ADMIN`
   - `"TEACHER"` → `TEACHER`
   - `"PARENT"` → `PARENT`
   - `"ACCOUNTANT"` → `STAFF` + insert `UserPermission` rows for `MANAGE_FEES`, `RECORD_PAYMENTS`, `VIEW_FINANCE_REPORTS`
   - `"SUPERVISOR"` → `STAFF` + insert `UserPermission` rows for `VIEW_REPORTS`
   - `"DIRECTOR"` → `STAFF` + insert appropriate permissions (no DB rows to migrate, document as future)
4. Add `UserPermission` model.
5. Run `prisma migrate`.

### 3.3 Seed Data Updates

- Remove ACCOUNTANT, SUPERVISOR seed users.
- Add STAFF seed users with explicit `UserPermission` rows.
- Ensure SCHOOL_ADMIN seed user gets all permissions (implicitly or explicitly).

---

## 4. Proposed Helper Functions

### 4.1 Server-Side — `src/lib/permissions.ts`

```typescript
// Check if a user has a specific permission
export function hasPermission(user: SessionUser, permission: string): boolean

// Check if a user has any of the given permissions
export function hasAnyPermission(user: SessionUser, permissions: string[]): boolean

// Check if a user has all of the given permissions
export function hasAllPermissions(user: SessionUser, permissions: string[]): boolean

// For TEACHER scope checks — is the user allowed to act on this class/subject?
export function canAccessClassroom(user: SessionUser, classroomId: string): boolean
export function canAccessSubject(user: SessionUser, subjectId: string): boolean
```

Implementation note: `SessionUser` will carry both `.role` (BaseRole) and
`.permissions` (string[]) from the JWT token. The functions check:

1. If `user.role === "SUPER_ADMIN"` → return true (platform-wide, no school context).
2. If `user.role === "SCHOOL_ADMIN"` → return true (all permissions within school).
3. Else check `user.permissions.includes(permission)`.

### 4.2 Client-Side — `src/hooks/useCurrentUser.ts` (extended)

```typescript
export function useCurrentUser() {
  // ...existing fields...
  return {
    // ...existing...
    isStaff: user?.role === "STAFF",
    permissions: user?.permissions ?? [],
    hasPermission: (perm: string) => user?.role === "SCHOOL_ADMIN" || user?.permissions?.includes(perm),
    hasAnyPermission: (perms: string[]) => user?.role === "SCHOOL_ADMIN" || perms.some(p => user?.permissions?.includes(p)),
  }
}
```

### 4.3 API Route Guard — `src/lib/api-guard.ts`

```typescript
// Unified guard for all API routes
export async function authorize(
  session: Session | null,
  options: {
    requiredRole?: BaseRole           // SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, etc.
    requiredPermission?: string       // "MANAGE_STUDENTS", etc.
    schoolIdRequired?: boolean        // true for all school-scoped routes
  }
): Promise<{ authorized: true; user: SessionUser } | { authorized: false; response: NextResponse }>
```

This replaces the ad-hoc `allowedRoles.includes()` and `!user?.schoolId` patterns
with a single, consistent function.

Usage:
```typescript
// Before: Pattern A
const allowedRoles = ["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR"]
if (!allowedRoles.includes(user?.role)) return 401

// After: Pattern A becomes:
const auth = await authorize(session, {
  requiredRole: "TEACHER",       // Base role for entry
  requiredPermission: "REVIEW_LESSONS",  // Or alternative
  schoolIdRequired: true,
})

// Before: Pattern B
if (!user?.schoolId) return 401

// After: Pattern B becomes:
const auth = await authorize(session, {
  schoolIdRequired: true,
})
// Then for write operations, check permission:
if (req.method !== "GET" && !auth.user.permissions.includes("MANAGE_TEACHERS")) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

### 4.4 Middleware — `src/middleware.ts` (extended)

The current middleware only checks authentication. To add route-level role gating:

```typescript
// Concept (not implementation):
// /school/* → requires SCHOOL_ADMIN or STAFF base role
// /teacher/* → requires TEACHER base role (or STAFF with REVIEW_LESSONS)
// /admin/*  → requires SUPER_ADMIN base role
// /parent/* → requires PARENT base role
// /finance/* → requires STAFF with MANAGE_FEES or VIEW_FINANCE_REPORTS
// /supervision/* → requires STAFF with VIEW_REPORTS
```

However, the middleware only has access to the JWT token (not the full session),
so role-based routing is feasible but permission-based routing is limited.
Recommend keeping middleware as auth-only and letting layouts handle role/permission gating.

---

## 5. Migration Strategy

### Principle: Dual-Running (Backward Compatible)

The migration must not break existing users. Strategy:

1. **Phase A — Schema + Auth** (non-breaking):
   - Add `BaseRole` enum and `UserPermission` model.
   - Add `permissions` string[] to JWT token and session.
   - Keep old role strings working via a migration script.
   - All existing users continue to work unchanged.

2. **Phase B — Helpers** (non-breaking):
   - Add `authorize()` function, `hasPermission()`, `useCurrentUser().hasPermission`.
   - These functions are backward compatible: they check role first, then permissions.

3. **Phase C — Gradual Route Migration** (non-breaking per route):
   - For each API route, swap `allowedRoles.includes()` → `authorize()`.
   - During this phase, routes accept BOTH old roles AND new permissions.
   - Example: `/api/attendance` accepts `TEACHER` (old) OR `hasPermission("REVIEW_LESSONS")` (new).

4. **Phase D — UI Migration** (non-breaking):
   - Update `school/layout.tsx` to allow STAFF role.
   - Add permission-based UI visibility (hide buttons, menu items).

5. **Phase E — Role Deprecation** (breaking):
   - After all routes are migrated, remove `ACCOUNTANT`, `SUPERVISOR` from `allowedRoles` arrays.
   - Drop migration for old role strings → update seed data.
   - Mark old role checks with deprecation warnings.

### Rollback Plan

- Each Phase C commit keeps the old `allowedRoles` check as a fallback.
- If a permission check fails, the old role check catches it —
  no legitimate user is ever locked out.
- Remove the fallback only after monitoring shows zero hits on the old path.

---

## 6. What Stays Role-Based

Some decisions are inherently tied to the base role and should NOT become permission-based:

| Decision | Reason |
|----------|--------|
| **Which layout to render** (`/school/*` vs `/teacher/*` vs `/parent/*`) | TEACHer gets teacher UI, PARENT gets parent UI. A STAFF user with `APPROVE_GRADES` still needs the school layout, not the teacher layout. |
| **Post-login redirect** | Route is determined by base role, not permissions. A STAFF user goes to `/school`, a TEACHER to `/teacher`. |
| **Scope isolation** (TEACHER → own classes only) | TEACHER scope is identity-based (userId → teacherId → assignments), not permission-based. |
| **Scope isolation** (PARENT → own children only) | PARENT scope is identity-based (userId → parentId → StudentParent), not permission-based. |
| **SUPER_ADMAN platform access** | SUPER_ADMIN has no `schoolId` and uses `/admin` routes. This is role-gated, not permission-gated. |
| **Teacher creation** (`role: "TEACHER"` hardcoded in `api/school/teachers/route.ts`) | When creating a teacher, the role must be TEACHER. This is correct and should stay. |
| **Permission self-service** (cannot grant yourself permissions) | A user cannot grant permissions to themselves. This is enforced by the SCHOOL_ADMIN role check, not a permission. |

---

## 7. What Becomes Permission-Based

| Current Code | Current Check | New Check |
|-------------|---------------|-----------|
| `api/school/teachers` POST/PUT/DELETE | `!user?.schoolId` | `hasPermission("MANAGE_TEACHERS")` |
| `api/school/stages` POST | `!user?.schoolId` | `hasPermission("MANAGE_ACADEMIC_YEARS")` |
| `api/school/levels` POST/PUT/DELETE | `!user?.schoolId` | `hasPermission("MANAGE_CLASSROOMS")` |
| `api/school/streams` POST/DELETE | `!user?.schoolId` | `hasPermission("MANAGE_CLASSROOMS")` |
| `api/school/academic-years` POST | `!user?.schoolId` | `hasPermission("MANAGE_ACADEMIC_YEARS")` |
| `api/school/terms` POST/PUT/DELETE | `["SCHOOL_ADMIN", "SUPERVISOR"]` | `hasPermission("MANAGE_ACADEMIC_YEARS")` |
| `api/school/classrooms` POST/PUT/DELETE | `!user?.schoolId` | `hasPermission("MANAGE_CLASSROOMS")` |
| `api/school/subjects` POST/PUT/DELETE | `!user?.schoolId` | `hasPermission("MANAGE_SUBJECTS")` |
| `api/school/subject-coefficients` POST/DELETE | `!user?.schoolId` | `hasPermission("MANAGE_COEFFICIENTS")` |
| `api/school/teacher-assignments` POST/PUT/DELETE | `!user?.schoolId` | `hasPermission("MANAGE_TEACHERS")` |
| `api/school/payroll` GET | `!user?.schoolId` | `hasPermission("VIEW_REPORTS")` (or `MANAGE_TEACHERS`) |
| `api/attendance` POST (non-TEACHER) | `["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR"]` | `hasAnyPermission(["REVIEW_LESSONS", "MANAGE_STUDENTS"])` |
| `api/lessons` POST (non-TEACHER) | `["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR"]` | `hasPermission("REVIEW_LESSONS")` |
| `api/grades` POST (non-TEACHER) | `["TEACHER", "SCHOOL_ADMIN", "SUPERVISOR"]` | `hasPermission("APPROVE_GRADES")` |
| `api/grades/calculate` (new) | — | `hasPermission("APPROVE_GRADES")` |
| `api/finance/*` (future) | — | `MANAGE_FEES`, `RECORD_PAYMENTS`, `VIEW_FINANCE_REPORTS` |
| `school/layout.tsx` sidebar menu items | Always visible | Hide based on permissions (e.g., hide "المواد والضوارب" if no `MANAGE_SUBJECTS` or `MANAGE_COEFFICIENTS`) |
| `teacher/layout.tsx` "Dashboard" link | `user.role !== "TEACHER"` | `hasAnyPermission(["VIEW_REPORTS", ...])` |
| `/school/students` page (future) | — | `hasPermission("MANAGE_STUDENTS")` for CRUD; `VIEW_REPORTS` for read-only |

### GET (Read) Routes

A design decision: should read-only access (GET) require permissions or be open to all
school-affiliated users?

**Recommendation:** GET requests for school data should be open to any user with a
`schoolId` (SCHOOL_ADMIN, STAFF, TEACHER). Permission checks apply only to mutations
(POST, PUT, DELETE). This keeps the UI working (e.g., a teacher viewing the students
list in their classroom) while protecting write operations.

Exception: Finance GET routes should require `VIEW_FINANCE_REPORTS` since financial
data is sensitive.

---

## 8. Step-by-Step Implementation Plan

### Step 1 — Database Schema Migration (1-2 days)

1.1. Add `BaseRole` enum to `schema.prisma` with values: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `STAFF`, `TEACHER`, `PARENT`.
1.2. Add `UserPermission` model with fields: `id`, `userId`, `permission` (String), `grantedBy` (String?), `createdAt`.
1.3. Change `User.role` from `String` to `BaseRole`.
1.4. Create migration: map existing role strings to new enums, create UserPermission rows for migrated ACCOUNTANT/SUPERVISOR users.
1.5. Run `prisma migrate dev`.
1.6. Update seed data: remove ACCOUNTANT/SUPERVISOR roles, add STAFF users with explicit UserPermission rows.

### Step 2 — Auth Layer Changes (1 day)

2.1. In `src/lib/auth.ts`, load user permissions in the `jwt` callback:
    ```
    token.permissions = user.permissions.map(p => p.permission)
    ```
2.2. Pass `.permissions` through the `session` callback to `session.user.permissions`.
2.3. Update TypeScript types for `SessionUser` to include `permissions: string[]`.

### Step 3 — Helper Functions (1 day)

3.1. Create `src/lib/api-guard.ts` with the `authorize()` function.
3.2. Create `src/lib/permissions.ts` with `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()`.
3.3. Update `src/hooks/useCurrentUser.ts` to expose `permissions`, `hasPermission()`, `hasAnyPermission()`.
3.4. Add `STAFF` to `src/lib/roles.ts`:
    - `roleLabels.STAFF = "موظف"`
    - `roleTranslations.STAFF = "Personnel"`
    - `roleRoutes.STAFF = "/school"`

### Step 4 — Update Layout Guards (1 day)

4.1. `src/app/school/layout.tsx`:
    - Change `allowedRoles` to `["SCHOOL_ADMIN", "STAFF"]`.
    - Add permission-based sidebar item visibility (e.g., hide "المواد والضوارب" if user lacks both `MANAGE_SUBJECTS` and `MANAGE_COEFFICIENTS`).
4.2. `src/app/teacher/layout.tsx`:
    - Change `allowedRoles` to `["TEACHER", "SCHOOL_ADMIN", "STAFF"]`.
    - Change the "Dashboard" link visibility from `user.role !== "TEACHER"` to `hasAnyPermission(["VIEW_REPORTS", "MANAGE_STUDENTS", ...])`.
4.3. `src/app/auth/login/page.tsx`:
    - Add `STAFF: "/school"` to the `roleRoutes` map.

### Step 5 — API Route Migration (2-3 days)

For each API route, apply the following transformation:

**Pattern B routes (9 routes — schoolId-only check):**

Add `authorize()` call. Keep GET open to all school users.
Add permission check for mutations.

Example (`/api/school/teachers`):
```typescript
export async function POST(req) {
  const auth = await authorize(session, {
    requiredPermission: "MANAGE_TEACHERS",
    schoolIdRequired: true,
  })
  if (!auth.authorized) return auth.response
  // ... existing logic ...
}
```

**Pattern A routes (4 routes — allowedRoles):**

Add `authorize()` with dual check (old role OR new permission).

Example (`/api/attendance`):
```typescript
// Phase C transitional check:
const auth = await authorize(session, { schoolIdRequired: true })
if (!auth.authorized) return auth.response

// Dual check — remove "SUPERVISOR" after Phase E
const isTeacher = user.role === "TEACHER"
const hasPermission = hasAnyPermission(user, ["REVIEW_LESSONS", "MANAGE_STUDENTS"])
if (!isTeacher && !hasPermission && !allowedRoles.includes(user.role)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

**Routes to migrate (in dependency order):**

1. `/api/school/terms` — easiest, already has `adminRoles` pattern
2. `/api/school/teachers` — highest priority, write operations
3. `/api/school/subject-coefficients` — permission-sensitive (MANAGE_COEFFICIENTS)
4. `/api/school/teacher-assignments` — write operations
5. `/api/school/levels`, `/api/school/stages`, `/api/school/streams`
6. `/api/school/academic-years`
7. `/api/school/classrooms`
8. `/api/school/subjects`
9. `/api/attendance` — has TEACHER fork, more complex
10. `/api/lessons` — has TEACHER fork
11. `/api/grades` — has TEACHER fork, plus new calculate endpoint
12. `/api/school/payroll`
13. `/api/dashboard/stats` — add VIEW_REPORTS check

### Step 6 — UI Permission Visibility (2 days)

6.1. Identify all UI elements that should be permission-gated:
    - `/school/subjects` — "إضافة مادة" / "إضافة ضارب" buttons → require `MANAGE_SUBJECTS` / `MANAGE_COEFFICIENTS`
    - `/school/teachers` — "إضافة أستاذ" / "حذف" buttons → require `MANAGE_TEACHERS`
    - `/school/classrooms` — "إضافة قسم" / "حذف" buttons → require `MANAGE_CLASSROOMS`
    - `/school/academic-years` — "إضافة سنة" → require `MANAGE_ACADEMIC_YEARS`
    - `/school/levels` — CRUD buttons → require `MANAGE_CLASSROOMS` or similar
    - Sidebar items in `/school/layout.tsx` — hide management pages the user cannot use
6.2. Update each page to use `useCurrentUser().hasPermission()` before rendering action buttons.

### Step 7 — Staff Management Page (2-3 days)

7.1. Create `/api/school/staff` (GET, POST, PUT, DELETE) for STAFF user CRUD.
7.2. Create `/api/school/staff/[id]/permissions` (GET, PUT) for managing permissions.
7.3. Create `/school/staff` page with:
    - List of STAFF users with their permissions
    - Add staff modal (name, email, password, permissions checkboxes)
    - Edit permissions modal
7.4. Only SCHOOL_ADMIN can access this page (checked via role, not permission).

### Step 8 — Deprecation & Cleanup (0.5 day)

8.1. Remove `SUPERVISOR` from all `allowedRoles` arrays.
8.2. Remove `ACCOUNTANT` from all remaining references.
8.3. Remove fallback dual checks from API routes.
8.4. Remove `isSupervisor` and `isAccountant` from `useCurrentUser.ts`.
8.5. Update `roleLabels`, `roleTranslations` to remove ACCOUNTANT, SUPERVISOR.
8.6. Run a one-time script to convert any remaining old-role users.

---

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Existing ACCOUNTANT/SUPERVISOR users lose access during migration** | Medium | High | Dual-running strategy: old roles keep working during Phase C. Migration script maps old roles to STAFF+permissions atomically. |
| **Permission check added but not populated in session → false 403** | Medium | High | Default SCHOOL_ADMIN gets all permissions implicitly via `hasPermission()` check. STAFF users created during migration get explicit permission rows. Seed data updated. |
| **Third-party integrations break if they check `user.role` directly** | Low | Medium | No third-party integrations exist yet. Document the change in API contract. |
| **UI shows stale buttons for users whose permissions were revoked mid-session** | Medium | Low | Permission changes require re-login (or session refresh) to take effect. Document as expected behavior. |
| **Permission granularity leads to confusing UX for SCHOOL_ADMIN** | Low | Low | SCHOOL_ADMIN always has full access. Only STAFF users see the permission-gated UI. |
| **Race condition: two SCHOOL_ADMINs editing same STAFF permissions** | Low | Low | No locking needed at this scale. Last-write-wins is acceptable for MVP. |
| **Developer mistake: forgetting to add permission check for a new route** | Medium | Medium | The `authorize()` helper should be required by convention. Add lint rule or code review checklist. |

---

## 10. Acceptance Criteria

The migration is complete when:

1. **Database**
   - [ ] `User.role` is a `BaseRole` enum (SUPER_ADMIN, SCHOOL_ADMIN, STAFF, TEACHER, PARENT).
   - [ ] `UserPermission` table exists with `@@unique([userId, permission])`.
   - [ ] All existing ACCOUNTANT users migrated to STAFF + `MANAGE_FEES`, `RECORD_PAYMENTS`, `VIEW_FINANCE_REPORTS`.
   - [ ] All existing SUPERVISOR users migrated to STAFF + `VIEW_REPORTS`.
   - [ ] Seed data includes STAFF users with explicit permissions.

2. **Auth**
   - [ ] JWT token includes `permissions: string[]`.
   - [ ] `session.user` includes `.permissions` array.
   - [ ] Login redirect works for STAFF → `/school`.
   - [ ] Login page has STAFF in its `roleRoutes` map.

3. **Helpers**
   - [ ] `authorize()` function works in all API routes.
   - [ ] `hasPermission()` works correctly (implicit true for SCHOOL_ADMIN, check array for STAFF).
   - [ ] `useCurrentUser().hasPermission()` works client-side.

4. **Layouts**
   - [ ] `school/layout.tsx` allows `["SCHOOL_ADMIN", "STAFF"]`.
   - [ ] `teacher/layout.tsx` allows `["TEACHER", "SCHOOL_ADMIN", "STAFF"]`.
   - [ ] Sidebar menu items hide when user lacks required permissions.
   - [ ] "Dashboard" link in teacher layout shows for STAFF with `VIEW_REPORTS`.

5. **API Routes**
   - [ ] All 13 school API routes check permissions on write operations.
   - [ ] All 3 teacher API routes (attendance, lessons, grades) accept STAFF with appropriate permissions.
   - [ ] GET access remains open for school-scoped users (except finance).
   - [ ] No route still references `SUPERVISOR` or `ACCOUNTANT` by string.

6. **Staff Management**
   - [ ] SCHOOL_ADMIN can create STAFF users.
   - [ ] SCHOOL_ADMIN can grant/revoke permissions per STAFF user.
   - [ ] SCHOOL_ADMIN cannot grant permissions they don't conceptually have (this is a UX constraint, not a technical one — though there's no technical blocker).

7. **Test Coverage**
   - [ ] Unit tests for `hasPermission()` (TEACHER → false, SCHOOL_ADMIN → true, STAFF with matching permission → true, STAFF without → false).
   - [ ] Integration test: STAFF user with `MANAGE_COEFFICIENTS` can POST to `/api/school/subject-coefficients`.
   - [ ] Integration test: STAFF user without `MANAGE_COEFFICIENTS` gets 403 on same endpoint.
   - [ ] Integration test: TEACHER cannot access `/api/school/teachers` POST.
   - [ ] Integration test: Legacy `SUPERVISOR` role still works during Phase C (removed in Phase E).

8. **No Regressions**
   - [ ] All existing pages load without 403 errors for SCHOOL_ADMIN.
   - [ ] All existing pages load without 403 errors for TEACHER.
   - [ ] TEACHER can still mark attendance, create lessons, enter grades.
   - [ ] PARENT pages (future) still scope to own children.
   - [ ] SUPER_ADMIN can still access platform admin (when built).

---

## Appendix: Before/After Comparison

### Before Migration
```
User.role = "ACCOUNTANT"
  → Can access /school (via SUPERVISOR in allowedRoles — coincidental)
  → Can POST to any school endpoint (via schoolId-only check)
  → Cannot be created as "STAFF" — role name doesn't exist
  → Login redirects to /finance (which has no layout)
```

### After Migration
```
User.role = STAFF
User.permissions = ["MANAGE_FEES", "RECORD_PAYMENTS", "VIEW_FINANCE_REPORTS"]
  → Can access /school (layout allows STAFF)
  → Can POST to /api/finance/* (permission check passes)
  → Cannot POST to /api/school/teachers (no MANAGE_TEACHERS → 403)
  → Cannot POST to /api/school/subject-coefficients (no MANAGE_COEFFICIENTS → 403)
  → Login redirects to /school
  → Sidebar shows only finance-related items
```

### Before Migration
```
User.role = "SUPERVISOR"
  → Can access /school layout
  → Can access /teacher layout
  → Can POST attendance (allowedRoles includes SUPERVISOR)
  → Can POST grades (allowedRoles includes SUPERVISOR)
  → Can manage terms (adminRoles includes SUPERVISOR)
```

### After Migration
```
User.role = STAFF
User.permissions = ["VIEW_REPORTS"]
  → Can access /school layout (layout allows STAFF)
  → Can access /teacher layout (layout allows STAFF)
  → Can VIEW attendance records (GET open to school users)
  → Cannot POST attendance (no REVIEW_LESSONS → 403)
  → Cannot POST grades (no APPROVE_GRADES → 403)
  → Cannot manage terms (no MANAGE_ACADEMIC_YEARS → 403)
```
