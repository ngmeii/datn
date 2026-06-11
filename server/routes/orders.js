import { Router } from "express";
import { z } from "zod";
import { actorFromRequest, logActivity } from "../activityLog.js";
import { query, pool } from "../db.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const createSchema = z.object({
  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().positive().default(1),
    }),
  ).min(1),
  receiverName: z.string().trim().min(2).max(150),
  receiverPhone: z.string().trim().regex(/^(?:\+84|0)\d{9,10}$/),
  receiverEmail: z.string().trim().email().max(190),
  shippingProvince: z.string().trim().min(2).max(100),
  shippingWard: z.string().trim().min(2).max(100),
  shippingStreet: z.string().trim().min(3).max(255),
  paymentMethod: z.enum(["cod", "bank_transfer", "online"]),
  voucherCode: z.string().optional().default(""),
});

const quoteSchema = createSchema.pick({
  items: true,
  voucherCode: true,
});

const uiToOrderStatus = {
  pending_payment: "waiting_payment",
  pending_confirmation: "waiting_confirm",
  paid: "confirmed",
  confirmed: "confirmed",
  shipping: "shipping",
  completed: "completed",
  cancelled: "cancelled",
  return_requested: "return_requested",
  refunded: "returned",
};

const orderToUiStatus = {
  waiting_payment: "pending_payment",
  waiting_confirm: "pending_confirmation",
  confirmed: "confirmed",
  shipping: "shipping",
  delivered: "shipping",
  completed: "completed",
  cancelled: "cancelled",
  return_requested: "return_requested",
  returned: "refunded",
};

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const staffQuery = ["staff", "admin"].includes(req.user.role) ? "" : "WHERE o.buyer_id = :userId";
    const rows = await query(
      `SELECT o.order_id AS id,
              o.buyer_id,
              o.payment_method,
              o.payment_status,
              o.order_status,
              o.subtotal_amount AS subtotal,
              o.shipping_fee,
              o.total_amount AS total,
              o.receiver_name,
              o.receiver_phone,
              o.receiver_email,
              o.shipping_province,
              o.shipping_ward,
              o.shipping_street,
              CONCAT_WS(', ', o.shipping_street, o.shipping_ward, o.shipping_province) AS shipping_address,
              o.created_at,
              COALESCE(u.full_name, o.receiver_name) AS buyer_name
       FROM orders o
       LEFT JOIN users u ON u.user_id = o.buyer_id
       ${staffQuery}
       ORDER BY o.created_at DESC`,
      { userId: req.user.id },
    );

    return res.json(rows.map((row) => ({ ...row, status: orderToUiStatus[row.order_status] || row.order_status })));
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const orders = await query(
      `SELECT o.order_id AS id,
              o.buyer_id,
              o.payment_method,
              o.payment_status,
              o.order_status,
              o.subtotal_amount AS subtotal,
              o.shipping_fee,
              o.discount_amount,
              o.total_amount AS total,
              o.receiver_name,
              o.receiver_phone,
              o.receiver_email,
              o.shipping_province,
              o.shipping_ward,
              o.shipping_street,
              CONCAT_WS(', ', o.shipping_street, o.shipping_ward, o.shipping_province) AS shipping_address,
              o.created_at
       FROM orders o
       WHERE o.order_id = :id
         AND (:isStaff = 1 OR o.buyer_id = :userId)
       LIMIT 1`,
      {
        id: req.params.id,
        isStaff: ["staff", "admin"].includes(req.user.role) ? 1 : 0,
        userId: req.user.id,
      },
    );

    if (!orders.length) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    const items = await query(
      `SELECT oi.item_id AS id,
              oi.product_id,
              oi.price_snapshot AS price,
              p.product_name AS name,
              p.brand,
              p.size,
              p.color,
              JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]')) AS image_url,
              c.name AS category_name
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       LEFT JOIN categories c ON c.category_id = p.category_id
       WHERE oi.order_id = :id
       ORDER BY oi.item_id`,
      { id: req.params.id },
    );

    const order = orders[0];
    return res.json({
      ...order,
      status: orderToUiStatus[order.order_status] || order.order_status,
      items,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/quote", async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const data = quoteSchema.parse(req.body);
    const quote = await buildOrderQuote(connection, data);
    const { productById: _productById, ...publicQuote } = quote;
    return res.json(publicQuote);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  } finally {
    connection.release();
  }
});

