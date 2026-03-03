// resolution.js - Runs in MAIN world to access YouTube Player API
let resSettings = null;
let isApplying = false;
let lastAppliedVideoId = null;

function getVideoId(player) {
    if (player && player.getVideoData) {
        const data = player.getVideoData();
        if (data && data.video_id) {
            return data.video_id;
        }
    }
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
}

// Listen for settings from the Isolated World (content.js)
window.addEventListener('YouUtilitySettingsUpdate', (e) => {
    const oldSettings = resSettings;
    resSettings = e.detail;
    
    if (resSettings && resSettings.autoResolution) {
        // 設定が変更された場合は、再適用を許可するためにキャッシュをクリア
        if (!oldSettings || 
            oldSettings.mainResolution !== resSettings.mainResolution ||
            JSON.stringify(oldSettings.fallbackResolutions) !== JSON.stringify(resSettings.fallbackResolutions) ||
            oldSettings.isMiniPlayerActive !== resSettings.isMiniPlayerActive ||
            oldSettings.playlistResolution !== resSettings.playlistResolution ||
            oldSettings.miniPlayerResolution !== resSettings.miniPlayerResolution) {
            lastAppliedVideoId = null;
        }
        setTimeout(updateResolutionMain, 500);
    }
    // Re-setup volume wheel listener if settings changed
    setupVolumeWheel();
});

function updateResolutionMain() {
    if (!resSettings || !resSettings.autoResolution || isApplying) return;

    const player = document.querySelector("#movie_player");
    if (!player || !player.getAvailableQualityLevels) return;

    const currentVideoId = getVideoId(player);
    if (!currentVideoId) return;

    // すでにこの動画に対して解像度を適用済みの場合はスキップ
    if (currentVideoId === lastAppliedVideoId) return;

    const currentRes = player.getPlaybackQuality();
    const availableLevels = player.getAvailableQualityLevels();
    
    if (!availableLevels || availableLevels.length === 0) return;

    const isPlaylist = window.location.href.includes("list=");
    
    // 優先順位に基づいて解像度を探す
    const priorityList = [];
    if (isPlaylist && resSettings.enablePlaylistResolution && resSettings.playlistResolution) {
        priorityList.push(resSettings.playlistResolution);
    } else if (resSettings.isMiniPlayerActive && resSettings.enableMiniPlayerResolution && resSettings.miniPlayerResolution) {
        priorityList.push(resSettings.miniPlayerResolution);
    }
    
    if (resSettings.mainResolution) {
        priorityList.push(resSettings.mainResolution);
    }
    if (resSettings.fallbackResolutions && Array.isArray(resSettings.fallbackResolutions)) {
        priorityList.push(...resSettings.fallbackResolutions);
    }

    let targetRes = null;
    for (const res of priorityList) {
        if (availableLevels.includes(res)) {
            targetRes = res;
            break;
        }
    }

    if (!targetRes || currentRes === targetRes) {
        lastAppliedVideoId = currentVideoId;
        return;
    }

    applyResolution(player, targetRes, currentVideoId);
}

function applyResolution(player, target, videoId) {
    isApplying = true;
    try {
        if (player.setPlaybackQualityRange) {
            player.setPlaybackQualityRange(target, target);
        }
        if (player.setPlaybackQuality && player.getPlaybackQuality() !== target) {
            player.setPlaybackQuality(target);
        }

        // LocalStorageの更新 (安全性向上)
        try {
            const rawConfig = localStorage.getItem('yt-player-quality');
            const ytConfig = rawConfig ? JSON.parse(rawConfig) : {};
            ytConfig.data = target;
            ytConfig.expiration = Date.now() + 24 * 60 * 60 * 1000;
            ytConfig.creation = Date.now();
            localStorage.setItem('yt-player-quality', JSON.stringify(ytConfig));
        } catch (e) {
            console.warn("YouUtility: Failed to parse or set localStorage 'yt-player-quality'", e);
        }
        
        lastAppliedVideoId = videoId;
    } catch (e) {
        console.warn("YouUtility: Failed to apply resolution", e);
    } finally {
        setTimeout(() => {
            isApplying = false;
        }, 2000);
    }
}

// Volume Wheel Control
let isVolumeWheelAttached = false;
let overlayTimeout = null;

function showVolumeOverlay(volume, player) {
    let overlay = player.querySelector('.youutility-volume-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'youutility-volume-overlay';
        player.appendChild(overlay);
    }

    overlay.textContent = `${Math.round(volume)}`;
    overlay.classList.add('visible');

    if (overlayTimeout) clearTimeout(overlayTimeout);
    overlayTimeout = setTimeout(() => {
        overlay.classList.remove('visible');
    }, 1000);
}

function handleVolumeWheel(event) {
    if (!resSettings || !resSettings.enableVolumeWheel) return;

    // Target Check: Must be inside the player
    const player = event.target.closest('#movie_player') || 
                   event.target.closest('.html5-video-player') || 
                   event.target.closest('#player-container');
    
    if (!player) return;

    // Ignore controls/popups
    if (event.target.closest('.ytp-chrome-bottom, .ytp-chrome-top, .ytp-popup, .ytp-settings-menu')) return;

    // Prevent default scrolling
    event.preventDefault();
    event.stopPropagation();

    const step = resSettings.volumeStep || 5;
    const direction = event.deltaY > 0 ? -1 : 1;
    
    try {
        if (typeof player.getVolume === 'function' && typeof player.setVolume === 'function') {
            const currentVol = player.getVolume();
            let newVol = currentVol + (step * direction);
            if (newVol > 100) newVol = 100;
            if (newVol < 0) newVol = 0;
            
            player.setVolume(newVol);
            showVolumeOverlay(newVol, player);
        }
    } catch (e) {
        console.warn("YouUtility: Failed to adjust volume", e);
    }
}

function setupVolumeWheel() {
    if (isVolumeWheelAttached) return;
    
    // Use capture phase to intercept the event before YouTube's own handlers
    document.documentElement.addEventListener('wheel', handleVolumeWheel, { passive: false, capture: true });
    isVolumeWheelAttached = true;
}

// YouTubeのSPAナビゲーション完了イベント
window.addEventListener('yt-navigate-finish', () => {
    lastAppliedVideoId = null;
    setTimeout(updateResolutionMain, 500);
});

function initPlayerMonitor() {
    const player = document.querySelector("#movie_player");
    if (player && player.addEventListener) {
        player.addEventListener('onStateChange', (state) => {
            // 1: PLAYING, 3: BUFFERING
            if (state === 1 || state === 3) {
                updateResolutionMain();
            }
        });
        setupVolumeWheel();
    } else {
        setTimeout(initPlayerMonitor, 1000);
    }
}

initPlayerMonitor();
