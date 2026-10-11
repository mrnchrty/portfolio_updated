(() => {
  const filterButtons = document.querySelectorAll('[data-place-filter]');
  const cards = document.querySelectorAll('[data-place-type]');

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const selectedType = button.dataset.placeFilter;

      filterButtons.forEach((filterButton) => {
        const isSelected = filterButton === button;
        filterButton.classList.toggle('is-active', isSelected);
        filterButton.setAttribute('aria-pressed', String(isSelected));
      });

      cards.forEach((card) => {
        const shouldShow = selectedType === 'all' || card.dataset.placeType === selectedType;
        card.hidden = !shouldShow;
      });
    });
  });
})();
