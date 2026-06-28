import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { actorFromRequest, logActivity } from "../activityLog.js";
import { pool, query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { calculateGhnFeeToShop, createGhnConsignmentOrder } from "../services/ghn.js";

const router = Router();
const imageReferenceSchema = z.string().max(600).refine(
  (value) => !value || /^https?:\/\//i.test(value) || value.startsWith("/api/uploads/"),
  "Đường dẫn ảnh không hợp lệ.",
);
const conditionLevelSchema = z.enum(["new", "like_new", "good", "fair", "poor"]);
const conditionNoteSchema = z.string().trim().min(5, "cần tối thiểu 5 ký tự.");
const shippingStatusValues = ["pending", "picked_up", "shipping", "delivered", "received", "failed", "returned"];

const consignmentItemSchema = z.object({
  productName: z.string().trim().min(2),
  categoryId: z.coerce.number().int().positive(),
  brand: z.string().trim().optional().default(""),
  conditionLevel: conditionLevelSchema.optional().default("good"),
  conditionNote: conditionNoteSchema,
  expectedPrice: z.coerce.number().nonnegative(),
  imageUrl: imageReferenceSchema.optional().default(""),
});

const createSchema = z.object({
  items: z.array(consignmentItemSchema).min(1).max(10).optional(),
  productName: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  brand: z.string().trim().optional().default(""),
  conditionLevel: conditionLevelSchema.optional().default("good"),
  conditionNote: conditionNoteSchema.optional(),
  expectedPrice: z.coerce.number().nonnegative().optional(),
  sendMethod: z.enum(["drop_off", "pickup", "shipping"]),
  imageUrl: imageReferenceSchema.optional().default(""),
  senderName: z.string().trim().optional().default(""),
  senderPhone: z.string().trim().optional().default(""),
  senderProvince: z.string().trim().optional().default(""),
  senderProvinceCode: z.coerce.number().int().positive().optional(),
  senderDistrict: z.string().trim().optional().default(""),
  senderDistrictId: z.coerce.number().int().positive().optional(),
  senderWard: z.string().trim().optional().default(""),
  senderWardCode: z.string().trim().optional().default(""),
  senderStreet: z.string().trim().optional().default(""),
}).superRefine((data, ctx) => {
  if (!data.items?.length) {
    const singleItem = consignmentItemSchema.safeParse({
      productName: data.productName,
      categoryId: data.categoryId,
      brand: data.brand,
      conditionLevel: data.conditionLevel,
      conditionNote: data.conditionNote,
      expectedPrice: data.expectedPrice,
      imageUrl: data.imageUrl,
    });

    if (!singleItem.success) {
      for (const issue of singleItem.error.issues) {
        ctx.addIssue(issue);
      }
    }
  }

  if (data.sendMethod !== "shipping") return;

  const requiredFields = [
    ["senderName", data.senderName],
    ["senderPhone", data.senderPhone],
    ["senderProvince", data.senderProvince],
    ["senderProvinceCode", data.senderProvinceCode],
    ["senderDistrict", data.senderDistrict],
    ["senderDistrictId", data.senderDistrictId],
    ["senderWard", data.senderWard],
    ["senderWardCode", data.senderWardCode],
    ["senderStreet", data.senderStreet],
  ];

  for (const [path, value] of requiredFields) {
    if (!value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: "Thiếu thông tin gửi hàng ký gửi.",
      });
    }
  }
}).transform((data) => ({
  ...data,
  items: data.items?.length
    ? data.items
    : [
        {
          productName: data.productName,
          categoryId: data.categoryId,
          brand: data.brand,
          conditionLevel: data.conditionLevel,
          conditionNote: data.conditionNote,
          expectedPrice: data.expectedPrice,
          imageUrl: data.imageUrl,
        },
      ],
}));

