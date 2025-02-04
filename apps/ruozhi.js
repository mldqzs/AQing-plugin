import puppeteer from 'puppeteer';
import axios from 'axios';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// 配置常量
const CONFIG = {
  TEMPLATE_PATH: resolve(dirname(fileURLToPath(import.meta.url)), '../resources/html/ruozhiba.html'),
  BACKGROUND_API: '../resources/html/help/img/bgimg2.jpg',
  RUOZHIBI_API: 'https://api.pearktrue.cn/api/ruozhiba/',
  VIEWPORT: { width: 800, height: 600 },
  CACHE: {
    browser: null,
    lastInit: 0
  }
};

export class RuozhibaInfo extends plugin {
  constructor() {
    super({
      name: 'AQ：弱智吧',
      dsc: '随机弱智吧',
      event: 'message',
      priority: 250,
      rule: [
        {
          reg: /^随机弱智吧$/,
          fnc: 'generateCard'
        }
      ]
    });
    this.template = this.loadTemplate();
  }

  // 初始化浏览器实例
  async initBrowser() {
    if (!CONFIG.CACHE.browser || Date.now() - CONFIG.CACHE.lastInit > 300000) {
      CONFIG.CACHE.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      CONFIG.CACHE.lastInit = Date.now();
    }
    return CONFIG.CACHE.browser;
  }

  // 加载HTML模板
  loadTemplate() {
    try {
      return readFileSync(CONFIG.TEMPLATE_PATH, 'utf-8');
    } catch (error) {
      console.error('模板加载失败:', error);
      throw new Error('模板文件缺失');
    }
  }

  // 主处理逻辑
  async generateCard(e) {
    try {
      const [data, browser] = await Promise.all([
        this.fetchData(),
        this.initBrowser()
      ]);
      
      const page = await browser.newPage();
      await page.setViewport(CONFIG.VIEWPORT);
      
      const html = this.renderTemplate(data);
      await page.setContent(html);
      
      const screenshot = await page.screenshot({
        encoding: 'base64',
        fullPage: true,
      });
      
      await page.close();
      e.reply(segment.image(`base64://${screenshot}`));
      
    } catch (error) {
      console.error('生成失败:', error);
      e.reply([
        '生成失败，可能原因：',
        '1. 网络连接异常',
        '2. 模板文件损坏',
        '3. 浏览器实例崩溃'
      ]);
    }
    return true;
  }

  // 获取API数据
  async fetchData() {
    try {
      const response = await axios.get(CONFIG.RUOZHIBI_API);
      if (!response.data?.data) throw new Error('API响应格式异常');
      return response.data.data;
    } catch (error) {
      console.error('API请求失败:', error);
      throw new Error('API请求失败');
    }
  }

  // 渲染模板
  renderTemplate(data) {
    return this.template
      .replace('{{backgroundUrl}}', CONFIG.BACKGROUND_API)
      .replace('{{question}}', data.instruction ?? '暂无问题')
      .replace('{{answer}}', data.output ?? '暂无回答')
      .replace('{{timestamp}}', new Date().toLocaleString());
  }
}