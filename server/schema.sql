CREATE DATABASE IF NOT EXISTS ky_gui
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ky_gui;

CREATE TABLE IF NOT EXISTS users (
  user_id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  role ENUM('customer', 'staff', 'admin') NOT NULL DEFAULT 'customer',
  status ENUM('active', 'inactive', 'banned') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE IF NOT EXISTS categories (
  category_id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  description TEXT DEFAULT NULL,
  status ENUM('active', 'inactive', 'locked') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (category_id)
);

CREATE TABLE IF NOT EXISTS consignment_requests (
  request_id INT NOT NULL AUTO_INCREMENT,
  seller_id INT NOT NULL,
  send_method ENUM('self_deliver', 'shipping') NOT NULL,
  status ENUM(
    'pending',
    'approved',
    'rejected',
    'waiting_receive',
    'processing',
    'completed',
    'waiting_return',
    'returned',
    'cancel_requested',
    'cancelled_by_customer',
    'cancelled'
  ) NOT NULL DEFAULT 'pending',
  note TEXT,
  reject_reason TEXT,
  cancel_reason TEXT,
  cancelled_at DATETIME DEFAULT NULL,
  cancelled_by INT DEFAULT NULL,
  cancel_requested_at DATETIME DEFAULT NULL,
  cancel_request_status VARCHAR(50) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id),
  KEY fk_req_seller (seller_id),
  CONSTRAINT fk_req_seller FOREIGN KEY (seller_id) REFERENCES users (user_id)
);

