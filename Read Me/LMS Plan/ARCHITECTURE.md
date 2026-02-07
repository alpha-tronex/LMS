# LMS Architecture (Courses + Lessons + Chapters + Enrollments + Assessments)

This document defines the target architecture, phased milestones, Mongo/Mongoose schemas, and API endpoint specifications for completing the LMS.

## Goals

- Add **Courses**, **Lessons**, **Chapters**, and **Enrollments** while preserving the existing Assessment flows.
- Track learner **progress at the chapter level** (sub-lesson granularity).
- Support **three assessment scopes**:
  - Chapter checkpoint quiz (3–5 questions)
  - End-of-lesson assessment
  - End-of-course assessment
- Keep the system maintainable by separating routing, business logic, and persistence.
- Replace destructive deletes with **archiving**.
- Assume **small-scale attempts** for MVP (attempt history volume is low), while keeping an easy upgrade path.

## Non-goals (for MVP)

- Payments, certificates, SCORM/LTI, advanced analytics, multi-tenancy.
- Complex role hierarchies (beyond user/admin) unless explicitly needed.

---

## Current System Baseline

- Frontend: Angular app with admin section; assessment services already use `/api/assessment*` and `/api/assessments`.
- Backend: Node/Express server, JWT auth middleware (`verifyToken`, `verifyAdmin`).
- Persistence:
  - Users: MongoDB collection `lms_users`.
  - Assessment definitions: JSON files in `server/assessments/assessment_<id>.json` (legacy fallback from `server/quizzes` may exist during rollout).
  - Attempt history: currently stored in `lms_users.assessments[]`.

---

## Target Architecture

### Content Model (Course → Lesson → Chapter)

Treat **Lesson** and **Chapter** as first-class entities.

- A **Course** is the top-level container and enrollment boundary.
- A **Lesson** is a structured unit within a course and can have a comprehensive assessment.
- A **Chapter** is the smallest progress-tracked unit and can have a short checkpoint quiz.

Derived completion rules (MVP defaults):
- **Chapter complete** when the learner completes the chapter and (if configured) passes the chapter checkpoint.
- **Lesson complete** when all its chapters are complete and (if configured) passes the lesson assessment.
- **Course complete** when all lessons are complete and (if configured) passes the course assessment.

### Frontend (Angular)

**Modules**
- `CoreModule`
  - Auth token handling, route guards, HTTP interceptor
  - Current user state (username, role)
- `StudentModule`
  - Course catalog
  - My courses (enrolled)
  - Course detail (published assessments)
  - Assessment runner + submission
  - History / results
- `AdminModule`
  - Course management (create/edit/archive)
  - Enrollment management (rosters)
  - Assessment management (upload/edit/archive)
  - Attach/detach assessments to courses

**Service boundaries**
- `CoursesApiService`
- `EnrollmentsApiService`
- `AssessmentsApiService` (extends current assessment services)

### Backend (Express)

**Layers**
- **Routes/controllers**: request validation + auth checks + call services
- **Services**: domain logic
  - `CourseService`
  - `EnrollmentService`
  - `AssessmentService`
  - `AttemptService`
- **Persistence adapters**
  - Mongo repositories (courses, enrollments)
  - File store adapter for assessment JSON definitions

**Archiving**
- No destructive deletes for MVP.
- Admin “delete” actions become **archive** operations:
  - Courses: `status = 'archived'`
  - Enrollments: `status = 'withdrawn'`
  - Assessments: `status = 'archived'` (either stored in JSON or in Mongo mapping)

---

## Data Model

### Summary

- Mongo collections:
  - `lms_users` (existing)
  - `courses` (new)
  - `lessons` (new)
  - `chapters` (new)
  - `enrollments` (new)
  - `content_assessments` (recommended mapping; new)
  - `chapter_progress` (recommended; new)
- Disk store:
  - `server/assessments/assessment_<id>.json`

### Decision: content-assessment relationship

Use `content_assessments` as a mapping collection for flexibility and clean archiving.

- Pros: supports ordering, publish state per parent, future versioning.
- Cons: one extra collection.

---

# Mongo / Mongoose Schemas (Exact Specs)

These are concrete Mongoose schema definitions and indexes. (Field naming matches your existing backend conventions: `username`, `type`, etc.)

> Note: The repo currently defines the `User` schema inside `server/server.js`. As we expand, it’s recommended to move schemas to `server/models/*.js`, but that’s an implementation detail.

## 1) Users (`lms_users`)

Collection name: `lms_users` (already pinned)

