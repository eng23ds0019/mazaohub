// MazaoHub Website Bootstrapper & Interactivity Logic

document.addEventListener('DOMContentLoaded', () => {
  // 1. Fetch sections and articles in parallel
  Promise.all([
    fetch('/api/content/sections').then(res => res.json()),
    fetch('/api/articles').then(res => res.json()),
    fetch('/api/content/settings').then(res => res.json())
  ])
  .then(([sectionsRes, articlesRes, settingsRes]) => {
    if (!sectionsRes.success || !articlesRes.success) {
      throw new Error('Failed to load website content');
    }

    const mainEl = document.querySelector('main');
    
    // Remove loading overlay
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.remove();

    // Render/Hydrate Page Sections (Home, About, Products, News, etc.)
    // Pass 1: Render main views (excluding homepage sub-sections)
    sectionsRes.sections.forEach(sec => {
      if (sec.page_slug.startsWith('home/')) return;
      
      let viewDiv = document.querySelector(`.view[data-route="${sec.page_slug}"]`);
      if (viewDiv) {
        viewDiv.innerHTML = sec.content_html;
      } else {
        viewDiv = document.createElement('div');
        viewDiv.className = 'view';
        viewDiv.setAttribute('data-route', sec.page_slug);
        viewDiv.innerHTML = sec.content_html;
        mainEl.appendChild(viewDiv);
      }
    });

    // Pass 2: Overwrite sub-sections inside the homepage container
    const homeDiv = document.querySelector('.view[data-route="home"]');
    if (homeDiv) {
      sectionsRes.sections.forEach(sec => {
        let targetId = '';
        if (sec.page_slug.startsWith('home/')) {
          targetId = sec.page_slug.split('/')[1];
        } else if (['offer', 'ai', 'engines', 'global', 'pricing'].includes(sec.page_slug)) {
          targetId = sec.page_slug === 'global' ? 'world' : sec.page_slug;
        }

        if (targetId) {
          const targetSection = homeDiv.querySelector(`#${targetId}`);
          if (targetSection) {
            targetSection.outerHTML = sec.content_html;
          }
        }
      });
    }

    // Render/Hydrate Individual Article views dynamically
    articlesRes.articles.forEach(art => {
      let viewDiv = document.querySelector(`.view[data-route="news/${art.slug}"]`);
      if (!viewDiv) {
        viewDiv = document.createElement('div');
        viewDiv.className = 'view';
        viewDiv.setAttribute('data-route', `news/${art.slug}`);
        viewDiv.innerHTML = art.content_html;
        mainEl.appendChild(viewDiv);
      } else {
        viewDiv.innerHTML = art.content_html;
      }
    });

    // Populate global settings
    if (settingsRes.success && settingsRes.settings) {
      const settings = settingsRes.settings;
      document.title = settings.site_title || document.title;

      // Inject custom theme variables if present
      let styleEl = document.getElementById('custom-theme-styles');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'custom-theme-styles';
        document.head.appendChild(styleEl);
      }

      let cssRules = ':root {';
      const variables = ['canopy', 'forest', 'leaf', 'bright', 'gold', 'orange', 'soil'];
      variables.forEach(v => {
        const val = settings[`theme_${v}`];
        if (val) {
          cssRules += `--${v}: ${val};`;
        }
      });
      cssRules += '}';
      styleEl.innerHTML = cssRules;
    }

    // 2. Initialize Router
    if (window.initRouter) {
      window.initRouter();
    }

    // 3. Register Interactive Behaviors
    registerInteractivity();
    
    // Build the dynamic articles grid inside the news page
    populateArticlesGrid(articlesRes.articles);
  })
  .catch(err => {
    console.error('Bootstrapping error:', err);
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.innerHTML = `
        <div style="text-align: center; padding: 100px 20px; font-family: sans-serif; color: #ff5555;">
          <h2>Error Loading MazaoHub</h2>
          <p>Please check your connection and refresh. Detailed error: ${err.message}</p>
        </div>
      `;
    }
  });
});

