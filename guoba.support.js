import setting from './utils/setting.js'
import lodash from 'lodash'
import { pluginResources } from './utils/path.js'
import path from 'path'
const addGroupPromptProps = {
  content: '请输入群号：',
  placeholder: '请输入群号',
  okText: '添加',
  rules: [
    {required: true, message: '你写了个寂寞'},
    {pattern: '^\\d+$', message: '这玩意应该是纯数字的吧'},
    {min: 5, message: '你这细狗，太短了'},
    {max: 10, message: '太…长了…阿晴受不了捏'},
  ],
}

const add = {
  content: '请输入QQ号：',
  placeholder: '请输入QQ号',
  okText: '添加',
  rules: [
    {required: true, message: '你写了个寂寞'},
    {pattern: '^\\d+$', message: '这玩意应该是纯数字的吧'},
    {min: 5, message: '你这细狗，太短了'},
    {max: 11, message: '太…长了…阿晴受不了捏'},
  ],
}

// 支持锅巴
export function supportGuoba () {
  let allGroup = []
  Bot.gl.forEach((v, k) => { allGroup.push({ label: `${v.group_name}(${k})`, value: k }) })
  return {
    pluginInfo: {
      name: 'AQing-plugin',
      title: 'AQing-plugin',
      author: '明るい青紫色',
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
      schemas: [
       { component: 'Divider',
        label: '绝对主人设置'
      },
      {
        field: 'config.绝对主人',
        label: '设置绝对主人',
        bottomHelpMessage: '设置绝对主人',
        component: 'GTags',
        componentProps: {
          placeholder: '请输入QQ',
          allowAdd: true,
          allowDel: true,
          showPrompt: true,
          promptProps: add,
          valueFormatter: ((value) => Number.parseInt(value)).toString(),
        },
      }, 
        
        {
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
      },
       {
        component: 'Divider',
        label: '戳一戳设置,概率剩下的为反击概率 加起来不要大于1'
      },
      {
        field: 'config.botname',
        label: '设置机器人名字',
        bottomHelpMessage: '机器人名字',
        component: 'Input',
        componentProps: {
          placeholder: '请输入机器人名字'
        }
      },
      {
        field: 'config.start_tip',
        label: '设置上班提示语',
        bottomHelpMessage: '上班提示语',
        component: 'Input',
        componentProps: {
          placeholder: '请输入文字'
        }
      },
      {
        field: 'config.close_tip',
        label: '设置下班提示语',
        bottomHelpMessage: '下班提示语',
        component: 'Input',
        componentProps: {
          placeholder: '请输入文字'
        }
      },
      {
             field: 'config.戳一戳',
             label: '阿晴戳一戳开关',
             bottomHelpMessage: '是否开启戳一戳',
             component: 'Switch'
            },
      {
        field: 'config.text',
        label: '戳一戳文字回复概率',
        bottomHelpMessage: '设置文字回复概率',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 0,
          max: 1,
          placeholder: '请输入概率[0~1]'
        }
      },
      {
        field: 'config.img',
        label: '戳一戳图片回复概率',
        bottomHelpMessage: '设置图片回复概率',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 0,
          max: 1,
          placeholder: '请输入概率[0~1]'
        }
      },
      {
        field: 'config.voice',
        label: '戳一戳语音回复概率',
        bottomHelpMessage: '设置语音回复概率',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 0,
          max: 1,
          placeholder: '请输入概率[0~1]'
        }
      },
      {
        field: 'config.mu',
        label: '戳一戳禁言概率',
        bottomHelpMessage: '设置禁言概率',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 0,
          max: 1,
          placeholder: '请输入概率[0~1]'
        }
      },
      {
        field: 'config.ex',
        label: '戳一戳表情回复概率',
        bottomHelpMessage: '设置表情回复概率',
        component: 'InputNumber',
        required: true,
        componentProps: {
          min: 0,
          max: 1,
          placeholder: '请输入概率[0~1]'
        },
      },
        {
          field: 'config.戳一戳群',
          label: '开启戳一戳的群聊',
          bottomHelpMessage: '要开启阿晴戳一戳的群聊，可以多个',
          component: 'GTags',
          componentProps: {
            placeholder: '请输入群',
            allowAdd: true,
            allowDel: true,
            showPrompt: true,
            promptProps: addGroupPromptProps,
            valueFormatter: ((value) => Number.parseInt(value)).toString(),
          },
        },
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