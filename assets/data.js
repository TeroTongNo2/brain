(function () {
  function nowISO() {
    var d = new Date();
    return d.toISOString().slice(0, 19) + "Z";
  }

  // Base sample data. Runtime changes (consents, demands, work orders) live in localStorage.
  window.DEMO_SEED = {
    meta: {
      version: "2026-03-03",
      generated_at: nowISO(),
      region: "示例：青羊区 · 某街道（镇域）",
    },
    banks: [
      { id: "b1", name: "成都市某银行 · 青羊支行", products: ["普惠信用贷", "科创贷", "设备更新贷"] },
      { id: "b2", name: "四川某银行 · 城区支行", products: ["供应链融资", "园区租赁贷"] },
    ],
    staff: [
      { id: "s1", name: "王琳", org: "街道经发办", title: "企业服务专员" },
      { id: "s2", name: "赵晨", org: "街道经发办", title: "招商主管" },
      { id: "s3", name: "陈嘉", org: "社区网格", title: "网格员" },
    ],
    industries: [
      { id: "i1", name: "智能制造" },
      { id: "i2", name: "生物医药" },
      { id: "i3", name: "现代商贸" },
      { id: "i4", name: "创新服务" },
    ],
      enterprises: [
        {
          id: "e1",
          name: "川航精密制造有限公司",
          uscc: "91510105MA6C0X1A1X",
          industry: "智能制造",
          track: "支柱产业",
          address: "示例路 88 号 A 栋",
          grid: "锦绣社区-网格03",
          level: "规上",
          tags: [
            "高新技术",
            "本地配套型",
            "链上关键节点"
          ],
          kpis: {
            revenue_y: 2.4,
            tax_y: 0.21,
            employees: 320,
            r_and_d: 0.12
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "参保人数稳定",
              "无重大司法风险"
            ]
          },
          ecosystem_role: [
            "本地加工",
            "设备制造"
          ],
          products: [
            "航空结构件",
            "精密夹具"
          ],
          events: [
            {
              date: "2025-11-18",
              title: "新增发明专利 2 项",
              type: "innovation"
            },
            {
              date: "2026-01-06",
              title: "扩产计划：新增 CNC 产线",
              type: "operate"
            }
          ],
          street_id: "gs1",
          district_id: "gd1",
          park_id: "gp2",
          building_id: "gbs001"
        },
        {
          id: "e2",
          name: "星河生物医药科技（成都）有限公司",
          uscc: "91510105MA7J2P2B2Q",
          industry: "生物医药",
          track: "新兴产业",
          address: "科创大道 16 号 2F",
          grid: "科创社区-网格01",
          level: "规下",
          tags: [
            "专精特新",
            "研发驱动"
          ],
          kpis: {
            revenue_y: 0.6,
            tax_y: 0.04,
            employees: 86,
            r_and_d: 0.28
          },
          risk: {
            level: "中",
            score: 56,
            signals: [
              "招聘岗位数下降",
              "融资进展不确定"
            ]
          },
          ecosystem_role: [
            "研发",
            "CRO 合作"
          ],
          products: [
            "细胞治疗试剂",
            "科研服务"
          ],
          events: [
            {
              date: "2025-09-10",
              title: "完成 A 轮融资（公开信息）",
              type: "finance"
            },
            {
              date: "2026-02-02",
              title: "关键岗位变更：研发负责人",
              type: "change"
            }
          ],
          street_id: "gs12",
          district_id: "gd1",
          park_id: "gp7",
          building_id: "gbs002"
        },
        {
          id: "e3",
          name: "青羊智数信息技术有限公司",
          uscc: "91510105MA8A8A8A8A",
          industry: "创新服务",
          track: "支柱产业",
          address: "锦官城写字楼 9F",
          grid: "锦绣社区-网格01",
          level: "规上",
          tags: [
            "数据服务",
            "本地服务商"
          ],
          kpis: {
            revenue_y: 1.3,
            tax_y: 0.11,
            employees: 140,
            r_and_d: 0.1
          },
          risk: {
            level: "低",
            score: 22,
            signals: [
              "合同稳定",
              "诉讼风险低"
            ]
          },
          ecosystem_role: [
            "IT 服务",
            "数字化转型"
          ],
          products: [
            "数据治理咨询",
            "BI 报表平台"
          ],
          events: [
            {
              date: "2026-01-20",
              title: "中标区级数字化项目",
              type: "bid"
            }
          ],
          street_id: "gs1",
          district_id: "gd1",
          park_id: "gp2",
          building_id: "gbs003"
        },
        {
          id: "e4",
          name: "锦尚供应链管理有限公司",
          uscc: "91510105MA9B9B9B9B",
          industry: "现代商贸",
          track: "支柱产业",
          address: "示例物流园 3 号库",
          grid: "物流社区-网格02",
          level: "规上",
          tags: [
            "供应链",
            "仓配一体"
          ],
          kpis: {
            revenue_y: 3.1,
            tax_y: 0.18,
            employees: 210,
            r_and_d: 0.02
          },
          risk: {
            level: "高",
            score: 78,
            signals: [
              "参保人数下降",
              "劳资纠纷增多",
              "股权变更"
            ]
          },
          ecosystem_role: [
            "物流仓配",
            "供应链服务"
          ],
          products: [
            "仓配服务",
            "冷链配送"
          ],
          events: [
            {
              date: "2025-12-05",
              title: "劳动争议裁判文书新增 3 条",
              type: "risk"
            },
            {
              date: "2026-02-15",
              title: "股东变更：异地企业入股",
              type: "change"
            }
          ],
          street_id: "gs14",
          district_id: "gd1",
          park_id: "gp9",
          building_id: "gbs004"
        },
        {
          id: "e5",
          name: "天工智造设备有限公司",
          uscc: "91510105MA1C2D3E4F",
          industry: "智能制造",
          track: "新兴产业",
          address: "示例路 102 号 C 栋",
          grid: "锦绣社区-网格04",
          level: "规下",
          tags: [
            "设备更新",
            "技改需求"
          ],
          kpis: {
            revenue_y: 0.9,
            tax_y: 0.05,
            employees: 66,
            r_and_d: 0.09
          },
          risk: {
            level: "中",
            score: 49,
            signals: [
              "订单波动",
              "现金流偏紧"
            ]
          },
          ecosystem_role: [
            "设备制造",
            "本地配套"
          ],
          products: [
            "自动化产线",
            "装配测试工装"
          ],
          events: [
            {
              date: "2026-02-22",
              title: "提交技改项目备案",
              type: "operate"
            }
          ],
          street_id: "gs1",
          district_id: "gd1",
          park_id: "gp2",
          building_id: "gbs005"
        },
        {
          id: "e6",
          name: "锦城法务与知识产权服务中心",
          uscc: "91510105MA0000000X",
          industry: "创新服务",
          track: "生态机构",
          address: "政务服务中心 3F",
          grid: "政务社区-网格01",
          level: "服务机构",
          tags: [
            "法律服务",
            "知识产权"
          ],
          kpis: {
            revenue_y: 0.2,
            tax_y: 0.01,
            employees: 18,
            r_and_d: 0
          },
          risk: {
            level: "低",
            score: 12,
            signals: [
              "合规良好"
            ]
          },
          ecosystem_role: [
            "服务机构"
          ],
          products: [
            "企业合规",
            "专利代理"
          ],
          events: [
            {
              date: "2026-01-12",
              title: "新增服务套餐：科创企业合规体检",
              type: "service"
            }
          ],
          street_id: "gs10",
          district_id: "gd1",
          park_id: "gp21",
          building_id: "gbs006"
        },
        {
          id: "e7",
          name: "蓉城光电科技有限公司",
          uscc: "91510105MA2A3B4C5D",
          industry: "智能制造",
          track: "新兴产业",
          address: "金沙科创中心 A 座 7F",
          grid: "金沙街道-网格02",
          level: "规上",
          tags: [
            "高新技术",
            "研发驱动"
          ],
          kpis: {
            revenue_y: 1.8,
            tax_y: 0.15,
            employees: 210,
            r_and_d: 0.18
          },
          risk: {
            level: "低",
            score: 21,
            signals: [
              "营收稳步增长",
              "专利持续产出"
            ]
          },
          ecosystem_role: [
            "光电器件制造"
          ],
          products: [
            "光学模组",
            "红外传感器"
          ],
          events: [
            {
              date: "2026-01-08",
              title: "获评省级专精特新企业",
              type: "innovation"
            }
          ],
          building_id: "gb1",
          park_id: "gp2",
          street_id: "gs1",
          district_id: "gd1"
        },
        {
          id: "e8",
          name: "西锦软件技术有限公司",
          uscc: "91510105MA3D4E5F6G",
          industry: "创新服务",
          track: "支柱产业",
          address: "西城智谷 2 号楼 5F",
          grid: "金沙街道-网格01",
          level: "规上",
          tags: [
            "数据服务",
            "本地服务商"
          ],
          kpis: {
            revenue_y: 0.9,
            tax_y: 0.07,
            employees: 95,
            r_and_d: 0.22
          },
          risk: {
            level: "低",
            score: 15,
            signals: [
              "政府订单稳定",
              "团队稳定"
            ]
          },
          ecosystem_role: [
            "IT 服务"
          ],
          products: [
            "政务数字化",
            "AI 辅助决策平台"
          ],
          events: [
            {
              date: "2025-12-20",
              title: "中标智慧城管平台二期",
              type: "bid"
            }
          ],
          building_id: "gb2",
          park_id: "gp2",
          street_id: "gs1",
          district_id: "gd1"
        },
        {
          id: "e9",
          name: "府南精工航空零部件有限公司",
          uscc: "91510105MA5E6F7G8H",
          industry: "智能制造",
          track: "支柱产业",
          address: "府南航空配套园 1 栋 B 区",
          grid: "府南街道-网格03",
          level: "规上",
          tags: [
            "高新技术",
            "本地配套型",
            "链上关键节点"
          ],
          kpis: {
            revenue_y: 3.6,
            tax_y: 0.32,
            employees: 480,
            r_and_d: 0.14
          },
          risk: {
            level: "低",
            score: 16,
            signals: [
              "大客户订单饱满",
              "现金流充裕"
            ]
          },
          ecosystem_role: [
            "航空零部件加工"
          ],
          products: [
            "发动机叶片",
            "钛合金结构件"
          ],
          events: [
            {
              date: "2026-02-10",
              title: "获 AS9100D 航空质量体系认证",
              type: "innovation"
            }
          ],
          building_id: "gb3",
          park_id: "gp1",
          street_id: "gs2",
          district_id: "gd1"
        },
        {
          id: "e10",
          name: "蜀通新材料股份有限公司",
          uscc: "91510105MA6G7H8I9J",
          industry: "智能制造",
          track: "新兴产业",
          address: "青羊工业载体 B 区 3 号厂房",
          grid: "府南街道-网格02",
          level: "规上",
          tags: [
            "专精特新",
            "设备更新"
          ],
          kpis: {
            revenue_y: 2.1,
            tax_y: 0.19,
            employees: 260,
            r_and_d: 0.16
          },
          risk: {
            level: "中",
            score: 44,
            signals: [
              "原材料成本波动",
              "环保合规待验收"
            ]
          },
          ecosystem_role: [
            "新材料研发"
          ],
          products: [
            "高性能碳纤维",
            "复合材料预浸料"
          ],
          events: [
            {
              date: "2025-11-25",
              title: "扩产二期投产",
              type: "operate"
            }
          ],
          building_id: "gb4",
          park_id: "gp1",
          street_id: "gs2",
          district_id: "gd1"
        },
        {
          id: "e11",
          name: "草堂康桥医疗器械有限公司",
          uscc: "91510105MA7I8J9K0L",
          industry: "生物医药",
          track: "新兴产业",
          address: "草堂科技产业园 2 栋",
          grid: "草堂街道-网格01",
          level: "规上",
          tags: [
            "高新技术",
            "研发驱动"
          ],
          kpis: {
            revenue_y: 1.5,
            tax_y: 0.12,
            employees: 170,
            r_and_d: 0.25
          },
          risk: {
            level: "低",
            score: 19,
            signals: [
              "三类证持续获批",
              "临床合作稳定"
            ]
          },
          ecosystem_role: [
            "医疗器械研发"
          ],
          products: [
            "介入诊疗导管",
            "微创手术器械"
          ],
          events: [
            {
              date: "2026-01-15",
              title: "获 NMPA 二类医疗器械注册证",
              type: "innovation"
            }
          ],
          building_id: "gb17",
          park_id: "gp7",
          street_id: "gs12",
          district_id: "gd1"
        },
        {
          id: "e12",
          name: "少城文创数字科技有限公司",
          uscc: "91510105MA8K9L0M1N",
          industry: "创新服务",
          track: "新兴产业",
          address: "宽巷子文创园 B 座 3F",
          grid: "少城街道-网格02",
          level: "规下",
          tags: [
            "数据服务",
            "研发驱动"
          ],
          kpis: {
            revenue_y: 0.4,
            tax_y: 0.02,
            employees: 42,
            r_and_d: 0.35
          },
          risk: {
            level: "低",
            score: 25,
            signals: [
              "融资到位",
              "团队快速扩张"
            ]
          },
          ecosystem_role: [
            "文创数字化"
          ],
          products: [
            "数字孪生展览",
            "AR 导览平台"
          ],
          events: [
            {
              date: "2025-10-18",
              title: "完成天使轮融资 800 万",
              type: "finance"
            }
          ],
          building_id: "gb16",
          street_id: "gs11",
          district_id: "gd1",
          park_id: "gp14"
        },
        {
          id: "e13",
          name: "光华云翼信息科技有限公司",
          uscc: "91510105MA9M0N1O2P",
          industry: "创新服务",
          track: "支柱产业",
          address: "光华国际大厦 15F",
          grid: "光华街道-网格01",
          level: "规上",
          tags: [
            "数据服务",
            "本地服务商"
          ],
          kpis: {
            revenue_y: 1.1,
            tax_y: 0.09,
            employees: 120,
            r_and_d: 0.2
          },
          risk: {
            level: "低",
            score: 20,
            signals: [
              "大客户续约率高",
              "应收账款健康"
            ]
          },
          ecosystem_role: [
            "云计算服务"
          ],
          products: [
            "混合云部署",
            "企业级 SaaS 平台"
          ],
          events: [
            {
              date: "2026-02-05",
              title: "入选成都市软件名企培育名单",
              type: "innovation"
            }
          ],
          building_id: "gb19",
          park_id: "gp8",
          street_id: "gs13",
          district_id: "gd1"
        },
        {
          id: "e14",
          name: "苏坡宏达机械制造有限公司",
          uscc: "91510105MA0P1Q2R3S",
          industry: "智能制造",
          track: "支柱产业",
          address: "苏坡工业集中区 5 号厂房",
          grid: "苏坡街道-网格03",
          level: "规上",
          tags: [
            "设备更新",
            "本地配套型"
          ],
          kpis: {
            revenue_y: 1.6,
            tax_y: 0.12,
            employees: 195,
            r_and_d: 0.06
          },
          risk: {
            level: "中",
            score: 52,
            signals: [
              "厂房租约即将到期",
              "设备老化率偏高"
            ]
          },
          ecosystem_role: [
            "机械加工"
          ],
          products: [
            "精密模具",
            "CNC 加工件"
          ],
          events: [
            {
              date: "2026-02-18",
              title: "提交设备更新贷申请",
              type: "finance"
            }
          ],
          building_id: "gb21",
          park_id: "gp9",
          street_id: "gs14",
          district_id: "gd1"
        },
        {
          id: "e15",
          name: "文家绿能环保科技有限公司",
          uscc: "91510105MA1R2S3T4U",
          industry: "智能制造",
          track: "新兴产业",
          address: "文家生态产业园 A 区",
          grid: "文家街道-网格01",
          level: "规下",
          tags: [
            "研发驱动",
            "技改需求"
          ],
          kpis: {
            revenue_y: 0.7,
            tax_y: 0.04,
            employees: 55,
            r_and_d: 0.3
          },
          risk: {
            level: "中",
            score: 40,
            signals: [
              "资质审批进度较慢",
              "现金流偏紧"
            ]
          },
          ecosystem_role: [
            "环保设备"
          ],
          products: [
            "工业废水处理设备",
            "VOC 治理系统"
          ],
          events: [
            {
              date: "2025-12-08",
              title: "获省级绿色工厂认定",
              type: "innovation"
            }
          ],
          building_id: "gb24",
          park_id: "gp10",
          street_id: "gs15",
          district_id: "gd1"
        },
        {
          id: "e16",
          name: "蜀信达物流管理有限公司",
          uscc: "91510105MA2T3U4V5W",
          industry: "现代商贸",
          track: "支柱产业",
          address: "苏坡物流园 B 区",
          grid: "苏坡街道-网格02",
          level: "规上",
          tags: [
            "供应链",
            "仓配一体"
          ],
          kpis: {
            revenue_y: 2.8,
            tax_y: 0.16,
            employees: 310,
            r_and_d: 0.01
          },
          risk: {
            level: "低",
            score: 28,
            signals: [
              "客户结构多元",
              "运力充足"
            ]
          },
          ecosystem_role: [
            "物流仓配"
          ],
          products: [
            "城配服务",
            "仓储管理"
          ],
          events: [
            {
              date: "2026-01-22",
              title: "新增冷链线路 3 条",
              type: "operate"
            }
          ],
          building_id: "gb23",
          park_id: "gp9",
          street_id: "gs14",
          district_id: "gd1"
        },
        {
          id: "e17",
          name: "草市街新消费品牌管理有限公司",
          uscc: "91510105MA3V4W5X6Y",
          industry: "现代商贸",
          track: "新兴产业",
          address: "太升商贸城 8F",
          grid: "草市街街道-网格01",
          level: "规下",
          tags: [
            "本地服务商"
          ],
          kpis: {
            revenue_y: 0.5,
            tax_y: 0.03,
            employees: 38,
            r_and_d: 0.05
          },
          risk: {
            level: "低",
            score: 30,
            signals: [
              "线上渠道增长快",
              "品牌孵化顺利"
            ]
          },
          ecosystem_role: [
            "品牌运营"
          ],
          products: [
            "新消费品牌代运营",
            "直播电商服务"
          ],
          events: [
            {
              date: "2025-11-30",
              title: "签约 3 个新消费品牌",
              type: "operate"
            }
          ],
          building_id: "gb14",
          street_id: "gs10",
          district_id: "gd1",
          park_id: "gp21"
        },
        {
          id: "e18",
          name: "太升路互联网金融信息服务有限公司",
          uscc: "91510105MA4X5Y6Z7A",
          industry: "创新服务",
          track: "生态机构",
          address: "太升金融中心 12F",
          grid: "西御河街道-网格01",
          level: "规上",
          tags: [
            "数据服务",
            "法律服务"
          ],
          kpis: {
            revenue_y: 0.8,
            tax_y: 0.06,
            employees: 85,
            r_and_d: 0.15
          },
          risk: {
            level: "低",
            score: 22,
            signals: [
              "监管合规良好",
              "牌照齐全"
            ]
          },
          ecosystem_role: [
            "金融科技"
          ],
          products: [
            "征信数据服务",
            "风控模型平台"
          ],
          events: [
            {
              date: "2026-02-20",
              title: "通过金融科技备案",
              type: "innovation"
            }
          ],
          building_id: "gb13",
          street_id: "gs9",
          district_id: "gd1",
          park_id: "gp22"
        },
        {
          id: "e19",
          name: "金沙芯元半导体有限公司",
          uscc: "91510105MA5Z6A7B8C",
          industry: "智能制造",
          track: "新兴产业",
          address: "金沙科创中心 A 座 11F",
          grid: "金沙街道-网格03",
          level: "规下",
          tags: [
            "高新技术",
            "专精特新",
            "研发驱动"
          ],
          kpis: {
            revenue_y: 0.5,
            tax_y: 0.02,
            employees: 48,
            r_and_d: 0.42
          },
          risk: {
            level: "中",
            score: 55,
            signals: [
              "研发投入大",
              "商业化进度待观察"
            ]
          },
          ecosystem_role: [
            "芯片设计"
          ],
          products: [
            "工业传感芯片",
            "物联网通信模组"
          ],
          events: [
            {
              date: "2026-01-28",
              title: "首款芯片流片成功",
              type: "innovation"
            }
          ],
          building_id: "gb1",
          park_id: "gp2",
          street_id: "gs1",
          district_id: "gd1"
        },
        {
          id: "e20",
          name: "府南安捷检测技术有限公司",
          uscc: "91510105MA6B7C8D9E",
          industry: "创新服务",
          track: "生态机构",
          address: "府南航空配套园 1 栋 D 区",
          grid: "府南街道-网格01",
          level: "规下",
          tags: [
            "本地服务商",
            "知识产权"
          ],
          kpis: {
            revenue_y: 0.3,
            tax_y: 0.02,
            employees: 32,
            r_and_d: 0.1
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "资质齐全",
              "客户覆盖面广"
            ]
          },
          ecosystem_role: [
            "服务机构"
          ],
          products: [
            "材料检测",
            "无损探伤",
            "认证咨询"
          ],
          events: [
            {
              date: "2025-12-15",
              title: "获 CNAS 实验室认可扩项",
              type: "innovation"
            }
          ],
          building_id: "gb3",
          park_id: "gp1",
          street_id: "gs2",
          district_id: "gd1"
        },
        {
          id: "e21",
          name: "草堂华源生物技术有限公司",
          uscc: "91510105MA7D8E9F0G",
          industry: "生物医药",
          track: "新兴产业",
          address: "草堂科技产业园 5 栋",
          grid: "草堂街道-网格02",
          level: "规下",
          tags: [
            "专精特新",
            "研发驱动"
          ],
          kpis: {
            revenue_y: 0.3,
            tax_y: 0.01,
            employees: 28,
            r_and_d: 0.5
          },
          risk: {
            level: "中",
            score: 60,
            signals: [
              "研发管线进展慢于预期",
              "B轮融资洽谈中"
            ]
          },
          ecosystem_role: [
            "研发",
            "CRO 合作"
          ],
          products: [
            "基因编辑工具",
            "分子诊断试剂"
          ],
          events: [
            {
              date: "2026-02-08",
              title: "与华西医院签署临床合作协议",
              type: "innovation"
            }
          ],
          building_id: "gb18",
          park_id: "gp7",
          street_id: "gs12",
          district_id: "gd1"
        },
        {
          id: "e22",
          name: "光华鼎盛企业管理咨询有限公司",
          uscc: "91510105MA8F9G0H1I",
          industry: "创新服务",
          track: "生态机构",
          address: "光华国际大厦 8F",
          grid: "光华街道-网格02",
          level: "服务机构",
          tags: [
            "法律服务",
            "本地服务商"
          ],
          kpis: {
            revenue_y: 0.15,
            tax_y: 0.01,
            employees: 14,
            r_and_d: 0
          },
          risk: {
            level: "低",
            score: 10,
            signals: [
              "口碑良好",
              "复购率高"
            ]
          },
          ecosystem_role: [
            "服务机构"
          ],
          products: [
            "企业战略咨询",
            "股权架构设计"
          ],
          events: [
            {
              date: "2025-10-25",
              title: "新增科创板上市辅导业务线",
              type: "service"
            }
          ],
          building_id: "gb19",
          park_id: "gp8",
          street_id: "gs13",
          district_id: "gd1"
        },
        {
          id: "e23",
          name: "文家青禾农业科技有限公司",
          uscc: "91510105MA9H0I1J2K",
          industry: "生物医药",
          track: "新兴产业",
          address: "文家生态产业园 C 区",
          grid: "文家街道-网格02",
          level: "规下",
          tags: [
            "研发驱动",
            "技改需求"
          ],
          kpis: {
            revenue_y: 0.4,
            tax_y: 0.02,
            employees: 36,
            r_and_d: 0.28
          },
          risk: {
            level: "低",
            score: 24,
            signals: [
              "政策扶持到位",
              "市场前景明确"
            ]
          },
          ecosystem_role: [
            "农业科技"
          ],
          products: [
            "植物源生物农药",
            "土壤检测服务"
          ],
          events: [
            {
              date: "2026-01-05",
              title: "获有机产品认证",
              type: "innovation"
            }
          ],
          building_id: "gb25",
          park_id: "gp10",
          street_id: "gs15",
          district_id: "gd1"
        },
        {
          id: "e24",
          name: "少城紫光会展服务有限公司",
          uscc: "91510105MA0J1K2L3M",
          industry: "现代商贸",
          track: "支柱产业",
          address: "宽巷子文创园 A 座 1F",
          grid: "少城街道-网格01",
          level: "规下",
          tags: [
            "本地服务商"
          ],
          kpis: {
            revenue_y: 0.35,
            tax_y: 0.02,
            employees: 25,
            r_and_d: 0.02
          },
          risk: {
            level: "低",
            score: 20,
            signals: [
              "行业回暖",
              "大型展会排期饱满"
            ]
          },
          ecosystem_role: [
            "会展服务"
          ],
          products: [
            "展会策划执行",
            "场馆运营管理"
          ],
          events: [
            {
              date: "2025-12-28",
              title: "承办区级产业对接会",
              type: "operate"
            }
          ],
          building_id: "gb15",
          street_id: "gs11",
          district_id: "gd1",
          park_id: "gp14"
        },
        {
          id: "e25",
          name: "金沙博锐自动化设备有限公司",
          uscc: "91510105MA1L2M3N4O",
          industry: "智能制造",
          track: "支柱产业",
          address: "金沙科创中心 A 座 3F",
          grid: "金沙街道-网格01",
          level: "规上",
          tags: [
            "设备更新",
            "本地配套型"
          ],
          kpis: {
            revenue_y: 1.4,
            tax_y: 0.11,
            employees: 155,
            r_and_d: 0.12
          },
          risk: {
            level: "低",
            score: 23,
            signals: [
              "复购客户占比高",
              "产能利用率高"
            ]
          },
          ecosystem_role: [
            "自动化设备"
          ],
          products: [
            "工业机器人集成",
            "产线自动化改造"
          ],
          events: [
            {
              date: "2026-02-12",
              title: "新增发明专利 3 项",
              type: "innovation"
            }
          ],
          building_id: "gb1",
          park_id: "gp2",
          street_id: "gs1",
          district_id: "gd1"
        },
        {
          id: "e26",
          name: "草堂益民医药连锁有限公司",
          uscc: "91510105MA2N3O4P5Q",
          industry: "现代商贸",
          track: "支柱产业",
          address: "草堂北路 56 号",
          grid: "草堂街道-网格03",
          level: "规上",
          tags: [
            "供应链"
          ],
          kpis: {
            revenue_y: 4.2,
            tax_y: 0.22,
            employees: 520,
            r_and_d: 0.01
          },
          risk: {
            level: "低",
            score: 15,
            signals: [
              "门店扩张稳健",
              "GSP 认证完备"
            ]
          },
          ecosystem_role: [
            "医药流通"
          ],
          products: [
            "零售药房",
            "B2B 药品配送"
          ],
          events: [
            {
              date: "2026-01-18",
              title: "新开门店 5 家",
              type: "operate"
            }
          ],
          street_id: "gs12",
          district_id: "gd1",
          park_id: "gp7",
          building_id: "gbs007"
        },
        {
          id: "e27",
          name: "苏坡云仓智慧物流有限公司",
          uscc: "91510105MA3P4Q5R6S",
          industry: "现代商贸",
          track: "新兴产业",
          address: "苏坡物流园 A 区 2 号库",
          grid: "苏坡街道-网格01",
          level: "规下",
          tags: [
            "数据服务",
            "供应链"
          ],
          kpis: {
            revenue_y: 0.6,
            tax_y: 0.03,
            employees: 45,
            r_and_d: 0.18
          },
          risk: {
            level: "低",
            score: 26,
            signals: [
              "技术壁垒高",
              "合作伙伴增加"
            ]
          },
          ecosystem_role: [
            "物流科技"
          ],
          products: [
            "智能分拣系统",
            "仓储 WMS 平台"
          ],
          events: [
            {
              date: "2025-11-12",
              title: "完成 Pre-A 轮融资",
              type: "finance"
            }
          ],
          building_id: "gb22",
          park_id: "gp9",
          street_id: "gs14",
          district_id: "gd1"
        },
        {
          id: "e28",
          name: "太升路恒信会计师事务所",
          uscc: "91510105MA4R5S6T7U",
          industry: "创新服务",
          track: "生态机构",
          address: "太升金融中心 6F",
          grid: "西御河街道-网格02",
          level: "服务机构",
          tags: [
            "法律服务",
            "知识产权"
          ],
          kpis: {
            revenue_y: 0.25,
            tax_y: 0.01,
            employees: 22,
            r_and_d: 0
          },
          risk: {
            level: "低",
            score: 8,
            signals: [
              "执业记录良好",
              "客户基础稳定"
            ]
          },
          ecosystem_role: [
            "服务机构"
          ],
          products: [
            "审计验资",
            "税务筹划",
            "IPO 审计"
          ],
          events: [
            {
              date: "2026-02-25",
              title: "签约 2 家科创板拟上市企业",
              type: "service"
            }
          ],
          building_id: "gb13",
          street_id: "gs9",
          district_id: "gd1",
          park_id: "gp22"
        },
        {
          id: "e29",
          name: "府南翔宇无人机科技有限公司",
          uscc: "91510105MA5T6U7V8W",
          industry: "智能制造",
          track: "新兴产业",
          address: "青羊工业载体 B 区 1 号楼",
          grid: "府南街道-网格04",
          level: "规下",
          tags: [
            "高新技术",
            "专精特新",
            "研发驱动"
          ],
          kpis: {
            revenue_y: 0.8,
            tax_y: 0.04,
            employees: 62,
            r_and_d: 0.38
          },
          risk: {
            level: "低",
            score: 27,
            signals: [
              "订单增速快",
              "空域政策利好"
            ]
          },
          ecosystem_role: [
            "无人机研发"
          ],
          products: [
            "工业巡检无人机",
            "农业植保无人机"
          ],
          events: [
            {
              date: "2026-03-01",
              title: "获民航局适航证",
              type: "innovation"
            }
          ],
          building_id: "gb4",
          park_id: "gp1",
          street_id: "gs2",
          district_id: "gd1"
        },
        {
          id: "e30",
          name: "金沙瑞康中医药研发有限公司",
          uscc: "91510105MA6V7W8X9Y",
          industry: "生物医药",
          track: "新兴产业",
          address: "西城智谷 2 号楼 10F",
          grid: "金沙街道-网格02",
          level: "规下",
          tags: [
            "专精特新",
            "研发驱动"
          ],
          kpis: {
            revenue_y: 0.35,
            tax_y: 0.01,
            employees: 30,
            r_and_d: 0.45
          },
          risk: {
            level: "中",
            score: 48,
            signals: [
              "研发周期长",
              "注册审批不确定"
            ]
          },
          ecosystem_role: [
            "中药研发"
          ],
          products: [
            "中药配方颗粒",
            "中药新药研发"
          ],
          events: [
            {
              date: "2025-12-22",
              title: "IND 申请获受理",
              type: "innovation"
            }
          ],
          building_id: "gb2",
          park_id: "gp2",
          street_id: "gs1",
          district_id: "gd1"
        },
        {
          id: "e31",
          name: "成都智航飞控科技有限公司",
          uscc: "91510100MA6ZH31A1A",
          industry: "智能制造",
          track: "新兴产业",
          address: "青羊经开区创新大道 18 号 A2",
          grid: "青羊经开区-网格02",
          level: "规下",
          tags: [
            "高新技术",
            "专精特新",
            "研发驱动"
          ],
          kpis: {
            revenue_y: 0.92,
            tax_y: 0.05,
            employees: 86,
            r_and_d: 0.36
          },
          risk: {
            level: "低",
            score: 22,
            signals: [
              "飞控产品迭代稳定",
              "适航协同推进中"
            ]
          },
          ecosystem_role: [
            "飞控导航",
            "通信链路",
            "航电系统（导航、飞控、通信、控制）"
          ],
          products: [
            "飞控导航",
            "通信链路",
            "惯导控制器",
            "航电系统（导航、飞控、通信、控制）"
          ],
          events: [
            {
              date: "2026-03-08",
              title: "完成新一代飞控板卡定型",
              type: "innovation"
            }
          ],
          park_id: "gp1",
          street_id: "gs2",
          district_id: "gd1",
          building_id: "gbs008"
        },
        {
          id: "e32",
          name: "西部续航能源材料有限公司",
          uscc: "91510100MA6ZH32B2B",
          industry: "智能制造",
          track: "新兴产业",
          address: "武侯智造园新材路 6 号",
          grid: "武侯街道-网格04",
          level: "规上",
          tags: [
            "本地配套",
            "材料研发"
          ],
          kpis: {
            revenue_y: 1.84,
            tax_y: 0.14,
            employees: 168,
            r_and_d: 0.18
          },
          risk: {
            level: "低",
            score: 19,
            signals: [
              "长单占比高",
              "订单稳定"
            ]
          },
          ecosystem_role: [
            "金属材料（铝合金、钛合金、复材）",
            "复合材料（树脂、橡胶、陶瓷、碳纤维）",
            "化工材料（隐身涂料、胶黏剂）",
            "电池材料"
          ],
          products: [
            "铝合金薄板",
            "钛合金结构件",
            "碳纤维预浸料",
            "隐身涂料",
            "胶黏剂",
            "电池材料"
          ],
          events: [
            {
              date: "2026-02-18",
              title: "复材新线投产",
              type: "operate"
            }
          ],
          park_id: "gp4",
          street_id: "gs5",
          district_id: "gd3",
          building_id: "gbs009"
        },
        {
          id: "e33",
          name: "成都适航标准技术服务有限公司",
          uscc: "91510100MA6ZH33C3C",
          industry: "创新服务",
          track: "生态机构",
          address: "青羊总部基地标准楼 9F",
          grid: "黄田坝街道-网格03",
          level: "服务机构",
          tags: [
            "检验检测",
            "合规服务"
          ],
          kpis: {
            revenue_y: 0.41,
            tax_y: 0.03,
            employees: 44,
            r_and_d: 0.06
          },
          risk: {
            level: "低",
            score: 12,
            signals: [
              "客户续签率高",
              "监管沟通顺畅"
            ]
          },
          ecosystem_role: [
            "运行标准",
            "适航要求",
            "空域规则",
            "测试认证",
            "试验与检测服务"
          ],
          products: [
            "运行标准",
            "适航要求",
            "空域规则",
            "测试认证",
            "试验与检测服务"
          ],
          events: [
            {
              date: "2026-03-01",
              title: "新增低空适航咨询项目 7 个",
              type: "service"
            }
          ],
          street_id: "gs22",
          district_id: "gd1",
          park_id: "gp15",
          building_id: "gbs010"
        },
        {
          id: "e34",
          name: "成都航电任务系统有限公司",
          uscc: "91510100MA6ZH34D4D",
          industry: "智能制造",
          track: "新兴产业",
          address: "成华航空科创港 3 栋",
          grid: "府青路街道-网格05",
          level: "规下",
          tags: [
            "链主配套",
            "场景验证"
          ],
          kpis: {
            revenue_y: 0.77,
            tax_y: 0.04,
            employees: 73,
            r_and_d: 0.31
          },
          risk: {
            level: "中",
            score: 38,
            signals: [
              "验证周期偏长",
              "订单增长较快"
            ]
          },
          ecosystem_role: [
            "任务系统（感知、识别、协同）",
            "光电吊舱"
          ],
          products: [
            "任务系统（感知、识别、协同）",
            "光电吊舱",
            "多机协同载荷"
          ],
          events: [
            {
              date: "2026-02-27",
              title: "任务载荷样机完成联调",
              type: "innovation"
            }
          ],
          street_id: "gs30",
          district_id: "gd4",
          park_id: "gp27",
          building_id: "gbs011"
        },
        {
          id: "e35",
          name: "西南无人机整机制造有限公司",
          uscc: "91510100MA6ZH35E5E",
          industry: "智能制造",
          track: "支柱产业",
          address: "青羊经开区腾飞路 88 号",
          grid: "苏坡街道-网格02",
          level: "规上",
          tags: [
            "链主",
            "本地配套",
            "高成长型"
          ],
          kpis: {
            revenue_y: 3.26,
            tax_y: 0.26,
            employees: 312,
            r_and_d: 0.17
          },
          risk: {
            level: "低",
            score: 21,
            signals: [
              "整机订单饱满",
              "外协体系成熟"
            ]
          },
          ecosystem_role: [
            "整机制造",
            "系统集成",
            "中大型长航时",
            "中小型",
            "民参军中小型"
          ],
          products: [
            "整机制造",
            "系统集成",
            "中大型长航时",
            "中小型",
            "民参军中小型"
          ],
          events: [
            {
              date: "2026-03-06",
              title: "新一代长航时无人机首飞",
              type: "innovation"
            }
          ],
          park_id: "gp1",
          street_id: "gs2",
          district_id: "gd1",
          building_id: "gbs012"
        },
        {
          id: "e36",
          name: "成都航空精密验证有限公司",
          uscc: "91510100MA6ZH36F6F",
          industry: "创新服务",
          track: "生态机构",
          address: "青羊航空研发楼 6F",
          grid: "草堂街道-网格01",
          level: "服务机构",
          tags: [
            "研发外包",
            "试验检测"
          ],
          kpis: {
            revenue_y: 0.36,
            tax_y: 0.02,
            employees: 38,
            r_and_d: 0.09
          },
          risk: {
            level: "低",
            score: 16,
            signals: [
              "项目型收入稳定",
              "客户粘性较高"
            ]
          },
          ecosystem_role: [
            "项目论证（详细设计）",
            "方案设计（试制与验证）",
            "初步设计",
            "研发设计外包",
            "试验与检测服务"
          ],
          products: [
            "项目论证（详细设计）",
            "方案设计（试制与验证）",
            "初步设计",
            "研发设计外包",
            "试验与检测服务"
          ],
          events: [
            {
              date: "2026-02-22",
              title: "联合实验室开放试运行",
              type: "service"
            }
          ],
          street_id: "gs12",
          district_id: "gd1",
          park_id: "gp7",
          building_id: "gbs013"
        },
        {
          id: "e37",
          name: "西部机体动力总成科技有限公司",
          uscc: "91510100MA6ZH37G7G",
          industry: "智能制造",
          track: "支柱产业",
          address: "成华航空配套园 12 号",
          grid: "双桥子街道-网格03",
          level: "规上",
          tags: [
            "精密制造",
            "本地配套"
          ],
          kpis: {
            revenue_y: 2.18,
            tax_y: 0.17,
            employees: 204,
            r_and_d: 0.13
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "主机厂订单稳定",
              "设备稼动率较高"
            ]
          },
          ecosystem_role: [
            "机身、机翼、尾翼、起落架、吊舱挂架",
            "动力系统（活塞、涡扇、涡轴、发动机制电）"
          ],
          products: [
            "机身",
            "机翼",
            "尾翼",
            "起落架",
            "吊舱挂架",
            "动力系统（活塞、涡扇、涡轴、发动机制电）"
          ],
          events: [
            {
              date: "2026-02-10",
              title: "机体结构件产线完成扩能",
              type: "operate"
            }
          ],
          street_id: "gs8",
          district_id: "gd4",
          park_id: "gp6",
          building_id: "gbs014"
        },
        {
          id: "e38",
          name: "低空城市配送运营有限公司",
          uscc: "91510100MA6ZH38H8H",
          industry: "现代商贸",
          track: "新兴产业",
          address: "锦江智慧物流港 2 号楼",
          grid: "书院街街道-网格02",
          level: "规下",
          tags: [
            "低空物流",
            "场景运营"
          ],
          kpis: {
            revenue_y: 0.69,
            tax_y: 0.03,
            employees: 58,
            r_and_d: 0.11
          },
          risk: {
            level: "中",
            score: 41,
            signals: [
              "试点线路扩张快",
              "履约成本待优化"
            ]
          },
          ecosystem_role: [
            "物流配送",
            "应急巡检",
            "城市治理",
            "服务收入",
            "运营效率",
            "场景复制"
          ],
          products: [
            "物流配送",
            "应急巡检",
            "城市治理",
            "服务收入",
            "运营效率",
            "场景复制"
          ],
          events: [
            {
              date: "2026-03-03",
              title: "新增 4 条低空配送航线",
              type: "operate"
            }
          ],
          street_id: "gs4",
          district_id: "gd2",
          park_id: "gp3",
          building_id: "gbs015"
        },
        {
          id: "e39",
          name: "天府低空运维保障有限公司",
          uscc: "91510100MA6ZH39J9J",
          industry: "创新服务",
          track: "新兴产业",
          address: "武侯低空服务中心 5F",
          grid: "红牌楼街道-网格04",
          level: "服务机构",
          tags: [
            "运维服务",
            "安全保障"
          ],
          kpis: {
            revenue_y: 0.33,
            tax_y: 0.02,
            employees: 31,
            r_and_d: 0.07
          },
          risk: {
            level: "低",
            score: 14,
            signals: [
              "服务续约率高",
              "维保工单稳定"
            ]
          },
          ecosystem_role: [
            "调度平台",
            "安全监测",
            "运维保障"
          ],
          products: [
            "调度平台",
            "安全监测",
            "运维保障"
          ],
          events: [
            {
              date: "2026-02-26",
              title: "低空运维监测平台二期上线",
              type: "operate"
            }
          ],
          street_id: "gs19",
          district_id: "gd3",
          park_id: "gp12",
          building_id: "gbs016"
        },
        {
          id: "e40",
          name: "成都算力芯片科技有限公司",
          uscc: "91510100MA6ZH40K0K",
          industry: "智能制造",
          track: "新兴产业",
          address: "武侯智算谷 1 栋 12F",
          grid: "桂溪街道-网格03",
          level: "规下",
          tags: [
            "高新技术",
            "算力基础设施"
          ],
          kpis: {
            revenue_y: 1.02,
            tax_y: 0.07,
            employees: 94,
            r_and_d: 0.42
          },
          risk: {
            level: "中",
            score: 36,
            signals: [
              "研发投入较高",
              "芯片流片周期长"
            ]
          },
          ecosystem_role: [
            "算力芯片",
            "云平台",
            "数据资源"
          ],
          products: [
            "算力芯片",
            "云平台",
            "数据资源"
          ],
          events: [
            {
              date: "2026-03-04",
              title: "训练加速芯片进入测试",
              type: "innovation"
            }
          ],
          street_id: "gs29",
          district_id: "gd3",
          park_id: "gp17",
          building_id: "gbs017"
        },
        {
          id: "e41",
          name: "西部模型工程平台有限公司",
          uscc: "91510100MA6ZH41L1L",
          industry: "创新服务",
          track: "新兴产业",
          address: "武侯AI中试楼 8F",
          grid: "芳草街街道-网格02",
          level: "规下",
          tags: [
            "平台服务",
            "算法工程"
          ],
          kpis: {
            revenue_y: 0.58,
            tax_y: 0.03,
            employees: 67,
            r_and_d: 0.28
          },
          risk: {
            level: "低",
            score: 23,
            signals: [
              "项目交付节奏稳定",
              "复购客户增加"
            ]
          },
          ecosystem_role: [
            "训练框架",
            "推理引擎",
            "MLOps",
            "模型服务"
          ],
          products: [
            "训练框架",
            "推理引擎",
            "MLOps",
            "模型服务"
          ],
          events: [
            {
              date: "2026-02-21",
              title: "新模型部署平台完成升级",
              type: "operate"
            }
          ],
          street_id: "gs28",
          district_id: "gd3",
          park_id: "gp19",
          building_id: "gbs018"
        },
        {
          id: "e42",
          name: "蓉云多模态智能有限公司",
          uscc: "91510100MA6ZH42M2M",
          industry: "创新服务",
          track: "新兴产业",
          address: "高新孵化园 B 座 15F",
          grid: "桂溪街道-网格05",
          level: "规下",
          tags: [
            "大模型",
            "高成长型"
          ],
          kpis: {
            revenue_y: 0.73,
            tax_y: 0.04,
            employees: 79,
            r_and_d: 0.39
          },
          risk: {
            level: "中",
            score: 35,
            signals: [
              "算力成本较高",
              "项目验证周期较长"
            ]
          },
          ecosystem_role: [
            "通用模型",
            "行业模型",
            "多模态模型"
          ],
          products: [
            "通用模型",
            "行业模型",
            "多模态模型"
          ],
          events: [
            {
              date: "2026-03-07",
              title: "多模态模型完成政务场景适配",
              type: "innovation"
            }
          ],
          street_id: "gs29",
          district_id: "gd3",
          park_id: "gp17",
          building_id: "gbs019"
        },
        {
          id: "e43",
          name: "城智政务智能服务有限公司",
          uscc: "91510100MA6ZH43N3N",
          industry: "创新服务",
          track: "新兴产业",
          address: "天府软件园政务楼 10F",
          grid: "桂溪街道-网格01",
          level: "规下",
          tags: [
            "政务场景",
            "企业服务"
          ],
          kpis: {
            revenue_y: 0.47,
            tax_y: 0.02,
            employees: 52,
            r_and_d: 0.24
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "场景复制加快",
              "合同续签率高"
            ]
          },
          ecosystem_role: [
            "模型服务",
            "知识库",
            "Agent编排",
            "政务服务",
            "企业运营",
            "金融风控"
          ],
          products: [
            "模型服务",
            "知识库",
            "Agent编排",
            "政务服务",
            "企业运营",
            "金融风控"
          ],
          events: [
            {
              date: "2026-02-29",
              title: "上线区县级智能问答项目",
              type: "service"
            }
          ],
          street_id: "gs29",
          district_id: "gd3",
          park_id: "gp17",
          building_id: "gbs020"
        },
        {
          id: "e44",
          name: "成都数据资源运营有限公司",
          uscc: "91510100MA6ZH44P4P",
          industry: "创新服务",
          track: "生态机构",
          address: "武侯数据街 2 号",
          grid: "玉林街道-网格03",
          level: "服务机构",
          tags: [
            "数据运营",
            "资源整合"
          ],
          kpis: {
            revenue_y: 0.64,
            tax_y: 0.05,
            employees: 61,
            r_and_d: 0.16
          },
          risk: {
            level: "低",
            score: 17,
            signals: [
              "数据资源池扩容",
              "合作机构增加"
            ]
          },
          ecosystem_role: [
            "数据资源",
            "知识库",
            "信息与技术服务",
            "数字化转型服务"
          ],
          products: [
            "数据资源",
            "知识库",
            "信息与技术服务",
            "数字化转型服务"
          ],
          events: [
            {
              date: "2026-03-02",
              title: "新增 6 类行业数据集",
              type: "operate"
            }
          ],
          street_id: "gs27",
          district_id: "gd3",
          park_id: "gp23",
          building_id: "gbs021"
        },
        {
          id: "e45",
          name: "融智风控科技有限公司",
          uscc: "91510100MA6ZH45Q5Q",
          industry: "创新服务",
          track: "新兴产业",
          address: "锦江金融城 18 层",
          grid: "东大街街道-网格02",
          level: "规下",
          tags: [
            "金融科技",
            "风控模型"
          ],
          kpis: {
            revenue_y: 0.53,
            tax_y: 0.04,
            employees: 48,
            r_and_d: 0.22
          },
          risk: {
            level: "低",
            score: 20,
            signals: [
              "银行合作增加",
              "模型命中率提升"
            ]
          },
          ecosystem_role: [
            "数据风控",
            "风险缓释",
            "金融风控",
            "风险控制"
          ],
          products: [
            "数据风控",
            "风险缓释",
            "金融风控",
            "风险控制"
          ],
          events: [
            {
              date: "2026-02-16",
              title: "园区信用模型完成迭代",
              type: "innovation"
            }
          ],
          street_id: "gs23",
          district_id: "gd2",
          park_id: "gp18",
          building_id: "gbs022"
        },
        {
          id: "e46",
          name: "锦城沉浸文旅运营有限公司",
          uscc: "91510100MA6ZH46R6R",
          industry: "现代商贸",
          track: "支柱产业",
          address: "宽窄巷子文旅运营中心",
          grid: "少城街道-网格01",
          level: "规上",
          tags: [
            "夜间经济",
            "文旅运营"
          ],
          kpis: {
            revenue_y: 1.46,
            tax_y: 0.1,
            employees: 126,
            r_and_d: 0.07
          },
          risk: {
            level: "低",
            score: 24,
            signals: [
              "客流恢复明显",
              "活动档期饱满"
            ]
          },
          ecosystem_role: [
            "沉浸体验",
            "场馆运营",
            "活动运营",
            "景区",
            "街区",
            "夜间经济"
          ],
          products: [
            "沉浸体验",
            "场馆运营",
            "活动运营",
            "景区",
            "街区",
            "夜间经济"
          ],
          events: [
            {
              date: "2026-03-01",
              title: "夜游项目单月客流创新高",
              type: "operate"
            }
          ],
          street_id: "gs11",
          district_id: "gd1",
          park_id: "gp14",
          building_id: "gbs023"
        },
        {
          id: "e47",
          name: "锦江票务内容平台有限公司",
          uscc: "91510100MA6ZH47S7S",
          industry: "现代商贸",
          track: "支柱产业",
          address: "春熙路新媒体中心 11F",
          grid: "春熙路街道-网格03",
          level: "规下",
          tags: [
            "平台运营",
            "内容分发"
          ],
          kpis: {
            revenue_y: 0.88,
            tax_y: 0.06,
            employees: 82,
            r_and_d: 0.14
          },
          risk: {
            level: "低",
            score: 21,
            signals: [
              "活跃用户上升",
              "票务转化稳定"
            ]
          },
          ecosystem_role: [
            "票务平台",
            "内容平台",
            "用户运营",
            "门票收入",
            "口碑传播",
            "复游率"
          ],
          products: [
            "票务平台",
            "内容平台",
            "用户运营",
            "门票收入",
            "口碑传播",
            "复游率"
          ],
          events: [
            {
              date: "2026-02-28",
              title: "完成城市文旅票务聚合接入",
              type: "operate"
            }
          ],
          street_id: "gs3",
          district_id: "gd2",
          park_id: "gp3",
          building_id: "gbs024"
        },
        {
          id: "e48",
          name: "少城非遗文创发展有限公司",
          uscc: "91510100MA6ZH48T8T",
          industry: "现代商贸",
          track: "支柱产业",
          address: "少城国际文创谷 3 号楼",
          grid: "少城街道-网格03",
          level: "规下",
          tags: [
            "非遗活化",
            "文创开发"
          ],
          kpis: {
            revenue_y: 0.52,
            tax_y: 0.03,
            employees: 46,
            r_and_d: 0.12
          },
          risk: {
            level: "低",
            score: 19,
            signals: [
              "联名项目增多",
              "渠道拓展顺利"
            ]
          },
          ecosystem_role: [
            "非遗资源",
            "历史文化",
            "联名文创",
            "文创消费",
            "城市品牌"
          ],
          products: [
            "非遗资源",
            "历史文化",
            "联名文创",
            "文创消费",
            "城市品牌"
          ],
          events: [
            {
              date: "2026-02-24",
              title: "联名文创系列上线",
              type: "operate"
            }
          ],
          street_id: "gs11",
          district_id: "gd1",
          park_id: "gp14",
          building_id: "gbs025"
        },
        {
          id: "e49",
          name: "锦官数字采集制作有限公司",
          uscc: "91510100MA6ZH49U9U",
          industry: "创新服务",
          track: "支柱产业",
          address: "成华数字文博基地 4 栋",
          grid: "猛追湾街道-网格02",
          level: "规下",
          tags: [
            "数字文博",
            "沉浸制作"
          ],
          kpis: {
            revenue_y: 0.61,
            tax_y: 0.03,
            employees: 57,
            r_and_d: 0.19
          },
          risk: {
            level: "低",
            score: 23,
            signals: [
              "文博订单增加",
              "内容制作效率提升"
            ]
          },
          ecosystem_role: [
            "数字采集",
            "虚拟制作",
            "互动系统",
            "数字渲染",
            "AR/VR"
          ],
          products: [
            "数字采集",
            "虚拟制作",
            "互动系统",
            "数字渲染",
            "AR/VR"
          ],
          events: [
            {
              date: "2026-03-05",
              title: "完成历史街区数字采集项目",
              type: "innovation"
            }
          ],
          street_id: "gs31",
          district_id: "gd4",
          park_id: "gp20",
          building_id: "gbs026"
        },
        {
          id: "e50",
          name: "城市线路主题策划有限公司",
          uscc: "91510100MA6ZH50V0V",
          industry: "现代商贸",
          track: "支柱产业",
          address: "锦江文旅策划中心 7F",
          grid: "盐市口街道-网格04",
          level: "规下",
          tags: [
            "主题策划",
            "产品开发"
          ],
          kpis: {
            revenue_y: 0.44,
            tax_y: 0.02,
            employees: 34,
            r_and_d: 0.11
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "项目交付稳定",
              "渠道合作扩大"
            ]
          },
          ecosystem_role: [
            "文化IP",
            "主题策划",
            "线路产品",
            "主题活动",
            "演艺项目"
          ],
          products: [
            "文化IP",
            "主题策划",
            "线路产品",
            "主题活动",
            "演艺项目"
          ],
          events: [
            {
              date: "2026-02-20",
              title: "推出春季主题线路产品",
              type: "operate"
            }
          ],
          street_id: "gs24",
          district_id: "gd2",
          park_id: "gp24",
          building_id: "gbs027"
        },
        {
          id: "e51",
          name: "蓉城旅服品牌传播有限公司",
          uscc: "91510100MA6ZH51W1W",
          industry: "现代商贸",
          track: "支柱产业",
          address: "锦江媒体港 9F",
          grid: "合江亭街道-网格01",
          level: "规下",
          tags: [
            "品牌营销",
            "文旅传播"
          ],
          kpis: {
            revenue_y: 0.39,
            tax_y: 0.02,
            employees: 29,
            r_and_d: 0.09
          },
          risk: {
            level: "低",
            score: 15,
            signals: [
              "品牌项目续单",
              "媒体曝光增加"
            ]
          },
          ecosystem_role: [
            "游客消费",
            "衍生消费",
            "品牌传播",
            "城市品牌",
            "口碑传播"
          ],
          products: [
            "游客消费",
            "衍生消费",
            "品牌传播",
            "城市品牌",
            "口碑传播"
          ],
          events: [
            {
              date: "2026-02-15",
              title: "完成城市文旅传播季度投放",
              type: "service"
            }
          ],
          street_id: "gs16",
          district_id: "gd2",
          park_id: "gp11",
          building_id: "gbs028"
        },
        {
          id: "e52",
          name: "天府科技金融服务有限公司",
          uscc: "91510100MA6ZH52X2X",
          industry: "创新服务",
          track: "生态机构",
          address: "金融城南塔 22F",
          grid: "东大街街道-网格05",
          level: "服务机构",
          tags: [
            "科技金融",
            "政银协同"
          ],
          kpis: {
            revenue_y: 0.71,
            tax_y: 0.05,
            employees: 63,
            r_and_d: 0.05
          },
          risk: {
            level: "低",
            score: 14,
            signals: [
              "白名单业务增长",
              "风控表现稳定"
            ]
          },
          ecosystem_role: [
            "供应链融资",
            "风险缓释",
            "数据风控",
            "财会与金融服务"
          ],
          products: [
            "供应链融资",
            "风险缓释",
            "数据风控",
            "财会与金融服务"
          ],
          events: [
            {
              date: "2026-03-09",
              title: "联合银行推出园区专项贷",
              type: "finance"
            }
          ],
          street_id: "gs23",
          district_id: "gd2",
          park_id: "gp18",
          building_id: "gbs029"
        },
        {
          id: "e53",
          name: "锦融产融运营有限公司",
          uscc: "91510100MA6ZH53Y3Y",
          industry: "创新服务",
          track: "生态机构",
          address: "青羊产融中心 15F",
          grid: "府南街道-网格02",
          level: "服务机构",
          tags: [
            "产融对接",
            "活动组织"
          ],
          kpis: {
            revenue_y: 0.34,
            tax_y: 0.02,
            employees: 28,
            r_and_d: 0.03
          },
          risk: {
            level: "低",
            score: 13,
            signals: [
              "合作方稳定",
              "活动转化改善"
            ]
          },
          ecosystem_role: [
            "线路产品",
            "沉浸体验",
            "联名文创",
            "场馆运营",
            "活动运营",
            "内容运营"
          ],
          products: [
            "线路产品",
            "沉浸体验",
            "联名文创",
            "场馆运营",
            "活动运营",
            "内容运营"
          ],
          events: [
            {
              date: "2026-02-25",
              title: "完成政银企对接活动 3 场",
              type: "service"
            }
          ],
          street_id: "gs2",
          district_id: "gd1",
          park_id: "gp1",
          building_id: "gbs030"
        },
        {
          id: "e54",
          name: "城市消费金融场景服务有限公司",
          uscc: "91510100MA6ZH54Z4Z",
          industry: "创新服务",
          track: "生态机构",
          address: "锦江商圈服务楼 12F",
          grid: "春熙路街道-网格05",
          level: "服务机构",
          tags: [
            "场景金融",
            "零售协同"
          ],
          kpis: {
            revenue_y: 0.49,
            tax_y: 0.03,
            employees: 36,
            r_and_d: 0.04
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "场景覆盖提升",
              "回款稳定"
            ]
          },
          ecosystem_role: [
            "景区",
            "街区",
            "商圈",
            "门票收入",
            "衍生消费",
            "品牌传播"
          ],
          products: [
            "景区",
            "街区",
            "商圈",
            "门票收入",
            "衍生消费",
            "品牌传播"
          ],
          events: [
            {
              date: "2026-03-03",
              title: "商圈消费金融产品上线",
              type: "finance"
            }
          ],
          street_id: "gs3",
          district_id: "gd2",
          park_id: "gp3",
          building_id: "gbs031"
        },
        {
          id: "e55",
          name: "春熙数字商贸科技有限公司",
          uscc: "91510100MA6ZH55A5A",
          industry: "现代商贸",
          track: "支柱产业",
          address: "春熙路数字商业大厦 13F",
          grid: "春熙路街道-网格02",
          level: "规上",
          tags: [
            "数字零售",
            "高成长型"
          ],
          kpis: {
            revenue_y: 2.06,
            tax_y: 0.15,
            employees: 188,
            r_and_d: 0.1
          },
          risk: {
            level: "低",
            score: 22,
            signals: [
              "线上订单稳定增长",
              "会员转化率提升"
            ]
          },
          ecosystem_role: [
            "ERP",
            "订单中台",
            "流量运营",
            "会员体系",
            "电商渠道"
          ],
          products: [
            "ERP",
            "订单中台",
            "流量运营",
            "会员体系",
            "电商渠道"
          ],
          events: [
            {
              date: "2026-03-06",
              title: "全渠道会员中台上线",
              type: "operate"
            }
          ],
          street_id: "gs3",
          district_id: "gd2",
          park_id: "gp3",
          building_id: "gbs032"
        },
        {
          id: "e56",
          name: "西部智仓供应链有限公司",
          uscc: "91510100MA6ZH56B6B",
          industry: "现代商贸",
          track: "支柱产业",
          address: "国际铁路港智慧仓配园",
          grid: "驷马桥街道-网格04",
          level: "规上",
          tags: [
            "仓配一体",
            "履约网络"
          ],
          kpis: {
            revenue_y: 1.68,
            tax_y: 0.11,
            employees: 146,
            r_and_d: 0.08
          },
          risk: {
            level: "低",
            score: 20,
            signals: [
              "仓配协同改善",
              "时效表现提升"
            ]
          },
          ecosystem_role: [
            "仓配系统",
            "仓储分拨",
            "末端配送",
            "售后服务",
            "供应链管理服务"
          ],
          products: [
            "仓配系统",
            "仓储分拨",
            "末端配送",
            "售后服务",
            "供应链管理服务"
          ],
          events: [
            {
              date: "2026-02-19",
              title: "新增西南区域分拨中心",
              type: "operate"
            }
          ],
          street_id: "gs33",
          district_id: "gd4",
          park_id: "gp25",
          building_id: "gbs033"
        },
        {
          id: "e57",
          name: "锦城品牌渠道服务有限公司",
          uscc: "91510100MA6ZH57C7C",
          industry: "现代商贸",
          track: "支柱产业",
          address: "锦江品牌港 6F",
          grid: "牛市口街道-网格01",
          level: "规下",
          tags: [
            "渠道拓展",
            "平台招商"
          ],
          kpis: {
            revenue_y: 0.74,
            tax_y: 0.05,
            employees: 64,
            r_and_d: 0.06
          },
          risk: {
            level: "低",
            score: 17,
            signals: [
              "平台招商项目增加",
              "品牌合作稳定"
            ]
          },
          ecosystem_role: [
            "品牌商",
            "渠道商",
            "平台招商",
            "流量运营"
          ],
          products: [
            "品牌商",
            "渠道商",
            "平台招商",
            "流量运营"
          ],
          events: [
            {
              date: "2026-03-02",
              title: "完成重点商圈品牌招引专场",
              type: "service"
            }
          ],
          street_id: "gs17",
          district_id: "gd2",
          park_id: "gp28",
          building_id: "gbs034"
        },
        {
          id: "e58",
          name: "成华商圈零售运营有限公司",
          uscc: "91510100MA6ZH58D8D",
          industry: "现代商贸",
          track: "支柱产业",
          address: "建设路商圈运营楼 5F",
          grid: "猛追湾街道-网格04",
          level: "规上",
          tags: [
            "商圈运营",
            "即时零售"
          ],
          kpis: {
            revenue_y: 1.22,
            tax_y: 0.08,
            employees: 102,
            r_and_d: 0.05
          },
          risk: {
            level: "低",
            score: 21,
            signals: [
              "门店客流恢复",
              "履约效率提升"
            ]
          },
          ecosystem_role: [
            "社区零售",
            "商圈门店",
            "客单价",
            "复购率",
            "履约时效"
          ],
          products: [
            "社区零售",
            "商圈门店",
            "客单价",
            "复购率",
            "履约时效"
          ],
          events: [
            {
              date: "2026-02-23",
              title: "即时零售项目扩至 5 个商圈",
              type: "operate"
            }
          ],
          street_id: "gs31",
          district_id: "gd4",
          park_id: "gp20",
          building_id: "gbs035"
        },
        {
          id: "e59",
          name: "成都跨境履约服务有限公司",
          uscc: "91510100MA6ZH59E9E",
          industry: "现代商贸",
          track: "支柱产业",
          address: "青白江跨境服务港 8F",
          grid: "驷马桥街道-网格05",
          level: "规下",
          tags: [
            "跨境电商",
            "履约服务"
          ],
          kpis: {
            revenue_y: 0.66,
            tax_y: 0.04,
            employees: 53,
            r_and_d: 0.07
          },
          risk: {
            level: "中",
            score: 33,
            signals: [
              "国际运价波动",
              "新市场拓展中"
            ]
          },
          ecosystem_role: [
            "制造商",
            "电商渠道",
            "末端配送",
            "售后服务"
          ],
          products: [
            "制造商",
            "电商渠道",
            "末端配送",
            "售后服务"
          ],
          events: [
            {
              date: "2026-02-13",
              title: "跨境履约仓投运",
              type: "operate"
            }
          ],
          street_id: "gs33",
          district_id: "gd4",
          park_id: "gp25",
          building_id: "gbs036"
        },
        {
          id: "e60",
          name: "蓉城知识产权与法律服务有限公司",
          uscc: "91510100MA6ZH60F0F",
          industry: "创新服务",
          track: "生态机构",
          address: "青羊法务服务中心 14F",
          grid: "府南街道-网格04",
          level: "服务机构",
          tags: [
            "法务支撑",
            "知识产权"
          ],
          kpis: {
            revenue_y: 0.29,
            tax_y: 0.02,
            employees: 26,
            r_and_d: 0.01
          },
          risk: {
            level: "低",
            score: 9,
            signals: [
              "执业稳定",
              "客户结构分散"
            ]
          },
          ecosystem_role: [
            "法律服务",
            "知识产权服务"
          ],
          products: [
            "法律服务",
            "知识产权服务"
          ],
          events: [
            {
              date: "2026-02-17",
              title: "完成重点企业专利布局项目",
              type: "service"
            }
          ],
          street_id: "gs2",
          district_id: "gd1",
          park_id: "gp1",
          building_id: "gbs037"
        },
        {
          id: "e61",
          name: "西部财税顾问有限公司",
          uscc: "91510100MA6ZH61G1G",
          industry: "创新服务",
          track: "生态机构",
          address: "金融城财税服务楼 7F",
          grid: "东大街街道-网格03",
          level: "服务机构",
          tags: [
            "财税顾问",
            "融资辅导"
          ],
          kpis: {
            revenue_y: 0.31,
            tax_y: 0.02,
            employees: 24,
            r_and_d: 0.01
          },
          risk: {
            level: "低",
            score: 10,
            signals: [
              "客户稳定",
              "续费率高"
            ]
          },
          ecosystem_role: [
            "财会与金融服务",
            "数字化转型服务"
          ],
          products: [
            "财会与金融服务",
            "数字化转型服务"
          ],
          events: [
            {
              date: "2026-03-01",
              title: "完成高成长企业财税诊断 12 家",
              type: "service"
            }
          ],
          street_id: "gs23",
          district_id: "gd2",
          park_id: "gp18",
          building_id: "gbs038"
        },
        {
          id: "e62",
          name: "成都航芯传感科技有限公司",
          uscc: "91510100MA6ZH62H2H",
          industry: "智能制造",
          track: "支柱产业",
          address: "青羊航空配套园 6 栋",
          grid: "黄田坝街道-网格05",
          level: "规上",
          tags: [
            "精密器件",
            "本地配套"
          ],
          kpis: {
            revenue_y: 1.56,
            tax_y: 0.11,
            employees: 132,
            r_and_d: 0.21
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "配套订单稳定",
              "研发节奏平稳"
            ]
          },
          ecosystem_role: [
            "核心零部件",
            "传感器模组"
          ],
          products: [
            "传感器",
            "陀螺仪",
            "主控芯片",
            "液压作动系统"
          ],
          chain_nodes: [
            "发动机、传感器、陀螺仪、主控芯片",
            "液压作动系统",
            "环控与燃油系统",
            "机载线束与连接器"
          ],
          events: [
            {
              date: "2026-03-10",
              title: "惯导传感器批量交付",
              type: "operate"
            }
          ],
          park_id: "gp1",
          street_id: "gs2",
          district_id: "gd1",
          building_id: "gbs039"
        },
        {
          id: "e63",
          name: "青羊精密制造配套有限公司",
          uscc: "91510100MA6ZH63J3J",
          industry: "智能制造",
          track: "支柱产业",
          address: "青羊经开区精工路 12 号",
          grid: "苏坡街道-网格03",
          level: "规上",
          tags: [
            "精密加工",
            "链主配套"
          ],
          kpis: {
            revenue_y: 2.21,
            tax_y: 0.16,
            employees: 176,
            r_and_d: 0.12
          },
          risk: {
            level: "低",
            score: 20,
            signals: [
              "设备稼动率高",
              "主机厂订单持续"
            ]
          },
          ecosystem_role: [
            "结构件制造",
            "表面处理"
          ],
          products: [
            "钛合金锻件",
            "精密铸件",
            "五轴数控加工",
            "特种焊接"
          ],
          chain_nodes: [
            "钛合金锻件与精密铸件",
            "碳纤维预浸料与复材板材",
            "航空级密封件与紧固件",
            "五轴精密数控加工",
            "特种焊接与表面处理",
            "精密装配与检测"
          ],
          events: [
            {
              date: "2026-03-07",
              title: "新增航空结构件产线",
              type: "operate"
            }
          ],
          park_id: "gp1",
          street_id: "gs2",
          district_id: "gd1",
          building_id: "gbs040"
        },
        {
          id: "e64",
          name: "成都航空强度试验中心有限公司",
          uscc: "91510100MA6ZH64K4K",
          industry: "创新服务",
          track: "生态机构",
          address: "青羊航空研发基地 4F",
          grid: "草堂街道-网格02",
          level: "服务机构",
          tags: [
            "试验检测",
            "适航支撑"
          ],
          kpis: {
            revenue_y: 0.46,
            tax_y: 0.03,
            employees: 42,
            r_and_d: 0.08
          },
          risk: {
            level: "低",
            score: 14,
            signals: [
              "项目储备稳定",
              "客户续约率高"
            ]
          },
          ecosystem_role: [
            "结构仿真",
            "寿命试验"
          ],
          products: [
            "结构强度仿真",
            "疲劳寿命试验",
            "适航取证支持"
          ],
          chain_nodes: [
            "结构强度仿真",
            "疲劳寿命试验",
            "适航取证支持"
          ],
          events: [
            {
              date: "2026-02-26",
              title: "疲劳寿命实验平台投运",
              type: "service"
            }
          ],
          street_id: "gs12",
          district_id: "gd1",
          park_id: "gp7",
          building_id: "gbs041"
        },
        {
          id: "e65",
          name: "天府航维改装服务有限公司",
          uscc: "91510100MA6ZH65L5L",
          industry: "创新服务",
          track: "支柱产业",
          address: "双流航修服务园 2 号楼",
          grid: "黄田坝街道-网格01",
          level: "服务机构",
          tags: [
            "维修改装",
            "运营保障"
          ],
          kpis: {
            revenue_y: 0.88,
            tax_y: 0.06,
            employees: 74,
            r_and_d: 0.04
          },
          risk: {
            level: "低",
            score: 17,
            signals: [
              "维修工单稳定",
              "改装订单增加"
            ]
          },
          ecosystem_role: [
            "维修保障",
            "改装服务"
          ],
          products: [
            "发动机维修",
            "部件维修",
            "客改货改装",
            "飞行培训服务"
          ],
          chain_nodes: [
            "零部件大修翻新",
            "寿命监控与延寿",
            "通航维修改装",
            "飞行培训服务",
            "适航咨询服务",
            "航空培训中心",
            "技术出版物",
            "发动机维修",
            "部件维修",
            "客改货改装"
          ],
          events: [
            {
              date: "2026-03-11",
              title: "通航改装项目签约 4 个",
              type: "service"
            }
          ],
          street_id: "gs22",
          district_id: "gd1",
          park_id: "gp15",
          building_id: "gbs042"
        },
        {
          id: "e66",
          name: "成都通航运营服务有限公司",
          uscc: "91510100MA6ZH66M6M",
          industry: "智能制造",
          track: "新兴产业",
          address: "成华低空场景中心 8F",
          grid: "建设路街道-网格04",
          level: "规下",
          tags: [
            "通航服务",
            "场景应用"
          ],
          kpis: {
            revenue_y: 0.79,
            tax_y: 0.04,
            employees: 63,
            r_and_d: 0.09
          },
          risk: {
            level: "中",
            score: 30,
            signals: [
              "场景拓展较快",
              "运营成本待摊薄"
            ]
          },
          ecosystem_role: [
            "通航运营",
            "测绘巡检"
          ],
          products: [
            "无人机总装服务",
            "航空测绘服务",
            "工业级无人机应用"
          ],
          chain_nodes: [
            "民机转包生产",
            "无人机整机总装",
            "航空测绘服务",
            "工业级无人机应用",
            "应急救援装备",
            "国内航空公司",
            "货运航空企业",
            "通航运营商",
            "航空服务出口",
            "就业带动",
            "产业集聚效应"
          ],
          events: [
            {
              date: "2026-03-03",
              title: "新增测绘与巡检服务项目",
              type: "operate"
            }
          ],
          street_id: "gs32",
          district_id: "gd4",
          park_id: "gp16",
          building_id: "gbs043"
        },
        {
          id: "e67",
          name: "天府低空基础设施有限公司",
          uscc: "91510100MA6ZH67N7N",
          industry: "创新服务",
          track: "新兴产业",
          address: "武侯低空综合服务港 6F",
          grid: "红牌楼街道-网格02",
          level: "服务机构",
          tags: [
            "空域服务",
            "低空基建"
          ],
          kpis: {
            revenue_y: 0.57,
            tax_y: 0.04,
            employees: 49,
            r_and_d: 0.06
          },
          risk: {
            level: "低",
            score: 16,
            signals: [
              "项目储备增长",
              "政府协同顺畅"
            ]
          },
          ecosystem_role: [
            "低空基础设施",
            "空域管理"
          ],
          products: [
            "飞行调度中心",
            "空域监控系统",
            "起降场建设"
          ],
          chain_nodes: [
            "型号适航取证",
            "运营资质审批",
            "飞行空域申请",
            "飞行调度中心",
            "空域监控系统",
            "气象保障服务",
            "起降场建设",
            "充换电网络",
            "维修保障站"
          ],
          events: [
            {
              date: "2026-03-12",
              title: "低空起降场建设项目开工",
              type: "operate"
            }
          ],
          street_id: "gs19",
          district_id: "gd3",
          park_id: "gp12",
          building_id: "gbs044"
        },
        {
          id: "e68",
          name: "蓉城低空城市服务有限公司",
          uscc: "91510100MA6ZH68P8P",
          industry: "现代商贸",
          track: "新兴产业",
          address: "锦江智慧城服中心 3F",
          grid: "书院街街道-网格03",
          level: "规下",
          tags: [
            "城市服务",
            "低空应用"
          ],
          kpis: {
            revenue_y: 0.71,
            tax_y: 0.04,
            employees: 54,
            r_and_d: 0.1
          },
          risk: {
            level: "中",
            score: 34,
            signals: [
              "试点扩张中",
              "设备维护成本较高"
            ]
          },
          ecosystem_role: [
            "低空运营",
            "即时物流"
          ],
          products: [
            "应急救援无人机",
            "城管巡检无人机",
            "物流配送无人机"
          ],
          chain_nodes: [
            "应急救援无人机",
            "城管巡检无人机",
            "物流配送无人机",
            "医疗应急转运",
            "城市安防巡逻",
            "即时物流配送",
            "服务订单收入",
            "数据增值服务",
            "场景授权复制",
            "城市规划、航空护城、环境监测"
          ],
          events: [
            {
              date: "2026-03-04",
              title: "城市巡检无人机平台扩面",
              type: "operate"
            }
          ],
          street_id: "gs4",
          district_id: "gd2",
          park_id: "gp3",
          building_id: "gbs045"
        },
        {
          id: "e69",
          name: "工业数智感知平台有限公司",
          uscc: "91510100MA6ZH69Q9Q",
          industry: "创新服务",
          track: "新兴产业",
          address: "武侯工业AI港 7F",
          grid: "芳草街街道-网格04",
          level: "规下",
          tags: [
            "工业数据",
            "平台服务"
          ],
          kpis: {
            revenue_y: 0.63,
            tax_y: 0.04,
            employees: 59,
            r_and_d: 0.27
          },
          risk: {
            level: "低",
            score: 22,
            signals: [
              "项目交付节奏稳定",
              "工业客户增加"
            ]
          },
          ecosystem_role: [
            "工业AI",
            "数据平台"
          ],
          products: [
            "工业AI云平台",
            "边缘计算网关",
            "训练数据标注"
          ],
          chain_nodes: [
            "产线传感数据",
            "工艺知识库",
            "质检影像数据",
            "边缘计算网关",
            "工业AI云平台",
            "训练数据标注"
          ],
          events: [
            {
              date: "2026-03-08",
              title: "工业知识库平台上线",
              type: "innovation"
            }
          ],
          street_id: "gs28",
          district_id: "gd3",
          park_id: "gp19",
          building_id: "gbs046"
        },
        {
          id: "e70",
          name: "智造视觉检测科技有限公司",
          uscc: "91510100MA6ZH70R0R",
          industry: "创新服务",
          track: "新兴产业",
          address: "武侯智能检测楼 11F",
          grid: "玉林街道-网格02",
          level: "规下",
          tags: [
            "机器视觉",
            "质检AI"
          ],
          kpis: {
            revenue_y: 0.68,
            tax_y: 0.05,
            employees: 61,
            r_and_d: 0.31
          },
          risk: {
            level: "低",
            score: 21,
            signals: [
              "客户复购增长",
              "算法模型稳定"
            ]
          },
          ecosystem_role: [
            "视觉质检",
            "工业检测"
          ],
          products: [
            "视觉缺陷检测",
            "尺寸精度AI测量",
            "焊接质量分析"
          ],
          chain_nodes: [
            "视觉缺陷检测",
            "尺寸精度AI测量",
            "焊接质量分析",
            "零部件寿命预测"
          ],
          events: [
            {
              date: "2026-03-06",
              title: "新增汽车零部件质检项目",
              type: "innovation"
            }
          ],
          street_id: "gs27",
          district_id: "gd3",
          park_id: "gp23",
          building_id: "gbs047"
        },
        {
          id: "e71",
          name: "蓉城工业智能调度有限公司",
          uscc: "91510100MA6ZH71S1S",
          industry: "创新服务",
          track: "新兴产业",
          address: "武侯智造中台 9F",
          grid: "芳草街街道-网格05",
          level: "规下",
          tags: [
            "生产调度",
            "数字孪生"
          ],
          kpis: {
            revenue_y: 0.72,
            tax_y: 0.05,
            employees: 66,
            r_and_d: 0.26
          },
          risk: {
            level: "低",
            score: 19,
            signals: [
              "项目扩张平稳",
              "续签率较高"
            ]
          },
          ecosystem_role: [
            "智能排产",
            "能耗优化"
          ],
          products: [
            "产线数字孪生",
            "工艺优化引擎",
            "智能排产调度"
          ],
          chain_nodes: [
            "产线数字孪生",
            "工艺优化引擎",
            "智能排产调度",
            "无人化物流",
            "能耗优化管理",
            "良率提升",
            "交期缩短",
            "成本降低",
            "降本增效",
            "业务创新"
          ],
          events: [
            {
              date: "2026-03-09",
              title: "排产调度引擎完成版本升级",
              type: "innovation"
            }
          ],
          street_id: "gs28",
          district_id: "gd3",
          park_id: "gp19",
          building_id: "gbs048"
        },
        {
          id: "e72",
          name: "金沙遗址数字文博有限公司",
          uscc: "91510100MA6ZH72T2T",
          industry: "现代商贸",
          track: "支柱产业",
          address: "金沙遗址数字文博中心",
          grid: "金沙街道-网格01",
          level: "规下",
          tags: [
            "数字文博",
            "研学运营"
          ],
          kpis: {
            revenue_y: 0.55,
            tax_y: 0.03,
            employees: 47,
            r_and_d: 0.18
          },
          risk: {
            level: "低",
            score: 20,
            signals: [
              "研学订单增加",
              "馆校合作扩大"
            ]
          },
          ecosystem_role: [
            "数字文博",
            "研学运营"
          ],
          products: [
            "3D文物数字化",
            "虚拟展厅制作",
            "AI导览系统"
          ],
          chain_nodes: [
            "金沙遗址",
            "3D文物数字化",
            "虚拟展厅制作",
            "AI导览系统",
            "考古体验营",
            "文博场馆消费",
            "票务系统"
          ],
          events: [
            {
              date: "2026-03-05",
              title: "数字文博研学课程上线",
              type: "operate"
            }
          ],
          street_id: "gs1",
          district_id: "gd1",
          park_id: "gp2",
          building_id: "gbs049"
        },
        {
          id: "e73",
          name: "杜甫草堂研学旅行有限公司",
          uscc: "91510100MA6ZH73U3U",
          industry: "现代商贸",
          track: "支柱产业",
          address: "杜甫草堂文化服务楼 2F",
          grid: "草堂街道-网格03",
          level: "规下",
          tags: [
            "研学旅行",
            "目的地运营"
          ],
          kpis: {
            revenue_y: 0.48,
            tax_y: 0.03,
            employees: 38,
            r_and_d: 0.09
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "研学客群稳定",
              "课程满意度高"
            ]
          },
          ecosystem_role: [
            "研学线路",
            "文化体验"
          ],
          products: [
            "研学旅行课程",
            "主题餐饮住宿",
            "文博旅游口碑"
          ],
          chain_nodes: [
            "杜甫草堂",
            "研学旅行课程",
            "主题餐饮住宿",
            "研学目的地品牌",
            "文博旅游口碑"
          ],
          events: [
            {
              date: "2026-02-27",
              title: "春季研学产品发布",
              type: "operate"
            }
          ],
          street_id: "gs12",
          district_id: "gd1",
          park_id: "gp7",
          building_id: "gbs050"
        },
        {
          id: "e74",
          name: "宽窄少城夜游文化有限公司",
          uscc: "91510100MA6ZH74V4V",
          industry: "现代商贸",
          track: "支柱产业",
          address: "宽窄巷子少城夜游中心",
          grid: "少城街道-网格02",
          level: "规上",
          tags: [
            "夜游经济",
            "街区运营"
          ],
          kpis: {
            revenue_y: 1.12,
            tax_y: 0.08,
            employees: 94,
            r_and_d: 0.06
          },
          risk: {
            level: "低",
            score: 22,
            signals: [
              "夜间客流恢复",
              "活动转化较好"
            ]
          },
          ecosystem_role: [
            "街区运营",
            "夜间消费"
          ],
          products: [
            "沉浸式夜游",
            "酒吧演艺街区",
            "深夜食堂"
          ],
          chain_nodes: [
            "宽窄巷子·少城",
            "沉浸式夜游",
            "文化街区消费",
            "节庆活动消费",
            "国际文化交流",
            "夜游宽窄巷子",
            "酒吧演艺街区",
            "深夜食堂"
          ],
          events: [
            {
              date: "2026-03-01",
              title: "少城夜游季启动",
              type: "operate"
            }
          ],
          street_id: "gs11",
          district_id: "gd1",
          park_id: "gp14",
          building_id: "gbs051"
        },
        {
          id: "e75",
          name: "成都艺术版权运营有限公司",
          uscc: "91510100MA6ZH75W5W",
          industry: "创新服务",
          track: "支柱产业",
          address: "青羊文创版权中心 10F",
          grid: "少城街道-网格05",
          level: "服务机构",
          tags: [
            "版权运营",
            "IP服务"
          ],
          kpis: {
            revenue_y: 0.43,
            tax_y: 0.03,
            employees: 35,
            r_and_d: 0.05
          },
          risk: {
            level: "低",
            score: 13,
            signals: [
              "版权交易活跃",
              "合作机构增加"
            ]
          },
          ecosystem_role: [
            "版权服务",
            "文化IP"
          ],
          products: [
            "版权价值评估",
            "IP估值模型",
            "数字藏品发行"
          ],
          chain_nodes: [
            "遗产资源",
            "艺术内容",
            "版权价值评估",
            "文物鉴定定价",
            "IP估值模型",
            "文化资产确权",
            "数字藏品发行"
          ],
          events: [
            {
              date: "2026-03-02",
              title: "完成文创IP资产评估项目",
              type: "service"
            }
          ],
          street_id: "gs11",
          district_id: "gd1",
          park_id: "gp14",
          building_id: "gbs052"
        },
        {
          id: "e76",
          name: "青羊总部经济服务有限公司",
          uscc: "91510100MA6ZH76X6X",
          industry: "创新服务",
          track: "支柱产业",
          address: "青羊总部商务港 18F",
          grid: "府南街道-网格03",
          level: "服务机构",
          tags: [
            "总部经济",
            "招商服务"
          ],
          kpis: {
            revenue_y: 0.62,
            tax_y: 0.05,
            employees: 51,
            r_and_d: 0.03
          },
          risk: {
            level: "低",
            score: 16,
            signals: [
              "签约项目增加",
              "总部导入稳定"
            ]
          },
          ecosystem_role: [
            "总部服务",
            "招商服务"
          ],
          products: [
            "品牌区域总部",
            "专业服务总部",
            "跨国企业办事处"
          ],
          chain_nodes: [
            "品牌区域总部",
            "专业服务总部",
            "跨国企业办事处",
            "通信数码市场",
            "服装批发集群",
            "建材家居市场",
            "骡马市商圈",
            "金沙商圈",
            "光华商圈"
          ],
          events: [
            {
              date: "2026-02-28",
              title: "总部招商项目签约 6 个",
              type: "service"
            }
          ],
          street_id: "gs2",
          district_id: "gd1",
          park_id: "gp1",
          building_id: "gbs053"
        },
        {
          id: "e77",
          name: "城市商圈数字运营有限公司",
          uscc: "91510100MA6ZH77Y7Y",
          industry: "现代商贸",
          track: "支柱产业",
          address: "青羊商圈数字中台 12F",
          grid: "府南街道-网格05",
          level: "规上",
          tags: [
            "商圈数字化",
            "平台运营"
          ],
          kpis: {
            revenue_y: 1.18,
            tax_y: 0.09,
            employees: 103,
            r_and_d: 0.09
          },
          risk: {
            level: "低",
            score: 21,
            signals: [
              "商圈项目扩展",
              "运营数据改善"
            ]
          },
          ecosystem_role: [
            "商圈运营",
            "零售数字化"
          ],
          products: [
            "智慧商圈系统",
            "社区团购平台",
            "直播电商基地"
          ],
          chain_nodes: [
            "直播电商基地",
            "社区团购平台",
            "智慧商圈系统",
            "品质社区商业",
            "特色街区消费",
            "首店经济",
            "社零总额增速",
            "商圈坪效",
            "品牌密度"
          ],
          events: [
            {
              date: "2026-03-08",
              title: "智慧商圈项目完成二期验收",
              type: "operate"
            }
          ],
          street_id: "gs2",
          district_id: "gd1",
          park_id: "gp1",
          building_id: "gbs054"
        },
        {
          id: "e78",
          name: "锦江首店与时尚消费运营有限公司",
          uscc: "91510100MA6ZH78Z8Z",
          industry: "现代商贸",
          track: "支柱产业",
          address: "太古里时尚运营中心 16F",
          grid: "春熙路街道-网格01",
          level: "规上",
          tags: [
            "首店经济",
            "时尚消费"
          ],
          kpis: {
            revenue_y: 1.94,
            tax_y: 0.14,
            employees: 141,
            r_and_d: 0.05
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "活动热度较高",
              "品牌入驻稳定"
            ]
          },
          ecosystem_role: [
            "首店经济",
            "商圈运营"
          ],
          products: [
            "全球首店引进",
            "区域首发活动",
            "快闪店运营"
          ],
          chain_nodes: [
            "IFS/太古里",
            "兰桂坊商业街",
            "东大街金融城",
            "全球首店引进",
            "区域首发活动",
            "快闪店运营",
            "奢侈品消费",
            "首店品牌消费",
            "跨境购物消费",
            "消费拉动效应",
            "金融税收贡献",
            "营商环境优化"
          ],
          events: [
            {
              date: "2026-03-07",
              title: "国际品牌首发周开幕",
              type: "operate"
            }
          ],
          street_id: "gs3",
          district_id: "gd2",
          park_id: "gp3",
          building_id: "gbs055"
        },
        {
          id: "e79",
          name: "锦江国际品牌服务有限公司",
          uscc: "91510100MA6ZH79A9A",
          industry: "现代商贸",
          track: "支柱产业",
          address: "IFS 国际品牌服务楼 21F",
          grid: "春熙路街道-网格04",
          level: "规下",
          tags: [
            "品牌服务",
            "时尚内容"
          ],
          kpis: {
            revenue_y: 0.82,
            tax_y: 0.06,
            employees: 68,
            r_and_d: 0.07
          },
          risk: {
            level: "低",
            score: 20,
            signals: [
              "活动项目增多",
              "品牌合作稳定"
            ]
          },
          ecosystem_role: [
            "品牌服务",
            "活动策展"
          ],
          products: [
            "国际奢侈品牌",
            "设计师品牌",
            "新锐国潮品牌"
          ],
          chain_nodes: [
            "国际奢侈品牌",
            "设计师品牌",
            "新锐国潮品牌",
            "独立设计师",
            "潮流艺术内容",
            "时尚媒体内容",
            "KOL/达人资源",
            "活动创意策划",
            "品牌快闪活动",
            "艺术展览体验"
          ],
          events: [
            {
              date: "2026-02-25",
              title: "完成时尚品牌年度策展签约",
              type: "service"
            }
          ],
          street_id: "gs3",
          district_id: "gd2",
          park_id: "gp3",
          building_id: "gbs056"
        },
        {
          id: "e80",
          name: "锦江夜游与美食文化有限公司",
          uscc: "91510100MA6ZH80B0B",
          industry: "现代商贸",
          track: "支柱产业",
          address: "锦江夜游文旅中心 5F",
          grid: "合江亭街道-网格02",
          level: "规上",
          tags: [
            "夜游文旅",
            "美食文化"
          ],
          kpis: {
            revenue_y: 1.37,
            tax_y: 0.1,
            employees: 112,
            r_and_d: 0.06
          },
          risk: {
            level: "低",
            score: 19,
            signals: [
              "夜游客单提升",
              "品牌传播增强"
            ]
          },
          ecosystem_role: [
            "夜游运营",
            "美食运营"
          ],
          products: [
            "锦江夜游项目",
            "太古里潮流体验",
            "美食探店路线"
          ],
          chain_nodes: [
            "大慈寺文化",
            "锦江河畔景观",
            "东门市井文化",
            "时尚文化IP",
            "夜游创意设计",
            "美食文化策划",
            "锦江夜游项目",
            "太古里潮流体验",
            "美食探店路线",
            "社交媒体营销",
            "OTA平台运营",
            "会员积分体系",
            "夜间消费",
            "时尚购物",
            "美食餐饮",
            "网红打卡效应",
            "国际城市营销",
            "文旅消费引力"
          ],
          events: [
            {
              date: "2026-03-09",
              title: "锦江夜游线路完成升级",
              type: "operate"
            }
          ],
          street_id: "gs16",
          district_id: "gd2",
          park_id: "gp11",
          building_id: "gbs057"
        },
        {
          id: "e81",
          name: "锦江消费金融科技有限公司",
          uscc: "91510100MA6ZH81C1C",
          industry: "创新服务",
          track: "支柱产业",
          address: "东大街金融城 25F",
          grid: "东大街街道-网格01",
          level: "服务机构",
          tags: [
            "金融科技",
            "消费金融"
          ],
          kpis: {
            revenue_y: 0.96,
            tax_y: 0.08,
            employees: 88,
            r_and_d: 0.12
          },
          risk: {
            level: "低",
            score: 17,
            signals: [
              "合作商户增长",
              "风控指标稳定"
            ]
          },
          ecosystem_role: [
            "消费金融",
            "支付服务"
          ],
          products: [
            "移动支付平台",
            "征信大数据",
            "联名信用卡"
          ],
          chain_nodes: [
            "银行区域总部",
            "证券/基金公司",
            "消费金融公司",
            "移动支付平台",
            "征信大数据",
            "智能投顾系统",
            "商圈消费分期",
            "联名信用卡",
            "商户经营贷",
            "私人银行服务",
            "家族信托",
            "跨境资产配置"
          ],
          events: [
            {
              date: "2026-03-06",
              title: "商圈消费分期产品完成升级",
              type: "finance"
            }
          ],
          street_id: "gs23",
          district_id: "gd2",
          park_id: "gp18",
          building_id: "gbs058"
        },
        {
          id: "e82",
          name: "航材融服贸易有限公司",
          uscc: "91510100MA6ZH82D2D",
          industry: "创新服务",
          track: "支柱产业",
          address: "青羊航空贸易港 8F",
          grid: "黄田坝街道-网格04",
          level: "服务机构",
          tags: [
            "航材贸易",
            "融资担保"
          ],
          kpis: {
            revenue_y: 0.74,
            tax_y: 0.05,
            employees: 57,
            r_and_d: 0.03
          },
          risk: {
            level: "低",
            score: 16,
            signals: [
              "贸易业务稳定",
              "风控表现良好"
            ]
          },
          ecosystem_role: [
            "航材贸易",
            "航空金融"
          ],
          products: [
            "航材进出口贸易",
            "航空标准件分销",
            "二手航材交易"
          ],
          chain_nodes: [
            "飞机经营性租赁",
            "航空保险服务",
            "航材融资担保",
            "航材进出口贸易",
            "航空标准件分销",
            "二手航材交易",
            "信用风险模型",
            "政策性增信"
          ],
          events: [
            {
              date: "2026-03-01",
              title: "新增航材保税贸易客户",
              type: "finance"
            }
          ],
          street_id: "gs22",
          district_id: "gd1",
          park_id: "gp15",
          building_id: "gbs059"
        },
        {
          id: "e83",
          name: "文创金融服务平台有限公司",
          uscc: "91510100MA6ZH83E3E",
          industry: "创新服务",
          track: "生态机构",
          address: "少城文创金融港 11F",
          grid: "少城街道-网格04",
          level: "服务机构",
          tags: [
            "文创金融",
            "投融资服务"
          ],
          kpis: {
            revenue_y: 0.52,
            tax_y: 0.04,
            employees: 43,
            r_and_d: 0.04
          },
          risk: {
            level: "低",
            score: 15,
            signals: [
              "路演转化提升",
              "合作机构增加"
            ]
          },
          ecosystem_role: [
            "产融对接",
            "文创金融"
          ],
          products: [
            "文旅消费信贷",
            "文创供应链融资",
            "文金对接平台"
          ],
          chain_nodes: [
            "文旅消费信贷",
            "文创供应链融资",
            "文金对接平台",
            "投融资路演",
            "孵化器金融服务",
            "文博场馆金融",
            "演艺产业金融",
            "文创园区金融",
            "文化产业增值",
            "就业带动效应",
            "品牌溢价提升"
          ],
          events: [
            {
              date: "2026-03-10",
              title: "文创金融路演专场完成",
              type: "finance"
            }
          ],
          street_id: "gs11",
          district_id: "gd1",
          park_id: "gp14",
          building_id: "gbs060"
        },
        {
          id: "e84",
          name: "少城生活方式与戏剧运营有限公司",
          uscc: "91510100MA6ZH84F4F",
          industry: "现代商贸",
          track: "支柱产业",
          address: "宽窄巷子演艺中心 4F",
          grid: "少城街道-网格06",
          level: "规下",
          tags: [
            "少城文化",
            "戏剧运营"
          ],
          kpis: {
            revenue_y: 0.86,
            tax_y: 0.06,
            employees: 71,
            r_and_d: 0.05
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "演艺档期稳定",
              "文旅消费恢复"
            ]
          },
          ecosystem_role: [
            "街区运营",
            "演艺运营"
          ],
          products: [
            "沉浸式戏剧",
            "少城文化市集",
            "宽窄深度游"
          ],
          chain_nodes: [
            "川西民居文化",
            "满城历史遗存",
            "茶馆曲艺文化",
            "IP视觉设计",
            "空间场景设计",
            "活动策划设计",
            "宽窄深度游",
            "少城文化市集",
            "沉浸式戏剧",
            "特色餐饮运营",
            "文创零售运营",
            "精品住宿运营",
            "社交媒体引流",
            "会员复购体系",
            "周边消费带动"
          ],
          events: [
            {
              date: "2026-03-12",
              title: "少城沉浸戏剧季启动",
              type: "operate"
            }
          ],
          street_id: "gs11",
          district_id: "gd1",
          park_id: "gp14",
          building_id: "gbs061"
        },
        {
          id: "e85",
          name: "国际时尚消费场景运营有限公司",
          uscc: "91510100MA6ZH85G5G",
          industry: "现代商贸",
          track: "支柱产业",
          address: "太古里时尚体验中心 9F",
          grid: "春熙路街道-网格06",
          level: "规上",
          tags: [
            "时尚消费",
            "商圈运营"
          ],
          kpis: {
            revenue_y: 1.48,
            tax_y: 0.12,
            employees: 118,
            r_and_d: 0.04
          },
          risk: {
            level: "低",
            score: 19,
            signals: [
              "品牌活动稳定",
              "客流表现良好"
            ]
          },
          ecosystem_role: [
            "时尚运营",
            "消费场景"
          ],
          products: [
            "国际时装品牌",
            "买手集合店",
            "设计师品牌店"
          ],
          chain_nodes: [
            "私域流量运营",
            "沉浸式购物",
            "美食消费地标",
            "社交娱乐消费",
            "国际消费知名度",
            "商圈辐射能力",
            "消费创新引领",
            "国际时装品牌",
            "美食社交活动",
            "买手集合店",
            "设计师品牌店",
            "生活方式店",
            "奢侈品购物",
            "潮牌消费",
            "餐饮娱乐",
            "社交裂变传播",
            "时尚城市标签",
            "消费趋势引领"
          ],
          events: [
            {
              date: "2026-03-10",
              title: "国际时尚消费节完成招商",
              type: "operate"
            }
          ],
          street_id: "gs3",
          district_id: "gd2",
          park_id: "gp3",
          building_id: "gbs062"
        },
        {
          id: "e86",
          name: "商圈智能运营科技有限公司",
          uscc: "91510100MA6ZH86H6H",
          industry: "创新服务",
          track: "支柱产业",
          address: "锦江商圈算法中心 13F",
          grid: "春熙路街道-网格07",
          level: "规下",
          tags: [
            "商圈算法",
            "AI运营"
          ],
          kpis: {
            revenue_y: 0.97,
            tax_y: 0.07,
            employees: 84,
            r_and_d: 0.29
          },
          risk: {
            level: "低",
            score: 21,
            signals: [
              "平台交付稳定",
              "复购率上升"
            ]
          },
          ecosystem_role: [
            "AI运营",
            "推荐系统"
          ],
          products: [
            "AI精准推荐",
            "AI导购助手",
            "会员智能运营"
          ],
          chain_nodes: [
            "客流感知数据",
            "消费行为数据",
            "商户经营数据",
            "计算机视觉",
            "NLP对话引擎",
            "推荐算法",
            "AI精准推荐",
            "智能广告投放",
            "会员智能运营",
            "智能客流调度",
            "AI选品/选址",
            "智慧物业管理",
            "AI导购助手",
            "虚拟试穿试用",
            "无感支付",
            "转化率提升",
            "营销ROI优化",
            "运营成本降低"
          ],
          events: [
            {
              date: "2026-03-11",
              title: "上线商圈AI运营中台",
              type: "innovation"
            }
          ],
          street_id: "gs3",
          district_id: "gd2",
          park_id: "gp3",
          building_id: "gbs063"
        },
        {
          id: "e87",
          name: "蓉城低空即时配送网络有限公司",
          uscc: "91510100MA6ZH87J7J",
          industry: "现代商贸",
          track: "新兴产业",
          address: "锦江低空物流指挥中心 7F",
          grid: "盐市口街道-网格05",
          level: "规下",
          tags: [
            "低空物流",
            "即时配送"
          ],
          kpis: {
            revenue_y: 0.93,
            tax_y: 0.06,
            employees: 76,
            r_and_d: 0.12
          },
          risk: {
            level: "中",
            score: 33,
            signals: [
              "运维投入较高",
              "新线路验证中"
            ]
          },
          ecosystem_role: [
            "低空配送",
            "城市履约"
          ],
          products: [
            "外卖配送无人机",
            "快递配送无人机",
            "医药紧急配送机"
          ],
          chain_nodes: [
            "外卖配送无人机",
            "快递配送无人机",
            "医药紧急配送机",
            "楼顶起降台",
            "智能储柜",
            "充电中继站",
            "订单智能匹配",
            "航线实时规划",
            "异常处理系统",
            "飞行器运维",
            "安全巡检",
            "客户服务",
            "商圈外卖配送",
            "快递最后一公里",
            "医疗应急配送",
            "配送时效提升",
            "人力成本节省",
            "服务覆盖扩展"
          ],
          events: [
            {
              date: "2026-03-13",
              title: "即时配送低空试点新增 6 个点位",
              type: "operate"
            }
          ],
          street_id: "gs24",
          district_id: "gd2",
          park_id: "gp24",
          building_id: "gbs064"
        },
        {
          id: "e88",
          name: "天府航电软件与模组有限公司",
          uscc: "91510100MA6ZH88K8K",
          industry: "智能制造",
          track: "支柱产业",
          address: "青羊航电产业楼 11F",
          grid: "黄田坝街道-网格06",
          level: "规下",
          tags: [
            "航电软件",
            "模组配套"
          ],
          kpis: {
            revenue_y: 1.03,
            tax_y: 0.07,
            employees: 92,
            r_and_d: 0.34
          },
          risk: {
            level: "中",
            score: 28,
            signals: [
              "研发周期较长",
              "项目储备较多"
            ]
          },
          ecosystem_role: [
            "航电系统",
            "通信导航"
          ],
          products: [
            "综合航电系统",
            "通信导航系统",
            "任务管理系统"
          ],
          chain_nodes: [
            "航空SoC芯片",
            "惯性导航模组",
            "航空连接器",
            "飞控律算法",
            "航电综合管理",
            "嵌入式操作系统",
            "综合航电系统",
            "通信导航系统",
            "任务管理系统",
            "半实物仿真",
            "EMC测试",
            "环境适应性试验",
            "军机航电配套",
            "民机航电升级",
            "无人机航电套件",
            "软件维护升级",
            "现场技术支持",
            "培训与文档"
          ],
          events: [
            {
              date: "2026-03-09",
              title: "综合航电软件平台发布",
              type: "innovation"
            }
          ],
          street_id: "gs22",
          district_id: "gd1",
          park_id: "gp15",
          building_id: "gbs065"
        },
        {
          id: "e89",
          name: "天府AI芯片与数据工程有限公司",
          uscc: "91510100MA6ZH89L9L",
          industry: "创新服务",
          track: "新兴产业",
          address: "武侯智算芯谷 17F",
          grid: "桂溪街道-网格06",
          level: "规下",
          tags: [
            "AI芯片",
            "数据工程"
          ],
          kpis: {
            revenue_y: 1.16,
            tax_y: 0.08,
            employees: 101,
            r_and_d: 0.38
          },
          risk: {
            level: "中",
            score: 31,
            signals: [
              "流片周期较长",
              "数据治理项目增加"
            ]
          },
          ecosystem_role: [
            "AI芯片",
            "数据工程"
          ],
          products: [
            "AI训练芯片设计",
            "AI推理芯片设计",
            "行业大模型"
          ],
          chain_nodes: [
            "AI训练芯片设计",
            "AI推理芯片设计",
            "存算一体芯片",
            "多模态数据采集",
            "专业数据标注",
            "合成数据生成",
            "视觉AI算法",
            "语音AI算法",
            "行业大模型",
            "智能安防终端",
            "工业视觉终端",
            "智能交互终端",
            "智慧城市",
            "智慧医疗",
            "产值规模增长",
            "企业聚集效应",
            "人才吸引力"
          ],
          events: [
            {
              date: "2026-03-12",
              title: "新一代推理芯片完成验证",
              type: "innovation"
            }
          ],
          street_id: "gs29",
          district_id: "gd3",
          park_id: "gp17",
          building_id: "gbs066"
        },
        {
          id: "e90",
          name: "科技资本与上市服务有限公司",
          uscc: "91510100MA6ZH90M0M",
          industry: "创新服务",
          track: "生态机构",
          address: "金融城资本服务港 19F",
          grid: "东大街街道-网格06",
          level: "服务机构",
          tags: [
            "科技金融",
            "上市培育"
          ],
          kpis: {
            revenue_y: 0.88,
            tax_y: 0.06,
            employees: 72,
            r_and_d: 0.04
          },
          risk: {
            level: "低",
            score: 16,
            signals: [
              "项目来源稳定",
              "资本机构合作深化"
            ]
          },
          ecosystem_role: [
            "科技金融",
            "上市服务"
          ],
          products: [
            "VC/PE基金",
            "政府引导基金",
            "上市辅导"
          ],
          chain_nodes: [
            "VC/PE基金",
            "政府引导基金",
            "知识产权质押",
            "研发费用贷",
            "科技担保增信",
            "并购顾问",
            "上市辅导",
            "技术尽调服务",
            "知识产权评估",
            "科技企业征信",
            "高新技术企业",
            "专精特新企业",
            "科技型中小企业",
            "企业成长提速",
            "创新成果转化",
            "上市企业培育"
          ],
          events: [
            {
              date: "2026-03-14",
              title: "科技企业资本服务计划发布",
              type: "finance"
            }
          ],
          street_id: "gs23",
          district_id: "gd2",
          park_id: "gp18",
          building_id: "gbs067"
        },
        {
          id: "e91",
          name: "科创载体与企业服务平台有限公司",
          uscc: "91510100MA6ZH91N1N",
          industry: "创新服务",
          track: "生态机构",
          address: "青羊科创服务综合体 15F",
          grid: "府南街道-网格06",
          level: "服务机构",
          tags: [
            "企业服务",
            "科创载体"
          ],
          kpis: {
            revenue_y: 0.77,
            tax_y: 0.05,
            employees: 69,
            r_and_d: 0.03
          },
          risk: {
            level: "低",
            score: 15,
            signals: [
              "服务续签率高",
              "园区导入项目增加"
            ]
          },
          ecosystem_role: [
            "载体服务",
            "专业服务"
          ],
          products: [
            "产业加速器",
            "共享办公空间",
            "政策申报服务"
          ],
          chain_nodes: [
            "甲级写字楼",
            "共享办公空间",
            "产业加速器",
            "知识产权代理",
            "科技咨询公司",
            "人才猎头机构",
            "财税代理服务",
            "法律合规服务",
            "政策申报服务",
            "技术交易平台",
            "科技设备采购",
            "SaaS软件集市",
            "初创科技企业",
            "成长期企业",
            "跨国科技公司",
            "产业链完整度",
            "服务效率提升",
            "区域品牌价值"
          ],
          events: [
            {
              date: "2026-03-11",
              title: "企业服务综合平台上线",
              type: "service"
            }
          ],
          street_id: "gs2",
          district_id: "gd1",
          park_id: "gp1",
          building_id: "gbs068"
        },
        {
          id: "e92",
          name: "城市遥感与数字孪生科技有限公司",
          uscc: "91510100MA6ZH92P2P",
          industry: "创新服务",
          track: "新兴产业",
          address: "成华城市感知港 16F",
          grid: "建设路街道-网格05",
          level: "规下",
          tags: [
            "遥感测绘",
            "数字孪生"
          ],
          kpis: {
            revenue_y: 1.05,
            tax_y: 0.07,
            employees: 96,
            r_and_d: 0.27
          },
          risk: {
            level: "低",
            score: 20,
            signals: [
              "项目储备充足",
              "城市业务扩展"
            ]
          },
          ecosystem_role: [
            "城市感知",
            "数据分析"
          ],
          products: [
            "多光谱感知载荷",
            "激光雷达系统",
            "城市数字孪生"
          ],
          chain_nodes: [
            "多光谱感知载荷",
            "激光雷达系统",
            "AI边缘计算盒",
            "5G图传模组",
            "卫星中继链路",
            "自组网系统",
            "城市三维测绘",
            "环境监测采集",
            "基础设施巡检",
            "影像AI分析",
            "点云数据处理",
            "城市数字孪生",
            "城市规划辅助",
            "灾害应急响应",
            "生态环境监管",
            "数据服务订阅",
            "分析报告服务",
            "平台数据交易"
          ],
          events: [
            {
              date: "2026-03-13",
              title: "城市数字孪生项目进入交付期",
              type: "innovation"
            }
          ],
          street_id: "gs32",
          district_id: "gd4",
          park_id: "gp16",
          building_id: "gbs069"
        },
        {
          id: "e93",
          name: "武侯三国文化运营有限公司",
          uscc: "91510100MA6ZH93Q3Q",
          industry: "现代商贸",
          track: "支柱产业",
          address: "武侯祠文旅运营中心 6F",
          grid: "浆洗街街道-网格04",
          level: "规上",
          tags: [
            "三国文化",
            "景区运营"
          ],
          kpis: {
            revenue_y: 1.24,
            tax_y: 0.09,
            employees: 108,
            r_and_d: 0.06
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "节庆活动稳定",
              "IP转化提升"
            ]
          },
          ecosystem_role: [
            "景区运营",
            "IP开发"
          ],
          products: [
            "三国IP开发",
            "三国沉浸式演出",
            "三国主题文创"
          ],
          chain_nodes: [
            "武侯祠博物馆",
            "锦里古街",
            "三国文化遗址群",
            "三国IP开发",
            "影视/游戏授权",
            "学术研究出版",
            "三国沉浸式演出",
            "武侯研学课程",
            "三国主题密室",
            "三国主题文创",
            "锦里美食运营",
            "数字三国藏品",
            "武侯祠景区消费",
            "锦里夜间消费",
            "周边酒店住宿",
            "三国文化名片",
            "国际文化旅游",
            "IP授权收入"
          ],
          events: [
            {
              date: "2026-03-12",
              title: "三国主题演艺项目上新",
              type: "operate"
            }
          ],
          street_id: "gs26",
          district_id: "gd3",
          park_id: "gp26",
          building_id: "gbs070"
        },
        {
          id: "e94",
          name: "川西民俗与美食文旅有限公司",
          uscc: "91510100MA6ZH94R4R",
          industry: "现代商贸",
          track: "支柱产业",
          address: "锦里民俗体验街 3F",
          grid: "浆洗街街道-网格06",
          level: "规下",
          tags: [
            "民俗文旅",
            "美食运营"
          ],
          kpis: {
            revenue_y: 0.82,
            tax_y: 0.05,
            employees: 67,
            r_and_d: 0.04
          },
          risk: {
            level: "低",
            score: 19,
            signals: [
              "体验产品热度较高",
              "复游率提升"
            ]
          },
          ecosystem_role: [
            "民俗体验",
            "美食文旅"
          ],
          products: [
            "手工艺体验",
            "美食制作体验",
            "主题住宿运营"
          ],
          chain_nodes: [
            "川西民俗文化",
            "传统手工技艺",
            "川味美食文化",
            "民俗IP设计",
            "美食内容策划",
            "互动体验设计",
            "手工艺体验",
            "美食制作体验",
            "民俗表演观赏",
            "特色美食集群",
            "手工艺品店铺",
            "主题住宿运营",
            "美食消费",
            "伴手礼消费",
            "民俗文旅地标",
            "美食城市标签",
            "复访率与口碑"
          ],
          events: [
            {
              date: "2026-03-10",
              title: "川西民俗体验产品完成升级",
              type: "operate"
            }
          ],
          street_id: "gs26",
          district_id: "gd3",
          park_id: "gp26",
          building_id: "gbs071"
        },
        {
          id: "e95",
          name: "航空再制造与高端装备有限公司",
          uscc: "91510100MA6ZH95S5S",
          industry: "智能制造",
          track: "支柱产业",
          address: "青羊高端装备园 5 号楼",
          grid: "黄田坝街道-网格07",
          level: "规上",
          tags: [
            "再制造",
            "高端装备"
          ],
          kpis: {
            revenue_y: 2.04,
            tax_y: 0.15,
            employees: 168,
            r_and_d: 0.14
          },
          risk: {
            level: "低",
            score: 21,
            signals: [
              "制造订单充足",
              "设备效率较高"
            ]
          },
          ecosystem_role: [
            "高端加工",
            "再制造"
          ],
          products: [
            "智能数控机床",
            "增材制造设备",
            "起落架翻修"
          ],
          chain_nodes: [
            "整体壁板与框梁",
            "起落架组件",
            "进气道与尾喷管",
            "军机配套交付",
            "智能数控机床",
            "增材制造设备",
            "特种加工工艺",
            "表面工程技术",
            "智能检测工艺",
            "涡轮叶片制造",
            "精密齿轮箱",
            "液压阀体加工",
            "叶片修复再制造",
            "起落架翻修",
            "附件大修",
            "精密包装运输",
            "供应链协同",
            "技术伴随服务",
            "技术溢出效应"
          ],
          events: [
            {
              date: "2026-03-08",
              title: "高端再制造车间扩能",
              type: "operate"
            }
          ],
          street_id: "gs22",
          district_id: "gd1",
          park_id: "gp15",
          building_id: "gbs072"
        },
        {
          id: "e96",
          name: "AIGC内容与数字人科技有限公司",
          uscc: "91510100MA6ZH96T6T",
          industry: "创新服务",
          track: "新兴产业",
          address: "高新数字内容港 12F",
          grid: "桂溪街道-网格07",
          level: "规下",
          tags: [
            "AIGC",
            "数字内容"
          ],
          kpis: {
            revenue_y: 0.94,
            tax_y: 0.07,
            employees: 87,
            r_and_d: 0.33
          },
          risk: {
            level: "中",
            score: 29,
            signals: [
              "算力成本波动",
              "项目增速较快"
            ]
          },
          ecosystem_role: [
            "AIGC",
            "数字内容"
          ],
          products: [
            "文本生成模型",
            "图像/视频生成",
            "虚拟主播/数字人"
          ],
          chain_nodes: [
            "文本生成模型",
            "图像/视频生成",
            "3D内容生成",
            "媒体素材库",
            "渲染算力池",
            "版权管理平台",
            "短视频智能生产",
            "虚拟主播/数字人",
            "游戏AI内容",
            "设备预测维护",
            "生产智能排程",
            "供应链AI优化",
            "数字文创",
            "智慧工厂",
            "内容产业增长",
            "新业态孵化"
          ],
          events: [
            {
              date: "2026-03-14",
              title: "数字人内容生产平台上线",
              type: "innovation"
            }
          ],
          street_id: "gs29",
          district_id: "gd3",
          park_id: "gp17",
          building_id: "gbs073"
        },
        {
          id: "e97",
          name: "产业链金融与租赁服务有限公司",
          uscc: "91510100MA6ZH97U7U",
          industry: "创新服务",
          track: "生态机构",
          address: "青羊产融服务楼 20F",
          grid: "府南街道-网格07",
          level: "服务机构",
          tags: [
            "融资租赁",
            "供应链金融"
          ],
          kpis: {
            revenue_y: 0.91,
            tax_y: 0.07,
            employees: 79,
            r_and_d: 0.03
          },
          risk: {
            level: "低",
            score: 17,
            signals: [
              "授信覆盖稳定",
              "客户扩张平稳"
            ]
          },
          ecosystem_role: [
            "供应链金融",
            "设备租赁"
          ],
          products: [
            "设备融资租赁",
            "订单融资",
            "库存质押贷"
          ],
          chain_nodes: [
            "产业发展基金",
            "设备融资租赁",
            "银行产业授信",
            "动产质押监管",
            "供应链核验",
            "产业链评估",
            "订单融资",
            "库存质押贷",
            "保理融资",
            "财务顾问",
            "上市培育",
            "并购撮合",
            "规上制造企业",
            "供应链中小企业",
            "产业园区企业",
            "融资覆盖率",
            "供应链稳定性",
            "产业投资增速",
            "版权质押贷款"
          ],
          events: [
            {
              date: "2026-03-13",
              title: "产业链金融产品矩阵更新",
              type: "finance"
            }
          ],
          street_id: "gs2",
          district_id: "gd1",
          park_id: "gp1",
          building_id: "gbs074"
        },
        {
          id: "e98",
          name: "东郊记忆文创与社区商业有限公司",
          uscc: "91510100MA6ZH98V8V",
          industry: "现代商贸",
          track: "支柱产业",
          address: "东郊记忆文创区运营楼 8F",
          grid: "建设路街道-网格06",
          level: "规上",
          tags: [
            "文创街区",
            "社区商业"
          ],
          kpis: {
            revenue_y: 1.29,
            tax_y: 0.09,
            employees: 109,
            r_and_d: 0.05
          },
          risk: {
            level: "低",
            score: 20,
            signals: [
              "市集客流提升",
              "园区入驻稳定"
            ]
          },
          ecosystem_role: [
            "街区运营",
            "文创孵化"
          ],
          products: [
            "创意市集运营",
            "文创品牌孵化",
            "文创消费空间"
          ],
          chain_nodes: [
            "东郊记忆文创区",
            "工业厂房改造",
            "创意办公空间",
            "建设路商圈",
            "龙潭商业区",
            "社区商业网络",
            "音乐产业链",
            "创意市集运营",
            "文创品牌孵化",
            "智慧菜市场",
            "文创消费空间",
            "社区生活消费"
          ],
          events: [
            {
              date: "2026-03-11",
              title: "东郊记忆文创招商季启动",
              type: "operate"
            }
          ],
          street_id: "gs32",
          district_id: "gd4",
          park_id: "gp16",
          building_id: "gbs075"
        },
        {
          id: "e99",
          name: "航空安全装备与防务配套有限公司",
          uscc: "91510100MA6ZH99W9W",
          industry: "智能制造",
          track: "支柱产业",
          address: "青羊防务配套园 3 栋",
          grid: "黄田坝街道-网格08",
          level: "规下",
          tags: [
            "防务配套",
            "安全装备"
          ],
          kpis: {
            revenue_y: 0.98,
            tax_y: 0.07,
            employees: 83,
            r_and_d: 0.18
          },
          risk: {
            level: "中",
            score: 27,
            signals: [
              "项目保密等级高",
              "交付周期较长"
            ]
          },
          ecosystem_role: [
            "防务配套",
            "安全装备"
          ],
          products: [
            "机载武器",
            "军贸与联训",
            "军机配套交付"
          ],
          chain_nodes: [
            "机载武器",
            "军贸与联训",
            "军机配套交付"
          ],
          events: [
            {
              date: "2026-03-07",
              title: "完成新批次防务配套交付",
              type: "operate"
            }
          ],
          street_id: "gs22",
          district_id: "gd1",
          park_id: "gp15",
          building_id: "gbs076"
        },
        {
          id: "e100",
          name: "文博联名文创与版权金融有限公司",
          uscc: "91510100MA6ZH00X0X",
          industry: "创新服务",
          track: "支柱产业",
          address: "锦江文博创意中心 10F",
          grid: "合江亭街道-网格03",
          level: "服务机构",
          tags: [
            "文博文创",
            "版权金融"
          ],
          kpis: {
            revenue_y: 0.63,
            tax_y: 0.05,
            employees: 52,
            r_and_d: 0.08
          },
          risk: {
            level: "低",
            score: 16,
            signals: [
              "联名项目增多",
              "版权交易稳定"
            ]
          },
          ecosystem_role: [
            "文博文创",
            "版权服务"
          ],
          products: [
            "文博联名文创",
            "版权质押贷款",
            "版权管理平台"
          ],
          chain_nodes: [
            "文博联名文创",
            "版权质押贷款",
            "版权管理平台"
          ],
          events: [
            {
              date: "2026-03-15",
              title: "文博联名金融产品发布",
              type: "finance"
            }
          ],
          street_id: "gs16",
          district_id: "gd2",
          park_id: "gp11",
          building_id: "gbs077"
        },
        {
          id: "e101",
          name: "成华工业巡检与测绘服务有限公司",
          uscc: "91510100MA6ZH101A1",
          industry: "创新服务",
          track: "新兴产业",
          address: "龙潭工业感知中心 9F",
          grid: "建设路街道-网格07",
          level: "规下",
          tags: [
            "工业巡检",
            "低空服务"
          ],
          kpis: {
            revenue_y: 1.08,
            tax_y: 0.08,
            employees: 93,
            r_and_d: 0.17
          },
          risk: {
            level: "低",
            score: 20,
            signals: [
              "工业客户持续增加",
              "项目交付稳定"
            ]
          },
          ecosystem_role: [
            "工业巡检",
            "测绘服务"
          ],
          products: [
            "测绘测量无人机",
            "红外热成像",
            "高精度相机"
          ],
          chain_nodes: [
            "测绘测量无人机",
            "应急指挥无人机",
            "红外热成像",
            "气体检测传感器",
            "高精度相机",
            "电力线路巡检",
            "建设工地巡查",
            "管道设施巡检",
            "缺陷AI识别",
            "三维建模分析",
            "趋势预警报告",
            "建筑/市政工程",
            "巡检效率提升",
            "安全事故降低",
            "维护成本优化"
          ],
          events: [
            {
              date: "2026-03-15",
              title: "工业巡检服务新增市政项目",
              type: "operate"
            }
          ],
          street_id: "gs32",
          district_id: "gd4",
          park_id: "gp16",
          building_id: "gbs078"
        },
        {
          id: "e102",
          name: "东郊音乐文创发展有限公司",
          uscc: "91510100MA6ZH102B2",
          industry: "现代商贸",
          track: "支柱产业",
          address: "东郊记忆演艺中心 6F",
          grid: "建设路街道-网格08",
          level: "规上",
          tags: [
            "音乐文创",
            "园区运营"
          ],
          kpis: {
            revenue_y: 1.42,
            tax_y: 0.11,
            employees: 124,
            r_and_d: 0.07
          },
          risk: {
            level: "低",
            score: 18,
            signals: [
              "园区客流回升",
              "演艺活动稳定"
            ]
          },
          ecosystem_role: [
            "音乐文创",
            "园区运营"
          ],
          products: [
            "东郊记忆园区",
            "LiveHouse演出",
            "音乐节/音乐会"
          ],
          chain_nodes: [
            "东郊记忆园区",
            "工业建筑遗存",
            "红色工业文化",
            "原创音乐团队",
            "录音制作工坊",
            "音乐版权资源",
            "工业遗址参观",
            "文创展览策展",
            "手作体验工坊",
            "LiveHouse演出",
            "音乐节/音乐会",
            "音乐培训教育",
            "音乐消费",
            "潮流消费",
            "餐饮消费",
            "音乐地标品牌",
            "青年文化引力",
            "文创IP输出"
          ],
          events: [
            {
              date: "2026-03-16",
              title: "东郊春季音乐计划发布",
              type: "operate"
            }
          ],
          street_id: "gs32",
          district_id: "gd4",
          park_id: "gp16",
          building_id: "gbs079"
        },
        {
          id: "e103",
          name: "建设路夜经济与社交娱乐有限公司",
          uscc: "91510100MA6ZH103C3",
          industry: "现代商贸",
          track: "支柱产业",
          address: "建设路夜经济运营楼 5F",
          grid: "猛追湾街道-网格07",
          level: "规上",
          tags: [
            "夜间经济",
            "娱乐运营"
          ],
          kpis: {
            revenue_y: 1.36,
            tax_y: 0.1,
            employees: 117,
            r_and_d: 0.05
          },
          risk: {
            level: "低",
            score: 19,
            signals: [
              "夜间消费表现良好",
              "活动转化稳定"
            ]
          },
          ecosystem_role: [
            "夜经济运营",
            "娱乐消费"
          ],
          products: [
            "建设路美食街",
            "夜间市集运营",
            "电竞娱乐"
          ],
          chain_nodes: [
            "建设路美食街",
            "望平滨河街区",
            "猛追湾文创区",
            "美食内容IP",
            "潮流活动策划",
            "美食街运营",
            "酒吧街运营",
            "夜间市集运营",
            "电竞娱乐",
            "沉浸式娱乐",
            "社交聚会空间",
            "深夜美食消费",
            "微醺社交消费",
            "娱乐休闲消费",
            "夜生活地标",
            "网红效应",
            "年轻客群黏性"
          ],
          events: [
            {
              date: "2026-03-14",
              title: "建设路夜间消费活动周启动",
              type: "operate"
            }
          ],
          street_id: "gs31",
          district_id: "gd4",
          park_id: "gp20",
          building_id: "gbs080"
        },
        {
          id: "e104",
          name: "成华商业数字化与首店服务有限公司",
          uscc: "91510100MA6ZH104D4",
          industry: "创新服务",
          track: "支柱产业",
          address: "成华商业数据中心 12F",
          grid: "建设路街道-网格09",
          level: "服务机构",
          tags: [
            "商业数字化",
            "首店经济"
          ],
          kpis: {
            revenue_y: 0.79,
            tax_y: 0.06,
            employees: 68,
            r_and_d: 0.09
          },
          risk: {
            level: "低",
            score: 17,
            signals: [
              "商户签约增加",
              "数字化项目扩展"
            ]
          },
          ecosystem_role: [
            "商业数字化",
            "招商服务"
          ],
          products: [
            "社零增速监测",
            "首店导入",
            "商业数字化率评估"
          ],
          chain_nodes: [
            "夜间消费经济",
            "社零增速",
            "首店落地数",
            "商业数字化率"
          ],
          events: [
            {
              date: "2026-03-13",
              title: "商业数字化监测面板上线",
              type: "service"
            }
          ],
          street_id: "gs32",
          district_id: "gd4",
          park_id: "gp16",
          building_id: "gbs081"
        }
      ],
    chain: {
      // A simple chain map for demo rendering.
      "智能制造": {
        upstream: ["e4", "e16", "e20"],
        core: ["e1", "e5", "e9", "e10", "e14", "e25", "e29"],
        downstream: ["e3", "e8", "e7"],
        gaps: ["表面处理（本地缺）", "精密检测（产能不足）"],
      },
      "生物医药": {
        upstream: ["e3", "e6", "e20"],
        core: ["e2", "e11", "e21", "e30"],
        downstream: ["e26", "e23"],
        gaps: ["GMP 小试中试空间", "冷链合规仓储"],
      },
      "现代商贸": {
        upstream: ["e1", "e3", "e27"],
        core: ["e4", "e16", "e26"],
        downstream: ["e17", "e24"],
        gaps: ["社区团购履约网点", "品牌内容运营服务商"],
      },
      "创新服务": {
        upstream: ["e6", "e22", "e28"],
        core: ["e3", "e8", "e13", "e18"],
        downstream: ["e1", "e2", "e4", "e12"],
        gaps: ["成果转化专业机构", "高端人才猎头资源"],
      },
    },
    resources: [
      { id: "r1", type: "space", name: "科创载体 · A 座 6F（可分割）", x: 18, y: 34, tags: ["写字楼", "可分割", "近地铁"], capacity: "200-800㎡", contact: "载体运营：刘老师" },
      { id: "r2", type: "space", name: "示例物流园 · 3 号库（冷链）", x: 72, y: 48, tags: ["仓库", "冷链", "可短租"], capacity: "100-500㎡", contact: "园区招商：张老师" },
      { id: "r3", type: "service", name: "锦城法务与知识产权服务中心", x: 40, y: 68, tags: ["法律", "知识产权"], capacity: "服务 7x12h", contact: "对接人：周老师" },
      { id: "r4", type: "service", name: "数字化转型服务商：青羊智数", x: 58, y: 26, tags: ["数据治理", "BI"], capacity: "驻场/远程", contact: "项目经理：李工" },
      { id: "r5", type: "finance", name: "成都市某银行 · 青羊支行", x: 86, y: 22, tags: ["普惠金融", "科创贷"], capacity: "授信 50-500 万", contact: "客户经理：赵经理" },
    ],
    geo: {
      districts: [
        { id: "gd1", name: "青羊区", x: 22, y: 42, enterprises: 1860, key_enterprises: 172, output_y: 980.5, tax_y: 128.4, heat: 92, cluster: "航空制造+数字服务", gap: "高能级中试载体不足" },
        { id: "gd2", name: "锦江区", x: 42, y: 28, enterprises: 1698, key_enterprises: 141, output_y: 903.2, tax_y: 116.7, heat: 86, cluster: "文商旅+总部经济", gap: "科技服务供给不足" },
        { id: "gd3", name: "武侯区", x: 50, y: 58, enterprises: 1932, key_enterprises: 188, output_y: 1068.1, tax_y: 139.2, heat: 95, cluster: "电子信息+生物医药", gap: "专业园区载体紧张" },
        { id: "gd4", name: "成华区", x: 69, y: 46, enterprises: 1506, key_enterprises: 119, output_y: 812.6, tax_y: 98.8, heat: 81, cluster: "智能制造+供应链", gap: "产业链金融覆盖偏弱" },
      ],
      streets: [
        {
          id: "gs1",
          district_id: "gd1",
          name: "金沙街道",
          x: 53.1,
          y: 55.11,
          enterprises: 386,
          key_enterprises: 39,
          land_eff: 0.86,
          heat: 88,
          warning: "低",
          cluster: "数字服务",
          invest_leads: 6
        },
        {
          id: "gs2",
          district_id: "gd1",
          name: "府南街道",
          x: 54.09,
          y: 56.02,
          enterprises: 422,
          key_enterprises: 45,
          land_eff: 0.91,
          heat: 90,
          warning: "中",
          cluster: "航空配套",
          invest_leads: 8
        },
        {
          id: "gs9",
          district_id: "gd1",
          name: "西御河街道",
          x: 56.52,
          y: 55.95,
          enterprises: 310,
          key_enterprises: 28,
          land_eff: 0.83,
          heat: 82,
          warning: "低",
          cluster: "金融科技",
          invest_leads: 5
        },
        {
          id: "gs10",
          district_id: "gd1",
          name: "草市街街道",
          x: 56.2,
          y: 56.06,
          enterprises: 275,
          key_enterprises: 18,
          land_eff: 0.78,
          heat: 76,
          warning: "低",
          cluster: "新消费+商贸",
          invest_leads: 4
        },
        {
          id: "gs11",
          district_id: "gd1",
          name: "少城街道",
          x: 55.39,
          y: 57.27,
          enterprises: 298,
          key_enterprises: 22,
          land_eff: 0.85,
          heat: 84,
          warning: "低",
          cluster: "文创+旅游",
          invest_leads: 5
        },
        {
          id: "gs12",
          district_id: "gd1",
          name: "草堂街道",
          x: 54.07,
          y: 58.55,
          enterprises: 265,
          key_enterprises: 24,
          land_eff: 0.8,
          heat: 79,
          warning: "低",
          cluster: "生物医药",
          invest_leads: 4
        },
        {
          id: "gs13",
          district_id: "gd1",
          name: "光华街道",
          x: 52.19,
          y: 56.96,
          enterprises: 340,
          key_enterprises: 30,
          land_eff: 0.87,
          heat: 85,
          warning: "低",
          cluster: "信息技术+云计算",
          invest_leads: 6
        },
        {
          id: "gs14",
          district_id: "gd1",
          name: "苏坡街道",
          x: 50.76,
          y: 57.39,
          enterprises: 358,
          key_enterprises: 26,
          land_eff: 0.82,
          heat: 80,
          warning: "中",
          cluster: "制造+物流",
          invest_leads: 5
        },
        {
          id: "gs15",
          district_id: "gd1",
          name: "文家街道",
          x: 49.23,
          y: 57.97,
          enterprises: 220,
          key_enterprises: 14,
          land_eff: 0.74,
          heat: 72,
          warning: "低",
          cluster: "环保+农业科技",
          invest_leads: 3
        },
        {
          id: "gs3",
          district_id: "gd2",
          name: "春熙路街道",
          x: 56.19,
          y: 57.82,
          enterprises: 510,
          key_enterprises: 37,
          land_eff: 0.95,
          heat: 84,
          warning: "低",
          cluster: "商贸消费",
          invest_leads: 5
        },
        {
          id: "gs4",
          district_id: "gd2",
          name: "书院街街道",
          x: 57.27,
          y: 57.06,
          enterprises: 288,
          key_enterprises: 22,
          land_eff: 0.79,
          heat: 77,
          warning: "中",
          cluster: "文化服务",
          invest_leads: 4
        },
        {
          id: "gs16",
          district_id: "gd2",
          name: "合江亭街道",
          x: 57.13,
          y: 58.55,
          enterprises: 395,
          key_enterprises: 32,
          land_eff: 0.9,
          heat: 86,
          warning: "低",
          cluster: "金融总部",
          invest_leads: 7
        },
        {
          id: "gs17",
          district_id: "gd2",
          name: "牛市口街道",
          x: 57.49,
          y: 58.88,
          enterprises: 328,
          key_enterprises: 25,
          land_eff: 0.84,
          heat: 80,
          warning: "中",
          cluster: "商贸服务",
          invest_leads: 4
        },
        {
          id: "gs5",
          district_id: "gd3",
          name: "火车南站街道",
          x: 56.56,
          y: 60.7,
          enterprises: 560,
          key_enterprises: 61,
          land_eff: 0.94,
          heat: 96,
          warning: "低",
          cluster: "电子信息",
          invest_leads: 9
        },
        {
          id: "gs6",
          district_id: "gd3",
          name: "望江路街道",
          x: 57.04,
          y: 59.06,
          enterprises: 470,
          key_enterprises: 44,
          land_eff: 0.89,
          heat: 92,
          warning: "低",
          cluster: "生物医药",
          invest_leads: 7
        },
        {
          id: "gs18",
          district_id: "gd3",
          name: "簇桥街道",
          x: 55.04,
          y: 63.16,
          enterprises: 410,
          key_enterprises: 35,
          land_eff: 0.86,
          heat: 88,
          warning: "低",
          cluster: "新能源+制造",
          invest_leads: 6
        },
        {
          id: "gs19",
          district_id: "gd3",
          name: "红牌楼街道",
          x: 54.58,
          y: 62.15,
          enterprises: 492,
          key_enterprises: 48,
          land_eff: 0.91,
          heat: 93,
          warning: "中",
          cluster: "电子商务+物流",
          invest_leads: 8
        },
        {
          id: "gs7",
          district_id: "gd4",
          name: "万年场街道",
          x: 59.35,
          y: 57.98,
          enterprises: 348,
          key_enterprises: 28,
          land_eff: 0.81,
          heat: 80,
          warning: "中",
          cluster: "供应链物流",
          invest_leads: 5
        },
        {
          id: "gs8",
          district_id: "gd4",
          name: "双桥子街道",
          x: 58.17,
          y: 57.45,
          enterprises: 302,
          key_enterprises: 26,
          land_eff: 0.77,
          heat: 75,
          warning: "高",
          cluster: "先进制造配套",
          invest_leads: 3
        },
        {
          id: "gs20",
          district_id: "gd4",
          name: "二仙桥街道",
          x: 60.18,
          y: 55.71,
          enterprises: 285,
          key_enterprises: 22,
          land_eff: 0.79,
          heat: 78,
          warning: "低",
          cluster: "文创+数字媒体",
          invest_leads: 4
        },
        {
          id: "gs21",
          district_id: "gd4",
          name: "龙潭街道",
          x: 62.15,
          y: 54.42,
          enterprises: 362,
          key_enterprises: 30,
          land_eff: 0.83,
          heat: 82,
          warning: "中",
          cluster: "汽车零部件",
          invest_leads: 5
        },
        {
          id: "gs22",
          district_id: "gd1",
          name: "黄田坝街道",
          x: 52.29,
          y: 54.65,
          enterprises: 276,
          key_enterprises: 24,
          land_eff: 0.84,
          heat: 81,
          warning: "低",
          cluster: "航空制造+高端装备",
          invest_leads: 6
        },
        {
          id: "gs23",
          district_id: "gd2",
          name: "东大街街道",
          x: 56.98,
          y: 57.39,
          enterprises: 336,
          key_enterprises: 29,
          land_eff: 0.89,
          heat: 85,
          warning: "低",
          cluster: "金融科技+总部服务",
          invest_leads: 7
        },
        {
          id: "gs24",
          district_id: "gd2",
          name: "盐市口街道",
          x: 56.26,
          y: 57.25,
          enterprises: 294,
          key_enterprises: 22,
          land_eff: 0.83,
          heat: 79,
          warning: "低",
          cluster: "文商旅+消费服务",
          invest_leads: 5
        },
        {
          id: "gs25",
          district_id: "gd3",
          name: "武侯街道",
          x: 54.73,
          y: 60.13,
          enterprises: 352,
          key_enterprises: 31,
          land_eff: 0.88,
          heat: 86,
          warning: "低",
          cluster: "低空制造+配套服务",
          invest_leads: 8
        },
        {
          id: "gs26",
          district_id: "gd3",
          name: "浆洗街街道",
          x: 55.35,
          y: 58.84,
          enterprises: 268,
          key_enterprises: 18,
          land_eff: 0.81,
          heat: 78,
          warning: "低",
          cluster: "文旅服务+特色商业",
          invest_leads: 4
        },
        {
          id: "gs27",
          district_id: "gd3",
          name: "玉林街道",
          x: 55.98,
          y: 58.8,
          enterprises: 318,
          key_enterprises: 26,
          land_eff: 0.86,
          heat: 84,
          warning: "低",
          cluster: "数据服务+智能应用",
          invest_leads: 6
        },
        {
          id: "gs28",
          district_id: "gd3",
          name: "芳草街街道",
          x: 55.75,
          y: 60.42,
          enterprises: 342,
          key_enterprises: 28,
          land_eff: 0.89,
          heat: 87,
          warning: "低",
          cluster: "工业软件+AI中试",
          invest_leads: 7
        },
        {
          id: "gs29",
          district_id: "gd3",
          name: "桂溪街道",
          x: 56.16,
          y: 62.3,
          enterprises: 388,
          key_enterprises: 34,
          land_eff: 0.91,
          heat: 90,
          warning: "低",
          cluster: "人工智能+算力服务",
          invest_leads: 9
        },
        {
          id: "gs30",
          district_id: "gd4",
          name: "府青路街道",
          x: 57.81,
          y: 55.1,
          enterprises: 245,
          key_enterprises: 19,
          land_eff: 0.82,
          heat: 77,
          warning: "中",
          cluster: "航空科创+数字文博",
          invest_leads: 4
        },
        {
          id: "gs31",
          district_id: "gd4",
          name: "猛追湾街道",
          x: 57.61,
          y: 56.8,
          enterprises: 304,
          key_enterprises: 23,
          land_eff: 0.84,
          heat: 80,
          warning: "低",
          cluster: "文商旅+社区商业",
          invest_leads: 5
        },
        {
          id: "gs32",
          district_id: "gd4",
          name: "建设路街道",
          x: 58.56,
          y: 56.67,
          enterprises: 362,
          key_enterprises: 30,
          land_eff: 0.87,
          heat: 85,
          warning: "低",
          cluster: "数字文创+低空场景",
          invest_leads: 7
        },
        {
          id: "gs33",
          district_id: "gd4",
          name: "驷马桥街道",
          x: 57.2,
          y: 55.37,
          enterprises: 226,
          key_enterprises: 17,
          land_eff: 0.79,
          heat: 74,
          warning: "中",
          cluster: "仓配物流+跨境服务",
          invest_leads: 4
        }
      ],
      parks: [
        { id: "gp1", district_id: "gd1", street_id: "gs2", name: "青羊经开区", x: 54.45, y: 55.42, enterprises: 312, key_enterprises: 33, land_eff: 0.92, heat: 91, cluster: "航空配套+智能制造", invest_leads: 10 },
        { id: "gp2", district_id: "gd1", street_id: "gs1", name: "少城文创谷", x: 51.66, y: 54.11, enterprises: 268, key_enterprises: 22, land_eff: 0.88, heat: 87, cluster: "文创+数字服务", invest_leads: 7 },
        { id: "gp7", district_id: "gd1", street_id: "gs12", name: "草堂科技产业园", x: 52.81, y: 58.15, enterprises: 186, key_enterprises: 18, land_eff: 0.84, heat: 82, cluster: "生物医药+医疗器械", invest_leads: 5 },
        { id: "gp8", district_id: "gd1", street_id: "gs13", name: "光华软件产业园", x: 52.19, y: 56.16, enterprises: 225, key_enterprises: 21, land_eff: 0.89, heat: 86, cluster: "信息技术+云计算", invest_leads: 6 },
        { id: "gp9", district_id: "gd1", street_id: "gs14", name: "苏坡工业集中区", x: 52.02, y: 56.19, enterprises: 198, key_enterprises: 16, land_eff: 0.80, heat: 78, cluster: "制造+物流", invest_leads: 4 },
        { id: "gp10", district_id: "gd1", street_id: "gs15", name: "文家生态产业园", x: 48.69, y: 58.97, enterprises: 120, key_enterprises: 8, land_eff: 0.72, heat: 68, cluster: "环保+农业科技", invest_leads: 2 },
        { id: "gp3", district_id: "gd2", street_id: "gs3", name: "春熙总部经济园", x: 56.01, y: 59.02, enterprises: 340, key_enterprises: 29, land_eff: 0.95, heat: 89, cluster: "总部经济+现代商贸", invest_leads: 8 },
        { id: "gp11", district_id: "gd2", street_id: "gs16", name: "合江亭金融科技园", x: 57.85, y: 59.15, enterprises: 258, key_enterprises: 26, land_eff: 0.92, heat: 88, cluster: "金融科技+总部", invest_leads: 7 },
        { id: "gp4", district_id: "gd3", street_id: "gs5", name: "武侯智造产业园", x: 57.64, y: 61.5, enterprises: 372, key_enterprises: 38, land_eff: 0.93, heat: 94, cluster: "电子信息+智能制造", invest_leads: 11 },
        { id: "gp5", district_id: "gd3", street_id: "gs6", name: "望江生物医药港", x: 56.32, y: 59.46, enterprises: 336, key_enterprises: 35, land_eff: 0.91, heat: 93, cluster: "生物医药+研发服务", invest_leads: 9 },
        { id: "gp12", district_id: "gd3", street_id: "gs19", name: "红牌楼电商产业园", x: 53.5, y: 62.35, enterprises: 280, key_enterprises: 28, land_eff: 0.88, heat: 90, cluster: "电子商务+直播", invest_leads: 7 },
        { id: "gp6", district_id: "gd4", street_id: "gs7", name: "东郊供应链园区", x: 59.89, y: 57.98, enterprises: 295, key_enterprises: 24, land_eff: 0.82, heat: 82, cluster: "供应链物流+先进制造", invest_leads: 6 },
        { id: "gp13", district_id: "gd4", street_id: "gs21", name: "龙潭汽车产业园", x: 62.33, y: 54.22, enterprises: 240, key_enterprises: 20, land_eff: 0.85, heat: 83, cluster: "汽车零部件+智能网联", invest_leads: 5 },
        { id: "gp21", district_id: "gd1", street_id: "gs10", name: "草市新消费服务港", x: 57.28, y: 55.26, enterprises: 126, key_enterprises: 8, land_eff: 0.79, heat: 78, cluster: "政务服务+新消费", invest_leads: 4 },
        { id: "gp14", district_id: "gd1", street_id: "gs11", name: "少城文创活力港", x: 56.83, y: 56.67, enterprises: 234, key_enterprises: 24, land_eff: 0.84, heat: 86, cluster: "文创数字+演艺消费", invest_leads: 6 },
        { id: "gp22", district_id: "gd1", street_id: "gs9", name: "太升金融科技街区", x: 55.8, y: 54.75, enterprises: 126, key_enterprises: 8, land_eff: 0.87, heat: 85, cluster: "金融科技+商务服务", invest_leads: 4 },
        { id: "gp15", district_id: "gd1", street_id: "gs22", name: "黄田坝航空创新园", x: 51.93, y: 53.65, enterprises: 198, key_enterprises: 18, land_eff: 0.86, heat: 88, cluster: "航空制造+适航服务", invest_leads: 7 },
        { id: "gp27", district_id: "gd4", street_id: "gs30", name: "府青航空科创港", x: 57.27, y: 54.5, enterprises: 108, key_enterprises: 8, land_eff: 0.84, heat: 84, cluster: "航空科创+低空应用", invest_leads: 4 },
        { id: "gp17", district_id: "gd3", street_id: "gs29", name: "桂溪智算创新园", x: 55.26, y: 63.1, enterprises: 180, key_enterprises: 15, land_eff: 0.85, heat: 87, cluster: "智算芯片+软件内容", invest_leads: 6 },
        { id: "gp19", district_id: "gd3", street_id: "gs28", name: "芳草工业AI中试园", x: 54.31, y: 60.42, enterprises: 144, key_enterprises: 9, land_eff: 0.81, heat: 82, cluster: "工业AI+中试检测", invest_leads: 5 },
        { id: "gp23", district_id: "gd3", street_id: "gs27", name: "玉林数据智能园", x: 56.52, y: 59.8, enterprises: 126, key_enterprises: 8, land_eff: 0.80, heat: 80, cluster: "数据智能+检测服务", invest_leads: 4 },
        { id: "gp18", district_id: "gd2", street_id: "gs23", name: "东大街金融服务港", x: 57.34, y: 57.79, enterprises: 180, key_enterprises: 15, land_eff: 0.88, heat: 89, cluster: "金融科技+资本服务", invest_leads: 6 },
        { id: "gp20", district_id: "gd4", street_id: "gs31", name: "猛追湾数字文博港", x: 57.43, y: 56.4, enterprises: 144, key_enterprises: 9, land_eff: 0.80, heat: 81, cluster: "数字文博+夜经济运营", invest_leads: 5 },
        { id: "gp24", district_id: "gd2", street_id: "gs24", name: "盐市口文旅策划园", x: 55, y: 57.85, enterprises: 126, key_enterprises: 8, land_eff: 0.81, heat: 79, cluster: "文旅策划+低空物流", invest_leads: 4 },
        { id: "gp25", district_id: "gd4", street_id: "gs33", name: "驷马桥智慧物流港", x: 57.2, y: 55.57, enterprises: 126, key_enterprises: 8, land_eff: 0.83, heat: 83, cluster: "智慧仓配+跨境服务", invest_leads: 4 },
        { id: "gp28", district_id: "gd2", street_id: "gs17", name: "牛市口品牌服务港", x: 58.21, y: 57.88, enterprises: 108, key_enterprises: 8, land_eff: 0.79, heat: 77, cluster: "品牌运营+商贸服务", invest_leads: 3 },
        { id: "gp16", district_id: "gd4", street_id: "gs32", name: "建设路数字文博园", x: 59.46, y: 57.87, enterprises: 198, key_enterprises: 18, land_eff: 0.82, heat: 84, cluster: "数字文博+工业感知", invest_leads: 6 },
        { id: "gp26", district_id: "gd3", street_id: "gs26", name: "浆洗文旅产业园", x: 56.61, y: 58.64, enterprises: 126, key_enterprises: 8, land_eff: 0.82, heat: 82, cluster: "文旅运营+文化IP", invest_leads: 4 },
      ],
      buildings: [
        {
          id: "gb1",
          street_id: "gs1",
          park_id: "gp2",
          x: 53.5,
          y: 55.71,
          name: "金沙科创中心 A 座",
          area_sqm: 32000,
          occupied_rate: 0.91,
          enterprises: 68,
          output_y: 15.8,
          tax_y: 2.6,
          heat: 93,
          lead_industry: "数字服务"
        },
        {
          id: "gb2",
          street_id: "gs1",
          park_id: "gp2",
          x: 54.3,
          y: 54.31,
          name: "西城智谷 2 号楼",
          area_sqm: 28500,
          occupied_rate: 0.86,
          enterprises: 49,
          output_y: 12.4,
          tax_y: 2.1,
          heat: 87,
          lead_industry: "数据技术"
        },
        {
          id: "gb3",
          street_id: "gs2",
          park_id: "gp1",
          x: 54.89,
          y: 56.42,
          name: "府南航空配套园 1 栋",
          area_sqm: 45000,
          occupied_rate: 0.88,
          enterprises: 57,
          output_y: 18.2,
          tax_y: 3.4,
          heat: 90,
          lead_industry: "航空配套"
        },
        {
          id: "gb4",
          street_id: "gs2",
          park_id: "gp1",
          x: 56.19,
          y: 57.52,
          name: "青羊工业载体 B 区",
          area_sqm: 39000,
          occupied_rate: 0.84,
          enterprises: 46,
          output_y: 14.5,
          tax_y: 2.9,
          heat: 86,
          lead_industry: "智能制造"
        },
        {
          id: "gb13",
          street_id: "gs9",
          park_id: "gp22",
          x: 57.02,
          y: 55.75,
          name: "太升金融中心",
          area_sqm: 38000,
          occupied_rate: 0.93,
          enterprises: 72,
          output_y: 18.5,
          tax_y: 3.2,
          heat: 90,
          lead_industry: "金融科技"
        },
        {
          id: "gb14",
          street_id: "gs10",
          park_id: "gp21",
          x: 57,
          y: 55.56,
          name: "太升商贸城",
          area_sqm: 22000,
          occupied_rate: 0.82,
          enterprises: 38,
          output_y: 8.6,
          tax_y: 1.4,
          heat: 75,
          lead_industry: "新消费"
        },
        {
          id: "gb15",
          street_id: "gs11",
          park_id: "gp14",
          x: 55.89,
          y: 58.07,
          name: "宽巷子文创园 A 座",
          area_sqm: 18000,
          occupied_rate: 0.88,
          enterprises: 35,
          output_y: 7.2,
          tax_y: 1.1,
          heat: 82,
          lead_industry: "文创"
        },
        {
          id: "gb16",
          street_id: "gs11",
          park_id: "gp14",
          x: 56.49,
          y: 56.77,
          name: "宽巷子文创园 B 座",
          area_sqm: 16000,
          occupied_rate: 0.85,
          enterprises: 28,
          output_y: 5.8,
          tax_y: 0.9,
          heat: 80,
          lead_industry: "数字文创"
        },
        {
          id: "gb17",
          street_id: "gs12",
          park_id: "gp7",
          x: 54.87,
          y: 58.75,
          name: "草堂科技产业园 2 栋",
          area_sqm: 26000,
          occupied_rate: 0.87,
          enterprises: 42,
          output_y: 11.5,
          tax_y: 2,
          heat: 84,
          lead_industry: "医疗器械"
        },
        {
          id: "gb18",
          street_id: "gs12",
          park_id: "gp7",
          x: 55.57,
          y: 59.35,
          name: "草堂科技产业园 5 栋",
          area_sqm: 22000,
          occupied_rate: 0.8,
          enterprises: 30,
          output_y: 8.2,
          tax_y: 1.3,
          heat: 78,
          lead_industry: "生物技术"
        },
        {
          id: "gb19",
          street_id: "gs13",
          park_id: "gp8",
          x: 52.69,
          y: 57.16,
          name: "光华国际大厦",
          area_sqm: 42000,
          occupied_rate: 0.92,
          enterprises: 85,
          output_y: 22.4,
          tax_y: 3.8,
          heat: 91,
          lead_industry: "信息技术"
        },
        {
          id: "gb20",
          street_id: "gs13",
          park_id: "gp8",
          x: 51.75,
          y: 56.24,
          name: "光华云计算中心",
          area_sqm: 35000,
          occupied_rate: 0.89,
          enterprises: 60,
          output_y: 16.8,
          tax_y: 2.8,
          heat: 88,
          lead_industry: "云计算"
        },
        {
          id: "gb21",
          street_id: "gs14",
          park_id: "gp9",
          x: 50.96,
          y: 57.89,
          name: "苏坡工业集中区 5 号厂房",
          area_sqm: 48000,
          occupied_rate: 0.78,
          enterprises: 45,
          output_y: 12.8,
          tax_y: 2.2,
          heat: 76,
          lead_industry: "机械制造"
        },
        {
          id: "gb22",
          street_id: "gs14",
          park_id: "gp9",
          x: 50.56,
          y: 58.59,
          name: "苏坡物流园 A 区",
          area_sqm: 55000,
          occupied_rate: 0.85,
          enterprises: 38,
          output_y: 15.2,
          tax_y: 2.5,
          heat: 80,
          lead_industry: "物流仓配"
        },
        {
          id: "gb23",
          street_id: "gs14",
          park_id: "gp9",
          x: 51.26,
          y: 57.39,
          name: "苏坡物流园 B 区",
          area_sqm: 42000,
          occupied_rate: 0.82,
          enterprises: 32,
          output_y: 13.5,
          tax_y: 2.1,
          heat: 78,
          lead_industry: "冷链物流"
        },
        {
          id: "gb24",
          street_id: "gs15",
          park_id: "gp10",
          x: 49.43,
          y: 58.77,
          name: "文家生态产业园 A 区",
          area_sqm: 30000,
          occupied_rate: 0.72,
          enterprises: 25,
          output_y: 5.6,
          tax_y: 0.8,
          heat: 66,
          lead_industry: "环保科技"
        },
        {
          id: "gb25",
          street_id: "gs15",
          park_id: "gp10",
          x: 48.73,
          y: 59.17,
          name: "文家生态产业园 C 区",
          area_sqm: 25000,
          occupied_rate: 0.68,
          enterprises: 18,
          output_y: 3.8,
          tax_y: 0.5,
          heat: 62,
          lead_industry: "农业科技"
        },
        {
          id: "gb5",
          street_id: "gs3",
          park_id: "gp3",
          x: 56.41,
          y: 58.54,
          name: "春熙总部港",
          area_sqm: 36000,
          occupied_rate: 0.94,
          enterprises: 73,
          output_y: 16.7,
          tax_y: 3.1,
          heat: 85,
          lead_industry: "总部经济"
        },
        {
          id: "gb6",
          street_id: "gs4",
          park_id: "gp3",
          x: 57.93,
          y: 57.54,
          name: "书院文创大厦",
          area_sqm: 25000,
          occupied_rate: 0.79,
          enterprises: 41,
          output_y: 9.8,
          tax_y: 1.6,
          heat: 76,
          lead_industry: "文创服务"
        },
        {
          id: "gb26",
          street_id: "gs16",
          park_id: "gp11",
          x: 56.91,
          y: 58.55,
          name: "合江亭金融大厦",
          area_sqm: 40000,
          occupied_rate: 0.95,
          enterprises: 82,
          output_y: 24.6,
          tax_y: 4.2,
          heat: 92,
          lead_industry: "金融总部"
        },
        {
          id: "gb7",
          street_id: "gs5",
          park_id: "gp4",
          x: 60.59,
          y: 62.78,
          name: "南站电子信息港",
          area_sqm: 52000,
          occupied_rate: 0.95,
          enterprises: 89,
          output_y: 26.3,
          tax_y: 4.8,
          heat: 97,
          lead_industry: "电子信息"
        },
        {
          id: "gb8",
          street_id: "gs5",
          park_id: "gp4",
          x: 58.99,
          y: 61.28,
          name: "科创孵化器 C 栋",
          area_sqm: 31000,
          occupied_rate: 0.92,
          enterprises: 64,
          output_y: 17.9,
          tax_y: 3,
          heat: 94,
          lead_industry: "软件服务"
        },
        {
          id: "gb9",
          street_id: "gs6",
          park_id: "gp5",
          x: 57.04,
          y: 59.06,
          name: "望江生物医药中心",
          area_sqm: 47000,
          occupied_rate: 0.9,
          enterprises: 58,
          output_y: 20.2,
          tax_y: 3.7,
          heat: 92,
          lead_industry: "生物医药"
        },
        {
          id: "gb27",
          street_id: "gs19",
          park_id: "gp12",
          x: 54.8,
          y: 61.91,
          name: "红牌楼电商大厦",
          area_sqm: 34000,
          occupied_rate: 0.91,
          enterprises: 66,
          output_y: 14.2,
          tax_y: 2.5,
          heat: 89,
          lead_industry: "电子商务"
        },
        {
          id: "gb10",
          street_id: "gs7",
          park_id: "gp6",
          x: 59.35,
          y: 57.98,
          name: "万年供应链枢纽",
          area_sqm: 43000,
          occupied_rate: 0.83,
          enterprises: 52,
          output_y: 13.6,
          tax_y: 2.4,
          heat: 81,
          lead_industry: "供应链物流"
        },
        {
          id: "gb11",
          street_id: "gs8",
          park_id: "gp6",
          x: 58.61,
          y: 56.73,
          name: "双桥先进制造中心",
          area_sqm: 41000,
          occupied_rate: 0.74,
          enterprises: 37,
          output_y: 10.1,
          tax_y: 1.8,
          heat: 73,
          lead_industry: "先进制造"
        },
        {
          id: "gb12",
          street_id: "gs8",
          park_id: "gp6",
          x: 59.05,
          y: 56.49,
          name: "东部工业服务大厦",
          area_sqm: 29000,
          occupied_rate: 0.71,
          enterprises: 31,
          output_y: 8.4,
          tax_y: 1.4,
          heat: 69,
          lead_industry: "工业服务"
        },
        {
          id: "gb28",
          street_id: "gs21",
          park_id: "gp13",
          x: 62.15,
          y: 54.42,
          name: "龙潭汽车科技大厦",
          area_sqm: 38000,
          occupied_rate: 0.86,
          enterprises: 55,
          output_y: 16.5,
          tax_y: 2.8,
          heat: 84,
          lead_industry: "汽车零部件"
        },
        {
          id: "gbs001",
          street_id: "gs1",
          park_id: "gp2",
          x: 53.61,
          y: 55.72,
          name: "示例路 88 号 A 栋",
          area_sqm: 22032,
          occupied_rate: 0.82,
          enterprises: 1,
          output_y: 2.4,
          tax_y: 0.2,
          heat: 79,
          lead_industry: "智能制造"
        },
        {
          id: "gbs002",
          street_id: "gs12",
          park_id: "gp7",
          x: 54.06,
          y: 60.26,
          name: "科创大道 16 号",
          area_sqm: 24187,
          occupied_rate: 0.85,
          enterprises: 1,
          output_y: 0.6,
          tax_y: 0,
          heat: 72,
          lead_industry: "生物医药"
        },
        {
          id: "gbs003",
          street_id: "gs1",
          park_id: "gp2",
          x: 55.37,
          y: 57.25,
          name: "锦官城写字楼",
          area_sqm: 28474,
          occupied_rate: 0.86,
          enterprises: 1,
          output_y: 1.3,
          tax_y: 0.1,
          heat: 85,
          lead_industry: "创新服务"
        },
        {
          id: "gbs004",
          street_id: "gs14",
          park_id: "gp9",
          x: 51.74,
          y: 58.95,
          name: "示例物流园 3 号库",
          area_sqm: 25365,
          occupied_rate: 0.79,
          enterprises: 1,
          output_y: 3.1,
          tax_y: 0.2,
          heat: 82,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs005",
          street_id: "gs1",
          park_id: "gp2",
          x: 54.68,
          y: 56.65,
          name: "示例路 102 号 C 栋",
          area_sqm: 28236,
          occupied_rate: 0.74,
          enterprises: 1,
          output_y: 0.9,
          tax_y: 0.1,
          heat: 71,
          lead_industry: "智能制造"
        },
        {
          id: "gbs006",
          street_id: "gs10",
          park_id: "gp21",
          x: 56.77,
          y: 55.78,
          name: "政务服务中心",
          area_sqm: 39671,
          occupied_rate: 0.75,
          enterprises: 1,
          output_y: 0.2,
          tax_y: 0,
          heat: 80,
          lead_industry: "创新服务"
        },
        {
          id: "gbs007",
          street_id: "gs12",
          park_id: "gp7",
          x: 55.83,
          y: 60.08,
          name: "草堂北路 56 号",
          area_sqm: 38198,
          occupied_rate: 0.86,
          enterprises: 1,
          output_y: 4.2,
          tax_y: 0.2,
          heat: 77,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs008",
          street_id: "gs2",
          park_id: "gp1",
          x: 56.55,
          y: 57.13,
          name: "青羊经开区创新大道 18 号 A2",
          area_sqm: 39233,
          occupied_rate: 0.77,
          enterprises: 1,
          output_y: 0.9,
          tax_y: 0.1,
          heat: 78,
          lead_industry: "智能制造"
        },
        {
          id: "gbs009",
          street_id: "gs5",
          park_id: "gp4",
          x: 56.89,
          y: 60.12,
          name: "武侯智造园新材路 6 号",
          area_sqm: 21416,
          occupied_rate: 0.86,
          enterprises: 1,
          output_y: 1.8,
          tax_y: 0.1,
          heat: 79,
          lead_industry: "智能制造"
        },
        {
          id: "gbs010",
          street_id: "gs22",
          park_id: "gp15",
          x: 51,
          y: 54.28,
          name: "青羊总部基地标准楼",
          area_sqm: 24982,
          occupied_rate: 0.88,
          enterprises: 1,
          output_y: 0.4,
          tax_y: 0,
          heat: 73,
          lead_industry: "创新服务"
        },
        {
          id: "gbs011",
          street_id: "gs30",
          park_id: "gp27",
          x: 58.45,
          y: 54.88,
          name: "成华航空科创港 3 栋",
          area_sqm: 29287,
          occupied_rate: 0.77,
          enterprises: 1,
          output_y: 0.8,
          tax_y: 0,
          heat: 84,
          lead_industry: "智能制造"
        },
        {
          id: "gbs012",
          street_id: "gs2",
          park_id: "gp1",
          x: 54.47,
          y: 56.38,
          name: "青羊经开区腾飞路 88 号",
          area_sqm: 21740,
          occupied_rate: 0.74,
          enterprises: 1,
          output_y: 3.3,
          tax_y: 0.3,
          heat: 87,
          lead_industry: "智能制造"
        },
        {
          id: "gbs013",
          street_id: "gs12",
          park_id: "gp7",
          x: 53.8,
          y: 60.03,
          name: "青羊航空研发楼",
          area_sqm: 36085,
          occupied_rate: 0.73,
          enterprises: 1,
          output_y: 0.4,
          tax_y: 0,
          heat: 78,
          lead_industry: "创新服务"
        },
        {
          id: "gbs014",
          street_id: "gs8",
          park_id: "gp6",
          x: 57.51,
          y: 58.17,
          name: "成华航空配套园 12 号",
          area_sqm: 18282,
          occupied_rate: 0.72,
          enterprises: 1,
          output_y: 2.2,
          tax_y: 0.2,
          heat: 69,
          lead_industry: "智能制造"
        },
        {
          id: "gbs015",
          street_id: "gs4",
          park_id: "gp3",
          x: 57.05,
          y: 57.54,
          name: "锦江智慧物流港 2 号楼",
          area_sqm: 19771,
          occupied_rate: 0.87,
          enterprises: 1,
          output_y: 0.7,
          tax_y: 0,
          heat: 80,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs016",
          street_id: "gs19",
          park_id: "gp12",
          x: 54.93,
          y: 63.04,
          name: "武侯低空服务中心",
          area_sqm: 22368,
          occupied_rate: 0.86,
          enterprises: 1,
          output_y: 0.3,
          tax_y: 0,
          heat: 79,
          lead_industry: "创新服务"
        },
        {
          id: "gbs017",
          street_id: "gs29",
          park_id: "gp17",
          x: 54.14,
          y: 63.85,
          name: "武侯智算谷 1 栋",
          area_sqm: 26361,
          occupied_rate: 0.75,
          enterprises: 1,
          output_y: 1,
          tax_y: 0.1,
          heat: 86,
          lead_industry: "智能制造"
        },
        {
          id: "gbs018",
          street_id: "gs28",
          park_id: "gp19",
          x: 54.96,
          y: 60.5,
          name: "武侯AI中试楼",
          area_sqm: 18126,
          occupied_rate: 0.82,
          enterprises: 1,
          output_y: 0.6,
          tax_y: 0,
          heat: 81,
          lead_industry: "创新服务"
        },
        {
          id: "gbs019",
          street_id: "gs29",
          park_id: "gp17",
          x: 54.87,
          y: 60.32,
          name: "高新孵化园 B 座",
          area_sqm: 30783,
          occupied_rate: 0.83,
          enterprises: 1,
          output_y: 0.7,
          tax_y: 0,
          heat: 72,
          lead_industry: "创新服务"
        },
        {
          id: "gbs020",
          street_id: "gs29",
          park_id: "gp17",
          x: 56.16,
          y: 61.5,
          name: "天府软件园政务楼",
          area_sqm: 17091,
          occupied_rate: 0.81,
          enterprises: 1,
          output_y: 0.5,
          tax_y: 0,
          heat: 72,
          lead_industry: "创新服务"
        },
        {
          id: "gbs021",
          street_id: "gs27",
          park_id: "gp23",
          x: 54.61,
          y: 58.35,
          name: "武侯数据街 2 号",
          area_sqm: 26210,
          occupied_rate: 0.76,
          enterprises: 1,
          output_y: 0.6,
          tax_y: 0.1,
          heat: 69,
          lead_industry: "创新服务"
        },
        {
          id: "gbs022",
          street_id: "gs23",
          park_id: "gp18",
          x: 57.7,
          y: 57.25,
          name: "锦江金融城",
          area_sqm: 21233,
          occupied_rate: 0.87,
          enterprises: 1,
          output_y: 0.5,
          tax_y: 0,
          heat: 70,
          lead_industry: "创新服务"
        },
        {
          id: "gbs023",
          street_id: "gs11",
          park_id: "gp14",
          x: 54.99,
          y: 57.71,
          name: "宽窄巷子文旅运营中心",
          area_sqm: 16632,
          occupied_rate: 0.86,
          enterprises: 1,
          output_y: 1.5,
          tax_y: 0.1,
          heat: 71,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs024",
          street_id: "gs3",
          park_id: "gp3",
          x: 53.84,
          y: 58.34,
          name: "春熙路新媒体中心",
          area_sqm: 17055,
          occupied_rate: 0.83,
          enterprises: 1,
          output_y: 0.9,
          tax_y: 0.1,
          heat: 84,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs025",
          street_id: "gs11",
          park_id: "gp14",
          x: 56.85,
          y: 55.2,
          name: "少城国际文创谷 3 号楼",
          area_sqm: 32974,
          occupied_rate: 0.72,
          enterprises: 1,
          output_y: 0.5,
          tax_y: 0,
          heat: 81,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs026",
          street_id: "gs31",
          park_id: "gp20",
          x: 56.88,
          y: 55.34,
          name: "成华数字文博基地 4 栋",
          area_sqm: 38029,
          occupied_rate: 0.83,
          enterprises: 1,
          output_y: 0.6,
          tax_y: 0,
          heat: 74,
          lead_industry: "创新服务"
        },
        {
          id: "gbs027",
          street_id: "gs24",
          park_id: "gp24",
          x: 55.78,
          y: 57.61,
          name: "锦江文旅策划中心",
          area_sqm: 22020,
          occupied_rate: 0.84,
          enterprises: 1,
          output_y: 0.4,
          tax_y: 0,
          heat: 71,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs028",
          street_id: "gs16",
          park_id: "gp11",
          x: 55.64,
          y: 60.19,
          name: "锦江媒体港",
          area_sqm: 16075,
          occupied_rate: 0.81,
          enterprises: 1,
          output_y: 0.4,
          tax_y: 0,
          heat: 72,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs029",
          street_id: "gs23",
          park_id: "gp18",
          x: 56.99,
          y: 58.2,
          name: "金融城南塔",
          area_sqm: 39178,
          occupied_rate: 0.76,
          enterprises: 1,
          output_y: 0.7,
          tax_y: 0.1,
          heat: 77,
          lead_industry: "创新服务"
        },
        {
          id: "gbs030",
          street_id: "gs2",
          park_id: "gp1",
          x: 54.24,
          y: 56.17,
          name: "青羊产融中心",
          area_sqm: 35176,
          occupied_rate: 0.84,
          enterprises: 1,
          output_y: 0.3,
          tax_y: 0,
          heat: 79,
          lead_industry: "创新服务"
        },
        {
          id: "gbs031",
          street_id: "gs3",
          park_id: "gp3",
          x: 53.17,
          y: 60.55,
          name: "锦江商圈服务楼",
          area_sqm: 35297,
          occupied_rate: 0.87,
          enterprises: 1,
          output_y: 0.5,
          tax_y: 0,
          heat: 70,
          lead_industry: "创新服务"
        },
        {
          id: "gbs032",
          street_id: "gs3",
          park_id: "gp3",
          x: 55.86,
          y: 58.38,
          name: "春熙路数字商业大厦",
          area_sqm: 18146,
          occupied_rate: 0.82,
          enterprises: 1,
          output_y: 2.1,
          tax_y: 0.1,
          heat: 81,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs033",
          street_id: "gs33",
          park_id: "gp25",
          x: 56.73,
          y: 54.14,
          name: "国际铁路港智慧仓配园",
          area_sqm: 20931,
          occupied_rate: 0.73,
          enterprises: 1,
          output_y: 1.7,
          tax_y: 0.1,
          heat: 80,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs034",
          street_id: "gs17",
          park_id: "gp28",
          x: 58.44,
          y: 60.55,
          name: "锦江品牌港",
          area_sqm: 31620,
          occupied_rate: 0.76,
          enterprises: 1,
          output_y: 0.7,
          tax_y: 0.1,
          heat: 87,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs035",
          street_id: "gs31",
          park_id: "gp20",
          x: 56.96,
          y: 55.4,
          name: "建设路商圈运营楼",
          area_sqm: 34045,
          occupied_rate: 0.83,
          enterprises: 1,
          output_y: 1.2,
          tax_y: 0.1,
          heat: 86,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs036",
          street_id: "gs33",
          park_id: "gp25",
          x: 59.28,
          y: 53.87,
          name: "青白江跨境服务港",
          area_sqm: 16398,
          occupied_rate: 0.78,
          enterprises: 1,
          output_y: 0.7,
          tax_y: 0,
          heat: 73,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs037",
          street_id: "gs2",
          park_id: "gp1",
          x: 56.48,
          y: 57.07,
          name: "青羊法务服务中心",
          area_sqm: 21727,
          occupied_rate: 0.89,
          enterprises: 1,
          output_y: 0.3,
          tax_y: 0,
          heat: 84,
          lead_industry: "创新服务"
        },
        {
          id: "gbs038",
          street_id: "gs23",
          park_id: "gp18",
          x: 57.78,
          y: 58.92,
          name: "金融城财税服务楼",
          area_sqm: 37840,
          occupied_rate: 0.84,
          enterprises: 1,
          output_y: 0.3,
          tax_y: 0,
          heat: 83,
          lead_industry: "创新服务"
        },
        {
          id: "gbs039",
          street_id: "gs2",
          park_id: "gp1",
          x: 54.85,
          y: 55.64,
          name: "青羊航空配套园 6 栋",
          area_sqm: 28457,
          occupied_rate: 0.83,
          enterprises: 1,
          output_y: 1.6,
          tax_y: 0.1,
          heat: 70,
          lead_industry: "智能制造"
        },
        {
          id: "gbs040",
          street_id: "gs2",
          park_id: "gp1",
          x: 55.01,
          y: 55.78,
          name: "青羊经开区精工路 12 号",
          area_sqm: 39645,
          occupied_rate: 0.89,
          enterprises: 1,
          output_y: 2.2,
          tax_y: 0.2,
          heat: 70,
          lead_industry: "智能制造"
        },
        {
          id: "gbs041",
          street_id: "gs12",
          park_id: "gp7",
          x: 55.99,
          y: 60.21,
          name: "青羊航空研发基地",
          area_sqm: 24100,
          occupied_rate: 0.72,
          enterprises: 1,
          output_y: 0.5,
          tax_y: 0,
          heat: 75,
          lead_industry: "创新服务"
        },
        {
          id: "gbs042",
          street_id: "gs22",
          park_id: "gp15",
          x: 52.03,
          y: 53.61,
          name: "双流航修服务园 2 号楼",
          area_sqm: 18543,
          occupied_rate: 0.73,
          enterprises: 1,
          output_y: 0.9,
          tax_y: 0.1,
          heat: 80,
          lead_industry: "创新服务"
        },
        {
          id: "gbs043",
          street_id: "gs32",
          park_id: "gp16",
          x: 60.72,
          y: 55.24,
          name: "成华低空场景中心",
          area_sqm: 28094,
          occupied_rate: 0.76,
          enterprises: 1,
          output_y: 0.8,
          tax_y: 0,
          heat: 69,
          lead_industry: "智能制造"
        },
        {
          id: "gbs044",
          street_id: "gs19",
          park_id: "gp12",
          x: 54.31,
          y: 64.23,
          name: "武侯低空综合服务港",
          area_sqm: 25745,
          occupied_rate: 0.79,
          enterprises: 1,
          output_y: 0.6,
          tax_y: 0,
          heat: 86,
          lead_industry: "创新服务"
        },
        {
          id: "gbs045",
          street_id: "gs4",
          park_id: "gp3",
          x: 59.29,
          y: 53.1,
          name: "锦江智慧城服中心",
          area_sqm: 40792,
          occupied_rate: 0.88,
          enterprises: 1,
          output_y: 0.7,
          tax_y: 0,
          heat: 83,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs046",
          street_id: "gs28",
          park_id: "gp19",
          x: 57.26,
          y: 61,
          name: "武侯工业AI港",
          area_sqm: 18707,
          occupied_rate: 0.87,
          enterprises: 1,
          output_y: 0.6,
          tax_y: 0,
          heat: 76,
          lead_industry: "创新服务"
        },
        {
          id: "gbs047",
          street_id: "gs27",
          park_id: "gp23",
          x: 56.38,
          y: 59.96,
          name: "武侯智能检测楼",
          area_sqm: 30722,
          occupied_rate: 0.86,
          enterprises: 1,
          output_y: 0.7,
          tax_y: 0.1,
          heat: 85,
          lead_industry: "创新服务"
        },
        {
          id: "gbs048",
          street_id: "gs28",
          park_id: "gp19",
          x: 56.29,
          y: 60.12,
          name: "武侯智造中台",
          area_sqm: 36901,
          occupied_rate: 0.87,
          enterprises: 1,
          output_y: 0.7,
          tax_y: 0.1,
          heat: 74,
          lead_industry: "创新服务"
        },
        {
          id: "gbs049",
          street_id: "gs1",
          park_id: "gp2",
          x: 55.83,
          y: 57.66,
          name: "金沙遗址数字文博中心",
          area_sqm: 40396,
          occupied_rate: 0.88,
          enterprises: 1,
          output_y: 0.6,
          tax_y: 0,
          heat: 83,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs050",
          street_id: "gs12",
          park_id: "gp7",
          x: 54.92,
          y: 59.28,
          name: "杜甫草堂文化服务楼",
          area_sqm: 22602,
          occupied_rate: 0.86,
          enterprises: 1,
          output_y: 0.5,
          tax_y: 0,
          heat: 73,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs051",
          street_id: "gs11",
          park_id: "gp14",
          x: 53.57,
          y: 59.01,
          name: "宽窄巷子少城夜游中心",
          area_sqm: 37963,
          occupied_rate: 0.75,
          enterprises: 1,
          output_y: 1.1,
          tax_y: 0.1,
          heat: 80,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs052",
          street_id: "gs11",
          park_id: "gp14",
          x: 53.17,
          y: 56.04,
          name: "青羊文创版权中心",
          area_sqm: 19184,
          occupied_rate: 0.78,
          enterprises: 1,
          output_y: 0.4,
          tax_y: 0,
          heat: 87,
          lead_industry: "创新服务"
        },
        {
          id: "gbs053",
          street_id: "gs2",
          park_id: "gp1",
          x: 55.95,
          y: 56.6,
          name: "青羊总部商务港",
          area_sqm: 35801,
          occupied_rate: 0.85,
          enterprises: 1,
          output_y: 0.6,
          tax_y: 0.1,
          heat: 70,
          lead_industry: "创新服务"
        },
        {
          id: "gbs054",
          street_id: "gs2",
          park_id: "gp1",
          x: 55.34,
          y: 57.13,
          name: "青羊商圈数字中台",
          area_sqm: 32326,
          occupied_rate: 0.84,
          enterprises: 1,
          output_y: 1.2,
          tax_y: 0.1,
          heat: 81,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs055",
          street_id: "gs3",
          park_id: "gp3",
          x: 53.14,
          y: 60.53,
          name: "太古里时尚运营中心",
          area_sqm: 32391,
          occupied_rate: 0.81,
          enterprises: 1,
          output_y: 1.9,
          tax_y: 0.1,
          heat: 76,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs056",
          street_id: "gs3",
          park_id: "gp3",
          x: 56.29,
          y: 58.75,
          name: "IFS 国际品牌服务楼",
          area_sqm: 20636,
          occupied_rate: 0.74,
          enterprises: 1,
          output_y: 0.8,
          tax_y: 0.1,
          heat: 71,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs057",
          street_id: "gs16",
          park_id: "gp11",
          x: 58.36,
          y: 59.77,
          name: "锦江夜游文旅中心",
          area_sqm: 39141,
          occupied_rate: 0.83,
          enterprises: 1,
          output_y: 1.4,
          tax_y: 0.1,
          heat: 82,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs058",
          street_id: "gs23",
          park_id: "gp18",
          x: 58.33,
          y: 59.43,
          name: "东大街金融城",
          area_sqm: 29282,
          occupied_rate: 0.76,
          enterprises: 1,
          output_y: 1,
          tax_y: 0.1,
          heat: 69,
          lead_industry: "创新服务"
        },
        {
          id: "gbs059",
          street_id: "gs22",
          park_id: "gp15",
          x: 51.78,
          y: 54.86,
          name: "青羊航空贸易港",
          area_sqm: 28275,
          occupied_rate: 0.85,
          enterprises: 1,
          output_y: 0.7,
          tax_y: 0.1,
          heat: 68,
          lead_industry: "创新服务"
        },
        {
          id: "gbs060",
          street_id: "gs11",
          park_id: "gp14",
          x: 54.85,
          y: 55.98,
          name: "少城文创金融港",
          area_sqm: 22839,
          occupied_rate: 0.75,
          enterprises: 1,
          output_y: 0.5,
          tax_y: 0,
          heat: 72,
          lead_industry: "创新服务"
        },
        {
          id: "gbs061",
          street_id: "gs11",
          park_id: "gp14",
          x: 55.65,
          y: 58.31,
          name: "宽窄巷子演艺中心",
          area_sqm: 17510,
          occupied_rate: 0.86,
          enterprises: 1,
          output_y: 0.9,
          tax_y: 0.1,
          heat: 73,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs062",
          street_id: "gs3",
          park_id: "gp3",
          x: 56.17,
          y: 60.38,
          name: "太古里时尚体验中心",
          area_sqm: 41541,
          occupied_rate: 0.89,
          enterprises: 1,
          output_y: 1.5,
          tax_y: 0.1,
          heat: 82,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs063",
          street_id: "gs3",
          park_id: "gp3",
          x: 56.16,
          y: 58.64,
          name: "锦江商圈算法中心",
          area_sqm: 38540,
          occupied_rate: 0.88,
          enterprises: 1,
          output_y: 1,
          tax_y: 0.1,
          heat: 87,
          lead_industry: "创新服务"
        },
        {
          id: "gbs064",
          street_id: "gs24",
          park_id: "gp24",
          x: 56.95,
          y: 57.08,
          name: "锦江低空物流指挥中心",
          area_sqm: 22203,
          occupied_rate: 0.87,
          enterprises: 1,
          output_y: 0.9,
          tax_y: 0.1,
          heat: 80,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs065",
          street_id: "gs22",
          park_id: "gp15",
          x: 50.24,
          y: 53.58,
          name: "青羊航电产业楼",
          area_sqm: 39706,
          occupied_rate: 0.84,
          enterprises: 1,
          output_y: 1,
          tax_y: 0.1,
          heat: 77,
          lead_industry: "智能制造"
        },
        {
          id: "gbs066",
          street_id: "gs29",
          park_id: "gp17",
          x: 55.13,
          y: 60.56,
          name: "武侯智算芯谷",
          area_sqm: 16889,
          occupied_rate: 0.89,
          enterprises: 1,
          output_y: 1.2,
          tax_y: 0.1,
          heat: 86,
          lead_industry: "创新服务"
        },
        {
          id: "gbs067",
          street_id: "gs23",
          park_id: "gp18",
          x: 59.18,
          y: 56,
          name: "金融城资本服务港",
          area_sqm: 16496,
          occupied_rate: 0.8,
          enterprises: 1,
          output_y: 0.9,
          tax_y: 0.1,
          heat: 83,
          lead_industry: "创新服务"
        },
        {
          id: "gbs068",
          street_id: "gs2",
          park_id: "gp1",
          x: 56.51,
          y: 57.09,
          name: "青羊科创服务综合体",
          area_sqm: 23183,
          occupied_rate: 0.79,
          enterprises: 1,
          output_y: 0.8,
          tax_y: 0.1,
          heat: 72,
          lead_industry: "创新服务"
        },
        {
          id: "gbs069",
          street_id: "gs32",
          park_id: "gp16",
          x: 58.51,
          y: 57.42,
          name: "成华城市感知港",
          area_sqm: 34926,
          occupied_rate: 0.72,
          enterprises: 1,
          output_y: 1.1,
          tax_y: 0.1,
          heat: 81,
          lead_industry: "创新服务"
        },
        {
          id: "gbs070",
          street_id: "gs26",
          park_id: "gp26",
          x: 57.54,
          y: 57.44,
          name: "武侯祠文旅运营中心",
          area_sqm: 22252,
          occupied_rate: 0.72,
          enterprises: 1,
          output_y: 1.2,
          tax_y: 0.1,
          heat: 83,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs071",
          street_id: "gs26",
          park_id: "gp26",
          x: 55.38,
          y: 58.07,
          name: "锦里民俗体验街",
          area_sqm: 19381,
          occupied_rate: 0.77,
          enterprises: 1,
          output_y: 0.8,
          tax_y: 0.1,
          heat: 78,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs072",
          street_id: "gs22",
          park_id: "gp15",
          x: 51,
          y: 54.28,
          name: "青羊高端装备园 5 号楼",
          area_sqm: 32214,
          occupied_rate: 0.88,
          enterprises: 1,
          output_y: 2,
          tax_y: 0.1,
          heat: 69,
          lead_industry: "智能制造"
        },
        {
          id: "gbs073",
          street_id: "gs29",
          park_id: "gp17",
          x: 54.63,
          y: 64.3,
          name: "高新数字内容港",
          area_sqm: 34983,
          occupied_rate: 0.77,
          enterprises: 1,
          output_y: 0.9,
          tax_y: 0.1,
          heat: 72,
          lead_industry: "创新服务"
        },
        {
          id: "gbs074",
          street_id: "gs2",
          park_id: "gp1",
          x: 56.04,
          y: 57.75,
          name: "青羊产融服务楼",
          area_sqm: 16048,
          occupied_rate: 0.84,
          enterprises: 1,
          output_y: 0.9,
          tax_y: 0.1,
          heat: 71,
          lead_industry: "创新服务"
        },
        {
          id: "gbs075",
          street_id: "gs32",
          park_id: "gp16",
          x: 58.96,
          y: 56.24,
          name: "东郊记忆文创区运营楼",
          area_sqm: 25193,
          occupied_rate: 0.89,
          enterprises: 1,
          output_y: 1.3,
          tax_y: 0.1,
          heat: 82,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs076",
          street_id: "gs22",
          park_id: "gp15",
          x: 50.87,
          y: 54.15,
          name: "青羊防务配套园 3 栋",
          area_sqm: 22490,
          occupied_rate: 0.88,
          enterprises: 1,
          output_y: 1,
          tax_y: 0.1,
          heat: 77,
          lead_industry: "智能制造"
        },
        {
          id: "gbs077",
          street_id: "gs16",
          park_id: "gp11",
          x: 57.46,
          y: 58.98,
          name: "锦江文博创意中心",
          area_sqm: 18203,
          occupied_rate: 0.87,
          enterprises: 1,
          output_y: 0.6,
          tax_y: 0.1,
          heat: 84,
          lead_industry: "创新服务"
        },
        {
          id: "gbs078",
          street_id: "gs32",
          park_id: "gp16",
          x: 59.07,
          y: 57.94,
          name: "龙潭工业感知中心",
          area_sqm: 35492,
          occupied_rate: 0.86,
          enterprises: 1,
          output_y: 1.1,
          tax_y: 0.1,
          heat: 75,
          lead_industry: "创新服务"
        },
        {
          id: "gbs079",
          street_id: "gs32",
          park_id: "gp16",
          x: 57.76,
          y: 55.14,
          name: "东郊记忆演艺中心",
          area_sqm: 27245,
          occupied_rate: 0.83,
          enterprises: 1,
          output_y: 1.4,
          tax_y: 0.1,
          heat: 70,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs080",
          street_id: "gs31",
          park_id: "gp20",
          x: 55.86,
          y: 58.6,
          name: "建设路夜经济运营楼",
          area_sqm: 37201,
          occupied_rate: 0.79,
          enterprises: 1,
          output_y: 1.4,
          tax_y: 0.1,
          heat: 70,
          lead_industry: "现代商贸"
        },
        {
          id: "gbs081",
          street_id: "gs32",
          park_id: "gp16",
          x: 57.61,
          y: 56.6,
          name: "成华商业数据中心",
          area_sqm: 21800,
          occupied_rate: 0.74,
          enterprises: 1,
          output_y: 0.8,
          tax_y: 0.1,
          heat: 83,
          lead_industry: "创新服务"
        }
      ],
    },
    policies: [
      { id: "p1", name: "高新技术企业认定奖励", tags: ["高新", "奖励"], summary: "对通过认定的企业给予一次性奖励与配套服务。", dept: "科创局", contact: "028-8600-1001", deadline: "2026-06-30", fund_max: 50, fund_unit: "万元", industries: ["智能制造", "生物医药", "创新服务"], levels: ["规上", "规下"], district_id: "gd1", type: "普通项目" },
      { id: "p2", name: "设备更新技改贴息", tags: ["设备更新", "贴息"], summary: "支持企业设备更新，给予贷款贴息与技术改造补助。", dept: "经信局", contact: "028-8600-1002", deadline: "2026-09-30", fund_max: 100, fund_unit: "万元", industries: ["智能制造"], levels: ["规上"], district_id: "gd1", type: "普通项目" },
      { id: "p3", name: "人才安居与租金补贴", tags: ["人才", "补贴"], summary: "对符合条件的人才提供安居与租金补贴支持。", dept: "组织部", contact: "028-8600-1003", deadline: "2026-12-31", fund_max: 20, fund_unit: "万元", industries: ["智能制造", "生物医药", "创新服务", "现代商贸"], levels: ["规上", "规下"], district_id: "gd1", type: "免申即享" },
      { id: "p4", name: "专精特新企业培育奖励", tags: ["专精特新", "奖励"], summary: "对获评国家级、省级专精特新的企业分档给予奖补。", dept: "经信局", contact: "028-8600-1004", deadline: "2026-08-31", fund_max: 200, fund_unit: "万元", industries: ["智能制造", "生物医药"], levels: ["规上", "规下"], district_id: "gd1", type: "普通项目" },
      { id: "p5", name: "科技成果转化项目补助", tags: ["成果转化", "科创"], summary: "对科技成果在本区落地转化的项目给予最高 200 万元补助。", dept: "科创局", contact: "028-8600-1005", deadline: "2026-07-31", fund_max: 200, fund_unit: "万元", industries: ["生物医药", "创新服务"], levels: ["规上"], district_id: "gd1", type: "普通项目" },
      { id: "p6", name: "供应链金融贴息", tags: ["供应链", "融资"], summary: "对供应链核心企业及上下游融资给予贴息支持。", dept: "金融局", contact: "028-8600-1006", deadline: "2026-10-31", fund_max: 80, fund_unit: "万元", industries: ["现代商贸", "智能制造"], levels: ["规上"], district_id: "gd1", type: "普通项目" },
      { id: "p7", name: "绿色制造示范企业奖补", tags: ["绿色制造", "环保"], summary: "对获评绿色工厂、绿色产品的企业给予奖励。", dept: "经信局", contact: "028-8600-1007", deadline: "2026-11-30", fund_max: 60, fund_unit: "万元", industries: ["智能制造"], levels: ["规上", "规下"], district_id: "gd1", type: "免申即享" },
      { id: "p8", name: "数字经济产业扶持计划", tags: ["数字经济", "扶持"], summary: "对数字经济领域重点项目给予资金扶持与场地优惠。", dept: "发改局", contact: "028-8600-2001", deadline: "2026-08-15", fund_max: 150, fund_unit: "万元", industries: ["创新服务", "智能制造"], levels: ["规上", "规下"], district_id: "gd2", type: "普通项目" },
      { id: "p9", name: "生物医药研发费用加计扣除", tags: ["生物医药", "研发"], summary: "对生物医药企业研发投入给予额外费用加计扣除优惠。", dept: "科创局", contact: "028-8600-2002", deadline: "2026-12-31", fund_max: 300, fund_unit: "万元", industries: ["生物医药"], levels: ["规上"], district_id: "gd3", type: "免申即享" },
      { id: "p10", name: "中小微企业稳岗补贴", tags: ["稳岗", "补贴"], summary: "对吸纳就业并稳定岗位的中小微企业给予补贴。", dept: "人社局", contact: "028-8600-2003", deadline: "2026-09-30", fund_max: 30, fund_unit: "万元", industries: ["智能制造", "生物医药", "创新服务", "现代商贸"], levels: ["规下"], district_id: "gd1", type: "免申即享" },
    ],
    alerts: [
      {
        id: "a1",
        enterprise_id: "e4",
        type: "迁出风险",
        level: "高",
        score: 82,
        created_at: "2026-02-28",
        signals: [
          { name: "参保人数月度降幅", detail: "近 2 个月累计下降 26%" },
          { name: "劳动争议案件", detail: "季度新增 3 起" },
          { name: "股权变更", detail: "异地企业入股，持股 51%" },
        ],
        suggestion: "建议街道牵头开展走访，梳理经营困难与用工矛盾，匹配金融与载体资源，形成稳企方案。",
      },
      {
        id: "a2",
        enterprise_id: "e2",
        type: "经营波动",
        level: "中",
        score: 59,
        created_at: "2026-02-26",
        signals: [
          { name: "招聘热度", detail: "岗位数从 12 降至 4" },
          { name: "关键岗位变更", detail: "研发负责人变更" },
        ],
        suggestion: "建议对接园区载体与人才政策，补齐研发团队稳定性与空间需求。",
      },
      {
        id: "a3",
        enterprise_id: "e14",
        type: "载体到期",
        level: "中",
        score: 65,
        created_at: "2026-03-05",
        signals: [
          { name: "厂房租约", detail: "剩余 4 个月到期" },
          { name: "设备老化率", detail: "超过行业警戒线" },
        ],
        suggestion: "建议协调工业载体续约，同步对接设备更新贷款政策。",
      },
      {
        id: "a4",
        enterprise_id: "e10",
        type: "经营波动",
        level: "中",
        score: 51,
        created_at: "2026-03-08",
        signals: [
          { name: "原材料成本", detail: "季度涨幅 18%" },
          { name: "环保验收", detail: "整改期 60 天" },
        ],
        suggestion: "建议对接供应链金融与绿色制造政策，缓解成本压力。",
      },
    ],
    default_consents: [
      { enterprise_id: "e1", bank_id: "b1", purpose: "融资对接", granted_at: "2026-02-20" },
      { enterprise_id: "e5", bank_id: "b1", purpose: "融资对接", granted_at: "2026-02-23" },
    ],
  };
})();
