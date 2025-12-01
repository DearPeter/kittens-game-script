// --- 猫国建设者六合一自动化脚本 (修复版 v2.0) 开始 ---
// 功能 1: [2秒高频] 自动点击红色的“观察”按钮获取星图。
// 功能 2: [2秒高频] 当木材 > 40,000 时，自动点击“全部”合成木梁。
// 功能 3: [2秒高频] 当矿物 > 40,000 时，自动点击“全部”合成石板。
// 功能 4: [2秒高频] 当煤炭 > 2,000 时，自动点击“全部”合成钢铁。
// 功能 5: [2秒高频] 当铁 > 6,000 时，自动点击“全部”合成金属板。
// 功能 6: [9分钟低频] 自动模拟点击页面上的“派出猎人”按钮。【已修复】

console.log('>>> 自动化脚本尝试启动 (修复版 v2.0)... <<<');

if (typeof gamePage === 'undefined' || !gamePage.resPool) {
    console.error('游戏尚未完全加载，请稍后再试！');
} else {
    // 防止重复运行
    if (window.globalMainTimer) clearInterval(window.globalMainTimer);
    if (window.globalHunterTimer) clearInterval(window.globalHunterTimer);


    // --- 定时器 1：高频检查 (每 2 秒) ---
    window.globalMainTimer = setInterval(function() {
        // [任务 A: 星图]
        try {
            var btn = document.getElementById('observeBtn');
            if (btn && btn.style.display !== 'none') btn.click();
        } catch (e) {}

        // [任务 B: 木梁]
        try {
            if (gamePage.resPool.get('wood').value > 40000) {
                gamePage.craftAll('beam');
                console.log('【自动化】木材 > 40K，已合成木梁。');
            }
        } catch (e) {}

        // [任务 C: 石板]
        try {
            if (gamePage.resPool.get('minerals').value > 40000) {
                gamePage.craftAll('slab');
                console.log('【自动化】矿物 > 40K，已合成石板。');
            }
        } catch (e) {}

        // [任务 D: 钢铁]
        try {
            if (gamePage.resPool.get('coal').value > 2000) {
                gamePage.craftAll('steel');
                console.log('【自动化】煤炭 > 2K，已合成钢铁。');
            }
        } catch (e) {}

        // [任务 E: 金属板]
        try {
            if (gamePage.resPool.get('iron').value > 6000) {
                gamePage.craftAll('plate');
                console.log('【自动化】铁 > 6K，已合成金属板。');
            }
        } catch (e) {}

    }, 2000);


    // --- 定时器 2：低频检查 (每 9 分钟) ---
    // 【修复重点】改为模拟UI点击
    var hunterInterval = 9 * 60 * 1000; // 9分钟

    window.globalHunterTimer = setInterval(function() {
        try {
            var now = new Date();
            var timeStr = now.getHours().toString().padStart(2,'0') + ':' +
                          now.getMinutes().toString().padStart(2,'0');

            // --- 新的猎人逻辑 开始 ---
            var hunterBtnFound = false;
            // 获取页面上所有的链接元素
            var links = document.getElementsByTagName('a');
            // 遍历查找包含“派出猎人”文本的按钮
            for (var i = 0; i < links.length; i++) {
                // 检查元素的文本内容是否存在且包含关键字
                if (links[i].innerText && links[i].innerText.indexOf('派出猎人') !== -1) {
                    // 找到了！模拟点击。
                    links[i].click();
                    hunterBtnFound = true;
                    console.log('【自动化 - ' + timeStr + '】✅ 已找到并点击了“派出猎人”按钮。');
                    // 找到一个就够了，跳出循环
                    break;
                }
            }

            if (!hunterBtnFound) {
                // 如果循环了一圈都没找到按钮
                console.log('【自动化 - ' + timeStr + '】⚠️ 未找到可点击的“派出猎人”按钮。(可能是猫力不足)');
            }
            // --- 新的猎人逻辑 结束 ---

        } catch (err) {
            console.error('自动派出猎人出错:', err);
        }
    }, hunterInterval);


    console.log('>>> ✅ 六合一脚本(修复版)启动成功！ <<<');
    console.log('>>> 现在猎人功能通过模拟真实点击实现，更加可靠。 <<<');
    console.log('>>> (停止方法：刷新网页，或输入 stopAutoScript() ) <<<');

    window.stopAutoScript = function() {
        if (window.globalMainTimer) clearInterval(window.globalMainTimer);
        if (window.globalHunterTimer) clearInterval(window.globalHunterTimer);
        console.log('>>> ⛔️ 所有自动化脚本已手动停止。 <<<');
    }
}
// --- 猫国建设者六合一自动化脚本 (修复版 v2.0) 结束 ---
