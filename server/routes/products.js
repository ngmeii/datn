import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { q = "", category = "", status = "available" } = req.query;
    const products = await query(
      `SELECT p.product_id AS id,
              p.product_name AS name,
              p.brand,
              p.description,
              p.condition_level,
              p.size,
              p.color,
              p.final_price AS price,
              JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]')) AS image_url,
              p.sell_status AS status,
              p.display_status,
              p.consign_start_date AS listed_at,
              p.consign_end_date AS expires_at,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.category_id = p.category_id
       WHERE (:status = '' OR (:status = 'available' AND p.sell_status = 'on_sale'))
         AND (:category = '' OR CAST(p.category_id AS CHAR) = :category OR c.name = :category)
         AND (:q = '' OR p.product_name LIKE CONCAT('%', :q, '%') OR p.brand LIKE CONCAT('%', :q, '%'))
       ORDER BY p.created_at DESC`,
      { q, category, status },
    );

    return res.json(products);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const products = await query(
      `SELECT p.product_id AS id,
              p.product_name AS name,
              p.brand,
              p.description,
              p.condition_level AS condition_note,
              p.size,
              p.color,
              p.final_price AS price,
              JSON_UNQUOTE(JSON_EXTRACT(p.images, '$[0]')) AS image_url,
              p.sell_status AS status,
              p.display_status,
              p.consign_start_date AS listed_at,
              p.consign_end_date AS expires_at,
              c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.category_id = p.category_id
       WHERE p.product_id = :id`,
      { id: req.params.id },
    );

    if (!products.length) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }

    return res.json(products[0]);
  } catch (error) {
    return next(error);
  }
});

export default router;
