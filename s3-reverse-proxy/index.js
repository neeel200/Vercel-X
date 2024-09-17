const express = require("express")
const httpProxy = require("http-proxy")

const app = express();
const PORT = 8000;

// reverse-proxy is needed as we will be fetching the build code from s3 dynamicaly on the basis of PROJECT_ID (like a1.localhost:8000)and stream that on the frontend after the build has been done and pushed into the s3 bucket.

// middleware to catch every request and route the request on the basis of subdomain
const bucketName = "";
const BASE_PATH = `https://${bucketName}.s3.ap-south-1.amazonaws.com/__outputs`;
const proxy = httpProxy.createProxy();
app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0]; // PROJECT_ID

    // s3 object path
    const resolvesTo = `${BASE_PATH}/${subdomain}`;

    return  proxy.web(req, res, {target: resolvesTo, changeOrigin: true})
})

// if nothing is passed after ip in the request then manually append index.html else do nothing
proxy.on('proxyReq', (proxyReq, req, res) => {

    const url = req.url;
    if(url === '/')
        proxyReq.path += 'index.html'
})

app.listen(PORT, () => console.log("Reverse-proxy server running on port", PORT))