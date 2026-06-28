import { Loader2 } from "lucide-react";
import { CheckCircle2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatMoney, getCurrentUser } from "../lib/api.js";
import { clearCart, clearCheckoutItems, getCheckoutItems, removeFromCart } from "../lib/cart.js";

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const productId = params.get("productId");
  const user = getCurrentUser();
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucherCode, setAppliedVoucherCode] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [provinceCode, setProvinceCode] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [wardCode, setWardCode] = useState("");
  const [districtLoading, setDistrictLoading] = useState(false);
  const [wardLoading, setWardLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [transferContent] = useState(() => `HEIRLOOM ${Date.now().toString().slice(-8)}`);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successOrder, setSuccessOrder] = useState(null);

  useEffect(() => {
    if (productId) {
      api(`/products/${productId}`).then((product) => setItems([{ ...product, quantity: 1 }])).catch((error) => setMessage(error.message));
    } else {
      setItems(getCheckoutItems());
    }
  }, [productId]);

  useEffect(() => {
    api("/locations/provinces")
      .then(setProvinces)
      .catch((error) => setMessage(error.message));
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
      .catch((error) => setMessage(error.message))
      .finally(() => setDistrictLoading(false));
  }, [provinceCode]);

  useEffect(() => {
    setWards([]);
    setWardCode("");
    if (!districtId) return;

    setWardLoading(true);
    api(`/locations/districts/${districtId}/wards`)
      .then(setWards)
      .catch((error) => setMessage(error.message))
      .finally(() => setWardLoading(false));
  }, [districtId]);

  const orderItems = useMemo(
    () => items.map((item) => ({ productId: Number(item.id), quantity: Number(item.quantity || 1) })),
    [items],
  );

  useEffect(() => {
    if (!items.length || !districtId || !wardCode) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    api("/orders/quote", {
      method: "POST",
      body: JSON.stringify({
        items: orderItems,
        voucherCode: appliedVoucherCode,
        shippingDistrictId: Number(districtId),
        shippingWardCode: wardCode,
      }),
    })
      .then((result) => {
        if (!cancelled) {
          setQuote(result);
          if (appliedVoucherCode) {
            const discount = Number(result.discountAmount || 0);
            setMessage(discount > 0 ? `Đã áp dụng voucher ${appliedVoucherCode}, giảm ${formatMoney(discount)}.` : `Voucher ${appliedVoucherCode} không tạo giảm giá cho đơn này.`);
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setQuote(null);
          if (appliedVoucherCode) setAppliedVoucherCode("");
          setMessage(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appliedVoucherCode, districtId, items.length, orderItems, wardCode]);

  function clearFieldError(field) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleApplyVoucher() {
    const normalizedCode = voucherCode.trim().toUpperCase();
    if (!normalizedCode) {
      setAppliedVoucherCode("");
      setQuote(null);
      setMessage("Nhập mã voucher trước khi áp dụng.");
      return;
    }
    if (!districtId || !wardCode) {
      setMessage("Chọn đủ địa chỉ giao hàng để tính phí vận chuyển và áp voucher.");
      return;
    }

    setMessage(`Đang áp dụng voucher ${normalizedCode}...`);
    setQuoteLoading(true);
    try {
      const result = await api("/orders/quote", {
        method: "POST",
        body: JSON.stringify({
          items: orderItems,
          voucherCode: normalizedCode,
          shippingDistrictId: Number(districtId),
          shippingWardCode: wardCode,
        }),
      });
      const discount = Number(result.discountAmount || 0);
      setQuote(result);
      setAppliedVoucherCode(normalizedCode);
      setMessage(discount > 0 ? `Đã áp dụng voucher ${normalizedCode}, giảm ${formatMoney(discount)}.` : `Voucher ${normalizedCode} không tạo giảm giá cho đơn này.`);
    } catch (error) {
      setQuote(null);
      setAppliedVoucherCode("");
      setMessage(error.message);
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!items.length) {
      setMessage("Bạn chưa chọn sản phẩm để thanh toán.");
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const province = provinces.find((item) => String(item.code) === provinceCode);
    const district = districts.find((item) => String(item.code) === districtId);
    const ward = wards.find((item) => String(item.code) === wardCode);
    const receiverName = String(form.get("receiverName") || "").trim();
    const receiverPhone = String(form.get("receiverPhone") || "").replace(/[\s.-]/g, "");
    const receiverEmail = String(form.get("receiverEmail") || "").trim();
    const shippingStreet = String(form.get("shippingStreet") || "").trim();
    const errors = {};

    if (receiverName.length < 2) errors.receiverName = "Vui lòng nhập họ và tên.";
    if (!/^(?:\+84|0)\d{9,10}$/.test(receiverPhone)) errors.receiverPhone = "Vui lòng nhập số điện thoại hợp lệ.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail)) errors.receiverEmail = "Vui lòng nhập email hợp lệ.";
    if (!provinceCode || !province) errors.shippingProvince = "Vui lòng chọn tỉnh/thành phố.";
    if (!districtId || !district) errors.shippingDistrict = "Vui lòng chọn quận/huyện.";
    if (!wardCode || !ward) errors.shippingWard = "Vui lòng chọn phường/xã.";
    if (shippingStreet.length < 3) errors.shippingStreet = "Vui lòng nhập địa chỉ chi tiết.";

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setMessage("Vui lòng điền đầy đủ và chính xác thông tin người nhận.");
      const firstField = Object.keys(errors)[0];
      window.setTimeout(() => formElement.querySelector(`[data-field="${firstField}"]`)?.focus(), 0);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setMessage("");
    try {
      const order = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: orderItems,
          receiverName,
          receiverPhone,
          receiverEmail,
          shippingProvince: province.name,
          shippingProvinceCode: Number(provinceCode),
          shippingDistrict: district.name,
          shippingDistrictId: Number(districtId),
          shippingWard: ward.name,
          shippingWardCode: wardCode,
          shippingStreet,
          paymentMethod: form.get("paymentMethod"),
          voucherCode: appliedVoucherCode || voucherCode.trim(),
        }),
      });

      if (!productId) {
        await Promise.all(items.map((item) => removeFromCart(item.id)));
        clearCheckoutItems();
      } else {
        await clearCart();
      }

      setItems([]);
      setSuccessOrder(order);
      setMessage(`Đã tạo đơn hàng #${order.id}. Mã vận đơn GHN: ${order.ghnOrderCode || "đang cập nhật"}. Tổng thanh toán: ${formatMoney(order.total)}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity || 1), 0);
  const discountAmount = Number(quote?.discountAmount || 0);
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const fallbackShippingFee = districtId && wardCode ? estimateShippingFee(districtId, items) : 0;
  const quotedShippingFee = Number(quote?.shippingFee || 0);
  const shippingFee = quotedShippingFee || fallbackShippingFee;
  const total = quote && quotedShippingFee ? Number(quote.total || 0) : discountedSubtotal + shippingFee;
  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);
  const bankCode = import.meta.env.VITE_BANK_CODE || "MB";
  const bankAccount = import.meta.env.VITE_BANK_ACCOUNT || "0123456789";
  const bankAccountName = import.meta.env.VITE_BANK_ACCOUNT_NAME || "THE HEIRLOOM";
  const qrUrl = `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(bankAccount)}-compact2.png?amount=${Math.round(total)}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(bankAccountName)}`;

  return (
    <main className="site-container grid gap-10 py-12 lg:grid-cols-[1fr_0.65fr]">
      <section>
        <h1 className="font-display text-5xl font-bold">Thanh toán đơn hàng</h1>
        <form noValidate className="mt-8 grid gap-5 bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
          <h2 className="font-display text-2xl font-bold">Thông tin người nhận</h2>
          {message && hasFieldErrors && <p className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{message}</p>}
          <div className="grid gap-5 sm:grid-cols-2">
            <CheckoutField label="Họ và tên" name="receiverName" error={fieldErrors.receiverName} onChange={() => clearFieldError("receiverName")} defaultValue={user?.full_name || ""} autoComplete="name" required />
            <CheckoutField label="Số điện thoại" name="receiverPhone" error={fieldErrors.receiverPhone} onChange={() => clearFieldError("receiverPhone")} type="tel" defaultValue={user?.phone || ""} autoComplete="tel" placeholder="Ví dụ: 0901234567" required />
          </div>
          <CheckoutField label="Email" name="receiverEmail" error={fieldErrors.receiverEmail} onChange={() => clearFieldError("receiverEmail")} type="email" defaultValue={user?.email || ""} autoComplete="email" required />
          <div className="grid gap-5 sm:grid-cols-3">
            <label>
              <RequiredLabel>Tỉnh/Thành phố</RequiredLabel>
              <select data-field="shippingProvince" value={provinceCode} onChange={(event) => { setProvinceCode(event.target.value); clearFieldError("shippingProvince"); }} required aria-invalid={Boolean(fieldErrors.shippingProvince)} className={`mt-2 h-12 w-full rounded-md border bg-white px-4 outline-none ${fieldErrors.shippingProvince ? "border-danger" : "border-black/10"}`}>
                <option value="">Chọn tỉnh/thành phố</option>
                {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
              </select>
              {fieldErrors.shippingProvince && <FieldError>{fieldErrors.shippingProvince}</FieldError>}
            </label>
            <label>
              <RequiredLabel>Quận/Huyện</RequiredLabel>
              <select data-field="shippingDistrict" value={districtId} onChange={(event) => { setDistrictId(event.target.value); clearFieldError("shippingDistrict"); }} required disabled={!provinceCode || districtLoading} aria-invalid={Boolean(fieldErrors.shippingDistrict)} className={`mt-2 h-12 w-full rounded-md border bg-white px-4 outline-none disabled:bg-cream disabled:text-muted ${fieldErrors.shippingDistrict ? "border-danger" : "border-black/10"}`}>
                <option value="">{districtLoading ? "Đang tải quận/huyện..." : "Chọn quận/huyện"}</option>
                {districts.map((district) => <option key={district.code} value={district.code}>{district.name}</option>)}
              </select>
              {fieldErrors.shippingDistrict && <FieldError>{fieldErrors.shippingDistrict}</FieldError>}
            </label>
            <label>
              <RequiredLabel>Phường/Xã</RequiredLabel>
              <select data-field="shippingWard" value={wardCode} onChange={(event) => { setWardCode(event.target.value); clearFieldError("shippingWard"); }} required disabled={!districtId || wardLoading} aria-invalid={Boolean(fieldErrors.shippingWard)} className={`mt-2 h-12 w-full rounded-md border bg-white px-4 outline-none disabled:bg-cream disabled:text-muted ${fieldErrors.shippingWard ? "border-danger" : "border-black/10"}`}>
                <option value="">{wardLoading ? "Đang tải phường/xã..." : "Chọn phường/xã"}</option>
                {wards.map((ward) => <option key={ward.code} value={ward.code}>{ward.name}</option>)}
              </select>
              {fieldErrors.shippingWard && <FieldError>{fieldErrors.shippingWard}</FieldError>}
            </label>
          </div>
          <label>
            <RequiredLabel>Địa chỉ chi tiết</RequiredLabel>
            <textarea name="shippingStreet" data-field="shippingStreet" required rows="3" onChange={() => clearFieldError("shippingStreet")} aria-invalid={Boolean(fieldErrors.shippingStreet)} className={`mt-2 w-full rounded-md border px-4 py-3 outline-none ${fieldErrors.shippingStreet ? "border-danger" : "border-black/10"}`} placeholder="Số nhà, tên đường, tòa nhà..." />
            {fieldErrors.shippingStreet && <FieldError>{fieldErrors.shippingStreet}</FieldError>}
          </label>
          <label>
            <span className="text-sm font-semibold">Phương thức thanh toán</span>
            <select name="paymentMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-2 h-12 w-full rounded-md border border-black/10 bg-white px-4 outline-none">
              <option value="cod">Thanh toán khi nhận hàng (COD)</option>
              <option value="bank_transfer">Chuyển khoản ngân hàng</option>
            </select>
          </label>
          {paymentMethod === "bank_transfer" && (
            <section className="rounded-xl border border-border bg-cream p-5">
              <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr]">
                <div className="rounded-xl border border-border bg-white p-3"><img src={qrUrl} alt={`Mã QR chuyển khoản ${formatMoney(total)}`} className="aspect-square w-full object-contain" /></div>
                <div>
                  <p className="font-display text-2xl font-bold">Quét mã để chuyển khoản</p>
                  <p className="mt-2 text-sm leading-6 text-muted">Vui lòng chuyển đúng số tiền và giữ nguyên nội dung để cửa hàng đối soát đơn hàng.</p>
                  <dl className="mt-5 space-y-3 text-sm">
                    <BankRow label="Ngân hàng" value={bankCode} />
                    <BankRow label="Số tài khoản" value={bankAccount} />
                    <BankRow label="Chủ tài khoản" value={bankAccountName} />
                    <BankRow label="Số tiền" value={formatMoney(total)} strong />
                    <BankRow label="Nội dung" value={transferContent} />
                  </dl>
                </div>
              </div>
            </section>
          )}
          <label>
            <span className="text-sm font-semibold">Mã voucher</span>
            <div className="mt-2 flex gap-3">
              <input name="voucherCode" value={voucherCode} onChange={(event) => { setVoucherCode(event.target.value); if (!event.target.value.trim()) setAppliedVoucherCode(""); }} className="h-12 min-w-0 flex-1 rounded-md border border-black/10 px-4 uppercase" placeholder="Nhập mã nếu có" />
              <button type="button" disabled={quoteLoading || !items.length} onClick={handleApplyVoucher} className="h-12 rounded-md border border-ink px-5 text-sm font-bold disabled:opacity-50">
                {quoteLoading ? "Đang tính..." : "Áp dụng"}
              </button>
            </div>
          </label>
          {message && !hasFieldErrors && <p className="rounded-md bg-linen px-4 py-3 text-sm font-semibold">{message}</p>}
          <button disabled={loading || !items.length || quoteLoading} className="inline-flex h-14 items-center justify-center rounded-full bg-ink px-7 text-sm font-bold text-white disabled:opacity-60">
            {(loading || quoteLoading) && <Loader2 className="mr-2 animate-spin" size={18} />}
            Xác nhận đặt hàng
          </button>
        </form>
      </section>

      <aside className="h-fit border border-black/10 bg-white p-6">
        <h2 className="font-display text-3xl font-bold">Sản phẩm thanh toán</h2>
        {items.length ? (
          <>
            <div className="mt-6 space-y-5">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <img src={item.image_url} alt={item.name} className="h-24 w-20 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.name}</p>
                    <p className="mt-1 text-sm text-ink/55">{item.category_name}</p>
                    <p className="mt-2 text-xs font-semibold text-ink/50">Giá gốc</p>
                    <p className="font-bold">{formatMoney(item.price)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3 border-t border-black/10 pt-5 text-sm">
              <Row label="Giá gốc" value={formatMoney(subtotal)} />
              {(appliedVoucherCode || discountAmount > 0) && <Row label={`Giảm giá${quote?.voucher?.code || appliedVoucherCode ? ` (${quote?.voucher?.code || appliedVoucherCode})` : ""}`} value={quoteLoading ? "Đang tính..." : discountAmount > 0 ? `-${formatMoney(discountAmount)}` : formatMoney(0)} />}
              <Row label={quotedShippingFee ? "Phí vận chuyển GHN" : "Phí vận chuyển GHN (tạm tính)"} value={quoteLoading ? "Đang tính..." : formatMoney(shippingFee)} />
              <Row label="Tổng cộng" value={formatMoney(total)} strong />
            </div>
          </>
        ) : (
          <p className="mt-5 text-ink/60">Chưa chọn sản phẩm để thanh toán. <Link className="font-bold underline" to="/cart">Quay lại giỏ hàng</Link></p>
        )}
      </aside>
      {successOrder ? (
        <OrderSuccessModal order={successOrder} canViewOrder={Boolean(user)} onClose={() => setSuccessOrder(null)} />
      ) : null}
    </main>
  );
}

function OrderSuccessModal({ order, canViewOrder, onClose }) {
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
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-clay">Đặt hàng thành công</p>
        <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ink">Cảm ơn bạn đã đặt hàng</h2>
        <div className="mt-5 rounded-xl bg-linen px-5 py-4 text-left text-sm">
          <SummaryRow label="Mã đơn" value={`#${order.id}`} />
          <SummaryRow label="Mã vận đơn GHN" value={order.ghnOrderCode || "Đang cập nhật"} />
          <SummaryRow label="Tổng thanh toán" value={formatMoney(order.total)} strong />
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {canViewOrder ? (
            <Link
              to={`/orders/${order.id}`}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-ink px-6 text-sm font-bold text-white"
            >
              Xem chi tiết đơn
            </Link>
          ) : null}
          <Link
            to="/products"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border px-6 text-sm font-bold text-ink"
          >
            Tiếp tục mua sắm
          </Link>
        </div>
      </section>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 first:pt-0 last:border-b-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className={`text-right ${strong ? "text-base font-bold text-ink" : "font-semibold text-ink"}`}>{value}</span>
    </div>
  );
}

function estimateShippingFee(districtId, items = []) {
  const totalQuantity = Math.max(1, items.reduce((sum, item) => sum + Number(item.quantity || 1), 0));
  const weightFee = Math.max(0, totalQuantity - 1) * 4000;
  const distanceFee = Number(districtId || 0) % 2 === 0 ? 8000 : 12000;
  return 22000 + distanceFee + weightFee;
}
function Row({ label, value, strong }) {
  return <div className={strong ? "flex justify-between text-lg font-bold" : "flex justify-between"}><span>{label}</span><span>{value}</span></div>;
}

function CheckoutField({ label, error, ...props }) {
  return (
    <label>
      {props.required ? <RequiredLabel>{label}</RequiredLabel> : <span className="text-sm font-semibold">{label}</span>}
      <input {...props} data-field={props.name} aria-invalid={Boolean(error)} className={`mt-2 h-12 w-full rounded-md border px-4 outline-none ${error ? "border-danger" : "border-black/10"}`} />
      {error && <FieldError>{error}</FieldError>}
    </label>
  );
}

function FieldError({ children }) {
  return <span className="mt-1.5 block text-xs font-semibold text-danger">{children}</span>;
}

function RequiredLabel({ children }) {
  return <span className="text-sm font-semibold">{children} <span className="text-danger" aria-hidden="true">*</span></span>;
}

function BankRow({ label, value, strong = false }) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-border pb-2 last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right ${strong ? "text-base font-bold text-clay" : "font-semibold"}`}>{value}</dd>
    </div>
  );
}






