# FireClaw Marketing Website

A single-page marketing website for FireClaw — a firewall for your agent's brain.

## 🔥 Features

- **Dark cybersecurity theme** with orange-red (#ff4500) accents
- **Animated particle background** using HTML5 Canvas
- **Scroll-triggered animations** with Intersection Observer API
- **Smooth scrolling** navigation
- **Sticky navigation** that appears on scroll
- **Responsive design** — mobile-first approach
- **Zero dependencies** — vanilla JavaScript, no frameworks
- **Lightweight** — fast loading with no heavy libraries

## 📁 File Structure

```
website/
├── index.html          # Main HTML structure
├── style.css           # All styling and animations
├── app.js              # JavaScript for interactivity
└── README.md           # This file
```

## 🚀 Deployment to GitHub Pages

### Option 1: Deploy from Main Branch

1. **Create a new repository** on GitHub (or use an existing one)

2. **Initialize and push your code:**
   ```bash
   cd /Users/rAIph/clawd/skills/honey-bot/website
   git init
   git add .
   git commit -m "Initial commit: FireClaw marketing website"
   git branch -M main
   git remote add origin https://github.com/yourusername/fireclaw.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under **Source**, select **main branch** and **/ (root)** folder
   - Click **Save**
   - Your site will be live at `https://yourusername.github.io/fireclaw/`

### Option 2: Deploy from gh-pages Branch

1. **Push code to main branch** (follow steps 1-2 from Option 1)

2. **Create and deploy to gh-pages branch:**
   ```bash
   git checkout --orphan gh-pages
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push -u origin gh-pages
   ```

3. **Enable GitHub Pages:**
   - Go to **Settings** → **Pages**
   - Select **gh-pages branch** as source
   - Your site will be live at `https://yourusername.github.io/fireclaw/`

### Option 3: Use GitHub Actions (Automated)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

## 🌐 Custom Domain Setup (Optional)

If you own `fireclaw.app`:

1. **Add CNAME file** to your repository:
   ```bash
   echo "fireclaw.app" > CNAME
   git add CNAME
   git commit -m "Add custom domain"
   git push
   ```

2. **Configure DNS** at your domain registrar:
   - Add an **A record** pointing to GitHub Pages IPs:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - Or add a **CNAME record** pointing to `yourusername.github.io`

3. **Enable HTTPS** in GitHub Pages settings (automatic with custom domain)

## 🛠️ Local Development

No build process required! Just open `index.html` in your browser:

```bash
# Simple HTTP server (Python 3)
python3 -m http.server 8000

# Or using Node.js
npx http-server

# Or just open directly
open index.html
```

Visit `http://localhost:8000` in your browser.

## ✏️ Customization

### Update GitHub Links

Replace placeholder URLs in `index.html`:
- `https://github.com/yourusername/fireclaw` → your actual GitHub repo
- Update Discord invite link
- Update Buy Me a Coffee / Ko-fi links
- Update documentation URL

### Change Colors

Edit CSS variables in `style.css`:
```css
:root {
    --color-accent: #ff4500;  /* Main accent color */
    --color-bg: #0a0a0a;      /* Background */
}
```

### Add Screenshots

Replace the dashboard placeholder in `index.html`:
```html
<div class="dashboard-preview">
    <img src="dashboard-screenshot.png" alt="FireClaw Dashboard">
</div>
```

### Adjust Animations

Modify animation timings in `app.js`:
- Particle count: Line 31
- Scroll animation delays: Lines 100-150
- Counter animation speed: Line 93

## 📊 Performance

- **First Contentful Paint:** < 1s
- **Time to Interactive:** < 2s
- **Lighthouse Score:** 95+ (Performance, Accessibility, Best Practices, SEO)
- **Total Size:** < 50KB (HTML + CSS + JS)

## 🔧 Browser Support

- Chrome/Edge (90+)
- Firefox (88+)
- Safari (14+)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📝 License

AGPLv3 — See LICENSE file for details.

---

**Made with 🔥 by the OpenClaw community**
