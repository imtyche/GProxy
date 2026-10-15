// ==================== Defaults (single source of truth) ====================
// Bypass list derived from passList.txt — domestic IP ranges / domains connect
// directly, everything else goes through the proxy.
const DEFAULT_BYPASS_LIST = [
    '192.168.0.0/16',
    '194.1.0.0/16',
    '10.0.0.0/8',
    '100.64.0.0/16',
    '127.16.0.0/16',
    '127.0.0.1',
    '::1',
    'localhost',
    '*baidu.com',
    '*163.com',
    '*qq.com',
    '*jd.com',
    '*360.com',
    '*hutool.cn',
    '*taobao.com',
    '*cnblogs.com',
    '*csdn.net',
    '*gitee.com',
    '*cn',
    '*4399.com',
    '*51.net',
    '51cto.com',
    '*51job.com',
    '*58.com',
    '*7k7k.com',
    '*91.com',
    '*alipan.com',
    '*alicdn.com',
    '*alibaba.com',
    '*alibabacloud.com',
    '*alipay.com',
    '*aliyun.com',
    '*biliapi.com',
    '*biliapi.net',
    '*bilibili.com',
    '*bilibili.tv',
    '*bilicomic.com',
    '*biligame.com',
    '*biligame.net',
    '*bilivideo.com',
    '*douyu.com',
    '*hao123.com',
    '*huya.com',
    '*iqiyi.com',
    '*kuaishou.com',
    '*layui.com',
    '*qqmail.com',
    '*sina.com',
    '*sogou.com',
    '*tencent-cloud.com',
    '*tencent.com',
    '*xiaomi.com',
    '*zhihu.com',
    '*douyin.com',
    '*deepseek.com',
    '*xunlei.com',
    '*weibo.com',
    '*postman.co',
    '*alal.site'
];

const DEFAULT_SCHEME = 'http';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 2334;

const MENU_TITLES = {
    zh: {
        enable: '开启 GProxy 代理',
        disable: '关闭 GProxy 代理',
        bypass: '将当前域名加入绕过名单',
        options: '打开 GProxy 设置'
    },
    en: {
        enable: 'Enable GProxy Proxy',
        disable: 'Disable GProxy Proxy',
        bypass: 'Add current domain to bypass list',
        options: 'Open GProxy Settings'
    }
};

// ==================== In-memory state (rebuilt lazily after SW restart) ====================
let cachedScheme = DEFAULT_SCHEME;
let cachedHost = DEFAULT_HOST;
let cachedPort = DEFAULT_PORT;
let cachedBypassList = null; // null until loaded, so we never apply stale defaults blindly
let cachedLang = 'zh';
let configLoadPromise = null;

/**
 * Validates proxy configuration
 * @throws {Error} if configuration is invalid
 */
function validateProxyConfig(scheme, host, port) {
    const validSchemes = ['http', 'https', 'socks4', 'socks5'];
    if (!validSchemes.includes(scheme)) {
        throw new Error(`Invalid proxy scheme: ${scheme}`);
    }
    if (!host || typeof host !== 'string') {
        throw new Error('Invalid proxy host');
    }
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        throw new Error(`Invalid proxy port: ${port}`);
    }
    return { scheme, host: host.trim(), port: portNum };
}

/**
 * 获取当前代理状态
 * @returns {Promise<boolean>} 代理是否开启
 */
function getProxyState() {
    return new Promise((resolve) => {
        chrome.proxy.settings.get({ incognito: false }, (config) => {
            if (chrome.runtime.lastError || !config || !config.value) {
                resolve(false);
                return;
            }
            const mode = config.value.mode;
            resolve(mode === 'fixed_servers' || mode === 'pac_script');
        });
    });
}

/**
 * Load config from storage into memory exactly once per service-worker lifetime.
 * MV3 terminates the SW at will, so top-level variables can be wiped at any time —
 * every entry point that needs config must await this first.
 */
