// Component behavior: imported once, attaches delegated listeners, never fetches data.
window.greetingBehaviorLoads = (window.greetingBehaviorLoads ?? 0) + 1;
document.addEventListener('click', (event) => {
  const button =
    event.target instanceof Element
      ? event.target.closest('[data-c="greeting-card"] button')
      : null;
  if (button) button.textContent = 'Waved';
});
export {};