const walkInSchema = z.object({
  customerName: z.string().trim().min(2),
  customerEmail: z.string().trim().email(),
  customerPhone: z.string().trim().min(9).max(20),
  productName: z.string().trim().min(2),
  categoryId: z.number().int().positive(),
  brand: z.string().trim().optional().default(""),
  conditionLevel: conditionLevelSchema,
  conditionNote: conditionNoteSchema,
  expectedPrice: z.number().nonnegative(),
  imageUrl: imageReferenceSchema.optional().default(""),
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
              cr.send_method,
              so.shipping_order_id,
              so.ghn_order_code,
              so.sender_name,
              so.sender_phone,
              so.sender_address,
              so.fee AS shipping_fee,
              so.status AS shipment_status,
              so.expected_delivery,
              so.delivered_at,
              so.received_at,
              so.created_at AS shipping_created_at,
              p.product_id,
              p.sell_status,
              ci.created_at,
              ci.updated_at
       FROM consignment_items ci
       JOIN consignment_requests cr ON cr.request_id = ci.request_id
       JOIN users u ON u.user_id = cr.seller_id
       LEFT JOIN categories c ON c.category_id = ci.category_id
       LEFT JOIN shipping_orders so ON so.request_id = cr.request_id
       LEFT JOIN products p ON p.consignment_item_id = ci.consignment_item_id
       WHERE 1 = 1 ${staffQuery}
       ORDER BY ci.created_at DESC`,
      { userId: req.user.id },
    );

    return res.json(
      rows.map((row) => ({
        ...row,
        shipping: buildShippingInfo(row),
        status: getVisibleConsignmentStatus(row),
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

    const itemNames = data.items.map((item) => item.productName).join(", ");
    const requestNote = data.items.length === 1
      ? data.items[0].conditionNote
      : `Ký gửi ${data.items.length} sản phẩm: ${itemNames}`;

    const [requestResult] = await connection.execute(
      `INSERT INTO consignment_requests (seller_id, send_method, status, note, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, NOW(), NOW())`,
      [req.user.id, sendMethodToDb(data.sendMethod), requestNote],
    );

    const createdItems = [];
    for (const item of data.items) {
      const [itemResult] = await connection.execute(
        `INSERT INTO consignment_items
         (request_id, category_id, product_name, brand, condition_level, description, estimated_price, images, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [
          requestResult.insertId,
          item.categoryId,
          item.productName,
          item.brand,
          item.conditionLevel,
          item.conditionNote,
          item.expectedPrice,
          JSON.stringify(item.imageUrl ? [item.imageUrl] : []),
        ],
      );
      createdItems.push({ ...item, id: itemResult.insertId });
    }

    const totalEstimatedPrice = createdItems.reduce((sum, item) => sum + Number(item.expectedPrice || 0), 0);
    let shippingOrder = null;
    let shippingFee = 0;
    if (data.sendMethod === "shipping") {
      const requestCode = `KG${String(requestResult.insertId).padStart(6, "0")}`;
      const shippingItems = createdItems.map((item) => ({
        code: String(item.id),
        name: item.productName,
        quantity: 1,
        price: item.expectedPrice,
      }));
      const ghnFee = await calculateGhnFeeToShop({
        districtId: data.senderDistrictId,
        wardCode: data.senderWardCode,
        insuranceValue: totalEstimatedPrice,
        items: shippingItems,
      });

      shippingOrder = await createGhnConsignmentOrder({
        requestCode,
        senderName: data.senderName,
        senderPhone: data.senderPhone,
        senderAddress: data.senderStreet,
        senderWard: data.senderWard,
        senderWardCode: data.senderWardCode,
        senderDistrict: data.senderDistrict,
        senderDistrictId: data.senderDistrictId,
        senderProvince: data.senderProvince,
        insuranceValue: totalEstimatedPrice,
        items: shippingItems,
      });
      shippingFee = shippingOrder.fee || ghnFee.shippingFee || 0;

      await connection.execute(
        `INSERT INTO shipping_orders
         (request_id, ghn_order_code, sender_name, sender_phone, sender_address, fee, status, expected_delivery, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           ghn_order_code = VALUES(ghn_order_code),
           sender_name = VALUES(sender_name),
           sender_phone = VALUES(sender_phone),
           sender_address = VALUES(sender_address),
           fee = VALUES(fee),
           status = VALUES(status),
           expected_delivery = VALUES(expected_delivery),
           updated_at = NOW()`,
        [
          requestResult.insertId,
          shippingOrder.orderCode,
          data.senderName,
          data.senderPhone,
          [data.senderStreet, data.senderWard, data.senderDistrict, data.senderProvince].filter(Boolean).join(", "),
          shippingFee,
          toMysqlDateTime(shippingOrder.expectedDeliveryTime),
        ],
      );
    }

    await connection.commit();
    await logActivity({
      ...actorFromRequest(req),
      entityType: "consignment",
      entityId: createdItems[0]?.id || requestResult.insertId,
      action: "consignment_created",
      message: `Đã tạo yêu cầu ký gửi #KG${String(requestResult.insertId).padStart(6, "0")} gồm ${createdItems.length} sản phẩm.`,
      metadata: {
        requestId: requestResult.insertId,
        itemIds: createdItems.map((item) => item.id),
        productNames: createdItems.map((item) => item.productName),
        ghnOrderCode: shippingOrder?.orderCode || "",
      },
    });

    return res.status(201).json({
      id: requestResult.insertId,
      itemIds: createdItems.map((item) => item.id),
      itemCount: createdItems.length,
      totalEstimatedPrice,
      status: "pending_review",
      ghnOrderCode: shippingOrder?.orderCode || "",
      shippingFee,
      message: shippingOrder?.orderCode
        ? `Đã tạo yêu cầu ký gửi ${createdItems.length} sản phẩm và mã vận đơn GHN ${shippingOrder.orderCode}.`
        : `Đã tạo yêu cầu ký gửi ${createdItems.length} sản phẩm.`,
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.post("/legacy-single", requireAuth, async (req, res, next) => {
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        requestResult.insertId,
        data.categoryId,
        data.productName,
        data.brand,
        data.conditionLevel,
        data.conditionNote,
        data.expectedPrice,
        JSON.stringify(data.imageUrl ? [data.imageUrl] : []),
      ],
    );
    let shippingOrder = null;
    if (data.sendMethod === "shipping") {
      const requestCode = `KG${String(requestResult.insertId).padStart(6, "0")}`;
      const shippingItems = [
        {
          code: String(itemResult.insertId),
          name: data.productName,
          quantity: 1,
          price: data.expectedPrice,
        },
      ];
      const ghnFee = await calculateGhnFeeToShop({
        districtId: data.senderDistrictId,
        wardCode: data.senderWardCode,
        insuranceValue: data.expectedPrice,
        items: shippingItems,
      });

      shippingOrder = await createGhnConsignmentOrder({
        requestCode,
        senderName: data.senderName,
        senderPhone: data.senderPhone,
        senderAddress: data.senderStreet,
        senderWard: data.senderWard,
        senderWardCode: data.senderWardCode,
        senderDistrict: data.senderDistrict,
        senderDistrictId: data.senderDistrictId,
        senderProvince: data.senderProvince,
        insuranceValue: data.expectedPrice,
        items: shippingItems,
      });

      await connection.execute(
        `INSERT INTO shipping_orders
         (request_id, ghn_order_code, sender_name, sender_phone, sender_address, fee, status, expected_delivery, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           ghn_order_code = VALUES(ghn_order_code),
           sender_name = VALUES(sender_name),
           sender_phone = VALUES(sender_phone),
           sender_address = VALUES(sender_address),
           fee = VALUES(fee),
           status = VALUES(status),
           expected_delivery = VALUES(expected_delivery),
           updated_at = NOW()`,
        [
          requestResult.insertId,
          shippingOrder.orderCode,
          data.senderName,
          data.senderPhone,
          [data.senderStreet, data.senderWard, data.senderDistrict, data.senderProvince].filter(Boolean).join(", "),
          shippingOrder.fee || ghnFee.shippingFee,
          toMysqlDateTime(shippingOrder.expectedDeliveryTime),
        ],
      );
    }

    await connection.commit();
    await logActivity({
      ...actorFromRequest(req),
      entityType: "consignment",
      entityId: itemResult.insertId,
      action: "consignment_created",
      message: `Đã tạo yêu cầu ký gửi #KG${String(itemResult.insertId).padStart(4, "0")}: ${data.productName}.`,
      metadata: { requestId: requestResult.insertId, productName: data.productName, ghnOrderCode: shippingOrder?.orderCode || "" },
    });

    return res.status(201).json({
      id: requestResult.insertId,
      status: "pending_review",
      ghnOrderCode: shippingOrder?.orderCode || "",
      shippingFee: shippingOrder?.fee || 0,
      message: shippingOrder?.orderCode ? `Đã tạo yêu cầu ký gửi và mã vận đơn GHN ${shippingOrder.orderCode}.` : "Đã tạo yêu cầu ký gửi.",
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.post("/walk-in", requireAuth, requireRole("staff", "admin"), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const data = walkInSchema.parse(req.body);
    await connection.beginTransaction();

    const [matchedUsers] = await connection.execute(
      `SELECT user_id, email, phone, role
       FROM users
       WHERE LOWER(email) = LOWER(?)
          OR phone = ?
       FOR UPDATE`,
      [data.customerEmail, data.customerPhone],
    );

    if (matchedUsers.length > 1) {
      await connection.rollback();
      return res.status(409).json({
        message: "Email và số điện thoại đang thuộc hai tài khoản khác nhau.",
      });
    }

    let sellerId;
    const matchedUser = matchedUsers[0];

    if (matchedUser) {
      if (matchedUser.role !== "customer") {
        await connection.rollback();
        return res.status(409).json({ message: "Thông tin này không thuộc tài khoản khách hàng." });
      }

      sellerId = matchedUser.user_id;
      await connection.execute(
        `UPDATE users
         SET full_name = ?,
             phone = ?,
             updated_at = NOW()
         WHERE user_id = ?`,
        [data.customerName, data.customerPhone, sellerId],
      );
    } else {
      const temporaryPassword = `walk-in-${Date.now()}-${Math.random()}`;
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      const [userResult] = await connection.execute(
        `INSERT INTO users
         (email, password_hash, full_name, phone, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'customer', 'active', NOW(), NOW())`,
        [data.customerEmail.toLowerCase(), passwordHash, data.customerName, data.customerPhone],
      );
      sellerId = userResult.insertId;
    }

    const [requestResult] = await connection.execute(
      `INSERT INTO consignment_requests
       (seller_id, send_method, status, note, created_at, updated_at)
       VALUES (?, 'self_deliver', 'processing', ?, NOW(), NOW())`,
      [sellerId, `Khách mang sản phẩm trực tiếp đến cửa hàng. ${data.conditionNote}`],
    );

    const [itemResult] = await connection.execute(
      `INSERT INTO consignment_items
       (request_id, category_id, product_name, brand, condition_level, description, estimated_price, seller_price, images, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', NOW(), NOW())`,
      [
        requestResult.insertId,
        data.categoryId,
        data.productName,
        data.brand,
        data.conditionLevel,
        data.conditionNote,
        data.expectedPrice,
        data.expectedPrice,
        JSON.stringify(data.imageUrl ? [data.imageUrl] : []),
      ],
    );

    const [productResult] = await connection.execute(
      `INSERT INTO products
       (consignment_item_id, seller_id, category_id, product_name, brand, condition_level, description, images, final_price, commission_rate, display_status, sell_status, consign_start_date, consign_end_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 20, 'visible', 'on_sale', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 45 DAY), NOW(), NOW())`,
      [
        itemResult.insertId,
        sellerId,
        data.categoryId,
        data.productName,
        data.brand,
        data.conditionLevel,
        data.conditionNote,
        JSON.stringify(data.imageUrl ? [data.imageUrl] : []),
        data.expectedPrice,
      ],
    );

    await connection.execute(
      `UPDATE consignment_requests
       SET status = 'completed',
           updated_at = NOW()
       WHERE request_id = ?`,
      [requestResult.insertId],
    );

    await connection.commit();
    await logActivity({
      ...actorFromRequest(req),
      entityType: "consignment",
      entityId: itemResult.insertId,
      action: "walk_in_consignment_created",
      message: `Đã tạo yêu cầu ký gửi tại cửa hàng #KG${String(itemResult.insertId).padStart(4, "0")} và đăng bán ngay sản phẩm ${data.productName}.`,
      metadata: {
        requestId: requestResult.insertId,
        productId: productResult.insertId,
        sellerId,
        customerName: data.customerName,
        productName: data.productName,
      },
    });

    return res.status(201).json({
      id: itemResult.insertId,
      requestId: requestResult.insertId,
      productId: productResult.insertId,
      status: "listed",
      message: "Đã tạo yêu cầu và đăng bán sản phẩm ngay.",
    });
  } catch (error) {
    await connection.rollback();
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email khách hàng đã tồn tại với thông tin khác." });
    }
    return next(error);
  } finally {
    connection.release();
  }
});

router.patch("/staff/consignment-requests/:id/confirm-received", requireAuth, requireRole("staff", "admin"), confirmConsignmentReceived);
router.patch("/staff/consignment-requests/:id/shipping-status", requireAuth, requireRole("staff", "admin"), updateConsignmentShipmentStatus);
router.post("/ghn/webhook", syncConsignmentShipmentFromGhn);

export async function confirmConsignmentReceived(req, res, next) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT ci.consignment_item_id,
              cr.request_id,
              cr.send_method,
              so.shipping_order_id,
              so.status AS shipment_status
       FROM consignment_items ci
       JOIN consignment_requests cr ON cr.request_id = ci.request_id
       LEFT JOIN shipping_orders so ON so.request_id = cr.request_id
       WHERE cr.request_id = ?
          OR ci.consignment_item_id = ?
       ORDER BY cr.request_id ASC
       LIMIT 1
       FOR UPDATE`,
      [req.params.id, req.params.id],
    );

    const item = rows[0];
    if (!item) {
      await connection.rollback();
      return res.status(404).json({ message: "Không tìm thấy yêu cầu ký gửi." });
    }

    if (item.send_method !== "shipping" || !item.shipping_order_id) {
      await connection.rollback();
      return res.status(409).json({ message: "Yêu cầu này không gửi hàng qua GHN." });
    }

    if (!["delivered", "received"].includes(item.shipment_status)) {
      await connection.rollback();
      return res.status(409).json({ message: "GHN chưa giao hàng đến cửa hàng nên chưa thể xác nhận nhận hàng." });
    }

    await connection.execute(
      `UPDATE shipping_orders
       SET status = 'received',
           delivered_at = COALESCE(delivered_at, NOW()),
           received_at = NOW(),
           updated_at = NOW()
       WHERE request_id = ?`,
      [item.request_id],
    );
    await connection.execute(
      `UPDATE consignment_requests
       SET status = 'processing',
           updated_at = NOW()
       WHERE request_id = ?`,
      [item.request_id],
    );

    await connection.commit();
    await logActivity({
      ...actorFromRequest(req),
      entityType: "consignment",
      entityId: item.request_id,
      action: "shipping_received",
      metadata: { requestId: item.request_id },
      message: `Staff đã xác nhận nhận hàng ký gửi #THK${String(item.request_id).padStart(6, "0")}.`,
    });

    return res.json({ message: "Đã xác nhận nhận hàng. Staff có thể xử lý từng sản phẩm trong yêu cầu." });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
}