router.post("/", optionalAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const data = createSchema.parse(req.body);
    await connection.beginTransaction();

    const quote = await buildOrderQuote(connection, data, { lockProducts: true });
    const productById = quote.productById;
    const orderStatus = data.paymentMethod === "cod" ? "waiting_confirm" : "waiting_payment";

    const [orderResult] = await connection.execute(
      `INSERT INTO orders
       (buyer_id, receiver_name, receiver_phone, receiver_email, shipping_province, shipping_district, shipping_ward, shipping_street, subtotal_amount, shipping_fee, discount_amount, total_amount, payment_method, payment_status, order_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, NOW(), NOW())`,
      [
        req.user?.id || null,
        data.receiverName,
        data.receiverPhone,
        data.receiverEmail,
        data.shippingProvince,
        data.shippingWard,
        data.shippingStreet,
        quote.subtotal,
        quote.shippingFee,
        quote.discountAmount,
        quote.total,
        data.paymentMethod,
        orderStatus,
      ],
    );

    for (const item of data.items) {
      const product = productById.get(item.productId);
      await connection.execute(
        `INSERT INTO order_items (order_id, product_id, price_snapshot, commission_rate)
         VALUES (?, ?, ?, ?)`,
        [orderResult.insertId, item.productId, product.final_price, product.commission_rate || 20],
      );
      await connection.execute("UPDATE products SET sell_status = 'reserved', updated_at = NOW() WHERE product_id = ?", [item.productId]);
    }

    await connection.commit();
    await logActivity({
      ...actorFromRequest(req),
      entityType: "order",
      entityId: orderResult.insertId,
      action: "order_created",
      message: `Đã tạo đơn hàng #DH${String(orderResult.insertId).padStart(4, "0")} với tổng thanh toán ${formatMoney(quote.total)}.`,
      metadata: { total: quote.total, status: orderToUiStatus[orderStatus] },
    });

    return res.status(201).json({
      id: orderResult.insertId,
      status: orderToUiStatus[orderStatus],
      subtotal: quote.subtotal,
      shippingFee: quote.shippingFee,
      discountAmount: quote.discountAmount,
      total: quote.total,
      voucher: quote.voucher,
      message: "Da tao don hang.",
    });
  } catch (error) {
    await connection.rollback();
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  } finally {
    connection.release();
  }
});

router.patch("/:id/status", requireAuth, requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(Object.keys(uiToOrderStatus)),
      trackingCode: z.string().optional().default(""),
    });
    const data = schema.parse(req.body);
    const orderStatus = uiToOrderStatus[data.status];
    const paymentStatus = ["paid", "confirmed", "shipping", "completed"].includes(data.status) ? "paid" : undefined;

    await query(
      `UPDATE orders
       SET order_status = :orderStatus,
           payment_status = COALESCE(:paymentStatus, payment_status),
           updated_at = NOW()
       WHERE order_id = :id`,
      { orderStatus, paymentStatus: paymentStatus ?? null, id: req.params.id },
    );

    if (data.status === "completed") {
      await query(
        `UPDATE products p
         JOIN order_items oi ON oi.product_id = p.product_id
         SET p.sell_status = 'sold', p.updated_at = NOW()
         WHERE oi.order_id = :id`,
        { id: req.params.id },
      );
    }
    await logActivity({
      ...actorFromRequest(req),
      entityType: "order",
      entityId: Number(req.params.id),
      action: "order_status_updated",
      message: `Đã cập nhật đơn hàng #DH${String(req.params.id).padStart(4, "0")} sang trạng thái ${getOrderStatusLabel(data.status)}.`,
      metadata: { status: data.status, trackingCode: data.trackingCode || "" },
    });

    return res.json({ message: "Da cap nhat trang thai don hang." });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/payout", requireAuth, requireRole("staff", "admin"), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.execute(
      "SELECT order_id, order_status FROM orders WHERE order_id = ? FOR UPDATE",
      [req.params.id],
    );

    const order = orders[0];
    if (!order || order.order_status !== "completed") {
      await connection.rollback();
      return res.status(409).json({ message: "Don hang chua du dieu kien giai ngan." });
    }

    const [items] = await connection.execute(
      `SELECT oi.item_id, oi.price_snapshot, oi.commission_rate, p.seller_id
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?`,
      [req.params.id],
    );

    for (const item of items) {
      const [existing] = await connection.execute("SELECT disbursement_id FROM disbursements WHERE order_item_id = ?", [item.item_id]);
      if (existing.length) continue;

      const grossAmount = Number(item.price_snapshot);
      const commissionAmount = Math.round((grossAmount * Number(item.commission_rate || 20)) / 100);
      const netAmount = grossAmount - commissionAmount;

      await connection.execute(
        `INSERT INTO disbursements
         (order_item_id, seller_id, price_snapshot, commission_rate, commission_amount, net_amount, status, disbursed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'success', NOW(), NOW())`,
        [item.item_id, item.seller_id, grossAmount, item.commission_rate || 20, commissionAmount, netAmount],
      );
    }

    await connection.commit();
    await logActivity({
      ...actorFromRequest(req),
      entityType: "order",
      entityId: Number(req.params.id),
      action: "order_payout_created",
      message: `Đã giải ngân cho đơn hàng #DH${String(req.params.id).padStart(4, "0")}.`,
    });

    return res.status(201).json({ message: "Da giai ngan cho nguoi ban." });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

