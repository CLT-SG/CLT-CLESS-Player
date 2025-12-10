/*! Capacitor: https://capacitorjs.com/ - MIT License */
const createCapacitorPlatforms = (win) => {
    const defaultPlatformMap = new Map();
    defaultPlatformMap.set('web', { name: 'web' });
    const capPlatforms = win.CapacitorPlatforms || {
        currentPlatform: { name: 'web' },
        platforms: defaultPlatformMap,
    };
    const addPlatform = (name, platform) => {
        capPlatforms.platforms.set(name, platform);
    };
    const setPlatform = (name) => {
        if (capPlatforms.platforms.has(name)) {
            capPlatforms.currentPlatform = capPlatforms.platforms.get(name);
        }
    };
    capPlatforms.addPlatform = addPlatform;
    capPlatforms.setPlatform = setPlatform;
    return capPlatforms;
};
const initPlatforms = (win) => (win.CapacitorPlatforms = createCapacitorPlatforms(win));
/**
 * @deprecated Set `CapacitorCustomPlatform` on the window object prior to runtime executing in the web app instead
 */
const CapacitorPlatforms = /*#__PURE__*/ initPlatforms((typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
        ? self
        : typeof window !== 'undefined'
            ? window
            : typeof global !== 'undefined'
                ? global
                : {}));
/**
 * @deprecated Set `CapacitorCustomPlatform` on the window object prior to runtime executing in the web app instead
 */
CapacitorPlatforms.addPlatform;
/**
 * @deprecated Set `CapacitorCustomPlatform` on the window object prior to runtime executing in the web app instead
 */
CapacitorPlatforms.setPlatform;

var ExceptionCode;
(function (ExceptionCode) {
    /**
     * API is not implemented.
     *
     * This usually means the API can't be used because it is not implemented for
     * the current platform.
     */
    ExceptionCode["Unimplemented"] = "UNIMPLEMENTED";
    /**
     * API is not available.
     *
     * This means the API can't be used right now because:
     *   - it is currently missing a prerequisite, such as network connectivity
     *   - it requires a particular platform or browser version
     */
    ExceptionCode["Unavailable"] = "UNAVAILABLE";
})(ExceptionCode || (ExceptionCode = {}));
class CapacitorException extends Error {
    constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
    }
}
const getPlatformId = (win) => {
    var _a, _b;
    if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return 'android';
    }
    else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return 'ios';
    }
    else {
        return 'web';
    }
};

const createCapacitor = (win) => {
    var _a, _b, _c, _d, _e;
    const capCustomPlatform = win.CapacitorCustomPlatform || null;
    const cap = win.Capacitor || {};
    const Plugins = (cap.Plugins = cap.Plugins || {});
    /**
     * @deprecated Use `capCustomPlatform` instead, default functions like registerPlugin will function with the new object.
     */
    const capPlatforms = win.CapacitorPlatforms;
    const defaultGetPlatform = () => {
        return capCustomPlatform !== null
            ? capCustomPlatform.name
            : getPlatformId(win);
    };
    const getPlatform = ((_a = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _a === void 0 ? void 0 : _a.getPlatform) || defaultGetPlatform;
    const defaultIsNativePlatform = () => getPlatform() !== 'web';
    const isNativePlatform = ((_b = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _b === void 0 ? void 0 : _b.isNativePlatform) || defaultIsNativePlatform;
    const defaultIsPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
            // JS implementation available for the current platform.
            return true;
        }
        if (getPluginHeader(pluginName)) {
            // Native implementation available.
            return true;
        }
        return false;
    };
    const isPluginAvailable = ((_c = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _c === void 0 ? void 0 : _c.isPluginAvailable) ||
        defaultIsPluginAvailable;
    const defaultGetPluginHeader = (pluginName) => { var _a; return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find(h => h.name === pluginName); };
    const getPluginHeader = ((_d = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _d === void 0 ? void 0 : _d.getPluginHeader) || defaultGetPluginHeader;
    const handleError = (err) => win.console.error(err);
    const pluginMethodNoop = (_target, prop, pluginName) => {
        return Promise.reject(`${pluginName} does not have an implementation of "${prop}".`);
    };
    const registeredPlugins = new Map();
    const defaultRegisterPlugin = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
            console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
            return registeredPlugin.proxy;
        }
        const platform = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
            if (!jsImplementation && platform in jsImplementations) {
                jsImplementation =
                    typeof jsImplementations[platform] === 'function'
                        ? (jsImplementation = await jsImplementations[platform]())
                        : (jsImplementation = jsImplementations[platform]);
            }
            else if (capCustomPlatform !== null &&
                !jsImplementation &&
                'web' in jsImplementations) {
                jsImplementation =
                    typeof jsImplementations['web'] === 'function'
                        ? (jsImplementation = await jsImplementations['web']())
                        : (jsImplementation = jsImplementations['web']);
            }
            return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
            var _a, _b;
            if (pluginHeader) {
                const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find(m => prop === m.name);
                if (methodHeader) {
                    if (methodHeader.rtype === 'promise') {
                        return (options) => cap.nativePromise(pluginName, prop.toString(), options);
                    }
                    else {
                        return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
                    }
                }
                else if (impl) {
                    return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
                }
            }
            else if (impl) {
                return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
            }
            else {
                throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
            }
        };
        const createPluginMethodWrapper = (prop) => {
            let remove;
            const wrapper = (...args) => {
                const p = loadPluginImplementation().then(impl => {
                    const fn = createPluginMethod(impl, prop);
                    if (fn) {
                        const p = fn(...args);
                        remove = p === null || p === void 0 ? void 0 : p.remove;
                        return p;
                    }
                    else {
                        throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
                    }
                });
                if (prop === 'addListener') {
                    p.remove = async () => remove();
                }
                return p;
            };
            // Some flair ✨
            wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
            Object.defineProperty(wrapper, 'name', {
                value: prop,
                writable: false,
                configurable: false,
            });
            return wrapper;
        };
        const addListener = createPluginMethodWrapper('addListener');
        const removeListener = createPluginMethodWrapper('removeListener');
        const addListenerNative = (eventName, callback) => {
            const call = addListener({ eventName }, callback);
            const remove = async () => {
                const callbackId = await call;
                removeListener({
                    eventName,
                    callbackId,
                }, callback);
            };
            const p = new Promise(resolve => call.then(() => resolve({ remove })));
            p.remove = async () => {
                console.warn(`Using addListener() without 'await' is deprecated.`);
                await remove();
            };
            return p;
        };
        const proxy = new Proxy({}, {
            get(_, prop) {
                switch (prop) {
                    // https://github.com/facebook/react/issues/20030
                    case '$$typeof':
                        return undefined;
                    case 'toJSON':
                        return () => ({});
                    case 'addListener':
                        return pluginHeader ? addListenerNative : addListener;
                    case 'removeListener':
                        return removeListener;
                    default:
                        return createPluginMethodWrapper(prop);
                }
            },
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
            name: pluginName,
            proxy,
            platforms: new Set([
                ...Object.keys(jsImplementations),
                ...(pluginHeader ? [platform] : []),
            ]),
        });
        return proxy;
    };
    const registerPlugin = ((_e = capPlatforms === null || capPlatforms === void 0 ? void 0 : capPlatforms.currentPlatform) === null || _e === void 0 ? void 0 : _e.registerPlugin) || defaultRegisterPlugin;
    // Add in convertFileSrc for web, it will already be available in native context
    if (!cap.convertFileSrc) {
        cap.convertFileSrc = filePath => filePath;
    }
    cap.getPlatform = getPlatform;
    cap.handleError = handleError;
    cap.isNativePlatform = isNativePlatform;
    cap.isPluginAvailable = isPluginAvailable;
    cap.pluginMethodNoop = pluginMethodNoop;
    cap.registerPlugin = registerPlugin;
    cap.Exception = CapacitorException;
    cap.DEBUG = !!cap.DEBUG;
    cap.isLoggingEnabled = !!cap.isLoggingEnabled;
    // Deprecated props
    cap.platform = cap.getPlatform();
    cap.isNative = cap.isNativePlatform();
    return cap;
};
const initCapacitorGlobal = (win) => (win.Capacitor = createCapacitor(win));

