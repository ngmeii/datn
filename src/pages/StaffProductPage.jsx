import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  Home,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  ShieldQuestion,
  ShoppingBag,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  UserRound,
  UsersRound,
  ClipboardList,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, clearSession, formatMoney, getCurrentUser } from "../lib/api.js";

const heroImage = "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1300&q=90";
const supportImage = "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=500&q=85";
const fallbackImage = "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=700&q=85";

const navItems = [
  { label: "Tổng quan", icon: Home, href: "/staff" },
  { label: "Yêu cầu ký gửi", icon: ClipboardList, href: "/staff" },
  { label: "Định giá tự động", icon: SlidersHorizontal, href: "/staff" },
  { label: "Kiểm định", icon: ShieldCheck, href: "/staff" },
  { label: "Sản phẩm đăng bán", icon: BriefcaseBusiness, href: "/staff/products", active: true },
  { label: "Khách hàng", icon: UsersRound, href: "/staff" },
  { label: "Báo cáo", icon: BarChart3, href: "/staff" },
];

const statusLabels = {
  on_sale: "Đang bán",
  reserved: "Đã đặt giữ",
  sold: "Đã bán",
  expired: "Sắp hết hạn",
  returned: "Tạm ẩn",
};

const statusStyles = {
  on_sale: "bg-[#e8f6ed] text-[#3a7a4f]",
  reserved: "bg-[#eaf4ff] text-[#2f6b9f]",
  sold: "bg-[#efeafd] text-[#6a51a3]",
  expired: "bg-[#fff1dc] text-[#a96620]",
  returned: "bg-[#eceae8] text-[#635d58]",
};

