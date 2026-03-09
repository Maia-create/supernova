import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Educata } from '../educata/educata';
import { AuthService } from '../shared/services/auth.service';
import { CartService } from '../shared/services/cart.service';
import { NavigationService } from '../shared/services/navigation.service';

type Tab = 'info' | 'update' | 'password' | 'danger';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit, AfterViewInit {
  @ViewChild('heroCard') heroCardRef!: ElementRef<HTMLElement>;

  private api    = inject(Educata);
  private router = inject(Router);
  protected auth = inject(AuthService);
  protected cart = inject(CartService);
  private navSvc = inject(NavigationService);

  protected goBack(): void { this.router.navigateByUrl(this.navSvc.getPreviousUrl()); }


  protected tab      = signal<Tab>('info');
  protected loading  = signal(false);
  protected errorMsg = signal('');
  protected successMsg = signal('');
  protected showDeleteConfirm = signal(false);

  // update fields
  protected updFirst   = '';
  protected updLast    = '';
  protected updAge     = 0;
  protected updAvatar  = '';
  protected updGender  = '';
  protected updPhone   = '';
  protected updZipcode = '';
  protected updAddress = '';

  // password fields
  protected pwdOld = '';
  protected pwdNew = '';
  protected pwdConfirm = '';
  protected showPwd = signal(false);

  ngAfterViewInit(): void {
    if (this.auth.user()) {
      // wait one frame for the card to be rendered and sized
      setTimeout(() => this.initOrbit(), 60);
    }
  }

  private initOrbit(): void {
    const card = this.heroCardRef?.nativeElement;
    if (!card) return;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const r = 20;
    const path =
      `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} ` +
      `L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} ` +
      `L ${r} ${h} Q 0 ${h} 0 ${h - r} ` +
      `L 0 ${r} Q 0 0 ${r} 0 Z`;
    const orb = card.closest('.orbit-wrap')?.querySelector('.orb-glow') as HTMLElement | null;
    if (orb) {
      orb.style.offsetPath = `path('${path}')`;
      orb.style.visibility = 'visible';
    }
  }

  ngOnInit(): void {
    const u = this.auth.user();
    if (u) {
      this.updFirst   = u.firstName;
      this.updLast    = u.lastName;
      this.updAge     = u.age;
      this.updAvatar  = u.avatar ?? '';
      this.updGender  = (u as any).gender  ?? '';
      this.updPhone   = (u as any).phone   ?? '';
      this.updZipcode = (u as any).zipcode ?? '';
      this.updAddress = (u as any).address ?? '';
    }
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    this.errorMsg.set('');
    this.successMsg.set('');
  }

  protected onUpdate(): void {
    if (!this.updFirst || !this.updLast) { this.errorMsg.set('First and last name are required.'); return; }
    this.loading.set(true); this.errorMsg.set(''); this.successMsg.set('');

    this.api.updateUser({
      firstName: this.updFirst,
      lastName:  this.updLast,
      age:       Number(this.updAge),
      avatar:    this.updAvatar  || undefined,
      gender:    (this.updGender  || undefined) as any,
      phone:     this.updPhone   || undefined,
      zipcode:   this.updZipcode || undefined,
      address:   this.updAddress || undefined,
    }).subscribe({
      next: u => {
        this.auth.user.set(u);
        this.loading.set(false);
        this.successMsg.set('Profile updated successfully.');
      },
      error: err => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Update failed.');
      },
    });
  }

  protected onChangePassword(): void {
    if (!this.pwdOld || !this.pwdNew) { this.errorMsg.set('Fill in all password fields.'); return; }
    if (this.pwdNew !== this.pwdConfirm) { this.errorMsg.set('New passwords do not match.'); return; }
    this.loading.set(true); this.errorMsg.set(''); this.successMsg.set('');

    this.api.changePassword({ oldPassword: this.pwdOld, newPassword: this.pwdNew }).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMsg.set('Password changed successfully.');
        this.pwdOld = ''; this.pwdNew = ''; this.pwdConfirm = '';
      },
      error: err => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Password change failed.');
      },
    });
  }

  protected onSignOut(): void {
    this.auth.signOut();
  }

  protected onDeleteAccount(): void {
    this.showDeleteConfirm.set(true);
  }

  protected confirmDelete(): void {
    this.showDeleteConfirm.set(false);
    this.loading.set(true);
    this.api.deleteAccount().subscribe({
      next: () => {
        this.auth.clearTokens();
        this.auth.user.set(null);
        this.cart.cart.set(null);
        this.router.navigate(['/home']);
      },
      error: err => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Delete failed.');
      },
    });
  }
}
