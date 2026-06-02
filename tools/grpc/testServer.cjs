// 本地 gRPC 测试服务
// 用法: node tools/grpc/testServer.js [port]
// 默认端口: 50051

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PORT = process.argv[2] || "50051";
const PROTO_PATH = path.join(__dirname, "../../protos/AlgoService.proto");

// 加载 proto
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDef);

// AlgoService 实现
function sendMessage(call, callback) {
  const req = call.request;
  console.log(`[AlgoService.SendMessage] Module=${req.Module}, Method=${req.Method}`);
  console.log(`  IntParas: [${req.IntParas}]`);
  console.log(`  DoubleParas: [${req.DoubleParas}]`);
  console.log(`  StringParas: [${req.StringParas}]`);

  // 返回模拟结果
  callback(null, {
    ErrorMsg: "",
    IntParas: [42, 100],
    DoubleParas: [3.14, 2.718],
    StringParas: [`Module=${req.Module} executed successfully`, `Method=${req.Method} completed`],
    StreamParas: [],
  });
}

// HealthCheck 实现
function check(call) {
  console.log(`[HealthCheck.Check] Client connected`);
  // 发送连接状态
  call.write({ status: 1 });

  // 保持连接，每 5 秒发送心跳
  const interval = setInterval(() => {
    try {
      call.write({ status: 1 });
    } catch {
      clearInterval(interval);
    }
  }, 5000);

  call.on("cancelled", () => {
    clearInterval(interval);
    console.log(`[HealthCheck.Check] Client disconnected`);
  });
}

// PushService 实现
function subscribe(call) {
  const req = call.request;
  console.log(`[PushService.Subscribe] Client=${req.client}, Topics=[${req.topics}]`);

  // 模拟推送
  let count = 0;
  const interval = setInterval(() => {
    count++;
    try {
      call.write({
        topics: req.topics,
        IntParas: [count],
        DoubleParas: [count * 1.1],
        StringParas: [`Push #${count}`],
        StreamParas: [],
      });
    } catch {
      clearInterval(interval);
    }
  }, 3000);

  call.on("cancelled", () => {
    clearInterval(interval);
    console.log(`[PushService.Subscribe] Client disconnected`);
  });
}

// 启动服务
const server = new grpc.Server();

server.addService(proto.AlgoGRPC.AlgoService.service, { SendMessage: sendMessage });
server.addService(proto.AlgoGRPC.HealthCheck.service, { Check: check });
server.addService(proto.AlgoGRPC.PushService.service, { Subscribe: subscribe });

server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
  console.log(`\n=== AlgoService gRPC Server ===`);
  console.log(`Listening on: 0.0.0.0:${port}`);
  console.log(`Proto: ${PROTO_PATH}`);
  console.log(`Services:`);
  console.log(`  AlgoGRPC.AlgoService.SendMessage`);
  console.log(`  AlgoGRPC.HealthCheck.Check`);
  console.log(`  AlgoGRPC.PushService.Subscribe`);
  console.log(`\nReady for connections.\n`);
});
