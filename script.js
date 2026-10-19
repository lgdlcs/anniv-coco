/* ============================================================
   Anniversaire de Coco — déclenchement "à l'arrivée" + FREIN.

   AMÉLIORATION PROGRESSIVE (robustesse navigateurs) :
   - le script n'ajoute la classe "js" au <html> que s'il peut réellement
     animer (IntersectionObserver présent, pas de "mouvement réduit").
   - le CSS ne masque le contenu (opacity:0 en attendant l'animation) QUE
     sous .js. Donc sans JS (vieux Edge, mode IE en entreprise, JS bloqué,
     ou erreur) → tout le contenu reste visible et lisible.
   - tout est enveloppé dans un try/catch qui retire .js en cas d'erreur.

   Fonctionnement (quand actif) : chaque scène "snap" plein écran ; une
   IntersectionObserver arme sa timeline (.is-active) dès qu'elle occupe
   l'écran → l'animation se joue jusqu'au tampon REFUSÉ. FREIN : le scroll
   est verrouillé pendant l'animation, puis relâché (indice "↓").
   ============================================================ */
(function () {
  "use strict";

  var docEl = document.documentElement;
  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

  /* Sans IntersectionObserver ou en "mouvement réduit" : on n'améliore pas.
     Pas de classe "js" → le CSS laisse tout le contenu visible statiquement. */
  if (!("IntersectionObserver" in window) || reduceMotion) return;

  try {
    docEl.classList.add("js");

    /* Durée du frein par type de scène (ms). */
    var BRAKE = { intro: 1200, fake: 1900, real: 1500 };

    var slides  = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    var gifts   = Array.prototype.slice.call(document.querySelectorAll(".gift[data-step]"));
    var dots    = document.querySelectorAll(".dot");
    var dotsBox = document.querySelector(".dots");
    var counter = document.getElementById("counter");

    var LABELS = ["Le brief", "Proposition 1 / 5", "Proposition 2 / 5", "Proposition 3 / 5",
                  "Proposition 4 / 5", "Proposition 5 / 5", "Le vrai cadeau 🤿"];

    var locked = false;          // le frein est-il serré ?
    var brakeTimer = null;
    var activeGift = null;

    /* ---------- LE FREIN ---------- */
    function applyBrake(slide) {
      var ms = BRAKE[slide.dataset.kind] || 1400;
      locked = true;
      document.body.classList.add("is-locked");
      slide.classList.remove("is-ready");
      clearTimeout(brakeTimer);
      brakeTimer = setTimeout(function () {
        locked = false;
        document.body.classList.remove("is-locked");
        slide.classList.add("is-ready");        // → fait apparaître l'indice "↓"
      }, ms);
    }
    function releaseBrake() {
      clearTimeout(brakeTimer);
      locked = false;
      document.body.classList.remove("is-locked");
    }

    /* bloque toute tentative de scroll tant que le frein est serré */
    function blockScroll(e) { if (locked) { e.preventDefault(); e.stopPropagation(); } }
    var NAV_KEYS = { ArrowDown: 1, ArrowUp: 1, PageDown: 1, PageUp: 1,
                     " ": 1, Spacebar: 1, Home: 1, End: 1 };
    function blockKeys(e) { if (locked && NAV_KEYS[e.key]) e.preventDefault(); }

    window.addEventListener("wheel", blockScroll, { passive: false });
    window.addEventListener("touchmove", blockScroll, { passive: false });
    window.addEventListener("keydown", blockKeys, false);

    /* ---------- Activation des scènes ---------- */
    function setActive(slide, on) {
      if (slide.classList.contains("hero")) return;          // le hero reste figé "actif"
      if (on) {
        if (!slide.classList.contains("is-active")) {
          slide.classList.remove("is-active");
          void slide.offsetWidth;                            // reflow → rejoue la timeline
          slide.classList.add("is-active");
        }
      } else {
        slide.classList.remove("is-active");
        slide.classList.remove("is-ready");
      }
    }

    function onIntersect(entries) {
      entries.forEach(function (entry) {
        var on = entry.isIntersecting && entry.intersectionRatio >= 0.55;
        setActive(entry.target, on);
        if (!on) return;

        if (entry.target.dataset.step != null) {
          /* une scène-cadeau prend l'écran */
          var i = +entry.target.dataset.step;
          Array.prototype.forEach.call(dots, function (d, k) { d.classList.toggle("is-active", k === i); });
          if (counter && counter.textContent !== LABELS[i]) counter.textContent = LABELS[i];
          document.body.classList.toggle("is-finale", entry.target.dataset.kind === "real");
          if (entry.target !== activeGift) {                 // nouvelle scène → on (re)freine
            activeGift = entry.target;
            applyBrake(entry.target);
          }
        } else {
          /* hero ou outro → scroll libre */
          activeGift = null;
          releaseBrake();
        }
      });

      var onGift = gifts.some(function (g) { return g.classList.contains("is-active"); });
      if (dotsBox) dotsBox.classList.toggle("is-hidden", !onGift);
      if (counter) counter.classList.toggle("is-hidden", !onGift);
    }

    var io = new IntersectionObserver(onIntersect, { threshold: [0, 0.55, 0.9] });
    slides.forEach(function (s) { io.observe(s); });

    /* ---------- Confettis ambiants ---------- */
    function makeConfetti() {
      var box = document.getElementById("confetti");
      if (!box) return;
      var colors = ["#f4c95d", "#ff5e8a", "#5ec6ff", "#3ad28a", "#ffffff", "#d9a93a"];
      var N = window.innerWidth < 720 ? 50 : 90;
      var html = "";
      for (var k = 0; k < N; k++) {
        var left  = (Math.random() * 100).toFixed(2);
        var size  = (5 + Math.random() * 8).toFixed(1);
        var dur   = (5 + Math.random() * 6).toFixed(2);
        var delay = (-Math.random() * 11).toFixed(2);
        var col   = colors[(Math.random() * colors.length) | 0];
        var round = Math.random() > 0.5 ? "border-radius:50%;" : "";
        var w = size, h = round ? size : (parseFloat(size) * 1.6).toFixed(1);
        html += "<i style=\"left:" + left + "vw;width:" + w + "px;height:" + h + "px;"
              + "background:" + col + ";" + round
              + "animation-duration:" + dur + "s;animation-delay:" + delay + "s;\"></i>";
      }
      box.innerHTML = html;
    }

    /* bouton "revoir" → remonte en haut (le frein est relâché sur le hero) */
    var replay = document.getElementById("replay");
    if (replay) replay.addEventListener("click", function () {
      releaseBrake();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    makeConfetti();

  } catch (err) {
    /* dégradation gracieuse : on retire .js → le CSS réaffiche tout, et on
       lève tout verrou de scroll. Le site reste lisible. */
    docEl.classList.remove("js");
    if (document.body) document.body.classList.remove("is-locked");
    if (window.console && window.console.error) window.console.error("Anniv — fallback statique :", err);
  }
})();
