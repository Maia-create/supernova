import { Injectable, inject, signal, computed } from '@angular/core';
import { catchError, EMPTY, Observable, of, tap, throwError } from 'rxjs';
import { Educata, Cart } from '../../educata/educata';
import { Cookies } from '../utils/cookie.util';

@Injectable({ providedIn: 'root' })
export class CartService {
  private api = inject(Educata);

  readonly cart    = signal<Cart | null>(null);
  readonly loading = signal(false);

  
  private serverHasCart = signal(false);

  readonly count = computed(() =>
    this.cart()?.total?.quantity ?? 0
  );
  readonly hasItems = computed(() => this.count() > 0);
  readonly label    = computed(() => {
    const n = this.count();
    return n > 9 ? '9+' : n > 0 ? String(n) : '';
  });
  readonly total = computed(() =>
    this.cart()?.total?.price?.current ?? 0
  );
  readonly cartItems = computed(() => this.cart()?.products ?? []);

  private hasToken(): boolean {
    return !!Cookies.get('access_token');
  }

 
  private normalize(c: Cart): Cart {
    return {
      ...c,
      products: c.products.map(p => ({
        ...p,
        productId: p.productId ?? p.id ?? '',
      })),
    };
  }

  load(): void {
    if (!this.hasToken()) return;
    if (this.loading()) return;
    this.loading.set(true);

    this.api.getCart().pipe(
      tap(c => {
        this.cart.set(this.normalize(c));
        this.serverHasCart.set(true);
        this.loading.set(false);
      }),
      catchError(err => {
        const notFound = err?.status === 404;
        this.serverHasCart.set(!notFound);
        this.cart.set({ products: [], total: { quantity: 0, price: { current: 0 } } });
        this.loading.set(false);
        return of(null);
      })
    ).subscribe();
  }

  add(productId: string, quantity = 1): Observable<Cart> {
    if (!this.hasToken()) return EMPTY;
    
    return new Observable<Cart>(observer => {
      this.api.getCart().pipe(
        catchError(() => of(null))
      ).subscribe(currentCart => {
        const cartExists = currentCart !== null;
        const existing   = currentCart?.products?.find(
          (p: any) => (p.productId ?? p.id) === productId
        );
        const existingQty = existing?.quantity ?? 0;
        const newQty      = existingQty + quantity;

        const call = cartExists
          ? this.api.updateCartProduct(productId, newQty)
          : this.api.addProductToCart(productId, quantity);

        call.pipe(
          tap(c => {
            this.cart.set(this.normalize(c));
            this.serverHasCart.set(true);
          }),
          catchError(err => {
            observer.error(err);
            return EMPTY;
          })
        ).subscribe({
          next: c => { observer.next(c); observer.complete(); },
          error: e => observer.error(e),
        });
      });
    });
  }

  increase(productId: string): Observable<Cart> {
    const existing = this.cartItems().find(i => i.productId === productId);
    const newQty   = (existing?.quantity ?? 0) + 1;
    return this.api.updateCartProduct(productId, newQty).pipe(
      tap(c => this.cart.set(this.normalize(c))),
      catchError(err => throwError(() => err))
    );
  }

  decrease(productId: string): Observable<Cart> {
    const existing = this.cartItems().find(i => i.productId === productId);
    if (!existing) return EMPTY;
    if (existing.quantity <= 1) return this.remove(productId);
    return this.api.updateCartProduct(productId, existing.quantity - 1).pipe(
      tap(c => this.cart.set(this.normalize(c))),
      catchError(err => throwError(() => err))
    );
  }

  remove(productId: string): Observable<Cart> {
    return this.api.removeCartProduct(productId).pipe(
      tap(c => this.cart.set(this.normalize(c))),
      catchError(err => throwError(() => err))
    );
  }

  clear(): Observable<void> {
    return this.api.clearCart().pipe(
      tap(() => this.cart.set({ products: [], total: { quantity: 0, price: { current: 0 } } })),
      catchError(err => throwError(() => err))
    );
  }

  checkout(): Observable<void> {
    return this.api.checkout().pipe(
      tap(() => this.cart.set({ products: [], total: { quantity: 0, price: { current: 0 } } })),
      catchError(err => throwError(() => err))
    );
  }
}
