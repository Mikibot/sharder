"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
exports.__esModule = true;
var gateway_1 = require("@spectacles/gateway");
var rabbitmq = require("amqplib");
var redis = require("redis");
var config = require("./config");
var gateway = new gateway_1.Gateway(config.token, config.shardCount);
var discord = new gateway_1.Cluster(gateway);
var cache = redis.createClient(config.redis.url);
var conn = null;
var gatewayChannel = null;
var commandChannel = null;
discord.on('error', function (error) {
    console.error("[ ERR} >> " + error);
});
discord.on('connect', function (shard) { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("[ OK ]: Connected shard " + shard.id);
                return [4 /*yield*/, cache.hset("gateway:shards", shard.id, "1")];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
discord.on('disconnect', function (shard) { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("[ERR ]: Disconnected shard " + shard.id);
                return [4 /*yield*/, cache.hset("gateway:shards", shard.id, "0")];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
discord.on('receive', function (packet, shard) { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (packet.op != 0) {
                    return [2 /*return*/];
                }
                if (packet.t == "READY") {
                    console.log("[ OK ] >> SHARD READY: " + shard.id);
                }
                if (packet.t == "PRESENCE_UPDATE") {
                    if (Object.keys(packet.d.user).length > 1) {
                        packet.t = "USER_UPDATE";
                    }
                }
                if (config.logLevel > 0) {
                    console.log("[" + packet.t + "]");
                    if (config.logLevel > 1) {
                        console.log(packet.d);
                    }
                }
                if (config.ignorePackets.includes(packet.t)) {
                    if (config.logLevel > 0) {
                        console.log("^ ignored");
                    }
                    return [2 /*return*/];
                }
                return [4 /*yield*/, gatewayChannel.sendToQueue(config.rabbit.pusher.channelName, Buffer.from(JSON.stringify(packet)))];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var shardsToInit, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getConnection()];
                case 1:
                    conn = _a.sent();
                    return [4 /*yield*/, createPushChannel(config.rabbit.pusher.exchangeName, config.rabbit.pusher.channelName)];
                case 2:
                    gatewayChannel = _a.sent();
                    return [4 /*yield*/, createCommandChannel(config.rabbit.commands.exchangeName, config.rabbit.commands.channelName)];
                case 3:
                    commandChannel = _a.sent();
                    shardsToInit = [];
                    for (i = config.shardIndex; i < config.shardIndex + config.shardInit; i++) {
                        shardsToInit.push(i);
                    }
                    console.log("[ .. ] >> intiating shards: " + shardsToInit);
                    discord.spawn(shardsToInit);
                    return [2 /*return*/];
            }
        });
    });
}
function initConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var newConn, err_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, rabbitmq.connect(config.rabbit.url)];
                case 1:
                    newConn = _a.sent();
                    newConn.on('error', function (err) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            console.log("[CRIT] CN " + err);
                            conn = getConnection();
                            return [2 /*return*/];
                        });
                    }); });
                    return [2 /*return*/, newConn];
                case 2:
                    err_1 = _a.sent();
                    console.log("[WARN] >> " + err_1);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function createPushChannel(exchangeName, channelName) {
    return __awaiter(this, void 0, void 0, function () {
        var channel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, conn.createChannel()];
                case 1:
                    channel = _a.sent();
                    channel.on('error', function (err) {
                        console.log("[CRIT] CH " + err);
                    });
                    return [4 /*yield*/, channel.assertExchange(exchangeName, 'direct', { durable: true })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, channel.assertQueue(channelName, { durable: true })];
                case 3:
                    _a.sent();
                    return [2 /*return*/, channel];
            }
        });
    });
}
function createCommandChannel(exchangeName, channelName) {
    return __awaiter(this, void 0, void 0, function () {
        var channel;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, conn.createChannel()];
                case 1:
                    channel = _a.sent();
                    return [4 /*yield*/, channel.assertExchange(exchangeName, 'fanout', { durable: true })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, channel.assertQueue(channelName, { durable: false })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, channel.bindQueue(channelName, exchangeName, '')];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, channel.consume(channelName, function (msg) { return __awaiter(_this, void 0, void 0, function () {
                            var packet, shard, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        packet = JSON.parse(msg.content.toString());
                                        console.log("command: " + JSON.stringify(packet));
                                        if (!discord.shards.has(packet.shard_id)) return [3 /*break*/, 6];
                                        shard = discord.shards.get(packet.shard_id);
                                        _a = packet.type || undefined;
                                        switch (_a) {
                                            case "reconnect": return [3 /*break*/, 1];
                                            case undefined: return [3 /*break*/, 3];
                                        }
                                        return [3 /*break*/, 5];
                                    case 1: return [4 /*yield*/, shard.reconnect()];
                                    case 2:
                                        _b.sent();
                                        return [3 /*break*/, 6];
                                    case 3: return [4 /*yield*/, shard.send(packet.opcode, packet.data)];
                                    case 4:
                                        _b.sent();
                                        return [3 /*break*/, 6];
                                    case 5:
                                        {
                                            return [2 /*return*/];
                                        }
                                        _b.label = 6;
                                    case 6: return [2 /*return*/];
                                }
                            });
                        }); }, { noAck: true })];
                case 5:
                    _a.sent();
                    return [2 /*return*/, channel];
            }
        });
    });
}
function getConnection() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!true) return [3 /*break*/, 2];
                    return [4 /*yield*/, initConnection()];
                case 1:
                    conn = _a.sent();
                    if (conn == null) {
                        console.log("[WARN] >> connection failed, retrying in 5 seconds..");
                        setTimeout(function () { }, 5000);
                        return [3 /*break*/, 0];
                    }
                    return [3 /*break*/, 2];
                case 2:
                    console.log("[ OK ] >> (re)connected");
                    return [2 /*return*/, conn];
            }
        });
    });
}
main();
