const fs = require("fs")
const path = require("path")
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const Redis = require("ioredis")
const mime = require("mime-types")
const { exec } = require('child_process')

/* 
   flow:-
   frontend requests to api-server, this spins the container (biuld-server) via ECS which builds the code , inside this container while building we publish logs to our redis under channel name `logs:*` and in the api-server we subscribe to these logs and as we get logs we publish them to the client connected with a websocket to our api-server (in the websocket console when requested with channel name logs:*). The response of the project api (in api-server) returns a  build url (of reverse-proxy-server) and this reverse-proxy-server render the index.html default or any asset when made a get call on the provided url from the api-server .
*/

//publishing logs to redis (as it has high throughput) as we build onto a channel 
const publisher = new Redis("connectionString");
const PROJECT_ID = process.env.PROJECT_ID;
function publishLog(log) {
    //channel project id
    publisher.publish(`logs: ${PROJECT_ID}`, JSON.stringify({log}))
}
const s3 = new S3Client({
    region: "ap-south-1",
    credentials:{
        secretAccessKey: "",
        accessKeyId: ""
    }
})
// exec spins a child process with a  separate shell and executes certain commands 

async function init() {
    console.log('Executing script.js ...');


    // as our clonned git folder will be stored in `output` folder (on the top level) after the main.sh is executed and that will be executed inside our docker container.
    const outDirPath = path.join(__dirname, 'output');

    // spin a child process which executes certain commands i.e changing dir to output folder then npm i then build
    const process = exec(`cd ${outDirPath} && npm install && npm run build`)

    // while the child process (named as process) is running grab and log the stream of data and look for errors
    process.stdout.on('data', function (data) {
        console.log('data : ', data.toString(), "\n")
        publishLog(data.toString());
    })
    process.stdout.on('error', function (err) {
        console.log('Error : ', err.toString(), "\n")
        publishLog(`Error: ${data.toString()}`);
    })

    // when done, read the contents of the dist i.e build folder and upload them to s3
    process.stdout.on('close', async function () {
        console.log('Build Complete !', "\n")
        publishLog(`Build Complete`);
        const distFolderPath = path.join(__dirname, 'output', 'dist');
        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true });

        publishLog(`Starting to upload...`);

        for (const fileName of distFolderContents) {

            const filePath = path.join(__dirname, fileName);

            publishLog(`Uploading file: ${fileName}`);
            // only uploads files to s3 therefore ditching the folder path (though there will be none but for safety)
            if (fs.lstatSync(filePath).isDirectory()) continue;
            
            console.log("uploading", filePath, "\n")
            
            // uploading files to s3
            
            const putCommand = new PutObjectCommand ({
                Bucket:"",
                Key: `__outputs/${PROJECT_ID}/${fileName}`,
                Body: fs.createReadStream(filePath),
                ContentType:  mime.lookup(filePath)
            })
            await s3.send(putCommand);
            
            console.log("uploaded", filePath, "\n")
            publishLog(`uploaded, ${filePath}`);
        }
        console.log("s3 uploads done !!!")
        publishLog(`Done!!!`);
    })
}

init();