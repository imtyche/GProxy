// ==================== i18n Module ====================
const I18N = (function() {
    let lang = 'zh';
    const messages = {};

    // Built-in fallbacks so UI works even if fetch fails
    const FALLBACK = {
        zh: {
            proxy_on: '代理已开启 - 点击关闭',
            proxy_off: '代理已关闭 - 点击开启',
            whitelist_prompt: '是否将当前域名 "{0}" 添加到代理白名单（绕过列表）？\n\n这样此域名的访问将不经过代理服务器。',
            whitelist_added: '已添加到白名单: {0}',
            whitelist_add_error: '添加到白名单失败: {0}',
            whitelist_added_title: '添加到白名单',
            btn_add_to_whitelist: '添加',
            btn_cancel: '取消',
            lang_zh: '中文',
            lang_en: 'English'
        },
        en: {
            proxy_on: 'Proxy Enabled - Click to Disable',
            proxy_off: 'Proxy Disabled - Click to Enable',
            whitelist_prompt: 'Do you want to add the current domain "{0}" to the proxy whitelist (bypass list)?\n\nThis will allow this domain to bypass the proxy server.',
            whitelist_added: 'Successfully added "{0}" to the whitelist.',
            whitelist_add_error: 'Failed to add to whitelist: {0}',
            whitelist_added_title: 'Add to whitelist',
            btn_add_to_whitelist: 'Add',
            btn_cancel: 'Cancel',
            lang_zh: '中文',
            lang_en: 'English'
        }
    };

    async function loadLang(langCode) {
        const code = (langCode === 'en') ? 'en' : 'zh';
        try {
            // Chrome requires _locales/<lang>/messages.json in { key: { message: "..." } } form
            const resp = await fetch(chrome.runtime.getURL('_locales/' + code + '/messages.json'));
            if (resp.ok) {
                const data = await resp.json();
                const flat = {};
                for (const [k, v] of Object.entries(data)) {
                    flat[k] = (v && typeof v === 'object' && 'message' in v) ? v.message : v;
                }
                Object.keys(messages).forEach(k => delete messages[k]);
                Object.assign(messages, FALLBACK[code] || {}, flat);
                lang = code;
                return;
            }
        } catch (e) {
            console.warn('[GProxy] i18n fetch failed, using fallback:', e);
        }
        Object.keys(messages).forEach(k => delete messages[k]);
        Object.assign(messages, FALLBACK[code] || FALLBACK.zh);
        lang = code;
    }

    (async function init() {
        try {
            const savedLang = await new Promise((resolve) => {
                chrome.storage.local.get(['uiLanguage'], (r) => resolve(r.uiLanguage || 'zh'));
            });
            await loadLang(savedLang);
        } catch (e) {
            await loadLang('zh');
        }
    })();

    // Support simple {0} {1} placeholders
    function t(key, ...args) {
        let msg = messages[key] || (FALLBACK[lang] && FALLBACK[lang][key]) || key;
        if (args.length) {
            args.forEach((arg, i) => {
                msg = String(msg).replace(new RegExp('\\{' + i + '\\}', 'g'), String(arg));
            });
        }
        return msg;
    }

    async function setLang(langCode) {
        await loadLang(langCode);
        await new Promise((resolve) => {
            chrome.storage.local.set({ uiLanguage: lang }, resolve);
        });
        document.dispatchEvent(new CustomEvent('i18n:languagechange', { detail: { lang } }));
    }

    return { t, setLang, getLang: () => lang };
})();

