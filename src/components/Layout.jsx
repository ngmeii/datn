import { Menu, Search, ShoppingBag, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearSession, getCurrentUser } from "../lib/api.js";
import { getCart, onCartChange } from "../lib/cart.js";

export default function Layout() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(() => getCart().length);

  const navItems = useMemo(() => {
    const items = [
      { to: "/", label: "Trang chủ" },
      { to: "/products", label: "Sản phẩm" },
      { to: "/consign", label: "Ký gửi" },
      { to: "/dashboard", label: "Tài khoản" },
    ];

    if (["staff", "admin"].includes(user?.role)) {
      items.push({ to: "/staff", label: "Nhân viên/Admin" });
    }

    return items;
  }, [user?.role]);

  useEffect(() => onCartChange(() => setCartCount(getCart().length)), []);

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-cream/95 backdrop-blur">
        <div className="site-container flex h-16 items-center justify-between gap-6">
          <Link to="/" className="font-display text-2xl font-bold">
            The Heirloom
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-ink/65 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "border-b border-ink pb-1 text-ink" : "hover:text-ink"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <label className="flex h-10 w-72 items-center gap-2 rounded-full border border-black/15 bg-white px-4 text-sm">
              <Search size={16} />
              <input className="w-full bg-transparent outline-none" placeholder="Tìm sản phẩm, thương hiệu" />
            </label>
            <Link to="/cart" className="relative grid h-10 w-10 place-items-center rounded-full border border-black/15 bg-white">
              <ShoppingBag size={18} />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
            {user ? (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white"
                onClick={() => {
                  clearSession();
                  navigate("/login");
                }}
              >
                <UserRound size={16} />
                {user.name || user.full_name}
              </button>
            ) : (
              <Link className="h-10 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white" to="/login">
                Đăng nhập
              </Link>
            )}
          </div>

          <button className="grid h-10 w-10 place-items-center rounded-full border border-black/15 lg:hidden">
            <Menu size={19} />
          </button>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
