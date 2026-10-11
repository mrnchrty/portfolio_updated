# Portfolio frontend

The portfolio pages live in this folder. With the current Express app, the homepage is served at `/` and `/portfolio/`; the portfolio HTML uses the shared CSS/JS and image assets from the parent app folder.

The Shop directory and homepage cards link to the sibling `../digicha-shop/` and `../mochajaki-shop/` folders in new tabs. They currently share the Express deployment and API. If you later host a shop at a different domain, replace the relative shop links in `index.html` and `shops/shops.html` with that shop’s real URL.