```js
// Collection: lms_users
const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  username: { type: String, required: true, index: true },
  email: { type: String, index: true },
  password: String,
  phone: String,
  address: {
    street1: String,
    street2: String,
    street3: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },

  // Existing role field
  type: { type: String, enum: ['admin', 'user'], default: 'user', index: true },

  // New: account lifecycle
  status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },

  createdAt: Date,
  updatedAt: Date,

  // MVP attempt history (small scale)
  assessments: [
    {
      id: Number,              // assessmentId
      title: String,
      courseId: { type: mongoose.Schema.Types.ObjectId, required: false },
      completedAt: Date,
      questions: [
        {
          questionNum: Number,
          question: String,
          answers: [String],
          selection: [Number],
          correct: [Number],
          isCorrect: Boolean,
        },
      ],
      score: Number,
      totalQuestions: Number,
      duration: Number,
      createdAt: Date,
      updatedAt: Date,
    },
  ],
});

// Indexes
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: false });
```

## 2) Courses (`courses`)

Collection name: `courses`

```js
// Collection: courses
const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Optional: if you want unique titles
// courseSchema.index({ title: 1 }, { unique: true });
```

## 3) Lessons (`lessons`)

Collection name: `lessons`

```js
// Collection: lessons
const lessonSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  title: { type: String, required: true },
  description: { type: String, default: '' },
  sortOrder: { type: Number, default: 0, index: true },

  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

lessonSchema.index({ courseId: 1, status: 1, sortOrder: 1 });
```

## 4) Chapters (`chapters`)

Collection name: `chapters`

```js
// Collection: chapters
const chapterSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  title: { type: String, required: true },
  sortOrder: { type: Number, default: 0, index: true },

  // MVP: keep content flexible (HTML/Markdown/reference)
  content: { type: mongoose.Schema.Types.Mixed, default: {} },

  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

chapterSchema.index({ lessonId: 1, status: 1, sortOrder: 1 });
chapterSchema.index({ courseId: 1, lessonId: 1, status: 1, sortOrder: 1 });
```

## 5) Enrollments (`enrollments`)

Collection name: `enrollments`

```js
// Collection: enrollments
const enrollmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  status: {
    type: String,
    enum: ['enrolled', 'withdrawn'],
    default: 'enrolled',
    index: true,
  },

  enrolledAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Prevent duplicates
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Useful query index
enrollmentSchema.index({ courseId: 1, status: 1 });
```

## 6) Content ↔ Assessment mapping (`content_assessments`)

Collection name: `content_assessments`

```js
// Collection: content_assessments
const contentAssessmentSchema = new mongoose.Schema({
  // What this assessment is attached to
  scope: { type: String, enum: ['course', 'lesson', 'chapter'], required: true, index: true },

  // Parent pointers (only one is required by scope, but storing all relevant IDs simplifies queries)
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true },

  assessmentId: { type: Number, required: true, index: true },

  // Controls visibility within this course
  status: {
    type: String,
    enum: ['published', 'archived'],
    default: 'published',
    index: true,
  },

  // Optional ordering within a course
  sortOrder: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Uniqueness per parent + assessment
contentAssessmentSchema.index(
  { scope: 1, courseId: 1, lessonId: 1, chapterId: 1, assessmentId: 1 },
  { unique: true }
);
contentAssessmentSchema.index({ courseId: 1, scope: 1, status: 1, sortOrder: 1 });
```

## 7) Chapter progress (`chapter_progress`)

Collection name: `chapter_progress`

This stores chapter-level progress (sub-lesson granularity). Lesson/course progress can be derived.

```js
// Collection: chapter_progress
const chapterProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started',
    index: true,
  },

  startedAt: { type: Date, required: false },
  completedAt: { type: Date, required: false },
  lastAccessedAt: { type: Date, required: false },

  updatedAt: { type: Date, default: Date.now },
});

chapterProgressSchema.index({ userId: 1, chapterId: 1 }, { unique: true });
chapterProgressSchema.index({ userId: 1, courseId: 1, status: 1 });
```

---

# API Endpoint Specifications

Conventions:
- All endpoints are JSON.
- Auth uses `Authorization: Bearer <JWT>`.
- **Admin-only** endpoints require `verifyToken` + `verifyAdmin`.
- All “delete” actions become `archive` endpoints.

## Authentication

### POST `/api/login`
- Auth: none
- Body:
  - `{ "uname": string, "pass": string }`
- 200 Response:
  - `{ "token": string, "id": string, "uname": string, "type": "admin"|"user" }`

(Existing behavior; keep as-is.)

---

## Courses (Student)

### GET `/api/courses`
- Auth: `verifyToken`
- Returns active courses.
- 200 Response:
  - `[{ "id": string, "title": string, "description": string }]`

### GET `/api/my/courses`
- Auth: `verifyToken`
- Returns courses where the current user has an active enrollment (`enrolled`).
- 200 Response:
  - `[{ "id": string, "title": string, "description": string, "enrolledAt": string }]`

### GET `/api/courses/:courseId`
- Auth: `verifyToken`
- Returns course details.
- 200 Response:
  - `{ "id": string, "title": string, "description": string }`