export async function updateConsignmentShipmentStatus(req, res, next) {
  try {
    const schema = z.object({
      status: z.string().trim(),
      orderCode: z.string().trim().optional().default(""),
      expectedDelivery: z.string().trim().optional().default(""),
      deliveredAt: z.string().trim().optional().default(""),
    });
    const data = schema.parse(req.body || {});
    const shipmentStatus = normalizeShippingStatus(data.status);
    if (!shipmentStatus) {
      return res.status(400).json({ message: "Trạng thái vận chuyển không hợp lệ." });
    }

    const [result] = await updateShipmentStatus({
      itemId: req.params.id,
      status: shipmentStatus,
      orderCode: data.orderCode,
      expectedDelivery: data.expectedDelivery,
      deliveredAt: data.deliveredAt,
    });

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Không tìm thấy vận đơn ký gửi cần cập nhật." });
    }

    await logActivity({
      ...actorFromRequest(req),
      entityType: "consignment",
      entityId: Number(req.params.id),
      action: "shipping_status_updated",
      message: `Đã cập nhật trạng thái vận chuyển ký gửi #KG${String(req.params.id).padStart(4, "0")} sang ${getShippingStatusLabel(shipmentStatus)}.`,
      metadata: { status: shipmentStatus, orderCode: data.orderCode || "" },
    });

    return res.json({ message: `Đã cập nhật vận đơn sang trạng thái ${getShippingStatusLabel(shipmentStatus)}.` });
  } catch (error) {
    return next(error);
  }
}

