const TOKEN_KEY = "consignment_token";
const USER_KEY = "consignment_user";

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession({ token, user }) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api(path, options = {}) {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        response.status === 404
          ? "API chưa có đường dẫn này. Hãy khởi động lại máy chủ backend."
          : "Máy chủ trả về dữ liệu không hợp lệ.",
      );
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || "Không thể kết nối máy chủ.");
  }

  return data;
}

export function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