const Capacitor = /*#__PURE__*/ initCapacitorGlobal(typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
        ? self
        : typeof window !== 'undefined'
            ? window
            : typeof global !== 'undefined'
                ? global
                : {});
const registerPlugin = Capacitor.registerPlugin;
/**
 * @deprecated Provided for backwards compatibility for Capacitor v2 plugins.
 * Capacitor v3 plugins should import the plugin directly. This "Plugins"
 * export is deprecated in v3, and will be removed in v4.
 */
Capacitor.Plugins;

/**
 * Base class web plugins should extend.
 */
class WebPlugin {
    constructor(config) {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
        if (config) {
            // TODO: add link to upgrade guide
            console.warn(`Capacitor WebPlugin "${config.name}" config object was deprecated in v3 and will be removed in v4.`);
            this.config = config;
        }
    }
    addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
            this.listeners[eventName] = [];
            firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        // If we haven't added a window listener for this event and it requires one,
        // go ahead and add it
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
            this.addWindowListener(windowListener);
        }
        if (firstListener) {
            this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove });
        return p;
    }
    async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
            this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
    }
    notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
            if (retainUntilConsumed) {
                let args = this.retainedEventArguments[eventName];
                if (!args) {
                    args = [];
                }
                args.push(data);
                this.retainedEventArguments[eventName] = args;
            }
            return;
        }
        listeners.forEach(listener => listener(data));
    }
    hasListeners(eventName) {
        return !!this.listeners[eventName].length;
    }
    registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
            registered: false,
            windowEventName,
            pluginEventName,
            handler: event => {
                this.notifyListeners(pluginEventName, event);
            },
        };
    }
    unimplemented(msg = 'not implemented') {
        return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
    }
    unavailable(msg = 'not available') {
        return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
    }
    async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
            return;
        }
        const index = listeners.indexOf(listenerFunc);
        this.listeners[eventName].splice(index, 1);
        // If there are no more listeners for this type of event,
        // remove the window listener
        if (!this.listeners[eventName].length) {
            this.removeWindowListener(this.windowListeners[eventName]);
        }
    }
    addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
    }
    removeWindowListener(handle) {
        if (!handle) {
            return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
    }
    sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
            return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach(arg => {
            this.notifyListeners(eventName, arg);
        });
    }
}
/******** END WEB VIEW PLUGIN ********/
/******** COOKIES PLUGIN ********/
/**
 * Safely web encode a string value (inspired by js-cookie)
 * @param str The string value to encode
 */
const encode = (str) => encodeURIComponent(str)
    .replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent)
    .replace(/[()]/g, escape);
/**
 * Safely web decode a string value (inspired by js-cookie)
 * @param str The string value to decode
 */
const decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
class CapacitorCookiesPluginWeb extends WebPlugin {
    async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(';').forEach(cookie => {
            if (cookie.length <= 0)
                return;
            // Replace first "=" with CAP_COOKIE to prevent splitting on additional "="
            let [key, value] = cookie.replace(/=/, 'CAP_COOKIE').split('CAP_COOKIE');
            key = decode(key).trim();
            value = decode(value).trim();
            cookieMap[key] = value;
        });
        return cookieMap;
    }
    async setCookie(options) {
        try {
            // Safely Encoded Key/Value
            const encodedKey = encode(options.key);
            const encodedValue = encode(options.value);
            // Clean & sanitize options
            const expires = `; expires=${(options.expires || '').replace('expires=', '')}`; // Default is "; expires="
            const path = (options.path || '/').replace('path=', ''); // Default is "path=/"
            const domain = options.url != null && options.url.length > 0
                ? `domain=${options.url}`
                : '';
            document.cookie = `${encodedKey}=${encodedValue || ''}${expires}; path=${path}; ${domain};`;
        }
        catch (error) {
            return Promise.reject(error);
        }
    }
    async deleteCookie(options) {
        try {
            document.cookie = `${options.key}=; Max-Age=0`;
        }
        catch (error) {
            return Promise.reject(error);
        }
    }
    async clearCookies() {
        try {
            const cookies = document.cookie.split(';') || [];
            for (const cookie of cookies) {
                document.cookie = cookie
                    .replace(/^ +/, '')
                    .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
            }
        }
        catch (error) {
            return Promise.reject(error);
        }
    }
    async clearAllCookies() {
        try {
            await this.clearCookies();
        }
        catch (error) {
            return Promise.reject(error);
        }
    }
}
registerPlugin('CapacitorCookies', {
    web: () => new CapacitorCookiesPluginWeb(),
});
// UTILITY FUNCTIONS
/**
 * Read in a Blob value and return it as a base64 string
 * @param blob The blob value to convert to a base64 string
 */
const readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        const base64String = reader.result;
        // remove prefix "data:application/pdf;base64,"
        resolve(base64String.indexOf(',') >= 0
            ? base64String.split(',')[1]
            : base64String);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
});
/**
 * Normalize an HttpHeaders map by lowercasing all of the values
 * @param headers The HttpHeaders object to normalize
 */
const normalizeHttpHeaders = (headers = {}) => {
    const originalKeys = Object.keys(headers);
    const loweredKeys = Object.keys(headers).map(k => k.toLocaleLowerCase());
    const normalized = loweredKeys.reduce((acc, key, index) => {
        acc[key] = headers[originalKeys[index]];
        return acc;
    }, {});
    return normalized;
};
/**
 * Builds a string of url parameters that
 * @param params A map of url parameters
 * @param shouldEncode true if you should encodeURIComponent() the values (true by default)
 */
