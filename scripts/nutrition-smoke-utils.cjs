// Browser QA only: account for both full-width and centred mobile previews.
function waitForNutritionPage(page) {
  return page.waitForFunction(() => {
    const pane = document.querySelector('[data-testid="today-nutrition-page"]');
    if (!pane || pane.getAttribute('aria-hidden') === 'true') return false;
    for (let container = pane.parentElement; container; container = container.parentElement) {
      if (!/auto|scroll/.test(getComputedStyle(container).overflowX) || container.scrollWidth <= container.clientWidth) continue;
      const box = pane.getBoundingClientRect();
      const frame = container.getBoundingClientRect();
      return Math.abs(box.left - frame.left - container.clientLeft) < 1
        && Math.abs(box.width - container.clientWidth) < 1;
    }
    return false;
  });
}

module.exports = { waitForNutritionPage };