export async function syncConsignmentShipmentFromGhn(req, res, next) {
  try {
    const configuredSecret = process.env.GHN_WEBHOOK_SECRET || "";
    const providedSecret = req.get("x-ghn-webhook-secret") || req.get("x-webhook-secret") || "";
    if (configuredSecret && providedSecret !== configuredSecret) {
      return res.status(401).json({ message: "Webhook GHN không hợp lệ." });
    }

    const payload = extractGhnShipmentPayload(req.body || {});
    if (!payload.orderCode || !payload.status) {
      return res.status(400).json({ message: "Webhook GHN thiếu mã vận đơn hoặc trạng thái." });
    }

    const shipmentStatus = normalizeShippingStatus(payload.status);
    if (!shipmentStatus) {
      return res.status(400).json({ message: "Trạng thái GHN chưa được hỗ trợ." });
    }

    const [result] = await updateShipmentStatus({
      orderCode: payload.orderCode,
      status: shipmentStatus,
      expectedDelivery: payload.expectedDelivery,
      deliveredAt: payload.deliveredAt,
    });

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Không tìm thấy vận đơn GHN trong hệ thống." });
    }

    await logActivity({
      actorType: "system",
      actorId: null,
      actorName: "GHN Webhook",
      entityType: "consignment_shipping",
      entityId: payload.orderCode,
      action: "ghn_shipping_synced",
      message: `GHN đã đồng bộ vận đơn ${payload.orderCode} sang ${getShippingStatusLabel(shipmentStatus)}.`,
      metadata: { status: shipmentStatus, payload },
    });

    return res.json({ message: "Đã đồng bộ trạng thái vận đơn GHN.", status: shipmentStatus });
  } catch (error) {
    return next(error);
  }
}

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
    const [guardRows] = await connection.execute(
      `SELECT cr.send_method,
              so.status AS shipment_status
       FROM consignment_items ci
       JOIN consignment_requests cr ON cr.request_id = ci.request_id
       LEFT JOIN shipping_orders so ON so.request_id = cr.request_id
       WHERE ci.consignment_item_id = ?
       FOR UPDATE`,
      [req.params.id],
    );

    const guard = guardRows[0];
    if (guard?.send_method === "shipping" && ["approved", "rejected", "received", "inspecting", "priced"].includes(data.status) && guard.shipment_status !== "received") {
      await connection.rollback();
      return res.status(409).json({ message: "Hàng GHN chưa được staff xác nhận nhận tại cửa hàng nên chưa thể xử lý yêu cầu này." });
    }

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

