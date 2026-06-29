import { BarChart3, ClipboardList, PackageCheck, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatMoney, getCurrentUser } from "../lib/api.js";

const statusText = {
  pending_review: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  received: "Đã tiếp nhận",
  inspecting: "Đang kiểm định",
  priced: "Chờ xác nhận giá",
  seller_confirmed: "Chờ đăng bán",
  seller_cancelled: "Đã hủy ký gửi",
  cancel_requested: "Đang chờ staff xử lý hủy",
  cancel_rejected: "Yêu cầu hủy bị từ chối",
  listed: "Đang đăng bán",
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

const orderStatusText = {
  pending_payment: "Chờ thanh toán",
  pending_confirmation: "Chờ xác nhận",
  paid: "Đã thanh toán",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  return_requested: "Yêu cầu trả hàng",
  refunded: "Đã hoàn tiền",
};

export default function DashboardPage({ staffOnly = false }) {
  const user = getCurrentUser();
  const [consignments, setConsignments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [adminData, setAdminData] = useState(null);
  const [message, setMessage] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [canceling, setCanceling] = useState(false);

  const isStaff = user && ["staff", "admin"].includes(user.role);

  async function loadData() {
    if (!user) return;
    const [consignmentData, orderData, summaryData] = await Promise.all([
      api(isStaff ? "/consignments" : "/customer/consignment-requests").catch(() => []),
      api("/orders").catch(() => []),
      isStaff ? api("/admin/summary").catch(() => null) : Promise.resolve(null),
    ]);
    setConsignments(consignmentData);
    setOrders(orderData);
    setAdminData(summaryData);
  }

  useEffect(() => {
    loadData();
  }, []);

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

  async function submitCancelRequest(reason) {
    if (!cancelTarget) return;
    setCanceling(true);
    setMessage("");
    try {
      const path = cancelTarget.cancel_action === "cancel" ? "cancel" : "request-cancel";
      const result = await api(`/customer/consignment-requests/${cancelTarget.id}/${path}`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });
      setMessage(result?.message || "Đã cập nhật yêu cầu ký gửi.");
      setCancelTarget(null);
      await loadData();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setCanceling(false);
    }
  }

  if (!user) {
    return (
      <main className="site-container py-20">
        <h1 className="font-display text-5xl font-bold">Bạn cần đăng nhập</h1>
        <Link to="/login" className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">
          Đăng nhập
        </Link>
      </main>
    );
  }

  if (staffOnly && !isStaff) {
    return (
      <main className="site-container py-20">
        <h1 className="font-display text-5xl font-bold">Không có quyền truy cập</h1>
        <p className="mt-4 text-ink/60">Trang này chỉ dành cho nhân viên và admin.</p>
      </main>
    );
  }

  const summary = adminData?.summary;

  return (
    <main className="site-container py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-bold uppercase text-clay">{isStaff ? "Trang nhân viên/admin" : "Đơn hàng"}</p>
          <h1 className="mt-3 font-display text-5xl font-bold">Xin chào, {user.name || user.full_name}</h1>
        </div>
        {!isStaff && (
          <Link to="/consign" className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">
            Tạo yêu cầu ký gửi
          </Link>
        )}
      </div>

      {message && <p className="mt-6 rounded-md bg-linen px-4 py-3 text-sm font-semibold">{message}</p>}

      {summary && (
        <section className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={PackageCheck} label="Sản phẩm" value={summary.product_count} />
          <Metric icon={ClipboardList} label="Yêu cầu chờ duyệt" value={summary.pending_consignment_count} />
          <Metric icon={ReceiptText} label="Đơn hàng" value={summary.order_count} />
          <Metric icon={BarChart3} label="Doanh thu" value={formatMoney(summary.revenue)} />
        </section>
      )}

      <section className="mt-10 grid gap-8 xl:grid-cols-2">
        <Panel title={isStaff ? "Duyệt và xử lý ký gửi" : "Trạng thái ký gửi của tôi"}>
          {consignments.length ? (
            consignments.map((item) => (
              <ConsignmentRow key={item.id} item={item} isStaff={isStaff} onAction={runAction} onCancelClick={setCancelTarget} />
            ))
          ) : (
            <Empty text="Chưa có yêu cầu ký gửi." />
          )}
        </Panel>

        <Panel title={isStaff ? "Quản lý đơn hàng và giải ngân" : "Đơn hàng của tôi"}>
          {orders.length ? (
            orders.map((order) => (
              <OrderRow key={order.id} order={order} isStaff={isStaff} onAction={runAction} />
            ))
          ) : (
            <Empty text="Chưa có đơn hàng." />
          )}
        </Panel>
      </section>
      {cancelTarget && (
        <CancelConsignmentModal
          item={cancelTarget}
          loading={canceling}
          onClose={() => !canceling && setCancelTarget(null)}
          onSubmit={submitCancelRequest}
        />
      )}
    </main>
  );
}

function ConsignmentRow({ item, isStaff, onAction, onCancelClick }) {
  const [price, setPrice] = useState(item.final_price || item.expected_price || 0);
  const navigate = useNavigate();
  const displayStatus = item.display_status || statusText[item.status] || item.status;

  return (
    <div
      role={!isStaff ? "link" : undefined}
      tabIndex={!isStaff ? 0 : undefined}
      onClick={!isStaff ? () => navigate(`/account/consignments/${item.id}`) : undefined}
      onKeyDown={!isStaff ? (event) => {
        if (event.key === "Enter" || event.key === " ") navigate(`/account/consignments/${item.id}`);
      } : undefined}
      className={`border-b border-black/10 px-3 py-5 transition last:border-b-0 ${!isStaff ? "cursor-pointer hover:bg-cream" : ""}`}
    >
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="font-bold">{item.product_name}</p>
          <p className="mt-1 text-sm text-ink/55">
            {item.seller_name || item.category_name} · Dự kiến {formatMoney(item.expected_price || item.proposed_price)}
          </p>
          {item.final_price && <p className="mt-1 text-sm font-semibold text-moss">Giá định: {formatMoney(item.final_price)}</p>}
          {item.sale_price ? <p className="mt-1 text-sm font-semibold text-clay">Giá bán: {formatMoney(item.sale_price)}</p> : null}
        </div>
        <span className="h-fit rounded-full bg-linen px-3 py-1 text-xs font-bold">
          {displayStatus}
        </span>
      </div>

      {isStaff ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.status === "pending_review" && (
            <>
              <ActionButton onClick={() => onAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }))}>
                Duyệt
              </ActionButton>
              <ActionButton muted onClick={() => onAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }))}>
                Từ chối
              </ActionButton>
            </>
          )}
          {item.status === "approved" && (
            <ActionButton onClick={() => onAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "received" }) }))}>
              Tiếp nhận
            </ActionButton>
          )}
          {["received", "inspecting"].includes(item.status) && (
            <>
              <input
                className="h-10 w-36 rounded-md border border-black/10 px-3 text-sm"
                type="number"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
              <ActionButton onClick={() => onAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "priced", finalPrice: Number(price) }) }))}>
                Định giá
              </ActionButton>
            </>
          )}
          {item.status === "seller_confirmed" && (
            <ActionButton onClick={() => onAction(() => api(`/consignments/${item.id}/publish`, { method: "POST" }))}>
              Đăng bán
            </ActionButton>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          {item.status === "priced" && (
            <>
              <ActionButton onClick={() => onAction(() => api(`/customer/consignment-requests/${item.id}/confirm-price`, { method: "PATCH" }))}>
                Xác nhận ký gửi
              </ActionButton>
              <ActionButton muted onClick={() => onAction(() => api(`/customer/consignment-requests/${item.id}/reject-price`, { method: "PATCH", body: JSON.stringify({ reason: "Người bán từ chối giá ký gửi." }) }))}>
                Từ chối ký gửi
              </ActionButton>
            </>
          )}
          {item.cancel_action ? (
            <ActionButton danger onClick={() => onCancelClick(item)}>
              {item.cancel_action === "cancel" ? "Hủy yêu cầu ký gửi" : "Gửi yêu cầu hủy"}
            </ActionButton>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CancelConsignmentModal({ item, loading, onClose, onSubmit }) {
  const [reason, setReason] = useState(cancelReasons[0]);
  const isDirectCancel = item.cancel_action === "cancel";

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(reason);
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/40 px-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-soft">
        <h2 className="font-display text-3xl font-bold">
          {isDirectCancel ? "Hủy yêu cầu ký gửi?" : "Gửi yêu cầu hủy ký gửi?"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          {isDirectCancel
            ? "Bạn có chắc chắn muốn hủy yêu cầu ký gửi này không? Sau khi hủy, yêu cầu sẽ không được tiếp tục xử lý."
            : "Yêu cầu ký gửi này đang được xử lý hoặc sản phẩm đã được gửi đến cửa hàng. Staff sẽ kiểm tra và phản hồi sau."}
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-bold text-ink">Lý do hủy</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-2 h-12 w-full rounded-md border border-border bg-white px-4 text-sm outline-none focus:border-clay"
            >
              {cancelReasons.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows="3"
            className="w-full rounded-md border border-border px-4 py-3 text-sm outline-none focus:border-clay"
          />
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={loading} className="h-11 rounded-full border border-border px-6 text-sm font-bold text-muted disabled:opacity-60">
              Đóng
            </button>
            <button disabled={loading} className="h-11 rounded-full bg-ink px-6 text-sm font-bold text-white disabled:opacity-60">
              {isDirectCancel ? "Xác nhận hủy" : "Gửi yêu cầu hủy"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

const cancelReasons = [
  "Tôi không còn muốn ký gửi sản phẩm",
  "Tôi muốn chỉnh sửa lại thông tin sản phẩm",
  "Tôi đã bán sản phẩm ở nơi khác",
  "Phí vận chuyển không phù hợp",
  "Lý do khác",
];

function OrderRow({ order, isStaff, onAction }) {
  const navigate = useNavigate();

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/orders/${order.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") navigate(`/orders/${order.id}`);
      }}
      className="cursor-pointer border-b border-black/10 px-3 py-5 transition last:border-b-0 hover:bg-cream"
    >
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="font-bold">Đơn hàng #{order.id}</p>
          <p className="mt-1 text-sm text-ink/55">{order.buyer_name || order.payment_method}</p>
        </div>
        <div className="text-right">
          <p className="font-bold">{formatMoney(order.total)}</p>
          <p className="mt-1 text-xs uppercase text-ink/45">{orderStatusText[order.status] || order.status}</p>
        </div>
      </div>
      {isStaff && (
        <div className="mt-4 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          {order.status === "pending_confirmation" && (
            <ActionButton onClick={() => onAction(() => api(`/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) }))}>
              Xác nhận đơn
            </ActionButton>
          )}
          {["pending_payment", "confirmed"].includes(order.status) && (
            <ActionButton onClick={() => onAction(() => api(`/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) }))}>
              Ghi nhận thanh toán
            </ActionButton>
          )}
          {["paid", "confirmed"].includes(order.status) && (
            <ActionButton onClick={() => onAction(() => api(`/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "shipping" }) }))}>
              Giao hàng
            </ActionButton>
          )}
          {order.status === "shipping" && (
            <ActionButton onClick={() => onAction(() => api(`/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) }))}>
              Hoàn tất
            </ActionButton>
          )}
          {order.status === "completed" && (
            <ActionButton onClick={() => onAction(() => api(`/orders/${order.id}/payout`, { method: "POST" }))}>
              Giải ngân
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="border border-black/10 bg-white p-6">
      <Icon className="text-moss" />
      <p className="mt-5 text-sm font-semibold text-ink/55">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </article>
  );
}

function Panel({ title, children }) {
  return (
    <section className="bg-white p-6 shadow-soft">
      <h2 className="font-display text-3xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ActionButton({ children, muted, danger, ...props }) {
  const className = danger
    ? "rounded-full border border-red-300 px-4 py-2 text-sm font-bold text-red-600"
    : muted
      ? "rounded-full border border-black/10 px-4 py-2 text-sm font-bold"
      : "rounded-full bg-ink px-4 py-2 text-sm font-bold text-white";

  return (
    <button
      type="button"
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

function Empty({ text }) {
  return <p className="py-6 text-sm text-ink/55">{text}</p>;
}
