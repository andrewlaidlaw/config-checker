// import packages
const csvtojson = require('csvtojson');
const express = require('express');
const upload = require('express-fileupload');
const ejs = require('ejs');
const fs = require('fs');
const readline = require('readline');
const nReadlines = require('n-readlines');
const { SSL_OP_EPHEMERAL_RSA } = require('constants');

// setup local variables
// var filename = 'configfile';
var datafile = 'data.json';
if (!fs.existsSync('./' + datafile)) {
    fs.writeFileSync('./' + datafile, JSON.stringify({}))
  }
var data = require('./' + datafile);
var shortfeatures = [];
var problemreasons = [];

// Set Express.js to listen for all connections
const app = express();
const port = 8080;
const hostname = "0.0.0.0";

// Using the EJS renderer for pages
app.set('view engine', 'ejs');

// Use some other components
app.use(upload());
app.use(express.static('images'));

// Basic response on /
app.get('/', (req, res) => {
    newdata = fs.readFileSync('./' + datafile);
    data = JSON.parse(newdata);

    if (data.models) {
        res.render('uploadfile');
    } else {
        res.render('updatefile', {data: false});
    }
});

// Healthcheck response
app.get('/healthz', (req, res) => {
    res.send("ok");
});

// Save the file uploaded as uploadfile to filename
app.post("/upload", function(req, res) {
    console.log('Upload started');
    var timestamp = + new Date();
    var filename = 'file' + timestamp;
    console.log('Uploading file to ' + filename);
    if(req.files) {
        if(Array.isArray(req.files.uploadfile)) {
            console.log('Array of files was uploaded');
            res.render('uploadfile', { message:'Please upload a single text file only', error: true});
        }
        else if (!req.files.uploadfile) {
            console.log('Files were uploaded but not as "file"');
            res.render('uploadfile', { message:'File not uploaded as "file"', error: true});
        }
        else if (!req.files || Object.keys(req.files).length === 0) {
            console.log('No files were uploaded');
            res.render('uploadfile', { message:'No file uploaded. Please select a config file and try again.', error: true});
        } else {
            req.files.uploadfile.mv(filename, function(err) {
                if (err) {
                    console.log('Upload error: ' + err);
                    return res.status(500).send(err);
                };
            });
            console.log('File uploaded to ' + filename + ' with size ' + req.files.uploadfile.size + ' bytes');
            // res.send(JSON.parse('{"result":"success", "message": "File uploaded with size ' + req.files.uploadfile.size + ' bytes", "fileSize": ' + req.files.uploadfile.size + '}'));

            // const rl = readline.createInterface({
            //     input: fs.createReadStream(filename),
            //     output: process.stdout,
            //     terminal: false
            // });
            
            newdata = fs.readFileSync('./' + datafile);
            data = JSON.parse(newdata);
            shortfeatures= [];

            if (data.reasons) {
                    data.reasons.forEach(addtoarray);
                }
            console.log(newdata);
            console.log('Short features from data.json:');
            console.log(shortfeatures);
                
            function addtoarray(reason) {
                reason.features.forEach(addtoarrayelement);
                }
                        
            function addtoarrayelement(feature) {
                shortfeatures.push(feature);
                }

            var models = data.models;

            // These are variables in use in the code below
            var problemreasons = [];
            var features = [];
            var insystem = false;
            var modeltype = "";
            
            console.log('Filename: ' + filename);
            // const readlines = new nReadlines(filename.toString());
            // let line;
            // let linenumber = 0;
            // line = readlines.next();
            // console.log(linenumber + ' line: ' + line);

            const filecontent = req.files.uploadfile.data;

            console.log('Starting while loop');
            //while (line = readlines.next()) {
                console.log(filecontent);

            filecontent.split(/\r?\n/).forEach(line => {

                console.log('Line: ' + line);
            // for await (const line of rl) {
            //rl.on('line', (line) => {
                // If line starts with a machine type / model then start picking out feature codes
                if (line.substr(0, 8).match(/^\d{4}-[A-Z0-9]{3}$/g)) {
                    modeltype = line.substr(0,8);
                    console.log('Model: ' + modeltype);
                    if (models.includes(modeltype)) {
                        // console.log(modeltype);
                        insystem = true;
                    }
                }
                // If line starts with a feature code, add that to our array of features
                else if (line.substr(0,8).match(/^\s{4}[0-9A-Z]{4}/g) && insystem == true) {
                    console.log('Feature: ' + line.substr(4,4));
                    features.push(line.substr(4,4));
                }
                // If line has 8 blank characters, do nothing
                else if (line.substr(0,8).match(/^\s{8}/g)) {
                    // do nothing for blank
                }
                // For any other line, we must be beyond the machine listing so stop recording feature codes
                else {
                    insystem = false;
                };
            //});
           });
        
            //for await (const close of rl) {
            // rl.on('close', () => {
                console.log('End of file');
                console.log('Features: ' + features);
                // return features;
                // res.send(features);
                problemfeatures = [];
                safefeatures = [];
                features.forEach(featurecheck);

                function featurecheck(feature) {
                    if (shortfeatures.includes(feature)) {
                        console.log(feature);

                        problemfeatures.push(feature);

                        data.reasons.forEach(checkreason);

                        function checkreason(reason) {
                            if (reason.features.includes(feature)) {
                                reason.feature = feature;
                                problemreasons.push(reason);
                                // console.log(problemreasons);
                            }
                        }

                        // return feature;
                    } else {
                        safefeatures.push(feature);
                    }
                    //console.log(feature);

                };

                // Steps to pull unique values from arrays of feature codes
                problemreasons = Array.from(new Set(problemreasons));
                problemfeatures = Array.from(new Set(problemfeatures));
                safefeatures = Array.from(new Set(safefeatures));

                // Present a pretty JSON version of the feature codes
                // res.send(JSON.parse('{"problemFeatures" : ' + JSON.stringify(problemfeatures) + ', "safeFeatures" : ' + JSON.stringify(safefeatures) + ', "problemreasons" : ' + JSON.stringify(problemreasons) + '}'));
                var messagedata = JSON.parse('{"problemfeatures" : ' + JSON.stringify(problemfeatures) + ', "safefeatures" : ' + JSON.stringify(safefeatures) + ', "problemreasons" : ' + JSON.stringify(problemreasons) + '}');

                res.render('result', { message: messagedata});
                //res.send(JSON.parse(problemfeatures));
                fs.unlink(filename, (err) => {
                    if (err) console.log(err);
                });
                console.log('file ' + filename + ' deleted');
                
            //});
            //};

            
        }
    } else {
        console.log('No file uploaded');
        res.render('uploadfile', { message:'No file uploaded. Please select a config text file and try again.', error: true});
    }
});

