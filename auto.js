// ==UserScript==
// @name         猫国建设者全能小助手 (GUI版 v7.8.7 - 独角兽牧场版)
// @namespace    http://tampermonkey.net/
// @version      7.8.7
// @description  基于v7.8.6改进。新增功能：自动升级独角兽牧场 (Unicorn Pasture)。保持铀转钍、钛转合金、智能猎人等所有原有功能不变。
// @author       AI Assistant
// @match        *://kittensgame.com/web/*
// @updateURL    https://raw.githubusercontent.com/DearPeter/kittens-game-script/main/auto.js
// @downloadURL  https://raw.githubusercontent.com/DearPeter/kittens-game-script/main/auto.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('>>> 猫国建设者全能小助手 GUI版 v7.8.7 (独角兽牧场版) 正在加载... <<<');

    // ==========================================
    // 1. 配置中心与存储 (Configuration & Storage)
    // ==========================================

    const STORAGE_KEY = 'KG_AutoAssist_Config_v7_8'; 
    const PROFILES_KEY = 'KG_AutoAssist_Profiles_v1';

    const defaultConfig = {
        starchart: { enabled: true },
        unicornPasture: { enabled: false }, // [新增] 自动升级独角兽牧场
        // --- 百分比类 ---
        wood: { enabled: true, type: 'percent', thresholdPercent: 90 },
        minerals: { enabled: true, type: 'percent', thresholdPercent: 90 },
        coal: { enabled: true, type: 'percent', thresholdPercent: 90 },
        iron: { enabled: true, type: 'percent', thresholdPercent: 90 },
        catnipWood: { enabled: false, type: 'percent', thresholdPercent: 90 },
        oilKerosene: { enabled: false, type: 'percent', thresholdPercent: 90 },
        // 特殊合成
        eludium: { enabled: false, type: 'percent', thresholdPercent: 90 }, // E合金
        titaniumAlloy: { enabled: false, type: 'percent', thresholdPercent: 90 }, // 钛->合金
        uraniumThorium: { enabled: false, type: 'percent', thresholdPercent: 90 }, // 铀->钍
        
        // --- 智能控制类 ---
        smartHunterGold: { enabled: false }, 

        // --- 智能级联交易 ---
        smartTrade: { 
            enabled: false,
            p1: { race: 'dragons', percent: 95 },
            p2: { race: 'zebras', percent: 90 },
            p3: { race: 'sharks', percent: 0 } 
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
                // 兼容旧档：确保新字段存在
                if (!parsed.unicornPasture) parsed.unicornPasture = defaultConfig.unicornPasture; // [新增]
                if (!parsed.uraniumThorium) parsed.uraniumThorium = defaultConfig.uraniumThorium;
                if (!parsed.titaniumAlloy) parsed.titaniumAlloy = defaultConfig.titaniumAlloy;
                if (!parsed.eludium) parsed.eludium = defaultConfig.eludium;
                
                if (!parsed.smartTrade || !parsed.smartTrade.p1) parsed.smartTrade = defaultConfig.smartTrade;
                if (!parsed.smartHunterGold) parsed.smartHunterGold = defaultConfig.smartHunterGold;
                if (!parsed.ui) parsed.ui = defaultConfig.ui;
                if (parsed.ui.fabHidden === undefined) parsed.ui.fabHidden = defaultConfig.ui.fabHidden;
                if (!parsed.autoTrade || !parsed.autoTrade.targetRace) {
                    parsed.autoTrade = { ...defaultConfig.autoTrade, ...parsed.autoTrade };
                }
                return { ...defaultConfig, ...parsed };
            }
        } catch (e) { console.error('读取配置失败:', e); }
        return JSON.parse(JSON.stringify(defaultConfig));
    }

    function saveConfig() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (e) { console.error('保存配置失败:', e); }
    }

    // --- 档案管理 ---
    function getProfiles() { try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}'); } catch(e){return {};} }
    function saveProfile(name) {
        if (!name || !name.trim()) return false;
        const profiles = getProfiles();
        profiles[name] = JSON.parse(JSON.stringify(config));
        localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
        return true;
    }
    function loadProfile(name) {
        const profiles = getProfiles();
        if (profiles[name]) {
            config = { ...defaultConfig, ...profiles[name] };
            const currentUI = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').ui || defaultConfig.ui;
            config.ui = currentUI;
            saveConfig(); createUI();
            Object.keys(timers).forEach(key => updateSpecificTimer(key));
            return true;
        }
        return false;
    }
    function deleteProfile(name) {
        const profiles = getProfiles();
        if (profiles[name]) { delete profiles[name]; localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); return true; }
        return false;
    }

    // --- 资源映射表 ---
    const RACE_RES_MAP = {
        "lizards": "wood", "sharks": "catnip", "griffins": "wood", "nagas": "minerals",
        "zebras": "titanium", "spiders": "coal", "dragons": "uranium", "leviathans": "timeCrystal"
    };
    
    // 资源名映射 (ConfigKey -> GameResourceName)
    const capResourceMap = { 
        wood: 'wood', minerals: 'minerals', coal: 'coal', iron: 'iron', 
        catnipWood: 'catnip', emergencyTradeCatnip: 'catnip', oilKerosene: 'oil',
        eludium: 'unobtainium',
        titaniumAlloy: 'titanium',
        uraniumThorium: 'uranium' 
    };

    function getActualThreshold(configKey) {
        const itemConfig = config[configKey];
        if (itemConfig.type === 'fixed') return itemConfig.thresholdFixed;
        if (itemConfig.type === 'percent') {
            const resName = capResourceMap[configKey];
            try {
                const resData = gamePage.resPool.get(resName);
                if (resData && resData.maxValue > 0) return Math.floor(resData.maxValue * (itemConfig.thresholdPercent / 100));
            } catch (e) {}
        }
        return 9999999999;
    }

    // ==========================================
    // 2. 界面构建器 (UI Builder)
    // ==========================================

    function createUI() {
        if (typeof gamePage === 'undefined' || !gamePage.diplomacy || !gamePage.diplomacy.races) return;

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
        const panelTotalHeightEstimate = 780; 

        let resetNeeded = false;
        if (config.ui.posX !== 'auto') {
            const currentLeft = parseInt(config.ui.posX);
            if (isNaN(currentLeft) || currentLeft + panelTotalWidth > winWidth) { config.ui.posX = 'auto'; resetNeeded = true; }
        }
        if (config.ui.posY !== 'auto') {
             const currentTop = parseInt(config.ui.posY);
             if (isNaN(currentTop) || currentTop < 0 || currentTop + panelTotalHeightEstimate > winHeight) { config.ui.posY = '20px'; resetNeeded = true; }
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
        header.innerHTML = '<strong style="font-size:15px;">🐱 小助手 v7.8.7 (独角兽版)</strong>';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✖';
        closeBtn.style.cssText = 'background:none; border:none; color:#aaa; cursor:pointer; font-size: 14px;';
        closeBtn.addEventListener('click', () => { config.ui.fabHidden = false; saveConfig(); createUI(); });
        header.appendChild(closeBtn);
        panel.appendChild(header);

        const contentContainer = document.createElement('div');

        // --- Rows ---
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
            checkbox.addEventListener('change', (e) => { config[configKey].enabled = e.target.checked; saveConfig(); if (isInterval) updateSpecificTimer(configKey); });
            leftSide.appendChild(checkbox);
            leftSide.appendChild(document.createTextNode(label));
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
                    rangeInput.style.cssText = 'flex-grow:1; cursor: pointer; height: 6px; background: #555; outline: none; border-radius: 3px;';
                    const percentText = document.createElement('span');
                    percentText.style.cssText = 'font-size: 11px; width: 160px; text-align: left; color: #ccc; margin-left: 8px;';
                    const updatePercentText = (percentVal) => {
                        const resName = capResourceMap[configKey];
                        let actualVal = 'N/A';
                        try { const resData = gamePage.resPool.get(resName); if (resData && resData.maxValue > 0) actualVal = Math.floor(resData.maxValue * (percentVal / 100)); } catch (e) {}
                        percentText.innerText = `${percentVal}% (${actualVal})`;
                    };
                    updatePercentText(rangeInput.value);
                    rangeInput.addEventListener('input', (e) => { const val = parseInt(e.target.value); config[configKey].thresholdPercent = val; updatePercentText(val); saveConfig(); });
                    sliderContainer.appendChild(rangeInput); sliderContainer.appendChild(percentText); rightSide.appendChild(sliderContainer);
                } else if (itemType === 'fixed') {
                    const input = document.createElement('input'); input.type = 'number'; input.value = config[configKey].thresholdFixed;
                    input.style.cssText = 'width: 70px; background: #333; color: #eee; border: 1px solid #444; text-align: right;';
                    input.addEventListener('change', (e) => { config[configKey].thresholdFixed = parseInt(e.target.value) || 0; saveConfig(); });
                    rightSide.appendChild(input);
                }
            } else if (isAutoTrade) {
                const raceSelect = document.createElement('select');
                raceSelect.id = 'kg-assist-select-autoTrade-race';
                raceSelect.style.cssText = 'width: 80px; background: #333; color: #eee; border: 1px solid #444; font-size: 11px; margin-right: 5px;';
                if (gamePage.diplomacy && gamePage.diplomacy.races) {
                    gamePage.diplomacy.races.forEach(race => { if (race.unlocked) { const option = document.createElement('option'); option.value = race.name; option.text = race.title || race.name; raceSelect.appendChild(option); }});
                    raceSelect.value = config[configKey].targetRace;
                }
                raceSelect.addEventListener('change', (e) => { config.autoTrade.targetRace = e.target.value; saveConfig(); });
                rightSide.appendChild(raceSelect);
            }
            if (isInterval) {
                const input = document.createElement('input'); input.type = 'number'; input.value = config[configKey].intervalMinutes; input.min = 1;
                input.style.cssText = 'width: 45px; background: #333; color: #eee; border: 1px solid #444; text-align: right;';
                input.addEventListener('change', (e) => { config[configKey].intervalMinutes = Math.max(1, parseInt(e.target.value) || 1); saveConfig(); updateSpecificTimer(configKey); });
                rightSide.appendChild(input); rightSide.appendChild(document.createTextNode('分'));
            }
            row.appendChild(rightSide);
            return row;
        }

        contentContainer.appendChild(createControlItem('自动点星图', 'starchart'));
        contentContainer.appendChild(createControlItem('自动升级独角兽牧场', 'unicornPasture')); // [新增UI]
        contentContainer.appendChild(document.createElement('hr')).style.borderColor = '#444';
        contentContainer.appendChild(createControlItem('木材 -> 木梁 (上限%)', 'wood', 'hybrid'));
        contentContainer.appendChild(createControlItem('矿物 -> 石板 (上限%)', 'minerals', 'hybrid'));
        contentContainer.appendChild(createControlItem('煤炭 -> 钢铁 (上限%)', 'coal', 'hybrid'));
        contentContainer.appendChild(createControlItem('铁 -> 金属板 (上限%)', 'iron', 'hybrid'));
        contentContainer.appendChild(createControlItem('猫薄荷 -> 木头 (上限%)', 'catnipWood', 'hybrid'));
        contentContainer.appendChild(createControlItem('石油 -> 煤油 (上限%)', 'oilKerosene', 'hybrid'));
        contentContainer.appendChild(createControlItem('难得素 -> E合金 (上限%)', 'eludium', 'hybrid'));
        contentContainer.appendChild(createControlItem('钛 -> 合金 (上限%)', 'titaniumAlloy', 'hybrid')); 
        contentContainer.appendChild(createControlItem('铀 -> 钍 (上限%)', 'uraniumThorium', 'hybrid')); 
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
        contentContainer.appendChild(createControlItem('定时交易 (Timer)', 'autoTrade', 'interval'));
        contentContainer.appendChild(createControlItem('定时云存储', 'cloudSave', 'interval'));

        // ===============================================
        // 智能级联交易
        // ===============================================
        const hr = document.createElement('hr'); hr.style.borderColor = '#666'; hr.style.marginTop = '10px';
        contentContainer.appendChild(hr);

        const tradeHeader = document.createElement('div');
        tradeHeader.innerHTML = '<strong>智能级联交易 (Smart Cascade)</strong>';
        tradeHeader.style.marginBottom = '5px'; tradeHeader.style.color = '#ffdb4d';
        contentContainer.appendChild(tradeHeader);

        const stRow = document.createElement('div');
        stRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;';
        const stLabel = document.createElement('label'); stLabel.style.cursor = 'pointer';
        const stCb = document.createElement('input'); stCb.type = 'checkbox'; stCb.checked = config.smartTrade.enabled; stCb.style.marginRight = '8px';
        stCb.addEventListener('change', (e) => { config.smartTrade.enabled = e.target.checked; saveConfig(); });
        stLabel.appendChild(stCb); stLabel.appendChild(document.createTextNode('启用级联逻辑'));
        stRow.appendChild(stLabel); contentContainer.appendChild(stRow);

        function createPriorityRow(label, pKey, isFinal = false) {
            const container = document.createElement('div');
            container.style.cssText = 'margin-bottom: 6px; padding-left: 10px; border-left: 2px solid #555;';
            
            const topRow = document.createElement('div');
            topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;';
            const lbl = document.createElement('span'); lbl.innerHTML = label; lbl.style.fontSize='11px';
            
            const raceSelect = document.createElement('select');
            raceSelect.style.cssText = 'width: 100px; background: #333; color: #eee; border: 1px solid #444; font-size: 11px;';
            if (gamePage.diplomacy && gamePage.diplomacy.races) {
                gamePage.diplomacy.races.forEach(race => { 
                    if (race.unlocked) { 
                        const opt = document.createElement('option'); 
                        opt.value = race.name; opt.text = race.title || race.name; 
                        raceSelect.appendChild(opt); 
                    }
                });
            }
            raceSelect.value = config.smartTrade[pKey].race;
            
            topRow.appendChild(lbl); topRow.appendChild(raceSelect); container.appendChild(topRow);

            if (!isFinal) {
                const btmRow = document.createElement('div');
                btmRow.style.cssText = 'display:flex; align-items:center;';
                const range = document.createElement('input');
                range.type = 'range'; range.min = '1'; range.max = '100';
                range.value = config.smartTrade[pKey].percent;
                range.style.cssText = 'flex-grow:1; height:5px; background:#555; cursor:pointer; margin-right:5px;';
                
                const valDisplay = document.createElement('span');
                valDisplay.style.cssText = 'font-size:10px; color:#aaa; width: 140px; text-align:right; white-space:nowrap;';

                const updateDisplay = () => {
                    const race = raceSelect.value;
                    const pct = parseInt(range.value);
                    config.smartTrade[pKey].race = race;
                    config.smartTrade[pKey].percent = pct;
                    const resName = RACE_RES_MAP[race] || 'unknown';
                    let actual = 'N/A';
                    if (resName !== 'unknown') {
                        try {
                            const res = gamePage.resPool.get(resName);
                            if (res && res.maxValue > 0) {
                                actual = Math.floor(res.maxValue * (pct / 100));
                                if (actual > 1000000) actual = (actual/1000000).toFixed(2) + 'M';
                                else if (actual > 1000) actual = (actual/1000).toFixed(1) + 'K';
                            } else { actual = "无上限"; }
                        } catch(e){}
                    }
                    let resLabel = resName === 'unknown' ? '' : ` (${resName})`;
                    valDisplay.innerText = `${pct}% ${resLabel} ≈ ${actual}`;
                };

                raceSelect.addEventListener('change', () => { updateDisplay(); saveConfig(); });
                range.addEventListener('input', () => { updateDisplay(); saveConfig(); });
                updateDisplay();
                btmRow.appendChild(range); btmRow.appendChild(valDisplay);
                container.appendChild(btmRow);
            } else {
                raceSelect.addEventListener('change', () => { config.smartTrade[pKey].race = raceSelect.value; saveConfig(); });
            }
            return container;
        }

        contentContainer.appendChild(createPriorityRow("优先级 1 (P1):", 'p1'));
        contentContainer.appendChild(createPriorityRow("优先级 2 (P2):", 'p2'));
        contentContainer.appendChild(createPriorityRow("优先级 3 (兜底):", 'p3', true)); 
        
        const stTip = document.createElement('div');
        stTip.innerText = "* 逻辑: P1满 -> P2, P2满 -> P3\n* P3 无需设置阈值";
        stTip.style.fontSize = '10px'; stTip.style.color = '#888'; stTip.style.paddingLeft = '10px';
        contentContainer.appendChild(stTip);

        // --- 档案管理 ---
        const hrProfile = document.createElement('hr'); 
        hrProfile.style.borderColor = '#666'; hrProfile.style.marginTop = '15px';
        contentContainer.appendChild(hrProfile);

        const profileHeader = document.createElement('div');
        profileHeader.innerHTML = '<strong>📂 配置档案管理 (Profiles)</strong>';
        profileHeader.style.marginBottom = '8px'; profileHeader.style.color = '#88ccff';
        contentContainer.appendChild(profileHeader);

        const saveRow = document.createElement('div');
        saveRow.style.cssText = 'display:flex; justify-content:space-between; margin-bottom:8px;';
        const nameInput = document.createElement('input');
        nameInput.placeholder = '输入配置名称'; nameInput.style.cssText = 'flex-grow:1; background:#333; color:#eee; border:1px solid #444; margin-right:5px; padding:3px; font-size:11px;';
        const saveBtn = document.createElement('button');
        saveBtn.innerText = '保存'; saveBtn.style.cssText = 'background:#447744; border:none; color:white; font-size:11px; cursor:pointer; padding:3px 8px; border-radius:3px;';
        saveBtn.addEventListener('click', () => { if (saveProfile(nameInput.value)) { alert(`✅ [${nameInput.value}] 保存成功`); createUI(); } });
        saveRow.appendChild(nameInput); saveRow.appendChild(saveBtn);
        contentContainer.appendChild(saveRow);

        const loadRow = document.createElement('div');
        loadRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
        const profileSelect = document.createElement('select');
        profileSelect.style.cssText = 'flex-grow:1; background:#333; color:#eee; border:1px solid #444; margin-right:5px; padding:3px; font-size:11px;';
        Object.keys(getProfiles()).forEach(pName => { const opt = document.createElement('option'); opt.value = pName; opt.text = pName; profileSelect.appendChild(opt); });
        
        const loadBtn = document.createElement('button');
        loadBtn.innerText = '读取'; loadBtn.style.cssText = 'background:#444477; border:none; color:white; font-size:11px; cursor:pointer; padding:3px 8px; border-radius:3px; margin-right:5px;';
        loadBtn.addEventListener('click', () => { if (profileSelect.value && confirm(`读取 [${profileSelect.value}]?`)) loadProfile(profileSelect.value); });
        
        const delBtn = document.createElement('button');
        delBtn.innerText = '删除'; delBtn.style.cssText = 'background:#774444; border:none; color:white; font-size:11px; cursor:pointer; padding:3px 8px; border-radius:3px;';
        delBtn.addEventListener('click', () => { if (profileSelect.value && confirm(`删除 [${profileSelect.value}]?`)) { deleteProfile(profileSelect.value); createUI(); } });
        
        loadRow.appendChild(profileSelect); loadRow.appendChild(loadBtn); loadRow.appendChild(delBtn);
        contentContainer.appendChild(loadRow);

        panel.appendChild(contentContainer);
        document.body.appendChild(panel);

        // UI Dragging
        let isDragging = false; let offsetX, offsetY;
        header.addEventListener('mousedown', (e) => { isDragging = true; offsetX = e.clientX - panel.offsetLeft; offsetY = e.clientY - panel.offsetTop; header.style.cursor = 'grabbing'; });
        document.addEventListener('mousemove', (e) => { if (isDragging) { panel.style.left = (e.clientX - offsetX) + 'px'; panel.style.top = (e.clientY - offsetY) + 'px'; } });
        document.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; header.style.cursor = 'move'; config.ui.posX = panel.style.left; config.ui.posY = panel.style.top; saveConfig(); } });
    }

    // ==========================================
    // 3. 自动化逻辑核心
    // ==========================================

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

    // --- 核心：智能级联逻辑 (优化版) ---
    function runSmartTradeCascade() {
        if (!config.smartTrade.enabled) return;
        
        const cfg = config.smartTrade;
        let targetRace = cfg.p1.race; // 默认尝试 P1

        // 检查 P1 是否已满
        if (isRaceResourceFull(cfg.p1.race, cfg.p1.percent)) {
            // P1 满了，尝试 P2
            targetRace = cfg.p2.race;
            
            // 检查 P2 是否已满
            if (isRaceResourceFull(cfg.p2.race, cfg.p2.percent)) {
                // P2 也满了，直接去 P3
                targetRace = cfg.p3.race;
            }
        }

        // 应用目标
        if (targetRace && config.autoTrade.targetRace !== targetRace) {
            const race = gamePage.diplomacy.get(targetRace);
            if (race && race.unlocked) {
                console.log(`【级联交易】切换目标: [${config.autoTrade.targetRace}] -> [${targetRace}]`);
                config.autoTrade.targetRace = targetRace;
                saveConfig();
                const sel = document.getElementById('kg-assist-select-autoTrade-race');
                if (sel) sel.value = targetRace;
            }
        }
    }

    // 辅助：判断某资源是否“满”了
    function isRaceResourceFull(raceName, thresholdPercent) {
        const resName = RACE_RES_MAP[raceName];
        if (!resName) return false;
        try {
            const res = gamePage.resPool.get(resName);
            if (!res) return false;
            if (res.maxValue <= 0) return false;

            const ratio = res.value / res.maxValue;
            const threshold = thresholdPercent / 100;
            return ratio >= threshold;
        } catch(e) { return false; }
    }

    function mainLoopTask() {
        if (config.starchart.enabled) { try { const btn = document.getElementById('observeBtn'); if (btn && btn.style.display !== 'none') btn.click(); } catch (e) {} }

        // [新增逻辑] 自动升级独角兽牧场
        if (config.unicornPasture.enabled) {
            try {
                var bld = gamePage.bld.get('unicornPasture');
                if (bld.unlocked) {
                    var prices = gamePage.bld.getPrices('unicornPasture');
                    var canAfford = true;
                    for (var i = 0; i < prices.length; i++) {
                        if (gamePage.resPool.get(prices[i].name).value < prices[i].val) {
                            canAfford = false;
                            break;
                        }
                    }
                    if (canAfford) {
                        gamePage.bld.build('unicornPasture');
                        console.log('【自动化】🦄 自动升级独角兽牧场');
                    }
                }
            } catch (e) {}
        }

        if (gamePage && gamePage.resPool) {
            checkAndCraftThreshold('wood', 'beam', 'wood');
            checkAndCraftThreshold('minerals', 'slab', 'minerals');
            checkAndCraftThreshold('coal', 'steel', 'coal');
            checkAndCraftThreshold('iron', 'plate', 'iron');
            checkAndCraftThreshold('beam', 'scaffold', 'scaffold');
            checkAndCraftThreshold('furs', 'parchment', 'parchment');
            checkAndCraftThreshold('oil', 'kerosene', 'oilKerosene');
            checkAndCraftThreshold('unobtainium', 'eludium', 'eludium'); // E合金
            checkAndCraftThreshold('titanium', 'alloy', 'titaniumAlloy'); // 钛->合金
            checkAndCraftThreshold('uranium', 'thorium', 'uraniumThorium'); // 铀->钍

            runSmartTradeCascade();

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
                        const race = gamePage.diplomacy.races.find(r => r.name === 'sharks');
                        if (race && race.unlocked) {
                            gamePage.diplomacy.trade(race, 1);
                        }
                    }
                } catch (e) {}
            }

            // 【智能猎人逻辑】
            if (config.smartHunterGold.enabled) {
                try {
                    const gold = gamePage.resPool.get('gold');
                    const furs = gamePage.resPool.get('furs');
                    const ivory = gamePage.resPool.get('ivory');
                    
                    if (gold && gold.maxValue > 0) {
                        const isGoldFull = gold.value >= gold.maxValue;
                        const isGoldLow = gold.value < 10000;
                        // 保底逻辑
                        const isResLow = (furs && furs.value < 1000) || (ivory && ivory.value < 1000);
                        
                        if (isResLow && !config.hunters.enabled) {
                            config.hunters.enabled = true;
                            updateSpecificTimer('hunters'); saveConfig();
                            if(document.getElementById('kg-assist-cb-hunters')) document.getElementById('kg-assist-cb-hunters').checked = true;
                            console.log('【智能猎人】🔴 稀有资源(毛皮/象牙) < 1000，强制开启猎人。');
                        }
                        else if (isGoldLow && !config.hunters.enabled) {
                             config.hunters.enabled = true;
                             updateSpecificTimer('hunters'); saveConfig();
                             if(document.getElementById('kg-assist-cb-hunters')) document.getElementById('kg-assist-cb-hunters').checked = true;
                             console.log('【智能猎人】💰 黄金不足，恢复自动派猎人。');
                        }
                        else if (isGoldFull && !isResLow && config.hunters.enabled) {
                             config.hunters.enabled = false;
                             updateSpecificTimer('hunters'); saveConfig();
                             if(document.getElementById('kg-assist-cb-hunters')) document.getElementById('kg-assist-cb-hunters').checked = false;
                             console.log('【智能猎人】💰 黄金已满且资源充足，暂停自动派猎人。');
                        }
                    }
                } catch (e) {}
            }
        }
    }

    const tasks = {
        hunters: () => { try { if (gamePage.village.huntAll) { gamePage.village.huntAll(); console.log(`【自动化】✅ 派出猎人`); } } catch (e) {} },
        praise: () => { try { if (gamePage.resPool.get('faith').value > 0) { gamePage.religion.praise(); console.log(`【自动化】☀️ 赞美太阳`); } } catch (e) {} },
        manuscript: () => { try { gamePage.craftAll('manuscript'); console.log(`【自动化】📜 合成手稿`); } catch (e) {} },
        compendium: () => { try { gamePage.craftAll('compedium'); console.log(`【自动化】📚 合成概要`); } catch (e) {} },
        blueprint: () => { try { gamePage.craftAll('blueprint'); console.log(`【自动化】📘 合成蓝图`); } catch (e) {} },
        autoTrade: () => {
            const targetId = config.autoTrade.targetRace;
            if (!targetId || !gamePage.diplomacy) return;
            try {
                const race = gamePage.diplomacy.races.find(r => r.name === targetId);
                if (race && race.unlocked) {
                    gamePage.diplomacy.tradeAll(race);
                    console.log(`【自动化】🤝 定时交易: [${race.title}]`);
                }
            } catch (e) { console.error(`交易出错:`, e); }
        },
        cloudSave: () => {
             if (!config.cloudSave.enabled) return;
             const cloudBtn = document.getElementById('cloudSaveBtn');
             if (cloudBtn && cloudBtn.offsetParent !== null) {
                 if (gamePage.save) gamePage.save(); cloudBtn.click(); console.log(`【自动化】☁️ 云存储`);
             } else if (gamePage.server && gamePage.server.toggle) { gamePage.server.toggle(); }
        }
    };

    function updateSpecificTimer(key) {
        if (timers[key]) clearInterval(timers[key]);
        if (config[key].enabled) {
            const intervalMs = Math.max((config[key].intervalMinutes || 60) * 60 * 1000, 60000);
            timers[key] = setInterval(tasks[key], intervalMs);
            console.log(`[设置] ${key} 定时器已更新，间隔: ${config[key].intervalMinutes} 分钟。`);
        }
    }

    function init() {
        var checkReady = setInterval(function() {
            if (typeof gamePage !== 'undefined' && gamePage.ui && gamePage.resPool) {
                clearInterval(checkReady);
                if (window.kgAutoGlobalTimer) clearInterval(window.kgAutoGlobalTimer);
                Object.values(timers).forEach(clearInterval);
                createUI();
                window.kgAutoGlobalTimer = setInterval(mainLoopTask, 2000);
                Object.keys(tasks).forEach(key => updateSpecificTimer(key));
                console.log('>>> 🐱 全能小助手 v7.8.7 (独角兽牧场版) 启动成功！ <<<');
            }
        }, 1000);
    }

    window.stopKgAutoAssist = function() {
        if (window.kgAutoGlobalTimer) clearInterval(window.kgAutoGlobalTimer);
        Object.values(timers).forEach(clearInterval);
        const panel = document.getElementById('kg-auto-assist-panel');
        if (panel) panel.remove();
        const fab = document.getElementById('kg-auto-assist-fab');
        if (fab) fab.remove();
    };

    init();
})();
