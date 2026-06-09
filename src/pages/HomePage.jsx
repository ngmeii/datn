import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  Gift,
  Heart,
  Leaf,
  RefreshCcw,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatMoney } from "../lib/api.js";

const categories = [
  ["Váy", "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=480&q=90", "1"],
  ["Áo", "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=480&q=90", "2"],
  ["Túi", "https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=480&q=90", "3"],
  ["Giày", "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=480&q=90", "4"],
  ["Phụ kiện", "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=480&q=90", "5"],
  ["Đồ lifestyle", "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=480&q=90", ""],
];

const values = [
  {
    icon: ShieldCheck,
    title: "Kiểm duyệt nghiêm ngặt",
    text: "Mỗi sản phẩm đều được kiểm tra kỹ lưỡng về chất lượng và độ chính hãng.",
  },
  {
    icon: CircleDollarSign,
    title: "Thanh toán minh bạch",
    text: "Tỷ lệ chia sẻ doanh thu rõ ràng, quy trình đối soát nhanh chóng và chính xác.",
  },
  {
    icon: RefreshCcw,
    title: "Phát triển bền vững",
    text: "Góp phần giảm thiểu lãng phí thời trang bằng cách kéo dài vòng đời sản phẩm.",
  },
  {
    icon: Heart,
    title: "Hỗ trợ tận tâm",
    text: "Đội ngũ chuyên viên tư vấn luôn sẵn sàng giải đáp mọi thắc mắc của bạn.",
  },
];

