/**
 * 設定とプレイヤーの状態を比較し、最適な解像度を決定するビジネスロジッククラス。
 */
class ResolutionSelector {
    /**
     * 現在のプレイヤー状態と設定情報を元に、適用すべきターゲット画質を選択する。
     * @param {YoutubePlayer} player - YoutubePlayerラッパーのインスタンス
     * @param {Object} settings - 拡張機能の設定情報
     * @returns {string|null} 選択された画質名。変更不要な場合は null。
     */
    select(player, settings) {
        if (!settings || !settings.autoResolution) {
            return null;
        }

        const availableLevels = player.getAvailableLevels();
        if (!availableLevels || availableLevels.length === 0) {
            return null;
        }

        // 優先順位リストを作成
        const priorityList = [];

        // 1. プレイリスト再生時の解像度
        if (player.isPlaylist() && settings.enablePlaylistResolution && settings.playlistResolution) {
            priorityList.push(settings.playlistResolution);
        }


        // 3. メインの解像度
        if (settings.mainResolution) {
            priorityList.push(settings.mainResolution);
        }

        // 4. フォールバックの解像度
        if (settings.fallbackResolutions && Array.isArray(settings.fallbackResolutions)) {
            priorityList.push(...settings.fallbackResolutions);
        }

        // 利用可能な解像度の中から、最も優先順位が高いものを選択
        let targetRes = null;
        for (const res of priorityList) {
            if (availableLevels.includes(res)) {
                targetRes = res;
                break;
            }
        }

        // 現在の画質とターゲット画質が同一なら、適用不要のため null を返す
        const currentRes = player.getPlaybackQuality();
        if (!targetRes || currentRes === targetRes) {
            return null;
        }

        return targetRes;
    }
}
