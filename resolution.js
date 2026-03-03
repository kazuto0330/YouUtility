// resolution.js - Runs in MAIN world to access YouTube Player API
let resSettings = null;
let isApplying = false;
let lastAppliedVideoId = null;

function getVideoId() {
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

    const currentVideoId = getVideoId();
    if (!currentVideoId || currentVideoId === lastAppliedVideoId) return;

    const player = document.querySelector("#movie_player");
    if (!player || !player.getAvailableQualityLevels) return;

    const currentRes = player.getPlaybackQuality();
    const availableLevels = player.getAvailableQualityLevels();
    
    if (availableLevels.length === 0) return;

    const isPlaylist = window.location.href.includes("list=");
    let targetRes = isPlaylist ? resSettings.playlistResolution : resSettings.mainResolution;
    
    if (!availableLevels.includes(targetRes)) {
        if (!isPlaylist) {
            for (const res of resSettings.fallbackResolutions) {
                if (availableLevels.includes(res)) {
                    targetRes = res;
                    break;
                }
            }
        } else {
            if (availableLevels.includes(resSettings.mainResolution)) {
                targetRes = resSettings.mainResolution;
            } else {
                for (const res of resSettings.fallbackResolutions) {
                    if (availableLevels.includes(res)) {
                        targetRes = res;
                        break;
                    }
                }
            }
        }
    }

    if (currentRes === targetRes) {
        lastAppliedVideoId = currentVideoId;
        return;
    }

    if (availableLevels.includes(targetRes)) {
        applyResolution(player, targetRes, currentVideoId);
    }
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

        const ytConfig = JSON.parse(localStorage.getItem('yt-player-quality') || '{}');
        ytConfig.data = target;
        ytConfig.expiration = Date.now() + 24 * 60 * 60 * 1000;
        localStorage.setItem('yt-player-quality', JSON.stringify(ytConfig));
        
        lastAppliedVideoId = videoId;
    } catch (e) {
    } finally {
        setTimeout(() => {
            isApplying = false;
        }, 2000);
    }
}

window.addEventListener('yt-navigate-finish', () => {
    setTimeout(updateResolutionMain, 1000);
});

function initPlayerMonitor() {
    const player = document.querySelector("#movie_player");
    if (player && player.addEventListener) {
        player.addEventListener('onStateChange', (state) => {
            if (state === 1 || state === 3) {
                updateResolutionMain();
            }
        });
    } else {
        setTimeout(initPlayerMonitor, 1000);
    }
}

initPlayerMonitor();