function loadConfigAndInit() {
    if (!configLoadPromise) {
        configLoadPromise = new Promise((resolve) => {
            chrome.storage.local.get(
                ['customBypassList', 'proxyScheme', 'proxyHost', 'proxyPort', 'uiLanguage'],
                (result) => {
                    if (result.customBypassList && Array.isArray(result.customBypassList)) {
                        cachedBypassList = result.customBypassList;
                    } else {
                        cachedBypassList = DEFAULT_BYPASS_LIST.slice();
                        chrome.storage.local.set({ customBypassList: cachedBypassList });
                    }

                    cachedScheme = result.proxyScheme || DEFAULT_SCHEME;
                    cachedHost = result.proxyHost || DEFAULT_HOST;
                    cachedPort = result.proxyPort != null ? result.proxyPort : DEFAULT_PORT;
                    cachedLang = result.uiLanguage === 'en' ? 'en' : 'zh';

                    if (!result.proxyScheme || !result.proxyHost || result.proxyPort == null) {
                        chrome.storage.local.set({
                            proxyScheme: cachedScheme,
                            proxyHost: cachedHost,
                            proxyPort: cachedPort
                        }, () => resolve());
                    } else {
                        resolve();
                    }
                }
            );
        });
    }
    return configLoadPromise;
}

/** Persist + broadcast proxy state, and refresh the toolbar badge */
function broadcastProxyState(state) {
    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (!tab.id) continue;
            chrome.tabs.sendMessage(tab.id, { action: 'updateProxyState', state }).catch(() => {});
        }
    });
    chrome.action.setBadgeText({ text: state ? 'ON' : '' });
    chrome.action.setBadgeBackgroundColor({ color: state ? '#00c8e0' : '#5a6a7a' });
}

chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;

    let needReapply = false;
    if (changes.customBypassList) {
        cachedBypassList = changes.customBypassList.newValue || cachedBypassList;
        needReapply = true;
    }
    if (changes.proxyScheme) {
        cachedScheme = changes.proxyScheme.newValue;
        needReapply = true;
    }
    if (changes.proxyHost) {
        cachedHost = changes.proxyHost.newValue;
        needReapply = true;
    }
    if (changes.proxyPort) {
        cachedPort = changes.proxyPort.newValue;
        needReapply = true;
    }

    if (needReapply) {
        const isOn = await getProxyState();
        if (isOn) {
            try {
                await applyProxy();
            } catch (e) {
                console.error('[GProxy] reapply after storage change failed:', e);
            }
        }
        broadcastProxyState(await getProxyState());
    }
});

async function applyProxy() {
    await loadConfigAndInit(); // guard against SW cold start / stale cache
    return new Promise((resolve, reject) => {
        try {
            const validated = validateProxyConfig(cachedScheme, cachedHost, cachedPort);
            cachedScheme = validated.scheme;
            cachedHost = validated.host;
            cachedPort = validated.port;

            const config = {
                mode: 'fixed_servers',
                rules: {
                    singleProxy: {
                        scheme: cachedScheme,
                        host: cachedHost,
                        port: cachedPort
                    },
                    bypassList: Array.isArray(cachedBypassList) ? cachedBypassList : []
                }
            };
            chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
                if (chrome.runtime.lastError) {
                    console.error('set proxy error:', chrome.runtime.lastError.message);
                    reject(chrome.runtime.lastError);
                } else {
                    chrome.storage.local.set({ proxyEnabled: true });
                    console.info(`proxy applied successfully: ${cachedScheme}://${cachedHost}:${cachedPort}, bypass: ${(cachedBypassList || []).join(', ')}`);
                    broadcastProxyState(true);
                    resolve();
                }
            });
        } catch (err) {
            console.error('apply proxy error:', err);
            reject(err);
        }
    });
}

function clearProxy() {
    return new Promise((resolve, reject) => {
        chrome.proxy.settings.clear({ scope: 'regular' }, () => {
            if (chrome.runtime.lastError) {
                console.error('clear proxy error:', chrome.runtime.lastError.message);
                reject(chrome.runtime.lastError);
            } else {
                chrome.storage.local.set({ proxyEnabled: false });
                console.info('clear proxy successfully');
                broadcastProxyState(false);
                resolve();
            }
        });
    });
}

// ==================== Context menus ====================
function getMenuTitles() {
    return MENU_TITLES[cachedLang] || MENU_TITLES.zh;
}

function refreshMenuToggleTitle(isOn) {
    const titles = getMenuTitles();
    chrome.contextMenus.update('gproxy-toggle', {
        title: isOn ? titles.disable : titles.enable
    }, () => void chrome.runtime.lastError);
}

