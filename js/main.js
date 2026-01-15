// ==========================================================================
// Infinite Bond - Main JavaScript
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all components
  initNavigation();
  initScrollEffects();
  initAnimations();
  initLazyLoading();
  // initForms() - Handled by config.js
});

// --------------------------------------------------------------------------
// Global Error Handler
// --------------------------------------------------------------------------
window.onerror = function (message, source, lineno, colno, error) {
  console.error('Global error:', { message, source, lineno, colno, error });
  // Could send to analytics here
  return false;
};

// --------------------------------------------------------------------------
// Lazy Loading
// --------------------------------------------------------------------------
function initLazyLoading() {
  // Native lazy loading is supported in modern browsers
  // For images that need lazy loading, add loading="lazy" attribute
  const images = document.querySelectorAll('img:not([loading])');

  images.forEach((img, index) => {
    // Skip first 3 images (likely above the fold)
    if (index > 2) {
      img.setAttribute('loading', 'lazy');
    }
  });
}

// --------------------------------------------------------------------------
// Formspree Integration (Handled by config.js - Dual Submission Logic)
// --------------------------------------------------------------------------
// Note: Form submission to Formspree is handled in config.js to avoid duplication.

// --------------------------------------------------------------------------
// Navigation
// --------------------------------------------------------------------------
function initNavigation() {
  const header = document.getElementById('header');
  const navToggle = document.getElementById('navToggle');
  const navList = document.getElementById('navList');

  // Mobile menu toggle
  if (navToggle && navList) {
    navToggle.addEventListener('click', () => {
      navList.classList.toggle('active');
      navToggle.classList.toggle('active');

      // Toggle body scroll
      document.body.style.overflow = navList.classList.contains('active') ? 'hidden' : '';
    });

    // Close menu when clicking on a link
    navList.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', () => {
        navList.classList.remove('active');
        navToggle.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // Header scroll effect
  if (header) {
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll > 50) {
        header.classList.add('header--scrolled');
      } else {
        header.classList.remove('header--scrolled');
      }

      lastScroll = currentScroll;
    }, { passive: true });
  }
}

// --------------------------------------------------------------------------
// Scroll Effects
// --------------------------------------------------------------------------
function initScrollEffects() {
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');

      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);

        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });

  // Parallax effect for hero
  const hero = document.querySelector('.hero');
  if (hero) {
    window.addEventListener('scroll', () => {
      const scroll = window.pageYOffset;
      const heroContent = hero.querySelector('.hero__content');

      if (heroContent && scroll < window.innerHeight) {
        heroContent.style.transform = `translateY(${scroll * 0.3}px)`;
        heroContent.style.opacity = 1 - (scroll / window.innerHeight) * 0.5;
      }
    }, { passive: true });
  }
}

// --------------------------------------------------------------------------
// Animations
// --------------------------------------------------------------------------
function initAnimations() {
  // Intersection Observer for fade-in animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in-up');

        // Stagger children if it's a stagger container
        if (entry.target.classList.contains('stagger')) {
          const children = entry.target.children;
          Array.from(children).forEach((child, index) => {
            child.style.animationDelay = `${index * 0.1}s`;
          });
        }

        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe elements
  document.querySelectorAll('.section-header, .card, .category-card, .gift-set, .testimonial, .b2b-cta, .stagger').forEach(el => {
    observer.observe(el);
  });
}

// --------------------------------------------------------------------------
// Form Validation
// --------------------------------------------------------------------------
function validateForm(form) {
  let isValid = true;
  const inputs = form.querySelectorAll('input[required], textarea[required]');

  inputs.forEach(input => {
    const value = input.value.trim();
    const errorEl = input.parentElement.querySelector('.form-error');

    if (!value) {
      isValid = false;
      input.classList.add('error');
      if (errorEl) errorEl.textContent = 'This field is required';
    } else if (input.type === 'email' && !isValidEmail(value)) {
      isValid = false;
      input.classList.add('error');
      if (errorEl) errorEl.textContent = 'Please enter a valid email';
    } else {
      input.classList.remove('error');
      if (errorEl) errorEl.textContent = '';
    }
  });

  return isValid;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --------------------------------------------------------------------------
// Modal
// --------------------------------------------------------------------------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    });
  }
});

// --------------------------------------------------------------------------
// Image Preview
// --------------------------------------------------------------------------
function previewImage(input, previewId) {
  const preview = document.getElementById(previewId);

  if (input.files && input.files[0] && preview) {
    const reader = new FileReader();

    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };

    reader.readAsDataURL(input.files[0]);
  }
}

// --------------------------------------------------------------------------
// Utility Functions
// --------------------------------------------------------------------------
function formatPrice(price) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(price);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// --------------------------------------------------------------------------
// Export for use in other scripts
// --------------------------------------------------------------------------
// Global Namespace
window.InfiniteBond = {
  init: function () {
    console.log('Infinite Bond initialized');
  },
  openModal,
  closeModal,
  validateForm,
  previewImage,
  formatPrice
};
