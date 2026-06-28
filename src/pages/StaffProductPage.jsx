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
import { matchesEntityKeyword } from "../lib/search.js";

const heroImage = "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1300&q=90";
const fallbackImage = "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=700&q=85";
const PAGE_SIZE = 15;

const statusLabels = {
  on_sale: "Đang đăng bán",
  reserved: "Đã đặt giữ",
  sold: "Đã bán",
  expired: "Sắp hết hạn",
  returned: "Tạm ẩn",
};

const statusStyles = {
  on_sale: "bg-success/10 text-success",
  reserved: "bg-info/10 text-info",
  sold: "bg-success/10 text-success",
  expired: "bg-warning/10 text-warning",
  returned: "bg-muted/10 text-muted",
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
  const [page, setPage] = useState(1);
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
      matchesEntityKeyword(keyword, {
        id: product.id,
        prefixes: ["TH", "SP"],
        width: 7,
        texts: [product.name, product.brand],
      }) &&
      (!category || product.category_name === category) &&
      (!status || product.status === status) &&
      (!brand || product.brand === brand)
    ));
  }, [products, query, category, status, brand]);

  useEffect(() => {
    setPage(1);
  }, [query, category, status, brand]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const brands = [...new Set(products.map((product) => product.brand).filter(Boolean))];
  const expiringCount = products.filter((product) => {
    const days = daysUntil(product.expires_at);
    return days >= 0 && days <= 7;
  }).length;
  const todayViews = products.reduce((sum, product) => sum + getAnalytics(product).views, 0);

  if (!user) return null;
  if (!isStaff) return <AccessDenied />;

  return (
    <main className="min-h-screen bg-cream text-ink">
      <StaffSidebar active="products" />

      <section className="min-w-0 lg:pl-[244px]">
        <StaffHeader
          user={user}
          roleLabel={user.role === "admin" ? "Quản trị hệ thống" : "Chuyên viên kiểm định"}
          title="Sản phẩm đăng bán"
          query={query}
          setQuery={setQuery}
          searchPlaceholder="Tìm tên sản phẩm, mã SP, thương hiệu..."
        />

        <section className="relative overflow-hidden border-b border-border bg-sidebar">
          <div className="relative grid min-h-[220px] gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-12 xl:grid-cols-[minmax(0,1fr)_430px]">
            <div className="relative z-10 max-w-3xl">
              <h1 className="font-display text-4xl font-bold leading-tight md:text-5xl">Sản phẩm đăng bán</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6d6057]">
                Theo dõi, quản lý và tối ưu các sản phẩm đang hiển thị để tăng hiệu quả bán hàng. Cập nhật thông tin, giá bán, trạng thái và chiến dịch một cách dễ dàng.
              </p>
            </div>
            <div className="relative hidden min-h-[160px] overflow-hidden rounded-l-[2rem] border border-border bg-linen/40 lg:block">
              <img src={heroImage} alt="Sản phẩm đăng bán" className="absolute inset-0 h-full w-full object-cover object-center opacity-90 saturate-[0.82]" />
              <div className="absolute inset-0 bg-linen/15" />
              <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-sidebar to-transparent" />
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
            <ProductTable products={visibleProducts} onOpenProduct={(productId) => navigate(`/staff/products/${productId}`)} />
            <Pagination page={safePage} totalPages={totalPages} count={filteredProducts.length} total={products.length} onPageChange={setPage} />
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
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-sidebar text-clay"><Icon size={25} /></span>
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
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[48px]" />
          <col className="w-[112px]" />
          <col />
          <col className="w-[130px]" />
          <col className="w-[155px]" />
          <col className="w-[125px]" />
          <col className="w-[80px]" />
        </colgroup>
        <thead className="border-b border-[#eadfd4] text-[#62584f]">
          <tr>
            <th className="px-5 py-4"></th>
            <th className="px-4 py-4">Mã SP</th>
            <th className="px-4 py-4">Sản phẩm</th>
            <th className="px-4 py-4">Giá bán</th>
            <th className="px-4 py-4 text-center">Trạng thái</th>
            <th className="px-4 py-4 text-center">Ngày đăng</th>
            <th className="px-4 py-4 text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            return (
              <tr key={product.id} onClick={() => onOpenProduct(product.id)} className="cursor-pointer border-b border-[#eadfd4] hover:bg-[#fffaf6]">
                <td className="px-5 py-4"><span className="block h-4 w-4 rounded-full border border-[#b9aca1]" /></td>
                <td className="px-4 py-4 font-semibold">TH{String(product.id).padStart(7, "0")}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <ProductImage src={product.image_url} alt={product.name} className="h-14 w-14 shrink-0 rounded-md object-cover" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold leading-5">{product.name}</p>
                      <p className="mt-1 truncate text-xs text-[#7c6e62]">
                        {product.category_name || "Chưa phân loại"}{product.brand ? ` · ${product.brand}` : ""}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap font-semibold">{formatMoney(product.price)}</td>
                <td className="px-4 py-4 text-center"><span className={`inline-flex min-w-[118px] justify-center whitespace-nowrap rounded-md px-3 py-2 font-bold ${statusStyles[product.status] || statusStyles.returned}`}>{statusLabels[product.status] || product.status}</span></td>
                <td className="px-4 py-4 text-center whitespace-nowrap">{formatDate(product.listed_at)}</td><td className="px-4 py-4 text-center"><MoreHorizontal className="mx-auto" size={17} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, totalPages, count, total, onPageChange }) {
  const start = count ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE, count);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-[#7c6e62]">
      <span>Hiển thị {start} - {end} của {count} sản phẩm{count !== total ? ` (lọc từ ${total})` : ""}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="grid h-8 w-8 place-items-center rounded-md border border-[#eadfd4] disabled:opacity-50"><ChevronLeft size={15} /></button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <button
            key={pageNumber}
            onClick={() => onPageChange(pageNumber)}
            className={pageNumber === page ? "h-8 w-8 rounded-md border border-[#c48658] bg-[#fff4ea] font-bold text-[#8a572f]" : "h-8 w-8 rounded-md border border-[#eadfd4]"}
          >
            {pageNumber}
          </button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="grid h-8 w-8 place-items-center rounded-md border border-[#eadfd4] disabled:opacity-50"><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

function ProductImage({ src, alt, ...props }) { return <img src={src || fallbackImage} alt={alt} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} {...props} />; }

function AccessDenied() { return <main className="grid min-h-screen place-items-center bg-cream"><div className="text-center"><h1 className="font-display text-5xl font-bold">Không có quyền truy cập</h1><Link to="/" className="mt-7 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Về trang chủ</Link></div></main>; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "Chưa cập nhật"; }
function daysUntil(value) { return value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : Infinity; }
function getAnalytics(product) { return { views: 468 + ((product.id * 137) % 820) }; }