export default function StaffProductPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [brand, setBrand] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const isStaff = ["staff", "admin"].includes(user?.role);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!isStaff) return;
    Promise.all([api("/products?status="), api("/categories")]).then(([productData, categoryData]) => {
      setProducts(productData);
      setCategories(categoryData);
      setSelectedId(productData[0]?.id || null);
    });
  }, []);

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return products.filter((product) => (
      (!keyword || product.name?.toLowerCase().includes(keyword) || product.brand?.toLowerCase().includes(keyword) || String(product.id).includes(keyword)) &&
      (!category || product.category_name === category) &&
      (!status || product.status === status) &&
      (!brand || product.brand === brand)
    ));
  }, [products, query, category, status, brand]);

  const selected = products.find((product) => product.id === selectedId) || filteredProducts[0] || null;
  const brands = [...new Set(products.map((product) => product.brand).filter(Boolean))];
  const expiringCount = products.filter((product) => {
    const days = daysUntil(product.expires_at);
    return days >= 0 && days <= 7;
  }).length;
  const todayViews = products.reduce((sum, product) => sum + getAnalytics(product).views, 0);

  useEffect(() => {
    if (!filteredProducts.some((product) => product.id === selectedId)) {
      setSelectedId(filteredProducts[0]?.id || null);
    }
  }, [filteredProducts, selectedId]);

  if (!user) return null;
  if (!isStaff) return <AccessDenied />;

  return (
    <main className="min-h-screen bg-[#fbf7f2] text-[#211914]">
      <Sidebar />

      <section className="min-w-0 lg:pl-[280px]">
        <StaffHeader user={user} accountOpen={accountOpen} setAccountOpen={setAccountOpen} />

        <section className="grid overflow-hidden border-b border-[#eadfd4] bg-[#f8efe7] lg:h-[205px] lg:grid-cols-[minmax(0,1fr)_510px]">
          <div className="px-7 py-11 lg:px-12">
            <h1 className="font-display text-5xl font-bold">Sản phẩm đăng bán</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#6d6057]">
              Theo dõi, quản lý và tối ưu các sản phẩm đang hiển thị để tăng hiệu quả bán hàng.
              <br />Cập nhật thông tin, giá bán, trạng thái và chiến dịch một cách dễ dàng.
            </p>
          </div>
          <img className="hidden h-[205px] w-full object-cover lg:block" src={heroImage} alt="Sản phẩm đăng bán" />
        </section>

        <div className="space-y-4 px-4 py-4 xl:px-5">
          <section className="grid gap-4 rounded-md border border-[#eadfd4] bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Eye} label="Đang hiển thị" value={products.filter((item) => item.status === "on_sale").length} suffix="sản phẩm" delta="Dữ liệu cập nhật từ hệ thống" />
            <Metric icon={Clock3} label="Sắp hết hạn" value={expiringCount} suffix="sản phẩm" delta="Trong vòng 7 ngày tới" />
            <Metric icon={ShoppingBag} label="Đã bán tuần này" value={products.filter((item) => item.status === "sold").length} suffix="sản phẩm" delta="Dữ liệu cập nhật từ hệ thống" />
            <Metric icon={TrendingUp} label="Lượt xem minh họa" value={todayViews.toLocaleString("vi-VN")} suffix="lượt" delta="Chưa kết nối hệ thống analytics" />
          </section>

          <section className="rounded-md border border-[#eadfd4] bg-white shadow-sm">
            <ProductFilters
              brands={brands}
              categories={categories}
              brand={brand}
              category={category}
              query={query}
              status={status}
              setBrand={setBrand}
              setCategory={setCategory}
              setQuery={setQuery}
              setStatus={setStatus}
            />
            <ProductTable products={filteredProducts} selectedId={selected?.id} setSelectedId={setSelectedId} />
            <Pagination count={filteredProducts.length} total={products.length} />
          </section>

          {selected && <ProductDetail product={selected} />}
        </div>

        <Footer />
      </section>
    </main>
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] border-r border-[#eadfd4] bg-[#fffaf5] lg:flex lg:flex-col">
      <div className="flex h-20 items-center border-b border-[#eadfd4] px-8">
        <Link to="/" className="font-display text-3xl font-bold">The Heirloom</Link>
      </div>
      <nav className="flex-1 space-y-2 px-4 py-7">
        {navItems.map((item) => (
          <Link key={item.label} to={item.href} className={item.active ? "flex h-12 items-center gap-4 rounded-md bg-[#f2e4d8] px-4 text-sm font-bold text-[#8a572f]" : "flex h-12 items-center gap-4 rounded-md px-4 text-sm font-semibold text-[#786a5f] hover:bg-[#f7efe8]"}>
            <item.icon size={18} /> {item.label}
          </Link>
        ))}
      </nav>
      <div className="mx-4 mb-4 overflow-hidden rounded-md border border-[#eadfd4] bg-white">
        <img src={supportImage} alt="Hỗ trợ nội bộ" className="h-28 w-full object-cover" />
        <div className="p-4">
          <p className="text-sm font-bold">Cần hỗ trợ?</p>
          <p className="mt-2 text-xs leading-5 text-[#7c6e62]">Liên hệ ngay với đội ngũ The Heirloom.</p>
          <button className="mt-3 rounded-md bg-[#211914] px-4 py-2 text-xs font-bold text-white">Liên hệ ngay</button>
        </div>
      </div>
      <div className="border-t border-[#eadfd4] px-5 py-4">
        <p className="flex h-10 items-center gap-3 text-sm font-semibold text-[#786a5f]"><ShieldQuestion size={17} /> Hướng dẫn sử dụng</p>
        <p className="flex h-10 items-center gap-3 text-sm font-semibold text-[#786a5f]"><Settings size={17} /> Cài đặt hệ thống</p>
      </div>
    </aside>
  );
}

function StaffHeader({ user, accountOpen, setAccountOpen }) {
  return (
    <header className="flex h-20 items-center justify-between border-b border-[#eadfd4] bg-[#fffaf5] px-6 lg:px-9">
      <p className="text-sm font-semibold text-[#6e6258]">Hệ thống nội bộ</p>
      <div className="relative flex items-center gap-4">
        <Bell size={18} />
        <span className="h-10 w-10 overflow-hidden rounded-full bg-[#e8dacd]"><UserRound className="m-2 text-[#94643e]" /></span>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-bold">{user.full_name || user.name}</p>
          <p className="text-xs text-[#7c6e62]">{user.role === "admin" ? "Quản trị viên" : "Chuyên viên kinh doanh"}</p>
        </div>
        <button onClick={() => setAccountOpen((open) => !open)}><ChevronDown size={17} /></button>
        {accountOpen && (
          <button className="absolute right-0 top-full z-10 mt-3 w-36 rounded-md border border-[#eadfd4] bg-white px-4 py-3 text-left text-sm font-bold text-red-600 shadow-soft" onClick={() => { clearSession(); window.location.assign("/login"); }}>
            Đăng xuất
          </button>
        )}
      </div>
    </header>
  );
}

