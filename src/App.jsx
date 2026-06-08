import { Route, Routes } from "react-router-dom";
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/staff" element={<StaffPage />} />
      <Route path="/staff/consignments/:id" element={<StaffConsignmentDetailPage />} />
      <Route path="/staff/products" element={<StaffProductPage />} />
      <Route path="/staff/products/:id" element={<StaffProductDetailPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/consign" element={<ConsignPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}
