/**
* 请注意，系统不会读取help_default.js ！！！！
* 【请勿直接修改此文件，且可能导致后续冲突】
*
* 如需自定义可将文件【复制】一份，并重命名为 help.js
*
* */

export const helpCfg = {
  title: '阿晴帮助',
  subTitle: 'Miao-Yunzai & AQing-plugin',
  colCount: 3,
  columnCount: 4,
  colWidth: 300,
  theme: 'all',
  themeExclude: ['default'],
  style: {
    fontColor: '#ceb78b',
    descColor: '#eee',
    contBgColor: 'rgba(6, 21, 31, .5)',
    contBgBlur: 4,
    headerBgColor: 'rgba(6, 21, 31, .4)',
    rowBgColor1: 'rgba(6, 21, 31, .2)',
    rowBgColor2: 'rgba(6, 21, 31, .35)'
  }
}

export const helpList = [
  {
  group: '指令&指令描述',
  list: [{
      icon: 75,
      title: '堂主',
      desc: '堂主逆天语录'
    }, {
      icon: 94,
      title: '召唤堂主',
      desc: '召唤堂主giegie'
    }, {
      icon: 68,
      title: '阿晴日日',
      desc: '日日阿晴？也许会有奇怪的事情发生'
    }, {
      icon: 66,
      title: '#来份阿晴套餐',
      desc: '神奇功能？'
      }, {
      icon: 79,
      itle: '原神',
      desc: '原神启动！'
      }, {
      icon: 92,
      title: '咕咕咕',
      desc: '咕咕咕~'
    }
  ]
},{
  group: '仅管理员可用',
  auth: 'master',
  list: [{
    icon: 85,
    title: '#阿晴上班',
    desc: '开始工作！'
  }, {
       icon: 85,
       title: '#阿晴下班',
       desc: '结束工作！'
      }, {
       icon: 85,
       title: '#更新堂主语录',
       desc: '更新逆天语录'
      }, {
      icon: 85,
      title: '#阿晴(强制)更新',
      desc: '更新阿晴插件'
  }, {
      icon: 85,
      title: '#阿晴更新日志',
      desc: '查看阿晴更新日志'
  }
]}
]
