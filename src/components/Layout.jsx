import { Menu, Search, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { getCurrentUser } from "../lib/api.js";
import { getCart, onCartChange } from "../lib/cart.js";
import AccountMenu from "./AccountMenu.jsx";

const navItems = [
  { to: "/", label: "Trang chủ", exact: true },
  { to: "/products", label: "Sản phẩm" },
  { to: "/consign", label: "Ký gửi" },
  { to: "/dashboard", label: "Tài khoản" },
  { to: "/#footer", label: "Liên hệ", hashLink: true },
];

export default function Layout() {
  const user = getCurrentUser();
  const location = useLocation();
  const [cartCount, setCartCount] = useState(() => getCart().length);

  useEffect(() => onCartChange(() => setCartCount(getCart().length)), []);

  useEffect(() => {
    if (!location.hash) return;

    const timer = window.setTimeout(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash]);

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-cream/95 backdrop-blur">
        <div className="site-container flex h-[74px] items-center justify-between gap-7">
          <Link to="/" className="shrink-0 font-display text-[30px] font-bold leading-none tracking-[-0.03em]">
            The Heirloom
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-9 text-[15px] font-semibold text-ink/70 lg:flex">
            {navItems.map((item) =>
              item.hashLink ? (
                <Link key={item.label} to={item.to} className="border-b border-transparent pb-2 transition hover:border-ink/40 hover:text-ink">
                  {item.label}
                </Link>
              ) : item.to ? (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) =>
                    `border-b pb-2 transition ${
                      isActive ? "border-ink text-ink" : "border-transparent hover:border-ink/40 hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ) : null,
            )}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <label className="flex h-12 w-[340px] items-center gap-3 rounded-full border border-black/15 bg-white/80 px-5 text-sm shadow-sm xl:w-[380px]">
              <input
                className="min-w-0 flex-1 bg-transparent outline-none"
                placeholder="Tìm kiếm váy, áo, túi xách, phụ kiện..."
              />
              <Search size={20} strokeWidth={1.8} />
            </label>

            <Link to="/cart" className="relative grid h-11 w-11 place-items-center rounded-full transition hover:bg-white">
              <ShoppingBag size={24} strokeWidth={1.8} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            <AccountMenu
              user={user}
              subtitle={
                user
                  ? user.role === "admin"
                    ? "Quản trị hệ thống"
                    : user.role === "staff"
                      ? "Nhân viên vận hành"
                      : "Tài khoản khách hàng"
                  : undefined
              }
            />
          </div>

          <button className="grid h-11 w-11 place-items-center rounded-full border border-black/15 bg-white lg:hidden">
            <Menu size={20} />
          </button>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
