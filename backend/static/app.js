// ==========================================
// AUTH
// ==========================================
const appAuth = {
    login: async function () {
        const username = document.getElementById('admin-id').value.trim();
        const password = document.getElementById('admin-pass').value.trim();
        const errorEl = document.getElementById('login-error');

        errorEl.style.display = 'none';

        if (!username || !password) {
            errorEl.textContent = 'Please enter your username and password.';
            errorEl.style.display = 'block';
            return;
        }

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const json = await res.json();

            if (json.success) {
                localStorage.setItem('aq_user', JSON.stringify(json.data));
                this._showDashboard(json.data);
            } else {
                errorEl.textContent = json.message || 'Login failed.';
                errorEl.style.display = 'block';
            }
        } catch (e) {
            errorEl.textContent = 'Could not connect to server.';
            errorEl.style.display = 'block';
            console.error('Login error:', e);
        }
    },

    logout: function () {
        localStorage.removeItem('aq_user');
        clearInterval(window.chartInterval);
        clearInterval(window.clockInterval);
        window.chartInterval = null;
        window.clockInterval = null;

        document.getElementById('main-view').classList.add('hidden');
        document.getElementById('login-view').classList.remove('hidden');

        const idEl = document.getElementById('admin-id');
        const passEl = document.getElementById('admin-pass');
        if (idEl) idEl.value = '';
        if (passEl) passEl.value = '';

        const errEl = document.getElementById('login-error');
        if (errEl) errEl.style.display = 'none';
    },

    _showDashboard: function (userData) {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');

        if (userData) {
            const name = userData.username || 'Admin';
            const initial = name.charAt(0).toUpperCase();
            const navAvatar = document.getElementById('nav-avatar');
            const navUser   = document.getElementById('nav-username');
            const sideAvatar = document.getElementById('sidebar-avatar');
            const sideUser   = document.getElementById('sidebar-username');
            if (navAvatar)   navAvatar.textContent   = initial;
            if (navUser)     navUser.textContent      = name;
            if (sideAvatar)  sideAvatar.textContent   = initial;
            if (sideUser)    sideUser.textContent     = name;
        }

        appClock.start();
        fetchData();

        clearInterval(window.chartInterval);
        window.chartInterval = setInterval(fetchData, 5000);
    },

    checkSession: function () {
        const raw = localStorage.getItem('aq_user');
        if (raw) {
            try {
                const user = JSON.parse(raw);
                this._showDashboard(user);
            } catch (e) {
                this._showDashboard(null);
            }
        }
    }
};

// ==========================================
// NAVIGATION
// ==========================================
const appNav = {
    switchTab: function (tabId, clickedBtn) {
        document.querySelectorAll('.tab-content').forEach(t => {
            t.classList.remove('active');
            t.style.display = '';
        });
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        const target = document.getElementById(tabId);
        if (target) {
            target.classList.add('active');
        }
        if (clickedBtn) {
            clickedBtn.classList.add('active');
        }

        // close sidebar on mobile after nav
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth <= 1024 && sidebar && sidebar.classList.contains('open')) {
            this.toggleDrawer();
        }
    },

    toggleDrawer: function () {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const isOpen  = sidebar.classList.contains('open');
        sidebar.classList.toggle('open', !isOpen);
        overlay.classList.toggle('hidden', isOpen);
    },

    setActiveNav: function (el) {
        document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
        el.classList.add('active');
    }
};

// ==========================================
// ALERTS
// ==========================================
const appAlerts = {
    showEmergencyModal: function () {
        document.getElementById('emergency-modal').classList.remove('hidden');
    },
    hideEmergencyModal: function () {
        document.getElementById('emergency-modal').classList.add('hidden');
    }
};

