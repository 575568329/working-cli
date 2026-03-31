export const BASE_URL = "https://www.zhipin.com";

export const API_URLS = {
  SEARCH: "/wapi/zpgeek/search/joblist.json",
  JOB_DETAIL: "/wapi/zpgeek/job/detail.json",
  JOB_CARD: "/wapi/zpgeek/job/card.json",
  RECOMMEND: "/wapi/zprelation/interaction/geekGetJob",
  USER_INFO: "/wapi/zpuser/wap/getUserInfo.json",
  RESUME_BASEINFO: "/wapi/zpgeek/resume/baseinfo.json",
  RESUME_EXPECT: "/wapi/zpgeek/resume/expect.json",
  DELIVER_LIST: "/wapi/zpgeek/deliver/list.json",
  INTERVIEW_DATA: "/wapi/zpgeek/interview/data.json",
  JOB_HISTORY: "/wapi/zpgeek/history/browse.json",
  FRIEND_LIST: "/wapi/zpgeek/friend/list.json",
  FRIEND_ADD: "/wapi/zpgeek/friend/add.json",
  QR_RANDKEY: "/wapi/zppc/user/qrcode/randkey",
  QR_SCAN: "/wapi/zppc/user/qrcode/scan",
  QR_SCAN_LOGIN: "/wapi/zppc/user/qrcode/scancode/login",
  QR_DISPATCHER: "/wapi/zppc/user/qrcode/dispatcher",
} as const;

// Chrome 145 浏览器指纹
export const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  "sec-ch-ua":
    '"Chromium";v="145", "Google Chrome";v="145", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  DNT: "1",
  Priority: "u=1, i",
} as const;

export const WEB_GEEK_JOB_URL = "https://www.zhipin.com/web/geek/job";
export const WEB_GEEK_RECOMMEND_URL =
  "https://www.zhipin.com/web/geek/recommend";

// 必需的 Cookie 名称
export const REQUIRED_COOKIES = new Set(["__zp_stoken__", "geek_zp_token"]);

// 城市编码映射（40+城市）
export const CITY_CODES: Record<string, string> = {
  全国: "100010000",
  北京: "101010100",
  上海: "101020100",
  广州: "101280100",
  深圳: "101280600",
  杭州: "101210100",
  成都: "101270100",
  南京: "101190100",
  武汉: "101200100",
  西安: "101110100",
  重庆: "101040100",
  苏州: "101190400",
  天津: "101030100",
  郑州: "101180100",
  长沙: "101250100",
  东莞: "101281600",
  沈阳: "101070100",
  青岛: "101120200",
  合肥: "101220100",
  佛山: "101280800",
  宁波: "101210400",
  昆明: "101290100",
  大连: "101070200",
  厦门: "101230200",
  福州: "101230100",
  无锡: "101190200",
  济南: "101120100",
  温州: "101210700",
  哈尔滨: "101050100",
  长春: "101060100",
  石家庄: "101090100",
  太原: "101100100",
  贵阳: "101300100",
  南宁: "101310100",
  南昌: "101240100",
  兰州: "101050300",
  珠海: "101280700",
  中山: "101281700",
  惠州: "101280300",
  常州: "101190300",
  嘉兴: "101210300",
  绍兴: "101210500",
  金华: "101210900",
  泉州: "101230500",
  烟台: "101120500",
  保定: "101090200",
  徐州: "101190700",
};

export function resolveCity(name: string): string {
  if (/^\d{6,}$/.test(name)) return name;
  return CITY_CODES[name] ?? CITY_CODES["全国"];
}

// 筛选项合法值
export const SEARCH_FILTER_OPTIONS = {
  salary: [
    "3K以下",
    "3-5K",
    "5-10K",
    "10-15K",
    "15-20K",
    "20-30K",
    "30-50K",
    "50K以上",
  ],
  experience: [
    "不限",
    "在校/应届",
    "1年以内",
    "1-3年",
    "3-5年",
    "5-10年",
    "10年以上",
  ],
  degree: ["不限", "大专", "本科", "硕士", "博士"],
  scale: [
    "0-20人",
    "20-99人",
    "100-499人",
    "500-999人",
    "1000-9999人",
    "10000人以上",
  ],
  stage: [
    "未融资",
    "天使轮",
    "A轮",
    "B轮",
    "C轮",
    "D轮及以上",
    "已上市",
    "不需要融资",
  ],
  jobType: ["全职", "兼职", "实习"],
} as const;
