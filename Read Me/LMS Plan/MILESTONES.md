# LMS Milestones (Checklist)

This is a shorter, execution-oriented checklist extracted from `Read Me/ARCHITECTURE.md`.

## Default completion rules (MVP)

- Chapter completion is tracked per-user in `chapter_progress`.
- A chapter is **completed** when:
	- the learner finishes the chapter content, and
	- if a chapter checkpoint quiz is configured, they pass it.
- A lesson is **completed** when:
	- all chapters in the lesson are completed.
- A course is **completed** when:
	- all lessons are completed, and
	- if a course assessment is configured, they pass it.

## Milestone A — Courses + Enrollments foundation
**Status:** DONE
- [x] Mongo: add `courses` + `enrollments` collections (with indexes)
- [x] Backend: student APIs for browse/enroll/withdraw/my-courses
- [x] Backend: admin APIs for create/edit/archive/list courses
- [x] Frontend: course catalog + my courses + course detail shell

## Milestone B — Lessons + Chapters foundation
**Status:** DONE
- [x] Mongo: add `lessons` + `chapters` collections (with indexes)
- [x] Backend: admin APIs for create/edit/archive lessons + chapters
- [x] Backend: student API for course content tree (lessons + chapters)
- [x] Frontend: course outline navigator (lessons + chapters)

Notes:
- Chapter viewing is a dedicated page with page navigation.
- Chapter content supports multi-page authoring (admin/instructor).

## Milestone C — Chapter-level progress tracking
**Status:** DONE
- [x] Mongo: add `chapter_progress` collection (with indexes)
- [x] Backend: student APIs to get/update chapter progress
- [x] Frontend: show per-chapter completion (derived lesson/course completion)

Notes:
- Chapter completion is explicit via a "Mark Complete" action (no auto-complete on last page).

## ``Milestone D — Attach assessments by scope``
**Status:** DONE
- [x] Mongo: add `content_assessments` mapping (chapter/lesson/course)
- [x] Backend: attach/detach endpoints for chapter/lesson/course
- [x] Backend: include scoped assessments in course content responses
- [x] Frontend: chapter checkpoint quiz + course assessment entry points

Notes (agreed rules):
- Chapter checkpoint quizzes: unlimited tries until 100% correct.
- Course final assessment: max 2 attempts; 80% required to pass the course.

## Milestone E — Attempts + history across scopes
**Status:** DONE
- [x] Submission: include `courseId`/`lessonId`/`chapterId` in attempt payload
- [x] History: show attempts grouped by course + scope (simple)
- [x] Admin: roster view per course

## Milestone F — Archiving everywhere
**Status:** DONE
Next up: once Milestone D exists, archive/unarchive assessments by toggling mapping status and hide archived assessments in student entry points.
- [x] Courses: archive instead of delete
- [x] Enrollments: withdraw instead of delete
- [x] Lessons/chapters: archive instead of delete
- [x] Assessments: archive via mapping status
- [x] Student views hide archived content

Notes:
- Assessment archiving "via mapping" depends on Milestone D.

## Milestone G — Hardening
**Status:** DONE
Next up: start with centralized request validation (shared validators) and a simple rate limit on `/api/login`.
- [x] Request validation centralized
- [x] Rate limit `/api/login`
- [x] Consistent error shapes
- [x] Remove legacy storage fallback after rollout
