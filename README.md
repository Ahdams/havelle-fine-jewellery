# Havelle Fine Jewellery

A responsive one-page site for Havelle, a fine-jewellery brand serving Kaduna, Kano and Abuja. The first version is a brand and product showcase with ordering handled through Instagram.

## Why this is static

There is no cart or payment flow yet because product prices, live stock, delivery fees and checkout details have not been confirmed. This keeps the site simple to update and avoids showing stale product information. Add a cart later when those details can be maintained reliably.

## Run locally

Open `dist/index.html` in a browser. The site uses plain HTML and CSS and has no build step, Python backend or database.

## Free hosting with GitHub Pages

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` will publish the contents of `dist/` after a push to `main`.

The repository is public, which makes it eligible for GitHub Pages on GitHub Free.

## Links

Internal navigation links to sections on the page. Instagram calls to action open Havelle's profile or the New In highlight.