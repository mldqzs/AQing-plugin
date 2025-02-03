import setting from './utils/setting.js'
import lodash from 'lodash'
import { pluginResources } from './utils/path.js'
import path from 'path'

const addGroupPromptProps = {
  content: '请输入群号：',
  placeholder: '请输入群号',
  okText: '添加',
  rules: [
    { required: true, message: '你写了个寂寞' },
    { pattern: '^\d+$', message: '这玩意应该是纯数字的吧' },
    { min: 5, message: '你这细狗，太短了' },
    { max: 10, message: '太…长了…阿晴受不了捏' },
  ],
}

const add = {
  content: '请输入QQ号：',
  placeholder: '请输入QQ号',
  okText: '添加',
  rules: [
    { required: true, message: '你写了个寂寞' },
    { pattern: '^\d+$', message: '这玩意应该是纯数字的吧' },
    { min: 5, message: '你这细狗，太短了' },
    { max: 11, message: '太…长了…阿晴受不了捏' },
  ],
}

// 支持锅巴
export function supportGuoba() {
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
        { component: 'Divider', label: '绝对主人设置' },
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
        { component: 'Divider', label: '艾特禁言设置' },
        {
          field: 'config.muteTime',
          label: '被艾特禁言时间',
          bottomHelpMessage: '设置被艾特禁言时间',
          component: 'InputNumber',
          required: true,
          componentProps: {
            min: 0,
            max: 30,
            placeholder: '请输入整数[0~30]',
          },
        },
        {
          field: 'config.艾特禁言群',
          label: '开启艾特禁言的群聊',
          bottomHelpMessage: '要开启艾特禁言的群聊，可以多个',
          component: 'GTags',
          componentProps: {
            placeholder: '请输入群号',
            allowAdd: true,
            allowDel: true,
            showPrompt: true,
            promptProps: addGroupPromptProps,
            valueFormatter: ((value) => Number.parseInt(value)).toString(),
          },
        },
        { component: 'Divider', label: '作息提示设置' },
        {
          field: 'config.botname',
          label: '设置机器人名字',
          bottomHelpMessage: '机器人名字',
          component: 'Input',
          componentProps: {
            placeholder: '请输入机器人名字',
          },
        },
        {
          field: 'config.start_tip',
          label: '设置上班提示语',
          bottomHelpMessage: '上班提示语',
          component: 'Input',
          componentProps: {
            placeholder: '请输入文字',
          },
        },
        {
          field: 'config.close_tip',
          label: '设置下班提示语',
          bottomHelpMessage: '下班提示语',
          component: 'Input',
          componentProps: {
            placeholder: '请输入文字',
          },
        },
      ],
      getConfigData() {
        return setting.merge()
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData(data, { Result }) {
        let config = {}
        for (let [keyPath, value] of Object.entries(data)) {
          lodash.set(config, keyPath, value)
        }
        config = lodash.merge({}, setting.merge, config)
        setting.analysis(config)
        return Result.ok({}, '保存成功~')
      },
    },
  }
}