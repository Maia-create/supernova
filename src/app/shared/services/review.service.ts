import { Injectable } from '@angular/core';

export interface Review {
  name: string;
  stars: number;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewService {
  avgRating(reviews: Review[]): number {
    if (!reviews.length) return 0;
    return reviews.reduce((s, r) => s + r.stars, 0) / reviews.length;
  }

  starBars(reviews: Review[]): { stars: number; pct: number; count: number }[] {
    return [5, 4, 3, 2, 1].map(s => {
      const count = reviews.filter(r => r.stars === s).length;
      const pct   = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
      return { stars: s, pct, count };
    });
  }

  starsArray(n: number, total = 5): boolean[] {
    return Array.from({ length: total }, (_, i) => i < Math.round(n));
  }
}
