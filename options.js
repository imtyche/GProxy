// ==================== i18n Module ====================
const I18N = (function() {
    let lang = 'zh';
    const messages = {};

    const FALLBACK = {
        zh: {
            proj_name: 'GProxy',
            title_options: 'GProxy 选项',
            section_proxy: '代理服务器设置',
            label_scheme: '协议',
            label_host: '主机地址',
            label_port: '端口',
            section_status: '连接状态',
            status_proxy_mode: '代理模式',
            status_checking: '检测中...',
            status_connected: '代理运行中',
            status_disconnected: '代理已关闭',
            status_detail_on: '延迟 {0} ms',
            status_detail_off: '系统直连，未使用代理',
            status_timeout: '连接超时',
            status_testing: '测速中...',
            section_bypass: '绕行名单',
            hint_bypass: '以下域名和 IP 将直接连接，不经过代理服务器。',
            btn_save: '保存并更新',
            btn_reset: '恢复默认设置',
            error_invalid_host_port: '请填写正确的主机地址和端口号！',
            error_invalid_scheme: '无效的代理协议！',
            error_port_range: '端口号必须在 1-65535 之间！',
            error_save: '保存失败: {0}',
            success_saved: '保存成功！',
            proxy_on: '代理已开启',
            proxy_off: '代理已关闭',
            confirm_reset: '确定要恢复默认设置吗？',
            lang_zh: '中文',
            lang_en: 'English'
        },
        en: {
            proj_name: 'GProxy',
            title_options: 'GProxy Options',
            section_proxy: 'Proxy Server Settings',
            label_scheme: 'Scheme',
            label_host: 'Host',
            label_port: 'Port',
            section_status: 'Connection Status',
            status_proxy_mode: 'Proxy Mode',
            status_checking: 'Checking...',
            status_connected: 'Proxy Running',
            status_disconnected: 'Proxy Disabled',
            status_detail_on: 'Latency {0} ms',
            status_detail_off: 'Direct connection, no proxy',
            status_timeout: 'Connection Timeout',
            status_testing: 'Testing...',
            section_bypass: 'Bypass List',
            hint_bypass: 'The following domains and IPs will connect directly, bypassing the proxy server.',
            btn_save: 'Save and Update',
            btn_reset: 'Reset to Defaults',
            error_invalid_host_port: 'Please enter a valid host and port!',
            error_invalid_scheme: 'Invalid proxy scheme!',
            error_port_range: 'Port must be between 1-65535!',
            error_save: 'Save failed: {0}',
            success_saved: 'Saved successfully!',
            proxy_on: 'Proxy Enabled',
            proxy_off: 'Proxy Disabled',
            confirm_reset: 'Reset to default settings?',
            lang_zh: '中文',
            lang_en: 'English'
        }
    };

    async function loadLang(langCode) {
        const code = (langCode === 'en') ? 'en' : 'zh';
        try {
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
                document.documentElement.lang = code;
                return;
            }
        } catch (e) {
            console.warn('[GProxy] i18n fetch failed, using fallback:', e);
        }
        Object.keys(messages).forEach(k => delete messages[k]);
        Object.assign(messages, FALLBACK[code] || FALLBACK.zh);
        lang = code;
        document.documentElement.lang = code;
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

// ==================== Initialize i18n and UI ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Wait a tick for I18N init
    await new Promise(r => setTimeout(r, 50));

    const langSwitcherDesktop = document.getElementById('lang-switch-desktop');
    const langSwitcherMobile = document.getElementById('lang-switcher');

    function updateLangButtons() {
        const currentLang = I18N.getLang();
        const label = currentLang === 'zh' ? 'EN' : '中';
        [langSwitcherDesktop, langSwitcherMobile].forEach(btn => {
            if (btn) btn.textContent = label;
        });
    }

    function toggleLang() {
        const nextLang = I18N.getLang() === 'zh' ? 'en' : 'zh';
        I18N.setLang(nextLang).then(() => {
            updateLangButtons();
            applyI18n();
            updateProxyModeStatus();
        });
    }

    if (langSwitcherDesktop) langSwitcherDesktop.addEventListener('click', toggleLang);
    if (langSwitcherMobile) langSwitcherMobile.addEventListener('click', toggleLang);

    function applyI18n() {
        updateLangButtons();

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) el.textContent = I18N.t(key);
        });

        const titleEl = document.getElementById('title-options');
        if (titleEl) titleEl.textContent = I18N.t('title_options');

        // Keep labels in sync even if data-i18n is present
        const labels = document.querySelectorAll('.form-group label');
        labels.forEach(label => {
            const forAttr = label.getAttribute('for');
            if (forAttr === 'proxy-scheme') label.textContent = I18N.t('label_scheme');
            if (forAttr === 'proxy-host') label.textContent = I18N.t('label_host');
            if (forAttr === 'proxy-port') label.textContent = I18N.t('label_port');
        });
    }

    document.addEventListener('i18n:languagechange', applyI18n);
    applyI18n();

    // ==================== UI Elements ====================
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const proxyModeText = document.getElementById('proxy-mode-text');
    const bypassArea = document.getElementById('bypass-list');
    const proxyScheme = document.getElementById('proxy-scheme');
    const proxyHost = document.getElementById('proxy-host');
    const proxyPort = document.getElementById('proxy-port');
    const btnSave = document.getElementById('btn-save');
    const btnReset = document.getElementById('btn-reset');

    function showToast(msg, isError = false) {
        const toast = document.getElementById('toast');
        if (!toast) {
            alert(msg);
            return;
        }
        toast.textContent = msg;
        toast.classList.toggle('error', !!isError);
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
    }

    let statusChecking = false;

    async function measureLatency() {
        // Measure round-trip via a lightweight 204 endpoint (goes through current proxy if on)
        const targets = [
            'https://www.gstatic.com/generate_204',
            'https://connectivitycheck.gstatic.com/generate_204',
            'https://cp.cloudflare.com/'
        ];
        const timeoutMs = 5000;
        for (const url of targets) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            const t0 = performance.now();
            try {
                await fetch(url, {
                    method: 'GET',
                    cache: 'no-store',
                    mode: 'no-cors',
                    signal: controller.signal
                });
                clearTimeout(timer);
                return Math.round(performance.now() - t0);
            } catch (_) {
                clearTimeout(timer);
                // try next target
            }
        }
        return null; // all failed
    }

    function updateProxyModeStatus() {
        if (statusChecking) return;
        statusChecking = true;

        chrome.proxy.settings.get({ incognito: false }, async (config) => {
            try {
                if (chrome.runtime.lastError || !config || !config.value) {
                    if (statusDot) {
                        statusDot.classList.add('disconnected');
                        statusDot.classList.remove('connected');
                    }
                    if (statusText) statusText.textContent = I18N.t('status_detail_off');
                    if (proxyModeText) {
                        proxyModeText.textContent = I18N.t('proxy_off');
                        proxyModeText.style.color = '#ff3355';
                    }
                    return;
                }

                const mode = config.value.mode;
                const isOn = mode === 'fixed_servers' || mode === 'pac_script';

                if (!isOn) {
                    if (statusDot) {
                        statusDot.classList.add('disconnected');
                        statusDot.classList.remove('connected');
                    }
                    if (proxyModeText) {
                        proxyModeText.textContent = I18N.t('proxy_off');
                        proxyModeText.style.color = '#ff3355';
                    }
                    if (statusText) statusText.textContent = I18N.t('status_detail_off');
                    return;
                }

                // Proxy is on — measure latency
                if (statusText) statusText.textContent = I18N.t('status_testing');
                if (proxyModeText) {
                    proxyModeText.textContent = I18N.t('proxy_on');
                    proxyModeText.style.color = '#00ff9d';
                }

                const ms = await measureLatency();

                if (ms !== null) {
                    if (statusDot) {
                        statusDot.classList.add('connected');
                        statusDot.classList.remove('disconnected');
                    }
                    if (statusText) statusText.textContent = I18N.t('status_detail_on', ms);
                    if (proxyModeText) {
                        proxyModeText.textContent = ms + ' ms';
                        proxyModeText.style.color = ms < 200 ? '#00ff9d' : (ms < 500 ? '#ffaa00' : '#ff3355');
                    }
                } else {
                    if (statusDot) {
                        statusDot.classList.add('disconnected');
                        statusDot.classList.remove('connected');
                    }
                    if (statusText) statusText.textContent = I18N.t('status_timeout');
                    if (proxyModeText) {
                        proxyModeText.textContent = I18N.t('status_timeout');
                        proxyModeText.style.color = '#ff3355';
                    }
                }
            } finally {
                statusChecking = false;
            }
        });
    }

    // Initial + periodic latency refresh
    updateProxyModeStatus();
    setInterval(updateProxyModeStatus, 5000);

    // Refresh when storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') updateProxyModeStatus();
    });

    chrome.storage.local.get(['customBypassList', 'proxyScheme', 'proxyHost', 'proxyPort'], (result) => {
        if (bypassArea && result.customBypassList) {
            bypassArea.value = result.customBypassList.join('\n');
        }
        if (proxyScheme) proxyScheme.value = result.proxyScheme || 'http';
        if (proxyHost) proxyHost.value = result.proxyHost || '127.0.0.1';
        if (proxyPort) proxyPort.value = result.proxyPort || 2334;
    });

    if (btnSave) {
        btnSave.onclick = () => {
            const newList = (bypassArea ? bypassArea.value : '')
                .split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            const scheme = proxyScheme ? proxyScheme.value : 'http';
            const host = proxyHost ? proxyHost.value.trim() : '';
            const port = proxyPort ? parseInt(proxyPort.value, 10) : NaN;

            if (!host || isNaN(port)) {
                showToast(I18N.t('error_invalid_host_port'), true);
                return;
            }

            const validSchemes = ['http', 'https', 'socks4', 'socks5'];
            if (!validSchemes.includes(scheme)) {
                showToast(I18N.t('error_invalid_scheme'), true);
                return;
            }

            if (port < 1 || port > 65535) {
                showToast(I18N.t('error_port_range'), true);
                return;
            }

            chrome.storage.local.set({
                customBypassList: newList,
                proxyScheme: scheme,
                proxyHost: host,
                proxyPort: port
            }, () => {
                if (chrome.runtime.lastError) {
                    showToast(I18N.t('error_save', chrome.runtime.lastError.message), true);
                    return;
                }
                updateProxyModeStatus();
                showToast(I18N.t('success_saved'));
            });
        };
    }

    if (btnReset) {
        btnReset.onclick = () => {
            if (confirm(I18N.t('confirm_reset'))) {
                chrome.storage.local.set({
                    customBypassList: ['127.0.0.1', '::1', 'localhost', '*.baidu.com'],
                    proxyScheme: 'http',
                    proxyHost: '127.0.0.1',
                    proxyPort: 2334
                }, () => {
                    window.location.reload();
                });
            }
        };
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setLanguage') {
        I18N.setLang(request.lang).then(() => {
            document.dispatchEvent(new CustomEvent('i18n:languagechange'));
            sendResponse({ status: 'ok' });
        });
        return true;
    }
    if (request.action === 'updateProxyState') {
        // Options page will refresh status via its own poll / storage listener if needed
        sendResponse({ status: 'ok' });
        return true;
    }
    return false;
});
