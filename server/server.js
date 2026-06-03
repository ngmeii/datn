import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import consignmentRoutes from "./routes/consignments.js";
import orderRoutes from "./routes/orders.js";
import adminRoutes from "./routes/admin.js";
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
app.use("/api/admin", adminRoutes);

app.use((error, _req, res, _next) => {
  if (error?.issues) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ.", issues: error.issues });
  }

  console.error(error);
  return res.status(500).json({ message: "Lỗi máy chủ." });
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
