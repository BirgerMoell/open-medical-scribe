const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  },
  {
    threshold: 0.16,
    rootMargin: "0px 0px -8% 0px",
  },
);

for (const node of document.querySelectorAll("[data-reveal]")) {
  observer.observe(node);
}
