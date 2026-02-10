import { Component, OnInit } from '@angular/core';
import { environment } from '../../environments/environment';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.css'],
    standalone: false
})
export class FooterComponent implements OnInit {
  currentYear: number = new Date().getFullYear();
  aboutText: string = environment.aboutText;
  aboutMessage: string = environment.aboutMessage;

  constructor() { }

  ngOnInit() {
  }

}
