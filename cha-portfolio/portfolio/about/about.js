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

  document.querySelectorAll('.social-placeholder[data-social-url]').forEach((card) => {
    const rawUrl = card.dataset.socialUrl.trim();
    if (!rawUrl) return;

    let profileUrl;
    try {
      profileUrl = new URL(rawUrl);
    } catch {
      return;
    }

    if (!['http:', 'https:'].includes(profileUrl.protocol)) return;

    const profileName = card.querySelector('strong')?.textContent.trim() || 'Social';
    const profileStatus = card.querySelector('div span');
    if (profileStatus) profileStatus.textContent = 'Open profile';

    const link = document.createElement('a');
    link.className = card.className;
    link.href = profileUrl.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Open ${profileName} profile in a new tab`);

    while (card.firstChild) link.append(card.firstChild);
    card.replaceWith(link);
  });
})();
