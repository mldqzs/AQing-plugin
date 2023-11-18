import fs from 'node:fs'
import path from 'node:path'

const _PATH = process.cwd()

export class Capoo extends plugin {
  constructor() {
    super({
      name: 'AQ:随机',
      dsc: '随机咖啵图片',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#?(随机)?(咖啵|卡波|capoo|猫猫虫)$',
          fnc: 'getCapooImg',
        }
      ]
    })
  }

  async getCapooImg() {
    const num = this.getGifImagesCount(_PATH + '/plugins/AQing-plugin/resources/images')
    if (num === -1) {
      this.e.reply('读取图片目录失败!')
      return false
    }

    const randomNumber = this.getRandomElement(num)

    this.e.reply(segment.image(_PATH + '/plugins/AQing-plugin/resources/images' + randomNumber + '.gif'))

  }

  getRandomElement(num) {
    const randomNumber = Math.floor(Math.random() * num)
    return randomNumber
  }

  getGifImagesCount(directory) {
    try {
      const files = fs.readdirSync(directory)
      const gifFiles = files.filter(file => path.extname(file).toLowerCase() === '.gif')
      return gifFiles.length
    } catch (error) {
      logger.error('读取图片目录失败:', error.message)
      return -1; // 返回 -1 表示获取数量失败
    }
  }

}