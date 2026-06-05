/**
 * YouTube の遷移イベントやプレイヤー状態イベントを監視するクラス。
 */
class PlaybackMonitor {
    /**
     * @param {Object} callbacks
     * @param {Function} callbacks.onTrigger - 画質適用処理の実行が必要なタイミングで呼ばれる
     * @param {Function} callbacks.onSettingsUpdate - 拡張機能の設定が更新されたタイミングで呼ばれる
     * @param {Function} callbacks.onManualQualityChange - ユーザーが手動で画質変更した可能性があるタイミングで呼ばれる
     */
    constructor(callbacks) {
        this.callbacks = callbacks;
        this.playerListenerAttached = false;
        this.checkTimer = null;
    }

    /**
     * イベント監視を開始。
     */
    start() {
        // YouTubeのSPAナビゲーション完了イベント
        window.addEventListener('yt-navigate-finish', () => {
            if (typeof this.callbacks.onTrigger === 'function') {
                this.callbacks.onTrigger({ reason: 'navigate-finish' });
            }
        });

        // 拡張機能の設定更新イベント
        window.addEventListener('YouUtilitySettingsUpdate', (e) => {
            if (typeof this.callbacks.onSettingsUpdate === 'function') {
                this.callbacks.onSettingsUpdate(e.detail);
            }
        });

        // 【特殊な実装】YouTubeの動画プレイヤー要素は遅延ロードされる可能性があるため、
        // 定期的にポーリングしてプレイヤーの生成を検知し、イベントをアタッチする。
        this.startPlayerPolling();
    }

    /**
     * YouTubeプレイヤー要素がDOMに出現して準備ができるまでポーリングし、
     * 準備ができたら内部イベントリスナーを登録する。
     */
    startPlayerPolling() {
        const player = document.querySelector("#movie_player");
        
        // プレイヤーが存在し、addEventListener があれば登録
        if (player && typeof player.addEventListener === 'function') {
            this.setupPlayerListeners(player);
        } else {
            // 見つかるまで1秒おきにリトライ
            this.checkTimer = setTimeout(() => this.startPlayerPolling(), 1000);
        }
    }

    /**
     * プレイヤー内部のAPIイベントのリスナーを設定。
     * @param {HTMLElement} player - YouTubeプレイヤー要素
     */
    setupPlayerListeners(player) {
        if (this.playerListenerAttached) return;

        try {
            // 再生状態変更（1: 再生中, 3: バッファリング中）をトリガーに適用を試みる
            player.addEventListener('onStateChange', (state) => {
                if (state === 1 || state === 3) {
                    if (typeof this.callbacks.onTrigger === 'function') {
                        this.callbacks.onTrigger({ reason: 'state-change', state });
                    }
                }
            });

            // 実際の動画画質変更イベント（ユーザー手動変更の検知に利用）
            player.addEventListener('onPlaybackQualityChange', (quality) => {
                if (typeof this.callbacks.onManualQualityChange === 'function') {
                    this.callbacks.onManualQualityChange(quality);
                }
            });

            this.playerListenerAttached = true;
        } catch (e) {
            console.warn("YouUtility: Failed to setup player internal listeners", e);
            // 登録に失敗した場合はリトライさせるためにフラグをfalseにし、ポーリングを再開
            this.playerListenerAttached = false;
            this.checkTimer = setTimeout(() => this.startPlayerPolling(), 2000);
        }
    }

    /**
     * 監視を停止しクリーンアップ（将来用）。
     */
    destroy() {
        if (this.checkTimer) {
            clearTimeout(this.checkTimer);
        }
    }
}
