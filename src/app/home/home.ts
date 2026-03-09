import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, computed } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements AfterViewInit, OnDestroy {
  @ViewChild('navTrack') private navTrackRef!: ElementRef<HTMLElement>;

  protected auth   = inject(AuthService);
  private   router = inject(Router);

  protected authLabel = computed(() =>
    this.auth.isLoggedIn() ? 'Profile' : 'Sign In'
  );

  ngAfterViewInit(): void {
    this.initNavScroll();
  }

  private navInterval: any = null;
  private navEnter?: () => void;
  private navLeave?: () => void;

  ngOnDestroy(): void {
    document.getElementById('home-nav-style')?.remove();
    if (this.navInterval) clearInterval(this.navInterval);
    const track = this.navTrackRef?.nativeElement;
    if (track && this.navEnter) track.removeEventListener('mouseenter', this.navEnter);
    if (track && this.navLeave) track.removeEventListener('mouseleave', this.navLeave);
  }

  private initNavScroll(): void {
    if (!this.navTrackRef) return;
    const navTrack = this.navTrackRef.nativeElement;
    if (!navTrack) return;

    const original = navTrack.querySelector('nav')!;
    const oneWidth = original.offsetWidth;
    if (!oneWidth) return;

    const needed = Math.ceil((window.innerWidth * 3) / oneWidth) + 2;
    for (let i = 0; i < needed; i++) {
      const clone = original.cloneNode(true) as HTMLElement;
      clone.setAttribute('aria-hidden', 'true');
      navTrack.appendChild(clone);
    }

    // Event delegation — works on original + all clones
    navTrack.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();

      if (target.classList.contains('nav-auth-item')) {
        if (this.auth.isLoggedIn()) {
          this.router.navigate(['/profile']);
        } else {
          this.router.navigate(['/auth'], { queryParams: { returnUrl: '/home', backUrl: '/home' } });
        }
        return;
      }

      // ყველა სხვა routerLink clone-ზე
      const rl = target.getAttribute('routerLink') ?? target.getAttribute('ng-reflect-router-link');
      if (rl) this.router.navigate([rl]);
    });

    // Keep text in sync across all clones
    const updateLabels = () => {
      const label = this.auth.isLoggedIn() ? 'Profile' : 'Sign In';
      navTrack.querySelectorAll('.nav-auth-item').forEach(el => {
        (el as HTMLElement).textContent = label;
      });
    };
    updateLabels();
    this.navInterval = setInterval(updateLabels, 500);

    document.getElementById('home-nav-style')?.remove();
    const duration = (oneWidth / 55).toFixed(1);
    const style = document.createElement('style');
    style.id = 'home-nav-style';
    style.textContent = `
      .home-nav-track { animation: nav-loop-home ${duration}s linear infinite !important; }
      .home-nav-track.paused { animation-play-state: paused !important; }
      @keyframes nav-loop-home {
        from { transform: translateX(0); }
        to   { transform: translateX(-${oneWidth}px); }
      }
      .nav-auth-item { cursor: pointer; }
    `;
    document.head.appendChild(style);
    navTrack.classList.add('home-nav-track');
    this.navEnter = () => navTrack.classList.add('paused');
    this.navLeave = () => navTrack.classList.remove('paused');
    navTrack.addEventListener('mouseenter', this.navEnter);
    navTrack.addEventListener('mouseleave', this.navLeave);
  }
}
