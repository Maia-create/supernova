import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, inject, signal, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { forkJoin, of, catchError } from 'rxjs';
import { Educata, Product } from '../educata/educata';
import { AuthService } from '../shared/services/auth.service';
import { CartService } from '../shared/services/cart.service';
import { NavigationService } from '../shared/services/navigation.service';

interface CartDisplayItem {
  productId: string;
  quantity: number;
  product: Product | null;
  loading: boolean;
}

@Component({
  selector: 'app-cart',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart implements OnInit, AfterViewInit {
  @ViewChild('cartItemsEl') private cartItemsRef!: ElementRef<HTMLElement>;
  @ViewChild('summaryCardEl') private summaryCardRef!: ElementRef<HTMLElement>;
  @ViewChild('orbItems')   private orbItemsRef!:   ElementRef<HTMLElement>;
  @ViewChild('orbSummary') private orbSummaryRef!: ElementRef<HTMLElement>;
  private router  = inject(Router);
  private api     = inject(Educata);
  protected auth  = inject(AuthService);
  protected cartSvc = inject(CartService);
  private navSvc  = inject(NavigationService);

  protected goBack(): void { this.router.navigateByUrl(this.navSvc.getPreviousUrl()); }

  protected items           = signal<CartDisplayItem[]>([]);
  protected checkoutLoading = signal(false);
  protected checkoutSuccess = signal(false);
  protected checkoutError   = signal('');
  protected actionError     = signal('');

  private orbsInitialized = false;

  constructor() {
    effect(() => {
      const cart = this.cartSvc.cart();
      if (!cart) return;
      this.buildDisplayItems(cart.products);
      // re-init orbs after items render
      this.orbsInitialized = false;
      setTimeout(() => this.initOrbs(), 200);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initOrbs(), 300);
  }

  private initOrbs(): void {
    if (this.orbsInitialized) return;
    const ok1 = this.applyOrb(this.cartItemsRef, this.orbItemsRef, 16, 9);
    const ok2 = this.applyOrb(this.summaryCardRef, this.orbSummaryRef, 18, 5);
    if (ok1 || ok2) this.orbsInitialized = true;
  }

  private applyOrb(
    cardRef: ElementRef<HTMLElement> | undefined,
    orbRef:  ElementRef<HTMLElement> | undefined,
    r: number, duration: number
  ): boolean {
    const card = cardRef?.nativeElement;
    const orb  = orbRef?.nativeElement;
    if (!card || !orb) return false;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    if (!w || !h) return false;
    const path =
      `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} ` +
      `L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} ` +
      `L ${r} ${h} Q 0 ${h} 0 ${h - r} ` +
      `L 0 ${r} Q 0 0 ${r} 0 Z`;
    orb.style.offsetPath = `path('${path}')`;
    orb.style.animationDuration = `${duration}s`;
    orb.style.visibility = 'visible';
    return true;
  }

  ngOnInit(): void {
    // auth is guaranteed by authGuard in routes
    this.cartSvc.load();
  }

  private buildDisplayItems(products: { productId?: string; id?: string; quantity: number }[]): void {
    if (products.length === 0) { this.items.set([]); return; }

    const ids = products.map(p => p.productId ?? p.id ?? '');

    // loading state სანამ request-ები სრულდება
    this.items.set(ids.map((id, i) => ({
      productId: id, quantity: products[i].quantity, product: null, loading: true,
    })));

    // ყველა request პარალელურად — ერთი round-trip
    forkJoin(ids.map(id => this.api.getProductById(id).pipe(catchError(() => of(null))))).subscribe(results => {
      this.items.set(ids.map((id, i) => ({
        productId: id, quantity: products[i].quantity, product: results[i], loading: false,
      })));
    });
  }

  protected increase(productId: string): void {
    this.cartSvc.increase(productId).subscribe({
      error: () => this.showActionError('Failed to update quantity.'),
    });
  }

  protected decrease(productId: string): void {
    this.cartSvc.decrease(productId).subscribe({
      error: () => this.showActionError('Failed to update quantity.'),
    });
  }

  protected remove(productId: string): void {
    this.cartSvc.remove(productId).subscribe({
      error: () => this.showActionError('Failed to remove item.'),
    });
  }

  protected onCheckout(): void {
    this.checkoutLoading.set(true);
    this.checkoutError.set('');
    this.cartSvc.checkout().subscribe({
      next: () => { this.checkoutLoading.set(false); this.checkoutSuccess.set(true); },
      error: (err) => {
        this.checkoutLoading.set(false);
        this.checkoutError.set(err?.error?.message ?? 'Checkout failed. Please try again.');
      },
    });
  }

  protected onClear(): void {
    this.cartSvc.clear().subscribe({
      error: () => this.showActionError('Failed to clear cart.'),
    });
  }

  private showActionError(msg: string): void {
    this.actionError.set(msg);
    setTimeout(() => this.actionError.set(''), 3000);
  }
}
