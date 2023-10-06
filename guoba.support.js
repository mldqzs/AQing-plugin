import setting from './utils/setting.js'
import lodash from 'lodash'
import { pluginResources } from './utils/path.js'
import path from 'path'

// 支持锅巴
export function supportGuoba () {
  let allGroup = []
  Bot.gl.forEach((v, k) => { allGroup.push({ label: `${v.group_name}(${k})`, value: k }) })
  return {
    pluginInfo: {
      name: 'AQing-plugin',
      title: 'AQing-plugin',
      author: '@明るい青紫色',
      authorLink: '',
      link: '',
      isV3: true,
      isV2: false,
      description: 'Yunzai-bot V3插件',
      icon: 'bi:box-seam',
      iconColor: '#7ed99e',
      iconPath: path.join(pluginResources, 'common/cont/pamu.png')
    },
    // 配置项信息
    configInfo: {
      schemas: [{
        component: 'Divider',
        label: '艾特禁言设置'
      },
      {
        field: 'config.muteTime',
        label: '被艾特禁言时间',
        bottomHelpMessage: '设置被艾特禁言时间',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 0,
          max: 30,
          placeholder: '请输入整数[0~30]'
        }
      }
      ],
      getConfigData () {
        return setting.merge()
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData (data, { Result }) {
        let config = {}
        for (let [keyPath, value] of Object.entries(data)) {
          lodash.set(config, keyPath, value)
        }
        config = lodash.merge({}, setting.merge, config)
        setting.analysis(config)
        return Result.ok({}, '保存成功~')
      }
    }
  }
}
