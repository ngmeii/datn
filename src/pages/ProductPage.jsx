import { ChevronDown, Heart, Loader2, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatMoney } from "../lib/api.js";
import { addToCart } from "../lib/cart.js";

export default function ProductPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([api(`/products?category=${category}`), api("/categories")])
      .then(([productData, categoryData]) => {
        setProducts(productData);
        setCategories(categoryData);
      })
      .finally(() => setLoading(false));
  }, [category]);

  function handleAddToCart(product) {
    addToCart(product);
    setMessage(`Đã thêm "${product.name}" vào giỏ hàng.`);
  }

  return (
    <main>
      <section className="border-b border-black/10 bg-[#f8efe7] py-16">
        <div className="site-container">
          <h1 className="font-display text-5xl font-bold">Sản phẩm ký gửi</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/65">
            Danh sách sản phẩm đã qua kiểm định, có mô tả tình trạng rõ ràng và giá bán minh bạch.
          </p>
        </div>
      </section>

      <section className="site-container py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <button
              className={!category ? "rounded-full bg-ink px-5 py-3 text-sm font-bold text-white" : "rounded-full bg-white px-5 py-3 text-sm font-bold"}
              onClick={() => setCategory("")}
            >
              Tất cả
            </button>
            {categories.map((item) => (
              <button
                key={item.id}
                className={category === item.slug ? "rounded-full bg-ink px-5 py-3 text-sm font-bold text-white" : "rounded-full bg-white px-5 py-3 text-sm font-bold"}
                onClick={() => setCategory(item.slug)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <button className="inline-flex items-center gap-3 rounded-md border border-black/10 bg-white px-5 py-3 text-sm font-semibold">
            Mới nhất <ChevronDown size={16} />
          </button>
        </div>

        {message && <p className="mt-6 rounded-md bg-linen px-4 py-3 text-sm font-semibold">{message}</p>}

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <div className="mt-10 grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article key={product.id} className="group">
                <Link to={`/products/${product.id}`} className="block">
                  <div className="relative overflow-hidden rounded-md bg-linen">
                    <img className="aspect-[0.76] w-full object-cover transition group-hover:scale-[1.04]" src={product.image_url} alt={product.name} />
                    <span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white">
                      <Heart size={18} />
                    </span>
                  </div>
                  <p className="mt-5 text-xs font-bold uppercase text-ink/45">{product.category_name}</p>
                  <h2 className="mt-1 text-lg font-semibold">{product.name}</h2>
                  <p className="mt-2 text-sm font-bold">{formatMoney(product.price)}</p>
                </Link>
                <button
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink text-sm font-bold hover:bg-ink hover:text-white"
                  onClick={() => handleAddToCart(product)}
                >
                  <ShoppingBag size={17} />
                  Thêm vào giỏ
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
