/**
 * Thanks to:
 * romulka, https://github.com/romulka/nodejs-light_rpc
 * LICENSE: BSD
 * */

const NEW_LINE_CODE = '\n'.charCodeAt(0);

module.exports = {

  logger: {
    error(){
      if ( !Array.isArray(arguments) ) {
        console.log('[Async-RPC-Error]: ', arguments);
        return;
      } 
      let args = new Array(arguments.length + 1);
      args.push('[Async-RPC-Error]: ');
      arguments.map(( argItem ) => {
        args.push(argItem);
      });
      console.log(args);
    }
  },

  idGenerator(a){
    return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).
      replace(/[018]/g, this.idGenerator);
  },

  command(name, data){
    let cmd = {
      command: name,
      data: data
    };
    let cmdStr = JSON.stringify(cmd);
    return Buffer.byteLength(cmdStr) + '\n' + cmdStr;
  },

  getComands(buffObj){
    let commands = [];
    let i = -1;
    let _this = this;

    let parseCommands = function(){
      if(buffObj.getLength === true){
        i = _this.getNewLineIndex(buffObj.bufferBytes);
        if(i > -1){
          buffObj.length = Number(buffObj.bufferBytes.slice(0, i).toString());
          buffObj.getLength = false;
          buffObj.bufferBytes = _this.clearBuffer(buffObj.bufferBytes, i + 1);
        }
      }

      if(buffObj.bufferBytes && buffObj.bufferBytes.length >= buffObj.length){
        let cmd = buffObj.bufferBytes.slice(0, buffObj.length).toString();
        buffObj.getLength = true;
        

        let parsedCmd = JSON.parse(cmd);
        commands.push(parsedCmd);
        buffObj.bufferBytes = _this.clearBuffer(buffObj.bufferBytes, buffObj.length);

        if(buffObj.bufferBytes && buffObj.bufferBytes.length > 0){
          parseCommands.call(_this.getComands);
        }
      }
    };

    parseCommands.call(_this.getComands);
    return commands;
  },

  getNewLineIndex(buffer){
    if(buffer){
      for(let i = 0, l = buffer.length; i < l; ++i){
        if(buffer[i] === NEW_LINE_CODE){
          return i;
        }
      }
    }
    return -1;
  },

  clearBuffer(buffer, length){
    if(buffer.length > length){
      return buffer.slice(length);
    }
    return undefined;
  }

};