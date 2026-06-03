CREATE DATABASE IF NOT EXISTS consignment_shop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE consignment_shop;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  role ENUM('customer', 'staff', 'admin') NOT NULL DEFAULT 'customer',
  status ENUM('active', 'locked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  consignment_request_id BIGINT UNSIGNED,
  seller_id BIGINT UNSIGNED,
  category_id BIGINT UNSIGNED,
  name VARCHAR(180) NOT NULL,
  brand VARCHAR(120),
  description TEXT,
  condition_note VARCHAR(255),
  size VARCHAR(40),
  color VARCHAR(60),
  price DECIMAL(12, 2) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
  image_url VARCHAR(500),
  status ENUM('draft', 'available', 'reserved', 'sold', 'expired', 'returned') NOT NULL DEFAULT 'available',
  listed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS consignment_requests (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  seller_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  product_name VARCHAR(180) NOT NULL,
  brand VARCHAR(120),
  condition_note VARCHAR(255) NOT NULL,
  expected_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  final_price DECIMAL(12, 2),
  send_method ENUM('drop_off', 'pickup', 'shipping') NOT NULL,
  image_url VARCHAR(500),
  status ENUM(
    'pending_review',
    'approved',
    'rejected',
    'received',
    'inspecting',
    'priced',
    'seller_confirmed',
    'listed',
    'sold',
    'expired',
    'returned'
  ) NOT NULL DEFAULT 'pending_review',
  staff_note VARCHAR(500),
  expires_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_consignments_seller FOREIGN KEY (seller_id) REFERENCES users(id),
  CONSTRAINT fk_consignments_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS vouchers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL UNIQUE,
  discount_type ENUM('fixed', 'percent') NOT NULL,
  discount_value DECIMAL(12, 2) NOT NULL,
  min_order_value DECIMAL(12, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  buyer_id BIGINT UNSIGNED NOT NULL,
  status ENUM(
    'pending_payment',
    'pending_confirmation',
    'paid',
    'confirmed',
    'shipping',
    'completed',
    'cancelled',
    'return_requested',
    'refunded'
  ) NOT NULL DEFAULT 'pending_confirmation',
  payment_method ENUM('cod', 'bank_transfer', 'online') NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL,
  shipping_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL,
  shipping_address VARCHAR(500) NOT NULL,
  tracking_code VARCHAR(80),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payouts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  gross_amount DECIMAL(12, 2) NOT NULL,
  commission_amount DECIMAL(12, 2) NOT NULL,
  net_amount DECIMAL(12, 2) NOT NULL,
  status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
  paid_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payouts_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_payouts_seller FOREIGN KEY (seller_id) REFERENCES users(id)
);

INSERT IGNORE INTO categories (id, name, slug) VALUES
  (1, 'Váy', 'vay'),
  (2, 'Áo', 'ao'),
  (3, 'Túi xách', 'tui-xach'),
  (4, 'Giày', 'giay'),
  (5, 'Phụ kiện', 'phu-kien');

INSERT IGNORE INTO users (id, full_name, email, password_hash, phone, role) VALUES
  (1, 'Admin hệ thống', 'admin@heirloom.vn', '$2b$10$CBPwCy1g0bHQ4YSGgR6.v.3WnEC8.wQeEDf7HWh.B8Y6B.FpFWFpK', '0900000000', 'admin'),
  (2, 'Nhân viên cửa hàng', 'staff@heirloom.vn', '$2b$10$CBPwCy1g0bHQ4YSGgR6.v.3WnEC8.wQeEDf7HWh.B8Y6B.FpFWFpK', '0911111111', 'staff'),
  (3, 'Nguyễn Ngọc Mai', 'mai@example.com', '$2b$10$CBPwCy1g0bHQ4YSGgR6.v.3WnEC8.wQeEDf7HWh.B8Y6B.FpFWFpK', '0922222222', 'customer');

INSERT IGNORE INTO products
  (id, seller_id, category_id, name, brand, description, condition_note, size, color, price, image_url, listed_at)
VALUES
  (1, 3, 1, 'Váy lụa hoa nhí', 'Mango', 'Váy dáng midi phù hợp đi làm và dạo phố.', 'Đã qua sử dụng, còn khoảng 90%.', 'M', 'Kem', 450000, 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=85', NOW()),
  (2, 3, 2, 'Blazer pastel mint', 'Zara', 'Blazer form đứng, chất vải nhẹ.', 'Ít sử dụng, không lỗi rõ rệt.', 'S', 'Xanh mint', 680000, 'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=900&q=85', NOW()),
  (3, 3, 3, 'Túi vintage caramel', 'Charles & Keith', 'Túi đeo vai màu caramel, khóa kim loại.', 'Có vết xước nhẹ ở cạnh túi.', 'One size', 'Nâu', 1250000, 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=85', NOW()),
  (4, 3, 4, 'Sneaker nude minimal', 'Converse', 'Giày sneaker tông nude dễ phối đồ.', 'Đế còn tốt, đã vệ sinh.', '38', 'Nude', 520000, 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=900&q=85', NOW());
