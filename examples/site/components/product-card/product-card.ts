// Component behavior: bundled for pages that use product-card; never fetches data.
document.addEventListener('click', (event) => {
  const button =
    event.target instanceof Element
      ? event.target.closest('[data-c="product-card"] .select')
      : null;
  button?.closest('.card')?.classList.toggle('selected');
});
export {};
