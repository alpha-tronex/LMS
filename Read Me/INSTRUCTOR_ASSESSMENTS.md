# Instructor Guide: Creating, Attaching, and Editing Assessments

This guide explains how instructors work with assessments in this LMS.

Assessments in this system have **two parts**:

1) **Assessment definition (the file)**
- Stored on disk as JSON files in `server/assessments/assessment_<id>.json`
- The `<id>` is the **assessment ID** you see in the UI

2) **Assessment attachment (the mapping/policy)**
- Stored in MongoDB (content→assessment mappings)
- This is what makes an assessment required for a specific course (or lesson/chapter)

The key rule: **editing an assessment file does not automatically change what a course uses unless that course is attached to that assessment ID**.

---

## Roles and permissions (instructor vs admin)

**Instructors can**:
- Create new assessments
- Edit assessments they own
- Attach/detach assessments for courses they are assigned to

**Instructors cannot**:
- Edit “shared/legacy” assessments that have no owner metadata (admin-owned)
- Delete an assessment that is attached to any course/lesson/chapter
- Delete all assessment files (admin-only)

Admins can do all of the above.

---

## Create an assessment

### Option A: Create in the UI (recommended)
1) Go to **Admin → Create Assessment**
2) Fill in the assessment title and add questions
3) Click **Save Assessment**

You will receive an **assessment ID** after saving.

### Option B: Upload a formatted file
1) Go to **Admin → Upload Assessment**
2) Upload a `.txt` or `.rtf` file in the supported format
3) Click **Upload Assessment**

Notes:
- The server auto-assigns the **lowest available assessment ID**.
- Titles must be unique (the server will reject duplicate titles).

---

## Attach an assessment to a course

Course-level assessment attachment is managed on the **Course Management** page.

1) Go to **Admin → Course Management**
2) Find your course (instructors will see all courses, but can only edit assigned courses)
3) In the **Course Assessment** column:
   - Select an assessment from the dropdown
   - Click **Attach**

### Important rules
- You can only attach assessments to **courses you are assigned to**.
- A course can have **at most one active course assessment mapping** at a time.
- If the course is archived, attachment actions are disabled.

---

## Edit an assessment (and what happens if it’s attached)

### Editing an assessment that is NOT attached
If the assessment is not attached anywhere:
- Saving changes updates the same `assessment_<id>.json` file in place.
- Any future attachments to that ID will use the updated content.

### Editing an assessment that IS attached (versioning behavior)
If the assessment is already attached to any course/lesson/chapter:
- Instructors are **not allowed** to modify it in place.
- When you click Save, the system **creates a new version**:
  - A **new assessment ID** is generated
  - A new file is written: `assessment_<newId>.json`
  - The title may be adjusted to avoid collisions (example: `My Quiz (v2)`)

After saving, you’ll be redirected to **Course Management** with the new ID preselected:
- `/admin/course-management?assessmentId=<newId>`

To use your changes:
1) Go to **Admin → Course Management**
2) Find your course
3) Click **Attach** (with the new ID selected)

This prevents a silent change to an assessment that learners might already be taking.

---

## Delete assessments (instructors)

Instructors can delete assessment files only if **all** are true:
- You own the assessment (it was created by you)
- It is **not attached** to any course/lesson/chapter

If an assessment is attached, you must detach it first (or ask an admin to review).

---

## Troubleshooting

### “Access denied” when editing
- The assessment may be **admin-owned/shared** (older files without ownership metadata)
- Or you may be trying to edit an assessment you don’t own

### “A new version was created” after Save
- This means the assessment was attached somewhere, so your edit produced a new ID.
- Attach the new ID to your course to use the updated version.

### I attached the new version but students still see the old one
- Confirm you attached the **new ID** on the correct course.
- If you have multiple scopes (course vs lesson/chapter), ensure you changed the mapping at the scope you’re using.

---

## Best practices
- Prefer **creating a new assessment** for major changes, even if not attached yet.
- Treat assessment IDs like “published versions.”
- Use clear titles so you can identify versions later (e.g., `Final Exam - Genesis (v2)`).
