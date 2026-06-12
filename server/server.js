import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import consignmentRoutes from "./routes/consignments.js";
import orderRoutes from "./routes/orders.js";
import cartRoutes from "./routes/cart.js";
import adminRoutes from "./routes/admin.js";
import locationRoutes from "./routes/locations.js";
import uploadRoutes, { uploadDirectory } from "./routes/uploads.js";
import engagementRoutes from "./routes/engagement.js";
import { query } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res, next) => {
  try {
    await query("SELECT 1 AS ok");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/categories", async (_req, res, next) => {
  try {
    res.json(
      await query(
        `SELECT category_id AS id,
                name,
                CAST(category_id AS CHAR) AS slug
         FROM categories
         ORDER BY name`,
      ),
    );
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/consignments", consignmentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/uploads", express.static(uploadDirectory));
app.use("/api/uploads", uploadRoutes);
app.use("/api", engagementRoutes);

app.use((error, _req, res, _next) => {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Ảnh không được vượt quá 5 MB." });
  }

  if (error?.message?.startsWith("Chỉ hỗ trợ ảnh")) {
    return res.status(400).json({ message: error.message });
  }

  if (error?.issues) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ.", issues: error.issues });
  }

  console.error(error);
  return res.status(500).json({ message: "Lỗi máy chủ." });
});

Promise.all([ensureOrderSchema(), ensureSystemSettingsSchema(), ensureEngagementSchema(), ensureCartSchema()])
  .then(() => {
    app.listen(port, () => {
      console.log(`API server running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Unable to initialize database schema:", error);
    process.exit(1);
  });

async function ensureOrderSchema() {
  const columns = await query("SHOW COLUMNS FROM orders LIKE 'receiver_email'");
  if (!columns.length) {
    await query("ALTER TABLE orders ADD COLUMN receiver_email VARCHAR(190) NULL AFTER receiver_phone");
  }

  const buyerColumns = await query(
    `SELECT COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'orders'
       AND COLUMN_NAME = 'buyer_id'`,
  );
  const buyerColumn = buyerColumns[0];

  if (buyerColumn && buyerColumn.isNullable === "NO") {
    const columnType = String(buyerColumn.columnType || "");
    if (!/^(?:tinyint|smallint|mediumint|int|bigint)(?: unsigned)?$/i.test(columnType)) {
      throw new Error("Unsupported orders.buyer_id column type.");
    }
    await query(`ALTER TABLE orders MODIFY COLUMN buyer_id ${columnType} NULL`);
  }
}

async function ensureSystemSettingsSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensureEngagementSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      subscriber_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(190) NOT NULL UNIQUE,
      status ENUM('active', 'unsubscribed') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS report_exports (
      export_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NULL,
      report_type VARCHAR(50) NOT NULL DEFAULT 'overview',
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_report_exports_user_created (user_id, created_at)
    )
  `);
}

async function ensureCartSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS carts (
      cart_id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (cart_id),
      UNIQUE KEY uq_carts_user_id (user_id),
      CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
    )
  `);

  await query(`
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
    )
  `);
}
