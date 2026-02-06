import { Directive, HostListener, Input } from '@angular/core';
import { ScrollService } from '@core/services/scroll.service';

@Directive({
  selector: '[appScrollTopOnClick]',
  standalone: false
})
export class ScrollTopOnClickDirective {
  @Input() appScrollTopOnClick: boolean | '' = true;
  @Input() scrollBehavior: ScrollBehavior = 'smooth';

  constructor(private scroll: ScrollService) {}

  @HostListener('click')
  onClick(): void {
    const enabled = this.appScrollTopOnClick !== false;
    if (!enabled) {
      return;
    }
    this.scroll.toTop(this.scrollBehavior);
  }
}
