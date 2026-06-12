import { api, getCurrentUser } from "./api.js";

const CART_KEY = "consignment_cart";
const CHECKOUT_KEY = "consignment_checkout_items";
const CART_EVENT = "cart-updated";

function readSessionCart() {
  try {
    return JSON.parse(sessionStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSessionCart(cart) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function emitCartChange() {
  window.dispatchEvent(new Event(CART_EVENT));
}

export async function getCart() {
  if (!getCurrentUser()) {
    return readSessionCart();
  }

  try {
    return await api("/cart");
  } catch {
    return [];
  }
}

export async function addToCart(product) {
  if (!getCurrentUser()) {
    const cart = readSessionCart();
    const exists = cart.some((item) => Number(item.id) === Number(product.id));
    const nextCart = exists
      ? cart
      : [
          ...cart,
          {
            id: product.id,
            name: product.name,
            price: Number(product.price),
            image_url: product.image_url,
            category_name: product.category_name,
            quantity: 1,
          },
        ];

    writeSessionCart(nextCart);
    emitCartChange();
    return nextCart;
  }

  await api("/cart/items", {
    method: "POST",
    body: JSON.stringify({ productId: Number(product.id), quantity: 1 }),
  });
  const nextCart = await getCart();
  emitCartChange();
  return nextCart;
}

export async function removeFromCart(productId) {
  if (!getCurrentUser()) {
    const nextCart = readSessionCart().filter((item) => Number(item.id) !== Number(productId));
    writeSessionCart(nextCart);
    emitCartChange();
    return nextCart;
  }

  await api(`/cart/items/${Number(productId)}`, { method: "DELETE" });
  const nextCart = await getCart();
  emitCartChange();
  return nextCart;
}

export async function clearCart() {
  if (!getCurrentUser()) {
    sessionStorage.removeItem(CART_KEY);
    emitCartChange();
    return;
  }

  await api("/cart", { method: "DELETE" });
  emitCartChange();
}

export function saveCheckoutItems(items) {
  sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(items));
}

export function getCheckoutItems() {
  try {
    return JSON.parse(sessionStorage.getItem(CHECKOUT_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearCheckoutItems() {
  sessionStorage.removeItem(CHECKOUT_KEY);
}

export function onCartChange(callback) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
