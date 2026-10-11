(() => {
  const projectCards = document.querySelectorAll('.work-card');

  const toggleProjectCard = (card) => {
    const isExpanded = card.getAttribute('aria-expanded') === 'true';
    card.classList.toggle('is-open', !isExpanded);
    card.setAttribute('aria-expanded', String(!isExpanded));
  };

  projectCards.forEach((card) => {
    card.addEventListener('click', () => toggleProjectCard(card));

    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleProjectCard(card);
    });
  });

  const lightbox = document.getElementById('image-lightbox');
  const lightboxImage = lightbox.querySelector('.lightbox-image');
  const caption = lightbox.querySelector('.lightbox-caption');
  const title = lightbox.querySelector('#lightbox-title');
  const previewButtons = [...document.querySelectorAll('[data-preview]')];
  let currentIndex = 0;

  const showPreview = (index) => {
    if (!previewButtons.length) return;

    currentIndex = (index + previewButtons.length) % previewButtons.length;
    const sourceImage = previewButtons[currentIndex].querySelector('img');
    const label = sourceImage.dataset.previewTitle || sourceImage.alt || 'Image preview';

    lightboxImage.src = sourceImage.currentSrc || sourceImage.src;
    lightboxImage.alt = sourceImage.alt;
    caption.textContent = label;
    title.textContent = label;
  };

  previewButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      showPreview(index);
      if (!lightbox.open) lightbox.showModal();
      lightbox.querySelector('.lightbox-close').focus();
    });
  });

  lightbox.querySelector('.lightbox-close').addEventListener('click', () => {
    lightbox.close();
  });

  lightbox.querySelector('.lightbox-previous').addEventListener('click', () => {
    showPreview(currentIndex - 1);
  });

  lightbox.querySelector('.lightbox-next').addEventListener('click', () => {
    showPreview(currentIndex + 1);
  });

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) lightbox.close();
  });

  lightbox.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') showPreview(currentIndex - 1);
    if (event.key === 'ArrowRight') showPreview(currentIndex + 1);
  });

  lightbox.addEventListener('close', () => {
    lightboxImage.removeAttribute('src');
    lightboxImage.alt = '';
    caption.textContent = '';
  });
})();
