import { ArrowRight, BadgeCheck, BarChart3, CreditCard, PackageCheck, Recycle, ShieldCheck, Truck } from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  "Gửi thông tin và hình ảnh sản phẩm",
  "Nhân viên kiểm duyệt, tiếp nhận và định giá",
  "Người bán xác nhận ký gửi",
  "Sản phẩm được đăng bán và giải ngân sau khi hoàn tất",
];

const features = [
  { icon: PackageCheck, title: "Theo dõi ký gửi", text: "Người bán xem trạng thái: chờ duyệt, kiểm định, đã đăng bán, đã bán." },
  { icon: CreditCard, title: "Hoa hồng rõ ràng", text: "Tự động tính phí ký gửi 20% và số tiền giải ngân cho người bán." },
  { icon: Truck, title: "Hỗ trợ vận chuyển", text: "Ghi nhận hình thức gửi hàng, phí giao hàng và mã vận đơn." },
  { icon: BarChart3, title: "Quản trị vận hành", text: "Nhân viên quản lý sản phẩm, đơn hàng, thanh toán và báo cáo." },
];

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-[#f8efe7]">
        <div className="site-container grid min-h-[620px] items-center gap-12 py-14 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase text-ink/60">
              <Recycle size={15} />
              Nền tảng bán hàng ký gửi thời trang
            </div>
            <h1 className="font-display text-5xl font-bold leading-tight md:text-6xl">
              Quản lý ký gửi minh bạch từ lúc nhận hàng đến giải ngân
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/65">
              Website hỗ trợ người bán tạo yêu cầu ký gửi, nhân viên kiểm định sản phẩm, người mua đặt hàng và hệ thống tự động tính hoa hồng theo quy trình trong đồ án.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link to="/consign" className="inline-flex h-13 items-center gap-2 rounded-full bg-ink px-7 py-4 text-sm font-bold text-white">
                Tạo yêu cầu ký gửi <ArrowRight size={18} />
              </Link>
              <Link to="/products" className="inline-flex h-13 items-center rounded-full border border-ink px-7 py-4 text-sm font-bold">
                Xem sản phẩm
              </Link>
            </div>
          </div>
          <div className="relative">
            <img
              className="aspect-[0.9] w-full rounded-md object-cover shadow-soft"
              src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1100&q=85"
              alt="Cửa hàng thời trang ký gửi"
            />
            <div className="absolute -bottom-6 left-8 right-8 grid grid-cols-3 gap-3 bg-white p-5 shadow-soft">
              <Stat label="Hoa hồng" value="20%" />
              <Stat label="Ký gửi" value="45 ngày" />
              <Stat label="Trả hàng" value="3 ngày" />
            </div>
          </div>
        </div>
      </section>

      <section className="site-container py-20">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-bold uppercase text-clay">Quy trình nghiệp vụ</p>
            <h2 className="mt-3 font-display text-4xl font-bold">Luồng ký gửi cốt lõi</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map((step, index) => (
              <div key={step} className="border border-black/10 bg-white p-6">
                <span className="text-sm font-bold text-clay">Bước {index + 1}</span>
                <p className="mt-3 text-lg font-semibold">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="site-container grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="border border-black/10 p-6">
              <feature.icon className="text-moss" size={26} />
              <h3 className="mt-5 text-lg font-bold">{feature.title}</h3>
              <p className="mt-3 leading-7 text-ink/62">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-container py-16">
        <div className="flex flex-wrap items-center justify-between gap-5 border-y border-black/10 py-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-moss" />
            <span className="font-semibold">Bảo mật thông tin người dùng và giao dịch</span>
          </div>
          <div className="flex items-center gap-3">
            <BadgeCheck className="text-moss" />
            <span className="font-semibold">Kiểm định sản phẩm trước khi đăng bán</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase text-ink/50">{label}</p>
    </div>
  );
}
