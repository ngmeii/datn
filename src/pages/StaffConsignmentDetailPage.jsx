import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Loader2,
  PackageCheck,
  ReceiptText,
  Tag,
  Truck,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import StaffHeader from "../components/StaffHeader.jsx";
import StaffSidebar from "../components/StaffSidebar.jsx";
import { api, formatMoney, getCurrentUser } from "../lib/api.js";

const fallbackImage =
  "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=800&q=85";

const statusLabels = {
  pending_review: "Chờ duyệt",
  approved: "Chờ tiếp nhận",
  received: "Cần định giá",
  inspecting: "Cần định giá",
  priced: "Chờ người bán xác nhận",
  seller_confirmed: "Chờ đăng bán",
  seller_cancelled: "Đã hủy ký gửi",
  cancel_requested: "Khách yêu cầu hủy",
  cancel_rejected: "Yêu cầu hủy bị từ chối",
  listed: "Đang đăng bán",
  rejected: "Từ chối",
  sold: "Đã bán",
  waiting_payout: "Chờ giải ngân",
  paid_out: "Đã giải ngân",
  payout_failed: "Giải ngân thất bại",
  expired: "Hết hạn",
  returned: "Đã hoàn trả",
  shipping_pending: "Chờ GHN lấy hàng",
  shipping_in_transit: "Đang vận chuyển",
  shipping_delivered: "Đã giao đến cửa hàng",
};

const statusStyles = {
  pending_review: "bg-warning/10 text-warning",
  approved: "bg-info/10 text-info",
  received: "bg-warning/10 text-warning",
  inspecting: "bg-info/10 text-info",
  priced: "bg-info/10 text-info",
  seller_confirmed: "bg-success/10 text-success",
  seller_cancelled: "bg-danger/10 text-danger",
  cancel_requested: "bg-[#f4eadf] text-[#8a572f]",
  cancel_rejected: "bg-danger/10 text-danger",
  listed: "bg-success/10 text-success",
  rejected: "bg-danger/10 text-danger",
  sold: "bg-success/10 text-success",
  waiting_payout: "bg-[#f4eadf] text-[#8a572f]",
  paid_out: "bg-success/10 text-success",
  payout_failed: "bg-danger/10 text-danger",
  expired: "bg-warning/10 text-warning",
  returned: "bg-muted/10 text-muted",
  shipping_pending: "bg-warning/10 text-warning",
  shipping_in_transit: "bg-info/10 text-info",
  shipping_delivered: "bg-success/10 text-success",
};

const conditionLabels = {
  new: "Mới",
  like_new: "Gần như mới",
  good: "Còn tốt",
  fair: "Đã qua sử dụng",
  poor: "Cần sửa chữa",
};

