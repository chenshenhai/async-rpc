/**
 * Thanks to:
 * romulka, https://github.com/romulka/nodejs-light_rpc
 * LICENSE: BSD
 * */

const net = require('net');
const Utils = require('./utils');

const DESCRIPT_CMD = '___DESCRIPT___';
const RESULT_CMD = '___RESULT___';
const ERROR_CMD = '___ERROR___';

function parseRemoteFunc(cmdName, callbacks, connection){

	return function(){
    let id = Utils.idGenerator();
  
		if(typeof arguments[arguments.length - 1] === 'function'){
			callbacks[id] = arguments[arguments.length - 1];
    } 

		let args = [];
		for(let ai = 0, al = arguments.length; ai < al; ++ai){
			if(typeof arguments[ai] !== 'function'){
				args.push(arguments[ai]);
			}
		}

    let newCmd = Utils.command(cmdName, {id: id, args: args});
    connection.write(newCmd); 

    return  new Promise((resolve, reject) => {
      let buffObj = {
        bufferBytes: undefined,
        getLength: true,
        length: -1
      };

      connection.on('data', function(data){
        try {
          if(buffObj.bufferBytes && buffObj.bufferBytes.length > 0){
            let tmpBuff = new Buffer(buffObj.bufferBytes.length + data.length);

            buffObj.bufferBytes.copy(tmpBuff, 0);
            data.copy(tmpBuff, buffObj.bufferBytes.length);
            buffObj.bufferBytes = tmpBuff;
          } else {
            buffObj.bufferBytes = data;
          }

          let commands = Utils.getComands(buffObj);
          commands.forEach(function(cmd){
            if(cmd.command === RESULT_CMD && id === cmd.data.id){
              resolve({
                data: cmd.data.args[0],
                err: null,
                success: true,
              });
            } 
          });
        } catch ( err ) {
          resolve({
            data: null,
            err: err,
            success: false,
          });
        }
      });
    });
    
	};
}

module.exports = class AsyncRPC {

  constructor(wrapper) {
    this.wrapper = wrapper;
    this.description = {};
    this.callbacks = {};

    for(let _key in wrapper){
      this.description[_key] = {};
    }

    this.descrStr = Utils.command(DESCRIPT_CMD, this.description);
    return this;
  }

  listen(port){
    this.getServer();  
    this.server.listen(port);
  }

  close(){
    this.server.close();
  }

  getServer(){
    let _this = this;

    let server = net.createServer(function(connect) {
      let buffObj = {
        bufferBytes: undefined,
        getLength: true,
        length: -1
      };

      connect.on('data', function(data){
        if(buffObj.bufferBytes && buffObj.bufferBytes.length > 0){
          let tmpBuff = new Buffer(buffObj.bufferBytes.length + data.length);

          buffObj.bufferBytes.copy(tmpBuff, 0);
          data.copy(tmpBuff, buffObj.bufferBytes.length);

          buffObj.bufferBytes = tmpBuff;
        } else {
          buffObj.bufferBytes = data;
        }

        let commands = Utils.getComands(buffObj);

        commands.forEach(function(cmd){

          if(cmd.command === DESCRIPT_CMD){
            connect.write(_this.descrStr);
          } else if(!_this.wrapper[cmd.command]){
            connect.write(Utils.command('error', {code: 'ERROR_UNKNOWN_COMMAND'}));
          } else {
            let args = cmd.data.args; 
 
            args.push(function(){
              let innerArgs = [];   
              for(let ai = 0, al = arguments.length; ai < al; ++ai){
                if(typeof arguments[ai] !== 'function'){
                  innerArgs.push(arguments[ai]);
                }
              } 
              let resultCommand = Utils.command(RESULT_CMD, {id: cmd.data.id, args: innerArgs});  
              connect.write(resultCommand);
            });

            try{
              _this.wrapper[cmd.command].apply({}, args);
            } catch(err){
              Utils.logger.error(err);
              let resultCommand = Utils.command(ERROR_CMD, {id: cmd.data.id, err: err});
              connect.write(resultCommand);
            }
          }
        });
      });

      connect.on('error', function(exception){
        Utils.logger.error(exception);
      });
    });
    this.server = server;
    return server;
  }
  
  connect(port, host) {
    return new Promise((resolve, reject)=>{
      try {
        this.connectCallback(port, host, (remote, connect) => {
          resolve({remote, connect});
        });
      } catch( err ) {
        reject({remote: null, connect:null, err});
      }
    });
  }

  connectCallback(port, host, callback){
    if(!callback){
      callback = host;
      host = 'localhost';
    }

    let connection = net.createConnection(port, host);
    let _this = this;

    connection.setKeepAlive(true);

    connection.on('connect', function(){
      connection.write(Utils.command(DESCRIPT_CMD));
    });

    let buffObj = {
      bufferBytes: undefined,
      getLength: true,
      length: -1
    };

    connection.on('data', function(data){
      if(buffObj.bufferBytes && buffObj.bufferBytes.length > 0){
        let tmpBuff = new Buffer(buffObj.bufferBytes.length + data.length);

        buffObj.bufferBytes.copy(tmpBuff, 0);
        data.copy(tmpBuff, buffObj.bufferBytes.length);

        buffObj.bufferBytes = tmpBuff;
      } else {
        buffObj.bufferBytes = data;
      }

      let commands = Utils.getComands(buffObj);
      commands.forEach(function(cmd){
        if(cmd.command === ERROR_CMD){
          if(_this.callbacks[cmd.data.id]){
            _this.callbacks[cmd.data.id].call(this, cmd.data.err);
            delete _this.callbacks[cmd.data.id];
          }
        } else if(cmd.command === DESCRIPT_CMD){
          let remoteObj = {};

          for(let p in cmd.data){
            remoteObj[p] = parseRemoteFunc(p, _this.callbacks, connection);
          }
          callback(remoteObj, connection);
        }
      });
    });

    connection.on('error', function(err){
      Utils.logger.error(err);
    });

    connection.on('timeout', function(){
      Utils.logger.error('RPC connection timeout');
    });

    connection.on('end', function(){
      Utils.logger.error('RPC connection end');
    });
  }
};