// Helper to populate the dynamic article list/grid on the news page
function populateArticlesGrid(articles) {
  const gridContainer = document.querySelector('#news .grid, #news .news-grid');
  if (!gridContainer) return;

  gridContainer.innerHTML = '';
  
  articles.forEach(art => {
    const card = document.createElement('a');
    card.href = `#/news/${art.slug}`;
    card.className = 'ncard reveal in'; // Match card layout style
    
    card.innerHTML = `
      <div class="nimg">
        <img src="${art.image_url || 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=1200'}" alt="${art.title}">
      </div>
      <div class="nbody">
        <div class="ncat">${art.category_name || 'Field Notes'}</div>
        <h3 class="serif">${art.title}</h3>
        <p>${art.summary || ''}</p>
        <div class="nmore">Read article &rarr;</div>
      </div>
    `;
    gridContainer.appendChild(card);
  });
}

function registerInteractivity() {
  /* nav scroll */
  const nav = document.getElementById('nav');
  const prog = document.getElementById('prog');
  window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (prog) prog.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
  }, { passive: true });

  /* mobile menu */
  const burger = document.getElementById('burger');
  if (burger) {
    burger.addEventListener('click', () => {
      const n = document.querySelector('.navlinks');
      if (n) {
        n.style.display = n.style.display === 'flex' ? 'none' : 'flex';
        if (n.style.display === 'flex') {
          n.style.cssText = 'display:flex;position:absolute;top:104px;left:0;right:0;flex-direction:column;background:#126c22;padding:18px 26px;gap:14px;border-bottom:1px solid rgba(0,0,0,.2)';
        }
      }
    });
  }

  /* reveal on scroll */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* counters animation */
  function animateCount(el) {
    const target = +el.dataset.count;
    const suffix = el.dataset.suffix || '';
    let t0 = null;
    const dur = 1600;
    
    function tick(ts) {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.floor(ease * target).toLocaleString() + (p === 1 ? suffix : '');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const cio = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        cio.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

  /* audience tabs */
  document.querySelectorAll('.aud-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.aud-tab').forEach(x => x.classList.remove('active'));
      tab.classList.add('active');
      const isLast = tab.dataset.g === 'last';
      const lastEl = document.getElementById('aud-last');
      const entEl = document.getElementById('aud-ent');
      if (lastEl) lastEl.style.display = isLast ? 'grid' : 'none';
      if (entEl) entEl.style.display = isLast ? 'none' : 'grid';
    });
  });

  /* duplicate ticker for seamless loop */
  const tk = document.getElementById('ticker');
  if (tk) {
    tk.innerHTML += tk.innerHTML;
  }

  /* ---- D3 world map ---- */
  const regionFor = (name) => {
    const africa = ['Tanzania','Kenya','Uganda','Rwanda','Burundi','Nigeria','Ghana','Ethiopia','Zambia','Malawi','Mozambique','Dem. Rep. Congo','Congo','Angola','South Africa','Zimbabwe','Cameroon','Côte d\'Ivoire','Senegal','Mali','Sudan','S. Sudan','Somalia','Madagascar','Egypt','Morocco','Algeria','Tunisia','Libya','Chad','Niger','Burkina Faso','Benin','Togo','Guinea','Sierra Leone','Liberia','Gabon','Botswana','Namibia','Lesotho','Eswatini','Eritrea','Djibouti','Central African Rep.','Equatorial Guinea','Gambia','Guinea-Bissau','Mauritania','W. Sahara'];
    if (africa.includes(name)) return 'africa';
    const eu = ['Germany','France','Spain','Italy','Netherlands','Belgium','Poland','Sweden','Norway','Finland','Denmark','Ireland','Portugal','Austria','Switzerland','Czechia','Greece','Romania','Hungary','United Kingdom'];
    if (eu.includes(name)) return 'eu';
    if (['United States of America','Canada','Mexico','Brazil','Argentina'].includes(name)) return 'us';
    const asia = ['China','India','Indonesia','Vietnam','Thailand','Philippines','Malaysia','Pakistan','Bangladesh','Myanmar','Japan','South Korea'];
    if (asia.includes(name)) return 'asia';
    return null;
  };

  const mapSvg = document.getElementById('worldmap');
  if (mapSvg && window.d3 && window.topojson) {
    (function buildMap() {
      const svg = d3.select('#worldmap');
      const w = 960, h = 520;
      const projection = d3.geoNaturalEarth1().scale(180).translate([w / 2, h / 2 + 20]);
      const path = d3.geoPath(projection);

      d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
        .then(world => {
          const countries = topojson.feature(world, world.objects.countries).features;
          svg.append('g').selectAll('path').data(countries).join('path')
            .attr('d', path)
            .attr('class', d => {
              const r = regionFor(d.properties.name);
              return 'land' + (r ? ' hot' : '');
            })
            .attr('data-region', d => regionFor(d.properties.name) || '')
            .style('cursor', d => regionFor(d.properties.name) ? 'pointer' : 'default')
            .on('click', (e, d) => {
              const r = regionFor(d.properties.name);
              if (r) {
                console.log('Selected region:', r);
              }
            })
            .append('title').text(d => d.properties.name);

          /* data hubs + arcs */
          const hubs = [
            ['Dar es Salaam', 39.2, -6.8],
            ['Brussels', 4.3, 50.8],
            ['Dover, DE', -75.5, 39.1],
            ['Singapore', 103.8, 1.3],
            ['Nairobi', 36.8, -1.3],
            ['Lagos', 3.4, 6.5]
          ];
          const g = svg.append('g');
          const home = projection([39.2, -6.8]);
          hubs.forEach(([n, lon, lat]) => {
            const p = projection([lon, lat]);
            if (!p) return;
            if (n !== 'Dar es Salaam') {
              const mx = (home[0] + p[0]) / 2;
              const my = (home[1] + p[1]) / 2 - 60;
              g.append('path')
                .attr('d', `M${home[0]},${home[1]} Q${mx},${my} ${p[0]},${p[1]}`)
                .attr('fill', 'none')
                .attr('stroke', '#14c834')
                .attr('stroke-width', 1)
                .attr('opacity', 0.35)
                .attr('stroke-dasharray', '4 5');
            }
            g.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', n === 'Dar es Salaam' ? 6 : 4)
              .attr('fill', '#14c834').attr('opacity', 0.9);
            g.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', n === 'Dar es Salaam' ? 6 : 4)
              .attr('fill', 'none').attr('stroke', '#14c834').attr('stroke-width', 1.5)
              .append('animate').attr('attributeName', 'r').attr('from', n === 'Dar es Salaam' ? 6 : 4).attr('to', 20).attr('dur', '2.4s').attr('repeatCount', 'indefinite');
          });
        })
        .catch(err => {
          console.warn('Error loading Map JSON, using static warning:', err);
          svg.append('text').attr('x', 480).attr('y', 260).attr('fill', '#8aa093')
            .attr('text-anchor', 'middle').attr('font-family', 'monospace').attr('font-size', 14)
            .text('Connect to the internet to load the live global map');
          const regCards = document.querySelector('.region-cards');
          if (regCards) regCards.style.outline = 'none';
        });
    })();
  }

  /* products filter */
  const pv = document.querySelector('.view[data-route="products"]');
  if (pv) {
    const btns = pv.querySelectorAll('.pfilter');
    const cards = pv.querySelectorAll('.pcard');
    const groups = pv.querySelectorAll('.prod-group');
    
    btns.forEach(b => {
      b.addEventListener('click', () => {
        btns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const cat = b.getAttribute('data-cat');
        cards.forEach(card => {
          const cats = (card.getAttribute('data-cats') || '').split(' ');
          card.classList.toggle('hide', !(cat === 'all' || cats.indexOf(cat) >= 0));
        });
        groups.forEach(g => {
          g.classList.toggle('hide', g.querySelectorAll('.pcard:not(.hide)').length === 0);
        });
      });
    });
  }

  /* Form Submission Interception */
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const data = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });

      if (!data.form_type) {
        if (form.innerHTML.includes('book-demo') || form.id === 'demo-form') {
          data.form_type = 'book-demo';
        } else {
          data.form_type = 'contact';
        }
      }

      try {
        const response = await fetch('/api/submissions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
          showFormSuccess(form);
        } else {
          alert('Error: ' + result.error);
        }
      } catch (err) {
        console.error('Form submission failed:', err);
        alert('Failed to submit form. Please try again.');
      }
    });
  });
}

function showFormSuccess(form) {
  form.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; font-family: sans-serif; color: #14c834; background: rgba(8,64,18,0.4); border-radius: 8px; border: 1px solid rgba(20,200,52,0.3);">
      <svg style="width:64px; height:64px; fill:#14c834; margin-bottom: 16px;" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      <h3 style="font-size:22px; font-weight:600; margin-bottom: 8px;">Submission Received!</h3>
      <p style="color: #c9d6cb; font-size:14px;">Thank you for contacting MazaoHub. We will get back to you shortly.</p>
    </div>
  `;
}
