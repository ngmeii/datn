import { Router } from "express";
import { z } from "zod";
import { actorFromRequest, logActivity } from "../activityLog.js";
import { pool, query } from "../db.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { calculateGhnFee, createGhnOrder } from "../services/ghn.js";

const router = Router();

const orderItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
});

const addressSchema = {
  shippingProvince: z.string().trim().min(2).max(100),
  shippingProvinceCode: z.coerce.number().int().positive(),
  shippingDistrict: z.string().trim().min(2).max(100),
  shippingDistrictId: z.coerce.number().int().positive(),
  shippingWard: z.string().trim().min(2).max(100),
  shippingWardCode: z.string().trim().min(1).max(32),
  shippingStreet: z.string().trim().min(3).max(255),
};

const createSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  receiverName: z.string().trim().min(2).max(150),
  receiverPhone: z.string().trim().regex(/^(?:\+84|0)\d{9,10}$/),
  receiverEmail: z.string().trim().email().max(190),
  ...addressSchema,
  paymentMethod: z.enum(["cod", "bank_transfer", "online"]),
  voucherCode: z.string().optional().default(""),
});

const quoteSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  voucherCode: z.string().optional().default(""),
  shippingDistrictId: z.coerce.number().int().positive().optional(),
  shippingWardCode: z.string().trim().min(1).max(32).optional(),
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
              o.shipping_district,
              o.shipping_ward,
              o.shipping_street,
              CONCAT_WS(', ', o.shipping_street, o.shipping_ward, o.shipping_district, o.shipping_province) AS shipping_address,
              od.ghn_order_code,
              od.estimated_delivery,
              od.status AS delivery_status,
              o.created_at,
              COALESCE(u.full_name, o.receiver_name) AS buyer_name
       FROM orders o
       LEFT JOIN users u ON u.user_id = o.buyer_id
       LEFT JOIN order_deliveries od ON od.order_id = o.order_id
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
              o.shipping_district,
              o.shipping_ward,
              o.shipping_street,
              CONCAT_WS(', ', o.shipping_street, o.shipping_ward, o.shipping_district, o.shipping_province) AS shipping_address,
              od.ghn_order_code,
              od.estimated_delivery,
              od.actual_delivery,
              od.status AS delivery_status,
              od.fee AS delivery_fee,
              o.created_at
       FROM orders o
       LEFT JOIN order_deliveries od ON od.order_id = o.order_id
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
      return res.status(404).json({ message: "Không tìm th?y don hàng." });
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
    const { productById: _productById, shippingItems: _shippingItems, ...publicQuote } = quote;
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, NOW(), NOW())`,
      [
        req.user?.id || null,
        data.receiverName,
        data.receiverPhone,
        data.receiverEmail,
        data.shippingProvince,
        data.shippingDistrict,
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
      await connection.execute(
        "UPDATE products SET sell_status = 'reserved', updated_at = NOW() WHERE product_id = ?",
        [item.productId],
      );
    }

    const orderCode = `DH${String(orderResult.insertId).padStart(6, "0")}`;
    const ghnOrder = await createGhnOrder({
      orderCode,
      receiverName: data.receiverName,
      receiverPhone: data.receiverPhone,
      shippingStreet: data.shippingStreet,
      shippingWard: data.shippingWard,
      wardCode: data.shippingWardCode,
      shippingDistrict: data.shippingDistrict,
      districtId: data.shippingDistrictId,
      shippingProvince: data.shippingProvince,
      codAmount: data.paymentMethod === "cod" ? quote.total : 0,
      insuranceValue: quote.subtotal,
      items: quote.shippingItems,
    });

    await upsertOrderDelivery(connection, {
      orderId: orderResult.insertId,
      ghnOrderCode: ghnOrder.orderCode,
      estimatedDelivery: ghnOrder.expectedDeliveryTime,
      fee: quote.shippingFee,
      status: "pending",
    });

    await connection.commit();
    await logActivity({
      ...actorFromRequest(req),
      entityType: "order",
      entityId: orderResult.insertId,
      action: "order_created",
      message: `Đã tạo đơn hàng #${orderCode} với tổng thanh toán ${formatMoney(quote.total)}.`,
      metadata: {
        total: quote.total,
        status: orderToUiStatus[orderStatus],
        ghnOrderCode: ghnOrder.orderCode,
      },
    });

    return res.status(201).json({
      id: orderResult.insertId,
      status: orderToUiStatus[orderStatus],
      subtotal: quote.subtotal,
      shippingFee: quote.shippingFee,
      discountAmount: quote.discountAmount,
      total: quote.total,
      voucher: quote.voucher,
      ghnOrderCode: ghnOrder.orderCode,
      estimatedDelivery: ghnOrder.expectedDeliveryTime,
      message: "Đã tạo đơn hàng.",
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

    if (data.status === "shipping") {
      await query(
        `UPDATE order_deliveries
         SET status = 'shipping',
             ghn_order_code = COALESCE(NULLIF(:trackingCode, ''), ghn_order_code),
             updated_at = NOW()
         WHERE order_id = :id`,
        { id: req.params.id, trackingCode: data.trackingCode || "" },
      );
    }

    if (data.status === "completed") {
      await query(
        `UPDATE products p
         JOIN order_items oi ON oi.product_id = p.product_id
         SET p.sell_status = 'sold', p.updated_at = NOW()
         WHERE oi.order_id = :id`,
        { id: req.params.id },
      );
      await query(
        `UPDATE order_deliveries
         SET status = 'delivered',
             actual_delivery = NOW(),
             updated_at = NOW()
         WHERE order_id = :id`,
        { id: req.params.id },
      );
      await createPendingDisbursements(req.params.id);
    }

    await logActivity({
      ...actorFromRequest(req),
      entityType: "order",
      entityId: Number(req.params.id),
      action: "order_status_updated",
      message: `Ðã c?p nh?t don hàng #DH${String(req.params.id).padStart(4, "0")} sang tr?ng thái ${getOrderStatusLabel(data.status)}.`,
      metadata: { status: data.status, trackingCode: data.trackingCode || "" },
    });

    return res.json({ message: "Ðã c?p nh?t tr?ng thái don hàng." });
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
      return res.status(409).json({ message: "Đơn hàng chưa đủ điều kiện giải ngân." });
    }

    const [items] = await connection.execute(
      `SELECT oi.item_id, oi.price_snapshot, oi.commission_rate, p.seller_id
       FROM order_items oi
       JOIN products p ON p.product_id = oi.product_id
       WHERE oi.order_id = ?`,
      [req.params.id],
    );

    for (const item of items) {
      const [existing] = await connection.execute(
        "SELECT disbursement_id, status FROM disbursements WHERE order_item_id = ?",
        [item.item_id],
      );

      const grossAmount = Number(item.price_snapshot);
      const commissionAmount = Math.round((grossAmount * Number(item.commission_rate || 20)) / 100);
      const netAmount = grossAmount - commissionAmount;

      if (existing.length) {
        if (existing[0].status !== "success") {
          await connection.execute(
            `UPDATE disbursements
             SET price_snapshot = ?,
                 commission_rate = ?,
                 commission_amount = ?,
                 net_amount = ?,
                 status = 'success',
                 disbursed_at = NOW()
             WHERE disbursement_id = ?`,
            [grossAmount, item.commission_rate || 20, commissionAmount, netAmount, existing[0].disbursement_id],
          );
        }
        continue;
      }

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
      message: `Ðã gi?i ngân cho don hàng #DH${String(req.params.id).padStart(4, "0")}.`,
    });

    return res.status(201).json({ message: "Ðã gi?i ngân cho ngu?i bán." });
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
    `SELECT product_id, product_name, final_price, sell_status, commission_rate
     FROM products
     WHERE product_id IN (?)${lockClause}`,
    [productIds],
  );

  if (products.length !== productIds.length || products.some((product) => product.sell_status !== "on_sale")) {
    throw httpError(409, "M?t s? s?n ph?m không còn s?n sàng d? d?t hàng.");
  }

  const productById = new Map(products.map((product) => [product.product_id, product]));
  const shippingItems = data.items.map((item) => {
    const product = productById.get(item.productId);
    return {
      productId: item.productId,
      name: product.product_name,
      quantity: Number(item.quantity || 1),
      price: Number(product.final_price || 0),
    };
  });

  const subtotal = shippingItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const voucher = await resolveVoucher(connection, data.voucherCode, subtotal);
  const discountAmount = voucher ? calculateDiscount(subtotal, voucher) : 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  let shippingFee = 0;
  let shippingReady = false;

  if (data.shippingDistrictId && data.shippingWardCode) {
    try {
      const ghnFee = await calculateGhnFee({
        districtId: data.shippingDistrictId,
        wardCode: data.shippingWardCode,
        insuranceValue: subtotal,
        items: shippingItems,
      });
      shippingFee = Number(ghnFee.shippingFee || 0);
      shippingReady = true;
    } catch (error) {
      console.warn("GHN fee unavailable, using fallback shipping fee:", error.message);
      shippingFee = estimateFallbackShippingFee(data.shippingDistrictId, shippingItems);
      shippingReady = false;
    }
  }

  const total = discountedSubtotal + shippingFee;

  return {
    subtotal,
    shippingFee,
    shippingReady,
    discountAmount,
    discountedSubtotal,
    total,
    voucher: voucher
      ? {
          code: voucher.code,
          discountType: voucher.discount_type,
          discountValue: Number(voucher.discount_value),
        }
      : null,
    productById,
    shippingItems,
  };
}

