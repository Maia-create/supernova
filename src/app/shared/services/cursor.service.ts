import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CursorService {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const cur  = document.getElementById('cursor');
    const ring = document.getElementById('cursorRing');
    if (!cur || !ring) return;

    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

    const animate = () => {
      cur.style.left = mx + 'px';
      cur.style.top  = my + 'px';
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      ring.style.left = rx + 'px';
      ring.style.top  = ry + 'px';
      requestAnimationFrame(animate);
    };
    animate();

    
    document.addEventListener('mouseover', e => {
      if ((e.target as HTMLElement).closest('a, button')) {
        cur.style.width  = '18px'; cur.style.height  = '18px';
        ring.style.width = '50px'; ring.style.height = '50px';
      }
    });
    document.addEventListener('mouseout', e => {
      if ((e.target as HTMLElement).closest('a, button')) {
        cur.style.width  = ''; cur.style.height  = '';
        ring.style.width = ''; ring.style.height = '';
      }
    });
  }
}
