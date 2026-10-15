// ==================== Shared i18n Engine ====================
// Used by both content.js (page toggle) and options.js (settings page).
// Each consumer passes its own fallback dictionary, so keys can differ.
(function (global) {
    function createI18N(FALLBACK) {
        let lang = 'zh';
        const messages = {};
        let readyPromise = null;

        function loadLang(langCode) {
            const code = (langCode === 'en') ? 'en' : 'zh';
            Object.keys(messages).forEach(k => delete messages[k]);
            Object.assign(messages, FALLBACK[code] || FALLBACK.zh);
            lang = code;
            if (typeof document !== 'undefined') document.documentElement.lang = code;
        }

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

        function init() {
            if (!readyPromise) {
                readyPromise = (async () => {
                    try {
                        const savedLang = await new Promise((resolve) => {
                            chrome.storage.local.get(['uiLanguage'], (r) => resolve(r.uiLanguage || 'zh'));
                        });
                        loadLang(savedLang);
                    } catch (e) {
                        loadLang('zh');
                    }
                })();
            }
            return readyPromise;
        }

        async function setLang(langCode) {
            loadLang(langCode);
            await new Promise((resolve) => {
                chrome.storage.local.set({ uiLanguage: lang }, resolve);
            });
            if (typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('i18n:languagechange', { detail: { lang } }));
            }
        }

        return { t, setLang, getLang: () => lang, init, loadLang };
    }

    global.createI18N = createI18N;
})(typeof self !== 'undefined' ? self : this);