const buildUrlParams = (params, shouldEncode = true) => {
    if (!params)
        return null;
    const output = Object.entries(params).reduce((accumulator, entry) => {
        const [key, value] = entry;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
            item = '';
            value.forEach(str => {
                encodedValue = shouldEncode ? encodeURIComponent(str) : str;
                item += `${key}=${encodedValue}&`;
            });
            // last character will always be "&" so slice it off
            item.slice(0, -1);
        }
        else {
            encodedValue = shouldEncode ? encodeURIComponent(value) : value;
            item = `${key}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
    }, '');
    // Remove initial "&" from the reduce
    return output.substr(1);
};
/**
 * Build the RequestInit object based on the options passed into the initial request
 * @param options The Http plugin options
 * @param extra Any extra RequestInit values
 */
const buildRequestInit = (options, extra = {}) => {
    const output = Object.assign({ method: options.method || 'GET', headers: options.headers }, extra);
    // Get the content-type
    const headers = normalizeHttpHeaders(options.headers);
    const type = headers['content-type'] || '';
    // If body is already a string, then pass it through as-is.
    if (typeof options.data === 'string') {
        output.body = options.data;
    }
    // Build request initializers based off of content-type
    else if (type.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.data || {})) {
            params.set(key, value);
        }
        output.body = params.toString();
    }
    else if (type.includes('multipart/form-data') ||
        options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
            options.data.forEach((value, key) => {
                form.append(key, value);
            });
        }
        else {
            for (const key of Object.keys(options.data)) {
                form.append(key, options.data[key]);
            }
        }
        output.body = form;
        const headers = new Headers(output.headers);
        headers.delete('content-type'); // content-type will be set by `window.fetch` to includy boundary
        output.headers = headers;
    }
    else if (type.includes('application/json') ||
        typeof options.data === 'object') {
        output.body = JSON.stringify(options.data);
    }
    return output;
};
// WEB IMPLEMENTATION
class CapacitorHttpPluginWeb extends WebPlugin {
    /**
     * Perform an Http request given a set of options
     * @param options Options to build the HTTP request
     */
    async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get('content-type') || '';
        // Default to 'text' responseType so no parsing happens
        let { responseType = 'text' } = response.ok ? options : {};
        // If the response content-type is json, force the response to be json
        if (contentType.includes('application/json')) {
            responseType = 'json';
        }
        let data;
        let blob;
        switch (responseType) {
            case 'arraybuffer':
            case 'blob':
                blob = await response.blob();
                data = await readBlobAsBase64(blob);
                break;
            case 'json':
                data = await response.json();
                break;
            case 'document':
            case 'text':
            default:
                data = await response.text();
        }
        // Convert fetch headers to Capacitor HttpHeaders
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });
        return {
            data,
            headers,
            status: response.status,
            url: response.url,
        };
    }
    /**
     * Perform an Http GET request given a set of options
     * @param options Options to build the HTTP request
     */
    async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: 'GET' }));
    }
    /**
     * Perform an Http POST request given a set of options
     * @param options Options to build the HTTP request
     */
    async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: 'POST' }));
    }
    /**
     * Perform an Http PUT request given a set of options
     * @param options Options to build the HTTP request
     */
    async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: 'PUT' }));
    }
    /**
     * Perform an Http PATCH request given a set of options
     * @param options Options to build the HTTP request
     */
    async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: 'PATCH' }));
    }
    /**
     * Perform an Http DELETE request given a set of options
     * @param options Options to build the HTTP request
     */
    async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: 'DELETE' }));
    }
}
const CapacitorHttp = registerPlugin('CapacitorHttp', {
    web: () => new CapacitorHttpPluginWeb(),
});

const App = registerPlugin('App', {
    web: () => Promise.resolve().then(function () { return web$5; }).then(m => new m.AppWeb()),
});

const Device = registerPlugin('Device', {
    web: () => Promise.resolve().then(function () { return web$4; }).then(m => new m.DeviceWeb()),
});

const Network = registerPlugin('Network', {
    web: () => Promise.resolve().then(function () { return web$3; }).then(m => new m.NetworkWeb()),
});

var Directory;
(function (Directory) {
    /**
     * The Documents directory.
     * On iOS it's the app's documents directory.
     * Use this directory to store user-generated content.
     * On Android it's the Public Documents folder, so it's accessible from other apps.
     * It's not accesible on Android 10 unless the app enables legacy External Storage
     * by adding `android:requestLegacyExternalStorage="true"` in the `application` tag
     * in the `AndroidManifest.xml`.
     * On Android 11 or newer the app can only access the files/folders the app created.
     *
     * @since 1.0.0
     */
    Directory["Documents"] = "DOCUMENTS";
    /**
     * The Data directory.
     * On iOS it will use the Documents directory.
     * On Android it's the directory holding application files.
     * Files will be deleted when the application is uninstalled.
     *
     * @since 1.0.0
     */
    Directory["Data"] = "DATA";
    /**
     * The Library directory.
     * On iOS it will use the Library directory.
     * On Android it's the directory holding application files.
     * Files will be deleted when the application is uninstalled.
     *
     * @since 1.1.0
     */
    Directory["Library"] = "LIBRARY";
    /**
     * The Cache directory.
     * Can be deleted in cases of low memory, so use this directory to write app-specific files.
     * that your app can re-create easily.
     *
     * @since 1.0.0
     */
    Directory["Cache"] = "CACHE";
    /**
     * The external directory.
     * On iOS it will use the Documents directory.
     * On Android it's the directory on the primary shared/external
     * storage device where the application can place persistent files it owns.
     * These files are internal to the applications, and not typically visible
     * to the user as media.
     * Files will be deleted when the application is uninstalled.
     *
     * @since 1.0.0
     */
    Directory["External"] = "EXTERNAL";
    /**
     * The external storage directory.
     * On iOS it will use the Documents directory.
     * On Android it's the primary shared/external storage directory.
     * It's not accesible on Android 10 unless the app enables legacy External Storage
     * by adding `android:requestLegacyExternalStorage="true"` in the `application` tag
     * in the `AndroidManifest.xml`.
     * It's not accesible on Android 11 or newer.
     *
     * @since 1.0.0
     */
    Directory["ExternalStorage"] = "EXTERNAL_STORAGE";
})(Directory || (Directory = {}));
var Encoding;
(function (Encoding) {
    /**
     * Eight-bit UCS Transformation Format
     *
     * @since 1.0.0
     */
    Encoding["UTF8"] = "utf8";
    /**
     * Seven-bit ASCII, a.k.a. ISO646-US, a.k.a. the Basic Latin block of the
     * Unicode character set
     * This encoding is only supported on Android.
     *
     * @since 1.0.0
     */
    Encoding["ASCII"] = "ascii";
    /**
     * Sixteen-bit UCS Transformation Format, byte order identified by an
     * optional byte-order mark
     * This encoding is only supported on Android.
     *
     * @since 1.0.0
     */
    Encoding["UTF16"] = "utf16";
})(Encoding || (Encoding = {}));

const Filesystem = registerPlugin('Filesystem', {
    web: () => Promise.resolve().then(function () { return web$2; }).then(m => new m.FilesystemWeb()),
});

const Preferences = registerPlugin('Preferences', {
    web: () => Promise.resolve().then(function () { return web$1; }).then(m => new m.PreferencesWeb()),
});

var Style;
(function (Style) {
    /**
     * Light text for dark backgrounds.
     *
     * @since 1.0.0
     */
    Style["Dark"] = "DARK";
    /**
     * Dark text for light backgrounds.
     *
     * @since 1.0.0
     */
    Style["Light"] = "LIGHT";
    /**
     * The style is based on the device appearance.
     * If the device is using Dark mode, the statusbar text will be light.
     * If the device is using Light mode, the statusbar text will be dark.
     * On Android the default will be the one the app was launched with.
     *
     * @since 1.0.0
     */
    Style["Default"] = "DEFAULT";
})(Style || (Style = {}));
var Animation;
(function (Animation) {
    /**
     * No animation during show/hide.
     *
     * @since 1.0.0
     */
    Animation["None"] = "NONE";
    /**
     * Slide animation during show/hide.
     * It doesn't work on iOS 15+.
     *
     * @deprecated Use Animation.Fade or Animation.None instead.
     *
     * @since 1.0.0
     */
    Animation["Slide"] = "SLIDE";
    /**
     * Fade animation during show/hide.
     *
     * @since 1.0.0
     */
    Animation["Fade"] = "FADE";
})(Animation || (Animation = {}));

const StatusBar = registerPlugin('StatusBar');

const SplashScreen = registerPlugin('SplashScreen', {
    web: () => Promise.resolve().then(function () { return web; }).then(m => new m.SplashScreenWeb()),
});

/**
 * eCLESS Player Mobile - Capacitor Core Module
 * 
 * This module initializes and exposes Capacitor plugins as a unified API
 * for the mobile version of eCLESS Player. It replaces Electron's native APIs
 * with Capacitor equivalents for cross-platform mobile support.
 * 
 * @module capacitor-core
 */


console.log('=== CAPACITOR CORE: Initializing ===');

/**
 * Capacitor API Wrapper
 * Provides a unified interface for mobile-specific functionality
 */
class CapacitorAPI {
    constructor() {
        this.platform = Capacitor.getPlatform();
        this.isNative = Capacitor.isNativePlatform();
        this.plugins = {
            App,
            Device,
            Network,
            Filesystem,
            Preferences,
            StatusBar,
            SplashScreen,
            CapacitorHttp
        };
        
        console.log(`eCLESS Mobile: Running on ${this.platform} (native: ${this.isNative})`);
    }

    /**
     * Get device information including unique identifiers
     */
    async getDeviceInfo() {
        try {
            const info = await Device.getInfo();
            const id = await Device.getId();
            const batteryInfo = await Device.getBatteryInfo();
            
            return {
                ...info,
                uuid: id.identifier || id.uuid,
                identifier: id.identifier || id.uuid,
                androidId: info.androidId || null,
                battery: batteryInfo,
                platform: this.platform,
                isNative: this.isNative
            };
        } catch (error) {
            console.error('Failed to get device info:', error);
            // Return fallback info
            return {
                uuid: null,
                identifier: null,
                androidId: null,
                platform: this.platform,
                model: 'Unknown',
                manufacturer: 'Unknown',
                isNative: this.isNative,
                battery: null
            };
        }
    }

    /**
     * Get network status
     */
    async getNetworkStatus() {
        try {
            return await Network.getStatus();
        } catch (error) {
            console.error('Failed to get network status:', error);
            return { connected: false, connectionType: 'unknown' };
        }
    }

    /**
     * Listen for network changes
     */
    addNetworkListener(callback) {
        return Network.addListener('networkStatusChange', callback);
    }

    /**
     * Read file from device storage
     */
    async readFile(path, directory = Directory.Data) {
        try {
            // Use DATA directory by default for app-private storage (no permissions needed)
            const targetDir = directory || Directory.Data;
            const result = await Filesystem.readFile({
                path,
                directory: targetDir,
                encoding: Encoding.UTF8
            });
            return result.data;
        } catch (error) {
            console.error(`Failed to read file ${path} from ${directory}:`, error);
            throw error;
        }
    }

    /**
     * Write file to device storage
     */
    async writeFile(path, data, directory = Directory.Data) {
        try {
            // Use DATA directory by default for app-private storage (no permissions needed)
            const targetDir = directory || Directory.Data;
            
            console.log(`Writing file to ${targetDir}: ${path}`);
            
            await Filesystem.writeFile({
                path,
                data,
                directory: targetDir,
                encoding: Encoding.UTF8,
                recursive: true
            });
            
            console.log(`Successfully wrote file to ${targetDir}: ${path}`);
            return true;
        } catch (error) {
            console.error(`Failed to write file ${path} to ${directory}:`, error);
            console.error('Error details:', error.message, error.code);
            throw error;
        }
    }

    /**
     * Check if file exists
     */
    async fileExists(path, directory = Directory.Data) {
        try {
            const targetDir = directory || Directory.Data;
            await Filesystem.stat({
                path,
                directory: targetDir
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(path, directory = Directory.Data) {
        try {
            const targetDir = directory || Directory.Data;
            await Filesystem.deleteFile({
                path,
                directory: targetDir
            });
            return true;
        } catch (error) {
            console.error(`Failed to delete file ${path}:`, error);
            throw error;
        }
    }

    /**
     * Create directory
     */
    async createDirectory(path, directory = Directory.Data) {
        try {
            const targetDir = directory || Directory.Data;
            await Filesystem.mkdir({
                path,
                directory: targetDir,
                recursive: true
            });
            return true;
        } catch (error) {
            console.error(`Failed to create directory ${path}:`, error);
            throw error;
        }
    }

    /**
     * List directory contents
     */
    async readDirectory(path, directory = Directory.Data) {
        try {
            const targetDir = directory || Directory.Data;
            const result = await Filesystem.readdir({
                path,
                directory: targetDir
            });
            return result.files;
        } catch (error) {
            console.error(`Failed to read directory ${path}:`, error);
            throw error;
        }
    }

    /**
     * Get/Set preferences (key-value storage)
     */
    async getPreference(key) {
        try {
            const { value } = await Preferences.get({ key });
            return value;
        } catch (error) {
            console.error(`Failed to get preference ${key}:`, error);
            return null;
        }
    }

    async setPreference(key, value) {
        try {
            await Preferences.set({ key, value });
            return true;
        } catch (error) {
            console.error(`Failed to set preference ${key}:`, error);
            return false;
        }
    }

    async removePreference(key) {
        try {
            await Preferences.remove({ key });
            return true;
        } catch (error) {
            console.error(`Failed to remove preference ${key}:`, error);
            return false;
        }
    }

    /**
     * App lifecycle methods
     */
    addAppStateListener(callback) {
        return App.addListener('appStateChange', callback);
    }

    addAppUrlListener(callback) {
        return App.addListener('appUrlOpen', callback);
    }

    addBackButtonListener(callback) {
        return App.addListener('backButton', callback);
    }

    async exitApp() {
        if (this.isNative) {
            await App.exitApp();
        }
    }

    /**
     * Screen orientation (using CSS approach for Capacitor 6)
     * For Capacitor 8+, install @capacitor/screen-orientation plugin
     */
    async lockOrientation(orientation = 'landscape') {
        try {
            // Use CSS orientation lock for Capacitor 6
            // Set in capacitor.config.json or AndroidManifest.xml/Info.plist
            console.log(`Screen orientation lock to ${orientation} should be configured in capacitor.config.json`);
            
            // Add CSS media query support
            const style = document.createElement('style');
            style.textContent = `
                @media screen and (orientation: portrait) {
                    html { transform: rotate(-90deg); transform-origin: left top; width: 100vh; height: 100vw; overflow-x: hidden; position: absolute; top: 100%; left: 0; }
                }
            `;
            document.head.appendChild(style);
        } catch (error) {
            console.warn('Failed to lock orientation:', error);
        }
    }

    async unlockOrientation() {
        console.log('Orientation unlock - remove any custom CSS transforms');
    }

    /**
     * Status bar control
     */
    async hideStatusBar() {
        try {
            await StatusBar.hide();
        } catch (error) {
            console.warn('Failed to hide status bar:', error);
        }
    }

    async showStatusBar() {
        try {
            await StatusBar.show();
        } catch (error) {
            console.warn('Failed to show status bar:', error);
        }
    }

    async setStatusBarStyle(style = Style.Dark) {
        try {
            await StatusBar.setStyle({ style });
        } catch (error) {
            console.warn('Failed to set status bar style:', error);
        }
    }

    /**
     * Splash screen
     */
    async hideSplashScreen() {
        try {
            await SplashScreen.hide();
        } catch (error) {
            console.warn('Failed to hide splash screen:', error);
        }
    }
}

// Initialize and expose global Capacitor API
const capacitorAPI = new CapacitorAPI();

// Add Directory enum to capacitorAPI for easy access
capacitorAPI.Directory = Directory;

// Make it globally accessible
window.capacitor = Capacitor;
window.capacitorAPI = capacitorAPI;
window.CapacitorDirectory = Directory; // Also expose Directory enum globally

// Mobile-specific initialization
(async function initMobile() {
    console.log('=== CAPACITOR CORE: Mobile initialization started ===');

    try {
        // Get device info
        const deviceInfo = await capacitorAPI.getDeviceInfo();
        console.log('Device Info:', deviceInfo);

        // Get network status
        const networkStatus = await capacitorAPI.getNetworkStatus();
        console.log('Network Status:', networkStatus);

        // Set up network monitoring
        capacitorAPI.addNetworkListener((status) => {
            console.log('Network status changed:', status);
            
            // Dispatch custom event for app to handle
            window.dispatchEvent(new CustomEvent('networkStatusChange', {
                detail: status
            }));
        });

        // Hide splash screen after initialization
        await capacitorAPI.hideSplashScreen();

        // Set status bar style for dark theme
        await capacitorAPI.setStatusBarStyle(Style.Dark);

        // Handle back button for Android
        if (capacitorAPI.platform === 'android') {
            capacitorAPI.addBackButtonListener((event) => {
                console.log('Back button pressed');
                
                // Check if we can go back in history
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    // Exit app or show exit confirmation
                    const shouldExit = confirm('Exit eCLESS Player?');
                    if (shouldExit) {
                        capacitorAPI.exitApp();
                    }
                }
            });
        }

        console.log('=== CAPACITOR CORE: Initialization complete ===');

        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('capacitorReady', {
            detail: {
                platform: capacitorAPI.platform,
                isNative: capacitorAPI.isNative,
                deviceInfo,
                networkStatus
            }
        }));

    } catch (error) {
        console.error('Mobile initialization error:', error);
    }
})();

class AppWeb extends WebPlugin {
    constructor() {
        super();
        this.handleVisibilityChange = () => {
            const data = {
                isActive: document.hidden !== true,
            };
            this.notifyListeners('appStateChange', data);
            if (document.hidden) {
                this.notifyListeners('pause', null);
            }
            else {
                this.notifyListeners('resume', null);
            }
        };
        document.addEventListener('visibilitychange', this.handleVisibilityChange, false);
    }
    exitApp() {
        throw this.unimplemented('Not implemented on web.');
    }
    async getInfo() {
        throw this.unimplemented('Not implemented on web.');
    }
    async getLaunchUrl() {
        return { url: '' };
    }
    async getState() {
        return { isActive: document.hidden !== true };
    }
    async minimizeApp() {
        throw this.unimplemented('Not implemented on web.');
    }
}

var web$5 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    AppWeb: AppWeb
});

class DeviceWeb extends WebPlugin {
    async getId() {
        return {
            identifier: this.getUid(),
        };
    }
    async getInfo() {
        if (typeof navigator === 'undefined' || !navigator.userAgent) {
            throw this.unavailable('Device API not available in this browser');
        }
        const ua = navigator.userAgent;
        const uaFields = this.parseUa(ua);
        return {
            model: uaFields.model,
            platform: 'web',
            operatingSystem: uaFields.operatingSystem,
            osVersion: uaFields.osVersion,
            manufacturer: navigator.vendor,
            isVirtual: false,
            webViewVersion: uaFields.browserVersion,
        };
    }
    async getBatteryInfo() {
        if (typeof navigator === 'undefined' || !navigator.getBattery) {
            throw this.unavailable('Device API not available in this browser');
        }
        let battery = {};
        try {
            battery = await navigator.getBattery();
        }
        catch (e) {
            // Let it fail, we don't care
        }
        return {
            batteryLevel: battery.level,
            isCharging: battery.charging,
        };
    }
    async getLanguageCode() {
        return {
            value: navigator.language.split('-')[0].toLowerCase(),
        };
    }
    async getLanguageTag() {
        return {
            value: navigator.language,
        };
    }
    parseUa(ua) {
        const uaFields = {};
        const start = ua.indexOf('(') + 1;
        let end = ua.indexOf(') AppleWebKit');
        if (ua.indexOf(') Gecko') !== -1) {
            end = ua.indexOf(') Gecko');
        }
        const fields = ua.substring(start, end);
        if (ua.indexOf('Android') !== -1) {
            const tmpFields = fields.replace('; wv', '').split('; ').pop();
            if (tmpFields) {
                uaFields.model = tmpFields.split(' Build')[0];
            }
            uaFields.osVersion = fields.split('; ')[1];
        }
        else {
            uaFields.model = fields.split('; ')[0];
            if (typeof navigator !== 'undefined' && navigator.oscpu) {
                uaFields.osVersion = navigator.oscpu;
            }
            else {
                if (ua.indexOf('Windows') !== -1) {
                    uaFields.osVersion = fields;
                }
                else {
                    const tmpFields = fields.split('; ').pop();
                    if (tmpFields) {
                        const lastParts = tmpFields
                            .replace(' like Mac OS X', '')
                            .split(' ');
                        uaFields.osVersion = lastParts[lastParts.length - 1].replace(/_/g, '.');
                    }
                }
            }
        }
        if (/android/i.test(ua)) {
            uaFields.operatingSystem = 'android';
        }
        else if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
            uaFields.operatingSystem = 'ios';
        }
        else if (/Win/.test(ua)) {
            uaFields.operatingSystem = 'windows';
        }
        else if (/Mac/i.test(ua)) {
            uaFields.operatingSystem = 'mac';
        }
        else {
            uaFields.operatingSystem = 'unknown';
        }
        // Check for browsers based on non-standard javascript apis, only not user agent
        const isSafari = !!window.ApplePaySession;
        const isChrome = !!window.chrome;
        const isFirefox = /Firefox/.test(ua);
        const isEdge = /Edg/.test(ua);
        const isFirefoxIOS = /FxiOS/.test(ua);
        const isChromeIOS = /CriOS/.test(ua);
        const isEdgeIOS = /EdgiOS/.test(ua);
        // FF and Edge User Agents both end with "/MAJOR.MINOR"
        if (isSafari ||
            (isChrome && !isEdge) ||
            isFirefoxIOS ||
            isChromeIOS ||
            isEdgeIOS) {
            // Safari version comes as     "... Version/MAJOR.MINOR ..."
            // Chrome version comes as     "... Chrome/MAJOR.MINOR ..."
            // FirefoxIOS version comes as "... FxiOS/MAJOR.MINOR ..."
            // ChromeIOS version comes as  "... CriOS/MAJOR.MINOR ..."
            let searchWord;
            if (isFirefoxIOS) {
                searchWord = 'FxiOS';
            }
            else if (isChromeIOS) {
                searchWord = 'CriOS';
            }
            else if (isEdgeIOS) {
                searchWord = 'EdgiOS';
            }
            else if (isSafari) {
                searchWord = 'Version';
            }
            else {
                searchWord = 'Chrome';
            }
            const words = ua.split(' ');
            for (const word of words) {
                if (word.includes(searchWord)) {
                    const version = word.split('/')[1];
                    uaFields.browserVersion = version;
                }
            }
        }
        else if (isFirefox || isEdge) {
            const reverseUA = ua.split('').reverse().join('');
            const reverseVersion = reverseUA.split('/')[0];
            const version = reverseVersion.split('').reverse().join('');
            uaFields.browserVersion = version;
        }
        return uaFields;
    }
    getUid() {
        if (typeof window !== 'undefined' && window.localStorage) {
            let uid = window.localStorage.getItem('_capuid');
            if (uid) {
                return uid;
            }
            uid = this.uuid4();
            window.localStorage.setItem('_capuid', uid);
            return uid;
        }
        return this.uuid4();
    }
    uuid4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
}

var web$4 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    DeviceWeb: DeviceWeb
});

function translatedConnection() {
    const connection = window.navigator.connection ||
        window.navigator.mozConnection ||
        window.navigator.webkitConnection;
    let result = 'unknown';
    const type = connection ? connection.type || connection.effectiveType : null;
    if (type && typeof type === 'string') {
        switch (type) {
            // possible type values
            case 'bluetooth':
            case 'cellular':
                result = 'cellular';
                break;
            case 'none':
                result = 'none';
                break;
            case 'ethernet':
            case 'wifi':
            case 'wimax':
                result = 'wifi';
                break;
            case 'other':
            case 'unknown':
                result = 'unknown';
                break;
            // possible effectiveType values
            case 'slow-2g':
            case '2g':
            case '3g':
                result = 'cellular';
                break;
            case '4g':
                result = 'wifi';
                break;
        }
    }
    return result;
}
class NetworkWeb extends WebPlugin {
    constructor() {
        super();
        this.handleOnline = () => {
            const connectionType = translatedConnection();
            const status = {
                connected: true,
                connectionType: connectionType,
            };
            this.notifyListeners('networkStatusChange', status);
        };
        this.handleOffline = () => {
            const status = {
                connected: false,
                connectionType: 'none',
            };
            this.notifyListeners('networkStatusChange', status);
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.handleOnline);
            window.addEventListener('offline', this.handleOffline);
        }
    }
    async getStatus() {
        if (!window.navigator) {
            throw this.unavailable('Browser does not support the Network Information API');
        }
        const connected = window.navigator.onLine;
        const connectionType = translatedConnection();
        const status = {
            connected,
            connectionType: connected ? connectionType : 'none',
        };
        return status;
    }
}
new NetworkWeb();

var web$3 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    NetworkWeb: NetworkWeb
});

function resolve(path) {
    const posix = path.split('/').filter(item => item !== '.');
    const newPosix = [];
    posix.forEach(item => {
        if (item === '..' &&
            newPosix.length > 0 &&
            newPosix[newPosix.length - 1] !== '..') {
            newPosix.pop();
        }
        else {
            newPosix.push(item);
        }
    });
    return newPosix.join('/');
}
function isPathParent(parent, children) {
    parent = resolve(parent);
    children = resolve(children);
    const pathsA = parent.split('/');
    const pathsB = children.split('/');
    return (parent !== children &&
        pathsA.every((value, index) => value === pathsB[index]));
}
class FilesystemWeb extends WebPlugin {
    constructor() {
        super(...arguments);
        this.DB_VERSION = 1;
        this.DB_NAME = 'Disc';
        this._writeCmds = ['add', 'put', 'delete'];
        /**
         * Function that performs a http request to a server and downloads the file to the specified destination
         *
         * @param options the options for the download operation
         * @returns a promise that resolves with the download file result
         */
        this.downloadFile = async (options) => {
            var _a, _b;
            const requestInit = buildRequestInit(options, options.webFetchExtra);
            const response = await fetch(options.url, requestInit);
            let blob;
            if (!options.progress)
                blob = await response.blob();
            else if (!(response === null || response === void 0 ? void 0 : response.body))
                blob = new Blob();
            else {
                const reader = response.body.getReader();
                let bytes = 0;
                const chunks = [];
                const contentType = response.headers.get('content-type');
                const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    chunks.push(value);
                    bytes += (value === null || value === void 0 ? void 0 : value.length) || 0;
                    const status = {
                        url: options.url,
                        bytes,
                        contentLength,
                    };
                    this.notifyListeners('progress', status);
                }
                const allChunks = new Uint8Array(bytes);
                let position = 0;
                for (const chunk of chunks) {
                    if (typeof chunk === 'undefined')
                        continue;
                    allChunks.set(chunk, position);
                    position += chunk.length;
                }
                blob = new Blob([allChunks.buffer], { type: contentType || undefined });
            }
            const result = await this.writeFile({
                path: options.path,
                directory: (_a = options.directory) !== null && _a !== void 0 ? _a : undefined,
                recursive: (_b = options.recursive) !== null && _b !== void 0 ? _b : false,
                data: blob,
            });
            return { path: result.uri, blob };
        };
    }
    async initDb() {
        if (this._db !== undefined) {
            return this._db;
        }
        if (!('indexedDB' in window)) {
            throw this.unavailable("This browser doesn't support IndexedDB");
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onupgradeneeded = FilesystemWeb.doUpgrade;
            request.onsuccess = () => {
                this._db = request.result;
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                console.warn('db blocked');
            };
        });
    }
    static doUpgrade(event) {
        const eventTarget = event.target;
        const db = eventTarget.result;
        switch (event.oldVersion) {
            case 0:
            case 1:
            default: {
                if (db.objectStoreNames.contains('FileStorage')) {
                    db.deleteObjectStore('FileStorage');
                }
                const store = db.createObjectStore('FileStorage', { keyPath: 'path' });
                store.createIndex('by_folder', 'folder');
            }
        }
    }
    async dbRequest(cmd, args) {
        const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? 'readwrite' : 'readonly';
        return this.initDb().then((conn) => {
            return new Promise((resolve, reject) => {
                const tx = conn.transaction(['FileStorage'], readFlag);
                const store = tx.objectStore('FileStorage');
                const req = store[cmd](...args);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        });
    }
    async dbIndexRequest(indexName, cmd, args) {
        const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? 'readwrite' : 'readonly';
        return this.initDb().then((conn) => {
            return new Promise((resolve, reject) => {
                const tx = conn.transaction(['FileStorage'], readFlag);
                const store = tx.objectStore('FileStorage');
                const index = store.index(indexName);
                const req = index[cmd](...args);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        });
    }
    getPath(directory, uriPath) {
        const cleanedUriPath = uriPath !== undefined ? uriPath.replace(/^[/]+|[/]+$/g, '') : '';
        let fsPath = '';
        if (directory !== undefined)
            fsPath += '/' + directory;
        if (uriPath !== '')
            fsPath += '/' + cleanedUriPath;
        return fsPath;
    }
    async clear() {
        const conn = await this.initDb();
        const tx = conn.transaction(['FileStorage'], 'readwrite');
        const store = tx.objectStore('FileStorage');
        store.clear();
    }
    /**
     * Read a file from disk
     * @param options options for the file read
     * @return a promise that resolves with the read file data result
     */
    async readFile(options) {
        const path = this.getPath(options.directory, options.path);
        // const encoding = options.encoding;
        const entry = (await this.dbRequest('get', [path]));
        if (entry === undefined)
            throw Error('File does not exist.');
        return { data: entry.content ? entry.content : '' };
    }
    /**
     * Write a file to disk in the specified location on device
     * @param options options for the file write
     * @return a promise that resolves with the file write result
     */
    async writeFile(options) {
        const path = this.getPath(options.directory, options.path);
        let data = options.data;
        const encoding = options.encoding;
        const doRecursive = options.recursive;
        const occupiedEntry = (await this.dbRequest('get', [path]));
        if (occupiedEntry && occupiedEntry.type === 'directory')
            throw Error('The supplied path is a directory.');
        const parentPath = path.substr(0, path.lastIndexOf('/'));
        const parentEntry = (await this.dbRequest('get', [parentPath]));
        if (parentEntry === undefined) {
            const subDirIndex = parentPath.indexOf('/', 1);
            if (subDirIndex !== -1) {
                const parentArgPath = parentPath.substr(subDirIndex);
                await this.mkdir({
                    path: parentArgPath,
                    directory: options.directory,
                    recursive: doRecursive,
                });
            }
        }
        if (!encoding && !(data instanceof Blob)) {
            data = data.indexOf(',') >= 0 ? data.split(',')[1] : data;
            if (!this.isBase64String(data))
                throw Error('The supplied data is not valid base64 content.');
        }
        const now = Date.now();
        const pathObj = {
            path: path,
            folder: parentPath,
            type: 'file',
            size: data instanceof Blob ? data.size : data.length,
            ctime: now,
            mtime: now,
            content: data,
        };
        await this.dbRequest('put', [pathObj]);
        return {
            uri: pathObj.path,
        };
    }
    /**
     * Append to a file on disk in the specified location on device
     * @param options options for the file append
     * @return a promise that resolves with the file write result
     */
    async appendFile(options) {
        const path = this.getPath(options.directory, options.path);
        let data = options.data;
        const encoding = options.encoding;
        const parentPath = path.substr(0, path.lastIndexOf('/'));
        const now = Date.now();
        let ctime = now;
        const occupiedEntry = (await this.dbRequest('get', [path]));
        if (occupiedEntry && occupiedEntry.type === 'directory')
            throw Error('The supplied path is a directory.');
        const parentEntry = (await this.dbRequest('get', [parentPath]));
        if (parentEntry === undefined) {
            const subDirIndex = parentPath.indexOf('/', 1);
            if (subDirIndex !== -1) {
                const parentArgPath = parentPath.substr(subDirIndex);
                await this.mkdir({
                    path: parentArgPath,
                    directory: options.directory,
                    recursive: true,
                });
            }
        }
        if (!encoding && !this.isBase64String(data))
            throw Error('The supplied data is not valid base64 content.');
        if (occupiedEntry !== undefined) {
            if (occupiedEntry.content instanceof Blob) {
                throw Error('The occupied entry contains a Blob object which cannot be appended to.');
            }
            if (occupiedEntry.content !== undefined && !encoding) {
                data = btoa(atob(occupiedEntry.content) + atob(data));
            }
            else {
                data = occupiedEntry.content + data;
            }
            ctime = occupiedEntry.ctime;
        }
        const pathObj = {
            path: path,
            folder: parentPath,
            type: 'file',
            size: data.length,
            ctime: ctime,
            mtime: now,
            content: data,
        };
        await this.dbRequest('put', [pathObj]);
    }
    /**
     * Delete a file from disk
     * @param options options for the file delete
     * @return a promise that resolves with the deleted file data result
     */
    async deleteFile(options) {
        const path = this.getPath(options.directory, options.path);
        const entry = (await this.dbRequest('get', [path]));
        if (entry === undefined)
            throw Error('File does not exist.');
        const entries = await this.dbIndexRequest('by_folder', 'getAllKeys', [
            IDBKeyRange.only(path),
        ]);
        if (entries.length !== 0)
            throw Error('Folder is not empty.');
        await this.dbRequest('delete', [path]);
    }
    /**
     * Create a directory.
     * @param options options for the mkdir
     * @return a promise that resolves with the mkdir result
     */
    async mkdir(options) {
        const path = this.getPath(options.directory, options.path);
        const doRecursive = options.recursive;
        const parentPath = path.substr(0, path.lastIndexOf('/'));
        const depth = (path.match(/\//g) || []).length;
        const parentEntry = (await this.dbRequest('get', [parentPath]));
        const occupiedEntry = (await this.dbRequest('get', [path]));
        if (depth === 1)
            throw Error('Cannot create Root directory');
        if (occupiedEntry !== undefined)
            throw Error('Current directory does already exist.');
        if (!doRecursive && depth !== 2 && parentEntry === undefined)
            throw Error('Parent directory must exist');
        if (doRecursive && depth !== 2 && parentEntry === undefined) {
            const parentArgPath = parentPath.substr(parentPath.indexOf('/', 1));
            await this.mkdir({
                path: parentArgPath,
                directory: options.directory,
                recursive: doRecursive,
            });
        }
        const now = Date.now();
        const pathObj = {
            path: path,
            folder: parentPath,
            type: 'directory',
            size: 0,
            ctime: now,
            mtime: now,
        };
        await this.dbRequest('put', [pathObj]);
    }
    /**
     * Remove a directory
     * @param options the options for the directory remove
     */
    async rmdir(options) {
        const { path, directory, recursive } = options;
        const fullPath = this.getPath(directory, path);
        const entry = (await this.dbRequest('get', [fullPath]));
        if (entry === undefined)
            throw Error('Folder does not exist.');
        if (entry.type !== 'directory')
            throw Error('Requested path is not a directory');
        const readDirResult = await this.readdir({ path, directory });
        if (readDirResult.files.length !== 0 && !recursive)
            throw Error('Folder is not empty');
        for (const entry of readDirResult.files) {
            const entryPath = `${path}/${entry.name}`;
            const entryObj = await this.stat({ path: entryPath, directory });
            if (entryObj.type === 'file') {
                await this.deleteFile({ path: entryPath, directory });
            }
            else {
                await this.rmdir({ path: entryPath, directory, recursive });
            }
        }
        await this.dbRequest('delete', [fullPath]);
    }
    /**
     * Return a list of files from the directory (not recursive)
     * @param options the options for the readdir operation
     * @return a promise that resolves with the readdir directory listing result
     */
    async readdir(options) {
        const path = this.getPath(options.directory, options.path);
        const entry = (await this.dbRequest('get', [path]));
        if (options.path !== '' && entry === undefined)
            throw Error('Folder does not exist.');
        const entries = await this.dbIndexRequest('by_folder', 'getAllKeys', [IDBKeyRange.only(path)]);
        const files = await Promise.all(entries.map(async (e) => {
            let subEntry = (await this.dbRequest('get', [e]));
            if (subEntry === undefined) {
                subEntry = (await this.dbRequest('get', [e + '/']));
            }
            return {
                name: e.substring(path.length + 1),
                type: subEntry.type,
                size: subEntry.size,
                ctime: subEntry.ctime,
                mtime: subEntry.mtime,
                uri: subEntry.path,
            };
        }));
        return { files: files };
    }
    /**
     * Return full File URI for a path and directory
     * @param options the options for the stat operation
     * @return a promise that resolves with the file stat result
     */
    async getUri(options) {
        const path = this.getPath(options.directory, options.path);
        let entry = (await this.dbRequest('get', [path]));
        if (entry === undefined) {
            entry = (await this.dbRequest('get', [path + '/']));
        }
        return {
            uri: (entry === null || entry === void 0 ? void 0 : entry.path) || path,
        };
    }
    /**
     * Return data about a file
     * @param options the options for the stat operation
     * @return a promise that resolves with the file stat result
     */
    async stat(options) {
        const path = this.getPath(options.directory, options.path);
        let entry = (await this.dbRequest('get', [path]));
        if (entry === undefined) {
            entry = (await this.dbRequest('get', [path + '/']));
        }
        if (entry === undefined)
            throw Error('Entry does not exist.');
        return {
            type: entry.type,
            size: entry.size,
            ctime: entry.ctime,
            mtime: entry.mtime,
            uri: entry.path,
        };
    }
    /**
     * Rename a file or directory
     * @param options the options for the rename operation
     * @return a promise that resolves with the rename result
     */
    async rename(options) {
        await this._copy(options, true);
        return;
    }
    /**
     * Copy a file or directory
     * @param options the options for the copy operation
     * @return a promise that resolves with the copy result
     */
    async copy(options) {
        return this._copy(options, false);
    }
    async requestPermissions() {
        return { publicStorage: 'granted' };
    }
    async checkPermissions() {
        return { publicStorage: 'granted' };
    }
    /**
     * Function that can perform a copy or a rename
     * @param options the options for the rename operation
     * @param doRename whether to perform a rename or copy operation
     * @return a promise that resolves with the result
     */
    async _copy(options, doRename = false) {
        let { toDirectory } = options;
        const { to, from, directory: fromDirectory } = options;
        if (!to || !from) {
            throw Error('Both to and from must be provided');
        }
        // If no "to" directory is provided, use the "from" directory
        if (!toDirectory) {
            toDirectory = fromDirectory;
        }
        const fromPath = this.getPath(fromDirectory, from);
        const toPath = this.getPath(toDirectory, to);
        // Test that the "to" and "from" locations are different
        if (fromPath === toPath) {
            return {
                uri: toPath,
            };
        }
        if (isPathParent(fromPath, toPath)) {
            throw Error('To path cannot contain the from path');
        }
        // Check the state of the "to" location
        let toObj;
        try {
            toObj = await this.stat({
                path: to,
                directory: toDirectory,
            });
        }
        catch (e) {
            // To location does not exist, ensure the directory containing "to" location exists and is a directory
            const toPathComponents = to.split('/');
            toPathComponents.pop();
            const toPath = toPathComponents.join('/');
            // Check the containing directory of the "to" location exists
            if (toPathComponents.length > 0) {
                const toParentDirectory = await this.stat({
                    path: toPath,
                    directory: toDirectory,
                });
                if (toParentDirectory.type !== 'directory') {
                    throw new Error('Parent directory of the to path is a file');
                }
            }
        }
        // Cannot overwrite a directory
        if (toObj && toObj.type === 'directory') {
            throw new Error('Cannot overwrite a directory with a file');
        }
        // Ensure the "from" object exists
        const fromObj = await this.stat({
            path: from,
            directory: fromDirectory,
        });
        // Set the mtime/ctime of the supplied path
        const updateTime = async (path, ctime, mtime) => {
            const fullPath = this.getPath(toDirectory, path);
            const entry = (await this.dbRequest('get', [fullPath]));
            entry.ctime = ctime;
            entry.mtime = mtime;
            await this.dbRequest('put', [entry]);
        };
        const ctime = fromObj.ctime ? fromObj.ctime : Date.now();
        switch (fromObj.type) {
            // The "from" object is a file
            case 'file': {
                // Read the file
                const file = await this.readFile({
                    path: from,
                    directory: fromDirectory,
                });
                // Optionally remove the file
                if (doRename) {
                    await this.deleteFile({
                        path: from,
                        directory: fromDirectory,
                    });
                }
                let encoding;
                if (!(file.data instanceof Blob) && !this.isBase64String(file.data)) {
                    encoding = Encoding.UTF8;
                }
                // Write the file to the new location
                const writeResult = await this.writeFile({
                    path: to,
                    directory: toDirectory,
                    data: file.data,
                    encoding: encoding,
                });
                // Copy the mtime/ctime of a renamed file
                if (doRename) {
                    await updateTime(to, ctime, fromObj.mtime);
                }
                // Resolve promise
                return writeResult;
            }
            case 'directory': {
                if (toObj) {
                    throw Error('Cannot move a directory over an existing object');
                }
                try {
                    // Create the to directory
                    await this.mkdir({
                        path: to,
                        directory: toDirectory,
                        recursive: false,
                    });
                    // Copy the mtime/ctime of a renamed directory
                    if (doRename) {
                        await updateTime(to, ctime, fromObj.mtime);
                    }
                }
                catch (e) {
                    // ignore
                }
                // Iterate over the contents of the from location
                const contents = (await this.readdir({
                    path: from,
                    directory: fromDirectory,
                })).files;
                for (const filename of contents) {
                    // Move item from the from directory to the to directory
                    await this._copy({
                        from: `${from}/${filename.name}`,
                        to: `${to}/${filename.name}`,
                        directory: fromDirectory,
                        toDirectory,
                    }, doRename);
                }
                // Optionally remove the original from directory
                if (doRename) {
                    await this.rmdir({
                        path: from,
                        directory: fromDirectory,
                    });
                }
            }
        }
        return {
            uri: toPath,
        };
    }
    isBase64String(str) {
        try {
            return btoa(atob(str)) == str;
        }
        catch (err) {
            return false;
        }
    }
}
FilesystemWeb._debug = true;

var web$2 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    FilesystemWeb: FilesystemWeb
});

class PreferencesWeb extends WebPlugin {
    constructor() {
        super(...arguments);
        this.group = 'CapacitorStorage';
    }
    async configure({ group }) {
        if (typeof group === 'string') {
            this.group = group;
        }
    }
    async get(options) {
        const value = this.impl.getItem(this.applyPrefix(options.key));
        return { value };
    }
    async set(options) {
        this.impl.setItem(this.applyPrefix(options.key), options.value);
    }
    async remove(options) {
        this.impl.removeItem(this.applyPrefix(options.key));
    }
    async keys() {
        const keys = this.rawKeys().map(k => k.substring(this.prefix.length));
        return { keys };
    }
    async clear() {
        for (const key of this.rawKeys()) {
            this.impl.removeItem(key);
        }
    }
    async migrate() {
        var _a;
        const migrated = [];
        const existing = [];
        const oldprefix = '_cap_';
        const keys = Object.keys(this.impl).filter(k => k.indexOf(oldprefix) === 0);
        for (const oldkey of keys) {
            const key = oldkey.substring(oldprefix.length);
            const value = (_a = this.impl.getItem(oldkey)) !== null && _a !== void 0 ? _a : '';
            const { value: currentValue } = await this.get({ key });
            if (typeof currentValue === 'string') {
                existing.push(key);
            }
            else {
                await this.set({ key, value });
                migrated.push(key);
            }
        }
        return { migrated, existing };
    }
    async removeOld() {
        const oldprefix = '_cap_';
        const keys = Object.keys(this.impl).filter(k => k.indexOf(oldprefix) === 0);
        for (const oldkey of keys) {
            this.impl.removeItem(oldkey);
        }
    }
    get impl() {
        return window.localStorage;
    }
    get prefix() {
        return this.group === 'NativeStorage' ? '' : `${this.group}.`;
    }
    rawKeys() {
        return Object.keys(this.impl).filter(k => k.indexOf(this.prefix) === 0);
    }
    applyPrefix(key) {
        return this.prefix + key;
    }
}

var web$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    PreferencesWeb: PreferencesWeb
});

class SplashScreenWeb extends WebPlugin {
    async show(_options) {
        return undefined;
    }
    async hide(_options) {
        return undefined;
    }
}

var web = /*#__PURE__*/Object.freeze({
    __proto__: null,
    SplashScreenWeb: SplashScreenWeb
});

export { Capacitor, capacitorAPI, capacitorAPI as default };
//# sourceMappingURL=capacitor-core.bundle.js.map
