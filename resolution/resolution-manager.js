/**
 * 解像度変更機能全体のライフサイクルと状態管理をコントロールするマネージャー。
 */
class ResolutionManager {
    constructor() {
        this.player = new YoutubePlayer();
        this.selector = new ResolutionSelector();
        this.settings = null;
        
        // 状態フラグ
        this.isApplying = false;
        this.lastAppliedVideoId = null;
        this.userManuallyChangedVideoId = null;
        
        // イベントモニターの初期化
        this.monitor = new PlaybackMonitor({
            onTrigger: (info) => this.handleTrigger(info),
            onSettingsUpdate: (settings) => this.handleSettingsUpdate(settings),
            onManualQualityChange: (quality) => this.handleManualQualityChange(quality)
        });
    }

    /**
     * マネージャーの動作を開始。
     */
    start() {
        this.monitor.start();
    }

    /**
     * 拡張機能の設定が更新された場合の処理。
     */
    handleSettingsUpdate(settings) {
        this.settings = settings;
        if (this.settings && this.settings.autoResolution) {
            // 設定反映のため、少し遅延させて解像度適用を試みる
            setTimeout(() => this.applyResolution(), 500);
        }
    }

    /**
     * ユーザーが手動で画質を変更した可能性を検知した場合の処理。
     */
    handleManualQualityChange(quality) {
        // 現在、拡張機能による画質適用処理中でない場合、ユーザー自身による変更とみなす
        if (!this.isApplying && this.player.exists()) {
            const currentVideoId = this.player.getVideoId();
            if (currentVideoId) {
                // この動画IDにおいては、以降自動での解像度適用を抑制する
                this.userManuallyChangedVideoId = currentVideoId;
            }
        }
    }

    /**
     * SPA遷移や再生状態変化など、画質適用を試みるイベントが発生した際の処理。
     */
    handleTrigger(info) {
        if (info.reason === 'navigate-finish') {
            // 動画遷移時は、手動変更フラグと前回適用IDをリセットする
            this.lastAppliedVideoId = null;
            this.userManuallyChangedVideoId = null;
            
            // プレイヤー要素の再初期化（古い要素への参照をクリア）
            this.player = new YoutubePlayer();
            
            // SPA遷移直後はDOMが生成途中のため、少し遅延させて適用を試みる
            setTimeout(() => this.applyResolution(), 500);
        } else {
            this.applyResolution();
        }
    }

    /**
     * 【特殊な実装：リトライ制御付きの解像度適用】
     * YouTubeプレイヤーの画質リスト（getAvailableQualityLevels）は動画のロード直後に
     * 空で取得されることが多いため、数回（200ms間隔、最大10回）リトライして
     * リストが利用可能になってから解像度選択と適用を行う。
     */
    async applyResolution(retryCount = 0) {
        if (!this.settings || !this.settings.autoResolution || this.isApplying) {
            return;
        }

        if (!this.player.isReady()) {
            return;
        }

        const currentVideoId = this.player.getVideoId();
        if (!currentVideoId) {
            return;
        }

        // すでにユーザー自身がこの動画で手動で画質変更している場合は適用しない
        if (currentVideoId === this.userManuallyChangedVideoId) {
            return;
        }

        const availableLevels = this.player.getAvailableLevels();
        
        // 画質リストがまだ取得できない（空配列）場合、非同期でリトライを行う
        if (!availableLevels || availableLevels.length === 0) {
            if (retryCount < 10) {
                setTimeout(() => this.applyResolution(retryCount + 1), 200);
            } else {
                console.warn("YouUtility: Failed to get available quality levels after maximum retries.");
            }
            return;
        }

        // 最適なターゲット画質を決定
        const targetRes = this.selector.select(this.player, this.settings);
        if (!targetRes) {
            // ターゲット画質がない、あるいは現在既にその画質である場合は何もしない
            this.lastAppliedVideoId = currentVideoId;
            return;
        }

        // 画質の適用処理を実行
        this.isApplying = true;
        try {
            const success = this.player.applyQuality(targetRes, currentVideoId);
            if (success) {
                this.lastAppliedVideoId = currentVideoId;
            }
        } finally {
            // 画質変更後にYouTubeプレイヤー側でイベントが非同期に発火するため、
            // 手動変更検知が誤作動しないよう、2秒間は isApplying を true に維持する。
            setTimeout(() => {
                this.isApplying = false;
            }, 2000);
        }
    }
}

// グローバルインスタンスを作成して開始
const resolutionManager = new ResolutionManager();
resolutionManager.start();
