require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENWEATHER_API_KEY || 'YOUR_OPENWEATHER_API_KEY_HERE'; 
const csvPath = path.join(__dirname, 'data', 'groundwater_history.csv');

// --- IN-MEMORY CACHE FOR INSTANT RESPONSES ---
let stationList = [];
let stationDataMap = new Map();
let isLoaded = false;
let loadingPromise = null;

function loadDataIntoMemory() {
    if (isLoaded) return Promise.resolve();
    if (loadingPromise) return loadingPromise;

    loadingPromise = new Promise((resolve, reject) => {
        if (!fs.existsSync(csvPath)) {
            loadingPromise = null;
            return reject("CSV Missing");
        }
        console.log("⚡ Preloading groundwater dataset into RAM...");
        const stations = [];
        const map = new Map();

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                const name = (row.station_name || row['station_name'] || "").trim();
                if (!name) return;
                const lowerKey = name.toLowerCase();
                const district = (row.district_name || "Regional").trim();
                const level = parseFloat(row.currentlevel || 5.0);

                if (!map.has(lowerKey)) {
                    map.set(lowerKey, { originalName: name, district: district, history: [] });
                    stations.push({ name: name, district: district });
                }
                map.get(lowerKey).history.push(level);
            })
            .on('end', () => {
                stationList = stations;
                stationDataMap = map;
                isLoaded = true;
                console.log(`🚀 Dataset cached in memory! ${stationList.length} stations loaded.`);
                resolve();
            })
            .on('error', (err) => {
                loadingPromise = null;
                reject(err);
            });
    });

    return loadingPromise;
}

// ML Logic: Linear Regression for 1-Year Forecast
function predictFuture(data) {
    if (!Array.isArray(data) || data.length < 2) return "Stable";
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    data.forEach((val, i) => {
        sumX += i; sumY += val;
        sumXY += i * val; sumXX += i * i;
    });
    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return (sumY / n).toFixed(2);
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const nextVal = (sumY / n) + slope * (n - (sumX / n));
    return isNaN(nextVal) ? "Stable" : nextVal.toFixed(2);
}

// Route 1: Initial Grid Load (Instant <5ms)
app.get('/api/all-stations', async (req, res) => {
    try {
        if (!isLoaded) await loadDataIntoMemory();
        res.json(stationList);
    } catch (e) {
        res.status(500).json({ error: "Data load failed" });
    }
});

// Route 2: Analysis & Prediction (Instant <5ms)
app.get('/api/search', async (req, res) => {
    const query = (req.query.place || "").toLowerCase().trim();
    try {
        if (!isLoaded) await loadDataIntoMemory();

        const stationData = stationDataMap.get(query);
        if (!stationData) return res.status(404).json({ error: "No data" });

        const { originalName, district, history } = stationData;

        let hum = 45, tmp = 28;
        try {
            const weather = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(district)}&appid=${API_KEY}&units=metric`, { timeout: 2000 });
            hum = weather.data.main.humidity;
            tmp = weather.data.main.temp;
        } catch (e) { console.log("Weather Fallback"); }

        const lastKnown = history.length > 0 ? history[history.length - 1] : 5.0;
        const liveEst = (lastKnown + (hum * 0.01) - (tmp * 0.08)).toFixed(2);
        const forecast = predictFuture(history);
        
        // WPI Algorithm
        let wpi = (parseFloat(liveEst) * 1.5) + (hum * 0.4) + ((40 - tmp) * 0.6);
        wpi = Math.min(Math.max(wpi, 0), 100).toFixed(1);

        res.json({
            station: originalName.toUpperCase(),
            estimatedLevel: liveEst,
            forecastLevel: forecast,
            humidity: hum,
            temp: tmp,
            wpi: wpi,
            recommendation: wpi > 50 ? "✅ High Potential" : "⚠️ Low Potential"
        });
    } catch (e) {
        res.status(500).json({ error: "Analysis failed" });
    }
});

app.listen(PORT, async () => {
    console.log(`Backend Live: http://localhost:${PORT}`);
    try {
        await loadDataIntoMemory();
    } catch (err) {
        console.error("Warning: Failed to preload data on startup", err);
    }
});