async function buildOrderQuote(connection, data, options = {}) {
  const productIds = [...new Set(data.items.map((item) => item.productId))];
  const lockClause = options.lockProducts ? " FOR UPDATE" : "";
  const [products] = await connection.query(
    `SELECT product_id, final_price, sell_status, commission_rate
     FROM products
     WHERE product_id IN (?)${lockClause}`,
    [productIds],
  );

  if (products.length !== productIds.length || products.some((product) => product.sell_status !== "on_sale")) {
    throw httpError(409, "Mot so san pham khong con san sang de dat hang.");
  }

  const productById = new Map(products.map((product) => [product.product_id, product]));
  const subtotal = data.items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return sum + Number(product.final_price) * item.quantity;
  }, 0);
  const shippingFee = subtotal >= 400000 ? 0 : 30000;
  const voucher = await resolveVoucher(connection, data.voucherCode, subtotal);
  const discountAmount = voucher ? calculateDiscount(subtotal, voucher) : 0;
  const total = Math.max(0, subtotal - discountAmount) + shippingFee;

  return {
    subtotal,
    shippingFee,
    discountAmount,
    discountedSubtotal: Math.max(0, subtotal - discountAmount),
    total,
    voucher: voucher ? {
      code: voucher.code,
      discountType: voucher.discount_type,
      discountValue: Number(voucher.discount_value),
    } : null,
    productById,
  };
}

async function resolveVoucher(connection, voucherCode, subtotal) {
  const code = String(voucherCode || "").trim().toUpperCase();
  if (!code) return null;

  const [vouchers] = await connection.execute(
    `SELECT voucher_id,
            code,
            discount_type,
            discount_value,
            min_order_value
     FROM vouchers
     WHERE code = ?
       AND status = 'active'
       AND start_date <= NOW()
       AND end_date >= NOW()
     LIMIT 1`,
    [code],
  );

  const voucher = vouchers[0];
  if (!voucher) {
    throw httpError(400, "Ma voucher khong hop le hoac da het han.");
  }

  if (subtotal < Number(voucher.min_order_value || 0)) {
    throw httpError(400, `Don hang chua dat gia tri toi thieu ${Number(voucher.min_order_value).toLocaleString("vi-VN")}d de dung voucher.`);
  }

  return voucher;
}

function calculateDiscount(subtotal, voucher) {
  const discountValue = Number(voucher.discount_value || 0);
  const rawDiscount = voucher.discount_type === "percent"
    ? Math.round((subtotal * discountValue) / 100)
    : discountValue;
  return Math.min(subtotal, Math.max(0, rawDiscount));
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getOrderStatusLabel(status) {
  const labels = {
    pending_payment: "chờ thanh toán",
    pending_confirmation: "chờ xác nhận",
    paid: "đã thanh toán",
    confirmed: "đang xử lý",
    shipping: "đang giao hàng",
    completed: "hoàn thành",
    cancelled: "đã hủy",
    return_requested: "yêu cầu trả hàng",
    refunded: "đã hoàn tiền",
  };
  return labels[status] || status;
}

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default router;
