const BASE_URL = window.location.protocol.startsWith('http') ? window.location.origin : 'http://localhost:3000'; 
let allStations = [];

window.onload = async () => {
    try {
        const res = await fetch(`${BASE_URL}/api/all-stations`);
        if (!res.ok) throw new Error("Backend response error");
        allStations = await res.json();
        renderGrid(allStations.slice(0, 50));
    } catch (err) { 
        console.error("Is backend running?", err); 
        const list = document.getElementById('station-list');
        list.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2rem; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 12px; color: #f87171;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <h3>Backend Server Not Connected</h3>
                <p style="margin-top: 5px;">Please start the backend server at <code>http://localhost:3000</code> or run <code>run_project.bat</code>.</p>
            </div>
        `;
    }
};

function renderGrid(data) {
    const list = document.getElementById('station-list');
    if (!data || data.length === 0) {
        list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-dim);">No stations found.</p>`;
        return;
    }
    list.innerHTML = data.map(s => `
        <div class="station-card" onclick="analyzeStation('${s.name}')">
            <h3>${s.name}</h3><p>${s.district}</p>
        </div>
    `).join('');
}

async function analyzeStation(name) {
    const loader = document.getElementById('loader-overlay');
    const output = document.getElementById('prediction-output');
    loader.classList.remove('hidden');
    output.classList.add('hidden');

    try {
        const res = await fetch(`${BASE_URL}/api/search?place=${encodeURIComponent(name)}`);
        if (!res.ok) throw new Error("Station analysis failed");
        const data = await res.json();

        document.getElementById('res-location').innerText = data.station;
        document.getElementById('res-level').innerText = data.estimatedLevel + "m";
        document.getElementById('res-forecast').innerText = data.forecastLevel + "m";
        document.getElementById('res-wpi').innerText = data.wpi + "%";
        document.getElementById('res-hum').innerText = data.humidity + "%";
        document.getElementById('res-temp').innerText = data.temp + "°C";
        document.getElementById('res-suggest').innerText = data.recommendation;

        output.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { 
        alert("Failed to analyze station. Please check backend connection.");
        console.error("Error analyzing station:", err); 
    }
    finally { loader.classList.add('hidden'); }
}

function goHome() {
    const output = document.getElementById('prediction-output');
    if (output) output.classList.add('hidden');
    
    const searchInput = document.getElementById('search-bar');
    if (searchInput) searchInput.value = '';
    
    renderGrid(allStations.slice(0, 50));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('search-bar').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allStations.filter(s => s.name.toLowerCase().includes(term));
    renderGrid(filtered.slice(0, 50));
});