import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, inject, signal, computed, effect,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Educata, Product, Category } from '../educata/educata';
import { AuthService } from '../shared/services/auth.service';
import { CartService } from '../shared/services/cart.service';

@Component({
  selector: 'app-products',
  imports: [RouterLink, DecimalPipe, SlicePipe, FormsModule],
  templateUrl: './products.html',
  styleUrl: './products.css',
})
export class Products implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('navTrack')  private navTrackRef!:  ElementRef<HTMLElement>;
  @ViewChild('cartBtn')   private cartBtnRef!:   ElementRef<HTMLElement>;

  protected router = inject(Router);
  protected get currentUrl() { return this.router.url; }
  private api    = inject(Educata);
  protected auth = inject(AuthService);
  protected cart = inject(CartService);

  protected products    = signal<Product[]>([]);
  protected total       = signal(0);
  protected loading     = signal(false);
  protected currentPage = signal(1);

  protected categories = signal<Category[]>([]);
  protected brands     = signal<string[]>([]);

  // API-level filters (trigger re-fetch)
  protected selectedCatId  = signal('');
  protected selectedBrand  = signal('');
  protected searchModel    = '';          // [(ngModel)] two-way binding
  protected searchQuery    = signal('');  // debounced signal

  // Client-side filters (applied on loaded page)
  protected maxPriceInput = '';
  protected minPriceInput = '';
  protected maxPrice      = signal<number | null>(null);
  protected minPrice      = signal<number | null>(null);
  protected minRating     = signal<number | null>(null);
  protected lastPriceMax  = signal(0);

  protected addedSet  = signal<Set<string>>(new Set());
  // per-product active image index
  protected thumbMap  = signal<Map<string, number>>(new Map());
  readonly PAGE_SIZE = 8;

  protected totalPages = computed(() => {
    if (this.hasClientFilter()) return Math.ceil(this.filteredProducts().length / this.PAGE_SIZE) || 1;
    return Math.ceil(this.total() / this.PAGE_SIZE) || 1;
  });

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

  protected filteredProducts = computed(() => {
    let list = this.products();
    const maxP  = this.maxPrice();
    const minP  = this.minPrice();
    const minR  = this.minRating();
    const cat   = this.selectedCatId();
    const brand = this.selectedBrand();
    const q     = this.searchQuery();
    // cross-filter: search+cat → filter by category client-side
    if (q && cat)        list = list.filter(p => String((p.category as any)?.id ?? p.category) === String(cat));
    // cross-filter: search+brand → filter by brand client-side
    if (q && brand)      list = list.filter(p => (p.brand ?? '').toLowerCase() === brand.toLowerCase());
    // cross-filter: cat+brand → fetch was by category, filter brand client-side
    if (!q && cat && brand) list = list.filter(p => (p.brand ?? '').toLowerCase() === brand.toLowerCase());
    if (maxP !== null)   list = list.filter(p => (p.price.current ?? 0) <= maxP);
    if (minP !== null)   list = list.filter(p => (p.price.current ?? 0) >= minP);
    if (minR  !== null)  list = list.filter(p => (p.rating ?? 0) >= minR);
    return list;
  });

  protected hasActiveFilter = computed(() =>
    !!(this.selectedCatId() || this.selectedBrand() || this.searchQuery() ||
       this.maxPrice() !== null || this.minPrice() !== null || this.minRating() !== null)
  );

  protected hasClientFilter = computed(() =>
    this.maxPrice() !== null || this.minPrice() !== null || this.minRating() !== null ||
    !!(this.searchQuery() && (this.selectedCatId() || this.selectedBrand())) ||
    !!(this.selectedCatId() && this.selectedBrand())
  );

  protected selectedCatName = computed(() =>
    this.categories().find(c => c.id === this.selectedCatId())?.name ?? ''
  );

  constructor() {
    effect(() => {
      this.fetchProducts(
        this.currentPage(),
        this.selectedCatId(),
        this.selectedBrand(),
        this.searchQuery(),
        this.hasClientFilter(),
      );
    });
  }

  ngOnInit(): void {
    this.api.getCategories().subscribe({ next: cats => this.categories.set(cats ?? []) });
    this.api.getBrands().subscribe({ next: bs => this.brands.set(bs ?? []) });
  }

  ngAfterViewInit(): void { this.initNavScroll(); }

  // ── Helpers ────────────────────────────────────────────────────────────────

  protected getPrice(p: Product): number    { return p.price?.current ?? 0; }
  protected getOldPrice(p: Product): number { return p.price?.beforeDiscount ?? 0; }

  protected getDiscount(p: Product): number {
    const cur = p.price?.current ?? 0;
    const old = p.price?.beforeDiscount ?? 0;
    if (!old || old <= cur) return 0;
    return Math.round((1 - cur / old) * 100);
  }

  protected isOos(p: Product): boolean { return (p.stock ?? 0) <= 0; }

  protected pid(p: Product): string { return p._id ?? p.id ?? ''; }

  protected starsArray(r: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < Math.round(r));
  }

  protected catName(cat: ProductCategory | string | null): string {
    if (!cat) return '';
    if (typeof cat === 'string') return cat;
    return (cat as any).name ?? '';
  }

  // ── Image helpers ─────────────────────────────────────────────────────────

  protected cardImages(p: Product): string[] {
    const all = [p.thumbnail, ...(p.images ?? [])].filter(Boolean);
    return all.length ? all.slice(0, 4) : ['/placeholder.gif'];
  }

  protected activeImg(p: Product): string {
    const id  = this.pid(p);
    const idx = this.thumbMap().get(id) ?? 0;
    return this.cardImages(p)[idx] ?? p.thumbnail ?? '/placeholder.gif';
  }

  protected setThumb(event: Event, p: Product, i: number): void {
    event.stopPropagation();
    const m = new Map(this.thumbMap()); m.set(this.pid(p), i); this.thumbMap.set(m);
  }

  // hover-triggered cycling — one timer per hovered card
  private hoverTimer: ReturnType<typeof setInterval> | null = null;

  protected onCardEnter(p: Product): void {
    const imgs = this.cardImages(p);
    if (imgs.length <= 1) return;
    const id = this.pid(p);
    this.hoverTimer = setInterval(() => {
      const m   = new Map(this.thumbMap());
      const cur = m.get(id) ?? 0;
      m.set(id, (cur + 1) % imgs.length);
      this.thumbMap.set(m);
    }, 900);
  }

  protected onCardLeave(p: Product): void {
    if (this.hoverTimer) { clearInterval(this.hoverTimer); this.hoverTimer = null; }
    // reset to first image
    const m = new Map(this.thumbMap());
    m.set(this.pid(p), 0);
    this.thumbMap.set(m);
  }

  private stopCycles(): void {
    if (this.hoverTimer) { clearInterval(this.hoverTimer); this.hoverTimer = null; }
  }

  ngOnDestroy(): void { this.stopCycles(); }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  private fetchProducts(page: number, catId: string, brand: string, search: string, allPages = false): void {
    this.loading.set(true);
    this.products.set([]);

    const p    = allPages ? 1  : page;
    const size = allPages ? 50 : this.PAGE_SIZE;

    const req$ = search && catId  ? this.api.searchProducts(search, p, size)
               : search && brand  ? this.api.searchProducts(search, p, size)
               : search           ? this.api.searchProducts(search, p, size)
               : catId            ? this.api.getProductsByCategory(catId, p, size)
               : brand            ? this.api.getProductsByBrand(brand, p, size)
               :                    this.api.getAllProducts(p, size);

    req$.subscribe({
      next: (res: { products: Product[]; total: number }) => {
        const prods = res.products ?? [];
        this.products.set(prods);
        this.total.set(res.total ?? 0);
        this.thumbMap.set(new Map());
        const prices = prods.map((p: Product) => p.price?.current ?? 0).filter((v: number) => v > 0);
        if (prices.length) this.lastPriceMax.set(Math.ceil(Math.max(...prices)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ── Filter handlers ────────────────────────────────────────────────────────

  protected onSearch(val: string): void {
    this.searchQuery.set(val);
    this.currentPage.set(1);
  }

  protected onCatChange(id: string): void {
    this.selectedCatId.set(id);
    this.currentPage.set(1);
  }

  protected onBrandChange(brand: string): void {
    this.selectedBrand.set(brand);
    this.currentPage.set(1);
  }

  protected applyMaxPrice(): void {
    const n = parseFloat(this.maxPriceInput);
    this.maxPrice.set(isNaN(n) || n <= 0 ? null : n);
    this.currentPage.set(1);
  }

  protected clearMaxPrice(): void { this.maxPriceInput = ''; this.maxPrice.set(null); this.currentPage.set(1); }

  protected applyMinPrice(): void {
    const n = parseFloat(this.minPriceInput);
    this.minPrice.set(isNaN(n) || n < 0 ? null : n);
    this.currentPage.set(1);
  }

  protected clearMinPrice(): void { this.minPriceInput = ''; this.minPrice.set(null); this.currentPage.set(1); }

  protected onMinRatingChange(v: number): void {
    this.minRating.set(this.minRating() === v ? null : v);
    this.currentPage.set(1);
  }

  protected resetFilters(): void {
    this.selectedCatId.set(''); this.selectedBrand.set('');
    this.searchQuery.set(''); this.searchModel = '';
    this.maxPriceInput = ''; this.maxPrice.set(null);
    this.minPriceInput = ''; this.minPrice.set(null);
    this.minRating.set(null);
    this.currentPage.set(1);
  }

  // ── Pagination ─────────────────────────────────────────────────────────────

  protected goToPage(p: number | '...'): void {
    if (p === '...') return;
    this.currentPage.set(p as number);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  protected prevPage(): void { if (this.currentPage() > 1) this.currentPage.update(p => p - 1); }
  protected nextPage(): void { if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1); }

  // ── Cart ────────────────────────────────────────────────────────────────────

  protected goToDetails(p: Product): void {
    this.router.navigate(['/details', this.pid(p)]);
  }

  protected addToCart(event: Event, product: Product): void {
    event.stopPropagation();
    if (!this.auth.isLoggedIn()) { this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url, backUrl: this.router.url } }); return; }
    if (this.isOos(product)) return;
    this.cart.add(this.pid(product)).subscribe();
    const s = new Set(this.addedSet()); s.add(this.pid(product));
    this.addedSet.set(s);
    setTimeout(() => {
      const s2 = new Set(this.addedSet()); s2.delete(this.pid(product));
      this.addedSet.set(s2);
    }, 1400);

    // shake the cart icon
    const btn = this.cartBtnRef?.nativeElement;
    if (btn) {
      btn.classList.remove('cart-shake');
      void btn.offsetWidth; // reflow to restart animation
      btn.classList.add('cart-shake');
      setTimeout(() => btn.classList.remove('cart-shake'), 600);
    }
  }

  protected isAdded(p: Product): boolean { return this.addedSet().has(this.pid(p)); }

  // ── Nav scroll ──────────────────────────────────────────────────────────────

  private initNavScroll(): void {
    const track = this.navTrackRef?.nativeElement;
    if (!track) return;
    const orig = track.querySelector('nav')!;
    const w    = orig.offsetWidth;
    if (!w) return;
    track.querySelectorAll('nav[aria-hidden]').forEach(n => n.remove());
    const n = Math.ceil((window.innerWidth * 3) / w) + 2;
    for (let i = 0; i < n; i++) {
      const c = orig.cloneNode(true) as HTMLElement;
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    }
    // event delegation — Angular router გამოიყენება clone-ებზეც
    track.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (!a) return;
      const rl = a.getAttribute('routerLink') ?? a.getAttribute('ng-reflect-router-link');
      if (!rl) return;
      e.preventDefault();
      this.router.navigate([rl]);
    });
    const dur = (w / 60).toFixed(1);
    const s   = document.createElement('style');
    s.textContent = `
      .products-nav-track { animation: nav-sp ${dur}s linear infinite !important; }
      .products-nav-track.paused { animation-play-state: paused !important; }
      @keyframes nav-sp { from{transform:translateX(0)} to{transform:translateX(-${w}px)} }
    `;
    document.head.appendChild(s);
    track.classList.add('products-nav-track');
    track.addEventListener('mouseenter', () => track.classList.add('paused'));
    track.addEventListener('mouseleave', () => track.classList.remove('paused'));
  }
}

// local alias so catName() type-checks
interface ProductCategory { id: string; name: string; }
