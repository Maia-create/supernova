import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { ActivatedRoute, Router, RouterLink, NavigationEnd } from '@angular/router';
import { DecimalPipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Educata, Product, ResolvedRating } from '../educata/educata';
import { AuthService } from '../shared/services/auth.service';
import { CartService } from '../shared/services/cart.service';
import { NavigationService } from '../shared/services/navigation.service';

const RATE_PAGE_SIZE = 4;

@Component({
  selector: 'app-rate',
  imports: [RouterLink, DecimalPipe, SlicePipe, UpperCasePipe],
  templateUrl: './rate.html',
  styleUrl: './rate.css',
})
export class Rate implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('rCol0') private rCol0Ref!: ElementRef<HTMLElement>;
  @ViewChild('rCol1') private rCol1Ref!: ElementRef<HTMLElement>;
  @ViewChild('rCol2') private rCol2Ref!: ElementRef<HTMLElement>;
  private route  = inject(ActivatedRoute);
  protected router = inject(Router);
  protected get currentUrl(): string {
    const p = this.selectedProduct();
    if (this.state() === 'review' && p) return `/rate?id=${p._id ?? p.id}`;
    return this.router.url;
  }
  private api    = inject(Educata);
  protected auth = inject(AuthService);
  protected cart = inject(CartService);
  private navSvc = inject(NavigationService);

  protected state       = signal<'search' | 'review'>('search');
  protected revealed    = signal(false);
  protected searchModel = '';
  protected searchQuery = signal('');

  // ── all products (sorted by rating) ──────────────────────────────────
  protected allProducts   = signal<Product[]>([]);
  protected allLoading    = signal(true);
  protected currentPage   = signal(1);

  // ── carousel top 5 ───────────────────────────────────────────────────
  protected topProducts     = signal<Product[]>([]);
  protected carouselIdx     = signal(0);
  private autoTimer: any;

  // ── paged display ─────────────────────────────────────────────────────
  protected pagedProducts = computed(() => {
    const filtered = this.filteredProducts();
    const start = (this.currentPage() - 1) * RATE_PAGE_SIZE;
    return filtered.slice(start, start + RATE_PAGE_SIZE);
  });

  protected filteredProducts = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.allProducts();
    return this.allProducts().filter(p =>
      p.title?.toLowerCase().includes(q) ||
      this.catName(p.category).toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q)
    );
  });

  // rank in the full sorted list (1 = highest rating)
  protected globalRankMap = computed(() => {
    const map = new Map<string, number>();
    this.allProducts().forEach((p, i) => map.set(p._id, i + 1));
    return map;
  });

  protected totalPages = computed(() =>
    Math.ceil(this.filteredProducts().length / RATE_PAGE_SIZE) || 1
  );

  protected pageNumbers = computed(() => {
    const total = this.totalPages(), cur = this.currentPage();
    const pages: (number | '...')[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cur > 3) pages.push('...');
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
      if (cur < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  // ── review ────────────────────────────────────────────────────────────
  protected selectedProduct = signal<Product | null>(null);
  protected selectedStars   = signal(0);
  protected hoveredStars    = signal(0);
  protected submitLoading   = signal(false);
  protected submitSuccess   = signal(false);
  protected submitError     = signal('');
  protected reviewRevealed  = signal(false);

  protected resolvedRatings = signal<ResolvedRating[]>([]);
  protected ratingsExpanded = signal(false);
  protected ratingsLoading  = signal(false);

  protected alreadyRated = computed(() => {
    if (this.submitSuccess()) return true;
    const me = this.auth.user();
    if (!me) return false;
    return this.resolvedRatings().some(r => r.userId === me._id);
  });

  // ── cart ──────────────────────────────────────────────────────────────
  protected addedSet = signal<Set<string>>(new Set());

  protected displayRating = computed(() => this.selectedProduct()?.rating ?? 0);
  protected ratingsTotal  = computed(() => {
    const p = this.selectedProduct();
    if (!p) return 0;
    return (p.ratings?.length ?? 0) + (p.reviews?.length ?? 0);
  });
  protected starHint = computed(() =>
    ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][this.selectedStars()] ?? ''
  );

  // ── lifecycle ─────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    // orbs initialize when review opens (ViewChildren become visible)
  }

  private initReviewOrbs(): void {
    // პირველი rcol-ის reveal transition-ს დაველოდოთ, შემდეგ path ვთვალოთ
    const firstWrapper = this.rCol0Ref?.nativeElement;
    const firstRcol = firstWrapper?.querySelector('.rcol') as HTMLElement | null;

    const calculate = () => {
      [
        { cardRef: this.rCol0Ref, orbClass: 'orb-r0', dur: 14 },
        { cardRef: this.rCol1Ref, orbClass: 'orb-r1', dur: 18 },
        { cardRef: this.rCol2Ref, orbClass: 'orb-r2', dur: 12 },
      ].forEach(({ cardRef, orbClass, dur }) => {
        const wrapper = cardRef?.nativeElement;
        const rcol = wrapper?.querySelector('.rcol') as HTMLElement | null;
        const orb  = wrapper?.querySelector(`.${orbClass}`) as HTMLElement | null;
        if (!wrapper || !rcol || !orb) return;
        const offset = 3;
        const w = rcol.offsetWidth  + offset * 2;
        const h = rcol.offsetHeight + offset * 2;
        const r = 24;
        orb.style.left = `-${offset}px`;
        orb.style.top  = `-${offset}px`;
        const path =
          `M ${r} 0 L ${w-r} 0 Q ${w} 0 ${w} ${r} ` +
          `L ${w} ${h-r} Q ${w} ${h} ${w-r} ${h} ` +
          `L ${r} ${h} Q 0 ${h} 0 ${h-r} ` +
          `L 0 ${r} Q 0 0 ${r} 0 Z`;
        orb.style.offsetPath = `path('${path}')`;
        orb.style.animationDuration = `${dur}s`;
        orb.style.visibility = 'visible';
      });
    };

    if (firstRcol) {
      firstRcol.addEventListener('transitionend', calculate, { once: true });
    } else {
      setTimeout(calculate, 900);
    }
  }

  ngOnInit(): void {
    requestAnimationFrame(() => requestAnimationFrame(() => this.revealed.set(true)));
    this.loadAllProducts();

    const openById = (id: string) => {
      this.api.getProductById(id).subscribe({
        next: p => this.openReview(p),
        error: () => {}
      });
    };

    // snapshot — პირველი load და auth redirect ორივეს ემსახურება
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) { openById(id); return; }

    // NavigationEnd — route params-ის ცვლილებისთვის (auth redirect)
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      take(1)
    ).subscribe(() => {
      const latestId = this.route.snapshot.queryParamMap.get('id');
      if (latestId) openById(latestId);
    });
  }

  ngOnDestroy(): void { clearInterval(this.autoTimer); }

  // ── load all products once, sort by rating desc ───────────────────────
  private loadAllProducts(): void {
    this.allLoading.set(true);
    this.api.getAllProducts(1, 50).subscribe({
      next: res => this.finishLoad(res.products ?? []),
      error: () => this.allLoading.set(false),
    });
  }

  private finishLoad(all: Product[]): void {
    const sorted = [...all].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    this.allProducts.set(sorted);
    this.topProducts.set(sorted.slice(0, 5));
    this.allLoading.set(false);
    this.startAutoPlay();
  }

  // ── carousel ──────────────────────────────────────────────────────────
  private startAutoPlay(): void {
    clearInterval(this.autoTimer);
    this.autoTimer = setInterval(() => {
      const n = this.topProducts().length;
      if (n > 0) this.carouselIdx.set((this.carouselIdx() + 1) % n);
    }, 4000);
  }
  protected carouselPrev(): void {
    const n = this.topProducts().length;
    this.carouselIdx.set((this.carouselIdx() - 1 + n) % n);
    this.startAutoPlay();
  }
  protected carouselNext(): void {
    const n = this.topProducts().length;
    this.carouselIdx.set((this.carouselIdx() + 1) % n);
    this.startAutoPlay();
  }
  protected carouselGo(i: number): void { this.carouselIdx.set(i); this.startAutoPlay(); }

  // ── search / pagination ───────────────────────────────────────────────
  protected onSearch(val: string): void {
    this.searchModel = val; this.searchQuery.set(val); this.currentPage.set(1);
  }
  protected clearSearch(): void {
    this.searchModel = ''; this.searchQuery.set(''); this.currentPage.set(1);
  }
  protected goToPage(p: number | '...'): void {
    if (p === '...') return;
    this.currentPage.set(p as number);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  protected prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.set(this.currentPage() - 1);
  }
  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.set(this.currentPage() + 1);
  }

  // ── cart ──────────────────────────────────────────────────────────────
  protected addToCart(event: Event, p: Product): void {
    event.stopPropagation();
    if (!this.auth.isLoggedIn()) { const rUrl = `/rate?id=${p._id}`; this.router.navigate(['/auth'], { queryParams: { returnUrl: rUrl, backUrl: rUrl } }); return; }
    if (this.isOos(p)) return;
    this.cart.add(p._id).subscribe();
    const next = new Set(this.addedSet()); next.add(p._id); this.addedSet.set(next);
    setTimeout(() => { const s = new Set(this.addedSet()); s.delete(p._id); this.addedSet.set(s); }, 1400);
  }
  protected isAdded(id: string): boolean { return this.addedSet().has(id); }

  // ── review ────────────────────────────────────────────────────────────
  protected handleBack(): void {
    if (this.state() === 'review') this.backToSearch();
    else this.router.navigateByUrl(this.navSvc.getPreviousUrl());
  }

  protected openReview(p: Product): void {
    this.ratingsLoading.set(true);
    this.resolvedRatings.set([]);
    this.ratingsExpanded.set(false);
    this.selectedProduct.set(p);
    this.resetForm();
    this.state.set('review');
    this.reviewRevealed.set(false);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.reviewRevealed.set(true);
      this.initReviewOrbs();
    }));
    this.api.getProductById(p._id).subscribe({
      next: fresh => { this.selectedProduct.set(fresh); this.buildResolvedRatings(fresh); },
      error: () => { this.buildResolvedRatings(p); }
    });
  }

  protected backToSearch(): void {
    this.reviewRevealed.set(false);
    setTimeout(() => this.state.set('search'), 200);
  }

  private buildResolvedRatings(p: Product): void {
    const reviews = p.reviews ?? [];
    const ratings = p.ratings ?? [];
    const fromReviews: ResolvedRating[] = reviews.map((r: any) => ({
      userId: r.userId ?? r._id ?? '',
      rating: Number(r.rating ?? r.value ?? r.rate ?? 0),
      firstName: r.firstName, lastName: r.lastName, avatar: r.avatar,
    }));
    const userIds = ratings.map((r: any) => r.userId ?? r.user_id ?? r._id).filter(Boolean) as string[];
    if (userIds.length === 0 || !this.auth.isLoggedIn()) {
      this.resolvedRatings.set([...fromReviews, ...ratings.map((r: any) => ({
        userId: r.userId ?? r.user_id ?? r._id ?? '',
        rating: Number(r.value ?? r.rating ?? r.rate ?? 0),
      }))]);
      this.ratingsLoading.set(false);
      return;
    }
    this.fetchUsers(new Set(userIds)).then(cache => {
      this.resolvedRatings.set([...fromReviews, ...ratings.map((r: any) => {
        const uid = r.userId ?? r.user_id ?? r._id ?? '';
        const u = cache[uid];
        return { userId: uid, rating: Number(r.value ?? r.rating ?? r.rate ?? 0), firstName: u?.firstName, lastName: u?.lastName, avatar: u?.avatar };
      })]);
      this.ratingsLoading.set(false);
    });
  }

  private async fetchUsers(needed: Set<string>): Promise<Record<string, any>> {
    const cache: Record<string, any> = {};
    const me = this.auth.user();
    if (me && needed.has(me._id)) { cache[me._id] = me; needed.delete(me._id); }
    if (needed.size === 0) return cache;
    try {
      for (let page = 1; page <= 2; page++) {
        const res: any = await firstValueFrom(this.api.getAllUsers(page));
        const users: any[] = res?.users ?? res?.data ?? [];
        for (const u of users) { if (needed.has(u._id)) cache[u._id] = u; }
        if (Object.keys(cache).length >= needed.size || !users.length) break;
      }
    } catch {}
    return cache;
  }

  protected toggleRatings(): void { this.ratingsExpanded.set(!this.ratingsExpanded()); }
  protected maskId(userId: string): string { return userId ? userId.slice(0, 6) + '···' : '···'; }
  protected setStars(v: number): void { this.selectedStars.set(v); }

  protected submitReview(): void {
    if (!this.auth.isLoggedIn()) { const p = this.selectedProduct(); const rUrl = p ? `/rate?id=${p._id}` : '/rate'; this.router.navigate(['/auth'], { queryParams: { returnUrl: rUrl, backUrl: rUrl } }); return; }
    if (this.selectedStars() === 0) return;
    const p = this.selectedProduct();
    if (!p) return;
    this.submitLoading.set(true); this.submitError.set('');
    this.api.rateProduct({ productId: p._id, rate: this.selectedStars() }).subscribe({
      next: () => {
        this.submitLoading.set(false); this.submitSuccess.set(true);
        this.api.getProductById(p._id).subscribe({
          next: fresh => {
            this.selectedProduct.set(fresh);
            this.buildResolvedRatings(fresh);
            // allProducts list-ში ამ პროდუქტის rating განვაახლოთ და ხელახლა დავალაგოთ
            const updated = this.allProducts().map(item =>
              item._id === fresh._id ? fresh : item
            );
            const sorted = [...updated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
            this.allProducts.set(sorted);
            this.topProducts.set(sorted.slice(0, 5));
          },
          error: () => {}
        });
      },
      error: err => { this.submitLoading.set(false); this.submitError.set(err?.error?.message ?? 'Failed to submit.'); },
    });
  }

  protected starsArray(n: number): boolean[] { return Array.from({ length: 5 }, (_, i) => i < Math.round(n)); }
  protected catName(cat: any): string { if (!cat) return ''; return typeof cat === 'string' ? cat : (cat.name ?? ''); }
  protected getPrice(p: Product): number    { return (p as any).price?.current ?? (p as any).price ?? 0; }
  protected getOldPrice(p: Product): number { return (p as any).price?.beforeDiscount ?? 0; }
  protected getDiscount(p: Product): number {
    const cur = this.getPrice(p), old = this.getOldPrice(p);
    if (!old || old <= cur) return 0;
    return Math.round((1 - cur / old) * 100);
  }
  protected isOos(p: Product): boolean { return (p.stock ?? 0) <= 0; }
  protected stockLabel(p: Product): string {
    if (p.stock <= 0) return 'Out of Stock';
    if (p.stock <= 5) return `Only ${p.stock} left`;
    return `${p.stock} in stock`;
  }
  private resetForm(): void {
    this.selectedStars.set(0); this.hoveredStars.set(0);
    this.submitSuccess.set(false); this.submitError.set('');
  }
}
