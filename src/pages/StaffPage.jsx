import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  Eye,
  PackageCheck,
  Pencil,
  ShoppingCart,
  Tag,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StaffHeader from "../components/StaffHeader.jsx";
import StaffSidebar from "../components/StaffSidebar.jsx";
import { api, formatMoney, getCurrentUser } from "../lib/api.js";

const requestStatusLabels = {
  pending_review: "Mới",
  approved: "Chờ tiếp nhận",
  received: "Chờ kiểm định",
  inspecting: "Chờ kiểm định",
  priced: "Chờ xác nhận",
  seller_confirmed: "Chờ đăng bán",
  listed: "Đang đăng bán",
  rejected: "Từ chối",
  seller_cancelled: "Đã hủy",
};

export default function StaffPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [requests, setRequests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [query, setQuery] = useState("");
  const isStaff = ["staff", "admin"].includes(user?.role);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!isStaff) return;

    Promise.all([
      api("/consignments").catch(() => []),
      api("/orders").catch(() => []),
      api("/products?status=").catch(() => []),
      api("/admin/activity?limit=8").catch(() => []),
    ]).then(([requestData, orderData, productData, activityData]) => {
      setRequests(requestData);
      setOrders(orderData);
      setProducts(productData);
      setActivities(activityData);
    });
  }, []);

  const overview = useMemo(() => {
    const newRequests = requests.filter((item) => item.status === "pending_review");
    const needInspection = requests.filter((item) => ["approved", "received", "inspecting"].includes(item.status));
    const waitConfirmOrders = orders.filter((item) => ["pending_confirmation", "pending_payment"].includes(item.status));
    const activeProducts = products.filter((item) => item.status === "on_sale");
    const todayRevenue = orders
      .filter((item) => item.status === "completed" || item.payment_status === "paid")
      .reduce((sum, item) => sum + Number(item.total || 0), 0);

    return {
      newRequests: newRequests.length,
      needInspection: needInspection.length,
      newOrders: waitConfirmOrders.length || orders.length,
      todayRevenue,
      activeProducts: activeProducts.length,
      waitConfirmOrders: waitConfirmOrders.length,
      needUpdateOrders: orders.filter((item) => ["confirmed", "shipping"].includes(item.status)).length,
      expiringProducts: products.filter((item) => {
        const expiresAt = item.expires_at ? new Date(item.expires_at).getTime() : Infinity;
        return expiresAt - Date.now() <= 7 * 86400000;
      }).length,
    };
  }, [requests, orders, products]);

  const latestRequests = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return requests
      .filter((item) => !keyword || item.product_name?.toLowerCase().includes(keyword) || item.seller_name?.toLowerCase().includes(keyword) || String(item.id).includes(keyword))
      .slice(0, 5);
  }, [requests, query]);

  if (!user) return null;
  if (!isStaff) return <AccessDenied />;

  const kpis = [
    { label: "Yêu cầu ký gửi mới", value: overview.newRequests, icon: ClipboardCheck, delta: "9,1% so với hôm qua" },
    { label: "Sản phẩm chờ kiểm định", value: overview.needInspection, icon: Tag, delta: "5,6% so với hôm qua" },
    { label: "Đơn hàng mới", value: overview.newOrders, icon: ShoppingCart, delta: "15,4% so với hôm qua" },
    { label: "Doanh thu hôm nay (VND)", value: formatMoney(overview.todayRevenue), icon: WalletCards, delta: "12,7% so với hôm qua" },
  ];

  return (
    <main className="min-h-screen bg-cream text-ink">
      <StaffSidebar active="overview" />

      <section className="min-w-0 lg:pl-[244px]">
        <StaffHeader
          user={user}
          title="Tổng quan"
          query={query}
          setQuery={setQuery}
          searchPlaceholder="Tìm yêu cầu, đơn hàng, sản phẩm..."
        />

        <div className="px-6 py-7 lg:px-8 xl:px-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold leading-none">Tổng quan</h1>
              <p className="mt-2 text-sm text-muted">Tổng quan hoạt động tại cửa hàng hôm nay.</p>
            </div>
            <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-[#6d5f55] shadow-sm">
              <CalendarDays size={17} className="text-clay" />
              Hôm nay: {formatShortDate(new Date())}
            </button>
          </div>

          <section className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map((item) => (
              <article key={item.label} className="rounded-xl border border-border bg-white p-6 shadow-soft">
                <div className="flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-linen text-clay">
                    <item.icon size={24} strokeWidth={1.7} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#6d6057]">{item.label}</p>
                    <p className="mt-2 font-display text-3xl font-bold">{item.value}</p>
                    <p className="mt-3 text-xs font-semibold text-success">▲ {item.delta}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.85fr_0.75fr]">
            <ChartCard title="Doanh thu 7 ngày qua (VND)" action="7 ngày qua">
              <RevenueChart orders={orders} />
            </ChartCard>

            <ChartCard title="Đơn hàng theo trạng thái">
              <OrderDonut orders={orders} />
            </ChartCard>

            <TaskPanel overview={overview} />
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.85fr_0.75fr]">
            <NewRequestsTable requests={latestRequests} navigate={navigate} />
            <ActivityPanel activities={activities} />
          </section>
        </div>
      </section>
    </main>
  );
}

