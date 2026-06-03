import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackageCheck,
  Tag,
  UserRound,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatMoney, getCurrentUser } from "../lib/api.js";

const statusLabels = {
  pending_review: "Chờ duyệt",
  approved: "Chờ tiếp nhận",
  received: "Cần định giá",
  inspecting: "Cần định giá",
  priced: "Chờ người bán xác nhận",
  seller_confirmed: "Chờ đăng bán",
  listed: "Đang đăng bán",
  rejected: "Từ chối",
  sold: "Đã bán",
  expired: "Hết hạn",
  returned: "Đã hoàn trả",
};

export default function StaffConsignmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [item, setItem] = useState(null);
  const [price, setPrice] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const isStaff = ["staff", "admin"].includes(user?.role);

  async function loadItem() {
    setLoading(true);
    try {
      const requests = await api("/consignments");
      const selected = requests.find((request) => Number(request.id) === Number(id));
      setItem(selected || null);
      setPrice(Number(selected?.final_price || selected?.expected_price || 0));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (isStaff) loadItem();
  }, [id]);

  async function runAction(action) {
    setMessage("");
    try {
      const result = await action();
      setMessage(result?.message || "Đã cập nhật dữ liệu.");
      await loadItem();
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
    <main className="min-h-screen bg-[#fbf7f2] px-6 py-10 text-[#211914] lg:px-12">
      <div className="mx-auto max-w-[1500px]">
        <Link to="/staff" className="inline-flex items-center gap-2 text-sm font-bold text-[#7c6e62] hover:text-ink">
          <ArrowLeft size={17} /> Quay lại danh sách yêu cầu
        </Link>

        {loading ? (
          <div className="grid min-h-[420px] place-items-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : item ? (
          <section className="mt-7 rounded-md border border-[#eadfd4] bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="font-display text-4xl font-bold">Chi tiết yêu cầu ký gửi</h1>
              <span className="text-sm text-[#7c6e62]">Mã đơn: THK{String(item.id).padStart(6, "0")}</span>
            </div>

            {message && <p className="mt-6 rounded-md bg-[#f2e4d8] px-4 py-3 text-sm font-semibold text-[#7a4b2d]">{message}</p>}

            <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_0.75fr_0.8fr]">
              <article className="rounded-md border border-[#eadfd4] p-5">
                <h2 className="font-display text-xl font-bold">Sản phẩm</h2>
                <img src={getRequestImage(item)} alt={item.product_name} className="mt-4 aspect-[1.22] w-full rounded-md object-cover" />
                <h3 className="mt-6 font-display text-lg font-bold">Thông tin người gửi</h3>
                <div className="mt-4 space-y-3 text-sm text-[#5f554d]">
                  <p className="flex items-center gap-2"><UserRound size={16} /> {item.seller_name || "Khách ký gửi"}</p>
                  <p className="flex items-center gap-2"><ClipboardList size={16} /> THK{String(item.id).padStart(6, "0")}</p>
                </div>
                <div className="mt-6 rounded-md bg-[#fbf7f2] p-4 text-sm leading-7 text-[#6d6057]">
                  “{item.condition_note || "Khách hàng gửi sản phẩm cần kiểm định và định giá."}”
                </div>
              </article>

              <article className="space-y-5">
                <InfoPanel title="Tình trạng sản phẩm">
                  <InfoRow label="Tình trạng tổng thể" value="Tốt" />
                  <InfoRow label="Hình thức bên ngoài" value="8.5/10" />
                  <InfoRow label="Phụ kiện đi kèm" value="Hộp/túi nếu có" />
                  <InfoRow label="Lỗi / Ghi chú" value={item.condition_note || "Chưa cập nhật"} />
                </InfoPanel>
                <InfoPanel title="Danh mục & Thương hiệu">
                  <InfoRow label="Danh mục" value={item.category_name || "Thời trang"} />
                  <InfoRow label="Thương hiệu" value={item.brand || "Chưa rõ"} />
                  <InfoRow label="Sản phẩm" value={item.product_name} />
                  <InfoRow label="Giá khách đề xuất" value={formatMoney(item.expected_price)} />
                </InfoPanel>
              </article>

              <article className="rounded-md border border-[#eadfd4] p-5">
                <h2 className="font-display text-xl font-bold">Hành động theo trạng thái</h2>
                <p className="mt-3 text-sm text-[#7c6e62]">Trạng thái hiện tại: {statusLabels[item.status] || item.status}</p>
                <div className="mt-5 space-y-3">
                  {item.status === "pending_review" && (
                    <>
                      <ActionButton icon={CheckCircle2} onClick={() => runAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) }))}>Duyệt yêu cầu</ActionButton>
                      <ActionButton tone="danger" icon={XCircle} onClick={() => runAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "rejected" }) }))}>Từ chối yêu cầu</ActionButton>
                    </>
                  )}
                  {item.status === "approved" && (
                    <ActionButton icon={PackageCheck} onClick={() => runAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "received" }) }))}>Tiếp nhận sản phẩm</ActionButton>
                  )}
                  {["received", "inspecting"].includes(item.status) && (
                    <>
                      <input type="number" value={price} onChange={(event) => setPrice(event.target.value)} className="h-12 w-full rounded-md border border-[#eadfd4] px-4 outline-none" />
                      <ActionButton icon={Tag} onClick={() => runAction(() => api(`/consignments/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "priced", finalPrice: Number(price) }) }))}>Lưu giá định</ActionButton>
                    </>
                  )}
                  {item.status === "seller_confirmed" && (
                    <ActionButton icon={BriefcaseBusiness} onClick={() => runAction(() => api(`/consignments/${item.id}/publish`, { method: "POST" }))}>Đăng bán sản phẩm</ActionButton>
                  )}
                  {!["pending_review", "approved", "received", "inspecting", "seller_confirmed"].includes(item.status) && (
                    <p className="rounded-md bg-[#fbf7f2] p-4 text-sm leading-6 text-[#7c6e62]">Không có hành động cần xử lý tại bước này.</p>
                  )}
                </div>
              </article>
            </div>
          </section>
        ) : (
          <section className="mt-7 rounded-md border border-[#eadfd4] bg-white p-8 shadow-soft">
            <h1 className="font-display text-4xl font-bold">Không tìm thấy yêu cầu ký gửi</h1>
          </section>
        )}
      </div>
    </main>
  );
}

function InfoPanel({ title, children }) {
  return (
    <div className="rounded-md border border-[#eadfd4] p-5">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-4 divide-y divide-[#eadfd4]">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-[0.8fr_1fr] gap-4 py-3 text-sm">
      <span className="text-[#7c6e62]">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ActionButton({ icon: Icon, children, tone = "primary", ...props }) {
  const className =
    tone === "danger"
      ? "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-red-300 text-sm font-bold text-red-600"
      : "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ink text-sm font-bold text-white";

  return (
    <button className={className} {...props}>
      {Icon && <Icon size={17} />}
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
