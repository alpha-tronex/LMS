export type ChapterProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface ChapterProgressItem {
  chapterId: string;
  status: ChapterProgressStatus;
  updatedAt: string | null;
}
