import { CheckCircle2, Loader2, PackagePlus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ImageUploadField from "../components/ImageUploadField.jsx";
import { api, formatMoney, getCurrentUser, uploadImage } from "../lib/api.js";

const conditionMultipliers = {
  new: 0.85,
  like_new: 0.85,
  good: 0.65,
  fair: 0.45,
  poor: 0.45,
};

function createDraftItem() {
  return {
    key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productName: "",
    categoryId: "",
    brand: "",
    expectedPrice: "",
    conditionLevel: "like_new",
    conditionNote: "",
    imageFile: null,
  };
}

export default function ConsignPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState(() => [createDraftItem()]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [sendMethod, setSendMethod] = useState("drop_off");
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [provinceCode, setProvinceCode] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [wardCode, setWardCode] = useState("");
  const [districtLoading, setDistrictLoading] = useState(false);
  const [wardLoading, setWardLoading] = useState(false);
  const [successRequest, setSuccessRequest] = useState(null);

  const estimate = useMemo(
    () => items.reduce((sum, item) => sum + estimateConsignmentValue(item), 0),
    [items],
  );

  useEffect(() => {
    api("/categories").then(setCategories).catch(() => setCategories([]));
    api("/locations/provinces").then(setProvinces).catch(() => setProvinces([]));
  }, []);

  useEffect(() => {
    setDistricts([]);
    setWards([]);
    setDistrictId("");
    setWardCode("");
    if (!provinceCode) return;

    setDistrictLoading(true);
    api(`/locations/provinces/${provinceCode}/districts`)
      .then(setDistricts)
      .catch((error) => setStatus(error.message))
      .finally(() => setDistrictLoading(false));
  }, [provinceCode]);

  useEffect(() => {
    setWards([]);
    setWardCode("");
    if (!districtId) return;

    setWardLoading(true);
    api(`/locations/districts/${districtId}/wards`)
      .then(setWards)
      .catch((error) => setStatus(error.message))
      .finally(() => setWardLoading(false));
  }, [districtId]);

  function updateItem(key, changes) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  }

  function addItem() {
    setItems((current) => [...current, createDraftItem()]);
  }

  function removeItem(key) {
    setItems((current) => (current.length > 1 ? current.filter((item) => item.key !== key) : current));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }

    const formElement = event.currentTarget;
    setLoading(true);
    setStatus("");
    const form = new FormData(formElement);
    const province = provinces.find((item) => String(item.code) === provinceCode);
    const district = districts.find((item) => String(item.code) === districtId);
    const ward = wards.find((item) => String(item.code) === wardCode);

    try {
      const uploadedItems = await Promise.all(
        items.map(async (item) => {
          const imageUrl = item.imageFile instanceof File && item.imageFile.size ? await uploadImage(item.imageFile) : "";
          return {
            productName: item.productName.trim(),
            categoryId: Number(item.categoryId),
            brand: item.brand.trim(),
            conditionLevel: item.conditionLevel,
            conditionNote: item.conditionNote.trim(),
            expectedPrice: Number(item.expectedPrice),
            imageUrl,
          };
        }),
      );

      const payload = {
        sendMethod,
        items: uploadedItems,
      };

      if (payload.sendMethod === "shipping") {
        payload.senderName = String(form.get("senderName") || user.full_name || "").trim();
        payload.senderPhone = String(form.get("senderPhone") || user.phone || "").trim();
        payload.senderProvince = province?.name || "";
        payload.senderProvinceCode = Number(provinceCode);
        payload.senderDistrict = district?.name || "";
        payload.senderDistrictId = Number(districtId);
        payload.senderWard = ward?.name || "";
        payload.senderWardCode = wardCode;
        payload.senderStreet = String(form.get("senderStreet") || "").trim();
      }

      const result = await api("/consignments", { method: "POST", body: JSON.stringify(payload) });
      setSuccessRequest(result);
      setStatus(result.message);
      formElement.reset();
      setItems([createDraftItem()]);
      setImageInputKey((value) => value + 1);
      setSendMethod("drop_off");
      setProvinceCode("");
      setDistrictId("");
      setWardCode("");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="bg-[#f8efe7] py-16">
        <div className="site-container">
          <h1 className="font-display text-5xl font-bold">Tạo yêu cầu ký gửi sản phẩm</h1>
        </div>
      </section>

      <section className="site-container grid gap-10 py-12 lg:grid-cols-[1fr_0.7fr]">
        <form className="grid gap-6 bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
          <section className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl font-bold">Sản phẩm ký gửi</h2>
                <p className="mt-2 text-sm text-muted">Có thể thêm nhiều sản phẩm trong cùng một đơn ký gửi.</p>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-bold text-ink transition hover:border-clay hover:text-clay"
              >
                <Plus size={16} />
                Thêm sản phẩm
              </button>
            </div>

            {items.map((item, index) => (
              <article key={item.key} className="rounded-md border border-border bg-[#fffaf6] p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h3 className="font-display text-2xl font-bold">Sản phẩm {index + 1}</h3>
                  {items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[#cfae98] bg-white px-3 text-xs font-bold text-[#9b513b]"
                    >
                      <Trash2 size={14} />
                      Xóa
                    </button>
                  ) : null}
                </div>

                <Field
                  label="Tên sản phẩm"
                  value={item.productName}
                  onChange={(event) => updateItem(item.key, { productName: event.target.value })}
                  required
                />

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <label>
                    <span className="text-sm font-semibold">Danh mục</span>
                    <select
                      value={item.categoryId}
                      onChange={(event) => updateItem(item.key, { categoryId: event.target.value })}
                      required
                      className="mt-2 h-12 w-full rounded-md border border-black/10 bg-white px-4"
                    >
                      <option value="">Chọn danh mục</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Thương hiệu"
                    value={item.brand}
                    onChange={(event) => updateItem(item.key, { brand: event.target.value })}
                  />
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Giá mua/giá mong muốn"
                    type="number"
                    min="0"
                    value={item.expectedPrice}
                    onChange={(event) => updateItem(item.key, { expectedPrice: event.target.value })}
                    required
                  />
                  <label>
                    <span className="text-sm font-semibold">Tình trạng</span>
                    <select
                      value={item.conditionLevel}
                      onChange={(event) => updateItem(item.key, { conditionLevel: event.target.value })}
                      required
                      className="mt-2 h-12 w-full rounded-md border border-black/10 bg-white px-4"
                    >
                      <option value="new">Mới</option>
                      <option value="like_new">Gần như mới</option>
                      <option value="good">Còn tốt</option>
                      <option value="fair">Đã qua sử dụng</option>
                      <option value="poor">Cần sửa chữa</option>
                    </select>
                  </label>
                </div>

                <label className="mt-5 block">
                  <span className="text-sm font-semibold">Mô tả tình trạng</span>
                  <textarea
                    value={item.conditionNote}
                    onChange={(event) => updateItem(item.key, { conditionNote: event.target.value })}
                    required
                    minLength="5"
                    rows="4"
                    className="mt-2 w-full rounded-md border border-black/10 bg-white px-4 py-3"
                    placeholder="Ví dụ: còn 90%, có xước nhẹ ở khóa..."
                  />
                </label>

                <div className="mt-5">
                  <ImageUploadField
                    key={`${imageInputKey}-${item.key}`}
                    name={`image-${item.key}`}
                    onFileChange={(file) => updateItem(item.key, { imageFile: file })}
                  />
                </div>

                <p className="mt-4 rounded-md bg-white px-4 py-3 text-sm font-semibold text-moss">
                  Ước lượng riêng: {formatMoney(estimateConsignmentValue(item))}
                </p>
              </article>
            ))}
          </section>

          <label>
            <span className="text-sm font-semibold">Phương thức gửi hàng</span>
            <select
              name="sendMethod"
              required
              value={sendMethod}
              onChange={(event) => setSendMethod(event.target.value)}
              className="mt-2 h-12 w-full rounded-md border border-black/10 px-4"
            >
              <option value="drop_off">Tự mang đến cửa hàng</option>
              <option value="pickup">Cửa hàng lấy hàng tại nhà</option>
              <option value="shipping">Tạo vận đơn GHN gửi về cửa hàng</option>
            </select>
          </label>

          {sendMethod === "shipping" && (
            <section className="grid gap-5 rounded-md border border-border bg-cream p-5">
              <h2 className="font-display text-2xl font-bold">Thông tin người gửi</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Họ và tên" name="senderName" defaultValue={user?.full_name || ""} required />
                <Field label="Số điện thoại" name="senderPhone" defaultValue={user?.phone || ""} required />
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <label>
                  <span className="text-sm font-semibold">Tỉnh/Thành phố</span>
                  <select value={provinceCode} onChange={(event) => setProvinceCode(event.target.value)} required className="mt-2 h-12 w-full rounded-md border border-black/10 bg-white px-4">
                    <option value="">Chọn tỉnh/thành phố</option>
                    {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold">Quận/Huyện</span>
                  <select value={districtId} onChange={(event) => setDistrictId(event.target.value)} required disabled={!provinceCode || districtLoading} className="mt-2 h-12 w-full rounded-md border border-black/10 bg-white px-4 disabled:bg-cream">
                    <option value="">{districtLoading ? "Đang tải..." : "Chọn quận/huyện"}</option>
                    {districts.map((district) => <option key={district.code} value={district.code}>{district.name}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold">Phường/Xã</span>
                  <select value={wardCode} onChange={(event) => setWardCode(event.target.value)} required disabled={!districtId || wardLoading} className="mt-2 h-12 w-full rounded-md border border-black/10 bg-white px-4 disabled:bg-cream">
                    <option value="">{wardLoading ? "Đang tải..." : "Chọn phường/xã"}</option>
                    {wards.map((ward) => <option key={ward.code} value={ward.code}>{ward.name}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span className="text-sm font-semibold">Địa chỉ chi tiết</span>
                <textarea name="senderStreet" required rows="3" className="mt-2 w-full rounded-md border border-black/10 bg-white px-4 py-3" placeholder="Số nhà, tên đường, tòa nhà..." />
              </label>
            </section>
          )}

          {status && <p className="rounded-md bg-linen px-4 py-3 text-sm font-semibold">{status}</p>}
          <button type="submit" disabled={loading} className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <PackagePlus size={18} />}
            Gửi yêu cầu ký gửi
          </button>
        </form>

        <aside className="h-fit border border-black/10 bg-white p-6">
          <h2 className="font-display text-3xl font-bold">Ước lượng giá</h2>
          <p className="mt-4 text-4xl font-bold text-moss">{formatMoney(estimate)}</p>
          <p className="mt-3 rounded-md bg-linen px-4 py-3 text-sm font-semibold text-clay">
            {items.length} sản phẩm trong đơn ký gửi này.
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-ink/65">
            <p>Phí ký gửi mặc định: 20% giá bán.</p>
            <p>Thời hạn ký gửi: 45 ngày. Khi hết hạn, hệ thống gửi thông báo để người bán chọn nhận lại hoặc tiếp tục xử lý.</p>
            <p>Nếu chọn GHN, hệ thống sẽ tạo một mã vận đơn cho toàn bộ sản phẩm trong đơn ký gửi.</p>
          </div>
          {!user && (
            <Link to="/login" className="mt-6 inline-block rounded-full border border-ink px-5 py-3 text-sm font-bold">
              Đăng nhập để gửi yêu cầu
            </Link>
          )}
        </aside>
      </section>
      {successRequest ? <ConsignmentSuccessModal request={successRequest} onClose={() => setSuccessRequest(null)} /> : null}
    </main>
  );
}

function ConsignmentSuccessModal({ request, onClose }) {
  const requestCode = `#KG${String(request.id || 0).padStart(6, "0")}`;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/35 px-5 backdrop-blur-sm">
      <section className="relative w-full max-w-[480px] rounded-2xl border border-border bg-white p-7 text-center shadow-soft">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-border text-muted transition hover:border-ink hover:text-ink"
          aria-label="Đóng thông báo"
        >
          <X size={18} />
        </button>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 size={34} />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-clay">Gửi yêu cầu thành công</p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ink">Yêu cầu ký gửi đã được ghi nhận</h2>
        <div className="mt-5 rounded-xl bg-linen px-5 py-4 text-left text-sm">
          <ModalRow label="Mã yêu cầu" value={requestCode} />
          <ModalRow label="Số sản phẩm" value={request.itemCount || request.itemIds?.length || 1} />
          <ModalRow label="Trạng thái" value="Chờ duyệt" />
          {request.ghnOrderCode ? <ModalRow label="Mã vận đơn GHN" value={request.ghnOrderCode} /> : null}
          {Number(request.shippingFee || 0) > 0 ? <ModalRow label="Phí vận chuyển" value={formatMoney(request.shippingFee)} strong /> : null}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/dashboard"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-ink px-6 text-sm font-bold text-white"
          >
            Xem trạng thái
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border px-6 text-sm font-bold text-ink"
          >
            Đóng
          </button>
        </div>
      </section>
    </div>
  );
}

function ModalRow({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 first:pt-0 last:border-b-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className={`text-right ${strong ? "text-base font-bold text-ink" : "font-semibold text-ink"}`}>{value}</span>
    </div>
  );
}

function Field({ label, name, type = "text", ...props }) {
  return (
    <label>
      <span className="text-sm font-semibold">{label}</span>
      <input name={name} type={type} className="mt-2 h-12 w-full rounded-md border border-black/10 px-4 outline-none" {...props} />
    </label>
  );
}

function estimateConsignmentValue(item) {
  const base = Number(item.expectedPrice || 0);
  const multiplier = conditionMultipliers[item.conditionLevel] || 0.45;
  return Math.round(base * multiplier);
}