// ==========================================
// AI DIAGNOSIS
// ==========================================
const appAi = {
    runDiagnosis: async function () {
        const btn = document.getElementById('diag-btn');
        btn.innerHTML = '<span class="spinner"></span>ANALYZING';
        btn.disabled = true;
        btn.classList.add('scanning');

        const payload = {
            temperature: document.getElementById('sim-temp').value,
            ph: document.getElementById('sim-ph').value,
            turbidity: document.getElementById('sim-turbidity').value,
            ammonia: document.getElementById('sim-ammonia').value
        };

        try {
            const res = await fetch('/api/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.success) {
                const ai     = json.data.ai_prediction;
                const status = json.data.status || 'Healthy';

                // Hide placeholder, show results
                const placeholder = document.getElementById('result-placeholder');
                const content     = document.getElementById('result-content');
                if (placeholder) placeholder.style.display = 'none';
                if (content)     content.style.display = 'block';

                // Status badge
                const badge = document.getElementById('result-status-badge');
                if (badge) {
                    badge.textContent  = status.toUpperCase();
                    badge.className    = 'result-status-badge ' + status.toLowerCase();
                }

                // Danger meter (1-5 segments)
                const dangerText = (ai.danger || '').toLowerCase();
                let dangerLevel = 1;
                if (dangerText.includes('critical')) dangerLevel = 5;
                else if (dangerText.includes('high'))     dangerLevel = 4;
                else if (dangerText.includes('medium'))   dangerLevel = 3;
                else if (dangerText.includes('low'))      dangerLevel = 2;
                else if (dangerText.includes('none') || dangerText.includes('no action')) dangerLevel = 0;

                const colors = ['#00e676','#00e676','#ffba00','#ff9000','#ff3860','#ff3860'];
                const segs   = document.querySelectorAll('#danger-meter .danger-seg');
                segs.forEach((s, i) => {
                    s.style.background = i < dangerLevel
                        ? (colors[dangerLevel] || '#ff3860')
                        : 'rgba(255,255,255,0.07)';
                });

                // Fields
                const diseaseEl = document.getElementById('res-disease');
                if (diseaseEl) {
                    diseaseEl.textContent = '';
                    appAi._typewriter(diseaseEl, ai.disease || 'Unknown', 40);
                }
                const dangerEl = document.getElementById('res-danger');
                if (dangerEl) dangerEl.textContent = ai.danger || '';

                const solEl = document.getElementById('res-solution');
                if (solEl) solEl.textContent = ai.solution || '';

                const precEl = document.getElementById('res-precautions');
                if (precEl) precEl.textContent = ai.precautions || '';

                // AI explanation accordion
                const wrap    = document.getElementById('ai-explanation-wrap');
                const expEl   = document.getElementById('res-ai-explanation');
                if (wrap && expEl && json.data.ai_explanation) {
                    expEl.textContent  = '';
                    wrap.style.display = 'block';
                    appAi._typewriter(expEl, json.data.ai_explanation, 8);
                } else if (wrap) {
                    wrap.style.display = 'none';
                }

                // scroll result into view
                document.getElementById('ai-result-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            } else {
                alert('AI Error: ' + (json.message || 'Unknown error'));
            }
        } catch (e) {
            alert('Could not connect to AI backend.');
            console.error('Diagnosis error:', e);
        } finally {
            btn.innerHTML = 'RUN DIAGNOSIS';
            btn.disabled  = false;
            btn.classList.remove('scanning');
        }
    },

    _typewriter: function (el, text, speed) {
        let i = 0;
        const tick = setInterval(function () {
            el.textContent += text.charAt(i);
            i++;
            if (i >= text.length) clearInterval(tick);
        }, speed);
    },

    toggleAccordion: function (header) {
        const body = header.nextElementSibling;
        const isOpen = body.classList.contains('open');
        body.classList.toggle('open', !isOpen);
        header.classList.toggle('open', !isOpen);
    }
};

// ==========================================
// CLOCK
// ==========================================
const appClock = {
    start: function () {
        clearInterval(window.clockInterval);
        const el = document.getElementById('nav-clock');
        if (!el) return;
        const tick = function () {
            const now = new Date();
            el.textContent = now.toUTCString().split(' ')[4] + ' UTC';
        };
        tick();
        window.clockInterval = setInterval(tick, 1000);
    }
};

// ==========================================
// CHART
// ==========================================
let historyChart = null;

const appChart = {
    toggle: function (datasetIndex, btn) {
        if (!historyChart) return;
        const ds = historyChart.data.datasets[datasetIndex];
        ds.hidden = !ds.hidden;
        btn.classList.toggle('active', !ds.hidden);
        historyChart.update();
    }
};

function updateChart(records) {
    const canvas = document.getElementById('historyChart');
    if (!canvas) return;

    const labels       = records.map(r => {
        const t = (r.timestamp || '').split(' ')[1] || r.timestamp || '';
        return t.substring(0, 8);
    });
    const tempData      = records.map(r => Number(r.temperature) || 0);
    const ammoniaData   = records.map(r => Number(r.ammonia)     || 0);
    const phData        = records.map(r => Number(r.ph)          || 0);
    const turbidityData = records.map(r => Number(r.turbidity)   || 0);

    if (historyChart) {
        historyChart.data.labels                = labels;
        historyChart.data.datasets[0].data      = tempData;
        historyChart.data.datasets[1].data      = ammoniaData;
        historyChart.data.datasets[2].data      = phData;
        historyChart.data.datasets[3].data      = turbidityData;
        historyChart.update('none');
        return;
    }

    const ctx = canvas.getContext('2d');

    // custom tooltip plugin
    Chart.defaults.font.family = "'Share Tech Mono', monospace";
    Chart.defaults.color = '#546e7a';

    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Temp °C',
                    data: tempData,
                    borderColor: '#0080ff',
                    backgroundColor: 'rgba(0,128,255,0.08)',
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2
                },
                {
                    label: 'NH₃ ppm',
                    data: ammoniaData,
                    borderColor: '#ff3860',
                    backgroundColor: 'rgba(255,56,96,0.08)',
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2
                },
                {
                    label: 'pH',
                    data: phData,
                    borderColor: '#00e676',
                    backgroundColor: 'rgba(0,230,118,0.06)',
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2
                },
                {
                    label: 'Turbidity',
                    data: turbidityData,
                    borderColor: '#ffba00',
                    backgroundColor: 'rgba(255,186,0,0.06)',
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    grid: { color: 'rgba(0,255,200,0.05)', drawBorder: false },
                    ticks: { color: '#546e7a', font: { size: 10 }, maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(0,255,200,0.05)', drawBorder: false },
                    ticks: { color: '#546e7a', font: { size: 10 } }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#546e7a',
                        font: { family: "'Rajdhani', sans-serif", size: 13 },
                        boxWidth: 12,
                        padding: 16,
                        usePointStyle: true,
                        pointStyle: 'line'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(4,25,38,0.92)',
                    borderColor: 'rgba(0,255,200,0.2)',
                    borderWidth: 1,
                    titleColor: '#00ffe0',
                    bodyColor: '#e0f7fa',
                    titleFont: { family: "'Share Tech Mono', monospace", size: 11 },
                    bodyFont:  { family: "'Share Tech Mono', monospace", size: 11 },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true
                }
            }
        }
    });
}

