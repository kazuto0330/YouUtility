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
        this.attachedPlayerElement = null;
        this.checkTimer = null;
        this.urlCheckTimer = null;
    }

    /**
     * 【特殊な実装】通常の動画プレイヤーに加え、YouTube Shortsの
     * アクティブなプレイヤー要素（ytd-reel-video-renderer[is-active]内など）も
     * 優先して取得できるようにフォールバックを持つ検索関数。
     */
    findPlayerElement() {
        const activeShortsPlayer = document.querySelector('ytd-reel-video-renderer[is-active] #movie_player') ||
                                   document.querySelector('ytd-reel-video-renderer[is-active] .html5-video-player') ||
                                   document.querySelector('#shorts-player');
        if (activeShortsPlayer) return activeShortsPlayer;
        return document.querySelector("#movie_player");
    }

    /**
     * イベント監視を開始。
     */
    start() {
        // YouTubeのSPAナビゲーション完了イベント
        window.addEventListener('yt-navigate-finish', () => {
            this.attachedPlayerElement = null; // ナビゲーション時は登録をリセット
            this.startPlayerPolling();
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

        // 【特殊な実装】YouTube Shorts等でスワイプして動画を切り替えた際に
        // SPAナビゲーションイベント（yt-navigate-finish）が正しく発火しない場合があるため、
        // URLの書き換わりを定期的に検知する監視タイマーを設置する。
        let lastUrl = window.location.href;
        this.urlCheckTimer = setInterval(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                this.attachedPlayerElement = null; // 新しいプレイヤーをアタッチできるようにクリア
                this.startPlayerPolling();
                if (typeof this.callbacks.onTrigger === 'function') {
                    this.callbacks.onTrigger({ reason: 'navigate-finish' });
                }
            }
        }, 500);

        // 【特殊な実装】YouTubeの動画プレイヤー要素は遅延ロードされる可能性があるため、
        // 定期的にポーリングしてプレイヤーの生成を検知し、イベントをアタッチする。
        this.startPlayerPolling();
    }

    /**
     * YouTubeプレイヤー要素がDOMに出現して準備ができるまでポーリングし、
     * 準備ができたら内部イベントリスナーを登録する。
     */
    startPlayerPolling() {
        const player = this.findPlayerElement();
        
        // プレイヤーが存在し、addEventListener があれば登録
        // すでにアタッチされているプレイヤーとは異なる場合のみ再セットアップする
        if (player && typeof player.addEventListener === 'function') {
            if (this.attachedPlayerElement !== player) {
                this.setupPlayerListeners(player);
            }
        } else {
            // 見つかるまで1秒おきにリトライ
            if (this.checkTimer) clearTimeout(this.checkTimer);
            this.checkTimer = setTimeout(() => this.startPlayerPolling(), 1000);
        }
    }

    /**
     * プレイヤー内部のAPIイベントのリスナーを設定。
     * @param {HTMLElement} player - YouTubeプレイヤー要素
     */
    setupPlayerListeners(player) {
        if (this.attachedPlayerElement === player) return;

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

            this.attachedPlayerElement = player;
        } catch (e) {
            console.warn("YouUtility: Failed to setup player internal listeners", e);
            // 登録に失敗した場合はリトライさせるためにアタッチ履歴をクリアし、ポーリングを再開
            this.attachedPlayerElement = null;
            if (this.checkTimer) clearTimeout(this.checkTimer);
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
        if (this.urlCheckTimer) {
            clearInterval(this.urlCheckTimer);
        }
    }
}