export default function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    api("/products")
      .then((data) => {
        if (mounted) {
          setFeaturedProducts(data.slice(0, 5));
        }
      })
      .catch(() => {
        if (mounted) {
          setFeaturedProducts([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setFeaturedLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="bg-cream text-ink">
      <section className="site-container pt-7">
        <div className="relative grid min-h-[540px] overflow-hidden rounded-[22px] border border-black/10 bg-[#f8efe7] shadow-[0_22px_70px_rgba(57,38,25,0.12)] lg:grid-cols-[0.58fr_0.42fr]">
          <div className="relative z-10 flex flex-col justify-center px-8 py-12 md:px-12 lg:px-16">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-linen px-5 py-2 text-[12px] font-bold uppercase tracking-[0.2em] text-clay">
              <BadgeCheck size={15} /> Top rated consignment
            </span>

            <h1 className="mt-9 max-w-[680px] font-display text-[54px] font-bold leading-[0.96] tracking-[-0.045em] md:text-[76px]">
              Ký gửi thời trang -
              <span className="block italic font-semibold text-muted">Gói trọn yêu thương</span>
            </h1>

            <p className="mt-7 max-w-[560px] text-[17px] leading-8 text-ink/65">
              Nơi những món đồ cũ tìm thấy chủ mới. Dịch vụ ký gửi tận tâm, thân thiện và minh bạch, giúp bạn làm mới tủ đồ một cách bền vững.
            </p>

            <div className="mt-8 flex flex-wrap gap-5">
              <Link to="/consign" className="inline-flex h-[54px] items-center gap-3 rounded-full bg-ink px-8 text-[15px] font-bold text-white shadow-sm">
                Bắt đầu ký gửi <ArrowRight size={18} />
              </Link>
              <Link to="/products" className="inline-flex h-[54px] items-center rounded-full border-2 border-ink bg-white/25 px-8 text-[15px] font-bold">
                Khám phá cửa hàng
              </Link>
            </div>

            <div className="mt-11 flex flex-wrap gap-9">
              <MiniBenefit icon={ShieldCheck} title="Minh bạch" text="Quy trình rõ ràng" />
              <MiniBenefit icon={Tag} title="Định giá hợp lý" text="Tối ưu giá trị" />
              <MiniBenefit icon={Leaf} title="Thời trang bền vững" text="Sống xanh mỗi ngày" />
            </div>
          </div>

          <img
            src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=520&q=90"
            alt="Cây xanh trang trí"
            className="pointer-events-none absolute bottom-0 left-[44%] z-20 hidden h-[72%] max-h-[470px] -translate-x-1/2 object-contain mix-blend-multiply lg:block"
          />

          <div className="relative min-h-[460px] overflow-hidden lg:min-h-[540px]">
            <img
              src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1100&q=90"
              alt="Tủ đồ thời trang ký gửi"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#f8efe7] to-transparent" />
            <div className="absolute bottom-9 right-9 rounded-xl bg-white/92 px-9 py-6 shadow-[0_18px_45px_rgba(37,25,18,0.2)] backdrop-blur">
              <p className="font-display text-[44px] font-bold leading-none tracking-[-0.04em]">5.000+</p>
              <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.12em] text-ink/55">Món đồ được chọn</p>
            </div>
          </div>

          <div className="absolute bottom-7 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-4 lg:flex">
            <span className="h-2.5 w-2.5 rounded-full bg-ink" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink/20" />
          </div>
        </div>
      </section>

      <section id="collections" className="site-container py-9">
        <SectionTitle
          centered
          title="Danh mục mua sắm"
          subtitle="Những mảnh ghép hoàn hảo cho tủ đồ của bạn đang chờ đón."
        />

        <div className="mt-8 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map(([name, image, categoryId]) => (
            <Link key={name} to={categoryId ? `/products?category=${categoryId}` : "/products"} className="group text-center">
              <div className="mx-auto h-[170px] w-[170px] overflow-hidden rounded-full border border-black/10 bg-white p-2 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-soft max-xl:h-[145px] max-xl:w-[145px] max-md:h-[128px] max-md:w-[128px]">
                <img src={image} alt={name} className="h-full w-full rounded-full object-cover" />
              </div>
              <p className="mt-4 text-[16px] font-semibold">{name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="featured" className="site-container pb-9">
        <div className="rounded-[24px] bg-white/45 p-8 shadow-[0_16px_55px_rgba(75,50,33,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <SectionTitle title="Sản phẩm nổi bật" subtitle="Lựa chọn tinh tuyển dành riêng cho bạn." />
            <Link to="/products" className="mt-3 inline-flex items-center gap-2 text-sm font-bold">
              Xem tất cả <ArrowRight size={16} />
            </Link>
          </div>

          {featuredLoading ? (
            <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="aspect-[0.82] rounded-[10px] bg-linen" />
                  <div className="mt-4 h-3 w-24 rounded bg-linen" />
                  <div className="mt-3 h-5 w-40 rounded bg-linen" />
                  <div className="mt-3 h-4 w-20 rounded bg-linen" />
                </div>
              ))}
            </div>
          ) : featuredProducts.length ? (
            <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {featuredProducts.map((product) => (
                <article key={product.id} className="group">
                  <Link to={`/products/${product.id}`}>
                    <div className="relative overflow-hidden rounded-[10px] bg-linen">
                      <img src={product.image_url} alt={product.name} className="aspect-[0.82] w-full object-cover transition duration-500 group-hover:scale-105" />
                    </div>
                    <div className="pt-4">
                      <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-ink/45">{product.category_name || "Sản phẩm ký gửi"}</p>
                      <h3 className="mt-1 text-[18px] font-semibold">{product.name}</h3>
                      <p className="mt-1 text-[16px] font-bold">{formatMoney(product.price)}</p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-black/10 bg-white/60 p-8 text-center text-sm font-semibold text-ink/60">
              Chưa có sản phẩm đang đăng bán để hiển thị.
            </div>
          )}
        </div>
      </section>

      <section className="site-container pb-7">
        <div className="grid overflow-hidden rounded-[24px] bg-white/45 shadow-[0_16px_55px_rgba(75,50,33,0.08)] lg:grid-cols-[1fr_285px]">
          <div className="px-8 py-8">
            <SectionTitle title="Minh bạch là giá trị cốt lõi" />
            <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {values.map((value) => (
                <div key={value.title} className="flex gap-4">
                  <value.icon className="mt-1 shrink-0" size={22} strokeWidth={1.8} />
                  <div>
                    <h3 className="font-bold">{value.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-ink/60">{value.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden p-4 lg:block">
            <img
              src="https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=700&q=90"
              alt="Tư vấn ký gửi thời trang"
              className="h-full min-h-[190px] w-full rounded-[18px] object-cover"
            />
            <div className="absolute bottom-4 left-0 h-28 w-28 rounded-tr-[70px] bg-cream" />
          </div>
        </div>
      </section>

      <section className="site-container pb-7">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-[16px] border border-black/10 bg-white/55 px-7 py-5">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-linen">
              <Gift size={23} strokeWidth={1.8} />
            </span>
            <div>
              <h3 className="font-bold">Nhận ngay 5% ưu đãi cho đơn hàng đầu tiên</h3>
              <p className="mt-1 text-sm text-ink/55">Đăng ký email để không bỏ lỡ các chương trình khuyến mãi và sản phẩm mới nhất từ The Heirloom.</p>
            </div>
          </div>

          <div className="flex min-w-[290px] flex-1 overflow-hidden rounded-md border border-black/10 bg-white md:max-w-[460px]">
            <input className="min-w-0 flex-1 bg-transparent px-5 outline-none" placeholder="Email của bạn" />
            <button className="bg-ink px-9 text-sm font-bold text-white">Đăng ký</button>
          </div>
        </div>
      </section>

      <footer id="footer" className="site-container border-t border-black/10 pb-8 pt-7">
        <div className="grid gap-9 text-sm md:grid-cols-[1.25fr_0.8fr_0.8fr_0.95fr_1fr]">
          <div>
            <p className="font-display text-[27px] font-bold leading-none">The Heirloom</p>
            <p className="mt-4 max-w-sm leading-6 text-ink/55">
              Luxe Consignment - Nơi lưu giữ những giá trị vượt thời gian qua từng món đồ thời trang tuyển chọn.
            </p>
            <div className="mt-5 flex gap-3">
              {["f", "ig", "♪", "✉"].map((item) => (
                <span key={item} className="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white text-xs font-bold">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <FooterCol title="Quick Links" items={["About Us", "How It Works", "Consign With Us", "Blog"]} />
          <FooterCol title="Policies" items={["Privacy Policy", "Terms of Service", "Shipping Info", "Return Policy"]} />
          <FooterCol title="Customer Care" items={["Hướng dẫn mua hàng", "Hướng dẫn ký gửi", "Câu hỏi thường gặp", "Liên hệ"]} />

          <div>
            <p className="font-bold uppercase tracking-[0.16em]">Hotline</p>
            <p className="mt-4 text-ink/60">0123 456 789</p>
            <p className="mt-2 text-ink/60">(8:00 - 22:00 mỗi ngày)</p>
            <p className="mt-2 text-ink/60">Email: support@theheirloom.com</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-5 text-xs font-semibold uppercase text-ink/45">
          <p>© 2024 The Heirloom Consignment. A modern legacy.</p>
          <p>Visa · Mastercard · MoMo · ZaloPay</p>
        </div>
      </footer>
    </main>
  );
}

function SectionTitle({ title, subtitle, centered }) {
  return (
    <div className={centered ? "text-center" : ""}>
      <h2 className="font-display text-[40px] font-bold leading-tight tracking-[-0.035em] md:text-[46px]">{title}</h2>
      {subtitle && <p className="mt-2 text-[15px] leading-6 text-ink/55">{subtitle}</p>}
    </div>
  );
}

function MiniBenefit({ icon: Icon, title, text }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-1 shrink-0" size={23} strokeWidth={1.7} />
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-[13px] text-ink/55">{text}</p>
      </div>
    </div>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <p className="font-bold uppercase tracking-[0.16em]">{title}</p>
      {items.map((item) => (
        <p key={item} className="mt-3 text-ink/60">{item}</p>
      ))}
    </div>
  );
}
