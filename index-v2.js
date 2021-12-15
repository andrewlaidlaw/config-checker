// import packages
const express = require('express');
const upload = require('express-fileupload');
const ejs = require('ejs');
const fs = require('fs');
const { SSL_OP_EPHEMERAL_RSA } = require('constants');

// setup local variables
var datafile = 'data.json';
// if data file hasn't yet been uploaded, create a blank JSON file
if (!fs.existsSync('./' + datafile)) {
    fs.writeFileSync('./' + datafile, JSON.stringify({}))
  }
var data = require('./' + datafile);
var shortfeatures = [];

// Set Express.js to listen for all connections
const app = express();
const port = 8080;
const hostname = "0.0.0.0";

// Using the EJS renderer for pages
app.set('view engine', 'ejs');

// Use some other components
app.use(upload());
app.use(express.static('images'));

// Response on / based on whether data file is already present
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
                console.log('Uploading file to ' + filename);
                if (err) {
                    console.log('Upload error: ' + err);
                    return res.status(500).send(err);
                };
            });
            console.log('File uploaded to ' + filename + ' with size ' + req.files.uploadfile.size + ' bytes');
            
            // update the array of short features in case of upload since last launch
            newdata = fs.readFileSync('./' + datafile);
            data = JSON.parse(newdata);
            shortfeatures= [];

            if (data.reasons) {
                    data.reasons.forEach(addtoarray);
                }

            var models = data.models;

            // These are variables in use in the code below
            var problemreasons = [];
            var features = [];
            var insystem = false;
            var modeltype = "";

            // Parse the content of the uploaded file (in memory)
            var filecontent = req.files.uploadfile.data;
            var content = filecontent.toString('utf-8');

            // Split the uploaded file into lines to process
            content.split(/\r?\n/).forEach(line => {
                // If the line starts with a machine type / model designation, start paying attention
                if (line.substr(0, 8).match(/^\d{4}-[A-Z0-9]{3}$/g)) {
                    modeltype = line.substr(0,8);
                    // Only record features against new models, not existing hardware
                    if (models.includes(modeltype)) {
                        insystem = true;
                    }
                }
                // If line starts with a feature code, add that to our array of features
                else if (line.substr(0,8).match(/^\s{4}[0-9A-Z]{4}/g) && insystem == true) {
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
           
            // We now have an array of features to check
            console.log('Features: ' + features);

            problemfeatures = [];
            safefeatures = [];

            // Check each feature codes against our list of short features
            features.forEach(featurecheck);

            function featurecheck(feature) {
                if (shortfeatures.includes(feature)) {
                    problemfeatures.push(feature);
                    data.reasons.forEach(checkreason);

                    function checkreason(reason) {
                        if (reason.features.includes(feature)) {
                            reason.feature = feature;
                            problemreasons.push(reason);
                        }
                    }

                } else {
                    safefeatures.push(feature);
                }
            };

            // Steps to pull unique values from arrays of feature codes (clean up)
            problemreasons = Array.from(new Set(problemreasons));
            problemfeatures = Array.from(new Set(problemfeatures));
            safefeatures = Array.from(new Set(safefeatures));

            console.log('Problem features: ' + problemfeatures);
            // Present a pretty JSON version of the feature codes
            // res.send(JSON.parse('{"problemFeatures" : ' + JSON.stringify(problemfeatures) + ', "safeFeatures" : ' + JSON.stringify(safefeatures) + ', "problemreasons" : ' + JSON.stringify(problemreasons) + '}'));
            var messagedata = JSON.parse('{"problemfeatures" : ' + JSON.stringify(problemfeatures) + ', "safefeatures" : ' + JSON.stringify(safefeatures) + ', "problemreasons" : ' + JSON.stringify(problemreasons) + '}');

            res.render('result', { message: messagedata});

            // Delete the file that we uploaded previously
            fs.unlink(filename, (err) => {
                if (err) console.log(err);
            });
            console.log('file ' + filename + ' deleted');
        }

    } else {
        console.log('No file uploaded');
        res.render('uploadfile', { message:'No file uploaded. Please select a config text file and try again.', error: true});
    }
});

// Present the upload page when pointed to /upload
app.get("/upload", function(req,res) {
    res.render('uploadfile');
});

// Render a page including all short features and reasons
app.get("/listing", function(req,res) {
    newdata = fs.readFileSync('./' + datafile);
    data = JSON.parse(newdata);
    res.render('listing', {message: data.reasons});
})

// Present an upload page for the JSON formatted data file including shortages
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
            
            // Now suggest that people upload configuration file to check
            res.render('uploadfile', { message:'New data file uploaded with size ' + req.files.uploadfile.size + ' bytes.', error: false});
        }
    } else {
        console.log('No file uploaded');
        res.render('updatefile', { message:'No file uploaded. Please select a JSON file and try again.', error: true, data: true});
    }
});

// Present the upload page for data file when pointed to /update
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

});

// Global functions that are used in multiple places
function addtoarray(reason) {
    reason.features.forEach(addtoarrayelement);
}
    
function addtoarrayelement(feature) {
        shortfeatures.push(feature);
    }