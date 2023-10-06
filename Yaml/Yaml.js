import plugin from "../../../lib/plugins/plugin.js"
import fs from 'fs'
import YAML from 'yaml'

class Yaml {
  constructor () {}
  
//读
getread(path) {
 try {
    var file = fs.readFileSync(path, 'utf8');
  } catch (e) {
    console.log(e);
    return false;
  }
  //转换
  return YAML.parse(file);
}

//写
getwrite(path,data) {
  try {
    //转换
    let 数据 = YAML.stringify(data);
    fs.writeFileSync(path, 数据, 'utf8');
    return true
  } catch (e) {
    //错误处理
    console.log(e);
    return false
  }
}
  
  
  
}
  
  
export default new Yaml()