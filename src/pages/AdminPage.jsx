import {
  BadgeDollarSign,
  BadgePercent,
  CalendarDays,
  CheckCheck,
  Clock3,
  CloudUpload,
  ClipboardCheck,
  Database,
  Download,
  Eye,
  FileText,
  Grid2x2,
  Loader2,
  Lock,
  Mail,
  MoreVertical,
  Package,
  Pencil,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  TicketPercent,
  Upload,
  UserRound,
  UserRoundCog,
  Users,
  Wallet,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import StaffHeader from "../components/StaffHeader.jsx";
import StaffSidebar from "../components/StaffSidebar.jsx";
import adminHero from "../images/admin-hero.png";
import { api, getCurrentUser, uploadImage } from "../lib/api.js";

const roleLabels = {
  admin: "Admin",
  staff: "Nhân viên",
  customer: "Khách hàng",
};

const accountStatusLabels = {
  active: "Hoạt động",
  inactive: "Tạm khóa",
  locked: "Đã khóa",
  banned: "Đã khóa",
};

const accountCodePrefix = {
  customer: "KH",
  staff: "NV",
  admin: "AD",
};

const ACCOUNT_PAGE_SIZE = 12;
const CATEGORY_PAGE_SIZE = 8;
const VOUCHER_PAGE_SIZE = 5;
const reportCategoryColors = ["#ad6a3e", "#d6a766", "#527376", "#6f9b8c", "#a9b5aa", "#ead9ca"];
const defaultSettings = {
  storeName: "The Heirloom",
  contactEmail: "contact@theheirloom.vn",
  phone: "(+84) 28 3822 6699",
  address: "72 Lê Thánh Tôn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh, Việt Nam",
  logoUrl: "",
  currency: "VND",
  timezone: "Asia/Ho_Chi_Minh",
  orderPrefix: "DH",
  senderName: "The Heirloom",
  senderEmail: "noreply@theheirloom.vn",
  emailNotifications: true,
  orderNotifications: true,
  consignmentNotifications: true,
  privacyPolicy: "",
  terms: "",
  returnPolicy: "",
  autoBackup: false,
  backupFrequency: "weekly",
};

const sectionMeta = {
  overview: {
    title: "Tổng quan",
    heading: "Tổng quan quản trị",
    description: "Theo dõi nhanh các nhóm dữ liệu và điều hướng tới khu vực quản trị phù hợp.",
    searchPlaceholder: "Tìm kiếm...",
  },
  accounts: {
    title: "Quản lý tài khoản",
    heading: "Quản lý tài khoản",
    description: "Quản lý tất cả tài khoản người dùng trong hệ thống, bao gồm khách hàng, nhân viên và phân quyền.",
    searchPlaceholder: "Tìm theo tên, email hoặc SDT...",
  },
  categories: {
    title: "Danh mục sản phẩm",
    heading: "Danh mục sản phẩm",
    description: "Quản lý và tổ chức danh mục sản phẩm cho hệ thống ký gửi The Heirloom.",
    searchPlaceholder: "Tìm kiếm danh mục...",
  },
  vouchers: {
    title: "Voucher",
    heading: "Voucher",
    description: "Khu vực quản trị voucher đang được giữ khung để đồng bộ với sidebar Admin.",
    searchPlaceholder: "Tìm kiếm voucher...",
  },
  reports: {
    title: "Báo cáo thống kê",
    heading: "Báo cáo thống kê",
    description: "Theo dõi các số liệu quản trị, doanh thu và tăng trưởng vận hành.",
    searchPlaceholder: "Tìm kiếm báo cáo...",
  },
  settings: {
    title: "Cài đặt hệ thống",
    heading: "Cài đặt hệ thống",
    description: "Cấu hình và quản lý các thông tin chung của hệ thống The Heirloom.",
    searchPlaceholder: "Tìm kiếm cài đặt...",
  },
};

export default function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const [overview, setOverview] = useState(null);
  const [modal, setModal] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [voucherStatusFilter, setVoucherStatusFilter] = useState("");
  const [voucherTypeFilter, setVoucherTypeFilter] = useState("");
  const today = toDateKey(new Date());
  const [reportStartDate, setReportStartDate] = useState(`${today.slice(0, 8)}01`);
  const [reportEndDate, setReportEndDate] = useState(today);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportExports, setReportExports] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [accountPage, setAccountPage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const [voucherPage, setVoucherPage] = useState(1);

  const activeSection = useMemo(() => getSectionFromHash(location.hash), [location.hash]);
  const meta = sectionMeta[activeSection] || sectionMeta.overview;

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

  useEffect(() => {
    if (!user || user.role !== "admin" || activeSection !== "reports") return;
    setReportLoading(true);
    setReportMessage("");
    Promise.all([
      api(`/admin/reports?start=${reportStartDate}&end=${reportEndDate}`),
      api("/admin/report-exports?limit=5"),
    ])
      .then(([reportData, exportRows]) => {
        setReport(reportData);
        setReportExports(exportRows.map(normalizeReportExport));
      })
      .catch((error) => setReportMessage(error.message))
      .finally(() => setReportLoading(false));
  }, [activeSection, reportEndDate, reportStartDate, user?.role]);

  useEffect(() => {
    if (!user || user.role !== "admin" || activeSection !== "settings") return;
    setSettingsLoading(true);
    setSettingsMessage("");
    api("/admin/settings")
      .then((data) => setSettings({ ...defaultSettings, ...(data.settings || {}) }))
      .catch((error) => setSettingsMessage(error.message))
      .finally(() => setSettingsLoading(false));
  }, [activeSection, user?.role]);

  useEffect(() => {
    setQuery("");
    setRoleFilter("");
    setStatusFilter("");
    setVoucherStatusFilter("");
    setVoucherTypeFilter("");
    setAccountPage(1);
    setCategoryPage(1);
    setVoucherPage(1);
    setMessage("");
  }, [activeSection]);

  if (!user || user.role !== "admin") return null;

  const summary = overview?.summary || {};
  const accounts = overview?.accounts || [];
  const categories = overview?.categories || [];
  const vouchers = overview?.vouchers || [];

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const previousMonthStart = new Date(currentMonthStart);
  previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
  const previousMonthEnd = new Date(currentMonthStart.getTime() - 1);

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesQuery =
        !normalizedQuery ||
        [account.full_name, account.email, account.phone, roleLabels[account.role], makeAccountCode(account)].some((value) =>
          String(value || "").toLowerCase().includes(normalizedQuery),
        );
      const matchesRole = !roleFilter || account.role === roleFilter;
      const matchesStatus = !statusFilter || account.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [accounts, query, roleFilter, statusFilter]);

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return categories.filter((category) =>
      !normalizedQuery ||
      [category.name, makeCategoryCode(category)].some((value) =>
        String(value || "").toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [categories, query]);

  const filteredVouchers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return vouchers.filter((voucher) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          voucher.code,
          getVoucherDisplayName(voucher),
          getVoucherConditionLabel(voucher),
          getVoucherTypeLabel(voucher.discount_type),
        ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      const matchesStatus = !voucherStatusFilter || getVoucherUiStatus(voucher) === voucherStatusFilter;
      const matchesType = !voucherTypeFilter || voucher.discount_type === voucherTypeFilter;
      return matchesQuery && matchesStatus && matchesType;
    });
  }, [query, vouchers, voucherStatusFilter, voucherTypeFilter]);

  useEffect(() => {
    setAccountPage(1);
  }, [query, roleFilter, statusFilter]);

  useEffect(() => {
    setCategoryPage(1);
  }, [query]);

  useEffect(() => {
    setVoucherPage(1);
  }, [query, voucherStatusFilter, voucherTypeFilter]);

  const accountMetrics = useMemo(() => {
    const total = accounts.length;
    const customers = accounts.filter((account) => account.role === "customer").length;
    const staffCount = accounts.filter((account) => account.role === "staff").length;
    const locked = accounts.filter((account) => account.status !== "active").length;
    const thisMonth = summarizeAccountsByPeriod(accounts, currentMonthStart, new Date());
    const previousMonth = summarizeAccountsByPeriod(accounts, previousMonthStart, previousMonthEnd);

    return [
      {
        label: "Tổng tài khoản",
        value: formatCount(total),
        delta: compareCount(thisMonth.total, previousMonth.total),
        icon: Users,
      },
      {
        label: "Khách hàng",
        value: formatCount(customers),
        delta: compareCount(thisMonth.customer, previousMonth.customer),
        icon: UserRound,
      },
      {
        label: "Nhân viên",
        value: formatCount(staffCount),
        delta: compareCount(thisMonth.staff, previousMonth.staff),
        icon: UserRoundCog,
      },
      {
        label: "Tài khoản bị khóa",
        value: formatCount(locked),
        delta: compareCount(thisMonth.locked, previousMonth.locked, true),
        icon: Lock,
      },
    ];
  }, [accounts]);

  const categoryMetrics = useMemo(() => {
    const totalCategories = Number(summary.category_count || categories.length);
    const activeCategories = categories.filter((category) => Number(category.product_count || 0) > 0).length;
    const totalProducts = categories.reduce((sum, category) => sum + Number(category.product_count || 0), 0);
    const newCategories = Number(summary.new_category_count || 0);

    return [
      {
        label: "Tổng danh mục",
        value: formatCount(totalCategories),
        delta: compareCount(newCategories, Math.max(totalCategories - newCategories, 0)),
        icon: Grid2x2,
      },
      {
        label: "Danh mục đang hoạt động",
        value: formatCount(activeCategories),
        note: `${Math.round((activeCategories / Math.max(totalCategories, 1)) * 100)}% tổng danh mục`,
        icon: CheckCheck,
      },
      {
        label: "Sản phẩm toàn hệ thống",
        value: formatCount(totalProducts),
        delta: compareCount(totalProducts, Math.max(totalProducts - Number(summary.monthly_order_count || 0), 0)),
        icon: Package,
      },
      {
        label: "Danh mục mới trong tháng",
        value: formatCount(newCategories),
        note: `${formatCount(newCategories)} danh mục mới`,
        icon: Sparkles,
      },
    ];
  }, [categories, summary]);

  const voucherMetrics = useMemo(
    () => [
      {
        label: "Voucher đang hoạt động",
        value: formatCount(summary.active_voucher_count),
        delta: compareCount(summary.active_voucher_count, Number(summary.active_voucher_count || 0) - Number(summary.new_voucher_count || 0)),
        icon: TicketPercent,
      },
      {
        label: "Voucher sắp hết hạn",
        value: formatCount(summary.expiring_voucher_count),
        note: "Trong 7 ngày tới",
        icon: Clock3,
      },
      {
        label: "Lượt sử dụng tháng này",
        value: formatCount(summary.monthly_voucher_usage_count),
        note: "Đơn hàng có áp mã",
        icon: Users,
      },
      {
        label: "Tổng giá trị giảm",
        value: formatCurrency(summary.monthly_discount_total),
        note: "Trong tháng hiện tại",
        icon: Wallet,
      },
    ],
    [summary],
  );

  const overviewMetrics = useMemo(
    () => [
      { label: "Tổng tài khoản", value: formatCount(summary.account_count), note: `${formatCount(summary.new_account_count)} tài khoản mới`, icon: Users },
      { label: "Danh mục sản phẩm", value: formatCount(summary.category_count), note: `${formatCount(summary.new_category_count)} danh mục mới`, icon: Grid2x2 },
      { label: "Voucher đang hoạt động", value: formatCount(summary.active_voucher_count), note: `${formatCount(summary.new_voucher_count)} voucher mới`, icon: TicketPercent },
      { label: "Doanh thu tháng", value: formatCurrency(summary.monthly_revenue), note: `${formatCount(summary.monthly_order_count)} đơn hàng`, icon: WalletCards },
    ],
    [summary],
  );

  const reportSummaryCards = useMemo(() => {
    if (!report) return [];
    const current = report.summary;
    const previous = report.previousSummary;
    return [
      { label: "Doanh thu", value: formatCurrency(current.revenue), current: current.revenue, previous: previous.revenue, icon: WalletCards },
      { label: "Đơn hàng", value: formatCount(current.order_count), current: current.order_count, previous: previous.order_count, icon: ShoppingCart },
      { label: "Sản phẩm ký gửi", value: formatCount(current.sold_product_count), current: current.sold_product_count, previous: previous.sold_product_count, icon: Package },
      { label: "Tăng trưởng khách hàng", value: `+${formatCount(report.customers.total_count)}`, current: report.customers.total_count, previous: report.previousSummary.order_count, icon: Users },
    ];
  }, [report]);

  const accountTotalPages = Math.max(1, Math.ceil(filteredAccounts.length / ACCOUNT_PAGE_SIZE));
  const safeAccountPage = Math.min(accountPage, accountTotalPages);
  const visibleAccounts = filteredAccounts.slice(
    (safeAccountPage - 1) * ACCOUNT_PAGE_SIZE,
    safeAccountPage * ACCOUNT_PAGE_SIZE,
  );

  const categoryTotalPages = Math.max(1, Math.ceil(filteredCategories.length / CATEGORY_PAGE_SIZE));
  const safeCategoryPage = Math.min(categoryPage, categoryTotalPages);
  const visibleCategories = filteredCategories.slice(
    (safeCategoryPage - 1) * CATEGORY_PAGE_SIZE,
    safeCategoryPage * CATEGORY_PAGE_SIZE,
  );

  const voucherTotalPages = Math.max(1, Math.ceil(filteredVouchers.length / VOUCHER_PAGE_SIZE));
  const safeVoucherPage = Math.min(voucherPage, voucherTotalPages);
  const visibleVouchers = filteredVouchers.slice(
    (safeVoucherPage - 1) * VOUCHER_PAGE_SIZE,
    safeVoucherPage * VOUCHER_PAGE_SIZE,
  );

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

  async function runAdminAction(path, options) {
    setMessage("");
    try {
      const result = await api(path, options);
      setMessage(result.message);
      await loadOverview();
    } catch (error) {
      setMessage(error.message);
    }
  }

  function editAccount(account) {
    const fullName = window.prompt("Họ và tên", account.full_name);
    if (fullName === null) return;
    const role = window.prompt("Vai trò: customer, staff hoặc admin", account.role);
    if (role === null) return;
    runAdminAction(`/admin/users/${account.id}`, {
      method: "PATCH",
      body: JSON.stringify({ fullName, role }),
    });
  }

  function toggleAccountStatus(account) {
    const nextStatus = account.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${nextStatus === "active" ? "Mở khóa" : "Khóa"} tài khoản ${account.full_name}?`)) return;
    runAdminAction(`/admin/users/${account.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
  }

  function editCategory(category) {
    const name = window.prompt("Tên danh mục", category.name);
    if (!name || name === category.name) return;
    runAdminAction(`/admin/categories/${category.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  }

  function deleteCategory(category) {
    if (!window.confirm(`Xóa danh mục ${category.name}?`)) return;
    runAdminAction(`/admin/categories/${category.id}`, { method: "DELETE" });
  }

  function editVoucher(voucher) {
    const discountValue = window.prompt("Giá trị giảm", String(Number(voucher.discount_value || 0)));
    if (discountValue === null) return;
    const endDate = window.prompt("Ngày hết hạn (YYYY-MM-DD)", String(voucher.end_date || "").slice(0, 10));
    if (!endDate) return;
    runAdminAction(`/admin/vouchers/${voucher.id}`, {
      method: "PATCH",
      body: JSON.stringify({ discountValue: Number(discountValue), endDate }),
    });
  }

  function toggleVoucherStatus(voucher) {
    const status = voucher.status === "active" ? "inactive" : "active";
    if (!window.confirm(`${status === "active" ? "Kích hoạt" : "Vô hiệu hóa"} voucher ${voucher.code}?`)) return;
    runAdminAction(`/admin/vouchers/${voucher.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsMessage("");
    try {
      const result = await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings({ ...defaultSettings, ...(result.settings || settings) });
      setSettingsMessage(result.message);
    } catch (error) {
      setSettingsMessage(error.message);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function downloadSettingsBackup() {
    setSettingsMessage("");
    try {
      const backup = await api("/admin/settings/backup");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `the-heirloom-backup-${toDateKey(new Date())}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setSettingsMessage("Đã tạo bản sao dữ liệu hệ thống.");
    } catch (error) {
      setSettingsMessage(error.message);
    }
  }

  return (
    <main id="top" className="min-h-screen bg-cream text-ink">
      <StaffSidebar active={activeSection} desk="admin" />

      <section className="min-w-0 lg:pl-[244px]">
        <StaffHeader
          user={user}
          roleLabel="Quản trị hệ thống"
          title={meta.title}
          query={query}
          setQuery={setQuery}
          searchPlaceholder={meta.searchPlaceholder}
        />

        <section className="relative min-h-[228px] overflow-hidden border-b border-[#eadfd5]">
          <img src={adminHero} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/70 to-transparent" />
          <div className="relative z-10 px-7 py-10 sm:px-10 lg:px-11">
            <h1 className="font-display text-4xl font-semibold leading-tight text-[#2e211a] sm:text-[46px]">
              {meta.heading}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#7b6f68]">{meta.description}</p>
          </div>
        </section>

        <div className="space-y-4 p-4 lg:p-5">
          {message ? (
            <p className="rounded-lg bg-[#f3e4d4] px-4 py-3 text-sm font-medium text-[#7b5336]">{message}</p>
          ) : null}

          {loading ? (
            <div className="rounded-xl border border-[#eee5de] bg-white px-5 py-12 text-center text-sm text-[#76665c]">
              Đang tải dữ liệu quản trị...
            </div>
          ) : null}

          {!loading && activeSection === "overview" ? (
            <AdminOverviewView
              metrics={overviewMetrics}
              accounts={accounts.slice(0, 5)}
              categories={categories.slice(0, 5)}
              vouchers={vouchers.slice(0, 5)}
            />
          ) : null}

          {!loading && activeSection === "accounts" ? (
            <AccountsView
              metrics={accountMetrics}
              query={query}
              setQuery={setQuery}
              roleFilter={roleFilter}
              setRoleFilter={setRoleFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              onRefresh={loadOverview}
              accounts={visibleAccounts}
              total={filteredAccounts.length}
              page={safeAccountPage}
              totalPages={accountTotalPages}
              onPageChange={setAccountPage}
              onEdit={editAccount}
              onToggleStatus={toggleAccountStatus}
            />
          ) : null}

          {!loading && activeSection === "categories" ? (
            <CategoriesView
              metrics={categoryMetrics}
              highlights={categories.slice(0, 5)}
              query={query}
              setQuery={setQuery}
              onOpenCreate={() => setModal("category")}
              categories={visibleCategories}
              total={filteredCategories.length}
              page={safeCategoryPage}
              totalPages={categoryTotalPages}
              onPageChange={setCategoryPage}
              onEdit={editCategory}
              onDelete={deleteCategory}
            />
          ) : null}

          {!loading && activeSection === "vouchers" ? (
            <VouchersView
              metrics={voucherMetrics}
              query={query}
              setQuery={setQuery}
              voucherStatusFilter={voucherStatusFilter}
              setVoucherStatusFilter={setVoucherStatusFilter}
              voucherTypeFilter={voucherTypeFilter}
              setVoucherTypeFilter={setVoucherTypeFilter}
              onOpenCreate={() => setModal("voucher")}
              vouchers={visibleVouchers}
              total={filteredVouchers.length}
              page={safeVoucherPage}
              totalPages={voucherTotalPages}
              onPageChange={setVoucherPage}
              onEdit={editVoucher}
              onToggleStatus={toggleVoucherStatus}
            />
          ) : null}

          {!loading && activeSection === "reports" ? (
            <ReportsView
              startDate={reportStartDate}
              endDate={reportEndDate}
              setStartDate={setReportStartDate}
              setEndDate={setReportEndDate}
              max={today}
              report={report}
              loading={reportLoading}
              message={reportMessage}
              summaryCards={reportSummaryCards}
              exports={reportExports}
              setExports={setReportExports}
            />
          ) : null}

          {!loading && activeSection === "settings" ? (
            <SettingsView
              settings={settings}
              setSettings={setSettings}
              loading={settingsLoading}
              saving={settingsSaving}
              message={settingsMessage}
              onSave={saveSettings}
              onBackup={downloadSettingsBackup}
            />
          ) : null}

          {!loading && !["overview", "accounts", "categories", "vouchers", "reports", "settings"].includes(activeSection) ? (
            <PlaceholderView section={activeSection} />
          ) : null}
        </div>
      </section>

      {modal ? <ResourceModal type={modal} onClose={() => setModal("")} onSubmit={createResource} /> : null}
    </main>
  );
}

function AdminOverviewView({ metrics, accounts, categories, vouchers }) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-[#eee5de] bg-white p-4">
          <h2 className="font-display text-xl font-semibold text-[#34271f]">Tài khoản mới nhất</h2>
          <div className="mt-4 divide-y divide-[#eee5de]">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center gap-4 py-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-linen/60 text-sm font-semibold text-clay">
                  {String(account.full_name || "?").trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{account.full_name}</p>
                  <p className="truncate text-xs text-muted">{account.email}</p>
                </div>
                <RoleBadge role={roleLabels[account.role] || account.role} />
              </div>
            ))}
            {!accounts.length ? <p className="py-8 text-center text-sm text-muted">Chưa có tài khoản.</p> : null}
          </div>
        </section>

        <section className="rounded-xl border border-[#eee5de] bg-white p-4">
          <h2 className="font-display text-xl font-semibold text-[#34271f]">Danh mục nổi bật</h2>
          <div className="mt-4 space-y-3">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between rounded-lg bg-[#fcfaf8] px-4 py-3">
                <span className="text-sm font-semibold">{category.name}</span>
                <span className="text-sm text-muted">{formatCount(category.product_count)} sản phẩm</span>
              </div>
            ))}
          </div>
          <h2 className="mt-6 font-display text-xl font-semibold text-[#34271f]">Voucher gần đây</h2>
          <div className="mt-3 space-y-3">
            {vouchers.map((voucher) => (
              <div key={voucher.id} className="flex items-center justify-between rounded-lg border border-[#eee5de] px-4 py-3">
                <span className="text-sm font-semibold text-clay">{voucher.code}</span>
                <StatusBadge status={getVoucherStatusLabel(voucher)} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function AccountsView({
  metrics,
  query,
  setQuery,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  onRefresh,
  accounts,
  total,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onToggleStatus,
}) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section id="accounts" className="scroll-mt-4 rounded-xl border border-[#eee5de] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_260px_260px_auto]">
          <label className="relative">
            <Search size={17} className="absolute right-4 top-[38px] text-clay" />
            <span className="text-xs font-semibold text-[#594b43]">Tìm kiếm</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm kiếm theo tên, email hoặc SDT..."
              className="mt-2 h-12 w-full rounded-lg border border-border px-4 pr-11 text-sm outline-none focus:border-clay"
            />
          </label>
          <FormSelect label="Vai trò" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">Tất cả vai trò</option>
            <option value="customer">Khách hàng</option>
            <option value="staff">Nhân viên</option>
            <option value="admin">Admin</option>
          </FormSelect>
          <FormSelect label="Trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Tạm khóa</option>
            <option value="locked">Đã khóa</option>
            <option value="banned">Đã khóa</option>
          </FormSelect>
          <div className="flex items-end">
            <button
              onClick={onRefresh}
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-[#e6d4c5] bg-[#fffaf5] px-5 text-sm font-semibold text-[#8b654b]"
            >
              <RefreshCw size={16} />
              Làm mới
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-[#eee5de]">
          <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
            <thead className="bg-[#fcf9f6] text-[#71665f]">
              <tr>
                <th className="px-4 py-3 font-medium">Mã TK</th>
                <th className="px-4 py-3 font-medium">Họ tên</th>
                <th className="px-4 py-3 font-medium">Vai trò</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">SDT</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Ngày tạo</th>
                <th className="px-4 py-3 text-center font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-t border-[#eee5de] text-[#685d56]">
                  <td className="px-4 py-3 font-medium">{makeAccountCode(account)}</td>
                  <td className="px-4 py-3 font-medium text-[#4a3e36]">{account.full_name}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={roleLabels[account.role] || account.role} />
                  </td>
                  <td className="px-4 py-3">{account.email}</td>
                  <td className="px-4 py-3">{account.phone || "--"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={accountStatusLabels[account.status] || account.status} />
                  </td>
                  <td className="px-4 py-3">{formatDateTime(account.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-3 text-clay">
                      <button
                        onClick={() => window.alert(`${account.full_name}\n${account.email}\n${account.phone || "--"}\n${roleLabels[account.role] || account.role}`)}
                        className="transition hover:text-ink"
                        title="Xem"
                      >
                        <Eye size={16} />
                      </button>
                      <button onClick={() => onEdit(account)} className="transition hover:text-ink" title="Chỉnh sửa">
                        <UserRoundCog size={16} />
                      </button>
                      <button onClick={() => onToggleStatus(account)} className="transition hover:text-ink" title={account.status === "active" ? "Khóa tài khoản" : "Mở khóa tài khoản"}>
                        <Lock size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!accounts.length ? <EmptyTableRow colSpan={8} text="Không tìm thấy tài khoản phù hợp." /> : null}
            </tbody>
          </table>
        </div>

        <TableFooter
          from={total ? (page - 1) * ACCOUNT_PAGE_SIZE + 1 : 0}
          to={Math.min(page * ACCOUNT_PAGE_SIZE, total)}
          total={total}
          label="tài khoản"
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageSize={ACCOUNT_PAGE_SIZE}
        />
      </section>
    </>
  );
}

function CategoriesView({
  metrics,
  highlights,
  query,
  setQuery,
  onOpenCreate,
  categories,
  total,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
}) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        {highlights.map((category) => (
          <CategoryHighlightCard key={category.id} category={category} />
        ))}
      </section>

      <section id="categories" className="scroll-mt-4 rounded-xl border border-[#eee5de] bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="relative w-full max-w-md">
            <Search size={17} className="absolute right-4 top-[38px] text-clay" />
            <span className="text-xs font-semibold text-[#594b43]">Tìm kiếm danh mục</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm kiếm danh mục..."
              className="mt-2 h-12 w-full rounded-lg border border-border px-4 pr-11 text-sm outline-none focus:border-clay"
            />
          </label>
          <button
            onClick={onOpenCreate}
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#9b6b49] px-5 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Thêm danh mục
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-[#eee5de]">
          <table className="w-full min-w-[1020px] border-collapse text-left text-xs">
            <thead className="bg-[#fcf9f6] text-[#71665f]">
              <tr>
                <th className="px-4 py-3 font-medium">Mã DM</th>
                <th className="px-4 py-3 font-medium">Tên danh mục</th>
                <th className="px-4 py-3 font-medium">Số sản phẩm</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Cập nhật gần nhất</th>
                <th className="px-4 py-3 text-center font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const active = Number(category.product_count || 0) > 0;
                return (
                  <tr key={category.id} className="border-t border-[#eee5de] text-[#685d56]">
                    <td className="px-4 py-3 font-medium">{makeCategoryCode(category)}</td>
                    <td className="px-4 py-3 font-medium text-[#4a3e36]">{category.name}</td>
                    <td className="px-4 py-3">{formatCount(category.product_count)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={active ? "Đang hoạt động" : "Tạm khóa"} />
                    </td>
                    <td className="px-4 py-3">{formatDateTime(category.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-3 text-clay">
                        <button onClick={() => window.alert(`${category.name}\n${formatCount(category.product_count)} sản phẩm`)} className="transition hover:text-ink" title="Xem">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => onEdit(category)} className="transition hover:text-ink" title="Chỉnh sửa">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => onDelete(category)} className="transition hover:text-ink" title="Xóa danh mục">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!categories.length ? <EmptyTableRow colSpan={6} text="Không tìm thấy danh mục phù hợp." /> : null}
            </tbody>
          </table>
        </div>

        <TableFooter
          from={total ? (page - 1) * CATEGORY_PAGE_SIZE + 1 : 0}
          to={Math.min(page * CATEGORY_PAGE_SIZE, total)}
          total={total}
          label="danh mục"
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageSize={CATEGORY_PAGE_SIZE}
        />
      </section>
    </>
  );
}

function VouchersView({
  metrics,
  query,
  setQuery,
  voucherStatusFilter,
  setVoucherStatusFilter,
  voucherTypeFilter,
  setVoucherTypeFilter,
  onOpenCreate,
  vouchers,
  total,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onToggleStatus,
}) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section id="vouchers" className="scroll-mt-4 rounded-xl border border-[#eee5de] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_260px_260px_auto]">
          <label className="relative">
            <Search size={17} className="absolute right-4 top-[38px] text-clay" />
            <span className="text-xs font-semibold text-[#594b43]">Tìm kiếm</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm kiếm mã hoặc tên voucher..."
              className="mt-2 h-12 w-full rounded-lg border border-border px-4 pr-11 text-sm outline-none focus:border-clay"
            />
          </label>
          <FormSelect
            label="Trạng thái"
            value={voucherStatusFilter}
            onChange={(event) => setVoucherStatusFilter(event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="expiring">Sắp hết hạn</option>
            <option value="expired">Đã hết hạn</option>
          </FormSelect>
          <FormSelect
            label="Loại ưu đãi"
            value={voucherTypeFilter}
            onChange={(event) => setVoucherTypeFilter(event.target.value)}
          >
            <option value="">Tất cả loại</option>
            <option value="percent">Giảm %</option>
            <option value="fixed">Giảm tiền</option>
          </FormSelect>
          <div className="flex items-end">
            <button
              onClick={onOpenCreate}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#9b6b49] px-5 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              Tạo voucher
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-[#eee5de]">
          <table className="w-full min-w-[1240px] border-collapse text-left text-xs">
            <thead className="bg-[#fcf9f6] text-[#71665f]">
              <tr>
                <th className="px-4 py-3 font-medium">Mã voucher</th>
                <th className="px-4 py-3 font-medium">Tên voucher</th>
                <th className="px-4 py-3 font-medium">Loại giảm giá</th>
                <th className="px-4 py-3 font-medium">Giá trị</th>
                <th className="px-4 py-3 font-medium">Điều kiện áp dụng</th>
                <th className="px-4 py-3 font-medium">Ngày bắt đầu</th>
                <th className="px-4 py-3 font-medium">Ngày hết hạn</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-center font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher) => (
                <tr key={voucher.id} className="border-t border-[#eee5de] text-[#685d56]">
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#f6ede5] px-2 py-1 font-medium text-[#9b6b49]">{voucher.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#4a3e36]">{getVoucherDisplayName(voucher)}</p>
                    <p className="mt-1 text-[11px] text-[#8a7b72]">{getVoucherDescription(voucher)}</p>
                  </td>
                  <td className="px-4 py-3">{getVoucherTypeLabel(voucher.discount_type)}</td>
                  <td className="px-4 py-3">{formatVoucherValue(voucher)}</td>
                  <td className="px-4 py-3">{getVoucherConditionLabel(voucher)}</td>
                  <td className="px-4 py-3">{formatShortDate(voucher.start_date || voucher.created_at)}</td>
                  <td className="px-4 py-3">{formatShortDate(voucher.end_date)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={getVoucherStatusLabel(voucher)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-3 text-clay">
                      <button onClick={() => window.alert(`${voucher.code}\n${formatVoucherValue(voucher)}\n${getVoucherConditionLabel(voucher)}`)} className="transition hover:text-ink" title="Xem">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => onEdit(voucher)} className="transition hover:text-ink" title="Chỉnh sửa">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => onToggleStatus(voucher)} className="transition hover:text-ink" title={voucher.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}>
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!vouchers.length ? <EmptyTableRow colSpan={9} text="Không tìm thấy voucher phù hợp." /> : null}
            </tbody>
          </table>
        </div>

        <TableFooter
          from={total ? (page - 1) * VOUCHER_PAGE_SIZE + 1 : 0}
          to={Math.min(page * VOUCHER_PAGE_SIZE, total)}
          total={total}
          label="voucher"
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageSize={VOUCHER_PAGE_SIZE}
        />
      </section>
    </>
  );
}

function ReportsView({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  max,
  report,
  loading,
  message,
  summaryCards,
  exports,
  setExports,
}) {
  async function exportReport() {
    if (!report) return;
    const rows = [
      ["BAO CAO THE HEIRLOOM"],
      ["Tu ngay", formatShortDate(report.period.start)],
      ["Den ngay", formatShortDate(report.period.end)],
      [],
      ["Chi so", "Gia tri"],
      ["Doanh thu", report.summary.revenue],
      ["Don hang", report.summary.order_count],
      ["San pham da ban", report.summary.sold_product_count],
      ["Gia tri ky gui moi", report.summary.consignment_value],
      ["Giai ngan", report.summary.payout],
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    const fileName = `bao-cao-admin-${report.period.start}-${report.period.end}.csv`;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);

    await api("/admin/report-exports", {
      method: "POST",
      body: JSON.stringify({
        reportType: "admin_overview",
        periodStart: report.period.start,
        periodEnd: report.period.end,
        fileName,
      }),
    });
    setExports((await api("/admin/report-exports?limit=5")).map(normalizeReportExport));
  }

  return (
    <section id="reports" className="scroll-mt-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div />
        <div className="flex flex-wrap items-center gap-3">
          <DateRange startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} max={max} />
          <button
            onClick={exportReport}
            disabled={!report}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#e6d4c5] bg-white px-5 text-sm font-semibold text-[#8b654b] disabled:opacity-50"
          >
            <Download size={16} />
            Xuất báo cáo
          </button>
        </div>
      </div>

      {message ? <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{message}</p> : null}
      {loading ? (
        <div className="rounded-xl border border-[#eee5de] bg-white px-5 py-12 text-center text-sm text-[#76665c]">Đang tải báo cáo...</div>
      ) : null}

      {report ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((metric) => (
              <ReportSummaryCard key={metric.label} {...metric} />
            ))}
          </section>

          <div className="flex items-center gap-8 border-b border-[#e8ddd4] px-2 text-sm font-medium text-[#7c6a5f]">
            {["Doanh thu", "Đơn hàng", "Sản phẩm ký gửi", "Giải ngân"].map((tab, index) => (
              <span key={tab} className={index === 0 ? "border-b-2 border-clay pb-3 text-clay" : "pb-3"}>{tab}</span>
            ))}
          </div>

          <section className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr_0.82fr]">
            <ReportShell title="Doanh thu theo ngày">
              <AdminRevenueChart data={report.revenue} />
            </ReportShell>
            <ReportShell title="Cơ cấu doanh thu theo danh mục">
              <AdminCategoryDonut categories={report.categories} total={report.summary.revenue} />
            </ReportShell>
            <ReportShell title="Tăng trưởng khách hàng">
              <AdminCustomerGrowth report={report} />
            </ReportShell>
          </section>

          <ReportShell title="Tổng quan hiệu quả kinh doanh">
            <BusinessOverview report={report} exports={exports} onExport={exportReport} />
          </ReportShell>
        </>
      ) : null}
    </section>
  );
}

function SettingsView({
  settings,
  setSettings,
  loading,
  saving,
  message,
  onSave,
  onBackup,
}) {
  const [activeTab, setActiveTab] = useState("store");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const tabs = [
    { id: "store", label: "Thông tin cửa hàng", description: "Quản lý thông tin cơ bản của cửa hàng", icon: Store },
    { id: "general", label: "Thiết lập chung", description: "Cấu hình các thiết lập hệ thống", icon: SlidersHorizontal },
    { id: "notifications", label: "Email & Thông báo", description: "Quản lý email và thông báo hệ thống", icon: Mail },
    { id: "policies", label: "Chính sách", description: "Quản lý chính sách và điều khoản", icon: FileText },
    { id: "backup", label: "Sao lưu dữ liệu", description: "Sao lưu và khôi phục dữ liệu hệ thống", icon: CloudUpload },
  ];

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      updateSetting("logoUrl", await uploadImage(file));
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function submit(event) {
    event.preventDefault();
    onSave();
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#eee5de] bg-white px-5 py-12 text-center text-sm text-[#76665c]">
        Đang tải cài đặt hệ thống...
      </div>
    );
  }

  return (
    <section id="settings" className="scroll-mt-4">
      {message ? (
        <p className="mb-4 rounded-lg bg-[#f3e4d4] px-4 py-3 text-sm font-medium text-[#7b5336]">{message}</p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[#eee5de] bg-white p-4">
          <div className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={
                    selected
                      ? "flex w-full items-start gap-4 rounded-xl bg-[#f4e6d8] px-4 py-4 text-left text-[#8d5e3c]"
                      : "flex w-full items-start gap-4 rounded-xl px-4 py-4 text-left text-[#5e5149] transition hover:bg-[#fcf8f4]"
                  }
                >
                  <Icon size={21} className="mt-0.5 shrink-0" />
                  <span>
                    <strong className="block text-sm font-semibold">{tab.label}</strong>
                    <span className="mt-1 block text-[11px] leading-5 text-[#94877f]">{tab.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <form onSubmit={submit} className="rounded-xl border border-[#eee5de] bg-white p-5 sm:p-7">
          <div className="border-b border-[#eee5de] pb-5">
            <h2 className="font-display text-2xl font-semibold text-[#34271f]">
              {tabs.find((tab) => tab.id === activeTab)?.label}
            </h2>
            <p className="mt-2 text-sm text-[#8a7b72]">
              {tabs.find((tab) => tab.id === activeTab)?.description}.
            </p>
          </div>

          {activeTab === "store" ? (
            <div className="mt-6 space-y-5">
              <SettingsField
                label="Tên cửa hàng"
                required
                value={settings.storeName}
                onChange={(event) => updateSetting("storeName", event.target.value)}
              />
              <SettingsField
                label="Email liên hệ"
                type="email"
                required
                value={settings.contactEmail}
                onChange={(event) => updateSetting("contactEmail", event.target.value)}
              />
              <SettingsField
                label="Số điện thoại"
                required
                value={settings.phone}
                onChange={(event) => updateSetting("phone", event.target.value)}
              />
              <SettingsTextarea
                label="Địa chỉ"
                required
                maxLength={500}
                value={settings.address}
                onChange={(event) => updateSetting("address", event.target.value)}
              />

              <div className="grid gap-3 sm:grid-cols-[190px_minmax(0,1fr)]">
                <div>
                  <p className="text-sm font-semibold text-[#4f423a]">Logo cửa hàng</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#94877f]">JPG, PNG hoặc WEBP. Kích thước tối đa 5MB.</p>
                </div>
                <div className="flex flex-wrap items-center gap-5 rounded-xl border border-dashed border-[#e7d8cc] bg-[#fffdfa] p-4">
                  <div className="grid h-24 min-w-52 place-items-center overflow-hidden rounded-lg border border-[#eee5de] bg-white px-5">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo cửa hàng" className="max-h-20 max-w-full object-contain" />
                    ) : (
                      <div className="text-center">
                        <p className="font-display text-3xl font-semibold text-[#2e211a]">The Heirloom</p>
                        <p className="mt-1 text-[9px] uppercase tracking-[0.35em] text-[#78675d]">Timeless Luxury</p>
                      </div>
                    )}
                  </div>
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#e6d4c5] bg-white px-4 text-sm font-semibold text-[#8b654b]">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? "Đang tải..." : "Thay đổi logo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploading}
                      onChange={handleLogoUpload}
                      className="sr-only"
                    />
                  </label>
                  {uploadError ? <p className="w-full text-xs font-medium text-danger">{uploadError}</p> : null}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "general" ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <SettingsSelect
                label="Đơn vị tiền tệ"
                value={settings.currency}
                onChange={(event) => updateSetting("currency", event.target.value)}
              >
                <option value="VND">VND - Việt Nam đồng</option>
                <option value="USD">USD - Đô la Mỹ</option>
              </SettingsSelect>
              <SettingsSelect
                label="Múi giờ"
                value={settings.timezone}
                onChange={(event) => updateSetting("timezone", event.target.value)}
              >
                <option value="Asia/Ho_Chi_Minh">Asia/Ho Chi Minh</option>
                <option value="Asia/Bangkok">Asia/Bangkok</option>
                <option value="UTC">UTC</option>
              </SettingsSelect>
              <SettingsField
                label="Tiền tố mã đơn hàng"
                required
                value={settings.orderPrefix}
                onChange={(event) => updateSetting("orderPrefix", event.target.value.toUpperCase())}
              />
            </div>
          ) : null}

          {activeTab === "notifications" ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <SettingsField
                  label="Tên người gửi"
                  required
                  value={settings.senderName}
                  onChange={(event) => updateSetting("senderName", event.target.value)}
                />
                <SettingsField
                  label="Email người gửi"
                  type="email"
                  required
                  value={settings.senderEmail}
                  onChange={(event) => updateSetting("senderEmail", event.target.value)}
                />
              </div>
              <div className="divide-y divide-[#eee5de] rounded-xl border border-[#eee5de]">
                <SettingsToggle
                  label="Bật thông báo email"
                  description="Cho phép hệ thống gửi email tự động."
                  checked={settings.emailNotifications}
                  onChange={(value) => updateSetting("emailNotifications", value)}
                />
                <SettingsToggle
                  label="Thông báo đơn hàng"
                  description="Gửi email khi đơn hàng thay đổi trạng thái."
                  checked={settings.orderNotifications}
                  onChange={(value) => updateSetting("orderNotifications", value)}
                />
                <SettingsToggle
                  label="Thông báo ký gửi"
                  description="Gửi email khi yêu cầu ký gửi được cập nhật."
                  checked={settings.consignmentNotifications}
                  onChange={(value) => updateSetting("consignmentNotifications", value)}
                />
              </div>
            </div>
          ) : null}

          {activeTab === "policies" ? (
            <div className="mt-6 space-y-5">
              <SettingsTextarea
                label="Chính sách bảo mật"
                maxLength={10000}
                rows={5}
                value={settings.privacyPolicy}
                onChange={(event) => updateSetting("privacyPolicy", event.target.value)}
              />
              <SettingsTextarea
                label="Điều khoản sử dụng"
                maxLength={10000}
                rows={5}
                value={settings.terms}
                onChange={(event) => updateSetting("terms", event.target.value)}
              />
              <SettingsTextarea
                label="Chính sách đổi trả"
                maxLength={10000}
                rows={5}
                value={settings.returnPolicy}
                onChange={(event) => updateSetting("returnPolicy", event.target.value)}
              />
            </div>
          ) : null}

          {activeTab === "backup" ? (
            <div className="mt-6 space-y-5">
              <div className="rounded-xl border border-[#eee5de] bg-[#fcfaf8] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-[#4f423a]">Tạo bản sao dữ liệu</h3>
                    <p className="mt-1 text-sm text-[#8a7b72]">Xuất cấu hình và thống kê số lượng dữ liệu hiện tại dưới dạng JSON.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onBackup}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#e6d4c5] bg-white px-5 text-sm font-semibold text-[#8b654b]"
                  >
                    <Database size={17} />
                    Tạo bản sao
                  </button>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <SettingsToggle
                  label="Sao lưu tự động"
                  description="Lưu lựa chọn lịch sao lưu định kỳ của hệ thống."
                  checked={settings.autoBackup}
                  onChange={(value) => updateSetting("autoBackup", value)}
                />
                <SettingsSelect
                  label="Tần suất sao lưu"
                  value={settings.backupFrequency}
                  disabled={!settings.autoBackup}
                  onChange={(event) => updateSetting("backupFrequency", event.target.value)}
                >
                  <option value="daily">Hàng ngày</option>
                  <option value="weekly">Hàng tuần</option>
                  <option value="monthly">Hàng tháng</option>
                </SettingsSelect>
              </div>
            </div>
          ) : null}

          <div className="mt-7 flex justify-end border-t border-[#eee5de] pt-5">
            <button
              type="submit"
              disabled={saving || uploading}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#a66f45] px-6 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function SettingsField({ label, required = false, ...props }) {
  return (
    <label className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center">
      <span className="text-sm font-semibold text-[#4f423a]">
        {label} {required ? <span className="text-danger">*</span> : null}
      </span>
      <input
        {...props}
        required={required}
        className="h-11 w-full rounded-lg border border-[#e5ddd7] bg-white px-4 text-sm outline-none focus:border-clay"
      />
    </label>
  );
}

function SettingsTextarea({ label, required = false, maxLength, rows = 3, value, ...props }) {
  return (
    <label className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)]">
      <span className="pt-3 text-sm font-semibold text-[#4f423a]">
        {label} {required ? <span className="text-danger">*</span> : null}
      </span>
      <span>
        <textarea
          {...props}
          value={value}
          required={required}
          maxLength={maxLength}
          rows={rows}
          className="w-full resize-y rounded-lg border border-[#e5ddd7] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-clay"
        />
        {maxLength ? <span className="mt-1 block text-right text-[11px] text-[#94877f]">{String(value || "").length} / {maxLength}</span> : null}
      </span>
    </label>
  );
}

function SettingsSelect({ label, children, ...props }) {
  return (
    <label>
      <span className="text-sm font-semibold text-[#4f423a]">{label}</span>
      <select
        {...props}
        className="mt-2 h-11 w-full rounded-lg border border-[#e5ddd7] bg-white px-4 text-sm outline-none focus:border-clay disabled:bg-[#f4f1ee] disabled:text-[#a79b93]"
      >
        {children}
      </select>
    </label>
  );
}

function SettingsToggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 p-4">
      <span className="min-w-0 flex-1">
        <strong className="block text-sm text-[#4f423a]">{label}</strong>
        <span className="mt-1 block text-xs text-[#94877f]">{description}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-[#a66f45]" : "bg-[#d9d1ca]"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </label>
  );
}

function PlaceholderView({ section }) {
  const labels = {
    overview: "Tổng quan",
    vouchers: "Voucher",
    reports: "Báo cáo thống kê",
    settings: "Cài đặt hệ thống",
  };

  return (
    <section className="rounded-xl border border-[#eee5de] bg-white p-6 text-sm leading-6 text-[#6f625a]">
      Khu vực <span className="font-semibold text-[#4a3e36]">{labels[section] || "này"}</span> đang giữ khung Admin.
    </section>
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
      {delta ? (
        <p className={`mt-4 text-[10px] ${delta.tone}`}>
          <span className="font-semibold">
            {delta.symbol} {delta.value}
          </span>{" "}
          so với tháng trước
        </p>
      ) : null}
      {!delta && note ? <p className="mt-4 text-[10px] text-[#8a7b72]">{note}</p> : null}
    </article>
  );
}

function ReportSummaryCard({ label, value, current, previous, icon: Icon }) {
  const delta = getDeltaText(current, previous);
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
      <p className={`mt-4 text-[10px] ${delta.tone}`}>
        <span className="font-semibold">{delta.symbol} {delta.text}</span>
      </p>
    </article>
  );
}

function ReportShell({ title, children }) {
  return (
    <section className="rounded-xl border border-[#eee5de] bg-white p-4">
      <h2 className="font-display text-[22px] font-semibold text-[#34271f]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DateRange({ startDate, endDate, setStartDate, setEndDate, max }) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-lg border border-[#e6d4c5] bg-white px-4 text-sm text-[#6d5b50]">
      <CalendarDays size={16} className="text-clay" />
      <input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="w-[125px] bg-transparent outline-none" />
      <span>-</span>
      <input type="date" value={endDate} min={startDate} max={max} onChange={(event) => setEndDate(event.target.value)} className="w-[125px] bg-transparent outline-none" />
    </div>
  );
}

function AdminRevenueChart({ data }) {
  const max = Math.max(1, ...data.map((item) => Number(item.value || 0)));
  const points = data.map((item, index) => ({
    ...item,
    x: 34 + index * (306 / Math.max(1, data.length - 1)),
    y: 190 - (Number(item.value || 0) / max) * 145,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length ? `34,190 ${line} 340,190` : "";
  return (
    <svg viewBox="0 0 370 220" className="h-[260px] w-full">
      {[45, 80, 115, 150, 190].map((y) => <line key={y} x1="34" x2="340" y1={y} y2={y} stroke="var(--color-border)" strokeWidth="1" />)}
      {area ? <polygon points={area} fill="var(--color-linen)" opacity="0.7" /> : null}
      {line ? <polyline points={line} fill="none" stroke="var(--color-clay)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {points.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="3.5" fill="var(--color-clay)" />)}
      {points.map((point, index) =>
        index % Math.max(1, Math.ceil(points.length / 6)) === 0 ? (
          <text key={`label-${point.date}`} x={point.x} y="211" textAnchor="middle" fontSize="9" fill="var(--color-muted)">{formatDayMonth(point.date)}</text>
        ) : null,
      )}
    </svg>
  );
}

function AdminCategoryDonut({ categories, total }) {
  let offset = 25;
  const safeTotal = Math.max(1, Number(total || 0));
  return (
    <div className="flex min-h-[260px] items-center justify-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 44 44" className="-rotate-90">
          {categories.map((item, index) => {
            const size = (Number(item.revenue || 0) / safeTotal) * 100;
            const circle = <circle key={item.name || index} cx="22" cy="22" r="15.9" fill="none" stroke={reportCategoryColors[index % reportCategoryColors.length]} strokeWidth="8" strokeDasharray={`${size} ${100 - size}`} strokeDashoffset={offset} />;
            offset -= size;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-xl font-semibold">{formatCompactMoney(total)}</p>
            <p className="text-[10px] text-muted">Tổng doanh thu</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 text-xs">
        {categories.slice(0, 6).map((item, index) => (
          <div key={item.name || index} className="flex items-start gap-2">
            <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: reportCategoryColors[index % reportCategoryColors.length] }} />
            <div>
              <p className="font-semibold">{item.name || "Khác"}</p>
              <p className="text-muted">{percent(item.revenue, safeTotal)} · {formatCurrency(item.revenue)}</p>
            </div>
          </div>
        ))}
        {!categories.length ? <p className="text-muted">Chưa có doanh thu trong kỳ.</p> : null}
      </div>
    </div>
  );
}

function AdminCustomerGrowth({ report }) {
  const rows = [
    { label: "Khách hàng mới", value: report.customers.total_count || 0, color: "#c07d3a" },
    { label: "Khách hàng có SĐT", value: report.customers.with_phone_count || 0, color: "#ddb27c" },
    { label: "Tạo trong 7 ngày gần đây", value: report.customers.last_7_days_count || 0, color: "#eed8c0" },
  ];
  const max = Math.max(1, ...rows.map((row) => Number(row.value || 0)));
  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-display text-3xl font-semibold text-[#2f251f]">+{formatCount(report.customers.total_count || 0)}</span>
        <span className="text-xs font-semibold text-success">▲ {getDeltaText(report.customers.total_count || 0, report.previousSummary.order_count || 0).text}</span>
      </div>
      <div className="flex h-[150px] items-end gap-5 border-b border-[#eee5de] pb-4">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="w-full rounded-t-md" style={{ height: `${Math.max(14, (Number(row.value || 0) / max) * 120)}px`, background: row.color }} />
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />{row.label}</span>
            <strong>{formatCount(row.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BusinessOverview({ report, exports, onExport }) {
  const current = report.summary;
  const previous = report.previousSummary;
  const cards = [
    { label: "Giá trị đơn hàng trung bình", value: formatCurrency(current.order_count ? current.revenue / current.order_count : 0), current: current.revenue / Math.max(1, current.order_count), previous: previous.revenue / Math.max(1, previous.order_count || 1), icon: ShoppingCart },
    { label: "Tỷ lệ bán thành công", value: `${report.consignment.success_rate}%`, current: report.consignment.success_rate, previous: 0, icon: Percent },
    { label: "Hoa hồng cửa hàng", value: formatCurrency(report.disbursements.commission_amount), current: report.disbursements.commission_amount, previous: previous.payout, icon: BadgePercent },
    { label: "Tổng giá trị ký gửi", value: formatCount(report.consignment.new_count), current: report.consignment.new_count, previous: previous.sold_product_count, icon: ClipboardCheck },
    { label: "Giải ngân trong kỳ", value: formatCurrency(report.summary.payout), current: report.summary.payout, previous: previous.payout, icon: Wallet },
    { label: "Báo cáo đã xuất", value: formatCount(exports.length), current: exports.length, previous: 0, icon: Download, action: onExport },
  ];
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-[#eee5de] bg-[#eee5de] md:grid-cols-2 xl:grid-cols-3">
      {cards.map((item) => {
        const delta = getDeltaText(item.current, item.previous);
        const Icon = item.icon;
        return (
          <div key={item.label} className="bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-linen/50 text-clay">
                <Icon size={18} />
              </span>
              {item.action ? (
                <button onClick={item.action} className="text-xs font-semibold text-clay">Xuất ngay</button>
              ) : (
                <span className={`text-[11px] font-semibold ${delta.tone}`}>{delta.symbol} {delta.text}</span>
              )}
            </div>
            <p className="mt-4 text-sm text-[#7c6a5f]">{item.label}</p>
            <p className="mt-2 font-display text-[30px] leading-none text-[#2f251f]">{item.value}</p>
          </div>
        );
      })}
    </div>
  );
}

function CategoryHighlightCard({ category }) {
  return (
    <article className="rounded-xl border border-[#eee5de] bg-white p-3">
      <div className="flex items-center gap-3">
        <img
          src={category.image_url || adminHero}
          alt={category.name}
          className="h-16 w-16 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#4a3e36]">{category.name}</p>
          <p className="mt-1 font-display text-[20px] leading-none text-[#2f251f]">
            {formatCount(category.product_count)}
          </p>
          <p className="mt-1 text-[11px] text-[#8a7b72]">Sản phẩm</p>
        </div>
      </div>
    </article>
  );
}

function TableFooter({ from, to, total, label, page, totalPages, onPageChange, pageSize }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm text-[#76665c]">
      <p>
        Hiển thị {from} đến {to} trong tổng số {formatCount(total)} {label}
      </p>
      <div className="flex items-center gap-3">
        <span>Số dòng mỗi trang</span>
        <span className="inline-flex h-10 min-w-14 items-center justify-center rounded-lg border border-border bg-white px-3 font-semibold">
          {pageSize}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="grid h-10 w-10 place-items-center rounded-lg border border-border disabled:opacity-40"
          >
            {"<"}
          </button>
          {Array.from({ length: Math.min(totalPages, 4) }, (_, index) => {
            const pageNumber = index + 1;
            return (
              <button
                key={pageNumber}
                onClick={() => onPageChange(pageNumber)}
                className={
                  pageNumber === page
                    ? "grid h-10 w-10 place-items-center rounded-lg border border-[#e6d4c5] bg-[#fffaf5] font-semibold text-clay"
                    : "grid h-10 w-10 place-items-center rounded-lg border border-border"
                }
              >
                {pageNumber}
              </button>
            );
          })}
          {totalPages > 4 ? <span className="px-2">...</span> : null}
          {totalPages > 4 ? <span className="font-medium">{totalPages}</span> : null}
          <button
            onClick={() => onPageChange((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="grid h-10 w-10 place-items-center rounded-lg border border-border disabled:opacity-40"
          >
            {">"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const styles = {
    Admin: "bg-linen/60 text-clay",
    "Nhân viên": "bg-info/10 text-info",
    "Khách hàng": "bg-muted/10 text-muted",
  };
  return <span className={`rounded px-2 py-1 text-[10px] font-semibold ${styles[role] || "bg-[#f3eee8] text-[#6e625b]"}`}>{role}</span>;
}

function StatusBadge({ status }) {
  const styles = {
    "Hoạt động": "bg-success/10 text-success",
    "Đang hoạt động": "bg-success/10 text-success",
    "Đang kích hoạt": "bg-success/10 text-success",
    "Tạm khóa": "bg-warning/10 text-warning",
    "Sắp hết hạn": "bg-warning/10 text-warning",
    "Sắp hết hạn dùng": "bg-warning/10 text-warning",
    "Hết hạn": "bg-danger/10 text-danger",
    "Đã khóa": "bg-danger/10 text-danger",
    "Đã hết hạn": "bg-danger/10 text-danger",
  };
  return <span className={`rounded px-2 py-1 text-[10px] font-semibold ${styles[status] || "bg-[#f3eee8] text-[#6e625b]"}`}>{status}</span>;
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
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#f7eee7]">
            <X size={17} />
          </button>
        </div>
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          {type === "account" ? (
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
          ) : null}

          {type === "category" ? <FormField name="name" label="Tên danh mục" required /> : null}

          {type === "voucher" ? (
            <>
              <FormField name="code" label="Mã voucher" required />
              <FormSelect name="discountType" label="Loại giảm giá" defaultValue="percent">
                <option value="percent">Giảm %</option>
                <option value="fixed">Giảm tiền</option>
              </FormSelect>
              <FormField name="discountValue" label="Giá trị giảm" type="number" min="1" required />
              <FormField name="minOrderValue" label="Đơn tối thiểu" type="number" min="0" defaultValue="0" required />
              <FormField name="endDate" label="Ngày hết hạn" type="date" required />
            </>
          ) : null}

          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}
          <button
            disabled={submitting}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-lg bg-[#34271f] text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? <Loader2 className="mr-2 animate-spin" size={16} /> : null}
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
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-xs text-[#76665c]">
        {text}
      </td>
    </tr>
  );
}

function formatCount(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))} đ`;
}

function formatCompactMoney(value) {
  const number = Number(value || 0);
  if (number >= 1e9) return `${(number / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  if (number >= 1e6) return `${(number / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  return `${Math.round(number / 1000)}k`;
}

function formatDateTime(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDayMonth(value) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00`));
}

function toDateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function normalizeReportExport(item) {
  return {
    id: item.id,
    name: item.file_name,
    createdAt: item.created_at,
  };
}

function makeAccountCode(account) {
  const prefix = accountCodePrefix[account.role] || "TK";
  return `${prefix}${String(account.id).padStart(4, "0")}`;
}

function makeCategoryCode(category) {
  return `DM${String(category.id).padStart(3, "0")}`;
}

function summarizeAccountsByPeriod(accounts, start, end) {
  return accounts.reduce(
    (totals, account) => {
      const createdAt = new Date(account.created_at);
      if (createdAt < start || createdAt > end) return totals;
      totals.total += 1;
      if (account.role === "customer") totals.customer += 1;
      if (account.role === "staff") totals.staff += 1;
      if (account.status !== "active") totals.locked += 1;
      return totals;
    },
    { total: 0, customer: 0, staff: 0, locked: 0 },
  );
}

function compareCount(current, previous, inverse = false) {
  const a = Number(current || 0);
  const b = Number(previous || 0);
  if (a === b) return { symbol: "•", value: "0%", tone: "text-muted" };
  if (!b) return { symbol: inverse ? "▼" : "▲", value: "100%", tone: inverse ? "text-danger" : "text-success" };
  const increased = a > b;
  return {
    symbol: increased ? (inverse ? "▼" : "▲") : inverse ? "▲" : "▼",
    value: `${Math.abs(((a - b) / b) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`,
    tone: increased ? (inverse ? "text-danger" : "text-success") : inverse ? "text-success" : "text-danger",
  };
}

function getDeltaText(current, previous) {
  const a = Number(current || 0);
  const b = Number(previous || 0);
  if (a === b) return { symbol: "•", text: "0% so với tháng trước", tone: "text-muted" };
  if (!b) return { symbol: "▲", text: "100% so với tháng trước", tone: "text-success" };
  const value = Math.abs(((a - b) / b) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  return { symbol: a > b ? "▲" : "▼", text: `${value}% so với tháng trước`, tone: a > b ? "text-success" : "text-danger" };
}

function percent(value, total) {
  return `${total ? ((Number(value || 0) / Number(total)) * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : 0}%`;
}

function getVoucherDisplayName(voucher) {
  const code = String(voucher.code || "").toUpperCase();
  if (code.includes("WELCOME")) return "Ưu đãi chào mừng";
  if (code.includes("FREE")) return "Freeship toàn quốc";
  if (code.includes("SALE")) return "Sale ưu đãi";
  if (code.includes("VIP")) return "Ưu đãi khách VIP";
  if (code.includes("THANK")) return "Cảm ơn khách hàng";
  return `Voucher ${code}`;
}

function getVoucherDescription(voucher) {
  if (voucher.discount_type === "fixed") return "Miễn phí vận chuyển hoặc giảm tiền trực tiếp";
  if (Number(voucher.min_order_value || 0) > 0) return "Áp dụng cho đơn hàng đủ điều kiện";
  return "Áp dụng cho đơn hàng tiếp theo";
}

function getVoucherTypeLabel(type) {
  return type === "percent" ? "Giảm %" : "Giảm tiền";
}

function formatVoucherValue(voucher) {
  return voucher.discount_type === "percent"
    ? `${Number(voucher.discount_value || 0)}%`
    : formatCurrency(voucher.discount_value);
}

function getVoucherConditionLabel(voucher) {
  const minValue = Number(voucher.min_order_value || 0);
  return minValue > 0 ? `Đơn tối thiểu ${formatCurrency(minValue)}` : "Không giới hạn";
}

function getVoucherUiStatus(voucher) {
  const now = Date.now();
  const endTime = voucher.end_date ? new Date(voucher.end_date).getTime() : 0;
  if (voucher.status !== "active") return "expired";
  if (endTime && endTime < now) return "expired";
  if (endTime && endTime - now <= 7 * 24 * 60 * 60 * 1000) return "expiring";
  return "active";
}

function getVoucherStatusLabel(voucher) {
  const status = getVoucherUiStatus(voucher);
  if (status === "active") return "Đang hoạt động";
  if (status === "expiring") return "Sắp hết hạn";
  return "Đã hết hạn";
}

function getSectionFromHash(hash) {
  const normalized = String(hash || "").replace(/^#/, "");
  if (!normalized) return "overview";
  if (normalized === "top") return "overview";
  if (["overview", "accounts", "categories", "vouchers", "reports", "settings"].includes(normalized)) {
    return normalized;
  }
  return "accounts";
}
