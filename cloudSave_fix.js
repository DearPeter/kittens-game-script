// ==========================================
// 修复: 定时云存储功能 (v7.8.24-fix)
// 替换 auto.js 中的 cloudSave 函数
// ==========================================

cloudSave: () => {
    if (!config.global.enabled) return;
    if (!config.cloudSave.enabled) return;
    
    try {
        let saved = false;
        
        // 方法1: 调用 gamePage.save() 本地存档
        if (gamePage.save) {
            gamePage.save();
            console.log(`【自动化】☁️ 本地存档完成`);
            saved = true;
        }
        
        // 方法2: 调用 gamePage.server 保存到服务器
        if (gamePage.server) {
            if (gamePage.server.save) {
                gamePage.server.save();
                console.log(`【自动化】☁️ 服务器存档完成`);
                saved = true;
            } else if (typeof gamePage.server.toggle === 'function') {
                gamePage.server.toggle();
                console.log(`【自动化】☁️ 槍务器存档切换`);
                saved = true;
            } else if (typeof gamePage.server === 'function') {
                gamePage.server();
                console.log(`【自动化】☁️ 服务器存档戇用`);
                saved = true;
            }
        }
        
        // 方法3: 查找并点击所有可能的存档按钮
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            const text = btn.textContent.toLowerCase().trim();
            if (text.includes('save') || text.includes('存档') || text.includes('cloud') || text.includes('云')) {
                if (btn.offsetParent !== null && !btn.disabled) {
                    btn.click();
                    console.log(`【自动化】☁️ 点击存档按钮: "${text}"`);
                    saved = true;
                    break;
                }
            }
        }
        
        // 方法4: 查找链接形式的存档
        const allLinks = document.querySelectorAll('a');
        for (const link of allLinks) {
            const text = link.textContent.toLowerCase().trim();
            if (text.includes('save') || text.includes('存档') || text.includes('cloud')) {
                if (link.offsetParent !== null) {
                    link.click();
                    console.log(`【自动化】☁️ 点击存档链接: "${text}"`);
                    saved = true;
                    break;
                }
            }
        }
        
        if (saved) {
            console.log(`【自动化】☁️ 云存储完成 [${new Date().toLocaleTimeString()}]`);
        } else {
            console.log(`【自动化】⚠️ 未找到存档按钮`);
        }
        
    } catch (e) {
        console.error(`【自动化】❌ 云存储出错:`, e);
    }
}