// ==========================================
// STATUS BANNER
// ==========================================
function updateStatusBanner(latest) {
    if (!latest) return;

    const temp     = Number(latest.temperature);
    const ph       = Number(latest.ph);
    const turb     = Number(latest.turbidity);
    const ammonia  = Number(latest.ammonia);

    let status = 'nominal';
    let text   = 'SYSTEM NOMINAL';

    // danger conditions
    if (ammonia >= 0.5 || temp > 32 || temp < 18 || ph < 6 || ph > 9 || turb > 25) {
        status = 'danger';
        text   = 'CRITICAL ALERT';
    } else if (ammonia >= 0.25 || temp > 28 || temp < 22 || ph < 6.5 || ph > 8.5 || turb > 10) {
        status = 'warning';
        text   = 'WARNING DETECTED';
    }

    const banner    = document.getElementById('status-banner');
    const indicator = document.getElementById('status-indicator');
    const textEl    = document.getElementById('status-text');
    const emergBtn  = document.getElementById('emergency-btn');

    if (!banner) return;

    banner.className    = 'status-banner status-' + status;
    if (indicator) {
        indicator.className = 'status-indicator ' + (status === 'nominal' ? 'ok' : status);
    }
    if (textEl) textEl.textContent = text;

    if (emergBtn) {
        if (status !== 'nominal') {
            emergBtn.classList.remove('hidden');
        } else {
            emergBtn.classList.add('hidden');
        }
    }

    const params = document.getElementById('status-params');
    if (params) {
        params.innerHTML = `
            <span style="color:${temp > 32 || temp < 18 ? 'var(--danger)' : 'var(--safe)'}">🌡 ${temp.toFixed(1)}°C</span>
            <span style="color:${ammonia >= 0.5 ? 'var(--danger)' : ammonia >= 0.25 ? 'var(--warning)' : 'var(--safe)'}">⚗ ${ammonia.toFixed(2)} ppm</span>
        `;
    }
}

