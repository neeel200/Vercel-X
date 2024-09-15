const fs = require("fs")
const path = require("path")
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const mime = require("mime-types")
const { exec } = require('child_process')

const s3 = new S3Client({
    region: "",
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
        console.log('data : ', data.toString())
    })
    process.stdout.on('error', function (err) {
        console.log('Error : ', err.toString())
    })

    // when done, read the contents of the dist i.e build folder and upload them to s3
    process.stdout.on('close', async function () {
        console.log('Build complete !')
        const distFolderPath = path.join(__dirname, 'output', 'dist');
        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true })

        for (const filePath of distFolderContents) {

            // only uploads fils to s3 therefore ditching the folder path (though there will be none but for safety)
            if (fs.lstatSync(filePath).isDirectory()) continue;

            // uploading files to s3
            const PROJECT_ID = proces.env.PROJECT_ID;
            const putCommand = new PutObjectCommand ({
                Bucket:"",
                Key: `__outputs/${PROJECT_ID}/${filePath}`,
                Body: fs.createReadStream(filePath),
                ContentType:  mime.lookup(filePath)
            })
            await s3.send(putCommand);
            
        }
        console.log("s3 uploads done !!!")
    })
}