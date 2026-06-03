import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const createSchema = z.object({
  productName: z.string().min(2),
  categoryId: z.number().int().positive(),
  brand: z.string().optional().default(""),
  conditionNote: z.string().min(5),
  expectedPrice: z.number().nonnegative(),
  sendMethod: z.enum(["drop_off", "pickup", "shipping"]),
  imageUrl: z.string().url().optional().or(z.literal("")).default(""),
});

const statusMap = {
  pending_review: { item: "pending", request: "pending" },
  approved: { item: "accepted", request: "approved" },
  rejected: { item: "rejected", request: "rejected" },
  received: { item: "processing", request: "processing" },
  inspecting: { item: "processing", request: "processing" },
  priced: { item: "waiting_confirm", request: "processing" },
  seller_confirmed: { item: "confirmed", request: "processing" },
  listed: { item: "confirmed", request: "completed" },
  sold: { item: "confirmed", request: "completed" },
  expired: { item: "waiting_return", request: "waiting_return" },
  returned: { item: "returned", request: "returned" },
};

const itemToUiStatus = {
  pending: "pending_review",
  accepted: "approved",
  rejected: "rejected",
  processing: "received",
  waiting_confirm: "priced",
  confirmed: "seller_confirmed",
  seller_rejected: "rejected",
  waiting_return: "expired",
  returned: "returned",
  cancelled: "returned",
};

function sendMethodToDb(method) {
  return method === "shipping" ? "shipping" : "self_deliver";
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const staffQuery = ["staff", "admin"].includes(req.user.role) ? "" : "AND cr.seller_id = :userId";
    const rows = await query(
      `SELECT ci.consignment_item_id AS id,
              cr.request_id,
              cr.seller_id,
              u.full_name AS seller_name,
              c.name AS category_name,
              ci.product_name,
              ci.brand,
              ci.description AS condition_note,
              ci.estimated_price AS expected_price,
              ci.seller_price AS final_price,
              ci.images,
              ci.status AS item_status,
              ci.created_at
       FROM consignment_items ci
       JOIN consignment_requests cr ON cr.request_id = ci.request_id
       JOIN users u ON u.user_id = cr.seller_id
       LEFT JOIN categories c ON c.category_id = ci.category_id
       WHERE 1 = 1 ${staffQuery}
       ORDER BY ci.created_at DESC`,
      { userId: req.user.id },
    );

    return res.json(
      rows.map((row) => ({
        ...row,
        status: itemToUiStatus[row.item_status] || row.item_status,
      })),
    );
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const data = createSchema.parse(req.body);
    await connection.beginTransaction();

    const [requestResult] = await connection.execute(
      `INSERT INTO consignment_requests (seller_id, send_method, status, note, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, NOW(), NOW())`,
      [req.user.id, sendMethodToDb(data.sendMethod), data.conditionNote],
    );

    await connection.execute(
      `INSERT INTO consignment_items
       (request_id, category_id, product_name, brand, condition_level, description, estimated_price, images, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'good', ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        requestResult.insertId,
        data.categoryId,
        data.productName,
        data.brand,
        data.conditionNote,
        data.expectedPrice,
        JSON.stringify(data.imageUrl ? [data.imageUrl] : []),
      ],
    );

    await connection.commit();

    return res.status(201).json({
      id: requestResult.insertId,
      status: "pending_review",
      message: "Da tao yeu cau ky gui.",
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.patch("/:id/status", requireAuth, requireRole("staff", "admin"), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const schema = z.object({
      status: z.enum(Object.keys(statusMap)),
      staffNote: z.string().optional().default(""),
      finalPrice: z.number().nonnegative().optional(),
    });
    const data = schema.parse(req.body);
    const mapped = statusMap[data.status];

    await connection.beginTransaction();
    await connection.execute(
      `UPDATE consignment_items
       SET status = ?,
           seller_price = COALESCE(?, seller_price),
           updated_at = NOW()
       WHERE consignment_item_id = ?`,
      [mapped.item, data.finalPrice ?? null, req.params.id],
    );
    await connection.execute(
      `UPDATE consignment_requests cr
       JOIN consignment_items ci ON ci.request_id = cr.request_id
       SET cr.status = ?,
           cr.note = COALESCE(NULLIF(?, ''), cr.note),
           cr.updated_at = NOW()
       WHERE ci.consignment_item_id = ?`,
      [mapped.request, data.staffNote, req.params.id],
    );
    await connection.commit();

    return res.json({ message: "Da cap nhat trang thai ky gui." });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.patch("/:id/confirm", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE consignment_items ci
       JOIN consignment_requests cr ON cr.request_id = ci.request_id
       SET ci.status = 'confirmed',
           ci.updated_at = NOW()
       WHERE ci.consignment_item_id = :id
         AND cr.seller_id = :sellerId
         AND ci.status = 'waiting_confirm'
         AND ci.seller_price IS NOT NULL`,
      { id: req.params.id, sellerId: req.user.id },
    );

    if (!result.affectedRows) {
      return res.status(409).json({ message: "Yeu cau ky gui chua du dieu kien xac nhan." });
    }

    return res.json({ message: "Da xac nhan ky gui sau dinh gia." });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/publish", requireAuth, requireRole("staff", "admin"), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [items] = await connection.execute(
      `SELECT ci.*, cr.seller_id
       FROM consignment_items ci
       JOIN consignment_requests cr ON cr.request_id = ci.request_id
       WHERE ci.consignment_item_id = ?
         AND ci.status = 'confirmed'
         AND ci.seller_price IS NOT NULL
       FOR UPDATE`,
      [req.params.id],
    );

    const item = items[0];
    if (!item) {
      await connection.rollback();
      return res.status(409).json({ message: "Yeu cau ky gui chua duoc nguoi ban xac nhan." });
    }

    const [productResult] = await connection.execute(
      `INSERT INTO products
       (consignment_item_id, seller_id, category_id, product_name, brand, condition_level, description, images, final_price, commission_rate, display_status, sell_status, consign_start_date, consign_end_date, created_at, updated_at)
       VALUES (?, ?, COALESCE(?, 1), ?, ?, ?, ?, ?, ?, 20, 'visible', 'on_sale', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 45 DAY), NOW(), NOW())`,
      [
        item.consignment_item_id,
        item.seller_id,
        item.category_id,
        item.product_name,
        item.brand,
        item.condition_level,
        item.description,
        item.images,
        item.seller_price,
      ],
    );

    await connection.execute(
      `UPDATE consignment_requests cr
       JOIN consignment_items ci ON ci.request_id = cr.request_id
       SET cr.status = 'completed', cr.updated_at = NOW()
       WHERE ci.consignment_item_id = ?`,
      [item.consignment_item_id],
    );
    await connection.commit();

    return res.status(201).json({
      productId: productResult.insertId,
      message: "Da dang ban san pham ky gui.",
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

export default router;