// ==========================================
// DATA FEED TABLE
// ==========================================
function updateDataFeed(records) {
    const tbody = document.getElementById('data-feed-body');
    if (!tbody || !records) return;

    const latest10 = records.slice(-10).reverse();

    tbody.innerHTML = latest10.map(function (r) {
        const ammonia = Number(r.ammonia);
        const temp    = Number(r.temperature);
        const ph      = Number(r.ph);
        const turb    = Number(r.turbidity);

        let badgeClass = 'badge-safe';
        let badgeText  = 'SAFE';
        if (ammonia >= 0.5 || temp > 32 || ph < 6 || ph > 9 || turb > 25) {
            badgeClass = 'badge-danger';
            badgeText  = 'DANGER';
        } else if (ammonia >= 0.25 || temp > 28 || turb > 10) {
            badgeClass = 'badge-warn';
            badgeText  = 'WARN';
        }

        const ts = (r.timestamp || '').split(' ')[1] || r.timestamp || '--';

        return `<tr>
            <td>${ts}</td>
            <td>${temp.toFixed(1)}</td>
            <td>${ph.toFixed(2)}</td>
            <td>${turb.toFixed(1)}</td>
            <td>${ammonia.toFixed(3)}</td>
            <td><span class="status-badge-sm ${badgeClass}">${badgeText}</span></td>
        </tr>`;
    }).join('');
}

// ==========================================
// GAUGE UPDATER
// ==========================================
function updateGauge(id, pct, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    const angle = Math.min(pct, 100) * 3.6;
    el.style.setProperty('--gauge-angle', angle + 'deg');
    el.style.setProperty('--gauge-color', colorClass);
}

// ==========================================
// COUNTUP ANIMATION
// ==========================================
function animateValue(el, targetText, duration) {
    if (!el) return;
    const match  = targetText.match(/^([\d.]+)(.*)/);
    if (!match) { el.innerHTML = targetText; return; }

    const target  = parseFloat(match[1]);
    const suffix  = match[2];
    const current = parseFloat(el.dataset.value || '0');
    const start   = performance.now();

    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 3);
        const value    = current + (target - current) * eased;
        el.dataset.value = target;
        el.innerHTML = value.toFixed(match[1].includes('.') ? (match[1].split('.')[1] || '').length : 0) + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ==========================================