async function createPendingDisbursements(orderId) {
  await query(
    `INSERT INTO disbursements
     (order_item_id, seller_id, price_snapshot, commission_rate, commission_amount, net_amount, status, created_at)
     SELECT oi.item_id,
            p.seller_id,
            oi.price_snapshot,
            oi.commission_rate,
            ROUND(oi.price_snapshot * COALESCE(oi.commission_rate, 20) / 100),
            oi.price_snapshot - ROUND(oi.price_snapshot * COALESCE(oi.commission_rate, 20) / 100),
            'pending',
            NOW()
     FROM order_items oi
     JOIN products p ON p.product_id = oi.product_id
     WHERE oi.order_id = :orderId
     ON DUPLICATE KEY UPDATE disbursement_id = disbursement_id`,
    { orderId },
  );
}

async function resolveVoucher(connection, voucherCode, subtotal) {
  const code = String(voucherCode || "").trim().toUpperCase();
  if (!code) return null;

  const [vouchers] = await connection.execute(
    `SELECT voucher_id,
            code,
            discount_type,
            discount_value,
            min_order_value,
            max_discount
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
    throw httpError(400, "Mã voucher không hợp lệ hoặc đã hết hạn.");
  }

  if (subtotal < Number(voucher.min_order_value || 0)) {
    throw httpError(400, `Đơn hàng chưa đạt giá trị tối thiểu ${Number(voucher.min_order_value).toLocaleString("vi-VN")}đ để dùng voucher.`);
  }

  return voucher;
}

async function upsertOrderDelivery(connection, { orderId, ghnOrderCode, estimatedDelivery, fee, status }) {
  await connection.execute(
    `INSERT INTO order_deliveries (order_id, ghn_order_code, estimated_delivery, fee, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       ghn_order_code = VALUES(ghn_order_code),
       estimated_delivery = VALUES(estimated_delivery),
       fee = VALUES(fee),
       status = VALUES(status),
       updated_at = NOW()`,
    [orderId, ghnOrderCode || null, normalizeEstimatedDate(estimatedDelivery), Math.round(Number(fee || 0)), status],
  );
}

function normalizeEstimatedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calculateDiscount(subtotal, voucher) {
  const discountValue = Number(voucher.discount_value || 0);
  const rawDiscount = voucher.discount_type === "percent"
    ? Math.round((subtotal * discountValue) / 100)
    : discountValue;
  const maxDiscount = Number(voucher.max_discount || 0);
  const cappedDiscount = maxDiscount > 0 ? Math.min(rawDiscount, maxDiscount) : rawDiscount;
  return Math.min(subtotal, Math.max(0, cappedDiscount));
}

function estimateFallbackShippingFee(districtId, items = []) {
  const totalQuantity = Math.max(1, items.reduce((sum, item) => sum + Number(item.quantity || 1), 0));
  const weightFee = Math.max(0, totalQuantity - 1) * 4000;
  const distanceFee = Number(districtId || 0) % 2 === 0 ? 8000 : 12000;
  return 22000 + distanceFee + weightFee;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getOrderStatusLabel(status) {
  const labels = {
    pending_payment: "ch? thanh toán",
    pending_confirmation: "ch? xác nh?n",
    paid: "dã thanh toán",
    confirmed: "dang x? lý",
    shipping: "dang giao hàng",
    completed: "hoàn thành",
    cancelled: "đã hủy",
    return_requested: "yêu c?u tr? hàng",
    refunded: "dã hoàn ti?n",
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