function ChartCard({ title, action, children }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {action && <button className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted">{action}</button>}
      </div>
      <div className="mt-4 h-[245px]">{children}</div>
    </section>
  );
}

function RevenueChart({ orders }) {
  const points = buildRevenueSeries(orders);
  const max = Math.max(1, ...points.map((item) => item.value));
  const coords = points.map((item, index) => ({
    ...item,
    x: 40 + index * (300 / Math.max(1, points.length - 1)),
    y: 202 - (item.value / max) * 155,
  }));
  const line = coords.map((item) => `${item.x},${item.y}`).join(" ");
  const area = `40,202 ${line} 340,202`;

  return (
    <svg viewBox="0 0 360 230" className="h-full w-full">
      {[45, 85, 125, 165, 202].map((y) => <line key={y} x1="38" x2="340" y1={y} y2={y} stroke="var(--color-border)" />)}
      <polygon points={area} fill="var(--color-linen)" opacity="0.78" />
      <polyline points={line} fill="none" stroke="var(--color-clay)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((item) => <circle key={item.label} cx={item.x} cy={item.y} r="4" fill="var(--color-clay)" />)}
      {coords.map((item, index) => index % 2 === 0 && <text key={item.label} x={item.x} y="222" textAnchor="middle" fontSize="10" fill="var(--color-muted)">{item.label}</text>)}
    </svg>
  );
}

