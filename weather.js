(function() {
    'use strict';

    const ICONS = {
        '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '☁️',
        '03d': '☁️', '03n': '☁️', '04d': '☁️', '04n': '☁️',
        '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌧️',
        '11d': '⛈️', '11n': '⛈️', '13d': '🌨️', '13n': '🌨️',
        '50d': '🌫️', '50n': '🌫️'
    };

    async function loadWeather() {
        const widget = document.getElementById('weatherWidget');
        if (!widget) return;

        try {
            const response = await fetch('/api/weather');
            const data = await response.json();

            if (response.ok) {
                displayWeather(data, widget);
                setTimeout(() => loadWeather(), 600000);
            }
        } catch (error) {
            console.error('Weather error:', error);
        }
    }

    function displayWeather(data, widget) {
        const temp = Math.round(data.main.temp);
        const description = data.weather[0].description;
        const humidity = data.main.humidity;
        const wind = Math.round(data.wind.speed);
        const visibility = Math.round(data.visibility / 1609.34);
        const icon = ICONS[data.weather[0].icon] || '🌤️';

        let score = 0;
        if (temp >= 60 && temp <= 80) score += 3;
        else if (temp >= 50 && temp < 90) score += 2;
        else if (temp >= 40 && temp < 95) score += 1;

        if (wind <= 10) score += 3;
        else if (wind <= 15) score += 2;
        else if (wind <= 20) score += 1;

        if (['Clear', 'Clouds'].includes(data.weather[0].main)) score += 2;
        else if (data.weather[0].main === 'Drizzle') score += 1;

        if (humidity >= 40 && humidity <= 60) score += 2;
        else if (humidity >= 30 && humidity <= 70) score += 1;

        let conditions;
        if (score >= 9) conditions = { level: 'ideal', icon: '⛳', text: 'Ideal' };
        else if (score >= 6) conditions = { level: 'good', icon: '✓', text: 'Good' };
        else if (score >= 4) conditions = { level: 'fair', icon: '⚠️', text: 'Fair' };
        else conditions = { level: 'poor', icon: '🌪️', text: 'Tough' };

        widget.innerHTML = `
            <div class="weather-strip">
                <div class="weather-strip-content">
                    <div class="weather-strip-temp">
                        <div class="weather-strip-icon">${icon}</div>
                        <div class="weather-strip-main">
                            <div class="weather-strip-degrees">${temp}°F</div>
                            <div class="weather-strip-desc">${description}</div>
                        </div>
                    </div>
                    <div class="weather-strip-stats">
                        <div class="weather-strip-stat">
                            <span class="weather-strip-stat-icon">💨</span>
                            <span class="weather-strip-stat-value">${wind}</span>
                            <span class="weather-strip-stat-label">mph</span>
                        </div>
                        <div class="weather-strip-stat">
                            <span class="weather-strip-stat-icon">💧</span>
                            <span class="weather-strip-stat-value">${humidity}%</span>
                            <span class="weather-strip-stat-label">humid</span>
                        </div>
                        <div class="weather-strip-stat">
                            <span class="weather-strip-stat-icon">👁️</span>
                            <span class="weather-strip-stat-value">${visibility}</span>
                            <span class="weather-strip-stat-label">mi</span>
                        </div>
                    </div>
                    <div class="weather-strip-condition ${conditions.level}">
                        ${conditions.icon} ${conditions.text}
                    </div>
                </div>
            </div>
        `;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadWeather);
    } else {
        loadWeather();
    }
})();
