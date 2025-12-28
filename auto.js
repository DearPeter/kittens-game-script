// ==UserScript==
// @name         猫国建设者全能小助手 (GUI版 v7.6.1 - 智能交易目标切换)
// @namespace    http://tampermonkey.net/
// @version      7.6.1
// @description  基于v7.6改进。完全保留原有的“定时自动交易”功能（不替代、不新增额外交易）。新增“智能目标切换”：根据铀/钛/库存情况，自动修改定时交易的目标种族（龙/斑马/鲨鱼）。
// @author       AI Assistant
// @match        *://kittensgame.com/web/*
// @updateURL    https://raw.githubusercontent.com/DearPeter/kittens-game-script/main/auto.js
// @downloadURL  https://raw.githubusercontent.com/DearPeter/kittens-game-script/main/auto.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('>>> 猫国建设者全能小助手 GUI版 v7.6.1 (智能目标切换版) 正在加载... <<<');

    // ==========================================
    // 1. 配置中心与存储 (Configuration & Storage)
    // ==========================================

    const STORAGE_KEY = 'KG_AutoAssist_Config_v7_6'; 

    const defaultConfig = {
        starchart: { enabled: true },
        // --- 百分比类 ---
        wood: { enabled: true, type: 'percent', thresholdPercent: 90 },
        minerals: { enabled: true, type: 'percent', thresholdPercent: 90 },
        coal: { enabled: true, type: 'percent', thresholdPercent: 90 },
        iron: { enabled: true, type: 'percent', thresholdPercent: 90 },
        catnipWood: { enabled: false, type: 'percent', thresholdPercent: 90 },
        oilKerosene: { enabled: false, type: 'percent', thresholdPercent: 90 },
        
        // --- 智能控制类 ---
        smartHunterGold: { enabled: false }, 

        // --- 智能交易切换 (v7.6.1 修改) ---
        // 注意：这里不再控制是否交易，只控制是否“自动切换目标”
        smartTrade: { 
            enabled: false, 
            minUranium: 1000, 
            minTitanium: 10000,
            capRatio: 90 
        },

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
        // 核心：定时交易
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
                if (!parsed.smartTrade) parsed.smartTrade = defaultConfig.smartTrade;
                if (!parsed.smartHunterGold) parsed.smartHunterGold = defaultConfig.smartHunterGold;
                if (!parsed.ui) parsed.ui = defaultConfig.ui;
                if (parsed.ui.fabHidden === undefined) parsed.ui.fabHidden = defaultConfig.ui.fabHidden;
                
                if (!parsed.autoTrade || !parsed.autoTrade.targetRace) {
                    parsed.autoTrade = { ...defaultConfig.autoTrade, ...parsed.autoTrade };
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
        fab.addEventListener('click', () => { config.ui.fabHidden = true; saveConfig(); createUI(); });
        document.body.appendChild(fab);
    }

    function createMainPanel() {
        const winWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
        const winHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        const panelTotalWidth = 490;
        const panelTotalHeightEstimate = 650;

        let resetNeeded = false;
        if (config.ui.posX !== 'auto') {
            const currentLeft = parseInt(config.ui.posX);
            if (isNaN(currentLeft) || currentLeft + panelTotalWidth > winWidth) {
                config.ui.posX = 'auto'; resetNeeded = true;
            }
        }
        if (config.ui.posY !== 'auto') {
             const currentTop = parseInt(config.ui.posY);
             if (isNaN(currentTop) || currentTop < 0 || currentTop + panelTotalHeightEstimate > winHeight) {
                 config.ui.posY = '20px'; resetNeeded = true;
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
        header.innerHTML = '<strong style="font-size:15px;">🐱 小助手 v7.6.1 (智能切目标)</strong>';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✖';
        closeBtn.style.cssText = 'background:none; border:none; color:#aaa; cursor:pointer; font-size: 14px;';
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

        // --- 通用控件 ---
        function createControlItem(label, configKey, uiType = 'none') {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;';
            
            const isInterval = uiType === 'interval';
            const isHybridThreshold = uiType === 'hybrid';
            const isAutoTrade = configKey === 'autoTrade';

            const leftSide = document.createElement('label');
            leftSide.style.cssText = 'display: flex; align-items: center; cursor: pointer; flex-grow: 1;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = config[configKey].enabled;
            checkbox.style.marginRight = '8px';
            checkbox.id = 'kg-assist-cb-' + configKey;
            
            checkbox.addEventListener('change', (e) => {
                config[configKey].enabled = e.target.checked;
                saveConfig();
                if (isInterval) updateSpecificTimer(configKey);
            });
            leftSide.appendChild(checkbox);
            leftSide.appendChild(document.createTextNode(label));
            row.appendChild(leftSide);

            const rightSide = document.createElement('div');
            rightSide.style.cssText = 'display: flex; align-items: center; justify-content: flex-end;';

            if (isHybridThreshold) {
                // ... 省略 Hybrid 逻辑，与 v7.6 一致 ...
                const itemType = config[configKey].type;
                if (itemType === 'percent') {
                    const sliderContainer = document.createElement('div');
                    sliderContainer.style.cssText = 'display:flex; align-items:center; width: 240px;';
                    const rangeInput = document.createElement('input');
                    rangeInput.type = 'range'; rangeInput.min = '1'; rangeInput.max = '100';
                    rangeInput.value = config[configKey].thresholdPercent;
                    rangeInput.style.cssText = 'flex-grow:1; cursor: pointer; height: 6px; background: #555; outline: none; border-radius: 3px;';
                    const percentText = document.createElement('span');
                    percentText.style.cssText = 'font-size: 11px; width: 160px; text-align: left; color: #ccc; margin-left: 8px;';
                    const updatePercentText = (percentVal) => {
                        const resName = capResourceMap[configKey];
                        let actualVal = 'N/A';
                        try { const resData = gamePage.resPool.get(resName); if (resData) actualVal = Math.floor(resData.maxValue * (percentVal / 100)); } catch (e) {}
                        percentText.innerText = `${percentVal}% (${actualVal})`;
                    };
                    updatePercentText(rangeInput.value);
                    rangeInput.addEventListener('input', (e) => {
                        const val = parseInt(e.target.value); config[configKey].thresholdPercent = val; updatePercentText(val); saveConfig();
                    });
                    sliderContainer.appendChild(rangeInput); sliderContainer.appendChild(percentText); rightSide.appendChild(sliderContainer);
                } else if (itemType === 'fixed') {
                    const input = document.createElement('input'); input.type = 'number'; input.value = config[configKey].thresholdFixed;
                    input.style.cssText = 'width: 70px; background: #333; color: #eee; border: 1px solid #444; text-align: right;';
                    input.addEventListener('change', (e) => { config[configKey].thresholdFixed = parseInt(e.target.value) || 0; saveConfig(); });
                    rightSide.appendChild(input);
                }
            } else if (isAutoTrade) {
                const raceSelect = document.createElement('select');
                // 【关键】添加ID，以便脚本自动修改它
                raceSelect.id = 'kg-assist-select-autoTrade-race';
                raceSelect.style.cssText = 'width: 80px; background: #333; color: #eee; border: 1px solid #444; font-size: 11px; margin-right: 5px;';
                
                let hasUnlockedRaces = false;
                if (gamePage.diplomacy && gamePage.diplomacy.races) {
                    gamePage.diplomacy.races.forEach(race => {
                        if (race.unlocked) { 
                            const option = document.createElement('option'); 
                            option.value = race.name; 
                            option.text = race.title || race.name; 
                            raceSelect.appendChild(option); 
                            hasUnlockedRaces = true; 
                        }
                    });
                }
                if (hasUnlockedRaces) {
                    raceSelect.value = config[configKey].targetRace;
                }
                raceSelect.addEventListener('change', (e) => { config.autoTrade.targetRace = e.target.value; saveConfig(); });
                rightSide.appendChild(raceSelect);
            }
            if (isInterval) {
                const input = document.createElement('input'); input.type = 'number'; input.value = config[configKey].intervalMinutes; input.min = 1;
                input.style.cssText = 'width: 45px; background: #333; color: #eee; border: 1px solid #444; text-align: right;';
                input.addEventListener('change', (e) => {
                    config[configKey].intervalMinutes = Math.max(1, parseInt(e.target.value) || 1);
                    saveConfig(); updateSpecificTimer(configKey);
                });
                rightSide.appendChild(input);
                rightSide.appendChild(document.createTextNode('分'));
            }
            row.appendChild(rightSide);
            return row;
        }

        // --- 构建现有列表 ---
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
        contentContainer.appendChild(createControlItem('智能猎人 (金满停/低开)', 'smartHunterGold'));
        contentContainer.appendChild(createControlItem('自动赞美太阳', 'praise', 'interval'));
        contentContainer.appendChild(createControlItem('定时合手稿', 'manuscript', 'interval'));
        contentContainer.appendChild(createControlItem('定时合概要', 'compendium', 'interval'));
        contentContainer.appendChild(createControlItem('定时合蓝图', 'blueprint', 'interval'));
        // 这里的“定时交易”是核心，被下方的智能逻辑控制
        contentContainer.appendChild(createControlItem('定时交易 (Timer)', 'autoTrade', 'interval'));
        contentContainer.appendChild(createControlItem('定时云存储', 'cloudSave', 'interval'));

        // ===============================================
        // 新增：智能交易目标切换 (Target Switcher)
        // ===============================================
        const hr = document.createElement('hr'); hr.style.borderColor = '#666'; hr.style.marginTop = '10px';
        contentContainer.appendChild(hr);

        const tradeHeader = document.createElement('div');
        tradeHeader.innerHTML = '<strong>智能切换定时交易目标</strong>';
        tradeHeader.style.marginBottom = '5px'; tradeHeader.style.color = '#ffdb4d';
        contentContainer.appendChild(tradeHeader);

        // 总开关
        const stRow = document.createElement('div');
        stRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;';
        const stLabel = document.createElement('label'); stLabel.style.cursor = 'pointer';
        const stCb = document.createElement('input'); stCb.type = 'checkbox'; stCb.checked = config.smartTrade.enabled; stCb.style.marginRight = '8px';
        stCb.addEventListener('change', (e) => { config.smartTrade.enabled = e.target.checked; saveConfig(); });
        stLabel.appendChild(stCb); stLabel.appendChild(document.createTextNode('启用目标托管'));
        stRow.appendChild(stLabel); contentContainer.appendChild(stRow);

        // 阈值配置行
        function createTradeInput(labelHtml, key) {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:4px; padding-left:20px;';
            const lbl = document.createElement('span'); lbl.innerHTML = labelHtml;
            const inp = document.createElement('input'); inp.type = 'number'; inp.value = config.smartTrade[key];
            inp.style.cssText = 'width:60px; background:#333; color:#eee; border:1px solid #444; text-align:right;';
            inp.addEventListener('change', (e) => { config.smartTrade[key] = Number(e.target.value); saveConfig(); });
            div.appendChild(lbl); div.appendChild(inp);
            return div;
        }

        contentContainer.appendChild(createTradeInput("铀 < 此值切 [龙] (Priority 1):", 'minUranium'));
        contentContainer.appendChild(createTradeInput("钛 < 此值切 [斑马] (Priority 2):", 'minTitanium'));
        
        const stTip = document.createElement('div');
        stTip.innerText = "* 仅修改上方“定时交易”的目标，不会额外交易。\n* 若资源 > 90% 则切 [鲨鱼]。";
        stTip.style.fontSize = '10px'; stTip.style.color = '#888'; stTip.style.paddingLeft = '20px'; stTip.style.lineHeight = '1.4';
        contentContainer.appendChild(stTip);

        panel.appendChild(contentContainer);
        document.body.appendChild(panel);

        // UI拖拽逻辑...
        let isDragging = false; let offsetX, offsetY;
        header.addEventListener('mousedown', (e) => { isDragging = true; offsetX = e.clientX - panel.offsetLeft; offsetY = e.clientY - panel.offsetTop; header.style.cursor = 'grabbing'; });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panel.style.left = (e.clientX - offsetX) + 'px';
            panel.style.top = (e.clientY - offsetY) + 'px';
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) { isDragging = false; header.style.cursor = 'move'; config.ui.posX = panel.style.left; config.ui.posY = panel.style.top; saveConfig(); }
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

    // --- [v7.6.1] 智能目标切换逻辑 (不执行交易，只修改目标) ---
    function runSmartTradeTargetUpdate() {
        if (!config.smartTrade.enabled) return;
        const game = gamePage;
        
        const resU = game.resPool.get("uranium");
        const resT = game.resPool.get("titanium");
        
        let newTarget = null;

        // 优先级 1: 铀量不足 -> 切龙 (Dragons)
        if (resU.value < config.smartTrade.minUranium) {
            newTarget = 'dragons';
        }
        // 优先级 2: 钛量不足 -> 切斑马 (Zebras)
        else if (resT.value < config.smartTrade.minTitanium) {
            newTarget = 'zebras';
        }
        // 优先级 3: 资源即将溢出 -> 切鲨鱼 (Sharks)
        else {
            const capRatio = (config.smartTrade.capRatio || 90) / 100;
            const isUHigh = resU.value >= (resU.maxValue * capRatio);
            const isTHigh = resT.value >= (resT.maxValue * capRatio);
            if (isUHigh || isTHigh) {
                newTarget = 'sharks';
            }
        }

        // 如果触发了切换逻辑，且当前目标与新目标不一致，则更新
        if (newTarget && config.autoTrade.targetRace !== newTarget) {
            // 检查该种族是否解锁
            const race = game.diplomacy.get(newTarget);
            if (race && race.unlocked) {
                console.log(`【智能托管】检测到资源变化，将定时交易目标从 [${config.autoTrade.targetRace}] 切换为 [${newTarget}]`);
                config.autoTrade.targetRace = newTarget;
                saveConfig();
                
                // 同步更新UI上的下拉框 (如果面板打开着)
                const selectEl = document.getElementById('kg-assist-select-autoTrade-race');
                if (selectEl) {
                    selectEl.value = newTarget;
                }
            }
        }
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

            // 运行智能目标切换逻辑
            runSmartTradeTargetUpdate();

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
                                hasTradedForCatnipState = true;
                            }
                        }
                    } else {
                        if (catnipRes.value > threshold * 1.05 && hasTradedForCatnipState) { hasTradedForCatnipState = false; }
                    }
                } catch (e) {}
            }

            if (config.smartHunterGold.enabled) {
                try {
                    const gold = gamePage.resPool.get('gold');
                    if (gold && gold.maxValue > 0) {
                        if (gold.value >= gold.maxValue && config.hunters.enabled) {
                            config.hunters.enabled = false;
                            updateHunterTimer(); saveConfig();
                            const cb = document.getElementById('kg-assist-cb-hunters');
                            if (cb) cb.checked = false;
                        } else if (gold.value < 1000 && !config.hunters.enabled) {
                            config.hunters.enabled = true;
                            updateHunterTimer(); saveConfig();
                            const cb = document.getElementById('kg-assist-cb-hunters');
                            if (cb) cb.checked = true;
                        }
                    }
                } catch (e) {}
            }
        }
    }

    // --- 定时任务区域 ---
    const tasks = {
        hunters: () => { try { if (gamePage.village.huntAll) { gamePage.village.huntAll(); console.log(`【自动化】✅ 已派出猎人。`); } } catch (e) {} },
        praise: () => { try { if (gamePage.resPool.get('faith').value > 0) { gamePage.religion.praise(); console.log(`【自动化】☀️ 已赞美太阳。`); } } catch (e) {} },
        manuscript: () => { try { gamePage.craftAll('manuscript'); console.log(`【自动化】📜 合成手稿。`); } catch (e) {} },
        compendium: () => { try { gamePage.craftAll('compedium'); console.log(`【自动化】📚 合成概要。`); } catch (e) {} },
        blueprint: () => { try { gamePage.craftAll('blueprint'); console.log(`【自动化】📘 合成蓝图。`); } catch (e) {} },
        // 定时交易：仅仅执行“与当前配置的目标种族交易”
        autoTrade: () => {
            const targetId = config.autoTrade.targetRace;
            if (!targetId || !gamePage.diplomacy) return;
            try {
                const race = gamePage.diplomacy.races.find(r => r.name === targetId);
                if (race && race.unlocked) {
                    gamePage.diplomacy.tradeAll(race);
                    console.log(`【自动化】🤝 定时任务触发：与 [${race.title}] (ID: ${race.name}) 交易全部资源。`);
                }
            } catch (e) { console.error(`交易出错:`, e); }
        },
        cloudSave: () => {
             if (!config.cloudSave.enabled) return;
             const cloudBtn = document.getElementById('cloudSaveBtn');
             if (cloudBtn && cloudBtn.offsetParent !== null) {
                 if (gamePage.save) gamePage.save();
                 cloudBtn.click();
                 console.log(`【自动化】☁️ 云存储已执行。`);
             } else {
                 if (gamePage.server && gamePage.server.toggle) {
                     gamePage.server.toggle(); // 尝试打开菜单以便下次执行
                 }
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

        console.log('>>> 🐱 全能小助手 v7.6.1 (智能目标切换版) 启动成功！ <<<');
    }

    window.stopKgAutoAssist = function() {
        if (window.kgAutoGlobalTimer) clearInterval(window.kgAutoGlobalTimer);
        Object.values(timers).forEach(clearInterval);
        const panel = document.getElementById('kg-auto-assist-panel');
        if (panel) panel.remove();
        const fab = document.getElementById('kg-auto-assist-fab');
        if (fab) fab.remove();
    };

    setTimeout(init, 5000);

})();
