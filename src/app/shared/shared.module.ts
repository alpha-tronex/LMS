import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlphaTronexModalComponent } from './components/alpha-tronex-modal/alpha-tronex-modal.component';
import { FormsModule } from '@angular/forms';
import { ScrollTopOnClickDirective } from './directives/scroll-top-on-click.directive';

@NgModule({
  declarations: [AlphaTronexModalComponent, ScrollTopOnClickDirective],
  imports: [CommonModule, FormsModule],
  exports: [AlphaTronexModalComponent, ScrollTopOnClickDirective]
})
export class SharedModule {}
