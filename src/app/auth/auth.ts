import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../shared/services/auth.service';
import { CartService } from '../shared/services/cart.service';
import { Educata } from '../educata/educata';

type Mode = 'login' | 'register' | 'recovery';

@Component({
  selector: 'app-auth',
  imports: [FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
})
export class Auth implements OnInit {
  private authSvc = inject(AuthService);
  private cartSvc = inject(CartService);
  private api     = inject(Educata);
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);

  private returnUrl = '/products';
  private backUrl   = '/products';

  protected mode       = signal<Mode>('login');
  protected loading    = signal(false);
  protected errorMsg   = signal('');
  protected successMsg = signal('');
  protected showPwd    = signal(false);

  // login
  protected loginEmail    = '';
  protected loginPassword = '';

  // register
  protected regFirst    = '';
  protected regLast     = '';
  protected regEmail    = '';
  protected regPassword = '';
  protected regAge: number | '' = '';
  protected regAddress  = '';
  protected regPhone    = '';
  protected regZipcode  = '';
  protected regAvatar   = '';
  protected regGender: 'MALE' | 'FEMALE' | 'OTHER' | '' = '';

  // recovery
  protected recoveryEmail = '';

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    this.returnUrl = p['returnUrl'] || '/products';
    const rawBack = p['backUrl'] ?? null;
    this.backUrl = (rawBack && !rawBack.startsWith('/auth')) ? rawBack : '/products';
  }

  protected goBack(): void {
    this.navigateTo(this.backUrl);
  }

  private navigateTo(url: string): void {
    this.router.navigateByUrl(url);
  }

  protected onSignIn(): void {
    if (!this.loginEmail || !this.loginPassword) {
      this.errorMsg.set('Please fill in all fields.');
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');

    this.authSvc.signIn(this.loginEmail, this.loginPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.cartSvc.load();
        this.navigateTo(this.returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Invalid credentials.');
      },
    });
  }

  protected onSignUp(): void {
    if (!this.regFirst || !this.regLast || !this.regEmail || !this.regPassword || !this.regAge ||
        !this.regAddress || !this.regPhone || !this.regZipcode || !this.regGender) {
      this.errorMsg.set('Please fill in all required fields.');
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');

    const payload: any = {
      firstName: this.regFirst,
      lastName:  this.regLast,
      email:     this.regEmail,
      password:  this.regPassword,
      age:       Number(this.regAge),
      address:   this.regAddress,
      phone:     this.regPhone,
      zipcode:   this.regZipcode,
      gender:    this.regGender,
      avatar:    this.regAvatar || 'https://i.imgur.com/IBhCeeP.jpg',
    };

    this.authSvc.signUp(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMsg.set('✉️ Verification email sent! Please check your inbox and verify your account before signing in.');
        this.errorMsg.set('');
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Registration failed.');
      },
    });
  }

  protected onRecovery(): void {
    if (!this.recoveryEmail) {
      this.errorMsg.set('Please enter your email.');
      return;
    }
    this.loading.set(true);
    this.errorMsg.set('');
    this.successMsg.set('');

    this.api.recoveryPassword(this.recoveryEmail).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMsg.set('Recovery link sent! Check your email.');
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Failed to send recovery link.');
      },
    });
  }
}
