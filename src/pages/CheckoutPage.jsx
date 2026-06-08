import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, formatMoney, getCurrentUser } from "../lib/api.js";
import { clearCheckoutItems, clearCart, getCheckoutItems, removeFromCart } from "../lib/cart.js";

export default function CheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const productId = params.get("productId");
  const user = getCurrentUser();
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    if (productId) {
      api(`/products/${productId}`).then((product) => setItems([{ ...product, quantity: 1 }]));
    } else {
      setItems(getCheckoutItems());
    }
  }, [productId]);

  useEffect(() => {
    setQuote(null);
  }, [items, voucherCode]);

  async function handleApplyVoucher() {
    const code = voucherCode.trim();
    if (!code) {
      setQuote(null);
      setMessage("Nhập mã voucher trước khi áp dụng.");
      return;
    }
    if (!items.length) {
      setMessage("Bạn chưa chọn sản phẩm để áp dụng voucher.");
      return;
    }

    setQuoteLoading(true);
    setMessage("");
    try {
      const result = await api("/orders/quote", {
        method: "POST",
        body: JSON.stringify({
          items: items.map((item) => ({ productId: Number(item.id), quantity: Number(item.quantity || 1) })),
          voucherCode: code,
        }),
      });
      setQuote(result);
      setMessage(`Đã áp dụng voucher ${result.voucher.code}.`);
    } catch (error) {
      setQuote(null);
      setMessage(error.message);
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }
    if (!items.length) {
      setMessage("Bạn chưa chọn sản phẩm để thanh toán.");
      return;
    }

    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const order = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: items.map((item) => ({ productId: Number(item.id), quantity: Number(item.quantity || 1) })),
          shippingAddress: form.get("shippingAddress"),
          paymentMethod: form.get("paymentMethod"),
          voucherCode,
        }),
      });

      if (!productId) {
        items.forEach((item) => removeFromCart(item.id));
        clearCheckoutItems();
      } else {
        clearCart();
      }

      setItems([]);
      setMessage(`Đã tạo đơn hàng #${order.id}. Tổng thanh toán: ${formatMoney(order.total)}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity || 1), 0);
  const discountAmount = Number(quote?.discountAmount || 0);
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const shippingFee = quote?.shippingFee ?? (subtotal >= 400000 || subtotal === 0 ? 0 : 30000);
  const total = quote?.total ?? (discountedSubtotal + shippingFee);

  return (
    <main className="site-container grid gap-10 py-12 lg:grid-cols-[1fr_0.65fr]">
      <section>
        <h1 className="font-display text-5xl font-bold">Thanh toán đơn hàng</h1>
        <form className="mt-8 grid gap-5 bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
          <label>
            <span className="text-sm font-semibold">Địa chỉ giao hàng</span>
            <textarea name="shippingAddress" required rows="4" className="mt-2 w-full rounded-md border border-black/10 px-4 py-3" defaultValue="Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội" />
          </label>
          <label>
            <span className="text-sm font-semibold">Phương thức thanh toán</span>
            <select name="paymentMethod" className="mt-2 h-12 w-full rounded-md border border-black/10 px-4">
              <option value="cod">Thanh toán khi nhận hàng (COD)</option>
              <option value="bank_transfer">Chuyển khoản ngân hàng</option>
            </select>
          </label>
          <label>
            <span className="text-sm font-semibold">Mã voucher</span>
            <div className="mt-2 flex gap-3">
              <input
                name="voucherCode"
                value={voucherCode}
                onChange={(event) => setVoucherCode(event.target.value)}
                className="h-12 min-w-0 flex-1 rounded-md border border-black/10 px-4"
                placeholder="Nhập mã nếu có"
              />
              <button
                type="button"
                disabled={quoteLoading || !items.length}
                onClick={handleApplyVoucher}
                className="h-12 rounded-md border border-ink px-5 text-sm font-bold disabled:opacity-50"
              >
                {quoteLoading ? "Đang áp dụng..." : "Áp dụng"}
              </button>
            </div>
          </label>
          {message && <p className="rounded-md bg-linen px-4 py-3 text-sm font-semibold">{message}</p>}
          <button disabled={loading || !items.length} className="inline-flex h-14 items-center justify-center rounded-full bg-ink px-7 text-sm font-bold text-white disabled:opacity-60">
            {loading && <Loader2 className="mr-2 animate-spin" size={18} />}
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
              {discountAmount > 0 && (
                <>
                  <Row label={`Giảm giá${quote?.voucher?.code ? ` (${quote.voucher.code})` : ""}`} value={`-${formatMoney(discountAmount)}`} />
                  <Row label="Giá bán sau giảm" value={formatMoney(discountedSubtotal)} />
                </>
              )}
              <Row label="Phí vận chuyển" value={formatMoney(shippingFee)} />
              <Row label="Tổng cộng" value={formatMoney(total)} strong />
            </div>
          </>
        ) : (
          <p className="mt-5 text-ink/60">
            Chưa chọn sản phẩm để thanh toán. <Link className="font-bold underline" to="/cart">Quay lại giỏ hàng</Link>
          </p>
        )}
      </aside>
    </main>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className={strong ? "flex justify-between text-lg font-bold" : "flex justify-between"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
