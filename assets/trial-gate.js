(function () {
  "use strict";

  var config = window.BRAIN_TRIAL_GATE_CONFIG || {};
  var body = document.body;
  var gateRoot = document.getElementById("trial-gate-root");
  var appRoot = document.getElementById("app");
  var storagePrefix = String(config.storagePrefix || "brain_demo_trial_gate_v1");
  var sessionKey = storagePrefix + ":session";
  var usedKey = storagePrefix + ":used";
  var loaded = false;
  var countdownTimer = 0;
  var badgeNode = null;

  function setBodyState(state) {
    if (!body) return;
    body.setAttribute("data-trial-gate", state);
  }

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
      }[ch];
    });
  }

  function readJson(key, fallbackValue) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallbackValue;
      return JSON.parse(raw);
    } catch (err) {
      return fallbackValue;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function removeStorage(key) {
    try { localStorage.removeItem(key); } catch (err) {}
  }

  function getAccounts() {
    var list = Array.isArray(config.accounts) ? config.accounts : [];
    return list.filter(function (item) {
      return item && item.id && item.username && item.credentialHash;
    });
  }

  function getUsedAccounts() {
    var used = readJson(usedKey, {});
    return used && typeof used === "object" ? used : {};
  }

  function markUsed(account) {
    var used = getUsedAccounts();
    used[account.id] = {
      usedAt: new Date().toISOString(),
      username: normalizeUsername(account.username)
    };
    writeJson(usedKey, used);
  }

  function getActiveSession() {
    var session = readJson(sessionKey, null);
    if (!session || typeof session !== "object") return null;
    var expiresAt = Number(session.expiresAt || 0);
    if (!expiresAt || expiresAt <= Date.now()) {
      removeStorage(sessionKey);
      return null;
    }
    return session;
  }

  function clearSession() {
    removeStorage(sessionKey);
  }

  function formatRemaining(ms) {
    var totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
  }

  function sha256Hex(text) {
    if (!window.crypto || !window.crypto.subtle || typeof window.crypto.subtle.digest !== "function") {
      return Promise.reject(new Error("Web Crypto unavailable"));
    }
    var encoder = new TextEncoder();
    return window.crypto.subtle.digest("SHA-256", encoder.encode(text)).then(function (buffer) {
      var bytes = Array.prototype.slice.call(new Uint8Array(buffer));
      return bytes.map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("Failed to load " + src));
      };
      document.body.appendChild(script);
    });
  }

  function destroyBadge() {
    if (countdownTimer) {
      window.clearInterval(countdownTimer);
      countdownTimer = 0;
    }
    if (badgeNode && badgeNode.parentNode) {
      badgeNode.parentNode.removeChild(badgeNode);
    }
    badgeNode = null;
  }

  function renderGate(options) {
    var mode = (options && options.mode) || "locked";
    var message = options && options.message ? options.message : "";
    var accounts = getAccounts();
    var disabled = !accounts.length || mode === "unsupported" || mode === "expired";
    var formHtml = disabled ? "" : (
      '<form class="trial-gate-form" id="trial-gate-form">' +
        '<label class="trial-gate-field">' +
          '<span>试用账号</span>' +
          '<input id="trial-gate-username" name="username" type="text" autocomplete="username" spellcheck="false" placeholder="请输入账号" required />' +
        '</label>' +
        '<label class="trial-gate-field">' +
          '<span>试用密码</span>' +
          '<input id="trial-gate-password" name="password" type="password" autocomplete="current-password" placeholder="请输入密码" required />' +
        '</label>' +
        '<div class="trial-gate-error" id="trial-gate-error">' + escapeHtml(message) + "</div>" +
        '<div class="trial-gate-actions">' +
          '<button class="trial-gate-submit" id="trial-gate-submit" type="submit">进入 5 分钟试用</button>' +
          '<div class="trial-gate-note">这是静态站点上的轻量假门禁。会话和已使用状态都保存在当前浏览器里。</div>' +
        "</div>" +
      "</form>"
    );
    gateRoot.innerHTML =
      '<div class="trial-gate-shell">' +
        '<section class="trial-gate-card">' +
          '<div class="trial-gate-eyebrow">TRIAL ACCESS</div>' +
          "<h1 class=\"trial-gate-title\">" + escapeHtml(config.title || "演示试用入口") + "</h1>" +
          "<p class=\"trial-gate-subtitle\">" + escapeHtml(config.subtitle || "") + "</p>" +
          '<div class="trial-gate-help">' + escapeHtml(message || config.helpText || "") + "</div>" +
          formHtml +
        "</section>" +
      "</div>";
    setBodyState(mode);
    if (disabled) return;
    var form = document.getElementById("trial-gate-form");
    if (form) form.addEventListener("submit", onSubmit);
  }

  function expireSession(message) {
    clearSession();
    destroyBadge();
    if (appRoot) {
      appRoot.innerHTML = "";
    }
    renderGate({
      mode: "expired",
      message: message || config.expiryText || "本次试用已到期。"
    });
  }

  function mountBadge(session) {
    destroyBadge();
    badgeNode = document.createElement("div");
    badgeNode.className = "trial-gate-badge";
    badgeNode.innerHTML =
      '<span class="trial-gate-badge-label">TRIAL COUNTDOWN</span>' +
      '<span class="trial-gate-badge-time" id="trial-gate-countdown">05:00</span>' +
      '<span class="trial-gate-badge-user">' + escapeHtml(session.username || "") + "</span>";
    document.body.appendChild(badgeNode);
    var countdown = document.getElementById("trial-gate-countdown");

    function refreshCountdown() {
      var active = getActiveSession();
      if (!active) {
        expireSession(config.expiryText);
        return;
      }
      if (countdown) countdown.textContent = formatRemaining(active.expiresAt - Date.now());
    }

    refreshCountdown();
    countdownTimer = window.setInterval(refreshCountdown, 1000);
  }

  function loadDemo() {
    if (loaded) return Promise.resolve();
    loaded = true;
    setBodyState("granted");
    if (gateRoot) gateRoot.innerHTML = "";
    if (appRoot) appRoot.style.display = "";
    var scripts = Array.isArray(config.demoScripts) ? config.demoScripts.slice() : [];
    var chain = Promise.resolve();
    scripts.forEach(function (src) {
      chain = chain.then(function () {
        return loadScript(src);
      });
    });
    return chain.catch(function (err) {
      loaded = false;
      renderGate({
        mode: "locked",
        message: "演示脚本加载失败，请刷新页面重试。"
      });
      throw err;
    });
  }

  function onSubmit(event) {
    event.preventDefault();
    var usernameInput = document.getElementById("trial-gate-username");
    var passwordInput = document.getElementById("trial-gate-password");
    var submitButton = document.getElementById("trial-gate-submit");
    var errorNode = document.getElementById("trial-gate-error");
    var username = normalizeUsername(usernameInput && usernameInput.value);
    var password = String(passwordInput && passwordInput.value || "");
    var accounts = getAccounts();
    var account = null;
    var used = getUsedAccounts();

    accounts.some(function (item) {
      if (normalizeUsername(item.username) === username) {
        account = item;
        return true;
      }
      return false;
    });

    if (!account) {
      if (errorNode) errorNode.textContent = "账号或密码不正确。";
      return;
    }
    if (used[account.id]) {
      if (errorNode) errorNode.textContent = "该账号在当前浏览器中已经用过，不能再次进入。";
      return;
    }

    if (submitButton) submitButton.disabled = true;
    if (errorNode) errorNode.textContent = "正在校验并开启试用...";

    sha256Hex(username + ":" + password).then(function (hash) {
      if (hash !== account.credentialHash) {
        throw new Error("invalid");
      }
      var sessionMinutes = Number(config.sessionMinutes || 5);
      var now = Date.now();
      var session = {
        accountId: account.id,
        username: username,
        startedAt: now,
        expiresAt: now + (sessionMinutes * 60 * 1000)
      };
      if (!writeJson(sessionKey, session)) {
        throw new Error("storage");
      }
      markUsed(account);
      mountBadge(session);
      return loadDemo();
    }).catch(function (err) {
      if (err && err.message === "invalid") {
        if (errorNode) errorNode.textContent = "账号或密码不正确。";
        return;
      }
      if (err && err.message === "storage") {
        if (errorNode) errorNode.textContent = "浏览器无法保存试用状态，请关闭无痕模式后重试。";
        clearSession();
        return;
      }
      if (errorNode) errorNode.textContent = "当前环境无法启用试用门禁，请改用现代浏览器或 HTTPS 地址。";
    }).finally(function () {
      if (submitButton) submitButton.disabled = false;
    });
  }

  function boot() {
    if (!config.enabled) {
      setBodyState("granted");
      loadDemo();
      return;
    }
    if (!window.TextEncoder || !window.localStorage) {
      renderGate({
        mode: "unsupported",
        message: config.unsupportedText || "当前浏览器环境不支持试用门禁。"
      });
      return;
    }
    var session = getActiveSession();
    if (session) {
      mountBadge(session);
      loadDemo();
      return;
    }
    renderGate({
      mode: "locked",
      message: config.helpText || "请输入试用账号和密码。"
    });
  }

  boot();
})();
