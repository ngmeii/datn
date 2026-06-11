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
  priced: "Đã định giá",
  seller_confirmed: "Người bán đã xác nhận",
  seller_cancelled: "Đã hủy ký gửi",
  listed: "Đang đăng bán",
  sold: "Đã bán",
  expired: "Hết hạn",
  returned: "Đã hoàn trả",
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

  const isStaff = user && ["staff", "admin"].includes(user.role);

  async function loadData() {
    if (!user) return;
    const [consignmentData, orderData, summaryData] = await Promise.all([
      api("/consignments").catch(() => []),
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
          <p className="text-sm font-bold uppercase text-clay">{isStaff ? "Trang nhân viên/admin" : "Tài khoản"}</p>
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
              <ConsignmentRow key={item.id} item={item} isStaff={isStaff} onAction={runAction} />
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
    </main>
  );
}

function ConsignmentRow({ item, isStaff, onAction }) {
  const [price, setPrice] = useState(item.final_price || item.expected_price || 0);

  return (
    <div className="border-b border-black/10 py-5 last:border-b-0">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="font-bold">{item.product_name}</p>
          <p className="mt-1 text-sm text-ink/55">
            {item.seller_name || item.category_name} · Dự kiến {formatMoney(item.expected_price)}
          </p>
          {item.final_price && <p className="mt-1 text-sm font-semibold text-moss">Giá định: {formatMoney(item.final_price)}</p>}
        </div>
        <span className="h-fit rounded-full bg-linen px-3 py-1 text-xs font-bold">
          {statusText[item.status] || item.status}
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
        item.status === "priced" && (
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton onClick={() => onAction(() => api(`/consignments/${item.id}/confirm`, { method: "PATCH" }))}>
              Xác nhận ký gửi
            </ActionButton>
            <ActionButton muted onClick={() => onAction(() => api(`/consignments/${item.id}/cancel`, { method: "PATCH", body: JSON.stringify({ reason: "Người bán hủy ký gửi sau định giá." }) }))}>
              Hủy ký gửi
            </ActionButton>
          </div>
        )
      )}
    </div>
  );
}

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

function ActionButton({ children, muted, ...props }) {
  return (
    <button
      className={muted ? "rounded-full border border-black/10 px-4 py-2 text-sm font-bold" : "rounded-full bg-ink px-4 py-2 text-sm font-bold text-white"}
      {...props}
    >
      {children}
    </button>
  );
}

function Empty({ text }) {
  return <p className="py-6 text-sm text-ink/55">{text}</p>;
}