function Metric({ icon: Icon, label, value, suffix, delta }) {
  return (
    <article className="rounded-md border border-[#eadfd4] p-5">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#fff4ea] text-[#c48658]"><Icon size={23} /></span>
        <div><p className="text-sm font-bold text-[#5f554d]">{label}</p><p className="mt-1 font-display text-4xl font-bold">{value} <span className="font-sans text-xs font-semibold text-[#7c6e62]">{suffix}</span></p></div>
      </div>
      <p className="mt-5 text-xs font-semibold text-[#b06b3d]">{delta}</p>
    </article>
  );
}

function ProductFilters({ categories, brands, category, status, brand, query, setCategory, setStatus, setBrand, setQuery }) {
  return (
    <div className="grid gap-3 border-b border-[#eadfd4] p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.55fr_auto]">
      <Select label="Danh mục" value={category} onChange={setCategory}><option value="">Tất cả danh mục</option>{categories.map((item) => <option key={item.id}>{item.name}</option>)}</Select>
      <Select label="Trạng thái" value={status} onChange={setStatus}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Select label="Thương hiệu" value={brand} onChange={setBrand}><option value="">Tất cả thương hiệu</option>{brands.map((item) => <option key={item}>{item}</option>)}</Select>
      <Select label="Khoảng giá"><option>Tất cả khoảng giá</option></Select>
      <label><span className="text-xs font-bold text-[#5f554d]">Tìm kiếm</span><span className="mt-2 flex h-11 items-center rounded-md border border-[#eadfd4] px-3"><input className="min-w-0 flex-1 bg-transparent text-xs outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, mã SP, thương hiệu..." /><Search size={16} /></span></label>
      <button className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#eadfd4] px-3 text-xs font-bold"><Filter size={15} /> Bộ lọc nâng cao</button>
    </div>
  );
}

