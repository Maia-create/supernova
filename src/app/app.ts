import { Component, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CursorService } from './shared/services/cursor.service';
import { AuthService } from './shared/services/auth.service';
import { CartService } from './shared/services/cart.service';
import { NavigationService } from './shared/services/navigation.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private cursor = inject(CursorService);
  private auth   = inject(AuthService);
  private cart   = inject(CartService);
  
  private nav    = inject(NavigationService);

  constructor() {
    afterNextRender(() => {
      this.cursor.init();
      this.auth.init(() => {
        if (this.auth.isLoggedIn()) {
          this.cart.load();
        }
      });
    });
  }
}
