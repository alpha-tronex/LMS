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
- [ ] Mongo: add `courses` + `enrollments` collections (with indexes)
- [ ] Backend: student APIs for browse/enroll/withdraw/my-courses
- [ ] Backend: admin APIs for create/edit/archive/list courses
- [ ] Frontend: course catalog + my courses + course detail shell

## Milestone B — Lessons + Chapters foundation
- [ ] Mongo: add `lessons` + `chapters` collections (with indexes)
- [ ] Backend: admin APIs for create/edit/archive lessons + chapters
- [ ] Backend: student API for course content tree (lessons + chapters)
- [ ] Frontend: course outline navigator (lessons + chapters)

## Milestone C — Chapter-level progress tracking
- [ ] Mongo: add `chapter_progress` collection (with indexes)
- [ ] Backend: student APIs to get/update chapter progress
- [ ] Frontend: show per-chapter completion (derived lesson/course completion)

## Milestone D — Attach assessments by scope
- [ ] Mongo: add `content_assessments` mapping (chapter/lesson/course)
- [ ] Backend: attach/detach endpoints for chapter/lesson/course
- [ ] Backend: include scoped assessments in course content responses
- [ ] Frontend: chapter checkpoint quiz (3–5 Q), lesson assessment, course assessment entry points

## Milestone E — Attempts + history across scopes
- [ ] Submission: include `courseId`/`lessonId`/`chapterId` in attempt payload
- [ ] History: show attempts grouped by course + scope (simple)
- [ ] Admin: roster view per course

## Milestone F — Archiving everywhere
- [ ] Courses: archive instead of delete
- [ ] Enrollments: withdraw instead of delete
- [ ] Lessons/chapters: archive instead of delete
- [ ] Assessments: archive via mapping status
- [ ] Student views hide archived content

## Milestone G — Hardening
- [ ] Request validation centralized
- [ ] Rate limit `/api/login`
- [ ] Consistent error shapes
- [ ] Remove legacy storage fallback after rollout
