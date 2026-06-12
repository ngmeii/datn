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

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(150).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(["customer", "staff", "admin"]).optional(),
  status: z.enum(["active", "inactive", "banned"]).optional(),
});

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(150),
});

const updateCategorySchema = createCategorySchema.partial();

const createVoucherSchema = z.object({
  code: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().positive(),
  minOrderValue: z.coerce.number().nonnegative().default(0),
  endDate: z.string().date(),
});

const updateVoucherSchema = z.object({
  code: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()).optional(),
  discountType: z.enum(["percent", "fixed"]).optional(),
  discountValue: z.coerce.number().positive().optional(),
  minOrderValue: z.coerce.number().nonnegative().optional(),
  endDate: z.string().date().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const systemSettingsSchema = z.object({
  storeName: z.string().trim().min(2).max(120),
  contactEmail: z.string().trim().email().max(190),
  phone: z.string().trim().min(8).max(30),
  address: z.string().trim().min(5).max(500),
  logoUrl: z.string().trim().max(500).default(""),
  currency: z.enum(["VND", "USD"]).default("VND"),
  timezone: z.string().trim().min(2).max(80).default("Asia/Ho_Chi_Minh"),
  orderPrefix: z.string().trim().min(1).max(10).default("DH"),
  senderName: z.string().trim().min(2).max(120).default("The Heirloom"),
  senderEmail: z.string().trim().email().max(190),
  emailNotifications: z.boolean().default(true),
  orderNotifications: z.boolean().default(true),
  consignmentNotifications: z.boolean().default(true),
  privacyPolicy: z.string().max(10000).default(""),
  terms: z.string().max(10000).default(""),
  returnPolicy: z.string().max(10000).default(""),
  autoBackup: z.boolean().default(false),
  backupFrequency: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
});

const reportExportSchema = z.object({
  reportType: z.string().trim().min(2).max(50).default("overview"),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  fileName: z.string().trim().min(3).max(255),
});

const defaultSystemSettings = {
  storeName: "The Heirloom",
  contactEmail: "contact@theheirloom.vn",
  phone: "(+84) 28 3822 6699",
  address: "72 Lê Thánh Tôn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh, Việt Nam",
  logoUrl: "",
  currency: "VND",
  timezone: "Asia/Ho_Chi_Minh",
  orderPrefix: "DH",
  senderName: "The Heirloom",
  senderEmail: "noreply@theheirloom.vn",
  emailNotifications: true,
  orderNotifications: true,
  consignmentNotifications: true,
  privacyPolicy: "",
  terms: "",
  returnPolicy: "",
  autoBackup: false,
  backupFrequency: "weekly",
};

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
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || "")) ? String(req.query.date) : "";
    return res.json(await listActivityLogs(limit, date));
  } catch (error) {
    return next(error);
  }
});

