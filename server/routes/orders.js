import { Router } from "express";
import { z } from "zod";
import { query, pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const createSchema = z.object({
  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().positive().default(1),
    }),
  ).min(1),
  shippingAddress: z.string().min(8),
  paymentMethod: z.enum(["cod", "bank_transfer", "online"]),
  voucherCode: z.string().optional().default(""),
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
              o.shipping_street AS shipping_address,
              o.created_at,
              u.full_name AS buyer_name
       FROM orders o
       JOIN users u ON u.user_id = o.buyer_id
       ${staffQuery}
       ORDER BY o.created_at DESC`,
      { userId: req.user.id },
    );

    return res.json(rows.map((row) => ({ ...row, status: orderToUiStatus[row.order_status] || row.order_status })));
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const data = createSchema.parse(req.body);
    await connection.beginTransaction();

    const productIds = data.items.map((item) => item.productId);
    const [products] = await connection.query(
      `SELECT product_id, final_price, sell_status, commission_rate
       FROM products
       WHERE product_id IN (?)
       FOR UPDATE`,
      [productIds],
    );

    if (products.length !== productIds.length || products.some((product) => product.sell_status !== "on_sale")) {
      await connection.rollback();
      return res.status(409).json({ message: "Mot so san pham khong con san sang de dat hang." });
    }

    const productById = new Map(products.map((product) => [product.product_id, product]));
    const subtotal = data.items.reduce((sum, item) => sum + Number(productById.get(item.productId).final_price) * item.quantity, 0);
    const shippingFee = subtotal >= 400000 ? 0 : 30000;
    const total = subtotal + shippingFee;
    const orderStatus = data.paymentMethod === "cod" ? "waiting_confirm" : "waiting_payment";

    const [orderResult] = await connection.execute(
      `INSERT INTO orders
       (buyer_id, receiver_name, receiver_phone, shipping_province, shipping_district, shipping_ward, shipping_street, subtotal_amount, shipping_fee, discount_amount, total_amount, payment_method, payment_status, order_status, created_at, updated_at)
       VALUES (?, ?, ?, '', '', '', ?, ?, ?, 0, ?, ?, 'unpaid', ?, NOW(), NOW())`,
      [req.user.id, "Khach hang", "", data.shippingAddress, subtotal, shippingFee, total, data.paymentMethod, orderStatus],
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
    return res.status(201).json({
      id: orderResult.insertId,
      status: orderToUiStatus[orderStatus],
      subtotal,
      shippingFee,
      total,
      message: "Da tao don hang.",
    });
  } catch (error) {
    await connection.rollback();
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
    return res.status(201).json({ message: "Da giai ngan cho nguoi ban." });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

export default router;
