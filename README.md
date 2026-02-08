# LMS

Full-stack LMS application (Angular frontend + Node/Express backend). This codebase started as the earlier “quizzes” project and has been rebranded to “LMS”.

## Release notes (breaking change: Quiz → Assessment)

This release includes a breaking rename of backend API endpoints and the persisted MongoDB user history field.

- API endpoints renamed from `/api/quiz*` to `/api/assessment*` (legacy quiz endpoints were removed)
- User history field renamed from `user.quizzes` to `user.assessments`
- Submission payload key renamed from `quizData` to `assessmentData`

### Assessment definition storage (server JSON files)

Assessment definition JSON files are now stored under `server/assessments/` and use the naming pattern `assessment_<id>.json`.

For backwards compatibility during rollout, the backend will still fall back to reading from the legacy `server/quizzes/quiz_<id>.json` paths if the new files are not present.

### Migration (required if you have existing data)

Run the one-time migration against the MongoDB instance that still has `user.quizzes`:

- `npm --prefix server run migrate:assessments`

Deploy the backend and frontend together (mixing old/new clients will fail due to the removed legacy endpoints).

### Data isolation note

LMS is configured to use a separate MongoDB collection (`lms_users`) so it does not share the legacy app’s `users` collection.
For stronger isolation, point LMS at a separate database via `MONGODB_URI`.

## Development server

Run `npm run dev` for the Angular dev server (proxying API calls). Navigate to `http://localhost:4200/`.

Run `npm start` to run the Express server that serves the built Angular app (and API) on `http://localhost:3000`.

## Demo (seeded accounts + sample course)

If you want a ready-to-click dataset (instructor + student + a small course with lessons/chapters), run:

- `node server/scripts/seed_small_course.js`

This uses `MONGODB_URI` if set; otherwise it defaults to `mongodb://localhost:27017/userDB`.

### Seeded logins

- Admin: `admin / local123`
- Instructor: `instruct / local123`
- Student: `student / local123`

### What to click

- **Admin**
	- Admin → Course Management → (per course) **Instructors** to assign instructors to admin-created courses
	- Admin → **Enrollment Management** to enroll/withdraw users in a course

- **Instructor**
	- Admin → Course Management / Content Management to manage lessons/chapters/uploads
	- Admin → Enrollment Management (only for courses where the instructor is assigned)

- **Student**
	- My Courses → open the seeded course → expand lessons → open chapters to view chapter content

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `npm run build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
