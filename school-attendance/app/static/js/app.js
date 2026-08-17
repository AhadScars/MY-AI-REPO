/* Shared UI helpers */
document.addEventListener("DOMContentLoaded", () => {
  // Auto-hide flashes
  document.querySelectorAll(".flash").forEach((el) => {
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.4s";
      setTimeout(() => el.remove(), 400);
    }, 5000);
  });
});
