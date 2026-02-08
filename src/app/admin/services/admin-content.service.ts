import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { LoggerService } from '@core/services/logger.service';

export interface AdminLesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  sortOrder: number;
  status: 'active' | 'archived';
}

export interface AdminChapter {
  id: string;
  courseId: string;
  lessonId: string;
  title: string;
  sortOrder: number;
  status: 'active' | 'archived';
}

export interface UploadedAsset {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
}

export interface ChapterDetail {
  id: string;
  courseId: string;
  lessonId: string;
  title: string;
  sortOrder: number;
  content: any;
}

@Injectable({
  providedIn: 'root',
})
export class AdminContentService {
  constructor(private http: HttpClient, private logger: LoggerService) {}

  listLessons(courseId: string, includeArchived = true): Observable<AdminLesson[]> {
    const q = includeArchived ? '?includeArchived=1' : '';
    return this.http.get<AdminLesson[]>(`/api/admin/courses/${courseId}/lessons${q}`).pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in listLessons', error);
        return this.handleError(error);
      })
    );
  }

  createLesson(
    courseId: string,
    payload: { title: string; description?: string; sortOrder?: number }
  ): Observable<AdminLesson> {
    return this.http.post<AdminLesson>(`/api/admin/courses/${courseId}/lessons`, payload).pipe(
      catchError((error) => {
        this.logger.error('Error in createLesson', error);
        return this.handleError(error);
      })
    );
  }

  updateLesson(
    lessonId: string,
    payload: { title?: string; description?: string; sortOrder?: number }
  ): Observable<AdminLesson> {
    return this.http.put<AdminLesson>(`/api/admin/lessons/${lessonId}`, payload).pipe(
      catchError((error) => {
        this.logger.error('Error in updateLesson', error);
        return this.handleError(error);
      })
    );
  }

  archiveLesson(lessonId: string): Observable<any> {
    return this.http.post<any>(`/api/admin/lessons/${lessonId}/archive`, {}).pipe(
      catchError((error) => {
        this.logger.error('Error in archiveLesson', error);
        return this.handleError(error);
      })
    );
  }

  listChapters(lessonId: string, includeArchived = true): Observable<AdminChapter[]> {
    const q = includeArchived ? '?includeArchived=1' : '';
    return this.http.get<AdminChapter[]>(`/api/admin/lessons/${lessonId}/chapters${q}`).pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in listChapters', error);
        return this.handleError(error);
      })
    );
  }

  createChapter(
    lessonId: string,
    payload: { title: string; sortOrder?: number; content?: any }
  ): Observable<AdminChapter> {
    return this.http.post<AdminChapter>(`/api/admin/lessons/${lessonId}/chapters`, payload).pipe(
      catchError((error) => {
        this.logger.error('Error in createChapter', error);
        return this.handleError(error);
      })
    );
  }

  updateChapter(
    chapterId: string,
    payload: { title?: string; sortOrder?: number; content?: any }
  ): Observable<AdminChapter> {
    return this.http.put<AdminChapter>(`/api/admin/chapters/${chapterId}`, payload).pipe(
      catchError((error) => {
        this.logger.error('Error in updateChapter', error);
        return this.handleError(error);
      })
    );
  }

  archiveChapter(chapterId: string): Observable<any> {
    return this.http.post<any>(`/api/admin/chapters/${chapterId}/archive`, {}).pipe(
      catchError((error) => {
        this.logger.error('Error in archiveChapter', error);
        return this.handleError(error);
      })
    );
  }

  uploadAsset(file: File): Observable<UploadedAsset> {
    const form = new FormData();
    form.append('file', file);

    return this.http.post<UploadedAsset>('/api/admin/uploads', form).pipe(
      catchError((error) => {
        this.logger.error('Error in uploadAsset', error);
        return this.handleError(error);
      })
    );
  }

  getChapter(chapterId: string): Observable<ChapterDetail> {
    return this.http.get<ChapterDetail>(`/api/chapters/${chapterId}`).pipe(
      retry(1),
      catchError((error) => {
        this.logger.error('Error in getChapter', error);
        return this.handleError(error);
      })
    );
  }

  private handleError(error: HttpErrorResponse) {
    const backendError = error.error || 'Something bad happened; please try again later.';
    return throwError(backendError);
  }
}