// ==================== Scoped Cyberpunk HUD Styles ====================
// Only style our own elements — never touch page body / global selectors
// All critical visibility rules use !important to resist hostile page CSS
const style = document.createElement('style');
style.textContent = `
    /* Hide original checkbox if any */
    #gproxy-toggle-input { display: none !important; }

    .gproxy-cyber-toggle {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        position: fixed !important;
        /* Position fully controlled by JS (left/top) so edge-hide works */
        width: 52px !important;
        height: 52px !important;
        background: #0a1220 !important;
        border: 2px solid #1a3a5a !important;
        border-radius: 50% !important;
        cursor: pointer !important;
        z-index: 2147483646 !important;
        transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s, box-shadow 0.25s, background 0.25s, opacity 0.35s, left 0.35s cubic-bezier(0.4, 0, 0.2, 1), top 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        color: #c8d8f0 !important;
        font-family: 'Cascadia Code', 'Consolas', 'SF Mono', 'Monaco', monospace !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        padding: 0 !important;
        margin: 0 !important;
        outline: none !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        box-shadow:
            0 0 0 1px rgba(0, 240, 255, 0.2),
            0 8px 28px rgba(0, 0, 0, 0.55),
            inset 0 0 0 1px rgba(0, 240, 255, 0.08) !important;
    }

    /* Hidden state: mostly off-screen, still hoverable via a thin edge strip */
    .gproxy-cyber-toggle.gproxy-hidden {
        opacity: 0.15 !important;
        pointer-events: auto !important;
    }

    .gproxy-cyber-toggle:hover {
        transform: scale(1.1) !important;
        border-color: #00f0ff !important;
        box-shadow:
            0 0 0 1px rgba(0, 240, 255, 0.5),
            0 0 22px rgba(0, 240, 255, 0.4),
            0 8px 24px rgba(0, 0, 0, 0.45) !important;
        opacity: 1 !important;
    }

    .gproxy-cyber-toggle:active {
        transform: scale(0.96) !important;
    }

    .gproxy-cyber-toggle.proxy-on {
        background: linear-gradient(145deg, #00c8e0 0%, #0088cc 100%) !important;
        border-color: #00f0ff !important;
        color: #001018 !important;
        box-shadow:
            0 0 0 1px rgba(0, 240, 255, 0.5),
            0 0 24px rgba(0, 240, 255, 0.55),
            0 0 12px rgba(0, 170, 255, 0.4) !important;
    }

    .gproxy-cyber-toggle.proxy-on:hover {
        box-shadow:
            0 0 0 1px rgba(0, 240, 255, 0.7),
            0 0 32px rgba(0, 240, 255, 0.7),
            0 0 16px rgba(0, 170, 255, 0.5) !important;
    }

    .gproxy-cyber-toggle.proxy-on .gproxy-cyber-icon {
        color: #001018 !important;
        text-shadow: 0 0 8px rgba(0, 240, 255, 0.8) !important;
        filter: drop-shadow(0 0 4px rgba(0, 240, 255, 0.6)) !important;
    }

    .gproxy-cyber-toggle.proxy-off {
        background: #0a1220 !important;
        color: #7a90a8 !important;
    }

    .gproxy-cyber-toggle.proxy-off:hover {
        border-color: #3a5a7a !important;
    }

    .gproxy-cyber-toggle.proxy-off .gproxy-cyber-icon {
        color: #6a8098 !important;
    }

    .gproxy-cyber-icon {
        font-size: 22px !important;
        font-weight: 200 !important;
        line-height: 1 !important;
        display: block !important;
        pointer-events: none !important;
        position: relative !important;
        z-index: 2 !important;
        letter-spacing: 0 !important;
        font-family: 'Cascadia Code', 'Consolas', 'SF Mono', 'Arial Black', sans-serif !important;
    }

    .gproxy-cyber-label {
        position: absolute !important;
        bottom: -30px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        letter-spacing: 1.2px !important;
        text-transform: uppercase !important;
        color: #c8d8f0 !important;
        opacity: 0 !important;
        transition: opacity 0.25s !important;
        white-space: nowrap !important;
        pointer-events: none !important;
        background: rgba(5, 10, 20, 0.92) !important;
        border: 1px solid #1a3a5a !important;
        padding: 3px 8px !important;
        z-index: 3 !important;
    }

    .gproxy-cyber-toggle:hover .gproxy-cyber-label {
        opacity: 1 !important;
    }

    /* Hover always restores full visibility */
    .gproxy-cyber-toggle.gproxy-hidden:hover {
        opacity: 1 !important;
        transform: scale(1.1) !important;
    }

    .gproxy-whitelist-prompt {
        position: fixed !important;
        inset: 0 !important;
        background: rgba(0, 5, 15, 0.9) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 2147483647 !important;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s, visibility 0.3s !important;
        font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif !important;
    }

    .gproxy-whitelist-prompt.visible {
        opacity: 1 !important;
        visibility: visible !important;
    }

    .gproxy-whitelist-prompt .gproxy-content {
        background: #0a1220 !important;
        padding: 0 !important;
        border: 1px solid #1a3a5a !important;
        text-align: center !important;
        min-width: 340px !important;
        max-width: 92vw !important;
        box-shadow:
            0 0 0 1px rgba(0, 240, 255, 0.12),
            0 0 48px rgba(0, 240, 255, 0.2),
            inset 0 0 40px rgba(0, 20, 40, 0.35) !important;
        color: #c8d8f0 !important;
        position: relative !important;
        clip-path: polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px)) !important;
        overflow: hidden !important;
    }

    /* HUD corner brackets on the prompt panel */
    .gproxy-whitelist-prompt .gproxy-content::before,
    .gproxy-whitelist-prompt .gproxy-content::after {
        content: '' !important;
        position: absolute !important;
        width: 18px !important;
        height: 18px !important;
        border: 2px solid #00f0ff !important;
        pointer-events: none !important;
        z-index: 2 !important;
        opacity: 0.9 !important;
    }
    .gproxy-whitelist-prompt .gproxy-content::before {
        top: 6px !important;
        left: 6px !important;
        border-right: none !important;
        border-bottom: none !important;
        box-shadow: -1px -1px 6px rgba(0, 240, 255, 0.35) !important;
    }
    .gproxy-whitelist-prompt .gproxy-content::after {
        bottom: 6px !important;
        right: 6px !important;
        border-left: none !important;
        border-top: none !important;
        box-shadow: 1px 1px 6px rgba(0, 240, 255, 0.35) !important;
    }

    /* Header bar inside prompt */
    .gproxy-whitelist-prompt .gproxy-prompt-header {
        background: linear-gradient(90deg, rgba(0, 240, 255, 0.12) 0%, rgba(0, 170, 255, 0.05) 60%, transparent 100%) !important;
        border-bottom: 1px solid #1a3a5a !important;
        padding: 14px 24px !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        position: relative !important;
    }
    .gproxy-whitelist-prompt .gproxy-prompt-header::after {
        content: '' !important;
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 1px !important;
        background: linear-gradient(90deg, #00f0ff, transparent 70%) !important;
        opacity: 0.5 !important;
    }
    .gproxy-whitelist-prompt .gproxy-prompt-header .gproxy-prompt-icon {
        font-size: 18px !important;
        filter: drop-shadow(0 0 6px #00f0ff) !important;
    }
    .gproxy-whitelist-prompt .gproxy-prompt-header h3 {
        color: #00f0ff !important;
        font-size: 14px !important;
        margin: 0 !important;
        font-family: 'Cascadia Code', 'Consolas', 'SF Mono', monospace !important;
        letter-spacing: 1.5px !important;
        text-transform: uppercase !important;
        text-shadow: 0 0 10px rgba(0, 240, 255, 0.45) !important;
        flex: 1 !important;
        text-align: left !important;
    }

    .gproxy-whitelist-prompt .gproxy-prompt-body {
        padding: 22px 28px 26px !important;
    }

    .gproxy-whitelist-prompt .gproxy-prompt-body p {
        color: #a8c0d8 !important;
        font-size: 13.5px !important;
        margin: 0 0 22px 0 !important;
        line-height: 1.6 !important;
        white-space: pre-wrap !important;
        text-align: left !important;
        font-family: 'Segoe UI', 'PingFang SC', system-ui, sans-serif !important;
    }

    .gproxy-whitelist-prompt .gproxy-prompt-body .gproxy-domain {
        display: inline-block !important;
        background: rgba(0, 240, 255, 0.08) !important;
        border: 1px solid rgba(0, 240, 255, 0.25) !important;
        color: #00f0ff !important;
        font-family: 'Cascadia Code', 'Consolas', monospace !important;
        font-size: 13px !important;
        padding: 2px 10px !important;
        margin: 4px 0 !important;
        letter-spacing: 0.5px !important;
    }

    .gproxy-whitelist-prompt .gproxy-btn-group {
        display: flex !important;
        justify-content: flex-end !important;
        gap: 12px !important;
        flex-wrap: wrap !important;
    }

    .gproxy-whitelist-prompt .gproxy-btn {
        padding: 11px 22px !important;
        border: none !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.22s !important;
        font-family: 'Cascadia Code', 'Consolas', 'SF Mono', monospace !important;
        letter-spacing: 1px !important;
        text-transform: uppercase !important;
        min-width: 100px !important;
    }

    .gproxy-whitelist-prompt .gproxy-btn-yes {
        background: linear-gradient(135deg, rgba(0, 240, 255, 0.28) 0%, rgba(0, 170, 255, 0.18) 100%) !important;
        color: #00f0ff !important;
        border: 1px solid #00f0ff !important;
        clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)) !important;
    }

    .gproxy-whitelist-prompt .gproxy-btn-yes:hover {
        background: linear-gradient(135deg, rgba(0, 240, 255, 0.45) 0%, rgba(0, 170, 255, 0.3) 100%) !important;
        box-shadow: 0 0 20px rgba(0, 240, 255, 0.4) !important;
        color: #fff !important;
        text-shadow: 0 0 8px #00f0ff !important;
    }

    .gproxy-whitelist-prompt .gproxy-btn-no {
        background: #0a1220 !important;
        color: #8aa0b8 !important;
        border: 1px solid #1a3a5a !important;
        clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)) !important;
    }

    .gproxy-whitelist-prompt .gproxy-btn-no:hover {
        background: #122030 !important;
        border-color: #3a5a7a !important;
        color: #c8d8f0 !important;
    }
`;
(document.head || document.documentElement).appendChild(style);

