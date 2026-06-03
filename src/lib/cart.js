const CART_KEY = "consignment_cart";
const CHECKOUT_KEY = "consignment_checkout_items";
const CART_EVENT = "cart-updated";

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addToCart(product) {
  const cart = getCart();
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

  localStorage.setItem(CART_KEY, JSON.stringify(nextCart));
  window.dispatchEvent(new Event(CART_EVENT));
  return nextCart;
}

export function removeFromCart(productId) {
  const nextCart = getCart().filter((item) => Number(item.id) !== Number(productId));
  localStorage.setItem(CART_KEY, JSON.stringify(nextCart));
  window.dispatchEvent(new Event(CART_EVENT));
  return nextCart;
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event(CART_EVENT));
}

export function saveCheckoutItems(items) {
  localStorage.setItem(CHECKOUT_KEY, JSON.stringify(items));
}

export function getCheckoutItems() {
  try {
    return JSON.parse(localStorage.getItem(CHECKOUT_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearCheckoutItems() {
  localStorage.removeItem(CHECKOUT_KEY);
}

export function onCartChange(callback) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
