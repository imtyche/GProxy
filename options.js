const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const proxyModeText = document.getElementById('proxy-mode-text');
const bypassArea = document.getElementById('bypass-list');
const proxyScheme = document.getElementById('proxy-scheme');
const proxyHost = document.getElementById('proxy-host');
const proxyPort = document.getElementById('proxy-port');

const STATUS = {
    CHECKING: { text: '检测中...', color: '#555' },
    CONNECTED: (ms) => ({ text: `已连接 (${ms}ms)`, color: '#03dac6' }),
    DISCONNECTED: { text: '连接超时 (未连接)', color: '#cf6679' }
};

// 检测并更新当前 Chrome 的代理开启状态[cite: 2]
function updateProxyModeStatus() {
    chrome.proxy.settings.get({ incognito: false }, (config) => {
        const mode = config.value.mode;
        if (mode === 'fixed_servers' || mode === 'pac_script') {
            proxyModeText.textContent = '[代理已开启]';
            proxyModeText.style.color = '#03dac6';
        } else {
            proxyModeText.textContent = '[代理已关闭]';
            proxyModeText.style.color = '#cf6679';
        }
    });
}

function setUIStatus(type, ms = 0) {
    const state = typeof type === 'function' ? type(ms) : type;
    statusText.textContent = state.text;
    statusDot.style.background = state.color;
    if (ms > 0) {
        statusDot.classList.add('active');
    } else {
        statusDot.classList.remove('active');
    }
}

async function pingTest() {
    const start = performance.now();

    try {
        await Promise.race([
            fetch("https://www.google.com/generate_204", {
                cache: "no-store",
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 10000)
            )
        ]);

        setUIStatus(
            STATUS.CONNECTED,
            Math.round(performance.now() - start)
        );
    } catch {
        setUIStatus(STATUS.DISCONNECTED);
    }
}

function init() {
    // 读取当前代理控制状态
    updateProxyModeStatus();

    chrome.storage.local.get(['customBypassList', 'proxyScheme', 'proxyHost', 'proxyPort'], (result) => {
        if (result.customBypassList) {
            bypassArea.value = result.customBypassList.join('\n');
        }
        proxyScheme.value = result.proxyScheme || 'http';
        proxyHost.value = result.proxyHost || '127.0.0.1';
        proxyPort.value = result.proxyPort || 2334;
    });

    pingTest().then(() => {
        setInterval(pingTest, 10000);
    });
}

document.getElementById('btn-save').onclick = () => {
    const newList = bypassArea.value.split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const scheme = proxyScheme.value;
    const host = proxyHost.value.trim();
    const port = parseInt(proxyPort.value, 10);

    if (!host || isNaN(port)) {
        alert('请填写正确的主机地址和端口号！');
        return;
    }

    chrome.storage.local.set({
        customBypassList: newList,
        proxyScheme: scheme,
        proxyHost: host,
        proxyPort: port
    }, () => {
        // 保存并触发更新后再次同步状态
        updateProxyModeStatus();
        pingTest().then(() => { alert('保存成功!'); });
    });
};

init();