function Select({ label, value, onChange, children }) {
  return <label><span className="text-xs font-bold text-[#5f554d]">{label}</span><select value={value} onChange={(event) => onChange?.(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-[#eadfd4] bg-white px-3 text-xs outline-none">{children}</select></label>;
}

function ProductTable({ products, selectedId, setSelectedId }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] table-fixed text-left text-[11px]">
        <colgroup><col className="w-[4%]" /><col className="w-[9%]" /><col className="w-[19%]" /><col className="w-[8%]" /><col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[11%]" /><col className="w-[7%]" /><col className="w-[7%]" /><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[5%]" /></colgroup>
        <thead className="border-b border-[#eadfd4] text-[#62584f]"><tr><th className="w-10 px-4 py-4"></th><th className="px-3 py-4">Mã SP</th><th className="px-3 py-4">Sản phẩm</th><th className="px-3 py-4">Danh mục</th><th className="px-3 py-4">Thương hiệu</th><th className="px-3 py-4">Giá bán</th><th className="px-3 py-4">Giá gốc/đề xuất</th><th className="px-3 py-4">Lượt xem</th><th className="px-3 py-4">Yêu thích</th><th className="px-3 py-4">Trạng thái</th><th className="px-3 py-4">Ngày đăng</th><th className="px-3 py-4">Thao tác</th></tr></thead>
        <tbody>
          {products.map((product) => {
            const { views, likes } = getAnalytics(product);
            return (
              <tr key={product.id} onClick={() => setSelectedId(product.id)} className={selectedId === product.id ? "cursor-pointer border-b border-[#eadfd4] bg-[#fff6ed]" : "cursor-pointer border-b border-[#eadfd4] hover:bg-[#fffaf6]"}>
                <td className="px-4 py-3"><span className={selectedId === product.id ? "block h-4 w-4 rounded-full border-4 border-[#c48658]" : "block h-4 w-4 rounded-full border border-[#b9aca1]"} /></td>
                <td className="px-3 py-3 font-semibold">TH{String(product.id).padStart(7, "0")}</td>
                <td className="px-3 py-3"><div className="flex items-center gap-2"><ProductImage src={product.image_url} alt={product.name} className="h-12 w-12 shrink-0 rounded-md object-cover" /><span className="font-semibold leading-4">{product.name}</span></div></td>
                <td className="px-3 py-3">{product.category_name}</td><td className="px-3 py-3">{product.brand || "Chưa rõ"}</td>
                <td className="px-3 py-3 whitespace-nowrap font-semibold">{formatMoney(product.price)}</td><td className="px-3 py-3 whitespace-nowrap text-[#7c6e62] line-through">{formatMoney(Number(product.price) * 1.2)}</td>
                <td className="px-3 py-3">{views.toLocaleString("vi-VN")}</td><td className="px-3 py-3">{likes}</td>
                <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-md px-3 py-2 font-bold ${statusStyles[product.status] || statusStyles.returned}`}>{statusLabels[product.status] || product.status}</span></td>
                <td className="px-3 py-3 whitespace-nowrap">{formatDate(product.listed_at)}</td><td className="px-3 py-3"><MoreHorizontal size={17} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ count, total }) {
  const pages = Math.max(1, Math.ceil(total / 8));
  return <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-[#7c6e62]"><span>Hiển thị 1 - {count} của {total} sản phẩm</span><div className="flex items-center gap-2"><button disabled className="grid h-8 w-8 place-items-center rounded-md border border-[#eadfd4] opacity-50"><ChevronLeft size={15} /></button>{Array.from({ length: pages }, (_, index) => index + 1).map((page) => <button key={page} className={page === 1 ? "h-8 w-8 rounded-md border border-[#c48658] bg-[#fff4ea] font-bold text-[#8a572f]" : "h-8 w-8 rounded-md border border-[#eadfd4]"}>{page}</button>)}<button disabled className="grid h-8 w-8 place-items-center rounded-md border border-[#eadfd4] opacity-50"><ChevronRight size={15} /></button></div></div>;
}

function ProductDetail({ product }) {
  const { views, likes } = getAnalytics(product);
  return (
    <section className="grid overflow-hidden rounded-md border border-[#eadfd4] bg-white shadow-sm xl:grid-cols-[1.08fr_1fr_0.78fr]">
      <article className="border-b border-[#eadfd4] p-5 xl:border-b-0 xl:border-r">
        <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-bold">Chi tiết sản phẩm</h2><span className="text-xs font-semibold text-[#7c6e62]">TH{String(product.id).padStart(7, "0")}</span></div>
        <ProductImage src={product.image_url} alt={product.name} className="mt-5 aspect-[1.35] w-full rounded-md object-cover" />
        <div className="mt-3 grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((item) => <ProductImage key={item} src={product.image_url} alt="" className="aspect-square w-full rounded-md border border-[#eadfd4] object-cover" />)}</div>
        <h3 className="mt-5 font-display text-xl font-bold">{product.name}</h3>
        <div className="mt-3 flex gap-2"><Pill>{product.category_name}</Pill><Pill>{product.brand || "Chưa rõ"}</Pill></div>
        <div className="mt-5 space-y-3 text-xs"><DetailRow label="Mã SP" value={`TH${String(product.id).padStart(7, "0")}`} /><DetailRow label="Ngày đăng" value={formatDate(product.listed_at)} /><DetailRow label="Trạng thái" value={statusLabels[product.status] || product.status} /><DetailRow label="Hết hạn" value={formatDate(product.expires_at)} /></div>
      </article>
      <article className="border-b border-[#eadfd4] p-5 xl:border-b-0 xl:border-r">
        <h2 className="font-display text-2xl font-bold">Hiệu suất sản phẩm</h2>
        <div className="mt-6 grid grid-cols-3 gap-3"><MiniStat value={views.toLocaleString("vi-VN")} label="Lượt xem" /><MiniStat value={likes} label="Yêu thích" /><MiniStat value="2,35%" label="Tỉ lệ chuyển đổi" /></div>
        <div className="mt-5 rounded-md border border-[#eadfd4] p-4"><p className="text-xs font-bold">Biểu đồ lượt xem</p><Chart /></div>
        <div className="mt-5 rounded-md bg-[#fbf7f2] p-4"><h3 className="font-display text-lg font-bold">Gợi ý tối ưu sản phẩm</h3><div className="mt-4 space-y-3 text-xs leading-5 text-[#6d6057]"><p>✓ Tiêu đề sản phẩm đang hoạt động tốt.</p><p>✓ Thêm ảnh chi tiết mặt sau và phụ kiện đi kèm.</p><p>✓ Cân nhắc giảm giá 3-5% để tăng tỉ lệ chuyển đổi.</p></div><button className="mt-4 rounded-md border border-[#c48658] px-4 py-2 text-xs font-bold text-[#8a572f]">Xem thêm gợi ý</button></div>
      </article>
      <article className="p-5">
        <h2 className="font-display text-2xl font-bold">Thông tin giá</h2>
        <div className="mt-5 space-y-4 text-xs"><DetailRow label="Giá bán hiện tại" value={formatMoney(product.price)} strong /><DetailRow label="Giá gốc / đề xuất" value={formatMoney(Number(product.price) * 1.2)} /><DetailRow label="Giảm giá" value="-16,7%" /><DetailRow label="Bạn nhận được (ước tính)" value={formatMoney(Number(product.price) * 0.8)} strong /></div>
        <div className="mt-5 rounded-md border border-[#eadfd4] p-4"><p className="font-display text-lg font-bold">Đề xuất AI <span className="ml-2 rounded bg-[#e8f6ed] px-2 py-1 font-sans text-[10px] text-[#3a7a4f]">Beta</span></p><p className="mt-3 text-xs text-[#7c6e62]">Dựa trên hiệu suất và thị trường hiện tại</p><p className="mt-3 text-xl font-bold">{formatMoney(Number(product.price) * 0.96)}</p><button className="mt-4 h-10 w-full rounded-md border border-[#c48658] text-xs font-bold text-[#8a572f]">Áp dụng đề xuất</button></div>
        <div className="mt-5"><h3 className="font-display text-lg font-bold">Thao tác nhanh</h3><div className="mt-3 space-y-2"><QuickButton primary>Cập nhật sản phẩm</QuickButton><QuickButton>Ẩn sản phẩm</QuickButton><QuickButton>Gia hạn đăng bán</QuickButton><QuickButton danger>Đánh dấu đã bán</QuickButton></div></div>
      </article>
    </section>
  );
}

function Chart() {
  return <svg className="mt-4 h-40 w-full" viewBox="0 0 520 180" preserveAspectRatio="none"><path d="M0 150 L70 118 L140 125 L210 82 L280 116 L350 66 L420 86 L520 35" fill="none" stroke="#5c8cd6" strokeWidth="3" /><path d="M0 150 L70 118 L140 125 L210 82 L280 116 L350 66 L420 86 L520 35 L520 180 L0 180 Z" fill="#dce9fb" opacity=".55" /></svg>;
}

function MiniStat({ value, label }) { return <div className="rounded-md border border-[#eadfd4] p-3 text-center"><p className="font-display text-2xl font-bold">{value}</p><p className="mt-2 text-xs text-[#7c6e62]">{label}</p></div>; }
function ProductImage({ src, alt, ...props }) { return <img src={src || fallbackImage} alt={alt} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} {...props} />; }
function DetailRow({ label, value, strong }) { return <div className="flex items-center justify-between gap-4"><span className="text-[#7c6e62]">{label}</span><span className={strong ? "text-right text-sm font-bold" : "text-right font-semibold"}>{value}</span></div>; }
function Pill({ children }) { return <span className="rounded-full bg-[#fbf7f2] px-3 py-2 text-xs font-semibold">{children}</span>; }
function QuickButton({ children, primary, danger }) { return <button className={primary ? "h-10 w-full rounded-md bg-[#211914] text-xs font-bold text-white" : danger ? "h-10 w-full rounded-md border border-red-300 text-xs font-bold text-red-600" : "h-10 w-full rounded-md border border-[#c48658] text-xs font-bold text-[#8a572f]"}>{children}</button>; }

function Footer() {
  return <footer className="mt-5 border-t border-[#eadfd4] bg-[#fffaf5] px-8 py-7"><div className="grid gap-8 md:grid-cols-4"><div><p className="font-display text-2xl font-bold">The Heirloom</p><p className="mt-3 text-xs leading-5 text-[#7c6e62]">Nền tảng ký gửi và mua bán thời trang cao cấp đã qua sử dụng đáng tin cậy.</p></div><FooterCol title="Về The Heirloom" items={["Giới thiệu", "Quy trình ký gửi", "Cam kết thương hiệu"]} /><FooterCol title="Hỗ trợ nội bộ" items={["Hướng dẫn sử dụng", "Quy định & tiêu chuẩn", "Chính sách giá"]} /><FooterCol title="Tài nguyên" items={["Brand Guide", "Danh mục thương hiệu", "Thư viện hình ảnh"]} /></div></footer>;
}
function FooterCol({ title, items }) { return <div><p className="text-xs font-bold uppercase">{title}</p>{items.map((item) => <p key={item} className="mt-3 text-xs text-[#7c6e62]">{item}</p>)}</div>; }
function AccessDenied() { return <main className="grid min-h-screen place-items-center bg-[#fbf6f1]"><div className="text-center"><h1 className="font-display text-5xl font-bold">Không có quyền truy cập</h1><Link to="/" className="mt-7 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Về trang chủ</Link></div></main>; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "Chưa cập nhật"; }
function daysUntil(value) { return value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : Infinity; }
function getAnalytics(product) { return { views: 468 + ((product.id * 137) % 820), likes: 56 + ((product.id * 29) % 132) }; }
