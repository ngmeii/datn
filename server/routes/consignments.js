import { Router } from "express";
import { z } from "zod";
import { actorFromRequest, logActivity } from "../activityLog.js";
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
  seller_rejected: "seller_cancelled",
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
              p.product_id,
              p.sell_status,
              ci.created_at,
              ci.updated_at
       FROM consignment_items ci
       JOIN consignment_requests cr ON cr.request_id = ci.request_id
       JOIN users u ON u.user_id = cr.seller_id
       LEFT JOIN categories c ON c.category_id = ci.category_id
       LEFT JOIN products p ON p.consignment_item_id = ci.consignment_item_id
       WHERE 1 = 1 ${staffQuery}
       ORDER BY ci.created_at DESC`,
      { userId: req.user.id },
    );

    return res.json(
      rows.map((row) => ({
        ...row,
        status: productStatusToUiStatus(row) || itemToUiStatus[row.item_status] || row.item_status,
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

    const [itemResult] = await connection.execute(
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
    await logActivity({
      ...actorFromRequest(req),
      entityType: "consignment",
      entityId: itemResult.insertId,
      action: "consignment_created",
      message: `Đã tạo yêu cầu ký gửi #KG${String(itemResult.insertId).padStart(4, "0")}: ${data.productName}.`,
      metadata: { requestId: requestResult.insertId, productName: data.productName },
    });

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
    await logActivity({
      ...actorFromRequest(req),
      entityType: "consignment",
      entityId: Number(req.params.id),
      action: `consignment_${data.status}`,
      message: getConsignmentStatusActivityMessage(req.params.id, data.status, data.finalPrice),
      metadata: { status: data.status, finalPrice: data.finalPrice ?? null },
    });

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

    await logActivity({
      ...actorFromRequest(req),
      entityType: "consignment",
      entityId: Number(req.params.id),
      action: "seller_confirmed",
      message: `Người bán đã xác nhận ký gửi #KG${String(req.params.id).padStart(4, "0")}.`,
    });

    return res.json({ message: "Da xac nhan ky gui sau dinh gia." });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE consignment_items ci
       JOIN consignment_requests cr ON cr.request_id = ci.request_id
       SET ci.status = 'seller_rejected',
           ci.updated_at = NOW(),
           cr.status = 'cancelled',
           cr.cancel_reason = COALESCE(NULLIF(:reason, ''), cr.cancel_reason),
           cr.cancelled_at = NOW(),
           cr.updated_at = NOW()
       WHERE ci.consignment_item_id = :id
         AND cr.seller_id = :sellerId
         AND ci.status = 'waiting_confirm'
         AND NOT EXISTS (
           SELECT 1
           FROM products p
           WHERE p.consignment_item_id = ci.consignment_item_id
         )`,
      { id: req.params.id, sellerId: req.user.id, reason: req.body?.reason || "Nguoi ban huy ky gui sau dinh gia." },
    );

    if (!result.affectedRows) {
      return res.status(409).json({ message: "Yêu cầu ký gửi không còn ở trạng thái có thể hủy." });
    }

    await logActivity({
      ...actorFromRequest(req),
      entityType: "consignment",
      entityId: Number(req.params.id),
      action: "seller_cancelled",
      message: `Người bán đã hủy ký gửi #KG${String(req.params.id).padStart(4, "0")}.`,
      metadata: { reason: req.body?.reason || "" },
    });

    return res.json({ message: "Đã hủy ký gửi." });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/publish", requireAuth, requireRole("staff", "admin"), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [items] = await connection.execute(
      `SELECT ci.consignment_item_id,
              ci.category_id,
              ci.product_name,
              ci.brand,
              ci.condition_level,
              ci.description,
              ci.images,
              ci.seller_price,
              cr.seller_id,
              p.product_id AS existing_product_id
       FROM consignment_items ci
       JOIN consignment_requests cr ON cr.request_id = ci.request_id
       LEFT JOIN products p ON p.consignment_item_id = ci.consignment_item_id
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

    if (item.existing_product_id) {
      await connection.execute(
        `UPDATE consignment_requests cr
         JOIN consignment_items ci ON ci.request_id = cr.request_id
         SET cr.status = 'completed', cr.updated_at = NOW()
         WHERE ci.consignment_item_id = ?`,
        [item.consignment_item_id],
      );
      await connection.commit();
      await logActivity({
        ...actorFromRequest(req),
        entityType: "product",
        entityId: item.existing_product_id,
        action: "product_already_published",
        message: `Sản phẩm #SP${String(item.existing_product_id).padStart(4, "0")} đã được đăng bán trước đó từ #KG${String(item.consignment_item_id).padStart(4, "0")}.`,
        metadata: { consignmentItemId: item.consignment_item_id },
      });

      return res.json({
        productId: item.existing_product_id,
        message: "San pham nay da duoc dang ban.",
      });
    }

    const [productResult] = await connection.execute(
      `INSERT INTO products
       (consignment_item_id, seller_id, category_id, product_name, brand, condition_level, description, images, final_price, commission_rate, display_status, sell_status, consign_start_date, consign_end_date, created_at, updated_at)
       VALUES (?, ?, COALESCE(?, 1), ?, ?, ?, ?, ?, ?, 20, 'visible', 'on_sale', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 45 DAY), NOW(), NOW())
       ON DUPLICATE KEY UPDATE product_id = LAST_INSERT_ID(product_id)`,
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
    await logActivity({
      ...actorFromRequest(req),
      entityType: "product",
      entityId: productResult.insertId,
      action: "product_published",
      message: `Đã đăng bán sản phẩm #SP${String(productResult.insertId).padStart(4, "0")} từ yêu cầu #KG${String(item.consignment_item_id).padStart(4, "0")}.`,
      metadata: { consignmentItemId: item.consignment_item_id, productName: item.product_name },
    });

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

function productStatusToUiStatus(row) {
  if (!row.product_id) return "";
  if (row.sell_status === "sold") return "sold";
  if (row.sell_status === "expired") return "expired";
  if (["on_sale", "reserved", "waiting_list"].includes(row.sell_status)) return "listed";
  if (row.sell_status === "unlisted") return "returned";
  return "";
}

function getConsignmentStatusActivityMessage(id, status, finalPrice) {
  const code = `#KG${String(id).padStart(4, "0")}`;
  const messages = {
    approved: `Đã duyệt yêu cầu ký gửi ${code}.`,
    rejected: `Đã từ chối yêu cầu ký gửi ${code}.`,
    received: `Đã tiếp nhận sản phẩm ký gửi ${code}.`,
    inspecting: `Đã chuyển yêu cầu ký gửi ${code} sang kiểm định.`,
    priced: `Đã định giá yêu cầu ký gửi ${code}${finalPrice != null ? `: ${formatMoney(finalPrice)}` : ""}.`,
    seller_confirmed: `Đã xác nhận người bán đồng ý ký gửi ${code}.`,
    listed: `Đã chuyển yêu cầu ký gửi ${code} sang đang đăng bán.`,
    sold: `Đã ghi nhận yêu cầu ký gửi ${code} đã bán.`,
    expired: `Đã đánh dấu yêu cầu ký gửi ${code} hết hạn.`,
    returned: `Đã hoàn trả yêu cầu ký gửi ${code}.`,
  };
  return messages[status] || `Đã cập nhật trạng thái yêu cầu ký gửi ${code}.`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default router;
