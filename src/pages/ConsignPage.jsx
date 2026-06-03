import { Loader2, PackagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatMoney, getCurrentUser } from "../lib/api.js";

export default function ConsignPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [categories, setCategories] = useState([]);
  const [estimate, setEstimate] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/categories").then(setCategories);
  }, []);

  function calculateEstimate(event) {
    const form = new FormData(event.currentTarget.form);
    const base = Number(form.get("expectedPrice") || 0);
    const condition = form.get("conditionLevel");
    const multiplier = condition === "new" ? 0.85 : condition === "good" ? 0.65 : 0.45;
    setEstimate(Math.round(base * multiplier));
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
    const payload = {
      productName: form.get("productName"),
      categoryId: Number(form.get("categoryId")),
      brand: form.get("brand"),
      conditionNote: form.get("conditionNote"),
      expectedPrice: Number(form.get("expectedPrice")),
      sendMethod: form.get("sendMethod"),
      imageUrl: form.get("imageUrl"),
    };

    try {
      const result = await api("/consignments", { method: "POST", body: JSON.stringify(payload) });
      setStatus(result.message);
      formElement.reset();
      setEstimate(0);
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
          <p className="text-sm font-bold uppercase text-clay">Quy trình ký gửi</p>
          <h1 className="mt-3 font-display text-5xl font-bold">Tạo yêu cầu ký gửi sản phẩm</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/65">
            Người bán gửi thông tin sản phẩm, hệ thống ước lượng giá và nhân viên sẽ kiểm duyệt trước khi tiếp nhận.
          </p>
        </div>
      </section>

      <section className="site-container grid gap-10 py-12 lg:grid-cols-[1fr_0.7fr]">
        <form className="grid gap-5 bg-white p-6 shadow-soft" onSubmit={handleSubmit}>
          <Field label="Tên sản phẩm" name="productName" required />
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className="text-sm font-semibold">Danh mục</span>
              <select name="categoryId" required className="mt-2 h-12 w-full rounded-md border border-black/10 px-4">
                <option value="">Chọn danh mục</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <Field label="Thương hiệu" name="brand" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Giá mua/giá mong muốn" name="expectedPrice" type="number" required onChange={calculateEstimate} />
            <label>
              <span className="text-sm font-semibold">Tình trạng</span>
              <select name="conditionLevel" onChange={calculateEstimate} className="mt-2 h-12 w-full rounded-md border border-black/10 px-4">
                <option value="new">Gần như mới</option>
                <option value="good">Còn tốt</option>
                <option value="used">Đã sử dụng nhiều</option>
              </select>
            </label>
          </div>
          <label>
            <span className="text-sm font-semibold">Mô tả tình trạng</span>
            <textarea name="conditionNote" required rows="4" className="mt-2 w-full rounded-md border border-black/10 px-4 py-3" placeholder="Ví dụ: còn 90%, có xước nhẹ ở khóa..." />
          </label>
          <Field label="Link ảnh sản phẩm" name="imageUrl" placeholder="https://..." />
          <label>
            <span className="text-sm font-semibold">Phương thức gửi hàng</span>
            <select name="sendMethod" required className="mt-2 h-12 w-full rounded-md border border-black/10 px-4">
              <option value="drop_off">Tự mang đến cửa hàng</option>
              <option value="pickup">Cửa hàng lấy hàng tại nhà</option>
              <option value="shipping">Tự gửi qua đơn vị vận chuyển</option>
            </select>
          </label>
          {status && <p className="rounded-md bg-linen px-4 py-3 text-sm font-semibold">{status}</p>}
          <button disabled={loading} className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-sm font-bold text-white">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <PackagePlus size={18} />}
            Gửi yêu cầu ký gửi
          </button>
        </form>

        <aside className="h-fit border border-black/10 bg-white p-6">
          <h2 className="font-display text-3xl font-bold">Ước lượng giá</h2>
          <p className="mt-4 text-4xl font-bold text-moss">{formatMoney(estimate)}</p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-ink/65">
            <p>Phí ký gửi mặc định: 20% giá bán.</p>
            <p>Thời hạn ký gửi: 45 ngày. Khi hết hạn, hệ thống gửi thông báo để người bán chọn nhận lại hoặc tiếp tục xử lý.</p>
            <p>Điều kiện lấy hàng miễn phí: tối thiểu 20 sản phẩm, dưới 15kg, kiện hàng không quá 50x40x40cm.</p>
          </div>
          {!user && (
            <Link to="/login" className="mt-6 inline-block rounded-full border border-ink px-5 py-3 text-sm font-bold">
              Đăng nhập để gửi yêu cầu
            </Link>
          )}
        </aside>
      </section>
    </main>
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
