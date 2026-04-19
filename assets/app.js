// Industry Brain Demo App (offline)
// This is a clickable prototype with in-browser state (localStorage).
(function () {
  "use strict";

  var KEY = "ib_demo_state_v1";
  var seed = window.DEMO_SEED || {};
  var qingyangReal = window.DEMO_QINGYANG_REAL || null;
  var geoReal = window.DEMO_GEO_REAL || null;
  var geoDataCache = null;
  var geoEnterpriseLinksReady = false;
  var GEO_TILE_DEFAULT_SECRETS = { amap_native: "a87169331ddefea7bcd86b2b41937de4", amap_native_jscode: "2b3f1d4b2f28201f6915a5990152a0e4", tianditu: "2bd794f2345552b3d4142074241ce669", tianditu_img: "2bd794f2345552b3d4142074241ce669", tianditu_ter: "2bd794f2345552b3d4142074241ce669" };
  var geoTileSecrets = (function () { try { var s = JSON.parse(localStorage.getItem("ib_geo_tile_secrets")) || {}; Object.keys(GEO_TILE_DEFAULT_SECRETS).forEach(function (k) { if (!s[k]) s[k] = GEO_TILE_DEFAULT_SECRETS[k]; }); return s; } catch (e) { return JSON.parse(JSON.stringify(GEO_TILE_DEFAULT_SECRETS)); } })();
  var geoTileRenderReq = null;
  var geoTileRenderRaf = 0;
  var geoStageMotionTimer = 0;
  var geoStageSwitchTimer = 0;
  var geoNativeMapReq = null;
  var geoNativeMapRaf = 0;
  var geoNativeViewSyncReq = null;
  var geoNativeViewSyncRaf = 0;
  var geoNativeViewSyncLastAt = 0;
  var geoNativeMotionLoopRaf = 0;
  var geoNativeMotionStage = null;
  var geoNativeMotionProviderKey = "";
  var geoAmapLoaderState = { key: "", promise: null };
  var geoNativeMapState = { stage: null, host: null, map: null, syncSig: "", key: "", status: "", ignoreUntil: 0, providerKey: "", visualZoom: 0 };
  var chainAutoDetailKey = "";
  var geoBasemapDetailRaw = window.DEMO_GEO_BASEMAP_DETAIL || null;
  var _geoFilesLoaded = !!(geoReal);
  var _geoFilesLoading = false;
  function loadGeoDataFiles(cb) {
    if (_geoFilesLoaded) { cb(); return; }
    if (_geoFilesLoading) {
      var _poll = setInterval(function () {
        if (_geoFilesLoaded) { clearInterval(_poll); cb(); }
      }, 50);
      return;
    }
    _geoFilesLoading = true;
    var files = [
      "./assets/chengdu_geo_real.js?v=20260401a",
      "./assets/qingyang_street_geo_patch_v2.js?v=20260401a",
      "./assets/qingyang_street_gap_seal.js?v=20260401a",
      "./assets/qingyang_street_geo_refined.js?v=20260407a",
      "./assets/qingyang_street_partition_fix.js?v=20260410f",
      "./assets/qingyang_boundary_fix.js?v=20260401a",
      "./assets/chengdu_basemap_detail.js?v=20260401a"
    ];
    var idx = 0;
    function next() {
      if (idx >= files.length) {
        geoReal = window.DEMO_GEO_REAL || null;
        geoBasemapDetailRaw = window.DEMO_GEO_BASEMAP_DETAIL || null;
        geoDataCache = null;
        _geoFilesLoaded = true;
        _geoFilesLoading = false;
        cb();
        return;
      }
      var s = document.createElement("script");
      s.src = files[idx++];
      s.onload = next;
      s.onerror = next;
      document.head.appendChild(s);
    }
    next();
  }
  var _geoTileClipRing = null; // current clip boundary for tile layer (set per GIS render)
  var _geoLayerVis = (function () { try { var v = JSON.parse(localStorage.getItem("ib_geo_layer_vis")); if (v && typeof v === "object") { if (!v.hasOwnProperty("ent_mfg")) { v.ent_mfg = true; v.ent_bio = true; v.ent_biz = true; v.ent_srv = true; } return v; } } catch (e) {} return { heat: true, enterprise: true, ent_mfg: true, ent_bio: true, ent_biz: true, ent_srv: true, project: true, carrier: true, park: true }; })();
  function geoSaveLayerVis() { try { localStorage.setItem("ib_geo_layer_vis", JSON.stringify(_geoLayerVis)); } catch (e) {} }
  function geoEnsureHeatLayerVisible() {
    if (_geoLayerVis.heat) return;
    _geoLayerVis.heat = true;
    geoSaveLayerVis();
  }
  function geoEnsureEnterpriseLayerVisible() {
    var changed = false;
    if (!_geoLayerVis.enterprise) { _geoLayerVis.enterprise = true; changed = true; }
    if (!_geoLayerVis.ent_mfg) { _geoLayerVis.ent_mfg = true; changed = true; }
    if (!_geoLayerVis.ent_bio) { _geoLayerVis.ent_bio = true; changed = true; }
    if (!_geoLayerVis.ent_biz) { _geoLayerVis.ent_biz = true; changed = true; }
    if (!_geoLayerVis.ent_srv) { _geoLayerVis.ent_srv = true; changed = true; }
    if (changed) geoSaveLayerVis();
  }

  function deepClone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function mergeEnterpriseOverlays(base, extra) {
    var list = (base || []).slice();
    var seenUscc = {};
    var seenNames = {};
    list.forEach(function (item) {
      if (!item) return;
      if (item.uscc) seenUscc[String(item.uscc)] = true;
      if (item.name) seenNames[String(item.name)] = true;
    });
    (extra || []).forEach(function (item) {
      if (!item || !item.name) return;
      var uscc = item.uscc ? String(item.uscc) : "";
      var name = String(item.name);
      if ((uscc && seenUscc[uscc]) || seenNames[name]) return;
      list.push(item);
      if (uscc) seenUscc[uscc] = true;
      seenNames[name] = true;
    });
    return list;
  }

  function applyQingyangRealOverlay() {
    if (!qingyangReal || typeof qingyangReal !== "object") return;
    if (qingyangReal.enterprises && qingyangReal.enterprises.length) {
      seed.enterprises = mergeEnterpriseOverlays(seed.enterprises, qingyangReal.enterprises);
    }
    if ((qingyangReal.documents && qingyangReal.documents.length) || (qingyangReal.annual_stats && qingyangReal.annual_stats.length)) {
      seed.qingyang_real_docs = {
        documents: deepClone(qingyangReal.documents || []),
        annual_stats: deepClone(qingyangReal.annual_stats || []),
        meta: deepClone(qingyangReal.meta || {})
      };
    }
  }

  applyQingyangRealOverlay();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function save(st) {
    localStorage.setItem(KEY, JSON.stringify(st));
  }

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now() + "_" + Math.random().toString(16).slice(2, 8);
  }

  function fmtDate(d) {
    var dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return String(d || "");
    var m = String(dt.getMonth() + 1).padStart(2, "0");
    var day = String(dt.getDate()).padStart(2, "0");
    return dt.getFullYear() + "-" + m + "-" + day;
  }

  function today() {
    return fmtDate(new Date());
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function entById(id) {
    return (seed.enterprises || []).find(function (e) {
      return e.id === id;
    });
  }

  function bankById(id) {
    return (seed.banks || []).find(function (b) {
      return b.id === id;
    });
  }

  function staffById(id) {
    return (seed.staff || []).find(function (s) {
      return s.id === id;
    });
  }

  function geoCloneList(list) {
    return (list || []).map(function (it) {
      return Object.assign({}, it);
    });
  }

  function geoNameKey(s) {
    return String(s || "").replace(/\s+/g, "");
  }

  var GEO_ENTERPRISE_STREET_SUPPLEMENTS = [
    { id: "gs22", district_id: "gd1", name: "黄田坝街道", x: 18.2, y: 38.7, enterprises: 276, key_enterprises: 24, land_eff: 0.84, heat: 81, warning: "低", cluster: "航空制造+高端装备", invest_leads: 6 },
    { id: "gs23", district_id: "gd2", name: "东大街街道", x: 44.7, y: 28.4, enterprises: 336, key_enterprises: 29, land_eff: 0.89, heat: 85, warning: "低", cluster: "金融科技+总部服务", invest_leads: 7 },
    { id: "gs24", district_id: "gd2", name: "盐市口街道", x: 41.2, y: 27.9, enterprises: 294, key_enterprises: 22, land_eff: 0.83, heat: 79, warning: "低", cluster: "文商旅+消费服务", invest_leads: 5 },
    { id: "gs25", district_id: "gd3", name: "武侯街道", x: 45.9, y: 59.2, enterprises: 352, key_enterprises: 31, land_eff: 0.88, heat: 86, warning: "低", cluster: "低空制造+配套服务", invest_leads: 8 },
    { id: "gs26", district_id: "gd3", name: "浆洗街街道", x: 45.2, y: 57.3, enterprises: 268, key_enterprises: 18, land_eff: 0.81, heat: 78, warning: "低", cluster: "文旅服务+特色商业", invest_leads: 4 },
    { id: "gs27", district_id: "gd3", name: "玉林街道", x: 49.8, y: 57.0, enterprises: 318, key_enterprises: 26, land_eff: 0.86, heat: 84, warning: "低", cluster: "数据服务+智能应用", invest_leads: 6 },
    { id: "gs28", district_id: "gd3", name: "芳草街街道", x: 52.4, y: 58.4, enterprises: 342, key_enterprises: 28, land_eff: 0.89, heat: 87, warning: "低", cluster: "工业软件+AI中试", invest_leads: 7 },
    { id: "gs29", district_id: "gd3", name: "桂溪街道", x: 56.0, y: 60.8, enterprises: 388, key_enterprises: 34, land_eff: 0.91, heat: 90, warning: "低", cluster: "人工智能+算力服务", invest_leads: 9 },
    { id: "gs30", district_id: "gd4", name: "府青路街道", x: 68.4, y: 41.2, enterprises: 245, key_enterprises: 19, land_eff: 0.82, heat: 77, warning: "中", cluster: "航空科创+数字文博", invest_leads: 4 },
    { id: "gs31", district_id: "gd4", name: "猛追湾街道", x: 69.5, y: 45.2, enterprises: 304, key_enterprises: 23, land_eff: 0.84, heat: 80, warning: "低", cluster: "文商旅+社区商业", invest_leads: 5 },
    { id: "gs32", district_id: "gd4", name: "建设路街道", x: 71.8, y: 46.8, enterprises: 362, key_enterprises: 30, land_eff: 0.87, heat: 85, warning: "低", cluster: "数字文创+低空场景", invest_leads: 7 },
    { id: "gs33", district_id: "gd4", name: "驷马桥街道", x: 66.8, y: 39.7, enterprises: 226, key_enterprises: 17, land_eff: 0.79, heat: 74, warning: "中", cluster: "仓配物流+跨境服务", invest_leads: 4 }
  ];

  var GEO_ENTERPRISE_STREET_ALIASES = {
    "锦绣社区": "金沙街道",
    "科创社区": "草堂街道",
    "物流社区": "苏坡街道",
    "政务社区": "草市街街道",
    "青羊经开区": "府南街道",
    "锦官城写字楼": "少城街道",
    "政务服务中心": "草市街街道",
    "示例物流园": "苏坡街道",
    "科创大道": "草堂街道",
    "示例路": "府南街道"
  };

  var GEO_ENTERPRISE_PARK_ALIASES = {
    "青羊经开区": "gp1",
    "青羊航空配套园": "gp1",
    "武侯智造园": "gp4",
    "望江生物医药港": "gp5"
  };

  function geoInjectEnterpriseStreetSupplements(out) {
    var existing = {};
    (out.streets || []).forEach(function (s) {
      existing[geoNameKey(s.name)] = true;
    });
    GEO_ENTERPRISE_STREET_SUPPLEMENTS.forEach(function (item) {
      var key = geoNameKey(item.name);
      if (existing[key]) return;
      out.streets.push(Object.assign({}, item));
      existing[key] = true;
    });
  }

  function geoEnrichFromRealMap(out) {
    if (!geoReal) return out;
    var rd = geoReal.districts || {};
    var rs = geoReal.streets || {};
    var rp = geoReal.parks || {};
    var districtClusters = ["电子信息", "先进制造", "现代商贸", "数字服务", "生物医药", "总部经济", "文创旅游", "供应链物流"];
    var districtGaps = ["高能级载体不足", "产业链配套仍需补齐", "创新要素供给偏弱", "高端人才供需不平衡", "融资覆盖深度不足"];
    var leadIndustries = ["电子信息", "智能制造", "生物医药", "数字服务", "商贸服务", "供应链物流", "文创服务"];

    function rangeInt(key, min, max) {
      var h = hashNumber(String(key));
      var span = max - min + 1;
      return min + (h % span);
    }

    function rangeFloat(key, min, max, digits) {
      var h = hashNumber(String(key));
      var r = (h % 10000) / 10000;
      var v = min + (max - min) * r;
      return Number(v.toFixed(digits == null ? 2 : digits));
    }

    function nearestDistrictIdByCenter(x, y, fallbackId) {
      var best = null;
      out.districts.forEach(function (d) {
        var dx = Number(d.x || 50) - x;
        var dy = Number(d.y || 50) - y;
        var dist = dx * dx + dy * dy;
        if (!best || dist < best.dist) best = { id: d.id, dist: dist };
      });
      return (best && best.id) || fallbackId || (out.districts[0] && out.districts[0].id) || "";
    }

    function nearestStreetIdByCenter(x, y, fallbackId) {
      var best = null;
      out.streets.forEach(function (s) {
        var dx = Number(s.x || 50) - x;
        var dy = Number(s.y || 50) - y;
        var dist = dx * dx + dy * dy;
        if (!best || dist < best.dist) best = { id: s.id, dist: dist };
      });
      return (best && best.id) || fallbackId || (out.streets[0] && out.streets[0].id) || "";
    }

    out.districts.forEach(function (d) {
      var m = rd[d.id];
      if (!m) return;
      if (Array.isArray(m.center) && m.center.length === 2) {
        d.x = Number(m.center[0]);
        d.y = Number(m.center[1]);
      }
      if (m.name) d.name = m.name;
      if (m.adcode) d.adcode = m.adcode;
      if (Array.isArray(m.polygons) && m.polygons.length) d.geo_shape = m.polygons;
    });

    Object.keys(rd).forEach(function (id) {
      var m = rd[id] || {};
      var exists = out.districts.some(function (d) {
        return d.id === id;
      });
      if (exists) return;
      var x = Array.isArray(m.center) ? Number(m.center[0]) : 50;
      var y = Array.isArray(m.center) ? Number(m.center[1]) : 50;
      var base = rangeInt("district_base_" + id, 1200, 3600);
      out.districts.push({
        id: id,
        adcode: m.adcode || null,
        name: m.name || id,
        x: x,
        y: y,
        enterprises: base,
        key_enterprises: rangeInt("district_key_" + id, 40, 420),
        output_y: rangeFloat("district_output_" + id, 180, 2400, 1),
        tax_y: rangeFloat("district_tax_" + id, 18, 340, 1),
        heat: rangeInt("district_heat_" + id, 45, 98),
        cluster: districtClusters[rangeInt("district_cluster_" + id, 0, districtClusters.length - 1)],
        gap: districtGaps[rangeInt("district_gap_" + id, 0, districtGaps.length - 1)],
        geo_shape: Array.isArray(m.polygons) ? m.polygons : [],
      });
    });

    out.streets.forEach(function (s) {
      var m = rs[s.id];
      // fallback: match by name if ID not found
      if (!m) {
        var sName = (s.name || "").replace(/\s+/g, "");
        Object.keys(rs).forEach(function (rid) {
          if (m) return;
          var rm = rs[rid];
          if (rm && rm.name && rm.name.replace(/\s+/g, "") === sName) m = rm;
        });
      }
      if (!m) return;
      if (Array.isArray(m.center) && m.center.length === 2) {
        s.x = Number(m.center[0]);
        s.y = Number(m.center[1]);
      }
      if (m.name) s.name = m.name;
      if (m.district_id) s.district_id = m.district_id;
      if (m.osm_relation_id) s.osm_relation_id = m.osm_relation_id;
      if (Array.isArray(m.polygons) && m.polygons.length) s.geo_shape = m.polygons;
    });

    Object.keys(rs).forEach(function (id) {
      var m = rs[id] || {};
      var relationId = m.osm_relation_id == null ? null : Number(m.osm_relation_id);
      var exists = out.streets.some(function (s) {
        var sameName = m.name && geoNameKey(s.name) === geoNameKey(m.name);
        var sameRelation = relationId != null && s.osm_relation_id != null && Number(s.osm_relation_id) === relationId;
        return s.id === id || sameName || sameRelation;
      });
      if (exists) return;
      var x = Array.isArray(m.center) ? Number(m.center[0]) : 50;
      var y = Array.isArray(m.center) ? Number(m.center[1]) : 50;
      var did = m.district_id || nearestDistrictIdByCenter(x, y);
      out.streets.push({
        id: id,
        district_id: did,
        name: m.name || id,
        x: x,
        y: y,
        enterprises: rangeInt("street_ent_" + id, 60, 820),
        key_enterprises: rangeInt("street_key_" + id, 4, 95),
        output_y: rangeFloat("street_output_" + id, 12, 320, 1),
        tax_y: rangeFloat("street_tax_" + id, 1.5, 48, 1),
        land_eff: rangeFloat("street_land_" + id, 0.38, 0.97, 2),
        heat: rangeInt("street_heat_" + id, 35, 98),
        warning: ["低", "中", "中", "高"][rangeInt("street_warn_" + id, 0, 3)],
        cluster: districtClusters[rangeInt("street_cluster_" + id, 0, districtClusters.length - 1)],
        invest_leads: rangeInt("street_lead_" + id, 0, 18),
        osm_relation_id: m.osm_relation_id || null,
        geo_shape: Array.isArray(m.polygons) ? m.polygons : [],
      });
    });

    out.parks.forEach(function (p) {
      var m = rp[p.id];
      // fallback: match by name if ID not found
      if (!m) {
        var pName = (p.name || "").replace(/\s+/g, "");
        Object.keys(rp).forEach(function (rid) {
          if (m) return;
          var rm = rp[rid];
          if (rm && rm.name && rm.name.replace(/\s+/g, "") === pName) m = rm;
        });
      }
      if (!m) return;
      if (Array.isArray(m.center) && m.center.length === 2) {
        p.x = Number(m.center[0]);
        p.y = Number(m.center[1]);
      }
      if (m.name) p.name = m.name;
      if (m.cluster) p.cluster = m.cluster;
      else if (m.landuse) p.cluster = m.landuse === "industrial" ? "工业园区" : "商务园区";
      if (m.street_id) p.street_id = m.street_id;
      if (m.district_id) p.district_id = m.district_id;
      if (m.osm_way_id) p.osm_way_id = m.osm_way_id;
      if (Array.isArray(m.polygons) && m.polygons.length) p.geo_shape = m.polygons;
    });

    Object.keys(rp).forEach(function (id) {
      var m = rp[id] || {};
      var exists = out.parks.some(function (p) {
        return p.id === id;
      });
      if (exists) return;
      var x = Array.isArray(m.center) ? Number(m.center[0]) : 50;
      var y = Array.isArray(m.center) ? Number(m.center[1]) : 50;
      var sid = m.street_id || nearestStreetIdByCenter(x, y);
      var s0 = out.streets.find(function (s) {
        return s.id === sid;
      }) || null;
      var did = m.district_id || (s0 && s0.district_id) || nearestDistrictIdByCenter(x, y);
      out.parks.push({
        id: id,
        district_id: did,
        street_id: sid,
        name: m.name || id,
        x: x,
        y: y,
        enterprises: rangeInt("park_ent_" + id, 30, 580),
        key_enterprises: rangeInt("park_key_" + id, 2, 72),
        output_y: rangeFloat("park_output_" + id, 5, 240, 1),
        tax_y: rangeFloat("park_tax_" + id, 0.6, 36, 1),
        land_eff: rangeFloat("park_land_" + id, 0.35, 0.96, 2),
        heat: rangeInt("park_heat_" + id, 32, 98),
        cluster: m.cluster || (m.landuse === "industrial" ? "工业园区" : "商务园区"),
        invest_leads: rangeInt("park_lead_" + id, 0, 20),
        osm_way_id: m.osm_way_id || null,
        geo_shape: Array.isArray(m.polygons) ? m.polygons : [],
      });
    });

    var districtById = {};
    var streetById = {};
    var parkById = {};
    out.districts.forEach(function (d) {
      districtById[d.id] = d;
    });
    out.streets.forEach(function (s) {
      streetById[s.id] = s;
    });
    out.parks.forEach(function (p) {
      parkById[p.id] = p;
    });

    var buildingsByPark = {};
    out.buildings.forEach(function (b) {
      if (!buildingsByPark[b.park_id]) buildingsByPark[b.park_id] = [];
      buildingsByPark[b.park_id].push(b);
    });
    out.parks.forEach(function (p) {
      var now = buildingsByPark[p.id] || [];
      var target = Math.max(2, rangeInt("park_building_target_" + p.id, 2, 4));
      for (var i = now.length; i < target; i++) {
        var bid = "gb_auto_" + p.id + "_" + (i + 1);
        var ind = leadIndustries[rangeInt("building_ind_" + bid, 0, leadIndustries.length - 1)];
        var bObj = {
          id: bid,
          street_id: p.street_id,
          park_id: p.id,
          x: Number(p.x || 50),
          y: Number(p.y || 50),
          name: geoShortName(p.name, 10) + " · " + (i + 1) + "号载体",
          area_sqm: rangeInt("building_area_" + bid, 22000, 65000),
          occupied_rate: rangeFloat("building_occ_" + bid, 0.66, 0.96, 2),
          enterprises: rangeInt("building_ent_" + bid, 18, 98),
          output_y: rangeFloat("building_output_" + bid, 5.6, 28.8, 1),
          tax_y: rangeFloat("building_tax_" + bid, 0.8, 5.2, 1),
          heat: rangeInt("building_heat_" + bid, 66, 98),
          lead_industry: ind,
        };
        out.buildings.push(bObj);
      }
    });

    out.buildings.forEach(function (b) {
      var base = parkById[b.park_id] || streetById[b.street_id];
      if (!base) return;
      var hv = hashNumber(b.id || b.name || "b");
      var bx = Number(base.x || 50);
      var by = Number(base.y || 50);
      b.x = clamp(bx + jitter(hv * 0.73, 3.4), 1, 99);
      b.y = clamp(by + jitter(hv * 0.91, 2.7), 2, 98);
    });

    /* --- enrich buildings with real polygon shapes --- */
    var rb = geoReal.buildings || {};
    out.buildings.forEach(function (b) {
      var m = rb[b.id];
      if (!m) return;
      if (Array.isArray(m.center) && m.center.length === 2) {
        b.x = Number(m.center[0]);
        b.y = Number(m.center[1]);
        b._realCenter = true;
      }
      if (Array.isArray(m.polygons) && m.polygons.length) {
        b.geo_shape = m.polygons;
      }
    });

    out.real_city = geoReal.city || null;
    out.real_district_backdrop = geoReal.district_backdrop || [];

    function geoRingsBounds(rings) {
      var minX = Infinity;
      var minY = Infinity;
      var maxX = -Infinity;
      var maxY = -Infinity;
      (rings || []).forEach(function (ring) {
        (ring || []).forEach(function (pt) {
          if (!Array.isArray(pt) || pt.length < 2) return;
          var x = Number(pt[0]);
          var y = Number(pt[1]);
          if (!isFinite(x) || !isFinite(y)) return;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        });
      });
      if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
      return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }

    function geoPointInRingLocal(x, y, ring) {
      var inside = false;
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var xi = Number(ring[i][0]);
        var yi = Number(ring[i][1]);
        var xj = Number(ring[j][0]);
        var yj = Number(ring[j][1]);
        var intersect = yi > y !== yj > y &&
          x < ((xj - xi) * (y - yi)) / ((yj - yi) || 0.000001) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }

    function geoPointInPolygonsLocal(pt, polys) {
      var x = Number(pt[0]);
      var y = Number(pt[1]);
      return (polys || []).some(function (ring) {
        return Array.isArray(ring) && ring.length >= 3 && geoPointInRingLocal(x, y, ring);
      });
    }

    function geoPullPointInsidePolygons(pt, polys, center) {
      if (!Array.isArray(pt) || pt.length < 2) return pt;
      var x = Number(pt[0]);
      var y = Number(pt[1]);
      if (!polys || !polys.length) return [x, y];
      if (geoPointInPolygonsLocal([x, y], polys)) return [x, y];
      var cx = Number((center && center[0]) || x);
      var cy = Number((center && center[1]) || y);
      for (var i = 0; i < 18; i++) {
        x = x * 0.74 + cx * 0.26;
        y = y * 0.74 + cy * 0.26;
        if (geoPointInPolygonsLocal([x, y], polys)) return [x, y];
      }
      return [cx, cy];
    }

    function geoRemapSyntheticCentersForDistrict(did) {
      if (!did) return;
      var district = out.districts.find(function (d) { return d.id === did; }) || null;
      var districtPolys = district && Array.isArray(district.geo_shape) ? district.geo_shape : [];
      if (!districtPolys.length) return;
      var districtBounds = geoRingsBounds(districtPolys);
      if (!districtBounds) return;
      var items = out.streets
        .filter(function (s) { return s && s.district_id === did && !(Array.isArray(s.geo_shape) && s.geo_shape.length); })
        .concat(out.parks.filter(function (p) { return p && p.district_id === did && !(Array.isArray(p.geo_shape) && p.geo_shape.length); }));
      if (!items.length) return;
      var srcMinX = Infinity;
      var srcMinY = Infinity;
      var srcMaxX = -Infinity;
      var srcMaxY = -Infinity;
      items.forEach(function (it) {
        var x = Number(it.x || 50);
        var y = Number(it.y || 50);
        if (x < srcMinX) srcMinX = x;
        if (y < srcMinY) srcMinY = y;
        if (x > srcMaxX) srcMaxX = x;
        if (y > srcMaxY) srcMaxY = y;
      });
      var srcW = Math.max(1, srcMaxX - srcMinX);
      var srcH = Math.max(1, srcMaxY - srcMinY);
      var padX = Math.max(0.45, (districtBounds.maxX - districtBounds.minX) * 0.14);
      var padY = Math.max(0.4, (districtBounds.maxY - districtBounds.minY) * 0.16);
      var targetMinX = districtBounds.minX + padX;
      var targetMaxX = districtBounds.maxX - padX;
      var targetMinY = districtBounds.minY + padY;
      var targetMaxY = districtBounds.maxY - padY;
      if (targetMaxX <= targetMinX) {
        targetMinX = districtBounds.minX + 0.8;
        targetMaxX = districtBounds.maxX - 0.8;
      }
      if (targetMaxY <= targetMinY) {
        targetMinY = districtBounds.minY + 0.8;
        targetMaxY = districtBounds.maxY - 0.8;
      }
      var districtCenter = [Number(district.x || 50), Number(district.y || 50)];
      items.forEach(function (it) {
        var tx = (Number(it.x || srcMinX) - srcMinX) / srcW;
        var ty = (Number(it.y || srcMinY) - srcMinY) / srcH;
        var nx = targetMinX + tx * Math.max(0.2, targetMaxX - targetMinX);
        var ny = targetMinY + ty * Math.max(0.2, targetMaxY - targetMinY);
        var fixedPt = geoPullPointInsidePolygons([nx, ny], districtPolys, districtCenter);
        it.x = Number(fixedPt[0].toFixed(2));
        it.y = Number(fixedPt[1].toFixed(2));
      });
    }

    out.districts.forEach(function (d) {
      geoRemapSyntheticCentersForDistrict(d.id);
    });

    // Generate synthetic polygons for streets/parks that still lack geo_shape
    function synthRect(cx, cy, hw, hh, clipPolys) {
      var center = [Number(cx || 50), Number(cy || 50)];
      var pts = [
        [clamp(cx - hw, 0.5, 99.5), clamp(cy - hh, 0.5, 99.5)],
        [clamp(cx + hw, 0.5, 99.5), clamp(cy - hh, 0.5, 99.5)],
        [clamp(cx + hw, 0.5, 99.5), clamp(cy + hh, 0.5, 99.5)],
        [clamp(cx - hw, 0.5, 99.5), clamp(cy + hh, 0.5, 99.5)]
      ];
      if (clipPolys && clipPolys.length) {
        pts = pts.map(function (pt) {
          return geoPullPointInsidePolygons(pt, clipPolys, center);
        });
      }
      return [pts];
    }

    function synthBuildingRect(building, clipPolys) {
      var hv = hashNumber((building && (building.id || building.name)) || "building");
      var area = Math.max(6000, Number(building && building.area_sqm) || 24000);
      var areaScale = Math.sqrt(area) / 1000;
      var hw = clamp(0.05 + areaScale * 0.34 + (hv % 5) * 0.008, 0.09, 0.26);
      var hh = clamp(hw * (0.7 + ((hv >> 3) % 4) * 0.08), 0.07, 0.2);
      return synthRect(Number(building && building.x || 50), Number(building && building.y || 50), hw, hh, clipPolys);
    }

    function geoMaxDim(bounds) {
      if (!bounds) return 0;
      return Math.max(Number(bounds.maxX || 0) - Number(bounds.minX || 0), Number(bounds.maxY || 0) - Number(bounds.minY || 0));
    }

    function geoBuildingClipPolys(building) {
      var park = parkById[building && building.park_id];
      if (park && Array.isArray(park.geo_shape) && park.geo_shape.length) return park.geo_shape;
      var street = streetById[building && building.street_id];
      if (street && Array.isArray(street.geo_shape) && street.geo_shape.length) return street.geo_shape;
      var district = districtById[(street && street.district_id) || (park && park.district_id)];
      if (district && Array.isArray(district.geo_shape) && district.geo_shape.length) return district.geo_shape;
      return null;
    }

    function geoShouldNormalizeBuildingShape(building, rings) {
      if (!Array.isArray(rings) || !rings.length) return true;
      var buildingBounds = geoRingsBounds(rings);
      if (!buildingBounds) return true;
      var maxDim = geoMaxDim(buildingBounds);
      if (maxDim < 0.12) return true;
      if (maxDim > 0.22) return true;

      var park = parkById[building && building.park_id];
      var parkBounds = park && Array.isArray(park.geo_shape) && park.geo_shape.length ? geoRingsBounds(park.geo_shape) : null;
      if (parkBounds && maxDim > geoMaxDim(parkBounds) * 0.42) return true;

      var street = streetById[building && building.street_id];
      var streetBounds = street && Array.isArray(street.geo_shape) && street.geo_shape.length ? geoRingsBounds(street.geo_shape) : null;
      if (streetBounds && maxDim > geoMaxDim(streetBounds) * 0.18) return true;

      return false;
    }

    out.streets.forEach(function (s) {
      if (Array.isArray(s.geo_shape) && s.geo_shape.length) return;
      var cx = Number(s.x || 50);
      var cy = Number(s.y || 50);
      var hv = hashNumber(s.id || s.name || "s");
      var hw = 0.34 + (hv % 18) / 95;
      var hh = 0.28 + (hv % 16) / 90;
      var district = out.districts.find(function (d) { return d.id === s.district_id; }) || null;
      var clipPolys = district && Array.isArray(district.geo_shape) ? district.geo_shape : null;
      s.geo_shape = synthRect(cx, cy, hw, hh, clipPolys);
    });
    out.parks.forEach(function (p) {
      if (Array.isArray(p.geo_shape) && p.geo_shape.length) return;
      var cx = Number(p.x || 50);
      var cy = Number(p.y || 50);
      var hv = hashNumber(p.id || p.name || "p");
      var hw = 0.12 + (hv % 14) / 180;
      var hh = 0.1 + (hv % 12) / 170;
      var district = out.districts.find(function (d) { return d.id === p.district_id; }) || null;
      var clipPolys = district && Array.isArray(district.geo_shape) ? district.geo_shape : null;
      p.geo_shape = synthRect(cx, cy, hw, hh, clipPolys);
    });

    out.buildings.forEach(function (b) {
      var clipPolys = geoBuildingClipPolys(b);
      if (geoShouldNormalizeBuildingShape(b, b.geo_shape)) {
        b.geo_shape = synthBuildingRect(b, clipPolys);
        return;
      }
      if (clipPolys && b.geo_shape && b.geo_shape.length) {
        var center = [Number(b.x || 50), Number(b.y || 50)];
        b.geo_shape = b.geo_shape.map(function (ring) {
          return (ring || []).map(function (pt) {
            return geoPullPointInsidePolygons(pt, clipPolys, center);
          });
        });
      }
    });

    return out;
  }

  function geoData() {
    if (geoDataCache) return geoDataCache;
    var g = seed.geo || {};
    var base = {
      districts: geoCloneList(g.districts),
      streets: geoCloneList(g.streets),
      parks: geoCloneList(g.parks),
      buildings: geoCloneList(g.buildings),
      real_city: null,
      real_district_backdrop: [],
    };
    geoInjectEnterpriseStreetSupplements(base);
    geoDataCache = geoEnrichFromRealMap(base);
    geoEnsureEnterpriseGeoLinks();
    return geoDataCache;
  }

  var DEMO_GOV_DISTRICT_LOCK_ID = "gd1";
  var DEMO_GOV_DISTRICT_LOCK_NAME = "青羊区";
  var DEMO_GOV_DECISION_INCLUDE_MARKERS = ["青羊", "黄田坝", "府南", "少城", "浆洗街", "草市街", "草堂", "金沙", "光华", "苏坡", "文家", "宽窄"];
  var DEMO_GOV_DECISION_EXCLUDE_MARKERS = ["锦江", "牛市口", "东大街", "春熙", "太古里", "IFS", "武侯", "武侯祠", "锦里", "桂溪", "成华", "建设路", "驷马桥", "东郊记忆", "龙潭"];

  function govDemoDistrictLockEnabled(path) {
    return !!path && path.indexOf("/gov/") === 0;
  }

  function govDemoDistrictId() {
    return DEMO_GOV_DISTRICT_LOCK_ID;
  }

  function govDemoDistrictName() {
    return DEMO_GOV_DISTRICT_LOCK_NAME;
  }

  function govDemoQueryEqual(a, b) {
    var aKeys = Object.keys(a || {}).sort();
    var bKeys = Object.keys(b || {}).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (var i = 0; i < aKeys.length; i++) {
      if (aKeys[i] !== bKeys[i]) return false;
      if (String((a || {})[aKeys[i]] || "") !== String((b || {})[bKeys[i]] || "")) return false;
    }
    return true;
  }

  function geoDistrictIdByName(name) {
    var key = String(name || "").trim();
    if (!key) return "";
    var hit = (geoData().districts || []).find(function (item) {
      return item && item.name === key;
    });
    return (hit && hit.id) || "";
  }

  function govDemoDistrictIdFromCarrierQuery(q) {
    var geo = geoData();
    var districtName = String((q && q.carrier_district) || "").trim();
    var districtId = geoDistrictIdByName(districtName);
    if (districtId) return districtId;
    var streetName = String((q && q.carrier_street) || "").trim();
    if (streetName) {
      var street = (geo.streets || []).find(function (item) { return item && item.name === streetName; });
      if (street && street.district_id) return street.district_id;
    }
    var parkName = String((q && q.carrier_park) || "").trim();
    if (parkName) {
      var park = (geo.parks || []).find(function (item) { return item && item.name === parkName; });
      if (park && park.district_id) return park.district_id;
    }
    var buildingName = String((q && q.carrier_building) || "").trim();
    if (buildingName) {
      var building = (geo.buildings || []).find(function (item) { return item && item.name === buildingName; });
      if (building && building.street_id) {
        var buildingStreet = (geo.streets || []).find(function (item) { return item && item.id === building.street_id; });
        if (buildingStreet && buildingStreet.district_id) return buildingStreet.district_id;
      }
      if (building && building.park_id) {
        var buildingPark = (geo.parks || []).find(function (item) { return item && item.id === building.park_id; });
        if (buildingPark && buildingPark.district_id) return buildingPark.district_id;
      }
    }
    return "";
  }

  function geoItemDistrictId(item) {
    if (!item) return "";
    if (item.district_id) return item.district_id;
    if (item.district_name) return geoDistrictIdByName(item.district_name);
    if (item.id && /^gd\d+$/i.test(String(item.id))) return String(item.id);
    if (item.street_id) {
      var street = geoStreetById(item.street_id);
      if (street && street.district_id) return street.district_id;
    }
    if (item.park_id) {
      var park = geoParkById(item.park_id);
      if (park && park.district_id) return park.district_id;
    }
    if (item.building_id) {
      var building = geoBuildingById(item.building_id);
      if (building) return geoItemDistrictId(building);
    }
    if (item.enterprise_id) {
      var ent = entById(item.enterprise_id);
      if (ent) return geoItemDistrictId(ent);
    }
    if (item.ent) return geoItemDistrictId(item.ent);
    return "";
  }

  function govDemoIsInDistrict(item) {
    return geoItemDistrictId(item) === govDemoDistrictId();
  }

  function govDemoGeoItems(items) {
    return (items || []).filter(govDemoIsInDistrict);
  }

  function govDemoEnterprises() {
    geoData();
    return (seed.enterprises || []).filter(isRealEnterprise).filter(govDemoIsInDistrict);
  }

  function govDemoAlerts() {
    geoData();
    return (seed.alerts || []).filter(govDemoIsInDistrict);
  }

  function govDemoPolicies() {
    return (seed.policies || []).filter(function (item) {
      return !item || !item.district_id || item.district_id === govDemoDistrictId();
    });
  }

  function govDemoDecisionRecordAllowed(item) {
    var text = [item && item.title, item && item.topic, item && item.keyword, item && item.summary, item && item.detail].join(" ");
    var hasInclude = DEMO_GOV_DECISION_INCLUDE_MARKERS.some(function (marker) {
      return text.indexOf(marker) >= 0;
    });
    var hasExclude = DEMO_GOV_DECISION_EXCLUDE_MARKERS.some(function (marker) {
      return text.indexOf(marker) >= 0;
    });
    return hasInclude || !hasExclude;
  }

  function govDemoDecisionRecords(records) {
    return (records || []).filter(govDemoDecisionRecordAllowed);
  }

  function govDemoNormalizeQuery(path, q) {
    if (!govDemoDistrictLockEnabled(path)) return Object.assign({}, q || {});
    var next = {};
    Object.keys(q || {}).forEach(function (key) {
      next[key] = q[key];
    });
    if (path.indexOf("/gov/geo-") === 0) {
      next.did = govDemoDistrictId();
    }
    if (path === "/gov/investment-analysis") {
      next.did = govDemoDistrictId();
    }
    if (path === "/gov/chain") {
      next.district = govDemoDistrictName();
    }
    if (path === "/gov/portrait") {
      next.carrier_district = govDemoDistrictName();
      if (next.carrier_street) {
        var street = (geoData().streets || []).find(function (item) { return item && item.name === next.carrier_street; });
        if (!street || street.district_id !== govDemoDistrictId()) delete next.carrier_street;
      }
      if (next.carrier_park) {
        var park = (geoData().parks || []).find(function (item) { return item && item.name === next.carrier_park; });
        if (!park || park.district_id !== govDemoDistrictId()) delete next.carrier_park;
      }
      if (next.carrier_building) {
        var building = (geoData().buildings || []).find(function (item) { return item && item.name === next.carrier_building; });
        if (!building || geoItemDistrictId(building) !== govDemoDistrictId()) delete next.carrier_building;
      }
      if (govDemoDistrictIdFromCarrierQuery(next) && govDemoDistrictIdFromCarrierQuery(next) !== govDemoDistrictId()) {
        delete next.carrier_street;
        delete next.carrier_park;
        delete next.carrier_building;
        next.carrier_district = govDemoDistrictName();
      }
    }
    if (path === "/gov/policy-gov") {
      next.pdid = govDemoDistrictId();
    }
    return next;
  }

  function govDemoCanonicalHash(path, q) {
    if (!govDemoDistrictLockEnabled(path)) return "";
    var nextQ = govDemoNormalizeQuery(path, q || {});
    return govDemoQueryEqual(q || {}, nextQ) ? "" : buildHash(path, nextQ);
  }

  function geoDistrictById(id) {
    return geoData().districts.find(function (d) {
      return d.id === id;
    });
  }

  function geoStreetById(id) {
    return geoData().streets.find(function (s) {
      return s.id === id;
    });
  }

  function geoParkById(id) {
    return geoData().parks.find(function (p) {
      return p.id === id;
    });
  }

  function geoBuildingById(id) {
    return geoData().buildings.find(function (b) {
      return b.id === id;
    });
  }

  function geoFindEntityByText(text, items) {
    var norm = geoNameKey(text);
    var best = null;
    (items || []).forEach(function (it) {
      var key = geoNameKey(it && it.name);
      if (!key || norm.indexOf(key) < 0) return;
      if (!best || key.length > geoNameKey(best.name).length) best = it;
    });
    return best;
  }

  function geoResolveStreetAlias(ent, streetByName) {
    var gridPrefix = String(ent.grid || "").split("-")[0];
    var text = [ent.address || "", ent.grid || "", ent.name || ""].join(" | ");
    var aliasName = GEO_ENTERPRISE_STREET_ALIASES[gridPrefix] || null;
    if (!aliasName) {
      Object.keys(GEO_ENTERPRISE_STREET_ALIASES).some(function (key) {
        if (text.indexOf(key) < 0) return false;
        aliasName = GEO_ENTERPRISE_STREET_ALIASES[key];
        return true;
      });
    }
    return aliasName ? streetByName[geoNameKey(aliasName)] || null : null;
  }

  function geoResolveParkAlias(ent, parkByName) {
    var text = [ent.address || "", ent.grid || "", ent.name || ""].join(" | ");
    var parkId = null;
    Object.keys(GEO_ENTERPRISE_PARK_ALIASES).some(function (key) {
      if (text.indexOf(key) < 0) return false;
      parkId = GEO_ENTERPRISE_PARK_ALIASES[key];
      return true;
    });
    if (!parkId) return null;
    return parkByName[parkId] || null;
  }

  function geoEnsureEnterpriseGeoLinks() {
    if (geoEnterpriseLinksReady || !geoDataCache) return;
    var geo = geoDataCache;
    var streets = geo.streets || [];
    var parks = geo.parks || [];
    var buildings = geo.buildings || [];
    var streetByName = {};
    var parkById = {};
    var parkByName = {};
    var districtsById = {};
    streets.forEach(function (s) {
      streetByName[geoNameKey(s.name)] = s;
    });
    parks.forEach(function (p) {
      parkById[p.id] = p;
      parkByName[p.id] = p;
      parkByName[geoNameKey(p.name)] = p;
    });
    geo.districts.forEach(function (d) {
      districtsById[d.id] = d;
    });
    var buildingCandidates = buildings.slice().sort(function (a, b) {
      return geoNameKey(b.name).length - geoNameKey(a.name).length;
    });
    var parkCandidates = parks.slice().sort(function (a, b) {
      return geoNameKey(b.name).length - geoNameKey(a.name).length;
    });
    var streetCandidates = streets.slice().sort(function (a, b) {
      return geoNameKey(b.name).length - geoNameKey(a.name).length;
    });
    (seed.enterprises || []).forEach(function (e) {
      var text = [e.address || "", e.grid || "", e.name || "", (e.products || []).join(" "), (e.ecosystem_role || []).join(" ")].join(" | ");
      var building = geoFindEntityByText(text, buildingCandidates);
      var park = null;
      var street = null;
      var district = null;
      if (building) {
        e.building_id = building.id;
        if (building.park_id) e.park_id = building.park_id;
        if (building.street_id) e.street_id = building.street_id;
      }
      park = (e.park_id && parkById[e.park_id]) || geoFindEntityByText(text, parkCandidates) || geoResolveParkAlias(e, parkByName);
      if (park) {
        e.park_id = park.id;
        if (!e.street_id && park.street_id) e.street_id = park.street_id;
        if (!e.district_id && park.district_id) e.district_id = park.district_id;
      }
      street =
        (e.street_id && geoStreetById(e.street_id)) ||
        geoFindEntityByText(text, streetCandidates) ||
        geoResolveStreetAlias(e, streetByName);
      if (street) {
        e.street_id = street.id;
        if (!e.district_id && street.district_id) e.district_id = street.district_id;
      }
      district = (e.district_id && districtsById[e.district_id]) || null;
      if (!district && e.street_id) {
        street = geoStreetById(e.street_id) || street;
        if (street && street.district_id) {
          e.district_id = street.district_id;
          district = districtsById[e.district_id] || null;
        }
      }
      if (!district && e.park_id) {
        park = parkById[e.park_id] || park;
        if (park && park.district_id) e.district_id = park.district_id;
      }
    });
    geoEnterpriseLinksReady = true;
  }

  function isRealEnterprise(e) {
    return e && e.level !== "服务机构";
  }

  function isKeyEnterprise(e) {
    if (!isRealEnterprise(e)) return false;
    var tags = e.tags || [];
    return e.level === "规上" || tags.indexOf("链上关键节点") >= 0 || tags.indexOf("专精特新") >= 0;
  }

  function initState() {
    var firstEnt = (seed.enterprises || []).find(isRealEnterprise);
    var firstBank = (seed.banks || [])[0];
    return {
      role: null,
      active: {
        enterprise_id: firstEnt ? firstEnt.id : null,
        bank_id: firstBank ? firstBank.id : null,
      },
      consents: deepClone(seed.default_consents || []),
      demands: [
        {
          id: "d1",
          enterprise_id: "e2",
          category: "融资对接",
          title: "寻求 150㎡ 实验办公空间（可中试）",
          detail: "用于自动化产线与测试设备采购；希望派单贴息政策。",
          created_at: "2026-02-25",
          status: "待对接",
        },
        {
          id: "d2",
          enterprise_id: "e5",
          category: "融资对接",
          title: "设备更新贷款 300 万（12-24 个月）",
          detail: "用于自动化产线与测试设备采购；希望派单贴息政策。",
          amount_w: 300,
          created_at: "2026-02-27",
          status: "待对接",
        },
      ],
      work_orders: [
        {
          id: "w1",
          type: "alert",
          ref_id: "a1",
          title: "产业链式图谱专题",
          status: "处理中",
          assignee: "s1",
          created_at: "2026-02-28",
          updated_at: "2026-02-28",
          notes: ["已电话沟通，拟安排上门走访并同步银行对接。"],
        },
      ],
      bank_followups: [
        {
          id: "f1",
          bank_id: "b1",
          enterprise_id: "e5",
          demand_id: "d2",
          stage: "已触达",
          created_at: "2026-02-28",
          notes: ["已联系财务负责人，收集近 6 个月流水与设备清单。"],
        },
      ],
    };
  }

  var state = load() || initState();
  save(state);
  var geoViewStates = {};
  var geoActiveViewKey = "";
  var geoCompareSlots = { a: "", b: "" };
  var geoStoryAutoKey = "";
  var geoAutoSwitchUntil = 0;
  var geoFastRenderUntil = 0;
  var geoRefineRenderTimer = 0;
  var _geoViewDecoRaf = 0;
  var _geoViewDecoTimer = 0;
  var geoPendingViewSeed = null;
  var geoForcedViewCarry = null;
  var geoSceneTransitionPendingAt = 0;
  var geoSceneGhostTimer = 0;
  var geoPreflightAnimRaf = 0;
  var geoPreflightAnimToken = 0;
  var geoPreflightHighlightTimer = 0;
  var geoLandingFocusState = null;
  var geoLandingFocusTimer = 0;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function geoViewKey(path, q) {
    var did = (q && q.did) || "";
    var sid = (q && q.sid) || "";
    var pid = (q && q.pid) || "";
    var scope = (q && q.scope) || "";
    return ["v2", path || "", did, sid, pid, scope].join("|");
  }

  function geoDropViewState(path, q) {
    delete geoViewStates[geoViewKey(path, q)];
  }

  function geoMakeInheritedView(stage, sourceView, path, q) {
    if (!stage || !sourceView) return null;
    var nextView = {
      zoom: clamp(
        Number(sourceView.zoom || 1),
        geoSceneZoomFloor(path, q || {}),
        geoSceneZoomLimit(path, q || {})
      ),
      tx: Number(sourceView.tx || 0),
      ty: Number(sourceView.ty || 0),
    };
    geoClampViewToStage(stage, nextView);
    return {
      zoom: Number(nextView.zoom.toFixed(3)),
      tx: Number(nextView.tx.toFixed(1)),
      ty: Number(nextView.ty.toFixed(1)),
    };
  }

  function geoSeedPendingViewState(path, q, opts) {
    if (!path || path.indexOf("/gov/geo-") !== 0) return;
    if (opts && opts.resetGeoView) {
      geoPendingViewSeed = null;
      return;
    }
    var stage = document.querySelector('[data-role="geo-stage"]');
    var activeView = getActiveGeoView();
    if (!stage || !activeView || !document.body.contains(stage)) return;
    var inherited = geoMakeInheritedView(stage, activeView, path, q || {});
    if (!inherited) return;
    geoPendingViewSeed = {
      key: geoViewKey(path, q || {}),
      view: inherited,
      at: Date.now(),
    };
  }

  function geoTakePendingViewState(key) {
    if (!geoPendingViewSeed) return null;
    if (Date.now() - Number(geoPendingViewSeed.at || 0) > 1400) {
      geoPendingViewSeed = null;
      return null;
    }
    if (geoPendingViewSeed.key !== key) return null;
    var view = geoPendingViewSeed.view;
    geoPendingViewSeed = null;
    if (!view) return null;
    return {
      zoom: Number(view.zoom || 1),
      tx: Number(view.tx || 0),
      ty: Number(view.ty || 0),
    };
  }

  function geoSeedForcedViewCarry(path, q, view, opts) {
    if (!path || path.indexOf("/gov/geo-") !== 0) return;
    if (!view || (opts && opts.resetGeoView)) {
      geoForcedViewCarry = null;
      return;
    }
    var stage = document.querySelector('[data-role="geo-stage"]');
    var provider = geoTileProviderByKey(((q && q.omt_p) || geoDefaultOnlineProvider()));
    var worldView = stage ? geoApproxNativeMapView(stage, view, provider) : null;
    geoForcedViewCarry = {
      path: path,
      q: geoCanonicalQueryForKey(path, q || {}),
      view: worldView
        ? {
            mode: "world",
            centerLon: Number(worldView.centerLon || 0),
            centerLat: Number(worldView.centerLat || 0),
            visualZoom: Number(worldView.zoom || 1),
          }
        : {
            mode: "screen",
            zoom: Number(view.zoom || 1),
            tx: Number(view.tx || 0),
            ty: Number(view.ty || 0),
          },
      at: Date.now(),
    };
  }

  function geoTakeForcedViewCarry(stage, path, q) {
    if (!geoForcedViewCarry) return null;
    if (Date.now() - Number(geoForcedViewCarry.at || 0) > 2400) {
      geoForcedViewCarry = null;
      return null;
    }
    if (String(geoForcedViewCarry.path || "") !== String(path || "")) return null;

    var targetQ = geoCanonicalQueryForKey(path, q || {});
    var carryQ = geoForcedViewCarry.q || {};
    var keys = ["did", "sid", "pid", "scope", "park_mode"];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (String(targetQ[key] || "") !== String(carryQ[key] || "")) return null;
    }

    var forced = geoForcedViewCarry.view;
    geoForcedViewCarry = null;
    if (!forced) return null;
    if (forced.mode === "world" && stage) {
      var provider = geoTileProviderByKey(((q && q.omt_p) || geoDefaultOnlineProvider()));
      var resolved = geoViewFromNativeMap(stage, forced.centerLon, forced.centerLat, forced.visualZoom, provider);
      if (resolved) {
        return {
          zoom: Number(resolved.zoom || 1),
          tx: Number(resolved.tx || 0),
          ty: Number(resolved.ty || 0),
        };
      }
    }
    return {
      zoom: Number(forced.zoom || 1),
      tx: Number(forced.tx || 0),
      ty: Number(forced.ty || 0),
    };
  }

  function geoClearSceneTransitionGhost() {
    if (geoSceneGhostTimer) {
      clearTimeout(geoSceneGhostTimer);
      geoSceneGhostTimer = 0;
    }
    var ghost = document.getElementById("geo-scene-ghost");
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
  }

  function geoCreateSceneTransitionGhost() {
    geoSceneTransitionPendingAt = 0;
    var stage = document.querySelector('[data-role="geo-stage"]');
    if (!stage || !document.body.contains(stage)) return false;
    var rect = stage.getBoundingClientRect();
    if (!rect || rect.width < 10 || rect.height < 10) return false;
    geoClearSceneTransitionGhost();
    var ghost = document.createElement("div");
    ghost.id = "geo-scene-ghost";
    ghost.className = "geo-scene-ghost";
    ghost.style.left = rect.left.toFixed(1) + "px";
    ghost.style.top = rect.top.toFixed(1) + "px";
    ghost.style.width = rect.width.toFixed(1) + "px";
    ghost.style.height = rect.height.toFixed(1) + "px";
    var clone = stage.cloneNode(true);
    clone.classList.remove("is-moving");
    clone.classList.remove("is-settling");
    clone.classList.remove("scene-entering");
    clone.style.minHeight = "100%";
    clone.style.height = "100%";
    ghost.appendChild(clone);
    document.body.appendChild(ghost);
    requestAnimationFrame(function () {
      if (ghost && ghost.parentNode) ghost.classList.add("leaving");
    });
    geoSceneGhostTimer = setTimeout(function () {
      geoClearSceneTransitionGhost();
    }, 360);
    return true;
  }

  function geoKickSceneEnter() {
    var stage = document.querySelector('[data-role="geo-stage"]');
    if (!stage || !document.body.contains(stage)) return;
    stage.classList.add("scene-entering");
    setTimeout(function () {
      if (stage && document.body.contains(stage)) stage.classList.remove("scene-entering");
    }, 300);
  }

  function geoShouldFastRender(path) {
    return !!path && path.indexOf("/gov/geo-") === 0 && Date.now() < geoFastRenderUntil;
  }

  function geoHasOnlineBasemapQuery(q) {
    return !q || q.omt !== "0";
  }

  function geoIsNativeBasemapQuery(q) {
    return geoHasOnlineBasemapQuery(q) && geoTileProviderUsesNativeMap((q && q.omt_p) || geoDefaultOnlineProvider());
  }

  function geoApproxNativeMapView(stage, view, provider) {
    if (!stage || !view) return null;
    var rect = stage.getBoundingClientRect();
    var vpW = Math.max(320, Number(rect.width || 0));
    var vpH = Math.max(260, Number(rect.height || 0));
    var vz = Math.max(0.05, Number(view.zoom || 1));
    var vtx = Number(view.tx || 0);
    var vty = Number(view.ty || 0);
    var bbox = geoTileBaseBbox();
    var bboxLonSpan = bbox.maxLon - bbox.minLon;
    var bboxLatSpan = bbox.maxLat - bbox.minLat;
    var vpLonMin = bbox.minLon + ((0 - vtx) / vz / vpW) * bboxLonSpan;
    var vpLonMax = bbox.minLon + ((vpW - vtx) / vz / vpW) * bboxLonSpan;
    var vpLatMax = bbox.maxLat - ((0 - vty) / vz / vpH) * bboxLatSpan;
    var vpLatMin = bbox.maxLat - ((vpH - vty) / vz / vpH) * bboxLatSpan;
    if (vpLonMin > vpLonMax) { var tmp = vpLonMin; vpLonMin = vpLonMax; vpLonMax = tmp; }
    if (vpLatMin > vpLatMax) { var tmp2 = vpLatMin; vpLatMin = vpLatMax; vpLatMax = tmp2; }
    var lonSpan = Math.max(0.00015, vpLonMax - vpLonMin);
    var zoomRaw = Math.log((vpW * 360) / (256 * lonSpan)) / Math.LN2;
    var minZoom = (provider && provider.minZoom) || 3;
    var providerMaxZoom = (provider && provider.maxZoom) || 20;
    var visualMaxZoom = Math.max(providerMaxZoom, Number(provider && provider.visualMaxZoom) || providerMaxZoom);
    var targetZoom = Math.max(minZoom, zoomRaw + 0.28);
    var mapZoom = clamp(targetZoom, minZoom, providerMaxZoom);
    return {
      centerLon: (vpLonMin + vpLonMax) / 2,
      centerLat: (vpLatMin + vpLatMax) / 2,
      zoom: targetZoom,
      mapZoom: mapZoom,
      overscale: Math.max(1, Math.pow(2, Math.max(0, targetZoom - mapZoom)))
    };
  }

  function geoViewFromNativeMap(stage, centerLon, centerLat, zoom, provider) {
    if (!stage) return null;
    var rect = stage.getBoundingClientRect();
    var vpW = Math.max(320, Number(rect.width || 0));
    var vpH = Math.max(260, Number(rect.height || 0));
    var bbox = geoTileBaseBbox();
    var bboxLonSpan = Math.max(0.000001, bbox.maxLon - bbox.minLon);
    var bboxLatSpan = Math.max(0.000001, bbox.maxLat - bbox.minLat);
    var minZoom = (provider && provider.minZoom) || 3;
    var providerMaxZoom = (provider && provider.maxZoom) || 20;
    var visualMaxZoom = Math.max(providerMaxZoom, Number(provider && provider.visualMaxZoom) || providerMaxZoom);
    var visualZoom = clamp(Number(zoom || minZoom), minZoom, visualMaxZoom);
    var outerZoom =
      (256 * bboxLonSpan * Math.pow(2, visualZoom - 0.28)) /
      (vpW * 360);
    var lonT = (Number(centerLon || bbox.minLon) - bbox.minLon) / bboxLonSpan;
    var latT = (bbox.maxLat - Number(centerLat || bbox.maxLat)) / bboxLatSpan;
    var tx = vpW / 2 - lonT * vpW * outerZoom;
    var ty = vpH / 2 - latT * vpH * outerZoom;
    return {
      zoom: outerZoom,
      tx: tx,
      ty: ty,
      visualZoom: visualZoom
    };
  }

  function geoScaleText(stage, path, q, view) {
    var metersPerPixel = 0;
    if (geoHasOnlineBasemapQuery(q || {})) {
      var provider = geoTileProviderByKey(((q && q.omt_p) || geoDefaultOnlineProvider()));
      var tileView = geoApproxNativeMapView(stage, view, provider);
      if (tileView) {
        metersPerPixel = (156543.03392 * Math.cos((tileView.centerLat * Math.PI) / 180)) / Math.pow(2, tileView.zoom);
      }
    }
    if (!metersPerPixel) {
      metersPerPixel = 5600 / (Math.max(view && view.zoom || 1, 0.01) * 96 / 0.0254) * 100;
    }
    // Pick a nice round distance value for a 60–120px bar
    var niceSteps = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
    var targetBarPx = 80;
    var bestDist = 100;
    var bestWidth = targetBarPx;
    for (var ni = 0; ni < niceSteps.length; ni++) {
      var w = niceSteps[ni] / metersPerPixel;
      if (w >= 40 && w <= 160) {
        bestDist = niceSteps[ni];
        bestWidth = w;
        break;
      }
    }
    var label = bestDist >= 1000 ? (bestDist / 1000) + " km" : bestDist + " m";
    return { label: label, width: Math.round(bestWidth) };
  }

  function geoUpdateScaleBar(stage, path, q, view) {
    var el = stage._cachedScale || (stage._cachedScale = stage.querySelector('[data-role="geo-scale"]'));
    if (!el) return;
    var info = geoScaleText(stage, path, q, view);
    var bar = el.querySelector(".geo-scale-bar");
    var txt = el.querySelector(".geo-scale-label");
    if (bar) bar.style.width = info.width + "px";
    if (txt) txt.textContent = info.label;
  }

  function geoTileSceneZoomLimit(stage, provider) {
    var rect = stage && stage.getBoundingClientRect ? stage.getBoundingClientRect() : null;
    var vpW = Math.max(
      320,
      Number(rect && rect.width) ||
        Number(typeof window !== "undefined" && window.innerWidth) ||
        1280
    );
    var bbox = geoTileBaseBbox();
    var bboxLonSpan = Math.max(0.000001, Number(bbox.maxLon || 0) - Number(bbox.minLon || 0));
    var providerMaxZoom = Math.max(
      3,
      Number(provider && provider.visualMaxZoom) ||
        Number(provider && provider.maxZoom) ||
        20
    );
    var providerBias = 0.28;
    var overscaleHeadroom = 2; // log2(4) — extra levels for CSS overscale
    var effectiveMaxZoom = providerMaxZoom + overscaleHeadroom;
    var requiredOuterZoom =
      (256 * bboxLonSpan * Math.pow(2, effectiveMaxZoom - providerBias)) /
      (vpW * 360);
    return clamp(requiredOuterZoom * 1.22, 24, 8000);
  }

  function geoNativeSceneZoomLimit(stage, provider) {
    return geoTileSceneZoomLimit(stage, provider);
  }

  function geoNativeVisualZoomFloor(stage, provider) {
    var rect = stage && stage.getBoundingClientRect ? stage.getBoundingClientRect() : null;
    var vpW = Math.max(
      320,
      Number(rect && rect.width) ||
        Number(typeof window !== "undefined" && window.innerWidth) ||
        1280
    );
    var bbox = geoTileBaseBbox();
    var bboxLonSpan = Math.max(0.000001, Number(bbox.maxLon || 0) - Number(bbox.minLon || 0));
    var minZoom = Math.max(3, Number(provider && provider.minZoom) || 3);
    var fitZoom = Math.log((vpW * 360) / (256 * bboxLonSpan)) / Math.LN2 + 0.28;
    return clamp(fitZoom - 0.78, minZoom, Math.max(minZoom, Number(provider && provider.maxZoom) || 20));
  }

  function geoSceneZoomFloor(path, q) {
    if (geoIsNativeBasemapQuery(q || {})) {
      var stage = document.querySelector('[data-role="geo-stage"]');
      var provider = geoTileProviderByKey(((q && q.omt_p) || geoDefaultOnlineProvider()));
      var floorVisualZoom = geoNativeVisualZoomFloor(stage, provider);
      var bbox = geoTileBaseBbox();
      var rect = stage && stage.getBoundingClientRect ? stage.getBoundingClientRect() : null;
      var vpW = Math.max(
        320,
        Number(rect && rect.width) ||
          Number(typeof window !== "undefined" && window.innerWidth) ||
          1280
      );
      var bboxLonSpan = Math.max(0.000001, Number(bbox.maxLon || 0) - Number(bbox.minLon || 0));
      var outerZoom =
        (256 * bboxLonSpan * Math.pow(2, floorVisualZoom - 0.28)) /
        (vpW * 360);
      return clamp(outerZoom, 0.65, Math.max(0.65, geoSceneZoomLimit(path, q) - 0.01));
    }
    // In tiled-basemap mode, do not allow zooming out beyond Chengdu city bounds.
    return 1;
  }

  function geoSceneZoomLimit(path, q) {
    var stage = document.querySelector('[data-role="geo-stage"]');
    var provider = geoTileProviderByKey(((q && q.omt_p) || geoDefaultOnlineProvider()));
    if (geoIsNativeBasemapQuery(q || {})) return geoNativeSceneZoomLimit(stage, provider);
    return geoTileSceneZoomLimit(stage, provider);
  }

  function geoInitialZoomLimit(path, q) {
    var level = geoLevelByPath(path);
    var scope = (q && q.scope) || (path === "/gov/geo-park" ? "park" : (level === "district" ? "district" : "street"));
    var isParkFocus = level === "street" && scope === "park" && (q && q.park_mode) !== "all";
    if (level === "district") return 2.6;
    if (level === "street") {
      if (scope === "park") return isParkFocus ? 6.6 : 4.8;
      return 5.4;
    }
    return scope === "park" ? 6.8 : 5.6;
  }

  function geoStageDensityAdjust(path, q, zoom) {
    var level = geoLevelByPath(path);
    var scope = (q && q.scope) || (path === "/gov/geo-park" ? "park" : (level === "district" ? "district" : "street"));
    var isParkFocus = scope === "park" && (q && q.park_mode) !== "all";
    var z = Math.max(1, Number(zoom || 1));

    function shrink(base, rate, min) {
      return clamp(base - Math.max(0, z - 1) * rate, min, 1);
    }

    if (level === "district") {
      return {
        label: shrink(1.02, 0.045, 0.84),
        icon: shrink(1.01, 0.035, 0.9),
        entity: shrink(1.01, 0.04, 0.88),
        road: shrink(1.02, 0.05, 0.84),
        boundary: shrink(1.02, 0.05, 0.84),
        mesh: shrink(1.02, 0.05, 0.86),
        heat: shrink(1.02, 0.06, 0.8),
        card: shrink(1.01, 0.03, 0.92),
      };
    }

    if (level === "street") {
      return {
        label: shrink(1.02, isParkFocus ? 0.085 : 0.075, isParkFocus ? 0.58 : 0.66),
        icon: shrink(1.01, isParkFocus ? 0.06 : 0.055, isParkFocus ? 0.64 : 0.72),
        entity: shrink(1.01, isParkFocus ? 0.065 : 0.06, isParkFocus ? 0.62 : 0.7),
        road: shrink(1.02, isParkFocus ? 0.075 : 0.065, isParkFocus ? 0.58 : 0.68),
        boundary: shrink(1.02, isParkFocus ? 0.09 : 0.08, isParkFocus ? 0.5 : 0.6),
        mesh: shrink(1.02, isParkFocus ? 0.085 : 0.075, isParkFocus ? 0.54 : 0.64),
        heat: shrink(1.02, isParkFocus ? 0.11 : 0.095, isParkFocus ? 0.48 : 0.56),
        card: shrink(1.01, isParkFocus ? 0.06 : 0.05, isParkFocus ? 0.68 : 0.76),
      };
    }

    return {
      label: shrink(1.02, isParkFocus ? 0.1 : 0.09, isParkFocus ? 0.5 : 0.56),
      icon: shrink(1.01, isParkFocus ? 0.075 : 0.07, isParkFocus ? 0.56 : 0.62),
      entity: shrink(1.01, isParkFocus ? 0.08 : 0.075, isParkFocus ? 0.54 : 0.6),
      road: shrink(1.02, isParkFocus ? 0.08 : 0.07, isParkFocus ? 0.56 : 0.64),
      boundary: shrink(1.02, isParkFocus ? 0.12 : 0.11, isParkFocus ? 0.42 : 0.5),
      mesh: shrink(1.02, isParkFocus ? 0.1 : 0.09, isParkFocus ? 0.48 : 0.56),
      heat: shrink(1.02, isParkFocus ? 0.13 : 0.12, isParkFocus ? 0.4 : 0.46),
      card: shrink(1.01, isParkFocus ? 0.07 : 0.06, isParkFocus ? 0.58 : 0.64),
    };
  }

  function geoPanBounds(stage, zoom, axis) {
    var rect = stage && stage.getBoundingClientRect ? _geoStageRect(stage) : null;
    var viewportExtent = Math.max(axis === "x" ? 360 : 280, Number(rect ? (axis === "x" ? rect.width : rect.height) : 0) || 0);
    var z = Math.max(0.4, Number(zoom || 1));
    var scaledExtent = viewportExtent * z;
    var slack = z <= 1.02
      ? 0
      : Math.round(Math.max(36, viewportExtent * (z > 1.6 ? 0.12 : 0.08)));
    if (scaledExtent <= viewportExtent + slack * 2) {
      var centered = (viewportExtent - scaledExtent) / 2;
      return {
        min: Math.round(centered - slack),
        max: Math.round(centered + slack),
      };
    }
    return {
      min: Math.round(viewportExtent - scaledExtent - slack),
      max: Math.round(slack),
    };
  }

  function geoClampViewToStage(stage, view, allowElastic) {
    if (!view) return view;
    var bx = geoPanBounds(stage, view.zoom, "x");
    var by = geoPanBounds(stage, view.zoom, "y");
    if (allowElastic) {
      // Allow 15% overscroll for elastic feel
      var elX = Math.max(40, (bx.max - bx.min) * 0.15);
      var elY = Math.max(40, (by.max - by.min) * 0.15);
      view.tx = clamp(Number(view.tx || 0), bx.min - elX, bx.max + elX);
      view.ty = clamp(Number(view.ty || 0), by.min - elY, by.max + elY);
    } else {
      view.tx = clamp(Number(view.tx || 0), bx.min, bx.max);
      view.ty = clamp(Number(view.ty || 0), by.min, by.max);
    }
    return view;
  }

  function geoZoomTier(path, q, zoom) {
    var level = geoLevelByPath(path);
    var scope = (q && q.scope) || (level === "district" ? "district" : "street");
    var z = Number(zoom || 1);
    if (level === "building") return "high";
    if (level === "district") {
      if (z < 1.55) return "low";
      if (z < 2.15) return "mid";
      return "high";
    }
    if (scope === "park") {
      if ((q && q.park_mode) !== "all") {
        if (z < 3.2) return "low";
        if (z < 5.2) return "mid";
        return "high";
      }
      if (z < 2.2) return "low";
      if (z < 3.9) return "mid";
      return "high";
    }
    if (z < 1.95) return "low";
    if (z < 3.3) return "mid";
    return "high";
  }

  function saveGeoPanelScroll() {
    var el = document.querySelector(".geo-panel-scroll");
    if (!el) return;
    geoPanelScrollTop = Number(el.scrollTop || 0);
  }

  function restoreGeoPanelScroll() {
    var el = document.querySelector(".geo-panel-scroll");
    if (!el) return;
    el.scrollTop = Math.max(0, Number(geoPanelScrollTop || 0));
  }

  function geoBoundsFromRings(rings) {
    var minX = 101;
    var minY = 101;
    var maxX = -1;
    var maxY = -1;
    var hit = false;
    (rings || []).forEach(function (ring) {
      (ring || []).forEach(function (pt) {
        if (!Array.isArray(pt) || pt.length < 2) return;
        var x = clamp(Number(pt[0] || 0), 0, 100);
        var y = clamp(Number(pt[1] || 0), 0, 100);
        if (!isFinite(x) || !isFinite(y)) return;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        hit = true;
      });
    });
    if (!hit) return null;
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function geoMergeBounds(a, b) {
    if (!a && !b) return null;
    if (!a) return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
    if (!b) return { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY };
    return {
      minX: Math.min(a.minX, b.minX),
      minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX),
      maxY: Math.max(a.maxY, b.maxY),
    };
  }

  function geoBoundsFromItem(item, fallbackRx, fallbackRy) {
    var rings = geoItemRings(item);
    var shapeBounds = geoBoundsFromRings(rings);
    if (shapeBounds) return shapeBounds;
    var x = Number(item && item.x);
    var y = Number(item && item.y);
    if (!isFinite(x) || !isFinite(y)) return null;
    var rx = Number(fallbackRx || 2.2);
    var ry = Number(fallbackRy || 1.8);
    return {
      minX: clamp(x - rx, 0, 100),
      minY: clamp(y - ry, 0, 100),
      maxX: clamp(x + rx, 0, 100),
      maxY: clamp(y + ry, 0, 100),
    };
  }

  function geoBoundsForItems(items, fallbackRx, fallbackRy) {
    var out = null;
    (items || []).forEach(function (it) {
      out = geoMergeBounds(out, geoBoundsFromItem(it, fallbackRx, fallbackRy));
    });
    return out;
  }

  function geoExpandBounds(bounds, ratio) {
    if (!bounds) return null;
    var r = Number(ratio || 0);
    var w = Math.max(0.6, bounds.maxX - bounds.minX);
    var h = Math.max(0.6, bounds.maxY - bounds.minY);
    var ex = w * r;
    var ey = h * r;
    return {
      minX: clamp(bounds.minX - ex, 0, 100),
      minY: clamp(bounds.minY - ey, 0, 100),
      maxX: clamp(bounds.maxX + ex, 0, 100),
      maxY: clamp(bounds.maxY + ey, 0, 100),
    };
  }

  function geoFocusBounds(path, q) {
    var geo = geoData();
    var pick = geoResolveForAuto(q || {});
    var level = geoLevelByPath(path);
    var scope = (q && q.scope) || (level === "district" ? "district" : "street");

    if (level === "district") {
      // For Qingyang demo: bias view center toward Qingyang (gd1)
      var qy = (geo.districts || []).find(function (d) { return d.id === "gd1"; });
      var cityPolys = geo && geo.real_city && Array.isArray(geo.real_city.polygons) ? geo.real_city.polygons : [];
      var cityBounds = geoBoundsFromRings(cityPolys);
      if (!cityBounds) cityBounds = geoBoundsForItems((geo && geo.districts) || [], 8, 6);
      if (qy && cityBounds) {
        // Shift bounds center toward Qingyang's position
        var qx = Number(qy.x || 50);
        var qyy = Number(qy.y || 50);
        var cbcx = (cityBounds.minX + cityBounds.maxX) / 2;
        var cbcy = (cityBounds.minY + cityBounds.maxY) / 2;
        var shiftX = (qx - cbcx) * 0.45;
        var shiftY = (qyy - cbcy) * 0.45;
        cityBounds = {
          minX: clamp(cityBounds.minX + shiftX, 0, 100),
          maxX: clamp(cityBounds.maxX + shiftX, 0, 100),
          minY: clamp(cityBounds.minY + shiftY, 0, 100),
          maxY: clamp(cityBounds.maxY + shiftY, 0, 100),
        };
      }
      return geoExpandBounds(cityBounds, 0.008);
    }

    if (level === "street") {
      if (scope === "park") {
        var parkMode = (q && q.park_mode) === "all" ? "all" : "focus";
        var park = pick.park || geoParkById((q && q.pid) || "");
        var parkBounds =
          parkMode === "all"
            ? geoBoundsForItems(pick.parksInDistrict || [], 4.3, 3.4)
            : park
              ? geoBoundsForItems([park], 4.1, 3.2)
              : geoBoundsForItems(pick.parksInDistrict || [], 4.3, 3.4);
        if (!parkBounds && pick.district) parkBounds = geoBoundsForItems([pick.district], 8, 6);
        return geoExpandBounds(parkBounds, parkMode === "all" ? 0.22 : 0.12);
      }
      var street = pick.street || geoStreetById((q && q.sid) || "");
      if (street) return geoExpandBounds(geoBoundsForItems([street], 3.9, 3.1), 0.12);
      var streetBounds = geoBoundsForItems(pick.streetsInDistrict || [], 3.9, 3.1);
      if (!streetBounds && pick.district) streetBounds = geoBoundsForItems([pick.district], 8, 6);
      return geoExpandBounds(streetBounds, 0.14);
    }

    var b = null;
    if (scope === "park") {
      var p = pick.park || geoParkById((q && q.pid) || "");
      if (p) b = geoBoundsForItems([p], 4.1, 3.2);
    } else {
      var s = pick.street || geoStreetById((q && q.sid) || "");
      if (s) b = geoBoundsForItems([s], 3.9, 3.1);
    }
    if (!b && pick.district) b = geoBoundsForItems([pick.district], 8, 6);
    return geoExpandBounds(b, 0.18);
  }

  function geoInitialView(stage, path, q) {
    var bounds = geoFocusBounds(path, q || {});
    if (!stage || !bounds) return { zoom: 1, tx: 0, ty: 0 };

    var rect = stage.getBoundingClientRect();
    var w = Math.max(360, Number(rect.width || 0));
    var h = Math.max(280, Number(rect.height || 0));
    var bw = Math.max(18, ((bounds.maxX - bounds.minX) / 100) * w);
    var bh = Math.max(18, ((bounds.maxY - bounds.minY) / 100) * h);

    var level = geoLevelByPath(path);
    var scope = (q && q.scope) || (level === "district" ? "district" : "street");
    var isParkFocus = level === "street" && scope === "park" && (q && q.park_mode) !== "all";
    var fill = level === "district" ? 0.965 : level === "street" ? (scope === "park" ? (isParkFocus ? 0.98 : 0.92) : 0.97) : (scope === "park" ? 0.9 : 0.92);
    var maxZoom = geoInitialZoomLimit(path, q || {});

    var zoom = clamp(Math.min((w * fill) / bw, (h * fill) / bh), 0.72, maxZoom);
    var cx = ((bounds.minX + bounds.maxX) / 200) * w;
    var cy = ((bounds.minY + bounds.maxY) / 200) * h;
    var tx = w / 2 - cx * zoom;
    var ty = h / 2 - cy * zoom;

    return {
      zoom: Number(zoom.toFixed(3)),
      tx: Number(tx.toFixed(1)),
      ty: Number(ty.toFixed(1)),
    };
  }

  function geoDefaultOnlineProvider() {
    return "tianditu";
  }

  var GEO_TILE_PROVIDERS = {
    amap_native: {
      key: "amap_native",
      name: "高德底图",
      requiresToken: false,
      template: "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x={x}&y={y}&z={z}",
      subdomains: ["1", "2", "3", "4"],
      minZoom: 3,
      maxZoom: 18
    },
    tianditu: {
      key: "tianditu", name: "天地图矢量", requiresToken: true,
      template: "https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk={token}",
      layers: [
        "https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk={token}",
        "https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk={token}"
      ],
      subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"], minZoom: 1, maxZoom: 18
    },
    tianditu_ter: {
      key: "tianditu_ter", name: "天地图地形", requiresToken: true, tokenKey: "tianditu_ter",
      template: "https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk={token}",
      layers: [
        "https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk={token}"
      ],
      subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"], minZoom: 1, maxZoom: 14
    },
    tianditu_img: {
      key: "tianditu_img", name: "天地图影像", requiresToken: true, tokenKey: "tianditu_img",
      template: "https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk={token}",
      layers: [
        "https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&tk={token}"
      ],
      subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"], minZoom: 1, maxZoom: 18
    },
  };
  var GEO_TILE_PROVIDER_ORDER = ["tianditu", "amap_native"];

  function geoTileProviderByKey(key) {
    return GEO_TILE_PROVIDERS[String(key || "").trim()] || GEO_TILE_PROVIDERS.tianditu;
  }

  function geoTileProviderList() {
    return GEO_TILE_PROVIDER_ORDER.map(function (key) {
      return GEO_TILE_PROVIDERS[key];
    }).filter(Boolean);
  }

  function geoTileProviderNeedsToken(providerKey) {
    var provider = geoTileProviderByKey(providerKey);
    return !!provider.requiresToken;
  }

  function geoTileProviderUsesNativeMap(providerKey) {
    var provider = geoTileProviderByKey(providerKey);
    return !!provider.nativeBase;
  }

  function geoTileProviderToken(providerKey) {
    var key = String(providerKey || "").trim();
    return String((geoTileSecrets && geoTileSecrets[key]) || "").trim();
  }

  function geoSetTileProviderToken(providerKey, value) {
    var key = String(providerKey || "").trim();
    if (!key) return;
    if (!geoTileSecrets || typeof geoTileSecrets !== "object") geoTileSecrets = {};
    var next = String(value || "").trim();
    if (next) geoTileSecrets[key] = next;
    else delete geoTileSecrets[key];
    saveGeoTileSecrets(geoTileSecrets);
  }


  function saveGeoTileSecrets(secrets) {
    try { localStorage.setItem("ib_geo_tile_secrets", JSON.stringify(secrets || {})); } catch (e) {}
  }

  function geoAmapSecurityJsCode() {
    return geoTileProviderToken("amap_native_jscode");
  }

  function geoLoadAmapSdk(key) {
    var token = String(key || "").trim();
    if (!token) return Promise.reject(new Error("missing-amap-key"));
    var jsCode = geoAmapSecurityJsCode();
    if (window.AMap && typeof window.AMap.Map === "function") return Promise.resolve(window.AMap);
    if (geoAmapLoaderState.promise && geoAmapLoaderState.key === token) return geoAmapLoaderState.promise;
    geoAmapLoaderState.key = token;
    geoAmapLoaderState.promise = new Promise(function (resolve, reject) {
      var existed = document.getElementById("ib-amap-sdk");
      if (existed && !window.AMap) existed.parentNode.removeChild(existed);
      try {
        if (jsCode) window._AMapSecurityConfig = { securityJsCode: jsCode };
        else if (window._AMapSecurityConfig && window._AMapSecurityConfig.securityJsCode) delete window._AMapSecurityConfig.securityJsCode;
      } catch (e) {}
      var script = document.createElement("script");
      script.id = "ib-amap-sdk";
      script.src = "https://webapi.amap.com/maps?v=2.0&key=" + encodeURIComponent(token);
      script.async = true;
      script.onload = function () {
        if (window.AMap && typeof window.AMap.Map === "function") {
          resolve(window.AMap);
          return;
        }
        geoAmapLoaderState.promise = null;
        reject(new Error("amap-sdk-unavailable"));
      };
      script.onerror = function () {
        geoAmapLoaderState.promise = null;
        reject(new Error("amap-sdk-load-failed"));
      };
      document.head.appendChild(script);
    });
    return geoAmapLoaderState.promise;
  }

  function geoNativeMapLayer(stage) {
    return stage ? stage.querySelector('[data-role="geo-native-map"]') : null;
  }

  function geoNativeMapStatus(layer, message, tone) {
    if (!layer) return;
    var statusEl = layer.querySelector('[data-role="geo-native-map-status"]');
    if (!statusEl) return;
    var msg = String(message || "").trim();
    if (!msg) {
      statusEl.textContent = "";
      statusEl.setAttribute("data-tone", "neutral");
      statusEl.hidden = true;
      return;
    }
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.setAttribute("data-tone", tone || "neutral");
  }

  function geoDestroyNativeMap() {
    if (geoNativeMotionLoopRaf) {
      try { window.cancelAnimationFrame(geoNativeMotionLoopRaf); } catch (e) {}
    }
    geoNativeMotionLoopRaf = 0;
    geoNativeMotionStage = null;
    geoNativeMotionProviderKey = "";
    if (geoNativeMapState.map && typeof geoNativeMapState.map.destroy === "function") {
      try { geoNativeMapState.map.destroy(); } catch (e) {}
    }
    geoNativeMapState = { stage: null, host: null, map: null, syncSig: "", key: "", status: "", ignoreUntil: 0, providerKey: "", visualZoom: 0 };
  }

  function geoNativeClipPolygon(stage, view) {
    var rect = stage && stage.getBoundingClientRect ? stage.getBoundingClientRect() : null;
    if (!rect) return "";
    var vpW = Math.max(320, Number(rect.width || 0));
    var vpH = Math.max(260, Number(rect.height || 0));
    var vz = Math.max(0.05, Number(view && view.zoom || 1));
    var vtx = Number(view && view.tx || 0);
    var vty = Number(view && view.ty || 0);
    var clipRing = _geoTileClipRing || geoPrimaryCityRing({});
    if (!clipRing || clipRing.length < 3) return "";
    return clipRing
      .map(function (pt) {
        var px = clamp(Number(pt[0] || 0), 0, 100);
        var py = clamp(Number(pt[1] || 0), 0, 100);
        var sx = (px / 100 * vz + vtx / vpW) * 100;
        var sy = (py / 100 * vz + vty / vpH) * 100;
        return sx.toFixed(2) + "% " + sy.toFixed(2) + "%";
      })
      .join(", ");
  }

  function geoApplyNativeMapClip(layer, stage, view) {
    if (!layer) return;
    var clipPoly = geoNativeClipPolygon(stage, view);
    if (!clipPoly) {
      layer.style.clipPath = "";
      layer.style.webkitClipPath = "";
      return;
    }
    layer.style.clipPath = "polygon(" + clipPoly + ")";
    layer.style.webkitClipPath = "polygon(" + clipPoly + ")";
  }

  function geoConstrainNativeCenter(stage, centerLon, centerLat, zoom, provider) {
    var bbox = geoTileBaseBbox();
    var next = geoViewFromNativeMap(stage, centerLon, centerLat, zoom, provider);
    if (!next) {
      return {
        centerLon: clamp(Number(centerLon || bbox.minLon), bbox.minLon, bbox.maxLon),
        centerLat: clamp(Number(centerLat || bbox.minLat), bbox.minLat, bbox.maxLat)
      };
    }
    var lonSpan = Math.max(0.000001, (bbox.maxLon - bbox.minLon) / Math.max(0.0001, next.zoom));
    var latSpan = Math.max(0.000001, (bbox.maxLat - bbox.minLat) / Math.max(0.0001, next.zoom));
    var minLon = bbox.minLon + lonSpan / 2;
    var maxLon = bbox.maxLon - lonSpan / 2;
    var minLat = bbox.minLat + latSpan / 2;
    var maxLat = bbox.maxLat - latSpan / 2;
    if (minLon > maxLon) {
      minLon = maxLon = (bbox.minLon + bbox.maxLon) / 2;
    }
    if (minLat > maxLat) {
      minLat = maxLat = (bbox.minLat + bbox.maxLat) / 2;
    }
    return {
      centerLon: clamp(Number(centerLon || minLon), minLon, maxLon),
      centerLat: clamp(Number(centerLat || minLat), minLat, maxLat)
    };
  }

  function geoSyncViewFromNativeMapNow(stage, providerKey, opts) {
    var map = geoNativeMapState.map;
    if (!stage || !map || !document.body.contains(stage)) return;
    var provider = geoTileProviderByKey(providerKey || geoNativeMapState.providerKey || "amap_native");
    if (!provider) return;
    var center = null;
    try {
      center = map.getCenter && map.getCenter();
    } catch (e) {}
    if (!center) return;
    var lng = Number(center.lng != null ? center.lng : center.getLng && center.getLng());
    var lat = Number(center.lat != null ? center.lat : center.getLat && center.getLat());
    var zoom = 0;
    try {
      zoom = Number(map.getZoom && map.getZoom());
    } catch (e) {}
    if (!isFinite(lng) || !isFinite(lat) || !isFinite(zoom)) return;
    var floorZoom = geoNativeVisualZoomFloor(stage, provider);
    if (zoom < floorZoom) {
      zoom = floorZoom;
      if (!(opts && opts.motion)) {
        try {
          geoNativeMapState.ignoreUntil = Date.now() + 90;
          map.setZoom(zoom);
        } catch (e) {}
      }
    }
    var constrained = geoConstrainNativeCenter(stage, lng, lat, zoom, provider);
    if (Math.abs(constrained.centerLon - lng) > 0.000001 || Math.abs(constrained.centerLat - lat) > 0.000001) {
      try {
        geoNativeMapState.ignoreUntil = Date.now() + 90;
        map.setCenter([constrained.centerLon, constrained.centerLat]);
      } catch (e) {}
      lng = constrained.centerLon;
      lat = constrained.centerLat;
    }
    var next = geoViewFromNativeMap(stage, lng, lat, zoom, provider);
    var view = getActiveGeoView();
    if (!next || !view) return;
    view.zoom = Number(next.zoom.toFixed(3));
    view.tx = Number(next.tx.toFixed(1));
    view.ty = Number(next.ty.toFixed(1));
    geoClampViewToStage(stage, view);
    geoNativeMapState.visualZoom = next.visualZoom;
    applyGeoStageView(stage, view, { motion: !!(opts && opts.motion), skipNativeSync: true });
    if (opts && opts.motion) geoMarkStageMoving(stage);
  }

  function geoScheduleViewSyncFromNativeMap(stage, providerKey, opts) {
    if (!stage || Date.now() < Number(geoNativeMapState.ignoreUntil || 0)) return;
    var motion = !!(opts && opts.motion);
    if (motion) {
      var now = Date.now();
      if (now - geoNativeViewSyncLastAt >= 16) {
        geoNativeViewSyncLastAt = now;
        geoSyncViewFromNativeMapNow(stage, providerKey, { motion: true });
        return;
      }
    }
    geoNativeViewSyncReq = {
      stage: stage,
      providerKey: providerKey,
      motion: motion
    };
    if (geoNativeViewSyncRaf) return;
    geoNativeViewSyncRaf = window.requestAnimationFrame(function () {
      geoNativeViewSyncRaf = 0;
      var req = geoNativeViewSyncReq;
      geoNativeViewSyncReq = null;
      if (!req || !req.stage) return;
      geoNativeViewSyncLastAt = Date.now();
      geoSyncViewFromNativeMapNow(req.stage, req.providerKey, { motion: req.motion });
    });
  }

  function geoStopNativeMotionSync() {
    geoNativeMotionStage = null;
    geoNativeMotionProviderKey = "";
    if (!geoNativeMotionLoopRaf) return;
    try { window.cancelAnimationFrame(geoNativeMotionLoopRaf); } catch (e) {}
    geoNativeMotionLoopRaf = 0;
  }

  function geoStartNativeMotionSync(stage, providerKey) {
    if (!stage) return;
    geoNativeMotionStage = stage;
    geoNativeMotionProviderKey = providerKey;
    if (geoNativeMotionLoopRaf) return;
    var tick = function () {
      geoNativeMotionLoopRaf = 0;
      if (!geoNativeMotionStage || !document.body.contains(geoNativeMotionStage)) {
        geoStopNativeMotionSync();
        return;
      }
      geoNativeViewSyncLastAt = Date.now();
      geoSyncViewFromNativeMapNow(geoNativeMotionStage, geoNativeMotionProviderKey, { motion: true });
      geoMarkStageMoving(geoNativeMotionStage);
      geoNativeMotionLoopRaf = window.requestAnimationFrame(tick);
    };
    geoNativeMotionLoopRaf = window.requestAnimationFrame(tick);
  }

  function geoEnsureNativeMapInstance(stage, layer, providerKey, key, AMap) {
    var host = layer ? layer.querySelector('[data-role="geo-native-map-host"]') : null;
    if (!host) return null;
    if (geoNativeMapState.stage !== stage || geoNativeMapState.host !== host || geoNativeMapState.key !== key) {
      geoDestroyNativeMap();
    }
    if (geoNativeMapState.map) return geoNativeMapState.map;
    var map = new AMap.Map(host, {
      viewMode: "2D",
      zooms: [3, 22],
      expandZoomRange: true,
      zoom: 10,
      center: [104.066541, 30.572269],
      mapStyle: "amap://styles/normal",
      features: ["bg", "road", "building", "point"],
      dragEnable: false,
      zoomEnable: false,
      doubleClickZoom: false,
      scrollWheel: false,
      keyboardEnable: false,
      jogEnable: false,
      animateEnable: false,
      rotateEnable: false,
      pitchEnable: false,
      resizeEnable: true,
      showIndoorMap: false,
      defaultCursor: "grab"
    });
    try {
      var minVisualZoom = geoNativeVisualZoomFloor(stage, geoTileProviderByKey(providerKey));
      if (typeof map.setZooms === "function") map.setZooms([minVisualZoom, 22]);
    } catch (e) {}
    try {
      if (AMap.Bounds) {
        var bbox = geoTileBaseBbox();
        map.setLimitBounds(
          new AMap.Bounds([bbox.minLon, bbox.minLat], [bbox.maxLon, bbox.maxLat])
        );
      }
    } catch (e) {}
    try {
      if (AMap.Buildings) map.add(new AMap.Buildings({ zooms: [16, 20], opacity: 0.68 }));
    } catch (e) {}
    // In native-basemap mode the outer GIS viewport remains the single source of
    // truth for pan/zoom. Do not mirror AMap movement back into the outer view,
    // otherwise programmatic setZoomAndCenter calls can fight with outer drag/zoom.
    geoStopNativeMotionSync();
    geoNativeMapState = {
      stage: stage,
      host: host,
      map: map,
      syncSig: "",
      key: key,
      status: "",
      ignoreUntil: 0,
      providerKey: providerKey,
      visualZoom: 10
    };
    return map;
  }

  function geoApplyNativeMapOverscale(host, overscale) {
    if (!host || !host.style) return;
    var scale = clamp(Number(overscale || 1), 1, 16);
    host.style.transformOrigin = "50% 50%";
    host.style.transform = scale > 1.001 ? "scale(" + scale.toFixed(3) + ")" : "";
  }

  function geoSyncNativeMapNow(stage, view) {
    var layer = geoNativeMapLayer(stage);
    if (!layer || layer.getAttribute("data-enabled") !== "1") {
      if (geoNativeMapState.stage && geoNativeMapState.stage !== stage) geoDestroyNativeMap();
      return;
    }
    var provider = geoTileProviderByKey(layer.getAttribute("data-provider") || "amap_native");
    if (!provider || provider.nativeBase !== "amap") return;
    var token = geoTileProviderToken(provider.key);
    geoApplyNativeMapClip(layer, stage, view);
    if (!token) {
      geoNativeMapStatus(layer, "请在左侧“在线地图”中填写高德 JS API Key 后启用原生底图。", "warn");
      if (geoNativeMapState.stage === stage) geoDestroyNativeMap();
      return;
    }
    geoNativeMapStatus(layer, "正在加载高德原生底图…", "neutral");
    geoLoadAmapSdk(token)
      .then(function (AMap) {
        if (!stage || !document.body.contains(stage)) return;
        var activeLayer = geoNativeMapLayer(stage);
        if (!activeLayer || activeLayer.getAttribute("data-enabled") !== "1") return;
        var map = geoEnsureNativeMapInstance(stage, activeLayer, provider.key, token, AMap);
        if (!map) return;
        var amapView = geoApproxNativeMapView(stage, view, provider);
        if (!amapView) return;
        var rect = stage.getBoundingClientRect();
        var zoom = amapView.zoom;
        var mapZoom = Number((amapView.mapZoom != null ? amapView.mapZoom : zoom).toFixed(2));
        var overscale = Math.max(1, Number(amapView.overscale || 1));
        var center = [amapView.centerLon, amapView.centerLat];
        var syncSig = [zoom.toFixed(2), mapZoom.toFixed(2), overscale.toFixed(3), center[0].toFixed(6), center[1].toFixed(6), rect.width | 0, rect.height | 0].join("|");
        if (geoNativeMapState.syncSig !== syncSig) {
          geoNativeMapState.syncSig = syncSig;
          try {
            geoStopNativeMotionSync();
            geoNativeMapState.ignoreUntil = Date.now() + 80;
            geoNativeMapState.visualZoom = zoom;
            map.setFeatures(mapZoom >= 17 ? ["bg", "road", "building", "point"] : ["bg", "road", "point"]);
            map.setZoomAndCenter(mapZoom, center);
            if (typeof map.resize === "function") map.resize();
          } catch (e) {}
        }
        geoApplyNativeMapOverscale(activeLayer.querySelector('[data-role="geo-native-map-host"]'), overscale);
        geoApplyNativeMapClip(activeLayer, stage, view);
        geoNativeMapStatus(activeLayer, "", "neutral");
      })
      .catch(function () {
        geoNativeMapStatus(layer, "高德底图加载失败，请检查 Key 或网络。", "error");
      });
  }

  function scheduleGeoNativeMapSync(stage, view, forceNow) {
    if (!stage || !view) return;
    geoNativeMapReq = {
      stage: stage,
      view: {
        zoom: Number(view.zoom || 1),
        tx: Number(view.tx || 0),
        ty: Number(view.ty || 0)
      }
    };
    if (forceNow) {
      if (geoNativeMapRaf) window.cancelAnimationFrame(geoNativeMapRaf);
      geoNativeMapRaf = 0;
      geoSyncNativeMapNow(stage, geoNativeMapReq.view);
      return;
    }
    if (geoNativeMapRaf) return;
    geoNativeMapRaf = window.requestAnimationFrame(function () {
      geoNativeMapRaf = 0;
      var req = geoNativeMapReq;
      geoNativeMapReq = null;
      if (!req || !req.stage || !document.body.contains(req.stage)) return;
      geoSyncNativeMapNow(req.stage, req.view);
    });
  }

  function geoTileBaseBbox() {
    var fallback = { minLon: 102.964319, maxLon: 104.925947, minLat: 30.069429, maxLat: 31.455507 };
    var real = (geoReal && geoReal.bbox) || {};
    var meta = (geoBasemapDetailRaw && geoBasemapDetailRaw.meta && geoBasemapDetailRaw.meta.bbox) || {};
    var src =
      isFinite(Number(real.minLon)) &&
      isFinite(Number(real.maxLon)) &&
      isFinite(Number(real.minLat)) &&
      isFinite(Number(real.maxLat))
        ? real
        : meta;
    var minLon = Number(src.minLon);
    var maxLon = Number(src.maxLon);
    var minLat = Number(src.minLat);
    var maxLat = Number(src.maxLat);
    if (!isFinite(minLon) || !isFinite(maxLon) || !isFinite(minLat) || !isFinite(maxLat) || maxLon <= minLon || maxLat <= minLat) {
      return fallback;
    }
    var bounded = {
      minLon: Math.max(fallback.minLon, minLon),
      maxLon: Math.min(fallback.maxLon, maxLon),
      minLat: Math.max(fallback.minLat, minLat),
      maxLat: Math.min(fallback.maxLat, maxLat),
    };
    if (bounded.maxLon <= bounded.minLon || bounded.maxLat <= bounded.minLat) return fallback;
    return bounded;
  }

  function geoPctToLon(x, bbox) {
    var b = bbox || geoTileBaseBbox();
    var t = Number(x || 0) / 100;
    return b.minLon + (b.maxLon - b.minLon) * t;
  }

  function geoPctToLat(y, bbox) {
    var b = bbox || geoTileBaseBbox();
    var t = Number(y || 0) / 100;
    return b.maxLat - (b.maxLat - b.minLat) * t;
  }

  function geoLonToPct(lon, bbox) {
    var b = bbox || geoTileBaseBbox();
    return ((Number(lon || b.minLon) - b.minLon) / Math.max(1e-9, b.maxLon - b.minLon)) * 100;
  }

  function geoLatToPct(lat, bbox) {
    var b = bbox || geoTileBaseBbox();
    return ((b.maxLat - Number(lat || b.maxLat)) / Math.max(1e-9, b.maxLat - b.minLat)) * 100;
  }

  function geoLonToTileX(lon, z) {
    var n = Math.pow(2, z);
    return ((Number(lon || 0) + 180) / 360) * n;
  }

  function geoLatToTileY(lat, z) {
    var latC = clamp(Number(lat || 0), -85.05112878, 85.05112878);
    var rad = (latC * Math.PI) / 180;
    var n = Math.pow(2, z);
    return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  }

  function geoTileXToLon(x, z) {
    var n = Math.pow(2, z);
    return (Number(x || 0) / n) * 360 - 180;
  }

  function geoTileYToLat(y, z) {
    var n = Math.PI - (2 * Math.PI * Number(y || 0)) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  function geoTileTemplateUrl(template, provider, z, x, y, layerIdx) {
    var p = provider || GEO_TILE_PROVIDERS.geoq;
    var token = geoTileProviderToken(p.key);
    var subdomains = Array.isArray(p.subdomains) ? p.subdomains : [];
    var subdomain = subdomains.length ? subdomains[(Math.abs(Number(x || 0)) + Math.abs(Number(y || 0)) + Number(layerIdx || 0)) % subdomains.length] : "";
    return String(template || "")
      .replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y))
      .replace("{s}", String(subdomain))
      .replace("{token}", encodeURIComponent(token));
  }

  function geoTileUrls(provider, z, x, y) {
    var p = provider || GEO_TILE_PROVIDERS.geoq;
    var layers = Array.isArray(p.layers) && p.layers.length ? p.layers.slice() : [p.template];
    return layers
      .map(function (template, idx) {
        return geoTileTemplateUrl(template, p, z, x, y, idx);
      })
      .filter(Boolean);
  }

  function geoVisibleMapPctBounds(stage, view) {
    if (!stage || !view) return null;
    var rect = stage.getBoundingClientRect();
    var w = Math.max(320, Number(rect.width || 0));
    var h = Math.max(260, Number(rect.height || 0));
    var z = Math.max(0.05, Number(view.zoom || 1));
    var tx = Number(view.tx || 0);
    var ty = Number(view.ty || 0);
    var x0 = ((0 - tx) / z / w) * 100;
    var x1 = ((w - tx) / z / w) * 100;
    var y0 = ((0 - ty) / z / h) * 100;
    var y1 = ((h - ty) / z / h) * 100;
    return {
      minX: Math.min(x0, x1),
      maxX: Math.max(x0, x1),
      minY: Math.min(y0, y1),
      maxY: Math.max(y0, y1),
      widthPx: w,
      heightPx: h,
    };
  }

  function renderGeoOnlineTilesNow(stage, view) {
    if (!stage || !view) return;
    var c = _geoGetCached(stage);
    var layer = c.tileLayer;
    if (!layer) return;
    if (layer.getAttribute("data-enabled") !== "1") {
      if (layer.innerHTML) layer.innerHTML = "";
      layer.removeAttribute("data-signature");
      layer.style.clipPath = "";
      layer.style.webkitClipPath = "";
      return;
    }

    var provider = geoTileProviderByKey(layer.getAttribute("data-provider") || geoDefaultOnlineProvider());
    if (provider.requiresToken && !geoTileProviderToken(provider.key)) {
      if (layer.innerHTML) layer.innerHTML = "";
      layer.setAttribute("data-signature", provider.key + "|missing-token");
      return;
    }

    var rect = _geoStageRect(stage);
    var vpW = Math.max(320, Number(rect.width || 0));
    var vpH = Math.max(260, Number(rect.height || 0));
    var vz = Math.max(0.05, Number(view.zoom || 1));
    var vtx = Number(view.tx || 0);
    var vty = Number(view.ty || 0);
    var bbox = geoTileBaseBbox();
    var bboxLonSpan = bbox.maxLon - bbox.minLon;
    var bboxLatSpan = bbox.maxLat - bbox.minLat;

    // Visible geographic bounds in the viewport
    var vpLonMin = bbox.minLon + ((0 - vtx) / vz / vpW) * bboxLonSpan;
    var vpLonMax = bbox.minLon + ((vpW - vtx) / vz / vpW) * bboxLonSpan;
    var vpLatMax = bbox.maxLat - ((0 - vty) / vz / vpH) * bboxLatSpan;
    var vpLatMin = bbox.maxLat - ((vpH - vty) / vz / vpH) * bboxLatSpan;
    if (vpLonMin > vpLonMax) { var tmp = vpLonMin; vpLonMin = vpLonMax; vpLonMax = tmp; }
    if (vpLatMin > vpLatMax) { var tmp2 = vpLatMin; vpLatMin = vpLatMax; vpLatMax = tmp2; }
    var lonSpan = Math.max(0.002, vpLonMax - vpLonMin);

    // Compute tile zoom: target ~256px per tile on screen
    var zoomRaw = Math.log((vpW * 360) / (256 * lonSpan)) / Math.LN2;
    var zoomBias = 0.3;
    var z = clamp(Math.round(zoomRaw + zoomBias), provider.minZoom, provider.maxZoom);

    function tileSpanAt(zoomLevel) {
      var n = Math.pow(2, zoomLevel);
      var tx0 = clamp(Math.floor(geoLonToTileX(vpLonMin, zoomLevel)) - 1, 0, n - 1);
      var tx1 = clamp(Math.floor(geoLonToTileX(vpLonMax, zoomLevel)) + 1, 0, n - 1);
      var ty0 = clamp(Math.floor(geoLatToTileY(vpLatMax, zoomLevel)) - 1, 0, n - 1);
      var ty1 = clamp(Math.floor(geoLatToTileY(vpLatMin, zoomLevel)) + 1, 0, n - 1);
      var cx = Math.max(0, tx1 - tx0 + 1);
      var cy = Math.max(0, ty1 - ty0 + 1);
      return { z: zoomLevel, n: n, tx0: tx0, tx1: tx1, ty0: ty0, ty1: ty1, count: cx * cy };
    }

    var tileBudget = stage.getAttribute("data-switching") === "1" ? 96 : 256;
    var span = tileSpanAt(z);
    while (span.count > tileBudget && z > provider.minZoom) {
      z -= 1;
      span = tileSpanAt(z);
    }

    // Include rounded view state in signature so tiles update on pan/zoom
    var sigVz = (vz * 100 | 0);
    var sigTx = (vtx * 10 | 0);
    var sigTy = (vty * 10 | 0);
    var signature = [provider.key, span.z, span.tx0, span.tx1, span.ty0, span.ty1, sigVz, sigTx, sigTy].join("|");
    if (layer.getAttribute("data-signature") === signature) return;

    var html = [];
    for (var ty = span.ty0; ty <= span.ty1; ty++) {
      for (var tx = span.tx0; tx <= span.tx1; tx++) {
        var wrappedX = ((tx % span.n) + span.n) % span.n;
        var lonL = geoTileXToLon(tx, span.z);
        var lonR = geoTileXToLon(tx + 1, span.z);
        var latT = geoTileYToLat(ty, span.z);
        var latB = geoTileYToLat(ty + 1, span.z);

        // Convert geographic coords to canvas fraction
        var pctL = (lonL - bbox.minLon) / bboxLonSpan;
        var pctR = (lonR - bbox.minLon) / bboxLonSpan;
        var pctT = (bbox.maxLat - latT) / bboxLatSpan;
        var pctB = (bbox.maxLat - latB) / bboxLatSpan;

        // Canvas pixel coords (unscaled)
        var cxL = Math.min(pctL, pctR) * vpW;
        var cxR = Math.max(pctL, pctR) * vpW;
        var cyT = Math.min(pctT, pctB) * vpH;
        var cyB = Math.max(pctT, pctB) * vpH;

        // Apply canvas transform → viewport pixel coords
        var screenLeft = cxL * vz + vtx;
        var screenTop = cyT * vz + vty;
        var screenW = (cxR - cxL) * vz;
        var screenH = (cyB - cyT) * vz;

        // Cull tiles fully outside viewport
        if (screenLeft + screenW < -screenW || screenLeft > vpW + screenW) continue;
        if (screenTop + screenH < -screenH || screenTop > vpH + screenH) continue;

        geoTileUrls(provider, span.z, wrappedX, ty).forEach(function (url, layerIdx) {
          var cached = _geoTileImageCache[url];
          var fadeClass = cached === 2 ? ' cached' : ' loading';
          html.push(
            '<img class="geo-online-tile layer-' +
              layerIdx + fadeClass +
              '" alt="" referrerpolicy="no-referrer" onload="this.classList.remove(\'loading\');this.classList.add(\'cached\')" onerror="if(!this.dataset.r||this.dataset.r<2){this.dataset.r=(+this.dataset.r||0)+1;var s=this;setTimeout(function(){s.src=s.src},600*s.dataset.r)}else{this.style.display=\'none\'}" src="' +
              esc(url) +
              '" style="left:' +
              screenLeft.toFixed(1) +
              "px;top:" +
              screenTop.toFixed(1) +
              "px;width:" +
              screenW.toFixed(1) +
              "px;height:" +
              screenH.toFixed(1) +
              'px;" />'
          );
          if (!cached) geoPreloadTile(url);
        });
      }
    }
    // Tile retention: keep old tiles visible while new ones load (like consumer maps)
    var newHtml = html.join("");
    var oldChildren = layer.children;
    if (oldChildren.length > 0 && newHtml) {
      // Move old tiles into a stale container that fades out
      var stale = layer.querySelector(".geo-tile-stale");
      if (stale) stale.remove(); // remove previous stale batch
      stale = document.createElement("div");
      stale.className = "geo-tile-stale";
      stale.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:1;transition:opacity .5s ease-out .1s;z-index:0;";
      // Move live tiles (not previous stale) into stale container
      while (layer.firstChild) stale.appendChild(layer.firstChild);
      layer.appendChild(stale);
      // Insert fresh tiles (they render above the stale layer due to DOM order)
      layer.insertAdjacentHTML("beforeend", newHtml);
      // Trigger fade-out of stale tiles
      void stale.offsetHeight;
      stale.style.opacity = "0";
      setTimeout(function () { if (stale.parentNode) stale.remove(); }, 650);
    } else {
      layer.innerHTML = newHtml;
    }
    layer.setAttribute("data-signature", signature);
    // Store the view state used for this render, for motion sync
    layer.setAttribute("data-render-zoom", String(vz));
    layer.setAttribute("data-render-tx", String(vtx));
    layer.setAttribute("data-render-ty", String(vty));
    _geoTileRenderState.zoom = vz;
    _geoTileRenderState.tx = vtx;
    _geoTileRenderState.ty = vty;
    layer.style.transform = "";
    layer.style.transformOrigin = "";
    // Clip tile layer to current area boundary (street/park/city depending on zoom level)
    // Skip clip at high zoom — coordinates overflow and tiles are already culled to viewport
    if (vz > 10) {
      layer.style.clipPath = "";
      layer.style.webkitClipPath = "";
    } else {
      var clipRing = _geoTileClipRing || geoPrimaryCityRing({});
      if (clipRing && clipRing.length >= 3) {
        var clipParts = [];
        for (var ci = 0; ci < clipRing.length; ci++) {
          var px = clamp(Number(clipRing[ci][0] || 0), 0, 100);
          var py = clamp(Number(clipRing[ci][1] || 0), 0, 100);
          var sx = (px / 100 * vz + vtx / vpW) * 100;
          var sy = (py / 100 * vz + vty / vpH) * 100;
          clipParts.push(sx.toFixed(2) + "% " + sy.toFixed(2) + "%");
        }
        var clipVal = "polygon(" + clipParts.join(", ") + ")";
        layer.style.clipPath = clipVal;
        layer.style.webkitClipPath = clipVal;
      } else {
        layer.style.clipPath = "";
        layer.style.webkitClipPath = "";
      }
    }
  }

  // Tile image preload cache — keeps decoded images across tile refreshes
  var _geoTileImageCache = {};
  var _geoTileImageCacheSize = 0;

  // Terrain tile render state (separate from main tile layer)
  var _geoTerrainRenderState = { zoom: 1, tx: 0, ty: 0 };

  function renderGeoTerrainTilesNow(stage, view) {
    if (!stage || !view) return;
    var layer = stage.querySelector('[data-role="geo-terrain-tiles"]');
    if (!layer) return;
    // Use satellite imagery for urban areas — much more recognizable than terrain elevation
    var provider = GEO_TILE_PROVIDERS.tianditu_img || GEO_TILE_PROVIDERS.tianditu_ter;
    if (!provider) return;
    var tokenKey = provider.tokenKey || provider.key;
    var token = geoTileProviderToken(tokenKey);
    if (!token) return;

    var rect = _geoStageRect(stage);
    var vpW = Math.max(320, Number(rect.width || 0));
    var vpH = Math.max(260, Number(rect.height || 0));
    var vz = Math.max(0.05, Number(view.zoom || 1));
    var vtx = Number(view.tx || 0);
    var vty = Number(view.ty || 0);
    var bbox = geoTileBaseBbox();
    var bboxLonSpan = bbox.maxLon - bbox.minLon;
    var bboxLatSpan = bbox.maxLat - bbox.minLat;

    var vpLonMin = bbox.minLon + ((0 - vtx) / vz / vpW) * bboxLonSpan;
    var vpLonMax = bbox.minLon + ((vpW - vtx) / vz / vpW) * bboxLonSpan;
    var vpLatMax = bbox.maxLat - ((0 - vty) / vz / vpH) * bboxLatSpan;
    var vpLatMin = bbox.maxLat - ((vpH - vty) / vz / vpH) * bboxLatSpan;
    if (vpLonMin > vpLonMax) { var tmp = vpLonMin; vpLonMin = vpLonMax; vpLonMax = tmp; }
    if (vpLatMin > vpLatMax) { var tmp2 = vpLatMin; vpLatMin = vpLatMax; vpLatMax = tmp2; }
    var lonSpan = Math.max(0.002, vpLonMax - vpLonMin);

    var zoomRaw = Math.log((vpW * 360) / (256 * lonSpan)) / Math.LN2;
    // Use lower zoom for terrain (less tiles needed, terrain is coarser)
    var z = clamp(Math.round(zoomRaw), provider.minZoom, provider.maxZoom);

    var n = Math.pow(2, z);
    var tx0 = clamp(Math.floor(geoLonToTileX(vpLonMin, z)) - 1, 0, n - 1);
    var tx1 = clamp(Math.floor(geoLonToTileX(vpLonMax, z)) + 1, 0, n - 1);
    var ty0 = clamp(Math.floor(geoLatToTileY(vpLatMax, z)) - 1, 0, n - 1);
    var ty1 = clamp(Math.floor(geoLatToTileY(vpLatMin, z)) + 1, 0, n - 1);
    var tileCount = Math.max(0, tx1 - tx0 + 1) * Math.max(0, ty1 - ty0 + 1);
    // Budget: fewer tiles for terrain
    while (tileCount > 64 && z > provider.minZoom) {
      z -= 1;
      n = Math.pow(2, z);
      tx0 = clamp(Math.floor(geoLonToTileX(vpLonMin, z)) - 1, 0, n - 1);
      tx1 = clamp(Math.floor(geoLonToTileX(vpLonMax, z)) + 1, 0, n - 1);
      ty0 = clamp(Math.floor(geoLatToTileY(vpLatMax, z)) - 1, 0, n - 1);
      ty1 = clamp(Math.floor(geoLatToTileY(vpLatMin, z)) + 1, 0, n - 1);
      tileCount = Math.max(0, tx1 - tx0 + 1) * Math.max(0, ty1 - ty0 + 1);
    }

    var sigVz = (vz * 100 | 0);
    var sigTx = (vtx * 10 | 0);
    var sigTy = (vty * 10 | 0);
    var signature = ["ter", z, tx0, tx1, ty0, ty1, sigVz, sigTx, sigTy].join("|");
    if (layer.getAttribute("data-signature") === signature) return;

    var html = [];
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        var wrappedX = ((tx % n) + n) % n;
        var lonL = geoTileXToLon(tx, z);
        var lonR = geoTileXToLon(tx + 1, z);
        var latT = geoTileYToLat(ty, z);
        var latB = geoTileYToLat(ty + 1, z);

        var pctL = (lonL - bbox.minLon) / bboxLonSpan;
        var pctR = (lonR - bbox.minLon) / bboxLonSpan;
        var pctT = (bbox.maxLat - latT) / bboxLatSpan;
        var pctB = (bbox.maxLat - latB) / bboxLatSpan;

        var cxL = Math.min(pctL, pctR) * vpW;
        var cxR = Math.max(pctL, pctR) * vpW;
        var cyT = Math.min(pctT, pctB) * vpH;
        var cyB = Math.max(pctT, pctB) * vpH;

        var screenLeft = cxL * vz + vtx;
        var screenTop = cyT * vz + vty;
        var screenW = (cxR - cxL) * vz;
        var screenH = (cyB - cyT) * vz;

        if (screenLeft + screenW < -screenW || screenLeft > vpW + screenW) continue;
        if (screenTop + screenH < -screenH || screenTop > vpH + screenH) continue;

        geoTileUrls(provider, z, wrappedX, ty).forEach(function (url) {
          var cached = _geoTileImageCache[url];
          var fadeClass = cached === 2 ? ' cached' : ' loading';
          html.push(
            '<img class="geo-terrain-tile' + fadeClass +
            '" alt="" referrerpolicy="no-referrer" onload="this.classList.remove(\'loading\');this.classList.add(\'cached\')" onerror="this.style.display=\'none\'" src="' +
            esc(url) +
            '" style="left:' + screenLeft.toFixed(1) +
            'px;top:' + screenTop.toFixed(1) +
            'px;width:' + screenW.toFixed(1) +
            'px;height:' + screenH.toFixed(1) +
            'px;" />'
          );
          if (!cached) geoPreloadTile(url);
        });
      }
    }
    layer.innerHTML = html.join("");
    layer.setAttribute("data-signature", signature);
    layer.setAttribute("data-render-zoom", String(vz));
    layer.setAttribute("data-render-tx", String(vtx));
    layer.setAttribute("data-render-ty", String(vty));
    _geoTerrainRenderState.zoom = vz;
    _geoTerrainRenderState.tx = vtx;
    _geoTerrainRenderState.ty = vty;
    layer.style.transform = "";
  }

  function syncTerrainLayerMotion(stage, view) {
    if (!stage || !view) return;
    var layer = stage.querySelector('[data-role="geo-terrain-tiles"]');
    if (!layer) return;
    var rz = _geoTerrainRenderState.zoom || 1;
    var rtx = _geoTerrainRenderState.tx || 0;
    var rty = _geoTerrainRenderState.ty || 0;
    var vz = Math.max(0.05, Number(view.zoom || 1));
    var vtx = Number(view.tx || 0);
    var vty = Number(view.ty || 0);
    var scaleRatio = clamp(vz / rz, 0.35, 2.85);
    var dtx = vtx - rtx * scaleRatio;
    var dty = vty - rty * scaleRatio;
    layer.style.transform = "translate(" + dtx.toFixed(1) + "px," + dty.toFixed(1) + "px) scale(" + scaleRatio.toFixed(4) + ")";
  }
  var _GEO_TILE_CACHE_LIMIT = 400;
  var _geoTileRetryCount = {};
  function geoPreloadTile(url) {
    if (_geoTileImageCache[url]) return;
    if (_geoTileImageCacheSize >= _GEO_TILE_CACHE_LIMIT) {
      var keys = Object.keys(_geoTileImageCache);
      for (var i = 0; i < 80 && i < keys.length; i++) { delete _geoTileImageCache[keys[i]]; }
      _geoTileImageCacheSize = Object.keys(_geoTileImageCache).length;
    }
    var img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = function () { _geoTileImageCache[url] = 2; };
    img.onerror = function () {
      var retries = Number(_geoTileRetryCount[url] || 0);
      if (retries < 2) {
        _geoTileRetryCount[url] = retries + 1;
        delete _geoTileImageCache[url];
        _geoTileImageCacheSize = Math.max(0, _geoTileImageCacheSize - 1);
        setTimeout(function () { geoPreloadTile(url); }, 800 * (retries + 1));
      } else {
        _geoTileImageCache[url] = -1;
      }
    };
    _geoTileImageCache[url] = 1;
    _geoTileImageCacheSize++;
    img.src = url;
  }

  // Preload one ring of tiles around current viewport for smoother panning
  function geoPreloadAdjacentTiles(stage, view) {
    if (!stage || !view) return;
    var c = _geoGetCached(stage);
    var layer = c.tileLayer;
    if (!layer || layer.getAttribute("data-enabled") !== "1") return;
    var provider = geoTileProviderByKey(layer.getAttribute("data-provider") || geoDefaultOnlineProvider());
    if (provider.requiresToken && !geoTileProviderToken(provider.key)) return;
    var rect = _geoStageRect(stage);
    var vpW = Math.max(320, Number(rect.width || 0));
    var vpH = Math.max(260, Number(rect.height || 0));
    var vz = Math.max(0.05, Number(view.zoom || 1));
    var vtx = Number(view.tx || 0);
    var vty = Number(view.ty || 0);
    var bbox = geoTileBaseBbox();
    var bboxLonSpan = bbox.maxLon - bbox.minLon;
    var bboxLatSpan = bbox.maxLat - bbox.minLat;
    var vpLonMin = bbox.minLon + ((0 - vtx) / vz / vpW) * bboxLonSpan;
    var vpLonMax = bbox.minLon + ((vpW - vtx) / vz / vpW) * bboxLonSpan;
    var vpLatMax = bbox.maxLat - ((0 - vty) / vz / vpH) * bboxLatSpan;
    var vpLatMin = bbox.maxLat - ((vpH - vty) / vz / vpH) * bboxLatSpan;
    if (vpLonMin > vpLonMax) { var t1 = vpLonMin; vpLonMin = vpLonMax; vpLonMax = t1; }
    if (vpLatMin > vpLatMax) { var t2 = vpLatMin; vpLatMin = vpLatMax; vpLatMax = t2; }
    var zoomRaw = Math.log((vpW * 360) / (256 * Math.max(0.002, vpLonMax - vpLonMin))) / Math.LN2;
    var z = clamp(Math.round(zoomRaw + 0.3), provider.minZoom, provider.maxZoom);
    var n = Math.pow(2, z);
    // Expand by 1 tile in each direction
    var tx0 = clamp(Math.floor(geoLonToTileX(vpLonMin, z)) - 2, 0, n - 1);
    var tx1 = clamp(Math.floor(geoLonToTileX(vpLonMax, z)) + 2, 0, n - 1);
    var ty0 = clamp(Math.floor(geoLatToTileY(vpLatMax, z)) - 2, 0, n - 1);
    var ty1 = clamp(Math.floor(geoLatToTileY(vpLatMin, z)) + 2, 0, n - 1);
    var count = 0;
    for (var ty = ty0; ty <= ty1 && count < 40; ty++) {
      for (var tx = tx0; tx <= tx1 && count < 40; tx++) {
        var wrappedX = ((tx % n) + n) % n;
        geoTileUrls(provider, z, wrappedX, ty).forEach(function (url) {
          if (!_geoTileImageCache[url]) { geoPreloadTile(url); count++; }
        });
      }
    }
  }

  // Cache frequently accessed sub-elements per stage to avoid querySelector on hot path
  var _geoStageCache = null;
  var _geoStageCacheKey = null;
  function _geoGetCached(stage) {
    if (_geoStageCacheKey === stage && _geoStageCache) return _geoStageCache;
    var vp = stage.querySelector('[data-role="geo-viewport"]');
    _geoStageCache = {
      viewport: vp,
      tileLayer: vp ? vp.querySelector('[data-role="geo-online-tiles"]') : null,
      overlay: stage.querySelector('[data-role="geo-icon-overlay"]'),
      canvas: stage.querySelector('[data-role="geo-canvas"]'),
    };
    _geoStageCacheKey = stage;
    return _geoStageCache;
  }

  // Cache getBoundingClientRect per frame to avoid forced reflows
  var _geoRectCache = null;
  var _geoRectCacheFrame = -1;
  function _geoStageRect(stage) {
    var frame = _geoRectCacheFrame;
    if (frame === _geoCurrentFrame && _geoRectCache) return _geoRectCache;
    _geoRectCache = stage.getBoundingClientRect();
    _geoRectCacheFrame = _geoCurrentFrame;
    return _geoRectCache;
  }
  var _geoCurrentFrame = 0;

  // During drag/zoom, apply a CSS transform to keep tiles visually in sync
  // Cache last tile render state in JS to avoid DOM getAttribute reads per frame
  var _geoTileRenderState = { zoom: 1, tx: 0, ty: 0 };
  function syncTileLayerMotion(stage, view) {
    if (!stage || !view) return;
    var c = _geoGetCached(stage);
    var layer = c.tileLayer;
    if (!layer) return;
    var rz = _geoTileRenderState.zoom || 1;
    var rtx = _geoTileRenderState.tx || 0;
    var rty = _geoTileRenderState.ty || 0;
    var vz = Math.max(0.05, Number(view.zoom || 1));
    var vtx = Number(view.tx || 0);
    var vty = Number(view.ty || 0);
    var scaleRatio = vz / rz;
    // If scaleRatio is too extreme, avoid a synchronous tile rebuild on the hot
    // interaction path. Keep a clamped visual transform first, then let the
    // normal deferred render path refresh the tiles after motion settles.
    if (scaleRatio > 4 || scaleRatio < 0.25) {
      scheduleGeoOnlineTileRender(stage, view, false);
      scaleRatio = clamp(scaleRatio, 0.35, 2.85);
    }
    var dtx = vtx - rtx * scaleRatio;
    var dty = vty - rty * scaleRatio;
    layer.style.transform = "translate(" + dtx.toFixed(1) + "px," + dty.toFixed(1) + "px) scale(" + scaleRatio.toFixed(4) + ")";
  }

  // Keep icon overlay in sync with canvas during drag/zoom (same pattern as tile layer)
  // Cache last overlay render state in JS to avoid DOM reads per frame
  var _geoOverlayRenderState = { zoom: 0, tx: 0, ty: 0 };
  function syncGeoIconOverlayMotion(stage, view) {
    if (!stage || !view) return;
    var overlay = _geoGetCached(stage).overlay;
    if (!overlay || !_geoOverlayRenderState.zoom) return;
    var rz = _geoOverlayRenderState.zoom || 1;
    var rtx = _geoOverlayRenderState.tx || 0;
    var rty = _geoOverlayRenderState.ty || 0;
    var vz = Math.max(0.05, Number(view.zoom || 1));
    var vtx = Number(view.tx || 0);
    var vty = Number(view.ty || 0);
    var scaleRatio = vz / rz;
    var dtx = vtx - rtx * scaleRatio;
    var dty = vty - rty * scaleRatio;
    overlay.style.transform = "translate(" + dtx.toFixed(1) + "px," + dty.toFixed(1) + "px) scale(" + scaleRatio.toFixed(4) + ")";
    // Counter-scale icons to maintain constant screen size — skip setProperty during motion
    // since icons are hidden via CSS .is-moving rule anyway
  }

  // Reposition icons to screen coordinates & reset overlay transform
  function renderGeoIconOverlayPositions(stage, view) {
    if (!stage || !view) return;
    var overlay = _geoGetCached(stage).overlay;
    if (!overlay) return;
    var rect = _geoStageRect(stage);
    var vpW = Math.max(320, Number(rect.width || 0));
    var vpH = Math.max(260, Number(rect.height || 0));
    var vz = Math.max(0.05, Number(view.zoom || 1));
    var vtx = Number(view.tx || 0);
    var vty = Number(view.ty || 0);
    // Batch-read all data-ox/oy first, then batch-write styles to avoid layout thrashing
    var icons = overlay.querySelectorAll("[data-ox]");
    var len = icons.length;
    var positions = new Array(len);
    // Margin outside viewport before culling (px)
    var cull = 60;
    for (var i = 0; i < len; i++) {
      // Cache parsed percentage as JS property to avoid repeated getAttribute+parseFloat
      var el = icons[i];
      if (el._pctX === undefined) {
        el._pctX = parseFloat(el.getAttribute("data-ox")) / 100;
        el._pctY = parseFloat(el.getAttribute("data-oy")) / 100;
      }
      positions[i] = [
        el._pctX * vpW * vz + vtx,
        el._pctY * vpH * vz + vty
      ];
    }
    for (var j = 0; j < len; j++) {
      var px = positions[j][0];
      var py = positions[j][1];
      // Viewport culling: hide icons far outside the visible area
      if (px < -cull || px > vpW + cull || py < -cull || py > vpH + cull) {
        if (!icons[j]._culled) { icons[j].style.display = "none"; icons[j]._culled = true; }
      } else {
        if (icons[j]._culled) { icons[j].style.display = ""; icons[j]._culled = false; }
        icons[j].style.left = px.toFixed(1) + "px";
        icons[j].style.top = py.toFixed(1) + "px";
      }
    }
    overlay.setAttribute("data-render-zoom", String(vz));
    overlay.setAttribute("data-render-tx", String(vtx));
    overlay.setAttribute("data-render-ty", String(vty));
    _geoOverlayRenderState.zoom = vz;
    _geoOverlayRenderState.tx = vtx;
    _geoOverlayRenderState.ty = vty;
    overlay.style.transform = "";
    overlay.style.setProperty("--geo-overlay-counter-scale", "1");
  }

  function scheduleGeoOnlineTileRender(stage, view, forceNow) {
    if (!stage || !view) return;
    geoTileRenderReq = {
      stage: stage,
      view: {
        zoom: Number(view.zoom || 1),
        tx: Number(view.tx || 0),
        ty: Number(view.ty || 0),
      },
    };
    if (!forceNow && stage.classList && stage.classList.contains("is-moving")) return;
    if (geoTileRenderRaf) return;
    geoTileRenderRaf = window.requestAnimationFrame(function () {
      geoTileRenderRaf = 0;
      var req = geoTileRenderReq;
      geoTileRenderReq = null;
      if (!req || !req.stage || !document.body.contains(req.stage)) return;
      renderGeoOnlineTilesNow(req.stage, req.view);
      renderGeoTerrainTilesNow(req.stage, req.view);
    });
  }

  function geoViewportCenter(stage) {
    if (!stage || !stage.getBoundingClientRect) return { x: 0, y: 0 };
    var rect = _geoStageRect(stage);
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function geoSetZoomAroundPoint(stage, view, nextZoom, clientX, clientY) {
    if (!stage || !view) return;
    var rect = _geoStageRect(stage);
    var width = Math.max(1, Number(rect.width || 0));
    var height = Math.max(1, Number(rect.height || 0));
    var px = clamp(Number(clientX || 0) - rect.left, 0, width);
    var py = clamp(Number(clientY || 0) - rect.top, 0, height);
    var prevZoom = Math.max(0.05, Number(view.zoom || 1));
    var worldX = (px - Number(view.tx || 0)) / prevZoom;
    var worldY = (py - Number(view.ty || 0)) / prevZoom;
    view.zoom = Number(nextZoom || prevZoom);
    view.tx = px - worldX * view.zoom;
    view.ty = py - worldY * view.zoom;
    geoClampViewToStage(stage, view);
  }

  function geoMarkStageMoving(stage) {
    if (!stage || !stage.classList) return;
    if (!stage.classList.contains("is-moving")) stage.classList.add("is-moving");
    if (geoStageMotionTimer) window.clearTimeout(geoStageMotionTimer);
    geoStageMotionTimer = window.setTimeout(function () {
      geoStageMotionTimer = 0;
      if (!stage || !document.body.contains(stage)) return;
      stage.classList.add("is-settling");
      stage.classList.remove("is-moving");
      var req = geoTileRenderReq && geoTileRenderReq.stage === stage ? geoTileRenderReq.view : getActiveGeoView();
      if (req) {
        _applyGeoViewDecorations(stage, req, { settle: true });
        requestAnimationFrame(function () {
          scheduleGeoOnlineTileRender(stage, req, true);
          // Preload adjacent tiles for smoother future panning
          geoPreloadAdjacentTiles(stage, req);
        });
      }
      setTimeout(function () {
        if (stage && document.body.contains(stage)) stage.classList.remove("is-settling");
      }, 350);
      geoSyncViewToUrl();
    }, 200);
  }

  function _applyGeoViewDecorations(stage, view, opts) {
    if (!stage || !view || !document.body.contains(stage)) return;
    var isMotionUpdate = !!(opts && opts.motion);
    // During motion, only update zoom-tier attribute (needed for CSS LOD rules).
    // Skip expensive density CSS custom property writes and DOM queries until settled.
    var rt = route();
    var path = rt && rt.path ? rt.path : "/gov/geo";
    var q = rt && rt.q ? rt.q : {};
    var nativeMode = geoIsNativeBasemapQuery(q || {});
    stage.setAttribute("data-native-map", nativeMode ? "1" : "0");
    stage.setAttribute("data-zoom-tier", geoZoomTier(path, q, view.zoom));
    if (isMotionUpdate) {
      if (nativeMode && !(opts && opts.skipNativeSync)) scheduleGeoNativeMapSync(stage, view, false);
      return;
    }
    var density = geoStageDensityAdjust(path, q, view.zoom);
    var safeZoom = Math.max(1, Number(view.zoom || 1));
    var labelStabilize = safeZoom <= 1.2 ? 1 : clamp(0.76 / safeZoom, 0.0001, 1);
    var iconStabilize = clamp(1.25 / Math.max(Number(view.zoom || 1), 0.01), 0.00001, 1.65);
    // Batch all CSS custom property writes into one operation to avoid multiple style recalcs
    var s = stage.style;
    s.setProperty("--geo-zoom-label-adjust", density.label.toFixed(3));
    s.setProperty("--geo-zoom-icon-adjust", density.icon.toFixed(3));
    s.setProperty("--geo-zoom-entity-adjust", density.entity.toFixed(3));
    s.setProperty("--geo-zoom-road-adjust", density.road.toFixed(3));
    s.setProperty("--geo-zoom-boundary-adjust", density.boundary.toFixed(3));
    s.setProperty("--geo-zoom-mesh-adjust", density.mesh.toFixed(3));
    s.setProperty("--geo-zoom-heat-adjust", density.heat.toFixed(3));
    s.setProperty("--geo-zoom-card-adjust", density.card.toFixed(3));
    s.setProperty("--geo-screen-label-stabilize", labelStabilize.toFixed(6));
    s.setProperty("--geo-screen-icon-stabilize", iconStabilize.toFixed(6));
    var isMotionUpdate = !!(opts && opts.motion);
    if (!isMotionUpdate) {
      renderGeoIconOverlayPositions(stage, view);
      // Only update scale/badge text when motion has settled to avoid DOM thrashing
      geoUpdateScaleBar(stage, path, q, view);
      var zoomBadge = stage._cachedBadge || (stage._cachedBadge = stage.querySelector('[data-role="geo-zoom-badge"]'));
      if (zoomBadge) zoomBadge.textContent = "缩放 x " + view.zoom.toFixed(2);
    }
    var nativeLayer = geoNativeMapLayer(stage);
    if (nativeLayer && nativeLayer.getAttribute("data-enabled") === "1" && !isMotionUpdate) {
      geoApplyNativeMapClip(nativeLayer, stage, view);
    }
    if (nativeMode && !(opts && opts.skipNativeSync)) scheduleGeoNativeMapSync(stage, view, !(opts && opts.motion));
  }

  function applyGeoStageView(stage, view, opts) {
    if (!view) return;
    // Ensure stage is the live element in the DOM
    if (!stage || !document.body.contains(stage)) {
      stage = document.querySelector('[data-role="geo-stage"]');
    }
    if (!stage) return;
    var canvas = _geoGetCached(stage).canvas;
    if (!canvas) return;
    _geoCurrentFrame++;
    // Cap canvas scale to prevent GPU texture overflow at deep zoom
    var GEO_CANVAS_MAX_SCALE = 120;
    var actualZoom = view.zoom;
    var canvasZoom = Math.min(actualZoom, GEO_CANVAS_MAX_SCALE);
    var canvasTx = view.tx;
    var canvasTy = view.ty;
    if (actualZoom > GEO_CANVAS_MAX_SCALE) {
      var ratio = canvasZoom / actualZoom;
      var stRect = _geoStageRect(stage);
      var cx = (stRect.width || 1280) / 2;
      var cy = (stRect.height || 900) / 2;
      canvasTx = cx + (view.tx - cx) * ratio;
      canvasTy = cy + (view.ty - cy) * ratio;
    }
    canvas.style.transform = "translate(" + canvasTx.toFixed(2) + "px," + canvasTy.toFixed(2) + "px) scale(" + canvasZoom.toFixed(4) + ")";
    canvas.style.opacity = actualZoom > GEO_CANVAS_MAX_SCALE ? clamp(1 - (actualZoom - GEO_CANVAS_MAX_SCALE) / 80, 0.05, 1).toFixed(2) : "";
    syncTileLayerMotion(stage, view);
    syncTerrainLayerMotion(stage, view);
    syncGeoIconOverlayMotion(stage, view);
    if (opts && opts.motion) {
      // During continuous interaction, defer expensive decorations
      var sRef = stage; var vSnap = { zoom: view.zoom, tx: view.tx, ty: view.ty }; var oSnap = opts;
      if (_geoViewDecoTimer) clearTimeout(_geoViewDecoTimer);
      _geoViewDecoTimer = setTimeout(function () {
        _geoViewDecoTimer = 0;
        _applyGeoViewDecorations(sRef, vSnap, oSnap);
      }, 250);
    } else {
      // Initial render or reset: apply decorations immediately
      _applyGeoViewDecorations(stage, view, opts);
    }
  }

  function getActiveGeoView() {
    if (!geoActiveViewKey) return null;
    return geoViewStates[geoActiveViewKey] || null;
  }

  function geoResolveForAuto(q) {
    var geo = geoData();
    var districts = (geo.districts || []).slice();
    var did = (q && q.did) || (districts[0] && districts[0].id) || "";
    var district = geoDistrictById(did) || districts[0] || null;
    if (district) did = district.id;

    var streets = (geo.streets || []).filter(function (s) {
      return !did || s.district_id === did;
    });
    var sid = (q && q.sid) || (streets[0] && streets[0].id) || "";
    var street =
      streets.find(function (s) {
        return s.id === sid;
      }) ||
      streets[0] ||
      null;
    if (street) sid = street.id;

    var parks = (geo.parks || []).filter(function (p) {
      return !did || p.district_id === did;
    });
    var pid = (q && q.pid) || (parks[0] && parks[0].id) || "";
    var park =
      parks.find(function (p) {
        return p.id === pid;
      }) ||
      parks[0] ||
      null;
    if (park) pid = park.id;

    return {
      did: did,
      sid: sid,
      pid: pid,
      district: district,
      street: street,
      park: park,
      streetsInDistrict: streets,
      parksInDistrict: parks,
    };
  }

  function geoNumFromQuery(q, key, fallback, min, max) {
    var n = Number(q && q[key]);
    if (!isFinite(n)) n = fallback;
    return clamp(n, min, max);
  }

  function geoAutoCfgFromQuery(q) {
    var cfg = {
      enabled: !q || q.auto_zoom !== "0",
      d2s: geoNumFromQuery(q, "az_d2s", 1.62, 1.05, 2.6),
      s2p: geoNumFromQuery(q, "az_s2p", 1.9, 1.2, 3.2),
      s2d: geoNumFromQuery(q, "az_s2d", 0.78, 0.65, 1.25),
      p2s: geoNumFromQuery(q, "az_p2s", 1.05, 0.7, 1.8),
      p2d: geoNumFromQuery(q, "az_p2d", 0.74, 0.65, 1.3),
    };

    cfg.s2p = Math.max(cfg.s2p, cfg.d2s + 0.08);
    cfg.s2d = Math.min(cfg.s2d, cfg.d2s - 0.08);
    cfg.p2s = Math.min(cfg.p2s, cfg.s2p - 0.08);
    cfg.p2d = Math.min(cfg.p2d, cfg.p2s - 0.04);

    cfg.s2p = clamp(cfg.s2p, 1.2, 3.2);
    cfg.s2d = clamp(cfg.s2d, 0.65, 1.25);
    cfg.p2s = clamp(cfg.p2s, 0.7, 1.8);
    cfg.p2d = clamp(cfg.p2d, 0.65, 1.3);
    return cfg;
  }

  function geoMaybeAutoSwitchByZoom(path, q, zoom) {
    if (!path || path.indexOf("/gov/geo-") !== 0) return false;
    if (path === "/gov/geo-building") return false;
    if (Date.now() < geoAutoSwitchUntil) return false;

    var level = geoLevelByPath(path);
    var scope = (q && q.scope) || (level === "district" ? "district" : "street");
    var z = Number(zoom || 1);
    var pick = geoResolveForAuto(q || {});
    var autoCfg = geoAutoCfgFromQuery(q || {});
    if (!autoCfg.enabled) return false;

    // Determine which area the viewport center falls within
    var cpt = geoViewCenterPercent();
    var geo = geoData();

    var SW_DISTRICT_TO_STREET = autoCfg.d2s;
    var SW_STREET_TO_PARK = autoCfg.s2p;
    var SW_STREET_TO_DISTRICT = autoCfg.s2d;
    var SW_PARK_TO_STREET = autoCfg.p2s;
    var SW_PARK_TO_DISTRICT = autoCfg.p2d;

    if (level === "district") {
      if (z >= SW_DISTRICT_TO_STREET) {
        // Pick district under viewport center
        var centerDistrict = cpt ? (geoFindItemAtPoint(geo.districts, cpt.x, cpt.y) || geoFindNearestItem(geo.districts, cpt.x, cpt.y)) : null;
        var targetDid = (centerDistrict && centerDistrict.id) || pick.did;
        var streetsInTarget = geo.streets.filter(function (s) { return s.district_id === targetDid; });
        if (streetsInTarget.length) {
          var targetSid = streetsInTarget[0].id;
          // Prefer the street closest to center
          if (cpt) {
            var cs = geoFindItemAtPoint(streetsInTarget, cpt.x, cpt.y) || geoFindNearestItem(streetsInTarget, cpt.x, cpt.y);
            if (cs) targetSid = cs.id;
          }
          geoAutoSwitchUntil = Date.now() + 900;
          updateGeoHash({ did: targetDid, scope: "street", sid: targetSid, pid: "" }, "/gov/geo-street", { forceGeoFly: true });
          return true;
        }
      }
      return false;
    }

    if (level === "street" && scope === "park") {
      if (z <= SW_PARK_TO_DISTRICT) {
        geoAutoSwitchUntil = Date.now() + 900;
        updateGeoHash({ did: pick.did, scope: "district", sid: "", pid: "" }, "/gov/geo-district", { forceGeoFly: true });
        return true;
      }
      if (z <= SW_PARK_TO_STREET) {
        // Pick street under viewport center
        var targetSidFromPark = (pick.park && pick.park.street_id) || pick.sid || "";
        if (cpt && pick.streetsInDistrict.length) {
          var csP = geoFindItemAtPoint(pick.streetsInDistrict, cpt.x, cpt.y) || geoFindNearestItem(pick.streetsInDistrict, cpt.x, cpt.y);
          if (csP) targetSidFromPark = csP.id;
        }
        geoAutoSwitchUntil = Date.now() + 900;
        updateGeoHash({ did: pick.did, scope: "street", sid: targetSidFromPark, pid: "" }, "/gov/geo-street", { forceGeoFly: true });
        return true;
      }
      return false;
    }

    if (level === "street") {
      if (z <= SW_STREET_TO_DISTRICT) {
        geoAutoSwitchUntil = Date.now() + 900;
        updateGeoHash({ did: pick.did, scope: "district", sid: "", pid: "" }, "/gov/geo-district", { forceGeoFly: true });
        return true;
      }
      if (z >= SW_STREET_TO_PARK && pick.parksInDistrict.length) {
        // Pick park under viewport center
        var p0 = pick.park || pick.parksInDistrict[0];
        if (cpt) {
          var cpk = geoFindItemAtPoint(pick.parksInDistrict, cpt.x, cpt.y) || geoFindNearestItem(pick.parksInDistrict, cpt.x, cpt.y);
          if (cpk) p0 = cpk;
        }
        geoAutoSwitchUntil = Date.now() + 900;
        updateGeoHash({ did: pick.did, scope: "park", pid: p0.id, sid: p0.street_id || pick.sid || "" }, "/gov/geo-park", { forceGeoFly: true });
        return true;
      }
    }
    return false;
  }


  var _geoAutoSwitchTimer = null;
  var _geoInteractionFrameRaf = 0;
  var _geoInteractionFrameReq = null;
  function geoScheduleAutoSwitch(path, q, zoom, delay) {
    // Disabled: no longer auto-switch levels on zoom
    return;
  }

  function scheduleGeoInteractionFrame(stage, view, opts) {
    if (!stage || !view) return;
    _geoInteractionFrameReq = {
      stage: stage,
      view: view,
      opts: opts || {},
    };
    if (_geoInteractionFrameRaf) return;
    _geoInteractionFrameRaf = window.requestAnimationFrame(function () {
      _geoInteractionFrameRaf = 0;
      var req = _geoInteractionFrameReq;
      _geoInteractionFrameReq = null;
      if (!req || !req.stage || !document.body.contains(req.stage)) return;
      applyGeoStageView(req.stage, req.view, req.opts);
      if (!(req.opts && req.opts.skipMovingMark)) geoMarkStageMoving(req.stage);
    });
  }

  var _geoZoomAnimRaf = 0;
  function geoZoomBy(step) {
    var view = getActiveGeoView();
    if (!view) return false;
    var stage = document.querySelector('[data-role="geo-stage"]');
    var rt = route();
    var center = geoViewportCenter(stage);
    var nativeMode = geoIsNativeBasemapQuery((rt && rt.q) || {});
    var floorZoom = geoSceneZoomFloor(rt.path, rt.q || {});
    var maxZoom = geoSceneZoomLimit(rt.path, rt.q || {});
    // Progressive step: larger jumps at higher zoom for faster deep-zoom
    var zoomLevel = Math.max(1, view.zoom);
    var progressiveStep = 1 + 0.08 * Math.min(Math.log(zoomLevel) / Math.LN2, 14);
    var baseStep = nativeMode ? 1.35 : 1.25;
    var stepFactor = Math.pow(baseStep, progressiveStep);
    var targetZoom = clamp(
      view.zoom * (step > 0 ? stepFactor : 1 / stepFactor),
      floorZoom, maxZoom
    );
    // Smooth animated zoom over ~280ms with ease-out
    if (_geoZoomAnimRaf) { cancelAnimationFrame(_geoZoomAnimRaf); _geoZoomAnimRaf = 0; }
    var startZoom = view.zoom;
    var startTx = view.tx;
    var startTy = view.ty;
    var duration = 280;
    var startTime = performance.now();
    var cx = center.x;
    var cy = center.y;
    function animTick(now) {
      var t = Math.min((now - startTime) / duration, 1);
      // ease-out cubic: 1 - (1-t)^3
      var ease = 1 - Math.pow(1 - t, 3);
      var curZoom = startZoom + (targetZoom - startZoom) * ease;
      geoSetZoomAroundPoint(stage, view, curZoom, cx, cy);
      scheduleGeoInteractionFrame(stage, view, { motion: t < 1 });
      if (nativeMode) scheduleGeoNativeMapSync(stage, view, false);
      if (t < 1) {
        _geoZoomAnimRaf = requestAnimationFrame(animTick);
      } else {
        _geoZoomAnimRaf = 0;
        geoScheduleAutoSwitch(rt.path, rt.q || {}, view.zoom, 140);
      }
    }
    _geoZoomAnimRaf = requestAnimationFrame(animTick);
    return true;
  }

  function geoResetView() {
    var view = getActiveGeoView();
    if (!view) return false;
    var stage = document.querySelector('[data-role="geo-stage"]');
    applyGeoStageView(stage, view);
    return true;
  }

  function geoIsMapInteractiveTarget(target) {
    if (!target || !target.closest) return false;
    return (
      !!target.closest(".geo-poi-wrap") ||
      !!target.closest(".geo-poi-dot") ||
      !!target.closest(".geo-poi-card") ||
      !!target.closest(".geo-node-link") ||
      !!target.closest(".geo-boundary-shape")
    );
  }

  function initGeoViewport(path, q) {
    var stage = document.querySelector('[data-role="geo-stage"]');
    var viewport = document.querySelector('[data-role="geo-viewport"]');
    if (!stage || !viewport) return;

    var key = geoViewKey(path, q);
    geoActiveViewKey = key;
    var forcedView = geoTakeForcedViewCarry(stage, path, q || {});
    var explicitView = null;
    if (q && q._gvz && q._glon && q._glat) {
      var explicitProvider = geoTileProviderByKey(((q && q.omt_p) || geoDefaultOnlineProvider()));
      explicitView = geoViewFromNativeMap(stage, Number(q._glon), Number(q._glat), Number(q._gvz), explicitProvider);
    } else if (q && q._vz) {
      explicitView = {
        zoom: clamp(Number(q._vz) || 1, 0.2, 8000),
        tx: Number(q._vtx) || 0,
        ty: Number(q._vty) || 0,
      };
    }
    if (forcedView) {
      geoViewStates[key] = forcedView;
    } else if (explicitView) {
      geoViewStates[key] = explicitView;
    }
    if (!geoViewStates[key]) {
      var pendingView = geoTakePendingViewState(key);
      geoViewStates[key] = pendingView || geoInitialView(stage, path, q || {});
    }
    var view = geoViewStates[key];
    if (String((q && q._keepvp) || "") !== "1") {
      geoClampViewToStage(stage, view);
    }
    stage.setAttribute("data-switching", "1");
    if (geoStageSwitchTimer) window.clearTimeout(geoStageSwitchTimer);
    geoStageSwitchTimer = window.setTimeout(function () {
      geoStageSwitchTimer = 0;
      if (!stage || !document.body.contains(stage)) return;
      stage.setAttribute("data-switching", "0");
      var req = geoTileRenderReq && geoTileRenderReq.stage === stage ? geoTileRenderReq.view : getActiveGeoView();
      if (req) scheduleGeoOnlineTileRender(stage, req, true);
    }, 220);
    applyGeoStageView(stage, view);
    scheduleGeoOnlineTileRender(stage, view, true);
    if (geoIsNativeBasemapQuery(q || {})) scheduleGeoNativeMapSync(stage, view, false);

    var drag = { on: false, x: 0, y: 0, vx: 0, vy: 0, lastT: 0 };
    var touch = { mode: "", x: 0, y: 0, dist: 0, startZoom: 1, vx: 0, vy: 0, lastT: 0 };
    var _inertiaRaf = 0;

    function touchDistance(t1, t2) {
      var dx = t1.clientX - t2.clientX;
      var dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }


    function clampViewPan() {
      geoClampViewToStage(stage, view, true); // elastic during interaction
    }

    // Elastic snap-back: animate view back to hard bounds after release
    var _snapBackRaf = 0;
    function startSnapBack() {
      if (_snapBackRaf) { cancelAnimationFrame(_snapBackRaf); _snapBackRaf = 0; }
      var bx = geoPanBounds(stage, view.zoom, "x");
      var by = geoPanBounds(stage, view.zoom, "y");
      var targetTx = clamp(view.tx, bx.min, bx.max);
      var targetTy = clamp(view.ty, by.min, by.max);
      if (Math.abs(view.tx - targetTx) < 0.5 && Math.abs(view.ty - targetTy) < 0.5) return;
      function snapTick() {
        var dxSnap = targetTx - view.tx;
        var dySnap = targetTy - view.ty;
        if (Math.abs(dxSnap) < 0.5 && Math.abs(dySnap) < 0.5) {
          view.tx = targetTx;
          view.ty = targetTy;
          scheduleGeoInteractionFrame(stage, view, { motion: false });
          _snapBackRaf = 0;
          return;
        }
        view.tx += dxSnap * 0.25;
        view.ty += dySnap * 0.25;
        scheduleGeoInteractionFrame(stage, view, { motion: true });
        if (geoIsNativeBasemapQuery(q || {})) scheduleGeoNativeMapSync(stage, view, false);
        _snapBackRaf = requestAnimationFrame(snapTick);
      }
      _snapBackRaf = requestAnimationFrame(snapTick);
    }

    // Pan inertia: decelerating scroll after drag release
    function startPanInertia(vx, vy) {
      if (_inertiaRaf) { cancelAnimationFrame(_inertiaRaf); _inertiaRaf = 0; }
      var speed = Math.sqrt(vx * vx + vy * vy);
      if (speed < 30) { startSnapBack(); return; } // too slow, just snap back
      var friction = 0.92;
      var lastTime = performance.now();
      function tick(now) {
        var dt = Math.min(now - lastTime, 50); // cap at 50ms
        lastTime = now;
        vx *= friction;
        vy *= friction;
        // Add rubber-band resistance when past bounds
        var bx = geoPanBounds(stage, view.zoom, "x");
        var by = geoPanBounds(stage, view.zoom, "y");
        if (view.tx < bx.min) { vx *= 0.7; view.tx += (bx.min - view.tx) * 0.08; }
        else if (view.tx > bx.max) { vx *= 0.7; view.tx += (bx.max - view.tx) * 0.08; }
        if (view.ty < by.min) { vy *= 0.7; view.ty += (by.min - view.ty) * 0.08; }
        else if (view.ty > by.max) { vy *= 0.7; view.ty += (by.max - view.ty) * 0.08; }
        if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
          _inertiaRaf = 0;
          startSnapBack();
          return;
        }
        view.tx += vx * (dt / 16);
        view.ty += vy * (dt / 16);
        clampViewPan();
        var liveStage = document.body.contains(stage) ? stage : document.querySelector('[data-role="geo-stage"]');
        if (!liveStage) { _inertiaRaf = 0; return; }
        if (liveStage !== stage) stage = liveStage;
        scheduleGeoInteractionFrame(stage, view, { motion: true });
        if (geoIsNativeBasemapQuery(q || {})) scheduleGeoNativeMapSync(stage, view, false);
        _inertiaRaf = requestAnimationFrame(tick);
      }
      _inertiaRaf = requestAnimationFrame(tick);
    }

    function stopInertia() {
      if (_inertiaRaf) { cancelAnimationFrame(_inertiaRaf); _inertiaRaf = 0; }
      if (_snapBackRaf) { cancelAnimationFrame(_snapBackRaf); _snapBackRaf = 0; }
      if (_wheelZoomAnimRaf) { cancelAnimationFrame(_wheelZoomAnimRaf); _wheelZoomAnimRaf = 0; }
    }

    var _wheelRaf = 0;
    var _wheelAccum = 0;
    var _wheelLastX = 0;
    var _wheelLastY = 0;
    // Smooth wheel zoom: animate toward target zoom instead of snapping
    var _wheelZoomTarget = 0;
    var _wheelZoomAnimRaf = 0;
    var _wheelZoomCx = 0;
    var _wheelZoomCy = 0;

    function _wheelZoomAnimate() {
      var diff = _wheelZoomTarget - view.zoom;
      if (Math.abs(diff) < 0.001) {
        view.zoom = _wheelZoomTarget;
        geoSetZoomAroundPoint(stage, view, _wheelZoomTarget, _wheelZoomCx, _wheelZoomCy);
        scheduleGeoInteractionFrame(stage, view, { motion: false });
        geoMarkStageMoving(stage);
        geoScheduleAutoSwitch(path, q || {}, view.zoom, 200);
        _wheelZoomAnimRaf = 0;
        return;
      }
      // Lerp 30% per frame toward target — smooth exponential ease
      var nextZoom = view.zoom + diff * 0.30;
      geoSetZoomAroundPoint(stage, view, nextZoom, _wheelZoomCx, _wheelZoomCy);
      scheduleGeoInteractionFrame(stage, view, { motion: true });
      if (geoIsNativeBasemapQuery(q || {})) scheduleGeoNativeMapSync(stage, view, false);
      _wheelZoomAnimRaf = requestAnimationFrame(_wheelZoomAnimate);
    }

    viewport.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      stopInertia();
      var dy = Number(ev.deltaY || 0);
      if (ev.deltaMode === 1) dy *= 36;
      else if (ev.deltaMode === 2) dy *= 100;
      _wheelAccum += dy;
      _wheelLastX = ev.clientX;
      _wheelLastY = ev.clientY;
      if (_wheelRaf) return; // coalesce rapid wheel ticks into one RAF
      _wheelRaf = requestAnimationFrame(function () {
        _wheelRaf = 0;
        var accum = _wheelAccum;
        _wheelAccum = 0;
        var intensity = clamp(Math.abs(accum) / 120, 0.55, 1.9);
        var nativeMode = geoIsNativeBasemapQuery(q || {});
        // Progressive zoom: base factor grows with current zoom level
        var zoomLevel = Math.max(1, _wheelZoomTarget || view.zoom);
        var progressiveBoost = 1 + 0.06 * Math.min(Math.log(zoomLevel) / Math.LN2, 14);
        var baseFactor = (nativeMode ? 1.16 : 1.12) * progressiveBoost;
        var factor = Math.pow(baseFactor, intensity);
        var baseZoom = _wheelZoomAnimRaf ? _wheelZoomTarget : view.zoom;
        _wheelZoomTarget = clamp(
          baseZoom * (accum > 0 ? 1 / factor : factor),
          geoSceneZoomFloor(path, q || {}),
          geoSceneZoomLimit(path, q || {})
        );
        _wheelZoomCx = _wheelLastX;
        _wheelZoomCy = _wheelLastY;
        if (!_wheelZoomAnimRaf) {
          _wheelZoomAnimRaf = requestAnimationFrame(_wheelZoomAnimate);
        }
      });
    }, { passive: false });

    viewport.addEventListener("mousedown", function (ev) {
      if (ev.button !== 0) return;
      if (geoIsMapInteractiveTarget(ev.target)) return;
      stopInertia();
      drag.on = true;
      drag.x = ev.clientX;
      drag.y = ev.clientY;
      drag.vx = 0;
      drag.vy = 0;
      drag.lastT = performance.now();
      viewport.classList.add("dragging");
      window.addEventListener("mouseup", function () {
        drag.on = false;
        viewport.classList.remove("dragging");
        startPanInertia(drag.vx, drag.vy);
      }, { once: true });
    });

    viewport.addEventListener("mousemove", function (ev) {
      if (!drag.on) return;
      try {
        var dx = ev.clientX - drag.x;
        var dy = ev.clientY - drag.y;
        var now = performance.now();
        var dt = now - drag.lastT;
        if (dt > 0 && dt < 100) {
          var alpha = 0.4;
          drag.vx = alpha * (dx / (dt / 16)) + (1 - alpha) * drag.vx;
          drag.vy = alpha * (dy / (dt / 16)) + (1 - alpha) * drag.vy;
        }
        drag.lastT = now;
        drag.x = ev.clientX;
        drag.y = ev.clientY;
        view.tx += dx;
        view.ty += dy;
        clampViewPan();
        // Re-query stage if it became detached from the DOM
        var liveStage = document.body.contains(stage) ? stage : document.querySelector('[data-role="geo-stage"]');
        if (liveStage && liveStage !== stage) {
          stage = liveStage;
          viewport = liveStage.querySelector('[data-role="geo-viewport"]') || viewport;
        }
        scheduleGeoInteractionFrame(stage, view, { motion: true });
        if (geoIsNativeBasemapQuery(q || {})) scheduleGeoNativeMapSync(stage, view, false);
      } catch (e) {
        console.error("[GEO DRAG ERROR]", e);
      }
    });

    viewport.addEventListener(
      "touchstart",
      function (ev) {
        if (!ev.touches || !ev.touches.length) return;
        if (geoIsMapInteractiveTarget(ev.target)) return;
        stopInertia();
        if (ev.touches.length === 1) {
          touch.mode = "pan";
          touch.x = ev.touches[0].clientX;
          touch.y = ev.touches[0].clientY;
          touch.vx = 0;
          touch.vy = 0;
          touch.lastT = performance.now();
          viewport.classList.add("dragging");
          // Long-press detection
          touch._lpTimer = setTimeout(function () {
            touch._lpTimer = 0;
            if (touch.mode !== "pan") return;
            if (navigator.vibrate) navigator.vibrate(50);
            geoCtxMenuShow(touch.x, touch.y, ev.target);
            touch.mode = "";
            viewport.classList.remove("dragging");
          }, 500);
          touch._lpX = touch.x;
          touch._lpY = touch.y;
          return;
        }
        if (ev.touches.length >= 2) {
          if (touch._lpTimer) { clearTimeout(touch._lpTimer); touch._lpTimer = 0; }
          touch.mode = "pinch";
          touch.dist = touchDistance(ev.touches[0], ev.touches[1]);
          touch.startZoom = view.zoom;
          touch._pinchMx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
          touch._pinchMy = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
          touch._pinchAngle = Math.atan2(
            ev.touches[1].clientY - ev.touches[0].clientY,
            ev.touches[1].clientX - ev.touches[0].clientX
          );
          viewport.classList.add("dragging");
        }
      },
      { passive: false }
    );

    viewport.addEventListener(
      "touchmove",
      function (ev) {
        if (!ev.touches || !ev.touches.length) return;
        if (touch.mode === "pan" && ev.touches.length === 1) {
          ev.preventDefault();
          var dx = ev.touches[0].clientX - touch.x;
          var dy = ev.touches[0].clientY - touch.y;
          // Cancel long-press if finger moved too far
          if (touch._lpTimer) {
            var lpDx = ev.touches[0].clientX - touch._lpX;
            var lpDy = ev.touches[0].clientY - touch._lpY;
            if (lpDx * lpDx + lpDy * lpDy > 100) { clearTimeout(touch._lpTimer); touch._lpTimer = 0; }
          }
          var now = performance.now();
          var dt = now - touch.lastT;
          if (dt > 0 && dt < 100) {
            var alpha = 0.4;
            touch.vx = alpha * (dx / (dt / 16)) + (1 - alpha) * touch.vx;
            touch.vy = alpha * (dy / (dt / 16)) + (1 - alpha) * touch.vy;
          }
          touch.lastT = now;
          touch.x = ev.touches[0].clientX;
          touch.y = ev.touches[0].clientY;
          view.tx += dx;
          view.ty += dy;
          clampViewPan();
          scheduleGeoInteractionFrame(stage, view, { motion: true });
          if (geoIsNativeBasemapQuery(q || {})) scheduleGeoNativeMapSync(stage, view, false);
          return;
        }
        if (ev.touches.length >= 2) {
          ev.preventDefault();
          if (touch._lpTimer) { clearTimeout(touch._lpTimer); touch._lpTimer = 0; }
          if (touch.mode !== "pinch") {
            touch.mode = "pinch";
            touch.dist = touchDistance(ev.touches[0], ev.touches[1]);
            touch.startZoom = view.zoom;
            touch._pinchMx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
            touch._pinchMy = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
            touch._pinchAngle = Math.atan2(
              ev.touches[1].clientY - ev.touches[0].clientY,
              ev.touches[1].clientX - ev.touches[0].clientX
            );
          }
          var dist = touchDistance(ev.touches[0], ev.touches[1]);
          var mx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
          var my = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
          // Simultaneous pan during pinch
          var pmx = mx - (touch._pinchMx || mx);
          var pmy = my - (touch._pinchMy || my);
          if (Math.abs(pmx) > 0.5 || Math.abs(pmy) > 0.5) {
            view.tx += pmx;
            view.ty += pmy;
            clampViewPan();
          }
          touch._pinchMx = mx;
          touch._pinchMy = my;
          // Rotation detection hint
          var curAngle = Math.atan2(
            ev.touches[1].clientY - ev.touches[0].clientY,
            ev.touches[1].clientX - ev.touches[0].clientX
          );
          var angleDelta = Math.abs(curAngle - (touch._pinchAngle || curAngle));
          if (angleDelta > Math.PI) angleDelta = 2 * Math.PI - angleDelta;
          if (angleDelta > 0.26 && dist / (touch.dist || 1) > 0.85 && dist / (touch.dist || 1) < 1.15) {
            // Rotation attempted but zoom ratio near 1 — show hint
            var rotHint = stage.querySelector(".geo-scroll-hint");
            if (!rotHint) {
              rotHint = document.createElement("div");
              rotHint.className = "geo-scroll-hint";
              stage.appendChild(rotHint);
            }
            rotHint.textContent = "此地图不支持旋转";
            rotHint.classList.add("visible");
            clearTimeout(touch._rotHintTimer);
            touch._rotHintTimer = setTimeout(function () {
              rotHint.classList.remove("visible");
            }, 1600);
          }
          if (touch.dist > 1) {
            var ratio = dist / touch.dist;
            var cx = mx;
            var cy = my;
            var nextZoom = clamp(
              touch.startZoom * ratio,
              geoSceneZoomFloor(path, q || {}),
              geoSceneZoomLimit(path, q || {})
            );
            geoSetZoomAroundPoint(stage, view, nextZoom, cx, cy);
            scheduleGeoInteractionFrame(stage, view, { motion: true });
            if (geoIsNativeBasemapQuery(q || {})) scheduleGeoNativeMapSync(stage, view, false);
          }
        }
      },
      { passive: false }
    );

    viewport.addEventListener(
      "touchend",
      function (ev) {
        if (touch._lpTimer) { clearTimeout(touch._lpTimer); touch._lpTimer = 0; }
        if (touch.mode === "pinch") {
          geoScheduleAutoSwitch(path, q || {}, view.zoom, 100);
          geoMarkStageMoving(stage);
        }
        if (ev.touches && ev.touches.length >= 2) {
          touch.mode = "pinch";
          touch.dist = touchDistance(ev.touches[0], ev.touches[1]);
          touch.startZoom = view.zoom;
          return;
        }
        if (ev.touches && ev.touches.length === 1) {
          touch.mode = "pan";
          touch.x = ev.touches[0].clientX;
          touch.y = ev.touches[0].clientY;
          touch.vx = 0;
          touch.vy = 0;
          touch.lastT = performance.now();
          return;
        }
        var wasPan = touch.mode === "pan";
        var tvx = touch.vx;
        var tvy = touch.vy;
        touch.mode = "";
        viewport.classList.remove("dragging");
        if (wasPan) startPanInertia(tvx, tvy);
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchcancel",
      function () {
        touch.mode = "";
        viewport.classList.remove("dragging");
      },
      { passive: true }
    );

    viewport.addEventListener("dblclick", function (ev) {
      if (geoIsMapInteractiveTarget(ev.target)) return;
      ev.preventDefault();
      stopInertia();
      var nativeMode = geoIsNativeBasemapQuery(q || {});
      var targetZoom = nativeMode
        ? clamp(view.zoom * (ev.shiftKey ? 1 / 1.28 : 1.28), geoSceneZoomFloor(path, q || {}), geoSceneZoomLimit(path, q || {}))
        : clamp(view.zoom + (ev.shiftKey ? -0.2 : 0.2), geoSceneZoomFloor(path, q || {}), geoSceneZoomLimit(path, q || {}));
      // Smooth animated double-click zoom
      if (_geoZoomAnimRaf) { cancelAnimationFrame(_geoZoomAnimRaf); _geoZoomAnimRaf = 0; }
      var startZoom = view.zoom;
      var dur = 250;
      var t0 = performance.now();
      var dcx = ev.clientX;
      var dcy = ev.clientY;
      function dcTick(now) {
        var t = Math.min((now - t0) / dur, 1);
        var ease = 1 - Math.pow(1 - t, 3);
        geoSetZoomAroundPoint(stage, view, startZoom + (targetZoom - startZoom) * ease, dcx, dcy);
        scheduleGeoInteractionFrame(stage, view, { motion: t < 1 });
        if (nativeMode) scheduleGeoNativeMapSync(stage, view, false);
        if (t < 1) {
          _geoZoomAnimRaf = requestAnimationFrame(dcTick);
        } else {
          _geoZoomAnimRaf = 0;
          geoScheduleAutoSwitch(path, q || {}, view.zoom, 120);
        }
      }
      _geoZoomAnimRaf = requestAnimationFrame(dcTick);
    });

    // Boundary hover tooltip
    (function () {
      var tip = document.getElementById("geo-boundary-tip");
      if (!tip) {
        tip = document.createElement("div");
        tip.id = "geo-boundary-tip";
        tip.className = "geo-boundary-tip";
        document.body.appendChild(tip);
      }
      function show(ev) {
        var g = ev.target.closest && ev.target.closest(".geo-boundary-shape");
        if (!g) { tip.style.display = "none"; return; }
        var name = g.getAttribute("data-name");
        if (!name) { tip.style.display = "none"; return; }
        tip.textContent = name;
        tip.style.display = "block";
        tip.style.left = (ev.clientX + 14) + "px";
        tip.style.top = (ev.clientY - 10) + "px";
      }
      viewport.addEventListener("mouseover", show);
      viewport.addEventListener("mousemove", function (ev) {
        if (tip.style.display !== "block") return;
        var g = ev.target.closest && ev.target.closest(".geo-boundary-shape");
        if (!g || !g.getAttribute("data-name")) { tip.style.display = "none"; return; }
        tip.style.left = (ev.clientX + 14) + "px";
        tip.style.top = (ev.clientY - 10) + "px";
      });
      viewport.addEventListener("mouseout", function (ev) {
        var related = ev.relatedTarget;
        if (related && related.closest && related.closest(".geo-boundary-shape")) return;
        tip.style.display = "none";
      });
    })();
  }

  function setState(mutator) {
    var next = deepClone(state);
    mutator(next);
    state = next;
    save(state);
    render();
  }

  /* ── Login page ── */
  var LOGIN_KEY = "ib_demo_logged_in";
  var LOGIN_USER_KEY = "ib_demo_user_id";

  /* ── Demo user accounts & permission model ── */
  var DEMO_USERS = [
    { id: "admin", name: "管理员", dept: "区政府办", scope: "all", deptId: "", areaId: "", label: "管理员（全量权限）" },
    { id: "fgj", name: "张明远", dept: "区发改局", scope: "department", deptId: "dept-dev", areaId: "", label: "区发改局（张明远）" },
    { id: "jxj", name: "李婉清", dept: "区经信局", scope: "department", deptId: "dept-ind", areaId: "", label: "区经信局（李婉清）" },
    { id: "swj", name: "陈思远", dept: "区商务局", scope: "department", deptId: "dept-biz", areaId: "", label: "区商务局（陈思远）" },
    { id: "czj", name: "王瑞华", dept: "区财政局", scope: "department", deptId: "dept-fin", areaId: "", label: "区财政局（王瑞华）" },
    { id: "wtlj", name: "林佳慧", dept: "区文体旅局", scope: "department", deptId: "dept-culture", areaId: "", label: "区文体旅局（林佳慧）" },
    { id: "street_jinsha", name: "赵建国", dept: "金沙街道办", scope: "area", deptId: "", areaId: "gs3", label: "金沙街道（赵建国）" },
    { id: "street_caotang", name: "孙晓红", dept: "草堂街道办", scope: "area", deptId: "", areaId: "gs2", label: "草堂街道（孙晓红）" }
  ];

  function isLoggedIn() {
    try { return localStorage.getItem(LOGIN_KEY) === "1"; } catch (e) { return false; }
  }
  function setLoggedIn(v) {
    try { localStorage.setItem(LOGIN_KEY, v ? "1" : "0"); } catch (e) {}
  }
  function setLoginUser(userId) {
    try { localStorage.setItem(LOGIN_USER_KEY, userId || "admin"); } catch (e) {}
  }
  function getLoginUserId() {
    try { return localStorage.getItem(LOGIN_USER_KEY) || "admin"; } catch (e) { return "admin"; }
  }
  function currentUser() {
    var uid = getLoginUserId();
    return DEMO_USERS.find(function (u) { return u.id === uid; }) || DEMO_USERS[0];
  }

  function generateCaptcha() {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var code = "";
    for (var i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }
  var _captchaCode = generateCaptcha();

  function renderCaptchaSVG(text) {
    var w = 100, h = 40;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';
    svg += '<rect width="100%" height="100%" fill="#f0f4f8"/>';
    for (var i = 0; i < 3; i++) {
      var x1 = Math.random() * w, y1 = Math.random() * h, x2 = Math.random() * w, y2 = Math.random() * h;
      svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>';
    }
    for (var j = 0; j < text.length; j++) {
      var x = 12 + j * 22;
      var y = 26 + Math.random() * 6 - 3;
      var rot = Math.random() * 20 - 10;
      svg += '<text x="' + x + '" y="' + y + '" font-size="22" font-weight="bold" fill="#2670b8" transform="rotate(' + rot + ' ' + x + ' ' + y + ')">' + text[j] + '</text>';
    }
    svg += '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function pageLogin() {
    var captchaSrc = renderCaptchaSVG(_captchaCode);
    return '<div class="login-page">' +
      '<div class="login-left">' +
        '<div class="login-left-content">' +
          '<div class="login-shield">' +
            '<svg viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M60 5 L110 28 L110 78 C110 110 85 133 60 142 C35 133 10 110 10 78 L10 28 Z" stroke="rgba(255,255,255,0.35)" stroke-width="1.8" fill="rgba(255,255,255,0.04)"/>' +
              '<path d="M60 18 L97 36 L97 76 C97 102 80 120 60 128 C40 120 23 102 23 76 L23 36 Z" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" fill="none"/>' +
              '<line x1="60" y1="18" x2="60" y2="128" stroke="rgba(255,255,255,0.1)" stroke-width="0.8"/>' +
              '<line x1="23" y1="56" x2="97" y2="56" stroke="rgba(255,255,255,0.1)" stroke-width="0.8"/>' +
              '<line x1="23" y1="76" x2="97" y2="76" stroke="rgba(255,255,255,0.1)" stroke-width="0.8"/>' +
              '<line x1="40" y1="26" x2="28" y2="100" stroke="rgba(255,255,255,0.07)" stroke-width="0.8"/>' +
              '<line x1="80" y1="26" x2="92" y2="100" stroke="rgba(255,255,255,0.07)" stroke-width="0.8"/>' +
              '<circle cx="60" cy="56" r="14" stroke="rgba(255,255,255,0.18)" stroke-width="1" fill="none"/>' +
              '<circle cx="60" cy="56" r="6" stroke="rgba(255,255,255,0.25)" stroke-width="1" fill="rgba(255,255,255,0.06)"/>' +
              '<path d="M60 42 L60 36" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>' +
              '<path d="M60 70 L60 76" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>' +
              '<path d="M46 56 L38 56" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>' +
              '<path d="M74 56 L82 56" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>' +
              '<circle cx="60" cy="36" r="2" fill="rgba(255,255,255,0.2)"/>' +
              '<circle cx="60" cy="76" r="2" fill="rgba(255,255,255,0.2)"/>' +
              '<circle cx="38" cy="56" r="2" fill="rgba(255,255,255,0.2)"/>' +
              '<circle cx="82" cy="56" r="2" fill="rgba(255,255,255,0.2)"/>' +
              '<rect x="52" y="86" width="16" height="10" rx="2" stroke="rgba(255,255,255,0.18)" stroke-width="0.8" fill="none"/>' +
              '<path d="M56 92 L60 96 L68 88" stroke="rgba(255,255,255,0.3)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
            '</svg>' +
          '</div>' +
          '<h2 class="login-slogan">统一认证、统一授权</h2>' +
          '<p class="login-sub-slogan">数据驱动决策，智慧赋能产业</p>' +
        '</div>' +
      '</div>' +
      '<div class="login-right">' +
        '<div class="login-card">' +
          '<div class="login-qr-corner" data-action="toggle-qr-login">' +
            '<svg viewBox="0 0 24 24" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<rect x="3" y="3" width="7" height="7" rx="1" stroke="#2670b8" stroke-width="1.5"/>' +
              '<rect x="5" y="5" width="3" height="3" rx="0.5" fill="#2670b8"/>' +
              '<rect x="14" y="3" width="7" height="7" rx="1" stroke="#2670b8" stroke-width="1.5"/>' +
              '<rect x="16" y="5" width="3" height="3" rx="0.5" fill="#2670b8"/>' +
              '<rect x="3" y="14" width="7" height="7" rx="1" stroke="#2670b8" stroke-width="1.5"/>' +
              '<rect x="5" y="16" width="3" height="3" rx="0.5" fill="#2670b8"/>' +
              '<rect x="14" y="14" width="3" height="3" fill="#2670b8"/>' +
              '<rect x="18" y="14" width="3" height="3" fill="#2670b8"/>' +
              '<rect x="14" y="18" width="3" height="3" fill="#2670b8"/>' +
              '<rect x="18" y="18" width="3" height="3" fill="#2670b8"/>' +
            '</svg>' +
            '<span class="login-qr-tooltip">扫码登录在这里</span>' +
          '</div>' +
          '<div id="login-qr-panel" class="login-qr-panel hidden">' +
            '<div class="login-qr-back" data-action="toggle-qr-login">&larr; 返回账号登录</div>' +
            '<div class="login-qr-code">' +
              '<svg viewBox="0 0 200 200" width="180" height="180" xmlns="http://www.w3.org/2000/svg">' +
                '<rect width="200" height="200" fill="#fff"/>' +
                '<rect x="20" y="20" width="50" height="50" rx="4" stroke="#222" stroke-width="4" fill="none"/>' +
                '<rect x="30" y="30" width="30" height="30" rx="2" fill="#222"/>' +
                '<rect x="130" y="20" width="50" height="50" rx="4" stroke="#222" stroke-width="4" fill="none"/>' +
                '<rect x="140" y="30" width="30" height="30" rx="2" fill="#222"/>' +
                '<rect x="20" y="130" width="50" height="50" rx="4" stroke="#222" stroke-width="4" fill="none"/>' +
                '<rect x="30" y="140" width="30" height="30" rx="2" fill="#222"/>' +
                '<rect x="80" y="20" width="8" height="8" fill="#222"/><rect x="92" y="20" width="8" height="8" fill="#222"/>' +
                '<rect x="80" y="32" width="8" height="8" fill="#222"/><rect x="104" y="32" width="8" height="8" fill="#222"/>' +
                '<rect x="80" y="44" width="8" height="8" fill="#222"/><rect x="92" y="44" width="8" height="8" fill="#222"/><rect x="104" y="44" width="8" height="8" fill="#222"/>' +
                '<rect x="80" y="56" width="8" height="8" fill="#222"/><rect x="116" y="56" width="8" height="8" fill="#222"/>' +
                '<rect x="20" y="80" width="8" height="8" fill="#222"/><rect x="32" y="80" width="8" height="8" fill="#222"/><rect x="56" y="80" width="8" height="8" fill="#222"/><rect x="80" y="80" width="8" height="8" fill="#222"/><rect x="104" y="80" width="8" height="8" fill="#222"/><rect x="140" y="80" width="8" height="8" fill="#222"/><rect x="164" y="80" width="8" height="8" fill="#222"/>' +
                '<rect x="20" y="92" width="8" height="8" fill="#222"/><rect x="44" y="92" width="8" height="8" fill="#222"/><rect x="68" y="92" width="8" height="8" fill="#222"/><rect x="92" y="92" width="8" height="8" fill="#222"/><rect x="116" y="92" width="8" height="8" fill="#222"/><rect x="152" y="92" width="8" height="8" fill="#222"/>' +
                '<rect x="32" y="104" width="8" height="8" fill="#222"/><rect x="56" y="104" width="8" height="8" fill="#222"/><rect x="80" y="104" width="8" height="8" fill="#222"/><rect x="104" y="104" width="8" height="8" fill="#222"/><rect x="128" y="104" width="8" height="8" fill="#222"/><rect x="164" y="104" width="8" height="8" fill="#222"/>' +
                '<rect x="44" y="116" width="8" height="8" fill="#222"/><rect x="80" y="116" width="8" height="8" fill="#222"/><rect x="92" y="116" width="8" height="8" fill="#222"/><rect x="116" y="116" width="8" height="8" fill="#222"/><rect x="140" y="116" width="8" height="8" fill="#222"/>' +
                '<rect x="80" y="128" width="8" height="8" fill="#222"/><rect x="104" y="128" width="8" height="8" fill="#222"/><rect x="128" y="128" width="8" height="8" fill="#222"/><rect x="152" y="128" width="8" height="8" fill="#222"/>' +
                '<rect x="80" y="140" width="8" height="8" fill="#222"/><rect x="116" y="140" width="8" height="8" fill="#222"/><rect x="140" y="140" width="8" height="8" fill="#222"/><rect x="164" y="140" width="8" height="8" fill="#222"/>' +
                '<rect x="80" y="152" width="8" height="8" fill="#222"/><rect x="92" y="152" width="8" height="8" fill="#222"/><rect x="128" y="152" width="8" height="8" fill="#222"/><rect x="152" y="152" width="8" height="8" fill="#222"/>' +
                '<rect x="80" y="164" width="8" height="8" fill="#222"/><rect x="104" y="164" width="8" height="8" fill="#222"/><rect x="128" y="164" width="8" height="8" fill="#222"/><rect x="140" y="164" width="8" height="8" fill="#222"/><rect x="164" y="164" width="8" height="8" fill="#222"/>' +
              '</svg>' +
            '</div>' +
            '<p class="login-qr-hint">打开手机扫一扫，快速登录</p>' +
          '</div>' +
          '<div id="login-account-panel" class="login-account-panel">' +
          '<div class="login-tabs">' +
            '<button class="login-tab active" data-login-tab="personal">个人登录</button>' +
            '<button class="login-tab" data-login-tab="corporate">法人登录</button>' +
          '</div>' +
          '<form id="login-form" class="login-form">' +
            '<div class="login-field">' +
              '<select id="login-demo-account" class="login-account-select">' +
              DEMO_USERS.map(function (u) { return '<option value="' + esc(u.id) + '">' + esc(u.label) + '</option>'; }).join("") +
              '</select>' +
              '<div class="login-account-hint">演示账号选择（不同账号拥有不同数据权限）</div>' +
            '</div>' +
            '<div class="login-field">' +
              '<input type="text" id="login-username" placeholder="请输入登录名" autocomplete="username" />' +
            '</div>' +
            '<div class="login-field">' +
              '<input type="password" id="login-password" placeholder="请输入密码" autocomplete="current-password" />' +
            '</div>' +
            '<div class="login-field login-captcha-row">' +
              '<input type="text" id="login-captcha" placeholder="请输入验证码，验证码不区分大小写" autocomplete="off" />' +
              '<img class="login-captcha-img" src="' + captchaSrc + '" alt="验证码" data-action="refresh-captcha" title="点击刷新验证码" />' +
            '</div>' +
            '<label class="login-agree">' +
              '<input type="checkbox" id="login-agree-check" checked /> ' +
              '我已阅读并同意遵守 <a href="javascript:void(0)" class="login-link">《用户服务协议》</a> 和 <a href="javascript:void(0)" class="login-link">《隐私协议》</a>' +
            '</label>' +
            '<div class="login-actions-row">' +
              '<a href="javascript:void(0)" class="login-link">找回账号/密码</a>' +
              '<a href="javascript:void(0)" class="login-link">立即注册</a>' +
            '</div>' +
            '<button type="submit" class="login-btn">登录</button>' +
          '</form>' +
          '<div class="login-other">' +
            '<p class="login-other-label">其他登录方式</p>' +
            '<div class="login-other-icons">' +
              '<div class="login-other-item"><span class="login-other-icon" style="background:#e0efff;color:#2670b8"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></span><span>短信验证码登录</span></div>' +
              '<div class="login-other-item"><span class="login-other-icon" style="background:#e0f5ea;color:#0a7b3e"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 15h6"/></svg></span><span>电子营业执照</span></div>' +
              '<div class="login-other-item"><span class="login-other-icon" style="background:#fde8e8;color:#cc4444"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 00-8 0v2"/><circle cx="12" cy="14" r="1.5"/></svg></span><span>机关事业单位<br/>网络身份凭证APP</span></div>' +
              '<div class="login-other-item"><span class="login-other-icon" style="background:#e0efff;color:#2670b8"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h4"/><path d="M7 12h6"/><rect x="15" y="9" width="3" height="5" rx="0.5"/></svg></span><span>卡式营业执照</span></div>' +
            '</div>' +
          '</div>' +
          '</div>' +
          '<p class="login-footer-hint">如有问题，请前往 <a href="javascript:void(0)" class="login-link">帮助中心</a></p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function routeFromHash(hashValue) {
    var raw = String(hashValue || "").replace(/^#/, "");
    if (!raw) return { path: "/", q: {} };
    var parts = raw.split("?");
    var path = parts[0] || "/";
    var q = {};
    try {
      var sp = new URLSearchParams(parts[1] || "");
      sp.forEach(function (v, k) {
        q[k] = v;
      });
    } catch (e) {}
    if (path.indexOf("/gov/geo-") === 0) q = govDemoNormalizeQuery(path, q || {});
    return { path: path, q: q };
  }

  function route() {
    return routeFromHash(location.hash || "");
  }

  function nav(role) {
    if (role === "gov") {
      return [
        ["产业大脑首页", "/gov/home", "home"],
        ["区域经济研判", "/gov/geo-street", "geo"],
        ["产业链式图谱", "/gov/chain", "chain"],
        ["重点项目调度", "/gov/key-projects", "project"],
        ["领导决策支撑", "/gov/decision-data", "decision"],
        ["企业迁出预警", "/gov/enterprise-exit", "alert"],
        ["经济目标考核", "/gov/economic-targets", "dashboard"],
        ["政府统计数据", "/gov/government-stats", "report"],
        ["企业画像分析", "/gov/portrait", "portrait"],
        ["政策智能匹配", "/gov/policy-match", "policy"],
        ["演示数据设置", "/gov/settings", "settings"],
      ];
    }
    if (role === "enterprise") {
      return [
        ["企业服务主页", "/ent/home", "home"],
        ["企业经营主页", "/ent/company", "enterprise"],
        ["供应链路服务", "/ent/supply-chain", "chain"],
        ["资金链路服务", "/ent/capital-chain", "invest"],
        ["研发创新服务", "/ent/rd-service", "project"],
        ["政策园区服务", "/ent/policy-park", "policy"],
        ["线下活动专区", "/ent/offline-events", "geo"],
      ];
    }
    if (role === "bank") {
      return [
        ["银行业务总览", "/bank/overview", "dashboard"],
        ["融资线索管理", "/bank/leads", "invest"],
        ["推进工作台账", "/bank/workbench", "project"],
        ["风险关注预警", "/bank/risk", "alert"],
        ["演示数据设置", "/bank/settings", "settings"],
      ];
    }
    return [];
  }

  function roleLabel(role) {
    if (role === "gov") return "青羊区政府专版";
    if (role === "enterprise") return "企业端";
    if (role === "bank") return "银行端";
    return "区本级";
  }

  function roleRoutePrefix(role) {
    if (role === "enterprise") return "/ent";
    if (role === "bank") return "/bank";
    return "/gov";
  }

  function roleHomePath(role) {
    if (role === "bank") return "/bank/overview";
    return roleRoutePrefix(role) + "/home";
  }

  function shellTopbarTitle(role, activePath) {
    var items = nav(role);
    // Direct nav match
    for (var i = 0; i < items.length; i++) {
      if (items[i][1] === activePath) return items[i][0];
    }
    // Sub-route fallbacks (kept consistent with sidebar at 6 chars)
    if (role === "gov") {
      if (activePath.indexOf("/gov/geo-") === 0 || activePath === "/gov/overview") return "区域经济研判";
      if (activePath.indexOf("/gov/chain") === 0) return "产业链式图谱";
      if (activePath.indexOf("/gov/key-projects") === 0) return "重点项目调度";
      if (activePath === "/gov/policy-enterprise" || activePath === "/gov/policy-gov") return "政策智能匹配";
      if (activePath.indexOf("/gov/portrait/") === 0) return "企业画像分析";
      if (activePath.indexOf("/gov/enterprise/") === 0) return "企业详细画像";
      if (activePath.indexOf("/gov/alert/") === 0) return "企业预警详情";
      if (activePath === "/gov/enterprises") return "企业总库目录";
      if (activePath === "/gov/alerts") return "预警分析看板";
      if (activePath === "/gov/ecosystem") return "产业生态全景";
      if (activePath === "/gov/investment-analysis") return "招商分析专题";
      if (activePath === "/gov/ai-analysis") return "区域经济研判";
      if (activePath === "/gov/brain-dashboard") return "产业大脑首页";
    }
    if (role === "bank") {
      if (activePath.indexOf("/bank/lead/") === 0) return "融资线索详情";
    }
    return roleLabel(role);
  }

  function shellTopbarIcon(role, activePath) {
    var items = nav(role);
    for (var i = 0; i < items.length; i++) {
      if (items[i][1] === activePath) return items[i][2] || "home";
    }
    if (role === "gov") {
      if (activePath.indexOf("/gov/geo-") === 0 || activePath === "/gov/overview" || activePath === "/gov/ai-analysis") return "geo";
      if (activePath.indexOf("/gov/chain") === 0) return "chain";
      if (activePath.indexOf("/gov/key-projects") === 0) return "project";
      if (activePath === "/gov/policy-enterprise" || activePath === "/gov/policy-gov") return "policy";
      if (activePath.indexOf("/gov/portrait/") === 0 || activePath === "/gov/enterprises") return "portrait";
      if (activePath.indexOf("/gov/enterprise/") === 0) return "portrait";
      if (activePath.indexOf("/gov/alert/") === 0 || activePath === "/gov/alerts") return "alert";
      if (activePath === "/gov/ecosystem") return "chain";
      if (activePath === "/gov/investment-analysis") return "invest";
      if (activePath === "/gov/brain-dashboard") return "home";
    }
    if (role === "bank") {
      if (activePath.indexOf("/bank/lead/") === 0) return "invest";
    }
    return role === "gov" ? "gov" : role === "bank" ? "bank" : "enterprise";
  }

  function shell(activePath, contentHtml, opts) {
    opts = opts || {};
    var role = state.role;
    var ctx = "";
    if (role === "enterprise") {
      var e = entById(state.active.enterprise_id);
      if (e) ctx = " · " + e.name;
    }
    if (role === "bank") {
      var b = bankById(state.active.bank_id);
      if (b) ctx = " · " + b.name;
    }

    var navHtml = nav(role)
      .map(function (it) {
        var label = it[0];
        var path = it[1];
        var icon = it[2] || "";
        var active = path === activePath;
        if (!active && role === "gov" && path === "/gov/geo-street" && activePath.indexOf("/gov/geo-") === 0) active = true;
        if (!active && role === "gov" && path === "/gov/key-projects" && activePath.indexOf("/gov/key-projects") === 0) active = true;
        if (!active && role === "gov" && path === "/gov/policy-match" && (activePath === "/gov/policy-enterprise" || activePath === "/gov/policy-gov")) active = true;
        var cls = active ? "active" : "";
        return '<a class="' + cls + '" href="#' + path + '"><span class="nav-icon">' + uiIcon(icon, "nav-icon-glyph") + '</span><span class="nav-label">' + esc(label) + "</span></a>";
      })
      .join("");

    var rolePrefix = roleRoutePrefix(role);
    var homePath = roleHomePath(role);
    var topbarTitle = shellTopbarTitle(role, activePath);
    var searchPlaceholder = role === "gov" ? "搜索区县/街道/楼宇..." : "搜索企业/政策/资源...";
    var topbarUserName = currentUser().name;

    var topbarHtml =
      opts.hideTopbar
        ? ""
        : '<div class="topbar">' +
          '<div class="topbar-left"><span class="topbar-brand"><span class="topbar-brand-icon">' +
          uiIcon(shellTopbarIcon(role, activePath)) +
          '</span><span>' + esc(topbarTitle) + '</span></span></div>' +
          '<div class="topbar-right">' +
          (opts.hideSearch ? '' : '<div class="search"><input data-role="global-search" placeholder="' + esc(searchPlaceholder) + '" /></div>') +
          '<a class="topbar-action-btn" href="#/" title="切换角色">' + uiIcon('back', 'link-icon') + '<span>切换角色</span></a>' +
          '<span class="topbar-user">' + uiIcon('enterprise', 'link-icon') + '<span>' + esc(topbarUserName) + '</span></span>' +
          '</div>' +
          '</div>';

    return (
      '<div class="app-shell">' +
      '<aside class="side">' +
      '<div class="brand"><p class="brand-title">青羊区产业大脑演示平台</p><p class="brand-sub">' +
      esc(roleLabel(role) + ctx) +
      "</p></div>" +
      '<nav class="nav">' +
      navHtml +
      "</nav>" +
      "</aside>" +
      '<main class="main">' +
      topbarHtml +
      contentHtml +
      "</main>" +
      "</div>"
    );
  }

  function toast(msg, type) {
    var el = document.getElementById("toast");
    if (!el) return;
    var icons = { success: "\u2705", warn: "\u26A0", error: "\u274C", info: "\u2139" };
    var t = type || "info";
    el.className = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = '<span class="toast-icon">' + (icons[t] || icons.info) + '</span><span>' + esc(msg) + '</span>';
    el.classList.add("show", "toast-" + t);
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.classList.remove("show");
    }, 2000);
  }

  function copyText(value) {
    var text = String(value == null ? "" : value);
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(function () {
        return false;
      });
    }
    return new Promise(function (resolve) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        resolve(document.execCommand("copy"));
      } catch (err) {
        resolve(false);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function ensureChrome() {
    if (!document.getElementById("toast")) {
      var t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      document.body.appendChild(t);
    }
    if (!document.getElementById("modal-backdrop")) {
      var back = document.createElement("div");
      back.id = "modal-backdrop";
      back.className = "modal-backdrop";
      back.innerHTML =
        '<div class="modal"><div class="hd"><h3 id="modal-title"></h3><button class="btn" data-action="modal_close">关闭</button></div><div class="bd" id="modal-body"></div></div>';
      document.body.appendChild(back);
    }
    if (!document.getElementById("scroll-progress")) {
      var sp = document.createElement("div");
      sp.id = "scroll-progress";
      sp.className = "scroll-progress";
      sp.style.width = "0%";
      document.body.appendChild(sp);
    }
    if (!document.getElementById("side-toggle")) {
      var st = document.createElement("button");
      st.id = "side-toggle";
      st.className = "side-toggle";
      st.innerHTML = "\u2630";
      st.addEventListener("click", function () {
        var shell = document.querySelector(".app-shell");
        if (shell) shell.classList.toggle("side-collapsed");
      });
      document.body.appendChild(st);
    }
  }

  function modalOpen(title, bodyHtml) {
    ensureChrome();
    document.getElementById("modal-title").textContent = title || "";
    document.getElementById("modal-body").innerHTML = bodyHtml || "";
    document.getElementById("modal-backdrop").classList.add("show");
  }

  function modalClose() {
    var back = document.getElementById("modal-backdrop");
    if (back) back.classList.remove("show");
  }

  function hasConsent(entId, bankId, purpose) {
    return (
      (state.consents || []).find(function (c) {
        return c.enterprise_id === entId && c.bank_id === bankId && (!purpose || c.purpose === purpose);
      }) != null
    );
  }

  function setConsent(entId, bankId, purpose, on) {
    setState(function (st) {
      st.consents = st.consents || [];
      var i = st.consents.findIndex(function (c) {
        return c.enterprise_id === entId && c.bank_id === bankId && c.purpose === purpose;
      });
      if (on) {
        if (i < 0) st.consents.push({ enterprise_id: entId, bank_id: bankId, purpose: purpose, granted_at: today() });
      } else {
        if (i >= 0) st.consents.splice(i, 1);
      }
    });
  }

  function workOrderByRef(type, refId) {
    return (state.work_orders || []).find(function (w) {
      return w.type === type && w.ref_id === refId;
    });
  }

  function alertStatus(alertId) {
    var w = workOrderByRef("alert", alertId);
    return (w && w.status) || "未处置";
  }

  function kpis(items) {
    return (
      '<div class="kpis">' +
      items
        .map(function (x) {
          return (
            '<div class="kpi"><div class="label">' +
            esc(x.label) +
            '</div><div class="value">' +
            esc(x.value) +
            '</div><div class="hint">' +
            esc(x.hint || "") +
            "</div></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function card(title, meta, actionsHtml, bodyHtml, colSpan) {
    return (
      '<div class="card fade-in" style="grid-column: span ' +
      (colSpan || 12) +
      ';">' +
      '<div class="hd"><div><p class="title">' +
      esc(title) +
      '</p><div class="meta">' +
      esc(meta || "") +
      "</div></div>" +
      (actionsHtml ? '<div style="display:flex;gap:10px;align-items:center;">' + actionsHtml + "</div>" : "") +
      "</div>" +
      '<div class="bd">' +
      (bodyHtml || "") +
      "</div></div>"
    );
  }

  function pageRolePicker() {
    var entOpts = (seed.enterprises || [])
      .filter(isRealEnterprise)
      .map(function (e) {
        return '<option value="' + esc(e.id) + '">' + esc(e.name + " · " + e.industry) + "</option>";
      })
      .join("");
    var bankOpts = (seed.banks || [])
      .map(function (b) {
        return '<option value="' + esc(b.id) + '">' + esc(b.name) + "</option>";
      })
      .join("");

    return (
      '<div class="hero fade-in">' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;"><span style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:8px;background:var(--accent);color:#fff;font-size:18px;font-weight:700;">脑</span><div>' +
      "<h1 style=\"font-size:28px;margin:0;\">青羊区产业大脑演示平台</h1>" +
      "</div></div>" +
      '<p class="muted" style="margin:0 0 4px;font-size:14px;">请选择要进入的角色端口。</p>' +
      '<div class="role-grid" style="margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:18px;">' +
      '<div class="role gov"><div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;"><span style="font-size:26px;">🏛</span><h2>青羊区政府端</h2></div><ul><li>区域经济动态分析与空间研判</li><li>产业链式图谱与招商补链分析</li><li>重点项目、领导决策、政策匹配一体化展示</li></ul>' +
      '<div class="actions"><button class="btn primary" data-action="enter_role" data-role="gov">进入政府端</button></div></div>' +
      '<div class="role enterprise"><div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;"><span style="font-size:26px;">🏢</span><h2>青羊区企业端</h2></div><ul><li>供应链与资金链智能匹配服务</li><li>研发服务与产业专家对接</li><li>政策推送、园区推荐与线下活动</li></ul>' +
      '<div class="actions"><button class="btn primary" data-action="enter_role" data-role="enterprise">进入企业端</button></div></div>' +
      "</div></div>"
    );
  }

  function riskTag(level) {
    if (level === "高") return '<span class="tag red">高风险</span>';
    if (level === "中") return '<span class="tag orange">中风险</span>';
    return '<span class="tag green">低风险</span>';
  }

  function heatTag(v) {
    if (v >= 90) return '<span class="tag red">🔥 极热</span>';
    if (v >= 80) return '<span class="tag orange">⚡ 活跃</span>';
    return '<span class="tag green">✓ 稳定</span>';
  }

  function pct(v, digits) {
    var n = Number(v || 0) * 100;
    return n.toFixed(digits == null ? 0 : digits) + "%";
  }

  function fixed(v, digits) {
    var n = Number(v || 0);
    return n.toFixed(digits == null ? 1 : digits);
  }

  function fmtNum(v) {
    var n = Number(v || 0);
    if (!isFinite(n)) return "0";
    return n.toLocaleString("zh-CN");
  }

  function listFromCsv(v) {
    if (!v) return [];
    return String(v)
      .split(",")
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
  }

  function hashNumber(s) {
    var n = 0;
    String(s || "").split("").forEach(function (ch) {
      n = (n * 31 + ch.charCodeAt(0)) >>> 0;
    });
    return n;
  }

  function jitter(seed, span) {
    var x = Math.sin(seed) * 10000;
    return (x - Math.floor(x) - 0.5) * span;
  }

  function buildHash(path, q) {
    q = govDemoNormalizeQuery(path, q || {});
    var sp = new URLSearchParams();
    Object.keys(q || {}).forEach(function (k) {
      // Strip viewport params — they are synced separately via replaceState
      if (k === "_vz" || k === "_vtx" || k === "_vty") return;
      var v = q[k];
      if (v === undefined || v === null || String(v) === "") return;
      sp.set(k, String(v));
    });
    var tail = sp.toString();
    return "#" + path + (tail ? "?" + tail : "");
  }

  // Debounced viewport state → URL sync (so shared links restore the exact view)
  var _geoViewUrlTimer = 0;
  function geoSyncViewToUrl() {
    if (_geoViewUrlTimer) clearTimeout(_geoViewUrlTimer);
    _geoViewUrlTimer = setTimeout(function () {
      _geoViewUrlTimer = 0;
      var rt = route();
      if (!rt.path || rt.path.indexOf("/gov/geo-") !== 0) return;
      var view = getActiveGeoView();
      if (!view) return;
      var vz = view.zoom.toFixed(2);
      var vtx = view.tx.toFixed(1);
      var vty = view.ty.toFixed(1);
      var stage = document.querySelector('[data-role="geo-stage"]');
      var provider = geoTileProviderByKey(((rt.q && rt.q.omt_p) || geoDefaultOnlineProvider()));
      var worldView = stage ? geoApproxNativeMapView(stage, view, provider) : null;
      var gvz = worldView ? Number(worldView.zoom || 1).toFixed(2) : "";
      var glon = worldView ? Number(worldView.centerLon || 0).toFixed(6) : "";
      var glat = worldView ? Number(worldView.centerLat || 0).toFixed(6) : "";
      // Only update if viewport changed meaningfully
      if (rt.q._vz === vz && rt.q._vtx === vtx && rt.q._vty === vty && rt.q._gvz === gvz && rt.q._glon === glon && rt.q._glat === glat) return;
      var sp = new URLSearchParams();
      Object.keys(rt.q || {}).forEach(function (k) {
        if (k === "_vz" || k === "_vtx" || k === "_vty" || k === "_gvz" || k === "_glon" || k === "_glat" || k === "_keepvp") return;
        var v = rt.q[k];
        if (v === undefined || v === null || String(v) === "") return;
        sp.set(k, String(v));
      });
      sp.set("_vz", vz);
      sp.set("_vtx", vtx);
      sp.set("_vty", vty);
      if (gvz && glon && glat) {
        sp.set("_gvz", gvz);
        sp.set("_glon", glon);
        sp.set("_glat", glat);
      }
      var newHash = "#" + rt.path + "?" + sp.toString();
      if (location.hash !== newHash) {
        history.replaceState(null, "", newHash);
      }
    }, 600);
  }

  function geoRouteFocusChanged(currentRt, nextPath, nextQ) {
    var focusKeys = ["scope", "did", "sid", "pid", "park_mode"];
    var rt = currentRt || route();
    var rtQ = (rt && rt.q) || {};
    var changed = nextPath !== ((rt && rt.path) || "");
    for (var i = 0; i < focusKeys.length; i++) {
      var key = focusKeys[i];
      if (String((rtQ[key] || "")) !== String((((nextQ || {})[key]) || ""))) {
        changed = true;
        break;
      }
    }
    return changed;
  }

  function geoCancelPreflightAnimation() {
    if (geoPreflightAnimRaf) {
      cancelAnimationFrame(geoPreflightAnimRaf);
      geoPreflightAnimRaf = 0;
    }
    geoPreflightAnimToken += 1;
  }

  function geoRouteSceneDepth(path, q) {
    if (!path || path.indexOf("/gov/geo-") !== 0) return -1;
    var scope = (q && q.scope) || (path === "/gov/geo-park" ? "park" : path === "/gov/geo-street" ? "street" : "district");
    if (path === "/gov/geo-district") return 0;
    if (scope === "park") return (q && q.park_mode) === "all" ? 1.55 : 2;
    return 1;
  }

  function geoRouteMotionProfile(currentRt, nextPath, nextQ) {
    var currentDepth = geoRouteSceneDepth(currentRt && currentRt.path, currentRt && currentRt.q);
    var nextDepth = geoRouteSceneDepth(nextPath, nextQ || {});
    if (nextDepth > currentDepth + 0.2) {
      return { mode: "drill-in", currentDepth: currentDepth, nextDepth: nextDepth };
    }
    if (nextDepth < currentDepth - 0.2) {
      return { mode: "pull-back", currentDepth: currentDepth, nextDepth: nextDepth };
    }
    return { mode: "lateral", currentDepth: currentDepth, nextDepth: nextDepth };
  }

  function geoEaseOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function geoEaseOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function geoEaseInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function geoMotionEase(mode, t) {
    if (mode === "drill-in") return geoEaseOutQuart(t);
    if (mode === "pull-back") return geoEaseInOutSine(t);
    return geoEaseOutCubic(t);
  }

  function geoResolveRouteLandingTarget(path, q) {
    if (!path || path.indexOf("/gov/geo-") !== 0) return null;
    var nextQ = q || {};
    if (path === "/gov/geo-district") {
      return nextQ.did ? { id: String(nextQ.did) } : null;
    }
    if (path === "/gov/geo-street") {
      if (nextQ.scope === "park") {
        if (nextQ.park_mode !== "all" && nextQ.pid) return { id: String(nextQ.pid) };
        return null;
      }
      return nextQ.sid ? { id: String(nextQ.sid) } : null;
    }
    if (path === "/gov/geo-park") {
      if (nextQ.park_mode !== "all" && nextQ.pid) return { id: String(nextQ.pid) };
      return null;
    }
    return null;
  }

  function geoClearLandingFocus() {
    if (geoLandingFocusTimer) {
      clearTimeout(geoLandingFocusTimer);
      geoLandingFocusTimer = 0;
    }
    geoLandingFocusState = null;
    var nodes = document.querySelectorAll(".geo-boundary-shape.landing-focus");
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove("landing-focus");
  }

  function geoPrimeLandingFocus(path, q) {
    var target = geoResolveRouteLandingTarget(path, q || {});
    if (!target) {
      geoLandingFocusState = null;
      return;
    }
    geoLandingFocusState = {
      key: geoViewKey(path, q || {}),
      id: target.id,
      expiresAt: Date.now() + 640,
    };
  }

  function geoKickLandingFocus(path, q) {
    if (!geoLandingFocusState) return false;
    if (geoLandingFocusState.key !== geoViewKey(path, q || {})) return false;
    var now = Date.now();
    if (now > Number(geoLandingFocusState.expiresAt || 0)) {
      geoLandingFocusState = null;
      return false;
    }
    var stage = document.querySelector('[data-role="geo-stage"]');
    if (!stage || !document.body.contains(stage)) return false;
    var nodes = stage.querySelectorAll(".geo-boundary-shape[data-id]");
    var activeNodes = [];
    for (var i = 0; i < nodes.length; i++) {
      if (String(nodes[i].getAttribute("data-id") || "") !== geoLandingFocusState.id) continue;
      nodes[i].classList.add("landing-focus");
      activeNodes.push(nodes[i]);
    }
    if (!activeNodes.length) return false;
    if (geoLandingFocusTimer) clearTimeout(geoLandingFocusTimer);
    var landingKey = geoLandingFocusState.key;
    var remaining = Math.max(120, Number(geoLandingFocusState.expiresAt || 0) - now);
    geoLandingFocusTimer = setTimeout(function () {
      for (var j = 0; j < activeNodes.length; j++) {
        if (document.body.contains(activeNodes[j])) activeNodes[j].classList.remove("landing-focus");
      }
      geoLandingFocusTimer = 0;
      if (
        geoLandingFocusState &&
        geoLandingFocusState.key === landingKey &&
        Date.now() >= Number(geoLandingFocusState.expiresAt || 0)
      ) {
        geoLandingFocusState = null;
      }
    }, remaining);
    return true;
  }

  function geoShouldAnimateRouteChange(currentRt, nextPath, nextQ, opts) {
    if (opts && opts.skipGeoFly) return false;
    if (!currentRt || String(currentRt.path || "").indexOf("/gov/geo-") !== 0) return false;
    if (String(nextPath || "").indexOf("/gov/geo-") !== 0) return false;
    if (!geoRouteFocusChanged(currentRt, nextPath, nextQ)) return false;
    if (Date.now() < geoAutoSwitchUntil && !(opts && opts.forceGeoFly)) return false;
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return false;
    }
    var stage = document.querySelector('[data-role="geo-stage"]');
    var view = getActiveGeoView();
    return !!stage && !!view && document.body.contains(stage);
  }

  function geoAnimatePreflightToRoute(nextPath, nextQ, onDone) {
    var stage = document.querySelector('[data-role="geo-stage"]');
    var view = getActiveGeoView();
    if (!stage || !view || !document.body.contains(stage)) return false;
    var motionProfile = geoRouteMotionProfile(route(), nextPath, nextQ || {});

    var targetView = geoInitialView(stage, nextPath, nextQ || {});
    if (!targetView) return false;
    geoClampViewToStage(stage, targetView);

    var startView = {
      zoom: Number(view.zoom || 1),
      tx: Number(view.tx || 0),
      ty: Number(view.ty || 0),
    };
    if (
      Math.abs(startView.zoom - targetView.zoom) < 0.01 &&
      Math.abs(startView.tx - targetView.tx) < 1 &&
      Math.abs(startView.ty - targetView.ty) < 1
    ) {
      return false;
    }

    geoCancelPreflightAnimation();
    var token = geoPreflightAnimToken;
    var zoomSpan = Math.abs(
      Math.log(Math.max(0.01, targetView.zoom || 1) / Math.max(0.01, startView.zoom || 1)) / Math.LN2
    );
    var panSpan = Math.sqrt(
      Math.pow(Number(targetView.tx || 0) - startView.tx, 2) +
        Math.pow(Number(targetView.ty || 0) - startView.ty, 2)
    );
    var duration = 0;
    if (motionProfile.mode === "drill-in") {
      duration = clamp(170 + zoomSpan * 58 + Math.min(panSpan, 260) * 0.12, 180, 320);
    } else if (motionProfile.mode === "pull-back") {
      duration = clamp(250 + zoomSpan * 88 + Math.min(panSpan, 360) * 0.18, 260, 430);
    } else {
      duration = clamp(210 + zoomSpan * 70 + Math.min(panSpan, 320) * 0.16, 220, 380);
    }
    var nativeMode = geoIsNativeBasemapQuery((route().q) || {});
    var startedAt = performance.now();
    geoShowPreflightHighlight(stage, nextPath, nextQ || {}, duration);

    function tick(now) {
      if (token !== geoPreflightAnimToken) return;
      var t = Math.min((now - startedAt) / duration, 1);
      var ease = geoMotionEase(motionProfile.mode, t);
      view.zoom = startView.zoom + (targetView.zoom - startView.zoom) * ease;
      view.tx = startView.tx + (targetView.tx - startView.tx) * ease;
      view.ty = startView.ty + (targetView.ty - startView.ty) * ease;
      geoClampViewToStage(stage, view);
      scheduleGeoInteractionFrame(stage, view, { motion: t < 1 });
      if (nativeMode) scheduleGeoNativeMapSync(stage, view, false);
      if (t < 1) {
        geoPreflightAnimRaf = requestAnimationFrame(tick);
        return;
      }
      geoPreflightAnimRaf = 0;
      if (typeof onDone === "function") onDone();
    }

    geoPreflightAnimRaf = requestAnimationFrame(tick);
    return true;
  }

  function geoClearPreflightHighlight() {
    if (geoPreflightHighlightTimer) {
      clearTimeout(geoPreflightHighlightTimer);
      geoPreflightHighlightTimer = 0;
    }
    var node = document.getElementById("geo-preflight-highlight");
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function geoBoundsToRing(bounds) {
    if (!bounds) return [];
    var minX = clamp(Number(bounds.minX || 0), 0, 100);
    var minY = clamp(Number(bounds.minY || 0), 0, 100);
    var maxX = clamp(Number(bounds.maxX || 0), 0, 100);
    var maxY = clamp(Number(bounds.maxY || 0), 0, 100);
    if (maxX - minX < 0.2 || maxY - minY < 0.2) return [];
    return [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ];
  }

  function geoRouteHighlightRings(path, q) {
    if (!path || path.indexOf("/gov/geo-") !== 0) return [];
    var nextQ = q || {};
    var pick = geoResolveForAuto(nextQ);
    var item = null;
    if (path === "/gov/geo-district") {
      item = pick.district || geoDistrictById(nextQ.did || "");
    } else if (path === "/gov/geo-street") {
      if (nextQ.scope === "park" && nextQ.park_mode !== "all") {
        item = pick.park || geoParkById(nextQ.pid || "");
      } else {
        item = pick.street || geoStreetById(nextQ.sid || "");
      }
    } else if (path === "/gov/geo-park") {
      if (nextQ.park_mode !== "all") item = pick.park || geoParkById(nextQ.pid || "");
    }
    var rings = geoItemRings(item);
    if (rings && rings.length) return rings;
    var fallbackRing = geoBoundsToRing(geoFocusBounds(path, nextQ));
    return fallbackRing.length ? [fallbackRing] : [];
  }

  function geoShowPreflightHighlight(stage, nextPath, nextQ, duration) {
    if (!stage || !document.body.contains(stage)) return;
    var rings = geoRouteHighlightRings(nextPath, nextQ || {});
    if (!rings || !rings.length) return;
    geoClearPreflightHighlight();
    var node = document.createElement("div");
    node.id = "geo-preflight-highlight";
    node.className = "geo-preflight-highlight";
    node.innerHTML =
      '<svg class="geo-preflight-highlight-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
      rings
        .map(function (ring) {
          return '<polygon class="geo-focus-border geo-preflight-ring" points="' + geoRingToPoints(ring) + '" />';
        })
        .join("") +
      "</svg>";
    stage.appendChild(node);
    geoPreflightHighlightTimer = setTimeout(function () {
      geoClearPreflightHighlight();
    }, Math.max(260, Math.min(520, Number(duration || 320) + 120)));
  }

  function geoCommitRouteHash(nextPath, nextQ, currentRt, opts) {
    geoCancelPreflightAnimation();
    geoClearPreflightHighlight();
    geoClearLandingFocus();
    var rt = currentRt || route();
    var normalizedQ = nextPath.indexOf("/gov/geo-") === 0 ? govDemoNormalizeQuery(nextPath, nextQ || {}) : (nextQ || {});
    if (nextPath.indexOf("/gov/geo-") === 0) {
      var focusChanged = geoRouteFocusChanged(rt, nextPath, normalizedQ);
      // When skipGeoFly, persist the current view under the canonical target key
      // so initGeoViewport picks up the exact same position after hash redirect.
      if (opts && opts.skipGeoFly) {
        normalizedQ._keepvp = "1";
        var activeView = getActiveGeoView();
        if (activeView) {
          var activeStage = document.querySelector('[data-role="geo-stage"]');
          var activeProvider = geoTileProviderByKey((((rt && rt.q) || {}).omt_p) || geoDefaultOnlineProvider());
          var activeWorldView = activeStage ? geoApproxNativeMapView(activeStage, activeView, activeProvider) : null;
          geoSeedForcedViewCarry(nextPath, normalizedQ, activeView, opts);
          if (activeWorldView) {
            normalizedQ._gvz = Number(activeWorldView.zoom || 1).toFixed(2);
            normalizedQ._glon = Number(activeWorldView.centerLon || 0).toFixed(6);
            normalizedQ._glat = Number(activeWorldView.centerLat || 0).toFixed(6);
          }
          var canonQ = geoCanonicalQueryForKey(nextPath, normalizedQ);
          var targetKey = geoViewKey(nextPath, canonQ);
          geoViewStates[targetKey] = {
            zoom: Number(activeView.zoom || 1),
            tx: Number(activeView.tx || 0),
            ty: Number(activeView.ty || 0),
          };
        }
      }
      if (focusChanged) {
        geoFastRenderUntil = Date.now() + 260;
        geoSceneTransitionPendingAt = Date.now();
        geoSeedPendingViewState(nextPath, normalizedQ, opts);
        geoPrimeLandingFocus(nextPath, normalizedQ);
        if (geoRefineRenderTimer) clearTimeout(geoRefineRenderTimer);
      }
      if (opts && opts.resetGeoView) geoDropViewState(nextPath, normalizedQ);
    }
    location.hash = buildHash(nextPath, normalizedQ);
  }

  function geoNavigateToRoute(nextPath, nextQ, opts) {
    var rt = route();
    var normalizedQ = nextPath.indexOf("/gov/geo-") === 0 ? govDemoNormalizeQuery(nextPath, nextQ || {}) : (nextQ || {});
    if (!geoShouldAnimateRouteChange(rt, nextPath, normalizedQ, opts)) {
      geoCommitRouteHash(nextPath, normalizedQ, rt, opts);
      return true;
    }
    var doneOpts = Object.assign({}, opts || {}, { skipGeoFly: true });
    if (
      !geoAnimatePreflightToRoute(nextPath, normalizedQ, function () {
        geoCommitRouteHash(nextPath, normalizedQ, route(), doneOpts);
      })
    ) {
      geoCommitRouteHash(nextPath, normalizedQ, rt, opts);
    }
    return true;
  }

  function updateGeoHash(changes, pathOverride, opts) {
    var rt = route();
    var nextPath = pathOverride || rt.path;
    var nextQ = {};
    Object.keys(rt.q || {}).forEach(function (k) {
      nextQ[k] = rt.q[k];
    });
    Object.keys(changes || {}).forEach(function (k) {
      nextQ[k] = changes[k];
    });
    return geoNavigateToRoute(nextPath, nextQ, opts);
  }

  function geoLevelByPath(path) {
    if (path === "/gov/geo-street") return "street";
    if (path === "/gov/geo-park") return "street";
    return "district";
  }

  var _geoRevenueMaps = null;
  function geoRevenueMaps() {
    if (_geoRevenueMaps) return _geoRevenueMaps;
    var byDistrict = {}, byStreet = {}, byPark = {}, byBuilding = {};
    (seed.enterprises || []).filter(isRealEnterprise).forEach(function (e) {
      var rev = (e.kpis && e.kpis.revenue_y) || 0;
      if (e.district_id) byDistrict[e.district_id] = (byDistrict[e.district_id] || 0) + rev;
      if (e.street_id) byStreet[e.street_id] = (byStreet[e.street_id] || 0) + rev;
      if (e.park_id) byPark[e.park_id] = (byPark[e.park_id] || 0) + rev;
      if (e.building_id) byBuilding[e.building_id] = (byBuilding[e.building_id] || 0) + rev;
    });
    _geoRevenueMaps = { district: byDistrict, street: byStreet, park: byPark, building: byBuilding };
    return _geoRevenueMaps;
  }

  function geoMetricValue(item, level, metric) {
    var metricId = geoNormalizeMetricId(metric);
    if (!metricId) return 0;
    if (metricId === "revenue") {
      var maps = geoRevenueMaps();
      return maps.district[item.id] || maps.street[item.id] || maps.park[item.id] || maps.building[item.id] || 0;
    }
    if (level === "district") {
      if (metricId === "output") return Number(item.output_y || 0);
      if (metricId === "tax") return Number(item.tax_y || 0);
      return Number(item.enterprises || 0);
    }
    if (level === "street") {
      if (metricId === "output") return Number(item.output_y || 0) || Number(item.land_eff || 0) * 100;
      if (metricId === "tax") return Number(item.tax_y || 0) || Number(item.key_enterprises || 0);
      return Number(item.enterprises || 0);
    }
    if (metricId === "output") return Number(item.output_y || 0);
    if (metricId === "tax") return Number(item.tax_y || 0);
    return Number(item.occupied_rate || 0) * 100;
  }

  function geoChainList(city) {
    if (city === "wenjiang") return ["医药健康", "绿色食品", "现代都市农业", "装备制造", "数字农业", "低空经济"];
    return ["航空航天", "文旅", "金融", "商务商贸", "数字服务", "智能制造", "生物医药", "创新服务"];
  }

  function geoScopeName(scope) {
    if (scope === "park") return "园区级";
    if (scope === "street") return "街道级";
    return "区本级";
  }

  function geoNormalizeMetricId(metricId) {
    return metricId === "revenue" || metricId === "output" || metricId === "tax"
      ? metricId
      : "";
  }

  function geoCanonicalQueryForKey(path, q) {
    var nextQ = {};
    Object.keys(q || {}).forEach(function (k) { nextQ[k] = q[k]; });
    var pick = geoResolveForAuto(nextQ);
    if (!nextQ.did && pick.did) nextQ.did = pick.did;
    if (!nextQ.omt_p) nextQ.omt_p = geoDefaultOnlineProvider();
    if (path === "/gov/geo-district") {
      nextQ.scope = "district"; nextQ.sid = ""; nextQ.pid = ""; nextQ.park_mode = "";
    } else if (path === "/gov/geo-park") {
      nextQ.scope = "park";
      if (!nextQ.park_mode) nextQ.park_mode = "all";
    } else if (path === "/gov/geo-street") {
      if (!nextQ.scope || nextQ.scope === "district" || nextQ.scope === "park") nextQ.scope = "street";
      nextQ.pid = ""; nextQ.park_mode = "";
    }
    return nextQ;
  }

  function geoCanonicalHash(path, q) {
    if (!path || path.indexOf("/gov/geo-") !== 0) return "";
    var nextQ = {};
    Object.keys(q || {}).forEach(function (k) {
      nextQ[k] = q[k];
    });
    var changed = false;
    var pick = geoResolveForAuto(nextQ);

    if (!nextQ.did && pick.did) {
      nextQ.did = pick.did;
      changed = true;
    }
    if (nextQ.omt == null) {
      nextQ.omt = "1";
      changed = true;
    }
    if (!nextQ.omt_p) {
      nextQ.omt_p = geoDefaultOnlineProvider();
      changed = true;
    }

    if (path === "/gov/geo-district") {
      if (nextQ.scope !== "district") {
        nextQ.scope = "district";
        changed = true;
      }
      if (nextQ.sid) {
        nextQ.sid = "";
        changed = true;
      }
      if (nextQ.pid) {
        nextQ.pid = "";
        changed = true;
      }
      if (nextQ.park_mode) {
        nextQ.park_mode = "";
        changed = true;
      }
    } else if (path === "/gov/geo-park") {
      if (nextQ.scope !== "park") {
        nextQ.scope = "park";
        changed = true;
      }
      // Do NOT auto-fill pid — allow overview mode showing all park boundaries
      if (!nextQ.park_mode) {
        nextQ.park_mode = "all";
        changed = true;
      }
    } else if (path === "/gov/geo-street") {
      if (!nextQ.scope || nextQ.scope === "district" || nextQ.scope === "park") {
        nextQ.scope = "street";
        changed = true;
      }
      // Do NOT auto-fill sid — allow overview mode showing all street boundaries
      if (nextQ.pid) {
        nextQ.pid = "";
        changed = true;
      }
      if (nextQ.park_mode) {
        nextQ.park_mode = "";
        changed = true;
      }
    } else if (path === "/gov/geo-building") {
      if (!nextQ.scope || nextQ.scope === "district") {
        nextQ.scope = "street";
        changed = true;
      }
      // Do NOT auto-fill sid/pid — allow overview mode showing all building boundaries
      if (nextQ.scope === "park") {
        if (!nextQ.park_mode) {
          nextQ.park_mode = "all";
          changed = true;
        }
      } else {
        if (nextQ.pid) {
          nextQ.pid = "";
          changed = true;
        }
        if (nextQ.park_mode) {
          nextQ.park_mode = "";
          changed = true;
        }
      }
    }

    return changed ? buildHash(path, nextQ) : "";
  }

  function geoCarrierName(v) {
    if (v === "factory") return "厂房";
    return "楼宇";
  }

  function geoContext(rt, path) {
    var geo = geoData();
    var level = geoLevelByPath(path);
    var districts = govDemoDistrictLockEnabled(path) ? govDemoGeoItems(geo.districts || []) : geo.districts.slice();
    var did = (rt.q && rt.q.did) || "";
    var district = did ? geoDistrictById(did) : null;
    if (district) did = district.id;

    var streets = geo.streets.slice();
    var streetsInDistrict = streets.filter(function (s) {
      return !did || s.district_id === did;
    });
    var sid = (rt.q && rt.q.sid) || "";
    var street = sid
      ? (streetsInDistrict.find(function (s) { return s.id === sid; }) || null)
      : null;
    sid = street ? street.id : "";

    var parks = geo.parks.slice();
    var parksInDistrict = parks.filter(function (p) {
      return !did || p.district_id === did;
    });
    var pid = (rt.q && rt.q.pid) || "";
    var park = pid
      ? (parksInDistrict.find(function (p) { return p.id === pid; }) || null)
      : null;
    pid = park ? park.id : "";

    var metric = geoNormalizeMetricId((rt.q && rt.q.metric) || "");
    var market = (rt.q && rt.q.market) || "";
    if (market && ["all", "leader", "four_up", "high_growth"].indexOf(market) < 0) market = "";
    var inds = listFromCsv(rt.q && rt.q.inds)
      .map(function (it) {
        return geoNormalizeIndustryCategory(it);
      })
      .filter(function (it, idx, arr) {
        return !!it && arr.indexOf(it) === idx;
      })
      .slice(0, 1);
    var chainCity = (rt.q && rt.q.chain_city) || "qingyang";
    var chain = (rt.q && rt.q.chain) || geoChainList(chainCity)[0];
    var showProject = (rt.q && rt.q.proj) !== "0";
    var showParkSkin = (rt.q && rt.q.park_skin) !== "0";
    var showParkPoi = (rt.q && rt.q.park_poi) !== "0";
    var autoZoomCfg = geoAutoCfgFromQuery(rt.q || {});
    var carrierRaw = listFromCsv(rt.q && rt.q.carrier);
    var carrier;
    if ((rt.q && rt.q.carrier) === "none") carrier = [];
    else if (!carrierRaw.length) carrier = ["building"];
    else {
      carrier = carrierRaw.filter(function (x) {
        return x === "building" || x === "factory";
      });
    }
    var scope = (rt.q && rt.q.scope) || (level === "district" ? "district" : "street");
    if (path === "/gov/geo-park") scope = "park";
    if (level === "district") scope = "district";
    if (level !== "district" && scope === "district") scope = "street";
    if (scope === "park" && !parksInDistrict.length) scope = "street";

    if (scope === "park" && park && !((rt.q && rt.q.sid) || "").trim()) {
      sid = park.street_id || sid;
      street = geoStreetById(sid) || street;
    }

    var buildings = geo.buildings.slice();
    var buildingsInStreet = sid
      ? buildings.filter(function (b) {
        return b.street_id === sid;
      })
      : [];
    var buildingsInPark = pid
      ? buildings.filter(function (b) {
        return b.park_id === pid;
      })
      : [];
    var buildingsInScope = scope === "park"
      ? (buildingsInPark.length ? buildingsInPark : buildings.filter(function (b) {
          return parksInDistrict.some(function (p) { return p.id === b.park_id; });
        }))
      : (buildingsInStreet.length ? buildingsInStreet : buildings.filter(function (b) {
          var st = geoStreetById(b.street_id);
          return !!st && st.district_id === did;
        }));
    var parkMode = (rt.q && rt.q.park_mode) === "all" ? "all" : "focus";
    var areasInDistrict =
      scope === "park"
        ? parkMode === "all"
          ? parksInDistrict
          : [park].filter(Boolean)
        : streetsInDistrict;
    var area = scope === "park" ? park : street;
    var q = ((rt.q && rt.q.q) || "").trim();
    var bottomExpanded = (rt.q && rt.q.bottom) === "1";

    return {
      path: path,
      level: level,
      geo: geo,
      realCity: geo.real_city || null,
      realDistrictBackdrop: geo.real_district_backdrop || [],
      did: did,
      district: district,
      sid: sid,
      street: street,
      pid: pid,
      park: park,
      districts: districts,
      streets: streets,
      streetsInDistrict: streetsInDistrict,
      parks: parks,
      parksInDistrict: parksInDistrict,
      areasInDistrict: areasInDistrict,
      area: area,
      buildings: buildings,
      buildingsInStreet: buildingsInStreet,
      buildingsInPark: buildingsInPark,
      buildingsInScope: buildingsInScope,
      metric: metric,
      market: market,
      inds: inds,
      chainCity: chainCity,
      chain: chain,
      showProject: showProject,
      showParkSkin: showParkSkin,
      showParkPoi: showParkPoi,
      autoZoom: autoZoomCfg.enabled,
      autoZoomCfg: autoZoomCfg,
      carrier: carrier,
      scope: scope,
      parkMode: parkMode,
      showOnlineTiles: (rt.q && rt.q.omt) !== "0",
      onlineTileProvider: (rt.q && rt.q.omt_p) || geoDefaultOnlineProvider(),
      metricOverlay: [],
      q: q,
      bottomExpanded: bottomExpanded,
    };
  }

  function geoSystemName(ctx) {
    var areaName = ctx.scope === "park"
      ? ctx.parkMode === "all"
        ? ((ctx.district && ctx.district.name) || "区") + " · 区（市）县级"
        : ((ctx.park && ctx.park.name) || "园区")
      : ((ctx.street && ctx.street.name) || "街道");
    areaName = geoShortName(areaName, 14);
    if (ctx.level === "building") return "区域经济研判";
    if (ctx.level === "street") return "区域经济研判";
    return "区域经济研判";
  }

  function geoTabs(ctx) {
    var tabs = [
      { label: "区级视图", path: "/gov/geo-district", q: geoStickyQuery(ctx, { scope: "district", sid: "", pid: "", park_mode: "" }) },
      { label: "街道视图", path: "/gov/geo-street", q: geoStickyQuery(ctx, { scope: "street", sid: "", pid: "", park_mode: "" }) },
      { label: "园区视图", path: "/gov/geo-park", q: geoStickyQuery(ctx, { scope: "park", sid: "", pid: "", park_mode: "all" }) },
    ];
    return tabs
      .map(function (t) {
        var cls = t.path === ctx.path ? "active" : "";
        return '<a class="geo-tab ' + cls + '" href="' + buildHash(t.path, t.q) + '">' + esc(t.label) + "</a>";
      })
      .join("");
  }


  /* ── geo helper functions (restored) ── */

  function geoNormalizeIndustryCategory(cat) {
    var s = String(cat || "").trim();
    if (!s) return "";
    var map = {
      "智能制造": "制造业", "制造": "制造业", "装备": "制造业",
      "生物医药": "制造业", "医药": "制造业", "医疗": "卫生和社会工作",
      "创新服务": "科学研究和技术服务业", "服务": "租赁和商务服务业", "科技服务": "科学研究和技术服务业",
      "现代商贸": "批发和零售业", "商贸": "批发和零售业", "商务": "租赁和商务服务业",
      "金融": "金融业", "文旅": "文化、体育和娱乐业", "航空航天": "制造业", "航空": "制造业",
      "数字服务": "信息传输、软件和信息技术服务业", "数字": "信息传输、软件和信息技术服务业",
    };
    if (map[s]) return map[s];
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) {
      if (s.indexOf(keys[i]) >= 0 || keys[i].indexOf(s) >= 0) return map[keys[i]];
    }
    return s;
  }

  function geoIndustryTaxonomy() {
    var chains = geoChainList("qingyang");
    var cats = [
      "农、林、牧、渔业",
      "采矿业",
      "制造业",
      "电力、热力、燃气及水生产和供应业",
      "建筑业",
      "批发和零售业",
      "交通运输、仓储和邮政业",
      "住宿和餐饮业",
      "信息传输、软件和信息技术服务业",
      "金融业",
      "房地产业",
      "租赁和商务服务业",
      "科学研究和技术服务业",
      "水利、环境和公共设施管理业",
      "居民服务、修理和其他服务业",
      "教育",
      "卫生和社会工作",
      "文化、体育和娱乐业",
      "公共管理、社会保障和社会组织",
    ];
    return {
      chains: chains,
      categories: cats,
      map: cats.reduce(function (acc, c) { acc[c] = c; return acc; }, {}),
    };
  }

  function geoFilteredEnterprises(ctx) {
    geoData();
    if (!ctx.market) return [];
    var all = (seed.enterprises || []).filter(isRealEnterprise);
    var market = ctx.market;
    var inds = ctx.inds || [];
    return all.filter(function (e) {
      if (ctx.scope === "park" && ctx.parkMode !== "all" && ctx.pid) {
        if (e.park_id !== ctx.pid) return false;
      } else if ((ctx.level === "street" || ctx.level === "building") && ctx.sid) {
        if (e.street_id !== ctx.sid) return false;
      } else if (ctx.did) {
        if (e.district_id !== ctx.did) return false;
      }
      if (market === "leader") {
        var tags = e.tags || [];
        var isLeader = tags.some(function (tag) {
          var txt = String(tag || "");
          return txt.indexOf("链") >= 0 || txt.indexOf("关键") >= 0 || txt.indexOf("龙头") >= 0;
        });
        if (!isLeader) return false;
      }
      if (market === "four_up" && e.level !== "规上" && !(e.tags && e.tags.indexOf("专精特新") >= 0)) return false;
      if (market === "high_growth" && !(e.tags && (e.tags.indexOf("高新技术") >= 0 || e.tags.indexOf("高成长型") >= 0 || e.tags.indexOf("专精特新") >= 0))) return false;
      if (inds.length) {
        var norm = geoNormalizeIndustryCategory(e.industry);
        if (inds.indexOf(norm) < 0) return false;
      }
      return true;
    });
  }

  function geoMarketLabel(market) {
    if (!market) return "未选择";
    if (market === "leader") return "产业链链主";
    if (market === "four_up") return "四上企业";
    if (market === "high_growth") return "高成长型企业";
    return "重点企业";
  }

  function geoEnterpriseMarkerGlyph(markerType) {
    if (markerType === "core") return "企";
    return "企";
  }

  function geoMarkerSvg(kind) {
    if (kind === "enterprise") {
      // 企业：写字楼 — 填充式
      return '<svg class="geo-marker-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V6l8-4 8 4v15H4z" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.95)" stroke-width="1.2"/><rect x="7" y="9" width="3" height="3" rx=".5" fill="rgba(255,255,255,0.85)" stroke="none"/><rect x="14" y="9" width="3" height="3" rx=".5" fill="rgba(255,255,255,0.85)" stroke="none"/><rect x="7" y="14" width="3" height="3" rx=".5" fill="rgba(255,255,255,0.85)" stroke="none"/><rect x="14" y="14" width="3" height="3" rx=".5" fill="rgba(255,255,255,0.85)" stroke="none"/><rect x="10" y="18" width="4" height="3" rx=".4" fill="rgba(255,255,255,0.9)" stroke="none"/></svg>';
    }
    if (kind === "park") {
      // 园区：产业园/科技园 — 多栋建筑群
      return '<svg class="geo-marker-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="10" width="7" height="11" rx=".8" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.95)" stroke-width="1.2"/><rect x="8.5" y="5" width="7" height="16" rx=".8" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.95)" stroke-width="1.2"/><rect x="15" y="8" width="7" height="13" rx=".8" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.95)" stroke-width="1.2"/><rect x="3.5" y="12.5" width="2" height="1.5" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="3.5" y="15.5" width="2" height="1.5" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="10" y="7.5" width="2.2" height="1.8" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="13" y="7.5" width="2.2" height="1.8" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="10" y="11" width="2.2" height="1.8" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="13" y="11" width="2.2" height="1.8" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="16.5" y="10.5" width="2" height="1.5" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="16.5" y="13.5" width="2" height="1.5" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/></svg>';
    }
    if (kind === "project") {
      // 项目：文件/公文 — 政务风
      return '<svg class="geo-marker-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6V3z" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.95)" stroke-width="1.2"/><path d="M14 3v4h4" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1"/><rect x="8.5" y="10" width="7" height="1.2" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="8.5" y="13" width="5" height="1.2" rx=".3" fill="rgba(255,255,255,0.7)" stroke="none"/><rect x="8.5" y="16" width="6" height="1.2" rx=".3" fill="rgba(255,255,255,0.6)" stroke="none"/></svg>';
    }
    if (kind === "carrier") {
      // 载体：商务楼宇
      return '<svg class="geo-marker-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="17" rx="1" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.95)" stroke-width="1.2"/><rect x="6.5" y="6.5" width="3" height="2.5" rx=".4" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="14.5" y="6.5" width="3" height="2.5" rx=".4" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="6.5" y="11" width="3" height="2.5" rx=".4" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="14.5" y="11" width="3" height="2.5" rx=".4" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="10" y="16" width="4" height="5" rx=".4" fill="rgba(255,255,255,0.9)" stroke="none"/></svg>';
    }
    if (kind === "factory") {
      // 工厂/制造业
      return '<svg class="geo-marker-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21V11l5-3v3l5-3v3l5-3v3l5-3v10H2z" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.95)" stroke-width="1.2"/><rect x="4" y="14" width="2.5" height="2" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="9" y="14" width="2.5" height="2" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="14" y="14" width="2.5" height="2" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/><rect x="19" y="14" width="2.5" height="2" rx=".3" fill="rgba(255,255,255,0.8)" stroke="none"/></svg>';
    }
    if (kind === "heat-revenue") {
      // 营收 — 柱状图
      return '<svg class="geo-marker-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="14" width="4" height="7" rx=".6" fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.9)" stroke-width=".8"/><rect x="10" y="9" width="4" height="12" rx=".6" fill="rgba(255,255,255,0.8)" stroke="rgba(255,255,255,0.9)" stroke-width=".8"/><rect x="16" y="4" width="4" height="17" rx=".6" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.95)" stroke-width=".8"/></svg>';
    }
    if (kind === "heat-output") {
      // 产值 — 趋势线
      return '<svg class="geo-marker-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l5-4 4 2 9-8" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 7h3v3" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (kind === "heat-tax") {
      // 税收 — 盾牌
      return '<svg class="geo-marker-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3L4 7v5c0 4.5 3.4 8.4 8 10 4.6-1.6 8-5.5 8-10V7L12 3z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.95)" stroke-width="1.2"/><path d="M9 12h6" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linecap="round"/><path d="M12 9v6" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linecap="round"/></svg>';
    }
    return '<svg class="geo-marker-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.95)" stroke-width="1.2"/></svg>';
  }

  function geoMetricVisual(metricId) {
    var activeMetric = geoNormalizeMetricId(metricId);
    var map = {
      none: { id: "none", label: "未选择", color: "#60758c", gradient: ["#eef3f7", "#c5d1de", "#8398ad"] },
      revenue: { id: "revenue", label: "营收", color: "#d9482f", gradient: ["#ffd8c8", "#ff8b61", "#e6452f"] },
      output: { id: "output", label: "产值", color: "#1769e0", gradient: ["#d7ebff", "#67b3ff", "#1474f5"] },
      tax: { id: "tax", label: "税收", color: "#b87900", gradient: ["#fff1c2", "#ffcf4d", "#e7a100"] },
    };
    return activeMetric ? map[activeMetric] : map.none;
  }

  function geoMetricGlyph(metricId) {
    if (metricId === "output") return "产";
    if (metricId === "tax") return "税";
    return "营";
  }

  function geoIsParkFocus(ctx) {
    return ctx.scope === "park" && ctx.parkMode !== "all";
  }

  function geoScopedParkItems(ctx) {
    if (ctx.parkMode === "all") return ctx.parksInDistrict.slice();
    return ctx.park ? [ctx.park] : [];
  }

  function geoInsightModel(ctx) {
    var enterprises = geoFilteredEnterprises(ctx);
    var areaName = ctx.level === "district"
      ? ((ctx.district && ctx.district.name) || "全区")
      : ctx.scope === "park"
        ? ((ctx.park && ctx.park.name) || "园区")
        : ((ctx.street && ctx.street.name) || "街道");
    var focusIndustry = (ctx.inds && ctx.inds[0]) || "全行业";
    var metricSelected = !!geoNormalizeMetricId(ctx.metric);
    var metricLabel = aiMetricName(ctx.metric);
    var marketCount = enterprises.length;
    var parkCount = ctx.parksInDistrict ? ctx.parksInDistrict.length : 0;
    var carrierCount = ctx.buildingsInScope ? ctx.buildingsInScope.length : 0;
    var evidence = [
      areaName + "范围内共有 " + marketCount + " 家市场主体",
      "重点园区 " + parkCount + " 个，载体 " + carrierCount + " 处",
      metricSelected
        ? "当前聚焦" + metricLabel + "维度进行热力分析"
        : "当前未选择经济指标热力图，可在左侧切换营收、产值或税收。",
    ];
    return {
      focusName: areaName,
      focusMetric: metricSelected ? metricLabel : "未选择",
      focusIndustry: focusIndustry,
      marketCount: marketCount,
      parkCount: parkCount,
      carrierCount: carrierCount,
      summary: areaName + "范围内共 " + marketCount + " 家市场主体，重点园区 " + parkCount + " 个，载体 " + carrierCount + " 处。",
      caliber: "按注册地口径统计，含" + geoMarketLabel(ctx.market),
      evidence: evidence,
      actions: metricSelected
        ? [
            "建议重点关注" + metricLabel + "排名前列的区域",
            "可点击载体图标查看入驻率与楼宇详情",
            "结合招商线索优化产业布局",
          ]
        : [
            "先选择营收、产值或税收中的一个主指标",
            "再结合园区、街道和载体层级查看区域差异",
            "结合招商线索优化产业布局",
          ],
      sources: [
        "企业工商注册数据（演示）",
        "统计年鉴与公报数据（演示）",
        "园区与载体运营数据（演示）",
      ],
    };
  }

  function geoSummaryHeadCells(ctx) {
    if (ctx.level === "district") return ["#", "区（市）县", "热度", "企业总数", "重点企业", "产值(亿)", "税收(亿)", "主导产业"];
    if (ctx.level === "building") return ["#", "载体名称", "主导产业", "面积(㎡)", "入驻企业", "入驻率", "产值(亿)", "税收(亿)"];
    return ["#", "街道/园区", "热度", "企业总数", "重点企业", "土地产出效率", "招商线索", "产业方向"];
  }

  function geoAnalysisHash(ctx) {
    var q = {};
    if (ctx.did) q.did = ctx.did;
    if (ctx.sid) q.sid = ctx.sid;
    if (ctx.pid) q.pid = ctx.pid;
    if (ctx.metric) q.metric = ctx.metric;
    if (ctx.market) q.market = ctx.market;
    if (ctx.scope && ctx.scope !== "district") q.scope = ctx.scope;
    return buildHash("/gov/ai-analysis", q);
  }

  function aiTopItemLines(ctx, count) {
    var items = ctx.areasInDistrict || [];
    var metric = geoNormalizeMetricId(ctx.metric) || "revenue";
    var sorted = items.slice().sort(function (a, b) {
      return geoMetricValue(b, ctx.level, metric) - geoMetricValue(a, ctx.level, metric);
    });
    return sorted.slice(0, count || 2).map(function (it) { return it.name || "未知"; });
  }

  function aiBottomItemLines(ctx, count) {
    var items = ctx.areasInDistrict || [];
    var metric = geoNormalizeMetricId(ctx.metric) || "revenue";
    var sorted = items.slice().sort(function (a, b) {
      return geoMetricValue(a, ctx.level, metric) - geoMetricValue(b, ctx.level, metric);
    });
    return sorted.slice(0, count || 1).map(function (it) { return it.name || "未知"; });
  }

  function aiSceneScopeText(ctx) {
    if (ctx.scope === "park") return "园区聚焦模式";
    if (ctx.level === "district") return "区（市）县级总览";
    if (ctx.level === "building") return "载体（楼宇）级视角";
    return "街道级经济分析";
  }

  /* ── icon helper ── */
  var _uiIconMap = {
    geo: '<path d="M3.5 5.5l5-2 5 2 5-2v15l-5 2-5-2-5 2z"></path><path d="M8.5 3.8v15.4"></path><path d="M13.5 5.8v15.4"></path>',
    home: '<path d="M3 10.5l9-7 9 7"></path><path d="M5.5 9.5v9h13v-9"></path><path d="M10 18.5v-5h4v5"></path>',
    chain: '<circle cx="5" cy="12" r="2.2"></circle><circle cx="12" cy="6" r="2.2"></circle><circle cx="19" cy="12" r="2.2"></circle><circle cx="12" cy="18" r="2.2"></circle><path d="M6.9 10.9l3.2-3.1"></path><path d="M13.9 7.1l3.2 3.1"></path><path d="M17.1 13.1l-3.2 3.1"></path><path d="M10.1 16.9l-3.2-3.1"></path>',
    ai: '<path d="M8 7.5V6a4 4 0 118 0v1.5"></path><rect x="6" y="7.5" width="12" height="9" rx="3"></rect><path d="M9 11h.01"></path><path d="M15 11h.01"></path><path d="M9.5 14c1.4 1 3.6 1 5 0"></path><path d="M12 3v-1.5"></path>',
    "switch": '<path d="M7 7h11"></path><path d="M15 4l3 3-3 3"></path><path d="M17 17H6"></path><path d="M9 14l-3 3 3 3"></path>',
    help: '<circle cx="12" cy="12" r="9"></circle><path d="M9.6 9.3a2.8 2.8 0 115 1.7c-.9.7-1.6 1.2-1.6 2.5"></path><path d="M12 16.7h.01"></path>',
    search: '<circle cx="11" cy="11" r="6.5"></circle><path d="M16.2 16.2L20 20"></path>',
    enterprise: '<rect x="5" y="3.5" width="10" height="17" rx="1.8"></rect><path d="M15 8.5h4V20.5h-4"></path><path d="M8 7.5h.01"></path><path d="M11 7.5h.01"></path><path d="M8 10.5h.01"></path><path d="M11 10.5h.01"></path><path d="M8 13.5h.01"></path><path d="M11 13.5h.01"></path><path d="M9.5 20.5v-3h2v3"></path>',
    dashboard: '<rect x="4" y="4" width="7" height="7" rx="1.4"></rect><rect x="13" y="4" width="7" height="5" rx="1.4"></rect><rect x="13" y="11" width="7" height="9" rx="1.4"></rect><rect x="4" y="13" width="7" height="7" rx="1.4"></rect>',
    back: '<path d="M10 5l-6 7 6 7"></path><path d="M4.5 12H20"></path>',
    alert: '<path d="M12 4l8 14H4l8-14z"></path><path d="M12 9v4.5"></path><path d="M12 16.8h.01"></path>',
    park: '<path d="M4 18.5h16"></path><path d="M6 18.5v-6.5h12v6.5"></path><path d="M9 12V8.5h6V12"></path><path d="M12 8.5V5"></path><path d="M8.5 18.5v-3"></path><path d="M12 18.5v-3"></path><path d="M15.5 18.5v-3"></path>',
    bank: '<path d="M3.5 9h17"></path><path d="M5.5 9v8.5"></path><path d="M9.5 9v8.5"></path><path d="M14.5 9v8.5"></path><path d="M18.5 9v8.5"></path><path d="M3 18.5h18"></path><path d="M12 4l9 4H3l9-4z"></path>',
    gov: '<path d="M3 8.5h18"></path><path d="M5.5 8.5v8"></path><path d="M9.5 8.5v8"></path><path d="M14.5 8.5v8"></path><path d="M18.5 8.5v8"></path><path d="M3 17.5h18"></path><path d="M12 3l9 4.5H3L12 3z"></path>',
    policy: '<path d="M7 3.5h7l4 4v13H7z"></path><path d="M14 3.5v4h4"></path><path d="M10 11h6"></path><path d="M10 14h6"></path><path d="M10 17h4"></path>',
    invest: '<circle cx="12" cy="12" r="7.5"></circle><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2.5v2"></path><path d="M21.5 12h-2"></path><path d="M12 21.5v-2"></path><path d="M2.5 12h2"></path><path d="M16.5 7.5l2-2"></path>',
    report: '<path d="M6 4.5h12v15H6z"></path><path d="M9 9.5h6"></path><path d="M9 13h6"></path><path d="M9 16.5h4"></path><path d="M18 6.5l2-2"></path>',
    project: '<rect x="5" y="4.5" width="14" height="15" rx="2"></rect><path d="M9 4.5V3h6v1.5"></path><path d="M9 10h6"></path><path d="M9 13h6"></path><path d="M9 16h4"></path>',
    decision: '<path d="M6 5.5h12v13H6z"></path><path d="M8.5 9h7"></path><path d="M8.5 12h7"></path><path d="M8.5 15h4.5"></path><path d="M4 8.5h2"></path><path d="M4 12h2"></path><path d="M4 15.5h2"></path>',
    meeting: '<rect x="4.5" y="6" width="15" height="13" rx="2"></rect><path d="M8 3.5v4"></path><path d="M16 3.5v4"></path><path d="M4.5 10h15"></path><path d="M8 13h3"></path><path d="M13 13h3"></path><path d="M8 16h3"></path>',
    settings: '<path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path><circle cx="8" cy="7" r="1.5"></circle><circle cx="16" cy="12" r="1.5"></circle><circle cx="10" cy="17" r="1.5"></circle>',
    portrait: '<circle cx="8" cy="6" r="3.5"></circle><path d="M2 20v-1.5a5 5 0 015-5h2"></path><rect x="14" y="13" width="2.5" height="7" rx=".5"></rect><rect x="18" y="9" width="2.5" height="11" rx=".5"></rect>',
    lock: '<rect x="5.5" y="11" width="13" height="9" rx="2"></rect><path d="M8.5 11V7a3.5 3.5 0 017 0v4"></path><circle cx="12" cy="15.5" r="1"></circle>'
  };
  function uiIcon(name, cls) {
    var icon = _uiIconMap[name];
    if (icon) {
      return '<span class="ui-icon ' + (cls || "") + '" aria-hidden="true"><svg viewBox="0 0 24 24">' + icon + "</svg></span>";
    }
    return '<span class="ui-icon ' + (cls || "") + '" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"></circle><path d="M12 8.5v7"></path><path d="M12 16.8h.01"></path></svg></span>';
  }

  /* ── collapsible section wrapper ── */
  function geoPanelSection(title, content, opts) {
    var o = opts || {};
    return (
      '<details class="geo-section geo-section-collapsible"' +
      (o.open ? " open" : "") + ">" +
      '<summary class="geo-section-summary">' +
      '<span class="geo-section-summary-title">' + esc(title) + "</span>" +
      '<span class="geo-section-summary-meta">' + esc(o.meta || "") + "</span>" +
      '<span class="geo-section-summary-arrow"></span>' +
      "</summary>" +
      '<div class="geo-section-body">' + content + "</div>" +
      "</details>"
    );
  }

  /* ── metric display name ── */
  function aiMetricName(metric) {
    var metricId = geoNormalizeMetricId(metric);
    if (!metricId) return "未选择";
    if (metricId === "output") return "产值";
    if (metricId === "tax") return "税收";
    return "营收";
  }

  function geoPanel(ctx) {
    var industryTaxonomy = geoIndustryTaxonomy();
    var enterpriseMatches = geoFilteredEnterprises(ctx);
    var districtOpts = '<option value=""' + (!ctx.did ? ' selected' : '') + '>全部区（市）县</option>' +
      ctx.districts
      .map(function (d) {
        var sel = d.id === ctx.did ? "selected" : "";
        return '<option value="' + esc(d.id) + '" ' + sel + ">" + esc(d.name) + "</option>";
      })
      .join("");
    var streetOpts = '<option value=""' + (!ctx.sid ? ' selected' : '') + '>全部街道</option>' +
      ctx.streetsInDistrict
      .map(function (s) {
        var sel = s.id === ctx.sid ? "selected" : "";
        return '<option value="' + esc(s.id) + '" ' + sel + ">" + esc(s.name) + "</option>";
      })
      .join("");
    var parkOpts = '<option value=""' + (!ctx.pid ? ' selected' : '') + '>全部园区</option>' +
      ctx.parksInDistrict
      .map(function (p) {
        var sel = p.id === ctx.pid ? "selected" : "";
        return '<option value="' + esc(p.id) + '" ' + sel + ">" + esc(p.name) + "</option>";
      })
      .join("");
    var parkCtrlDisabled = ctx.scope === "park" ? "" : "disabled";
    var chainOpts = geoChainList(ctx.chainCity)
      .map(function (c) {
        var sel = c === ctx.chain ? "selected" : "";
        return '<option value="' + esc(c) + '" ' + sel + ">" + esc(c) + "</option>";
      })
      .join("");
    var autoCfg = ctx.autoZoomCfg || geoAutoCfgFromQuery({});
    var autoCtrlDisabled = ctx.autoZoom ? "" : "disabled";
    var onlineMapMode = ctx.showOnlineTiles ? ctx.onlineTileProvider : "off";
    var onlineProvider = geoTileProviderByKey(ctx.onlineTileProvider || geoDefaultOnlineProvider());
    var onlineProviderToken = geoTileProviderToken(onlineProvider.key);
    var onlineAmapJsCode = geoAmapSecurityJsCode();
    var onlineProviderOptionsHtml = geoTileProviderList()
      .map(function (provider) {
        var selected = onlineMapMode === provider.key ? "selected" : "";
        var suffix = provider.requiresToken ? "（需 Key）" : "";
        return '<option value="' + esc(provider.key) + '" ' + selected + ">" + esc(provider.name + suffix) + "</option>";
      })
      .join("");
    var industrySelectHtml = (industryTaxonomy.categories || [])
      .map(function (cat) {
        var selected = ctx.inds[0] === cat ? "selected" : "";
        return '<option value="' + esc(cat) + '" ' + selected + ">" + esc(cat) + "</option>";
      })
      .join("");
    var enterpriseResultHtml = !ctx.market
      ? '<div class="geo-empty-note">请先选择企业类型。</div>'
      : enterpriseMatches.length
      ? '<div class="geo-filter-preview"><div class="geo-filter-preview-head"><b>' +
        esc(geoMarketLabel(ctx.market)) +
        '</b><span>加载 ' +
        esc(enterpriseMatches.length) +
        ' 项</span></div><div class="geo-filter-preview-list">' +
        enterpriseMatches
          .slice(0, 4)
          .map(function (e) {
            return (
              '<button class="geo-result-chip" data-action="geo_open_enterprise" data-id="' +
              esc(e.id) +
              '">' +
              esc(geoShortName(e.name, 12)) +
              '<span>' +
              esc((e.industry || "-") + " / " + (e.level || "-")) +
              "</span></button>"
            );
          })
          .join("") +
        "</div></div>"
      : '<div class="geo-empty-note">当前筛选条件下无匹配企业。</div>';
    var metricDefs = [
      { id: "revenue", label: "营收热力图" },
      { id: "output", label: "产值热力图" },
      { id: "tax", label: "税收热力图" },
    ];
    var marketSelectHtml = [
      { id: "", label: "未选择" },
      { id: "all", label: "重点企业" },
      { id: "leader", label: "产业链链主" },
      { id: "four_up", label: "四上企业" },
      { id: "high_growth", label: "高成长型企业" },
    ]
      .map(function (item) {
        var selected = ctx.market === item.id ? "selected" : "";
        return '<option value="' + esc(item.id) + '" ' + selected + ">" + esc(item.label) + "</option>";
      })
      .join("");
    var parkFocusValue = ctx.scope === "park" ? (ctx.parkMode === "all" ? "all" : (ctx.pid || "")) : "";
    var parkFocusHtml =
      '<option value="" ' +
      (!parkFocusValue ? "selected" : "") +
      '>未限定</option>' +
      '<option value="all" ' +
      (parkFocusValue === "all" ? "selected" : "") +
      '>全区园区数据</option>' +
      ctx.parksInDistrict
        .map(function (p) {
          var selected = parkFocusValue === p.id ? "selected" : "";
          return '<option value="' + esc(p.id) + '" ' + selected + ">" + esc(p.name) + "</option>";
        })
        .join("");
    var metricSelectHtml =
      '<option value="" ' + (!ctx.metric ? "selected" : "") + '>未选择</option>' +
      metricDefs
        .map(function (item) {
          var selected = ctx.metric === item.id ? "selected" : "";
          return '<option value="' + esc(item.id) + '" ' + selected + ">" + esc(item.label) + "</option>";
        })
        .join("");
    var metricOverlayCandidates = metricDefs.filter(function (m) {
      return m.id !== ctx.metric;
    });
    var metricOverlayLabel = !ctx.metric
      ? "请先选择主指标"
      : ctx.metricOverlay.length
        ? ctx.metricOverlay
            .map(function (m) {
              return geoMetricVisual(m).label;
            })
            .join(" / ")
        : "未叠加";
    var metricOverlayValue = !ctx.metric
      ? "none"
      : ctx.metricOverlay.length === 0
        ? "none"
        : ctx.metricOverlay.length >= metricOverlayCandidates.length
          ? "all"
          : ctx.metricOverlay[0];
    var metricOverlaySelectHtml = !ctx.metric
      ? '<option value="none" selected>请先选择主指标</option>'
      : '<option value="none" ' +
        (metricOverlayValue === "none" ? "selected" : "") +
        '>未叠加</option>' +
        metricOverlayCandidates
          .map(function (m) {
            var selected = metricOverlayValue === m.id ? "selected" : "";
            return '<option value="' + esc(m.id) + '" ' + selected + ">按照" + esc(geoMetricVisual(m.id).label) + "</option>";
          })
          .join("") +
        (metricOverlayCandidates.length > 1
          ? '<option value="all" ' + (metricOverlayValue === "all" ? "selected" : "") + ">叠加全部子指标</option>"
          : "");
    var projectSelectValue = ctx.showProject ? "1" : "0";
    var carrierSelectValue =
      ctx.carrier.indexOf("building") >= 0 && ctx.carrier.indexOf("factory") >= 0
        ? "all"
        : ctx.carrier.indexOf("building") >= 0
          ? "building"
          : ctx.carrier.indexOf("factory") >= 0
            ? "factory"
            : "none";
    var parkVisualValue = ctx.showParkSkin && ctx.showParkPoi
      ? "both"
      : ctx.showParkSkin
        ? "skin"
        : ctx.showParkPoi
          ? "poi"
          : "base";
    var onlineTokenFieldHtml = onlineMapMode !== "off" && onlineProvider.requiresToken
      ? '<div class="geo-row"><span class="geo-field-label">' +
        esc(onlineProvider.tokenLabel || "密钥") +
        '</span><input data-role="geo-online-token" data-provider="' +
        esc(onlineProvider.key) +
        '" type="text" placeholder="' +
        esc(onlineProvider.tokenPlaceholder || "粘贴您的密钥") +
        '" value="' +
        esc(onlineProviderToken) +
        '" autocomplete="off" /></div>'
        + (onlineProvider.key === "amap_native"
          ? '<div class="geo-row"><span class="geo-field-label">高德安全密钥</span><input data-role="geo-online-jscode" data-provider="amap_native_jscode" type="text" placeholder="粘贴安全密钥 jscode" value="' +
            esc(onlineAmapJsCode) +
            '" autocomplete="off" /></div><div class="geo-mini-note">高德新建 Web 端 Key 通常还需要同时填写安全密钥（jscode）。</div>'
          : "")
      : "";
    var utilityPanelInnerHtml =
      '<section class="geo-section geo-section-tool"><div class="geo-tool-title"><span class="geo-tool-badge">工具</span><h3>在线地图</h3></div>' +
      '<div class="geo-row"><span class="geo-field-label">地图模式</span><select data-role="geo-online-map-mode"><option value="off" ' +
      (onlineMapMode === "off" ? "selected" : "") +
      ">关闭</option>" +
      onlineProviderOptionsHtml +
      '</select></div>' +
      onlineTokenFieldHtml +
      "</section>";
    var marketMeta = geoMarketLabel(ctx.market);
    var metricMeta = ctx.metric ? geoMetricVisual(ctx.metric).label : "未选择";
    var chainMeta = ctx.chain || "重点产业链";
    var projectMeta = ctx.showProject ? "已展示" : "已隐藏";
    var carrierMeta = carrierSelectValue === "all"
      ? "楼宇 + 厂房"
      : carrierSelectValue === "building"
        ? "仅楼宇"
        : carrierSelectValue === "factory"
          ? "仅厂房"
          : "不展示";
    var scopeMeta = ctx.scope === "district"
      ? ((ctx.district && ctx.district.name) || "全区")
      : ctx.scope === "park"
        ? (ctx.parkMode === "all"
          ? ((ctx.district && ctx.district.name) || "区") + " · 全部园区"
          : ((ctx.park && ctx.park.name) || "园区"))
        : ((ctx.street && ctx.street.name) || "街道");
    var utilityMeta = onlineMapMode === "off"
      ? "在线地图已关闭"
      : ((onlineProvider && onlineProvider.name) || "在线地图");

    return (
      '<aside class="geo-panel">' +
      '<div class="geo-panel-scroll">' +
      geoPanelSection("市场主体热力图",
      '<div class="geo-sub-block"><div class="geo-sub-title">重点企业</div>' +
      '<div class="geo-row"><span class="geo-field-label">企业类型</span><select data-role="geo-market-select">' +
      marketSelectHtml +
      '</select></div>' +
      '<div class="geo-sub-title geo-sub-title-nested">行业筛选</div>' +
      '<div class="geo-row"><span class="geo-field-label">行业分类</span><select data-role="geo-industry-select"><option value="">全部行业</option>' +
      industrySelectHtml +
      "</select></div>" +
      enterpriseResultHtml +
      '</div><div class="geo-sub-block"><div class="geo-sub-title">重点园区</div>' +
      '<div class="geo-row"><span class="geo-field-label">园区范围</span><select data-role="geo-park-focus-select" ' +
      (ctx.parksInDistrict.length ? "" : "disabled") +
      ">" +
      parkFocusHtml +
      "</select></div>" +
      "</div>", { open: false, meta: marketMeta }) +

      geoPanelSection("经济指标热力图",
      '<div class="geo-row"><span class="geo-field-label">主指标</span><select data-role="geo-metric-select">' +
      metricSelectHtml +
      '</select></div>' +
      '<div class="geo-sub-title geo-sub-title-nested">子指标叠加</div>' +
      '<div class="geo-row"><span class="geo-field-label">叠加模式</span><select data-role="geo-metric-overlay-select" ' + (ctx.metric ? "" : "disabled") + '>' +
      metricOverlaySelectHtml +
      '</select></div><div class="geo-mini-note">当前：' +
      esc(metricOverlayLabel) +
      "</div>", { open: false, meta: metricMeta }) +

      geoPanelSection("重点产业链热力图",
      '<div class="geo-row"><span class="geo-field-label">集群城区</span><select data-role="geo-chain-city"><option value="qingyang" ' +
      (ctx.chainCity === "qingyang" ? "selected" : "") +
      '>（青羊）“4+9”</option><option value="wenjiang" ' +
      (ctx.chainCity === "wenjiang" ? "selected" : "") +
      '>（温江）“3+6”</option></select></div>' +
      '<div class="geo-row"><span class="geo-field-label">主导链条</span><select data-role="geo-chain">' +
      chainOpts +
      "</select></div>", { open: false, meta: chainMeta }) +

      geoPanelSection("重点项目热力图",
      '<div class="geo-row"><span class="geo-field-label">项目展示</span><select data-role="geo-project-select"><option value="1" ' +
      (projectSelectValue === "1" ? "selected" : "") +
      '>展示项目</option><option value="0" ' +
      (projectSelectValue === "0" ? "selected" : "") +
      '>隐藏项目</option></select></div>', { open: false, meta: projectMeta }) +

      geoPanelSection("产业载体",
      '<div class="geo-row"><span class="geo-field-label">载体类型</span><select data-role="geo-carrier-select"><option value="all" ' +
      (carrierSelectValue === "all" ? "selected" : "") +
      '>楼宇 + 厂房</option><option value="building" ' +
      (carrierSelectValue === "building" ? "selected" : "") +
      '>仅楼宇</option><option value="factory" ' +
      (carrierSelectValue === "factory" ? "selected" : "") +
      '>仅厂房</option><option value="none" ' +
      (carrierSelectValue === "none" ? "selected" : "") +
      '>不展示载体</option></select></div>', { open: false, meta: carrierMeta }) +

      geoPanelSection("区域与级别",
      '<div class="geo-row"><span class="geo-field-label">视图级别</span><select data-role="geo-scope-level"><option value="district" ' +
      (ctx.scope === "district" ? "selected" : "") +
      '>区本级</option><option value="street" ' +
      (ctx.scope === "street" ? "selected" : "") +
      '>街道级</option><option value="park" ' +
      (ctx.scope === "park" ? "selected" : "") +
      '>园区级</option></select></div>' +
      '<div class="geo-row"><span class="geo-field-label">所在区（县）</span><select data-role="geo-district-pick">' +
      districtOpts +
      '</select></div>' +
      (ctx.scope === "street" ? '<div class="geo-row"><span class="geo-field-label">街道</span><select data-role="geo-street-pick">' +
      (streetOpts || '<option value="">（无街道数据）</option>') +
      '</select></div>' : '') +
      (ctx.scope === "park" ? '<div class="geo-row"><span class="geo-field-label">园区</span><select data-role="geo-park-pick">' +
      (parkOpts || '<option value="">（无园区数据）</option>') +
      '</select></div>' : '') +
      '<div class="geo-row"><span class="geo-field-label">园区图层</span><select data-role="geo-park-visual" ' +
      parkCtrlDisabled +
      '><option value="base" ' +
      (parkVisualValue === "base" ? "selected" : "") +
      '>基础轮廓</option><option value="skin" ' +
      (parkVisualValue === "skin" ? "selected" : "") +
      '>园区蒙皮</option><option value="poi" ' +
      (parkVisualValue === "poi" ? "selected" : "") +
      '>园区 POI</option><option value="both" ' +
      (parkVisualValue === "both" ? "selected" : "") +
      '>蒙皮 + POI</option></select></div>', { open: false, meta: scopeMeta }) +
      geoPanelSection("辅助功能", utilityPanelInnerHtml, { open: false, meta: utilityMeta }) +
      "</div></aside>"
    );
  }

  function geoEntityPoints(ctx) {
    var pools = geoFilteredEnterprises(ctx);
    var points = [];
    var colorByIndustry = {
      "智能制造": "#3b82f6",
      "生物医药": "#10b981",
      "现代商贸": "#f59e0b",
      "创新服务": "#a855f7",
    };
    pools.forEach(function (e) {
      var baseNode =
        (e.building_id && geoBuildingById(e.building_id)) ||
        (e.park_id && geoParkById(e.park_id)) ||
        (e.street_id && geoStreetById(e.street_id)) ||
        (e.district_id && geoDistrictById(e.district_id)) ||
        ctx.street ||
        ctx.park ||
        geoDistrictById(ctx.did) ||
        { x: 50, y: 50 };
      var seedN = hashNumber(e.id);
      var hasRealBase = baseNode._realCenter;
      var spread = hasRealBase ? 0 : e.building_id ? 1.6 : e.park_id ? 2.6 : e.street_id ? 4.1 : 6.2;
      var x = Number(baseNode.x || 50) + jitter(seedN + 1, spread);
      var y = Number(baseNode.y || 50) + jitter(seedN + 2, spread);
      points.push({
        id: e.id,
        x: Math.max(3, Math.min(97, x)),
        y: Math.max(8, Math.min(92, y)),
        color: colorByIndustry[e.industry] || "#3b82f6",
        name: e.name,
        industry: e.industry || "",
        industryKey: e.industry === "智能制造" ? "mfg" : e.industry === "生物医药" ? "bio" : e.industry === "现代商贸" ? "biz" : e.industry === "创新服务" ? "srv" : "mfg",
        level: e.level || "",
        markerType: e.level === "规上" ? "core" : "general",
      });
    });
    return points;
  }

  function geoHeatNodes(ctx) {
    var metric = geoNormalizeMetricId(ctx.metric);
    if (!metric) return [];
    // Always show heat for ALL streets or parks in the district, not just the focused one
    // At district level, show heat blobs for ALL Chengdu districts (not just the locked one)
    var arr =
      ctx.level === "building"
        ? ctx.buildingsInScope
        : ctx.level === "street"
          ? ctx.scope === "park"
            ? ctx.parksInDistrict
            : ctx.streetsInDistrict
          : (ctx.geo && ctx.geo.districts ? ctx.geo.districts : ctx.districts);
    if (ctx.q) {
      arr = arr.filter(function (it) {
        return (it.name || "").indexOf(ctx.q) >= 0 || (it.cluster || "").indexOf(ctx.q) >= 0 || (it.lead_industry || "").indexOf(ctx.q) >= 0;
      });
    }
    var values = arr.map(function (it) {
      return geoMetricValue(it, ctx.level, metric);
    });
    var maxV = Math.max.apply(null, values.concat([1]));
    var minV = Math.min.apply(null, values.concat([0]));
    var nodes = arr.map(function (it, idx) {
      var raw = values[idx];
      var r = maxV === minV ? 0.7 : (raw - minV) / (maxV - minV);
      var size =
        ctx.level === "district"
          ? 30 + Math.round(r * 44)
          : ctx.level === "street"
            ? ctx.scope === "park"
              ? 18 + Math.round(r * 24)
              : 22 + Math.round(r * 28)
            : 16 + Math.round(r * 20);
      var alpha =
        ctx.level === "street" && ctx.scope === "park"
          ? 0.3 + r * 0.5
          : 0.35 + r * 0.5;
      var x = Number(it.x || 50);
      var y = Number(it.y || 50);
      return {
        id: it.id,
        name: it.name,
        x: x,
        y: y,
        size: size,
        alpha: alpha,
        ratio: r,
        value: raw,
        heat: it.heat || Math.round(75 + r * 25),
      };
    });
    return nodes;
  }

  function geoProjectNodes(ctx) {
    if (!ctx.showProject) return [];
    var base =
      ctx.level === "building"
        ? ctx.buildingsInScope
        : ctx.level === "street"
          ? ctx.areasInDistrict
          : ctx.districts;
    return base.slice(0, 6).map(function (it, idx) {
      return {
        id: "gp_" + it.id,
        name: (it.name || "示例区域") + " · 重点项目",
        x: Number(it.x || 50) + (idx % 2 === 0 ? 4 : -4),
        y: Number(it.y || 50) - 5,
      };
    });
  }

  function geoCarrierNodes(ctx) {
    if (!ctx.carrier.length) return [];
    var arr;
    if (ctx.level === "building") {
      arr = ctx.buildingsInScope.slice();
    } else if (ctx.level === "street" && ctx.scope === "park") {
      if (ctx.parkMode !== "all" && ctx.pid) {
        arr = ctx.buildings.filter(function (b) {
          return b.park_id === ctx.pid;
        });
      } else {
        var pids = ctx.parksInDistrict.map(function (p) {
          return p.id;
        });
        arr = ctx.buildings.filter(function (b) {
          return pids.indexOf(b.park_id) >= 0;
        });
      }
    } else if (ctx.level === "street") {
      arr = ctx.buildings.filter(function (b) {
        var s = geoStreetById(b.street_id);
        return !!s && s.district_id === ctx.did;
      });
    } else {
      arr = ctx.buildings.slice();
    }
    if (ctx.q) {
      arr = arr.filter(function (b) {
        return (b.name || "").indexOf(ctx.q) >= 0 || (b.lead_industry || "").indexOf(ctx.q) >= 0;
      });
    }
    return arr.slice(0, ctx.level === "building" ? 20 : 14).map(function (b, idx) {
      var s = geoStreetById(b.street_id) || {};
      var d = geoDistrictById(s.district_id) || {};
      var p = geoParkById(b.park_id) || {};
      var type = hashNumber(b.id) % 3 === 0 ? "factory" : "building";
      if (ctx.carrier.indexOf(type) < 0) return null;
      var bx = b.x == null ? Number(s.x || 50) : Number(b.x);
      var by = b.y == null ? Number(s.y || 50) : Number(b.y);
      var hasReal = b._realCenter;
      var cSpread = hasReal ? 0 : (ctx.level === "building" ? 2.4 : 6);
      return {
        id: b.id,
        name: b.name,
        x: clamp(bx + jitter(idx + hashNumber(b.id), cSpread), 3, 97),
        y: clamp(by + jitter(idx + hashNumber(b.id) + 3, cSpread), 8, 92),
        type: type,
        street_name: s.name || "",
        park_name: p.name || "",
        district_name: d.name || "",
        lead_industry: b.lead_industry || "",
        occupied_rate: b.occupied_rate,
        area_sqm: b.area_sqm,
      };
    }).filter(Boolean);
  }

  function geoSummaryRows(ctx) {
    if (ctx.level === "building") {
      var bs = ctx.buildingsInScope.slice();
      bs = bs.filter(function (b) {
        var tp = hashNumber(b.id) % 3 === 0 ? "factory" : "building";
        return ctx.carrier.indexOf(tp) >= 0;
      });
      if (ctx.q) {
        bs = bs.filter(function (b) {
          return (b.name || "").indexOf(ctx.q) >= 0 || (b.lead_industry || "").indexOf(ctx.q) >= 0;
        });
      }
      return bs
        .sort(function (a, b) {
          return Number(b.output_y || 0) - Number(a.output_y || 0);
        })
        .map(function (b, idx) {
          return (
            '<tr><td class="rank">' + (idx + 1) +
            "</td><td>" +
            esc(b.name) +
            '</td><td>' +
            esc(b.lead_industry || "-") +
            '</td><td class="num">' +
            esc(fmtNum(b.area_sqm || 0)) +
            '</td><td class="num">' +
            esc(b.enterprises || 0) +
            '</td><td class="num">' +
            esc(pct(b.occupied_rate, 1)) +
            '</td><td class="num">' +
            esc(fixed(b.output_y, 1)) +
            '</td><td class="num">' +
            esc(fixed(b.tax_y, 1)) +
            "</td></tr>"
          );
        })
        .join("");
    }
    if (ctx.level === "street") {
      var ss = ctx.areasInDistrict.slice();
      if (ctx.q) {
        ss = ss.filter(function (s) {
          return (s.name || "").indexOf(ctx.q) >= 0 || (s.cluster || "").indexOf(ctx.q) >= 0;
        });
      }
      return ss
        .sort(function (a, b) {
          return Number(b.heat || 0) - Number(a.heat || 0);
        })
        .map(function (s, idx) {
          return (
            '<tr><td class="rank">' + (idx + 1) +
            "</td><td>" +
            esc(s.name) +
            '</td><td class="num">' +
            esc(s.heat) +
            '</td><td class="num">' +
            esc(fmtNum(s.enterprises || 0)) +
            '</td><td class="num">' +
            esc(s.key_enterprises || 0) +
            '</td><td class="num">' +
            esc(pct(s.land_eff, 1)) +
            '</td><td class="num">' +
            esc(s.invest_leads || 0) +
            "</td><td>" +
            esc(s.cluster || "-") +
            "</td></tr>"
          );
        })
        .join("");
    }
    var ds = ctx.districts.slice();
    if (ctx.q) {
      ds = ds.filter(function (d) {
        return (d.name || "").indexOf(ctx.q) >= 0 || (d.cluster || "").indexOf(ctx.q) >= 0 || (d.gap || "").indexOf(ctx.q) >= 0;
      });
    }
    return ds
      .sort(function (a, b) {
        return Number(b.heat || 0) - Number(a.heat || 0);
      })
      .map(function (d, idx) {
        return (
          '<tr><td class="rank">' + (idx + 1) +
          "</td><td>" +
          esc(d.name) +
          '</td><td class="num">' +
          esc(d.heat) +
          '</td><td class="num">' +
          esc(fmtNum(d.enterprises || 0)) +
          '</td><td class="num">' +
          esc(d.key_enterprises || 0) +
          '</td><td class="num">' +
          esc(fixed(d.output_y, 1)) +
          '</td><td class="num">' +
          esc(fixed(d.tax_y, 1)) +
          "</td><td>" +
          esc(d.cluster || "-") +
          "</td></tr>"
        );
      })
      .join("");
  }

  function geoShortName(name, maxChars) {
    var s = String(name || "");
    if (!maxChars || s.length <= maxChars) return s;
    return s.slice(0, Math.max(1, maxChars - 1)) + "…";
  }

  function geoPointInRing(px, py, ring) {
    if (!ring || ring.length < 3) return false;
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = Number(ring[i][0] || 0), yi = Number(ring[i][1] || 0);
      var xj = Number(ring[j][0] || 0), yj = Number(ring[j][1] || 0);
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function geoViewCenterPercent() {
    var stage = document.querySelector('[data-role="geo-stage"]');
    var view = getActiveGeoView();
    if (!stage || !view) return null;
    var rect = stage.getBoundingClientRect();
    var w = Math.max(1, rect.width);
    var h = Math.max(1, rect.height);
    var cx = w / 2;
    var cy = h / 2;
    var zoom = Math.max(0.05, Number(view.zoom || 1));
    var worldX = (cx - Number(view.tx || 0)) / zoom;
    var worldY = (cy - Number(view.ty || 0)) / zoom;
    return { x: worldX / w * 100, y: worldY / h * 100 };
  }

  function geoFindItemAtPoint(items, px, py) {
    var best = null;
    var bestArea = Infinity;
    for (var i = 0; i < items.length; i++) {
      var rings = geoItemRings(items[i]);
      for (var r = 0; r < rings.length; r++) {
        if (geoPointInRing(px, py, rings[r])) {
          var area = geoRingArea(rings[r]);
          if (area < bestArea) { bestArea = area; best = items[i]; }
        }
      }
    }
    return best;
  }

  function geoFindNearestItem(items, px, py) {
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < items.length; i++) {
      var ix = Number(items[i].x || 50);
      var iy = Number(items[i].y || 50);
      var d = (ix - px) * (ix - px) + (iy - py) * (iy - py);
      if (d < bestDist) { bestDist = d; best = items[i]; }
    }
    return best;
  }

  function geoRingToPoints(ring) {
    return (ring || [])
      .map(function (pt) {
        var x = clamp(Number(pt[0] || 0), 0, 100);
        var y = clamp(Number(pt[1] || 0), 0, 100);
        return x.toFixed(3) + "," + y.toFixed(3);
      })
      .join(" ");
  }

  function geoRingToClosedPath(ring) {
    var points = (ring || [])
      .map(function (pt) {
        var x = clamp(Number(pt[0] || 0), 0, 100);
        var y = clamp(Number(pt[1] || 0), 0, 100);
        return x.toFixed(3) + "," + y.toFixed(3);
      });
    return points.length >= 3 ? ("M" + points.join(" L") + " Z") : "";
  }

  // Convert a ring of points to a smooth closed SVG path using Catmull-Rom → cubic Bezier
  function geoRingToSmoothPath(ring, tensionOverride) {
    if (!ring || ring.length < 3) return '';
    var pts = ring.map(function (pt) {
      return [clamp(Number(pt[0] || 0), 0, 100), clamp(Number(pt[1] || 0), 0, 100)];
    });
    var n = pts.length;
    var d = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
    var tension = Math.max(4, Number(tensionOverride || 6)); // higher = tighter curves
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n];
      var p1 = pts[i];
      var p2 = pts[(i + 1) % n];
      var p3 = pts[(i + 2) % n];
      var cp1x = p1[0] + (p2[0] - p0[0]) / tension;
      var cp1y = p1[1] + (p2[1] - p0[1]) / tension;
      var cp2x = p2[0] - (p3[0] - p1[0]) / tension;
      var cp2y = p2[1] - (p3[1] - p1[1]) / tension;
      d += ' C' + cp1x.toFixed(2) + ',' + cp1y.toFixed(2) +
           ' ' + cp2x.toFixed(2) + ',' + cp2y.toFixed(2) +
           ' ' + p2[0].toFixed(2) + ',' + p2[1].toFixed(2);
    }
    d += 'Z';
    return d;
  }

  function geoRingArea(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    var area = 0;
    for (var i = 0; i < ring.length; i++) {
      var a = ring[i];
      var b = ring[(i + 1) % ring.length];
      if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) continue;
      area += Number(a[0] || 0) * Number(b[1] || 0) - Number(b[0] || 0) * Number(a[1] || 0);
    }
    return Math.abs(area / 2);
  }

  function geoLargestRing(rings) {
    var best = null;
    var bestArea = 0;
    (rings || []).forEach(function (ring) {
      var area = geoRingArea(ring);
      if (area > bestArea) { bestArea = area; best = ring; }
    });
    return best;
  }

  function geoPrimaryCityRing(ctx) {
    var city = (ctx && ctx.realCity) || (geoData() && geoData().real_city) || null;
    var rings = city && Array.isArray(city.polygons) ? city.polygons : [];
    return geoLargestRing(rings);
  }

  function geoCityClipStyle(ctx) {
    var ring = geoPrimaryCityRing(ctx);
    if (!ring || ring.length < 3) return "";
    var polygon = ring
      .map(function (pt) {
        var x = clamp(Number(pt[0] || 0), 0, 100);
        var y = clamp(Number(pt[1] || 0), 0, 100);
        return x.toFixed(2) + "% " + y.toFixed(2) + "%";
      })
      .join(", ");
    return ' style="-webkit-clip-path:polygon(' + polygon + ');clip-path:polygon(' + polygon + ');"';
  }

  function geoItemRings(item) {
    if (!item || !Array.isArray(item.geo_shape) || !item.geo_shape.length) return [];
    return item.geo_shape.filter(function (ring) {
      return Array.isArray(ring) && ring.length >= 3;
    });
  }

  function geoFocusDimLayer(ctx) {
    // Only dim when a specific street/park/building is selected in the sidebar
    if (ctx.level === "district") return "";
    var focusItem = null;
    if (ctx.level === "building" || ctx.level === "street") {
      focusItem = ctx.scope === "park" ? ctx.park : ctx.street;
    }
    if (!focusItem) return "";
    var rings = geoItemRings(focusItem);
    if (!rings.length) return "";
    // Build evenodd paths: outer rect fills dark, inner polygons cut out the focused area
    var outerRect = "M0,0 L100,0 L100,100 L0,100 Z";
    var innerPolys = rings.map(function (ring) {
      return "M" + ring.map(function (pt) {
        return clamp(Number(pt[0] || 0), 0, 100).toFixed(2) + "," + clamp(Number(pt[1] || 0), 0, 100).toFixed(2);
      }).join(" L") + " Z";
    }).join(" ");
    // Also draw highlight strokes along the focused area boundaries
    var borderPolys = rings.map(function (ring) {
      return '<polygon class="geo-focus-border" points="' + geoRingToPoints(ring) + '" />';
    }).join("");
    return '<svg class="geo-focus-dim-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<path d="' + outerRect + ' ' + innerPolys + '" fill-rule="evenodd" />' +
      borderPolys +
      '</svg>';
  }

  function geoBackdropLayer(ctx) {
    var city = ctx.realCity || null;
    var ds = ctx.realDistrictBackdrop || [];
    if ((!city || !Array.isArray(city.polygons) || !city.polygons.length) && !ds.length) return "";

    var cityPolys = city && Array.isArray(city.polygons)
      ? city.polygons
          .map(function (ring) {
            return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
          })
          .join("")
      : "";
    return '<svg class="geo-backdrop-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><g class="geo-city-shape">' + cityPolys + "</g></svg>";
  }

  function geoBoundaryPoints(x, y, rx, ry, seed) {
    var pts = [];
    var n = 7;
    for (var i = 0; i < n; i++) {
      var a = (Math.PI * 2 * i) / n;
      var jx = 1 + jitter(seed + i * 11, 0.35);
      var jy = 1 + jitter(seed + i * 17, 0.35);
      var px = x + Math.cos(a) * rx * jx;
      var py = y + Math.sin(a) * ry * jy;
      pts.push(clamp(px, 1, 99).toFixed(2) + "," + clamp(py, 2, 98).toFixed(2));
    }
    return pts.join(" ");
  }

  function geoChainHit(item, chain) {
    var txt = (item && (item.cluster || item.lead_industry || item.name) ? (item.cluster || "") + " " + (item.lead_industry || "") + " " + (item.name || "") : "");
    var key = String(chain || "").slice(0, 2);
    return key && txt.indexOf(key) >= 0;
  }

  function geoBoundaryLayer(ctx) {
    var level = ctx.level;
    var items = [];
    var action = "";
    var activeId = "";
    var radiusX = 8;
    var radiusY = 6;
    var cls = "district";

    if (level === "district") {
      items = ctx.districts.slice();
      action = "geo_drill_district";
      activeId = ctx.did;
      radiusX = 11;
      radiusY = 8.3;
      cls = "district";
    } else if (level === "street") {
      if (ctx.scope === "park") {
        items = geoScopedParkItems(ctx);
        action = "geo_focus_park";
        activeId = ctx.pid;
        radiusX = 7.8;
        radiusY = 5.7;
        cls = "park";
      } else {
        items = ctx.streetsInDistrict.slice();
        action = "geo_drill_street";
        activeId = ctx.sid;
        radiusX = 6.1;
        radiusY = 4.6;
        cls = "street";
      }
    } else {
      // Building level: always show actual building boundaries
      items = ctx.buildingsInScope.slice();
      action = "geo_open_building";
      activeId = "";
      radiusX = 0.5;
      radiusY = 0.4;
      cls = "building";
    }

    var toneMap = {
      district: { text: "rgba(15, 55, 100, 0.85)" },
      street: { text: "rgba(20, 70, 110, 0.8)" },
      park: { text: "rgba(22, 100, 70, 0.85)" },
      building: { text: "rgba(40, 60, 90, 0.8)" },
    };
    var tone = toneMap[cls] || toneMap.district;

    if (ctx.q) {
      items = items.filter(function (it) {
        return (it.name || "").indexOf(ctx.q) >= 0 || (it.cluster || "").indexOf(ctx.q) >= 0 || (it.lead_industry || "").indexOf(ctx.q) >= 0;
      });
    }
    if (level === "building") {
      items = items.filter(function (it) {
        var tp = hashNumber(it.id) % 3 === 0 ? "factory" : "building";
        return ctx.carrier.indexOf(tp) >= 0;
      });
    }

    var labelBehavior = "always";
    if (level === "building") labelBehavior = "hover";
    else if (cls === "park") {
      if (ctx.parkMode !== "all" && activeId) labelBehavior = "active";
      else if (items.length > 6) labelBehavior = "hover";
    }

    // Label collision avoidance: greedy placement in viewBox 0-100 space
    var _labelSlots = [];
    function _labelFits(cx, cy, halfW, halfH) {
      for (var si = 0; si < _labelSlots.length; si++) {
        var s = _labelSlots[si];
        if (Math.abs(cx - s.cx) < (halfW + s.hw) && Math.abs(cy - s.cy) < (halfH + s.hh)) return false;
      }
      return true;
    }

    var _boundaryPalette = [
      { stroke: "rgba(41, 121, 196, 0.72)", fill: "rgba(41, 121, 196, 0.05)" },
      { stroke: "rgba(180, 82, 52, 0.72)",  fill: "rgba(180, 82, 52, 0.05)" },
      { stroke: "rgba(46, 160, 120, 0.72)", fill: "rgba(46, 160, 120, 0.05)" },
      { stroke: "rgba(156, 96, 176, 0.72)", fill: "rgba(156, 96, 176, 0.05)" },
      { stroke: "rgba(200, 148, 38, 0.72)", fill: "rgba(200, 148, 38, 0.05)" },
      { stroke: "rgba(66, 146, 158, 0.72)", fill: "rgba(66, 146, 158, 0.05)" },
      { stroke: "rgba(196, 72, 108, 0.72)", fill: "rgba(196, 72, 108, 0.05)" },
      { stroke: "rgba(88, 132, 60, 0.72)",  fill: "rgba(88, 132, 60, 0.05)" },
      { stroke: "rgba(102, 92, 172, 0.72)", fill: "rgba(102, 92, 172, 0.05)" },
      { stroke: "rgba(178, 116, 62, 0.72)", fill: "rgba(178, 116, 62, 0.05)" },
      { stroke: "rgba(58, 108, 186, 0.72)", fill: "rgba(58, 108, 186, 0.05)" },
      { stroke: "rgba(148, 62, 148, 0.72)", fill: "rgba(148, 62, 148, 0.05)" },
    ];

    var groups = items
      .map(function (it, idx) {
        var x = Number(it.x || 50);
        var y = Number(it.y || 50);
        var sid = hashNumber(it.id || idx);
        var rings = geoItemRings(it);
        var polyHtml = "";
        if (rings.length) {
          polyHtml = rings
            .map(function (ring) {
              return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
            })
            .join("");
        } else {
          polyHtml = '<polygon points="' + geoBoundaryPoints(x, y, radiusX, radiusY, sid) + '"></polygon>';
        }
        var classes = "geo-boundary-shape " + cls;
        if (it.id === activeId) classes += " active";
        if (geoChainHit(it, ctx.chain)) classes += " chain-hit";
        var nameLimit = cls === "district" ? 6 : cls === "street" ? 7 : cls === "park" ? 9 : 12;
        var label = geoShortName(it.name, nameLimit);
        if (ctx.scope === "park" && cls === "park" && ctx.parkMode !== "all") label = "";
        if (ctx.fastRender && cls !== "district") label = "";
        // Label collision: skip label if it overlaps a previously placed one
        var labelHW = label ? label.length * 0.55 : 0;
        var labelHH = label ? 0.7 : 0;
        if (label && labelBehavior === "always") {
          var lx = x;
          var ly = clamp(y + 0.4, 2, 98);
          if (!_labelFits(lx, ly, labelHW, labelHH)) {
            // Try nudging down slightly
            var nudgeY = ly + 1.4;
            if (nudgeY < 99 && _labelFits(lx, nudgeY, labelHW, labelHH)) {
              ly = nudgeY;
            } else {
              label = "";
            }
          }
          if (label) _labelSlots.push({ cx: lx, cy: ly, hw: labelHW, hh: labelHH });
        }
        var textHtml = label
          ? '<text class="geo-boundary-label behavior-' +
            labelBehavior +
            '" x="' +
            x.toFixed(2) +
            '" y="' +
            clamp(y + 0.4, 2, 98).toFixed(2) +
            '" style="fill:' +
            tone.text +
            '">' +
            esc(label) +
            "</text>"
          : "";
        var dataAttrs = ' data-name="' + esc(it.name || "") + '"' + (action ? ' data-action="' + action + '" data-id="' + esc(it.id) + '"' : "");
        var pal = _boundaryPalette[idx % _boundaryPalette.length];
        var gStyle = ' style="--area-stroke:' + pal.stroke + ';--area-fill:' + pal.fill + ';"';
        return (
          "<g class=\"" +
          classes +
          "\"" +
          dataAttrs +
          gStyle +
          ">" +
          polyHtml +
          textHtml +
          "</g>"
        );
      })
      .join("");

    return '<svg class="geo-boundary-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' + groups + "</svg>";
  }

  function geoBreadcrumb(ctx) {
    var districtName = (ctx.district && ctx.district.name) || "区（市）县";
    var streetName = (ctx.street && ctx.street.name) || "街道";
    var parkName = ctx.parkMode === "all"
      ? "全部园区"
      : geoShortName((ctx.park && ctx.park.name) || "园区", 12);
    var areaName = ctx.scope === "park" ? parkName : streetName;
    var areaLevelName = ctx.scope === "park" ? "园区级" : "街道级";
    var areaPath = ctx.scope === "park" ? "/gov/geo-park" : "/gov/geo-street";
    if (ctx.level === "building") {
      var hasBuildingArea = ctx.scope === "park" ? !!ctx.park : !!ctx.street;
      if (!hasBuildingArea) {
        return (
          '<div class="geo-map-crumb"><a href="' +
          buildHash("/gov/geo-district", geoStickyQuery(ctx, { sid: "", pid: "", scope: "district" })) +
          '">' +
          esc(districtName) +
          '</a><span>/</span><b>载体（楼宇）级 · 全部</b></div>'
        );
      }
      return (
        '<div class="geo-map-crumb"><a href="' +
        buildHash("/gov/geo-district", geoStickyQuery(ctx, { sid: "", pid: "", scope: "district" })) +
        '">' +
        esc(districtName) +
        '</a><span>/</span><a href="' +
        buildHash(
          areaPath,
          geoStickyQuery(
            ctx,
            ctx.scope === "park"
              ? { scope: "park", pid: ctx.pid, sid: ctx.sid }
              : { scope: "street", sid: ctx.sid, pid: "" }
          )
        ) +
        '">' +
        esc(areaName) +
        '</a><span>/</span><b>载体（楼宇）级</b></div>'
      );
    }
    if (ctx.level === "street") {
      var hasArea = ctx.scope === "park" ? !!ctx.park : !!ctx.street;
      if (!hasArea) {
        return (
          '<div class="geo-map-crumb"><a href="' +
          buildHash("/gov/geo-district", geoStickyQuery(ctx, { sid: "", pid: "", scope: "district" })) +
          '">' +
          esc(districtName) +
          '</a><span>/</span><b>' +
          esc(areaLevelName + " · 全部") +
          "</b></div>"
        );
      }
      return (
        '<div class="geo-map-crumb"><a href="' +
        buildHash("/gov/geo-district", geoStickyQuery(ctx, { sid: "", pid: "", scope: "district" })) +
        '">' +
        esc(districtName) +
        '</a><span>/</span><b>' +
        esc(areaName + " · " + areaLevelName) +
        "</b></div>"
      );
    }
    return '<div class="geo-map-crumb"><b>区（市）县级</b></div>';
  }

  function geoStickyQuery(ctx, changes) {
    var q = {
      did: ctx.did,
      sid: ctx.sid,
      pid: ctx.pid,
      metric: ctx.metric,
      market: ctx.market,
      inds: ctx.inds.join(","),
      chain_city: ctx.chainCity,
      chain: ctx.chain,
      proj: ctx.showProject ? "1" : "0",
      park_skin: ctx.showParkSkin ? "1" : "0",
      park_poi: ctx.showParkPoi ? "1" : "0",
      carrier: ctx.carrier.length ? ctx.carrier.join(",") : "none",
      scope: ctx.scope,
      bottom: ctx.bottomExpanded ? "1" : "0",
      q: ctx.q || "",
      omt: ctx.showOnlineTiles ? "1" : "0",
      omt_p: ctx.onlineTileProvider || geoDefaultOnlineProvider(),
    };
    Object.keys(changes || {}).forEach(function (k) {
      q[k] = changes[k];
    });
    return q;
  }

  function geoParkKpis(park, ctx) {
    var bs = (ctx.buildings || []).filter(function (b) {
      return b.park_id === park.id;
    });
    var out = bs.reduce(function (sum, b) {
      return sum + Number(b.output_y || 0);
    }, 0);
    return {
      key_enterprises: Number(park.key_enterprises || 0),
      invest_leads: Number(park.invest_leads || 0),
      project_count: Math.max(2, Math.round(Number(park.invest_leads || 0) / 2)),
      building_count: bs.length,
      output_y: out,
    };
  }

  function geoCompareRows(left, right, suffix) {
    var l = Number(left || 0);
    var r = Number(right || 0);
    var delta = l - r;
    var sign = delta > 0 ? "+" : "";
    var lf = suffix ? fixed(l, 1) : String(Math.round(l));
    var rf = suffix ? fixed(r, 1) : String(Math.round(r));
    var df = fixed(delta, 1);
    return {
      left: lf + (suffix || ""),
      right: rf + (suffix || ""),
      delta: sign + df + (suffix || ""),
      cls: delta >= 0 ? "up" : "down",
    };
  }

  function geoStorylineByPark(parkId) {
    var park = geoParkById(parkId);
    if (!park) return null;
    var geo = geoData();
    var bs = (geo.buildings || [])
      .filter(function (b) {
        return b.park_id === parkId;
      })
      .sort(function (a, b) {
        return Number(b.output_y || 0) - Number(a.output_y || 0);
      });
    var b0 = bs[0] || null;
    var ents = (seed.enterprises || []).filter(isRealEnterprise);
    var e0 = ents.length && b0 ? ents[hashNumber(b0.id) % ents.length] : null;
    return {
      park: park,
      building: b0,
      enterprise: e0,
    };
  }

  function geoParkSkinLayer(ctx) {
    if (ctx.level !== "street" || ctx.scope !== "park") return "";
    var parkItems = geoScopedParkItems(ctx);
    var hasRealSkin = parkItems.some(function (p) {
      return geoItemRings(p).length > 0;
    });
    if (hasRealSkin) {
      var groups = parkItems
        .map(function (p) {
          var rings = geoItemRings(p);
          if (!rings.length) return "";
          var cls = "geo-park-skin";
          if (p.id === ctx.pid) cls += " active";
          if (geoChainHit(p, ctx.chain)) cls += " chain-hit";
          var polys = rings
            .map(function (ring) {
              return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
            })
            .join("");
          return '<g class="' + cls + '">' + polys + "</g>";
        })
        .join("");
      return '<svg class="geo-park-skin-layer geo-park-skin-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' + groups + "</svg>";
    }
    var skins = parkItems
      .map(function (p, idx) {
        var x = Number(p.x || 50);
        var y = Number(p.y || 50);
        var w = 13 + ((idx % 3) + 1) * 1.2;
        var h = 10 + ((idx % 4) + 1) * 1.1;
        var cls = "geo-park-skin";
        if (p.id === ctx.pid) cls += " active";
        if (geoChainHit(p, ctx.chain)) cls += " chain-hit";
        return (
          '<span class="' +
          cls +
          '" style="left:' +
          x.toFixed(2) +
          "%;top:" +
          y.toFixed(2) +
          "%;width:" +
          w.toFixed(2) +
          "%;height:" +
          h.toFixed(2) +
          '%;"></span>'
        );
      })
      .join("");
    return '<div class="geo-park-skin-layer">' + skins + "</div>";
  }

  function geoParkPoiNodes(ctx) {
    var ps;
    if (ctx.scope === "park") {
      ps = ctx.level === "district"
        ? ctx.parks.slice()
        : ctx.level === "building"
          ? [ctx.park].filter(Boolean)
          : geoScopedParkItems(ctx);
    } else {
      ps = (ctx.parksInDistrict || []).slice();
    }
    if (ctx.q) {
      ps = ps.filter(function (p) {
        return (p.name || "").indexOf(ctx.q) >= 0 || (p.cluster || "").indexOf(ctx.q) >= 0;
      });
    }
    return ps.slice(0, 10).map(function (p) {
      var k = geoParkKpis(p, ctx);
      return {
        id: p.id,
        name: p.name,
        x: Number(p.x || 50),
        y: Number(p.y || 50),
        tag: p.cluster || "",
        street_id: p.street_id || "",
        key_enterprises: k.key_enterprises,
        invest_leads: k.invest_leads,
        project_count: k.project_count,
        building_count: k.building_count,
        output_y: k.output_y,
        is_active: p.id === ctx.pid,
      };
    });
  }

  function geoParkDrawer(ctx) {
    if (ctx.scope !== "park" || ctx.level !== "street" || !ctx.park) return "";
    var k = geoParkKpis(ctx.park, ctx);
    return (
      '<aside class="geo-park-drawer">' +
      '<button class="geo-park-drawer-close" data-action="geo_park_popup_close" title="关闭">&times;</button>' +
      '<div class="hd"><p class="name">' +
      esc(ctx.park.name) +
      '</p><span class="tag">' +
      esc(ctx.park.cluster || "园区") +
      "</span></div>" +
      '<p class="desc">重点企业 ' +
      esc(k.key_enterprises) +
      ' 家，街区 ' +
      esc(k.project_count) +
      " 个，年度产出 " +
      esc(fixed(k.output_y, 1)) +
      " 亿元。</p>" +
      '<div class="geo-drawer-kpis"><div class="k"><span>招商线索</span><b>' +
      esc(k.invest_leads) +
      '</b></div><div class="k"><span>土地产出</span><b>' +
      esc(k.building_count) +
      '</b></div><div class="k"><span>土地产出</span><b>' +
      esc(pct(ctx.park.land_eff || 0, 1)) +
      '</b></div><div class="k"><span>热力指数</span><b>' +
      esc(ctx.park.heat || 0) +
      "</b></div></div>" +
      '<div class="geo-mini-actions"><button class="geo-mini-btn" data-action="geo_focus_park" data-id="' +
      esc(ctx.park.id) +
      '">重新定位</button><button class="geo-mini-btn" data-action="geo_storyline_park" data-id="' +
      esc(ctx.park.id) +
      '">一键串场</button></div>' +
      "</aside>"
    );
  }

  // ── Dynamic park drawer popup near clicked shape ──────────
  var _geoParkPopupAnchor = null; // { x, y } in client coords — set on park click
  var _geoParkPopupEl = null;

  function geoParkDrawerPopup() {
    // Remove existing popup
    if (_geoParkPopupEl && _geoParkPopupEl.parentNode) {
      _geoParkPopupEl.parentNode.removeChild(_geoParkPopupEl);
    }
    _geoParkPopupEl = null;

    // Only show popup when explicitly triggered by a map click (anchor set)
    // if (!_geoParkPopupAnchor) return;

    var rt = route();
    var ctx = geoContext(rt, rt.path);
    var html = geoParkDrawer(ctx);
    if (!html) return;

    var stage = document.querySelector('[data-role="geo-stage"]');
    if (!stage) return;

    // Find the active park shape to position near it
    var activeShape = stage.querySelector('.geo-boundary-shape.active');
    var stageRect = stage.getBoundingClientRect();
    var anchorX, anchorY;

    if (_geoParkPopupAnchor) {
      anchorX = _geoParkPopupAnchor.x - stageRect.left;
      anchorY = _geoParkPopupAnchor.y - stageRect.top;
    } else if (activeShape) {
      var shapeRect = activeShape.getBoundingClientRect();
      anchorX = shapeRect.left + shapeRect.width / 2 - stageRect.left;
      anchorY = shapeRect.top - stageRect.top;
    } else {
      anchorX = stageRect.width * 0.5;
      anchorY = stageRect.height * 0.3;
    }

    var wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    _geoParkPopupEl = wrapper.firstChild;
    _geoParkPopupEl.classList.add("geo-park-drawer-popup");
    stage.appendChild(_geoParkPopupEl);

    // Position: prefer above the shape, fall back below
    var drawerRect = _geoParkPopupEl.getBoundingClientRect();
    var drawerW = drawerRect.width;
    var drawerH = drawerRect.height;
    var left = anchorX - drawerW / 2;
    var top = anchorY - drawerH - 12;
    // Clamp horizontally
    if (left < 8) left = 8;
    if (left + drawerW > stageRect.width - 8) left = stageRect.width - drawerW - 8;
    // If above goes off-screen, show below
    if (top < 8) top = anchorY + 30;
    // If still off bottom, just pin to top
    if (top + drawerH > stageRect.height - 8) top = 8;

    _geoParkPopupEl.style.left = left + "px";
    _geoParkPopupEl.style.top = top + "px";
    _geoParkPopupAnchor = null;

    // Close on outside click
    setTimeout(function () {
      document.addEventListener("click", function _parkPopupClose(ev) {
        if (_geoParkPopupEl && _geoParkPopupEl.contains(ev.target)) return;
        if (ev.target.closest && ev.target.closest('.geo-boundary-shape')) return;
        geoParkDrawerPopupHide();
        document.removeEventListener("click", _parkPopupClose);
      });
    }, 10);
  }

  function geoParkDrawerPopupHide() {
    if (_geoParkPopupEl && _geoParkPopupEl.parentNode) {
      _geoParkPopupEl.parentNode.removeChild(_geoParkPopupEl);
    }
    _geoParkPopupEl = null;
  }

  function geoMap(ctx) {
    var fastRender = geoShouldFastRender(ctx.path);
    var heatNodesAll = geoHeatNodes(ctx);
    var heatNodes = heatNodesAll;
    var isParkFocus = geoIsParkFocus(ctx);
    var isBuildingFocus = ctx.level === "building";
    if (!isBuildingFocus) {
      var auxCap = fastRender ? (ctx.level === "district" ? 8 : 6) : (ctx.level === "district" ? 24 : ctx.scope === "park" ? 14 : 21);
      heatNodes = heatNodesAll
        .slice()
        .sort(function (a, b) {
          return Number(b.value || b.heat || 0) - Number(a.value || a.heat || 0);
        })
        .slice(0, auxCap)
        .sort(function (a, b) {
          return Number(a.value || a.heat || 0) - Number(b.value || b.heat || 0);
        });
    } else {
      var buildingHeatCap = fastRender ? 3 : (ctx.scope === "park" ? 4 : 5);
      heatNodes = heatNodesAll
        .slice()
        .sort(function (a, b) {
          return Number(b.value || b.heat || 0) - Number(a.value || a.heat || 0);
        })
        .slice(0, buildingHeatCap)
        .sort(function (a, b) {
          return Number(a.value || a.heat || 0) - Number(b.value || b.heat || 0);
        });
    }
    var staticHeatLabelIds = {};
    if (!fastRender && ctx.level === "street") {
      heatNodes.forEach(function (n) {
        staticHeatLabelIds[n.id] = true;
      });
    }
    var marketNodesAll = geoEntityPoints(ctx);
    var marketNodes;
    if (fastRender) {
      marketNodes = ctx.level === "building" ? marketNodesAll.slice(0, 4) : [];
    } else {
      // Cap enterprise icons to avoid DOM bloat — prioritise "规上" (core) enterprises
      var entCap = ctx.level === "building" ? 50 : ctx.level === "street" ? 60 : 40;
      if (marketNodesAll.length > entCap) {
        marketNodes = marketNodesAll.slice().sort(function (a, b) {
          var aw = a.markerType === "core" ? 1 : 0;
          var bw = b.markerType === "core" ? 1 : 0;
          return bw - aw;
        }).slice(0, entCap);
      } else {
        marketNodes = marketNodesAll;
      }
    }
    var projectNodes = fastRender ? [] : geoProjectNodes(ctx);
    var carrierNodesAll = geoCarrierNodes(ctx);
    var carrierNodes = fastRender
      ? (ctx.level === "building" ? carrierNodesAll.slice(0, 4) : [])
      : carrierNodesAll;
    var parkPoiNodes = fastRender ? [] : (ctx.showParkPoi ? geoParkPoiNodes(ctx) : []);
    var parkSkinHtml = !fastRender && ctx.showParkSkin ? geoParkSkinLayer(ctx) : "";
    // Park drawer is now shown dynamically on park click (see geoParkDrawerPopup)
    var backdropHtml = geoBackdropLayer(ctx);
    var focusDimHtml = geoFocusDimLayer(ctx);
    var cityClipStyle = geoCityClipStyle(ctx);
    // Always clip tiles to city boundary so the full city map is visible at every level
    _geoTileClipRing = geoPrimaryCityRing(ctx);

    var heatHtml = heatNodes
      .map(function (n) {
        var target = ctx.level === "district"
          ? (n.id === ctx.did ? buildHash("/gov/geo-street", geoStickyQuery(ctx, { did: n.id, sid: "", pid: "" })) : "")
          : ctx.level === "street"
            ? ctx.scope === "park"
              ? buildHash("/gov/geo-park", geoStickyQuery(ctx, { park_mode: "focus", pid: n.id, sid: (geoParkById(n.id) || {}).street_id || "" }))
              : buildHash("/gov/geo-street", geoStickyQuery(ctx, { sid: n.id, pid: "" }))
            : "";
        var mv = geoMetricVisual(ctx.metric);
        var r = typeof n.ratio === "number" ? n.ratio : 0.5;
        // Heatmap blob: large radial gradient circle, size & intensity proportional to value
        var blobBase = ctx.level === "district" ? 120 : ctx.level === "street" ? (ctx.scope === "park" ? 70 : 90) : 50;
        if (isParkFocus) blobBase = Math.round(blobBase * 0.7);
        var blobSize = Math.round(blobBase * (0.45 + r * 0.55));
        var blobAlpha = (0.25 + r * 0.55).toFixed(2);
        // Color stops: vivid center → transparent edge
        var coreColor = mv.gradient[2]; // most vivid
        var midColor = mv.gradient[1];
        var edgeColor = mv.gradient[0];
        var showHeatLabel = !fastRender && (ctx.level === "district" || ctx.level === "building" || !!staticHeatLabelIds[n.id]);
        var valueLabel = "";
        if (n.value) {
          if (ctx.metric === "revenue") {
            valueLabel = n.value >= 10 ? Math.round(n.value) + "亿" : n.value >= 1 ? n.value.toFixed(1) + "亿" : (n.value * 10000).toFixed(0) + "万";
          } else {
            valueLabel = n.value >= 10000 ? (n.value / 10000).toFixed(1) + "亿" : n.value >= 100 ? Math.round(n.value) + "" : n.value.toFixed(1);
          }
        }
        var label = showHeatLabel ? ('<span class="geo-heat-label' + (ctx.level === "building" ? " compact" : "") + '">' + esc(geoShortName(n.name || "", 8)) + (valueLabel ? '<em class="geo-heat-val">' + esc(valueLabel) + '</em>' : '') + '</span>') : "";
        var dot =
          '<span class="geo-heat-blob" style="width:' + blobSize + "px;height:" + blobSize + "px;opacity:" + blobAlpha +
          ";--blob-core:" + coreColor + ";--blob-mid:" + midColor + ";--blob-edge:" + edgeColor +
          ';"></span>' + label;
        var pos = ' data-ox="' + n.x + '" data-oy="' + n.y + '" style="left:' + n.x + "%;top:" + n.y + '%;"';
        if (target) return '<a class="geo-node-link" href="' + target + '"' + pos + ">" + dot + "</a>";
        return '<div class="geo-node-link"' + pos + ">" + dot + "</div>";
      })
      .join("");

    var parkPoiHtml = parkPoiNodes
      .map(function (p) {
        var extra = p.is_active ? " active" : p.is_subdued ? " subdued" : "";
        return (
          '<div class="geo-poi-wrap park geo-layer-park' +
          extra +
          '" data-ox="' + p.x.toFixed(2) + '" data-oy="' + p.y.toFixed(2) + '" style="left:' +
          p.x.toFixed(2) +
          "%;top:" +
          p.y.toFixed(2) +
          '%;"><button class="geo-poi-dot park" data-action="geo_focus_park" data-id="' +
          esc(p.id) +
          '">' + geoMarkerSvg("park") + '</button><div class="geo-poi-card park"><p class="name">' +
          esc(p.name) +
          '</p><p>重点企业：' +
          esc(p.tag || "-") +
          '</p><p>重点企业：' +
          esc(p.key_enterprises) +
          '家，街区：' +
          esc(p.project_count) +
          '个</p><p>招商线索：' +
          esc(p.invest_leads) +
          '条，载体：' +
          esc(p.building_count) +
          '栋</p><p>年度产出：' +
          esc(fixed(p.output_y, 1)) +
          " 亿元</p></div></div>"
        );
      })
      .join("");

    var coreEnterpriseIds = {};
    marketNodes.forEach(function (p) { if (p.level === "规上") coreEnterpriseIds[p.id] = true; });
    var marketHtml = marketNodes
      .map(function (p) {
        return (
          '<span class="geo-entity-wrap geo-layer-enterprise geo-ind-' + (p.industryKey || 'mfg') + ' ' +
          (coreEnterpriseIds[p.id] ? "tier-core" : "tier-high") +
          '" data-ox="' + p.x.toFixed(2) + '" data-oy="' + p.y.toFixed(2) + '" style="left:' +
          p.x.toFixed(2) +
          "%;top:" +
          p.y.toFixed(2) +
          '%;">'  +
          '<button class="geo-entity-badge t-' +
          esc(p.markerType || "general") +
          '" data-action="geo_open_enterprise" data-id="' +
          esc(p.id) +
          '" style="--entity-color:' +
          p.color +
          ';">' +
          '<span class="geo-entity-dot">' +
          geoMarkerSvg("enterprise") +
          "</span>" +
          '</button>' +
          '<span class="geo-entity-card"><b>' +
          esc(p.name) +
          '</b><em>' +
          esc((p.industry || "-") + " / " + (p.level || "-")) +
          '</em></span>' +
          "</span>"
        );
      })
      .join("");

    var projectHtml = projectNodes
      .map(function (p) {
        return (
          '<div class="geo-poi-wrap geo-layer-project" data-ox="' + p.x.toFixed(2) + '" data-oy="' + p.y.toFixed(2) + '" style="left:' +
          p.x.toFixed(2) +
          "%;top:" +
          p.y.toFixed(2) +
          '%;"><span class="geo-poi-dot project" title="' +
          esc(p.name) +
          '">' + geoMarkerSvg("project") + '</span></div>'
        );
      })
      .join("");

    var carrierHtml = carrierNodes
      .map(function (p) {
        return (
          '<div class="geo-poi-wrap geo-layer-carrier" data-ox="' + p.x.toFixed(2) + '" data-oy="' + p.y.toFixed(2) + '" style="left:' +
          p.x.toFixed(2) +
          "%;top:" +
          p.y.toFixed(2) +
          '%;">'  +
          '<button class="geo-poi-dot carrier" data-action="geo_open_building" data-id="' +
          esc(p.id) +
          '">' + geoMarkerSvg(p.type === "factory" ? "factory" : "carrier") + "</button>" +
          '<div class="geo-poi-card"><p class="name">' +
          esc(p.name) +
          '</p><p>' +
          esc((p.district_name || "") + " · " + (ctx.scope === "park" ? (p.park_name || p.street_name || "") : (p.street_name || ""))) +
          '</p><p>方向：' +
          esc(p.lead_industry || "-") +
          '</p><p>面积：' +
          esc(p.area_sqm || 0) +
          '㎡，入驻率：' +
          esc(pct(p.occupied_rate || 0, 1)) +
          "</p></div></div>"
        );
      })
      .join("");

    var areaLabel =
      ctx.level === "district"
        ? ((ctx.district && ctx.district.name) || "全区")
        : ctx.scope === "park"
          ? ctx.parkMode === "all"
            ? ((ctx.district && ctx.district.name) || "区") + " · 区（市）县级"
            : geoShortName((ctx.park && ctx.park.name) || "园区", 12)
          : ((ctx.street && ctx.street.name) || "街道");
    var topLabel = ctx.level === "building"
      ? areaLabel + " · 载体（楼宇）级"
      : ctx.level === "street"
        ? (ctx.scope === "park" ? areaLabel + " · 园区级" : ((ctx.district && ctx.district.name) || "区") + " · 街道级")
        : ((ctx.district && ctx.district.name) || "区") + " · 区（市）县级";
    var metricSelected = !!geoNormalizeMetricId(ctx.metric);
    var metricLabel = aiMetricName(ctx.metric);
    var metricPillLabel = metricSelected ? metricLabel : "未选择";
    var metricLegendLabel = metricSelected ? metricLabel : "经济热力图";
    var indLabel = ctx.inds.length ? ctx.inds.join(", ") : "全部";
    var carrierLabel = !ctx.carrier.length
      ? "未选"
      : ctx.carrier
        .map(function (x) {
          return geoCarrierName(x);
        })
        .join(" / ");
    var parkLayerLabel = (ctx.showParkSkin ? "蒙皮" : "关") + " / " + (ctx.showParkPoi ? "POI" : "关");
    var metricVis = geoMetricVisual(ctx.metric);
    var metricVisual = {
      accent: metricVis.color,
      accentSoft: metricVis.gradient[0],
      accentBorder: metricVis.gradient[1],
      accentText: metricVis.color,
    };
    var detailBasemap = !!(window.DEMO_GEO_BASEMAP_DETAIL);
    var provider = geoTileProviderByKey(ctx.onlineTileProvider || geoDefaultOnlineProvider());
    var useNativeBasemap = ctx.showOnlineTiles && geoTileProviderUsesNativeMap(ctx.onlineTileProvider || geoDefaultOnlineProvider());
    var tileProviderReady = !!provider;
    var showDetailBasemap = detailBasemap;
    var mapBaseLabel = ctx.showOnlineTiles
      ? ((provider && provider.name) || "在线瓦片") + (showDetailBasemap ? " + 成都道路网" : " + 成都市边界")
      : detailBasemap
        ? "成都区域真实边界 + 详细路网"
        : ctx.realCity
          ? "成都区域真实边界"
          : "未分类";
    var mapSourceLabel = ctx.showOnlineTiles
      ? ((provider && provider.name) || "在线瓦片") + (provider && provider.requiresToken ? "（需 Key）" : "")
      : detailBasemap
        ? (ctx.realCity ? "阿里云 DataV + OpenStreetMap" : "内置样例")
        : ctx.realCity
          ? "阿里云 DataV + OpenStreetMap"
          : "内置样例";
    var labelScale = isBuildingFocus ? (isParkFocus ? 0.56 : 0.62) : isParkFocus ? 0.88 : ctx.level === "street" ? 0.95 : 1;
    var iconScale = isBuildingFocus ? 1.42 : isParkFocus ? 1.38 : ctx.level === "street" ? 1.34 : 1.3;
    var entityScale = isBuildingFocus ? 1.38 : isParkFocus ? 1.34 : ctx.level === "street" ? 1.3 : 1.26;
    var roadLabelScale = isBuildingFocus ? (isParkFocus ? 0.68 : 0.76) : isParkFocus ? 0.76 : ctx.level === "street" ? 0.92 : 1;
    var boundaryLabelScale = isBuildingFocus ? (isParkFocus ? 0.5 : 0.58) : isParkFocus ? 0.82 : ctx.level === "street" ? 0.92 : 1;
    var meshLabelScale = isBuildingFocus ? (isParkFocus ? 0.62 : 0.7) : isParkFocus ? 0.78 : ctx.level === "street" ? 0.92 : 1;
    var heatLabelScale = isBuildingFocus ? (isParkFocus ? 0.52 : 0.58) : isParkFocus ? 0.88 : ctx.level === "street" ? 0.84 : 1;
    var poiCardScale = isBuildingFocus ? (isParkFocus ? 0.5 : 0.58) : isParkFocus ? 0.68 : ctx.level === "street" ? 0.74 : 0.8;
    var layerCls = (!_geoLayerVis.heat ? " hide-heat" : "") + (!_geoLayerVis.enterprise ? " hide-enterprise" : "") + (!_geoLayerVis.ent_mfg ? " hide-ent_mfg" : "") + (!_geoLayerVis.ent_bio ? " hide-ent_bio" : "") + (!_geoLayerVis.ent_biz ? " hide-ent_biz" : "") + (!_geoLayerVis.ent_srv ? " hide-ent_srv" : "") + (!_geoLayerVis.project ? " hide-project" : "") + (!_geoLayerVis.carrier ? " hide-carrier" : "") + (!_geoLayerVis.park ? " hide-park" : "");
    var mapStageClass = "geo-map-stage lv-" + ctx.level + " sc-" + ctx.scope + (isParkFocus ? " park-focus" : "") + (ctx.showOnlineTiles ? " tiles-on" : " tiles-off") + (useNativeBasemap ? " native-base" : "") + layerCls;
    var insight = geoInsightModel(ctx);
    var bottomExpanded = !!ctx.bottomExpanded;
    var summaryHeadHtml = geoSummaryHeadCells(ctx)
      .map(function (label) {
        return "<th>" + esc(label) + "</th>";
      })
      .join("");
    var insightHtml =
      '<div class="geo-insight-grid"><article class="geo-insight-card primary"><span class="geo-insight-kicker">EXECUTIVE SUMMARY</span><h3 class="geo-insight-title">当前区域总览</h3><p class="geo-insight-summary">' +
      esc(insight.summary) +
      '</p><div class="geo-insight-stats"><div class="geo-insight-stat"><span>当前指标</span><b>' +
      esc(insight.focusMetric) +
      '</b></div><div class="geo-insight-stat"><span>焦点行业</span><b>' +
      esc(geoShortName(insight.focusIndustry, 16)) +
      '</b></div><div class="geo-insight-stat"><span>覆盖企业</span><b>' +
      esc(String(insight.marketCount) + " 家") +
      '</b></div><div class="geo-insight-stat"><span>园区范围</span><b>' +
      esc(String(insight.parkCount) + " 家") +
      '</b></div><div class="geo-insight-stat"><span>载体范围</span><b>' +
      esc(String(insight.carrierCount) + " 家") +
      '</b></div><div class="geo-insight-stat"><span>当前焦点</span><b>' +
      esc(geoShortName(insight.focusName, 14)) +
      '</b></div></div><div class="geo-insight-block"><h4>重点发现</h4><ul class="geo-insight-list">' +
      insight.evidence
        .map(function (line) {
          return "<li>" + esc(line) + "</li>";
        })
        .join("") +
      '</ul></div><div class="geo-insight-block"><h4>建议动作</h4><ul class="geo-insight-list action">' +
      insight.actions
        .map(function (line) {
          return "<li>" + esc(line) + "</li>";
        })
        .join("") +
      '</ul></div></article><article class="geo-insight-card"><span class="geo-insight-kicker">DATA GOVERNANCE</span><h3 class="geo-insight-title">数据源与口径</h3><p class="geo-insight-summary">当前 Demo 已采集演示数据，给客户展示时可以选择展示哪些信息、不展示哪些口径，正式项目可替换为业务数据。</p><div class="geo-insight-block"><h4>数据源</h4><ul class="geo-insight-list source">' +
      insight.sources
        .map(function (line) {
          return "<li>" + esc(line) + "</li>";
        })
        .join("") +
      '</ul></div><div class="geo-caliber-note"><span>当前指标口径</span><p>' +
      esc(insight.caliber) +
      "</p></div></article></div>";
    var headStatsHtml = [
      { label: "当前指标", value: aiMetricName(ctx.metric), note: insight.focusMetric },
      { label: "覆盖企业", value: String(insight.marketCount) + " 家", note: geoMarketLabel(ctx.market) },
      { label: "重点园区", value: String(insight.parkCount) + " 个", note: ctx.scope === "park" ? "当前聚焦中" : "全部园区范围" }
    ]
      .map(function (item) {
        return (
          '<div class="geo-head-stat"><span>' +
          esc(item.label) +
          '</span><b>' +
          esc(item.value) +
          '</b><em>' +
          esc(item.note) +
          "</em></div>"
        );
      })
      .join("");
    var investPool = ctx.scope === "park"
      ? (ctx.parkMode === "all" ? ctx.parksInDistrict.slice() : [ctx.park].filter(Boolean))
      : ctx.level === "district"
        ? ctx.streetsInDistrict.slice()
        : [ctx.street].filter(Boolean);
    var investLeadTotal = investPool.reduce(function (sum, item) {
      return sum + Number((item && item.invest_leads) || 0);
    }, 0);
    var boardBuildings = ctx.buildings.filter(function (b) {
      if (ctx.scope === "park" && ctx.parkMode !== "all" && ctx.pid) return b.park_id === ctx.pid;
      if (ctx.scope === "park" && ctx.parkMode === "all") return ctx.parksInDistrict.some(function (p) { return p.id === b.park_id; });
      if ((ctx.level === "street" || ctx.level === "building") && ctx.sid) return b.street_id === ctx.sid;
      if (ctx.did) {
        var street = geoStreetById(b.street_id);
        return !!street && street.district_id === ctx.did;
      }
      return true;
    });
    var avgOcc = boardBuildings.length
      ? boardBuildings.reduce(function (sum, item) {
          return sum + Number(item.occupied_rate || 0);
        }, 0) / boardBuildings.length
      : 0;
    var topObjects = aiTopItemLines(ctx, 2);
    var lowObjects = aiBottomItemLines(ctx, 1);
    var dataBoardHtml =
      '<section class="geo-data-board"><div class="geo-board-head"><div><span class="geo-board-kicker">DATA BOARD</span><h3>区域经济数据看板</h3></div><p>围绕当前区域，自动汇总市场主体、重点园区、载体、入驻率等核心指标，在地图与前端并行呈现数据全貌。</p></div><div class="geo-board-grid">' +
      [
        { label: "当前区域", value: insight.focusName, note: aiSceneScopeText(ctx) },
        { label: "核心指标", value: insight.focusMetric, note: aiMetricName(ctx.metric) },
        { label: "重点行业", value: geoShortName(insight.focusIndustry, 16), note: geoMarketLabel(ctx.market) + " / " + String(insight.marketCount) + " 家" },
        { label: "招商线索", value: String(investLeadTotal) + " 条", note: geoShortName(insight.focusIndustry, 16) },
        { label: "平均入驻率", value: boardBuildings.length ? pct(avgOcc, 1) : "暂无", note: String(boardBuildings.length) + " 栋载体" },
        { label: "重点街道", value: geoShortName(topObjects[0] || "暂无", 16), note: geoShortName(lowObjects[0] || "暂无数据做远端对比", 20) },
      ]
        .map(function (item, idx) {
          return (
            '<article class="geo-board-card' +
            (idx === 0 ? " primary" : "") +
            '"><span>' +
            esc(item.label) +
            '</span><b>' +
            esc(item.value) +
            '</b><em>' +
            esc(item.note) +
            "</em></article>"
          );
        })
        .join("") +
      "</div></section>";
    var bottomPanelHtml =
      '<section class="geo-bottom-drawer' +
      (bottomExpanded ? " expanded" : " collapsed") +
      '"><button class="geo-bottom-toggle" data-action="geo_toggle_bottom"><span class="geo-bottom-toggle-main"><b>' +
      (bottomExpanded ? "收起区域摘要" : "展开区域摘要") +
      '</b><em>' +
      esc(insight.summary) +
      '</em></span><span class="geo-bottom-toggle-meta">' +
      esc(insight.focusMetric) +
      " / " +
      esc(String(insight.marketCount) + " 家") +
      " / " +
      esc(String(insight.parkCount) + " 个园区") +
      '</span></button>' +
      (bottomExpanded
        ? insightHtml +
          '<div class="geo-map-table"><table><thead><tr>' +
          summaryHeadHtml +
          "</tr></thead><tbody>" +
          (geoSummaryRows(ctx) || '<tr><td colspan="8" class="muted">暂无可展示的汇总数据</td></tr>') +
          "</tbody></table></div>"
        : "") +
      "</section>";

    return (
      '<section class="geo-map-wrap">' +
      dataBoardHtml +
      '<div class="geo-map-head"><div class="geo-map-head-main"><div><div class="geo-map-title">' +
      esc(topLabel) +
      "</div>" +
      geoBreadcrumb(ctx) +
      '</div><div class="geo-map-overview">' +
      headStatsHtml +
      '</div></div><div class="geo-map-meta"><span class="geo-pill metric-pill" style="--metric-pill-bg:' +
      metricVisual.accentSoft +
      ";--metric-pill-border:" +
      metricVisual.accentBorder +
      ";--metric-pill-ink:" +
      metricVisual.accentText +
      '">图层：' +
      esc(metricPillLabel) +
      '</span><span class="geo-pill">对象：' +
      esc(areaLabel) +
      '</span>' +
      (ctx.chain ? '<span class="geo-pill">产业链：' + esc(ctx.chain) + '</span>' : '') +
      '<span class="geo-pill">底图：' +
      esc(mapBaseLabel) +
      "</span></div></div>" +
      '<div class="' + esc(mapStageClass) + '" data-role="geo-stage" style="--metric-accent:' +
      metricVisual.accent +
      ";--metric-accent-soft:" +
      metricVisual.accentSoft +
      ";--geo-label-scale:" +
      labelScale +
      ";--geo-icon-scale:" +
      iconScale +
      ";--geo-entity-scale:" +
      entityScale +
      ";--geo-road-label-scale:" +
      roadLabelScale +
      ";--geo-boundary-label-scale:" +
      boundaryLabelScale +
      ";--geo-mesh-label-scale:" +
      meshLabelScale +
      ";--geo-heat-label-scale:" +
      heatLabelScale +
      ";--geo-poi-card-scale:" +
      poiCardScale +
      '">' +
      '<div class="geo-map-viewport" data-role="geo-viewport" role="application" aria-label="产业地图 — 可拖拽缩放" tabindex="0">' +
      '<div class="geo-native-map-layer" data-role="geo-native-map" data-enabled="' + (useNativeBasemap ? "1" : "0") + '" data-provider="' + esc(ctx.onlineTileProvider) + '"><div class="geo-native-map-host" data-role="geo-native-map-host"></div><div class="geo-native-map-status" data-role="geo-native-map-status" hidden></div></div>' +
      '<div class="geo-online-tile-layer" data-role="geo-online-tiles" data-enabled="' + (ctx.showOnlineTiles && !useNativeBasemap ? "1" : "0") + '" data-provider="' + esc(ctx.onlineTileProvider) + '"></div>' +
      '<div class="geo-terrain-tile-layer" data-role="geo-terrain-tiles"' + cityClipStyle + '></div>' +
      '<div class="geo-map-canvas" data-role="geo-canvas"><div class="geo-city-clip"' + cityClipStyle + '>' +
      '<div class="geo-terrain-layer"></div>' +
      '<div class="geo-grid-layer"></div>' +
      backdropHtml +
      focusDimHtml +
      parkSkinHtml +
      geoBoundaryLayer(Object.assign({}, ctx, { fastRender: fastRender })) +
      "</div></div>" +
      '<div class="geo-icon-overlay" data-role="geo-icon-overlay">' +
      heatHtml +
      parkPoiHtml +
      marketHtml +
      projectHtml +
      carrierHtml +
      "</div></div>" +
      '<div class="geo-map-controls" role="group" aria-label="地图缩放控制"><button data-action="geo_zoom_in" title="放大" aria-label="放大地图">+</button><button data-action="geo_zoom_out" title="缩小" aria-label="缩小地图">-</button><button data-action="geo_zoom_reset" title="重置" aria-label="重置视图">◎</button><button data-action="geo_fullscreen" title="全屏" aria-label="全屏" class="geo-fullscreen-btn">⛶</button></div>' +
      '<div class="geo-zoom-badge" data-role="geo-zoom-badge" aria-live="polite">缩放 x 1.00</div>' +
      '<div class="geo-map-scale" data-role="geo-scale"><div class="geo-scale-bar" style="width:80px"></div><span class="geo-scale-label">100 m</span></div>' +
      '<div class="geo-map-legend">' +
      '<label class="geo-legend-toggle' + (_geoLayerVis.heat ? ' on' : '') + '"><input type="checkbox" data-role="geo-layer-toggle" data-layer="heat"' + (_geoLayerVis.heat ? ' checked' : '') + '><i class="l1"></i>' + esc(metricLegendLabel) + '</label>' +
      '<label class="geo-legend-toggle' + (_geoLayerVis.ent_mfg ? ' on' : '') + '"><input type="checkbox" data-role="geo-layer-toggle" data-layer="ent_mfg"' + (_geoLayerVis.ent_mfg ? ' checked' : '') + '><i class="l2 lc-mfg"></i>智能制造</label>' +
      '<label class="geo-legend-toggle' + (_geoLayerVis.ent_bio ? ' on' : '') + '"><input type="checkbox" data-role="geo-layer-toggle" data-layer="ent_bio"' + (_geoLayerVis.ent_bio ? ' checked' : '') + '><i class="l2 lc-bio"></i>生物医药</label>' +
      '<label class="geo-legend-toggle' + (_geoLayerVis.ent_biz ? ' on' : '') + '"><input type="checkbox" data-role="geo-layer-toggle" data-layer="ent_biz"' + (_geoLayerVis.ent_biz ? ' checked' : '') + '><i class="l2 lc-biz"></i>现代商贸</label>' +
      '<label class="geo-legend-toggle' + (_geoLayerVis.ent_srv ? ' on' : '') + '"><input type="checkbox" data-role="geo-layer-toggle" data-layer="ent_srv"' + (_geoLayerVis.ent_srv ? ' checked' : '') + '><i class="l2 lc-srv"></i>创新服务</label>' +
      '<label class="geo-legend-toggle' + (_geoLayerVis.project ? ' on' : '') + '"><input type="checkbox" data-role="geo-layer-toggle" data-layer="project"' + (_geoLayerVis.project ? ' checked' : '') + '><i class="l3"></i>重点项目</label>' +
      '<label class="geo-legend-toggle' + (_geoLayerVis.carrier ? ' on' : '') + '"><input type="checkbox" data-role="geo-layer-toggle" data-layer="carrier"' + (_geoLayerVis.carrier ? ' checked' : '') + '><i class="l4"></i>产业载体</label>' +
      '<label class="geo-legend-toggle' + (_geoLayerVis.park ? ' on' : '') + '"><input type="checkbox" data-role="geo-layer-toggle" data-layer="park"' + (_geoLayerVis.park ? ' checked' : '') + '><i class="l5"></i>重点园区</label>' +
      '</div>' +
      "</div>" +
      bottomPanelHtml +
      "</section>"
    );
  }

  function geoTopbar(ctx) {
    var aiHref = geoAnalysisHash(ctx);
    return (
      '<header class="geo-topbar">' +
      '<div class="geo-top-left"><div class="geo-brand with-icon"><span class="topbar-brand-icon">' +
      uiIcon("geo", "brand-icon") +
      '</span><span>' +
      esc(geoSystemName(ctx)) +
      '</span></div></div>' +
      '<div class="geo-top-right"><div class="geo-search"><input data-role="global-search" placeholder="搜索街道、园区、楼宇或企业..." value="' +
      esc(ctx.q) +
      '" /><button class="geo-search-btn" data-action="geo_submit_search">搜索</button></div>' +
      '<a class="geo-link with-icon" href="#/gov/home">' +
      uiIcon("home", "link-icon") +
      '<span>返回平台首页</span></a>' +
      "</div></header>"
    );
  }

  function pageGovGeoWorkspace(rt, path) {
    var ctx = geoContext(rt, path);
    var gd = geoData();
    var insight = geoInsightModel(ctx);
    var investPool = ctx.scope === "park"
      ? (ctx.parkMode === "all" ? ctx.parksInDistrict.slice() : [ctx.park].filter(Boolean))
      : ctx.level === "district"
        ? ctx.streetsInDistrict.slice()
        : [ctx.street].filter(Boolean);
    var investLeadTotal = investPool.reduce(function (sum, item) {
      return sum + Number((item && item.invest_leads) || 0);
    }, 0);
    var boardBuildings = ctx.buildings.filter(function (b) {
      if (ctx.scope === "park" && ctx.parkMode !== "all" && ctx.pid) return b.park_id === ctx.pid;
      if (ctx.scope === "park" && ctx.parkMode === "all") return ctx.parksInDistrict.some(function (p) { return p.id === b.park_id; });
      if ((ctx.level === "street" || ctx.level === "building") && ctx.sid) return b.street_id === ctx.sid;
      if (ctx.did) {
        var street = geoStreetById(b.street_id);
        return !!street && street.district_id === ctx.did;
      }
      return true;
    });
    var avgOcc = boardBuildings.length
      ? boardBuildings.reduce(function (sum, item) {
          return sum + Number(item.occupied_rate || 0);
        }, 0) / boardBuildings.length
      : 0;
    var areaLabel = ctx.scope === "park"
      ? ((ctx.park && ctx.park.name) || (ctx.parkMode === "all" ? "全部园区" : "园区"))
      : ctx.level === "building"
        ? ((ctx.street && ctx.street.name) || "街道")
        : ctx.level === "street"
          ? ((ctx.street && ctx.street.name) || "街道")
          : ((ctx.district && ctx.district.name) || "全区");
    var topObjects = aiTopItemLines(ctx, 2);
    var lowObjects = aiBottomItemLines(ctx, 1);
    var statCards = [
      { label: "当前区域", value: areaLabel, icon: "geo" },
      { label: "重点企业", value: String(insight.marketCount) + " 家", icon: "enterprise" },
      { label: "重点园区", value: String(insight.parkCount) + " 个", icon: "park" },
      { label: "招商线索", value: String(investLeadTotal) + " 条", icon: "invest" },
      { label: "平均入驻率", value: boardBuildings.length ? pct(avgOcc, 1) : "--", icon: "enterprise" },
      { label: "重点街道", value: geoShortName(topObjects[0] || "暂无", 10), icon: "geo" },
    ];
    var statsHtml = statCards.map(function (item) {
      return '<div class="geo-float-stat"><span class="geo-float-stat-icon">' + uiIcon(item.icon, "geo-float-stat-glyph") + '</span><div><span class="geo-float-stat-label">' + esc(item.label) + '</span><b class="geo-float-stat-value">' + esc(item.value) + '</b></div></div>';
    }).join("");
    var categoryBtns = [
      { id: "revenue", label: "营收热力图", active: ctx.metric === "revenue" },
      { id: "output", label: "产值热力图", active: ctx.metric === "output" },
      { id: "tax", label: "税收热力图", active: ctx.metric === "tax" },
    ];
    var categoryHtml = categoryBtns.map(function (item) {
      return '<button class="geo-cat-btn' + (item.active ? " active" : "") + '" data-action="geo_switch_metric" data-metric="' + esc(item.id) + '">' + esc(item.label) + '</button>';
    }).join("");
    var levelBtns = [
      { path: "/gov/geo-district", label: "区级", active: path === "/gov/geo-district" },
      { path: "/gov/geo-street", label: "街道级", active: path === "/gov/geo-street" },
      { path: "/gov/geo-park", label: "园区级", active: path === "/gov/geo-park" },
    ];
    var levelHtml = levelBtns.map(function (item) {
      var nextQ = {};
      if (item.path === "/gov/geo-district") nextQ = geoStickyQuery(ctx, { scope: "district", sid: "", pid: "", park_mode: "" });
      else if (item.path === "/gov/geo-street") nextQ = geoStickyQuery(ctx, { scope: "street", sid: "", pid: "", park_mode: "" });
      else if (item.path === "/gov/geo-park") nextQ = geoStickyQuery(ctx, { scope: "park", sid: "", pid: "", park_mode: "all" });
      return '<a class="geo-cat-btn' + (item.active ? " active" : "") + '" href="' + buildHash(item.path, nextQ) + '">' + esc(item.label) + '</a>';
    }).join("");
    return '<div class="geo-root">' + geoTopbar(ctx) +
      '<div class="geo-layout">' + geoMap(ctx) + geoPanel(ctx) +
      '<aside class="geo-float-stats">' + statsHtml + '</aside>' +
      '<div class="geo-cat-bar"><div class="geo-cat-group"><span class="geo-cat-label">指标</span>' + categoryHtml + '</div><div class="geo-cat-group"><span class="geo-cat-label">层级</span>' + levelHtml + '</div></div>' +
      "</div></div>";
  }

  function pageGovGeoOverview(rt) {
    return pageGovGeoWorkspace(rt || route(), "/gov/geo-street");
  }

  function pageGovGeoDistrict(rt) {
    return pageGovGeoWorkspace(rt || route(), "/gov/geo-district");
  }

  function pageGovGeoStreet(rt) {
    return pageGovGeoWorkspace(rt || route(), "/gov/geo-street");
  }

  function pageGovGeoPark(rt) {
    return pageGovGeoWorkspace(rt || route(), "/gov/geo-park");
  }

  function pageGovGeoBuilding(rt) {
    return pageGovGeoWorkspace(rt || route(), ((rt && rt.q && rt.q.scope) === "park") ? "/gov/geo-park" : "/gov/geo-street");
  }

  function pageGovHome() {
    var gd = geoData();
    var demoDistricts = govDemoGeoItems(gd.districts || []);
    var demoStreets = govDemoGeoItems(gd.streets || []);
    var demoParks = govDemoGeoItems(gd.parks || []);
    var demoEnterprises = govDemoEnterprises();
    var demoAlerts = govDemoAlerts();
    var entCount = demoEnterprises.length;
    var districtCount = demoDistricts.length;
    var parkCount = demoParks.length;
    var streetCount = demoStreets.length;
    var realMeta = qingyangRealMeta();
    var realEnterpriseCount = Number(realMeta.enterprise_count || 0);
    var realDocCount = Number(realMeta.document_count || 0);
    var latestAnnual = qingyangLatestAnnualStat();
    var latestAnnualLabel = latestAnnual && latestAnnual.year ? String(latestAnnual.year) + "年" : "已接入";
    var latestGdp = latestAnnual && latestAnnual.gdp_billion ? latestAnnual.gdp_billion + "亿元" : "--";
    var latestTertiary = latestAnnual && latestAnnual.tertiary_billion ? latestAnnual.tertiary_billion + "亿元" : "--";
    var latestIndustrial = latestAnnual && latestAnnual.industrial_billion ? latestAnnual.industrial_billion + "亿元" : "--";
    var latestFixedAsset = latestAnnual && latestAnnual.fixed_asset_growth_pct ? latestAnnual.fixed_asset_growth_pct + "%" : "--";
    var latestBudget = latestAnnual && latestAnnual.public_budget_billion ? latestAnnual.public_budget_billion + "亿元" : "--";
    var investmentLeadCount = demoStreets.reduce(function (sum, item) {
      return sum + Number(item.invest_leads || 0);
    }, 0) + demoParks.reduce(function (sum, item) {
      return sum + Number(item.invest_leads || 0);
    }, 0);
    var alertCount = demoAlerts.filter(function (item) {
      return alertStatus(item.id) !== "已关闭";
    }).length;

    var cards = [
      {
        icon: "geo",
        code: "SYS-01",
        title: "区域经济研判专题",
        status: "已上线",
        desc: "面向区级、街道、园区分层场景的区域经济动态分析工作台，支持热力研判、载体识别与空间承接分析。",
        tags: ["区域热力", "空间下钻", "承载分析"],
        features: ["区级至园区分层联动浏览", "重点企业、园区、项目热力分析", "招商线索与楼宇详情一图联动"],
        note: "适合做区域经济分析和空间招商汇报。",
        cta: '<a class="btn primary" href="#/gov/geo-district">进入专题</a>',
      },
      {
        icon: "chain",
        code: "SYS-02",
        title: "产业链式图谱专题",
        status: "已上线",
        desc: "围绕主导产业链展示链条结构、重点环节、薄弱节点和补链方向，支持节点企业映射与招商研判。",
        tags: ["链路图谱", "薄弱识别", "补链建议"],
        features: ["父子节点企业继承匹配", "节点详细介绍与企业弹窗", "薄弱环节识别与招商建议"],
        note: "适合做补链强链和产业招商研判。",
        cta: '<a class="btn primary" href="#/gov/chain">进入专题</a>',
      },
      {
        icon: "invest",
        code: "SYS-03",
        title: "招商研判专题",
        status: "已上线",
        desc: "统一串联 GIS 招商热力、产业链补链判断、载体承接能力和风险协同信息，形成独立招商工作入口。",
        tags: ["招商专题", "补链招商", "承载评估"],
        features: ["街道与园区招商线索汇总", "主导产业补链入口直达", "迁出预警与招商协同联动"],
        note: "首页独立入口，不占左侧导航位置。",
        cta: '<a class="btn primary" href="#/gov/investment-analysis">进入专题</a>',
      },
      {
        icon: "policy",
        code: "SYS-04",
        title: "政策智能匹配专题",
        status: "已上线",
        desc: "基于企业画像与政策条目的智能匹配引擎，支持企业精准找政策、政策精准找企业、一键推送。",
        tags: ["政策匹配", "精准推送", "智能引擎"],
        features: ["企业找政策与政策找企业双入口", "政策级联筛选与企业分页清单", "联系方式、详情与推送联动"],
        note: "适合政策研究、兑现和推送服务场景。",
        cta: '<a class="btn primary" href="#/gov/policy-match">进入专题</a>',
      },
      {
        icon: "enterprise",
        code: "SYS-05",
        title: "企业画像分析专题",
        status: "已上线",
        desc: "基于多维指标体系的企业全景画像，支持按当地产业类别、行业分类、空间载体等维度精准筛选企业。",
        tags: ["精准画像", "多维筛选", "空间载体"],
        features: ["当地产业类别、行业、载体组合筛选", "区-街道-园区联动选择", "企业档案与楼宇详情联动查看"],
        note: "适合做企业服务和对象清单梳理。",
        cta: '<a class="btn primary" href="#/gov/portrait">进入专题</a>',
      },
      {
        icon: "alert",
        code: "SYS-06",
        title: "企业迁出预警专题",
        status: "已上线",
        desc: "围绕迁出风险识别、企业名单筛选、风险等级分层和跟进处置构建的稳企留商专题页面。",
        tags: ["迁出预警", "风险分层", "稳企留商"],
        features: ["预警企业总览与等级分层", "按街道和行业筛选预警企业", "企业画像联动与专报导出"],
        note: "适合区级稳企留商和重点企业迁出风险研判。",
        cta: '<a class="btn primary" href="#/gov/enterprise-exit">进入专题</a>',
      },
      {
        icon: "project",
        code: "SYS-07",
        title: "重点项目调度专题",
        status: "已上线",
        desc: "围绕重点项目总览、项目目录、推进追踪和预警协调构建项目管理专题页面，适合领导看项目、部门抓推进。",
        tags: ["项目总览", "进度追踪", "预警调度"],
        features: ["重点项目总览与地图位置展示", "项目目录筛选与详情联动", "项目预警和年度推进情况跟踪"],
        note: "适合做重点项目汇报和调度演示。",
        cta: '<a class="btn primary" href="#/gov/key-projects">进入专题</a>',
      },
      {
        icon: "decision",
        code: "SYS-08",
        title: "领导决策支撑专题",
        status: "已上线",
        desc: "围绕领导讲话、会议纪要和专题内容进行筛选、分析和汇总，形成决策支撑数据专题页。",
        tags: ["讲话研判", "会议研判", "专题支撑"],
        features: ["领导讲话和会议列表筛选", "关键词模糊检索与分类浏览", "文档分析统计与专题摘要"],
        note: "适合做决策支撑和会议纪要展示。",
        cta: '<a class="btn primary" href="#/gov/decision-data">进入专题</a>',
      },
      {
        icon: "dashboard",
        code: "SYS-09",
        title: "经济目标考核专题",
        status: "已上线",
        desc: "围绕重点经济目标、完成率趋势、区域/部门对比和预警指标清单形成年度目标考核专题页。",
        tags: ["目标考核", "完成率趋势", "区域对比"],
        features: ["经济指标总览与达标率汇总", "区域/部门维度对比分析", "优秀指标与预警指标分层展示"],
        note: "适合做年度目标考核分析和分主体对比汇报。",
        cta: '<a class="btn primary" href="#/gov/economic-targets">进入专题</a>',
      },
      {
        icon: "report",
        code: "SYS-10",
        title: "政府统计数据专题",
        status: "已上线",
        desc: "围绕统计公报、统计年鉴和宏观趋势分析形成的统计资料与专题分析工作台。",
        tags: ["统计公报", "统计年鉴", "趋势分析"],
        features: ["指标趋势与预测分析", "年鉴/年报资料分栏展示", "自定义统计分析与导出"],
        note: "适合做年度统计汇报和专题数据支撑。",
        cta: '<a class="btn primary" href="#/gov/government-stats">进入专题</a>',
      },
    ];

    var overviewCards = [
      { label: "辖区企业", icon: "enterprise", value: String(entCount), unit: "家", note: "含规上与重点企业" },
      { label: "地区生产总值", icon: "dashboard", value: String(latestAnnual && latestAnnual.gdp_billion ? latestAnnual.gdp_billion : "--"), unit: "亿元", note: latestAnnualLabel + "地区生产总值" },
      { label: "第三产业增加值", icon: "chain", value: String(latestAnnual && latestAnnual.tertiary_billion ? latestAnnual.tertiary_billion : "--"), unit: "亿元", note: latestAnnualLabel + "服务业主导表现" },
      { label: "固定资产投资增速", icon: "project", value: String(latestAnnual && latestAnnual.fixed_asset_growth_pct ? latestAnnual.fixed_asset_growth_pct : "--"), unit: "%", note: latestAnnualLabel + "固定资产投资增速" },
      { label: "真实企业库", icon: "enterprise", value: String(realEnterpriseCount || entCount), unit: "家", note: "青羊区高成长企业库" },
      { label: "统计资料库", icon: "decision", value: String(realDocCount), unit: "份", note: latestAnnualLabel + "公报/年鉴已接入" },
    ];

    var heroStats = [
      { label: "辖区企业总数", value: String(realEnterpriseCount || entCount) },
      { label: latestAnnualLabel + "GDP", value: latestAnnual && latestAnnual.gdp_billion ? latestAnnual.gdp_billion + "亿元" : "--" },
      { label: latestAnnualLabel + "一般公共预算", value: latestAnnual && latestAnnual.public_budget_billion ? latestAnnual.public_budget_billion + "亿元" : "--" },
      { label: "统计资料", value: String(realDocCount) },
    ];

    var quickLinks = [
      { href: "#/gov/geo-district", icon: "geo", title: "区域经济研判", desc: "区域经济热力与密度分析" },
      { href: "#/gov/chain", icon: "chain", title: "产业链式图谱", desc: "链路图谱与短板识别" },
      { href: "#/gov/key-projects", icon: "project", title: "重点项目调度", desc: "项目总览、预警与推进追踪" },
      { href: "#/gov/decision-data", icon: "decision", title: "领导决策支撑", desc: "讲话、会议与专题信息分析" },
      { href: "#/gov/investment-analysis", icon: "invest", title: "招商研判专题", desc: "招商线索与补链建议联动" },
      { href: "#/gov/enterprise-exit", icon: "alert", title: "企业迁出预警", desc: "迁出风险分层与稳企处置" },
      { href: "#/gov/economic-targets", icon: "dashboard", title: "经济目标考核", desc: "年度指标达标率与区域对比" },
      { href: "#/gov/government-stats", icon: "report", title: "政府统计数据", desc: "统计公报、年鉴与趋势分析" },
    ];

    var featureUpdatedAt = today();

    var featuredEntrances = [
      {
        href: "#/gov/investment-analysis",
        icon: "invest",
        kicker: "INVEST",
        title: "招商研判入口",
        desc: "单独进入招商专题页，统一查看区域招商热力、补链方向、承载园区和稳企协同信息。",
        tags: ["GIS 热力", "补链研判", "承载评估"],
        metric: { value: String(investmentLeadCount), label: "招商线索" },
        meta: [
          "最近更新：" + featureUpdatedAt,
          "默认进入：招商研判首页"
        ]
      },
      {
        href: "#/gov/key-projects",
        icon: "project",
        kicker: "PROJECT",
        title: "重点项目调度入口",
        desc: "直接进入重点项目专题，查看项目总览、项目目录、推进跟踪和预警信息，适合做重点项目专题汇报。",
        tags: ["项目总览", "推进跟踪", "预警调度"],
        metric: { value: String(cards.filter(function (item) { return item.code === "SYS-07"; }).length ? keyProjectSummary(keyProjectData()).count : 0), label: "重点项目" },
        meta: [
          "最近更新：" + featureUpdatedAt,
          "默认进入：重点项目总览页"
        ]
      },
      {
        href: "#/gov/decision-data",
        icon: "decision",
        kicker: "DECISION",
        title: "领导决策支撑入口",
        desc: "直接进入讲话与会议研判专题，查看领导讲话、会议资料和文档统计，不放入左侧导航。",
        tags: ["讲话研判", "会议研判", "专题摘要"],
        metric: { value: String(govDemoDecisionRecords(decisionSpeechSeed()).length + govDemoDecisionRecords(decisionMeetingSeed()).length), label: "决策文档" },
        meta: [
          "最近更新：" + featureUpdatedAt,
          "默认进入：讲话/会议研判页"
        ]
      },
      {
        href: "#/gov/enterprise-exit",
        icon: "alert",
        kicker: "ALERT",
        title: "企业迁出预警入口",
        desc: "直接进入企业迁出预警专题，查看风险企业、等级分层、跟进清单和稳企处置建议。",
        tags: ["迁出风险", "等级分层", "跟进闭环"],
        metric: { value: String(alertCount), label: "预警事项" },
        meta: [
          "最近更新：" + featureUpdatedAt,
          "默认进入：迁出预警列表"
        ]
      },
      {
        href: "#/gov/economic-targets",
        icon: "dashboard",
        kicker: "TARGET",
        title: "经济目标考核入口",
        desc: "直接进入经济目标考核专题，查看年度指标完成率、区域/部门对比和预警指标分布。",
        tags: ["目标考核", "主体对比", "预警指标"],
        metric: { value: String(6), label: "核心指标" },
        meta: [
          "最近更新：" + featureUpdatedAt,
          "默认进入：目标考核总览"
        ]
      },
      {
        href: "#/gov/government-stats",
        icon: "report",
        kicker: "STATS",
        title: "政府统计数据入口",
        desc: "直接进入统计数据专题，查看统计公报、统计年鉴和宏观经济趋势分析，不放入左侧导航。",
        tags: ["统计公报", "统计年鉴", "趋势分析"],
        metric: { value: String(realDocCount), label: "资料份数" },
        meta: [
          "最近更新：" + featureUpdatedAt,
          "默认进入：统计数据管理"
        ]
      }
    ];

    var positionCards = [
      { icon: "geo", title: "区域经济分析", desc: "面向区级-街道-园区分层研判的经济密度与热力分析", points: ["区级热力总览", "街道级经济密度评估", "楼宇详情联动查看"] },
      { icon: "chain", title: "产业链式图谱", desc: "围绕主导产业进行链路分析、短板识别与补链建议", points: ["产业链式全景可视", "断链短板预警", "补链招商建议"] },
      { icon: "enterprise", title: "企业服务协同", desc: "政企银三端数据协同，精准匹配融资与政策", points: ["企业画像一键查看", "融资需求精准匹配", "政策推送与反馈闭环"] },
    ];

    var sceneCards = [
      { icon: "geo", title: "招商引资分析", dept: "经济运行部门", desc: "通过 GIS 可视化发现产业聚集度与空白区，辅助招商决策", output: "招商线索清单" },
      { icon: "chain", title: "产业链补链", dept: "产业发展部门", desc: "识别产业链短板与缺失环节，定向开展补链延链工作", output: "补链企业推荐" },
      { icon: "alert", title: "企业迁出预警", dept: "营商环境部门", desc: "多维数据监控企业经营动态，提前发现迁出倾向并干预", output: "预警工单与跟进" },
      { icon: "enterprise", title: "政策精准推送", dept: "政策研究部门", desc: "语义匹配企业画像与政策条目，实现精准推送与效果追踪", output: "政策匹配报告" },
    ];

    var roadmap = [
      { phase: "P1", title: "区域经济研判专题", status: "已上线", desc: "区域经济动态分析、街道园区下钻、楼宇详情联动" },
      { phase: "P1", title: "产业链式图谱专题", status: "已上线", desc: "产业链全景、短板识别、补链建议与企业关联查询" },
      { phase: "P2", title: "企业画像分析专题", status: "已上线", desc: "多维指标体系的企业全景画像，支持按行业、政策、载体维度精准筛选" },
      { phase: "P2", title: "政策智能匹配专题", status: "已上线", desc: "企业找政策、政策找企业、智能匹配与一键推送申报" },
      { phase: "P2", title: "招商研判专题", status: "已上线", desc: "招商热力、补链判断、载体承接与风险协同的统一入口" },
      { phase: "P2", title: "重点项目调度专题", status: "已上线", desc: "项目总览、目录筛选、推进追踪和预警联动的项目专题页面" },
      { phase: "P2", title: "领导决策支撑专题", status: "已上线", desc: "领导讲话、会议资料和文档统计的一体化专题分析页面" },
      { phase: "P3", title: "企业迁出预警专题", status: "已上线", desc: "迁出风险识别、等级分层、重点企业名单与稳企留商处置联动" },
      { phase: "P3", title: "经济目标考核专题", status: "已上线", desc: "重点经济指标总览、年度目标达标率、区域/部门对比与预警指标识别" },
      { phase: "P3", title: "政府统计数据专题", status: "已上线", desc: "统计公报、统计年鉴和宏观经济趋势分析的统一专题工作台" },
    ];

    var blocks = cards
      .map(function (c) {
        var statusCls = c.status === "已上线" ? "up" : "plan";
        var tags = (c.tags || [])
          .map(function (t) {
            return '<span class="sys-module-tag">' + esc(t) + "</span>";
          })
          .join("");
        var features = (c.features || [])
          .map(function (t) {
            return "<li>" + esc(t) + "</li>";
          })
          .join("");
        var live = c.status === "已上线";
        return (
          '<article class="sys-module-card ' +
          (live ? "live" : "draft") +
          '">' +
          '<div class="sys-module-top"><div class="sys-module-head">' +
          '<span class="sys-module-icon">' +
          uiIcon(c.icon || "dashboard", "sys-module-icon-glyph") +
          '</span><div><span class="sys-module-code">' +
          esc(c.code) +
          '</span><h3 class="sys-module-title">' +
          esc(c.title) +
          '</h3></div></div><span class="sys-module-status ' +
          (live ? "up" : "plan") +
          '">' +
          esc(c.status) +
          "</span></div>" +
          '<p class="sys-module-desc">' +
          esc(c.desc) +
          '</p><div class="sys-module-tags">' +
          tags +
          '</div><ul class="sys-module-list">' +
          features +
          '</ul><div class="sys-module-foot"><span class="sys-module-note">' +
          esc(c.note) +
          '</span><div class="sys-module-actions">' +
          c.cta +
          "</div></div></article>"
        );
      })
      .join("");

    var overviewHtml = overviewCards
      .map(function (item, idx) {
        return (
          '<div class="sys-stat-card ' +
          (idx === 0 ? "accent" : "") +
          '"><div class="sys-stat-top"><span class="sys-stat-label">' +
          esc(item.label) +
          '</span><span class="sys-stat-icon">' +
          uiIcon(item.icon || "dashboard", "sys-stat-icon-glyph") +
          '</span></div><div class="sys-stat-value"><b>' +
          esc(item.value) +
          '</b><i>' +
          esc(item.unit) +
          '</i></div><p>' +
          esc(item.note) +
          "</p></div>"
        );
      })
      .join("");

    var heroStatsHtml = heroStats
      .map(function (item) {
        return '<div class="sys-hero-stat"><span>' + esc(item.label) + '</span><b>' + esc(item.value) + "</b></div>";
      })
      .join("");

    var featuredHtml = featuredEntrances
      .map(function (item) {
        var tagHtml = (item.tags || [])
          .map(function (tag) {
            return '<span class="sys-feature-tag">' + esc(tag) + "</span>";
          })
          .join("");
        var metaHtml = (item.meta || [])
          .map(function (line) {
            return '<span class="sys-feature-meta-line">' + esc(line) + "</span>";
          })
          .join("");
        return (
          '<a class="sys-feature-card" href="' +
          esc(item.href) +
          '"><div class="sys-feature-head"><div class="sys-feature-title-group"><span class="sys-feature-kicker">' +
          esc(item.kicker) +
          '</span><h3>' +
          esc(item.title) +
          '</h3></div><span class="sys-feature-icon">' +
          uiIcon(item.icon || "dashboard", "sys-feature-icon-glyph") +
          '</span></div><div class="sys-feature-metric"><b>' +
          esc((item.metric && item.metric.value) || "0") +
          '</b><span>' +
          esc((item.metric && item.metric.label) || "") +
          '</span></div><p>' +
          esc(item.desc) +
          '</p><div class="sys-feature-meta">' +
          metaHtml +
          '</div><div class="sys-feature-tags">' +
          tagHtml +
          '</div><span class="sys-feature-link">进入专题</span></a>'
        );
      })
      .join("");

    var quickHtml = quickLinks
      .map(function (item) {
        return (
          '<a class="sys-quick-tile" href="' +
          esc(item.href) +
          '"><div class="sys-quick-head"><span class="sys-quick-icon">' +
          uiIcon(item.icon || "dashboard", "sys-quick-icon-glyph") +
          '</span><strong>' +
          esc(item.title) +
          '</strong></div><p>' +
          esc(item.desc) +
          '</p><span>进入专题</span></a>'
        );
      })
      .join("");

    var positionHtml = positionCards
      .map(function (item) {
        return (
          '<article class="sys-position-card"><div class="sys-position-head"><span class="sys-position-icon">' +
          uiIcon(item.icon || "dashboard", "sys-position-icon-glyph") +
          '</span><div><h3>' +
          esc(item.title) +
          '</h3><p>' +
          esc(item.desc) +
          '</p></div></div><ul class="sys-position-list">' +
          (item.points || [])
            .map(function (line) {
              return "<li>" + esc(line) + "</li>";
            })
            .join("") +
          "</ul></article>"
        );
      })
      .join("");

    var sceneHtml = sceneCards
      .map(function (item) {
        return (
          '<article class="sys-scene-card"><div class="sys-scene-top"><span class="sys-scene-icon">' +
          uiIcon(item.icon || "dashboard", "sys-scene-icon-glyph") +
          '</span><div><h3>' +
          esc(item.title) +
          '</h3><span class="sys-scene-meta">' +
          esc(item.dept) +
          '</span></div></div><p>' +
          esc(item.desc) +
          '</p><strong class="sys-scene-output">' +
          esc(item.output) +
          "</strong></article>"
        );
      })
      .join("");

    var roadmapHtml = roadmap
      .map(function (item) {
        return (
          "<li><span class=\"sys-roadmap-phase\">" +
          esc(item.phase) +
          "</span><div><div class=\"sys-roadmap-title\"><strong>" +
          esc(item.title) +
          "</strong><em>" +
          esc(item.status) +
          "</em></div><p>" +
          esc(item.desc) +
          "</p></div></li>"
        );
      })
      .join("");

    /* ── Portal card definitions ── */
    var portalLeft = [
      { title: "经济目标考核", href: "#/gov/economic-targets", desc: "实现区域经济目标完成情况的实时跟踪与考核评估", color: "#2670b8", gradient: "linear-gradient(135deg,#0f2942 0%,#1b5a9e 60%,#2670b8 100%)",
        svg: '<rect x="5" y="8" width="90" height="48" rx="3" fill="rgba(255,255,255,0.06)"/><line x1="15" y1="48" x2="15" y2="20" stroke="rgba(255,255,255,0.25)" stroke-width="6" stroke-linecap="round"/><line x1="30" y1="48" x2="30" y2="28" stroke="rgba(255,255,255,0.2)" stroke-width="6" stroke-linecap="round"/><line x1="45" y1="48" x2="45" y2="15" stroke="rgba(255,255,255,0.3)" stroke-width="6" stroke-linecap="round"/><line x1="60" y1="48" x2="60" y2="32" stroke="rgba(255,255,255,0.18)" stroke-width="6" stroke-linecap="round"/><line x1="75" y1="48" x2="75" y2="22" stroke="rgba(255,255,255,0.22)" stroke-width="6" stroke-linecap="round"/><line x1="10" y1="25" x2="85" y2="25" stroke="rgba(255,255,255,0.08)" stroke-width="0.5" stroke-dasharray="3 3"/><polyline points="15,18 30,26 45,13 60,30 75,20" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/><circle cx="45" cy="13" r="2.5" fill="rgba(255,255,255,0.5)"/>' },
      { title: "企业画像分析", href: "#/gov/portrait", desc: "整合企业多维数据，构建全面企业画像，支持精准施策", color: "#2670b8", gradient: "linear-gradient(135deg,#183553 0%,#254768 50%,#1b789f 100%)",
        svg: '<rect x="8" y="6" width="35" height="24" rx="2" fill="rgba(255,255,255,0.08)"/><rect x="10" y="8" width="10" height="10" rx="5" fill="rgba(255,255,255,0.15)"/><rect x="22" y="9" width="18" height="2" rx="1" fill="rgba(255,255,255,0.2)"/><rect x="22" y="13" width="12" height="2" rx="1" fill="rgba(255,255,255,0.12)"/><rect x="10" y="21" width="30" height="2" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="10" y="25" width="20" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="55" y="6" width="38" height="24" rx="2" fill="rgba(255,255,255,0.06)"/><circle cx="65" cy="18" r="8" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="4" stroke-dasharray="32 20"/><text x="62" y="21" font-size="7" fill="rgba(255,255,255,0.25)">85</text><rect x="78" y="10" width="3" height="16" rx="1" fill="rgba(255,255,255,0.12)"/><rect x="83" y="14" width="3" height="12" rx="1" fill="rgba(255,255,255,0.18)"/><rect x="88" y="8" width="3" height="18" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="8" y="34" width="84" height="20" rx="2" fill="rgba(255,255,255,0.05)"/><rect x="12" y="37" width="14" height="3" rx="1" fill="rgba(255,255,255,0.15)"/><rect x="12" y="42" width="25" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="12" y="46" width="18" height="2" rx="1" fill="rgba(255,255,255,0.06)"/><rect x="42" y="37" width="14" height="3" rx="1" fill="rgba(255,255,255,0.12)"/><rect x="42" y="42" width="20" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="72" y="37" width="14" height="3" rx="1" fill="rgba(255,255,255,0.15)"/><rect x="72" y="42" width="16" height="2" rx="1" fill="rgba(255,255,255,0.08)"/>' },
      { title: "政策智能匹配", href: "#/gov/policy-match", desc: "智能匹配企业与适用政策，提高政策落实效率", color: "#2670b8", gradient: "linear-gradient(135deg,#1a3a5c 0%,#2670b8 50%,#4a9ad0 100%)",
        svg: '<rect x="5" y="5" width="42" height="50" rx="3" fill="rgba(255,255,255,0.08)"/><rect x="10" y="10" width="20" height="3" rx="1" fill="rgba(255,255,255,0.25)"/><rect x="10" y="16" width="32" height="2" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="10" y="20" width="28" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="10" y="24" width="32" height="2" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="10" y="28" width="22" height="2" rx="1" fill="rgba(255,255,255,0.07)"/><rect x="10" y="34" width="12" height="5" rx="2" fill="rgba(255,255,255,0.15)"/><rect x="25" y="34" width="12" height="5" rx="2" fill="rgba(255,255,255,0.12)"/><line x1="50" y1="20" x2="50" y2="40" stroke="rgba(255,255,255,0.08)" stroke-width="0.5" stroke-dasharray="2 2"/><path d="M47,25 C50,22 53,22 56,25" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/><path d="M47,35 C50,32 53,32 56,35" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/><rect x="55" y="5" width="42" height="50" rx="3" fill="rgba(255,255,255,0.06)"/><circle cx="66" cy="15" r="5" fill="rgba(255,255,255,0.1)"/><rect x="74" y="12" width="18" height="2.5" rx="1" fill="rgba(255,255,255,0.15)"/><rect x="74" y="17" width="12" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><circle cx="66" cy="30" r="5" fill="rgba(255,255,255,0.08)"/><rect x="74" y="27" width="18" height="2.5" rx="1" fill="rgba(255,255,255,0.12)"/><rect x="74" y="32" width="15" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><circle cx="66" cy="45" r="5" fill="rgba(255,255,255,0.1)"/><rect x="74" y="42" width="18" height="2.5" rx="1" fill="rgba(255,255,255,0.15)"/><rect x="74" y="47" width="11" height="2" rx="1" fill="rgba(255,255,255,0.06)"/>' },
      { title: "企业迁出预警", href: "#/gov/enterprise-exit", desc: "监控企业迁出动态，分析原因并提供预警机制", color: "#cc5a15", gradient: "linear-gradient(135deg,#6b1a1a 0%,#a03020 50%,#cc5a15 100%)",
        svg: '<rect x="5" y="5" width="90" height="50" rx="3" fill="rgba(255,255,255,0.05)"/><rect x="10" y="10" width="25" height="20" rx="2" fill="rgba(255,255,255,0.08)"/><rect x="12" y="12" width="8" height="8" rx="1" fill="rgba(255,255,255,0.12)"/><rect x="12" y="22" width="20" height="2" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="12" y="26" width="14" height="2" rx="1" fill="rgba(255,255,255,0.07)"/><rect x="40" y="10" width="25" height="20" rx="2" fill="rgba(255,255,255,0.08)"/><rect x="42" y="12" width="8" height="8" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="42" y="22" width="20" height="2" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="42" y="26" width="16" height="2" rx="1" fill="rgba(255,255,255,0.07)"/><rect x="70" y="10" width="22" height="20" rx="2" fill="rgba(255,255,255,0.06)"/><path d="M76,20 L80,16 L84,20" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" fill="none"/><line x1="80" y1="16" x2="80" y2="26" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/><rect x="10" y="35" width="82" height="16" rx="2" fill="rgba(255,255,255,0.06)"/><circle cx="20" cy="43" r="4" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/><text x="17" y="45" font-size="5" fill="rgba(255,255,255,0.3)">!</text><rect x="28" y="40" width="35" height="2.5" rx="1" fill="rgba(255,255,255,0.15)"/><rect x="28" y="44" width="25" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="70" y="39" width="16" height="8" rx="3" fill="rgba(255,255,255,0.12)"/>' },
      { title: "产业链式图谱", href: "#/gov/chain", desc: "构建区域产业链全景图谱，分析产业结构与关联", color: "#2670b8", gradient: "linear-gradient(135deg,#0f2942 0%,#145c7d 50%,#1b789f 100%)",
        svg: '<circle cx="50" cy="28" r="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/><text x="44" y="31" font-size="7" fill="rgba(255,255,255,0.3)">核心</text><circle cx="20" cy="15" r="7" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/><circle cx="80" cy="15" r="7" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/><circle cx="20" cy="45" r="7" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/><circle cx="80" cy="45" r="7" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/><circle cx="50" cy="52" r="6" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/><line x1="26" y1="19" x2="41" y2="24" stroke="rgba(255,255,255,0.18)" stroke-width="1"/><line x1="74" y1="19" x2="59" y2="24" stroke="rgba(255,255,255,0.18)" stroke-width="1"/><line x1="26" y1="41" x2="41" y2="32" stroke="rgba(255,255,255,0.18)" stroke-width="1"/><line x1="74" y1="41" x2="59" y2="32" stroke="rgba(255,255,255,0.18)" stroke-width="1"/><line x1="50" y1="38" x2="50" y2="46" stroke="rgba(255,255,255,0.12)" stroke-width="1"/><circle cx="12" cy="30" r="4" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="0.8"/><circle cx="88" cy="30" r="4" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="0.8"/><line x1="16" y1="30" x2="20" y2="22" stroke="rgba(255,255,255,0.1)" stroke-width="0.8"/><line x1="84" y1="30" x2="80" y2="22" stroke="rgba(255,255,255,0.1)" stroke-width="0.8"/>' },
    ];
    var portalRight = [
      { title: "领导决策支撑", href: "#/gov/decision-data", desc: "提供多维度数据分析，为领导决策提供科学依据", color: "#2670b8", gradient: "linear-gradient(135deg,#183553 0%,#2670b8 50%,#4a7ab0 100%)",
        svg: '<rect x="5" y="5" width="55" height="50" rx="3" fill="rgba(255,255,255,0.06)"/><rect x="10" y="10" width="22" height="3" rx="1" fill="rgba(255,255,255,0.25)"/><rect x="10" y="16" width="45" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="10" y="20" width="40" height="2" rx="1" fill="rgba(255,255,255,0.06)"/><rect x="10" y="24" width="45" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="10" y="30" width="30" height="2" rx="1" fill="rgba(255,255,255,0.06)"/><rect x="10" y="34" width="45" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="10" y="40" width="22" height="3" rx="1" fill="rgba(255,255,255,0.2)"/><rect x="10" y="46" width="38" height="2" rx="1" fill="rgba(255,255,255,0.06)"/><rect x="65" y="8" width="30" height="18" rx="2" fill="rgba(255,255,255,0.08)"/><polyline points="68,22 74,16 80,19 86,12 92,15" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.2"/><circle cx="80" cy="19" r="1.5" fill="rgba(255,255,255,0.4)"/><rect x="65" y="30" width="30" height="8" rx="2" fill="rgba(255,255,255,0.06)"/><rect x="68" y="32" width="8" height="4" rx="1" fill="rgba(255,255,255,0.15)"/><rect x="78" y="32" width="14" height="4" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="65" y="42" width="30" height="8" rx="2" fill="rgba(255,255,255,0.05)"/><rect x="68" y="44" width="10" height="4" rx="1" fill="rgba(255,255,255,0.12)"/><rect x="80" y="44" width="12" height="4" rx="1" fill="rgba(255,255,255,0.08)"/>' },
      { title: "区域经济研判", href: "#/gov/geo-district", desc: "分析区域经济发展态势，预测经济走向", color: "#2670b8", gradient: "linear-gradient(135deg,#0f2942 0%,#1b5a9e 60%,#1b789f 100%)",
        svg: '<rect x="5" y="5" width="90" height="50" rx="3" fill="rgba(255,255,255,0.04)"/><path d="M15,40 L25,35 L30,38 L40,28 L52,32 L58,22 L68,30 L78,18 L88,25" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="20" opacity="0.3"/><path d="M10,45 C20,42 25,30 35,35 C45,40 50,20 60,25 C70,30 75,15 90,20" fill="rgba(255,255,255,0.06)" stroke="none"/><path d="M10,45 C20,42 25,30 35,35 C45,40 50,20 60,25 C70,30 75,15 90,20" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/><circle cx="35" cy="35" r="4" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/><circle cx="60" cy="25" r="5" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" stroke-width="1"/><circle cx="90" cy="20" r="3" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/><rect x="56" y="10" width="20" height="10" rx="2" fill="rgba(255,255,255,0.1)"/><rect x="58" y="12" width="10" height="2" rx="1" fill="rgba(255,255,255,0.2)"/><rect x="58" y="15" width="16" height="2" rx="1" fill="rgba(255,255,255,0.1)"/><line x1="10" y1="50" x2="90" y2="50" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>' },
      { title: "重点项目调度", href: "#/gov/key-projects", desc: "实时监控重点项目进度，协调解决项目问题", color: "#2670b8", gradient: "linear-gradient(135deg,#254768 0%,#2670b8 40%,#6a9ad0 100%)",
        svg: '<rect x="5" y="8" width="90" height="46" rx="3" fill="rgba(255,255,255,0.05)"/><rect x="10" y="12" width="80" height="8" rx="2" fill="rgba(255,255,255,0.06)"/><rect x="12" y="14" width="52" height="4" rx="1.5" fill="rgba(255,255,255,0.2)"/><text x="66" y="17.5" font-size="4" fill="rgba(255,255,255,0.3)">65%</text><rect x="10" y="23" width="80" height="8" rx="2" fill="rgba(255,255,255,0.06)"/><rect x="12" y="25" width="68" height="4" rx="1.5" fill="rgba(255,255,255,0.25)"/><text x="82" y="28.5" font-size="4" fill="rgba(255,255,255,0.3)">85%</text><rect x="10" y="34" width="80" height="8" rx="2" fill="rgba(255,255,255,0.06)"/><rect x="12" y="36" width="38" height="4" rx="1.5" fill="rgba(255,255,255,0.15)"/><text x="52" y="39.5" font-size="4" fill="rgba(255,255,255,0.3)">48%</text><rect x="10" y="45" width="80" height="8" rx="2" fill="rgba(255,255,255,0.06)"/><rect x="12" y="47" width="75" height="4" rx="1.5" fill="rgba(255,255,255,0.22)"/><text x="89" y="50.5" font-size="4" fill="rgba(255,255,255,0.3)">94%</text><line x1="50" y1="8" x2="50" y2="12" stroke="rgba(255,255,255,0.1)" stroke-width="0.5" stroke-dasharray="1 1"/>' },
      { title: "政府统计数据", href: "#/gov/government-stats", desc: "整合各类政府统计数据，提供多维度查询分析", color: "#2670b8", gradient: "linear-gradient(135deg,#183553 0%,#254768 50%,#1b5a9e 100%)",
        svg: '<rect x="5" y="5" width="42" height="50" rx="3" fill="rgba(255,255,255,0.07)"/><rect x="9" y="9" width="18" height="3" rx="1" fill="rgba(255,255,255,0.2)"/><rect x="9" y="15" width="34" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="9" y="19" width="28" height="2" rx="1" fill="rgba(255,255,255,0.06)"/><rect x="9" y="23" width="34" height="2" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="9" y="27" width="20" height="2" rx="1" fill="rgba(255,255,255,0.06)"/><line x1="9" y1="33" x2="43" y2="33" stroke="rgba(255,255,255,0.08)" stroke-width="0.5"/><rect x="9" y="36" width="12" height="14" rx="1" fill="rgba(255,255,255,0.1)"/><rect x="23" y="40" width="12" height="10" rx="1" fill="rgba(255,255,255,0.15)"/><rect x="37" y="34" width="6" height="16" rx="1" fill="rgba(255,255,255,0.08)"/><rect x="55" y="5" width="42" height="24" rx="3" fill="rgba(255,255,255,0.06)"/><polyline points="60,24 68,18 74,22 80,12 88,16" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/><circle cx="68" cy="18" r="1.5" fill="rgba(255,255,255,0.35)"/><circle cx="80" cy="12" r="1.5" fill="rgba(255,255,255,0.35)"/><rect x="55" y="32" width="42" height="23" rx="3" fill="rgba(255,255,255,0.05)"/><circle cx="76" cy="44" r="9" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="5" stroke-dasharray="36 20"/><text x="73" y="46" font-size="6" fill="rgba(255,255,255,0.2)">%</text><rect x="59" y="35" width="10" height="2.5" rx="1" fill="rgba(255,255,255,0.15)"/><rect x="59" y="39" width="8" height="2" rx="1" fill="rgba(255,255,255,0.08)"/>' },
    ];
    // 按客户关注度重排：核心高频功能优先
    portalLeft = [portalLeft[1], portalLeft[4], portalLeft[0], portalLeft[3], portalLeft[2]];
    portalRight = [portalRight[1], portalRight[0], portalRight[3], portalRight[2]];

    function renderPortalCard(item, idx) {
      return '<a class="portal-card" href="' + esc(item.href) + '" style="border-left-color:' + item.color + '">' +
        '<div class="portal-card-img" style="background:' + item.gradient + '">' +
          '<svg class="portal-card-svg" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice">' +
            (item.svg || '') +
          '</svg>' +
          '<span class="portal-card-img-title">' + esc(item.title) + '</span>' +
        '</div>' +
        '<p class="portal-card-desc">' + esc(item.desc) + '</p>' +
      '</a>';
    }

    var leftHtml = portalLeft.map(function (item, i) { return renderPortalCard(item, i); }).join("");
    var rightHtml = portalRight.map(function (item, i) { return renderPortalCard(item, i + 5); }).join("");

    return (
      '<div class="portal-home-content fade-in">' +
        '<div class="portal-body">' +
          '<div class="portal-col">' +
            '<h2 class="portal-section-title"><span class="portal-section-icon">📈</span> 经济工作</h2>' +
            leftHtml +
          '</div>' +
          '<div class="portal-col">' +
            '<h2 class="portal-section-title"><span class="portal-section-icon">📊</span> 数据统计</h2>' +
            rightHtml +
            '<div class="portal-card portal-ai-card" style="border-left-color:#7c3aed">' +
              '<div class="portal-card-head">' +
                '<span class="portal-card-title"><span class="portal-ai-badge">AI</span> 智能助手</span>' +
              '</div>' +
              '<div class="ai-inline-chat" id="ai-inline-chat">' +
                '<div class="ai-inline-messages" id="ai-chat-messages"></div>' +
                '<div class="ai-inline-footer">' +
                  '<input type="text" id="ai-chat-input" class="ai-inline-input" placeholder="输入问题，按回车发送…" maxlength="500" autocomplete="off" />' +
                  '<button class="ai-inline-send" data-action="ai_chat_send">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
                  '</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
    '</div>'
    );
  }

  function keyProjectSeed() {
    return [
      { id: "kp1", name: "青羊航空智造总部基地扩能项目", type: "产业升级", level: "市重点", department: "经信局", street_id: "gs22", building_id: "gbs065", industry: "航空航天", status: "在建", warning_level: "中", total_invest: 32.5, fixed_asset: 24.2, annual_plan: 8.6, annual_done: 5.2, progress: 61, stage: "主体施工", participate: "企业投资 + 政府协调", address: "黄田坝街道 · 青羊航电产业楼", coord_x: 50.63, coord_y: 54.20, dual_owner: "经信局 / 发改局", source: "技改扩能", start_plan: "2025-09", end_plan: "2027-06", summary: "围绕航空航电、结构件制造和测试验证能力进行扩能，形成青羊区航空产业新增承载空间。", issue: "设备到货节奏偏慢，需同步协调专项审批。", relation: ["与航空航天主导产业直接关联，承担上游制造和中游配套双重作用。", "与黄田坝街道现有航空研发、适航服务主体形成上下游协同。"] },
      { id: "kp2", name: "少城沉浸式文旅街区提升项目", type: "城市更新", level: "区重点", department: "文体旅局", street_id: "gs11", building_id: "gb15", industry: "文化旅游", status: "在建", warning_level: "低", total_invest: 12.8, fixed_asset: 8.9, annual_plan: 3.6, annual_done: 2.7, progress: 74, stage: "场景装修", participate: "区属平台 + 社会资本", address: "少城街道 · 宽巷子文创园 A 座", coord_x: 55.57, coord_y: 57.35, dual_owner: "文体旅局 / 商务局", source: "街区焕新", start_plan: "2025-12", end_plan: "2026-11", summary: "打造以宽窄巷子夜游、演艺和数字内容联动为核心的沉浸式文旅消费项目。", issue: "演艺审批和招商签约节奏需进一步压紧。", relation: ["与少城文创活力港、宽窄巷子演艺中心等空间载体一体化建设。", "项目建成后将直接带动文旅、演艺和新消费企业导入。"] },
      { id: "kp3", name: "东大街金融科技服务枢纽项目", type: "楼宇提质", level: "市重点", department: "金融工作局", street_id: "gs23", building_id: "gbs022", industry: "金融", status: "在建", warning_level: "中", total_invest: 18.4, fixed_asset: 13.6, annual_plan: 5.5, annual_done: 2.9, progress: 53, stage: "设备安装", participate: "国资平台 + 金融机构", address: "东大街街道 · 锦江金融城", dual_owner: "金融工作局 / 投促局", source: "载体提质", start_plan: "2025-10", end_plan: "2026-12", summary: "聚焦金融科技、风控服务和资本中介，提升东大街金融服务港的综合承载能力。", issue: "部分头部金融科技项目仍处于意向阶段。", relation: ["与金融链条中的风控、基金和资本服务节点相呼应。", "有利于提升东大街街道的总部经济和金融服务密度。"] },
      { id: "kp4", name: "建设路数字文博产业升级项目", type: "产业导入", level: "区重点", department: "文创办", street_id: "gs32", building_id: "gbs075", industry: "文化旅游", status: "预备", warning_level: "高", total_invest: 9.7, fixed_asset: 6.1, annual_plan: 2.4, annual_done: 0.8, progress: 34, stage: "手续办理", participate: "社会资本", address: "建设路街道 · 东郊记忆文创区运营楼", dual_owner: "文创办 / 发改局", source: "平台招商", start_plan: "2026-02", end_plan: "2027-03", summary: "重点导入数字文博、虚拟制作和互动体验企业，打造建设路街道文博演艺新场景。", issue: "招商企业签约率不足，前期手续仍有压茬空间。", relation: ["对应产业链式图谱中的数字采集、虚拟制作和演艺运营环节。", "与东郊记忆运营资源联动，适合做重点招商展示项目。"] },
      { id: "kp5", name: "驷马桥智慧物流节点建设项目", type: "基础配套", level: "市重点", department: "商务局", street_id: "gs33", building_id: "gbs033", industry: "商务商贸", status: "在建", warning_level: "低", total_invest: 21.3, fixed_asset: 15.8, annual_plan: 6.8, annual_done: 4.9, progress: 72, stage: "主体施工", participate: "企业投资", address: "驷马桥街道 · 国际铁路港智慧仓配园", dual_owner: "商务局 / 口岸物流办", source: "枢纽建设", start_plan: "2025-08", end_plan: "2026-10", summary: "建设智慧仓配和跨境服务联动节点，强化成华区商贸物流承载与履约效率。", issue: "暂无明显阻滞，整体推进稳定。", relation: ["与仓配系统、跨境服务和履约网络等链条节点直接对应。", "有助于承接平台招商和跨境贸易增量项目。"] },
      { id: "kp6", name: "府南低空试制平台项目", type: "中试平台", level: "区重点", department: "经信局", street_id: "gs2", building_id: "gb3", industry: "低空经济", status: "在建", warning_level: "中", total_invest: 16.2, fixed_asset: 11.9, annual_plan: 4.2, annual_done: 2.1, progress: 50, stage: "设备安装", participate: "国资平台 + 企业投资", address: "府南街道 · 府南航空配套园 1 栋", coord_x: 54.32, coord_y: 56.41, dual_owner: "经信局 / 投促局", source: "中试平台", start_plan: "2025-11", end_plan: "2026-12", summary: "面向低空飞行器零部件试制、小批量验证和场景测试，补足府南街道中试承接能力。", issue: "设备采购节点需要进一步压缩周期。", relation: ["与航空航天、低空经济的制造验证和运维配套环节形成联动。", "适合衔接产业链薄弱节点招商后的承接落地。"] },
      { id: "kp7", name: "桂溪智算芯片中试平台项目", type: "科研平台", level: "市重点", department: "科技局", street_id: "gs29", building_id: "gbs066", industry: "人工智能", status: "预备", warning_level: "高", total_invest: 27.6, fixed_asset: 19.5, annual_plan: 7.4, annual_done: 1.8, progress: 25, stage: "谋划储备", participate: "企业投资 + 基金导入", address: "桂溪街道 · 武侯智算芯谷", dual_owner: "科技局 / 经信局", source: "平台招商", start_plan: "2026-03", end_plan: "2027-09", summary: "导入智算芯片验证、中试和模型推理基础设施，强化桂溪街道 AI 产业的底座能力。", issue: "资金拼盘和头部团队导入仍需加力。", relation: ["对接人工智能产业链中的算力芯片、模型服务和算力平台环节。", "适合作为高新区边界外的特色承接项目进行展示。"] },
      { id: "kp8", name: "浆洗街三国文化演艺提升项目", type: "文旅运营", level: "区重点", department: "文体旅局", street_id: "gs26", building_id: "gbs070", industry: "文化旅游", status: "在建", warning_level: "低", total_invest: 8.3, fixed_asset: 5.1, annual_plan: 2.1, annual_done: 1.7, progress: 81, stage: "完工投运", participate: "区属平台", address: "浆洗街街道 · 武侯祠文旅运营中心", dual_owner: "文体旅局 / 武侯祠管理方", source: "存量提质", start_plan: "2025-07", end_plan: "2026-06", summary: "提升武侯祠片区演艺、IP 和夜游运营能力，强化三国文化主题消费转化。", issue: "进入收尾阶段，重点关注开业招商节奏。", relation: ["与文化旅游产业链中的 IP 开发、演艺运营和文创转化节点深度关联。", "可直接用于领导看点项目展示。"] },
      { id: "kp9", name: "草市新消费服务港二期项目", type: "商贸服务", level: "区重点", department: "商务局", street_id: "gs10", building_id: "gb14", industry: "商务商贸", status: "预备", warning_level: "中", total_invest: 11.6, fixed_asset: 7.8, annual_plan: 3.3, annual_done: 1.6, progress: 48, stage: "手续办理", participate: "社会资本 + 运营商", address: "草市街街道 · 太升商贸城", coord_x: 56.30, coord_y: 56.18, dual_owner: "商务局 / 街道办", source: "二期扩容", start_plan: "2026-01", end_plan: "2026-12", summary: "围绕新消费品牌、政务服务和商业策展能力，打造草市街街道新消费服务港二期。", issue: "招商签约率需要跟进，品牌入驻尚未完全锁定。", relation: ["与商贸服务、品牌运营和消费活动导流密切相关。", "适合通过街道级调度持续推进。"] },
      { id: "kp10", name: "牛市口品牌服务港项目", type: "平台招商", level: "区重点", department: "投促局", street_id: "gs17", building_id: "gbs034", industry: "商务商贸", status: "竣工", warning_level: "低", total_invest: 6.9, fixed_asset: 4.2, annual_plan: 1.8, annual_done: 1.8, progress: 100, stage: "完工投运", participate: "企业投资", address: "牛市口街道 · 锦江品牌港", dual_owner: "投促局 / 街道办", source: "平台招商", start_plan: "2025-05", end_plan: "2026-02", summary: "聚焦品牌运营、商贸服务和渠道拓展，形成牛市口街道的品牌服务承载点。", issue: "当前进入运营期，重点关注项目达产和招商兑现。", relation: ["与品牌运营、商贸服务和平台招商活动联动。", "可作为已完工项目的示范样板进行展示。"] }
    ];
  }

  function keyProjectPointInRings(pt, rings) {
    var x = Number((pt || [])[0]);
    var y = Number((pt || [])[1]);
    if (!isFinite(x) || !isFinite(y)) return false;
    return (rings || []).some(function (ring) {
      return Array.isArray(ring) && ring.length >= 3 && geoPointInRing(x, y, ring);
    });
  }

  function keyProjectBoundsCenter(bounds, fallbackPt) {
    var fallback = Array.isArray(fallbackPt) && fallbackPt.length >= 2 ? fallbackPt : [50, 50];
    if (!bounds) return [Number(fallback[0] || 50), Number(fallback[1] || 50)];
    return [
      Number(((Number(bounds.minX || 0) + Number(bounds.maxX || 0)) / 2).toFixed(3)),
      Number(((Number(bounds.minY || 0) + Number(bounds.maxY || 0)) / 2).toFixed(3))
    ];
  }

  function keyProjectPullPointInsideRings(pt, rings, center) {
    var fallback = Array.isArray(center) && center.length >= 2 ? center : [50, 50];
    var x = Number((pt || [])[0]);
    var y = Number((pt || [])[1]);
    var cx = Number(fallback[0]);
    var cy = Number(fallback[1]);
    if (!isFinite(cx)) cx = 50;
    if (!isFinite(cy)) cy = 50;
    if (!isFinite(x)) x = cx;
    if (!isFinite(y)) y = cy;
    if (!(rings && rings.length)) return [clamp(x, 0, 100), clamp(y, 0, 100)];
    if (keyProjectPointInRings([x, y], rings)) return [x, y];
    for (var i = 0; i < 24; i++) {
      x = x * 0.72 + cx * 0.28;
      y = y * 0.72 + cy * 0.28;
      if (keyProjectPointInRings([x, y], rings)) return [x, y];
    }
    if (keyProjectPointInRings([cx, cy], rings)) return [cx, cy];
    return [clamp(cx, 0, 100), clamp(cy, 0, 100)];
  }

  function keyProjectPointFromItem(item, fallbackPt) {
    var fallback = Array.isArray(fallbackPt) && fallbackPt.length >= 2 ? fallbackPt : [50, 50];
    var rings = geoItemRings(item);
    var bounds = geoBoundsFromRings(rings);
    var center = keyProjectBoundsCenter(bounds, fallback);
    var rawX = Number(item && item.x);
    var rawY = Number(item && item.y);
    var basePt = isFinite(rawX) && isFinite(rawY) ? [rawX, rawY] : center;
    if (!rings.length) return [clamp(basePt[0], 0, 100), clamp(basePt[1], 0, 100)];
    return keyProjectPullPointInsideRings(basePt, rings, center);
  }

  function keyProjectShapeCenter(item, fallbackPt) {
    var fallback = Array.isArray(fallbackPt) && fallbackPt.length >= 2 ? fallbackPt : [50, 50];
    var rings = geoItemRings(item);
    if (!rings.length) return keyProjectPointFromItem(item, fallback);
    var bounds = geoBoundsFromRings(rings);
    var center = keyProjectBoundsCenter(bounds, fallback);
    return keyProjectPullPointInsideRings(center, rings, center);
  }

  function keyProjectHasAnchor(item) {
    return !!item && (geoItemRings(item).length || (isFinite(Number(item.x)) && isFinite(Number(item.y))));
  }

  function keyProjectHasExplicitCoord(item) {
    return !!item && isFinite(Number(item.coord_x)) && isFinite(Number(item.coord_y));
  }

  function keyProjectProjectPointToRings(pt, rings, center) {
    var point = [Number((pt || [])[0]), Number((pt || [])[1])];
    var targetCenter = Array.isArray(center) && center.length >= 2 ? [Number(center[0]), Number(center[1])] : point;
    if (!isFinite(point[0]) || !isFinite(point[1])) point = targetCenter.slice(0, 2);
    if (!(rings && rings.length)) return [clamp(point[0], 0, 100), clamp(point[1], 0, 100)];
    if (keyProjectPointInRings(point, rings)) return point;
    var nearest = keyProjectClosestBoundaryPoint(point, rings);
    if (!nearest) return keyProjectPullPointInsideRings(point, rings, targetCenter);
    var dirX = targetCenter[0] - nearest.x;
    var dirY = targetCenter[1] - nearest.y;
    var len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (!(len > 0.00001)) {
      dirX = point[0] - nearest.x;
      dirY = point[1] - nearest.y;
      len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    }
    var candidate = [nearest.x + (dirX / len) * 0.12, nearest.y + (dirY / len) * 0.12];
    if (!keyProjectPointInRings(candidate, rings)) candidate = keyProjectPullPointInsideRings(candidate, rings, targetCenter);
    return candidate;
  }

  function keyProjectResolvePoint(item, street, park, building, district) {
    var districtRings = geoItemRings(district);
    var streetRings = geoItemRings(street);
    var parkRings = geoItemRings(park);
    var districtCenter = districtRings.length ? keyProjectShapeCenter(district, [50, 50]) : keyProjectPointFromItem(district, [50, 50]);
    var streetCenter = keyProjectHasAnchor(street)
      ? (streetRings.length ? keyProjectShapeCenter(street, districtCenter) : keyProjectPointFromItem(street, districtCenter))
      : districtCenter;
    var parkCenter = keyProjectHasAnchor(park)
      ? (parkRings.length ? keyProjectShapeCenter(park, streetCenter) : keyProjectPointFromItem(park, streetCenter))
      : streetCenter;
    var sitePoint = streetCenter;

    if (keyProjectHasExplicitCoord(item)) {
      sitePoint = [Number(item.coord_x), Number(item.coord_y)];
      if (streetRings.length) sitePoint = keyProjectProjectPointToRings(sitePoint, streetRings, streetCenter);
      if (districtRings.length) sitePoint = keyProjectProjectPointToRings(sitePoint, districtRings, districtCenter);
      if (streetRings.length && !keyProjectPointInRings(sitePoint, streetRings)) sitePoint = keyProjectProjectPointToRings(sitePoint, streetRings, streetCenter);
      return {
        x: Number(sitePoint[0].toFixed(2)),
        y: Number(sitePoint[1].toFixed(2))
      };
    }

    if (keyProjectHasAnchor(building)) {
      sitePoint = keyProjectPointFromItem(building, parkRings.length ? parkCenter : streetCenter);
    } else if (keyProjectHasAnchor(park)) {
      sitePoint = parkCenter;
    } else if (keyProjectHasAnchor(street)) {
      sitePoint = streetCenter;
    }

    var point = streetRings.length
      ? [
          streetCenter[0] * 0.72 + sitePoint[0] * 0.28,
          streetCenter[1] * 0.72 + sitePoint[1] * 0.28
        ]
      : sitePoint;

    if (streetRings.length) point = keyProjectPullPointInsideRings(point, streetRings, streetCenter);
    if (districtRings.length) point = keyProjectPullPointInsideRings(point, districtRings, districtCenter);
    if (districtRings.length) point = keyProjectInsetPointFromBoundary(point, districtRings, streetRings.length ? streetCenter : districtCenter, 0.55);
    if (streetRings.length) point = keyProjectPullPointInsideRings(point, streetRings, streetCenter);
    return {
      x: Number(point[0].toFixed(2)),
      y: Number(point[1].toFixed(2))
    };
  }

  function keyProjectPathBounds(points) {
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    var hit = false;
    (points || []).forEach(function (pt) {
      if (!Array.isArray(pt) || pt.length < 2) return;
      var x = Number(pt[0]);
      var y = Number(pt[1]);
      if (!isFinite(x) || !isFinite(y)) return;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      hit = true;
    });
    if (!hit) return null;
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function keyProjectBoundsIntersects(a, b, pad) {
    if (!a || !b) return false;
    var gap = Number(pad || 0);
    return !(a.maxX < b.minX - gap || a.minX > b.maxX + gap || a.maxY < b.minY - gap || a.minY > b.maxY + gap);
  }

  function keyProjectPointSegmentDistance(px, py, ax, ay, bx, by) {
    return (keyProjectClosestBoundaryPointOnSegment(px, py, ax, ay, bx, by) || { dist: Infinity }).dist;
  }

  function keyProjectClosestBoundaryPointOnSegment(px, py, ax, ay, bx, by) {
    var abx = Number(bx || 0) - Number(ax || 0);
    var aby = Number(by || 0) - Number(ay || 0);
    var apx = Number(px || 0) - Number(ax || 0);
    var apy = Number(py || 0) - Number(ay || 0);
    var ab2 = abx * abx + aby * aby;
    var t = ab2 > 0 ? clamp((apx * abx + apy * aby) / ab2, 0, 1) : 0;
    var cx = Number(ax || 0) + abx * t;
    var cy = Number(ay || 0) + aby * t;
    var dx = Number(px || 0) - cx;
    var dy = Number(py || 0) - cy;
    return {
      x: cx,
      y: cy,
      dist: Math.sqrt(dx * dx + dy * dy)
    };
  }

  function keyProjectClosestBoundaryPoint(pt, rings) {
    var x = Number((pt || [])[0]);
    var y = Number((pt || [])[1]);
    var best = null;
    (rings || []).forEach(function (ring) {
      if (!Array.isArray(ring) || ring.length < 2) return;
      for (var i = 0; i < ring.length; i++) {
        var a = ring[i];
        var b = ring[(i + 1) % ring.length];
        if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) continue;
        var candidate = keyProjectClosestBoundaryPointOnSegment(x, y, Number(a[0]), Number(a[1]), Number(b[0]), Number(b[1]));
        if (!best || candidate.dist < best.dist) best = candidate;
      }
    });
    return best;
  }

  function keyProjectMinDistanceToRings(pt, rings) {
    var x = Number((pt || [])[0]);
    var y = Number((pt || [])[1]);
    var best = Infinity;
    (rings || []).forEach(function (ring) {
      if (!Array.isArray(ring) || ring.length < 2) return;
      for (var i = 0; i < ring.length; i++) {
        var a = ring[i];
        var b = ring[(i + 1) % ring.length];
        if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) continue;
        best = Math.min(best, keyProjectPointSegmentDistance(x, y, Number(a[0]), Number(a[1]), Number(b[0]), Number(b[1])));
      }
    });
    return best;
  }

  // Sample a stable interior point so larger dashboard markers stay visually inside the region.
  function keyProjectSampleInteriorPoint(rings, fallbackPt) {
    var fallback = Array.isArray(fallbackPt) && fallbackPt.length >= 2
      ? [Number(fallbackPt[0]), Number(fallbackPt[1])]
      : [50, 50];
    if (!isFinite(fallback[0])) fallback[0] = 50;
    if (!isFinite(fallback[1])) fallback[1] = 50;
    if (!(rings && rings.length)) return [clamp(fallback[0], 0, 100), clamp(fallback[1], 0, 100)];
    var bounds = geoBoundsFromRings(rings);
    if (!bounds) return [clamp(fallback[0], 0, 100), clamp(fallback[1], 0, 100)];

    function scoreCandidate(pt, best) {
      var x = Number((pt || [])[0]);
      var y = Number((pt || [])[1]);
      if (!isFinite(x) || !isFinite(y)) return best;
      var candidate = [
        clamp(x, Number(bounds.minX || 0), Number(bounds.maxX || 100)),
        clamp(y, Number(bounds.minY || 0), Number(bounds.maxY || 100))
      ];
      if (!keyProjectPointInRings(candidate, rings)) return best;
      var dist = keyProjectMinDistanceToRings(candidate, rings);
      if (!isFinite(dist)) return best;
      if (!best || dist > best.dist) return { x: candidate[0], y: candidate[1], dist: dist };
      return best;
    }

    var width = Math.max(0.12, Number(bounds.maxX || 0) - Number(bounds.minX || 0));
    var height = Math.max(0.12, Number(bounds.maxY || 0) - Number(bounds.minY || 0));
    var boxCenter = keyProjectBoundsCenter(bounds, fallback);
    var best = null;
    var seedX = boxCenter[0];
    var seedY = boxCenter[1];
    var step = Math.max(width, height) / 6;

    best = scoreCandidate(fallback, best);
    best = scoreCandidate(boxCenter, best);
    if (best) {
      seedX = best.x;
      seedY = best.y;
    }

    for (var iter = 0; iter < 5; iter++) {
      var span = step * 3;
      var minX = iter === 0 || !best ? Number(bounds.minX || 0) : Math.max(Number(bounds.minX || 0), seedX - span);
      var maxX = iter === 0 || !best ? Number(bounds.maxX || 100) : Math.min(Number(bounds.maxX || 100), seedX + span);
      var minY = iter === 0 || !best ? Number(bounds.minY || 0) : Math.max(Number(bounds.minY || 0), seedY - span);
      var maxY = iter === 0 || !best ? Number(bounds.maxY || 100) : Math.min(Number(bounds.maxY || 100), seedY + span);
      for (var x = minX; x <= maxX + 0.0001; x += step) {
        for (var y = minY; y <= maxY + 0.0001; y += step) {
          best = scoreCandidate([x, y], best);
        }
      }
      if (best) {
        seedX = best.x;
        seedY = best.y;
      }
      step = Math.max(step / 2, 0.04);
    }

    if (!best) {
      var projected = keyProjectProjectPointToRings(fallback, rings, boxCenter);
      return [Number(projected[0].toFixed(3)), Number(projected[1].toFixed(3))];
    }
    return [Number(best.x.toFixed(3)), Number(best.y.toFixed(3))];
  }

  function keyProjectInsetPointFromBoundary(pt, rings, center, minDist) {
    var point = [Number((pt || [])[0]), Number((pt || [])[1])];
    var targetCenter = Array.isArray(center) && center.length >= 2 ? [Number(center[0]), Number(center[1])] : point;
    var threshold = Number(minDist || 0);
    if (!(rings && rings.length) || !(threshold > 0)) return point;
    var best = keyProjectPullPointInsideRings(point, rings, targetCenter);
    var nearest = keyProjectClosestBoundaryPoint(best, rings);
    var dist = nearest ? nearest.dist : Infinity;
    if (dist >= threshold) return best;
    for (var i = 0; i < 20; i++) {
      var dirX = nearest ? best[0] - nearest.x : best[0] - targetCenter[0];
      var dirY = nearest ? best[1] - nearest.y : best[1] - targetCenter[1];
      var len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (!(len > 0.00001)) {
        dirX = best[0] - targetCenter[0];
        dirY = best[1] - targetCenter[1];
        len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      }
      var move = Math.max(0.08, threshold - dist);
      best = [best[0] + (dirX / len) * move, best[1] + (dirY / len) * move];
      best = keyProjectPullPointInsideRings(best, rings, targetCenter);
      nearest = keyProjectClosestBoundaryPoint(best, rings);
      dist = nearest ? nearest.dist : Infinity;
      if (dist >= threshold) return best;
    }
    return best;
  }

  function keyProjectRoadClass(feature) {
    var hierarchy = String((feature && feature.h) || "");
    if (hierarchy === "motorway" || hierarchy === "trunk") return "major";
    if (hierarchy === "primary" || hierarchy === "secondary") return "primary";
    return "minor";
  }

  function keyProjectRoadPaintOrder(feature) {
    var roadClass = keyProjectRoadClass(feature);
    return roadClass === "minor" ? 1 : roadClass === "primary" ? 2 : 3;
  }

  function keyProjectPolylinePoints(points) {
    return (points || []).filter(function (pt) {
      return Array.isArray(pt) && pt.length >= 2 && isFinite(Number(pt[0])) && isFinite(Number(pt[1]));
    }).map(function (pt) {
      return clamp(Number(pt[0]), 0, 100).toFixed(2) + "," + clamp(Number(pt[1]), 0, 100).toFixed(2);
    }).join(" ");
  }

  function keyProjectPolylineMidpoint(points) {
    var clean = (points || []).filter(function (pt) {
      return Array.isArray(pt) && pt.length >= 2 && isFinite(Number(pt[0])) && isFinite(Number(pt[1]));
    }).map(function (pt) {
      return [Number(pt[0]), Number(pt[1])];
    });
    if (!clean.length) return null;
    if (clean.length === 1) return clean[0];
    var total = 0;
    var lengths = [];
    for (var i = 1; i < clean.length; i++) {
      var dx = clean[i][0] - clean[i - 1][0];
      var dy = clean[i][1] - clean[i - 1][1];
      var seg = Math.sqrt(dx * dx + dy * dy);
      lengths.push(seg);
      total += seg;
    }
    if (!(total > 0)) return clean[Math.floor(clean.length / 2)];
    var target = total / 2;
    var walked = 0;
    for (var si = 1; si < clean.length; si++) {
      var segLen = lengths[si - 1];
      if (walked + segLen >= target) {
        var ratio = (target - walked) / Math.max(segLen, 0.00001);
        return [
          clean[si - 1][0] + (clean[si][0] - clean[si - 1][0]) * ratio,
          clean[si - 1][1] + (clean[si][1] - clean[si - 1][1]) * ratio
        ];
      }
      walked += segLen;
    }
    return clean[Math.floor(clean.length / 2)];
  }

  function keyProjectRoadLabelWidth(label) {
    return Number(clamp(0.46 + String(label || "").length * 0.11, 0.72, 1.52).toFixed(2));
  }

  function keyProjectMarkerLabelWidth(label, compact) {
    return Number(
      clamp(
        (compact ? 0.52 : 0.62) + String(label || "").length * (compact ? 0.1 : 0.11),
        compact ? 0.92 : 1.04,
        compact ? 1.82 : 2.08
      ).toFixed(2)
    );
  }

  function keyProjectBasemapHtml(vb) {
    var raw = geoBasemapDetailRaw || window.DEMO_GEO_BASEMAP_DETAIL || null;
    if (!raw) return "";
    var viewBounds = {
      minX: Number(vb.x || 0),
      minY: Number(vb.y || 0),
      maxX: Number(vb.x || 0) + Number(vb.w || 0),
      maxY: Number(vb.y || 0) + Number(vb.h || 0)
    };
    var pad = Math.max(0.45, Math.min(Number(vb.w || 0), Number(vb.h || 0)) * 0.18);
    var waterFeatures = (raw.water || []).filter(function (feature) {
      return Array.isArray(feature && feature.p) && feature.p.length >= 2 && keyProjectBoundsIntersects(keyProjectPathBounds(feature.p), viewBounds, pad);
    });
    var roadFeatures = (raw.roads || []).filter(function (feature) {
      return Array.isArray(feature && feature.p) && feature.p.length >= 2 && keyProjectBoundsIntersects(keyProjectPathBounds(feature.p), viewBounds, pad);
    }).sort(function (a, b) {
      var ao = keyProjectRoadPaintOrder(a);
      var bo = keyProjectRoadPaintOrder(b);
      if (ao !== bo) return ao - bo;
      return Number(a.l || 0) - Number(b.l || 0);
    });

    var waterHtml = waterFeatures.map(function (feature) {
      return '<polyline class="kp-map-water type-' + esc(String(feature.t || 0)) + '" points="' + keyProjectPolylinePoints(feature.p) + '"></polyline>';
    }).join("");
    var roadsHtml = roadFeatures.map(function (feature) {
      return '<polyline class="kp-map-road ' + keyProjectRoadClass(feature) + '" points="' + keyProjectPolylinePoints(feature.p) + '"></polyline>';
    }).join("");

    var seenNames = {};
    var labelSlots = [];
    var roadLabels = [];
    roadFeatures.slice().sort(function (a, b) {
      var ao = keyProjectRoadPaintOrder(a);
      var bo = keyProjectRoadPaintOrder(b);
      if (ao !== bo) return bo - ao;
      return Number(b.l || 0) - Number(a.l || 0);
    }).forEach(function (feature) {
      var name = String(feature && feature.n || "").trim();
      if (!name || seenNames[name]) return;
      if (keyProjectRoadPaintOrder(feature) < 2) return;
      var midpoint = keyProjectPolylineMidpoint(feature.p);
      if (!midpoint) return;
      var mx = ((midpoint[0] - vb.x) / Math.max(0.001, vb.w)) * 100;
      var my = ((midpoint[1] - vb.y) / Math.max(0.001, vb.h)) * 100;
      if (mx < 8 || mx > 92 || my < 9 || my > 87) return;
      for (var li = 0; li < labelSlots.length; li++) {
        var slot = labelSlots[li];
        if (Math.abs(slot.x - mx) < 16 && Math.abs(slot.y - my) < 8) return;
      }
      seenNames[name] = true;
      labelSlots.push({ x: mx, y: my });
      var shortName = geoShortName(name, 10);
      var labelWidth = keyProjectRoadLabelWidth(shortName);
      roadLabels.push(
        '<g class="kp-map-road-label road-' + keyProjectRoadClass(feature) + '" transform="translate(' + midpoint[0].toFixed(2) + ' ' + midpoint[1].toFixed(2) + ')">' +
        '<rect x="' + (-labelWidth / 2).toFixed(2) + '" y="-0.16" width="' + labelWidth.toFixed(2) + '" height="0.32" rx="0.16" ry="0.16"></rect>' +
        '<text x="0" y="0" textLength="' + Math.max(0.36, labelWidth - 0.18).toFixed(2) + '" lengthAdjust="spacingAndGlyphs">' + esc(shortName) + '</text>' +
        '</g>'
      );
    });

    return (
      '<svg class="kp-map-svg kp-map-basemap" viewBox="' +
      vb.x.toFixed(2) +
      ' ' +
      vb.y.toFixed(2) +
      ' ' +
      vb.w.toFixed(2) +
      ' ' +
      vb.h.toFixed(2) +
      '" preserveAspectRatio="xMidYMid meet">' +
      '<g class="kp-map-water-layer">' + waterHtml + '</g>' +
      '<g class="kp-map-road-layer">' + roadsHtml + '</g>' +
      '<g class="kp-map-road-label-layer">' + roadLabels.slice(0, 6).join("") + '</g>' +
      '</svg>' +
      ''
    );
  }

  function keyProjectData() {
    return keyProjectSeed().map(function (item) {
      var street = geoStreetById(item.street_id) || {};
      var district = geoDistrictById(item.district_id || street.district_id) || {};
      var geo = geoData();
      var building = (geo.buildings || []).find(function (b) { return b.id === item.building_id; }) || {};
      var park = geoParkById(item.park_id || building.park_id) || {};
      var progressClass = item.warning_level === "高" ? "red" : item.warning_level === "中" ? "orange" : "green";
      var point = keyProjectResolvePoint(item, street, park, building, district);
      return Object.assign({}, item, {
        district_id: item.district_id || street.district_id || "",
        district_name: district.name || "示例区域",
        street_name: street.name || "示例街道",
        park_id: item.park_id || building.park_id || park.id || "",
        park_name: park.name || "",
        building_name: building.name || "",
        x: point.x,
        y: point.y,
        progress_class: progressClass,
        risk_tag: item.warning_level === "高" ? "需重点协调" : item.warning_level === "中" ? "需跟踪推进" : "推进正常"
      });
    }).filter(govDemoIsInDistrict);
  }

  function keyProjectFilterState(rt) {
    var q = (rt && rt.q) || {};
    return {
      status: q.kps || "",
      dept: q.kpd || "",
      street: q.kpst || "",
      term: (q.kpq || "").trim(),
      warningOnly: q.kpw === "1",
      pid: q.kpid || ""
    };
  }

  function keyProjectFiltered(rt) {
    var filter = keyProjectFilterState(rt);
    return keyProjectData().filter(function (item) {
      if (filter.status && item.status !== filter.status) return false;
      if (filter.dept && item.department !== filter.dept) return false;
      if (filter.street && item.street_name !== filter.street) return false;
      if (filter.warningOnly && item.warning_level === "低") return false;
      if (filter.term) {
        var hay = [item.name, item.industry, item.department, item.street_name, item.summary, item.issue].join(" ").toLowerCase();
        if (hay.indexOf(filter.term.toLowerCase()) < 0) return false;
      }
      return true;
    });
  }

  function keyProjectSummary(items) {
    var totalInvest = items.reduce(function (sum, item) { return sum + Number(item.total_invest || 0); }, 0);
    var fixedInvest = items.reduce(function (sum, item) { return sum + Number(item.fixed_asset || 0); }, 0);
    var annualDone = items.reduce(function (sum, item) { return sum + Number(item.annual_done || 0); }, 0);
    var annualPlan = items.reduce(function (sum, item) { return sum + Number(item.annual_plan || 0); }, 0);
    var warnings = items.filter(function (item) { return item.warning_level !== "低"; }).length;
    var highWarnings = items.filter(function (item) { return item.warning_level === "高"; }).length;
    return {
      count: items.length,
      totalInvest: totalInvest,
      fixedInvest: fixedInvest,
      annualDone: annualDone,
      annualPlan: annualPlan,
      completion: annualPlan ? Math.round(annualDone / annualPlan * 100) : 0,
      inBuild: items.filter(function (item) { return item.status === "在建"; }).length,
      done: items.filter(function (item) { return item.status === "竣工"; }).length,
      reserve: items.filter(function (item) { return item.status === "预备"; }).length,
      warnings: warnings,
      highWarnings: highWarnings
    };
  }

  function keyProjectStageBuckets(items) {
    var order = ["谋划储备", "手续办理", "主体施工", "设备安装", "场景装修", "完工投运"];
    return order.map(function (label) {
      return { label: label, count: items.filter(function (item) { return item.stage === label; }).length };
    }).filter(function (item) { return item.count > 0; });
  }

  function keyProjectOptions(items, field) {
    return items.map(function (item) { return item[field]; }).filter(function (value, index, arr) {
      return value && arr.indexOf(value) === index;
    });
  }

  function keyProjectQueryHref(path, rt, patch) {
    var next = {};
    Object.keys((rt && rt.q) || {}).forEach(function (key) { next[key] = rt.q[key]; });
    Object.keys(patch || {}).forEach(function (key) { next[key] = patch[key]; });
    Object.keys(next).forEach(function (key) {
      if (next[key] == null || next[key] === "") delete next[key];
    });
    return buildHash(path, next);
  }

  function keyProjectSelected(rt, items, fallbackItems) {
    var pid = ((rt && rt.q) || {}).kpid || "";
    return items.find(function (item) { return item.id === pid; }) ||
      (fallbackItems || []).find(function (item) { return item.id === pid; }) ||
      items[0] || (fallbackItems || [])[0] || null;
  }

  function keyProjectInsightList(items) {
    var summary = keyProjectSummary(items);
    var topStreet = items.slice().sort(function (a, b) { return Number(b.total_invest || 0) - Number(a.total_invest || 0); })[0];
    var byIndustry = {};
    items.forEach(function (item) { byIndustry[item.industry] = (byIndustry[item.industry] || 0) + 1; });
    var topIndustry = Object.keys(byIndustry).sort(function (a, b) { return byIndustry[b] - byIndustry[a]; })[0] || "主导产业";
    return [
      "项目总投资约 " + fixed(summary.totalInvest, 1) + " 亿元，当前在建项目 " + summary.inBuild + " 个，年度完成率约 " + summary.completion + "%。",
      "投资热度主要集中在“" + (topStreet ? topStreet.street_name : "重点街道") + "”，与“" + topIndustry + "”方向的空间承载联动最强。",
      "当前需要重点协调的预警项目共 " + summary.warnings + " 个，主要卡点集中在手续办理、招商签约和设备到货节奏。"
    ];
  }

  function keyProjectUnique(values) {
    var out = [];
    (values || []).forEach(function (value) {
      if (!value || out.indexOf(value) >= 0) return;
      out.push(value);
    });
    return out;
  }

  function keyProjectMapLayers(items, selected) {
    var geo = geoData();
    var selectedStreetId = (selected && selected.street_id) || "";
    var selectedParkId = (selected && selected.park_id) || "";
    var streetIds = keyProjectUnique(items.map(function (item) { return item.street_id; }));
    var parkIds = keyProjectUnique(items.map(function (item) { return item.park_id; }));

    // Focus on 青羊区 — use district boundary as outline
    var qyDistrict = geoDistrictById(DEMO_GOV_DISTRICT_LOCK_ID);
    var qyRings = geoItemRings(qyDistrict);
    var qyBounds = geoBoundsFromRings(qyRings);
    if (!qyBounds) qyBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    // Expand bounds slightly for padding
    var pad = 0.06;
    var bw = qyBounds.maxX - qyBounds.minX;
    var bh = qyBounds.maxY - qyBounds.minY;
    var vb = {
      x: clamp(qyBounds.minX - bw * pad, 0, 100),
      y: clamp(qyBounds.minY - bh * pad, 0, 100),
      w: Math.min(bw * (1 + pad * 2), 100),
      h: Math.min(bh * (1 + pad * 2), 100),
    };
    var viewBox = vb.x.toFixed(2) + " " + vb.y.toFixed(2) + " " + vb.w.toFixed(2) + " " + vb.h.toFixed(2);
    var basemapHtml = keyProjectBasemapHtml(vb);

    // District outline (青羊区 boundary)
    var districtOutline = qyRings
      .map(function (ring) {
        return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
      })
      .join("");
    var maskOuterPath =
      "M" + vb.x.toFixed(2) + "," + vb.y.toFixed(2) +
      " L" + (vb.x + vb.w).toFixed(2) + "," + vb.y.toFixed(2) +
      " L" + (vb.x + vb.w).toFixed(2) + "," + (vb.y + vb.h).toFixed(2) +
      " L" + vb.x.toFixed(2) + "," + (vb.y + vb.h).toFixed(2) +
      " Z";
    var districtMaskPath = maskOuterPath + " " + qyRings.map(function (ring) {
      return "M" + (ring || []).map(function (pt) {
        return clamp(Number((pt || [])[0] || 0), 0, 100).toFixed(2) + "," + clamp(Number((pt || [])[1] || 0), 0, 100).toFixed(2);
      }).join(" L") + " Z";
    }).join(" ");

    // All streets in 青羊区
    var allStreets = (geo.streets || []).filter(function (s) {
      return s.district_id === DEMO_GOV_DISTRICT_LOCK_ID;
    });
    var streetPolys = allStreets
      .map(function (street) {
        var rings = geoItemRings(street);
        if (!rings.length) return "";
        var hasProject = streetIds.indexOf(street.id) >= 0;
        var cls = "kp-map-street";
        if (street.id === selectedStreetId) cls += " active";
        else if (!hasProject) cls += " subdued";
        return (
          '<g class="' + cls + '">' +
          rings.map(function (ring) {
            return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
          }).join("") +
          "</g>"
        );
      })
      .join("");

    // All parks in 青羊区
    var allParks = (geo.parks || []).filter(function (p) {
      return p.district_id === DEMO_GOV_DISTRICT_LOCK_ID;
    });
    var parkPolys = allParks
      .map(function (park) {
        var rings = geoItemRings(park);
        if (!rings.length) return "";
        var hasProject = parkIds.indexOf(park.id) >= 0;
        var cls = "kp-map-park";
        if (park.id === selectedParkId) cls += " active";
        else if (!hasProject) cls += " subdued";
        return (
          '<g class="' + cls + '">' +
          rings.map(function (ring) {
            return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
          }).join("") +
          "</g>"
        );
      })
      .join("");

    return {
      html:
        '<div class="kp-map-geo-base">' +
        basemapHtml +
        '<svg class="kp-map-svg kp-map-district-mask" viewBox="' + viewBox + '" preserveAspectRatio="xMidYMid meet"><path d="' + districtMaskPath + '" fill-rule="evenodd"></path></svg>' +
        '<svg class="kp-map-svg kp-map-city" viewBox="' + viewBox + '" preserveAspectRatio="xMidYMid meet"><g>' +
        districtOutline +
        "</g></svg>" +
        '<svg class="kp-map-svg kp-map-streets" viewBox="' + viewBox + '" preserveAspectRatio="xMidYMid meet">' +
        streetPolys +
        "</svg>" +
        '<svg class="kp-map-svg kp-map-parks" viewBox="' + viewBox + '" preserveAspectRatio="xMidYMid meet">' +
        parkPolys +
        "</svg>" +
        '<svg class="kp-map-svg kp-map-boundary" viewBox="' + viewBox + '" preserveAspectRatio="xMidYMid meet"><g>' +
        districtOutline +
        "</g></svg></div>",
      vb: vb,
    };
  }

  function keyProjectMarkerSvg(items, selected, rt, vb) {
    var viewBox = vb.x.toFixed(2) + " " + vb.y.toFixed(2) + " " + vb.w.toFixed(2) + " " + vb.h.toFixed(2);
    var drawItems = (items || []).slice().sort(function (a, b) {
      if (a.id === (selected && selected.id)) return 1;
      if (b.id === (selected && selected.id)) return -1;
      return 0;
    });
    var html = drawItems.map(function (item, idx) {
      var isActive = item.id === (selected && selected.id);
      var showLabel = item.id === (selected && selected.id) || item.warning_level === "高";
      var quietLabel = !showLabel;
      var cls = "kp-map-marker-link warning-" + (item.warning_level === "高" ? "high" : item.warning_level === "中" ? "mid" : "low");
      if (isActive) cls += " active";
      if (quietLabel) cls += " compact";
      var shortLabel = geoShortName(item.name, quietLabel ? 10 : 12);
      var labelWidth = keyProjectMarkerLabelWidth(shortLabel, quietLabel);
      var labelHeight = quietLabel ? 0.32 : 0.38;
      var labelOffsetY = quietLabel ? -0.74 : -0.86;
      var labelWrapClass = "kp-map-marker-bubble-wrap" + (quietLabel ? " quiet hover-only" : " emphasized");
      var labelHtml =
        '<g class="' + labelWrapClass + '" transform="translate(0 ' + labelOffsetY.toFixed(2) + ')">' +
        '<rect class="kp-map-marker-bubble" x="' + (-labelWidth / 2).toFixed(2) + '" y="' + (-labelHeight / 2).toFixed(2) + '" width="' + labelWidth.toFixed(2) + '" height="' + labelHeight.toFixed(2) + '" rx="' + (labelHeight / 2).toFixed(2) + '" ry="' + (labelHeight / 2).toFixed(2) + '"></rect>' +
        '<text class="kp-map-marker-text" x="0" y="0" textLength="' + Math.max(0.72, labelWidth - (quietLabel ? 0.16 : 0.2)).toFixed(2) + '" lengthAdjust="spacingAndGlyphs">' + esc(shortLabel) + '</text>' +
        '</g>';
      var pinScale = isActive ? '0.82' : quietLabel ? '0.62' : '0.70';
      var compactHit = quietLabel ? '<circle class="kp-map-marker-hit" cx="0" cy="-0.44" r="0.28"></circle>' : '';
      var beacon = isActive ? '<circle class="kp-map-marker-beacon" cx="0" cy="-0.44" r="0.30"></circle>' : '';
      return (
        '<a class="' + cls + '" href="' + keyProjectQueryHref("/gov/key-projects/detail", rt, { kpid: item.id }) + '">' +
        '<title>' + esc(item.name) + '</title>' +
        '<g class="kp-map-marker-node" transform="translate(' + Number(item.x).toFixed(2) + ' ' + Number(item.y).toFixed(2) + ')">' +
        beacon +
        compactHit +
        labelHtml +
        '<g class="kp-map-marker-pin-wrap" transform="scale(' + pinScale + ')">' +
        '<circle class="kp-map-marker-halo" cx="0" cy="-0.44" r="0.21"></circle>' +
        '<path class="kp-map-marker-pin" d="M0 0 C0.11 -0.14 0.19 -0.31 0.19 -0.44 A0.19 0.19 0 1 0 -0.19 -0.44 C-0.19 -0.31 -0.11 -0.14 0 0 Z"></path>' +
        '<circle class="kp-map-marker-pin-core" cx="0" cy="-0.44" r="0.08"></circle>' +
        '<path class="kp-map-marker-glyph" d="M0 -0.50 L0.03 -0.44 L0 -0.38 L-0.03 -0.44 Z"></path>' +
        '</g>' +
        '</g>' +
        '</a>'
      );
    }).join("");
    return '<svg class="kp-map-svg kp-map-markers-svg" viewBox="' + viewBox + '" preserveAspectRatio="xMidYMid meet">' + html + '</svg>';
  }

  function keyProjectMapHtml(items, selectedId, rt) {
    rt = rt || route();
    var query = (rt && rt.q) || {};
    var selected = items.find(function (item) { return item.id === selectedId; }) || items[0] || null;
    var markerItems = items
      .slice()
      .sort(function (a, b) {
        if (a.id === (selected && selected.id)) return -1;
        if (b.id === (selected && selected.id)) return 1;
        var warnOrder = { "高": 3, "中": 2, "低": 1 };
        if (warnOrder[b.warning_level] !== warnOrder[a.warning_level]) return warnOrder[b.warning_level] - warnOrder[a.warning_level];
        return Number(b.total_invest || 0) - Number(a.total_invest || 0);
      })
      .slice(0, 10);
    var meta = {
      projects: items.length,
      streets: keyProjectUnique(items.map(function (item) { return item.street_id; })).length,
      parks: keyProjectUnique(items.map(function (item) { return item.park_id; })).length,
    };
    var mapResult = keyProjectMapLayers(items, selected);
    var markers = keyProjectMarkerSvg(markerItems, selected, rt, mapResult.vb);
    var focusHidden = query.kpfc === "0";
    var focusToggleHref = keyProjectQueryHref("/gov/key-projects", rt, { kpfc: focusHidden ? "1" : "0" });
    var focusHtml = selected && !focusHidden
      ? '<div class="kp-map-focus-card"><div class="kp-map-focus-head"><span class="kp-map-focus-kicker">当前聚焦</span><a class="kp-map-focus-close" href="' +
        focusToggleHref +
        '" aria-label="关闭当前聚焦卡片" title="关闭当前聚焦卡片">关闭</a></div><strong>' +
        esc(selected.name) +
        '</strong><p>' +
        esc(selected.district_name + " / " + selected.street_name + (selected.park_name ? " / " + selected.park_name : "")) +
        "</p></div>"
      : "";
    var focusToggleHtml = selected && focusHidden
      ? '<a class="kp-map-focus-toggle" href="' + focusToggleHref + '">显示当前聚焦</a>'
      : "";
    return (
      '<div class="kp-map-stage">' +
      '<div class="kp-map-stage-grid"></div>' +
      '<div class="kp-map-stage-mask"></div>' +
      mapResult.html +
      '<div class="kp-map-badges"><span><b>' + esc(String(meta.projects)) + '</b> 个项目</span><span><b>' + esc(String(meta.streets)) + '</b> 条街道</span><span><b>' + esc(String(meta.parks)) + '</b> 个园区</span></div>' +
      focusToggleHtml +
      focusHtml +
      '<div class="kp-map-markers">' + markers + "</div>" +
      '<div class="kp-map-legend"><span><i class="type-project"></i>项目点位</span><span><i class="type-road"></i>路网</span><span><i class="type-water"></i>水系</span><span><i class="type-street"></i>街道</span><span><i class="type-park"></i>园区</span></div>' +
      '<div class="kp-map-stage-caption">项目建设地理位置大屏（青羊区真实路网参照）</div>' +
      "</div>"
    );
  }

  function keyProjectDetailPanel(project) {
    if (!project) return '<div class="muted">当前筛选下暂无项目。</div>';
    var progressRatio = clamp(Number(project.progress || 0), 0, 100);
    var relationHtml = (project.relation || []).map(function (line) {
      return "<li>" + esc(line) + "</li>";
    }).join("");
    return '<div class="kp-detail-shell"><div class="kp-detail-header"><div><span class="tag teal">' + esc(project.level) + '</span><span class="tag ' +
      esc(project.progress_class) + '">' + esc(project.warning_level + "预警") + '</span><h3>' + esc(project.name) + '</h3><p>' + esc(project.summary) +
      '</p></div><div class="kp-detail-head-metrics"><div><b>' + esc(fixed(project.total_invest, 1)) + '</b><span>总投资（亿元）</span></div><div><b>' +
      esc(project.progress + "%") + '</b><span>投资完成</span></div></div></div><div class="kp-detail-grid">' +
      '<div class="kp-detail-item"><label>项目名称</label><span>' + esc(project.name) + "</span></div>" +
      '<div class="kp-detail-item"><label>行业</label><span>' + esc(project.industry) + "</span></div>" +
      '<div class="kp-detail-item"><label>参与情况</label><span>' + esc(project.participate) + "</span></div>" +
      '<div class="kp-detail-item"><label>建设阶段</label><span>' + esc(project.stage) + "</span></div>" +
      '<div class="kp-detail-item"><label>建设地址</label><span>' + esc(project.address) + "</span></div>" +
      '<div class="kp-detail-item"><label>双口业主单位</label><span>' + esc(project.dual_owner) + "</span></div>" +
      '<div class="kp-detail-item"><label>总投资</label><span>' + esc(fixed(project.total_invest, 1) + " 亿元") + "</span></div>" +
      '<div class="kp-detail-item"><label>固定资产投资</label><span>' + esc(fixed(project.fixed_asset, 1) + " 亿元") + "</span></div>" +
      '<div class="kp-detail-item"><label>2026 年计划投资</label><span>' + esc(fixed(project.annual_plan, 1) + " 亿元") + "</span></div>" +
      '<div class="kp-detail-item"><label>2026 年度形象进度</label><span>' + esc(project.progress + "%") + "</span></div>" +
      '<div class="kp-detail-item"><label>计划开工时间</label><span>' + esc(project.start_plan) + "</span></div>" +
      '<div class="kp-detail-item"><label>计划竣工时间</label><span>' + esc(project.end_plan) + "</span></div>" +
      '<div class="kp-detail-item"><label>所属区域</label><span>' + esc(project.district_name + " / " + project.street_name) + "</span></div>" +
      '<div class="kp-detail-item"><label>所属园区</label><span>' + esc(project.park_name || "未限定园区") + "</span></div>" +
      '<div class="kp-detail-item"><label>备注</label><span>' + esc(project.issue) + "</span></div></div>" +
      '<div class="kp-detail-progress"><div class="kp-progress-head"><span>项目开工/推进/竣工</span><b>' + esc(project.risk_tag) +
      '</b></div><div class="kp-progress-track"><span style="width:' + progressRatio + '%;"></span></div></div>' +
      '<div class="kp-detail-relation"><h4>项目建设与区域经济发展关联分析</h4><ul>' + relationHtml + "</ul></div></div>";
  }

  function pageGovKeyProjectsLegacy(rt) {
    rt = rt || route();
    var allItems = keyProjectData();
    var items = keyProjectFiltered(rt);
    var allSummary = keyProjectSummary(allItems);
    var filter = keyProjectFilterState(rt);
    var selected = keyProjectSelected(rt, items);
    var statusOptions = keyProjectOptions(allItems, "status");
    var deptOptions = keyProjectOptions(allItems, "department");
    var streetOptions = keyProjectOptions(allItems, "street_name");
    var filterBar = '<div class="kp-filter-bar"><div class="kp-filter-group"><span>筛选</span><select data-kp-filter="status"><option value="">项目状态</option>' +
      statusOptions.map(function (item) { return '<option value="' + esc(item) + '"' + (filter.status === item ? " selected" : "") + ">" + esc(item) + "</option>"; }).join("") +
      '</select><select data-kp-filter="dept"><option value="">管理部门</option>' +
      deptOptions.map(function (item) { return '<option value="' + esc(item) + '"' + (filter.dept === item ? " selected" : "") + ">" + esc(item) + "</option>"; }).join("") +
      '</select><select data-kp-filter="street"><option value="">所属街道</option>' +
      streetOptions.map(function (item) { return '<option value="' + esc(item) + '"' + (filter.street === item ? " selected" : "") + ">" + esc(item) + "</option>"; }).join("") +
      '</select></div><form class="kp-search-form" data-kp-search><input class="kp-search-input" name="q" value="' + esc(filter.term) + '" placeholder="输入项目名称或区域关键词" /><button class="btn" type="submit">搜索</button></form></div>';
    var stageRows = keyProjectStageBuckets(allItems).map(function (item) {
      var width = allItems.length ? Math.max(12, Math.round(item.count / allItems.length * 100)) : 0;
      return '<div class="kp-stage-row"><div><b>' + esc(item.label) + '</b><span>' + esc(item.count + " 个") + '</span></div><div class="kp-stage-bar"><span style="width:' + width + '%;"></span></div></div>';
    }).join("");
    var priorityItems = items.slice().sort(function (a, b) {
      var order = { "高": 3, "中": 2, "低": 1 };
      if (order[b.warning_level] !== order[a.warning_level]) return order[b.warning_level] - order[a.warning_level];
      return Number(a.progress || 0) - Number(b.progress || 0);
    });
    var trackingRows = priorityItems.slice(0, 5).map(function (item) {
      var pct = Math.min(100, Math.max(0, Number(item.progress || 0)));
      return '<a class="kp-track-item" href="' + keyProjectQueryHref("/gov/key-projects/detail", rt, { kpid: item.id }) + '">' +
        '<div class="kp-track-info"><div class="kp-track-head"><strong title="' + esc(item.name) + '">' + esc(item.name) + '</strong></div><div class="kp-track-subline"><span class="kp-track-sub" title="' + esc(item.street_name + " · " + item.department) + '">' + esc(item.street_name + " · " + item.department) + '</span><span class="kp-track-stage">' + esc(item.stage) + '</span></div>' +
        '<div class="kp-track-bar-wrap"><div class="kp-track-bar"><span style="width:' + pct + '%;"></span></div><span class="kp-track-pct">' + esc(item.progress + "%") + '</span></div></div>' +
        '<div class="kp-track-meta"><span class="tag ' + esc(item.progress_class) + '">' + esc(item.warning_level + "预警") + '</span><span class="kp-track-status">' + esc(item.status) + '</span></div></a>';
    }).join("");
    var tableRows = items.slice(0, 6).map(function (item, idx) {
      return '<tr><td>' + esc(String(idx + 1)) + '</td><td><a href="' + keyProjectQueryHref("/gov/key-projects/detail", rt, { kpid: item.id }) + '"><b>' +
        esc(item.name) + '</b></a><div class="muted" style="margin-top:2px;font-size:11px;">' + esc(item.street_name + " / " + item.department) + '</div></td><td>' +
        esc(item.level) + '</td><td>' + esc(item.district_name) + '</td><td>' + esc(item.industry) + '</td><td>' +
        esc(fixed(item.total_invest, 1)) + '</td><td>' + esc(fixed(item.annual_done, 1)) + '</td><td>' + esc(item.progress + "%") + "</td></tr>";
    }).join("");
    var overviewCard = '<div class="kp-side-card kp-overview-card"><h3>项目数据总览</h3><div class="kp-metric-stack">' +
      '<a class="kp-metric-btn" href="' + keyProjectQueryHref("/gov/key-projects/list", rt, {}) + '"><b>' + esc(String(allSummary.count)) + '</b><span>项目总数</span></a>' +
      '<div class="kp-metric-row"><div class="kp-mini-metric"><label>总投资</label><strong>' + esc(fixed(allSummary.totalInvest, 1)) + ' 亿</strong></div><div class="kp-mini-metric"><label>固投总额</label><strong>' + esc(fixed(allSummary.fixedInvest, 1)) + ' 亿</strong></div></div>' +
      '<a class="kp-metric-btn warning" href="' + keyProjectQueryHref("/gov/key-projects/list", rt, { kpw: "1" }) + '"><b>' + esc(String(allSummary.warnings)) + '</b><span>预警项目</span></a></div></div>';
    var mergedProgressCard = '<div class="kp-side-card kp-progress-card"><h3>项目进度与阶段分布（2026）</h3><div class="kp-metric-stack"><div class="kp-metric-row kp-metric-row-compact"><div class="kp-mini-metric"><label>完成率</label><strong>' +
      esc(allSummary.completion + "%") + '</strong></div></div><div class="kp-metric-row"><div class="kp-mini-metric"><label>在建</label><strong>' +
      esc(String(allSummary.inBuild)) + '</strong></div><div class="kp-mini-metric"><label>完工</label><strong>' + esc(String(allSummary.done)) +
      '</strong></div></div><div class="kp-stage-summary"><div class="kp-stage-summary-head"><span>阶段分布</span><b>年度进度总览</b></div>' + stageRows + '</div></div></div>';
    return '<div class="kp-page fade-in"><div class="kp-topline"><div class="kp-topline-main">' + uiIcon('project') + '<span>重点项目调度专题</span></div><div class="kp-topline-actions"><a class="kp-back-link" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a></div></div>' +
      '<div class="kp-dashboard"><section class="kp-main-stage"><div class="kp-overview-band">' + overviewCard + mergedProgressCard + '</div><div class="kp-main-map-card">' + filterBar + keyProjectMapHtml(items, selected && selected.id, rt) + '</div></section>' +
      '<div class="kp-right-card kp-track-card">' +
        '<div class="kp-card-head"><div><span class="kp-card-kicker">动态排序</span><h3>项目情况追踪</h3></div><a class="btn" href="' +
      keyProjectQueryHref("/gov/key-projects/detail", rt, { kpid: selected ? selected.id : "" }) + '">查看详情</a></div>' +
        '<p class="kp-panel-note">按预警优先、按进度排序，便于锁定重点协调项目。</p><div class="kp-track-list">' + trackingRows + '</div>' +
      '</div>' +
      '<div class="kp-bottom-card kp-table-full"><div class="kp-card-head"><h3>重点项目跟踪表</h3><a class="btn" href="' +
      keyProjectQueryHref("/gov/key-projects/list", rt, {}) + '">进入项目目录</a></div><table class="table"><thead><tr><th>序号</th><th>项目名称</th><th>级别</th><th>所属区域</th><th>行业</th><th>总投资</th><th>固投完成</th><th>进度</th></tr></thead><tbody>' +
      (tableRows || '<tr><td colspan="8" class="muted">当前筛选下暂无项目。</td></tr>') + '</tbody></table></div>' +
      '</div></div>';
  }

  function pageGovKeyProjects(rt) {
    rt = rt || route();
    var allItems = keyProjectData();
    var items = keyProjectFiltered(rt);
    var summary = keyProjectSummary(items);
    var allSummary = keyProjectSummary(allItems);
    var filter = keyProjectFilterState(rt);
    var statusOptions = keyProjectOptions(allItems, "status");
    var deptOptions = keyProjectOptions(allItems, "department");
    var streetOptions = keyProjectOptions(allItems, "street_name");
    var tableLimit = 5;
    var updatedAt = today();
    var stageBuckets = keyProjectStageBuckets(items);
    var statusCounts = {};
    items.forEach(function (item) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    });
    var statusOrder = ["在建", "预备", "竣工"];
    var statusBuckets = statusOrder.concat(Object.keys(statusCounts).filter(function (label) {
      return statusOrder.indexOf(label) < 0;
    }).sort()).filter(function (label) {
      return statusCounts[label];
    }).map(function (label) {
      return { label: label, count: statusCounts[label] };
    });

    // --- zdxmdd-style KPI cards ---
    var kpiCards = '' +
      '<div class="glass-card zdx-kpi-card kpi-blue">' +
        '<div class="flex justify-between items-start"><div>' +
          '<p class="zdx-kpi-label">项目总数</p>' +
          '<h3 class="zdx-kpi-value text-slate-800">' + esc(String(summary.count)) + '<span class="unit text-blue-500">个</span></h3>' +
        '</div><div class="zdx-kpi-icon icon-blue">' + uiIcon("project", "text-xl") + '</div></div>' +
        '<div class="zdx-kpi-footer"><span class="zdx-kpi-highlight hl-blue">覆盖 ' + esc(String(allSummary.count)) + ' 个项目</span><span>当前口径</span></div>' +
      '</div>' +
      '<div class="glass-card zdx-kpi-card kpi-indigo">' +
        '<div class="flex justify-between items-start"><div>' +
          '<p class="zdx-kpi-label">总投资额</p>' +
          '<h3 class="zdx-kpi-value text-slate-800">' + esc(fixed(summary.totalInvest, 1)) + '<span class="unit text-indigo-500">亿元</span></h3>' +
        '</div><div class="zdx-kpi-icon icon-indigo">' + uiIcon("report", "text-xl") + '</div></div>' +
        '<div class="zdx-kpi-footer"><span class="zdx-kpi-highlight hl-indigo">年度计划 ' + esc(fixed(summary.annualPlan, 1)) + ' 亿</span><span>较去年同期</span></div>' +
      '</div>' +
      '<div class="glass-card zdx-kpi-card kpi-emerald">' +
        '<div class="flex justify-between items-start"><div>' +
          '<p class="zdx-kpi-label">固投总额</p>' +
          '<h3 class="zdx-kpi-value text-slate-800">' + esc(fixed(summary.fixedInvest, 1)) + '<span class="unit text-emerald-500">亿元</span></h3>' +
        '</div><div class="zdx-kpi-icon icon-emerald">' + uiIcon("dashboard", "text-xl") + '</div></div>' +
        '<div class="zdx-kpi-footer"><span class="zdx-kpi-highlight hl-emerald">年度完成 ' + esc(fixed(summary.annualDone, 1)) + ' 亿</span><span>月度增长</span></div>' +
      '</div>' +
      '<div class="glass-card zdx-kpi-card kpi-orange">' +
        '<div class="flex justify-between items-start"><div>' +
          '<p class="zdx-kpi-label">预警项目</p>' +
          '<h3 class="zdx-kpi-value text-orange-600">' + esc(String(summary.warnings)) + '<span class="unit text-orange-400">个</span></h3>' +
        '</div><div class="zdx-kpi-icon icon-orange zdx-animate-pulse-slow">' + uiIcon("alert", "text-xl") + '</div></div>' +
        '<div class="zdx-kpi-footer"><span class="zdx-kpi-highlight hl-red">高风险 ' + esc(String(summary.highWarnings)) + ' 个</span><span>较昨日</span></div>' +
      '</div>';

    // --- Charts section ---
    var chartsSection = '' +
      '<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">' +
        '<div class="lg:col-span-3 glass-card zdx-chart-card rounded-2xl p-6 flex flex-col items-center justify-center relative">' +
          '<div class="absolute top-5 left-5 zdx-chart-header"><div class="zdx-accent-dot"></div><span>总体完成率</span></div>' +
          '<div class="w-full h-56" id="zdx-completion-chart"></div>' +
          '<div class="text-center -mt-6"><p class="text-xs text-slate-400 font-medium">年度目标达成进度</p></div>' +
        '</div>' +
        '<div class="lg:col-span-5 glass-card zdx-chart-card rounded-2xl p-6">' +
          '<div class="zdx-chart-header"><div class="zdx-accent-dot"></div><span>进度阶段分布</span></div>' +
          '<div class="w-full h-64" id="zdx-stage-chart"></div>' +
        '</div>' +
        '<div class="lg:col-span-4 glass-card zdx-chart-card rounded-2xl p-6">' +
          '<div class="zdx-chart-header"><div class="zdx-accent-dot"></div><span>项目状态统计</span></div>' +
          '<div class="w-full h-64" id="zdx-status-chart"></div>' +
        '</div>' +
      '</div>';

    // --- Table rows ---
    var tableRows = items.slice(0, tableLimit).map(function (item, idx) {
      var statusTag = item.warning_level === "高" ? "status-tag-warning"
        : item.warning_level === "中" ? "status-tag-pending"
        : item.status === "竣工" ? "status-tag-done"
        : item.status === "在建" ? "status-tag-running"
        : "status-tag-pending";
      var statusText = (item.warning_level === "高" || item.warning_level === "中") ? "预警" : item.status;
      var prog = Number(item.progress) || 0;
      var progFill = prog >= 70 ? "fill-green" : prog >= 40 ? "fill-orange" : "fill-red";
      var progColor = prog >= 70 ? "text-emerald-600" : prog >= 40 ? "text-orange-600" : "text-red-500";
      return '<tr>' +
        '<td class="px-5 py-4 text-slate-400 font-mono text-xs">' + esc(String(idx + 1).padStart(2, "0")) + '</td>' +
        '<td class="px-5 py-4"><div class="font-semibold text-slate-700">' + esc(item.name) + '</div><div class="text-[10px] text-slate-400 mt-0.5">' + esc(item.address || "") + '</div></td>' +
        '<td class="px-5 py-4 text-slate-500">' + esc(item.dual_owner || item.department || "--") + '</td>' +
        '<td class="px-5 py-4 font-semibold text-indigo-600">' + esc(fixed(item.total_invest, 2)) + '</td>' +
        '<td class="px-5 py-4"><div class="zdx-progress-wrap"><div class="zdx-progress-bar"><div class="zdx-progress-fill ' + progFill + '" style="width:' + prog + '%"></div></div><span class="zdx-progress-text ' + progColor + '">' + prog + '%</span></div></td>' +
        '<td class="px-5 py-4"><span class="' + esc(statusTag) + ' px-2.5 py-1 rounded-full text-[10px] inline-block">' + esc(statusText) + '</span></td>' +
        '<td class="px-5 py-4 text-slate-500">' + esc(item.stage) + '</td>' +
        '<td class="px-5 py-4 text-right"><button class="zdx-detail-link" data-action="zdx_project_detail" data-zdx-idx="' + idx + '">查看详情 →</button></td>' +
        '</tr>';
    }).join("");

    var filterSummary = (filter.status || filter.dept || filter.street || filter.term || filter.warningOnly)
      ? "当前筛选命中 " + items.length + " / " + allSummary.count + " 个项目"
      : "共 " + items.length + " 条";

    var tableSection = '' +
      '<div class="glass-card rounded-2xl overflow-hidden">' +
        '<div class="p-6 border-b border-blue-100/60 flex flex-col md:flex-row md:items-center justify-between gap-4">' +
          '<div class="flex items-center gap-3"><div class="zdx-accent-dot" style="width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,#f97316,#fb923c);box-shadow:0 0 8px rgba(249,115,22,0.35)"></div><span class="text-sm font-bold text-slate-800">重点项目执行明细</span><span class="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">更新于 ' + esc(updatedAt) + '</span></div>' +
          '<div class="flex items-center space-x-3">' +
            '<div class="zdx-search-wrap"><span class="zdx-search-icon">&#128269;</span><input class="zdx-search-input" id="zdxSearchInput" placeholder="搜索项目名称/单位..." type="text" value="' + esc(filter.term) + '" /></div>' +
            '<button class="zdx-btn zdx-btn-primary" data-action="zdx_open_filter">筛选</button>' +
            '<button class="zdx-btn zdx-btn-outline" data-action="kp_export_overview">导出</button>' +
          '</div>' +
        '</div>' +
        '<div class="overflow-x-auto">' +
          '<table class="w-full text-left text-xs"><thead class="bg-[#F8FAFC] text-slate-600 border-b border-blue-100"><tr>' +
            '<th class="px-5 py-4 font-medium w-12">序号</th><th class="px-5 py-4 font-medium">项目名称</th><th class="px-5 py-4 font-medium">建设单位</th>' +
            '<th class="px-5 py-4 font-medium">总投资(亿)</th><th class="px-5 py-4 font-medium">完成进度</th><th class="px-5 py-4 font-medium">状态</th>' +
            '<th class="px-5 py-4 font-medium">当前阶段</th><th class="px-5 py-4 text-right font-medium">操作</th>' +
          '</tr></thead><tbody class="divide-y divide-slate-100/70">' +
          (tableRows || '<tr><td colspan="8" class="px-5 py-8 text-center text-slate-400">当前筛选下暂无项目。</td></tr>') +
          '</tbody></table>' +
        '</div>' +
        '<div class="px-6 py-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">' +
          '<p>' + esc(filterSummary) + '，显示 ' + esc(String(Math.min(items.length, tableLimit))) + ' 条</p>' +
          '<div class="flex items-center gap-1 text-[11px]"><span class="inline-block w-2 h-2 rounded-full bg-emerald-400"></span><span>正常</span><span class="ml-2 inline-block w-2 h-2 rounded-full bg-orange-400"></span><span>跟踪</span><span class="ml-2 inline-block w-2 h-2 rounded-full bg-red-400"></span><span>预警</span></div>' +
        '</div>' +
      '</div>';

    // --- Filter modal ---
    var filterModal = '' +
      '<div class="zdx-filter-modal-overlay" id="zdxFilterModal">' +
        '<div class="zdx-filter-modal-box">' +
          '<div class="zdx-filter-modal-header"><span>筛选条件</span><button class="zdx-filter-modal-close" data-action="zdx_close_filter">&times;</button></div>' +
          '<div class="zdx-filter-modal-body">' +
            '<div class="zdx-filter-item"><div class="zdx-filter-label">进度状态</div><div class="zdx-filter-options" data-zdx-filter-group="status">' +
              '<div class="zdx-filter-option' + (!filter.status ? ' active' : '') + '" data-zdx-fv="">全部</div>' +
              statusOptions.map(function (s) { return '<div class="zdx-filter-option' + (filter.status === s ? ' active' : '') + '" data-zdx-fv="' + esc(s) + '">' + esc(s) + '</div>'; }).join("") +
            '</div></div>' +
            '<div class="zdx-filter-item"><div class="zdx-filter-label">管理部门</div><div class="zdx-filter-options" data-zdx-filter-group="dept">' +
              '<div class="zdx-filter-option' + (!filter.dept ? ' active' : '') + '" data-zdx-fv="">全部</div>' +
              deptOptions.map(function (s) { return '<div class="zdx-filter-option' + (filter.dept === s ? ' active' : '') + '" data-zdx-fv="' + esc(s) + '">' + esc(s) + '</div>'; }).join("") +
            '</div></div>' +
            '<div class="zdx-filter-item"><div class="zdx-filter-label">所属街道</div><div class="zdx-filter-options" data-zdx-filter-group="street">' +
              '<div class="zdx-filter-option' + (!filter.street ? ' active' : '') + '" data-zdx-fv="">全部</div>' +
              streetOptions.map(function (s) { return '<div class="zdx-filter-option' + (filter.street === s ? ' active' : '') + '" data-zdx-fv="' + esc(s) + '">' + esc(s) + '</div>'; }).join("") +
            '</div></div>' +
            '<div class="flex justify-end mt-6 gap-3">' +
              '<button class="zdx-btn zdx-btn-outline" data-action="zdx_reset_filter">重置</button>' +
              '<button class="zdx-btn zdx-btn-primary" data-action="zdx_apply_filter">确定筛选</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // --- Project detail modal ---
    var projectModal = '' +
      '<div class="zdx-project-modal-overlay" id="zdxProjectModal">' +
        '<div class="zdx-project-modal-box">' +
          '<div class="zdx-project-modal-header"><span>项目详情</span><button class="zdx-project-modal-close" data-action="zdx_close_project_modal">&times;</button></div>' +
          '<div class="zdx-project-modal-body" id="zdxProjectModalBody"></div>' +
        '</div>' +
      '</div>';

    return '<div class="kp-page fade-in">' +
      '<div class="kp-topline"><div class="kp-topline-main">' + uiIcon('project') + '<span>重点项目调度专题</span></div><div class="kp-topline-actions"><a class="kp-back-link" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a></div></div>' +
      '<div class="kp-zdx-content"><div class="max-w-[1920px] mx-auto space-y-6">' +
        '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">' + kpiCards + '</div>' +
        chartsSection + tableSection +
      '</div></div>' +
      filterModal + projectModal +
    '</div>';
  }

  /* ---- zdx key-projects helper functions ---- */
  var _zdxCharts = [];
  function initZdxKeyProjectCharts() {
    zdxCleanupCharts();
    if (typeof echarts === "undefined") return;
    var rt = route();
    var items = keyProjectFiltered(rt);
    var summary = keyProjectSummary(items);
    var stageBuckets = keyProjectStageBuckets(items);

    // Gauge – completion
    var gaugeEl = document.getElementById("zdx-completion-chart");
    if (gaugeEl) {
      var g = echarts.init(gaugeEl);
      var completionVal = Math.round(summary.completion);
      var gaugeColor = completionVal >= 70 ? '#10b981' : completionVal >= 40 ? '#f97316' : '#ef4444';
      g.setOption({
        series: [{
          type: "gauge", startAngle: 210, endAngle: -30, min: 0, max: 100,
          progress: { show: true, width: 14, roundCap: true, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: gaugeColor }, { offset: 1, color: gaugeColor + 'cc' }] } } },
          pointer: { show: false },
          axisLine: { lineStyle: { width: 14, color: [[1, "#F1F5F9"]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: { valueAnimation: true, offsetCenter: [0, "5%"], fontSize: 36, fontWeight: "800", formatter: "{value}%", color: gaugeColor },
          data: [{ value: completionVal }],
          title: { show: false }
        }]
      });
      _zdxCharts.push(g);
    }

    // Bar – stage distribution
    var barEl = document.getElementById("zdx-stage-chart");
    if (barEl) {
      var b = echarts.init(barEl);
      b.setOption({
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#e2e8f0', borderWidth: 1, textStyle: { color: '#334155', fontSize: 12 }, extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-radius: 10px;' },
        grid: { left: 16, right: 20, top: 12, bottom: 8, containLabel: true },
        xAxis: { type: "category", data: stageBuckets.map(function (s) { return s.label; }), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#94a3b8', fontSize: 11 } },
        yAxis: { type: "value", splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }, axisLabel: { color: '#94a3b8', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
        series: [{
          type: "bar", data: stageBuckets.map(function (s, i) {
            var colors = ['#3b82f6', '#6366f1', '#f97316', '#f59e0b', '#10b981', '#06b6d4'];
            return { value: s.count, itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: colors[i % colors.length] }, { offset: 1, color: colors[i % colors.length] + '88' }]), borderRadius: [6, 6, 0, 0] } };
          }),
          barWidth: '45%',
          label: { show: true, position: 'top', color: '#475569', fontSize: 12, fontWeight: 600 }
        }]
      });
      _zdxCharts.push(b);
    }

    // Pie – status
    var pieEl = document.getElementById("zdx-status-chart");
    if (pieEl) {
      var p = echarts.init(pieEl);
      p.setOption({
        tooltip: { trigger: "item", backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#e2e8f0', borderWidth: 1, textStyle: { color: '#334155', fontSize: 12 }, extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-radius: 10px;' },
        legend: { orient: "vertical", right: "5%", top: "middle", textStyle: { color: '#64748b', fontSize: 12 }, icon: 'circle', itemWidth: 10, itemHeight: 10, itemGap: 14 },
        series: [{
          type: "pie", radius: ["52%", "78%"], center: ["38%", "50%"],
          data: [
            { value: summary.inBuild, name: "在建项目", itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [{ offset: 0, color: '#f97316' }, { offset: 1, color: '#fb923c' }]) } },
            { value: summary.done, name: "已完工", itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#34d399' }]) } },
            { value: summary.reserve, name: "待开工", itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#818cf8' }]) } }
          ],
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" }, scaleSize: 6, itemStyle: { shadowBlur: 16, shadowColor: 'rgba(0,0,0,0.12)' } },
          labelLine: { show: false },
          itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 2 }
        }]
      });
      _zdxCharts.push(p);
    }

    window.addEventListener("resize", zdxResizeCharts);
  }

  function zdxResizeCharts() {
    for (var i = 0; i < _zdxCharts.length; i++) {
      try { _zdxCharts[i].resize(); } catch (e) {}
    }
  }

  function zdxCleanupCharts() {
    window.removeEventListener("resize", zdxResizeCharts);
    for (var i = 0; i < _zdxCharts.length; i++) {
      try { _zdxCharts[i].dispose(); } catch (e) {}
    }
    _zdxCharts = [];
  }

  function zdxOpenProjectDetail(idx) {
    var rt = route();
    var items = keyProjectFiltered(rt);
    var item = items[idx];
    if (!item) return;
    var body = document.getElementById("zdxProjectModalBody");
    if (!body) return;
    var prog = Number(item.progress) || 0;
    var progColor = prog >= 70 ? '#10b981' : prog >= 40 ? '#f97316' : '#ef4444';
    var stageOrder = ["谋划储备", "手续办理", "主体施工", "设备安装", "场景装修", "完工投运"];
    var curStageIdx = stageOrder.indexOf(item.stage);
    var stagesHtml = stageOrder.map(function (s, i) {
      var cls = i < curStageIdx ? 'done' : i === curStageIdx ? 'active' : '';
      return '<div class="zdx-modal-stage-item ' + cls + '">' + esc(s) + '</div>';
    }).join('');
    body.innerHTML =
      '<h3 class="zdx-modal-title">' + esc(item.name) + '</h3>' +
      '<div class="zdx-modal-subtitle">' +
        '<span class="zdx-modal-badge badge-level">' + esc(item.level || "") + '</span>' +
        '<span class="zdx-modal-badge badge-type">' + esc(item.type || "") + '</span>' +
        '<span class="zdx-modal-badge badge-industry">' + esc(item.industry || "") + '</span>' +
      '</div>' +
      '<div class="zdx-modal-progress-section">' +
        '<div class="zdx-modal-progress-header"><span class="label">项目总体进度</span><span class="value" style="color:' + progColor + '">' + prog + '%</span></div>' +
        '<div class="zdx-modal-progress-bar"><div class="fill" style="width:' + prog + '%;background:linear-gradient(90deg,' + progColor + ',' + progColor + 'aa)"></div></div>' +
        '<div class="zdx-modal-stages">' + stagesHtml + '</div>' +
      '</div>' +
      '<div class="zdx-modal-info-row">' +
        '<div class="zdx-modal-info-item"><span class="zdx-modal-info-label">建设单位</span><span class="zdx-modal-info-value">' + esc(item.dual_owner || item.department || "--") + '</span></div>' +
        '<div class="zdx-modal-info-item"><span class="zdx-modal-info-label">总投资</span><span class="zdx-modal-info-value">' + esc(fixed(item.total_invest, 2)) + ' 亿元</span></div>' +
        '<div class="zdx-modal-info-item"><span class="zdx-modal-info-label">年度计划</span><span class="zdx-modal-info-value">' + esc(fixed(item.annual_plan, 2)) + ' 亿元</span></div>' +
        '<div class="zdx-modal-info-item"><span class="zdx-modal-info-label">年度完成</span><span class="zdx-modal-info-value">' + esc(fixed(item.annual_done, 2)) + ' 亿元</span></div>' +
        '<div class="zdx-modal-info-item"><span class="zdx-modal-info-label">所属街道</span><span class="zdx-modal-info-value">' + esc(item.street_name || "--") + '</span></div>' +
        '<div class="zdx-modal-info-item"><span class="zdx-modal-info-label">计划周期</span><span class="zdx-modal-info-value">' + esc((item.start_plan || "--") + " ~ " + (item.end_plan || "--")) + '</span></div>' +
      '</div>' +
      '<div class="zdx-modal-desc"><b>项目简介：</b>' + esc(item.summary || item.name + "是青羊区重点建设项目。") + '</div>' +
      (item.issue ? '<div class="zdx-modal-issue"><b>当前问题：</b>' + esc(item.issue) + '</div>' : '');
    var modal = document.getElementById("zdxProjectModal");
    if (modal) modal.classList.add("show");
  }

  function zdxCloseProjectDetail(e) {
    var modal = document.getElementById("zdxProjectModal");
    if (modal) modal.classList.remove("show");
  }

  function zdxOpenFilterModal() {
    var modal = document.getElementById("zdxFilterModal");
    if (modal) modal.classList.add("show");
  }

  function zdxCloseFilterModal(e) {
    var modal = document.getElementById("zdxFilterModal");
    if (modal) modal.classList.remove("show");
  }

  function zdxApplyFilter() {
    var rt = route();
    var patch = {};
    var groups = document.querySelectorAll("[data-zdx-filter-group]");
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var field = group.getAttribute("data-zdx-filter-group");
      var active = group.querySelector(".zdx-filter-option.active");
      var val = active ? active.getAttribute("data-zdx-fv") : "";
      patch[field] = val;
    }
    zdxCloseFilterModal();
    location.hash = keyProjectQueryHref("/gov/key-projects", rt, patch);
  }

  function zdxResetFilter() {
    var rt = route();
    location.hash = keyProjectQueryHref("/gov/key-projects", rt, { status: "", dept: "", street: "", term: "", warningOnly: "" });
    zdxCloseFilterModal();
  }

  function pageGovKeyProjectCatalog(rt) {
    rt = rt || route();
    var items = keyProjectFiltered(rt);
    var filter = keyProjectFilterState(rt);
    var allItems = keyProjectData();
    var statusOptions = keyProjectOptions(allItems, "status");
    var deptOptions = keyProjectOptions(allItems, "department");
    var streetOptions = keyProjectOptions(allItems, "street_name");
    var tableRows = items.map(function (item, idx) {
      return '<tr><td>' + esc(String(idx + 1)) + '</td><td><a href="' + keyProjectQueryHref("/gov/key-projects/detail", rt, { kpid: item.id }) + '"><b>' +
        esc(item.name) + '</b></a></td><td>' + esc(item.type) + '</td><td>' + esc(item.street_name) + '</td><td><span class="tag ' + esc(item.progress_class) + '">' +
        esc(item.status) + '</span></td></tr>';
    }).join("");
    return '<div class="kp-directory-page fade-in"><div class="kp-topline"><div class="kp-topline-main"><span>重点项目目录</span></div><div class="kp-topline-actions"><a class="kp-back-link" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a></div></div><section class="kp-directory-card"><div class="kp-filter-bar"><div class="kp-filter-group"><span>筛选</span><select data-kp-filter="status"><option value="">项目状态</option>' +
      statusOptions.map(function (item) { return '<option value="' + esc(item) + '"' + (filter.status === item ? " selected" : "") + ">" + esc(item) + "</option>"; }).join("") +
      '</select><select data-kp-filter="dept"><option value="">管理部门</option>' + deptOptions.map(function (item) { return '<option value="' + esc(item) + '"' + (filter.dept === item ? " selected" : "") + ">" + esc(item) + "</option>"; }).join("") +
      '</select><select data-kp-filter="street"><option value="">所属街道</option>' + streetOptions.map(function (item) { return '<option value="' + esc(item) + '"' + (filter.street === item ? " selected" : "") + ">" + esc(item) + "</option>"; }).join("") +
      '</select></div><form class="kp-search-form" data-kp-search><input class="kp-search-input" name="q" value="' + esc(filter.term) + '" placeholder="输入项目名称或区域关键词" /><button class="btn" type="submit">检索</button></form></div><div class="kp-directory-table-wrap"><table class="table kp-directory-table"><thead><tr><th>序号</th><th>项目名称</th><th>项目类型</th><th>所属区域</th><th>项目状态</th></tr></thead><tbody>' +
      (tableRows || '<tr><td colspan="5" class="muted">当前筛选下暂无项目。</td></tr>') + '</tbody></table><p class="kp-directory-hint">点击具体项目可进入独立的“重点项目详情”页面。</p></div></section></div>';
  }

  function pageGovKeyProjectDetail(rt) {
    rt = rt || route();
    var allItems = keyProjectData();
    var items = keyProjectFiltered(rt);
    var selected = keyProjectSelected(rt, items, allItems);
    return '<div class="kp-detail-page fade-in"><div class="kp-topline"><div class="kp-topline-main"><span>重点项目详情</span></div><div class="kp-topline-actions"><a class="kp-back-link" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a></div></div><section class="kp-detail-card"><div class="kp-topline sub"><div class="kp-topline-main"><a class="kp-back-link" href="' +
      keyProjectQueryHref("/gov/key-projects/list", rt, {}) + '">返回项目目录</a><span>项目详情信息</span></div></div>' + keyProjectDetailPanel(selected) +
      '<div class="kp-detail-footer-note">当前以关键指标、推进阶段和关联分析为主，后续可继续补充批文、附件和调度纪要。</div></section></div>';
  }

  function decisionSpeechSeed() {
    return [
      { id: "sp1", title: "关于低空经济场景培育工作的讲话摘要", level: "省领导言论", date: "2026-03-14", topic: "低空经济", keyword: "低空, 场景, 试点", summary: "强调要围绕低空应用、适航服务和试点场景建设一体推进，优先形成可展示的示范项目。", detail: "建议围绕黄田坝、府南等街道优先布局低空项目，形成应用场景与产业承载的双向牵引。", source: "专题讲话整理" },
      { id: "sp2", title: "市领导关于重点项目推进调度的讲话要点", level: "市领导言论", date: "2026-03-11", topic: "重点项目", keyword: "重点项目, 调度, 投资", summary: "要求压实项目节点责任，针对预警项目逐一形成责任清单和时间表。", detail: "重点聚焦建设路数字文博、桂溪智算中试、东大街金融服务港等项目，建立按周跟踪机制。", source: "项目调度会整理" },
      { id: "sp3", title: "区领导关于文旅消费提振的讲话纪要", level: "区领导言论", date: "2026-03-08", topic: "文旅消费", keyword: "文旅, 演艺, 消费", summary: "提出以少城、浆洗街等片区为抓手，推动文旅演艺和夜游项目形成新的消费爆点。", detail: "要把沉浸式演艺项目与老城区街区更新结合起来，形成特色项目和夜间经济示范。", source: "区文旅专题会" },
      { id: "sp4", title: "关于金融服务实体经济的领导讲话摘编", level: "市领导言论", date: "2026-02-26", topic: "金融服务", keyword: "金融, 实体, 风控", summary: "强调要通过金融科技和风控服务提升重点项目、重点企业的融资可得性。", detail: "建议把东大街金融服务港项目作为金融服务实体经济的展示点。", source: "金融工作专题会" },
      { id: "sp5", title: "省领导关于消费场景更新的讲话整理", level: "省领导言论", date: "2026-02-17", topic: "新消费", keyword: "消费, 品牌, 场景", summary: "要求在重点街区和楼宇中培育品牌首店和新消费场景。", detail: "草市街、牛市口等街道可结合项目建设同步推进品牌招商。", source: "省级专题讲话" },
      { id: "sp6", title: "区领导关于招商补链工作的最新部署", level: "区领导言论", date: "2026-03-16", topic: "招商补链", keyword: "招商, 产业链, 补链", summary: "提出围绕薄弱环节、重点项目和承载空间形成招商落点清单。", detail: "重点围绕航空航天、人工智能、文旅等领域，做到项目、载体、企业三位一体展示。", source: "区招商工作会" }
    ];
  }

  function decisionMeetingSeed() {
    return [
      { id: "mt1", title: "国家级低空经济试点工作推进会", level: "国家级会议", date: "2026-03-12", topic: "低空经济", keyword: "试点, 低空, 调度", summary: "会议聚焦低空经济试点落地和跨部门协同。", detail: "提出要把应用场景、试点项目和产业承载统筹推进，形成市区两级联动机制。", source: "会议纪要整理" },
      { id: "mt2", title: "省级重点项目投资调度会", level: "省级会议", date: "2026-03-09", topic: "重点项目", keyword: "投资, 调度, 进度", summary: "围绕年度固定资产投资和项目推进进行调度。", detail: "要求紧盯市重点、区重点项目的进度偏差，及时形成预警和协调事项。", source: "省发改系统会" },
      { id: "mt3", title: "市级招商引资专题分析会", level: "市级会议", date: "2026-03-15", topic: "招商引资", keyword: "招商, 载体, 产业", summary: "重点研究招商线索、主导产业补链方向和承载园区匹配。", detail: "建议将招商分析专题和重点项目专题联动，形成项目储备与承接空间对照。", source: "市级专题分析" },
      { id: "mt4", title: "市级文旅消费工作推进会", level: "市级会议", date: "2026-02-28", topic: "文旅消费", keyword: "文旅, 消费, 夜游", summary: "研究文旅消费提振、演艺项目建设和夜游经济发展。", detail: "少城和浆洗街片区项目被列为重点观察对象。", source: "市文旅工作会" },
      { id: "mt5", title: "省级金融服务实体经济联席会", level: "省级会议", date: "2026-02-21", topic: "金融服务", keyword: "金融, 实体, 风险", summary: "要求围绕重点项目、重点企业提升金融支持效率。", detail: "涉及东大街金融服务港、企业画像和政策匹配联动的相关要求。", source: "联席会议纪要" },
      { id: "mt6", title: "国家级数据要素发展研讨会", level: "国家级会议", date: "2026-03-05", topic: "数据要素", keyword: "数据, 平台, 治理", summary: "围绕数据治理、场景应用和区域协同进行讨论。", detail: "对领导决策数据专题中的讲话、会议分析提供了方法参考。", source: "研讨纪要" }
    ];
  }

  function decisionBaseDate() {
    return new Date("2026-03-19T00:00:00+08:00");
  }

  function decisionRecordById(kind, id) {
    var list = kind === "meeting" ? decisionMeetingSeed() : decisionSpeechSeed();
    return list.find(function (item) { return item.id === id; }) || null;
  }

  function decisionFilterRecords(records, startDate, endDate, level, term, legacyPeriod) {
    var baseDate = decisionBaseDate();
    return records.filter(function (item) {
      if (level && item.level !== level) return false;
      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;
      if (!startDate && !endDate && legacyPeriod && Number(legacyPeriod) > 0) {
        var diff = (baseDate - new Date(item.date + "T00:00:00+08:00")) / 86400000;
        if (diff > Number(legacyPeriod)) return false;
      }
      if (term) {
        var hay = [item.title, item.topic, item.keyword, item.summary, item.detail].join(" ").toLowerCase();
        if (hay.indexOf(term.toLowerCase()) < 0) return false;
      }
      return true;
    });
  }

  function openDecisionRecord(kind, id) {
    var item = decisionRecordById(kind, id);
    if (!item) return;
    modalOpen(
      (kind === "meeting" ? "会议详情" : "讲话详情") + " · " + item.title,
      '<div class="decision-modal"><p><span class="tag teal">' + esc(item.level) + '</span><span class="tag">' + esc(item.date) + '</span><span class="tag orange">' +
      esc(item.topic) + '</span></p><p><b>' + esc(item.title) + '</b></p><p class="muted" style="margin-top:10px;line-height:1.8;">' + esc(item.summary) +
      '</p><div class="decision-modal-block"><h4>主要内容</h4><p>' + esc(item.detail) + '</p></div><div class="decision-modal-block"><h4>关键词</h4><p>' +
      esc(item.keyword) + '</p></div><div class="decision-modal-block"><h4>数据来源</h4><p>' + esc(item.source) + '</p></div><div class="row-actions"><button class="btn" data-action="modal_close">关闭</button></div></div>'
    );
  }

  function decisionKeywordStats(records) {
    var stats = {};
    records.forEach(function (item) {
      String(item.keyword || "").split(/[，,、]/).forEach(function (part) {
        var key = String(part || "").trim();
        if (!key) return;
        stats[key] = (stats[key] || 0) + 1;
      });
    });
    return Object.keys(stats).map(function (key) {
      return { label: key, count: stats[key] };
    }).sort(function (a, b) {
      return b.count - a.count || a.label.localeCompare(b.label, "zh-CN");
    });
  }

  function decisionGroupStats(records, field) {
    var stats = {};
    records.forEach(function (item) {
      var key = item[field] || "未分类";
      stats[key] = (stats[key] || 0) + 1;
    });
    return Object.keys(stats).map(function (key) {
      return { label: key, count: stats[key] };
    }).sort(function (a, b) {
      return b.count - a.count || a.label.localeCompare(b.label, "zh-CN");
    });
  }

  function decisionRangeSummary(startDate, endDate, legacyPeriod) {
    if (startDate && endDate) return startDate + " 至 " + endDate;
    if (startDate) return startDate + " 起";
    if (endDate) return "截至 " + endDate;
    if (legacyPeriod) return "近" + legacyPeriod + "天";
    return "全部时间";
  }

  function qingyangDecisionLibrary() {
    return (seed.qingyang_real_docs && seed.qingyang_real_docs.documents) || [];
  }

  function qingyangAnnualStats() {
    return (seed.qingyang_real_docs && seed.qingyang_real_docs.annual_stats) || [];
  }

  function qingyangRealMeta() {
    return (seed.qingyang_real_docs && seed.qingyang_real_docs.meta) || {};
  }

  function qingyangLatestAnnualStat() {
    var list = qingyangAnnualStats();
    return list && list.length ? list[0] : null;
  }

  function decisionQingyangLibraryPanel() {
    var docs = qingyangDecisionLibrary();
    var annualStats = qingyangAnnualStats().slice(0, 4);
    var latest = qingyangLatestAnnualStat();
    if (!docs.length && !annualStats.length) return "";
    var highlightHtml = latest
      ? '<div class="decision-library-highlight"><article class="decision-library-highlight-item"><span>最新公报年度</span><strong>' +
        esc(String(latest.year || "--")) +
        '</strong></article><article class="decision-library-highlight-item"><span>地区生产总值</span><strong>' +
        esc(latest.gdp_billion ? latest.gdp_billion + "亿元" : "--") +
        '</strong></article><article class="decision-library-highlight-item"><span>税收收入</span><strong>' +
        esc(latest.tax_revenue_billion ? latest.tax_revenue_billion + "亿元" : "--") +
        '</strong></article><article class="decision-library-highlight-item"><span>固定资产投资增速</span><strong>' +
        esc(latest.fixed_asset_growth_pct ? latest.fixed_asset_growth_pct + "%" : "--") +
        '</strong></article><article class="decision-library-highlight-item"><span>居民人均可支配收入</span><strong>' +
        esc(latest.resident_income_yuan ? latest.resident_income_yuan + "元" : "--") +
        '</strong></article><article class="decision-library-highlight-item"><span>游客接待量</span><strong>' +
        esc(latest.tourist_visits_10k ? latest.tourist_visits_10k + "万人次" : "--") +
        '</strong></article><article class="decision-library-highlight-item"><span>进出口总额</span><strong>' +
        esc(latest.import_export_billion ? latest.import_export_billion + "亿元" : "--") +
        '</strong></article></div>'
      : "";
    var docRows = docs.slice(0, 8).map(function (item) {
      return '<li><span class="decision-library-type">' + esc(item.type || "资料") + '</span><div><b>' +
        esc(item.title || "青羊区资料") + '</b><span>' + esc(String(item.year || "--") + " · " + (item.summary || "已纳入专题资料库")) + "</span></div></li>";
    }).join("");
    var statCards = annualStats.map(function (item) {
      var metrics = [];
      if (item.gdp_billion) metrics.push("GDP " + item.gdp_billion + "亿元");
      if (item.tertiary_billion) metrics.push("三产 " + item.tertiary_billion + "亿元");
      if (item.industrial_billion) metrics.push("工业 " + item.industrial_billion + "亿元");
      if (item.fixed_asset_growth_pct) metrics.push("固投增长 " + item.fixed_asset_growth_pct + "%");
      if (item.social_retail_billion) metrics.push("社零总额 " + item.social_retail_billion + "亿元");
      if (item.public_budget_billion) metrics.push("一般公共预算 " + item.public_budget_billion + "亿元");
      if (item.tax_revenue_billion) metrics.push("税收收入 " + item.tax_revenue_billion + "亿元");
      if (item.resident_income_yuan) metrics.push("居民收入 " + item.resident_income_yuan + "元");
      if (item.tourist_visits_10k) metrics.push("游客接待 " + item.tourist_visits_10k + "万人次");
      if (item.import_export_billion) metrics.push("进出口 " + item.import_export_billion + "亿元");
      if (item.fdi_usd_billion) metrics.push("利用外资 " + item.fdi_usd_billion + "亿美元");
      if (item.real_estate_investment_growth_pct) metrics.push("房地产投资 " + item.real_estate_investment_growth_pct + "%");
      return '<article class="decision-library-stat"><strong>' + esc(String(item.year || "--")) +
        '</strong><span>' + esc(metrics.join(" · ") || "已纳入年度统计摘要") + "</span></article>";
    }).join("");
    return '<section class="decision-library-panel"><div class="decision-panel-head"><h3>青羊区统计资料库</h3><span>已纳入真实资料 ' +
      esc(String(docs.length)) + ' 份</span></div><div class="decision-library-grid"><div class="decision-library-block"><p class="decision-library-label">年度统计摘要</p>' +
      highlightHtml + '<div class="decision-library-stats">' +
      (statCards || '<div class="decision-empty">暂无年度统计摘要。</div>') + '</div></div><div class="decision-library-block"><p class="decision-library-label">统计公报 / 年鉴目录</p><ul class="decision-library-list">' +
      (docRows || '<li class="decision-empty">暂无资料目录。</li>') + "</ul></div></div></section>";
  }

  function decisionAnalysisPanel(kind, records, opts) {
    var topicStats = decisionGroupStats(records, "topic");
    var levelStats = decisionGroupStats(records, "level");
    var keywordStats = decisionKeywordStats(records);
    var latest = records.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); })[0] || null;
    var topTopic = topicStats[0] || null;
    var topLevel = levelStats[0] || null;
    var topKeyword = keywordStats[0] || null;
    var summary = decisionRangeSummary(opts.startDate, opts.endDate, opts.legacyPeriod);
    var insight = !records.length
      ? "当前时间区间和筛选条件下暂无数据，建议放宽日期范围或清空关键词后再次分析。"
      : "当前共命中 " + records.length + (kind === "speech" ? " 条讲话，" : " 场会议，") + "主导主题为“" +
        (topTopic ? topTopic.label : "未分类") + "”，主要层级为“" + (topLevel ? topLevel.label : "未分类") +
        "”，高频关键词为“" + (topKeyword ? topKeyword.label : "暂无") + "”。";
    return '<section class="decision-analysis-board compact"><div class="decision-analysis-strip"><div class="decision-analysis-summary"><div class="decision-analysis-title-row"><span class="decision-analysis-kicker">' +
      esc(kind === "speech" ? "SPEECH ANALYSIS" : "MEETING ANALYSIS") + '</span><h3>' + esc(kind === "speech" ? "领导讲话研判摘要" : "会议纪要研判摘要") +
      '</h3><div class="decision-analysis-meta"><span class="tag teal">' + esc(summary) + '</span><span class="tag">' +
      esc(records.length ? "已命中 " + records.length + " 条" : "暂无命中记录") + '</span></div></div><p>当前视图基于筛选后的' +
      esc(kind === "speech" ? "领导讲话" : "会议纪要") + '数据生成紧凑摘要，便于快速浏览重点信号。</p></div><div class="decision-analysis-metrics">' +
      '<article class="decision-analysis-pill"><span>记录数</span><strong>' + esc(String(records.length)) + '</strong></article>' +
      '<article class="decision-analysis-pill"><span>最新日期</span><strong>' + esc(latest ? latest.date : "--") + '</strong></article>' +
      '<article class="decision-analysis-pill"><span>主导主题</span><strong>' + esc(topTopic ? topTopic.label : "--") + '</strong></article>' +
      '<article class="decision-analysis-pill"><span>高频关键词</span><strong>' + esc(topKeyword ? topKeyword.label : "--") + '</strong></article>' +
      '</div><div class="decision-analysis-brief"><span>分析结论</span><p>' + esc(insight) + "</p></div></div></section>";
  }

  function decisionDualAnalysisPanel(speeches, meetings, speechOpts, meetingOpts) {
    return '<div class="decision-analysis-dual">' +
      decisionAnalysisPanel("speech", speeches, speechOpts) +
      decisionAnalysisPanel("meeting", meetings, meetingOpts) +
      "</div>";
  }

  function maybeFocusDecisionSection(rt) {
    if (!rt || rt.path !== "/gov/decision-data") return;
    var q = rt.q || {};
    if (!q.ddfocus) return;
    var view = q.ddv || "";
    var id = view === "speech" ? "decision-speech-panel" : view === "meeting" ? "decision-meeting-panel" : "";
    if (!id) return;
    var run = function () {
      var target = document.getElementById(id);
      if (!target) return;
      try {
        target.scrollIntoView({ block: "start" });
      } catch (e) {
        target.scrollIntoView();
      }
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(function () {
        requestAnimationFrame(run);
      });
    } else {
      setTimeout(run, 40);
    }
  }

  function pageGovDecisionData(rt) {
    rt = rt || route();
    var q = rt.q || {};
    var decisionView = q.ddv || "speech";
    var speechLevel = q.dsl || "";
    var speechPeriod = q.dsp || "30";
    var speechStart = q.dss || "";
    var speechEnd = q.dse || "";
    var speechTerm = (q.dsq || "").trim();
    var meetingLevel = q.dml || "";
    var meetingPeriod = q.dmp || "30";
    var meetingStart = q.dms || "";
    var meetingEnd = q.dme || "";
    var meetingTerm = (q.dmq || "").trim();
    var speeches = decisionFilterRecords(govDemoDecisionRecords(decisionSpeechSeed()), speechStart, speechEnd, speechLevel, speechTerm, speechPeriod);
    var meetings = decisionFilterRecords(govDemoDecisionRecords(decisionMeetingSeed()), meetingStart, meetingEnd, meetingLevel, meetingTerm, meetingPeriod);
    var href = function (patch) { return keyProjectQueryHref("/gov/decision-data", rt, patch); };
    var analysisHtml = decisionDualAnalysisPanel(
      speeches,
      meetings,
      { startDate: speechStart, endDate: speechEnd, legacyPeriod: speechPeriod },
      { startDate: meetingStart, endDate: meetingEnd, legacyPeriod: meetingPeriod }
    );
    var libraryHtml = decisionQingyangLibraryPanel();
    var speechItems = speeches.map(function (item) {
      return '<button class="decision-record" data-action="decision_open_item" data-kind="speech" data-id="' + esc(item.id) + '"><div><b>' +
        esc(item.title) + '</b><span>' + esc(item.level + " · " + item.date) + '</span></div><em>' + esc(item.topic) + '</em></button>';
    }).join("");
    var meetingItems = meetings.map(function (item) {
      return '<button class="decision-record" data-action="decision_open_item" data-kind="meeting" data-id="' + esc(item.id) + '"><div><b>' +
        esc(item.title) + '</b><span>' + esc(item.level + " · " + item.date) + '</span></div><em>' + esc(item.topic) + '</em></button>';
    }).join("");
    var speechTopics = {};
    var meetingTopics = {};
    speeches.forEach(function (item) { speechTopics[item.topic] = (speechTopics[item.topic] || 0) + 1; });
    meetings.forEach(function (item) { meetingTopics[item.topic] = (meetingTopics[item.topic] || 0) + 1; });
    var speechStats = Object.keys(speechTopics).map(function (key) { return "<li>" + esc(key + " · " + speechTopics[key] + " 条") + "</li>"; }).join("");
    var meetingStats = Object.keys(meetingTopics).map(function (key) { return "<li>" + esc(key + " · " + meetingTopics[key] + " 场") + "</li>"; }).join("");
    return '<div class="decision-page fade-in"><div class="decision-topline"><div class="decision-topline-main">' + uiIcon('decision') + '<span class="decision-topline-title">领导决策支撑专题</span></div><div class="decision-mode-switch"><a class="decision-mode-btn ' +
      (decisionView === "speech" ? "active" : "") + '" href="' + href({ ddv: "speech", ddfocus: "1" }) + '">领导讲话研判</a><a class="decision-mode-btn ' + (decisionView === "meeting" ? "active" : "") +
      '" href="' + href({ ddv: "meeting", ddfocus: "1" }) + '">会议纪要研判</a><a class="decision-back-link" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a></div></div>' +
      '<div class="decision-mode-bar"><a class="decision-mode-btn ' +
      (decisionView === "speech" ? "active" : "") + '" href="' + href({ ddv: "speech", ddfocus: "1" }) + '">领导讲话研判</a><a class="decision-mode-btn ' + (decisionView === "meeting" ? "active" : "") +
      '" href="' + href({ ddv: "meeting", ddfocus: "1" }) + '">会议纪要研判</a></div>' + analysisHtml +
      '<div class="decision-grid"><section id="decision-speech-panel" class="decision-panel' + (decisionView === "speech" ? " focus" : "") + '"><div class="decision-panel-head"><h3>领导讲话列表</h3></div><div class="decision-toolbar"><form class="decision-range-form" data-decision-range="speech"><label>起止日期：</label><input type="date" name="start" value="' +
      esc(speechStart) + '" /><span>至</span><input type="date" name="end" value="' + esc(speechEnd) + '" /><button class="btn" type="submit">应用</button><a class="btn" href="' +
      href({ dss: "", dse: "", dsp: "", ddv: "speech" }) + '">清空</a></form><form class="decision-search-form" data-decision-search="speech"><input value="' + esc(speechTerm) +
      '" placeholder="输入讲话主题、关键词或摘要内容" /><button class="btn" type="submit">搜索</button></form></div><div class="decision-tabs"><a href="' + href({ dsl: "省领导言论", ddv: "speech" }) + '" class="' +
      (speechLevel === "省领导言论" ? "active" : "") + '">省领导言论</a><a href="' + href({ dsl: "市领导言论", ddv: "speech" }) + '" class="' + (speechLevel === "市领导言论" ? "active" : "") + '">市领导言论</a><a href="' +
      href({ dsl: "区领导言论", ddv: "speech" }) + '" class="' + (speechLevel === "区领导言论" ? "active" : "") + '">区领导言论</a><a href="' + href({ dsl: "", ddv: "speech" }) + '" class="' + (!speechLevel ? "active" : "") + '">全部</a></div><div class="decision-record-list">' +
      (speechItems || '<div class="decision-empty">当前筛选下暂无领导讲话。</div>') + '</div></section><aside class="decision-stat-panel"><div class="decision-stat-head"><h3>文档分析统计</h3></div><ol><li>当前领导讲话总数统计：<b>' +
      esc(String(speeches.length)) + '</b></li><li>领导讲话主题分类统计</li></ol><ul>' + (speechStats || "<li>暂无统计数据</li>") +
      '</ul></aside><section id="decision-meeting-panel" class="decision-panel' + (decisionView === "meeting" ? " focus" : "") + '"><div class="decision-panel-head"><h3>会议列表</h3></div><div class="decision-toolbar"><form class="decision-range-form" data-decision-range="meeting"><label>起止日期：</label><input type="date" name="start" value="' +
      esc(meetingStart) + '" /><span>至</span><input type="date" name="end" value="' + esc(meetingEnd) + '" /><button class="btn" type="submit">应用</button><a class="btn" href="' +
      href({ dms: "", dme: "", dmp: "", ddv: "meeting" }) + '">清空</a></form><form class="decision-search-form" data-decision-search="meeting"><input value="' + esc(meetingTerm) +
      '" placeholder="输入会议主题、关键词或纪要内容" /><button class="btn" type="submit">搜索</button></form></div><div class="decision-tabs"><a href="' + href({ dml: "国家级会议", ddv: "meeting" }) + '" class="' +
      (meetingLevel === "国家级会议" ? "active" : "") + '">国家级会议</a><a href="' + href({ dml: "省级会议", ddv: "meeting" }) + '" class="' + (meetingLevel === "省级会议" ? "active" : "") + '">省级会议</a><a href="' +
      href({ dml: "市级会议", ddv: "meeting" }) + '" class="' + (meetingLevel === "市级会议" ? "active" : "") + '">市级会议</a><a href="' + href({ dml: "", ddv: "meeting" }) + '" class="' + (!meetingLevel ? "active" : "") + '">全部</a></div><div class="decision-record-list">' +
      (meetingItems || '<div class="decision-empty">当前筛选下暂无会议记录。</div>') + '</div></section><aside class="decision-stat-panel"><div class="decision-stat-head"><h3>会议研判统计</h3></div><ol><li>当前会议总数统计：<b>' +
      esc(String(meetings.length)) + '</b></li><li>会议议题分类统计</li></ol><ul>' + (meetingStats || "<li>暂无统计数据</li>") +
      '</ul></aside></div>' + libraryHtml + '<div class="decision-note-strip"><ol><li>顶部同时展示讲话与会议摘要，便于横向对比重点信号。</li><li>顶部按钮可直接定位到对应列表，支持日期、分类和关键词联合筛选。</li><li>点击具体标题可查看详情，当前演示版以弹窗形式展示。</li></ol></div></div>';
  }

  function pageGovDecisionDataV2(rt) {
    rt = rt || route();
    var q = rt.q || {};
    var decisionView = q.ddv || "speech";
    var speechLevel = q.dsl || "";
    var speechPeriod = q.dsp || "30";
    var speechStart = q.dss || "";
    var speechEnd = q.dse || "";
    var speechTerm = (q.dsq || "").trim();
    var speechPage = Math.max(1, parseInt(q.dspg || "1", 10) || 1);
    var meetingLevel = q.dml || "";
    var meetingPeriod = q.dmp || "30";
    var meetingStart = q.dms || "";
    var meetingEnd = q.dme || "";
    var meetingTerm = (q.dmq || "").trim();
    var meetingPage = Math.max(1, parseInt(q.dmpg || "1", 10) || 1);
    var decisionPageSize = 5;
    var speeches = decisionFilterRecords(govDemoDecisionRecords(decisionSpeechSeed()), speechStart, speechEnd, speechLevel, speechTerm, speechPeriod);
    var meetings = decisionFilterRecords(govDemoDecisionRecords(decisionMeetingSeed()), meetingStart, meetingEnd, meetingLevel, meetingTerm, meetingPeriod);
    var href = function (patch) { return keyProjectQueryHref("/gov/decision-data", rt, patch); };

    function overviewMeta(kind, records, startDate, endDate, legacyPeriod) {
      var topicStats = decisionGroupStats(records, "topic");
      var levelStats = decisionGroupStats(records, "level");
      var keywordStats = decisionKeywordStats(records);
      var latest = records.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); })[0] || null;
      var topTopic = topicStats[0] || null;
      var topLevel = levelStats[0] || null;
      var topKeyword = keywordStats[0] || null;
      var summary = decisionRangeSummary(startDate, endDate, legacyPeriod);
      var insight = !records.length
        ? "当前筛选条件下暂无数据，建议放宽日期范围或清空关键词后再次研判。"
        : "当前共命中 " + records.length + (kind === "speech" ? " 条讲话，" : " 场会议，") +
          "主导主题为“" + (topTopic ? topTopic.label : "未分类") + "”，主要层级为“" + (topLevel ? topLevel.label : "未分类") +
          "”，高频关键词为“" + (topKeyword ? topKeyword.label : "暂无") + "”。";
      return {
        latest: latest,
        topTopic: topTopic,
        topLevel: topLevel,
        topKeyword: topKeyword,
        topicStats: topicStats,
        summary: summary,
        insight: insight
      };
    }

    function recordListHtml(kind, records) {
      return records.map(function (item) {
        return '<button class="decision-record" data-action="decision_open_item" data-kind="' + esc(kind) + '" data-id="' + esc(item.id) + '"><div><b>' +
          esc(item.title) + '</b><span>' + esc(item.level + " · " + item.date) + '</span></div><em>' + esc(item.topic) + '</em></button>';
      }).join("");
    }

    function decisionPaginationHtml(kind, totalCount, page, totalPages) {
      if (totalCount <= decisionPageSize) return "";
      var pageField = kind === "speech" ? "dspg" : "dmpg";
      function pageHref(targetPage) {
        var patch = { ddv: kind, ddfocus: "1" };
        patch[pageField] = targetPage > 1 ? String(targetPage) : "";
        return href(patch);
      }
      var links = [];
      var lastShown = 0;
      if (page > 1) links.push('<a class="decision-page-link nav" href="' + pageHref(page - 1) + '">上一页</a>');
      else links.push('<span class="decision-page-link nav disabled">上一页</span>');
      for (var pi = 1; pi <= totalPages; pi += 1) {
        var visible = pi === 1 || pi === totalPages || Math.abs(pi - page) <= 1;
        if (!visible) continue;
        if (lastShown && pi - lastShown > 1) links.push('<span class="decision-page-ellipsis">…</span>');
        if (pi === page) links.push('<span class="decision-page-link active">' + esc(String(pi)) + '</span>');
        else links.push('<a class="decision-page-link" href="' + pageHref(pi) + '">' + esc(String(pi)) + '</a>');
        lastShown = pi;
      }
      if (page < totalPages) links.push('<a class="decision-page-link nav" href="' + pageHref(page + 1) + '">下一页</a>');
      else links.push('<span class="decision-page-link nav disabled">下一页</span>');
      return '<div class="decision-pagination"><span class="decision-pagination-meta">共 ' + esc(String(totalCount)) + ' 条 · 第 ' + esc(String(page)) + ' / ' + esc(String(totalPages)) + ' 页</span><div class="decision-pagination-links">' + links.join("") + '</div></div>';
    }

    function levelTabsHtml(kind, currentLevel) {
      var isSpeech = kind === "speech";
      var field = isSpeech ? "dsl" : "dml";
      var pageField = isSpeech ? "dspg" : "dmpg";
      var view = isSpeech ? "speech" : "meeting";
      var tabs = isSpeech
        ? ["省领导言论", "市领导言论", "区领导言论"]
        : ["国家级会议", "省级会议", "市级会议"];
      var html = tabs.map(function (item) {
        var patch = { ddv: view, ddfocus: "1" };
        patch[field] = item;
        patch[pageField] = "";
        return '<a href="' + href(patch) + '" class="' + (currentLevel === item ? "active" : "") + '">' + esc(item) + "</a>";
      }).join("");
      var allPatch = { ddv: view, ddfocus: "1" };
      allPatch[field] = "";
      allPatch[pageField] = "";
      return html + '<a href="' + href(allPatch) + '" class="' + (!currentLevel ? "active" : "") + '">全部</a>';
    }

    function classifyDecisionSpeech(record) {
      var hay = [record.title, record.topic, record.keyword, record.summary, record.detail].join(" ");
      if (/招商|引资|补链/.test(hay)) return "招商类";
      if (/政策|试点|服务|低空|金融/.test(hay)) return "政策类";
      if (/部署|调度|推进|工作会|任务|落实/.test(hay)) return "部署类";
      return "交流类";
    }

    function classifyDecisionMeeting(record) {
      var hay = [record.title, record.topic, record.keyword, record.summary, record.detail].join(" ");
      if (/数据|平台|治理/.test(hay)) return "数据类";
      if (/文旅|消费|夜游|演艺/.test(hay)) return "文旅类";
      if (/重点项目|试点|调度|推进/.test(hay)) return "重点项";
      return "经济类";
    }

    function sidebarStatsHtml(kind, records, meta) {
      var rows = [];
      var counts = {};
      var order = kind === "speech"
        ? ["交流类", "政策类", "部署类", "招商类"]
        : ["重点项", "经济类", "文旅类", "数据类"];
      rows.push({ label: kind === "speech" ? "领导讲话总数" : "会议总数", value: String(records.length) + (kind === "speech" ? "条" : "条") });
      records.forEach(function (item) {
        var bucket = kind === "speech" ? classifyDecisionSpeech(item) : classifyDecisionMeeting(item);
        counts[bucket] = (counts[bucket] || 0) + 1;
      });
      order.forEach(function (label) {
        rows.push({ label: label, value: String(counts[label] || 0) + "条" });
      });
      return rows.map(function (item) {
        return '<div class="decision-brief-sidebar-row"><span>' + esc(item.label) + '</span><b>' + esc(item.value) + "</b></div>";
      }).join("") || '<div class="decision-empty">暂无统计数据。</div>';
    }

    function renderDecisionCard(kind, records, opts) {
      var isSpeech = kind === "speech";
      var meta = overviewMeta(kind, records, opts.startDate, opts.endDate, opts.legacyPeriod);
      var cardId = isSpeech ? "decision-speech-panel" : "decision-meeting-panel";
      var active = decisionView === kind ? " focus" : "";
      var label = isSpeech ? "领导讲话" : "会议纪要";
      var enLabel = isSpeech ? "SPEECH ANALYSIS" : "MEETING ANALYSIS";
      var summaryTitle = isSpeech ? "领导讲话研判摘要" : "会议纪要研判摘要";
      var pageField = isSpeech ? "dspg" : "dmpg";
      var totalPages = Math.max(1, Math.ceil(records.length / decisionPageSize));
      var currentPage = Math.min(Math.max(1, Number(opts.page) || 1), totalPages);
      var pagedRecords = records.slice((currentPage - 1) * decisionPageSize, currentPage * decisionPageSize);
      var listItems = recordListHtml(kind, pagedRecords);
      var paginationHtml = decisionPaginationHtml(kind, records.length, currentPage, totalPages);
      var clearPatch = isSpeech
        ? { dss: "", dse: "", dsp: "", ddv: "speech", ddfocus: "1" }
        : { dms: "", dme: "", dmp: "", ddv: "meeting", ddfocus: "1" };
      clearPatch[pageField] = "";
      return '<section id="' + cardId + '" class="decision-module-card decision-module-card-' + esc(kind) + active + '">' +
        '<div class="decision-card-top-tag"><span>' + esc(enLabel) + '</span><span>' + esc(meta.summary) + '</span><span>已命中 ' + esc(String(records.length)) + (isSpeech ? " 条" : " 场") + '</span></div>' +
        '<p class="decision-card-desc">当前视图基于筛选后的' + esc(label) + '数据生成紧凑摘要，便于快速浏览重点信号与主题分布。</p>' +
        '<div class="decision-summary-grid">' +
          '<div class="decision-summary-item"><div class="decision-summary-label">记录数</div><div class="decision-summary-value">' + esc(String(records.length)) + '</div></div>' +
          '<div class="decision-summary-item"><div class="decision-summary-label">最新日期</div><div class="decision-summary-value is-date">' + esc(meta.latest ? meta.latest.date : "--") + '</div></div>' +
          '<div class="decision-summary-item"><div class="decision-summary-label">主导主题</div><div class="decision-summary-value">' + esc(meta.topTopic ? meta.topTopic.label : "--") + '</div></div>' +
          '<div class="decision-summary-item"><div class="decision-summary-label">高频关键词</div><div class="decision-summary-value">' + esc(meta.topKeyword ? meta.topKeyword.label : "--") + '</div></div>' +
        '</div>' +
        '<div class="decision-conclusion-box">' + esc(meta.insight) + '</div>' +
        '<div class="decision-card-header">' +
          '<div class="decision-stat-box">' +
            '<div class="decision-stat-num">' + esc(String(records.length)) + '</div>' +
            '<div class="decision-stat-info"><div class="decision-stat-date">' + esc(meta.latest ? meta.latest.date : "--") + '</div>' +
            '<div class="decision-stat-tag">' + esc((meta.topTopic ? meta.topTopic.label : "--") + " | " + (meta.topKeyword ? meta.topKeyword.label : "--")) + '</div></div>' +
          '</div>' +
          '<div class="decision-card-tabs"><div class="decision-card-tab active">' + esc(summaryTitle) + '</div><div class="decision-card-tab">' + esc(enLabel) + '</div></div>' +
        '</div>' +
        '<div class="decision-double-col">' +
          '<div class="decision-list-wrap">' +
            '<div class="decision-filter-bar">' +
              '<div class="decision-filter-row decision-filter-row-range"><form class="decision-range-form decision-range-form-compact" data-decision-range="' + esc(kind) + '"><input type="date" name="start" value="' + esc(opts.startDate) + '" /><span class="decision-range-sep">-</span><input type="date" name="end" value="' + esc(opts.endDate) + '" /><button class="btn" type="submit">筛选</button><a class="btn" href="' + href(clearPatch) + '">重置</a></form></div>' +
              '<div class="decision-filter-row decision-filter-row-search"><form class="decision-search-form" data-decision-search="' + esc(kind) + '"><input value="' + esc(opts.term) + '" placeholder="' + esc(isSpeech ? "输入讲话主题、关键词或摘要内容" : "输入会议主题、关键词或纪要内容") + '" /><button class="btn" type="submit">搜索</button></form></div>' +
            '</div>' +
            '<div class="decision-tabs">' + levelTabsHtml(kind, opts.level) + '</div>' +
            '<div class="decision-record-list decision-card-record-list">' +
              (listItems || '<div class="decision-empty">当前筛选下暂无' + esc(label) + '。</div>') +
            '</div>' + paginationHtml +
          '</div>' +
          '<aside class="decision-analysis-sidebar"><div class="decision-analysis-title">' + esc(isSpeech ? "文档分析统计" : "会议研判统计") + '</div>' + sidebarStatsHtml(kind, records, meta) + '</aside>' +
        '</div>' +
      '</section>';
    }

    var speechCard = renderDecisionCard("speech", speeches, {
      startDate: speechStart,
      endDate: speechEnd,
      legacyPeriod: speechPeriod,
      level: speechLevel,
      term: speechTerm,
      page: speechPage
    });
    var meetingCard = renderDecisionCard("meeting", meetings, {
      startDate: meetingStart,
      endDate: meetingEnd,
      legacyPeriod: meetingPeriod,
      level: meetingLevel,
      term: meetingTerm,
      page: meetingPage
    });

    return '<div class="decision-page fade-in"><div class="decision-topline"><div class="decision-topline-main">' + uiIcon('decision') + '<span class="decision-topline-title">领导决策支撑专题</span></div><div class="decision-topline-extra"><a class="decision-back-link" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a></div></div>' +
      '<div class="decision-reference-grid">' + speechCard + meetingCard + '</div></div>';
  }

  function numValue(v) {
    var s = String(v == null ? "" : v).replace(/,/g, "").trim();
    if (!s) return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  function annualStatsChronological() {
    return qingyangAnnualStats().slice().sort(function (a, b) {
      return Number(a.year || 0) - Number(b.year || 0);
    });
  }

  function annualMetricGroups() {
    return [
      { id: "all", label: "全部指标", hint: "查看青羊区统计资料中已接入的全部核心指标" },
      { id: "macro", label: "宏观总量", hint: "经济总量、投资、消费、财政与开放指标" },
      { id: "industry", label: "工业服务业", hint: "产业运行、创新平台和重点主体指标" },
      { id: "population", label: "人口就业", hint: "人口、就业与居民收入指标" },
      { id: "livelihood", label: "民生教育", hint: "教育、卫生与公共服务承载指标" },
      { id: "culture", label: "文旅消费", hint: "文旅流量与消费活力指标" },
      { id: "real_estate", label: "房地产", hint: "房地产投资、施工、销售相关指标" }
    ];
  }

  function annualMetricGroupDef(groupId) {
    return annualMetricGroups().find(function (item) {
      return item.id === groupId;
    }) || annualMetricGroups()[0];
  }

  function annualMetricDefs() {
    return [
      { id: "gdp_billion", label: "地区生产总值", short: "GDP", unit: "亿元", owner: "区发改局", target: 1660, group: "macro" },
      { id: "tertiary_billion", label: "第三产业增加值", short: "第三产业", unit: "亿元", owner: "区商务局", target: 1415, group: "macro" },
      { id: "industrial_billion", label: "工业增加值", short: "工业增加值", unit: "亿元", owner: "区经信局", target: 150, group: "macro" },
      { id: "fixed_asset_growth_pct", label: "固定资产投资增速", short: "固定资产投资", unit: "%", owner: "区发改局", target: -7.0, group: "macro" },
      { id: "social_retail_billion", label: "社会消费品零售总额", short: "社会消费品零售", unit: "亿元", owner: "区商务局", target: 1098, group: "macro" },
      { id: "public_budget_billion", label: "一般公共预算收入", short: "一般公共预算", unit: "亿元", owner: "区财政局", target: 116, group: "macro" },
      { id: "tax_revenue_billion", label: "税收收入", short: "税收收入", unit: "亿元", owner: "区税务局", target: 104, group: "macro" },
      { id: "budget_expenditure_billion", label: "一般公共预算支出", short: "一般公共预算支出", unit: "亿元", owner: "区财政局", target: 84, group: "macro" },
      { id: "import_export_billion", label: "进出口总额", short: "进出口总额", unit: "亿元", owner: "区商务局", target: 65, group: "macro" },
      { id: "fdi_usd_billion", label: "实际利用外资", short: "利用外资", unit: "亿美元", owner: "区投促局", target: 3.5, group: "macro" },
      { id: "specialized_sme_count", label: "专精特新企业数", short: "专精特新", unit: "家", owner: "区经信局", target: 30, group: "industry" },
      { id: "innovation_platform_count", label: "创新平台数", short: "创新平台", unit: "个", owner: "区科技局", target: 120, group: "industry" },
      { id: "above_scale_industrial_revenue_billion", label: "规上工业营收", short: "规上工业营收", unit: "亿元", owner: "区经信局", target: 92, group: "industry" },
      { id: "above_scale_industrial_profit_billion", label: "规上工业利润总额", short: "规上工业利润", unit: "亿元", owner: "区经信局", target: 15.5, group: "industry" },
      { id: "above_scale_service_revenue_growth_pct", label: "规上服务业营收增速", short: "规上服务业增速", unit: "%", owner: "区商务局", target: 10, group: "industry" },
      { id: "resident_population_10k", label: "常住人口", short: "常住人口", unit: "万人", owner: "区统计局", target: 98, group: "population" },
      { id: "new_jobs_people", label: "新增就业人数", short: "新增就业", unit: "人", owner: "区人社局", target: 24000, group: "population" },
      { id: "resident_income_yuan", label: "居民人均可支配收入", short: "居民收入", unit: "元", owner: "区统计局", target: 60000, group: "population" },
      { id: "medical_institutions_count", label: "医疗卫生机构数", short: "医疗卫生机构", unit: "个", owner: "区卫健局", target: 790, group: "livelihood" },
      { id: "beds_count", label: "医疗床位数", short: "床位总数", unit: "张", owner: "区卫健局", target: 15000, group: "livelihood" },
      { id: "health_staff_count", label: "卫生技术人员数", short: "卫生技术人员", unit: "人", owner: "区卫健局", target: 24500, group: "livelihood" },
      { id: "students_count", label: "在校学生数", short: "在校学生", unit: "人", owner: "区教育局", target: 83000, group: "livelihood" },
      { id: "tourist_visits_10k", label: "游客接待量", short: "游客接待", unit: "万人次", owner: "区文体旅局", target: 3100, group: "culture" },
      { id: "real_estate_investment_growth_pct", label: "房地产开发投资增速", short: "房地产投资", unit: "%", owner: "区住建局", target: -3.5, group: "real_estate" },
      { id: "housing_construction_area_10k_sqm", label: "商品房施工面积", short: "施工面积", unit: "万平方米", owner: "区住建局", target: 540, group: "real_estate" },
      { id: "housing_sales_area_10k_sqm", label: "商品房销售面积", short: "销售面积", unit: "万平方米", owner: "区住建局", target: 100, group: "real_estate" },
      { id: "housing_sales_billion", label: "商品房销售额", short: "商品房销售额", unit: "亿元", owner: "区住建局", target: 220, group: "real_estate" }
    ];
  }

  function annualMetricDef(metricId) {
    return annualMetricDefs().find(function (item) {
      return item.id === metricId;
    }) || annualMetricDefs()[0];
  }

  function metricValueText(value, unit) {
    if (value == null || !isFinite(value)) return "--";
    if (unit === "%") return fixed(value, 1) + "%";
    return fixed(value, 1) + unit;
  }

  function metricCompletion(actual, target) {
    if (actual == null || target == null || !isFinite(actual) || !isFinite(target) || target === 0) return null;
    var denom = Math.max(Math.abs(target), 1);
    if (actual >= target) return 100 + ((actual - target) / denom) * 100;
    return Math.max(0, 100 - ((target - actual) / denom) * 100);
  }

  function metricStatus(rate) {
    if (rate == null) return { key: "pending", label: "待补数", cls: "pending" };
    if (rate >= 102) return { key: "excellent", label: "优秀", cls: "excellent" };
    if (rate >= 95) return { key: "ok", label: "达标", cls: "ok" };
    return { key: "warn", label: "预警", cls: "warn" };
  }

  function annualMetricRows() {
    var latest = qingyangLatestAnnualStat() || {};
    return annualMetricDefs().map(function (def) {
      var actual = numValue(latest[def.id]);
      var target = numValue(def.target);
      var rate = metricCompletion(actual, target);
      return {
        id: def.id,
        label: def.label,
        short: def.short,
        unit: def.unit,
        owner: def.owner,
        actual: actual,
        target: target,
        actualText: metricValueText(actual, def.unit),
        targetText: metricValueText(target, def.unit),
        completion: rate,
        completionText: rate == null ? "--" : fixed(rate, 1) + "%",
        status: metricStatus(rate)
      };
    });
  }

  function annualTargetSummary() {
    var rows = annualMetricRows();
    var valid = rows.filter(function (item) { return item.completion != null; });
    var excellent = valid.filter(function (item) { return item.status.key === "excellent"; }).length;
    var warnings = valid.filter(function (item) { return item.status.key === "warn"; }).length;
    var reach = valid.filter(function (item) { return item.status.key !== "warn"; }).length;
    return {
      count: rows.length,
      reachRate: valid.length ? (reach / valid.length) * 100 : 0,
      excellentCount: excellent,
      warningCount: warnings,
      rows: rows
    };
  }

  function annualCompletionTrend() {
    var stats = annualStatsChronological();
    var defs = annualMetricDefs();
    /* Build a map: year -> avg completion rate */
    var dataMap = {};
    stats.forEach(function (item) {
      var rates = defs.map(function (def) {
        return metricCompletion(numValue(item[def.id]), numValue(def.target));
      }).filter(function (rate) {
        return rate != null && isFinite(rate);
      });
      if (rates.length) {
        dataMap[item.year] = rates.reduce(function (sum, rate) { return sum + rate; }, 0) / rates.length;
      }
    });
    /* Always show fixed 6 bars: last 6 years ending at the latest available year (or current year) */
    var years = Object.keys(dataMap).map(Number).filter(function (y) { return isFinite(y); });
    var latestYear = years.length ? Math.max.apply(null, years) : new Date().getFullYear();
    var points = [];
    for (var i = 5; i >= 0; i--) {
      var y = latestYear - i;
      points.push({ label: String(y), value: dataMap[y] != null ? dataMap[y] : 0 });
    }
    return points;
  }

  function statTrendSvg(points, forecastPoints, opts) {
    opts = opts || {};
    var width = opts.width || 760;
    var height = opts.height || 220;
    var padL = 54;
    var padR = 16;
    var padT = 18;
    var padB = 34;
    var all = (points || []).concat(forecastPoints || []).filter(function (item) { return item && item.value != null && isFinite(item.value); });
    if (!all.length) {
      return '<div class="target-empty-chart">暂无趋势数据</div>';
    }
    var min = Math.min.apply(null, all.map(function (item) { return item.value; }));
    var max = Math.max.apply(null, all.map(function (item) { return item.value; }));
    if (min === max) {
      min -= 1;
      max += 1;
    }
    var usableW = width - padL - padR;
    var usableH = height - padT - padB;
    var totalCount = Math.max((points || []).length + Math.max((forecastPoints || []).length - 1, 0), 2);
    function r(v) { return Math.round(v * 10) / 10; }
    /* Build numeric X positions from labels when they look like years.
       Use sqrt-compressed scale: gaps are proportional to sqrt(yearDiff)
       so multi-year gaps are wider than 1-year gaps but not overwhelmingly so. */
    var allPts = (points || []).concat((forecastPoints || []).slice(1));
    var xNums = allPts.map(function (item) { return parseFloat(item.label); });
    var useProportional = xNums.length >= 2 && xNums.every(function (n) { return isFinite(n); });
    var xCumul = [0];
    if (useProportional) {
      for (var xi = 1; xi < xNums.length; xi++) {
        xCumul.push(xCumul[xi - 1] + Math.sqrt(Math.abs(xNums[xi] - xNums[xi - 1])));
      }
    }
    var xCumulMax = xCumul.length > 1 ? xCumul[xCumul.length - 1] : 1;
    if (xCumulMax === 0) xCumulMax = 1;
    function pxByLabel(item, fallbackIdx) {
      if (useProportional && fallbackIdx < xCumul.length) {
        return r(padL + usableW * xCumul[fallbackIdx] / xCumulMax);
      }
      return r(padL + (usableW * fallbackIdx) / Math.max(totalCount - 1, 1));
    }
    function px(idx) {
      return pxByLabel(allPts[idx] || {}, idx);
    }
    function py(val) {
      return r(padT + (max - val) * usableH / (max - min));
    }
    function pathFor(list, startIndex) {
      return list.filter(function (item) { return item && item.value != null && isFinite(item.value); }).map(function (item, idx) {
        return (idx === 0 ? "M" : "L") + pxByLabel(item, startIndex + idx) + " " + py(item.value);
      }).join(" ");
    }
    var tickCount = 5;
    var grid = [];
    var yLabels = [];
    for (var gi = 0; gi < tickCount; gi++) {
      var gy = r(padT + (usableH * gi) / (tickCount - 1));
      var gVal = max - (max - min) * gi / (tickCount - 1);
      grid.push('<line x1="' + padL + '" y1="' + gy + '" x2="' + (width - padR) + '" y2="' + gy + '"></line>');
      yLabels.push('<text class="trend-y-label" x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end">' + esc(metricValueText(gVal, opts.unit || "")) + '</text>');
    }
    var labels = (points || []).map(function (item, idx) {
      return '<text x="' + pxByLabel(item, idx) + '" y="' + (height - 10) + '" text-anchor="middle">' + esc(item.label) + "</text>";
    }).join("");
    var forecastLabels = (forecastPoints || []).slice(1).map(function (item, idx) {
      var start = (points || []).length - 1;
      return '<text x="' + pxByLabel(item, start + idx + 1) + '" y="' + (height - 10) + '" text-anchor="middle">' + esc(item.label) + "</text>";
    }).join("");
    var currentPath = pathFor(points || [], 0);
    var forecastPath = (forecastPoints || []).length > 1 ? pathFor(forecastPoints || [], Math.max((points || []).length - 1, 0)) : "";
    var last = points[(points || []).length - 1];
    var lastDot = last ? '<circle cx="' + pxByLabel(last, (points || []).length - 1) + '" cy="' + py(last.value) + '" r="4.5"></circle>' : "";
    var dots = (points || []).map(function (item, idx) {
      if (!item || item.value == null || !isFinite(item.value)) return '';
      return '<circle class="trend-dot" cx="' + pxByLabel(item, idx) + '" cy="' + py(item.value) + '" r="3"></circle>';
    }).join('');
    return '<svg class="trend-chart-svg" viewBox="0 0 ' + width + " " + height + '" preserveAspectRatio="xMidYMid meet">' +
      '<g class="trend-grid">' + grid.join("") + "</g>" +
      '<g class="trend-y-labels">' + yLabels.join("") + "</g>" +
      '<g class="trend-axis-labels">' + labels + forecastLabels + "</g>" +
      '<path class="trend-line" d="' + currentPath + '"></path>' +
      (forecastPath ? '<path class="trend-line forecast" d="' + forecastPath + '"></path>' : "") +
      '<g class="trend-dots">' + dots + '</g>' +
      lastDot +
      "</svg>";
  }

  function exitWarningBucket(alert) {
    var score = Number((alert && alert.score) || 0);
    if (score >= 90) return { key: "high", label: "高风险预警" };
    if (score >= 80) return { key: "higher", label: "较高风险预警" };
    if (score >= 65) return { key: "mid", label: "中风险预警" };
    if (score >= 50) return { key: "lower", label: "较低风险预警" };
    return { key: "low", label: "低风险预警" };
  }

  /* ── Bar chart SVG for trend (jjmbkh style) ── */
  function statBarChartSvg(points, opts) {
    opts = opts || {};
    var width = opts.width || 440;
    var height = opts.height || 200;
    var padL = 8;
    var padR = 8;
    var padT = 24;
    var padB = 36;
    var barColor = opts.barColor || '#33669E';
    var valid = (points || []).filter(function (p) { return p && p.value != null && isFinite(p.value); });
    if (!valid.length) return '<div class="target-empty-chart">暂无趋势数据</div>';
    var maxVal = Math.max.apply(null, valid.map(function (p) { return p.value; }));
    if (maxVal <= 0) maxVal = 100;
    var usableW = width - padL - padR;
    var usableH = height - padT - padB;
    var n = valid.length;
    var gap = Math.max(8, Math.min(16, usableW / n * 0.25));
    var barW = Math.max(20, (usableW - gap * (n + 1)) / n);
    var totalBarArea = barW * n + gap * (n + 1);
    var offsetX = padL + (usableW - totalBarArea) / 2;
    function r(v) { return Math.round(v * 10) / 10; }
    var bars = valid.map(function (p, i) {
      var barH = p.value > 0 ? Math.max(6, (p.value / maxVal) * usableH) : 4;
      var barFill = p.value > 0 ? barColor : '#C8D9EA';
      var x = r(offsetX + gap + i * (barW + gap));
      var y = r(padT + usableH - barH);
      var labelY = r(y - 6);
      var yearY = r(padT + usableH + 20);
      return '<rect class="target-bar-rect" x="' + x + '" y="' + y + '" width="' + r(barW) + '" height="' + r(barH) + '" rx="4" fill="' + barFill + '"/>' +
        '<text class="target-bar-value" x="' + r(x + barW / 2) + '" y="' + labelY + '" text-anchor="middle">' + esc(fixed(p.value, 1)) + (opts.unit || '') + '</text>' +
        '<text class="target-bar-year" x="' + r(x + barW / 2) + '" y="' + yearY + '" text-anchor="middle">' + esc(p.label) + '</text>';
    }).join('');
    return '<svg class="target-bar-chart-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet">' + bars + '</svg>';
  }

  function exitWarningSummary(alerts) {
    var buckets = { high: 0, higher: 0, mid: 0, lower: 0, low: 0 };
    (alerts || []).forEach(function (alert) {
      buckets[exitWarningBucket(alert).key] += 1;
    });
    return {
      total: (alerts || []).length,
      high: buckets.high,
      higher: buckets.higher,
      mid: buckets.mid,
      lower: buckets.lower,
      low: buckets.low
    };
  }

  function exitWarningRecords(rt) {
    rt = rt || route();
    var q = rt.q || {};
    var level = q.xlevel || "";
    var streetId = q.xstreet || "";
    var industry = q.xindustry || "";
    var alertType = String(q.xtype || "").trim();
    var term = String(q.xq || "").trim();
    var targetEntId = String(q.xid || "").trim();
    return govDemoAlerts().slice().map(function (alert) {
      var enterprise = entById(alert.enterprise_id) || null;
      var street = enterprise && enterprise.street_id ? geoStreetById(enterprise.street_id) : null;
      return {
        alert: alert,
        enterprise: enterprise,
        street: street,
        bucket: exitWarningBucket(alert),
        isTarget: !!(enterprise && targetEntId && enterprise.id === targetEntId)
      };
    }).filter(function (item) {
      if (!item.enterprise) return false;
      if (level && item.bucket.key !== level) return false;
      if (streetId && (!item.street || item.street.id !== streetId)) return false;
      if (industry && String(item.enterprise.industry || "") !== industry) return false;
      if (alertType && String((item.alert && item.alert.type) || "") !== alertType) return false;
      if (term) {
        var text = [item.enterprise.name, item.enterprise.industry, item.enterprise.address, item.alert.type, item.alert.suggestion].join(" ");
        if (text.indexOf(term) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      if (a.isTarget && !b.isTarget) return -1;
      if (!a.isTarget && b.isTarget) return 1;
      return Number((b.alert && b.alert.score) || 0) - Number((a.alert && a.alert.score) || 0);
    });
  }

  function pageGovEnterpriseExit(rt) {
    rt = rt || route();
    var q = rt.q || {};
    var alerts = exitWarningRecords(rt);
    var summary = exitWarningSummary(govDemoAlerts());
    var currentPage = Math.max(1, Number(q.xpage || 1) || 1);
    var pageSize = 6;
    var totalPages = Math.max(1, Math.ceil(alerts.length / pageSize));
    var page = Math.min(currentPage, totalPages);
    var pagedAlerts = alerts.slice((page - 1) * pageSize, page * pageSize);
    var targetEntId = String(q.xid || "").trim();
    var targetEnterprise = targetEntId ? entById(targetEntId) : null;
    var targetAlert = targetEntId ? alerts.find(function (item) { return item.enterprise && item.enterprise.id === targetEntId; }) : null;
    var activeAlertType = String(q.xtype || "").trim();
    function exitHash(overrides) {
      var next = {
        xid: q.xid || "",
        xlevel: q.xlevel || "",
        xstreet: q.xstreet || "",
        xindustry: q.xindustry || "",
        xtype: q.xtype || "",
        xq: q.xq || "",
        xpage: page > 1 ? String(page) : ""
      };
      Object.keys(overrides || {}).forEach(function (key) {
        next[key] = overrides[key];
      });
      Object.keys(next).forEach(function (key) {
        if (next[key] == null || next[key] === "" || (key === "xpage" && String(next[key]) === "1")) delete next[key];
      });
      return buildHash("/gov/enterprise-exit", next);
    }
    var streets = govDemoGeoItems(geoData().streets || []).slice().sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
    });
    var industries = Array.from(new Set(govDemoEnterprises().map(function (item) { return item.industry || ""; }).filter(Boolean))).sort(function (a, b) {
      return a.localeCompare(b, "zh-CN");
    });
    var summaryCards = [
      { label: "预警企业总数", value: summary.total, cls: "" },
      { label: "高风险预警企业数", value: summary.high, cls: "high" },
      { label: "较高风险预警企业数", value: summary.higher, cls: "higher" },
      { label: "中风险预警企业数", value: summary.mid, cls: "mid" },
      { label: "较低风险预警企业数", value: summary.lower, cls: "lower" },
      { label: "低风险预警企业数", value: summary.low, cls: "low" }
    ].map(function (item) {
      return '<article class="exit-summary-card ' + esc(item.cls) + '"><span>' + esc(item.label) + '</span><strong>' + esc(String(item.value)) + '</strong></article>';
    }).join("");
    var rows = pagedAlerts.map(function (item, idx) {
      return '<tr class="' + (item.isTarget ? "is-focus" : "") + '"><td>' + esc(String((page - 1) * pageSize + idx + 1)) + '</td><td><a href="#/gov/enterprise/' + esc(item.enterprise.id) + '?src=exit"><b>' +
        esc(item.enterprise.name) + '</b></a></td><td>' + esc((item.street && item.street.name) || govDemoDistrictName()) + '</td><td>' + esc(item.enterprise.industry || "--") +
        '</td><td><span class="exit-level-tag ' + esc(item.bucket.key) + '">' + esc(item.bucket.label) + '</span></td><td>' + esc(String(item.alert.score || "--")) +
        '</td><td>' + (item.isTarget ? '<span class="tag teal">当前企业</span>' : "") + '<a class="btn tiny" href="#/gov/alert/' + esc(item.alert.id) + '">查看预警</a></td></tr>';
    }).join("");
    var streetRisk = Array.from(alerts.reduce(function (map, item) {
      var key = (item.street && item.street.id) || "district";
      var entry = map.get(key) || { id: key === "district" ? "" : key, name: (item.street && item.street.name) || govDemoDistrictName(), count: 0, score: 0 };
      entry.count += 1;
      entry.score += Number((item.alert && item.alert.score) || 0);
      map.set(key, entry);
      return map;
    }, new Map()).values()).sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return b.score - a.score;
    }).slice(0, 3);
    var typeRisk = Array.from(alerts.reduce(function (map, item) {
      var key = String((item.alert && item.alert.type) || "经营波动");
      var entry = map.get(key) || { name: key, count: 0, high: 0 };
      entry.count += 1;
      if (item.bucket.key === "high" || item.bucket.key === "higher") entry.high += 1;
      map.set(key, entry);
      return map;
    }, new Map()).values()).sort(function (a, b) {
      if (b.high !== a.high) return b.high - a.high;
      return b.count - a.count;
    }).slice(0, 3);
    var suggestionList = [];
    if (streetRisk[0]) suggestionList.push("优先围绕“" + streetRisk[0].name + "”开展重点企业走访，先核实经营波动与场地稳定性。");
    if (typeRisk[0]) suggestionList.push("针对“" + typeRisk[0].name + "”类预警，建议由招商主管与属地街道同步建立跟进台账。");
    if (summary.high + summary.higher > 0) suggestionList.push("当前高风险和较高风险企业共 " + (summary.high + summary.higher) + " 家，建议纳入本周稳企会商清单。");
    if (!suggestionList.length) suggestionList.push("当前筛选范围内暂无明显迁出预警，可继续保持常态化监测。");
    var streetRiskHtml = streetRisk.map(function (item, idx) {
      return '<li><a class="exit-insight-link ' + (q.xstreet === item.id && item.id ? "active" : "") + '" href="' + exitHash({ xstreet: item.id || "", xpage: 1 }) + '"><span>' + esc(String(idx + 1) + ". " + item.name) + '</span><strong>' + esc(String(item.count)) + ' 家</strong></a></li>';
    }).join("");
    var typeRiskHtml = typeRisk.map(function (item, idx) {
      return '<li><a class="exit-insight-link ' + (activeAlertType === item.name ? "active" : "") + '" href="' + exitHash({ xtype: item.name, xpage: 1 }) + '"><span>' + esc(String(idx + 1) + ". " + item.name) + '</span><strong>' + esc(String(item.high)) + ' 家高风险</strong></a></li>';
    }).join("");
    var suggestionHtml = suggestionList.map(function (line) {
      return "<li>" + esc(line) + "</li>";
    }).join("");
    var activeFilters = [];
    if (q.xstreet) {
      var activeStreet = streets.find(function (item) { return item.id === q.xstreet; });
      activeFilters.push('<a class="tag" href="' + exitHash({ xstreet: "", xpage: 1 }) + '">街道：' + esc((activeStreet && activeStreet.name) || q.xstreet) + ' ×</a>');
    }
    if (activeAlertType) activeFilters.push('<a class="tag" href="' + exitHash({ xtype: "", xpage: 1 }) + '">预警类型：' + esc(activeAlertType) + ' ×</a>');
    var paginationLinks = [];
    for (var pi = Math.max(1, page - 2); pi <= Math.min(totalPages, page + 2); pi++) {
      paginationLinks.push('<a class="exit-page-link ' + (pi === page ? "active" : "") + '" href="' + exitHash({ xpage: pi }) + '">' + esc(String(pi)) + "</a>");
    }
    var paginationHtml = alerts.length
      ? '<div class="exit-pagination"><span class="exit-pagination-meta">共 ' + esc(String(alerts.length)) + ' 家 · 第 ' + esc(String(page)) + ' / ' + esc(String(totalPages)) + ' 页</span><div class="exit-pagination-links">' +
        (page > 1 ? '<a class="exit-page-link nav" href="' + exitHash({ xpage: page - 1 }) + '">上一页</a>' : '<span class="exit-page-link nav disabled">上一页</span>') +
        paginationLinks.join("") +
        (page < totalPages ? '<a class="exit-page-link nav" href="' + exitHash({ xpage: page + 1 }) + '">下一页</a>' : '<span class="exit-page-link nav disabled">下一页</span>') +
        '</div></div>'
      : "";
    var focusStrip = targetEnterprise
      ? '<section class="exit-panel exit-focus-strip"><div class="exit-panel-head"><h3>联动企业</h3><span>来自企业画像专题</span></div><div class="exit-focus-content"><div><b>' + esc(targetEnterprise.name) + '</b><span>' +
        esc(targetEnterprise.industry || "未分类") + " · " + esc((geoStreetById(targetEnterprise.street_id) || {}).name || govDemoDistrictName()) +
        '</span></div><div class="exit-focus-status">' + (targetAlert
          ? '<span class="tag teal">已置顶显示</span><span class="exit-level-tag ' + esc(targetAlert.bucket.key) + '">' + esc(targetAlert.bucket.label) + '</span>'
          : '<span class="tag">当前暂无迁出预警记录</span>') +
        '</div></div></section>'
      : "";
    /* ── donut chart data (CSS conic-gradient) ── */
    var donutTotal = summary.total || 1;
    var donutSlices = [
      { label: "高风险", count: summary.high, color: "#DC2626" },
      { label: "较高风险", count: summary.higher, color: "#D97706" },
      { label: "中风险", count: summary.mid, color: "#2563EB" },
      { label: "较低风险", count: summary.lower, color: "#60A5FA" },
      { label: "低风险", count: summary.low, color: "#059669" }
    ];
    var donutAngle = 0;
    var conicStops = donutSlices.map(function (s) {
      var start = donutAngle;
      var pct = (s.count / donutTotal) * 100;
      donutAngle += pct;
      return s.color + " " + start.toFixed(1) + "% " + donutAngle.toFixed(1) + "%";
    }).join(", ");
    var donutStyle = "background: conic-gradient(" + conicStops + ");";
    var legendHtml = donutSlices.map(function (s) {
      return '<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:#4B5563"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + s.color + '"></span>' + esc(s.label) + ' <strong style="margin-left:auto;color:#1F2937">' + esc(String(s.count)) + '</strong></div>';
    }).join("");

    /* ── disposal workbench items ── */
    var disposalItems = [
      { title: "重点走访", desc: "针对高风险企业安排实地走访，了解核心问题并制定帮扶方案", action: "安排走访" },
      { title: "政策帮扶", desc: "匹配适用政策，为有迁出倾向的企业提供税收优惠、租金补贴等留企方案", action: "查看政策" },
      { title: "协调会商", desc: "组织多部门联合会商，针对重点企业开展综合协调解决方案", action: "发起会商" }
    ];
    var disposalHtml = disposalItems.map(function (item) {
      return '<div class="exit-disposal-item"><h4>' + esc(item.title) + '</h4><p>' + esc(item.desc) + '</p><button class="exit-disposal-btn">' + esc(item.action) + '</button></div>';
    }).join("");

    return '<div class="exit-page fade-in"><div class="decision-topline"><div class="decision-topline-main">' + uiIcon('alert') + '<span class="decision-topline-title">企业迁出预警专题</span></div><div class="decision-mode-switch"><a class="decision-back-link" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a></div></div>' +
      '<section class="exit-panel"><div class="exit-panel-head"><h3>数据总览</h3><span>青羊区重点企业迁出风险监测</span></div><div class="exit-summary-grid">' + summaryCards + '</div></section>' +
      focusStrip +
      '<div class="exit-layout"><section class="exit-panel"><div class="exit-panel-head"><h3>企业名单</h3><span>当前命中 ' + esc(String(alerts.length)) + ' 家企业</span></div>' +
      '<form class="exit-filter-bar" data-exit-filter="1"><select name="level"><option value="">全部预警等级</option><option value="high"' +
      (q.xlevel === "high" ? " selected" : "") + '>高风险预警</option><option value="higher"' + (q.xlevel === "higher" ? " selected" : "") + '>较高风险预警</option><option value="mid"' +
      (q.xlevel === "mid" ? " selected" : "") + '>中风险预警</option><option value="lower"' + (q.xlevel === "lower" ? " selected" : "") + '>较低风险预警</option><option value="low"' +
      (q.xlevel === "low" ? " selected" : "") + '>低风险预警</option></select><select name="street"><option value="">全部街道</option>' +
      streets.map(function (street) { return '<option value="' + esc(street.id) + '"' + (q.xstreet === street.id ? " selected" : "") + '>' + esc(street.name) + "</option>"; }).join("") +
      '</select><select name="industry"><option value="">全部行业</option>' + industries.map(function (industry) { return '<option value="' + esc(industry) + '"' + (q.xindustry === industry ? " selected" : "") + '>' + esc(industry) + "</option>"; }).join("") +
      '</select><input type="hidden" name="xid" value="' + esc(targetEntId) + '" /><input type="hidden" name="xtype" value="' + esc(activeAlertType) + '" /><input name="term" value="' + esc(q.xq || "") + '" placeholder="搜索企业名称、风险类型或处置建议" /><button class="btn primary" type="submit">搜索</button><a class="btn" href="#/gov/enterprise-exit">重置</a></form>' + (activeFilters.length ? '<div class="exit-filter-tags">' + activeFilters.join("") + '</div>' : '') +
      '<div class="exit-table-wrap"><table class="table exit-table"><thead><tr><th>序号</th><th>企业名称</th><th>区域</th><th>行业</th><th>预警等级</th><th>风险指数</th><th>操作</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="muted">当前筛选条件下暂无预警企业。</td></tr>') + '</tbody></table></div>' + paginationHtml + '</section><aside class="exit-panel"><div class="exit-panel-head" style="flex-direction:column;align-items:flex-start;gap:2px"><h3>风险核心洞察</h3><span>按筛选结果自动汇总</span></div><div class="exit-feed-list">' +
      '<article class="exit-insight-card"><b>风险等级占比</b><div style="display:flex;align-items:center;gap:16px;margin-top:4px"><div style="width:80px;height:80px;border-radius:50%;' + donutStyle + 'position:relative;flex-shrink:0"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:bold;color:#1F2937">' + esc(String(summary.total)) + '</div></div><div style="display:flex;flex-direction:column;gap:3px;flex:1">' + legendHtml + '</div></div></article>' +
      '<article class="exit-insight-card"><b>高风险区域 / 类型</b><div class="exit-insight-dual"><div><span class="exit-insight-sub">街道TOP3</span><ul class="exit-insight-list">' + (streetRiskHtml || '<li><span>暂无</span><strong>--</strong></li>') + '</ul></div><div><span class="exit-insight-sub">预警类型TOP3</span><ul class="exit-insight-list">' + (typeRiskHtml || '<li><span>暂无</span><strong>--</strong></li>') + '</ul></div></div></article>' +
      '</div></aside></div>' +
      '<section class="exit-panel"><div class="exit-panel-head"><h3>风险处置工作台</h3><span>快速发起处置行动</span></div><div class="exit-disposal-grid">' + disposalHtml + '</div></section></div>';
  }

  function targetAreaRows(metricId, term) {
    var streets = govDemoGeoItems(geoData().streets || []);
    var enterprises = govDemoEnterprises();
    var def = annualMetricDef(metricId);
    var totalTarget = def.target != null ? def.target : 100;
    var isRate = def.unit === "%" || def.unit === "元";
    var items = streets.map(function (street) {
      var ents = enterprises.filter(function (item) { return item.street_id === street.id; });
      var heat = Number(street.heat || 75);
      var keyE = Number(street.key_enterprises || 10);
      var landE = Number(street.land_eff || 0.8);
      var invL = Number(street.invest_leads || 3);
      var weight = Math.max(ents.length, 1) * 0.4 + heat * 0.3 + keyE * 0.2 + invL * 0.1;
      var seed = ((heat * 7 + keyE * 13 + ents.length) % 100);
      return { street: street, weight: weight, seed: seed, landE: landE };
    });
    var totalWeight = items.reduce(function (s, i) { return s + i.weight; }, 0) || 1;
    return items.map(function (item) {
      var street = item.street;
      var proportion = item.weight / totalWeight;
      var vf = 0.93 + item.seed / 100 * 0.14;
      if (street.warning !== "低") vf -= 0.06;
      var actual, target;
      if (isRate) {
        target = totalTarget;
        var drift = (item.seed - 50) / 50 * Math.max(Math.abs(totalTarget) * 0.15, 2);
        actual = totalTarget + drift;
        if (street.warning !== "低") actual -= Math.abs(totalTarget) * 0.08;
      } else {
        target = totalTarget * proportion;
        actual = target * vf;
      }
      return {
        id: street.id,
        type: "area",
        name: street.name,
        hint: street.cluster || "街道产业结构",
        actual: actual,
        target: target,
        completion: metricCompletion(actual, target),
        status: metricStatus(metricCompletion(actual, target))
      };
    }).filter(function (item) {
      return !term || item.name.indexOf(term) >= 0 || item.hint.indexOf(term) >= 0;
    }).sort(function (a, b) {
      return (b.completion || 0) - (a.completion || 0);
    });
  }

  function targetDepartmentRows(metricId, term) {
    var def = annualMetricDef(metricId);
    var totalTarget = def.target != null ? def.target : 100;
    var isRate = def.unit === "%" || def.unit === "元";
    var depts = [
      { id: "dept-dev", name: "区发改局", focus: ["gdp_billion", "fixed_asset_growth_pct"], share: 0.26, bias: 1.012, hint: "项目投资、经济运行统筹" },
      { id: "dept-ind", name: "区经信局", focus: ["industrial_billion", "gdp_billion"], share: 0.23, bias: 0.986, hint: "工业增长、制造业项目推进" },
      { id: "dept-biz", name: "区商务局", focus: ["tertiary_billion", "social_retail_billion"], share: 0.22, bias: 1.006, hint: "服务业和消费市场促进" },
      { id: "dept-fin", name: "区财政局", focus: ["public_budget_billion"], share: 0.16, bias: 1.009, hint: "财政收入和资金统筹" },
      { id: "dept-culture", name: "区文体旅局", focus: ["social_retail_billion", "tertiary_billion"], share: 0.13, bias: 0.972, hint: "文旅消费和会展活动牵引" }
    ];
    return depts.map(function (dept) {
      var isFocused = dept.focus.indexOf(metricId) >= 0;
      var actual, base;
      if (isRate) {
        base = totalTarget;
        var factor = isFocused ? dept.bias : dept.bias - 0.03;
        actual = base * factor;
      } else {
        var share = isFocused ? dept.share + 0.04 : dept.share;
        base = totalTarget * share;
        actual = base * dept.bias;
      }
      var completion = metricCompletion(actual, base);
      return {
        id: dept.id,
        type: "department",
        name: dept.name,
        hint: dept.hint,
        actual: actual,
        target: base,
        completion: completion,
        status: metricStatus(completion)
      };
    }).filter(function (item) {
      return !term || item.name.indexOf(term) >= 0 || item.hint.indexOf(term) >= 0;
    }).sort(function (a, b) {
      return (b.completion || 0) - (a.completion || 0);
    });
  }

  function targetSubjectMetricRows(subjectType, subjectId) {
    var defs = annualMetricDefs();
    if (subjectType === "department") {
      return defs.map(function (def) {
        var deptRows = targetDepartmentRows(def.id, "");
        var row = deptRows.find(function (item) { return item.id === subjectId; }) || deptRows[0];
        return Object.assign({ label: def.label, unit: def.unit }, row);
      });
    }
    return defs.map(function (def) {
      var areaRows = targetAreaRows(def.id, "");
      var row = areaRows.find(function (item) { return item.id === subjectId; }) || areaRows[0];
      return Object.assign({ label: def.label, unit: def.unit }, row);
    });
  }

  function governmentStatsDocs(tab) {
    var docs = qingyangDecisionLibrary().slice().sort(function (a, b) {
      return String(b.year || "").localeCompare(String(a.year || ""));
    });
    if (tab === "yearbook") {
      return docs.filter(function (item) { return /年鉴/.test(String(item.type || "") + String(item.title || "")); });
    }
    if (tab === "bulletin") {
      return docs.filter(function (item) { return /公报|年报/.test(String(item.type || "") + String(item.title || "")); });
    }
    return docs;
  }

  function governmentStatsSeries(metricId) {
    var raw = annualStatsChronological();
    var map = {};
    var latestYear = Number(today().slice(0, 4));
    raw.forEach(function (item) {
      var v = numValue(item[metricId]);
      if (v != null) {
        map[Number(item.year)] = v;
        if (Number(item.year) > latestYear) latestYear = Number(item.year);
      }
    });
    var result = [];
    for (var y = latestYear - 5; y <= latestYear; y++) {
      result.push({ label: String(y), value: map[y] != null ? map[y] : 0 });
    }
    return result;
  }

  function governmentStatsForecast(metricId) {
    var series = governmentStatsSeries(metricId);
    if (!series.length) return [];
    var last = series[series.length - 1];
    var prev = series.length > 1 ? series[series.length - 2] : last;
    var delta = (last.value - prev.value) * 0.78;
    var lastYear = Number(last.label || today().slice(0, 4));
    return [
      { label: last.label, value: last.value },
      { label: String(lastYear + 1), value: last.value + delta },
      { label: String(lastYear + 2), value: last.value + delta * 1.6 }
    ];
  }

  /* ── Target page permission helpers ── */
  function targetUserCanViewRow(user, row, compareView) {
    if (!user || user.scope === "all") return true;
    if (user.scope === "department" && compareView === "department") return row.id === user.deptId;
    if (user.scope === "department" && compareView === "area") return false;
    if (user.scope === "area" && compareView === "area") return row.id === user.areaId;
    if (user.scope === "area" && compareView === "department") return false;
    return false;
  }

  function targetUserCanViewMetric(user, metricDef) {
    if (!user || user.scope === "all") return true;
    if (user.scope === "department") {
      var depts = DEMO_USERS.filter(function (u) { return u.deptId === user.deptId; });
      var deptName = depts.length ? depts[0].dept.replace(/办$/, "") : "";
      return metricDef.owner === deptName || metricDef.owner === user.dept;
    }
    return true;
  }

  function targetMaskRow(row) {
    return Object.assign({}, row, {
      actual: null,
      target: null,
      completion: null,
      status: { key: "locked", cls: "locked", label: "无权限" },
      _masked: true
    });
  }

  function targetApplyPermissions(rows, compareView, user) {
    if (!user || user.scope === "all") return rows;
    return rows.map(function (row) {
      if (targetUserCanViewRow(user, row, compareView)) return row;
      return targetMaskRow(row);
    });
  }

  function targetSecurityLevelText(user) {
    if (!user || user.scope === "all") return "全量数据";
    if (user.scope === "department") return "部门级";
    if (user.scope === "area") return "属地级";
    return "受限";
  }

  function targetSecurityBannerHtml(user) {
    var levelText = targetSecurityLevelText(user);
    var scopeDesc = "";
    if (user.scope === "all") scopeDesc = "您当前拥有全量数据查看权限";
    else if (user.scope === "department") scopeDesc = "仅展示与 " + esc(user.dept) + " 相关的详细数据，其余主体已脱敏";
    else if (user.scope === "area") scopeDesc = "仅展示 " + esc(user.dept) + " 相关的详细数据，其余主体已脱敏";
    return '<div class="target-security-banner"><div class="target-security-banner-left">' +
      '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2L3 5.5V9.5C3 13.58 6.13 17.37 10 18.35C13.87 17.37 17 13.58 17 9.5V5.5L10 2Z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M7.5 10L9.5 12L13 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span class="target-security-level">' + esc(levelText) + '</span>' +
      '<span class="target-security-desc">' + scopeDesc + '</span></div>' +
      '<div class="target-security-banner-right"><span class="target-security-user">' +
      '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 17c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> ' +
      esc(user.name) + ' · ' + esc(user.dept) + '</span>' +
      '<span class="target-security-class">内部 · 机密</span></div></div>';
  }

  function pageGovEconomicTargets(rt) {
    var user = currentUser();
    rt = rt || route();
    var q = rt.q || {};
    var metricId = q.tm || "gdp_billion";
    var compareView = q.tv || "area";
    var searchTerm = String(q.tq || "").trim();
    var rawRows = compareView === "department" ? targetDepartmentRows(metricId, searchTerm) : targetAreaRows(metricId, searchTerm);
    var rows = targetApplyPermissions(rawRows, compareView, user);
    var PAGE_SIZE = 10;
    var totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    var currentPage = Math.max(1, Math.min(totalPages, parseInt(q.tp, 10) || 1));
    var pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    var pageOffset = (currentPage - 1) * PAGE_SIZE;
    var summary = annualTargetSummary();
    var trend = annualCompletionTrend();
    var metricDefs = annualMetricDefs();
    var metric = annualMetricDef(metricId);
    var latestRow = summary.rows.find(function (item) { return item.id === metricId; }) || summary.rows[0];
    var visibleRows = rows.filter(function (item) { return !item._masked; });
    var reachCount = visibleRows.filter(function (item) { return item.status.key !== "warn"; }).length;
    var warnCount = visibleRows.filter(function (item) { return item.status.key === "warn"; }).length;
    var trendDelta = trend.length > 1 ? Number(trend[trend.length - 1].value) - Number(trend[trend.length - 2].value) : null;
    var trendDeltaText = trendDelta == null
      ? "近两期趋势平稳"
      : (trendDelta >= 0 ? "较上期提升 " + fixed(trendDelta, 1) + "%" : "较上期回落 " + fixed(Math.abs(trendDelta), 1) + "%");
    var completionVal = latestRow ? Number(latestRow.completionText) : null;
    var suggestLines = [];
    if (completionVal != null && completionVal >= 100) {
      suggestLines.push(esc(metric.label) + '已超额完成年度目标，经济运行总体平稳，产业支撑效果显著。');
    } else if (completionVal != null && completionVal >= 95) {
      suggestLines.push(esc(metric.label) + '接近目标，执行进度良好，需做好年末收尾。');
    } else {
      suggestLines.push(esc(metric.label) + '略低于目标，需加快推进进度，强化项目要素保障。');
    }
    if (compareView === "department") {
      suggestLines.push('优先围绕末位部门拆解责任指标，复盘领先部门推进节奏。');
    } else {
      suggestLines.push('优先围绕预警区域补短板，复制领先街道推进打法。');
    }
    if (warnCount > 0) {
      suggestLines.push('当前有 ' + esc(String(warnCount)) + ' 个主体预警，建议加强督导与要素保障。');
    }
    var suggestsHtml = suggestLines.map(function (s) {
      return '<div class="target-suggest-item">' + s + '</div>';
    }).join('');
    var compareRowsHtml = pagedRows.map(function (item, idx) {
      var rank = pageOffset + idx + 1;
      if (item._masked) {
        return '<tr class="target-row-masked"><td>' + esc(String(rank)) + '</td><td><b>' + esc(item.name) +
          '</b><div class="muted">' + esc(item.hint) + '</div></td><td class="masked-cell">***</td><td class="masked-cell">***</td>' +
          '<td class="masked-cell"><div class="target-progress masked"><span style="width:0%"></span></div><b>***</b></td>' +
          '<td><span class="target-status locked">无权限</span></td></tr>';
      }
      var width = Math.max(18, Math.min(100, Number(item.completion || 0)));
      return '<tr><td>' + esc(String(rank)) + '</td><td><b>' + esc(item.name) +
        '</b><div class="muted">' + esc(item.hint) + '</div></td><td>' + esc(metricValueText(item.actual, metric.unit)) + '</td><td>' + esc(metricValueText(item.target, metric.unit)) +
        '</td><td><div class="target-progress"><span style="width:' + esc(fixed(width, 1)) + '%"></span></div><b>' + esc(item.completion == null ? "--" : fixed(item.completion, 1) + "%") +
        '</b></td><td><span class="target-status ' + esc(item.status.cls) + '">' + esc(item.status.label) + '</span></td></tr>';
    }).join("");
    var paginationHtml = '';
    if (totalPages > 1) {
      var pageLinks = [];
      if (currentPage > 1) pageLinks.push('<a class="target-page-link" href="' + buildHash("/gov/economic-targets", { tm: metricId, tv: compareView, tq: searchTerm || "", tp: currentPage - 1 }) + '">&laquo; 上一页</a>');
      for (var pi = 1; pi <= totalPages; pi++) {
        if (pi === currentPage) pageLinks.push('<span class="target-page-link active">' + pi + '</span>');
        else if (pi === 1 || pi === totalPages || Math.abs(pi - currentPage) <= 2) pageLinks.push('<a class="target-page-link" href="' + buildHash("/gov/economic-targets", { tm: metricId, tv: compareView, tq: searchTerm || "", tp: pi }) + '">' + pi + '</a>');
        else if (pi === 2 || pi === totalPages - 1) pageLinks.push('<span class="target-page-ellipsis">&hellip;</span>');
      }
      if (currentPage < totalPages) pageLinks.push('<a class="target-page-link" href="' + buildHash("/gov/economic-targets", { tm: metricId, tv: compareView, tq: searchTerm || "", tp: currentPage + 1 }) + '">下一页 &raquo;</a>');
      paginationHtml = '<div class="target-pagination">' + pageLinks.join('') + '<span class="target-page-info">共 ' + rows.length + ' 条，第 ' + currentPage + '/' + totalPages + ' 页</span></div>';
    }
    return '<div class="target-page fade-in">' +
      /* ── Top bar ── */
      '<div class="decision-topline">' +
        '<div class="decision-topline-main">' +
          uiIcon('dashboard') + '<span class="decision-topline-title">经济目标考核</span>' +
        '</div>' +
        '<div class="decision-topline-extra">' +
          '<span class="target-scope-tag">' + esc(targetSecurityLevelText(user)) + '</span>' +
          '<span class="target-user-tag"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10" cy="7" r="3.5"/><path d="M3.5 17c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" stroke-linecap="round"/></svg> ' + esc(user.name) + ' · ' + esc(user.dept) + '</span>' +
          '<span class="target-class-tag">内部 · 机密</span>' +
          '<a class="decision-back-link" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a>' +
        '</div>' +
      '</div>' +
      /* ── Filter bar ── */
      '<form class="target-control-bar" data-target-compare="1">' +
        '<label class="target-ctrl-label">指标</label>' +
        '<select name="metric">' +
          metricDefs.map(function (item) { return '<option value="' + esc(item.id) + '"' + (item.id === metricId ? " selected" : "") + '>' + esc(item.label) + "</option>"; }).join("") +
        '</select>' +
        '<input name="term" value="' + esc(searchTerm) + '" placeholder="搜索区域/街道…" />' +
        '<button class="btn primary sm" type="submit">筛选查询</button>' +
        '<a class="btn sm" href="' + buildHash("/gov/economic-targets", { tm: metricId, tv: compareView }) + '">清空重置</a>' +
      '</form>' +
      /* ── Stat strip (3 cards) ── */
      '<div class="target-stat-strip">' +
        '<article class="target-stat-card accent"><span>' + esc(metric.label) + '</span><strong>' + esc(latestRow ? latestRow.actualText : "--") + '</strong><em>目标 ' + esc(latestRow ? latestRow.targetText : "--") + '</em></article>' +
        '<article class="target-stat-card"><span>指标总数</span><strong>' + esc(String(summary.count)) + '</strong><em>达标率 ' + esc(fixed(summary.reachRate, 1)) + '%</em></article>' +
        '<article class="target-stat-card"><span>完成率</span><strong>' + esc(latestRow ? latestRow.completionText : "--") + '</strong><em>' + esc(trendDeltaText) + '</em></article>' +
      '</div>' +
      /* ── 2-col grid: trend bar chart + suggestions ── */
      '<div class="target-grid-2">' +
        '<section class="target-panel">' +
          '<div class="target-panel-head"><h3 style="border-left:4px solid #33669E;padding-left:12px;color:#2B5485;font-size:15px">完成率趋势</h3></div>' +
          '<div class="target-trend-wrap">' +
            statBarChartSvg(trend, { unit: "%", width: 500, height: 220 }) +
          '</div>' +
        '</section>' +
        '<section class="target-panel target-suggest-panel">' +
          '<div class="target-panel-head"><h3 style="border-left:4px solid #33669E;padding-left:12px;color:#2B5485;font-size:15px">决策分析建议</h3></div>' +
          '<div class="target-suggest-list">' + suggestsHtml + '</div>' +
        '</section>' +
      '</div>' +
      /* ── Comparison table (full width) ── */
      '<section class="target-panel">' +
        '<div class="target-panel-head"><h3 style="border-left:4px solid #33669E;padding-left:12px;color:#2B5485;font-size:15px">' + esc(compareView === "department" ? "部门对比排名" : "区域对比排名") + '</h3>' +
          '<div class="target-view-tabs">' +
            '<a class="target-view-tab' + (compareView === "area" ? " active" : "") + '" href="' + buildHash("/gov/economic-targets", { tm: metricId, tv: "area", tq: searchTerm || "" }) + '">区域对比</a>' +
            '<a class="target-view-tab' + (compareView === "department" ? " active" : "") + '" href="' + buildHash("/gov/economic-targets", { tm: metricId, tv: "department", tq: searchTerm || "" }) + '">部门对比</a>' +
          '</div>' +
        '</div>' +
        '<div class="target-table-wrap"><table class="table target-compare-table"><thead><tr><th>#</th><th>' + esc(compareView === "department" ? "部门主体" : "区域主体") + '</th><th>实际值</th><th>目标值</th><th>完成率</th><th>状态</th></tr></thead><tbody>' +
          (compareRowsHtml || '<tr><td colspan="6" class="muted">暂无对比数据。</td></tr>') +
        '</tbody></table></div>' +
        paginationHtml +
      '</section>' +
    '</div>';
  }

  function pageGovGovernmentStats(rt) {
    rt = rt || route();
    var q = rt.q || {};
    var tab = q.stab || "manage";
    var groupId = q.sg || "macro";
    var metricId = q.sm || "gdp_billion";
    var term = String(q.sq || "").trim();
    var chartType = q.schart || "trend";
    var docs = governmentStatsDocs(tab);
    var docPageSize = 6;
    var docTotalPages = Math.max(1, Math.ceil(docs.length / docPageSize));
    var docPage = Math.max(1, Math.min(docTotalPages, Number(q.sdp || 1) || 1));
    var docStart = (docPage - 1) * docPageSize;
    var docSlice = docs.slice(docStart, docStart + docPageSize);
    var groupDef = annualMetricGroupDef(groupId);
    var metricDefs = annualMetricDefs().filter(function (item) {
      var matchesGroup = groupId === "all" ? true : item.group === groupId;
      var matchesTerm = !term || item.label.indexOf(term) >= 0 || item.short.indexOf(term) >= 0;
      return matchesGroup && matchesTerm;
    });
    if (!metricDefs.length) metricDefs = annualMetricDefs().filter(function (item) { return groupId === "all" ? true : item.group === groupId; });
    if (!metricDefs.length) metricDefs = annualMetricDefs();
    var metric = metricDefs.find(function (item) { return item.id === metricId; }) || annualMetricDef(metricId);
    if (!metricDefs.some(function (item) { return item.id === metric.id; })) metric = metricDefs[0] || annualMetricDefs()[0];
    var series = governmentStatsSeries(metric.id);
    var forecast = governmentStatsForecast(metric.id);
    var latest = qingyangLatestAnnualStat() || {};
    var latestValue = numValue(latest[metric.id]);
    var prevValue = series.length > 1 ? series[series.length - 2].value : null;
    var yoy = latestValue != null && prevValue != null && prevValue !== 0 ? ((latestValue - prevValue) / Math.abs(prevValue)) * 100 : null;
    function govStatsDocHash(pg) {
      return buildHash("/gov/government-stats", { stab: tab, sg: groupId, sm: metric.id, sq: term || "", schart: chartType, sdp: pg });
    }
    var docRows = docSlice.map(function (item, idx) {
      var globalIdx = docStart + idx;
      return '<tr><td>' + esc(String(globalIdx + 1)) + '</td><td><b>' + esc(item.title || "统计资料") + '</b><div class="muted">' + esc(item.summary || "已纳入资料库") + '</div></td><td>' +
        esc(item.type || "资料") + '</td><td>' + esc(String(item.year || "--")) + '</td><td><button class="btn tiny" data-action="stats_open_doc" data-index="' + esc(String(globalIdx)) + '" data-tab="' + esc(tab) + '">查看摘要</button></td></tr>';
    }).join("");
    var docPagLinks = [];
    for (var dpi = Math.max(1, docPage - 2); dpi <= Math.min(docTotalPages, docPage + 2); dpi++) {
      docPagLinks.push('<a class="exit-page-link ' + (dpi === docPage ? "active" : "") + '" href="' + govStatsDocHash(dpi) + '">' + esc(String(dpi)) + '</a>');
    }
    var docPaginationHtml = docs.length > docPageSize
      ? '<div class="exit-pagination"><span class="exit-pagination-meta">共 ' + esc(String(docs.length)) + ' 份 · 第 ' + esc(String(docPage)) + ' / ' + esc(String(docTotalPages)) + ' 页</span><div class="exit-pagination-links">' +
        (docPage > 1 ? '<a class="exit-page-link nav" href="' + govStatsDocHash(docPage - 1) + '">上一页</a>' : '<span class="exit-page-link nav disabled">上一页</span>') +
        docPagLinks.join("") +
        (docPage < docTotalPages ? '<a class="exit-page-link nav" href="' + govStatsDocHash(docPage + 1) + '">下一页</a>' : '<span class="exit-page-link nav disabled">下一页</span>') +
        '</div></div>'
      : "";
    var metricChips = metricDefs.map(function (item) {
      return '<a class="govstats-chip ' + (item.id === metric.id ? "active" : "") + '" href="' + buildHash("/gov/government-stats", { stab: tab, sg: groupId, sm: item.id, sq: term || "", schart: chartType }) + '">' + esc(item.label) + "</a>";
    }).join("");
    var groupChips = annualMetricGroups().map(function (item) {
      return '<a class="govstats-group-chip ' + (item.id === groupId ? "active" : "") + '" href="' + buildHash("/gov/government-stats", { stab: tab, sg: item.id, sm: metric.id, sq: term || "", schart: chartType }) + '">' + esc(item.label) + "</a>";
    }).join("");
    return '<div class="govstats-page fade-in">' +
      /* ── Top bar ── */
      '<div class="decision-topline">' +
        '<div class="decision-topline-main">' +
          uiIcon('gov') + '<span class="decision-topline-title">政府统计数据专题</span>' +
        '</div>' +
        '<div class="decision-topline-extra">' +
          '<a class="decision-back-link" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a>' +
        '</div>' +
      '</div>' +
      /* ── Filter panel (zftjsj style) ── */
      '<form class="govstats-filter-panel" data-govstats-filter="1">' +
        '<div class="govstats-filter-group">' +
          '<label class="govstats-filter-label">指标类型</label>' +
          '<select name="metric">' +
            metricDefs.map(function (item) { return '<option value="' + esc(item.id) + '"' + (item.id === metric.id ? " selected" : "") + '>' + esc(item.label) + "</option>"; }).join("") +
          '</select>' +
        '</div>' +
        '<div class="govstats-filter-group">' +
          '<label class="govstats-filter-label">数据分组</label>' +
          '<select name="group">' +
            annualMetricGroups().map(function (item) { return '<option value="' + esc(item.id) + '"' + (item.id === groupId ? " selected" : "") + '>' + esc(item.label) + "</option>"; }).join("") +
          '</select>' +
        '</div>' +
        '<div class="govstats-filter-group">' +
          '<label class="govstats-filter-label">图表类型</label>' +
          '<select name="chart">' +
            '<option value="trend"' + (chartType === "trend" ? " selected" : "") + '>趋势图</option>' +
            '<option value="forecast"' + (chartType === "forecast" ? " selected" : "") + '>预测图</option>' +
          '</select>' +
        '</div>' +
        '<div class="govstats-filter-group" style="flex:1">' +
          '<label class="govstats-filter-label">指标名称</label>' +
          '<input name="term" value="' + esc(term) + '" placeholder="请输入指标名称" />' +
        '</div>' +
        '<button class="btn primary" type="submit">筛选分析</button>' +
        '<a class="btn" href="' + buildHash("/gov/government-stats", { stab: tab, sg: groupId, sm: metric.id }) + '">重置</a>' +
      '</form>' +
      /* ── Macro module: stats + trend chart ── */
      '<section class="govstats-panel">' +
        '<div class="govstats-panel-head">' +
          '<h3>宏观经济趋势分析与预测</h3>' +
          '<span>' + esc(groupDef.hint || "青羊区统计公报与年鉴摘要联动分析") + '</span>' +
        '</div>' +
        '<div class="govstats-stats-row">' +
          '<div class="govstats-stat-item"><span class="govstats-stat-label">最新年度</span><span class="govstats-stat-value">' + esc(String((qingyangLatestAnnualStat() && qingyangLatestAnnualStat().year) || "--")) + '</span></div>' +
          '<div class="govstats-stat-item"><span class="govstats-stat-label">指标</span><span class="govstats-stat-value">' + esc(metric.short) + '</span></div>' +
          '<div class="govstats-stat-item"><span class="govstats-stat-label">数值</span><span class="govstats-stat-value">' + esc(metricValueText(latestValue, metric.unit)) + '</span></div>' +
          '<div class="govstats-stat-item"><span class="govstats-stat-label">同比</span><span class="govstats-stat-rate">' + esc(yoy == null ? "--" : (yoy >= 0 ? "+" : "") + fixed(yoy, 1) + "%") + '</span></div>' +
        '</div>' +
        '<div class="govstats-chart-card">' +
          statTrendSvg(series, chartType === "forecast" ? forecast : [], { unit: metric.unit }) +
        '</div>' +
      '</section>' +
      /* ── Indicator filter (pill tabs) ── */
      '<div class="govstats-indicator-filter">' +
        '<div class="govstats-indicator-section">' +
          '<span class="govstats-indicator-title">指标分组</span>' +
          '<div class="govstats-group-list">' + groupChips + '</div>' +
        '</div>' +
        '<div class="govstats-indicator-section">' +
          '<span class="govstats-indicator-title">具体指标</span>' +
          '<div class="govstats-chip-list">' + metricChips + '</div>' +
        '</div>' +
      '</div>' +
      /* ── Table module ── */
      '<section class="govstats-panel">' +
        '<div class="govstats-panel-head">' +
          '<h3>' + esc(tab === "yearbook" ? "统计年鉴目录" : tab === "bulletin" ? "统计年报目录" : "统计资料管理") + '</h3>' +
          '<span>共 ' + esc(String(docs.length)) + ' 份资料' + (docTotalPages > 1 ? '，当前第 ' + esc(String(docPage)) + ' 页' : '') + '</span>' +
        '</div>' +
        '<div class="govstats-doc-toolbar">' +
          '<span class="pill">区（县）级：青羊区</span>' +
          '<span class="pill">' + esc(tab === "yearbook" ? "统计年鉴" : tab === "bulletin" ? "统计公报 / 年报" : "全部资料") + '</span>' +
        '</div>' +
        '<table class="table govstats-doc-table"><thead><tr>' +
          '<th>序号</th><th>资料名称</th><th>资料类型</th><th>年度</th><th>操作</th>' +
        '</tr></thead><tbody>' +
          (docRows || '<tr><td colspan="5" class="muted">当前分类下暂无统计资料。</td></tr>') +
        '</tbody></table>' +
        docPaginationHtml +
      '</section>' +
    '</div>';
  }

  function investmentIndustryList() {
    return ["航空航天", "人工智能", "金融", "商务商贸", "文化旅游", "低空经济"];
  }

  function investmentWeakSummary(industry, districtName) {
    var base = {
      "航空航天": [
        { label: "适航取证与验证服务", reason: "当前链条更容易卡在适航、验证和专业服务环节，建议优先补充取证服务和第三方验证能力。" },
        { label: "航空复材与高端连接件", reason: "上游高附加值材料和连接件配套偏薄，容易影响链条完整性和本地配套率。" },
        { label: "航电与控制系统配套", reason: "机载控制、航电和系统级配套企业相对不足，适合作为定向招商方向。" }
      ],
      "人工智能": [
        { label: "行业数据治理服务", reason: "数据清洗、标注、治理和合规流转能力是模型落地的薄弱点，建议引入数据服务商。" },
        { label: "多模态模型服务平台", reason: "模型服务层和垂类平台企业数量不足，影响场景应用的持续扩展。" },
        { label: "AI 安全评测与合规", reason: "大模型安全、评测和合规支撑偏弱，适合引入专业机构形成配套。" }
      ],
      "金融": [
        { label: "供应链金融核心企业牵引", reason: "如果缺少核心企业牵引，供应链金融产品很难形成规模化场景。" },
        { label: "知识产权质押与科技金融", reason: "科技金融细分服务不足，容易导致创新型企业融资转化效率不高。" },
        { label: "产业基金与投贷联动", reason: "股债联动和产业基金配套偏弱，会影响招商项目的落地承接效率。" }
      ],
      "商务商贸": [
        { label: "仓配一体履约服务", reason: "履约和仓配体系薄弱会直接影响平台招商和消费转化能力。" },
        { label: "跨境与外贸渠道运营", reason: "外部渠道和跨境能力不足，限制商贸服务的增量空间。" },
        { label: "品牌首店与渠道运营", reason: "品牌招商和渠道精细化运营能力有待加强，适合引入专业运营主体。" }
      ],
      "文化旅游": [
        { label: "沉浸式演艺运营", reason: "演艺和沉浸体验是提升消费转化的重要环节，但当前专业运营支撑偏少。" },
        { label: "票务平台与会员运营", reason: "数字票务和会员体系不足，会影响客流沉淀和复游率。" },
        { label: "文创 IP 商业化", reason: "IP 授权、联名开发和商业转化环节相对偏弱，建议引入文创运营主体。" }
      ],
      "低空经济": [
        { label: "低空调度平台", reason: "平台调度和空域协同能力是低空经济落地的关键短板，需要优先补足。" },
        { label: "运维保障与检测服务", reason: "维保、检测、巡检等保障体系不足，会限制场景复制速度。" },
        { label: "空域规则与运营服务", reason: "低空规则服务和专业运营机构不足，影响场景商业化进度。" }
      ]
    };
    var districtHints = {
      "青羊区": "可结合现有高端制造与专业服务基础，优先做强链条服务配套。",
      "成华区": "可结合工业基础和园区载体条件，优先承接制造与应用场景项目。",
      "武侯区": "可结合文旅消费和服务业基础，优先导入平台型和运营型主体。"
    };
    var rows = (base[industry] || base["航空航天"]).slice();
    var hint = districtHints[districtName] || "可结合本地园区承载和主导产业方向，优先引入能补足关键短板的项目。";
    return rows.map(function (item, idx) {
      return {
        rank: idx + 1,
        label: item.label,
        reason: item.reason,
        hint: hint
      };
    });
  }

  var _investmentChainAssessmentCache = {};

  function investmentChainAssessment(districtName, industry) {
    var targetDistrict = districtName || "全市";
    var targetIndustry = industry || "航空航天";
    var cacheKey = targetDistrict + "|" + targetIndustry;
    var cached = _investmentChainAssessmentCache[cacheKey];
    var prevRegistry = _chainNodeRegistry;
    var prevProfiles = _chainProfiles;
    var prevRegistryRaw = null;
    var ctx;
    if (cached) return deepClone(cached);
    try {
      try {
        prevRegistryRaw = localStorage.getItem(CHAIN_REGISTRY_KEY);
      } catch (e) {}
      pageGovChain({ q: { district: targetDistrict, industry: targetIndustry } });
      ctx = (_chainNodeRegistry && _chainNodeRegistry.context) || {};
      cached = {
        district: ctx.district || targetDistrict,
        industry: ctx.industry || targetIndustry,
        updatedAt: ctx.updatedAt || today(),
        weakCount: Number(ctx.weakNodeCount || 0),
        weakNodes: ((ctx.topWeakNodes || []).slice(0, 3)).map(function (item, idx) {
          return {
            id: item.id || "",
            rank: idx + 1,
            label: item.label,
            reason: item.reason,
            hint: item.advice,
            level: item.level,
            levelLabel: item.levelLabel,
            totalCount: item.totalCount
          };
        })
      };
    } catch (e) {
      cached = {
        district: targetDistrict,
        industry: targetIndustry,
        updatedAt: today(),
        weakCount: 0,
        weakNodes: []
      };
    } finally {
      _chainNodeRegistry = prevRegistry;
      _chainProfiles = prevProfiles;
      try {
        if (prevRegistryRaw == null) localStorage.removeItem(CHAIN_REGISTRY_KEY);
        else localStorage.setItem(CHAIN_REGISTRY_KEY, prevRegistryRaw);
      } catch (e) {}
    }
    _investmentChainAssessmentCache[cacheKey] = deepClone(cached);
    return deepClone(cached);
  }

  function pageGovInvestmentAnalysis(rt) {
    var gd = geoData();
    var q = (rt && rt.q) || {};
    var districts = govDemoGeoItems(gd.districts || []).slice().sort(function (a, b) {
      return String((a && a.name) || "").localeCompare(String((b && b.name) || ""));
    });
    var did = govDemoDistrictId();
    var district = districts.filter(function (item) { return item.id === did; })[0] || districts[0] || null;
    var districtName = (district && district.name) || "青羊区";
    var industries = investmentIndustryList();
    var industry = industries.indexOf(q.industry) >= 0 ? q.industry : industries[0];
    var streets = (gd.streets || []).filter(function (item) {
      return !did || item.district_id === did;
    });
    var parks = (gd.parks || []).filter(function (item) {
      return !did || item.district_id === did;
    });
    var buildings = (gd.buildings || []).filter(function (item) {
      if (!did) return true;
      var street = (gd.streets || []).filter(function (streetItem) { return streetItem.id === item.street_id; })[0] || null;
      return !!street && street.district_id === did;
    });
    var districtOpts = districts
      .map(function (item) {
        return '<option value="' + esc(item.id) + '"' + (item.id === did ? " selected" : "") + ">" + esc(item.name) + "</option>";
      })
      .join("");
    var industryOpts = industries
      .map(function (item) {
        return '<option value="' + esc(item) + '"' + (item === industry ? " selected" : "") + ">" + esc(item) + "</option>";
      })
      .join("");
    var streetLeadTotal = streets.reduce(function (sum, item) {
      return sum + Number(item.invest_leads || 0);
    }, 0);
    var parkLeadTotal = parks.reduce(function (sum, item) {
      return sum + Number(item.invest_leads || 0);
    }, 0);
    var keyEnterpriseTotal = parks.reduce(function (sum, item) {
      return sum + Number(item.key_enterprises || 0);
    }, 0);
    var topStreets = streets.slice().sort(function (a, b) {
      return Number(b.invest_leads || 0) - Number(a.invest_leads || 0);
    }).slice(0, 5);
    var topParks = parks.slice().sort(function (a, b) {
      return Number(b.invest_leads || 0) - Number(a.invest_leads || 0);
    }).slice(0, 5);
    var topStreetName = (topStreets[0] && topStreets[0].name) || districtName;
    var topParkName = (topParks[0] && topParks[0].name) || (districtName + "重点园区");
    var chainAssessment = investmentChainAssessment(districtName, industry);
    var weakSummary = (chainAssessment.weakNodes && chainAssessment.weakNodes.length)
      ? chainAssessment.weakNodes
      : investmentWeakSummary(industry, districtName);
    var weakSummaryScope = chainAssessment.district || districtName;
    var weakSummaryUpdatedAt = chainAssessment.updatedAt || today();
    var weakSummaryCount = chainAssessment.weakCount || weakSummary.length;
    var geoStreetHref = buildHash("/gov/geo-street", { did: did, scope: "street" });
    var geoParkHref = buildHash("/gov/geo-park", { did: did, scope: "park", park_mode: "all" });
    var chainHref = buildHash("/gov/chain", { district: districtName, industry: industry });
    var portraitHref = buildHash("/gov/portrait", { industry_cat: industry, carrier_district: districtName });
    var alertHref = "#/gov/enterprise-exit";

    function tableRows(items, type) {
      if (!items.length) return '<tr><td colspan="3" class="muted">暂无可展示数据</td></tr>';
      return items.map(function (item, idx) {
        var secondary = type === "street" ? "重点企业 " + Number(item.key_enterprises || 0) + " 家" : "园区企业 " + Number(item.enterprises || 0) + " 家";
        return "<tr><td>" + (idx + 1) + "</td><td><b>" + esc(item.name || "-") + "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" + esc(secondary) + "</div></td><td><span class=\"tag teal\">招商线索 " + esc(String(item.invest_leads || 0)) + "</span></td></tr>";
      }).join("");
    }

    var actionTiles = [
      {
        href: geoStreetHref,
        icon: "geo",
        title: "GIS 招商热力研判",
        desc: "进入街道级视图，优先查看" + districtName + "的街道热区和招商线索。"
      },
      {
        href: geoParkHref,
        icon: "park",
        title: "园区承载与载体评估",
        desc: "围绕重点园区查看空间承接能力、入驻率和重点企业分布。"
      },
      {
        href: chainHref,
        icon: "chain",
        title: "产业链补链招商",
        desc: "切到“" + industry + "”图谱，查看薄弱环节和补链方向。"
      },
      {
        href: alertHref,
        icon: "alert",
        title: "迁出预警协同",
        desc: "同步查看重点企业波动和预警工单，兼顾招商与稳企。"
      }
    ].map(function (item) {
      return '<a class="sys-quick-tile" href="' + esc(item.href) + '"><div class="sys-quick-head"><span class="sys-quick-icon">' + uiIcon(item.icon, "sys-quick-icon-glyph") + '</span><strong>' + esc(item.title) + '</strong></div><p>' + esc(item.desc) + '</p><span>进入专题</span></a>';
    }).join("");

    var suggestionHtml = [
      "建议优先围绕“" + topStreetName + "”和“" + topParkName + "”组织招商线索核查，先锁定承接空间和重点项目来源。",
      "建议同步进入“" + industry + "”产业链式图谱，优先查看薄弱环节识别结果，再形成补链招商对象池。",
      "如涉及重点企业经营波动，建议联动迁出预警模块开展稳企留商研判，避免招商与稳企两张皮。"
    ].map(function (line) {
      return "<li>" + esc(line) + "</li>";
    }).join("");

    var weakHtml = weakSummary.map(function (item) {
      var weakLinkHref = buildHash("/gov/chain", item.id
        ? { district: weakSummaryScope, industry: industry, term: item.label, open_node: item.id }
        : { district: districtName, industry: industry, term: item.label });
      return '<div class="sys-invest-weak-item"><div class="sys-invest-weak-row"><span class="sys-invest-weak-rank">0' +
        esc(String(item.rank)) +
        '</span><strong>' +
        esc(item.label) +
        '</strong><a class="btn small sys-invest-weak-link" href="' +
        esc(weakLinkHref) +
        '">查看节点</a></div><p>' +
        esc(item.reason) +
        '</p><span class="sys-invest-weak-hint">' +
        esc(item.hint) +
        ((item.totalCount != null && item.totalCount !== "") ? " · 当前企业支撑 " + esc(String(item.totalCount)) + " 家" : "") +
        '</span></div>';
    }).join("");

    return (
      '<div class="grid">' +
      card(
        "招商研判专题",
        districtName + " · " + industry + " · 招商热力 / 补链判断 / 风险协同",
        '<a class="btn" href="#/gov/home">返回平台首页</a><a class="btn primary" href="' + chainHref + '">进入产业链补链研判</a>',
        '<div class="form"><div class="field"><label>选择区（市）县</label><select data-role="investment-district">' + districtOpts + '</select></div><div class="field"><label>主导产业</label><select data-role="investment-industry">' + industryOpts + '</select></div></div><div class="row-actions" style="justify-content:flex-start;margin-top:14px;"><button class="btn primary" data-action="investment_apply_filter">应用筛选</button><a class="btn" href="' + geoStreetHref + '">进入区域街道分析</a><a class="btn" href="' + portraitHref + '">进入企业画像筛选</a></div><div style="margin-top:14px;">' +
          kpis([
            { label: "街道招商线索", value: String(streetLeadTotal), hint: districtName + "街道层级累计线索" },
            { label: "园区招商线索", value: String(parkLeadTotal), hint: "园区层级可承接项目线索" },
            { label: "重点园区", value: String(parks.length), hint: "当前区域重点园区数量" },
            { label: "重点企业", value: String(keyEnterpriseTotal), hint: "重点企业与链上主体支撑" }
          ]) +
        "</div>",
        12
      ) +
      card(
        "招商优先清单",
        "街道热区与重点园区双线查看",
        "",
        '<div class="split"><div><div class="muted" style="margin-bottom:8px;">街道优先级</div><table class="table"><thead><tr><th>序号</th><th>街道</th><th>线索</th></tr></thead><tbody>' +
          tableRows(topStreets, "street") +
          '</tbody></table></div><div><div class="muted" style="margin-bottom:8px;">园区优先级</div><table class="table"><thead><tr><th>序号</th><th>园区</th><th>线索</th></tr></thead><tbody>' +
          tableRows(topParks, "park") +
          "</tbody></table></div></div>",
        7
      ) +
      card(
        "专题联动建议",
        "把 GIS、图谱、画像和预警串成一条招商工作链",
        "",
        '<div class="sys-quick-grid invest-link-grid">' +
          actionTiles +
          '</div><div style="margin-top:16px;"><div class="muted" style="margin-bottom:8px;">当前建议动作</div><ul class="sys-invest-suggestion-list">' +
          suggestionHtml +
          "</ul><div class=\"pill\" style=\"margin-top:14px;\">当前区域楼宇载体 " + esc(String(buildings.length)) + " 个，可结合园区范围与楼宇详情查看承接空间。</div><div class=\"sys-invest-weak-summary\"><div class=\"sys-invest-weak-head\"><div><span class=\"sys-panel-kicker\">WEAK LINKS</span><h3>薄弱环节摘要</h3><p class=\"sys-invest-weak-note\">来源：" + esc(weakSummaryScope) + " · 图谱更新 " + esc(weakSummaryUpdatedAt) + " · 识别重点补强 " + esc(String(weakSummaryCount)) + " 项</p></div><a class=\"btn small\" href=\"" + chainHref + "\">进入图谱核查</a></div><div class=\"sys-invest-weak-list\">" +
          weakHtml +
          "</div></div></div>",
        5
      ) +
      "</div>"
    );
  }

  function pageGovOverview() {
    var ents = govDemoEnterprises();
    var keyCnt = ents.filter(isKeyEnterprise).length;
    var scopedAlerts = govDemoAlerts();
    var highCnt = scopedAlerts.filter(function (a) {
      return a.level === "高" && alertStatus(a.id) !== "已保存跟进";
    }).length;
    var openDem = (state.demands || []).filter(function (d) {
      return d.status !== "已完成" && d.status !== "已关闭" && govDemoIsInDistrict(entById(d.enterprise_id));
    }).length;

    var leftRows = scopedAlerts
      .slice()
      .sort(function (a, b) {
        return (b.score || 0) - (a.score || 0);
      })
      .slice(0, 5)
      .map(function (a) {
        var e = entById(a.enterprise_id) || { name: "未知企业" };
        var tag = a.level === "高" ? "red" : a.level === "中" ? "orange" : "green";
        return (
          "<tr>" +
          '<td><a href="#/gov/alert/' +
          a.id +
          '"><b>' +
          esc(e.name) +
          "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" +
          esc(a.type) +
          " · " +
          esc(fmtDate(a.created_at)) +
          "</div></a></td>" +
          "<td><span class=\"tag " +
          tag +
          "\">" +
          esc(a.level + "风险") +
          "</span><span class=\"tag\">风险指数 " +
          esc(a.score) +
          "</span></td>" +
          "<td><span class=\"tag\">" +
          esc(alertStatus(a.id)) +
          "</span></td>" +
          "</tr>"
        );
      })
      .join("");

    var rightRows = (state.demands || [])
      .slice()
      .filter(function (d) { return govDemoIsInDistrict(entById(d.enterprise_id)); })
      .sort(function (a, b) {
        return String(b.created_at).localeCompare(String(a.created_at));
      })
      .slice(0, 6)
      .map(function (d) {
        var e = entById(d.enterprise_id) || { name: "未知企业" };
        return (
          "<tr>" +
          "<td><b>" +
          esc(d.title) +
          "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" +
          esc(e.name + " · " + fmtDate(d.created_at)) +
          "</div></td>" +
          "<td><span class=\"tag teal\">" +
          esc(d.category) +
          "</span></td>" +
          "<td><span class=\"tag\">" +
          esc(d.status) +
          "</span></td>" +
          "</tr>"
        );
      })
      .join("");

    return (
      '<div class="grid">' +
      card(
        "重点企业、预警闭环、企业对接",
        "重点企业、预警闭环、企业对接",
        '<button class="btn primary" data-action="gen_monthly">一键生成月报</button><button class="btn" data-action="export_demo">导出清单</button>',
        kpis([
          { label: "企业总数", value: String(ents.length), hint: "规上/规下（演示数据）" },
          { label: "重点企业", value: String(keyCnt), hint: "规则：规上/专精特新/关键节点" },
          { label: "高风险预警", value: String(highCnt), hint: "迁出/经营波动（演示）" },
          { label: "待处理企业", value: String(openDem), hint: "空间/服务/融资对接" },
        ])
      ) +
      card(
        "重点预警",
        "风险信号 -> 派单处置",
        "",
        '<table class="table"><thead><tr><th>企业</th><th>风险</th><th>负责人</th></tr></thead><tbody>' +
          (leftRows || '<tr><td colspan="3" class="muted">暂无需求</td></tr>') +
          "</tbody></table>",
        7
      ) +
      card(
        "最新企业",
        "风险信号 -> 派单资源",
        '<a class="btn" href="#/gov/ecosystem">去派单</a>',
        '<table class="table"><thead><tr><th>企业</th><th>风险</th><th>负责人</th></tr></thead><tbody>' +
          (rightRows || '<tr><td colspan="3" class="muted">暂无需求</td></tr>') +
          "</tbody></table>",
        5
      ) +
      "</div>"
    );
  }

  function pageGovBrainDashboard(rt) {
    rt = rt || route();
    var q = (rt && rt.q) || {};
    var geo = geoData();
    var district = govDemoGeoItems(geo.districts || [])[0] || null;
    var streets = govDemoGeoItems(geo.streets || []).slice();
    function dashboardStreetDisplayScore(item) {
      if (!item) return -1;
      var score = 0;
      var rings = geoItemRings(item);
      var bounds = geoBoundsFromRings(rings);
      if (rings.length) score += 100;
      if (bounds) score += Math.min(18, (Number(bounds.maxX || 0) - Number(bounds.minX || 0)) * (Number(bounds.maxY || 0) - Number(bounds.minY || 0)));
      if (item.id && !/^gsx/i.test(String(item.id))) score += 12;
      if (isFinite(Number(item.x)) && isFinite(Number(item.y))) score += 2;
      return score;
    }
    function pickBetterDashboardStreet(nextItem, prevItem) {
      if (!prevItem) return nextItem;
      if (!nextItem) return prevItem;
      var nextScore = dashboardStreetDisplayScore(nextItem);
      var prevScore = dashboardStreetDisplayScore(prevItem);
      if (nextScore !== prevScore) return nextScore > prevScore ? nextItem : prevItem;
      return String(nextItem.id || "").localeCompare(String(prevItem.id || "")) < 0 ? nextItem : prevItem;
    }
    var streetById = {};
    streets.forEach(function (street) {
      if (!street || !street.id) return;
      streetById[String(street.id)] = pickBetterDashboardStreet(street, streetById[String(street.id)]);
    });
    streets = Object.keys(streetById).map(function (id) { return streetById[id]; });
    var streetByName = {};
    streets.forEach(function (street) {
      if (!street) return;
      var key = geoNameKey(street.name || street.id || "");
      if (!key) return;
      streetByName[key] = pickBetterDashboardStreet(street, streetByName[key]);
    });
    streets = Object.keys(streetByName).map(function (key) { return streetByName[key]; });
    var enterprises = govDemoEnterprises();
    var parks = govDemoGeoItems(geo.parks || []);
    var buildings = govDemoGeoItems(geo.buildings || []);
    var projects = keyProjectData();
    var alerts = govDemoAlerts();
    var latestAnnual = qingyangLatestAnnualStat();
    var activeMetric = q.metric === "fixed" || q.metric === "industrial" ? q.metric : "revenue";

    function metricSeed(key, min, max, digits) {
      var h = hashNumber(String(key || "brainx"));
      var ratio = (h % 1000) / 1000;
      return Number((min + (max - min) * ratio).toFixed(digits == null ? 1 : digits));
    }

    function formatSignedPct(value, digits) {
      var num = Number(value || 0);
      if (!isFinite(num)) return "--";
      return (num > 0 ? "+" : "") + fixed(num, digits == null ? 1 : digits) + "%";
    }

    function ensureCount(value, fallback) {
      var num = Number(value || 0);
      return Math.max(fallback, Math.round(num));
    }

    function matchTags(item, markers) {
      var text = [item && item.name, item && item.industry, item && item.level, ((item && item.tags) || []).join(" ")].join(" ");
      for (var i = 0; i < (markers || []).length; i++) {
        if (text.indexOf(markers[i]) >= 0) return true;
      }
      return false;
    }

    function streetProjects(streetId) {
      return projects.filter(function (item) {
        return item && item.street_id === streetId;
      });
    }

    function streetEnterprises(streetId) {
      return enterprises.filter(function (item) {
        return item && item.street_id === streetId;
      });
    }

    var monitorConfigs = {
      revenue: {
        label: "规上限上营业收入",
        items: [
          { label: "规上限上营业收入", value: "3221.12 亿" },
          { label: "净增上规上限企业", value: "178 家" },
          { label: "主攻产业营业收入增速", value: "+5.6%" }
        ]
      },
      fixed: {
        label: "固定资产投资增速",
        items: [
          { label: "固定资产投资增速", value: "-5.6%" },
          { label: "主攻产业开工项目", value: "17 个" },
          { label: "年度投资完成率", value: "68.4%" }
        ]
      },
      industrial: {
        label: "规上工业增加值增速",
        items: [
          { label: "规上工业增加值增速", value: "+5.6%" },
          { label: "净增规上工业企业", value: "8 家" },
          { label: "规上工业总产值", value: "58.2 亿" }
        ]
      }
    };
    var latestGdp = latestAnnual && latestAnnual.gdp_billion ? fixed(latestAnnual.gdp_billion, 1) + " 亿元" : "3221.12 亿元";
    var latestBudget = latestAnnual && latestAnnual.public_budget_billion ? fixed(latestAnnual.public_budget_billion, 1) + " 亿元" : "14587.2 万元";
    var latestFixedAsset = latestAnnual && latestAnnual.fixed_asset_growth_pct != null ? formatSignedPct(latestAnnual.fixed_asset_growth_pct, 1) : "-5.6%";
    var latestIndustrial = latestAnnual && latestAnnual.industrial_billion ? fixed(latestAnnual.industrial_billion, 1) + " 亿元" : "58.2 亿元";
    var keyEnterpriseCount = enterprises.filter(isKeyEnterprise).length;
    var highGrowthCount = enterprises.filter(function (item) {
      return matchTags(item, ["高成长型", "高新技术", "专精特新"]);
    }).length;
    var specializedCount = enterprises.filter(function (item) {
      return matchTags(item, ["专精特新"]);
    }).length;
    var listedCount = enterprises.filter(function (item) {
      return matchTags(item, ["上市"]);
    }).length;
    var overviewCapsules = [
      { title: "街道单元", value: String(streets.length), note: "网格化协同" },
      { title: "重点园区", value: String(parks.length), note: "产业承载" },
      { title: "产业载体", value: String(buildings.length), note: "楼宇空间" }
    ];
    var overviewMetrics = [
      { label: "地区生产总值", value: latestGdp, trend: "年度接入" },
      { label: "固定资产投资增速", value: latestFixedAsset, trend: "同比增速" },
      { label: "规上工业总产值", value: latestIndustrial, trend: "工业底盘" },
      { label: "一般公共预算", value: latestBudget, trend: "财政支撑" },
      { label: "重点企业画像", value: String(keyEnterpriseCount) + " 家", trend: "企业服务" },
      { label: "重点项目调度", value: String(projects.length) + " 个", trend: "专题联动" }
    ];
    var latestYearLabel = latestAnnual && latestAnnual.year ? String(latestAnnual.year) + " 年" : "最新年度";

    var dashboardDistrictRings = district ? geoItemRings(district) : [];
    var dashboardDistrictAnchor = dashboardDistrictRings.length
      ? keyProjectSampleInteriorPoint(dashboardDistrictRings, [Number((district && district.x) || 50), Number((district && district.y) || 50)])
      : [Number((district && district.x) || 50), Number((district && district.y) || 50)];

    var streetRows = streets.map(function (street) {
      var streetEnts = streetEnterprises(street.id);
      var streetKeyCount = streetEnts.filter(isKeyEnterprise).length || Number(street.key_enterprises || 0);
      var streetProjectList = streetProjects(street.id);
      var streetRings = geoItemRings(street);
      var rawStreetPt = [Number(street.x), Number(street.y)];
      if (!isFinite(rawStreetPt[0])) rawStreetPt[0] = dashboardDistrictAnchor[0];
      if (!isFinite(rawStreetPt[1])) rawStreetPt[1] = dashboardDistrictAnchor[1];
      var streetAnchor = streetRings.length
        ? keyProjectSampleInteriorPoint(streetRings, rawStreetPt)
        : (dashboardDistrictRings.length
          ? keyProjectProjectPointToRings(rawStreetPt, dashboardDistrictRings, dashboardDistrictAnchor)
          : rawStreetPt);
      if (dashboardDistrictRings.length && !keyProjectPointInRings(streetAnchor, dashboardDistrictRings)) {
        streetAnchor = keyProjectProjectPointToRings(streetAnchor, dashboardDistrictRings, dashboardDistrictAnchor);
      }
      return {
        id: street.id,
        name: street.name || "示例街道",
        x: Number(streetAnchor[0].toFixed(3)),
        y: Number(streetAnchor[1].toFixed(3)),
        street: street,
        cluster: street.cluster || "产业服务",
        heat: Number(street.heat || 0),
        population: metricSeed(street.id + "_population", 3.4, 11.8, 1),
        gdp: Number((Math.max(22, Number(street.output_y || 0) * 0.68 + streetKeyCount * 0.12)).toFixed(1)),
        gdpGrowth: metricSeed(street.id + "_gdp_growth", 4.8, 9.6, 1),
        tax: Number((Math.max(2.8, Number(street.tax_y || 0) * 0.92)).toFixed(1)),
        keyCount: Math.max(12, streetKeyCount || 0),
        projectCount: Math.max(1, streetProjectList.length || Math.round(Number(street.invest_leads || 0) / 2)),
        serviceCount: Math.max(3, Math.round(streetKeyCount / 4)),
        talentCount: Math.max(60, Math.round(metricSeed(street.id + "_talent", 60, 360, 0)))
      };
    });

    var rankedStreetRows = streetRows.slice().sort(function (a, b) {
      return Number(b.keyCount || 0) - Number(a.keyCount || 0);
    });
    var maxStreetKey = Math.max(1, Number((rankedStreetRows[0] && rankedStreetRows[0].keyCount) || 1));
    var topStreetIds = {};
    rankedStreetRows.slice(0, 4).forEach(function (item) {
      topStreetIds[item.id] = "major";
    });
    rankedStreetRows.slice(4, 8).forEach(function (item) {
      topStreetIds[item.id] = "mid";
    });

    function isOpenDemand(item) {
      return item && item.status !== "已完成" && item.status !== "已关闭";
    }

    var openDemandItems = (state.demands || []).filter(function (item) {
      var ent = entById(item.enterprise_id);
      return ent && govDemoIsInDistrict(ent) && isOpenDemand(item);
    });
    var focusActionLinks = [
      { href: "#/gov/geo-street", label: "进入街道经济研判", note: "从区级总览进入街道、园区、楼宇三级下钻" },
      { href: "#/gov/key-projects", label: "查看重点项目调度", note: "切换到区级项目盘点与预警处置" },
      { href: "#/gov/enterprises", label: "查看企业服务档案", note: "进入企业画像、诉求和政策匹配专题" }
    ];

    var metricTabHtml = Object.keys(monitorConfigs).map(function (key) {
      var item = monitorConfigs[key];
      return '<a class="brainx-mode-pill ' + (key === activeMetric ? "active" : "") + '" href="' + buildHash("/gov/brain-dashboard", { metric: key }) + '">' + esc(item.label) + "</a>";
    }).join("");

    var districtActionStatsHtml = [
      { label: "重点企业", value: String(keyEnterpriseCount) + " 家" },
      { label: "重点项目", value: String(projects.length) + " 个" },
      { label: "载体楼宇", value: String(buildings.length) + " 栋" },
      { label: "在办诉求", value: String(openDemandItems.length) + " 条" }
    ].map(function (item) {
      return '<div class="brainx-focus-stat"><span>' + esc(item.label) + '</span><strong>' + esc(item.value) + "</strong></div>";
    }).join("");
    var overviewCapsulesHtml = overviewCapsules.map(function (item) {
      return '<div class="brainx-capsule"><span class="brainx-capsule-label">' + esc(item.title) + '</span><strong>' + esc(item.value) + '</strong><em>' + esc(item.note) + "</em></div>";
    }).join("");
    var overviewMetricsHtml = overviewMetrics.map(function (item) {
      return '<div class="brainx-metric-card"><span>' + esc(item.label) + '</span><strong>' + esc(item.value) + '</strong><em>' + esc(item.trend) + "</em></div>";
    }).join("");
    var focusActionLinksHtml = focusActionLinks.map(function (item) {
      return '<a class="brainx-link-row" href="' + esc(item.href) + '"><div class="brainx-link-main"><strong>' + esc(item.label) + '</strong><span>' + esc(item.note) + '</span></div><div class="brainx-link-meta"><span class="brainx-link-cta">进入</span></div></a>';
    }).join("");
    function dashboardBoundarySegmentsFromRings(rings, snapStep, sampleStep) {
      var segments = {};
      var snap = Number(snapStep || 0.02);
      var step = Number(sampleStep || 0.02);
      function pointKey(x, y) {
        var px = Math.round(clamp(Number(x || 0), 0, 100) / snap) * snap;
        var py = Math.round(clamp(Number(y || 0), 0, 100) / snap) * snap;
        return px.toFixed(3) + "," + py.toFixed(3);
      }
      function segmentKey(aKey, bKey) {
        return aKey < bKey ? (aKey + "-" + bKey) : (bKey + "-" + aKey);
      }
      (rings || []).forEach(function (ring) {
        if (!Array.isArray(ring) || ring.length < 3) return;
        for (var i = 0; i < ring.length; i++) {
          var a = ring[i];
          var b = ring[(i + 1) % ring.length];
          if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) continue;
          var ax = clamp(Number(a[0] || 0), 0, 100);
          var ay = clamp(Number(a[1] || 0), 0, 100);
          var bx = clamp(Number(b[0] || 0), 0, 100);
          var by = clamp(Number(b[1] || 0), 0, 100);
          var length = Math.sqrt(Math.pow(bx - ax, 2) + Math.pow(by - ay, 2));
          var parts = Math.max(1, Math.ceil(length / step));
          for (var part = 0; part < parts; part++) {
            var t0 = part / parts;
            var t1 = (part + 1) / parts;
            var p0 = pointKey(ax + (bx - ax) * t0, ay + (by - ay) * t0);
            var p1 = pointKey(ax + (bx - ax) * t1, ay + (by - ay) * t1);
            if (p0 === p1) continue;
            var key = segmentKey(p0, p1);
            if (!segments[key]) segments[key] = { a: p0, b: p1, count: 0 };
            segments[key].count += 1;
          }
        }
      });
      return segments;
    }

    function dashboardBoundaryPathFromSegments(segments, closePath) {
      var adjMap = {};
      function addAdj(fromKey, toKey) {
        if (!adjMap[fromKey]) adjMap[fromKey] = [];
        if (adjMap[fromKey].indexOf(toKey) >= 0) return;
        adjMap[fromKey].push(toKey);
      }
      Object.keys(segments || {}).forEach(function (segKey) {
        var seg = segments[segKey];
        if (!seg || !seg.a || !seg.b) return;
        addAdj(seg.a, seg.b);
        addAdj(seg.b, seg.a);
      });
      var visited = {};
      function walkChain(startKey, nextKey) {
        var segKey = startKey < nextKey ? (startKey + "-" + nextKey) : (nextKey + "-" + startKey);
        if (visited[segKey]) return null;
        visited[segKey] = true;
        var chain = [startKey, nextKey];
        var prev = startKey;
        var cur = nextKey;
        while (true) {
          var neighbors = adjMap[cur] || [];
          if (neighbors.length !== 2) break;
          var nxt = neighbors[0] === prev ? neighbors[1] : neighbors[0];
          var nextSegKey = cur < nxt ? (cur + "-" + nxt) : (nxt + "-" + cur);
          if (visited[nextSegKey]) break;
          visited[nextSegKey] = true;
          chain.push(nxt);
          prev = cur;
          cur = nxt;
        }
        return chain;
      }
      var chains = [];
      Object.keys(adjMap).forEach(function (nodeKey) {
        var neighbors = adjMap[nodeKey] || [];
        if (neighbors.length === 2) return;
        neighbors.forEach(function (nbr) {
          var chain = walkChain(nodeKey, nbr);
          if (chain && chain.length >= 2) chains.push(chain);
        });
      });
      Object.keys(adjMap).forEach(function (nodeKey) {
        var neighbors = adjMap[nodeKey] || [];
        neighbors.forEach(function (nbr) {
          var segKey = nodeKey < nbr ? (nodeKey + "-" + nbr) : (nbr + "-" + nodeKey);
          if (visited[segKey]) return;
          var chain = walkChain(nodeKey, nbr);
          if (chain && chain.length >= 2) chains.push(chain);
        });
      });
      return chains.map(function (chain) {
        var pts = chain.map(function (nodeKey) {
          var p = nodeKey.split(",");
          return [Number(p[0]), Number(p[1])];
        });
        if (pts.length <= 2) {
          var linePath = "M" + pts.map(function (pt) {
            return pt[0].toFixed(3) + "," + pt[1].toFixed(3);
          }).join(" L");
          return closePath ? (linePath + " Z") : linePath;
        }
        var d = "M" + pts[0][0].toFixed(3) + "," + pts[0][1].toFixed(3);
        for (var i = 0; i < pts.length - 1; i++) {
          var p0 = pts[Math.max(0, i - 1)];
          var p1 = pts[i];
          var p2 = pts[i + 1];
          var p3 = pts[Math.min(pts.length - 1, i + 2)];
          var tension = 7.5;
          var cp1x = p1[0] + (p2[0] - p0[0]) / tension;
          var cp1y = p1[1] + (p2[1] - p0[1]) / tension;
          var cp2x = p2[0] - (p3[0] - p1[0]) / tension;
          var cp2y = p2[1] - (p3[1] - p1[1]) / tension;
          d += " C" + cp1x.toFixed(3) + "," + cp1y.toFixed(3) +
            " " + cp2x.toFixed(3) + "," + cp2y.toFixed(3) +
            " " + p2[0].toFixed(3) + "," + p2[1].toFixed(3);
        }
        if (closePath) d += " Z";
        return d;
      }).join(" ");
    }

    var districtRings = district ? geoItemRings(district) : [];
    var dashboardStreetRingCache = {};
    var dashboardStreetStrokeRingCache = {};

    function dashboardNormalizeRing(ring) {
      var out = [];
      (ring || []).forEach(function (pt) {
        if (!Array.isArray(pt) || pt.length < 2) return;
        var x = clamp(Number(pt[0] || 0), 0, 100);
        var y = clamp(Number(pt[1] || 0), 0, 100);
        if (!isFinite(x) || !isFinite(y)) return;
        if (!out.length) {
          out.push([Number(x.toFixed(3)), Number(y.toFixed(3))]);
          return;
        }
        var prev = out[out.length - 1];
        if (Math.abs(prev[0] - x) < 0.001 && Math.abs(prev[1] - y) < 0.001) return;
        out.push([Number(x.toFixed(3)), Number(y.toFixed(3))]);
      });
      if (out.length >= 3) {
        var first = out[0];
        var last = out[out.length - 1];
        if (Math.abs(first[0] - last[0]) < 0.001 && Math.abs(first[1] - last[1]) < 0.001) out.pop();
      }
      return out.length >= 3 ? out : (ring || []);
    }

    function dashboardStreetDisplayRings(street) {
      var cacheKey = String((street && street.id) || "") + "|" + String((street && street.name) || "");
      if (dashboardStreetRingCache.hasOwnProperty(cacheKey)) return dashboardStreetRingCache[cacheKey];
      var rings = geoItemRings(street).map(function (ring) {
        return dashboardNormalizeRing(ring);
      }).filter(function (ring) {
        return Array.isArray(ring) && ring.length >= 3;
      });
      dashboardStreetRingCache[cacheKey] = rings;
      return rings;
    }

    function dashboardStreetStrokeRings(street) {
      var cacheKey = String((street && street.id) || "") + "|" + String((street && street.name) || "");
      if (dashboardStreetStrokeRingCache.hasOwnProperty(cacheKey)) return dashboardStreetStrokeRingCache[cacheKey];
      var rings = dashboardStreetDisplayRings(street);
      if (!rings.length) {
        dashboardStreetStrokeRingCache[cacheKey] = [];
        return [];
      }
      var center = street && Array.isArray(street.center) && street.center.length >= 2
        ? [Number(street.center[0]), Number(street.center[1])]
        : null;
      var primaryRing = null;
      if (center && isFinite(center[0]) && isFinite(center[1])) {
        for (var ringIndex = 0; ringIndex < rings.length; ringIndex++) {
          if (geoPointInRing(center[0], center[1], rings[ringIndex])) {
            primaryRing = rings[ringIndex];
            break;
          }
        }
      }
      if (!primaryRing) primaryRing = geoLargestRing(rings) || rings[0];
      dashboardStreetStrokeRingCache[cacheKey] = primaryRing ? [primaryRing] : [];
      return dashboardStreetStrokeRingCache[cacheKey];
    }

    var displayDistrictRings = [];
    streetRows.forEach(function (item) {
      dashboardStreetDisplayRings(item.street).forEach(function (ring) {
        displayDistrictRings.push(ring);
      });
    });
    if (!displayDistrictRings.length) displayDistrictRings = districtRings.slice();
    var districtClipRings = districtRings.length ? districtRings.slice() : displayDistrictRings.slice();
    function dashboardDistrictDisplayPath(ring) {
      var normalized = dashboardNormalizeRing(ring);
      if (!Array.isArray(normalized) || normalized.length < 3) normalized = ring;
      var smooth = geoRingToSmoothPath(normalized, 9);
      return smooth || geoRingToClosedPath(normalized);
    }
    var districtClipPaths = districtClipRings.map(function (ring) {
      return geoRingToClosedPath(ring);
    }).filter(function (path) {
      return !!path;
    });
    var districtDisplayPaths = districtClipRings.map(function (ring) {
      return dashboardDistrictDisplayPath(ring);
    }).filter(function (path) {
      return !!path;
    });
    var districtVisualPaths = districtDisplayPaths.length ? districtDisplayPaths : districtClipPaths;
    var dashboardDistrictEdgePath = "";
    var districtOutlineHtml = districtVisualPaths.map(function (path) {
      return '<path d="' + path + '"></path>';
    }).join("");
    var districtClipHtml = districtOutlineHtml;
    var districtName = (district && district.name) || "青羊区";

    // ── Compute tight bounding box from district + street polygons ──
    var districtRawMinX = 100, districtRawMinY = 100, districtRawMaxX = 0, districtRawMaxY = 0;
    districtClipRings.forEach(function (ring) {
      (ring || []).forEach(function (pt) {
        var px = Number(pt[0] || 0);
        var py = Number(pt[1] || 0);
        if (px < districtRawMinX) districtRawMinX = px;
        if (px > districtRawMaxX) districtRawMaxX = px;
        if (py < districtRawMinY) districtRawMinY = py;
        if (py > districtRawMaxY) districtRawMaxY = py;
      });
    });
    if (districtRawMinX > districtRawMaxX || districtRawMinY > districtRawMaxY) {
      districtRawMinX = 0;
      districtRawMinY = 0;
      districtRawMaxX = 100;
      districtRawMaxY = 100;
    }
    var allRings = districtClipRings.slice();
    streetRows.forEach(function (item) {
      var rings = dashboardStreetDisplayRings(item.street);
      rings.forEach(function (ring) { allRings.push(ring); });
    });
    var vbMinX = 100, vbMinY = 100, vbMaxX = 0, vbMaxY = 0;
    allRings.forEach(function (ring) {
      (ring || []).forEach(function (pt) {
        var px = Number(pt[0] || 0);
        var py = Number(pt[1] || 0);
        if (px < vbMinX) vbMinX = px;
        if (px > vbMaxX) vbMaxX = px;
        if (py < vbMinY) vbMinY = py;
        if (py > vbMaxY) vbMaxY = py;
      });
    });
    // Add padding so neighboring districts stay visible around Qingyang.
    var vbW = Math.max(vbMaxX - vbMinX, 1);
    var vbH = Math.max(vbMaxY - vbMinY, 1);
    var vbPadX = vbW * 0.14;
    var vbPadY = vbH * 0.16;
    vbMinX = Math.max(0, vbMinX - vbPadX);
    vbMinY = Math.max(0, vbMinY - vbPadY);
    vbW = Math.min(100 - vbMinX, vbW + vbPadX * 2);
    vbH = Math.min(100 - vbMinY, vbH + vbPadY * 2);
    // Apply aspect ratio correction for equirectangular → Mercator-like proportions.
    // The 0-100 grid spans lonRange=1.9616° × latRange=1.3861°; at midLat≈30.76°N
    // one lon-degree is only cos(30.76°)≈0.859 of one lat-degree in real distance.
    var GEO_ASPECT = 1.216; // (lonRange * cos(midLat)) / latRange
    var mapViewBox = (vbMinX * GEO_ASPECT).toFixed(2) + " " + vbMinY.toFixed(2) + " " + (vbW * GEO_ASPECT).toFixed(2) + " " + vbH.toFixed(2);
    var mapViewBounds = {
      minX: vbMinX,
      minY: vbMinY,
      maxX: vbMinX + vbW,
      maxY: vbMinY + vbH
    };

    // Helper: map a 0-100 coordinate to % within the zoomed viewBox
    function mapPctX(x) { return ((Number(x) - vbMinX) / vbW * 100); }
    function mapPctY(y) { return ((Number(y) - vbMinY) / vbH * 100); }
    var districtCenterSeed = streetRows.reduce(function (memo, item) {
      memo.x += Number(item.x || 50);
      memo.y += Number(item.y || 50);
      return memo;
    }, { x: 0, y: 0 });
    var districtCenterRawX = streetRows.length ? districtCenterSeed.x / streetRows.length : (vbMinX + vbW / 2);
    var districtCenterRawY = streetRows.length ? districtCenterSeed.y / streetRows.length : (vbMinY + vbH / 2);
    var mapCoreX = mapPctX(districtCenterRawX).toFixed(2);
    var mapCoreY = mapPctY(districtCenterRawY).toFixed(2);

    function scaledRingToPoints(ring, scale, shiftX, shiftY) {
      return (ring || []).map(function (pt) {
        var px = Number(pt[0] || 0);
        var py = Number(pt[1] || 0);
        var sx = districtCenterRawX + (px - districtCenterRawX) * scale + Number(shiftX || 0);
        var sy = districtCenterRawY + (py - districtCenterRawY) * scale + Number(shiftY || 0);
        return sx.toFixed(2) + "," + sy.toFixed(2);
      }).join(" ");
    }

    function curvePath(x1, y1, x2, y2, bendX, bendY) {
      var cx = (Number(x1 || 0) + Number(x2 || 0)) / 2 + Number(bendX || 0);
      var cy = (Number(y1 || 0) + Number(y2 || 0)) / 2 + Number(bendY || 0);
      return "M" + fixed(x1, 2) + " " + fixed(y1, 2) + " Q" + fixed(cx, 2) + " " + fixed(cy, 2) + " " + fixed(x2, 2) + " " + fixed(y2, 2);
    }

    function mapFeatureCenter(item, bounds) {
      var center = item && Array.isArray(item.center) ? item.center : null;
      if (center && center.length >= 2 && isFinite(Number(center[0])) && isFinite(Number(center[1]))) {
        return [Number(center[0]), Number(center[1])];
      }
      if (bounds) return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
      return [districtCenterRawX, districtCenterRawY];
    }

    function mapFeatureDistance(center) {
      var cx = Number((center || [districtCenterRawX])[0] || districtCenterRawX);
      var cy = Number((center || [districtCenterRawX, districtCenterRawY])[1] || districtCenterRawY);
      var dx = cx - districtCenterRawX;
      var dy = cy - districtCenterRawY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    var districtAdcode = Number((district && district.adcode) || 510105);
    var backdropRows = (geo.real_district_backdrop || []).map(function (item) {
      var bounds = geoBoundsFromRings((item && item.polygons) || []);
      if (!bounds) return null;
      if (!keyProjectBoundsIntersects(bounds, mapViewBounds, Math.max(vbW, vbH) * 0.12)) return null;
      var center = mapFeatureCenter(item, bounds);
      return Object.assign({}, item, {
        _bounds: bounds,
        _center: center,
        _distance: mapFeatureDistance(center),
        _isCurrent: (districtAdcode && Number(item.adcode || 0) === districtAdcode) || String(item.name || "") === String(districtName || "")
      });
    }).filter(function (item) {
      return !!item;
    });
    var backdropClipHtml = backdropRows.map(function (item) {
      return (item.polygons || []).map(function (ring) {
        return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
      }).join("");
    }).join("");
    var backdropPaintRows = backdropRows.filter(function (item) {
      return !item._isCurrent;
    }).sort(function (a, b) {
      return Number(b._distance || 0) - Number(a._distance || 0);
    });

    // SVG defs: glow filters + radial gradient for 3D effect
    var svgDefsHtml =
      '<defs>' +
      // Outer glow for district outline
      '<filter id="brainx-glow-outline" x="-40%" y="-40%" width="180%" height="180%">' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="0.15" result="blur1a"/>' +
        '<feFlood flood-color="#50e8ff" flood-opacity="0.50" result="color1a"/>' +
        '<feComposite in="color1a" in2="blur1a" operator="in" result="glow1a"/>' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="0.45" result="blur1b"/>' +
        '<feFlood flood-color="#30d0ff" flood-opacity="0.30" result="color1b"/>' +
        '<feComposite in="color1b" in2="blur1b" operator="in" result="glow1b"/>' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur1c"/>' +
        '<feFlood flood-color="#1ab8ff" flood-opacity="0.25" result="color1c"/>' +
        '<feComposite in="color1c" in2="blur1c" operator="in" result="glow1c"/>' +
        '<feMerge><feMergeNode in="glow1c"/><feMergeNode in="glow1b"/><feMergeNode in="glow1a"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      // Soft inner glow for street shapes
      '<filter id="brainx-glow-shape" x="-10%" y="-10%" width="120%" height="120%">' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="0.08" result="blur2"/>' +
        '<feFlood flood-color="#00c8ff" flood-opacity="0.08" result="color2"/>' +
        '<feComposite in="color2" in2="blur2" operator="in" result="glow2"/>' +
        '<feMerge><feMergeNode in="glow2"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      // Glow filter for street boundary strokes
      '<filter id="brainx-glow-street-stroke" x="-30%" y="-30%" width="160%" height="160%">' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="0.15" result="sblur1"/>' +
        '<feFlood flood-color="#ffffff" flood-opacity="0.5" result="scolor1"/>' +
        '<feComposite in="scolor1" in2="sblur1" operator="in" result="sglow1"/>' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="0.45" result="sblur2"/>' +
        '<feFlood flood-color="#d0f0ff" flood-opacity="0.3" result="scolor2"/>' +
        '<feComposite in="scolor2" in2="sblur2" operator="in" result="sglow2"/>' +
        '<feMerge><feMergeNode in="sglow2"/><feMergeNode in="sglow1"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      // Glow filter for district boundary stroke
      '<filter id="brainx-glow-district-stroke" x="-40%" y="-40%" width="180%" height="180%">' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="0.2" result="dblur1"/>' +
        '<feFlood flood-color="#ffffff" flood-opacity="0.7" result="dcolor1"/>' +
        '<feComposite in="dcolor1" in2="dblur1" operator="in" result="dglow1"/>' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="0.6" result="dblur2"/>' +
        '<feFlood flood-color="#e0f4ff" flood-opacity="0.45" result="dcolor2"/>' +
        '<feComposite in="dcolor2" in2="dblur2" operator="in" result="dglow2"/>' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="dblur3"/>' +
        '<feFlood flood-color="#c0e8ff" flood-opacity="0.25" result="dcolor3"/>' +
        '<feComposite in="dcolor3" in2="dblur3" operator="in" result="dglow3"/>' +
        '<feMerge><feMergeNode in="dglow3"/><feMergeNode in="dglow2"/><feMergeNode in="dglow1"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      // District fill: bright center → deep edge, simulating terrain elevation
      '<radialGradient id="brainx-district-fill" cx="48%" cy="46%" r="58%">' +
        '<stop offset="0%" stop-color="#0c5778" stop-opacity="0.20"/>' +
        '<stop offset="35%" stop-color="#083d58" stop-opacity="0.14"/>' +
        '<stop offset="65%" stop-color="#031f31" stop-opacity="0.08"/>' +
        '<stop offset="100%" stop-color="#020d17" stop-opacity="0.03"/>' +
      '</radialGradient>' +
      // Ambient light behind the map
      '<radialGradient id="brainx-center-glow" cx="50%" cy="48%" r="50%">' +
        '<stop offset="0%" stop-color="#2aa9c3" stop-opacity="0.08"/>' +
        '<stop offset="50%" stop-color="#0a4056" stop-opacity="0.035"/>' +
        '<stop offset="100%" stop-color="#042030" stop-opacity="0"/>' +
      '</radialGradient>' +
      // Street hover highlight gradient
      '<radialGradient id="brainx-street-heat" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#4ef0ff" stop-opacity="0.30"/>' +
        '<stop offset="100%" stop-color="#1a82b0" stop-opacity="0.08"/>' +
      '</radialGradient>' +
      '<linearGradient id="brainx-terrain-shade" x1="20%" y1="10%" x2="70%" y2="90%">' +
        '<stop offset="0%" stop-color="#2eb4cc" stop-opacity="0.08"/>' +
        '<stop offset="30%" stop-color="#126885" stop-opacity="0.06"/>' +
        '<stop offset="70%" stop-color="#09384d" stop-opacity="0.035"/>' +
        '<stop offset="100%" stop-color="#041722" stop-opacity="0.018"/>' +
      '</linearGradient>' +
      '<linearGradient id="brainx-backdrop-fill" x1="18%" y1="14%" x2="78%" y2="88%">' +
        '<stop offset="0%" stop-color="#0a3d54" stop-opacity="0.16"/>' +
        '<stop offset="48%" stop-color="#072a3d" stop-opacity="0.10"/>' +
        '<stop offset="100%" stop-color="#03131e" stop-opacity="0.04"/>' +
      '</linearGradient>' +
      '<pattern id="brainx-terrain-pattern" width="3.8" height="3.8" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">' +
        '<path d="M0 3.8 L3.8 0" stroke="#73d7ea" stroke-opacity="0.12" stroke-width="0.16"/>' +
        '<path d="M-1.9 1.9 L1.9 -1.9 M1.9 5.7 L5.7 1.9" stroke="#73d7ea" stroke-opacity="0.06" stroke-width="0.1"/>' +
      '</pattern>' +
      '<pattern id="brainx-terrain-pattern-dense" width="1.5" height="1.5" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">' +
        '<path d="M0 1.5 L1.5 0" stroke="#b7edf5" stroke-opacity="0.05" stroke-width="0.08"/>' +
      '</pattern>' +
      '<linearGradient id="brainx-link-gradient" x1="8%" y1="14%" x2="92%" y2="86%">' +
        '<stop offset="0%" stop-color="#66ecff" stop-opacity="0.08"/>' +
        '<stop offset="48%" stop-color="#b2fbff" stop-opacity="0.42"/>' +
        '<stop offset="100%" stop-color="#ffbf5a" stop-opacity="0.26"/>' +
      '</linearGradient>' +
      '<radialGradient id="brainx-node-glow" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.96"/>' +
        '<stop offset="46%" stop-color="#77eeff" stop-opacity="0.74"/>' +
        '<stop offset="100%" stop-color="#77eeff" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<filter id="brainx-terrain-relief" x="-20%" y="-20%" width="140%" height="140%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.045 0.08" numOctaves="5" seed="27" stitchTiles="stitch" result="noise"/>' +
        '<feGaussianBlur in="noise" stdDeviation="0.12" result="noiseSoft"/>' +
        '<feDiffuseLighting in="noiseSoft" surfaceScale="5.6" diffuseConstant="1.2" lighting-color="#a0f0ff" result="light">' +
          '<feDistantLight azimuth="228" elevation="48"/>' +
        '</feDiffuseLighting>' +
        '<feColorMatrix in="light" type="matrix" values="0.82 0 0 0 0.02 0 0.94 0 0 0.04 0 0 1 0 0.10 0 0 0 0.88 0"/>' +
      '</filter>' +
      '<filter id="brainx-backdrop-glow" x="-22%" y="-22%" width="144%" height="144%">' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="0.28" result="blur3"/>' +
        '<feFlood flood-color="#30d8ff" flood-opacity="0.18" result="color3"/>' +
        '<feComposite in="color3" in2="blur3" operator="in" result="glow3"/>' +
        '<feMerge><feMergeNode in="glow3"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      '<filter id="brainx-map-line-glow" x="-18%" y="-18%" width="136%" height="136%">' +
        '<feGaussianBlur in="SourceGraphic" stdDeviation="0.22" result="blur4"/>' +
        '<feFlood flood-color="#5ae6ff" flood-opacity="0.34" result="color4"/>' +
        '<feComposite in="color4" in2="blur4" operator="in" result="glow4"/>' +
        '<feMerge><feMergeNode in="glow4"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      '<filter id="brainx-map-label-glow" x="-30%" y="-30%" width="160%" height="160%">' +
        '<feGaussianBlur in="SourceAlpha" stdDeviation="0.34" result="shadow"/>' +
        '<feColorMatrix in="shadow" type="matrix" values="0 0 0 0 0.09 0 0 0 0 0.64 0 0 0 0 0.86 0 0 0 0.9 0" result="shadowColor"/>' +
        '<feMerge><feMergeNode in="shadowColor"/><feMergeNode in="SourceGraphic"/></feMerge>' +
      '</filter>' +
      '<clipPath id="brainx-backdrop-clip">' + (backdropClipHtml || districtClipHtml) + '</clipPath>' +
      '<clipPath id="brainx-district-clip">' + districtClipHtml + '</clipPath>' +
      '</defs>';

    var mapShapeBaseHtml = streetRows.map(function (item) {
      var rings = dashboardStreetDisplayRings(item.street);
      var strength = Math.max(0.18, Number(item.keyCount || 0) / maxStreetKey);
      var polygons = rings.map(function (ring) {
        return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
      }).join("");
      return '<g class="brainx-map-shape-base" style="--brainx-shape-strength:' + strength.toFixed(3) + ';">' + polygons + "</g>";
    }).join("");
    var districtStackHtml = "";
    var mapShapeReliefHtml = "";
    var mapTerrainHtml = '<g class="brainx-map-terrain" clip-path="url(#brainx-district-clip)">' +
      '<rect x="' + vbMinX.toFixed(2) + '" y="' + vbMinY.toFixed(2) + '" width="' + vbW.toFixed(2) + '" height="' + vbH.toFixed(2) + '" fill="url(#brainx-terrain-shade)"/>' +
      "</g>";
    var backdropStackHtml = "";
    var backdropRegionHtml = backdropPaintRows.map(function (item, idx) {
      var level = idx < 2 ? "near" : idx < 5 ? "mid" : "far";
      var polygons = (item.polygons || []).map(function (ring) {
        return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
      }).join("");
      return '<g class="brainx-map-backdrop-region ' + level + '" filter="url(#brainx-backdrop-glow)">' + polygons + "</g>";
    }).join("");
    var terrainRasterHref = "./assets/qingyang_reference_bg_v6.png?v=20260414a";
    var terrainClippedHref = "./assets/qingyang_reference_focus_v13.png?v=20260414a";
    // The clipped terrain image covers normalized-space [45.57, 50.79] → [59.37, 60.33]
    var terrainClipPadX = 0;
    var terrainClipPadY = 0;
    var terrainClipX = Math.max(0, districtRawMinX - terrainClipPadX);
    var terrainClipY = Math.max(0, districtRawMinY - terrainClipPadY);
    var terrainClipW = Math.min(100 - terrainClipX, (districtRawMaxX - districtRawMinX) + terrainClipPadX * 2);
    var terrainClipH = Math.min(100 - terrainClipY, (districtRawMaxY - districtRawMinY) + terrainClipPadY * 2);
    var mapTerrainRasterHtml = '<g class="brainx-map-terrain-raster" clip-path="url(#brainx-backdrop-clip)">' +
      '<image href="' + terrainRasterHref + '" x="0" y="0" width="100" height="100" preserveAspectRatio="none"></image>' +
      "</g>";
    var mapTerrainClippedHtml = '<g class="brainx-map-terrain-clipped" clip-path="url(#brainx-district-clip)">' +
      '<image href="' + terrainClippedHref + '" x="' + terrainClipX.toFixed(3) + '" y="' + terrainClipY.toFixed(3) + '" width="' + terrainClipW.toFixed(3) + '" height="' + terrainClipH.toFixed(3) + '" preserveAspectRatio="none"></image>' +
      "</g>";
    var backdropTerrainHtml = '<g class="brainx-map-backdrop-terrain" clip-path="url(#brainx-backdrop-clip)">' +
      '<rect x="' + vbMinX.toFixed(2) + '" y="' + vbMinY.toFixed(2) + '" width="' + vbW.toFixed(2) + '" height="' + vbH.toFixed(2) + '" fill="url(#brainx-backdrop-fill)"/>' +
      "</g>";
    var districtContourHtml = "";
    var focusStreetRows = rankedStreetRows.slice(0, 6);
    var mapNetworkHtml = '<g class="brainx-map-network" clip-path="url(#brainx-district-clip)">' +
      focusStreetRows.map(function (item, idx) {
        var bendX = idx % 2 === 0 ? 4.4 : -4.4;
        var bendY = -3.8 - idx * 0.6;
        return '<path class="brainx-map-network-core" stroke="url(#brainx-link-gradient)" d="' + curvePath(districtCenterRawX, districtCenterRawY, item.x, item.y, bendX, bendY) + '"></path>';
      }).join("") +
      focusStreetRows.slice(1).map(function (item, idx) {
        var prev = focusStreetRows[idx];
        return '<path class="brainx-map-network-chain" stroke="url(#brainx-link-gradient)" d="' + curvePath(prev.x, prev.y, item.x, item.y, 0, -2.2 - idx * 0.4) + '"></path>';
      }).join("") +
      focusStreetRows.map(function (item, idx) {
        var radius = idx === 0 ? 1.18 : idx < 3 ? 0.96 : 0.78;
        return '<circle cx="' + fixed(item.x, 2) + '" cy="' + fixed(item.y, 2) + '" r="' + radius.toFixed(2) + '" fill="url(#brainx-node-glow)"></circle>';
      }).join("") +
      "</g>";
    var rawBasemapDetail = geoBasemapDetailRaw || window.DEMO_GEO_BASEMAP_DETAIL || null;
    var basemapPad = Math.max(0.45, Math.min(vbW, vbH) * 0.18);
    var waterFeatures = rawBasemapDetail ? (rawBasemapDetail.water || []).filter(function (feature) {
      return Array.isArray(feature && feature.p) && feature.p.length >= 2 && keyProjectBoundsIntersects(keyProjectPathBounds(feature.p), mapViewBounds, basemapPad);
    }) : [];
    var roadFeatures = rawBasemapDetail ? (rawBasemapDetail.roads || []).filter(function (feature) {
      return Array.isArray(feature && feature.p) && feature.p.length >= 2 && keyProjectBoundsIntersects(keyProjectPathBounds(feature.p), mapViewBounds, basemapPad);
    }).sort(function (a, b) {
      var ao = keyProjectRoadPaintOrder(a);
      var bo = keyProjectRoadPaintOrder(b);
      if (ao !== bo) return ao - bo;
      return Number(a.l || 0) - Number(b.l || 0);
    }) : [];
    var mapWaterHtml = '<g class="brainx-map-detail-water" clip-path="url(#brainx-backdrop-clip)" filter="url(#brainx-map-line-glow)">' +
      waterFeatures.slice(0, 120).map(function (feature) {
        return '<polyline class="brainx-map-water type-' + esc(String(feature.t || 0)) + '" points="' + keyProjectPolylinePoints(feature.p) + '"></polyline>';
      }).join("") +
      "</g>";
    var mapRoadHtml = '<g class="brainx-map-detail-roads" clip-path="url(#brainx-backdrop-clip)" filter="url(#brainx-map-line-glow)">' +
      roadFeatures.slice(0, 420).map(function (feature) {
        return '<polyline class="brainx-map-road ' + keyProjectRoadClass(feature) + '" points="' + keyProjectPolylinePoints(feature.p) + '"></polyline>';
      }).join("") +
      "</g>";
    var roadLabelSlots = [];
    var mapRoadLabelHtml = [];
    roadFeatures.slice().sort(function (a, b) {
      var ao = keyProjectRoadPaintOrder(a);
      var bo = keyProjectRoadPaintOrder(b);
      if (ao !== bo) return bo - ao;
      return Number(b.l || 0) - Number(a.l || 0);
    }).forEach(function (feature) {
      var name = String(feature && feature.n || "").trim();
      if (!name || keyProjectRoadPaintOrder(feature) < 2) return;
      var midpoint = keyProjectPolylineMidpoint(feature.p);
      if (!midpoint) return;
      if (midpoint[0] < vbMinX + vbW * 0.1 || midpoint[0] > vbMinX + vbW * 0.9 || midpoint[1] < vbMinY + vbH * 0.14 || midpoint[1] > vbMinY + vbH * 0.9) return;
      for (var rl = 0; rl < roadLabelSlots.length; rl++) {
        var slot = roadLabelSlots[rl];
        if (Math.abs(slot.x - midpoint[0]) < 2.8 && Math.abs(slot.y - midpoint[1]) < 1.2) return;
      }
      roadLabelSlots.push({ x: midpoint[0], y: midpoint[1] });
      mapRoadLabelHtml.push(
        '<g class="brainx-map-road-label road-' + keyProjectRoadClass(feature) + '" transform="translate(' + midpoint[0].toFixed(2) + ' ' + midpoint[1].toFixed(2) + ')" filter="url(#brainx-map-label-glow)">' +
        '<rect x="-1.32" y="-0.28" width="2.64" height="0.56" rx="0.28" ry="0.28"></rect>' +
        '<text x="0" y="0">' + esc(geoShortName(name, 8)) + '</text>' +
        '</g>'
      );
    });
    var backdropLabelSlots = [];
    var backdropLabelHtml = [];
    backdropRows.filter(function (item) {
      return !item._isCurrent;
    }).sort(function (a, b) {
      return Number(a._distance || 0) - Number(b._distance || 0);
    }).forEach(function (item, idx) {
      var center = item._center || [districtCenterRawX, districtCenterRawY];
      var cx = Number(center[0] || districtCenterRawX);
      var cy = Number(center[1] || districtCenterRawY);
      if (cx < vbMinX + vbW * 0.06 || cx > vbMinX + vbW * 0.94 || cy < vbMinY + vbH * 0.1 || cy > vbMinY + vbH * 0.9) return;
      for (var bi = 0; bi < backdropLabelSlots.length; bi++) {
        var labelSlot = backdropLabelSlots[bi];
        if (Math.abs(labelSlot.x - cx) < 3.6 && Math.abs(labelSlot.y - cy) < 1.8) return;
      }
      backdropLabelSlots.push({ x: cx, y: cy });
      backdropLabelHtml.push(
        '<g class="brainx-map-backdrop-label l' + (idx < 2 ? "near" : "far") + '" transform="translate(' + fixed(cx, 2) + ' ' + fixed(cy, 2) + ')" filter="url(#brainx-map-label-glow)">' +
        '<text x="0" y="0">' + esc(geoShortName(item.name || "", 6)) + '</text>' +
        '</g>'
      );
    });
    var mapShapeHtml = streetRows.map(function (item) {
      var rings = dashboardStreetDisplayRings(item.street);
      var strength = Math.max(0.18, Number(item.keyCount || 0) / maxStreetKey);
      var polygons = rings.map(function (ring) {
        return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
      }).join("");
      return '<a class="brainx-map-shape-link" data-name="' + esc(item.name) + '" href="' + buildHash("/gov/geo-street", { scope: "street", sid: item.id, pid: "" }) + '">' +
        '<g class="brainx-map-shape" style="--brainx-shape-strength:' + strength.toFixed(3) + ';">' + polygons + "</g></a>";
    }).join("");
    // Hit-test layer: transparent polygons on top of everything for reliable pointer events
    var mapHitTestHtml = '<g class="brainx-map-hittest">' + streetRows.map(function (item) {
      var rings = dashboardStreetDisplayRings(item.street);
      var polygons = rings.map(function (ring) {
        return '<polygon points="' + geoRingToPoints(ring) + '"></polygon>';
      }).join("");
      return '<g class="brainx-hit" data-name="' + esc(item.name) + '" data-sid="' + item.id + '">' + polygons + '</g>';
    }).join("") + '</g>';
    // Build one snapped boundary network from the actual street polygon edges.
    function sampledBoundarySegmentsFromRings(rings, snapStep, sampleStep) {
      var segments = {};
      var snap = Number(snapStep || 0.06);
      var step = Number(sampleStep || 0.05);
      function pointKey(x, y) {
        var px = Math.round(clamp(Number(x || 0), 0, 100) / snap) * snap;
        var py = Math.round(clamp(Number(y || 0), 0, 100) / snap) * snap;
        return px.toFixed(3) + "," + py.toFixed(3);
      }
      function segmentKey(aKey, bKey) {
        return aKey < bKey ? (aKey + "-" + bKey) : (bKey + "-" + aKey);
      }
      (rings || []).forEach(function (ring) {
        if (!Array.isArray(ring) || ring.length < 3) return;
        for (var i = 0; i < ring.length; i++) {
          var a = ring[i];
          var b = ring[(i + 1) % ring.length];
          if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) continue;
          var ax = clamp(Number(a[0] || 0), 0, 100);
          var ay = clamp(Number(a[1] || 0), 0, 100);
          var bx = clamp(Number(b[0] || 0), 0, 100);
          var by = clamp(Number(b[1] || 0), 0, 100);
          var length = Math.sqrt(Math.pow(bx - ax, 2) + Math.pow(by - ay, 2));
          var parts = Math.max(1, Math.ceil(length / step));
          for (var part = 0; part < parts; part++) {
            var t0 = part / parts;
            var t1 = (part + 1) / parts;
            var p0 = pointKey(ax + (bx - ax) * t0, ay + (by - ay) * t0);
            var p1 = pointKey(ax + (bx - ax) * t1, ay + (by - ay) * t1);
            if (p0 === p1) continue;
            var segKey = segmentKey(p0, p1);
            if (!segments[segKey]) {
              segments[segKey] = { a: p0, b: p1, count: 0 };
            }
            segments[segKey].count += 1;
          }
        }
      });
      return segments;
    }

    function filterBoundarySegments(segments, predicate) {
      var out = {};
      Object.keys(segments || {}).forEach(function (segKey) {
        var seg = segments[segKey];
        if (!seg || !seg.a || !seg.b) return;
        if (!predicate || predicate(seg, segKey)) out[segKey] = seg;
      });
      return out;
    }

    function connectOpenBoundarySegmentsToDistrict(segments, districtRings, maxDistance, snapStep) {
      var out = {};
      var adjMap = {};
      var threshold = Math.max(0.01, Number(maxDistance || 0.35));
      var snap = Math.max(0.001, Number(snapStep || 0.005));

      function addAdj(fromKey, toKey) {
        if (!adjMap[fromKey]) adjMap[fromKey] = [];
        if (adjMap[fromKey].indexOf(toKey) >= 0) return;
        adjMap[fromKey].push(toKey);
      }

      function pointKey(x, y) {
        var px = Math.round(clamp(Number(x || 0), 0, 100) / snap) * snap;
        var py = Math.round(clamp(Number(y || 0), 0, 100) / snap) * snap;
        return px.toFixed(3) + "," + py.toFixed(3);
      }

      function segmentKey(aKey, bKey) {
        return aKey < bKey ? (aKey + "-" + bKey) : (bKey + "-" + aKey);
      }

      function connectorStaysInside(ax, ay, bx, by) {
        for (var t = 0.2; t < 1; t += 0.2) {
          var px = ax + (bx - ax) * t;
          var py = ay + (by - ay) * t;
          if (keyProjectPointInRings([px, py], districtRings)) continue;
          if (keyProjectMinDistanceToRings([px, py], districtRings) <= 0.012) continue;
          return false;
        }
        return true;
      }

      Object.keys(segments || {}).forEach(function (segKey) {
        var seg = segments[segKey];
        if (!seg || !seg.a || !seg.b) return;
        out[segKey] = {
          a: seg.a,
          b: seg.b,
          count: Number(seg.count || 0)
        };
        addAdj(seg.a, seg.b);
        addAdj(seg.b, seg.a);
      });

      if (!(districtRings && districtRings.length)) return out;

      Object.keys(adjMap).forEach(function (nodeKey) {
        var neighbors = adjMap[nodeKey] || [];
        if (neighbors.length !== 1) return;
        var xy = nodeKey.split(",");
        var x = Number(xy[0]);
        var y = Number(xy[1]);
        if (!isFinite(x) || !isFinite(y)) return;
        var nearest = keyProjectClosestBoundaryPoint([x, y], districtRings);
        if (!nearest || !isFinite(nearest.x) || !isFinite(nearest.y) || !isFinite(nearest.dist)) return;
        if (!(nearest.dist > 0.0005) || nearest.dist > threshold) return;
        if (!connectorStaysInside(x, y, nearest.x, nearest.y)) return;
        var targetKey = pointKey(nearest.x, nearest.y);
        if (!targetKey || targetKey === nodeKey) return;
        var segKey = segmentKey(nodeKey, targetKey);
        if (out[segKey]) return;
        out[segKey] = {
          a: nodeKey,
          b: targetKey,
          count: 2
        };
      });

      return out;
    }

    function pruneBoundaryStubSegments(segments, minChainLength, maxChainNodes) {
      var threshold = Math.max(0.001, Number(minChainLength || 0.02));
      var nodeLimit = Math.max(2, Number(maxChainNodes || 3));
      var adjMap = {};
      var visited = {};
      var keep = {};

      function addAdj(fromKey, toKey) {
        if (!adjMap[fromKey]) adjMap[fromKey] = [];
        if (adjMap[fromKey].indexOf(toKey) >= 0) return;
        adjMap[fromKey].push(toKey);
      }

      function segmentKey(aKey, bKey) {
        return aKey < bKey ? (aKey + "-" + bKey) : (bKey + "-" + aKey);
      }

      function chainLength(chain) {
        var total = 0;
        for (var idx = 0; idx < chain.length - 1; idx++) {
          var a = chain[idx].split(",");
          var b = chain[idx + 1].split(",");
          var ax = Number(a[0]);
          var ay = Number(a[1]);
          var bx = Number(b[0]);
          var by = Number(b[1]);
          if (!isFinite(ax) || !isFinite(ay) || !isFinite(bx) || !isFinite(by)) continue;
          total += Math.sqrt(Math.pow(bx - ax, 2) + Math.pow(by - ay, 2));
        }
        return total;
      }

      function markChain(chain) {
        var length = chainLength(chain);
        var keepChain = !(chain.length <= nodeLimit && length < threshold);
        for (var idx = 0; idx < chain.length - 1; idx++) {
          var segKey = segmentKey(chain[idx], chain[idx + 1]);
          visited[segKey] = true;
          if (keepChain && segments[segKey]) keep[segKey] = segments[segKey];
        }
      }

      function walkChain(startKey, nextKey) {
        var segKey = segmentKey(startKey, nextKey);
        if (visited[segKey]) return null;
        var chain = [startKey, nextKey];
        var prev = startKey;
        var cur = nextKey;
        while (true) {
          var neighbors = adjMap[cur] || [];
          if (neighbors.length !== 2) break;
          var nxt = neighbors[0] === prev ? neighbors[1] : neighbors[0];
          var nextSegKey = segmentKey(cur, nxt);
          if (visited[nextSegKey]) break;
          chain.push(nxt);
          prev = cur;
          cur = nxt;
        }
        return chain;
      }

      Object.keys(segments || {}).forEach(function (segKey) {
        var seg = segments[segKey];
        if (!seg || !seg.a || !seg.b) return;
        addAdj(seg.a, seg.b);
        addAdj(seg.b, seg.a);
      });

      Object.keys(adjMap).forEach(function (nodeKey) {
        var neighbors = adjMap[nodeKey] || [];
        if (neighbors.length === 2) return;
        neighbors.forEach(function (nbr) {
          var chain = walkChain(nodeKey, nbr);
          if (chain && chain.length >= 2) markChain(chain);
        });
      });

      Object.keys(adjMap).forEach(function (nodeKey) {
        var neighbors = adjMap[nodeKey] || [];
        neighbors.forEach(function (nbr) {
          var segKey = segmentKey(nodeKey, nbr);
          if (visited[segKey]) return;
          var chain = walkChain(nodeKey, nbr);
          if (chain && chain.length >= 2) markChain(chain);
        });
      });

      return keep;
    }

    function smoothBoundaryPathFromSegments(segments) {
      var adjMap = {};
      function addAdj(fromKey, toKey) {
        if (!adjMap[fromKey]) adjMap[fromKey] = [];
        if (adjMap[fromKey].indexOf(toKey) >= 0) return;
        adjMap[fromKey].push(toKey);
      }
      Object.keys(segments || {}).forEach(function (segKey) {
        var seg = segments[segKey];
        if (!seg || !seg.a || !seg.b) return;
        addAdj(seg.a, seg.b);
        addAdj(seg.b, seg.a);
      });
      var visited = {};
      function walkChain(startKey, nextKey) {
        var segKey = startKey < nextKey ? (startKey + "-" + nextKey) : (nextKey + "-" + startKey);
        if (visited[segKey]) return null;
        visited[segKey] = true;
        var chain = [startKey, nextKey];
        var prev = startKey;
        var cur = nextKey;
        while (true) {
          var neighbors = adjMap[cur] || [];
          if (neighbors.length !== 2) break;
          var nxt = neighbors[0] === prev ? neighbors[1] : neighbors[0];
          var nextSegKey = cur < nxt ? (cur + "-" + nxt) : (nxt + "-" + cur);
          if (visited[nextSegKey]) break;
          visited[nextSegKey] = true;
          chain.push(nxt);
          prev = cur;
          cur = nxt;
        }
        return chain;
      }
      var chains = [];
      Object.keys(adjMap).forEach(function (nodeKey) {
        var neighbors = adjMap[nodeKey] || [];
        if (neighbors.length === 2) return;
        neighbors.forEach(function (nbr) {
          var chain = walkChain(nodeKey, nbr);
          if (chain && chain.length >= 2) chains.push(chain);
        });
      });
      Object.keys(adjMap).forEach(function (nodeKey) {
        var neighbors = adjMap[nodeKey] || [];
        neighbors.forEach(function (nbr) {
          var segKey = nodeKey < nbr ? (nodeKey + "-" + nbr) : (nbr + "-" + nodeKey);
          if (visited[segKey]) return;
          var chain = walkChain(nodeKey, nbr);
          if (chain && chain.length >= 2) chains.push(chain);
        });
      });
      return chains.map(function (chain) {
        var pts = chain.map(function (nodeKey) {
          var p = nodeKey.split(",");
          return [Number(p[0]), Number(p[1])];
        });
        return "M" + pts.map(function (pt) {
          return pt[0].toFixed(3) + "," + pt[1].toFixed(3);
        }).join(" L");
      }).join("");
    }

    var allStreetRings = [];
    var seenStreetRingKeys = {};
    streetRows.forEach(function (item) {
      dashboardStreetStrokeRings(item.street).forEach(function (ring) {
        var ringKey = geoRingToPoints(ring);
        if (!ringKey || seenStreetRingKeys[ringKey]) return;
        seenStreetRingKeys[ringKey] = true;
        allStreetRings.push(ring);
      });
    });
    var allStreetBoundarySegments = sampledBoundarySegmentsFromRings(allStreetRings, 0.005, 0.005);
    var streetBoundarySegments = filterBoundarySegments(allStreetBoundarySegments, function (seg) {
      return Number(seg.count || 0) > 1;
    });
    streetBoundarySegments = pruneBoundaryStubSegments(streetBoundarySegments, 0.03, 3);
    streetBoundarySegments = connectOpenBoundarySegmentsToDistrict(streetBoundarySegments, districtClipRings, 0.36, 0.005);
    var allStreetEdgePath = smoothBoundaryPathFromSegments(allStreetBoundarySegments);
    var streetEdgePath = smoothBoundaryPathFromSegments(streetBoundarySegments);
    var districtEdgePath = districtClipPaths.length ? "" : smoothBoundaryPathFromSegments(filterBoundarySegments(allStreetBoundarySegments, function (seg) {
      return Number(seg.count || 0) <= 1;
    }));
    var streetOuterEdgeHtml = districtClipPaths.length
      ? districtVisualPaths.map(function (path) {
        return '<path class="brainx-map-street-stroke brainx-map-street-stroke-outer" d="' + path + '"></path>';
      }).join("")
      : districtEdgePath
      ? '<path class="brainx-map-street-stroke brainx-map-street-stroke-outer" d="' + districtEdgePath + '"></path>'
      : "";
    var districtBoundaryCoverHtml = "";
    var mapStreetStrokesHtml = '<g class="brainx-map-street-strokes" clip-path="url(#brainx-district-clip)">' +
      (streetEdgePath ? '<path class="brainx-map-street-stroke" d="' + streetEdgePath + '"></path>' : "") +
      "</g>";
    var districtStrokeHtml = districtClipPaths.length
      ? districtVisualPaths.map(function (path) {
        return '<path class="brainx-map-district-stroke" d="' + path + '"></path>';
      }).join("")
      : districtEdgePath
      ? '<path class="brainx-map-district-stroke" d="' + districtEdgePath + '"/>'
      : "";

    var mapMarkerHtml = streetRows.map(function (item) {
      var level = topStreetIds[item.id] || "minor";
      return '<a class="brainx-map-marker ' + level + '" data-sid="' + item.id + '" href="' + buildHash("/gov/geo-street", { scope: "street", sid: item.id, pid: "" }) + '" style="left:0;top:0;">' +
        '<span class="brainx-map-pin"><span class="brainx-map-base"></span><span class="brainx-map-beam"></span><span class="brainx-map-ring"></span><span class="brainx-map-dot"></span></span>' +
        '<span class="brainx-map-label">' + esc(item.name) + "</span>" +
        '<span class="brainx-map-tip"><strong>' + esc(item.name) + '</strong><span>人口 <b>' + esc(fixed(item.population, 1)) + ' 万人</b></span><span>GDP <b>' + esc(fixed(item.gdp, 1)) + ' 亿元</b></span><span>税收 <b>' + esc(fixed(item.tax, 1)) + ' 亿元</b></span><span>重点企业 <b>' + esc(String(item.keyCount)) + ' 家</b></span><span>项目数量 <b>' + esc(String(item.projectCount)) + ' 个</b></span></span></a>';
    }).join("");
    // Keep the dashboard center map focused on cartography only.
    var mapHeroHtml = "";
    var mapStatusHtml = "";
    var mapFloatRankHtml = "";
    var mapBeaconHtml = rankedStreetRows.slice(0, 4).map(function (item, idx) {
      return '<a class="brainx-map-beacon b' + String(idx + 1) + '" data-sid="' + item.id + '" href="' + buildHash("/gov/geo-street", { scope: "street", sid: item.id, pid: "" }) + '" style="left:0;top:0;"><span class="brainx-map-beacon-base"></span><span class="brainx-map-beacon-line"></span><span class="brainx-map-beacon-core"></span><span class="brainx-map-beacon-label">' + esc(item.name) + "</span></a>";
    }).join("");
    // Invisible SVG anchor points at each street centroid for pixel-perfect alignment
    var mapAnchorHtml = streetRows.map(function (item) {
      return '<circle class="brainx-anchor" data-sid="' + item.id + '" cx="' + item.x.toFixed(4) + '" cy="' + item.y.toFixed(4) + '" r="0.01" fill="none" pointer-events="none"/>';
    }).join("");

    return (
      '<div class="brainx-canvas brainx-canvas--map-only fade-in">' +
      '<div class="brainx-board brainx-board--map-only">' +
      '<section class="brainx-stage"><div class="brainx-map-shell brainx-map-shell--focus"><div class="brainx-map-stage"><div class="brainx-map-atmosphere"><span class="brainx-map-orbit orbit-a"></span><span class="brainx-map-orbit orbit-b"></span><span class="brainx-map-orbit orbit-c"></span><span class="brainx-map-haze haze-a"></span><span class="brainx-map-haze haze-b"></span></div><div class="brainx-map-watermark">QINGYANG</div>' + mapHeroHtml + '<div class="brainx-map-beacons">' + mapBeaconHtml + '</div><div class="brainx-map-core" style="left:' + mapCoreX + '%;top:' + mapCoreY + '%;"><span class="brainx-map-core-ring"></span><span class="brainx-map-core-ring ring-b"></span><span class="brainx-map-core-dot"></span><span class="brainx-map-core-label">' + esc(districtName) + '产业核心</span></div>' + mapFloatRankHtml + '<svg class="brainx-map-svg" data-geo-aspect="' + GEO_ASPECT.toFixed(4) + '" viewBox="' + mapViewBox + '" preserveAspectRatio="xMidYMid meet"><g transform="scale(' + GEO_ASPECT.toFixed(4) + ',1)">' + svgDefsHtml + '<rect x="' + vbMinX.toFixed(2) + '" y="' + vbMinY.toFixed(2) + '" width="' + vbW.toFixed(2) + '" height="' + vbH.toFixed(2) + '" fill="url(#brainx-center-glow)"/>' + mapTerrainRasterHtml + backdropStackHtml + backdropTerrainHtml + '<g class="brainx-map-backdrop-regions">' + backdropRegionHtml + '</g>' + districtStackHtml + mapTerrainClippedHtml + mapTerrainHtml + mapWaterHtml + mapRoadHtml + districtContourHtml + mapNetworkHtml + mapShapeReliefHtml + '<g class="brainx-map-outline" filter="url(#brainx-glow-outline)">' + districtOutlineHtml + '</g><g class="brainx-map-shapes" clip-path="url(#brainx-district-clip)">' + mapShapeHtml + '</g>' + mapStreetStrokesHtml + districtBoundaryCoverHtml + districtStrokeHtml + '<g class="brainx-map-labels">' + backdropLabelHtml.join("") + mapRoadLabelHtml.slice(0, 4).join("") + '</g>' + mapHitTestHtml + mapAnchorHtml + '</g></svg><div class="brainx-map-markers">' + mapMarkerHtml + '</div><div class="brainx-map-statusbar">' + mapStatusHtml + '</div></div></div></section>' +
      "</div></div>"
    );
  }

  function pageGovEnterprises(rt) {
    var q = ((rt.q && rt.q.q) || "").trim();
    var ents = govDemoEnterprises();
    if (q) {
      ents = ents.filter(function (e) {
        return (e.name || "").indexOf(q) >= 0 || (e.industry || "").indexOf(q) >= 0 || (e.uscc || "").indexOf(q) >= 0;
      });
    }
    ents = ents.slice().sort(function (a, b) {
      return ((b.risk && b.risk.score) || 0) - ((a.risk && a.risk.score) || 0);
    });

    var rows = ents
      .map(function (e) {
        var tags = (e.tags || [])
          .slice(0, 3)
          .map(function (t) {
            return '<span class="tag teal">' + esc(t) + "</span>";
          })
          .join("");
        return (
          "<tr>" +
          '<td><a href="#/gov/enterprise/' +
          e.id +
          '"><b>' +
          esc(e.name) +
          "</b><div class=\"mono\" style=\"margin-top:4px;\">" +
          esc(e.uscc) +
          "</div></a></td>" +
          "<td>" +
          esc(e.industry) +
          "</td>" +
          "<td>" +
          (e.level === "规上" ? '<span class="tag green">规上</span>' : '<span class="tag">规下</span>') +
          "</td>" +
          "<td>" +
          tags +
          "</td>" +
          "<td>" +
          riskTag((e.risk && e.risk.level) || "低") +
          '<span class="tag">评分 ' +
          esc((e.risk && e.risk.score) || "-") +
          "</span></td>" +
          "<td>" +
          esc(e.grid || "-") +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    return (
      '<div class="grid">' +
      card(
        "企业库",
        "一企一档 · 标签体系 · 重点企业筛选",
        '<a class="btn" href="#/gov/home">返回平台首页</a><span class="pill">查询：' + esc(q || "（空）") + "</span>",
        '<table class="table"><thead><tr><th>企业</th><th>行业</th><th>规模</th><th>标签</th><th>风险</th><th>网格</th></tr></thead><tbody>' +
          (rows || '<tr><td colspan=\"6\" class=\"muted\">无派单结果</td></tr>') +
          "</tbody></table>"
      ) +
      "</div>"
    );
  }

  function pageGovEnterpriseDetail(entId) {
    var e = entById(entId);
    if (!e || !govDemoIsInDistrict(e)) return '<div class="card fade-in"><div class="hd"><p class="title">青羊区企业</p></div><div class="bd muted">当前演示已锁定青羊区企业数据，请从列表重新选择。</div></div>';
    var detailRt = route();
    var fromExit = detailRt && detailRt.q && detailRt.q.src === "exit";
    var fromChain = detailRt && detailRt.q && detailRt.q.src === "chain";
    var listHref = fromExit ? "#/gov/enterprise-exit" : "#/gov/enterprises";
    if (fromChain) {
      listHref = buildHash("/gov/chain", {
        district: (detailRt.q && detailRt.q.district) || govDemoDistrictName(),
        industry: (detailRt.q && detailRt.q.industry) || e.track || e.industry || "",
        tab: (detailRt.q && detailRt.q.tab) || "intro",
        term: (detailRt.q && detailRt.q.term) || "",
        z: (detailRt.q && detailRt.q.z) || ""
      });
    }
    var listLabel = fromExit ? "返回迁出预警" : (fromChain ? "返回产业链式图谱" : "返回列表");

    var tags = (e.tags || [])
      .map(function (t) {
        return '<span class="tag teal">' + esc(t) + "</span>";
      })
      .join("");

    var events = (e.events || [])
      .slice()
      .sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
      })
      .map(function (ev) {
        var evTypeMap = { innovation: '\ud83d\udca1 \u521b\u65b0', finance: '\ud83d\udcb0 \u878d\u8d44', operate: '\u2699\ufe0f \u7ecf\u8425', change: '\ud83d\udd04 \u53d8\u66f4', risk: '\u26a0\ufe0f \u98ce\u9669', policy: '\ud83d\udcdc \u653f\u7b56', talent: '\ud83d\udc64 \u4eba\u624d', award: '\ud83c\udfc6 \u8363\u8a89', bid: '\ud83d\udcdd \u62db\u6295\u6807', service: '\ud83d\udd27 \u670d\u52a1' };
        var cls = ev.type === "risk" ? "red" : ev.type === "finance" ? "orange" : "teal";
        var typeLabel = evTypeMap[ev.type] || ev.type;
        return (
          "<tr><td><span class=\"tag " +
          cls +
          "\">" +
          typeLabel +
          "</span></td><td><b>" +
          esc(ev.title) +
          "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" +
          esc(fmtDate(ev.date)) +
          "</div></td></tr>"
        );
      })
      .join("");

    var alert = govDemoAlerts().find(function (a) {
      return a.enterprise_id === e.id;
    });
    var alertHtml = "";
    if (alert) {
      var sigs = (alert.signals || [])
        .map(function (s) {
          return '<div style="margin-bottom:8px;"><span class="tag red">' + esc(s.name) + "</span> " + esc(s.detail) + "</div>";
        })
        .join("");
      alertHtml = card(
        "动态监测与预警",
        alert.type + " · 风险指数 " + alert.score,
        '<a class="btn" href="#/gov/alert/' + alert.id + '">查看详情</a><button class="btn primary" data-action="assign_alert" data-id="' + alert.id + '">派单</button>',
        '<div class="split"><div>' + sigs + '</div><div><p class="muted" style="margin:0;line-height:1.7;">' + esc(alert.suggestion) + "</p></div></div>"
      );
    }

    return (
      '<div class="grid">' +
      card(
        "企业基础档案",
        e.industry + " · " + (e.level || ""),
        '<a class="btn" href="' + listHref + '">' + listLabel + '</a><a class="btn" href="' + buildHash("/gov/enterprise-exit", { xid: e.id, xq: e.name }) + '">迁出预警</a><button class="btn" data-action="export_demo">导出档案</button><button class="btn" data-action="create_visit" data-id="' + e.id + '">创建走访工单</button>',
        '<div>' +
          tags +
          '</div><div class="split" style="margin-top:12px;"><div>' +
          '<div class="mono">统一社会信用代码：' +
          esc(e.uscc) +
          "</div>" +
          '<div class="mono" style="margin-top:6px;">网格：' +
          esc(e.address) +
          "</div>" +
          '<div class="mono" style="margin-top:6px;">网格：' +
          esc(e.grid || "-") +
          "</div>" +
          '<div style="margin-top:12px;">' +
          riskTag((e.risk && e.risk.level) || "低") +
          '<span class="tag">风险指数 ' +
          esc((e.risk && e.risk.score) || "-") +
          "</span>" +
          "</div></div><div>" +
          '<table class="table"><thead><tr><th>类型</th><th>事件</th></tr></thead><tbody>' +
          "<tr><td>本地纳税</td><td><b>" +
          esc(((e.kpis && e.kpis.revenue_y) || "-") + " 亿元") +
          "</b></td></tr>" +
          "<tr><td>本地纳税</td><td><b>" +
          esc(((e.kpis && e.kpis.tax_y) || "-") + " 亿元") +
          "</b></td></tr>" +
          "<tr><td>参保人数</td><td><b>" +
          esc((e.kpis && e.kpis.employees) || "-") +
          "</b></td></tr>" +
          "</tbody></table>" +
          "</div></div>"
      ) +
      (alertHtml || "") +
      card(
        "关键事件",
        "变更/创新/融资/风险等时间线",
        "",
        '<table class="table"><thead><tr><th>类型</th><th>事件</th></tr></thead><tbody>' +
          (events || '<tr><td colspan="2" class="muted">暂无需求</td></tr>') +
          "</tbody></table>"
      ) +
      "</div>"
    );
  }

  // ── chain page: panel builder (shared with tab‐switch handler) ──
  var _chainProfiles = null; // populated by pageGovChain, reused by tab switch
  var _chainNodeRegistry = null;
  var CHAIN_REGISTRY_KEY = "ib_chain_registry_cache";

  function chainEnsureRegistry() {
    if (_chainNodeRegistry && _chainNodeRegistry.nodes) return _chainNodeRegistry;
    try {
      var raw = localStorage.getItem(CHAIN_REGISTRY_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.nodes || !parsed.children) return null;
      parsed.matchCache = {};
      _chainNodeRegistry = parsed;
      return _chainNodeRegistry;
    } catch (e) {
      return null;
    }
  }

  function chainPersistRegistry(registry) {
    try {
      if (!registry || !registry.nodes || !registry.children) return;
      localStorage.setItem(CHAIN_REGISTRY_KEY, JSON.stringify({
        nodes: registry.nodes,
        labels: registry.labels || {},
        children: registry.children || {},
        parents: registry.parents || {},
        context: registry.context || {}
      }));
    } catch (e) {}
  }

  function chainUniqueStrings(items, limit) {
    var out = [];
    (items || []).forEach(function (item) {
      var val = String(item || "").trim();
      if (!val || out.indexOf(val) >= 0) return;
      out.push(val);
    });
    return typeof limit === "number" ? out.slice(0, limit) : out;
  }

  function chainLabelKeywords(label) {
    return chainUniqueStrings(
      String(label || "")
        .replace(/[\uff08\uff09\u3001\u3002\uff0c\u00b7\u2014\u2013\(\),\/\|\-]/g, " ")
        .split(/\s+/)
        .filter(function (w) { return w.length >= 2; })
    );
  }

  function chainMatchReasonSummary(item, limit) {
    return chainUniqueStrings((item && item.reasons) || [], limit == null ? 3 : limit);
  }

  function chainMatchedEnterprises(label) {
    var keywords = chainLabelKeywords(label);
    var allEnts = govDemoEnterprises();
    return allEnts
      .map(function (e) {
        var fields = [
          { label: "企业名称", weight: 4, values: [e.name || ""] },
          { label: "所属行业", weight: 3, values: [e.industry || "", e.track || ""] },
          { label: "主营产品", weight: 4, values: e.products || [] },
          { label: "生态角色", weight: 4, values: e.ecosystem_role || [] },
          { label: "链图映射", weight: 5, values: e.chain_nodes || [] },
          { label: "企业标签", weight: 2, values: e.tags || [] }
        ];
        var sc = 0;
        var reasons = [];
        var hitKeywords = [];
        var hitFields = [];
        keywords.forEach(function (kw) {
          fields.forEach(function (field) {
            var values = field.values || [];
            for (var i = 0; i < values.length; i++) {
              if (String(values[i] || "").indexOf(kw) < 0) continue;
              sc += field.weight;
              hitKeywords.push(kw);
              hitFields.push(field.label);
              reasons.push(field.label + "命中“" + kw + "”");
              break;
            }
          });
        });
        return {
          e: e,
          sc: sc,
          keywords: chainUniqueStrings(hitKeywords, 6),
          fields: chainUniqueStrings(hitFields, 4),
          reasons: chainUniqueStrings(reasons, 6)
        };
      })
      .filter(function (x) { return x.sc > 0; })
      .sort(function (a, b) { return b.sc - a.sc; });
  }

  function chainMergeMatchedEnterprises(items) {
    var bestById = {};
    (items || []).forEach(function (item) {
      if (!item || !item.e || !item.e.id) return;
      var key = item.e.id;
      if (!bestById[key]) {
        bestById[key] = {
          e: item.e,
          sc: Number(item.sc || 0),
          keywords: chainUniqueStrings(item.keywords || [], 8),
          fields: chainUniqueStrings(item.fields || [], 6),
          reasons: chainUniqueStrings(item.reasons || [], 8)
        };
        return;
      }
      bestById[key].sc = Math.max(Number(bestById[key].sc || 0), Number(item.sc || 0));
      bestById[key].keywords = chainUniqueStrings((bestById[key].keywords || []).concat(item.keywords || []), 8);
      bestById[key].fields = chainUniqueStrings((bestById[key].fields || []).concat(item.fields || []), 6);
      bestById[key].reasons = chainUniqueStrings((bestById[key].reasons || []).concat(item.reasons || []), 8);
    });
    return Object.keys(bestById)
      .map(function (id) { return bestById[id]; })
      .sort(function (a, b) {
        if (Number(b.sc || 0) !== Number(a.sc || 0)) return Number(b.sc || 0) - Number(a.sc || 0);
        return String((a.e && a.e.name) || "").localeCompare(String((b.e && b.e.name) || ""));
      });
  }

  function chainFindNodeIdByLabel(label) {
    chainEnsureRegistry();
    if (!_chainNodeRegistry || !_chainNodeRegistry.labels) return "";
    var ids = _chainNodeRegistry.labels[String(label || "")] || [];
    return ids[0] || "";
  }

  function chainNodeMatchedEnterprises(nodeId, visiting) {
    chainEnsureRegistry();
    if (!_chainNodeRegistry || !_chainNodeRegistry.nodes || !_chainNodeRegistry.nodes[nodeId]) return [];
    var cache = _chainNodeRegistry.matchCache || (_chainNodeRegistry.matchCache = {});
    if (cache[nodeId]) return cache[nodeId].slice();
    var seen = visiting || {};
    if (seen[nodeId]) return [];
    seen[nodeId] = true;
    var node = _chainNodeRegistry.nodes[nodeId];
    var merged = chainMatchedEnterprises(node.label);
    ((_chainNodeRegistry.children && _chainNodeRegistry.children[nodeId]) || []).forEach(function (childId) {
      merged = chainMergeMatchedEnterprises(merged.concat(chainNodeMatchedEnterprises(childId, seen)));
    });
    delete seen[nodeId];
    cache[nodeId] = chainMergeMatchedEnterprises(merged);
    return cache[nodeId].slice();
  }

  function chainResolveMatchedEnterprises(nodeId, label) {
    var resolvedId = nodeId || chainFindNodeIdByLabel(label);
    if (resolvedId) {
      var resolvedMatches = chainNodeMatchedEnterprises(resolvedId);
      if (resolvedMatches.length || !label) return resolvedMatches;
    }
    return chainMatchedEnterprises(label);
  }

  function chainTodayStamp() {
    var now = new Date();
    var yyyy = String(now.getFullYear());
    var mm = String(now.getMonth() + 1);
    var dd = String(now.getDate());
    if (mm.length < 2) mm = "0" + mm;
    if (dd.length < 2) dd = "0" + dd;
    return yyyy + "-" + mm + "-" + dd;
  }

  function chainProfileUpdatedAt(profile) {
    if (profile && profile.updated_at) return String(profile.updated_at).slice(0, 10);
    var latest = "";
    (profile && profile.news || []).forEach(function (item) {
      var m = String((item && item.date) || "").match(/\d{4}-\d{2}-\d{2}/);
      if (m && m[0] && (!latest || m[0] > latest)) latest = m[0];
    });
    return latest || chainTodayStamp();
  }

  function chainWeakLevelRank(level) {
    if (level === "critical") return 0;
    if (level === "high") return 1;
    if (level === "medium") return 2;
    return 3;
  }

  function chainWeakLevelLabel(level) {
    if (level === "critical") return "薄弱环节";
    if (level === "high") return "重点补强";
    if (level === "medium") return "关注环节";
    return "常规节点";
  }

  function chainWeakNodeAdvice(node, level, ctx) {
    var district = ctx && ctx.district ? ctx.district : "当前区域";
    if (level === "critical") {
      return "建议将“" + node.label + "”列入" + district + "近期优先补链招商清单，重点引入龙头配套和专业服务主体。";
    }
    if (level === "high") {
      return "建议围绕“" + node.label + "”梳理目标企业池，优先对接能补齐关键配套能力的项目。";
    }
    return "建议持续跟踪“" + node.label + "”企业集聚情况，结合园区承载能力做滚动补强。";
  }

  function chainBuildAssessment(graph, profile, currentIndustry, currentDistrict) {
    var directCache = {};
    var totalCache = {};
    function directCount(node) {
      var key = String((node && node.label) || "");
      if (directCache[key] != null) return directCache[key];
      directCache[key] = chainMatchedEnterprises(key).length;
      return directCache[key];
    }
    function totalCount(node) {
      var key = String((node && node.id) || "");
      if (totalCache[key] != null) return totalCache[key];
      totalCache[key] = chainResolveMatchedEnterprises(key, node && node.label).length;
      return totalCache[key];
    }
    var children = (_chainNodeRegistry && _chainNodeRegistry.children) || {};
    var parents = (_chainNodeRegistry && _chainNodeRegistry.parents) || {};
    var nodeById = (_chainNodeRegistry && _chainNodeRegistry.nodes) || {};
    var weakNodes = [];

    (graph.nodes || []).forEach(function (node) {
      if (!node || node.kind === "root") return;
      var total = totalCount(node);
      var direct = directCount(node);
      var parentId = parents[node.id] || "";
      var siblingIds = children[parentId] || [];
      var siblingNodes = siblingIds
        .map(function (id) { return nodeById[id]; })
        .filter(function (item) { return !!item; });
      var siblingCounts = siblingNodes.map(function (item) { return totalCount(item); });
      var siblingMax = siblingCounts.length ? Math.max.apply(null, siblingCounts) : total;
      var siblingAvg = siblingCounts.length
        ? siblingCounts.reduce(function (sum, val) { return sum + val; }, 0) / siblingCounts.length
        : total;
      var childIds = children[node.id] || [];
      var coveredChildren = childIds.filter(function (childId) {
        var childNode = nodeById[childId];
        return childNode && totalCount(childNode) > 0;
      }).length;
      var coverage = childIds.length ? coveredChildren / childIds.length : 1;
      var level = "";
      var reason = "";

      if (node.kind === "leaf" || node.kind === "leaf-right") {
        if (total === 0) {
          level = "critical";
          reason = "当前未匹配到关联企业，属于明显空白环节。";
        } else if (total === 1) {
          level = "high";
          reason = "当前仅有 1 家企业支撑，配套基础偏薄。";
        } else if (total === 2 && siblingMax >= 5) {
          level = "medium";
          reason = "与同层细分方向相比，企业支撑数量明显偏少。";
        }
      } else if (node.kind === "main") {
        if (childIds.length && coverage <= 0.25) {
          level = "critical";
          reason = "下属细分方向覆盖度较低，多数子节点尚未形成企业支撑。";
        } else if (total <= 1) {
          level = "high";
          reason = "当前重点环节仅有 1 家企业支撑，承接能力偏弱。";
        } else if ((childIds.length && coverage <= 0.5) || (siblingMax >= 8 && total <= Math.max(2, Math.round(siblingAvg * 0.35)))) {
          level = "medium";
          reason = "与同层重点环节相比，现有企业支撑偏弱。";
        }
      } else if (node.kind === "stage") {
        if (childIds.length && coverage <= 0.25) {
          level = "critical";
          reason = "该阶段的细分方向覆盖度偏低，阶段性承接能力不足。";
        } else if (total <= 1) {
          level = "high";
          reason = "该阶段当前仅有 1 家企业支撑，阶段承接偏弱。";
        } else if ((childIds.length && coverage <= 0.5) || (siblingMax >= 10 && total <= Math.max(2, Math.round(siblingAvg * 0.35)))) {
          level = "medium";
          reason = "与其他阶段相比，该阶段的企业承接基础偏弱。";
        }
      }

      if (!level) return;
      weakNodes.push({
        id: node.id,
        label: node.label,
        kind: node.kind,
        tone: node.tone,
        level: level,
        levelLabel: chainWeakLevelLabel(level),
        totalCount: total,
        directCount: direct,
        coverage: coverage,
        reason: reason,
        advice: chainWeakNodeAdvice(node, level, { industry: currentIndustry, district: currentDistrict })
      });
    });

    weakNodes.sort(function (a, b) {
      var levelDiff = chainWeakLevelRank(a.level) - chainWeakLevelRank(b.level);
      if (levelDiff) return levelDiff;
      if (a.totalCount !== b.totalCount) return a.totalCount - b.totalCount;
      return String(a.label || "").localeCompare(String(b.label || ""));
    });

    var highlightedNodes = weakNodes
      .filter(function (item) { return item.level === "critical" || item.level === "high"; })
      .slice(0, 12);
    var weakMap = {};
    weakNodes.forEach(function (item) {
      weakMap[item.id] = item;
    });
    var highlightMap = {};
    highlightedNodes.forEach(function (item) {
      highlightMap[item.id] = item;
    });

    return {
      updatedAt: chainProfileUpdatedAt(profile),
      weakNodes: weakNodes,
      weakMap: weakMap,
      highlightMap: highlightMap,
      highlightedCount: highlightedNodes.length,
      topWeakNodes: weakNodes.slice(0, 6)
    };
  }

  function chainNodeDetailSections(node, ctx) {
    var kindMap = {
      root: {
        conclusion: ctx.district + "当前可围绕“" + ctx.industry + "”形成完整的链条总览，适合作为专题汇报首页，用于展示链条结构、重点环节和后续补链方向。",
        evidence: "该节点处于整张图谱的核心位置，能够统筹串联链条阶段、重点环节和细分赛道，是领导看全局、业务部门讲逻辑的总纲节点。",
        advice: "建议将该节点作为专题汇报的一级标题页，叠加链主企业、重点园区和招商线索，形成一张图总览。",
        report: "建议表述为：当前已初步形成“总链条清晰、重点环节可识别、补链方向可研判”的图谱基础。"
      },
      stage: {
        conclusion: "“" + node.label + "”可作为链条阶段性环节单独展开，适合说明这一阶段承担的研发、制造、流通或服务职能。",
        evidence: "该节点承上启下，既能展示本地在这一阶段的承接能力，也便于识别是否存在配套不足、环节缺口或招商空间。",
        advice: "建议围绕该阶段补充骨干企业、载体空间和政策支撑情况，形成阶段性承接能力说明。",
        report: "建议表述为：该阶段是当前产业链条中的关键承接环节，应重点关注其本地基础和后续补强方向。"
      },
      main: {
        conclusion: "“" + node.label + "”属于链条中的重点环节，适合单列作为分析单元，用于识别本地优势基础和下一步补链重点。",
        evidence: "该环节位于图谱的中间层，既能承接上游能力，也能向下游应用延展，是做企业梳理、园区匹配和招商判断的主要抓手。",
        advice: "建议结合企业画像、园区分布、投融资信息和近期项目动态，判断其成长性、集聚度和招商价值。",
        report: "建议表述为：该环节已具备一定基础，但仍需围绕代表性主体、空间承载和资源导入持续增强。"
      },
      leaf: {
        conclusion: "“" + node.label + "”对应更细的细分方向，适合和具体企业、产品、项目或园区承载场景建立直接对应关系。",
        evidence: "这类节点通常更贴近实际招商对象和企业服务需求，便于从概念图谱进一步落到对象清单和承接场景。",
        advice: "建议重点核实该方向是否已有代表性企业、是否具备稳定配套，以及是否适合导入外部资源。",
        report: "建议表述为：该细分方向具备进一步细化研判价值，可作为后续企业服务和招商落点。"
      },
      "leaf-right": {
        conclusion: "“" + node.label + "”属于更细的专项赛道，适合直接对应目标企业、专项项目和具体招商方向。",
        evidence: "该类节点通常位于图谱末端，更容易映射到实际应用场景和目标对象，是从链条认知走向招商执行的关键落点。",
        advice: "建议重点看赛道成熟度、企业集聚度、产业承载空间和外部导入可能性，形成对象化工作清单。",
        report: "建议表述为：该赛道可作为专项招商和精准服务的具体抓手，具备继续落细的空间。"
      }
    };
    return kindMap[node.kind] || kindMap.main;
  }

  function chainNodeDetailHtml(nodeId) {
    if (!_chainNodeRegistry || !_chainNodeRegistry.nodes || !_chainNodeRegistry.nodes[nodeId]) {
      return '<div class="muted">暂无节点详细介绍。</div>';
    }
    var node = _chainNodeRegistry.nodes[nodeId];
    var ctx = _chainNodeRegistry.context || {};
    var summary = node.desc || ("“" + node.label + "”是当前图谱中的重点节点，可用于展示其在产业链中的功能定位、关联对象和研判价值。");
    var sec = chainNodeDetailSections(node, ctx);
    var weakInfo = (ctx.assessmentMap && ctx.assessmentMap[nodeId]) || null;
    if (weakInfo) {
      sec = {
        conclusion: "“" + node.label + "”当前被识别为" + weakInfo.levelLabel + "，建议作为下一轮补链招商和重点研判对象。",
        evidence: weakInfo.reason + " 当前匹配企业 " + weakInfo.totalCount + " 家。",
        advice: weakInfo.advice,
        report: "建议表述为：当前“" + node.label + "”环节企业支撑偏弱，应作为" + (ctx.district || "当前区域") + "下一阶段补链招商和资源导入的重点方向。"
      };
    }
    var allMatched = chainResolveMatchedEnterprises(nodeId, node.label);
    var matched = allMatched.slice(0, 5);
    function chainCtxHref(path, extraQ) {
      var nextQ = {
        src: "chain",
        district: ctx.district || govDemoDistrictName(),
        industry: ctx.industry || "",
        tab: "intro",
        chain_label: node.label,
        chain_nid: nodeId || ""
      };
      Object.keys(extraQ || {}).forEach(function (key) {
        nextQ[key] = extraQ[key];
      });
      return buildHash(path, nextQ);
    }
    var kindLabel = (function (k) {
      var m = { root: "产业链核心", stage: "链条阶段", main: "重点环节", leaf: "细分方向", "leaf-right": "细分赛道" };
      return m[k] || "产业节点";
    })(node.kind);
    var matchedHtml = matched.length
      ? '<div class="chain-node-detail-links">' +
          matched.map(function (item) {
            var ent = item.e;
            return '<a class="chain-node-detail-link" href="' + esc(chainCtxHref("/gov/portrait/" + ent.id)) + '">' +
              '<b>' + esc(ent.name) + '</b><span>' + esc((ent.industry || "-") + " / " + (ent.level || "-")) + '</span></a>';
          }).join("") +
        "</div>"
      : '<div class="chain-node-detail-empty">当前未匹配到明显关联企业，可后续接入更完整的节点标签体系。</div>';
    var relatedEnterpriseHref = chainCtxHref("/gov/portrait", {
      filter: "chain",
      fv: node.label,
      nid: nodeId || ""
    });
    return (
      '<div class="chain-node-detail">' +
      '<div class="chain-node-detail-head"><span class="chain-node-detail-kicker">' +
      esc(ctx.industry || "产业链节点") +
      '</span><h4>' +
      esc(node.label) +
      '</h4><div class="chain-node-detail-meta"><span>节点类型：' +
      esc(kindLabel) +
      '</span><span>研判区域：' +
      esc(ctx.district || "当前区域") +
      '</span><span>匹配企业：' +
      esc(String(allMatched.length)) +
      " 家</span>" +
      (weakInfo ? '<span>环节判断：' + esc(weakInfo.levelLabel) + '</span>' : '') +
      "</div></div>" +
      '<div class="chain-node-detail-brief"><span>汇报摘要</span><p>' +
      esc(summary) +
      "</p></div>" +
      '<div class="chain-node-detail-grid">' +
      '<section class="chain-node-detail-card primary"><h5>研判结论</h5><p>' +
      esc(sec.conclusion) +
      '</p></section>' +
      '<section class="chain-node-detail-card"><h5>支撑判断</h5><p>' +
      esc(sec.evidence) +
      '</p></section>' +
      '<section class="chain-node-detail-card"><h5>建议动作</h5><p>' +
      esc(sec.advice) +
      '</p></section>' +
      '<section class="chain-node-detail-card report"><h5>汇报口径</h5><p>' +
      esc(sec.report) +
      '</p></section>' +
      "</div>" +
      '<section class="chain-node-detail-rel"><div class="chain-node-detail-rel-head"><h5>关联企业入口</h5><div class="chain-node-detail-rel-tools"><span>' +
      esc(String(allMatched.length)) +
      ' 家</span><a class="btn small chain-node-detail-more" href="' +
      esc(relatedEnterpriseHref) +
      '">查看相关企业</a></div></div>' +
      matchedHtml +
      '</section><div class="row-actions"><button class="btn" data-action="modal_close">关闭</button></div></div>'
    );
  }

  function _chainPanelHtml(profile, tab) {
    if (!profile) return '';
    if (tab === "sectors") {
      return '<div class="chain-list">' + (profile.sectors || []).map(function (x) { return '<div class="chain-list-row"><span>' + esc(x) + '</span></div>'; }).join('') + '</div>';
    }
    if (tab === "funding") {
      return '<div class="chain-list">' + (profile.funding || []).map(function (x) { return '<div class="chain-list-row"><b>' + esc(x.name) + '</b><span><i>' + esc(x.stage) + '</i> · ' + esc(x.amount) + '</span></div>'; }).join('') + '</div>';
    }
    return '<div class="chain-intro">' + esc(profile.intro) + '</div><div class="chain-intro-tip">头部企业可点击进入详情页查看关联信息。</div>' + '<div class="chain-leaders"><h5>头部企业</h5>' + (profile.leaders || []).map(function (ent) { return '<span class="chain-leader-chip">' + esc(ent.name) + '</span>'; }).join('') + '</div>';
  }

  function pageGovChain(rt) {
    /* ── district → industry output mapping ── */
    var districtIndustryMap = {
      "全市": [
        { name: "航空航天", output: 1280.5 },
        { name: "人工智能", output: 1105.2 },
        { name: "金融", output: 968.7 },
        { name: "商务商贸", output: 846.3 },
        { name: "文化旅游", output: 724.1 },
        { name: "文旅", output: 680.9 },
        { name: "低空经济", output: 512.6 }
      ],
      "青羊区": [
        { name: "航空航天", output: 420.8 },
        { name: "金融", output: 286.3 },
        { name: "人工智能", output: 215.6 },
        { name: "文化旅游", output: 198.4 },
        { name: "文旅", output: 172.5 },
        { name: "商务商贸", output: 145.2 },
        { name: "低空经济", output: 98.7 }
      ],
      "锦江区": [
        { name: "商务商贸", output: 358.6 },
        { name: "金融", output: 312.4 },
        { name: "文化旅游", output: 268.9 },
        { name: "文旅", output: 245.3 },
        { name: "人工智能", output: 186.7 },
        { name: "航空航天", output: 102.4 },
        { name: "低空经济", output: 78.5 }
      ],
      "武侯区": [
        { name: "人工智能", output: 486.2 },
        { name: "航空航天", output: 356.8 },
        { name: "金融", output: 248.5 },
        { name: "商务商贸", output: 212.3 },
        { name: "低空经济", output: 186.4 },
        { name: "文旅", output: 142.7 },
        { name: "文化旅游", output: 98.6 }
      ],
      "成华区": [
        { name: "航空航天", output: 298.5 },
        { name: "人工智能", output: 265.8 },
        { name: "商务商贸", output: 218.6 },
        { name: "低空经济", output: 178.4 },
        { name: "金融", output: 156.2 },
        { name: "文化旅游", output: 132.7 },
        { name: "文旅", output: 108.3 }
      ]
    };
    var districtNames = [govDemoDistrictName()];
    var selDistrict = govDemoDistrictName();
    var sortedIndustries = districtIndustryMap[selDistrict] || districtIndustryMap["青羊区"];
    var industryList = sortedIndustries.map(function (d) { return d.name; });
    var industryOutputMap = {};
    sortedIndustries.forEach(function (d) { industryOutputMap[d.name] = d.output; });
    var industry = (rt.q && rt.q.industry) || industryList[0];
    if (industryList.indexOf(industry) < 0) industry = industryList[0];
    var tab = (rt.q && rt.q.tab) || "intro";
    if (["intro", "sectors", "funding"].indexOf(tab) < 0) tab = "intro";
    var keyword = ((rt.q && rt.q.term) || "").trim();
    var zoom = clamp(Number((rt.q && rt.q.z) || 1), 0.75, 1.55);

    function entLabel(id, fallback) {
      var e = entById(id);
      return {
        id: e && e.id ? e.id : "",
        name: (e && e.name) || fallback || id || "未知企业",
        industry: (e && e.industry) || "",
        level: (e && e.level) || "",
      };
    }

    var sharedLeft = [
      { name: "研发与设计服务", tone: "lilac", y: 24, items: ["研发设计外包", "试验与检测服务"],
        desc: "为产业链各环节提供技术研发、工艺设计、样品试制及检验检测等专业支撑",
        itemDescs: ["承接企业研发设计环节外包，覆盖CAD/CAE仿真与模具开发", "提供材料、性能、环境等第三方检测与合规认证服务"] },
      { name: "代工与制造服务", tone: "brown", y: 40, items: ["代工生产", "供应链管理服务"],
        desc: "整合区域制造资源，为链上企业提供柔性产能与供应链一体化管理",
        itemDescs: ["提供OEM/ODM代工、小批量快反及柔性制造服务", "集成采购、仓储、物流与质量管控的全链路供应链解决方案"] },
      { name: "专业商务服务", tone: "yellow", y: 58, items: ["法律服务", "知识产权服务", "财会与金融服务"],
        desc: "提供法律、知识产权及财务金融等专业商务配套，保障企业合规经营",
        itemDescs: ["企业合同审查、合规咨询、纠纷仲裁等法律保障", "专利申请、商标注册、知识产权保护与运营", "代理记账、税务筹划、融资顾问与投后管理"] },
      { name: "信息与数字化服务", tone: "red", y: 76, items: ["信息与技术服务", "数字化转型服务"],
        desc: "以信息技术和数字化手段赋能传统产业，推动企业智能化升级",
        itemDescs: ["IT基础设施托管、云服务、系统集成与技术咨询", "ERP/MES/CRM部署、数据中台建设、智能工厂改造"] },
    ];

    var profiles = {
      "航空航天": {
        root: "无人机整机制造",
        intro:
          "围绕无人机整机制造构建“技术研发-整机集成-场景应用”产业体系，聚焦关键零部件自主可控与整机验证能力提升。",
        sectors: ["供应链融资", "线路产品", "设备融资租赁", "风险缓释", "数据风控"],
        news: [
          { date: "2026-03-03", title: "成都市新增 3 个低空测试走廊，强化无人机试飞场景供给" },
          { date: "2026-02-25", title: "某重点园区发布无人机整机与机载系统联合攻关计划" },
          { date: "2026-02-18", title: "区级专项资金支持无人机关键材料与传感器研发" },
        ],
        funding: [
          { name: "天衡无人系统", stage: "A轮", amount: "2.3亿元" },
          { name: "星翼飞控科技", stage: "Pre-A", amount: "6800万元" },
          { name: "凌云任务载荷", stage: "战略融资", amount: "1.1亿元" },
        ],
        leaders: [entLabel("e1", "天衡无人系统"), entLabel("e5", "星翼飞控科技"), entLabel("e2", "凌云任务载荷")],
        stages: [
          {
            name: "上游",
            tone: "cyan",
            y: 26,
            desc: "原材料与核心零部件研发制造环节，决定整机性能与自主可控程度",
            groups: [
              { name: "原材料", y: 14, desc: "为无人机提供结构材料与功能涂层，直接影响飞行器重量与隐身性能", items: ["金属材料（铝合金、钛合金、复材）", "复合材料（树脂、橡胶、陶瓷、碳纤维）", "化工材料（隐身涂料、胶黏剂）"], itemDescs: ["铝合金/钛合金/碳纤维复材用于机体结构，兼顾轻量化与强度", "工程树脂、特种橡胶、陶瓷基和碳纤维增强材料", "特种隐身涂料与结构胶黏剂，提升飞行器隐蔽性能"] },
              { name: "研发设计", y: 25, desc: "从项目论证到试飞验证的全流程设计体系，保障整机安全交付", items: ["项目论证（详细设计）", "方案设计（试制与验证）", "初步设计"], itemDescs: ["详细设计阶段，完成结构/气动/电气全系统仿真", "进入试制环节，验证关键参数与工艺可行性", "确定总体技术方案与指标要求"] },
              { name: "零部件、元器件", y: 36, desc: "核心器件自主研发，突破卡脖子技术环节", items: ["发动机、传感器、陀螺仪、主控芯片"], itemDescs: ["包括活塞/涡扇发动机、MEMS传感器、光纤陀螺与国产主控SoC"] },
            ],
          },
          {
            name: "中游",
            tone: "green",
            y: 50,
            desc: "机体制造、系统集成与机载设备配套环节",
            groups: [
              { name: "机体", y: 40, desc: "飞行器结构件制造，涵盖气动外形与起降系统", items: ["机身、机翼、尾翼、起落架、吊舱挂架"], itemDescs: ["复材机身、可折叠机翼、V尾结构、起落装置与外挂载荷挂架"] },
              { name: "机载系统", y: 50, desc: "动力、航电与任务系统三位一体的核心能力总成", items: ["动力系统（活塞、涡扇、涡轴、发动机制电）", "航电系统（导航、飞控、通信、控制）", "任务系统（感知、识别、协同）"], itemDescs: ["提供飞行推力，覆盖活塞/涡扇/涡轴及混合电推方案", "惯导+卫导融合、自主飞控、宽带链路与指控系统", "光电/雷达/红外感知载荷及多机协同指挥"] },
              { name: "设备融资租赁", y: 60, desc: "高价值机载任务设备的融资租赁与共享模式", items: ["光电吊舱", "机载武器"], itemDescs: ["高分辨率光电侦察与目标跟踪吊舱设备", "精确制导弹药与电子对抗系统"] },
            ],
          },
          {
            name: "下游",
            tone: "orange",
            y: 74,
            desc: "整机总装交付与行业应用场景落地",
            groups: [
              { name: "集成总装", y: 66, desc: "按用途分型号集成总装，覆盖军民两用市场", items: ["中大型长航时", "中小型", "民参军中小型"], itemDescs: ["续航>24h的战略侦察/察打一体平台", "战术级侦察/通信中继无人机", "军民融合型轻量化多用途平台"] },
              { name: "军贸", y: 75, desc: "无人机整机与培训的国际军贸合作", items: ["军贸与联训"], itemDescs: ["整机出口、操作培训与联合作战演训合作"] },
              { name: "应用领域", y: 84, desc: "民用场景拓展，赋能城市治理与产业升级", items: ["城市规划、航空护城、环境监测"], itemDescs: ["航拍测绘辅助规划、城市巡检及大气/水质遥感监测"] },
            ],
          },
        ],
      },
      "金融": {
        root: "产业链金融服务",
        intro: "聚焦产业链“应收-订单-库存-设备”四类资产，建立分层授信和风险共担机制，提升链上融资可得性。",
        sectors: ["供应链融资", "线路产品", "联名文创", "风险缓释", "数据风控"],
        news: [
          { date: "2026-03-01", title: "链上企业白名单更新，新增 42 家高成长企业" },
          { date: "2026-02-22", title: "银政联合推出“园区信用贷”额度池" },
          { date: "2026-02-11", title: "产业链沉浸体验线上通道升级" },
        ],
        funding: [
          { name: "某银行青羊支行", stage: "授信池", amount: "20亿元" },
          { name: "产业基金（一期）", stage: "设立", amount: "50亿元" },
          { name: "科技担保专项", stage: "增信", amount: "8亿元" },
        ],
        leaders: [entLabel("e1", "某银行青羊支行"), entLabel("e3", "锦城法务中心"), entLabel("e4", "青羊智数")],
        stages: [
          { name: "上游", tone: "cyan", y: 26, desc: "金融基础能力与风控体系建设", groups: [{ name: "核心技术", y: 16, desc: "支撑金融服务的底层技术能力", items: ["飞控导航", "通信链路", "电池材料"], itemDescs: ["精准定价与授信模型算法", "银企数据对接与实时风控链路", "资金池管理与流动性保障技术"] }, { name: "法规标准", y: 28, desc: "行业合规与监管框架", items: ["运行标准", "适航要求", "空域规则"], itemDescs: ["授信操作规范与放款流程标准", "信贷资产质量与准入门槛要求", "区域金融政策与监管边界规则"] }] },
          { name: "中游", tone: "green", y: 50, desc: "金融产品创新与运营服务", groups: [{ name: "产品开发", y: 44, desc: "围绕产业链需求定制金融产品", items: ["线路产品", "沉浸体验", "联名文创"], itemDescs: ["供应链融资、订单贷、库存质押等标准产品线", "产融对接路演与实地调研服务", "银政联名信用产品与专属额度池"] }, { name: "运营管理", y: 56, desc: "金融服务的日常运营与客户管理", items: ["场馆运营", "活动运营", "内容运营"], itemDescs: ["线下网点与园区驻点服务运营", "产融对接活动与政银企座谈会", "金融知识输出与案例内容传播"] }] },
          { name: "下游", tone: "orange", y: 74, desc: "终端场景落地与价值变现", groups: [{ name: "消费场景", y: 70, desc: "金融产品最终触达的终端场景", items: ["景区", "街区", "商圈"], itemDescs: ["园区内企业集中授信投放", "沿街商铺与小微企业金融覆盖", "商圈消费金融与商户流水贷"] }, { name: "价值转化", y: 82, desc: "金融服务的效益产出与社会价值", items: ["门票收入", "衍生消费", "品牌传播"], itemDescs: ["利息收入与手续费收入", "交叉销售保险/理财等衍生业务", "银行品牌声誉与政策支持获取"] }] },
        ],
      },
      "文旅": {
        root: "文旅融合产业链",
        intro: "以“交易组织-履约交付-品牌运营”为主线，打通线上线下一体化商贸服务能力。",
        sectors: ["内容创作", "数字文博", "文旅营销", "文旅装备", "履约交付"],
        news: [
          { date: "2026-03-02", title: "文旅消费周启动，重点商圈联动夜间经济活动" },
          { date: "2026-02-19", title: "沉浸式演艺项目完成首轮运营评估" },
          { date: "2026-02-08", title: "“文旅+科技”融合试点发布年度计划" },
        ],
        funding: [
          { name: "城市文旅项目A", stage: "天使轮", amount: "3000万元" },
          { name: "沉浸演艺平台", stage: "A轮", amount: "1.2亿元" },
          { name: "文创IP运营商", stage: "战略融资", amount: "8000万元" },
        ],
        leaders: [entLabel("e2", "城市文旅运营公司"), entLabel("e4", "数字文创平台"), entLabel("e5", "文商旅服务商")],
        stages: [
          { name: "上游", tone: "cyan", y: 26, desc: "文旅内容资源与数字技术底座", groups: [{ name: "内容资源", y: 16, desc: "文化IP与遗产资源的挖掘与策划", items: ["文化IP", "遗产资源", "主题策划"], itemDescs: ["本土文化IP孵化与授权运营", "历史遗址与非遗资源数字化保护", "节庆、展览等主题活动策划"] }, { name: "技术支撑", y: 28, desc: "数字化渲染与沉浸体验技术", items: ["数字渲染", "AR/VR", "票务系统"], itemDescs: ["实时3D渲染与数字孪生建模", "增强现实导览与虚拟现实体验", "智能票务预约与客流管理系统"] }] },
          { name: "中游", tone: "green", y: 50, desc: "文旅产品打造与运营管理", groups: [{ name: "产品开发", y: 44, desc: "面向消费者的文旅产品矩阵", items: ["线路产品", "沉浸体验", "联名文创"], itemDescs: ["城市深度游与主题精品线路", "沉浸式夜游与互动演艺项目", "品牌联名的文创衍生商品"] }, { name: "运营管理", y: 56, desc: "场馆与活动的精细化运营", items: ["场馆运营", "活动运营", "内容运营"], itemDescs: ["景区与展馆的日常运营管理", "节庆活动策划执行与效果评估", "图文/短视频等内容制作与分发"] }] },
          { name: "下游", tone: "orange", y: 74, desc: "消费终端与品牌价值沉淀", groups: [{ name: "消费场景", y: 70, desc: "线下消费空间与体验场景", items: ["景区", "街区", "商圈"], itemDescs: ["4A/5A景区与文旅综合体", "历史文化街区与特色商业街", "城市核心商圈文旅消费带"] }, { name: "价值转化", y: 82, desc: "从流量到营收的转化路径", items: ["门票收入", "衍生消费", "品牌传播"], itemDescs: ["景区门票与演出票务收入", "餐饮、住宿、文创等二次消费", "城市文旅品牌口碑与媒体传播"] }] },
        ],
      },
      "商务商贸": {
        root: "商务商贸服务链",
        intro: "以“交易组织-履约交付-品牌运营”为主线，打通线上线下一体化商贸服务能力。",
        sectors: ["供应链组织", "品牌运营", "渠道管理", "履约配送", "零售数字化"],
        news: [
          { date: "2026-03-04", title: "重点商圈发布数字化招商图谱" },
          { date: "2026-02-24", title: "商贸企业上云专项行动完成首批验收" },
          { date: "2026-02-12", title: "跨境电商示范仓投入运营" },
        ],
        funding: [
          { name: "商贸平台B", stage: "B轮", amount: "3.5亿元" },
          { name: "即时零售服务商", stage: "A轮", amount: "9600万元" },
          { name: "跨境贸易服务商", stage: "战略融资", amount: "1.4亿元" },
        ],
        leaders: [entLabel("e1", "商贸平台B"), entLabel("e4", "即时零售服务商"), entLabel("e6", "跨境贸易服务商")],
        stages: [
          { name: "上游", tone: "cyan", y: 26, desc: "货源组织与数字化系统支撑", groups: [{ name: "货源组织", y: 16, desc: "供应端品牌与渠道资源整合", items: ["品牌商", "制造商", "渠道商"], itemDescs: ["头部品牌直供与独家授权合作", "OEM/ODM工厂集群资源对接", "区域总代与分销渠道网络"] }, { name: "数据与系统", y: 28, desc: "商贸信息化基础设施", items: ["ERP", "仓配系统", "订单中台"], itemDescs: ["企业资源计划与进销存管理", "智能仓储与配送路由优化系统", "全渠道订单聚合与履约分发中台"] }] },
          { name: "中游", tone: "green", y: 50, desc: "线上线下交易运营与履约网络", groups: [{ name: "交易与运营", y: 44, desc: "平台流量获取与商户运营", items: ["平台招商", "流量运营", "会员体系"], itemDescs: ["商家入驻与品类结构优化", "搜索/推荐/直播等流量运营", "积分/等级/权益会员运营体系"] }, { name: "履约协同", y: 56, desc: "从仓库到消费者的履约闭环", items: ["仓储分拨", "末端配送", "售后服务"], itemDescs: ["区域仓/前置仓分拨与调度", "即时配送与快递末端投递", "退换货/维修/客诉处理体系"] }] },
          { name: "下游", tone: "orange", y: 74, desc: "终端消费场景与增长指标", groups: [{ name: "消费端", y: 70, desc: "触达消费者的线上线下渠道", items: ["社区零售", "商圈门店", "电商渠道"], itemDescs: ["社区团购/便利店/生鲜前置仓", "购物中心与核心商圈实体门店", "天猫/京东/抖音等电商平台"] }, { name: "增长类型", y: 82, desc: "衡量商贸服务效率的核心指标", items: ["客单价", "复购率", "履约时效"], itemDescs: ["单次交易的平均消费金额", "老客户回购比例与活跃度", "从下单到签收的平均时长"] }] },
        ],
      },
      "低空经济": {
        root: "低空经济产业链",
        intro: "通过“文化内容+旅游产品+数字渠道”协同发展，提升区域文旅品牌辨识度和消费留存。",
        sectors: ["飞行器制造", "空域管理", "低空物流", "应急救援", "城市服务"],
        news: [
          { date: "2026-03-05", title: "低空经济年度街区清单发布" },
          { date: "2026-02-26", title: "无人机物流试点线路新增 12 条" },
          { date: "2026-02-10", title: "低空监管数据平台完成二期建设" },
        ],
        funding: [
          { name: "低空运营商C", stage: "A+轮", amount: "1.8亿元" },
          { name: "空域数字平台", stage: "Pre-A", amount: "5200万元" },
          { name: "无人机物流企业", stage: "B轮", amount: "2.7亿元" },
        ],
        leaders: [entLabel("e5", "低空运营商C"), entLabel("e2", "空域数字平台"), entLabel("e1", "无人机物流企业")],
        stages: [
          { name: "上游", tone: "cyan", y: 26, desc: "低空飞行器核心技术与法规体系", groups: [{ name: "核心技术", y: 16, desc: "低空飞行器的关键技术能力", items: ["飞控导航", "通信链路", "电池材料"], itemDescs: ["低空专用飞控与精准导航定位系统", "5G/卫星中继与空地通信链路", "高能量密度锂电/氢燃料电池技术"] }, { name: "法规标准", y: 28, desc: "低空空域管理与适航法规", items: ["运行标准", "适航要求", "空域规则"], itemDescs: ["低空飞行活动运行规范与安全标准", "无人机/eVTOL适航审定与型号认证", "低空空域划设与动态管控规则"] }] },
          { name: "中游", tone: "green", y: 50, desc: "飞行器制造集成与运营平台", groups: [{ name: "制造与集成", y: 44, desc: "低空飞行器整机制造与系统集成", items: ["整机制造", "系统集成", "测试认证"], itemDescs: ["eVTOL/无人机整机生产制造", "航电、动力与任务系统集成", "地面试验、试飞与取证认证"] }, { name: "平台运营", y: 56, desc: "飞行调度与安全保障", items: ["调度平台", "安全监测", "运维保障"], itemDescs: ["低空飞行器调度与出行路径规划", "空域态势感知与飞行安全监控", "飞行器维保检修与备件供应"] }] },
          { name: "下游", tone: "orange", y: 74, desc: "低空经济应用落地与商业化", groups: [{ name: "应用场景", y: 70, desc: "低空飞行器的终端使用场景", items: ["物流配送", "应急巡检", "城市治理"], itemDescs: ["无人机末端配送与即时物流", "应急救援、电力巡线与管道巡检", "城管执法、交通监控与环境监测"] }, { name: "商业转化", y: 82, desc: "低空经济的可持续商业模式", items: ["服务收入", "运营效率", "场景复制"], itemDescs: ["按次/按时计费的飞行服务收入", "相比传统方式的效率提升倍数", "成熟场景向其他城市/行业复制推广"] }] },
        ],
      },
      "文化旅游": {
        root: "文化旅游协同链",
        intro: "通过“文化内容+旅游产品+数字渠道”协同发展，提升区域文旅品牌辨识度和消费留存。",
        sectors: ["文化内容", "旅游产品", "传播渠道", "文旅装备", "品牌营销"],
        news: [
          { date: "2026-02-28", title: "文旅品牌联名活动带动区域消费增长" },
          { date: "2026-02-20", title: "城市文化IP数字展馆上线试运营" },
          { date: "2026-02-06", title: "重点文旅街区完成场景改造提升" },
        ],
        funding: [
          { name: "文化IP运营商", stage: "A轮", amount: "9000万元" },
          { name: "旅游科技平台", stage: "战略融资", amount: "1.5亿元" },
          { name: "沉浸展览团队", stage: "天使轮", amount: "1800万元" },
        ],
        leaders: [entLabel("e2", "文化IP运营商"), entLabel("e3", "旅游科技平台"), entLabel("e4", "沉浸展览团队")],
        stages: [
          { name: "上游", tone: "cyan", y: 26, desc: "文化遗产资源挖掘与数字采集", groups: [{ name: "文化资源", y: 16, desc: "本土特色文化资源的系统梳理", items: ["非遗资源", "历史文化", "艺术内容"], itemDescs: ["蜀绣、川剧、竹编等非遗技艺活化利用", "三国文化、古蜀文化等历史资源转化", "当代艺术、音乐、影视等创意内容"] }, { name: "数字技术", y: 28, desc: "文旅数字化的技术工具链", items: ["数字采集", "虚拟制作", "互动系统"], itemDescs: ["三维扫描、摄影测量等文物数字化采集", "虚拟场景搭建与数字内容制作", "体感互动、多点触控等沉浸系统"] }] },
          { name: "中游", tone: "green", y: 50, desc: "文旅产品与平台化运营", groups: [{ name: "产品与活动", y: 44, desc: "面向游客的文旅产品与体验", items: ["主题活动", "演艺项目", "线路产品"], itemDescs: ["文化节庆、市集等主题活动策划", "实景演出与沉浸式戏剧项目", "城市漫步与深度体验线路"] }, { name: "平台运营", y: 56, desc: "数字化运营与用户触达", items: ["票务平台", "内容平台", "用户运营"], itemDescs: ["景点门票与演出票务在线预订", "图文/视频/直播内容创作分发", "会员体系与精准营销触达"] }] },
          { name: "下游", tone: "orange", y: 74, desc: "消费转化与城市品牌建设", groups: [{ name: "消费端", y: 70, desc: "游客消费的多元场景", items: ["游客消费", "文创消费", "夜间经济"], itemDescs: ["景区/街区内的餐饮住宿娱乐消费", "特色文创商品与伴手礼购买", "夜游/夜市/夜演等夜间消费业态"] }, { name: "品牌沉淀", y: 82, desc: "文旅品牌的长期价值积累", items: ["城市品牌", "口碑传播", "复游率"], itemDescs: ["城市文旅形象与IP品牌价值", "社交媒体口碑与游客推荐指数", "游客回访率与深度消费意愿"] }] },
        ],
      },
      "人工智能": {
        root: "人工智能产业链",
        intro: "围绕“算力-算法-应用”链条打造人工智能产业生态，重点突破行业模型、应用场景和数据治理能力。",
        sectors: ["算力底座", "算法模型", "数据治理", "行业应用", "AI安全合规"],
        news: [
          { date: "2026-03-05", title: "行业大模型应用示范场景新增 18 个" },
          { date: "2026-02-23", title: "人工智能算力中心二期正式上线" },
          { date: "2026-02-14", title: "AI 安全与合规评测体系发布" },
        ],
        funding: [
          { name: "智算平台D", stage: "B轮", amount: "4.2亿元" },
          { name: "行业模型公司", stage: "A轮", amount: "1.9亿元" },
          { name: "AI 数据服务商", stage: "Pre-A", amount: "7200万元" },
        ],
        leaders: [entLabel("e1", "智算平台D"), entLabel("e4", "行业模型公司"), entLabel("e6", "AI 数据服务商")],
        stages: [
          { name: "上游", tone: "cyan", y: 26, desc: "AI基础算力与开发框架层", groups: [{ name: "基础能力", y: 16, desc: "算力、数据与云服务等底层资源", items: ["算力芯片", "云平台", "数据资源"], itemDescs: ["GPU/TPU/NPU等AI训推专用芯片", "公有云/私有云AI计算资源服务", "高质量标注数据集与数据交易市场"] }, { name: "开发框架", y: 28, desc: "AI模型训练与部署的技术工具链", items: ["训练框架", "推理引擎", "MLOps"], itemDescs: ["PyTorch/PaddlePaddle等深度学习框架", "TensorRT/ONNX等高性能推理引擎", "模型版本管理、自动化训练与持续部署"] }] },
          { name: "中游", tone: "green", y: 50, desc: "AI模型研发与平台化服务", groups: [{ name: "模型层", y: 44, desc: "通用与行业大模型研发", items: ["通用模型", "行业模型", "多模态模型"], itemDescs: ["GPT类通用文本生成与理解大模型", "金融/医疗/制造等垂直行业大模型", "融合文本、图像、语音的多模态模型"] }, { name: "平台层", y: 56, desc: "模型服务接入与智能体编排", items: ["模型服务", "知识库", "Agent编排"], itemDescs: ["模型API接口与推理服务平台", "企业知识库构建与RAG检索增强", "多Agent协同与工作流自动编排"] }] },
          { name: "下游", tone: "orange", y: 74, desc: "AI落地应用与业务价值实现", groups: [{ name: "应用场景", y: 70, desc: "AI技术赋能的终端业务场景", items: ["政务服务", "企业运营", "金融风控"], itemDescs: ["智能审批、政策推荐与市民服务", "智能客服、流程自动化与决策辅助", "反欺诈、信用评估与合规监测"] }, { name: "价值产出", y: 82, desc: "AI应用带来的可量化价值", items: ["降本增效", "业务创新", "风险控制"], itemDescs: ["人力成本降低与运营效率提升", "AI驱动的新产品/新业态/新模式", "风险识别准确率与事前防范能力"] }] },
        ],
      },
    };

    /* ── district-specific chain overrides ── */
    var districtChainOverrides = {
      "青羊区": {
        "航空航天": {
          root: "航空零部件精密配套链",
          intro: "依托青羊航空产业基地，围绕航空零部件精密制造与配套服务，构建从材料供应到总装交付的完整产业闭环。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "航空级原材料供应与精密零部件研发",
              groups: [
                { name: "航空材料", y: 14, desc: "为航空零部件提供高性能原材料与特种合金", items: ["钛合金锻件与精密铸件", "碳纤维预浸料与复材板材", "航空级密封件与紧固件"], itemDescs: ["TC4/TC18钛合金锻件及精密铸造毛坯", "T700/T800碳纤维预浸料及RTM成型板材", "航空标准密封圈、高锁螺栓与自锁螺母"] },
                { name: "精密加工", y: 25, desc: "高精度数控加工与特种工艺制造", items: ["五轴精密数控加工", "特种焊接与表面处理", "精密装配与检测"], itemDescs: ["五轴联动加工中心制造复杂曲面零件", "电子束焊/激光焊/等离子喷涂/阳极化处理", "微米级精密装配与三坐标/CT无损检测"] },
                { name: "设计验证", y: 36, desc: "航空零部件设计仿真与试验验证", items: ["结构强度仿真", "疲劳寿命试验", "适航取证支持"], itemDescs: ["有限元分析与气动载荷计算", "高低周疲劳/振动/环境适应性试验", "零部件级适航符合性验证与取证配合"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "航空系统级部件集成与配套服务",
              groups: [
                { name: "结构部件", y: 40, desc: "机体结构件与起落架系统制造", items: ["整体壁板与框梁", "起落架组件", "进气道与尾喷管"], itemDescs: ["整体壁板铣削、翼梁与机身框组件", "主起/前起缓冲支柱与作动器", "进气道唇口与尾喷管耐温组件"] },
                { name: "机电系统", y: 50, desc: "航空机载机电设备配套", items: ["液压作动系统", "环控与燃油系统", "机载线束与连接器"], itemDescs: ["液压泵/作动筒/伺服阀等液压系统", "座舱增压/空调/燃油管路与附件", "航空级线束组件与高可靠电连接器"] },
                { name: "维修保障", y: 60, desc: "航空零部件MRO与寿命管理", items: ["零部件大修翻新", "寿命监控与延寿"], itemDescs: ["叶片修复/起落架翻修/附件大修", "基于PHM的零部件寿命跟踪与延寿评估"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "总装配套交付与应用扩展",
              groups: [
                { name: "总装配套", y: 66, desc: "为主机厂提供配套总装服务", items: ["军机配套交付", "民机转包生产", "无人机整机总装"], itemDescs: ["军用机型结构件/系统件配套交付", "波音/空客民用飞机转包零部件制造", "中小型无人机整机总装与试飞"] },
                { name: "通航服务", y: 75, desc: "通用航空运营与改装服务", items: ["通航维修改装", "飞行培训服务"], itemDescs: ["通用飞机维修改装与加改装STC", "固定翼/直升机飞行员培训与执照考试"] },
                { name: "应用领域", y: 84, desc: "航空技术军民融合应用", items: ["应急救援装备", "航空测绘服务", "工业级无人机应用"], itemDescs: ["航空应急救援直升机与无人机救援", "高精度航空摄影测量与遥感", "电力巡检/农林植保/环境监测"] }
              ] }
          ]
        },
        "金融": {
          root: "文化金融创新服务链",
          intro: "依托青羊丰富文博资源，打造'文化资产评估-版权金融-文旅消费金融'特色金融服务链条。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "文化资产评估与金融基础设施",
              groups: [
                { name: "文化资产评估", y: 16, desc: "为文化资产建立标准化估值体系", items: ["版权价值评估", "文物鉴定定价", "IP估值模型"], itemDescs: ["影视/音乐/文学等版权市场价值评定", "文物艺术品真伪鉴定与市场价格评估", "文创IP品牌价值与授权收益预测模型"] },
                { name: "风控体系", y: 28, desc: "文化金融专项风险管理", items: ["文化资产确权", "信用风险模型", "政策性增信"], itemDescs: ["区块链确权与版权登记系统", "文化企业专属信用评分与违约模型", "政府风险补偿基金与融资担保增信"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "文化金融产品创新与运营",
              groups: [
                { name: "金融产品", y: 44, desc: "针对文化产业的定制金融产品", items: ["版权质押贷款", "文旅消费信贷", "文创供应链融资"], itemDescs: ["以版权/著作权质押的中小文企贷款", "文旅消费分期与景区商户流水贷", "文创产业链上下游应收/预付融资"] },
                { name: "服务运营", y: 56, desc: "文化金融服务的日常运营", items: ["文金对接平台", "投融资路演", "孵化器金融服务"], itemDescs: ["线上文化企业与金融机构对接平台", "文创项目路演与天使/VC对接活动", "入驻孵化器/加速器企业专属金融方案"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "文化金融价值实现与生态",
              groups: [
                { name: "应用场景", y: 70, desc: "文化金融产品的终端服务场景", items: ["文博场馆金融", "演艺产业金融", "文创园区金融"], itemDescs: ["博物馆/美术馆展览运营融资", "演出/戏剧/音乐节制作投资", "文创园区入驻企业普惠金融"] },
                { name: "生态价值", y: 82, desc: "文化金融的长期生态效益", items: ["文化产业增值", "就业带动效应", "品牌溢价提升"], itemDescs: ["金融赋能推动文化产值年均增长", "文化金融驱动创意就业岗位增加", "区域文化金融品牌的全国影响力"] }
              ] }
          ]
        },
        "人工智能": {
          root: "AI+航空智能制造链",
          intro: "将人工智能技术深度融入航空制造流程，打造智能质检、数字孪生与智慧工厂解决方案。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "AI算力与工业数据底座",
              groups: [
                { name: "工业数据", y: 16, desc: "航空制造场景的工业数据资源", items: ["产线传感数据", "工艺知识库", "质检影像数据"], itemDescs: ["CNC/焊接/装配产线实时传感器数据", "加工参数/工艺路线/缺陷案例知识库", "零部件X光/CT/视觉质检影像数据集"] },
                { name: "算力平台", y: 28, desc: "面向工业AI的边缘与云端算力", items: ["边缘计算网关", "工业AI云平台", "训练数据标注"], itemDescs: ["车间级边缘AI推理与实时决策网关", "GPU集群支撑的工业模型训练平台", "航空零部件缺陷/尺寸专业标注服务"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "工业AI模型与应用平台",
              groups: [
                { name: "智能质检", y: 44, desc: "AI驱动的航空零部件质量检测", items: ["视觉缺陷检测", "尺寸精度AI测量", "焊接质量分析"], itemDescs: ["深度学习识别表面裂纹/气孔/夹杂", "AI辅助三坐标/激光扫描尺寸偏差判定", "焊缝X光AI评判与等级自动分类"] },
                { name: "数字孪生", y: 56, desc: "航空制造全流程数字孪生", items: ["产线数字孪生", "零部件寿命预测", "工艺优化引擎"], itemDescs: ["车间/产线/设备三维数字镜像", "基于PHM的零部件剩余寿命预测", "加工参数智能优化与良率提升"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "智能制造落地与产业价值",
              groups: [
                { name: "智慧工厂", y: 70, desc: "AI赋能的航空智慧工厂", items: ["智能排产调度", "无人化物流", "能耗优化管理"], itemDescs: ["AI排产算法提升设备利用率至92%+", "AGV/AMR无人搬运与智能仓储", "AI能耗分析降低单位能耗15%+"] },
                { name: "产业效益", y: 82, desc: "智能制造的可量化产业价值", items: ["良率提升", "交期缩短", "成本降低"], itemDescs: ["AI质检+工艺优化提升良率3-5个百分点", "智能排产缩短平均交付周期20%+", "综合制造成本降低10-18%"] }
              ] }
          ]
        },
        "文化旅游": {
          root: "青羊文博旅游链",
          intro: "以金沙遗址、杜甫草堂等世界级文博资源为核心，构建'文博研学-沉浸体验-文创消费'特色文旅链条。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "世界级文博资源与数字化保护",
              groups: [
                { name: "文博资源", y: 16, desc: "青羊独有的顶级文博遗产", items: ["金沙遗址", "杜甫草堂", "宽窄巷子·少城"], itemDescs: ["古蜀金沙文明遗址博物馆与考古公园", "唐代诗圣杜甫草堂博物馆与诗歌文化", "清代少城满城格局与川西民居文化街区"] },
                { name: "数字文博", y: 28, desc: "文博资源数字化采集与展示", items: ["3D文物数字化", "虚拟展厅制作", "AI导览系统"], itemDescs: ["文物高精度三维扫描与数字建档", "线上虚拟博物馆与沉浸式数字展厅", "AI语音讲解与个性化参观路径推荐"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "文博旅游产品开发与运营",
              groups: [
                { name: "体验产品", y: 44, desc: "围绕文博IP的沉浸式体验产品", items: ["研学旅行课程", "沉浸式夜游", "考古体验营"], itemDescs: ["古蜀文明/诗歌文化主题研学课程", "金沙之夜/草堂诗意等沉浸式夜游", "模拟考古发掘与文物修复体验"] },
                { name: "文创开发", y: 56, desc: "文博IP的文创产品化运营", items: ["文博联名文创", "数字藏品发行", "主题餐饮住宿"], itemDescs: ["金沙太阳神鸟/草堂诗意等IP文创商品", "限量数字文物NFT与数字纪念品", "诗意主题民宿与古蜀文化主题餐厅"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "文旅消费与城市文化名片",
              groups: [
                { name: "消费场景", y: 70, desc: "文博旅游的核心消费场景", items: ["文博场馆消费", "文化街区消费", "节庆活动消费"], itemDescs: ["门票+馆内文创店+咖啡简餐", "宽窄巷子/泡桐树街特色商业消费", "诗歌节/金沙太阳节等文化节庆消费"] },
                { name: "品牌价值", y: 82, desc: "青羊文博旅游的城市品牌效应", items: ["研学目的地品牌", "文博旅游口碑", "国际文化交流"], itemDescs: ["全国TOP研学旅行目的地品牌认知", "小红书/携程文博旅游好评率与推荐量", "金沙文明国际巡展与文化外交活动"] }
              ] }
          ]
        },
        "文旅": {
          root: "少城文旅融合链",
          intro: "以宽窄巷子为龙头，串联少城片区文化资源，打造'文化体验-沉浸消费-夜间经济'融合链条。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "少城文化资源挖掘与IP打造",
              groups: [
                { name: "文化IP", y: 16, desc: "少城片区特色文化资源与IP", items: ["川西民居文化", "满城历史遗存", "茶馆曲艺文化"], itemDescs: ["川西民居建筑风格与院落生活方式", "清代少城满城格局与驻防文化遗存", "盖碗茶/川剧变脸/相声评书等曲艺文化"] },
                { name: "创意设计", y: 28, desc: "文旅内容的创意设计与包装", items: ["IP视觉设计", "空间场景设计", "活动策划设计"], itemDescs: ["少城IP形象/视觉识别系统设计", "沉浸式文化空间与打卡场景设计", "市集/夜游/主题活动创意策划"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "文旅产品运营与体验服务",
              groups: [
                { name: "体验项目", y: 44, desc: "面向游客的文旅体验项目", items: ["宽窄深度游", "少城文化市集", "沉浸式戏剧"], itemDescs: ["2-3小时宽窄巷子+少城深度文化导览", "非遗手作/美食品鉴/文创展售市集", "院落实景沉浸式川剧/话剧体验"] },
                { name: "商业运营", y: 56, desc: "文旅街区的精细化商业运营", items: ["特色餐饮运营", "文创零售运营", "精品住宿运营"], itemDescs: ["川菜/火锅/茶饮等特色餐饮品牌集群", "原创文创/非遗手作/设计师品牌店", "四合院精品民宿与文化主题酒店"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "夜间经济与文旅消费闭环",
              groups: [
                { name: "夜间经济", y: 70, desc: "少城夜间文旅消费业态", items: ["夜游宽窄巷子", "酒吧演艺街区", "深夜食堂"], itemDescs: ["灯光秀+文化表演的夜间深度游", "少城片区特色酒吧与Live演出", "深夜川味小吃与特色餐饮"] },
                { name: "引流转化", y: 82, desc: "从流量到营收的转化闭环", items: ["社交媒体引流", "会员复购体系", "周边消费带动"], itemDescs: ["抖音/小红书达人种草与UGC传播", "消费积分/年卡/储值会员运营", "辐射带动周边3公里商业消费增长"] }
              ] }
          ]
        },
        "商务商贸": {
          root: "青羊总部商贸服务链",
          intro: "依托骡马市、太升路等核心商圈，以总部经济为引领，构建'品牌总部-专业市场-社区商业'三级商贸体系。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "总部品牌与专业市场资源",
              groups: [
                { name: "总部经济", y: 16, desc: "引入和培育区域性品牌总部", items: ["品牌区域总部", "专业服务总部", "跨国企业办事处"], itemDescs: ["消费品牌西南区域总部与运营中心", "会计/法律/咨询等专业服务机构总部", "外资品牌成都办事处与商务代表处"] },
                { name: "专业市场", y: 28, desc: "特色专业批发与交易市场", items: ["通信数码市场", "服装批发集群", "建材家居市场"], itemDescs: ["太升路通信/数码/电子产品集散市场", "荷花池服装批发与设计师买手市场", "金沙/光华路建材家居一站式采购"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "商圈运营与数字化商贸",
              groups: [
                { name: "商圈运营", y: 44, desc: "核心商圈精细化运营管理", items: ["骡马市商圈", "金沙商圈", "光华商圈"], itemDescs: ["骡马市核心商圈品牌招商与业态升级", "金沙片区社区型商业综合体运营", "光华大道沿线新兴商业带运营"] },
                { name: "数字商贸", y: 56, desc: "商贸流通的数字化升级", items: ["直播电商基地", "社区团购平台", "智慧商圈系统"], itemDescs: ["青羊直播电商产业基地与MCN孵化", "社区生鲜与百货社群团购平台", "客流/支付/营销一体化智慧商圈"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "消费终端与商贸价值转化",
              groups: [
                { name: "消费终端", y: 70, desc: "面向居民和游客的终端消费", items: ["品质社区商业", "特色街区消费", "首店经济"], itemDescs: ["社区底商/邻里中心便民消费", "宽窄/泡桐树等特色街区购物消费", "首店/旗舰店/概念店品牌首发"] },
                { name: "价值指标", y: 82, desc: "商贸发展的量化效益指标", items: ["社零总额增速", "商圈坪效", "品牌密度"], itemDescs: ["社会消费品零售总额年均增速", "商圈单位面积销售额与租金回报", "每万人拥有品牌门店数量"] }
              ] }
          ]
        },
        "低空经济": {
          root: "低空应急与城市服务链",
          intro: "利用青羊航空产业优势，发展低空应急救援与城市管理服务，构建'飞行器制造-场景运营-服务变现'链条。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "低空飞行器研制与适航",
              groups: [
                { name: "飞行器研制", y: 16, desc: "面向城市场景的低空飞行器", items: ["应急救援无人机", "城管巡检无人机", "物流配送无人机"], itemDescs: ["大载荷应急救援/医疗物资投送无人机", "城市管理/违建巡查/河道监测专用机", "末端物流配送与即时配送无人机"] },
                { name: "适航认证", y: 28, desc: "低空飞行器准入与合规", items: ["型号适航取证", "运营资质审批", "飞行空域申请"], itemDescs: ["民航局无人机型号设计批准与生产许可", "通航/无人机运营企业资质与人员执照", "低空空域使用报备与动态空域申请"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "低空运营平台与服务保障",
              groups: [
                { name: "运营平台", y: 44, desc: "低空飞行的调度与管控平台", items: ["飞行调度中心", "空域监控系统", "气象保障服务"], itemDescs: ["区域低空飞行器统一调度指挥中心", "ADS-B/雷达/光电融合空域态势感知", "驻场气象站+精细化低空气象预报"] },
                { name: "地面保障", y: 56, desc: "低空飞行的地面配套设施", items: ["起降场建设", "充换电网络", "维修保障站"], itemDescs: ["社区/医院/商圈屋顶起降平台", "无人机标准化电池充换电站网络", "飞行器日常维保与应急抢修站点"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "低空服务场景与商业化",
              groups: [
                { name: "应用场景", y: 70, desc: "青羊低空经济的重点应用", items: ["医疗应急转运", "城市安防巡逻", "即时物流配送"], itemDescs: ["血液/器官/急救药品无人机快速转运", "重点区域/大型活动空中安防巡逻", "外卖/快递/生鲜30分钟无人机配送"] },
                { name: "商业价值", y: 82, desc: "低空服务的商业化运营效益", items: ["服务订单收入", "数据增值服务", "场景授权复制"], itemDescs: ["按次/包月计费的低空飞行服务收入", "飞行数据/城市感知数据增值服务", "成熟运营模式向其他城区授权输出"] }
              ] }
          ]
        }
      },
      "锦江区": {
        "航空航天": {
          root: "航空服务与贸易链",
          intro: "以航空租赁、航材贸易和MRO服务为核心，构建航空产业高端服务链条。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "航空金融与贸易基础",
              groups: [
                { name: "航空金融", y: 16, desc: "飞机租赁与航空资产管理", items: ["飞机经营性租赁", "航空保险服务", "航材融资担保"], itemDescs: ["干/支线飞机经营与融资租赁", "航空器/航空货运综合保险服务", "航材库存质押与应收账款保理"] },
                { name: "航材贸易", y: 28, desc: "航空零备件国际贸易", items: ["航材进出口贸易", "航空标准件分销", "二手航材交易"], itemDescs: ["OEM原厂航材代理与进出口报关", "航空标准件/消耗件区域分销中心", "适航件退役回收与再认证交易"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "航空维修与技术服务",
              groups: [
                { name: "MRO服务", y: 44, desc: "航空器维修与改装", items: ["发动机维修", "部件维修", "客改货改装"], itemDescs: ["CFM56/V2500等型号发动机大修", "APU/起落架/液压附件维修", "窄体机客改货结构改装与STC取证"] },
                { name: "技术支持", y: 56, desc: "航空技术咨询与培训", items: ["适航咨询服务", "航空培训中心", "技术出版物"], itemDescs: ["CAAC/FAA/EASA适航法规合规咨询", "航空维修/签派/安全管理培训", "维修手册/IPC/SB等技术文件编译"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "航空服务客户与价值输出",
              groups: [
                { name: "客户群体", y: 70, desc: "航空服务的终端客户", items: ["国内航空公司", "货运航空企业", "通航运营商"], itemDescs: ["国航/川航/成都航等基地航空公司", "顺丰航空/中货航等货运航空企业", "通航飞行/公务机运营与管理企业"] },
                { name: "价值输出", y: 82, desc: "航空服务链条的价值贡献", items: ["航空服务出口", "就业带动", "产业集聚效应"], itemDescs: ["MRO与航材贸易服务出口创汇", "高技能航空维修技术人才就业", "带动航空产业链上下游企业集聚"] }
              ] }
          ]
        },
        "金融": {
          root: "春熙路金融商贸链",
          intro: "以春熙路-IFS-太古里核心商圈为载体，打造'消费金融-财富管理-跨境支付'金融服务高地。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "金融机构集聚与科技基础",
              groups: [
                { name: "金融机构", y: 16, desc: "核心商圈金融机构总部集群", items: ["银行区域总部", "证券/基金公司", "消费金融公司"], itemDescs: ["股份制银行/城商行成都分行总部", "券商/公募基金/私募成都管理总部", "持牌消费金融与互联网小贷公司"] },
                { name: "金融科技", y: 28, desc: "金融服务的科技支撑", items: ["移动支付平台", "征信大数据", "智能投顾系统"], itemDescs: ["聚合支付/跨境支付技术服务商", "消费行为/商户经营大数据征信", "AI驱动的个人财富智能投顾"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "金融产品与财富管理服务",
              groups: [
                { name: "消费金融", y: 44, desc: "面向商圈消费的金融产品", items: ["商圈消费分期", "联名信用卡", "商户经营贷"], itemDescs: ["IFS/太古里大额消费免息分期", "银行×商场/品牌联名信用卡权益", "核心商圈商户流水贷与装修贷"] },
                { name: "财富管理", y: 56, desc: "高净值客户的财富管理", items: ["私人银行服务", "家族信托", "跨境资产配置"], itemDescs: ["高净值客户专属私人银行顾问", "家族财富传承与慈善信托服务", "境内外资产配置与跨境理财通"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "金融赋能商圈消费",
              groups: [
                { name: "消费场景", y: 70, desc: "金融服务落地的消费场景", items: ["奢侈品消费", "首店品牌消费", "跨境购物消费"], itemDescs: ["IFS/太古里奢侈品大额消费金融", "国际首店/旗舰店首发消费促进", "锦江跨境电商体验馆消费"] },
                { name: "金融生态", y: 82, desc: "商圈金融生态的综合效益", items: ["消费拉动效应", "金融税收贡献", "营商环境优化"], itemDescs: ["金融服务拉动社零总额增长5-8%", "金融业增加值与税收贡献", "便利化支付与融资提升营商便利度"] }
              ] }
          ]
        },
        "商务商贸": {
          root: "春熙路国际消费中心链",
          intro: "以国际消费中心城市核心承载区定位，打造'国际品牌-首店经济-数字商贸'高端商贸链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "国际品牌引进与商贸基础设施",
              groups: [
                { name: "品牌资源", y: 16, desc: "国际国内品牌引入与首发", items: ["国际奢侈品牌", "设计师品牌", "新锐国潮品牌"], itemDescs: ["LV/Gucci/Hermès等高奢品牌西南旗舰", "独立设计师品牌买手集合店", "中国李宁/观夏等国潮品牌概念店"] },
                { name: "商业载体", y: 28, desc: "高端商业综合体与特色街区", items: ["IFS/太古里", "兰桂坊商业街", "东大街金融城"], itemDescs: ["成都IFS/远洋太古里国际高端商业体", "意式风情兰桂坊餐饮娱乐商业街", "东大街沿线金融商务配套商业"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "商贸运营与消费升级服务",
              groups: [
                { name: "首店经济", y: 44, desc: "首店/旗舰店聚集运营", items: ["全球首店引进", "区域首发活动", "快闪店运营"], itemDescs: ["国际品牌中国/西南首店引进与运营", "新品首发/限量首售等营销活动", "品牌快闪店策划与短期运营"] },
                { name: "数字商贸", y: 56, desc: "线上线下融合的数字化商贸", items: ["直播电商", "跨境电商", "私域流量运营"], itemDescs: ["太古里/IFS品牌直播带货与探店", "跨境商品保税展示+线上下单", "商圈/品牌企微社群与小程序商城"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "消费体验与国际消费标杆",
              groups: [
                { name: "消费体验", y: 70, desc: "高品质消费体验场景", items: ["沉浸式购物", "美食消费地标", "社交娱乐消费"], itemDescs: ["AR试衣/智能导购/VIP专属服务", "太古里/镗钯街美食餐饮集群", "酒吧/演出/电影等社交娱乐业态"] },
                { name: "标杆价值", y: 82, desc: "春熙路商圈的标杆效应", items: ["国际消费知名度", "商圈辐射能力", "消费创新引领"], itemDescs: ["全球知名度与国际游客到访率", "辐射西南2亿人口的消费引力", "新零售/新消费模式创新策源地"] }
              ] }
          ]
        },
        "文化旅游": {
          root: "锦江文化旅游体验链",
          intro: "以锦江河畔夜游、大慈寺文化与春熙路商圈为核心，打造'文化体验-时尚消费-夜间经济'文旅链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "锦江文化资源与创意开发",
              groups: [
                { name: "文化资源", y: 16, desc: "锦江区核心文旅资源", items: ["大慈寺文化", "锦江河畔景观", "东门市井文化"], itemDescs: ["千年古刹大慈寺与佛教文化", "锦江沿岸生态景观与滨河步道", "东门码头市井生活文化与民俗"] },
                { name: "创意开发", y: 28, desc: "文旅IP创意设计与内容生产", items: ["时尚文化IP", "夜游创意设计", "美食文化策划"], itemDescs: ["太古里时尚潮流IP与跨界联名", "锦江夜游声光电沉浸式创意设计", "川菜美食文化体验活动策划"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "文旅产品运营与体验服务",
              groups: [
                { name: "核心产品", y: 44, desc: "锦江特色文旅体验产品", items: ["锦江夜游项目", "太古里潮流体验", "美食探店路线"], itemDescs: ["锦江游船+两岸光影秀夜游套票", "太古里潮牌巡游与艺术展览", "成都美食地图与主题探店体验线路"] },
                { name: "平台运营", y: 56, desc: "文旅内容平台与营销推广", items: ["社交媒体营销", "OTA平台运营", "会员积分体系"], itemDescs: ["抖音/小红书文旅内容种草与达人合作", "携程/美团景点门票与套票分销", "锦江文旅会员积分与权益运营"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "消费转化与品牌传播",
              groups: [
                { name: "消费场景", y: 70, desc: "文旅消费的核心终端场景", items: ["夜间消费", "时尚购物", "美食餐饮"], itemDescs: ["锦江夜游后的酒吧/夜市消费", "太古里/IFS高端购物与潮牌消费", "镗钯街/香槟广场特色餐饮集群"] },
                { name: "品牌效应", y: 82, desc: "锦江文旅品牌的传播价值", items: ["网红打卡效应", "国际城市营销", "文旅消费引力"], itemDescs: ["全国TOP网红打卡地标与社交传播", "国际旅游展/城市推介会品牌输出", "年游客量与人均消费拉动经济增长"] }
              ] }
          ]
        },
        "文旅": {
          root: "锦江时尚消费文旅链",
          intro: "以时尚消费体验为核心，将购物、餐饮、艺术、社交融为一体的现代都市文旅链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "时尚文化资源与内容创意",
              groups: [
                { name: "时尚资源", y: 16, desc: "国际时尚品牌与潮流文化", items: ["国际时装品牌", "独立设计师", "潮流艺术内容"], itemDescs: ["Dior/Prada等品牌西南首秀资源", "成都独立设计师品牌与工作室", "潮流艺术展/装置艺术/快闪秀"] },
                { name: "内容创意", y: 28, desc: "时尚内容生产与创意策划", items: ["时尚媒体内容", "KOL/达人资源", "活动创意策划"], itemDescs: ["时尚杂志/公众号/视频号内容产出", "时尚/美妆/生活方式类头部达人", "品牌发布会/时装周/艺术展策划"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "时尚体验产品与商业运营",
              groups: [
                { name: "体验项目", y: 44, desc: "面向都市消费者的时尚体验", items: ["品牌快闪活动", "艺术展览体验", "美食社交活动"], itemDescs: ["限时品牌快闪店与互动体验", "IFS艺术馆/太古里展览空间策展", "主题晚宴/品酒会/下午茶社交活动"] },
                { name: "商业生态", y: 56, desc: "时尚消费的商业运营生态", items: ["买手集合店", "设计师品牌店", "生活方式店"], itemDescs: ["精选国际/国内设计师品牌买手店", "原创设计师品牌独立门店与showroom", "香薰/花艺/家居等生活方式概念店"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "时尚消费与社交传播",
              groups: [
                { name: "消费场景", y: 70, desc: "时尚消费的终端场景", items: ["奢侈品购物", "潮牌消费", "餐饮娱乐"], itemDescs: ["IFS/太古里高端奢侈品购物", "潮牌联名/限量发售/球鞋消费", "精品咖啡/清吧/LiveHouse消费"] },
                { name: "传播价值", y: 82, desc: "时尚消费的社交传播效益", items: ["社交裂变传播", "时尚城市标签", "消费趋势引领"], itemDescs: ["朋友圈/小红书/抖音打卡自传播", "成都'时尚之都'城市品牌标签", "引领西南消费趋势与生活方式"] }
              ] }
          ]
        },
        "人工智能": {
          root: "AI+智慧商业服务链",
          intro: "以AI技术赋能商圈运营、消费洞察与精准营销，打造智慧商业与数字消费标杆。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "商业AI数据与技术底座",
              groups: [
                { name: "商业数据", y: 16, desc: "商圈消费行为大数据", items: ["客流感知数据", "消费行为数据", "商户经营数据"], itemDescs: ["商圈/楼层/店铺级客流计数与热力图", "支付/搜索/浏览/停留等消费行为数据", "POS/库存/坪效/品类结构经营数据"] },
                { name: "AI能力", y: 28, desc: "商业场景AI技术能力", items: ["计算机视觉", "NLP对话引擎", "推荐算法"], itemDescs: ["人脸识别/客流分析/商品识别", "智能客服/导购对话与语义理解", "个性化商品/店铺/活动推荐引擎"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "AI商业应用产品与平台",
              groups: [
                { name: "智慧营销", y: 44, desc: "AI驱动的精准营销", items: ["AI精准推荐", "智能广告投放", "会员智能运营"], itemDescs: ["基于用户画像的千人千面商品推荐", "AI优化投放渠道/时段/素材/出价", "RFM模型驱动的会员生命周期管理"] },
                { name: "智慧运营", y: 56, desc: "商圈智慧化运营管理", items: ["智能客流调度", "AI选品/选址", "智慧物业管理"], itemDescs: ["根据预测客流动态调整运营策略", "AI分析最优品类组合与铺位配置", "智能安防/能耗/停车物业管理"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "AI商业落地与消费升级",
              groups: [
                { name: "消费体验", y: 70, desc: "AI提升的消费体验", items: ["AI导购助手", "虚拟试穿试用", "无感支付"], itemDescs: ["大模型驱动的智能购物助手", "AR试衣/试妆/家居预览体验", "刷脸支付/无感结算/自助收银"] },
                { name: "商业效益", y: 82, desc: "AI赋能的商业价值提升", items: ["转化率提升", "营销ROI优化", "运营成本降低"], itemDescs: ["精准推荐提升进店-下单转化率20%+", "AI投放优化营销费用ROI提升30%+", "智能运营降低人力/能耗成本15%+"] }
              ] }
          ]
        },
        "低空经济": {
          root: "低空城市配送服务链",
          intro: "以核心商圈即时配送需求为起点，构建低空城市末端配送与商圈空中服务网络。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "配送型飞行器与基础设施",
              groups: [
                { name: "配送飞行器", y: 16, desc: "城市末端配送专用无人机", items: ["外卖配送无人机", "快递配送无人机", "医药紧急配送机"], itemDescs: ["3-5kg载荷/15分钟送达外卖配送无人机", "5-10kg标准快递箱末端配送无人机", "血液/药品/检验样本紧急冷链配送"] },
                { name: "基础设施", y: 28, desc: "城市低空配送的地面设施", items: ["楼顶起降台", "智能储柜", "充电中继站"], itemDescs: ["商圈/写字楼/社区屋顶无人机起降台", "无人机自动投递与用户取件智能柜", "航线沿途电池充换电中继站点"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "配送调度平台与运营",
              groups: [
                { name: "调度平台", y: 44, desc: "无人机配送订单调度", items: ["订单智能匹配", "航线实时规划", "异常处理系统"], itemDescs: ["外卖/快递订单与飞行器智能匹配", "动态避障与实时最优航线规划", "风速超限/电量不足/空域冲突处理"] },
                { name: "运营服务", y: 56, desc: "无人机配送的日常运营", items: ["飞行器运维", "安全巡检", "客户服务"], itemDescs: ["无人机日常维护/电池管理/故障修复", "航线安全巡检与起降台设施检查", "配送时效/包裹完好/投诉处理服务"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "配送场景与即时消费",
              groups: [
                { name: "配送场景", y: 70, desc: "低空配送的终端场景", items: ["商圈外卖配送", "快递最后一公里", "医疗应急配送"], itemDescs: ["春熙路/太古里商圈外卖空中速递", "写字楼/小区快递无人机上门投递", "医院间血液/样本/药品紧急空中转运"] },
                { name: "服务效益", y: 82, desc: "低空配送的商业效益", items: ["配送时效提升", "人力成本节省", "服务覆盖扩展"], itemDescs: ["平均配送时间从30分钟降至10分钟", "替代骑手成本降低40-60%", "扩展至拥堵区域与高层楼宇配送"] }
              ] }
          ]
        }
      },
      "武侯区": {
        "航空航天": {
          root: "航空电子与集成服务链",
          intro: "聚焦航电系统、飞控软件与航空配套电子设备，打造航空电子研发与集成服务产业集群。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "航空电子核心器件与软件",
              groups: [
                { name: "核心器件", y: 16, desc: "航空电子关键元器件", items: ["航空SoC芯片", "惯性导航模组", "航空连接器"], itemDescs: ["航空级抗辐射SoC与FPGA芯片", "光纤/MEMS惯性导航组合模组", "高可靠射频/光纤/电源连接器"] },
                { name: "飞控软件", y: 28, desc: "航空飞行控制与管理软件", items: ["飞控律算法", "航电综合管理", "嵌入式操作系统"], itemDescs: ["高可靠冗余飞控律与自主控制算法", "座舱显控/告警/记录综合航电软件", "DO-178C适航等级嵌入式RTOS"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "航电系统集成与测试",
              groups: [
                { name: "系统集成", y: 44, desc: "航电子系统集成与交付", items: ["综合航电系统", "通信导航系统", "任务管理系统"], itemDescs: ["座舱显控/HUD/多功能显示器系统集成", "VHF/UHF/数据链/卫星通信集成", "任务规划/态势感知/协同系统集成"] },
                { name: "测试验证", y: 56, desc: "航电设备的测试与鉴定", items: ["半实物仿真", "EMC测试", "环境适应性试验"], itemDescs: ["铁鸟/综合航电半实物仿真验证", "电磁兼容/HI测试与频谱管理", "高低温/振动/盐雾等环境适应性"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "航电产品交付与技术服务",
              groups: [
                { name: "客户交付", y: 70, desc: "航电设备的终端交付", items: ["军机航电配套", "民机航电升级", "无人机航电套件"], itemDescs: ["军用战斗机/运输机航电系统配套", "民航飞机航电改装与升级换代", "无人机飞控+航电+通信一体化套件"] },
                { name: "技术服务", y: 82, desc: "航电全生命周期技术支持", items: ["软件维护升级", "现场技术支持", "培训与文档"], itemDescs: ["飞控/航电软件迭代与补丁维护", "交付后现场安装调试与技术保障", "操作/维修培训体系与技术出版物"] }
              ] }
          ]
        },
        "人工智能": {
          root: "AI+电子信息融合链",
          intro: "以AI芯片、智能终端和工业软件为核心，构建'芯片-算法-终端-场景'全链条AI产业生态。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "AI芯片与基础算力层",
              groups: [
                { name: "AI芯片", y: 16, desc: "人工智能专用芯片设计与制造", items: ["AI训练芯片设计", "AI推理芯片设计", "存算一体芯片"], itemDescs: ["大规模并行计算GPU/NPU架构设计", "低功耗高能效边缘推理芯片设计", "近存计算/存内计算新型AI芯片"] },
                { name: "数据服务", y: 28, desc: "AI训练数据与标注服务", items: ["多模态数据采集", "专业数据标注", "合成数据生成"], itemDescs: ["图像/语音/文本/传感器多模态采集", "医疗/制造/自动驾驶领域专业标注", "GAN/扩散模型合成训练数据增强"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "AI算法与智能终端产品",
              groups: [
                { name: "算法平台", y: 44, desc: "可落地的AI算法与模型产品", items: ["视觉AI算法", "语音AI算法", "行业大模型"], itemDescs: ["目标检测/图像分割/OCR等视觉算法", "语音识别/合成/唤醒/降噪等算法", "工业/医疗/金融等垂直行业大模型"] },
                { name: "智能终端", y: 56, desc: "AI赋能的智能终端产品", items: ["智能安防终端", "工业视觉终端", "智能交互终端"], itemDescs: ["AI摄像头/智能门禁/人脸识别终端", "缺陷检测/尺寸测量/分拣机器人", "智能音箱/教育机器人/智能穿戴"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "AI行业应用与智能化落地",
              groups: [
                { name: "应用场景", y: 70, desc: "AI技术的重点垂直应用", items: ["智慧城市", "智能制造", "智慧医疗"], itemDescs: ["城市大脑/交通治理/应急指挥", "工业质检/预测维护/智能排产", "影像辅助诊断/药物发现/健康管理"] },
                { name: "产业效益", y: 82, desc: "AI产业的可量化效益", items: ["产值规模增长", "企业聚集效应", "人才吸引力"], itemDescs: ["AI核心产业年产值增速30%+", "AI企业数量与上下游配套完整度", "全国TOP AI人才流入与高校合作"] }
              ] }
          ]
        },
        "金融": {
          root: "科技金融服务链",
          intro: "面向武侯区高科技企业集群，构建'天使投资-风险投资-信贷+担保-上市服务'全生命周期科技金融链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "科技金融基础与投资生态",
              groups: [
                { name: "投资生态", y: 16, desc: "面向科技企业的投资机构集群", items: ["天使投资/孵化", "VC/PE基金", "政府引导基金"], itemDescs: ["天使投资人/早期孵化基金", "头部风投/成长期私募股权基金", "区级科技成果转化引导基金"] },
                { name: "科技信贷", y: 28, desc: "科技企业专属信贷产品", items: ["知识产权质押", "研发费用贷", "科技担保增信"], itemDescs: ["专利权/软著质押的科技企业贷款", "以研发投入为基准的纯信用贷款", "政策性科技融资担保与风险补偿"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "科技金融服务与产品",
              groups: [
                { name: "融资服务", y: 44, desc: "科技企业融资对接服务", items: ["投融资路演", "并购顾问", "上市辅导"], itemDescs: ["定期科技项目路演与投资人对接", "科技企业并购/重组/战投顾问", "IPO/北交所/科创板上市辅导服务"] },
                { name: "风控服务", y: 56, desc: "科技金融专项风控", items: ["技术尽调服务", "知识产权评估", "科技企业征信"], itemDescs: ["技术路线/团队/市场的专业尽职调查", "专利组合/技术壁垒/商业化潜力评估", "科技企业专属信用评分与画像"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "科技金融价值实现",
              groups: [
                { name: "服务对象", y: 70, desc: "科技金融的终端客户", items: ["高新技术企业", "专精特新企业", "科技型中小企业"], itemDescs: ["国家级高新技术认定企业", "工信部专精特新'小巨人'企业", "科技型中小企业评价入库企业"] },
                { name: "产业效果", y: 82, desc: "科技金融的产业催化效应", items: ["企业成长提速", "创新成果转化", "上市企业培育"], itemDescs: ["融资支持推动企业营收年增30%+", "金融催化加速专利技术产品化", "培育上市/拟上市科技企业梯队"] }
              ] }
          ]
        },
        "商务商贸": {
          root: "科技商务服务链",
          intro: "以科技企业服务需求为牵引，构建'共享办公-企业服务-科技商贸'专业化服务链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "科技商务载体与服务资源",
              groups: [
                { name: "办公载体", y: 16, desc: "高品质科技办公空间", items: ["甲级写字楼", "共享办公空间", "产业加速器"], itemDescs: ["天府大道沿线甲级商务写字楼", "WeWork/氪空间等共享办公品牌", "专业方向产业加速器与孵化器"] },
                { name: "服务机构", y: 28, desc: "科技企业服务专业机构", items: ["知识产权代理", "科技咨询公司", "人才猎头机构"], itemDescs: ["专利/商标/版权代理与诉讼服务", "科技战略咨询/技术转移服务", "中高端科技人才猎聘与RPO服务"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "企业服务与科技商贸",
              groups: [
                { name: "企业服务", y: 44, desc: "一站式企业运营服务", items: ["财税代理服务", "法律合规服务", "政策申报服务"], itemDescs: ["代理记账/税筹/审计/工商变更", "合同审查/股权架构/劳动法务", "高企认定/项目申报/资质办理"] },
                { name: "科技商贸", y: 56, desc: "科技产品与服务交易", items: ["技术交易平台", "科技设备采购", "SaaS软件集市"], itemDescs: ["技术成果/专利许可线上交易平台", "实验设备/测试仪器集中采购", "企业级SaaS/PaaS软件订阅市场"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "科技商务生态价值",
              groups: [
                { name: "服务对象", y: 70, desc: "科技商务服务的客户群", items: ["初创科技企业", "成长期企业", "跨国科技公司"], itemDescs: ["种子期/天使期科技初创企业", "A轮-C轮高速成长科技企业", "外资科技公司成都研发中心"] },
                { name: "生态效益", y: 82, desc: "科技商务的生态聚集效应", items: ["产业链完整度", "服务效率提升", "区域品牌价值"], itemDescs: ["科技企业全生命周期服务配套率", "办事效率/服务响应/审批时效提升", "武侯科技商务服务区域品牌影响力"] }
              ] }
          ]
        },
        "低空经济": {
          root: "低空智能感知与数据链",
          intro: "以AI+低空无人机感知系统为核心，发展城市感知网络、数据采集与智慧应用。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "智能感知载荷与通信系统",
              groups: [
                { name: "感知载荷", y: 16, desc: "无人机搭载的智能感知设备", items: ["多光谱感知载荷", "激光雷达系统", "AI边缘计算盒"], itemDescs: ["可见光+红外+多光谱融合感知相机", "固态/机械式激光雷达三维扫描", "机载AI推理盒实现在飞实时分析"] },
                { name: "通信系统", y: 28, desc: "无人机数据传输与通信链", items: ["5G图传模组", "卫星中继链路", "自组网系统"], itemDescs: ["5G低延迟高清图传与控制链路", "北斗+铱星/天通卫星中继数据回传", "多机编队Mesh自组网与协同通信"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "空中数据采集与AI处理",
              groups: [
                { name: "数据采集", y: 44, desc: "低空无人机数据采集服务", items: ["城市三维测绘", "环境监测采集", "基础设施巡检"], itemDescs: ["城市建筑/道路/管网三维点云测绘", "大气/水质/噪声空间分布采集", "桥梁/电力/管道缺陷影像采集"] },
                { name: "AI处理", y: 56, desc: "空中采集数据的AI分析", items: ["影像AI分析", "点云数据处理", "城市数字孪生"], itemDescs: ["缺陷识别/变化检测/目标提取", "点云配准/分类/建模自动化处理", "无人机数据驱动的城市数字孪生更新"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "感知数据的城市智慧应用",
              groups: [
                { name: "应用场景", y: 70, desc: "低空感知数据的行业应用", items: ["城市规划辅助", "灾害应急响应", "生态环境监管"], itemDescs: ["三维城市模型辅助城市规划决策", "灾后快速三维建模与损失评估", "河湖巡查/绿地监测/空气质量监控"] },
                { name: "数据价值", y: 82, desc: "低空数据的商业价值", items: ["数据服务订阅", "分析报告服务", "平台数据交易"], itemDescs: ["定期城市影像更新与数据订阅服务", "行业专项巡检分析与风险报告", "脱敏城市数据在数据交易所挂牌"] }
              ] }
          ]
        },
        "文化旅游": {
          root: "武侯三国文化旅游链",
          intro: "以武侯祠-锦里为核心，打造三国文化深度体验与现代消费融合的特色文旅产业链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "三国文化资源挖掘与开发",
              groups: [
                { name: "文化资源", y: 16, desc: "武侯区独有的三国文化遗产", items: ["武侯祠博物馆", "锦里古街", "三国文化遗址群"], itemDescs: ["全国唯一君臣合祀祠庙与三国文物", "仿古蜀商业街与民俗文化体验", "诸葛亮/刘备/关羽相关遗址与传说"] },
                { name: "内容创作", y: 28, desc: "三国文化的现代内容转化", items: ["三国IP开发", "影视/游戏授权", "学术研究出版"], itemDescs: ["三国人物/故事/场景IP形象开发", "三国题材影视剧/手游/桌游授权", "三国文化学术研究与文创出版物"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "三国文旅产品与运营",
              groups: [
                { name: "体验产品", y: 44, desc: "沉浸式三国文化体验产品", items: ["三国沉浸式演出", "武侯研学课程", "三国主题密室"], itemDescs: ["'蜀相'大型实景演出与光影秀", "三国历史/军事/策略研学体验", "三国剧情沉浸式密室与角色扮演"] },
                { name: "文创运营", y: 56, desc: "三国IP文创产品运营", items: ["三国主题文创", "锦里美食运营", "数字三国藏品"], itemDescs: ["诸葛扇/兵法竹简等三国主题文创", "锦里三国主题美食与川味小吃", "三国人物/兵器/场景数字藏品"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "文旅消费与三国文化品牌",
              groups: [
                { name: "消费场景", y: 70, desc: "三国文旅核心消费场景", items: ["武侯祠景区消费", "锦里夜间消费", "周边酒店住宿"], itemDescs: ["门票+文创+餐饮景区综合消费", "锦里夜市/酒吧/演艺夜间消费", "三国主题酒店与周边民宿"] },
                { name: "品牌价值", y: 82, desc: "三国文化旅游的品牌效应", items: ["三国文化名片", "国际文化旅游", "IP授权收入"], itemDescs: ["全球三国文化第一目的地品牌", "东亚/东南亚三国文化旅游吸引力", "三国IP授权与文创版权收入"] }
              ] }
          ]
        },
        "文旅": {
          root: "锦里民俗体验链",
          intro: "以锦里古街为核心，串联武侯祠、耍都等资源，打造'民俗体验-美食消费-夜间经济'特色文旅链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "民俗文化资源与内容创意",
              groups: [
                { name: "民俗资源", y: 16, desc: "锦里片区的民俗文化资源", items: ["川西民俗文化", "传统手工技艺", "川味美食文化"], itemDescs: ["川西婚俗/节庆/庙会等民俗活动", "蜀绣/竹编/糖画等非遗手工艺", "川菜/小吃/茶饮等饮食文化"] },
                { name: "内容创意", y: 28, desc: "民俗文化内容的创意包装", items: ["民俗IP设计", "美食内容策划", "互动体验设计"], itemDescs: ["锦里民俗形象/视觉系统设计", "川味美食探店/制作体验内容", "民俗互动体验游戏与装置设计"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "民俗体验与美食消费运营",
              groups: [
                { name: "体验项目", y: 44, desc: "面向游客的民俗体验项目", items: ["手工艺体验", "美食制作体验", "民俗表演观赏"], itemDescs: ["蜀绣/竹编/糖画DIY手作体验", "川菜/小吃/茶艺现场制作体验", "川剧变脸/皮影戏/民乐现场表演"] },
                { name: "商业运营", y: 56, desc: "锦里商业的精细化运营", items: ["特色美食集群", "手工艺品店铺", "主题住宿运营"], itemDescs: ["龙抄手/赖汤圆/钟水饺等老字号", "非遗手作/蜀绣/银饰等特色店铺", "川西院落民宿与主题客栈"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "消费转化与夜间经济",
              groups: [
                { name: "消费场景", y: 70, desc: "锦里核心消费场景", items: ["美食消费", "伴手礼消费", "夜间消费"], itemDescs: ["小吃/正餐/茶饮等餐饮消费", "手工艺品/特产/文创伴手礼", "锦里夜市/耍都酒吧街夜间消费"] },
                { name: "品牌效应", y: 82, desc: "锦里民俗文旅的品牌价值", items: ["民俗文旅地标", "美食城市标签", "复访率与口碑"], itemDescs: ["全国知名民俗文化旅游目的地", "'美食之都'城市品牌核心承载地", "游客复访意愿与线上好评率"] }
              ] }
          ]
        }
      },
      "成华区": {
        "航空航天": {
          root: "航空零部件智造服务链",
          intro: "以成华装备制造基础为依托，发展航空零部件智能制造与再制造服务。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "智能制造装备与工艺研发",
              groups: [
                { name: "智造装备", y: 16, desc: "航空零部件智能制造装备", items: ["智能数控机床", "增材制造设备", "自动化产线"], itemDescs: ["高精度五轴/车铣复合智能机床", "金属3D打印/激光熔覆增材设备", "航空零部件柔性自动化产线"] },
                { name: "工艺研发", y: 28, desc: "先进制造工艺开发与验证", items: ["特种加工工艺", "表面工程技术", "智能检测工艺"], itemDescs: ["电火花/超声/激光等特种加工", "热喷涂/PVD镀膜/化学处理", "在线测量/AI视觉/X射线检测"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "航空零部件智能生产制造",
              groups: [
                { name: "精密零件", y: 44, desc: "航空精密机械零件制造", items: ["涡轮叶片制造", "精密齿轮箱", "液压阀体加工"], itemDescs: ["单晶/定向凝固涡轮叶片精铸+磨削", "航空减速器/传动齿轮箱精加工", "液压伺服阀体多轴精密加工"] },
                { name: "再制造", y: 56, desc: "航空零部件再制造与修复", items: ["叶片修复再制造", "起落架翻修", "附件大修"], itemDescs: ["激光熔覆/热等静压叶片修复", "起落架金属件修复/镀铬/无损检测", "液压泵/发电机/启动机等附件大修"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "制造服务交付与产业辐射",
              groups: [
                { name: "交付服务", y: 70, desc: "零部件制造的交付物流", items: ["精密包装运输", "供应链协同", "技术伴随服务"], itemDescs: ["航空件特种包装/恒温恒湿运输", "与主机厂JIT供应链协同管理", "驻厂技术代表与售后技术支持"] },
                { name: "产业效益", y: 82, desc: "航空智造产业的带动效应", items: ["产值规模增长", "技术溢出效应", "就业带动"], itemDescs: ["航空零部件制造产值年增15%+", "航空工艺向汽车/医疗等领域溢出", "高技能数控/焊接/检测人才就业"] }
              ] }
          ]
        },
        "人工智能": {
          root: "AI+数字媒体产业链",
          intro: "以AI内容生成、数字媒体与工业互联网为核心，构建AI与数字经济融合发展产业链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "AI内容生成技术与数据基础",
              groups: [
                { name: "AIGC技术", y: 16, desc: "AI内容生成核心技术", items: ["文本生成模型", "图像/视频生成", "3D内容生成"], itemDescs: ["中文大语言模型与文案自动生成", "AI绘画/视频生成/风格迁移模型", "NeRF/3D Gaussian Splatting场景生成"] },
                { name: "数据平台", y: 28, desc: "数字媒体数据与算力平台", items: ["媒体素材库", "渲染算力池", "版权管理平台"], itemDescs: ["视频/图像/音频/3D素材数据库", "云端GPU渲染与实时预览算力", "AI生成内容版权确权与交易平台"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "数字内容生产与工业应用",
              groups: [
                { name: "数字内容", y: 44, desc: "AI辅助的数字内容生产", items: ["短视频智能生产", "虚拟主播/数字人", "游戏AI内容"], itemDescs: ["AI脚本/剪辑/配音的短视频批量生产", "AI驱动的虚拟主播与数字人直播", "AI生成游戏关卡/角色/对话内容"] },
                { name: "工业应用", y: 56, desc: "AI+工业互联网应用", items: ["设备预测维护", "生产智能排程", "供应链AI优化"], itemDescs: ["传感器数据驱动的设备故障预测", "AI产能规划与多目标排程优化", "需求预测/库存优化/物流路径规划"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "AI内容与工业赋能落地",
              groups: [
                { name: "应用场景", y: 70, desc: "AI+数字媒体的应用场景", items: ["直播电商", "数字文创", "智慧工厂"], itemDescs: ["AI虚拟主播+智能客服的直播电商", "AI生成数字藏品/虚拟展览/互动体验", "AI视觉质检+数字孪生智慧工厂"] },
                { name: "产业效益", y: 82, desc: "AI数字经济的产业价值", items: ["内容产业增长", "降本增效", "新业态孵化"], itemDescs: ["AI加速内容生产效率提升10倍+", "工业AI降低运维成本20-30%", "AI催生虚拟偶像/数字人等新业态"] }
              ] }
          ]
        },
        "金融": {
          root: "产业金融与供应链金融链",
          intro: "面向成华区制造业集群，构建'设备融资-供应链金融-产业基金'特色产业金融服务链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "产业金融基础与资金来源",
              groups: [
                { name: "资金来源", y: 16, desc: "产业金融的资金供给渠道", items: ["产业发展基金", "设备融资租赁", "银行产业授信"], itemDescs: ["区级/市级产业发展引导基金", "大型制造设备经营/融资租赁", "银行对制造业的专项信贷额度"] },
                { name: "风控体系", y: 28, desc: "产业金融的风险管控", items: ["动产质押监管", "供应链核验", "产业链评估"], itemDescs: ["库存/设备/原材料动产质押与监管", "核心企业应收/应付账款真实性核验", "产业链上下游联动的信用评估体系"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "供应链金融产品与服务",
              groups: [
                { name: "融资产品", y: 44, desc: "面向制造企业的金融产品", items: ["订单融资", "库存质押贷", "保理融资"], itemDescs: ["以核心企业订单为凭的融资服务", "原材料/成品库存质押短期借款", "应收账款买断/回购保理服务"] },
                { name: "增值服务", y: 56, desc: "产业金融的增值服务", items: ["财务顾问", "上市培育", "并购撮合"], itemDescs: ["制造企业财务管理与融资规划顾问", "规上企业IPO规范化辅导与培育", "产业链上下游并购整合撮合服务"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "产业金融价值与效果",
              groups: [
                { name: "服务对象", y: 70, desc: "产业金融的核心客户群", items: ["规上制造企业", "供应链中小企业", "产业园区企业"], itemDescs: ["规模以上装备/电子/食品制造企业", "核心企业上游供应商与下游经销商", "成华产业园区内入驻生产型企业"] },
                { name: "产业效果", y: 82, desc: "产业金融的宏观效益", items: ["融资覆盖率", "供应链稳定性", "产业投资增速"], itemDescs: ["产业链企业融资可得性与覆盖率提升", "供应链金融保障链条资金流稳定", "金融撬动产业固定资产投资年增15%+"] }
              ] }
          ]
        },
        "商务商贸": {
          root: "东郊工业商贸服务链",
          intro: "以东郊记忆文创区和建设路商圈为核心，打造'工业文创-社区商业-数字零售'多层级商贸链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "工业遗产活化与商贸资源",
              groups: [
                { name: "工业遗产", y: 16, desc: "东郊工业遗产的创意活化", items: ["东郊记忆文创区", "工业厂房改造", "创意办公空间"], itemDescs: ["原红光电子管厂改造的文创产业园区", "老旧厂房→文创/展演/商业复合空间", "LOFT风格创意办公与联合办公空间"] },
                { name: "商圈资源", y: 28, desc: "成华区域核心商圈资源", items: ["建设路商圈", "龙潭商业区", "社区商业网络"], itemDescs: ["建设路-猛追湾传统核心商圈", "龙潭寺片区新兴大型商业集聚", "居住片区社区底商与便民商业"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "文创商贸运营与数字零售",
              groups: [
                { name: "文创商贸", y: 44, desc: "工业文创园区商业运营", items: ["音乐产业链", "创意市集运营", "文创品牌孵化"], itemDescs: ["录音棚/演出场/音乐培训产业闭环", "周末创意市集/美食市集定期举办", "文创品牌入驻孵化与渠道对接"] },
                { name: "数字零售", y: 56, desc: "社区商业的数字化升级", items: ["社区团购", "即时零售", "智慧菜市场"], itemDescs: ["社区生鲜/百货社群团购运营", "30分钟达即时零售与到家服务", "传统菜市场智慧化改造与数字运营"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "消费终端与社区商业价值",
              groups: [
                { name: "消费终端", y: 70, desc: "成华区消费终端场景", items: ["文创消费空间", "社区生活消费", "夜间消费经济"], itemDescs: ["东郊记忆文创商店/展览/演出消费", "便利店/生鲜店/社区服务中心消费", "建设路夜市/望平街夜间消费"] },
                { name: "商贸指标", y: 82, desc: "商贸发展的效果指标", items: ["社零增速", "首店落地数", "商业数字化率"], itemDescs: ["社会消费品零售总额年均增速", "年度引进首店/旗舰店/概念店数量", "商户数字化工具使用率与线上化率"] }
              ] }
          ]
        },
        "低空经济": {
          root: "低空工业巡检服务链",
          intro: "结合成华工业基础，发展面向工厂/工地/基建的低空巡检与测绘服务链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "工业巡检飞行器与载荷",
              groups: [
                { name: "巡检飞行器", y: 16, desc: "面向工业场景的专业无人机", items: ["工业巡检无人机", "测绘测量无人机", "应急指挥无人机"], itemDescs: ["防爆/防尘/抗风工业级巡检无人机", "RTK高精度测量与倾斜摄影无人机", "4G/5G图传应急现场指挥无人机"] },
                { name: "专业载荷", y: 28, desc: "工业巡检专用载荷设备", items: ["红外热成像", "气体检测传感器", "高精度相机"], itemDescs: ["设备温度异常/漏热/过热检测", "VOC/CH4/CO等有害气体浓度检测", "1亿像素+高分辨率工业检测相机"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "巡检数据采集与AI分析",
              groups: [
                { name: "巡检服务", y: 44, desc: "无人机工业巡检作业", items: ["电力线路巡检", "建设工地巡查", "管道设施巡检"], itemDescs: ["高压线路/杆塔/绝缘子缺陷巡检", "工地进度监测/安全隐患/违建巡查", "油气/水务管道泄漏与安全巡检"] },
                { name: "数据分析", y: 56, desc: "巡检数据的AI处理与报告", items: ["缺陷AI识别", "三维建模分析", "趋势预警报告"], itemDescs: ["AI视觉自动识别缺陷并标注等级", "点云/正射影像三维建模与量算", "周期性巡检数据对比与劣化趋势预警"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "巡检服务的行业应用",
              groups: [
                { name: "应用行业", y: 70, desc: "低空巡检的行业客户", items: ["电网/能源企业", "建筑/市政工程", "化工/制造企业"], itemDescs: ["国网/南网/中石油等能源央企", "建筑施工/市政管养/房建工程", "化工园区/大型制造工厂安全巡检"] },
                { name: "服务效益", y: 82, desc: "低空巡检的服务价值", items: ["巡检效率提升", "安全事故降低", "维护成本优化"], itemDescs: ["无人机巡检效率是人工的5-10倍", "早期隐患发现减少安全事故50%+", "精准定位故障降低维修维护成本30%+"] }
              ] }
          ]
        },
        "文化旅游": {
          root: "东郊文创旅游链",
          intro: "以东郊记忆国家音乐产业基地为核心，打造'工业遗产+音乐文创+潮流消费'新型文旅产业链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "工业遗产与音乐文化资源",
              groups: [
                { name: "工业遗产", y: 16, desc: "成华工业遗存的文化价值", items: ["东郊记忆园区", "工业建筑遗存", "红色工业文化"], itemDescs: ["国家音乐产业基地·东郊记忆", "苏式工业厂房与烟囱等标志建筑", "三线建设/420厂等红色工业记忆"] },
                { name: "音乐产业", y: 28, desc: "音乐产业链上游资源", items: ["原创音乐团队", "录音制作工坊", "音乐版权资源"], itemDescs: ["独立音乐人/乐队/制作人集群", "专业录音棚/混音/母带制作工坊", "原创音乐版权库与授权管理"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "文创体验产品与音乐运营",
              groups: [
                { name: "文创体验", y: 44, desc: "工业遗产活化的文创体验", items: ["工业遗址参观", "文创展览策展", "手作体验工坊"], itemDescs: ["工业遗产导览与城市记忆展", "当代艺术/摄影/设计主题展览", "陶艺/版画/木工等手作体验"] },
                { name: "音乐演出", y: 56, desc: "音乐演出与活动运营", items: ["LiveHouse演出", "音乐节/音乐会", "音乐培训教育"], itemDescs: ["小型Live演出场馆日常运营", "草莓/简单生活等音乐节举办", "乐器/声乐/DJ培训与音乐课程"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "潮流消费与文创品牌输出",
              groups: [
                { name: "消费场景", y: 70, desc: "东郊文创区的核心消费场景", items: ["音乐消费", "潮流消费", "餐饮消费"], itemDescs: ["演出门票/唱片/音乐周边消费", "独立设计/潮牌/二手古着消费", "精品咖啡/精酿啤酒/创意料理"] },
                { name: "品牌价值", y: 82, desc: "东郊文创旅游的品牌效应", items: ["音乐地标品牌", "青年文化引力", "文创IP输出"], itemDescs: ["西南音乐文化地标品牌认知度", "18-35岁青年群体的城市文化吸引力", "东郊文创IP的授权与异地复制"] }
              ] }
          ]
        },
        "文旅": {
          root: "成华潮流夜生活链",
          intro: "以建设路夜市、望平街为核心，打造'美食夜市-潮流社交-数字娱乐'年轻化夜生活文旅链。",
          stages: [
            { name: "上游", tone: "cyan", y: 26, desc: "夜间消费资源与内容创意",
              groups: [
                { name: "夜间资源", y: 16, desc: "成华夜间消费核心资源", items: ["建设路美食街", "望平滨河街区", "猛追湾文创区"], itemDescs: ["建设路网红美食街与深夜食堂", "望平街滨河酒吧/咖啡/文创街区", "猛追湾市井文化与怀旧文创"] },
                { name: "创意内容", y: 28, desc: "夜间经济内容创意", items: ["美食内容IP", "夜游创意设计", "潮流活动策划"], itemDescs: ["建设路美食探店/测评/排行内容", "望平街灯光秀与沉浸式夜游设计", "音乐/脱口秀/市集等夜间活动"] }
              ] },
            { name: "中游", tone: "green", y: 50, desc: "夜间消费运营与体验",
              groups: [
                { name: "消费运营", y: 44, desc: "夜间消费业态运营管理", items: ["美食街运营", "酒吧街运营", "夜间市集运营"], itemDescs: ["美食摊位招商/卫生/秩序管理", "主题酒吧/清吧/LiveHouse运营", "周末夜间创意市集策划与执行"] },
                { name: "数字娱乐", y: 56, desc: "数字化夜间娱乐体验", items: ["电竞娱乐", "沉浸式娱乐", "社交聚会空间"], itemDescs: ["电竞馆/VR体验馆/桌游吧", "剧本杀/密室/沉浸式戏剧体验", "轰趴馆/KTV/私人影院社交空间"] }
              ] },
            { name: "下游", tone: "orange", y: 74, desc: "夜间经济消费与品牌效应",
              groups: [
                { name: "消费热点", y: 70, desc: "成华夜间消费热点", items: ["深夜美食消费", "微醺社交消费", "娱乐休闲消费"], itemDescs: ["火锅/串串/烧烤等深夜美食消费", "清吧/精酿/鸡尾酒微醺社交消费", "电竞/桌游/密室等休闲娱乐消费"] },
                { name: "品牌效应", y: 82, desc: "成华夜生活的城市品牌", items: ["夜生活地标", "网红效应", "年轻客群黏性"], itemDescs: ["建设路全国知名夜间消费地标", "抖音/小红书建设路美食打卡热度", "18-30岁核心客群的复访意愿与推荐率"] }
              ] }
          ]
        }
      }
    };

    /* merge base profile with district overrides */
    function getDistrictProfile(base, ind, dist) {
      if (!dist || dist === "全市") return base;
      var ov = districtChainOverrides[dist];
      if (!ov || !ov[ind]) return base;
      var d = ov[ind];
      return {
        root: d.root || base.root,
        intro: d.intro || base.intro,
        sectors: d.sectors || base.sectors,
        news: d.news || base.news,
        funding: d.funding || base.funding,
        leaders: d.leaders || base.leaders,
        stages: d.stages || base.stages
      };
    }

    var profile = getDistrictProfile(profiles[industry] || profiles["航空航天"], industry, selDistrict);

    function chainNodeKindLabel(kind) {
      var kindMap = {
        root: "产业链核心",
        stage: "链条阶段",
        main: "重点环节",
        leaf: "细分方向",
        "leaf-right": "细分赛道"
      };
      return kindMap[kind] || "产业节点";
    }

    function chainNodeFallbackDesc(node, cfg, currentIndustry, currentDistrict) {
      if (node.kind === "root") {
        return currentDistrict + "当前围绕“" + currentIndustry + "”形成了从关键环节到细分赛道的图谱总览，可用于展示链条结构、重点主体和补链方向。";
      }
      if (node.kind === "stage") {
        return "该节点代表“" + node.label + "”这一链条阶段，主要用于梳理该阶段的承接能力、关键方向和下一层重点环节。";
      }
      if (node.kind === "main") {
        return "该节点代表“" + node.label + "”这一重点环节，适合用于说明本地已有基础、重点企业分布以及需要补强的关键能力。";
      }
      return "该节点对应“" + node.label + "”这一细分方向，可结合企业、园区和招商线索进一步判断本地配套能力与补链重点。";
    }

    function chainNodeHoverHtml(node, cfg, currentIndustry, currentDistrict, clickable, assessment) {
      var summary = node.desc || chainNodeFallbackDesc(node, cfg, currentIndustry, currentDistrict);
      var kindLabel = chainNodeKindLabel(node.kind);
      var positionClass = node.x >= 78 ? " align-left" : node.x <= 18 ? " align-right" : " align-center";
      var verticalClass = node.y >= 76 ? " rise-up" : "";
      var actionHint = clickable ? "悬停查看节点说明，点击可继续查看关联企业。" : "悬停查看节点说明。";
      var headLabel = assessment && assessment.level ? kindLabel + " · " + assessment.levelLabel : kindLabel;
      var supportMeta = assessment ? '<span>企业支撑：' + esc(String(assessment.totalCount)) + ' 家</span>' : "";
      var weakMeta = assessment && assessment.level ? '<span>招商提示：' + esc(assessment.reason) + '</span>' : "";
      return (
        '<div class="chain-node-hover-card' +
        positionClass +
        verticalClass +
        '"><div class="chain-node-hover-head"><strong>' +
        esc(node.label) +
        '</strong><span>' +
        esc(headLabel) +
        '</span></div><p class="chain-node-hover-summary">' +
        esc(summary) +
        '</p><div class="chain-node-hover-meta"><span>所属产业：' +
        esc(currentIndustry) +
        '</span><span>研判区域：' +
        esc(currentDistrict) +
        '</span>' +
        supportMeta +
        weakMeta +
        '</div><div class="chain-node-hover-tip">' +
        esc(actionHint) +
        '</div><div class="chain-node-hover-actions"><button class="chain-node-hover-link" type="button" data-action="chain_open_node_detail" data-id="' +
        esc(node.id) +
        '">查看详细介绍</button></div></div>'
      );
    }

    function addNode(arr, id, label, x, y, w, h, tone, kind, desc) {
      arr.push({ id: id, label: label, x: x, y: y, w: w, h: h, tone: tone, kind: kind, desc: desc || "" });
    }

    /* ── Radial tree layout: nodes fan out from parents at angles ── */
    function buildGraph(cfg) {
      var nodes = [];
      var links = [];
      var DEG = Math.PI / 180;
      var rootX = 38, rootY = 50;
      addNode(nodes, "root", cfg.root, rootX, rootY, 11, 11, "peach", "root", cfg.intro);

      function polar(cx, cy, dist, angleDeg) {
        return { x: +(cx + dist * Math.cos(angleDeg * DEG)).toFixed(2),
                 y: +(cy + dist * Math.sin(angleDeg * DEG)).toFixed(2) };
      }
      /* fan(): spread N children evenly within an angular budget */
      function fan(n, centerAngle, budget) {
        if (n <= 1) return [centerAngle];
        var step = budget / (n - 1);
        var start = centerAngle - budget / 2;
        var arr = [];
        for (var i = 0; i < n; i++) arr.push(start + i * step);
        return arr;
      }

      /* ── Left side: fan out in left hemisphere ── */
      var leftGroups = sharedLeft || [];
      var leftCount = leftGroups.length;
      var leftBudget = 120;                                    /* 120° total */
      var leftAngles = fan(leftCount, 180, leftBudget);        /* centered at 180° (pure left) */
      var leftPerGroup = leftCount > 1 ? leftBudget / (leftCount - 1) : 60;
      var leftDist = 50;
      var leftLeafDist = 60;

      leftGroups.forEach(function (g, idx) {
        var gid = "left_" + idx;
        var angle = leftAngles[idx];
        var pos = polar(rootX, rootY, leftDist, angle);
        addNode(nodes, gid, g.name, pos.x, pos.y, 12, 6, g.tone, "main", g.desc || "");
        links.push({ from: "root", to: gid, tone: g.tone });

        var items = g.items || [];
        var leafBgt = Math.min(leftPerGroup * 0.95, 80);
        var leafAngles = fan(items.length, angle, leafBgt);

        items.forEach(function (it, j) {
          var lid = gid + "_item_" + j;
          var itemDesc = (g.itemDescs && g.itemDescs[j]) || "";
          var lpos = polar(pos.x, pos.y, leftLeafDist, leafAngles[j]);
          addNode(nodes, lid, it, lpos.x, lpos.y, 9.5, 4.1, g.tone, "leaf", itemDesc);
          links.push({ from: gid, to: lid, tone: g.tone });
        });
      });

      /* ── Right side: stages fan out in right hemisphere ── */
      var stages = cfg.stages || [];
      var stageCount = stages.length;
      var stageBudget = 140;                                   /* 140° total (-70 to +70) */
      var stageAngles = fan(stageCount, 0, stageBudget);
      var stageSlice = stageCount > 1 ? stageBudget / (stageCount - 1) : 80;
      var stageDist = 52;
      var groupDist = 44;
      var leafRDist = 60;

      stages.forEach(function (s, si) {
        var sid = "stage_" + si;
        var stageAngle = stageAngles[si];
        var spos = polar(rootX, rootY, stageDist, stageAngle);
        addNode(nodes, sid, s.name, spos.x, spos.y, 9.2, 5.3, s.tone, "stage", s.desc || "");
        links.push({ from: "root", to: sid, tone: s.tone });

        var groups = s.groups || [];
        var groupCount = groups.length;
        var groupBgt = Math.min(stageSlice * 0.95, 80);
        var groupAngles = fan(groupCount, stageAngle, groupBgt);
        var groupSlice = groupCount > 1 ? groupBgt / (groupCount - 1) : 40;

        groups.forEach(function (g, gi) {
          var gid = sid + "_group_" + gi;
          var groupAngle = groupAngles[gi];
          var gpos = polar(spos.x, spos.y, groupDist, groupAngle);
          addNode(nodes, gid, g.name, gpos.x, gpos.y, 10.2, 4.8, s.tone, "main", g.desc || "");
          links.push({ from: sid, to: gid, tone: s.tone });

          var items = g.items || [];
          var leafBgt = Math.min(groupSlice * 0.95, 120);
          var leafAngles = fan(items.length, groupAngle, leafBgt);

          items.forEach(function (it, li) {
            var lid = gid + "_leaf_" + li;
            var leafDesc = (g.itemDescs && g.itemDescs[li]) || "";
            var lpos = polar(gpos.x, gpos.y, leafRDist, leafAngles[li]);
            addNode(nodes, lid, it, lpos.x, lpos.y, 16.5, 4.0, s.tone, "leaf-right", leafDesc);
            links.push({ from: gid, to: lid, tone: s.tone });
          });
        });
      });

      return { nodes: nodes, links: links };
    }

    var graph = buildGraph(profile);

    /* ── Normalize positions to fit within 10%–90% on X, 8%–92% on Y ── */
    (function () {
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      graph.nodes.forEach(function (n) {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
      });
      var spanX = maxX - minX || 1;
      var spanY = maxY - minY || 1;
      graph.nodes.forEach(function (n) {
        n.x = +(10 + ((n.x - minX) / spanX) * 80).toFixed(2);
        n.y = +(8 + ((n.y - minY) / spanY) * 84).toFixed(2);
      });
    })();
    var nodeById = {};
    var labelToIds = {};
    var childMap = {};
    var parentMap = {};
    graph.nodes.forEach(function (n) {
      nodeById[n.id] = n;
      if (!labelToIds[n.label]) labelToIds[n.label] = [];
      labelToIds[n.label].push(n.id);
    });
    graph.links.forEach(function (link) {
      if (!childMap[link.from]) childMap[link.from] = [];
      childMap[link.from].push(link.to);
      parentMap[link.to] = link.from;
    });
    _chainNodeRegistry = {
      nodes: nodeById,
      labels: labelToIds,
      children: childMap,
      parents: parentMap,
      matchCache: {},
      context: {
        industry: industry,
        district: selDistrict,
        root: profile.root || ""
      }
    };
    var chainAssessment = chainBuildAssessment(graph, profile, industry, selDistrict);
    _chainNodeRegistry.context.updatedAt = chainAssessment.updatedAt;
    _chainNodeRegistry.context.assessmentMap = chainAssessment.weakMap || {};
    _chainNodeRegistry.context.highlightMap = chainAssessment.highlightMap || {};
    _chainNodeRegistry.context.weakNodeCount = chainAssessment.weakNodes.length;
    _chainNodeRegistry.context.topWeakNodes = (chainAssessment.topWeakNodes || []).map(function (item) {
      return {
        id: item.id,
        label: item.label,
        level: item.level,
        levelLabel: item.levelLabel,
        totalCount: item.totalCount,
        reason: item.reason,
        advice: item.advice
      };
    });
    chainPersistRegistry(_chainNodeRegistry);

    /* ── resize nodes to circles, diameter ∝ enterprise count ── */
    /* ── scatter positions so nodes don't sit on rigid grid lines ── */
    (function () {
      var countMap = {};
      var kindMax = {};
      graph.nodes.forEach(function (n) {
        var cnt = chainResolveMatchedEnterprises(n.id, n.label).length;
        countMap[n.id] = cnt;
        if (!kindMax[n.kind] || cnt > kindMax[n.kind]) kindMax[n.kind] = cnt;
      });
      var sizeRange = {
        root:         { min: 8,   max: 10 },
        stage:        { min: 4,   max: 6.5 },
        main:         { min: 2.5, max: 5 },
        leaf:         { min: 1.2, max: 3.2 },
        "leaf-right": { min: 1.2, max: 3.2 }
      };
      /* deterministic pseudo-random jitter from node id */
      function idHash(id) {
        var h = 0;
        for (var i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
        return h;
      }
      var jitterRange = {
        root:         { dx: 0,   dy: 0 },
        stage:        { dx: 0.5, dy: 0.3 },
        main:         { dx: 0.5, dy: 0.3 },
        leaf:         { dx: 0.4, dy: 0.2 },
        "leaf-right": { dx: 0.4, dy: 0.2 }
      };
      graph.nodes.forEach(function (n, idx) {
        var cnt = countMap[n.id] || 0;
        var r = sizeRange[n.kind] || { min: 2.5, max: 4.5 };
        if (n.kind === "root") {
          n.w = r.max;
        } else {
          /* log-based sizing: positively correlated but not proportional */
          var km = Math.max(1, kindMax[n.kind] || 1);
          var t = Math.log(1 + cnt) / Math.log(1 + km);
          t = Math.min(1, Math.max(0.15, t));              /* floor at 15% so empty nodes aren't invisible */
          n.w = +(r.min + (r.max - r.min) * t).toFixed(2);
        }
        n.h = n.w;
        /* scatter position */
        var jr = jitterRange[n.kind] || { dx: 0, dy: 0 };
        if (jr.dx || jr.dy) {
          var h = idHash(n.id);
          var fx = ((h & 0xff) / 255) * 2 - 1;           /* -1 … +1 */
          var fy = (((h >> 8) & 0xff) / 255) * 2 - 1;
          n.x = +(n.x + fx * jr.dx).toFixed(2);
          n.y = +(n.y + fy * jr.dy).toFixed(2);
        }
      });

      /* ── Gentle collision nudge: push overlapping nodes apart ── */
      for (var _iter = 0; _iter < 50; _iter++) {
        var _moved = false;
        for (var _i = 0; _i < graph.nodes.length; _i++) {
          for (var _j = _i + 1; _j < graph.nodes.length; _j++) {
            var a = graph.nodes[_i], b = graph.nodes[_j];
            var dx = b.x - a.x, dy = b.y - a.y;
            var dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
            var minD = (a.w + b.w) / 2 + 1.5;
            if (dist < minD) {
              var push = (minD - dist) / 2 * 0.7;
              var ux = dx / dist, uy = dy / dist;
              if (a.kind === "root") {
                b.x += ux * push * 2; b.y += uy * push * 2;
              } else if (b.kind === "root") {
                a.x -= ux * push * 2; a.y -= uy * push * 2;
              } else {
                a.x -= ux * push; a.y -= uy * push;
                b.x += ux * push; b.y += uy * push;
              }
              _moved = true;
            }
          }
        }
        if (!_moved) break;
      }

      /* ── Assign label direction based on position relative to parent ── */
      var rootN = graph.nodes[0];
      graph.nodes.forEach(function (n) {
        if (n.kind === "root") { n.labelDir = "bottom"; return; }
        /* For leaf nodes: label goes away from root */
        if (n.kind === "leaf" || n.kind === "leaf-right") {
          n.labelDir = (n.x - rootN.x) < 0 ? "left" : "right";
          return;
        }
        /* check position relative to root for stage/main */
        var dx = n.x - rootN.x;
        var dy = n.y - rootN.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          n.labelDir = dx < 0 ? "left" : "right";
        } else {
          n.labelDir = dy < 0 ? "top" : "bottom";
        }
      });
    })();

    var term = keyword.toLowerCase();
    var hitMap = {};
    if (term) {
      graph.nodes.forEach(function (n) {
        hitMap[n.id] = String(n.label || "").toLowerCase().indexOf(term) >= 0;
      });
    }

    function nodeHtml(n) {
      var cls = "chain-node tone-" + n.tone + " kind-" + n.kind;
      if (n.labelDir) cls += " lbl-" + n.labelDir;
      var assessment = chainAssessment.highlightMap[n.id];
      if (assessment && assessment.level) cls += " weak weak-" + assessment.level;
      if (term && hitMap[n.id]) cls += " hit";
      if (term && !hitMap[n.id]) cls += " dim";
      var clickable = true;
      var hoverCard = chainNodeHoverHtml(n, profile, industry, selDistrict, clickable, assessment);
      var extra = clickable
        ? ' data-action="chain_node_click" data-id="' + esc(n.id) + '" data-label="' + esc(n.label) + '" style="left:' + n.x + '%;top:' + n.y + '%;width:' + n.w + '%;cursor:pointer;"'
        : ' style="left:' + n.x + '%;top:' + n.y + '%;width:' + n.w + '%;"';
      return '<div class="' + cls + '"' + extra + ">" + hoverCard + "</div>";
    }

    function labelHtml(n) {
      var cls = "chain-label kind-" + n.kind;
      if (n.labelDir) cls += " lbl-" + n.labelDir;
      if (term && !hitMap[n.id]) cls += " dim";
      return '<div class="' + cls + '" style="left:' + n.x + '%;top:' + n.y + '%;">' + esc(n.label) + '</div>';
    }

    function edgePath(a, b) {
      var x1 = a.x + (b.x >= a.x ? a.w / 2 : -a.w / 2);
      var y1 = a.y;
      var x2 = b.x + (b.x >= a.x ? -b.w / 2 : b.w / 2);
      var y2 = b.y;
      var c = Math.max(3, Math.min(18, Math.abs(x2 - x1) * 0.45));
      var c1 = x1 + (x2 > x1 ? c : -c);
      var c2 = x2 - (x2 > x1 ? c : -c);
      return "M " + fixed(x1, 2) + " " + fixed(y1, 2) + " C " + fixed(c1, 2) + " " + fixed(y1, 2) + ", " + fixed(c2, 2) + " " + fixed(y2, 2) + ", " + fixed(x2, 2) + " " + fixed(y2, 2);
    }

    var edgeHtml = graph.links
      .map(function (e) {
        var a = nodeById[e.from];
        var b = nodeById[e.to];
        if (!a || !b) return "";
        var cls = "tone-" + e.tone;
        if (term && !hitMap[e.from] && !hitMap[e.to]) cls += " dim";
        return '<path class="' + cls + '" d="' + edgePath(a, b) + '" marker-end="url(#arr-' + e.tone + ')"></path>';
      })
      .join("");

    var nodesHtml = graph.nodes.map(nodeHtml).join("");
    var labelsHtml = '<div class="chain-label-layer">' + graph.nodes.map(labelHtml).join("") + '</div>';
    var industryIcons = { "航空航天": "✈", "人工智能": "🤖", "金融": "🏦", "商务商贸": "🛒", "文化旅游": "🎭", "文旅": "🏠", "低空经济": "🚁" };

    var industryNav = industryList
      .map(function (name) {
        var cls = name === industry ? "active" : "";
        var outputVal = industryOutputMap[name] ? industryOutputMap[name].toFixed(1) : "";
        return (
          '<button class="chain-ind-btn ' +
          cls +
          '" data-action="chain_pick_industry" data-id="' +
          esc(name) +
          '"><span class="chain-ind-icon">' +
          (industryIcons[name] || '📊') +
          '</span><span>' +
          esc(name) +
          '</span>' + (outputVal ? '<span class="chain-ind-output">' + outputVal + '亿</span>' : '') +
          "</button>"
        );
      })
      .join("");

    var tabDefs = [
      { id: "intro", name: "产业简介" },
      { id: "sectors", name: "细分领域" },
      { id: "funding", name: "投融资企业" }
    ];

    var tabNav = tabDefs
      .map(function (t) {
        var cls = t.id === tab ? "active" : "";
        return '<button class="chain-tab ' + cls + '" data-action="chain_pick_tab" data-id="' + esc(t.id) + '">' + esc(t.name) + "</button>";
      })
      .join("");

    var panelHtml = _chainPanelHtml(profile, tab);

    // store profiles so the tab-switch handler can reuse them without full re-render
    _chainProfiles = profiles;

    var weakListHtml = chainAssessment.topWeakNodes.length
      ? '<details class="chain-summary-weak"><summary class="chain-summary-weak-toggle"><div class="chain-summary-weak-head"><span class="chain-summary-weak-kicker">INVEST</span><div class="chain-summary-weak-title"><h5>薄弱环节识别</h5><span>可直接作为补链招商方向，默认收起展示</span></div></div><div class="chain-summary-weak-tools"><span class="chain-summary-weak-count">共 ' +
          esc(String(chainAssessment.topWeakNodes.length)) +
          ' 项</span><span class="chain-summary-weak-arrow" aria-hidden="true"></span></div></summary><div class="chain-summary-weak-list">' +
          chainAssessment.topWeakNodes.map(function (item) {
            return '<div class="chain-summary-weak-item"><div class="chain-summary-weak-row"><strong>' +
              esc(item.label) +
              '</strong><span class="chain-summary-badge level-' +
              esc(item.level) +
              '">' +
              esc(item.levelLabel) +
              '</span></div><p>' +
              esc(item.reason) +
              '</p><div class="chain-summary-weak-meta"><span>企业支撑 ' +
              esc(String(item.totalCount)) +
              ' 家</span><span>' +
              esc(item.advice) +
              '</span></div></div>';
          }).join("") +
        "</div></details>"
      : '<details class="chain-summary-weak empty"><summary class="chain-summary-weak-toggle"><div class="chain-summary-weak-head"><span class="chain-summary-weak-kicker">INVEST</span><div class="chain-summary-weak-title"><h5>薄弱环节识别</h5><span>当前未识别明显薄弱节点</span></div></div><div class="chain-summary-weak-tools"><span class="chain-summary-weak-count">已收起</span><span class="chain-summary-weak-arrow" aria-hidden="true"></span></div></summary><p>当前图谱中的主要节点已有一定企业支撑，可继续关注阶段性结构优化。</p></details>';

    var summaryHtml =
      '<div class="chain-summary"><div class="chain-summary-title-row"><div><h4>' +
      esc(profile.root) +
      '</h4><p class="chain-summary-note">' +
      esc(selDistrict) + ' · ' + esc(industry) + ' · ' + esc(chainAssessment.updatedAt) +
      '</p></div><span class="chain-summary-pill">补强 ' +
      esc(String(chainAssessment.highlightedCount)) +
      '</span></div><div class="chain-summary-stats">' +
      '<span>领域 <b>' + (profile.sectors || []).length +
      '</b></span><span>头部 <b>' + (profile.leaders || []).length +
      '</b></span><span>融资 <b>' + (profile.funding || []).length +
      '</b></span><span>补强 <b>' + chainAssessment.highlightedCount +
      "</b></span></div></div>";
      chainAssessment.highlightedCount +
      "</b></span></div></div>";

    return (
      '<div class="chain-root">' +
      '<header class="chain-topbar"><div class="chain-brand with-icon"><span class="topbar-brand-icon">' +
      uiIcon("chain", "brand-icon") +
      '</span><span>产业链式图谱</span></div>' +
      '<div class="chain-top-tools"><div class="chain-search"><input data-role="chain-search" value="' +
      esc(keyword) +
      '" placeholder="搜索节点/企业/环节..." /></div>' +
      '<button class="chain-link-btn with-icon" data-action="chain_apply_search">' +
      uiIcon("search", "link-icon") +
      '<span>搜索</span></button><span class="sep">|</span>' +
      '<a class="chain-link-btn with-icon" href="#/gov/home">' +
      uiIcon("home", "link-icon") +
      '<span>返回平台首页</span></a>' +
      '</div></header>' +
      '<div class="chain-layout">' +
      '<section class="chain-center"><div class="chain-map-head"><div class="chain-map-head-left"><span class="title">' +
      esc(profile.root) +
      '</span><span class="chain-map-tag">' + esc(selDistrict) + ' · ' + esc(industry) +
      '</span><span class="chain-map-tag">更新时间：' + esc(chainAssessment.updatedAt) +
      '</span><span class="chain-map-tag weak">补强 ' + esc(String(chainAssessment.highlightedCount)) + '</span></div><div class="ops"><button class="op" data-action="chain_zoom_in">+</button><button class="op" data-action="chain_zoom_out">-</button><button class="op" data-action="chain_zoom_reset">重置</button><span class="sep">|</span><button class="op export" data-action="chain_export">导出</button></div></div>' +
      '<div class="chain-map-stage"><div class="chain-graph-canvas" style="transform:scale(' +
      fixed(zoom, 2) +
      ');"><svg class="chain-edges" viewBox="0 0 100 100" preserveAspectRatio="none"><defs>' +
      '<marker id="arr-lilac" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto"><polygon points="0 0, 4 1.5, 0 3" fill="#4a5694"/></marker>' +
      '<marker id="arr-brown" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto"><polygon points="0 0, 4 1.5, 0 3" fill="#9b59b6"/></marker>' +
      '<marker id="arr-yellow" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto"><polygon points="0 0, 4 1.5, 0 3" fill="#5cc4af"/></marker>' +
      '<marker id="arr-red" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto"><polygon points="0 0, 4 1.5, 0 3" fill="#8b6ce0"/></marker>' +
      '<marker id="arr-cyan" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto"><polygon points="0 0, 4 1.5, 0 3" fill="#f28a1c"/></marker>' +
      '<marker id="arr-green" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto"><polygon points="0 0, 4 1.5, 0 3" fill="#26b8a8"/></marker>' +
      '<marker id="arr-orange" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto"><polygon points="0 0, 4 1.5, 0 3" fill="#e84579"/></marker>' +
      '</defs>' +
      edgeHtml +
      "</svg>" +
      nodesHtml +
      labelsHtml +
      '</div><div id="chain-node-popup" class="chain-node-popup hidden"></div></div></section>' +
      '<aside class="chain-right">' +
      '<div class="chain-selector"><div class="chain-district-picker"><label>选择区域</label><select data-role="chain-district-select">' +
      districtNames.map(function (dn) { return '<option value="' + esc(dn) + '"' + (dn === selDistrict ? ' selected' : '') + '>' + esc(dn) + '</option>'; }).join('') +
      '</select></div><h3>主导产业链</h3><div class="chain-ind-list">' +
      industryNav +
      '</div></div>' +
      summaryHtml +
      '<div class="chain-tabs">' +
      tabNav +
      '</div><div class="chain-panel">' +
      panelHtml +
      '</div><div class="chain-right-bottom">' +
      weakListHtml +
      "</div></aside>" +
      "</div></div>"
    );
  }

  function matchResources(d) {
    var want = "service";
    if ((d.category || "").indexOf("载体") >= 0 || (d.category || "").indexOf("空间") >= 0) want = "space";
    if ((d.category || "").indexOf("融资") >= 0) want = "finance";

    var text = (d.title || "") + " " + (d.detail || "");
    return (seed.resources || [])
      .filter(function (r) {
        return r.type === want;
      })
      .map(function (r) {
        var score = 60;
        (r.tags || []).forEach(function (t) {
          if (text.indexOf(t) >= 0) score += 12;
        });
        score += Math.round(Math.random() * 8);
        return { r: r, score: Math.min(99, score) };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 4);
  }

  function pageGovEcosystem() {
    var points = (seed.resources || [])
      .map(function (r) {
        var cls = r.type === "space" ? "orange" : r.type === "finance" ? "teal" : "green";
        return (
          '<button class="btn" data-action="open_res" data-id="' +
          r.id +
          '" style="position:absolute;left:' +
          (r.x || 50) +
          "%;top:" +
          (r.y || 50) +
          '%;transform:translate(-50%,-50%);padding:6px 8px;border-radius:999px;font-size:12px;">' +
          '<span class="tag ' +
          cls +
          '" style="margin:0;">' +
          esc(r.type === "space" ? "载体" : r.type === "finance" ? "金融" : "服务") +
          "</span></button>"
        );
      })
      .join("");

    var ecosystemTopBtns = '<a class="btn" href="#/gov/home">返回平台首页</a>';

    var demandRows = (state.demands || [])
      .slice()
      .sort(function (a, b) {
        return String(b.created_at).localeCompare(String(a.created_at));
      })
      .map(function (d) {
        var e = entById(d.enterprise_id) || { name: "未知企业" };
        return (
          "<tr><td><b>" +
          esc(d.title) +
          "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" +
          esc(e.name + " · " + fmtDate(d.created_at)) +
          "</div></td><td><span class=\"tag teal\">" +
          esc(d.category) +
          "</span></td><td><span class=\"tag\">" +
          esc(d.status) +
          "</span></td><td><button class=\"btn\" data-action=\"match_demand\" data-id=\"" +
          d.id +
          "\">派单</button></td></tr>"
        );
      })
      .join("");

    return (
      '<div class="grid">' +
      card(
        "生态资源地图（示意）",
        "融资对接 / 服务机构 / 金融网点",
        ecosystemTopBtns + '<button class="btn" data-action="export_demo">导出资源</button>',
        '<div style="position:relative;border-radius:18px;border:1px solid rgba(16,33,44,0.12);background:linear-gradient(135deg, rgba(15,118,110,0.10), rgba(217,119,6,0.10));height:380px;overflow:hidden;">' +
          '<div style="position:absolute;inset:0;background-image:linear-gradient(rgba(16,33,44,0.06) 1px, transparent 1px),linear-gradient(90deg, rgba(16,33,44,0.06) 1px, transparent 1px);background-size:42px 42px;opacity:0.45;"></div>' +
          points +
          '<div style="position:absolute;left:14px;bottom:12px;" class="pill">点击点位查看详情</div>' +
          "</div>",
        7
      ) +
      card(
        "企业企业（待处理）",
        "风险信号 -> 解释 -> 派单处置",
        "",
        '<table class="table"><thead><tr><th>企业</th><th>风险</th><th>负责人</th><th></th></tr></thead><tbody>' +
          (demandRows || '<tr><td colspan="4" class="muted">暂无需求</td></tr>') +
          "</tbody></table>",
        5
      ) +
      "</div>"
    );
  }

  function pageGovAlerts() {
    var scopedAlerts = govDemoAlerts();
    var scopedAlertIds = scopedAlerts.map(function (item) { return item.id; });
    var rows = scopedAlerts
      .map(function (a) {
        var e = entById(a.enterprise_id) || { name: "未知企业" };
        var tag = a.level === "高" ? "red" : a.level === "中" ? "orange" : "green";
        return (
          "<tr><td><a href=\"#/gov/alert/" +
          a.id +
          "\"><b>" +
          esc(e.name) +
          "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" +
          esc(a.type) +
          "</div></a></td><td><span class=\"tag " +
          tag +
          "\">" +
          esc(a.level + "风险") +
          "</span><span class=\"tag\">评分 " +
          esc(a.score) +
          "</span></td><td><span class=\"tag\">" +
          esc(alertStatus(a.id)) +
          "</span></td><td><button class=\"btn\" data-action=\"assign_alert\" data-id=\"" +
          a.id +
          "\">派单</button></td></tr>"
        );
      })
      .join("");

    var wo = (state.work_orders || [])
      .slice()
      .filter(function (item) {
        return item.type !== "alert" || scopedAlertIds.indexOf(item.ref_id) >= 0;
      })
      .sort(function (a, b) {
        return String(b.updated_at).localeCompare(String(a.updated_at));
      })
      .map(function (w) {
        var ass = staffById(w.assignee);
        return (
          "<tr><td><b>" +
          esc(w.title) +
          "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" +
          esc(w.type + " · " + w.ref_id) +
          "</div></td><td><span class=\"tag\">" +
          esc(w.status) +
          "</span></td><td>" +
          esc(ass ? ass.name : "-") +
          "</td><td><button class=\"btn\" data-action=\"edit_wo\" data-id=\"" +
          w.id +
          "\">更新</button></td></tr>"
        );
      })
      .join("");

    return (
      '<div class="grid">' +
      card(
        "预警事项列表",
        "风险信号 -> 解释 -> 派单处置",
        '<a class="btn" href="#/gov/home">返回平台首页</a>',
        '<table class="table"><thead><tr><th>企业</th><th>风险</th><th>负责人</th><th></th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="4" class="muted">暂无需求</td></tr>') +
          "</tbody></table>",
        7
      ) +
      card(
        "工单台账",
        "派单/跟进/闭环",
        "",
        '<table class="table"><thead><tr><th>事项</th><th>负责人</th><th>负责人</th><th></th></tr></thead><tbody>' +
          (wo || '<tr><td colspan="4" class="muted">暂无需求</td></tr>') +
          "</tbody></table>",
        5
      ) +
      "</div>"
    );
  }

  function pageGovAlertDetail(alertId) {
    var a = govDemoAlerts().find(function (x) {
      return x.id === alertId;
    });
    if (!a) return '<div class="card fade-in"><div class="hd"><p class="title">预警不存在</p></div><div class="bd muted">请从预警列表进入。</div></div>';

    var e = entById(a.enterprise_id) || { name: "未知企业", id: a.enterprise_id };
    var tag = a.level === "高" ? "red" : a.level === "中" ? "orange" : "green";
    var sigs = (a.signals || [])
      .map(function (s) {
        return '<div class="alert-signal-item"><span class="alert-signal-name">' + esc(s.name) + '</span><span class="alert-signal-detail">' + esc(s.detail) + '</span></div>';
      })
      .join("");
    var w = workOrderByRef("alert", a.id);
    var wHtml = w
      ? '<span class="tag">' + esc(w.status) + '</span> ' +
        '<span class="muted">负责人：</span>' +
        esc((staffById(w.assignee) || {}).name || "未派单")
      : '<span class="muted">暂未派单</span>';

    // Enterprise basic info
    var kpisData = e.kpis || {};
    var riskData = e.risk || {};
    var riskSignals = (riskData.signals || []);
    var streetName = "";
    if (e.street_id) {
      var st = (geoData().streets || []).find(function (s) { return s.id === e.street_id; });
      if (st) streetName = st.name;
    }

    // Enterprise events (recent)
    var events = (e.events || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 8);
    var eventTypeMap = { innovation: "💡 创新", finance: "💰 融资", bid: "📝 招投标", service: "🔧 服务", operate: "⚙️ 经营", change: "🔄 变更", risk: "⚠️ 风险", policy: "📜 政策", talent: "👤 人才", award: "🏆 荣誉" };
    var eventsHtml = events.length > 0
      ? events.map(function (ev) {
          var typeLabel = eventTypeMap[ev.type] || ev.type || "";
          return '<div class="alert-event-row"><span class="alert-event-date">' + esc(ev.date || "") + '</span><span class="alert-event-type">' + typeLabel + '</span><span class="alert-event-title">' + esc(ev.title) + '</span></div>';
        }).join("")
      : '<div class="muted">暂无近期动态</div>';

    // Risk level assessment
    var riskColor = a.level === "高" ? "#e74c3c" : a.level === "中" ? "#f39c12" : "#2bc784";
    var riskBg = a.level === "高" ? "rgba(231,76,60,0.06)" : a.level === "中" ? "rgba(243,156,18,0.06)" : "rgba(43,199,132,0.06)";

    // Days since alert
    var daysSince = Math.max(1, Math.round((Date.now() - new Date(a.created_at).getTime()) / 86400000));

    return (
      '<div class="grid">' +
      '<div class="card fade-in" style="grid-column:span 12;">' +
        '<div class="hd"><div><p class="title">预警详情</p>' +
        '<div class="meta">' + esc(e.name) + ' · ' + esc(a.type) + ' · ' + esc(fmtDate(a.created_at)) + '</div></div>' +
        '<div style="display:flex;gap:10px;align-items:center;">' +
          '<a class="btn" href="#/gov/enterprise-exit">← 返回列表</a>' +
          '<a class="btn" href="#/gov/enterprise/' + esc(e.id) + '">企业档案</a>' +
          '<a class="btn" href="#/gov/portrait/' + esc(e.id) + '">企业画像</a>' +
          '<button class="btn primary" data-action="assign_alert" data-id="' + a.id + '">派单/更新</button>' +
        '</div></div>' +
        '<div class="bd">' +
          /* ── Overview strip ── */
          '<div class="alert-overview-strip">' +
            '<div class="alert-ov-item" style="background:' + riskBg + ';border-color:' + riskColor + '">' +
              '<div class="alert-ov-label">预警等级</div>' +
              '<div class="alert-ov-value" style="color:' + riskColor + '">' + esc(a.level + '风险') + '</div>' +
            '</div>' +
            '<div class="alert-ov-item"><div class="alert-ov-label">风险指数</div><div class="alert-ov-value">' + esc(String(a.score)) + '<span class="alert-ov-unit"> / 100</span></div></div>' +
            '<div class="alert-ov-item"><div class="alert-ov-label">预警类型</div><div class="alert-ov-value">' + esc(a.type) + '</div></div>' +
            '<div class="alert-ov-item"><div class="alert-ov-label">已持续</div><div class="alert-ov-value">' + daysSince + '<span class="alert-ov-unit"> 天</span></div></div>' +
            '<div class="alert-ov-item"><div class="alert-ov-label">工单状态</div><div class="alert-ov-value">' + wHtml + '</div></div>' +
          '</div>' +

          /* ── Risk signals ── */
          '<div class="alert-section">' +
            '<h4 class="alert-section-title">⚠️ 风险信号明细</h4>' +
            '<div class="alert-signals-grid">' + sigs + '</div>' +
          '</div>' +

          /* ── Suggestion ── */
          '<div class="alert-section">' +
            '<h4 class="alert-section-title">💡 处置建议</h4>' +
            '<div class="alert-suggestion-box">' + esc(a.suggestion) + '</div>' +
          '</div>' +

          /* ── Enterprise info ── */
          '<div class="alert-section">' +
            '<h4 class="alert-section-title">🏢 企业基本信息</h4>' +
            '<div class="alert-ent-info">' +
              '<div class="alert-info-row"><span class="alert-info-label">企业名称</span><span class="alert-info-value">' + esc(e.name) + '</span></div>' +
              '<div class="alert-info-row"><span class="alert-info-label">统一社会信用代码</span><span class="alert-info-value">' + esc(e.uscc || "-") + '</span></div>' +
              '<div class="alert-info-row"><span class="alert-info-label">行业</span><span class="alert-info-value">' + esc(e.industry || "-") + '</span></div>' +
              '<div class="alert-info-row"><span class="alert-info-label">产业方向</span><span class="alert-info-value">' + esc(e.track || "-") + '</span></div>' +
              '<div class="alert-info-row"><span class="alert-info-label">所属街道</span><span class="alert-info-value">' + esc(streetName || "-") + '</span></div>' +
              '<div class="alert-info-row"><span class="alert-info-label">地址</span><span class="alert-info-value">' + esc(e.address || "-") + '</span></div>' +
              '<div class="alert-info-row"><span class="alert-info-label">企业规模</span><span class="alert-info-value">' + esc(e.level || "-") + '</span></div>' +
              '<div class="alert-info-row"><span class="alert-info-label">标签</span><span class="alert-info-value">' + (e.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(" ") + '</span></div>' +
            '</div>' +
          '</div>' +

          /* ── KPIs ── */
          '<div class="alert-section">' +
            '<h4 class="alert-section-title">📊 关键经营指标</h4>' +
            '<div class="alert-kpi-grid">' +
              '<div class="alert-kpi"><div class="alert-kpi-val">' + (kpisData.revenue_y != null ? kpisData.revenue_y.toFixed(1) : "-") + '</div><div class="alert-kpi-label">营业收入（亿元）</div></div>' +
              '<div class="alert-kpi"><div class="alert-kpi-val">' + (kpisData.tax_y != null ? kpisData.tax_y.toFixed(2) : "-") + '</div><div class="alert-kpi-label">纳税总额（亿元）</div></div>' +
              '<div class="alert-kpi"><div class="alert-kpi-val">' + (kpisData.employees || "-") + '</div><div class="alert-kpi-label">从业人数</div></div>' +
              '<div class="alert-kpi"><div class="alert-kpi-val">' + (kpisData.r_and_d != null ? (kpisData.r_and_d * 100).toFixed(0) + "%" : "-") + '</div><div class="alert-kpi-label">研发投入占比</div></div>' +
            '</div>' +
          '</div>' +

          /* ── Enterprise risk profile ── */
          '<div class="alert-section">' +
            '<h4 class="alert-section-title">🔍 企业风险画像</h4>' +
            '<div class="alert-risk-profile">' +
              '<div class="alert-info-row"><span class="alert-info-label">综合风险等级</span><span class="alert-info-value"><span class="tag ' + (riskData.level === "高" ? "red" : riskData.level === "中" ? "orange" : "green") + '">' + esc(riskData.level || "低") + '</span></span></div>' +
              '<div class="alert-info-row"><span class="alert-info-label">风险评分</span><span class="alert-info-value">' + esc(String(riskData.score || "-")) + '</span></div>' +
              (riskSignals.length > 0
                ? '<div class="alert-info-row"><span class="alert-info-label">风险信号</span><span class="alert-info-value">' + riskSignals.map(function (s) { return '<span class="tag red" style="margin-right:6px;">' + esc(s) + '</span>'; }).join("") + '</span></div>'
                : '') +
            '</div>' +
          '</div>' +

          /* ── Recent events ── */
          '<div class="alert-section">' +
            '<h4 class="alert-section-title">📅 近期动态</h4>' +
            '<div class="alert-events-list">' + eventsHtml + '</div>' +
          '</div>' +

        '</div>' +
      '</div></div>'
    );
  }

  function genMonthly() {
    var ents = govDemoEnterprises();
    var key = ents.filter(isKeyEnterprise);
    var alerts = govDemoAlerts()
      .slice()
      .sort(function (a, b) {
        return (b.score || 0) - (a.score || 0);
      });
    var demands = (state.demands || [])
      .slice()
      .filter(function (d) { return govDemoIsInDistrict(entById(d.enterprise_id)); })
      .sort(function (a, b) {
        return String(b.created_at).localeCompare(String(a.created_at));
      });

    var out = [];
    out.push("# 迁出风险企业专报（演示）");
    out.push("");
    out.push("- 生成时间：" + today());
    out.push("- 区域：" + govDemoDistrictName());
    out.push("");
    out.push("## 五、建议动作（示例）");
    out.push("- 企业总数：" + ents.length);
    out.push("- 重点企业：" + key.length);
    out.push("- 预警数量：" + alerts.length);
    out.push("- 待处理企业：" + demands.filter(function (d) { return d.status !== "已完成" && d.status !== "已关闭"; }).length);
    out.push("");
    out.push("## 三、风险预警（Top）");
    key.slice(0, 6).forEach(function (e, i) {
      out.push((i + 1) + ". " + e.name + "（" + e.industry + "，" + e.level + "）");
    });
    out.push("");
    out.push("## 三、风险预警（Top）");
    alerts.slice(0, 5).forEach(function (a, i) {
      var e = entById(a.enterprise_id) || { name: a.enterprise_id };
      out.push((i + 1) + ". " + e.name + "｜" + a.type + "｜" + a.level + "｜风险指数 " + a.score + "｜负责人 " + alertStatus(a.id));
    });
    out.push("");
    out.push("## 四、企业与对接（Top）");
    demands.slice(0, 6).forEach(function (d, i) {
      var e = entById(d.enterprise_id) || { name: d.enterprise_id };
      out.push((i + 1) + ". [" + d.category + "] " + d.title + "（" + e.name + "，" + d.status + "）");
    });
    out.push("");
    out.push("## 五、建议动作（示例）");
    out.push("1. 高风险企业走访稳企，形成问题清单与闭环台账。");
    out.push("2. 围绕产业链短板，形成补链招商建议清单。");
    out.push("3. 对设备更新类融资企业，联动贴息政策与银行，提高衍生消费。");
    out.push("");
    return out.join("\n");
  }

  function genRiskReport() {
    var alerts = govDemoAlerts()
      .slice()
      .sort(function (a, b) {
        return (b.score || 0) - (a.score || 0);
      });
    var out = [];
    out.push("# 迁出风险企业专报（演示）");
    out.push("");
    out.push("- 生成时间：" + today());
    out.push("");
    alerts.forEach(function (a, idx) {
      var e = entById(a.enterprise_id) || { name: a.enterprise_id };
      out.push("## " + (idx + 1) + ". " + e.name + "（" + a.level + "，风险指数 " + a.score + "）");
      out.push("- 类型：" + a.type);
      out.push("- 预警时间：" + fmtDate(a.created_at));
      out.push("- 负责人：" + alertStatus(a.id));
      out.push("- 信号：");
      (a.signals || []).forEach(function (s) { out.push("  - " + s.name + "：" + s.detail); });
      out.push("- 建议：" + a.suggestion);
      out.push("");
    });
    return out.join("\n");
  }

  function downloadText(filename, content) {
    var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 600);
  }

  function pageGovReports() {
    return (
      '<div class="fade-in">' +
      '<div class="decision-topline"><div class="decision-topline-main">' + uiIcon('report') + '<span class="decision-topline-title">报表中心</span></div><div class="decision-topline-extra"><a class="decision-back-link" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a></div></div>' +
      '<div class="grid" style="margin-top:18px">' +
      card(
        "报表中心（演示）",
        "模板化输出：月报/专报/内参",
        '<button class="btn primary" data-action="gen_monthly">生成月度简报</button><button class="btn" data-action="gen_risk">生成预警专报</button>',
        '<p class="muted" style="margin:0;line-height:1.7;">演示版本以 Markdown 文稿输出，可对接 Word/PDF 模板引擎实现正式导出。</p>'
      ) +
      "</div></div>"
    );
  }

  /* ════════════════════════════════════════════════════════
   *  政企政策智能匹配系统
   * ════════════════════════════════════════════════════════ */

  /* --- 首页 --- */
  function pagePolicyMatchHome() {
    return (
      '<div class="pm-home fade-in">' +
        '<div class="pm-home-bg">' +
          '<header class="kp-topline pm-home-header"><div class="kp-topline-main">' + uiIcon('policy') + '<span>政策智能匹配专题</span></div><div class="kp-topline-actions pm-topbar-actions"><a class="kp-back-link pm-home-back" href="#/gov/home">' + uiIcon('home', 'link-icon') + '<span>返回平台首页</span></a></div></header>' +
          '<section class="pm-home-hero">' +
            '<h1 class="pm-home-title">政策智能<em>精准匹配</em>·高效联动</h1>' +
            '<p class="pm-home-subtitle">基于企业画像与政策条目的智能匹配引擎，实现企业精准找政策、政策精准找企业</p>' +
            '<div class="pm-home-btns">' +
              '<a class="pm-home-btn ent" href="#/gov/policy-enterprise">' +
                '<span class="pm-home-btn-icon">' + uiIcon("enterprise", "pm-home-btn-glyph") + '</span>' +
                '<span class="pm-home-btn-label">企业找政策</span>' +
                '<span class="pm-home-btn-desc">输入企业信息，智能匹配可申报政策</span>' +
              '</a>' +
              '<a class="pm-home-btn gov" href="#/gov/policy-gov">' +
                '<span class="pm-home-btn-icon">' + uiIcon("gov", "pm-home-btn-glyph") + '</span>' +
                '<span class="pm-home-btn-label">政策找企业</span>' +
                '<span class="pm-home-btn-desc">选择政策条目，反向筛选符合条件企业</span>' +
              '</a>' +
            '</div>' +
          '</section>' +
          '<footer class="pm-home-footer">' +
            '<span>本专题仅用于政策服务演示</span>' +
            '<span>企业信息严格保密</span>' +
            '<span>咨询电话：12345678</span>' +
          '</footer>' +
        '</div>' +
      '</div>'
    );
  }

  /* --- 企业找政策 --- */
  var _pmEntState = { step: "form", entName: "", searchKeyword: "", showSuggestions: false, hasProject: "", projectData: {}, matchedEnt: null };

  function _pmResetEntSearchUi(inputEl) {
    var field = inputEl ? inputEl.closest(".pm-field") : document.querySelector(".pm-field.pm-field-wide");
    if (field) {
      var suggest = field.querySelector(".pm-suggest");
      if (suggest && suggest.parentNode) suggest.parentNode.removeChild(suggest);
    }
    var selected = document.querySelector(".pm-selected-ent");
    if (selected && selected.parentNode) selected.parentNode.removeChild(selected);
  }

  function _pmFindEnterprise(keyword) {
    if (!keyword) return [];
    var kw = keyword.toLowerCase();
    return govDemoEnterprises().filter(function (e) {
      return e.name.toLowerCase().indexOf(kw) >= 0 || (e.uscc && e.uscc.indexOf(kw) >= 0);
    }).slice(0, 8);
  }

  function _pmRunEnterpriseSearch(keyword) {
    var kw = String(keyword || "").trim();
    var exact = null;
    var suggestions;
    _pmEntState.entName = kw;
    _pmEntState.searchKeyword = kw;
    _pmEntState.matchedEnt = null;
    if (!kw) {
      _pmEntState.showSuggestions = false;
      return;
    }
    suggestions = _pmFindEnterprise(kw);
    exact = suggestions.filter(function (ent) {
      return (ent.name || "").toLowerCase() === kw.toLowerCase() || ((ent.uscc || "").toLowerCase() === kw.toLowerCase());
    })[0] || null;
    if (exact || suggestions.length === 1) {
      _pmEntState.matchedEnt = exact || suggestions[0];
      _pmEntState.entName = _pmEntState.matchedEnt.name;
      _pmEntState.searchKeyword = _pmEntState.matchedEnt.name;
      _pmEntState.showSuggestions = false;
      return;
    }
    _pmEntState.showSuggestions = true;
  }

  function _pmMatchPolicies(ent, projectData) {
    if (!ent) return [];
    var results = [];
    var policies = govDemoPolicies();
    for (var i = 0; i < policies.length; i++) {
      var p = policies[i];
      var industryMatch = !p.industries || p.industries.indexOf(ent.industry) >= 0;
      var levelMatch = !p.levels || p.levels.indexOf(ent.level) >= 0;
      if (industryMatch || levelMatch) {
        var score = 0;
        if (industryMatch) score += 40;
        if (levelMatch) score += 30;
        if (projectData && projectData.industry && p.industries && p.industries.indexOf(projectData.industry) >= 0) score += 20;
        if (projectData && projectData.invest && p.fund_max && Number(projectData.invest) >= p.fund_max * 0.5) score += 10;
        results.push({ policy: p, score: Math.min(score, 100), fund: p.fund_max || 0 });
      }
    }
    results.sort(function (a, b) { return b.score - a.score; });
    return results;
  }

  function pagePolicyEnterprise(rt) {
    var q = (rt && rt.q) || {};
    var step = q.step || _pmEntState.step || "form";

    var navBar =
      '<div class="kp-topline pm-topbar">' +
        '<div class="kp-topline-main">' + uiIcon('policy') + '<span>企业找政策</span></div>' +
        '<div class="kp-topline-actions pm-topbar-actions">' + uiIcon('ai', 'link-icon') + '<span class="pm-topbar-ai">AI 大模型接口</span><a class="kp-back-link pm-back" href="#/gov/policy-match">' + uiIcon('back', 'link-icon') + '<span>返回专题首页</span></a></div>' +
      '</div>';

    if (step === "result" || _pmEntState.step === "result") {
      return navBar + _pmRenderResult();
    }

    // --- form step ---
    var entName = _pmEntState.entName || "";
    var searchKeyword = _pmEntState.searchKeyword || "";
    var hasProject = _pmEntState.hasProject || "";

    var suggestHtml = '';
    if (_pmEntState.showSuggestions && searchKeyword.length >= 1) {
      var suggestions = _pmFindEnterprise(searchKeyword);
      if (suggestions.length > 0) {
        suggestHtml = '<div class="pm-suggest">';
        for (var si = 0; si < suggestions.length; si++) {
          suggestHtml += '<div class="pm-suggest-item" data-action="pm_pick_ent" data-id="' + esc(suggestions[si].id) + '">' + esc(suggestions[si].name) + ' <span class="muted">(' + esc(suggestions[si].industry) + ')</span></div>';
        }
        suggestHtml += '</div>';
      } else {
        suggestHtml = '<div class="pm-suggest"><div class="pm-suggest-item muted">未找到匹配企业，请调整关键词后重新搜索</div></div>';
      }
    }

    var selectedInfo = '';
    if (_pmEntState.matchedEnt) {
      var me = _pmEntState.matchedEnt;
      selectedInfo = '<div class="pm-selected-ent"><span class="pm-sel-label">已选择：</span><strong>' + esc(me.name) + '</strong><span class="pm-sel-meta">' + esc(me.industry) + ' · ' + esc(me.level) + '</span></div>';
    }

    var projectForm = '';
    if (hasProject === "yes") {
      var pd = _pmEntState.projectData || {};
      var industryOpts = '<option value="">请选择行业</option>';
      (seed.industries || []).forEach(function (ind) {
        industryOpts += '<option value="' + esc(ind.name) + '"' + (pd.industry === ind.name ? ' selected' : '') + '>' + esc(ind.name) + '</option>';
      });
      var partOpts = ["社会主导", "国家主导", "省级主导", "市级主导", "区级指导"].map(function (v) {
        return '<option value="' + esc(v) + '"' + (pd.participation === v ? ' selected' : '') + '>' + esc(v) + '</option>';
      }).join('');

      projectForm =
        '<fieldset class="pm-fieldset">' +
          '<legend>项目申报情况</legend>' +
          '<p class="pm-hint">填写项目信息可以提高政策匹配的精准度</p>' +
          '<div class="pm-form-grid">' +
            '<label class="pm-field"><span>项目名称</span><input type="text" data-pm="proj_name" value="' + esc(pd.name || '') + '" placeholder="请输入项目名称" /></label>' +
            '<label class="pm-field"><span>项目所属行业</span><select data-pm="proj_industry">' + industryOpts + '</select></label>' +
            '<label class="pm-field"><span>项目参与情况</span><select data-pm="proj_participation"><option value="">请选择</option>' + partOpts + '</select></label>' +
            '<label class="pm-field"><span>建设地址</span><input type="text" data-pm="proj_address" value="' + esc(pd.address || '') + '" placeholder="省-市-区" /></label>' +
            '<label class="pm-field"><span>建设规模</span><input type="text" data-pm="proj_scale" value="' + esc(pd.scale || '') + '" placeholder="如：5000平方米" /></label>' +
            '<label class="pm-field"><span>总投资额（万元）</span><input type="number" data-pm="proj_invest" value="' + esc(pd.invest || '') + '" placeholder="万元" /></label>' +
          '</div>' +
        '</fieldset>';
    }

    return navBar +
      '<div class="pm-page fade-in">' +
        '<div class="pm-card">' +
          '<h2 class="pm-card-title">基本信息</h2>' +
          '<div class="pm-form-row">' +
            '<label class="pm-field pm-field-wide"><span>企业名称</span>' +
              '<div class="pm-ent-search-row">' +
                '<input type="text" data-pm="ent_name" value="' + esc(entName) + '" placeholder="输入企业关键词，点击搜索后匹配" autocomplete="off" />' +
                '<button type="button" class="btn pm-ent-search-btn" data-action="pm_search_ent">搜索</button>' +
              '</div>' +
              suggestHtml +
            '</label>' +
          '</div>' +
          selectedInfo +
          '<div class="pm-form-row">' +
            '<label class="pm-field"><span>是否有项目申报</span>' +
              '<div class="pm-radio-group">' +
                '<label class="pm-radio' + (hasProject === "yes" ? " active" : "") + '"><input type="radio" name="has_project" value="yes"' + (hasProject === "yes" ? " checked" : "") + ' data-action="pm_has_project" /> 是</label>' +
                '<label class="pm-radio' + (hasProject === "no" ? " active" : "") + '"><input type="radio" name="has_project" value="no"' + (hasProject === "no" ? " checked" : "") + ' data-action="pm_has_project" /> 否</label>' +
              '</div>' +
            '</label>' +
          '</div>' +
          projectForm +
          '<div class="pm-actions">' +
            '<button class="btn primary pm-submit-btn" data-action="pm_match">匹配政策</button>' +
            '<button class="btn pm-manual-btn" data-action="pm_manual_service">' + uiIcon('user', 'link-icon') + '人工服务</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function _pmRenderResult() {
    var ent = _pmEntState.matchedEnt;
    if (!ent) return '<div class="pm-page fade-in"><div class="pm-card"><p class="muted">请先选择企业再进行匹配。</p><a class="btn" href="#/gov/policy-enterprise">返回填写</a></div></div>';

    var matches = _pmMatchPolicies(ent, _pmEntState.projectData);
    var totalFund = 0;
    for (var i = 0; i < matches.length; i++) totalFund += matches[i].fund;

    // group by dept
    var deptMap = {};
    for (var j = 0; j < matches.length; j++) {
      var dept = matches[j].policy.dept;
      if (!deptMap[dept]) deptMap[dept] = { count: 0, fund: 0 };
      deptMap[dept].count++;
      deptMap[dept].fund += matches[j].fund;
    }

    // group by industry
    var indMap = {};
    for (var k = 0; k < matches.length; k++) {
      var inds = matches[k].policy.industries || [];
      for (var ki = 0; ki < inds.length; ki++) {
        if (!indMap[inds[ki]]) indMap[inds[ki]] = { count: 0, fund: 0 };
        indMap[inds[ki]].count++;
        indMap[inds[ki]].fund += matches[k].fund;
      }
    }

    var summaryHtml =
      '<div class="pm-result-summary">' +
        '<div class="pm-result-stat primary"><span class="pm-stat-value">' + totalFund + '</span><span class="pm-stat-label">年预计可申报金额（万元）</span></div>' +
        '<div class="pm-result-stat"><span class="pm-stat-value">' + matches.length + '</span><span class="pm-stat-label">符合申报的条例数</span></div>' +
      '</div>';

    // dept chart (horizontal bars)
    var deptChartHtml = '<div class="pm-chart-section"><h3>匹配政策管理部门信息</h3><div class="pm-bar-chart">';
    var deptKeys = Object.keys(deptMap);
    var maxDeptFund = 1;
    for (var di = 0; di < deptKeys.length; di++) { if (deptMap[deptKeys[di]].fund > maxDeptFund) maxDeptFund = deptMap[deptKeys[di]].fund; }
    for (var dj = 0; dj < deptKeys.length; dj++) {
      var dk = deptKeys[dj];
      var pct = Math.round(deptMap[dk].fund / maxDeptFund * 100);
      deptChartHtml += '<div class="pm-bar-row"><span class="pm-bar-label">' + esc(dk) + '</span><div class="pm-bar-track"><div class="pm-bar-fill" style="width:' + pct + '%"></div></div><span class="pm-bar-val">' + deptMap[dk].fund + '万</span></div>';
    }
    deptChartHtml += '</div></div>';

    // industry chart
    var indChartHtml = '<div class="pm-chart-section"><h3>可申报项目行业分布</h3><div class="pm-bar-chart">';
    var indKeys = Object.keys(indMap);
    var maxIndFund = 1;
    for (var ii = 0; ii < indKeys.length; ii++) { if (indMap[indKeys[ii]].fund > maxIndFund) maxIndFund = indMap[indKeys[ii]].fund; }
    for (var ij = 0; ij < indKeys.length; ij++) {
      var ik = indKeys[ij];
      var ipct = Math.round(indMap[ik].fund / maxIndFund * 100);
      indChartHtml += '<div class="pm-bar-row"><span class="pm-bar-label">' + esc(ik) + '</span><div class="pm-bar-track"><div class="pm-bar-fill ind" style="width:' + ipct + '%"></div></div><span class="pm-bar-val">' + indMap[ik].count + '项 / ' + indMap[ik].fund + '万</span></div>';
    }
    indChartHtml += '</div></div>';

    // result table
    var tableHtml =
      '<div class="pm-table-wrap"><table class="pm-table"><thead><tr>' +
        '<th>#</th><th>符合的条例</th><th>资助额度</th><th>管理部门</th><th>联系方式</th><th>截止日期</th>' +
      '</tr></thead><tbody>';
    for (var ti = 0; ti < matches.length; ti++) {
      var mp = matches[ti].policy;
      tableHtml += '<tr><td>' + (ti + 1) + '</td><td><a class="pm-policy-link" data-action="pm_show_policy" data-id="' + esc(mp.id) + '">' + esc(mp.name) + '</a><br/><span class="muted small">' + esc(mp.summary) + '</span></td><td class="num">' + mp.fund_max + ' ' + esc(mp.fund_unit) + '</td><td>' + esc(mp.dept) + '</td><td>' + esc(mp.contact) + '</td><td>' + esc(mp.deadline) + '</td></tr>';
    }
    tableHtml += '</tbody></table></div>';

    return (
      '<div class="pm-page fade-in">' +
        '<div class="pm-card">' +
          '<div class="pm-result-head"><h2>匹配结果</h2><span class="pm-ent-badge">' + esc(ent.name) + '</span>' +
          '<div class="pm-result-actions"><button class="btn pm-manual-btn" data-action="pm_manual_verify">' + uiIcon('check', 'link-icon') + '人工核实</button>' +
          '<button class="btn pm-manual-btn" data-action="pm_manual_service">' + uiIcon('user', 'link-icon') + '人工服务</button>' +
          '<button class="btn pm-back-btn" data-action="pm_back_form">返回筛选</button></div></div>' +
          summaryHtml +
          '<div class="pm-charts-row">' + deptChartHtml + indChartHtml + '</div>' +
          tableHtml +
        '</div>' +
        '<div class="pm-footer-info">咨询电话：12345678 &nbsp;|&nbsp; 工作时间：周一至周五 9:00-17:00</div>' +
      '</div>'
    );
  }

  /* --- 政策找企业 --- */
  var _pmGovState = {
    policyId: "",
    policyDistrict: "",
    policyDept: "",
    policyType: "",
    policyIndustry: "",
    selectedEnterpriseIds: [],
    page: 1,
    areaFilter: "all",
    indFilter: "",
    scaleFilter: "",
    typeFilter: ""
  };

  function _pmMatchEnterprises(policy) {
    if (!policy) return [];
    var ents = govDemoEnterprises();
    var results = [];
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      var industryMatch = !policy.industries || policy.industries.indexOf(e.industry) >= 0;
      var levelMatch = !policy.levels || policy.levels.indexOf(e.level) >= 0;
      if (industryMatch || levelMatch) {
        var score = 0;
        if (industryMatch) score += 50;
        if (levelMatch) score += 30;
        var kpis = e.kpis || {};
        if (kpis.revenue_y > 1) score += 10;
        if (kpis.r_and_d > 0.1) score += 10;
        results.push({ ent: e, score: Math.min(score, 100), fund: Math.round(policy.fund_max * (0.3 + score * 0.007)) });
      }
    }
    results.sort(function (a, b) { return b.score - a.score; });
    return results;
  }

  function _pmEnterpriseContact(ent) {
    var key = String(ent.id || ent.uscc || ent.name || "");
    var h = hashNumber(key);
    var digitMatch = key.match(/(\d+)/g);
    var seedNo = digitMatch && digitMatch.length ? Number(digitMatch[digitMatch.length - 1]) : h;
    var surnames = ["李", "王", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴", "何", "林"];
    var titles = ["经理", "主任", "总监", "专员", "负责人"];
    var prefix = ["138", "139", "186", "187", "188"][h % 5];
    var mid = String(1000 + (Math.floor(h / 11) % 9000));
    var tail = String(1000 + (Math.floor(h / 97) % 9000));
    var emailLocal = "biz-" + String(ent.id || "demo").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
    var explicitPhone = String((ent && ent.contact_phone) || "").trim();
    var explicitEmail = String((ent && ent.contact_email) || "").trim();
    var explicitPerson = String((ent && ent.contact_person) || "").trim();
    var mode = seedNo % 8;
    var hasPhone = !!explicitPhone;
    var hasEmail = !!explicitEmail;
    if (!explicitPhone && !explicitEmail) {
      if (mode === 0) {
        hasPhone = false;
        hasEmail = false;
      } else if (mode <= 2) {
        hasPhone = true;
        hasEmail = false;
      } else if (mode === 3) {
        hasPhone = false;
        hasEmail = true;
      } else {
        hasPhone = true;
        hasEmail = true;
      }
    }
    var statusClass = "complete";
    var statusLabel = "联系方式完整";
    if (!hasPhone && !hasEmail) {
      statusClass = "missing";
      statusLabel = "联系方式缺失";
    } else if (hasPhone && !hasEmail) {
      statusClass = "phone-only";
      statusLabel = "仅留电话";
    } else if (!hasPhone && hasEmail) {
      statusClass = "email-only";
      statusLabel = "仅留邮箱";
    }
    return {
      person: explicitPerson || (surnames[h % surnames.length] + titles[Math.floor(h / 7) % titles.length]),
      phone: hasPhone ? (explicitPhone || (prefix + "-" + mid + "-" + tail)) : "",
      email: hasEmail ? (explicitEmail || (emailLocal + "@demo-enterprise.cn")) : "",
      phone_present: hasPhone,
      email_present: hasEmail,
      status_class: statusClass,
      status_label: statusLabel,
      phone_state: hasPhone ? (hasEmail ? "complete" : "partial") : "missing",
      email_state: hasEmail ? (hasPhone ? "complete" : "partial") : "missing"
    };
  }

  function _pmGovOptionValues(list, getter) {
    var seen = {};
    var out = [];
    for (var i = 0; i < (list || []).length; i++) {
      var value = getter(list[i], i);
      if (Array.isArray(value)) {
        for (var j = 0; j < value.length; j++) {
          var item = String(value[j] || "").trim();
          if (!item || seen[item]) continue;
          seen[item] = true;
          out.push(item);
        }
      } else {
        var single = String(value || "").trim();
        if (!single || seen[single]) continue;
        seen[single] = true;
        out.push(single);
      }
    }
    return out.sort(function (a, b) {
      return String(a).localeCompare(String(b), "zh-CN");
    });
  }

  function pagePolicyGov(rt) {
    var q = (rt && rt.q) || {};
    var policyId = q.pid || _pmGovState.policyId || "";
    _pmGovState.policyId = policyId;
    var policyDistrict = govDemoDistrictId();
    var policyDept = q.pdept || _pmGovState.policyDept || "";
    var policyType = q.ptype || _pmGovState.policyType || "";
    var policyIndustry = q.pind || _pmGovState.policyIndustry || "";
    _pmGovState.policyDistrict = policyDistrict;
    _pmGovState.policyDept = policyDept;
    _pmGovState.policyType = policyType;
    _pmGovState.policyIndustry = policyIndustry;

    var areaFilter = q.area || _pmGovState.areaFilter || "all";
    var indFilter = q.ind || _pmGovState.indFilter || "";
    var scaleFilter = q.scale || _pmGovState.scaleFilter || "";
    var typeFilter = q.type || _pmGovState.typeFilter || "";
    var currentPage = Math.max(1, Number(q.page || _pmGovState.page || 1) || 1);
    _pmGovState.page = currentPage;

    var navBar =
      '<div class="kp-topline pm-topbar">' +
        '<div class="kp-topline-main">' + uiIcon('policy') + '<span>政策找企业</span></div>' +
        '<div class="kp-topline-actions pm-topbar-actions"><span class="pm-topbar-note">仅展示本区政策数据</span><a class="kp-back-link pm-back" href="#/gov/policy-match">' + uiIcon('back', 'link-icon') + '<span>返回专题首页</span></a></div>' +
      '</div>';

    var policies = govDemoPolicies();
    var districtOptions = [govDemoDistrictId()];
    if (policyDistrict && districtOptions.indexOf(policyDistrict) < 0) policyDistrict = "";
    var districtFilteredPolicies = policyDistrict
      ? policies.filter(function (p) { return p.district_id === policyDistrict; })
      : policies.slice();

    var deptOptions = _pmGovOptionValues(districtFilteredPolicies, function (p) { return p.dept || ""; });
    if (policyDept && deptOptions.indexOf(policyDept) < 0) policyDept = "";
    var deptFilteredPolicies = policyDept
      ? districtFilteredPolicies.filter(function (p) { return p.dept === policyDept; })
      : districtFilteredPolicies.slice();

    var policyTypeOptions = _pmGovOptionValues(deptFilteredPolicies, function (p) { return p.type || ""; });
    if (policyType && policyTypeOptions.indexOf(policyType) < 0) policyType = "";
    var typeFilteredPolicies = policyType
      ? deptFilteredPolicies.filter(function (p) { return p.type === policyType; })
      : deptFilteredPolicies.slice();

    var policyIndustryOptions = _pmGovOptionValues(typeFilteredPolicies, function (p) { return p.industries || []; });
    if (policyIndustry && policyIndustryOptions.indexOf(policyIndustry) < 0) policyIndustry = "";
    var policyCandidates = policyIndustry
      ? typeFilteredPolicies.filter(function (p) {
          return Array.isArray(p.industries) && p.industries.indexOf(policyIndustry) >= 0;
        })
      : typeFilteredPolicies.slice();

    if (policyId && !policyCandidates.some(function (p) { return p.id === policyId; })) policyId = "";
    _pmGovState.policyId = policyId;
    _pmGovState.policyDistrict = policyDistrict;
    _pmGovState.policyDept = policyDept;
    _pmGovState.policyType = policyType;
    _pmGovState.policyIndustry = policyIndustry;

    var districtOptsHtml = '<option value="">全部区域</option>';
    for (var di = 0; di < districtOptions.length; di++) {
      var districtMeta = geoDistrictById(districtOptions[di]) || {};
      districtOptsHtml += '<option value="' + esc(districtOptions[di]) + '"' + (districtOptions[di] === policyDistrict ? ' selected' : '') + '>' + esc(districtMeta.name || districtOptions[di]) + '</option>';
    }

    var deptOptsHtml = '<option value="">全部部门</option>';
    for (var dpti = 0; dpti < deptOptions.length; dpti++) {
      deptOptsHtml += '<option value="' + esc(deptOptions[dpti]) + '"' + (deptOptions[dpti] === policyDept ? ' selected' : '') + '>' + esc(deptOptions[dpti]) + '</option>';
    }

    var policyTypeOptsHtml = '<option value="">全部类型</option>';
    for (var pti = 0; pti < policyTypeOptions.length; pti++) {
      policyTypeOptsHtml += '<option value="' + esc(policyTypeOptions[pti]) + '"' + (policyTypeOptions[pti] === policyType ? ' selected' : '') + '>' + esc(policyTypeOptions[pti]) + '</option>';
    }

    var policyIndustryOptsHtml = '<option value="">全部产业</option>';
    for (var pii = 0; pii < policyIndustryOptions.length; pii++) {
      policyIndustryOptsHtml += '<option value="' + esc(policyIndustryOptions[pii]) + '"' + (policyIndustryOptions[pii] === policyIndustry ? ' selected' : '') + '>' + esc(policyIndustryOptions[pii]) + '</option>';
    }

    var policyOpts = '<option value="">请选择具体政策</option>';
    for (var pi = 0; pi < policyCandidates.length; pi++) {
      policyOpts += '<option value="' + esc(policyCandidates[pi].id) + '"' + (policyCandidates[pi].id === policyId ? ' selected' : '') + '>' + esc(policyCandidates[pi].name) + ' (' + esc(policyCandidates[pi].dept) + ')</option>';
    }

    var policySelector =
      '<div class="pm-card pm-policy-selector">' +
        '<h2 class="pm-card-title">政策选择</h2>' +
        '<p class="pm-hint">请按区域、部门、类型和产业逐级缩小范围，再选择具体政策。</p>' +
        '<div class="pm-form-grid pm-policy-form-grid">' +
          '<label class="pm-field"><span>适用区域</span><select data-pm-gov-policy="district">' + districtOptsHtml + '</select></label>' +
          '<label class="pm-field"><span>发文部门</span><select data-pm-gov-policy="dept">' + deptOptsHtml + '</select></label>' +
          '<label class="pm-field"><span>政策类型</span><select data-pm-gov-policy="ptype">' + policyTypeOptsHtml + '</select></label>' +
          '<label class="pm-field"><span>适用产业</span><select data-pm-gov-policy="industry">' + policyIndustryOptsHtml + '</select></label>' +
          '<label class="pm-field pm-field-wide"><span>具体政策</span><select data-pm-gov-policy="policy">' + policyOpts + '</select></label>' +
        '</div>' +
        '<div class="pm-policy-filter-meta">当前可选政策 <b>' + policyCandidates.length + '</b> 条</div>' +
      '</div>';

    if (!policyId) {
      return navBar + '<div class="pm-page fade-in">' + policySelector + '<div class="pm-card"><p class="muted" style="text-align:center;padding:40px 0;">请先按上方条件逐级筛选政策，系统将自动匹配符合条件的企业</p></div></div>';
    }

    var policy = null;
    for (var pj = 0; pj < policies.length; pj++) { if (policies[pj].id === policyId) { policy = policies[pj]; break; } }
    if (!policy) return navBar + '<div class="pm-page fade-in">' + policySelector + '<div class="pm-card"><p class="muted">未找到该政策。</p></div></div>';

    // policy basic info
    var policyInfoHtml =
      '<div class="pm-policy-info">' +
        '<div class="pm-info-row"><span class="pm-info-label">政策名称</span><span class="pm-info-value">' + esc(policy.name) + '</span></div>' +
        '<div class="pm-info-row"><span class="pm-info-label">发文部门</span><span class="pm-info-value">' + esc(policy.dept) + '</span></div>' +
        '<div class="pm-info-row"><span class="pm-info-label">截止日期</span><span class="pm-info-value">' + esc(policy.deadline) + '</span></div>' +
        '<div class="pm-info-row"><span class="pm-info-label">最高资助</span><span class="pm-info-value">' + policy.fund_max + ' ' + esc(policy.fund_unit) + '</span></div>' +
      '</div>';

    // matched enterprises
    var allMatches = _pmMatchEnterprises(policy);

    // Apply filters
    var filtered = allMatches;
    if (indFilter) {
      filtered = filtered.filter(function (m) { return m.ent.industry === indFilter; });
    }
    if (scaleFilter) {
      filtered = filtered.filter(function (m) { return m.ent.level === scaleFilter; });
    }
    if (typeFilter) {
      filtered = filtered.filter(function (m) {
        if (typeFilter === "免申即享") return policy.type === "免申即享";
        if (typeFilter === "普通项目") return policy.type === "普通项目";
        return true;
      });
    }

    // Dashboard stats
    var totalEnts = filtered.length;
    var totalFund = 0;
    var indDist = {};
    var scaleDist = {};
    for (var ei = 0; ei < filtered.length; ei++) {
      totalFund += filtered[ei].fund;
      var ind = filtered[ei].ent.industry;
      indDist[ind] = (indDist[ind] || 0) + 1;
      var sc = filtered[ei].ent.level;
      scaleDist[sc] = (scaleDist[sc] || 0) + 1;
    }

    // Dashboard cards
    var dashHtml =
      '<div class="pm-gov-dashboard">' +
        '<div class="pm-gov-stat accent"><span class="pm-stat-value">' + totalEnts + '</span><span class="pm-stat-label">符合企业总数</span></div>' +
        '<div class="pm-gov-stat"><span class="pm-stat-value">' + totalFund + '</span><span class="pm-stat-label">预估资助总额（万元）</span></div>' +
      '</div>';

    // Industry distribution mini chart
    var indChartHtml = '<div class="pm-mini-chart"><h4>企业行业分布</h4>';
    var indKs = Object.keys(indDist);
    for (var ci = 0; ci < indKs.length; ci++) {
      var cn = indKs[ci];
      var cpct = totalEnts > 0 ? Math.round(indDist[cn] / totalEnts * 100) : 0;
      indChartHtml += '<div class="pm-mini-row"><span>' + esc(cn) + '</span><div class="pm-mini-bar"><div class="pm-mini-fill" style="width:' + cpct + '%"></div></div><span>' + cpct + '%</span></div>';
    }
    indChartHtml += '</div>';

    // Scale distribution mini chart
    var scaleChartHtml = '<div class="pm-mini-chart"><h4>企业规模分布</h4>';
    var scKs = Object.keys(scaleDist);
    for (var sci = 0; sci < scKs.length; sci++) {
      var sn = scKs[sci];
      var spct = totalEnts > 0 ? Math.round(scaleDist[sn] / totalEnts * 100) : 0;
      scaleChartHtml += '<div class="pm-mini-row"><span>' + esc(sn) + '</span><div class="pm-mini-bar"><div class="pm-mini-fill scale" style="width:' + spct + '%"></div></div><span>' + spct + '%</span></div>';
    }
    scaleChartHtml += '</div>';

    // Filter bar
    var indFilterOpts = '<option value="">全部行业</option>';
    (seed.industries || []).forEach(function (ind) {
      indFilterOpts += '<option value="' + esc(ind.name) + '"' + (ind.name === indFilter ? ' selected' : '') + '>' + esc(ind.name) + '</option>';
    });

    var pageSize = 10;
    var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    _pmGovState.page = currentPage;
    var pageStart = (currentPage - 1) * pageSize;
    var pageEnd = pageStart + pageSize;
    var pagedMatches = filtered.slice(pageStart, pageEnd);
    var filteredIds = filtered.map(function (item) { return item.ent.id; });
    var visibleTopIds = pagedMatches.map(function (item) { return item.ent.id; });
    var selectedEnterpriseIds = ((_pmGovState.selectedEnterpriseIds || []).filter(function (id) {
      return filteredIds.indexOf(id) >= 0;
    }));
    _pmGovState.selectedEnterpriseIds = selectedEnterpriseIds;
    var pageSelectedIds = selectedEnterpriseIds.filter(function (id) {
      return visibleTopIds.indexOf(id) >= 0;
    });
    var allSelected = pagedMatches.length > 0 && pageSelectedIds.length === pagedMatches.length;
    var selectedPreviewHtml = "";
    if (selectedEnterpriseIds.length) {
      var selectedEntMap = {};
      filtered.forEach(function (item) {
        if (selectedEnterpriseIds.indexOf(item.ent.id) >= 0) selectedEntMap[item.ent.id] = item.ent;
      });
      var selectedPreviewNames = selectedEnterpriseIds
        .map(function (id) { return selectedEntMap[id]; })
        .filter(Boolean)
        .slice(0, 5)
        .map(function (ent) { return '<span class="pm-selected-pill">' + esc(ent.name) + '</span>'; })
        .join("");
      var moreSelected = selectedEnterpriseIds.length > 5
        ? '<span class="pm-selected-more">+' + (selectedEnterpriseIds.length - 5) + '</span>'
        : "";
      selectedPreviewHtml =
        '<div class="pm-selected-preview">' +
          '<div class="pm-selected-preview-head"><span>已选企业</span><b>' + selectedEnterpriseIds.length + ' 家</b><button type="button" class="btn tiny" data-action="pm_gov_clear_selection">清空已选</button></div>' +
          '<div class="pm-selected-preview-list">' + selectedPreviewNames + moreSelected + '</div>' +
        '</div>';
    }
    var filterHtml =
      '<div class="pm-filter-bar">' +
        '<label><span>行业</span><select data-pm-gov="ind">' + indFilterOpts + '</select></label>' +
        '<label><span>规模</span><select data-pm-gov="scale">' +
          '<option value="">全部</option>' +
          '<option value="规上"' + (scaleFilter === "规上" ? ' selected' : '') + '>规上</option>' +
          '<option value="规下"' + (scaleFilter === "规下" ? ' selected' : '') + '>规下</option>' +
        '</select></label>' +
        '<label><span>类型</span><select data-pm-gov="type">' +
          '<option value="">全部</option>' +
          '<option value="普通项目"' + (typeFilter === "普通项目" ? ' selected' : '') + '>普通项目</option>' +
          '<option value="免申即享"' + (typeFilter === "免申即享" ? ' selected' : '') + '>免申即享</option>' +
        '</select></label>' +
        '<div class="pm-filter-actions">' +
          '<button class="btn primary small" data-action="pm_gov_push">一键推送选中企业</button>' +
          '<span class="pm-filter-pick-count">已勾选 ' + selectedEnterpriseIds.length + ' 家</span>' +
        '</div>' +
      '</div>';
    var tableHtml =
      '<div class="pm-table-wrap"><h3>共 ' + filtered.length + ' 家企业 · 第 ' + currentPage + ' / ' + totalPages + ' 页 · 本页 ' + pagedMatches.length + ' 家</h3>' +
      '<table class="pm-table"><thead><tr>' +
        '<th class="pm-check-cell"><label class="pm-check-all"><input type="checkbox" data-action="pm_gov_toggle_all" ' + (allSelected ? 'checked ' : '') + (pagedMatches.length ? '' : 'disabled ') + '/><span>本页全选</span></label></th><th>排名</th><th>企业名称</th><th>行业</th><th>规模</th><th>匹配度</th><th>预估资助额</th><th>电话</th><th>邮箱</th><th>详情</th>' +
      '</tr></thead><tbody>';
    if (!pagedMatches.length) {
      tableHtml += '<tr><td colspan="10" class="muted table-empty-cell">当前筛选条件下暂无符合要求的企业，请调整政策、行业或筛选条件后重试。</td></tr>';
    } else {
      for (var ti = 0; ti < pagedMatches.length; ti++) {
        var te = pagedMatches[ti].ent;
        var teContact = _pmEnterpriseContact(te);
        var phoneCellHtml = teContact.phone_present
          ? '<button type="button" class="pm-copy-link pm-contact-phone is-' + teContact.phone_state + '" data-action="pm_copy_text" data-label="电话" data-value="' + esc(teContact.phone) + '">' + esc(teContact.phone) + '</button>'
          : '<span class="pm-contact-missing pm-contact-phone is-missing">待补充</span>';
        var emailCellHtml = teContact.email_present
          ? '<button type="button" class="pm-copy-link pm-contact-email is-' + teContact.email_state + '" data-action="pm_copy_text" data-label="邮箱" data-value="' + esc(teContact.email) + '">' + esc(teContact.email) + '</button>'
          : '<span class="pm-contact-missing pm-contact-email is-missing">待补充</span>';
        tableHtml += '<tr class="' + (selectedEnterpriseIds.indexOf(te.id) >= 0 ? 'pm-selected-row' : '') + '">' +
          '<td class="pm-check-cell"><input type="checkbox" data-action="pm_gov_toggle_ent" data-id="' + esc(te.id) + '"' + (selectedEnterpriseIds.indexOf(te.id) >= 0 ? ' checked' : '') + ' /></td>' +
          '<td>' + (pageStart + ti + 1) + '</td>' +
          '<td>' + esc(te.name) + '</td>' +
          '<td>' + esc(te.industry) + '</td>' +
          '<td>' + esc(te.level) + '</td>' +
          '<td><span class="pm-score">' + pagedMatches[ti].score + '</span></td>' +
          '<td class="num">' + pagedMatches[ti].fund + ' 万</td>' +
          '<td class="pm-contact-cell">' + phoneCellHtml + '</td>' +
          '<td class="pm-contact-cell">' + emailCellHtml + '</td>' +
          '<td class="pm-detail-cell"><a class="btn tiny pm-detail-link" href="#/gov/portrait/' + esc(te.id) + '">查看详情</a></td></tr>';
      }
    }
    tableHtml += '</tbody></table>';
    if (totalPages > 1) {
      tableHtml += '<div class="pm-pagination">';
      tableHtml += '<button type="button" class="btn small" data-action="pm_gov_page" data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '>上一页</button>';
      for (var pageNo = 1; pageNo <= totalPages; pageNo++) {
        if (pageNo === currentPage || pageNo === 1 || pageNo === totalPages || Math.abs(pageNo - currentPage) <= 1) {
          tableHtml += '<button type="button" class="btn small' + (pageNo === currentPage ? ' active' : '') + '" data-action="pm_gov_page" data-page="' + pageNo + '">' + pageNo + '</button>';
        } else if (pageNo === currentPage - 2 || pageNo === currentPage + 2) {
          tableHtml += '<span class="pm-page-ellipsis">...</span>';
        }
      }
      tableHtml += '<button type="button" class="btn small" data-action="pm_gov_page" data-page="' + (currentPage + 1) + '"' + (currentPage >= totalPages ? ' disabled' : '') + '>下一页</button>';
      tableHtml += '</div>';
    }
    tableHtml += '</div>';

    return navBar +
      '<div class="pm-page fade-in">' +
        policySelector +
        '<div class="pm-card">' +
          '<h2 class="pm-card-title">政策基本信息</h2>' +
          policyInfoHtml +
        '</div>' +
        '<div class="pm-card">' +
          '<h2 class="pm-card-title">企业看板</h2>' +
          dashHtml +
          '<div class="pm-charts-row">' + indChartHtml + scaleChartHtml + '</div>' +
          '<p class="pm-portrait-link"><a href="#/gov/portrait">点击跳转至"企业精准画像"界面 →</a></p>' +
        '</div>' +
        '<div class="pm-card">' +
          '<h2 class="pm-card-title">企业筛选与排行</h2>' +
          filterHtml +
          selectedPreviewHtml +
          tableHtml +
        '</div>' +
        '<div class="pm-footer-info">AI 模型接口 &nbsp;|&nbsp; 咨询电话：12345678</div>' +
      '</div>';
  }

  /* ════════════════════════════════════════════════════════
   *  企业精准画像系统 — 主列表页
   * ════════════════════════════════════════════════════════ */
  function pageGovPortrait(rt) {
    var q = ((rt.q && rt.q.q) || "").trim();
    var page = Math.max(1, Number((rt.q && rt.q.page) || 1) || 1);
    var pageSize = 10;
    var filterMode = (rt.q && rt.q.filter) || "";
    var filterVal  = (rt.q && rt.q.fv) || "";
    var filterNodeId = (rt.q && rt.q.nid) || "";
    var industryCategoryFilter = (rt.q && rt.q.industry_cat) || (filterMode === "industry" ? filterVal : "");
    var industryFilter = (rt.q && rt.q.industry) || "";
    var policyIdFilter = (rt.q && rt.q.policy_id) || "";
    var legacyCarrierFilter = (rt.q && rt.q.carrier) || (filterMode === "carrier" ? filterVal : "");
    var chainFilterLabel = (rt.q && rt.q.chain_label) || (filterMode === "chain" ? filterVal : "");
    var chainFilterNodeId = (rt.q && rt.q.chain_nid) || filterNodeId || "";
    var ents = govDemoEnterprises();
    var policies = govDemoPolicies();
    var preservePortraitOrder = false;
    var chainMatchMap = {};

    // ── spatial carriers (demo) ──
    var geoCarriers = seed.geo || {};
    var geoDistricts = govDemoGeoItems(geoCarriers.districts || []);
    var geoStreets = govDemoGeoItems(geoCarriers.streets || []);
    var geoParks = govDemoGeoItems(geoCarriers.parks || []);
    var geoBuildings = govDemoGeoItems(geoCarriers.buildings || []);
    var carriers = {
      districts: chainUniqueStrings((geoDistricts.length ? geoDistricts : [
        { name: "青羊区" }, { name: "锦江区" }, { name: "武侯区" }, { name: "成华区" }
      ]).map(function (item) { return item.name; })),
      streets: chainUniqueStrings((geoStreets.length ? geoStreets : [
        { name: "西御河街道" }, { name: "草市街街道" }, { name: "少城街道" }, { name: "府南街道" }, { name: "草堂街道" }, { name: "光华街道" }, { name: "金沙街道" }, { name: "苏坡街道" }, { name: "文家街道" }
      ]).map(function (item) { return item.name; })),
      parks: chainUniqueStrings((geoParks || []).map(function (item) { return item.name; })),
      buildings: chainUniqueStrings((geoBuildings.length ? geoBuildings : [
        { name: "金沙科创中心 A 座" }, { name: "西城智谷 2 号楼" }, { name: "府南航空配套园 1 栋" }, { name: "青羊工业载体 B 区" }, { name: "太升金融中心" }, { name: "太升商贸城" }, { name: "宽巷子文创园 A 座" }, { name: "宽巷子文创园 B 座" }, { name: "草堂科技产业园 2 栋" }, { name: "草堂科技产业园 5 栋" }, { name: "光华国际大厦" }, { name: "光华云计算中心" }, { name: "苏坡工业集中区 5 号厂房" }, { name: "苏坡物流园 A 区" }, { name: "苏坡物流园 B 区" }, { name: "文家生态产业园 A 区" }, { name: "文家生态产业园 C 区" }, { name: "政务服务中心" }
      ]).map(function (item) { return item.name; }))
    };

    var districtByName = {};
    var streetByName = {};
    var parkByName = {};
    var buildingByName = {};
    var streetsByDistrictName = {};
    var parksByDistrictName = {};
    var parksByStreetName = {};
    var buildingsByStreetName = {};
    var buildingsByParkName = {};

    geoDistricts.forEach(function (d) {
      if (!d || !d.name) return;
      districtByName[d.name] = { id: d.id, name: d.name };
    });
    geoStreets.forEach(function (s) {
      if (!s || !s.name) return;
      var districtName = ((geoDistricts.filter(function (d) { return d.id === s.district_id; })[0] || {}).name) || "";
      streetByName[s.name] = { id: s.id, name: s.name, district_id: s.district_id, district_name: districtName };
      if (districtName) {
        streetsByDistrictName[districtName] = (streetsByDistrictName[districtName] || []).concat([s.name]);
      }
    });
    geoParks.forEach(function (p) {
      if (!p || !p.name) return;
      var parkDistrictName = ((geoDistricts.filter(function (d) { return d.id === p.district_id; })[0] || {}).name) || "";
      var parkStreetName = ((geoStreets.filter(function (s) { return s.id === p.street_id; })[0] || {}).name) || "";
      parkByName[p.name] = { id: p.id, name: p.name, district_id: p.district_id, district_name: parkDistrictName, street_id: p.street_id, street_name: parkStreetName };
      if (parkDistrictName) parksByDistrictName[parkDistrictName] = (parksByDistrictName[parkDistrictName] || []).concat([p.name]);
      if (parkStreetName) parksByStreetName[parkStreetName] = (parksByStreetName[parkStreetName] || []).concat([p.name]);
    });
    geoBuildings.forEach(function (b) {
      if (!b || !b.name) return;
      var buildingStreetName = ((geoStreets.filter(function (s) { return s.id === b.street_id; })[0] || {}).name) || "";
      var buildingParkName = ((geoParks.filter(function (p) { return p.id === b.park_id; })[0] || {}).name) || "";
      var buildingDistrictName =
        ((streetByName[buildingStreetName] || {}).district_name) ||
        ((parkByName[buildingParkName] || {}).district_name) ||
        "";
      buildingByName[b.name] = {
        id: b.id,
        name: b.name,
        street_id: b.street_id,
        street_name: buildingStreetName,
        park_id: b.park_id,
        park_name: buildingParkName,
        district_name: buildingDistrictName
      };
      if (buildingStreetName) buildingsByStreetName[buildingStreetName] = (buildingsByStreetName[buildingStreetName] || []).concat([b.name]);
      if (buildingParkName) buildingsByParkName[buildingParkName] = (buildingsByParkName[buildingParkName] || []).concat([b.name]);
    });

    function pushCarrierAlias(target, key, values) {
      if (!key) return;
      target[key] = chainUniqueStrings((target[key] || []).concat(values || []).concat([key]));
    }

    function buildPortraitCarrierAliasMap() {
      var aliasMap = {};
      Object.keys(streetByName).forEach(function (streetName) {
        pushCarrierAlias(aliasMap, streetName, []
          .concat(parksByStreetName[streetName] || [])
          .concat(buildingsByStreetName[streetName] || []));
      });
      Object.keys(parkByName).forEach(function (parkName) {
        pushCarrierAlias(aliasMap, parkName, buildingsByParkName[parkName] || []);
      });
      Object.keys(districtByName).forEach(function (districtName) {
        pushCarrierAlias(aliasMap, districtName, []
          .concat(streetsByDistrictName[districtName] || [])
          .concat(parksByDistrictName[districtName] || []));
        (streetsByDistrictName[districtName] || []).forEach(function (streetName) {
          pushCarrierAlias(aliasMap, districtName, buildingsByStreetName[streetName] || []);
        });
      });

      var manualExtras = {
        "青羊区": ["草堂北路"],
        "锦江区": ["春熙", "东大街金融城", "锦江金融城", "合江亭", "书院", "太古里", "IFS"],
        "武侯区": ["武侯祠", "锦里"],
        "成华区": ["东郊记忆"]
      };
      Object.keys(manualExtras).forEach(function (key) {
        pushCarrierAlias(aliasMap, key, manualExtras[key]);
      });
      return aliasMap;
    }

    var portraitCarrierAliasMap = buildPortraitCarrierAliasMap();

    function resolvePortraitCarrierSelections() {
      var selected = {
        district: (rt.q && rt.q.carrier_district) || "",
        street: (rt.q && rt.q.carrier_street) || "",
        park: (rt.q && rt.q.carrier_park) || "",
        building: (rt.q && rt.q.carrier_building) || ""
      };
      if (!selected.district && !selected.street && !selected.park && !selected.building && legacyCarrierFilter) {
        if (buildingByName[legacyCarrierFilter]) selected.building = legacyCarrierFilter;
        else if (parkByName[legacyCarrierFilter]) selected.park = legacyCarrierFilter;
        else if (streetByName[legacyCarrierFilter]) selected.street = legacyCarrierFilter;
        else if (districtByName[legacyCarrierFilter]) selected.district = legacyCarrierFilter;
      }
      if (selected.building && buildingByName[selected.building]) {
        selected.park = buildingByName[selected.building].park_name || selected.park;
        selected.street = buildingByName[selected.building].street_name || selected.street;
        selected.district = buildingByName[selected.building].district_name || selected.district;
      }
      if (selected.park && parkByName[selected.park]) {
        selected.street = parkByName[selected.park].street_name || selected.street;
        selected.district = parkByName[selected.park].district_name || selected.district;
      }
      if (selected.street && streetByName[selected.street]) {
        selected.district = streetByName[selected.street].district_name || selected.district;
      }
      return selected;
    }

    var carrierSelections = resolvePortraitCarrierSelections();
    var carrierDistrictFilter = carrierSelections.district;
    var carrierStreetFilter = carrierSelections.street;
    var carrierParkFilter = carrierSelections.park;
    var carrierBuildingFilter = carrierSelections.building;
    var portraitIndustryDistrict = carrierDistrictFilter || govDemoDistrictName();

    var portraitDistrictIndustryMap = {
      "全市": ["航空航天", "人工智能", "金融", "商务商贸", "文化旅游", "文旅", "低空经济"],
      "青羊区": ["航空航天", "金融", "人工智能", "文化旅游", "文旅", "商务商贸", "低空经济"],
      "锦江区": ["商务商贸", "金融", "文化旅游", "文旅", "人工智能", "航空航天", "低空经济"],
      "武侯区": ["人工智能", "航空航天", "金融", "商务商贸", "低空经济", "文旅", "文化旅游"],
      "成华区": ["航空航天", "人工智能", "商务商贸", "低空经济", "金融", "文化旅游", "文旅"]
    };

    function portraitCarrierAliases(value) {
      return chainUniqueStrings([value].concat(portraitCarrierAliasMap[value] || []));
    }

    function portraitMatchesCarrier(e, carrier) {
      if (!carrier) return true;
      var haystack = [e.name || "", e.address || "", e.grid || ""].join(" | ").toLowerCase();
      var aliases = portraitCarrierAliases(carrier);
      for (var i = 0; i < aliases.length; i++) {
        if (haystack.indexOf(String(aliases[i] || "").toLowerCase()) >= 0) return true;
      }
      return false;
    }

    var portraitChainCategoryRules = {
      "航空航天": ["航空", "航天", "无人机", "飞控", "航电", "机载", "机体", "吊舱", "军贸", "航空护城", "长航时", "陀螺仪", "主控芯片", "起落架", "尾翼", "机翼", "机身"],
      "人工智能": ["人工智能", "ai", "算力", "模型", "多模态", "推理引擎", "训练框架", "知识库", "agent", "智能体", "算法", "数字孪生", "机器学习", "智能质检", "视觉缺陷检测"],
      "金融": ["金融", "信贷", "授信", "融资", "保理", "征信", "风控", "基金", "担保", "贴息", "租赁", "金融科技", "消费金融", "版权金融", "科技金融", "供应链金融"],
      "商务商贸": ["商贸", "零售", "电商", "物流", "仓配", "订单中台", "会员体系", "配送", "分拨", "商圈", "品牌商", "渠道商", "平台招商", "流量运营", "履约", "售后服务"],
      "文化旅游": ["文化旅游", "文旅", "景区", "游客", "演艺", "票务", "文创", "非遗", "历史文化", "夜间经济", "城市品牌", "沉浸", "主题活动", "文博", "旅游"],
      "文旅": ["文旅", "沉浸体验", "联名文创", "场馆运营", "活动运营", "内容运营", "文化ip", "遗产资源", "数字渲染", "ar", "vr", "票务系统", "文博", "夜游"],
      "低空经济": ["低空", "空域", "物流配送", "应急巡检", "城市治理", "调度平台", "安全监测", "运维保障", "evtol", "飞行器", "场景复制", "应急救援", "巡检", "空中"]
    };
    var portraitChainCategoryCache = {};

    function portraitEnterpriseChainCategories(e) {
      var cacheKey = e && e.id ? e.id : "";
      if (cacheKey && portraitChainCategoryCache[cacheKey]) return portraitChainCategoryCache[cacheKey].slice();
      var texts = []
        .concat([e.name || "", e.industry || "", e.track || "", e.address || "", e.grid || ""])
        .concat(e.tags || [])
        .concat(e.products || [])
        .concat(e.ecosystem_role || [])
        .concat(e.chain_nodes || []);
      var normalizedText = chainUniqueStrings(texts).join(" | ").toLowerCase();
      var hits = [];
      Object.keys(portraitChainCategoryRules).forEach(function (cat) {
        var rules = portraitChainCategoryRules[cat] || [];
        for (var i = 0; i < rules.length; i++) {
          if (normalizedText.indexOf(String(rules[i] || "").toLowerCase()) >= 0) {
            hits.push(cat);
            break;
          }
        }
      });
      if (hits.length === 0) {
        if ((e.industry || "") === "现代商贸") hits.push("商务商贸");
        if ((e.industry || "") === "创新服务" && normalizedText.indexOf("金融") >= 0) hits.push("金融");
      }
      hits = chainUniqueStrings(hits);
      if (cacheKey) portraitChainCategoryCache[cacheKey] = hits.slice();
      return hits.slice();
    }

    function portraitMatchesIndustryCategory(e, category) {
      if (!category) return true;
      return portraitEnterpriseChainCategories(e).indexOf(category) >= 0;
    }

    var portraitIndustrySourceEnts = govDemoEnterprises().filter(function (e) {
      return !portraitIndustryDistrict || portraitMatchesCarrier(e, portraitIndustryDistrict);
    });
    var localIndustryOptions = (portraitDistrictIndustryMap[portraitIndustryDistrict] || portraitDistrictIndustryMap[govDemoDistrictName()] || portraitDistrictIndustryMap["全市"])
      .filter(function (ind) {
        return portraitIndustrySourceEnts.some(function (e) { return portraitMatchesIndustryCategory(e, ind); });
      });
    if (industryCategoryFilter && localIndustryOptions.indexOf(industryCategoryFilter) < 0) {
      industryCategoryFilter = "";
    }
    var industryLabelOptions = chainUniqueStrings(portraitIndustrySourceEnts.map(function (e) { return e.industry || ""; }).filter(Boolean));
    if (industryFilter && industryLabelOptions.indexOf(industryFilter) < 0) {
      industryFilter = "";
    }
    if (policyIdFilter && !policies.some(function (p) { return p.id === policyIdFilter; })) {
      policyIdFilter = "";
    }

    function portraitBuildFilterQuery(overrides) {
      var next = {
        q: q || "",
        page: page > 1 ? String(page) : "",
        industry_cat: industryCategoryFilter || "",
        industry: industryFilter || "",
        policy_id: policyIdFilter || "",
        carrier_district: carrierDistrictFilter || "",
        carrier_street: carrierStreetFilter || "",
        carrier_park: carrierParkFilter || "",
        carrier_building: carrierBuildingFilter || "",
        chain_label: chainFilterLabel || "",
        nid: chainFilterNodeId || ""
      };
      Object.keys(overrides || {}).forEach(function (key) {
        next[key] = overrides[key];
      });
      Object.keys(next).forEach(function (key) {
        if (next[key] == null || next[key] === "") delete next[key];
      });
      return next;
    }

    // ── filtering logic ──
    if (q) {
      ents = ents.filter(function (e) {
        return (e.name || "").indexOf(q) >= 0 || (e.industry || "").indexOf(q) >= 0 || (e.uscc || "").indexOf(q) >= 0 || (e.tags || []).join(",").indexOf(q) >= 0;
      });
    }
    if (chainFilterLabel) {
      var chainMatched = chainResolveMatchedEnterprises(chainFilterNodeId, chainFilterLabel);
      chainMatched.forEach(function (item) {
        if (item && item.e && item.e.id) chainMatchMap[item.e.id] = item;
      });
      ents = chainMatched.map(function (x) { return x.e; }).filter(govDemoIsInDistrict);
      preservePortraitOrder = true;
    }
    if (industryCategoryFilter) {
      ents = ents.filter(function (e) { return portraitMatchesIndustryCategory(e, industryCategoryFilter); });
    }
    if (industryFilter) {
      ents = ents.filter(function (e) { return String(e.industry || "") === industryFilter; });
    }
    var selectedPolicy = null;
    if (policyIdFilter) {
      selectedPolicy = policies.filter(function (p) { return p.id === policyIdFilter; })[0] || null;
      if (selectedPolicy) {
        var matchedIds = {};
        _pmMatchEnterprises(selectedPolicy).forEach(function (item) {
          if (item && item.ent && item.ent.id) matchedIds[item.ent.id] = true;
        });
        ents = ents.filter(function (e) { return !!matchedIds[e.id]; });
      }
    }
    var activeCarrierFilters = [carrierDistrictFilter, carrierStreetFilter, carrierParkFilter, carrierBuildingFilter].filter(function (value) { return !!value; });
    activeCarrierFilters.forEach(function (carrierName) {
      ents = ents.filter(function (e) { return portraitMatchesCarrier(e, carrierName); });
    });

    if (!preservePortraitOrder) {
      ents = ents.slice().sort(function (a, b) {
        return (a.name || "").localeCompare(b.name || "");
      });
    }

    var totalMatches = ents.length;
    var totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));
    if (page > totalPages) page = totalPages;
    var pageStart = (page - 1) * pageSize;
    var pagedEnts = ents.slice(pageStart, pageStart + pageSize);

    // ── tag badges ──
    var tagBadgeMap = { "高新技术": { abbr: "高", cls: "portrait-tag-gx", full: "高新技术企业" }, "专精特新": { abbr: "专", cls: "portrait-tag-zj", full: "专精特新企业" }, "本地配套型": { abbr: "配", cls: "portrait-tag-pd", full: "本地配套型企业" }, "研发驱动": { abbr: "研", cls: "portrait-tag-rd", full: "研发驱动型企业" }, "数据服务": { abbr: "数", cls: "portrait-tag-ds", full: "数据服务企业" }, "设备更新": { abbr: "新", cls: "portrait-tag-su", full: "设备更新企业" }, "供应链": { abbr: "链", cls: "portrait-tag-sc", full: "供应链企业" }, "法律服务": { abbr: "法", cls: "portrait-tag-fw", full: "法律服务机构" } };

    // ── summary stats ──
    var totalRevenue = 0, totalEmployees = 0, totalTax = 0;
    ents.forEach(function (e) {
      if (e.kpis) {
        totalRevenue += (e.kpis.revenue_y || 0);
        totalEmployees += (e.kpis.employees || 0);
        totalTax += (e.kpis.tax_y || 0);
      }
    });
    var innovationCount = ents.filter(function (e) {
      var tags = e.tags || [];
      return tags.indexOf("高新技术") >= 0 || tags.indexOf("专精特新") >= 0 || tags.indexOf("研发驱动") >= 0;
    }).length;
    var carrierCoverageCount = chainUniqueStrings(ents.map(function (e) {
      return e.building_id || e.park_id || e.street_id || "";
    }).filter(Boolean)).length;
    var activeFilterTags = [];
    if (industryCategoryFilter) activeFilterTags.push({ label: "产业类别", value: industryCategoryFilter });
    if (industryFilter) activeFilterTags.push({ label: "行业分类", value: industryFilter });
    if (selectedPolicy) activeFilterTags.push({ label: "政策匹配", value: selectedPolicy.name });
    if (carrierDistrictFilter) activeFilterTags.push({ label: "区域", value: carrierDistrictFilter });
    if (carrierStreetFilter) activeFilterTags.push({ label: "街道", value: carrierStreetFilter });
    if (carrierParkFilter) activeFilterTags.push({ label: "园区", value: carrierParkFilter });
    if (carrierBuildingFilter) activeFilterTags.push({ label: "楼宇", value: carrierBuildingFilter });
    if (chainFilterLabel) activeFilterTags.push({ label: "链图节点", value: chainFilterLabel });

    // ── build enterprise list rows ──
    var entRows = pagedEnts.map(function (e, idx) {
      var portraitDetailHref = (rt.q && rt.q.src === "chain") || chainFilterLabel
        ? buildHash("/gov/portrait/" + e.id, {
            src: "chain",
            district: carrierDistrictFilter || govDemoDistrictName(),
            industry: (rt.q && rt.q.industry) || industryCategoryFilter || e.track || e.industry || "",
            tab: (rt.q && rt.q.tab) || "intro",
            term: (rt.q && rt.q.term) || "",
            z: (rt.q && rt.q.z) || "",
            chain_label: chainFilterLabel || "",
            chain_nid: chainFilterNodeId || ""
          })
        : "#/gov/portrait/" + e.id;
      var badges = (e.tags || []).map(function (t) {
        var b = tagBadgeMap[t];
        if (b) return '<span class="portrait-badge ' + b.cls + '" title="' + esc(b.full) + '">' + esc(b.abbr) + '</span>';
        return '';
      }).join("");
      var chainReasonItem = chainMatchMap[e.id];
      var chainReasonHtml = chainReasonItem
        ? '<div class="portrait-ent-chain-meta"><span class="portrait-ent-chain-score">匹配度 ' +
          esc(String(chainReasonItem.sc || 0)) +
          '</span><span class="portrait-ent-chain-reason">' +
          esc(chainMatchReasonSummary(chainReasonItem, 2).join(" · ")) +
          '</span></div>'
        : "";
      var revenueText = e.kpis && e.kpis.revenue_y != null ? e.kpis.revenue_y.toFixed(1) + '亿' : '--';
      var taxText = e.kpis && e.kpis.tax_y != null ? e.kpis.tax_y.toFixed(2) + '亿' : '--';
      var employeesText = e.kpis && e.kpis.employees != null ? String(e.kpis.employees) : '--';
      var industryText = e.track || e.industry || '--';
      return (
        '<tr class="portrait-ent-row' + (idx % 2 ? ' is-alt' : '') + '">' +
        '<td class="portrait-ent-rank">' + (pageStart + idx + 1) + '.</td>' +
        '<td class="portrait-ent-name-cell">' +
        '<a href="' + esc(portraitDetailHref) + '" class="portrait-ent-link">' + esc(e.name) + '</a>' +
        '<span class="portrait-ent-badges">' + badges + '</span>' +
        chainReasonHtml +
        '</td>' +
        '<td class="portrait-ent-industry">' + esc(industryText) + '</td>' +
        '<td class="portrait-ent-kpi">' + esc(revenueText) + '</td>' +
        '<td class="portrait-ent-kpi">' + esc(employeesText) + '</td>' +
        '<td class="portrait-ent-kpi">' + esc(taxText) + '</td>' +
        '</tr>'
      );
    }).join("");

    // ── filter side panel (dropdowns) ──
    var industryOpts = '<option value="">-- 选择产业 --</option>' + localIndustryOptions.map(function (ind) {
      var sel = (industryCategoryFilter === ind) ? " selected" : "";
      return '<option value="' + esc(ind) + '"' + sel + '>' + esc(ind) + '</option>';
    }).join("");
    var industryLabelOpts = '<option value="">-- 选择行业 --</option>' + industryLabelOptions.map(function (name) {
      var sel = (industryFilter === name) ? ' selected' : '';
      return '<option value="' + esc(name) + '"' + sel + '>' + esc(name) + '</option>';
    }).join("");
    var policyOpts = '<option value="">-- 选择级别 --</option>' + policies.map(function (policy) {
      var sel = (policyIdFilter === policy.id) ? ' selected' : '';
      return '<option value="' + esc(policy.id) + '"' + sel + '>' + esc(policy.name) + '</option>';
    }).join("");

    var availableStreetNames = carriers.streets.filter(function (streetName) {
      return !carrierDistrictFilter || ((streetByName[streetName] || {}).district_name === carrierDistrictFilter);
    });
    var availableParkNames = carriers.parks.filter(function (parkName) {
      var park = parkByName[parkName] || {};
      return (!carrierDistrictFilter || park.district_name === carrierDistrictFilter) &&
        (!carrierStreetFilter || park.street_name === carrierStreetFilter);
    });
    var availableBuildingNames = carriers.buildings.filter(function (buildingName) {
      var building = buildingByName[buildingName] || {};
      return (!carrierDistrictFilter || building.district_name === carrierDistrictFilter) &&
        (!carrierStreetFilter || building.street_name === carrierStreetFilter) &&
        (!carrierParkFilter || building.park_name === carrierParkFilter);
    });

    var carrierDistrictOpts = '<option value="">-- 选择区域 --</option>' + carriers.districts.map(function (d) {
      var sel = (carrierDistrictFilter === d) ? " selected" : "";
      return '<option value="' + esc(d) + '"' + sel + '>' + esc(d) + '</option>';
    }).join("");
    var carrierStreetOpts = '<option value="">-- 选择街道 --</option>' + availableStreetNames.map(function (s) {
      var sel = (carrierStreetFilter === s) ? " selected" : "";
      return '<option value="' + esc(s) + '"' + sel + '>' + esc(s) + '</option>';
    }).join("");
    var carrierParkOpts = '<option value="">-- 选择园区 --</option>' + availableParkNames.map(function (p) {
      var sel = (carrierParkFilter === p) ? " selected" : "";
      return '<option value="' + esc(p) + '"' + sel + '>' + esc(p) + '</option>';
    }).join("");
    var carrierBuildingOpts = '<option value="">-- 选择楼宇 --</option>' + availableBuildingNames.map(function (b) {
      var sel = (carrierBuildingFilter === b) ? " selected" : "";
      return '<option value="' + esc(b) + '"' + sel + '>' + esc(b) + '</option>';
    }).join("");

    var chainFilterNote = chainFilterLabel
      ? '<div class="portrait-filter-group"><label class="portrait-filter-label">链图节点来源</label><div class="portrait-chain-filter-note"><b>' +
        esc(chainFilterLabel) +
        '</b><span>当前结果来自产业链图谱节点联动，可继续叠加其他筛选条件。</span><a href="' + buildHash("/gov/portrait", portraitBuildFilterQuery({ chain_label: "", nid: "" })) + '" class="portrait-chain-filter-clear">清除</a></div></div>'
      : "";

    var activeFiltersHtml = activeFilterTags.length
      ? '<div class="portrait-active-filters">' + activeFilterTags.map(function (item) {
          return '<span class="portrait-active-chip"><b>' + esc(item.label) + '</b><em>' + esc(item.value) + '</em></span>';
        }).join("") + '</div>'
      : "";

    var filterCol =
      '<div class="portrait-filter-bar">' +
      '<form class="portrait-search-form" data-portrait-search="1" action="javascript:void(0)">' +
      '<input type="text" class="portrait-search-input" placeholder="搜索企业名称、行业、标签..." value="' + esc(q) + '" />' +
      '<button type="submit" class="portrait-search-btn" aria-label="搜索"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>' +
      '</form>' +
      chainFilterNote +
      '<select class="portrait-select" data-portrait-filter="industry_cat" title="产业分类">' + industryOpts + '</select>' +
      '<select class="portrait-select" data-portrait-filter="industry" title="行业分类">' + industryLabelOpts + '</select>' +
      '<select class="portrait-select" data-portrait-filter="carrier_district" title="区域">' + carrierDistrictOpts + '</select>' +
      '<select class="portrait-select" data-portrait-filter="carrier_street" title="街道">' + carrierStreetOpts + '</select>' +
      '<select class="portrait-select" data-portrait-filter="carrier_park" title="园区">' + carrierParkOpts + '</select>' +
      '<select class="portrait-select" data-portrait-filter="carrier_building" title="楼宇">' + carrierBuildingOpts + '</select>' +
      '</div>' +
      activeFiltersHtml;

    var paginationLinks = [];
    for (var pi = 1; pi <= totalPages; pi++) {
      if (pi === 1 || pi === totalPages || Math.abs(pi - page) <= 1) {
        paginationLinks.push('<a class="portrait-page-link' + (pi === page ? ' active' : '') + '" href="' + buildHash("/gov/portrait", portraitBuildFilterQuery({ page: pi > 1 ? String(pi) : "" })) + '">' + esc(String(pi)) + '</a>');
      } else if ((pi === page - 2 || pi === page + 2) && totalPages > 4) {
        paginationLinks.push('<span class="portrait-page-ellipsis">…</span>');
      }
    }
    var paginationHtml = totalMatches
      ? '<div class="portrait-pagination"><span class="portrait-pagination-meta">共 ' + esc(String(totalMatches)) + ' 家 · 第 ' + esc(String(page)) + ' / ' + esc(String(totalPages)) + ' 页 · 本页 ' + esc(String(pagedEnts.length)) + ' 家</span><div class="portrait-pagination-links">' +
        (page > 1 ? '<a class="portrait-page-link nav" href="' + buildHash("/gov/portrait", portraitBuildFilterQuery({ page: String(page - 1) })) + '">上一页</a>' : '<span class="portrait-page-link nav disabled">上一页</span>') +
        paginationLinks.join("") +
        (page < totalPages ? '<a class="portrait-page-link nav" href="' + buildHash("/gov/portrait", portraitBuildFilterQuery({ page: String(page + 1) })) + '">下一页</a>' : '<span class="portrait-page-link nav disabled">下一页</span>') +
        '</div></div>'
      : "";

    var entList =
      '<div class="portrait-entlist-col">' +
      '<div class="portrait-entlist-head">' +
      '<label class="portrait-select-all"><input type="checkbox" disabled /> 全选</label>' +
      '<span class="portrait-entlist-col-title">企业名称</span>' +
      '<a class="portrait-manage-btn" href="javascript:void(0)" data-action="portrait_manage">管理</a>' +
      '</div>' +
      '<div class="portrait-entlist-body">' +
      '<table class="portrait-enttable"><thead><tr>' +
      '<th class="portrait-th-rank">#</th>' +
      '<th class="portrait-th-name">企业名称</th>' +
      '<th class="portrait-th-industry">产业/行业</th>' +
      '<th class="portrait-th-kpi">营收</th>' +
      '<th class="portrait-th-kpi">员工</th>' +
      '<th class="portrait-th-kpi">税收</th>' +
      '</tr></thead><tbody>' + (entRows || '<tr><td colspan="6" class="portrait-empty-cell">无匹配企业，请调整筛选条件。</td></tr>') + '</tbody></table>' +
      '</div>' +
      paginationHtml +
      '<div class="portrait-entlist-foot">' +
      '<span class="portrait-foot-left">' +
      '<span class="portrait-foot-count">小计 <b>' + totalMatches + '</b> 家</span>' +
      '<a href="#/gov/portrait" class="portrait-foot-clear">清除记录</a>' +
      '</span>' +
      '<span class="portrait-foot-right">' +
      '<span class="portrait-foot-stats">营收' + totalRevenue.toFixed(1) + '亿·员工' + totalEmployees + '人·税收' + totalTax.toFixed(2) + '亿</span>' +
      '<button class="portrait-export-btn" data-action="export_demo">导出</button>' +
      '</span>' +
      '</div>' +
      '<div class="portrait-endcap"></div></div>';

    var hero =
      '<div class="portrait-hero">' +
      '<div class="portrait-hero-main">' +
        '<div class="portrait-hero-left">' +
          '<h1 class="portrait-hero-title">企业精准画像系统</h1>' +
          '<span class="portrait-hero-summary-item is-total">辖区企业 <b>' + totalMatches + '</b><em>（创新 ' + innovationCount + '）</em></span>' +
        '</div>' +
        '<div class="portrait-hero-right">' +
          '<a href="#/gov/chain" class="portrait-hero-link">产业链中心</a>' +
          '<a href="#/gov/government-stats" class="portrait-hero-link is-warm">数据看板</a>' +
        '</div>' +
      '</div>' +
      '</div>';

    return (
      '<div class="portrait-page fade-in">' +
      hero +
      filterCol +
      '<div class="portrait-workspace">' +
      entList +
      '</div>' +
      '</div>'
    );
  }

  /* ════════════════════════════════════════════════════════
   *  企业精准画像 — 单企业详情页
   * ════════════════════════════════════════════════════════ */
  function pageGovPortraitDetail(entId) {
    var e = entById(entId);
    if (!e || !govDemoIsInDistrict(e)) return '<div class="card fade-in"><div class="hd"><p class="title">企业不存在</p></div><div class="bd muted">当前演示仅展示青羊区企业，请从画像列表重新进入。</div></div>';
    var detailRt = route();
    var fromChain = detailRt && detailRt.q && detailRt.q.src === "chain";
    var chainBackHref = fromChain
      ? buildHash("/gov/chain", {
          district: (detailRt.q && detailRt.q.district) || govDemoDistrictName(),
          industry: (detailRt.q && detailRt.q.industry) || e.track || e.industry || "",
          tab: (detailRt.q && detailRt.q.tab) || "intro",
          term: (detailRt.q && detailRt.q.term) || "",
          z: (detailRt.q && detailRt.q.z) || ""
        })
      : "";
    var portraitBackHref = fromChain
      ? buildHash("/gov/portrait", {
          carrier_district: (detailRt.q && detailRt.q.district) || govDemoDistrictName(),
          chain_label: (detailRt.q && detailRt.q.chain_label) || "",
          nid: (detailRt.q && detailRt.q.chain_nid) || ""
        })
      : "#/gov/portrait";
    var enterpriseDetailHref = fromChain
      ? buildHash("/gov/enterprise/" + e.id, {
          src: "chain",
          district: (detailRt.q && detailRt.q.district) || govDemoDistrictName(),
          industry: (detailRt.q && detailRt.q.industry) || e.track || e.industry || "",
          tab: (detailRt.q && detailRt.q.tab) || "intro",
          term: (detailRt.q && detailRt.q.term) || "",
          z: (detailRt.q && detailRt.q.z) || "",
          chain_label: (detailRt.q && detailRt.q.chain_label) || "",
          chain_nid: (detailRt.q && detailRt.q.chain_nid) || ""
        })
      : "#/gov/enterprise/" + e.id;

    var tagBadgeMap = { "高新技术": { abbr: "高", cls: "portrait-tag-gx", full: "高新技术企业" }, "专精特新": { abbr: "专", cls: "portrait-tag-zj", full: "专精特新企业" }, "本地配套型": { abbr: "配", cls: "portrait-tag-pd", full: "本地配套型企业" }, "研发驱动": { abbr: "研", cls: "portrait-tag-rd", full: "研发驱动型企业" }, "数据服务": { abbr: "数", cls: "portrait-tag-ds", full: "数据服务企业" }, "设备更新": { abbr: "新", cls: "portrait-tag-su", full: "设备更新企业" }, "供应链": { abbr: "链", cls: "portrait-tag-sc", full: "供应链企业" }, "法律服务": { abbr: "法", cls: "portrait-tag-fw", full: "法律服务机构" } };

    var badges = (e.tags || []).map(function (t) {
      var b = tagBadgeMap[t];
      if (b) return '<span class="portrait-badge ' + b.cls + '" title="' + esc(b.full) + '">' + esc(b.abbr) + '</span>';
      return '<span class="tag teal">' + esc(t) + '</span>';
    }).join(" ");

    // ── deterministic pseudo-random helpers seeded by enterprise id ──
    function hv(key) { return hashNumber(e.id + ":" + key); }
    function riVal(key, min, max) { var h = hv(key); return min + (h % (max - min + 1)); }
    function rfVal(key, min, max, d) { var h = hv(key); var r = (h % 10000) / 10000; return Number((min + (max - min) * r).toFixed(d == null ? 2 : d)); }
    function pctVal(key, min, max) { return rfVal(key, min, max, 1) + "%"; }
    function moneyVal(key, min, max) { return rfVal(key, min, max, 2) + " 亿"; }

    var kpis = e.kpis || {};
    var revY = kpis.revenue_y || rfVal("rev", 0.3, 5.0, 1);
    var taxY = kpis.tax_y || rfVal("tax", 0.02, 0.5, 2);
    var empN = kpis.employees || riVal("emp", 30, 500);
    var rdPct = kpis.r_and_d || rfVal("rd", 0.02, 0.30, 2);
    var assetTotal = rfVal("asset", revY * 1.8, revY * 4.5, 2);
    var mainBizPct = rfVal("mainbiz", 55, 95, 1);
    var projValue = rfVal("proj", 0.05, assetTotal * 0.3, 2);
    var equipValue = rfVal("equip", 0.02, assetTotal * 0.15, 2);
    var profitTotal = rfVal("profit", revY * 0.03, revY * 0.18, 2);
    var debtRatio = rfVal("debt", 25, 72, 1);
    var turnover = rfVal("turnover", 0.3, 1.2, 2);
    var roa = rfVal("roa", 2.0, 18.0, 1);
    var patentN = riVal("patent", 1, 50);
    var techContract = rfVal("techcontract", 0, revY * 0.4, 2);
    var bachelorPct = rfVal("bachelor", 30, 82, 1);
    var talentA = riVal("talA", 0, 3);
    var talentB = riVal("talB", 0, 8);
    var talentC = riVal("talC", 1, 15);
    var talentD = riVal("talD", 2, 25);
    var awardCount = riVal("award", 0, 5);
    var hrROI = rfVal("hrROI", 1.2, 6.8, 2);
    var lossRate = rfVal("lossRate", 1.5, 12.0, 1);
    var newsScore = riVal("news", 20, 95);
    var equityTotal = rfVal("equity", 0, revY * 2, 2);
    var finRounds = riVal("finRound", 0, 5);
    var loanTotal = rfVal("loan", 0, revY * 1.5, 2);
    var revenueGrowth = rfVal("revGrow", -8, 35, 1);
    var mainBizGrowth = rfVal("mbGrow", -5, 28, 1);
    var assetGrowth = rfVal("assetGrow", -3, 22, 1);
    var rdGrowth = rfVal("rdGrow", -2, 40, 1);
    var taxGrowth = rfVal("taxGrow", -5, 25, 1);

    var hasFinance = (e.events || []).some(function (ev) { return ev.type === "finance"; });
    var riskLevel = (e.risk && e.risk.level) || "低";
    var isLarge = e.level === "规上";
    var rankLabel = isLarge ? "行业前" + riVal("rank", 5, 30) + "%" : "未上榜";
    var isChainLeader = isLarge && hv("chain") % 5 === 0;
    var ctrlType = ["企业法人", "企业法人", "企业法人", "机构", "自然人"][hv("ctrl") % 5];
    var ctrlScore = ctrlType === "企业法人" ? 1.0 : ctrlType === "机构" ? 0.8 : 0.6;
    var decisionScore = isLarge ? "规范（" + rfVal("dec", 78, 96, 0) + "分）" : "一般（" + rfVal("dec2", 55, 77, 0) + "分）";
    var shareDesc = riVal("share", 2, 8) + "位股东，最大持股" + rfVal("maxsh", 20, 80, 1) + "%";
    var finRoundLabel = finRounds === 0 ? "未公开融资" : ["天使轮","Pre-A轮","A轮","B轮","C轮","D轮"][Math.min(finRounds, 5)];
    var loanOverdue = riVal("overdue", 0, 2);

    // ── Full indicator system: 7 dimensions, 15 sub-dimensions, 33 indicators ──
    var indicatorTree = [
      {
        id: "d1", name: "企业规模能级", icon: "📈", score: 0,
        subs: [
          { name: "企业规模", items: [
            { key: "asset",     label: "资产总额",      value: assetTotal + " 亿", extra: "近3年变动率 " + (assetGrowth >= 0 ? "+" : "") + assetGrowth + "%" },
            { key: "revenue",   label: "营业总收入",    value: revY.toFixed(1) + " 亿", extra: "同比变动率 " + (revenueGrowth >= 0 ? "+" : "") + revenueGrowth + "%" },
            { key: "mainbiz",   label: "主营业务收入",  value: (revY * mainBizPct / 100).toFixed(2) + " 亿", extra: "占比 " + mainBizPct + "%  复合增长率 " + (mainBizGrowth >= 0 ? "+" : "") + mainBizGrowth + "%" },
            { key: "project",   label: "在建工程价值",  value: projValue + " 亿", extra: "完工进度 " + riVal("projProg", 15, 95) + "%" },
            { key: "equipment", label: "重要设备仪器价值", value: equipValue + " 亿", extra: "占总资产 " + (assetTotal > 0 ? (equipValue / assetTotal * 100).toFixed(1) : 0) + "%" },
          ]},
          { name: "行业水平", items: [
            { key: "rank",   label: "榜单排名",  value: rankLabel, extra: isLarge ? "近2年排名变动 " + (riVal("rankDelta", -5, 8) >= 0 ? "上升" : "下降") + Math.abs(riVal("rankDelta", 0, 8)) + "位" : "-" },
            { key: "leader", label: "链主企业",  value: isChainLeader ? "是（有效期至2027-12）" : "否", extra: isChainLeader ? "已认定" : "-" },
          ]},
        ]
      },
      {
        id: "d2", name: "组织能力", icon: "🏢", score: 0,
        subs: [
          { name: "外部关系", items: [
            { key: "ctrl", label: "法人/实控人类别", value: ctrlType, extra: "评分系数 " + ctrlScore },
          ]},
          { name: "内部管理", items: [
            { key: "decision", label: "决策制度", value: decisionScore, extra: "决策流程合规性评估" },
          ]},
        ]
      },
      {
        id: "d3", name: "融资能力", icon: "💰", score: 0,
        subs: [
          { name: "股权融资", items: [
            { key: "equity",   label: "资本市场融资总额", value: hasFinance ? equityTotal + " 亿" : "—", extra: hasFinance ? "占总融资额 " + rfVal("eqPct", 20, 80, 1) + "%" : "-" },
            { key: "round",    label: "融资轮数",        value: finRoundLabel, extra: finRounds > 1 ? "相邻轮间隔约 " + riVal("gap", 6, 24) + " 个月" : "-" },
            { key: "shares",   label: "股东情况",        value: shareDesc, extra: "大股东持股变动 " + (rfVal("shDelta", -5, 5, 1) >= 0 ? "+" : "") + rfVal("shDelta2", -5, 5, 1) + "%" },
          ]},
          { name: "债权融资", items: [
            { key: "loan", label: "贷款总额", value: loanTotal + " 亿", extra: loanOverdue > 0 ? "⚠ 近1年逾期 " + loanOverdue + " 次" : "无逾期记录" },
          ]},
        ]
      },
      {
        id: "d4", name: "生产经营", icon: "🏭", score: 0,
        subs: [
          { name: "盈利能力", items: [
            { key: "profit", label: "利润总额", value: profitTotal + " 亿", extra: "同比变动率 " + (rfVal("profGrow", -10, 30, 1) >= 0 ? "+" : "") + rfVal("profGrow2", -10, 30, 1) + "%" },
          ]},
          { name: "偿债能力", items: [
            { key: "debt", label: "资产负债率", value: debtRatio + "%", extra: debtRatio > 60 ? "⚠ 高于行业均值" : "处于行业正常区间" },
          ]},
          { name: "营运能力", items: [
            { key: "turnover", label: "总资产周转率", value: turnover + " 次", extra: turnover < 0.5 ? "低于行业均值" : "处于行业正常区间" },
            { key: "roa",      label: "总资产报酬率", value: roa + "%", extra: roa > 10 ? "高于行业均值" : "处于行业中位" },
          ]},
        ]
      },
      {
        id: "d5", name: "创新能力", icon: "🔬", score: 0,
        subs: [
          { name: "可持续创新", items: [
            { key: "rd", label: "研发投入", value: (revY * rdPct).toFixed(2) + " 亿", extra: "占营收 " + (rdPct * 100).toFixed(1) + "%  复合增长率 " + (rdGrowth >= 0 ? "+" : "") + rdGrowth + "%" },
          ]},
          { name: "成果转化", items: [
            { key: "patent",   label: "专利拥有量",        value: patentN + " 项", extra: "发明 " + riVal("patInv", 0, Math.max(1, Math.floor(patentN * 0.4))) + " / 实用 " + riVal("patUt", 0, Math.max(1, Math.floor(patentN * 0.4))) + " / 外观 " + riVal("patDes", 0, Math.max(1, Math.floor(patentN * 0.3))) },
            { key: "techcont", label: "近三年技术合同总额", value: techContract + " 亿", extra: "-" },
          ]},
        ]
      },
      {
        id: "d6", name: "人力资源", icon: "👥", score: 0,
        subs: [
          { name: "人才情况", items: [
            { key: "bachelor", label: "本科及以上学历占比", value: bachelorPct + "%", extra: "同比变动 " + (rfVal("bachD", -3, 5, 1) >= 0 ? "+" : "") + rfVal("bachD2", -3, 5, 1) + "%" },
            { key: "talA",     label: "A类人才人数",  value: talentA + " 人", extra: "顶尖领军人才" },
            { key: "talB",     label: "B类人才人数",  value: talentB + " 人", extra: "行业核心人才" },
            { key: "talC",     label: "C类人才人数",  value: talentC + " 人", extra: "骨干技术人才" },
            { key: "talD",     label: "D类人才人数",  value: talentD + " 人", extra: "基础技能人才" },
            { key: "awards",   label: "人才奖获奖情况", value: awardCount > 0 ? awardCount + " 项" : "无", extra: awardCount > 0 ? "含省级以上 " + Math.min(awardCount, riVal("awProv", 0, awardCount)) + " 项" : "-" },
            { key: "headcount", label: "从业人员数",  value: empN + " 人", extra: "近6月流失率 " + lossRate + "%" + (lossRate > 8 ? " ⚠" : "") },
          ]},
          { name: "工资情况", items: [
            { key: "hrROI", label: "人力资本投入回报率", value: hrROI + "×", extra: hrROI < 2 ? "⚠ 低于行业均值" : "行业正常区间" },
          ]},
        ]
      },
      {
        id: "d7", name: "社会责任", icon: "🌍", score: 0,
        subs: [
          { name: "社会贡献", items: [
            { key: "tax",  label: "纳税总额",   value: taxY.toFixed(2) + " 亿", extra: "近3年变动率 " + (taxGrowth >= 0 ? "+" : "") + taxGrowth + "%" },
            { key: "news", label: "新闻活跃度", value: newsScore + " 分", extra: newsScore > 70 ? "活跃" : newsScore > 40 ? "一般" : "较低" },
          ]},
          { name: "经营风险", items: [
            { key: "credit",   label: "失信风险发生情况",   value: riskLevel === "高" ? "⚠ 存在 " + riVal("creditN", 1, 3) + " 条" : "无", extra: riskLevel === "高" ? "近1年新增" : "信用良好" },
            { key: "abnormal", label: "经营异常发生情况",  value: riskLevel === "高" ? "存在" : "无", extra: riskLevel === "高" ? "持续 " + riVal("abnDur", 1, 8) + " 个月" : "-" },
            { key: "penalty",  label: "行政处罚发生情况",  value: riVal("penN", 0, riskLevel === "高" ? 3 : 1) > 0 ? riVal("penN2", 1, 3) + " 次" : "无", extra: "-" },
          ]},
        ]
      },
    ];

    // ── Compute composite scores per dimension (0‑100) ──
    // We derive a score from hashNumber for display consistency
    var dimScores = [];
    for (var di = 0; di < indicatorTree.length; di++) {
      var sc = riVal("score_" + indicatorTree[di].id, 40, 96);
      // boost if the enterprise is 规上 or has good kpis
      if (isLarge) sc = Math.min(98, sc + 8);
      if (rdPct > 0.15) sc = Math.min(98, sc + 3);
      indicatorTree[di].score = sc;
      dimScores.push(sc);
    }
    var overallScore = Math.round(dimScores.reduce(function (a, b) { return a + b; }, 0) / dimScores.length);

    // ── Radar chart (SVG) ──
    var radarSize = 360, radarCx = radarSize / 2, radarCy = radarSize / 2, radarR = 100;
    var radarLabels = indicatorTree.map(function (d) { return d.name; });
    var radarN = radarLabels.length;
    function radarPt(idx, r) {
      var angle = -Math.PI / 2 + (2 * Math.PI / radarN) * idx;
      return [radarCx + r * Math.cos(angle), radarCy + r * Math.sin(angle)];
    }
    // grid rings
    var radarGrid = "";
    [0.25, 0.5, 0.75, 1.0].forEach(function (f) {
      var pts = [];
      for (var gi = 0; gi < radarN; gi++) { var p = radarPt(gi, radarR * f); pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1)); }
      radarGrid += '<polygon points="' + pts.join(" ") + '" fill="none" stroke="rgba(80,150,220,0.15)" stroke-width="1"/>';
    });
    // axes
    for (var ai = 0; ai < radarN; ai++) {
      var ap = radarPt(ai, radarR);
      radarGrid += '<line x1="' + radarCx + '" y1="' + radarCy + '" x2="' + ap[0].toFixed(1) + '" y2="' + ap[1].toFixed(1) + '" stroke="rgba(80,150,220,0.12)" stroke-width="1"/>';
    }
    // data area
    var radarPts = [];
    for (var ri = 0; ri < radarN; ri++) {
      var rp = radarPt(ri, radarR * dimScores[ri] / 100);
      radarPts.push(rp[0].toFixed(1) + "," + rp[1].toFixed(1));
    }
    var radarArea = '<polygon points="' + radarPts.join(" ") + '" fill="rgba(90,200,255,0.18)" stroke="#5cc8ff" stroke-width="2"/>';
    // dots + labels
    var radarDots = "", radarLbls = "";
    for (var rli = 0; rli < radarN; rli++) {
      var dp = radarPt(rli, radarR * dimScores[rli] / 100);
      radarDots += '<circle cx="' + dp[0].toFixed(1) + '" cy="' + dp[1].toFixed(1) + '" r="3.5" fill="#5cc8ff"/>';
      var lp = radarPt(rli, radarR + 18);
      var ta = "middle";
      if (lp[0] < radarCx - 20) ta = "end";
      else if (lp[0] > radarCx + 20) ta = "start";
      radarLbls += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 4).toFixed(1) + '" text-anchor="' + ta + '" fill="#3a5068" font-size="11">' + esc(radarLabels[rli]) + '</text>';
    }
    var radarSvg = '<svg class="portrait-radar" viewBox="0 0 ' + radarSize + ' ' + radarSize + '" width="' + radarSize + '" height="' + radarSize + '">' + radarGrid + radarArea + radarDots + radarLbls + '</svg>';

    // ── Horizontal score bars per dimension ──
    var scoreBarsHtml = indicatorTree.map(function (dim) {
      var barCls = dim.score >= 80 ? "high" : dim.score >= 60 ? "mid" : "low";
      return '<div class="pid-score-row"><span class="pid-score-label">' + esc(dim.name) + '</span><div class="pid-score-track"><div class="pid-score-fill ' + barCls + '" style="width:' + dim.score + '%"></div></div><span class="pid-score-num">' + dim.score + '</span></div>';
    }).join("");

    // ── Build indicator detail for modal (reused when "点击查看" is clicked) ──
    // Status classification for each item
    function itemStatus(item) {
      var v = (item.value || "") + " " + (item.extra || "");
      if (/⚠|存在|逾期|下降|低于|较低|流失率\s*\d{2,}|高于行业均值/.test(v)) return "risk";
      if (/一般|中位|正常/.test(v) && !/良好/.test(v)) return "normal";
      return "good";
    }
    var statusIcons = { good: "✅", normal: "➖", risk: "⚠️" };
    var statusColors = { good: "#2bc784", normal: "#8899aa", risk: "#e74c3c" };

    // Dimension-level analysis summaries
    var dimAnalysis = {};
    indicatorTree.forEach(function (dim) {
      var risks = [], goods = [];
      dim.subs.forEach(function (sub) {
        sub.items.forEach(function (item) {
          var st = itemStatus(item);
          if (st === "risk") risks.push(item.label + "：" + item.value + (item.extra && item.extra !== "-" ? "（" + item.extra + "）" : ""));
          if (st === "good") goods.push(item.label);
        });
      });
      dimAnalysis[dim.id] = { risks: risks, goods: goods };
    });

    // ── Generate mock drill-down records for risk-related items ──
    var penaltyCount = riVal("penN", 0, riskLevel === "高" ? 3 : 1) > 0 ? riVal("penN2", 1, 3) : 0;
    var creditCount = riskLevel === "高" ? riVal("creditN", 1, 3) : 0;
    var abnormalExists = riskLevel === "高";

    // Mock penalty records
    var penaltyRecords = [];
    var penaltyAuthorities = ["市场监督管理局", "生态环境局", "应急管理局", "税务局", "住建局"];
    var penaltyReasons = ["违反广告法相关规定", "未按期申报环评报告", "消防设施不合格", "安全生产隐患未整改", "超标排放废气"];
    var penaltyResults = ["罚款 2.0 万元", "罚款 5.0 万元并责令整改", "罚款 1.0 万元", "罚款 3.5 万元", "罚款 8.0 万元并限期治理"];
    for (var pi = 0; pi < Math.max(penaltyCount, 1); pi++) {
      var pIdx = (hv("pen_" + pi) % penaltyAuthorities.length);
      var pMonth = riVal("penM_" + pi, 1, 12);
      var pYear = riVal("penY_" + pi, 0, 2);
      penaltyRecords.push({
        date: (2024 - pYear) + "-" + (pMonth < 10 ? "0" : "") + pMonth + "-" + (riVal("penD_" + pi, 1, 28) < 10 ? "0" : "") + riVal("penD2_" + pi, 1, 28),
        authority: penaltyAuthorities[pIdx],
        reason: penaltyReasons[pIdx],
        result: penaltyResults[pIdx]
      });
    }

    // Mock credit records (失信)
    var creditRecords = [];
    var creditTypes = ["被执行人信息", "限制高消费", "失信被执行人", "股权冻结", "司法拍卖"];
    var creditCourts = ["成都市青羊区人民法院", "成都市中级人民法院", "四川省高级人民法院"];
    for (var ci = 0; ci < Math.max(creditCount, 1); ci++) {
      var cIdx = (hv("cred_" + ci) % creditTypes.length);
      var cMonth = riVal("credM_" + ci, 1, 12);
      creditRecords.push({
        date: (2024 - riVal("credY_" + ci, 0, 1)) + "-" + (cMonth < 10 ? "0" : "") + cMonth,
        type: creditTypes[cIdx],
        court: creditCourts[hv("credC_" + ci) % creditCourts.length],
        amount: rfVal("credAmt_" + ci, 5, 200, 1) + " 万元"
      });
    }

    // Mock abnormal records (经营异常)
    var abnormalRecords = [];
    var abnormalReasons = ["未按规定期限公示年度报告", "通过登记住所无法联系", "公示信息隐瞒真实情况", "未按规定期限公示变更信息"];
    var abnDur = abnormalExists ? riVal("abnDur", 1, 8) : 0;
    for (var ai = 0; ai < (abnormalExists ? Math.max(1, riVal("abnCnt", 1, 2)) : 1); ai++) {
      var aIdx = (hv("abn_" + ai) % abnormalReasons.length);
      var aMonth = riVal("abnM_" + ai, 1, 12);
      abnormalRecords.push({
        date: (2024 - riVal("abnY_" + ai, 0, 1)) + "-" + (aMonth < 10 ? "0" : "") + aMonth,
        reason: abnormalReasons[aIdx],
        duration: riVal("abnDur_" + ai, 1, 8) + " 个月",
        status: riVal("abnSt_" + ai, 0, 3) > 0 ? "已移出" : "列入中"
      });
    }

    // Helper: render drill-down detail for risk items
    function riskDrilldown(item) {
      if (item.key === "penalty" && penaltyCount > 0) {
        return '<tr class="pid-drill-row"><td colspan="4"><div class="pid-drill-detail">' +
          '<div class="pid-drill-title">📋 行政处罚明细（' + penaltyCount + '条）</div>' +
          '<table class="pid-drill-table"><thead><tr><th>处罚日期</th><th>处罚机关</th><th>处罚事由</th><th>处罚结果</th></tr></thead><tbody>' +
          penaltyRecords.slice(0, penaltyCount).map(function (r) {
            return '<tr><td>' + r.date + '</td><td>' + esc(r.authority) + '</td><td>' + esc(r.reason) + '</td><td>' + esc(r.result) + '</td></tr>';
          }).join("") +
          '</tbody></table></div></td></tr>';
      }
      if (item.key === "credit" && creditCount > 0) {
        return '<tr class="pid-drill-row"><td colspan="4"><div class="pid-drill-detail">' +
          '<div class="pid-drill-title">📋 失信记录明细（' + creditCount + '条）</div>' +
          '<table class="pid-drill-table"><thead><tr><th>日期</th><th>类型</th><th>执行法院</th><th>涉案金额</th></tr></thead><tbody>' +
          creditRecords.slice(0, creditCount).map(function (r) {
            return '<tr><td>' + r.date + '</td><td>' + esc(r.type) + '</td><td>' + esc(r.court) + '</td><td>' + r.amount + '</td></tr>';
          }).join("") +
          '</tbody></table></div></td></tr>';
      }
      if (item.key === "abnormal" && abnormalExists) {
        return '<tr class="pid-drill-row"><td colspan="4"><div class="pid-drill-detail">' +
          '<div class="pid-drill-title">📋 经营异常明细</div>' +
          '<table class="pid-drill-table"><thead><tr><th>列入日期</th><th>列入原因</th><th>持续时间</th><th>当前状态</th></tr></thead><tbody>' +
          abnormalRecords.map(function (r) {
            return '<tr><td>' + r.date + '</td><td>' + esc(r.reason) + '</td><td>' + r.duration + '</td><td class="' + (r.status === "列入中" ? "pid-drill-active" : "") + '">' + r.status + '</td></tr>';
          }).join("") +
          '</tbody></table></div></td></tr>';
      }
      return '';
    }

    // ── Cross-enterprise risk overview (all enterprises' business risks) ──
    var allEntRisks = (seed.enterprises || []).filter(isRealEnterprise).map(function (ent) {
      var eRisk = (ent.risk && ent.risk.level) || "低";
      var eSignals = (ent.risk && ent.risk.signals) || [];
      // Generate per-enterprise penalty/abnormal/credit counts with same hash logic
      var eHv = function (k) { return hashNumber(ent.id + ":" + k); };
      var eRi = function (k, mn, mx) { return mn + (eHv(k) % (mx - mn + 1)); };
      var ePen = eRi("penN", 0, eRisk === "高" ? 3 : 1) > 0 ? eRi("penN2", 1, 3) : 0;
      var eCred = eRisk === "高" ? eRi("creditN", 1, 3) : 0;
      var eAbn = eRisk === "高";
      return {
        id: ent.id, name: ent.name, industry: ent.industry || "-",
        riskLevel: eRisk, score: (ent.risk && ent.risk.score) || 0,
        signals: eSignals,
        penaltyCount: ePen, creditCount: eCred, hasAbnormal: eAbn
      };
    }).filter(function (r) {
      return r.penaltyCount > 0 || r.creditCount > 0 || r.hasAbnormal || r.riskLevel !== "低";
    }).sort(function (a, b) {
      var lvl = { "高": 0, "中": 1, "低": 2 };
      return (lvl[a.riskLevel] || 2) - (lvl[b.riskLevel] || 2) || b.score - a.score;
    });

    var riskOverviewHtml = '';
    if (allEntRisks.length > 0) {
      riskOverviewHtml = '<div class="pid-risk-overview">' +
        '<div class="pid-risk-overview-hd">' +
          '<span class="pid-risk-overview-title">🔍 全部企业经营风险总览</span>' +
          '<span class="pid-risk-overview-stat">' +
            '<span class="pid-ro-badge high">' + allEntRisks.filter(function (r) { return r.riskLevel === "高"; }).length + ' 高风险</span>' +
            '<span class="pid-ro-badge mid">' + allEntRisks.filter(function (r) { return r.riskLevel === "中"; }).length + ' 中风险</span>' +
          '</span>' +
        '</div>' +
        '<table class="pid-drill-table pid-risk-overview-table"><thead><tr>' +
          '<th>企业名称</th><th>行业</th><th>风险等级</th><th>行政处罚</th><th>失信记录</th><th>经营异常</th><th>风险信号</th>' +
        '</tr></thead><tbody>' +
        allEntRisks.slice(0, 20).map(function (r) {
          var lvlCls = r.riskLevel === "高" ? "high" : r.riskLevel === "中" ? "mid" : "low";
          return '<tr class="pid-ro-' + lvlCls + '">' +
            '<td><a href="#/gov/portrait/' + esc(r.id) + '" class="pid-ro-link">' + esc(r.name) + '</a></td>' +
            '<td>' + esc(r.industry) + '</td>' +
            '<td><span class="risk-tag ' + lvlCls + '">' + r.riskLevel + '</span></td>' +
            '<td>' + (r.penaltyCount > 0 ? '<span class="pid-ro-warn">' + r.penaltyCount + ' 次</span>' : '<span class="pid-ro-ok">无</span>') + '</td>' +
            '<td>' + (r.creditCount > 0 ? '<span class="pid-ro-warn">' + r.creditCount + ' 条</span>' : '<span class="pid-ro-ok">无</span>') + '</td>' +
            '<td>' + (r.hasAbnormal ? '<span class="pid-ro-warn">存在</span>' : '<span class="pid-ro-ok">无</span>') + '</td>' +
            '<td class="pid-ro-signals">' + (r.signals.length > 0 ? r.signals.join("、") : "-") + '</td>' +
          '</tr>';
        }).join("") +
        '</tbody></table>' +
        (allEntRisks.length > 20 ? '<div class="pid-risk-overview-more">共 ' + allEntRisks.length + ' 家企业存在风险，上表仅展示前 20 家</div>' : '') +
      '</div>';
    }

    var dimDetailHtmlByIdx = indicatorTree.map(function (dim) {
      var analysis = dimAnalysis[dim.id] || { risks: [], goods: [] };
      // Summary block
      var summaryHtml = '<div class="pid-detail-summary">';
      if (analysis.risks.length > 0) {
        summaryHtml += '<div class="pid-detail-alert"><div class="pid-detail-alert-hd">⚠️ 需关注风险（' + analysis.risks.length + '项）</div><ul class="pid-detail-alert-list">' +
          analysis.risks.map(function (r) { return '<li>' + r + '</li>'; }).join("") + '</ul></div>';
      } else {
        summaryHtml += '<div class="pid-detail-ok">✅ 该维度各项指标均处于正常或优良水平，暂无明显风险。</div>';
      }
      if (analysis.goods.length > 0) {
        summaryHtml += '<div class="pid-detail-good">💪 优势指标：' + analysis.goods.join("、") + '</div>';
      }
      summaryHtml += '</div>';

      // Detail tables with status icons + drill-down for risk items
      var tablesHtml = dim.subs.map(function (sub) {
        var rowsHtml = sub.items.map(function (item) {
          var st = itemStatus(item);
          var drillHtml = (dim.id === "d7") ? riskDrilldown(item) : '';
          var hasDetail = drillHtml.length > 0;
          return '<tr class="pid-ind-' + st + (hasDetail ? ' pid-ind-has-drill' : '') + '">' +
            '<td class="pid-ind-status"><span style="color:' + statusColors[st] + '">' + statusIcons[st] + '</span></td>' +
            '<td class="pid-ind-label">' + esc(item.label) + (hasDetail ? ' <span class="pid-drill-toggle">▸ 查看明细</span>' : '') + '</td>' +
            '<td class="pid-ind-value">' + item.value + '</td>' +
            '<td class="pid-ind-extra">' + esc(item.extra || "") + '</td>' +
            '</tr>' + drillHtml;
        }).join("");
        return '<div class="pid-sub-block"><h5 class="pid-sub-title">' + esc(sub.name) + '</h5><table class="pid-ind-table"><tbody>' + rowsHtml + '</tbody></table></div>';
      }).join("");

      // Append cross-enterprise risk overview for 社会责任 dimension
      var overviewAppend = (dim.id === "d7") ? riskOverviewHtml : '';

      return summaryHtml + tablesHtml + overviewAppend;
    });
    // Store for modal access
    window.__pidDimDetails = dimDetailHtmlByIdx;
    window.__pidDimNames = indicatorTree.map(function (d) { return d.name; });
    window.__pidDimScores = indicatorTree.map(function (d) { return d.score; });
    window.__pidDimIcons = indicatorTree.map(function (d) { return d.icon; });

    // ── Dimension card colors ──
    var dimCardColors = [
      { accent: "#e74c3c", bg: "linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%)" },
      { accent: "#2980b9", bg: "linear-gradient(135deg, #f0f7ff 0%, #dbeafe 100%)" },
      { accent: "#e67e22", bg: "linear-gradient(135deg, #fff8f0 0%, #ffecd2 100%)" },
      { accent: "#e74c3c", bg: "linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%)" },
      { accent: "#2980b9", bg: "linear-gradient(135deg, #f0f7ff 0%, #dbeafe 100%)" },
      { accent: "#e67e22", bg: "linear-gradient(135deg, #fff8f0 0%, #ffecd2 100%)" },
      { accent: "#e74c3c", bg: "linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%)" }
    ];

    // ── Isometric SVG illustrations per dimension ──
    var dimSvgIcons = [
      /* d1 企业规模能级 - buildings */ '<svg viewBox="0 0 80 80" width="80" height="80"><rect x="15" y="25" width="20" height="40" rx="2" fill="#4a9fe5" opacity=".7"/><rect x="18" y="30" width="5" height="5" rx="1" fill="#fff" opacity=".6"/><rect x="25" y="30" width="5" height="5" rx="1" fill="#fff" opacity=".6"/><rect x="18" y="38" width="5" height="5" rx="1" fill="#fff" opacity=".6"/><rect x="25" y="38" width="5" height="5" rx="1" fill="#fff" opacity=".6"/><rect x="18" y="46" width="5" height="5" rx="1" fill="#fff" opacity=".6"/><rect x="25" y="46" width="5" height="5" rx="1" fill="#fff" opacity=".6"/><rect x="40" y="15" width="24" height="50" rx="2" fill="#2670b8" opacity=".8"/><rect x="44" y="20" width="5" height="5" rx="1" fill="#fff" opacity=".5"/><rect x="53" y="20" width="5" height="5" rx="1" fill="#fff" opacity=".5"/><rect x="44" y="28" width="5" height="5" rx="1" fill="#fff" opacity=".5"/><rect x="53" y="28" width="5" height="5" rx="1" fill="#fff" opacity=".5"/><rect x="44" y="36" width="5" height="5" rx="1" fill="#fff" opacity=".5"/><rect x="53" y="36" width="5" height="5" rx="1" fill="#fff" opacity=".5"/><rect x="44" y="44" width="5" height="5" rx="1" fill="#fff" opacity=".5"/><rect x="53" y="44" width="5" height="5" rx="1" fill="#fff" opacity=".5"/><rect x="10" y="65" width="60" height="3" rx="1.5" fill="#cde0f2" opacity=".5"/></svg>',
      /* d2 组织能力 - org chart */ '<svg viewBox="0 0 80 80" width="80" height="80"><rect x="25" y="12" width="30" height="18" rx="3" fill="#4a9fe5" opacity=".7"/><text x="40" y="24" text-anchor="middle" fill="#fff" font-size="10" font-weight="600">CEO</text><line x1="40" y1="30" x2="40" y2="38" stroke="#4a9fe5" stroke-width="2"/><line x1="20" y1="38" x2="60" y2="38" stroke="#4a9fe5" stroke-width="2"/><line x1="20" y1="38" x2="20" y2="44" stroke="#4a9fe5" stroke-width="2"/><line x1="40" y1="38" x2="40" y2="44" stroke="#4a9fe5" stroke-width="2"/><line x1="60" y1="38" x2="60" y2="44" stroke="#4a9fe5" stroke-width="2"/><rect x="8" y="44" width="24" height="14" rx="2" fill="#6db8f2" opacity=".6"/><rect x="28" y="44" width="24" height="14" rx="2" fill="#6db8f2" opacity=".6"/><rect x="48" y="44" width="24" height="14" rx="2" fill="#6db8f2" opacity=".6"/><rect x="10" y="65" width="60" height="3" rx="1.5" fill="#cde0f2" opacity=".5"/></svg>',
      /* d3 融资能力 - coins/money */ '<svg viewBox="0 0 80 80" width="80" height="80"><ellipse cx="40" cy="50" rx="22" ry="10" fill="#f5a623" opacity=".3"/><ellipse cx="40" cy="45" rx="22" ry="10" fill="#f5a623" opacity=".4"/><ellipse cx="40" cy="40" rx="22" ry="10" fill="#f5a623" opacity=".5"/><ellipse cx="40" cy="35" rx="22" ry="10" fill="#f5a623" opacity=".6"/><ellipse cx="40" cy="30" rx="22" ry="10" fill="#e8952a" opacity=".8"/><text x="40" y="34" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">¥</text><rect x="10" y="65" width="60" height="3" rx="1.5" fill="#f5deb3" opacity=".5"/></svg>',
      /* d4 生产经营 - factory */ '<svg viewBox="0 0 80 80" width="80" height="80"><polygon points="10,60 10,35 25,25 25,60" fill="#e74c3c" opacity=".5"/><polygon points="25,60 25,30 40,20 40,60" fill="#c0392b" opacity=".6"/><rect x="40" y="30" width="30" height="30" rx="2" fill="#e74c3c" opacity=".4"/><rect x="45" y="35" width="8" height="8" rx="1" fill="#fff" opacity=".5"/><rect x="57" y="35" width="8" height="8" rx="1" fill="#fff" opacity=".5"/><rect x="45" y="47" width="8" height="13" rx="1" fill="#fff" opacity=".5"/><rect x="14" y="40" width="7" height="7" rx="1" fill="#fff" opacity=".4"/><rect x="29" y="38" width="7" height="7" rx="1" fill="#fff" opacity=".4"/><rect x="10" y="65" width="60" height="3" rx="1.5" fill="#f2cdc8" opacity=".5"/></svg>',
      /* d5 创新能力 - lightbulb/lab */ '<svg viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="30" r="18" fill="#4a9fe5" opacity=".15"/><circle cx="40" cy="30" r="12" fill="#4a9fe5" opacity=".3"/><path d="M34 42 L34 50 Q34 54 40 54 Q46 54 46 50 L46 42" fill="#4a9fe5" opacity=".5"/><circle cx="40" cy="30" r="6" fill="#5cc8ff" opacity=".8"/><line x1="40" y1="18" x2="40" y2="13" stroke="#f5a623" stroke-width="2" stroke-linecap="round"/><line x1="50" y1="20" x2="54" y2="16" stroke="#f5a623" stroke-width="2" stroke-linecap="round"/><line x1="30" y1="20" x2="26" y2="16" stroke="#f5a623" stroke-width="2" stroke-linecap="round"/><line x1="53" y1="30" x2="58" y2="30" stroke="#f5a623" stroke-width="2" stroke-linecap="round"/><line x1="27" y1="30" x2="22" y2="30" stroke="#f5a623" stroke-width="2" stroke-linecap="round"/><rect x="10" y="65" width="60" height="3" rx="1.5" fill="#cde0f2" opacity=".5"/></svg>',
      /* d6 人力资源 - people */ '<svg viewBox="0 0 80 80" width="80" height="80"><circle cx="25" cy="25" r="8" fill="#e8952a" opacity=".6"/><rect x="17" y="35" width="16" height="20" rx="4" fill="#e8952a" opacity=".5"/><circle cx="55" cy="25" r="8" fill="#4a9fe5" opacity=".6"/><rect x="47" y="35" width="16" height="20" rx="4" fill="#4a9fe5" opacity=".5"/><circle cx="40" cy="20" r="9" fill="#2670b8" opacity=".7"/><rect x="31" y="31" width="18" height="24" rx="4" fill="#2670b8" opacity=".6"/><rect x="10" y="65" width="60" height="3" rx="1.5" fill="#cde0f2" opacity=".5"/></svg>',
      /* d7 社会责任 - globe/heart */ '<svg viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="35" r="22" fill="#27ae60" opacity=".15"/><circle cx="40" cy="35" r="16" fill="#27ae60" opacity=".25"/><circle cx="40" cy="35" r="10" fill="#2ecc71" opacity=".5"/><path d="M35 35 Q35 28 40 28 Q45 28 45 35 Q45 42 40 48 Q35 42 35 35Z" fill="#e74c3c" opacity=".7"/><rect x="10" y="65" width="60" height="3" rx="1.5" fill="#c8f2d5" opacity=".5"/></svg>'
    ];

    // ── Build indicator card grid ──
    var scaleCardImages = {
        0: './assets/portrait-scale-card.png?v=20260401p',
        1: './assets/portrait-org-card.png?v=20260401p',
        2: './assets/portrait-finance-card.png?v=20260401p',
        3: './assets/portrait-production-card.png?v=20260401p',
        4: './assets/portrait-innovation-card.png?v=20260401p',
        5: './assets/portrait-hr-card.png?v=20260401p',
        6: './assets/portrait-responsibility-card.png?v=20260401p'
    };
    var indicatorHtml = '<div class="pid-dim-grid">' + indicatorTree.map(function (dim, dIdx) {
      var color = dimCardColors[dIdx] || dimCardColors[0];
        var isScaleCard = !!scaleCardImages[dIdx];
      var subsLabels = dim.subs.map(function (sub, subIdx) {
        var dotColor = color.accent;
        if (isScaleCard) {
          if (subIdx === 0) dotColor = '#ff8b3d';
          else if (subIdx === 1) dotColor = '#3f9dff';
          else dotColor = subIdx % 2 ? '#3f9dff' : '#ff8b3d';
        }
        return '<li class="pid-card-sub-item' + (isScaleCard ? ' pid-card-sub-item-scale' : '') + '"><span class="pid-card-sub-dot" style="background:' + dotColor + '"></span>' + esc(sub.name) + '</li>';
      }).join("");
      if (isScaleCard) {
        return (
          '<div class="pid-dim-card pid-dim-card-scale">' +
          '<div class="pid-card-head pid-card-head-scale">' +
          '<span class="pid-card-head-bar" aria-hidden="true"></span>' +
          '<span class="pid-card-title pid-card-title-scale">' + esc(dim.name) + '</span>' +
          '</div>' +
          '<div class="pid-card-body pid-card-body-scale">' +
          '<div class="pid-card-illust pid-card-illust-scale"><img class="pid-card-illust-img pid-card-illust-img-scale" src="' + scaleCardImages[dIdx] + '" alt="" loading="lazy" decoding="async" /></div>' +
          '<div class="pid-card-score-area pid-card-score-area-scale">' +
          '<div class="pid-card-score pid-card-score-scale"><span class="pid-card-score-num pid-card-score-num-scale" style="color:#183153">' + dim.score + '</span><span class="pid-card-score-unit pid-card-score-unit-scale">分/100分</span></div>' +
          '<ul class="pid-card-sub-list pid-card-sub-list-scale">' + subsLabels + '</ul>' +
          '</div>' +
          '<div class="pid-card-action pid-card-action-scale">' +
          '<a href="javascript:void(0)" class="pid-card-detail-btn pid-card-detail-btn-scale" data-action="dim_detail" data-dim-idx="' + dIdx + '">点击查看</a>' +
          '</div>' +
          '</div>' +
          '</div>'
        );
      }
      return (
        '<div class="pid-dim-card" style="background:' + color.bg + ';border-left-color:' + color.accent + ';">' +
        '<div class="pid-card-head">' +
        '<span class="pid-card-accent" style="color:' + color.accent + '">' + dim.icon + '</span>' +
        '<span class="pid-card-title" style="color:' + color.accent + '">' + esc(dim.name) + '</span>' +
        '</div>' +
        '<div class="pid-card-body">' +
        '<div class="pid-card-illust">' + dimSvgIcons[dIdx] + '</div>' +
        '<div class="pid-card-score-area">' +
        '<div class="pid-card-score"><span class="pid-card-score-num" style="color:' + color.accent + '">' + dim.score + '</span><span class="pid-card-score-unit">分/100分</span></div>' +
        '<ul class="pid-card-sub-list">' + subsLabels + '</ul>' +
        '</div>' +
        '</div>' +
        '<div class="pid-card-foot">' +
        '<a href="javascript:void(0)" class="pid-card-detail-btn" data-action="dim_detail" data-dim-idx="' + dIdx + '">点击查看</a>' +
        '</div>' +
        '</div>'
      );
    }).join("") + '</div>';

    // ── events timeline ──
    var eventTypeMap = { innovation: '\ud83d\udca1 \u521b\u65b0', finance: '\ud83d\udcb0 \u878d\u8d44', operate: '\u2699\ufe0f \u7ecf\u8425', change: '\ud83d\udd04 \u53d8\u66f4', risk: '\u26a0\ufe0f \u98ce\u9669', policy: '\ud83d\udcdc \u653f\u7b56', talent: '\ud83d\udc64 \u4eba\u624d', award: '\ud83c\udfc6 \u8363\u8a89', bid: '\ud83d\udcdd \u62db\u6295\u6807', service: '\ud83d\udd27 \u670d\u52a1' };
    var eventsHtml = (e.events || []).slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    }).map(function (ev) {
      var cls = ev.type === "risk" ? "red" : ev.type === "finance" ? "orange" : "teal";
      var typeLabel = eventTypeMap[ev.type] || ev.type;
      return '<div class="portrait-event"><span class="tag ' + cls + '">' + typeLabel + '</span><span class="portrait-event-title">' + esc(ev.title) + '</span><span class="portrait-event-date">' + esc(fmtDate(ev.date)) + '</span></div>';
    }).join("");

    // ── risk signals ──
    var riskLevel = (e.risk && e.risk.level) || '\u4f4e';
    var riskIcon = riskLevel === '\u9ad8' ? '\ud83d\udd34' : riskLevel === '\u4e2d' ? '\ud83d\udfe1' : '\ud83d\udfe2';
    var riskHtml = (e.risk && e.risk.signals || []).map(function (s) {
      return '<li class="portrait-risk-item">' + riskIcon + ' ' + esc(s) + '</li>';
    }).join("");

    return (
      '<div class="grid">' +
      /* ── Header card ── */
      '<div class="card fade-in portrait-detail-card" style="grid-column:span 12;">' +
      '<div class="portrait-detail-hd"><div>' +
      '<p class="title" style="display:inline;">' + esc(e.name) + '</p> ' + badges +
      '<div class="portrait-detail-meta">' + esc(e.industry) + ' · ' + esc(e.level || "") + ' · ' + esc(e.uscc) + '</div>' +
      '</div><div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">' +
      (fromChain ? '<a class="btn" href="' + esc(chainBackHref) + '">返回产业链式图谱</a>' : '') +
      '<a class="btn" href="' + esc(portraitBackHref) + '">← 返回列表</a>' +
      '<a class="btn" href="' + esc(enterpriseDetailHref) + '">查看企业档案</a>' +
      '<button class="btn primary" data-action="export_demo">导出画像</button>' +
      '</div></div>' +
      '<div class="portrait-detail-bd">' +
      '<div class="portrait-info-strip">' +
      '<div><strong>地址：</strong>' + esc(e.address) + '</div>' +
      '<div><strong>网格：</strong>' + esc(e.grid || "-") + '</div>' +
      '<div><strong>产业方向：</strong>' + esc(e.track || "-") + '</div>' +
      '<div><strong>风险等级：</strong>' + riskTag((e.risk && e.risk.level) || "低") + '</div>' +
      '<div><strong>风险指数：</strong>' + esc((e.risk && e.risk.score) || "-") + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="portrait-detail-score-section">' +
      '<div class="portrait-detail-score-hd"><p class="title">综合评分 <span class="pid-overall-score">' + overallScore + '</span><span class="pid-overall-label"> / 100</span></p></div>' +
      '<div class="portrait-detail-score-bd"><div class="pid-score-layout">' +
      '<div class="pid-radar-wrap">' + radarSvg + '</div>' +
      '<div class="pid-bars-wrap">' + scoreBarsHtml + '</div>' +
      '</div></div>' +
      '</div></div>' +

      /* ── Full indicator system card (card grid) ── */
      '<div class="card fade-in" style="grid-column:span 12;">' +
      '<div class="hd"><p class="title">多维指标体系</p><div class="meta">7大维度 · 15项二级指标 · 33项三级指标</div></div>' +
      '<div class="bd">' + indicatorHtml + '</div></div>' +

      /* ── Events + Risk ── */
      '<div class="card fade-in" style="grid-column:span 6;">' +
      '<div class="hd"><p class="title">经营动态</p></div>' +
      '<div class="bd">' + (eventsHtml || '<p class="muted">暂无动态</p>') + '</div></div>' +

      '<div class="card fade-in" style="grid-column:span 6;">' +
      '<div class="hd"><p class="title">风险信号</p></div>' +
      '<div class="bd"><ul class="portrait-risk-list">' + (riskHtml || '<li class="muted">暂无风险信号</li>') + '</ul></div></div>' +

      '</div>'
    );
  }

  function pageSettings(title) {
    var homeHref = state.active.role === 'bank' ? '#/bank/overview' : state.active.role === 'enterprise' ? '#/ent/home' : '#/gov/home';
    return (
      '<div class="grid">' +
      card(
        title || "切换机构与重置演示数据",
        "演示环境控制",
        '<a class="btn" href="' + homeHref + '">返回平台首页</a><button class="btn danger" data-action="reset_demo">恢复演示数据</button><button class="btn" data-action="logout" style="margin-left:8px">退出登录</button>',
        '<p style="margin:0;line-height:1.7;">本演示平台会把临时操作（企业、工单、授权、跟进等）写入浏览器本地缓存。</p><p class="muted" style="margin:10px 0 0;line-height:1.7;">现场汇报前建议点击右侧按钮恢复到初始数据。</p>'
      ) +
      "</div>"
    );
  }

  /* ================================================================
   *  Enterprise Portal Pages (企业端)
   * ================================================================ */

  function entServiceCategories() {
    return [
      { key: "supply", label: "供应链需求" },
      { key: "capital", label: "资金链需求" },
      { key: "equity", label: "股权链需求" },
      { key: "rd", label: "研发链需求" },
      { key: "policy", label: "园区与政策服务" },
      { key: "find", label: "找企业" },
      { key: "free", label: "自由问需" },
    ];
  }

  function entSupportServices() {
    return ["法律服务", "财会服务", "投行服务", "猎头服务", "知识产权服务", "咨询策划服务", "政策申报"];
  }

  function entCompanyName() {
    var e = entById(state.active.enterprise_id);
    return e ? e.name : "xxxxx有限公司";
  }

  function entTopActionBar(serviceLabel, managerLabel) {
    return '<div class="ent-top-action-bar">' +
      '<span class="ent-company-title">' + esc(entCompanyName()) + '企业主页（我的企业画像）</span>' +
      '<a class="ent-action-link" href="#/ent/home">' + esc(managerLabel || "找专业服务经理") + '</a>' +
      '<a class="ent-action-link" href="#/ent/home">返回首页</a>' +
    '</div>';
  }

  function entSearchCard(title, placeholder, hint) {
    return '<div class="ent-search-card">' +
      '<h4 class="ent-search-title">' + esc(title) + '</h4>' +
      '<div class="ent-search-row">' +
        '<textarea class="ent-search-input" placeholder="' + esc(placeholder) + '" rows="3"></textarea>' +
        '<button class="btn primary ent-search-btn">查看搜索结果</button>' +
      '</div>' +
      (hint ? '<p class="ent-search-hint">' + esc(hint) + '</p>' : '') +
    '</div>';
  }

  function entRecommendList(title, items) {
    var rows = items.map(function(item) {
      return '<div class="ent-recommend-item">' +
        '<div class="ent-recommend-name">' + esc(item.name) + '</div>' +
        '<div class="ent-recommend-desc">' + esc(item.desc) + '</div>' +
        '<div class="ent-recommend-meta">' + esc(item.meta || "") + '</div>' +
      '</div>';
    }).join("");
    return '<div class="ent-recommend-list">' +
      '<h5 class="ent-recommend-title">' + esc(title) + '</h5>' +
      rows +
    '</div>';
  }

  function entPartnerBar(partners) {
    var chips = partners.map(function(p) {
      return '<span class="ent-partner-chip">' + esc(p) + '</span>';
    }).join("");
    return '<div class="ent-partner-bar">' +
      '<span class="ent-partner-label">合作机构清单：</span>' + chips +
    '</div>';
  }

  /* ─── 服务主页 ─── */
  function pageEntServiceHome() {
    var cats = entServiceCategories();
    var supports = entSupportServices();

    var catBtns = cats.map(function(c) {
      return '<button class="ent-cat-btn" data-cat="' + c.key + '">' + esc(c.label) + '</button>';
    }).join("");

    var supportChips = supports.map(function(s) {
      return '<span class="ent-support-chip">' + esc(s) + '</span>';
    }).join("");

    return '<div class="ent-page fade-in">' +
      '<div class="ent-support-bar">' +
        '<span class="ent-support-label">左右岸支撑：</span>' + supportChips +
      '</div>' +
      '<div class="ent-home-search">' +
        '<div class="ent-search-box">' +
          '<label class="ent-search-main-label">请输入您的需求：（模糊搜索）</label>' +
          '<textarea class="ent-search-main-input" rows="4" placeholder="例如：我是一家xxx生产企业，主要生产xxxx产品，包括xx、xxx等型号。我要寻找xxx区域内的客户……"></textarea>' +
          '<div class="ent-search-main-actions">' +
            '<button class="btn primary">搜索</button>' +
          '</div>' +
        '</div>' +
        '<div class="ent-cat-panel">' +
          '<p class="ent-cat-title">按类型搜索</p>' +
          '<div class="ent-cat-list">' + catBtns + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ent-result-hint">' +
        '<span class="muted">搜索结果展示：企业名称、区域、营业范围、企业主页、联系方式（如有）</span>' +
      '</div>' +
    '</div>';
  }

  /* ─── 企业主页 ─── */
  function pageEntCompanyHome() {
    var e = entById(state.active.enterprise_id);
    var name = e ? e.name : "xxxxx有限公司";
    var industry = e ? (e.industry || "制造业") : "制造业";
    var registered = e ? (e.registered_capital || "5000万元") : "5000万元";

    var navTabs = ["我关注的企业", "关注我的企业", "我的聊天", "好友申请"];
    var tabsHtml = navTabs.map(function(t) {
      return '<span class="ent-nav-tab">' + esc(t) + '</span>';
    }).join("");

    var sideItems = [
      { label: "我的项目池", href: "#/ent/supply-chain" },
      { label: "我的服务经理", href: "#/ent/home" },
      { label: "下游资源推荐", href: "#/ent/supply-chain" },
      { label: "上游资源推荐", href: "#/ent/supply-chain" },
      { label: "我的产业图谱", href: "#/ent/rd-service" },
      { label: "政策与行业动态", href: "#/ent/policy-park" },
    ];
    var sideHtml = sideItems.map(function(s) {
      return '<a class="ent-company-side-item" href="' + s.href + '">' + esc(s.label) + '</a>';
    }).join("");

    return '<div class="ent-page fade-in">' +
      '<div class="ent-company-layout">' +
        '<div class="ent-company-side">' +
          '<div class="ent-company-side-nav">' + sideHtml + '</div>' +
        '</div>' +
        '<div class="ent-company-main">' +
          '<div class="ent-company-tabs">' + tabsHtml +
            '<span class="ent-lobster-btn">我的龙虾助手</span>' +
          '</div>' +
          '<div class="ent-company-intro-card">' +
            '<div class="ent-company-photo-placeholder">企业照片与简介</div>' +
            '<div class="ent-company-info">' +
              '<h3>' + esc(name) + '</h3>' +
              '<p>行业：' + esc(industry) + '</p>' +
              '<p>注册资本：' + esc(registered) + '</p>' +
              '<p>地址：成都市青羊区</p>' +
            '</div>' +
          '</div>' +
          '<div class="ent-company-products-card">' +
            '<h4>企业产品介绍</h4>' +
            '<p class="muted">按业务分板块介绍企业产品与服务</p>' +
            '<div class="ent-product-grid">' +
              '<div class="ent-product-item"><span class="ent-product-icon">📦</span><span>主营产品A</span></div>' +
              '<div class="ent-product-item"><span class="ent-product-icon">🔧</span><span>技术服务B</span></div>' +
              '<div class="ent-product-item"><span class="ent-product-icon">📋</span><span>解决方案C</span></div>' +
              '<div class="ent-product-item"><span class="ent-product-icon">🏭</span><span>生产制造D</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ─── 供应链服务 ─── */
  function pageEntSupplyChain() {
    var upstreamRecs = [
      { name: "成都精密零部件有限公司", desc: "主营：精密加工、模具制造", meta: "报价：¥12.5/件 · 月产能：50万件" },
      { name: "四川新材料科技有限公司", desc: "主营：特种合金、复合材料", meta: "报价：¥85/kg · 交货期：7天" },
      { name: "重庆自动化设备有限公司", desc: "主营：工业自动化、传感器", meta: "报价：面议 · 已合作2年" },
    ];
    var downstreamRecs = [
      { name: "深圳电子科技有限公司", desc: "采购需求：精密元器件", meta: "预算：¥200万/年 · 合作意向强" },
      { name: "上海智能装备股份公司", desc: "采购需求：自动化零部件", meta: "预算：¥500万/年" },
      { name: "北京高新科技有限公司", desc: "采购需求：定制化解决方案", meta: "预算：面议" },
    ];

    return '<div class="ent-page fade-in">' +
      entTopActionBar("供应链服务", "找供应链服务经理") +
      '<div class="ent-dual-panel">' +
        '<div class="ent-dual-left">' +
          '<h3 class="ent-dual-title">找上游供应</h3>' +
          '<div class="ent-chart-placeholder"><span>上游采购数据图（供应商报价情况）</span></div>' +
          entSearchCard("主动搜索", "请输入详细采购需求（主动寻找）…", "输入产品名称、规格、数量等关键信息") +
          entRecommendList("上游供应信息推荐", upstreamRecs) +
        '</div>' +
        '<div class="ent-dual-right">' +
          '<h3 class="ent-dual-title">找下游客户</h3>' +
          '<div class="ent-chart-placeholder"><span>下游销售数据图（同行报价情况）</span></div>' +
          entSearchCard("主动搜索", "请输入详细销售需求（主动寻找）…", "输入目标客户类型、区域、行业等") +
          entRecommendList("下游采购信息推荐", downstreamRecs) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ─── 资金链服务 ─── */
  function pageEntCapitalChain() {
    var debtRecs = [
      { name: "成都银行-科创贷", desc: "额度：100-500万 · 利率：3.85%", meta: "审批周期：7个工作日" },
      { name: "四川天府银行-供应链金融", desc: "额度：50-2000万 · 利率：4.15%", meta: "审批周期：5个工作日" },
      { name: "招商银行-融资租赁", desc: "额度：200-5000万 · 利率：4.5%", meta: "审批周期：10个工作日" },
    ];
    var equityRecs = [
      { name: "深创投-Pre-A轮", desc: "投资范围：500万-3000万", meta: "重点关注：智能制造、新材料" },
      { name: "IDG资本-天使轮", desc: "投资范围：200万-1000万", meta: "重点关注：科技创新、AI应用" },
      { name: "红杉中国-A轮", desc: "投资范围：1000万-5000万", meta: "重点关注：硬科技、产业升级" },
    ];

    return '<div class="ent-page fade-in">' +
      entTopActionBar("资金链服务", "找资金链服务经理") +
      entPartnerBar(["银行", "投行", "基金", "信托公司", "租赁公司", "小贷公司", "投资人"]) +
      '<div class="ent-dual-panel">' +
        '<div class="ent-dual-left">' +
          '<h3 class="ent-dual-title">债权融资 / 找融资企业</h3>' +
          entSearchCard("融资需求", "请输入详细融资需求（主动寻找）…",
            "输入时需明确债权融资类别：银行贷款、发债、融资租赁、商业保理、供应链金融、信托贷款、民间借贷等") +
          entRecommendList("债权融资信息推荐", debtRecs) +
        '</div>' +
        '<div class="ent-dual-right">' +
          '<h3 class="ent-dual-title">股权融资 / 找融资企业</h3>' +
          entSearchCard("融资需求", "请输入详细融资需求（主动寻找）…",
            "输入时需明确股权融资类别：天使投资、风险投资、私募股权投资、增资扩股、股权众筹、贸易融资等") +
          entRecommendList("股权融资信息推荐", equityRecs) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ─── 研发服务 ─── */
  function pageEntRdService() {
    var projectRecs = [
      { name: "高性能复合材料关键技术研究", desc: "类型：省级科研项目 · 领域：新材料", meta: "申报截止：2026-06-30" },
      { name: "智能制造装备核心零部件专利", desc: "类型：发明专利 · 技术特点：高精度", meta: "转让价格：面议" },
      { name: "工业互联网平台数据融合技术", desc: "类型：国家重点研发 · 领域：信息技术", meta: "合作方式：联合攻关" },
    ];
    var expertRecs = [
      { name: "张教授 · 四川大学", desc: "研究方向：智能制造与工业自动化", meta: "合作项目：12个 · 专利：45项" },
      { name: "李研究员 · 中科院成都分院", desc: "研究方向：新材料与纳米技术", meta: "合作项目：8个 · 论文：120篇" },
      { name: "王博士 · 电子科技大学", desc: "研究方向：人工智能与大数据", meta: "合作项目：15个 · 专利：32项" },
    ];

    return '<div class="ent-page fade-in">' +
      entTopActionBar("研发服务", "找研发服务经理") +
      entPartnerBar(["实验室", "院校", "知识产权交易", "专家库"]) +
      '<div class="ent-dual-panel">' +
        '<div class="ent-dual-left">' +
          '<h3 class="ent-dual-title">找科研项目 / 专利</h3>' +
          entSearchCard("项目与专利搜索", "请输入详细需求（主动寻找）…",
            "输入时需明确产业、项目类型、专利类型、技术特点等") +
          entRecommendList("项目与专利信息推荐", projectRecs) +
        '</div>' +
        '<div class="ent-dual-right">' +
          '<h3 class="ent-dual-title">找行业专家</h3>' +
          entSearchCard("专家搜索", "请输入详细需求（主动寻找）…",
            "输入时需明确行业类型、细分领域、专家类别等") +
          entRecommendList("行业专家推荐", expertRecs) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ─── 政策与园区服务 ─── */
  function pageEntPolicyPark() {
    var parkRecs = [
      { name: "青羊总部经济集聚区", desc: "产业方向：总部经济、金融服务", meta: "可用面积：2万㎡ · 优惠政策：3年免租" },
      { name: "成都国际科技节能大厦", desc: "产业方向：节能环保、绿色科技", meta: "可用面积：5000㎡ · 配套完善" },
      { name: "青羊工业集中发展区", desc: "产业方向：航空制造、电子信息", meta: "可用面积：10万㎡ · 标准厂房" },
    ];
    var policyRecs = [
      { name: "成都市高新技术企业培育补贴", desc: "补贴金额：最高50万元", meta: "申报截止：2026-09-30" },
      { name: "四川省科技成果转化资金", desc: "支持金额：100-500万元", meta: "申报截止：2026-07-15" },
      { name: "青羊区产业发展专项资金", desc: "支持金额：最高200万元", meta: "常年受理" },
    ];

    return '<div class="ent-page fade-in">' +
      entTopActionBar("政策与园区服务", "找政策&园区服务经理") +
      entPartnerBar(["实验室", "院校", "知识产权交易"]) +
      '<div class="ent-dual-panel">' +
        '<div class="ent-dual-left">' +
          '<h3 class="ent-dual-title">企业找园区</h3>' +
          entSearchCard("园区搜索", "请输入园区需求（主动寻找）…",
            "输入时需明确区域、园区、产业类型等") +
          entRecommendList("园区信息推荐", parkRecs) +
        '</div>' +
        '<div class="ent-dual-right">' +
          '<h3 class="ent-dual-title">企业找政策</h3>' +
          entSearchCard("政策搜索", "请输入详细需求（主动寻找）…",
            "输入时需明确区域、行业、政策类型、政策需求等") +
          entRecommendList("区域政策推荐", policyRecs) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ─── 线下活动 ─── */
  function pageEntOfflineEvents() {
    var eventRecs = [
      { name: "2026成都智能制造产业对接会", desc: "时间：2026-05-20 · 地点：青羊区政务中心", meta: "规模：200人 · 行业：智能制造" },
      { name: "川渝产业链供需对接活动", desc: "时间：2026-06-10 · 地点：天府国际会议中心", meta: "规模：500人 · 行业：综合" },
      { name: "2026创新创业大赛（青羊赛区）", desc: "时间：2026-07-01 · 地点：青羊区创新中心", meta: "规模：100人 · 行业：科技创新" },
      { name: "金融服务实体经济对接会", desc: "时间：2026-05-28 · 地点：成都金融城", meta: "规模：300人 · 行业：金融" },
    ];

    return '<div class="ent-page fade-in">' +
      entTopActionBar("线下活动", "找政策&园区服务经理") +
      entPartnerBar(["公关公司", "咨询策划公司"]) +
      '<div class="ent-single-panel">' +
        '<div class="ent-event-section ent-event-primary">' +
          '<h3 class="ent-dual-title">区域内活动推荐</h3>' +
          '<p class="muted">根据活动时间、地点、行业、内容、组织者、活动规模等排序</p>' +
          '<div class="ent-event-list">' +
            eventRecs.map(function(ev) {
              return '<div class="ent-event-card">' +
                '<div class="ent-event-name">' + esc(ev.name) + '</div>' +
                '<div class="ent-event-desc">' + esc(ev.desc) + '</div>' +
                '<div class="ent-event-meta">' + esc(ev.meta) + '</div>' +
              '</div>';
            }).join("") +
          '</div>' +
        '</div>' +
        '<div class="ent-event-section ent-event-secondary">' +
          '<h3 class="ent-dual-title">其他活动搜索</h3>' +
          entSearchCard("活动搜索", "请输入区域、行业、内容等开展模糊搜索…", "") +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function bankLeads() {
    var bankId = state.active.bank_id;
    return (state.demands || []).filter(function (d) {
      return (d.category || "").indexOf("融资") >= 0 && hasConsent(d.enterprise_id, bankId, "融资对接");
    });
  }

  function followupsFor(demandId) {
    var bankId = state.active.bank_id;
    return (state.bank_followups || []).filter(function (f) {
      return f.bank_id === bankId && (!demandId || f.demand_id === demandId);
    });
  }

  function pageBankOverview() {
    var leads = bankLeads();
    var fus = followupsFor(null);
    var converted = fus.filter(function (f) { return f.stage === "已转化"; }).length;
    var risk = (seed.alerts || []).filter(function (a) { return a.level === "高" && hasConsent(a.enterprise_id, state.active.bank_id, "融资对接"); }).length;

    var rows = leads
      .slice()
      .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })
      .slice(0, 6)
      .map(function (d) {
        var e = entById(d.enterprise_id) || { name: "未知企业" };
        var amt = esc((d.amount_w || 0) + " 万");
        return "<tr><td><a href=\"#/bank/lead/" + d.id + "\"><b>" + esc(e.name) + "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" + esc(d.title) + "</div></a></td><td><span class=\"tag teal\">" + amt + "</span></td><td><span class=\"tag\">" + esc(d.status) + "</span></td></tr>";
      })
      .join("");

    return (
      '<div class="grid">' +
      card(
        "银行端总览",
        "授权线索 -> 画像尽调 -> 跟进回填",
        '<a class="btn" href="#/bank/leads">进入线索池</a>',
        kpis([
          { label: "授权线索", value: String(leads.length), hint: "融资企业（已授权）" },
          { label: "跟进记录", value: String(fus.length), hint: "触达/资料/意向" },
          { label: "已转化", value: String(converted), hint: "演示口径" },
          { label: "风险关注", value: String(risk), hint: "授权范围内" },
        ])
      ) +
      card(
        "仅展示企业已授权的融资企业",
        "仅展示企业已授权的融资企业",
        "",
        '<table class="table"><thead><tr><th>企业</th><th>金额</th><th>负责人</th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="3" class="muted">暂无需求线索。可切到企业端授权并提交融资企业。</td></tr>') +
          "</tbody></table>"
      ) +
      "</div>"
    );
  }

  function pageBankLeads() {
    var rows = bankLeads()
      .slice()
      .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })
      .map(function (d) {
        var e = entById(d.enterprise_id) || { name: "未知企业" };
        var last = followupsFor(d.id).slice(-1)[0];
        var stage = (last && last.stage) || "未触达";
        var amt = esc((d.amount_w || 0) + " 万");
        return "<tr><td><a href=\"#/bank/lead/" + d.id + "\"><b>" + esc(e.name) + "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" + esc(d.title) + "</div></a></td><td><span class=\"tag teal\">" + amt + "</span></td><td><span class=\"tag\">" + esc(stage) + "</span></td><td><button class=\"btn\" data-action=\"bank_followup\" data-id=\"" + d.id + "\">记录跟进</button></td></tr>";
      })
      .join("");

    return (
      '<div class="grid">' +
      card(
        "基于企业授权与融资企业形成线索",
        "基于企业授权与融资企业形成线索",
        '<a class="btn" href="#/bank/overview">返回首页</a>',
        '<table class="table"><thead><tr><th>企业</th><th>金额</th><th>阶段</th><th></th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="4" class="muted">暂无需求线索。可切到企业端授权并提交融资企业。</td></tr>') +
          "</tbody></table>"
      ) +
      "</div>"
    );
  }

  function pageBankLeadDetail(demandId) {
    var d = (state.demands || []).find(function (x) { return x.id === demandId; });
    if (!d) return '<div class="card fade-in"><div class="hd"><p class="title">线索不存在</p></div><div class="bd muted">请从线索池进入。</div></div>';
    if (!hasConsent(d.enterprise_id, state.active.bank_id, "融资对接")) {
      return '<div class="card fade-in"><div class="hd"><p class="title">无权限</p></div><div class="bd muted">该企业未对本机构授权融资对接。</div></div>';
    }

    var e = entById(d.enterprise_id) || { name: "未知企业", id: d.enterprise_id };
    var alert = (seed.alerts || []).find(function (a) { return a.enterprise_id === e.id; });
    var fu = followupsFor(d.id)
      .slice()
      .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })
      .map(function (f) {
        return '<div style="margin-bottom:10px;"><span class="tag teal">' + esc(f.stage) + "</span> <span class=\"muted\">" + esc(fmtDate(f.created_at)) + "</span><div style=\"margin-top:6px;\">" + esc((f.notes || []).join("；")) + "</div></div>";
      })
      .join("");

    var riskHtml = alert
      ? '<div style="margin-top:10px;"><span class="tag red">风险</span> ' +
        esc(alert.type + " · " + alert.level + " · 风险指数 " + alert.score) +
        '<div class="muted" style="margin-top:6px;line-height:1.6;">' + esc(alert.suggestion) + "</div></div>"
      : '<div class="muted" style="margin-top:10px;">暂无需求高风险预警（演示口径）。</div>';

    return (
      '<div class="grid">' +
      card(
        "线索详情",
        e.name + " · 融资对接（已授权）",
        '<a class="btn" href="#/bank/overview">返回首页</a><a class="btn" href="#/bank/leads">返回列表</a><button class="btn primary" data-action="bank_followup" data-id="' + d.id + '">记录跟进</button><button class="btn" data-action="mark_converted" data-id="' + d.id + '">标记已转化</button>',
        '<div class="split"><div><div class="muted">公开画像</div>' +
          '<div class="mono" style="margin-top:8px;">统一社会信用代码：' + esc(e.uscc) + "</div>" +
          '<div class="mono" style="margin-top:6px;">行业：' + esc(e.industry) + "</div>" +
          '<div style="margin-top:10px;">' + (e.tags || []).slice(0, 6).map(function (t) { return '<span class="tag teal">' + esc(t) + "</span>"; }).join("") + "</div>" +
          riskHtml +
          '</div><div><div class="muted">融资企业（授权字段）</div>' +
          '<div style="margin-top:8px;"><span class="tag teal">金额</span> <b>' + esc((d.amount_w || 0) + " 万") + "</b></div>" +
          '<p style="margin:10px 0 0;line-height:1.7;"><b>' + esc(d.title) + "</b></p>" +
          '<p class="muted" style="margin:8px 0 0;line-height:1.7;">' + esc(d.detail) + "</p>" +
          '<div style="margin-top:14px;"><div class="muted">跟进记录</div><div style="margin-top:8px;">' + (fu || '<div class="muted">暂无需求</div>') + "</div></div>" +
          "</div></div>"
      ) +
      "</div>"
    );
  }

  function pageBankWorkbench() {
    var rows = (state.bank_followups || [])
      .filter(function (f) { return f.bank_id === state.active.bank_id; })
      .slice()
      .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); })
      .map(function (f) {
        var e = entById(f.enterprise_id) || { name: "未知企业" };
        var d = (state.demands || []).find(function (x) { return x.id === f.demand_id; });
        return "<tr><td><b>" + esc(e.name) + "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" + esc(d ? d.title : "-") + "</div></td><td><span class=\"tag teal\">" + esc(f.stage) + "</span></td><td><span class=\"tag\">" + esc(fmtDate(f.created_at)) + "</span></td><td><button class=\"btn\" data-action=\"bank_followup\" data-id=\"" + esc(f.demand_id) + "\">继续</button></td></tr>";
      })
      .join("");

    return (
      '<div class="grid">' +
      card(
        "触达记录、阶段推进、结果回填",
        "触达记录、阶段推进、结果回填",
        '<a class="btn" href="#/bank/overview">返回首页</a>',
        '<table class="table"><thead><tr><th>企业</th><th>阶段</th><th>时间</th><th></th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="4" class="muted">暂无需求</td></tr>') +
          "</tbody></table>"
      ) +
      "</div>"
    );
  }

  function pageBankRisk() {
    var rows = (seed.alerts || [])
      .filter(function (a) {
        return hasConsent(a.enterprise_id, state.active.bank_id, "融资对接");
      })
      .slice()
      .sort(function (a, b) {
        return (b.score || 0) - (a.score || 0);
      })
      .map(function (a) {
        var e = entById(a.enterprise_id) || { name: "未知企业" };
        var tag = a.level === "高" ? "red" : a.level === "中" ? "orange" : "green";
        return (
          "<tr>" +
          "<td><b>" +
          esc(e.name) +
          "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" +
          esc(a.type) +
          "</div></td>" +
          "<td><span class=\"tag " +
          tag +
          "\">" +
          esc(a.level + "风险") +
          "</span><span class=\"tag\">评分 " +
          esc(a.score) +
          "</span></td>" +
          "<td class=\"muted\">" +
          esc(a.suggestion) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    return (
      '<div class="grid">' +
      card(
        "可用于贷后关注与协同处置（演示）",
        "可用于贷后关注与协同处置（演示）",
        '<a class="btn" href="#/bank/overview">返回首页</a>',
        '<table class="table"><thead><tr><th>企业</th><th>风险</th><th>建议</th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="3" class="muted">暂无需求。提示：需要企业授权。</td></tr>') +
          "</tbody></table>"
      ) +
      "</div>"
    );
  }

  function pageBankSettings() {
    var opts = (seed.banks || [])
      .map(function (b) {
        var sel = b.id === state.active.bank_id ? "selected" : "";
        return '<option value="' + esc(b.id) + '" ' + sel + ">" + esc(b.name) + "</option>";
      })
      .join("");

    return (
      '<div class="grid">' +
      card(
        "切换机构与重置演示数据",
        "切换机构与重置演示数据",
        '<a class="btn" href="#/bank/overview">返回首页</a><button class="btn danger" data-action="reset_demo">恢复演示数据</button>',
        '<div class="field"><label>当前机构</label><select data-role="bank-switch">' +
          opts +
          '</select></div><p class="muted" style="margin:12px 0 0;line-height:1.7;">切换机构后，线索池会基于授权范围重新计算。</p>'
      ) +
      "</div>"
    );
  }

  function openScript() {
    var html =
      '<div><p style="margin:0;line-height:1.7;"><b>建议演示路径（10-15 分钟）</b></p>' +
      '<ol style="margin:10px 0 0;line-height:1.7;">' +
      "<li>平台首页：查看青羊区重点专题入口和核心指标总览</li>" +
      "<li>区域经济研判：区级视图 -> 街道视图 -> 园区视图</li>" +
      "<li>产业链式图谱：查看薄弱环节、补链方向与相关企业</li>" +
      "<li>重点项目调度：查看项目总览、目录筛选和项目详情</li>" +
      "<li>领导决策支撑 / 政府统计数据：查看统计摘要、讲话会议分析和资料库</li>" +
      "</ol><p class=\"muted\" style=\"margin:12px 0 0;line-height:1.7;\">注：当前平台为青羊区政府专属演示版，数据已按青羊区专题场景收敛展示。</p></div>" +
      '<div class="row-actions"><button class="btn" data-action="modal_close">关闭</button></div>';
    modalOpen("GIS 演示说明", html);
  }

  function runGeoSearch(term) {
    var q = String(term || "").trim();
    var rt = route();
    var p = rt.path.indexOf("/gov/geo-") === 0 ? rt.path : "/gov/geo-street";
    geoSearchDropdownHide();
    if (!q) {
      updateGeoHash({ q: "" }, p);
      toast("已清空地理搜索");
      return;
    }
    updateGeoHash({ q: q }, p);
    toast("已搜索：" + q);
  }

  // ── Search autocomplete (typeahead) ────────────────────────────
  var _geoSearchDebounce = 0;
  var _geoSearchDropdownIdx = -1;
  var _geoSearchDropdownItems = [];

  function geoSearchCandidates() {
    var geo = geoData();
    var out = [];
    (geo.streets || []).forEach(function (s) {
      if (s && s.name) out.push({ type: "street", name: s.name, id: s.id, did: s.district_id });
    });
    (geo.parks || []).forEach(function (p) {
      if (p && p.name) out.push({ type: "park", name: p.name, id: p.id, did: p.district_id });
    });
    (geo.buildings || []).forEach(function (b) {
      if (b && b.name) out.push({ type: "building", name: b.name, id: b.id, sid: b.street_id, pid: b.park_id });
    });
    var ents = typeof govDemoEnterprises === "function" ? govDemoEnterprises() : (seed.enterprises || []);
    ents.forEach(function (e) {
      if (e && e.name) out.push({ type: "enterprise", name: e.name, id: e.id });
    });
    return out;
  }

  function geoSearchMatch(candidates, term, limit) {
    var t = String(term || "").trim().toLowerCase();
    if (!t) return [];
    var exact = [];
    var prefix = [];
    var contains = [];
    for (var i = 0; i < candidates.length; i++) {
      var n = (candidates[i].name || "").toLowerCase();
      if (n === t) { exact.push(candidates[i]); continue; }
      if (n.indexOf(t) === 0) { prefix.push(candidates[i]); continue; }
      if (n.indexOf(t) >= 0) { contains.push(candidates[i]); continue; }
    }
    return exact.concat(prefix, contains).slice(0, limit || 8);
  }

  function geoSearchTypeLabel(type) {
    if (type === "street") return "街道";
    if (type === "park") return "园区";
    if (type === "building") return "楼宇";
    if (type === "enterprise") return "企业";
    return "";
  }

  function geoSearchDropdownShow(input, items) {
    _geoSearchDropdownItems = items;
    _geoSearchDropdownIdx = -1;
    var existing = document.getElementById("geo-search-dropdown");
    if (existing) existing.remove();
    if (!items.length) return;
    var wrap = input.closest(".geo-search");
    if (!wrap) return;
    var dd = document.createElement("div");
    dd.id = "geo-search-dropdown";
    dd.className = "geo-search-dropdown";
    dd.setAttribute("role", "listbox");
    dd.innerHTML = items.map(function (it, idx) {
      return '<div class="geo-search-item" data-idx="' + idx + '" role="option">' +
        '<span class="geo-search-item-name">' + esc(it.name) + '</span>' +
        '<span class="geo-search-item-type">' + geoSearchTypeLabel(it.type) + '</span></div>';
    }).join("");
    wrap.style.position = "relative";
    wrap.appendChild(dd);
    dd.addEventListener("mousedown", function (ev) {
      ev.preventDefault(); // keep input focused
      var item = ev.target.closest(".geo-search-item");
      if (!item) return;
      var idx = Number(item.getAttribute("data-idx") || 0);
      geoSearchDropdownSelect(input, idx);
    });
  }

  function geoSearchDropdownHide() {
    _geoSearchDropdownItems = [];
    _geoSearchDropdownIdx = -1;
    var dd = document.getElementById("geo-search-dropdown");
    if (dd) dd.remove();
  }

  function geoSearchDropdownHighlight(idx) {
    var dd = document.getElementById("geo-search-dropdown");
    if (!dd) return;
    var items = dd.querySelectorAll(".geo-search-item");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("highlighted", i === idx);
    }
    _geoSearchDropdownIdx = idx;
  }

  function geoSearchDropdownSelect(input, idx) {
    var item = _geoSearchDropdownItems[idx];
    if (!item) return;
    input.value = item.name;
    geoSearchDropdownHide();
    runGeoSearch(item.name);
  }

  function geoSearchDropdownKeydown(ev, input) {
    if (!_geoSearchDropdownItems.length) return false;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      var next = _geoSearchDropdownIdx < _geoSearchDropdownItems.length - 1 ? _geoSearchDropdownIdx + 1 : 0;
      geoSearchDropdownHighlight(next);
      return true;
    }
    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      var prev = _geoSearchDropdownIdx > 0 ? _geoSearchDropdownIdx - 1 : _geoSearchDropdownItems.length - 1;
      geoSearchDropdownHighlight(prev);
      return true;
    }
    if (ev.key === "Enter" && _geoSearchDropdownIdx >= 0) {
      ev.preventDefault();
      geoSearchDropdownSelect(input, _geoSearchDropdownIdx);
      return true;
    }
    if (ev.key === "Escape") {
      geoSearchDropdownHide();
      return true;
    }
    return false;
  }

  function openNewDemand() {
    var html =
      '<div class="form">' +
      '<div class="field"><label>企业风险</label><select id="d-cat"><option value="融资对接">融资对接</option><option value="配套服务">配套服务</option><option value="政策申报">政策申报</option><option value="融资对接">融资对接</option></select></div>' +
      '<div class="field"><label>标题</label><input id="d-title" placeholder="例如：设备更新贷款 300 万" /></div>' +
      '<div class="field"><label>金额（万，仅融资）</label><input id="d-amt" placeholder="例如：300" /></div>' +
      '<div class="field"><label>期望时间（可选）</label><input id="d-deadline" placeholder="例如：2026-03-20" /></div>' +
      '<div class="field span2"><label>说明</label><textarea id="d-detail" placeholder="补充约束条件、联系方式等"></textarea></div>' +
      "</div>" +
      '<div class="row-actions"><button class="btn" data-action="modal_close">取消</button><button class="btn primary" data-action="create_demand">提交</button></div>';
    modalOpen("发布企业", html);
  }

  function openDemand(demandId) {
    var d = (state.demands || []).find(function (x) { return x.id === demandId; });
    if (!d) return;
    var e = entById(d.enterprise_id) || { name: "未知企业" };
    var matches = matchResources(d)
      .map(function (m) {
        return "<tr><td><b>" + esc(m.r.name) + "</b><div class=\"muted\" style=\"font-size:12px;margin-top:4px;\">" + esc((m.r.tags || []).join(" / ")) + "</div></td><td><span class=\"tag teal\">派单度 " + esc(m.score) + "</span></td><td><button class=\"btn\" data-action=\"make_wo\" data-id=\"" + d.id + "\">生成工单</button></td></tr>";
      })
      .join("");

    var hint = "";
    if ((d.category || "").indexOf("融资") >= 0) {
      hint = '<p class="muted" style="margin:12px 0 0;line-height:1.7;">融资对接建议：先到「企业自主授权，最小化共享字段，访问留痕审计（演示）」授权银行，本机构线索池才能看到。</p>';
    }

    modalOpen(
      "需求详情 · " + e.name,
      '<div><span class="tag teal">' +
        esc(d.category) +
        "</span> <span class=\"tag\">" +
        esc(d.status) +
        "</span>" +
        '<p style="margin:10px 0 0;line-height:1.7;"><b>' +
        esc(d.title) +
        "</b></p>" +
        '<p class="muted" style="margin:8px 0 0;line-height:1.7;">' +
        esc(d.detail) +
        "</p>" +
        (d.amount_w ? '<p style="margin:8px 0 0;"><span class="tag teal">金额</span> <b>' + esc(d.amount_w + " 万") + "</b></p>" : "") +
        '<p class="muted" style="margin:12px 0 10px;">派单推荐（演示）：</p>' +
        '<table class="table"><thead><tr><th>资源</th><th>派单</th><th></th></tr></thead><tbody>' +
        (matches || '<tr><td colspan="3" class="muted">暂无需求</td></tr>') +
        "</tbody></table>" +
        hint +
        '</div><div class="row-actions"><button class="btn" data-action="modal_close">关闭</button></div>'
    );
  }

  function openRes(resId) {
    var r = (seed.resources || []).find(function (x) { return x.id === resId; });
    if (!r) return;
    var typeName = r.type === "space" ? "融资对接" : r.type === "finance" ? "金融服务" : "服务机构";
    modalOpen(
      "资源详情",
      '<div><span class="tag teal">' +
        esc(typeName) +
        "</span>" +
        '<p style="margin:10px 0 0;line-height:1.7;"><b>' +
        esc(r.name) +
        "</b></p>" +
        '<p class="muted" style="margin:8px 0 0;line-height:1.7;">标签：' +
        esc((r.tags || []).join(" / ")) +
        "</p>" +
        '<p class="muted" style="margin:8px 0 0;">联系方式：' +
        esc(r.capacity || "-") +
        "</p>" +
        '<p class="muted" style="margin:8px 0 0;">联系方式：' +
        esc(r.contact || "-") +
        "</p></div>" +
        '<div class="row-actions"><button class="btn" data-action="modal_close">关闭</button></div>'
    );
  }

  function openGeoBuilding(buildingId, opts) {
    opts = opts || {};
    var geo = geoData();
    var b = (geo.buildings || []).find(function (x) {
      return x.id === buildingId;
    });
    if (!b) return;
    var s = geoStreetById(b.street_id) || {};
    var d = geoDistrictById(s.district_id) || {};
    var p = geoParkById(b.park_id) || {};
    var ents = govDemoEnterprises().filter(function (item) {
      return item.building_id === b.id || item.park_id === b.park_id || item.street_id === b.street_id;
    });
    if (!ents.length) ents = govDemoEnterprises();
    var picked = ents.slice(0, 8);
    var focusEnt = null;
    if (opts.focus_enterprise_id) {
      focusEnt = ents.find(function (e) {
        return e.id === opts.focus_enterprise_id;
      }) || null;
    }
    if (!focusEnt && picked.length) focusEnt = picked[0];
    if (focusEnt) {
      picked = [focusEnt].concat(
        picked.filter(function (e) {
          return e.id !== focusEnt.id;
        })
      );
    }
    var floors = ["8F", "7F", "6F", "5F", "4F", "3F", "2F", "1F"]
      .map(function (f, idx) {
        var e1 = picked[idx % Math.max(1, picked.length)];
        var e2 = picked[(idx + 2) % Math.max(1, picked.length)];
        return (
          '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid rgba(16,33,44,0.12);border-radius:10px;margin-bottom:8px;background:rgba(255,255,255,0.72);">' +
          "<b>" +
          f +
          "</b>" +
          '<div style="text-align:right;">' +
          (e1 ? '<a href="#/gov/enterprise/' + esc(e1.id) + '">' + esc(e1.name) + "</a>" : "-") +
          "<br/>" +
          (e2 ? '<a href="#/gov/enterprise/' + esc(e2.id) + '">' + esc(e2.name) + "</a>" : "-") +
          "</div></div>"
        );
      })
      .join("");

    modalOpen(
      "楼宇详情",
      '<div class="split">' +
        "<div>" +
        '<p style="margin:0 0 10px;"><span class="tag teal">楼宇</span><span class="tag">' +
        esc((d.name || "-") + " · " + (s.name || "-")) +
        "</span></p>" +
        (p.name ? '<p class="muted" style="margin:0 0 8px;">所属园区：' + esc(p.name) + "</p>" : "") +
        '<p style="margin:0 0 8px;"><b>' +
        esc(b.name) +
        "</b></p>" +
        '<p class="muted" style="margin:0 0 8px;">网格：' +
        esc((d.name || "") + (s.name || "") + "示例路段") +
        "</p>" +
        (opts.from_storyline ? '<p style="margin:0 0 8px;"><span class="tag teal">一键串场</span><span class="tag">园区→楼宇→飞控导航</span></p>' : "") +
        '<p class="muted" style="margin:0 0 8px;">产业方向：' +
        esc(b.lead_industry || "-") +
        "</p>" +
        '<p class="muted" style="margin:0 0 8px;">建筑面积：' +
        esc(b.area_sqm) +
        "㎡</p>" +
        '<p class="muted" style="margin:0 0 8px;">入驻率：' +
        esc(pct(b.occupied_rate, 1)) +
        "</p>" +
        '<p class="muted" style="margin:0 0 8px;">年度产出：' +
        esc(fixed(b.output_y, 1)) +
        "亿元，税收 " +
        esc(fixed(b.tax_y, 1)) +
        "亿元</p>" +
        (focusEnt
          ? '<p class="muted" style="margin:0 0 8px;">推荐企业：<a href="#/gov/enterprise/' +
            esc(focusEnt.id) +
            '">' +
            esc(focusEnt.name) +
            "</a></p>"
          : "") +
        "</div>" +
        "<div>" +
        '<p style="margin:0 0 10px;"><span class="tag orange">楼宇数字孪生（示意）</span></p>' +
        floors +
        "</div></div>" +
        '<div class="row-actions">' +
        (focusEnt
          ? '<button class="btn primary" data-action="geo_open_enterprise" data-id="' +
            esc(focusEnt.id) +
            '">直达飞控导航</button>'
          : "") +
        '<button class="btn" data-action="modal_close">关闭</button></div>'
    );
  }

  function openAssign(type, refId, title) {
    var opts = (seed.staff || [])
      .map(function (s) {
        return '<option value="' + esc(s.id) + '">' + esc(s.name + " · " + s.title) + "</option>";
      })
      .join("");
    var existing = workOrderByRef(type, refId);

    modalOpen(
      "派单/更新工单",
      '<div class="form">' +
        '<div class="field span2"><label>事项标题</label><input id="wo-title" value="' + esc((existing && existing.title) || title || "") + '" /></div>' +
        '<div class="field"><label>负责人</label><select id="wo-assignee">' + opts + "</select></div>" +
        '<div class="field"><label>负责人</label><select id="wo-status"><option value="待派单">待派单</option><option value="处理中">处理中</option><option value="已保存跟进">已保存跟进</option></select></div>' +
        '<div class="field span2"><label>跟进记录（可选）</label><textarea id="wo-note" placeholder="例如：已电话沟通，安排上门走访…"></textarea></div>' +
        "</div>" +
        '<div class="row-actions"><button class="btn" data-action="modal_close">取消</button><button class="btn primary" data-action="save_wo" data-type="' + esc(type) + '" data-ref="' + esc(refId) + '">保存</button></div>'
    );

    setTimeout(function () {
      try {
        if (existing) {
          if (existing.assignee) document.getElementById("wo-assignee").value = existing.assignee;
          if (existing.status) document.getElementById("wo-status").value = existing.status;
        } else if (seed.staff && seed.staff[0]) {
          document.getElementById("wo-assignee").value = seed.staff[0].id;
          document.getElementById("wo-status").value = "处理中";
        }
      } catch (e) {}
    }, 0);
  }

  function openBankFollowup(demandId) {
    var html =
      '<div class="form">' +
      '<div class="field"><label>阶段</label><select id="bf-stage"><option value="已触达">已触达</option><option value="资料收集">资料收集</option><option value="有意向">有意向</option><option value="已转化">已转化</option></select></div>' +
      '<div class="field"><label>时间</label><input id="bf-date" value="' + esc(today()) + '" /></div>' +
      '<div class="field span2"><label>记录</label><textarea id="bf-note" placeholder="例如：已联系财务负责人，收集流水与设备清单…"></textarea></div>' +
      "</div>" +
      '<div class="row-actions"><button class="btn" data-action="modal_close">取消</button><button class="btn primary" data-action="save_followup" data-id="' + esc(demandId) + '">保存</button></div>';
    modalOpen("记录跟进", html);
  }

  function maybeRunGeoStorylineAuto(path, rt) {
    if (path !== "/gov/geo-park") {
      geoStoryAutoKey = "";
      return;
    }
    var q = (rt && rt.q) || {};
    var bid = q.auto_building || "";
    if (!bid) {
      geoStoryAutoKey = "";
      return;
    }
    var key = [path, bid, q.auto_enterprise || "", q.story || ""].join("|");
    if (geoStoryAutoKey === key) return;
    geoStoryAutoKey = key;
    setTimeout(function () {
      openGeoBuilding(bid, {
        focus_enterprise_id: q.auto_enterprise || "",
        from_storyline: q.story === "1",
      });
    }, 48);
  }

  function maybeRunChainAutoDetail(path, rt) {
    if (path !== "/gov/chain") {
      chainAutoDetailKey = "";
      return;
    }
    var q = (rt && rt.q) || {};
    var nodeId = q.open_node || "";
    if (!nodeId) {
      chainAutoDetailKey = "";
      return;
    }
    var autoKey = [path, q.district || "", q.industry || "", nodeId].join("|");
    if (chainAutoDetailKey === autoKey) return;
    chainAutoDetailKey = autoKey;
    setTimeout(function () {
      var nodeMeta = _chainNodeRegistry && _chainNodeRegistry.nodes ? _chainNodeRegistry.nodes[nodeId] : null;
      if (!nodeMeta) return;
      modalOpen(nodeMeta.label + " · 节点详细介绍", chainNodeDetailHtml(nodeId));
      try {
        var nextQ = Object.assign({}, q);
        delete nextQ.open_node;
        history.replaceState(null, "", buildHash("/gov/chain", nextQ));
      } catch (e) {}
    }, 60);
  }

  function render() {
    try { renderInner(); } catch (e) {
      var app = document.getElementById("app");
      if (app) {
        app.style.cssText = 'padding:40px;';
        app.innerHTML = '<h2 style="color:red">JS 运行错误</h2><p><b>' + (e.message || e) + '</b></p>' +
          (e.stack ? '<pre style="white-space:pre-wrap;background:#fee;padding:12px;border-radius:4px;font-size:12px;max-height:50vh;overflow:auto">' + e.stack + '</pre>' : '') +
          '<p style="margin-top:20px"><button onclick="localStorage.removeItem(&quot;ib_demo_state_v1&quot;);location.reload();" style="padding:8px 16px;font-size:14px;cursor:pointer">清除缓存并刷新</button></p>';
      }
      var diag = document.getElementById("diag");
      if (diag) { diag.style.background = '#f00'; diag.style.color = '#fff'; diag.textContent = '[ERROR] ' + (e.message || e); }
    }
  }

  /* ── Brain-dashboard: hover scale + tooltip for street shapes ── */
  function setupBrainDashboardHover() {
    var hitLayer = document.querySelector('.brainx-map-hittest');
    if (!hitLayer) return;

    // Create tooltip
    var tip = document.createElement('div');
    tip.className = 'brainx-shape-tip';
    tip.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;opacity:0;transition:opacity 150ms;' +
      'background:rgba(6,24,44,0.92);color:#b8ecff;font-size:13px;padding:5px 12px;border-radius:6px;' +
      'border:1px solid rgba(100,220,255,0.25);box-shadow:0 2px 12px rgba(0,0,0,0.4);white-space:nowrap;';
    document.body.appendChild(tip);

    var activeHit = null;

    function findHit(el) {
      while (el && el !== hitLayer) {
        if (el.classList && el.classList.contains('brainx-hit')) return el;
        el = el.parentNode;
      }
      return null;
    }

    function highlight(hit) {
      if (hit === activeHit) return;
      unhighlight();
      activeHit = hit;
      var name = hit.getAttribute('data-name') || '';
      if (name) {
        tip.textContent = name;
        tip.style.opacity = '1';
      }
    }

    function unhighlight() {
      if (!activeHit) return;
      activeHit = null;
      tip.style.opacity = '0';
    }

    hitLayer.addEventListener('mouseover', function (e) {
      var hit = findHit(e.target);
      if (hit) highlight(hit);
    });

    hitLayer.addEventListener('mouseout', function (e) {
      var related = findHit(e.relatedTarget);
      if (!related) unhighlight();
    });

    hitLayer.addEventListener('mousemove', function (e) {
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top = (e.clientY - 10) + 'px';
    });

    hitLayer.addEventListener('click', function (e) {
      var hit = findHit(e.target);
      if (hit) {
        var sid = hit.getAttribute('data-sid');
        if (sid) location.hash = buildHash("/gov/geo-street", { scope: "street", sid: sid, pid: "" });
      }
    });

    // cleanup
    hitLayer._brainHoverCleanup = function () {
      if (tip.parentNode) tip.parentNode.removeChild(tip);
    };
  }

  /* ── Align HTML marker overlays to actual SVG anchor points ── */
  function alignBrainDashboardMarkers() {
    var svg = document.querySelector('.brainx-map-svg');
    if (!svg) return;
    var svgRect = svg.getBoundingClientRect();
    var anchors = svg.querySelectorAll('.brainx-anchor');
    if (!anchors.length) return;
    var svgPoint = svg.createSVGPoint ? svg.createSVGPoint() : null;

    // Build anchor lookup: sid → pixel position relative to SVG element
    var anchorPos = {};
    for (var i = 0; i < anchors.length; i++) {
      var sid = anchors[i].getAttribute('data-sid');
      var pos = null;
      if (svgPoint && anchors[i].getScreenCTM) {
        var ctm = anchors[i].getScreenCTM();
        if (ctm) {
          svgPoint.x = Number(anchors[i].getAttribute('cx') || 0);
          svgPoint.y = Number(anchors[i].getAttribute('cy') || 0);
          var screenPt = svgPoint.matrixTransform(ctm);
          pos = {
            x: screenPt.x - svgRect.left,
            y: screenPt.y - svgRect.top
          };
        }
      }
      if (!pos) {
        var ar = anchors[i].getBoundingClientRect();
        pos = {
          x: ar.left + ar.width / 2 - svgRect.left,
          y: ar.top + ar.height / 2 - svgRect.top
        };
      }
      anchorPos[sid] = pos;
    }

    // Position markers
    var markers = document.querySelectorAll('.brainx-map-marker[data-sid]');
    for (var m = 0; m < markers.length; m++) {
      var msid = markers[m].getAttribute('data-sid');
      var mpos = anchorPos[msid];
      if (mpos) {
        markers[m].style.left = mpos.x + 'px';
        markers[m].style.top = mpos.y + 'px';
      }
    }

    // Position beacons
    var beacons = document.querySelectorAll('.brainx-map-beacon[data-sid]');
    for (var b = 0; b < beacons.length; b++) {
      var bsid = beacons[b].getAttribute('data-sid');
      var bpos = anchorPos[bsid];
      if (bpos) {
        beacons[b].style.left = bpos.x + 'px';
        beacons[b].style.top = bpos.y + 'px';
      }
    }
  }

  // Re-align on window resize
  var _alignTimer = null;
  window.addEventListener('resize', function () {
    if (_alignTimer) clearTimeout(_alignTimer);
    _alignTimer = setTimeout(function () {
      if (document.body.classList.contains('brain-dashboard-fullscreen')) {
        alignBrainDashboardMarkers();
      }
    }, 100);
  });

  function renderInner() {
    ensureChrome();
    zdxCleanupCharts();
    var app = document.getElementById("app");
    var rt = route();
    var path = rt.path;

    /* ── Login gate ── */
    if (!isLoggedIn() && path !== "/login") {
      location.hash = "#/login";
      return;
    }
    if (path === "/login") {
      app.innerHTML = pageLogin();
      return;
    }

    /* ── Role picker ── */
    if (path === "/" || path === "") {
      app.innerHTML = pageRolePicker();
      return;
    }

    /* ── Enterprise routes ── */
    if (path.indexOf("/ent/") === 0) {
      if (state.role !== "enterprise") {
        state.role = "enterprise";
        save(state);
      }
    }
    /* ── Gov routes ── */
    else if (path.indexOf("/gov/") === 0) {
      if (state.role !== "gov") {
        state.role = "gov";
        save(state);
      }
      var canonicalGovHash = govDemoCanonicalHash(path, rt.q || {});
      if (canonicalGovHash && canonicalGovHash !== location.hash) {
        location.hash = canonicalGovHash;
        return;
      }
      var canonicalGeoHash = geoCanonicalHash(path, rt.q || {});
      if (canonicalGeoHash && canonicalGeoHash !== location.hash) {
        location.hash = canonicalGeoHash;
        return;
      }
    }
    /* ── Unknown route → role picker ── */
    else if (path.indexOf("/bank/") !== 0) {
      location.hash = "#/";
      return;
    }

    var content = "";

    if (path === "/gov/home") content = pageGovHome();
    else if (path === "/gov/investment-analysis") content = pageGovInvestmentAnalysis(rt);
    else if (path === "/gov/enterprise-exit") content = pageGovEnterpriseExit(rt);
    else if (path === "/gov/economic-targets") content = pageGovEconomicTargets(rt);
    else if (path === "/gov/government-stats") content = pageGovGovernmentStats(rt);
    else if (path === "/gov/brain-dashboard") {
      if (!_geoFilesLoaded) {
        app.innerHTML = '<div class="geo-loading-splash"><div class="geo-loading-spinner"></div><p>正在加载地理数据...</p></div>';
        loadGeoDataFiles(function () { render(); });
        return;
      }
      content = pageGovBrainDashboard(rt);
    }
    else if (path === "/gov/key-projects") {
      if (!_geoFilesLoaded) {
        app.innerHTML = '<div class="geo-loading-splash"><div class="geo-loading-spinner"></div><p>正在加载地理数据…</p></div>';
        loadGeoDataFiles(function () { render(); });
        return;
      }
      content = pageGovKeyProjects(rt);
    }
    else if (path === "/gov/key-projects/list") content = pageGovKeyProjectCatalog(rt);
    else if (path === "/gov/key-projects/detail") content = pageGovKeyProjectDetail(rt);
    else if (path === "/gov/decision-data") content = pageGovDecisionDataV2(rt);
    else if (path === "/gov/geo-overview") {
      location.hash = "#/gov/geo-district";
      return;
    }
    else if (path === "/gov/geo-district" || path === "/gov/geo-street" || path === "/gov/geo-park") {
      if (!_geoFilesLoaded) {
        app.innerHTML = '<div class="geo-loading-splash"><div class="geo-loading-spinner"></div><p>正在加载地理数据…</p></div>';
        loadGeoDataFiles(function () { render(); });
        return;
      }
      if (path === "/gov/geo-district") content = pageGovGeoDistrict(rt);
      else if (path === "/gov/geo-street") content = pageGovGeoStreet(rt);
      else content = pageGovGeoPark(rt);
    }
    else if (path === "/gov/geo-building") {
      location.hash = buildHash((rt.q && rt.q.scope) === "park" ? "/gov/geo-park" : "/gov/geo-street", rt.q || {});
      return;
    }
    else if (path === "/gov/overview") {
      location.hash = "#/gov/home";
      return;
    }
    else if (path === "/gov/enterprises") content = pageGovEnterprises(rt);
    else if (path.indexOf("/gov/enterprise/") === 0) content = pageGovEnterpriseDetail(path.split("/").pop());
    else if (path === "/gov/chain") content = pageGovChain(rt);
    else if (path === "/gov/ecosystem") content = pageGovEcosystem();
    else if (path === "/gov/alerts") content = pageGovAlerts();
    else if (path.indexOf("/gov/alert/") === 0) content = pageGovAlertDetail(path.split("/").pop());
    else if (path === "/gov/reports") content = pageGovReports();
    else if (path === "/gov/portrait") content = pageGovPortrait(rt);
    else if (path.indexOf("/gov/portrait/") === 0) content = pageGovPortraitDetail(path.split("/").pop());
    else if (path === "/gov/policy-match") content = pagePolicyMatchHome();
    else if (path === "/gov/policy-enterprise") content = pagePolicyEnterprise(rt);
    else if (path === "/gov/policy-gov") content = pagePolicyGov(rt);
    else if (path === "/gov/settings") content = pageSettings("切换机构与重置演示数据");

    else if (path === "/ent/home") content = pageEntServiceHome();
    else if (path === "/ent/company") content = pageEntCompanyHome();
    else if (path === "/ent/supply-chain") content = pageEntSupplyChain();
    else if (path === "/ent/capital-chain") content = pageEntCapitalChain();
    else if (path === "/ent/rd-service") content = pageEntRdService();
    else if (path === "/ent/policy-park") content = pageEntPolicyPark();
    else if (path === "/ent/offline-events") content = pageEntOfflineEvents();
    else if (path === "/ent/settings") content = pageSettings("切换机构与重置演示数据");

    else if (path === "/bank/overview") content = pageBankOverview();
    else if (path === "/bank/leads") content = pageBankLeads();
    else if (path.indexOf("/bank/lead/") === 0) content = pageBankLeadDetail(path.split("/").pop());
    else if (path === "/bank/workbench") content = pageBankWorkbench();
    else if (path === "/bank/risk") content = pageBankRisk();
    else if (path === "/bank/settings") content = pageBankSettings();

    else content = '<div class="card fade-in"><div class="hd"><p class="title">页面不存在</p></div><div class="bd muted">请从左侧菜单进入。</div></div>';

    var isGeoScene = state.role === "gov" && (path.indexOf("/gov/geo-") === 0 || path === "/gov/overview" || path === "/gov/chain" || path === "/gov/ai-analysis");
    var isPolicyMatch = state.role === "gov" && (path === "/gov/policy-match" || path === "/gov/policy-enterprise" || path === "/gov/policy-gov");
    if (path !== "/gov/brain-dashboard") {
      document.body.classList.remove("brain-dashboard-fullscreen");
    }
    if (isPolicyMatch) {
      app.innerHTML = shell(path, content, {});
      return;
    }
    if (isGeoScene) {
      var shouldSceneTransition = !!app.querySelector('[data-role="geo-stage"]') && Date.now() - geoSceneTransitionPendingAt < 900;
      var didSceneTransition = shouldSceneTransition ? geoCreateSceneTransitionGhost() : false;
      // Save open state of sidebar <details> sections before re-render
      var _openDetails = {};
      var _detailsEls = app.querySelectorAll(".geo-panel .geo-section-collapsible");
      for (var _di = 0; _di < _detailsEls.length; _di++) {
        var _title = _detailsEls[_di].querySelector(".geo-section-summary-title");
        if (_title) _openDetails[_title.textContent] = _detailsEls[_di].open;
      }
      app.innerHTML = shell(path, content, { hideTopbar: true });
      // Restore open state
      var _newDetails = app.querySelectorAll(".geo-panel .geo-section-collapsible");
      for (var _dj = 0; _dj < _newDetails.length; _dj++) {
        var _t2 = _newDetails[_dj].querySelector(".geo-section-summary-title");
        if (_t2 && _openDetails.hasOwnProperty(_t2.textContent)) {
          _newDetails[_dj].open = _openDetails[_t2.textContent];
        }
      }
      initGeoViewport(path, rt.q || {});
      if (didSceneTransition) geoKickSceneEnter();
      geoKickLandingFocus(path, rt.q || {});
      // Show park drawer popup near the active park shape after render
      setTimeout(geoParkDrawerPopup, 60);
      if (geoShouldFastRender(path)) {
        var wait = Math.max(80, geoFastRenderUntil - Date.now());
        if (geoRefineRenderTimer) clearTimeout(geoRefineRenderTimer);
        geoRefineRenderTimer = setTimeout(function () {
          geoRefineRenderTimer = 0;
          geoFastRenderUntil = 0;
          render();
        }, wait);
      }
      maybeRunGeoStorylineAuto(path, rt);
      maybeRunChainAutoDetail(path, rt);
      return;
    }
    if (path === "/gov/brain-dashboard") {
      var prevHit = document.querySelector('.brainx-map-hittest');
      if (prevHit && prevHit._brainHoverCleanup) prevHit._brainHoverCleanup();
      app.innerHTML = content;
      document.body.classList.add("brain-dashboard-fullscreen");
      setupBrainDashboardHover();
      // Align HTML marker overlays to SVG content area (after layout settles)
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { alignBrainDashboardMarkers(); });
      });
      return;
    }
    var hideTopbarSearch = (path === "/gov/portrait");
    app.innerHTML = shell(path, content, hideTopbarSearch ? { hideSearch: true } : {});
    if (path === "/gov/decision-data") maybeFocusDecisionSection(rt);
    if (path === "/gov/key-projects") {
      setTimeout(initZdxKeyProjectCharts, 80);
      var zdxSearchEl = document.getElementById("zdxSearchInput");
      if (zdxSearchEl) {
        zdxSearchEl.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            var rt2 = route();
            location.hash = keyProjectQueryHref("/gov/key-projects", rt2, { term: zdxSearchEl.value });
          }
        });
      }
    }
  }

  document.addEventListener("click", function (ev) {
    // close chain node popup when clicking outside it and outside chain nodes
    var chainPopup = document.getElementById("chain-node-popup");
    if (chainPopup && !chainPopup.classList.contains("hidden")) {
      if (!ev.target.closest(".chain-node-popup") && !ev.target.closest('[data-action="chain_node_click"]')) {
        chainPopup.classList.add("hidden");
        if (chainPopup.parentElement) chainPopup.parentElement.classList.remove("popup-open");
      }
    }
    var geoAnchor = ev.target.closest('a[href^="#/gov/geo-"]');
    if (
      geoAnchor &&
      !ev.defaultPrevented &&
      ev.button === 0 &&
      !ev.metaKey &&
      !ev.ctrlKey &&
      !ev.shiftKey &&
      !ev.altKey
    ) {
      var href = geoAnchor.getAttribute("href") || "";
      var nextHash = href.replace(/^#/, "");
      var nextRt = routeFromHash(nextHash);
      var nextPath = nextRt.path || "";
      if (nextPath.indexOf("/gov/geo-") === 0 && href !== location.hash) {
        ev.preventDefault();
        var currentRt = route();
        var preserveViewport = !!currentRt.path && currentRt.path.indexOf("/gov/geo-") === 0;
        geoNavigateToRoute(nextRt.path, nextRt.q || {}, preserveViewport ? { skipGeoFly: true } : {});
        return;
      }
    }
    // ── Drill-down toggle for risk detail rows ──
    var drillToggle = ev.target.closest(".pid-drill-toggle");
    if (drillToggle) {
      var parentTr = drillToggle.closest("tr");
      if (parentTr) {
        var drillRow = parentTr.nextElementSibling;
        if (drillRow && drillRow.classList.contains("pid-drill-row")) {
          var isOpen = drillRow.style.display !== "none";
          drillRow.style.display = isOpen ? "none" : "table-row";
          drillToggle.textContent = isOpen ? "▸ 查看明细" : "▾ 收起明细";
        }
      }
      return;
    }
    var el = ev.target.closest("[data-action]");
    if (!el) return;
    var act = el.getAttribute("data-action");

    if (act === "modal_close") return modalClose();
    if (act === "open_script") return openScript();
    if (act === "geo_switch_metric") {
      var newMetric = geoNormalizeMetricId(el.getAttribute("data-metric") || "");
      var currentMetric = geoNormalizeMetricId(route().q && route().q.metric);
      if (currentMetric !== newMetric && newMetric) geoEnsureHeatLayerVisible();
      return updateGeoHash({ metric: currentMetric === newMetric ? "" : newMetric, metric_overlay: "" });
    }
    if (act === "geo_submit_search") {
      var input = document.querySelector('[data-role="global-search"]');
      return runGeoSearch(input ? input.value : "");
    }
    if (act === "decision_open_item") {
      openDecisionRecord(el.getAttribute("data-kind") || "speech", el.getAttribute("data-id") || "");
      return;
    }
    if (act === "stats_open_doc") {
      var docTab = el.getAttribute("data-tab") || "manage";
      var docIndex = Number(el.getAttribute("data-index") || -1);
      var doc = governmentStatsDocs(docTab)[docIndex];
      if (!doc) {
        toast("未找到对应资料摘要", "warn");
        return;
      }
      var highlights = Array.isArray(doc.highlights) ? doc.highlights : [];
      var keywords = Array.isArray(doc.keywords) ? doc.keywords : [];
      var metrics = doc.metrics && typeof doc.metrics === "object" ? Object.keys(doc.metrics) : [];
      modalOpen(
        doc.title || "统计资料摘要",
        '<div class="decision-modal">' +
          '<div class="decision-modal-block"><b>资料名称</b><div class="muted" style="margin-top:6px;">' + esc(doc.title || "统计资料") + '</div></div>' +
          '<div class="decision-modal-block"><b>资料属性</b><div class="muted" style="margin-top:6px;">类型：' + esc(doc.type || "资料") + ' · 年度：' + esc(String(doc.year || "--")) + '</div></div>' +
          '<div class="decision-modal-block"><b>摘要说明</b><div class="muted" style="margin-top:6px;line-height:1.75;">' + esc(doc.summary || "当前资料已纳入青羊区统计资料库，可用于宏观指标研判与领导汇报支撑。") + '</div></div>' +
          (highlights.length ? '<div class="decision-modal-block"><b>要点提炼</b><ul class="govstats-modal-list">' + highlights.slice(0, 5).map(function (item) { return '<li>' + esc(item) + '</li>'; }).join("") + '</ul></div>' : "") +
          (keywords.length ? '<div class="decision-modal-block"><b>关键词</b><div class="govstats-chip-list">' + keywords.slice(0, 8).map(function (item) { return '<span class="govstats-chip">' + esc(item) + "</span>"; }).join("") + "</div></div>" : "") +
          (metrics.length ? '<div class="decision-modal-block"><b>可引用指标</b><div class="muted" style="margin-top:6px;">' + esc(metrics.join(" / ")) + '</div></div>' : "") +
        "</div>"
      );
      return;
    }
    if (act === "stats_export_analysis") {
      var exportMetric = annualMetricDef(el.getAttribute("data-metric") || "gdp_billion");
      var exportLatest = qingyangLatestAnnualStat() || {};
      var exportSeries = governmentStatsSeries(exportMetric.id);
      var exportPrev = exportSeries.length > 1 ? exportSeries[exportSeries.length - 2] : null;
      var exportCurrent = exportSeries.length ? exportSeries[exportSeries.length - 1] : null;
      var exportYoY = exportCurrent && exportPrev && exportPrev.value ? (((exportCurrent.value - exportPrev.value) / Math.abs(exportPrev.value)) * 100) : null;
      var exportText = [
        "# 青羊区政府统计数据专题分析摘要",
        "",
        "生成时间：" + nowFmt(),
        "专题指标：" + exportMetric.label,
        "最新年度：" + String(exportLatest.year || "--"),
        "最新值：" + metricValueText(numValue(exportLatest[exportMetric.id]), exportMetric.unit),
        "同比变化：" + (exportYoY == null ? "--" : fixed(exportYoY, 1) + "%"),
        "资料库数量：" + String(qingyangDecisionLibrary().length) + " 份",
        "",
        "分析结论：",
        "1. 当前以“" + exportMetric.label + "”为观察主指标，结合青羊区统计公报和统计年鉴形成趋势研判。",
        "2. 最新年度指标值为 " + metricValueText(numValue(exportLatest[exportMetric.id]), exportMetric.unit) + "，" + (exportYoY == null ? "暂无同比口径。" : "同比变化 " + fixed(exportYoY, 1) + "%。"),
        "3. 建议结合重点产业、重点项目和招商线索进一步交叉分析，形成领导决策支撑材料。",
        "",
        "引用资料：",
        qingyangDecisionLibrary().slice(0, 6).map(function (item, idx) {
          return (idx + 1) + ". " + (item.title || "统计资料") + "（" + String(item.year || "--") + "）";
        }).join("\n")
      ].join("\n");
      downloadText("青羊区政府统计数据专题分析摘要.md", exportText);
      toast("已导出统计分析摘要", "success");
      return;
    }

    if (act === "switch_role") {
      setState(function (st) { st.role = null; });
      location.hash = "#/";
      return;
    }

    if (act === "reset_demo") {
      localStorage.removeItem(KEY);
      state = initState();
      save(state);
      toast("已恢复演示数据", "success");
      location.hash = "#/";
      render();
      return;
    }

    if (act === "logout") {
      setLoggedIn(false);
      location.hash = "#/login";
      toast("已退出登录");
      return;
    }

    if (act === "ai_chat_send") {
      aiChatSend();
      return;
    }

    if (act === "enter_role") {
      var role = el.getAttribute("data-role");
      if (role === "enterprise") {
        var sel = document.querySelector('[data-role="pick-ent"]');
        setState(function (st) {
          st.role = "enterprise";
          if (sel) st.active.enterprise_id = sel.value;
        });
        location.hash = "#/ent/home";
        return;
      }
      if (role === "bank") {
        var selb = document.querySelector('[data-role="pick-bank"]');
        setState(function (st) {
          st.role = "bank";
          if (selb) st.active.bank_id = selb.value;
        });
        location.hash = "#/bank/overview";
        return;
      }
      setState(function (st) { st.role = "gov"; });
      location.hash = "#/gov/home";
      return;
    }

    if (act === "export_demo") return toast("已导出（演示）", "success");
    if (act === "portrait_manage") return toast("后台管理功能建设中", "warn");
    if (act === "portrait_help") return toast("可按产业类别、行业、空间载体逐级筛选企业，并查看企业详情画像。", "info");
    if (act === "dim_detail") {
      var dimIdx = Number(el.getAttribute("data-dim-idx") || 0);
      var dimNames = window.__pidDimNames || [];
      var dimDetails = window.__pidDimDetails || [];
      var dimScoresArr = window.__pidDimScores || [];
      var dimIcons = window.__pidDimIcons || [];
      if (dimDetails[dimIdx] != null) {
        var barCls2 = dimScoresArr[dimIdx] >= 80 ? "high" : dimScoresArr[dimIdx] >= 60 ? "mid" : "low";
        modalOpen(
          (dimIcons[dimIdx] || "") + " " + (dimNames[dimIdx] || "维度详情") + " · " + dimScoresArr[dimIdx] + " 分",
          '<div class="pid-dim-body">' + dimDetails[dimIdx] + '</div>'
        );
      }
      return;
    }
    if (act === "chain_suggest") return toast("已生成补链建议（演示）", "success");
    if (act === "sys_coming") return toast("该子系统正在建设中", "warn");
    if (act === "investment_apply_filter") {
      var investDistrict = (document.querySelector('[data-role="investment-district"]') || {}).value || "";
      var investIndustry = (document.querySelector('[data-role="investment-industry"]') || {}).value || "";
      location.hash = buildHash("/gov/investment-analysis", { did: investDistrict, industry: investIndustry });
      return;
    }

    /* ── Policy Match event handlers ── */
    if (act === "pm_search_ent") {
      var entInput = document.querySelector('[data-pm="ent_name"]');
      _pmRunEnterpriseSearch(entInput ? (entInput.value || "") : (_pmEntState.entName || ""));
      render(); return;
    }
    if (act === "pm_pick_ent") {
      var eId = el.getAttribute("data-id") || "";
      var ent = entById(eId);
      if (ent) {
        _pmEntState.matchedEnt = ent;
        _pmEntState.entName = ent.name;
        _pmEntState.searchKeyword = ent.name;
        _pmEntState.showSuggestions = false;
      }
      render(); return;
    }
    if (act === "pm_has_project") {
      _pmEntState.showSuggestions = false;
      _pmEntState.hasProject = el.value || "";
      render(); return;
    }
    if (act === "pm_match") {
      _pmEntState.showSuggestions = false;
      // collect project data if applicable
      if (_pmEntState.hasProject === "yes") {
        var pd = {};
        var fields = { proj_name: "name", proj_industry: "industry", proj_participation: "participation", proj_address: "address", proj_scale: "scale", proj_invest: "invest" };
        var fk = Object.keys(fields);
        for (var fi = 0; fi < fk.length; fi++) {
          var inp = document.querySelector('[data-pm="' + fk[fi] + '"]');
          if (inp) pd[fields[fk[fi]]] = inp.value;
        }
        _pmEntState.projectData = pd;
      }
      if (!_pmEntState.matchedEnt) { toast("请先选择一个企业", "warn"); return; }
      _pmEntState.step = "result";
      render(); return;
    }
    if (act === "pm_back_form") {
      _pmEntState.showSuggestions = false;
      _pmEntState.step = "form";
      render(); return;
    }
    if (act === "pm_manual_service") {
      toast("已提交人工服务请求，工作人员将在1个工作日内与您联系", "info");
      return;
    }
    if (act === "pm_manual_verify") {
      toast("已提交人工核实请求，工作人员将对匹配结果进行核实确认", "info");
      return;
    }
    if (act === "pm_show_policy") {
      var pId = el.getAttribute("data-id") || "";
      var pol = (seed.policies || []).filter(function (p) { return p.id === pId; })[0];
      if (pol) toast(pol.name + "：" + pol.summary, "info");
      return;
    }
    if (act === "pm_gov_select_policy") {
      var sel = el.value || "";
      _pmGovState.policyId = sel;
      _pmGovState.selectedEnterpriseIds = [];
      _pmGovState.page = 1;
      location.hash = "#/gov/policy-gov?pid=" + encodeURIComponent(sel);
      return;
    }
    if (act === "pm_gov_push") {
      var selectedIds = (_pmGovState.selectedEnterpriseIds || []).slice();
      var selectedEnts = selectedIds.map(function (id) { return entById(id); }).filter(Boolean);
      if (!selectedEnts.length) {
        toast("请先勾选需要推送的企业", "warn");
        return;
      }
      var targetText = selectedEnts.length <= 3
        ? selectedEnts.map(function (ent) { return ent.name; }).join("、")
        : selectedEnts.slice(0, 3).map(function (ent) { return ent.name; }).join("、") + "等" + selectedEnts.length + "家企业";
      toast("已向" + targetText + "推送该政策", "success");
      return;
    }
    if (act === "pm_copy_text") {
      var copyValue = el.getAttribute("data-value") || "";
      var copyLabel = el.getAttribute("data-label") || "内容";
      copyText(copyValue).then(function (ok) {
        toast(ok ? (copyLabel + "已复制") : ("复制" + copyLabel + "失败"), ok ? "success" : "warn");
      });
      return;
    }
    if (act === "pm_gov_page") {
      var nextPage = Math.max(1, Number(el.getAttribute("data-page") || 1) || 1);
      _pmGovState.page = nextPage;
      render();
      return;
    }
    if (act === "pm_gov_clear_selection") {
      _pmGovState.selectedEnterpriseIds = [];
      render();
      return;
    }
    if (act === "pm_gov_apply") { toast("已为符合条件的企业一键申报", "success"); return; }
    if (act === "pm_gov_toggle_ent") {
      var selectedId = el.getAttribute("data-id") || "";
      var nextSelected = (_pmGovState.selectedEnterpriseIds || []).slice();
      if (el.checked) {
        if (nextSelected.indexOf(selectedId) < 0) nextSelected.push(selectedId);
      } else {
        nextSelected = nextSelected.filter(function (id) { return id !== selectedId; });
      }
      _pmGovState.selectedEnterpriseIds = nextSelected;
      render();
      return;
    }
    if (act === "pm_gov_toggle_all") {
      var allRowIds = Array.prototype.slice.call(document.querySelectorAll('input[data-action="pm_gov_toggle_ent"]'))
        .map(function (input) { return input.getAttribute("data-id") || ""; })
        .filter(Boolean);
      var keptSelected = (_pmGovState.selectedEnterpriseIds || []).filter(function (id) {
        return allRowIds.indexOf(id) < 0;
      });
      _pmGovState.selectedEnterpriseIds = el.checked ? keptSelected.concat(allRowIds) : keptSelected;
      render();
      return;
    }
    if (act === "pm_gov_push_one") {
      var pushEnt = entById(el.getAttribute("data-id") || "");
      toast("已推送至" + (pushEnt ? pushEnt.name : "企业"), "success"); return;
    }
    if (act === "pm_gov_apply_one") {
      var applyEnt = entById(el.getAttribute("data-id") || "");
      toast("已为" + (applyEnt ? applyEnt.name : "企业") + "发起申报", "success"); return;
    }
    /* ── End Policy Match handlers ── */

    if (act === "geo_nav_analysis") {
      var rtGa = route();
      var srcPath = rtGa.path.indexOf("/gov/geo-") === 0 ? rtGa.path : "/gov/geo-street";
      var ctxGa = geoContext({ q: rtGa.q || {} }, srcPath);
      location.hash = geoAnalysisHash(ctxGa);
      return;
    }
    if (act === "chain_pick_industry") {
      var ind = el.getAttribute("data-id") || "航空航天";
      return updateGeoHash({ industry: ind, tab: "intro", term: "" }, "/gov/chain");
    }
    if (act === "chain_open_node_detail") {
      var nodeId = el.getAttribute("data-id") || "";
      if (!nodeId) return;
      var nodeMeta = _chainNodeRegistry && _chainNodeRegistry.nodes ? _chainNodeRegistry.nodes[nodeId] : null;
      modalOpen((nodeMeta ? nodeMeta.label + " · " : "") + "节点详细介绍", chainNodeDetailHtml(nodeId));
      return;
    }
    if (act === "chain_node_click") {
      var nodeId = el.getAttribute("data-id") || "";
      var label = el.getAttribute("data-label") || "";
      var popup = document.getElementById("chain-node-popup");
      if (!popup) return;
      // close if clicking the same node again
      if (!popup.classList.contains("hidden") && popup.getAttribute("data-current") === (nodeId || label)) {
        popup.classList.add("hidden");
        if (popup.parentElement) popup.parentElement.classList.remove("popup-open");
        return;
      }
      var allMatched = chainResolveMatchedEnterprises(nodeId, label);
      var previewCap = 5;
      var scored = allMatched.slice(0, previewCap);
      var weakInfo = (_chainNodeRegistry && _chainNodeRegistry.context && _chainNodeRegistry.context.highlightMap)
        ? _chainNodeRegistry.context.highlightMap[nodeId]
        : null;
      // position popup near the clicked node
      var stageEl = el.closest(".chain-map-stage");
      var stageRect = stageEl ? stageEl.getBoundingClientRect() : { left: 0, top: 0 };
      var elRect = el.getBoundingClientRect();
      var popLeft = elRect.left - stageRect.left + elRect.width / 2;
      var popTop = elRect.top - stageRect.top + elRect.height + 4;
      // build popup html
      var popHtml = '<div class="chain-popup-head"><div class="chain-popup-head-main"><span class="chain-popup-head-title">' +
        esc(label) +
        '</span><span class="chain-popup-head-count">共匹配 ' +
        esc(String(allMatched.length)) +
        ' 家</span>' +
        (weakInfo ? '<span class="chain-summary-badge level-' + esc(weakInfo.level) + '">' + esc(weakInfo.levelLabel) + '</span>' : "") +
        '</div><button class="chain-popup-close" data-action="chain_popup_close">×</button></div>';
      if (scored.length === 0) {
        popHtml += '<div class="chain-popup-empty">暂无匹配企业</div>';
      } else {
        popHtml += '<div class="chain-popup-list">' + scored.map(function (x) {
          var e = x.e;
          var entTags = (e.tags || []).slice(0, 3).map(function (t) { return '<span class="chain-popup-tag">' + esc(t) + '</span>'; }).join("");
          var reasonChips = chainMatchReasonSummary(x, 2).map(function (reason) {
            return '<span class="chain-popup-reason">' + esc(reason) + '</span>';
          }).join("");
          return '<a class="chain-popup-ent" href="' + esc(buildHash("/gov/portrait/" + e.id, {
            src: "chain",
            district: (route().q && route().q.district) || govDemoDistrictName(),
            industry: (route().q && route().q.industry) || "",
            tab: (route().q && route().q.tab) || "intro",
            term: (route().q && route().q.term) || "",
            z: (route().q && route().q.z) || "",
            chain_label: label,
            chain_nid: nodeId || ""
          })) + '">' +
            '<div class="chain-popup-ent-name">' + esc(e.name) + '</div>' +
            '<div class="chain-popup-ent-meta"><span>' + esc(e.industry) + ' · ' + esc(e.level || '') + '</span><span class="chain-popup-score">匹配度 ' + esc(String(x.sc || 0)) + '</span>' + entTags + '</div>' +
            (reasonChips ? '<div class="chain-popup-reasons">' + reasonChips + '</div>' : '') +
            '</a>';
        }).join("") + '</div>';
        if (allMatched.length > previewCap) {
          popHtml += '<div class="chain-popup-foot"><a class="chain-popup-more" href="' +
            esc(buildHash("/gov/portrait", {
              filter: "chain",
              fv: label,
              nid: nodeId || "",
              src: "chain",
              district: (route().q && route().q.district) || govDemoDistrictName(),
              industry: (route().q && route().q.industry) || "",
              tab: (route().q && route().q.tab) || "intro",
              term: (route().q && route().q.term) || "",
              z: (route().q && route().q.z) || ""
            })) +
            '">更多企业（共' +
            esc(String(allMatched.length)) +
            '家）</a></div>';
        }
      }
      popup.innerHTML = popHtml;
      popup.classList.remove("hidden");
      var stageWidth = stageEl ? stageEl.clientWidth : 0;
      var stageHeight = stageEl ? stageEl.clientHeight : 0;
      var popupWidth = popup.offsetWidth || 280;
      var popupHeight = popup.offsetHeight || 180;
      var leftBound = 12;
      var topBound = 12;
      var maxLeft = stageWidth ? Math.max(leftBound, stageWidth - popupWidth - 12) : popLeft;
      var desiredLeft = popLeft - popupWidth / 2;
      var clampedLeft = stageWidth ? clamp(desiredLeft, leftBound, maxLeft) : desiredLeft;
      var aboveTop = elRect.top - stageRect.top - popupHeight - 10;
      var belowTop = popTop;
      var desiredTop = aboveTop >= topBound ? aboveTop : belowTop;
      if (stageHeight) {
        desiredTop = clamp(desiredTop, topBound, Math.max(topBound, stageHeight - popupHeight - 12));
      }
      popup.style.left = clampedLeft + "px";
      popup.style.top = desiredTop + "px";
      popup.setAttribute("data-current", nodeId || label);
      if (popup.parentElement) popup.parentElement.classList.add("popup-open");
      return;
    }
    if (act === "chain_popup_close") {
      var pp = document.getElementById("chain-node-popup");
      if (pp) {
        pp.classList.add("hidden");
        if (pp.parentElement) pp.parentElement.classList.remove("popup-open");
      }
      return;
    }
    if (act === "chain_pick_tab") {
      var newTab = el.getAttribute("data-id") || "intro";
      // DOM-only update: swap active tab + panel content, no full re-render
      var tabBtns = document.querySelectorAll(".chain-tab");
      for (var ti = 0; ti < tabBtns.length; ti++) {
        tabBtns[ti].classList.toggle("active", tabBtns[ti].getAttribute("data-id") === newTab);
      }
      var rtTab = route();
      var indKey = (rtTab.q && rtTab.q.industry) || "航空航天";
      var prof = _chainProfiles && _chainProfiles[indKey];
      var panelEl = document.querySelector(".chain-panel");
      if (panelEl && prof) panelEl.innerHTML = _chainPanelHtml(prof, newTab);
      // silently update hash so refresh preserves tab state
      var nextQ = {};
      Object.keys(rtTab.q || {}).forEach(function (k) { nextQ[k] = rtTab.q[k]; });
      nextQ.tab = newTab;
      history.replaceState(null, "", buildHash("/gov/chain", nextQ));
      return;
    }
    if (act === "chain_zoom_in" || act === "chain_zoom_out" || act === "chain_zoom_reset") {
      var rtZ = route();
      var curZ = Number((rtZ.q && rtZ.q.z) || 1);
      var newZ = act === "chain_zoom_reset" ? 1 : clamp(curZ + (act === "chain_zoom_in" ? 0.08 : -0.08), 0.75, 1.55);
      var canvas = document.querySelector(".chain-graph-canvas");
      if (canvas) canvas.style.transform = "scale(" + fixed(newZ, 2) + ")";
      var nextQz = {};
      Object.keys(rtZ.q || {}).forEach(function (k) { nextQz[k] = rtZ.q[k]; });
      nextQz.z = fixed(newZ, 2);
      history.replaceState(null, "", buildHash("/gov/chain", nextQz));
      return;
    }
    if (act === "chain_apply_search") {
      var searchInput = document.querySelector('[data-role="chain-search"]');
      var term = searchInput ? String(searchInput.value || "").trim() : "";
      return updateGeoHash({ term: term }, "/gov/chain");
    }
    if (act === "chain_ai_analyze") return toast("已生成产业链分析摘要（演示）", "success");
    if (act === "chain_back_geo") {
      location.hash = "#/gov/home";
      return;
    }
    if (act === "chain_export") {
      var rtCE = route();
      var tabs = {
        intro: "产业简介",
        sectors: "细分领域",
        funding: "投融资企业"
      };
      var industryE = (rtCE.q && rtCE.q.industry) || "航空航天";
      var tabE = (rtCE.q && rtCE.q.tab) || "intro";
      var termE = ((rtCE.q && rtCE.q.term) || "").trim();
      var md =
        "# 主导产业链式图谱分析导出\n\n" +
        "- 行业：" +
        industryE +
        "\n" +
        "- 页签：" +
        (tabs[tabE] || tabE) +
        "\n" +
        "- 搜索关键词：" +
        (termE || "（无）") +
        "\n" +
        "- 导出日期：" +
        today() +
        "\n\n" +
        "注：该文档由 Demo 原型导出，仅用于演示。";
      return downloadText("产业链式图谱_" + industryE + "_" + today() + ".md", md);
    }
    if (act === "geo_carrier_all") return updateGeoHash({ carrier: "building,factory" });
    if (act === "geo_carrier_none") return updateGeoHash({ carrier: "none" });
    if (act === "geo_carrier_invert") {
      var checkedCarrierVals = Array.prototype.slice
        .call(document.querySelectorAll('[data-role="geo-carrier"]:checked'))
        .map(function (x) {
          return x.value;
        });
      var nextCarrier = [];
      if (checkedCarrierVals.indexOf("building") < 0) nextCarrier.push("building");
      if (checkedCarrierVals.indexOf("factory") < 0) nextCarrier.push("factory");
      return updateGeoHash({ carrier: nextCarrier.length ? nextCarrier.join(",") : "none" });
    }
    if (act === "geo_industry_all") {
      var allInds = (seed.industries || []).map(function (it) {
        return it.name;
      });
      return updateGeoHash({ inds: allInds.join(",") });
    }
    if (act === "geo_industry_none") return updateGeoHash({ inds: "none" });
    if (act === "geo_industry_invert") {
      var allInds2 = (seed.industries || []).map(function (it) {
        return it.name;
      });
      var checkedInds = Array.prototype.slice
        .call(document.querySelectorAll('[data-role="geo-industry"]:checked'))
        .map(function (it) {
          return it.value;
        });
      var inv = allInds2.filter(function (name) {
        return checkedInds.indexOf(name) < 0;
      });
      return updateGeoHash({ inds: inv.length ? inv.join(",") : "none" });
    }
    if (act === "geo_zoom_in") return geoZoomBy(0.14);
    if (act === "geo_zoom_out") return geoZoomBy(-0.14);
    if (act === "geo_zoom_reset") return geoResetView();
    if (act === "geo_fullscreen") {
      var fsStage = document.querySelector('[data-role="geo-stage"]');
      if (!fsStage) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        fsStage.requestFullscreen().catch(function () {});
      }
      return;
    }
    if (act === "geo_toggle_bottom") return updateGeoHash({ bottom: route().q && route().q.bottom === "1" ? "0" : "1" });
    if (act === "geo_open_enterprise") {
      var eid0 = el.getAttribute("data-id");
      modalClose();
      location.hash = "#/gov/enterprise/" + encodeURIComponent(eid0 || "");
      return;
    }
    if (act === "geo_open_building") return openGeoBuilding(el.getAttribute("data-id"));
    if (act === "geo_drill_district") {
      var did0 = el.getAttribute("data-id");
      var rtD = route();
      var nextScope = rtD.q && rtD.q.scope === "park" ? "park" : "street";
      var nextPath = nextScope === "park" ? "/gov/geo-park" : "/gov/geo-street";
      return updateGeoHash({ did: did0, sid: "", pid: "", scope: nextScope }, nextPath, { skipGeoFly: true });
    }
    if (act === "geo_drill_street") {
      var sid0 = el.getAttribute("data-id");
      return updateGeoHash({ sid: sid0, pid: "", scope: "street" }, "/gov/geo-street", { skipGeoFly: true });
    }
    if (act === "geo_focus_park") {
      var pidF = el.getAttribute("data-id");
      var pF = geoParkById(pidF) || {};
      // Capture click position for popup placement
      var _parkClickRect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      _geoParkPopupAnchor = _parkClickRect ? { x: _parkClickRect.left + _parkClickRect.width / 2, y: _parkClickRect.top } : null;
      return updateGeoHash({ scope: "park", park_mode: "focus", pid: pidF, sid: pF.street_id || "" }, "/gov/geo-park", { skipGeoFly: true });
    }
    if (act === "geo_drill_park") {
      var pid0 = el.getAttribute("data-id");
      var p0 = geoParkById(pid0) || {};
      return updateGeoHash({ park_mode: "focus", pid: pid0, sid: p0.street_id || "", scope: "park" }, "/gov/geo-park", { skipGeoFly: true });
    }
    if (act === "geo_park_popup_close") {
      geoParkDrawerPopupHide();
      return;
    }
    if (act === "geo_storyline_park") {
      var pidS = el.getAttribute("data-id");
      var st = geoStorylineByPark(pidS);
      if (!st || !st.building) return toast("该园区暂无需求楼宇数据", "warn");
      return updateGeoHash(
        {
          scope: "park",
          pid: pidS,
          sid: (st.park && st.park.street_id) || "",
          auto_building: st.building.id,
          auto_enterprise: (st.enterprise && st.enterprise.id) || "",
          story: "1",
        },
        "/gov/geo-park",
        { resetGeoView: true }
      );
    }
    if (act === "geo_compare_lock_a") {
      var pidA = el.getAttribute("data-id") || "";
      geoCompareSlots.a = pidA;
      var parkA = geoParkById(pidA);
      toast("已锁定对比A：" + (parkA ? parkA.name : pidA), "success");
      return render();
    }
    if (act === "geo_compare_lock_b") {
      var pidB = el.getAttribute("data-id") || "";
      geoCompareSlots.b = pidB;
      var parkB = geoParkById(pidB);
      toast("已锁定对比B：" + (parkB ? parkB.name : pidB), "success");
      return render();
    }
    if (act === "geo_compare_clear") {
      geoCompareSlots.a = "";
      geoCompareSlots.b = "";
      toast("已清空园区对比", "info");
      return render();
    }

    if (act === "open_res") return openRes(el.getAttribute("data-id"));
    if (act === "match_demand" || act === "view_demand") return openDemand(el.getAttribute("data-id"));

    if (act === "new_demand") return openNewDemand();
    if (act === "create_demand") {
      var cat = (document.getElementById("d-cat") || {}).value || "配套服务";
      var title = (document.getElementById("d-title") || {}).value || "";
      var detail = (document.getElementById("d-detail") || {}).value || "";
      var amt = parseFloat((document.getElementById("d-amt") || {}).value || "0");
      if (!title.trim()) return toast("请填写标题", "warn");

      setState(function (st) {
        st.demands.push({
          id: uid("d"),
          enterprise_id: st.active.enterprise_id,
          category: cat,
          title: title.trim(),
          detail: detail.trim(),
          amount_w: cat.indexOf("融资") >= 0 ? (isFinite(amt) ? Math.round(amt) : 0) : undefined,
          created_at: today(),
          status: cat.indexOf("融资") >= 0 ? "待对接" : "待对接",
        });
      });
      modalClose();
      return toast("已提交企业", "success");
    }

    if (act === "toggle_consent") {
      var bankId = el.getAttribute("data-bank");
      var on = el.getAttribute("data-on") === "1";
      var ent = entById(state.active.enterprise_id);
      setConsent(ent.id, bankId, "融资对接", !on);
      return toast(!on ? "已授权" : "已取消授权", "success");
    }

    if (act === "assign_alert") {
      var aid = el.getAttribute("data-id");
      var a = (seed.alerts || []).find(function (x) { return x.id === aid; });
      var e = a ? entById(a.enterprise_id) : null;
      return openAssign("alert", aid, "预警处置：" + (e ? e.name : aid));
    }

    if (act === "close_alert") {
      var aid2 = el.getAttribute("data-id");
      setState(function (st) {
        var w = (st.work_orders || []).find(function (x) { return x.type === "alert" && x.ref_id === aid2; });
        if (!w) {
          st.work_orders.push({ id: uid("w"), type: "alert", ref_id: aid2, title: "预警处置", status: "已保存跟进", assignee: "", created_at: today(), updated_at: today(), notes: ["标记为已保存跟进（演示）。"] });
        } else {
          w.status = "已保存跟进";
          w.updated_at = today();
          w.notes = w.notes || [];
          w.notes.push("标记为已保存跟进（演示）。");
        }
      });
      return toast("已保存跟进");
    }

    if (act === "edit_wo") {
      var id = el.getAttribute("data-id");
      var w2 = (state.work_orders || []).find(function (x) { return x.id === id; });
      if (w2) return openAssign(w2.type, w2.ref_id, w2.title);
      return;
    }

    if (act === "create_visit") {
      var eid = el.getAttribute("data-id");
      var ee = entById(eid);
      return openAssign("visit", eid, "走访：" + (ee ? ee.name : eid));
    }

    if (act === "make_wo") {
      var did = el.getAttribute("data-id");
      var d = (state.demands || []).find(function (x) { return x.id === did; });
      return openAssign("demand", did, "企业对接：" + (d ? d.title : did));
    }

    if (act === "save_wo") {
      var type = el.getAttribute("data-type");
      var ref = el.getAttribute("data-ref");
      var title2 = (document.getElementById("wo-title") || {}).value || "";
      var assignee = (document.getElementById("wo-assignee") || {}).value || "";
      var status = (document.getElementById("wo-status") || {}).value || "处理中";
      var note = (document.getElementById("wo-note") || {}).value || "";

      setState(function (st) {
        st.work_orders = st.work_orders || [];
        var w = st.work_orders.find(function (x) { return x.type === type && x.ref_id === ref; });
        if (!w) {
          w = { id: uid("w"), type: type, ref_id: ref, title: title2, status: status, assignee: assignee, created_at: today(), updated_at: today(), notes: [] };
          st.work_orders.push(w);
        } else {
          w.title = title2;
          w.status = status;
          w.assignee = assignee;
          w.updated_at = today();
        }
        if (note.trim()) {
          w.notes = w.notes || [];
          w.notes.push(note.trim());
        }
      });
      modalClose();
      toast("已切换机构");
      return;
    }

    if (act === "gen_monthly") {
      var txt = genMonthly();
      modalOpen(
        "预警专报预览（Markdown）",
        '<div><textarea style="width:100%;min-height:360px;border-radius:8px;border:1px solid var(--stroke);padding:12px 14px;font-family:var(--font-mono);font-size:12px;line-height:1.5;">' +
          esc(txt) +
          "</textarea>" +
          '<div class="row-actions"><button class="btn" data-action="modal_close">关闭</button><button class="btn primary" data-action="dl_monthly">下载</button></div></div>'
      );
      return;
    }

    if (act === "gen_risk") {
      var txt2 = genRiskReport();
      modalOpen(
        "预警专报预览（Markdown）",
        '<div><textarea style="width:100%;min-height:360px;border-radius:8px;border:1px solid var(--stroke);padding:12px 14px;font-family:var(--font-mono);font-size:12px;line-height:1.5;">' +
          esc(txt2) +
          "</textarea>" +
          '<div class="row-actions"><button class="btn" data-action="modal_close">关闭</button><button class="btn primary" data-action="dl_risk">下载</button></div></div>'
      );
      return;
    }

    if (act === "dl_monthly") return downloadText("月度简报_演示.md", genMonthly());
    if (act === "dl_risk") return downloadText("预警专报_演示.md", genRiskReport());

    /* zdx key-projects actions */
    if (act === "zdx_project_detail") return zdxOpenProjectDetail(parseInt(el.getAttribute("data-zdx-idx"), 10));
    if (act === "zdx_open_filter") return zdxOpenFilterModal();
    if (act === "zdx_close_filter") return zdxCloseFilterModal();
    if (act === "zdx_apply_filter") return zdxApplyFilter();
    if (act === "zdx_reset_filter") return zdxResetFilter();
    if (act === "zdx_close_project_modal") return zdxCloseProjectDetail();

    /* zdx filter option toggle */
    var zdxFilterOpt = el.closest ? el.closest(".zdx-filter-option") : null;
    if (zdxFilterOpt) {
      var siblings = zdxFilterOpt.parentElement.querySelectorAll(".zdx-filter-option");
      for (var _fi = 0; _fi < siblings.length; _fi++) siblings[_fi].classList.remove("active");
      zdxFilterOpt.classList.add("active");
      return;
    }
    /* zdx overlay click to close */
    if (el.classList && el.classList.contains("zdx-filter-modal-overlay")) return zdxCloseFilterModal();
    if (el.classList && el.classList.contains("zdx-project-modal-overlay")) return zdxCloseProjectDetail();

    if (act === "kp_export_overview") {
      var rtKpExport = route();
      if (rtKpExport.path !== "/gov/key-projects") return;
      var exportItems = keyProjectFiltered(rtKpExport);
      var exportSummary = keyProjectSummary(exportItems);
      var exportText = [
        "# 重点项目调度专题导出",
        "",
        "- 导出日期：" + today(),
        "- 当前项目数：" + exportSummary.count,
        "- 总投资额：" + fixed(exportSummary.totalInvest, 1) + " 亿元",
        "- 固投总额：" + fixed(exportSummary.fixedInvest, 1) + " 亿元",
        "- 预警项目：" + exportSummary.warnings + " 个",
        "",
        "## 项目清单",
        ""
      ].concat(exportItems.slice(0, 20).map(function (item, idx) {
        return (idx + 1) + ". " + item.name + " | " + (item.dual_owner || item.department || "--") + " | " + fixed(item.total_invest, 1) + "亿元 | " + item.status + " | " + item.stage;
      })).join("\n");
      return downloadText("重点项目调度导出_" + today() + ".md", exportText);
    }

    if (act === "bank_followup") return openBankFollowup(el.getAttribute("data-id"));
    if (act === "save_followup") {
      var did2 = el.getAttribute("data-id");
      var stage = (document.getElementById("bf-stage") || {}).value || "已触达";
      var date = (document.getElementById("bf-date") || {}).value || today();
      var note2 = (document.getElementById("bf-note") || {}).value || "";
      setState(function (st) {
        var d2 = (st.demands || []).find(function (x) { return x.id === did2; });
        if (!d2) return;
        st.bank_followups.push({
          id: uid("f"),
          bank_id: st.active.bank_id,
          enterprise_id: d2.enterprise_id,
          demand_id: did2,
          stage: stage,
          created_at: date,
          notes: note2.trim() ? [note2.trim()] : [],
        });
        if (stage === "已转化") d2.status = "已完成";
      });
      modalClose();
      return toast("已保存跟进");
    }

    if (act === "mark_converted") {
      var did3 = el.getAttribute("data-id");
      setState(function (st) {
        var d3 = (st.demands || []).find(function (x) { return x.id === did3; });
        if (d3) d3.status = "已完成";
      });
      return toast("已标记转化");
    }
  });

  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (!t) return;
    var kpFilter = t.getAttribute("data-kp-filter");
    if (kpFilter) {
      var rtProject = route();
      if (rtProject.path !== "/gov/key-projects" && rtProject.path !== "/gov/key-projects/list") return;
      var nextProjectQ = Object.assign({}, rtProject.q || {});
      if (kpFilter === "status") nextProjectQ.kps = t.value || "";
      if (kpFilter === "dept") nextProjectQ.kpd = t.value || "";
      if (kpFilter === "street") nextProjectQ.kpst = t.value || "";
      delete nextProjectQ.kpid;
      Object.keys(nextProjectQ).forEach(function (key) {
        if (nextProjectQ[key] == null || nextProjectQ[key] === "") delete nextProjectQ[key];
      });
      location.hash = buildHash(rtProject.path, nextProjectQ);
      return;
    }
    var decisionFilter = t.getAttribute("data-decision-filter");
    if (decisionFilter) {
      var rtDecision = route();
      if (rtDecision.path !== "/gov/decision-data") return;
      var nextDecisionQ = Object.assign({}, rtDecision.q || {});
      if (decisionFilter === "speech-period") nextDecisionQ.dsp = t.value || "";
      if (decisionFilter === "meeting-period") nextDecisionQ.dmp = t.value || "";
      Object.keys(nextDecisionQ).forEach(function (key) {
        if (nextDecisionQ[key] == null || nextDecisionQ[key] === "") delete nextDecisionQ[key];
      });
      location.hash = buildHash("/gov/decision-data", nextDecisionQ);
    }
  });

  document.addEventListener("submit", function (ev) {
    var exitForm = ev.target.closest("[data-exit-filter]");
    if (exitForm) {
      ev.preventDefault();
      var nextExitQ = {
        xid: ((exitForm.querySelector('[name="xid"]') || {}).value || "").trim(),
        xlevel: ((exitForm.querySelector('[name="level"]') || {}).value || "").trim(),
        xstreet: ((exitForm.querySelector('[name="street"]') || {}).value || "").trim(),
        xindustry: ((exitForm.querySelector('[name="industry"]') || {}).value || "").trim(),
        xtype: ((exitForm.querySelector('[name="xtype"]') || {}).value || "").trim(),
        xq: ((exitForm.querySelector('[name="term"]') || {}).value || "").trim()
      };
      Object.keys(nextExitQ).forEach(function (key) {
        if (!nextExitQ[key]) delete nextExitQ[key];
      });
      location.hash = buildHash("/gov/enterprise-exit", nextExitQ);
      return;
    }

    var targetCompareForm = ev.target.closest("[data-target-compare]");
    if (targetCompareForm) {
      ev.preventDefault();
      var rtTargetCompare = route();
      if (rtTargetCompare.path !== "/gov/economic-targets") return;
      var nextTargetQ = Object.assign({}, rtTargetCompare.q || {});
      nextTargetQ.tm = ((targetCompareForm.querySelector('[name="metric"]') || {}).value || "gdp_billion").trim();
      nextTargetQ.tq = ((targetCompareForm.querySelector('[name="term"]') || {}).value || "").trim();
      if (!nextTargetQ.tv) nextTargetQ.tv = "area";
      delete nextTargetQ.ts;
      delete nextTargetQ.tp;
      Object.keys(nextTargetQ).forEach(function (key) {
        if (nextTargetQ[key] == null || nextTargetQ[key] === "") delete nextTargetQ[key];
      });
      location.hash = buildHash("/gov/economic-targets", nextTargetQ);
      return;
    }

    var targetSubjectForm = ev.target.closest("[data-target-subject]");
    if (targetSubjectForm) {
      ev.preventDefault();
      var rtTargetSubject = route();
      if (rtTargetSubject.path !== "/gov/economic-targets") return;
      var nextTargetSubjectQ = Object.assign({}, rtTargetSubject.q || {});
      nextTargetSubjectQ.ts = ((targetSubjectForm.querySelector('[name="subject"]') || {}).value || "").trim();
      Object.keys(nextTargetSubjectQ).forEach(function (key) {
        if (nextTargetSubjectQ[key] == null || nextTargetSubjectQ[key] === "") delete nextTargetSubjectQ[key];
      });
      location.hash = buildHash("/gov/economic-targets", nextTargetSubjectQ);
      return;
    }

    var govStatsForm = ev.target.closest("[data-govstats-filter]");
    if (govStatsForm) {
      ev.preventDefault();
      var rtGovStats = route();
      if (rtGovStats.path !== "/gov/government-stats") return;
      var nextGovStatsQ = Object.assign({}, rtGovStats.q || {});
      nextGovStatsQ.stab = nextGovStatsQ.stab || "manage";
      nextGovStatsQ.sg = ((govStatsForm.querySelector('[name="group"]') || {}).value || "macro").trim();
      nextGovStatsQ.sm = ((govStatsForm.querySelector('[name="metric"]') || {}).value || "gdp_billion").trim();
      nextGovStatsQ.sq = ((govStatsForm.querySelector('[name="term"]') || {}).value || "").trim();
      nextGovStatsQ.schart = ((govStatsForm.querySelector('[name="chart"]') || {}).value || "trend").trim();
      Object.keys(nextGovStatsQ).forEach(function (key) {
        if (nextGovStatsQ[key] == null || nextGovStatsQ[key] === "") delete nextGovStatsQ[key];
      });
      location.hash = buildHash("/gov/government-stats", nextGovStatsQ);
      return;
    }
  });

  document.addEventListener("submit", function (ev) {
    var form = ev.target.closest("[data-kp-search]");
    if (!form) return;
    ev.preventDefault();
    var rtProject = route();
    if (rtProject.path !== "/gov/key-projects" && rtProject.path !== "/gov/key-projects/list") return;
    var nextProjectQ = Object.assign({}, rtProject.q || {});
    nextProjectQ.kpq = ((form.querySelector("input") || {}).value || "").trim();
    delete nextProjectQ.kpid;
    Object.keys(nextProjectQ).forEach(function (key) {
      if (nextProjectQ[key] == null || nextProjectQ[key] === "") delete nextProjectQ[key];
    });
    location.hash = buildHash(rtProject.path, nextProjectQ);
  });

  document.addEventListener("submit", function (ev) {
    var decisionRangeForm = ev.target.closest("[data-decision-range]");
    if (decisionRangeForm) {
      ev.preventDefault();
      var rtDecisionRange = route();
      if (rtDecisionRange.path !== "/gov/decision-data") return;
      var kindRange = decisionRangeForm.getAttribute("data-decision-range");
      var nextDecisionRangeQ = Object.assign({}, rtDecisionRange.q || {});
      var startInput = (decisionRangeForm.querySelector('[name="start"]') || {}).value || "";
      var endInput = (decisionRangeForm.querySelector('[name="end"]') || {}).value || "";
      var startValue = String(startInput || "").trim();
      var endValue = String(endInput || "").trim();
      if (startValue && endValue && startValue > endValue) {
        var swap = startValue;
        startValue = endValue;
        endValue = swap;
      }
      if (kindRange === "speech") {
        nextDecisionRangeQ.dss = startValue || "";
        nextDecisionRangeQ.dse = endValue || "";
        nextDecisionRangeQ.ddv = "speech";
        nextDecisionRangeQ.dspg = "";
        delete nextDecisionRangeQ.dsp;
      } else if (kindRange === "meeting") {
        nextDecisionRangeQ.dms = startValue || "";
        nextDecisionRangeQ.dme = endValue || "";
        nextDecisionRangeQ.ddv = "meeting";
        nextDecisionRangeQ.dmpg = "";
        delete nextDecisionRangeQ.dmp;
      } else {
        return;
      }
      Object.keys(nextDecisionRangeQ).forEach(function (key) {
        if (nextDecisionRangeQ[key] == null || nextDecisionRangeQ[key] === "") delete nextDecisionRangeQ[key];
      });
      location.hash = buildHash("/gov/decision-data", nextDecisionRangeQ);
      return;
    }

    var form = ev.target.closest("[data-decision-search]");
    if (!form) return;
    ev.preventDefault();
    var rtDecision = route();
    if (rtDecision.path !== "/gov/decision-data") return;
    var kind = form.getAttribute("data-decision-search");
    var nextDecisionQ = Object.assign({}, rtDecision.q || {});
    if (kind === "speech") {
      nextDecisionQ.dsq = ((form.querySelector("input") || {}).value || "").trim();
      nextDecisionQ.ddv = "speech";
      nextDecisionQ.dspg = "";
    }
    if (kind === "meeting") {
      nextDecisionQ.dmq = ((form.querySelector("input") || {}).value || "").trim();
      nextDecisionQ.ddv = "meeting";
      nextDecisionQ.dmpg = "";
    }
    Object.keys(nextDecisionQ).forEach(function (key) {
      if (nextDecisionQ[key] == null || nextDecisionQ[key] === "") delete nextDecisionQ[key];
    });
    location.hash = buildHash("/gov/decision-data", nextDecisionQ);
  });

  document.addEventListener("change", function (ev) {
    var el = ev.target.closest("[data-portrait-filter]");
    if (!el) return;
    var rtPortrait = route();
    if (rtPortrait.path !== "/gov/portrait") return;
    var qPortrait = rtPortrait.q || {};
    var formRoot = document.querySelector(".portrait-page") || document;
    var nextQ = {
      q: ((formRoot.querySelector(".portrait-search-input") || {}).value || qPortrait.q || "").trim(),
      page: "",
      industry_cat: ((formRoot.querySelector('[data-portrait-filter="industry_cat"]') || {}).value || ""),
      industry: ((formRoot.querySelector('[data-portrait-filter="industry"]') || {}).value || ""),
      policy_id: ((formRoot.querySelector('[data-portrait-filter="policy_id"]') || {}).value || ""),
      carrier_district: ((formRoot.querySelector('[data-portrait-filter="carrier_district"]') || {}).value || ""),
      carrier_street: ((formRoot.querySelector('[data-portrait-filter="carrier_street"]') || {}).value || ""),
      carrier_park: ((formRoot.querySelector('[data-portrait-filter="carrier_park"]') || {}).value || ""),
      carrier_building: ((formRoot.querySelector('[data-portrait-filter="carrier_building"]') || {}).value || ""),
      chain_label: qPortrait.chain_label || ((qPortrait.filter === "chain") ? (qPortrait.fv || "") : ""),
      nid: qPortrait.chain_nid || qPortrait.nid || ""
    };
    var kind = el.getAttribute("data-portrait-filter") || "";
    var value = el.value || "";
    if (kind === "industry_cat") {
      nextQ.industry_cat = value;
      nextQ.industry = "";
    } else if (kind === "industry") {
      nextQ.industry = value;
    } else if (kind === "policy_id") {
      nextQ.policy_id = value;
    } else if (kind === "carrier_district") {
      nextQ.carrier_district = value;
      nextQ.carrier_street = "";
      nextQ.carrier_park = "";
      nextQ.carrier_building = "";
      nextQ.industry_cat = "";
      nextQ.industry = "";
    } else if (kind === "carrier_street") {
      nextQ.carrier_street = value;
      nextQ.carrier_park = "";
      nextQ.carrier_building = "";
    } else if (kind === "carrier_park") {
      nextQ.carrier_park = value;
      nextQ.carrier_building = "";
    } else if (kind === "carrier_building") {
      nextQ.carrier_building = value;
    } else {
      return;
    }
    Object.keys(nextQ).forEach(function (key) {
      if (nextQ[key] == null || nextQ[key] === "") delete nextQ[key];
    });
    location.hash = buildHash("/gov/portrait", nextQ);
  });

  document.addEventListener("click", function (ev) {
    var rtPm = route();
    if (!rtPm || rtPm.path !== "/gov/policy-enterprise") return;
    if (!_pmEntState.showSuggestions) return;
    if (ev.target && ev.target.closest && ev.target.closest(".pm-field.pm-field-wide")) return;
    _pmEntState.showSuggestions = false;
    render();
  });

  document.addEventListener("submit", function (ev) {
    var form = ev.target.closest("[data-portrait-search]");
    if (!form) return;
    ev.preventDefault();
    var rtPortrait = route();
    if (rtPortrait.path !== "/gov/portrait") return;
    var qPortrait = rtPortrait.q || {};
    var formRoot = document.querySelector(".portrait-page") || document;
    var nextQ = {
      q: "",
      page: "",
      industry_cat: ((formRoot.querySelector('[data-portrait-filter="industry_cat"]') || {}).value || ""),
      industry: ((formRoot.querySelector('[data-portrait-filter="industry"]') || {}).value || ""),
      policy_id: ((formRoot.querySelector('[data-portrait-filter="policy_id"]') || {}).value || ""),
      carrier_district: ((formRoot.querySelector('[data-portrait-filter="carrier_district"]') || {}).value || ""),
      carrier_street: ((formRoot.querySelector('[data-portrait-filter="carrier_street"]') || {}).value || ""),
      carrier_park: ((formRoot.querySelector('[data-portrait-filter="carrier_park"]') || {}).value || ""),
      carrier_building: ((formRoot.querySelector('[data-portrait-filter="carrier_building"]') || {}).value || ""),
      chain_label: qPortrait.chain_label || ((qPortrait.filter === "chain") ? (qPortrait.fv || "") : ""),
      nid: qPortrait.chain_nid || qPortrait.nid || ""
    };
    var input = form.querySelector("input");
    nextQ.q = input ? String(input.value || "").trim() : "";
    Object.keys(nextQ).forEach(function (key) {
      if (nextQ[key] == null || nextQ[key] === "") delete nextQ[key];
    });
    location.hash = buildHash("/gov/portrait", nextQ);
  });

  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (!t) return;

    /* Chain page: district selector */
    if (t.getAttribute("data-role") === "chain-district-select") {
      return updateGeoHash({ district: t.value, industry: "", tab: "intro", term: "" }, "/gov/chain");
    }

    /* Policy Match: gov-side policy cascade selector */
    var pmGovPolicyAttr = t.getAttribute("data-pm-gov-policy");
    if (pmGovPolicyAttr) {
      var rtPolicyGov = route();
      var nextGovQ = Object.assign({}, (rtPolicyGov.q || {}));
      _pmGovState.selectedEnterpriseIds = [];
      _pmGovState.page = 1;
      if (pmGovPolicyAttr === "district") {
        nextGovQ.pdid = t.value || "";
        nextGovQ.pdept = "";
        nextGovQ.ptype = "";
        nextGovQ.pind = "";
        nextGovQ.pid = "";
      } else if (pmGovPolicyAttr === "dept") {
        nextGovQ.pdept = t.value || "";
        nextGovQ.ptype = "";
        nextGovQ.pind = "";
        nextGovQ.pid = "";
      } else if (pmGovPolicyAttr === "ptype") {
        nextGovQ.ptype = t.value || "";
        nextGovQ.pind = "";
        nextGovQ.pid = "";
      } else if (pmGovPolicyAttr === "industry") {
        nextGovQ.pind = t.value || "";
        nextGovQ.pid = "";
      } else if (pmGovPolicyAttr === "policy") {
        nextGovQ.pid = t.value || "";
      }
      Object.keys(nextGovQ).forEach(function (key) {
        if (nextGovQ[key] == null || nextGovQ[key] === "") delete nextGovQ[key];
      });
      delete nextGovQ.page;
      location.hash = buildHash("/gov/policy-gov", nextGovQ);
      return;
    }
    /* Policy Match: gov-side policy selector */
    if (t.getAttribute("data-action") === "pm_gov_select_policy") {
      _pmGovState.policyId = t.value || "";
      location.hash = "#/gov/policy-gov?pid=" + encodeURIComponent(t.value || "");
      return;
    }
    /* Policy Match: gov-side filters */
    var pmGovAttr = t.getAttribute("data-pm-gov");
    if (pmGovAttr) {
      _pmGovState.selectedEnterpriseIds = [];
      _pmGovState.page = 1;
      if (pmGovAttr === "ind") _pmGovState.indFilter = t.value || "";
      if (pmGovAttr === "scale") _pmGovState.scaleFilter = t.value || "";
      if (pmGovAttr === "type") _pmGovState.typeFilter = t.value || "";
      render(); return;
    }
    /* Policy Match: has_project radio */
    if (t.name === "has_project") {
      _pmEntState.hasProject = t.value || "";
      render(); return;
    }

    if (t.getAttribute("data-role") === "geo-layer-toggle") {
      var layer = t.getAttribute("data-layer");
      if (layer && _geoLayerVis.hasOwnProperty(layer)) {
        _geoLayerVis[layer] = !!t.checked;
        geoSaveLayerVis();
        var stage = document.querySelector(".geo-map-stage");
        if (stage) {
          stage.classList.toggle("hide-" + layer, !t.checked);
        }
        var lbl = t.closest(".geo-legend-toggle");
        if (lbl) lbl.classList.toggle("on", !!t.checked);
      }
      return;
    }
    if (t.getAttribute("data-role") === "geo-market" || t.getAttribute("data-role") === "geo-market-select") {
      var nextMarket = t.value || "";
      if (nextMarket) geoEnsureEnterpriseLayerVisible();
      return updateGeoHash({ market: nextMarket });
    }
    if (t.getAttribute("data-role") === "geo-metric-select") {
      var nextMetric0 = geoNormalizeMetricId(t.value);
      if (nextMetric0) geoEnsureHeatLayerVisible();
      var overlayNext0 = nextMetric0
        ? listFromCsv((route().q && route().q.metric_overlay) || "")
            .filter(function (x, idx, arr) {
              return geoNormalizeMetricId(x) && x !== nextMetric0 && arr.indexOf(x) === idx;
            })
        : [];
      return updateGeoHash({ metric: nextMetric0, metric_overlay: overlayNext0.join(",") });
    }
    if (t.getAttribute("data-role") === "geo-metric") {
      var nextMetric = geoNormalizeMetricId(t.value);
      if (nextMetric) geoEnsureHeatLayerVisible();
      var overlayNext = nextMetric
        ? listFromCsv((route().q && route().q.metric_overlay) || "")
            .filter(function (x, idx, arr) {
              return geoNormalizeMetricId(x) && x !== nextMetric && arr.indexOf(x) === idx;
            })
        : [];
      return updateGeoHash({ metric: nextMetric, metric_overlay: overlayNext.join(",") });
    }
    if (t.getAttribute("data-role") === "geo-metric-overlay-select") {
      var metricMain = geoNormalizeMetricId(route().q && route().q.metric);
      if (!metricMain) return updateGeoHash({ metric_overlay: "" });
      var overlayPool = ["revenue", "output", "tax"].filter(function (x) {
        return x !== metricMain;
      });
      if (t.value === "none") return updateGeoHash({ metric_overlay: "" });
      if (t.value === "all") return updateGeoHash({ metric_overlay: overlayPool.join(",") });
      if (overlayPool.indexOf(t.value) >= 0) return updateGeoHash({ metric_overlay: t.value });
      return updateGeoHash({ metric_overlay: "" });
    }
    if (t.getAttribute("data-role") === "geo-metric-overlay") {
      var metricMain0 = geoNormalizeMetricId(route().q && route().q.metric);
      if (!metricMain0) return updateGeoHash({ metric_overlay: "" });
      var overlayVals = Array.prototype.slice
        .call(document.querySelectorAll('[data-role="geo-metric-overlay"]:checked'))
        .map(function (el) {
          return el.value;
        })
        .filter(function (x, idx, arr) {
          return geoNormalizeMetricId(x) && x !== metricMain0 && arr.indexOf(x) === idx;
        });
      return updateGeoHash({ metric_overlay: overlayVals.join(",") });
    }
    if (t.getAttribute("data-role") === "geo-chain-city") {
      var list = geoChainList(t.value);
      return updateGeoHash({ chain_city: t.value, chain: list[0] || "" });
    }
    if (t.getAttribute("data-role") === "geo-chain") return updateGeoHash({ chain: t.value });
    if (t.getAttribute("data-role") === "geo-project") return updateGeoHash({ proj: t.checked ? "1" : "0" });
    if (t.getAttribute("data-role") === "geo-project-select") return updateGeoHash({ proj: t.value === "0" ? "0" : "1" });
    if (t.getAttribute("data-role") === "geo-park-skin") return updateGeoHash({ park_skin: t.checked ? "1" : "0" });
    if (t.getAttribute("data-role") === "geo-park-poi") return updateGeoHash({ park_poi: t.checked ? "1" : "0" });
    if (t.getAttribute("data-role") === "geo-auto-zoom") return updateGeoHash({ auto_zoom: t.checked ? "1" : "0" });
    if (t.getAttribute("data-role") === "geo-autozoom-mode") return updateGeoHash({ auto_zoom: t.value === "off" ? "0" : "1" });
    if (t.getAttribute("data-role") === "geo-az-d2s") return updateGeoHash({ az_d2s: fixed(clamp(Number(t.value || 1.62), 1.05, 2.6), 2) });
    if (t.getAttribute("data-role") === "geo-az-s2p") return updateGeoHash({ az_s2p: fixed(clamp(Number(t.value || 1.9), 1.2, 3.2), 2) });
    if (t.getAttribute("data-role") === "geo-az-s2d") return updateGeoHash({ az_s2d: fixed(clamp(Number(t.value || 0.78), 0.65, 1.25), 2) });
    if (t.getAttribute("data-role") === "geo-az-p2s") return updateGeoHash({ az_p2s: fixed(clamp(Number(t.value || 1.05), 0.7, 1.8), 2) });
    if (t.getAttribute("data-role") === "geo-az-p2d") return updateGeoHash({ az_p2d: fixed(clamp(Number(t.value || 0.74), 0.65, 1.3), 2) });
    if (t.getAttribute("data-role") === "geo-carrier") {
      var carriers = Array.prototype.slice
        .call(document.querySelectorAll('[data-role="geo-carrier"]:checked'))
        .map(function (x) {
          return x.value;
        });
      return updateGeoHash({ carrier: carriers.length ? carriers.join(",") : "none" });
    }
    if (t.getAttribute("data-role") === "geo-scope" || t.getAttribute("data-role") === "geo-scope-level") {
      var rt0 = route();
      if (t.value === "district") return updateGeoHash({ scope: "district", sid: "", pid: "" }, "/gov/geo-district", { skipGeoFly: true });
      if (t.value === "park") {
        return updateGeoHash({ scope: "park", park_mode: "all", pid: "", sid: "" }, "/gov/geo-park", { skipGeoFly: true });
      }
      if (rt0.path === "/gov/geo-district" || rt0.path === "/gov/geo-park") return updateGeoHash({ scope: "street", pid: "" }, "/gov/geo-street", { skipGeoFly: true });
      return updateGeoHash({ scope: "street", pid: "" }, null, { skipGeoFly: true });
    }
    if (t.getAttribute("data-role") === "geo-district-pick") {
      var rt1 = route();
      var keepScope = (rt1.q && rt1.q.scope) || (rt1.path === "/gov/geo-district" ? "district" : "street");
      var newDid = t.value || "";
      if (rt1.path === "/gov/geo-district") {
        return updateGeoHash({ did: newDid, sid: "", pid: "", scope: "district", park_mode: "" }, "/gov/geo-district", { resetGeoView: true });
      }
      return updateGeoHash(
        { did: newDid, sid: "", pid: "", scope: keepScope === "park" ? "park" : "street", park_mode: keepScope === "park" ? "all" : "" },
        null,
        { resetGeoView: true }
      );
    }
    if (t.getAttribute("data-role") === "geo-street-pick") {
      var rt2 = route();
      if (rt2.path === "/gov/geo-district") return updateGeoHash({ sid: t.value, scope: "street", pid: "" }, "/gov/geo-street");
      return updateGeoHash({ sid: t.value, scope: "street", pid: "" });
    }
    if (t.getAttribute("data-role") === "geo-park-pick") {
      var rt3 = route();
      var p1 = geoParkById(t.value) || {};
      if (rt3.path === "/gov/geo-district") return updateGeoHash({ scope: "park", park_mode: "focus", pid: t.value, sid: p1.street_id || "" }, "/gov/geo-park", { resetGeoView: true });
      return updateGeoHash({ scope: "park", park_mode: "focus", pid: t.value, sid: p1.street_id || "" }, "/gov/geo-park", { resetGeoView: true });
    }
    if (t.getAttribute("data-role") === "geo-park-quick") {
      if (t.value === "all") return updateGeoHash({ scope: "park", park_mode: "all", pid: "", sid: "" }, "/gov/geo-park", { resetGeoView: true });
      var pQuick = geoParkById(t.value) || {};
      return updateGeoHash({ scope: "park", park_mode: "focus", pid: t.value, sid: pQuick.street_id || "" }, "/gov/geo-park", { resetGeoView: true });
    }
    if (t.getAttribute("data-role") === "geo-park-focus-select") {
      if (!t.value) return;
      if (t.value === "all") return updateGeoHash({ scope: "park", park_mode: "all", pid: "", sid: "" }, "/gov/geo-park", { resetGeoView: true });
      var pFocus = geoParkById(t.value) || {};
      return updateGeoHash({ scope: "park", park_mode: "focus", pid: t.value, sid: pFocus.street_id || "" }, "/gov/geo-park", { resetGeoView: true });
    }
    if (t.getAttribute("data-role") === "geo-industry-select") {
      return updateGeoHash({ inds: t.value || "" });
    }
    if (t.getAttribute("data-role") === "geo-carrier-select") {
      if (t.value === "all") return updateGeoHash({ carrier: "building,factory" });
      if (t.value === "building") return updateGeoHash({ carrier: "building" });
      if (t.value === "factory") return updateGeoHash({ carrier: "factory" });
      return updateGeoHash({ carrier: "none" });
    }
    if (t.getAttribute("data-role") === "geo-park-visual") {
      if (t.value === "base") return updateGeoHash({ park_skin: "0", park_poi: "0" });
      if (t.value === "skin") return updateGeoHash({ park_skin: "1", park_poi: "0" });
      if (t.value === "poi") return updateGeoHash({ park_skin: "0", park_poi: "1" });
      return updateGeoHash({ park_skin: "1", park_poi: "1" });
    }
    if (t.getAttribute("data-role") === "geo-online-map-mode") {
      if (t.value === "off") {
        return updateGeoHash({ omt: "0" });
      }
      return updateGeoHash({ omt: "1", omt_p: t.value });
    }
    if (t.getAttribute("data-role") === "geo-online-token") {
      geoSetTileProviderToken(t.getAttribute("data-provider") || "", t.value || "");
      var stageNative = document.querySelector('[data-role="geo-stage"]');
      var activeView = getActiveGeoView();
      if (stageNative && activeView) scheduleGeoNativeMapSync(stageNative, activeView, true);
      toast("已保存地图密钥", "success");
      return;
    }
    if (t.getAttribute("data-role") === "geo-online-jscode") {
      geoSetTileProviderToken(t.getAttribute("data-provider") || "", t.value || "");
      var stageNativeCode = document.querySelector('[data-role="geo-stage"]');
      var activeViewCode = getActiveGeoView();
      if (stageNativeCode && activeViewCode) scheduleGeoNativeMapSync(stageNativeCode, activeViewCode, true);
      toast("已保存安全密钥", "success");
      return;
    }
    if (t.getAttribute("data-role") === "chain-industry") {
      location.hash = "#/gov/chain?industry=" + encodeURIComponent(t.value);
    }
    if (t.getAttribute("data-role") === "bank-switch") {
      setState(function (st) { st.active.bank_id = t.value; });
      toast("已切换机构");
    }
  });

  document.addEventListener("input", function (ev) {
    var t = ev.target;
    if (!t) return;

    /* Policy Match: enterprise name fuzzy search */
    if (t.getAttribute("data-pm") === "ent_name") {
      _pmEntState.entName = t.value || "";
      _pmEntState.matchedEnt = null;
      _pmEntState.searchKeyword = "";
      _pmEntState.showSuggestions = false;
      _pmResetEntSearchUi(t);
      return;
    }

    var role = t.getAttribute("data-role");
    if (
      role !== "geo-az-d2s" &&
      role !== "geo-az-s2p" &&
      role !== "geo-az-s2d" &&
      role !== "geo-az-p2s" &&
      role !== "geo-az-p2d"
    ) return;
    var row = t.closest(".geo-range-row");
    var label = row ? row.querySelector("b") : null;
    if (label) label.textContent = fixed(Number(t.value || 0), 2);
  });

  document.addEventListener("keydown", function (ev) {
    var rt0 = route();
    var isGeoPath = rt0.path.indexOf("/gov/geo-") === 0;
    var isChainPath = rt0.path === "/gov/chain";
    var et = ev.target;
    var tag = et && et.tagName ? et.tagName.toLowerCase() : "";
    var isTyping = tag === "input" || tag === "textarea" || tag === "select" || (et && et.isContentEditable);
    if (et && et.getAttribute && et.getAttribute("data-pm") === "ent_name" && ev.key === "Enter") {
      ev.preventDefault();
      _pmRunEnterpriseSearch(et.value || "");
      render();
      return;
    }
    if (et && et.id === "ai-chat-input" && ev.key === "Enter") {
      ev.preventDefault();
      aiChatSend();
      return;
    }
    if (isGeoPath && !isTyping) {
      if (ev.key === "+" || ev.key === "=") {
        ev.preventDefault();
        geoZoomBy(0.14);
        return;
      }
      if (ev.key === "-" || ev.key === "_") {
        ev.preventDefault();
        geoZoomBy(-0.14);
        return;
      }
      if (ev.key === "0") {
        ev.preventDefault();
        geoResetView();
        return;
      }
      if (ev.key === "ArrowUp" || ev.key === "ArrowDown" || ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
        ev.preventDefault();
        var _panView = getActiveGeoView();
        if (_panView) {
          var _panStage = document.querySelector('[data-role="geo-stage"]');
          var _panStep = 40 * Math.max(1, _panView.zoom * 0.12);
          if (ev.key === "ArrowUp") _panView.ty += _panStep;
          else if (ev.key === "ArrowDown") _panView.ty -= _panStep;
          else if (ev.key === "ArrowLeft") _panView.tx += _panStep;
          else if (ev.key === "ArrowRight") _panView.tx -= _panStep;
          geoClampViewToStage(_panStage, _panView);
          scheduleGeoInteractionFrame(_panStage, _panView, {});
          if (geoIsNativeBasemapQuery((rt0.q) || {})) scheduleGeoNativeMapSync(_panStage, _panView, false);
        }
        return;
      }
    }
    if (isChainPath && !isTyping) {
      if (ev.key === "+" || ev.key === "=") {
        ev.preventDefault();
        var zIn = clamp(Number((rt0.q && rt0.q.z) || 1) + 0.08, 0.75, 1.55);
        updateGeoHash({ z: fixed(zIn, 2) }, "/gov/chain");
        return;
      }
      if (ev.key === "-" || ev.key === "_") {
        ev.preventDefault();
        var zOut = clamp(Number((rt0.q && rt0.q.z) || 1) - 0.08, 0.75, 1.55);
        updateGeoHash({ z: fixed(zOut, 2) }, "/gov/chain");
        return;
      }
      if (ev.key === "0") {
        ev.preventDefault();
        updateGeoHash({ z: "1.00" }, "/gov/chain");
        return;
      }
    }
    if (ev.key !== "Enter") return;
    var t = ev.target;
    if (t && t.getAttribute("data-role") === "chain-search") {
      var term = (t.value || "").trim();
      updateGeoHash({ term: term }, "/gov/chain");
      if (term) toast("已按产业链关键词搜索：" + term);
      else toast("已清空产业链搜索");
      return;
    }
    if (!t || t.getAttribute("data-role") !== "global-search") return;
    var q = (t.value || "").trim();
    if (state.role === "gov") return runGeoSearch(q);
    if (!q) return;
    location.hash = "#/gov/enterprises?q=" + encodeURIComponent(q);
    toast("已搜索：" + q);
  });

  /* ── Login form handler ── */
  document.addEventListener("submit", function (ev) {
    var loginForm = ev.target.closest("#login-form");
    if (!loginForm) return;
    ev.preventDefault();
    var captchaInput = ((document.getElementById("login-captcha") || {}).value || "").trim();
    if (captchaInput.toUpperCase() !== _captchaCode.toUpperCase()) {
      _captchaCode = generateCaptcha();
      toast("验证码错误，请重新输入", "error");
      render();
      return;
    }
    setLoggedIn(true);
    var selectedAccount = ((document.getElementById("login-demo-account") || {}).value || "admin").trim();
    setLoginUser(selectedAccount);
    var loginUser = currentUser();
    location.hash = "#/gov/home";
    toast("登录成功，欢迎使用产业大脑平台 —— " + loginUser.name + "（" + loginUser.dept + "）");
  });

  document.addEventListener("click", function (ev) {
    /* Refresh captcha */
    if (ev.target.closest('[data-action="refresh-captcha"]')) {
      _captchaCode = generateCaptcha();
      render();
      return;
    }
    /* Login tabs */
    var tabBtn = ev.target.closest('[data-login-tab]');
    if (tabBtn) {
      var allTabs = document.querySelectorAll('.login-tab');
      for (var ti = 0; ti < allTabs.length; ti++) allTabs[ti].classList.remove('active');
      tabBtn.classList.add('active');
      return;
    }
    /* Toggle QR login panel */
    if (ev.target.closest('[data-action="toggle-qr-login"]')) {
      var qrPanel = document.getElementById('login-qr-panel');
      var acctPanel = document.getElementById('login-account-panel');
      var qrCorner = document.querySelector('.login-qr-corner');
      if (qrPanel && acctPanel) {
        var showQr = qrPanel.classList.contains('hidden');
        qrPanel.classList.toggle('hidden', !showQr);
        acctPanel.classList.toggle('hidden', showQr);
        if (qrCorner) qrCorner.classList.toggle('hidden', showQr);
      }
      return;
    }
  });

  // ── Search autocomplete wiring (delegated) ─────────────────
  document.addEventListener("input", function (ev) {
    var t = ev.target;
    if (!t || t.getAttribute("data-role") !== "global-search") return;
    if (_geoSearchDebounce) clearTimeout(_geoSearchDebounce);
    _geoSearchDebounce = setTimeout(function () {
      _geoSearchDebounce = 0;
      var term = (t.value || "").trim();
      if (term.length < 1) { geoSearchDropdownHide(); return; }
      var candidates = geoSearchCandidates();
      var matches = geoSearchMatch(candidates, term, 8);
      geoSearchDropdownShow(t, matches);
    }, 150);
  });
  document.addEventListener("keydown", function (ev) {
    var t = ev.target;
    if (!t || t.getAttribute("data-role") !== "global-search") return;
    if (geoSearchDropdownKeydown(ev, t)) return;
  }, true);
  document.addEventListener("focusout", function (ev) {
    var t = ev.target;
    if (!t || t.getAttribute("data-role") !== "global-search") return;
    setTimeout(geoSearchDropdownHide, 200);
  });

  // ── Network offline / online detection ────────────────────
  var _geoOfflineBanner = null;
  function geoShowOfflineBanner() {
    if (_geoOfflineBanner && document.body.contains(_geoOfflineBanner)) return;
    _geoOfflineBanner = document.createElement("div");
    _geoOfflineBanner.className = "geo-offline-banner";
    _geoOfflineBanner.setAttribute("role", "alert");
    _geoOfflineBanner.textContent = "网络连接已断开，部分地图数据可能无法加载";
    document.body.appendChild(_geoOfflineBanner);
  }
  function geoHideOfflineBanner() {
    if (_geoOfflineBanner && _geoOfflineBanner.parentNode) {
      _geoOfflineBanner.parentNode.removeChild(_geoOfflineBanner);
    }
    _geoOfflineBanner = null;
  }
  window.addEventListener("offline", geoShowOfflineBanner);
  window.addEventListener("online", function () {
    geoHideOfflineBanner();
    toast("网络已恢复连接");
  });
  if (typeof navigator !== "undefined" && navigator.onLine === false) geoShowOfflineBanner();

  // ── Right-click context menu on geo map ───────────────────
  document.addEventListener("contextmenu", function (ev) {
    var viewport = ev.target && ev.target.closest && ev.target.closest('[data-role="geo-viewport"]');
    if (!viewport) return;
    ev.preventDefault();
    geoCtxMenuShow(ev.clientX, ev.clientY, ev.target);
  });

  var _geoCtxMenu = null;
  function geoCtxMenuHide() {
    if (_geoCtxMenu && _geoCtxMenu.parentNode) _geoCtxMenu.parentNode.removeChild(_geoCtxMenu);
    _geoCtxMenu = null;
  }
  function geoCtxMenuShow(x, y, target) {
    geoCtxMenuHide();
    var rt = route();
    var view = getActiveGeoView();
    var shape = target && target.closest && target.closest(".geo-boundary-shape");
    var shapeName = shape && shape.getAttribute("data-name");
    var items = [];
    if (shapeName) {
      items.push({ label: "搜索「" + shapeName + "」", action: function () { runGeoSearch(shapeName); } });
    }
    items.push({ label: "重置视图", action: function () { geoResetView(); } });
    items.push({ label: "复制当前链接", action: function () {
      copyText(location.href).then(function (ok) {
        toast(ok ? "链接已复制" : "复制失败");
      });
    }});
    if (view) {
      items.push({ label: "放大", action: function () { geoZoomBy(0.14); } });
      items.push({ label: "缩小", action: function () { geoZoomBy(-0.14); } });
    }
    if (rt.path.indexOf("/gov/geo-") === 0 && rt.path !== "/gov/geo-district") {
      items.push({ label: "返回上级视图", action: function () {
        var p = rt.path === "/gov/geo-park" ? "/gov/geo-street" : "/gov/geo-district";
        geoNavigateToRoute(p, rt.q || {}, { skipGeoFly: true });
      }});
    }
    _geoCtxMenu = document.createElement("div");
    _geoCtxMenu.className = "geo-ctx-menu";
    _geoCtxMenu.innerHTML = items.map(function (it, i) {
      return '<div class="geo-ctx-item" data-idx="' + i + '">' + esc(it.label) + '</div>';
    }).join("");
    _geoCtxMenu.style.left = x + "px";
    _geoCtxMenu.style.top = y + "px";
    document.body.appendChild(_geoCtxMenu);
    // Clamp to viewport
    var rect = _geoCtxMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) _geoCtxMenu.style.left = (x - rect.width) + "px";
    if (rect.bottom > window.innerHeight) _geoCtxMenu.style.top = (y - rect.height) + "px";
    _geoCtxMenu.addEventListener("click", function (ev) {
      var item = ev.target.closest(".geo-ctx-item");
      if (!item) return;
      var idx = Number(item.getAttribute("data-idx") || 0);
      if (items[idx] && items[idx].action) items[idx].action();
      geoCtxMenuHide();
    });
    setTimeout(function () {
      document.addEventListener("click", geoCtxMenuHide, { once: true });
    }, 0);
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("scroll", function () {
    var sp = document.getElementById("scroll-progress");
    if (!sp) return;
    var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    sp.style.width = scrollHeight > 0 ? (scrollTop / scrollHeight * 100) + "%" : "0%";
  });

  // ── GIS diagnostic utility (call window._geoDebug() in browser console) ──
  window._geoDebug = function () {
    var stage = document.querySelector('[data-role="geo-stage"]');
    var viewport = stage && stage.querySelector('[data-role="geo-viewport"]');
    var canvas = stage && stage.querySelector('[data-role="geo-canvas"]');
    var tileLayer = stage && stage.querySelector('[data-role="geo-online-tiles"]');
    var info = {
      stageInDOM: !!stage && document.body.contains(stage),
      viewportInDOM: !!viewport && document.body.contains(viewport),
      canvasInDOM: !!canvas && document.body.contains(canvas),
      canvasInlineTransform: canvas ? canvas.style.transform : "N/A",
      canvasComputedTransform: canvas ? getComputedStyle(canvas).transform : "N/A",
      tileInlineTransform: tileLayer ? tileLayer.style.transform : "N/A",
      viewState: getActiveGeoView(),
      activeViewKey: geoActiveViewKey,
      stageRect: stage ? stage.getBoundingClientRect() : null,
      nativeMapMode: stage ? stage.getAttribute("data-native-map") : "N/A",
    };
    console.table ? console.table(info) : console.log("[GEO DEBUG]", JSON.stringify(info, null, 2));
    return info;
  };

  /* ═══════════════════════════════════════════════════════════
     AI Chat – inline assistant on gov home portal
     ═══════════════════════════════════════════════════════════ */
  var _aiChatMessages = [];

  function aiChatInit() {
    if (!_aiChatMessages.length) {
      _aiChatMessages.push({ role: "ai", text: "您好！请问有什么可以帮您？" });
    }
    aiChatRenderMessages();
  }

  function aiChatRenderMessages() {
    var box = document.getElementById("ai-chat-messages");
    if (!box) return;
    box.innerHTML = _aiChatMessages.map(function (m) {
      var cls = m.role === "ai" ? "ai-msg" : "user-msg";
      return '<div class="ai-chat-bubble ' + cls + '"><span>' + esc(m.text).replace(/\n/g, "<br>") + '</span></div>';
    }).join("");
    box.scrollTop = box.scrollHeight;
  }

  function aiChatSend() {
    var input = document.getElementById("ai-chat-input");
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    _aiChatMessages.push({ role: "user", text: text });
    aiChatRenderMessages();

    /* show typing indicator */
    var box = document.getElementById("ai-chat-messages");
    if (box) {
      var typing = document.createElement("div");
      typing.className = "ai-chat-bubble ai-msg typing";
      typing.innerHTML = '<span class="ai-typing-dots"><i></i><i></i><i></i></span>';
      box.appendChild(typing);
      box.scrollTop = box.scrollHeight;
    }

    setTimeout(function () {
      var dot = document.querySelector(".ai-chat-bubble.typing");
      if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
      _aiChatMessages.push({ role: "ai", text: aiChatAnswer(text) });
      aiChatRenderMessages();
    }, 600 + Math.random() * 800);
  }

  function aiChatAnswer(q) {
    var low = q.toLowerCase();
    if (/产业链|链式|图谱|补链|短板/.test(low))
      return "产业链式图谱专题已上线，当前覆盖航空航天、金融、文旅、商务商贸、人工智能、低空经济等主导产业。\n\n您可以进入「产业链式图谱」专题查看链条结构和薄弱节点分析，也可以直接点击首页卡片进入。";
    if (/企业|画像|筛选|名录/.test(low))
      return "企业画像分析专题支持按产业类别、行业分类、空间载体等维度精准筛选企业。\n\n目前已接入青羊区高成长企业库，可查看企业详细档案和楼宇载体详情。";
    if (/政策|匹配|推送|兑现/.test(low))
      return "政策智能匹配专题提供「企业找政策」和「政策找企业」双入口，支持政策级联筛选、企业分页清单和一键推送。\n\n可从首页卡片进入该专题。";
    if (/迁出|预警|风险|留商/.test(low))
      return "企业迁出预警专题围绕迁出风险识别、等级分层和跟进处置构建。\n\n当前预警企业按高/中/低三级分层，支持按街道和行业筛选。";
    if (/招商|投资|线索/.test(low))
      return "招商研判专题统一串联GIS招商热力、产业链补链判断、载体承接能力和风险协同信息。\n\n进入后可查看街道与园区招商线索汇总。";
    if (/项目|调度|进度/.test(low))
      return "重点项目调度专题当前共纳入多个市/区重点项目，覆盖产业升级、城市更新、中试平台等类型。\n\n可按状态、部门、街道筛选，并查看项目进展和预警情况。";
    if (/GDP|经济|统计|公报|年鉴/.test(low))
      return "政府统计数据专题已接入统计公报和统计年鉴资料，支持指标趋势与预测分析。\n\n经济目标考核专题可查看年度指标完成率和区域对比。";
    if (/决策|讲话|会议/.test(low))
      return "领导决策支撑专题围绕领导讲话、会议纪要和专题内容进行筛选分析和汇总。\n\n可用于决策支撑和专题资料查阅。";
    if (/你好|您好|嗨|hi|hello/.test(low))
      return "您好！请问有什么可以帮您的？我可以回答关于区域经济、产业链、企业、政策、招商、项目等方面的问题。";
    if (/谢谢|感谢|thanks/.test(low))
      return "不客气！如果还有其他问题，随时可以问我。";
    return "感谢您的提问。产业大脑平台当前已上线十大专题模块，涵盖区域经济研判、产业链图谱、企业画像、政策匹配、招商研判、迁出预警、重点项目、决策支撑、经济目标考核和统计数据等方面。\n\n请问您具体想了解哪个方向的内容？";
  }

  render();

})();
