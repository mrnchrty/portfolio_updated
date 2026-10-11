(() => {
  document.querySelectorAll('[data-social-url]').forEach((placeholder) => {
    const rawUrl = placeholder.dataset.socialUrl.trim();
    if (!rawUrl) return;

    let profileUrl;
    try {
      profileUrl = new URL(rawUrl);
    } catch {
      return;
    }

    if (!['http:', 'https:'].includes(profileUrl.protocol)) return;

    const profileName =
      placeholder.dataset.socialName || placeholder.querySelector('strong')?.textContent.trim() || 'Social';
    const profileStatus = placeholder.querySelector('[data-profile-status]');
    if (profileStatus) profileStatus.textContent = 'Open profile';

    const link = document.createElement('a');
    link.className = placeholder.className;
    link.href = profileUrl.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = `Open ${profileName} profile`;
    link.setAttribute('aria-label', `Open ${profileName} profile in a new tab`);

    while (placeholder.firstChild) link.append(placeholder.firstChild);
    placeholder.replaceWith(link);
  });
})();