export default function StaffConsignmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [request, setRequest] = useState(null);
  const [prices, setPrices] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState("");

  const isStaff = ["staff", "admin"].includes(user?.role);

  const loadRequest = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api(`/staff/consignment-requests/${id}`);
      setRequest(data);
      setPrices(
        Object.fromEntries(
          (data.products || []).map((product) => [
            product.id,
            Number(product.final_price || product.expected_price || 0),
          ]),
        ),
      );
    } catch (requestError) {
      setRequest(null);
      setError(requestError.message || "Không thể tải chi tiết yêu cầu ký gửi.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Kiểm tra auth 1 lần khi mount (không đưa user vào deps để tránh re-render vô hạn)
  useEffect(() => {
    if (!getCurrentUser()) {
      navigate("/login", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch dữ liệu khi id thay đổi (chỉ khi là staff)
  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    if (["staff", "admin"].includes(currentUser.role)) loadRequest();
  }, [loadRequest]);

  async function runAction(actionKey, action) {
    setMessage("");
    setPendingAction(actionKey);
    try {
      const result = await action();
      setMessage(result?.message || "Đã cập nhật dữ liệu.");
      await loadRequest();
    } catch (requestError) {
      setMessage(requestError.message || "Không thể cập nhật yêu cầu ký gửi.");
    } finally {
      setPendingAction("");
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
          roleLabel={user.role === "admin" ? "Quản trị hệ thống" : "Nhân viên vận hành"}
          title="Chi tiết ký gửi"
          searchPlaceholder="Tìm kiếm yêu cầu ký gửi..."
        />

        <div className="px-6 py-8 lg:px-8 xl:px-10">
          <button
            type="button"
            onClick={() => navigate("/staff/consignments")}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#7c6e62] hover:text-ink"
          >
            <ArrowLeft size={17} />
            Quay lại danh sách yêu cầu
          </button>

          {loading ? (
            <div className="grid min-h-[420px] place-items-center">
              <Loader2 className="animate-spin text-clay" />
            </div>
          ) : request ? (
            <section className="mt-7 space-y-6">
              <header className="rounded-md border border-[#eadfd4] bg-white p-6 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-clay">{request.request_code}</p>
                    <h1 className="mt-3 font-display text-4xl font-bold leading-tight md:text-5xl">
                      Yêu cầu ký gửi {request.product_count || 0} sản phẩm
                    </h1>
                    <p className="mt-3 text-sm text-[#7c6e62]">Tạo lúc {formatDateTime(request.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <StatusBadge status={request.status} />
                    {request.status === "cancel_requested" ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <ActionButton
                          icon={CheckCircle2}
                          loading={pendingAction === "approve-cancel"}
                          disabled={Boolean(pendingAction)}
                          onClick={() => runAction("approve-cancel", () => api(`/staff/consignment-requests/${request.id}/cancel-request/approve`, { method: "PATCH" }))}
                        >
                          Chấp nhận hủy
                        </ActionButton>
                        <ActionButton
                          tone="danger"
                          icon={XCircle}
                          loading={pendingAction === "reject-cancel"}
                          disabled={Boolean(pendingAction)}
                          onClick={() => runAction("reject-cancel", () => api(`/staff/consignment-requests/${request.id}/cancel-request/reject`, { method: "PATCH", body: JSON.stringify({ reason: "Staff từ chối yêu cầu hủy." }) }))}
                        >
                          Từ chối hủy
                        </ActionButton>
                      </div>
                    ) : null}
                  </div>
                </div>
                {message && <p className="mt-6 rounded-md bg-[#f2e4d8] px-4 py-3 text-sm font-semibold text-[#7a4b2d]">{message}</p>}
                {request.cancel_request_status || request.cancel_reason ? (
                  <div className="mt-5 rounded-md border border-[#eadfd4] bg-[#fbf7f2] px-4 py-3 text-sm leading-6 text-[#6d6057]">
                    {request.cancel_request_status === "pending" ? <p className="font-bold text-[#8a572f]">Khách đã gửi yêu cầu hủy ký gửi.</p> : null}
                    {request.cancel_reason ? <p>Lý do: {request.cancel_reason}</p> : null}
                    {request.cancel_requested_at ? <p>Thời gian gửi: {formatDateTime(request.cancel_requested_at)}</p> : null}
                  </div>
                ) : null}
              </header>

              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <InfoPanel title="Thông tin người gửi" icon={UserRound}>
                  <InfoRow label="Mã yêu cầu" value={request.request_code} />
                  <InfoRow label="Khách hàng" value={request.seller_name || "Khách ký gửi"} />
                  <InfoRow label="Số điện thoại" value={request.seller_phone || "Chưa cập nhật"} />
                  <InfoRow label="Email" value={request.seller_email || "Chưa cập nhật"} />
                  <InfoRow label="Ghi chú" value={request.note || "Chưa có ghi chú"} />
                </InfoPanel>

                <ShippingPanel
                  request={request}
                  pendingAction={pendingAction}
                  onConfirm={() =>
                    runAction("confirm-shipping", () =>
                      api(`/staff/consignment-requests/${request.id}/confirm-received`, { method: "PATCH" }),
                    )
                  }
                />
              </div>

              <section className="rounded-md border border-[#eadfd4] bg-white p-5 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold">Sản phẩm trong yêu cầu</h2>
                    <p className="mt-1 text-sm text-[#7c6e62]">Staff xử lý duyệt, định giá, đăng bán và giải ngân theo từng sản phẩm.</p>
                  </div>
                  <p className="text-sm font-bold text-clay">Tổng giá đề xuất: {formatMoney(request.expected_total || 0)}</p>
                </div>

                <div className="mt-5 space-y-4">
                  {(request.products || []).map((product) => (
                    <ProductPanel
                      key={product.id}
                      product={product}
                      shipping={request.shipping}
                      price={prices[product.id] ?? ""}
                      onPriceChange={(value) => setPrices((current) => ({ ...current, [product.id]: value }))}
                      pendingAction={pendingAction}
                      runAction={runAction}
                    />
                  ))}
                  {!request.products?.length && (
                    <p className="rounded-md bg-[#fbf7f2] px-4 py-6 text-center text-sm text-[#7c6e62]">Yêu cầu này chưa có sản phẩm.</p>
                  )}
                </div>
              </section>
            </section>
          ) : (
            <section className="mt-7 rounded-md border border-[#eadfd4] bg-white p-8 shadow-soft">
              <h1 className="font-display text-4xl font-bold">Không tìm thấy yêu cầu ký gửi</h1>
              <p className="mt-4 text-sm text-[#7c6e62]">{error || "Yêu cầu này không tồn tại."}</p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function ShippingPanel({ request, pendingAction, onConfirm }) {
  const shipping = request.shipping || {};

  return (
    <InfoPanel title="Thông tin vận chuyển" icon={Truck}>
      <InfoRow label="Hình thức gửi hàng" value={shipping.methodLabel || shipping.method_label || "Chưa cập nhật"} />
      {shipping.isGhn || shipping.method === "ghn" ? (
        <>
          <InfoRow label="Mã vận đơn" value={shipping.orderCode || shipping.order_code || "Đang cập nhật"} />
          <InfoRow label="Phí ship" value={formatMoney(shipping.fee)} />
          <InfoRow label="Trạng thái vận chuyển" value={shipping.statusLabel || shipping.status_label || "Chưa cập nhật"} />
          <InfoRow label="Người gửi" value={[shipping.senderName || shipping.sender_name, shipping.senderPhone || shipping.sender_phone].filter(Boolean).join(" - ") || "Chưa cập nhật"} />
          <InfoRow label="Địa chỉ lấy hàng" value={shipping.senderAddress || shipping.sender_address || "Chưa cập nhật"} />
          <InfoRow label="Địa chỉ nhận hàng" value={shipping.receiverAddress || shipping.receiver_address || "Cửa hàng The Heirloom"} />
          <InfoRow label="Tạo vận đơn" value={formatDateTime(shipping.createdAt || shipping.created_at)} />
          <InfoRow label="Dự kiến giao" value={formatDateTime(shipping.expectedDelivery || shipping.expected_delivery)} />
          <InfoRow label="GHN giao đến cửa hàng" value={formatDateTime(shipping.deliveredAt || shipping.delivered_at)} />
          <InfoRow label="Staff xác nhận nhận hàng" value={formatDateTime(shipping.receivedAt || shipping.received_at)} />
          {shipping.canConfirmReceived || shipping.can_confirm_received ? (
            <div className="pt-4">
              <ActionButton icon={PackageCheck} loading={pendingAction === "confirm-shipping"} disabled={Boolean(pendingAction)} onClick={onConfirm}>
                Xác nhận đã nhận hàng
              </ActionButton>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <InfoRow label="Trạng thái tiếp nhận" value={shipping.statusLabel || shipping.status_label || "Tự mang đến cửa hàng"} />
          <InfoRow label="Cập nhật gần nhất" value={formatDateTime(request.updated_at)} />
        </>
      )}
    </InfoPanel>
  );
}

function ProductPanel({ product, shipping, price, onPriceChange, pendingAction, runAction }) {
  const canProcess = !shipping?.isGhn || shipping?.canProcess || shipping?.can_process;
  const actionPrefix = `product-${product.id}`;
  const imageUrl = product.product_image || product.image_url || product.images?.[0] || fallbackImage;
  const attrs = [
    product.category_name,
    product.brand,
    product.condition_level ? conditionLabels[product.condition_level] || product.condition_level : "",
  ].filter(Boolean);

  return (
    <article className="rounded-md border border-[#eadfd4] p-4">
      <div className="grid gap-4 lg:grid-cols-[112px_minmax(0,1fr)_280px]">
        <img
          src={imageUrl}
          alt={product.product_name}
          className="h-28 w-28 rounded-md object-cover"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = fallbackImage;
          }}
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-display text-2xl font-bold">{product.product_name}</h3>
              <p className="mt-1 text-sm text-[#7c6e62]">{attrs.length ? attrs.join(" · ") : "Chưa phân loại"}</p>
            </div>
            <StatusBadge status={product.status} />
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <InfoMini label="Giá khách đề xuất" value={formatMoney(product.expected_price)} />
            <InfoMini label="Giá định" value={product.final_price ? formatMoney(product.final_price) : "Chưa định giá"} />
            <InfoMini label="Mã sản phẩm ký gửi" value={`KG${String(product.id).padStart(4, "0")}`} />
            <InfoMini label="Cập nhật" value={formatDateTime(product.updated_at)} />
          </div>

          {product.condition_note ? (
            <p className="mt-4 rounded-md bg-[#fbf7f2] px-4 py-3 text-sm leading-6 text-[#6d6057]">{product.condition_note}</p>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SaleCard sale={product.sale} />
            <PayoutCard payout={product.payout} />
          </div>
        </div>

        <div className="rounded-md bg-[#fbf7f2] p-4">
          <h4 className="font-display text-lg font-bold">Thao tác</h4>
          <div className="mt-4 space-y-3">
            {!canProcess ? (
              <p className="rounded-md bg-white px-4 py-3 text-sm leading-6 text-[#7c6e62]">
                Hàng đang vận chuyển qua GHN. Staff xử lý sản phẩm sau khi xác nhận đã nhận hàng tại cửa hàng.
              </p>
            ) : (
              <ProductActions
                product={product}
                price={price}
                onPriceChange={onPriceChange}
                pendingAction={pendingAction}
                actionPrefix={actionPrefix}
                runAction={runAction}
              />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ProductActions({ product, price, onPriceChange, pendingAction, actionPrefix, runAction }) {
  if (product.status === "pending_review") {
    return (
      <>
        <ActionButton
          icon={CheckCircle2}
          loading={pendingAction === `${actionPrefix}-approve`}
          disabled={Boolean(pendingAction)}
          onClick={() => runAction(`${actionPrefix}-approve`, () => api(`/consignments/${product.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }))}
        >
          Duyệt sản phẩm
        </ActionButton>
        <ActionButton
          tone="danger"
          icon={XCircle}
          loading={pendingAction === `${actionPrefix}-reject`}
          disabled={Boolean(pendingAction)}
          onClick={() => runAction(`${actionPrefix}-reject`, () => api(`/consignments/${product.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }))}
        >
          Từ chối sản phẩm
        </ActionButton>
      </>
    );
  }

  if (product.status === "approved") {
    return (
      <>
        <ActionButton
          icon={PackageCheck}
          loading={pendingAction === `${actionPrefix}-receive`}
          disabled={Boolean(pendingAction)}
          onClick={() => runAction(`${actionPrefix}-receive`, () => api(`/consignments/${product.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "received" }) }))}
        >
          Tiếp nhận sản phẩm
        </ActionButton>
        <ActionButton
          tone="danger"
          icon={XCircle}
          loading={pendingAction === `${actionPrefix}-reject`}
          disabled={Boolean(pendingAction)}
          onClick={() => runAction(`${actionPrefix}-reject`, () => api(`/consignments/${product.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }))}
        >
          Từ chối sản phẩm
        </ActionButton>
      </>
    );
  }

  if (["received", "inspecting"].includes(product.status)) {
    return (
      <>
        <label className="block">
          <span className="text-xs font-bold text-[#5f554d]">Giá định cho sản phẩm</span>
          <input
            type="number"
            min="0"
            value={price}
            onChange={(event) => onPriceChange(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-[#eadfd4] bg-white px-4 text-sm outline-none focus:border-clay"
          />
        </label>
        <ActionButton
          icon={Tag}
          loading={pendingAction === `${actionPrefix}-price`}
          disabled={Boolean(pendingAction)}
          onClick={() => runAction(`${actionPrefix}-price`, () => api(`/consignments/${product.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "priced", finalPrice: Number(price) }) }))}
        >
          Lưu giá định
        </ActionButton>
      </>
    );
  }

  if (product.status === "seller_confirmed") {
    return (
      <ActionButton
        icon={BriefcaseBusiness}
        loading={pendingAction === `${actionPrefix}-publish`}
        disabled={Boolean(pendingAction)}
        onClick={() => runAction(`${actionPrefix}-publish`, () => api(`/consignments/${product.id}/publish`, { method: "POST" }))}
      >
        Đăng bán sản phẩm
      </ActionButton>
    );
  }

  if (product.status === "waiting_payout") {
    return (
      <ActionButton
        icon={WalletCards}
        loading={pendingAction === `${actionPrefix}-payout`}
        disabled={Boolean(pendingAction)}
        onClick={() => runAction(`${actionPrefix}-payout`, () => api(`/staff/consignment-requests/${product.request_id}/disburse`, { method: "PATCH", body: JSON.stringify({ itemId: product.id }) }))}
      >
        Giải ngân sản phẩm
      </ActionButton>
    );
  }

  return <p className="rounded-md bg-white px-4 py-3 text-sm leading-6 text-[#7c6e62]">Không có thao tác cần xử lý tại bước này.</p>;
}

function SaleCard({ sale }) {
  if (!sale) {
    return (
      <div className="rounded-md border border-[#eadfd4] bg-white p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><ReceiptText size={15} /> Bán hàng</p>
        <p className="mt-2 text-xs leading-5 text-[#7c6e62]">Chưa có đơn bán.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#eadfd4] bg-white p-3 text-xs leading-5 text-[#6d6057]">
      <p className="flex items-center gap-2 text-sm font-bold text-ink"><ReceiptText size={15} /> {sale.order_code || "Đơn hàng"}</p>
      <p>Ngày bán: {formatDateTime(sale.sold_at)}</p>
      <p>Giá bán: {formatMoney(sale.sale_price)}</p>
      <p>Trạng thái: {sale.order_status_label}</p>
    </div>
  );
}

function PayoutCard({ payout }) {
  if (!payout) {
    return (
      <div className="rounded-md border border-[#eadfd4] bg-white p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><WalletCards size={15} /> Giải ngân</p>
        <p className="mt-2 text-xs leading-5 text-[#7c6e62]">Chưa phát sinh giải ngân.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#eadfd4] bg-white p-3 text-xs leading-5 text-[#6d6057]">
      <p className="flex items-center gap-2 text-sm font-bold text-ink"><WalletCards size={15} /> {payout.status_label}</p>
      <p>Tiền hàng: {formatMoney(payout.gross_amount)}</p>
      <p>Hoa hồng: {formatMoney(payout.commission_amount)}</p>
      <p>Thực nhận: {formatMoney(payout.net_amount)}</p>
      <p>Phương thức: {payout.method === "bank_transfer" ? "Chuyển khoản" : payout.method || "Chưa cập nhật"}</p>
      <p>Ngân hàng: {payout.bank_name || "Chưa cập nhật"}</p>
      <p>Số tài khoản: {payout.bank_account || "Chưa cập nhật"}</p>
      <p>Ngày giải ngân: {formatDateTime(payout.paid_at)}</p>
      <p>Người xác nhận: {payout.paid_by_name || "Chưa cập nhật"}</p>
    </div>
  );
}

function InfoPanel({ title, icon: Icon, children }) {
  return (
    <section className="rounded-md border border-[#eadfd4] bg-white p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        {Icon ? <Icon size={19} className="text-clay" /> : null}
        {title}
      </h2>
      <div className="mt-4 divide-y divide-[#eadfd4]">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="grid gap-2 py-3 text-sm sm:grid-cols-[0.85fr_1fr]">
      <span className="text-[#7c6e62]">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function InfoMini({ label, value }) {
  return (
    <div className="rounded-md border border-[#eadfd4] bg-white px-3 py-2">
      <p className="text-xs font-bold text-[#7c6e62]">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex min-w-[132px] justify-center rounded-md px-3 py-2 text-xs font-bold ${statusStyles[status] || "bg-[#f0ede8] text-[#6c6258]"}`}>
      {statusLabels[status] || status || "Chưa cập nhật"}
    </span>
  );
}

function ActionButton({ icon: Icon, children, tone = "primary", loading = false, ...props }) {
  const className =
    tone === "danger"
      ? "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
      : "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <button type="button" className={className} {...props}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

function formatDateTime(value) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
