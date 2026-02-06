import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ScrollService {
  toTop(behavior: ScrollBehavior = 'smooth'): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior });
  }

  toAnchor(anchorId: string, behavior: ScrollBehavior = 'smooth'): void {
    if (typeof document === 'undefined') {
      return;
    }
    const element = document.getElementById(anchorId);
    if (!element) {
      return;
    }
    element.scrollIntoView({ behavior, block: 'start' });
  }
}