router.get("/reports", requireAuth, requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const period = getReportPeriod(req.query.start, req.query.end);
    if (!period) {
      return res.status(400).json({ message: "Khoảng thời gian báo cáo không hợp lệ." });
    }

    const previousPeriod = getPreviousPeriod(period);
    const currentParams = { startDate: period.start, endDate: period.end };
    const previousParams = { startDate: previousPeriod.start, endDate: previousPeriod.end };

    const [
      [summary],
      [previousSummary],
      revenueRows,
      categoryRows,
      [consignmentSummary],
      [customerStats],
      topProducts,
      [disbursementStats],
    ] = await Promise.all([
      queryReportSummary(currentParams),
      queryReportSummary(previousParams),
      query(
        `SELECT DATE(created_at) AS date,
                COALESCE(SUM(total_amount), 0) AS value
         FROM orders
         WHERE payment_status = 'paid'
           AND created_at >= :startDate
           AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
         GROUP BY DATE(created_at)
         ORDER BY date`,
        currentParams,
      ),
      query(
        `SELECT c.name,
                COUNT(oi.item_id) AS sold_count,
                COALESCE(SUM(oi.price_snapshot), 0) AS revenue
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         JOIN products p ON p.product_id = oi.product_id
         LEFT JOIN categories c ON c.category_id = p.category_id
         WHERE o.payment_status = 'paid'
           AND o.created_at >= :startDate
           AND o.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
         GROUP BY c.category_id, c.name
         ORDER BY revenue DESC`,
        currentParams,
      ),
      query(
        `SELECT
           COUNT(*) AS new_count,
           SUM(status = 'confirmed') AS approved_count,
           (SELECT COUNT(*)
              FROM products
             WHERE sell_status = 'on_sale'
               AND created_at >= :startDate
               AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)) AS on_sale_count,
           (SELECT COUNT(DISTINCT oi.item_id)
              FROM order_items oi
              JOIN orders o ON o.order_id = oi.order_id
             WHERE o.payment_status = 'paid'
               AND o.created_at >= :startDate
               AND o.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)) AS sold_count
         FROM consignment_items
         WHERE created_at >= :startDate
           AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)`,
        currentParams,
      ),
      query(
        `SELECT
           COUNT(*) AS total_count,
           COALESCE(SUM(CASE WHEN phone IS NOT NULL AND phone <> '' THEN 1 ELSE 0 END), 0) AS with_phone_count,
           COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END), 0) AS last_7_days_count
         FROM users
         WHERE role = 'customer'
           AND created_at >= :startDate
           AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)`,
        currentParams,
      ),
      query(
        `SELECT p.product_id AS id,
                p.product_name AS name,
                JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]')) AS image_url,
                COUNT(oi.item_id) AS sold_count,
                COALESCE(SUM(oi.price_snapshot), 0) AS revenue
         FROM order_items oi
         JOIN orders o ON o.order_id = oi.order_id
         JOIN products p ON p.product_id = oi.product_id
         WHERE o.payment_status = 'paid'
           AND o.created_at >= :startDate
           AND o.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
         GROUP BY p.product_id, p.product_name, p.images
         ORDER BY sold_count DESC, revenue DESC
         LIMIT 5`,
        currentParams,
      ),
      query(
        `SELECT
           COUNT(*) AS total_count,
           COALESCE(SUM(price_snapshot), 0) AS gross_amount,
           COALESCE(SUM(commission_amount), 0) AS commission_amount,
           COALESCE(SUM(CASE WHEN status = 'success' THEN net_amount ELSE 0 END), 0) AS success_amount,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END), 0) AS pending_amount,
           COALESCE(SUM(CASE WHEN status = 'failed' THEN net_amount ELSE 0 END), 0) AS failed_amount,
           COALESCE(SUM(status = 'success'), 0) AS success_count,
           COALESCE(SUM(status = 'pending'), 0) AS pending_count,
           COALESCE(SUM(status = 'failed'), 0) AS failed_count
         FROM disbursements
         WHERE created_at >= :startDate
           AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)`,
        currentParams,
      ),
    ]);

    const newCount = Number(consignmentSummary.new_count || 0);
    const soldCount = Number(consignmentSummary.sold_count || 0);

    return res.json({
      period,
      summary: normalizeReportSummary(summary),
      previousSummary: normalizeReportSummary(previousSummary),
      revenue: fillDailySeries(revenueRows, period),
      categories: categoryRows.map((row) => ({
        ...row,
        sold_count: Number(row.sold_count || 0),
        revenue: Number(row.revenue || 0),
      })),
      consignment: {
        new_count: newCount,
        approved_count: Number(consignmentSummary.approved_count || 0),
        on_sale_count: Number(consignmentSummary.on_sale_count || 0),
        sold_count: soldCount,
        success_rate: newCount ? Math.round((soldCount / newCount) * 10000) / 100 : 0,
      },
      customers: {
        total_count: Number(customerStats.total_count || 0),
        with_phone_count: Number(customerStats.with_phone_count || 0),
        last_7_days_count: Number(customerStats.last_7_days_count || 0),
      },
      topProducts: topProducts.map((row) => ({
        ...row,
        sold_count: Number(row.sold_count || 0),
        revenue: Number(row.revenue || 0),
      })),
      disbursements: {
        total_count: Number(disbursementStats.total_count || 0),
        gross_amount: Number(disbursementStats.gross_amount || 0),
        commission_amount: Number(disbursementStats.commission_amount || 0),
        success_amount: Number(disbursementStats.success_amount || 0),
        pending_amount: Number(disbursementStats.pending_amount || 0),
        failed_amount: Number(disbursementStats.failed_amount || 0),
        success_count: Number(disbursementStats.success_count || 0),
        pending_count: Number(disbursementStats.pending_count || 0),
        failed_count: Number(disbursementStats.failed_count || 0),
      },
    });
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
          (SELECT COUNT(*) FROM vouchers
           WHERE status = 'active'
             AND end_date >= NOW()
             AND end_date < DATE_ADD(NOW(), INTERVAL 7 DAY)) AS expiring_voucher_count,
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders
           WHERE order_status = 'completed'
             AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS monthly_revenue,
          (SELECT COUNT(*) FROM orders
           WHERE discount_amount > 0
             AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS monthly_voucher_usage_count,
          (SELECT COALESCE(SUM(discount_amount), 0) FROM orders
           WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS monthly_discount_total,
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
               phone,
               role,
               status,
               created_at
        FROM users
        ORDER BY created_at DESC, user_id DESC
      `),
      query(`
        SELECT c.category_id AS id,
               c.name,
               COUNT(p.product_id) AS product_count,
               MAX(JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]'))) AS image_url,
               MAX(COALESCE(p.updated_at, p.created_at)) AS updated_at
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.category_id
        GROUP BY c.category_id, c.name
        ORDER BY product_count DESC, c.name
      `),
      query(`
        SELECT voucher_id AS id,
               code,
               discount_type,
               discount_value,
               min_order_value,
               start_date,
               end_date,
               status,
               created_at
        FROM vouchers
        ORDER BY created_at DESC, voucher_id DESC
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

router.get("/report-exports", requireAuth, requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 5)));
    return res.json(
      await query(
        `SELECT export_id AS id,
                report_type,
                period_start,
                period_end,
                file_name,
                created_at
         FROM report_exports
         WHERE user_id = :userId
         ORDER BY created_at DESC, export_id DESC
         LIMIT ${limit}`,
        { userId: req.user.id },
      ),
    );
  } catch (error) {
    return next(error);
  }
});