async function createContextMenus() {
    await loadConfigAndInit();
    const titles = getMenuTitles();
    const isOn = await getProxyState();
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'gproxy-toggle',
            title: isOn ? titles.disable : titles.enable,
            contexts: ['all']
        });
        chrome.contextMenus.create({
            id: 'gproxy-bypass',
            title: titles.bypass,
            contexts: ['all']
        });
        chrome.contextMenus.create({ id: 'gproxy-sep', type: 'separator', contexts: ['all'] });
        chrome.contextMenus.create({
            id: 'gproxy-options',
            title: titles.options,
            contexts: ['all']
        });
    });
}

async function updateContextMenuLanguage() {
    const titles = getMenuTitles();
    const isOn = await getProxyState();
    chrome.contextMenus.update('gproxy-toggle', { title: isOn ? titles.disable : titles.enable }, () => void chrome.runtime.lastError);
    chrome.contextMenus.update('gproxy-bypass', { title: titles.bypass }, () => void chrome.runtime.lastError);
    chrome.contextMenus.update('gproxy-options', { title: titles.options }, () => void chrome.runtime.lastError);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'gproxy-toggle') {
        const isOn = await getProxyState();
        if (isOn) {
            await clearProxy().catch(() => {});
        } else {
            await applyProxy().catch(() => {});
        }
        refreshMenuToggleTitle(await getProxyState());
        return;
    }

    if (info.menuItemId === 'gproxy-bypass') {
        let host = '';
        try {
            host = tab && tab.url ? new URL(tab.url).hostname : '';
        } catch (e) {
            host = '';
        }
        if (!host) return;
        const result = await chrome.storage.local.get(['customBypassList']);
        const list = Array.isArray(result.customBypassList) ? result.customBypassList.slice() : [];
        if (!list.includes(host)) {
            list.push(host);
            await chrome.storage.local.set({ customBypassList: list });
        }
        return;
    }

    if (info.menuItemId === 'gproxy-options') {
        chrome.runtime.openOptionsPage();
    }
});

// ==================== Lifecycle ====================
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'toggle-proxy') return;
    const isOn = await getProxyState();
    if (isOn) {
        await clearProxy().catch(() => {});
    } else {
        await applyProxy().catch(() => {});
    }
    refreshMenuToggleTitle(await getProxyState());
});

// 处理来自内容脚本 / 选项页的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleProxy') {
        getProxyState().then(async (isOn) => {
            if (isOn) {
                await clearProxy().then(() => sendResponse(false)).catch(() => sendResponse(false));
            } else {
                await applyProxy().then(() => sendResponse(true)).catch(() => sendResponse(false));
            }
            refreshMenuToggleTitle(await getProxyState());
        });
        return true; // async response
    }

    if (request.action === 'getProxyState') {
        getProxyState().then((state) => sendResponse(state));
        return true;
    }

    if (request.action === 'getDefaults') {
        sendResponse({
            bypassList: DEFAULT_BYPASS_LIST.slice(),
            scheme: DEFAULT_SCHEME,
            host: DEFAULT_HOST,
            port: DEFAULT_PORT
        });
        return true;
    }

    if (request.action === 'setLanguage') {
        cachedLang = request.lang === 'en' ? 'en' : 'zh';
        console.log('[GProxy] Language switched to:', cachedLang);
        updateContextMenuLanguage();
        // Sync the floating toggle on all already-open tabs
        chrome.tabs.query({}, (tabs) => {
            for (const tab of tabs) {
                if (!tab.id) continue;
                chrome.tabs.sendMessage(tab.id, { action: 'setLanguage', lang: cachedLang }).catch(() => {});
            }
        });
        sendResponse({ status: 'ok' });
        return true;
    }

    return false;
});

chrome.runtime.onInstalled.addListener(async () => {
    await loadConfigAndInit();
    await createContextMenus();
    // Only restore the proxy if the user had it enabled before, never force it on.
    const { proxyEnabled } = await chrome.storage.local.get(['proxyEnabled']);
    if (proxyEnabled) {
        try {
            await applyProxy();
            console.log('restored proxy on install/update');
        } catch (e) {
            console.error('initial apply proxy failed:', e);
        }
    } else {
        broadcastProxyState(await getProxyState());
    }
});

// Service worker may restart; restore config on startup
chrome.runtime.onStartup.addListener(async () => {
    await loadConfigAndInit();
    broadcastProxyState(await getProxyState());
});