CREATE TABLE IF NOT EXISTS consignment_items (
  consignment_item_id INT NOT NULL AUTO_INCREMENT,
  request_id INT NOT NULL,
  category_id INT DEFAULT NULL,
  product_name VARCHAR(255) NOT NULL,
  brand VARCHAR(150) DEFAULT NULL,
  condition_level ENUM('new', 'like_new', 'good', 'fair', 'poor') NOT NULL,
  description TEXT,
  estimated_price DECIMAL(12, 0) DEFAULT NULL,
  seller_price DECIMAL(12, 0) DEFAULT NULL,
  images JSON DEFAULT NULL,
  status ENUM(
    'pending',
    'accepted',
    'rejected',
    'processing',
    'waiting_confirm',
    'confirmed',
    'seller_rejected',
    'waiting_return',
    'returned',
    'cancelled'
  ) NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (consignment_item_id),
  KEY fk_consignment_item_request (request_id),
  KEY idx_consignment_item_category (category_id),
  CONSTRAINT fk_consignment_item_request FOREIGN KEY (request_id) REFERENCES consignment_requests (request_id) ON DELETE CASCADE,
  CONSTRAINT fk_consignment_item_category FOREIGN KEY (category_id) REFERENCES categories (category_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vouchers (
  voucher_id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  discount_type ENUM('percent', 'fixed') NOT NULL,
  discount_value DECIMAL(12, 2) NOT NULL,
  min_order_value DECIMAL(12, 0) DEFAULT '0',
  max_discount DECIMAL(12, 0) DEFAULT NULL,
  usage_limit INT DEFAULT NULL,
  used_count INT NOT NULL DEFAULT '0',
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (voucher_id),
  UNIQUE KEY uq_vouchers_code (code)
);

CREATE TABLE IF NOT EXISTS products (
  product_id INT NOT NULL AUTO_INCREMENT,
  consignment_item_id INT NOT NULL,
  seller_id INT NOT NULL,
  category_id INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  brand VARCHAR(150) DEFAULT NULL,
  condition_level ENUM('new', 'like_new', 'good', 'fair', 'poor') NOT NULL,
  size VARCHAR(50) DEFAULT NULL,
  color VARCHAR(50) DEFAULT NULL,
  material VARCHAR(100) DEFAULT NULL,
  description TEXT,
  images JSON DEFAULT NULL,
  final_price DECIMAL(12, 0) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL DEFAULT '20.00',
  display_status ENUM('visible', 'hidden') NOT NULL DEFAULT 'visible',
  sell_status ENUM('waiting_list', 'on_sale', 'reserved', 'sold', 'unlisted', 'expired') NOT NULL DEFAULT 'waiting_list',
  consign_start_date DATE DEFAULT NULL,
  consign_end_date DATE DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  UNIQUE KEY uq_products_consignment_item_id (consignment_item_id),
  KEY fk_prod_seller (seller_id),
  KEY fk_prod_category (category_id),
  CONSTRAINT fk_prod_consignment_item FOREIGN KEY (consignment_item_id) REFERENCES consignment_items (consignment_item_id),
  CONSTRAINT fk_prod_seller FOREIGN KEY (seller_id) REFERENCES users (user_id),
  CONSTRAINT fk_prod_category FOREIGN KEY (category_id) REFERENCES categories (category_id)
);

CREATE TABLE IF NOT EXISTS orders (
  order_id INT NOT NULL AUTO_INCREMENT,
  buyer_id INT DEFAULT NULL,
  voucher_id INT DEFAULT NULL,
  receiver_name VARCHAR(150) DEFAULT NULL,
  receiver_phone VARCHAR(20) DEFAULT NULL,
  receiver_email VARCHAR(190) DEFAULT NULL,
  shipping_province VARCHAR(100) DEFAULT NULL,
  shipping_district VARCHAR(100) DEFAULT NULL,
  shipping_ward VARCHAR(100) DEFAULT NULL,
  shipping_street VARCHAR(255) DEFAULT NULL,
  subtotal_amount DECIMAL(12, 0) NOT NULL DEFAULT '0',
  shipping_fee DECIMAL(12, 0) NOT NULL DEFAULT '0',
  discount_amount DECIMAL(12, 0) NOT NULL DEFAULT '0',
  total_amount DECIMAL(12, 0) NOT NULL,
  payment_method ENUM('cod', 'online', 'bank_transfer') NOT NULL,
  payment_status ENUM('unpaid', 'pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'unpaid',
  order_status ENUM(
    'waiting_payment',
    'waiting_confirm',
    'confirmed',
    'shipping',
    'delivered',
    'completed',
    'cancelled',
    'return_requested',
    'returned'
  ) NOT NULL DEFAULT 'waiting_payment',
  note TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  KEY fk_order_buyer (buyer_id),
  KEY fk_order_voucher (voucher_id),
  CONSTRAINT fk_order_buyer FOREIGN KEY (buyer_id) REFERENCES users (user_id),
  CONSTRAINT fk_order_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers (voucher_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  item_id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  price_snapshot DECIMAL(12, 0) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL,
  PRIMARY KEY (item_id),
  UNIQUE KEY uq_order_items_product_id (product_id),
  KEY fk_item_order (order_id),
  KEY fk_item_product (product_id),
  CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products (product_id)
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  amount DECIMAL(12, 0) NOT NULL,
  payment_method ENUM('cod', 'online', 'bank_transfer') NOT NULL,
  status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  paid_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payment_id),
  UNIQUE KEY uq_payments_order_id (order_id),
  KEY fk_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id INT NOT NULL AUTO_INCREMENT,
  payment_id INT NOT NULL,
  invoice_code VARCHAR(50) NOT NULL,
  total_amount DECIMAL(12, 0) NOT NULL,
  status ENUM('draft', 'issued', 'paid', 'cancelled') NOT NULL DEFAULT 'issued',
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (invoice_id),
  UNIQUE KEY uq_invoices_code (invoice_code),
  UNIQUE KEY uq_invoices_payment_id (payment_id),
  KEY fk_invoices_payment (payment_id),
  CONSTRAINT fk_invoices_payment FOREIGN KEY (payment_id) REFERENCES payments (payment_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_deliveries (
  delivery_id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  ghn_order_code VARCHAR(100) DEFAULT NULL,
  estimated_delivery DATE DEFAULT NULL,
  actual_delivery DATETIME DEFAULT NULL,
  fee DECIMAL(12, 0) NOT NULL DEFAULT '0',
  status ENUM('pending', 'shipping', 'delivered', 'failed', 'returned') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (delivery_id),
  UNIQUE KEY uq_order_deliveries_order_id (order_id),
  KEY fk_order_deliveries_order (order_id),
  CONSTRAINT fk_order_deliveries_order FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id INT NOT NULL AUTO_INCREMENT,
  item_id INT NOT NULL,
  buyer_id INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  UNIQUE KEY uq_reviews_item_id (item_id),
  KEY fk_reviews_buyer (buyer_id),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_item FOREIGN KEY (item_id) REFERENCES order_items (item_id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_buyer FOREIGN KEY (buyer_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shipping_orders (
  shipping_order_id INT NOT NULL AUTO_INCREMENT,
  request_id INT NOT NULL,
  ghn_order_code VARCHAR(100) DEFAULT NULL,
  sender_name VARCHAR(150) NOT NULL,
  sender_phone VARCHAR(20) NOT NULL,
  sender_address VARCHAR(500) NOT NULL,
  fee DECIMAL(12, 0) NOT NULL DEFAULT '0',
  status ENUM('pending', 'picked_up', 'shipping', 'delivered', 'received', 'cancelled', 'failed', 'returned') NOT NULL DEFAULT 'pending',
  expected_delivery DATETIME DEFAULT NULL,
  delivered_at DATETIME DEFAULT NULL,
  received_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (shipping_order_id),
  UNIQUE KEY uq_shipping_orders_request_id (request_id),
  KEY fk_shipping_orders_request (request_id),
  CONSTRAINT fk_shipping_orders_request FOREIGN KEY (request_id) REFERENCES consignment_requests (request_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS disbursements (
  disbursement_id INT NOT NULL AUTO_INCREMENT,
  order_item_id INT NOT NULL,
  seller_id INT NOT NULL,
  price_snapshot DECIMAL(12, 0) NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL,
  commission_amount DECIMAL(12, 0) NOT NULL,
  net_amount DECIMAL(12, 0) NOT NULL,
  bank_account VARCHAR(100) DEFAULT NULL,
  bank_name VARCHAR(100) DEFAULT NULL,
  bank_account_holder VARCHAR(150) DEFAULT NULL,
  gateway_ref VARCHAR(255) DEFAULT NULL,
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  disbursed_at DATETIME DEFAULT NULL,
  disbursed_by_staff_id INT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (disbursement_id),
  UNIQUE KEY uq_disbursements_order_item_id (order_item_id),
  KEY fk_disb_seller (seller_id),
  CONSTRAINT fk_disb_item FOREIGN KEY (order_item_id) REFERENCES order_items (item_id),
  CONSTRAINT fk_disb_seller FOREIGN KEY (seller_id) REFERENCES users (user_id)
);

CREATE TABLE IF NOT EXISTS user_payment_info (
  user_id INT NOT NULL,
  bank_name VARCHAR(120) DEFAULT NULL,
  bank_account_number VARCHAR(100) DEFAULT NULL,
  bank_account_holder VARCHAR(150) DEFAULT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_payment_info_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS carts (
  cart_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cart_id),
  UNIQUE KEY uq_carts_user_id (user_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id INT NOT NULL AUTO_INCREMENT,
  cart_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cart_item_id),
  UNIQUE KEY uq_cart_items_cart_product (cart_id, product_id),
  KEY fk_cart_items_product (product_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts (cart_id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products (product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_logs (
  log_id INT NOT NULL AUTO_INCREMENT,
  user_id INT DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) DEFAULT NULL,
  target_id INT DEFAULT NULL,
  detail JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY fk_log_user (user_id),
  CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  subscriber_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  status ENUM('active', 'unsubscribed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (subscriber_id),
  UNIQUE KEY uq_newsletter_email (email)
);

CREATE TABLE IF NOT EXISTS report_exports (
  export_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT DEFAULT NULL,
  report_type VARCHAR(50) NOT NULL DEFAULT 'overview',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (export_id),
  KEY idx_report_exports_user_created (user_id, created_at),
  CONSTRAINT fk_report_exports_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL
);

INSERT IGNORE INTO categories (category_id, name) VALUES
  (1, 'Váy'),
  (2, 'Áo'),
  (3, 'Túi xách'),
  (4, 'Giày'),
  (5, 'Phụ kiện');

INSERT IGNORE INTO users (user_id, email, password_hash, full_name, phone, role, status) VALUES
  (1, 'admin@heirloom.vn', '$2b$10$CBPwCy1g0bHQ4YSGgR6.v.3WnEC8.wQeEDf7HWh.B8Y6B.FpFWFpK', 'Admin hệ thống', '0900000000', 'admin', 'active'),
  (2, 'staff@heirloom.vn', '$2b$10$CBPwCy1g0bHQ4YSGgR6.v.3WnEC8.wQeEDf7HWh.B8Y6B.FpFWFpK', 'Nhân viên cửa hàng', '0911111111', 'staff', 'active'),
  (3, 'mai@example.com', '$2b$10$CBPwCy1g0bHQ4YSGgR6.v.3WnEC8.wQeEDf7HWh.B8Y6B.FpFWFpK', 'Nguyen Ngoc Mai', '0922222222', 'customer', 'active');
