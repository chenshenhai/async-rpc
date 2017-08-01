const AsyncRPC = require('./../index.js');

let port = 8080;
let rpc = new AsyncRPC({

  func1: function(a, b, callback) { 
    let result = a + b;
    callback(result);
  },
  
  func2: function(a, b, callback) { 
    let result = a * b;
    callback(result);
  }
  
});

rpc.listen(port);