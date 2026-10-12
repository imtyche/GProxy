let cachedScheme = 'http';
let cachedHost = '127.0.0.1';
let cachedPort = 2334;
let cachedBypassList = [];

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

/** Broadcast proxy state to all tabs' content scripts */
function broadcastProxyState(state) {
    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (!tab.id) continue;
            chrome.tabs.sendMessage(tab.id, { action: 'updateProxyState', state }).catch(() => {});
        }
    });
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

function applyProxy() {
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
                    console.info(`proxy applied successfully: ${cachedScheme}://${cachedHost}:${cachedPort}, bypass: ${cachedBypassList.join(', ')}`);
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
                console.info('clear proxy successfully');
                broadcastProxyState(false);
                resolve();
            }
        });
    });
}

async function clearHistory() {
    try {
        await chrome.history.deleteAll();
        console.log('✅ All history records have been successfully cleared.');
    } catch (err) {
        console.error('❌ Error clearing history:', err);
    }
}

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
});

function loadConfigAndInit() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['customBypassList', 'proxyScheme', 'proxyHost', 'proxyPort'], (result) => {
            if (result.customBypassList && Array.isArray(result.customBypassList)) {
                cachedBypassList = result.customBypassList;
            } else {
                const defaultList = ['127.0.0.1', '::1', 'localhost', '*.baidu.com'];
                cachedBypassList = defaultList;
                chrome.storage.local.set({ customBypassList: defaultList });
            }

            cachedScheme = result.proxyScheme || 'http';
            cachedHost = result.proxyHost || '127.0.0.1';
            cachedPort = result.proxyPort || 2334;

            if (!result.proxyScheme || !result.proxyHost || result.proxyPort == null) {
                chrome.storage.local.set({
                    proxyScheme: cachedScheme,
                    proxyHost: cachedHost,
                    proxyPort: cachedPort
                }, () => resolve());
            } else {
                resolve();
            }
            console.log('Successfully loaded all rules and server configuration from local storage.');
        });
    });
}

// 处理来自内容脚本 / 选项页的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleProxy') {
        getProxyState().then((isOn) => {
            if (isOn) {
                clearProxy()
                    .then(() => sendResponse(false))
                    .catch(() => sendResponse(false));
            } else {
                applyProxy()
                    .then(() => sendResponse(true))
                    .catch(() => sendResponse(false));
            }
        });
        return true; // async response
    }

    if (request.action === 'getProxyState') {
        getProxyState().then((state) => sendResponse(state));
        return true;
    }

    if (request.action === 'setLanguage') {
        console.log('[GProxy] Language switched to:', request.lang);
        sendResponse({ status: 'ok' });
        return false;
    }

    return false;
});

chrome.runtime.onInstalled.addListener(async () => {
    await loadConfigAndInit();
    try {
        await applyProxy();
        console.log('apply proxy successfully');
    } catch (e) {
        console.error('initial apply proxy failed:', e);
    }
});

// Service worker may restart; restore config on startup
chrome.runtime.onStartup.addListener(async () => {
    await loadConfigAndInit();
});
