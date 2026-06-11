import { Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, saveSession } from "../lib/api.js";
import loginImage from "../images/đăng nhập.png";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const session = await api(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      saveSession(session);
      const destination = {
        admin: "/admin",
        staff: "/staff",
        customer: "/",
      }[session.user.role] || "/";
      window.location.assign(destination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-cream text-ink lg:grid-cols-2">
      <section className="relative hidden min-h-screen overflow-hidden lg:block">
        <img src={loginImage} alt="Không gian thời trang ký gửi" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-black/45" />
        <Link to="/" className="absolute left-14 top-12 font-display text-6xl font-bold text-white">
          The Heirloom
        </Link>
        <div className="absolute bottom-14 left-14 max-w-xl text-white">
          <h1 className="font-display text-5xl font-bold italic leading-tight">Ký gửi minh bạch, mua bán an tâm.</h1>
          <p className="mt-6 text-lg leading-8 text-white/88">
            Đăng nhập để tạo yêu cầu ký gửi, đặt hàng hoặc vận hành hệ thống theo vai trò.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-[520px]">
          <Link to="/" className="mb-10 block font-display text-4xl font-bold lg:hidden">
            The Heirloom
          </Link>
          <h2 className="font-display text-5xl font-bold">{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h2>
          <p className="mt-4 text-lg text-ink/62">
            Tài khoản demo: `admin@heirloom.vn`, `staff@heirloom.vn`, `mai@example.com` cùng mật khẩu `password`.
          </p>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            {mode === "register" && (
              <label className="block">
                <span className="text-sm font-semibold">Họ tên</span>
                <input name="fullName" required className="mt-3 h-14 w-full rounded-full border border-black/10 bg-white px-6 outline-none" />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-semibold">Email</span>
              <input name="email" type="email" required defaultValue="mai@example.com" className="mt-3 h-14 w-full rounded-full border border-black/10 bg-white px-6 outline-none" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Mật khẩu</span>
              <span className="mt-3 flex h-14 items-center rounded-full border border-black/10 bg-white px-6">
                <input name="password" type="password" required defaultValue="password" className="min-w-0 flex-1 bg-transparent outline-none" />
                <Eye size={20} className="text-ink/50" />
              </span>
            </label>
            {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
            <button disabled={loading} className="inline-flex h-14 w-full items-center justify-center rounded-full bg-ink text-base font-bold text-white disabled:opacity-60">
              {loading && <Loader2 className="mr-2 animate-spin" size={18} />}
              {mode === "login" ? "Đăng nhập" : "Đăng ký"}
            </button>
          </form>

          <button className="mt-8 text-sm font-semibold hover:underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
          </button>
        </div>
      </section>
    </main>
  );
}
