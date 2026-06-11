import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET || "dev-secret";

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.full_name,
      email: user.email,
    },
    secret,
    { expiresIn: "7d" },
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Bạn cần đăng nhập." });
  }

  try {
    req.user = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ." });
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, secret);
    return next();
  } catch {
    return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ." });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập." });
    }
    return next();
  };
}
