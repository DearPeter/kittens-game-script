// ==UserScript==
// @name         猫国建设者全能小助手 (GUI版 v7.8.15 - Google Material UI版)
// @namespace    http://tampermonkey.net/
// @version      7.8.15
// @description  基于v7.8.14改进。仅调整UI配色为Google Material风格（明亮、圆角、年轻化），保留独角兽模拟点击等所有核心功能。
// @author       AI Assistant
// @match        *://kittensgame.com/web/*
// @updateURL    https://raw.githubusercontent.com/DearPeter/kittens-game-script/main/auto.js
// @downloadURL  https://raw.githubusercontent.com/DearPeter/kittens-game-script/main/auto.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log('>>> 猫国建设者全能小助手 GUI版 v7.8.15 (Material UI版) 正在加载... <<<');

    // ==========================================
    // 1. 配置中心与存储 (Configuration & Storage)
    // ==========================================

    const STORAGE_KEY = 'KG_AutoAssist_Config_v7_8'; 
    const PROFILES_KEY = 'KG_AutoAssist_Profiles_v1';
    const UI_STATE_KEY = 'KG_AutoAssist_UIState';

    const defaultConfig = {
        starchart: { enabled: true },
        unicornPasture: { enabled: false }, 
        wood: { enabled: true, type: 'percent', thresholdPercent: 90 },
        minerals: { enabled: true, type: 'percent', thresholdPercent: 90 },
        coal: { enabled: true, type: 'percent', thresholdPercent: 90 },
        iron: { enabled: true, type: 'percent', thresholdPercent: 90 },
        catnipWood: { enabled: false, type: 'percent', thresholdPercent: 90 },
        oilKerosene: { enabled: false, type: 'percent', thresholdPercent: 90 },
        eludium: { enabled: false, type: 'percent', thresholdPercent: 90 },
        titaniumAlloy: { enabled: false, type: 'percent', thresholdPercent: 90 },
        uraniumThorium: { enabled: false, type: 'percent', thresholdPercent: 90 },
        smartHunterGold: { enabled: false }, 
        smartTrade: { 
            enabled: false,
            p1: { race: 'dragons', percent: 95 },
            p2: { race: 'zebras', percent: 90 },
            p3: { race: 'sharks', percent: 0 } 
        },
        emergencyTradeCatnip: { enabled: false, type: 'percent', thresholdPercent: 60 },
        parchment: { enabled: true, type: 'fixed', thresholdFixed: 15000 },
        scaffold: { enabled: false, type: 'fixed', thresholdFixed: 10000 },
        hunters: { enabled: true, intervalMinutes: 5 },
        praise: { enabled: true, intervalMinutes: 60 },
        manuscript: { enabled: true, intervalMinutes: 3 },
        compendium: { enabled: true, intervalMinutes: 60 },
        blueprint: { enabled: false, intervalMinutes: 60 },
        autoTrade: { enabled: false, intervalMinutes: 20, targetRace: 'zebras' }, 
        cloudSave: { enabled: true, intervalMinutes: 10 },
        ui: { fabHidden: false, posX: 'auto', posY: '20px' }
    };

    let config = loadConfig();

    function loadConfig() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (!parsed.unicornPasture) parsed.unicornPasture = defaultConfig.unicornPasture;
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

    const RACE_RES_MAP = {
        "lizards": "wood", "sharks": "catnip", "griffins": "wood", "nagas": "minerals",
        "zebras": "titanium", "spiders": "coal", "dragons": "uranium", "leviathans": "timeCrystal"
    };
    
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
    // 2. 界面构建器 (UI Builder) - Material Style
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
        // Material Style FAB: Blue background, White icon, Shadow
        fab.style.cssText = `
            position: fixed; bottom: 30px; right: 30px; 
            width: 50px; height: 50px; 
            background-color: #1a73e8; color: #fff; 
            border-radius: 50%; 
            text-align: center; line-height: 50px; font-size: 24px; 
            cursor: pointer; z-index: 2147483647; user-select: none; 
            box-shadow: 0 4px 12px rgba(26,115,232,0.4); 
            transition: all 0.3s ease; border: none;
        `;
        fab.innerHTML = '🐱';
        fab.title = '点击打开全能小助手';
        // Hover effect
        fab.addEventListener('mouseover', () => { fab.style.transform = 'scale(1.1)'; fab.style.boxShadow = '0 6px 16px rgba(26,115,232,0.5)'; });
        fab.addEventListener('mouseout', () => { fab.style.transform = 'scale(1)'; fab.style.boxShadow = '0 4px 12px rgba(26,115,232,0.4)'; });
        
        fab.addEventListener('click', () => { config.ui.fabHidden = true; saveConfig(); createUI(); });
        document.body.appendChild(fab);
    }

    function injectStyles() {
        const styleId = 'kg-assist-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        // Material Google-ish Styles
        style.innerHTML = `
            .kg-tab-nav { display: flex; border-bottom: 1px solid #e0e0e0; background: transparent; padding: 0 8px; }
            .kg-tab-btn { 
                flex: 1; background: transparent; border: none; color: #5f6368; 
                padding: 12px 0; cursor: pointer; border-bottom: 3px solid transparent; 
                font-size: 13px; font-weight: 500; font-family: 'Roboto', 'Segoe UI', sans-serif;
                transition: all 0.2s; outline: none; border-radius: 4px 4px 0 0;
            }
            .kg-tab-btn:hover { background: #f1f3f4; color: #202124; }
            .kg-tab-btn.active { color: #1a73e8; border-bottom: 3px solid #1a73e8; background: #e8f0fe; }
            .kg-tab-content { display: none; padding: 16px 8px; animation: kg-fade 0.2s ease-in-out; }
            .kg-tab-content.active { display: block; }
            @keyframes kg-fade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            
            /* Custom Scrollbar for panel content if needed */
            #kg-auto-assist-panel ::-webkit-scrollbar { width: 6px; }
            #kg-auto-assist-panel ::-webkit-scrollbar-thumb { background: #dadce0; border-radius: 3px; }
            #kg-auto-assist-panel ::-webkit-scrollbar-thumb:hover { background: #bdc1c6; }
        `;
        document.head.appendChild(style);
    }

    function createMainPanel() {
        injectStyles();
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
        
        // Material Card Style: White bg, soft shadow, rounded corners
        panel.style.cssText = `
            position: fixed; top: ${topPos}; left: ${leftPos}; right: ${rightPos}; 
            width: 460px; 
            background-color: #ffffff; 
            color: #3c4043; 
            border: none; 
            border-radius: 16px; 
            z-index: 9999; 
            font-family: 'Roboto', 'Segoe UI', Arial, sans-serif; 
            font-size: 13px; 
            box-shadow: 0 8px 24px rgba(0,0,0,0.15); 
            overflow: hidden;
            transition: box-shadow 0.3s;
        `;

        // --- Header ---
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex; justify-content: space-between; align-items: center; 
            padding: 12px 16px; cursor: move; 
            background: #ffffff; 
            border-bottom: 1px solid #f1f3f4;
        `;
        header.innerHTML = '<strong style="font-size:16px; color:#202124;">🐱 小助手 v7.8.15</strong>';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✖';
        closeBtn.style.cssText = 'background:none; border:none; color:#5f6368; cursor:pointer; font-size: 16px; padding: 4px; border-radius:50%; transition: background 0.2s;';
        closeBtn.addEventListener('mouseover', () => { closeBtn.style.background = '#f1f3f4'; });
        closeBtn.addEventListener('mouseout', () => { closeBtn.style.background = 'none'; });
        closeBtn.addEventListener('click', () => { config.ui.fabHidden = false; saveConfig(); createUI(); });
        header.appendChild(closeBtn);
        panel.appendChild(header);

        // --- Tabs ---
        const tabNav = document.createElement('div');
        tabNav.className = 'kg-tab-nav';
        const tabs = [
            { id: 'tab-res', label: '资源转化' },
            { id: 'tab-act', label: '自动活动' },
            { id: 'tab-trade', label: '贸易外交' },
            { id: 'tab-profile', label: '档案管理' }
        ];
        
        const contentContainer = document.createElement('div');
        contentContainer.style.padding = '0 8px 8px 8px';
        contentContainer.style.background = '#ffffff'; // Ensure content bg is white
        
        let activeTabIndex = parseInt(localStorage.getItem(UI_STATE_KEY) || '0');
        if(activeTabIndex >= tabs.length) activeTabIndex = 0;

        const tabContents = [];

        tabs.forEach((tab, index) => {
            const btn = document.createElement('button');
            btn.className = `kg-tab-btn ${index === activeTabIndex ? 'active' : ''}`;
            btn.innerText = tab.label;
            btn.onclick = () => {
                document.querySelectorAll('.kg-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.kg-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                tabContents[index].classList.add('active');
                localStorage.setItem(UI_STATE_KEY, index);
            };
            tabNav.appendChild(btn);

            const contentDiv = document.createElement('div');
            contentDiv.className = `kg-tab-content ${index === activeTabIndex ? 'active' : ''}`;
            contentDiv.id = tab.id;
            tabContents.push(contentDiv);
            contentContainer.appendChild(contentDiv);
        });

        panel.appendChild(tabNav);
        panel.appendChild(contentContainer);

        function createControlItem(label, configKey, uiType = 'none') {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; padding: 2px 4px;';
            const isInterval = uiType === 'interval';
            const isHybridThreshold = uiType === 'hybrid';
            const isAutoTrade = configKey === 'autoTrade';

            const leftSide = document.createElement('label');
            leftSide.style.cssText = 'display: flex; align-items: center; cursor: pointer; flex-grow: 1; color: #3c4043; font-weight: 400;';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = config[configKey].enabled;
            checkbox.style.marginRight = '10px';
            checkbox.style.accentColor = '#1a73e8'; // Google Blue Checkbox
            checkbox.id = 'kg-assist-cb-' + configKey;
            checkbox.addEventListener('change', (e) => { config[configKey].enabled = e.target.checked; saveConfig(); if (isInterval) updateSpecificTimer(configKey); });
            leftSide.appendChild(checkbox);
            leftSide.appendChild(document.createTextNode(label));
            row.appendChild(leftSide);

            const rightSide = document.createElement('div');
            rightSide.style.cssText = 'display: flex; align-items: center; justify-content: flex-end;';

            // Common Input Style
            const inputStyle = 'background: #f1f3f4; color: #202124; border: 1px solid transparent; border-radius: 6px; padding: 4px 6px; font-family: inherit; font-size: 12px; transition: 0.2s; outline: none;';
            const inputFocus = (el) => {
                el.addEventListener('focus', () => { el.style.background = '#ffffff'; el.style.border = '1px solid #1a73e8'; el.style.boxShadow = '0 0 0 2px rgba(26,115,232,0.2)'; });
                el.addEventListener('blur', () => { el.style.background = '#f1f3f4'; el.style.border = '1px solid transparent'; el.style.boxShadow = 'none'; });
            };

            if (isHybridThreshold) {
                const itemType = config[configKey].type;
                if (itemType === 'percent') {
                    const sliderContainer = document.createElement('div');
                    sliderContainer.style.cssText = 'display:flex; align-items:center; width: 240px;';
                    const rangeInput = document.createElement('input');
                    rangeInput.type = 'range'; rangeInput.min = '1'; rangeInput.max = '100';
                    rangeInput.value = config[configKey].thresholdPercent;
                    rangeInput.style.cssText = 'flex-grow:1; cursor: pointer; height: 4px; background: #dadce0; outline: none; border-radius: 2px; accent-color: #1a73e8;';
                    
                    const percentText = document.createElement('span');
                    percentText.style.cssText = 'font-size: 12px; width: 140px; text-align: left; color: #5f6368; margin-left: 10px; font-variant-numeric: tabular-nums;';
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
                    input.style.cssText = 'width: 70px; text-align: right; ' + inputStyle;
                    inputFocus(input);
                    input.addEventListener('change', (e) => { config[configKey].thresholdFixed = parseInt(e.target.value) || 0; saveConfig(); });
                    rightSide.appendChild(input);
                }
            } else if (isAutoTrade) {
                const raceSelect = document.createElement('select');
                raceSelect.id = 'kg-assist-select-autoTrade-race';
                raceSelect.style.cssText = 'width: 90px; margin-right: 5px; cursor:pointer; ' + inputStyle;
                inputFocus(raceSelect);
                if (gamePage.diplomacy && gamePage.diplomacy.races) {
                    gamePage.diplomacy.races.forEach(race => { if (race.unlocked) { const option = document.createElement('option'); option.value = race.name; option.text = race.title || race.name; raceSelect.appendChild(option); }});
                    raceSelect.value = config[configKey].targetRace;
                }
                raceSelect.addEventListener('change', (e) => { config.autoTrade.targetRace = e.target.value; saveConfig(); });
                rightSide.appendChild(raceSelect);
            }
            if (isInterval) {
                const input = document.createElement('input'); input.type = 'number'; input.value = config[configKey].intervalMinutes; input.min = 1;
                input.style.cssText = 'width: 50px; text-align: right; ' + inputStyle;
                inputFocus(input);
                input.addEventListener('change', (e) => { config[configKey].intervalMinutes = Math.max(1, parseInt(e.target.value) || 1); saveConfig(); updateSpecificTimer(configKey); });
                rightSide.appendChild(input); 
                const minLabel = document.createElement('span');
                minLabel.innerText = '分';
                minLabel.style.cssText = 'color: #5f6368; margin-left: 4px; font-size: 12px;';
                rightSide.appendChild(minLabel);
            }
            row.appendChild(rightSide);
            return row;
        }

        const t1 = tabContents[0];
        t1.appendChild(createControlItem('木材 -> 木梁 (上限%)', 'wood', 'hybrid'));
        t1.appendChild(createControlItem('矿物 -> 石板 (上限%)', 'minerals', 'hybrid'));
        t1.appendChild(createControlItem('煤炭 -> 钢铁 (上限%)', 'coal', 'hybrid'));
        t1.appendChild(createControlItem('铁 -> 金属板 (上限%)', 'iron', 'hybrid'));
        t1.appendChild(createControlItem('猫薄荷 -> 木头 (上限%)', 'catnipWood', 'hybrid'));
        t1.appendChild(createControlItem('石油 -> 煤油 (上限%)', 'oilKerosene', 'hybrid'));
        t1.appendChild(document.createElement('hr')).style.cssText = 'border: 0; border-top: 1px solid #f1f3f4; margin: 8px 0;';
        t1.appendChild(createControlItem('难得素 -> E合金 (上限%)', 'eludium', 'hybrid'));
        t1.appendChild(createControlItem('钛 -> 合金 (上限%)', 'titaniumAlloy', 'hybrid')); 
        t1.appendChild(createControlItem('铀 -> 钍 (上限%)', 'uraniumThorium', 'hybrid')); 
        t1.appendChild(document.createElement('hr')).style.cssText = 'border: 0; border-top: 1px solid #f1f3f4; margin: 8px 0;';
        t1.appendChild(createControlItem('木梁 -> 脚手架 (固定值)', 'scaffold', 'hybrid'));
        t1.appendChild(createControlItem('毛皮 ->羊皮纸 (固定值)', 'parchment', 'hybrid'));

        const t2 = tabContents[1];
        t2.appendChild(createControlItem('自动点星图', 'starchart'));
        t2.appendChild(createControlItem('自动升级独角兽牧场', 'unicornPasture'));
        t2.appendChild(document.createElement('hr')).style.cssText = 'border: 0; border-top: 1px solid #f1f3f4; margin: 8px 0;';
        t2.appendChild(createControlItem('自动派猎人 (Timer)', 'hunters', 'interval'));
        t2.appendChild(createControlItem('智能猎人 (金满停/低开)', 'smartHunterGold'));
        t2.appendChild(document.createElement('hr')).style.cssText = 'border: 0; border-top: 1px solid #f1f3f4; margin: 8px 0;';
        t2.appendChild(createControlItem('自动赞美太阳 (Timer)', 'praise', 'interval'));
        t2.appendChild(createControlItem('定时合手稿', 'manuscript', 'interval'));
        t2.appendChild(createControlItem('定时合概要', 'compendium', 'interval'));
        t2.appendChild(createControlItem('定时合蓝图', 'blueprint', 'interval'));
        t2.appendChild(document.createElement('hr')).style.cssText = 'border: 0; border-top: 1px solid #f1f3f4; margin: 8px 0;';
        t2.appendChild(createControlItem('定时云存储', 'cloudSave', 'interval'));

        const t3 = tabContents[2];
        t3.appendChild(createControlItem('猫薄荷 < 阈值 -> 交易鲨鱼(1次)', 'emergencyTradeCatnip', 'hybrid'));
        t3.appendChild(createControlItem('定时交易 (Timer)', 'autoTrade', 'interval'));
        
        const hr = document.createElement('hr'); 
        hr.style.cssText = 'border: 0; border-top: 1px solid #e0e0e0; margin: 16px 0;';
        t3.appendChild(hr);

        const tradeHeader = document.createElement('div');
        tradeHeader.innerHTML = '<strong>智能级联交易 (Smart Cascade)</strong>';
        tradeHeader.style.marginBottom = '8px'; tradeHeader.style.color = '#1a73e8'; // Google Blue
        t3.appendChild(tradeHeader);

        const stRow = document.createElement('div');
        stRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
        const stLabel = document.createElement('label'); stLabel.style.cursor = 'pointer'; stLabel.style.color = '#3c4043';
        const stCb = document.createElement('input'); stCb.type = 'checkbox'; stCb.checked = config.smartTrade.enabled; stCb.style.marginRight = '8px'; stCb.style.accentColor = '#1a73e8';
        stCb.addEventListener('change', (e) => { config.smartTrade.enabled = e.target.checked; saveConfig(); });
        stLabel.appendChild(stCb); stLabel.appendChild(document.createTextNode('启用级联逻辑'));
        stRow.appendChild(stLabel); t3.appendChild(stRow);

        function createPriorityRow(label, pKey, isFinal = false) {
            const container = document.createElement('div');
            container.style.cssText = 'margin-bottom: 8px; padding-left: 12px; border-left: 2px solid #dadce0;';
            const topRow = document.createElement('div');
            topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;';
            const lbl = document.createElement('span'); lbl.innerHTML = label; lbl.style.fontSize='12px'; lbl.style.color = '#5f6368';
            
            const raceSelect = document.createElement('select');
            raceSelect.style.cssText = 'width: 110px; background: #f1f3f4; color: #202124; border: 1px solid transparent; border-radius: 6px; padding: 2px 4px; outline:none; font-size: 11px;';
            raceSelect.addEventListener('focus', () => { raceSelect.style.background='#fff'; raceSelect.style.border='1px solid #1a73e8'; });
            raceSelect.addEventListener('blur', () => { raceSelect.style.background='#f1f3f4'; raceSelect.style.border='1px solid transparent'; });

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
                range.style.cssText = 'flex-grow:1; height:4px; background:#dadce0; cursor:pointer; margin-right:8px; accent-color: #1a73e8;';
                const valDisplay = document.createElement('span');
                valDisplay.style.cssText = 'font-size:11px; color:#5f6368; width: 130px; text-align:right; white-space:nowrap; font-variant-numeric: tabular-nums;';
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

        t3.appendChild(createPriorityRow("优先级 1 (P1):", 'p1'));
        t3.appendChild(createPriorityRow("优先级 2 (P2):", 'p2'));
        t3.appendChild(createPriorityRow("优先级 3 (兜底):", 'p3', true)); 
        const stTip = document.createElement('div');
        stTip.innerText = "* 逻辑: P1满 -> P2, P2满 -> P3\n* P3 无需设置阈值";
        stTip.style.fontSize = '11px'; stTip.style.color = '#70757a'; stTip.style.paddingLeft = '12px';
        t3.appendChild(stTip);

        const t4 = tabContents[3];
        const profileHeader = document.createElement('div');
        profileHeader.innerHTML = '<strong>📂 配置档案管理 (Profiles)</strong>';
        profileHeader.style.marginBottom = '12px'; profileHeader.style.color = '#1a73e8';
        t4.appendChild(profileHeader);

        const btnStyle = 'border:none; color:white; font-size:12px; cursor:pointer; padding:6px 12px; border-radius:4px; transition: opacity 0.2s;';
        const inputStyle = 'flex-grow:1; background:#f1f3f4; color:#202124; border:1px solid transparent; margin-right:8px; padding:6px; font-size:12px; border-radius:4px; outline:none;';

        const saveRow = document.createElement('div');
        saveRow.style.cssText = 'display:flex; justify-content:space-between; margin-bottom:12px;';
        const nameInput = document.createElement('input');
        nameInput.placeholder = '输入配置名称'; nameInput.style.cssText = inputStyle;
        nameInput.addEventListener('focus', () => { nameInput.style.background='#fff'; nameInput.style.border='1px solid #1a73e8'; });
        nameInput.addEventListener('blur', () => { nameInput.style.background='#f1f3f4'; nameInput.style.border='1px solid transparent'; });

        const saveBtn = document.createElement('button');
        saveBtn.innerText = '保存'; saveBtn.style.cssText = 'background:#188038; ' + btnStyle; // Google Green
        saveBtn.addEventListener('click', () => { if (saveProfile(nameInput.value)) { alert(`✅ [${nameInput.value}] 保存成功`); createUI(); } });
        saveRow.appendChild(nameInput); saveRow.appendChild(saveBtn);
        t4.appendChild(saveRow);

        const loadRow = document.createElement('div');
        loadRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
        const profileSelect = document.createElement('select');
        profileSelect.style.cssText = inputStyle;
        profileSelect.addEventListener('focus', () => { profileSelect.style.background='#fff'; profileSelect.style.border='1px solid #1a73e8'; });
        profileSelect.addEventListener('blur', () => { profileSelect.style.background='#f1f3f4'; profileSelect.style.border='1px solid transparent'; });
        
        Object.keys(getProfiles()).forEach(pName => { const opt = document.createElement('option'); opt.value = pName; opt.text = pName; profileSelect.appendChild(opt); });
        
        const loadBtn = document.createElement('button');
        loadBtn.innerText = '读取'; loadBtn.style.cssText = 'background:#1a73e8; margin-right:8px; ' + btnStyle; // Google Blue
        loadBtn.addEventListener('click', () => { if (profileSelect.value && confirm(`读取 [${profileSelect.value}]?`)) loadProfile(profileSelect.value); });
        
        const delBtn = document.createElement('button');
        delBtn.innerText = '删除'; delBtn.style.cssText = 'background:#d93025; ' + btnStyle; // Google Red
        delBtn.addEventListener('click', () => { if (profileSelect.value && confirm(`删除 [${profileSelect.value}]?`)) { deleteProfile(profileSelect.value); createUI(); } });
        
        loadRow.appendChild(profileSelect); loadRow.appendChild(loadBtn); loadRow.appendChild(delBtn);
        t4.appendChild(loadRow);

        document.body.appendChild(panel);

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

    function runSmartTradeCascade() {
        if (!config.smartTrade.enabled) return;
        const cfg = config.smartTrade;
        let targetRace = cfg.p1.race; 
        if (isRaceResourceFull(cfg.p1.race, cfg.p1.percent)) {
            targetRace = cfg.p2.race;
            if (isRaceResourceFull(cfg.p2.race, cfg.p2.percent)) {
                targetRace = cfg.p3.race;
            }
        }
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

    function isRaceResourceFull(raceName, thresholdPercent) {
        const resName = RACE_RES_MAP[raceName];
        if (!resName) return false;
        try {
            const res = gamePage.resPool.get(resName);
            if (!res || res.maxValue <= 0) return false;
            return (res.value / res.maxValue) >= (thresholdPercent / 100);
        } catch(e) { return false; }
    }

    // 辅助：尝试在页面上通过文字找到按钮元素
    function clickButtonByLabel(labelText) {
        const allButtons = document.querySelectorAll('.btnContent');
        for (let i = 0; i < allButtons.length; i++) {
            if (allButtons[i].textContent.includes(labelText)) {
                const container = allButtons[i].closest('.btn');
                if (container && !container.classList.contains('disabled') && !container.classList.contains('grayed')) {
                    allButtons[i].click();
                    return true;
                }
            }
        }
        return false;
    }

    function mainLoopTask() {
        if (config.starchart.enabled) { try { const btn = document.getElementById('observeBtn'); if (btn && btn.style.display !== 'none') btn.click(); } catch (e) {} }

        // --- 主逻辑与安全检查 ---
        if (gamePage && gamePage.resPool && gamePage.bld) {
            
            // [独角兽牧场 - 模拟点击版]
            if (config.unicornPasture.enabled) {
                try {
                    const bldName = 'unicornPasture';
                    // 1. 获取资源判断价格
                    const prices = gamePage.bld.getPrices(bldName);
                    
                    if (prices && prices.length > 0) {
                        let canAfford = true;
                        for (let i = 0; i < prices.length; i++) {
                            const res = gamePage.resPool.get(prices[i].name);
                            if (!res || res.value < prices[i].val) {
                                canAfford = false;
                                break;
                            }
                        }

                        if (canAfford) {
                            // 2. 尝试模拟点击
                            const bldMeta = gamePage.bld.get(bldName);
                            const label = bldMeta ? bldMeta.label : 'Unicorn Pasture';
                            
                            if (clickButtonByLabel(label)) {
                                console.log(`【自动化】🦄 自动点击: [${label}]`);
                            } else {
                                if (label !== 'Unicorn Pasture') clickButtonByLabel('Unicorn Pasture');
                            }
                        }
                    }
                } catch (e) {
                    console.error('【独角兽错误】:', e);
                }
            }

            checkAndCraftThreshold('wood', 'beam', 'wood');
            checkAndCraftThreshold('minerals', 'slab', 'minerals');
            checkAndCraftThreshold('coal', 'steel', 'coal');
            checkAndCraftThreshold('iron', 'plate', 'iron');
            checkAndCraftThreshold('beam', 'scaffold', 'scaffold');
            checkAndCraftThreshold('furs', 'parchment', 'parchment');
            checkAndCraftThreshold('oil', 'kerosene', 'oilKerosene');
            checkAndCraftThreshold('unobtainium', 'eludium', 'eludium'); 
            checkAndCraftThreshold('titanium', 'alloy', 'titaniumAlloy'); 
            checkAndCraftThreshold('uranium', 'thorium', 'uraniumThorium'); 

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

            if (config.smartHunterGold.enabled) {
                try {
                    const gold = gamePage.resPool.get('gold');
                    const furs = gamePage.resPool.get('furs');
                    const ivory = gamePage.resPool.get('ivory');
                    if (gold && gold.maxValue > 0) {
                        const isGoldFull = gold.value >= gold.maxValue;
                        const isGoldLow = gold.value < 10000;
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
                console.log('>>> 🐱 全能小助手 v7.8.15 (Material UI版) 启动成功！ <<<');
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
        const style = document.getElementById('kg-assist-styles');
        if (style) style.remove();
    };

    init();
})();
