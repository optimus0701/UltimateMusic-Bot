document.addEventListener('DOMContentLoaded', () => {
    fetchUser();
    fetchStats();
    setInterval(fetchStats, 30000); // 30s update
});

let currentUser = null;

async function fetchUser() {
    try {
        const response = await fetch('/auth/user');
        const data = await response.json();
        const authSection = document.getElementById('authSection');

        if (data.authenticated && data.user) {
            currentUser = data.user;
            const avatar = data.user.avatar
                ? `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png`
                : 'https://cdn.discordapp.com/embed/avatars/0.png';

            authSection.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%;">
                    <span>${data.user.username}</span>
                    <a href="/auth/logout" class="auth-btn" style="background: #e74c3c;">Logout</a>
                </div>
            `;
        } else {
            authSection.innerHTML = `
                <a href="/auth/login" class="auth-btn"><i class="fab fa-discord"></i> Login</a>
            `;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        if (data.success && data.data) {
            document.getElementById('serverCount').textContent = data.data.servers;
            document.getElementById('userCount').textContent = data.data.users.toLocaleString();
            updateUptime(data.data.uptime);
        }
    } catch (error) {
        console.error('Stats fetch failed:', error);
    }
}

function updateUptime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    document.getElementById('uptime').textContent =
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