function getVisibleConsignmentStatus(row) {
  const productStatus = productStatusToUiStatus(row);
  if (productStatus) return productStatus;

  if (row.send_method === "shipping" && row.shipping_order_id) {
    if (row.shipment_status === "pending") return "shipping_pending";
    if (["picked_up", "shipping"].includes(row.shipment_status)) return "shipping_in_transit";
    if (row.shipment_status === "delivered") return "shipping_delivered";
    if (row.shipment_status === "received") return itemToUiStatus[row.item_status] || row.item_status;
  }

  return itemToUiStatus[row.item_status] || row.item_status;
}

function buildShippingInfo(row) {
  const isGhn = row.send_method === "shipping" && Boolean(row.shipping_order_id);
  const statusLabels = {
    pending: "Chờ GHN lấy hàng",
    picked_up: "Đang vận chuyển",
    shipping: "Đang vận chuyển",
    delivered: "Đã giao đến cửa hàng",
    received: "Đã nhận hàng",
    failed: "Giao hàng lỗi",
    returned: "Đã hoàn hàng",
  };

  return {
    isGhn,
    method: isGhn ? "GHN" : "self_deliver",
    methodLabel: isGhn ? "Giao hàng qua GHN" : "Tự mang đến cửa hàng",
    orderCode: row.ghn_order_code || "",
    fee: Number(row.shipping_fee || 0),
    status: row.shipment_status || "",
    statusLabel: isGhn ? statusLabels[row.shipment_status] || row.shipment_status || "Chưa tạo vận đơn" : "Tự mang đến cửa hàng",
    senderName: row.sender_name || "",
    senderPhone: row.sender_phone || "",
    senderAddress: row.sender_address || "",
    receiverAddress: process.env.GHN_FROM_ADDRESS || "Số 1 Đại Cồ Việt, Phường Bách Khoa, Quận Hai Bà Trưng, Hà Nội",
    createdAt: row.shipping_created_at || null,
    expectedDelivery: row.expected_delivery || null,
    deliveredAt: row.delivered_at || null,
    receivedAt: row.received_at || null,
    canConfirmReceived: isGhn && row.shipment_status === "delivered",
    canProcess: !isGhn || row.shipment_status === "received",
  };
}

