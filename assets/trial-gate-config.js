(function () {
  "use strict";

  window.BRAIN_TRIAL_GATE_CONFIG = {
    enabled: false,
    sessionMinutes: 5,
    storagePrefix: "brain_demo_trial_gate_v1",
    title: "辅政通试用入口",
    subtitle: "请输入一次性试用账号和密码。当前方案只适用于 GitHub Pages 场景下的轻量演示约束。",
    helpText: "同一浏览器内，账号首次登录后只保留 5 分钟体验窗口。5 分钟后会自动失效。",
    expiryText: "本次试用已到期。当前浏览器里的该账号不会再次放行，请联系我方重新发放新的试用账号。",
    unsupportedText: "当前浏览器环境不支持试用门禁所需的 Web Crypto 或本地存储能力，请改用 HTTPS 打开的现代浏览器。",
    demoScripts: [
      "./assets/data.js?v=20260321k",
      "./assets/qingyang_real_data.js?v=20260326f",
      "./assets/app.js?v=20260421n"
    ],
    accounts: [
      {
        id: "client-trial",
        label: "默认试用账号",
        username: "client-trial",
        credentialHash: "6513f7bb00d0970fbbf39ca39ae02fef76fe8937829ec4f843fcc880048080ba"
      }
    ]
  };
})();
