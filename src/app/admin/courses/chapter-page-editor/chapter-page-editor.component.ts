import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, UrlSegment } from '@angular/router';
import {
  AdminContentService,
  ChapterDetail,
  UploadedAsset,
} from '@admin/services/admin-content.service';
import { LoggerService } from '@core/services/logger.service';
import { Subscription, combineLatest } from 'rxjs';

type MessageType = 'success' | 'danger';

type EditorAsset = {
  url: string;
  kind: 'image' | 'video' | 'file';
  originalName?: string;
  mimetype?: string;
};

type EditorPage = {
  text: string;
  assets: EditorAsset[];
};

@Component({
  selector: 'app-chapter-page-editor',
  templateUrl: './chapter-page-editor.component.html',
  styleUrls: ['./chapter-page-editor.component.css'],
  standalone: false,
})
export class ChapterPageEditorComponent implements OnInit, OnDestroy {
  courseId = '';
  chapterId = '';

  loading = true;
  saving = false;
  uploading = false;
  isDragOver = false;

  error = '';
  message = '';
  messageType: MessageType = 'success';

  chapter: ChapterDetail | null = null;

  private chapterInitiallyEmpty = false;

  pages: EditorPage[] = [];
  pageIndex = 0; // 0-based

  pageText = '';
  pageAssets: EditorAsset[] = [];

  youtubeUrl = '';

  mode: 'edit' | 'create' = 'edit';

  private sub?: Subscription;
  private lastRouteKey = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminContentService: AdminContentService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    if (!localStorage.getItem('currentUser')) {
      this.error = 'Please login as an admin or instructor to manage course content.';
      this.loading = false;
      return;
    }

