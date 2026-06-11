import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import ConsignPage from "./pages/ConsignPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import OrderDetailPage from "./pages/OrderDetailPage.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import ProductPage from "./pages/ProductPage.jsx";
import StaffConsignmentPage from "./pages/StaffConsignmentPage.jsx";
import StaffConsignmentDetailPage from "./pages/StaffConsignmentDetailPage.jsx";
import StaffOrderPage from "./pages/StaffOrderPage.jsx";
import StaffPage from "./pages/StaffPage.jsx";
import StaffProductDetailPage from "./pages/StaffProductDetailPage.jsx";
import StaffProductPage from "./pages/StaffProductPage.jsx";
import { getCurrentUser } from "./lib/api.js";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
      <Route path="/staff" element={<RequireAuth><StaffPage /></RequireAuth>} />
      <Route path="/staff/consignments" element={<RequireAuth><StaffConsignmentPage /></RequireAuth>} />
      <Route path="/staff/consignments/:id" element={<RequireAuth><StaffConsignmentDetailPage /></RequireAuth>} />
      <Route path="/staff/orders" element={<RequireAuth><StaffOrderPage /></RequireAuth>} />
      <Route path="/staff/products" element={<RequireAuth><StaffProductPage /></RequireAuth>} />
      <Route path="/staff/products/:id" element={<RequireAuth><StaffProductDetailPage /></RequireAuth>} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route
          path="/consign"
          element={
            <RequireAuth
              prompt={{
                title: "Đăng nhập để ký gửi",
                message: "Bạn cần đăng nhập tài khoản khách hàng để tạo yêu cầu ký gửi sản phẩm.",
                action: "Đăng nhập để ký gửi",
              }}
            >
              <ConsignPage />
            </RequireAuth>
          }
        />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth
              prompt={{
                title: "Đăng nhập để xem tài khoản",
                message: "Bạn cần đăng nhập để xem trạng thái ký gửi, đơn hàng và thông tin tài khoản.",
                action: "Đăng nhập để xem",
              }}
            >
              <DashboardPage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RequireAuth({ children, prompt }) {
  const location = useLocation();
  const user = getCurrentUser();

  if (user) return children;
  if (!prompt) return <Navigate to="/" replace />;

  const redirect = encodeURIComponent(`${location.pathname}${location.search}`);

  return (
    <main className="relative min-h-[calc(100vh-74px)] bg-cream">
      <div className="site-container py-16">
        <section className="min-h-[420px] rounded-[24px] border border-border bg-linen/55" />
      </div>
      <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/35 px-5 backdrop-blur-sm">
        <section className="w-full max-w-[460px] rounded-[24px] border border-border bg-white p-8 text-center shadow-soft">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-clay">The Heirloom</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-ink">{prompt.title}</h1>
          <p className="mt-4 text-sm leading-6 text-muted">{prompt.message}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to={`/login?redirect=${redirect}`}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-ink px-6 text-sm font-bold text-white"
            >
              {prompt.action}
            </Link>
            <Link
              to="/"
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border px-6 text-sm font-bold text-ink"
            >
              Về trang chủ
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