app.get("/upload", function(req,res) {
    res.render('uploadfile');
});

app.get("/listing", function(req,res) {
    newdata = fs.readFileSync('./' + datafile);
    data = JSON.parse(newdata);
    res.render('listing', {message: data.reasons});
})

app.post("/update", function(req, res) {
    console.log('Upload started');
    if(req.files) {
        if(Array.isArray(req.files.uploadfile)) {
            console.log('Array of files was uploaded');
            res.render('updatefile', { message:'Please upload a single JSON file only', error: true, data: true});
        }
        else if (!req.files.uploadfile) {
            console.log('Files were uploaded but not as "file"');
            res.render('updatefile', { message:'File not uploaded as "file"', error: true, data: true});
        }
        else if (!req.files || Object.keys(req.files).length === 0) {
            console.log('No files were uploaded');
            res.render('updatefile', { message:'No file uploaded. Please select a config file and try again.', error: true, data: true});
        } else {
            req.files.uploadfile.mv(datafile, function(err) {
                if (err) {
                    console.log('Upload error: ' + err);
                    return res.status(500).send(err);
                };
            });
            console.log('Data file uploaded to ' + datafile + ' with size ' + req.files.uploadfile.size + ' bytes');
            // data = fs.readFileSync('./' + datafile);
            // // data = JSON.parse(newdata);

            // if (data.reasons) {
            //     data.reasons.forEach(addtoarray);
            // }
            // console.log(newdata);
            // console.log('Short features from data.json:');
            // console.log(shortfeatures);
        
            // function addtoarray(reason) {
            //     reason.features.forEach(addtoarrayelement);
            // }
                
            // function addtoarrayelement(feature) {
            //     shortfeatures.push(feature);
            // }

            res.render('uploadfile', { message:'New data file uploaded with size ' + req.files.uploadfile.size + ' bytes.', error: false});
        }
    } else {
        console.log('No file uploaded');
        res.render('updatefile', { message:'No file uploaded. Please select a JSON file and try again.', error: true, data: true});
    }
});

app.get("/update", function(req,res) {
    res.render('updatefile');
});

// Deploy web server and log and read data from datafile
app.listen(port, hostname, () => {
    if (data.reasons) {
        data.reasons.forEach(addtoarray);
    }
    console.log('Short features from data.json:');
    console.log(shortfeatures);
    console.log(`Service running on ` + hostname + ":" + port);

    function addtoarray(reason) {
        reason.features.forEach(addtoarrayelement);
    }
        
    function addtoarrayelement(feature) {
            shortfeatures.push(feature);
        }
})

// Function to parse a config file (txt) and return an array of feature codes
async function parseconfig(filename) {
    const rl = readline.createInterface({
        input: fs.createReadStream(filename),
        output: process.stdout,
        terminal: false
    });
    
    var models = ["9119-MME", "9080-HEX", "9119-41G"];
    var features = [];
    var insystem = false;
    var modeltype = "";

    //for await (const line of rl) {
    rl.on('line', (line) => {
        // If line starts with a machine type / model then start picking out feature codes
        if (line.substr(0, 8).match(/^\d{4}-[A-Z0-9]{3}$/g)) {
            modeltype = line.substr(0,8);
            // console.log(modeltype);
            if (models.includes(modeltype)) {
                console.log(modeltype);
                insystem = true;
            }
        }
        // If line starts with a feature code, add that to our array of features
        else if (line.substr(0,8).match(/^\s{4}[0-9A-Z]{4}/g) && insystem == true) {
            console.log(line.substr(4,4));
            features.push(line.substr(4,4));
        }
        // If line has 8 blank characters, do nothing
        else if (line.substr(0,8).match(/^\s{8}/g)) {
            // do nothing for blank
        }
        // For any other line, we must be beyond the machine listing so stop recording feature codes
        else {
            insystem = false;
        };
    });

    //for await (const close of rl) {
    rl.on('close', () => {
        console.log('End of file');
        console.log('Features: ' + features);
        return features;
        // res.send(features);
    });
}