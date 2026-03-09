import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, filter, take, timeout, catchError } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const check = () => {
    if (auth.isLoggedIn()) return true;

   
    const nav = router.getCurrentNavigation();
    const fromUrl = nav?.previousNavigation?.finalUrl?.toString() ?? null;

  
    const params: any = { returnUrl: state.url };
    if (fromUrl && !fromUrl.startsWith('/auth') && fromUrl !== state.url) {
      params.backUrl = fromUrl;
    }

    router.navigate(['/auth'], { queryParams: params });
    return false;
  };

  if (auth.loading()) {
    return toObservable(auth.loading).pipe(
      filter(l => !l), take(1),
      timeout(3000), catchError(() => of(false)),
      map(() => check())
    );
  }

  return check();
};