### GET `/api/courses/:courseId/content`
- Auth: `verifyToken`
- Returns ordered lessons + chapters for a course, plus any published assessments attached at each scope.
- 200 Response (shape sketch):
  - `{
      "courseId": string,
      "lessons": [
        {
          "lessonId": string,
          "title": string,
          "sortOrder": number,
          "lessonAssessments": [{"id": number, "title": string}],
          "chapters": [
            {
              "chapterId": string,
              "title": string,
              "sortOrder": number,
              "chapterAssessments": [{"id": number, "title": string}]
            }
          ]
        }
      ],
      "courseAssessments": [{"id": number, "title": string}]
    }`

### GET `/api/courses/:courseId/progress`
- Auth: `verifyToken`
- Returns chapter-level progress for the current user.
- 200 Response:
  - `[{ "chapterId": string, "status": "not_started"|"in_progress"|"completed", "updatedAt": string }]`

### POST `/api/courses/:courseId/enroll`
- Auth: `verifyToken`
- Enroll the current user.
- 200 Response:
  - `{ "message": "Enrolled", "courseId": string }`

### POST `/api/courses/:courseId/withdraw`
- Auth: `verifyToken`
- Withdraw the current user (sets enrollment `status='withdrawn'`).
- 200 Response:
  - `{ "message": "Withdrawn", "courseId": string }`

---

## Courses (Admin)

### POST `/api/admin/courses`
- Auth: `verifyToken`, `verifyAdmin`
- Body:
  - `{ "title": string, "description"?: string }`
- 201 Response:
  - `{ "id": string, "title": string, "description": string, "status": "active" }`

### PUT `/api/admin/courses/:courseId`
- Auth: `verifyToken`, `verifyAdmin`
- Body:
  - `{ "title"?: string, "description"?: string }`
- 200 Response:
  - `{ "id": string, "title": string, "description": string, "status": "active"|"archived" }`

### POST `/api/admin/courses/:courseId/archive`
- Auth: `verifyToken`, `verifyAdmin`
- 200 Response:
  - `{ "message": "Archived", "courseId": string }`

### GET `/api/admin/courses`
- Auth: `verifyToken`, `verifyAdmin`
- Includes archived courses.
- 200 Response:
  - `[{ "id": string, "title": string, "description": string, "status": "active"|"archived" }]`

---

## Lessons + Chapters (Admin)

### POST `/api/admin/courses/:courseId/lessons`
- Auth: `verifyToken`, `verifyAdmin`
- Body:
  - `{ "title": string, "description"?: string, "sortOrder"?: number }`
- 201 Response:
  - `{ "lessonId": string }`

### PUT `/api/admin/lessons/:lessonId`
- Auth: `verifyToken`, `verifyAdmin`
- Body:
  - `{ "title"?: string, "description"?: string, "sortOrder"?: number }`
- 200 Response:
  - `{ "lessonId": string }`

### POST `/api/admin/lessons/:lessonId/archive`
- Auth: `verifyToken`, `verifyAdmin`
- 200 Response:
  - `{ "message": "Archived", "lessonId": string }`

### POST `/api/admin/lessons/:lessonId/chapters`
- Auth: `verifyToken`, `verifyAdmin`
- Body:
  - `{ "title": string, "sortOrder"?: number, "content"?: object }`
- 201 Response:
  - `{ "chapterId": string }`

### PUT `/api/admin/chapters/:chapterId`
- Auth: `verifyToken`, `verifyAdmin`
- Body:
  - `{ "title"?: string, "sortOrder"?: number, "content"?: object }`
- 200 Response:
  - `{ "chapterId": string }`

### POST `/api/admin/chapters/:chapterId/archive`
- Auth: `verifyToken`, `verifyAdmin`
- 200 Response:
  - `{ "message": "Archived", "chapterId": string }`

---

## Enrollments (Admin)

### GET `/api/admin/courses/:courseId/enrollments`
- Auth: `verifyToken`, `verifyAdmin`
- 200 Response:
  - `[{ "enrollmentId": string, "userId": string, "username": string, "status": "enrolled"|"withdrawn", "enrolledAt": string }]`

### POST `/api/admin/courses/:courseId/enrollments`
- Auth: `verifyToken`, `verifyAdmin`
- Body:
  - `{ "username": string }`
- 200 Response:
  - `{ "message": "Enrolled", "enrollmentId": string }`

### POST `/api/admin/enrollments/:enrollmentId/withdraw`
- Auth: `verifyToken`, `verifyAdmin`
- 200 Response:
  - `{ "message": "Withdrawn", "enrollmentId": string }`

---

## Assessments (Content-aware)

### GET `/api/courses/:courseId/assessments`
- Auth: `verifyToken`
- Returns published course-level assessments for a course.
- 200 Response:
  - `[{ "id": number, "title": string }]`

