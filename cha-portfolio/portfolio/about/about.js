(() => {
  const fallbackByImage = new Map([
    ['.about-portrait', '../../assets/images/cha-profile-placeholder.svg'],
    ['.discover-panel > img', '../../assets/images/mabini-placeholder.svg'],
  ]);

  fallbackByImage.forEach((fallbackPath, selector) => {
    document.querySelectorAll(selector).forEach((image) => {
      image.addEventListener('error', () => {
        if (image.dataset.fallbackApplied === 'true') return;
        image.dataset.fallbackApplied = 'true';
        image.src = fallbackPath;
      });
    });
  });
})();