function OrderDonut({ orders }) {
  const groups = [
    ["Chờ xác nhận", orders.filter((item) => ["pending_confirmation", "pending_payment"].includes(item.status)).length, "var(--color-warning)"],
    ["Đang xử lý", orders.filter((item) => item.status === "confirmed").length, "var(--color-clay)"],
    ["Đang giao hàng", orders.filter((item) => item.status === "shipping").length, "var(--color-info)"],
    ["Hoàn thành", orders.filter((item) => item.status === "completed").length, "var(--color-success)"],
    ["Đã hủy", orders.filter((item) => ["cancelled", "refunded"].includes(item.status)).length, "var(--color-linen)"],
  ];
  const total = Math.max(orders.length, groups.reduce((sum, item) => sum + item[1], 0), 1);
  let offset = 25;

  return (
    <div className="flex h-full items-center justify-center gap-7">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 44 44" className="-rotate-90">
          {groups.map(([label, value, color]) => {
            const size = (value / total) * 100;
            const segment = <circle key={label} cx="22" cy="22" r="15.9" fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${size} ${100 - size}`} strokeDashoffset={offset} />;
            offset -= size;
            return segment;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-3xl font-bold">{orders.length}</p>
            <p className="text-xs text-muted">Tổng đơn</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 text-xs">
        {groups.map(([label, value, color]) => (
          <p key={label} className="flex items-center gap-2 text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span>{label}</span>
            <span className="font-bold text-ink">{value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function TaskPanel({ overview }) {
  const tasks = [
    ["Yêu cầu ký gửi mới", overview.newRequests, ClipboardCheck],
    ["Sản phẩm chờ kiểm định", overview.needInspection, Tag],
    ["Đơn hàng chờ xác nhận", overview.waitConfirmOrders, ShoppingCart],
    ["Đơn hàng cần cập nhật", overview.needUpdateOrders, WalletCards],
    ["Sản phẩm sắp hết hạn ký gửi", overview.expiringProducts, Bell],
  ];

  return (
    <section className="min-w-0 rounded-xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Công việc cần xử lý</h2>
        <Link to="/staff/consignments" className="text-xs font-bold text-clay">Xem tất cả</Link>
      </div>
      <div className="mt-4 space-y-3">
        {tasks.map(([label, value, Icon]) => (
          <div key={label} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#fffaf6]">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-linen text-clay"><Icon size={17} /></span>
            <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
            <span className="rounded-md bg-linen px-3 py-1 text-sm font-bold text-[#7a5537]">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function NewRequestsTable({ requests, navigate }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-white p-5 shadow-soft xl:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Yêu cầu ký gửi mới</h2>
        <Link to="/staff/consignments" className="text-xs font-bold text-clay">Xem tất cả</Link>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[780px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[110px]" />
            <col className="w-[160px]" />
            <col className="w-[180px]" />
            <col className="w-[105px]" />
            <col className="w-[140px]" />
            <col className="w-[120px]" />
          </colgroup>
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-3 py-3">Mã yêu cầu</th>
              <th className="px-3 py-3">Người gửi</th>
              <th className="px-3 py-3">Ngày gửi</th>
              <th className="px-3 py-3">Số sản phẩm</th>
              <th className="px-3 py-3 text-center">Trạng thái</th>
              <th className="px-3 py-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-3 font-bold">KG{String(item.id).padStart(4, "0")}</td>
                <td className="px-3 py-3">{item.seller_name || "Khách ký gửi"}</td>
                <td className="px-3 py-3">{formatDateTime(item.created_at)}</td>
                <td className="px-3 py-3">1</td>
                <td className="px-3 py-3 text-center"><span className="inline-flex min-w-[96px] justify-center whitespace-nowrap rounded-md bg-linen px-3 py-1 text-xs font-bold text-[#8a572f]">{requestStatusLabels[item.status] || item.status}</span></td>
                <td className="px-3 py-3">
                  <div className="flex justify-center gap-2">
                    <IconButton icon={Eye} onClick={() => navigate(`/staff/consignments/${item.id}`)} />
                    <IconButton icon={Pencil} onClick={() => navigate(`/staff/consignments/${item.id}`)} />
                    <IconButton icon={Trash2} />
                  </div>
                </td>
              </tr>
            ))}
            {!requests.length && (
              <tr>
                <td colSpan="6" className="px-3 py-8 text-center text-muted">Chưa có yêu cầu ký gửi mới.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActivityPanel({ activities }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl font-bold leading-tight">Hoạt động gần đây</h2>
        <span className="text-xs font-bold text-clay">Xem tất cả</span>
      </div>
      <div className="mt-4 space-y-4">
        {activities.map((item, index) => (
          <div key={item.id || `${item.message}-${index}`} className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/10 text-success">
              <ActivityIcon item={item} />
            </span>
            <div>
              <p className="text-sm font-semibold leading-5">{item.message}</p>
              <p className="mt-1 text-xs text-muted">{formatRelative(item.created_at)}</p>
            </div>
          </div>
        ))}
        {!activities.length && <p className="text-sm text-muted">Chưa có hoạt động gần đây.</p>}
      </div>
    </section>
  );
}

function ActivityIcon({ item }) {
  if (item.entity_type === "product") return <PackageCheck size={16} />;
  if (item.entity_type === "order") return <ShoppingCart size={16} />;
  return <ClipboardCheck size={16} />;
}

function IconButton({ icon: Icon, ...props }) {
  return <button className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted hover:bg-linen hover:text-clay" {...props}><Icon size={15} /></button>;
}

function AccessDenied() {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-6 text-ink">
      <div className="max-w-lg text-center">
        <h1 className="font-display text-5xl font-bold">Không có quyền truy cập</h1>
        <Link to="/" className="mt-7 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Về trang chủ</Link>
      </div>
    </main>
  );
}

function buildRevenueSeries(orders) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const value = orders
      .filter((item) => String(item.created_at || "").slice(0, 10) === key)
      .reduce((sum, item) => sum + Number(item.total || 0), 0);
    return { label: formatShortDate(date).slice(0, 5), value };
  });
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatRelative(value) {
  if (!value) return "Vừa xong";
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}
