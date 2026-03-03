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
    resSettings = e.detail;
    if (resSettings && resSettings.autoResolution) {
        setTimeout(updateResolutionMain, 500);
    }
});

function updateResolutionMain() {
    if (!resSettings || !resSettings.autoResolution || isApplying) return;

    const player = document.querySelector("#movie_player");
    if (!player || !player.getAvailableQualityLevels) return;

    const currentVideoId = getVideoId(player);
    if (!currentVideoId) return;

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
    } else {
        setTimeout(initPlayerMonitor, 1000);
    }
}

initPlayerMonitor();