// ==================== Create the Cyber Toggle ====================
function createCyberToggle() {
    if (document.getElementById('gproxy-toggle')) return null;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'gproxy-toggle';
    // Start already "hidden" and off-screen so there is no visible flash
    // before initPosition() runs.
    toggle.className = 'gproxy-cyber-toggle proxy-off gproxy-hidden';
    toggle.setAttribute('aria-label', 'GProxy toggle');
    toggle.style.cssText = 'display:flex!important;position:fixed!important;' +
        'left:-100px!important;top:50%!important;right:auto!important;bottom:auto!important;' +
        'width:28px!important;height:28px!important;border-radius:50%!important;' +
        'z-index:2147483646!important;visibility:visible!important;pointer-events:auto!important;' +
        'margin:0!important;padding:0!important;';
    toggle.innerHTML = `
        <span class="gproxy-cyber-icon" aria-hidden="true">G</span>
        <span class="gproxy-cyber-label" id="gproxy-cyber-label"></span>
    `;
    (document.body || document.documentElement).appendChild(toggle);

    updateCyberLabel();

    // Click to toggle proxy
    toggle.addEventListener('click', async () => {
        if (toggle.dataset.wasDragging === '1') {
            toggle.dataset.wasDragging = '0';
            return;
        }
        try {
            const response = await chrome.runtime.sendMessage({ action: 'toggleProxy' });
            updateCyberState(!!response);
        } catch (error) {
            console.error('[GProxy] toggle error:', error);
        }
    });

    // Hover 3s → whitelist prompt
    let hoverTimer = null;
    toggle.addEventListener('mouseenter', () => {
        updateCyberLabel();
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
        hoverTimer = setTimeout(() => {
            hoverTimer = null;
            showWhitelistPrompt();
        }, 1500);
    });
    toggle.addEventListener('mouseleave', () => {
        if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
        updateCyberLabel();
    });

    // ---------- Draggable + sidebar slide-in/out ----------
    // 默认贴边只露一点，鼠标靠近浏览器边缘自动弹出
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    let startX = 0;
    let startY = 0;
    let hideTimer = null;
    let revealed = false;
    let hoverLocked = false;
    let side = 'right';   // 'left' | 'right' —— 当前贴哪边

    const HIDE_DELAY = 900;
    const SHOW_ZONE = 60;   // 靠近边缘多少像素内触发弹出
    const PEEK = 18;        // 隐藏时只露出的宽度（像素）

    function getSize() {
        return {
            w: toggle.offsetWidth || 52,
            h: toggle.offsetHeight || 52
        };
    }

    // 用 !important 写定位，避免被页面或自身 CSS 覆盖
    function setPos(left, top, withTransition) {
        if (withTransition) {
            toggle.style.removeProperty('transition');
        } else {
            toggle.style.setProperty('transition', 'none', 'important');
        }
        toggle.style.setProperty('left', left + 'px', 'important');
        toggle.style.setProperty('top', top + 'px', 'important');
        toggle.style.setProperty('right', 'auto', 'important');
        toggle.style.setProperty('bottom', 'auto', 'important');
    }

    // 贴边隐藏：物理滑出屏幕，只留 PEEK
    function applyHidden(animate) {
        const { w, h } = getSize();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = toggle.getBoundingClientRect();

        // 决定贴哪边：用当前中心点判断
        const centerX = rect.left + w / 2;
        side = centerX > vw / 2 ? 'right' : 'left';

        let left, top;
        if (side === 'right') {
            left = vw - PEEK;          // 只露出右侧 PEEK 像素
        } else {
            left = PEEK - w;           // 只露出左侧 PEEK 像素
        }
        top = Math.max(0, Math.min(rect.top, vh - h));

        setPos(left, top, !!animate);
        toggle.classList.add('gproxy-hidden');
        revealed = false;

        if (!animate) {
            // 下一帧恢复过渡，后续滑入/滑出有动画
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    toggle.style.removeProperty('transition');
                });
            });
        }
    }

    // 滑出：完全可见，贴同一边
    function applyRevealed(animate) {
        const { w, h } = getSize();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = toggle.getBoundingClientRect();

        let left, top;
        if (side === 'right') {
            left = vw - w;
        } else {
            left = 0;
        }
        top = Math.max(0, Math.min(rect.top, vh - h));

        setPos(left, top, animate !== false);
        toggle.classList.remove('gproxy-hidden');
        revealed = true;
    }

    function scheduleHide() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = null;
        if (hoverLocked || isDragging) return;
        hideTimer = setTimeout(() => {
            if (!hoverLocked && !isDragging && revealed) {
                applyHidden(true);  // 带动画滑入侧边
            }
        }, HIDE_DELAY);
    }

    function scheduleReveal() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (!revealed) applyRevealed(true);
    }

    // 鼠标是否靠近按钮当前所在边缘（用于自动弹出）
    function isMouseNearToggle(e) {
        const rect = toggle.getBoundingClientRect();
        const vw = window.innerWidth;
        const inY = e.clientY > rect.top - SHOW_ZONE && e.clientY < rect.bottom + SHOW_ZONE;
        if (!inY) return false;

        if (side === 'right') {
            return e.clientX > vw - SHOW_ZONE;
        } else {
            return e.clientX < SHOW_ZONE;
        }
    }

    toggle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        hoverLocked = true;
        toggle.dataset.wasDragging = '0';
        startX = e.clientX;
        startY = e.clientY;

        // 拖之前先确保完全可见，否则鼠标抓不到
        if (!revealed) {
            applyRevealed(false);
        }

        const rect = toggle.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        toggle.style.setProperty('transition', 'none', 'important');
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) {
                toggle.dataset.wasDragging = '1';
            }
            let x = e.clientX - offsetX;
            let y = e.clientY - offsetY;
            const { w, h } = getSize();
            const maxX = window.innerWidth - Math.floor(w * 0.25);
            const maxY = window.innerHeight - Math.floor(h * 0.25);
            const minX = -Math.floor(w * 0.75);
            const minY = -Math.floor(h * 0.75);
            x = Math.max(minX, Math.min(x, maxX));
            y = Math.max(minY, Math.min(y, maxY));
            setPos(x, y, false);
            return;
        }

        // 鼠标靠近当前贴边 → 自动弹出
        if (isMouseNearToggle(e)) {
            hoverLocked = true;
            scheduleReveal();
        } else {
            if (hoverLocked) {
                hoverLocked = false;
                scheduleHide();
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            toggle.style.removeProperty('transition');
            hoverLocked = false;
            // 拖完根据位置决定贴哪边，稍后自动隐藏
            const { w } = getSize();
            const vw = window.innerWidth;
            const rect = toggle.getBoundingClientRect();
            const centerX = rect.left + w / 2;
            side = centerX > vw / 2 ? 'right' : 'left';
            revealed = true;
            scheduleHide();
        }
    });

    toggle.addEventListener('mouseenter', () => {
        hoverLocked = true;
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (!revealed) applyRevealed(true);
    });
    toggle.addEventListener('mouseleave', () => {
        hoverLocked = false;
        scheduleHide();
    });

    window.addEventListener('resize', () => {
        if (revealed) applyRevealed(false);
        else applyHidden(false);
    });

    // ---------- 初始化：默认贴右侧边只露出一点 ----------
    function initPosition() {
        const { h } = getSize();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        side = 'right';
        revealed = false;

        // 直接放到右侧贴边隐藏位置（只露 PEEK），无动画
        setPos(vw - PEEK, Math.max(0, Math.min(vh / 2 - h / 2, vh - h)), false);
        toggle.classList.add('gproxy-hidden');

        // 下一帧恢复过渡，保证后续滑入/滑出有动画
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toggle.style.removeProperty('transition');
            });
        });
    }

    // 等布局稳定
    if (document.readyState === 'complete') {
        requestAnimationFrame(initPosition);
    } else {
        window.addEventListener('load', () => requestAnimationFrame(initPosition), { once: true });
        // 兜底：即使 load 没触发，1s 后也初始化
        setTimeout(() => {
            const rect = toggle.getBoundingClientRect();
            // 若仍在初始屏外位置，说明 initPosition 没跑
            if (rect.left < -50) {
                initPosition();
            }
        }, 1000);
    }

    updateCyberState();

    document.addEventListener('i18n:languagechange', () => {
        updateCyberLabel();
    });

    return toggle;
}

