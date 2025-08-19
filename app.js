(function() {
	'use strict';

	function pad2(n) { return String(n).padStart(2, '0'); }
	function toUtcIcsDateTime(date) {
		const iso = date.toISOString();
		return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
	}
	function toIcsDate(date) { return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`; }
	function escapeIcsText(text) {
		return String(text || '')
			.replace(/\\/g, '\\\\')
			.replace(/\n/g, '\\n')
			.replace(/,/g, '\\,')
			.replace(/;/g, '\\;');
	}
	function buildUid() { return `${Date.now()}-${Math.random().toString(36).slice(2)}@event.local`; }

	function parseForm() {
		const title = document.getElementById('title').value.trim();
		const dateStr = document.getElementById('date').value;
		const timeStr = document.getElementById('time').value;
		const durationMin = parseInt(document.getElementById('duration').value, 10) || 30;
		const locationV = document.getElementById('location').value.trim();
		const notes = document.getElementById('notes').value;
		const allDay = document.getElementById('allday').checked;
		if (!title) throw new Error('Введите название события');
		if (!dateStr) throw new Error('Выберите дату');
		let startDate, endDate, isAllDay = allDay;
		if (isAllDay) {
			const d = new Date(`${dateStr}T00:00:00`);
			startDate = d;
			endDate = new Date(d.getTime() + 24 * 60 * 60000);
		} else {
			if (!timeStr) throw new Error('Выберите время начала');
			const d = new Date(`${dateStr}T${timeStr}`);
			startDate = d;
			endDate = new Date(d.getTime() + durationMin * 60000);
		}
		return { title, startDate, endDate, location: locationV, notes, allDay: isAllDay };
	}

	function buildIcs(data) {
		const lines = [];
		lines.push('BEGIN:VCALENDAR');
		lines.push('VERSION:2.0');
		lines.push('PRODID:-//Event Configurator//RU');
		lines.push('CALSCALE:GREGORIAN');
		lines.push('METHOD:PUBLISH');
		lines.push('BEGIN:VEVENT');
		lines.push(`UID:${buildUid()}`);
		lines.push(`DTSTAMP:${toUtcIcsDateTime(new Date())}`);
		if (data.allDay) {
			lines.push(`DTSTART;VALUE=DATE:${toIcsDate(data.startDate)}`);
			lines.push(`DTEND;VALUE=DATE:${toIcsDate(data.endDate)}`);
		} else {
			lines.push(`DTSTART:${toUtcIcsDateTime(data.startDate)}`);
			lines.push(`DTEND:${toUtcIcsDateTime(data.endDate)}`);
		}
		lines.push(`SUMMARY:${escapeIcsText(data.title)}`);
		if (data.location) lines.push(`LOCATION:${escapeIcsText(data.location)}`);
		if (data.notes) lines.push(`DESCRIPTION:${escapeIcsText(data.notes)}`);
		lines.push('END:VEVENT');
		lines.push('END:VCALENDAR');
		return lines.join('\r\n');
	}

	function buildGoogleUrl(data) {
		const text = encodeURIComponent(data.title);
		const details = encodeURIComponent(data.notes || '');
		const location = encodeURIComponent(data.location || '');
		let dates;
		if (data.allDay) {
			const start = toIcsDate(data.startDate);
			const end = toIcsDate(data.endDate);
			dates = `${start}/${end}`;
		} else {
			const start = toUtcIcsDateTime(data.startDate);
			const end = toUtcIcsDateTime(data.endDate);
			dates = `${start}/${end}`;
		}
		const tz = encodeURIComponent((Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC');
		return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}&ctz=${tz}`;
	}

	function buildOutlookUrl(data) {
		const subject = encodeURIComponent(data.title);
		const body = encodeURIComponent(data.notes || '');
		const location = encodeURIComponent(data.location || '');
		const startdt = encodeURIComponent(data.startDate.toISOString());
		const enddt = encodeURIComponent(data.endDate.toISOString());
		return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${subject}&body=${body}&location=${location}&startdt=${startdt}&enddt=${enddt}`;
	}

	function setDefaults() {
		const now = new Date();
		const year = now.getFullYear();
		const month = pad2(now.getMonth() + 1);
		const day = pad2(now.getDate());
		const hours = pad2(now.getHours());
		const minutes = pad2(now.getMinutes());
		const dateEl = document.getElementById('date');
		const timeEl = document.getElementById('time');
		if (!dateEl.value) dateEl.value = `${year}-${month}-${day}`;
		if (!timeEl.value) timeEl.value = `${hours}:${minutes}`;
	}

	function toggleAllDay(force) {
		const isAllDay = force !== undefined ? force : document.getElementById('allday').checked;
		document.getElementById('time').disabled = isAllDay;
		document.getElementById('duration').disabled = isAllDay;
		const group = document.getElementById('durationCtrl');
		if (group) {
			group.querySelectorAll('button').forEach(btn => btn.disabled = isAllDay);
		}
	}

	function initDurationControl() {
		const group = document.getElementById('durationCtrl');
		if (!group) return;
		group.addEventListener('click', (e) => {
			const btn = e.target.closest('button[data-min]');
			if (!btn || btn.disabled) return;
			const value = btn.getAttribute('data-min');
			const hidden = document.getElementById('duration');
			if (hidden) hidden.value = value;
			group.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
		});
	}

	function syncDurationUI() {
		const hidden = document.getElementById('duration');
		const group = document.getElementById('durationCtrl');
		if (!hidden || !group) return;
		const value = String(parseInt(hidden.value, 10) || 30);
		let matched = false;
		group.querySelectorAll('button[data-min]').forEach(b => {
			const isActive = b.getAttribute('data-min') === value;
			b.classList.toggle('active', isActive);
			if (isActive) matched = true;
		});
		if (!matched) {
			const first = group.querySelector('button[data-min]');
			if (first) { first.classList.add('active'); hidden.value = first.getAttribute('data-min'); }
		}
	}

	function buildShareUrl() {
		const title = encodeURIComponent(document.getElementById('title').value.trim());
		const date = encodeURIComponent(document.getElementById('date').value);
		const time = encodeURIComponent(document.getElementById('time').value);
		const duration = encodeURIComponent(document.getElementById('duration').value);
		const locationV = encodeURIComponent(document.getElementById('location').value.trim());
		const notes = encodeURIComponent(document.getElementById('notes').value);
		const allday = document.getElementById('allday').checked ? '1' : '0';
		const url = `${location.origin}${location.pathname}?title=${title}&date=${date}&time=${time}&duration=${duration}&location=${locationV}&notes=${notes}&allday=${allday}&auto=1`;
		return url;
	}
	function buildDirectOpenUrl() {
		const title = encodeURIComponent(document.getElementById('title').value.trim());
		const date = encodeURIComponent(document.getElementById('date').value);
		const time = encodeURIComponent(document.getElementById('time').value);
		const duration = encodeURIComponent(document.getElementById('duration').value);
		const locationV = encodeURIComponent(document.getElementById('location').value.trim());
		const notes = encodeURIComponent(document.getElementById('notes').value);
		const allday = document.getElementById('allday').checked ? '1' : '0';
		const url = `${location.origin}${location.pathname}?title=${title}&date=${date}&time=${time}&duration=${duration}&location=${locationV}&notes=${notes}&allday=${allday}&auto=1&open=1`;
		return url;
	}

	function copy(text) {
		if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
		const ta = document.createElement('textarea');
		ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
		return Promise.resolve();
	}

	function buildLinksAndShow() {
		const data = parseForm();
		const ics = buildIcs(data);
		const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const icsA = document.getElementById('icsDownload');
		icsA.href = url;
		icsA.download = `${data.title.replace(/\s+/g, '_').slice(0, 40) || 'event'}.ics`;
		icsA.classList.remove('hidden');
		const g = document.getElementById('googleLink');
		g.href = buildGoogleUrl(data);
		g.classList.remove('hidden');
		const o = document.getElementById('outlookLink');
		o.href = buildOutlookUrl(data);
		o.classList.remove('hidden');
		document.getElementById('result').classList.remove('hidden');
	}

	function generateLinks(ev) {
		if (ev) ev.preventDefault();
		try { buildLinksAndShow(); } catch (e) { alert(e.message || 'Ошибка при генерации'); }
	}

	function applyUrlParams() {
		// Support Web Share Target params: title, notes (text), url
		const q = new URLSearchParams(location.search);
		const get = (k) => q.get(k) || '';
		if (get('title')) document.getElementById('title').value = get('title');
		if (get('date')) document.getElementById('date').value = get('date');
		if (get('time')) document.getElementById('time').value = get('time');
		if (get('duration')) document.getElementById('duration').value = get('duration');
		syncDurationUI();
		if (get('location')) document.getElementById('location').value = get('location');
		if (get('notes')) document.getElementById('notes').value = get('notes');
		// If shared URL provided, append it to notes
		if (get('url')) {
			const prev = document.getElementById('notes').value;
			document.getElementById('notes').value = prev ? `${prev}\n${get('url')}` : get('url');
		}
		if (get('allday')) document.getElementById('allday').checked = get('allday') === '1';
		if (document.getElementById('allday').checked) toggleAllDay(true);
		const auto = get('auto') === '1';
		const wantOpen = get('open') === '1';
		if (auto || get('title') || get('date')) {
			try {
				buildLinksAndShow();
				if (wantOpen) {
					setTimeout(() => {
						const a = document.getElementById('icsDownload');
						if (a && a.href) {
							try { a.click(); } catch (e) { window.location.href = a.href; }
						}
					}, 150);
				}
			} catch (e) {}
		}
	}

	function updateThemeBtn(theme) {
		const btn = document.getElementById('themeBtn');
		if (!btn) return; btn.textContent = theme === 'dark' ? '🌙' : '☀️';
	}
	function applyTheme(theme) {
		document.documentElement.setAttribute('data-theme', theme);
		try { localStorage.setItem('theme', theme); } catch (e) {}
		updateThemeBtn(theme);
	}
	function initTheme() {
		let theme = 'light';
		try { theme = localStorage.getItem('theme') || theme; } catch (e) {}
		if (!theme) theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
		applyTheme(theme);
	}

	function initParallax() {
		const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const smallScreen = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
		if (reduce || smallScreen) return;
		let raf = null;
		const root = document.documentElement;
		const card = document.getElementById('card');
		function onMove(e) {
			const vw = window.innerWidth, vh = window.innerHeight;
			const x = (e.clientX / vw) * 2 - 1; // [-1..1]
			const y = (e.clientY / vh) * 2 - 1;
			if (raf) cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				root.style.setProperty('--mx', x.toFixed(3));
				root.style.setProperty('--my', y.toFixed(3));
				if (card) card.style.transform = `perspective(1000px) rotateX(${(-y*2).toFixed(2)}deg) rotateY(${(x*2).toFixed(2)}deg)`;
			});
		}
		window.addEventListener('pointermove', onMove);
		window.addEventListener('mouseleave', () => { if (card) card.style.transform = ''; });
	}

	function initParallaxGyro() {
		const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduce) return () => {};
		const card = document.getElementById('card');
		let enabled = false;
		let handler = null;
		function onOrient(e) {
			if (!enabled || !card) return;
			const beta = e.beta || 0;  // x tilt [-180..180]
			const gamma = e.gamma || 0; // y tilt [-90..90]
			const x = Math.max(-1, Math.min(1, gamma / 45));
			const y = Math.max(-1, Math.min(1, beta / 45));
			card.style.transform = `perspective(1000px) rotateX(${(-y*4).toFixed(2)}deg) rotateY(${(x*4).toFixed(2)}deg)`;
		}
		async function requestPermissionIfNeeded() {
			const AnyOrientation = window.DeviceOrientationEvent || window.OrientationEvent;
			if (!AnyOrientation) return false;
			if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
				try {
					const res = await DeviceOrientationEvent.requestPermission();
					return res === 'granted';
				} catch (e) { return false; }
			}
			return true;
		}
		async function enable() {
			if (enabled) return true;
			const ok = await requestPermissionIfNeeded();
			if (!ok) return false;
			enabled = true;
			handler = onOrient;
			window.addEventListener('deviceorientation', handler);
			try { localStorage.setItem('gyro', '1'); } catch (e) {}
			return true;
		}
		function disable() {
			enabled = false;
			if (handler) window.removeEventListener('deviceorientation', handler);
			if (card) card.style.transform = '';
			try { localStorage.setItem('gyro', '0'); } catch (e) {}
		}
		function isSmall() { return window.matchMedia && window.matchMedia('(max-width: 640px)').matches; }
		function initFromStorage() {
			let want = '0';
			try { want = localStorage.getItem('gyro') || '0'; } catch (e) {}
			if (want === '1' && isSmall()) enable();
		}
		initFromStorage();
		return { enable, disable };
	}

	document.addEventListener('DOMContentLoaded', () => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('./sw.js').catch(() => {});
		}
		initTheme();
		setDefaults();
		applyUrlParams();
		document.getElementById('allday').addEventListener('change', () => toggleAllDay());
		initDurationControl();
		syncDurationUI();
		document.getElementById('generateBtn').addEventListener('click', generateLinks);
		document.getElementById('copyShareBtn').addEventListener('click', async () => {
			const url = buildDirectOpenUrl();
			await copy(url);
			const el = document.getElementById('result');
			el.textContent = 'Ссылка для добавления скопирована. Отправьте её — у получателя откроется добавление в Календарь.';
			el.classList.remove('hidden');
		});
		document.getElementById('themeBtn').addEventListener('click', () => {
			const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
			applyTheme(next);
		});
		const gyro = initParallaxGyro();
		const motionBtn = document.getElementById('motionBtn');
		if (motionBtn) {
			motionBtn.addEventListener('click', async () => {
				let want = '0';
				try { want = localStorage.getItem('gyro') || '0'; } catch (e) {}
				if (want === '1') {
					gyro.disable();
				} else {
					const ok = await gyro.enable();
					if (!ok) alert('Гироскоп недоступен или не разрешён.');
				}
			});
		}
		initParallax();
		// expose for potential debug
		window.EventConfigurator = { generateLinks };
	});
})(); 