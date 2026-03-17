// FireClaw — Security Proxy for OpenClaw
// Copyright (C) 2026 Ralph Perez
// Licensed under the GNU Affero General Public License v3.0
// See LICENSE file for details.

// ===== PARTICLE BACKGROUND =====
const canvas = document.getElementById('particles-bg');
const ctx = canvas.getContext('2d');

let particles = [];
let animationId;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 69, 0, 0.5)';
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    const particleCount = Math.min(100, Math.floor((canvas.width * canvas.height) / 15000));
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

function connectParticles() {
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 150) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 69, 0, ${0.2 * (1 - distance / 150)})`;
                ctx.lineWidth = 0.5;
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });
    
    connectParticles();
    
    animationId = requestAnimationFrame(animate);
}

resizeCanvas();
initParticles();
animate();

window.addEventListener('resize', () => {
    resizeCanvas();
    initParticles();
});

// ===== STICKY NAVIGATION =====
const nav = document.getElementById('main-nav');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        nav.classList.add('visible');
    } else {
        nav.classList.remove('visible');
    }
    
    lastScroll = currentScroll;
});

// ===== SMOOTH SCROLL FOR NAV LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===== INTERSECTION OBSERVER FOR SCROLL ANIMATIONS =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            
            // Special handling for stat counters
            if (entry.target.classList.contains('stat-card')) {
                animateCounter(entry.target);
            }
        }
    });
}, observerOptions);

// Observe all animated elements
const animatedElements = document.querySelectorAll(
    '.diagram-step, .pipeline-stage, .feature-card, .stat-card'
);
animatedElements.forEach(el => observer.observe(el));

// ===== COUNTER ANIMATION =====
function animateCounter(card) {
    const numberElement = card.querySelector('.stat-number');
    const target = parseInt(numberElement.getAttribute('data-count'));
    let current = 0;
    const increment = target / 100;
    const duration = 2000;
    const stepTime = duration / 100;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            numberElement.textContent = target.toLocaleString();
            clearInterval(timer);
        } else {
            numberElement.textContent = Math.floor(current).toLocaleString();
        }
    }, stepTime);
}

// ===== COPY TO CLIPBOARD =====
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const textToCopy = this.getAttribute('data-copy');
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = this.textContent;
            this.textContent = 'Copied!';
            this.style.background = '#00ff88';
            
            setTimeout(() => {
                this.textContent = originalText;
                this.style.background = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    });
});

// ===== PIPELINE STAGE SEQUENTIAL ANIMATION =====
const pipelineObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const stages = document.querySelectorAll('.pipeline-stage');
            stages.forEach((stage, index) => {
                setTimeout(() => {
                    stage.classList.add('visible');
                }, index * 200);
            });
            pipelineObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.2 });

const pipeline = document.querySelector('.pipeline');
if (pipeline) {
    pipelineObserver.observe(pipeline);
}

// ===== PROBLEM DIAGRAM SEQUENTIAL ANIMATION =====
const diagramObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const steps = document.querySelectorAll('.diagram-step');
            steps.forEach((step, index) => {
                setTimeout(() => {
                    step.classList.add('visible');
                }, index * 300);
            });
            diagramObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.3 });

const problemDiagram = document.querySelector('.problem-diagram');
if (problemDiagram) {
    diagramObserver.observe(problemDiagram);
}

// ===== FEATURE CARDS STAGGERED ANIMATION =====
const featuresObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const cards = document.querySelectorAll('.feature-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('visible');
                }, index * 100);
            });
            featuresObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

const featuresGrid = document.querySelector('.features-grid');
if (featuresGrid) {
    featuresObserver.observe(featuresGrid);
}

// ===== PARALLAX EFFECT FOR HERO SHIELD =====
const heroShield = document.querySelector('.hero-shield');
if (heroShield) {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * 0.3;
        heroShield.style.transform = `translateY(${rate}px)`;
    });
}

// ===== SCROLL PROGRESS INDICATOR (Optional Enhancement) =====
const scrollProgress = document.createElement('div');
scrollProgress.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0%;
    height: 3px;
    background: linear-gradient(90deg, #ff4500, #ff8c00);
    z-index: 9999;
    transition: width 0.1s ease;
`;
document.body.appendChild(scrollProgress);

window.addEventListener('scroll', () => {
    const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (window.pageYOffset / windowHeight) * 100;
    scrollProgress.style.width = scrolled + '%';
});

// ===== CONSOLE EASTER EGG =====
console.log(`
%c🔥 FireClaw - A Firewall for Your Agent's Brain 🔥
%cInterested in contributing? Check out our GitHub!
%chttps://github.com/yourusername/fireclaw
`,
'color: #ff4500; font-size: 20px; font-weight: bold;',
'color: #e0e0e0; font-size: 14px;',
'color: #00ff88; font-size: 14px; text-decoration: underline;'
);

// ===== PERFORMANCE OPTIMIZATION: PAUSE ANIMATIONS WHEN TAB IS HIDDEN =====
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    } else {
        animate();
    }
});

// ===== DEPLOY TABS =====
document.querySelectorAll('.deploy-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.deploy-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.deploy-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
});
