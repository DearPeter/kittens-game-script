// ==UserScript==
// @name         猫国建设者全能小助手 (GUI版 v7.5 - 智能猎人版)
// @namespace    http://tampermonkey.net/
// @version      7.5.1
// @description  基于v7.4改进。新增“智能猎人控制”开关：当黄金达到上限时自动停止派猎人，当黄金低于1000时自动恢复派猎人。实现资源与猎人任务的联动控制。
// @author       AI Assistant
// @match        *://kittensgame.com/web/*
// @updateURL    https://raw.githubusercontent.com/DearPeter/kittens-game-script/main/auto.js
// @downloadURL  https://raw.githubusercontent.com/DearPeter/kittens-game-script/main/auto.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('>>> 猫国建设者全能小助手 GUI版 v7.5 (智能猎人版) 正在加载... <<<');

    // ==========================================
    // 1. 配置中心与存储 (Configuration & Storage)
    // ==========================================

    const STORAGE_KEY = 'KG_AutoAssist_Config_v7_0'; // 沿用存储KEY

    const defaultConfig = {
        starchart: { enabled: true },
        // --- 百分比类 ---
        wood: { enabled: true, type: 'percent', thresholdPercent: 90 },
        minerals: { enabled: true, type: 'percent', thresholdPercent: 90 },
        coal: { enabled: true, type: 'percent', thresholdPercent: 90 },
        iron: { enabled: true, type: 'percent', thresholdPercent: 90 },
        catnipWood: { enabled: false, type: 'percent', thresholdPercent: 90 },
        oilKerosene: { enabled: false, type: 'percent', thresholdPercent: 90 },
        
        // --- 智能控制类 【新增】 ---
        smartHunterGold: { enabled: false }, // 黄金控制猎人开关

        // --- 百分比类 (下限紧急交易) ---
        emergencyTradeCatnip: { enabled: false, type: 'percent', thresholdPercent: 60 },

        // --- 固定值类 ---
        parchment: { enabled: true, type: 'fixed', thresholdFixed: 15000 },
        scaffold: { enabled: false, type: 'fixed', thresholdFixed: 10000 },
        // --- 定时任务类 ---
        hunters: { enabled: true, intervalMinutes: 5 },
        praise: { enabled: true, intervalMinutes: 60 },
        manuscript: { enabled: true, intervalMinutes: 3 },
        compendium: { enabled: true, intervalMinutes: 60 },
        blueprint: { enabled: false, intervalMinutes: 60 },
        autoTrade: { enabled: false, intervalMinutes: 20, targetRace: 'zebras' },
        cloudSave: { enabled: true, intervalMinutes: 10 },
        // UI状态配置
        ui: { fabHidden: false, posX: 'auto', posY: '20px' }
    };

    let config = loadConfig();

    function loadConfig() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // 确保新字段存在
                if (!parsed.smartHunterGold) parsed.smartHunterGold = defaultConfig.smartHunterGold;
                
                // 兼容旧字段
                if (!parsed.oilKerosene) parsed.oilKerosene = defaultConfig.oilKerosene;
                if (!parsed.emergencyTradeCatnip) parsed.emergencyTradeCatnip = defaultConfig.emergencyTradeCatnip;
                if (!parsed.ui) parsed.ui = defaultConfig.ui;
                if (parsed.ui.fabHidden === undefined) parsed.ui.fabHidden = defaultConfig.ui.fabHidden;
                if (!parsed.autoTrade || !parsed.autoTrade.targetRace) {
                    parsed.autoTrade = { ...defaultConfig.autoTrade, ...parsed.autoTrade };
                    parsed.autoTrade.targetRace = 'zebras';
                }
                return { ...defaultConfig, ...parsed };
            }
        } catch (e) { console.error('读取配置失败:', e); }
        return defaultConfig;
    }

    function saveConfig() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (e) { console.error('保存配置失败:', e); }
    }

    const capResourceMap = { 
        wood: 'wood', minerals: 'minerals', coal: 'coal', iron: 'iron', 
        catnipWood: 'catnip', emergencyTradeCatnip: 'catnip',
        oilKerosene: 'oil'
    };

    function getActualThreshold(configKey) {
        const itemConfig = config[configKey];
        if (itemConfig.type === 'fixed') return itemConfig.thresholdFixed;
        if (itemConfig.type === 'percent') {
            const resName = capResourceMap[configKey];
            try {
                const resData = gamePage.resPool.get(resName);
                if (resData && resData.maxValue > 0) {
                    return Math.floor(resData.maxValue * (itemConfig.thresholdPercent / 100));
                }
            } catch (e) {}
        }
        return 9999999999;
    }


    // ==========================================
    // 2. 界面构建器 (UI Builder)
    // ==========================================

    function createUI() {
        const existingPanel = document.getElementById('kg-auto-assist-panel');
        if (existingPanel) existingPanel.remove();
        const existingFab = document.getElementById('kg-auto-assist-fab');
        if (existingFab) existingFab.remove();

        if (!config.ui.fabHidden) { createFAB(); } else { createMainPanel(); }
    }

    function createFAB() {
        const fab = document.createElement('div');
        fab.id = 'kg-auto-assist-fab';
        fab.style.cssText = `position: fixed; bottom: 30px; right: 30px; width: 45px; height: 45px; background-color: rgba(0, 0, 0, 0.6); color: #eee; border-radius: 50%; text-align: center; line-height: 45px; font-size: 22px; cursor: pointer; z-index: 2147483647; user-select: none; box-shadow: 0 3px 8px rgba(0,0,0,0.4); transition: all 0.3s ease; border: 1px solid rgba(255,255,255,0.2);`;
        fab.innerHTML = '🐱';
        fab.title = '点击打开全能小助手面板';
        fab.onmouseover = () => { fab.style.backgroundColor = 'rgba(50, 50, 50, 0.9)'; fab.style.transform = 'scale(1.1)'; };
        fab.onmouseout = () => { fab.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; fab.style.transform = 'scale(1)'; };
        fab.addEventListener('click', () => { config.ui.fabHidden = true; saveConfig(); createUI(); });
        document.body.appendChild(fab);
    }

    function createMainPanel() {
        const winWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        const winHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        const panelTotalWidth = 490;
        const panelTotalHeightEstimate = 580; // 适应新增条目

        let resetNeeded = false;
        if (config.ui.posX !== 'auto') {
            const currentLeft = parseInt(config.ui.posX);
            if (isNaN(currentLeft) || currentLeft + panelTotalWidth > winWidth) {
                console.warn('【UI保护】检测到面板超出屏幕右侧，正在重置位置。');
                config.ui.posX = 'auto';
                resetNeeded = true;
            }
        }
        if (config.ui.posY !== 'auto') {
             const currentTop = parseInt(config.ui.posY);
             if (isNaN(currentTop) || currentTop < 0 || currentTop + panelTotalHeightEstimate > winHeight) {
                 console.warn('【UI保护】检测到面板超出屏幕纵向边界，正在重置位置。');
                 config.ui.posY = '20px';
                 resetNeeded = true;
             }
        }
        if (resetNeeded) { saveConfig(); }

        const panel = document.createElement('div');
        panel.id = 'kg-auto-assist-panel';
        const topPos = config.ui.posY !== 'auto' ? config.ui.posY : '20px';
        const leftPos = config.ui.posX !== 'auto' ? config.ui.posX : 'auto';
        const rightPos = config.ui.posX === 'auto' ? '20px' : 'auto';

        panel.style.cssText = `position: fixed; top: ${topPos}; left: ${leftPos}; right: ${rightPos}; width: 460px; background-color: rgba(0, 0, 0, 0.9); color: #eee; border: 1px solid #555; border-radius: 8px; padding: 12px; z-index: 9999; font-family: sans-serif; font-size: 12px; box-shadow: 0 6px 12px rgba(0,0,0,0.5);`;

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; cursor: move; border-bottom: 1px solid #444; padding-bottom: 8px;';
        header.innerHTML = '<strong style="font-size:15px;">🐱 全能小助手 v7.5</strong>';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✖';
        closeBtn.title = '关闭面板 (显示悬浮球)';
        closeBtn.style.cssText = 'background:none; border:none; color:#aaa; cursor:pointer; font-size: 14px; padding: 4px 8px;';
        closeBtn.onmouseover = function() { this.style.color = '#fff'; };
        closeBtn.onmouseout = function() { this.style.color = '#aaa'; };
        closeBtn.addEventListener('click', () => { config.ui.fabHidden = false; saveConfig(); createUI(); });

        header.appendChild(closeBtn);
        panel.appendChild(header);

        const contentContainer = document.createElement('div');

        function updateSpecificTimer(key) {
            switch(key) {
                case 'hunters': updateHunterTimer(); break;
                case 'praise': updatePraiseTimer(); break;
                case 'manuscript': updateManuscriptTimer(); break;
                case 'compendium': updateCompendiumTimer(); break;
                case 'blueprint': updateBlueprintTimer(); break;
                case 'autoTrade': updateAutoTradeTimer(); break;
                case 'cloudSave': updateCloudSaveTimer(); break;
            }
        }

        function createControlItem(label, configKey, uiType = 'none') {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; padding-bottom: 2px;';
            
            const isInterval = uiType === 'interval';
            const isHybridThreshold = uiType === 'hybrid';
            const isAutoTrade = configKey === 'autoTrade';

            const leftSide = document.createElement('label');
            leftSide.style.cssText = 'display: flex; align-items: center; cursor: pointer; flex-grow: 1; overflow: hidden; white-space: nowrap; margin-right: 10px;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = config[configKey].enabled;
            checkbox.style.marginRight = '8px';
            // 【关键】给checkbox添加ID，方便后续程序自动切换状态时更新UI
            checkbox.id = 'kg-assist-cb-' + configKey;
            
            checkbox.addEventListener('change', (e) => {
                config[configKey].enabled = e.target.checked;
                saveConfig();
                if (isInterval) updateSpecificTimer(configKey);
            });
            leftSide.appendChild(checkbox);
            
            let labelText = label;
            if (isAutoTrade) labelText = '定时交易';
            
            leftSide.appendChild(document.createTextNode(labelText));
            row.appendChild(leftSide);

            const rightSide = document.createElement('div');
            rightSide.style.cssText = 'display: flex; align-items: center; justify-content: flex-end;';

            if (isHybridThreshold) {
                const itemType = config[configKey].type;
                if (itemType === 'percent') {
                    const sliderContainer = document.createElement('div');
                    sliderContainer.style.cssText = 'display:flex; align-items:center; width: 240px;';
                    const rangeInput = document.createElement('input');
                    rangeInput.type = 'range'; rangeInput.min = '1'; rangeInput.max = '100';
                    rangeInput.value = config[configKey].thresholdPercent;
                    rangeInput.style.cssText = 'flex-grow:1; cursor: pointer; height: 6px; background: #555; outline: none; opacity: 0.8; transition: opacity .2s; border-radius: 3px;';
                    const percentText = document.createElement('span');
                    percentText.style.cssText = 'font-size: 11px; width: 160px; text-align: left; color: #ccc; white-space: nowrap; margin-left: 8px;';
                    const updatePercentText = (percentVal) => {
                        const resName = capResourceMap[configKey];
                        let actualVal = 'N/A';
                        try { const resData = gamePage.resPool.get(resName); if (resData && resData.maxValue > 0) { actualVal = Math.floor(resData.maxValue * (percentVal / 100)); } } catch (e) {}
                        if (configKey === 'emergencyTradeCatnip') {
                            percentText.innerText = `低于 ${percentVal}% (${actualVal})`;
                            percentText.title = `当猫薄荷低于 ${actualVal} 时触发交易`;
                        } else {
                            percentText.innerText = `${percentVal}% (${actualVal})`;
                            percentText.title = `当前上限的 ${percentVal}% 约为: ${actualVal}`;
                        }
                    };
                    updatePercentText(rangeInput.value);
                    rangeInput.addEventListener('input', (e) => {
                        const val = parseInt(e.target.value); config[configKey].thresholdPercent = val; updatePercentText(val); saveConfig();
                    });
                    sliderContainer.appendChild(rangeInput); sliderContainer.appendChild(percentText); rightSide.appendChild(sliderContainer);
                } else if (itemType === 'fixed') {
                    const input = document.createElement('input'); input.type = 'number'; input.value = config[configKey].thresholdFixed; input.step = 1000; input.min = 0;
                    input.style.cssText = 'width: 70px; background: #333; color: #eee; border: 1px solid #444; padding: 2px 4px; font-size: 11px; text-align: right; border-radius: 3px;';
                    input.addEventListener('change', (e) => {
                        let val = parseInt(e.target.value); if (isNaN(val) || val < 0) val = 0; config[configKey].thresholdFixed = val; e.target.value = val; saveConfig();
                    });
                    rightSide.appendChild(input);
                }
            } else if (isAutoTrade) {
                const raceSelect = document.createElement('select');
                raceSelect.style.cssText = 'width: 80px; background: #333; color: #eee; border: 1px solid #444; padding: 1px; font-size: 11px; margin-right: 5px; border-radius: 3px;';
                let hasUnlockedRaces = false;
                if (gamePage.diplomacy && gamePage.diplomacy.races) {
                    gamePage.diplomacy.races.forEach(race => {
                        if (race.unlocked) { const option = document.createElement('option'); option.value = race.name; option.text = race.title || race.name; raceSelect.appendChild(option); hasUnlockedRaces = true; }
                    });
                }
                if (!hasUnlockedRaces) { const option = document.createElement('option'); option.text = '无'; raceSelect.disabled = true; raceSelect.appendChild(option); }
                else {
                    let targetExists = Array.from(raceSelect.options).some(opt => opt.value === config[configKey].targetRace);
                    if (targetExists) { raceSelect.value = config[configKey].targetRace; }
                    else if (raceSelect.options.length > 0) { raceSelect.value = raceSelect.options[0].value; config[configKey].targetRace = raceSelect.value; saveConfig(); }
                }
                raceSelect.addEventListener('change', (e) => { config.autoTrade.targetRace = e.target.value; saveConfig(); });
                rightSide.appendChild(raceSelect);
            }
            if (isInterval) {
                const input = document.createElement('input'); input.type = 'number'; input.value = config[configKey].intervalMinutes; input.step = 1; input.min = 1;
                input.style.cssText = 'width: 45px; background: #333; color: #eee; border: 1px solid #444; padding: 2px 4px; font-size: 11px; text-align: right; border-radius: 3px;';
                input.addEventListener('change', (e) => {
                    let val = parseInt(e.target.value); if (isNaN(val) || val < 1) val = 1; config[configKey].intervalMinutes = val; e.target.value = val; saveConfig();
                    updateSpecificTimer(configKey);
                });
                rightSide.appendChild(input);
                const minSpan = document.createElement('span'); minSpan.innerText = '分'; minSpan.style.marginLeft = '3px'; minSpan.style.fontSize = '11px'; rightSide.appendChild(minSpan);
            }
            row.appendChild(rightSide);
            return row;
        }

        contentContainer.appendChild(createControlItem('自动点星图', 'starchart'));
        contentContainer.appendChild(document.createElement('hr')).style.borderColor = '#444';
        contentContainer.appendChild(createControlItem('木材 -> 木梁 (上限%)', 'wood', 'hybrid'));
        contentContainer.appendChild(createControlItem('矿物 -> 石板 (上限%)', 'minerals', 'hybrid'));
        contentContainer.appendChild(createControlItem('煤炭 -> 钢铁 (上限%)', 'coal', 'hybrid'));
        contentContainer.appendChild(createControlItem('铁 -> 金属板 (上限%)', 'iron', 'hybrid'));
        contentContainer.appendChild(createControlItem('猫薄荷 -> 木头 (上限%)', 'catnipWood', 'hybrid'));
        contentContainer.appendChild(createControlItem('石油 -> 煤油 (上限%)', 'oilKerosene', 'hybrid'));
        contentContainer.appendChild(createControlItem('猫薄荷 < 阈值 -> 交易鲨鱼(1次)', 'emergencyTradeCatnip', 'hybrid'));

        contentContainer.appendChild(document.createElement('hr')).style.borderColor = '#444';
        contentContainer.appendChild(createControlItem('木梁 -> 脚手架 (固定值)', 'scaffold', 'hybrid'));
        contentContainer.appendChild(createControlItem('毛皮 ->羊皮纸 (固定值)', 'parchment', 'hybrid'));
        contentContainer.appendChild(document.createElement('hr')).style.borderColor = '#444';
        contentContainer.appendChild(createControlItem('自动派猎人', 'hunters', 'interval'));
        // 【新增UI】智能猎人控制
        contentContainer.appendChild(createControlItem('智能猎人 (金满停/低开)', 'smartHunterGold'));
        
        contentContainer.appendChild(createControlItem('自动赞美太阳', 'praise', 'interval'));
        contentContainer.appendChild(createControlItem('定时合手稿', 'manuscript', 'interval'));
        contentContainer.appendChild(createControlItem('定时合概要', 'compendium', 'interval'));
        contentContainer.appendChild(createControlItem('定时合蓝图', 'blueprint', 'interval'));
        contentContainer.appendChild(createControlItem('定时交易', 'autoTrade', 'interval'));
        contentContainer.appendChild(createControlItem('定时云存储', 'cloudSave', 'interval'));

        panel.appendChild(contentContainer);
        document.body.appendChild(panel);

        // UI拖拽逻辑...
        let isDragging = false; let offsetX, offsetY;
        header.addEventListener('mousedown', (e) => { isDragging = true; offsetX = e.clientX - panel.offsetLeft; offsetY = e.clientY - panel.offsetTop; header.style.cursor = 'grabbing'; });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panel.style.left = (e.clientX - offsetX) + 'px';
            panel.style.top = (e.clientY - offsetY) + 'px';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false; header.style.cursor = 'move';
                config.ui.posX = panel.style.left;
                config.ui.posY = panel.style.top;
                saveConfig();
            }
        });
    }


    // ==========================================
    // 3. 自动化逻辑核心 (Automation Logic)
    // ==========================================

    let hasTradedForCatnipState = false;
    const timers = {};

    function checkAndCraftThreshold(resName, craftTargetName, configKey) {
        if (!config[configKey].enabled) return;
        try {
            const actualThreshold = getActualThreshold(configKey);
            if (gamePage.resPool.get(resName).value > actualThreshold) {
                gamePage.craftAll(craftTargetName);
            }
        } catch (e) {}
    }

    function mainLoopTask() {
        if (config.starchart.enabled) {
            try { const btn = document.getElementById('observeBtn'); if (btn && btn.style.display !== 'none') btn.click(); } catch (e) {}
        }

        if (gamePage && gamePage.resPool) {
            checkAndCraftThreshold('wood', 'beam', 'wood');
            checkAndCraftThreshold('minerals', 'slab', 'minerals');
            checkAndCraftThreshold('coal', 'steel', 'coal');
            checkAndCraftThreshold('iron', 'plate', 'iron');
            checkAndCraftThreshold('beam', 'scaffold', 'scaffold');
            checkAndCraftThreshold('furs', 'parchment', 'parchment');
            checkAndCraftThreshold('oil', 'kerosene', 'oilKerosene');

            if (config.catnipWood.enabled) {
                try {
                    const catnipRes = gamePage.resPool.get('catnip');
                    const currentThreshold = getActualThreshold('catnipWood');
                    if (catnipRes.value > currentThreshold) {
                        const targetAmount = catnipRes.value * 0.20;
                        const craftActions = Math.floor(targetAmount / 100);
                        if (craftActions > 0) gamePage.craft('wood', craftActions);
                    }
                } catch (e) {}
            }

            if (config.emergencyTradeCatnip.enabled) {
                try {
                    const catnipRes = gamePage.resPool.get('catnip');
                    const threshold = catnipRes.maxValue * (config.emergencyTradeCatnip.thresholdPercent / 100);
                    if (catnipRes.value < threshold) {
                        if (!hasTradedForCatnipState) {
                            const race = gamePage.diplomacy.races.find(r => r.name === 'sharks');
                            if (race && race.unlocked) {
                                gamePage.diplomacy.trade(race, 1);
                                console.log(`【自动化】🐟 猫薄荷低于 ${config.emergencyTradeCatnip.thresholdPercent}%，紧急与鲨鱼交易一次。`);
                                hasTradedForCatnipState = true;
                            }
                        }
                    } else {
                        if (catnipRes.value > threshold * 1.05 && hasTradedForCatnipState) {
                            hasTradedForCatnipState = false;
                        }
                    }
                } catch (e) {}
            }

            // 【新增】智能猎人逻辑：监控黄金
            if (config.smartHunterGold.enabled) {
                try {
                    const gold = gamePage.resPool.get('gold');
                    if (gold && gold.maxValue > 0) {
                        // 逻辑1：黄金满 -> 停止猎人
                        if (gold.value >= gold.maxValue && config.hunters.enabled) {
                            config.hunters.enabled = false;
                            updateHunterTimer(); // 立即停止定时器
                            saveConfig();
                            // 同步UI状态
                            const cb = document.getElementById('kg-assist-cb-hunters');
                            if (cb) cb.checked = false;
                            console.log('【自动化】💰 黄金已满，智能暂停自动派猎人。');
                        }
                        // 逻辑2：黄金 < 1000 -> 开启猎人
                        else if (gold.value < 10000 && !config.hunters.enabled) {
                            config.hunters.enabled = true;
                            updateHunterTimer(); // 立即开启定时器
                            saveConfig();
                            // 同步UI状态
                            const cb = document.getElementById('kg-assist-cb-hunters');
                            if (cb) cb.checked = true;
                            console.log('【自动化】💰 黄金不足10000，智能恢复自动派猎人。');
                        }
                    }
                } catch (e) {
                    console.error('智能猎人逻辑出错:', e);
                }
            }
        }
    }

    // --- 定时任务区域 ---
    const tasks = {
        hunters: () => { try { if (gamePage.village.huntAll) { gamePage.village.huntAll(); console.log(`【自动化】✅ 已通过内核调用派出猎人。`); } } catch (e) { console.error('派出猎人出错:', e); } },
        praise: () => { try { if (gamePage.resPool.get('faith').value > 0) { gamePage.religion.praise(); console.log(`【自动化】☀️ 已通过内核调用“赞美太阳”！`); } } catch (e) {} },
        manuscript: () => { try { gamePage.craftAll('manuscript'); console.log(`【自动化】📜 已执行合成全部手稿。`); } catch (e) { console.error('合成手稿出错:', e); } },
        compendium: () => { try { gamePage.craftAll('compedium'); console.log(`【自动化】📚 已执行合成全部概要。`); } catch (e) { console.error('合成概要出错:', e); } },
        blueprint: () => { try { gamePage.craftAll('blueprint'); console.log(`【自动化】📘 已执行合成全部蓝图。`); } catch (e) { console.error('合成蓝图出错:', e); } },
        autoTrade: () => {
            const targetId = config.autoTrade.targetRace;
            if (!targetId || !gamePage.diplomacy || !gamePage.diplomacy.races) return;
            try {
                const race = gamePage.diplomacy.races.find(r => r.name === targetId);
                if (race && race.unlocked) {
                    gamePage.diplomacy.tradeAll(race);
                    console.log(`【自动化】🤝 已通过内核调用与 [${race.title}] (ID: ${race.name}) 交易。`);
                } else {
                    console.warn(`【自动化】⚠️ 交易失败：未找到ID为 [${targetId}] 的已解锁种族。`);
                }
            } catch (e) { console.error(`【自动化】❌ 自动交易出错:`, e); }
        },
        cloudSave: () => {
             if (!config.cloudSave.enabled) return;
             console.log('【自动化】☁️ 开始执行云存储流程...');
             const cloudBtnId = 'cloudSaveBtn';
             let cloudBtn = document.getElementById(cloudBtnId);
             const performSaveSequence = (needToCloseAtEnd) => {
                 if (gamePage.save) gamePage.save();
                 document.getElementById(cloudBtnId).click();
                 console.log(`【自动化】☁️ 已点击云存储按钮。`);
                 if (needToCloseAtEnd) {
                     setTimeout(() => {
                         if (gamePage.server && gamePage.server.toggle) {
                             gamePage.server.toggle();
                             console.log(`【自动化】☁️ 已自动折叠云存储菜单。`);
                         }
                     }, 1000);
                 }
             };
             const isMenuOpen = cloudBtn && cloudBtn.offsetParent !== null;
             if (isMenuOpen) {
                 console.log('【自动化】☁️ 检测到菜单已打开，直接保存并随后关闭。');
                 performSaveSequence(true);
             } else {
                 console.log('【自动化】☁️ 菜单未打开，正在打开菜单...');
                 if (gamePage.server && gamePage.server.toggle) {
                     gamePage.server.toggle();
                     setTimeout(() => {
                          cloudBtn = document.getElementById(cloudBtnId);
                          if (cloudBtn && cloudBtn.offsetParent !== null) {
                              performSaveSequence(true);
                          } else {
                              console.error('【自动化】❌ 尝试打开菜单后，云保存按钮仍然不可见(可能未登录)。');
                              gamePage.server.toggle();
                          }
                     }, 1000);
                 } else { console.error('【自动化】❌ 无法调用游戏内部 toggle 方法打开菜单。'); }
             }
        }
    };

    function updateTimer(key) {
        if (timers[key]) clearInterval(timers[key]);
        if (config[key].enabled) {
            const intervalMs = Math.max((config[key].intervalMinutes || 60) * 60 * 1000, 60000);
            timers[key] = setInterval(tasks[key], intervalMs);
            console.log(`[设置] ${key} 定时器已更新，间隔: ${config[key].intervalMinutes} 分钟。`);
        }
    }
    
    function updateHunterTimer() { updateTimer('hunters'); }
    function updatePraiseTimer() { updateTimer('praise'); }
    function updateManuscriptTimer() { updateTimer('manuscript'); }
    function updateCompendiumTimer() { updateTimer('compendium'); }
    function updateBlueprintTimer() { updateTimer('blueprint'); }
    function updateAutoTradeTimer() { updateTimer('autoTrade'); }
    function updateCloudSaveTimer() { updateTimer('cloudSave'); }


    // ==========================================
    // 4. 启动与清理 (Init & Cleanup)
    // ==========================================

    function init() {
        if (window.kgAutoGlobalTimer) clearInterval(window.kgAutoGlobalTimer);
        Object.values(timers).forEach(clearInterval);
        
        createUI();

        window.kgAutoGlobalTimer = setInterval(mainLoopTask, 2000);
        updateHunterTimer(); updatePraiseTimer(); updateManuscriptTimer();
        updateCompendiumTimer(); updateBlueprintTimer(); updateAutoTradeTimer(); updateCloudSaveTimer();

        console.log('>>> 🐱 全能小助手 v7.5 (智能猎人版) 启动成功！ <<<');
    }

    window.stopKgAutoAssist = function() {
        if (window.kgAutoGlobalTimer) clearInterval(window.kgAutoGlobalTimer);
        Object.values(timers).forEach(clearInterval);
        const panel = document.getElementById('kg-auto-assist-panel');
        if (panel) panel.remove();
        const fab = document.getElementById('kg-auto-assist-fab');
        if (fab) fab.remove();
        console.log('>>> ⛔️ 脚本已停止。 <<<');
    };

    setTimeout(init, 5000);

})();
