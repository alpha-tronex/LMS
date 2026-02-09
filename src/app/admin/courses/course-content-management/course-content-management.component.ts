import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminCourse, AdminCourseService } from '@admin/services/admin-course.service';
import {
  AdminChapter,
  AdminContentService,
  AdminLesson,
  UploadedAsset,
} from '@admin/services/admin-content.service';
import { LoggerService } from '@core/services/logger.service';

type MessageType = 'success' | 'danger';

@Component({
  selector: 'app-course-content-management',
  templateUrl: './course-content-management.component.html',
  styleUrls: ['./course-content-management.component.css'],
  standalone: false,
})
export class CourseContentManagementComponent implements OnInit {
  courseId = '';
  course: AdminCourse | null = null;

  lessons: Array<AdminLesson & { chapters: AdminChapter[]; chaptersLoading: boolean }> = [];

  loading = true;
  saving = false;
  error = '';
  message = '';
  messageType: MessageType = 'success';

  // Create lesson
  newLessonTitle = '';
  newLessonDescription = '';
  newLessonSortOrder: number | null = null;

  // Create chapter (per-lesson)
  newChapterTitle: Record<string, string> = {};
  newChapterSortOrder: Record<string, number | null> = {};

  // Edit lesson
  editingLessonId: string | null = null;
  editLessonTitle = '';
  editLessonDescription = '';
  editLessonSortOrder: number | null = null;

  // Edit chapter
  editingChapterId: string | null = null;
  editChapterTitle = '';
  editChapterSortOrder: number | null = null;

  // Chapter content editor
  contentChapterId: string | null = null;
  contentLoading = false;
  contentSaving = false;
  contentUploading = false;
  isDragOver = false;

  contentPages: Array<{
    text: string;
    assets: Array<{ url: string; kind: 'image' | 'video' | 'file'; originalName?: string; mimetype?: string }>;
  }> = [];
  contentPageIndex = 0;

  contentText = '';
  contentAssets: Array<{ url: string; kind: 'image' | 'video' | 'file'; originalName?: string; mimetype?: string }> = [];

  youtubeUrl = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminCourseService: AdminCourseService,
    private adminContentService: AdminContentService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    const currentUserRaw = localStorage.getItem('currentUser');
    if (!currentUserRaw) {
      this.error = 'Please login as an admin or instructor to manage course content.';
      this.loading = false;
      return;
    }

    try {
      const parsed = JSON.parse(currentUserRaw);
      if (!parsed || (parsed.role !== 'admin' && parsed.role !== 'instructor')) {
        this.error = 'Access denied. Admin or instructor privileges required.';
        this.loading = false;
        return;
      }
    } catch {
      this.error = 'Unable to read current user. Please login again.';
      this.loading = false;
      return;
    }

    const id = this.route.snapshot.paramMap.get('courseId');
    if (!id) {
      this.error = 'Missing course id.';
      this.loading = false;
      return;
    }

    this.courseId = id;
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.error = '';
    this.message = '';

