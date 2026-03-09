import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, signal, computed, inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { Educata, Product } from '../educata/educata';
import { AuthService } from '../shared/services/auth.service';
import { CartService } from '../shared/services/cart.service';
import { NavigationService } from '../shared/services/navigation.service';

@Component({
  selector: 'app-details',
  imports: [RouterLink, DecimalPipe, SlicePipe],
  templateUrl: './details.html',
  styleUrl: './details.css',
})
export class Details implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasEl') private canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('orbScene') private orbRef!: ElementRef<HTMLElement>;
  @ViewChild('mainImg') private mainImgRef!: ElementRef<HTMLImageElement>;
  @ViewChild('cartBtn') private cartBtnRef!: ElementRef<HTMLElement>;

  private route  = inject(ActivatedRoute);
  protected router = inject(Router);
  protected get currentUrl() { return this.router.url; }
  private api    = inject(Educata);
  protected auth = inject(AuthService);
  protected cart = inject(CartService);
  private navSvc = inject(NavigationService);

  protected product     = signal<Product | null>(null);
  protected loading     = signal(true);
  protected addedToCart = signal(false);
  protected activeThumb = signal(0);
  protected activeImage = computed(() => {
    const p = this.product();
    if (!p) return '';
    const imgs = [p.thumbnail, ...p.images];
    return imgs[this.activeThumb()] ?? p.thumbnail;
  });

  protected starsArray = computed(() => {
    const r = this.product()?.rating ?? 0;
    return Array.from({ length: 5 }, (_, i) => i < Math.round(r));
  });

  private mouseMoveHandler?: (e: MouseEvent) => void;
  private animFrameId?: number;
  private autoplayTimer?: ReturnType<typeof setInterval>;
  private autoplayPaused = false;
  private canvasResizeHandler?: () => void;
  private canvasMoveHandler?: (e: MouseEvent) => void;
  private shootInterval?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!id) { this.router.navigate(['/products']); return; }

    this.api.getProductById(id).subscribe({
      next: p => {
        this.product.set(p);
        this.loading.set(false);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.querySelectorAll('.pi').forEach(el => el.classList.add('show'));
        }));
        setTimeout(() => this.startAutoplay(p), 1200);
      },
      error: () => this.router.navigate(['/products']),
    });
  }

  ngAfterViewInit(): void {
    this.initCanvas();
    this.initOrbTilt();
  }

  ngOnDestroy(): void {
    if (this.mouseMoveHandler) window.removeEventListener('mousemove', this.mouseMoveHandler);
    if (this.canvasMoveHandler) window.removeEventListener('mousemove', this.canvasMoveHandler);
    if (this.canvasResizeHandler) window.removeEventListener('resize', this.canvasResizeHandler);
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.autoplayTimer) clearInterval(this.autoplayTimer);
    if (this.shootInterval) clearInterval(this.shootInterval);
  }

  protected goBack(): void {
    this.router.navigateByUrl(this.navSvc.getPreviousUrl());
  }

  protected addToCart(): void {
    if (!this.auth.isLoggedIn()) { this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url, backUrl: this.router.url } }); return; }
    const p = this.product();
    if (!p) return;
    this.cart.add(p._id).subscribe();
    this.addedToCart.set(true);
    setTimeout(() => this.addedToCart.set(false), 1600);
    // shake the cart icon
    const btn = this.cartBtnRef?.nativeElement;
    if (btn) {
      btn.classList.remove('cart-shake');
      void btn.offsetWidth;
      btn.classList.add('cart-shake');
      setTimeout(() => btn.classList.remove('cart-shake'), 600);
    }
  }

  protected setThumb(i: number): void {
    this.activeThumb.set(i);
    // Pause autoplay for 6s after manual interaction
    this.autoplayPaused = true;
    setTimeout(() => { this.autoplayPaused = false; }, 6000);
  }

  protected goToRate(): void {
    const p = this.product();
    if (!p) return;
    this.router.navigate(['/rate'], { queryParams: { id: p._id } });
  }

  private startAutoplay(p: any): void {
    const imgs = [p.thumbnail, ...p.images].slice(0, 4);
    if (imgs.length <= 1) return;

    this.autoplayTimer = setInterval(() => {
      if (this.autoplayPaused) return;
      const img = this.mainImgRef?.nativeElement;
      if (img) img.classList.add('fading');
      setTimeout(() => {
        this.activeThumb.update(i => (i + 1) % imgs.length);
        if (img) img.classList.remove('fading');
      }, 400);
    }, 3200);
  }

  private initOrbTilt(): void {
    const orb = this.orbRef?.nativeElement;
    if (!orb) return;
    orb.style.transformStyle = 'preserve-3d';
    orb.style.transition = 'transform .2s ease';
    this.mouseMoveHandler = (e: MouseEvent) => {
      const rx = (e.clientY / innerHeight - .5) * 12;
      const ry = (e.clientX / innerWidth  - .5) * -12;
      orb.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    window.addEventListener('mousemove', this.mouseMoveHandler);
  }

  private initCanvas(): void {
    const cv  = this.canvasRef?.nativeElement;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    let W = 0, H = 0, mx = .5, my = .5;

    const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
    this.canvasResizeHandler = resize;
    window.addEventListener('resize', resize);
    resize();
    this.canvasMoveHandler = (e: MouseEvent) => { mx = e.clientX / W; my = e.clientY / H; };
    window.addEventListener('mousemove', this.canvasMoveHandler);

    const stars = Array.from({ length: 260 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.3 + .2, a: Math.random() * .7 + .15,
      ph: Math.random() * Math.PI * 2, sp: Math.random() * .007 + .003,
      px: (Math.random() - .5) * .018, py: (Math.random() - .5) * .018,
      hue: Math.random() < .12 ? 1 : 0,
    }));
    let shoots: any[] = [];
    this.shootInterval = setInterval(() => {
      if (shoots.length < 2) {
        const a = (20 + Math.random() * 25) * Math.PI / 180;
        shoots.push({ x: Math.random() * W * .7, y: Math.random() * H * .35, len: 100 + Math.random() * 150, spd: 7 + Math.random() * 6, dx: Math.cos(a), dy: Math.sin(a), life: 1, decay: .014 + Math.random() * .01 });
      }
    }, 2800);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      stars.forEach(s => {
        s.ph += s.sp;
        const alpha = s.a * (.55 + .45 * Math.sin(s.ph));
        ctx.beginPath();
        ctx.arc(s.x * W + (mx - .5) * s.px * W, s.y * H + (my - .5) * s.py * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.hue ? `rgba(199,125,255,${alpha})` : `rgba(255,255,255,${alpha})`;
        ctx.fill();
      });
      shoots = shoots.filter(s => s.life > 0);
      shoots.forEach(s => {
        const x2 = s.x - s.dx * s.len, y2 = s.y - s.dy * s.len;
        const g = ctx.createLinearGradient(s.x, s.y, x2, y2);
        g.addColorStop(0, `rgba(199,125,255,${s.life * .9})`);
        g.addColorStop(.35, `rgba(255,255,255,${s.life * .5})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(x2, y2);
        ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.stroke();
        s.x += s.dx * s.spd; s.y += s.dy * s.spd; s.life -= s.decay;
      });
      this.animFrameId = requestAnimationFrame(draw);
    };
    draw();
  }
}
