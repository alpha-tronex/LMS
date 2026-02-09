export interface ChapterOutline {
  id: string;
  lessonId: string;
  title: string;
  sortOrder: number;
  assessments?: ContentAssessmentAttachment[];
}

export interface ContentAssessmentAttachment {
  assessmentId: number;
  isRequired: boolean;
  passScore: number | null;
  maxAttempts: number | null;
}

export interface ChapterAsset {
  url: string;
  kind: 'image' | 'video' | 'file';
  originalName?: string;
  mimetype?: string;
}

export interface ChapterPage {
  text?: string;
  assets?: ChapterAsset[];
}

export interface ChapterContent {
  // New (preferred): paged content
  pages?: ChapterPage[];

  // Legacy (kept for backward compatibility)
  text?: string;
  assets?: ChapterAsset[];
}

export interface ChapterDetail {
  id: string;
  courseId: string;
  lessonId: string;
  title: string;
  sortOrder: number;
  content: ChapterContent;
}

export interface LessonOutline {
  id: string;
  courseId: string;
  title: string;
  description: string;
  sortOrder: number;
  chapters: ChapterOutline[];
  assessments?: ContentAssessmentAttachment[];
}

export interface CourseContentTree {
  course: {
    id: string;
    title: string;
    description: string;
    assessments?: ContentAssessmentAttachment[];
  };
  lessons: LessonOutline[];
}
