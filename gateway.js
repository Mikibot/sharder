const { Cluster } = require('@spectacles/gateway');
const rabbitmq   = require('amqplib');
const config     = require("./config");
const util       = require('util');

const client = new Cluster(config.token, {
    reconnect: true
});

client.gateway = {
    url: "wss://gateway.discord.gg/",
    shards: config.shardCount,
};

var conn = null;

var gatewayChannel = null;

var commandChannel = null;

client.on('error', (error) => {
    console.error("[ ERR} >> " + error);
})

client.on('receive', async (packet, shard) => 
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

    if(config.logLevel > 0)
    {
        console.log(`[${packet.t}]`);
        if(config.logLevel > 1)
        {
            console.log(packet.d);
        }
    }

	if(config.ignorePackets.includes(packet.t))
	{
		if(config.logLevel > 0)
		{
			console.log("^ ignored");
		}
		return;
    }
	
    await gatewayChannel.sendToQueue(config.rabbitChannel, Buffer.from(JSON.stringify(packet)));   
    return;
});

async function main()
{   
    conn = await getConnection();

    gatewayChannel = await createPushChannel(config.rabbitChannel);
}

async function initConnection()
{
    try
    {
        let newConn = await rabbitmq.connect(config.rabbitUrl, {
            defaultExchangeName: config.rabbitExchange
        });

        newConn.on('error', async (err) => {
            console.log("[CRIT] CN " + err);
            conn = getConnection();
        });

        conn = newConn;

        commandChannel = await conn.createChannel();
        await commandChannel.assertExchange(config.rabbitExchange + "-command", 'fanout', {durable: false});

        await commandChannel.assertQueue("gateway-command")
        await commandChannel.consume("gateway-command", async (msg) => {

            console.log("message receieved");

            let packet = JSON.parse(msg.content.toString());

            console.log(JSON.stringify(packet));

            if(client.shards.has(packet.shard_id))
            {
                let shard = client.shards.get(packet.shard_id);
                await shard.send(packet.opcode, packet.data);   
            }
        }, {noAck: true});
        return newConn;
    }
    catch(err)
    {
        console.log("[WARN] >> " + err);
        return null;
    }
}

async function createPushChannel(channelName)
{
    var channel = await conn.createChannel();
     
    channel.on('error', function(err) {
        console.log("[CRIT] CH " + err);
    });

    assert = await channel.assertQueue(channelName, {durable: true});

    return channel;
}

async function getConnection()
{
    while(true)
    {
        conn = await initConnection();

        if(conn == null)
        {
            console.log("[WARN] >> connection failed, retrying..")
            setTimeout(() => {}, 1000);
            continue;
        }

        break;
    }

    console.log("[ OK ] >> (re)connected")
    return conn;
}

var shardsToInit = [];
for(var i = config.shardIndex; i < config.shardIndex + config.shardInit; i++)
{
    shardsToInit.push(i);
}

main();

console.log(`[ .. ] >> intiating shards: ${shardsToInit}`);

client.spawn(shardsToInit);