# ClassFlow — Grade Engine Specification

> Weighted assessment group grading engine for Mauritanian school system.
> Last updated: 2026-06-23

---

## Table of Contents

1. [Overview](#1-overview)
2. [Calculation Profiles](#2-calculation-profiles)
3. [Assessment Group Definitions](#3-assessment-group-definitions)
4. [MIDDLE_SECONDARY Profile — Full Formula](#4-middlesecondary-profile--full-formula)
5. [PRIMARY Profile](#5-primary-profile)
6. [Worked Examples](#6-worked-examples)
7. [Database Implications](#7-database-implications)
8. [API Implications](#8-api-implications)
9. [Status & Dependency Map](#9-status--dependency-map)

---

## 1. Overview

Schools in Mauritania do not calculate grades as a simple average of tests and exams.
The grading system uses **weighted assessment groups**: tests are averaged together, each exam
is treated independently, and each group carries a different weight in the final subject average.

The engine must support **calculation profiles** to accommodate different school levels
(primary vs middle/secondary) that use fundamentally different formulas.

### Key Principles

- **All grades are out of 20.** `maxScore` is always 20 for computation purposes.
- **Subject coefficients are configurable** per level/stream/academic year (already exists via `SubjectCoefficient` model). Never hardcoded.
- **Subject coefficients must never be hardcoded in the codebase.** Every coefficient value must live in the `SubjectCoefficient` table and be managed through the UI by authorized staff. No default coefficient arrays, no config files with coefficient values, no environment variables for coefficients.
- **Calculation is separate from data entry.** Teachers enter raw scores. The engine computes averages and ranks.
- **Two distinct profiles** exist: `PRIMARY` and `MIDDLE_SECONDARY`.

---

## 2. Calculation Profiles

A **CalculationProfile** determines:
- Which assessment groups exist (tests, exam 1, exam 2, etc.)
- What weight each group carries
- How the subject average formula is constructed
- How term and year averages are rolled up

### Profile Assignments

| Profile | Assigned To | Typical Levels |
|---------|-------------|----------------|
| `PRIMARY` | Primary education | Stage = "ابتدائي" (Grades 1–6) |
| `MIDDLE_SECONDARY` | Middle & secondary | Stage = "إعدادي" or "ثانوي" (Grades 7–13) |

The profile must be configurable at the **Stage** level (so a school may have both primary
and secondary stages using different calculation methods) or at the **Level** level
if a school needs finer-grained control.

### Profile Resolution Order

1. If profile is set on the `Level` → use that.
2. Else if profile is set on the `EducationStage` → use that.
3. Else → default to `MIDDLE_SECONDARY`.

---

## 3. Assessment Group Definitions

### MIDDLE_SECONDARY Groups

| Group Code | Group Name | Source | Weight | Description |
|-----------|------------|--------|--------|-------------|
| `TESTS` | Tests | Average of all TEST-type grades | 3 | Multiple quizzes/tests throughout the term |
| `EXAM_1` | Exam 1 | Single EXAM_1 grade | 1 | First exam of the term |
| `EXAM_2` | Exam 2 | Single EXAM_2 grade | 2 | Second exam (midterm equivalent) |
| `EXAM_3` | Exam 3 | Single EXAM_3 grade | 3 | Final exam of the term |

**Total weight denominator:** 3 + 1 + 2 + 3 = **9**

All values are capped at `maxScore` (default 20).

### PRIMARY Groups

To be defined by the implementing school. A sensible default:

| Group Code | Group Name | Source | Weight | Description |
|-----------|------------|--------|--------|-------------|
| `TESTS` | Tests | Average of all TEST-type grades | 2 | Continuous assessment |
| `EXAM` | Final Exam | Single EXAM grade | 1 | End-of-term exam |

**Total weight denominator:** 2 + 1 = **3**

---

## 4. MIDDLE_SECONDARY Profile — Full Formula

### Step 1: Calculate Group Scores per Student per Subject per Term

```
TestsAverage = SUM(score of all Grade records where assessmentType = "TEST"
                   AND studentId = S AND subjectId = Sub AND termId = T)
               / COUNT(assessmentType = "TEST" ...)

Exam1Score = score of Grade record where assessmentType = "EXAM_1" ... (single)
Exam2Score = score of Grade record where assessmentType = "EXAM_2" ... (single)
Exam3Score = score of Grade record where assessmentType = "EXAM_3" ... (single)
```

All individual scores capped at `maxScore` (always 20).

### Step 2: Calculate Subject Average

```
SubjectAverage =
  (TestsAverage × weight_TESTS + Exam1Score × weight_EXAM_1 +
   Exam2Score × weight_EXAM_2 + Exam3Score × weight_EXAM_3)
  / (weight_TESTS + weight_EXAM_1 + weight_EXAM_2 + weight_EXAM_3)

SubjectAverage = (TestsAverage × 3 + Exam1 × 1 + Exam2 × 2 + Exam3 × 3) / 9
```

Result is a value out of 20.

### Step 3: Apply Subject Coefficient

```
WeightedSubjectScore = SubjectAverage × SubjectCoefficient
```

`SubjectCoefficient` is fetched from `SubjectCoefficient` table for the given
`(academicYearId, levelId, streamId?, subjectId)`.

### Step 4: Calculate General Average (Per Term)

```
GeneralAverage =
  SUM(WeightedSubjectScore over all subjects)
  / SUM(SubjectCoefficient over all subjects)
```

Result is a value out of 20.

### Step 5: Calculate Year Average

```
YearAverage =
  SUM(GeneralAverage_Term1 × termWeight1 + GeneralAverage_Term2 × termWeight2 + ...)
  / SUM(termWeights)
```

Term weights default to equal weight (1 each) unless configured otherwise by the school.

### Step 6: Student Ranking

```
Rank = position of student in classroom when ordered by GeneralAverage (term)
       or YearAverage (year) in DESCENDING order.
```

Tied averages share a rank (dense ranking).

---

## 5. PRIMARY Profile

### Formula

```
TestsAverage = average of all TEST-type grades (out of 20)
ExamScore = EXAM-type grade (out of 20)

SubjectAverage = (TestsAverage × 2 + ExamScore × 1) / 3

WeightedSubjectScore = SubjectAverage × SubjectCoefficient

GeneralAverage = SUM(WeightedSubjectScore) / SUM(SubjectCoefficient)
```

Same ranking and year-rollup logic as `MIDDLE_SECONDARY`.

---

## 6. Worked Examples

### Example 1: Middle School Student — Math (Coefficient 6)

| Assessment | Type | Score /20 |
|-----------|------|-----------|
| Quiz 1 | TEST | 14 |
| Quiz 2 | TEST | 16 |
| Quiz 3 | TEST | 12 |
| Exam 1 | EXAM_1 | 15 |
| Exam 2 | EXAM_2 | 10 |
| Exam 3 | EXAM_3 | 18 |

**Step 1 — Tests Average:**
(14 + 16 + 12) / 3 = 14.0

**Step 2 — Subject Average:**
(14.0 × 3 + 15 × 1 + 10 × 2 + 18 × 3) / 9
= (42 + 15 + 20 + 54) / 9
= 131 / 9
= 14.56 / 20

**Step 3 — Weighted Score:**
14.56 × 6 (coefficient) = **87.33**

### Example 2: Same Student — Arabic (Coefficient 3)

| Assessment | Type | Score /20 |
|-----------|------|-----------|
| Dictation Test | TEST | 17 |
| Oral Test | TEST | 15 |
| Exam 1 | EXAM_1 | 16 |
| Exam 2 | EXAM_2 | 14 |
| Exam 3 | EXAM_3 | 13 |

**Step 1 — Tests Average:**
(17 + 15) / 2 = 16.0

**Step 2 — Subject Average:**
(16.0 × 3 + 16 × 1 + 14 × 2 + 13 × 3) / 9
= (48 + 16 + 28 + 39) / 9
= 131 / 9
= 14.56 / 20

**Step 3 — Weighted Score:**
14.56 × 3 (coefficient) = **43.68**

### Example 3: General Average (Multiple Subjects)

| Subject | Coeff | Avg /20 | Weighted Score |
|---------|-------|---------|----------------|
| Math | 6 | 14.56 | 87.33 |
| Arabic | 3 | 14.56 | 43.68 |
| French | 3 | 12.00 | 36.00 |
| Science | 4 | 15.50 | 62.00 |
| History | 2 | 13.00 | 26.00 |
| PE | 1 | 16.00 | 16.00 |
| **Total** | **19** | | **271.01** |

```
GeneralAverage = 271.01 / 19 = 14.26 / 20
```

### Example 4: Exam Missing — What Happens

If a student is absent for EXAM_3 and no score is entered:

- `Exam3Score` is treated as **0** (not skipped).
- The formula denominator remains 9.
- This incentivizes taking all exams; missing an exam severely impacts the grade.

Alternative policy (configurable per school):
- If `COUNT(exams with data) < minimumRequired`, mark as `INCOMPLETE` instead of calculating.

---

## 7. Database Implications

### 7.1 Current Grade Model Limitations

The existing `Grade` model uses `assessmentType` as a free string:

```prisma
model Grade {
  assessmentType  String    // Currently free-text — needs constraints
  label           String
  score           Float
  maxScore        Float     @default(20)
  ...
}
```

**Problems:**
- No constraint on valid `assessmentType` values for a given profile.
- No grouping mechanism — the engine must know which grades belong to which group.
- No uniqueness to prevent duplicate EXAM_1 entries for the same student+subject+term.

### 7.2 Required Schema Changes

#### Option A (Recommended): Add `AssessmentType` Enum + Validation

Change `Grade.assessmentType` to an enum:

```prisma
enum AssessmentType {
  TEST
  EXAM_1
  EXAM_2
  EXAM_3
  EXAM        // For PRIMARY profile
}
```

Add a unique constraint to prevent duplicate assessment types:

```prisma
@@unique([studentId, subjectId, termId, assessmentType])  // Except for TEST — allow multiple
```

**Note on TESTS:** Since multiple TEST entries are allowed, the unique constraint
above only applies to `EXAM_1`, `EXAM_2`, `EXAM_3`, `EXAM`. For `TEST`, the
constraint must be excluded or replaced with application-level validation.

A cleaner approach — composite partial constraint:
- For EXAM types: `@@unique([studentId, subjectId, termId, assessmentType])`
- For TEST types: no uniqueness — allow many.

Since Prisma does not support partial unique constraints, enforce at the API layer:
- On POST/PUT `Grade`: if `assessmentType` is an EXAM type, check no record exists
  for `(studentId, subjectId, termId, assessmentType)`.
- If it's TEST, allow duplicates (but cap or log a warning if more than allowed).

#### Option B: New `GradeAssessment` Grouping Model

Create a separate table to group grades into assessment groups:

```prisma
model AssessmentGroup {
  id              String   @id @default(cuid())
  schoolId        String
  academicYearId  String
  termId          String?
  subjectId       String
  classroomId     String
  studentId       String
  type            String   // "TESTS", "EXAM_1", "EXAM_2", "EXAM_3"
  weight          Int      @default(1)
  calculatedScore Float?

  grades          Grade[]

  @@unique([studentId, subjectId, termId, classroomId, type])
}
```

This is more flexible but adds complexity. **Not recommended for MVP.**

### 7.3 New Models Required

#### `CalculationProfile`

```prisma
model CalculationProfile {
  id        String   @id @default(cuid())
  schoolId  String
  name      String   // "PRIMARY", "MIDDLE_SECONDARY"

  // Stage-level assignment (optional — if null, stage uses school default)
  stageId   String?
  stage     EducationStage? @relation(fields: [stageId], references: [id])

  // Level-level override (optional — overrides stage assignment)
  levelId   String?
  level     Level?   @relation(fields: [levelId], references: [id])

  createdAt DateTime @default(now())

  @@unique([schoolId, levelId])  // Only one profile per level per school
  @@unique([schoolId, stageId])  // Only one profile per stage per school
  @@index([schoolId])
}
```

#### `GradeCalculation` (stores computed results)

```prisma
model GradeCalculation {
  id                  String   @id @default(cuid())
  schoolId            String
  academicYearId      String
  termId              String?
  studentId           String
  subjectId           String
  classroomId         String

  // Computation outputs
  testsAverage        Float?
  exam1Score          Float?
  exam2Score          Float?
  exam3Score          Float?
  subjectAverage      Float?   // Before coefficient
  weightedScore       Float?   // After applying coefficient
  coefficient         Float?   // Snapshot of coefficient used at calculation time

  // Metadata
  status              String   @default("DRAFT")  // DRAFT → FINAL
  calculatedAt        DateTime @default(now())

  @@unique([studentId, subjectId, termId])
  @@index([schoolId, academicYearId, termId])
}
```

Storing computed values allows:
- Fast retrieval (no recalculation on every page load)
- Audit trail (who calculated what when)
- Point-in-time accuracy (coefficients may change between terms)

#### `GeneralAverage` (per-term and yearly rollups)

```prisma
model GeneralAverage {
  id              String   @id @default(cuid())
  schoolId        String
  academicYearId  String
  termId          String?
  studentId       String
  classroomId     String

  generalAverage  Float?      // SUM(weightedScores) / SUM(coefficients)
  totalWeighted   Float?
  totalCoeffs     Float?
  rank            Int?
  studentCount    Int?
  status          String      @default("DRAFT")
  calculatedAt    DateTime    @default(now())

  @@unique([studentId, termId])
  @@index([schoolId, academicYearId, termId])
}
```

### 7.4 Coefficient Snapshot Strategy

`SubjectCoefficient` can change between academic years (and possibly between terms).
When a grade calculation is performed, the engine must **snapshot** the coefficient
into `GradeCalculation.coefficient` so historical results remain accurate even if
the coefficient is later modified.

### 7.5 Max Score Handling

All grades are stored with their actual `maxScore` (default 20). The engine
normalizes to a 20-point scale:

```
normalizedScore = (score / maxScore) × 20
```

This allows teachers to enter scores on different scales (e.g., /10 for a quiz,
/40 for a final exam) while the engine standardizes everything.

---

## 8. API Implications

### 8.1 New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET, PUT | `/api/school/calculation-profiles` | Manage profile assignment to stages/levels |
| POST | `/api/grades/calculate` | Trigger calculation for a classroom/term |
| GET | `/api/grades/calculations?classroomId=X&termId=Y` | Retrieve computed subject averages |
| GET | `/api/grades/general-averages?classroomId=X&termId=Y` | Retrieve general averages + ranks |
| GET | `/api/grades/report-card/:studentId?termId=X` | Full report card for one student |

### 8.2 Modified Endpoints

#### `POST /api/grades` (existing)

Changes:
- `assessmentType` must be validated against the profile for the student's level.
- Must reject duplicate EXAM types `(studentId, subjectId, termId, assessmentType)`.
- On grade entry → auto-invalidate any existing `GradeCalculation` for that
  `(studentId, subjectId, termId)` so recalculation is forced.

#### `GET /api/grades` (existing)

Changes:
- Add filter: `?studentId=X&subjectId=Y&termId=Z` to fetch grades by group.
- Response should include a `groups` breakdown for the teacher to see which scores
  feed into which group (Tests Average, Exam 1, etc.).

### 8.3 Triggering Calculation

Calculation can be triggered:
1. **Manually** — A user with `APPROVE_GRADES` or `MANAGE_SUBJECTS` permission clicks "Calculate Grades" on a classroom/term page.
2. **On-demand** — When a parent or staff member views a report card, if no calculation exists or it's stale, calculate on read.
3. **Event-driven** — After all teachers submit grades for a term → auto-calculate.

### 8.4 Validation Rules

| Rule | Enforcement |
|------|-------------|
| Assessments must match profile | On POST `/api/grades`: check level's profile → allowed assessment types |
| Only one EXAM_1/EXAM_2/EXAM_3 per student/subject/term | On POST `/api/grades`: query existing records |
| At least one TEST per subject/term | On POST `/api/grades/calculate`: warn but allow calculation (tests average = 0) |
| All grades must be SUBMITTED before calculation | On POST `/api/grades/calculate`: check status |
| scores must be ≤ maxScore | On POST `/api/grades`: validate |
| maxScore must be ≤ 20 (or normalized) | On POST `/api/grades`: validate |

### 8.5 Response Shape: Calculated Subject Grade

```json
{
  "studentId": "abc123",
  "subjectId": "math-001",
  "termId": "term-1",
  "coefficient": 6,
  "groups": {
    "tests": {
      "scores": [14, 16, 12],
      "average": 14.0,
      "weight": 3
    },
    "exam1": {
      "score": 15,
      "weight": 1
    },
    "exam2": {
      "score": 10,
      "weight": 2
    },
    "exam3": {
      "score": 18,
      "weight": 3
    }
  },
  "subjectAverage": 14.56,
  "weightedScore": 87.33,
  "status": "FINAL"
}
```

### 8.6 Response Shape: General Average

```json
{
  "studentId": "abc123",
  "termId": "term-1",
  "subjects": [
    { "name": "الرياضيات", "average": 14.56, "coefficient": 6, "weighted": 87.33 },
    { "name": "العربية",   "average": 14.56, "coefficient": 3, "weighted": 43.68 }
  ],
  "totalWeighted": 271.01,
  "totalCoefficients": 19,
  "generalAverage": 14.26,
  "rank": 3,
  "studentCount": 32,
  "status": "FINAL"
}
```

---

## 9. Status & Dependency Map

### Current State ❌
The current `POST /api/grades` and grade book UI only support DRAFT/SUBMITTED status.
There is no calculation engine, no assessment grouping, no profile system, and no
coefficient-based weighted formula. The `assessmentType` field is an unconstrained string.

### Dependency Graph

```
SubjectCoefficient (existing)
       │
       ▼
Grade entry with assessmentType validation ──► CalculationProfile model (NEW)
       │                                                  │
       ▼                                                  ▼
GradeCalculation model (NEW) ◄──── POST /api/grades/calculate (NEW)
       │
       ▼
GeneralAverage model (NEW) ◄──── ranking logic
       │
       ▼
Report Card API (NEW) ──► PDF Generation (Phase 5)
```

### Implementation Order

1. Add CalculationProfile model + CRUD API
2. Add AssessmentType enum + unique constraint for EXAM types
3. Add GradeCalculation model
4. Add GeneralAverage model
5. Build calculation engine (pure function, testable)
6. Wire POST /api/grades/calculate
7. Wire GET /api/grades/report-card
8. Add profile validation to POST /api/grades
9. Build UI: calculation trigger, report card viewer
10. PDF report cards (separate feature)

---

## Appendix: Coefficient Configuration Examples

| Level | Subject | Coefficient | Notes |
|-------|---------|-------------|-------|
| السنة الأولى إعدادي | الرياضيات | 6 | Highest coefficient |
| السنة الأولى إعدادي | اللغة العربية | 5 | |
| السنة الأولى إعدادي | اللغة الفرنسية | 5 | |
| السنة الأولى إعدادي | العلوم | 4 | |
| السنة الأولى إعدادي | التاريخ | 2 | |
| السنة الأولى إعدادي | التربية البدنية | 1 | |
| السنة الثالثة إعدادي | الرياضيات | 6 | |
| السنة الثالثة إعدادي | اللغة العربية | 3 | Drops from 5 → 3 |
| السنة الثالثة إعدادي | اللغة الفرنسية | 3 | Drops from 5 → 3 |

All coefficients are stored in `SubjectCoefficient` and configurable via the
existing subject coefficients UI at `/school/subjects`. Access is controlled
by the `MANAGE_COEFFICIENTS` permission — any STAFF user granted this permission
(by SCHOOL_ADMIN) can manage coefficients. No hardcoded values anywhere.
