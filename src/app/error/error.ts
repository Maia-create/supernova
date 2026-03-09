import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-error',
  imports: [RouterLink],
  templateUrl: './error.html',
  styleUrl: './error.css',
})
export class Error implements AfterViewInit, OnDestroy {
  @ViewChild('spaceCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private animFrameId?: number;
  private resizeHandler?: () => void;
  private shootInterval?: ReturnType<typeof setInterval>;

  ngAfterViewInit(): void {
    this.initCanvas();
  }

  ngOnDestroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.shootInterval) clearInterval(this.shootInterval);
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx    = canvas.getContext('2d')!;
    let W = 0, H = 0;

    this.resizeHandler = () => { W = canvas.width = innerWidth; H = canvas.height = innerHeight; };
    window.addEventListener('resize', this.resizeHandler);
    this.resizeHandler();

    const stars = Array.from({ length: 280 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.2,
      a: Math.random() * 0.8 + 0.1,
      pulse: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.008 + 0.003,
      hue: Math.random() < 0.15 ? 270 : 0,
    }));

    let shoots: any[] = [];
    const newShoot = () => {
      const angle = (Math.random() * 30 + 15) * Math.PI / 180;
      return { x: Math.random() * W * 0.8, y: Math.random() * H * 0.3, len: Math.random() * 180 + 80, speed: Math.random() * 8 + 6, dx: Math.cos(angle), dy: Math.sin(angle), life: 1, decay: Math.random() * 0.018 + 0.012 };
    };
    this.shootInterval = setInterval(() => { if (shoots.length < 3) shoots.push(newShoot()); }, 2200);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      stars.forEach(s => {
        s.pulse += s.speed;
        const alpha = s.a * (0.6 + 0.4 * Math.sin(s.pulse));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.hue === 0 ? `rgba(255,255,255,${alpha})` : `hsla(${270 + s.hue},80%,80%,${alpha})`;
        ctx.fill();
      });
      shoots = shoots.filter(s => s.life > 0);
      shoots.forEach(s => {
        const x2 = s.x - s.dx * s.len, y2 = s.y - s.dy * s.len;
        const g = ctx.createLinearGradient(s.x, s.y, x2, y2);
        g.addColorStop(0, `rgba(199,125,255,${s.life * 0.9})`);
        g.addColorStop(0.3, `rgba(255,255,255,${s.life * 0.6})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(x2, y2);
        ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.stroke();
        s.x += s.dx * s.speed; s.y += s.dy * s.speed; s.life -= s.decay;
      });
      this.animFrameId = requestAnimationFrame(draw);
    };
    draw();
  }
}
