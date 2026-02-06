import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { ScrollService } from '@core/services/scroll.service';

@Component({
  selector: 'alpha-tronex-modal',
  templateUrl: './alpha-tronex-modal.component.html',
  styleUrls: ['./alpha-tronex-modal.component.css'],
  standalone: false
})
export class AlphaTronexModalComponent {
  @Input() show = false;
  @Input() title = '';
  @Input() type: 'info' | 'warning' | 'danger' | 'success' | 'custom' = 'info';
  @Input() content: string | null = null;
  @Input() disableClose = false;
  @Input() scrollToTopOnHide = false;
  @Input() scrollBehavior: ScrollBehavior = 'smooth';
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  constructor(private scroll: ScrollService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const showChange = changes['show'];
    if (!showChange || showChange.firstChange) {
      return;
    }

    const wasVisible = showChange.previousValue === true;
    const isVisible = showChange.currentValue === true;
    if (wasVisible && !isVisible && this.scrollToTopOnHide) {
      this.scroll.toTop(this.scrollBehavior);
    }
  }

  onClose() {
    if (!this.disableClose) {
      this.close.emit();
    }
  }

  onConfirm() {
    this.confirm.emit();
  }
}
