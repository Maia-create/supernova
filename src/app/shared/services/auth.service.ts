import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { tap, catchError, switchMap, EMPTY } from 'rxjs';
import { Educata, UserInfo, AuthTokens } from '../../educata/educata';
import { Cookies } from '../utils/cookie.util';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api    = inject(Educata);
  private router = inject(Router);

  readonly user       = signal<UserInfo | null>(null);
  readonly loading    = signal(false);
  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly userName   = computed(() => {
    const u = this.user();
    return u ? `${u.firstName} ${u.lastName}` : null;
  });

  
  saveTokens(tokens: AuthTokens): void {
    Cookies.set('access_token',  tokens.access_token,  7);
    Cookies.set('refresh_token', tokens.refresh_token, 7);
  }

  clearTokens(): void {
    Cookies.delete('access_token');
    Cookies.delete('refresh_token');
  }

  hasToken(): boolean {
    return !!Cookies.get('access_token');
  }

  
  init(onReady?: () => void): void {
    if (!this.hasToken()) { onReady?.(); return; }
    this.loading.set(true);
    this.api.getUser().pipe(
      tap(u => {
        this.user.set(u);
        this.loading.set(false);
        onReady?.();
      }),
      catchError(() => {
        this.clearTokens();
        this.loading.set(false);
        onReady?.();
        return EMPTY;
      })
    ).subscribe();
  }

  
  signIn(email: string, password: string) {
    return this.api.signIn({ email, password }).pipe(
      tap(tokens => this.saveTokens(tokens)),
      switchMap(() => this.api.getUser()),
      tap(u => this.user.set(u)),
    );
  }

  
  signUp(payload: Parameters<Educata['signUp']>[0]) {
    return this.api.signUp(payload);
  }

  
  signOut(): void {
    this.clearTokens();
    this.user.set(null);
    this.router.navigate(['/home']);
    this.api.signOut().pipe(catchError(() => EMPTY)).subscribe();
  }
}
