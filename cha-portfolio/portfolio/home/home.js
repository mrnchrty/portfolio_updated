(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const roleElement = document.querySelector('[data-role-text]');
  const roles = [
    'BSIT Student',
    'Graphic Designer',
    'Web Design Enthusiast',
    'Writer',
    'Gamer',
    'Music Lover',
    'Home Cook',
    'Binge-Watcher',
  ];

  if (roleElement && !prefersReducedMotion) {
    let roleIndex = 0;
    window.setInterval(() => {
      roleElement.classList.add('is-changing');
      window.setTimeout(() => {
        roleIndex = (roleIndex + 1) % roles.length;
        roleElement.textContent = roles[roleIndex];
        window.requestAnimationFrame(() => roleElement.classList.remove('is-changing'));
      }, 190);
    }, 2800);
  }

  document.querySelectorAll('.home-social-link[type="button"]').forEach((button) => {
    button.addEventListener('click', () => {
      const isSelected = button.classList.toggle('is-selected');
      button.setAttribute('aria-pressed', String(isSelected));
    });
  });

  const film = document.querySelector('[data-home-film]');
  if (!film) return;

  const slides = Array.from(film.querySelectorAll('[data-film-slide]'));
  const counter = film.querySelector('[data-film-counter]');
  if (slides.length === 0) return;

  slides.forEach((slide, slideIndex) => {
    const image = slide.querySelector('img');
    const photoPath = image?.dataset.photoSrc?.trim();
    if (!image || !photoPath) return;

    const userPhoto = new Image();
    userPhoto.onload = () => {
      image.src = photoPath;
      image.alt = image.dataset.photoAlt || `Photo ${slideIndex + 1} of Cha`;
    };
    userPhoto.onerror = () => {
      // Keep the labelled placeholder visible until the matching photo is added.
    };
    userPhoto.src = photoPath;
  });

  let activeIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
  const showSlide = (nextIndex) => {
    activeIndex = nextIndex;
    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });

    if (counter) {
      counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    }
  };

  showSlide(activeIndex);
  if (!prefersReducedMotion && slides.length > 1) {
    window.setInterval(() => showSlide((activeIndex + 1) % slides.length), 3200);
  }
})();
