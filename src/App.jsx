import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import ConsignPage from "./pages/ConsignPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import ProductPage from "./pages/ProductPage.jsx";
import StaffConsignmentDetailPage from "./pages/StaffConsignmentDetailPage.jsx";
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
      <Route path="/staff/consignments/:id" element={<RequireAuth><StaffConsignmentDetailPage /></RequireAuth>} />
      <Route path="/staff/products" element={<RequireAuth><StaffProductPage /></RequireAuth>} />
      <Route path="/staff/products/:id" element={<RequireAuth><StaffProductDetailPage /></RequireAuth>} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/consign" element={<RequireAuth><ConsignPage /></RequireAuth>} />
        <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
        <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RequireAuth({ children }) {
  return getCurrentUser() ? children : <Navigate to="/" replace />;
}
