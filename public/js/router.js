// MazaoHub Hash-based SPA Router with Smooth Scroll Support

(function () {
  window.initRouter = function () {
    const views = document.querySelectorAll('.view');
    const ROUTES = {};

    views.forEach(v => {
      const routeAttr = v.getAttribute('data-route');
      if (routeAttr) {
        ROUTES[routeAttr] = v;
      }
    });

    function swap(route) {
      const activeView = ROUTES[route] || ROUTES['home'];
      
      views.forEach(v => {
        v.style.display = (v === activeView) ? 'block' : 'none';
      });

      if (activeView) {
        // Trigger reveal animations inside the active view
        activeView.querySelectorAll('.reveal').forEach(el => {
          el.classList.add('in');
        });
      }
      return activeView;
    }

    function show() {
      // Decode and clean up hash (remove leading # and /)
      const hash = decodeURIComponent(
        location.hash.replace(/^#/, '').replace(/^\//, '').replace(/\/$/, '')
      );

      if (hash === '' || hash === 'home') {
        swap('home');
        window.scrollTo(0, 0);
        return;
      }

      // Check if it is a homepage scroll section (What we offer, AI Engine, Data Intelligence, Global Map, Pricing)
      const homepageSections = ['offer', 'ai', 'engines', 'global', 'world', 'pricing'];
      
      if (homepageSections.includes(hash)) {
        swap('home'); // Ensure homepage is visible
        const targetElement = document.getElementById(hash);
        if (targetElement) {
          // Smooth scroll to the target section
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }

      // Check if it matches an exact sub-view directly (like about, products, news, service/*, engine/*, portfolio/*)
      if (ROUTES[hash]) {
        swap(hash);
        window.scrollTo(0, 0);
        return;
      }

      // Check if it matches a dynamic route path (individual articles or subpages)
      if (
        hash.indexOf('news/') === 0 ||
        hash.indexOf('portfolio/') === 0 ||
        hash.indexOf('service/') === 0 ||
        hash.indexOf('engine/') === 0
      ) {
        swap(hash);
        window.scrollTo(0, 0);
        return;
      }

      // Fallback
      swap('home');
      const targetElement = document.getElementById(hash);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    }

    window.addEventListener('hashchange', show);
    
    // Run route handler on initial page load
    show();
  };
})();