    try {
      const parsed = JSON.parse(localStorage.getItem('currentUser') || '{}');
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

    this.sub = combineLatest([this.route.paramMap, this.route.url]).subscribe({
      next: ([params, urlSegments]) => {
        const courseId = params.get('courseId') || '';
        const chapterId = params.get('chapterId') || '';
        const pageNumberRaw = params.get('pageNumber');

        const isNewRoute = this.isNewRoute(urlSegments);
        const desiredMode: 'edit' | 'create' = isNewRoute ? 'create' : 'edit';
        const desiredPageIndex = isNewRoute
          ? null
          : this.parsePageNumberToIndex(pageNumberRaw);

        const routeKey = `${courseId}:${chapterId}:${desiredMode}:${pageNumberRaw || 'new'}`;

        // Save form state into model before switching routes/pages.
        this.saveCurrentPageToModel();

        const chapterChanged = chapterId && chapterId !== this.chapterId;
        const courseChanged = courseId && courseId !== this.courseId;

        if (courseChanged) this.courseId = courseId;
        if (chapterChanged) this.chapterId = chapterId;

        if (!this.courseId || !this.chapterId) {
          this.error = 'Missing course/chapter id.';
          this.loading = false;
          return;
        }

        // If chapter changed, reload chapter before applying page selection.
        if (chapterChanged) {
          this.lastRouteKey = '';
          this.loadChapter(() => this.applyRouteSelection(routeKey, desiredMode, desiredPageIndex));
          return;
        }

        // Same chapter: apply selection if route truly changed.
        this.applyRouteSelection(routeKey, desiredMode, desiredPageIndex);
      },
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get pageCount(): number {
    return this.pages.length;
  }

  get currentPageNumber(): number {
    return this.pageIndex + 1;
  }

  get pageNumbers(): number[] {
    const count = this.pageCount;
    if (!Number.isFinite(count) || count <= 0) return [];
    return Array.from({ length: count }, (_v, i) => i + 1);
  }

  get titleText(): string {
    return this.mode === 'create' ? 'Create Page' : 'Edit Page';
  }

  backToCourseContent(): void {
    this.router.navigate(['/admin/course-content', this.courseId]);
  }

  createPage(): void {
    if (this.saving || this.uploading || this.loading) return;
    this.saveCurrentPageToModel();
    this.router.navigate([
      '/admin/course-content',
      this.courseId,
      'chapters',
      this.chapterId,
      'pages',
      'new',
    ]);
  }

  goToPage(pageNumber: number): void {
    if (this.saving || this.uploading || this.loading) return;
    const n = Number(pageNumber);
    if (!Number.isFinite(n) || n <= 0) return;
    this.saveCurrentPageToModel();
    this.router.navigate([
      '/admin/course-content',
      this.courseId,
      'chapters',
      this.chapterId,
      'pages',
      n,
    ]);
  }

  removeCurrentPage(): void {
    if (this.saving || this.uploading || this.loading) return;
    if (this.pages.length <= 1) return;

    const i = this.pageIndex;
    this.pages = this.pages.filter((_p, idx) => idx !== i);
    const nextIndex = Math.max(0, Math.min(i, this.pages.length - 1));
    this.loadPage(nextIndex);
    this.mode = 'edit';
    this.router.navigate([
      '/admin/course-content',
      this.courseId,
      'chapters',
      this.chapterId,
      'pages',
      nextIndex + 1,
    ]);
  }

  movePageUp(): void {
    if (this.saving || this.uploading || this.loading) return;
    const i = this.pageIndex;
    if (i <= 0) return;

    this.saveCurrentPageToModel();
    const next = [...this.pages];
    const tmp = next[i - 1];
    next[i - 1] = next[i];
    next[i] = tmp;
    this.pages = next;

    this.loadPage(i - 1);
    this.mode = 'edit';
    this.router.navigate([
      '/admin/course-content',
      this.courseId,
      'chapters',
      this.chapterId,
      'pages',
      this.pageIndex + 1,
    ]);
  }

  movePageDown(): void {
    if (this.saving || this.uploading || this.loading) return;
    const i = this.pageIndex;
    if (i >= this.pages.length - 1) return;

    this.saveCurrentPageToModel();
    const next = [...this.pages];
    const tmp = next[i + 1];
    next[i + 1] = next[i];
    next[i] = tmp;
    this.pages = next;

    this.loadPage(i + 1);
    this.mode = 'edit';
    this.router.navigate([
      '/admin/course-content',
      this.courseId,
      'chapters',
      this.chapterId,
      'pages',
      this.pageIndex + 1,
    ]);
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

  removeAsset(url: string): void {
    this.pageAssets = this.pageAssets.filter((a) => a.url !== url);
  }

  addYouTubeVideo(): void {
    if (this.saving || this.uploading || this.loading) return;

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

    if (this.pageAssets.some((a) => a.url === url)) {
      this.messageType = 'danger';
      this.message = 'That video URL is already attached to this page.';
      return;
    }

    this.error = '';
    this.messageType = 'success';
    this.message = 'YouTube video link added to this page.';

    this.pageAssets = [
      ...this.pageAssets,
      {
        url,
        kind: 'video',
        originalName: 'YouTube video',
        mimetype: 'text/url',
      },
    ];
    this.youtubeUrl = '';
  }

  save(): void {
    if (this.saving || this.uploading || this.loading) return;
    if (!this.chapter) return;

    this.saving = true;
    this.error = '';
    this.message = '';

    this.saveCurrentPageToModel();

    const pages = Array.isArray(this.pages) && this.pages.length > 0 ? this.pages : [{ text: '', assets: [] }];
    const first = pages[0] || { text: '', assets: [] };

    this.adminContentService
      .updateChapter(this.chapterId, {
        content: {
          pages,
          text: first.text || '',
          assets: Array.isArray(first.assets) ? first.assets : [],
        },
      })
      .subscribe({
        next: () => {
          this.messageType = 'success';
          this.message = 'Page saved.';
          this.saving = false;

          if (this.mode === 'create') {
            this.mode = 'edit';
            this.router.navigate([
              '/admin/course-content',
              this.courseId,
              'chapters',
              this.chapterId,
              'pages',
              this.pageIndex + 1,
            ]);
          }
        },
        error: (err) => {
          this.logger.error('Failed to save page', err);
          this.error = 'Failed to save page.';
          this.saving = false;
        },
      });
  }

  trackAsset(_index: number, asset: EditorAsset): string {
    return asset.url;
  }

  private loadChapter(done?: () => void): void {
    this.loading = true;
    this.error = '';
    this.message = '';

    this.adminContentService.getChapter(this.chapterId).subscribe({
      next: (detail) => {
        this.chapter = detail;

        const content = (detail && (detail as any).content) || {};
        const pagesRaw = content && Array.isArray(content.pages) ? content.pages : [];

        const rawHasPages =
          Array.isArray(pagesRaw) &&
          pagesRaw.some(
            (p) =>
              (typeof p?.text === 'string' && p.text.trim()) ||
              (Array.isArray(p?.assets) && p.assets.length > 0)
          );
        const rawHasLegacy =
          (typeof content.text === 'string' && content.text.trim()) ||
          (Array.isArray(content.assets) && content.assets.length > 0);
        this.chapterInitiallyEmpty = !rawHasPages && !rawHasLegacy;

        const normalizedPages = pagesRaw
          .map((p: any) => ({
            text: typeof p?.text === 'string' ? p.text : '',
            assets: Array.isArray(p?.assets)
              ? p.assets
                  .map((a: any) => ({
                    url: String(a?.url || ''),
                    kind: a?.kind === 'video' || a?.kind === 'file' ? a.kind : 'image',
                    originalName: a?.originalName ? String(a.originalName) : undefined,
                    mimetype: a?.mimetype ? String(a.mimetype) : undefined,
                  }))
                  .filter((a: any) => a.url)
              : [],
          }))
          .filter((p: any) => p.text || (p.assets && p.assets.length > 0));

        if (normalizedPages.length === 0) {
          const legacyText = typeof content.text === 'string' ? content.text : '';
          const legacyAssets = Array.isArray(content.assets)
            ? content.assets
                .map((a: any) => ({
                  url: String(a?.url || ''),
                  kind: a?.kind === 'video' || a?.kind === 'file' ? a.kind : 'image',
                  originalName: a?.originalName ? String(a.originalName) : undefined,
                  mimetype: a?.mimetype ? String(a.mimetype) : undefined,
                }))
                .filter((a: any) => a.url)
            : [];

          this.pages = [{ text: legacyText, assets: legacyAssets }];
        } else {
          this.pages = normalizedPages;
        }

        this.loadPage(0);
        this.loading = false;
        done?.();
      },
      error: (err) => {
        this.logger.error('Failed to load chapter', err);
        this.error = 'Failed to load chapter content.';
        this.loading = false;
      },
    });
  }

  private uploadFiles(files: File[]): void {
    if (!this.chapterId) return;

    this.uploading = true;
    this.error = '';
    this.message = '';

    let index = 0;
    const next = () => {
      if (index >= files.length) {
        this.uploading = false;
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

          this.pageAssets = [
            ...this.pageAssets,
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
          this.uploading = false;
        },
      });
    };

    next();
  }

  private saveCurrentPageToModel(): void {
    if (!this.pages || this.pages.length === 0) return;
    const i = this.pageIndex;
    if (i < 0 || i >= this.pages.length) return;

    this.pages[i] = {
      text: this.pageText || '',
      assets: Array.isArray(this.pageAssets) ? [...this.pageAssets] : [],
    };
  }

  private loadPage(index: number): void {
    if (!this.pages || this.pages.length === 0) {
      this.pages = [{ text: '', assets: [] }];
    }

    const nextIndex = Math.max(0, Math.min(index, this.pages.length - 1));
    this.pageIndex = nextIndex;

    const page = this.pages[nextIndex] || { text: '', assets: [] };
    this.pageText = typeof page.text === 'string' ? page.text : '';
    this.pageAssets = Array.isArray(page.assets) ? [...page.assets] : [];
    this.youtubeUrl = '';
  }

  private applyRouteSelection(
    routeKey: string,
    desiredMode: 'edit' | 'create',
    desiredPageIndex: number | null
  ): void {
    if (!this.chapter) return;

    if (routeKey === this.lastRouteKey) return;
    this.lastRouteKey = routeKey;

    if (desiredMode === 'create') {
      this.mode = 'create';
      this.pages = [...(this.pages || []), { text: '', assets: [] }];
      this.loadPage(this.pages.length - 1);
      return;
    }

    const idx = desiredPageIndex === null ? 0 : desiredPageIndex;
    // For a newly created/empty chapter, the first page behaves like "Create Page".
    this.mode = idx === 0 && this.chapterInitiallyEmpty ? 'create' : 'edit';
    this.loadPage(idx);
  }

  private isNewRoute(segments: UrlSegment[]): boolean {
    if (!segments || segments.length === 0) return false;
    return segments[segments.length - 1].path === 'new';
  }

  private parsePageNumberToIndex(pageNumberRaw: string | null): number {
    const raw = pageNumberRaw !== null ? Number(pageNumberRaw) : 1;
    const safe = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
    return safe - 1;
  }
}
