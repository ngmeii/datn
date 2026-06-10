import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { listActivityLogs } from "../activityLog.js";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const adminOnly = [requireAuth, requireRole("admin")];

const createUserSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(6),
  phone: z.string().trim().max(20).optional().default(""),
  role: z.enum(["customer", "staff", "admin"]).default("customer"),
});

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(150),
});

const createVoucherSchema = z.object({
  code: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().positive(),
  minOrderValue: z.coerce.number().nonnegative().default(0),
  endDate: z.string().date(),
});

router.get("/summary", requireAuth, requireRole("staff", "admin"), async (_req, res, next) => {
  try {
    const [summary] = await query(`
      SELECT
        (SELECT COUNT(*) FROM products) AS product_count,
        (SELECT COUNT(*) FROM products WHERE sell_status = 'on_sale') AS available_count,
        (SELECT COUNT(*) FROM consignment_items WHERE status = 'pending') AS pending_consignment_count,
        (SELECT COUNT(*) FROM orders) AS order_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE order_status = 'completed') AS revenue
    `);

    const recentConsignments = await query(`
      SELECT ci.consignment_item_id AS id,
             ci.product_name,
             ci.status,
             ci.created_at,
             u.full_name AS seller_name
      FROM consignment_items ci
      JOIN consignment_requests cr ON cr.request_id = ci.request_id
      JOIN users u ON u.user_id = cr.seller_id
      ORDER BY ci.created_at DESC
      LIMIT 8
    `);

    return res.json({ summary, recentConsignments });
  } catch (error) {
    return next(error);
  }
});

router.get("/activity", requireAuth, requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 8)));
    return res.json(await listActivityLogs(limit));
  } catch (error) {
    return next(error);
  }
});

router.get("/overview", ...adminOnly, async (_req, res, next) => {
  try {
    const [
      [summary],
      accounts,
      categories,
      vouchers,
      revenueRows,
      orderRows,
      [customerSummary],
    ] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*) FROM users) AS account_count,
          (SELECT COUNT(*) FROM categories) AS category_count,
          (SELECT COUNT(*) FROM vouchers
           WHERE status = 'active' AND start_date <= NOW() AND end_date >= NOW()) AS active_voucher_count,
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders
           WHERE order_status = 'completed'
             AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS monthly_revenue,
          (SELECT COUNT(*) FROM users
           WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS new_account_count,
          (SELECT COUNT(*) FROM categories
           WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS new_category_count,
          (SELECT COUNT(*) FROM vouchers
           WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS new_voucher_count,
          (SELECT COUNT(*) FROM orders
           WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS monthly_order_count
      `),
      query(`
        SELECT user_id AS id,
               full_name,
               email,
               role,
               status,
               created_at
        FROM users
        ORDER BY created_at DESC, user_id DESC
        LIMIT 5
      `),
      query(`
        SELECT c.category_id AS id,
               c.name,
               COUNT(p.product_id) AS product_count,
               MAX(JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]'))) AS image_url
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.category_id
        GROUP BY c.category_id, c.name
        ORDER BY product_count DESC, c.name
        LIMIT 5
      `),
      query(`
        SELECT voucher_id AS id,
               code,
               discount_type,
               discount_value,
               min_order_value,
               end_date,
               status
        FROM vouchers
        ORDER BY created_at DESC, voucher_id DESC
        LIMIT 5
      `),
      query(`
        SELECT DATE(created_at) AS date,
               COALESCE(SUM(total_amount), 0) AS value
        FROM orders
        WHERE order_status = 'completed'
          AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        GROUP BY DATE(created_at)
        ORDER BY date
      `),
      query(`
        SELECT DATE(created_at) AS date,
               COUNT(*) AS value
        FROM orders
        WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        GROUP BY DATE(created_at)
        ORDER BY date
      `),
      query(`
        SELECT
          COUNT(*) AS total,
          SUM(created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS new_count
        FROM users
        WHERE role = 'customer'
      `),
    ]);

    const period = getCurrentMonthPeriod();
    const newCustomers = Number(customerSummary.new_count || 0);
    const totalCustomers = Number(customerSummary.total || 0);

    return res.json({
      summary,
      accounts,
      categories,
      vouchers,
      reports: {
        period,
        revenue: fillDailySeries(revenueRows, period),
        orders: fillDailySeries(orderRows, period),
        customers: {
          new_count: newCustomers,
          existing_count: Math.max(0, totalCustomers - newCustomers),
          total: totalCustomers,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/users", ...adminOnly, async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 10);
    const result = await query(
      `INSERT INTO users
       (email, password_hash, full_name, phone, role, status, created_at, updated_at)
       VALUES (:email, :passwordHash, :fullName, :phone, :role, 'active', NOW(), NOW())`,
      { ...data, passwordHash },
    );

    return res.status(201).json({ id: result.insertId, message: "Đã thêm tài khoản." });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email đã được sử dụng." });
    }
    return next(error);
  }
});

router.post("/categories", ...adminOnly, async (req, res, next) => {
  try {
    const data = createCategorySchema.parse(req.body);
    const result = await query(
      "INSERT INTO categories (name, created_at) VALUES (:name, NOW())",
      data,
    );

    return res.status(201).json({ id: result.insertId, message: "Đã thêm danh mục." });
  } catch (error) {
    return next(error);
  }
});

router.post("/vouchers", ...adminOnly, async (req, res, next) => {
  try {
    const data = createVoucherSchema.parse(req.body);
    if (data.discountType === "percent" && data.discountValue > 100) {
      return res.status(400).json({ message: "Mức giảm theo phần trăm không được vượt quá 100%." });
    }

    const result = await query(
      `INSERT INTO vouchers
       (code, discount_type, discount_value, min_order_value, start_date, end_date, status, created_at)
       VALUES (:code, :discountType, :discountValue, :minOrderValue, NOW(), :endDate, 'active', NOW())`,
      data,
    );

    return res.status(201).json({ id: result.insertId, message: "Đã tạo voucher." });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Mã voucher đã tồn tại." });
    }
    return next(error);
  }
});

function getCurrentMonthPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    start: toDateKey(new Date(year, month, 1)),
    end: toDateKey(now),
  };
}

function fillDailySeries(rows, period) {
  const values = new Map(rows.map((row) => [toDateKey(new Date(row.date)), Number(row.value || 0)]));
  const result = [];
  const cursor = new Date(`${period.start}T00:00:00`);
  const end = new Date(`${period.end}T00:00:00`);

  while (cursor <= end) {
    const date = toDateKey(cursor);
    result.push({ date, value: values.get(date) || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

function toDateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default router;
