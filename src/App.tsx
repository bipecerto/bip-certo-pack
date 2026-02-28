import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppProvider } from '@/contexts/AppContext';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/Login';
import SettingsPage from '@/pages/Settings';
import ScannerPage from '@/pages/Scanner';
import FindPage from '@/pages/Find';
import ImportsPage from '@/pages/Imports';
import PackagesPage from '@/pages/Packages';
import OrdersPage from '@/pages/Orders';
import ProductsPage from '@/pages/Products';
import PackageDetails from '@/pages/PackageDetails';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/settings"
        element={
          <AppProvider>
            <AppLayout />
          </AppProvider>
        }
      >
        <Route index element={<SettingsPage />} />
      </Route>
      <Route
        element={
          <ProtectedRoute>
            <AppProvider>
              <AppLayout />
            </AppProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/scanner" element={<ScannerPage />} />
        <Route path="/find" element={<FindPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/packages" element={<PackagesPage />} />
        <Route path="/package/:id" element={<PackageDetails />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/products" element={<ProductsPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/scanner" replace />} />
      <Route path="*" element={<Navigate to="/scanner" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}