router.post("/report-exports", requireAuth, requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const data = reportExportSchema.parse(req.body);
    const result = await query(
      `INSERT INTO report_exports
       (user_id, report_type, period_start, period_end, file_name, created_at)
       VALUES (:userId, :reportType, :periodStart, :periodEnd, :fileName, NOW())`,
      { ...data, userId: req.user.id },
    );
    return res.status(201).json({
      id: result.insertId,
      message: "Đã ghi nhận lịch sử xuất báo cáo.",
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/settings", ...adminOnly, async (_req, res, next) => {
  try {
    const rows = await query("SELECT setting_key, setting_value, updated_at FROM system_settings");
    const settings = { ...defaultSystemSettings };
    let updatedAt = null;

    for (const row of rows) {
      if (!(row.setting_key in settings)) continue;
      settings[row.setting_key] = parseSettingValue(row.setting_value, settings[row.setting_key]);
      if (!updatedAt || new Date(row.updated_at) > new Date(updatedAt)) updatedAt = row.updated_at;
    }

    return res.json({ settings, updatedAt });
  } catch (error) {
    return next(error);
  }
});

router.put("/settings", ...adminOnly, async (req, res, next) => {
  try {
    const settings = systemSettingsSchema.parse(req.body);
    await Promise.all(
      Object.entries(settings).map(([key, value]) =>
        query(
          `INSERT INTO system_settings (setting_key, setting_value, updated_at)
           VALUES (:key, :value, NOW())
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
          { key, value: JSON.stringify(value) },
        ),
      ),
    );

    return res.json({ message: "Đã lưu cài đặt hệ thống.", settings });
  } catch (error) {
    return next(error);
  }
});

router.get("/settings/backup", ...adminOnly, async (_req, res, next) => {
  try {
    const [settingsRows, [counts]] = await Promise.all([
      query("SELECT setting_key, setting_value, updated_at FROM system_settings ORDER BY setting_key"),
      query(`
        SELECT
          (SELECT COUNT(*) FROM users) AS users,
          (SELECT COUNT(*) FROM categories) AS categories,
          (SELECT COUNT(*) FROM products) AS products,
          (SELECT COUNT(*) FROM orders) AS orders,
          (SELECT COUNT(*) FROM consignment_items) AS consignments,
          (SELECT COUNT(*) FROM vouchers) AS vouchers
      `),
    ]);

    return res.json({
      generatedAt: new Date().toISOString(),
      application: "The Heirloom",
      counts,
      settings: settingsRows.reduce((result, row) => {
        result[row.setting_key] = parseSettingValue(row.setting_value, null);
        return result;
      }, {}),
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

router.patch("/users/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = updateUserSchema.parse(req.body);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Tài khoản không hợp lệ." });
    if (id === Number(req.user.id) && data.status && data.status !== "active") {
      return res.status(409).json({ message: "Không thể khóa tài khoản Admin đang đăng nhập." });
    }

    const fields = [];
    const params = { id };
    const mapping = { fullName: "full_name", email: "email", phone: "phone", role: "role", status: "status" };
    for (const [key, column] of Object.entries(mapping)) {
      if (data[key] === undefined) continue;
      fields.push(`${column} = :${key}`);
      params[key] = data[key];
    }
    if (!fields.length) return res.status(400).json({ message: "Không có dữ liệu cần cập nhật." });

    const result = await query(`UPDATE users SET ${fields.join(", ")}, updated_at = NOW() WHERE user_id = :id`, params);
    if (!result.affectedRows) return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    return res.json({ message: "Đã cập nhật tài khoản." });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email đã được sử dụng." });
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

router.patch("/categories/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = updateCategorySchema.parse(req.body);
    if (!data.name) return res.status(400).json({ message: "Tên danh mục không hợp lệ." });
    const result = await query("UPDATE categories SET name = :name WHERE category_id = :id", { id, name: data.name });
    if (!result.affectedRows) return res.status(404).json({ message: "Không tìm thấy danh mục." });
    return res.json({ message: "Đã cập nhật danh mục." });
  } catch (error) {
    return next(error);
  }
});

router.delete("/categories/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [usage] = await query(
      `SELECT
         (SELECT COUNT(*) FROM products WHERE category_id = :id) +
         (SELECT COUNT(*) FROM consignment_items WHERE category_id = :id) AS total`,
      { id },
    );
    if (Number(usage?.total || 0) > 0) {
      return res.status(409).json({ message: "Danh mục đang có sản phẩm hoặc yêu cầu ký gửi nên không thể xóa." });
    }
    const result = await query("DELETE FROM categories WHERE category_id = :id", { id });
    if (!result.affectedRows) return res.status(404).json({ message: "Không tìm thấy danh mục." });
    return res.json({ message: "Đã xóa danh mục." });
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

router.patch("/vouchers/:id", ...adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = updateVoucherSchema.parse(req.body);
    if (data.discountType === "percent" && Number(data.discountValue || 0) > 100) {
      return res.status(400).json({ message: "Mức giảm phần trăm không được vượt quá 100%." });
    }

    const fields = [];
    const params = { id };
    const mapping = {
      code: "code",
      discountType: "discount_type",
      discountValue: "discount_value",
      minOrderValue: "min_order_value",
      endDate: "end_date",
      status: "status",
    };
    for (const [key, column] of Object.entries(mapping)) {
      if (data[key] === undefined) continue;
      fields.push(`${column} = :${key}`);
      params[key] = data[key];
    }
    if (!fields.length) return res.status(400).json({ message: "Không có dữ liệu cần cập nhật." });

    const result = await query(`UPDATE vouchers SET ${fields.join(", ")} WHERE voucher_id = :id`, params);
    if (!result.affectedRows) return res.status(404).json({ message: "Không tìm thấy voucher." });
    return res.json({ message: "Đã cập nhật voucher." });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Mã voucher đã tồn tại." });
    return next(error);
  }
});

function parseSettingValue(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return value ?? fallback;
  }
}

function getCurrentMonthPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    start: toDateKey(new Date(year, month, 1)),
    end: toDateKey(now),
  };
}

function getReportPeriod(start, end) {
  const today = toDateKey(new Date());
  const defaultStart = `${today.slice(0, 8)}01`;
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(start || "")) ? String(start) : defaultStart;
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(String(end || "")) ? String(end) : today;
  const startTime = new Date(`${startDate}T00:00:00`).getTime();
  const endTime = new Date(`${endDate}T00:00:00`).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) return null;
  if ((endTime - startTime) / 86400000 > 366) return null;
  return { start: startDate, end: endDate };
}

function getPreviousPeriod(period) {
  const start = new Date(`${period.start}T00:00:00`);
  const end = new Date(`${period.end}T00:00:00`);
  const days = Math.round((end - start) / 86400000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  return { start: toDateKey(previousStart), end: toDateKey(previousEnd) };
}

function queryReportSummary(params) {
  return query(
    `SELECT
       COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS revenue,
       COUNT(*) AS order_count,
       COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_order_count,
       (SELECT COUNT(DISTINCT oi.item_id)
          FROM order_items oi
          JOIN orders paid_orders ON paid_orders.order_id = oi.order_id
         WHERE paid_orders.payment_status = 'paid'
           AND paid_orders.created_at >= :startDate
           AND paid_orders.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)) AS sold_product_count,
       (SELECT COALESCE(SUM(COALESCE(ci.seller_price, ci.estimated_price, 0)), 0)
          FROM consignment_items ci
         WHERE ci.created_at >= :startDate
           AND ci.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)) AS consignment_value,
       (SELECT COALESCE(SUM(d.net_amount), 0)
          FROM disbursements d
         WHERE d.status = 'success'
           AND d.created_at >= :startDate
           AND d.created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)) AS payout
     FROM orders
     WHERE created_at >= :startDate
       AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)`,
    params,
  );
}

function normalizeReportSummary(summary = {}) {
  return {
    revenue: Number(summary.revenue || 0),
    order_count: Number(summary.order_count || 0),
    paid_order_count: Number(summary.paid_order_count || 0),
    sold_product_count: Number(summary.sold_product_count || 0),
    consignment_value: Number(summary.consignment_value || 0),
    payout: Number(summary.payout || 0),
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