async function updateShipmentStatus({ itemId, orderCode, status, expectedDelivery = "", deliveredAt = "" }) {
  const setDeliveredAt = status === "delivered" || status === "received";
  const setReceivedAt = status === "received";
  const params = {
    itemId: itemId || null,
    orderCode: orderCode || "",
    status,
    expectedDelivery: toMysqlDateTime(expectedDelivery),
    deliveredAt: toMysqlDateTime(deliveredAt),
  };

  return query(
    `UPDATE shipping_orders so
     JOIN consignment_requests cr ON cr.request_id = so.request_id
     LEFT JOIN consignment_items ci ON ci.request_id = cr.request_id
     SET so.status = :status,
         so.expected_delivery = COALESCE(:expectedDelivery, so.expected_delivery),
         so.delivered_at = CASE
           WHEN :status IN ('delivered', 'received') THEN COALESCE(:deliveredAt, so.delivered_at, NOW())
           ELSE so.delivered_at
         END,
         so.received_at = CASE
           WHEN :status = 'received' THEN COALESCE(so.received_at, NOW())
           ELSE so.received_at
         END,
         so.updated_at = NOW()
     WHERE (:itemId IS NOT NULL AND ci.consignment_item_id = :itemId)
        OR (:itemId IS NULL AND :orderCode <> '' AND so.ghn_order_code = :orderCode)`,
    params,
  );
}

