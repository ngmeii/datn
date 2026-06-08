import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  MoreHorizontal,
  Search,
  ShoppingBag,
  Tag,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StaffHeader from "../components/StaffHeader.jsx";
import StaffSidebar from "../components/StaffSidebar.jsx";
import { api, formatMoney, getCurrentUser } from "../lib/api.js";

const heroImage = "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1300&q=90";
const fallbackImage = "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=700&q=85";

const statusLabels = {
  on_sale: "Đang đăng bán",
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

  const brands = [...new Set(products.map((product) => product.brand).filter(Boolean))];
  const expiringCount = products.filter((product) => {
    const days = daysUntil(product.expires_at);
    return days >= 0 && days <= 7;
  }).length;
  const todayViews = products.reduce((sum, product) => sum + getAnalytics(product).views, 0);

  if (!user) return null;
  if (!isStaff) return <AccessDenied />;

  return (
    <main className="min-h-screen bg-[#fbf7f2] text-[#211914]">
      <StaffSidebar active="products" />

      <section className="min-w-0 lg:pl-[280px]">
        <StaffHeader user={user} roleLabel={user.role === "admin" ? "Quản trị viên" : "Chuyên viên kiểm định"} />

        <section className="relative overflow-hidden border-b border-[#eadfd4] bg-[#f8efe7]">
          <div className="relative grid min-h-[320px] gap-8 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_460px] lg:px-16 xl:grid-cols-[minmax(0,1fr)_560px]">
            <div className="relative z-10 max-w-3xl">
              <h1 className="font-display text-5xl font-bold leading-tight md:text-6xl">Sản phẩm đăng bán</h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[#6d6057]">
                Theo dõi, quản lý và tối ưu các sản phẩm đang hiển thị để tăng hiệu quả bán hàng. Cập nhật thông tin, giá bán, trạng thái và chiến dịch một cách dễ dàng.
              </p>
            </div>
            <div className="relative hidden min-h-[240px] overflow-hidden rounded-l-[3rem] lg:block">
              <img src={heroImage} alt="Sản phẩm đăng bán" className="absolute inset-0 h-full w-full object-cover object-center" />
              <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#f8efe7] to-transparent" />
            </div>
          </div>
        </section>

        <div className="px-6 py-8 lg:px-8 xl:px-10">
          <section className="grid gap-5 rounded-md border border-[#eadfd4] bg-white p-5 shadow-soft md:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Eye} label="Đang hiển thị" value={products.filter((item) => item.status === "on_sale").length} suffix="sản phẩm" delta="Dữ liệu cập nhật từ hệ thống" />
            <Metric icon={Clock3} label="Sắp hết hạn" value={expiringCount} suffix="sản phẩm" delta="Trong vòng 7 ngày tới" />
            <Metric icon={ShoppingBag} label="Đã bán tuần này" value={products.filter((item) => item.status === "sold").length} suffix="sản phẩm" delta="Dữ liệu cập nhật từ hệ thống" />
            <Metric icon={TrendingUp} label="Lượt xem minh họa" value={todayViews.toLocaleString("vi-VN")} suffix="lượt" delta="Chưa kết nối hệ thống analytics" />
          </section>

          <section className="mt-8 rounded-md border border-[#eadfd4] bg-white shadow-soft">
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
            <ProductTable products={filteredProducts} onOpenProduct={(productId) => navigate(`/staff/products/${productId}`)} />
            <Pagination count={filteredProducts.length} total={products.length} />
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, suffix, delta }) {
  return (
    <article className="rounded-md border border-[#eadfd4] p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#f8efe7] text-clay"><Icon size={25} /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#6d6057]">{label}</p>
          <p className="mt-2 whitespace-nowrap font-display text-4xl font-bold xl:text-5xl">
            {value} <span className="font-sans text-sm font-semibold">{suffix}</span>
          </p>
          <p className="mt-3 text-xs font-semibold text-clay">{delta}</p>
        </div>
      </div>
    </article>
  );
}

function ProductFilters({ categories, brands, category, status, brand, query, setCategory, setStatus, setBrand, setQuery }) {
  return (
    <div className="grid gap-4 border-b border-[#eadfd4] p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.55fr_auto]">
      <Select label="Danh mục" value={category} onChange={setCategory}><option value="">Tất cả danh mục</option>{categories.map((item) => <option key={item.id}>{item.name}</option>)}</Select>
      <Select label="Trạng thái" value={status} onChange={setStatus}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Select label="Thương hiệu" value={brand} onChange={setBrand}><option value="">Tất cả thương hiệu</option>{brands.map((item) => <option key={item}>{item}</option>)}</Select>
      <Select label="Khoảng giá"><option>Tất cả khoảng giá</option></Select>
      <label><span className="text-xs font-bold text-[#5f554d]">Tìm kiếm</span><span className="mt-2 flex h-12 items-center rounded-md border border-[#eadfd4] px-4"><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, mã SP, thương hiệu..." /><Search size={17} /></span></label>
      <button className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#eadfd4] px-4 text-sm font-bold"><Filter size={16} /> Bộ lọc nâng cao</button>
    </div>
  );
}

function Select({ label, value, onChange, children }) {
  return <label><span className="text-xs font-bold text-[#5f554d]">{label}</span><select value={value} onChange={(event) => onChange?.(event.target.value)} className="mt-2 h-12 w-full rounded-md border border-[#eadfd4] bg-white px-4 text-sm outline-none">{children}</select></label>;
}

function ProductTable({ products, onOpenProduct }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1060px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[52px]" />
          <col className="w-[112px]" />
          <col className="w-[255px]" />
          <col className="w-[120px]" />
          <col className="w-[125px]" />
          <col className="w-[105px]" />
          <col className="w-[165px]" />
          <col className="w-[130px]" />
          <col className="w-[80px]" />
        </colgroup>
        <thead className="border-b border-[#eadfd4] text-[#62584f]">
          <tr>
            <th className="px-5 py-4"></th>
            <th className="px-4 py-4">Mã SP</th>
            <th className="px-4 py-4">Sản phẩm</th>
            <th className="px-4 py-4">Danh mục</th>
            <th className="px-4 py-4">Thương hiệu</th>
            <th className="px-4 py-4">Giá bán</th>
            <th className="px-4 py-4">Lượt xem</th>
            <th className="px-4 py-4 text-center">Trạng thái</th>
            <th className="px-4 py-4">Ngày đăng</th>
            <th className="px-4 py-4 text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const { views } = getAnalytics(product);
            return (
              <tr key={product.id} onClick={() => onOpenProduct(product.id)} className="cursor-pointer border-b border-[#eadfd4] hover:bg-[#fffaf6]">
                <td className="px-5 py-4"><span className="block h-4 w-4 rounded-full border border-[#b9aca1]" /></td>
                <td className="px-4 py-4 font-semibold">TH{String(product.id).padStart(7, "0")}</td>
                <td className="px-4 py-4"><div className="flex items-center gap-3"><ProductImage src={product.image_url} alt={product.name} className="h-14 w-14 shrink-0 rounded-md object-cover" /><span className="font-semibold leading-5">{product.name}</span></div></td>
                <td className="px-4 py-4">{product.category_name}</td><td className="px-4 py-4">{product.brand || "Chưa rõ"}</td>
                <td className="px-4 py-4 whitespace-nowrap font-semibold">{formatMoney(product.price)}</td>
                <td className="px-4 py-4">{views.toLocaleString("vi-VN")}</td>
                <td className="px-4 py-4 text-center"><span className={`inline-flex min-w-[128px] justify-center whitespace-nowrap rounded-md px-4 py-2 font-bold ${statusStyles[product.status] || statusStyles.returned}`}>{statusLabels[product.status] || product.status}</span></td>
                <td className="px-4 py-4 whitespace-nowrap">{formatDate(product.listed_at)}</td><td className="px-4 py-4 text-center"><MoreHorizontal className="mx-auto" size={17} /></td>
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

function ProductImage({ src, alt, ...props }) { return <img src={src || fallbackImage} alt={alt} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} {...props} />; }

function AccessDenied() { return <main className="grid min-h-screen place-items-center bg-[#fbf6f1]"><div className="text-center"><h1 className="font-display text-5xl font-bold">Không có quyền truy cập</h1><Link to="/" className="mt-7 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Về trang chủ</Link></div></main>; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "Chưa cập nhật"; }
function daysUntil(value) { return value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : Infinity; }
function getAnalytics(product) { return { views: 468 + ((product.id * 137) % 820) }; }
