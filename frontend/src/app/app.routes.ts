import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar · Stockly',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'stock' },
      {
        path: 'stock',
        title: 'Stock · Stockly',
        loadComponent: () => import('./features/stock/stock-page').then((m) => m.StockPage),
      },
      {
        path: 'proveedores',
        title: 'Proveedores · Stockly',
        loadComponent: () =>
          import('./features/suppliers/suppliers-page').then((m) => m.SuppliersPage),
      },
      {
        path: 'proveedores/:id',
        title: 'Proveedor · Stockly',
        loadComponent: () =>
          import('./features/suppliers/supplier-detail').then((m) => m.SupplierDetail),
      },
      {
        path: 'proveedores/:id/pedidos/nuevo',
        title: 'Nuevo pedido favorito · Stockly',
        loadComponent: () => import('./features/suppliers/order-form').then((m) => m.OrderForm),
      },
      {
        path: 'proveedores/:id/pedidos/:orderId',
        title: 'Editar pedido favorito · Stockly',
        loadComponent: () => import('./features/suppliers/order-form').then((m) => m.OrderForm),
      },
      {
        path: 'eventos',
        title: 'Eventos · Stockly',
        loadComponent: () => import('./features/events/events-page').then((m) => m.EventsPage),
      },
      {
        path: 'eventos/:id',
        title: 'Evento · Stockly',
        loadComponent: () => import('./features/events/event-detail').then((m) => m.EventDetail),
      },
      {
        path: 'eventos/:id/consumo',
        title: 'Consumo del evento · Stockly',
        loadComponent: () =>
          import('./features/events/event-consumption').then((m) => m.EventConsumption),
      },
      {
        path: 'control',
        title: 'Control · Stockly',
        loadComponent: () => import('./features/control/control-page').then((m) => m.ControlPage),
      },
      {
        path: 'perfil',
        title: 'Perfil · Stockly',
        loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
      },
      {
        path: 'categorias/:id',
        title: 'Categoría · Stockly',
        loadComponent: () =>
          import('./features/categories/category-detail').then((m) => m.CategoryDetail),
      },
      {
        path: 'categorias',
        title: 'Categorías · Stockly',
        loadComponent: () =>
          import('./features/categories/categories-page').then((m) => m.CategoriesPage),
      },
    ],
  },
  { path: '**', redirectTo: 'stock' },
];
