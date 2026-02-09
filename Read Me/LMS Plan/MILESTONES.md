# LMS Milestones (Checklist)

This is a shorter, execution-oriented checklist extracted from `Read Me/ARCHITECTURE.md`.

## Default completion rules (MVP)

- Chapter completion is tracked per-user in `chapter_progress`.
- A chapter is **completed** when:
	- the learner finishes the chapter content, and
	- if a chapter checkpoint quiz is configured, they pass it.
- A lesson is **completed** when:
	- all chapters in the lesson are completed, and
	- if a lesson assessment is configured, they pass it.
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
**Status:** NOT STARTED
Next up: implement `chapter_progress` model + endpoints first, then add a simple completion indicator in the course outline.
- [ ] Mongo: add `chapter_progress` collection (with indexes)
- [ ] Backend: student APIs to get/update chapter progress
- [ ] Frontend: show per-chapter completion (derived lesson/course completion)

## Milestone D — Attach assessments by scope
**Status:** NOT STARTED
Next up: introduce the `content_assessments` mapping and wire attach/detach endpoints; UI entry points can follow.
- [ ] Mongo: add `content_assessments` mapping (chapter/lesson/course)
- [ ] Backend: attach/detach endpoints for chapter/lesson/course
- [ ] Backend: include scoped assessments in course content responses
- [ ] Frontend: chapter checkpoint quiz (3–5 Q), lesson assessment, course assessment entry points

## Milestone E — Attempts + history across scopes
**Status:** NOT STARTED
Next up: extend attempt submissions to include scope IDs, then build a basic grouped “History” view.
- [ ] Submission: include `courseId`/`lessonId`/`chapterId` in attempt payload
- [ ] History: show attempts grouped by course + scope (simple)
- [ ] Admin: roster view per course

## Milestone F — Archiving everywhere
**Status:** PARTIAL
Next up: once Milestone D exists, archive/unarchive assessments by toggling mapping status and hide archived assessments in student entry points.
- [x] Courses: archive instead of delete
- [x] Enrollments: withdraw instead of delete
- [x] Lessons/chapters: archive instead of delete
- [ ] Assessments: archive via mapping status
- [x] Student views hide archived content

Notes:
- Assessment archiving "via mapping" depends on Milestone D.

## Milestone G — Hardening
**Status:** NOT STARTED
Next up: start with centralized request validation (shared validators) and a simple rate limit on `/api/login`.
- [ ] Request validation centralized
- [ ] Rate limit `/api/login`
- [ ] Consistent error shapes
- [ ] Remove legacy storage fallback after rollout
