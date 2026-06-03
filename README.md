# Consignment Shop

Website quản lý bán hàng ký gửi thời trang, xây bằng React + NodeJS + MySQL.

## Phạm vi sản phẩm

Khách hàng:

- Đăng ký / đăng nhập
- Xem sản phẩm
- Tìm kiếm, lọc sản phẩm
- Xem chi tiết sản phẩm
- Đặt hàng
- Thanh toán COD / chuyển khoản

Người bán:

- Tạo yêu cầu ký gửi
- Xem trạng thái ký gửi
- Xác nhận ký gửi sau định giá

Nhân viên/Admin:

- Duyệt yêu cầu ký gửi
- Tiếp nhận, định giá sản phẩm
- Đăng bán sản phẩm
- Quản lý đơn hàng
- Giải ngân cho người bán

## Chạy dự án

1. Tạo file `.env` từ `.env.example` và điền tài khoản MySQL đúng trên máy.
2. Import database:

```bash
mysql -u root -p < server/schema.sql
```

3. Cài thư viện và chạy dev:

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:5000

## Tài khoản demo

Các tài khoản dưới đây có mật khẩu là `password` sau khi import `server/schema.sql`.

- Admin: `admin@heirloom.vn`
- Nhân viên: `staff@heirloom.vn`
- Khách hàng/người bán: `mai@example.com`
