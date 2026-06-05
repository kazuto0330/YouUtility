/**
 * YouTubeプレイヤーのDOM操作とAPI呼び出しをカプセル化するクラス。
 */
class YoutubePlayer {
    constructor() {
        this.player = document.querySelector("#movie_player");
    }

    /**
     * プレイヤーがDOMに存在するか判定。
     */
    exists() {
        this.player = document.querySelector("#movie_player");
        return !!this.player;
    }

    /**
     * API呼び出しが可能か判定（必要なメソッドが存在するか）。
     */
    isReady() {
        return this.exists() && 
               typeof this.player.getAvailableQualityLevels === 'function' &&
               typeof this.player.getPlaybackQuality === 'function';
    }

    /**
     * 現在再生中の動画IDを取得。
     */
    getVideoId() {
        if (this.player && typeof this.player.getVideoData === 'function') {
            const data = this.player.getVideoData();
            if (data && data.video_id) {
                return data.video_id;
            }
        }
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    /**
     * 現在適用されている再生画質を取得。
     */
    getPlaybackQuality() {
        return this.isReady() ? this.player.getPlaybackQuality() : null;
    }

    /**
     * 選択可能な画質一覧を取得。
     */
    getAvailableLevels() {
        return this.isReady() ? this.player.getAvailableQualityLevels() : [];
    }

    /**
     * 現在プレイリスト再生中であるか判定。
     */
    isPlaylist() {
        return window.location.href.includes("list=");
    }

    /**
     * プレイヤーイベントを監視するための登録。
     */
    addEventListener(event, callback) {
        if (this.player && typeof this.player.addEventListener === 'function') {
            this.player.addEventListener(event, callback);
            return true;
        }
        return false;
    }

    /**
     * 指定の画質を適用する。
     * @param {string} target - 適用する画質 (例: 'hd1080')
     * @param {string} videoId - 現在の動画ID
     */
    applyQuality(target, videoId) {
        if (!this.isReady()) return false;

        try {
            // NOTE: setPlaybackQualityRange は非推奨の内部APIですが、
            // 確実に画質を固定するためにYouTubeの内部挙動に合わせて呼び出しています。
            if (typeof this.player.setPlaybackQualityRange === 'function') {
                this.player.setPlaybackQualityRange(target, target);
            }
            if (typeof this.player.setPlaybackQuality === 'function') {
                this.player.setPlaybackQuality(target);
            }

            this.updateLocalStorageQuality(target);
            return true;
        } catch (e) {
            console.warn("YouUtility: Failed to apply resolution API", e);
            return false;
        }
    }

    /**
     * 【特殊な実装】YouTubeが次回読み込み時に同じ画質を選択しやすくするため、
     * ローカルストレージ内のYouTubeプレイヤー設定を直接書き換えるハック処理。
     */
    updateLocalStorageQuality(target) {
        try {
            const rawConfig = localStorage.getItem('yt-player-quality');
            const ytConfig = rawConfig ? JSON.parse(rawConfig) : {};
            ytConfig.data = target;
            ytConfig.expiration = Date.now() + 24 * 60 * 60 * 1000;
            ytConfig.creation = Date.now();
            localStorage.setItem('yt-player-quality', JSON.stringify(ytConfig));
        } catch (e) {
            console.warn("YouUtility: Failed to update localStorage 'yt-player-quality'", e);
        }
    }
}
