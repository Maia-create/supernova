import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./home/home').then(m => m.Home),
  },
  {
    path: 'products',
    loadComponent: () => import('./products/products').then(m => m.Products),
  },
  {
    path: 'details/:id',
    loadComponent: () => import('./details/details').then(m => m.Details),
  },
  {
    path: 'rate',
    loadComponent: () => import('./rate/rate').then(m => m.Rate),
  },
  {
    path: 'auth',
    loadComponent: () => import('./auth/auth').then(m => m.Auth),
  },
  {
    path: 'cart',
    canActivate: [authGuard],
    loadComponent: () => import('./cart/cart').then(m => m.Cart),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./profile/profile').then(m => m.Profile),
  },
  {
    path: '**',
    loadComponent: () => import('./error/error').then(m => m.Error),
  },
];
