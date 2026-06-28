const TOKEN_KEY = "consignment_token";
const USER_KEY = "consignment_user";
const VALIDATION_FIELD_LABELS = {
  productName: "Tên sản phẩm",
  categoryId: "Danh mục",
  brand: "Thương hiệu",
  conditionLevel: "Tình trạng",
  conditionNote: "Mô tả tình trạng",
  expectedPrice: "Giá mua/giá mong muốn",
  sendMethod: "Phương thức gửi hàng",
  imageUrl: "Ảnh sản phẩm",
  senderName: "Họ và tên",
  senderPhone: "Số điện thoại",
  senderProvince: "Tỉnh/Thành phố",
  senderProvinceCode: "Tỉnh/Thành phố",
  senderDistrict: "Quận/Huyện",
  senderDistrictId: "Quận/Huyện",
  senderWard: "Phường/Xã",
  senderWardCode: "Phường/Xã",
  senderStreet: "Địa chỉ chi tiết",
  customerName: "Họ và tên",
  customerEmail: "Email",
  customerPhone: "Số điện thoại",
};

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
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
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
    throw new Error(formatApiError(data) || "Không thể kết nối máy chủ.");
  }

  return data;
}

function formatApiError(data) {
  if (Array.isArray(data?.issues) && data.issues.length) {
    return data.issues.map(formatValidationIssue).join(" ");
  }

  return data?.message || "";
}

function formatValidationIssue(issue) {
  const path = Array.isArray(issue?.path) ? issue.path.filter(Boolean).join(".") : "";
  const segments = path.split(".");
  const isItemField = segments[0] === "items" && segments.length >= 3;
  const fieldKey = isItemField ? segments[2] : segments[0] || "";
  const itemPrefix = isItemField ? `Sản phẩm ${Number(segments[1]) + 1} - ` : "";
  const label = VALIDATION_FIELD_LABELS[path] || VALIDATION_FIELD_LABELS[fieldKey] || path;
  const message = issue?.message || "không hợp lệ.";
  return label ? `${itemPrefix}${label}: ${message}` : message;
}

export async function uploadImage(file) {
  if (!file) return "";
  const form = new FormData();
  form.append("image", file);
  const result = await api("/uploads/images", { method: "POST", body: form });
  return result.url;
}

export function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}