// SENSOR CARDS
// ==========================================
function updateCards(latest) {
    if (!latest) return;

    const temp     = Number(latest.temperature);
    const ph       = Number(latest.ph);
    const turbidity = Number(latest.turbidity);
    const ammonia  = Number(latest.ammonia);

    // Values (with countup)
    const tempEl  = document.getElementById('card-temperature');
    const phEl    = document.getElementById('card-ph');
    const turbEl  = document.getElementById('card-turbidity');
    const ammoEl  = document.getElementById('card-ammonia');

    if (tempEl)  animateValue(tempEl,  temp.toFixed(1)      + '<span class="unit">°C</span>',  600);
    if (phEl)    animateValue(phEl,    ph.toFixed(2),                                           600);
    if (turbEl)  animateValue(turbEl,  turbidity.toFixed(1)  + '<span class="unit">NTU</span>', 600);
    if (ammoEl)  animateValue(ammoEl,  ammonia.toFixed(3)    + '<span class="unit">ppm</span>', 600);

    // Progress bars (app.js compatibility — clamped 0–100%)
    const tempBar  = document.getElementById('bar-temperature');
    const phBar    = document.getElementById('bar-ph');
    const turbBar  = document.getElementById('bar-turbidity');
    const ammoBar  = document.getElementById('bar-ammonia');

    if (tempBar)  tempBar.style.width  = Math.min((temp / 40) * 100, 100) + '%';
    if (phBar)    phBar.style.width    = Math.min((ph / 14) * 100, 100)   + '%';
    if (turbBar)  turbBar.style.width  = Math.min((turbidity / 50) * 100, 100) + '%';
    if (ammoBar)  ammoBar.style.width  = Math.min((ammonia / 5) * 100, 100)    + '%';

    // Gauge rings
    const tempPct  = (temp / 40) * 100;
    const phPct    = (ph / 14)   * 100;
    const turbPct  = (turbidity / 50) * 100;
    const ammoPct  = (ammonia / 5)    * 100;

    const tempColor = (temp > 32 || temp < 18)     ? '#ff3860' : temp > 28 ? '#ffba00' : '#00e676';
    const phColor   = (ph < 6 || ph > 9)           ? '#ff3860' : (ph < 6.5 || ph > 8.5) ? '#ffba00' : '#00e676';
    const turbColor = turbidity > 25               ? '#ff3860' : turbidity > 10 ? '#ffba00' : '#00ffe0';
    const ammoColor = ammonia >= 0.5               ? '#ff3860' : ammonia >= 0.25 ? '#ffba00' : '#00e676';

    updateGauge('gauge-temperature', tempPct,  tempColor);
    updateGauge('gauge-ph',          phPct,    phColor);
    updateGauge('gauge-turbidity',   turbPct,  turbColor);
    updateGauge('gauge-ammonia',     ammoPct,  ammoColor);

    // Alert state on ammonia card
    const ammoniaWrap = document.getElementById('card-ammonia-wrap');
    if (ammoniaWrap) {
        if (ammonia >= 0.5) {
            ammoniaWrap.classList.add('alert-state');
        } else {
            ammoniaWrap.classList.remove('alert-state');
        }
    }
}

// ==========================================
// TREND ARROWS
// ==========================================
let _prevReading = null;

function updateTrends(latest) {
    if (!_prevReading || !latest) { _prevReading = latest; return; }

    const fields = ['temperature', 'ph', 'turbidity', 'ammonia'];
    const ids    = ['trend-temperature', 'trend-ph', 'trend-turbidity', 'trend-ammonia'];

    fields.forEach(function (f, i) {
        const el   = document.getElementById(ids[i]);
        if (!el) return;
        const diff = Number(latest[f]) - Number(_prevReading[f]);
        if (Math.abs(diff) < 0.001) {
            el.textContent = '→';
            el.className   = 'trend-arrow trend-flat';
        } else if (diff > 0) {
            el.textContent = '↑';
            el.className   = 'trend-arrow trend-up';
        } else {
            el.textContent = '↓';
            el.className   = 'trend-arrow trend-down';
        }
    });

    _prevReading = latest;
}

// ==========================================
// MAIN FETCH (single call for chart + cards)
// ==========================================
async function fetchData() {
    try {
        const res = await fetch('/api/history');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
            console.warn('No history data available.');
            return;
        }

        // API returns newest-first; reverse for chart (left = oldest)
        const records = [...json.data].reverse();

        updateChart(records);
        updateCards(json.data[0]);       // newest record for the cards
        updateTrends(json.data[0]);
        updateStatusBanner(json.data[0]);
        updateDataFeed(records);
    } catch (e) {
        console.error('fetchData error:', e);
    }
}

// ==========================================
// RIPPLE EFFECT
// ==========================================
document.addEventListener('click', function (e) {
    const btn = e.target.closest('.ripple-btn, .btn-auth, .btn-diagnose, .btn-modal-primary, .btn-modal-dismiss');
    if (!btn) return;
    btn.classList.remove('rippling');
    void btn.offsetWidth;
    btn.classList.add('rippling');
    setTimeout(function () { btn.classList.remove('rippling'); }, 600);
});

// ==========================================
// INIT
// ==========================================
window.addEventListener('load', function () {
    appAuth.checkSession();
});
