const { Cluster, Gateway } = require('@spectacles/gateway');
const rabbitmq    = require('amqplib');
const redis       = require('redis');
const Promise     = require("bluebird");
require("dotenv").config();

Promise.promisifyAll(redis);

if((process.env.DISCORD_TOKEN || "") == "") {
    throw new Error("Cannot start sharder without valid token.");
}

const gateway = new Gateway(
    process.env.DISCORD_TOKEN, 
    Number(process.env.SHARD_COUNT));
const discord = new Cluster(gateway);

const cache = new redis.createClient(process.env.REDIS_URL);

var conn = null;
var gatewayChannel = null;

discord.on('error', (error) => {
    console.error(" err : " + error);
})

discord.on('connect', async (shard) => {
    console.log("  ok : Connected shard " + shard.id);
    await cache.hsetAsync("gateway:shards", shard.id, "1");
});

discord.on('disconnect', async (shard) => {
    console.log(" err : Disconnected shard " + shard.id);
    await cache.hsetAsync("gateway:shards", shard.id, "0");
});

discord.on('close', (event) => {
    console.log(" err : websocket closed with reason: " + event.reason);
})

let ignoredPacketIDs = (process.env.IGNORE_PACKETS || "").split(',');
discord.on('receive', async (packet, shard) => 
{
    if(packet.op != 0)
    {
        return;
    }

    if(packet.t == "READY")
    {
        console.log(`[ OK ] >> SHARD READY: ${shard.id}`);
    }

    if(packet.t == "PRESENCE_UPDATE")
    {
        if(Object.keys(packet.d.user).length > 1)
        {
            packet.t = "USER_UPDATE";
        }
    }

    if(process.env.LOG_LEVEL > 0)
    {
        console.log(`[${packet.t}]`);
        if(process.env.LOG_LEVEL > 1)
        {
            console.log(packet.d);
        }
    }

	if(ignoredPacketIDs.includes(packet.t))
	{
		return;
    }
	
    await gatewayChannel.sendToQueue(
        process.env.RABBIT_PUSH_CN,
        Buffer.from(JSON.stringify(packet)));
    return;
});

async function main()
{   
    conn = await getConnection();
    gatewayChannel = await createPushChannel(
        process.env.RABBIT_PUSH_EX || "gateway", 
        process.env.RABBIT_PUSH_CN || "gateway");
    await createCommandChannel(
        process.env.RABBIT_CMD_EX || "gateway:command", 
        process.env.RABBIT_CMD_CN || "gateway:command");

    let shardsToInit = [];
    let shardIndex = (process.env.SHARD_INDEX || 0);
    let initAmount = (process.env.SHARD_INIT || 1);

    for(let i = shardIndex; i < shardIndex + initAmount; i++)
    {
        shardsToInit.push(Number(i));
    }

    console.log(`  .. : intiating shards: ${shardsToInit}`);

    await discord.spawn(shardsToInit);
}

async function initConnection()
{
    try
    {
        let newConn = await rabbitmq.connect(
            process.env.RABBIT_URL);

        newConn.on('error', async (err) => {
            console.log("[CRIT] CN " + err);
            conn = getConnection();
        });

        return newConn;
    }
    catch(err)
    {
        console.log("[WARN] >> " + err);
        return null;
    }
}

async function createPushChannel(exchangeName, channelName)
{
    var channel = await conn.createChannel();
    channel.on('error', function(err) {
        console.log(" CRIT: CH " + err);
    });
    
    await channel.assertExchange(
        exchangeName || "gateway", 
        'direct', 
        {durable: true});
    assert = await channel.assertQueue(
        channelName || "gateway", 
        {durable: true});
    return channel;
}

async function createCommandChannel(exchangeName, channelName)
{
    let channel = await conn.createChannel();
    await channel.assertExchange(exchangeName, 'fanout', {durable: true});
    await channel.assertQueue(channelName, {durable: false});
    await channel.bindQueue(channelName, exchangeName, '');
    await channel.consume(channelName, async (msg) => {
        let packet = JSON.parse(msg.content.toString());

        console.log("command: " + JSON.stringify(packet));

        if(discord.shards.has(packet.shard_id))
        {
            let shard = discord.shards.get(packet.shard_id);
            switch(packet.type || undefined)
            {
                case "reconnect": {
                    await shard.reconnect();
                } break;

                case undefined: {
                    await shard.send(packet.opcode, packet.data);   
                } break;

                default: {
                    return;
                }
            }
        }
    }, {noAck: true});
    return channel;
}

async function getConnection()
{
    while(true)
    {
        conn = await initConnection();

        if(conn == null)
        {
            console.log("[WARN] >> connection failed, retrying in 5 seconds..")
            setTimeout(() => {}, 5000);
            continue;
        }

        break;
    }

    console.log("[ OK ] >> (re)connected")
    return conn;
}

main();