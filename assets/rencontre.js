/* Maison Goffier : page de rencontre salon. JavaScript natif, zéro dépendance, tout est du confort :
   sans lui, la sélection des pièces et l'envoi du formulaire fonctionnent quand même (POST natif).
   Les libellés arrivent traduits (FR/EN) via mgRencontre.t. */
(function () {
	'use strict';

	var cfg = window.mgRencontre || {};
	var t = cfg.t || {};
	function txt(k, fallback) { return t[k] || fallback; }
	var form = document.getElementById('mg-form');
	var tokenField = document.getElementById('mg-t');

	/* 1. Amorçage : compteur de scans + jeton frais (jamais mis en cache, c'est un POST). */
	function bootstrap() {
		if (!cfg.bootstrap || !window.fetch) { return; }
		fetch(cfg.bootstrap, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ecran: cfg.ecran || 'page' }),
			credentials: 'same-origin',
			cache: 'no-store'
		}).then(function (r) { return r.ok ? r.json() : null; })
		  .then(function (d) { if (d && d.token && tokenField) { tokenField.value = d.token; } })
		  .catch(function () { /* le jeton rendu côté serveur reste valable */ });
	}
	bootstrap();

	if (!form) { return; }

	/* 2. Sélection des pièces : pastilles du formulaire et barre flottante reflètent les cartes. */
	var cardInputs = Array.prototype.slice.call(document.querySelectorAll('.mg-carte__input'));
	var pills = Array.prototype.slice.call(document.querySelectorAll('.mg-pilule[data-for]'));
	var bar = document.getElementById('mg-barre');
	var count = document.getElementById('mg-compte');
	var barTimer = null;

	function refresh() {
		var n = 0;
		cardInputs.forEach(function (i) { if (i.checked) { n++; } });
		pills.forEach(function (p) {
			var input = document.getElementById(p.getAttribute('data-for'));
			p.classList.toggle('est-choisie', !!(input && input.checked));
		});
		if (!bar) { return; }
		if (n > 0 && !form.classList.contains('est-visible')) {
			count.textContent = n === 1 ? txt('une', '1 pièce retenue') : txt('plusieurs', '%d pièces retenues').replace('%d', n);
			bar.hidden = false;
			clearTimeout(barTimer);
			barTimer = setTimeout(function () { bar.classList.add('est-visible'); document.body.classList.add('mg-barre-visible'); }, 20);
		} else {
			bar.classList.remove('est-visible');
			document.body.classList.remove('mg-barre-visible');
			clearTimeout(barTimer);
			barTimer = setTimeout(function () { bar.hidden = true; }, 320);
		}
	}
	cardInputs.forEach(function (i) { i.addEventListener('change', refresh); });
	refresh();

	/* La barre disparaît quand le formulaire est à l'écran. */
	if ('IntersectionObserver' in window) {
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (e) { form.classList.toggle('est-visible', e.isIntersecting); refresh(); });
		}, { threshold: 0.05 });
		io.observe(form);
	}

	/* 3. Envoi : validation douce, puis REST ; en cas de panne réseau, POST natif. */
	var btn = document.getElementById('mg-envoyer');
	var btnSpans = btn ? Array.prototype.slice.call(btn.children) : [];
	var btnLabels = btnSpans.map(function (s) { return s.textContent; });
	function setBtnLabel(t) { btnSpans.forEach(function (s, i) { s.textContent = t === null ? btnLabels[i] : t; }); }
	var errBox = document.getElementById('mg-erreur');
	var sending = false;

	function showError(msg) {
		if (!errBox) { return; }
		errBox.textContent = msg;
		errBox.hidden = false;
		errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function validate() {
		var bad = [];
		['mg-prenom', 'mg-nom', 'mg-email'].forEach(function (id) {
			var el = document.getElementById(id);
			var ok = el && el.value.trim() !== '' && (id !== 'mg-email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()));
			if (el) { el.classList.toggle('est-invalide', !ok); }
			if (!ok) { bad.push(el); }
		});
		var consent = form.querySelector('input[name="consentement"]');
		if (bad.length) {
			showError(txt('err_champs', 'Merci de renseigner votre prénom, votre nom et une adresse e-mail valide.'));
			bad[0].focus();
			return false;
		}
		if (consent && !consent.checked) {
			showError(txt('err_consent', 'Merci d’accepter que Maison Goffier vous recontacte.'));
			consent.focus();
			return false;
		}
		if (errBox) { errBox.hidden = true; }
		return true;
	}

	form.addEventListener('submit', function (ev) {
		if (sending) { ev.preventDefault(); return; }
		if (!validate()) { ev.preventDefault(); return; }
		if (!cfg.lead || !window.fetch || !window.FormData) { return; /* POST natif */ }
		ev.preventDefault();
		sending = true;
		btn.disabled = true;
		setBtnLabel(txt('envoi', 'Envoi en cours…'));

		fetch(cfg.lead, { method: 'POST', body: new FormData(form), credentials: 'same-origin', cache: 'no-store' })
			.then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); })
			.then(function (res) {
				if (res.data && res.data.ok && res.data.redirect) {
					window.location.href = res.data.redirect;
					return;
				}
				sending = false;
				btn.disabled = false;
				setBtnLabel(null);
				showError((res.data && res.data.message) || txt('err_envoi', 'Votre demande n’a pas pu être transmise. Merci de réessayer.'));
			})
			.catch(function () {
				/* Réseau de salon défaillant ou route REST indisponible : on laisse le navigateur poster. */
				sending = false;
				form.submit();
			});
	});
})();