    this.adminCourseService.listCourses().subscribe({
      next: (courses) => {
        const found = (courses || []).find((c) => c.id === this.courseId) || null;
        this.course = found;

        this.adminContentService.listLessons(this.courseId, true).subscribe({
          next: (lessons) => {
            this.lessons = (lessons || []).map((l) => ({
              ...l,
              chapters: [],
              chaptersLoading: true,
            }));

            if (this.lessons.length === 0) {
              this.loading = false;
              return;
            }

            let remaining = this.lessons.length;
            for (const lesson of this.lessons) {
              this.adminContentService.listChapters(lesson.id, true).subscribe({
                next: (chapters) => {
                  lesson.chapters = chapters || [];
                  lesson.chaptersLoading = false;
                  remaining--;
                  if (remaining === 0) this.loading = false;
                },
                error: (err) => {
                  this.logger.error('Failed to load chapters', err);
                  lesson.chapters = [];
                  lesson.chaptersLoading = false;
                  remaining--;
                  if (remaining === 0) this.loading = false;
                },
              });
            }
          },
          error: (err) => {
            this.logger.error('Failed to load lessons', err);
            this.error = 'Failed to load lessons.';
            this.loading = false;
          },
        });
      },
      error: (err) => {
        this.logger.error('Failed to load admin courses', err);
        this.error = 'Failed to load course.';
        this.loading = false;
      },
    });
  }

  backToCourses(): void {
    this.router.navigate(['/admin/course-management']);
  }

  // Lessons
  createLesson(): void {
    const title = (this.newLessonTitle || '').trim();
    if (!title) {
      this.error = 'Lesson title is required.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    const sortOrder =
      this.newLessonSortOrder === null || this.newLessonSortOrder === undefined
        ? undefined
        : Number(this.newLessonSortOrder);

    this.adminContentService
      .createLesson(this.courseId, {
        title,
        description: this.newLessonDescription || '',
        sortOrder,
      })
      .subscribe({
        next: (created) => {
          this.lessons = [
            {
              ...created,
              chapters: [],
              chaptersLoading: false,
            },
            ...this.lessons,
          ].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

          this.newLessonTitle = '';
          this.newLessonDescription = '';
          this.newLessonSortOrder = null;

          this.messageType = 'success';
          this.message = 'Lesson created.';
          this.saving = false;
        },
        error: (err) => {
          this.logger.error('Failed to create lesson', err);
          this.error = 'Failed to create lesson.';
          this.saving = false;
        },
      });
  }

  startEditLesson(lesson: AdminLesson): void {
    this.editingLessonId = lesson.id;
    this.editLessonTitle = lesson.title;
    this.editLessonDescription = lesson.description || '';
    this.editLessonSortOrder = lesson.sortOrder ?? 0;

    this.editingChapterId = null;
    this.message = '';
    this.error = '';
  }

  cancelEditLesson(): void {
    this.editingLessonId = null;
    this.editLessonTitle = '';
    this.editLessonDescription = '';
    this.editLessonSortOrder = null;
  }

  saveEditLesson(lesson: AdminLesson): void {
    if (!this.editingLessonId) return;

    const title = (this.editLessonTitle || '').trim();
    if (!title) {
      this.error = 'Lesson title is required.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    const sortOrder =
      this.editLessonSortOrder === null || this.editLessonSortOrder === undefined
        ? undefined
        : Number(this.editLessonSortOrder);

    this.adminContentService
      .updateLesson(lesson.id, {
        title,
        description: this.editLessonDescription || '',
        sortOrder,
      })
      .subscribe({
        next: (updated) => {
          this.lessons = this.lessons
            .map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

          this.messageType = 'success';
          this.message = 'Lesson updated.';
          this.saving = false;
          this.cancelEditLesson();
        },
        error: (err) => {
          this.logger.error('Failed to update lesson', err);
          this.error = 'Failed to update lesson.';
          this.saving = false;
        },
      });
  }

  archiveLesson(lesson: AdminLesson): void {
    if (!lesson || lesson.status === 'archived') return;

    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminContentService.archiveLesson(lesson.id).subscribe({
      next: () => {
        this.lessons = this.lessons.map((l) =>
          l.id === lesson.id ? { ...l, status: 'archived' } : l
        );
        this.messageType = 'success';
        this.message = 'Lesson archived.';
        this.saving = false;
      },
      error: (err) => {
        this.logger.error('Failed to archive lesson', err);
        this.error = 'Failed to archive lesson.';
        this.saving = false;
      },
    });
  }

  isEditingLesson(lesson: AdminLesson): boolean {
    return this.editingLessonId === lesson.id;
  }

  // Chapters
  createChapter(lesson: AdminLesson): void {
    const title = (this.newChapterTitle[lesson.id] || '').trim();
    if (!title) {
      this.error = 'Chapter title is required.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    const rawOrder = this.newChapterSortOrder[lesson.id];
    const sortOrder = rawOrder === null || rawOrder === undefined ? undefined : Number(rawOrder);

    this.adminContentService
      .createChapter(lesson.id, {
        title,
        sortOrder,
        content: {},
      })
      .subscribe({
        next: (created) => {
          const target = this.lessons.find((l) => l.id === lesson.id);
          if (target) {
            target.chapters = [...(target.chapters || []), created].sort(
              (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
            );
          }

          this.newChapterTitle[lesson.id] = '';
          this.newChapterSortOrder[lesson.id] = null;

          this.messageType = 'success';
          this.message = 'Chapter created.';
          this.saving = false;
        },
        error: (err) => {
          this.logger.error('Failed to create chapter', err);
          this.error = 'Failed to create chapter.';
          this.saving = false;
        },
      });
  }

  startEditChapter(chapter: AdminChapter): void {
    this.editingChapterId = chapter.id;
    this.editChapterTitle = chapter.title;
    this.editChapterSortOrder = chapter.sortOrder ?? 0;

    this.editingLessonId = null;
    this.message = '';
    this.error = '';
  }

  cancelEditChapter(): void {
    this.editingChapterId = null;
    this.editChapterTitle = '';
    this.editChapterSortOrder = null;
  }

  saveEditChapter(lessonId: string, chapter: AdminChapter): void {
    if (!this.editingChapterId) return;

    const title = (this.editChapterTitle || '').trim();
    if (!title) {
      this.error = 'Chapter title is required.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    const sortOrder =
      this.editChapterSortOrder === null || this.editChapterSortOrder === undefined
        ? undefined
        : Number(this.editChapterSortOrder);

    this.adminContentService
      .updateChapter(chapter.id, {
        title,
        sortOrder,
      })
      .subscribe({
        next: (updated) => {
          const target = this.lessons.find((l) => l.id === lessonId);
          if (target) {
            target.chapters = (target.chapters || [])
              .map((c) => (c.id === updated.id ? updated : c))
              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          }

          this.messageType = 'success';
          this.message = 'Chapter updated.';
          this.saving = false;
          this.cancelEditChapter();
        },
        error: (err) => {
          this.logger.error('Failed to update chapter', err);
          this.error = 'Failed to update chapter.';
          this.saving = false;
        },
      });
  }

  archiveChapter(lessonId: string, chapter: AdminChapter): void {
    if (!chapter || chapter.status === 'archived') return;

    this.saving = true;
    this.error = '';
    this.message = '';

    this.adminContentService.archiveChapter(chapter.id).subscribe({
      next: () => {
        const target = this.lessons.find((l) => l.id === lessonId);
        if (target) {
          target.chapters = (target.chapters || []).map((c) =>
            c.id === chapter.id ? { ...c, status: 'archived' } : c
          );
        }
        this.messageType = 'success';
        this.message = 'Chapter archived.';
        this.saving = false;
      },
      error: (err) => {
        this.logger.error('Failed to archive chapter', err);
        this.error = 'Failed to archive chapter.';
        this.saving = false;
      },
    });
  }

  isEditingChapter(chapter: AdminChapter): boolean {
    return this.editingChapterId === chapter.id;
  }

  // Chapter content
  isEditingContent(chapter: AdminChapter): boolean {
    return this.contentChapterId === chapter.id;
  }

  openContentEditor(chapter: AdminChapter): void {
    if (!chapter || chapter.status === 'archived') return;

    // Dedicated page editor (keeps the course-content screen less busy)
    this.router.navigate([
      '/admin/course-content',
      this.courseId,
      'chapters',
      chapter.id,
      'pages',
      1,
    ]);
  }

  closeContentEditor(): void {
    this.contentChapterId = null;
    this.contentLoading = false;
    this.contentSaving = false;
    this.contentUploading = false;
    this.isDragOver = false;
    this.contentPages = [];
    this.contentPageIndex = 0;
    this.contentText = '';
    this.contentAssets = [];
    this.youtubeUrl = '';
  }

  get pageCount(): number {
    return this.contentPages.length;
  }

  private saveCurrentPageToModel(): void {
    if (!this.contentPages || this.contentPages.length === 0) return;
    const i = this.contentPageIndex;
    if (i < 0 || i >= this.contentPages.length) return;

    this.contentPages[i] = {
      text: this.contentText || '',
      assets: Array.isArray(this.contentAssets) ? [...this.contentAssets] : [],
    };
  }

  private loadPage(index: number): void {
    if (!this.contentPages || this.contentPages.length === 0) {
      this.contentPages = [{ text: '', assets: [] }];
    }

    const nextIndex = Math.max(0, Math.min(index, this.contentPages.length - 1));
    this.contentPageIndex = nextIndex;

    const page = this.contentPages[nextIndex] || { text: '', assets: [] };
    this.contentText = typeof page.text === 'string' ? page.text : '';
    this.contentAssets = Array.isArray(page.assets) ? [...page.assets] : [];
    this.youtubeUrl = '';
  }

  prevPage(): void {
    if (this.contentLoading || this.contentSaving || this.contentUploading) return;
    if (this.contentPageIndex <= 0) return;
    this.saveCurrentPageToModel();
    this.loadPage(this.contentPageIndex - 1);
  }

  nextPage(): void {
    if (this.contentLoading || this.contentSaving || this.contentUploading) return;
    if (this.contentPageIndex >= this.contentPages.length - 1) return;
    this.saveCurrentPageToModel();
    this.loadPage(this.contentPageIndex + 1);
  }

  addPage(): void {
    if (this.contentLoading || this.contentSaving || this.contentUploading) return;
    this.saveCurrentPageToModel();
    this.contentPages = [...(this.contentPages || []), { text: '', assets: [] }];
    this.loadPage(this.contentPages.length - 1);
  }

  removeCurrentPage(): void {
    if (this.contentLoading || this.contentSaving || this.contentUploading) return;
    if (!this.contentPages || this.contentPages.length <= 1) return;

    const i = this.contentPageIndex;
    this.contentPages = this.contentPages.filter((_p, idx) => idx !== i);
    this.loadPage(Math.min(i, this.contentPages.length - 1));
  }

  movePageUp(): void {
    if (this.contentLoading || this.contentSaving || this.contentUploading) return;
    const i = this.contentPageIndex;
    if (!this.contentPages || i <= 0) return;
    this.saveCurrentPageToModel();

    const next = [...this.contentPages];
    const tmp = next[i - 1];
    next[i - 1] = next[i];
    next[i] = tmp;
    this.contentPages = next;
    this.loadPage(i - 1);
  }

  movePageDown(): void {
    if (this.contentLoading || this.contentSaving || this.contentUploading) return;
    const i = this.contentPageIndex;
    if (!this.contentPages || i >= this.contentPages.length - 1) return;
    this.saveCurrentPageToModel();

    const next = [...this.contentPages];
    const tmp = next[i + 1];
    next[i + 1] = next[i];
    next[i] = tmp;
    this.contentPages = next;
    this.loadPage(i + 1);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    this.uploadFiles(Array.from(files));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input?.files;
    if (!files || files.length === 0) return;
    this.uploadFiles(Array.from(files));
    input.value = '';
  }

  private uploadFiles(files: File[]): void {
    if (!this.contentChapterId) return;

    this.contentUploading = true;
    this.error = '';
    this.message = '';

    let index = 0;
    const next = () => {
      if (index >= files.length) {
        this.contentUploading = false;
        return;
      }

      const file = files[index++];
      this.adminContentService.uploadAsset(file).subscribe({
        next: (uploaded: UploadedAsset) => {
          const kind =
            uploaded.mimetype && uploaded.mimetype.startsWith('video/')
              ? 'video'
              : uploaded.mimetype && uploaded.mimetype.startsWith('image/')
                ? 'image'
                : 'file';

          this.contentAssets = [
            ...this.contentAssets,
            {
              url: uploaded.url,
              kind,
              originalName: uploaded.originalName,
              mimetype: uploaded.mimetype,
            },
          ];
          next();
        },
        error: (err) => {
          this.logger.error('Failed to upload asset', err);
          this.error = 'Failed to upload one or more files.';
          this.contentUploading = false;
        },
      });
    };

    next();
  }

  removeAsset(url: string): void {
    this.contentAssets = this.contentAssets.filter((a) => a.url !== url);
  }

  addYouTubeVideo(): void {
    if (this.contentSaving || this.contentUploading || this.contentLoading) return;

    const url = (this.youtubeUrl || '').trim();
    if (!url) {
      this.error = 'Please enter a YouTube URL.';
      return;
    }

    const lowered = url.toLowerCase();
    const isYouTube =
      lowered.includes('youtube.com/watch') ||
      lowered.includes('youtube.com/embed/') ||
      lowered.includes('youtu.be/') ||
      lowered.includes('youtube-nocookie.com/embed/');

    if (!isYouTube) {
      this.error = 'Please enter a valid YouTube link (youtube.com or youtu.be).';
      return;
    }

    if (this.contentAssets.some((a) => a.url === url)) {
      this.messageType = 'danger';
      this.message = 'That video URL is already attached to this page.';
      return;
    }

    this.error = '';
    this.messageType = 'success';
    this.message = 'YouTube video link added to this page.';

    this.contentAssets = [
      ...this.contentAssets,
      {
        url,
        kind: 'video',
        originalName: 'YouTube video',
        mimetype: 'text/url',
      },
    ];
    this.youtubeUrl = '';
  }

  saveChapterContent(chapter: AdminChapter): void {
    if (!this.contentChapterId || chapter.id !== this.contentChapterId) return;

    this.contentSaving = true;
    this.error = '';
    this.message = '';

    this.saveCurrentPageToModel();
    const pages = Array.isArray(this.contentPages) && this.contentPages.length > 0 ? this.contentPages : [{ text: '', assets: [] }];
    const first = pages[0] || { text: '', assets: [] };

    this.adminContentService
      .updateChapter(chapter.id, {
        content: {
          pages,
          // Best-effort legacy compatibility:
          // expose page 1 as the legacy single-text + single-asset-list fields.
          text: first.text || '',
          assets: Array.isArray(first.assets) ? first.assets : [],
        },
      })
      .subscribe({
        next: () => {
          this.messageType = 'success';
          this.message = 'Chapter content saved.';
          this.contentSaving = false;
        },
        error: (err) => {
          this.logger.error('Failed to save chapter content', err);
          this.error = 'Failed to save chapter content.';
          this.contentSaving = false;
        },
      });
  }
}
