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
                this._showDashboard();
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
        window.chartInterval = null;

        document.getElementById('main-view').classList.add('hidden');
        document.getElementById('login-view').classList.remove('hidden');
        document.getElementById('admin-id').value = '';
        document.getElementById('admin-pass').value = '';
        document.getElementById('login-error').style.display = 'none';
    },

    _showDashboard: function () {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('main-view').classList.remove('hidden');

        fetchData();

        clearInterval(window.chartInterval);
        window.chartInterval = setInterval(fetchData, 5000);
    },

    checkSession: function () {
        const user = localStorage.getItem('aq_user');
        if (user) {
            this._showDashboard();
        }
    }
};

// ==========================================
// NAVIGATION
// ==========================================
const appNav = {
    switchTab: function (tabId, clickedBtn) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(tabId).classList.remove('hidden');
        clickedBtn.classList.add('active');
    },

    toggleDrawer: function () {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const isOpen = sidebar.classList.contains('open');
        sidebar.classList.toggle('open', !isOpen);
        overlay.classList.toggle('hidden', isOpen);
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
        btn.innerText = 'Analyzing...';
        btn.disabled = true;

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
                const ai = json.data.ai_prediction;
                document.getElementById('ai-result-card').classList.remove('hidden');
                document.getElementById('res-disease').innerText = ai.disease;
                document.getElementById('res-danger').innerText = ai.danger;
                document.getElementById('res-solution').innerText = ai.solution;
                document.getElementById('res-precautions').innerText = ai.precautions;

                // MODIFIED — show LLM explanation if present
                const explanationEl = document.getElementById('res-ai-explanation');
                const explanationWrap = document.getElementById('ai-explanation-wrap');
                if (explanationEl && json.data.ai_explanation) {
                    explanationEl.innerText = json.data.ai_explanation;
                    explanationWrap.classList.remove('hidden');
                }
            } else {
                alert('AI Error: ' + (json.message || 'Unknown error'));
            }
        } catch (e) {
            alert('Could not connect to AI backend.');
            console.error('Diagnosis error:', e);
        } finally {
            btn.innerText = 'Run Diagnosis';
            btn.disabled = false;
        }
    }
};

// ==========================================
// CHART
// ==========================================
let historyChart = null;

function updateChart(records) {
    const canvas = document.getElementById('historyChart');
    if (!canvas) return;

    const labels = records.map(r => (r.timestamp || '').split(' ')[1] || r.timestamp || '');
    const tempData = records.map(r => Number(r.temperature) || 0);
    const ammoniaData = records.map(r => Number(r.ammonia) || 0);

    if (historyChart) {
        historyChart.data.labels = labels;
        historyChart.data.datasets[0].data = tempData;
        historyChart.data.datasets[1].data = ammoniaData;
        historyChart.update('none'); // no animation on refresh
        return;
    }

    historyChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: tempData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.15)',
                    tension: 0.3,
                    pointRadius: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'Ammonia (ppm)',
                    data: ammoniaData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.15)',
                    tension: 0.3,
                    pointRadius: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: { type: 'linear', position: 'left', title: { display: true, text: 'Temp (°C)' } },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'Ammonia (ppm)' }, grid: { drawOnChartArea: false } }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
}

// ==========================================
// SENSOR CARDS
// ==========================================
function updateCards(latest) {
    if (!latest) return;

    const temp = Number(latest.temperature);
    const ph = Number(latest.ph);
    const turbidity = Number(latest.turbidity);
    const ammonia = Number(latest.ammonia);

    // Values
    document.getElementById('card-temperature').innerHTML = `${temp.toFixed(1)}<span class="unit">°C</span>`;
    document.getElementById('card-ph').innerHTML = ph.toFixed(2);
    document.getElementById('card-turbidity').innerHTML = `${turbidity.toFixed(1)}<span class="unit">NTU</span>`;
    document.getElementById('card-ammonia').innerHTML = `${ammonia.toFixed(2)}<span class="unit">ppm</span>`;

    // Progress bars (clamped 0–100%)
    document.getElementById('bar-temperature').style.width = Math.min((temp / 40) * 100, 100) + '%';
    document.getElementById('bar-ph').style.width = Math.min((ph / 14) * 100, 100) + '%';
    document.getElementById('bar-turbidity').style.width = Math.min((turbidity / 50) * 100, 100) + '%';
    document.getElementById('bar-ammonia').style.width = Math.min((ammonia / 5) * 100, 100) + '%';

    // Highlight ammonia card if dangerous
    const ammoniaWrap = document.getElementById('card-ammonia-wrap');
    if (ammonia >= 0.5) {
        ammoniaWrap.classList.add('alert-state');
    } else {
        ammoniaWrap.classList.remove('alert-state');
    }
}

// ==========================================
// MAIN FETCH (single call for both chart + cards)
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
        updateCards(json.data[0]); // newest record for the cards
    } catch (e) {
        console.error('fetchData error:', e);
    }
}

// ==========================================
// INIT
// ==========================================
window.addEventListener('load', () => {
    appAuth.checkSession();
});