### POST `/api/admin/courses/:courseId/assessments/:assessmentId/attach`
- Auth: `verifyToken`, `verifyAdmin`
- 200 Response:
  - `{ "message": "Attached", "courseId": string, "assessmentId": number }`

### POST `/api/admin/courses/:courseId/assessments/:assessmentId/detach`
- Auth: `verifyToken`, `verifyAdmin`
- Detach does not delete the assessment definition.
- 200 Response:
  - `{ "message": "Detached", "courseId": string, "assessmentId": number }`

### POST `/api/admin/lessons/:lessonId/assessments/:assessmentId/attach`
- Auth: `verifyToken`, `verifyAdmin`
- 200 Response:
  - `{ "message": "Attached", "lessonId": string, "assessmentId": number }`

### POST `/api/admin/lessons/:lessonId/assessments/:assessmentId/detach`
- Auth: `verifyToken`, `verifyAdmin`
- 200 Response:
  - `{ "message": "Detached", "lessonId": string, "assessmentId": number }`

### POST `/api/admin/chapters/:chapterId/assessments/:assessmentId/attach`
- Auth: `verifyToken`, `verifyAdmin`
- 200 Response:
  - `{ "message": "Attached", "chapterId": string, "assessmentId": number }`

### POST `/api/admin/chapters/:chapterId/assessments/:assessmentId/detach`
- Auth: `verifyToken`, `verifyAdmin`
- 200 Response:
  - `{ "message": "Detached", "chapterId": string, "assessmentId": number }`

### POST `/api/admin/assessments/:assessmentId/archive`
- Auth: `verifyToken`, `verifyAdmin`
- Archives assessment definition (preferred: mark archived in `content_assessments`; keep file).
- 200 Response:
  - `{ "message": "Archived", "assessmentId": number }`

---

## Assessments (Existing endpoints to keep)

These remain valid (already implemented) and will be extended to include `courseId` in attempt submissions.

### GET `/api/assessments`
- Auth: `verifyToken`
- Returns available assessments (system-wide list)

### GET `/api/assessment?id=:assessmentId`
- Auth: `verifyToken`
- Returns full assessment definition JSON

### POST `/api/assessment`
- Auth: `verifyToken`
- Body:
  - `{ "username": string, "assessmentData": object }`
- Required addition inside `assessmentData` for course scope:
  - `courseId?: string`
  - Recommended additions for lesson/chapter scope:
    - `lessonId?: string`
    - `chapterId?: string`

### GET `/api/assessment/history/:username`
- Auth: `verifyToken`
- Returns `{ assessments: [] }`

---

# Milestones Checklist

Use this as the build plan.

## Milestone A — Courses + Enrollments foundation

- [ ] Add Mongo models: `Course`, `Enrollment` (with indexes)
- [ ] Add student APIs: list courses, enroll, withdraw, my courses
- [ ] Add admin APIs: create/edit/archive/list courses
- [ ] Add Angular pages: course catalog, my courses, course detail (basic)

## Milestone B — Lessons + Chapters foundation

- [ ] Add Mongo models: `Lesson`, `Chapter` (with indexes)
- [ ] Add admin APIs: create/edit/archive lessons + chapters
- [ ] Add student API: fetch course content tree
- [ ] Add Angular UI: course outline navigator (lessons + chapters)

## Milestone C — Chapter-level progress tracking

- [ ] Add Mongo model: `ChapterProgress`
- [ ] Add student APIs: get/update chapter progress
- [ ] Update UI to show per-chapter completion

## Milestone D — Attach assessments by scope (chapter/lesson/course)

- [ ] Add Mongo model: `ContentAssessment`
- [ ] Add admin APIs: attach/detach for chapter/lesson/course
- [ ] Update student content responses to include attached assessments

## Milestone E — Attempts + history across scopes

- [ ] Include `courseId`/`lessonId`/`chapterId` in assessment submissions
- [ ] Update history UI to group/filter by course (simple)
- [ ] Add admin roster view per course

## Milestone F — Archiving everywhere

- [ ] Replace destructive deletes with archive endpoints + UI
- [ ] Ensure archived courses/assessments are hidden from student lists

## Milestone G — Hardening

- [ ] Centralize request validation (shared validators)
- [ ] Add rate limiting to `/api/login`
- [ ] Make error responses consistent
- [ ] Time-box and remove legacy fallback paths when rollout complete

---

## Notes on Archiving (File-backed Assessments)

Because assessment definitions are stored on disk, “archiving” should NOT remove files during normal admin operations.

Recommended approach:
- Archive at the mapping layer (`content_assessments.status='archived'`).
- Keep the JSON file for auditability and to avoid breaking existing attempt history.

Optionally later:
- Add a maintenance-only purge script that removes archived definitions after manual review.
