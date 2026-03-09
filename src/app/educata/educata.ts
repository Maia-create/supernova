import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Cookies } from '../shared/utils/cookie.util';

const BASE = 'https://api.everrest.educata.dev';
export const PAGE_SIZE = 8;

// ─── Auth types ───────────────────────────────────────────────────────────────
export interface AuthTokens     { access_token: string; refresh_token: string; }
export interface UserInfo       { _id: string; firstName: string; lastName: string; email: string; age: number; avatar: string; verified: boolean; role: string; }
export interface SignInPayload   { email: string; password: string; }
export interface SignUpPayload {
  firstName: string; lastName: string; email: string; password: string; age: number;
  address: string; phone: string; zipcode: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  avatar?: string;
}
export interface UpdatePayload   { firstName?: string; lastName?: string; age?: number; avatar?: string; gender?: 'MALE' | 'FEMALE' | 'OTHER'; phone?: string; zipcode?: string; address?: string; }
export interface ChangePwdPayload { oldPassword: string; newPassword: string; }

// ─── Product types ────────────────────────────────────────────────────────────
export interface ProductPrice    { current: number; beforeDiscount?: number; }
export interface ProductCategory { id: string; name: string; }
export interface Category        { id: string; name: string; }   // alias — same shape

export interface Product {
  _id: string;
  id?: string;
  title: string;
  description: string;
  price: ProductPrice;           // { current, beforeDiscount }
  thumbnail: string;
  images: string[];
  rating: number;
  stock: number;
  brand: string;
  category: ProductCategory;     // { id, name }
  discountPercentage?: number;
  warranty?: string;
  issueDate?: string;
  ratings?: any[];   // raw rating objects embedded in product
  reviews?: any[];   // review objects embedded in product
}

export interface ProductsResponse { total: number; products: Product[]; }

// ─── Cart types ───────────────────────────────────────────────────────────────
export interface CartItem       { id?: string; productId?: string; quantity: number; }
export interface CartTotalPrice { current: number; beforeDiscount?: number; }
export interface CartTotal      { quantity: number; price: CartTotalPrice; }
export interface Cart           { _id?: string; userId?: string; products: CartItem[]; total: CartTotal; }
export interface RatePayload    { productId: string; rate: number; }
export interface RatingEntry    {
  // raw rating object from p.ratings array
  userId?: string; user_id?: string; _id?: string;
  value?: number; rating?: number; rate?: number;
  // review object from p.reviews array (has user info embedded)
  firstName?: string; lastName?: string; avatar?: string; comment?: string;
}
export interface ResolvedRating { userId: string; rating: number; firstName?: string; lastName?: string; avatar?: string; }
export interface RatingsResponse { ratings: RatingEntry[]; total: number; }

// ─── Service ──────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class Educata {
  private http = inject(HttpClient);

  private get auth() {
    return { headers: new HttpHeaders({ Authorization: `Bearer ${Cookies.get('access_token')}` }) };
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  signIn(p: SignInPayload)          { return this.http.post<AuthTokens>(`${BASE}/auth/sign_in`, p); }
  signUp(p: SignUpPayload)          { return this.http.post<AuthTokens>(`${BASE}/auth/sign_up`, p); }
  getUser()                         { return this.http.get<UserInfo>(`${BASE}/auth`, this.auth); }
  signOut()                         { return this.http.post<void>(`${BASE}/auth/sign_out`, {}, this.auth); }
  updateUser(p: UpdatePayload)      { return this.http.patch<UserInfo>(`${BASE}/auth/update`, p, this.auth); }
  changePassword(p: ChangePwdPayload){ return this.http.patch<void>(`${BASE}/auth/change_password`, p, this.auth); }
  deleteAccount()                   { return this.http.delete<void>(`${BASE}/auth/delete`, this.auth); }
  recoveryPassword(email: string)   { return this.http.post<void>(`${BASE}/auth/recovery`, { email }); }
  getAllUsers(pageIdx: number)       { return this.http.get<any>(`${BASE}/auth/all?page_index=${pageIdx}&page_size=50`, this.auth); }

  // ── Products ─────────────────────────────────────────────────────────────────
  getAllProducts(page: number, pageSize = PAGE_SIZE)
    { return this.http.get<ProductsResponse>(`${BASE}/shop/products/all?page_index=${page}&page_size=${pageSize}`); }
  getProductById(id: string)
    { return this.http.get<Product>(`${BASE}/shop/products/id/${id}`); }
  getProductsByCategory(categoryId: string, page: number, pageSize = PAGE_SIZE)
    { return this.http.get<ProductsResponse>(`${BASE}/shop/products/category/${categoryId}?page_index=${page}&page_size=${pageSize}`); }
  getProductsByBrand(brand: string, page: number, pageSize = PAGE_SIZE)
    { return this.http.get<ProductsResponse>(`${BASE}/shop/products/brand/${brand}?page_index=${page}&page_size=${pageSize}`); }
  searchProducts(query: string, page: number, pageSize = PAGE_SIZE)
    { return this.http.get<ProductsResponse>(`${BASE}/shop/products/search?page_index=${page}&page_size=${pageSize}&keywords=${encodeURIComponent(query)}`); }
  getCategories()
    { return this.http.get<Category[]>(`${BASE}/shop/products/categories`); }   // [{id, name}]
  getBrands()
    { return this.http.get<string[]>(`${BASE}/shop/products/brands`); }          // string[]
  rateProduct(payload: RatePayload)
    { return this.http.post<void>(`${BASE}/shop/products/rate`, payload, this.auth); }
  getProductRatings(productId: string)
    { return this.http.get<RatingsResponse>(`${BASE}/shop/products/id/${productId}/ratings`); }

  // ── Cart ─────────────────────────────────────────────────────────────────────
  // API body key must be "id" (not "productId")
  getCart()                                        { return this.http.get<Cart>(`${BASE}/shop/cart`, this.auth); }
  addProductToCart(productId: string, qty: number) { return this.http.post<Cart>(`${BASE}/shop/cart/product`, { id: productId, quantity: qty }, this.auth); }
  updateCartProduct(productId: string, qty: number){ return this.http.patch<Cart>(`${BASE}/shop/cart/product`, { id: productId, quantity: qty }, this.auth); }
  removeCartProduct(productId: string)             { return this.http.delete<Cart>(`${BASE}/shop/cart/product`, { ...this.auth, body: { id: productId } }); }
  clearCart()                                      { return this.http.delete<void>(`${BASE}/shop/cart`, this.auth); }
  checkout()                                       { return this.http.post<void>(`${BASE}/shop/cart/checkout`, {}, this.auth); }
}
