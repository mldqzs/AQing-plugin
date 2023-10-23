import YAML from 'yaml'
import fs from 'fs'
export default new class sycfg {

    constructor() {
        this.default_config_path = './plugins/AQing-plugin/config/defSet_config/'
        this.config_path = './plugins/AQing-plugin/config/config/'
        this.initconfig()
    }

    async initconfig() {
        //判断云崽data目录下是否存在sy文件夹，不存在则创建，该用来保存AQing-pllugin产生的重要文件
        if (!fs.existsSync("./data/aq")) {
            fs.mkdirSync("./data/aq");
        }

        //如果用户配置文件不存在，将默认配置文件复制到用户配置
        const files = fs.readdirSync(this.default_config_path).filter(file => file.endsWith('.yaml'))
        for (let file of files) {
            if (!fs.existsSync(`${this.config_path}${file}`)) {
                fs.copyFileSync(`${this.default_config_path}${file}`, `${this.config_path}${file}`)
            }
        }
    }

    //读取配置文件
    async get_cfg(filename, cfgname) {
        let cfg_list
        let cfg_value
        try {
            cfg_list = YAML.parse(fs.readFileSync(this.config_path + filename, 'utf8'))
        } catch {
            cfg_list = YAML.parse(fs.readFileSync(this.default_config_path + filename, 'utf8'))
        }
        cfg_value = cfg_list[cfgname]
        if (cfg_value == undefined) {
            cfg_list = YAML.parse(fs.readFileSync(this.default_config_path + filename, 'utf8'))
            cfg_value = cfg_list[cfgname]
        }
        return cfg_value
    }
}