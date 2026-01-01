document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setInterval(fetchPlayerStatus, 5000); // Sync every 5s
    setInterval(updateProgress, 1000);    // Smooth local update every 1s
});

let currentUser = null;
let currentGuildId = null;
let playerState = {
    active: false,
    paused: true,
    position: 0,
    duration: 0,
    lastUpdate: Date.now()
};

async function checkAuth() {
    try {
        const response = await fetch('/auth/user');
        const data = await response.json();
        if (data.authenticated) {
            currentUser = data.user;
            updateAuthUI(data.user);
            fetchPlayerStatus();
        } else {
            window.location.href = '/dashboard'; // Redirect if not logged in
        }
    } catch (e) {
        console.error(e);
    }
}

function updateAuthUI(user) {
    const avatar = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';
    document.getElementById('authSection').innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatar}" style="width: 32px; height: 32px; border-radius: 50%;">
            <a href="/auth/logout" class="auth-btn" style="background: #e74c3c;">Logout</a>
        </div>
    `;
}

async function fetchPlayerStatus() {
    if (!currentUser) return;

    try {
        const response = await fetch('/api/player/status');
        const data = await response.json();

        const playerSection = document.getElementById('playerSection');
        const noPlayerSection = document.getElementById('noPlayerSection');
        const serverSelector = document.getElementById('serverSelectorContainer');

        // Logic to determine which player to show
        let targetPlayer = null;

        if (data.active && data.players.length > 0) {
            // Priority 1: Already selected guild
            if (currentGuildId) {
                targetPlayer = data.players.find(p => p.guildId === currentGuildId);
            }

            // Priority 2: User voice channel
            if (!targetPlayer && data.userVoiceGuildId) {
                targetPlayer = data.players.find(p => p.guildId === data.userVoiceGuildId);
            }

            // Priority 3: Only one player active
            if (!targetPlayer && data.players.length === 1) {
                targetPlayer = data.players[0];
            }

            if (targetPlayer) {
                playerSection.style.display = 'flex';
                noPlayerSection.style.display = 'none';
                serverSelector.style.display = 'none';
                updatePlayerUI(targetPlayer);
            } else {
                // Show Server Selector if multiple players and none selected
                playerSection.style.display = 'none';
                noPlayerSection.style.display = 'none';
                serverSelector.style.display = 'block';
                renderServerList(data.players);
            }
        } else {
            playerSection.style.display = 'none';
            serverSelector.style.display = 'none';
            noPlayerSection.style.display = 'block';
            resetPlayerState();
        }

    } catch (error) {
        console.error('Player sync error:', error);
    }
}

function renderServerList(players) {
    const list = document.getElementById('serverList');
    list.innerHTML = '';

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'stat-card'; // Reuse card style
        div.style.cursor = 'pointer';
        div.onclick = () => {
            currentGuildId = p.guildId;
            fetchPlayerStatus();
        };
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; width: 100%;">
                <i class="fas fa-music" style="color: var(--primary); font-size: 1.5rem;"></i>
                <div>
                    <h3 style="font-size: 1.1rem; margin: 0;">${p.guildName}</h3>
                    <p style="margin: 0; opacity: 0.7;">Playing: ${p.track.title}</p>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

function updatePlayerUI(player) {
    currentGuildId = player.guildId;

    // Update State
    playerState.active = true;
    playerState.paused = player.paused;
    playerState.position = player.position || 0;
    playerState.duration = player.track.duration || 0;
    playerState.lastUpdate = Date.now();

    // DOM Elements
    document.getElementById('trackTitle').textContent = player.track.title;
    document.getElementById('trackArtist').textContent = player.track.author;
    document.getElementById('currentTime').textContent = formatTime(playerState.position);
    document.getElementById('totalTime').textContent = formatTime(playerState.duration);

    const art = document.getElementById('playerArt');
    art.src = player.track.thumbnail || 'https://via.placeholder.com/300';

    // Vinyl Animation
    const vinyl = document.getElementById('vinylRecord');
    if (player.paused) {
        vinyl.classList.remove('spinning');
        document.getElementById('visualizer').style.opacity = '0.1';
        document.getElementById('playPauseIcon').className = 'fas fa-play';
    } else {
        vinyl.classList.add('spinning');
        document.getElementById('visualizer').style.opacity = '1';
        document.getElementById('playPauseIcon').className = 'fas fa-pause';
    }

    // Update Progress Bar immediately to sync
    updateProgressBarVisuals();

    // Render Queue
    const queueList = document.getElementById('queueList');
    queueList.innerHTML = '';

    if (player.queue && player.queue.length > 0) {
        player.queue.forEach((track, index) => {
            const item = document.createElement('div');
            item.style.padding = '8px 12px';
            item.style.marginBottom = '5px';
            item.style.borderRadius = '8px';
            item.style.backgroundColor = 'rgba(255,255,255,0.05)';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.fontSize = '0.9rem';

            item.innerHTML = `
                <span class="text-truncate" style="flex:1; margin-right: 10px;">${index + 1}. ${track.title}</span>
                <span style="color: var(--text-muted); font-size: 0.8rem;">${formatTime(track.duration)}</span>
            `;
            queueList.appendChild(item);
        });
    } else {
        queueList.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 20px;">Queue is empty</div>';
    }
}

function updateProgress() {
    if (!playerState.active || playerState.paused) return;

    const now = Date.now();
    const elapsed = now - playerState.lastUpdate;

    // Extrapolate position
    let currentPos = playerState.position + elapsed;
    if (currentPos > playerState.duration) currentPos = playerState.duration;

    document.getElementById('currentTime').textContent = formatTime(currentPos);

    // Update visual bar
    const percent = (currentPos / playerState.duration) * 100;
    document.getElementById('progressFill').style.width = `${percent}%`;
}

function updateProgressBarVisuals() {
    const percent = (playerState.position / playerState.duration) * 100;
    document.getElementById('progressFill').style.width = `${percent}%`;
}

function formatTime(ms) {
    if (!ms) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function resetPlayerState() {
    playerState.active = false;
    currentGuildId = null;
    document.getElementById('vinylRecord').classList.remove('spinning');
}

async function sendPlayerAction(action) {
    if (!currentGuildId) return;

    try {
        await fetch(`/api/player/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId: currentGuildId })
        });

        // Optimistic update
        if (action === 'pause') {
            playerState.paused = !playerState.paused;
            const vinyl = document.getElementById('vinylRecord');
            if (playerState.paused) {
                vinyl.classList.remove('spinning');
                document.getElementById('playPauseIcon').className = 'fas fa-play';
            } else {
                vinyl.classList.add('spinning');
                document.getElementById('playPauseIcon').className = 'fas fa-pause';
            }
        }

        setTimeout(fetchPlayerStatus, 200); // Quick resync
    } catch (e) {
        console.error(e);
    }
}
