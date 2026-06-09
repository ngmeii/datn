import {
  CalendarDays,
  ClipboardCheck,
  Clock3,
  PackageCheck,
  Search,
  Tag,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StaffHeader from "../components/StaffHeader.jsx";
import StaffSidebar from "../components/StaffSidebar.jsx";
import { api, formatMoney, getCurrentUser } from "../lib/api.js";

const heroImage =
  "https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=1200&q=85";

const statusLabels = {
  pending_review: "Chờ duyệt",
  approved: "Chờ tiếp nhận",
  received: "Cần định giá",
  inspecting: "Cần định giá",
  priced: "Chờ người bán xác nhận",
  seller_confirmed: "Chờ đăng bán",
  seller_cancelled: "Đã hủy ký gửi",
  listed: "Đang đăng bán",
  rejected: "Từ chối",
  sold: "Đã bán",
  expired: "Hết hạn",
  returned: "Đã hoàn trả",
};

const statusStyles = {
  pending_review: "bg-warning/10 text-warning",
  approved: "bg-info/10 text-info",
  received: "bg-warning/10 text-warning",
  inspecting: "bg-info/10 text-info",
  priced: "bg-info/10 text-info",
  seller_confirmed: "bg-success/10 text-success",
  seller_cancelled: "bg-danger/10 text-danger",
  listed: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
  sold: "bg-success/10 text-success",
  expired: "bg-warning/10 text-warning",
  returned: "bg-muted/10 text-muted",
};

export default function StaffPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const isStaff = ["staff", "admin"].includes(user?.role);

  async function loadData() {
    const [requestData, orderData, adminData] = await Promise.all([
      api("/consignments").catch(() => []),
      api("/orders").catch(() => []),
      api("/admin/summary").catch(() => null),
    ]);

    setRequests(requestData);
    setOrders(orderData);
    setSummary(adminData?.summary || null);
  }

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!isStaff) return;

    loadData();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadData();
    };
    const intervalId = window.setInterval(refreshWhenVisible, 5000);

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const filteredRequests = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return requests.filter((item) => {
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchKeyword =
        !keyword ||
        item.product_name?.toLowerCase().includes(keyword) ||
        item.seller_name?.toLowerCase().includes(keyword) ||
        String(item.id).includes(keyword);
      return matchStatus && matchKeyword;
    });
  }, [requests, statusFilter, query]);

  const stats = [
    {
      label: "Chờ duyệt",
      value: requests.filter((item) => item.status === "pending_review").length,
      suffix: "đơn",
      icon: Clock3,
      delta: "Yêu cầu mới từ người bán",
    },
    {
      label: "Cần định giá",
      value: requests.filter((item) => ["received", "inspecting"].includes(item.status)).length,
      suffix: "đơn",
      icon: ClipboardCheck,
      delta: "Đã tiếp nhận, chờ định giá",
    },
    {
      label: "Chờ đăng bán",
      value: requests.filter((item) => item.status === "seller_confirmed").length,
      suffix: "đơn",
      icon: PackageCheck,
      delta: "Người bán đã xác nhận",
    },
    {
      label: "Đang đăng bán",
      value: summary?.available_count ?? 0,
      suffix: "sản phẩm",
      icon: Tag,
      delta: "Sản phẩm đang mở bán",
    },
  ];

  async function runAction(action) {
    setMessage("");
    try {
      const result = await action();
      setMessage(result?.message || "Đã cập nhật dữ liệu.");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!user) return null;

  if (!isStaff) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbf6f1] px-6 text-ink">
        <div className="max-w-lg text-center">
          <h1 className="font-display text-5xl font-bold">Không có quyền truy cập</h1>
          <p className="mt-4 text-ink/60">Trang này chỉ dành cho nhân viên và admin.</p>
          <Link to="/" className="mt-7 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">
            Về trang chủ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream text-ink">
      <StaffSidebar active="consignments" />

      <section className="min-w-0 lg:pl-[244px]">
        <StaffHeader
          user={user}
          title="Yêu cầu ký gửi"
          query={query}
          setQuery={setQuery}
          searchPlaceholder="Tìm mã đơn, khách hàng, sản phẩm..."
        />

        <section className="relative overflow-hidden border-b border-border bg-sidebar">
          <div className="relative grid min-h-[320px] gap-8 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_460px] lg:px-16 xl:grid-cols-[minmax(0,1fr)_560px]">
            <div className="relative z-10 max-w-3xl">
              <h1 className="font-display text-5xl font-bold leading-tight md:text-6xl">Quản lý ký gửi</h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[#6d6057]">
                Các trạng thái của quy trình ký gửi được quản lý trực tiếp trong bảng bên dưới: chờ duyệt, chờ tiếp nhận, cần định giá, chờ người bán xác nhận và chờ đăng bán.
              </p>
            </div>
            <div className="relative hidden min-h-[240px] overflow-hidden rounded-l-[3rem] border border-border bg-linen/40 lg:block">
              <img src={heroImage} alt="Khu vực vận hành ký gửi" className="absolute inset-0 h-full w-full object-cover object-center opacity-90 saturate-[0.82]" />
              <div className="absolute inset-0 bg-linen/15" />
              <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-sidebar to-transparent" />
            </div>
          </div>
        </section>

        <div className="px-6 py-8 lg:px-8 xl:px-10">
          <section className="grid gap-5 rounded-md border border-[#eadfd4] bg-white p-5 shadow-soft md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article key={stat.label} className="rounded-md border border-[#eadfd4] p-6">
                <div className="flex items-start gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-sidebar text-clay">
                    <stat.icon size={25} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#6d6057]">{stat.label}</p>
                    <p className="mt-2 whitespace-nowrap font-display text-4xl font-bold xl:text-5xl">
                      {stat.value} <span className="font-sans text-sm font-semibold">{stat.suffix}</span>
                    </p>
                    <p className="mt-3 text-xs font-semibold text-clay">{stat.delta}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>

          {message && <p className="mt-6 rounded-md bg-[#f2e4d8] px-4 py-3 text-sm font-semibold text-[#7a4b2d]">{message}</p>}

          <section className="mt-8 rounded-md border border-[#eadfd4] bg-white shadow-soft">
            <div className="grid gap-4 border-b border-[#eadfd4] p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.6fr]">
              <FilterSelect label="Trạng thái" value={statusFilter} onChange={setStatusFilter}>
                <option value="">Tất cả trạng thái</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </FilterSelect>
              <FilterSelect label="Danh mục">
                <option>Tất cả danh mục</option>
              </FilterSelect>
              <FilterSelect label="Thương hiệu">
                <option>Tất cả thương hiệu</option>
              </FilterSelect>
              <label>
                <span className="text-xs font-bold text-[#5f554d]">Ngày gửi</span>
                <span className="mt-2 flex h-12 items-center gap-2 rounded-md border border-[#eadfd4] px-4 text-sm text-[#7c6e62]">
                  Chọn khoảng ngày <CalendarDays className="ml-auto" size={16} />
                </span>
              </label>
              <label>
                <span className="text-xs font-bold text-[#5f554d]">Tìm kiếm</span>
                <span className="mt-2 flex h-12 items-center gap-2 rounded-md border border-[#eadfd4] px-4">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    placeholder="Nhập mã đơn, tên KH..."
                  />
                  <Search size={17} />
                </span>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#eadfd4] text-xs text-[#62584f]">
                    <th className="w-14 px-5 py-4"></th>
                    <th className="px-4 py-4">Mã đơn</th>
                    <th className="px-4 py-4">Khách hàng</th>
                    <th className="px-4 py-4">Sản phẩm</th>
                    <th className="px-4 py-4">Danh mục</th>
                    <th className="px-4 py-4">Thương hiệu</th>
                    <th className="px-4 py-4">Giá đề xuất</th>
                    <th className="px-4 py-4">Trạng thái</th>
                    <th className="px-4 py-4">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-b border-[#eadfd4] hover:bg-[#fffaf6]"
                      onClick={() => navigate(`/staff/consignments/${item.id}`)}
                    >
                      <td className="px-5 py-4">
                        <span className="block h-4 w-4 rounded-full border border-[#b9aca1]" />
                      </td>
                      <td className="px-4 py-4 font-bold">THK{String(item.id).padStart(6, "0")}</td>
                      <td className="px-4 py-4">
                        <p className="font-semibold">{item.seller_name || "Khách ký gửi"}</p>
                        <p className="mt-1 text-xs text-[#7c6e62]">0901 234 567</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <img src={getRequestImage(item)} alt={item.product_name} className="h-14 w-16 rounded-md object-cover" />
                          <span className="font-semibold">{item.product_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">{item.category_name || "Thời trang"}</td>
                      <td className="px-4 py-4">{item.brand || "Chưa rõ"}</td>
                      <td className="px-4 py-4">
                        <p>{formatMoney(item.expected_price)}</p>
                        {item.final_price && <p className="mt-1 text-xs text-[#7c6e62]">{formatMoney(item.final_price)}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-md px-3 py-2 text-xs font-bold ${statusStyles[item.status] || "bg-[#f0ede8] text-[#6c6258]"}`}>
                          {statusLabels[item.status] || item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                        <RowActions item={item} runAction={runAction} navigate={navigate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-5 py-4 text-sm text-[#7c6e62]">
              <span>Hiển thị 1-{filteredRequests.length} của {requests.length} yêu cầu</span>
              <div className="flex gap-2">
                {[1, 2, 3].map((page) => (
                  <button key={page} className={page === 1 ? "h-9 w-9 rounded-md bg-[#f2e4d8] font-bold text-[#8a572f]" : "h-9 w-9 rounded-md border border-[#eadfd4]"}>
                    {page}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-md border border-[#eadfd4] bg-white p-6 shadow-soft">
            <h2 className="font-display text-3xl font-bold">Đơn hàng cần xử lý</h2>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {orders.slice(0, 6).map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-4 rounded-md border border-[#eadfd4] p-4">
                  <div>
                    <p className="font-bold">Đơn hàng #{order.id}</p>
                    <p className="mt-1 text-sm text-[#7c6e62]">{order.buyer_name || order.payment_method}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatMoney(order.total)}</p>
                    <p className="text-xs text-[#7c6e62]">{order.status}</p>
                  </div>
                </div>
              ))}
              {!orders.length && <p className="text-sm text-[#7c6e62]">Chưa có đơn hàng.</p>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function RowActions({ item, runAction, navigate }) {
  if (item.status === "pending_review") {
    return (
      <div className="flex flex-wrap gap-2">
        <SmallButton onClick={() => runAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }))}>Duyệt</SmallButton>
        <SmallButton danger onClick={() => runAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }))}>Từ chối</SmallButton>
      </div>
    );
  }

  if (item.status === "approved") {
    return <SmallButton onClick={() => runAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "received" }) }))}>Tiếp nhận</SmallButton>;
  }

  if (["received", "inspecting"].includes(item.status)) {
    return <SmallButton onClick={() => navigate(`/staff/consignments/${item.id}`)}>Định giá</SmallButton>;
  }

  if (item.status === "seller_confirmed") {
    return <SmallButton onClick={() => runAction(() => api(`/consignments/${item.id}/publish`, { method: "POST" }))}>Đăng bán</SmallButton>;
  }

  return <SmallButton onClick={() => navigate(`/staff/consignments/${item.id}`)}>Xem chi tiết</SmallButton>;
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label>
      <span className="text-xs font-bold text-[#5f554d]">{label}</span>
      <select value={value} onChange={(event) => onChange?.(event.target.value)} className="mt-2 h-12 w-full rounded-md border border-[#eadfd4] bg-white px-4 text-sm outline-none">
        {children}
      </select>
    </label>
  );
}

function SmallButton({ children, danger, ...props }) {
  return (
    <button className={danger ? "rounded-md border border-red-300 px-3 py-2 text-xs font-bold text-red-600" : "rounded-md bg-ink px-3 py-2 text-xs font-bold text-white"} {...props}>
      {children}
    </button>
  );
}


function getRequestImage(item) {
  if (!item?.images) {
    return "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=700&q=85";
  }

  if (Array.isArray(item.images)) {
    return item.images[0] || "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=700&q=85";
  }

  try {
    const parsed = JSON.parse(item.images);
    return parsed[0] || "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=700&q=85";
  } catch {
    return "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=700&q=85";
  }
}
