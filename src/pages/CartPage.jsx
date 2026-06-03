import { ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatMoney } from "../lib/api.js";
import { getCart, removeFromCart, saveCheckoutItems } from "../lib/cart.js";

export default function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    const cart = getCart();
    setItems(cart);
    setSelectedIds(cart.map((item) => Number(item.id)));
  }, []);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(Number(item.id))),
    [items, selectedIds],
  );
  const subtotal = selectedItems.reduce((sum, item) => sum + Number(item.price), 0);

  function toggleItem(productId) {
    const id = Number(productId);
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id],
    );
  }

  function handleRemove(productId) {
    const nextCart = removeFromCart(productId);
    setItems(nextCart);
    setSelectedIds((current) => current.filter((id) => id !== Number(productId)));
  }

  function handleCheckout() {
    if (!selectedItems.length) return;
    saveCheckoutItems(selectedItems);
    navigate("/checkout");
  }

  return (
    <main className="site-container py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-5xl font-bold">Giỏ hàng</h1>
          <p className="mt-4 text-ink/60">Chọn sản phẩm muốn mua rồi bấm mua hàng để chuyển sang thanh toán.</p>
        </div>
        <Link to="/products" className="rounded-full border border-ink px-6 py-3 text-sm font-bold">
          Tiếp tục mua sắm
        </Link>
      </div>

      {items.length ? (
        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_0.42fr]">
          <div className="bg-white p-6 shadow-soft">
            <div className="space-y-5">
              {items.map((item) => (
                <article key={item.id} className="flex gap-4 border-b border-black/10 pb-5 last:border-b-0 last:pb-0">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(Number(item.id))}
                    onChange={() => toggleItem(item.id)}
                    className="mt-10 h-5 w-5 accent-ink"
                    aria-label={`Chọn ${item.name}`}
                  />
                  <img src={item.image_url} alt={item.name} className="h-28 w-24 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.name}</p>
                    <p className="mt-1 text-sm text-ink/55">{item.category_name}</p>
                    <p className="mt-3 font-bold">{formatMoney(item.price)}</p>
                  </div>
                  <button className="grid h-9 w-9 place-items-center rounded-full border border-black/10" onClick={() => handleRemove(item.id)}>
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          </div>

          <aside className="h-fit border border-black/10 bg-white p-6">
            <h2 className="font-display text-3xl font-bold">Tạm tính</h2>
            <div className="mt-6 space-y-3 text-sm">
              <Row label="Đã chọn" value={`${selectedItems.length} sản phẩm`} />
              <Row label="Tổng tiền hàng" value={formatMoney(subtotal)} strong />
            </div>
            <button
              disabled={!selectedItems.length}
              className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-7 text-sm font-bold text-white disabled:opacity-50"
              onClick={handleCheckout}
            >
              <ShoppingBag size={18} />
              Mua hàng
            </button>
          </aside>
        </section>
      ) : (
        <div className="mt-10 bg-white p-10 text-center shadow-soft">
          <p className="text-ink/60">Giỏ hàng chưa có sản phẩm.</p>
          <Link to="/products" className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">
            Xem sản phẩm
          </Link>
        </div>
      )}
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
