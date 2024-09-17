const express = require('express')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
const Redis = require("ioredis")
const {Server} = require("socket.io")
const app = express()
const PORT = 9000
const subscriber = new Redis("connectionString");

// main server on which the frontend will hit and get back the proxy-server's url which is a s3 object link
// this server will spin a container via ECS stored in ECR

//client will connect to the channel in websocket and we will send any event we get from redis to client via websocket
// on frontend:-
// 1. listen on message event 
// 2. sent logs:projectSlug (get projectSlug by hitting the main /project api )

const io = new Server({cors: '*'})
io.listen(9001, () => console.log(`Socket Server running on port ${9001}`))

io.on('connection', socket => {
    socket.on('subscribe', (channel)=>{
        socket.join(channel);
        socket.emit('message', `Joined ${channel}`)
    })
})


const ecsClient = new ECSClient({
    region: '',
    credentials: {
        accessKeyId: '',
        secretAccessKey: ''
    }
})

const config = {
    CLUSTER: '',
    TASK: ''
}

app.use(express.json())

app.post('/project', async (req, res) => {
    const { gitURL, slug } = req.body
    const projectSlug = slug ? slug : generateSlug()

    // Spin the container
    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: ['', '', ''],
                securityGroups: ['']
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        { name: 'GIT_REPOSITORY__URL', value: gitURL },
                        { name: 'PROJECT_ID', value: projectSlug }
                    ]
                }
            ]
        }
    })

    await ecsClient.send(command);

    return res.json({ status: 'queued', data: { projectSlug, url: `http://${projectSlug}.localhost:8000` } })

})

// redis subscribe code (for server)
async function initRedisSubscribe() {
    console.log('Subscribe to logs...');
    subscriber.psubscribe('logs:*');
    subscriber.on('pmessage', (pattern, channel, message) => {

        // publish message to client connected on a channel via websockets
        io.to(channel).emit('message', message)
    })
}
initRedisSubscribe();

app.listen(PORT, () => console.log(`API Server Running..${PORT}`))
