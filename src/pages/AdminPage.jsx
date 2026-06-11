import {
  BarChart3,
  Download,
  FileBarChart,
  Loader2,
  Plus,
  ShoppingBag,
  Tag,
  TicketPercent,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StaffHeader from "../components/StaffHeader.jsx";
import StaffSidebar from "../components/StaffSidebar.jsx";
import adminHero from "../images/admin-hero.png";
import { api, formatMoney, getCurrentUser } from "../lib/api.js";

const categoryImages = [
  "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=520&q=85",
  "https://images.unsplash.com/photo-1598032895397-b9472444bf93?auto=format&fit=crop&w=520&q=85",
  "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=520&q=85",
  "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=520&q=85",
  "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=520&q=85",
];

const roleLabels = {
  admin: "Admin",
  staff: "Nhân viên",
  customer: "Khách hàng",
};

const accountStatusLabels = {
  active: "Hoạt động",
  inactive: "Tạm khóa",
  banned: "Đã khóa",
};

const quickActions = [
  { type: "account", title: "Thêm tài khoản", detail: "Tạo mới tài khoản cho người dùng hệ thống.", button: "Thêm ngay", icon: UserPlus },
  { type: "category", title: "Thêm danh mục", detail: "Tạo danh mục sản phẩm mới cho cửa hàng.", button: "Thêm ngay", icon: Tag },
  { type: "voucher", title: "Tạo voucher", detail: "Tạo mã giảm giá mới cho chương trình khuyến mãi.", button: "Tạo ngay", icon: TicketPercent },
  { type: "report", title: "Xuất báo cáo", detail: "Tải dữ liệu báo cáo tháng hiện tại từ hệ thống.", button: "Tải ngay", icon: FileBarChart },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [overview, setOverview] = useState(null);
  const [modal, setModal] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  async function loadOverview() {
    setLoading(true);
    try {
      setOverview(await api("/admin/overview"));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    if (user.role !== "admin") {
      navigate(user.role === "staff" ? "/staff" : "/dashboard", { replace: true });
      return;
    }

    loadOverview();
  }, [navigate, user?.role]);

  if (!user || user.role !== "admin") return null;

  const summary = overview?.summary || {};
  const accounts = overview?.accounts || [];
  const categories = overview?.categories || [];
  const vouchers = overview?.vouchers || [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAccounts = accounts.filter((account) => [account.full_name, account.email, account.role].some((value) => value?.toLowerCase().includes(normalizedQuery)));
  const filteredCategories = categories.filter((category) => category.name?.toLowerCase().includes(normalizedQuery));
  const filteredVouchers = vouchers.filter((voucher) => voucher.code?.toLowerCase().includes(normalizedQuery));
  const metrics = [
    { label: "Tổng tài khoản", value: formatCount(summary.account_count), delta: summary.new_account_count, note: "tài khoản mới tháng này", icon: Users },
    { label: "Danh mục", value: formatCount(summary.category_count), delta: summary.new_category_count, note: "danh mục mới tháng này", icon: Tag },
    { label: "Voucher đang hoạt động", value: formatCount(summary.active_voucher_count), delta: summary.new_voucher_count, note: "voucher mới tháng này", icon: TicketPercent },
    { label: "Doanh thu tháng", value: formatMoney(summary.monthly_revenue), delta: summary.monthly_order_count, note: "đơn hàng trong tháng", icon: ShoppingBag },
  ];

  async function createResource(path, payload) {
    setMessage("");
    try {
      const result = await api(path, { method: "POST", body: JSON.stringify(payload) });
      setMessage(result.message);
      setModal("");
      await loadOverview();
      return "";
    } catch (error) {
      setMessage(error.message);
      return error.message;
    }
  }

  function exportReport() {
    if (!overview?.reports) return;
    const revenue = new Map(overview.reports.revenue.map((item) => [item.date, item.value]));
    const orders = new Map(overview.reports.orders.map((item) => [item.date, item.value]));
    const dates = [...new Set([...revenue.keys(), ...orders.keys()])].sort();
    const rows = [["Ngày", "Doanh thu", "Đơn hàng"], ...dates.map((date) => [date, revenue.get(date) || 0, orders.get(date) || 0])];
    const csv = `\uFEFF${rows.map((row) => row.join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-${overview.reports.period.start}-${overview.reports.period.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main id="top" className="min-h-screen bg-cream text-ink">
      <StaffSidebar active="overview" desk="admin" />

      <section className="min-w-0 lg:pl-[244px]">
        <StaffHeader
          user={user}
          roleLabel="Quản trị hệ thống"
          title="Tổng quan"
          query={query}
          setQuery={setQuery}
          searchPlaceholder="Tìm tài khoản, danh mục, voucher..."
        />

        <section className="relative min-h-[228px] overflow-hidden border-b border-[#eadfd5]">
          <img src={adminHero} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/70 to-transparent" />
          <div className="relative z-10 px-7 py-10 sm:px-10 lg:px-11">
            <h1 className="font-display text-4xl font-semibold leading-tight text-[#2e211a] sm:text-[46px]">Tổng quan quản trị</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#7b6f68]">
              Chào mừng bạn quay trở lại,<br />
              dưới đây là tổng quan hoạt động của hệ thống.
            </p>
          </div>
        </section>

        <div className="space-y-4 p-4 lg:p-5">
          {message && <p className="rounded-lg bg-[#f3e4d4] px-4 py-3 text-sm font-medium text-[#7b5336]">{message}</p>}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </section>

          <DashboardSection id="accounts" title="Quản lý tài khoản" action="Thêm tài khoản" onAction={() => setModal("account")}>
            <div className="overflow-x-auto rounded-lg border border-[#eee5de]">
              <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                <thead className="bg-[#fcf9f6] text-[#71665f]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Mã TK</th>
                    <th className="px-4 py-3 font-medium">Họ tên</th>
                    <th className="px-4 py-3 font-medium">Vai trò</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((account) => (
                    <tr key={account.id} className="border-t border-[#eee5de] text-[#685d56]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f7f1eb] text-[11px] text-[#9b8473]">{getInitials(account.full_name)}</span>
                          <span>TK{String(account.id).padStart(4, "0")}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-[#4a3e36]">{account.full_name}</td>
                      <td className="px-4 py-2.5"><RoleBadge role={roleLabels[account.role] || account.role} /></td>
                      <td className="px-4 py-2.5">{account.email}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={accountStatusLabels[account.status] || account.status} /></td>
                    </tr>
                  ))}
                  {!filteredAccounts.length && <EmptyTableRow colSpan={5} text={normalizedQuery ? "Không tìm thấy tài khoản phù hợp." : "Chưa có tài khoản."} />}
                </tbody>
              </table>
            </div>
            <SectionFooter loading={loading} count={filteredAccounts.length} label="tài khoản gần nhất" />
          </DashboardSection>

          <DashboardSection id="categories" title="Danh mục sản phẩm" action="Thêm danh mục" onAction={() => setModal("category")}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {filteredCategories.map((category, index) => (
                <article key={category.name} className="overflow-hidden rounded-lg border border-[#eee5de] bg-white">
                  <img src={category.image_url || categoryImages[index % categoryImages.length]} alt={category.name} className="h-28 w-full object-cover" />
                  <div className="p-3">
                    <h3 className="font-display text-base font-semibold">{category.name}</h3>
                    <p className="mt-1 font-display text-2xl text-[#35281f]">
                      {category.product_count} <span className="font-sans text-[10px] text-[#a3978e]">sản phẩm</span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <SectionFooter loading={loading} count={filteredCategories.length} label="danh mục" />
          </DashboardSection>

          <DashboardSection id="vouchers" title="Voucher" action="Tạo voucher" onAction={() => setModal("voucher")}>
            <div className="overflow-x-auto rounded-lg border border-[#eee5de]">
              <table className="w-full min-w-[850px] border-collapse text-left text-xs">
                <thead className="bg-[#fcf9f6] text-[#71665f]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Mã voucher</th>
                    <th className="px-4 py-3 font-medium">Loại giảm giá</th>
                    <th className="px-4 py-3 font-medium">Giá trị</th>
                    <th className="px-4 py-3 font-medium">Điều kiện</th>
                    <th className="px-4 py-3 font-medium">Hạn dùng</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVouchers.map((voucher) => (
                    <tr key={voucher.code} className="border-t border-[#eee5de] text-[#685d56]">
                      <td className="px-4 py-2.5">{voucher.code}</td>
                      <td className="px-4 py-2.5">{voucher.discount_type === "percent" ? "Giảm theo %" : "Giảm cố định"}</td>
                      <td className="px-4 py-2.5">{voucher.discount_type === "percent" ? `${Number(voucher.discount_value)}%` : formatMoney(voucher.discount_value)}</td>
                      <td className="px-4 py-2.5">Đơn từ {formatMoney(voucher.min_order_value)}</td>
                      <td className="px-4 py-2.5">{formatDate(voucher.end_date)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={getVoucherStatus(voucher)} /></td>
                    </tr>
                  ))}
                  {!filteredVouchers.length && <EmptyTableRow colSpan={6} text={normalizedQuery ? "Không tìm thấy voucher phù hợp." : "Chưa có voucher."} />}
                </tbody>
              </table>
            </div>
            <SectionFooter loading={loading} count={filteredVouchers.length} label="voucher gần nhất" />
          </DashboardSection>

          <ReportsSection reports={overview?.reports} onExport={exportReport} />
          <QuickActions onAction={(type) => type === "report" ? exportReport() : setModal(type)} />
        </div>
      </section>
      {modal && <ResourceModal type={modal} onClose={() => setModal("")} onSubmit={createResource} />}
    </main>
  );
}

function MetricCard({ label, value, delta, note, icon: Icon }) {
  return (
    <article className="rounded-xl border border-[#eee5de] bg-white p-5">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-linen/50 text-clay">
          <Icon size={21} strokeWidth={1.65} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-[#887d75]">{label}</p>
          <p className="mt-1 whitespace-nowrap font-display text-[27px] leading-none text-[#2f251f]">{value}</p>
        </div>
      </div>
      <p className="mt-4 text-[10px] text-muted"><span className="font-semibold text-success">+{formatCount(delta)}</span> {note}</p>
    </article>
  );
}

function DashboardSection({ id, title, action, onAction, children }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border border-[#eee5de] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-[#34271f]">{title}</h2>
        <button onClick={onAction} className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#e6d4c5] bg-[#fffaf5] px-3 text-[11px] text-[#8b654b]">
          <Plus size={14} />
          {action}
        </button>
      </div>
      {children}
    </section>
  );
}

function RoleBadge({ role }) {
  const styles = {
    Admin: "bg-linen/60 text-clay",
    "Nhân viên": "bg-info/10 text-info",
    "Khách hàng": "bg-muted/10 text-muted",
  };
  return <span className={`rounded px-2 py-1 text-[10px] font-semibold ${styles[role]}`}>{role}</span>;
}

function StatusBadge({ status }) {
  const styles = {
    "Hoạt động": "bg-success/10 text-success",
    "Đang hoạt động": "bg-success/10 text-success",
    "Tạm khóa": "bg-warning/10 text-warning",
    "Sắp hết hạn": "bg-warning/10 text-warning",
    "Hết hạn": "bg-danger/10 text-danger",
    "Đã khóa": "bg-danger/10 text-danger",
  };
  return <span className={`rounded px-2 py-1 text-[10px] font-semibold ${styles[status]}`}>{status}</span>;
}

function SectionFooter({ loading, count, label }) {
  return (
    <p className="mt-3 flex h-8 w-full items-center justify-center rounded-md border border-[#eee5de] bg-[#fcfaf8] text-[11px] text-[#846f61]">
      {loading ? "Đang tải dữ liệu..." : count ? `Hiển thị ${count} ${label}` : `Chưa có ${label}`}
    </p>
  );
}

function ReportsSection({ reports, onExport }) {
  const customers = reports?.customers || {};
  return (
    <section id="reports" className="scroll-mt-4 rounded-xl border border-[#eee5de] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-[#34271f]">Báo cáo thống kê</h2>
        <div className="flex gap-3">
          <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#eee5de] px-3 text-[10px] text-[#84776e]">
            Tháng này ({formatDate(reports?.period?.start)} - {formatDate(reports?.period?.end)})
          </span>
          <button onClick={onExport} className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#e6d4c5] bg-[#fffaf5] px-3 text-[10px] text-[#8b654b]">
            <Download size={13} /> Xuất báo cáo
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <ReportCard title="Doanh thu" value={formatMoney(sumSeries(reports?.revenue))}>
          <LineChart data={reports?.revenue} />
        </ReportCard>
        <ReportCard title="Đơn hàng" value={formatCount(sumSeries(reports?.orders))}>
          <BarChart data={reports?.orders} />
        </ReportCard>
        <ReportCard title="Khách hàng mới" value={`+${formatCount(customers.new_count)}`}>
          <DonutChart customers={customers} />
        </ReportCard>
      </div>
    </section>
  );
}

function ReportCard({ title, value, children }) {
  return (
    <article className="rounded-lg border border-[#eee5de] p-3">
      <p className="text-[11px] font-medium text-[#6f625a]">{title}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="font-display text-[21px] text-[#30241e]">{value}</p>
        <span className="text-[9px] text-[#aaa098]">trong tháng hiện tại</span>
      </div>
      <div className="mt-3 h-32">{children}</div>
    </article>
  );
}

function LineChart({ data = [] }) {
  const points = getChartPoints(data, { left: 40, right: 310, top: 18, bottom: 123 });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length ? `${line} 310,123 40,123` : "";
  return (
    <svg viewBox="0 0 320 135" className="h-full w-full" aria-label="Biểu đồ doanh thu">
      {[18, 53, 88, 123].map((y) => <line key={y} x1="40" x2="314" y1={y} y2={y} stroke="var(--color-border)" strokeWidth="1" />)}
      {area && <polygon points={area} fill="var(--color-linen)" />}
      {line && <polyline points={line} fill="none" stroke="var(--color-clay)" strokeWidth="2" />}
      {points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="2.5" fill="var(--color-clay)" />)}
      <ChartLabels data={data} />
    </svg>
  );
}

function BarChart({ data = [] }) {
  const max = Math.max(1, ...data.map((item) => Number(item.value || 0)));
  const barWidth = Math.max(3, Math.min(8, 245 / Math.max(1, data.length) - 2));
  return (
    <svg viewBox="0 0 320 135" className="h-full w-full" aria-label="Biểu đồ đơn hàng">
      {[18, 53, 88, 123].map((y) => <line key={y} x1="32" x2="314" y1={y} y2={y} stroke="var(--color-border)" strokeWidth="1" />)}
      {data.map((item, index) => {
        const height = (Number(item.value || 0) / max) * 100;
        const x = 40 + index * (270 / Math.max(1, data.length));
        return <rect key={item.date} x={x} y={123 - height} width={barWidth} height={height} fill="var(--color-clay)" />;
      })}
      <ChartLabels data={data} />
    </svg>
  );
}

function DonutChart({ customers = {} }) {
  const total = Number(customers.total || 0);
  const newCount = Number(customers.new_count || 0);
  const existingCount = Number(customers.existing_count || 0);
  const newPercent = total ? Math.round((newCount / total) * 100) : 0;
  const existingPercent = total ? 100 - newPercent : 0;
  return (
    <div className="flex h-full items-center justify-center gap-7">
      <div
        className="relative h-[118px] w-[118px] shrink-0 rounded-full"
        style={{ background: `conic-gradient(var(--color-clay) 0 ${newPercent}%, var(--color-linen) ${newPercent}% 100%)` }}
      >
        <div className="absolute inset-[19px] rounded-full bg-white" />
      </div>
      <div className="space-y-3 text-[10px] text-[#81746b]">
        <p><span className="mr-2 inline-block h-2 w-2 rounded-sm bg-clay" />Khách hàng mới&nbsp;&nbsp; {newCount} ({newPercent}%)</p>
        <p><span className="mr-2 inline-block h-2 w-2 rounded-sm bg-linen" />Khách hàng cũ&nbsp;&nbsp; {existingCount} ({existingPercent}%)</p>
      </div>
    </div>
  );
}

function QuickActions({ onAction }) {
  return (
    <section className="rounded-xl border border-[#eee5de] bg-white p-4">
      <h2 className="font-display text-xl font-semibold text-[#34271f]">Thao tác nhanh</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <article key={action.title} className="rounded-lg border border-[#eee5de] p-4">
            <div className="flex gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-linen/50 text-clay">
                <action.icon size={23} strokeWidth={1.6} />
              </span>
              <div>
                <h3 className="text-xs font-semibold text-[#594a40]">{action.title}</h3>
                <p className="mt-1 text-[10px] leading-4 text-[#9b9088]">{action.detail}</p>
              </div>
            </div>
            <button onClick={() => onAction(action.type)} className="mt-4 h-8 w-full rounded-lg border border-linen bg-sidebar text-[11px] text-clay">{action.button}</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResourceModal({ type, onClose, onSubmit }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const config = {
    account: { title: "Thêm tài khoản", path: "/admin/users" },
    category: { title: "Thêm danh mục", path: "/admin/categories" },
    voucher: { title: "Tạo voucher", path: "/admin/vouchers" },
  }[type];

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    setError(await onSubmit(config.path, payload));
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 px-4 py-8">
      <section className="w-full max-w-lg rounded-xl border border-border bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">{config.title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#f7eee7]"><X size={17} /></button>
        </div>
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          {type === "account" && (
            <>
              <FormField name="fullName" label="Họ tên" required />
              <FormField name="email" label="Email" type="email" required />
              <FormField name="password" label="Mật khẩu" type="password" minLength="6" required />
              <FormField name="phone" label="Số điện thoại" />
              <FormSelect name="role" label="Vai trò" defaultValue="customer">
                <option value="customer">Khách hàng</option>
                <option value="staff">Nhân viên</option>
                <option value="admin">Admin</option>
              </FormSelect>
            </>
          )}
          {type === "category" && <FormField name="name" label="Tên danh mục" required />}
          {type === "voucher" && (
            <>
              <FormField name="code" label="Mã voucher" required />
              <FormSelect name="discountType" label="Loại giảm giá" defaultValue="percent">
                <option value="percent">Giảm theo phần trăm</option>
                <option value="fixed">Giảm cố định</option>
              </FormSelect>
              <FormField name="discountValue" label="Giá trị giảm" type="number" min="1" required />
              <FormField name="minOrderValue" label="Giá trị đơn tối thiểu" type="number" min="0" defaultValue="0" required />
              <FormField name="endDate" label="Ngày hết hạn" type="date" min={toInputDate(new Date())} defaultValue={toInputDate(addDays(new Date(), 30))} required />
            </>
          )}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
          <button disabled={submitting} className="mt-2 inline-flex h-11 items-center justify-center rounded-lg bg-[#34271f] text-sm font-semibold text-white disabled:opacity-60">
            {submitting && <Loader2 className="mr-2 animate-spin" size={16} />}
            Lưu dữ liệu
          </button>
        </form>
      </section>
    </div>
  );
}

function FormField({ label, ...props }) {
  return (
    <label>
      <span className="text-xs font-semibold text-[#594b43]">{label}</span>
      <input {...props} className="mt-2 h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-clay" />
    </label>
  );
}

function FormSelect({ label, children, ...props }) {
  return (
    <label>
      <span className="text-xs font-semibold text-[#594b43]">{label}</span>
      <select {...props} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-clay">
        {children}
      </select>
    </label>
  );
}

function EmptyTableRow({ colSpan, text }) {
  return <tr><td colSpan={colSpan} className="px-4 py-6 text-center text-xs text-[#76665c]">{text}</td></tr>;
}

function ChartLabels({ data = [] }) {
  if (!data.length) return null;
  const indexes = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  return indexes.map((index) => {
    const x = 40 + index * (270 / Math.max(1, data.length - 1));
    return <text key={data[index].date} x={x} y="134" fontSize="9" fill="#76665c" textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}>{formatShortDate(data[index].date)}</text>;
  });
}

function getChartPoints(data, bounds) {
  const max = Math.max(1, ...data.map((item) => Number(item.value || 0)));
  return data.map((item, index) => ({
    date: item.date,
    x: bounds.left + index * ((bounds.right - bounds.left) / Math.max(1, data.length - 1)),
    y: bounds.bottom - (Number(item.value || 0) / max) * (bounds.bottom - bounds.top),
  }));
}

function getVoucherStatus(voucher) {
  if (voucher.status !== "active") return "Tạm khóa";
  const daysLeft = (new Date(voucher.end_date).getTime() - Date.now()) / 86400000;
  if (daysLeft < 0) return "Hết hạn";
  if (daysLeft <= 7) return "Sắp hết hạn";
  return "Đang hoạt động";
}

function getInitials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(-3).map((part) => part[0]).join("").toUpperCase();
}

function sumSeries(data = []) {
  return data.reduce((total, item) => total + Number(item.value || 0), 0);
}

function formatCount(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function formatShortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function toInputDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
