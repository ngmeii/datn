import { ArrowLeft, BadgeCheck, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatMoney } from "../lib/api.js";
import { addToCart } from "../lib/cart.js";

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api(`/products/${id}`).then(setProduct);
  }, [id]);

  if (!product) {
    return <main className="site-container py-20">Đang tải sản phẩm...</main>;
  }

  return (
    <main className="site-container py-12">
      <Link to="/products" className="inline-flex items-center gap-2 text-sm font-bold text-ink/65">
        <ArrowLeft size={17} /> Quay lại sản phẩm
      </Link>
      <section className="mt-8 grid gap-10 lg:grid-cols-[0.9fr_1fr]">
        <img src={product.image_url} alt={product.name} className="aspect-[0.82] w-full rounded-md object-cover" />
        <div>
          <p className="text-sm font-bold uppercase text-clay">{product.category_name}</p>
          <h1 className="mt-3 font-display text-5xl font-bold">{product.name}</h1>
          <p className="mt-4 text-3xl font-bold">{formatMoney(product.price)}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Info label="Thương hiệu" value={product.brand || "Chưa cập nhật"} />
            <Info label="Kích thước" value={product.size || "Chưa cập nhật"} />
            <Info label="Màu sắc" value={product.color || "Chưa cập nhật"} />
            <Info label="Trạng thái" value="Sẵn sàng đặt hàng" />
          </div>
          <div className="mt-8 border-y border-black/10 py-6">
            <h2 className="font-bold">Tình trạng sản phẩm</h2>
            <p className="mt-3 leading-8 text-ink/65">{product.condition_note}</p>
            <p className="mt-3 leading-8 text-ink/65">{product.description}</p>
          </div>
          {message && <p className="mt-5 rounded-md bg-linen px-4 py-3 text-sm font-semibold">{message}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="inline-flex h-14 items-center gap-3 rounded-full border border-ink px-8 text-sm font-bold hover:bg-white"
              onClick={() => {
                addToCart(product);
                setMessage("Đã thêm sản phẩm vào giỏ hàng.");
              }}
            >
              <ShoppingBag size={18} /> Thêm vào giỏ
            </button>
            <button
              className="inline-flex h-14 items-center gap-3 rounded-full bg-ink px-8 text-sm font-bold text-white"
              onClick={() => navigate(`/checkout?productId=${product.id}`)}
            >
              Mua ngay
            </button>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-moss">
            <BadgeCheck size={17} /> Sản phẩm đã qua kiểm định trước khi đăng bán
          </p>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div className="border border-black/10 bg-white p-4">
      <p className="text-xs font-bold uppercase text-ink/45">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