function extractGhnShipmentPayload(payload) {
  const data = payload.data || payload.Data || payload;
  return {
    orderCode: data.order_code || data.OrderCode || data.ghn_order_code || data.client_order_code || "",
    status: data.status || data.Status || data.order_status || data.OrderStatus || "",
    expectedDelivery: data.expected_delivery_time || data.ExpectedDeliveryTime || data.expected_delivery || "",
    deliveredAt: data.delivered_at || data.delivery_time || data.finish_date || "",
  };
}

function normalizeShippingStatus(status) {
  const raw = String(status || "").trim().toLowerCase();
  if (shippingStatusValues.includes(raw)) return raw;

  const aliases = {
    ready_to_pick: "pending",
    picking: "picked_up",
    picked: "picked_up",
    picked_up: "picked_up",
    storing: "shipping",
    transporting: "shipping",
    delivering: "shipping",
    delivery: "shipping",
    shipped: "shipping",
    delivered: "delivered",
    delivery_success: "delivered",
    received: "received",
    completed: "received",
    cancel: "returned",
    cancelled: "returned",
    returned: "returned",
    return: "returned",
    lost: "failed",
    damage: "failed",
    failed: "failed",
  };

  return aliases[raw] || "";
}

function getShippingStatusLabel(status) {
  const labels = {
    pending: "Chờ GHN lấy hàng",
    picked_up: "GHN đã lấy hàng",
    shipping: "Đang vận chuyển",
    delivered: "Đã giao đến cửa hàng",
    received: "Đã nhận hàng",
    failed: "Giao hàng lỗi",
    returned: "Đã hoàn hàng",
  };
  return labels[status] || status;
}

function toMysqlDateTime(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
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
