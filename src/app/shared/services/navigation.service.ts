import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private history: string[] = [];
  private router = inject(Router);


  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const url: string = e.urlAfterRedirects;
      if (url.startsWith('/auth')) return;
      if (this.history[this.history.length - 1] === url) return;
      this.history.push(url);
    });
  }

  getPreviousUrl(): string {
    const len = this.history.length;
    return len >= 2 ? this.history[len - 2] : '/home';
  }
}