// ==================== Update Functions ====================
async function updateCyberState(forceState) {
    const toggle = document.getElementById('gproxy-toggle');
    if (!toggle) return;

    let isProxyOn = false;

    if (forceState !== undefined) {
        isProxyOn = !!forceState;
    } else {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getProxyState' });
            isProxyOn = !!response;
        } catch (error) {
            console.error('[GProxy] getProxyState error:', error);
            isProxyOn = false;
        }
    }

    if (isProxyOn) {
        toggle.classList.add('proxy-on');
        toggle.classList.remove('proxy-off');
    } else {
        toggle.classList.remove('proxy-on');
        toggle.classList.add('proxy-off');
    }

    updateCyberLabel();
}

function updateCyberLabel() {
    const toggle = document.getElementById('gproxy-toggle');
    if (!toggle) return;

    const isOn = toggle.classList.contains('proxy-on');
    const label = document.getElementById('gproxy-cyber-label');
    const text = isOn ? I18N.t('proxy_on') : I18N.t('proxy_off');

    toggle.title = text;
    toggle.setAttribute('aria-label', text);
    if (label) label.textContent = text;
}

function showWhitelistPrompt() {
    if (document.querySelector('.gproxy-whitelist-prompt')) return;

    const hostname = window.location.hostname;
    if (!hostname) return;

    const prompt = document.createElement('div');
    prompt.className = 'gproxy-whitelist-prompt';
    // Highlight the domain name inside the prompt text
    const rawPrompt = I18N.t('whitelist_prompt', hostname);
    const promptText = rawPrompt.replace(
        new RegExp('(["\']?)' + hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\1', 'g'),
        '<span class="gproxy-domain">' + hostname + '</span>'
    );

    prompt.innerHTML = `
        <div class="gproxy-content">
            <div class="gproxy-prompt-header">
                <span class="gproxy-prompt-icon">⚡</span>
                <h3>${I18N.t('whitelist_added_title')}</h3>
            </div>
            <div class="gproxy-prompt-body">
                <p>${promptText}</p>
                <div class="gproxy-btn-group">
                    <button type="button" class="gproxy-btn gproxy-btn-no">${I18N.t('btn_cancel')}</button>
                    <button type="button" class="gproxy-btn gproxy-btn-yes">${I18N.t('btn_add_to_whitelist')}</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(prompt);
    // Force reflow then show
    requestAnimationFrame(() => prompt.classList.add('visible'));

    const close = () => {
        prompt.classList.remove('visible');
        setTimeout(() => prompt.remove(), 300);
    };

    prompt.querySelector('.gproxy-btn-yes').addEventListener('click', () => {
        addToWhitelist(hostname);
        close();
    });
    prompt.querySelector('.gproxy-btn-no').addEventListener('click', close);
    // Click backdrop to close
    prompt.addEventListener('click', (e) => {
        if (e.target === prompt) close();
    });
}

function addToWhitelist(hostname) {
    chrome.storage.local.get(['customBypassList'], (result) => {
        let bypassList = Array.isArray(result.customBypassList) ? result.customBypassList.slice() : [];
        if (!bypassList.includes(hostname)) {
            bypassList.push(hostname);
            chrome.storage.local.set({ customBypassList: bypassList }, () => {
                if (chrome.runtime.lastError) {
                    console.error('[GProxy] whitelist add error:', chrome.runtime.lastError);
                } else {
                    console.log('[GProxy] Added to whitelist:', hostname);
                    // storage.onChanged in background will re-apply proxy
                }
            });
        }
    });
}

// ==================== Initialize ====================
function initToggle() {
    try {
        createCyberToggle();
    } catch (e) {
        console.error('[GProxy] createCyberToggle failed:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggle);
} else {
    initToggle();
}

// Messages from background / options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setLanguage') {
        I18N.setLang(request.lang).then(() => {
            document.dispatchEvent(new CustomEvent('i18n:languagechange'));
            sendResponse({ status: 'ok' });
        });
        return true;
    }
    if (request.action === 'updateProxyState') {
        updateCyberState(request.state);
        sendResponse({ status: 'ok' });
        return true;
    }
    return false;
});