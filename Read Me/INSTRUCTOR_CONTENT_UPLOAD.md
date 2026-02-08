# Instructor Guide: Uploading Course Content

This LMS supports adding **chapter text** and uploading **chapter assets** (images/videos/files) via the Admin UI.

> Note: Right now, the upload/edit UI is **admin-only** (role must be `admin`). If you want true “instructor” accounts to upload content, we can extend the permission check to allow an `instructor` role.

---

## Where is course content stored?

There are two parts:

1) **Chapter text + asset references**
- Stored in **MongoDB** on the `chapters` collection (in the `content` field).
- Example shape:
  ```json
  {
    "content": {
      "text": "Lesson text...",
      "assets": [
        { "url": "/uploads/myfile_1700000000_ab12.png", "kind": "image", "originalName": "myfile.png", "mimetype": "image/png" }
      ]
    }
  }
  ```

2) **Uploaded asset files**
- Stored on the **server filesystem** at:
  - `server/uploads/`
- Served publicly by the backend at:
  - `GET /uploads/<filename>`

### Important production note
Because assets are stored on the server’s local disk, the files may be **lost** if your hosting platform uses ephemeral filesystems (common on many PaaS deployments) or if you redeploy/scale to multiple instances.

If you need durable storage, the usual upgrade is to store assets in object storage (S3/R2/GCS/Azure Blob) and save those URLs in `chapter.content.assets[]`.

---

## Upload content (Admin UI)

1) **Login**
- Login with an account that has role `admin`.

2) **Open course content management**
- Go to **Admin → Course Management**
- Find the course
- Click **Content**

3) **Create structure (if needed)**
- Create a **Lesson**
- Add one or more **Chapters** under that lesson

4) **Edit a chapter’s content**
- In the chapter row, click **Content**
- Add **Text** in the text box

5) **Upload assets (drag & drop OR file picker)**
- Drag files into the upload box, OR click the file input and select one or more files
- The UI will upload each file and add it to **Attached assets**

6) **Save**
- Click **Save Content** to persist the chapter text + asset list

7) **Verify as a student**
- Click **View Course**
- In the Course Details page, click the chapter title
- You should see the text and any uploaded assets rendered

---

## File limits and accepted types

- The backend currently enforces a **25 MB per file** limit.
- File type detection is based on MIME type:
  - `image/*` → rendered as an image
  - `video/*` → rendered in a video player
  - anything else → rendered as a downloadable link

---

## Troubleshooting

### “Access denied”
- Your user must have role `admin` (currently required for uploads).

### Upload succeeds but images/videos don’t show
- Confirm the asset URL is reachable in your browser:
  - `http://<your-host>/uploads/<filename>`
- If you’re behind a proxy, ensure it forwards `/uploads/*` to the backend.

### Assets disappear after redeploy
- This is expected if your host does not persist local files.
- Solution: move uploads to object storage and save external URLs.

---

## Optional: Upload via API (advanced)

If you need to upload assets programmatically:

- Endpoint: `POST /api/admin/uploads`
- Auth: `Authorization: Bearer <token>` (admin)
- Body: `multipart/form-data`
  - field name: `file`

Response includes a `url` like `/uploads/<filename>` which you can store in `chapter.content.assets[]`.
