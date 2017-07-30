const AsyncRPC = require('./../index.js');
const rpc = new AsyncRPC();

async function run() {
	let {remote, connect, err} = await rpc.connect(8080, 'localhost');
  let result1 = await remote.func1(3, 4);
  let result2 = await remote.func2(5, 6);
  
  connect.destroy();
  connect.end();

  console.log('func1 result = ', result1);
  console.log('func2 result = ', result2);
}

run();


