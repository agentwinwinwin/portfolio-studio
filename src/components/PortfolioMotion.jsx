import { useLayoutEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function PortfolioMotion({ scopeRef, skipOpening = false }) {
  useLayoutEffect(() => {
    const scope = scopeRef.current
    if (!scope) return undefined

    if (!skipOpening) document.body.classList.add('is-opening')

    const context = gsap.context(() => {
      gsap.config({ force3D: true, nullTargetWarn: false })
      ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true })

      if (skipOpening) {
        gsap.set('.opening-screen', { display: 'none' })
        document.body.classList.remove('is-opening')
      } else {
        const counter = { value: 0 }
        const opening = gsap.timeline({
          defaults: { ease: 'power4.inOut' },
          onComplete: () => {
            gsap.set(['.topbar > *', '.hero-kicker', '.hero-title > span', '.hero-art', '.hero-intro', '.hero-actions', '.hero-bottom'], { clearProps: 'transform,opacity,visibility,clipPath' })
            document.body.classList.remove('is-opening')
            ScrollTrigger.refresh()
          },
        })

        opening
          .set('.opening-screen', { autoAlpha: 1 })
          .set('.opening-progress i', { scaleX: 0, transformOrigin: 'left center' })
          .set('.hero-title > span', { clipPath: 'inset(100% 0 0 0)', yPercent: 95, scaleX: 0.78, scaleY: 0.62, transformOrigin: 'left bottom' })
          .set(['.hero-kicker', '.hero-intro', '.hero-actions', '.hero-bottom'], { autoAlpha: 0, y: 42 })
          .set('.hero-art', { clipPath: 'inset(0 0 100% 0 round 34px)', scale: 1.08, transformOrigin: 'center center' })
          .set('.topbar > *', { autoAlpha: 0, y: -24 })
          .to(counter, {
            value: 100,
            duration: 1.35,
            ease: 'power2.inOut',
            onUpdate: () => {
              const node = scope.querySelector('.opening-count')
              if (node) node.textContent = String(Math.round(counter.value)).padStart(3, '0')
            },
          }, 0.05)
          .to('.opening-progress i', { scaleX: 1, duration: 1.35, ease: 'power2.inOut' }, 0.05)
          .fromTo('.opening-name', { yPercent: 35, scaleX: 0.78, autoAlpha: 0 }, { yPercent: 0, scaleX: 1, autoAlpha: 1, duration: 1.1 }, 0.12)
          .to('.opening-center', { autoAlpha: 0, y: -30, duration: 0.55, ease: 'power3.in' }, 1.25)
          .to('.opening-panel--top', { yPercent: -102, duration: 1.05, ease: 'expo.inOut' }, 1.38)
          .to('.opening-panel--bottom', { yPercent: 102, duration: 1.05, ease: 'expo.inOut' }, 1.38)
          .set('.opening-screen', { display: 'none' })
          .to('.topbar > *', { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.09, ease: 'power4.out' }, 1.82)
          .to('.hero-kicker', { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power4.out' }, 1.85)
          .to('.hero-title > span', {
            clipPath: 'inset(0% 0 0 0)', yPercent: 0, scaleX: 1, scaleY: 1,
            duration: 1.25, stagger: 0.13, ease: 'expo.out',
          }, 1.94)
          .to('.hero-art', { clipPath: 'inset(0% 0 0% 0 round 34px)', scale: 1, duration: 1.45, ease: 'expo.out' }, 2.08)
          .to('.hero-intro', { autoAlpha: 1, y: 0, duration: 0.95, ease: 'power4.out' }, 2.38)
          .to('.hero-actions', { autoAlpha: 1, y: 0, duration: 0.95, ease: 'power4.out' }, 2.52)
          .to('.hero-bottom', { autoAlpha: 1, y: 0, duration: 1, ease: 'power4.out' }, 2.6)
      }

      gsap.to('.hero-art-frame img', {
        yPercent: 7,
        scale: 1.07,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.2 },
      })

      gsap.to('.hero-copy', {
        yPercent: 10,
        autoAlpha: 0.35,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: '35% top', end: 'bottom top', scrub: 1.1 },
      })

      gsap.utils.toArray('.motion-section').forEach((section) => {
        const title = section.querySelector('.motion-display')
        const eyebrow = section.querySelector('.section-eyebrow')
        const cards = section.querySelectorAll('[data-motion-card]')

        if (title) {
          gsap.fromTo(title,
            { clipPath: 'inset(100% 0 0 0)', yPercent: 100, scaleX: 0.72, scaleY: 0.58, transformOrigin: 'left bottom' },
            {
              clipPath: 'inset(0% 0 0 0)', yPercent: 0, scaleX: 1, scaleY: 1,
              duration: 1.45, ease: 'expo.out',
              onComplete: () => gsap.set(title, { clearProps: 'transform,clipPath' }),
              scrollTrigger: { trigger: section, start: 'top 78%', once: true },
            },
          )
        }

        if (eyebrow) {
          gsap.fromTo(eyebrow, { autoAlpha: 0, x: -46 }, {
            autoAlpha: 1, x: 0, duration: 1, ease: 'power4.out',
            onComplete: () => gsap.set(eyebrow, { clearProps: 'transform,opacity,visibility' }),
            scrollTrigger: { trigger: section, start: 'top 76%', once: true },
          })
        }

        if (cards.length) {
          gsap.fromTo(cards,
            { autoAlpha: 0, y: 110, scale: 0.955, clipPath: 'inset(10% 0 0 0 round 30px)' },
            {
              autoAlpha: 1, y: 0, scale: 1, clipPath: 'inset(0% 0 0 0 round 0px)',
              duration: 1.25, stagger: 0.18, ease: 'power4.out',
              onComplete: () => gsap.set(cards, { clearProps: 'transform,opacity,visibility,clipPath' }),
              scrollTrigger: { trigger: section, start: 'top 62%', once: true },
            },
          )
        }
      })

      gsap.utils.toArray('.project-card').forEach((card, index) => {
        const visual = card.querySelector('.project-visual')
        if (!visual) return
        gsap.fromTo(visual, { yPercent: -5 - index }, {
          yPercent: 7 + index,
          ease: 'none',
          scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: 1.4 },
        })
      })

      gsap.fromTo('.profile-cat-image', { yPercent: -4, scale: 1.045 }, {
        yPercent: 5,
        scale: 1.08,
        ease: 'none',
        scrollTrigger: { trigger: '.about-experience-card', start: 'top bottom', end: 'bottom top', scrub: 1.5 },
      })

      if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh())
    }, scope)

    return () => {
      document.body.classList.remove('is-opening')
      context.revert()
    }
  }, [scopeRef, skipOpening])

  return null
}
